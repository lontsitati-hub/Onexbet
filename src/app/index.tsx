import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, StatusBar, Animated, Dimensions, RefreshControl, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { COLORS, SPACING, getBackgroundPalette } from '@/constants/theme';
import { useBetStore, BetHistoryItem } from '@/store/useBetStore';
import { HistoryCard } from '@/components/HistoryCard';
import { TabBar } from '@/components/TabBar';
import EmptyBetHistoryMascot from '@/components/EmptyBetHistoryMascot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllMaches, getAllCoupons, getCompteInfo } from '@/services/db';
import { BetStatus } from '@/types/bet';

import BetDetailsTab from '@/components/tabs/BetDetailsTab';
import MenuTab from '@/components/tabs/MenuTab';
import PopularTab from '@/components/tabs/PopularTab';
import FavorisTab from '@/components/tabs/FavorisTab';
import HistoryDetailsTab from '@/components/tabs/HistoryDetailsTab';

class TabContentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TabContentErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text accessibilityRole="alert" style={{ color: '#7A3030', textAlign: 'center', lineHeight: 22 }}>
            Impossible d’afficher cet écran pour le moment. Choisissez un autre onglet pour continuer.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

interface SlideInViewProps {
  visible: boolean;
  bottomOffset: number;
  children: React.ReactNode;
}

