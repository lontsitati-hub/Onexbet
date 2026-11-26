import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bet,
  HOUSE_EDGE,
  MIN_BET,
  SessionRecord,
  STARTING_BALANCE,
  WAITING_SECONDS,
  computeCrashPoint,
  multiplierAt,
} from "./gameLogic";

const STORAGE_KEY = "aviator:state:v1";

interface PersistedState {
  balance: number;
  sessions: SessionRecord[];
}

export type GamePhase =
  | { kind: "waiting"; remainingMs: number }
  | { kind: "flying"; startAt: number }
  | { kind: "crashed"; crashPoint: number; at: number };

export function useGame() {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [phase, setPhase] = useState<GamePhase>({
    kind: "waiting",
    remainingMs: WAITING_SECONDS * 1000,
  });
  const betsRef = useRef<(Bet | null)[]>([null, null]);
  const [bets, setBets] = useState<(Bet | null)[]>([null, null]);
  const crashPointRef = useRef(1);
  const controlledCrashRef = useRef<number | null>(null);
  const [controlledCrash, setControlledCrashState] = useState<number | null>(null);
  const setControlledCrash = useCallback((v: number | null) => {
    controlledCrashRef.current = v;
    setControlledCrashState(v);
  }, []);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;

  const crashHistory = useMemo(
    () => sessions.map((s) => s.crashPoint),
    [sessions]
  );

  // --- Persistance ---
  useEffect(() => {
    mountedRef.current = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const data = JSON.parse(raw) as PersistedState;
        if (typeof data.balance === "number") setBalance(data.balance);
        if (Array.isArray(data.sessions)) {
          setSessions(data.sessions.slice(0, 200));
        }
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ balance, sessions }))
      .catch(() => {});
  }, [balance, sessions]);

  // --- Boucle de jeu ---
  const startRound = useCallback(() => {
    const controlled = controlledCrashRef.current;
    if (controlled !== null) {
      crashPointRef.current = controlled;
      controlledCrashRef.current = null;
      setControlledCrashState(null);
    } else {
      crashPointRef.current = computeCrashPoint(Math.random());
    }
    setPhase({ kind: "flying", startAt: Date.now() });
  }, []);

  const endRound = useCallback(
    (crashPoint: number) => {
      const currentBets = betsRef.current;
      const record: SessionRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        crashPoint,
        timestamp: Date.now(),
        bets: currentBets
          .filter((b): b is Bet => b !== null && b.active)
          .map((b) => {
            // Le gain a déjà été crédité au solde lors de l'encaissement
            // (cashOut) : on ne crédite plus rien au crash pour éviter un
            // double crédit. On ne garde que le montant informatif.
            const payout =
              b.cashedOutAt !== null
                ? Math.round(b.amount * b.cashedOutAt * 100) / 100
                : 0;
            return { amount: b.amount, cashedOutAt: b.cashedOutAt, payout };
          }),
      };
      setSessions((prev) => [record, ...prev].slice(0, 200));
      betsRef.current = [null, null];
      setBets([null, null]);
      setPhase({ kind: "crashed", crashPoint, at: Date.now() });
    },
    []
  );

  // Machine d'état impérative : le tick décide la transition sur la base d'une
  // phaseRef fraîche, puis déclenche au maximum UN setPhase + les side effects
  // en dehors de tout updater — jamais de setState dans un updater de setState.
  useEffect(() => {
    const tick = () => {
      const prev = phaseRef.current;
      if (prev.kind === "waiting") {
        const next = prev.remainingMs - 100;
        if (next <= 0) {
          const controlled = controlledCrashRef.current;
          crashPointRef.current =
            controlled !== null
              ? controlled
              : computeCrashPoint(Math.random());
          if (controlled !== null) {
            controlledCrashRef.current = null;
            setControlledCrashState(null);
          }
          // Activer toutes les mises anticipées (placées pendant le vol ou le
          // crash précédent) au décollage — sinon une pending placée à moins
          // de ~3 s du décollage restait débitée sans jamais être jouée.
          const hadPending = pendingBetsRef.current.some((p) => p !== null);
          if (hadPending) {
            for (let i = 0; i < 2; i++) {
              const p = pendingBetsRef.current[i];
              if (p !== null) {
                betsRef.current[i] = { amount: p, cashedOutAt: null, active: true };
                pendingBetsRef.current[i] = null;
              }
            }
            setPendingBets([null, null]);
            setBets([...betsRef.current]);
          }
          setPhase({ kind: "flying", startAt: Date.now() });
          return;
        }
        setPhase({ ...prev, remainingMs: next });
        return;
      }
      if (prev.kind === "flying") {
        const elapsed = (Date.now() - prev.startAt) / 1000;
        const m = multiplierAt(elapsed);
        // Pas de plafonnement ici : le tick de crash doit suivre la vraie
        // courbe (l'affichage, lui, est plafonné à 20 s dans les useMemo).
        // Sans cela, un crash point tiré au-delà de multiplierAt(20) ne serait
        // jamais atteint et la manche resterait figée en vol.
        if (m >= crashPointRef.current) {
          const crashPoint = crashPointRef.current;
          const currentBets = betsRef.current;
          let payoutTotal = 0;
          const record: SessionRecord = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            crashPoint,
            timestamp: Date.now(),
            bets: currentBets
              .filter((b): b is Bet => b !== null && b.active)
              .map((b) => {
                // Le crédit du gain a déjà été effectué au moment de l'encaissement
                // (cashOut) : on ne crédite plus rien au crash pour éviter un double crédit.
                const payout =
                  b.cashedOutAt !== null
                    ? Math.round(b.amount * b.cashedOutAt * 100) / 100
                    : 0;
                return { amount: b.amount, cashedOutAt: b.cashedOutAt, payout };
              }),
          };
          setSessions((prevSessions) => [record, ...prevSessions].slice(0, 200));
          betsRef.current = [null, null];
          setBets([null, null]);
          setPhase({ kind: "crashed", crashPoint, at: Date.now() });
          return;
        }
        return; // pas de transition, le RAF RAF/tick gère l'affichage
      }
      if (prev.kind === "crashed") {
        if (Date.now() - prev.at >= 3000) {
          betsRef.current = [null, null];
          setBets([null, null]);
          // Les pendingBets restantes ne sont PAS reset : elles restent
          // remboursables (CANLABLE via le bouton EN ATTENTE) jusqu'à
          // leur activation au prochain décollage.
          setPhase({ kind: "waiting", remainingMs: WAITING_SECONDS * 1000 });
          return;
        }
      }
    };
    timerRef.current = setInterval(tick, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  // --- Actions joueur ---
  const placeBet = useCallback(
    (index: 0 | 1, amount: number): string | null => {
      const currentPhase = timerRef.current ? phase : phase; // avoid lint issue
      void currentPhase;
      if (phase.kind !== "waiting") {
        return "Attendez la prochaine manche";
      }
      if (amount < MIN_BET) return `Minimum ${MIN_BET} crédit`;
      if (amount > balance) return "Solde insuffisant";
      // Activer les mises anticipées placées pendant le vol / crash précédent
      for (let i = 0; i < 2; i++) {
        const p = pendingBetsRef.current[i];
        if (p !== null) {
          betsRef.current[i] = { amount: p, cashedOutAt: null, active: true };
          pendingBetsRef.current[i] = null;
        }
      }
      setBets([...betsRef.current]);
      setPendingBets([null, null]);
      const bet: Bet = { amount, cashedOutAt: null, active: true };
      betsRef.current[index] = bet;
      setBets([...betsRef.current]);
      setBalance((prev) => prev - amount);
      return null;
    },
    [phase, balance]
  );

  // Mise anticipée (comportement Aviator réel) : la mise peut être placée
  // pendant le vol ou après un crash ; elle est débite immédiatement et
  // s'active au démarrage de la manche suivante.
  const pendingBetsRef = useRef<(number | null)[]>([null, null]);
  const [pendingBets, setPendingBets] = useState<(number | null)[]>([null, null]);

  const placePendingBet = useCallback(
    (index: 0 | 1, amount: number): string | null => {
      if (amount < MIN_BET) return `Minimum ${MIN_BET} crédit`;
      if (amount > balance) return `Solde insuffisant`;
      if (betsRef.current[index] !== null) return "Mise déjà engagée";
      // Correction v32 — placement pendant le vol = mise immédiate de la
      // manche en cours (comme le vrai Aviator) : l'utilisateur peut
      // encaisser dès que la cote monte, le panneau montre CASH OUT orange.
      // Seule exception : le crash point est déjà dépassé (impossible à
      // encaisser), on diffère alors à la prochaine manche comme avant.
      const p = phaseRef.current;
      const isFlying = p.kind === "flying";
      const crashNotYet = isFlying && crashPointRef.current > 1.0;
      if (isFlying && crashNotYet) {
        betsRef.current[index] = { amount, cashedOutAt: null, active: true };
        setBets([...betsRef.current]);
        setBalance((prev) => prev - amount);
        return null;
      }
      pendingBetsRef.current[index] = amount;
      setPendingBets([...pendingBetsRef.current]);
      setBalance((prev) => prev - amount);
      return null;
    },
    [balance]
  );

  const cancelPendingBet = useCallback((index: 0 | 1) => {
    const amount = pendingBetsRef.current[index];
    if (amount === null) return;
    pendingBetsRef.current[index] = null;
    setPendingBets([...pendingBetsRef.current]);
    setBalance((prev) => Math.round((prev + amount) * 100) / 100);
  }, []);

  const cancelBet = useCallback((index: 0 | 1) => {
    if (phase.kind !== "waiting") return;
    const bet = betsRef.current[index];
    if (!bet) return;
    betsRef.current[index] = null;
    setBets([...betsRef.current]);
    setBalance((prev) => Math.round((prev + bet.amount) * 100) / 100);
  }, [phase]);

  const cashOut = useCallback(
    (index: 0 | 1): number | null => {
      const p = phase;
      if (p.kind !== "flying") return null;
      const bet = betsRef.current[index];
      if (!bet || bet.cashedOutAt !== null || !bet.active) return null;
      const elapsed = (Date.now() - p.startAt) / 1000;
      const m = multiplierAt(elapsed);
      if (m >= crashPointRef.current) return null; // trop tard, crash simultané
      bet.cashedOutAt = m;
      betsRef.current[index] = bet;
      setBets([...betsRef.current]);
      const payout = Math.round(bet.amount * m * 100) / 100;
      setBalance((prev) => Math.round((prev + payout) * 100) / 100);
      // Notification de gain fidèle à la vidéo : bulle verte ~3 s, cumulable
      pushWinNotification({ at: m, payout });
      return payout;
    },
    [phase]
  );

  // --- Notifications de gain (bulles vertes, ~3 s, empilables) ---
  const [winNotifications, setWinNotifications] = useState<Array<{ id: number; at: number; payout: number }>>([]);
  const notifSeq = useRef(0);

  const pushWinNotification = useCallback((n: { at: number; payout: number }) => {
    const id = ++notifSeq.current;
    setWinNotifications((prev) => [...prev.slice(-2), { ...n, id }]);
    setTimeout(() => {
      setWinNotifications((prev) => prev.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  const resetBalance = useCallback(() => {
    setBalance(STARTING_BALANCE);
    setSessions([]);
  }, []);

  const addBalance = useCallback((amount: number) => {
    if (amount <= 0) return;
    setBalance((prev) => Math.round((prev + amount) * 100) / 100);
  }, []);

  const isWaiting = phase.kind === "waiting";
  const isFlying = phase.kind === "flying";
  const isCrashed = phase.kind === "crashed";

  // Force re-render en vol pour rafraîchir l'affichage (~60 fps via RAF)
  const [tick, setTick] = useState(0);

  const flyingMultiplier = useMemo(() => {
    if (phase.kind !== "flying") return 1;
    // tick force le recalcul ~60 fps pendant le vol (useEffect RAF ci-dessous)
    void tick;
    const elapsed = (Date.now() - phase.startAt) / 1000;
    return multiplierAt(Math.min(elapsed, 86400));
  }, [phase, tick]);

  const liveMultiplier = useMemo(() => {
    if (phase.kind !== "flying") return null;
    void tick;
    const elapsed = (Date.now() - phase.startAt) / 1000;
    return multiplierAt(Math.min(elapsed, 86400));
  }, [phase, tick]);
  // Boucle infinie : RAF throttlé à 30 fps — le multiplicateur live se
  // rafraîchit en continu pendant TOUT le vol (même au-delà de 6×, 50×…)
  // sans saturer React : un throttle de 60 fps sur toute la page gelait le
  // rendu après quelques secondes de vol prolongé.
  useEffect(() => {
    if (phase.kind !== "flying") return;
    let running = true;
    let lastTickAt = 0;
    // Environnements sans RAF (Vitest/node) : fallback sur setTimeout.
    const raf =
      typeof globalThis.requestAnimationFrame === "function"
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16);
    const nowFn = () =>
      globalThis.performance?.now?.() ?? Date.now();
    const loop = () => {
      if (!running) return;
      const now = nowFn();
      if (now - lastTickAt >= 33) {
        lastTickAt = now;
        setTick((t) => t + 1);
      }
      rafRef.current = raf(loop);
    };
    rafRef.current = raf(loop);
    return () => {
      running = false;
      if (rafRef.current !== null) {
        if (typeof rafRef.current === 'number') {
          if (typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(rafRef.current);
          else globalThis.clearTimeout(rafRef.current);
        } else {
          globalThis.clearTimeout(rafRef.current);
        }
      }
    };
  }, [phase]);

  void HOUSE_EDGE; // keep import used
  return {
    balance,
    sessions,
    crashHistory,
    phase,
    bets,
    isWaiting,
    isFlying,
    isCrashed,
    liveMultiplier,
    flyingMultiplier,
    winNotifications,
    placeBet,
    cancelBet,
    cashOut,
    pendingBets,
    placePendingBet,
    cancelPendingBet,
    resetBalance,
    controlledCrash,
    setControlledCrash,
    addBalance,
  };
}
