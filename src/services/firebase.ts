import { deleteApp, initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import { getSubscriptionInfo, validateSubscriptionDays, SUBSCRIPTION_EXPIRED_MESSAGE } from '@/utils/subscription';
import { getSubscriptionNow, synchronizeSubscriptionClock } from './subscriptionClock';
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  initializeFirestore,
  onSnapshot,
  runTransaction,
  setDoc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

// CONFIGURATION FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyB-vwnZqVoSwXrk1Kd10RLfx1e35pl4KAU",
  authDomain: "onexbet-7eebd.firebaseapp.com",
  projectId: "onexbet-7eebd",
  storageBucket: "onexbet-7eebd.firebasestorage.app",
  messagingSenderId: "288285378583",
  appId: "1:288285378583:android:39736e227de007066a7452"
};

// Initialisation
const app = initializeApp(firebaseConfig);
function initializeFirebaseAuth() {
  if (Platform.OS === 'web') return getAuth(app);
  try {
    // Persiste l’authentification mobile dans AsyncStorage pour la restaurer
    // après la fermeture complète ou le redémarrage de l’application.
    // Firebase expose cette fonction via son entrée React Native à l’exécution,
    // même si le type public du paquet agrégateur ne la déclare pas.
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => import('firebase/auth').Persistence;
    };
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (error: any) {
    // Fast Refresh peut réévaluer ce module alors que l’instance Auth existe déjà.
    if (error?.code === 'auth/already-initialized') return getAuth(app);
    throw error;
  }
}
export const auth = initializeFirebaseAuth();
/** Retourne le jeton ID Firebase courant pour les appels serveur authentifiés. */
export async function getFirebaseIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}
// Sur React Native, certains réseaux mobiles/proxys laissent le WebChannel Firestore
// bloqué et le SDK se déclare hors ligne. Le long polling évite ce transport
// incompatible sans modifier les données, les règles ou les comptes Firebase.
export const db = Platform.OS === 'web'
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : initializeFirestore(app, { experimentalForceLongPolling: true });

/**
 * Génère un email virtuel à partir d'un username.
 * Exemple: 'admin' devient 'admin@onexbet.com'
 */
const getVirtualEmail = (username: string) => {
  return `${username.trim().toLowerCase()}@onexbet.com`;
};

// Les comptes, rôles et statuts proviennent exclusivement de Firebase.
const normalizeEmail = (value: string | null | undefined) => (value || '').trim().toLowerCase();
const isConfiguredAdminEmail = (_value: string | null | undefined) => false;

// Compatibilité en lecture seule avec les anciens formats de statut.
// Aucun statut existant n’est réécrit dans Firestore.
const normalizeAccountStatus = (profile: any): 'active' | 'suspended' => {
  const raw = profile?.status;
  if (raw === true) return 'active';
  const normalized = String(raw ?? '').trim().toLowerCase();
  if (['suspended', 'suspendu', 'blocked', 'bloqué', 'disabled', 'inactive', 'inactif', 'expired'].includes(normalized)) {
    return 'suspended';
  }
  if (['active', 'actif', 'activated', 'activé', 'approved', 'approuvé', 'validated', 'validé', 'accepted', 'accepté', 'true', '1'].includes(normalized)) {
    return 'active';
  }
  // Les anciens profils sans statut explicite restent utilisables.
  return 'active';
};

const getLoginEmail = (identifier: string) => {
  const normalized = identifier.trim().toLowerCase();
  return normalized.includes('@') ? normalized : getVirtualEmail(normalized);
};

const wait = (durationMs: number) => new Promise<void>((resolve) => setTimeout(resolve, durationMs));

const isTransientFirestoreNetworkError = (error: any) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return [
    'unavailable',
    'firestore/unavailable',
    'deadline-exceeded',
    'firestore/deadline-exceeded',
    'firestore/network-unavailable',
    'network-request-failed',
    'auth/network-request-failed',
  ].includes(code) ||
    message.includes('client is offline') ||
    message.includes('could not reach cloud firestore backend') ||
    message.includes('network request failed') ||
    message.includes('network is unavailable') ||
    message.includes('offline');
};