const SlideInView: React.FC<SlideInViewProps> = ({ visible, bottomOffset, children }) => {
  const { width } = useWindowDimensions();
  // Valeur animée stable : lazy-init dans useState évite l'accès ref pendant render.
  const [slideAnim] = useState(() => new Animated.Value(width));

  useEffect(() => {
    slideAnim.stopAnimation();
    const animation = Animated.timing(slideAnim, {
      toValue: visible ? 0 : width,
      duration: 250,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, width]);

  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: bottomOffset,
        transform: [{ translateX: slideAnim }],
        backgroundColor: bg.cardBg,
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {children}
    </Animated.View>
  );
};

export default function BetHistory() {
  const insets = useSafeAreaInsets();
  const balance = useBetStore((state) => state.balance);
  const betHistory = useBetStore((state) => state.betHistory);
  const sessionId = useBetStore((state) => state.sessionId);
  const activeTab = useBetStore((state) => state.activeTab);
  const selectedHistoryId = useBetStore((state) => state.selectedHistoryId);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';

  const [dbMatchCount, setDbMatchCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    try {
      // loadFromDb charge les coupons ET leurs events depuis SQLite
      useBetStore.getState().loadFromDb();
    } catch (e) {
      console.warn('Failed to refresh data from SQLite:', e);
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);


  // Cached states for smooth unmounting slide transition
  const [cachedHistoryId, setCachedHistoryId] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);

  // Suivi du détail d'historique sélectionné (dérivé synchrone de la sélection)
  useEffect(() => {
    if (selectedHistoryId) {
      setCachedHistoryId(selectedHistoryId);
      setHistoryVisible(true);
    } else {
      setHistoryVisible(false);
      const timer = setTimeout(() => {
        setCachedHistoryId(null);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [selectedHistoryId]);

  // Chargement initial du nombre de matchs depuis SQLite (unique exécution)
  useEffect(() => {
    let mounted = true;
    try {
      const matches = getAllMaches();
      if (mounted) setDbMatchCount(matches.length);
    } catch (e) {
      console.warn(e);
    }
    return () => {
      mounted = false;
    };
  }, []);

  const formatCurrency = (val: number) => {
    if (val % 1 !== 0) {
      return val.toFixed(2);
    }
    return val.toString();
  };

  const formatInteger = (val: number) => {
    const [integerPart, decimalPart] = Number(val).toFixed(Number(val) % 1 !== 0 ? 2 : 0).split('.');
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return decimalPart ? `${groupedInteger}.${decimalPart}` : groupedInteger;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'coupon':
        return <BetDetailsTab />;
      case 'menu':
        return <MenuTab />;
      case 'populaire':
        return <PopularTab />;
      case 'favoris':
        return <FavorisTab />;
      case 'historique':
      default:
        return (
          <View style={{ flex: 1, backgroundColor: bg.appBg }}>
            <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />
            {/* Top White Section */}
            <View style={[styles.topSection, { paddingTop: insets.top || 44, backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}>
              {/* Header Row */}
              <View style={styles.headerRow}>
                <TouchableOpacity style={styles.headerTitleContainer} activeOpacity={0.7}>
                  <Text style={[styles.headerTitle, { color: bg.textPrimary }]}>Historique des paris</Text>
                  <Ionicons name="chevron-down" size={14} color={bg.textSecondary} style={styles.chevronDown} />
                </TouchableOpacity>

                <View style={styles.headerActions}>
                  <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7} accessibilityLabel="Filtre">
                    <Image source={require('../../assets/images/history-icons/filter.png')} style={[styles.historyHeaderIcon, { tintColor: activeColor }]} contentFit="contain" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7} accessibilityLabel="Liste">
                    <Image source={require('../../assets/images/history-icons/list.png')} style={[styles.historyHeaderIcon, styles.historyListIcon, { tintColor: activeColor }]} contentFit="contain" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Balance Row */}
              <View style={styles.balanceSection}>
                <View>
                  <Text style={[styles.balanceLabel, { color: bg.textSecondary }]}>Compte principal</Text>
                  <TouchableOpacity style={styles.balanceValueRow} activeOpacity={0.7}>
                    <Text style={[styles.balanceText, { color: bg.textPrimary }]}>{formatInteger(balance)} ₣</Text>
                    <Ionicons name="chevron-down" size={18} color={bg.textSecondary} style={styles.balanceChevron} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.depositButton, { backgroundColor: '#48B879' }]} activeOpacity={0.8}>
                  <Ionicons name="add" size={25} color="#FFFFFF" style={styles.depositPlus} />
                  <Text style={styles.depositText}>Effectuer un dépôt</Text>
                </TouchableOpacity>
              </View>

              {/* Période et mode de vente */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity style={[styles.actionPillButton, { backgroundColor: bg.pillBg }]} activeOpacity={0.8}>
                  <Ionicons name="calendar" size={20} color={activeColor} style={styles.buttonIcon} />
                  <Text style={[styles.actionPillText, { color: activeColor }]} numberOfLines={1}>1 mois</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionPillButton, { backgroundColor: bg.pillBg }]} activeOpacity={0.8}>
                  <Ionicons name="pricetag" size={20} color={activeColor} style={styles.buttonIcon} />
                  <Text style={[styles.actionPillText, { color: activeColor }]} numberOfLines={1}>Vente</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable Content */}
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
              {/* Stats Banner */}
              {betHistory.length > 0 && (
                <TouchableOpacity style={[styles.statsBanner, { backgroundColor: bg.cardBg }]} activeOpacity={0.8}>
                  <View>
                    <Text style={[styles.statsLabel, { color: bg.textSecondary }]}>Statistiques pour la période</Text>
                    <Text style={[styles.statsValue, { color: bg.textPrimary }]}>
                      Paris : {betHistory.length} · {formatInteger(betHistory.reduce((sum, b) => sum + b.stake, 0))} ₣
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={bg.textSecondary} />
                </TouchableOpacity>
              )}

              {/* Bets List / Empty State */}
              {betHistory.length === 0 ? (
                <View style={styles.emptyStateWrapper}>
                  <EmptyBetHistoryMascot />
                  <TouchableOpacity style={[styles.placeBetBtn, { backgroundColor: activeColor }]} activeOpacity={0.85} onPress={() => useBetStore.getState().setActiveTab('populaire')}>
                    <Text style={styles.placeBetBtnText}>Placer un pari</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                betHistory.map((item) => (
                  <HistoryCard key={item.id} item={item} />
                ))
              )}
            </ScrollView>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg.appBg }]}>
      <View style={{ flex: 1 }}>
        <TabContentErrorBoundary key={activeTab}>{renderTabContent()}</TabContentErrorBoundary>
      </View>

      {/* History Details Slide-in Overlay */}
      {cachedHistoryId !== null && (
        <SlideInView visible={historyVisible} bottomOffset={60 + insets.bottom}>
          <HistoryDetailsTab />
        </SlideInView>
      )}



      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2F6',
  },
  topSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E6EEF4',
    paddingBottom: SPACING.md,
  },
  headerRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#1A3D5C',
    fontFamily: 'System',
  },
  chevronDown: {
    marginLeft: 4,
    top: 1,
  },
  headerActions: {
    position: 'absolute',
    right: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  headerActionBtn: {
    width: 28,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyHeaderIcon: {
    width: 25,
    height: 30,
  },
  historyListIcon: {
    width: 31,
    height: 30,
  },
  balanceSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 7,
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#5C7C99',
    fontWeight: '500',
    fontFamily: 'System',
    marginBottom: 2,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#1A3D5C',
    fontFamily: 'System',
  },
  balanceChevron: {
    marginLeft: 4,
    top: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  depositButton: {
    flexDirection: 'row',
    backgroundColor: '#48B879',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    minWidth: 205,
  },
  depositPlus: {
    marginRight: 8,
  },
  depositText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
  actionPillButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EDF2F6',
    height: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionPillText: {
    color: '#2E79C9',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
  buttonIcon: {
    marginRight: 6,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#EEF2F6',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    shadowColor: '#1A3A5C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 0.5,
  },
  statsLabel: {
    fontSize: 11.5,
    color: '#5C7C99',
    fontWeight: '500',
    fontFamily: 'System',
    marginBottom: 3,
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3D5C',
    fontFamily: 'System',
  },
  emptyStateWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    marginTop: 48,
  },
  placeBetBtn: {
    backgroundColor: '#2E79C9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#2E79C9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  placeBetBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
