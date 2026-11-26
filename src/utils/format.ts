/**
 * Formate les cotes de pari.
 * Si la cote est un nombre entier (ex: 22.00 ou 2.00), elle s'affiche sans décimales (ex: "22" ou "2").
 * Sinon, elle s'affiche avec au maximum 3 décimales en supprimant les zéros inutiles à la fin.
 */
export function formatOdd(odd: number | string | undefined | null): string {
  if (odd === undefined || odd === null) return '';
  const num = typeof odd === 'string' ? parseFloat(odd) : odd;
  if (isNaN(num)) return String(odd);
  if (num % 1 === 0) {
    return num.toFixed(0);
  }
  return parseFloat(num.toFixed(3)).toString();
}
