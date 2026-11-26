import { BetEvent, BetStatus } from '@/types/bet';

export const FIFA_SIMULATION_DURATION_MS = 10 * 60 * 1000;

export type FifaSimulationOption = 'exact' | 'v1' | 'v2' | 'draw' | 'any';

export interface FifaGoalEvent {
  atMs: number;
  team: 1 | 2;
}

export interface FifaSimulationPlan {
  option: FifaSimulationOption;
  finalScore: { home: number; away: number };
  goals: FifaGoalEvent[];
  durationMs: number;
}

export interface FifaSimulationState {
  isScheduled: boolean;
  isLive: boolean;
  isFinished: boolean;
  elapsedMs: number;
  displayScore: string;
  displayPeriod1: string;
  displayPeriod2: string;
  liveTime: string;
  /** Temps écoulé simulé, de 00:00 à 90:00 sur la durée réelle choisie. */
  displayMatchTime: string;
  status?: BetStatus;
}

type Score = { home: number; away: number };
type ParsedBet = { market: string; selection: string };

const normalizeText = (value: string): string => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’']/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const parseScore = (value?: string): Score | null => {
  const match = String(value || '').match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
};

const parseBet = (betType: string): ParsedBet => {
  const separator = betType.indexOf('.');
  if (separator < 0) return { market: '', selection: normalizeText(betType) };
  return {
    market: normalizeText(betType.slice(0, separator)),
    selection: normalizeText(betType.slice(separator + 1)),
  };
};

const isHalfFullMarket = (market: string): boolean => (
  market.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').includes('mt fin')
);

const stableSeed = (event: BetEvent): number => {
  const source = `${event.id}:${event.team1}:${event.team2}:${event.betType}:${event.score || ''}`;
  return Array.from(source).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 17), 0);
};

const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const optionFromBetType = (betType: string, score?: string): FifaSimulationOption => {
  const { market, selection } = parseBet(betType);
  if (market.includes('score exact')) return 'exact';
  if (market === '1x2') {
    if (selection === 'x' || selection.includes('nul') || selection.includes('egalite')) return 'draw';
    if (selection === 'v1' || selection === '1') return 'v1';
    if (selection === 'v2' || selection === '2') return 'v2';
  }
  if (market.includes('double chance')) {
    if (selection === '1x') return 'v1';
    if (selection === '2x' || selection === 'x2') return 'v2';
    if (selection === '12') return 'any';
  }
  if (market.includes('handicap')) {
    if (selection.includes('equipe 1')) return 'v1';
    if (selection.includes('equipe 2')) return 'v2';
  }
  if (isHalfFullMarket(market)) {
    const fullTime = selection.match(/^([12x])\s*\/\s*([12x])$/)?.[2];
    if (fullTime === '1') return 'v1';
    if (fullTime === '2') return 'v2';
    if (fullTime === 'x') return 'draw';
  }
  if (selection.includes('nul') || selection === 'x') return 'draw';
  if (/\bv1\b/.test(selection)) return 'v1';
  if (/\bv2\b/.test(selection)) return 'v2';
  if (!market && score) return 'exact';
  return 'any';
};

const matchOutcomeScore = (outcome: string, seed: number): Score => {
  if (outcome === '1') return { home: 1 + (seed % 3), away: 0 };
  if (outcome === '2') return { home: 0, away: 1 + (seed % 3) };
  const goals = seed % 3;
  return { home: goals, away: goals };
};

const parsePoint = (selection: string): number | null => {
  const match = selection.match(/\(?\s*(\d+(?:[.,]\d+)?)\s*\)?/);
  if (!match) return null;
  const point = Number(match[1].replace(',', '.'));
  return Number.isFinite(point) ? point : null;
};

const totalForSide = (selection: string): number | null => {
  const point = parsePoint(selection);
  if (point === null) return null;
  if (selection.includes('plus') || selection.includes('over')) return Math.floor(point) + 1;
  if (selection.includes('moins') || selection.includes('under')) return Math.max(0, Math.ceil(point) - 1);
  return null;
};

const scoreForHalfAndFullTime = (selection: string): { score: Score; halfTime: Score } | null => {
  const match = selection.match(/^([12x])\s*\/\s*([12x])$/);
  if (!match) return null;
  const halfOutcome = match[1];
  const fullOutcome = match[2];
  const halfTime = halfOutcome === '1' ? { home: 1, away: 0 }
    : halfOutcome === '2' ? { home: 0, away: 1 }
      : { home: 0, away: 0 };
  let score = { ...halfTime };

  if (fullOutcome === '1' && score.home <= score.away) score.home = score.away + 1;
  if (fullOutcome === '2' && score.away <= score.home) score.away = score.home + 1;
  if (fullOutcome === 'x') {
    const level = Math.max(score.home, score.away);
    score = { home: level, away: level };
  }
  return { score, halfTime };
};

