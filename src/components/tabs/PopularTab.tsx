import { Ionicons } from '@expo/vector-icons';
import { Image as CachedImage } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBackgroundPalette } from '@/constants/theme';
import { useBetStore } from '@/store/useBetStore';
import { BetEvent } from '@/types/bet';
import { createFifaSimulationPlan, getFifaSimulationState } from '@/utils/localFifaSimulation';
import { getMortalKombatSimulationState, isMortalKombatEvent } from '@/utils/localMortalKombatSimulation';
import { getPokerSimulationState, isPokerEvent, POKER_DEFAULT_DURATION_MS } from '@/utils/localPokerSimulation';
import { MORTAL_KOMBAT_FIGHTERS } from '@/data/mortalKombatFighters';
import { getAllMaches, MacheRow } from '@/services/db';
import { fetchLiveFootballEvents, fetchOddsForEvents, fetchUpcomingFootballEvents, SportsEvent } from '@/services/sportsDataApi';
import QuickBetSheet from '@/components/QuickBetSheet';
import { resolve1X2Odds } from '@/utils/oddsGenerator';
import { isValidImageUrl } from '@/utils/logoResolver';
import { getNavigationInactiveColor, getNavigationItemColor } from '@/utils/navigationColors';
import { ThemeBrandLogo } from '@/components/ThemeBrandLogo';

const BLUE = '#2E79C9';
const MUTED = '#70879A';
const CARD = '#FFFFFF';
const PAGE = '#EEF2F6';

type ImageSource = number;
type Tile = { id: string; title: string; subtitle?: string; image: ImageSource; showLabel?: boolean };
type Match = {
  id: string;
  sport?: string;
  sourceEvent?: BetEvent;
  team1Image?: any;
  team2Image?: any;
  team1LogoCode?: string;
  team2LogoCode?: string;
  league: string;
  team1: string;
  team2: string;
  score?: string;
  time?: string;
  image1?: ImageSource;
  image2?: ImageSource;
  odds: [string, string, string];
  live?: boolean;
};

const topNavigation = [
  { id: 'populaire', label: 'Populaires', icon: require('@/assets/images/video-reference-icons/top-populaires-transparent-4x.png') },
  { id: 'sports', label: 'Sports', icon: require('@/assets/images/video-reference-icons/top-sports-transparent-4x.png') },
  { id: 'esport', label: 'E-sport', icon: require('@/assets/images/video-reference-icons/top-esport-transparent-4x.png') },
  { id: 'casino', label: 'Casino', icon: require('@/assets/images/video-reference-icons/top-casino-transparent-4x.png') },
  { id: 'games', label: '1xGames', icon: require('@/assets/images/video-reference-icons/top-1xgames-transparent-4x.png') },
] as const;
type TopTab = typeof topNavigation[number]['id'];
const sportTypes = [
  { id: 'football', label: 'Football', image: require('@/assets/images/popular-video-crops/sports-first-video/football-transparent-4x.png') },
  { id: 'tennis', label: 'Tennis', image: require('@/assets/images/popular-video-crops/sports-first-video/tennis-transparent-4x.png') },
  { id: 'basket', label: 'Basket-\nball', image: require('@/assets/images/popular-video-crops/sports-first-video/basketball-transparent-4x.png') },
  { id: 'hockey', label: 'Hockey\nsur glace', image: require('@/assets/images/popular-video-crops/sports-first-video/hockey-transparent-4x.png') },
  { id: 'volley', label: 'Volleyball', image: require('@/assets/images/popular-video-crops/sports-first-video/volleyball-transparent-4x.png') },
  { id: 'table', label: 'Tennis de\ntable', image: require('@/assets/images/popular-video-crops/sports-first-video/table-tennis-transparent-4x.png') },
  { id: 'badminton', label: 'Badminton', image: require('@/assets/images/popular-video-crops/sports-first-video/badminton-transparent-4x.png') },
] as const;

const sportsTopEventVisuals: Tile[] = [
  { id: 'ucl-top-event', title: 'UCL', image: require('@/assets/images/popular-video-crops/sports/reference/ucl.png'), showLabel: false },
  { id: 'epl-top-event', title: 'EPL', image: require('@/assets/images/popular-video-crops/sports/reference/epl.png'), showLabel: false },
  { id: 'laliga-top-event', title: 'LaLiga', image: require('@/assets/images/popular-video-crops/sports/reference/laliga.png'), showLabel: false },
  { id: 'serie-a-top-event', title: 'Serie A', image: require('@/assets/images/popular-video-crops/sports/reference/serie-a.png'), showLabel: false },
  { id: 'europa-league-top-event', title: 'Europa League', image: require('@/assets/images/popular-video-crops/sports/reference/europa-league.png'), showLabel: false },
  { id: 'uecl-top-event', title: 'UECL', image: require('@/assets/images/popular-video-crops/sports/reference/uecl.png'), showLabel: false },
  { id: 'one-x-hype-top-event', title: '1xHype', image: require('@/assets/images/popular-video-crops/sports/reference/one-x-hype.png'), showLabel: false },
  { id: 'libertadores-top-event', title: 'Libertadores', image: require('@/assets/images/popular-video-crops/sports/reference/libertadores.png'), showLabel: false },
];

