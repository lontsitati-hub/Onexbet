import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLS, coresForRow, MULTIPLIERS, STORAGE_KEYS } from './game-logic';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useBetStore } from '@/store/useBetStore';

export { STORAGE_KEYS };

export const INITIAL_BALANCE = 100_000;
export const DAILY_BONUS = 10_000;
export const BET_OPTIONS = [200, 500, 1_000, 5_000] as const;
export { MULTIPLIERS };

export type HistoryEntry = {
  id: string;
  date: string;
  bet: number;
  result: "win" | "loss";
  levelReached: number; // 0..10 rows cleared
  cashoutMultiplier: number; // 0 if lost
  payout: number;
};

type GameState = {
  balance: number;
  history: HistoryEntry[];
  totalWagered: number;
  totalWon: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  bonusAvailable: boolean;
  /** Synchronously fresh balance (ref-backed) — safe to read right after addWager/addPayout. */
  freshBalance: number;
  setBet: (bet: number) => void;
  currentBet: number;
  canClaimBonus: boolean;
  claimDailyBonus: () => Promise<void>;
  addWager: (amount: number) => Promise<void>;
  addPayout: (amount: number) => Promise<void>;
  pushHistory: (entry: Omit<HistoryEntry, "id" | "date">) => Promise<void>;
  resetBalance: () => Promise<void>;
  toggleSound: () => void;
  toggleHaptics: () => void;
  bestStreak: number;
  bestWin: number;
  /** Predictor: predicted winning columns per row (row 0 = bottom, 0..9). */
  predictions: Record<number, number[]>;
  setPrediction: (row: number, col: number) => void;
  clearPredictions: () => Promise<void>;
  /** Prédictions verrouillées (après « Valider » dans Paramètres) :
   *  appliquées au prochain JOUER puis conservées pour les parties suivantes
   *  tant qu'elles ne sont pas effacées ou remplacées par une nouvelle
   *  validation. */
  validatedPredictions: Record<number, number[]>;
  commitPredictions: () => Promise<void>;
  clearValidatedPredictions: () => Promise<void>;
};

