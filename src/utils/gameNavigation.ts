import { router } from 'expo-router';

/** Return to the 1xGames subtab, independent of the screen's navigation history. */
export function navigateTo1xGames(): void {
  router.dismissTo({ pathname: '/', params: { topTab: 'games' } } as any);
}
