import React from 'react';
import { Dimensions, Image, ImageBackground, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CircularFlag } from '@/components/CircularFlag';
import { TeamLogo } from '@/components/TeamLogo';
import { TabBar } from '@/components/TabBar';
import { useBetStore } from '@/store/useBetStore';
import { getFifaSimulationState } from '@/utils/localFifaSimulation';
import { getMortalKombatSimulationState } from '@/utils/localMortalKombatSimulation';
import { getPokerSimulationState } from '@/utils/localPokerSimulation';
import { isMortalKombatEvent } from '@/utils/mortalKombat';
import { formatOdd } from '@/utils/format';
import { VideoView, useVideoPlayer } from 'expo-video';
import MortalKombatDetails from '@/components/MortalKombatDetails';
import FifaMatchDetails from '@/components/FifaMatchDetails';
import QuickBetSheet from '@/components/QuickBetSheet';
import { BetEvent } from '@/types/bet';
import { getBackgroundPalette } from '@/constants/theme';
import { fetchLiveFootballOddsForFixture } from '@/services/sportsDataApi';
import { buildFootballMarkets, marketsForPeriod } from '@/utils/footballMarketCatalog';

const BLUE = '#4B91D5';
const PALE_BLUE = '#EAF5FC';
const NAVY = '#082A46';
const PINNED_ICON = require('../../assets/images/custom-icons/pinned.png');
const CAROUSEL_WIDTH = Dimensions.get('window').width - 32;

type Market = { title: string; columns: { label: string; odd: string }[] };

const stableNumber = (left: string, right: string, salt: number) => [...`${left}:${right}:${salt}`].reduce((sum, char) => sum + char.charCodeAt(0), salt * 17) % 100;
const odd = (left: string, right: string, salt: number, floor = 1.05) => (floor + (stableNumber(left, right, salt) % 430) / 100).toFixed(2);
const POKER_COMBINATIONS = ['Carte haute', 'Une paire', 'Deux paires', 'Brelan', 'Quinte', 'Couleur', 'Full House', 'Carré', 'Quinte flush', 'Quinte flush royale'];
const POKER_HANDS = ['Main 1', 'Main 2', 'Main 3', 'Main 4', 'Main 5', 'Main 6'];
const REGULATION_TOTAL_POINTS = [0.5, 1.5, 2.5, 3.5, 4.5];
const REGULATION_HANDICAPS: Array<{ side: 'home' | 'away'; point: number }> = [
  { side: 'home', point: -2.5 }, { side: 'home', point: -1.5 }, { side: 'home', point: -0.5 },
  { side: 'away', point: 0.5 }, { side: 'away', point: 1.5 }, { side: 'away', point: 2.5 },
];
const makeMarkets = (team1: string, team2: string, marketOdds?: BetEvent['marketOdds'], marketLines?: BetEvent['marketLines'], additionalOdds?: BetEvent['additionalOdds'], oddsProvider?: BetEvent['oddsProvider'], footballEvent = false): Market[] => {
  if (footballEvent || oddsProvider === 'the-odds-api') {
    const price = (value?: number) => value && value > 1 ? value.toFixed(2) : '—';
    const formatPoint = (point: number) => String(point);
    const totals = marketLines?.totals || [];
    const totalPoints = Array.from(new Set([...REGULATION_TOTAL_POINTS, ...totals.map((line) => line.point)])).sort((a, b) => a - b);
    const totalColumns = totalPoints.flatMap((point) => {
      const line = totals.find((item) => item.point === point);
      return [
        { label: `Plus de buts (${formatPoint(point)})`, odd: price(line?.over) },
        { label: `Moins de buts (${formatPoint(point)})`, odd: price(line?.under) },
      ];
    });
    const handicapChoices = new Map<string, { side: 'home' | 'away'; point: number; odd?: number }>();
    const addHandicap = (side: 'home' | 'away', point: number, value?: number) => {
      const key = `${side}:${point}`;
      const existing = handicapChoices.get(key);
      handicapChoices.set(key, { side, point, odd: value ?? existing?.odd });
    };
    REGULATION_HANDICAPS.forEach(({ side, point }) => addHandicap(side, point, marketLines?.spreads?.find((line) => line.point === point)?.[side]));
    (marketLines?.spreads || []).forEach((line) => {
      if (line.home !== undefined) addHandicap('home', line.point, line.home);
      if (line.away !== undefined) addHandicap('away', line.point, line.away);
    });
    const handicapColumns = Array.from(handicapChoices.values()).map(({ side, point, odd: value }) => {
      const team = side === 'home' ? team1 : team2;
      return { label: `${team} (${point > 0 ? '+' : ''}${formatPoint(point)})`, odd: price(value) };
    });
    const teamTotalPoints = [0.5, 1.5, 2.5];
    const teamTotalColumns = (lines: Array<{ point: number; over?: number; under?: number }>, team: string) => teamTotalPoints.flatMap((point) => {
      const line = lines.find((item) => item.point === point);
      return [
        { label: `${team} — plus de (${formatPoint(point)})`, odd: price(line?.over) },
        { label: `${team} — moins de (${formatPoint(point)})`, odd: price(line?.under) },
      ];
    });
    return [
      { title: '1X2', columns: [{ label: 'V1', odd: price(marketOdds?.v1) }, { label: 'X', odd: price(marketOdds?.draw) }, { label: 'V2', odd: price(marketOdds?.v2) }] },
      { title: 'Double chance', columns: [{ label: '1X', odd: '—' }, { label: '12', odd: '—' }, { label: 'X2', odd: '—' }] },
      { title: 'Les deux équipes marquent', columns: [{ label: 'Oui', odd: price(additionalOdds?.btts?.yes) }, { label: 'Non', odd: price(additionalOdds?.btts?.no) }] },
      { title: 'Résultat nul remboursé', columns: [{ label: team1, odd: price(additionalOdds?.drawNoBet?.home) }, { label: team2, odd: price(additionalOdds?.drawNoBet?.away) }] },
      { title: 'Total de buts', columns: totalColumns },
      { title: 'Handicap', columns: handicapColumns },
      { title: 'Total équipe 1', columns: teamTotalColumns(marketLines?.homeTeamTotals || [], team1) },
      { title: 'Total équipe 2', columns: teamTotalColumns(marketLines?.awayTeamTotals || [], team2) },
    ];
  }
  return [
  { title: 'Score exact', columns: [{ label: '1 : 0', odd: odd(team1, team2, 37, 4.5) }, { label: '0 : 0', odd: odd(team1, team2, 38, 2.8) }, { label: '0 : 1', odd: odd(team2, team1, 39, 3.5) }, { label: '2 : 0', odd: odd(team1, team2, 40, 5.5) }, { label: '1 : 1', odd: odd(team2, team1, 41, 3.5) }, { label: '0 : 2', odd: odd(team2, team1, 42, 5.5) }, { label: '2 : 1', odd: odd(team1, team2, 43, 5.5) }, { label: '2 : 2', odd: odd(team2, team1, 44, 5.5) }, { label: '3 : 0', odd: odd(team1, team2, 45, 5.5) }, { label: '0 : 3', odd: odd(team2, team1, 46, 5.5) }] },
  { title: '1X2', columns: [{ label: 'V1', odd: marketOdds?.v1 ? marketOdds.v1.toFixed(2) : odd(team1, team2, 1, 1.8) }, { label: 'X', odd: marketOdds?.draw ? marketOdds.draw.toFixed(2) : odd(team1, team2, 2, 3.1) }, { label: 'V2', odd: marketOdds?.v2 ? marketOdds.v2.toFixed(2) : odd(team2, team1, 3, 1.8) }] },
  { title: 'Double chance', columns: [{ label: '1X', odd: odd(team1, team2, 4) }, { label: '12', odd: odd(team1, team2, 5) }, { label: '2X', odd: odd(team2, team1, 6) }] },
  { title: 'Total de buts', columns: [{ label: 'Plus de buts (8.5)', odd: odd(team1, team2, 7) }, { label: 'Moins de buts (8.5)', odd: odd(team2, team1, 8) }, { label: 'Plus de buts (9.5)', odd: odd(team1, team2, 9) }, { label: 'Moins de buts (9.5)', odd: odd(team2, team1, 10) }] },
  { title: 'Handicap', columns: [{ label: 'Équipe 1 (-1.5)', odd: odd(team1, team2, 11) }, { label: 'Équipe 2 (+1.5)', odd: odd(team2, team1, 12) }, { label: 'Équipe 1 (-2.5)', odd: odd(team1, team2, 13) }, { label: 'Équipe 2 (+2.5)', odd: odd(team2, team1, 14) }] },
  { title: 'Total 1', columns: [{ label: '(0.5) Plus de', odd: '1.33' }, { label: '(0.5) Moins de', odd: '3.20' }, { label: '(1) Plus de', odd: odd(team1, team2, 17) }, { label: '(1) Moins de', odd: odd(team1, team2, 18) }] },
  { title: 'Total 2', columns: [{ label: 'Plus (4.5)', odd: odd(team2, team1, 19) }, { label: 'Moins (4.5)', odd: odd(team2, team1, 20) }, { label: 'Plus (5.5)', odd: odd(team2, team1, 21) }, { label: 'Moins (5.5)', odd: odd(team2, team1, 22) }] },
  { title: 'Buts', columns: [{ label: 'Plus de buts (0.5)', odd: odd(team1, team2, 23) }, { label: 'Plus de buts (1.5)', odd: odd(team1, team2, 24) }, { label: 'Plus de buts (2.5)', odd: odd(team1, team2, 25) }, { label: 'Moins de buts (2.5)', odd: odd(team2, team1, 26) }] },
  { title: 'Les deux équipes marquent', columns: [{ label: 'Oui', odd: odd(team1, team2, 27) }, { label: 'Non', odd: odd(team2, team1, 28) }] },
  { title: 'Corners', columns: [{ label: 'Plus de corners (4.5)', odd: odd(team1, team2, 29) }, { label: 'Moins de corners (4.5)', odd: odd(team2, team1, 30) }, { label: 'Plus de corners (8.5)', odd: odd(team1, team2, 31) }, { label: 'Moins de corners (8.5)', odd: odd(team2, team1, 32) }] },
  { title: 'Cartons', columns: [{ label: 'Plus de cartons (2.5)', odd: odd(team1, team2, 33) }, { label: 'Moins de cartons (2.5)', odd: odd(team2, team1, 34) }, { label: 'Plus de cartons (4.5)', odd: odd(team1, team2, 35) }, { label: 'Moins de cartons (4.5)', odd: odd(team2, team1, 36) }] },
  ];
};

