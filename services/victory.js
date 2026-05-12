// services/victory.js
// ─────────────────────────────────────────────────────────────────────────────
// Victory Month Prayer — data service.
//
// Every Victory Month screen used to import VICTORY_DAYS / VICTORY_VIGILS /
// VICTORY_META directly from `frontend/data/victoryMonth.js`. That file is now
// the *bundled fallback* — the live source of truth is the backend (`books`
// and `book_entries` tables), edited via the admin dashboard at
// `maindashboard/src/pages/victory/*`.
//
// Fetch strategy: cache-first.
//   • Cached payload returns instantly; revalidates in the background.
//   • Cache miss → real network call.
//   • Network failure with no cache → bundled fallback so the screens never
//     render an empty Prayer book even on a cold offline launch.
//
// The DB stores columns named `entry_number / focus / scripture_text /
// inspirational_message / prayer_points / special_intercession /
// discussion_questions`. The screens were written against the bundled shape
// `day / focus / scripture / message / prayer_points / intercession /
// discussion`. The mappers below translate so we don't have to touch every
// screen's render code.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import { API_BASE_URL } from './api';
import { cacheFirst }   from './cache';
import {
  VICTORY_META    as BUNDLED_META,
  VICTORY_DAYS    as BUNDLED_DAYS,
  VICTORY_VIGILS  as BUNDLED_VIGILS,
} from '../data/victoryMonth';

// Slug used in the backend `books.slug` column. Frontend code referring to the
// book elsewhere uses `victory_month_prayer` (underscore form); the database
// convention is kebab-case (matching `sunday-school`).
export const VICTORY_BOOK_SLUG = 'victory-month-prayer';

// Vigil entry_types stored in the DB. Anything not in this set is treated as a
// day. Matches the comment in backend/server.js (book_entries CREATE TABLE).
const VIGIL_TYPES = new Set([
  'family_vigil', 'youth_vigil', 'women_vigil', 'men_vigil', 'general_vigil',
]);

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── DB row → frontend shape mappers ─────────────────────────────────────────
// Kept tiny + pure so the screens render identically whether the row came
// from /api/books/.../entries or the bundled fallback array.
const mapDay = (row) => ({
  day:           Number(row.entry_number),
  date:          row.entry_date ? String(row.entry_date).slice(0, 10) : null,
  focus:         row.focus || '',
  scripture:     row.scripture_text || '',
  message:       row.inspirational_message || '',
  prayer_points: Array.isArray(row.prayer_points) ? row.prayer_points : [],
  intercession:  row.special_intercession || '',
  published:     row.published !== false,
});

// Vigil group + slug derive from entry_type ('family_vigil' → 'Family',
// 'family-1' id). Vigils don't share entry_numbers with days, but multiple
// "Family" vigils do share entry_type — they're distinguished by
// entry_number, which is what the bundled data uses for ordering (1/2/3).
const VIGIL_GROUP_BY_TYPE = {
  family_vigil:  'Family',
  youth_vigil:   'Youth',
  women_vigil:   'Women',
  men_vigil:     'Men',
  general_vigil: 'General',
};
const vigilIdFor = (type, n) => {
  const group = (VIGIL_GROUP_BY_TYPE[type] || 'general').toLowerCase();
  return group === 'family' ? `family-${n}` : group;
};
const mapVigil = (row) => ({
  id:            vigilIdFor(row.entry_type, row.entry_number),
  group:         VIGIL_GROUP_BY_TYPE[row.entry_type] || 'General',
  entry_number:  Number(row.entry_number),
  date:          row.entry_date ? String(row.entry_date).slice(0, 10) : null,
  focus:         row.focus || '',
  scripture:     row.scripture_text || '',
  message:       row.inspirational_message || '',
  discussion:    Array.isArray(row.discussion_questions) ? row.discussion_questions : [],
  prayer_points: Array.isArray(row.prayer_points) ? row.prayer_points : [],
  published:     row.published !== false,
});

