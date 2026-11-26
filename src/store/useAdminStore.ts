import { create } from 'zustand';
import { BetEvent, BetSlip, BetStatus } from '@/types/bet';
import { normalizeScorePeriods } from '@/utils/scorePeriods';
import { generateTicketNumber } from '@/services/couponCode';
import { createFifaSimulationPlan } from '@/utils/localFifaSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// 📐  TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminMatch {
  fixtureId: number;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  league: string;
  sport?: 'football' | 'fifa' | 'mortal-kombat' | 'poker';
  leagueLogo: string;
  date: string;             // ISO string
  status: string;           // "NS", "LIVE", "FT", etc.
  score?: string;           // ex: "2 - 1"
  betOption: BetOption;     // option prédéfinie ou option personnalisée
  customBetOption?: boolean;
  odd: number;
  scorePeriod1?: string;
  scorePeriod2?: string;
  /** Durée réelle de la simulation FIFA, en millisecondes. */
  fifaDurationMs?: number;
  /** Durée réelle du combat Mortal Kombat, en millisecondes. */
  mortalKombatDurationMs?: number;
  /** Durée réelle d’une manche Poker, en millisecondes. */
  pokerDurationMs?: number;
  // ── Toutes les cotes d'options de paris ──
  oddV1?: number;
  oddNul?: number;
  oddV2?: number;
  oddDc1x?: number;
  oddDc12?: number;
  oddDcX2?: number;
  oddOver15?: number;
  oddOver25?: number;
  oddOver35?: number;
  oddUnder15?: number;
  oddUnder25?: number;
  oddUnder35?: number;
  oddBttsYes?: number;
  oddBttsNo?: number;
  oddScoreExact?: number;
  oddHtV1?: number;
  oddHtNul?: number;
  oddHtV2?: number;
  oddHandicap?: number;
}

export type BetOption =
  | 'V1' | 'Nul' | 'V2'
  | 'DC 1X' | 'DC 12' | 'DC X2'
  | 'V1 — Plus de 0.5' | 'V2 — Plus de 0.5'
  | 'Plus de 0.5' | 'Plus 1.5' | 'Plus 2.5' | 'Plus 3.5'
  | 'Total 2 (0.5) Plus'
  | 'Moins de 0.5' | 'Moins 1.5' | 'Moins 2.5' | 'Moins 3.5'
  | 'Plus de 1.5 corner' | 'Moins de 1.5 corner'
  | 'Plus de 2.5 corner' | 'Moins de 2.5 corner'
  | 'Plus de 2.5 corners' | 'Moins de 2.5 corners'
  | 'Corners V1' | 'Corners V2'
  | 'N’importe quelle équipe gagne'
  | 'Cartons — Plus de 3.5' | 'Cartons — Moins de 3.5'
  | 'Cartons V1' | 'Cartons V2'
  | 'Cartons rouges — Plus de 0.5' | 'Cartons rouges — Moins de 0.5'
  | 'Cartons rouges V1' | 'Cartons rouges V2'
  | 'Les deux marquent Oui' | 'Les deux marquent Non'
  | '1X2 + Chaque équipe va marquer — V1 et Oui'
  | '1X2 + Chaque équipe va marquer — V2 et Oui'
  | 'Score exact' | 'HT V1' | 'HT Nul' | 'HT V2' | 'Handicap -1.5'
  | 'Carte haute' | 'Une paire' | 'Deux paires' | 'Brelan' | 'Quinte' | 'Couleur' | 'Full House' | 'Carré' | 'Quinte flush' | 'Quinte flush royale'
  | 'Main 1' | 'Main 2' | 'Main 3' | 'Main 4' | 'Main 5' | 'Main 6';

export const MORTAL_KOMBAT_BET_OPTIONS_KEY = 'onexbet:mortal-kombat-bet-options:v1';

const parseCouponSchedule = (value: string, fallback: string): string => {
  const match = value.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})\s*\((\d{1,2}):(\d{2})\)$/);
  if (!match) return fallback;
  const [, day, month, year, hour, minute] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0).toISOString();
};

interface AdminState {
  // ── Matchs sélectionnés pour le coupon en cours de construction
  selectedMatches: AdminMatch[];
  customBetOptions: string[];
  mortalKombatBetOptions: string[];
  addMatch: (match: AdminMatch) => void;
  removeMatch: (fixtureId: number) => void;
  updateMatchOdd: (fixtureId: number, odd: number) => void;
  updateMatchBetOption: (fixtureId: number, betOption: BetOption, customBetOption?: boolean) => void;
  addCustomBetOption: (label: string) => boolean;
  addMortalKombatBetOption: (label: string) => boolean;
  updateMatchScore: (fixtureId: number, score: string) => void;
  updateMatchLeague: (fixtureId: number, league: string) => void;
  clearMatches: () => void;

