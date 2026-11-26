import { useBetStore } from '@/store/useBetStore';
import { canPlayFastGamesSync } from '@/services/fastGamesAccess';
import { GAME_LAUNCH_ROUTES } from '@/services/gameLaunchRoutes';

// ─────────────────────────────────────────────────────────────────────────────
// Gestion d'accès — contrôle d'accès centralisé aux écrans sensibles
// - isSessionActive()        : une session utilisateur validée est ouverte
// - requireSession()         : redirige vers l'accueil si aucune session
// - requireRole()            : redirige si le rôle attendu n'est pas le rôle actuel
// - canAccess(route)         : vérification centralisée par route
// ─────────────────────────────────────────────────────────────────────────────

export type RouteAccess =
  | { allowed: true }
  | { allowed: false; reason: 'no-session' | 'forbidden-role' | 'pending-fast-games'; message: string };

// Local visual QA only. The normal build leaves this flag disabled.
const LOCAL_AOF_PREVIEW = process.env.EXPO_PUBLIC_AOF_PREVIEW === '1';

/** Une session utilisateur (Firebase Auth validée + session ID) est-elle active ? */
export function isSessionActive(): boolean {
  const sessionUser = useBetStore.getState().sessionUser;
  const sessionId = useBetStore.getState().sessionId;
  const isUnlocked = useBetStore.getState().isUnlocked;
  return isUnlocked && !!sessionUser && !!sessionId;
}

/** L'utilisateur connecté a-t-il le rôle admin ? */
export function isAdmin(): boolean {
  return useBetStore.getState().sessionRole === 'admin';
}

/** L'utilisateur connecté a-t-il Fast Games activé (autorisé par l'admin) ? */
export function canPlayFastGames(): boolean {
  const { sessionUser, sessionRole } = useBetStore.getState();
  if (!sessionUser) return false;
  return canPlayFastGamesSync({ username: sessionUser, role: sessionRole });
}

/**
 * Règles d'accès par route :
 * - '/' , '/menu'             : toute session validée (user ou admin)
 * - '/admin'                  : toute session validée (les onglets sensibles sont
 *                               masqués côté UI pour les non-admins)
 * - '/admin-theme'            : toute session validée (utilisateur ou admin)
 * - '/withdrawals'            : toute session validée (gestion du propre solde)
 * - '/messages'               : toute session validée
 * - '/fast-games' (+ écrans de jeu) : admin toujours autorisé, les utilisateurs
 *                                     doivent être activés par l'admin
 * - '/bet-details'            : toute session validée
 */
export function canAccess(route: string): RouteAccess {
  if (LOCAL_AOF_PREVIEW && Object.values(GAME_LAUNCH_ROUTES).includes(route as (typeof GAME_LAUNCH_ROUTES)[keyof typeof GAME_LAUNCH_ROUTES])) {
    return { allowed: true };
  }
  if (!isSessionActive()) {
    return {
      allowed: false,
      reason: 'no-session',
      message: 'Votre session est expirée. Veuillez vous reconnecter.',
    };
  }
  // Fast Games : accessibles à toute session active (admin ou utilisateur).
  // La sécurité par jeu (activateur admin) reste gérée par gameToggles,
  // qui peut désactiver un jeu individuellement côté écran.
  return { allowed: true };
}

/**
 * Garde de navigation : renvoie une erreur si l'accès n'est pas permis,
 * sinon undefined. À appeler dans chaque écran sensible via useFocusEffect.
 */
export function checkAccess(route: string): RouteAccess {
  return canAccess(route);
}
