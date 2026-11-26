/** Types du jeu Crash (définitions locales — aucune dépendance serveur). */

export type GamePhase = "waiting" | "flying" | "crashed";

export interface Bet {
  id: string;
  playerId: string;
  playerName: string;
  avatarColor: string;
  amount: number;
  cashedAt: number | null; // multiplicateur au cashout
  autoCashoutAt: number | null;
  panelIndex: 0 | 1;
}

export interface CrashPoint {
  value: number;
  t: number;
}

export interface CrashSnapshot {
  phase: GamePhase;
  phaseStart: number;
  crashPoint: CrashPoint;
  history: number[];
  bets: Bet[];
  totalBet: number;
  totalWin: number;
  roundId: number;
  elapsedMs: number;
  /** Multiplicateur de crash forcé en attente (outil Historique), null si aléatoire */
  forceActive: number | null;
}

export interface GameEvent {
  type: "bet" | "cashout" | "crash";
  roundId: number;
  payload: {
    betId?: string;
    playerId?: string;
    playerName?: string;
    amount?: number;
    multiplier?: number;
    win?: number;
    crashPoint?: number;
  };
}

export interface MyBet {
  betId: string;
  amount: number;
  autoCashoutAt: number | null;
  status: "placed" | "flying" | "cashed" | "lost";
  cashedMultiplier: number | null;
  win: number | null;
}
