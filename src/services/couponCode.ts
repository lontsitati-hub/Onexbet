/**
 * Génération du code de coupon de pari.
 *
 * Format imposé (5 caractères, TOUJOURS un mélange lettres + chiffres) :
 * - 3 lettres + 2 chiffres (ex: DUA5J)
 * - 2 lettres + 3 chiffres (ex: AB123)
 *
 * Jamais uniquement des lettres, jamais uniquement des chiffres.
 */

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I/O (confusion avec 1/0)
const DIGITS = '0123456789';

function randItem(s: string): string {
  return s[Math.floor(Math.random() * s.length)];
}

/**
 * Génère un code de coupon valide (format mixte 5 caractères).
 * Retourne un code dont le format alterne : 3 lettres + 2 chiffres
 * ou 2 lettres + 3 chiffres (choisi aléatoirement).
 */
export function generateCouponCode(): string {
  // Décide aléatoirement du format : 'llldd' (2 lettres + 3 chiffres)
  // ou 'llddd' (3 lettres + 2 chiffres)
  const threeLetters = Math.random() < 0.5;

  let code = '';
  const letters = Array.from({ length: threeLetters ? 3 : 2 }, () => randItem(LETTERS));
  const digits = Array.from({ length: threeLetters ? 2 : 3 }, () => randItem(DIGITS));
  const pool = [...letters, ...digits];

  // Mélange de Fisher-Yates pour une distribution aléatoire des positions
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  code = pool.join('');

  return code;
}

/**
 * Valide qu'un code respecte le format imposé (3 lettres + 2 chiffres OU
 * 2 lettres + 3 chiffres). Retourne false pour tout code invalide.
 */
export function isValidCouponCode(code: string): boolean {
  const upper = code.toUpperCase();
  if (upper.length !== 5) return false;
  const letters = upper.replace(/[^A-Z]/g, '').length;
  const digits = upper.replace(/[^0-9]/g, '').length;
  return letters + digits === 5 && ((letters === 3 && digits === 2) || (letters === 2 && digits === 3));
}

/**
 * Génère le numéro interne visible du ticket selon le format de référence :
 * exactement 11 chiffres, avec le préfixe fixe 86487 suivi de 6 chiffres.
 * Ce numéro reste distinct du code court alphanumérique du coupon.
 */
export function generateTicketNumber(): string {
  const suffix = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return `86487${suffix}`;
}

export function isValidTicketNumber(ticketNumber: string): boolean {
  return /^86487\d{6}$/.test(ticketNumber);
}

/**
 * Normalise un identifiant historique en numéro de ticket visible de référence.
 * Les IDs techniques restent inchangés pour la navigation et les mises à jour.
 */
export function formatTicketNumberForDisplay(ticketId: string): string {
  const digits = String(ticketId || '').replace(/\D/g, '');
  const suffix = digits.slice(-6).padStart(6, '0');
  return `86487${suffix}`;
}
