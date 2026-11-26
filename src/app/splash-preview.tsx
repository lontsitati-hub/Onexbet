import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ThemeSplash } from '@/components/branding/theme-splash';
import { getThemeBranding } from '@/constants/themeBranding';

/** Visual QA only; release builds never expose this preview route. */
export default function SplashPreview() {
  const { style, still } = useLocalSearchParams<{ style?: string; still?: string }>();
  const theme = typeof style === 'string' && getThemeBranding(style) ? style : 'blue';
  if (!__DEV__) return <Redirect href="/" />;
  return <ThemeSplash theme={theme} animate={still !== '1'} />;
}
