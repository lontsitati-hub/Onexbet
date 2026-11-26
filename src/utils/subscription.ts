export const SUBSCRIPTION_DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_SUBSCRIPTION_DAYS = 36500;

export interface SubscriptionFields {
  role?: string;
  status?: string;
  subscriptionStartedAt?: unknown;
  subscriptionDurationDays?: number;
}

export type SubscriptionInfo = {
  state: 'active' | 'expired' | 'suspended' | 'not_configured' | 'admin';
  startsAtMs: number | null;
  expiresAtMs: number | null;
  remainingDays: number | null;
  durationDays: number | null;
};

export function validateSubscriptionDays(value: unknown): number {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error('Saisissez un nombre entier de jours supérieur à zéro.');
  const days = Number(text);
  if (!Number.isSafeInteger(days) || days < 1 || days > MAX_SUBSCRIPTION_DAYS) {
    throw new Error(`La durée doit être comprise entre 1 et ${MAX_SUBSCRIPTION_DAYS} jours.`);
  }
  return days;
}

export function subscriptionTimestampMs(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function getSubscriptionInfo(profile: SubscriptionFields, nowMs: number): SubscriptionInfo {
  const base = { startsAtMs: null, expiresAtMs: null, remainingDays: null, durationDays: null };
  if (String(profile.role).toLowerCase() === 'admin') return { ...base, state: 'admin' };
  const rawStatus = String(profile.status ?? '').trim().toLowerCase();
  const suspended = ['suspended', 'suspendu', 'blocked', 'bloqué', 'disabled', 'inactive', 'inactif'].includes(rawStatus);
  const startsAtMs = subscriptionTimestampMs(profile.subscriptionStartedAt);
  const days = profile.subscriptionDurationDays;
  if (startsAtMs === null || !Number.isInteger(days) || Number(days) < 1 || Number(days) > MAX_SUBSCRIPTION_DAYS) {
    // Ne pas inventer une date ni supprimer les droits des anciens comptes sans migration.
    const legacy = profile.subscriptionStartedAt === undefined && profile.subscriptionDurationDays === undefined;
    return { ...base, state: suspended || !legacy ? 'suspended' : 'not_configured' };
  }
  const expiresAtMs = startsAtMs + Number(days) * SUBSCRIPTION_DAY_MS;
  const expired = nowMs >= expiresAtMs;
  return {
    state: expired ? 'expired' : suspended ? 'suspended' : 'active',
    startsAtMs,
    expiresAtMs,
    remainingDays: Math.max(0, Math.ceil((expiresAtMs - nowMs) / SUBSCRIPTION_DAY_MS)),
    durationDays: Number(days),
  };
}

export const SUBSCRIPTION_EXPIRED_MESSAGE = "Votre abonnement a expiré. Seul l’administrateur peut renouveler et réactiver votre compte.";
