import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedSvgLogo } from '@/components/CachedSvgLogo';
import { CircularFlag } from '@/components/CircularFlag';
import { TeamLogo } from '@/components/TeamLogo';
import { TabBar } from '@/components/TabBar';
import { useBetStore } from '@/store/useBetStore';
import { BetEvent } from '@/types/bet';
import { getBackgroundPalette } from '@/constants/theme';
import { getAllMaches, MacheRow } from '@/services/db';
import { fetchFootballLeagues, fetchLeagueEvents, fetchLiveFootballEvents, fetchOddsForEvents, SportsEvent, SportsLeague } from '@/services/sportsDataApi';
import { resolve1X2Odds } from '@/utils/oddsGenerator';
import { isValidImageUrl } from '@/utils/logoResolver';
import { LocalClub, loadLocalClubCatalog, searchLocalClubs } from '@/constants/localClubCatalog';

const BLUE = '#3E8BCB';
const BG = '#F1F4F8';
const CARD = '#FFFFFF';
type Mode = 'live' | 'prematch';
type Row = { id: string; title: string; countryCode: string; count: number | string; country?: boolean; sportIcon?: number; remoteId?: string; logo?: string };
type LocalMatch = MacheRow & { sourceId: string; timestamp: number; remoteStatus?: string; liveTime?: string; sportsEvent?: SportsEvent };

