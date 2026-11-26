/**
 * Moteur de jeu Crash — logique partagée (serveur + client).
 *
 * Règles :
 * - Courbe exponentielle : m(t) = e^(A * t) avec A = 0.06 (≈ +6%/s)
 * - Le point de crash est déterminé AVANT le tour (autoritaire serveur)
 * - ~3% des tours crashent instantanément à 1.00x (edge maison) → RTP ~97%
 * - La cote continue d'évoluer au-delà de 1000x
 */

export const CURVE_A = 0.06; // coefficient de croissance exponentielle (par seconde)
export const PHASE_WAITING_MS = 6000; // phase d'attente entre les tours
export const CRASH_SETTLE_MS = 2500; // temps d'affichage après crash avant retour en attente

export type GamePhase = "waiting" | "flying" | "crashed";

export interface CrashPoint {
  value: number; // multiplicateur de crash, ex. 2.41
  t: number; // temps (s) auquel le crash survient sur la courbe
}

/**
 * Génère un point de crash "Provably Fair"-style :
 * x = random [0,1) ; crash = (100 - edge) / (1 - x) ; ~edge % crashent à 1.00x
 */
export function generateCrashPoint(rand: () => number, edge = 0.03): CrashPoint {
  const x = rand();
  let value: number;
  if (x < edge) {
    value = 1.0;
  } else {
    value = Math.floor(((1 - edge) / (1 - x)) * 100) / 100;
    value = Math.max(1, value);
  }
  // t tel que e^(A*t) = value
  const t = Math.log(value) / CURVE_A;
  return { value, t };
}

/** Multiplicateur à l'instant t (s) sur la courbe exponentielle */
export function multiplierAt(t: number): number {
  return Math.exp(CURVE_A * t);
}

/** Formate un montant en XAF (1 000 000). */
export function fmt(v: number): string {
  return Math.round(v).toLocaleString('fr-FR');
}

/** Formate une cote : 1.23x */
export function formatMultiplier(v: number, digits = 2): string {
  return v.toFixed(digits) + "x";
}
