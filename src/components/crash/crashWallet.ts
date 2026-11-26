export type CrashWalletSnapshot = { amount: number; currency: 'XAF' };
export type CrashWalletOperation = 'getBalance' | 'debit' | 'activateBet' | 'credit' | 'settleLoss';

export type CrashWalletPayload = {
  requestId?: string;
  amount?: number;
  gameId?: string;
  roundId?: string;
  betId?: string | number;
  betAmount?: number;
  multiplier?: number;
};

export type CrashWalletRequest = {
  operation: CrashWalletOperation;
  payload?: CrashWalletPayload;
};

export type CrashWalletStore = {
  getBalance: () => number;
  updateBalance: (amount: number) => boolean | void;
};

type ActiveBet = { amount: number; status: 'queued' | 'live' };
const MAX_BET = 358548.65;

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export class CrashWalletProcessor {
  private readonly completedTransactions = new Set<string>();
  private readonly activeBets = new Map<string, ActiveBet>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly store: CrashWalletStore) {}

  process(request: CrashWalletRequest): Promise<CrashWalletSnapshot> {
    return this.enqueue(() => this.execute(request));
  }

  closeOpenBets(): Promise<CrashWalletSnapshot> {
    return this.enqueue(async () => {
      for (const [key, bet] of this.activeBets) {
        if (bet.status === 'queued') {
          const current = this.snapshot().amount;
          this.persistBalance(roundMoney(current + bet.amount));
        }
        // A bet already in flight is treated as lost on exit; a queued, not-yet-started bet is refunded.
        this.activeBets.delete(key);
      }
      return this.snapshot();
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private snapshot(): CrashWalletSnapshot {
    const amount = Number(this.store.getBalance());
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Solde reçu invalide.');
    return { amount, currency: 'XAF' };
  }

  private persistBalance(amount: number): void {
    if (this.store.updateBalance(amount) === false) {
      throw new Error('Le solde n’a pas pu être enregistré. Réessayez avant de quitter.');
    }
  }

  private async execute(request: CrashWalletRequest): Promise<CrashWalletSnapshot> {
    if (request.operation === 'getBalance') return this.snapshot();

    const payload = request.payload ?? {};
    const requestId = payload.requestId?.trim();
    const gameId = payload.gameId;
    const roundId = payload.roundId?.trim();
    const betId = String(payload.betId ?? '').trim();
    if (!requestId || requestId.length > 180) throw new Error('Identifiant de transaction invalide.');
    if (gameId !== 'crash') throw new Error('Jeu non autorisé pour ce portefeuille.');
    if (!roundId || roundId.length > 100 || !betId || betId.length > 100) {
      throw new Error('Pari ou manche invalide.');
    }

    const transactionKey = `${request.operation}:${requestId}`;
    if (this.completedTransactions.has(transactionKey)) return this.snapshot();
    const activeBetKey = `${roundId}:${betId}`;

    if (request.operation === 'activateBet') {
      const activeBet = this.activeBets.get(activeBetKey);
      if (!activeBet || activeBet.status !== 'queued') throw new Error('Aucune mise en attente à activer.');
      activeBet.status = 'live';
      this.rememberTransaction(transactionKey);
      return this.snapshot();
    }

    if (request.operation === 'settleLoss') {
      const activeBet = this.activeBets.get(activeBetKey);
      if (!activeBet || activeBet.status !== 'live') throw new Error('Aucune mise active à clôturer.');
      this.activeBets.delete(activeBetKey);
      this.rememberTransaction(transactionKey);
      return this.snapshot();
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Montant de transaction invalide.');

    if (request.operation === 'debit') {
      if (amount < 200 || amount > MAX_BET) throw new Error('Mise autorisée : 200 à 358 548,65 XAF.');
      if (this.activeBets.has(activeBetKey)) throw new Error('Cette mise est déjà active pour cette manche.');
      const current = this.snapshot().amount;
      if (current < amount) throw new Error('Solde insuffisant.');
      this.persistBalance(roundMoney(current - amount));
      this.activeBets.set(activeBetKey, { amount, status: 'queued' });
      this.rememberTransaction(transactionKey);
      return this.snapshot();
    }

    if (request.operation === 'credit') {
      const activeBet = this.activeBets.get(activeBetKey);
      if (!activeBet || activeBet.status !== 'live') {
        throw new Error('Aucune mise active débitée ne correspond à cet encaissement.');
      }
      const betAmount = Number(payload.betAmount);
      const multiplier = Number(payload.multiplier);
      if (!Number.isFinite(betAmount) || Math.abs(betAmount - activeBet.amount) > 0.01) {
        throw new Error('La mise ne correspond pas au pari débité.');
      }
      if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 100000) {
        throw new Error('Cote de gain invalide.');
      }
      const expectedPayout = roundMoney(activeBet.amount * multiplier);
      if (Math.abs(amount - expectedPayout) > 0.01) throw new Error('Montant de gain incohérent.');
      const current = this.snapshot().amount;
      this.persistBalance(roundMoney(current + amount));
      this.activeBets.delete(activeBetKey);
      this.rememberTransaction(transactionKey);
      return this.snapshot();
    }

    throw new Error('Opération du portefeuille inconnue.');
  }

  private rememberTransaction(transactionKey: string): void {
    this.completedTransactions.add(transactionKey);
  }
}
