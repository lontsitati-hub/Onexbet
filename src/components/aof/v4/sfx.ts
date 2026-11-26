import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Détection de l'environnement web sans importer react-native (dont le module
// fait échouer le parseur de Vite/Vitest en environnement Node).
const IS_WEB =
  typeof globalThis.window !== "undefined" &&
  typeof globalThis.document !== "undefined";

let winPlayer: AudioPlayer | null = null;
let losePlayer: AudioPlayer | null = null;
let modeConfigured = false;

function getSources() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return {
      win: require('@/assets/sounds/apple_win.mp3') as unknown as number,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      lose: require('@/assets/sounds/apple_lose.mp3') as unknown as number,
    };
  } catch {
    // Environnement où les assets natifs ne peuvent pas être résolus
    // (tests Node, web non-Metro) : pas de son, aucun plantage.
    return { win: 0, lose: 0 };
  }
}

function ensurePlayers() {
  if (IS_WEB) return { win: null, lose: null };
  const src = getSources();
  if (!winPlayer) {
    try {
      winPlayer = createAudioPlayer(src.win);
    } catch {
      winPlayer = null;
    }
  }
  if (!losePlayer) {
    try {
      losePlayer = createAudioPlayer(src.lose);
    } catch {
      losePlayer = null;
    }
  }
  if (!modeConfigured) {
    void setAudioModeAsync({ playsInSilentMode: true });
    modeConfigured = true;
  }
  return { win: winPlayer, lose: losePlayer };
}

function replay(player: AudioPlayer | null) {
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // La lecture peut échouer (contexte audio non prêt) : on ignore silencieusement
  }
}

export function playWinSfx(enabled: boolean) {
  if (!enabled) return;
  const { win } = ensurePlayers();
  replay(win);
}

export function playLoseSfx(enabled: boolean) {
  if (!enabled) return;
  const { lose } = ensurePlayers();
  replay(lose);
}
