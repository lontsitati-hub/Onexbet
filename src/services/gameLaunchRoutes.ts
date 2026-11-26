import type { Href } from 'expo-router';

export const GAME_LAUNCH_ROUTES = {
  aviator: '/aviator-game',
  crash: '/crash',
  'apple-of-fortune': '/apple-of-fortune',
  'wild-west-gold': '/wild-west-gold',
  'crash-point': '/crash-point',
} as const;

/** Précharge uniquement l'écran de transition vers un jeu, après authentification. */
export const APP_PREFETCH_ROUTES = ['/xgame-loading'] as const;

export function resolveGameLaunchRoute(gameId: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(GAME_LAUNCH_ROUTES, gameId)) return null;
  return GAME_LAUNCH_ROUTES[gameId as keyof typeof GAME_LAUNCH_ROUTES];
}

type RoutePrefetcher = {
  prefetch: (route: Href) => void;
};

const prefetchedRoutes = new Set<string>();

export function isGameLaunchRoutePrefetched(route: string | null): boolean {
  return Boolean(route && prefetchedRoutes.has(route));
}

/** Prépare le bundle d'un jeu sans bloquer le rendu de l'écran courant. */
export function prefetchGameLaunchRoute(router: RoutePrefetcher, route: string | null): void {
  if (!route || prefetchedRoutes.has(route)) return;
  prefetchedRoutes.add(route);
  try {
    router.prefetch(route as Href);
  } catch {
    // Le jeu reste lançable à la demande si le runtime ne supporte pas prefetch.
    prefetchedRoutes.delete(route);
  }
}

/** Prépare le loader, puis celui-ci précharge uniquement le jeu choisi. */
export function prefetchAppRoutes(router: RoutePrefetcher): void {
  APP_PREFETCH_ROUTES.forEach((route) => prefetchGameLaunchRoute(router, route));
}
