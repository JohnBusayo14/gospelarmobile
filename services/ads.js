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
// From services/api (not SubscriptionContext) — the context imports this file
// to switch ads off for Premium users, so importing back would be a cycle.
import { API_BASE_URL } from './api';

let GMA = null;
try { GMA = require('react-native-google-mobile-ads'); } catch { GMA = null; }

// Gospelar's AdMob ad units (publisher pub-3190805229756882, Android app
// ca-app-pub-3190805229756882~2326358894 — set in app.json). Unit IDs are
// public (they ship inside every APK), so they live here as defaults: that
// way EAS builds AND over-the-air updates carry them without any env setup.
// EXPO_PUBLIC_ADMOB_* still override them. An empty unit means that ad type
// is off on that platform (a release never falls back to test ads).
const ANDROID_UNITS = {
  banner:       'ca-app-pub-3190805229756882/2999966683',
  interstitial: 'ca-app-pub-3190805229756882/4121476662',
  // Rewarded (Bible Games lifelines / hints).
  rewarded:     'ca-app-pub-3190805229756882/9172291660',
};
// iOS AdMob app ca-app-pub-3190805229756882~1909611832 (set in app.json).
// Its units are not created yet — iOS release builds show no ads until they
// are added here.
const IOS_UNITS = {
  banner:       '',
  interstitial: '',
  rewarded:     '',
};
const UNITS = Platform.OS === 'android' ? ANDROID_UNITS
  : Platform.OS === 'ios' ? IOS_UNITS
  : { banner: '', interstitial: '', rewarded: '' };

const REAL_BANNER_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || UNITS.banner;
const REAL_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || UNITS.interstitial;
const REAL_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || UNITS.rewarded;

const adsAllowedByBuild = !!GMA && Platform.OS !== 'web' &&
  (__DEV__ || (!!REAL_BANNER_ID && !!REAL_INTERSTITIAL_ID));

export const bannerUnitId = () =>
  (__DEV__ || !REAL_BANNER_ID) ? GMA?.TestIds?.ADAPTIVE_BANNER : REAL_BANNER_ID;
const interstitialUnitId = () =>
  (__DEV__ || !REAL_INTERSTITIAL_ID) ? GMA?.TestIds?.INTERSTITIAL : REAL_INTERSTITIAL_ID;

// Rewarded ads need their own unit; a release without one simply has none.
const rewardedUnitId = () =>
  __DEV__ ? GMA?.TestIds?.REWARDED : REAL_REWARDED_ID;

// ── Frequency policy ─────────────────────────────────────────────────────────
const MIN_SESSIONS_BEFORE_ADS   = 2;          // none in the first 2 launches
const SESSION_GRACE_MS          = 30_000;     // none in the first 30 s of a session
const LESSONS_PER_INTERSTITIAL  = 3;
const DEFAULT_INTERVAL_MS       = 4 * 60_000; // ≥ 4 min between interstitials

const K_LAST   = 'ads_last_interstitial_at';
const K_SESS   = 'ads_session_count';
const K_LESS   = 'ads_lessons_since_ad';
const K_CHILD  = 'ads_child_mode';
const K_ADFREE = 'ads_ad_free';   // last known Premium status (avoids an ad flash at launch)

const state = {
  initialised: false,
  sdkStarted:  false,
  enabled:     false,      // SDK ready + not killed remotely
  adFree:      false,      // Premium subscriber → no ads at all
  adFreeKnown: false,      // set once the subscription check has reported
  childMode:   false,
  intervalMs:  DEFAULT_INTERVAL_MS,
  startedAt:   Date.now(),
  sessions:    0,
  lessonsSinceAd: 0,
  lastShownAt: 0,
  isTeacher:   false,
  interstitial: null,
  interstitialLoaded: false,
  rewarded:     null,
  rewardedLoaded: false,
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
    loadRewarded();
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

// ── Rewarded (opt-in: the player chooses to watch for a lifeline / hint) ─────
function loadRewarded() {
  if (!state.enabled || !GMA || !rewardedUnitId()) return;
  try {
    const { RewardedAd, RewardedAdEventType, AdEventType } = GMA;
    const ad = RewardedAd.createForAdRequest(rewardedUnitId(), {
      requestNonPersonalizedAdsOnly: state.childMode,
    });
    state.rewarded = ad;
    state.rewardedLoaded = false;
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (state.rewarded === ad) { state.rewardedLoaded = true; notify(); }
    });
    ad.addAdEventListener(AdEventType.ERROR, () => { if (state.rewarded === ad) state.rewardedLoaded = false; });
    ad.load();
  } catch { /* ad failures must never affect the app */ }
}