  // ── Paramètres du coupon
  couponType: 'Combiné' | 'Simple';
  setCouponType: (t: 'Combiné' | 'Simple') => void;
  stake: number;
  setStake: (v: number) => void;
  couponDate: string;
  setCouponDate: (v: string) => void;
  couponStatus: BetStatus;
  setCouponStatus: (v: BetStatus) => void;
  pokerDurationMinutes: number;
  setPokerDurationMinutes: (v: number) => void;

  // ── Calculs dérivés
  totalOdds: () => number;
  potentialGain: () => number;

  // ── Conversion vers BetSlip (pour injection dans useBetStore)
  buildBetSlip: () => BetSlip;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏪  STORE
// ─────────────────────────────────────────────────────────────────────────────
export const useAdminStore = create<AdminState>((set, get) => ({
  selectedMatches: [],
  customBetOptions: [],
  mortalKombatBetOptions: [
    'Vainqueur du combat — V1',
    'Vainqueur du combat — V2',
    'Flawless Victory dans le match — Oui',
    'Flawless Victory dans le match — Non',
    'Fatality',
    'Brutality',
    'No Finish',
    'Amitié',
  ],
  addMatch: (match) =>
    set((state) => {
      if (state.selectedMatches.some((m) => m.fixtureId === match.fixtureId)) {
        return state; // évite les doublons
      }
      return { selectedMatches: [...state.selectedMatches, match] };
    }),
  removeMatch: (id) =>
    set((state) => ({
      selectedMatches: state.selectedMatches.filter((m) => m.fixtureId !== id),
    })),
  updateMatchOdd: (id, odd) =>
    set((state) => ({
      selectedMatches: state.selectedMatches.map((m) =>
        m.fixtureId === id ? { ...m, odd } : m
      ),
    })),
  updateMatchBetOption: (id, betOption, customBetOption = false) =>
    set((state) => ({
      selectedMatches: state.selectedMatches.map((m) =>
        m.fixtureId === id ? { ...m, betOption, customBetOption } : m
      ),
    })),
  addCustomBetOption: (label) => {
    const normalized = label.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > 60) return false;
    const exists = get().customBetOptions.some((option) => option.toLowerCase() === normalized.toLowerCase());
    if (exists) return false;
    set((state) => ({ customBetOptions: [...state.customBetOptions, normalized] }));
    return true;
  },
  addMortalKombatBetOption: (label) => {
    const normalized = label.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > 60) return false;
    const exists = get().mortalKombatBetOptions.some((option) => option.toLowerCase() === normalized.toLowerCase());
    if (exists) return false;
    set((state) => ({ mortalKombatBetOptions: [...state.mortalKombatBetOptions, normalized] }));
    return true;
  },
  updateMatchScore: (id, score) =>
    set((state) => ({
      selectedMatches: state.selectedMatches.map((m) =>
        m.fixtureId === id ? { ...m, score } : m
      ),
    })),
  updateMatchLeague: (id, league) =>
    set((state) => ({
      selectedMatches: state.selectedMatches.map((m) =>
        m.fixtureId === id ? { ...m, league } : m
      ),
    })),
  clearMatches: () => set({ selectedMatches: [] }),

  couponType: 'Combiné',
  setCouponType: (t) => set({ couponType: t }),
  stake: 2000,
  setStake: (v) => set({ stake: v }),
  couponDate: '',
  setCouponDate: (v) => set({ couponDate: v }),
  couponStatus: 'Accepté',
  setCouponStatus: (v) => set({ couponStatus: v }),
  pokerDurationMinutes: 3,
  setPokerDurationMinutes: (v) => set({ pokerDurationMinutes: Math.max(1, Math.min(60, Number.isFinite(v) ? v : 3)) }),

  totalOdds: () => {
    const { selectedMatches, couponType } = get();
    if (!selectedMatches.length) return 1;
    // La cote saisie par l’analyste est l’unique source de vérité.
    // Le choix de l’option ne modifie jamais cette cote.
    const realOdds: number[] = selectedMatches.map((m) => m.odd);
    // Simple : la cote affichée doit être celle de la sélection réelle.
    // Un Simple ne contient qu'un match : cote de sa sélection. Si
    // plusieurs matchs sont malgré tout ajoutés en mode Simple, on garde
    // la cote réelle la plus élevée pour rester cohérent avec les gains.
    if (couponType === 'Simple') {
      return Number(Math.max(...realOdds).toFixed(3));
    }
    // Combiné : produit des cotes réelles des sélections.
    return Number(
      realOdds.reduce((acc, o) => acc * o, 1).toFixed(3)
    );
  },

  potentialGain: () => {
    const { stake, totalOdds } = get();
    return Number((stake * totalOdds()).toFixed(2));
  },

  buildBetSlip: () => {
    const { selectedMatches, couponType, stake, totalOdds, potentialGain, couponDate, couponStatus, pokerDurationMinutes } = get();
    const now = new Date();
    const dateStr = couponDate.trim() || `${now.toLocaleDateString('fr-FR')} (${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`;

    // Code limité à 5 caractères : 3 lettres + 2 chiffres ou 2 lettres + 3 chiffres.
    const { generateCouponCode } = require('@/services/couponCode');
    const generatedCode = generateCouponCode();

    const events: BetEvent[] = selectedMatches.map((m) => {
      const scoreStr = m.score || '0 - 0';
      const normalizedPeriods = normalizeScorePeriods(scoreStr, m.scorePeriod1, m.scorePeriod2);
      let betTypeFormatted: string;
      // La cote reste exactement celle saisie par l’analyste,
      // même après le choix ou la modification de l’option de pari.
      const usedOdd = m.odd;
      const isPokerEvent = m.sport === 'poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(m.league.trim());

      if (m.customBetOption) {
        // Une option créée par l’utilisateur doit être conservée telle quelle.
        betTypeFormatted = m.betOption;
      } else if (m.betOption === 'Score exact') {
        betTypeFormatted = `Score exact. ${scoreStr.replace(/\s+/g, '')}`;
      } else if (m.betOption.startsWith('DC ')) {
        betTypeFormatted = `Double chance. ${m.betOption.replace('DC ', '')}`;
      } else if (m.betOption === 'Total 2 (0.5) Plus') {
        betTypeFormatted = 'Total équipe 2. Plus de 0.5';
      } else if (m.betOption.startsWith('Plus de ')) {
        const market = m.betOption.replace('Plus de ', '');
        betTypeFormatted = market.toLowerCase().includes('corner') ? `Corners. Plus de ${market.replace(' corner', '')}` : `Total buts. Plus de ${market}`;
      } else if (m.betOption.startsWith('Moins de ')) {
        const market = m.betOption.replace('Moins de ', '');
        betTypeFormatted = market.toLowerCase().includes('corner') ? `Corners. Moins de ${market.replace(' corner', '')}` : `Total buts. Moins de ${market}`;
      } else if (m.betOption.startsWith('Plus ')) {
        betTypeFormatted = `Total buts. Plus de ${m.betOption.replace('Plus ', '')}`;
      } else if (m.betOption.startsWith('Moins ')) {
        betTypeFormatted = `Total buts. Moins de ${m.betOption.replace('Moins ', '')}`;
      } else if (m.betOption === 'V1 — Plus de 0.5' || m.betOption === 'V2 — Plus de 0.5') {
        betTypeFormatted = `${m.betOption.replace(' — ', '. ')}`;
      } else if (m.betOption === 'N’importe quelle équipe gagne') {
        betTypeFormatted = 'Résultat. N’importe quelle équipe gagne';
      } else if (m.betOption.startsWith('Corners V')) {
        betTypeFormatted = `Corners. ${m.betOption.replace('Corners ', '')}`;
      } else if (m.betOption.startsWith('Cartons rouges — ')) {
        betTypeFormatted = `Cartons rouges. ${m.betOption.replace('Cartons rouges — ', '')}`;
      } else if (m.betOption.startsWith('Cartons rouges V')) {
        betTypeFormatted = `Cartons rouges. ${m.betOption.replace('Cartons rouges ', '')}`;
      } else if (m.betOption.startsWith('Cartons — ')) {
        betTypeFormatted = `Cartons. ${m.betOption.replace('Cartons — ', '')}`;
      } else if (m.betOption.startsWith('Cartons V')) {
        betTypeFormatted = `Cartons. ${m.betOption.replace('Cartons ', '')}`;
      } else if (m.betOption === '1X2 + Chaque équipe va marquer — V1 et Oui') {
        betTypeFormatted = '1X2 + Chaque équipe va marquer. V1 et Oui';
      } else if (m.betOption === '1X2 + Chaque équipe va marquer — V2 et Oui') {
        betTypeFormatted = '1X2 + Chaque équipe va marquer. V2 et Oui';
      } else if (m.betOption.startsWith('Les deux marquent')) {
        betTypeFormatted = `Les deux équipes marquent. ${m.betOption.replace('Les deux marquent ', '')}`;
      } else if (m.betOption.startsWith('HT ')) {
        betTypeFormatted = `Mi-temps. ${m.betOption.replace('HT ', '')}`;
      } else if (m.betOption === 'Handicap -1.5') {
        betTypeFormatted = `Handicap asiatique. Domicile -1.5`;
      } else {
        betTypeFormatted = `1X2. ${m.betOption}`;
      }
      if (isPokerEvent) {
        betTypeFormatted = m.betOption.startsWith('Main')
          ? `Quelle Main va gagner ?. ${m.betOption}`
          : `Combinaison gagnante. ${m.betOption}`;
      }

      const isFifaEvent = m.sport === 'fifa' || m.league.startsWith('FIFA');
      const isMortalKombatEvent = m.sport === 'mortal-kombat' || /mortal\s+(kombat|combat)/i.test(m.league);
      const eventSchedule = isPokerEvent && couponDate.trim() ? parseCouponSchedule(couponDate, m.date) : m.date;
      const fifaDurationMs = m.fifaDurationMs;
      const mortalKombatDurationMs = m.mortalKombatDurationMs;
      const fifaEvent: BetEvent = {
        id: `ev-${m.fixtureId}`,
        sport: isFifaEvent ? 'FIFA' : isMortalKombatEvent ? 'Mortal Kombat' : isPokerEvent ? 'Poker' : 'Football',
        tournament: m.league,
        date: new Date(eventSchedule).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) +
          ' (' + new Date(eventSchedule).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ')' ,
        team1: m.homeTeam,
        team2: m.awayTeam,
        team1CountryCode: m.homeLogo || 'us',
        team2CountryCode: m.awayLogo || 'au',
        team1Logo: m.homeLogo || undefined,
        team2Logo: m.awayLogo || undefined,
        betType: betTypeFormatted,
        odd: usedOdd,
        status: couponStatus === 'Accepté' ? 'Accepté' : ('Gagné' as BetStatus),
        score: m.score,
        scorePeriod1: normalizedPeriods.period1,
        scorePeriod2: normalizedPeriods.period2,
        ...(isMortalKombatEvent ? { mortalKombatInfoNumber: Math.floor(Math.random() * 1000) + 1 } : {}),
        ...(isPokerEvent ? {
          scheduledAt: eventSchedule,
          pokerSimulation: { durationMs: Math.max(1, pokerDurationMinutes) * 60 * 1000 },
        } : {}),
        ...(isMortalKombatEvent ? { scheduledAt: eventSchedule } : {}),
        ...(isFifaEvent ? {
          scheduledAt: m.date,
          fifaSimulation: createFifaSimulationPlan({
            id: `ev-${m.fixtureId}`,
            sport: 'FIFA',
            tournament: m.league,
            date: new Date(m.date).toISOString(),
            team1: m.homeTeam,
            team2: m.awayTeam,
            team1CountryCode: m.homeLogo || 'us',
            team2CountryCode: m.awayLogo || 'au',
            betType: betTypeFormatted,
            odd: usedOdd,
            status: couponStatus === 'Accepté' ? 'Accepté' : ('Gagné' as BetStatus),
            score: m.score,
          }, fifaDurationMs),
        } : {}),
        ...(isMortalKombatEvent ? {
          mortalKombatSimulation: { durationMs: Number.isFinite(mortalKombatDurationMs) && (mortalKombatDurationMs || 0) > 0 ? (mortalKombatDurationMs as number) : 3 * 60 * 1000 },
        } : {}),
      };
      return fifaEvent;
    });

    const eventCount = selectedMatches.length;

    // Recalcule la cote et les gains à partir des cotes RÉELLES des
    // événements construits (usedOdd). Cela garantit que la cote affichée
    // dans les détails du pari correspond exactement à celle de la
    // sélection (cas du Simple : un seul match = sa cote de sélection).
    const computedTotalOdds =
      couponType === 'Simple'
        ? Number(
            events
              .map((e) => e.odd)
              .reduce((max, o) => Math.max(max, o), 0)
              .toFixed(3)
          )
        : Number(events.map((e) => e.odd).reduce((acc, o) => acc * o, 1).toFixed(3));
    const computedGain = Number((stake * computedTotalOdds).toFixed(2));

    return {
      id: generateTicketNumber(),
      type: couponType,
      date: dateStr,
      eventCount,
      finishedCount: couponStatus === 'Accepté' ? 0 : eventCount,
      totalOdds: computedTotalOdds,
      stake,
      potentialGain: computedGain,
      status: couponStatus,
      events,
      code: generatedCode,
    };
  },
}));
