/**
 * Sécurité dédiée de Fast Games.
 *
 * Politique :
 * - Fast Games est BLOQUÉ par défaut pour tout le monde.
 * - Seul l'administrateur peut activer Fast Games, utilisateur par utilisateur,
 *   depuis l'écran Users du panneau d'administration.
 * - L'admin a toujours accès à Fast Games (pas besoin d'activation).
 *
 * Le droit d'accès est stocké localement (AsyncStorage) sous la clé
 * `onexbet:fast-games-grants:v1` : objet { [username]: true }.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'onexbet:fast-games-grants:v1';

let cache: Record<string, boolean> | null = null;
let hydrationStarted = false;

/**
 * Précharge le snapshot des droits Fast Games dès le démarrage de l'app
 * (appelé une fois au login). Cela évite qu'un utilisateur normal voie
 * l'écran Fast Games bloqué avant que le cache soit rempli.
 */
export function hydrateFastGamesGrants() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  void loadGrants();
}

/** Réinitialise la politique d'hydratation (après une déconnexion). */
export function resetFastGamesGrants() {
  cache = null;
  hydrationStarted = false;
}

async function loadGrants(): Promise<Record<string, boolean>> {
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
 * Version synchrone du contrôle Fast Games (utilisée par les gardes de route
 * qui doivent répondre immédiatement, ex. checkAccess dans useFocusEffect).
 * Elle utilise le dernier snapshot connu du stockage : le cache est rempli
 * au premier appel puis remis à jour après chaque modification.
 */
export function canPlayFastGamesSync(identity: { username: string | null; role: string | null }): boolean {
  if (identity.role === 'admin') return true;
  if (!identity.username) return false;
  if (cache === null) {
    // Le snapshot n'est pas encore chargé : lancer la lecture en arrière-plan
    // (la garde répondra 'false' pour ce premier affichage uniquement).
    void loadGrants();
    return false;
  }
  return !!cache[identity.username.toLowerCase()];
}

function markDirty() {
  // Au prochain chargement asynchrone, recharger depuis le stockage.
  // On garde le snapshot courant en mémoire pour les gardes synchrones :
  // il a été écrit par le setFastGamesGrant le plus récent (cohérent).
}

/** L'utilisateur (admin ou username) a-t-il accès à Fast Games ? */
export async function canPlayFastGames(identity: { username: string | null; role: string | null }): Promise<boolean> {
  if (identity.role === 'admin') return true;
  if (!identity.username) return false;
  const grants = await loadGrants();
  return !!grants[identity.username.toLowerCase()];
}

/** Active (ou désactive) l'accès Fast Games d'un utilisateur. Admin uniquement. */
export async function setFastGamesGrant(username: string, granted: boolean): Promise<boolean> {
  const grants = await loadGrants();
  const key = username.toLowerCase();
  if (granted) {
    grants[key] = true;
  } else {
    delete grants[key];
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(grants));
  } catch (e) {
    console.warn('FastGamesAccess: écriture du stockage échouée', e);
    return false;
  }
  markDirty();
  return true;
}

/** Liste les utilisateurs ayant l'accès Fast Games. */
export async function listFastGamesGrants(): Promise<string[]> {
  const grants = await loadGrants();
  return Object.keys(grants);
}
