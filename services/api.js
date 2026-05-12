// services/api.js
// ─────────────────────────────────────────────────────────────────────────────
// Central API service. Every screen imports from here — never from axios directly.
// Change API_BASE_URL once and all screens update automatically.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import { cacheFirst } from './cache';

// Configurable per-environment via Expo's EXPO_PUBLIC_* env-var convention.
// Set EXPO_PUBLIC_API_BASE_URL in frontend/.env (or your CI/EAS env) to point
// at a different host. Default is the production backend on the custom
// gospelar.com domain (CNAME → Railway). The Railway-generated host stays
// reachable but the custom domain insulates the app from any future migration.
export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.gospelar.com')
    .replace(/\/$/, '');

// Render's free plan spins the dyno down after 15 min of inactivity, so the
// first request can take 30–60s while it cold-starts. Default to a generous
// 60s timeout for normal calls and 90s for payment verification (Paystack +
// our DB write can stack on top of the cold start).
export const REQUEST_TIMEOUT_MS = 60_000;
export const PAYMENT_TIMEOUT_MS = 90_000;

console.log('[API] Using base URL:', API_BASE_URL);

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ── Generic error normaliser ──────────────────────────────────────────────────
const toError = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  'An unexpected error occurred.';

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE & TRANSLATION ENDPOINTS  ← NEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/languages
 * Returns all active languages: [{ code, label, native_label, flag }]
 *
 * Cached. Online → fresh from server, cache updated. Offline → last cached value.
 */
export const fetchLanguages = async () =>
  cacheFirst('languages', async () => {
    const { data } = await client.get('/api/languages');
    return data;
  });

/**
 * GET /api/translations/:langCode
 * Returns all UI strings for a language as a flat { key: value } object.
 * Falls back to English on the server if the language doesn't exist.
 *
 * Cached per language so the app keeps showing translated text offline.
 */
export const fetchTranslations = async (lang = 'en') =>
  cacheFirst(`translations:${lang}`, async () => {
    const { data } = await client.get(`/api/translations/${lang}`);
    return data; // { lang, translations: { key: value }, count }
  });

/**
 * GET /api/category-language/:categoryId
 * Returns which language a category uses.
 * e.g. fetchCategoryLanguage('adult_yoruba') → { categoryId, langCode: 'yo' }
 */
export const fetchCategoryLanguage = async (categoryId) =>
  cacheFirst(`cat-lang:${categoryId}`, async () => {
    const { data } = await client.get(`/api/category-language/${categoryId}`);
    return data;
  });

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT ENDPOINTS  ← lang param added to all three
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lessons/preview?category=adult&lang=en&limit=4
 * Returns the first N lessons for an age-group category in a given language.
 * Used by the Homescreen preview cards section.
 */
// GET /api/lessons/preview?lang=en&limit=4
// Returns first N lessons with translated titles.
// Category does not filter lessons — it controls which age-group section
// LessonPage will display (passed via navigation params).
export const fetchPreviewLessons = async (lang = 'en', limit = 4, category = 'adult') =>
  cacheFirst(`preview:${category}:${lang}:${limit}`, async () => {
    const { data } = await client.get('/api/lessons/preview', {
      params: { lang, limit, category },
    });
    return data; // [{ id, lessonNumber, title, scripture }]
  });

/**
 * GET /api/units?lang=en
 * Returns all units ordered by sort_order.
 * lang is accepted but unit titles/descriptions are stored directly on the row,
 * so the server returns them as-is (Yoruba unit titles would require unit_translations).
 */
export const fetchUnits = async (lang = 'en', category = 'adult') =>
  cacheFirst(`units:${category}:${lang}`, async () => {
    const { data } = await client.get('/api/units', { params: { lang, category } });
    return data; // [{ id, title, description, lesson_range, color, sort_order }]
  });

/**
 * GET /api/units/:unitId/lessons?lang=en
 * Returns all lessons for a unit in the requested language.
 * Server uses COALESCE(lesson_translations.field, lessons.field) so
 * Yoruba text is returned automatically when lang='yo'.
 */
export const fetchLessonsByUnit = async (unitId, lang = 'en') =>
  cacheFirst(`unit-lessons:${unitId}:${lang}`, async () => {
    const { data } = await client.get(`/api/units/${unitId}/lessons`, { params: { lang } });
    return data; // array of lesson rows with translated fields
  });

/**
 * GET /api/lessons/:id?lang=en
 * Fetch a lesson by its DB primary-key id (the most reliable method).
 * LessonPage uses this when re-fetching on language change.
 */
export const fetchLessonById = async (id, lang = 'en') =>
  cacheFirst(`lesson:${id}:${lang}`, async () => {
    const { data } = await client.get(`/api/lessons/${id}`, { params: { lang } });
    return data;
  });

