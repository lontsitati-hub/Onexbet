/**
 * Agent Sourcing Logo Sports :
 * Validation et résolution d'URLs d'écussons sportifs.
 * Ne renvoie que des URLs directes d'images valides (.png, .jpg, .jpeg, .webp ou CDN certifié),
 * sinon renvoie explicitement null pour déclencher un fallback propre.
 */

const TRUSTED_CDN_DOMAINS = [
  'api.sofascore.app',
  'a.espncdn.com',
  'upload.wikimedia.org',
  'thesportsdb.com',
  'media.api-sports.io',
  'footballdatabase.eu',
];

export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'flagcdn.com' || hostname.endsWith('.flagcdn.com')) return false;

  // Refuser les URLs de recherche/redirection, même si elles finissent par .png.
  const cleanUrl = parsed.href.toLowerCase();
  if (cleanUrl.includes('search/v2') || cleanUrl.includes('google.com/url') || cleanUrl.includes('bing.com/images')) return false;

  const hasValidExtension = /\.(png|jpg|jpeg|webp|svg)(?:\?.*)?$/i.test(cleanUrl);
  const isTrustedCdn = TRUSTED_CDN_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  return hasValidExtension || isTrustedCdn;
}

export function resolveOnlineTeamLogo(logoUrl: string | null | undefined): string | null {
  if (isValidImageUrl(logoUrl)) {
    return logoUrl!.trim();
  }
  return null;
}
