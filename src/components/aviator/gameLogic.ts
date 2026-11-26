/**
 * Logique core du jeu Aviator (prototype local, monnaie virtuelle).
 *
 * Mécanique :
 * - Chaque manche génère un multiplicateur de crash au moment de son ouverture.
 * - Distribution : crash = (1 - houseEdge) / (1 - r), avec r ∈ [0, 1[ pseudo-aléatoire.
 *   P(crash à 1.00) = 1 - houseEdge... en pratique on instaure ~1% de crashs
 *   instantanés pour un house edge ≈ 1% (comme les crash games classiques).
 * - En vol, le multiplicateur croît exponentiellement : m(t) = e^(k·t).
 */

export const HOUSE_EDGE = 0.01; // 1%
export const GROWTH_RATE = 0.12; // progression plus rapide, sans modifier les règles de crash
export const STARTUP_GROWTH_RATE = 0.15; // décollage plus vif
export const STARTUP_PHASE_SECONDS = 1.5; // transition courte vers la pente principale
export const MIN_CONTROLLED_CRASH = 1.0;
export const MAX_CONTROLLED_CRASH = 1000;

export interface CrashRange {
  min: number;
  max: number;
}

export type RoundState = "waiting" | "flying" | "crashed";

export interface Bet {
  amount: number; // en crédits, > 0
  cashedOutAt: number | null; // multiplicateur auquel l'utilisateur a encaissé
  active: boolean; // placé pour la prochaine manche / en cours
}

export interface RoundHistoryEntry {
  id: string;
  crashPoint: number;
  startedAt: number;
}

export interface SessionRecord {
  id: string;
  crashPoint: number;
  bets: { amount: number; cashedOutAt: number | null; payout: number }[];
  timestamp: number;
}

/** Pseudo-aléatoire déterministe pour un test unitaire (optionnel). */
export function randomUnit(): number {
  return Math.random();
}

/**
 * Calcule le multiplicateur de crash d'une manche.
 * r = 0 → crash infini (cas rarissime tronqué à MAX_CRASH).
 */
export function computeCrashPoint(r: number, maxCrash = 100): number {
  // Probabilité de crash instantané = house edge (1%)
  if (r < HOUSE_EDGE) return 1.0;
  const raw = (1 - HOUSE_EDGE) / (1 - r);
  const floored = Math.floor(raw * 100) / 100;
  return Math.min(Math.max(floored, 1.0), maxCrash);
}

/**
 * Tire uniformément une cote de crash dans une plage contrôlée.
 * Les valeurs sont arrondies au centième, comme les cotes affichées.
 */
export function computeCrashPointInRange(r: number, range: CrashRange): number {
  const min = Math.max(MIN_CONTROLLED_CRASH, Math.min(range.min, range.max));
  const max = Math.min(MAX_CONTROLLED_CRASH, Math.max(range.min, range.max));
  const random = Math.min(0.999999999, Math.max(0, Number.isFinite(r) ? r : 0));
  const cents = Math.floor(min * 100 + random * ((max - min) * 100 + 1));
  return Math.min(max, Math.max(min, cents / 100));
}

export function validateCrashRange(min: number, max: number): string | null {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "Intervalle invalide";
  if (min < MIN_CONTROLLED_CRASH) return `La cote minimale doit être au moins ${MIN_CONTROLLED_CRASH.toFixed(2)}×`;
  if (max > MAX_CONTROLLED_CRASH) return `La cote maximale ne peut pas dépasser ${MAX_CONTROLLED_CRASH.toLocaleString("fr-FR")}×`;
  if (max < min) return "La cote maximale doit être supérieure ou égale à la cote minimale";
  return null;
}

/** Multiplicateur affiché à l'instant t (secondes) depuis le décollage. */
export function multiplierAt(tSeconds: number): number {
  if (tSeconds <= 0) return 1.0;
  const startupSeconds = Math.min(tSeconds, STARTUP_PHASE_SECONDS);
  const mainSeconds = Math.max(0, tSeconds - STARTUP_PHASE_SECONDS);
  return Math.exp(STARTUP_GROWTH_RATE * startupSeconds + GROWTH_RATE * mainSeconds);
}
/** Temps (s) pour atteindre un multiplicateur cible. */
export function timeForMultiplier(target: number): number {
  if (target <= 1) return 0;
  const startupMultiplier = Math.exp(STARTUP_GROWTH_RATE * STARTUP_PHASE_SECONDS);
  if (target <= startupMultiplier) return Math.log(target) / STARTUP_GROWTH_RATE;
  return STARTUP_PHASE_SECONDS + Math.log(target / startupMultiplier) / GROWTH_RATE;
}


export const MIN_BET = 1;
export const STARTING_BALANCE = 1000;
export const WAITING_SECONDS = 5;

export function validateBetAmount(amount: number): string | null {
  if (!Number.isFinite(amount)) return "Montant invalide";
  if (amount < MIN_BET) return `Minimum ${MIN_BET} crédit`;
  return null;
}

export function formatMultiplier(m: number): string {
  return `${m.toFixed(2)}×`;
}

export function formatCredits(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

/** Couleur du jeton d'historique selon la valeur du crash — code couleur de la vidéo officielle : bleu <2.00x, violet 2–10x, rouge >10x. */
export function crashTokenColor(crash: number): "red" | "blue" | "pink" {
  if (crash >= 10) return "red";
  if (crash >= 2) return "pink";
  return "blue";
}
