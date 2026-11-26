import {
  fetchFootballLeagues as fetchLegacyFootballLeagues,
  fetchLeagueEvents as fetchLegacyLeagueEvents,
  fetchLiveFootballEvents as fetchLegacyLiveFootballEvents,
  SportsEvent as LegacySportsEvent,
  SportsLeague as LegacySportsLeague,
} from './sportsApi';
import { Platform } from 'react-native';
import type { BetProviderMarket } from '@/types/bet';

export interface SportsLeague extends LegacySportsLeague {
  provider?: 'api-football' | 'thesportsdb';
}

export interface SportsMarketLine {
  point: number;
  over?: number;
  under?: number;
  home?: number;
  away?: number;
}

export interface SportsEvent extends LegacySportsEvent {
  strCountry?: string;
  oddV1?: number;
  oddNul?: number;
  oddV2?: number;
  marketLines?: { totals?: SportsMarketLine[]; spreads?: SportsMarketLine[]; homeTeamTotals?: SportsMarketLine[]; awayTeamTotals?: SportsMarketLine[] };
  additionalOdds?: { btts?: { yes?: number; no?: number }; drawNoBet?: { home?: number; away?: number }; doubleChance?: { oneX?: number; oneTwo?: number; xTwo?: number } };
  providerMarkets?: BetProviderMarket[];
  provider?: 'api-football' | 'thesportsdb';
}

interface ApiEnvelope<T> {
  response?: T[];
  errors?: Record<string, unknown> | unknown[];
}
interface ApiFootballLeagueRow {
  league?: { id?: number; name?: string; logo?: string };
  country?: { name?: string; code?: string; flag?: string };
  seasons?: Array<{ year?: number; current?: boolean }>;
}
interface ApiFootballTeamRow {
  team?: { id?: number; name?: string; logo?: string; country?: string; code?: string; national?: boolean };
}
interface ApiFootballCountryRow {
  name?: string;
  code?: string;
  flag?: string;
}
interface ApiFootballFixtureRow {
  fixture?: { id?: number; date?: string; status?: { short?: string; long?: string; elapsed?: number | null; extra?: number | null } };
  league?: { id?: number; name?: string; country?: string; season?: number };
  teams?: { home?: { id?: number; name?: string; logo?: string }; away?: { id?: number; name?: string; logo?: string } };
  goals?: { home?: number | null; away?: number | null };
}
interface ApiFootballLiveOddsRow {
  fixture?: { id?: number; status?: { short?: string; long?: string; elapsed?: number | null; seconds?: string | null } };
  teams?: { home?: { name?: string; goals?: number | null }; away?: { name?: string; goals?: number | null } };
  status?: { stopped?: boolean; blocked?: boolean; finished?: boolean };
  update?: string;
  odds?: Array<{
    id?: number;
    name?: string;
    values?: Array<{ value?: string | number; odd?: string | number; handicap?: string | number | null; main?: boolean | null; suspended?: boolean }>;
  }>;
}
interface OddsSport {
  key: string;
  group?: string;
  title: string;
  active?: boolean;
}
interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}
interface OddsMarket {
  key: string;
  outcomes?: OddsOutcome[];
}
interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{ markets?: OddsMarket[] }>;
}

const API_FOOTBALL_KEY = Platform.OS === 'web' ? '' : process.env.EXPO_PUBLIC_API_FOOTBALL_KEY?.trim() || '';
const HAS_API_FOOTBALL_ACCESS = Platform.OS === 'web' || Boolean(API_FOOTBALL_KEY);
const THE_ODDS_API_KEY = process.env.EXPO_PUBLIC_THE_ODDS_API_KEY?.trim() || '';
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const REQUEST_TIMEOUT_MS = 9000;
const TIMEZONE = 'Africa/Douala';
const apiFootballCache = new Map<string, { expiresAt: number; value: unknown }>();
const oddsSportsCache: { expiresAt: number; value: OddsSport[] } = { expiresAt: 0, value: [] };
const oddsEventsCache = new Map<string, { expiresAt: number; value: OddsEvent[] }>();
const oddsEventMarketsCache = new Map<string, { expiresAt: number; value: OddsEvent | null }>();

