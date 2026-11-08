// services/ads.js
// ─────────────────────────────────────────────────────────────────────────────
// AdMob wiring for banners + interstitials. One place owns:
//   • SDK init + consent (UMP) — nothing requests an ad before consent is done
//   • child-safe audience handling (children / intermediate categories)
//   • interstitial frequency policy + preloading
//   • the remote kill switch (GET /api/ads/config)
//
// The SDK is a native module, so it only exists in a build that includes it
// (EAS build ≥ 1.0.3). Everything here degrades to "no ads" instead of
// crashing when it's missing (Expo Go, older runtime, import failure).
//
// Ads are ON in dev builds (Google test units) and in release builds only when
// real unit IDs are provided via EXPO_PUBLIC_ADMOB_BANNER_ID /
// EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID — a release without IDs shows no ads rather
// than test ads.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../context/SubscriptionContext';

let GMA = null;
try { GMA = require('react-native-google-mobile-ads'); } catch { GMA = null; }

const REAL_BANNER_ID       = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || '';
const REAL_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || '';

const adsAllowedByBuild = !!GMA && Platform.OS !== 'web' &&
  (__DEV__ || (!!REAL_BANNER_ID && !!REAL_INTERSTITIAL_ID));

export const bannerUnitId = () =>
  (__DEV__ || !REAL_BANNER_ID) ? GMA?.TestIds?.ADAPTIVE_BANNER : REAL_BANNER_ID;
const interstitialUnitId = () =>
  (__DEV__ || !REAL_INTERSTITIAL_ID) ? GMA?.TestIds?.INTERSTITIAL : REAL_INTERSTITIAL_ID;

// ── Frequency policy ─────────────────────────────────────────────────────────
const MIN_SESSIONS_BEFORE_ADS   = 2;          // none in the first 2 launches
const SESSION_GRACE_MS          = 30_000;     // none in the first 30 s of a session
const LESSONS_PER_INTERSTITIAL  = 3;
const DEFAULT_INTERVAL_MS       = 4 * 60_000; // ≥ 4 min between interstitials

const K_LAST   = 'ads_last_interstitial_at';
const K_SESS   = 'ads_session_count';
const K_LESS   = 'ads_lessons_since_ad';
const K_CHILD  = 'ads_child_mode';

const state = {
  initialised: false,
  enabled:     false,      // SDK ready + not killed remotely
  childMode:   false,
  intervalMs:  DEFAULT_INTERVAL_MS,
  startedAt:   Date.now(),
  sessions:    0,
  lessonsSinceAd: 0,
  lastShownAt: 0,
  isTeacher:   false,
  interstitial: null,
  interstitialLoaded: false,
  listeners:   new Set(),
};

const notify = () => state.listeners.forEach((fn) => { try { fn(); } catch {} });
export const subscribeAds = (fn) => { state.listeners.add(fn); return () => state.listeners.delete(fn); };
export const adsReady     = () => state.enabled;
export const adsChildMode = () => state.childMode;

// Children (4–11) and Intermediate (12–17) are NEVER shown ads (Google Play
// Families Policy / AdMob child-directed rules). Child mode is sticky: it stays
// on until the user opens an adult/youth category.
export const isChildCategory = (cat) => cat === 'children' || cat === 'intermediate';

// ── Request configuration ────────────────────────────────────────────────────
async function applyRequestConfig() {
  if (!GMA) return;
  const { MaxAdContentRating, default: mobileAds } = GMA;
  const child = state.childMode;
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: child ? MaxAdContentRating.G : MaxAdContentRating.PG,
    tagForChildDirectedTreatment: child ? true : undefined,
    tagForUnderAgeOfConsent:      child ? true : undefined,
  });
}

// Call whenever the user's selected age category changes (Home category tabs,
// opening a lesson). Persisted so the next launch starts in the right mode.
export async function setAudience(category) {
  const child = isChildCategory(category);
  if (child === state.childMode) return;
  state.childMode = child;
  AsyncStorage.setItem(K_CHILD, child ? '1' : '0').catch(() => {});
  if (!state.initialised) return;
  try {
    await applyRequestConfig();
    state.interstitialLoaded = false;
    loadInterstitial();             // reload under the new settings
    notify();                       // banners re-request under the new settings
  } catch {}
}

