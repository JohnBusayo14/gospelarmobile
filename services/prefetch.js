// services/prefetch.js
// ─────────────────────────────────────────────────────────────────────────────
// "Download for offline" — explicitly walks every content endpoint and writes
// the results to AsyncStorage so the app works fully offline.
//
// Each call to a wrapped fetch* in api.js writes through to the same cache
// keys the app reads from at runtime, so once prefetch finishes, every screen
// served by those fetches will hit the cache when offline.
//
// Categories to fetch are fixed (the four age groups). Hymn numbers are
// extracted from the lessons we just downloaded, so we only cache hymns the
// user might actually open.
// ─────────────────────────────────────────────────────────────────────────────

import {
  fetchLanguages,
  fetchTranslations,
  fetchUnits,
  fetchLessonsByUnit,
  fetchLessonById,
  fetchPreviewLessons,
  fetchHymns,
  fetchQuiz,
} from './api';

const CATEGORIES = ['adult', 'youth', 'intermediate', 'children'];
const ALL_LANGS = ['en', 'yo', 'ig', 'ha'];

// Pull GHB numbers out of a "suggested_hymns" field like "MHB 720, MHB 481".
function extractHymnNumbers(text) {
  if (!text) return [];
  const out = [];
  const re = /\b(\d{1,4})\b/g;
  let m;
  while ((m = re.exec(String(text)))) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n < 10000) out.push(n);
  }
  return out;
}

/**
 * Download everything needed for offline use of the four age-group categories
 * in the chosen languages. Reports incremental progress.
 *
 * @param {Object}   opts
 * @param {string[]} [opts.langs]      Languages to cache. Defaults to all four.
 * @param {Function} [opts.onProgress] Called as ({ done, total, label }) on each step.
 * @param {AbortSignal} [opts.signal]  Optional abort signal to cancel mid-flight.
 *
 * @returns {Promise<{ ok: boolean, downloaded: number, errors: number }>}
 */
export async function prefetchAllForOffline({ langs, onProgress, signal } = {}) {
  const useLangs = (langs && langs.length ? langs : ALL_LANGS).filter((l) => ALL_LANGS.includes(l));

  // Build the work plan upfront so onProgress can report a meaningful total.
  // Steps:
  //   1 × languages list
  //   N × translations (one per lang)
  //   N × C × units (per lang × per category)         — populates per-unit cache
  //   N × C × preview lessons
  //   N × ?  unit-lessons (per unit, per lang)        — discovered after units
  //   N × ?  lesson-by-id (per lesson, per lang)      — discovered after unit-lessons
  //   1 × hymns batch                                 — discovered after lessons
  //
  // Phase 1 (the fixed work) is reported precisely; phase 2 (lessons) is
  // appended to the total as we discover units/lessons.

  let done = 0;
  let total = 1 + useLangs.length + useLangs.length * CATEGORIES.length * 2;
  let errors = 0;

  const tick = (label) => {
    done += 1;
    if (onProgress) onProgress({ done, total, label });
  };

  const checkAbort = () => {
    if (signal?.aborted) throw new Error('Prefetch cancelled');
  };

  // ── 1. Languages list ─────────────────────────────────────────────────────
  try { await fetchLanguages(); } catch { errors += 1; }
  tick('Languages');

  // ── 2. Translations per language ─────────────────────────────────────────
  for (const lang of useLangs) {
    checkAbort();
    try { await fetchTranslations(lang); } catch { errors += 1; }
    tick(`Translations · ${lang.toUpperCase()}`);
  }

  // ── 3. Units + preview lessons per (lang, category) ──────────────────────
  // Collected unit lists drive the next phase.
  const unitsByLangCat = {}; // unitsByLangCat[lang][cat] = [unit, …]
  for (const lang of useLangs) {
    unitsByLangCat[lang] = {};
    for (const cat of CATEGORIES) {
      checkAbort();
      try {
        const units = await fetchUnits(lang, cat);
        unitsByLangCat[lang][cat] = Array.isArray(units) ? units : [];
      } catch {
        errors += 1;
        unitsByLangCat[lang][cat] = [];
      }
      tick(`Units · ${cat} · ${lang.toUpperCase()}`);

      try { await fetchPreviewLessons(lang, 4, cat); } catch { errors += 1; }
      tick(`Preview · ${cat} · ${lang.toUpperCase()}`);
    }
  }

  // ── 4. Lessons per unit per language ─────────────────────────────────────
  // Add discovered work to the total so the progress bar stays accurate.
  const unitWork = useLangs.reduce((acc, lang) => {
    return acc + CATEGORIES.reduce((a, cat) => a + (unitsByLangCat[lang][cat]?.length || 0), 0);
  }, 0);
  total += unitWork;
  if (onProgress) onProgress({ done, total, label: 'Discovered units' });

  const allLessonIds = new Set();
  const hymnNumbers = new Set();

  for (const lang of useLangs) {
    for (const cat of CATEGORIES) {
      const units = unitsByLangCat[lang][cat];
      for (const u of units) {
        checkAbort();
        try {
          const lessons = await fetchLessonsByUnit(u.id, lang);
          if (Array.isArray(lessons)) {
            for (const ln of lessons) {
              if (ln?.id) allLessonIds.add(ln.id);
              extractHymnNumbers(ln?.suggested_hymns).forEach((n) => hymnNumbers.add(n));
            }
          }
        } catch { errors += 1; }
        tick(`Unit ${u.id} · ${lang.toUpperCase()}`);
      }
    }
  }

  // ── 5. Each lesson by id (full content) per language ─────────────────────
  const lessonWork = allLessonIds.size * useLangs.length;
  total += lessonWork;
  if (onProgress) onProgress({ done, total, label: `Discovered ${allLessonIds.size} lessons` });

  for (const id of allLessonIds) {
    for (const lang of useLangs) {
      checkAbort();
      try {
        const lesson = await fetchLessonById(id, lang);
        // Lesson detail also has suggested_hymns — collect more hymn numbers.
        extractHymnNumbers(lesson?.suggested_hymns).forEach((n) => hymnNumbers.add(n));
      } catch { errors += 1; }
      tick(`Lesson ${id} · ${lang.toUpperCase()}`);
    }
  }

  // ── 6. Quiz questions per lesson (one cache entry per lesson id) ─────────
  // Quizzes aren't language-scoped at the API level — one fetch per lesson.
  total += allLessonIds.size;
  if (onProgress) onProgress({ done, total, label: `Quizzes for ${allLessonIds.size} lessons` });

  for (const id of allLessonIds) {
    checkAbort();
    try { await fetchQuiz(id); } catch { errors += 1; }
    tick(`Quiz · lesson ${id}`);
  }

  // ── 7. Hymns referenced by any lesson ────────────────────────────────────
  if (hymnNumbers.size) {
    total += 1;
    try { await fetchHymns([...hymnNumbers]); } catch { errors += 1; }
    tick(`Hymns (${hymnNumbers.size})`);
  }

  return { ok: errors === 0, downloaded: done, errors };
}

// Friendly byte formatter for the offline-storage UI.
export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Friendly relative timestamp ("2 minutes ago", "yesterday", …).
export function formatLastSync(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day} days ago`;
  const date = new Date(ts);
  return date.toLocaleDateString();
}
