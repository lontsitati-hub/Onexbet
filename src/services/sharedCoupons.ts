import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import type { BetEvent, BetSlip, BetStatus } from '@/types/bet';
import { auth, db } from './firebase';
import { isValidCouponCode } from './couponCode';

const COLLECTION = 'coupon_shares';
const MAX_PAYLOAD_LENGTH = 850_000;
const configuredCouponApiUrl = (process.env.EXPO_PUBLIC_COUPON_API_URL || '').trim().replace(/\/+$/, '');
const MANUS_COUPON_API_BASE_URL = configuredCouponApiUrl || (
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : ''
);
const BET_STATUSES = new Set<BetStatus>([
  'Accepté',
  'Perdu',
  'Gagné',
  'En direct',
  'En attente',
  'Payé',
  'Remboursé',
]);

async function manusErrorMessage(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }
  return fallback;
}

async function isMissingApiRoute(response: Response): Promise<boolean> {
  if (response.status !== 404 || !response.headers.get('content-type')?.toLowerCase().includes('html')) {
    return false;
  }
  const body = await response.text().catch(() => '');
  return /<(?:!doctype\s+html|html\b)/i.test(body);
}

function normalizeCode(value: string): string {
  return String(value || '').trim().toUpperCase();
}

function serializeCoupon(slip: BetSlip, code: string): string {
  const events = Array.isArray(slip.events) ? slip.events : [];
  return JSON.stringify({
    version: 1,
    coupon: {
      id: String(slip.id || ''),
      type: String(slip.type || 'Simple'),
      date: String(slip.date || ''),
      eventCount: events.length,
      finishedCount: Number(slip.finishedCount || 0),
      totalOdds: Number(slip.totalOdds || 1),
      stake: Number(slip.stake || 0),
      potentialGain: Number(slip.potentialGain || 0),
      status: slip.status || 'Accepté',
      // Garder chaque événement intact, notamment les URL exactes des écussons.
      events,
      sellAmount: Number(slip.sellAmount || 0),
      code,
    },
  });
}

