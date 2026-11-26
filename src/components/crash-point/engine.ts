export const STARTING_BALANCE = 4_954_822.71;
export const DEFAULT_STAKE = 400;
export const MAX_PANELS = 4;
export const COUNTDOWN_MS = 8_000;
export const CRASH_PAUSE_MS = 2_200;
// Progression volontairement douce : l’utilisateur dispose d’une vraie fenêtre pour encaisser.
export const GROWTH_RATE = 0.08;
export const REFERENCE_CRASH_POINTS = [12.0, 3.22, 6.85, 1.04] as const;
export const START_HISTORY = [1.55, 1.44, 1.36, 2.55, 3.18];

export type Phase = 'waiting' | 'flying' | 'crashed';
export type BetStatus = 'pending' | 'queued' | 'live' | 'cashed' | 'lost';
export type GameTab = 'current' | 'mine' | 'top';

export interface Bet {
  amount: number;
  status: BetStatus;
  cashedAt: number | null;
  payout: number;
}

export interface BetSettings {
  autoPlay: boolean;
  autoCash: boolean;
  autoCashTarget: number;
}

export interface ToastMessage {
  text: string;
  kind: 'success' | 'error' | 'win';
  id: number;
}

export interface GameState {
  balance: number;
  phase: Phase;
  remainingMs: number;
  multiplier: number;
  crashPoint: number;
  roundNumber: number;
  phaseStartedAt: number;
  roundStartedAt: number;
  history: number[];
  bets: Array<Bet | null>;
  settings: BetSettings[];
  toast: ToastMessage | null;
  nextToastId: number;
  forcedCrashPoint: number | null;
}

export interface OpponentCashout {
  name: string;
  amount: number;
  target: number;
  payout: number;
}

export const OPPONENT_ROUNDS: OpponentCashout[][] = [
  [
    { name: '*******09', amount: 420, target: 1.2, payout: 504 },
    { name: '*******73', amount: 188.32, target: 1.25, payout: 235.4 },
    { name: '*******89', amount: 172.61, target: 1.31, payout: 226.12 },
    { name: '*******27', amount: 800, target: 1.75, payout: 1400 },
    { name: '*******53', amount: 6871.42, target: 2.48, payout: 17031.12 },
    { name: '*******23', amount: 2891.06, target: 4.23, payout: 12231.18 },
    { name: '*******51', amount: 795.28, target: 2, payout: 1590.56 },
    { name: '*******55', amount: 202.88, target: 4.02, payout: 815.58 },
    { name: '*******67', amount: 477.69, target: 2.1, payout: 1003.15 },
    { name: '*******57', amount: 1000, target: 1.814, payout: 1814 },
    { name: '*******11', amount: 401.48, target: 2.06, payout: 827.04 },
    { name: '*******65', amount: 1357.54, target: 2.1, payout: 2850.83 },
  ],
  [
    { name: '*******73', amount: 95.32, target: 1.42, payout: 135.35 },
    { name: '*******39', amount: 342.51, target: 1.67, payout: 572 },
  ],
  [
    { name: '*******11', amount: 250, target: 1.34, payout: 335.44 },
    { name: '*******27', amount: 800, target: 1.77, payout: 1416 },
    { name: '*******65', amount: 253.31, target: 2.46, payout: 623.14 },
    { name: '*******27', amount: 500, target: 2.1, payout: 1050.91 },
    { name: '*******55', amount: 342.21, target: 2.4, payout: 821.31 },
  ],
  [
    { name: '*******55', amount: 135.24, target: 1.35, payout: 182.58 },
    { name: '*******09', amount: 400, target: 1.39, payout: 556 },
    { name: '*******11', amount: 222.55, target: 1.45, payout: 322.7 },
    { name: '*******67', amount: 467.41, target: 1.55, payout: 724.49 },
    { name: '*******87', amount: 287.33, target: 1.85, payout: 531.56 },
    { name: '*******57', amount: 374, target: 2, payout: 748 },
  ],
];

const defaultSettings = (): BetSettings => ({ autoPlay: false, autoCash: false, autoCashTarget: 2 });