const games: Tile[] = [
  { id: 'chick', title: 'ChickPoint', image: require('@/assets/images/popular-reference/chick-point-new.png') },
  { id: 'conor', title: 'CONOR\nMCGREGOR W...', image: require('@/assets/images/popular-reference/conor-mcgregor-new.png') },
  { id: 'buckets', title: 'Paniers et gains', image: require('@/assets/images/popular-reference/paniers-et-gains-new.png') },
  { id: 'monster-bonus', title: 'Monster Bonus\nHunt', image: require('@/assets/images/popular-reference/monster-bonus-hunt.png') },
];
type XGameAccess = {
  id: string;
  title: string;
  image: ImageSource;
  accent: string;
};
type XGameSection = { title: string; games: XGameAccess[]; banner?: { id: string; title: string; image: ImageSource }; hideLabels?: boolean };
const MAX_XGAME_TILES_PER_GROUP = 4;
const LUCKY_WHEEL_BANNER_ASPECT_RATIO = 1002 / 235;
const groupXGameTiles = (tiles: XGameAccess[]) => {
  const groups: XGameAccess[][] = [];
  for (let index = 0; index < tiles.length; index += MAX_XGAME_TILES_PER_GROUP) {
    groups.push(tiles.slice(index, index + MAX_XGAME_TILES_PER_GROUP));
  }
  return groups;
};
const xgameSections: XGameSection[] = [
  {
    title: 'Tendance',
    games: [
      { id: 'crash-point', title: 'Crash Point', image: require('@/assets/images/fast-games/reference/crash-point.png'), accent: '#2457A6' },
      { id: 'aviator', title: 'Aviator', image: require('@/assets/images/popular-video-crops/recommended/aviator.png'), accent: '#C8102E' },
      { id: 'crash', title: 'Crash', image: require('@/assets/images/fast-games/reference/crash.png'), accent: '#2457A6' },
      { id: 'gems-odyssey', title: 'Gems Odyssey', image: require('@/assets/images/fast-games/reference/gems-odyssey.png'), accent: '#2457A6' },
    ],
  },
  {
    title: 'Pour vous',
    games: [
      { id: 'apple-of-fortune', title: 'Apple Of Fortune', image: require('@/assets/images/fast-games/reference/apple-of-fortune.png'), accent: '#2FA33C' },
      { id: 'plinko', title: 'Plinko', image: require('@/assets/images/fast-games/reference/plinko.png'), accent: '#315EA0' },
      { id: 'royal-crystals', title: 'Royal Crystals', image: require('@/assets/images/fast-games/reference/royal-crystals.png'), accent: '#A27BDB' },
      { id: 'gems-odyssey', title: 'Gems Odyssey', image: require('@/assets/images/fast-games/reference/gems-odyssey.png'), accent: '#2457A6' },
    ],
  },
  {
    title: 'Meilleur',
    games: [
      { id: 'crystal', title: 'Crystal', image: require('@/assets/images/fast-games/reference/crystal.png'), accent: '#7953C8' },
      { id: 'crash', title: 'Crash', image: require('@/assets/images/fast-games/reference/crash.png'), accent: '#2457A6' },
      { id: 'burning-hot', title: 'Burning Hot', image: require('@/assets/images/fast-games/reference/burning-hot.png'), accent: '#D94F28' },
      { id: 'western-slot', title: 'Western Slot', image: require('@/assets/images/fast-games/reference/western-slot.png'), accent: '#D28633' },
    ],
  },
  {
    title: 'Machines à sous',
    games: [
      { id: 'royal-crystals', title: 'Royal Crystals', image: require('@/assets/images/fast-games/reference/royal-crystals.png'), accent: '#A27BDB' },
      { id: 'crystal', title: 'Crystal', image: require('@/assets/images/fast-games/reference/crystal.png'), accent: '#7953C8' },
      { id: 'burning-hot', title: 'Burning Hot', image: require('@/assets/images/fast-games/reference/burning-hot.png'), accent: '#D94F28' },
      { id: 'western-slot', title: 'Western Slot', image: require('@/assets/images/fast-games/reference/western-slot.png'), accent: '#D28633' },
    ],
  },
  {
    title: 'Escalier du succès',
    banner: { id: 'lucky-wheel', title: 'Lucky Wheel', image: require('@/assets/images/fast-games/reference/lucky-wheel-banner.png') },
    games: [
      { id: 'apple-of-fortune', title: 'Apple Of Fortune', image: require('@/assets/images/fast-games/reference/apple-of-fortune.png'), accent: '#2FA33C' },
      { id: 'wild-west-gold', title: 'Wild West Gold', image: require('@/assets/images/fast-games/reference/wild-west-gold.png'), accent: '#B88943' },
      { id: 'gems-odyssey', title: 'Gems Odyssey', image: require('@/assets/images/fast-games/reference/gems-odyssey.png'), accent: '#2457A6' },
      { id: 'eastern-nights', title: 'Eastern Nights', image: require('@/assets/images/fast-games/reference/eastern-nights.png'), accent: '#7044D7' },
    ],
  },
  {
    title: 'Dés',
    games: [
      { id: 'under-and-over-7', title: 'Under and Over 7', image: require('@/assets/images/fast-games/reference/under-and-over-7.png'), accent: '#3446D2' },
      { id: 'yahtzee', title: 'Yahtzee', image: require('@/assets/images/fast-games/reference/yahtzee.png'), accent: '#8057D5' },
      { id: 'dice', title: 'Dice', image: require('@/assets/images/fast-games/reference/dice.png'), accent: '#D74758' },
      { id: 'five-dice-poker', title: 'Five Dice Poker', image: require('@/assets/images/fast-games/reference/five-dice-poker.png'), accent: '#44546C' },
    ],
  },
  {
    title: 'Jeux de cartes',
    games: [
      { id: 'solitaire', title: 'Solitaire', image: require('@/assets/images/fast-games/reference/solitaire.png'), accent: '#2457A6' },
      { id: '21', title: '21', image: require('@/assets/images/fast-games/reference/21.png'), accent: '#2457A6' },
      { id: 'indian-poker', title: 'Indian Poker', image: require('@/assets/images/fast-games/reference/indian-poker.png'), accent: '#2457A6' },
      { id: 'pf-poker-light', title: 'PF Poker Light', image: require('@/assets/images/fast-games/reference/pf-poker-light.png'), accent: '#2457A6' },
    ],
  },
  {
    title: 'Loteries',
    games: [
      { id: 'crash-point', title: 'Crash Point', image: require('@/assets/images/fast-games/reference/crash-point.png'), accent: '#2457A6' },
      { id: 'crash', title: 'Crash', image: require('@/assets/images/fast-games/reference/crash.png'), accent: '#2457A6' },
      { id: 'spin-and-win', title: 'Spin and Win', image: require('@/assets/images/fast-games/reference/spin-and-win.png'), accent: '#2457A6' },
      { id: 'gems-odyssey', title: 'Gems Odyssey', image: require('@/assets/images/fast-games/reference/gems-odyssey.png'), accent: '#2457A6' },
    ],
  },
  {
    title: 'Autres jeux',
    games: [
      { id: 'plinko', title: 'Plinko', image: require('@/assets/images/fast-games/reference/plinko.png'), accent: '#315EA0' },
      { id: 'thimbles', title: 'Thimbles', image: require('@/assets/images/fast-games/reference/thimbles.png'), accent: '#7444B2' },
      { id: 'dominoes', title: 'Dominoes', image: require('@/assets/images/fast-games/reference/dominoes.png'), accent: '#6A4B29' },
      { id: 'fruit-blast', title: 'Fruit Blast', image: require('@/assets/images/fast-games/reference/fruit-blast.png'), accent: '#4C8E36' },
    ],
  },
];
const casinoRecommended: Tile[] = [
  { id: 'jetx', title: 'JetX', subtitle: 'Smartsoft', image: require('@/assets/images/popular-video-crops/recommended/jetx.png') },
  { id: 'navigator', title: 'Navigator', subtitle: 'Solidicon', image: require('@/assets/images/popular-video-crops/recommended/navigator.png') },
  { id: 'sky-olympus-recommended', title: 'Sky Of Olympus', image: require('@/assets/images/casino/reference/sky-olympus-popular.png'), showLabel: false },
  { id: 'mega-block-recommended', title: 'Mega Block', image: require('@/assets/images/casino/reference/mega-block-popular.png'), showLabel: false },
];
const casinoTopVisuals: Tile[] = [
  { id: 'skeleton-madness', title: 'Skeleton Madness', image: require('@/assets/images/casino/reference/top-skeleton-madness.png'), showLabel: false },
  { id: 'monster-bonus-hunt-casino', title: 'Monster Bonus Hunt', image: require('@/assets/images/casino/reference/top-monster-bonus-hunt.png'), showLabel: false },
  { id: 'chasse-sauvage', title: 'Chasse sauvage', image: require('@/assets/images/casino/reference/top-chasse-sauvage.png'), showLabel: false },
  { id: 'inscrivez-vous', title: 'Inscrivez-vous', image: require('@/assets/images/casino/reference/top-inscrivez-vous.png'), showLabel: false },
];
const casinoPopularVisuals: Tile[] = [
  { id: 'sky-olympus-casino', title: 'Sky Of Olympus', image: require('@/assets/images/casino/reference/sky-olympus-popular.png'), showLabel: false },
  { id: 'mega-block', title: 'Mega Block', image: require('@/assets/images/casino/reference/mega-block-popular.png'), showLabel: false },
  { id: 'mariachi-afortunado', title: 'Mariachi Afortunado', image: require('@/assets/images/casino/reference/mariachi-afortunado-popular.png'), showLabel: false },
];
const casinoExclusiveVisuals: Tile[] = [
  { id: 'halloween-horrors', title: '1XBET Halloween Horrors', image: require('@/assets/images/casino/reference/exclusive-halloween-horrors.png'), showLabel: false },
  { id: 'mental-casino', title: '1xMental', image: require('@/assets/images/casino/reference/exclusive-mental.png'), showLabel: false },
  { id: 'triple-7-joker', title: '1X Triple 7 Joker', image: require('@/assets/images/casino/reference/exclusive-triple-7-joker.png'), showLabel: false },
];
const casinoLiveVisuals: Tile[] = [
  { id: 'mega-sic-bac', title: '1X Mega Sic Bac', image: require('@/assets/images/casino/reference/live-mega-sic-bac.png'), showLabel: false },
  { id: 'velvet-speed-roulette', title: '1X Velvet Speed Roulette', image: require('@/assets/images/casino/reference/live-velvet-speed-roulette.png'), showLabel: false },
  { id: 'english-blackjack', title: '1X English Blackjack 2', image: require('@/assets/images/casino/reference/live-english-blackjack.png'), showLabel: false },
];
const selectedForYou: Tile[] = [
  { id: 'blackjack-selected', title: 'Blackjack', image: require('@/assets/images/popular-video-crops/selected/blackjack.png') },
  { id: 'gonzo-selected', title: 'Gonzo', image: require('@/assets/images/popular-video-crops/selected/gonzo.png') },
  { id: 'no-limit-selected', title: 'No Limit City', image: require('@/assets/images/popular-video-crops/selected/no-limit-city.png') },
];
const selectedCasino: Tile[] = [
  { id: 'zeus-selected', title: 'Sky Of Olympus', image: require('@/assets/images/casino/zeus_olympus.png') },
  { id: 'blackjack-selected-casino', title: '1x Baccarat', image: require('@/assets/images/casino/velvet_blackjack.png') },
  { id: 'roulette-selected-casino', title: 'Velvet Roulette', image: require('@/assets/images/casino/velvet_roulette.png') },
];
const casinoCategories: Tile[] = [
  { id: 'casino-slots', title: 'Machines à\nsous', image: require('@/assets/images/popular-video-crops/casino-categories/slots.png') },
  { id: 'live-casino', title: 'Casino en\ndirect', image: require('@/assets/images/popular-video-crops/casino-categories/live-casino.png') },
  { id: 'tv-games', title: 'Jeux TV', image: require('@/assets/images/popular-video-crops/casino-categories/tv-games.png') },
  { id: 'bingo', title: 'Bingo', image: require('@/assets/images/popular-video-crops/casino-categories/bingo.png') },
  { id: 'fishing', title: 'Chasse &\npêche', image: require('@/assets/images/popular-video-crops/casino-categories/fishing.png') },
];
const esports: Tile[] = [
  { id: 'cs2', title: 'CS 2', image: require('@/assets/images/popular-video-crops/esports/reference/discipline-cs2.png') },
  { id: 'dota', title: 'Dota 2', image: require('@/assets/images/popular-video-crops/esports/reference/discipline-dota2.png') },
  { id: 'lol', title: 'League of\nLegends', image: require('@/assets/images/popular-video-crops/esports/reference/discipline-league-of-legends.png') },
  { id: 'mobile', title: 'Mobile\nLegends', image: require('@/assets/images/popular-video-crops/esports/reference/discipline-mobile-legends.png') },
  { id: 'valorant', title: 'Valorant', image: require('@/assets/images/popular-video-crops/esports/reference/discipline-valorant.png') },
];
const esportsVisualTournaments: Tile[] = [
  { id: 'pgl-masters-bucharest', title: 'PGL Masters Bucharest', image: require('@/assets/images/popular-video-crops/esports/reference/tournament-live-pgl.png') },
  { id: 'pr-universe', title: 'PR Universe', image: require('@/assets/images/popular-video-crops/esports/reference/tournament-upcoming-pr-universe.png') },
];