/**
 * GET /api/lessons/by-number/:number?category=adult&lang=en
 * Fetch a lesson by lesson_number + category (category-aware, safe with new schema).
 * Falls back to fetchLessonById when possible.
 */
export const fetchLessonByNumber = async (lessonNumber, lang = 'en', category = 'adult') =>
  cacheFirst(`lesson-num:${lessonNumber}:${category}:${lang}`, async () => {
    const { data } = await client.get(`/api/lessons/by-number/${lessonNumber}`, {
      params: { lang, category },
    });
    return data;
  });

// ─────────────────────────────────────────────────────────────────────────────
// HYMN ENDPOINTS (cached for offline)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/hymns/:number — fetch a single hymn by GHB number.
 */
export const fetchHymn = async (number) =>
  cacheFirst(`hymn:${number}`, async () => {
    const { data } = await client.get(`/api/hymns/${number}`);
    return data;
  });

/**
 * GET /api/hymns?numbers=75,433 — fetch multiple hymns at once.
 * Returns an array in DB order (caller should map back to requested order).
 */
export const fetchHymns = async (numbers) => {
  const nums = (Array.isArray(numbers) ? numbers : []).filter((n) => n).map(Number);
  if (!nums.length) return [];
  const sorted = [...nums].sort((a, b) => a - b);
  return cacheFirst(`hymns:${sorted.join(',')}`, async () => {
    const { data } = await client.get('/api/hymns', { params: { numbers: nums.join(',') } });
    return data;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ ENDPOINTS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/quiz/:lessonId
 * Returns quiz questions for a lesson (by DB primary-key id, not lesson_number).
 *
 * Cached so quizzes work offline once a lesson has been opened (or after the
 * background contentSync pre-warms every lesson's quiz).
 */
export const fetchQuiz = async (lessonId) =>
  cacheFirst(`quiz:${lessonId}`, async () => {
    const { data } = await client.get(`/api/quiz/${lessonId}`);
    return data; // [{ id, lesson_id, question, options, correct_answer, points }]
  });

/**
 * POST /api/quiz/submit
 * Body: { email, lessonId, score }
 */
export const submitQuizScore = async (email, lessonId, score) => {
  const { data } = await client.post('/api/quiz/submit', { email, lessonId, score });
  return data;
};

/**
 * GET /api/leaderboard
 * Returns top-10 { email, total_points }.
 */
export const fetchLeaderboard = async () => {
  const { data } = await client.get('/api/leaderboard');
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION ENDPOINTS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/check-status/:email
 */
export const checkSubscriptionStatus = async (email) => {
  const { data } = await client.get(`/api/check-status/${encodeURIComponent(email)}`);
  return data; // { canAccess, expiryDate, daysLeft }
};

/**
 * POST /api/verify-payment
 * Body: { reference, email }
 */
export const verifyPayment = async (reference, email) => {
  const { data } = await client.post('/api/verify-payment', { reference, email });
  return data; // { status: 'success', data: subscriber }
};

// ─────────────────────────────────────────────────────────────────────────────
// LIBRARY — multi-book catalog + per-book daily entries
// All cacheFirst-wrapped so the Library renders instantly offline and
// background-revalidates on every visit. Sunday School (route_screen=
// 'HomeScreen') keeps its existing custom flow; every other book routes
// into the generic BookReaderScreen.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/books — list of available books for the Library.
 * Returns: [{ id, slug, title, subtitle, cover_image_url, cover_emoji,
 *             accent_color, route_screen, available, entries_count, … }]
 */
export const fetchBooks = async () =>
  networkFirst('books:list', async () => {
    const { data } = await client.get('/api/books');
    return Array.isArray(data) ? data : [];
  });

/** GET /api/books/:slug — single book metadata. */
export const fetchBook = async (slug) =>
  networkFirst(`book:${slug}`, async () => {
    const { data } = await client.get(`/api/books/${encodeURIComponent(slug)}`);
    return data;
  });

/** GET /api/books/:slug/entries — list of entries (lightweight, for the day picker). */
export const fetchBookEntries = async (slug) =>
  networkFirst(`book:${slug}:entries`, async () => {
    const { data } = await client.get(`/api/books/${encodeURIComponent(slug)}/entries`);
    return data; // { slug, count, entries: [{ id, entry_number, entry_type, focus, ... }] }
  });

/** GET /api/books/:slug/entries/:n?type=daily — full content of one entry. */
export const fetchBookEntry = async (slug, n, type = 'daily') =>
  networkFirst(`book:${slug}:entry:${type}:${n}`, async () => {
    const { data } = await client.get(
      `/api/books/${encodeURIComponent(slug)}/entries/${encodeURIComponent(n)}`,
      { params: { type } },
    );
    return data;
  });

export default client;