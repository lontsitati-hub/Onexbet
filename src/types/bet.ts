export type BetStatus = 'Accepté' | 'Perdu' | 'Gagné' | 'En direct' | 'En attente' | 'Payé' | 'Remboursé';

export interface CircularFlagProps {
  countryCode: string;
  size?: number;
  teamName?: string;
}

export interface BetProviderMarket {
  id?: number;
  name: string;
  values: Array<{
    value: string;
    odd?: number;
    handicap?: string | number | null;
    main?: boolean | null;
    suspended?: boolean;
  }>;
}

export interface BetEvent {
  id: string;
  sport: string;
  tournament: string;
  date: string;
  team1: string;
  team2: string;
  team1CountryCode: string;
  team2CountryCode: string;
  /** Logos choisis lors de la création du match, transmis à l’écran live FIFA. */
  team1Logo?: string;
  team2Logo?: string;
  /** Fournisseur et identifiant d'origine du match, conservés dans les coupons. */
  provider?: 'api-football' | 'thesportsdb';
  providerEventId?: string;
  /** Marchés bruts renvoyés par le flux live d'API-Football. */
  providerMarkets?: BetProviderMarket[];
  liveOddsUpdatedAt?: string;
  liveOddsStatus?: { stopped?: boolean; blocked?: boolean; finished?: boolean };
  /** Cotes 1X2 stables du match, indépendantes de la sélection actuellement au coupon. */
  marketOdds?: { v1?: number; draw?: number; v2?: number };
  /** Cotes secondaires réellement retournées par The Odds API, par ligne de marché. */
  marketLines?: {
    totals?: Array<{ point: number; over?: number; under?: number }>;
    spreads?: Array<{ point: number; home?: number; away?: number }>;
    homeTeamTotals?: Array<{ point: number; over?: number; under?: number }>;
    awayTeamTotals?: Array<{ point: number; over?: number; under?: number }>;
  };
  /** Marchés additionnels réellement retournés par un fournisseur. */
  additionalOdds?: { btts?: { yes?: number; no?: number }; drawNoBet?: { home?: number; away?: number }; doubleChance?: { oneX?: number; oneTwo?: number; xTwo?: number } };
  /** Fournisseur des cotes réelles éventuelles; les secours générés sont stables et marqués séparément en code. */
  oddsProvider?: 'the-odds-api';
  betType: string; // e.g. "1X2. V2"
  odd: number;
  status: BetStatus;
  score?: string; // e.g. "2 - 1" or "0 - 0"
  scorePeriod1?: string;
  scorePeriod2?: string;
  isLive?: boolean;
  liveTime?: string; // e.g. '45'' or 'En direct'
  liveStartedAt?: string;
  /** Numéro affiché dans « Informations supplémentaires » pour Mortal Kombat. */
  mortalKombatInfoNumber?: number;
  mortalKombatSimulation?: { durationMs: number; winner?: 1 | 2; rounds?: { team1: number; team2: number }; roundScores?: Array<{ team1: number; team2: number }> };
  /** Métadonnées de simulation locale réservées aux matchs FIFA. */
  scheduledAt?: string;
  pokerSimulation?: { durationMs: number };
  fifaSimulation?: {
    option: 'exact' | 'v1' | 'v2' | 'draw' | 'any';
    finalScore: { home: number; away: number };
    goals: Array<{ atMs: number; team: 1 | 2 }>;
    durationMs: number;
  };
}

export interface BetSlip {
  id: string;
  type: string; // e.g. "Combiné"
  date: string;
  eventCount: number;
  finishedCount: number;
  totalOdds: number;
  stake: number;
  potentialGain: number;
  status: BetStatus;
  events: BetEvent[];
  sellAmount?: number;
  code?: string;
  isDraft?: boolean;
  /** Affiche un coupon téléchargé avec le même rendu qu’un coupon créé. */
  isLoadedByCode?: boolean;
}
