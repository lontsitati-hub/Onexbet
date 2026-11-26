import { BetEvent } from '@/types/bet';

export const POKER_DEFAULT_DURATION_MS = 3 * 60 * 1000;

export interface PokerSimulationPlan {
  durationMs: number;
  seed: number;
}

export interface PokerSimulationState {
  isLive: boolean;
  isFinished: boolean;
  elapsedMs: number;
  liveTime: 'En direct' | 'Terminé' | 'À venir';
  plan: PokerSimulationPlan;
}

export interface PokerCashoutState {
  isLive: boolean;
  isWinning: boolean;
  sellAmount: number;
  maximumAmount: number;
}

const stableSeed = (event: BetEvent): number => {
  const source = `${event.id}:${event.betType}:${event.tournament}:${event.scheduledAt || event.date}`;
  return Array.from(source).reduce((sum, char, index) => (sum + char.charCodeAt(0) * (index + 23)) >>> 0, 0);
};

export const isPokerEvent = (event: BetEvent): boolean =>
  event.sport === 'Poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(event.tournament.trim());

/**
 * La manche Poker simulée construit son résultat à partir de l'option choisie
 * (main gagnante ou combinaison). Tout événement reconnu comme Poker est donc
 * réglé gagnant : le règlement ne doit pas dépendre d'une deuxième liste de
 * libellés susceptible de diverger des choix disponibles dans l'interface.
 */
export const isPokerBetWon = (event: BetEvent): boolean => isPokerEvent(event);

export const getPokerStartMs = (event: BetEvent): number | null => {
  // L’horaire programmé reste prioritaire sur un éventuel état live prématuré.
  const source = event.scheduledAt || event.liveStartedAt;
  if (!source) return null;
  const parsed = new Date(source).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const isPokerStartDue = (event: BetEvent, nowMs = Date.now()): boolean => {
  const startMs = getPokerStartMs(event);
  return startMs !== null && startMs <= nowMs;
};

export const createPokerSimulationPlan = (event: BetEvent): PokerSimulationPlan => ({
  durationMs: Number.isFinite(event.pokerSimulation?.durationMs) && (event.pokerSimulation?.durationMs || 0) > 0
    ? Math.max(1000, event.pokerSimulation!.durationMs)
    : POKER_DEFAULT_DURATION_MS,
  seed: stableSeed(event),
});

export const getPokerSimulationState = (event: BetEvent, nowMs = Date.now()): PokerSimulationState | null => {
  if (!isPokerEvent(event)) return null;
  const plan = createPokerSimulationPlan(event);
  const startMs = getPokerStartMs(event);
  if (startMs === null || !Number.isFinite(startMs) || startMs > nowMs || event.status === 'Perdu') {
    return { isLive: false, isFinished: false, elapsedMs: 0, liveTime: 'À venir', plan };
  }
  const elapsedMs = Math.max(0, nowMs - startMs);
  const isFinished = event.status === 'Gagné' || event.status === 'Payé' || elapsedMs >= plan.durationMs;
  return {
    isLive: !isFinished,
    isFinished,
    elapsedMs: Math.min(elapsedMs, plan.durationMs),
    liveTime: isFinished ? 'Terminé' : 'En direct',
    plan,
  };
};

/**
 * Calcule le cash-out Poker sans jamais atteindre la cote complète.
 * Le montant progresse quand l'option sélectionnée est gagnante et reste
 * volontairement inférieur au gain théorique jusqu'au règlement final.
 */
export const getPokerCashoutState = (
  slip: { stake: number; totalOdds: number; events?: BetEvent[] },
  nowMs = Date.now(),
): PokerCashoutState => {
  const events = (slip.events ?? []).filter(isPokerEvent);
  const maximumAmount = Math.max(0, Number((slip.stake * slip.totalOdds).toFixed(2)));
  const strictMaximum = maximumAmount > 0 ? Math.max(0, Number((maximumAmount - 0.01).toFixed(2))) : 0;
  if (events.length === 0) {
    return { isLive: false, isWinning: false, sellAmount: Math.min(strictMaximum, Math.max(0, slip.stake)), maximumAmount };
  }

  const states = events.map((event) => getPokerSimulationState(event, nowMs));
  const liveStates = states.filter((state): state is PokerSimulationState => Boolean(state?.isLive));
  if (liveStates.length === 0) {
    return { isLive: false, isWinning: false, sellAmount: Math.min(strictMaximum, Math.max(0, slip.stake)), maximumAmount };
  }

  const progress = liveStates.reduce((sum, state) => sum + state.elapsedMs / state.plan.durationMs, 0) / liveStates.length;
  const isWinning = events.every((event) => isPokerBetWon(event));
  const confidence = isWinning
    ? 0.35 + progress * 0.64
    : Math.max(0.05, 0.35 - progress * 0.30);
  const progressiveAmount = slip.stake * (1 + (slip.totalOdds - 1) * confidence);
  const sellAmount = Math.min(strictMaximum, Math.max(0, Number(progressiveAmount.toFixed(2))));
  return { isLive: true, isWinning, sellAmount, maximumAmount };
};
