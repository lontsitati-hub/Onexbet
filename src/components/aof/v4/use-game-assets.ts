import React from 'react';
import { Asset } from 'expo-asset';

/**
 * Registry des assets de jeu Apple of Fortune v4 (assets locaux embarqués).
 * Le préchargement garantit que la première révélation n'a aucun pop-in.
 */
export const GAME_ASSETS = {
  // Tuiles du jeu (disque de bois sculpté, pomme rouge, trognon, disque vierge)
  plankWood: require('@/assets/aof-v2/plank-wood.png'),
  plankBlank: require('@/assets/aof-v2/plank-blank.png'),
  plankWin: require('@/assets/aof-v2/plank-win.png'),
  plankLose: require('@/assets/aof-v2/plank-lose.png'),
  jungleBg: require('@/assets/aof-v2/jungle-reference.png'),
} as const satisfies Record<string, number>;

let gameAssetsLoaded = false;
let gameAssetsLoadPromise: Promise<Asset[]> | null = null;

/**
 * Télécharge les assets embarqués (via require) une seule fois vers le cache
 * local. Le loader commun et l'écran AOF attendent cette même promesse.
 */
function preloadAssets(): Promise<Asset[]> {
  return Promise.all(
    Object.values(GAME_ASSETS).map((resId) => Asset.fromModule(resId as number).downloadAsync()),
  );
}

export function areGameAssetsLoaded(): boolean {
  return gameAssetsLoaded;
}

export function preloadGameAssets(): Promise<Asset[]> {
  if (gameAssetsLoaded) return Promise.resolve([]);
  if (gameAssetsLoadPromise) return gameAssetsLoadPromise;

  gameAssetsLoadPromise = preloadAssets()
    .then((assets) => {
      gameAssetsLoaded = true;
      return assets;
    })
    .catch((error: unknown) => {
      // Permettre un nouvel essai ultérieur si le cache natif a échoué.
      gameAssetsLoadPromise = null;
      throw error;
    });

  return gameAssetsLoadPromise;
}

export function usePreloadGameAssets(): { loaded: boolean } {
  const [ready, setReady] = React.useState(areGameAssetsLoaded);

  React.useEffect(() => {
    let cancelled = false;
    void preloadGameAssets()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // En cas d'échec local, garder le jeu utilisable et retenter au prochain lancement.
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loaded: ready };
}