/** Publie ou actualise le coupon sous son code court, sans permettre d'écraser le code d'un autre compte. */
export async function publishCouponShare(slip: BetSlip): Promise<string> {
  const code = normalizeCode(slip.code || '');
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Connectez-vous pour enregistrer ce code de coupon.');
  const ownerUid = currentUser.uid;
  if (!isValidCouponCode(code)) throw new Error('Le code de partage de ce coupon est invalide.');
  if (!Array.isArray(slip.events) || slip.events.length === 0) {
    throw new Error('Le coupon ne contient aucun événement à partager.');
  }

  const payload = serializeCoupon(slip, code);
  if (payload.length > MAX_PAYLOAD_LENGTH) {
    throw new Error('Ce coupon est trop volumineux pour être partagé par code.');
  }

  const publishToFirestore = async (): Promise<string> => {
    const shareRef = doc(db, COLLECTION, code);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(shareRef);
      const existingData = existing.exists() ? existing.data() : null;
      if (existingData && existingData.ownerUid !== ownerUid) {
        throw new Error('Ce code est déjà utilisé. Dupliquez de nouveau le coupon pour obtenir un autre code.');
      }

      transaction.set(shareRef, {
        ownerUid,
        code,
        payload,
        createdAt: existingData?.createdAt || serverTimestamp(),
        ...(existingData ? { updatedAt: serverTimestamp() } : {}),
      });
    });
    return code;
  };

  if (MANUS_COUPON_API_BASE_URL) {
    const legacySnapshot = await getDoc(doc(db, COLLECTION, code));
    if (legacySnapshot.exists() && legacySnapshot.data().ownerUid !== ownerUid) {
      throw new Error('Ce code est déjà utilisé. Dupliquez de nouveau le coupon pour obtenir un autre code.');
    }
    const token = await currentUser.getIdToken();
    let response: Response;
    try {
      response = await fetch(`${MANUS_COUPON_API_BASE_URL}/api/coupon-shares/${encodeURIComponent(code)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
        cache: 'no-store',
      });
    } catch {
      // Le repli reste possible si la connexion réseau à l’API est indisponible.
      return publishToFirestore();
    }
    if (await isMissingApiRoute(response)) return publishToFirestore();
    if (!response.ok) throw new Error(await manusErrorMessage(response, 'Impossible d’enregistrer ce coupon sur le serveur.'));
    const result: unknown = await response.json().catch(() => null);
    if (typeof result !== 'object' || result === null || !('code' in result) || normalizeCode(String(result.code)) !== code) {
      throw new Error('Le serveur n’a pas confirmé le code du coupon enregistré.');
    }
    return code;
  }

  return publishToFirestore();
}

function parseSharedCoupon(code: string, rawPayload: string): BetSlip {
  let parsed: any;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error('Les données associées à ce code sont illisibles.');
  }

  const coupon = parsed?.version === 1 ? parsed.coupon : null;
  if (!coupon || typeof coupon.id !== 'string' || !coupon.id || !Array.isArray(coupon.events) || coupon.events.length === 0) {
    throw new Error('Les données associées à ce code sont incomplètes.');
  }
  if (normalizeCode(coupon.code) !== code) {
    throw new Error('Le code ne correspond pas au coupon enregistré.');
  }

  const events = coupon.events as BetEvent[];
  const invalidEvent = events.some((event) => (
    !event || typeof event !== 'object'
    || typeof event.id !== 'string'
    || typeof event.sport !== 'string'
    || (event.team1Logo !== undefined && typeof event.team1Logo !== 'string')
    || (event.team2Logo !== undefined && typeof event.team2Logo !== 'string')
  ));
  if (invalidEvent) throw new Error('Les événements de ce coupon sont invalides.');

  const status: BetStatus = BET_STATUSES.has(coupon.status) ? coupon.status : 'Accepté';
  const totalOdds = Number(coupon.totalOdds);
  const stake = Number(coupon.stake);
  const potentialGain = Number(coupon.potentialGain);
  return {
    id: coupon.id,
    type: String(coupon.type || 'Combiné'),
    date: String(coupon.date || ''),
    eventCount: events.length,
    finishedCount: Number(coupon.finishedCount || 0),
    totalOdds: Number.isFinite(totalOdds) ? totalOdds : 1,
    stake: Number.isFinite(stake) ? stake : 0,
    potentialGain: Number.isFinite(potentialGain) ? potentialGain : 0,
    status,
    events,
    sellAmount: Number.isFinite(Number(coupon.sellAmount)) ? Number(coupon.sellAmount) : 0,
    code,
    // Le téléchargement par code ouvre directement le ticket final ; le
    // mode brouillon reste réservé aux coupons créés ou dupliqués localement.
    isDraft: false,
    isLoadedByCode: true,
  };
}

/** Recharge un code depuis le stockage partagé, quel que soit l'appareil utilisé. */
export async function loadSharedCoupon(codeInput: string): Promise<BetSlip | null> {
  const code = normalizeCode(codeInput);
  if (!isValidCouponCode(code)) throw new Error('Saisissez un code coupon valide de 5 caractères.');
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Connectez-vous pour charger un coupon partagé.');

  if (MANUS_COUPON_API_BASE_URL) {
    const token = await currentUser.getIdToken();
    let response: Response;
    try {
      response = await fetch(`${MANUS_COUPON_API_BASE_URL}/api/coupon-shares/${encodeURIComponent(code)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
    } catch {
      return loadCouponFromFirestore(code);
    }
    if (response.status === 404) {
      if (await isMissingApiRoute(response)) return loadCouponFromFirestore(code);
      const missing: unknown = await response.json().catch(() => null);
      if (typeof missing === 'object' && missing !== null && 'code' in missing && missing.code === 'coupon_not_found') {
        return loadCouponFromFirestore(code);
      }
      throw new Error('Le service de coupons Manus est introuvable ou mal configuré.');
    } else {
      if (!response.ok) throw new Error(await manusErrorMessage(response, 'Impossible de charger ce coupon depuis le serveur.'));
      const body: unknown = await response.json().catch(() => null);
      if (typeof body !== 'object' || body === null || !('code' in body) || !('payload' in body)) {
        throw new Error('La réponse du serveur pour ce coupon est invalide.');
      }
      const responseCode = typeof body.code === 'string' ? normalizeCode(body.code) : '';
      if (responseCode !== code || typeof body.payload !== 'string' || body.payload.length > MAX_PAYLOAD_LENGTH) {
        throw new Error('Les données de partage de ce coupon sont invalides.');
      }
      return parseSharedCoupon(code, body.payload);
    }
  }

  return loadCouponFromFirestore(code);
}

async function loadCouponFromFirestore(code: string): Promise<BetSlip | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, code));
  if (!snapshot.exists()) return null;

  const shared = snapshot.data();
  if (shared.code !== code || typeof shared.payload !== 'string' || shared.payload.length > MAX_PAYLOAD_LENGTH) {
    throw new Error('Les données de partage de ce coupon sont invalides.');
  }
  return parseSharedCoupon(code, shared.payload);
}
