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
// Examples:
//   "See John 3:16 and Eph. 4:3-4"  → [text, verse:"John 3:16", text, verse:"Eph. 4:3-4"]
//   "Read Genesis 1 carefully"      → [text, verse:"Genesis 1", text]
//   "Matt. 28:16, 18-20; Acts 22:14"→ [verse:"Matt. 28:16", text, verse:"18-20"…  ]
//
// Book recognition is whitelisted (full names, common abbreviations, Roman-
// numeral prefixes). The regex matches `<Book>[.] <chapter>[:verse[-end]]`,
// so chapter-only refs ("Psalm 23") are picked up too.
// ─────────────────────────────────────────────────────────────────────────────

// Single source of truth for what counts as a book. Order is preserved when
// building the regex — longer tokens come first so "1 Corinthians" wins over
// "1 Cor" and "Genesis" wins over "Gen".
const BOOK_TOKENS = [
  // ── Two-word / numbered first (longest first to win the alternation race) ──
  '1 Corinthians', '2 Corinthians', 'I Corinthians', 'II Corinthians',
  '1 Thessalonians', '2 Thessalonians', 'I Thessalonians', 'II Thessalonians',
  '1 Chronicles', '2 Chronicles', 'I Chronicles', 'II Chronicles',
  'Song of Solomon', 'Song of Songs',
  '1 Samuel', '2 Samuel', 'I Samuel', 'II Samuel',
  '1 Timothy', '2 Timothy', 'I Timothy', 'II Timothy',
  '1 Kings', '2 Kings', 'I Kings', 'II Kings',
  '1 Peter', '2 Peter', 'I Peter', 'II Peter',
  '1 John', '2 John', '3 John', 'I John', 'II John', 'III John',
  '1 Cor', '2 Cor', '1 Thess', '2 Thess', '1 Tim', '2 Tim',
  '1 Sam', '2 Sam', '1 Kgs', '2 Kgs', '1 Chr', '2 Chr',
  '1 Pet', '2 Pet', '1 Jn', '2 Jn', '3 Jn',

  // ── Single-word full names ───────────────────────────────────────────────
  'Deuteronomy', 'Ecclesiastes', 'Lamentations', 'Philippians', 'Philemon',
  'Colossians', 'Galatians', 'Ephesians', 'Revelation', 'Zechariah',
  'Zephaniah', 'Habakkuk', 'Nehemiah', 'Leviticus', 'Proverbs', 'Jeremiah',
  'Ezekiel', 'Isaiah', 'Hebrews', 'Matthew', 'Obadiah', 'Romans', 'Genesis',
  'Numbers', 'Joshua', 'Judges', 'Esther', 'Psalms', 'Daniel', 'Haggai',
  'Malachi', 'Hosea', 'Micah', 'Nahum', 'James', 'Exodus', 'Psalm', 'Titus',
  'Acts', 'Mark', 'Luke', 'John', 'Ruth', 'Ezra', 'Joel', 'Amos', 'Jonah',
  'Jude', 'Job',

  // ── Single-word abbreviations ────────────────────────────────────────────
  'Philem', 'Phlm', 'Ephes', 'Deut', 'Eccl', 'Zech', 'Zeph', 'Matt', 'Prov',
  'Song', 'Josh', 'Judg', 'Esth', 'Ezek', 'Gen', 'Exo', 'Lev', 'Num', 'Deu',
  'Jos', 'Jdg', 'Rut', 'Ezr', 'Neh', 'Est', 'Psa', 'Pro', 'Ecc', 'Sos',
  'Isa', 'Jer', 'Lam', 'Eze', 'Dan', 'Hos', 'Joe', 'Amo', 'Oba', 'Jon',
  'Mic', 'Nah', 'Hab', 'Zep', 'Hag', 'Zec', 'Mal', 'Mat', 'Mar', 'Luk',
  'Joh', 'Rom', 'Gal', 'Eph', 'Phil', 'Phl', 'Col', 'Tit', 'Heb', 'Jas',
  'Jam', 'Rev', 'Mt', 'Mk', 'Lk', 'Jn', 'Ac', 'Ro', 'Ps',
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build one big alternation, escape each token, allow the optional period
// (Eph. / Matt.) and an optional space. Then require a chapter number, with
// an optional ":verse" (and optional "-end").
const BOOK_ALT = BOOK_TOKENS
  .slice()
  .sort((a, b) => b.length - a.length)  // longest-first inside the alternation
  .map(escapeRe)
  .join('|');

const VERSE_PATTERN = new RegExp(
  // (?<![A-Za-z]) — don't match mid-word ("Romans" inside "Romansworld")
  // Separator after the book is either a period (optionally followed by space)
  // or one-or-more spaces, so we catch "Philem.1:8" as well as "Philem 1:8".
  `(?<![A-Za-zÀ-ÿ])(${BOOK_ALT})(?:\\.\\s*|\\s+)(\\d+)(?::\\d+(?:\\s*[-–—]\\s*\\d+)?)?(?![A-Za-zÀ-ÿ])`,
  'gi'
);

export function parseVerseRefs(text = '') {
  const segments = [];
  let lastIndex  = 0;
  let match;

  VERSE_PATTERN.lastIndex = 0;

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