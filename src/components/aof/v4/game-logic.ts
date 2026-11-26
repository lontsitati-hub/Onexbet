export const STORAGE_KEYS = {
  balance: "aof.balance",
  history: "aof.history",
  lastBonus: "aof.lastBonus",
  soundEnabled: "aof.soundEnabled",
  hapticsEnabled: "aof.hapticsEnabled",
  totalWagered: "aof.totalWagered",
  totalWon: "aof.totalWon",
  predictions: "aof.predictions",
  validatedPredictions: "aof.validatedPredictions",
};

export const MULTIPLIERS = [
  1.23, 1.54, 1.93, 2.41, 4.02, 6.71, 11.18, 27.97, 69.93, 349.68,
] as const;

export const ROWS = MULTIPLIERS.length; // 10 étapes jouables
export const COLS = 5; // 5 cells per row

/** Difficulty ramps up as the player climbs: more rotten cores per row at higher multipliers.
 *  1 core on rows ×1.23–×2.41 (levels 1–3),
 *  2 cores on rows ×4.02–×6.71 (levels 4–6),
 *  3 cores on rows ×11.18–×69.93 (levels 7–9),
 *  4 cores on the final row ×349.68 (level 10).
 */
export function coresForRow(level: number): number {
  if (level <= 3) return 1;
  if (level <= 6) return 2;
  if (level <= 9) return 3;
  return 4;
}

export type CellState = "hidden" | "apple" | "core";

export type Round = {
  /** Bad cell columns per row (row 0 = bottom): round.badCellsByRow[r] = array of core column indices. */
  badCellsByRow: number[][];
  currentRow: number; // 0 = bottom (first row to play)
  revealed: Map<string, CellState>; // key `${row}-${col}`
  started: boolean;
};

/** Create a round. In predictor mode, every declared cell is guaranteed safe.
 * If all cells of a row are validated, that row contains no real rotten cell:
 * this is intentional for the 100 % predictor setting. */
export function createRound(predictedWins?: Record<number, number[]>): Round {
  const badCellsByRow: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const requestedBadCount = coresForRow(r + 1);
    const pool = Array.from({ length: COLS }, (_, i) => i);
    const predicted = predictedWins?.[r];
    let badPool = pool;
    let badCount = requestedBadCount;
    if (predicted && Array.isArray(predicted)) {
      const safe = new Set(predicted.filter((c) => c >= 0 && c < COLS));
      badPool = pool.filter((c) => !safe.has(c));
      // Never place a rotten cell in a validated cell. If all cells are
      // validated, the row is fully safe; if only a few remain, reduce the
      // number of rotten cells to the available unvalidated cells.
      badCount = Math.min(requestedBadCount, badPool.length);
    } else {
      // Without predictions, preserve the normal difficulty progression.
      badPool = pool;
    }
    const cols = [...badPool];
    const bad: number[] = [];
    for (let i = 0; i < badCount; i++) {
      const idx = Math.floor(Math.random() * cols.length);
      bad.push(cols.splice(idx, 1)[0]);
    }
    badCellsByRow.push(bad);
  }
  return {
    badCellsByRow,
    currentRow: 0,
    revealed: new Map(),
    started: true,
  };
}

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

/** Row indexing: row 0 is the bottom (first row played), displayed bottom-up. */
export function isRowPlayable(round: Round, row: number): boolean {
  return round.started && row === round.currentRow;
}

export function revealResult(round: Round, row: number, col: number): {
  state: CellState;
  won: boolean;
} {
  const badCols = round.badCellsByRow[row];
  const state: CellState = badCols.includes(col) ? "core" : "apple";
  round.revealed.set(cellKey(row, col), state);
  const won = state === "apple";
  if (won) {
    round.currentRow += 1;
  }
  return { state, won };
}

/**
 * Mode simulation Bot Apple : déplace les trognons de la rangée active afin
 * que la case envoyée par le bot soit gagnante avant sa révélation.
 * Le nombre de trognons reste inchangé lorsque cela est possible.
 */
export function forceSafeCell(round: Round, row: number, col: number): boolean {
  if (!round.started || row !== round.currentRow || row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return false;
  }

  const bad = round.badCellsByRow[row] ?? [];
  if (!bad.includes(col)) return true;

  const replacement = Array.from({ length: COLS }, (_, candidate) => candidate)
    .find((candidate) => candidate !== col && !bad.includes(candidate));
  if (replacement === undefined) return false;

  round.badCellsByRow[row] = bad.map((candidate) => candidate === col ? replacement : candidate);
  return true;
}

/** Reveal all hidden cells at end of round (for the end-game sheet). */
export function revealAll(round: Round): Map<string, CellState> {
  const full = new Map(round.revealed);
  for (let r = 0; r < ROWS; r++) {
    const badCols = round.badCellsByRow[r];
    for (let c = 0; c < COLS; c++) {
      const k = cellKey(r, c);
      if (!full.has(k)) full.set(k, badCols.includes(c) ? "core" : "apple");
    }
  }
  return full;
}

/**
 * Creates the visual end-of-round illusion independently from the real round.
 * It is intentionally regenerated on every call, so two winning rounds do not
 * show the same rotten-cell pattern. Touched cells are copied first and are
 * always preserved; a rotten cell is never placed over a touched cell.
 * This map must never be used by gameplay.
 */
export function createIllusionReveal(touched?: Map<string, CellState>): Map<string, CellState> {
  const illusion = new Map<string, CellState>();
  for (const [key, state] of touched ?? []) {
    // A touched cell keeps what the player actually saw; in a winning round
    // this is an apple and it must remain an apple in the visual reveal.
    illusion.set(key, state);
  }
  for (let r = 0; r < ROWS; r++) {
    const count = coresForRow(r + 1);
    const untouchedCols = Array.from({ length: COLS }, (_, i) => i).filter(
      (c) => !illusion.has(cellKey(r, c))
    );
    const cols = [...untouchedCols];
    const illusionCoreCount = Math.min(count, cols.length);
    for (let i = 0; i < illusionCoreCount; i++) {
      const idx = Math.floor(Math.random() * cols.length);
      const coreCol = cols.splice(idx, 1)[0];
      illusion.set(cellKey(r, coreCol), "core");
    }
    for (let c = 0; c < COLS; c++) {
      const k = cellKey(r, c);
      if (!illusion.has(k)) illusion.set(k, "apple");
    }
  }
  return illusion;
}

export function multiplierAt(level: number): number {
  // level = number of rows cleared so far; multiplier to apply on next reveal
  if (level <= 0) return 1;
  if (level > MULTIPLIERS.length) return MULTIPLIERS[MULTIPLIERS.length - 1];
  return MULTIPLIERS[level - 1];
}

/** Survival probability per row: (COLS - cores) / COLS. */
export function rowSuccessProbability(level: number): number {
  return (COLS - coresForRow(level)) / COLS;
}

/** Expected value check: probability of surviving `level` rows. */
export function expectedMultiplierAtLevel(level: number): number {
  let p = 1;
  for (let l = 1; l <= level; l++) {
    p *= rowSuccessProbability(l);
  }
  return p; // probability of surviving `level` rows
}
