import type { ImageSourcePropType } from 'react-native';

export type BrandTheme = 'blue' | 'royal_blue' | 'green' | 'gold' | 'light_green' | 'red_mega';

/** Couleur de marque utilisée par les CTA, le portefeuille et les boutons « + ». */
export const THEME_ACCENT_COLORS: Readonly<Record<BrandTheme, string>> = {
  // Le thème classique 1xBet reprend son accent bleu, pas le vert de statut.
  blue: '#2E79C9',
  light_green: '#7CB342',
  green: '#008264',
  royal_blue: '#2E45D1',
  gold: '#E5A93B',
  red_mega: '#E60000',
};

export type ThemeBranding = Readonly<{
  name: string;
  logoLight: ImageSourcePropType;
  logoDark: ImageSourcePropType;
}>;

export type ThemeSplashConfig = Readonly<{
  background: string;
  loaderColor: string;
  logoTop: `${number}%`;
  loaderBottom: `${number}%`;
}>;

const THEME_SPLASH_CONFIG: Readonly<Record<BrandTheme, ThemeSplashConfig>> = {
  blue: { background: '#263B59', loaderColor: '#FFFFFF', logoTop: '35%', loaderBottom: '6.5%' },
  royal_blue: { background: '#2430E5', loaderColor: '#FFFFFF', logoTop: '31%', loaderBottom: '25%' },
  red_mega: { background: '#000000', loaderColor: '#FFFFFF', logoTop: '35%', loaderBottom: '12%' },
  light_green: { background: '#000000', loaderColor: '#FFFFFF', logoTop: '37%', loaderBottom: '10%' },
  green: { background: '#24502F', loaderColor: '#FFFFFF', logoTop: '61%', loaderBottom: '9%' },
  gold: { background: '#24272D', loaderColor: '#FFFFFF', logoTop: '36%', loaderBottom: '16%' },
};

// Ces images appartiennent au header de Populaire, jamais à l'icône Coupon.
// Un logo manquant ne doit jamais être remplacé par 1xBet ou une autre marque.
export const THEME_BRANDING: Readonly<Record<BrandTheme, ThemeBranding>> = {
  red_mega: {
    name: 'MegaPari',
    logoLight: require('../../assets/images/brand-logos/megapari-logo-transparent.png'),
    logoDark: require('../../assets/images/brand-logos/megapari-logo-transparent.png'),
  },
  blue: {
    name: '1xBet',
    logoLight: require('../../assets/images/1xbet-header-logo-user.png'),
    logoDark: require('../../assets/images/1xbet-header-logo-user.png'),
  },
  light_green: {
    name: 'WinWin',
    logoLight: require('../../assets/images/brand-logos/winwin-light.png'),
    logoDark: require('../../assets/images/brand-logos/winwin-dark.png'),
  },
  green: {
    name: 'Linebet',
    logoLight: require('../../assets/images/brand-logos/linebet-light.png'),
    logoDark: require('../../assets/images/brand-logos/linebet-dark.png'),
  },
  royal_blue: {
    name: 'Paripesa',
    logoLight: require('../../assets/images/brand-logos/paripesa-light.png'),
    logoDark: require('../../assets/images/brand-logos/paripesa-dark.png'),
  },
  gold: {
    name: 'Melbet',
    logoLight: require('../../assets/images/brand-logos/melbet-light.png'),
    logoDark: require('../../assets/images/brand-logos/melbet-dark.png'),
  },
};

export function getThemeBranding(theme: string): ThemeBranding | null {
  return Object.prototype.hasOwnProperty.call(THEME_BRANDING, theme)
    ? THEME_BRANDING[theme as BrandTheme]
    : null;
}

export function getThemeAccentColor(theme: string): string {
  return THEME_ACCENT_COLORS[theme as BrandTheme] ?? THEME_ACCENT_COLORS.blue;
}

export function getThemeSplashBackground(theme: string): string {
  return getThemeSplashConfig(theme).background;
}

export function getThemeSplashConfig(theme: string): ThemeSplashConfig {
  return THEME_SPLASH_CONFIG[theme as BrandTheme] ?? THEME_SPLASH_CONFIG.blue;
}

export function getThemeBrandLogo(theme: string, backgroundMode: string): ImageSourcePropType | null {
  const brand = getThemeBranding(theme);
  if (!brand) return null;
  return backgroundMode === 'light' ? brand.logoLight : brand.logoDark;
}
