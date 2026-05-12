// services/syncWorker.js
// ─────────────────────────────────────────────────────────────────────────────
// Drains the teacher's offline AsyncStorage queue (built by teacherLocal.js)
// to the server's POST /api/teacher/sync endpoint.
//
// Three trigger points:
//   • App boot — see useSyncOnAppBoot() hook below
//   • Network change online — listens to NetInfo
//   • Manual — call syncNow() from a "Sync now" button
//
// All three converge on the same `syncNow()` function. It's idempotent and
// short-circuits if nothing is pending or if the device is offline.
// ─────────────────────────────────────────────────────────────────────────────

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from './api';
import { buildSyncBatch, markBatchSynced, pendingSyncCount } from './teacherLocal';

const SYNC_TIMEOUT_MS  = 30_000;
const LAST_SYNC_KEY    = 'teach_last_sync_at';
const SYNC_LOCK_KEY    = 'teach_sync_in_progress';

let lastNetState = { isConnected: null };

// Quick online check that doesn't trust stale NetInfo state.
async function isOnline() {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable !== false);
}

// In-process lock so two simultaneous triggers (e.g. boot + focus firing
// within ms) don't run two syncs and create dupes.
let syncing = false;

// Returns: { ok: true, sent: {...}, lastSyncAt }
//        | { ok: false, reason: 'offline' | 'no-data' | 'no-teacher-email' | 'http-XXX' | <error msg> }
export async function syncNow({ force = false } = {}) {
  if (syncing && !force) return { ok: false, reason: 'already-running' };
  syncing = true;
  try {
    const teacherEmail = await AsyncStorage.getItem('userEmail');
    if (!teacherEmail) return { ok: false, reason: 'no-teacher-email' };

    if (!(await isOnline())) return { ok: false, reason: 'offline' };

    const batch = await buildSyncBatch();
    if (!batch) return { ok: false, reason: 'no-data' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${API_BASE_URL}/api/teacher/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_email: teacherEmail, ...batch }),
        signal: controller.signal,
      });
    } finally { clearTimeout(timer); }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      // Pass through the server's `code` (no_account / not_a_teacher / no_church)
      // so the UI can show a targeted next-step instead of a raw "http-404".
      return {
        ok: false,
        status: res.status,
        code: errBody.code || null,
        message: errBody.error || res.statusText,
        reason: errBody.code || `http-${res.status}: ${errBody.error || res.statusText}`,
      };
    }

    const data = await res.json();
    // Server returns { mappings: { students: { localId: email } } } so we can
    // remember server-assigned synthetic emails and stop sending the local id.
    await markBatchSynced({ studentMappings: data?.mappings?.students || {} });
    const stamp = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNC_KEY, stamp);

    return { ok: true, sent: data.counts || {}, lastSyncAt: stamp };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : (e.message || String(e)) };
  } finally {
    syncing = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook — call from the teacher's root screen (TeacherDashboard).
// Handles three triggers + exposes pendingCount for the badge UI.
// ─────────────────────────────────────────────────────────────────────────────
export function useTeacherSync() {
  const [pending, setPending] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const refreshPending = async () => {
    setPending(await pendingSyncCount());
    setLastSyncAt(await AsyncStorage.getItem(LAST_SYNC_KEY));
  };

  // Fire sync + refresh badge afterwards
  const runSync = async (opts) => {
    const result = await syncNow(opts);
    setLastResult(result);
    await refreshPending();
    return result;
  };

  useEffect(() => {
    refreshPending();
    runSync();      // best-effort attempt on mount

    // Re-run whenever the device comes back online.
    const unsub = NetInfo.addEventListener(state => {
      const wasOffline = lastNetState.isConnected === false;
      const nowOnline  = state.isConnected && state.isInternetReachable !== false;
      lastNetState = state;
      if (wasOffline && nowOnline) runSync();
    });
    return () => unsub();
  }, []);

  return { pending, lastResult, lastSyncAt, syncNow: runSync, refreshPending };
}
