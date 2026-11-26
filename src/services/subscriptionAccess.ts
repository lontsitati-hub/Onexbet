import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { getSubscriptionInfo, type SubscriptionInfo, type SubscriptionFields } from '@/utils/subscription';
import { getSubscriptionNow, synchronizeSubscriptionClock } from './subscriptionClock';
export { getSubscriptionNow } from './subscriptionClock';

export function subscribeToMySubscription(
  callback: (info: SubscriptionInfo | null, error?: string) => void,
): () => void {
  let stopProfile = () => {};
  let timer: ReturnType<typeof setInterval> | undefined;
  let alive = true;
  let generation = 0;
  const stopAuth = onAuthStateChanged(auth, (user) => {
    const version = ++generation;
    stopProfile();
    if (timer) clearInterval(timer);
    if (!user) { callback(null, 'Connectez-vous pour consulter votre abonnement.'); return; }
    let profile: SubscriptionFields | null = null;
    let clockVerified = false;
    const emit = () => {
      if (alive && version === generation && profile && clockVerified) {
        callback(getSubscriptionInfo(profile, getSubscriptionNow()));
      }
    };
    stopProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (!alive || version !== generation) return;
      profile = snapshot.exists() ? snapshot.data() : null;
      if (!profile) callback(null, 'Profil utilisateur indisponible.');
      else emit();
    }, () => {
      profile = null;
      if (alive && version === generation) callback(null, 'Impossible de lire votre abonnement.');
    });
    void synchronizeSubscriptionClock(db, user.uid).then(() => {
      if (!alive || version !== generation) return;
      clockVerified = true;
      emit();
      timer = setInterval(emit, 1000);
    }).catch(() => {
      if (alive && version === generation) callback(null, 'Connexion nécessaire pour vérifier votre abonnement.');
    });
  });
  return () => { alive = false; generation++; stopAuth(); stopProfile(); if (timer) clearInterval(timer); };
}
