// services/reading.js
// ─────────────────────────────────────────────────────────────────────────────
// Daily Reading Tracker + Gamification helpers.
// Talks to the four backend endpoints added in backend/server.js:
//   POST /api/reading/check-in           — idempotent per (email, today)
//   GET  /api/reading/stats/:email       — full snapshot for the Stats screen
//   GET  /api/reading/calendar/:email    — heatmap series
//   GET  /api/reading/leaderboard        — top-20 by xp / streak
//
// GETs use cacheFirst so the Stats screen renders instantly offline and
// background-revalidates on every visit. The check-in POST is never cached
// (server-side idempotency handles same-day double-fires).
// ─────────────────────────────────────────────────────────────────────────────

import client, { API_BASE_URL } from './api';
import { cacheFirst, cacheRemove } from './cache';

const KEY = {
  stats:       (email)        => `reading:stats:${email}`,
  calendar:    (email, days)  => `reading:cal:${email}:${days}`,
  leaderboard: (scope, days)  => `reading:lb:${scope}:${days}`,
};

/**
 * POST /api/reading/check-in
 * payload = { source_type?: 'lesson'|'devotional'|'manual', lesson_id?, duration_seconds? }
 * Returns: { already_checked_in, current_streak, longest_streak, lifetime_xp,
 *            level, level_progress_pct, new_badges: [...] }
 *
 * Side-effect: bust the cached stats/calendar for this user so the next
 * Stats-screen render shows the new streak/XP without waiting for the
 * background revalidation.
 */
export async function submitReadingCheckIn(email, payload = {}) {
  if (!email) throw new Error('email is required');
  const body = {
    email,
    source_type:      payload.source_type || 'manual',
    lesson_id:        payload.lesson_id ?? null,
    duration_seconds: Math.max(0, Math.round(payload.duration_seconds || 0)),
  };
  const { data } = await client.post('/api/reading/check-in', body);

  // Invalidate the cached snapshot so the next read returns fresh data.
  cacheRemove(KEY.stats(email)).catch(() => {});
  cacheRemove(KEY.calendar(email, 30)).catch(() => {});
  cacheRemove(KEY.calendar(email, 35)).catch(() => {});

  return data;
}

/**
 * Fire-and-forget variant for the auto check-in path. Never throws — UI
 * never sees a failure if the network is down. Returns the response (or
 * null on error) so callers that *want* the new_badges array can opt in.
 */
export async function silentReadingCheckIn(email, payload = {}) {
  try {
    return await submitReadingCheckIn(email, payload);
  } catch {
    return null;
  }
}

/** GET /api/reading/stats/:email — cacheFirst for instant render. */
export async function fetchReadingStats(email) {
  if (!email) throw new Error('email is required');
  return cacheFirst(KEY.stats(email), async () => {
    const { data } = await client.get(`/api/reading/stats/${encodeURIComponent(email)}`);
    return data;
  });
}

/** GET /api/reading/calendar/:email?days=N — heatmap data. */
export async function fetchReadingCalendar(email, days = 35) {
  if (!email) throw new Error('email is required');
  const n = Math.max(1, Math.min(365, Number(days) || 35));
  return cacheFirst(KEY.calendar(email, n), async () => {
    const { data } = await client.get(
      `/api/reading/calendar/${encodeURIComponent(email)}`,
      { params: { days: n } },
    );
    return data;
  });
}

/** GET /api/reading/leaderboard?scope=global|church&days=7|30|all */
export async function fetchReadingLeaderboard(scope = 'global', days = 'all', churchKey) {
  const sc = scope === 'church' ? 'church' : 'global';
  const dy = ['7', '30', 'all'].includes(String(days)) ? String(days) : 'all';
  return cacheFirst(KEY.leaderboard(sc, dy), async () => {
    const { data } = await client.get('/api/reading/leaderboard', {
      params:  { scope: sc, days: dy },
      headers: churchKey ? { 'x-church-key': churchKey } : undefined,
    });
    return data;
  });
}

// Re-export the base URL for callers that want to construct their own
// avatars / share links from the same host.
export { API_BASE_URL };
