// screen/victory/victoryTheme.js
// ─────────────────────────────────────────────────────────────────────────────
// Local design tokens for the Victory Month book.
// Adapted from the DESIGN.md spec ("Glassmorphic Clinical Warmth") but
// retuned for a blue, devotional aesthetic instead of the medical palette:
//   • Blue primary instead of teal       (#1A56DB → #3B82F6)
//   • Indigo complement for accent CTAs  (#4F46E5)
//   • Amber tertiary for "today" highlights
//   • Surfaces are organic, no 1px borders — boundaries via tonal shifts
//   • Generous radii (16–32px) for a soft, devotional feel
//   • Ambient shadows (40–60px blur, low opacity) for soft lift
// ─────────────────────────────────────────────────────────────────────────────

// Primary blue ramp — the spine of the Victory Month visual identity.
export const BLUE = {
  900: '#0B2A6B',   // deep night sky
  800: '#1E3A8A',   // ink
  700: '#1D4ED8',   // primary deep
  600: '#1A56DB',   // primary (CTAs)
  500: '#3B82F6',   // primary bright
  400: '#60A5FA',   // primary soft
  300: '#93C5FD',   // washed
  200: '#BFDBFE',   // pale
  100: '#DBEAFE',   // surface tint
  50:  '#EFF6FF',   // background wash
};

// Indigo accent — used for "Vigil" group and secondary CTA gradients.
export const INDIGO = {
  700: '#4338CA',
  600: '#4F46E5',
  500: '#6366F1',
  100: '#E0E7FF',
  50:  '#EEF2FF',
};

// Sky accent — used for soft glassmorphic orbs in the background.
export const SKY = {
  500: '#0EA5E9',
  100: '#E0F2FE',
};

// Tertiary amber — sparingly used for "today" / "pending" highlights.
export const AMBER = {
  600: '#D97706',
  500: '#F59E0B',
  100: '#FEF3C7',
  50:  '#FFFBEB',
};

// Calm coral — for "mark as prayed" celebration / urgent moments.
// Never harsh red — keeps the devotional tone.
export const ROSE = {
  500: '#F43F5E',
  100: '#FFE4E6',
};

// Emerald — for "completed" / success states.
export const EMERALD = {
  600: '#059669',
  500: '#10B981',
  100: '#D1FAE5',
};

// Group → accent mapping for the vigil cards. Keeps the palette varied
// while staying inside the blue family.
export const GROUP_ACCENTS = {
  Family:  { fg: '#1A56DB', bg: '#EFF6FF', deep: '#1E3A8A' },
  Youth:   { fg: '#4F46E5', bg: '#EEF2FF', deep: '#3730A3' },
  Women:   { fg: '#DB2777', bg: '#FCE7F3', deep: '#9D174D' },
  Men:     { fg: '#0F766E', bg: '#CCFBF1', deep: '#134E4A' },
  General: { fg: '#7C3AED', bg: '#EDE9FE', deep: '#5B21B6' },
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
  // Page background — a plain, single colour. Slightly cool-grey in light
  // mode so white cards sit visibly on top; near-black in dark mode.
  pageBg:      isDark ? '#0A0F1A' : '#F4F6FB',

  // Hero / primary CTA gradient pair — used by the Open Today button.
  ctaFrom:     BLUE[700],
  ctaTo:       BLUE[500],
  ctaShadow:   'rgba(26, 86, 219, 0.30)',

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

  // Stronger muted text — the global tk.textMuted (#A3A3A3 / #6B7280) reads
  // as washed-out against the new solid cards. Victory screens should
  // prefer this for secondary copy where readability matters.
  textStrong:  isDark ? '#F3F4F6' : '#111827',
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