const createFirebaseNetworkError = (cause: any) => Object.assign(
  new Error('Connexion au serveur Firebase impossible. Vérifiez votre connexion Internet puis réessayez.'),
  { code: 'firestore/network-unavailable', cause }
);

/**
 * Lit toujours le profil depuis le serveur et retente les erreurs réseau brèves.
 * Aucun profil ni compte n’est créé ou modifié par cette fonction.
 */
async function getUserProfileFromServer(uid: string) {
  const profileRef = doc(db, 'users', uid);
  let lastError: any;
  // Firestore démarre en ligne par défaut. Les nouvelles tentatives
  // répètent la lecture sans réactiver l’instance sous des écouteurs actifs.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getDocFromServer(profileRef);
    } catch (error: any) {
      lastError = error;
      if (!isTransientFirestoreNetworkError(error)) throw error;
      if (attempt < 2) await wait(600 * (attempt + 1));
    }
  }
  throw createFirebaseNetworkError(lastError);
}

/**
 * Authentifier un utilisateur
 * Vérifie si le compte existe, récupère son rôle et vérifie s'il est actif.
 */
export async function loginFirebase(username: string, password: string) {
  const email = getLoginEmail(username);
  const isConfiguredAdmin = isConfiguredAdminEmail(email);
  isLoggingIn = true;

  try {
    // Firebase Auth reste la source de vérité pour tous les comptes existants.
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Le profil est lu depuis Firestore avec un transport fiable sur Android.
    const userDoc = await getUserProfileFromServer(uid);

    // Les profils existants sont strictement conservés : aucune réécriture
    // automatique du username, du rôle ou du statut dans Firestore.
    if (!userDoc.exists()) {
      throw new Error("Profil utilisateur introuvable. Contactez l’administrateur.");
    }

    const data = userDoc.data();
    const isAdminProfile = String(data.role || '').trim().toLowerCase() === 'admin';
    const accountStatus = normalizeAccountStatus(data);
    if (accountStatus === 'suspended' && !isConfiguredAdmin && !isAdminProfile) {
      await signOut(auth);
      throw new Error(data.role === 'admin'
        ? "Votre compte a été suspendu par l'administrateur."
        : "Votre compte est en attente d'activation par l'administrateur.");
    }

    if (!isAdminProfile) {
      const now = await synchronizeSubscriptionClock(db, uid);
      const subscription = getSubscriptionInfo(data, now);
      if (subscription.state === 'expired') throw new Error(SUBSCRIPTION_EXPIRED_MESSAGE);
      if (subscription.state === 'suspended') throw new Error('Abonnement invalide ou suspendu. Contactez l’administrateur.');
      if (subscription.state === 'not_configured') throw new Error('Accès non activé. Contactez l’administrateur pour définir votre durée.');
    }

    // Le verrouillage reste réservé aux utilisateurs ; l’admin reste multi-appareils.
    await claimSingleUserDevice(uid, data.role || 'user');
    return {
      uid,
      username: data.displayName || data.username || userCredential.user.email || username.trim(),
      role: data.role || 'user',
      status: accountStatus
    };
  } catch (error: any) {
    if (auth.currentUser) await signOut(auth).catch(() => undefined);
    if (isTransientFirestoreNetworkError(error)) throw createFirebaseNetworkError(error);
    throw error;
  } finally {
    isLoggingIn = false;
  }
}

/**
 * Inscription d'un nouvel utilisateur
 * Crée le compte d'authentification et stocke ses détails (rôle, statut) dans Firestore
 */
/** Vérification serveur du rôle ; l'interface seule n'est pas une autorisation. */
export async function requireFirebaseAdministrator(): Promise<string> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Connexion administrateur requise.');
  const snapshot = await getUserProfileFromServer(actor.uid);
  if (!snapshot.exists() || String(snapshot.data().role).toLowerCase() !== 'admin') {
    throw new Error('Seul l’administrateur peut gérer les comptes et les abonnements.');
  }
  return actor.uid;
}