const featured: Row[] = [
  { id: 'premier-league', title: 'Premier League (Angleterre)', countryCode: 'gb', count: 20, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'la-liga', title: 'La Liga (Espagne)', countryCode: 'es', count: 20, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'ligue-1', title: 'Ligue 1 (France)', countryCode: 'fr', count: 18, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'bundesliga', title: 'Bundesliga (Allemagne)', countryCode: 'de', count: 18, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'serie-a', title: 'Serie A (Italie)', countryCode: 'it', count: 20, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'uefa-champions', title: 'UEFA Champions League', countryCode: 'eu', count: 36, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'afcon', title: 'Coupe d’Afrique des Nations', countryCode: 'un', count: 24, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'euro', title: 'Championnat d’Europe des Nations (Euro)', countryCode: 'eu', count: 24, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'asian-cup', title: 'Coupe d’Asie des Nations', countryCode: 'un', count: 24, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'world-cup', title: 'Coupe du monde', countryCode: 'un', count: 32, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'clubs', title: 'ASEAN Cup. Division 1', countryCode: 'un', count: 1, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'friendly-national', title: 'Matchs amicaux. Équipes nationales', countryCode: 'un', count: 1, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'africa-u23', title: "Coupe d'Afrique des nations U23", countryCode: 'un', count: 1, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'asian', title: 'Jeux asiatiques', countryCode: 'un', count: 2, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'euro-u21', title: "Matchs de qualification pour le Championnat d'Europe U21", countryCode: 'eu', count: 8, sportIcon: require('../../assets/images/icon_sport_football.png') },
  { id: 'uefa-women', title: "Ligue des champions de l'UEFA. Femmes", countryCode: 'eu', count: 9, sportIcon: require('../../assets/images/icon_sport_football.png') },
];
const countries: Row[] = [
  { id: 'england', title: 'Angleterre', countryCode: 'gb', count: 294, country: true },
  { id: 'germany', title: 'Allemagne', countryCode: 'de', count: 145, country: true },
  { id: 'spain', title: 'Espagne', countryCode: 'es', count: 146, country: true },
  { id: 'italy', title: 'Italie', countryCode: 'it', count: 135, country: true },
  { id: 'france', title: 'France', countryCode: 'fr', count: 121, country: true },
  { id: 'brazil', title: 'Brésil', countryCode: 'br', count: 30, country: true },
  { id: 'portugal', title: 'Portugal', countryCode: 'pt', count: 34, country: true },
  { id: 'netherlands', title: 'Pays-Bas', countryCode: 'nl', count: 32, country: true },
  { id: 'belgium', title: 'Belgique', countryCode: 'be', count: 30, country: true },
  { id: 'turkey', title: 'Turquie', countryCode: 'tr', count: 28, country: true },
  { id: 'morocco', title: 'Maroc', countryCode: 'ma', count: 16, country: true },
  { id: 'egypt', title: 'Égypte', countryCode: 'eg', count: 18, country: true },
  { id: 'japan', title: 'Japon', countryCode: 'jp', count: 20, country: true },
  { id: 'south-korea', title: 'Corée du Sud', countryCode: 'kr', count: 16, country: true },
];
const leagues = ['Championnats amicaux U21. Équipes nationales', 'Championnats amicaux U20. Équipes nationales', 'Matchs amicaux des clubs', "Coupe d'Afrique des nations. Matchs", 'Esoccer Battle Volta', 'FC 26. eSports Battle. Champions League B'];
const longLeagueRows: Row[] = Array.from({ length: 36 }, (_, i) => ({ id: `league-${i}`, title: `${leagues[i % leagues.length]} ${i + 1}`, countryCode: countries[i % countries.length].countryCode, count: (i % 9) + 1 }));
function makeFallbackRows(mode: Mode, expanded: Set<string>): Row[] {
  if (mode === 'live') return [...featured, ...countries, ...longLeagueRows.slice(0, 20)];
  const result: Row[] = [...featured, ...countries];
  countries.forEach((country) => {
    if (expanded.has(country.id)) result.push(...leagues.slice(0, 3).map((title, i) => ({ id: `${country.id}-${i}`, title, countryCode: country.countryCode, count: i + 1 })));
  });
  return [...result, ...longLeagueRows];
}
function SkeletonRows() {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <View style={styles.skeletonList}><Animated.View style={[styles.skeletonLabel, { opacity }]} />{Array.from({ length: 10 }, (_, i) => <Animated.View key={i} style={[styles.skeletonRow, { opacity }]} />)}</View>;
}
function isFootballMatch(match: MacheRow) {
  const sport = String(match.sport || '').toLowerCase();
  return sport === '' || sport === 'football';
}
function toLocalMatch(match: MacheRow, index: number): LocalMatch {
  const timestamp = match.date && Number.isFinite(new Date(match.date).getTime()) ? new Date(match.date).getTime() : 0;
  return { ...match, homeLogo: match.homeLogo || '', awayLogo: match.awayLogo || '', sourceId: String(match.fixtureId ?? match.id ?? `${match.homeTeam}-${match.awayTeam}-${index}`), timestamp };
}
function hasRealTeamLogos(event: SportsEvent) {
  return isValidImageUrl(event.strHomeTeamBadge || event.strHomeTeamLogo) && isValidImageUrl(event.strAwayTeamBadge || event.strAwayTeamLogo);
}
function hasRealLocalTeamLogos(match: Pick<LocalMatch, 'homeLogo' | 'awayLogo'>) {
  return isValidImageUrl(match.homeLogo) && isValidImageUrl(match.awayLogo);
}
function toRemoteMatch(event: SportsEvent, index: number): LocalMatch {
  const date = event.strTimestamp || (event.dateEvent && event.strTime ? `${event.dateEvent}T${event.strTime}` : event.dateEvent) || '';
  const homeScore = event.intHomeScore ?? null;
  const awayScore = event.intAwayScore ?? null;
  const id = `external-${event.provider || 'sports'}-${event.idEvent || index}`;
  const marketOdds = resolve1X2Odds(id, { v1: event.oddV1, draw: event.oddNul, v2: event.oddV2 });
  return {
    sourceId: `${event.provider || 'sports'}-${event.idEvent || index}`, timestamp: date ? new Date(date).getTime() : 0,
    fixtureId: Number(event.idEvent) || undefined, sport: 'football',
    homeTeam: event.strHomeTeam || 'Équipe domicile', homeLogo: event.strHomeTeamBadge || event.strHomeTeamLogo || '',
    awayTeam: event.strAwayTeam || 'Équipe extérieure', awayLogo: event.strAwayTeamBadge || event.strAwayTeamLogo || '',
    league: event.strLeague || 'Football', date, score: homeScore !== null && awayScore !== null ? `${homeScore} - ${awayScore}` : 'VS',
    odd: marketOdds.v1, betOption: 'V1', oddV1: marketOdds.v1, oddNul: marketOdds.draw, oddV2: marketOdds.v2,
    remoteStatus: event.strStatus || '', liveTime: event.strProgress || event.strStatus || '',
    sportsEvent: event,
  };
}
function formatMatchDate(value: string | undefined) {
  if (!value) return 'Date non renseignée';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, '0')}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${parsed.getFullYear()} (${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')})`;
}
function isRemoteLive(match: LocalMatch) {
  const status = (match.remoteStatus || '').trim();
  return /live|in_play|first half|second half|halftime|extra_time|penalty/i.test(status) || /^(?:1h|ht|2h|et|bt|p|int)$/i.test(status);
}
const AFRICAN_COUNTRIES = new Set(['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Cameroon', 'Egypt', 'Ghana', 'Ivory Coast', 'Kenya', 'Morocco', 'Nigeria', 'Senegal', 'South Africa', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe']);
function isAfricanLeague(league: SportsLeague) {
  const value = `${league.strCountry || ''} ${league.strLeague || ''}`.toLowerCase();
  return AFRICAN_COUNTRIES.has(league.strCountry || '') || /caf|africa|algeria|angola|cameroon|egypt|ghana|morocco|nigeria|senegal|south africa|tunisia|zambia|zimbabwe/.test(value);
}
function matchesForMode(matches: LocalMatch[], mode: Mode, timeFilter: string) {
  const now = Date.now();
  const liveWindow = 3 * 60 * 60 * 1000;
  return matches.filter((match) => {
    if (mode === 'live') return match.remoteStatus ? isRemoteLive(match) : match.timestamp > 0 && match.timestamp <= now && now - match.timestamp <= liveWindow;
    if (match.timestamp <= now) return false;
    if (timeFilter === 'Tout') return true;
    const hours = timeFilter === '15 Drive' ? 0.25 : timeFilter === '30 minutes' ? 0.5 : timeFilter === '1 heure' ? 1 : timeFilter === '2 heures' ? 2 : 6;
    return match.timestamp <= now + hours * 60 * 60 * 1000;
  });
}
function teamBadge(value: string | undefined, name: string) {
  if (!isValidImageUrl(value)) return null;
  return <TeamLogo uri={value} size={29} style={styles.teamLogo} accessibilityLabel={`Écusson ${name}`} />;
}
function toBetEvent(match: LocalMatch): BetEvent {
  const live = isRemoteLive(match) || (!match.remoteStatus && match.timestamp > 0 && match.timestamp <= Date.now());
  const external = match.sportsEvent;
  const id = external ? `external-${external.provider || 'sports'}-${external.idEvent || match.sourceId}` : `local-${match.sourceId}`;
  const marketOdds = resolve1X2Odds(id, { v1: match.oddV1, draw: match.oddNul, v2: match.oddV2 });
  const hasRealPrices = [external?.oddV1, external?.oddNul, external?.oddV2].some((value) => Number.isFinite(Number(value)) && Number(value) > 1);
  return {
    id, sport: 'Football', tournament: match.league || 'Football', date: match.date || '',
    ...(external?.provider ? { provider: external.provider } : {}),
    ...(external?.idEvent ? { providerEventId: String(external.idEvent) } : {}),
    team1: match.homeTeam, team2: match.awayTeam, team1CountryCode: 'UN', team2CountryCode: 'UN',
    team1Logo: match.homeLogo || undefined, team2Logo: match.awayLogo || undefined, betType: '1X2. V1', odd: Number(oddValue(match, 0)) || 0,
    marketOdds,
    ...(external?.marketLines ? { marketLines: external.marketLines } : {}),
    ...(external?.additionalOdds ? { additionalOdds: external.additionalOdds } : {}),
    ...(external?.providerMarkets?.length ? { providerMarkets: external.providerMarkets } : {}),
    ...(hasRealPrices || external?.marketLines || external?.additionalOdds ? { oddsProvider: 'the-odds-api' as const } : {}),
    status: live ? 'En direct' : 'Accepté', score: match.score || '0 - 0', isLive: live, liveTime: match.liveTime,
  };
}
function oddValue(match: LocalMatch, marketIndex: number) {
  const existing = [match.oddV1 || match.odd, match.oddNul, match.oddV2][marketIndex];
  if (existing) return Number(existing).toFixed(2);
  return '—';
}
function MatchCard({ match, bg, activeColor, onPress }: { match: LocalMatch; bg: ReturnType<typeof getBackgroundPalette>; activeColor: string; onPress: () => void }) {
  const live = isRemoteLive(match);
  const matchLabel = live ? 'LIVE' : 'Soon';
  return <TouchableOpacity style={[styles.matchCard, { backgroundColor: bg.cardBg, borderColor: bg.divider }]} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.matchHeader}><View style={styles.leagueWithIcon}><Image source={require('../../assets/images/icon_sport_football-dark-transparent.png')} style={styles.matchSportIcon} resizeMode="contain" /><Text style={[styles.leagueText, { color: bg.textSecondary }]} numberOfLines={1}>{match.league || 'Football'}</Text></View><View style={styles.matchActions}><Text style={[styles.soon, live && styles.liveBadge]}>{matchLabel}</Text><Ionicons name="notifications-outline" size={18} color={bg.textSecondary} /><Ionicons name="star-outline" size={20} color={activeColor} /></View></View>
    <View style={styles.teamsRow}><View style={styles.teamBlock}><Text style={[styles.team, { color: bg.textPrimary }]} numberOfLines={1}>{match.homeTeam}</Text>{teamBadge(match.homeLogo, match.homeTeam)}</View><Text style={[styles.score, { color: bg.textPrimary }]}>{match.score || 'VS'}</Text><View style={styles.teamBlock}><Text style={[styles.team, { color: bg.textPrimary }]} numberOfLines={1}>{match.awayTeam}</Text>{teamBadge(match.awayLogo, match.awayTeam)}</View></View>
    <Text style={[styles.matchTime, { color: bg.textSecondary }]}>{live && match.liveTime ? match.liveTime : formatMatchDate(match.date)}</Text><Text style={[styles.marketLabel, { color: bg.textPrimary }]}>1X2</Text>
    <View style={styles.oddsRow}>{(['V1', 'X', 'V2'] as const).map((label, index) => <View key={label} style={[styles.odd, { backgroundColor: bg.inputBg, borderColor: bg.border }]}><Text style={[styles.oddLabel, { color: bg.textSecondary }]}>{label}</Text><Text style={[styles.oddValue, { color: bg.textPrimary }]}>{oddValue(match, index)}</Text></View>)}</View>
  </TouchableOpacity>;
}
export default function ChampionshipsScreen() {
  const router = useRouter(); const insets = useSafeAreaInsets();
  const theme = useBetStore((state) => state.theme); const backgroundMode = useBetStore((state) => state.backgroundMode); const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';
  const [mode, setMode] = useState<Mode>('prematch'); const [loading, setLoading] = useState(true); const [clubSearchOpen, setClubSearchOpen] = useState(false); const [clubQuery, setClubQuery] = useState(''); const [clubCatalog, setClubCatalog] = useState<LocalClub[]>([]); const [clubCatalogLoading, setClubCatalogLoading] = useState(false); const [timeFilter, setTimeFilter] = useState('Tout'); const [expanded, setExpanded] = useState<Set<string>>(new Set()); const [favorites, setFavorites] = useState<Set<string>>(new Set()); const [selectedLeague, setSelectedLeague] = useState<string | null>(null); const [localMatches, setLocalMatches] = useState<LocalMatch[]>([]); const [remoteLeagues, setRemoteLeagues] = useState<SportsLeague[]>([]); const [remoteMatches, setRemoteMatches] = useState<LocalMatch[]>([]); const [remoteLoading, setRemoteLoading] = useState(false);
  const indicator = useRef(new Animated.Value(0)).current;
  useEffect(() => { try { setLocalMatches(getAllMaches().filter(isFootballMatch).map(toLocalMatch)); } catch (error) { console.warn('Impossible de charger les matchs locaux:', error); setLocalMatches([]); } const timer = setTimeout(() => setLoading(false), 350); return () => clearTimeout(timer); }, [mode, timeFilter]);
  useEffect(() => { if (!clubSearchOpen || clubCatalog.length > 0) return undefined; let mounted = true; setClubCatalogLoading(true); void loadLocalClubCatalog().then((catalog) => { if (mounted) setClubCatalog(catalog); }).catch((error) => console.warn('Catalogue local indisponible:', error)).finally(() => { if (mounted) setClubCatalogLoading(false); }); return () => { mounted = false; }; }, [clubSearchOpen, clubCatalog.length]);
  useEffect(() => { let mounted = true; fetchFootballLeagues().then((value) => { if (mounted) setRemoteLeagues(value); }).catch((error) => console.warn('TheSportsDB indisponible, fallback local conservé:', error)); return () => { mounted = false; }; }, []);
  const orderedRemoteLeagues = useMemo(() => [...remoteLeagues].sort((a, b) => Number(isAfricanLeague(b)) - Number(isAfricanLeague(a)) || a.strLeague.localeCompare(b.strLeague)), [remoteLeagues]);
  useEffect(() => {
    if (mode !== 'live') return undefined;
    let mounted = true;
    const loadLive = async () => {
      try {
        const events = await fetchLiveFootballEvents();
        if (!mounted) return;
        const eventsWithLogos = events.filter(hasRealTeamLogos);
        const loaded = eventsWithLogos.map(toRemoteMatch);
        setRemoteMatches((current) => [...current.filter((match) => !loaded.some((item) => item.sourceId === match.sourceId)), ...loaded]);
        void fetchOddsForEvents(eventsWithLogos, { detailed: true }).then((enriched) => {
          if (!mounted) return;
          const withOdds = enriched.filter(hasRealTeamLogos).map(toRemoteMatch);
          setRemoteMatches((current) => [...current.filter((match) => !withOdds.some((item) => item.sourceId === match.sourceId)), ...withOdds]);
        });
      } catch (error) {
        console.warn('API-Football live indisponible; les matchs locaux restent affichés:', error);
      }
    };
    void loadLive();
    return () => { mounted = false; };
  }, [mode]);
  useEffect(() => { Animated.spring(indicator, { toValue: mode === 'live' ? 0 : 1, useNativeDriver: true, speed: 18, bounciness: 4 }).start(); }, [indicator, mode]);
  const visibleLocalMatches = useMemo(() => matchesForMode(localMatches.filter(hasRealLocalTeamLogos), mode, timeFilter), [localMatches, mode, timeFilter]);
  const dynamicRows = useMemo(() => { const grouped = new Map<string, LocalMatch[]>(); visibleLocalMatches.forEach((match) => { const title = (match.league || 'Football').trim() || 'Football'; grouped.set(title, [...(grouped.get(title) || []), match]); }); return Array.from(grouped.entries()).map(([title, matches]) => ({ id: `local-${title}`, title, countryCode: /^[a-z]{2}$/i.test(String(matches[0].homeLogo || '')) ? String(matches[0].homeLogo) : 'un', count: matches.length, sportIcon: require('../../assets/images/icon_sport_football.png') })); }, [visibleLocalMatches]);
  const visibleRemoteMatches = useMemo(() => matchesForMode(remoteMatches, mode, timeFilter), [remoteMatches, mode, timeFilter]);
  const liveRows = useMemo(() => {
    const groups = new Map<string, { matches: LocalMatch[]; remoteId?: string }>();
    visibleRemoteMatches.forEach((match) => {
      const title = (match.league || 'Football').trim() || 'Football';
      const group = groups.get(title) || { matches: [], remoteId: match.sportsEvent?.idLeague };
      group.matches.push(match);
      groups.set(title, group);
    });
    return Array.from(groups.entries()).map(([title, group]) => ({ id: `live-${title}`, remoteId: group.remoteId, title, countryCode: 'un', count: group.matches.length, sportIcon: require('../../assets/images/icon_sport_football.png') }));
  }, [visibleRemoteMatches]);
  const remoteRows = useMemo(() => orderedRemoteLeagues.map((league) => { const loadedCount = remoteMatches.filter((match) => (match.league || '').trim() === league.strLeague.trim()).length; return { id: `remote-${league.idLeague}`, remoteId: league.idLeague, title: league.strLeague, countryCode: 'un', count: loadedCount > 0 ? loadedCount : '—', logo: league.strBadge || league.strLogo, sportIcon: require('../../assets/images/icon_sport_football.png') }; }), [orderedRemoteLeagues, remoteMatches]);
  const rows = mode === 'live' ? (liveRows.length > 0 ? liveRows : (localMatches.length > 0 ? dynamicRows : makeFallbackRows(mode, expanded))) : (remoteRows.length > 0 ? (localMatches.length > 0 ? [...dynamicRows, ...remoteRows] : remoteRows) : (localMatches.length > 0 ? dynamicRows : makeFallbackRows(mode, expanded)));
  const selectedMatches = selectedLeague ? [...visibleLocalMatches.filter((match) => (match.league || 'Football').trim() === selectedLeague), ...visibleRemoteMatches.filter((match) => (match.league || 'Football').trim() === selectedLeague)] : [];
  const localClubResults = useMemo(() => searchLocalClubs(clubCatalog, clubQuery).slice(0, 80), [clubCatalog, clubQuery]);
  const openLeague = async (title: string, remoteId?: string) => {
    setSelectedLeague(title);
    const hasFixturesForMode = remoteMatches.some((match) => (match.league || '').trim() === title && (mode === 'live' ? isRemoteLive(match) : !isRemoteLive(match)));
    if (!remoteId || hasFixturesForMode) return;
    setRemoteLoading(true);
    try {
      const events = await fetchLeagueEvents(remoteId);
      const eventsWithLogos = events.filter(hasRealTeamLogos);
      const loaded = eventsWithLogos.map(toRemoteMatch);
      setRemoteMatches((current) => [...current.filter((match) => (match.league || '').trim() !== title), ...loaded]);
      void fetchOddsForEvents(eventsWithLogos, { detailed: true }).then((enriched) => {
        const withOdds = enriched.filter(hasRealTeamLogos).map(toRemoteMatch);
        setRemoteMatches((current) => [...current.filter((match) => (match.league || '').trim() !== title), ...withOdds]);
        const store = useBetStore.getState();
        const selected = store.selectedEvent;
        const selectedMatch = withOdds.find((match) => toBetEvent(match).id === selected?.id);
        if (selectedMatch && selected) store.setSelectedEvent({ ...selected, ...toBetEvent(selectedMatch) });
      });
    } catch (error) {
      console.warn('Impossible de charger les matchs du championnat:', error);
    } finally {
      setRemoteLoading(false);
    }
  };
  const selectMatch = (match: LocalMatch) => {
    const selected = toBetEvent(match);
    useBetStore.getState().setSelectedEvent(selected);
    useBetStore.getState().setShowMatchDetails(true);
    router.push('/match-details');
    if (!match.sportsEvent) return;
    void fetchOddsForEvents([match.sportsEvent], { detailed: true }).then(([updated]) => {
      if (!updated) return;
      if (!hasRealTeamLogos(updated)) return;
      const updatedMatch = toRemoteMatch(updated, 0);
      setRemoteMatches((current) => current.map((item) => item.sourceId === updatedMatch.sourceId ? updatedMatch : item));
      const store = useBetStore.getState();
      if (store.selectedEvent?.id === selected.id) store.setSelectedEvent({ ...store.selectedEvent, ...toBetEvent(updatedMatch) });
    });
  };
  const toggleFavorite = (id: string) => setFavorites((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleCountry = (id: string) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const translateX = indicator.interpolate({ inputRange: [0, 1], outputRange: [0, 184] });
  return <View style={[styles.root, { paddingTop: insets.top, backgroundColor: bg.appBg }]}>
    <View style={[styles.header, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}><TouchableOpacity onPress={() => selectedLeague ? setSelectedLeague(null) : router.back()}><Ionicons name="chevron-back" size={27} color={bg.textPrimary} /></TouchableOpacity><Text style={[styles.title, { color: bg.textPrimary }]} numberOfLines={1}>{selectedLeague || 'Championnats'}</Text><View style={styles.headerActions}><TouchableOpacity accessibilityLabel="Rechercher un club local" onPress={() => { setClubSearchOpen((value) => !value); setClubQuery(''); }}><Ionicons name={clubSearchOpen ? "close" : "search-outline"} size={22} color={clubSearchOpen ? activeColor : bg.textSecondary} /></TouchableOpacity><Ionicons name="options-outline" size={21} color={bg.textSecondary} /></View></View>
    {clubSearchOpen && <View style={[styles.clubSearchPanel, { backgroundColor: bg.cardBg, borderBottomColor: bg.divider }]}><View style={[styles.clubSearchInputWrap, { backgroundColor: bg.inputBg, borderColor: bg.border }]}><Ionicons name="search" size={18} color={bg.textSecondary} /><TextInput value={clubQuery} onChangeText={setClubQuery} autoFocus placeholder="Rechercher un club, pays ou championnat" placeholderTextColor={bg.textSecondary} style={[styles.clubSearchInput, { color: bg.textPrimary }]} /></View><Text style={[styles.clubSearchCount, { color: bg.textSecondary }]}>{clubCatalogLoading ? 'Chargement du catalogue…' : clubQuery ? `${localClubResults.length} résultat${localClubResults.length > 1 ? 's' : ''}` : `${clubCatalog.length} clubs intégrés`}</Text><FlatList data={localClubResults} keyExtractor={(item) => item.id} style={styles.clubSearchResults} keyboardShouldPersistTaps="handled" initialNumToRender={6} maxToRenderPerBatch={6} updateCellsBatchingPeriod={40} windowSize={4} renderItem={({ item }) => <View style={[styles.clubSearchRow, { borderBottomColor: bg.divider }]}><View style={styles.clubLogo}><CachedSvgLogo uri={item.logoUrl} width={28} height={28} /></View><View style={styles.clubTextWrap}><Text style={[styles.clubName, { color: bg.textPrimary }]} numberOfLines={1}>{item.name}</Text><Text style={[styles.clubMeta, { color: bg.textSecondary }]} numberOfLines={1}>{item.country} · {item.league}</Text></View></View>} ListEmptyComponent={<Text style={[styles.clubEmpty, { color: bg.textSecondary }]}>Aucun club intégré ne correspond à cette recherche.</Text>} /></View>}
    <View style={[styles.segment, { backgroundColor: bg.inputBg }]}><Animated.View style={[styles.segmentIndicator, { transform: [{ translateX }], backgroundColor: activeColor }]} />{[['live', 'EN DIRECT'], ['prematch', 'Avant-match']].map(([key, label]) => <TouchableOpacity key={key} style={styles.segmentButton} onPress={() => { setMode(key as Mode); setSelectedLeague(null); }}><Text style={[styles.segmentText, { color: bg.textSecondary }, mode === key && styles.segmentTextActive]}>{label}</Text></TouchableOpacity>)}</View>
    {mode === 'prematch' && <FlatList horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent} data={['Tout', '15 Drive', '30 minutes', '1 heure', '2 heures', '6 heures']} keyExtractor={(item) => item} renderItem={({ item }) => <TouchableOpacity onPress={() => setTimeFilter(item)} style={[styles.filter, { backgroundColor: bg.cardBg, borderColor: bg.divider }, timeFilter === item && { backgroundColor: activeColor, borderColor: activeColor }]}><Text style={[styles.filterText, { color: bg.textSecondary }, timeFilter === item && styles.filterTextActive]}>{item}</Text></TouchableOpacity>} />}
    {loading ? <SkeletonRows /> : selectedLeague ? <FlatList style={[styles.list, { backgroundColor: bg.appBg }]} data={selectedMatches} keyExtractor={(item) => item.sourceId} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator renderItem={({ item }) => <MatchCard match={item} bg={bg} activeColor={activeColor} onPress={() => selectMatch(item)} />} ListEmptyComponent={<Text style={[styles.empty, { color: bg.textSecondary }]}>{remoteLoading ? 'Chargement des matchs…' : 'Aucun match dans ce filtre.'}</Text>} /> : <FlatList style={[styles.list, { backgroundColor: bg.appBg }]} data={rows} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator renderItem={({ item }) => <Pressable onPress={item.remoteId || localMatches.length > 0 ? () => { void openLeague(item.title, item.remoteId); } : item.country ? () => toggleCountry(item.id) : undefined} style={[styles.row, { backgroundColor: bg.cardBg, borderBottomColor: bg.divider }]}>{item.logo ? <Image source={{ uri: item.logo }} style={styles.sportIcon} resizeMode="contain" /> : item.sportIcon ? <Image source={item.sportIcon} style={styles.sportIcon} resizeMode="contain" /> : <CircularFlag countryCode={item.countryCode} size={25} teamName={item.title} />}<Text style={[styles.rowTitle, { color: bg.textPrimary }]}>{item.title}</Text><Text style={[styles.count, { backgroundColor: bg.inputBg, color: bg.textSecondary }]}>{item.count}</Text>{item.country ? <Ionicons name={expanded.has(item.id) ? 'chevron-up' : 'chevron-down'} size={18} color={bg.textSecondary} /> : <TouchableOpacity onPress={() => toggleFavorite(item.id)}><Ionicons name={favorites.has(item.id) ? 'star' : 'star-outline'} size={23} color={favorites.has(item.id) ? activeColor : bg.textSecondary} /></TouchableOpacity>}</Pressable>} />}
    <TabBar />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG }, clubSearchPanel: { maxHeight: 310, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderBottomWidth: 1 }, clubSearchInputWrap: { height: 40, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 }, clubSearchInput: { flex: 1, fontSize: 13 }, clubSearchCount: { fontSize: 11, marginTop: 7, marginBottom: 2 }, clubSearchResults: { maxHeight: 238 }, clubSearchRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 9 }, clubLogo: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, clubTextWrap: { flex: 1 }, clubName: { fontSize: 13, fontWeight: '700' }, clubMeta: { fontSize: 10, marginTop: 2 }, clubEmpty: { paddingVertical: 18, textAlign: 'center', fontSize: 12 }, header: { height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: '#E3EBF0' }, title: { flex: 1, textAlign: 'center', marginHorizontal: 12, fontSize: 16, color: '#385B70', fontWeight: '700' }, headerActions: { flexDirection: 'row', gap: 16 }, segment: { height: 38, marginHorizontal: 12, marginTop: 6, borderRadius: 10, backgroundColor: '#DCEBF6', overflow: 'hidden', flexDirection: 'row', position: 'relative' }, segmentIndicator: { position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', backgroundColor: BLUE, borderRadius: 10 }, segmentButton: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 }, segmentText: { fontSize: 12, color: '#60717B' }, segmentTextActive: { color: '#FFF', fontWeight: '700' }, filters: { maxHeight: 52, marginTop: 6 }, filtersContent: { paddingHorizontal: 10, gap: 8, alignItems: 'center' }, filter: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0E8EE' }, filterText: { color: '#43515B', fontSize: 12 }, filterTextActive: { color: '#FFF', fontWeight: '700' }, list: { flex: 1 }, listContent: { paddingHorizontal: 9, paddingTop: 8, paddingBottom: 84, gap: 5 }, row: { minHeight: 50, paddingHorizontal: 11, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: '#E5EBF0', backgroundColor: CARD, flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#8497A8', shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }, sportIcon: { width: 25, height: 25 }, rowTitle: { flex: 1, color: '#263B48', fontSize: 12 }, count: { minWidth: 23, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, backgroundColor: '#EDF1F4', color: '#667987', textAlign: 'center', fontSize: 11 }, skeletonList: { paddingHorizontal: 10, paddingTop: 30, gap: 9 }, skeletonLabel: { width: 90, height: 11, borderRadius: 8, backgroundColor: '#C1CEDA', marginBottom: 3 }, skeletonRow: { height: 43, borderRadius: 14, backgroundColor: '#C4D0DE' }, matchCard: { marginTop: 6, padding: 10, borderRadius: 10, borderWidth: 1 }, matchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, leagueWithIcon: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, matchSportIcon: { width: 22, height: 22 }, leagueText: { flex: 1, fontSize: 11 }, matchActions: { flexDirection: 'row', alignItems: 'center', gap: 9 }, soon: { backgroundColor: '#E85E67', color: '#FFF', fontSize: 8, fontWeight: '800', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2 }, liveBadge: { backgroundColor: '#18A86B' }, teamsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 13, marginTop: 11 }, teamBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 }, team: { fontSize: 13, fontWeight: '600', textAlign: 'center' }, teamLogo: { width: 29, height: 29 }, score: { fontSize: 17, fontWeight: '800' }, matchTime: { fontSize: 10, textAlign: 'center', marginTop: 8 }, marketLabel: { fontSize: 12, fontWeight: '700', marginTop: 9 }, oddsRow: { flexDirection: 'row', gap: 7, marginTop: 5 }, odd: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', borderRadius: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 8 }, oddLabel: { fontSize: 10 }, oddValue: { fontSize: 11, fontWeight: '800' }, empty: { textAlign: 'center', padding: 24 },
});
