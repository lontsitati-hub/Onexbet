/**
 * Synchronisation Firebase des droits Fast Games.
 *
 * Complète le stockage local (fastGamesAccess.ts) avec une source centralisée
 * Firestore : collection `fastGamesGrants` dont chaque document a pour ID le
 * nom d'utilisateur en minuscules et contient `{ granted: true }`.
 *
 * - L'admin a toujours accès (rôle 'admin'), indépendamment de cette collection.
 * - Un joueur n'a accès que si son document `granted: true` existe.
 * - Les changements sont écoutés en temps réel (listener) pour une mise à jour
 *   immédiate sur tous les appareils sans reconnexion.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, getDoc, collection } from 'firebase/firestore';

const COLLECTION = 'fastGamesGrants';
let dbRef: ReturnType<typeof getFirestore> | null = null;
let unsubscribe: (() => void) | null = null;
let grants: Record<string, boolean> = {};
let listeners: Array<(g: Record<string, boolean>) => void> = [];
let initialized = false;

function getDb() {
  if (!dbRef) {
    dbRef = getFirestore();
  }
  return dbRef;
}

function emit() {
  for (const cb of listeners) {
    try {
      cb({ ...grants });
    } catch (e) {
      console.warn('FastGamesFirebase: callback error', e);
    }
  }
}

async function persistLocal() {
  try {
    await AsyncStorage.setItem('onexbet:fast-games-grants:v2', JSON.stringify(grants));
  } catch (e) {
    console.warn('FastGamesFirebase: localStorage write failed', e);
  }
}

async function loadLocal(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem('onexbet:fast-games-grants:v2');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('FastGamesFirebase: localStorage read failed', e);
  }
  return {};
}

/**
 * Démarre l'écoute temps réel de la collection. Appel répétable (idempotent).
 */
export function subscribeFastGamesGrants(): () => void {
  if (unsubscribe) return () => {};
  try {
    const db = getDb();
    unsubscribe = onSnapshot(
      collection(db, COLLECTION),
      (snap) => {
        const next: Record<string, boolean> = {};
        snap.forEach((d) => {
          if (d.exists() && d.data()?.granted) {
            next[String(d.id).toLowerCase()] = true;
          }
        });
        grants = next;
        void persistLocal();
        emit();
      },
      (err) => {
        console.warn('FastGamesFirebase: snapshot error', err);
      }
    );
  } catch (e) {
    console.warn('FastGamesFirebase: subscribe failed', e);
  }
  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

/**
 * Initialisation : charge d'abord le cache local (réponse immédiate),
 * puis démarre le listener temps réel Firestore.
 */
export async function initFastGamesFirebase(): Promise<void> {
  if (initialized) return;
  initialized = true;
  grants = await loadLocal();
  emit();
  subscribeFastGamesGrants();
}

/** Réinitialise (déconnexion). */
export function resetFastGamesFirebase() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  grants = {};
  initialized = false;
  emit();
}

/**
 * Lecture synchrone des derniers droits connus.
 * Utilisable dans les gardes de route et le rendu des menus.
 */
export function getFastGamesGrants(): Record<string, boolean> {
  return { ...grants };
}

/**
 * Un utilisateur a-t-il le droit Fast Games (admin = toujours true).
 */
export function canPlayFastGamesFirebase(identity: { username: string | null; role: string | null }): boolean {
  if (identity.role === 'admin') return true;
  if (!identity.username) return false;
  return !!grants[identity.username.toLowerCase()];
}

/** Enregistrement du callback de mise à jour (hooks UI). */
export function onFastGamesGrantsChange(cb: (g: Record<string, boolean>) => void): () => void {
  listeners.push(cb);
  cb({ ...grants });
  return () => {
    listeners = listeners.filter((x) => x !== cb);
  };
}

/**
 * Active/désactive l'accès Fast Games d'un utilisateur.
 * Admin uniquement (garde côté UI). Écrit dans Firestore + réplique locale.
 */
export async function setFastGamesGrantFirebase(username: string, granted: boolean): Promise<boolean> {
  try {
    const db = getDb();
    const key = username.toLowerCase();
    if (granted) {
      await setDoc(doc(db, COLLECTION, key), { granted: true });
    } else {
      await deleteDoc(doc(db, COLLECTION, key));
    }
    // Met à jour le cache local immédiatement (cohérence UI avant réplication)
    const next = { ...grants };
    if (granted) next[key] = true;
    else delete next[key];
    grants = next;
    void persistLocal();
    emit();
    return true;
  } catch (e) {
    console.warn('FastGamesFirebase: setGrant failed', e);
    // Fallback local uniquement
    const next = { ...grants };
    const key = username.toLowerCase();
    if (granted) next[key] = true;
    else delete next[key];
    grants = next;
    void persistLocal();
    emit();
    return false;
  }
}

/** Vérifie côté Firestore si un utilisateur a le droit (lecture ponctuelle). */
export async function hasFastGamesGrantFirebase(username: string): Promise<boolean> {
  try {
    const db = getDb();
    const snap = await getDoc(doc(db, COLLECTION, username.toLowerCase()));
    return snap.exists() && !!snap.data()?.granted;
  } catch {
    return false;
  }
}