export async function registerFirebase(
  username: string,
  password: string,
  role: 'user' | 'admin',
  status: 'active' | 'suspended' = 'suspended',
  subscriptionDays?: number,
) {
  const actorUid = await requireFirebaseAdministrator();
  const days = role === 'user' ? validateSubscriptionDays(subscriptionDays) : null;
  const email = getVirtualEmail(username);
  // Une Auth secondaire crée le compte sans déconnecter l'administrateur.
  const creationApp = initializeApp(auth.app.options, `user-creation-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const creationAuth = getAuth(creationApp);
  try {
    const credential = await createUserWithEmailAndPassword(creationAuth, email, password);
    const uid = credential.user.uid;
    try {
      await setDoc(doc(db, 'users', uid), {
        uid, username: username.trim(), role, status,
        createdAt: serverTimestamp(), createdBy: actorUid,
        ...(days === null ? {} : {
          subscriptionStartedAt: serverTimestamp(),
          subscriptionDurationDays: days,
          subscriptionUpdatedBy: actorUid,
        }),
      });
    } catch (error) {
      // Compensation au mieux : ne jamais masquer un échec de nettoyage Auth.
      try {
        await credential.user.delete();
      } catch (cleanupError) {
        throw Object.assign(new Error('Création incomplète : le profil n’a pas été enregistré et le compte Auth n’a pas pu être nettoyé. Contactez l’administrateur avant de réessayer ce nom.'), {
          code: 'auth/provisioning-incomplete', uid, cause: error, cleanupError,
        });
      }
      throw error;
    }
    return { uid, username: username.trim(), role, status };
  } finally {
    await signOut(creationAuth).catch(() => undefined);
    await deleteApp(creationApp).catch(() => undefined);
  }
}

export async function renewFirebaseUserSubscription(uid: string, subscriptionDays: number) {
  const actorUid = await requireFirebaseAdministrator();
  const days = validateSubscriptionDays(subscriptionDays);
  const targetUid = String(uid || '').trim();
  if (!targetUid) throw new Error('Compte utilisateur invalide.');
  const ref = doc(db, 'users', targetUid);
  const snapshot = await getUserProfileFromServer(targetUid);
  if (!snapshot.exists()) throw new Error('Compte utilisateur introuvable.');
  if (String(snapshot.data().role).toLowerCase() === 'admin') {
    throw new Error('Les administrateurs ne sont pas soumis à un abonnement.');
  }
  await updateDoc(ref, {
    status: 'active',
    subscriptionStartedAt: serverTimestamp(),
    subscriptionDurationDays: days,
    subscriptionUpdatedBy: actorUid,
  });
}

const DEVICE_ID_KEY = 'onexbet:installation-id:v1';
const ACTIVE_SESSION_KEY = 'onexbet:active-session-id:v2';
const VERIFIED_SESSION_CACHE_KEY = 'onexbet:verified-firebase-session:v1';
const OFFLINE_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEVICE_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const DEVICE_LOCK_COLLECTION = 'security';
const DEVICE_LOCK_DOCUMENT = 'deviceBinding';

type CachedVerifiedSession = {
  uid: string;
  username: string;
  role: string;
  verifiedAt: number;
  expiresAtMs: number | null;
};

async function readCachedVerifiedSession(uid: string): Promise<CachedVerifiedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(VERIFIED_SESSION_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedVerifiedSession>;
    if (cached.uid !== uid || !cached.username || !cached.role || typeof cached.verifiedAt !== 'number' || !Number.isFinite(cached.verifiedAt)) return null;
    if (cached.verifiedAt < Date.now() - OFFLINE_SESSION_MAX_AGE_MS) return null;
    if (cached.expiresAtMs !== null && cached.expiresAtMs !== undefined && (!Number.isFinite(cached.expiresAtMs) || cached.expiresAtMs <= getSubscriptionNow())) return null;
    return {
      uid,
      username: cached.username,
      role: cached.role,
      verifiedAt: cached.verifiedAt,
      expiresAtMs: cached.expiresAtMs ?? null,
    };
  } catch {
    return null;
  }
}

async function cacheVerifiedSession(session: CachedVerifiedSession): Promise<void> {
  try {
    await AsyncStorage.setItem(VERIFIED_SESSION_CACHE_KEY, JSON.stringify(session));
  } catch (error) {
    // Le cache accélère la reprise hors connexion mais ne doit jamais bloquer l'accès en ligne.
    console.warn('Cache de session hors connexion indisponible:', error);
  }
}

async function clearCachedVerifiedSession(): Promise<void> {
  await AsyncStorage.removeItem(VERIFIED_SESSION_CACHE_KEY).catch(() => undefined);
}

async function getInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

async function getActiveSessionId(): Promise<string> {
  const existing = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
  if (existing) return existing;
  const generated = `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, generated);
  return generated;
}

