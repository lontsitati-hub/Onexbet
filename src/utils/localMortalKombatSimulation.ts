import { BetEvent, BetStatus } from '@/types/bet';

export const MORTAL_KOMBAT_DEFAULT_DURATION_MS = 3 * 60 * 1000;

type MortalRoundScore = { team1: number; team2: number };

export interface MortalKombatSimulationPlan {
  winner: 1 | 2;
  rounds: { team1: number; team2: number };
  roundScores: MortalRoundScore[];
  flawlessVictory: boolean;
  fatality: boolean;
  victoryType: 'Fatality' | 'Brutality' | 'No Finish' | 'Amitié';
  durationMs: number;
  seed: number;
}

export interface MortalKombatSimulationState {
  isScheduled: boolean;
  isLive: boolean;
  isFinished: boolean;
  elapsedMs: number;
  displayScore: string;
  liveTime: 'En direct' | 'Terminé' | 'À venir';
  currentRound: number;
  totalRounds: number;
  rounds: { team1: number; team2: number };
  roundScores: MortalRoundScore[];
  plan: MortalKombatSimulationPlan;
}

export interface MortalKombatCashoutState {
  isLive: boolean;
  sellAmount: number;
  maximumAmount: number;
}

const stableSeed = (event: BetEvent): number => {
  const source = `${event.id}:${event.team1}:${event.team2}:${event.tournament}`;
  return Array.from(source).reduce((sum, char, index) => (sum + char.charCodeAt(0) * (index + 19)) >>> 0, 0);
};

const isMortalKombat = (event: BetEvent) =>
  event.sport === 'Mortal Kombat' || /mortal\s+(kombat|combat)/i.test(event.tournament);

const normalized = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Résultat déterministe aligné sur l’option V1/V2 sélectionnée dans le coupon. */
export const getMortalKombatResultForSelectedBet = (event: BetEvent): { winner: 1 | 2; rounds: { team1: number; team2: number } } | null => {
  const bet = normalized(event.betType || '');
  if (/\bv1\b|equipe 1|combattant 1|joueur 1/.test(bet)) return { winner: 1, rounds: { team1: 2, team2: 0 } };
  if (/\bv2\b|equipe 2|combattant 2|joueur 2/.test(bet)) return { winner: 2, rounds: { team1: 0, team2: 2 } };
  return null;
};

const buildRoundScores = (winner: 1 | 2, rounds: { team1: number; team2: number }, seed: number): MortalRoundScore[] => {
  const totalRounds = rounds.team1 + rounds.team2;
  const scores: MortalRoundScore[] = [];
  let winnerRounds = winner === 1 ? rounds.team1 : rounds.team2;
  let loserRounds = winner === 1 ? rounds.team2 : rounds.team1;
  for (let index = 0; index < totalRounds; index += 1) {
    const winnerMustClose = winnerRounds > 0 && (winnerRounds >= totalRounds - index || loserRounds === 0);
    const winnerTakesRound = winnerMustClose || ((seed + index * 13) % 2 === 0 && winnerRounds > 0);
    if (winnerTakesRound) {
      scores.push(winner === 1 ? { team1: 1, team2: 0 } : { team1: 0, team2: 1 });
      winnerRounds -= 1;
    } else {
      scores.push(winner === 1 ? { team1: 0, team2: 1 } : { team1: 1, team2: 0 });
      loserRounds -= 1;
    }
  }
  return scores;
};