// True when a rewarded ad is loaded and this user may see ads at all.
export const rewardedAvailable = () =>
  state.enabled && !state.adFree && !state.isTeacher && !state.childMode &&
  state.rewardedLoaded && !!state.rewarded;

// Shows the loaded rewarded ad. Resolves true only if the user earned the
// reward (watched to the end); false if closed early, not loaded or failed.
export function showRewarded() {
  if (!rewardedAvailable() || !GMA) return Promise.resolve(false);
  const ad = state.rewarded;
  const { RewardedAdEventType, AdEventType } = GMA;
  return new Promise((resolve) => {
    let earned = false;
    let done = false;
    const subs = [];
    const finish = () => {
      if (done) return;
      done = true;
      subs.forEach((u) => { try { u(); } catch {} });
      state.rewardedLoaded = false;
      if (state.rewarded === ad) loadRewarded();   // preload the next one
      notify();
      resolve(earned);
    };
    try {
      subs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
      subs.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
      subs.push(ad.addAdEventListener(AdEventType.ERROR, finish));
      ad.show().catch(finish);
    } catch { finish(); }
  });
}

// Interstitial between game levels / rounds. Same rules as the lesson one
// (grace period, interval, never for children/teachers/Premium) except it
// doesn't wait for 3 finished lessons. Never call it mid-question.
export async function showGameInterstitial() {
  if (!state.enabled || state.adFree || state.isTeacher || state.childMode) return false;
  if (state.sessions <= MIN_SESSIONS_BEFORE_ADS) return false;
  if (Date.now() - state.startedAt < SESSION_GRACE_MS) return false;
  if (Date.now() - state.lastShownAt < state.intervalMs) return false;
  if (!state.interstitialLoaded || !state.interstitial) return false;
  try {
    await state.interstitial.show();
    state.lastShownAt = Date.now();
    AsyncStorage.setItem(K_LAST, String(state.lastShownAt)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

// ── Premium (ad-free) ────────────────────────────────────────────────────────
// Called by SubscriptionContext after every server subscription check.
// Premium users never see a banner or interstitial, and the SDK (and its
// consent form) isn't even started for them. If a Premium plan lapses, the
// SDK starts on the spot.
export function setAdFree(on) {
  const next = !!on;
  state.adFreeKnown = true;
  AsyncStorage.setItem(K_ADFREE, next ? '1' : '0').catch(() => {});
  const changed = next !== state.adFree;
  state.adFree = next;
  if (!next && state.initialised && !state.sdkStarted) startSdk();
  if (changed) notify();   // mounted <AdSlot>s re-render and disappear / appear
}
export const isAdFree = () => state.adFree;

// ── Init ─────────────────────────────────────────────────────────────────────
export async function initAds() {
  if (state.initialised) return;
  state.initialised = true;
  if (!adsAllowedByBuild) return;

  try {
    const [sess, last, less, child, role, adFree] = await Promise.all([
      AsyncStorage.getItem(K_SESS), AsyncStorage.getItem(K_LAST),
      AsyncStorage.getItem(K_LESS), AsyncStorage.getItem(K_CHILD),
      AsyncStorage.getItem('userRole'), AsyncStorage.getItem(K_ADFREE),
    ]);
    state.sessions       = (parseInt(sess, 10) || 0) + 1;
    state.lastShownAt    = parseInt(last, 10) || 0;
    state.lessonsSinceAd = parseInt(less, 10) || 0;
    state.childMode      = child === '1';
    state.isTeacher      = role === 'teacher' || role === 'admin';
    AsyncStorage.setItem(K_SESS, String(state.sessions)).catch(() => {});
    // The live subscription check may already have answered; it wins.
    if (!state.adFreeKnown) state.adFree = adFree === '1';
  } catch (e) {
    console.warn('[Ads] init failed:', e?.message);
  }
  // Last known Premium → wait; setAdFree(false) starts the SDK if it lapsed.
  if (!state.adFree) startSdk();
}

async function startSdk() {
  if (state.sdkStarted || !adsAllowedByBuild) return;
  state.sdkStarted = true;
  try {
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
    loadRewarded();
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

export const bannersAllowed = () => state.enabled && !state.adFree && !state.isTeacher && !state.childMode;

// Show an interstitial if every rule allows it. Resolves true if one was shown.
//   category — lesson category; child categories never get interstitials.
export async function showInterstitialIfAllowed({ category } = {}) {
  if (!state.enabled || state.adFree || state.isTeacher) return false;
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