/**
 * Réserve une seule session active pour un utilisateur.
 * Une déconnexion libère la session ; un autre appareil peut alors se connecter.
 * Le rôle admin est explicitement exempté et peut utiliser plusieurs appareils.
 */
export async function claimSingleUserDevice(uid: string, role?: string): Promise<void> {
  if (String(role || '').trim().toLowerCase() === 'admin') return;

  const deviceId = await getInstallationId();
  const sessionId = await getActiveSessionId();
  const now = Date.now();
  const bindingRef = doc(db, 'users', uid, DEVICE_LOCK_COLLECTION, DEVICE_LOCK_DOCUMENT);
  await runTransaction(db, async (transaction) => {
    const binding = await transaction.get(bindingRef);
    if (!binding.exists()) {
      transaction.set(bindingRef, { uid, deviceId, sessionId, boundAt: now, lastSeenAt: now, active: true });
      return;
    }

    const data = binding.data();
    const boundDeviceId = String(data.deviceId || '');
    const activeSessionId = String(data.sessionId || '');
    const lastSeenAt = Number(data.lastSeenAt || 0);
    const active = data.active !== false;
    const anotherRecentDevice = active && boundDeviceId && boundDeviceId !== deviceId &&
      activeSessionId && lastSeenAt >= now - DEVICE_ACTIVE_WINDOW_MS;

    if (anotherRecentDevice) {
      throw Object.assign(
        new Error('Ce compte est déjà utilisé sur un autre appareil. Déconnectez-le avant de continuer.'),
        { code: 'auth/session-already-active' }
      );
    }

    transaction.set(bindingRef, {
      uid,
      deviceId,
      sessionId,
      boundAt: data.boundAt || now,
      lastSeenAt: now,
      active: true,
    }, { merge: true });
  });
}

/** Libère la session courante afin qu’un autre appareil puisse se connecter. */
export async function releaseSingleUserSession(uid: string, role?: string): Promise<void> {
  if (String(role || '').trim().toLowerCase() === 'admin') return;
  const deviceId = await getInstallationId();
  const sessionId = await getActiveSessionId();
  const bindingRef = doc(db, 'users', uid, DEVICE_LOCK_COLLECTION, DEVICE_LOCK_DOCUMENT);
  await runTransaction(db, async (transaction) => {
    const binding = await transaction.get(bindingRef);
    if (!binding.exists()) return;
    const data = binding.data();
    if (String(data.deviceId || '') === deviceId && String(data.sessionId || '') === sessionId) {
      transaction.set(bindingRef, { active: false, signedOutAt: Date.now(), lastSeenAt: Date.now() }, { merge: true });
    }
  });
}

