import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { AT } from '@/constants/adminTheme';
import { POPULAR_TEAMS_CATALOG, CatalogTeam } from '@/constants/teamLogos';
import { LOCAL_COUNTRY_NAMES } from '@/constants/localCountryFlags';
import { CircularFlag } from '@/components/CircularFlag';
import { CachedSvgLogo } from '@/components/CachedSvgLogo';
import { searchApiFootballCountries, searchApiFootballTeams } from '@/services/sportsDataApi';
import { loadLocalClubCatalog, LOCAL_CLUB_CATALOG_COUNT } from '@/constants/localClubCatalog';

interface LogoPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTeam: (teamName: string, logoUrlOrCode: string) => void;
  title?: string;
}

const officialBadgeCache = new Map<string, Promise<string | null>>();
let officialBadgeQueue: Promise<void> = Promise.resolve();

const normalizeTeamName = (name: string) => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(?:fc|cf|sk|jk|afc)\b/g, '')
  .replace(/[^a-z0-9]/g, '');

const normalizedTextCache = new Map<string, string>();
const normalizeSearchText = (value: string) => {
  const cached = normalizedTextCache.get(value);
  if (cached !== undefined) return cached;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (normalizedTextCache.size >= 6000) normalizedTextCache.clear();
  normalizedTextCache.set(value, normalized);
  return normalized;
};

const countrySearchMatches = (value: string, query: string) => {
  const name = normalizeSearchText(value);
  const q = normalizeSearchText(query);
  if (!q) return true;
  if (name.includes(q)) return true;
  return q.length >= 5 && name.slice(0, 5) === q.slice(0, 5);
};

const LOCAL_COUNTRY_CATALOG: CatalogTeam[] = Object.entries(LOCAL_COUNTRY_NAMES).map(([code, name]) => ({
  id: `local_country_${code}`,
  name,
  country: name,
  league: 'Pays et sélections nationales',
  logo: code,
  isCountry: true,
}));

const ALL_CATALOG_TEAMS = [
  ...POPULAR_TEAMS_CATALOG.flatMap((category) => category.teams),
  ...LOCAL_COUNTRY_CATALOG,
];