const tournaments = [
  { id: 'uefa', title: 'Ligue des nations de l’UEFA', count: '5', image: require('@/assets/images/popular-video-crops/tournaments/nation-jollof.png') },
  { id: 'gulf', title: 'Coupe du Golfe des nations', count: '1', image: require('@/assets/images/popular-video-crops/tournaments/september-bonus.png') },
  { id: 'friendly', title: 'Matchs amicaux. Équipes nationales', count: '1', image: require('@/assets/images/popular-video-crops/tournaments/nation-jollof.png') },
];
const MAX_POPULAR_TOP_EVENTS = 4;

const esportsMatches: Match[] = [
  { id: 'cs-live', league: 'CS 2. FEREE in House. Play-off. Finale', team1: 'Ninjas in Pyjamas', team2: 'magic', odds: ['1.165', '5.15', ''] , live: true },
  { id: 'cs-pre', league: 'eSport - Avant-match', team1: 'pain Gaming', team2: 'Imperial Esports', time: '27.09.2026 (18:00)', odds: ['2.409', '1.53', ''] },
];

function formatBalance(value: number) {
  return Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PopularPalette = ReturnType<typeof getBackgroundPalette>;

function usePopularPalette(): PopularPalette {
  const mode = useBetStore((state) => state.backgroundMode);
  const opacity = useBetStore((state) => state.backgroundOpacity);
  return useMemo(() => getBackgroundPalette(mode, opacity), [mode, opacity]);
}

const normalizeName = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const getFighterImage = (event: BetEvent, team: string, explicitLogo?: string) => {
  if (!isMortalKombatEvent(event)) return undefined;
  const key = explicitLogo?.startsWith('mortal:') ? explicitLogo.slice('mortal:'.length) : '';
  const normalized = normalizeName(team);
  return MORTAL_KOMBAT_FIGHTERS.find((fighter) => fighter.id === key || normalizeName(fighter.name) === normalized)?.image;
};
const getFootballTeamImage = (_team: string, explicitLogo?: string) =>
  explicitLogo && isValidImageUrl(explicitLogo) ? { uri: explicitLogo.trim() } : undefined;
const getProviderFootballTeamImage = (explicitLogo?: string) =>
  explicitLogo && /^https:\/\//i.test(explicitLogo) ? { uri: explicitLogo } : undefined;
const hasRealProviderLogos = (event: SportsEvent) =>
  isValidImageUrl(event.strHomeTeamLogo || event.strHomeTeamBadge) &&
  isValidImageUrl(event.strAwayTeamLogo || event.strAwayTeamBadge);

function SectionHeader({ title, tag, color, onAll, allLabel = 'Tout' }: { title: string; tag?: string; color?: string; onAll?: () => void; allLabel?: string }) {
  const bg = usePopularPalette();
  const theme = useBetStore((state) => state.theme);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : BLUE;
  const resolvedColor = color || activeColor;
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: bg.textPrimary }]}>{title}</Text>
        {tag && <View style={[styles.tag, { borderColor: resolvedColor }]}><Text style={[styles.tagText, { color: resolvedColor }]}>{tag}</Text></View>}
      </View>
      {onAll && <TouchableOpacity onPress={onAll}><Text style={[styles.allButton, { backgroundColor: bg.cardBg, color: bg.textSecondary }]}>{allLabel}</Text></TouchableOpacity>}
    </View>
  );
}

function SportsTopEventsLayout({ data, onPress }: { data: Tile[]; onPress: (tile: Tile) => void }) {
  return <TopEventsStack data={data.slice(0, 2)} onPress={onPress} />;
}

function TopEventsStack({ data, onPress }: { data: Tile[]; onPress: (tile: Tile) => void }) {
  return <View style={styles.topEventsStack}>
    {data.map((tile, index) => <Pressable key={tile.id} style={[styles.topEventsCard, index > 0 && styles.topEventsCardOverlap]} onPress={() => onPress(tile)} accessibilityRole="button" accessibilityLabel={tile.title}>
      <Image source={tile.image} style={styles.topEventsCardImage} resizeMode="contain" />
    </Pressable>)}
  </View>;
}
function HorizontalTiles({ data, size = 74, height = size, fit = 'cover', onPress }: { data: Tile[]; size?: number; height?: number; fit?: 'cover' | 'contain'; onPress: (tile: Tile) => void }) {
  const bg = usePopularPalette();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileScroll}>
      {data.map((tile) => <AnimatedTile key={tile.id} tile={tile} size={size} height={height} fit={fit} bg={bg} onPress={onPress} />)}
    </ScrollView>
  );
}

function AnimatedTile({ tile, size, height, fit, bg, onPress }: { tile: Tile; size: number; height: number; fit: 'cover' | 'contain'; bg: PopularPalette; onPress: (tile: Tile) => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 28, bounciness: 5 }).start();
  return (
    <Pressable
      style={{ width: size }}
      onPress={() => onPress(tile)}
      onPressIn={() => animateTo(0.96)}
      onPressOut={() => animateTo(1)}
      accessibilityRole="button"
      accessibilityLabel={tile.title.replace('\n', ' ')}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image source={tile.image} style={[styles.tileImage, { width: size, height, backgroundColor: bg.sectionBg }]} resizeMode={fit} />
        {tile.showLabel !== false && <Text style={[styles.tileTitle, { color: bg.textPrimary }]} numberOfLines={2}>{tile.title}</Text>}
        {tile.showLabel !== false && tile.subtitle && <Text style={[styles.tileSubtitle, { color: bg.textSecondary }]}>{tile.subtitle}</Text>}
      </Animated.View>
    </Pressable>
  );
}

