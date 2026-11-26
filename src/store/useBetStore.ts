import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  deleteCouponById,
  getAllCoupons,
  getCompteInfo,
  getCouponByCodeOrId,
  getCouponById,
  initDatabase,
  insertCoupon,
  claimCouponGain,
  markCouponAsPaid,
  updateCompteBalance,
  updateCompteTheme,
  updateCouponEventsJson,
  updateCouponComplete,
  updateCouponSellAmount,
  updateCouponStatus,
} from '../services/db';
import { BetEvent, BetSlip, BetStatus } from '../types/bet';
import { BackgroundMode } from '../constants/theme';
import { generateTicketNumber, isValidCouponCode } from '../services/couponCode';
import { loadSharedCoupon } from '../services/sharedCoupons';
import { getFifaSimulationState, getWinningEventScores, isFifaSelectionWon } from '@/utils/localFifaSimulation';
import { getMortalKombatResultForSelectedBet, getMortalKombatSimulationState, isMortalKombatBetWon, isMortalKombatEvent, MORTAL_KOMBAT_DEFAULT_DURATION_MS } from '@/utils/localMortalKombatSimulation';
import { getPokerSimulationState, isPokerBetWon, isPokerEvent } from '@/utils/localPokerSimulation';

const isDraftEventLive = (event: BetEvent): boolean => {
  const status = String(event.status || '').trim().toLowerCase();
  const liveTime = String(event.liveTime || '').trim().toLowerCase();
  return Boolean(event.isLive)
    || status === 'en direct'
    || Boolean(liveTime && liveTime !== 'terminé');
};

/** Historique des parties Apple of Fortune v3 (persistance AsyncStorage). */
export type AofHistoryEntry = {
  id: string;
  date: string;
  bet: number;
  result: 'win' | 'loss';
  levelReached: number; // rangées franchies (0..10)
  cashoutMultiplier: number; // 0 si perte
  payout: number;
};

const AOF_STORAGE_KEYS = {
  soundEnabled: 'onexbet:aof.soundEnabled:v3',
  hapticsEnabled: 'onexbet:aof.hapticsEnabled:v3',
  predictions: 'onexbet:aof.predictions:v3',
  history: 'onexbet:aof.history:v3',
};

async function loadAofBool(key: string, fallback: boolean): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

async function loadAofObject<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

// Database and store initialization will be deferred and performed explicitly after verification.

export interface BetHistoryItem {
  id: string;
  type: string;
  date: string;
  eventCount: number;
  totalOdds: number;
  stake: number;
  potentialGain: number;
  status: BetStatus;
  events?: BetEvent[];
  sellAmount?: number;
  code?: string;
}

export type PlaceBetResult = { success: true; coupon: BetHistoryItem } | { success: false; error: string };

export type UserListItem = {
  id: string | number;
  username: string;
  role: string;
  status: string;
  uid?: string;
  subscriptionStartedAt?: unknown;
  subscriptionDurationDays?: number;
};

interface BetState {
  currentBetSlip: BetSlip;
  betHistory: BetHistoryItem[];
  /** Vrai après la première lecture complète du stockage local. */
  isHydrated: boolean;
  balance: number;
  isLoading: boolean;
  sessionId: string;
  activeTab: 'historique' | 'coupon' | 'menu' | 'populaire' | 'favoris';
  setActiveTab: (tab: 'historique' | 'coupon' | 'menu' | 'populaire' | 'favoris') => void;
  selectedHistoryId: string | null;
  setSelectedHistoryId: (id: string | null) => void;
  selectedEvent: BetEvent | null;
  setSelectedEvent: (event: BetEvent | null) => void;
  showMatchDetails: boolean;
  setShowMatchDetails: (show: boolean) => void;
  setSessionId: (id: string) => void;
  duplicateCoupon: (slip: any) => void;
  updateStake: (newStake: number) => void;
  setBetStatus: (status: BetStatus) => void;
  addBetHistoryItem: (item: BetHistoryItem) => void;
  addEventToSlip: (event: BetEvent) => void;
  upsertEventToSlip: (event: BetEvent) => void;
  placeBet: (stake: number, sourceSlip?: BetSlip) => PlaceBetResult;
  updateBalance: (amount: number) => boolean;
  setBetSlip: (slip: BetSlip) => void;
  clearCurrentDraftCoupon: () => void;
  loadBetSlipFromDb: (id: string) => Promise<void>;
  deleteBetHistoryItem: (id: string) => void;
  payCoupon: (id: string, updatedEvents?: BetEvent[]) => void;
  loadFromDb: () => void;
  updateCouponSellAmount: (id: string, amount: number) => void;
  updateCouponComplete: (id: string, patch: { date: string; eventCount: number; totalOdds: number; stake: number; potentialGain: number; status: BetStatus; events: BetEvent[] }) => void;
  updateCouponGlobalStatus: (id: string, status: BetStatus) => void;
  autoSettleFifaCoupon: (id: string, nowMs?: number) => void;
  autoSettleMortalKombatCoupon: (id: string, nowMs?: number) => void;
  autoSettlePokerCoupon: (id: string, nowMs?: number) => void;
  autoSettleCoupon: (id: string, nowMs?: number) => void;
  updateEventStatus: (couponId: string, eventId: string, status: BetStatus) => void;
  toggleEventLive: (couponId: string, eventId: string, isLive?: boolean, liveTime?: string) => void;
  theme: 'blue' | 'royal_blue' | 'green' | 'gold' | 'light_green' | 'red_mega';
  setTheme: (theme: 'blue' | 'royal_blue' | 'green' | 'gold' | 'light_green' | 'red_mega') => void;
  backgroundMode: BackgroundMode;
  setBackgroundMode: (mode: BackgroundMode) => void;
  backgroundOpacity: number;
  setBackgroundOpacity: (opacity: number) => void;
  sessionUser: string | null;
  sessionRole: string | null;
  isUnlocked: boolean;
  setSessionUser: (user: string | null, role: string | null) => void;
  setIsUnlocked: (val: boolean) => void;
  usersList: UserListItem[];
  setUsersList: (users: UserListItem[]) => void;
  addUser: (username: string, role: string) => boolean;
  updateUserStatus: (id: string | number, status: string) => void;
  deleteUser: (id: string | number) => void;
  // ── Apple of Fortune v3 : préférences et mode Predictor (persistés AsyncStorage) ──
  aofSoundEnabled: boolean;
  aofHapticsEnabled: boolean;
  aofPredictions: Record<number, number[]>;
  aofHistory: AofHistoryEntry[];
  setAofSoundEnabled: (enabled: boolean) => void;
  setAofHapticsEnabled: (enabled: boolean) => void;
  setAofPrediction: (row: number, col: number) => void;
  clearAofPredictions: () => void;
  pushAofHistory: (entry: Omit<AofHistoryEntry, 'id' | 'date'>) => void;
  clearAofHistory: () => void;
}