export function createInitialState(now = Date.now()): GameState {
  return {
    balance: STARTING_BALANCE,
    phase: 'waiting',
    remainingMs: COUNTDOWN_MS,
    multiplier: 1,
    crashPoint: 1,
    roundNumber: 0,
    phaseStartedAt: now,
    roundStartedAt: now,
    history: [...START_HISTORY],
    bets: [null, null],
    settings: [defaultSettings(), defaultSettings()],
    toast: null,
    nextToastId: 1,
    forcedCrashPoint: null,
  };
}

function hashSeed(text: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): number {
  let value = seed >>> 0;
  value += 0x6d2b79f5;
  let t = value;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

export function getCrashPoint(roundNumber: number, mode: 'reference' | 'random' = 'reference', seed = 'crash-demo-reference-v1'): number {
  if (mode === 'reference' && roundNumber <= REFERENCE_CRASH_POINTS.length) return REFERENCE_CRASH_POINTS[roundNumber - 1];
  const roundSeed = (hashSeed(seed) ^ Math.imul(roundNumber, 0x9e3779b9)) >>> 0;
  const random = Math.max(0.005, seededRandom(roundSeed));
  return Math.max(1.01, Math.min(100, Number((0.99 / Math.pow(random, 1.75)).toFixed(2))));
}

export function setForcedCrashPoint(state: GameState, target: number): GameState {
  if (!Number.isFinite(target) || target < 1 || target > 1000) return state;
  const normalized = Math.round(target * 100) / 100;
  // Même comportement qu'Aviator : pendant une manche en vol, la dernière
  // commande remplace immédiatement la cible actuelle. En attente ou après
  // un crash, elle est mémorisée pour le prochain tour.
  return state.phase === 'flying'
    ? { ...state, crashPoint: normalized, forcedCrashPoint: null }
    : { ...state, forcedCrashPoint: normalized };
}

export function placeBet(state: GameState, index: number, amount: number): GameState {
  if ((state.phase !== 'waiting' && state.phase !== 'crashed') || index < 0 || index >= state.bets.length) return state;
  const existing = state.bets[index];
  if (existing && !(state.phase === 'crashed' && (existing.status === 'lost' || existing.status === 'cashed'))) return state;
  const stake = Math.floor(amount);
  if (!Number.isFinite(stake) || stake < 1) return withToast(state, 'Saisissez une mise entière supérieure à 0 XAF.', 'error');
  if (stake > state.balance) return withToast(state, 'Solde fictif insuffisant pour cette mise.', 'error');
  const bets = [...state.bets];
  bets[index] = { amount: stake, status: state.phase === 'crashed' ? 'queued' : 'pending', cashedAt: null, payout: 0 };
  return withToast({ ...state, balance: roundXaf(state.balance - stake), bets }, 'Votre pari est accepté !', 'success');
}

export function cancelBet(state: GameState, index: number): GameState {
  const bet = state.bets[index];
  if ((state.phase !== 'waiting' && state.phase !== 'crashed') || !bet || (bet.status !== 'pending' && bet.status !== 'queued')) return state;
  const bets = [...state.bets];
  bets[index] = null;
  return withToast({ ...state, balance: roundXaf(state.balance + bet.amount), bets }, 'Votre pari a été annulé.', 'error');
}

export function cashOut(state: GameState, index: number): GameState {
  const bet = state.bets[index];
  if (state.phase !== 'flying' || !bet || bet.status !== 'live' || state.multiplier >= state.crashPoint) return state;
  const at = Math.floor(state.multiplier * 100 + 1e-9) / 100;
  const payout = roundXaf(bet.amount * at);
  const bets = [...state.bets];
  bets[index] = { ...bet, status: 'cashed', cashedAt: at, payout };
  const label = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(payout);
  return withToast({ ...state, balance: roundXaf(state.balance + payout), bets }, `Vous avez gagné ${label} XAF`, 'win');
}

export function updateSetting(state: GameState, index: number, patch: Partial<BetSettings>): GameState {
  if (!state.settings[index]) return state;
  const settings = [...state.settings];
  settings[index] = { ...settings[index], ...patch };
  return { ...state, settings };
}

export function addPanel(state: GameState): GameState {
  if (state.bets.length >= MAX_PANELS) return state;
  return { ...state, bets: [...state.bets, null], settings: [...state.settings, defaultSettings()] };
}

export function removePanel(state: GameState, index: number): GameState {
  if (state.bets.length <= 1 || index < 0 || index >= state.bets.length) return state;
  const bet = state.bets[index];
  if (bet && bet.status !== 'pending' && bet.status !== 'queued') return state;
  const bets = state.bets.filter((_, i) => i !== index);
  const settings = state.settings.filter((_, i) => i !== index);
  const refund = bet && (bet.status === 'pending' || bet.status === 'queued') ? bet.amount : 0;
  return { ...state, bets, settings, balance: roundXaf(state.balance + refund) };
}

export function tickGame(state: GameState, now: number, mode: 'reference' | 'random' = 'reference', seed = 'crash-demo-reference-v1'): GameState {
  if (state.phase === 'waiting') {
    let next = { ...state, remainingMs: Math.max(0, COUNTDOWN_MS - (now - state.phaseStartedAt)) };
    next.settings.forEach((setting, index) => {
      if (setting.autoPlay && !next.bets[index] && next.phase === 'waiting' && next.balance >= DEFAULT_STAKE) next = placeBet(next, index, DEFAULT_STAKE);
    });
    if (next.remainingMs > 0) return next;
    const roundNumber = next.roundNumber + 1;
    const crashPoint = next.forcedCrashPoint ?? getCrashPoint(roundNumber, mode, seed);
    return {
      ...next,
      phase: 'flying',
      remainingMs: 0,
      multiplier: 1,
      crashPoint,
      forcedCrashPoint: null,
      roundNumber,
      roundStartedAt: now,
      phaseStartedAt: now,
      bets: next.bets.map((bet) => bet && (bet.status === 'pending' || bet.status === 'queued') ? { ...bet, status: 'live' } : bet),
      toast: null,
    };
  }

  if (state.phase === 'flying') {
    const elapsed = Math.max(0, (now - state.roundStartedAt) / 1000);
    const multiplier = Number(Math.exp(elapsed * GROWTH_RATE).toFixed(2));
    if (multiplier >= state.crashPoint) {
      const bets = state.bets.map((bet) => bet?.status === 'live' ? { ...bet, status: 'lost' as const } : bet);
      const history = [state.crashPoint, ...state.history].slice(0, 40);
      const next = {
        ...state,
        phase: 'crashed' as const,
        multiplier: state.crashPoint,
        remainingMs: CRASH_PAUSE_MS,
        phaseStartedAt: now,
        bets,
        history,
      };
      return bets.some((bet) => bet?.status === 'lost') ? withToast(next, 'Vous aurez plus de chance la prochaine fois !', 'error') : next;
    }

    let next = { ...state, multiplier };
    state.settings.forEach((setting, index) => {
      const bet = next.bets[index];
      if (setting.autoCash && bet?.status === 'live' && multiplier >= setting.autoCashTarget) next = cashOut(next, index);
    });
    return next;
  }

  const remainingMs = Math.max(0, CRASH_PAUSE_MS - (now - state.phaseStartedAt));
  if (remainingMs > 0) return { ...state, remainingMs };
  return {
    ...state,
    phase: 'waiting',
    remainingMs: COUNTDOWN_MS,
    multiplier: 1,
    crashPoint: 1,
    phaseStartedAt: now,
    bets: state.bets.map((bet) => bet?.status === 'queued' ? { ...bet, status: 'pending' } : null),
    toast: null,
  };
}

export function resetGame(state: GameState, now = Date.now()): GameState {
  return withToast(createInitialState(now), 'Portefeuille réinitialisé.', 'success');
}

function withToast(state: GameState, text: string, kind: ToastMessage['kind']): GameState {
  return { ...state, toast: { text, kind, id: state.nextToastId }, nextToastId: state.nextToastId + 1 };
}

function roundXaf(value: number): number {
  return Math.round(value * 100) / 100;
}
