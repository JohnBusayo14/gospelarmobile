// hooks/useTTS.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared text-to-speech hook + voice catalogue helper.
//
// Originally lived inline in screen/victory/victoryHooks.js. Extracted here so
// the Sunday-School devotional reader (and any future book that wants voice
// playback) can reuse the same voice-resolution logic.
//
// Behaviour:
//   • Real on-device voice when expo-speech is installed; falls back to a
//     paced simulator if it isn't so the UI still works in environments
//     without TTS.
//   • Auto-picks the clearest available masculine English voice with Nigerian
//     English first, degrading to other African / British / Indian / US
//     variants. If no clear masculine voice exists we fall back to an
//     enhanced female voice — clarity over gender, per the original design
//     directive.
//   • Callers can pass `onDoneOverride` so an audio player can chain
//     segments without writing its own onDone wiring.
//   • Monotonic `speakGenRef` invalidates stale onDone / onStopped callbacks
//     so a previous utterance can't clobber the playing flag of the next one.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';

let _speech = null;
try { _speech = require('expo-speech'); } catch { /* package not installed */ }

// Known masculine-voice identifiers / name fragments across iOS and Android.
// Lower-cased; matched against both `identifier` and `name`.
const MALE_HINTS = [
  'male', 'man',
  // Apple voices that are masculine on iOS / macOS
  'daniel', 'arthur', 'oliver', 'aaron', 'fred', 'tom', 'rishi', 'gordon',
  'rocko', 'reed', 'jamie', 'martin',
  // Google / Samsung Android voice IDs that are masculine. The `-x-XYn`
  // pattern (last letter `n`) is Google's male voice convention; `-x-XYf` is
  // female. en-ng-x-tin / -tim are Google's Nigerian English male voices.
  'en-ng-x-tin', 'en-ng-x-tim',
  'en-gb-x-rjs', 'en-gb-x-gba', 'en-gb-x-gbb', 'en-gb-x-gbd',
  'en-us-x-iom', 'en-us-x-tpd', 'en-us-x-iol',
  'en-au-x-aub', 'en-in-x-ahn',
];
const FEMALE_HINTS = [
  'female', 'woman',
  'samantha', 'siri', 'karen', 'tessa', 'moira', 'fiona', 'kathy', 'allison',
  'susan', 'vicki', 'victoria', 'serena', 'ava', 'martha', 'kate',
  'en-ng-x-tii', 'en-ng-x-tif',
  'en-us-x-iss', 'en-us-x-tpf',
  'en-gb-x-fis', 'en-gb-x-gbc', 'en-gb-x-gbe',
  'en-au-x-aud', 'en-in-x-ahf',
];

const looksMale = (v) => {
  const hay = `${v.identifier || ''}  ${v.name || ''}`.toLowerCase();
  if (FEMALE_HINTS.some((f) => hay.includes(f))) return false;
  return MALE_HINTS.some((m) => hay.includes(m));
};
const looksFemale = (v) => {
  const hay = `${v.identifier || ''}  ${v.name || ''}`.toLowerCase();
  return FEMALE_HINTS.some((f) => hay.includes(f));
};

const isEnglish = (v) => (v.language || '').toLowerCase().startsWith('en');
const langMatches = (v, code) => (v.language || '').toLowerCase() === code;

// Sort voices so higher-quality variants come first. Enhanced/premium/
// network voices sound noticeably clearer than the compact defaults.
const qualityScore = (v) => {
  const id = `${v.identifier || ''}  ${v.name || ''}`.toLowerCase();
  let score = 0;
  if (/(enhanced|premium|network|hd|wavenet|neural)/.test(id)) score += 3;
  if (v.quality === 'Enhanced')                                score += 3;
  if (/-network$/.test(id)) score += 2;
  if (/-local$/.test(id))   score += 1;
  return score;
};
const byQuality = (a, b) => qualityScore(b) - qualityScore(a);
const isEnhanced = (v) => qualityScore(v) >= 3;

// Locale priority — Nigerian English first (closest to the user's accent
// expectation), then other West-African-adjacent English variants, then
// British English, then everything else.
const LOCALE_PRIORITY = [
  'en-ng',
  'en-gh', 'en-ke', 'en-za',
  'en-gb',
  'en-in',
  'en-au', 'en-ie',
  'en-us',
];

// Resolve once per module load; subsequent useTTS instances reuse it.
let _autoVoicePromise = null;
const resolveAutoVoice = () => {
  if (!_speech?.getAvailableVoicesAsync) return Promise.resolve(null);
  if (!_autoVoicePromise) {
    _autoVoicePromise = _speech
      .getAvailableVoicesAsync()
      .then((voices = []) => {
        const english = voices.filter(isEnglish);
        if (!english.length) return voices[0] || null;

        for (const code of LOCALE_PRIORITY) {
          const inLocale = english.filter((v) => langMatches(v, code)).sort(byQuality);
          const pick = inLocale.find((v) => isEnhanced(v) && looksMale(v));
          if (pick) return pick;
        }
        for (const code of LOCALE_PRIORITY) {
          const inLocale = english.filter((v) => langMatches(v, code)).sort(byQuality);
          const pick = inLocale.find(looksMale);
          if (pick) return pick;
        }
        for (const code of LOCALE_PRIORITY) {
          const inLocale = english.filter((v) => langMatches(v, code)).sort(byQuality);
          const pick = inLocale.find((v) => isEnhanced(v) && looksFemale(v));
          if (pick) return pick;
        }
        const anyEnhanced = english.filter(isEnhanced).sort(byQuality)[0];
        if (anyEnhanced) return anyEnhanced;
        return english.sort(byQuality)[0] || voices[0] || null;
      })
      .catch(() => null);
  }
  return _autoVoicePromise;
};