const initialBetSlip: BetSlip = {
  id: '',
  type: 'Combiné',
  date: '',
  eventCount: 0,
  finishedCount: 0,
  totalOdds: 1.0,
  stake: 0,
  potentialGain: 0,
  status: 'Accepté',
  events: [],
  sellAmount: 0.0
};

export const useBetStore = create<BetState>((set, get) => ({
  currentBetSlip: initialBetSlip,
  betHistory: [],
  isHydrated: false,
  balance: 15000.0,
  sessionId: 'Session-None',
  isLoading: false,
  activeTab: 'populaire',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedHistoryId: null,
  setSelectedHistoryId: (id) => set({ selectedHistoryId: id }),
  selectedEvent: null,
  setSelectedEvent: (event) => set({ selectedEvent: event }),
  showMatchDetails: false,
  setShowMatchDetails: (show) => set({ showMatchDetails: show }),
  setSessionId: (id) => set({ sessionId: id }),
  theme: 'blue',
  setTheme: (theme) => {
    updateCompteTheme(theme);
    set({ theme });
  },
  backgroundMode: 'light',
  backgroundOpacity: 1,
  setBackgroundMode: (mode) => {
    void AsyncStorage.setItem('onexbet:background-mode:v1', mode);
    set({ backgroundMode: mode });
  },
  setBackgroundOpacity: (opacity) => {
    const normalized = Math.max(0.35, Math.min(1, opacity));
    void AsyncStorage.setItem('onexbet:background-opacity:v1', String(normalized));
    set({ backgroundOpacity: normalized });
  },
  loadFromDb: () => {
    try {
      initDatabase();
      const dbInfo = getCompteInfo();
      const savedCoupons = getAllCoupons();
      const history: BetHistoryItem[] = [];
      if (savedCoupons.length > 0) {
        savedCoupons.forEach((c) => {
          let parsedEvents: BetEvent[] = [];
          if (c.eventsJson) {
            try {
              parsedEvents = JSON.parse(c.eventsJson);
            } catch (_) { }
          }
          history.push({
            id: c.id,
            type: c.type,
            date: c.date,
            eventCount: c.eventCount,
            totalOdds: c.totalOdds,
            stake: c.stake,
            potentialGain: c.potentialGain,
            status: c.status as BetStatus,
            events: parsedEvents,
            sellAmount: c.sellAmount,
            code: c.code,
          });
        });
      }
      void AsyncStorage.getItem('onexbet:background-opacity:v1').then((raw) => {
        const parsed = raw ? Number(raw) : 1;
        if (Number.isFinite(parsed)) set({ backgroundOpacity: Math.max(0.35, Math.min(1, parsed)) });
      });
      void AsyncStorage.getItem('onexbet:background-mode:v1').then((raw) => {
        if (raw === 'light' || raw === 'dark' || raw === 'navy' || raw === 'midnight') {
          set({ backgroundMode: raw });
        }
      });
      set({
        balance: dbInfo.balance,
        sessionId: dbInfo.sessionId,
        theme: (dbInfo.theme as any) || 'blue',
        betHistory: history,
        isHydrated: true,
      });
    } catch (e) {
      console.error('Failed to load store data from DB:', e);
      // Ne pas laisser l’interface attendre indéfiniment si le stockage local
      // est momentanément indisponible : elle affichera alors l’état vide réel.
      set({ isHydrated: true });
    }
  },
  duplicateCoupon: (slip) => {
    if (!slip) return;
    const newId = generateTicketNumber();
    const { generateCouponCode } = require('@/services/couponCode');
    const newCode = generateCouponCode();
    const copiedEvents = (slip.events || []).map((event: BetEvent) => ({
      ...event,
      // Une copie ne devient pas un ticket placé : on garde toutefois le statut
      // live et les métadonnées (liveTime/liveStartedAt) pour le rendu du match.
      status: isDraftEventLive(event) ? 'En direct' as BetStatus : 'Accepté' as BetStatus,
    }));
    const hasLiveEvent = copiedEvents.some(isDraftEventLive);
    const duplicatedDraftSlip: BetSlip = {
      id: newId,
      type: slip.type || 'Combiné',
      date: (() => {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}.${yyyy} (${hh}:${min})`;
      })(),
      eventCount: slip.eventCount,
      finishedCount: 0,
      totalOdds: slip.totalOdds,
      stake: 500,
      potentialGain: Number((500 * (slip.totalOdds || 1)).toFixed(2)),
      status: hasLiveEvent || String(slip.status || '').trim().toLowerCase() === 'en direct'
        ? 'En direct' as BetStatus
        : 'Accepté' as BetStatus,
      events: copiedEvents,
      sellAmount: slip.sellAmount,
      code: newCode,
      isDraft: true // Chargé comme brouillon pour réatterrir sur la page de coupon de pari
    };

    // Persiste immédiatement la copie complète afin que le code copié puisse
    // recharger exactement les mêmes matchs, options et cotes sur cet appareil.
    // La copie reste un brouillon dans l'interface et n'est pas débitée ici.
    insertCoupon({
      id: duplicatedDraftSlip.id,
      type: duplicatedDraftSlip.type,
      date: duplicatedDraftSlip.date,
      eventCount: duplicatedDraftSlip.eventCount,
      totalOdds: duplicatedDraftSlip.totalOdds,
      stake: duplicatedDraftSlip.stake,
      potentialGain: duplicatedDraftSlip.potentialGain,
      status: duplicatedDraftSlip.status,
      eventsJson: JSON.stringify(duplicatedDraftSlip.events),
      sellAmount: duplicatedDraftSlip.sellAmount,
      code: duplicatedDraftSlip.code,
    });

    set({
      currentBetSlip: duplicatedDraftSlip,
      activeTab: 'coupon',
      selectedHistoryId: null,
    });
  },
  updateStake: (newStake: number) => {
    set((state) => {
      const totalOdds = state.currentBetSlip.totalOdds;
      const potentialGain = Number((newStake * totalOdds).toFixed(2));
      return {
        currentBetSlip: {
          ...state.currentBetSlip,
          stake: newStake,
          potentialGain
        }
      };
    });
  },
  setBetStatus: (status) => {
    set((state) => ({
      currentBetSlip: {
        ...state.currentBetSlip,
        status
      }
    }));
  },
  addBetHistoryItem: (item) => {
    const persistedEvents = item.events || [];
    const persistedItem = { ...item, events: persistedEvents };
    insertCoupon({
      id: persistedItem.id,
      type: persistedItem.type,
      date: persistedItem.date,
      eventCount: persistedItem.eventCount,
      totalOdds: persistedItem.totalOdds,
      stake: persistedItem.stake,
      potentialGain: persistedItem.potentialGain,
      status: persistedItem.status,
      eventsJson: JSON.stringify(persistedEvents),
      sellAmount: persistedItem.sellAmount,
      code: persistedItem.code
    });
    set((state) => {
      let newBalance = state.balance;
      // Le gain est crédité uniquement au paiement effectif du coupon.
      // Le statut « Gagné » signifie que le pari est gagnant, mais pas encore réglé.
      if ((persistedItem.status === 'Payé' || persistedItem.status === 'Gagné') && claimCouponGain(persistedItem.id)) {
        newBalance = state.balance + persistedItem.potentialGain;
      } else if (persistedItem.status === 'Accepté') {
        newBalance = state.balance - persistedItem.stake;
      }
      updateCompteBalance(newBalance);
      return {
        betHistory: [persistedItem, ...state.betHistory],
        balance: newBalance,
        currentBetSlip: {
          ...state.currentBetSlip,
          ...persistedItem,
          events: persistedEvents,
          finishedCount: persistedEvents.filter((event) => ['Gagné', 'Perdu', 'Payé'].includes(event.status)).length,
          sellAmount: persistedItem.sellAmount ?? 470,
          isDraft: false,
        },
      };
    });
  },
  addEventToSlip: (event) => {
    set((state) => {
      const events = [...state.currentBetSlip.events, event];
      const eventCount = events.length;
      // Simple : la cote du panier est la cote RÉELLE de la sélection
      // (le même match ne doit jamais multiplier sa propre cote).
      // Combiné : produit des cotes de toutes les sélections.
      const isSimple = state.currentBetSlip.type === 'Simple';
      const totalOdds = isSimple
        ? Number(Math.max(...events.map((ev) => ev.odd)).toFixed(3))
        : Number(events.reduce((acc, ev) => acc * ev.odd, 1).toFixed(3));
      const potentialGain = Number((state.currentBetSlip.stake * totalOdds).toFixed(2));
      return {
        currentBetSlip: {
          ...state.currentBetSlip,
          events,
          eventCount,
          totalOdds,
          potentialGain,
          // Un coupon qui vient d’être construit reste un brouillon jusqu’à
          // l’action de mise/validation qui l’enregistre dans l’historique.
          isDraft: true
        }
      };
    });
  },
  upsertEventToSlip: (event) => {
    set((state) => {
      const baseSlip = state.currentBetSlip.isDraft || !state.currentBetSlip.id
        ? state.currentBetSlip
        : initialBetSlip;
      const events = [...baseSlip.events.filter((item) => item.id !== event.id), event];
      const isSimple = baseSlip.type === 'Simple';
      const totalOdds = isSimple
        ? Number(Math.max(...events.map((item) => item.odd)).toFixed(3))
        : Number(events.reduce((acc, item) => acc * item.odd, 1).toFixed(3));
      return {
        currentBetSlip: {
          ...baseSlip,
          events,
          eventCount: events.length,
          totalOdds,
          potentialGain: Number((baseSlip.stake * totalOdds).toFixed(2)),
          status: 'Accepté',
          isDraft: true,
        },
      };
    });
  },
  placeBet: (stake, sourceSlip) => {
    const state = get();
    const slip = sourceSlip || state.currentBetSlip;
    const events = (slip.events || []).map((event) => ({ ...event, status: 'Accepté' as BetStatus }));
    if (!Number.isFinite(stake) || stake <= 0) return { success: false, error: 'Saisissez une mise supérieure à zéro.' };
    if (stake > state.balance) return { success: false, error: 'Solde insuffisant.' };
    if (events.length === 0) return { success: false, error: 'Ajoutez au moins une sélection au coupon.' };

    const totalOdds = slip.type === 'Simple'
      ? Number(Math.max(...events.map((event) => event.odd)).toFixed(3))
      : Number(events.reduce((acc, event) => acc * event.odd, 1).toFixed(3));
    const now = new Date();
    const date = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} (${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')})`;
    const id = generateTicketNumber();
    const code = slip.code || require('@/services/couponCode').generateCouponCode();
    const newBalance = Number((state.balance - stake).toFixed(2));
    const coupon: BetHistoryItem = {
      id,
      type: slip.type || 'Combiné',
      date,
      eventCount: events.length,
      totalOdds,
      stake,
      potentialGain: Number((stake * totalOdds).toFixed(2)),
      status: 'Accepté',
      events,
      sellAmount: 470,
      code,
    };
    insertCoupon({
      id: coupon.id,
      type: coupon.type,
      date: coupon.date,
      eventCount: coupon.eventCount,
      totalOdds: coupon.totalOdds,
      stake: coupon.stake,
      potentialGain: coupon.potentialGain,
      status: coupon.status,
      eventsJson: JSON.stringify(coupon.events),
      sellAmount: coupon.sellAmount,
      code: coupon.code,
    });
    updateCompteBalance(newBalance);
    set((current) => ({
      balance: newBalance,
      betHistory: [coupon, ...current.betHistory],
      currentBetSlip: { ...slip, ...coupon, events: coupon.events || [], isDraft: false },
    }));
    return { success: true, coupon };
  },
  updateBalance: (amount) => {
    if (!updateCompteBalance(amount)) return false;
    set({ balance: amount });
    return true;
  },
  setBetSlip: (slip) => {
    set({ currentBetSlip: slip });
  },
  clearCurrentDraftCoupon: () => {
    const currentId = get().currentBetSlip.id;
    try {
      if (currentId) deleteCouponById(currentId);
    } catch (error) {
      console.warn('Impossible de supprimer le brouillon courant :', error);
    }
    set((state) => ({
      currentBetSlip: initialBetSlip,
      betHistory: currentId ? state.betHistory.filter((item) => item.id !== currentId) : state.betHistory,
      activeTab: 'coupon',
      selectedHistoryId: null,
    }));
  },
  /**
   * Charge un coupon de pari depuis la base de données SQLite en utilisant soit le code court
   * à 5 caractères soit l'identifiant transactionnel numérique de 11 chiffres.
   * Si le coupon n'existe pas en base de données, une simulation de données de secours (fallback)
   * est lancée, générant le fameux coupon à 3 matchs de l'Image 2 (Curacao, Équateur, Tunisie).
   * @param idOrCode Le code court (ex: ABCDE) ou l'identifiant numérique du coupon
   */
  loadBetSlipFromDb: async (idOrCode) => {
    const requested = String(idOrCode || '').trim();
    if (!requested) throw new Error('Saisissez un code coupon ou un numéro de ticket.');
    const normalizedCode = requested.toUpperCase();
    const isCode = isValidCouponCode(normalizedCode);

    try {
      // Priorité au cache local (SQLite sur mobile, localStorage sur le Web).
      const row = getCouponByCodeOrId(isCode ? normalizedCode : requested);
      if (row) {
        let events: BetEvent[] = [];
        try {
          events = row.eventsJson ? JSON.parse(row.eventsJson) : [];
        } catch (error) {
          console.warn('Erreur lors du parsing JSON des événements :', error);
        }

        if (Array.isArray(events) && events.length > 0) {
          const isFinishedStatus = row.status === 'Payé' || row.status === 'Gagné' || row.status === 'Perdu';
          const slip: BetSlip = {
            id: row.id,
            type: row.type || 'Combiné',
            date: row.date || '',
            eventCount: events.length,
            finishedCount: isFinishedStatus ? events.length : 0,
            totalOdds: Number(row.totalOdds || 1),
            stake: Number(row.stake || 0),
            potentialGain: Number(row.potentialGain || 0),
            status: (row.status || 'Accepté') as BetStatus,
            events,
            sellAmount: row.sellAmount,
            code: row.code,
            // Un coupon recherché par code est une copie à rejouer, pas le ticket
            // source déjà placé. Créer un nouvel ID/code évite aussi d'effacer
            // l'original lorsque l'utilisateur vide ensuite son brouillon.
            isDraft: true,
            isLoadedByCode: true,
          };
          if (isCode) {
            get().duplicateCoupon(slip);
          } else {
            set({ currentBetSlip: slip, activeTab: 'coupon', selectedHistoryId: null });
          }
          return;
        }
      }

      if (!isCode) throw new Error('Aucun coupon correspondant à ce numéro n’a été trouvé sur cet appareil.');

      // Si ce navigateur/téléphone n'a pas le coupon en cache, le code le recharge
      // depuis Firestore avec ses événements et les URL exactes de logos.
      const sharedSlip = await loadSharedCoupon(normalizedCode);
      if (!sharedSlip) throw new Error(`Aucun coupon n’a été trouvé pour le code ${normalizedCode}.`);

      insertCoupon({
        id: sharedSlip.id,
        type: sharedSlip.type,
        date: sharedSlip.date,
        eventCount: sharedSlip.events.length,
        totalOdds: sharedSlip.totalOdds,
        stake: sharedSlip.stake,
        potentialGain: sharedSlip.potentialGain,
        status: sharedSlip.status,
        eventsJson: JSON.stringify(sharedSlip.events),
        sellAmount: sharedSlip.sellAmount,
        code: sharedSlip.code,
      });
      // Afficher le coupon partagé comme une nouvelle copie brouillon, à l'image
      // de l'action « Dupliquer », sans remplacer ni marquer placé le coupon source.
      get().duplicateCoupon(sharedSlip);
    } catch (err) {
      console.error('Erreur lors du chargement du coupon :', err);
      throw err;
    }
  },
  deleteBetHistoryItem: (id) => {
    try {
      deleteCouponById(id);
      set((state) => ({
        betHistory: state.betHistory.filter((item) => item.id !== id),
        selectedHistoryId: state.selectedHistoryId === id ? null : state.selectedHistoryId,
        currentBetSlip: state.currentBetSlip.id === id ? initialBetSlip : state.currentBetSlip,
      }));
    } catch (err) {
      console.error('Error deleting bet history item:', err);
    }
  },
  payCoupon: (id, updatedEvents) => {
    const row = getCouponById(id);
    if (!row) return;

    // Un coupon déjà payé ne doit jamais être recrédité.
    if (row.status !== 'Payé' && (row.status === 'Accepté' || row.status === 'Gagné')) {
      let events: BetEvent[] = [];
      try {
        events = JSON.parse(row.eventsJson);
      } catch (e) {
        console.warn('Failed to parse events JSON:', e);
      }

      // Mark all events as Gagné
      const finalEvents = events.map((ev, idx) => {
        const updated = updatedEvents ? updatedEvents[idx] : null;
        const selectedMortalKombatResult = isMortalKombatEvent(ev) ? getMortalKombatResultForSelectedBet(ev) : null;
        const mortalKombatScore = selectedMortalKombatResult
          ? `${selectedMortalKombatResult.rounds.team1} - ${selectedMortalKombatResult.rounds.team2}`
          : null;
        return {
          ...ev,
          status: 'Gagné' as BetStatus,
          score: mortalKombatScore || (updated ? updated.score : (ev.score || '1 - 0')),
          scorePeriod1: updated ? updated.scorePeriod1 : (ev.scorePeriod1 || '1 - 0'),
          scorePeriod2: updated ? updated.scorePeriod2 : (ev.scorePeriod2 || '0 - 0'),
          ...(selectedMortalKombatResult ? {
            mortalKombatSimulation: {
              ...(ev.mortalKombatSimulation || { durationMs: MORTAL_KOMBAT_DEFAULT_DURATION_MS }),
              winner: selectedMortalKombatResult.winner,
              rounds: selectedMortalKombatResult.rounds,
            },
          } : {}),
        };
      });
      const updatedEventsJson = JSON.stringify(finalEvents);

      // 1. Update coupon in SQLite
      markCouponAsPaid(id, updatedEventsJson);

      // 2. Update Balance and in-memory stores
      const gainClaimed = claimCouponGain(id);
      set((state) => {
        const newBalance = gainClaimed ? state.balance + row.potentialGain : state.balance;
        updateCompteBalance(newBalance);

        const updatedHistory = state.betHistory.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              status: 'Payé' as BetStatus,
              events: finalEvents,
            };
          }
          return item;
        });

        let updatedSlip = state.currentBetSlip;
        if (state.currentBetSlip.id === id) {
          updatedSlip = {
            ...state.currentBetSlip,
            status: 'Payé' as BetStatus,
            events: finalEvents,
            finishedCount: state.currentBetSlip.eventCount,
          };
        }

        return {
          betHistory: updatedHistory,
          balance: newBalance,
          currentBetSlip: updatedSlip,
        };
      });
    }
  },
  updateCouponComplete: (id, patch) => {
    try {
      const previous = getCouponById(id);
      const persistedEvents = patch.events;
      const eventsJson = JSON.stringify(persistedEvents);
      updateCouponComplete(id, { ...patch, eventsJson });
      set((state) => {
        const update = (item: BetHistoryItem): BetHistoryItem => item.id === id ? {
          ...item, date: patch.date, eventCount: patch.eventCount, totalOdds: patch.totalOdds,
          stake: patch.stake, potentialGain: patch.potentialGain, status: patch.status, events: persistedEvents,
        } : item;
        const history = state.betHistory.map(update);
        const current = state.currentBetSlip.id === id ? { ...state.currentBetSlip, ...patch, events: persistedEvents } : state.currentBetSlip;
        const shouldCreditGain = (patch.status === 'Payé' || patch.status === 'Gagné')
          && previous?.status !== 'Payé'
          && claimCouponGain(id);
        if (shouldCreditGain) {
          const newBalance = state.balance + patch.potentialGain;
          updateCompteBalance(newBalance);
          return { betHistory: history, currentBetSlip: current, balance: newBalance };
        }
        return { betHistory: history, currentBetSlip: current };
      });
    } catch (error) {
      console.error('Erreur lors de l’édition complète du coupon :', error);
    }
  },
  updateCouponGlobalStatus: (id, status) => {
    try {
      const row = getCouponById(id);
      const stateBeforeUpdate = get();
      const memoryEvents = stateBeforeUpdate.currentBetSlip.id === id
        ? stateBeforeUpdate.currentBetSlip.events
        : stateBeforeUpdate.betHistory.find((item) => item.id === id)?.events;
      let storedEvents: BetEvent[] = [];
      if (row?.eventsJson) {
        try {
          const parsed = JSON.parse(row.eventsJson) as BetEvent[];
          if (Array.isArray(parsed)) storedEvents = parsed;
        } catch {
          storedEvents = [];
        }
      }
      // Certains coupons chargés ou récemment modifiés ne disposent pas encore
      // d’une copie SQLite exploitable. Les événements en mémoire deviennent alors
      // la source de secours afin que « Gagner » calcule toujours les scores.
      const sourceEvents = storedEvents.length > 0 ? storedEvents : (memoryEvents ?? []);
      const isCombinedCoupon = sourceEvents.length > 1 || row?.type === 'Combiné';
      const allEventsWon = sourceEvents.length > 0 && sourceEvents.every((event) => {
        if (event.status === 'Gagné' || event.status === 'Payé') return true;
        const isFifa = event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
        return isFifa && Boolean(getFifaSimulationState(event)?.isFinished);
      });

      // Un combiné reste accepté tant que tous ses événements ne sont pas
      // gagnants/payés : une validation globale prématurée ne crédite rien.
      if (isCombinedCoupon && (status === 'Gagné' || status === 'Payé') && !allEventsWon) {
        updateCouponStatus(id, 'Accepté');
        set((state) => ({
          betHistory: state.betHistory.map((item) => item.id === id ? { ...item, status: 'Accepté' } : item),
          currentBetSlip: state.currentBetSlip.id === id
            ? { ...state.currentBetSlip, status: 'Accepté' }
            : state.currentBetSlip,
        }));
        return;
      }
      let resolvedEvents: BetEvent[] | undefined;
      if (status === 'Gagné' && sourceEvents.length > 0) {
        resolvedEvents = sourceEvents.map((event) => ({
          ...event,
          ...getWinningEventScores(event),
          status: 'Gagné' as BetStatus,
        }));
        updateCouponEventsJson(id, JSON.stringify(resolvedEvents));
      }

      const isFifaCoupon = sourceEvents.some((event) =>
        event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA')
      );
      const shouldAutoPayFifa = status === 'Gagné'
        && isFifaCoupon
        && row?.status !== 'Gagné'
        && row?.status !== 'Payé';
      const nextStatus: BetStatus = isCombinedCoupon && allEventsWon
        ? 'Payé'
        : (shouldAutoPayFifa ? 'Payé' : status);
      // Le crédit dépend exclusivement de la transition vers « Payé ».
      // Cela couvre les matchs classiques et FIFA, tout en empêchant les doubles paiements.
      const shouldCreditGain = (nextStatus === 'Payé' || nextStatus === 'Gagné')
        && row?.status !== 'Payé'
        && claimCouponGain(id);
      if (shouldAutoPayFifa && resolvedEvents) {
        markCouponAsPaid(id, JSON.stringify(resolvedEvents));
      } else {
        updateCouponStatus(id, nextStatus);
      }
      set((state) => ({
        betHistory: state.betHistory.map((item) => item.id === id ? {
          ...item,
          status: nextStatus,
          ...(resolvedEvents ? { events: resolvedEvents } : {}),
        } : item),
        currentBetSlip: state.currentBetSlip.id === id ? {
          ...state.currentBetSlip,
          status: nextStatus,
          ...(resolvedEvents ? { events: resolvedEvents, finishedCount: resolvedEvents.length } : {}),
        } : state.currentBetSlip,
      }));

      if (shouldCreditGain) {
        set((state) => {
          const newBalance = state.balance + (row?.potentialGain ?? 0);
          updateCompteBalance(newBalance);
          return { balance: newBalance };
        });
      }
    } catch (error) {
      console.error('Erreur de mise à jour du statut global :', error);
    }
  },
  autoSettleCoupon: (id, nowMs = Date.now()) => {
    try {
      const row = getCouponById(id);
      if (!row || row.status === 'Payé' || row.status === 'Perdu') return;
      let events: BetEvent[];
      try { events = JSON.parse(row.eventsJson || '[]') as BetEvent[]; } catch { return; }
      if (events.length === 0) return;
      let changed = false;
      const resolvedEvents = events.map((event) => {
        const isFifa = event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
        const isMortal = isMortalKombatEvent(event);
        const isPoker = isPokerEvent(event);
        if (!isFifa && !isMortal && !isPoker) return event;
        if (['Gagné', 'Payé', 'Perdu'].includes(event.status)) return event;
        if (isFifa) {
          const simulation = getFifaSimulationState(event, nowMs);
          if (!simulation?.isFinished) return event;
          changed = true;
          return { ...event, ...getWinningEventScores(event), status: isFifaSelectionWon(event) ? 'Gagné' as BetStatus : 'Perdu' as BetStatus, isLive: false, liveTime: 'Terminé' };
        }
        if (isMortal) {
          const simulation = getMortalKombatSimulationState(event, nowMs);
          if (!simulation?.isFinished) return event;
          changed = true;
          const won = isMortalKombatBetWon(event, simulation.plan.winner, simulation.plan.flawlessVictory, simulation.plan.fatality, simulation.plan.victoryType);
          return { ...event, score: `${simulation.plan.rounds.team1} - ${simulation.plan.rounds.team2}`, status: won ? 'Gagné' as BetStatus : 'Perdu' as BetStatus, isLive: false, liveTime: 'Terminé', mortalKombatSimulation: { ...(event.mortalKombatSimulation || { durationMs: simulation.plan.durationMs }), winner: simulation.plan.winner, rounds: simulation.plan.rounds, roundScores: simulation.plan.roundScores } };
        }
        const simulation = getPokerSimulationState(event, nowMs);
        if (!simulation?.isFinished) return event;
        changed = true;
        return { ...event, status: isPokerBetWon(event) ? 'Gagné' as BetStatus : 'Perdu' as BetStatus, isLive: false, liveTime: 'Terminé' };
      });
      const anyLost = resolvedEvents.some((event) => event.status === 'Perdu');
      const allFinished = resolvedEvents.every((event) => ['Gagné', 'Payé', 'Perdu'].includes(event.status));
      const shouldPay = allFinished && !anyLost;
      if (!changed && !shouldPay && !anyLost) return;
      const eventsJson = JSON.stringify(resolvedEvents);
      if (shouldPay) markCouponAsPaid(id, eventsJson);
      else if (anyLost) { updateCouponStatus(id, 'Perdu'); updateCouponEventsJson(id, eventsJson); }
      else updateCouponEventsJson(id, eventsJson);
      const gainClaimed = shouldPay && claimCouponGain(id);
      set((state) => {
        const newBalance = gainClaimed ? state.balance + Number(row.potentialGain || 0) : state.balance;
        const nextStatus: BetStatus = shouldPay ? 'Payé' : anyLost ? 'Perdu' : row.status as BetStatus;
        updateCompteBalance(newBalance);
        return {
          betHistory: state.betHistory.map((item) => item.id === id ? { ...item, status: nextStatus, events: resolvedEvents } : item),
          currentBetSlip: state.currentBetSlip.id === id ? { ...state.currentBetSlip, status: nextStatus, events: resolvedEvents, finishedCount: resolvedEvents.filter((event) => ['Gagné', 'Payé', 'Perdu'].includes(event.status)).length } : state.currentBetSlip,
          balance: newBalance,
        };
      });
    } catch (error) { console.error('Erreur de règlement automatique du coupon :', error); }
  },
  autoSettleFifaCoupon: (id, nowMs = Date.now()) => {
    try {
      const row = getCouponById(id);
      if (!row || row.status === 'Payé' || row.status === 'Perdu') return;

      let storedEvents: BetEvent[] = [];
      try {
        storedEvents = JSON.parse(row.eventsJson || '[]') as BetEvent[];
      } catch {
        storedEvents = [];
      }
      if (storedEvents.length === 0) return;

      const fifaEvents = storedEvents.filter((event) =>
        event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA')
      );
      if (fifaEvents.length === 0) return;

      let changed = false;
      const resolvedEvents = storedEvents.map((event) => {
        const isFifa = event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
        const simulation = isFifa ? getFifaSimulationState(event, nowMs) : null;
        if (!simulation?.isFinished || ['Gagné', 'Payé', 'Perdu'].includes(event.status)) return event;
        changed = true;
        return {
          ...event,
          ...getWinningEventScores(event),
          status: isFifaSelectionWon(event) ? 'Gagné' as BetStatus : 'Perdu' as BetStatus,
          isLive: false,
          liveTime: 'Terminé',
        };
      });

      const finishedCount = resolvedEvents.filter((event) =>
        event.status === 'Gagné' || event.status === 'Payé'
      ).length;
      const allFifaFinished = fifaEvents.every((event) =>
        getFifaSimulationState(event, nowMs)?.isFinished
      );
      const allEventsWon = resolvedEvents.every((event) =>
        event.status === 'Gagné' || event.status === 'Payé'
      );
      const anyLost = resolvedEvents.some((event) => event.status === 'Perdu');
      const shouldPay = !anyLost && allFifaFinished && allEventsWon;

      if (!changed && !shouldPay && !anyLost) return;

      const updatedEventsJson = JSON.stringify(resolvedEvents);
      if (shouldPay) {
        markCouponAsPaid(id, updatedEventsJson);
      } else {
        if (anyLost) updateCouponStatus(id, 'Perdu');
        updateCouponEventsJson(id, updatedEventsJson);
      }

      const gainClaimed = shouldPay && claimCouponGain(id);
      set((state) => {
        const newBalance = gainClaimed ? state.balance + row.potentialGain : state.balance;
        const nextStatus: BetStatus = shouldPay ? 'Payé' : anyLost ? 'Perdu' : row.status as BetStatus;
        updateCompteBalance(newBalance);
        return {
          betHistory: state.betHistory.map((item) => item.id === id ? {
            ...item,
            status: nextStatus,
            events: resolvedEvents,
          } : item),
          currentBetSlip: state.currentBetSlip.id === id ? {
            ...state.currentBetSlip,
            status: nextStatus,
            events: resolvedEvents,
            finishedCount,
          } : state.currentBetSlip,
          balance: newBalance,
        };
      });
    } catch (error) {
      console.error('Erreur de règlement automatique FIFA :', error);
    }
  },
  autoSettleMortalKombatCoupon: (id, nowMs = Date.now()) => {
    try {
      const row = getCouponById(id);
      if (!row || row.status === 'Payé') return;
      let storedEvents: BetEvent[] = [];
      try { storedEvents = JSON.parse(row.eventsJson || '[]') as BetEvent[]; } catch { return; }
      const mortalEvents = storedEvents.filter(isMortalKombatEvent);
      if (mortalEvents.length === 0) return;
      let changed = false;
      const resolvedEvents = storedEvents.map((event) => {
        const simulation = isMortalKombatEvent(event) ? getMortalKombatSimulationState(event, nowMs) : null;
        if (!simulation?.isFinished || event.status === 'Gagné' || event.status === 'Payé') return event;
        changed = true;
        return {
          ...event,
          score: `${simulation.plan.rounds.team1} - ${simulation.plan.rounds.team2}`,
          status: 'Gagné' as BetStatus,
          isLive: false,
          liveTime: 'Terminé',
          mortalKombatSimulation: {
            ...(event.mortalKombatSimulation || { durationMs: simulation.plan.durationMs }),
            winner: simulation.plan.winner,
            rounds: simulation.plan.rounds,
            roundScores: simulation.plan.roundScores,
          },
        };
      });
      const allMortalFinished = mortalEvents.every((event) => getMortalKombatSimulationState(event, nowMs)?.isFinished || event.status === 'Gagné' || event.status === 'Perdu' || event.status === 'Payé');
      const allEventsWon = resolvedEvents.every((event) => event.status === 'Gagné' || event.status === 'Payé');
      const shouldPay = allMortalFinished && allEventsWon;
      if (!changed && !shouldPay) return;
      const updatedEventsJson = JSON.stringify(resolvedEvents);
      if (shouldPay) markCouponAsPaid(id, updatedEventsJson); else updateCouponEventsJson(id, updatedEventsJson);
      const gainClaimed = shouldPay && claimCouponGain(id);
      set((state) => {
        const newBalance = gainClaimed ? state.balance + row.potentialGain : state.balance;
        const nextStatus: BetStatus = shouldPay ? 'Payé' : row.status as BetStatus;
        updateCompteBalance(newBalance);
        return { betHistory: state.betHistory.map((item) => item.id === id ? { ...item, status: nextStatus, events: resolvedEvents } : item), currentBetSlip: state.currentBetSlip.id === id ? { ...state.currentBetSlip, status: nextStatus, events: resolvedEvents, finishedCount: resolvedEvents.filter((event) => event.status === 'Gagné' || event.status === 'Payé').length } : state.currentBetSlip, balance: newBalance };
      });
    } catch (error) { console.error('Erreur de règlement automatique Mortal Kombat :', error); }
  },
  autoSettlePokerCoupon: (id, nowMs = Date.now()) => {
    try {
      const row = getCouponById(id);
      if (!row || row.status === 'Payé' || row.status === 'Perdu') return;
      let storedEvents: BetEvent[] = [];
      try { storedEvents = JSON.parse(row.eventsJson || '[]') as BetEvent[]; } catch { return; }
      const pokerEvents = storedEvents.filter(isPokerEvent);
      // Une manche Poker autonome est réglée seule. Un coupon mixte reste
      // soumis à la validation de ses autres événements.
      if (pokerEvents.length === 0 || pokerEvents.length !== storedEvents.length) return;
      const allFinished = pokerEvents.every((event) => {
        const simulation = getPokerSimulationState(event, nowMs);
        return Boolean(simulation?.isFinished || event.status === 'Gagné' || event.status === 'Payé');
      });
      if (!allFinished) return;
      let anyLost = false;
      const resolvedEvents = storedEvents.map((event) => {
        if (!isPokerEvent(event)) return event;
        // Une validation administrative globale en Gagné/Payé est
        // prioritaire : le règlement automatique ne doit pas la renverser
        // en Perdu à cause d'un libellé Poker ancien ou personnalisé.
        const won = row.status === 'Gagné' || row.status === 'Payé'
          ? true
          : isPokerBetWon(event);
        if (!won) anyLost = true;
        return {
          ...event,
          status: won ? 'Gagné' as BetStatus : 'Perdu' as BetStatus,
          isLive: false,
          liveTime: 'Terminé',
        };
      });
      const updatedEventsJson = JSON.stringify(resolvedEvents);
      if (anyLost) {
        updateCouponStatus(id, 'Perdu');
        updateCouponEventsJson(id, updatedEventsJson);
      } else {
        markCouponAsPaid(id, updatedEventsJson);
      }
      const gainClaimed = !anyLost && claimCouponGain(id);
      set((state) => {
        const newBalance = gainClaimed ? state.balance + row.potentialGain : state.balance;
        updateCompteBalance(newBalance);
        return {
          betHistory: state.betHistory.map((item) => item.id === id ? { ...item, status: anyLost ? 'Perdu' : 'Payé', events: resolvedEvents } : item),
          currentBetSlip: state.currentBetSlip.id === id ? { ...state.currentBetSlip, status: anyLost ? 'Perdu' : 'Payé', events: resolvedEvents, finishedCount: resolvedEvents.length } : state.currentBetSlip,
          balance: newBalance,
        };
      });
    } catch (error) {
      console.error('Erreur de règlement automatique Poker :', error);
    }
  },
  updateCouponSellAmount: (id, amount) => {
    try {
      updateCouponSellAmount(id, amount);
      set((state) => {
        const updatedHistory = state.betHistory.map((item) => {
          if (item.id === id) {
            return { ...item, sellAmount: amount };
          }
          return item;
        });

        let updatedSlip = state.currentBetSlip;
        if (state.currentBetSlip.id === id) {
          updatedSlip = { ...state.currentBetSlip, sellAmount: amount };
        }

        return {
          betHistory: updatedHistory,
          currentBetSlip: updatedSlip,
        };
      });
    } catch (err) {
      console.error('Error updating coupon sell amount action:', err);
    }
  },
  updateEventStatus: (couponId, eventId, status) => {
    set((state) => {
      const updatedHistory = state.betHistory.map((item) => {
        if (item.id !== couponId) return item;

        // 1. Mettre à jour le statut de l'événement ciblé
        const updatedEvents = (item.events ?? []).map((ev) =>
          ev.id === eventId ? { ...ev, status } : ev
        );

        // 2. Persister les événements mis à jour en DB
        const newEventsJson = JSON.stringify(updatedEvents);
        updateCouponEventsJson(couponId, newEventsJson);

        // 3. Calculer le nombre de matchs terminés (statut Gagné)
        const finishedCount = updatedEvents.filter((ev) => ev.status === 'Gagné').length;

        // Le statut du match est indépendant : l’administration décide séparément
        // du statut global du coupon.
        return {
          ...item,
          events: updatedEvents,
        };
      });

      // 5. Synchroniser le currentBetSlip si c'est le même coupon
      let updatedSlip = state.currentBetSlip;
      if (state.currentBetSlip.id === couponId) {
        const updatedEvents = (state.currentBetSlip.events ?? []).map((ev) =>
          ev.id === eventId ? { ...ev, status } : ev
        );
        const finishedCount = updatedEvents.filter((ev) => ev.status === 'Gagné' || ev.status === 'Payé' || ev.status === 'Remboursé').length;
        updatedSlip = {
          ...state.currentBetSlip,
          events: updatedEvents,
          finishedCount,
          // Ne jamais déduire le statut global depuis les matchs individuels.
          status: state.currentBetSlip.status,
        };
      }

      return { betHistory: updatedHistory, currentBetSlip: updatedSlip };
    });

    // Un coupon simple classique est crédité dès que son unique match est
    // validé « Gagné » ou « Payé ». Les coupons combinés restent soumis à
    // leur validation globale.
    if (status === 'Gagné' || status === 'Payé') {
      const row = getCouponById(couponId);
      let events: BetEvent[] = [];
      try {
        events = row?.eventsJson ? JSON.parse(row.eventsJson) as BetEvent[] : [];
      } catch {
        events = [];
      }
      const isSingleClassic = events.length === 1
        && events[0].id === eventId
        && events[0].sport !== 'FIFA'
        && !events[0].tournament.trim().toUpperCase().startsWith('FIFA');
      const isSingleFifa = events.length === 1
        && events[0].id === eventId
        && (events[0].sport === 'FIFA' || events[0].tournament.trim().toUpperCase().startsWith('FIFA'));
      if (isSingleClassic && row?.status !== 'Payé') {
        get().updateCouponGlobalStatus(couponId, 'Payé');
      } else if (isSingleFifa && status === 'Gagné' && row?.status !== 'Payé') {
        get().updateCouponGlobalStatus(couponId, 'Gagné');
      }
    }

    // Le dernier événement gagnant/payé déclenche le paiement global d'un
    // combiné. Les validations précédentes restent sans effet sur le solde.
    const latestState = get();
    const latestSlip = latestState.currentBetSlip.id === couponId
      ? latestState.currentBetSlip
      : latestState.betHistory.find((item) => item.id === couponId);
    const latestEvents = latestSlip?.events ?? [];
    if (latestEvents.length > 1 && latestEvents.every((event) => event.status === 'Gagné' || event.status === 'Payé')) {
      const latestRow = getCouponById(couponId);
      if (latestRow?.status !== 'Payé') get().updateCouponGlobalStatus(couponId, 'Payé');
    }
  },
  toggleEventLive: (couponId, eventId, isLive, liveTime) => {
    set((state) => {
      const updatedHistory = state.betHistory.map((item) => {
        if (item.id !== couponId) return item;

        const updatedEvents = (item.events ?? []).map((ev) => {
          if (ev.id === eventId) {
            const nextIsLive = isLive !== undefined ? isLive : !ev.isLive;
            const isClassicEvent = ev.sport !== 'FIFA' && !ev.tournament.trim().toUpperCase().startsWith('FIFA');
            return {
              ...ev,
              isLive: nextIsLive,
              liveTime: liveTime ?? (nextIsLive ? 'En direct' : undefined),
              ...(isMortalKombatEvent(ev) ? { liveStartedAt: nextIsLive ? (ev.liveStartedAt || new Date().toISOString()) : undefined } : {}),
              // Le direct d’un match classique ne doit jamais transformer le
              // coupon en Gagné. Le statut global reste inchangé ailleurs.
              ...(isClassicEvent && nextIsLive ? { status: 'En direct' as BetStatus } : {}),
              ...(isClassicEvent && !nextIsLive && ev.status === 'En direct' ? { status: 'Accepté' as BetStatus } : {}),
            };
          }
          return ev;
        });

        const newEventsJson = JSON.stringify(updatedEvents);
        updateCouponEventsJson(couponId, newEventsJson);

        return {
          ...item,
          events: updatedEvents,
        };
      });

      let updatedSlip = state.currentBetSlip;
      if (state.currentBetSlip.id === couponId) {
        const updatedEvents = (state.currentBetSlip.events ?? []).map((ev) => {
          if (ev.id === eventId) {
            const nextIsLive = isLive !== undefined ? isLive : !ev.isLive;
            const isClassicEvent = ev.sport !== 'FIFA' && !ev.tournament.trim().toUpperCase().startsWith('FIFA');
            return {
              ...ev,
              isLive: nextIsLive,
              liveTime: liveTime ?? (nextIsLive ? 'En direct' : undefined),
              ...(isMortalKombatEvent(ev) ? { liveStartedAt: nextIsLive ? (ev.liveStartedAt || new Date().toISOString()) : undefined } : {}),
              ...(isClassicEvent && nextIsLive ? { status: 'En direct' as BetStatus } : {}),
              ...(isClassicEvent && !nextIsLive && ev.status === 'En direct' ? { status: 'Accepté' as BetStatus } : {}),
            };
          }
          return ev;
        });
        updatedSlip = {
          ...state.currentBetSlip,
          events: updatedEvents,
        };
      }

      return { betHistory: updatedHistory, currentBetSlip: updatedSlip };
    });
  },
  sessionUser: null,
  sessionRole: null,
  isUnlocked: false,
  setSessionUser: (user, role) => set({ sessionUser: user, sessionRole: role }),
  setIsUnlocked: (val) => set({ isUnlocked: val }),
  usersList: [],
  setUsersList: (users) => set({ usersList: users }),
  addUser: (username, role) => {
    const currentUsers = useBetStore.getState().usersList;
    const exists = currentUsers.some((u) => u.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      return false;
    }
    const newId = Math.random().toString();
    set((state) => ({
      usersList: [
        ...state.usersList,
        { id: newId, username, role, status: 'active' },
      ],
    }));
    return true;
  },
  updateUserStatus: (id, status) => {
    set((state) => ({
      usersList: state.usersList.map((u) => (u.id === id ? { ...u, status } : u)),
    }));
  },
  deleteUser: (id) => {
    set((state) => ({
      usersList: state.usersList.filter((u) => u.id !== id),
    }));
  },

  // ── Apple of Fortune v3 : préférences et mode Predictor ──
  aofSoundEnabled: true,
  aofHapticsEnabled: true,
  aofPredictions: {},
  aofHistory: [],
  setAofSoundEnabled: (enabled) => {
    set({ aofSoundEnabled: enabled });
    void AsyncStorage.setItem(AOF_STORAGE_KEYS.soundEnabled, enabled ? '1' : '0');
  },
  setAofHapticsEnabled: (enabled) => {
    set({ aofHapticsEnabled: enabled });
    void AsyncStorage.setItem(AOF_STORAGE_KEYS.hapticsEnabled, enabled ? '1' : '0');
  },
  setAofPrediction: (row, col) => {
    set((state) => {
      const cols = state.aofPredictions[row] ?? [];
      const nextCols = cols.includes(col) ? cols.filter((c) => c !== col) : [...cols, col];
      const next: Record<number, number[]> = {};
      for (const k of Object.keys(state.aofPredictions)) {
        const v = state.aofPredictions[Number(k)];
        if (v && v.length > 0) next[Number(k)] = [...v];
      }
      if (nextCols.length > 0) next[row] = nextCols;
      void AsyncStorage.setItem(AOF_STORAGE_KEYS.predictions, JSON.stringify(next));
      return { aofPredictions: next };
    });
  },
  clearAofPredictions: () => {
    set({ aofPredictions: {} });
    void AsyncStorage.removeItem(AOF_STORAGE_KEYS.predictions);
  },
  pushAofHistory: (entry) => {
    set((state) => {
      const newEntry: AofHistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: new Date().toISOString(),
      };
      const nextHistory = [newEntry, ...state.aofHistory].slice(0, 100);
      void AsyncStorage.setItem(AOF_STORAGE_KEYS.history, JSON.stringify(nextHistory));
      return { aofHistory: nextHistory };
    });
  },
  clearAofHistory: () => {
    set({ aofHistory: [] });
    void AsyncStorage.setItem(AOF_STORAGE_KEYS.history, '[]');
  },
}));

// Hydratation différée des préférences AOF v3 (après création du store).
(async () => {
  try {
    const [soundEnabled, hapticsEnabled, predictions, history] = await Promise.all([
      loadAofBool(AOF_STORAGE_KEYS.soundEnabled, true),
      loadAofBool(AOF_STORAGE_KEYS.hapticsEnabled, true),
      loadAofObject<Record<number, number[]>>(AOF_STORAGE_KEYS.predictions, {}),
      loadAofObject<AofHistoryEntry[]>(AOF_STORAGE_KEYS.history, []),
    ]);
    useBetStore.setState({ aofSoundEnabled: soundEnabled, aofHapticsEnabled: hapticsEnabled, aofPredictions: predictions, aofHistory: history });
  } catch (e) {
    console.warn('AOF v3 preferences load failed:', e);
  }
})();
