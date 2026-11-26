import { BetEvent, BetSlip } from '@/types/bet';
import { getFifaCashoutState } from '@/utils/fifaCashout';
import {
  getMortalKombatSimulationState,
  isMortalKombatBetWon,
  isMortalKombatEvent,
} from '@/utils/localMortalKombatSimulation';
import { getPokerSimulationState, isPokerBetWon, isPokerEvent } from '@/utils/localPokerSimulation';

export interface CombinedCashoutState {
  isLive: boolean;
  hasSpecialLive: boolean;
  cashoutClosed: boolean;
  canSell: boolean;
  sellAmount: number;
  maximumAmount: number;
  confidence: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const isFifaEvent = (event: BetEvent) => event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
const isSpecialEvent = (event: BetEvent) => isFifaEvent(event) || isMortalKombatEvent(event) || isPokerEvent(event);
const isWon = (event: BetEvent) => event.status === 'Gagné' || event.status === 'Payé';
const isLost = (event: BetEvent) => event.status === 'Perdu';

const isCashoutClosing = (event: BetEvent, nowMs: number): boolean => {
  if (isFifaEvent(event)) {
    return getFifaCashoutState({ id: 'cashout-check', type: 'Simple', date: '', eventCount: 1, finishedCount: 0, events: [event], stake: 1, potentialGain: 1, totalOdds: 1, status: 'Accepté' }, nowMs).cutoffReached;
  }
  if (isMortalKombatEvent(event)) {
    const state = getMortalKombatSimulationState(event, nowMs);
    return Boolean(state?.isLive && state.elapsedMs >= Math.max(0, state.plan.durationMs - 15_000));
  }
  if (isPokerEvent(event)) {
    const state = getPokerSimulationState(event, nowMs);
    return Boolean(state?.isLive && state.elapsedMs >= Math.max(0, state.plan.durationMs - 15_000));
  }
  return false;
};

export const getCombinedCashoutState = (slip: BetSlip, nowMs = Date.now()): CombinedCashoutState => {
  const stake = Math.max(0, Number(slip.stake) || 0);
  const odds = Number(slip.totalOdds);
  const validOdds = Number.isFinite(odds) && odds > 0 ? odds : 0;
  const maximumAmount = Math.max(0, Number((stake * validOdds).toFixed(2)));
  const storedAmount = Number(slip.sellAmount);
  const defaultBase = stake * 0.75;
  const baseAmount = Math.min(maximumAmount, Math.max(0, Number.isFinite(storedAmount) && storedAmount > 0 ? storedAmount : defaultBase));
  const events = slip.events ?? [];

  // Un simple football classique conserve toujours le montant configuré :
  // il ne progresse pas automatiquement pendant le match.
  if (slip.type === 'Simple' && events.length === 1 && !isSpecialEvent(events[0])) {
    return { isLive: false, hasSpecialLive: false, cashoutClosed: false, canSell: maximumAmount > 0, sellAmount: baseAmount, maximumAmount, confidence: 0 };
  }

  const evaluations = events.map((event) => {
    if (isWon(event)) return { live: false, specialLive: false, closing: false, confidence: 1 };
    if (isLost(event)) return { live: false, specialLive: false, closing: false, confidence: 0.02 };

    if (isFifaEvent(event)) {
      const state = getFifaCashoutState({ ...slip, events: [event], totalOdds: Math.max(1, event.odd || 1) }, nowMs);
      if (!state.isLive) return { live: false, specialLive: false, closing: false, confidence: 0.2 };
      return { live: true, specialLive: true, closing: state.cutoffReached, confidence: 0.14 + 0.86 * clamp01(state.optionProgress) };
    }

    if (isMortalKombatEvent(event)) {
      const state = getMortalKombatSimulationState(event, nowMs);
      if (!state?.isLive) return { live: false, specialLive: false, closing: false, confidence: 0.2 };
      const progress = clamp01(state.elapsedMs / Math.max(1, state.plan.durationMs));
      const winning = isMortalKombatBetWon(event, state.plan.winner, state.plan.flawlessVictory, state.plan.fatality, state.plan.victoryType);
      return { live: true, specialLive: true, closing: isCashoutClosing(event, nowMs), confidence: winning ? 0.22 + 0.78 * progress : 0.08 + 0.14 * (1 - progress) };
    }

    if (isPokerEvent(event)) {
      const state = getPokerSimulationState(event, nowMs);
      if (!state?.isLive) return { live: false, specialLive: false, closing: false, confidence: 0.2 };
      const progress = clamp01(state.elapsedMs / Math.max(1, state.plan.durationMs));
      const winning = isPokerBetWon(event);
      return { live: true, specialLive: true, closing: isCashoutClosing(event, nowMs), confidence: winning ? 0.22 + 0.78 * progress : 0.08 + 0.14 * (1 - progress) };
    }

    if (event.isLive || String(event.status || '').toLowerCase() === 'en direct') {
      return { live: true, specialLive: false, closing: false, confidence: 0.2 };
    }
    return { live: false, specialLive: false, closing: false, confidence: 0.35 };
  });

  const live = evaluations.some((evaluation) => evaluation.live);
  if (evaluations.length === 0) {
    return { isLive: false, hasSpecialLive: false, cashoutClosed: false, canSell: maximumAmount > 0, sellAmount: baseAmount, maximumAmount, confidence: 0 };
  }

  const confidence = Math.pow(evaluations.reduce((product, evaluation) => product * clamp01(evaluation.confidence), 1), 1 / evaluations.length);
  const smoothConfidence = confidence * confidence;
  const progressiveAmount = baseAmount + (maximumAmount - baseAmount) * smoothConfidence * 0.92;
  const hasSpecialLive = evaluations.some((evaluation) => evaluation.specialLive);
  const cashoutClosed = evaluations.some((evaluation) => evaluation.closing);

  return {
    isLive: live,
    hasSpecialLive,
    cashoutClosed,
    canSell: !cashoutClosed && maximumAmount > 0,
    sellAmount: cashoutClosed ? 0 : Math.min(maximumAmount, Math.max(0, Number(progressiveAmount.toFixed(2)))),
    maximumAmount,
    confidence,
  };
};
