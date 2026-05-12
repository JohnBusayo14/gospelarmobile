// screen/victory/victoryHooks.js
// ─────────────────────────────────────────────────────────────────────────────
// React hooks that wrap the async store. Components stay declarative — they
// don't await; the hooks publish state and let the store fire change events.
//
// Hooks exposed:
//   useStoreSlice(loader, deps)  — generic; loader is an async fn returning data
//   useCompleted()               — completion map + setter
//   useDayNote(dayNum)           — note for a day + save fn
//   useCustomPoints(dayNum)      — custom prayer points for a day + helpers
//   useFasts() / useActiveFast() — fasting list and active fast
//   useFastingCountdown(fast)    — live "Xh Ym left" string
//   useReminders()               — reminders list + helpers
//   useAchievementsHook()        — { unlocked, recompute }
//   useCategoryPrayers(catId)    — user prayers per category
//   useAudioSettings()           — ambient + voice settings
//   useTTS(text)                 — soft fallback for text-to-speech (no-op if
//                                  expo-speech isn't installed; ui still renders)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Store from './victoryStore';
import { recomputeAchievements } from './victoryAchievements';

// ── Generic re-fetcher tied to the store's change event ─────────────────────
export const useStoreSlice = (loader, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const v = await loader();
    if (mounted.current) { setData(v); setLoading(false); }
  }, deps);  // eslint-disable-line

  useEffect(() => {
    reload();
    const sub = Store.onStoreChange(() => reload());
    return () => sub?.remove?.();
  }, [reload]);

  return [data, reload, loading];
};

// ── Completion ──────────────────────────────────────────────────────────────
export const useCompleted = () => {
  const [map, reload] = useStoreSlice(Store.getCompleted);
  const toggle = useCallback(async (dayNum) => {
    const cur = (map || {})[dayNum];
    await Store.setCompleted(dayNum, !cur);
    await recomputeAchievements();
    await reload();
  }, [map, reload]);
  return { map: map || {}, toggle, reload };
};

// ── Day notes ───────────────────────────────────────────────────────────────
export const useDayNote = (dayNum) => {
  const [note, reload] = useStoreSlice(() => Store.getDayNote(dayNum), [dayNum]);
  const save = useCallback(async (patch) => {
    await Store.saveDayNote(dayNum, patch);
    await recomputeAchievements();
    await reload();
  }, [dayNum, reload]);
  return { note: note || { reflection: '', testimony: '', note: '' }, save };
};

// ── Custom prayer points ────────────────────────────────────────────────────
export const useCustomPoints = (dayNum) => {
  const [list, reload] = useStoreSlice(() => Store.getDayCustomPoints(dayNum), [dayNum]);
  const add = useCallback(async (text) => {
    await Store.addCustomPoint(dayNum, text);
    await recomputeAchievements();
    await reload();
  }, [dayNum, reload]);
  const update = useCallback(async (id, patch) => {
    await Store.updateCustomPoint(dayNum, id, patch);
    await reload();
  }, [dayNum, reload]);
  const remove = useCallback(async (id) => {
    await Store.removeCustomPoint(dayNum, id);
    await reload();
  }, [dayNum, reload]);
  return { list: list || [], add, update, remove };
};

// ── Fasts ───────────────────────────────────────────────────────────────────
export const useFasts = () => {
  const [list, reload] = useStoreSlice(Store.getFasts);
  return {
    list: list || [],
    add:    async (f) => { await Store.addFast(f);  await recomputeAchievements(); await reload(); },
    update: async (id, patch) => { await Store.updateFast(id, patch); await recomputeAchievements(); await reload(); },
    remove: async (id) => { await Store.removeFast(id); await reload(); },
  };
};

export const useActiveFast = () => {
  const [fast, reload] = useStoreSlice(Store.getActiveFast);
  return { fast, reload };
};

// Live "Xh Ym Zs left" string updated every second.
export const useFastingCountdown = (fast) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!fast) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [fast]);
  if (!fast) return null;
  const start = new Date(fast.startISO).getTime();
  const end   = new Date(fast.endISO).getTime();
  const total = Math.max(1, end - start);
  const elapsed = Math.min(now - start, total);
  const remain  = Math.max(0, end - now);
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  return {
    remainMs:  remain,
    remainStr: formatRemain(remain),
    elapsedStr:formatRemain(elapsed),
    pct,
    done: remain === 0,
  };
};

const formatRemain = (ms) => {
  if (ms <= 0) return '0h 0m';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
};

// ── Reminders ───────────────────────────────────────────────────────────────
export const useReminders = () => {
  const [list, reload] = useStoreSlice(Store.getReminders);
  return {
    list: list || [],
    add:    async (r) => { await Store.addReminder(r); await reload(); },
    update: async (id, patch) => { await Store.updateReminder(id, patch); await reload(); },
    remove: async (id) => { await Store.removeReminder(id); await reload(); },
  };
};

// ── Achievements ────────────────────────────────────────────────────────────
export const useAchievementsHook = () => {
  const [map, reload] = useStoreSlice(Store.getAchievements);
  const recompute = useCallback(async () => {
    const newly = await recomputeAchievements();
    await reload();
    return newly;
  }, [reload]);
  return { unlocked: map || {}, recompute };
};

// ── Category prayers ────────────────────────────────────────────────────────
export const useCategoryPrayers = (catId) => {
  const [list, reload] = useStoreSlice(() => Store.getCategoryList(catId), [catId]);
  return {
    list: list || [],
    add:    async (p) => { await Store.addCategoryPrayer(catId, p);  await reload(); },
    update: async (id, patch) => { await Store.updateCategoryPrayer(catId, id, patch); await reload(); },
    remove: async (id) => { await Store.removeCategoryPrayer(catId, id); await reload(); },
  };
};

// ── Audio settings ──────────────────────────────────────────────────────────
export const useAudioSettings = () => {
  const [s, reload] = useStoreSlice(Store.getAudioSettings);
  return {
    settings: s || { ambient: 'piano', rate: 0.95, pitch: 1.0, volume: 0.8 },
    save: async (patch) => { await Store.saveAudioSettings(patch); await reload(); },
  };
};

// ── User-created prayer rooms ──────────────────────────────────────────────
export const useUserRooms = () => {
  const [list, reload] = useStoreSlice(Store.getUserRooms);
  return {
    list: list || [],
    add:    async (r) => { const x = await Store.addUserRoom(r);  await reload(); return x; },
    update: async (id, patch) => { await Store.updateUserRoom(id, patch); await reload(); },
    remove: async (id) => { await Store.removeUserRoom(id); await reload(); },
  };
};

// ── Text-to-speech ─────────────────────────────────────────────────────────
// Re-exported from the shared `hooks/useTTS.js` module so both Victory and
// the Sunday-School devotional reader use the same voice-resolution logic.
// The hook itself, plus `getVoiceCatalogue`, lives there now.
export { useTTS, getVoiceCatalogue } from '../../hooks/useTTS';

// Legacy guard kept here so the rest of this file still loads in environments
// without expo-speech installed — none of the code below uses _speech now,
// but leaving the soft-require avoids triggering the package warning in any
// stray require sites that haven't been swept yet.
let _speech = null;
try { _speech = require('expo-speech'); } catch { /* package not installed */ }

// (Helper functions, voice catalogue, and `useTTS` implementation now live
// in `frontend/hooks/useTTS.js`. The re-export above keeps the existing
// `import { useTTS, getVoiceCatalogue } from './victoryHooks'` call sites
// working without modification.)