async function requestJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`Sports API HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function hasApiErrors(errors: ApiEnvelope<unknown>['errors']) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  return Object.values(errors).some((value) => value !== null && value !== '' && value !== false);
}

async function apiFootballRequest<T>(path: string, cacheMs: number): Promise<T[]> {
  if (!HAS_API_FOOTBALL_ACCESS) throw new Error('API-Football key not configured');
  const cached = apiFootballCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T[];
  const requestUrl = Platform.OS === 'web' ? `/api/sports/football/${path}` : `${API_FOOTBALL_BASE}/${path}`;
  const headers: Record<string, string> = Platform.OS === 'web' ? {} : { 'x-apisports-key': API_FOOTBALL_KEY };
  const envelope = await requestJson<ApiEnvelope<T>>(requestUrl, headers);
  if (hasApiErrors(envelope.errors)) throw new Error('API-Football returned an error');
  const value = envelope.response || [];
  apiFootballCache.set(path, { expiresAt: Date.now() + cacheMs, value });
  return value;
}

function toApiFootballLeague(row: ApiFootballLeagueRow): SportsLeague | null {
  if (!row.league?.id || !row.league.name) return null;
  const season = row.seasons?.find((item) => item.current) || row.seasons?.[row.seasons.length - 1];
  return {
    idLeague: `apif:${row.league.id}`,
    strLeague: row.league.name,
    strSport: 'Soccer',
    strCountry: row.country?.name,
    strCurrentSeason: season?.year ? String(season.year) : undefined,
    strBadge: row.league.logo,
    strLogo: row.country?.flag,
    provider: 'api-football',
  };
}

function isApiFootballLiveStatus(status: string) {
  return /^(?:1H|HT|2H|ET|BT|P|LIVE|INT)$/i.test(status.trim());
}

function apiFootballDate(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
  const date = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + offsetDays));
  return date.toISOString().slice(0, 10);
}

async function fetchApiFootballRowsForNextTwoDates(): Promise<ApiFootballFixtureRow[]> {
  const requests = await Promise.allSettled([0, 1].map(async (offsetDays) => {
    const date = apiFootballDate(offsetDays);
    return apiFootballRequest<ApiFootballFixtureRow>(
      `fixtures?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(TIMEZONE)}`,
      5 * 60 * 1000,
    );
  }));
  const fixtures = new Map<number, ApiFootballFixtureRow>();
  requests.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn('API-Football fixtures par date indisponibles:', result.reason);
      return;
    }
    result.value.forEach((row) => {
      if (row.fixture?.id) fixtures.set(row.fixture.id, row);
    });
  });
  return Array.from(fixtures.values()).sort((left, right) =>
    String(left.fixture?.date || '').localeCompare(String(right.fixture?.date || '')),
  );
}

function toApiFootballEvent(row: ApiFootballFixtureRow): SportsEvent | null {
  const fixture = row.fixture;
  const home = row.teams?.home;
  const away = row.teams?.away;
  if (!fixture?.id || !home?.name || !away?.name) return null;
  const date = fixture.date || '';
  const code = fixture.status?.short || '';
  const live = isApiFootballLiveStatus(code);
  const elapsed = fixture.status?.elapsed;
  return {
    idEvent: String(fixture.id),
    idLeague: row.league?.id ? `apif:${row.league.id}` : undefined,
    strLeague: row.league?.name || 'Football',
    strCountry: row.league?.country,
    strSeason: row.league?.season ? String(row.league.season) : undefined,
    strEvent: `${home.name} vs ${away.name}`,
    strTimestamp: date,
    dateEvent: date.slice(0, 10),
    strTime: date.slice(11, 16),
    strStatus: live ? 'LIVE' : code,
    strProgress: live ? (elapsed === null || elapsed === undefined ? fixture.status?.long || 'En direct' : `${elapsed}${fixture.status?.extra ? `+${fixture.status.extra}` : ''}'`) : fixture.status?.long,
    strHomeTeam: home.name,
    strAwayTeam: away.name,
    idHomeTeam: home.id ? String(home.id) : undefined,
    idAwayTeam: away.id ? String(away.id) : undefined,
    strHomeTeamBadge: home.logo,
    strAwayTeamBadge: away.logo,
    strHomeTeamLogo: home.logo,
    strAwayTeamLogo: away.logo,
    intHomeScore: row.goals?.home ?? null,
    intAwayScore: row.goals?.away ?? null,
    provider: 'api-football',
  };
}

