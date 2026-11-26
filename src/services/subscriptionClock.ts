import { doc, getDocFromServer, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { subscriptionTimestampMs } from '@/utils/subscription';

let anchor: { serverMs: number; wallMs: number; monotonicMs: number } | null = null;
const monotonicNow = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

export async function synchronizeSubscriptionClock(db: Firestore, uid: string): Promise<number> {
  // Les règles imposent at == request.time. Ce document ne donne aucun droit.
  const ref = doc(db, 'users', uid, 'accessClock', 'current');
  await setDoc(ref, { at: serverTimestamp() });
  const snapshot = await getDocFromServer(ref);
  const serverMs = subscriptionTimestampMs(snapshot.data()?.at);
  if (serverMs === null) throw new Error('Impossible de vérifier l’heure du serveur. Réessayez avec une connexion Internet.');
  anchor = { serverMs, wallMs: Date.now(), monotonicMs: monotonicNow() };
  return serverMs;
}

export function getSubscriptionNow(): number {
  if (!anchor) return Date.now(); // Affichage seulement ; jamais une validation d'accès.
  const elapsed = Math.max(0, monotonicNow() - anchor.monotonicMs, Date.now() - anchor.wallMs);
  return anchor.serverMs + elapsed;
}
