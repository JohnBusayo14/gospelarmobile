// components/BibleVerseLink.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Drop-in replacement for any verse reference text.
// When tapped → opens BibleVerseModal with the fetched verse text.
//
// Props:
//   reference  {string}  "John 3:16" / "Philem. 1:1-3" / "Eph. 4:3-4"
//   isDark     {bool}
//   style      {object}  optional extra Text styles (for size/color overrides)
//   children   {node}    if provided, renders children instead of reference text
//   pill       {bool}    render as a pill badge (default false = plain link text)
//   accent     {string}  override accent colour
//
// Usage (pill badge):
//   <BibleVerseLink reference="John 3:16" isDark={isDark} pill />
//
// Usage (inline text link):
//   <BibleVerseLink reference="Eph. 4:3" isDark={isDark}>Eph. 4:3</BibleVerseLink>
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import BibleVerseModal from './BibleVerseModal';

// Accent lookup — same cycle as rest of app
const ACCENTS = ['#2563EB', '#7C3AED', '#10B981', '#F97316', '#EF4444', '#0891B2'];
function hashAccent(ref = '', override) {
  if (override) return override;
  let h = 0;
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) & 0xff;
  return ACCENTS[h % ACCENTS.length];
}

export default function BibleVerseLink({
  reference,
  isDark = false,
  style,
  children,
  pill = false,
  accent: accentProp,
}) {
  const [visible, setVisible] = useState(false);

  // Don't render anything if no reference
  if (!reference) return null;

  const accent = hashAccent(reference, accentProp);
  const label  = children || reference;

  if (pill) {
    return (
      <>
        <TouchableOpacity
          onPress={() => setVisible(true)}
          activeOpacity={0.72}
          style={[
            s.pill,
            {
              backgroundColor: accent + '18',
              borderColor:      accent + '40',
            },
          ]}
        >
          <Text style={s.pillIcon}>📜</Text>
          <Text style={[s.pillText, { color: accent }, style]} numberOfLines={1}>
            {label}
          </Text>
          <View style={[s.pillDot, { backgroundColor: accent }]} />
        </TouchableOpacity>

        <BibleVerseModal
          reference={reference}
          visible={visible}
          onClose={() => setVisible(false)}
          isDark={isDark}
        />
      </>
    );
  }

  // Inline text link
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text
          style={[
            s.linkText,
            { color: accent, borderBottomColor: accent + '50' },
            style,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>

      <BibleVerseModal
        reference={reference}
        visible={visible}
        onClose={() => setVisible(false)}
        isDark={isDark}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: parse inline text and extract verse references, returning an array
// of {type:'text'|'verse', value} segments. Used for rich text rendering.
//
// Example:
//   parseVerseRefs("See John 3:16 and Eph. 4:3-4 for reference.")
//   → [{type:'text', value:'See '}, {type:'verse', value:'John 3:16'}, ...]
// ─────────────────────────────────────────────────────────────────────────────
const VERSE_PATTERN = /\b((?:\d\s)?[A-Za-zÀ-ÿ]+\.?\s*\d+:\d+(?:[–\-]\d+)?)/g;

export function parseVerseRefs(text = '') {
  const segments = [];
  let lastIndex  = 0;
  let match;

  VERSE_PATTERN.lastIndex = 0; // reset stateful regex

  while ((match = VERSE_PATTERN.exec(text)) !== null) {
    const [full] = match;
    const start  = match.index;

    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    segments.push({ type: 'verse', value: full });
    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

// ─────────────────────────────────────────────────────────────────────────────
// RichVerseText — renders a paragraph with inline tappable verse references.
// ─────────────────────────────────────────────────────────────────────────────
export function RichVerseText({ text, isDark, style, lineHeight = 24 }) {
  const [modalRef, setModalRef] = useState(null);
  if (!text) return null;

  const segments = parseVerseRefs(text);

  return (
    <>
      <Text style={[{ lineHeight }, style]}>
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return <Text key={i}>{seg.value}</Text>;
          }
          const accent = hashAccent(seg.value);
          return (
            <Text
              key={i}
              onPress={() => setModalRef(seg.value)}
              style={{
                color: accent,
                fontWeight: '700',
                textDecorationLine: 'underline',
                textDecorationColor: accent + '60',
              }}
            >
              {seg.value}
            </Text>
          );
        })}
      </Text>

      {!!modalRef && (
        <BibleVerseModal
          reference={modalRef}
          visible={!!modalRef}
          onClose={() => setModalRef(null)}
          isDark={isDark}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Pill style
  pill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 11, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  pillIcon: { fontSize: 12, marginRight: 5 },
  pillText: { fontSize: 12, fontWeight: '700', marginRight: 5 },
  pillDot:  { width: 5, height: 5, borderRadius: 3 },

  // Inline link style
  linkText: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});