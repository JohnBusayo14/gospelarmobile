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
  gen:    'Genesis',       genesis: 'Genesis',       exo:    'Exodus',
  exod:   'Exodus',        exodus: 'Exodus',          lev:    'Leviticus',
  leviticus: 'Leviticus',
  num:    'Numbers',       numbers: 'Numbers',       deu:    'Deuteronomy',
  deut:   'Deuteronomy',   deuteronomy: 'Deuteronomy',
  jos:    'Joshua',        josh:   'Joshua',          joshua: 'Joshua',
  jdg:    'Judges',         jud:    'Judges',         judg:   'Judges',
  judges: 'Judges',
  rut:    'Ruth',          ruth: 'Ruth',
  '1sam': '1 Samuel',       '2sam': '2 Samuel',
  '1samuel': '1 Samuel',    '2samuel': '2 Samuel',
  isamuel: '1 Samuel',      iisamuel: '2 Samuel',
  '1ki':  '1 Kings',       '2ki':  '2 Kings',        '1kgs': '1 Kings',
  '2kgs': '2 Kings',        '1kings': '1 Kings',     '2kings': '2 Kings',
  ikings: '1 Kings',        iikings: '2 Kings',
  '1chr': '1 Chronicles',  '2chr': '2 Chronicles',
  '1chronicles': '1 Chronicles', '2chronicles': '2 Chronicles',
  ichronicles: '1 Chronicles',   iichronicles: '2 Chronicles',
  ezr:    'Ezra',            ezra: 'Ezra',            neh:    'Nehemiah',
  nehemiah: 'Nehemiah',
  est:    'Esther',        esth:   'Esther',         esther: 'Esther',
  job:    'Job',             psa:    'Psalms',
  ps:     'Psalms',         psalm:  'Psalms',         psalms: 'Psalms',
  prov:   'Proverbs',       pro:    'Proverbs',       proverbs: 'Proverbs',
  ecc:    'Ecclesiastes',   eccl:   'Ecclesiastes',  ecclesiastes: 'Ecclesiastes',
  sos:    'Song of Solomon', song: 'Song of Solomon', songofsolomon: 'Song of Solomon',
  songofsongs: 'Song of Solomon',
  isa:    'Isaiah',         isaiah: 'Isaiah',
  jer:    'Jeremiah',       jeremiah: 'Jeremiah',
  lam:    'Lamentations',   lamentations: 'Lamentations',
  ezk:    'Ezekiel',       eze:    'Ezekiel',         ezek:   'Ezekiel',
  ezekiel: 'Ezekiel',       dan:    'Daniel',         daniel: 'Daniel',
  hos:    'Hosea',         hosea: 'Hosea',
  joe:    'Joel',           joel:   'Joel',
  amos:   'Amos',           amo:    'Amos',
  oba:    'Obadiah',        obadiah: 'Obadiah',
  jon:    'Jonah',          jonah: 'Jonah',
  mic:    'Micah',          micah: 'Micah',
  nah:    'Nahum',          nahum: 'Nahum',
  hab:    'Habakkuk',       habakkuk: 'Habakkuk',
  zep:    'Zephaniah',     zeph:   'Zephaniah',       zephaniah: 'Zephaniah',
  hag:    'Haggai',         haggai: 'Haggai',
  zec:    'Zechariah',     zech:   'Zechariah',      zechariah: 'Zechariah',
  mal:    'Malachi',        malachi: 'Malachi',
  // New Testament
  mat:    'Matthew',       mtt:    'Matthew',         matt:   'Matthew',
  matthew: 'Matthew',       mt:     'Matthew',
  mk:     'Mark',           mar:    'Mark',           mark:   'Mark',
  luk:    'Luke',           lk:     'Luke',           luke:   'Luke',
  joh:    'John',          jhn:    'John',            jn:     'John',
  john:   'John',
  act:    'Acts',           acts: 'Acts',             ac:     'Acts',
  rom:    'Romans',         romans: 'Romans',         ro:     'Romans',
  '1cor': '1 Corinthians',  '2cor': '2 Corinthians',
  '1corinthians': '1 Corinthians', '2corinthians': '2 Corinthians',
  icorinthians: '1 Corinthians',   iicorinthians: '2 Corinthians',
  gal:    'Galatians',      galatians: 'Galatians',
  efe:    'Ephesians',      eph:    'Ephesians',      ephes:  'Ephesians',
  ephesians: 'Ephesians',
  fil:    'Philippians',    phi:    'Philippians',    phl:    'Philippians',
  phil:   'Philippians',    philippians: 'Philippians',
  kol:    'Colossians',     col:    'Colossians',     colossians: 'Colossians',
  '1tes': '1 Thessalonians', '1ths': '1 Thessalonians', '1thes': '1 Thessalonians',
  '1thess': '1 Thessalonians', '1thessalonians': '1 Thessalonians',
  ithessalonians: '1 Thessalonians',
  '2tes': '2 Thessalonians', '2ths': '2 Thessalonians', '2thess': '2 Thessalonians',
  '2thessalonians': '2 Thessalonians', iithessalonians: '2 Thessalonians',
  '1tim': '1 Timothy',      '1tím': '1 Timothy',      '1timothy': '1 Timothy',
  itimothy: '1 Timothy',
  '2tim': '2 Timothy',      '2timothy': '2 Timothy',  iitimothy: '2 Timothy',
  tit:    'Titus',          titus:  'Titus',
  phlm:   'Philemon',      philem: 'Philemon',        philemon: 'Philemon',
  fil1:   'Philemon',      filim:  'Philemon',
  hib:    'Hebrews',        heb:    'Hebrews',        hebrews: 'Hebrews',
  híb:    'Hebrews',
  jas:    'James',          jam:    'James',          jams:   'James',
  jek:    'James',          james:  'James',
  '1pet': '1 Peter',        '1pit': '1 Peter',        '1peter': '1 Peter',
  ipeter: '1 Peter',
  '2pet': '2 Peter',        '2peter': '2 Peter',      iipeter: '2 Peter',
  '1joh': '1 John',         '1jo':  '1 John',         '1jn':   '1 John',
  '1john': '1 John',        ijohn:  '1 John',         '1kor': '1 Corinthians',
  '2joh': '2 John',         '2jn':  '2 John',         '2john': '2 John',
  iijohn: '2 John',
  '3joh': '3 John',         '3jn':  '3 John',         '3john': '3 John',
  iiijohn: '3 John',
  jud2:   'Jude',           jude:   'Jude',
  rev:    'Revelation',     revelation: 'Revelation',
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

  // Isolate the book name from the chapter/verse. Books may start with a digit
  // ("1 Cor.", "2 Thess.") so consume an optional leading digit-and-space, then
  // letters (no inner digits), then any combination of dots/whitespace before
  // the chapter number begins.
  const match = s.match(/^(\d?\s*[A-Za-z][^0-9]*?)[\s.]*(\d.*)$/);
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