const mapMeta = (book) => ({
  // Mirror the bundled VICTORY_META shape. `theme` / `window` / `year` aren't
  // first-class columns on the books table — we tuck them into `description`
  // as a JSON blob when present, falling back to whatever copy is there.
  year:         BUNDLED_META.year,   // bundled wins until an admin-edit feature lands
  theme:        book?.subtitle || BUNDLED_META.theme,
  window:       BUNDLED_META.window,
  organisation: BUNDLED_META.organisation,
  pages:        BUNDLED_META.pages,
  // Pass through everything else verbatim so callers can read e.g. accent_color.
  ...book,
});

// ── Fetchers ────────────────────────────────────────────────────────────────
// All three use cacheFirst() so a returning user sees the last-known content
// instantly. The fetcher inside catches network errors and rethrows so
// cacheFirst can serve the cached value (or bundled fallback below) instead
// of bubbling a 500 up to the screen.

export const fetchVictoryMeta = async () =>
  cacheFirst('victory:meta', async () => {
    try {
      const { data } = await client.get(`/api/books/${VICTORY_BOOK_SLUG}`);
      return mapMeta(data);
    } catch {
      return mapMeta(null);
    }
  });

// Returns the full list of 30 days in entry_number order. Backend response is
// the lightweight projection (no message / prayer_points / intercession) so a
// second fetch is required to render a single day in full. That's intentional
// — keeps the list endpoint fast on slow networks.
export const fetchVictoryDays = async () =>
  cacheFirst('victory:days', async () => {
    try {
      const { data } = await client.get(`/api/books/${VICTORY_BOOK_SLUG}/entries`);
      const rows = Array.isArray(data?.entries) ? data.entries : [];
      const days = rows
        .filter((r) => !VIGIL_TYPES.has(r.entry_type))
        .map(mapDay)
        .sort((a, b) => a.day - b.day);
      // If the table is empty (admin hasn't seeded yet) fall through to the
      // bundled list — the user should never see an empty Prayer book.
      return days.length ? days : BUNDLED_DAYS;
    } catch {
      return BUNDLED_DAYS;
    }
  });

export const fetchVictoryVigils = async () =>
  cacheFirst('victory:vigils', async () => {
    try {
      const { data } = await client.get(`/api/books/${VICTORY_BOOK_SLUG}/entries`);
      const rows = Array.isArray(data?.entries) ? data.entries : [];
      const vigils = rows
        .filter((r) => VIGIL_TYPES.has(r.entry_type))
        .map(mapVigil)
        .sort((a, b) => a.entry_number - b.entry_number);
      return vigils.length ? vigils : BUNDLED_VIGILS;
    } catch {
      return BUNDLED_VIGILS;
    }
  });

// Single day, full body. Used by VictoryDayScreen which needs message + prayer
// points + intercession. Falls back to the bundled record for that day on
// failure so the per-day view always has something to render.
export const fetchVictoryDay = async (n) =>
  cacheFirst(`victory:day:${n}`, async () => {
    try {
      const { data } = await client.get(
        `/api/books/${VICTORY_BOOK_SLUG}/entries/${n}`,
        { params: { type: 'daily' } },
      );
      return mapDay(data);
    } catch {
      const idx = Math.max(1, Math.min(BUNDLED_DAYS.length, Number(n) || 1)) - 1;
      return BUNDLED_DAYS[idx] || mapDay({ entry_number: n });
    }
  });

// Single vigil. Reverses the `vigilIdFor` derivation so callers can pass the
// frontend id ('family-1', 'youth', etc.) and we resolve the backend entry.
export const fetchVictoryVigil = async (id) =>
  cacheFirst(`victory:vigil:${id}`, async () => {
    try {
      const all = await fetchVictoryVigils();
      return all.find((v) => v.id === id) || null;
    } catch {
      return BUNDLED_VIGILS.find((v) => v.id === id) || null;
    }
  });
