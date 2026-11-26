// Effets sonores Apple of Fortune v3 — assets locaux, expo-audio.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const WIN_SRC = require('@/assets/sounds/apple_win.mp3');
const LOSE_SRC = require('@/assets/sounds/apple_lose.mp3');

let winPlayer: AudioPlayer | null = null;
let losePlayer: AudioPlayer | null = null;
let modeConfigured = false;

function resolveLocalSource(res: number | string): string | number {
  // Sur mobile, require() d'un asset retourne un { uri, width, height }.
  if (typeof res === 'number') return res;
  if (typeof res === 'string') return res;
  const anyRes = res as { uri?: string | number };
  return anyRes.uri ?? res;
}

function ensurePlayers() {
  if (!winPlayer) {
    try {
      winPlayer = createAudioPlayer(resolveLocalSource(WIN_SRC));
    } catch {
      winPlayer = null;
    }
  }
  if (!losePlayer) {
    try {
      losePlayer = createAudioPlayer(resolveLocalSource(LOSE_SRC));
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
    // Lecture échouée (contexte audio non prêt) : ignoré silencieusement.
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