const chooseScoreForSelection = (event: BetEvent, seed: number): { score: Score; halfTime?: Score } => {
  const { market, selection } = parseBet(event.betType || '');
  const fallback = { home: seed % 3, away: (seed >> 3) % 3 };

  if (market.includes('score exact')) {
    const selectedScore = parseScore(selection) || parseScore(event.score);
    if (selectedScore) return { score: selectedScore };
  }

  if (market === '1x2') {
    if (selection === 'x' || selection.includes('nul') || selection.includes('egalite')) {
      const goals = seed % 3;
      return { score: { home: goals, away: goals } };
    }
    if (selection === 'v1' || selection === '1') return { score: matchOutcomeScore('1', seed) };
    if (selection === 'v2' || selection === '2') return { score: matchOutcomeScore('2', seed) };
  }

  if (market.includes('double chance')) {
    if (selection === '1x') return { score: seed % 2 ? matchOutcomeScore('1', seed) : matchOutcomeScore('x', seed) };
    if (selection === '12') return { score: matchOutcomeScore('1', seed) };
    if (selection === '2x' || selection === 'x2') return { score: seed % 2 ? matchOutcomeScore('2', seed) : matchOutcomeScore('x', seed) };
  }

  if (market.includes('deux equipes') || market.includes('chaque equipe')) {
    if (selection.includes('oui')) return { score: { home: 1 + (seed % 3), away: 1 + ((seed >> 2) % 3) } };
    if (selection.includes('non')) return { score: seed % 2 ? { home: 1 + (seed % 3), away: 0 } : { home: 0, away: 1 + (seed % 3) } };
  }

  if (market.includes('handicap')) {
    const teamSide = selection.includes('equipe 1') ? 1 : selection.includes('equipe 2') ? 2 : 0;
    const handicapText = selection.match(/([+-])\s*(\d+(?:[.,]\d+)?)/);
    if (teamSide && handicapText) {
      const handicap = Number(`${handicapText[1]}${handicapText[2].replace(',', '.')}`);
      const requiredLead = handicap < 0 ? Math.floor(Math.abs(handicap)) + 1 : 1;
      return { score: teamSide === 1 ? { home: requiredLead, away: 0 } : { home: 0, away: requiredLead } };
    }
  }

  if (market.startsWith('total')) {
    const total = totalForSide(selection);
    if (total !== null) {
      if (market === 'total 1') return { score: { home: total, away: 0 } };
      if (market === 'total 2') return { score: { home: 0, away: total } };
      return { score: { home: Math.ceil(total / 2), away: Math.floor(total / 2) } };
    }
  }

  if (market.includes('prochain but')) {
    if (selection.includes('aucun but') || selection.includes('no goal')) return { score: { home: 0, away: 0 } };
    if (selection === '1') return { score: { home: 1, away: 0 } };
    if (selection === '2') return { score: { home: 0, away: 1 } };
  }

  if (isHalfFullMarket(market)) {
    const result = scoreForHalfAndFullTime(selection);
    if (result) return result;
  }

  // Repli conservé pour les anciens coupons FIFA et les sélections 1X2 historiques.
  const option = optionFromBetType(event.betType || '', event.score);
  if (option === 'exact') {
    const score = parseScore(event.score);
    if (score) return { score };
  }
  if (option === 'v1') return { score: matchOutcomeScore('1', seed) };
  if (option === 'v2') return { score: matchOutcomeScore('2', seed) };
  if (option === 'draw') return { score: matchOutcomeScore('x', seed) };
  return { score: fallback };
};

