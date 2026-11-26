import { BetEvent, BetSlip } from '@/types/bet';
import { createFifaSimulationPlan, getFifaSimulationState } from '@/utils/localFifaSimulation';

export const FIFA_CASHOUT_CUTOFF_MINUTE = 85;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const parseScore = (value: string): { home: number; away: number } => {
  const match = value.match(/(\d+)\s*[-:]\s*(\d+)/);
  return match ? { home: Number(match[1]), away: Number(match[2]) } : { home: 0, away: 0 };
};

const parseMatchMinute = (value: string): number => {
  const match = value.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return Math.min(90, Number(match[1]) + Number(match[2]) / 60);
};

const isFifaEvent = (event: BetEvent) => (
  event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA')
);

const getOptionProgress = (event: BetEvent, nowMs: number): { live: boolean; minute: number; progress: number } => {
  const simulation = getFifaSimulationState(event, nowMs);
  if (!simulation?.isLive) return { live: false, minute: simulation?.isFinished ? 90 : 0, progress: 0 };

  const minute = parseMatchMinute(simulation.displayMatchTime);
  const timeProgress = clamp01(minute / FIFA_CASHOUT_CUTOFF_MINUTE);
  const current = parseScore(simulation.displayScore);
  const plan = createFifaSimulationPlan(event);
  const target = plan.finalScore;
  const normalizedMarket = String(event.betType || '').toLowerCase();
  let optionProgress = 0;
  const bothTeamsScoreYes = (
    normalizedMarket.includes('les deux') || normalizedMarket.includes('chaque équipe')
  ) && normalizedMarket.includes('oui');

  if (plan.option === 'exact') {
    const overshot = current.home > target.home || current.away > target.away;
    const targetGoals = target.home + target.away;
    if (overshot) {
      optionProgress = 0;
    } else if (targetGoals === 0) {
      // Pour 0:0, la valeur augmente à mesure que le match reste sans but.
      optionProgress = current.home === 0 && current.away === 0 ? timeProgress : 0;
    } else {
      const remaining = Math.abs(target.home - current.home) + Math.abs(target.away - current.away);
      const closeness = clamp01(1 - remaining / targetGoals);
      optionProgress = clamp01(closeness * 0.9 + timeProgress * 0.1);
    }
  } else if (plan.option === 'v1') {
    const scoredProgress = target.home > 0 ? clamp01(current.home / target.home) : 0;
    const leadProgress = current.home > current.away ? 1 : 0;
    if (bothTeamsScoreYes) {
      const teamsThatScored = Number(current.home > 0) + Number(current.away > 0);
      optionProgress = clamp01(scoredProgress * 0.4 + (teamsThatScored / 2) * 0.4 + leadProgress * 0.15 + timeProgress * 0.05);
    } else {
      optionProgress = clamp01(scoredProgress * 0.65 + leadProgress * 0.3 + timeProgress * 0.05);
    }
  } else if (plan.option === 'v2') {
    const scoredProgress = target.away > 0 ? clamp01(current.away / target.away) : 0;
    const leadProgress = current.away > current.home ? 1 : 0;
    if (bothTeamsScoreYes) {
      const teamsThatScored = Number(current.home > 0) + Number(current.away > 0);
      optionProgress = clamp01(scoredProgress * 0.4 + (teamsThatScored / 2) * 0.4 + leadProgress * 0.15 + timeProgress * 0.05);
    } else {
      optionProgress = clamp01(scoredProgress * 0.65 + leadProgress * 0.3 + timeProgress * 0.05);
    }
  } else if (plan.option === 'draw') {
    const equalScoreProgress = current.home === current.away ? 1 : clamp01(1 - Math.abs(current.home - current.away) / 3);
    optionProgress = clamp01(equalScoreProgress * timeProgress);
  } else if (bothTeamsScoreYes) {
    const teamsThatScored = Number(current.home > 0) + Number(current.away > 0);
    optionProgress = clamp01((teamsThatScored / 2) * 0.9 + timeProgress * 0.1);
  } else {
    const targetGoals = target.home + target.away;
    const currentGoals = current.home + current.away;
    optionProgress = targetGoals > 0
      ? clamp01((currentGoals / targetGoals) * 0.9 + timeProgress * 0.1)
      : timeProgress;
  }

  return { live: true, minute, progress: optionProgress };
};

export interface FifaCashoutState {
  hasFifaEvents: boolean;
  isLive: boolean;
  cutoffReached: boolean;
  simulatedMinute: number;
  optionProgress: number;
  sellAmount: number;
}

export const getFifaCashoutState = (betSlip: BetSlip, nowMs: number = Date.now()): FifaCashoutState => {
  const fifaEvents = (betSlip.events ?? []).filter(isFifaEvent);
  const evaluations = fifaEvents.map((event) => getOptionProgress(event, nowMs));
  const liveEvaluations = evaluations.filter((evaluation) => evaluation.live);
  const simulatedMinute = liveEvaluations.length > 0
    ? Math.max(...liveEvaluations.map((evaluation) => evaluation.minute))
    : 0;
  const optionProgress = liveEvaluations.length > 0
    ? liveEvaluations.reduce((sum, evaluation) => sum + evaluation.progress, 0) / liveEvaluations.length
    : 0;
  const cutoffReached = simulatedMinute >= FIFA_CASHOUT_CUTOFF_MINUTE;

  const stake = Math.max(0, Number(betSlip.stake) || 0);
  const fallbackBase = stake * 0.75;
  const storedSellAmount = Number(betSlip.sellAmount);
  const configuredBase = Number.isFinite(storedSellAmount) && storedSellAmount > 0 && storedSellAmount < stake
    ? storedSellAmount
    : fallbackBase;
  // Le rachat ne doit jamais dépasser le retour potentiel du coupon : mise × cote.
  const totalOdds = Number(betSlip.totalOdds);
  const validTotalOdds = Number.isFinite(totalOdds) && totalOdds > 0 ? totalOdds : 0;
  const maximumSellAmount = Math.max(0, Number((stake * validTotalOdds).toFixed(2)));
  const baseSellAmount = Math.min(maximumSellAmount, Math.max(0, configuredBase));
  const progressiveAmount = Number(
    baseSellAmount + (maximumSellAmount - baseSellAmount) * clamp01(optionProgress) * 0.92
  ).toFixed(2);

  return {
    hasFifaEvents: fifaEvents.length > 0,
    isLive: liveEvaluations.length > 0,
    cutoffReached,
    simulatedMinute,
    optionProgress,
    sellAmount: Math.min(maximumSellAmount, Math.max(0, Number(progressiveAmount))),
  };
};