/** Enregistre une installation sans modifier le document du profil utilisateur. */
export async function registerActiveDevice(uid: string, role?: string): Promise<() => void> {
  // Les administrateurs restent libres de se connecter sur plusieurs appareils.
  if (String(role || '').trim().toLowerCase() === 'admin') return () => {};
  const deviceId = await getInstallationId();
  const sessionId = await getActiveSessionId();
  const deviceRef = doc(db, 'users', uid, 'devices', deviceId);
  const writeHeartbeat = async () => {
    try {
      await setDoc(deviceRef, {
        deviceId,
        sessionId,
        uid,
        platform: Platform.OS,
        model: Device.modelName || Device.modelId || 'Android device',
        lastSeenAt: Date.now(),
        active: true,
      }, { merge: true });
      const bindingRef = doc(db, 'users', uid, DEVICE_LOCK_COLLECTION, DEVICE_LOCK_DOCUMENT);
      await runTransaction(db, async (transaction) => {
        const binding = await transaction.get(bindingRef);
        if (!binding.exists()) return;
        const data = binding.data();
        if (String(data.deviceId || '') === deviceId && String(data.sessionId || '') === sessionId && data.active !== false) {
          transaction.update(bindingRef, { lastSeenAt: Date.now(), active: true });
        }
      });
    } catch (error) {
      // Les règles Firestore peuvent désactiver ce suivi sans bloquer la connexion.
      console.warn('Suivi appareil indisponible:', error);
    }
  };
  await writeHeartbeat();
  const timer = setInterval(() => { void writeHeartbeat(); }, 60 * 1000);
  return () => clearInterval(timer);
}

/** Compte les installations ayant envoyé un heartbeat dans les deux dernières minutes. */
export async function countActiveDevices(uid: string): Promise<number> {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'devices'));
    const cutoff = Date.now() - DEVICE_ACTIVE_WINDOW_MS;
    return snapshot.docs.filter((item) => {
      const data = item.data() as { active?: boolean; lastSeenAt?: number };
      return data.active !== false && typeof data.lastSeenAt === 'number' && data.lastSeenAt >= cutoff;
    }).length;
  } catch (error) {
    console.warn('Comptage des appareils indisponible:', error);
    return 0;
  }
}

/**
 * Récupérer tous les utilisateurs (pour l'administration)
 */
export async function fetchAllFirebaseUsers() {
  await requireFirebaseAdministrator();
  const querySnapshot = await getDocs(collection(db, 'users'));
  const list: any[] = [];
  querySnapshot.forEach((doc) => {
    list.push({ id: doc.id, ...doc.data() });
  });
  return list;
}

/**
 * Écouter les changements des utilisateurs en temps réel
 */
export function subscribeToUsers(onUpdate: (users: any[]) => void) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const list: any[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    onUpdate(list);
  });
}

/**
 * Mettre à jour le statut d'un utilisateur (activer/suspendre)
 */
export async function updateFirebaseUserStatus(uid: string, status: 'active' | 'suspended') {
  await requireFirebaseAdministrator();
  const docRef = doc(db, 'users', uid);
  const profile = await getUserProfileFromServer(uid);
  if (!profile.exists()) throw new Error('Compte introuvable.');
  if (status === 'active' && getSubscriptionInfo(profile.data(), await synchronizeSubscriptionClock(db, auth.currentUser!.uid)).state === 'expired') {
    throw new Error('Cet abonnement a expiré. Définissez une nouvelle durée pour réactiver ce compte.');
  }
  await updateDoc(docRef, { status });
}

/** Met à jour uniquement le nom affiché d'un utilisateur dans Firestore. */
export async function updateFirebaseUserDisplayName(uid: string, displayName: string) {
  await requireFirebaseAdministrator();
  const targetUid = String(uid || '').trim();
  const cleanName = String(displayName || '').trim();
  if (!targetUid) throw new Error('Compte utilisateur invalide.');
  if (!cleanName || cleanName.length > 64) throw new Error('Le nom affiché doit contenir entre 1 et 64 caractères.');
  const profile = await getUserProfileFromServer(targetUid);
  if (!profile.exists()) throw new Error('Compte utilisateur introuvable.');
  if (String(profile.data().role || '').toLowerCase() === 'admin') {
    throw new Error('Un compte administrateur ne peut pas être modifié depuis cette interface.');
  }
  await updateDoc(doc(db, 'users', targetUid), { displayName: cleanName });
}

/**
 * Supprime uniquement le profil Firestore. Firebase Authentication et les
 * sous-collections ne peuvent pas être supprimés depuis les règles Firestore.
 */
