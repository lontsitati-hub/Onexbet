import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBetStore } from '../store/useBetStore';
import { getBackgroundPalette } from '../constants/theme';
import { getNavigationInactiveColor } from '../utils/navigationColors';

const ACTIVE_COLOR = '#2E79C9';

function AnimatedFooterTab({
  label,
  icon,
  active,
  activeColor,
  inactiveColor,
  onPress,
}: {
  label: string;
  icon: number;
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const pressScale = useMemo(() => new Animated.Value(1), []);
  const [selectionProgress] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    const animation = Animated.spring(selectionProgress, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 5,
    });
    animation.start();
    return () => animation.stop();
  }, [active, selectionProgress]);

  const selectionScale = selectionProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const selectionLift = selectionProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const onPressIn = useCallback(() => {
    // Le feedback tactile reste indépendant de la transition de sélection.
    Animated.spring(pressScale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [pressScale]);
  const onPressOut = useCallback(() => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }, [pressScale]);

  return (
    <TouchableOpacity style={styles.tabItem} activeOpacity={0.65} onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <View style={{ alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale: pressScale }] }}>
          <Animated.View style={{ transform: [{ translateY: selectionLift }, { scale: selectionScale }] }}>
            <View style={styles.iconStack}>
              <Image source={icon} style={[styles.videoBottomIcon, { tintColor: inactiveColor }]} resizeMode="contain" />
              <Animated.Image source={icon} style={[styles.videoBottomIcon, styles.activeIconOverlay, { tintColor: activeColor, opacity: selectionProgress }]} resizeMode="contain" />
            </View>
          </Animated.View>
        </Animated.View>
        <Text style={[styles.tabLabel, { color: active ? activeColor : inactiveColor, fontWeight: active ? '800' : '600' }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export const TabBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const couponPressScale = useMemo(() => new Animated.Value(1), []);
  const activeTab = useBetStore((state) => state.activeTab);
  const setActiveTab = useBetStore((state) => state.setActiveTab);
  const highlightedTab = activeTab;
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const currentBetSlip = useBetStore((state) => state.currentBetSlip);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : ACTIVE_COLOR;
  const inactiveColor = getNavigationInactiveColor(backgroundMode);
  const couponActive = highlightedTab === 'coupon';
  const [couponSelectionProgress] = useState(() => new Animated.Value(couponActive ? 1 : 0));
  useEffect(() => {
    const animation = Animated.spring(couponSelectionProgress, {
      toValue: couponActive ? 1 : 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 5,
    });
    animation.start();
    return () => animation.stop();
  }, [couponActive, couponSelectionProgress]);
  const couponSelectionScale = couponSelectionProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const couponSelectionLift = couponSelectionProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  // Le badge signale uniquement un coupon créé mais pas encore utilisé.
  const couponCount = currentBetSlip.isDraft && currentBetSlip.events.length > 0 ? currentBetSlip.events.length : 0;

  const navigateTab = useCallback((tab: 'populaire' | 'favoris' | 'coupon' | 'historique' | 'menu') => {
    // Zustand met à jour immédiatement l’onglet actif; son animation suit le nouvel état.
    setActiveTab(tab);
    useBetStore.getState().setSelectedHistoryId(null);
    useBetStore.getState().setShowMatchDetails(false);
    if (pathname !== '/' && pathname !== '/index') router.replace('/');
  }, [pathname, router, setActiveTab]);
  const onCouponPressIn = useCallback(() => Animated.spring(couponPressScale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 4 }).start(), [couponPressScale]);
  const onCouponPressOut = useCallback(() => Animated.spring(couponPressScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start(), [couponPressScale]);
  const bottomInset = insets.bottom || 34;

  return <View style={[styles.tabContainer, { height: 60 + bottomInset, paddingBottom: bottomInset, backgroundColor: bg.tabBarBg, borderTopColor: bg.divider }]}>
    <AnimatedFooterTab label="Populaire" icon={require('../../assets/images/video-reference-icons/bottom-populaire-transparent.png')} active={highlightedTab === 'populaire'} activeColor={activeColor} inactiveColor={inactiveColor} onPress={() => navigateTab('populaire')} />
    <AnimatedFooterTab label="Favoris" icon={require('../../assets/images/video-reference-icons/bottom-favoris-transparent.png')} active={highlightedTab === 'favoris'} activeColor={activeColor} inactiveColor={inactiveColor} onPress={() => navigateTab('favoris')} />
    <Pressable style={styles.couponTabItem} onPressIn={onCouponPressIn} onPressOut={onCouponPressOut} onPress={() => navigateTab('coupon')} accessibilityRole="tab" accessibilityState={{ selected: couponActive }}>
      <View style={{ alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale: couponPressScale }] }}>
          <Animated.View style={{ transform: [{ translateY: couponSelectionLift }, { scale: couponSelectionScale }] }}>
            <View style={styles.couponIconWrapper}>
              <Image
                source={theme === 'red_mega' ? require('../../assets/images/icon_coupon_tab_red_mega.png') : theme === 'light_green' ? require('../../assets/images/icon_coupon_tab_light_green.png') : theme === 'green' ? require('../../assets/images/icon_coupon_tab_green.png') : theme === 'royal_blue' ? require('../../assets/images/icon_coupon_tab_royal_transparent.png') : theme === 'gold' ? require('../../assets/images/icon_coupon_tab_gold.png') : require('../../assets/images/icon_coupon_tab.png')}
                style={styles.couponIconImage}
                resizeMode="contain"
              />
              {couponCount > 0 && <View style={[styles.couponBadge, { borderColor: bg.tabBarBg }]}><Text style={styles.couponBadgeText}>{couponCount > 99 ? '99+' : couponCount}</Text></View>}
            </View>
          </Animated.View>
        </Animated.View>
        <Text style={[styles.tabLabel, { color: couponActive ? activeColor : inactiveColor, fontWeight: couponActive ? '800' : '600' }]}>Coupon</Text>
      </View>
    </Pressable>
    <AnimatedFooterTab label="Historique" icon={require('../../assets/images/video-reference-icons/bottom-historique-transparent.png')} active={highlightedTab === 'historique'} activeColor={activeColor} inactiveColor={inactiveColor} onPress={() => navigateTab('historique')} />
    <AnimatedFooterTab label="Menu" icon={require('../../assets/images/video-reference-icons/bottom-menu-transparent.png')} active={highlightedTab === 'menu'} activeColor={activeColor} inactiveColor={inactiveColor} onPress={() => navigateTab('menu')} />
  </View>;
};

const styles = StyleSheet.create({
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, alignItems: 'center', justifyContent: 'space-around', shadowColor: '#173A54', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 10, zIndex: 1000 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  couponTabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', top: -10 },
  // Le bouton central dépasse légèrement la barre comme dans la vidéo, sans
  // agrandir son pictogramme au point de déplacer les autres boutons.
  couponIconWrapper: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  couponIconImage: { width: '100%', height: '100%' },
  // Les assets de référence mesurent environ 30–32 × 27 px. Le ratio est
  // conservé pour que Menu, Historique, Favoris et Populaire restent alignés.
  videoBottomIcon: { width: 28, height: 24 },
  iconStack: { width: 28, height: 24, position: 'relative' },
  activeIconOverlay: { position: 'absolute', left: 0, top: 0 },
  couponBadge: { position: 'absolute', bottom: 0, right: -1, backgroundColor: '#C62828', minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderWidth: 2, elevation: 6, zIndex: 10 },
  couponBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', textAlign: 'center', lineHeight: 11 },
  tabLabel: { fontSize: 10, fontWeight: '500', fontFamily: 'System', marginTop: 2 },
});