const shuffleTeams = (teams: Array<1 | 2>, seed: number): Array<1 | 2> => {
  const shuffled = [...teams];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.abs((seed + index * 17) % (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const scheduleHalf = (teams: Array<1 | 2>, startMs: number, durationMs: number): FifaGoalEvent[] => (
  teams.map((team, index) => ({
    atMs: Math.round(startMs + ((index + 1) / (teams.length + 1)) * durationMs),
    team,
  }))
);

const buildGoals = (home: number, away: number, seed: number, durationMs: number, halfTimeScore?: Score): FifaGoalEvent[] => {
  const halfDuration = durationMs / 2;
  if (halfTimeScore) {
    const firstHalfTeams = shuffleTeams([
      ...Array.from({ length: halfTimeScore.home }, () => 1 as const),
      ...Array.from({ length: halfTimeScore.away }, () => 2 as const),
    ], seed);
    const secondHalfTeams = shuffleTeams([
      ...Array.from({ length: home - halfTimeScore.home }, () => 1 as const),
      ...Array.from({ length: away - halfTimeScore.away }, () => 2 as const),
    ], seed + 31);
    return [
      ...scheduleHalf(firstHalfTeams, 0, halfDuration),
      ...scheduleHalf(secondHalfTeams, halfDuration, halfDuration),
    ];
  }

  const teams = shuffleTeams([
    ...Array.from({ length: home }, () => 1 as const),
    ...Array.from({ length: away }, () => 2 as const),
  ], seed);
  return teams.map((team, index) => ({
    atMs: Math.round(((index + 1) / (teams.length + 1)) * durationMs),
    team,
  }));
};

export const createFifaSimulationPlan = (event: BetEvent, durationMsOverride?: number): FifaSimulationPlan => {
  const seed = stableSeed(event);
  const selected = chooseScoreForSelection(event, seed);
  const score = {
    home: bounded(selected.score.home, 0, 99),
    away: bounded(selected.score.away, 0, 99),
  };
  const requestedDurationMs = durationMsOverride ?? event.fifaSimulation?.durationMs;
  const durationMs = Number.isFinite(requestedDurationMs) && (requestedDurationMs || 0) > 0
    ? Math.max(1000, requestedDurationMs as number)
    : FIFA_SIMULATION_DURATION_MS;

  return {
    option: optionFromBetType(event.betType || '', event.score),
    finalScore: score,
    goals: buildGoals(score.home, score.away, seed, durationMs, selected.halfTime),
    durationMs,
  };
};

const scoreAtHalfTime = (plan: FifaSimulationPlan): Score => {
  const firstHalf = plan.goals.filter((goal) => goal.atMs <= plan.durationMs / 2);
  return {
    home: firstHalf.filter((goal) => goal.team === 1).length,
    away: firstHalf.filter((goal) => goal.team === 2).length,
  };
};

const outcomeCode = (score: Score): '1' | 'x' | '2' => (
  score.home > score.away ? '1' : score.home < score.away ? '2' : 'x'
);

/** Valide le résultat simulé contre le libellé exact du marché sélectionné. */
export const isFifaSelectionWon = (event: BetEvent, plan = createFifaSimulationPlan(event)): boolean => {
  const { market, selection } = parseBet(event.betType || '');
  const { home, away } = plan.finalScore;

  if (market.includes('score exact')) {
    const selected = parseScore(selection) || parseScore(event.score);
    return selected ? selected.home === home && selected.away === away : false;
  }
  if (market === '1x2') {
    if (selection === 'x' || selection.includes('nul') || selection.includes('egalite')) return home === away;
    if (selection === 'v1' || selection === '1') return home > away;
    if (selection === 'v2' || selection === '2') return away > home;
  }
  if (market.includes('double chance')) {
    if (selection === '1x') return home >= away;
    if (selection === '12') return home !== away;
    if (selection === '2x' || selection === 'x2') return away >= home;
  }
  if (market.includes('deux equipes') || market.includes('chaque equipe')) {
    if (selection.includes('oui')) return home > 0 && away > 0;
    if (selection.includes('non')) return home === 0 || away === 0;
  }
  if (market.includes('handicap')) {
    const teamSide = selection.includes('equipe 1') ? 1 : selection.includes('equipe 2') ? 2 : 0;
    const handicapText = selection.match(/([+-])\s*(\d+(?:[.,]\d+)?)/);
    if (teamSide && handicapText) {
      const handicap = Number(`${handicapText[1]}${handicapText[2].replace(',', '.')}`);
      return teamSide === 1 ? home + handicap > away : away + handicap > home;
    }
  }
  if (market.startsWith('total')) {
    const target = totalForSide(selection);
    if (target !== null) {
      const actual = market === 'total 1' ? home : market === 'total 2' ? away : home + away;
      const point = parsePoint(selection);
      if (point === null) return false;
      return selection.includes('plus') || selection.includes('over') ? actual > point : actual < point;
    }
  }
  if (market.includes('prochain but')) {
    if (selection.includes('aucun but') || selection.includes('no goal')) return home === 0 && away === 0;
    const firstGoal = plan.goals[0]?.team;
    if (selection === '1') return firstGoal === 1;
    if (selection === '2') return firstGoal === 2;
  }
  if (isHalfFullMarket(market)) {
    const selectedOutcomes = selection.match(/^([12x])\s*\/\s*([12x])$/);
    if (selectedOutcomes) {
      const halfTime = scoreAtHalfTime(plan);
      return outcomeCode(halfTime) === selectedOutcomes[1] && outcomeCode(plan.finalScore) === selectedOutcomes[2];
    }
  }

  // Pour les anciens types de pari non issus du catalogue détaillé, garder la
  // règle 1X2 si elle est identifiable; les autres anciens libellés restent gagnants en mode démo.
  const option = optionFromBetType(event.betType || '', event.score);
  if (option === 'v1') return home > away;
  if (option === 'v2') return away > home;
  if (option === 'draw') return home === away;
  return true;
};

export const getWinningEventScores = (event: BetEvent): Pick<BetEvent, 'score' | 'scorePeriod1' | 'scorePeriod2'> => {
  const plan = createFifaSimulationPlan(event);
  const firstHalf = plan.goals.filter((goal) => goal.atMs <= plan.durationMs / 2);
  const secondHalf = plan.goals.filter((goal) => goal.atMs > plan.durationMs / 2);
  const score = `${plan.finalScore.home} - ${plan.finalScore.away}`;
  return {
    score,
    scorePeriod1: `${firstHalf.filter((goal) => goal.team === 1).length} - ${firstHalf.filter((goal) => goal.team === 2).length}`,
    scorePeriod2: `${secondHalf.filter((goal) => goal.team === 1).length} - ${secondHalf.filter((goal) => goal.team === 2).length}`,
  };
};

const parseMatchMinute = (value: string): number => {
  const match = value.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return Math.min(90, Number(match[1]) + Number(match[2]) / 60);
};

const formatMatchTime = (elapsedMatchSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.min(90 * 60, Math.floor(elapsedMatchSeconds)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const getFifaSimulationState = (
  event: BetEvent,
  nowMs: number = Date.now(),
): FifaSimulationState | null => {
  if (event.sport !== 'FIFA' && !event.tournament.trim().toUpperCase().startsWith('FIFA')) return null;
  if (!event.scheduledAt) return null;
  const startMs = new Date(event.scheduledAt).getTime();
  if (!Number.isFinite(startMs)) return null;
  const plan = createFifaSimulationPlan(event);
  const elapsedMs = nowMs - startMs;
  if (elapsedMs < 0) {
    return {
      isScheduled: true,
      isLive: false,
      isFinished: false,
      elapsedMs: 0,
      displayScore: '0 : 0',
      displayPeriod1: '0:0',
      displayPeriod2: '0:0',
      liveTime: 'À venir',
      displayMatchTime: '00:00',
    };
  }
  const finished = elapsedMs >= plan.durationMs;
  const safeElapsed = Math.min(elapsedMs, plan.durationMs);
  const simulatedMatchSeconds = Math.floor((safeElapsed / plan.durationMs) * (90 * 60));
  const visibleGoals = plan.goals.filter((goal) => goal.atMs <= safeElapsed);
  const home = visibleGoals.filter((goal) => goal.team === 1).length;
  const away = visibleGoals.filter((goal) => goal.team === 2).length;
  const halfTimeMs = plan.durationMs / 2;
  const firstHalfGoals = visibleGoals.filter((goal) => goal.atMs <= halfTimeMs);
  const secondHalfGoals = visibleGoals.filter((goal) => goal.atMs > halfTimeMs);
  const firstHome = firstHalfGoals.filter((goal) => goal.team === 1).length;
  const firstAway = firstHalfGoals.filter((goal) => goal.team === 2).length;
  const secondHome = secondHalfGoals.filter((goal) => goal.team === 1).length;
  const secondAway = secondHalfGoals.filter((goal) => goal.team === 2).length;
  return {
    isScheduled: false,
    isLive: !finished,
    isFinished: finished,
    elapsedMs: safeElapsed,
    displayScore: `${finished ? plan.finalScore.home : home} : ${finished ? plan.finalScore.away : away}`,
    displayPeriod1: `${firstHome}:${firstAway}`,
    displayPeriod2: `${secondHome}:${secondAway}`,
    liveTime: finished ? 'Terminé' : 'En direct',
    displayMatchTime: formatMatchTime(simulatedMatchSeconds),
    status: finished ? (isFifaSelectionWon(event, plan) ? 'Gagné' : 'Perdu') : undefined,
  };
};

export const useFifaSimulationTicker = () => undefined;
