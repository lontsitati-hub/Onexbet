export const REFERENCE_BET_MIN = 200;
export const REFERENCE_BET_MAX = 706275.9;

/** The recorded game settles amounts to hundredths rather than whole francs. */
export function referencePayout(bet: number, multiplier: number): number {
  return Math.floor(bet * multiplier * 100 + 0.000001) / 100;
}

export function formatReferenceAmount(value: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value).replace(/,/g, ' ')} F`;
}

export function formatReferenceBalance(value: number): string {
  return `${value.toFixed(2)} F`;
}

export function parseReferenceBet(raw: string): number {
  const number = Number(raw.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (!Number.isFinite(number) || number < REFERENCE_BET_MIN) return REFERENCE_BET_MIN;
  return Math.min(number, REFERENCE_BET_MAX);
}

/** Keep every level mounted; the bottom-anchored viewport clips future rows, not the player's apple history. */
export function visibleReferenceRows(total: number): number[] {
  return Array.from({ length: total }, (_, i) => total - 1 - i);
}
