/**
 * Catalogue local indépendant des services sportifs.
 * Le gros index est servi comme fichier statique et chargé uniquement lorsque
 * l’utilisateur ouvre la recherche des clubs, afin de préserver le démarrage.
 */
export type LocalClub = {
  id: string;
  name: string;
  country: string;
  league: string;
  logoUrl: string;
  source: 'bundled-pack';
};

// Compteur du pack fourni; l’index reste chargé à la demande pour ne pas
// alourdir le bundle initial.
export const LOCAL_CLUB_CATALOG_COUNT = 4678;

let catalogPromise: Promise<LocalClub[]> | null = null;
const localSearchKeys = new WeakMap<LocalClub, string>();

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export async function loadLocalClubCatalog(): Promise<LocalClub[]> {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      fetch('/data/club-logos-index.json').then(async (response) => {
        if (!response.ok) throw new Error(`Catalogue des clubs indisponible (${response.status})`);
        return await response.json() as LocalClub[];
      }),
      import('@/constants/internalFixtureCatalog').then(({ loadClubLeagueRecords }) => loadClubLeagueRecords()).catch(() => []),
    ]).then(([entries, mappedClubs]) => {
      const leagueById = new Map(mappedClubs.map((club) => [club.id, club.league]));
      return entries
        .filter((club) => club.id && club.name && club.logoUrl && normalize(club.country) !== 'tournaments')
        .map((club) => {
          const prepared = { ...club, league: leagueById.get(club.id) || '', source: 'bundled-pack' as const };
          localSearchKeys.set(prepared, normalize(`${prepared.name} ${prepared.country} ${prepared.league}`));
          return prepared;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    })
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }
  return catalogPromise;
}

export function searchLocalClubs(catalog: LocalClub[], query: string): LocalClub[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return catalog;
  return catalog.filter((club) => (localSearchKeys.get(club) || normalize(`${club.name} ${club.country} ${club.league}`)).includes(normalizedQuery));
}
