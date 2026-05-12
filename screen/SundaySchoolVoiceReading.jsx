// screen/SundaySchoolVoiceReading.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sunday-School daily devotional voice reader.
//
// Faithful clone of the Victory Month VictoryAudioPlayer design, adapted to
// SS devotional content (Intro · Prayer · Reflection · Application):
//   • Gradient hero player card with animated visualiser, big play/pause +
//     prev/next circles, progress bar, segment counter, and a tappable voice
//     tag that opens the voice picker.
//   • Reading-speed chip row (0.75x · 0.90x · 1.00x · 1.15x).
//   • Voice picker bottom-sheet modal listing every English voice installed
//     on the device, grouped by language with quality / gender pills.
//   • "Prayer time between readings" chip row (Off · 10s · 30s · 1 min · 2 min)
//     — the reader pauses for that many seconds between segments so the
//     listener can pray on what was just read.
//   • Segment list cards with a 4-px left border + soft tinted fill for the
//     active one. Tap a card to jump straight to that segment.
//   • Reflection-pause countdown card surfaces above the segment list while
//     the reader is pausing between segments, with a Skip button.
//
// SS-specific differences from the Victory version:
//   • Content shape — Intro, Prayer, Reflection, Application
//   • 2-minute reading-timer + silentReadingCheckIn on unmount, so listening
//     also banks the daily devotional point toward the user's streak
//   • Settings stored under `ss_audio_settings` so they don't share with the
//     Victory book's audio settings
//   • No "Mark as prayed" CTA — SS earns the daily point via the reading
//     check-in instead of a per-day completion map
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Animated, Easing, Modal, Pressable, Platform, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage     from '@react-native-async-storage/async-storage';

import { useTheme }      from '../context/ThemeContext';
import { useLanguage }   from '../context/LanguageContext';
import { getTokens }     from '../theme/tokens';
import { bookTones, RADII, AMBIENT_SHADOW } from '../theme/bookSurfaces';
import { ICONS }         from '../components/AppTabBar';
import { useScreenEntry } from '../hooks/useFluidAnim';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { useTTS, getVoiceCatalogue } from '../hooks/useTTS';
import { silentReadingCheckIn } from '../services/reading';

// ── Local blue / accent ramps to match VictoryAudioPlayer's visual ────────
// (Victory imports BLUE/INDIGO/etc from victoryTheme. We could pull from
// there directly, but inlining keeps SS visually independent of Victory's
// theme module and avoids cross-book coupling for what is just a colour
// palette.)
const BLUE = {
  900: '#0B2A6B', 800: '#1E3A8A', 700: '#1D4ED8', 600: '#1A56DB',
  500: '#3B82F6', 400: '#60A5FA', 300: '#93C5FD', 200: '#BFDBFE',
  100: '#DBEAFE', 50:  '#EFF6FF',
};
const INDIGO  = { 700: '#4338CA', 600: '#4F46E5', 100: '#E0E7FF', 50: '#EEF2FF' };
const AMBER   = { 600: '#D97706', 500: '#F59E0B', 100: '#FEF3C7' };
const EMERALD = { 600: '#059669', 500: '#10B981' };

// Reflection-pause options — silent time inserted between segments so the
// listener can pray on what was just read before the reader continues.
const PAUSE_OPTIONS = [
  { sec: 0,   label: 'Off'  },
  { sec: 10,  label: '10s'  },
  { sec: 30,  label: '30s'  },
  { sec: 60,  label: '1 min' },
  { sec: 120, label: '2 min' },
];

const SS_AUDIO_KEY  = 'ss_audio_settings';
const DEFAULT_AUDIO = { rate: 0.95, pitch: 1.0, voice: null, pauseSec: 0 };

