import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';
import { areGameAssetsLoaded, preloadGameAssets } from '@/components/aof/v4/use-game-assets';
import {
  isGameLaunchRoutePrefetched,
  prefetchGameLaunchRoute,
  resolveGameLaunchRoute,
} from '@/services/gameLaunchRoutes';
import { AviatorConnectionScreen } from '@/components/aviator/AviatorConnectionScreen';

const MIN_GAME_LOADING_MS = 300;
const COMPLETE_FRAME_HOLD_MS = 110;
const AVIATOR_CONNECTION_MS = 2500;
const LOADING_START_FRAME = require('../../assets/game/xgame-loading/frame-00.png');
const LOADING_COMPLETE_FRAME = require('../../assets/game/xgame-loading/frame-10.png');

/**
 * Un seul indicateur stable par première ouverture du jeu sélectionné.
 * Les ressources AOF et Crash Point sont prêtes avant la transition; Crash
 * affiche cet indicateur dans son écran jusqu'au onLoadEnd natif du WebView.
 */
export default function XGameLoadingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId?: string | string[] }>();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId ?? '';
  const destination = resolveGameLaunchRoute(gameId);
  const isAviator = destination === '/aviator-game';
  const isCrash = destination === '/crash';
  const assetsReadyAtRender = gameId !== 'apple-of-fortune' || areGameAssetsLoaded();
  const [completedRoute, setCompletedRoute] = useState<string | null>(null);
  const showCompleteFrame = completedRoute === destination;
  const canSkipLoader = Boolean(
    destination && !isAviator && !isCrash &&
    isGameLaunchRoutePrefetched(destination) && assetsReadyAtRender && completedRoute !== destination,
  );
  const navigationTriggered = useRef(false);

  useEffect(() => {
    let active = true;
    let minimumTimer: ReturnType<typeof setTimeout> | undefined;
    let navigationTimer: ReturnType<typeof setTimeout> | undefined;

    navigationTriggered.current = false;

    const navigateToGame = () => {
      if (!active || navigationTriggered.current || !destination) return;
      navigationTriggered.current = true;
      router.replace(destination as never);
    };

    if (!destination) {
      navigationTriggered.current = true;
      router.replace('/');
      return () => {
        active = false;
      };
    }

    const routeWasPrefetched = isGameLaunchRoutePrefetched(destination);
    prefetchGameLaunchRoute(router, destination);

    if (isAviator) {
      navigationTimer = setTimeout(navigateToGame, AVIATOR_CONNECTION_MS);
    } else if (isCrash) {
      // Le WebView est le vrai travail asynchrone; son écran propre affiche le loader.
      navigateToGame();
    } else {
      const gameAssetsAlreadyReady = gameId !== 'apple-of-fortune' || areGameAssetsLoaded();
      if (routeWasPrefetched && gameAssetsAlreadyReady) {
        navigateToGame();
      } else {
        const selectedGameResources = gameId === 'apple-of-fortune'
          ? preloadGameAssets().then(() => undefined).catch(() => undefined)
          : Promise.resolve();
        const minimumDisplay = new Promise<void>((resolve) => {
          minimumTimer = setTimeout(resolve, routeWasPrefetched ? 0 : MIN_GAME_LOADING_MS);
        });

        void Promise.all([selectedGameResources, minimumDisplay]).then(() => {
          if (!active) return;
          setCompletedRoute(destination);
          navigationTimer = setTimeout(navigateToGame, COMPLETE_FRAME_HOLD_MS);
        });
      }
    }

    return () => {
      active = false;
      if (minimumTimer !== undefined) clearTimeout(minimumTimer);
      if (navigationTimer !== undefined) clearTimeout(navigationTimer);
    };
  }, [destination, gameId, isAviator, isCrash, router]);

  const showLoaderImage = Boolean(destination) && !isAviator && !isCrash && !canSkipLoader;

  return (
    <View
      style={[
        styles.screen,
        isAviator && styles.aviatorScreen,
        isCrash && styles.crashScreen,
      ]}
      accessibilityLabel="Chargement"
    >
      <StatusBar hidden />
      {isAviator ? <AviatorConnectionScreen /> : showLoaderImage ? (
        <Image
          source={showCompleteFrame ? LOADING_COMPLETE_FRAME : LOADING_START_FRAME}
          style={StyleSheet.absoluteFill}
          resizeMode="stretch"
          accessibilityLabel="Préparation des ressources du jeu"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#1D4367',
  },
  aviatorScreen: { backgroundColor: '#000000' },
  crashScreen: { backgroundColor: '#080f23' },
});
