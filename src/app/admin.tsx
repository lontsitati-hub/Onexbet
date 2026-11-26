import CouponBuilderTab from '@/components/admin/CouponBuilderTab';
import CouponsManagementTab from '@/components/admin/CouponsManagementTab';
import CreateMatchTab from '@/components/admin/CreateMatchTab';
import SqliteViewerTab from '@/components/admin/SqliteViewerTab';
import UsersManagementTab from '@/components/admin/UsersManagementTab';
import { COLORS, getBackgroundPalette } from '@/constants/theme';
import { useAdminStore } from '@/store/useAdminStore';
import { useBetStore } from '@/store/useBetStore';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'create' | 'coupon' | 'coupons' | 'users' | 'database';

interface TabConfig {
  key: Tab;
  label: string;
  icon: string;
  iconLib: 'fa' | 'ion' | 'mci';
  adminOnly?: boolean;
  badge?: () => string | null;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { initialTab } = useLocalSearchParams<{ initialTab?: string }>();
  const adminStore = useAdminStore();
  const betStore = useBetStore();
  const sessionRole = useBetStore((state) => state.sessionRole);

  const [activeTab, setActiveTab] = useState<Tab>((initialTab as Tab) || 'create');
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as Tab);
    }
  }, [initialTab]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toastY = useRef(new Animated.Value(-120)).current;
  const [toastMsg, setToastMsg] = useState('');
  const [toastColor, setToastColor] = useState(COLORS.successGreen);
  const [toastIcon, setToastIcon] = useState<'check-circle' | 'times-circle'>('check-circle');

  const showToast = useCallback(
    (msg: string, color = COLORS.successGreen) => {
      setToastMsg(msg);
      setToastColor(color);
      setToastIcon(color === COLORS.dangerRed ? 'times-circle' : 'check-circle');
      Animated.sequence([
        Animated.spring(toastY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 9 }),
        Animated.delay(2400),
        Animated.timing(toastY, { toValue: -120, duration: 260, useNativeDriver: true }),
      ]).start();
    },
    [toastY]
  );

  // ── Publish coupon ─────────────────────────────────────────────────────────
  const handlePublish = useCallback(() => {
    if (!adminStore.selectedMatches.length) {
      showToast('Ajoutez au moins 1 match au coupon', COLORS.dangerRed);
      return;
    }
    const slip = adminStore.buildBetSlip();
    betStore.setBetSlip(slip);
    betStore.addBetHistoryItem({
      id: slip.id,
      type: slip.type,
      date: slip.date,
      eventCount: slip.eventCount,
      totalOdds: slip.totalOdds,
      stake: slip.stake,
      potentialGain: slip.potentialGain,
      status: slip.status,
      events: slip.events,
      code: slip.code,
    });
    adminStore.clearMatches();
    adminStore.setCouponDate('');
    router.replace('/bet-details');
  }, [adminStore, betStore, showToast, router]);

  // ── Tab configuration ──────────────────────────────────────────────────────
  const TABS: TabConfig[] = [
    {
      key: 'create',
      label: 'Créer match',
      icon: 'plus-circle',
      iconLib: 'fa',
    },
    {
      key: 'coupon',
      label: 'Coupon',
      icon: 'ticket',
      iconLib: 'fa',
      badge: () =>
        adminStore.selectedMatches.length > 0
          ? String(adminStore.selectedMatches.length)
          : null,
    },
    {
      key: 'coupons',
      label: 'Gérer coupons',
      icon: 'list-alt',
      iconLib: 'fa',
    },
    {
      key: 'users',
      label: 'Utilisateurs',
      icon: 'account-group',
      iconLib: 'mci',
      adminOnly: true,
    },
    {
      key: 'database',
      label: 'SQLite',
      icon: 'database',
      iconLib: 'fa',
    },
  ];

  const visibleTabs = TABS.filter((t) => !t.adminOnly || sessionRole === 'admin');

  // ── Render icon ────────────────────────────────────────────────────────────
  const renderIcon = (tab: TabConfig, isActive: boolean) => {
    const color = isActive ? '#FFF' : '#7A9EC0';
    const size = 15;
    if (tab.iconLib === 'fa')
      return <FontAwesome name={tab.icon as any} size={size} color={color} />;
    if (tab.iconLib === 'mci')
      return <MaterialCommunityIcons name={tab.icon as any} size={size} color={color} />;
    return <Ionicons name={tab.icon as any} size={size} color={color} />;
  };

  // ── Tab content ────────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'create':
        return (
          <CreateMatchTab
            onSuccess={(msg) => showToast(msg, COLORS.successGreen)}
            onError={(msg) => showToast(msg, COLORS.dangerRed)}
          />
        );
      case 'coupon':
        return <CouponBuilderTab onPublish={handlePublish} />;
      case 'coupons':
        return (
          <CouponsManagementTab
            onSuccess={(msg) => showToast(msg, COLORS.successGreen)}
            onError={(msg) => showToast(msg, COLORS.dangerRed)}
          />
        );
      case 'users':
        return sessionRole === 'admin' ? (
          <UsersManagementTab
            onSuccess={(msg) => showToast(msg, COLORS.successGreen)}
            onError={(msg) => showToast(msg, COLORS.dangerRed)}
          />
        ) : (
          <View style={s.locked}>
            <View style={s.lockedIconBg}>
              <FontAwesome name="lock" size={32} color="#94A3B8" />
            </View>
            <Text style={s.lockedTitle}>Accès restreint</Text>
            <Text style={s.lockedSub}>
              La gestion des utilisateurs est réservée à l'administrateur.
            </Text>
          </View>
        );
      case 'database':
        return <SqliteViewerTab />;
      default:
        return null;
    }
  };

  return (
    <View style={[s.root, { backgroundColor: bg.appBg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F44" translucent />

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          s.toast,
          { transform: [{ translateY: toastY }], backgroundColor: toastColor },
          { top: insets.top + 8 },
        ]}
        pointerEvents="none"
      >
        <FontAwesome name={toastIcon} size={16} color="#FFF" style={{ marginRight: 10 }} />
        <Text style={s.toastText} numberOfLines={2}>{toastMsg}</Text>
      </Animated.View>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        {/* Top row */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <View style={s.headerBadge}>
              <MaterialCommunityIcons name="shield-crown" size={14} color="#FFD700" style={{ marginRight: 5 }} />
              <Text style={s.headerBadgeText}>Administration</Text>
            </View>
            <Text style={s.headerTitle}>Panel Admin</Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/admin-theme')}
            style={s.iconBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="color-palette-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* ── Tab bar — scrollable horizontally ─────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBarContent}
          style={s.tabBar}
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const badge = tab.badge?.();
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabBtn, isActive && s.tabBtnActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <View style={s.tabBtnInner}>
                  {renderIcon(tab, isActive)}
                  <Text style={[s.tabBtnText, isActive && s.tabBtnTextActive]}>
                    {tab.label}
                  </Text>
                  {badge && (
                    <View style={s.badgePill}>
                      <Text style={s.badgePillText}>{badge}</Text>
                    </View>
                  )}
                </View>
                {isActive && <View style={s.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <View style={s.content}>{renderContent()}</View>
    </View>
  );
}

const HEADER_BG = '#0A1F44';
const HEADER_BG2 = '#112E60';

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EEF3F8',
  },

  // ── Toast ──────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
  },
  toastText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
    lineHeight: 19,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: HEADER_BG,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#0D264F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  headerBadgeText: {
    color: '#FFD700',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── Tab bar ─────────────────────────────────────────────────────────────────
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tabBarContent: {
    paddingHorizontal: 8,
    paddingTop: 4,
    gap: 2,
  },
  tabBtn: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 0,
    paddingTop: 2,
    position: 'relative',
    borderRadius: 0,
    minWidth: 90,
  },
  tabBtnActive: {},
  tabBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#5A7FA8',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#4A9EFF',
  },
  badgePill: {
    backgroundColor: '#FF4D4D',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  badgePillText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Content ─────────────────────────────────────────────────────────────────
  content: {
    flex: 1,
  },

  // ── Locked ──────────────────────────────────────────────────────────────────
  locked: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 36,
    gap: 12,
  },
  lockedIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A5F',
  },
  lockedSub: {
    fontSize: 13.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
