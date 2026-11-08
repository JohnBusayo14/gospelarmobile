// components/UpdateGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Forces over-the-air (EAS) updates.
//
// Without this, expo-updates downloads a new update in the background and only
// applies it on the NEXT cold start, so people who never fully close the app
// stay on old code for days. With it:
//   • on launch, and when the app returns to the foreground (at most every
//     15 min), we ask EAS whether a newer update exists;
//   • if one does, a full-screen "Updating Gospelar…" cover blocks the app,
//     the update downloads, and the app restarts straight into it.
//
// The app renders immediately — the check runs alongside it — so nobody waits
// when there is nothing new. Offline, slow or failed checks never block.
//
// Admins can switch forcing off from the backend: GET /api/app-config returns
// { force_ota: false } and updates then download silently (applied on the next
// cold start, as before). Forcing is ON when the setting can't be read.
//
// Self-contained on purpose (no theme / language providers) so it can wrap the
// whole app in index.js.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, AppState, StatusBar } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_HOSTS, activeApiHost } from '../services/apiFailover';

const RECHECK_MS  = 15 * 60 * 1000;   // foreground re-check throttle
const CHECK_MS    = 10 * 1000;        // give up on a slow update check
const DOWNLOAD_MS = 3 * 60 * 1000;    // give up on a slow download (it resumes next time)
const CONFIG_MS   = 4 * 1000;
const FORCE_KEY   = 'ota_force';

const TEXT = {
  en: ['Updating Gospelar…', 'Getting the newest version. This only takes a moment.'],
  yo: ['A ń ṣe àtúnṣe Gospelar…', 'A ń gba ẹ̀yà tuntun. Kò ní pẹ́ rárá.'],
  ig: ['Anyị na-emelite Gospelar…', 'Anyị na-enweta ụdị kachasị ọhụrụ. Ọ ga-ewe nwa oge.'],
  ha: ['Ana sabunta Gospelar…', 'Ana samo sabon salo. Zai ɗauki ɗan lokaci kaɗan.'],
};

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
]);

// Backend switch. Falls back to the last value seen, then to "force".
async function shouldForce() {
  const hosts = [activeApiHost(), ...API_HOSTS].filter((h, i, a) => a.indexOf(h) === i);
  for (const host of hosts) {
    try {
      const res = await withTimeout(fetch(`${host}/api/app-config`), CONFIG_MS);
      if (!res.ok) continue;
      const cfg = await res.json();
      const force = cfg.force_ota !== false;
      AsyncStorage.setItem(FORCE_KEY, force ? '1' : '0').catch(() => {});
      return force;
    } catch {}
  }
  try { return (await AsyncStorage.getItem(FORCE_KEY)) !== '0'; } catch { return true; }
}

export default function UpdateGate({ children }) {
  const [updating, setUpdating] = useState(false);
  const [lang, setLang]         = useState('en');
  const busy      = useRef(false);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || busy.current) return;
    busy.current = true;
    lastCheck.current = Date.now();
    try {
      const result = await withTimeout(Updates.checkForUpdateAsync(), CHECK_MS);
      if (!result.isAvailable) return;
      const force = await shouldForce();
      if (force) {
        AsyncStorage.getItem('app_lang').then((l) => { if (TEXT[l]) setLang(l); }).catch(() => {});
        setUpdating(true);
      }
      const fetched = await withTimeout(Updates.fetchUpdateAsync(), DOWNLOAD_MS);
      // Not forced: the downloaded update applies on the next cold start.
      if (force && (fetched.isNew || fetched.isRollBackToEmbedded)) await Updates.reloadAsync();
      else setUpdating(false);
    } catch {
      // Offline, timeout, or EAS error — let the user carry on; we retry later.
      setUpdating(false);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheck.current > RECHECK_MS) check();
    });
    return () => sub.remove();
  }, [check]);

  const [title, sub] = TEXT[lang] || TEXT.en;
  return (
    <View style={s.root}>
      {children}
      {updating && (
        <View style={s.cover} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={s.title}>{title}</Text>
          <Text style={s.sub}>{sub}</Text>
        </View>
      )}
    </View>
  );
}

export const withUpdateGate = (App) => function GatedApp(props) {
  return <UpdateGate><App {...props} /></UpdateGate>;
};

const s = StyleSheet.create({
  root:  { flex: 1 },
  cover: { ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999, backgroundColor: '#1A56DB',
           alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 24, textAlign: 'center' },
  sub:   { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
});
