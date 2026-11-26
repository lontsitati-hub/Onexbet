import { Platform } from 'react-native';

// ─── Mode de fond (background mode) ─────────────────────────────────────────
export type BackgroundMode = 'light' | 'dark' | 'navy' | 'midnight';

export interface BackgroundPalette {
  // Couleurs principales
  appBg: string;           // Fond principal de l'app
  cardBg: string;          // Fond des cartes / panneaux blancs
  headerBg: string;        // Fond du header
  sectionBg: string;       // Fond des sections secondaires
  tabBarBg: string;        // Fond de la TabBar
  // Textes
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Bordures
  border: string;
  divider: string;
  // Éléments interactifs
  inputBg: string;
  pillBg: string;
  // StatusBar style
  statusBarStyle: 'dark-content' | 'light-content';
}

export const BACKGROUND_PALETTES: Record<BackgroundMode, BackgroundPalette> = {
  light: {
    appBg: '#E7EAEE',
    cardBg: '#FFFFFF',
    headerBg: '#FFFFFF',
    sectionBg: '#F1F3F6',
    tabBarBg: '#FFFFFF',
    textPrimary: '#162B3A',
    textSecondary: '#7D8B96',
    textMuted: '#A3AFB8',
    border: '#E1E6EA',
    divider: '#E3E7EB',
    inputBg: '#F2F4F6',
    pillBg: '#F1F3F6',
    statusBarStyle: 'dark-content',
  },
  dark: {
    // Palette alignée sur la référence sombre 1xBet fournie.
    appBg: '#24303E',
    cardBg: '#2E3D52',
    headerBg: '#2E3D52',
    sectionBg: '#24303E',
    tabBarBg: '#2E3D52',
    textPrimary: '#F0F4F8',
    textSecondary: '#9AAEC3',
    textMuted: '#71869C',
    border: '#3A4F6A',
    divider: '#3A4F6A',
    inputBg: '#3A4F6A',
    pillBg: '#3A4F6A',
    statusBarStyle: 'light-content',
  },
  navy: {
    appBg: '#0C2040',
    cardBg: '#13304F',
    headerBg: '#13304F',
    sectionBg: '#0B1B34',
    tabBarBg: '#13304F',
    textPrimary: '#D6E8F5',
    textSecondary: '#7AACCB',
    textMuted: '#5C7F9E',
    border: '#234666',
    divider: '#234666',
    inputBg: '#183B5E',
    pillBg: '#183B5E',
    statusBarStyle: 'light-content',
  },
  midnight: {
    appBg: '#000000',
    cardBg: '#1C1C1C',
    headerBg: '#1C1C1C',
    sectionBg: '#101010',
    tabBarBg: '#1C1C1C',
    textPrimary: '#F0F0F0',
    textSecondary: '#9A9A9A',
    textMuted: '#4A5A6A',
    border: '#1E2535',
    divider: '#2B2B2B',
    inputBg: '#252525',
    pillBg: '#252525',
    statusBarStyle: 'light-content',
  },
};

const withOpacity = (color: string, opacity: number) => {
  const normalized = Math.max(0.35, Math.min(1, opacity));
  if (!color.startsWith('#') || color.length !== 7 || normalized >= 1) return color;
  const alpha = Math.round(normalized * 255).toString(16).padStart(2, '0');
  return `${color}${alpha}`;
};

export const getBackgroundPalette = (mode: BackgroundMode, opacity = 1): BackgroundPalette => {
  const palette = BACKGROUND_PALETTES[mode] ?? BACKGROUND_PALETTES.light;
  return {
    ...palette,
    appBg: withOpacity(palette.appBg, opacity),
    cardBg: withOpacity(palette.cardBg, opacity),
    headerBg: withOpacity(palette.headerBg, opacity),
    sectionBg: withOpacity(palette.sectionBg, opacity),
    tabBarBg: withOpacity(palette.tabBarBg, opacity),
    inputBg: withOpacity(palette.inputBg, opacity),
    pillBg: withOpacity(palette.pillBg, opacity),
  };
};

export const COLORS = {
  // Couleurs principales inspirées de la capture
  primaryBlue: '#4C86C6',
  darkBlue: '#162B3A',
  secondaryBlue: '#7D8B96',

  successGreen: '#4EB45E',
  depositGreen: '#4EB45E',

  dangerRed: '#E12D34',
  warningYellow: '#F5B041',

  background: '#E7EAEE',
  cardWhite: '#FFFFFF',

  textPrimary: '#162B3A',
  textGray: '#7D8B96',
  textSecondary: '#7D8B96',

  // Boutons et éléments secondaires
  lightBlueBtn: '#F1F3F6',
  lightBlueText: '#4C86C6',

  // Compatibilité
  white: '#FFFFFF',
  cardBackground: '#FFFFFF',

  accentBlue: '#4C86C6',
  badgeBlue: '#4C86C6',

  switchBg: '#EDF2F6',
  switchActive: '#4C86C6',

  divider: '#C8D5E1',
  border: '#DCE7EF',

  // Spécifiques 1xBet
  oddsBackground: '#F5F8FC',
  oddsBorder: '#D7E4F0',

  liveRed: '#E74C3C',
  favoriteBlue: '#4C86C6',

  bottomTabInactive: '#407094',
  bottomTabActive: '#4C86C6',
};
export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// ─── Propriétés originales pour la compatibilité du dossier example ─────────

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
