import React from 'react';
import {
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getBackgroundPalette } from '@/constants/theme';
import { useBetStore } from '@/store/useBetStore';

const { width: SCREEN_W } = Dimensions.get('window');
const THUMB = (SCREEN_W - 32) / 3 - 6; // 3 colonnes avec gaps

/* ──── Catalogue de jeux (images générées) ─────────────────────────────── */
const CAROUSEL = [
  { id: 'c1', title: 'S-S Summerti Beach', img: require('@/assets/images/casino/summerti.jpg') },
  { id: 'c2', title: 'Chasse sauvage au...', img: require('@/assets/images/casino/chasse_sauvage.jpg') },
  { id: 'c3', title: 'Inscrivez-vous et recevez', img: require('@/assets/images/casino/inscription.jpg') },
  { id: 'c4', title: 'La fidélité vaut son pesant d\'or', img: require('@/assets/images/casino/fidelite.jpg') },
];

const EXCLUSIVES = [
  { id: 'e1', title: '1x Zeus Olympus', provider: 'MGA', img: require('@/assets/images/casino/zeus_olympus.png') },
  { id: 'e2', title: '1x Story Of Medusa', provider: 'Spinomenal', img: require('@/assets/images/casino/story_medusa.jpg') },
  { id: 'e3', title: 'Book of 1X', provider: 'Mancala', img: require('@/assets/images/casino/book_1x.jpg') },
];

const LIVE = [
  { id: 'l1', title: '1X Velvet Blackjack', provider: '1XLIVE', img: require('@/assets/images/casino/velvet_blackjack.png'), newBadge: false },
  { id: 'l2', title: '1X Velvet Blackjack VIP', provider: '1XLIVE', img: require('@/assets/images/casino/velvet_blackjack.png'), newBadge: false },
  { id: 'l3', title: '1X Velvet Roulette VIP', provider: '1XLIVE', img: require('@/assets/images/casino/velvet_roulette.png'), newBadge: true },
];

const SLOTS = [
  { id: 's1', title: 'Zeus Olympus', provider: 'Pragmatic', img: require('@/assets/images/casino/zeus_olympus.png') },
  { id: 's2', title: 'Story of Medusa', provider: 'Spinomenal', img: require('@/assets/images/casino/story_medusa.jpg') },
  { id: 's3', title: 'Book of 1X', provider: 'Mancala', img: require('@/assets/images/casino/book_1x.jpg') },
];

