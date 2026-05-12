// components/HymnLink.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders a "G.H.B. 75, 433" reference as a tappable pill.
// On press → opens HymnModal with the full hymn lyrics.
//
// Usage:
//   <HymnLink hymnRef="G.H.B. 75, 433" isDark={isDark} />
//   <HymnLink hymnRef={c.suggested_hymns} isDark={isDark} />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import HymnModal       from './HymnModal';
const { parseHymnRef } = require('../screen/data/hymns');


export default function HymnLink({ hymnRef, isDark = false, style }) {
  const [visible, setVisible] = useState(false);

  const numbers   = parseHymnRef(hymnRef || '');
  if (!hymnRef || !numbers || !numbers.length) return null;
  const hymnCount = Array.isArray(numbers) ? numbers.length : 0;

  // Build a short display label e.g. "GHB 75, 433  · 2 hymns"
  const numsLabel = Array.isArray(numbers) ? numbers.join(', ') : '';

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        activeOpacity={0.72}
        style={[hl.pill, style]}
      >
        {/* Music note icon */}
        <View style={hl.iconWrap}>
          <Text style={{ fontSize: 14 }}>🎵</Text>
        </View>

        {/* Reference text */}
        <View style={{ flex: 1 }}>
          <Text style={hl.label} numberOfLines={1}>
            G.H.B. {numsLabel}
          </Text>
          <Text style={hl.sub}>
            {hymnCount === 1
              ? `Hymn No. ${numbers[0]}`
              : `${hymnCount} Hymns  ·  Tap to sing`}
          </Text>
        </View>

        {/* Tap hint */}
        <View style={hl.arrow}>
          <Text style={hl.arrowText}>›</Text>
        </View>
      </TouchableOpacity>

      <HymnModal
        hymnRef={hymnRef}
        visible={visible}
        onClose={() => setVisible(false)}
        isDark={isDark}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const ACCENT = '#F97316'; // warm amber — music theme

const hl = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: ACCENT + '14',
    borderColor:     ACCENT + '40',
    borderWidth: 1.5, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ACCENT + '22',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  label: { fontSize: 13.5, fontWeight: '800', color: ACCENT, letterSpacing: 0.2 },
  sub:   { fontSize: 11,   fontWeight: '500', color: ACCENT + 'BB', marginTop: 2 },
  arrow: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: ACCENT + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  arrowText: { fontSize: 18, fontWeight: '400', color: ACCENT, marginLeft: 1 },
});