const fetchOfficialTeamBadge = (teamName: string): Promise<string | null> => {
  const key = normalizeTeamName(teamName);
  if (!key) return Promise.resolve(null);
  const cached = officialBadgeCache.get(key);
  if (cached) return cached;

  const request = new Promise<string | null>((resolve) => {
    const lookup = async () => {
      let badge: string | null = null;
      try {
        const response = await fetch(
          `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(teamName)}`,
          { headers: { Accept: 'application/json' } },
        );
        if (response.ok) {
          const data = await response.json();
          const teams = Array.isArray(data?.teams) ? data.teams : [];
          const match = teams.find((team: any) => normalizeTeamName(team.strTeam || '') === key)
            || (teams.length === 1 ? teams[0] : undefined);
          const candidate = match?.strBadge || match?.strTeamBadge;
          if (typeof candidate === 'string' && /^https:\/\//i.test(candidate)) badge = candidate;
        }
      } catch {
        // Si l’API ne fournit pas d’écusson, le visuel reste vide.
      }
      resolve(badge);
      await new Promise<void>((done) => setTimeout(done, 120));
    };
    officialBadgeQueue = officialBadgeQueue.then(lookup, lookup);
  });
  officialBadgeCache.set(key, request);
  return request;
};

const ApiTeamBadge: React.FC<{ teamName: string; size: number; apiLogo?: string }> = ({ teamName, size, apiLogo }) => {
  const [loadedBadge, setLoadedBadge] = useState<{ teamName: string; logo: string | null }>({ teamName: '', logo: null });
  const [failedLogo, setFailedLogo] = useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (apiLogo) return () => { active = false; };
    void fetchOfficialTeamBadge(teamName).then((badge) => {
      if (active) setLoadedBadge({ teamName, logo: badge });
    });
    return () => { active = false; };
  }, [teamName, apiLogo]);

  const logo = apiLogo ? (/^https:\/\//i.test(apiLogo) ? apiLogo : null) : loadedBadge.teamName === teamName ? loadedBadge.logo : null;
  if (!logo || failedLogo === logo) return <View style={{ width: size, height: size }} />;
  if (/\.svg(?:[?#]|$)/i.test(logo)) return <CachedSvgLogo uri={logo} width={size} height={size} />;
  return (
    <ExpoImage
      source={{ uri: logo }}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={80}
      onError={() => setFailedLogo(logo)}
    />
  );
};

export const LogoPickerModal: React.FC<LogoPickerModalProps> = ({
  visible,
  onClose,
  onSelectTeam,
  title = 'Sélectionner le logo de l\'équipe',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [apiResults, setApiResults] = useState<CatalogTeam[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [localPackTeams, setLocalPackTeams] = useState<CatalogTeam[]>([]);
  const [hasLoadedLocalPack, setHasLoadedLocalPack] = useState(false);
  const isLoadingLocalPack = visible && !hasLoadedLocalPack;
  const apiSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiSearchRequestId = React.useRef(0);

  React.useEffect(() => () => {
    if (apiSearchTimer.current) clearTimeout(apiSearchTimer.current);
    apiSearchRequestId.current += 1;
  }, []);

  React.useEffect(() => {
    if (!visible || hasLoadedLocalPack) return undefined;
    let mounted = true;
    void loadLocalClubCatalog().then((clubs) => {
      if (!mounted) return;
      setLocalPackTeams(clubs.map((club) => ({
        id: `pack_${club.id}`,
        name: club.name,
        country: club.country,
        league: club.league,
        logo: club.logoUrl,
        isCountry: false,
      })));
    }).catch((error) => {
      console.warn('Catalogue mondial local indisponible:', error);
    }).finally(() => {
      if (mounted) setHasLoadedLocalPack(true);
    });
    return () => { mounted = false; };
  }, [visible, hasLoadedLocalPack]);

  // Dynamic multi-API search function (TheSportsDB + Sofascore + ESPN) for any club worldwide in any division
  const searchNow = async (text: string, requestId: number) => {
    const q = text.trim();
    if (q.length >= 2) {
      setIsSearchingApi(true);
      try {
        const itemsMap = new Map<string, CatalogTeam>();

        // API-Football est la source prioritaire pour les écussons de clubs
        // et les drapeaux officiels des sélections nationales.
        const apiFootballPromise = (async () => {
          const [teams, countries] = await Promise.all([
            searchApiFootballTeams(q),
            searchApiFootballCountries(q),
          ]);
          for (const team of teams) {
            if (!team.logo) continue;
            itemsMap.set(`apif_${team.id}`, {
              id: `apif_${team.id}`,
              name: team.name,
              country: team.country || 'International',
              league: team.national ? 'Sélection nationale' : 'Football',
              logo: team.logo,
              isCountry: team.national,
            });
          }
          for (const country of countries) {
            if (!country.flag) continue;
            const id = `apif_country_${country.code || country.name}`;
            itemsMap.set(id, {
              id,
              name: `${country.name} (sélection)`,
              country: country.name,
              league: 'Sélections nationales',
              logo: country.flag,
              isCountry: true,
            });
          }
        })().catch((error) => {
          console.warn('API-Football search error:', error);
        });

        // 1. TheSportsDB API (High resolution official club crests & logos worldwide)
        const tsdbPromise = (async () => {
          try {
            const res = await fetch(
              `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(q)}`
            );
            if (res.ok) {
              const data = await res.json();
              if (data?.teams) {
                for (const t of data.teams) {
                  const logo = t.strBadge || t.strLogo;
                  if (t.strTeam && logo) {
                    const id = `tsdb_${t.idTeam}`;
                    itemsMap.set(id, {
                      id,
                      name: t.strTeam,
                      country: t.strCountry || 'International',
                      league: t.strLeague || 'Football',
                      logo,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.warn('TheSportsDB search error:', e);
          }
        })();

        // 2. ESPN Search API
        const espnPromise = (async () => {
          try {
            const espnUrl = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=30`;
            const res = await fetch(espnUrl, {
              headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
            });
            if (res.ok) {
              const data = await res.json();
              const cat = data.results?.find((r: any) => r.type === 'team');
              if (cat?.contents) {
                for (const item of cat.contents) {
                  if (item.sport === 'soccer' && item.displayName && item.image?.default) {
                    const id = `espn_${item.id || item.displayName}`;
                    if (!itemsMap.has(id)) {
                      itemsMap.set(id, {
                        id,
                        name: item.displayName,
                        country: item.subtitle || 'Club',
                        league: item.league || 'Football',
                        logo: item.image.default,
                      });
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn('ESPN search error:', e);
          }
        })();

        // 3. Sofascore API (Covers lower divisions and minor African/Asian/South American clubs)
        const sofaPromise = (async () => {
          try {
            const sofaRes = await fetch(
              `https://api.sofascore.com/api/v1/search/unique-teams?q=${encodeURIComponent(q)}`,
              { headers: { 'User-Agent': 'Mozilla/5.0' } }
            );
            if (sofaRes.ok) {
              const sofaData = await sofaRes.json();
              if (sofaData?.results) {
                for (const r of sofaData.results) {
                  if ((r.type === 'team' || r.type === 'unique-team') && r.entity?.name && r.entity?.id) {
                    const id = `sofa_${r.entity.id}`;
                    if (!itemsMap.has(id)) {
                      itemsMap.set(id, {
                        id,
                        name: r.entity.name,
                        country: r.entity.category?.name || 'Football',
                        league: r.entity.country?.name || 'Club',
                        logo: `https://api.sofascore.app/api/v1/team/${r.entity.id}/image`,
                      });
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Sofascore search error:', e);
          }
        })();

        await Promise.allSettled([apiFootballPromise, tsdbPromise, espnPromise, sofaPromise]);

        if (requestId === apiSearchRequestId.current) setApiResults(Array.from(itemsMap.values()));
      } catch {
        if (requestId === apiSearchRequestId.current) setApiResults([]);
      } finally {
        if (requestId === apiSearchRequestId.current) setIsSearchingApi(false);
      }
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setApiResults([]);
    if (apiSearchTimer.current) clearTimeout(apiSearchTimer.current);
    const requestId = ++apiSearchRequestId.current;
    if (text.trim().length < 2) {
      setIsSearchingApi(false);
      return;
    }
    setIsSearchingApi(true);
    apiSearchTimer.current = setTimeout(() => {
      apiSearchTimer.current = null;
      void searchNow(text, requestId);
    }, 300);
  };

  // Le pack local est toujours consultable sans appel API; les APIs enrichissent
  // uniquement les résultats de recherche qui ne sont pas déjà dans le pack.
  const allCatalogTeams = React.useMemo(() => [...localPackTeams, ...ALL_CATALOG_TEAMS], [localPackTeams]);

  const displayedTeams = React.useMemo(() => {
    if (searchQuery.trim().length >= 2 && apiResults.length > 0) {
      const localMatches = allCatalogTeams.filter((team) =>
        countrySearchMatches(team.name, searchQuery) ||
        countrySearchMatches(team.country, searchQuery) ||
        countrySearchMatches(team.league, searchQuery),
      );
      const apiIds = new Set(apiResults.map((item) => item.id));
      return [...apiResults, ...localMatches.filter((team) => !apiIds.has(team.id))];
    }

    let list = allCatalogTeams;
    if (activeCategory !== 'all') {
      const categoryObj = POPULAR_TEAMS_CATALOG.find((c) => c.id === activeCategory);
      if (categoryObj) list = categoryObj.teams;
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim();
      list = list.filter(
        (t) =>
          countrySearchMatches(t.name, q) ||
          countrySearchMatches(t.country, q) ||
          countrySearchMatches(t.league, q)
      );
    }
    return list;
  }, [searchQuery, activeCategory, apiResults, allCatalogTeams]);

  const isApiSearchResults = searchQuery.trim().length >= 2 && apiResults.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={s.modalRoot}>
        {/* Header */}
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeIconBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#E2E8F0" />
          </TouchableOpacity>

          <View style={s.headerTitleWrap}>
            <Text style={s.headerTitle}>{title}</Text>
            <Text style={s.headerSubtitle}>Moteur de recherche mondial (Toutes ligues & divisions)</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={s.searchContainer}>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={18} color={AT.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Chercher n&apos;importe quel club au monde (ex: Real, Bamboutos, Chelsea...)"
              placeholderTextColor={AT.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
            />
            {isSearchingApi ? (
              <ActivityIndicator size="small" color={AT.accent} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={18} color={AT.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Categories Horizontal Rail */}
        <View style={s.categoriesRailWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.categoriesRail}
          >
            <TouchableOpacity
              style={[s.categoryChip, activeCategory === 'all' && s.categoryChipActive]}
              onPress={() => setActiveCategory('all')}
              activeOpacity={0.7}
            >
              <FontAwesome5
                name="globe"
                size={12}
                color={activeCategory === 'all' ? '#FFF' : AT.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.categoryChipText, activeCategory === 'all' && s.categoryChipTextActive]}>
                Clubs ({LOCAL_CLUB_CATALOG_COUNT.toLocaleString('fr-FR')})
              </Text>
            </TouchableOpacity>

            {POPULAR_TEAMS_CATALOG.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.categoryChip, isActive && s.categoryChipActive]}
                  onPress={() => setActiveCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.categoryChipText, isActive && s.categoryChipTextActive]}>
                    {cat.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Team Grid Catalog */}
        <FlatList
          data={displayedTeams}
          keyExtractor={(item, idx) => `${item.id}_${idx}`}
          numColumns={3}
          contentContainerStyle={s.gridContainer}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={9}
          updateCellsBatchingPeriod={40}
          windowSize={5}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <FontAwesome5 name="search" size={32} color={AT.textMuted} />
              <Text style={s.emptyStateTitle}>{isLoadingLocalPack ? 'Chargement du catalogue mondial...' : 'Aucun club trouvé dans le catalogue mondial'}</Text>
              <Text style={s.emptyStateSub}>Saisissez le nom de n&apos;importe quel club pour charger son logo officiel.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.gridCard}
              onPress={async () => {
                const apiLogo = item.isCountry
                  ? item.logo
                  : (item.logo && /^https:\/\//i.test(item.logo)) ? item.logo : isApiSearchResults ? item.logo : await fetchOfficialTeamBadge(item.name);
                onSelectTeam(item.name, apiLogo || '');
                onClose();
              }}
              activeOpacity={0.75}
            >
              <View style={s.logoWrap}>
                {item.isCountry && !/^https:\/\//i.test(item.logo) ? (
                  <CircularFlag countryCode={item.logo} size={40} teamName={item.name} />
                ) : (
                  <ApiTeamBadge teamName={item.name} size={40} apiLogo={item.logo && /^https:\/\//i.test(item.logo) ? item.logo : isApiSearchResults ? item.logo : undefined} />
                )}
              </View>
              <Text style={s.teamName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={s.teamSub} numberOfLines={1}>
                {item.country}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: AT.contentBg,
  },
  modalHeader: {
    backgroundColor: '#0A1932',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    gap: 12,
  },
  closeIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#0A1932',
    borderBottomWidth: 1,
    borderBottomColor: '#1A2F52',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  categoriesRailWrap: {
    backgroundColor: AT.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: AT.border,
  },
  categoriesRail: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: AT.cardBg2,
    borderWidth: 1,
    borderColor: AT.border,
  },
  categoryChipActive: {
    backgroundColor: AT.accent,
    borderColor: AT.accent,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AT.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  gridContainer: {
    padding: 10,
    paddingBottom: 40,
  },
  gridCard: {
    flex: 1 / 3,
    backgroundColor: AT.cardBg,
    margin: 4,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AT.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  logoWrap: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoImg: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  teamName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: AT.textPrimary,
    textAlign: 'center',
    height: 30,
    lineHeight: 14,
  },
  teamSub: {
    fontSize: 9.5,
    color: AT.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AT.textPrimary,
  },
  emptyStateSub: {
    fontSize: 13,
    color: AT.textMuted,
    textAlign: 'center',
  },
});
