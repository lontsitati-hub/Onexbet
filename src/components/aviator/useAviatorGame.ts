/**
 * Boucle de jeu Aviator (style officiel, 100 % locale) adaptée au projet oneXbet.
 *
 * Adaptations par rapport au projet fourni :
 * - Le solde provient du store global SQLite (useBetStore), pas d'AsyncStorage local :
 *   chaque débit/crédit appelle updateBalance() et se propage à toute l'app.
 * - L'historique des sessions reste en état local (affichage seulement).
 * - Le « contrôle de cote » (DepositMenu) est conservé : l'admin peut fixer
 *   le crash de la prochaine manche (comportement fidèle au jeu fourni).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Bet,
  MIN_BET,
  SessionRecord,
  WAITING_SECONDS,
  computeCrashPoint,
  multiplierAt,
} from '@/services/aviatorLogic';

export type AviatorPhase =
  | { kind: 'waiting'; remainingMs: number }
  | { kind: 'flying'; startAt: number }
  | { kind: 'crashed'; crashPoint: number; at: number };

interface AviatorGameOptions {
  /** Lit le solde courant immédiatement avant chaque écriture. */
  getBalance: () => number;
  /** Applique un changement de solde au store global SQLite */
  updateBalance: (next: number) => void;
}

export function useAviatorGame({ getBalance, updateBalance }: AviatorGameOptions) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [phase, setPhase] = useState<AviatorPhase>({
    kind: 'waiting',
    remainingMs: WAITING_SECONDS * 1000,
  });
  const phaseRef = useRef<AviatorPhase>(phase);
  const betsRef = useRef<(Bet | null)[]>([null, null]);
  const [bets, setBets] = useState<(Bet | null)[]>([null, null]);
  const crashPointRef = useRef(1);
  const controlledCrashRef = useRef<number | null>(null);
  const controlledCrashMaxRef = useRef<number | null>(null);
  // Nombre de manches restantes où l’intervalle contrôlé reste actif.
  // 0 = une seule prochaine manche ; -1 = illimité.
  const controlledCrashRoundsRef = useRef<number>(0);
  const [controlledCrash, setControlledCrashState] = useState<number | null>(null);
  const [controlledCrashMax, setControlledCrashMaxState] = useState<number | null>(null);
  const [controlledCrashRounds, setControlledCrashRoundsState] = useState<number>(0);
  const setControlledCrashInterval = useCallback((min: number | null, max?: number | null, rounds?: number, applyToCurrentRound = false) => {
    if (min === null) {
      controlledCrashRef.current = null;
      controlledCrashMaxRef.current = null;
      controlledCrashRoundsRef.current = 0;
      setControlledCrashState(null);
      setControlledCrashMaxState(null);
      setControlledCrashRoundsState(0);
      return;
    }
    const safeMin = Math.max(1.01, Math.min(100000, min));
    const safeMax = Math.max(safeMin, Math.min(100000, max ?? safeMin));
    if (applyToCurrentRound && phaseRef.current.kind === 'flying') {
      const span = safeMax - safeMin;
      crashPointRef.current = Math.round((safeMin + Math.random() * span) * 100) / 100;
      // La commande bot est consommée sur le vol en cours ; une nouvelle
      // commande reçue avant le crash remplacera directement cette valeur.
      controlledCrashRef.current = null;
      controlledCrashMaxRef.current = null;
      controlledCrashRoundsRef.current = 0;
      setControlledCrashState(null);
      setControlledCrashMaxState(null);
      setControlledCrashRoundsState(0);
      return;
    }
    controlledCrashRef.current = safeMin;
    controlledCrashMaxRef.current = safeMax;
    controlledCrashRoundsRef.current = rounds ?? 0;
    setControlledCrashState(safeMin);
    setControlledCrashMaxState(safeMax);
    setControlledCrashRoundsState(rounds ?? 0);
  }, []);
  const setControlledCrash = useCallback((v: number | null, rounds?: number) => {
    setControlledCrashInterval(v, v, rounds);
  }, [setControlledCrashInterval]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);
  // Mettre à jour le ref après chaque rendu (jamais pendant) pour éviter
  // l'erreur ESLint "Cannot access refs during render".
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const pendingBetsRef = useRef<(number | null)[]>([null, null]);
  const [pendingBets, setPendingBets] = useState<(number | null)[]>([null, null]);

  const addBalance = useCallback(
    (amount: number) => {
      if (amount <= 0) return;
      updateBalance(Math.round((getBalance() + amount) * 100) / 100);
    },
    [getBalance, updateBalance],
  );

  // --- Boucle de jeu continue (pause courte entre les manches) ---
  const startRound = useCallback(() => {
    const controlledMin = controlledCrashRef.current;
    const controlledMax = controlledCrashMaxRef.current ?? controlledMin;
    if (controlledMin !== null) {
      const span = Math.max(0, (controlledMax ?? controlledMin) - controlledMin);
      crashPointRef.current = Math.round((controlledMin + Math.random() * span) * 100) / 100;
      // Décompte exact des manches sur la cote contrôlée.
      const remaining = controlledCrashRoundsRef.current;
      if (remaining < 0) {
        // -1 reste actif sans limite.
      } else if (remaining <= 1) {
        // 0 représente une seule manche ; un nombre positif représente
        // exactement ce nombre de manches, y compris celle qui démarre ici.
        controlledCrashRef.current = null;
        controlledCrashMaxRef.current = null;
        controlledCrashRoundsRef.current = 0;
        setControlledCrashState(null);
        setControlledCrashMaxState(null);
        setControlledCrashRoundsState(0);
      } else {
        controlledCrashRoundsRef.current = remaining - 1;
        setControlledCrashRoundsState(remaining - 1);
      }
    } else {
      crashPointRef.current = computeCrashPoint(Math.random());
    }
    const nextPhase: AviatorPhase = { kind: 'flying', startAt: Date.now() };
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
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
      const nextPhase: AviatorPhase = { kind: 'crashed', crashPoint, at: Date.now() };
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
    },
    [],
  );

  useEffect(() => {
    const tick = () => {
      const prev = phaseRef.current;
      if (prev.kind === 'waiting') {
        const next = prev.remainingMs - 100;
        if (next <= 0) {
          startRound();
          return;
        }
        setPhase({ ...prev, remainingMs: next });
        return;
      }
      if (prev.kind === 'flying') {
        const elapsed = (Date.now() - prev.startAt) / 1000;
        const m = multiplierAt(elapsed);
        if (m >= crashPointRef.current) {
          endRound(crashPointRef.current);
          return;
        }
        return;
      }
      if (prev.kind === 'crashed') {
        // Le crash reste visible brièvement puis la manche suivante démarre
        // rapidement, sans longue coupure d'animation.
        if (Date.now() - prev.at >= 650) {
          betsRef.current = [null, null];
          setBets([null, null]);
          setPhase({ kind: 'waiting', remainingMs: WAITING_SECONDS * 1000 });
          return;
        }
      }
    };
    timerRef.current = setInterval(tick, 50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [startRound, endRound]);

  // --- Actions joueur ---
  const placeBet = useCallback(
    (index: 0 | 1, amount: number): string | null => {
      if (phase.kind !== 'waiting') {
        return 'Attendez la prochaine manche';
      }
      if (amount < MIN_BET) return `Minimum ${MIN_BET} XAF`;
      const currentBalance = getBalance();
      if (amount > currentBalance) return 'Solde insuffisant';
      if (betsRef.current[index] !== null || pendingBetsRef.current[index] !== null) {
        return 'Mise déjà engagée';
      }
      // Active les mises anticipées placées pendant le vol / crash précédent.
      // Elles ont DÉJÀ été débitées à la pose (placePendingBet) : on ne redébite pas.
      for (let i = 0; i < 2; i++) {
        const p = pendingBetsRef.current[i];
        if (p !== null) {
          betsRef.current[i] = { amount: p, cashedOutAt: null, active: true };
          pendingBetsRef.current[i] = null;
        }
      }
      const bet: Bet = { amount, cashedOutAt: null, active: true };
      betsRef.current[index] = bet;
      setBets([...betsRef.current]);
      setPendingBets([null, null]);
      updateBalance(Math.round((currentBalance - amount) * 100) / 100);
      return null;
    },
    [phase, getBalance, updateBalance],
  );

  // Correction v39 — placement pendant le vol = mise immédiate de la manche
  // en cours (comme le vrai Aviator) : l'utilisateur peut encaisser dès que la
  // cote monte, le panneau affiche CASH OUT orange. Seule exception : le crash
  // point est déjà dépassé (impossible à encaisser), on diffère alors à la
  // prochaine manche comme avant (mise anticipée remboursable).
  const placePendingBet = useCallback(
    (index: 0 | 1, amount: number): string | null => {
      if (amount < MIN_BET) return `Minimum ${MIN_BET} XAF`;
      const currentBalance = getBalance();
      if (amount > currentBalance) return 'Solde insuffisant';
      if (betsRef.current[index] !== null) return 'Mise déjà engagée';
      if (pendingBetsRef.current[index] !== null) return 'Mise anticipée déjà engagée';
      const p = phaseRef.current;
      const isFlying = p.kind === 'flying';
      const crashNotYet = isFlying && crashPointRef.current > 1.0;
      if (isFlying && crashNotYet) {
        betsRef.current[index] = { amount, cashedOutAt: null, active: true };
        setBets([...betsRef.current]);
        updateBalance(Math.round((currentBalance - amount) * 100) / 100);
        return null;
      }
      pendingBetsRef.current[index] = amount;
      setPendingBets([...pendingBetsRef.current]);
      updateBalance(Math.round((currentBalance - amount) * 100) / 100);
      return null;
    },
    [getBalance, updateBalance],
  );

  const cancelPendingBet = useCallback(
    (index: 0 | 1) => {
      const amount = pendingBetsRef.current[index];
      if (amount === null) return;
      pendingBetsRef.current[index] = null;
      setPendingBets([...pendingBetsRef.current]);
      updateBalance(Math.round((getBalance() + amount) * 100) / 100);
    },
    [getBalance, updateBalance],
  );

  const cancelBet = useCallback(
    (index: 0 | 1) => {
      if (phase.kind !== 'waiting') return;
      const bet = betsRef.current[index];
      if (!bet) return;
      betsRef.current[index] = null;
      setBets([...betsRef.current]);
      updateBalance(Math.round((getBalance() + bet.amount) * 100) / 100);
    },
    [phase, getBalance, updateBalance],
  );

  const [winNotifications, setWinNotifications] = useState<Array<{ id: number; at: number; payout: number }>>([]);
  const notifSeq = useRef(0);

  const pushWinNotification = useCallback((n: { at: number; payout: number }) => {
    const id = ++notifSeq.current;
    setWinNotifications((prev) => [...prev.slice(-2), { ...n, id }]);
    setTimeout(() => {
      setWinNotifications((prev) => prev.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  const cashOut = useCallback(
    (index: 0 | 1): number | null => {
      const p = phase;
      if (p.kind !== 'flying') return null;
      const bet = betsRef.current[index];
      if (!bet || bet.cashedOutAt !== null || !bet.active) return null;
      const elapsed = (Date.now() - p.startAt) / 1000;
      const m = multiplierAt(elapsed);
      if (m >= crashPointRef.current) return null;
      bet.cashedOutAt = m;
      betsRef.current[index] = bet;
      setBets([...betsRef.current]);
      const payout = Math.round(bet.amount * m * 100) / 100;
      updateBalance(Math.round((getBalance() + payout) * 100) / 100);
      pushWinNotification({ at: m, payout });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      return payout;
    },
    [phase, getBalance, updateBalance, pushWinNotification],
  );

  // --- Rafraîchissement du multiplicateur en vol (~30 fps) ---
  // liveMultiplier est un état mis à jour par la boucle RAF (Date.now() ne peut
  // pas vivre dans un useMemo : fonction impure pendant render).
  const [liveMultiplier, setLiveMultiplier] = useState<number | null>(null);

  useEffect(() => {
    if (phase.kind !== 'flying') {
      setLiveMultiplier(null);
      return;
    }
    let running = true;
    let lastTickAt = 0;
    const raf =
      typeof globalThis.requestAnimationFrame === 'function'
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16);
    const nowFn = () => globalThis.performance?.now?.() ?? Date.now();
    const loop = () => {
      if (!running) return;
      const now = nowFn();
      if (now - lastTickAt >= 33) {
        lastTickAt = now;
        const elapsed = (Date.now() - (phaseRef.current as Extract<AviatorPhase, { kind: 'flying' }>).startAt) / 1000;
        setLiveMultiplier(multiplierAt(Math.min(elapsed, 86400)));
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

  // Synchronisation immédiate au changement de phase (évite une frame d'écart
  // entre le setLiveMultiplier du RAF et le début du vol).
  useEffect(() => {
    if (phase.kind !== 'flying') return;
    const elapsed = (Date.now() - phase.startAt) / 1000;
    setLiveMultiplier(multiplierAt(Math.min(elapsed, 86400)));
  }, [phase]);

  return {
    sessions,
    phase,
    bets,
    pendingBets,
    liveMultiplier,
    winNotifications,
    controlledCrash,
    controlledCrashMax,
    controlledCrashRounds,
    setControlledCrash,
    setControlledCrashInterval,
    placeBet,
    cancelBet,
    cashOut,
    placePendingBet,
    cancelPendingBet,
    addBalance,
  };
}
