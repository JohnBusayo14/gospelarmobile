// services/bible.js
// ─────────────────────────────────────────────────────────────────────────────
// Offline Bible.
//
//   • KJV ships inside the app (assets/bible/kjv.bible) and works with no
//     internet from the first launch.
//   • The other versions are downloaded once from <api>/bibles/<id>.json into
//     the app's document directory and then work offline too.
//
// File format (built by backend/scripts/build-bibles.js):
//   { id, name, short, lang, copyright,
//     books: [{ id:'GEN', n:'Genesis', c:[ ['v1','v2',…], … ] }, …] }
// A verse a translation leaves out is stored as ''.
// ─────────────────────────────────────────────────────────────────────────────
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_HOSTS, activeApiHost } from './apiFailover';
import { normalizeReference } from './bibleApi';

export const VERSIONS = [
  { id: 'kjv', short: 'KJV', name: 'King James Version',                   lang: 'en', bundled: true, sizeMB: 4.1 },
  { id: 'asv', short: 'ASV', name: 'American Standard Version',            lang: 'en', sizeMB: 4.1 },
  { id: 'web', short: 'WEB', name: 'World English Bible',                  lang: 'en', sizeMB: 4.0 },
  { id: 'bbe', short: 'BBE', name: 'Bible in Basic English',               lang: 'en', sizeMB: 4.1 },
  { id: 'yor', short: 'YCB', name: 'Bíbélì Mímọ́ Yorùbá Òde-Òní',           lang: 'yo', sizeMB: 5.3 },
  { id: 'ibo', short: 'ICB', name: 'Baịbụlụ Nsọ nʼIgbo Ndị Ugbu a',         lang: 'ig', sizeMB: 5.0 },
  { id: 'hau', short: 'SRK', name: 'Littafi Mai Tsarki, Sabon Rai Don Kowa', lang: 'ha', sizeMB: 3.9 },
];
export const DEFAULT_VERSION = 'kjv';

// English names in canonical order — the same names normalizeReference()
// produces, so verse references from lessons resolve in every version.
export const BOOK_NAMES_EN = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel',
  '1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs',
  'Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James',
  '1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
];
export const OT_BOOKS = 39;

const KEY_VERSION = 'bible_version';
const KEY_LAST    = 'bible_last';
const DIR         = FileSystem.documentDirectory + 'bibles/';
const fileFor     = (id) => `${DIR}${id}.json`;

// Only one parsed Bible is kept in memory at a time (each is ~4–5 MB).
let loaded = null;          // { id, data }
const pending = {};         // id → Promise, so parallel callers share a load

export const versionInfo = (id) => VERSIONS.find((v) => v.id === id) || VERSIONS[0];

// ── Preferences ─────────────────────────────────────────────────────────────
export async function getSelectedVersion() {
  try {
    const id = await AsyncStorage.getItem(KEY_VERSION);
    if (id && (versionInfo(id).bundled || await isDownloaded(id))) return id;
  } catch {}
  return DEFAULT_VERSION;
}
export async function setSelectedVersion(id) {
  try { await AsyncStorage.setItem(KEY_VERSION, id); } catch {}
}
export async function getLastPosition() {
  try { return JSON.parse(await AsyncStorage.getItem(KEY_LAST)) || { book: 42, chapter: 1 }; }
  catch { return { book: 42, chapter: 1 }; }   // John 1
}
export async function setLastPosition(pos) {
  try { await AsyncStorage.setItem(KEY_LAST, JSON.stringify(pos)); } catch {}
}

// ── Downloads ───────────────────────────────────────────────────────────────
export async function isDownloaded(id) {
  if (versionInfo(id).bundled) return true;
  try { return (await FileSystem.getInfoAsync(fileFor(id))).exists; } catch { return false; }
}

export async function downloadedVersions() {
  const out = [];
  for (const v of VERSIONS) if (await isDownloaded(v.id)) out.push(v.id);
  return out;
}

/** Downloads a version; onProgress gets 0..1. Tries every API host. */
export async function downloadVersion(id, onProgress) {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const tmp = `${fileFor(id)}.part`;
  const hosts = [activeApiHost(), ...API_HOSTS].filter((h, i, a) => a.indexOf(h) === i);
  let lastErr;
  for (const host of hosts) {
    try {
      const task = FileSystem.createDownloadResumable(`${host}/bibles/${id}.json`, tmp, {}, (p) => {
        if (p.totalBytesExpectedToWrite > 0) onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      });
      const res = await task.downloadAsync();
      if (!res || res.status !== 200) throw new Error(`HTTP ${res?.status}`);
      // Make sure it is a whole, valid Bible before keeping it.
      const parsed = JSON.parse(await FileSystem.readAsStringAsync(tmp));
      if (!Array.isArray(parsed.books) || parsed.books.length !== 66) throw new Error('Incomplete Bible file');
      await FileSystem.deleteAsync(fileFor(id), { idempotent: true });
      await FileSystem.moveAsync({ from: tmp, to: fileFor(id) });
      loaded = { id, data: parsed };
      return true;
    } catch (e) {
      lastErr = e;
      await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    }
  }
  throw lastErr || new Error('Download failed');
}

