// theme/colors.js
// ─── Brand colors extracted from Gospelar logo ─────────────────────────────
// Logo: Red flame (#D32F2F), Blue circle (#1565C0), White dove (#FFFFFF)

export const BRAND = {
  red:       '#D32F2F',   // flame
  redDark:   '#B71C1C',   // deep flame
  redLight:  '#EF5350',   // bright flame
  blue:      '#1565C0',   // circle
  blueDark:  '#0D47A1',   // deep circle
  blueLight: '#1976D2',   // lighter circle
  blueMid:   '#1E88E5',
  white:     '#FFFFFF',
  gold:      '#C9A84C',
  goldLight: '#E8C96A',
  goldDark:  '#A07830',
};

// ─── Build theme from isDark ────────────────────────────────────────────────
export const buildTheme = (isDark) => ({
  // Backgrounds
  bg:          isDark ? '#0A1628' : '#F0F4FA',
  surface:     isDark ? '#111F3A' : '#FFFFFF',
  card:        isDark ? '#162240' : '#FFFFFF',
  cardEl:      isDark ? '#1C2E52' : '#F7F9FD',
  heroGrad:    isDark
    ? ['#0D1F47', '#1565C0', '#0D47A1']
    : ['#1E5CB3', '#1565C0', '#0D47A1'],

  // Borders
  border:      isDark ? '#243454' : '#D8E2F0',
  divider:     isDark ? '#1E2E4A' : '#E8EFF8',

  // Text
  textPrimary:   isDark ? '#EEF2FF' : '#0D1B3E',
  textSecondary: isDark ? '#8BA8D0' : '#3A5280',
  textMuted:     isDark ? '#4E6A99' : '#7B93BB',

  // Brand
  primary:     BRAND.blue,
  primaryDark: BRAND.blueDark,
  primaryMid:  BRAND.blueLight,
  accent:      BRAND.red,
  accentDark:  BRAND.redDark,
  accentLight: BRAND.redLight,
  gold:        BRAND.gold,
  goldLight:   BRAND.goldLight,

  // Utility
  white:       '#FFFFFF',
  black:       '#060E20',

  // Header
  headerBg:     isDark ? '#111F3A' : '#1565C0',
  headerBorder: isDark ? '#1C2E52' : '#1976D2',
  headerText:   '#FFFFFF',
  backBtnBg:    isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.18)',

  // Status bar
  statusBar:    'light-content',

  // Shadow
  shadow:      isDark ? '#000000' : '#0D3080',

  // Highlight (text selection)
  highlight:    isDark ? 'rgba(229,57,53,0.30)' : 'rgba(229,57,53,0.20)',
  highlightBorder: isDark ? '#EF5350' : '#D32F2F',
});