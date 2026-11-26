import { BetHeader } from '@/components/BetHeader';
import { BetSummary } from '@/components/BetSummary';
import { EventCard } from '@/components/EventCard';
import { FooterButton } from '@/components/FooterButton';
import { Header } from '@/components/Header';
import { TicketSeparator } from '@/components/TicketSeparator';
import { COLORS, getBackgroundPalette } from '@/constants/theme';
import { useBetStore } from '@/store/useBetStore';
import { BetSlip, BetStatus } from '@/types/bet';
import { getFifaSimulationState } from '@/utils/localFifaSimulation';
import { isMortalKombatEvent } from '@/utils/localMortalKombatSimulation';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';

export default function HistoryDetailsTab() {
  const id = useBetStore((state) => state.selectedHistoryId);
  const setSelectedHistoryId = useBetStore((state) => state.setSelectedHistoryId);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';

  const betHistory = useBetStore((state) => state.betHistory);
  const dbCoupon = betHistory.find((item) => item.id === id);
  const [refreshing, setRefreshing] = useState(false);
  const [clockMs, setClockMs] = useState(Date.now());
  const autoSettleMortalKombatCoupon = useBetStore((state) => state.autoSettleMortalKombatCoupon);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await useBetStore.getState().loadFromDb();
    } catch (e) {
      console.warn('Failed to reload coupon on refresh:', e);
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const [cachedCoupon, setCachedCoupon] = useState<typeof dbCoupon | null>(null);

  useEffect(() => {
    if (dbCoupon) {
      setCachedCoupon(dbCoupon);
    }
  }, [dbCoupon]);

  const activeCoupon = dbCoupon || cachedCoupon;

  useEffect(() => {
    const hasScheduledSimulation = (activeCoupon?.events ?? []).some((event) =>
      ((event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA')) || isMortalKombatEvent(event)) && (event.scheduledAt || event.liveStartedAt)
    );
    if (!hasScheduledSimulation) return undefined;
    const timer = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeCoupon?.events]);

  useEffect(() => {
    if (!activeCoupon?.id || activeCoupon.status === 'Payé' || activeCoupon.status === 'Perdu') return;
    if ((activeCoupon.events ?? []).some(isMortalKombatEvent)) autoSettleMortalKombatCoupon(activeCoupon.id, clockMs);
  }, [activeCoupon?.id, activeCoupon?.status, activeCoupon?.events, clockMs, autoSettleMortalKombatCoupon]);

  // Même hors du coupon actif, les fins de matchs FIFA sont persistées :
  // le compteur progresse match par match et le dernier match paie le coupon.
  useEffect(() => {
    if (!activeCoupon?.id || activeCoupon.status === 'Payé' || activeCoupon.status === 'Perdu') return;
    useBetStore.getState().autoSettleFifaCoupon(activeCoupon.id, clockMs);
  }, [activeCoupon?.id, activeCoupon?.status, activeCoupon?.events, clockMs]);

  // Dérive le statut effectif du coupon depuis les statuts individuels des matchs.
  // Cela couvre les cas où le store n'a pas encore propagé le changement de statut.
  const deriveStatus = (coupon: typeof activeCoupon): BetStatus => {
    if (!coupon) return 'Accepté';
    // Le statut global Perdu doit rester prioritaire sur les statuts historiques des événements.
    if (coupon.status === 'Perdu') return 'Perdu';
    const events = coupon.events ?? [];
    if (events.length > 0) {
      const fifaEvents = events.filter((ev) => ev.sport === 'FIFA' || ev.tournament.trim().toUpperCase().startsWith('FIFA'));
      const fifaFinished = fifaEvents.length > 0 && fifaEvents.every((ev) => getFifaSimulationState(ev, clockMs)?.isFinished);
      const allWon = events.every((ev) => {
        const eventWon = ev.status === 'Gagné' || ev.status === 'Payé';
        const fifaWon = (ev.sport === 'FIFA' || ev.tournament.trim().toUpperCase().startsWith('FIFA'))
          && getFifaSimulationState(ev, clockMs)?.isFinished;
        return eventWon || fifaWon;
      });
      if (allWon) return fifaFinished || coupon.status === 'Payé' ? 'Payé' : 'Gagné';
      const anyLost = events.some((ev) => ev.status === 'Perdu');
      if (anyLost) return 'Perdu';
    }
    return coupon.status;
  };

  const effectiveStatus = deriveStatus(activeCoupon);

  const betSlip: BetSlip | null = activeCoupon ? {
    id: activeCoupon.id,
    type: activeCoupon.type,
    date: activeCoupon.date,
    eventCount: activeCoupon.eventCount,
    finishedCount: (activeCoupon.events ?? []).filter(
      (ev) => ev.status === 'Gagné' || ev.status === 'Payé'
    ).length,
    totalOdds: activeCoupon.totalOdds,
    stake: activeCoupon.stake,
    potentialGain: activeCoupon.potentialGain,
    status: effectiveStatus,
    events: activeCoupon.events || [],
    sellAmount: activeCoupon.sellAmount,
  } : null;


  if (!betSlip) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: bg.appBg }]}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />

      {/* Top Navigation Header with custom back handler */}
      <Header onBack={() => setSelectedHistoryId(null)} couponCode={activeCoupon?.code || betSlip.id} />

      {/* Main Scrollable Content */}
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
        <View style={[styles.couponCard, { backgroundColor: bg.cardBg, marginHorizontal: backgroundMode === 'light' ? 10 : 0 }]}> 
          {/* White Top Section with Slip details */}
          <View style={[styles.topDetailsSection, { backgroundColor: bg.cardBg }]}> 
            <BetHeader betSlip={betSlip} />
            <BetSummary betSlip={betSlip} />
          </View>

          {/* Gray Content Area with Event Cards */}
          <View style={[styles.eventsSection, { marginHorizontal: 0 }]}> 
          {/* Perforation between the global coupon status and the first match. */}
          {betSlip.events.length > 0 && (
            <TicketSeparator cardColor={bg.cardBg} pageColor={bg.appBg} dividerColor={bg.divider} />
          )}
          {betSlip.events.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              couponId={betSlip.id}
              couponStatus={betSlip.status}
              isLast={index === betSlip.events.length - 1}
              showSeparator={index < betSlip.events.length - 1}
            />
          ))}
          </View>
        </View>
      </ScrollView>
      <FooterButton betSlip={betSlip} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F6F9',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F6F9',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  couponCard: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  topDetailsSection: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginHorizontal: 0,
    marginTop: 0,
    borderWidth: 0,
    // Les encoches du séparateur débordent légèrement du ticket.
    overflow: 'visible',
  },
  eventsSection: {
    paddingHorizontal: 0,
    paddingTop: 0,
    flex: 1,
  },
});
