import { BetHeader } from '@/components/BetHeader';
import { BetSummary } from '@/components/BetSummary';
import { CircularFlag } from '@/components/CircularFlag';
import { EventCard } from '@/components/EventCard';
import { TicketSeparator } from '@/components/TicketSeparator';
import { FooterButton } from '@/components/FooterButton';
import { COLORS, getBackgroundPalette } from '@/constants/theme';
import { useBetStore } from '@/store/useBetStore';
import { BetStatus } from '@/types/bet';
import { useRouter } from 'expo-router';

import { CouponCodeModal } from '@/components/CouponCodeModal';
import { formatOdd } from '@/utils/format';
import { normalizeScorePeriods } from '@/utils/scorePeriods';
import { getFifaSimulationState } from '@/utils/localFifaSimulation';
import { isPokerEvent } from '@/utils/localPokerSimulation';
import { isMortalKombatEvent } from '@/utils/mortalKombat';
import { isValidCouponCode } from '@/services/couponCode';
import { MORTAL_KOMBAT_FIGHTERS } from '@/data/mortalKombatFighters';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getMortalFighterImage = (eventLogo: string | undefined, name: string) => {
  const key = eventLogo?.startsWith('mortal:') ? eventLogo.slice('mortal:'.length) : '';
  const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');
  return MORTAL_KOMBAT_FIGHTERS.find((fighter) => fighter.id === key || fighter.name.toLowerCase().replace(/[^a-z]/g, '') === normalizedName)?.image;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

const parseCouponDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  try {
    const cleanStr = dateStr.trim();

    // Extract time (HH:MM)
    const timeMatch = cleanStr.match(/(\d{1,2}):(\d{2})/);
    let hours = 0;
    let minutes = 0;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    }

    // 1. Try format: YYYY-MM-DD
    const matchISO = cleanStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matchISO) {
      const [_, year, month, day] = matchISO;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        hours,
        minutes
      );
    }

    // 2. Try format: DD/MM/YYYY or DD-MM-YYYY
    const matchEuro = cleanStr.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (matchEuro) {
      const [_, day, month, year] = matchEuro;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        hours,
        minutes
      );
    }

    // 3. Try French months: "21 juin 2026 (19:00)"
    const monthsFr: { [key: string]: number } = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
      'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11,
      'janv.': 0, 'févr.': 1, 'avr.': 3, 'juil.': 6, 'sept.': 8, 'oct.': 9, 'nov.': 10, 'déc.': 11
    };
    const matchFr = cleanStr.match(/(\d{1,2})\s+([a-zA-Zàâéèêëîïôûùüçé.]+)\s+(\d{4})/i);
    if (matchFr) {
      const [_, day, monthStr, year] = matchFr;
      const month = monthsFr[monthStr.toLowerCase().trim()];
      if (month !== undefined) {
        return new Date(
          parseInt(year, 10),
          month,
          parseInt(day, 10),
          hours,
          minutes
        );
      }
    }

    // 4. Try French months without year: "21 juin (19:00)"
    const matchFrNoYear = cleanStr.match(/(\d{1,2})\s+([a-zA-Zàâéèêëîïôûùüçé.]+)/i);
    if (matchFrNoYear) {
      const [_, day, monthStr] = matchFrNoYear;
      const month = monthsFr[monthStr.toLowerCase().trim()];
      if (month !== undefined) {
        return new Date(
          new Date().getFullYear(),
          month,
          parseInt(day, 10),
          hours,
          minutes
        );
      }
    }
  } catch (e) {
    console.warn('Error parsing date:', e);
  }
  return null;
};

const formatCardDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parsed = parseCouponDate(dateStr);
  if (!parsed || isNaN(parsed.getTime())) {
    return dateStr;
  }
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} (${hh}:${min})`;
};

const formatFrenchDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parsed = parseCouponDate(dateStr);
  if (!parsed || isNaN(parsed.getTime())) {
    return dateStr;
  }
  const day = parsed.getDate();
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  const month = months[parsed.getMonth()];
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} (${hours}:${minutes})`;
};

const getTournamentBadge = (tournament: string): string => {
  if (!tournament) return 'WC2026';
  const clean = tournament.toLowerCase();
  if (clean.includes('coupe du monde') || clean.includes('world cup')) {
    return 'WC2026';
  }
  if (clean.includes('champions league') || clean.includes('ligue des champions')) {
    return 'UCL';
  }
  const initials = tournament
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase();
  const yearMatch = tournament.match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : '';
  return initials + year || 'WC2026';
};