export async function deleteVersion(id) {
  if (versionInfo(id).bundled) return;
  await FileSystem.deleteAsync(fileFor(id), { idempotent: true });
  if (loaded?.id === id) loaded = null;
}

// ── Reading ─────────────────────────────────────────────────────────────────
export function loadVersion(id = DEFAULT_VERSION) {
  if (loaded?.id === id) return Promise.resolve(loaded.data);
  if (pending[id]) return pending[id];
  pending[id] = (async () => {
    let raw;
    if (versionInfo(id).bundled) {
      const asset = Asset.fromModule(require('../assets/bible/kjv.bible'));
      await asset.downloadAsync();
      raw = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);
    } else {
      raw = await FileSystem.readAsStringAsync(fileFor(id));
    }
    const data = JSON.parse(raw);
    loaded = { id, data };
    return data;
  })().finally(() => { delete pending[id]; });
  return pending[id];
}

/** Verses of one chapter as [{ verse, text }], skipping verses the version omits. */
export function chapterVerses(bible, bookIdx, chapter) {
  const ch = bible?.books?.[bookIdx]?.c?.[chapter - 1] || [];
  return ch.map((text, i) => ({ verse: i + 1, text })).filter((v) => v.text);
}

// "John 3:16-18", "Ps 23", "Rom. 13:7-8", "1 Cor. 13:4,7", "John 3:36-4:2"
export function parseReference(ref) {
  const norm = normalizeReference(ref);
  const m = norm.match(/^(.+?)\s+(\d+)(?::([\d,\s\-–]+))?(?:\s*[-–]\s*(\d+):(\d+))?\s*$/);
  if (!m) return null;
  const bookIdx = BOOK_NAMES_EN.findIndex((n) => n.toLowerCase() === m[1].trim().toLowerCase());
  if (bookIdx < 0) return null;
  const chapter = parseInt(m[2], 10);
  let verses = null;   // null = whole chapter
  if (m[3]) {
    verses = [];
    for (const part of m[3].split(',')) {
      const [a, b] = part.split(/[-–]/).map((x) => parseInt(x, 10));
      if (!a) continue;
      for (let v = a; v <= (b || a); v++) verses.push(v);
    }
  }
  const toChapter = m[4] ? { chapter: parseInt(m[4], 10), verse: parseInt(m[5], 10) } : null;
  return { bookIdx, chapter, verses, toChapter, tail: norm.slice(m[1].length).trim() };
}

/**
 * Looks a reference up in a version.
 * Returns { reference, text, verses:[{chapter, verse, text}], translationName } or null.
 */
export async function getPassage(ref, versionId) {
  const p = parseReference(ref);
  if (!p) return null;
  const bible = await loadVersion(versionId);
  const book = bible.books[p.bookIdx];
  if (!book?.c?.[p.chapter - 1]) return null;

  const out = [];
  const add = (c, list) => {
    const ch = book.c[c - 1] || [];
    for (const v of list) if (ch[v - 1]) out.push({ chapter: c, verse: v, text: ch[v - 1] });
  };
  if (p.toChapter) {
    const first = book.c[p.chapter - 1].length;
    add(p.chapter, range(p.verses?.[0] || 1, first));
    for (let c = p.chapter + 1; c < p.toChapter.chapter; c++) add(c, range(1, (book.c[c - 1] || []).length));
    add(p.toChapter.chapter, range(1, p.toChapter.verse));
  } else {
    add(p.chapter, p.verses || range(1, book.c[p.chapter - 1].length));
  }
  if (!out.length) return null;

  return {
    reference: `${book.n} ${p.tail}`,
    text: out.map((v) => v.text).join(' '),
    verses: out,
    translationName: bible.name,
    short: bible.short,
  };
}

const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

// Case- and accent-insensitive, so "olorun" finds "Ọlọ́run".
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Full-text search. Returns up to `limit` hits: { bookIdx, chapter, verse, text }. */
export function searchBible(bible, query, limit = 200) {
  const q = fold(String(query || '').trim());
  if (q.length < 2 || !bible) return [];
  const hits = [];
  bible.books.forEach((b, bookIdx) => {
    if (hits.length >= limit) return;
    b.c.forEach((ch, ci) => {
      if (hits.length >= limit) return;
      ch.forEach((text, vi) => {
        if (hits.length < limit && text && fold(text).includes(q)) {
          hits.push({ bookIdx, chapter: ci + 1, verse: vi + 1, text });
        }
      });
    });
  });
  return hits;
}
