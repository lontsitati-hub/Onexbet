export interface SportsLeague {
  idLeague: string;
  strLeague: string;
  strSport: string;
  strCountry?: string;
  strCurrentSeason?: string;
  strBadge?: string;
  strLogo?: string;
}

export interface SportsEvent {
  idEvent: string;
  idLeague?: string;
  strLeague?: string;
  strSeason?: string;
  strEvent?: string;
  strTimestamp?: string;
  dateEvent?: string;
  strTime?: string;
  strStatus?: string;
  strProgress?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  intHomeScore?: string | number | null;
  intAwayScore?: string | number | null;
  strHomeTeamLogo?: string;
  strAwayTeamLogo?: string;
}

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/123';
const REQUEST_TIMEOUT_MS = 9000;
let leaguesCache: { expiresAt: number; value: SportsLeague[] } | null = null;
const eventsCache = new Map<string, { expiresAt: number; value: SportsEvent[] }>();

async function requestJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/${path}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Sports API HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFootballLeagues(): Promise<SportsLeague[]> {
  if (leaguesCache && leaguesCache.expiresAt > Date.now()) return leaguesCache.value;
  const [detailsResult, basicResult] = await Promise.allSettled([
    requestJson<{ countries?: SportsLeague[] }>('search_all_leagues.php?s=Soccer'),
    requestJson<{ leagues?: SportsLeague[] }>('all_leagues.php'),
  ]);
  const detailed = detailsResult.status === 'fulfilled' ? detailsResult.value.countries || [] : [];
  const basic = basicResult.status === 'fulfilled' ? basicResult.value.leagues || [] : [];
  const byId = new Map<string, SportsLeague>();
  [...basic, ...detailed].filter((league) => league.strSport?.toLowerCase() === 'soccer').forEach((league) => {
    byId.set(league.idLeague, { ...byId.get(league.idLeague), ...league });
  });
  const value = Array.from(byId.values());
  if (value.length === 0) throw new Error('Aucune ligue de football disponible');
  leaguesCache = { expiresAt: Date.now() + 15 * 60 * 1000, value };
  return value;
}

export async function fetchLiveFootballEvents(): Promise<SportsEvent[]> {
  const data = await requestJson<{ events?: SportsEvent[] }>('livescore/soccer');
  return data.events || [];
}

export async function fetchLeagueEvents(leagueId: string): Promise<SportsEvent[]> {
  const cached = eventsCache.get(leagueId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const data = await requestJson<{ events?: SportsEvent[] }>(`eventsnextleague.php?id=${encodeURIComponent(leagueId)}`);
  const value = data.events || [];
  eventsCache.set(leagueId, { expiresAt: Date.now() + 5 * 60 * 1000, value });
  return value;
}
