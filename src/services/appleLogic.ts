// Apple of Fortune — logique de jeu (grille 10 rangées × 5 colonnes).
// Adapté du projet fourni par l'utilisateur.

export const MULTIPLIERS = [
  1.23, 1.54, 1.93, 2.41, 4.02, 6.71, 11.18, 27.97, 69.93, 349,
] as const;

export const ROWS = MULTIPLIERS.length; // 10
export const COLS = 5; // 5 cellules par rangée

/**
 * La difficulté monte au fil de l'ascension : plus de cœurs pourris
 * sur les rangées à gros multiplicateurs.
 * 1 cœur rangées ×1.23–×2.41 (niveaux 1–3),
 * 2 cœurs rangées ×4.02–×6.71 (niveaux 4–6),
 * 3 cœurs rangées ×11.18–×27.97 (niveaux 7–9),
 * 4 cœurs rangées ×69.93–×349 (niveaux 9–10).
 */
export function coresForRow(level: number): number {
  if (level <= 3) return 1;
  if (level <= 6) return 2;
  if (level <= 8) return 3;
  return 4;
}

export type CellState = 'hidden' | 'apple' | 'core';

export type Round = {
  /** Colonnes des cellules perdantes par rangée (rangée 0 = bas). */
  badCellsByRow: number[][];
  currentRow: number; // 0 = rangée du bas (première à jouer)
  revealed: Map<string, CellState>; // clé `${row}-${col}`
  started: boolean;
};

export function createRound(predictedWins?: Record<number, number[]>): Round {
  const badCellsByRow: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const count = coresForRow(r + 1);
    let pool = Array.from({ length: COLS }, (_, i) => i);
    const predicted = predictedWins?.[r];
    // Mode Predictor (v3) : si le joueur a déclaré des cases gagnantes pour
    // cette rangée, les trognons sont placés HORS de ces cases quand il y a
    // assez de colonnes libres ; sinon on retombe en placement aléatoire.
    if (predicted && Array.isArray(predicted)) {
      const safe = new Set(predicted.filter((c) => c >= 0 && c < COLS));
      const nonPredicted = pool.filter((c) => !safe.has(c));
      if (nonPredicted.length >= count) pool = nonPredicted;
    }
    const cols = [...pool];
    const bad: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * cols.length);
      bad.push(cols.splice(idx, 1)[0]);
    }
    badCellsByRow.push(bad);
  }
  return { badCellsByRow, currentRow: 0, revealed: new Map(), started: true };
}

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function isRowPlayable(round: Round, row: number): boolean {
  return round.started && row === round.currentRow;
}

export function revealResult(round: Round, row: number, col: number): {
  state: CellState;
  won: boolean;
} {
  const badCols = round.badCellsByRow[row];
  const state: CellState = badCols.includes(col) ? 'core' : 'apple';
  round.revealed.set(cellKey(row, col), state);
  const won = state === 'apple';
  if (won) round.currentRow += 1;
  return { state, won };
}

export function revealAll(round: Round): Map<string, CellState> {
  const full = new Map(round.revealed);
  for (let r = 0; r < ROWS; r++) {
    const badCols = round.badCellsByRow[r];
    for (let c = 0; c < COLS; c++) {
      const k = cellKey(r, c);
      if (!full.has(k)) full.set(k, badCols.includes(c) ? 'core' : 'apple');
    }
  }
  return full;
}

/** Multiplicateur appliqué en encaissant après `level` rangées franchies. */
export function multiplierAt(level: number): number {
  if (level <= 0) return 1;
  if (level > MULTIPLIERS.length) return MULTIPLIERS[MULTIPLIERS.length - 1];
  return MULTIPLIERS[level - 1];
}

export function payoutForLevel(level: number, bet: number): number {
  if (level <= 0) return 0;
  const mult = MULTIPLIERS[level - 1] ?? MULTIPLIERS[MULTIPLIERS.length - 1];
  return Math.round(bet * mult);
}

/** Étiquettes des multiplicateurs lisibles. */
export const MULT_STR: Record<number, string> = {
  1: '1.23',
  2: '1.54',
  3: '1.93',
  4: '2.41',
  5: '4.02',
  6: '6.71',
  7: '11.18',
  8: '27.97',
  9: '69.93',
  10: '349',
};
