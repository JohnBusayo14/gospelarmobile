// components/TintedIcon.jsx
// ────────────────────────────────────────────────────────────────────────────
// Shared wrapper that puts any icon from components/icons.jsx on a tinted,
// rounded background — the "colorful pill behind a bold outline icon"
// pattern used across the app for visual punch.
//
// Usage:
//   import TintedIcon from '../components/TintedIcon';
//   import { ICONS }  from '../components/icons';
//
//   <TintedIcon Icon={ICONS.Calendar} tone="primary" size="md" />
//   <TintedIcon Icon={ICONS.Bell}     tone="warning" size="sm" />
//   <TintedIcon Icon={ICONS.Trophy}   tone="success" size="lg" />
//
// Props
//   Icon  — a function from components/icons.jsx (NOT an element)
//   tone  — primary | accent | success | warning | danger | info | neutral
//   size  — xs | sm | md | lg                                 (default 'md')
//   sw    — stroke width override                              (default 2.25)
//   style — optional container style overrides
//
// Tones map to soft 100-tint backgrounds + 700 foreground per the same
// palette used by the gospelarregistration web app's IconBadge — keeps
// the brand consistent across mobile and web.
// ────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View } from 'react-native';

const SIZE_MAP = {
  xs: { box: 24, icon: 12, radius: 6 },
  sm: { box: 32, icon: 16, radius: 10 },
  md: { box: 40, icon: 20, radius: 12 },
  lg: { box: 48, icon: 24, radius: 14 },
};

// Tailwind 100 / 700 pairs, hard-coded so we don't depend on the runtime
// theme. The 100 is light enough for any light surface; the 700 is the
// icon ink colour. Matches IconBadge.jsx in the web app.
const TONE_MAP = {
  primary: { bg: '#DBEAFE', fg: '#0369A1' }, // sky
  accent:  { bg: '#EDE9FE', fg: '#6D28D9' }, // violet
  success: { bg: '#D1FAE5', fg: '#047857' }, // emerald
  warning: { bg: '#FEF3C7', fg: '#B45309' }, // amber
  danger:  { bg: '#FFE4E6', fg: '#BE123C' }, // rose
  info:    { bg: '#CFFAFE', fg: '#0E7490' }, // cyan
  neutral: { bg: '#F4F4F5', fg: '#3F3F46' }, // zinc
};

export default function TintedIcon({
  Icon,
  tone = 'primary',
  size = 'md',
  sw = 2.25,
  style,
}) {
  if (!Icon) return null;
  const s = SIZE_MAP[size] || SIZE_MAP.md;
  const t = TONE_MAP[tone] || TONE_MAP.primary;
  return (
    <View
      style={[
        {
          width: s.box,
          height: s.box,
          borderRadius: s.radius,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon color={t.fg} size={s.icon} sw={sw} />
    </View>
  );
}

// Exported for callers that need to colour a chip / dot / border the same
// way without going through the wrapper (e.g. a status pill that uses the
// same tone but is its own layout).
export const TINTED_ICON_TONES = TONE_MAP;