export async function deleteFirebaseUserProfile(uid: string) {
  await requireFirebaseAdministrator();
  const targetUid = String(uid || '').trim();
  if (!targetUid) throw new Error('Compte utilisateur invalide.');
  const profile = await getUserProfileFromServer(targetUid);
  if (!profile.exists()) throw new Error('Compte utilisateur introuvable.');
  if (String(profile.data().role || '').toLowerCase() === 'admin') {
    throw new Error('Un compte administrateur ne peut pas être supprimé depuis cette interface.');
  }
  await deleteDoc(doc(db, 'users', targetUid));
}

/**
 * Se déconnecter de Firebase
 */
export async function logoutFirebase() {
  const currentUser = auth.currentUser;
  try {
    if (currentUser) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const releaseSession = (async () => {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          const role = userDoc.exists() ? String(userDoc.data().role || 'user') : 'user';
          await releaseSingleUserSession(currentUser.uid, role);
        })();
        await Promise.race([
          releaseSession,
          new Promise<void>((resolve) => { timeoutId = setTimeout(resolve, 1000); }),
        ]);
      } catch (error) {
        console.warn('La session distante n’a pas pu être libérée avant la déconnexion:', error);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }
  } finally {
    const { signOut } = require('firebase/auth');
    await signOut(auth);
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    await clearCachedVerifiedSession();
  }
}

let isSigningUp = false;
let isLoggingIn = false;

export function setSigningUpFlag(val: boolean) {
  isSigningUp = val;
}

/**
 * Écoute la session Firebase active et vérifie automatiquement son statut / rôle dans Firestore.
 */
