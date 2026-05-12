// services/cache.js
// ─────────────────────────────────────────────────────────────────────────────
// Local content cache for offline use.
//
// Strategy: NETWORK-FIRST.
//   • When online, every wrapped fetch hits the server and overwrites the cache.
//     Users see the freshest data, exactly as before.
//   • When the network fails (offline / server down / timeout), the wrapped
//     fetch returns the most recent cached payload instead of throwing.
//   • If there is no cache AND the network fails, the original error is thrown
//     so screens can render their existing error states.
//
// Cache keys are namespaced with `cache_v1:` so we can bump the prefix to
// invalidate everything if the schema of cached payloads ever changes.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'cache_v1:';

const k = (key) => KEY_PREFIX + key;

// ── Low-level cache I/O ─────────────────────────────────────────────────────
export async function cacheGet(key) {
  try {
    const raw = await AsyncStorage.getItem(k(key));
    if (!raw) return null;
    return JSON.parse(raw); // { ts, data }
  } catch {
    return null;
  }
}

export async function cacheSet(key, data) {
  try {
    await AsyncStorage.setItem(k(key), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Storage full / serialization failure — silent (cache is best-effort).
  }
}

export async function cacheRemove(key) {
  try { await AsyncStorage.removeItem(k(key)); } catch {}
}

// Clear every cache_v1: key. Used by the "Clear offline data" button.
export async function cacheClear() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((x) => x.startsWith(KEY_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {}
}

// Stats for the offline-storage UI: how many items, total bytes, last sync.
export async function cacheStats() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((x) => x.startsWith(KEY_PREFIX));
    if (!ours.length) return { count: 0, bytes: 0, latestTs: null };
    const pairs = await AsyncStorage.multiGet(ours);
    let bytes = 0;
    let latestTs = null;
    for (const [, v] of pairs) {
      if (!v) continue;
      bytes += v.length;
      try {
        const parsed = JSON.parse(v);
        if (parsed?.ts && (!latestTs || parsed.ts > latestTs)) latestTs = parsed.ts;
      } catch {}
    }
    return { count: ours.length, bytes, latestTs };
  } catch {
    return { count: 0, bytes: 0, latestTs: null };
  }
}

// ── Cache-first / stale-while-revalidate ─────────────────────────────────────
/**
 * If the cache has a value, return it IMMEDIATELY and revalidate in the
 * background (fire-and-forget). The caller's `await` resolves on the next
 * microtask — no network round-trip on the critical path.
 *
 * If the cache is empty, fall back to network-first behaviour: hit the
 * server, write to cache, return fresh. On network error with no cache,
 * the error is rethrown so the screen can show its empty/error state.
 *
 * Net effect: every screen renders cached data instantly (online or offline);
 * the next render after a sync picks up newer data automatically.
 *
 * @param {string}   key      Cache key. Must be stable for the same logical query.
 * @param {Function} fetcher  Async function that returns the payload.
 * @returns {Promise<any>}    Cached payload (instant) or fresh payload (cache miss).
 */
export async function cacheFirst(key, fetcher) {
  const cached = await cacheGet(key);

  if (cached && cached.data !== undefined) {
    // Background revalidation — never blocks the caller.
    fetcher()
      .then((fresh) => cacheSet(key, fresh))
      .catch(() => { /* silent: keep serving cached data */ });
    return cached.data;
  }

  // Cold cache — fall back to a real network call.
  try {
    const fresh = await fetcher();
    cacheSet(key, fresh);
    return fresh;
  } catch (err) {
    throw err;
  }
}

/**
 * Strict network-first (kept for the rare case where freshness matters more
 * than instant render — e.g. payment verification). Most screens should use
 * cacheFirst instead.
 */
export async function networkFirst(key, fetcher) {
  try {
    const fresh = await fetcher();
    cacheSet(key, fresh);
    return fresh;
  } catch (err) {
    const cached = await cacheGet(key);
    if (cached) return cached.data;
    throw err;
  }
}

/**
 * Cache-only read — never hits the network. Returns the cached payload or
 * null if nothing is cached. Useful for prefetch progress UI and tests.
 */
export async function cacheOnly(key) {
  const c = await cacheGet(key);
  return c ? c.data : null;
}
