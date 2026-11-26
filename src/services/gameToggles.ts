/**
 * Sécurité individuelle par jeu — Fast Games.
 *
 * Politique :
 * - Chaque jeu (crash, aviator, apple-of-fortune, wild-west-gold) possède
 *   son propre interrupteur ON/OFF, réglable uniquement par l'admin
 *   depuis le panneau d'administration.
 * - Par défaut, TOUS les jeux sont ACTIVÉS (état par défaut = true) :
 *   les nouvelles installations ne sont pas bloquées par surprise.
 * - L'admin peut désactiver un jeu pour tout le monde (ex. maintenance,
 *   jeu réservé). Un joueur qui clique sur un jeu désactivé verra
 *   « Jeu temporairement indisponible ».
 *
 * Stockage : AsyncStorage sous la clé
 * `onexbet:game-toggles:v1` : objet { [gameId]: boolean }.
 * Une valeur absente est interprétée comme activée (état par défaut).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GameId = 'aviator' | 'apple-of-fortune' | 'crash-point' | 'wild-west-gold';

export const GAME_IDS: GameId[] = ['aviator', 'apple-of-fortune', 'crash-point', 'wild-west-gold'];

export const GAME_LABELS: Record<GameId, string> = {
  aviator: 'Aviator',
  'apple-of-fortune': 'Apple of Fortune',
  'crash-point': 'Crash Point',
  'wild-west-gold': 'Wild West Gold',
};

const STORAGE_KEY = 'onexbet:game-toggles:v1';

let cache: Record<string, boolean> | null = null;
let hydrationStarted = false;

/**
 * Précharge les interrupteurs dès le démarrage de l'app (appelé une fois au login).
 */
export function hydrateGameToggles() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  void loadToggles();
}

/** Réinitialise l'hydratation (après une déconnexion). */
export function resetGameToggles() {
  cache = null;
  hydrationStarted = false;
}

async function loadToggles(): Promise<Record<string, boolean>> {
  if (cache !== null) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  return cache as Record<string, boolean>;
}

/**
 * Version synchrone (gardes de route). Utilise le dernier snapshot connu.
 * Valeur absente = activé par défaut.
 */
export function isGameEnabledSync(gameId: GameId): boolean {
  if (cache === null) {
    void loadToggles();
    return true; // état par défaut : activé
  }
  const v = cache[gameId];
  return typeof v === 'boolean' ? v : true;
}

/** Un jeu est-il activé (avec lecture fraîche asynchrone) ? */
export async function isGameEnabled(gameId: GameId): Promise<boolean> {
  if (cache === null) {
    const toggles = await loadToggles();
    const v = toggles[gameId];
    return typeof v === 'boolean' ? v : true;
  }
  const v = cache[gameId];
  return typeof v === 'boolean' ? v : true;
}

/** Lit la table complète des interrupteurs (pour l'écran admin). */
export async function listGameToggles(): Promise<Record<string, boolean>> {
  return loadToggles();
}

/**
 * Active ou désactive un jeu. Admin uniquement.
 * La valeur `enabled` est toujours écrite explicitement : `false`
 * désactive le jeu, `true` le réactive.
 */
export async function setGameToggle(gameId: GameId, enabled: boolean): Promise<boolean> {
  const toggles = await loadToggles();
  toggles[gameId] = enabled;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toggles));
  } catch (e) {
    console.warn('GameToggles: écriture du stockage échouée', e);
    return false;
  }
  return true;
}
