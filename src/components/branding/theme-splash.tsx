import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from 'react-native';
import { getThemeBrandLogo, getThemeBranding, getThemeSplashConfig } from '@/constants/themeBranding';

const BLUE_LOGO = require('../../../assets/images/android-splash/dynamic/logo.png');
const MEGA_LOGO = require('../../../assets/images/brand-logos/megapari-splash-horizontal.png');
const BLUE_PARTNERS = [
  require('../../../assets/images/android-splash/dynamic/partner-barca.png'),
  require('../../../assets/images/android-splash/dynamic/partner-psg.png'),
  require('../../../assets/images/android-splash/dynamic/partner-pud.png'),
  require('../../../assets/images/android-splash/dynamic/partner-caf.png'),
  require('../../../assets/images/android-splash/dynamic/partner-losc.png'),
];
const SPORT_LOADER_COUNT = 8;
const LOADER_ICONS = [
  require('../../../assets/images/android-splash/loader-0.png'),
  require('../../../assets/images/android-splash/loader-1.png'),
  require('../../../assets/images/android-splash/loader-2.png'),
  require('../../../assets/images/android-splash/loader-3.png'),
  require('../../../assets/images/android-splash/loader-4.png'),
  require('../../../assets/images/android-splash/loader-5.png'),
  require('../../../assets/images/android-splash/loader-6.png'),
  require('../../../assets/images/android-splash/loader-7.png'),
];
const LOADER_DOT = require('../../../assets/images/android-splash/loader-dot.png');
const BLUE_VERSION = require('../../../assets/images/android-splash/dynamic/version.png');

export function ThemeSplash({ theme, animate = true, onComplete }: { theme: string; animate?: boolean; onComplete?: () => void }) {
  const branding = getThemeBranding(theme);
  const config = getThemeSplashConfig(theme);
  const brandLogo = theme === 'blue' ? BLUE_LOGO : theme === 'red_mega' ? MEGA_LOGO : getThemeBrandLogo(theme, 'dark');
  const phase = useRef(new Animated.Value(0)).current;
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [reduceMotion, setReduceMotion] = useState(false);
  const stationary = reduceMotion || !animate;

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    // Completion is per mount, not per accessibility preference change.
    // A completed/skipped pass must stay on its last frame forever.
    if (completed.current) {
      phase.setValue(SPORT_LOADER_COUNT - 0.5);
      return;
    }
    if (stationary) {
      phase.setValue(SPORT_LOADER_COUNT - 0.5);
      completed.current = true;
      onCompleteRef.current?.();
      return;
    }
    // Preserve the original left-to-right fade, but run one pass only.
    // The launcher waits for this callback before replacing the splash.
    const sequence = Animated.timing(phase, {
      toValue: SPORT_LOADER_COUNT - 0.5,
      duration: 7200,
      useNativeDriver: true,
      isInteraction: false,
    });
    sequence.start(({ finished }) => {
      if (finished && !completed.current) {
        completed.current = true;
        onCompleteRef.current?.();
      }
    });
    return () => { sequence.stop(); phase.stopAnimation(); };
  }, [phase, stationary]);

  return (
    <View style={[styles.root, { backgroundColor: config.background }]} accessibilityLabel={`Écran de démarrage ${branding?.name ?? '1xBet'}`}>
      {brandLogo && <Image source={brandLogo} resizeMode="contain" style={[
        styles.logo,
        theme === 'red_mega' && styles.megaLogo,
        { top: config.logoTop },
      ]} />}
      {theme === 'blue' && <View style={styles.partners} accessibilityLabel="Partenaires 1xBet">
        {BLUE_PARTNERS.map((logo, index) => <Image key={index} source={logo} resizeMode="contain" style={styles.partnerLogo} />)}
      </View>}
      {theme === 'blue' && <Image source={BLUE_VERSION} resizeMode="contain" style={styles.version} accessibilityLabel="Version de l’application" />}
      <View style={[styles.loader, { bottom: config.loaderBottom }]} accessible accessibilityRole="progressbar" accessibilityLabel="Chargement de l’application">
        {Array.from({ length: SPORT_LOADER_COUNT }, (_, index) => {
          const opacity = stationary ? 1 : phase.interpolate({
            inputRange: [index, index + 0.5, SPORT_LOADER_COUNT],
            outputRange: [0, 1, 1],
          });
          return <View key={index} style={styles.slot}>
            <Image source={LOADER_DOT} resizeMode="contain" style={styles.loaderIcon} />
            <Animated.Image source={LOADER_ICONS[index]} resizeMode="contain" style={[styles.loaderIcon, styles.loaderIconOverlay, { opacity }]} />
          </View>;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  logo: { position: 'absolute', left: '12%', width: '76%', height: '13%' },
  megaLogo: { left: '3%', width: '94%', height: '24%' },
  loader: { position: 'absolute', left: '16%', right: '16%', height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slot: { width: 26, height: 30, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  loaderIcon: { width: 24, height: 24 },
  loaderIconOverlay: { position: 'absolute' },
  partners: { position: 'absolute', left: '8%', right: '8%', bottom: '14%', height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  partnerLogo: { width: 54, height: 59 },
  version: { position: 'absolute', right: '7%', bottom: '3.7%', width: 56, height: 18 },
});