export function listenToAuthSession(
  onProfile: (
    profile: { uid: string; username: string; role: string } | null,
    errorMsg?: string,
    sessionCheck?: { authenticated: boolean; retryable: boolean },
  ) => void
) {
  const { onAuthStateChanged } = require('firebase/auth');
  let alive = true;
  let generation = 0;
  let stopProfile = () => {};
  let poll: ReturnType<typeof setInterval> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let foreground: ReturnType<typeof AppState.addEventListener> | undefined;
  const clearSessionChecks = () => {
    stopProfile(); stopProfile = () => {};
    if (poll) clearInterval(poll);
    if (expiry) clearTimeout(expiry);
    poll = undefined; expiry = undefined;
    foreground?.remove(); foreground = undefined;
  };
  const stopAuth = onAuthStateChanged(auth, (user: any) => {
    const version = ++generation;
    clearSessionChecks();
    let running = false;
    let queued = false;
    let denied = false;
    let hasVerifiedSession = false;
    if (!user) { onProfile(null); return; }
    const current = () => alive && version === generation && auth.currentUser?.uid === user.uid;
    const deny = async (message: string) => {
      if (!current() || denied) return;
      denied = true;
      onProfile(null, message, { authenticated: false, retryable: false });
      await clearCachedVerifiedSession();
      await signOut(auth).catch(() => undefined);
    };
    const check = async () => {
      if (!current() || denied) return;
      if (running) { queued = true; return; }
      running = true;
      try {
        // La connexion initiale valide déjà le mot de passe et le profil.
        while (isLoggingIn && current()) await wait(100);
        if (!current()) return;
        const snapshot = await getUserProfileFromServer(user.uid);
        if (!current()) return;
        if (!snapshot.exists()) { await deny('Profil introuvable. Contactez l’administrateur.'); return; }
        const data = snapshot.data();
        const admin = String(data.role).toLowerCase() === 'admin';
        if (!admin && normalizeAccountStatus(data) === 'suspended') {
          await deny('Votre compte est suspendu. Contactez l’administrateur.'); return;
        }
        const serverNow = await synchronizeSubscriptionClock(db, user.uid);
        if (!current()) return;
        let expiresAtMs: number | null = null;
        if (!admin) {
          const info = getSubscriptionInfo(data, serverNow);
          if (info.state === 'expired') { await deny(SUBSCRIPTION_EXPIRED_MESSAGE); return; }
          if (info.state === 'suspended') { await deny('Abonnement invalide ou suspendu. Contactez l’administrateur.'); return; }
          if (info.state === 'not_configured') { await deny('Accès non activé. Contactez l’administrateur pour définir votre durée.'); return; }
          if (expiry) clearTimeout(expiry);
          if (info.expiresAtMs !== null) {
            expiresAtMs = info.expiresAtMs;
            // Réévaluation toutes les minutes et alarme exacte à l'échéance.
            const remaining = Math.max(0, info.expiresAtMs - getSubscriptionNow());
            expiry = setTimeout(() => {
              if (!current()) return;
              // Fermer l'accès pendant la relecture, sans refuser un renouvellement récent.
              if (info.expiresAtMs !== null && getSubscriptionNow() >= info.expiresAtMs) onProfile(null);
              void check();
            }, Math.min(remaining, 2147483647));
          }
        }
        await claimSingleUserDevice(user.uid, data.role || 'user');
        if (current()) {
          hasVerifiedSession = true;
          const username = data.displayName || data.username || user.email || 'user';
          const role = data.role || 'user';
          await cacheVerifiedSession({ uid: user.uid, username, role, verifiedAt: Date.now(), expiresAtMs });
          onProfile({ uid: user.uid, username, role });
        }
      } catch (error: any) {
        if (current()) {
          const retryable = isTransientFirestoreNetworkError(error);
          if (hasVerifiedSession && retryable) {
            // Une panne réseau ne révoque pas la session déjà validée. Les
            // vérifications périodiques reprendront dès le retour du réseau.
            console.warn('Vérification temporairement indisponible; session conservée hors ligne.');
          } else {
            // Une erreur réseau pendant la restauration ne doit pas être prise
            // pour une déconnexion : l’application attend une nouvelle vérification
            // sans ouvrir l’accès ni demander à nouveau le mot de passe.
            onProfile(
              null,
              error?.message || 'Connexion nécessaire pour vérifier votre accès.',
              { authenticated: true, retryable },
            );
          }
        }
      } finally {
        running = false;
        if (queued && current()) { queued = false; void check(); }
      }
    };
    // Ne pas ouvrir le listener Firestore pendant que loginFirebase valide
    // encore le profil avec getDocFromServer(). Sur Android, deux écoutes
    // simultanées du même document peuvent produire « Target ID already exists ».
    const startMonitoring = async () => {
      while (isLoggingIn && current()) await wait(100);
      if (!current()) return;
      // Restaurer uniquement un profil déjà vérifié et non expiré. La première
      // connexion exige toujours le réseau et Firebase Auth reste la source de
      // vérité de l'identité.
      const cached = await readCachedVerifiedSession(user.uid);
      if (cached && current()) {
        hasVerifiedSession = true;
        onProfile({ uid: cached.uid, username: cached.username, role: cached.role });
      }
      stopProfile = onSnapshot(doc(db, 'users', user.uid), () => { void check(); }, (error: any) => {
        if (!current()) return;
        const retryable = isTransientFirestoreNetworkError(error);
        if (hasVerifiedSession && retryable) {
          console.warn('Connexion perdue; session conservée jusqu’au retour du réseau.');
          return;
        }
        onProfile(
          null,
          'Impossible de vérifier votre accès. Reconnectez-vous au réseau.',
          { authenticated: true, retryable },
        );
      });
      poll = setInterval(() => { void check(); }, 60000);
      foreground = AppState.addEventListener('change', state => {
        if (state === 'active' && current()) void check();
      });
      void check();
    };
    void startMonitoring();
  });
  return () => { alive = false; generation++; stopAuth(); clearSessionChecks(); };
}

/** L'amorçage du premier administrateur doit être fait hors du client. */
export async function initializeAdminAccount(): Promise<never> {
  throw new Error('Le premier administrateur doit être provisionné de manière sécurisée dans Firebase Console ou via un environnement Admin SDK de confiance.');
}
// Aucun mot de passe administrateur réutilisable ne doit être embarqué dans l'application.
// Cette fonction conserve un message explicite pour d'éventuels anciens appelants.
// Après provisionnement, les administrateurs créent les comptes depuis l'interface.
