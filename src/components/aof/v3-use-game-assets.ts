// Assets visuels AOF v3 — versions locales embarquées pour stabilité mobile.
// Images fournies par l'utilisateur (disque bois sculpté, pomme rouge haut de gamme,
// trognon, disque vierge) copiées depuis le bundle v3 et compressées 512 px.
import React from "react";
import { Image } from "react-native";

export const GAME_ASSETS = {
  plankWood: require("@/assets/aof-v2/plank-wood.png"),
  plankBlank: require("@/assets/aof-v2/plank-blank.png"),
  plankWin: require("@/assets/aof-v2/plank-win.png"),
  plankLose: require("@/assets/aof-v2/plank-lose.png"),
  jungleBg: require("@/assets/aof-v2/jungle-bg.jpg"),
} as const;

/** Précharge les tuiles win/lose pour que le premier dévoilement soit instantané. */
export function usePreloadGameAssets(): { loaded: boolean } {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    Promise.all(
      [GAME_ASSETS.plankWin, GAME_ASSETS.plankLose].map(
        (res) =>
          new Promise<void>((ok, fail) => {
            // require() retourne un { uri } sur mobile ; Image.getSize valide
            // le décodage. Si échec, on laisse quand même le jeu tourner.
            Image.getSize(
              Image.resolveAssetSource(res).uri,
              () => ok(),
              () => ok(),
            );
          }),
      ),
    )
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { loaded: ready };
}
