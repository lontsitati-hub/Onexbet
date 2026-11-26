/**
 * Admin Design System — "Management Studio"
 * Palette unifiée pour tous les écrans d'administration.
 */

export const AT = {
  // ── Backgrounds ─────────────────────────────────────────────────────────────
  pageBg:    '#0F1C33',      // fond sombre (header/sidebar)
  contentBg: '#F0F4F8',     // fond clair (contenu)
  cardBg:    '#FFFFFF',
  cardBg2:   '#F8FAFC',     // cartes secondaires / inputs

  // ── Accents ──────────────────────────────────────────────────────────────────
  accent:    '#3B82F6',      // bleu primaire
  accentL:   '#EFF6FF',      // bleu clair (hover, badges)
  gold:      '#F59E0B',
  goldL:     '#FFFBEB',
  green:     '#10B981',
  greenL:    '#ECFDF5',
  red:       '#EF4444',
  redL:      '#FEF2F2',
  purple:    '#8B5CF6',
  purpleL:   '#F5F3FF',

  // ── Text ─────────────────────────────────────────────────────────────────────
  textPrimary:   '#0F172A',
  textSecondary: '#475569',
  textMuted:     '#94A3B8',
  textOnDark:    '#E2E8F0',

  // ── Borders ──────────────────────────────────────────────────────────────────
  border:    '#E2E8F0',
  borderDark:'#1E3455',

  // ── Typography ───────────────────────────────────────────────────────────────
  h1: { fontSize: 15, fontWeight: '800' as const, color: '#0F172A' },
  h2: { fontSize: 13, fontWeight: '700' as const, color: '#0F172A' },
  body: { fontSize: 13, fontWeight: '500' as const, color: '#475569' },
  label: { fontSize: 11.5, fontWeight: '700' as const, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  small: { fontSize: 11, fontWeight: '600' as const, color: '#94A3B8' },

  // ── Inputs ───────────────────────────────────────────────────────────────────
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600' as const,
  },

  // ── Cards ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Buttons ──────────────────────────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: 13,
  },
  btnSuccess: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: 13,
  },
  btnDanger: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: 13,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
} as const;