export default function BetDetailsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const balance = useBetStore((state) => state.balance);
  const currentBetSlip = useBetStore((state) => state.currentBetSlip);
  // Sécurité : la recharge du compte est réservée aux administrateurs.
  const sessionRole = useBetStore((state) => state.sessionRole);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#6898D6';
  const activeBgColor = backgroundMode === 'navy' ? '#3A4F6A' : (theme === 'red_mega' ? '#FFF5F5' : theme === 'light_green' ? '#F2F9E6' : theme === 'green' ? '#E6F2EF' : theme === 'royal_blue' ? '#E8EAFA' : theme === 'gold' ? '#FEF8EC' : '#EBF3FC');

  // State variables for popups & sheets
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadModalVisible, setIsLoadModalVisible] = useState(false);
  const [isCouponCodeModalOpen, setIsCouponCodeModalOpen] = useState(false);
  const [isCouponActionsOpen, setIsCouponActionsOpen] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponLoadError, setCouponLoadError] = useState('');
  const [isBetSheetExpanded, setIsBetSheetExpanded] = useState(false);
  const [betAmount, setBetAmount] = useState(500);
  const [betAmountText, setBetAmountText] = useState('500');

  // Success state (Image 4)
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [successBetId, setSuccessBetId] = useState('');
  const [placedStake, setPlacedStake] = useState(0);
  const [placedGains, setPlacedGains] = useState(0);
  const [placedOdds, setPlacedOdds] = useState(0);
  const [statusClockMs, setStatusClockMs] = useState(Date.now());

  React.useEffect(() => {
    const hasScheduledSimulation = (currentBetSlip.events ?? []).some((event) =>
      (event.sport === 'FIFA' || event.sport === 'Mortal Kombat' || event.tournament.trim().toUpperCase().startsWith('FIFA') || /mortal\s+(kombat|combat)/i.test(event.tournament)) && event.scheduledAt
    );
    if (!hasScheduledSimulation) return undefined;
    const timer = setInterval(() => setStatusClockMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [currentBetSlip.events]);

  // Règlement progressif des matchs FIFA : chaque match terminé devient gagnant
  // immédiatement (1/2, puis 2/2). Le dernier match déclenche le paiement global.
  React.useEffect(() => {
    if (!currentBetSlip.id || currentBetSlip.isDraft) return;
    useBetStore.getState().autoSettleFifaCoupon(currentBetSlip.id, statusClockMs);
  }, [currentBetSlip.id, currentBetSlip.isDraft, currentBetSlip.status, currentBetSlip.events, statusClockMs]);

  React.useEffect(() => {
    if (!currentBetSlip.id || currentBetSlip.isDraft) return;
    useBetStore.getState().autoSettleMortalKombatCoupon(currentBetSlip.id, statusClockMs);
  }, [currentBetSlip.id, currentBetSlip.isDraft, currentBetSlip.status, currentBetSlip.events, statusClockMs]);

  // Valeur animée stable : lazy-init dans useState évite tout re-render tout en
  // éliminant l'accès ref pendant le render.
  const [animationProgress] = React.useState(() => new Animated.Value(0));

  const toggleExpanded = (expanded: boolean) => {
    setIsBetSheetExpanded(expanded);
    Animated.timing(animationProgress, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  // PanResponder stable via lazy-init useMemo : plus d'accès ref pendant render.
  const panResponder = React.useMemo(
    () =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
          toggleExpanded(true);
        } else if (gestureState.dy > 30) {
          toggleExpanded(false);
        }
      },
    })
  , []);

  const sheetHeight = animationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [165, 485],
  });

  const compactOpacity = animationProgress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [1, 0, 0],
  });

  const compactHeight = animationProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [48, 0, 0],
  });

  const expandedOpacity = animationProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const expandedTranslateY = animationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    try {
      useBetStore.getState().loadFromDb();
    } catch (e) {
      console.warn('Failed to refresh coupon details:', e);
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const hasEvents = currentBetSlip && currentBetSlip.events && currentBetSlip.events.length > 0;

  const formatCurrency = (val: number) => {
    if (val % 1 !== 0) {
      return val.toFixed(2);
    }
    return val.toString();
  };

  const handleRecharge = () => {
    // Le joueur peut recharger son propre compte depuis cet écran.
    Alert.prompt(
      'Recharger le compte',
      'Entrez le montant à recharger (₣) :',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Recharger',
          onPress: (text?: string) => {
            const amt = parseFloat(text || '');
            if (!isNaN(amt) && amt > 0) {
              const currentBal = useBetStore.getState().balance;
              useBetStore.getState().updateBalance(currentBal + amt);
              Alert.alert('Succès', `Votre compte a été rechargé de ${formatCurrency(amt)}₣.`);
            } else {
              Alert.alert('Erreur', 'Veuillez entrer un montant valide.');
            }
          },
        },
      ],
      'plain-text',
      '1000'
    );
  };

  const clearSlip = () => {
    useBetStore.getState().setBetSlip({
      id: '',
      type: 'Combiné',
      date: '',
      eventCount: 0,
      finishedCount: 0,
      totalOdds: 1,
      stake: 0,
      potentialGain: 0,
      status: 'Accepté',
      events: []
    });
    toggleExpanded(false);
  };

  const handleRemoveEvent = (eventId: string) => {
    if (!currentBetSlip) return;
    const updatedEvents = (currentBetSlip.events || []).filter(e => e.id !== eventId);
    if (updatedEvents.length === 0) {
      clearSlip();
    } else {
      const totalOdds = Number(updatedEvents.reduce((acc, ev) => acc * ev.odd, 1).toFixed(3));
      const potentialGain = Number((currentBetSlip.stake * totalOdds).toFixed(2));
      useBetStore.getState().setBetSlip({
        ...currentBetSlip,
        events: updatedEvents,
        eventCount: updatedEvents.length,
        totalOdds,
        potentialGain
      });
    }
  };

  const handlePlaceBet = () => {
    if (!currentBetSlip) return;
    const result = useBetStore.getState().placeBet(betAmount);
    if (!result.success) {
      Alert.alert('Erreur', result.error);
      return;
    }
    setPlacedStake(result.coupon.stake);
    setPlacedOdds(result.coupon.totalOdds);
    setPlacedGains(result.coupon.potentialGain);
    setSuccessBetId(result.coupon.id);
    setIsSuccessModalVisible(true);
  };

  const handleQuickStake = (amount: number) => {
    setBetAmount(amount);
    setBetAmountText(String(amount));
  };

  const saveCoupon = () => {
    setIsCouponActionsOpen(false);
    const slip = useBetStore.getState().currentBetSlip;
    if (!slip.events.length) {
      Alert.alert('Enregistrer', 'Ajoutez au moins une sélection au coupon.');
      return;
    }
    if (!isValidCouponCode(slip.code || '')) useBetStore.getState().duplicateCoupon(slip);
    setIsCouponCodeModalOpen(true);
  };
  const openCouponActions = () => setIsCouponActionsOpen(true);
  const shareCoupon = async () => {
    setIsCouponActionsOpen(false);
    try { await Share.share({ message: `Mon coupon de pari : ${currentBetSlip.code || currentBetSlip.id}` }); }
    catch (error) { console.warn('Partage du coupon impossible:', error); }
  };
  const renderCouponActionsModal = () => {
    const actionIconSources: Record<string, any> = {
      'action-download-ref.png': require('../../../assets/images/action-download-transparent.png'),
      'action-upload-ref.png': require('../../../assets/images/action-upload-transparent.png'),
      'action-sliders-ref.png': require('../../../assets/images/action-sliders-transparent.png'),
      'action-share-ref.png': require('../../../assets/images/action-share-transparent.png'),
    };
    const actions: Array<[string, string, () => void]> = [
      ['action-download-ref.png', 'Enregistrer le coupon de pari', saveCoupon],
      ['action-upload-ref.png', 'Charger le coupon de pari', () => { setIsCouponActionsOpen(false); setIsLoadModalVisible(true); }],
      ['action-sliders-ref.png', 'Créer un coupon de pari', () => { setIsCouponActionsOpen(false); useBetStore.getState().setActiveTab('populaire'); }],
      ['action-share-ref.png', 'Share your bet slip', shareCoupon],
    ];
    return (
      <Modal visible={isCouponActionsOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setIsCouponActionsOpen(false)}>
        <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: backgroundMode === 'light' ? 'rgba(31, 45, 57, 0.42)' : 'rgba(0, 0, 0, 0.58)' }]} activeOpacity={1} onPress={() => setIsCouponActionsOpen(false)}>
          <View style={[styles.couponActionsSheet, { backgroundColor: bg.cardBg }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.couponActionsHandle, { backgroundColor: bg.divider }]} />
            <Text style={[styles.couponActionsTitle, { color: bg.textPrimary }]}>Choisissez une action</Text>
            {actions.map(([icon, label, action], index) => (
              <TouchableOpacity key={label} accessibilityRole="button" style={[styles.couponActionRow, index === actions.length - 1 && styles.couponActionRowLast, { borderBottomColor: bg.divider }]} onPress={action} activeOpacity={0.7}>
                <Image source={actionIconSources[icon]} style={styles.couponActionIcon} resizeMode="contain" accessibilityLabel={label} />
                <Text style={[styles.couponActionText, { color: bg.textPrimary }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const handleIncrementStake = (amount: number) => {
    const nextVal = Math.max(90, betAmount + amount);
    setBetAmount(nextVal);
    setBetAmountText(String(nextVal));
  };

  const options = [
    {
      id: 'recharge',
      title: 'Recharger le compte',
      subtitle: `Votre solde : ${formatCurrency(balance)} ₣`,
      icon: 'add',
      iconBg: '#34C759',
      iconColor: '#FFF',
      action: handleRecharge,
    },
    {
      id: 'search',
      title: "Recherche d'événement",
      subtitle: 'Uniquement pour vous',
      icon: 'search-outline',
      iconBg: '#EEF3F8',
      iconColor: activeColor,
      action: () => {
        // Panel ouvert à tous les utilisateurs connectés (les onglets
        // Utilisateurs / Sécurité des jeux restent réservés à l'admin côté /admin)
        router.push('/admin');
      },
    },
    {
      id: 'combined',
      title: 'Combiné du jour',
      subtitle: 'Meilleures offres du jour',
      icon: 'layers-outline',
      iconImage: require('../../../assets/images/icon_combine_new.png'),
      iconBg: '#EEF3F8',
      iconColor: activeColor,
      action: () => Alert.alert('Pari combiné', 'Les meilleures cotes combinées du jour arriveront bientôt.'),
    },
    {
      id: 'create',
      title: 'Créer un coupon de pari',
      subtitle: 'Générez votre coupon de pari',
      icon: 'options-outline',
      iconBg: '#EEF3F8',
      iconColor: activeColor,
      action: () => {
        // Panel ouvert à tous les utilisateurs connectés
        router.push('/admin');
      },
    },
    {
      id: 'load',
      title: 'Charger le coupon de pari',
      subtitle: 'Chargez votre coupon de pari',
      icon: 'arrow-up-outline',
      iconBg: '#EEF3F8',
      iconColor: activeColor,
      action: () => setIsLoadModalVisible(true),
    },
  ];

  if (hasEvents) {
    const totalOddsValue = currentBetSlip.totalOdds;
    const potentialGainValue = betAmount * totalOddsValue;

    // Dérive le statut effectif depuis les événements et la simulation FIFA locale.
    const deriveCouponStatus = (): BetStatus => {
      const events = currentBetSlip.events ?? [];
      if (events.length > 0) {
        if (currentBetSlip.status === 'Perdu' || events.some((ev) => ev.status === 'Perdu')) return 'Perdu';

        const fifaEvents = events.filter((ev) => ev.sport === 'FIFA' || ev.tournament.trim().toUpperCase().startsWith('FIFA'));
        const fifaFinished = fifaEvents.length > 0 && fifaEvents.every((ev) => getFifaSimulationState(ev, statusClockMs)?.isFinished);
        const allWon = events.every((ev) => {
          const eventWon = ev.status === 'Gagné' || ev.status === 'Payé';
          const fifaWon = (ev.sport === 'FIFA' || ev.tournament.trim().toUpperCase().startsWith('FIFA'))
            && getFifaSimulationState(ev, statusClockMs)?.isFinished;
          return eventWon || fifaWon;
        });

        if (allWon) return fifaFinished || currentBetSlip.status === 'Payé' ? 'Payé' : 'Gagné';
      }
      return currentBetSlip.status;
    };
    const effectiveSlip = { ...currentBetSlip, status: deriveCouponStatus() };

    // --- CASE 1: NOT A DRAFT (coupon déjà placé) ---
    // Un coupon téléchargé par son code reste dans le flux brouillon afin de
    // conserver exactement le même rendu et les mêmes options qu'une copie.
    if (!currentBetSlip.isDraft) {

      return (
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <View style={[styles.container, { backgroundColor: bg.appBg }]}>
            <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />

            {/* En-tête standard */}
            <View style={[styles.headerSafeArea, { paddingTop: insets.top || 44, backgroundColor: bg.headerBg }]}>
              <View style={[styles.headerContent, { borderBottomWidth: 1, borderBottomColor: bg.divider }]}>
                <TouchableOpacity onPress={clearSlip} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={24} color={bg.textPrimary} />
                </TouchableOpacity>

                <Text style={[styles.headerTitle, { color: bg.textPrimary }]}>Détails du pari</Text>

                <View style={styles.headerRight}>
                  <TouchableOpacity style={styles.headerIconBtn}>
                    <Ionicons name="notifications-outline" size={22} color={bg.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerIconBtn} onPress={openCouponActions} activeOpacity={0.7}>
                    <Ionicons name="ellipsis-horizontal" size={22} color={bg.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Scrollable details in unified ticket style */}
            <ScrollView
              style={[styles.scrollView, { backgroundColor: bg.appBg }]}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[activeColor]}
                  tintColor={activeColor}
                />
              }
            >
              <View style={[styles.ticketCard, { backgroundColor: bg.cardBg }]}>
                {/* Coupon ticket header */}
                <View style={[styles.ticketTopSection, { backgroundColor: bg.cardBg }]}>
                  <BetHeader betSlip={effectiveSlip} hideFifaCombinedIcon />
                  <BetSummary betSlip={effectiveSlip} />
                </View>

                {/* Event cards joined as one ticket, with side notches at each perforation. */}
                <View style={styles.ticketEventsSection}>
                {/* Perforation between the global coupon status and the first match. */}
                {effectiveSlip.events.length > 0 && (
                  <TicketSeparator cardColor={bg.cardBg} pageColor={bg.appBg} dividerColor={bg.divider} />
                )}
                {effectiveSlip.events.map((event, index) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    couponId={effectiveSlip.id}
                    couponStatus={effectiveSlip.status}
                    isLast={index === effectiveSlip.events.length - 1}
                    showSeparator={index < effectiveSlip.events.length - 1}
                  />
                ))}
                </View>
              </View>
            </ScrollView>

            {/* Bottom Sell & Duplicate buttons */}
            <FooterButton betSlip={effectiveSlip} />
          </View>

          <CouponCodeModal
            visible={isCouponCodeModalOpen}
            onClose={() => setIsCouponCodeModalOpen(false)}
            couponCode={effectiveSlip.code || effectiveSlip.id}
          />
          {renderCouponActionsModal()}
        </SafeAreaView>
      );
    }

    // --- CASE 2: IS DRAFT (Charger Coupon Flow - Image 2/3/4) ---
    return (
      <View style={[styles.container, { backgroundColor: bg.appBg }]}>
        <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />

        {/* Header from Image 2 */}
        <View style={[styles.headerSafeArea, { paddingTop: insets.top || 44, backgroundColor: bg.headerBg }]}>
          <View style={[styles.headerContent, { borderBottomWidth: 1, borderBottomColor: bg.divider }]}>
            <View style={{ width: 44 }} />
            <TouchableOpacity style={styles.headerTitleRow} activeOpacity={0.7}>
              <Text style={[styles.headerTitle, { color: bg.textPrimary }]}>{(currentBetSlip.events?.length || currentBetSlip.eventCount || 0) === 1 ? 'Simple' : 'Combiné'}</Text>
              <Ionicons name="chevron-down" size={14} color={bg.textPrimary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <View style={styles.headerRight}>
              {currentBetSlip.events.some((event) => isMortalKombatEvent(event) || isPokerEvent(event)) && (
                <View style={styles.loadedLiveBadge}>
                  <View style={styles.loadedLiveDot} />
                  <Text style={styles.loadedLiveBadgeText}>EN DIRECT</Text>
                </View>
              )}
              <TouchableOpacity onPress={clearSlip} style={styles.headerIconBtn} accessibilityLabel="Vider le coupon">
                <Image source={require('../../../assets/images/custom-icons/delete.png')} style={{ width: 22, height: 22, tintColor: activeColor }} resizeMode="contain" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconBtn} onPress={openCouponActions} activeOpacity={0.7}>
                <Ionicons name="ellipsis-horizontal" size={21} color={bg.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Scrollable details */}
        <ScrollView
          style={[styles.scrollView, { backgroundColor: bg.appBg }]}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: isBetSheetExpanded ? 380 : 160 }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[activeColor]}
              tintColor={activeColor}
            />
          }
        >
          {/* Matches List — carte FIFA alignée sur la référence */}
          <View style={styles.eventsSection}>
            {(() => {
              const couponIsLive = String(currentBetSlip.status || '').toLowerCase() === 'en direct';
              return currentBetSlip.events.map((event, eventIndex) => {
              const isFifaEvent = event.tournament.trim().toUpperCase().startsWith('FIFA');
              const isMortalEvent = /mortal\s+(kombat|combat)/i.test(`${event.sport} ${event.tournament}`);
              const fifaSimulation = isFifaEvent ? getFifaSimulationState(event, statusClockMs) : null;
              const hasLiveStatus = String(event.status || '').toLowerCase() === 'en direct';
              const hasElapsedTime = Boolean(event.liveTime && event.liveTime !== 'Terminé');
              const isScheduledGame = isMortalEvent || isPokerEvent(event);
              const showEventLive = Boolean(
                couponIsLive
                || event.isLive
                || hasLiveStatus
                || hasElapsedTime
                || (isFifaEvent && fifaSimulation?.isLive)
                || isScheduledGame
              );
              const eventLiveTime = isFifaEvent
                ? (fifaSimulation?.displayMatchTime || '00:00')
                : (event.liveTime || '00:00');
              const draftStatus = String(currentBetSlip.status || '').toLowerCase();
              const draftCanRevealResult = ['gagné', 'gagne', 'perdu', 'payé', 'paye'].includes(draftStatus);
              const rawDraftBetType = event.betType || '1X2. V1';
              // Le coupon brouillon doit afficher le libellé complet de l’option choisie.
              const displayedDraftBetType = rawDraftBetType;
              return (
                <React.Fragment key={event.id}>
                  <View style={[styles.eventCardOuter, isFifaEvent ? styles.fifaDraftCardOuter : null, { backgroundColor: bg.cardBg, borderWidth: 0, marginBottom: eventIndex < currentBetSlip.events.length - 1 ? 8 : 0 }]}> 
                  <View style={[styles.eventCard, isFifaEvent ? styles.fifaDraftCard : null, { backgroundColor: bg.cardBg }]}>
                    {isFifaEvent ? (
                      <>
                        <View style={styles.fifaDraftHeader}>
                          <View style={styles.fifaDraftTournamentBlock}>
                            <Text style={[styles.fifaDraftTournament, { color: bg.textPrimary }]} numberOfLines={1}>
                              {event.tournament}
                            </Text>
                            <Text style={[styles.fifaDraftDate, { color: bg.textSecondary }]}> 
                              {formatFrenchDate(event.date)}
                            </Text>
                            {showEventLive && (
                              <View style={styles.loadedLiveBadge}>
                                <View style={styles.loadedLiveDot} />
                                <Text style={styles.loadedLiveBadgeText}>EN DIRECT</Text>
                              </View>
                            )}
                          </View>
                          <TouchableOpacity onPress={() => handleRemoveEvent(event.id)} style={styles.fifaDraftRemove}>
                            <Ionicons name="close" size={20} color={activeColor} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.fifaDraftTeamsRow}>
                          <View style={styles.fifaDraftTeamLeft}>
                            <Text style={[styles.fifaDraftTeamName, { color: bg.textPrimary }]} numberOfLines={2}>{event.team1}</Text>
                            <CircularFlag countryCode={event.team1CountryCode} size={38} teamName={event.team1} />
                          </View>
                          <View style={styles.fifaDraftVs}>
                            {draftCanRevealResult && event.score ? (
                              <Text style={[styles.fifaDraftVsText, { color: bg.textPrimary, fontWeight: '800' }]}>
                                {event.score.replace(/\s*-\s*/g, ' : ').trim()}
                              </Text>
                            ) : (
                              <Text style={[styles.fifaDraftVsText, { color: bg.textPrimary }]}>VS</Text>
                            )}
                          </View>
                          <View style={styles.fifaDraftTeamRight}>
                            <CircularFlag countryCode={event.team2CountryCode} size={38} teamName={event.team2} />
                            <Text style={[styles.fifaDraftTeamName, { color: bg.textPrimary }]} numberOfLines={2}>{event.team2}</Text>
                          </View>
                        </View>

                        <View style={styles.fifaDraftBetRow}>
                          <Text style={[styles.fifaDraftBetText, { color: bg.textPrimary }]} numberOfLines={1}>
                            {displayedDraftBetType}
                          </Text>
                          <Text style={[styles.fifaDraftOdd, { color: bg.textPrimary }]}>{formatOdd(event.odd)}</Text>
                        </View>
                        <View style={styles.fifaDraftStatusRow}>
                          <Text style={[styles.fifaDraftStatusLabel, { color: bg.textSecondary }]}>Statut :</Text>
                          <Text style={[styles.fifaDraftStatusValue, { color: activeColor }]}>{event.status || 'Accepté'}</Text>
                        </View>
                        {showEventLive && !isMortalEvent && (
                          <View style={styles.loadedLiveTimeRow}>
                            <Text style={[styles.loadedLiveTimeLabel, { color: bg.textSecondary }]}>EN DIRECT</Text>
                            <Text style={[styles.loadedLiveTimeValue, { color: bg.statusBarStyle === 'light-content' ? '#FFFFFF' : '#000000' }]}>
                              temps écoulé : {eventLiveTime}
                            </Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        <View style={[styles.eventCardHeader, { marginBottom: 8 }]}> 
                          <Text style={{ fontSize: 13.5, color: bg.textSecondary, fontWeight: '500' }}>
                            {formatFrenchDate(event.date)}
                          </Text>
                          {showEventLive && isScheduledGame && (
                            <View style={styles.loadedLiveBadge}>
                              <View style={styles.loadedLiveDot} />
                              <Text style={styles.loadedLiveBadgeText}>EN DIRECT</Text>
                            </View>
                          )}
                          <TouchableOpacity onPress={() => handleRemoveEvent(event.id)}>
                            <Ionicons name="close" size={20} color="#2F7FCF" />
                          </TouchableOpacity>
                        </View>
                        {isPokerEvent(event) ? (
                          <View style={styles.pokerDraftEvent}>
                            <Image
                              source={require('../../../assets/images/poker-controller-icon.png')}
                              style={styles.pokerDraftIcon}
                              resizeMode="contain"
                            />
                            <Text style={[styles.pokerDraftTitle, { color: bg.textPrimary }]}>POKER</Text>
                          </View>
                        ) : (
                          <View style={styles.teamsRow}>
                            <View style={styles.teamContainerLeft}>
                              <Text style={[styles.teamNameTextLeft, { color: bg.textPrimary }]} numberOfLines={2}>{event.team1}</Text>
                              <View style={styles.flagContainerLeft}>
                                {isMortalEvent && getMortalFighterImage(event.team1Logo || event.team1CountryCode, event.team1)
                                  ? <Image source={getMortalFighterImage(event.team1Logo || event.team1CountryCode, event.team1)} style={styles.mortalDraftLogo} resizeMode="cover" />
                                  : event.team1Logo?.startsWith('http')
                                    ? <Image source={{ uri: event.team1Logo }} style={{ width: 38, height: 38 }} resizeMode="contain" />
                                    : <CircularFlag countryCode={event.team1CountryCode} size={36} teamName={event.team1} />}
                              </View>
                            </View>
                            <View style={styles.vsContainer}>
                              {draftCanRevealResult && event.score ? (
                                <Text style={[styles.vsText, { color: bg.textPrimary, fontWeight: '800' }]}>
                                  {event.score.replace(/\s*-\s*/g, ' : ').trim()}
                                </Text>
                              ) : (
                                <Text style={[styles.vsText, { color: bg.textPrimary }]}>VS</Text>
                              )}
                            </View>
                            <View style={styles.teamContainerRight}>
                              <View style={styles.flagContainerRight}>
                                {isMortalEvent && getMortalFighterImage(event.team2Logo || event.team2CountryCode, event.team2)
                                  ? <Image source={getMortalFighterImage(event.team2Logo || event.team2CountryCode, event.team2)} style={styles.mortalDraftLogo} resizeMode="cover" />
                                  : event.team2Logo?.startsWith('http')
                                    ? <Image source={{ uri: event.team2Logo }} style={{ width: 38, height: 38 }} resizeMode="contain" />
                                    : <CircularFlag countryCode={event.team2CountryCode} size={36} teamName={event.team2} />}
                              </View>
                              <Text style={[styles.teamNameTextRight, { color: bg.textPrimary }]} numberOfLines={2}>{event.team2}</Text>
                            </View>
                          </View>
                        )}
                        <View style={[styles.betBanner, { backgroundColor: bg.inputBg }]}> 
                          <Text style={[styles.betBannerText, { color: bg.textSecondary }]} numberOfLines={1}>
                            {displayedDraftBetType}
                          </Text>
                          <Text style={[styles.betBannerOdd, { color: bg.textPrimary }]}>{formatOdd(event.odd)}</Text>
                        </View>
                        {showEventLive && !isMortalEvent && (
                          <View style={styles.loadedLiveTimeRow}>
                            <Text style={[styles.loadedLiveTimeLabel, { color: bg.textSecondary }]}>EN DIRECT</Text>
                            <Text style={[styles.loadedLiveTimeValue, { color: bg.statusBarStyle === 'light-content' ? '#FFFFFF' : '#000000' }]}>
                              temps écoulé : {eventLiveTime}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                  </View>
                </React.Fragment>
              );
              });
            })()}
          </View>
        </ScrollView>

        {/* Dynamic Bottom Sheet */}
        <Animated.View style={[
          styles.bottomBetSheetContainer,
          {
            backgroundColor: bg.cardBg,
            borderColor: bg.divider,
            height: sheetHeight,
            paddingBottom: insets.bottom ? insets.bottom + 10 : 24
          }
        ]}>
          {/* Drag handle line (Gesture zone for flexible pulling) */}
          <View
            {...panResponder.panHandlers}
            style={{
              width: '100%',
              paddingVertical: 10,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -8,
            }}
          >
            <View style={styles.betSheetDragHandle} />
          </View>

          {/* Header stats section (Common in both states) */}
          <View style={styles.compactMainRow}>
            <View style={styles.compactOddsCol}>
              <View style={styles.compactCountRow}>
                <Ionicons name="ticket" size={16} color={bg.textPrimary} style={{ marginRight: 4 }} />
                <Text style={[styles.compactCountText, { color: bg.textPrimary }]}>{currentBetSlip.events.length}</Text>
              </View>
              <Text style={[styles.compactOddsText, { color: bg.textPrimary }]}>
                Cote : <Text style={{ fontWeight: '800' }}>{formatOdd(totalOddsValue)}</Text>
              </Text>
              <Text style={[styles.compactSubtext, { color: bg.textSecondary }]}>Si la cote change me demander de confirmer</Text>
            </View>
            <TouchableOpacity style={[styles.compactSettingsBtn, { backgroundColor: bg.appBg, borderColor: bg.divider }]}>
              <Ionicons name="settings-outline" size={20} color={bg.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Compact State Button Area (fades/resizes) */}
          <Animated.View style={{ opacity: compactOpacity, height: compactHeight, overflow: 'hidden' }}>
            <TouchableOpacity
              style={[
                styles.mainPariBtn,
                {
                  backgroundColor: ((theme === 'blue' || theme === 'royal_blue') ? '#34C759' : activeColor)
                }
              ]}
              activeOpacity={0.8}
              onPress={() => toggleExpanded(true)}
            >
              <Text style={styles.mainPariBtnText}>Pari</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Expanded State Content Area (fades & slides up) */}
          <Animated.View style={{
            opacity: expandedOpacity,
            transform: [{ translateY: expandedTranslateY }],
            pointerEvents: isBetSheetExpanded ? 'auto' : 'none',
          }}>
            <View style={[styles.expandedWhiteContainer, { backgroundColor: bg.cardBg }]}>
              {/* Tabs */}
              <View style={[styles.sheetTabsRow, { backgroundColor: bg.sectionBg }]}>
                <TouchableOpacity style={[styles.sheetTabActive, { backgroundColor: activeColor }]}>
                  <Text style={styles.sheetTabActiveText}>Mise</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetTabInactive}>
                  <Text style={[styles.sheetTabInactiveText, { color: bg.textSecondary }]}>Code promo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetTabInactive}>
                  <Text style={[styles.sheetTabInactiveText, { color: bg.textSecondary }]}>Cote de référence</Text>
                </TouchableOpacity>
              </View>

              {/* Balance line */}
              <View style={styles.balanceInfoRow}>
                <View style={styles.balanceLeft}>
                  <View style={styles.plusGreenCircle}>
                    <Ionicons name="add" size={14} color="#FFF" />
                  </View>
                  <Text style={[styles.balanceValueText, { color: bg.textPrimary }]}>{formatCurrency(balance)} ₣</Text>
                  <Ionicons name="chevron-down" size={14} color={bg.textSecondary} style={{ marginLeft: 4 }} />
                </View>

                <View style={styles.advancebetRight}>
                  <Text style={[styles.advancebetText, { color: bg.textPrimary }]}>Advancebet</Text>
                  <Ionicons name="refresh" size={14} color={bg.textSecondary} style={{ marginLeft: 4 }} />
                </View>
              </View>

              {/* Stake input with + / - buttons */}
              <View style={[styles.stakeInputsContainer, { backgroundColor: bg.inputBg, borderColor: bg.divider }]}>
                <TouchableOpacity onPress={() => handleIncrementStake(-100)} style={[styles.stakeAdjustBtn, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}>
                  <Ionicons name="remove" size={18} color={bg.textPrimary} />
                </TouchableOpacity>
                <View style={styles.stakeInputWrapper}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <TextInput
                      style={[styles.stakeTextInput, { width: Math.max(30, betAmountText.length * 9.5), color: bg.textPrimary }]}
                      value={betAmountText}
                      onChangeText={(text) => {
                        setBetAmountText(text);
                        const parsed = parseInt(text.replace(/[^0-9]/g, ''), 10);
                        if (!isNaN(parsed)) {
                          setBetAmount(parsed);
                        } else {
                          setBetAmount(0);
                        }
                      }}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.currencySuffix, { color: bg.textPrimary }]}>₣</Text>
                  </View>
                  <Text style={[styles.limitsText, { color: bg.textMuted, marginBottom: 0, marginTop: 1 }]}>90 ₣ - 2240000 ₣</Text>
                </View>
                <TouchableOpacity onPress={() => handleIncrementStake(100)} style={[styles.stakeAdjustBtn, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}>
                  <Ionicons name="add" size={18} color={bg.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Potential gains */}
              <View style={styles.gainsContainer}>
                <Text style={[styles.gainsLabel, { color: bg.textSecondary }]}>Gains potentiels: </Text>
                <Text style={styles.gainsValue}>{formatCurrency(potentialGainValue)} ₣</Text>
              </View>

              {/* Main Place Bet green button */}
              <TouchableOpacity
                style={[
                  styles.mainPariBtn,
                  {
                    backgroundColor: (!betAmount || betAmount <= 0)
                      ? '#CFD9E3'
                      : ((theme === 'blue' || theme === 'royal_blue') ? '#34C759' : activeColor)
                  }
                ]}
                activeOpacity={(!betAmount || betAmount <= 0) ? 1 : 0.85}
                onPress={handlePlaceBet}
                disabled={!betAmount || betAmount <= 0}
              >
                <Text style={styles.mainPariBtnText}>Pari</Text>
              </TouchableOpacity>

              {/* Quick stakes */}
              <View style={styles.quickStakesRow}>
                <TouchableOpacity onPress={() => handleQuickStake(90)} style={[styles.quickStakeBtn, { backgroundColor: activeColor }]}>
                  <Text style={styles.quickStakeText}>90 ₣</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleQuickStake(1000)} style={[styles.quickStakeBtn, { backgroundColor: activeColor }]}>
                  <Text style={styles.quickStakeText}>1000 ₣</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleQuickStake(2500)} style={[styles.quickStakeBtn, { backgroundColor: activeColor }]}>
                  <Text style={styles.quickStakeText}>2500 ₣</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.quickStakesSub, { color: bg.textMuted }]}>Placez un pari instantanément en cliquant sur un montant</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* MODAL 4: Success Message Overlay */}
        <Modal
          visible={isSuccessModalVisible}
          transparent={true}
          animationType="slide"
          statusBarTranslucent={true}
          onRequestClose={() => setIsSuccessModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsSuccessModalVisible(false)}
          >
            <View style={styles.bottomSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.dragHandle} />

              <Text style={styles.modalTitle}>Pari placé avec succès !</Text>

              <View style={styles.successDetailsTable}>
                {/* Header row */}
                <View style={styles.successHeaderRow}>
                  <View style={styles.successHeaderLeft}>
                    <Ionicons name="ticket" size={16} color="#082A4D" style={{ marginRight: 6 }} />
                    <Text style={styles.successHeaderLabel}>{(currentBetSlip.events?.length || currentBetSlip.eventCount || 0) === 1 ? 'SIMPLE' : 'COMBINÉ'}</Text>
                  </View>
                  <Text style={styles.successHeaderId}>N° {successBetId}</Text>
                </View>

                {/* Table content */}
                <View style={styles.successDetailDataRow}>
                  <Text style={styles.successRowLabel}>Cotes</Text>
                  <Text style={styles.successRowValue}>{formatOdd(placedOdds)}</Text>
                </View>
                <View style={styles.successDetailDataRow}>
                  <Text style={styles.successRowLabel}>Montant de la mise</Text>
                  <Text style={styles.successRowValue}>{formatCurrency(placedStake)} ₣</Text>
                </View>
                <View style={[styles.successDetailDataRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.successRowLabel}>Gains potentiels</Text>
                  <Text style={[styles.successRowValue, { color: '#34C759', fontWeight: '800' }]}>
                    {formatCurrency(placedGains)} ₣
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.successActionsRow}>
                <TouchableOpacity
                  style={[styles.successHistBtn, { backgroundColor: activeBgColor }]}
                  onPress={() => {
                    setIsSuccessModalVisible(false);
                    clearSlip();
                    useBetStore.getState().setActiveTab('historique');
                  }}
                >
                  <Text style={[styles.successHistBtnText, { color: activeColor }]}>Historique</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.successContBtn, { backgroundColor: activeColor }]}
                  onPress={() => {
                    setIsSuccessModalVisible(false);
                    clearSlip();
                  }}
                >
                  <Text style={styles.successContBtnText}>Continuer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <CouponCodeModal
          visible={isCouponCodeModalOpen}
          onClose={() => setIsCouponCodeModalOpen(false)}
          couponCode={effectiveSlip.code || effectiveSlip.id}
        />
        {renderCouponActionsModal()}
      </View>
    );
  }

  // EMPTY SLIP SCREEN
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg.appBg }]} edges={["top"]}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />

      <View style={[styles.emptyHeader, { backgroundColor: '#FFFFFF', borderBottomColor: bg.divider }]}>
        <Text style={[styles.emptyHeaderTitle, { color: bg.textPrimary }]}>Coupon</Text>
      </View>

      <ScrollView
        style={[styles.emptyContainer, { backgroundColor: bg.appBg }]}
        contentContainerStyle={styles.emptyContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[activeColor]}
            tintColor={activeColor}
          />
        }
      >
        <View style={styles.emptyTextWrapper}>
          <Text style={[styles.emptyTitle, { color: bg.textPrimary }]}>Votre coupon de pari est vide</Text>
          <Text style={[styles.emptySubtitle, { color: bg.textSecondary }]}>
            Ajoutez un événement au coupon de pari ou sélectionnez l'une des options
          </Text>
        </View>

        {options.map((opt) => (
          <TouchableOpacity key={opt.id} style={[styles.optionCard, { backgroundColor: bg.cardBg, borderColor: bg.divider }]} activeOpacity={0.8} onPress={opt.action}>
            <View style={[styles.iconContainer, { backgroundColor: opt.iconBg }]}>
              {opt.iconImage ? (
                <Image source={opt.iconImage} style={[styles.emptyCombinedIcon, { tintColor: opt.iconColor }]} resizeMode="contain" accessibilityLabel="Icône combiné du jour" />
              ) : (
                <Ionicons name={opt.icon as any} size={30} color={opt.iconColor} />
              )}
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.optionTitle, { color: bg.textPrimary }]}>{opt.title}</Text>
              <Text style={[styles.optionSubtitle, { color: bg.textSecondary }]}>{opt.subtitle}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* MODAL 1: Charger le coupon (Image 1 style) */}
      <Modal
        visible={isLoadModalVisible}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setIsLoadModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsLoadModalVisible(false)}
          >
            <View style={[styles.bottomSheet, { backgroundColor: bg.cardBg }]} onStartShouldSetResponder={() => true}>
              <View style={[styles.dragHandle, { backgroundColor: bg.divider }]} />

              <Text style={[styles.modalTitle, { color: bg.textPrimary }]}>Charger le coupon de pari</Text>

              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: bg.textSecondary }]}>Saisissez le code du coupon de pari</Text>
                <TextInput
                  style={[styles.underlinedInput, { borderBottomColor: activeColor, color: bg.textPrimary }]}
                  value={couponCodeInput}
                  onChangeText={(value) => { setCouponCodeInput(value); setCouponLoadError(''); }}
                  autoFocus={true}
                  placeholder=""
                  placeholderTextColor={bg.textSecondary}
                />
              </View>
              {couponLoadError ? <Text accessibilityRole="alert" style={{ color: COLORS.dangerRed, marginTop: 8, fontSize: 12, fontWeight: '600' }}>{couponLoadError}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.downloadBtn,
                  couponCodeInput.trim().length > 0 ? [styles.downloadBtnActive, { backgroundColor: activeColor }] : styles.downloadBtnDisabled,
                ]}
                disabled={couponCodeInput.trim().length === 0}
                onPress={async () => {
                  const code = couponCodeInput.trim();
                  setCouponLoadError('');
                  try {
                    await useBetStore.getState().loadBetSlipFromDb(code);
                    setIsLoadModalVisible(false);
                    setCouponCodeInput('');
                  } catch (error) {
                    setCouponLoadError(error instanceof Error ? error.message : 'Impossible de charger ce coupon. Vérifiez le code et réessayez.');
                  }
                }}
              >
                <Text
                  style={[
                    styles.downloadBtnText,
                    couponCodeInput.trim().length > 0 ? styles.downloadBtnTextActive : styles.downloadBtnTextDisabled,
                  ]}
                >
                  Télécharger
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  emptyHeader: {
    height: 54,
    flexShrink: 0,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
    elevation: 4,
  },
  emptyHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#082A4D',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#EEF2FA',
  },
  emptyContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
  },
  emptyTextWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#082A4D',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 2,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 22,
    minHeight: 96,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#082A4D',
  },
  optionSubtitle: {
    fontSize: 15,
    color: '#8AAAC8',
    marginTop: 2,
  },
  emptyCombinedIcon: {
    width: 34,
    height: 34,
  },

  // Detailed coupon styles
  container: {
    flex: 1,
    backgroundColor: '#F0F3F7',
  },
  headerSafeArea: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#082A4D',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 12,
  },
  eventsSection: {
    paddingHorizontal: 10,
  },

  // Event match card design (Image 2 style)
  eventCardOuter: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#E8EFF5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eventCard: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 10,
  },
  fifaDraftCardOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#E7EDF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  fifaDraftCard: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
  },
  fifaDraftHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 61,
  },
  fifaDraftTournamentBlock: {
    flex: 1,
    paddingTop: 2,
  },
  fifaDraftTournament: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  fifaDraftDate: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
  fifaDraftRemove: {
    paddingLeft: 8,
    paddingTop: 1,
  },
  fifaDraftTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 11,
  },
  fifaDraftTeamLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  fifaDraftTeamRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  fifaDraftTeamName: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 16,
  },
  fifaDraftVs: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fifaDraftVsText: {
    fontSize: 19,
    fontWeight: '800',
  },
  fifaDraftDivider: {
    height: 1,
    width: '100%',
    opacity: 0.9,
    marginTop: 8,
    marginBottom: 8,
  },
  fifaDraftBetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  fifaDraftBetText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '800',
  },
  fifaDraftOdd: {
    fontSize: 14.5,
    fontWeight: '800',
    marginLeft: 10,
  },
  fifaDraftStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  fifaDraftStatusLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  fifaDraftStatusValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  loadedLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FF3838',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  loadedLiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  loadedLiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  loadedLiveTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 7,
  },
  loadedLiveTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadedLiveTimeValue: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sportIconWrapper: {
    marginRight: 8,
    marginTop: 2,
  },
  sportIconImage: {
    width: 17,
    height: 17,
    marginRight: 8,
    marginTop: 2,
    resizeMode: 'contain',
  },
  tournamentContainer: {
    flex: 1,
  },
  tournamentText: {
    fontSize: 13.5,
    color: '#082A4D',
    fontWeight: '700',
    fontFamily: 'System',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  eventDateText: {
    fontSize: 11.5,
    color: '#63809C',
    fontWeight: '600',
    fontFamily: 'System',
    marginRight: 6,
  },
  badgeBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeBadgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  removeEventBtn: {
    padding: 4,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    marginBottom: 8,
  },
  pokerDraftEvent: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 2,
    marginBottom: 8,
  },
  pokerDraftIcon: {
    width: 34,
    height: 34,
  },
  pokerDraftTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'System',
  },
  teamContainerLeft: {
    flex: 1.2,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  teamContainerRight: {
    flex: 1.2,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  teamNameTextLeft: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#082A4D',
    fontFamily: 'System',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 16,
    textAlign: 'right',
  },
  teamNameTextRight: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#082A4D',
    fontFamily: 'System',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 16,
    textAlign: 'left',
  },
  flagContainerLeft: {
    marginLeft: 8,
  },
  flagContainerRight: {
    marginRight: 8,
  },
  mortalDraftLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D7E0E8',
  },
  vsContainer: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  vsText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#082A4D',
  },
  matchDetailDivider: {
    height: 1,
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
  },
  betBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F6FA',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  betBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C748C',
    flex: 1,
  },
  betBannerOdd: {
    fontSize: 15,
    fontWeight: '800',
    color: '#082A4D',
  },

  // Modal 1 Bottom Sheet (Image 1 style)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6E2ED',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#082A4D',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 28,
  },
  inputLabel: {
    fontSize: 12,
    color: '#63809C',
    fontWeight: '600',
    marginBottom: 8,
  },
  underlinedInput: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#2F7FCF',
    paddingVertical: 6,
    fontSize: 16,
    color: '#082A4D',
    fontWeight: '600',
  },
  downloadBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnDisabled: {
    backgroundColor: '#E6EFF7',
  },
  downloadBtnActive: {
    backgroundColor: '#2F7FCF',
  },
  downloadBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  downloadBtnTextDisabled: {
    color: '#ADC1D4',
  },
  downloadBtnTextActive: {
    color: '#FFF',
  },

  couponActionsSheet: { height: '39%', minHeight: 360, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 28, paddingTop: 10, paddingBottom: 20 },
  couponActionsHandle: { alignSelf: 'center', width: 60, height: 5, borderRadius: 3, marginBottom: 12 },
  couponActionsTitle: { textAlign: 'center', fontSize: 20, fontWeight: '800', paddingVertical: 8, marginBottom: 8 },
  couponActionRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  couponActionIcon: { width: 34, height: 34 },
  couponActionRowLast: { borderBottomWidth: 0 },
  couponActionText: { fontSize: 17, fontWeight: '500' },

  // Dynamic Bet Slip Bottom Sheet (Images 2 & 3)
  bottomBetSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#EDF2F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 90,
  },
  betSheetDragHandle: {
    width: 32,
    height: 3.5,
    borderRadius: 1.7,
    backgroundColor: '#CFD9E3',
    alignSelf: 'center',
    marginBottom: 10,
  },
  compactSheetContent: {
    flexDirection: 'column',
  },
  compactMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  compactOddsCol: {
    flex: 1,
  },
  compactCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  compactCountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#082A4D',
  },
  compactOddsText: {
    fontSize: 13,
    color: '#082A4D',
    marginBottom: 1,
  },
  compactSubtext: {
    fontSize: 11,
    color: '#63809C',
    fontWeight: '600',
  },
  compactSettingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: '#CFD9E3',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  mainPariBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainPariBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  expandedWhiteContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginHorizontal: -16,
    marginBottom: -24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  expandedSheetContent: {
    flexDirection: 'column',
  },
  sheetTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#DCE5EE',
    borderRadius: 8,
    padding: 2,
    marginBottom: 12,
  },
  sheetTabActive: {
    flex: 1,
    backgroundColor: '#2F7FCF',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTabActiveText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetTabInactive: {
    flex: 1.2,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTabInactiveText: {
    color: '#63809C',
    fontSize: 12,
    fontWeight: '700',
  },
  balanceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plusGreenCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  balanceValueText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#082A4D',
  },
  advancebetRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advancebetText: {
    fontSize: 12.5,
    color: '#082A4D',
    fontWeight: '700',
  },
  stakeInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#CFD9E3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  stakeAdjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFD9E3',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  stakeInputWrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  stakeTextInput: {
    fontSize: 16,
    fontWeight: '800',
    color: '#082A4D',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  currencySuffix: {
    fontSize: 16,
    fontWeight: '800',
    color: '#082A4D',
    marginLeft: 4,
  },
  limitsText: {
    fontSize: 11,
    color: '#63809C',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 10,
  },
  gainsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gainsLabel: {
    fontSize: 12,
    color: '#63809C',
    fontWeight: '600',
  },
  gainsValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34C759',
  },
  quickStakesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  quickStakeBtn: {
    flex: 1,
    backgroundColor: '#2F7FCF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStakeText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  quickStakesSub: {
    fontSize: 11,
    color: '#63809C',
    textAlign: 'center',
    fontWeight: '600',
  },

  // Image 4 Success Modal styling
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#082A4D',
    textAlign: 'center',
    marginBottom: 18,
  },
  successDetailsTable: {
    backgroundColor: '#F2F6FA',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  successHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1.2,
    borderBottomColor: '#E2E8F0',
  },
  successHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#63809C',
  },
  successHeaderId: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#082A4D',
  },
  successDetailDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1.2,
    borderBottomColor: '#E2E8F0',
  },
  successRowLabel: {
    fontSize: 12.5,
    color: '#63809C',
    fontWeight: '600',
  },
  successRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#082A4D',
  },
  successActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  successHistBtn: {
    flex: 1,
    backgroundColor: '#E1EEFB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHistBtnText: {
    color: '#2F7FCF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  successContBtn: {
    flex: 1.2,
    backgroundColor: '#2F7FCF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successContBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  ticketTopSection: {
    backgroundColor: '#FFF',
    borderRadius: 0,
    marginHorizontal: 0,
    marginTop: 0,
    borderWidth: 0,
  },
  ticketEventsSection: {
    marginHorizontal: 0,
    paddingTop: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  ticketCard: {
    marginHorizontal: 10,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