function withLegacyLeagueProvider(leagues: LegacySportsLeague[]): SportsLeague[] {
  return leagues.map((league) => ({ ...league, idLeague: `tsdb:${league.idLeague}`, provider: 'thesportsdb' }));
}

export async function fetchFootballLeagues(): Promise<SportsLeague[]> {
  if (HAS_API_FOOTBALL_ACCESS) {
    try {
      const rows = await apiFootballRequest<ApiFootballLeagueRow>('leagues?current=true', 15 * 60 * 1000);
      const leagues = rows.map(toApiFootballLeague).filter((item): item is SportsLeague => Boolean(item));
      if (leagues.length > 0) return leagues;
      throw new Error('API-Football returned no active leagues');
    } catch (error) {
      console.warn('API-Football leagues indisponibles, repli TheSportsDB:', error);
    }
  }
  return withLegacyLeagueProvider(await fetchLegacyFootballLeagues());
}

export interface SportsTeamLogo {
  id: string;
  name: string;
  country?: string;
  logo?: string;
  national?: boolean;
}

export interface SportsCountryLogo {
  name: string;
  code?: string;
  flag?: string;
}

/** Search API-Football's complete team catalogue without exposing its key on Web. */
export async function searchApiFootballTeams(query: string): Promise<SportsTeamLogo[]> {
  const value = query.trim();
  if (value.length < 2) return [];
  try {
    const rows = await apiFootballRequest<ApiFootballTeamRow>(`teams?search=${encodeURIComponent(value)}`, 10 * 60 * 1000);
    return rows
      .map((row) => row.team)
      .filter((team): team is NonNullable<ApiFootballTeamRow['team']> => Boolean(team?.id && team.name))
      .map((team) => ({ id: String(team.id), name: team.name as string, country: team.country, logo: team.logo, national: team.national }));
  } catch (error) {
    console.warn('Recherche des clubs API-Football indisponible:', error);
    return [];
  }
}

/** Search API-Football's country catalogue, including the official flag URL. */
export async function searchApiFootballCountries(query: string): Promise<SportsCountryLogo[]> {
  const value = query.trim();
  if (value.length < 2) return [];
  try {
    const rows = await apiFootballRequest<ApiFootballCountryRow>(`countries?search=${encodeURIComponent(value)}`, 30 * 60 * 1000);
    return rows
      .filter((country): country is ApiFootballCountryRow & { name: string } => Boolean(country.name))
      .map((country) => ({ name: country.name, code: country.code, flag: country.flag }));
  } catch (error) {
    console.warn('Recherche des pays API-Football indisponible:', error);
    return [];
  }
}

export async function fetchLiveFootballEvents(): Promise<SportsEvent[]> {
  if (HAS_API_FOOTBALL_ACCESS) {
    try {
      const rows = await apiFootballRequest<ApiFootballFixtureRow>(`fixtures?live=all&timezone=${encodeURIComponent(TIMEZONE)}`, 20 * 1000);
      return rows.map(toApiFootballEvent).filter((item): item is SportsEvent => Boolean(item));
    } catch (error) {
      console.warn('API-Football live indisponible, repli TheSportsDB:', error);
    }
  }
  return (await fetchLegacyLiveFootballEvents()).map((event) => ({ ...event, provider: 'thesportsdb' }));
}

export interface ApiFootballLiveOddsSnapshot {
  fixtureId: string;
  providerMarkets: BetProviderMarket[];
  marketOdds?: { v1?: number; draw?: number; v2?: number };
  score?: string;
  liveTime?: string;
  status?: { stopped?: boolean; blocked?: boolean; finished?: boolean };
  updatedAt?: string;
}