let _voicesPromise = null;
const loadAllVoices = () => {
  if (!_speech?.getAvailableVoicesAsync) return Promise.resolve([]);
  if (!_voicesPromise) {
    _voicesPromise = _speech.getAvailableVoicesAsync()
      .then((vs = []) => vs)
      .catch(() => []);
  }
  return _voicesPromise;
};

const LANG_LABELS = {
  'en-ng': 'Nigerian English', 'en-gh': 'Ghanaian English',
  'en-ke': 'Kenyan English',   'en-za': 'South African English',
  'en-gb': 'British English',  'en-in': 'Indian English',
  'en-au': 'Australian English','en-ie': 'Irish English',
  'en-us': 'American English',
};
const labelForLang = (code) => LANG_LABELS[String(code || '').toLowerCase()] || (code || '').toUpperCase();

export const getVoiceCatalogue = async () => {
  const voices = await loadAllVoices();
  return voices
    .filter(isEnglish)
    .map((v) => ({
      id:        v.identifier,
      name:      v.name || v.identifier,
      language:  v.language,
      label:     labelForLang(v.language),
      gender:    looksMale(v) ? 'male' : looksFemale(v) ? 'female' : 'unknown',
      enhanced:  isEnhanced(v),
      _score:    qualityScore(v),
    }))
    .sort((a, b) => {
      const ap = LOCALE_PRIORITY.indexOf(String(a.language || '').toLowerCase());
      const bp = LOCALE_PRIORITY.indexOf(String(b.language || '').toLowerCase());
      const aRank = ap === -1 ? 99 : ap;
      const bRank = bp === -1 ? 99 : bp;
      if (aRank !== bRank) return aRank - bRank;
      if (a.enhanced !== b.enhanced) return a.enhanced ? -1 : 1;
      if (a.gender !== b.gender) {
        if (a.gender === 'male') return -1;
        if (b.gender === 'male') return 1;
      }
      return b._score - a._score;
    });
};

// Defensive clamp — guards against NaN / out-of-range values that would
// otherwise make expo-speech reject the utterance or produce silence.
const clampNum = (n, min, max, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
};

export const useTTS = () => {
  const [playing, setPlaying] = useState(false);
  const [voiceInfo, setVoiceInfo] = useState(null);
  const stopRef     = useRef(false);
  const simTimerRef = useRef(null);
  const autoVoiceRef = useRef(null);
  const mountedRef  = useRef(true);
  // Monotonic counter — every speak() call gets a new generation. Any callback
  // (onDone, onStopped, onError, simulator timeout) checks its captured gen
  // against this ref before touching state.
  const speakGenRef = useRef(0);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    let cancelled = false;
    resolveAutoVoice().then((v) => {
      if (cancelled || !v) return;
      autoVoiceRef.current = v.identifier || null;
      setVoiceInfo({
        id:       v.identifier,
        name:     v.name || v.identifier,
        language: v.language,
        label:    labelForLang(v.language),
        gender:   looksMale(v) ? 'male' : looksFemale(v) ? 'female' : 'unknown',
        enhanced: isEnhanced(v),
      });
    });
    return () => { cancelled = true; };
  }, []);

  const speak = useCallback((text, opts = {}) => {
    if (!text) return;
    const gen = ++speakGenRef.current;
    stopRef.current = false;
    clearTimeout(simTimerRef.current);
    if (mountedRef.current) setPlaying(true);

    const finish = (reason = 'done') => {
      if (gen !== speakGenRef.current) return;
      if (stopRef.current && reason !== 'stopped') return;
      if (!mountedRef.current) return;
      setPlaying(false);
      if (reason === 'done' && typeof opts.onDoneOverride === 'function') {
        try { opts.onDoneOverride(); } catch { /* swallow */ }
      }
    };

    if (_speech?.speak) {
      try { _speech.stop?.(); } catch { /* noop */ }
      try {
        _speech.speak(text, {
          rate:      clampNum(opts.rate,  0.5, 2.0, 0.9),
          pitch:     clampNum(opts.pitch, 0.5, 2.0, 0.95),
          language:  opts.language || 'en-US',
          voice:     opts.voice || autoVoiceRef.current || undefined,
          volume:    clampNum(opts.volume, 0, 1, 1.0),
          onDone:    () => finish('done'),
          onStopped: () => finish('stopped'),
          onError:   () => finish('error'),
        });
      } catch {
        finish('error');
      }
    } else {
      // Simulate: pretend to read for a few seconds per ~25 words.
      const words = String(text).trim().split(/\s+/).length;
      const ms    = Math.min(120_000, Math.max(2_500, words * 240));
      simTimerRef.current = setTimeout(() => {
        if (stopRef.current) return;
        finish('done');
      }, ms);
    }
  }, []);

  const stop = useCallback(() => {
    stopRef.current = true;
    speakGenRef.current++;
    clearTimeout(simTimerRef.current);
    simTimerRef.current = null;
    if (_speech?.stop) {
      try { _speech.stop(); } catch { /* swallow */ }
    }
    if (mountedRef.current) setPlaying(false);
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return { speak, stop, playing, supported: !!_speech?.speak, voice: voiceInfo };
};

export default useTTS;