/* ── Section générique : titre + badge Tout + ligne horizontale ────────── */
function CasinoSection({ title, games }: { title: string; games: { id: string; title: string; provider: string; img: any }[] }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitleDark}>{title}</Text>
        <TouchableOpacity style={styles.toutBadgeGrey} activeOpacity={0.7} onPress={() => { /* Badge Tout : catalogue complet à venir */ }}>
          <Text style={styles.toutTextBlue}>Tout</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gamesRow}>
        {games.map((g) => (
          <TouchableOpacity key={g.id} style={[styles.gameCard, { width: THUMB }]} activeOpacity={0.8} onPress={() => { /* Jeu : accès réservé administration */ }}>
            <Image source={g.img} style={styles.gameThumb} resizeMode="cover" />
            <Text style={styles.gameTitleDark} numberOfLines={2}>{g.title}</Text>
            <Text style={styles.gameProviderGrey} numberOfLines={1}>{g.provider}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function CasinoTab() {
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const { width: viewportWidth } = useWindowDimensions();
  const casinoBannerWidth = Math.max(1, Math.min(viewportWidth - 32, 1200));
  const theme = useBetStore((state) => state.theme);
  const activeColor =
    theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';
  const [refreshing, setRefreshing] = React.useState(false);
  const router = useRouter();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handlePlay = (title: string) => {
    Alert.alert('Casino', `${title}\n\nCette section est réservée à l'administration. Les jeux seront activés prochainement.`, [
      { text: 'OK', style: 'default' },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg.appBg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[activeColor]} tintColor={activeColor} />
        }
      >
        {/* ── Sous-navigation style 1xBet ───────────────────────────── */}
        <View style={[styles.subNav, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}>
          <TouchableOpacity style={styles.subNavTab} activeOpacity={0.7} onPress={() => router.replace('/')}>
            <Ionicons name="flame" size={18} color="#758C9E" />
            <Text style={styles.subNavTextInactive}>Populaires</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.subNavTab} activeOpacity={0.7} onPress={() => router.replace('/')}>
            <Ionicons name="football-outline" size={18} color="#758C9E" />
            <Text style={styles.subNavTextInactive}>Sports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.subNavTab} activeOpacity={0.7}>
            <Ionicons name="game-controller-outline" size={18} color="#758C9E" />
            <Text style={styles.subNavTextInactive}>E-sport</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.subNavTab, styles.subNavTabActive]} activeOpacity={0.7}>
            <Ionicons name="diamond-outline" size={18} color={activeColor} />
            <Text style={[styles.subNavTextActive, { color: activeColor }]}>Casino</Text>
            <View style={[styles.subNavIndicator, { backgroundColor: activeColor }]} />
          </TouchableOpacity>
        </View>

        {/* ── Carrousel des promotions ──────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {CAROUSEL.map((c, i) => (
            <TouchableOpacity key={c.id} style={[styles.carouselItem, i > 0 && styles.carouselGap]} activeOpacity={0.85} onPress={() => handlePlay(c.title)}>
              <Image source={c.img} style={styles.carouselThumb} resizeMode="cover" />
              <View style={styles.carouselLabelBox}>
                <Text style={styles.carouselLabelText} numberOfLines={2}>{c.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Bannière My Casino ────────────────────────────────────── */}
        <TouchableOpacity style={[styles.bannerWrap, { width: casinoBannerWidth }]} activeOpacity={0.9} onPress={() => handlePlay('My Casino')}>
          <Image source={require('@/assets/images/casino/my_casino_banner.png')} style={styles.banner} resizeMode="contain" />
          <View style={styles.bannerLabelWrap}>
            <Text style={styles.bannerLabel}>My casino</Text>
          </View>
        </TouchableOpacity>

        {/* ── Sections ──────────────────────────────────────────────── */}
        <CasinoSection title="Exclusives" games={EXCLUSIVES} />
        <CasinoSection title="1xLive" games={LIVE} />
        <CasinoSection title="Machines à sous Populaire" games={SLOTS} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { width: '100%', paddingBottom: 24 },

  /* Sous-nav */
  subNav: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingBottom: 8, borderBottomWidth: 1 },
  subNavTab: { alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, position: 'relative' },
  subNavTabActive: { position: 'relative' },
  subNavTextInactive: { fontSize: 13, color: '#758C9E', marginTop: 2 },
  subNavTextActive: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  subNavIndicator: { position: 'absolute', bottom: 0, left: 12, right: 12, height: 2.5, borderRadius: 2 },

  /* Carrousel (images réduites — ne débordent pas) */
  carousel: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  carouselItem: { position: 'relative' },
  carouselGap: { marginLeft: 8 },
  carouselThumb: { width: 72, height: 72, borderRadius: 10 },
  carouselLabelBox: { position: 'absolute', left: 8, right: 8, bottom: 8 },
  carouselLabelText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },

  /* Bannière (image réduite — ne déborde pas) */
  bannerWrap: { alignSelf: 'center', marginVertical: 8, overflow: 'hidden', borderRadius: 10 },
  banner: { width: '100%', aspectRatio: 1200 / 525, borderRadius: 10 },
  bannerLabelWrap: { position: 'absolute', left: 18, bottom: 16 },
  bannerLabel: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },

  /* Sections */
  section: { marginTop: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitleDark: { fontSize: 17, fontWeight: '700', color: '#1A1F2E' },
  toutBadgeGrey: { backgroundColor: '#EDEFF3', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14 },
  toutTextBlue: { fontSize: 12, fontWeight: '600', color: '#7A9AB5' },
  gamesRow: { paddingHorizontal: 13, gap: 9 },
  gameCard: { borderRadius: 12, padding: 6, backgroundColor: '#FFFFFF' },
  gameThumb: { width: '100%', aspectRatio: 1, maxHeight: 96, borderRadius: 10, overflow: 'hidden' },
  gameTitleDark: { fontSize: 12.5, fontWeight: '600', marginTop: 6, lineHeight: 16, minHeight: 32, color: '#1A1F2E' },
  gameProviderGrey: { fontSize: 11, marginTop: 2, lineHeight: 13, minHeight: 13, color: '#8A93A0' },
});
