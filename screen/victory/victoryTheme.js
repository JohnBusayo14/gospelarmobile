// screen/victory/victoryTheme.js
// ─────────────────────────────────────────────────────────────────────────────
// Local design tokens for the Victory Month book.
//
// 2026-06 palette — a clean, modern 7-role system with blue as primary:
//   Primary    #2563EB   (BLUE ramp, 600 level)
//   Secondary  #0EA5E9   (SKY ramp + the INDIGO accent slot)
//   Success    #22C55E   (EMERALD)
//   Warning    #F59E0B   (AMBER)
//   Error      #EF4444   (ROSE)
//   Background #F8FAFC   (light pageBg)
//   Text       #1E293B   (light textStrong)
// The historic export names (INDIGO/ROSE/EMERALD) are kept so the 20 victory
// screens keep compiling without a sweep — only the values moved.
// ─────────────────────────────────────────────────────────────────────────────

// Primary blue ramp — the spine of the Victory Month visual identity.
// Anchored on the brand primary #2563EB at the 600 (CTA) level.
export const BLUE = {
  900: '#1E3A8A',   // deepest night sky
  800: '#1E40AF',   // ink
  700: '#1D4ED8',   // primary deep
  600: '#2563EB',   // primary (CTAs) — brand anchor
  500: '#3B82F6',   // primary bright
  400: '#60A5FA',   // primary soft
  300: '#93C5FD',   // washed
  200: '#BFDBFE',   // pale
  100: '#DBEAFE',   // surface tint
  50:  '#EFF6FF',   // background wash
};

// Secondary accent — used for "Vigil" group + secondary CTA gradients.
// Anchored on the secondary #0EA5E9 (sky). Kept under the INDIGO name for
// back-compat with existing call sites.
export const INDIGO = {
  700: '#0369A1',
  600: '#0284C7',
  500: '#0EA5E9',   // secondary
  100: '#E0F2FE',
  50:  '#F0F9FF',
};

// Sky accent — same secondary hue, used for soft highlights / orbs.
export const SKY = {
  500: '#0EA5E9',   // secondary
  100: '#E0F2FE',
};

// Warning amber — "today" / "pending" highlights.
export const AMBER = {
  600: '#D97706',
  500: '#F59E0B',   // warning
  100: '#FEF3C7',
  50:  '#FFFBEB',
};

// Error red — for destructive / urgent moments.
export const ROSE = {
  500: '#EF4444',   // error
  100: '#FEE2E2',
};

// Success green — for "completed" / success states.
export const EMERALD = {
  600: '#16A34A',
  500: '#22C55E',   // success
  100: '#DCFCE7',
};

// Group → accent mapping for the vigil cards. Built from the 7-role palette:
// Family on primary blue, Youth on secondary sky, Women on error red, Men on
// success green, General on warning amber — so the five read distinctly.
export const GROUP_ACCENTS = {
  Family:  { fg: '#2563EB', bg: '#EFF6FF', deep: '#1E3A8A' },   // primary
  Youth:   { fg: '#0EA5E9', bg: '#E0F2FE', deep: '#0369A1' },   // secondary
  Women:   { fg: '#EF4444', bg: '#FEE2E2', deep: '#991B1B' },   // error
  Men:     { fg: '#22C55E', bg: '#DCFCE7', deep: '#166534' },   // success
  General: { fg: '#F59E0B', bg: '#FEF3C7', deep: '#92400E' },   // warning
};

// Get the right group accent (falls back to indigo for unknown groups).
export const groupAccent = (group) =>
  GROUP_ACCENTS[group] || { fg: INDIGO[600], bg: INDIGO[50], deep: INDIGO[700] };

// Build the Victory Month tone palette for the current theme.
//
// Previous iteration leaned on translucent "glass" fills + animated orbs in
// the backdrop. That look has been retired in favour of a plain, modern,
// high-contrast surface design: solid card fills, a visible 1px hairline
// border, stronger chip colours, and clearer body/muted text. The names are
// kept (glassFill / glassEdge) so the 16 victory screens keep compiling
// without a sweep — the underlying values are just no longer translucent.
export const victoryTones = (isDark) => ({
  // Page background — the palette Background #F8FAFC in light mode so white
  // cards sit visibly on top; near-black in dark mode.
  pageBg:      isDark ? '#0A0F1A' : '#F8FAFC',

  // Hero / primary CTA gradient pair — used by the Open Today button.
  ctaFrom:     BLUE[700],
  ctaTo:       BLUE[500],
  ctaShadow:   'rgba(37, 99, 235, 0.30)',   // #2563EB primary glow

  // "Today" pill / highlight — saturated enough to read at a glance.
  todayBg:     isDark ? 'rgba(59, 130, 246, 0.18)' : BLUE[100],
  todayFg:     isDark ? BLUE[200] : BLUE[700],

  // Chip backgrounds (used on small pills, eyebrow labels, etc.)
  chipBg:      isDark ? '#152033' : BLUE[50],
  chipFg:      isDark ? BLUE[300] : BLUE[700],

  // Scripture pill — slightly more visible than the previous indigo wash.
  versePillBg: isDark ? '#1A1D38' : INDIGO[50],
  versePillFg: isDark ? INDIGO[100] : INDIGO[700],

  // Card surface — solid (no transparency) so cards read clearly against
  // the plain page bg. Cards should pair this with `glassEdge` as a 1px
  // border for a clean, modern outline.
  glassFill:   isDark ? '#121826' : '#FFFFFF',
  glassEdge:   isDark ? '#1F2A40' : '#E5E7EB',

  // Primary body text — the palette Text #1E293B (slate) in light mode.
  textStrong:  isDark ? '#F3F4F6' : '#1E293B',
  textMuted:   isDark ? '#9CA3AF' : '#475569',

  // Background orb tints — kept on the tone object for back-compat with any
  // call sites that still read them; the orbs themselves are no longer
  // rendered (VictoryBackdrop is a no-op).
  orbA:        'transparent',
  orbB:        'transparent',
  orbC:        'transparent',
});

// Standard radii used in the Victory Month book. Slightly tighter than the
// previous values for a more contemporary feel.
export const RADII = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 };

// Ambient shadow used on floating cards. Tighter + closer to the surface
// than the previous diffuse 40px-blur ambient lift — the modern flat-card
// style relies on a clean border + a short soft shadow.
export const AMBIENT_SHADOW = {
  shadowColor:   '#0F172A',
  shadowOffset:  { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius:  12,
  elevation:     2,
};
