/**
 * Wild West Gold — logique de jeu pure (framework-agnostic).
 *
 * Grille de jeu type « Tour / Échelle » :
 * - Deux modes : 2x (2 colonnes) et 3x (3 colonnes)
 * - ROWS rangées, révélées du bas vers le haut
 * - Chaque case contient soit de l'OR (gain × multiplicateur) soit de la DYNAMITE (perte)
 * - Une seule case d'or par rangée, le reste est de la dynamite
 * - Le joueur peut encaisser après chaque case d'or trouvée
 */

export const ROWS = 6;

export type Mode = "2x" | "3x";

export type CellContent = "gold" | "dynamite";

export interface RowCells {
  cells: CellContent[]; // index de la case d'or par rangée
}

export type ModeConfig = {
  mode: Mode;
  cols: number;
  /** Facteur multiplicateur appliqué à chaque rangée franchie */
  multiplierPerRow: number;
};

// Comme dans la vidéo : chaque rangée gagnante multiplie exactement par 2 ou par 3.
export const MODE_CONFIG: Record<Mode, ModeConfig> = {
  "2x": { mode: "2x", cols: 2, multiplierPerRow: 2 },
  "3x": { mode: "3x", cols: 3, multiplierPerRow: 3 },
};

/**
 * Calcule le multiplicateur cumulé après `rowsCompleted` rangées gagnantes.
 */
export function cumulativeMultiplier(config: ModeConfig, rowsCompleted: number): number {
  if (rowsCompleted <= 0) return 0;
  return Math.pow(config.multiplierPerRow, rowsCompleted);
}

/**
 * Génère la grille aléatoire : une case d'or par rangée (le reste dynamite).
 * `randInt(max)` permet l'injection déterministe pour les tests.
 */
export function generateGrid(config: ModeConfig, randInt: (max: number) => number): RowCells[] {
  return Array.from({ length: ROWS }, () => {
    const goldCol = randInt(config.cols);
    return {
      cells: Array.from({ length: config.cols }, (_, i) =>
        i === goldCol ? "gold" : "dynamite",
      ),
    };
  });
}

/** Un tour complet pré-calculé pour garantir l'équité (commit-reveal léger). */
export interface GameRound {
  config: ModeConfig;
  grid: RowCells[];
  bet: number;
}

export function startRound(config: ModeConfig, bet: number, randInt: (max: number) => number): GameRound {
  return {
    config,
    grid: generateGrid(config, randInt),
    bet,
  };
}

export function formatXAF(amount: number): string {
  return `${Math.round(amount)} XAF`;
}

/**
 * Gains potentiels (mise × multiplicateur cumulé), arrondis à l'entier.
 */
export function potentialWin(bet: number, config: ModeConfig, rowsCompleted: number): number {
  return Math.round(bet * cumulativeMultiplier(config, rowsCompleted));
}

/** Règle Wild West Gold demandée : la mise n'est débitée qu'au clic sur la dynamite. */
export function balanceAfterDynamiteHit(balance: number, bet: number): number {
  return Math.max(0, Math.round((balance - bet) * 100) / 100);
}

/** Le cashout crédite le solde global partagé de l'application. */
export function balanceAfterCashout(balance: number, payout: number): number {
  return Math.round((balance + payout) * 100) / 100;
}