/** Fetch one selected live match's in-play prices; endpoint cache is 60s to protect the Free quota. */
export async function fetchLiveFootballOddsForFixture(fixtureId: string): Promise<ApiFootballLiveOddsSnapshot | null> {
  const safeFixtureId = String(fixtureId || '').replace(/\D/g, '');
  if (!HAS_API_FOOTBALL_ACCESS || !safeFixtureId) return null;
  try {
    const rows = await apiFootballRequest<ApiFootballLiveOddsRow>(`odds/live?fixture=${encodeURIComponent(safeFixtureId)}`, 60 * 1000);
    const row = rows.find((item) => String(item.fixture?.id || '') === safeFixtureId);
    if (!row) return null;
    const providerMarkets: BetProviderMarket[] = (row.odds || []).flatMap((market) => {
      if (!market.name) return [];
      const values = (market.values || []).flatMap((item) => {
        if (item.value === undefined || item.value === null) return [];
        const odd = Number(item.odd);
        return [{
          value: String(item.value),
          ...(Number.isFinite(odd) ? { odd } : {}),
          ...(item.handicap !== undefined ? { handicap: item.handicap === null ? null : String(item.handicap) } : {}),
          ...(item.main !== undefined ? { main: item.main } : {}),
          ...(item.suspended !== undefined ? { suspended: item.suspended } : {}),
        }];
      });
      return values.length ? [{ ...(market.id ? { id: market.id } : {}), name: market.name, values }] : [];
    });

    const homeName = normalize(row.teams?.home?.name);
    const awayName = normalize(row.teams?.away?.name);
    const marketOdds: { v1?: number; draw?: number; v2?: number } = {};
    const resultMarket = providerMarkets.find((market) => /\b1x2\b|match winner|match result|full time result|fulltime result/i.test(market.name));
    for (const outcome of resultMarket?.values || []) {
      const value = normalize(outcome.value);
      if (!Number.isFinite(outcome.odd) || Number(outcome.odd) <= 1 || outcome.suspended) continue;
      if (['1', 'home', 'home win', 'team 1'].includes(value) || (homeName && value === homeName)) marketOdds.v1 = Math.max(marketOdds.v1 || 0, Number(outcome.odd));
      else if (['x', 'draw', 'tie', 'the draw'].includes(value)) marketOdds.draw = Math.max(marketOdds.draw || 0, Number(outcome.odd));
      else if (['2', 'away', 'away win', 'team 2'].includes(value) || (awayName && value === awayName)) marketOdds.v2 = Math.max(marketOdds.v2 || 0, Number(outcome.odd));
    }
    const liveStatus = row.fixture?.status;
    const score = Number.isFinite(row.teams?.home?.goals) && Number.isFinite(row.teams?.away?.goals)
      ? `${row.teams?.home?.goals} - ${row.teams?.away?.goals}`
      : undefined;
    return {
      fixtureId: safeFixtureId,
      providerMarkets,
      ...(Object.keys(marketOdds).length ? { marketOdds } : {}),
      ...(score ? { score } : {}),
      ...(liveStatus?.seconds || liveStatus?.elapsed !== undefined ? { liveTime: liveStatus.seconds || `${liveStatus.elapsed ?? ''}'` } : {}),
      ...(row.status ? { status: row.status } : {}),
      ...(row.update ? { updatedAt: row.update } : {}),
    };
  } catch (error) {
    console.warn('API-Football cotes live indisponibles:', error);
    return null;
  }
}

export async function fetchUpcomingFootballEvents(): Promise<SportsEvent[]> {
  if (!HAS_API_FOOTBALL_ACCESS) return [];
  try {
    const now = Date.now();
    const rows = await fetchApiFootballRowsForNextTwoDates();
    return rows
      .filter((row) => {
        const status = String(row.fixture?.status?.short || '').toUpperCase();
        const kickoff = Date.parse(row.fixture?.date || '');
        return (status === 'NS' || status === 'TBD') && Number.isFinite(kickoff) && kickoff > now;
      })
      .map(toApiFootballEvent)
      .filter((item): item is SportsEvent => Boolean(item));
  } catch (error) {
    console.warn('API-Football avant-match indisponible:', error);
    return [];
  }
}