// Lightweight settings hook so SS can persist its reader prefs without
// reaching into the Victory store. Settings shape mirrors Victory's so the
// rest of this file reads the same as VictoryAudioPlayer.
const useSSAudioSettings = () => {
  const [settings, setSettings] = useState(DEFAULT_AUDIO);
  useEffect(() => {
    AsyncStorage.getItem(SS_AUDIO_KEY)
      .then((raw) => { if (raw) setSettings({ ...DEFAULT_AUDIO, ...JSON.parse(raw) }); })
      .catch(() => { /* keep defaults */ });
  }, []);
  const save = useCallback(async (patch) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      AsyncStorage.setItem(SS_AUDIO_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  return { settings, save };
};

// Same Yoruba/Igbo/Hausa/English devotional content builder used by
// DevotionalReadingScreen — inline copy so this screen stays in sync with
// the reader page without an extra import surface.
const getDevotionalContent = (day, lang = 'en') => {
  if (!day) return { prayer: '', reflection: '', application: '' };
  const sc = day.scripture || '';
  if (lang === 'yo') return {
    prayer:      `Baba Ọ̀run, bí mo ṣe ń ronú lórí ${sc} lónìí, ṣí ojú ọkàn mi kí n lè rí ohun tí O fẹ́ kọ́ mí. Ràn mí lọ́wọ́ kí n má ṣe gbọ́ Ọ̀rọ̀ Rẹ nìkan, ṣùgbọ́n kí n tẹ̀lé e. Ní orúkọ Jesu, Àmín.`,
    reflection:  `Ìwé mímọ́ òní — ${sc} — sọ̀rọ̀ tọ̀síhàn sí àkọlé ẹ̀kọ́ ti ìfihàn ìgbésí ayé Kristẹni. Béèrè lọ́wọ́ ara rẹ: Ní àgbègbè wo ní ìgbésí ayé mi ni Ọlọ́run ń pè mí láti fi òtítọ́ yìí sẹ̀ lónìí?`,
    application: `Kọ ìgbésẹ̀ kan pàtó tí iwọ yóò gbé lónìí lórí ohun tí o ti kà. Pín rẹ̀ pẹ̀lú ẹlẹgbẹ́ onígbàgbọ́ kan tó lè ṣe ọ̀rọ̀ iṣẹ́.`,
  };
  if (lang === 'ig') return {
    prayer:      `Nna m n'elu igwe, ka m na-echeghachi ${sc} taa, meghee anya obi m ka m hụ ihe Ị chọọ ka m mụta. Ka Okwu Gị bụ ọgụgụ n'ụkwụ m. N'aha Jizọs, Amen.`,
    reflection:  `Akwụkwọ Nsọ nke taa — ${sc} — na-ekwu ozugbo maka isiokwu mmụta. Jụọ onwe gị: N'akụkụ ole nke ndụ m Chineke na-akpọ m ka m tinye eziokwu a n'ọrụ taa?`,
    application: `Dee omume otu a nke ị ga-eme taa dabere n'ihe ị gụrụ. Kesaa ya na otu nwunye na ọgọ nke ga-ejide gị aha.`,
  };
  if (lang === 'ha') return {
    prayer:      `Ya Ubanmu na sama, yayin da nake tunani akan ${sc} yau, buɗe idanun zuciyata don in ga abin da Kake so in koya. Bari Maganarka ta zama fitila ga ƙafafuna. Da sunan Yesu, Amin.`,
    reflection:  `Nassin yau — ${sc} — yana magana kai tsaye game da taken darasi. Tambayi kanka: A wane yanki na rayuwata ne Allah yake kirana don aiwatar da wannan gaskiya yau?`,
    application: `Rubuta wani takamaiman aiki ɗaya da za ka yi yau. Raba shi da wani mai imani da zai iya riƙe ka da muhimmanci.`,
  };
  return {
    prayer:      `Heavenly Father, as I meditate on ${sc} today, open the eyes of my heart to see what You want me to learn. Let Your Word be a lamp to my feet and a light to my path. In Jesus' name, Amen.`,
    reflection:  `Today's scripture — ${sc} — speaks directly to the lesson theme. Ask yourself: In what specific area of my life is God calling me to put this truth into practice today? Christian growth always finds expression in daily choices and relationships.`,
    application: `Write down one specific action you will take today based on what you've read. Share it with a fellow believer who can hold you accountable. The power of God's Word is released when we obey it step by step, day by day.`,
  };
};

// Small inline Eyebrow component — Victory's version lives in VictoryUI;
// reproduced here so SS doesn't pull in Victory-namespaced UI.
const Eyebrow = ({ children, color, style }) => (
  <Text style={[{
    fontSize: 10, fontWeight: '900', letterSpacing: 2,
    color: color || '#475569',
  }, style]}>
    {children}
  </Text>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SundaySchoolVoiceReading({ route, navigation }) {
  const { isDark }  = useTheme();
  const { t, lang } = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => bookTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  // Caller passes the currently-selected day; we don't manage day-switching
  // here. The user navigates back to DevotionalReadingScreen to pick a
  // different day and re-enters Listen.
  const {
    devotional   = null,
    allDays:    paramAllDays = [],
    dayIndex:   paramDayIndex = 0,
    lessonTitle = '',
  } = route?.params || {};
  const allDays    = Array.isArray(paramAllDays) && paramAllDays.length > 0
    ? paramAllDays
    : [devotional].filter(Boolean);
  const dayIndex   = Math.max(0, Math.min(allDays.length - 1, Number(paramDayIndex) || 0));
  const currentDay = allDays[dayIndex] || devotional || {};
  const content    = useMemo(() => getDevotionalContent(currentDay, lang), [currentDay, lang]);

  const { speak, stop, playing, supported, voice } = useTTS();
  const { settings, save: saveAudio }              = useSSAudioSettings();

  // Voice catalogue — populated once on mount, reused by the picker modal.
  const [voiceCatalogue, setVoiceCatalogue] = useState([]);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getVoiceCatalogue()
      .then((list) => { if (!cancelled) setVoiceCatalogue(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setVoiceCatalogue([]); });
    return () => { cancelled = true; };
  }, []);

  // What the player should display + send to expo-speech. Settings.voice
  // (user override) wins; otherwise we use the auto-picked default.
  const activeVoice = useMemo(() => {
    if (settings.voice) {
      return voiceCatalogue.find((v) => v.id === settings.voice) || voice;
    }
    return voice;
  }, [settings.voice, voiceCatalogue, voice]);

  // ── Segments ─────────────────────────────────────────────────────────────
  // One entry per piece of content. `body` is what gets spoken; `title` +
  // `kind` feed the visible segment list.
  const segments = useMemo(() => {
    const list = [];
    const heading = currentDay?.title || lessonTitle;
    const introBody = [
      heading,
      currentDay?.scripture
        ? `${t('ss_voice_scripture_intro', 'Scripture')}: ${currentDay.scripture}`
        : '',
    ].filter(Boolean).join('. ') + ((heading || currentDay?.scripture) ? '.' : '');
    if (introBody.trim()) {
      list.push({
        id:    'intro',
        kind:  'intro',
        title: t('ss_voice_intro_title', 'Today'),
        body:  introBody,
      });
    }
    if (currentDay?.scripture) {
      list.push({
        id:    'scripture',
        kind:  'scripture',
        title: t('ss_voice_scripture_title', 'Scripture'),
        body:  currentDay.scripture,
      });
    }
    if (content.prayer) {
      list.push({
        id:    'prayer',
        kind:  'prayer',
        title: t('dev_prayer', 'Prayer'),
        body:  content.prayer,
      });
    }
    if (content.reflection) {
      list.push({
        id:    'reflection',
        kind:  'reflection',
        title: t('dev_reflection', 'Reflection'),
        body:  content.reflection,
      });
    }
    if (content.application) {
      list.push({
        id:    'application',
        kind:  'application',
        title: t('dev_application', 'Application'),
        body:  content.application,
      });
    }
    return list;
  }, [currentDay, lessonTitle, content, t]);

  const [segIdx, setSegIdx] = useState(0);
  const scrollRef = useRef(null);

  // Lifecycle ref — every state setter is gated on this so async callbacks
  // (TTS, setInterval, AppState) can't update an unmounted tree.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const safeSet = useCallback((setter) => (...args) => {
    if (mountedRef.current) setter(...args);
  }, []);

  // ── Reflection pause state ───────────────────────────────────────────────
  const [pause, setPause] = useState({ active: false, remain: 0, total: 0 });
  const pauseRef = useRef({ timer: null, onDone: null, active: false });

  // Idempotent — calling endPause twice (timer reaches zero AND user taps
  // Skip on the same frame, for example) won't fire onDone twice.
  const endPause = useCallback((run = true) => {
    if (!pauseRef.current.active) return;
    pauseRef.current.active = false;
    if (pauseRef.current.timer) clearInterval(pauseRef.current.timer);
    const fn = pauseRef.current.onDone;
    pauseRef.current = { timer: null, onDone: null, active: false };
    if (mountedRef.current) setPause({ active: false, remain: 0, total: 0 });
    if (run && typeof fn === 'function') {
      try { fn(); } catch { /* swallow */ }
    }
  }, []);

  const startPause = useCallback((sec, onDone) => {
    if (pauseRef.current.active) endPause(false);
    if (!sec || sec <= 0) { onDone?.(); return; }
    pauseRef.current.active = true;
    pauseRef.current.onDone = onDone;
    if (mountedRef.current) setPause({ active: true, remain: sec, total: sec });
    let left = sec;
    pauseRef.current.timer = setInterval(() => {
      left -= 1;
      if (left <= 0) endPause(true);
      else if (mountedRef.current) setPause((p) => ({ ...p, remain: left }));
    }, 1000);
  }, [endPause]);

  // ── Playback walk-through ────────────────────────────────────────────────
  const startedRef = useRef(false);

  const playAll = () => {
    if (!segments.length || !mountedRef.current) return;
    startedRef.current = true;
    endPause(false);
    setSegIdx(0);
    speakSegment(0);
  };

  const jumpTo = (i) => {
    if (!segments.length || !mountedRef.current) return;
    const target = Math.max(0, Math.min(segments.length - 1, Number(i) || 0));
    startedRef.current = true;
    endPause(false);
    stop();
    setSegIdx(target);
    speakSegment(target);
  };

  const advanceTo = (next) => {
    if (!mountedRef.current) return;
    if (next >= segments.length || !startedRef.current) {
      startedRef.current = false;
      return;
    }
    setSegIdx(next);
    speakSegment(next);
  };

  const speakSegment = (i) => {
    if (!mountedRef.current) return;
    const idx = Math.max(0, Math.min(segments.length - 1, Number(i) || 0));
    const seg = segments[idx];
    if (!seg || !seg.body) {
      if (idx + 1 < segments.length) advanceTo(idx + 1);
      else startedRef.current = false;
      return;
    }
    speak(seg.body, {
      rate:  settings.rate,
      pitch: settings.pitch,
      voice: settings.voice || undefined,
      onDoneOverride: () => {
        if (!startedRef.current || !mountedRef.current) return;
        const pauseSec = Number(settings.pauseSec) || 0;
        if (pauseSec > 0 && idx + 1 < segments.length) {
          startPause(pauseSec, () => advanceTo(idx + 1));
        } else {
          advanceTo(idx + 1);
        }
      },
    });
  };

  // Simulator fallback — when expo-speech isn't installed we approximate
  // pacing on a timer so the segment list still walks through.
  useEffect(() => {
    if (!startedRef.current) return;
    if (supported) return;
    if (pause.active) return;
    const body = segments[segIdx]?.body || '';
    if (!body) return;
    const words = String(body).trim().split(/\s+/).length;
    const ms = Math.min(15000, Math.max(2000, words * 220));
    const tmr = setTimeout(() => {
      if (!mountedRef.current || !startedRef.current) return;
      const next = segIdx + 1;
      if (next >= segments.length) { startedRef.current = false; return; }
      const pauseSec = Number(settings.pauseSec) || 0;
      if (pauseSec > 0) startPause(pauseSec, () => mountedRef.current && setSegIdx(next));
      else if (mountedRef.current) setSegIdx(next);
    }, ms);
    return () => clearTimeout(tmr);
  }, [segIdx, playing, segments, supported, pause.active, settings.pauseSec, startPause]);

  // Re-speak the current segment when rate changes mid-playback so the new
  // speed applies immediately instead of waiting for the next segment.
  const lastRateRef = useRef(settings.rate);
  useEffect(() => {
    if (lastRateRef.current === settings.rate) return;
    lastRateRef.current = settings.rate;
    if (
      mountedRef.current
      && startedRef.current
      && playing
      && !pause.active
      && segments.length > 0
    ) {
      speakSegment(segIdx);
    }
  }, [settings.rate]); // eslint-disable-line

  // Auto-scroll to keep the active segment visible.
  useEffect(() => {
    if (!mountedRef.current) return;
    try { scrollRef.current?.scrollTo({ y: segIdx * 132, animated: true }); }
    catch { /* harmless */ }
  }, [segIdx]);

  // Cleanup on unmount — clear any lingering pause.
  useEffect(() => () => {
    startedRef.current = false;
    if (pauseRef.current.timer) clearInterval(pauseRef.current.timer);
    pauseRef.current = { timer: null, onDone: null, active: false };
  }, []);

  const stopAll = useCallback(() => {
    startedRef.current = false;
    endPause(false);
    stop();
  }, [endPause, stop]);

  // App background → stop speech.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && startedRef.current) stopAll();
    });
    return () => sub.remove();
  }, [stopAll]);

  // Navigation away → cut speech immediately.
  useEffect(() => {
    const unsub = navigation?.addListener?.('beforeRemove', () => {
      try { stopAll(); } catch { /* swallow */ }
    });
    return unsub;
  }, [navigation, stopAll]);

  // Defensive clamp if segments shrink underneath us.
  useEffect(() => {
    if (segIdx >= segments.length) {
      if (mountedRef.current) setSegIdx(Math.max(0, segments.length - 1));
    }
  }, [segments.length, segIdx]);

  // ── 2-min reading-timer + auto check-in ─────────────────────────────────
  // Same logic as DevotionalReadingScreen so listening also earns the
  // user's daily devotional point. Backend dedupes per (email, date).
  const readingTimer = useReadingTimer({ enabled: true });
  useEffect(() => {
    return () => {
      const elapsed = readingTimer.getElapsedSeconds();
      if (elapsed < 120) return;
      AsyncStorage.getItem('userEmail').then((email) => {
        if (!email) return;
        silentReadingCheckIn(email, {
          source_type:      'devotional',
          duration_seconds: elapsed,
        });
      }).catch(() => {});
    };
  }, []);

  const skipPause     = () => endPause(true);
  const totalProgress = Math.round(((segIdx + (playing || pause.active ? 0.5 : 0)) / Math.max(1, segments.length)) * 100);
  const pausePct      = pause.total ? Math.round(((pause.total - pause.remain) / pause.total) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY }] }}>

        {/* TOP BAR */}
        <View style={s.topbar}>
          <TouchableOpacity
            onPress={() => { stopAll(); navigation.goBack(); }}
            activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor: tones.chipBg }]}
            accessibilityLabel={t('btn_back', 'Back')}
          >
            <ICONS.ArrowLeft color={tones.chipFg} size={20} sw={2} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.eyebrowTop, { color: tones.chipFg }]}>
              {t('ss_voice_eyebrow', 'DAILY DEVOTIONAL · AUDIO')}
            </Text>
            <Text style={[s.topTitle, { color: tk.textPrimary }]} numberOfLines={1}>
              {currentDay?.title || lessonTitle || t('dev_todays_reading', "Today's Reading")}
            </Text>
          </View>
          <View style={[s.iconBtn, { backgroundColor: 'transparent' }]} />
        </View>

        {/* ── HERO PLAYER ──────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <LinearGradient
            colors={[BLUE[800], INDIGO[600], BLUE[500]]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.player, AMBIENT_SHADOW]}
          >
            <Eyebrow color="rgba(255,255,255,0.78)">
              {pause.active
                ? t('ss_voice_reflection_pause', 'REFLECTION PAUSE')
                : playing
                  ? t('ss_voice_now_reading_caps', 'NOW READING')
                  : t('ss_voice_ready', 'READY TO PLAY')}
            </Eyebrow>
            <Text style={s.playerTitle} numberOfLines={2}>
              {currentDay?.title || lessonTitle || t('dev_todays_reading', "Today's Reading")}
            </Text>
            <Text style={s.playerSub} numberOfLines={1}>
              {pause.active
                ? t('ss_voice_pause_count', 'Praying… {n}s until next').replace('{n}', String(pause.remain))
                : segments[segIdx]?.title || t('ss_voice_press_play', 'Press play to begin')}
            </Text>

            <Visualiser playing={playing} />

            <View style={s.playerProgress}>
              <View style={[s.playerBar, { width: `${totalProgress}%` }]} />
            </View>
            <Text style={s.playerMeta}>
              {t('ss_voice_seg_of', 'Segment {i} of {n}')
                .replace('{i}', String(Math.min(segIdx + 1, segments.length)))
                .replace('{n}', String(segments.length))}
              {!supported && '  ·  ' + t('ss_voice_preview_mode', 'Preview mode')}
            </Text>

            {!!activeVoice && (
              <TouchableOpacity
                onPress={() => setVoicePickerOpen(true)}
                activeOpacity={0.8}
                style={s.voiceTag}
              >
                <Text style={s.voiceTagEmoji}>🗣</Text>
                <Text style={s.voiceTagTxt} numberOfLines={1}>
                  {activeVoice.label}
                  {activeVoice.name && activeVoice.name !== activeVoice.id ? `  ·  ${activeVoice.name}` : ''}
                </Text>
                <Text style={s.voiceTagChev}>›</Text>
              </TouchableOpacity>
            )}

            <View style={s.controlsRow}>
              <Circle
                symbol="«"
                onPress={() => jumpTo(segIdx - 1)}
                size={48}
                disabled={segIdx === 0}
              />
              {playing ? (
                <TouchableOpacity onPress={stopAll} activeOpacity={0.85} style={s.playBtn}>
                  <Text style={s.playBtnTxt}>❚❚</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => (startedRef.current ? jumpTo(segIdx) : playAll())}
                  activeOpacity={0.85}
                  style={s.playBtn}
                >
                  <Text style={s.playBtnTxt}>▶</Text>
                </TouchableOpacity>
              )}
              <Circle
                symbol="»"
                onPress={() => jumpTo(segIdx + 1)}
                size={48}
                disabled={segIdx === segments.length - 1}
              />
            </View>
          </LinearGradient>
        </View>

        {/* ── SEGMENT + SETTINGS LIST ─────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        >
          {/* Reflection-pause countdown */}
          {pause.active && (
            <View style={[s.pauseCard, { backgroundColor: tones.versePillBg }]}>
              <View style={s.pauseHead}>
                <Text style={[s.pauseEye, { color: tones.versePillFg }]}>
                  {t('ss_voice_reflection_pause', 'REFLECTION PAUSE')}
                </Text>
                <TouchableOpacity onPress={skipPause} activeOpacity={0.78} style={s.pauseSkip}>
                  <Text style={s.pauseSkipTxt}>{t('ss_voice_skip', 'Skip →')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[s.pauseRemain, { color: tones.versePillFg }]}>{pause.remain}s</Text>
              <Text style={[s.pauseBody, { color: tk.textSec }]}>
                {t('ss_voice_pray_quietly', 'Pray quietly. The next reading will continue automatically.')}
              </Text>
              <View style={[s.pauseBar, { backgroundColor: 'rgba(15,23,42,0.12)' }]}>
                <View style={[s.pauseBarFill, { width: `${pausePct}%`, backgroundColor: BLUE[600] }]} />
              </View>
            </View>
          )}

          {/* Reading speed */}
          <View style={{ marginBottom: 18 }}>
            <Eyebrow color={tones.chipFg}>{t('ss_voice_reading_speed', 'READING SPEED')}</Eyebrow>
            <View style={s.chipRow}>
              {[0.75, 0.9, 1.0, 1.15].map((r) => {
                const active = Math.abs(settings.rate - r) < 0.05;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => saveAudio({ rate: r })}
                    activeOpacity={0.85}
                    style={[s.chip, { backgroundColor: active ? BLUE[600] : tones.chipBg }]}
                  >
                    <Text style={[s.chipTxt, { color: active ? '#fff' : tones.chipFg }]}>
                      {r.toFixed(2)}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[s.helperTxt, { color: tk.textMuted }]}>
              {t('ss_voice_speed_helper',
                'Applied immediately — the current reading restarts at the new speed.')}
            </Text>
          </View>

          {/* Voice picker entry */}
          {supported && (
            <View style={{ marginBottom: 18 }}>
              <Eyebrow color={tones.chipFg}>{t('ss_voice_voice_label', 'VOICE')}</Eyebrow>
              <TouchableOpacity
                onPress={() => setVoicePickerOpen(true)}
                activeOpacity={0.85}
                style={[s.voiceRow, { backgroundColor: tones.chipBg }]}
              >
                <View style={[s.voiceRowIcon, { backgroundColor: tones.versePillBg }]}>
                  <Text style={{ fontSize: 18 }}>🗣</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.voiceRowName, { color: tk.textPrimary }]} numberOfLines={1}>
                    {activeVoice?.name || t('ss_voice_system_default', 'System default')}
                  </Text>
                  <Text style={[s.voiceRowMeta, { color: tk.textMuted }]} numberOfLines={1}>
                    {activeVoice?.label || t('ss_voice_auto', 'Auto')}
                    {activeVoice?.gender === 'male'   ? '  ·  ' + t('ss_voice_masc', 'Masculine') : ''}
                    {activeVoice?.gender === 'female' ? '  ·  ' + t('ss_voice_fem',  'Feminine')  : ''}
                    {activeVoice?.enhanced            ? '  ·  ' + t('ss_voice_enh',  'Enhanced')  : ''}
                  </Text>
                </View>
                <Text style={[s.voiceRowChev, { color: tones.chipFg }]}>
                  {t('ss_voice_change', 'Change ›')}
                </Text>
              </TouchableOpacity>
              <Text style={[s.helperTxt, { color: tk.textMuted }]}>
                {t('ss_voice_voice_helper',
                  "Choose a clearer voice if the default sounds muffled. The list comes from your device's installed voices.")}
              </Text>
            </View>
          )}

          {/* Reflection-pause picker */}
          <View style={{ marginBottom: 18 }}>
            <Eyebrow color={tones.chipFg}>
              {t('ss_voice_pause_between', 'PRAYER TIME BETWEEN READINGS')}
            </Eyebrow>
            <View style={s.chipRow}>
              {PAUSE_OPTIONS.map((opt) => {
                const active = (Number(settings.pauseSec) || 0) === opt.sec;
                return (
                  <TouchableOpacity
                    key={opt.sec}
                    onPress={() => saveAudio({ pauseSec: opt.sec })}
                    activeOpacity={0.85}
                    style={[s.chip, { backgroundColor: active ? BLUE[600] : tones.chipBg }]}
                  >
                    <Text style={[s.chipTxt, { color: active ? '#fff' : tones.chipFg }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[s.helperTxt, { color: tk.textMuted }]}>
              {t('ss_voice_pause_helper',
                'The reader will pause after each segment so you can pray on it before moving on.')}
            </Text>
          </View>

          {/* Reading list */}
          <Eyebrow color={tones.chipFg}>{t('ss_voice_reading', 'READING')}</Eyebrow>
          <View style={{ marginTop: 10, gap: 10 }}>
            {segments.length === 0 ? (
              <View style={[s.emptyCard, { backgroundColor: tones.glassFill, borderColor: tones.glassEdge }]}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>📖</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: tk.textPrimary, textAlign: 'center' }}>
                  {t('ss_voice_empty', 'Nothing to read yet')}
                </Text>
                <Text style={{ fontSize: 12, color: tk.textMuted, textAlign: 'center', marginTop: 6 }}>
                  {t('ss_voice_empty_sub', 'Open this devotional from a lesson to load its content.')}
                </Text>
              </View>
            ) : (
              segments.map((seg, i) => (
                <Segment
                  key={seg.id}
                  seg={seg}
                  active={i === segIdx}
                  tk={tk}
                  tones={tones}
                  onPress={() => jumpTo(i)}
                />
              ))
            )}
          </View>

          {!supported && (
            <View style={[s.previewCard, { backgroundColor: tones.glassFill, borderColor: tones.glassEdge }]}>
              <Text style={[s.previewLbl, { color: AMBER[600] }]}>
                {t('ss_voice_preview_mode_caps', 'PREVIEW MODE')}
              </Text>
              <Text style={[s.previewBody, { color: tk.textSec }]}>
                {t('ss_voice_preview_body',
                  'On-device text-to-speech is not available in this build. The controls and segment pacing still work so you can preview the experience. Install expo-speech to enable real voice playback.')}
              </Text>
            </View>
          )}
        </ScrollView>

      </Animated.View>

      {/* Voice picker bottom sheet */}
      <VoicePicker
        visible={voicePickerOpen}
        voices={voiceCatalogue}
        autoVoice={voice}
        selectedId={settings.voice || null}
        onClose={() => setVoicePickerOpen(false)}
        onPick={async (id) => {
          try { await saveAudio({ voice: id || null }); }
          catch { /* persistence is best-effort */ }
          if (!mountedRef.current) return;
          setVoicePickerOpen(false);
          // If we're currently playing, restart the current segment with
          // the new voice so the change applies right away.
          if (startedRef.current && playing) {
            setTimeout(() => {
              if (mountedRef.current && startedRef.current) speakSegment(segIdx);
            }, 80);
          }
        }}
        tk={tk}
        tones={tones}
        t={t}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
const VoicePicker = ({ visible, voices, autoVoice, selectedId, onClose, onPick, tk, tones, t }) => {
  const groups = useMemo(() => {
    const map = new Map();
    (voices || []).forEach((v) => {
      const key = v.label || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(v);
    });
    return Array.from(map.entries());
  }, [voices]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={vp.backdrop} onPress={onClose} />
      <View style={[vp.sheet, { backgroundColor: tk.surface || '#FFFFFF' }]}>
        <View style={vp.handle} />
        <View style={vp.head}>
          <View style={{ flex: 1 }}>
            <Text style={[vp.eyebrow, { color: tones.chipFg }]}>
              {t('ss_voice_picker_eyebrow', 'READING VOICE')}
            </Text>
            <Text style={[vp.title, { color: tk.textPrimary }]}>
              {t('ss_voice_picker_title', 'Choose a voice')}
            </Text>
            <Text style={[vp.sub, { color: tk.textMuted }]}>
              {voices?.length
                ? t('ss_voice_picker_count', '{n} voices installed on this device')
                    .replace('{n}', String(voices.length))
                : t('ss_voice_picker_none', 'No voices reported by the device.')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}
            style={[vp.closeBtn, { backgroundColor: tones.chipBg }]}>
            <Text style={[vp.closeBtnTxt, { color: tones.chipFg }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* "Use auto" — clears the override. */}
          <TouchableOpacity
            onPress={() => onPick(null)}
            activeOpacity={0.85}
            style={[vp.row, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}
          >
            <View style={[vp.dot, {
              borderColor:     !selectedId ? BLUE[600] : tones.chipFg,
              backgroundColor: !selectedId ? BLUE[600] : 'transparent',
            }]} />
            <View style={{ flex: 1 }}>
              <Text style={[vp.rowName, { color: tk.textPrimary }]}>
                {t('ss_voice_system_default', 'System default')}
              </Text>
              <Text style={[vp.rowMeta, { color: tk.textMuted }]} numberOfLines={1}>
                {autoVoice
                  ? t('ss_voice_auto_picked', 'Auto-picked: {name} · {label}')
                      .replace('{name}', autoVoice.name)
                      .replace('{label}', autoVoice.label)
                  : t('ss_voice_auto_helper', 'Pick the clearest available voice automatically')}
              </Text>
            </View>
          </TouchableOpacity>

          {groups.map(([label, list]) => (
            <View key={label} style={{ marginTop: 14 }}>
              <Text style={[vp.groupLbl, { color: tones.chipFg }]}>
                {label.toUpperCase()}
              </Text>
              {list.map((v) => {
                const active = selectedId === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => onPick(v.id)}
                    activeOpacity={0.85}
                    style={[vp.row, {
                      backgroundColor: active ? BLUE[50] : tones.glassFill,
                      marginTop: 6,
                    }]}
                  >
                    <View style={[vp.dot, {
                      borderColor:     active ? BLUE[600] : tones.chipFg,
                      backgroundColor: active ? BLUE[600] : 'transparent',
                    }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[vp.rowName, { color: tk.textPrimary }]} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <View style={vp.rowChips}>
                        {v.gender === 'male'   && <SmallChip label={t('ss_voice_masc','Masculine')} color={BLUE[600]} />}
                        {v.gender === 'female' && <SmallChip label={t('ss_voice_fem','Feminine')}   color={INDIGO[600]} />}
                        {v.enhanced            && <SmallChip label={t('ss_voice_enh','Enhanced')}   color={EMERALD[500]} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const SmallChip = ({ label, color }) => (
  <View style={{
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    backgroundColor: color + '22', marginRight: 6, marginTop: 4,
  }}>
    <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.4, color }}>
      {label.toUpperCase()}
    </Text>
  </View>
);

const Circle = ({ symbol, onPress, size, disabled }) => (
  <TouchableOpacity
    onPress={disabled ? undefined : onPress}
    disabled={disabled}
    activeOpacity={0.78}
    style={{
      width: size, height: size, borderRadius: size / 2,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      opacity: disabled ? 0.35 : 1,
    }}
  >
    <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{symbol}</Text>
  </TouchableOpacity>
);

const Segment = ({ seg, active, tk, tones, onPress }) => {
  const accent =
    seg.kind === 'scripture'   ? INDIGO[600]   :
    seg.kind === 'prayer'      ? BLUE[600]     :
    seg.kind === 'reflection'  ? '#7C3AED'     :
    seg.kind === 'application' ? AMBER[600]    :
                                  tones.chipFg;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View
        style={[
          s.seg,
          {
            backgroundColor: active ? BLUE[600] + '14' : tones.glassFill,
            borderLeftWidth: 4,
            borderLeftColor: active ? BLUE[600] : 'transparent',
          },
        ]}
      >
        <View style={s.segHead}>
          <Text style={[s.segLbl, { color: accent }]}>{seg.title.toUpperCase()}</Text>
          {active && <View style={s.activeDot} />}
        </View>
        <Text style={[s.segBody, { color: tk.textPrimary, opacity: active ? 1 : 0.85 }]}>
          {seg.body}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Animated vertical bars to suggest sound activity.
const Visualiser = ({ playing }) => {
  const bars = useRef([0, 1, 2, 3, 4, 5, 6].map(() => new Animated.Value(0.35))).current;
  useEffect(() => {
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 0.4 + Math.random() * 0.6, duration: 350 + i * 60, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(b, { toValue: 0.25 + Math.random() * 0.3, duration: 350 + i * 60, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        ]),
      ),
    );
    if (playing) loops.forEach((l) => l.start());
    else {
      loops.forEach((l) => l.stop());
      bars.forEach((b) => b.setValue(0.18));
    }
    return () => loops.forEach((l) => l.stop());
  }, [playing]); // eslint-disable-line
  return (
    <View style={s.viz}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            s.vizBar,
            { height: v.interpolate({ inputRange: [0, 1], outputRange: [4, 36] }) },
          ]}
        />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  iconBtn:    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  eyebrowTop: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  topTitle:   { fontSize: 16, fontWeight: '800', marginTop: 2, maxWidth: 220, textAlign: 'center' },

  // Hero player
  player:        { padding: 22, borderRadius: RADII.xl, alignItems: 'center' },
  playerTitle:   { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 6, letterSpacing: -0.4, lineHeight: 28 },
  playerSub:     { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.78)', marginTop: 4 },
  playerProgress:{ width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 14, overflow: 'hidden' },
  playerBar:     { height: 4, borderRadius: 2, backgroundColor: '#fff' },
  playerMeta:    { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.78)', marginTop: 8, letterSpacing: 0.5 },

  // Voice tag inside the hero
  voiceTag:      {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 8,
  },
  voiceTagEmoji: { fontSize: 11 },
  voiceTagTxt:   { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.3, maxWidth: 220 },
  voiceTagChev:  { fontSize: 14, fontWeight: '900', color: '#fff', marginLeft: 4 },

  // Inline voice row (settings panel)
  voiceRow:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: RADII.md, marginTop: 10,
  },
  voiceRowIcon:  { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  voiceRowName:  { fontSize: 14.5, fontWeight: '900', letterSpacing: -0.2 },
  voiceRowMeta:  { fontSize: 12, fontWeight: '600', marginTop: 2 },
  voiceRowChev:  { fontSize: 12.5, fontWeight: '900', letterSpacing: 0.3 },

  controlsRow:   { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18 },
  playBtn:       {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 6,
  },
  playBtnTxt:    { fontSize: 22, fontWeight: '900', color: BLUE[700] },

  viz:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 40, marginTop: 12 },
  vizBar: { width: 5, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 3 },

  // Reading list cards
  seg:       { padding: 14, borderRadius: RADII.md },
  segHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  segLbl:    { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  segBody:   { fontSize: 14.5, lineHeight: 22, fontWeight: '500' },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE[600] },

  // Chip pickers (speed + reflection time)
  chipRow:  { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip:     { flex: 1, paddingVertical: 10, borderRadius: RADII.pill, alignItems: 'center' },
  chipTxt:  { fontSize: 12.5, fontWeight: '900' },

  helperTxt:  { fontSize: 11.5, fontWeight: '600', marginTop: 8, lineHeight: 16 },

  // Reflection pause card
  pauseCard:   { padding: 16, borderRadius: RADII.lg, marginBottom: 16 },
  pauseHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pauseEye:    { fontSize: 10.5, fontWeight: '900', letterSpacing: 2.2 },
  pauseSkip:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.10)' },
  pauseSkipTxt:{ fontSize: 11, fontWeight: '900', letterSpacing: 0.4, color: BLUE[700] },
  pauseRemain: { fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 6, lineHeight: 40 },
  pauseBody:   { fontSize: 12.5, fontWeight: '600', marginTop: 4, lineHeight: 18 },
  pauseBar:    { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12 },
  pauseBarFill:{ height: 6, borderRadius: 3 },

  // Empty + preview cards
  emptyCard:   { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center' },
  previewCard: { borderRadius: RADII.md, borderWidth: 1, padding: 14, marginTop: 18 },
  previewLbl:  { fontSize: 10.5, fontWeight: '900', letterSpacing: 2.2, marginBottom: 6 },
  previewBody: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
});

// Voice-picker modal styles, kept local so the main `s` sheet doesn't get
// muddled with modal-only concerns.
const vp = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8, 14, 30, 0.55)' },
  sheet:    {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
    borderTopLeftRadius:  28, borderTopRightRadius: 28,
    maxHeight: '82%',
    shadowColor: '#0B2A6B', shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18, shadowRadius: 28, elevation: 20,
  },
  handle:   {
    alignSelf: 'center', width: 44, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.18)', marginBottom: 12,
  },
  head:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  eyebrow:     { fontSize: 10, fontWeight: '900', letterSpacing: 2.4 },
  title:       { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },
  sub:         { fontSize: 12, fontWeight: '600', marginTop: 3 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeBtnTxt: { fontSize: 14, fontWeight: '900' },

  groupLbl:    { fontSize: 10.5, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: RADII.md },
  dot:         { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  rowName:     { fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  rowMeta:     { fontSize: 12, fontWeight: '600', marginTop: 2 },
  rowChips:    { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
});