const GameContext = createContext<GameState | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const globalBalance = useBetStore((state) => state.balance);
  const updateGlobalBalance = useBetStore((state) => state.updateBalance);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [totalWagered, setTotalWagered] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  // The reference opens with a 500 F stake selected.
  const [currentBet, setCurrentBet] = useState<number>(500);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [predictions, setPredictions] = useState<Record<number, number[]>>({});
  const [validatedPredictions, setValidatedPredictions] = useState<Record<number, number[]>>({});
  // Mutable snapshot of the balance so consecutive start/finish calls always
  // see the freshly computed value (no async setState lag).
  const balanceRef = useRef<number>(globalBalance);
  const bonusClaimInProgress = useRef(false);
  const lastBonusDateRef = useRef<string | null>(null);

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const [
          hist,
          lastBonus,
          sound,
          hapt,
          tw,
          twn,
          predictions,
          validated,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.history),
          AsyncStorage.getItem(STORAGE_KEYS.lastBonus),
          AsyncStorage.getItem(STORAGE_KEYS.soundEnabled),
          AsyncStorage.getItem(STORAGE_KEYS.hapticsEnabled),
          AsyncStorage.getItem(STORAGE_KEYS.totalWagered),
          AsyncStorage.getItem(STORAGE_KEYS.totalWon),
          AsyncStorage.getItem(STORAGE_KEYS.predictions),
          AsyncStorage.getItem(STORAGE_KEYS.validatedPredictions),
        ]);
        lastBonusDateRef.current = lastBonus;
        if (hist !== null) setHistory(JSON.parse(hist));
        if (sound !== null) setSoundEnabled(sound === "1");
        if (hapt !== null) setHapticsEnabled(hapt === "1");
        if (tw !== null) setTotalWagered(parseInt(tw, 10));
        if (twn !== null) setTotalWon(parseInt(twn, 10));
        if (predictions !== null) setPredictions(JSON.parse(predictions));
        if (validated !== null) setValidatedPredictions(JSON.parse(validated));

        // Daily bonus: available if never claimed today
        const today = new Date().toISOString().slice(0, 10);
        setBonusAvailable(lastBonus !== today);
      } catch {
        // ignore, keep defaults
      }
    })();
  }, []);

  // Le portefeuille Apple of Fortune suit toujours le solde global du projet.
  useEffect(() => {
    balanceRef.current = globalBalance;
  }, [globalBalance]);

  const setBet = useCallback((bet: number) => setCurrentBet(bet), []);

  const canClaimBonus = bonusAvailable;

  const claimDailyBonus = useCallback(async () => {
    if (!bonusAvailable || bonusClaimInProgress.current) return;
    bonusClaimInProgress.current = true;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (lastBonusDateRef.current === today) {
        setBonusAvailable(false);
        return;
      }
      const nextBalance = balanceRef.current + DAILY_BONUS;
      await AsyncStorage.setItem(STORAGE_KEYS.lastBonus, today);
      balanceRef.current = nextBalance;
      lastBonusDateRef.current = today;
      updateGlobalBalance(nextBalance);
      setBonusAvailable(false);
    } catch (error) {
      console.warn('AOF: impossible de sauvegarder le bonus quotidien', error);
    } finally {
      bonusClaimInProgress.current = false;
    }
  }, [bonusAvailable, updateGlobalBalance]);

  const addWager = useCallback(async (amount: number) => {
    // Persist before debit: a storage rejection must not consume the stake.
    const nextWagered = totalWagered + amount;
    await AsyncStorage.setItem(STORAGE_KEYS.totalWagered, String(nextWagered));
    const current = balanceRef.current;
    balanceRef.current = current - amount;
    updateGlobalBalance(balanceRef.current);
    setTotalWagered(nextWagered);
  }, [totalWagered, updateGlobalBalance]);

  const addPayout = useCallback(async (amount: number) => {
    if (amount <= 0) return;
    balanceRef.current = balanceRef.current + amount;
    updateGlobalBalance(balanceRef.current);
    let nextWon = 0;
    setTotalWon((t) => {
      nextWon = t + amount;
      return nextWon;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.totalWon, String(nextWon));
  }, [updateGlobalBalance]);

  const pushHistory = useCallback(
    async (entry: Omit<HistoryEntry, "id" | "date">) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: new Date().toISOString(),
      };
      let nextHistory: HistoryEntry[] = [];
      setHistory((h) => {
        nextHistory = [newEntry, ...h].slice(0, 100);
        return nextHistory;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(nextHistory));
    },
    []
  );

  const resetBalance = useCallback(async () => {
    balanceRef.current = INITIAL_BALANCE;
    updateGlobalBalance(INITIAL_BALANCE);
    setTotalWagered(0);
    setTotalWon(0);
    setHistory([]);
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.history, "[]"],
      [STORAGE_KEYS.totalWagered, "0"],
      [STORAGE_KEYS.totalWon, "0"],
    ]);
  }, [updateGlobalBalance]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((s) => {
      AsyncStorage.setItem(STORAGE_KEYS.soundEnabled, s ? "0" : "1");
      return !s;
    });
  }, []);

  const toggleHaptics = useCallback(() => {
    setHapticsEnabled((s) => {
      AsyncStorage.setItem(STORAGE_KEYS.hapticsEnabled, s ? "0" : "1");
      return !s;
    });
  }, []);

  /** Toggle a predicted winning cell (row 0 = bottom). Stored persisted so the
   *  predictor grid survives app restarts.
   *  Predictor 100 % : au maximum COLS - coresForRow(row+1) prédictions par
   *  rangée (une case prédite = une pomme garantie). Au-delà, la case
   *  excédentaire est simplement ignorée. */
  /** Locks the current draft predictions: they are applied to the next round
   *  and kept for subsequent rounds until cleared or replaced. */
  const commitPredictions = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.validatedPredictions, JSON.stringify(predictions));
    setValidatedPredictions(predictions);
  }, [predictions]);

  const clearValidatedPredictions = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.validatedPredictions]);
    setValidatedPredictions({});
  }, []);

  const setPrediction = useCallback((row: number, col: number) => {
    setPredictions((prev) => {
      const cols = prev[row] ?? [];
      if (cols.includes(col)) {
        // Désélection : toujours autorisée
        const nextCols = cols.filter((c) => c !== col);
        const next: Record<number, number[]> = {};
        for (const k of Object.keys(prev)) {
          const v = prev[Number(k)];
          if (v && v.length > 0) next[Number(k)] = [...v];
        }
        if (nextCols.length > 0) next[row] = nextCols;
        AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(next));
        return next;
      }
      const maxSafe = COLS - coresForRow(row + 1);
      if (cols.length >= maxSafe) {
        // Limite atteinte pour cette rangée : la prédiction excédentaire est
        // ignorée (elle ne peut jamais devenir un trognon de toute façon).
        return prev;
      }
      const nextCols = [...cols, col];
      const next: Record<number, number[]> = {};
      for (const k of Object.keys(prev)) {
        const v = prev[Number(k)];
        if (v && v.length > 0) next[Number(k)] = [...v];
      }
      if (nextCols.length > 0) next[row] = nextCols;
      AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearPredictions = useCallback(async () => {
    setPredictions({});
    await AsyncStorage.multiRemove([STORAGE_KEYS.predictions, STORAGE_KEYS.validatedPredictions]);
    setValidatedPredictions({});
  }, []);

  const bestStreak = useMemo(
    () => history.reduce((m, e) => Math.max(m, e.levelReached), 0),
    [history]
  );
  const bestWin = useMemo(
    () => history.reduce((m, e) => Math.max(m, e.payout), 0),
    [history]
  );

  const value = useMemo<GameState>(
    () => ({
      balance: globalBalance,
      history,
      totalWagered,
      totalWon,
      soundEnabled,
      hapticsEnabled,
      bonusAvailable,
      setBet,
      currentBet,
      canClaimBonus,
      claimDailyBonus,
      addWager,
      addPayout,
      pushHistory,
      resetBalance,
      toggleSound,
      toggleHaptics,
      get freshBalance() {
        return balanceRef.current;
      },
      bestStreak,
      bestWin,
      predictions,
      setPrediction,
      clearPredictions,
      validatedPredictions,
      commitPredictions,
      clearValidatedPredictions,
    }),
    [
      globalBalance,
      history,
      totalWagered,
      totalWon,
      soundEnabled,
      hapticsEnabled,
      bonusAvailable,
      setBet,
      currentBet,
      canClaimBonus,
      claimDailyBonus,
      addWager,
      addPayout,
      pushHistory,
      resetBalance,
      toggleSound,
      toggleHaptics,
      bestStreak,
      bestWin,
      predictions,
      setPrediction,
      clearPredictions,
      validatedPredictions,
      commitPredictions,
      clearValidatedPredictions,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

/** Format a virtual amount as currency with decimals like the reference
 *  screenshots: "2 345.19 F" (two decimal places kept when the value has
 *  cents, otherwise a compact integer display is used for whole amounts). */
export function formatF(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + " ₣";
}

export function payoutForLevel(level: number, bet: number): number {
  if (level <= 0) return 0;
  const mult = MULTIPLIERS[level - 1] ?? MULTIPLIERS[MULTIPLIERS.length - 1];
  return Math.round(bet * mult);
}
