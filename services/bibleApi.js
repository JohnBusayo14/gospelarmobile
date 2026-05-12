// services/bibleApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Free Bible API — bible-api.com (no key needed, World English Bible)
// Docs: https://bible-api.com
//
// Usage:
//   import { fetchVerse, normalizeReference } from './bibleApi';
//   const data = await fetchVerse('John 3:16');
//   // → { reference, text, verses: [{book_name, chapter, verse, text}], translation_name }
//
// Handles abbreviated book names common in Sunday School materials:
//   "Philem." → "Philemon"   "Eph." → "Ephesians"   "1 Cor." → "1 Corinthians"
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://bible-api.com';

// ── Abbreviation map ──────────────────────────────────────────────────────────
// Keys are lowercase, stripped of dots and spaces
const BOOK_ABBREV = {
  // Old Testament
  gen:    'Genesis',       exo:    'Exodus',        lev:    'Leviticus',
  num:    'Numbers',       deu:    'Deuteronomy',   deut:   'Deuteronomy',
  jos:    'Joshua',        jdg:    'Judges',         jud:    'Judges',
  rut:    'Ruth',          '1sam': '1 Samuel',       '2sam': '2 Samuel',
  '1ki':  '1 Kings',       '2ki':  '2 Kings',        '1chr': '1 Chronicles',
  '2chr': '2 Chronicles',  ezr:    'Ezra',            neh:    'Nehemiah',
  est:    'Esther',        job:    'Job',             psa:    'Psalms',
  ps:     'Psalms',        prov:   'Proverbs',        owe:    'Proverbs',
  pro:    'Proverbs',      ecc:    'Ecclesiastes',   sos:    'Song of Solomon',
  isa:    'Isaiah',        jer:    'Jeremiah',        lam:    'Lamentations',
  ezk:    'Ezekiel',       eze:    'Ezekiel',         dan:    'Daniel',
  hos:    'Hosea',         joe:    'Joel',             amos:   'Amos',
  amo:    'Amos',          oba:    'Obadiah',          jon:    'Jonah',
  mic:    'Micah',         nah:    'Nahum',            hab:    'Habakkuk',
  zep:    'Zephaniah',     hag:    'Haggai',           zec:    'Zechariah',
  mal:    'Malachi',
  // New Testament
  mat:    'Matthew',       mtt:    'Matthew',          mk:     'Mark',
  mar:    'Mark',          luk:    'Luke',              lk:     'Luke',
  joh:    'John',          jhn:    'John',              act:    'Acts',
  rom:    'Romans',        '1cor': '1 Corinthians',    '2cor': '2 Corinthians',
  gal:    'Galatians',     efe:    'Ephesians',         eph:    'Ephesians',
  fil:    'Philippians',   phi:    'Philippians',       phl:    'Philippians',
  kol:    'Colossians',    col:    'Colossians',
  '1tes': '1 Thessalonians', '1ths': '1 Thessalonians', '1thes': '1 Thessalonians',
  '2tes': '2 Thessalonians', '2ths': '2 Thessalonians',
  '1tim': '1 Timothy',     '1tím': '1 Timothy',
  '2tim': '2 Timothy',     tit:    'Titus',             titus:  'Titus',
  phlm:   'Philemon',      philem: 'Philemon',          fil1:   'Philemon',
  filim:  'Philemon',      hib:    'Hebrews',           heb:    'Hebrews',
  híb:    'Hebrews',       jas:    'James',             jek:    'James',
  '1pet': '1 Peter',       '1pit': '1 Peter',           '2pet': '2 Peter',
  '1joh': '1 John',        '1jo':  '1 John',            '1kor': '1 Corinthians',
  '2joh': '2 John',        '3joh': '3 John',            jud2:   'Jude',
  rev:    'Revelation',
};

/**
 * Normalize a human-readable verse reference for the API.
 * "Philem. 1:1–3"  → "Philemon 1:1-3"
 * "Eph. 4:3-4"     → "Ephesians 4:3-4"
 * "1 Cor. 10:13"   → "1 Corinthians 10:13"
 */
export function normalizeReference(ref) {
  if (!ref) return '';

  // Replace em dash / en dash with hyphen
  let s = ref.replace(/[–—]/g, '-').trim();

  // Remove trailing dots from abbreviations but keep "1." in "1 Cor."
  // Strategy: split on the first digit-colon pattern to isolate the book name
  const match = s.match(/^([^0-9]+?)\s*(\d.*)$/);
  if (!match) return s;

  let bookRaw  = match[1].trim();
  const chapterVerse = match[2].trim();

  // Clean book: remove dots, lowercase, remove spaces
  const bookKey = bookRaw
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '');

  const bookFull = BOOK_ABBREV[bookKey] || bookRaw.replace(/\./g, '');
  return `${bookFull} ${chapterVerse}`;
}

/**
 * Fetch verse text from bible-api.com.
 * Returns { reference, text, verses, translation_name } or throws.
 */
export async function fetchVerse(rawReference) {
  const normalized = normalizeReference(rawReference);
  if (!normalized) throw new Error('Empty reference');

  // bible-api.com encodes spaces as %20 or +
  const encoded = encodeURIComponent(normalized);
  const url = `${BASE_URL}/${encoded}?translation=web`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Bible API error ${res.status} for "${normalized}"`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    reference:        data.reference,
    text:             (data.text || '').trim(),
    verses:           data.verses || [],
    translationName:  data.translation_name || 'World English Bible',
  };
}