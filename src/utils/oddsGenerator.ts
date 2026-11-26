export type Odds1X2 = { v1?: number; draw?: number; v2?: number };

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
};

export const isUsableOdd = (value: unknown): value is number => {
  const odd = Number(value);
  return Number.isFinite(odd) && odd > 1;
};

const centsInRange = (seed: string, minCents: number, maxCents: number) =>
  minCents + (hash(seed) % (maxCents - minCents + 1));

/** Stable per match: generated V1 and V2 are inclusive 1.50–3.00. */
export function generateFallback1X2(matchId: string): Required<Odds1X2> {
  const v1Cents = centsInRange(`${matchId}:fallback:V1`, 150, 300);
  const v2Cents = centsInRange(`${matchId}:fallback:V2`, 150, 300);
  const drawCents = Math.max(v1Cents, v2Cents) + 20 + (hash(`${matchId}:fallback:X`) % 121);
  return { v1: v1Cents / 100, draw: drawCents / 100, v2: v2Cents / 100 };
}

/**
 * Preserve any valid provider price. Missing V1/V2 use generated values in
 * [1.50, 3.00]; a generated X is always above the displayed V1 and V2.
 */
export function resolve1X2Odds(matchId: string, provider?: Odds1X2): Required<Odds1X2> {
  const fallback = generateFallback1X2(matchId);
  const v1 = isUsableOdd(provider?.v1) ? Number(provider?.v1) : fallback.v1;
  const v2 = isUsableOdd(provider?.v2) ? Number(provider?.v2) : fallback.v2;
  const draw = isUsableOdd(provider?.draw)
    ? Number(provider?.draw)
    : Number((Math.max(v1, v2) + 0.2 + (hash(`${matchId}:fallback:X:partial`) % 101) / 100).toFixed(2));
  return { v1, draw, v2 };
}

/** Stable fallback for a missing selection in any other market. */
export function generateFallbackMarketOdd(
  matchId: string,
  market: string,
  selection: string,
  min = 1.25,
  max = 8,
): number {
  const minCents = Math.round(min * 100);
  const maxCents = Math.round(max * 100);
  if (maxCents <= minCents) return minCents / 100;
  return centsInRange(`${matchId}:fallback:${market}:${selection}`, minCents, maxCents) / 100;
}
