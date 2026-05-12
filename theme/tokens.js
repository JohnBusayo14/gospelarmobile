// theme/tokens.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the app's visual design.
// Every screen / component should import from here instead of defining its
// own LIGHT/DARK objects, so a palette tweak propagates app-wide in one edit.
//
// Aesthetic: Robinhood-style fintech — pure black background in dark mode,
// massive bold hero numbers, lime-green accent for CTAs, subtle dark cards
// with no borders. Light mode mirrors the same structure on white.
// ─────────────────────────────────────────────────────────────────────────────

// ── Colors ───────────────────────────────────────────────────────────────────
export const PALETTE = {
  // Accents (same in both themes — pop equally on white and black)
  lime:       '#D9FF6B',   // legacy CTA accent (kept for screens not yet migrated)
  limeDark:   '#9FCB35',
  green:      '#10B981',   // icons, links, success states
  greenDeep:  '#0F4C36',
  red:        '#EF4444',   // destructive / error
  redDeep:    '#B91C1C',   // destructive CTA gradient end
  amber:      '#F59E0B',   // warning / streak
  // Blue ramp — the new app-wide primary used by the glass design system
  blue:       '#1A56DB',
  blue_deep:  '#1E40AF',
  blue_mid:   '#3B82F6',
  blue_light: '#EFF6FF',
  slate:      '#94A3B8',
};

// Glass-surface tokens. Consumed by <Glass /> + <MeshBackground />.
// Centralised so a future tweak (e.g. raising blur intensity) lands once.
export const glass = (isDark) => ({
  fill:      isDark ? 'rgba(20,28,46,0.70)' : 'rgba(255,255,255,0.70)',
  stroke:    isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
  trackBg:   isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)',
  intensity: isDark ? 38 : 50,
  tint:      isDark ? 'dark' : 'light',
});

// Mesh-background gradient stops for the app shell.
export const mesh = (isDark) => isDark
  ? {
      base:    ['#0B1228', '#0A0E1F', '#08111E'],
      overlay: ['rgba(26,86,219,0.18)', 'transparent'],
    }
  : {
      base:    ['#F0F5FF', '#FFFFFF', '#EAF1FF'],
      overlay: ['rgba(26,86,219,0.10)', 'transparent'],
    };

// Build a token bag for a given theme. Components do:
//   const tk = useMemo(() => getTokens(isDark), [isDark]);
export const getTokens = (isDark) => isDark ? DARK : LIGHT;

const DARK = {
  // Surfaces — pure black backdrop, near-black cards, barely-there elevation
  bg:          '#000000',
  surface:     '#111111',   // resting card
  surfaceEl:   '#1C1C1C',   // elevated card / pressed state
  border:      '#1F1F1F',   // hairline divider on dark surfaces
  // Text
  textPrimary: '#FFFFFF',
  textSec:     '#9CA3AF',
  textMuted:   '#6B7280',
  // Roles
  ...PALETTE,
};

const LIGHT = {
  bg:          '#FFFFFF',
  surface:     '#F7F7F7',
  surfaceEl:   '#EEEEEE',
  border:      '#E5E5E5',
  textPrimary: '#0A0A0A',
  textSec:     '#525252',
  textMuted:   '#A3A3A3',
  ...PALETTE,
};

// ── Typography scale ─────────────────────────────────────────────────────────
// Spread these into a Text style: <Text style={[type.h1, { color: tk.textPrimary }]}/>
export const type = {
  // Massive hero metric — "$0.00" / streak count etc.
  hero:    { fontSize: 56, fontWeight: '900', letterSpacing: -1.5, lineHeight: 60 },
  // Page title — "Refer and Earn"
  h1:      { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  // Section heading
  h2:      { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  // Card title / list-row label
  h3:      { fontSize: 16, fontWeight: '700', letterSpacing: -0.1 },
  // Body / paragraph
  body:    { fontSize: 14, fontWeight: '500', lineHeight: 21 },
  // Sub-text under headings
  sub:     { fontSize: 13, fontWeight: '500', lineHeight: 19 },
  // Captions, list metadata
  caption: { fontSize: 12, fontWeight: '600' },
  // ALL-CAPS LABELS (with letter-spacing)
  label:   { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
};

// ── Spacing / radii ──────────────────────────────────────────────────────────
export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28, '3xl': 40, '4xl': 56,
};

export const radii = {
  sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, full: 9999,
};

// Standard card style — soft surface, no border in dark, hair border in light.
// Components do: <View style={[card(tk), { padding: 18 }]}>
export const card = (tk) => ({
  backgroundColor: tk.surface,
  borderRadius:    radii.xl,
  // In dark mode the surface is enough; in light mode add a hair border for
  // separation since the card and bg are both bright.
  ...(tk.bg === '#FFFFFF'
    ? { borderWidth: 1, borderColor: tk.border }
    : {}),
});