function XGameCatalogSection({ section, onPress }: { section: XGameSection; onPress: (tile: Tile) => void }) {
  const bg = usePopularPalette();
  const { width: viewportWidth } = useWindowDimensions();
  const contentWidth = Math.min(Math.max(viewportWidth, 1), 1000);
  const bannerWidth = contentWidth;
  const gridGap = 10;
  const gridPadding = 20;
  const cardSize = Math.max(1, Math.min(228, Math.floor((contentWidth - gridPadding - gridGap * (MAX_XGAME_TILES_PER_GROUP - 1)) / MAX_XGAME_TILES_PER_GROUP)));
  return (
    <View style={{ width: contentWidth, maxWidth: 1000, alignSelf: 'center', marginTop: 4 }}>
      <View style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 7, paddingBottom: 4 }}>
        <Text numberOfLines={1} style={{ maxWidth: '78%', color: bg.textPrimary, fontSize: 17, lineHeight: 21, fontWeight: '800' }}>{section.title}</Text>
        <View style={{ backgroundColor: bg.cardBg, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 5 }}>
          <Text style={{ color: bg.textSecondary, fontSize: 11, lineHeight: 13, fontWeight: '500' }}>Tout</Text>
        </View>
      </View>
      {section.banner && (
        <Pressable
          style={{ width: bannerWidth, alignSelf: 'center', overflow: 'hidden' }}
          onPress={() => onPress({ id: section.banner!.id, title: section.banner!.title, image: section.banner!.image })}
          accessibilityRole="button"
          accessibilityLabel={section.banner.title}
        >
          <Image source={section.banner.image} style={[styles.oneXGameLuckyBanner, { width: bannerWidth, height: bannerWidth / LUCKY_WHEEL_BANNER_ASPECT_RATIO }]} resizeMode="contain" />
        </Pressable>
      )}
      <View style={{ width: '100%', paddingHorizontal: gridPadding / 2, gap: 12 }}>
        {groupXGameTiles(section.games).map((group, groupIndex) => (
          <View key={`${section.title}-group-${groupIndex}`} style={{ width: '100%', flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', columnGap: gridGap }}>
            {group.map((tile) => (
              <Pressable
                key={tile.id}
                style={{ width: cardSize, alignItems: 'center' }}
                onPress={() => onPress(tile)}
                accessibilityRole="button"
                accessibilityLabel={tile.title}
                >
                  <Image source={tile.image} style={{ width: cardSize, height: cardSize, borderRadius: 15, backgroundColor: bg.sectionBg }} resizeMode="cover" />
                {!section.hideLabels && <View style={{ maxWidth: '100%', minHeight: 30, marginTop: 4, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text numberOfLines={2} adjustsFontSizeToFit style={{ color: bg.textPrimary, fontSize: 10, lineHeight: 13, fontWeight: '500', textAlign: 'center' }}>{tile.title}</Text>
                </View>}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function OddsRow({ odds, labels = ['V1', 'X', 'V2'], bg, onSelectOdd }: { odds: [string, string, string]; labels?: [string, string, string]; bg: PopularPalette; onSelectOdd?: (choice: 'V1' | 'X' | 'V2', odd: number) => void }) {
  const choices: Array<'V1' | 'X' | 'V2'> = ['V1', 'X', 'V2'];
  return <View style={styles.oddsRow}>{odds.map((odd, index) => {
    const numericOdd = Number(String(odd).replace(',', '.'));
    const enabled = Boolean(onSelectOdd && Number.isFinite(numericOdd) && numericOdd > 0 && odd !== '—');
    const oddsBackground = index === 0 && bg.statusBarStyle === 'dark-content' ? '#E9F3FA' : bg.pillBg;
    return <TouchableOpacity key={`${choices[index]}-${odd}`} disabled={!enabled} onPress={() => enabled && onSelectOdd?.(choices[index], numericOdd)} activeOpacity={0.75} style={[styles.odd, index === 0 && styles.oddSelected, enabled && styles.oddInteractive, !enabled && styles.oddDisabled, { backgroundColor: index === 0 ? oddsBackground : bg.inputBg, borderColor: bg.border }]}>
      <Text style={[styles.oddLabel, { color: bg.textSecondary }]}>{labels[index]}</Text><Text style={[styles.oddValue, { color: bg.textPrimary }]}>{odd || '—'}</Text>
    </TouchableOpacity>;
  })}</View>;
}

function MatchCard({ match, bg, onPress, onSelectOdd }: { match: Match; bg: PopularPalette; onPress: () => void; onSelectOdd?: (choice: 'V1' | 'X' | 'V2', odd: number) => void }) {
  const sourceEvent = match.sourceEvent;
  const usePlainApiLogos = Boolean(sourceEvent?.provider);
  const isPoker = Boolean(sourceEvent && isPokerEvent(sourceEvent));
  const isMortal = Boolean(sourceEvent && isMortalKombatEvent(sourceEvent));
  const oddsLabels: [string, string, string] = isPoker ? ['Main 1', 'X', 'Main 2'] : ['V1', 'X', 'V2'];
  const headerIcon = isPoker
    ? null
    : isMortal
      ? require('@/assets/images/mortal-kombat/mortal-kombat-sport-icon.png')
      : match.sport === 'E-sport'
        ? require('@/assets/images/video-reference-icons/top-esport-transparent-4x.png')
        : require('@/assets/images/icon_sport_football-dark-transparent.png');
  return (
    <View style={[styles.matchCard, { backgroundColor: bg.cardBg }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <View style={styles.matchHeader}>
        <View style={styles.leagueWithIcon}>
          {headerIcon && <Image source={headerIcon} style={styles.matchSportIcon} resizeMode="contain" />}
          <Text style={[styles.leagueText, { color: bg.textSecondary }]}>{match.league}</Text>
        </View>
        <View style={styles.matchActions}><Ionicons name="notifications-outline" size={20} color={bg.textSecondary} /><Ionicons name="star-outline" size={20} color={bg.textSecondary} /></View>
      </View>
      <View style={styles.teamsRow}>
        <View style={styles.teamBlock}><Text style={[styles.team, { color: bg.textPrimary }]}>{match.team1}</Text>{match.team1Image ? (usePlainApiLogos ? <CachedImage source={match.team1Image} style={{ width: 42, height: 42, marginTop: 5 }} contentFit="contain" cachePolicy="memory-disk" /> : <View style={{ width: 36, height: 36, borderRadius: 18, marginTop: 5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: bg.sectionBg }}><CachedImage source={match.team1Image} style={styles.teamLogo} contentFit="contain" cachePolicy="memory-disk" /></View>) : null}</View>
        <Text style={[styles.score, { color: bg.textPrimary }]}>{match.score || 'VS'}</Text>
        <View style={styles.teamBlock}><Text style={[styles.team, { color: bg.textPrimary }]}>{match.team2}</Text>{match.team2Image ? (usePlainApiLogos ? <CachedImage source={match.team2Image} style={{ width: 42, height: 42, marginTop: 5 }} contentFit="contain" cachePolicy="memory-disk" /> : <View style={{ width: 36, height: 36, borderRadius: 18, marginTop: 5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: bg.sectionBg }}><CachedImage source={match.team2Image} style={styles.teamLogo} contentFit="contain" cachePolicy="memory-disk" /></View>) : null}</View>
      </View>
      {match.time && <Text style={[styles.matchTime, { color: bg.textSecondary }]}>{match.time}</Text>}
      {match.live && <View style={styles.livePill}><Text style={styles.liveText}>EN DIRECT</Text></View>}
      </TouchableOpacity>
      <OddsRow odds={match.odds} labels={oddsLabels} bg={bg} onSelectOdd={onSelectOdd} />
    </View>
  );
}

function TournamentRow({ item, onPress }: { item: typeof tournaments[number]; onPress: () => void }) {
  const bg = usePopularPalette();
  return <TouchableOpacity style={[styles.tournamentRow, { backgroundColor: bg.cardBg }]} onPress={onPress} activeOpacity={0.8}>
    <Image source={item.image} style={styles.tournamentIcon} />
    <Text style={[styles.tournamentTitle, { color: bg.textPrimary }]} numberOfLines={1}>{item.title}</Text>
    <Text style={[styles.count, { color: bg.textSecondary, backgroundColor: bg.sectionBg }]}>{item.count}</Text>
    <Ionicons name="star-outline" size={21} color={bg.textSecondary} />
  </TouchableOpacity>;
}

function toBetEvent(match: Match): BetEvent {
  if (match.sourceEvent) {
    return {
      ...match.sourceEvent,
      betType: '1X2. V1',
      odd: Number(match.odds[0]) || Number(match.sourceEvent.marketOdds?.v1) || Number(match.sourceEvent.odd) || 1,
      status: match.live ? 'En direct' : 'Accepté',
      score: match.score || match.sourceEvent.score,
      isLive: Boolean(match.live),
      liveTime: match.time || match.sourceEvent.liveTime,
    };
  }
  return {
    id: match.id,
    sport: match.id.startsWith('cs') ? 'E-sport' : 'Football',
    tournament: match.league,
    date: match.time || '27.09.2026 (19:45)',
    team1: match.team1,
    team2: match.team2,
    team1CountryCode: 'UN',
    team2CountryCode: 'UN',
    betType: '1X2. V1',
    odd: Number(match.odds[0]) || 1,
    status: match.live ? 'En direct' : 'Accepté',
    score: match.score,
    isLive: match.live,
  };
}

function toSportsApiBetEvent(event: SportsEvent): BetEvent {
  const status = String(event.strStatus || '').trim();
  const live = /live|in_play|first half|second half|halftime|extra_time|penalty/i.test(status) || /^(?:1h|ht|2h|et|bt|p|int)$/i.test(status);
  const homeScore = event.intHomeScore;
  const awayScore = event.intAwayScore;
  const score = homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined ? `${homeScore} - ${awayScore}` : undefined;
  const parsedDate = event.strTimestamp ? new Date(event.strTimestamp) : null;
  const date = parsedDate && Number.isFinite(parsedDate.getTime())
    ? `${parsedDate.toLocaleDateString('fr-FR')} (${parsedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`
    : event.dateEvent || '';
  const id = `external-${event.provider || 'sports'}-${event.idEvent}`;
  const hasReal1X2 = [event.oddV1, event.oddNul, event.oddV2].some((value) => Number.isFinite(Number(value)) && Number(value) > 1);
  const marketOdds = resolve1X2Odds(id, { v1: event.oddV1, draw: event.oddNul, v2: event.oddV2 });
  return {
    id,
    sport: 'Football',
    ...(event.provider ? { provider: event.provider } : {}),
    ...(event.idEvent ? { providerEventId: String(event.idEvent) } : {}),
    tournament: event.strLeague || 'Football',
    date,
    team1: event.strHomeTeam || 'Équipe domicile',
    team2: event.strAwayTeam || 'Équipe extérieure',
    team1CountryCode: 'UN',
    team2CountryCode: 'UN',
    team1Logo: event.strHomeTeamLogo || event.strHomeTeamBadge,
    team2Logo: event.strAwayTeamLogo || event.strAwayTeamBadge,
    marketOdds,
    ...(event.marketLines ? { marketLines: event.marketLines } : {}),
    ...(event.additionalOdds ? { additionalOdds: event.additionalOdds } : {}),
    ...(event.providerMarkets?.length ? { providerMarkets: event.providerMarkets } : {}),
    ...(hasReal1X2 || event.marketLines || event.additionalOdds ? { oddsProvider: 'the-odds-api' as const } : {}),
    betType: '1X2. V1',
    odd: marketOdds.v1,
    status: live ? 'En direct' : 'Accepté',
    score,
    isLive: live,
    liveTime: event.strProgress || event.strStatus,
    scheduledAt: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : undefined,
  };
}

function stableMarketSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

/** Cotes pseudo-aléatoires stables par événement : X reste supérieure à V2. */
function stableDrawAndAwayOdds(eventId: string): { draw: number; v2: number } {
  const v2Cents = 200 + (stableMarketSeed(`${eventId}:V2`) % 500);
  const drawCents = v2Cents + 1 + (stableMarketSeed(`${eventId}:X`) % (700 - v2Cents));
  return { draw: drawCents / 100, v2: v2Cents / 100 };
}

function hasRealFootballLogos(event: Pick<BetEvent, 'sport' | 'team1Logo' | 'team2Logo'>) {
  return String(event.sport || '').trim().toLowerCase() !== 'football' || (isValidImageUrl(event.team1Logo) && isValidImageUrl(event.team2Logo));
}

function eventToLiveMatch(event: BetEvent, nowMs: number, includeUpcoming = false): Match | null {
  if (!hasRealFootballLogos(event)) return null;
  const isFifaEvent = event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
  const fifa = isFifaEvent ? getFifaSimulationState(event, nowMs) : null;
  const mortal = isMortalKombatEvent(event) ? getMortalKombatSimulationState(event, nowMs) : null;
  const poker = isPokerEvent(event) ? getPokerSimulationState(event, nowMs) : null;
  const terminal = ['gagné', 'gagne', 'payé', 'paye'].includes(String(event.status).toLowerCase());
  if (terminal) return null;
  const storeLive = Boolean(event.isLive || String(event.status).toLowerCase() === 'en direct');
  const isLive = isFifaEvent
    ? Boolean(fifa?.isLive)
    : Boolean(mortal?.isLive || poker?.isLive || storeLive);
  if (!isLive && !includeUpcoming) return null;
  const score = fifa?.displayScore || mortal?.displayScore || (poker ? 'Poker' : (isLive ? event.score : 'VS')) || 'VS';
  const liveTime = (fifa?.isLive ? fifa.displayMatchTime : '') || mortal?.liveTime || poker?.liveTime || event.liveTime || 'En direct';
  const isProviderFootballMatch = String(event.sport || '').trim().toLowerCase() === 'football' && Boolean(event.provider);
  const team1Image = isPokerEvent(event) ? undefined : getFighterImage(event, event.team1, event.team1Logo) || (isProviderFootballMatch ? getProviderFootballTeamImage(event.team1Logo) : getFootballTeamImage(event.team1, event.team1Logo));
  const team2Image = isPokerEvent(event) ? undefined : getFighterImage(event, event.team2, event.team2Logo) || (isProviderFootballMatch ? getProviderFootballTeamImage(event.team2Logo) : getFootballTeamImage(event.team2, event.team2Logo));
  const isSpecialMarket = Boolean(mortal || poker);
  const fallbackOdds = isSpecialMarket ? stableDrawAndAwayOdds(event.id) : null;
  const storedDraw = Number(event.marketOdds?.draw);
  const storedV2 = Number(event.marketOdds?.v2);
  const storedSpecialPairIsValid = storedDraw >= 2 && storedDraw <= 7 && storedV2 >= 2 && storedV2 <= 7 && storedDraw > storedV2;
  const generatedFootballOdds = String(event.sport || '').trim().toLowerCase() === 'football' && event.provider
    ? resolve1X2Odds(event.id, event.marketOdds)
    : null;
  const marketOdds = isSpecialMarket
    ? {
        v1: Number(event.marketOdds?.v1) > 0 ? Number(event.marketOdds?.v1) : Number(event.odd) || undefined,
        draw: storedSpecialPairIsValid ? storedDraw : fallbackOdds!.draw,
        v2: storedSpecialPairIsValid ? storedV2 : fallbackOdds!.v2,
      }
      : generatedFootballOdds || event.marketOdds;
  return {
    id: `coupon-live-${event.id}`,
    sport: event.sport,
    sourceEvent: { ...event, ...(marketOdds ? { marketOdds } : {}), isLive, ...(isLive ? { liveTime } : {}) },
    league: event.tournament || event.sport,
    team1: event.team1,
    team2: event.team2,
    team1Image,
    team2Image,
    // Football team badges are shown only when the provider returned a real URL.
    team1LogoCode: undefined,
    team2LogoCode: undefined,
    score,
    time: isLive ? `${liveTime}${event.liveTime && event.liveTime !== liveTime ? ` · ${event.liveTime}` : ''}` : event.date,
    odds: marketOdds
      ? [marketOdds.v1, marketOdds.draw, marketOdds.v2].map((value) => Number.isFinite(value) && Number(value) > 0 ? Number(value).toFixed(2) : '—') as [string, string, string]
      : [String(event.odd || '—'), '—', '—'],
    live: isLive,
  };
}

const sportForStoredMatch = (match: MacheRow): BetEvent['sport'] => {
  if (match.sport === 'fifa' || String(match.league || '').trim().toUpperCase().startsWith('FIFA')) return 'FIFA';
  if (match.sport === 'mortal-kombat' || /mortal\s+(kombat|combat)/i.test(String(match.league || ''))) return 'Mortal Kombat';
  if (match.sport === 'poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(String(match.league || '').trim())) return 'Poker';
  return 'Football';
};

function eventFromStoredMatch(match: MacheRow): BetEvent {
  const sport = sportForStoredMatch(match);
  const eventId = `ev-${match.fixtureId ?? match.id ?? `${match.homeTeam}-${match.awayTeam}`}`;
  const isSpecialMarket = sport === 'Mortal Kombat' || sport === 'Poker';
  const fallbackOdds = isSpecialMarket ? stableDrawAndAwayOdds(eventId) : null;
  const storedDraw = Number(match.oddNul);
  const storedV2 = Number(match.oddV2);
  const storedSpecialPairIsValid = storedDraw >= 2 && storedDraw <= 7 && storedV2 >= 2 && storedV2 <= 7 && storedDraw > storedV2;
  const scheduledAt = match.date && Number.isFinite(new Date(match.date).getTime())
    ? new Date(match.date).toISOString()
    : undefined;
  const displayDate = scheduledAt
    ? `${new Date(scheduledAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} (${new Date(scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`
    : match.date || '';
  const betLabel = String(match.betOption || 'V1');
  const event: BetEvent = {
    id: eventId,
    sport,
    tournament: match.league || sport,
    date: displayDate,
    team1: match.homeTeam,
    team2: match.awayTeam,
    team1CountryCode: match.homeLogo || 'UN',
    team2CountryCode: match.awayLogo || 'UN',
    team1Logo: match.homeLogo || undefined,
    team2Logo: match.awayLogo || undefined,
    betType: sport === 'Poker' ? 'Combinaison gagnante. Carte haute' : `1X2. ${betLabel}`,
    odd: Number(match.oddV1 || match.odd) || 1,
    ...((sport === 'Football' || sport === 'FIFA' || isSpecialMarket) ? { marketOdds: {
      v1: Number(match.oddV1 || match.odd) || undefined,
      draw: isSpecialMarket ? (storedSpecialPairIsValid ? storedDraw : fallbackOdds!.draw) : Number(match.oddNul) || undefined,
      v2: isSpecialMarket ? (storedSpecialPairIsValid ? storedV2 : fallbackOdds!.v2) : Number(match.oddV2) || undefined,
    } } : {}),
    status: 'Accepté',
    score: match.score || '0 - 0',
    scorePeriod1: match.scorePeriod1,
    scorePeriod2: match.scorePeriod2,
    scheduledAt,
    ...(sport === 'FIFA' ? { fifaSimulation: createFifaSimulationPlan({
      id: `ev-${match.fixtureId ?? match.id ?? ''}`,
      sport,
      tournament: match.league || 'FIFA',
      date: scheduledAt || '',
      team1: match.homeTeam,
      team2: match.awayTeam,
      team1CountryCode: match.homeLogo || 'UN',
      team2CountryCode: match.awayLogo || 'UN',
      team1Logo: match.homeLogo,
      team2Logo: match.awayLogo,
      betType: `1X2. ${betLabel}`,
      odd: Number(match.odd) || 1,
      status: 'Accepté',
      score: match.score,
    }, match.fifaDurationMs) } : {}),
    ...(sport === 'Mortal Kombat' ? { mortalKombatSimulation: { durationMs: match.mortalKombatDurationMs || 3 * 60 * 1000 } } : {}),
    ...(sport === 'Poker' ? { pokerSimulation: { durationMs: match.pokerDurationMs || POKER_DEFAULT_DURATION_MS } } : {}),
  };
  return event;
}

function mergeCreatedMatchWithCoupon(matchEvent: BetEvent, couponEvents: BetEvent[]): BetEvent {
  const matches = couponEvents.filter((event) => event.id === matchEvent.id);
  const latest = matches.find((event) => ['gagné', 'gagne', 'payé', 'paye'].includes(String(event.status).toLowerCase())) || matches[matches.length - 1];
  if (!latest) return matchEvent;
  return {
    ...matchEvent,
    ...latest,
    scheduledAt: latest.scheduledAt || matchEvent.scheduledAt,
    team1Logo: latest.team1Logo || matchEvent.team1Logo,
    team2Logo: latest.team2Logo || matchEvent.team2Logo,
    marketOdds: matchEvent.marketOdds || latest.marketOdds,
    fifaSimulation: latest.fifaSimulation || matchEvent.fifaSimulation,
    mortalKombatSimulation: latest.mortalKombatSimulation || matchEvent.mortalKombatSimulation,
    pokerSimulation: latest.pokerSimulation || matchEvent.pokerSimulation,
  };
}

function matchesFromLiveCoupons(currentEvents: BetEvent[], history: Array<{ events?: BetEvent[] }>, nowMs: number): Match[] {
  const byId = new Map<string, BetEvent>();
  [...currentEvents, ...history.flatMap((coupon) => coupon.events || [])].forEach((event) => byId.set(event.id, event));
  return Array.from(byId.values()).map((event) => eventToLiveMatch(event, nowMs)).filter((match): match is Match => Boolean(match));
}

export default function PopularTab() {
  const router = useRouter();
  const { topTab } = useLocalSearchParams<{ topTab?: string }>();
  const balance = useBetStore((state) => state.balance);
  const currentBetSlip = useBetStore((state) => state.currentBetSlip);
  const betHistory = useBetStore((state) => state.betHistory);
  const setSelectedEvent = useBetStore((state) => state.setSelectedEvent);
  const setShowMatchDetails = useBetStore((state) => state.setShowMatchDetails);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';
  const navigationInactiveColor = getNavigationInactiveColor(backgroundMode);
  const [sportFilter, setSportFilter] = useState('all');
  const [activeTopTab, setActiveTopTab] = useState<TopTab>('populaire');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [createdMatchRows, setCreatedMatchRows] = useState<MacheRow[]>([]);
  const [externalFootballEvents, setExternalFootballEvents] = useState<SportsEvent[]>([]);
  const [prematchVisibleLimit, setPrematchVisibleLimit] = useState(30);
  const [quickBetSelection, setQuickBetSelection] = useState<{ event: BetEvent; label: string; odd: number } | null>(null);
  const gameLaunchInProgress = useRef(false);

  useEffect(() => {
    const requestedTab = String(topTab || '');
    if (!topNavigation.some((item) => item.id === requestedTab)) return;
    const nextTab = requestedTab as TopTab;
    setActiveTopTab(nextTab);
    if (nextTab === 'esport') setSportFilter('esport');
    else if (nextTab === 'sports') setSportFilter('football');
    else setSportFilter('all');
  }, [topTab]);

  const refreshCreatedMatches = useCallback(() => {
    setCreatedMatchRows(getAllMaches());
  }, []);

  useFocusEffect(useCallback(() => {
    gameLaunchInProgress.current = false;
    refreshCreatedMatches();
  }, [refreshCreatedMatches]));

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const isLiveFixture = (event: SportsEvent) => /live|in_play|first half|second half|halftime|extra_time|penalty/i.test(event.strStatus || '') || /^(?:1h|ht|2h|et|bt|p|int)$/i.test(String(event.strStatus || '').trim());
    const mergeBucket = (incoming: SportsEvent[], liveBucket: boolean) => {
      const relevant = incoming.filter((event) => hasRealProviderLogos(event) && isLiveFixture(event) === liveBucket);
      setExternalFootballEvents((current) => {
        const kept = current.filter((event) => isLiveFixture(event) !== liveBucket);
        const byId = new Map<string, SportsEvent>();
        [...kept, ...relevant].forEach((event) => byId.set(`${event.provider || 'sports'}:${event.idEvent}`, event));
        return Array.from(byId.values());
      });
    };
    const loadFeed = async (loader: () => Promise<SportsEvent[]>, liveBucket: boolean, label: string) => {
      try {
        const events = await loader();
        if (!active) return;
        mergeBucket(events, liveBucket);
        const eventsWithLogos = events.filter(hasRealProviderLogos);
        void fetchOddsForEvents(eventsWithLogos).then((enriched) => {
          if (active) mergeBucket(enriched, liveBucket);
        });
      } catch (error) {
        console.warn(`${label} indisponible; l’autre flux reste actif:`, error);
      }
    };
    void loadFeed(fetchLiveFootballEvents, true, 'API-Football live');
    void loadFeed(fetchUpcomingFootballEvents, false, 'API-Football avant-match');
    return () => { active = false; };
  }, []);

  const visibleMatches = useMemo(() => {
    if (sportFilter !== 'all' && sportFilter !== 'football') return [];
    return externalFootballEvents
      .map((event) => eventToLiveMatch(toSportsApiBetEvent(event), nowMs, true))
      .filter((match): match is Match => Boolean(match));
  }, [externalFootballEvents, nowMs, sportFilter]);
  const externalLiveMatches = useMemo(() => visibleMatches.filter((match) => match.live), [visibleMatches]);
  const externalUpcomingMatches = useMemo(() => visibleMatches.filter((match) => !match.live), [visibleMatches]);
  const couponEvents = useMemo(
    () => [...betHistory.flatMap((coupon) => coupon.events || []), ...(currentBetSlip.events || [])],
    [betHistory, currentBetSlip.events],
  );
  const settledEventIds = useMemo(() => {
    const settledCoupons = [...betHistory, currentBetSlip].filter((coupon) =>
      ['gagné', 'gagne', 'payé', 'paye'].includes(String(coupon.status).toLowerCase()),
    );
    return new Set(settledCoupons.flatMap((coupon) => (coupon.events || []).map((event) => event.id)));
  }, [betHistory, currentBetSlip]);
  const createdMatches = useMemo(() => createdMatchRows
    .map(eventFromStoredMatch)
    .map((event) => mergeCreatedMatchWithCoupon(event, couponEvents))
    .filter((event) => !settledEventIds.has(event.id))
    .map((event) => eventToLiveMatch(event, nowMs, true))
    .filter((match): match is Match => Boolean(match)),
  [createdMatchRows, couponEvents, nowMs, settledEventIds]);
  const matchesSportFilter = useCallback((match: Match) => {
    if (sportFilter === 'all') return true;
    if (sportFilter === 'esport') return match.sport === 'E-sport' || match.sport === 'Mortal Kombat';
    if (sportFilter === 'football') return match.sport === 'Football' || match.sport === 'FIFA';
    return String(match.sport || '').toLowerCase() === sportFilter;
  }, [sportFilter]);
  const visibleCreatedMatches = useMemo(() => createdMatches.filter(matchesSportFilter), [createdMatches, matchesSportFilter]);
  const visibleCreatedLiveMatches = useMemo(() => visibleCreatedMatches.filter((match) => match.live), [visibleCreatedMatches]);
  const visibleCreatedUpcomingMatches = useMemo(() => visibleCreatedMatches.filter((match) => !match.live), [visibleCreatedMatches]);
  const liveCouponMatches = useMemo(
    () => matchesFromLiveCoupons(currentBetSlip.events || [], betHistory, nowMs).filter((match) =>
      !match.sourceEvent || !settledEventIds.has(match.sourceEvent.id),
    ),
    [currentBetSlip.events, betHistory, nowMs, settledEventIds],
  );
  const visibleLiveCouponMatches = useMemo(() => {
    if (sportFilter === 'all') return liveCouponMatches;
    if (sportFilter === 'esport') return liveCouponMatches.filter((match) => match.sport === 'E-sport');
    return liveCouponMatches.filter((match) => match.sport === 'Football' || match.sport === sportFilter);
  }, [liveCouponMatches, sportFilter]);
  const createdEventIds = useMemo(
    () => new Set(createdMatchRows.map((match) => `ev-${match.fixtureId ?? match.id ?? `${match.homeTeam}-${match.awayTeam}`}`)),
    [createdMatchRows],
  );
  const externalLiveCouponMatches = useMemo(
    () => visibleLiveCouponMatches.filter((match) => !match.sourceEvent || !createdEventIds.has(match.sourceEvent.id)),
    [visibleLiveCouponMatches, createdEventIds],
  );
  const openMatch = (match: Match) => {
    const selected = match.sourceEvent || toBetEvent(match);
    setSelectedEvent(selected);
    setShowMatchDetails(true);
    router.push({ pathname: '/match-details' } as any);
    const externalEvent = externalFootballEvents.find((event) => toSportsApiBetEvent(event).id === selected.id);
    if (externalEvent) {
      void fetchOddsForEvents([externalEvent], { detailed: true }).then(([updated]) => {
        if (!updated) return;
        const current = useBetStore.getState().selectedEvent;
        const next = toSportsApiBetEvent(updated);
        if (current?.id === next.id) useBetStore.getState().setSelectedEvent(next);
      });
    }
  };
  const renderMatchCard = (match: Match) => {
    const event = match.sourceEvent;
    const canBet1X2 = Boolean(event && (event.sport === 'Football' || event.sport === 'FIFA'));
    return <MatchCard
      key={match.id}
      match={match}
      bg={bg}
      onPress={() => openMatch(match)}
      onSelectOdd={canBet1X2 ? (choice, odd) => setQuickBetSelection({
        event: event!,
        label: `1X2. ${choice}`,
        odd,
      }) : undefined}
    />;
  };
  const onTile = (tile: Tile) => Alert.alert(tile.title.replace('\n', ' '), 'Élément sélectionné.');
  const onXGameTile = (tile: Tile) => {
    if (gameLaunchInProgress.current) return;
    gameLaunchInProgress.current = true;
    router.push({
      pathname: '/xgame-loading',
      params: { gameId: tile.id, gameTitle: tile.title },
    } as any);
  };
  const onTopNavigation = (id: string) => {
    const nextTab = id as TopTab;
    setActiveTopTab(nextTab);
    if (nextTab === 'esport') setSportFilter('esport');
    else if (nextTab === 'sports') setSportFilter('football');
    else setSportFilter('all');
  };
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg.appBg }]} edges={['top']}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor={bg.headerBg} />
      <ScrollView style={[styles.container, { backgroundColor: bg.appBg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS === 'android'}>
        <View style={[styles.header, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}>
          <View style={styles.balanceRow}>
            <Image source={require('@/assets/common/popular-balance-plus.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
            <Text style={[styles.balance, { color: bg.textPrimary }]}>{formatBalance(balance)} ₣</Text>
            <ThemeBrandLogo theme={theme} backgroundMode={backgroundMode} />
            <Ionicons name="search-outline" size={25} color={navigationInactiveColor} style={styles.search} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topNav}>
            {topNavigation.map((item) => {
              const isActive = item.id === activeTopTab;
              return <Pressable key={item.id} style={styles.topNavItem} onPressIn={() => setActiveTopTab(item.id)} onPress={() => onTopNavigation(item.id)} accessibilityRole="tab" accessibilityState={{ selected: isActive }}>
                {(() => {
                  const itemColor = getNavigationItemColor(isActive, activeColor, navigationInactiveColor);
                  return <><Image source={item.icon} style={[styles.topIcon, { tintColor: itemColor }]} resizeMode="contain" /><Text style={[styles.topLabel, { color: itemColor }, isActive && styles.activeLabel]}>{item.label}</Text>{isActive && <View style={[styles.activeLine, { backgroundColor: activeColor }]} />}</>;
                })()}
              </Pressable>;
            })}
          </ScrollView>
        </View>

        {activeTopTab === 'populaire' && <>
          <SectionHeader title="Types de sports" onAll={() => setSportFilter('all')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportScroll}>
            {sportTypes.map((sport) => {
              const isActive = sportFilter === sport.id;
              return <TouchableOpacity key={sport.id} style={[styles.sportItem, { backgroundColor: bg.cardBg, borderColor: isActive ? activeColor : 'transparent' }]} onPress={() => { setSportFilter(sport.id); if (sport.id === 'football') router.push({ pathname: '/championships' } as any); }} accessibilityRole="tab" accessibilityState={{ selected: isActive }}><Image source={sport.image} style={[styles.sportIconImage, { tintColor: activeColor }]} resizeMode="contain" /><Text style={[styles.sportLabel, { color: activeColor }]}>{sport.label}</Text></TouchableOpacity>;
            })}
          </ScrollView>
          <HorizontalTiles data={games} size={82} fit="contain" onPress={onTile} />
          <SectionHeader title="TOP-EVENTS" onAll={() => setActiveTopTab('sports')} />
          <TopEventsStack data={sportsTopEventVisuals.slice(0, 3)} onPress={onTile} />
          {visibleCreatedUpcomingMatches.length > 0 && <>
            <SectionHeader title="Événements à venir" tag="Matchs" />
            {visibleCreatedUpcomingMatches.map(renderMatchCard)}
          </>}
          <SectionHeader title="Populaire EN DIRECT" tag="Sport" onAll={() => setActiveTopTab('sports')} />
          {visibleCreatedLiveMatches.map(renderMatchCard)}
          {externalLiveCouponMatches.map(renderMatchCard)}
          {externalLiveMatches.map(renderMatchCard)}
          <SectionHeader title="Tournois EN DIRECT" tag="Sport" onAll={() => setActiveTopTab('sports')} />
          {tournaments.map((item) => <TournamentRow key={`live-${item.id}`} item={item} onPress={() => toggleFavorite(item.id)} />)}
          <SectionHeader title="Recommandé" tag="Casino" color="#C85F91" onAll={() => setActiveTopTab('casino')} />
          <HorizontalTiles data={casinoRecommended} size={140} height={86} fit="contain" onPress={onTile} />
          <SectionHeader title="Casino populaire" tag="Casino" color="#C85F91" onAll={() => setActiveTopTab('casino')} />
          <HorizontalTiles data={casinoPopularVisuals} size={150} height={96} fit="contain" onPress={onTile} />
          <SectionHeader title="Nouveautés casino" tag="Casino" color="#C85F91" onAll={() => setActiveTopTab('casino')} />
          <HorizontalTiles data={casinoTopVisuals} size={98} height={118} fit="contain" onPress={onTile} />
          <SectionHeader title="Catégories" tag="Casino" color="#C85F91" onAll={() => setActiveTopTab('casino')} />
          <HorizontalTiles data={casinoCategories} size={70} height={115} fit="contain" onPress={onTile} />
          <SectionHeader title="Exclusives casino" tag="Casino" color="#C85F91" onAll={() => setActiveTopTab('casino')} />
          <HorizontalTiles data={casinoExclusiveVisuals} size={128} height={118} fit="contain" onPress={onTile} />
          <SectionHeader title="Casino en direct" tag="Casino" color="#C85F91" onAll={() => setActiveTopTab('casino')} />
          <HorizontalTiles data={casinoLiveVisuals} size={128} height={118} fit="contain" onPress={onTile} />
          <SectionHeader title="Sélectionnés pour vous" tag="Casino" color="#C85F91" />
          <HorizontalTiles data={selectedCasino} size={112} height={112} fit="cover" onPress={onTile} />
          <SectionHeader title="Sélectionnés pour vous" tag="Casino" color="#C85F91" />
          <HorizontalTiles data={selectedForYou} size={140} height={112} fit="contain" onPress={onTile} />
          <SectionHeader title="Disciplines" tag="E-sport" color="#7B55B5" onAll={() => setActiveTopTab('esport')} />
          <HorizontalTiles data={esports} size={70} height={112} fit="contain" onPress={onTile} />
          <SectionHeader title="E-sport EN DIRECT" tag="E-sport" color="#7B55B5" onAll={() => setActiveTopTab('esport')} />
          {esportsMatches.filter((item) => item.live).map(renderMatchCard)}
          <SectionHeader title="E-sport - Avant-match" tag="E-sport" color="#7B55B5" onAll={() => setActiveTopTab('esport')} />
          {esportsMatches.filter((item) => !item.live).map(renderMatchCard)}
        </>}

        {activeTopTab === 'sports' && <>
          <SectionHeader title="TOP-EVENTS" onAll={() => setSportFilter('football')} />
          <SportsTopEventsLayout data={sportsTopEventVisuals} onPress={onTile} />
          <SectionHeader title="Populaire EN DIRECT" tag="Sport" onAll={() => setSportFilter('all')} />
          {visibleCreatedLiveMatches.map(renderMatchCard)}
          {externalLiveCouponMatches.map(renderMatchCard)}
          {externalLiveMatches.map(renderMatchCard)}
          <SectionHeader title="Le meilleur en Avant-match" tag="Sport" onAll={() => setSportFilter('football')} />
          {visibleCreatedUpcomingMatches.map(renderMatchCard)}
          {externalUpcomingMatches.slice(0, prematchVisibleLimit).map(renderMatchCard)}
          {externalUpcomingMatches.length > prematchVisibleLimit && <TouchableOpacity
            onPress={() => setPrematchVisibleLimit((current) => current + 30)}
            activeOpacity={0.8}
            style={{ alignSelf: 'center', marginVertical: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: bg.cardBg, borderWidth: 1, borderColor: bg.border }}
          ><Text style={{ color: bg.textPrimary, fontSize: 12, fontWeight: '700' }}>{`Afficher ${Math.min(30, externalUpcomingMatches.length - prematchVisibleLimit)} matchs de plus (${externalUpcomingMatches.length - prematchVisibleLimit} restants)`}</Text></TouchableOpacity>}
        </>}

        {activeTopTab === 'esport' && <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileScroll}>
            <Image source={require('@/assets/images/popular-video-crops/esports/reference/1xquest-banner.png')} style={{ width: 300, height: 105 }} resizeMode="contain" />
            <Image source={require('@/assets/images/popular-video-crops/esports/reference/1xquest-side.png')} style={{ width: 112, height: 105 }} resizeMode="contain" />
          </ScrollView>
          <SectionHeader title="TOP-EVENTS" tag="E-sport" color="#7B55B5" />
          <Image source={require('@/assets/images/popular-video-crops/esports/reference/worlds-banner.png')} style={{ width: '100%', height: 72 }} resizeMode="contain" />
          <SectionHeader title="Disciplines" tag="E-sport" color="#7B55B5" />
          <HorizontalTiles data={esports} size={70} height={112} fit="contain" onPress={onTile} />
          <Image source={require('@/assets/images/popular-video-crops/esports/reference/virtual-sports-banner.png')} style={{ width: '100%', height: 92 }} resizeMode="contain" />
          <SectionHeader title="E-sport EN DIRECT" tag="E-sport" color="#7B55B5" />
          <HorizontalTiles data={[esportsVisualTournaments[0]]} size={300} height={105} fit="contain" onPress={onTile} />
          {esportsMatches.filter((item) => item.live).map(renderMatchCard)}
          <SectionHeader title="E-sport - Avant-match" tag="E-sport" color="#7B55B5" />
          <HorizontalTiles data={[esportsVisualTournaments[1]]} size={300} height={105} fit="contain" onPress={onTile} />
          {esportsMatches.filter((item) => !item.live).map(renderMatchCard)}
          <SectionHeader title="Tournois - EN DIRECT" tag="E-sport" color="#7B55B5" />
          {tournaments.map((item) => <TournamentRow key={`esport-live-${item.id}`} item={item} onPress={() => toggleFavorite(item.id)} />)}
          <SectionHeader title="Tournois - Avant-match" tag="E-sport" color="#7B55B5" />
          {tournaments.map((item) => <TournamentRow key={`esport-upcoming-${item.id}`} item={item} onPress={() => toggleFavorite(item.id)} />)}
        </>}

        {activeTopTab === 'casino' && <>
          <SectionHeader title="Machines à sous. Populaire" tag="Casino" color="#C85F91" />
          <HorizontalTiles data={casinoPopularVisuals} size={150} height={92} fit="contain" onPress={onTile} />
          <HorizontalTiles data={casinoTopVisuals} size={92} height={124} fit="contain" onPress={onTile} />
          <Image source={require('@/assets/images/casino/reference/my-casino-banner.png')} style={styles.casinoPromoBanner} resizeMode="contain" />
          <SectionHeader title="Exclusives" tag="Casino" color="#C85F91" />
          <HorizontalTiles data={casinoExclusiveVisuals} size={128} height={128} fit="contain" onPress={onTile} />
          <SectionHeader title="1X LIVE" tag="Casino" color="#C85F91" />
          <HorizontalTiles data={casinoLiveVisuals} size={128} height={128} fit="contain" onPress={onTile} />
          <SectionHeader title="Catégories" tag="Casino" color="#C85F91" />
          <HorizontalTiles data={casinoCategories} size={70} height={115} fit="contain" onPress={onTile} />
          <SectionHeader title="Sélectionnés pour vous" tag="Casino" color="#C85F91" />
          <HorizontalTiles data={selectedCasino} size={112} height={112} fit="cover" onPress={onTile} />
        </>}

        {activeTopTab === 'games' && <View style={[styles.content, { width: '100%', maxWidth: 1000, alignSelf: 'center' }]}>
          {xgameSections.map((section) => (
            <XGameCatalogSection key={section.title} section={section} onPress={onXGameTile} />
          ))}
        </View>}

                <View style={styles.bottomSpace} />
      </ScrollView>
      <QuickBetSheet
        visible={Boolean(quickBetSelection)}
        event={quickBetSelection?.event || null}
        selectionLabel={quickBetSelection?.label || ''}
        odd={quickBetSelection?.odd || 0}
        onClose={() => setQuickBetSelection(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, container: { flex: 1, backgroundColor: PAGE }, content: { paddingBottom: 24 },
  header: { backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: '#E3E9EE' },
  balanceRow: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, plus: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#4FBE71', alignItems: 'center', justifyContent: 'center' }, plusText: { color: '#FFF', fontSize: 19, lineHeight: 20 }, balance: { color: '#385263', fontSize: 13, fontWeight: '700', marginLeft: 3 }, brand: { color: '#17649A', fontSize: 17, fontWeight: '900', fontStyle: 'italic', marginLeft: 8 }, search: { marginLeft: 'auto' },
  topNav: { minWidth: '100%', justifyContent: 'space-around', paddingHorizontal: 4 }, topNavItem: { alignItems: 'center', minWidth: 62, paddingTop: 3, paddingBottom: 6, position: 'relative' }, topIcon: { width: 22, height: 19 }, topLabel: { fontSize: 9, color: MUTED, marginTop: 1 }, activeLabel: { fontWeight: '700' }, activeLine: { height: 2, backgroundColor: BLUE, position: 'absolute', bottom: 0, left: 5, right: 5 },
  sectionHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, sectionTitle: { color: '#15354B', fontSize: 17, fontWeight: '800' }, tag: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }, tagText: { fontSize: 10, fontWeight: '600' }, allButton: { backgroundColor: '#FFF', color: MUTED, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', fontSize: 11 },
  sportScroll: { paddingHorizontal: 8, gap: 7, paddingVertical: 5 }, sportItem: { width: 62, height: 70, backgroundColor: CARD, borderRadius: 11, alignItems: 'center', justifyContent: 'center', padding: 4, borderWidth: 1, borderColor: '#E2EAF0' }, sportSelected: { backgroundColor: '#E6EFF9', borderColor: '#E2EAF0' }, sportIconImage: { width: 32, height: 32, borderRadius: 16 }, sportLabel: { color: '#40596B', fontSize: 9, lineHeight: 10, fontWeight: '600', textAlign: 'center', marginTop: 4 }, tileScroll: { paddingHorizontal: 10, gap: 8, paddingTop: 6, paddingBottom: 8 }, tileImage: { borderRadius: 12, backgroundColor: '#DDE5EA', overflow: 'hidden' }, tileTitle: { color: '#334E60', fontSize: 10, lineHeight: 13, minHeight: 26, textAlign: 'center', marginTop: 3 }, tileSubtitle: { color: MUTED, fontSize: 9, lineHeight: 12, minHeight: 12, textAlign: 'center' },
  matchCard: { marginHorizontal: 8, marginTop: 6, padding: 10, backgroundColor: CARD, borderRadius: 10, shadowColor: '#385263', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }, matchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, leagueWithIcon: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, matchSportIcon: { width: 22, height: 22 }, leagueText: { color: MUTED, fontSize: 11, flex: 1 }, matchActions: { flexDirection: 'row', gap: 11 }, teamsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 13, marginTop: 11 }, teamBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' }, team: { color: '#1B3449', fontSize: 13, fontWeight: '600', textAlign: 'center' }, teamLogo: { width: 36, height: 36, borderRadius: 18, marginTop: 5 }, score: { color: '#1B3449', fontSize: 17, fontWeight: '800' }, matchTime: { color: MUTED, fontSize: 10, textAlign: 'center', marginTop: 8 }, livePill: { alignSelf: 'center', backgroundColor: '#E85E67', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5 }, liveText: { color: '#FFF', fontSize: 9, fontWeight: '800' }, oddsRow: { flexDirection: 'row', gap: 7, marginTop: 10 }, odd: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F0F3F7', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 8 }, oddSelected: { backgroundColor: '#E9F3FA' }, oddInteractive: { borderWidth: 1, borderColor: '#D6E5F2' }, oddDisabled: { opacity: 0.72 }, oddLabel: { color: MUTED, fontSize: 10 }, oddValue: { color: '#1A364A', fontSize: 11, fontWeight: '800' },
  topEventsStack: { width: '100%', alignItems: 'center', paddingHorizontal: 10, paddingTop: 2, paddingBottom: 6 }, topEventsCard: { width: '100%', maxWidth: 560, height: 82, borderRadius: 13, overflow: 'hidden', backgroundColor: 'transparent', zIndex: 3 }, topEventsCardOverlap: { marginTop: -10, zIndex: 2 }, topEventsCardImage: { width: '100%', height: '100%' }, tournamentRow: { marginHorizontal: 8, marginTop: 5, backgroundColor: CARD, borderRadius: 9, minHeight: 53, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 8 }, tournamentIcon: { width: 32, height: 32, borderRadius: 8 }, tournamentTitle: { flex: 1, color: '#334E60', fontSize: 12 }, count: { color: MUTED, backgroundColor: '#EEF2F6', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, fontSize: 10 }, bannerScroll: { padding: 10, gap: 8 }, trendBanner: { width: 247, height: 170, borderRadius: 14 }, casinoCampaignBanner: { width: '94%', alignSelf: 'center', aspectRatio: 1200 / 525, marginTop: 6, borderRadius: 14 }, casinoPromoBanner: { width: '94%', alignSelf: 'center', aspectRatio: 914 / 202, marginTop: 6, borderRadius: 14 }, oneXGameLuckyBanner: { width: '100%', aspectRatio: 1002 / 235, marginTop: 6, borderRadius: 14 }, oneXGameJackpotBanner: { width: '100%', aspectRatio: 953 / 258, marginTop: 6, borderRadius: 14 }, featureRow: { flexDirection: 'row', gap: 8, padding: 10 }, featureCard: { flex: 1, backgroundColor: CARD, borderRadius: 12, overflow: 'hidden', paddingBottom: 8 }, featureImage: { width: '100%', height: 112 }, featureTitle: { color: '#223C50', fontWeight: '800', fontSize: 12, paddingHorizontal: 8, paddingTop: 6 }, featureSubtitle: { color: MUTED, fontSize: 10, paddingHorizontal: 8, paddingTop: 2 }, playButton: { backgroundColor: '#8D542B', marginHorizontal: 8, marginTop: 7, borderRadius: 7, alignItems: 'center', paddingVertical: 6 }, playText: { color: '#FFF', fontWeight: '800', fontSize: 11 }, bottomSpace: { height: 70 },
});
