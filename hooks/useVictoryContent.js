// hooks/useVictoryContent.js
// ─────────────────────────────────────────────────────────────────────────────
// React hooks that wrap services/victory.js. The screens used to import
// VICTORY_DAYS / VICTORY_VIGILS / VICTORY_META as plain constants and assume
// they were available synchronously at render time. Now those values come
// from the backend, so we expose them as async hooks that:
//
//   • return the cached value INSTANTLY on the first render (cache-first
//     under the hood — the bundled file is the deepest fallback),
//   • re-render when fresh data arrives from the network, and
//   • re-fetch automatically on screen focus so admin edits propagate to
//     users without a cold-restart.
//
// Each hook returns the bundled value as the initial state so render code
// never has to deal with `data === null`. Screens can keep doing
// `data.map(...)` and similar without a loading guard.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  fetchVictoryMeta, fetchVictoryDays, fetchVictoryVigils,
  fetchVictoryDay, fetchVictoryVigil,
  localizeDay, localizeVigil,
} from '../services/victory';
import {
  VICTORY_META   as BUNDLED_META,
  VICTORY_DAYS   as BUNDLED_DAYS,
  VICTORY_VIGILS as BUNDLED_VIGILS,
} from '../data/victoryMonth';
import { useLanguage } from '../context/LanguageContext';

// Optionally re-fetch on screen focus (navigation passed in). Cheap because
// cacheFirst returns instantly when the cache is warm; the listener just gives
// admin edits a clear path to update the user's view without a relaunch.
const useFocusRefetch = (navigation, refetch) => {
  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    const unsub = navigation.addListener('focus', refetch);
    return unsub;
  }, [navigation, refetch]);
};

export const useVictoryMeta = (navigation) => {
  const [meta,    setMeta]    = useState(BUNDLED_META);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try { setMeta(await fetchVictoryMeta()); } catch { /* keep last value */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  useFocusRefetch(navigation, refetch);
  return { meta, loading, refetch };
};

export const useVictoryDays = (navigation) => {
  const { lang } = useLanguage();
  const [days,    setDays]    = useState(BUNDLED_DAYS);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchVictoryDays();
      if (Array.isArray(list) && list.length) setDays(list);
    } catch { /* keep last value */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  useFocusRefetch(navigation, refetch);
  // Localization runs at render time so toggling languages doesn't re-fetch.
  const localized = useMemo(
    () => days.map((d) => localizeDay(d, lang)),
    [days, lang],
  );
  return { days: localized, loading, refetch };
};

export const useVictoryVigils = (navigation) => {
  const { lang } = useLanguage();
  const [vigils,  setVigils]  = useState(BUNDLED_VIGILS);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchVictoryVigils();
      if (Array.isArray(list) && list.length) setVigils(list);
    } catch { /* keep last value */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  useFocusRefetch(navigation, refetch);
  const localized = useMemo(
    () => vigils.map((v) => localizeVigil(v, lang)),
    [vigils, lang],
  );
  return { vigils: localized, loading, refetch };
};

export const useVictoryDay = (n, navigation) => {
  const { lang } = useLanguage();
  const idx = Math.max(1, Math.min(BUNDLED_DAYS.length, Number(n) || 1)) - 1;
  const [day, setDay] = useState(BUNDLED_DAYS[idx] || null);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const row = await fetchVictoryDay(n);
      if (row) setDay(row);
    } catch { /* keep bundled fallback */ }
    finally { setLoading(false); }
  }, [n]);
  useEffect(() => { refetch(); }, [refetch]);
  useFocusRefetch(navigation, refetch);
  const localized = useMemo(() => localizeDay(day, lang), [day, lang]);
  return { day: localized, loading, refetch };
};

export const useVictoryVigil = (id, navigation) => {
  const { lang } = useLanguage();
  const initial = BUNDLED_VIGILS.find((v) => v.id === id) || null;
  const [vigil, setVigil] = useState(initial);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const row = await fetchVictoryVigil(id);
      if (row) setVigil(row);
    } catch { /* keep bundled fallback */ }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refetch(); }, [refetch]);
  useFocusRefetch(navigation, refetch);
  const localized = useMemo(() => localizeVigil(vigil, lang), [vigil, lang]);
  return { vigil: localized, loading, refetch };
};
