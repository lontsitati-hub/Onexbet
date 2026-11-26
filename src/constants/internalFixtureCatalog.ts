export interface ClubLeagueRecord {
  id: string;
  name: string;
  country: string;
  league: string;
  logoUrl: string;
  wikidataClubId?: string;
  wikidataLeagueId?: string;
}

export interface InternalFixtureGroup {
  id: string;
  country: string;
  league: string;
  teams: ClubLeagueRecord[];
  pairCount: number;
}

export interface InternalFixturePair {
  id: string;
  country: string;
  league: string;
  homeTeam: ClubLeagueRecord;
  awayTeam: ClubLeagueRecord;
}

interface ClubLeaguePayload {
  records?: ClubLeagueRecord[];
}

// Sélection éditoriale toujours disponible, même lorsque le catalogue distant
// est incomplet : grands clubs européens et sélections nationales avec leurs
// écussons/étendards pour créer rapidement des affiches réalistes.
const FEATURED_RECORDS: ClubLeagueRecord[] = [
  ['Premier League', 'England', [['Arsenal', 42], ['Chelsea', 38], ['Liverpool', 44], ['Manchester City', 17]]],
  ['La Liga', 'Spain', [['Real Madrid', 2825], ['Barcelona', 2817], ['Atlético Madrid', 2836], ['Sevilla', 2833]]],
  ['Ligue 1', 'France', [['Paris Saint-Germain', 1644], ['Olympique de Marseille', 1641], ['Olympique Lyonnais', 1640], ['AS Monaco', 1643]]],
  ['Bundesliga', 'Germany', [['Bayern München', 2672], ['Borussia Dortmund', 2673], ['Bayer Leverkusen', 2674], ['RB Leipzig', 2675]]],
  ['Serie A', 'Italy', [['Juventus', 2687], ['Inter', 2697], ['AC Milan', 2695], ['Napoli', 2714]]],
].flatMap(([league, country, teams]) => (teams as Array<[string, number]>).map(([name, teamId]) => ({
  id: `featured-${String(country).toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name,
  country: String(country),
  league: String(league),
  logoUrl: `https://api.sofascore.app/api/v1/team/${teamId}/image/medium`,
})));

const NATIONAL_RECORDS: ClubLeagueRecord[] = [
  ['Coupe d’Afrique des Nations', 'Afrique', [['Côte d’Ivoire', 'ci'], ['Sénégal', 'sn'], ['Maroc', 'ma'], ['Nigeria', 'ng'], ['Cameroun', 'cm'], ['Égypte', 'eg']]],
  ['Championnat d’Europe des Nations (Euro)', 'Europe', [['France', 'fr'], ['Espagne', 'es'], ['Allemagne', 'de'], ['Angleterre', 'gb'], ['Portugal', 'pt'], ['Italie', 'it']]],
  ['Coupe d’Asie des Nations', 'Asie', [['Japon', 'jp'], ['Corée du Sud', 'kr'], ['Australie', 'au'], ['Arabie saoudite', 'sa'], ['Iran', 'ir'], ['Qatar', 'qa']]],
  ['Coupe du monde', 'Monde', [['Brésil', 'br'], ['Argentine', 'ar'], ['France', 'fr'], ['Allemagne', 'de'], ['Espagne', 'es'], ['Portugal', 'pt']]],
].flatMap(([league, country, teams]) => (teams as Array<[string, string]>).map(([name, code]) => ({
  id: `national-${String(league).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${code}`,
  name,
  country: String(country),
  league: String(league),
  logoUrl: `https://flagcdn.com/w80/${code}.png`,
})));

let recordsPromise: Promise<ClubLeagueRecord[]> | null = null;

const normalize = (value: string) => value
  .toLocaleLowerCase('fr-FR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function buildInternalFixtureGroups(records: ClubLeagueRecord[]): InternalFixtureGroup[] {
  const grouped = new Map<string, { country: string; league: string; teams: ClubLeagueRecord[] }>();
  const seenIds = new Set<string>();

  for (const record of records) {
    if (!record.id || !record.name || !record.country || !record.league || !record.logoUrl) continue;
    if (normalize(record.country) === 'tournaments' || seenIds.has(record.id)) continue;
    seenIds.add(record.id);

    const id = `${record.country.trim()}::${record.league.trim()}`;
    const group = grouped.get(id) || { country: record.country.trim(), league: record.league.trim(), teams: [] };
    group.teams.push(record);
    grouped.set(id, group);
  }

  return Array.from(grouped.entries())
    .map(([id, group]) => {
      const teams = group.teams.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
      return { id, country: group.country, league: group.league, teams, pairCount: getInternalFixturePairCount(teams.length) };
    })
    .filter((group) => group.teams.length >= 2)
    .sort((a, b) => a.country.localeCompare(b.country, 'fr') || a.league.localeCompare(b.league, 'fr'));
}

export function getInternalFixturePairCount(teamCount: number): number {
  const safeCount = Math.max(0, Math.floor(teamCount));
  return (safeCount * (safeCount - 1)) / 2;
}

export function buildInternalFixturePairs(group: InternalFixtureGroup): InternalFixturePair[] {
  const pairs: InternalFixturePair[] = [];
  for (let homeIndex = 0; homeIndex < group.teams.length; homeIndex += 1) {
    for (let awayIndex = homeIndex + 1; awayIndex < group.teams.length; awayIndex += 1) {
      const homeTeam = group.teams[homeIndex];
      const awayTeam = group.teams[awayIndex];
      if (homeTeam.id === awayTeam.id) continue;
      pairs.push({
        id: `${group.id}::${homeTeam.id}::${awayTeam.id}`,
        country: group.country,
        league: group.league,
        homeTeam,
        awayTeam,
      });
    }
  }
  return pairs;
}

export function searchInternalFixtureGroups(groups: InternalFixtureGroup[], query: string): InternalFixtureGroup[] {
  const search = normalize(query);
  if (!search) return groups;
  return groups.filter((group) => normalize(`${group.country} ${group.league} ${group.teams.map((team) => team.name).join(' ')}`).includes(search));
}

export function searchInternalFixturePairs(pairs: InternalFixturePair[], query: string): InternalFixturePair[] {
  const search = normalize(query);
  if (!search) return pairs;
  return pairs.filter((pair) => normalize(`${pair.country} ${pair.league} ${pair.homeTeam.name} ${pair.awayTeam.name}`).includes(search));
}

export function loadClubLeagueRecords(): Promise<ClubLeagueRecord[]> {
  if (!recordsPromise) {
    recordsPromise = fetch('/data/club-league-mappings.json')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Catalogue des championnats indisponible (${response.status})`);
        const payload = await response.json() as ClubLeaguePayload;
        return Array.isArray(payload.records) ? [...payload.records, ...FEATURED_RECORDS, ...NATIONAL_RECORDS] : [...FEATURED_RECORDS, ...NATIONAL_RECORDS];
      })
      .catch((error) => {
        recordsPromise = null;
        throw error;
      });
  }
  return recordsPromise;
}
