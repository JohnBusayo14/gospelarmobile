// components/EmojiIcon.jsx
// ────────────────────────────────────────────────────────────────────────────
// Renders a known emoji as its matching outline icon from components/icons.
// The emoji → ICONS mapping lives in icons.jsx (EMOJI_ICON table). Unknown
// emojis fall back to a <Text> render so nothing visually disappears.
//
// Usage:
//   <EmojiIcon emoji="🔥" color={tk.textPrimary} size={20} />
//   <EmojiIcon emoji={achievement.icon} color={ACCENT} size={28} sw={2.25} />
//
// Lets data-driven code (achievement lists, category grids, time-of-day
// reminders) keep its existing `{ emoji: '🔥' }` shape while the rendered
// output is the bottom-tab-style outline icon.
// ────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Text } from 'react-native';
import { iconForEmoji } from './icons';

export default function EmojiIcon({
  emoji,
  color = '#374151',
  size = 20,
  sw = 2.25,
  fallbackFontSize,
  fallbackStyle,
}) {
  const Icon = iconForEmoji(emoji);
  if (Icon) return <Icon color={color} size={size} sw={sw} />;
  // Fallback path — keeps the original glyph visible if it's not in the
  // table. Devs can search the codebase for these by adding the missing
  // mapping to EMOJI_ICON in icons.jsx.
  if (!emoji) return null;
  return (
    <Text style={[
      { fontSize: fallbackFontSize || Math.round(size * 0.95) },
      fallbackStyle,
    ]}>{emoji}</Text>
  );
}