function MarketSection({ market, pinned, onToggle, onSelect, referenceStyle = false }: { market: Market; pinned: boolean; onToggle: () => void; onSelect: (label: string, odd: number) => void; referenceStyle?: boolean }) {
  const [expanded, setExpanded] = React.useState(market.title === '1X2' || market.title === 'Double chance');
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const theme = useBetStore((state) => state.theme);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';
  return <View style={[styles.marketSection, referenceStyle && referenceStyles.marketSection, { borderTopColor: bg.divider, backgroundColor: bg.appBg }]}>
    <View style={[styles.marketHeader, referenceStyle && referenceStyles.marketHeader, { backgroundColor: bg.cardBg }]}><Text style={[styles.marketTitle, referenceStyle && referenceStyles.marketTitle, { color: bg.textPrimary }]}>{market.title} ({market.columns.length})</Text><View style={styles.marketActions}><TouchableOpacity onPress={onToggle}><Image source={PINNED_ICON} style={{ width: 22, height: 22, opacity: pinned ? 1 : 0.45, tintColor: activeColor }} resizeMode="contain" /></TouchableOpacity><TouchableOpacity onPress={() => setExpanded((value) => !value)}><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={bg.textSecondary} /></TouchableOpacity></View></View>
    {expanded && <View style={[styles.oddsGrid, referenceStyle && referenceStyles.oddsGrid]}>{market.columns.map((item) => { const value = Number(item.odd); const available = Number.isFinite(value) && value > 1; return <TouchableOpacity key={`${market.title}-${item.label}`} disabled={!available} style={[styles.oddCell, referenceStyle && referenceStyles.oddCell, { backgroundColor: bg.cardBg }, !available && { opacity: 0.65 }]} activeOpacity={available ? 0.75 : 1} onPress={() => { if (available) onSelect(`${market.title}. ${item.label}`, value); }}><Text style={[styles.oddLabel, referenceStyle && referenceStyles.oddLabel, { color: bg.textSecondary }]}>{item.label}</Text><Text style={[styles.oddValue, referenceStyle && referenceStyles.oddValue, { color: bg.textPrimary }]}>{item.odd}</Text></TouchableOpacity>; })}</View>}
  </View>;
}

