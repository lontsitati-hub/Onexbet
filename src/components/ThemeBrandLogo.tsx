import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { getThemeBranding, getThemeBrandLogo, type BrandTheme } from '@/constants/themeBranding';
import type { BackgroundMode } from '@/constants/theme';

export function ThemeBrandLogo({
  theme,
  backgroundMode,
}: {
  theme: BrandTheme;
  backgroundMode: BackgroundMode;
}) {
  const brand = getThemeBranding(theme);
  const source = getThemeBrandLogo(theme, backgroundMode);
  // Aucune substitution par 1xBet en cas de valeur de thème inconnue.
  if (!brand || !source) return <View style={styles.slot} />;

  return (
    <Image
      key={`${theme}-${backgroundMode}`}
      source={source}
      style={styles.slot}
      resizeMode="contain"
      fadeDuration={0}
      accessibilityLabel={`Logo ${brand.name}`}
      testID={`theme-brand-logo-${theme}`}
    />
  );
}

const styles = StyleSheet.create({
  slot: { width: 96, height: 28, marginLeft: 8 },
});
