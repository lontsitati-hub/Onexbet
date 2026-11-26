import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Gestion des retraits — stockée localement (AsyncStorage)
// Chaque retrait confirmé débite le solde et crée une notification dans la messagerie.
// ─────────────────────────────────────────────────────────────────────────────

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  accountRef: string;
  status: WithdrawalStatus;
  createdAt: number;
  decidedAt?: number;
  note?: string;
}

export interface WithdrawalMessage {
  id: string;
  withdrawalId: string;
  title: string;
  body: string;
  type: 'pending' | 'approved' | 'rejected' | 'deposit';
  read: boolean;
  createdAt: number;
}

const WITHDRAWALS_KEY = 'onexbet_withdrawals';
const MESSAGES_KEY = 'onexbet_withdrawal_messages';

function genId(): string {
  return 'wd-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
}

function genTransactionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function readItems<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch (e) {
    console.error('Error reading', key, e);
    return [];
  }
}

async function writeItems<T>(key: string, items: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error('Error writing', key, e);
  }
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} (${hh}:${min})`;
}

/**
 * Enregistre un retrait confirmé. Le montant est immédiatement déduit du solde
 * par l’écran appelant et une notification de validation est ajoutée à la messagerie.
 */
export async function requestWithdrawal(
  amount: number,
  method: string,
  accountRef: string
): Promise<Withdrawal> {
  const withdrawals = await readItems<Withdrawal>(WITHDRAWALS_KEY);
  const withdrawal: Withdrawal = {
    id: genId(),
    amount,
    method,
    accountRef,
    status: 'pending',
    createdAt: Date.now(),
  };
  await writeItems(WITHDRAWALS_KEY, [withdrawal, ...withdrawals]);

  // Notification de validation : aucune mention de simulation.
  const messages = await readItems<WithdrawalMessage>(MESSAGES_KEY);
  const validationMsg: WithdrawalMessage = {
    id: genId(),
    withdrawalId: withdrawal.id,
    title: 'Retrait validé',
    body: `Votre demande de retrait de ${amount.toFixed(2)} ₣ via ${method} a été validée. Le montant a été débité de votre solde Onexbet et sera transféré vers ${accountRef}.`,
    type: 'approved',
    read: false,
    createdAt: Date.now(),
  };
  await writeItems(MESSAGES_KEY, [validationMsg, ...messages]);

  return withdrawal;
}

/**
 * Met à jour le statut d’un retrait depuis l’administration. En cas de refus,
 * l’écran appelant rembourse le montant au solde de l’utilisateur.
 */
export async function decideWithdrawalStatus(
  id: string,
  status: WithdrawalStatus
): Promise<void> {
  const withdrawals = await readItems<Withdrawal>(WITHDRAWALS_KEY);
  const idx = withdrawals.findIndex((w) => w.id === id);
  if (idx === -1 || withdrawals[idx].status !== 'pending') return;

  const decidedAt = Date.now();

  if (status === 'approved') {
    withdrawals[idx] = {
      ...withdrawals[idx],
      status: 'approved',
      decidedAt,
      note: genTransactionCode(),
    };
  } else if (status === 'rejected') {
    withdrawals[idx] = {
      ...withdrawals[idx],
      status: 'rejected',
      decidedAt,
      note: 'Frais d\'analyse de sécurité.',
    };
  } else {
    withdrawals[idx] = {
      ...withdrawals[idx],
      status: 'pending',
      decidedAt,
    };
  }
  await writeItems(WITHDRAWALS_KEY, withdrawals);

  const messages = await readItems<WithdrawalMessage>(MESSAGES_KEY);
  const w = withdrawals[idx];
  const decisionMsg: WithdrawalMessage = {
    id: genId(),
    withdrawalId: w.id,
    title:
      status === 'approved'
        ? 'Retrait approuvé'
        : status === 'rejected'
          ? 'Retrait refusé'
          : 'Retrait en attente',
    body:
      status === 'approved'
        ? `Votre retrait de ${w.amount.toFixed(2)} ₣ via ${w.method} (${w.accountRef}) a été approuvé. Référence de transaction : ${w.note}. Les fonds sont transférés vers votre compte.`
        : status === 'rejected'
          ? `Votre retrait de ${w.amount.toFixed(2)} ₣ a été refusé pour vérification. Veuillez réessayer ultérieurement ou contacter le support.`
          : `Votre retrait de ${w.amount.toFixed(2)} ₣ via ${w.method} est toujours en cours de traitement. Vous recevrez une confirmation sous peu.`,
    type: status,
    read: false,
    createdAt: decidedAt,
  };
  await writeItems(MESSAGES_KEY, [decisionMsg, ...messages]);
}

/** Enregistre une notification locale après un dépôt enregistré. */
export async function addDepositMessage(amount: number): Promise<void> {
  const messages = await readItems<WithdrawalMessage>(MESSAGES_KEY);
  const message: WithdrawalMessage = {
    id: genId(),
    withdrawalId: `deposit-${Date.now()}`,
    title: 'Dépôt enregistré',
    body: `Votre dépôt de ${amount.toFixed(2)} ₣ a été ajouté à votre solde.`,
    type: 'deposit',
    read: false,
    createdAt: Date.now(),
  };
  await writeItems(MESSAGES_KEY, [message, ...messages]);
}

export async function getWithdrawals(): Promise<Withdrawal[]> {
  return readItems<Withdrawal>(WITHDRAWALS_KEY);
}

export async function getMessages(): Promise<WithdrawalMessage[]> {
  return readItems<WithdrawalMessage>(MESSAGES_KEY);
}

export async function markMessagesAsRead(): Promise<void> {
  const messages = await readItems<WithdrawalMessage>(MESSAGES_KEY);
  await writeItems(
    MESSAGES_KEY,
    messages.map((m) => ({ ...m, read: true }))
  );
}

export function getUnreadCount(messages: WithdrawalMessage[]): number {
  return messages.filter((m) => !m.read).length;
}