// ── Interstitial ─────────────────────────────────────────────────────────────
function loadInterstitial() {
  if (!state.enabled || !GMA) return;
  try {
    const { InterstitialAd, AdEventType } = GMA;
    const ad = InterstitialAd.createForAdRequest(interstitialUnitId(), {
      requestNonPersonalizedAdsOnly: state.childMode,
    });
    state.interstitial = ad;
    state.interstitialLoaded = false;
    ad.addAdEventListener(AdEventType.LOADED, () => { if (state.interstitial === ad) state.interstitialLoaded = true; });
    ad.addAdEventListener(AdEventType.CLOSED, () => { state.interstitialLoaded = false; loadInterstitial(); });
    ad.addAdEventListener(AdEventType.ERROR,  () => { state.interstitialLoaded = false; });
    ad.load();
  } catch { /* ad failures must never affect the app */ }
}

// ── Init ─────────────────────────────────────────────────────────────────────
export async function initAds() {
  if (state.initialised) return;
  state.initialised = true;
  if (!adsAllowedByBuild) return;

  try {
    const [sess, last, less, child, role] = await Promise.all([
      AsyncStorage.getItem(K_SESS), AsyncStorage.getItem(K_LAST),
      AsyncStorage.getItem(K_LESS), AsyncStorage.getItem(K_CHILD),
      AsyncStorage.getItem('userRole'),
    ]);
    state.sessions       = (parseInt(sess, 10) || 0) + 1;
    state.lastShownAt    = parseInt(last, 10) || 0;
    state.lessonsSinceAd = parseInt(less, 10) || 0;
    state.childMode      = child === '1';
    state.isTeacher      = role === 'teacher' || role === 'admin';
    AsyncStorage.setItem(K_SESS, String(state.sessions)).catch(() => {});

    // Remote kill switch / tuning. A missing endpoint (404) means "defaults".
    try {
      const res = await fetch(`${API_BASE_URL}/api/ads/config`);
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.enabled === false) return;
        if (cfg.interstitial_interval_sec > 0) state.intervalMs = cfg.interstitial_interval_sec * 1000;
      }
    } catch { /* offline → keep defaults */ }

    // Consent (EU/UK UMP form) must finish before the first ad request.
    const { AdsConsent, default: mobileAds } = GMA;
    // Fail closed: if the consent flow errors (or the user declines), request
    // no ads. Better no ads than ads without a valid consent record.
    try {
      const info = await AdsConsent.gatherConsent({ tagForUnderAgeOfConsent: state.childMode });
      if (!info || info.canRequestAds !== true) return;
    } catch {
      return;
    }

    await applyRequestConfig();
    await mobileAds().initialize();
    state.enabled = true;
    loadInterstitial();
    notify();
  } catch (e) {
    console.warn('[Ads] init failed:', e?.message);
  }
}

// ── Policy helpers ───────────────────────────────────────────────────────────
// Count a finished lesson toward the "1 interstitial per 3 lessons" cap.
export function noteLessonCompleted() {
  state.lessonsSinceAd += 1;
  AsyncStorage.setItem(K_LESS, String(state.lessonsSinceAd)).catch(() => {});
}

export const bannersAllowed = () => state.enabled && !state.isTeacher && !state.childMode;

// Show an interstitial if every rule allows it. Resolves true if one was shown.
//   category — lesson category; child categories never get interstitials.
export async function showInterstitialIfAllowed({ category } = {}) {
  if (!state.enabled || state.isTeacher) return false;
  if (isChildCategory(category) || state.childMode) return false;
  if (state.sessions <= MIN_SESSIONS_BEFORE_ADS) return false;
  if (Date.now() - state.startedAt < SESSION_GRACE_MS) return false;
  if (Date.now() - state.lastShownAt < state.intervalMs) return false;
  if (state.lessonsSinceAd < LESSONS_PER_INTERSTITIAL) return false;
  if (!state.interstitialLoaded || !state.interstitial) return false;
  try {
    await state.interstitial.show();
    state.lastShownAt = Date.now();
    state.lessonsSinceAd = 0;
    AsyncStorage.multiSet([[K_LAST, String(state.lastShownAt)], [K_LESS, '0']]).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export const getGMA = () => GMA;