export async function fetchLeagueEvents(leagueId: string): Promise<SportsEvent[]> {
  if (leagueId.startsWith('apif:')) {
    if (!HAS_API_FOOTBALL_ACCESS) return [];
    try {
      const id = leagueId.slice('apif:'.length);
      const now = Date.now();
      const rows = await fetchApiFootballRowsForNextTwoDates();
      return rows
        .filter((row) => String(row.league?.id || '') === id)
        .filter((row) => {
          const status = String(row.fixture?.status?.short || '').toUpperCase();
          if (isApiFootballLiveStatus(status)) return true;
          const kickoff = Date.parse(row.fixture?.date || '');
          return (status === 'NS' || status === 'TBD') && Number.isFinite(kickoff) && kickoff >= now;
        })
        .map(toApiFootballEvent)
        .filter((item): item is SportsEvent => Boolean(item));
    } catch (error) {
      console.warn('API-Football matchs de championnat indisponibles:', error);
      return [];
    }
  }
  const legacyId = leagueId.replace(/^tsdb:/, '');
  return (await fetchLegacyLeagueEvents(legacyId)).map((event) => ({ ...event, provider: 'thesportsdb', idLeague: event.idLeague || `tsdb:${legacyId}` }));
}

const normalize = (value: string | undefined) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const normalizeTeam = (value: string) => normalize(value).replace(/\b(fc|cf|sc|afc|club|football|soccer)\b/g, ' ').replace(/\s+/g, ' ').trim();

function teamsMatch(left: string, right: string) {
  const a = normalizeTeam(left);
  const b = normalizeTeam(right);
  return Boolean(a && b && (a === b || (Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a)))));
}