export const getMortalKombatStartMs = (event: BetEvent): number | null => {
  // L’horaire programmé est prioritaire : un passage prématuré à isLive
  // ne doit jamais lancer le combat avant l’heure définie lors de la création.
  const source = event.scheduledAt || event.liveStartedAt || event.date;
  if (!source) return null;
  const parsed = new Date(source).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const isMortalKombatStartDue = (event: BetEvent, nowMs = Date.now()): boolean => {
  const startMs = getMortalKombatStartMs(event);
  return startMs !== null && startMs <= nowMs;
};

export const createMortalKombatSimulationPlan = (event: BetEvent, durationMsOverride?: number): MortalKombatSimulationPlan => {
  const seed = stableSeed(event);
  const selectedResult = getMortalKombatResultForSelectedBet(event);
  const storedWinner = event.mortalKombatSimulation?.winner;
  const winner: 1 | 2 = selectedResult?.winner || (storedWinner === 1 || storedWinner === 2 ? storedWinner : (seed % 2 === 0 ? 1 : 2));
  const storedRounds = event.mortalKombatSimulation?.rounds;
  const rounds = selectedResult?.rounds || (storedRounds && (storedRounds.team1 === 2 || storedRounds.team2 === 2)
    ? storedRounds
    : winner === 1
      ? { team1: 2, team2: seed % 3 === 0 ? 1 : 0 }
      : { team1: seed % 3 === 0 ? 1 : 0, team2: 2 });
  const totalRounds = rounds.team1 + rounds.team2;
  const storedRoundScores = event.mortalKombatSimulation?.roundScores;
  const roundScores = storedRoundScores && storedRoundScores.length === totalRounds
    ? storedRoundScores
    : buildRoundScores(winner, rounds, seed);
  const flawlessVictory = seed % 4 === 0;
  const victoryTypes = ['Fatality', 'Brutality', 'No Finish', 'Amitié'] as const;
  const victoryType = victoryTypes[seed % victoryTypes.length];
  const durationMs = Number.isFinite(durationMsOverride) && (durationMsOverride || 0) > 0
    ? Math.max(1000, durationMsOverride as number)
    : MORTAL_KOMBAT_DEFAULT_DURATION_MS;
  return {
    winner,
    rounds,
    roundScores,
    flawlessVictory,
    fatality: victoryType === 'Fatality',
    victoryType,
    durationMs,
    seed,
  };
};

export const getMortalKombatSimulationState = (event: BetEvent, nowMs = Date.now()): MortalKombatSimulationState | null => {
  if (!isMortalKombat(event)) return null;
  const plan = createMortalKombatSimulationPlan(event, event.mortalKombatSimulation?.durationMs);
  const startMs = getMortalKombatStartMs(event);
  const totalRounds = plan.roundScores.length;
  if (startMs === null || !Number.isFinite(startMs)) {
    return { isScheduled: true, isLive: false, isFinished: false, elapsedMs: 0, displayScore: 'VS', liveTime: 'À venir', currentRound: 0, totalRounds, rounds: { team1: 0, team2: 0 }, roundScores: [], plan };
  }
  const elapsedMs = nowMs - startMs;
  if (elapsedMs < 0) {
    return { isScheduled: true, isLive: false, isFinished: false, elapsedMs: 0, displayScore: 'VS', liveTime: 'À venir', currentRound: 0, totalRounds, rounds: { team1: 0, team2: 0 }, roundScores: [], plan };
  }
  const isFinished = elapsedMs >= plan.durationMs;
  const safeElapsed = Math.min(elapsedMs, plan.durationMs);
  const completedRounds = isFinished ? totalRounds : Math.min(totalRounds, Math.floor((safeElapsed / plan.durationMs) * totalRounds));
  const roundScores = plan.roundScores.slice(0, completedRounds);
  const rounds = roundScores.reduce((result, score) => ({ team1: result.team1 + score.team1, team2: result.team2 + score.team2 }), { team1: 0, team2: 0 });
  return {
    isScheduled: false,
    isLive: !isFinished,
    isFinished,
    elapsedMs: safeElapsed,
    displayScore: `${rounds.team1} : ${rounds.team2}`,
    liveTime: isFinished ? 'Terminé' : 'En direct',
    currentRound: Math.min(totalRounds, completedRounds + 1),
    totalRounds,
    rounds: isFinished ? plan.rounds : rounds,
    roundScores: isFinished ? plan.roundScores : roundScores,
    plan,
  };
};

export const isMortalKombatBetWon = (event: BetEvent, winner: 1 | 2, flawlessVictory = false, fatality = false, victoryType?: MortalKombatSimulationPlan['victoryType']): boolean => {
  const bet = normalized(event.betType || '');
  if (bet.includes('flawless victory')) {
    const predictsYes = /\b(oui|yes)\b/.test(bet);
    const predictsNo = /\b(non|no)\b/.test(bet);
    return predictsYes ? flawlessVictory : predictsNo ? !flawlessVictory : false;
  }
  if (bet.includes('fatality') && /\b(oui|yes|non|no)\b/.test(bet)) {
    const predictsYes = /\b(oui|yes)\b/.test(bet);
    const predictsNo = /\b(non|no)\b/.test(bet);
    return predictsYes ? fatality : predictsNo ? !fatality : false;
  }
  if (bet.includes('type de victoire') || bet.includes('brutality') || bet.includes('no finish') || bet.includes('amitie')) {
    const selectedType = bet.includes('fatality') ? 'Fatality' : bet.includes('brutality') ? 'Brutality' : bet.includes('no finish') ? 'No Finish' : 'Amitié';
    return victoryType === selectedType;
  }
  if (/\bv1\b|equipe 1|combattant 1|joueur 1/.test(bet)) return winner === 1;
  if (/\bv2\b|equipe 2|combattant 2|joueur 2/.test(bet)) return winner === 2;
  return false;
};

export const getMortalKombatCashoutState = (slip: { stake: number; totalOdds: number; events?: BetEvent[] }, nowMs = Date.now()): MortalKombatCashoutState => {
  const events = (slip.events ?? []).filter(isMortalKombat);
  const maximumAmount = Math.max(0, Number((slip.stake * slip.totalOdds).toFixed(2)));
  if (events.length === 0) return { isLive: false, sellAmount: Math.min(maximumAmount, Math.max(0, slip.stake)), maximumAmount };
  const states = events.map((event) => getMortalKombatSimulationState(event, nowMs));
  const liveStates = states.filter((state): state is MortalKombatSimulationState => Boolean(state?.isLive));
  if (liveStates.length === 0) return { isLive: false, sellAmount: Math.min(maximumAmount, Math.max(0, slip.stake)), maximumAmount };
  const progress = liveStates.reduce((sum, state) => sum + state.elapsedMs / state.plan.durationMs, 0) / liveStates.length;
  const progressiveAmount = slip.stake * (1 + (slip.totalOdds - 1) * (0.35 + progress * 0.65));
  return { isLive: true, sellAmount: Math.min(maximumAmount, Math.max(0, Number(progressiveAmount.toFixed(2)))), maximumAmount };
};

export const isMortalKombatEvent = (event: BetEvent) => isMortalKombat(event);
