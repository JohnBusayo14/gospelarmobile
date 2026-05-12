// services/contentSync.js
// ─────────────────────────────────────────────────────────────────────────────
// Auto-prefetches all app content into AsyncStorage so every screen works
// offline. Mirrors syncWorker.js (which handles outbound teacher data).
//
// Three trigger points:
//   • App mount (best-effort) — see useContentSync()
//   • Network change offline → online (NetInfo listener)
//   • Manual call to runContentSync({ force: true }) from a Settings button
//
// Throttle: a successful sync stamps `content_sync_last_at`. Subsequent
// triggers within THROTTLE_MS are short-circuited unless force=true. This
// keeps quick airplane-mode toggles or CDN flaps from re-downloading
// everything every minute.
// ─────────────────────────────────────────────────────────────────────────────
//
// Why both this AND networkFirst?
//   networkFirst caches WHATEVER the user happens to view. If a user opens the
//   app once on Wi-Fi and never browses Children content, Children lessons
//   stay un-cached. This service walks every endpoint up front so the cache
//   covers everything before the user ever hits airplane mode.
// ─────────────────────────────────────────────────────────────────────────────

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { prefetchAllForOffline } from './prefetch';

const LAST_KEY      = 'content_sync_last_at';
const THROTTLE_MS   = 30 * 60 * 1000;   // 30 minutes between auto-syncs

// In-process dedupe: if a sync is already running, return the same promise
// to subsequent callers instead of starting a second walk.
let inFlight = null;

async function isOnline() {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable !== false);
}

async function isThrottled() {
  const last = await AsyncStorage.getItem(LAST_KEY);
  if (!last) return false;
  const age = Date.now() - new Date(last).getTime();
  return age < THROTTLE_MS;
}

/**
 * Run the full content prefetch. Throttled by default; pass { force:true }
 * from a manual button to bypass. Resolves with one of:
 *   { ok: true,  downloaded, errors, lastSyncAt }
 *   { ok: false, reason: 'offline' | 'throttled' | <error message> }
 *
 * @param {Object}   opts
 * @param {boolean}  [opts.force=false]   Bypass throttle.
 * @param {string[]} [opts.langs]         Languages to cache (default: all four).
 * @param {Function} [opts.onProgress]    Forwarded to prefetchAllForOffline.
 */
export async function runContentSync({ force = false, langs, onProgress } = {}) {
  if (inFlight) return inFlight;

  if (!(await isOnline()))             return { ok: false, reason: 'offline'    };
  if (!force && (await isThrottled())) return { ok: false, reason: 'throttled' };

  inFlight = (async () => {
    try {
      const result = await prefetchAllForOffline({ langs, onProgress });
      const stamp = new Date().toISOString();
      await AsyncStorage.setItem(LAST_KEY, stamp);
      return { ok: true, ...result, lastSyncAt: stamp };
    } catch (e) {
      return { ok: false, reason: e?.message || String(e) };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

// Expose the timestamp for UI ("Last synced 4 min ago"). Returns ISO string or null.
export async function getLastContentSyncAt() {
  return AsyncStorage.getItem(LAST_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook — drop into the root navigator. Handles boot + reconnect triggers.
// Returns { syncing, progress, lastSyncAt, runNow } so a status pill can read it.
// ─────────────────────────────────────────────────────────────────────────────
export function useContentSync() {
  const [syncing,    setSyncing]    = useState(false);
  const [progress,   setProgress]   = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  // Track previous NetInfo state outside React state — we only care about the
  // EDGE from offline → online, and we don't want re-renders for every flap.
  const lastConnectedRef = useRef(null);

  const refreshStamp = async () => {
    setLastSyncAt(await AsyncStorage.getItem(LAST_KEY));
  };

  const trigger = async (opts = {}) => {
    setSyncing(true);
    const result = await runContentSync({
      ...opts,
      onProgress: (p) => setProgress(p),
    });
    setSyncing(false);
    setProgress(null);
    await refreshStamp();
    return result;
  };

  useEffect(() => {
    refreshStamp();
    // Best-effort sync on mount. Throttle prevents thrash on every cold start
    // if the user just used the app a few minutes ago.
    trigger();

    const unsub = NetInfo.addEventListener((state) => {
      const wasOffline = lastConnectedRef.current === false;
      const nowOnline  = state.isConnected && state.isInternetReachable !== false;
      lastConnectedRef.current = state.isConnected;
      if (wasOffline && nowOnline) trigger();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    syncing,
    progress,
    lastSyncAt,
    runNow: (opts) => trigger({ force: true, ...opts }),
  };
}