function InformationCarousel({ team1, team2, score, selectedEvent, simulation, referenceStyle = false }: { team1: string; team2: string; score: string; selectedEvent: any; simulation: any; referenceStyle?: boolean }) {
  const [page, setPage] = React.useState(0);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const venue = selectedEvent.venue || selectedEvent.stadium || selectedEvent.location || 'Stade de la rencontre';
  const previous = [
    [`${stableNumber(team1, team2, 31) % 5} : ${stableNumber(team2, team1, 32) % 5}`, '27.07.2026'],
    [`${stableNumber(team2, team1, 33) % 4} : ${stableNumber(team1, team2, 34) % 4}`, '08.12.2025'],
    [`${stableNumber(team1, team2, 35) % 3} : ${stableNumber(team2, team1, 36) % 3}`, '10.03.2025'],
  ];
  return <View style={[styles.carouselWrap, referenceStyle && referenceStyles.carouselWrap, { backgroundColor: bg.appBg }]}>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / (referenceStyle ? Dimensions.get('window').width - 8 : CAROUSEL_WIDTH)))}>
      <View style={[styles.infoSlide, referenceStyle && referenceStyles.infoSlide, { width: referenceStyle ? Dimensions.get('window').width - 8 : CAROUSEL_WIDTH }]}><ImageBackground source={require('../../assets/images/stadium_bg.png')} style={styles.infoBackground} imageStyle={[styles.infoBackgroundImage, ]}><View style={[styles.infoOverlay, referenceStyle && referenceStyles.infoOverlay]}><Text style={[styles.infoCompetition, referenceStyle && referenceStyles.infoCompetition, referenceStyle && { color: '#D9E8EF' }]}>{selectedEvent.tournament}</Text><Text style={[styles.infoStatus, referenceStyle && referenceStyles.infoStatus, referenceStyle && { color: '#FFFFFF' }]}>{selectedEvent.isLive ? 'Mi-temps' : selectedEvent.date}</Text><View style={[styles.infoScoreRow, referenceStyle && referenceStyles.infoScoreRow]}>{referenceStyle ? (<><View style={referenceStyles.infoTeamBlock}><Text style={[referenceStyles.infoTeam, { color: '#FFFFFF' }]} numberOfLines={1}>{team1}</Text>{String(selectedEvent.sport || '').trim().toLowerCase() === 'football' ? <TeamLogo uri={selectedEvent.team1Logo} size={22} accessibilityLabel={`Écusson ${team1}`} /> : selectedEvent.team1Logo && /^https:\/\//i.test(selectedEvent.team1Logo) ? <TeamLogo uri={selectedEvent.team1Logo} size={22} accessibilityLabel={`Logo ${team1}`} /> : <CircularFlag countryCode={selectedEvent.team1CountryCode} size={22} teamName={team1} />}</View><Text style={[styles.infoScore, referenceStyles.infoScore, { color: '#FFFFFF' }]}>{score.replace(/\s*[-:]\s*/g, ' : ')}</Text><View style={[referenceStyles.infoTeamBlock, referenceStyles.infoTeamAway]}>{String(selectedEvent.sport || '').trim().toLowerCase() === 'football' ? <TeamLogo uri={selectedEvent.team2Logo} size={22} accessibilityLabel={`Écusson ${team2}`} /> : selectedEvent.team2Logo && /^https:\/\//i.test(selectedEvent.team2Logo) ? <TeamLogo uri={selectedEvent.team2Logo} size={22} accessibilityLabel={`Logo ${team2}`} /> : <CircularFlag countryCode={selectedEvent.team2CountryCode} size={22} teamName={team2} />}<Text style={[referenceStyles.infoTeam, { color: '#FFFFFF' }]} numberOfLines={1}>{team2}</Text></View></>) : (<><Text style={styles.infoTeam} numberOfLines={1}>{team1}</Text><Text style={styles.infoScore}>{score.replace(/\s*[-:]\s*/g, ' : ')}</Text><Text style={styles.infoTeam} numberOfLines={1}>{team2}</Text></>)}</View><Text style={[styles.infoSub, referenceStyle && referenceStyles.infoSub, referenceStyle && { color: '#D9E8EF' }]}>{selectedEvent.isLive ? `temps écoulé : ${simulation?.displayMatchTime || selectedEvent.liveTime || '45:00'}` : selectedEvent.date}</Text></View></ImageBackground></View>
      <View style={[styles.infoSlide, referenceStyle && referenceStyles.infoSlide, { width: referenceStyle ? Dimensions.get('window').width - 8 : CAROUSEL_WIDTH }]}><ImageBackground source={require('../../assets/images/stadium_bg.png')} style={styles.infoBackground} imageStyle={[styles.infoBackgroundImage, ]}><View style={[styles.previousPanel, referenceStyle && referenceStyles.previousPanel, referenceStyle && { backgroundColor: 'rgba(3, 31, 49, 0.82)' }]}><Text style={[styles.previousTitle, referenceStyle && referenceStyles.previousTitle, referenceStyle && { color: '#FFFFFF' }]}>Précédentes confrontations</Text>{previous.map(([result, date], index) => <View style={styles.previousRow} key={`${result}-${date}`}><View style={styles.previousTeam}><View style={styles.resultDot} /><Text style={[styles.previousName, referenceStyle && referenceStyles.previousName, referenceStyle && { color: '#FFFFFF' }]} numberOfLines={1}>{index % 2 ? team2 : team1}</Text></View><View style={styles.previousScore}><Text style={[styles.previousScoreText, referenceStyle && referenceStyles.previousScoreText, referenceStyle && { color: '#FFFFFF' }]}>{result}</Text><Text style={[styles.previousDate, referenceStyle && referenceStyles.previousDate, referenceStyle && { color: '#D9E8EF' }]}>{date}</Text></View><View style={[styles.previousTeam, styles.previousAway]}><Text style={[styles.previousName, referenceStyle && referenceStyles.previousName, referenceStyle && { color: '#FFFFFF' }]} numberOfLines={1}>{index % 2 ? team1 : team2}</Text><View style={[styles.resultDot, { backgroundColor: '#E72752' }]} /></View></View>)}<TouchableOpacity style={styles.expandButton}><Ionicons name="chevron-down" size={15} color="#FFFFFF" /><Text style={styles.expandText}>AGRANDIR</Text></TouchableOpacity><Text style={[styles.previousFooter, referenceStyle && { color: '#D9E8EF' }]}>{team1} - {team2}</Text></View></ImageBackground></View>
      <View style={[styles.infoSlide, referenceStyle && referenceStyles.infoSlide, { width: referenceStyle ? Dimensions.get('window').width - 8 : CAROUSEL_WIDTH }]}><ImageBackground source={require('../../assets/images/stadium_bg.png')} style={styles.infoBackground} imageStyle={[styles.infoBackgroundImage, ]}><View style={[styles.stadiumPanel, referenceStyle && { backgroundColor: 'rgba(3, 31, 49, 0.82)' }]}><View style={styles.stadiumPhotos}><Image source={require('../../assets/images/stadium_new.jpg')} style={styles.stadiumMainPhoto} /><View style={styles.stadiumThumbs}><Image source={require('../../assets/images/stadium_bg.png')} style={styles.stadiumThumb} /><Image source={require('../../assets/images/stadium_new.jpg')} style={styles.stadiumThumb} /></View></View><View style={[styles.stadiumDetails, referenceStyle && { backgroundColor: 'rgba(3, 31, 49, 0.62)' }]}><Text style={[styles.stadiumTitle, referenceStyle && referenceStyles.stadiumTitle, referenceStyle && { color: '#FFFFFF' }]}>{venue}</Text><Text style={[styles.stadiumFact, referenceStyle && referenceStyles.stadiumFact, referenceStyle && { color: '#D9E8EF' }]}>Adresse : {selectedEvent.location || '—'}</Text><Text style={[styles.stadiumFact, referenceStyle && referenceStyles.stadiumFact, referenceStyle && { color: '#D9E8EF' }]}>Surface : {selectedEvent.surface || 'Gazonnée'}</Text><Text style={[styles.stadiumFact, referenceStyle && referenceStyles.stadiumFact, referenceStyle && { color: '#D9E8EF' }]}>Ville : {selectedEvent.city || '—'}</Text><Text style={[styles.stadiumFact, referenceStyle && referenceStyles.stadiumFact, referenceStyle && { color: '#D9E8EF' }]}>Ouvert : {selectedEvent.opened || '—'}</Text><Text style={[styles.stadiumFact, referenceStyle && referenceStyles.stadiumFact, referenceStyle && { color: '#D9E8EF' }]}>Téléphone : {selectedEvent.phone || '—'}</Text></View><Text style={[styles.stadiumFooter, referenceStyle && { color: '#D9E8EF' }]}>{team1} - {team2}</Text></View></ImageBackground></View>
      <View style={[styles.infoSlide, referenceStyle && referenceStyles.infoSlide, { width: referenceStyle ? Dimensions.get('window').width - 8 : CAROUSEL_WIDTH }]}><ImageBackground source={require('../../assets/images/stadium_bg.png')} style={styles.infoBackground} imageStyle={[styles.infoBackgroundImage, ]}><View style={[styles.detailPanel, referenceStyle && referenceStyles.detailPanel, referenceStyle && { backgroundColor: 'rgba(3, 31, 49, 0.82)' }]}><Text style={[styles.detailTitle, referenceStyle && referenceStyles.detailTitle, referenceStyle && { color: '#FFFFFF' }]}>Informations du match</Text><Text style={[styles.detailLine, referenceStyle && referenceStyles.detailLine, referenceStyle && { color: '#D9E8EF' }]}>{team1} - {team2}</Text><Text style={[styles.detailLine, referenceStyle && referenceStyles.detailLine, referenceStyle && { color: '#D9E8EF' }]}>{selectedEvent.tournament}</Text><Text style={[styles.detailLine, referenceStyle && referenceStyles.detailLine, referenceStyle && { color: '#D9E8EF' }]}>{selectedEvent.isLive ? `Score actuel : ${score}` : `Coup d’envoi : ${selectedEvent.date}`}</Text><Text style={[styles.detailLine, referenceStyle && referenceStyles.detailLine, referenceStyle && { color: '#D9E8EF' }]}>{selectedEvent.isLive ? `Temps écoulé : ${simulation?.displayMatchTime || selectedEvent.liveTime || '45:00'}` : 'Match à venir'}</Text></View></ImageBackground></View>
    </ScrollView>
    <View style={[styles.pageDots, referenceStyle && referenceStyles.pageDots]}>{[0, 1, 2, 3].map((dot) => <View key={dot} style={[styles.pageDot, referenceStyle && referenceStyles.pageDot, page === dot && styles.pageDotActive, page === dot && referenceStyle && referenceStyles.pageDotActive, referenceStyle && { backgroundColor: page === dot ? '#4C86C6' : 'rgba(207, 229, 237, .55)' }]} />)}</View>
  </View>;
}

export default function MatchDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const selectedEvent = useBetStore((state) => state.selectedEvent);
  const setSelectedEvent = useBetStore((state) => state.setSelectedEvent);
  const addEventToSlip = useBetStore((state) => state.addEventToSlip);
  const setActiveTab = useBetStore((state) => state.setActiveTab);
  const setShowMatchDetails = useBetStore((state) => state.setShowMatchDetails);
  const [period, setPeriod] = React.useState('Temps réglementaire');
  const [marketSearch, setMarketSearch] = React.useState('');
  const [activeView, setActiveView] = React.useState<'Information' | 'Diffusions' | 'Diffusion'>('Information');
  React.useEffect(() => { setPeriod('Temps réglementaire'); }, [selectedEvent?.id]);
  const isMortalKombat = Boolean(selectedEvent && isMortalKombatEvent(selectedEvent));
  const isPoker = Boolean(selectedEvent && (selectedEvent.sport === 'Poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(selectedEvent.tournament)));
  const isFifa = Boolean(selectedEvent && (selectedEvent.sport === 'FIFA' || selectedEvent.tournament.trim().toUpperCase().startsWith('FIFA')));
  const isReferenceFootball = Boolean(selectedEvent && String(selectedEvent.sport || '').trim().toLowerCase() === 'football' && !isPoker && !isMortalKombat && !isFifa);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';
  const mortalCombatPlayer = useVideoPlayer(require('../../assets/videos/mortal-kombat-combat.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.pause();
  });
  const pokerPlayer = useVideoPlayer(require('../../assets/videos/ltar-poker-dealer.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.pause();
  });
  const fifaPlayer = useVideoPlayer(require('../../assets/videos/fifa-live-gameplay.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.pause();
  });
  const [pinnedMarkets, setPinnedMarkets] = React.useState<string[]>([]);
  const [quickBetSelection, setQuickBetSelection] = React.useState<{ event: BetEvent; label: string; odd: number } | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [clockMs, setClockMs] = React.useState(Date.now());
  React.useEffect(() => { if (!selectedEvent?.scheduledAt && !selectedEvent?.liveStartedAt && !isPoker && !isMortalKombat && !isFifa) return undefined; const timer = setInterval(() => setClockMs(Date.now()), 1000); return () => clearInterval(timer); }, [selectedEvent?.scheduledAt, selectedEvent?.liveStartedAt, isPoker, isMortalKombat, isFifa]);
  React.useEffect(() => {
    const fixtureId = selectedEvent?.providerEventId;
    if (selectedEvent?.provider !== 'api-football' || !selectedEvent.isLive || !fixtureId) return undefined;
    let cancelled = false;
    const refreshLiveOdds = async () => {
      const snapshot = await fetchLiveFootballOddsForFixture(fixtureId);
      if (!snapshot || cancelled) return;
      const current = useBetStore.getState().selectedEvent;
      if (!current || current.id !== selectedEvent.id) return;
      setSelectedEvent({
        ...current,
        ...(snapshot.score ? { score: snapshot.score } : {}),
        ...(snapshot.liveTime ? { liveTime: snapshot.liveTime } : {}),
        marketOdds: { ...current.marketOdds, ...snapshot.marketOdds },
        ...(snapshot.providerMarkets.length ? { providerMarkets: snapshot.providerMarkets } : {}),
        ...(snapshot.status ? { liveOddsStatus: snapshot.status } : {}),
        ...(snapshot.updatedAt ? { liveOddsUpdatedAt: snapshot.updatedAt } : {}),
        ...(snapshot.status?.finished ? { isLive: false } : {}),
      });
    };
    void refreshLiveOdds();
    const timer = setInterval(() => { void refreshLiveOdds(); }, 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selectedEvent?.id, selectedEvent?.provider, selectedEvent?.providerEventId, selectedEvent?.isLive, setSelectedEvent]);

  const mortalSimulation = selectedEvent && isMortalKombat ? getMortalKombatSimulationState(selectedEvent, clockMs) : null;
  const simulation = selectedEvent && (selectedEvent.sport === 'FIFA' || selectedEvent.tournament.trim().toUpperCase().startsWith('FIFA')) ? getFifaSimulationState(selectedEvent as any, clockMs) : null;
  const pokerSimulation = selectedEvent && isPoker ? getPokerSimulationState(selectedEvent, clockMs) : null;
  const pokerElapsedMs = pokerSimulation?.elapsedMs || 0;
  const pokerElapsedLabel = `${String(Math.floor(pokerElapsedMs / 60000)).padStart(2, '0')}:${String(Math.floor((pokerElapsedMs % 60000) / 1000)).padStart(2, '0')}`;
  React.useEffect(() => {
    if (isMortalKombat && mortalSimulation?.isLive) mortalCombatPlayer.play();
    else mortalCombatPlayer.pause();
  }, [isMortalKombat, mortalSimulation?.isLive, mortalCombatPlayer]);
  React.useEffect(() => {
    if (!isPoker) {
      pokerPlayer.pause();
      return;
    }
    if (activeView === 'Diffusions') pokerPlayer.play(); else pokerPlayer.pause();
  }, [isPoker, activeView, pokerPlayer]);
  React.useEffect(() => {
    if (isFifa && simulation?.isLive) fifaPlayer.play(); else fifaPlayer.pause();
  }, [isFifa, simulation?.isLive, fifaPlayer]);
  const team1 = selectedEvent?.team1 || '';
  const team2 = selectedEvent?.team2 || '';
  const footballMarkets = selectedEvent && String(selectedEvent.sport || '').trim().toLowerCase() === 'football'
    ? buildFootballMarkets({ ...selectedEvent, id: selectedEvent.id, team1, team2 })
    : [];
  const markets = selectedEvent
    ? String(selectedEvent.sport || '').trim().toLowerCase() === 'football'
      ? marketsForPeriod(footballMarkets, period, selectedEvent.id)
      : makeMarkets(team1, team2, selectedEvent.marketOdds, selectedEvent.marketLines, selectedEvent.additionalOdds, selectedEvent.oddsProvider, false)
    : [];
  const visibleMarkets = isReferenceFootball && marketSearch.trim()
    ? markets.filter((market) => market.title.toLocaleLowerCase('fr').includes(marketSearch.trim().toLocaleLowerCase('fr')))
    : markets;
  const score = simulation?.displayScore || selectedEvent?.score || 'VS';
  const setPinned = (title: string) => setPinnedMarkets((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);
  const onRefresh = React.useCallback(() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 800); }, []);
  const openQuickBet = (label: string, oddValue: number) => {
    if (!selectedEvent || !Number.isFinite(oddValue) || oddValue <= 0) return;
    setQuickBetSelection({ event: selectedEvent, label, odd: oddValue });
  };
  const selectPokerMarket = (label: string, oddValue: number) => {
    if (!selectedEvent) return;
    addEventToSlip({ ...selectedEvent, sport: 'Poker', tournament: 'TvBet Poker', betType: label, odd: oddValue, status: 'Accepté' });
    setActiveTab('coupon');
    setShowMatchDetails(false);
    router.back();
  };

  return <View style={[styles.container, { backgroundColor: bg.appBg }]}>
    <StatusBar barStyle={bg.statusBarStyle} backgroundColor={bg.headerBg} />
    <ScrollView style={[styles.scroll, { backgroundColor: bg.appBg }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={bg.textPrimary} colors={[BLUE]} />}>
       {!isFifa && <View style={[styles.hero, !isPoker && !isMortalKombat && styles.footballHero, isReferenceFootball && referenceStyles.hero, isPoker && { backgroundColor: '#13181E' }, { paddingTop: insets.top + (isReferenceFootball ? 2 : 8), backgroundColor: isReferenceFootball ? bg.headerBg : undefined }]}> 
         {isReferenceFootball && <ImageBackground source={require('../../assets/images/stadium_bg.png')} style={StyleSheet.absoluteFill} imageStyle={referenceStyles.heroImage}><View pointerEvents="none" style={referenceStyles.heroOverlay} /></ImageBackground>}
         <View style={[styles.topBar, isReferenceFootball && referenceStyles.topBar]}>
<TouchableOpacity onPress={() => { setShowMatchDetails(false); router.back(); }} style={styles.topButton}><Ionicons name="chevron-back" size={27} color="#FFFFFF" /></TouchableOpacity><Text style={[styles.topTitle, isReferenceFootball && referenceStyles.topTitle, { color: '#FFFFFF' }]}>{isMortalKombat ? 'Mortal Kombat' : isPoker ? 'TvBet Poker' : selectedEvent ? `${selectedEvent.sport} · ${selectedEvent.tournament}` : ''}</Text><View style={styles.topActions}><TouchableOpacity style={styles.topButton}><Ionicons name="notifications-outline" size={23} color="#FFFFFF" /></TouchableOpacity><TouchableOpacity style={styles.topButton}><Ionicons name="ellipsis-vertical" size={23} color="#FFFFFF" /></TouchableOpacity></View></View>
         {selectedEvent && !isPoker && !isMortalKombat && !isReferenceFootball && <View style={styles.footballSummary}>
           <Text style={styles.footballCompetition}>{selectedEvent.tournament}</Text>
           <View style={styles.footballTeams}>
             <View style={styles.footballTeam}>{String(selectedEvent.sport || '').trim().toLowerCase() === 'football' ? <TeamLogo uri={selectedEvent.team1Logo} size={36} accessibilityLabel={`Écusson ${team1}`} /> : selectedEvent.team1Logo?.startsWith('https://') ? <TeamLogo uri={selectedEvent.team1Logo} size={36} accessibilityLabel={`Logo ${team1}`} /> : <CircularFlag countryCode={selectedEvent.team1CountryCode} size={30} teamName={team1} />}<Text style={styles.footballTeamName} numberOfLines={2}>{team1}</Text></View>
             <View style={styles.footballScore}><Text style={styles.footballScoreText}>{score.replace(/\s*[-:]\s*/g, ' : ')}</Text><Text style={styles.footballTime}>{selectedEvent.isLive ? (selectedEvent.liveTime || '45:00') : selectedEvent.date}</Text></View>
             <View style={styles.footballTeam}>{String(selectedEvent.sport || '').trim().toLowerCase() === 'football' ? <TeamLogo uri={selectedEvent.team2Logo} size={36} accessibilityLabel={`Écusson ${team2}`} /> : selectedEvent.team2Logo?.startsWith('https://') ? <TeamLogo uri={selectedEvent.team2Logo} size={36} accessibilityLabel={`Logo ${team2}`} /> : <CircularFlag countryCode={selectedEvent.team2CountryCode} size={30} teamName={team2} />}<Text style={styles.footballTeamName} numberOfLines={2}>{team2}</Text></View>
           </View>
           <View style={styles.footballMeta}><Ionicons name="football-outline" size={14} color="#D8EEF8" /><Text style={styles.footballMetaText}>{selectedEvent.isLive ? 'EN DIRECT' : 'Avant-match'}</Text><Text style={styles.footballMetaText}>·</Text><Text style={styles.footballMetaText}>{selectedEvent.date}</Text></View>
         </View>}
         {isReferenceFootball && <View style={referenceStyles.headerContent}>
           <View style={referenceStyles.segmented}>
             {(['Information', 'Diffusions'] as const).map((view) => <TouchableOpacity key={view} onPress={() => setActiveView(view)} style={[referenceStyles.segment, activeView === view && referenceStyles.segmentActive]}><Text style={[referenceStyles.segmentText, activeView === view && referenceStyles.segmentTextActive]}>{view}</Text></TouchableOpacity>)}
           </View>
           {activeView === 'Information'
             ? <InformationCarousel team1={team1} team2={team2} score={score} selectedEvent={selectedEvent} simulation={simulation} referenceStyle />
             : <View style={[referenceStyles.diffusionSlide, { backgroundColor: bg.appBg }]}><Ionicons name="videocam-outline" size={21} color={bg.textSecondary} /><Text style={[referenceStyles.diffusionText, { color: bg.textSecondary }]}>Diffusions</Text></View>}
         </View>}
         {!selectedEvent && <View style={styles.emptyHero}><Text style={styles.emptyTitle}>Aucun match sélectionné</Text><Text style={styles.emptyText}>Choisissez une équipe et son adversaire pour afficher les informations de cette rencontre.</Text></View>}
       </View>}
      {selectedEvent && (isPoker ? (
        <>
          <View style={[pokerStyles.pokerSegmented, { backgroundColor: bg.appBg }] }>
            {(['Information', 'Diffusions'] as const).map((view) => <TouchableOpacity key={view} onPress={() => setActiveView(view)} style={[pokerStyles.pokerSegment, activeView === view && pokerStyles.pokerSegmentActive]}><Text style={[pokerStyles.pokerSegmentText, activeView === view && pokerStyles.pokerSegmentTextActive]}>{view}</Text></TouchableOpacity>)}
          </View>
          <View style={[pokerStyles.pokerMedia, { aspectRatio: 400 / 224, width: Math.max(1, windowWidth - 8) }]}>
            {activeView === 'Diffusions' ? (
              <View style={pokerStyles.pokerVideoStage}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <VideoView pointerEvents="none" player={pokerPlayer} style={pokerStyles.pokerVideo} contentFit="contain" nativeControls={false} fullscreenOptions={{ enable: false }} />
                </View>
                <View pointerEvents="none" style={pokerStyles.pokerHud}>
                  <View style={pokerStyles.pokerInfoBox}><Ionicons name="location-outline" size={12} color="#FFFFFF" /><Text style={pokerStyles.pokerInfoText}>MONACO</Text></View>
                  <View style={pokerStyles.pokerInfoBox}><Text style={pokerStyles.pokerClock}>02:31</Text><Text style={pokerStyles.pokerInfoText}>WARSAW</Text></View>
                </View>
              </View>
            ) : (
              <ImageBackground source={require('../../assets/images/poker-information-background.jpeg')} style={pokerStyles.pokerInformation} imageStyle={pokerStyles.pokerInformationImage}>
                <View style={pokerStyles.pokerInformationOverlay}><Text style={pokerStyles.pokerInformationTitle}>POKER</Text><Text style={pokerStyles.pokerInformationDate}>{selectedEvent.date}</Text><Text style={pokerStyles.pokerInformationTime}>temps écoulé : {pokerElapsedLabel}</Text></View>
              </ImageBackground>
            )}
          </View>
          <View style={[pokerStyles.pokerPeriodBar, { backgroundColor: bg.appBg }]}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}><TouchableOpacity style={pokerStyles.pokerPeriodPill}><Text style={pokerStyles.pokerPeriodText}>Temps réglementaire</Text></TouchableOpacity></ScrollView></View>
          <View style={[styles.markets, { backgroundColor: bg.appBg }]}>
            <View style={[pokerStyles.pokerMarketSection, { backgroundColor: bg.appBg, borderTopColor: bg.divider }]}><View style={styles.marketHeader}><Text style={[pokerStyles.pokerMarketTitle, { color: bg.textPrimary }]}>Combinaison gagnante</Text><View style={styles.marketActions}><Image source={PINNED_ICON} style={{ width: 19, height: 19, tintColor: activeColor }} resizeMode="contain" /><Ionicons name="chevron-up" size={19} color={bg.textSecondary} /></View></View><View style={pokerStyles.pokerOddsGrid}>{POKER_COMBINATIONS.map((label, index) => <TouchableOpacity key={label} style={[pokerStyles.pokerOddCell, { backgroundColor: bg.cardBg }]} onPress={() => selectPokerMarket(`Combinaison gagnante. ${label}`, Number(odd(team1, team2, 70 + index, index === 7 ? 8 : 1.001)))} activeOpacity={0.75}><Text style={[pokerStyles.pokerOddLabel, { color: bg.textSecondary }]}>{label}</Text><Text style={[pokerStyles.pokerOddValue, { color: bg.textPrimary }]}>{odd(team1, team2, 70 + index, index === 7 ? 8 : 1.001)}</Text></TouchableOpacity>)}</View></View>
            <View style={[pokerStyles.pokerMarketSection, { backgroundColor: bg.appBg, borderTopColor: bg.divider }]}><View style={styles.marketHeader}><Text style={[pokerStyles.pokerMarketTitle, { color: bg.textPrimary }]}>Quelle Main va gagner ?</Text><View style={styles.marketActions}><Image source={PINNED_ICON} style={{ width: 19, height: 19, tintColor: activeColor }} resizeMode="contain" /><Ionicons name="chevron-up" size={19} color={bg.textSecondary} /></View></View><View style={pokerStyles.pokerHandsGrid}>{POKER_HANDS.map((label, index) => <TouchableOpacity key={label} style={[pokerStyles.pokerHandOddCell, { backgroundColor: bg.cardBg }]} onPress={() => selectPokerMarket(`Quelle Main va gagner ?. ${label}`, Number(odd(team1, team2, 90 + index, 5)))} activeOpacity={0.75}><Text style={[pokerStyles.pokerOddLabel, { color: bg.textSecondary }]}>{`(${index + 1})`}</Text><Text style={[pokerStyles.pokerOddValue, { color: bg.textPrimary }]}>{odd(team1, team2, 90 + index, 5)}</Text></TouchableOpacity>)}</View></View>
            <View style={{ height: 92 }} />
          </View>
        </>
      ) : isMortalKombat ? (
        <MortalKombatDetails
          event={selectedEvent}
          team1={team1}
          team2={team2}
          simulation={mortalSimulation}
          player={mortalCombatPlayer}
          onSelect={(label, oddValue) => {
            addEventToSlip({ ...selectedEvent, sport: 'Mortal Kombat', tournament: 'Mortal Kombat 3', betType: label, odd: oddValue, status: 'Accepté' });
            setActiveTab('coupon');
            setShowMatchDetails(false);
            router.back();
          }}
        />
      ) : isFifa ? (
        <FifaMatchDetails
          event={selectedEvent}
          player={fifaPlayer}
          simulation={simulation}
          team1={team1}
          team2={team2}
          team1Logo={selectedEvent.team1Logo}
          team2Logo={selectedEvent.team2Logo}
          score={score}
          nowMs={clockMs}
          onBack={() => { setShowMatchDetails(false); router.back(); }}
          onSelect={openQuickBet}
        />
      ) : (
        <>
          {isFifa && (
            <View style={fifaStyles.videoCard}>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <VideoView pointerEvents="none" player={fifaPlayer} style={fifaStyles.video} contentFit="contain" nativeControls={false} fullscreenOptions={{ enable: false }} />
              </View>
              <View pointerEvents="none" style={fifaStyles.topOverlay}>
                <View style={fifaStyles.liveBadge}><View style={fifaStyles.liveDot} /><Text style={fifaStyles.liveText}>EN DIRECT</Text></View>
              </View>
              <View pointerEvents="none" style={fifaStyles.scoreOverlay}>
                <Text style={fifaStyles.matchLabel}>{selectedEvent.tournament || 'FIFA — Match en direct'}</Text>
                <Text style={fifaStyles.scoreText}>{team1}  {score}  {team2}</Text>
                <Text style={fifaStyles.timeText}>{simulation?.displayMatchTime || selectedEvent.liveTime || 'En direct'}</Text>
              </View>
            </View>
          )}
          {!isReferenceFootball && <View style={styles.segmented}>
            {(['Information', 'Diffusions'] as const).map((view) => <TouchableOpacity key={view} onPress={() => setActiveView(view)} style={[styles.segment, activeView === view && styles.segmentActive]}><Text style={[styles.segmentText, activeView === view && styles.segmentTextActive]}>{view}</Text></TouchableOpacity>)}
          </View>}
          {!isReferenceFootball && <InformationCarousel team1={team1} team2={team2} score={score} selectedEvent={selectedEvent} simulation={simulation} />}
          <View style={[styles.periodBar, isReferenceFootball && referenceStyles.periodBar, { backgroundColor: bg.appBg }]}><TouchableOpacity style={[styles.listButton, isReferenceFootball && referenceStyles.listButton, { backgroundColor: bg.cardBg }]}><Ionicons name="list" size={20} color={bg.textPrimary} /></TouchableOpacity><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.periodScroll, isReferenceFootball && referenceStyles.periodScroll]}>{['Temps réglementaire', '1ère mi-temps', '2ème mi-temps', 'Prolongations', 'Corners', 'Cartons'].map((item) => <TouchableOpacity key={item} onPress={() => setPeriod(item)} style={[styles.periodPill, isReferenceFootball && referenceStyles.periodPill, { backgroundColor: period === item ? activeColor : bg.cardBg }, period === item && styles.periodPillActive]}><Text style={[styles.periodText, isReferenceFootball && referenceStyles.periodText, { color: period === item ? '#FFFFFF' : bg.textSecondary }, period === item && styles.periodTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView></View>
          {isReferenceFootball && <View style={[referenceStyles.searchBar, { backgroundColor: bg.inputBg, borderColor: bg.divider }]}><Ionicons name="search" size={16} color={bg.textMuted} /><TextInput value={marketSearch} onChangeText={setMarketSearch} placeholder="Recherche" placeholderTextColor={bg.textMuted} style={[referenceStyles.searchInput, { color: bg.textPrimary }]} /></View>}
          <View style={[styles.markets, { backgroundColor: bg.appBg }]}>{visibleMarkets.map((market) => <MarketSection key={market.title} market={market} pinned={pinnedMarkets.includes(market.title)} onToggle={() => setPinned(market.title)} onSelect={openQuickBet} referenceStyle={isReferenceFootball} />)}<View style={{ height: 92 }} /></View>
        </>
      ))}
    </ScrollView>
    <TabBar />
    <QuickBetSheet
      visible={Boolean(quickBetSelection)}
      event={quickBetSelection?.event || null}
      selectionLabel={quickBetSelection?.label || ''}
      odd={quickBetSelection?.odd || 0}
      onClose={() => setQuickBetSelection(null)}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' }, scroll: { flex: 1 }, hero: { backgroundColor: '#073A58', paddingHorizontal: 16, paddingBottom: 18 }, footballHero: { backgroundColor: '#0B6684', paddingBottom: 12 }, topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topButton: { width: 32, height: 38, justifyContent: 'center', alignItems: 'center' }, topTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' }, topActions: { flexDirection: 'row', gap: 4 }, footballSummary: { paddingTop: 3 }, footballCompetition: { color: '#D8EEF8', fontSize: 11, textAlign: 'center', marginBottom: 8 }, footballTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, footballTeam: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 8 }, footballTeamName: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' }, footballScore: { width: 108, alignItems: 'center' }, footballScoreText: { color: '#FFFFFF', fontSize: 27, fontWeight: '900' }, footballTime: { color: '#D8EEF8', fontSize: 11, marginTop: 4, textAlign: 'center' }, footballMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 11 }, footballMetaText: { color: '#D8EEF8', fontSize: 10, fontWeight: '700' }, heroMatch: { paddingVertical: 14, paddingHorizontal: 4 }, league: { color: '#BBD4E1', textAlign: 'center', fontSize: 14, marginBottom: 5 }, scoreRow: { flexDirection: 'row', alignItems: 'center' }, teamSide: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }, teamSideRight: { justifyContent: 'flex-start' }, teamName: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'right' }, scoreCenter: { alignItems: 'center', width: 105 }, score: { color: '#FFFFFF', fontSize: 29, fontWeight: '900', letterSpacing: 1 }, periodScore: { color: '#C8DBE5', fontSize: 12, marginTop: 2 }, liveTime: { color: '#C8DBE5', fontSize: 13, marginTop: 7 }, elapsed: { color: '#FFFFFF', textAlign: 'center', fontSize: 13, marginTop: 7 }, segmented: { height: 70, flexDirection: 'row', backgroundColor: '#062E48', borderRadius: 16, padding: 6, gap: 3, marginTop: 6 }, segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 13 }, segmentActive: { backgroundColor: '#FFFFFF' }, segmentText: { color: '#D4E2E9', fontSize: 17, fontWeight: '700' }, segmentTextActive: { color: '#172A3B' }, carouselWrap: { marginTop: 8, marginBottom: 8 }, infoSlide: { height: 188, borderRadius: 18, overflow: 'hidden' }, infoBackground: { flex: 1 }, infoBackgroundImage: { borderRadius: 18, resizeMode: 'cover' }, infoOverlay: { flex: 1, backgroundColor: 'rgba(3, 31, 49, 0.72)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }, infoCompetition: { color: '#D9E8EF', fontSize: 14, textAlign: 'center', marginBottom: 5 }, infoStatus: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 12 }, infoScoreRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10 }, infoTeam: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' }, infoScore: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' }, infoSub: { color: '#D1E3EB', fontSize: 12, marginTop: 12 }, previousPanel: { flex: 1, backgroundColor: 'rgba(3, 31, 49, 0.82)', paddingHorizontal: 14, paddingVertical: 12 }, previousTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 6 }, previousRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }, previousTeam: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, previousAway: { justifyContent: 'flex-end' }, previousName: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', flexShrink: 1 }, resultDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#39D39B' }, previousScore: { width: 66, alignItems: 'center' }, previousScoreText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, previousDate: { color: '#B7D0DA', fontSize: 9 }, expandButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(95, 116, 68, .55)', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 5, marginTop: 4 }, expandText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' }, previousFooter: { color: '#B7D0DA', fontSize: 11, marginTop: 4 }, stadiumPanel: { flex: 1, backgroundColor: 'rgba(3, 31, 49, 0.68)', padding: 12 }, stadiumPhotos: { flexDirection: 'row', height: 92, gap: 5 }, stadiumMainPhoto: { flex: 1, borderRadius: 8, resizeMode: 'cover' }, stadiumThumbs: { width: 72, gap: 5 }, stadiumThumb: { flex: 1, width: 72, borderRadius: 6, resizeMode: 'cover' }, stadiumDetails: { position: 'absolute', right: 10, top: 10, width: 160, backgroundColor: 'rgba(3, 31, 49, .62)', padding: 7 }, stadiumTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginBottom: 3 }, stadiumFact: { color: '#FFFFFF', fontSize: 11, marginVertical: 1 }, stadiumFooter: { color: '#B7D0DA', fontSize: 11, marginTop: 6 }, detailPanel: { flex: 1, backgroundColor: 'rgba(3, 31, 49, 0.72)', padding: 18, justifyContent: 'center' }, detailTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginBottom: 12 }, detailLine: { color: '#D5E5EB', fontSize: 14, marginVertical: 4 }, pageDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 4 }, pageDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: 'rgba(207, 229, 237, .55)' }, pageDotActive: { width: 30, backgroundColor: '#FFFFFF' }, periodBar: { height: 74, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, backgroundColor: '#FFFFFF', overflow: 'hidden' }, periodScroll: { flex: 1, alignItems: 'center', gap: 8, paddingRight: 16 }, listButton: { width: 55, height: 52, borderRadius: 27, backgroundColor: PALE_BLUE, alignItems: 'center', justifyContent: 'center' }, periodPill: { height: 48, paddingHorizontal: 18, borderRadius: 25, backgroundColor: PALE_BLUE, justifyContent: 'center', flexShrink: 0 }, periodPillActive: { backgroundColor: BLUE }, periodText: { color: '#7A8C9B', fontSize: 15, fontWeight: '700' }, periodTextActive: { color: '#FFFFFF' }, markets: { backgroundColor: '#FFFFFF' }, marketSection: { borderTopWidth: 1, borderTopColor: '#EEF3F7', paddingHorizontal: 22, paddingTop: 15, paddingBottom: 12 }, marketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }, marketTitle: { color: '#122E43', fontSize: 19, fontWeight: '800' }, marketActions: { flexDirection: 'row', alignItems: 'center', gap: 16 }, oddsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, oddCell: { minWidth: '30%', flexGrow: 1, flexBasis: '30%', minHeight: 50, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: PALE_BLUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, oddLabel: { color: '#71889B', fontSize: 12, lineHeight: 16, flex: 1, paddingRight: 6 }, oddValue: { color: '#112D43', fontSize: 17, fontWeight: '900', marginLeft: 8 }, diffusionContent: { minHeight: 520, backgroundColor: '#073A58', alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 }, diffusionTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', marginTop: 10 }, diffusionText: { color: '#FFFFFF', fontSize: 16, marginTop: 10 }, diffusionMuted: { color: '#BBD4E1', fontSize: 14, textAlign: 'center', marginTop: 12 }, diffusionSpacer: { height: 360 }, emptyHero: { minHeight: 150, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }, emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 }, emptyText: { color: '#C8DBE5', textAlign: 'center', fontSize: 14 },
});

const referenceStyles = StyleSheet.create({
  hero: { paddingHorizontal: 4, paddingBottom: 4, overflow: 'hidden' },
  heroImage: { resizeMode: 'cover' },
  heroOverlay: { flex: 1, backgroundColor: 'rgba(3, 15, 24, 0.66)' },
  topBar: { height: 32, paddingHorizontal: 2 },
  topTitle: { fontFamily: 'Roboto', fontSize: 12, fontWeight: '700', maxWidth: '65%', textAlign: 'center' },
  headerContent: { width: '100%', paddingHorizontal: 0 },
  segmented: { height: 29, flexDirection: 'row', backgroundColor: 'rgba(5, 14, 20, 0.76)', borderRadius: 8, padding: 2, gap: 3, marginTop: 0 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: '#F7F9FB' },
  segmentText: { color: '#AEBBC8', fontFamily: 'Roboto', fontSize: 10, fontWeight: '500' },
  segmentTextActive: { color: '#132131', fontWeight: '700' },
  carouselWrap: { marginTop: 5, marginBottom: 0 },
  infoSlide: { height: 150, borderRadius: 5, overflow: 'hidden' },
  infoOverlay: { backgroundColor: 'rgba(3, 18, 27, 0.56)', paddingHorizontal: 8 },
  infoCompetition: { fontFamily: 'Roboto', fontSize: 10, marginBottom: 2 },
  infoStatus: { fontFamily: 'Roboto', fontSize: 11, fontWeight: '600', marginBottom: 5 },
  infoScoreRow: { gap: 4 },
  infoTeamBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  infoTeamAway: { justifyContent: 'flex-start' },
  infoTeam: { color: '#FFFFFF', fontFamily: 'Roboto', fontSize: 10, fontWeight: '500', flexShrink: 1, textAlign: 'center' },
  teamLogo: { width: 22, height: 22 },
  infoScore: { fontFamily: 'Roboto', fontSize: 20, fontWeight: '800' },
  infoSub: { fontFamily: 'Roboto', fontSize: 10, marginTop: 5 },
  previousPanel: { paddingHorizontal: 8, paddingVertical: 7 },
  previousTitle: { fontFamily: 'Roboto', fontSize: 12, marginBottom: 3 },
  previousName: { fontFamily: 'Roboto', fontSize: 9 },
  previousScoreText: { fontFamily: 'Roboto', fontSize: 12 },
  previousDate: { fontFamily: 'Roboto', fontSize: 8 },
  stadiumPanel: { padding: 6 },
  stadiumTitle: { fontFamily: 'Roboto', fontSize: 11 },
  stadiumFact: { fontFamily: 'Roboto', fontSize: 9 },
  detailPanel: { padding: 8 },
  detailTitle: { fontFamily: 'Roboto', fontSize: 14, marginBottom: 5 },
  detailLine: { fontFamily: 'Roboto', fontSize: 10, marginVertical: 2 },
  pageDots: { marginTop: 2, gap: 4 },
  pageDot: { width: 12, height: 3 },
  pageDotActive: { width: 20 },
  diffusionSlide: { height: 150, marginTop: 5, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  diffusionText: { fontFamily: 'Roboto', fontSize: 11, marginTop: 5 },
  periodBar: { height: 45, gap: 5, paddingHorizontal: 4 },
  listButton: { width: 36, height: 34, borderRadius: 17 },
  periodScroll: { gap: 5, paddingRight: 4 },
  periodPill: { height: 31, paddingHorizontal: 11, borderRadius: 16 },
  periodText: { fontFamily: 'Roboto', fontSize: 10, fontWeight: '600' },
  searchBar: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 4, marginBottom: 3, paddingHorizontal: 9, borderRadius: 7, borderWidth: 1 },
  searchInput: { flex: 1, height: 34, paddingVertical: 0, fontFamily: 'Roboto', fontSize: 11 },
  marketSection: { borderTopWidth: 0, paddingHorizontal: 4, paddingTop: 3, paddingBottom: 3 },
  marketHeader: { minHeight: 36, marginBottom: 3, paddingHorizontal: 8, borderRadius: 10 },
  marketTitle: { fontFamily: 'Roboto', fontSize: 12, fontWeight: '500' },
  oddsGrid: { gap: 5 },
  oddCell: { minWidth: '30%', minHeight: 32, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7 },
  oddLabel: { fontFamily: 'Roboto', fontSize: 9, lineHeight: 12, paddingRight: 3 },
  oddValue: { fontFamily: 'Roboto', fontSize: 11, fontWeight: '700', marginLeft: 3 },
});

const pokerStyles = StyleSheet.create({
  pokerSegmented: { height: 38, flexDirection: 'row', backgroundColor: '#0B0C0E', borderRadius: 8, padding: 3, gap: 3, marginTop: 4, marginHorizontal: 4 },
  pokerSegment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  pokerSegmentActive: { backgroundColor: '#FDFDFD' },
  pokerSegmentText: { color: '#AEB3B8', fontSize: 12, fontWeight: '500' },
  pokerSegmentTextActive: { color: '#17191B', fontWeight: '700' },
  pokerPeriodBar: { height: 56, alignItems: 'center', paddingHorizontal: 8, backgroundColor: '#FDFDFD' },
  pokerPeriodPill: { height: 34, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#92C0DA', justifyContent: 'center', flexShrink: 0 },
  pokerPeriodText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  pokerMarketSection: { borderTopWidth: 1, borderTopColor: '#E7EAEF', paddingHorizontal: 8, paddingTop: 9, paddingBottom: 7, backgroundColor: '#FDFDFD' },
  pokerMarketTitle: { color: '#15232F', fontSize: 14, fontWeight: '800' },
  pokerHero: { marginHorizontal: 8, marginTop: 8, borderRadius: 18, paddingVertical: 22, alignItems: 'center', backgroundColor: '#102A38' },
  pokerLogo: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  pokerSub: { color: '#B9DDE7', fontSize: 13, marginTop: 6 },
  pokerMedia: { marginHorizontal: 4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#071722' },
  pokerVideoStage: { width: '100%', height: '100%', position: 'relative', backgroundColor: '#071722' },
  pokerVideo: { width: '100%', height: '100%', backgroundColor: '#071722' },
  pokerHud: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' },
  pokerInfoBox: { minWidth: 72, minHeight: 36, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,.62)', alignItems: 'flex-start', justifyContent: 'center' },
  pokerInfoText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: .5 },
  pokerClock: { color: '#FFFFFF', fontSize: 16, lineHeight: 17, fontWeight: '900' },
  pokerInformation: { height: '100%', width: '100%' },
  pokerInformationImage: { resizeMode: 'cover' },
  pokerInformationOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4, 22, 34, 0.64)' },
  pokerInformationTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', letterSpacing: 1 },
  pokerInformationDate: { color: '#D2E3EA', fontSize: 14, marginTop: 8 },
  pokerInformationTime: { color: '#FFFFFF', fontSize: 13, marginTop: 8 },
  pokerOddsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pokerOddCell: { width: '48%', minHeight: 39, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F2F2F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pokerOddLabel: { color: '#8A9AA8', fontSize: 11, lineHeight: 14, flex: 1, paddingRight: 5 },
  pokerOddValue: { color: '#122D43', fontSize: 13, fontWeight: '900', marginLeft: 5 },
  pokerHandsGrid: { flexDirection: 'column', gap: 8 },
  pokerHandOddCell: { minHeight: 39, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F2F2F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

const fifaStyles = StyleSheet.create({
  videoCard: { marginHorizontal: 8, marginTop: 8, borderRadius: 16, overflow: 'hidden', backgroundColor: '#05080C', position: 'relative' },
  video: { width: '100%', aspectRatio: 848 / 464, backgroundColor: '#05080C' },
  topOverlay: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: 'rgba(12, 24, 28, .78)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6, backgroundColor: '#43E28A' },
  liveText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  scoreOverlay: { position: 'absolute', left: 12, right: 12, bottom: 10, alignItems: 'center', paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(5, 12, 18, .74)' },
  matchLabel: { color: '#BFD0D9', fontSize: 10, fontWeight: '700' },
  scoreText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginTop: 2, textAlign: 'center' },
  timeText: { color: '#43E28A', fontSize: 11, fontWeight: '800', marginTop: 2 },
});
const mortalStyles = StyleSheet.create({
  combatCard: { marginHorizontal: 8, marginTop: 8, borderRadius: 18, overflow: 'hidden', backgroundColor: '#05080C' },
  videoStage: { width: '100%', aspectRatio: 16 / 9, position: 'relative', backgroundColor: '#000' },
  combatVideo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  videoNameOverlay: { position: 'absolute', top: '6%', width: '28%', height: '9%', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 3 },
  videoNameOverlayLeft: { left: '11%', backgroundColor: 'rgba(20, 76, 132, 0.96)' },
  videoNameOverlayRight: { right: '11%', backgroundColor: 'rgba(177, 35, 56, 0.96)' },
  videoNameText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  combatNames: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#071B2A' },
  combatName: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  fighterBlock: { flex: 1, alignItems: 'center', gap: 5 },
  scoreBlock: { alignItems: 'center', minWidth: 76 },
  combatScore: { color: '#F1B544', fontSize: 24, fontWeight: '900' },
  roundLabel: { color: '#BBD4E1', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  videoPlaceholder: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0B2233', alignItems: 'center', justifyContent: 'center' },
  videoPlaceholderText: { color: '#BBD4E1', fontSize: 15, fontWeight: '700' },
  combatVs: { color: '#F1B544', fontSize: 13, fontWeight: '900', marginHorizontal: 12 },
});