function resolveOddsSport(leagueName: string, country: string | undefined, sports: OddsSport[]) {
  const league = normalize(leagueName);
  const countryName = normalize(country);
  const aliasTargets: Array<{ league: RegExp; country?: RegExp; key: string }> = [
    { league: /\b(premier league|english premier league|epl)\b/, country: /england/, key: 'soccer_epl' },
    { league: /\bwomen(?: s)?\b.*\bchampions league\b|\bchampions league\b.*\bwomen\b/, key: 'soccer_uefa_champs_league_women' },
    { league: /\b(uefa )?champions league\b/, key: 'soccer_uefa_champs_league' },
    { league: /\b(uefa )?europa league\b/, key: 'soccer_uefa_europa_league' },
    { league: /\b(uefa )?nations league\b/, key: 'soccer_uefa_nations_league' },
    { league: /\bla liga\b/, key: 'soccer_spain_la_liga' },
    { league: /\bfrauen bundesliga\b|\bbundesliga women\b/, key: 'soccer_germany_bundesliga_women' },
    { league: /\bbundesliga\b/, country: /germany/, key: 'soccer_germany_bundesliga' },
    { league: /\bserie a\b/, country: /italy/, key: 'soccer_italy_serie_a' },
    { league: /\bligue 1\b/, country: /france/, key: 'soccer_france_ligue_one' },
  ];
  const alias = aliasTargets.find((item) => item.league.test(league) && (!item.country || item.country.test(countryName)));
  if (alias && sports.some((sport) => sport.key === alias.key)) return alias.key;
  const candidates = sports.filter((sport) => sport.key.startsWith('soccer_') && sport.active !== false);
  const exact = candidates.find((sport) => normalize(sport.title) === league);
  if (exact) return exact.key;
  const contains = candidates.find((sport) => {
    const title = normalize(sport.title);
    const key = normalize(sport.key.replace(/^soccer_/, '').replace(/_/g, ' '));
    return title.length > 3 && (title.includes(league) || league.includes(title) || key.includes(league) || league.includes(key));
  });
  if (contains) return contains.key;
  const tokens = league.split(' ').filter((word) => word.length > 2 && !['the', 'league', 'cup', 'soccer', 'football', 'uefa', 'caf', 'afc'].includes(word));
  if (tokens.length === 0) return undefined;
  const scored = candidates.map((sport) => {
    const text = `${normalize(sport.title)} ${normalize(sport.key.replace(/_/g, ' '))}`;
    const overlap = tokens.filter((token) => text.includes(token)).length;
    const countryMatch = countryName && text.includes(countryName) ? 1 : 0;
    return { key: sport.key, score: overlap / tokens.length + countryMatch * 0.25 };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 0.75 ? scored[0].key : undefined;
}

async function fetchOddsSports(): Promise<OddsSport[]> {
  if (!THE_ODDS_API_KEY) throw new Error('The Odds API key not configured');
  if (oddsSportsCache.expiresAt > Date.now()) return oddsSportsCache.value;
  const data = await requestJson<OddsSport[]>(`${THE_ODDS_API_BASE}/sports?apiKey=${encodeURIComponent(THE_ODDS_API_KEY)}`);
  const value = Array.isArray(data) ? data : [];
  oddsSportsCache.value = value;
  oddsSportsCache.expiresAt = Date.now() + 15 * 60 * 1000;
  return value;
}

async function fetchOddsForSport(sportKey: string, detailed: boolean): Promise<OddsEvent[]> {
  const markets = detailed ? 'h2h,spreads,totals' : 'h2h';
  const cacheKey = `${sportKey}|${markets}`;
  const cached = oddsEventsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const oddsUrl = (requestedMarkets: string) => `${THE_ODDS_API_BASE}/sports/${encodeURIComponent(sportKey)}/odds?apiKey=${encodeURIComponent(THE_ODDS_API_KEY)}&regions=eu&markets=${encodeURIComponent(requestedMarkets)}&oddsFormat=decimal`;
  let result: OddsEvent[];
  try {
    result = await requestJson<OddsEvent[]>(oddsUrl(markets));
  } catch (error) {
    if (!detailed) throw error;
    result = await requestJson<OddsEvent[]>(oddsUrl('h2h'));
  }
  const value = Array.isArray(result) ? result : [];
  oddsEventsCache.set(cacheKey, { expiresAt: Date.now() + 2 * 60 * 1000, value });
  return value;
}

function findMatchingOddsEvent(fixture: SportsEvent, oddsEvents: OddsEvent[]) {
  const homeName = fixture.strHomeTeam || '';
  const awayName = fixture.strAwayTeam || '';
  const fixtureTime = new Date(fixture.strTimestamp || `${fixture.dateEvent || ''}T${fixture.strTime || '00:00:00'}Z`).getTime();
  return oddsEvents.find((event) => {
    const direct = teamsMatch(homeName, event.home_team) && teamsMatch(awayName, event.away_team);
    const reverse = teamsMatch(homeName, event.away_team) && teamsMatch(awayName, event.home_team);
    if (!direct && !reverse) return false;
    const oddsTime = new Date(event.commence_time).getTime();
    return !Number.isFinite(fixtureTime) || !Number.isFinite(oddsTime) || Math.abs(fixtureTime - oddsTime) <= 8 * 60 * 60 * 1000;
  });
}

function bestPricesForFixture(fixture: SportsEvent, oddsEvents: OddsEvent[]) {
  const homeName = fixture.strHomeTeam || '';
  const awayName = fixture.strAwayTeam || '';
  const matched = findMatchingOddsEvent(fixture, oddsEvents);
  if (!matched) return null;
  const reversed = teamsMatch(homeName, matched.away_team) && teamsMatch(awayName, matched.home_team);
  const prices = { home: undefined as number | undefined, draw: undefined as number | undefined, away: undefined as number | undefined };
  const totals = new Map<number, SportsMarketLine>();
  const spreads = new Map<number, SportsMarketLine>();
  const homeTeamTotals = new Map<number, SportsMarketLine>();
  const awayTeamTotals = new Map<number, SportsMarketLine>();
  const btts = { yes: undefined as number | undefined, no: undefined as number | undefined };
  const drawNoBet = { home: undefined as number | undefined, away: undefined as number | undefined };
  for (const bookmaker of matched.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      for (const outcome of market.outcomes || []) {
        const price = Number(outcome.price);
        if (!Number.isFinite(price) || price <= 1) continue;
        const name = normalize(outcome.name);
        if (market.key === 'h2h') {
          if (/^(draw|tie|empate|match nul|nul|x)$/.test(name)) prices.draw = Math.max(prices.draw || 0, price);
          else if (teamsMatch(outcome.name, matched.home_team)) prices.home = Math.max(prices.home || 0, price);
          else if (teamsMatch(outcome.name, matched.away_team)) prices.away = Math.max(prices.away || 0, price);
        } else if ((market.key === 'totals' || market.key === 'alternate_totals') && Number.isFinite(Number(outcome.point))) {
          const point = Number(outcome.point);
          const line = totals.get(point) || { point };
          if (/^over/.test(name)) line.over = Math.max(line.over || 0, price);
          if (/^under/.test(name)) line.under = Math.max(line.under || 0, price);
          totals.set(point, line);
        } else if ((market.key === 'spreads' || market.key === 'alternate_spreads') && Number.isFinite(Number(outcome.point))) {
          const point = Number(outcome.point);
          const line = spreads.get(point) || { point };
          if (teamsMatch(outcome.name, matched.home_team)) line.home = Math.max(line.home || 0, price);
          else if (teamsMatch(outcome.name, matched.away_team)) line.away = Math.max(line.away || 0, price);
          spreads.set(point, line);
        } else if (market.key === 'btts') {
          if (name === 'yes') btts.yes = Math.max(btts.yes || 0, price);
          if (name === 'no') btts.no = Math.max(btts.no || 0, price);
        } else if (market.key === 'draw_no_bet') {
          if (teamsMatch(outcome.name, matched.home_team)) drawNoBet.home = Math.max(drawNoBet.home || 0, price);
          else if (teamsMatch(outcome.name, matched.away_team)) drawNoBet.away = Math.max(drawNoBet.away || 0, price);
        } else if (market.key === 'team_totals' && Number.isFinite(Number(outcome.point))) {
          const teamName = outcome.description || '';
          const side = teamsMatch(teamName, matched.home_team) ? 'home' : teamsMatch(teamName, matched.away_team) ? 'away' : undefined;
          if (!side) continue;
          const point = Number(outcome.point);
          const lines = side === 'home' ? homeTeamTotals : awayTeamTotals;
          const line = lines.get(point) || { point };
          if (/^over/.test(name)) line.over = Math.max(line.over || 0, price);
          if (/^under/.test(name)) line.under = Math.max(line.under || 0, price);
          lines.set(point, line);
        }
      }
    }
  }
  const mapLines = (lines: Map<number, SportsMarketLine>) => Array.from(lines.values()).sort((a, b) => a.point - b.point).filter((line) => line.over || line.under || line.home || line.away);
  const spreadLines = Array.from(spreads.values()).map((line) => reversed ? { point: -line.point, home: line.away, away: line.home } : line).sort((a, b) => Math.abs(a.point) - Math.abs(b.point));
  const additionalOdds = {
    ...(btts.yes || btts.no ? { btts } : {}),
    ...(drawNoBet.home || drawNoBet.away ? { drawNoBet: reversed ? { home: drawNoBet.away, away: drawNoBet.home } : drawNoBet } : {}),
  };
  return {
    oddV1: reversed ? prices.away : prices.home,
    oddNul: prices.draw,
    oddV2: reversed ? prices.home : prices.away,
    marketLines: {
      totals: mapLines(totals),
      spreads: spreadLines.filter((line) => line.home || line.away),
      ...((reversed ? mapLines(awayTeamTotals) : mapLines(homeTeamTotals)).length ? { homeTeamTotals: reversed ? mapLines(awayTeamTotals) : mapLines(homeTeamTotals) } : {}),
      ...((reversed ? mapLines(homeTeamTotals) : mapLines(awayTeamTotals)).length ? { awayTeamTotals: reversed ? mapLines(homeTeamTotals) : mapLines(awayTeamTotals) } : {}),
    },
    ...(Object.keys(additionalOdds).length ? { additionalOdds } : {}),
  };
}

function mergeLines(...lists: Array<SportsMarketLine[] | undefined>) {
  const merged = new Map<number, SportsMarketLine>();
  lists.flatMap((list) => list || []).forEach((line) => {
    if (!Number.isFinite(line.point)) return;
    const current = merged.get(line.point) || { point: line.point };
    merged.set(line.point, { ...current, ...line, point: line.point });
  });
  return Array.from(merged.values()).sort((a, b) => Math.abs(a.point) - Math.abs(b.point));
}

function mergeMarketLines(base?: SportsEvent['marketLines'], extra?: SportsEvent['marketLines']): SportsEvent['marketLines'] {
  const totals = mergeLines(base?.totals, extra?.totals);
  const spreads = mergeLines(base?.spreads, extra?.spreads);
  const homeTeamTotals = mergeLines(base?.homeTeamTotals, extra?.homeTeamTotals);
  const awayTeamTotals = mergeLines(base?.awayTeamTotals, extra?.awayTeamTotals);
  const merged = {
    ...(totals.length ? { totals } : {}),
    ...(spreads.length ? { spreads } : {}),
    ...(homeTeamTotals.length ? { homeTeamTotals } : {}),
    ...(awayTeamTotals.length ? { awayTeamTotals } : {}),
  };
  return Object.keys(merged).length ? merged : undefined;
}

function mergeAdditionalOdds(base?: SportsEvent['additionalOdds'], extra?: SportsEvent['additionalOdds']): SportsEvent['additionalOdds'] {
  const btts = { ...base?.btts, ...extra?.btts };
  const drawNoBet = { ...base?.drawNoBet, ...extra?.drawNoBet };
  const merged = {
    ...(btts.yes || btts.no ? { btts } : {}),
    ...(drawNoBet.home || drawNoBet.away ? { drawNoBet } : {}),
  };
  return Object.keys(merged).length ? merged : undefined;
}

async function fetchAdditionalOddsForEvent(sportKey: string, eventId: string): Promise<OddsEvent | null> {
  if (!THE_ODDS_API_KEY) return null;
  const cacheKey = `${sportKey}|${eventId}`;
  const cached = oddsEventMarketsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const markets = 'alternate_spreads,alternate_totals,btts,draw_no_bet,team_totals';
  const url = `${THE_ODDS_API_BASE}/sports/${encodeURIComponent(sportKey)}/events/${encodeURIComponent(eventId)}/odds?apiKey=${encodeURIComponent(THE_ODDS_API_KEY)}&regions=eu&markets=${encodeURIComponent(markets)}&oddsFormat=decimal`;
  const data = await requestJson<OddsEvent | OddsEvent[]>(url);
  const value = Array.isArray(data) ? data[0] || null : data || null;
  oddsEventMarketsCache.set(cacheKey, { expiresAt: Date.now() + 60 * 1000, value });
  return value;
}

/** The Odds API enrichment is intentionally separate from fixture/league loading. */
export async function fetchOddsForEvents(events: SportsEvent[], options: { detailed?: boolean } = {}): Promise<SportsEvent[]> {
  if (!THE_ODDS_API_KEY || events.length === 0) return events;
  try {
    const sports = await fetchOddsSports();
    const keys = Array.from(new Set(events.map((event) => resolveOddsSport(event.strLeague || '', event.strCountry, sports)).filter((key): key is string => Boolean(key))));
    if (keys.length === 0) return events;
    const requestedKeys = keys.slice(0, 8);
    const results = await Promise.allSettled(requestedKeys.map(async (key) => ({ key, events: await fetchOddsForSport(key, Boolean(options.detailed)) })));
    const oddsBySport = new Map<string, OddsEvent[]>();
    results.forEach((result) => {
      if (result.status === 'fulfilled') oddsBySport.set(result.value.key, result.value.events);
      else console.warn('The Odds API indisponible pour un championnat:', result.reason);
    });
    return Promise.all(events.map(async (event) => {
      const sportKey = resolveOddsSport(event.strLeague || '', event.strCountry, sports);
      const quotes = sportKey ? oddsBySport.get(sportKey) : undefined;
      if (!quotes) return event;
      const matched = findMatchingOddsEvent(event, quotes);
      const price = matched ? bestPricesForFixture(event, [matched]) : null;
      let enriched = price ? { ...event, ...price } : event;
      if (options.detailed && events.length === 1 && matched?.id && sportKey) {
        try {
          const extraEvent = await fetchAdditionalOddsForEvent(sportKey, matched.id);
          const extra = extraEvent ? bestPricesForFixture(event, [extraEvent]) : null;
          if (extra) {
            const marketLines = mergeMarketLines(enriched.marketLines, extra.marketLines);
            const additionalOdds = mergeAdditionalOdds(enriched.additionalOdds, extra.additionalOdds);
            enriched = { ...enriched, ...(marketLines ? { marketLines } : {}), ...(additionalOdds ? { additionalOdds } : {}) };
          }
        } catch (error) {
          console.warn('Marchés supplémentaires indisponibles pour ce match:', error);
        }
      }
      return enriched;
    }));
  } catch (error) {
    console.warn('The Odds API indisponible, matchs conservés sans cotes:', error);
    return events;
  }
}
