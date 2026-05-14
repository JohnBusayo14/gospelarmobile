// screen/victory/VictoryAudioPlayer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Hands-free "Listen to today's prayer" experience.
//
// Renders the day's content as a vertical reading panel and runs a simulated
// (or, if expo-speech is installed at runtime, real) text-to-speech read of:
//   1. Date + focus           — opening
//   2. Scripture reference    — emphasised
//   3. Inspirational message
//   4. Prayer points          — numbered, paced
//   5. Special intercession   — closing
//
// Below the controls is the Ambient Background picker (piano / strings / rain
// / choir / off) — saves to victoryStore so the choice persists.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Easing, Modal, Pressable, Platform, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }     from '../../context/ThemeContext';
import { getTokens }    from '../../theme/tokens';
import { useScreenEntry } from '../../hooks/useFluidAnim';
import { useVictoryDay, useVictoryDays } from '../../hooks/useVictoryContent';
import {
  GlassCard, BackBar, Eyebrow, ProgressBar, GradientCTA,
} from './VictoryUI';
import {
  BLUE, INDIGO, EMERALD, AMBER, ROSE, RADII, AMBIENT_SHADOW, victoryTones,
} from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import { useTTS, useAudioSettings, getVoiceCatalogue } from './victoryHooks';

// "Reflection pause" choices — silent time inserted between segments so the
// listener can pray on what was just read before the reader continues.
const PAUSE_OPTIONS = [
  { sec: 0,   label: 'Off'  },
  { sec: 10,  label: '10s'  },
  { sec: 30,  label: '30s'  },
  { sec: 60,  label: '1 min' },
  { sec: 120, label: '2 min' },
];

// ── Reflection-pause overlay ─────────────────────────────────────────────────
// Full-screen modal that takes over while the voice reader is between
// segments. Three shock-wave rings emanate outward from a pulsing central
// orb that shows the remaining seconds. Tapping anywhere on the screen
// dismisses the pause (calls onSkip — same effect as the old "Skip →"
// button). Transparent backdrop with a gradient wash in the accent colour;
// uses RN's native Modal so it stays above the audio player UI and survives
// status bar / nav bar correctly on Android.
function ReflectionPauseOverlay({ visible, remain, total, onSkip, accent = BLUE[600] }) {
  // One Animated.Value per shockwave ring. They run on a continuous loop with
  // a staggered start so the user sees a regular "explosion" pulse rather
  // than three rings firing in sync.
  const r0 = useRef(new Animated.Value(0)).current;
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  // Central orb breathes between 1.0× and 1.08× scale.
  const pulse = useRef(new Animated.Value(1)).current;
  // Backdrop fades in on activation so dismissal feels intentional.
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      backdrop.setValue(0);
      return undefined;
    }
    Animated.timing(backdrop, {
      toValue: 1, duration: 260, useNativeDriver: true,
    }).start();

    const ringLoop = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 2100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          // Snap back to 0 instantly so the next iteration starts small.
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );

    const loops = [ringLoop(r0, 0), ringLoop(r1, 700), ringLoop(r2, 1400)];
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08, duration: 900,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1.0,  duration: 900,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    );
    loops.forEach((l) => l.start());
    pulseLoop.start();
    return () => {
      loops.forEach((l) => l.stop());
      pulseLoop.stop();
    };
  }, [visible, r0, r1, r2, pulse, backdrop]);

  const ringStyle = (v) => ({
    opacity: v.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.7, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 2.9] }) }],
  });

  const pct = total ? Math.max(0, Math.min(1, (total - remain) / total)) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <Pressable
        onPress={onSkip}
        style={s.overlayRoot}
        accessibilityRole="button"
        accessibilityLabel="Skip reflection pause"
      >
        {/* Soft gradient backdrop — accent at top + bottom, dark wash in the
            middle so the orb pops without feeling like a hard scrim. */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdrop }]}>
          <LinearGradient
            colors={[`${accent}3a`, '#000000aa', `${accent}3a`]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Shockwave rings (not interactive so taps fall through to the root). */}
        <View pointerEvents="none" style={s.overlayCenter}>
          <Animated.View style={[s.shockRing, { borderColor: accent }, ringStyle(r0)]} />
          <Animated.View style={[s.shockRing, { borderColor: accent }, ringStyle(r1)]} />
          <Animated.View style={[s.shockRing, { borderColor: accent }, ringStyle(r2)]} />

          {/* Pulsing central orb with the countdown number. */}
          <Animated.View style={[s.overlayOrb, { transform: [{ scale: pulse }] }]}>
            <LinearGradient
              colors={[accent, '#1a1a2e', accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={s.overlayOrbInner}>
              <Text style={s.overlayEye}>REFLECTION PAUSE</Text>
              <Text style={s.overlayNum}>{remain}</Text>
              <Text style={s.overlayBody}>Praying…</Text>
              <View style={s.overlayProgressTrack}>
                <View style={[s.overlayProgressFill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
            </View>
          </Animated.View>
        </View>

        <View pointerEvents="none" style={s.overlayHintWrap}>
          <Text style={s.overlayHint}>Tap anywhere to continue ›</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function VictoryAudioPlayer({ route, navigation }) {
  // Pull the days list from the backend so TOTAL_DAYS is admin-driven; the
  // hook returns the bundled fallback synchronously on first render, so the
  // clamp below works immediately.
  const { days: allDays } = useVictoryDays(navigation);
  const TOTAL_DAYS = allDays?.length || 30;
  const dayNum = Math.max(1, Math.min(TOTAL_DAYS, Number(route?.params?.day) || 1));
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  // Full day body comes from the backend (admin-editable copy). Bundled
  // fallback is provided by the hook on first render.
  const { day: dayDb } = useVictoryDay(dayNum, navigation);
  const day = dayDb || { date: '', focus: '', scripture: '', message: '', prayer_points: [], intercession: '' };

  const { speak, stop, playing, supported, voice } = useTTS();
  const { settings, save: saveAudio }              = useAudioSettings();

  // All English voices available on the device — populated once on mount and
  // reused by the voice-picker modal.
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

  // Build the script that the reader walks through. Each segment becomes a
  // visual card with its own "now reading" indicator.
  const segments = useMemo(() => {
    const list = [];
    list.push({ id: 'intro',     kind: 'intro',     title: 'Today', body: `${day.date}. Day ${dayNum} of ${TOTAL_DAYS}. ${day.focus}.` });
    if (day.scripture)     list.push({ id: 'scripture',  kind: 'scripture', title: 'Scripture', body: day.scripture });
    if (day.message)       list.push({ id: 'message',    kind: 'message',   title: 'Message',   body: day.message });
    (day.prayer_points || []).forEach((p, i) =>
      list.push({ id: `pt-${i}`,  kind: 'point', index: i + 1, title: `Prayer point ${i + 1}`, body: p })
    );
    if (day.intercession)  list.push({ id: 'inter',      kind: 'inter', title: 'Special intercession', body: day.intercession });
    return list;
  }, [dayNum, day, TOTAL_DAYS]);

  const [segIdx, setSegIdx] = useState(0);
  const scrollRef = useRef(null);

  // Component lifecycle ref — every state setter is gated on this so async
  // callbacks (TTS, setInterval, AppState) can't update an unmounted tree.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const safeSet = useCallback((setter) => (...args) => {
    if (mountedRef.current) setter(...args);
  }, []);

  // Pause / "reflection time" state — when the user configures a non-zero
  // pauseSec, after each segment finishes we count down on screen before
  // moving to the next one. The user can tap Skip to bypass.
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
      try { fn(); } catch { /* swallow callback errors */ }
    }
  }, []);

  const startPause = useCallback((sec, onDone) => {
    // Ensure any prior pause is cleared before starting a new one.
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

  // Walk through segments one-by-one when in play mode.
  const startedRef = useRef(false);

  const playAll = () => {
    if (!segments.length || !mountedRef.current) return;
    startedRef.current = true;
    endPause(false);            // cancel any lingering pause
    setSegIdx(0);
    speakSegment(0);
  };

  // Jump straight to a specific segment and start reading from there.
  // Used by the «/» controls and by tapping a segment card. Defensive: any
  // out-of-range / NaN index is clamped, and ignored if the page is gone.
  const jumpTo = (i) => {
    if (!segments.length || !mountedRef.current) return;
    const target = Math.max(0, Math.min(segments.length - 1, Number(i) || 0));
    startedRef.current = true;
    endPause(false);
    stop();                     // cancel current utterance immediately
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
      // Empty / malformed segment — skip ahead so a bad day can't stall the
      // whole sequence.
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

  // The TTS fallback doesn't expose per-segment onDone, so we approximate
  // pacing on a timer if we used the simulator path.
  useEffect(() => {
    if (!startedRef.current) return;
    if (supported) return;     // expo-speech wires its own onDone
    if (pause.active) return;  // already paused — handled by startPause
    const body = segments[segIdx]?.body || '';
    if (!body) return;
    const words = String(body).trim().split(/\s+/).length;
    const ms = Math.min(15000, Math.max(2000, words * 220));
    const t = setTimeout(() => {
      if (!mountedRef.current || !startedRef.current) return;
      const next = segIdx + 1;
      if (next >= segments.length) { startedRef.current = false; return; }
      const pauseSec = Number(settings.pauseSec) || 0;
      if (pauseSec > 0) startPause(pauseSec, () => mountedRef.current && setSegIdx(next));
      else if (mountedRef.current) setSegIdx(next);
    }, ms);
    return () => clearTimeout(t);
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
  }, [settings.rate]);  // eslint-disable-line

  // Keep the active segment in view. Wrapped in try/catch because scrollTo
  // can throw on Android if the ScrollView host has been disposed mid-frame.
  useEffect(() => {
    if (!mountedRef.current) return;
    try { scrollRef.current?.scrollTo({ y: segIdx * 132, animated: true }); }
    catch { /* harmless */ }
  }, [segIdx]);

  // Clean up the pause timer on unmount so it doesn't fire after navigating
  // away. The TTS hook handles its own cleanup; we just make sure no
  // interval keeps ticking on a dead tree.
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

  // ── Interruption handling ─────────────────────────────────────────────────
  // 1. App moves to background → stop speech so it doesn't keep reading
  //    audibly behind the user's back, then resume nothing on return (user
  //    decides when to play again).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && startedRef.current) {
        stopAll();
      }
    });
    return () => sub.remove();
  }, [stopAll]);

  // 2. User navigates away (back gesture, hardware back, etc.) → cut speech
  //    immediately rather than waiting for unmount, so they never hear a
  //    stray syllable after the screen has slid off.
  useEffect(() => {
    const unsub = navigation?.addListener?.('beforeRemove', () => {
      try { stopAll(); } catch { /* swallow */ }
    });
    return unsub;
  }, [navigation, stopAll]);

  // 3. Defensive: if the segments array somehow shrinks (route param change
  //    landing on a different day mid-flight), clamp segIdx so we never index
  //    past the end.
  useEffect(() => {
    if (segIdx >= segments.length) {
      if (mountedRef.current) setSegIdx(Math.max(0, segments.length - 1));
    }
  }, [segments.length, segIdx]);

  const skipPause = () => endPause(true);

  const totalProgress = Math.round(((segIdx + (playing || pause.active ? 0.5 : 0)) / Math.max(1, segments.length)) * 100);
  const pausePct = pause.total ? Math.round(((pause.total - pause.remain) / pause.total) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.85} />

      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY }] }}>
        <BackBar
          onBack={() => { stopAll(); navigation.goBack(); }}
          eyebrow={`DAY ${dayNum} · AUDIO`}
          title={day.focus?.slice(0, 32) || "Listen"}
          tones={tones}
          tk={tk}
        />

        {/* ── HERO PLAYER ───────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <LinearGradient
            colors={[BLUE[800], INDIGO[600], BLUE[500]]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.player, AMBIENT_SHADOW]}
          >
            <Eyebrow color="rgba(255,255,255,0.78)">
              {pause.active ? 'REFLECTION PAUSE' : playing ? 'NOW READING' : 'READY TO PLAY'}
            </Eyebrow>
            <Text style={s.playerTitle} numberOfLines={2}>{day.focus}</Text>
            <Text style={s.playerSub}>
              {pause.active
                ? `Praying… ${pause.remain}s until next`
                : segments[segIdx]?.title || 'Press play to begin'}
            </Text>

            {/* Visualiser bars */}
            <Visualiser playing={playing} />

            {/* Progress */}
            <View style={s.playerProgress}>
              <View style={[s.playerBar, { width: `${totalProgress}%` }]} />
            </View>
            <Text style={s.playerMeta}>
              Segment {Math.min(segIdx + 1, segments.length)} of {segments.length}
              {!supported && '  ·  Preview mode'}
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

            {/* Controls */}
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

        {/* ── SEGMENT LIST ──────────────────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        >
          {/* Reflection-pause overlay renders below — outside this ScrollView
              so it takes over the full screen. Tapping anywhere on the
              overlay calls skipPause(). */}

          {/* Speed picker */}
          <View style={{ marginBottom: 18 }}>
            <Eyebrow color={tones.chipFg}>READING SPEED</Eyebrow>
            <View style={s.speedRow}>
              {[0.75, 0.9, 1.0, 1.15].map((r) => {
                const active = Math.abs(settings.rate - r) < 0.05;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => saveAudio({ rate: r })}
                    activeOpacity={0.85}
                    style={[
                      s.speedChip,
                      {
                        backgroundColor: active ? BLUE[600] : tones.chipBg,
                      },
                    ]}
                  >
                    <Text style={[s.speedChipTxt, { color: active ? '#fff' : tones.chipFg }]}>
                      {r.toFixed(2)}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[s.helperTxt, { color: tk.textMuted }]}>
              Applied immediately — the current reading restarts at the new speed.
            </Text>
          </View>

          {/* Voice picker */}
          {supported && (
            <View style={{ marginBottom: 18 }}>
              <Eyebrow color={tones.chipFg}>VOICE</Eyebrow>
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
                    {activeVoice?.name || 'System default'}
                  </Text>
                  <Text style={[s.voiceRowMeta, { color: tk.textMuted }]} numberOfLines={1}>
                    {activeVoice?.label || 'Auto'}
                    {activeVoice?.gender === 'male'   ? '  ·  Masculine' : ''}
                    {activeVoice?.gender === 'female' ? '  ·  Feminine'  : ''}
                    {activeVoice?.enhanced            ? '  ·  Enhanced'  : ''}
                  </Text>
                </View>
                <Text style={[s.voiceRowChev, { color: tones.chipFg }]}>Change ›</Text>
              </TouchableOpacity>
              <Text style={[s.helperTxt, { color: tk.textMuted }]}>
                Choose a clearer voice if the default sounds muffled. The list comes from your device's installed voices.
              </Text>
            </View>
          )}

          {/* Reflection-pause picker */}
          <View style={{ marginBottom: 18 }}>
            <Eyebrow color={tones.chipFg}>PRAYER TIME BETWEEN READINGS</Eyebrow>
            <View style={s.speedRow}>
              {PAUSE_OPTIONS.map((opt) => {
                const active = (Number(settings.pauseSec) || 0) === opt.sec;
                return (
                  <TouchableOpacity
                    key={opt.sec}
                    onPress={() => saveAudio({ pauseSec: opt.sec })}
                    activeOpacity={0.85}
                    style={[
                      s.speedChip,
                      { backgroundColor: active ? BLUE[600] : tones.chipBg },
                    ]}
                  >
                    <Text style={[s.speedChipTxt, { color: active ? '#fff' : tones.chipFg }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[s.helperTxt, { color: tk.textMuted }]}>
              The reader will pause after each segment so you can pray on it before moving on.
            </Text>
          </View>

          {/* Reading panel */}
          <Eyebrow color={tones.chipFg}>READING</Eyebrow>
          <View style={{ marginTop: 10, gap: 10 }}>
            {segments.map((seg, i) => (
              <Segment
                key={seg.id}
                seg={seg}
                active={i === segIdx}
                tk={tk}
                tones={tones}
                onPress={() => jumpTo(i)}
              />
            ))}
          </View>

          {!supported && (
            <GlassCard tones={tones} style={{ marginTop: 18 }} padding={14}>
              <Text style={[s.previewLbl, { color: AMBER[600] }]}>PREVIEW MODE</Text>
              <Text style={[s.previewBody, { color: tk.textSec }]}>
                On-device text-to-speech is not available in this build. The
                controls and segment pacing still work so you can preview the
                experience. Install expo-speech to enable real voice playback.
              </Text>
            </GlassCard>
          )}
        </ScrollView>
      </Animated.View>

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
          // If we're currently playing, restart the current segment with the
          // new voice so the change applies right away. Guarded so it can't
          // run after the screen has been left.
          if (startedRef.current && playing) {
            setTimeout(() => {
              if (mountedRef.current && startedRef.current) speakSegment(segIdx);
            }, 80);
          }
        }}
        tk={tk}
        tones={tones}
      />

      {/* ── Reflection-pause overlay (sits above the player UI) ──────────── */}
      <ReflectionPauseOverlay
        visible={pause.active}
        remain={pause.remain}
        total={pause.total}
        accent={BLUE[600]}
        onSkip={skipPause}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
const VoicePicker = ({ visible, voices, autoVoice, selectedId, onClose, onPick, tk, tones }) => {
  // Group by language for a tidy list. Inside each group the catalogue is
  // already sorted by quality + gender.
  const groups = useMemo(() => {
    const map = new Map();
    (voices || []).forEach((v) => {
      const key = v.label || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(v);
    });
    return Array.from(map.entries()); // [[label, voices[]], ...]
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
      <View style={[vp.sheet, { backgroundColor: tk.surface }]}>
        <View style={vp.handle} />
        <View style={vp.head}>
          <View style={{ flex: 1 }}>
            <Text style={[vp.eyebrow, { color: tones.chipFg }]}>READING VOICE</Text>
            <Text style={[vp.title, { color: tk.textPrimary }]}>Choose a voice</Text>
            <Text style={[vp.sub, { color: tk.textMuted }]}>
              {voices?.length
                ? `${voices.length} voice${voices.length === 1 ? '' : 's'} installed on this device`
                : 'No voices reported by the device.'}
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
          {/* "Use auto" option clears the override and reverts to the picker's
              auto-selected voice. */}
          <TouchableOpacity
            onPress={() => onPick(null)}
            activeOpacity={0.85}
            style={[vp.row, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}
          >
            <View style={[vp.dot, { borderColor: !selectedId ? BLUE[600] : tones.chipFg, backgroundColor: !selectedId ? BLUE[600] : 'transparent' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[vp.rowName, { color: tk.textPrimary }]}>System default</Text>
              <Text style={[vp.rowMeta, { color: tk.textMuted }]} numberOfLines={1}>
                {autoVoice
                  ? `Auto-picked: ${autoVoice.name} · ${autoVoice.label}`
                  : 'Pick the clearest available voice automatically'}
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
                    style={[
                      vp.row,
                      { backgroundColor: active ? BLUE[50] : tones.glassFill, marginTop: 6 },
                    ]}
                  >
                    <View style={[
                      vp.dot,
                      {
                        borderColor:     active ? BLUE[600] : tones.chipFg,
                        backgroundColor: active ? BLUE[600] : 'transparent',
                      },
                    ]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[vp.rowName, { color: tk.textPrimary }]} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <View style={vp.rowChips}>
                        {v.gender === 'male'   && <SmallChip label="Masculine" color={BLUE[600]} />}
                        {v.gender === 'female' && <SmallChip label="Feminine"  color={INDIGO[600]} />}
                        {v.enhanced            && <SmallChip label="Enhanced"  color={EMERALD[500]} />}
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
    seg.kind === 'scripture' ? INDIGO[600] :
    seg.kind === 'point'     ? BLUE[600]   :
    seg.kind === 'inter'     ? AMBER[600]  :
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
          {active && (
            <View style={s.activeDot} />
          )}
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
  }, [playing]);    // eslint-disable-line
  return (
    <View style={s.viz}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            s.vizBar,
            {
              height: v.interpolate({ inputRange: [0, 1], outputRange: [4, 36] }),
            },
          ]}
        />
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  player:        { padding: 22, borderRadius: RADII.xl, alignItems: 'center' },
  playerTitle:   { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 6, letterSpacing: -0.4, lineHeight: 28 },
  playerSub:     { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.78)', marginTop: 4 },
  playerProgress:{ width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 14, overflow: 'hidden' },
  playerBar:     { height: 4, borderRadius: 2, backgroundColor: '#fff' },
  playerMeta:    { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.78)', marginTop: 8, letterSpacing: 0.5 },
  voiceTag:      {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 8,
  },
  voiceTagEmoji: { fontSize: 11 },
  voiceTagTxt:   { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.3, maxWidth: 200 },
  voiceTagChev:  { fontSize: 14, fontWeight: '900', color: '#fff', marginLeft: 4 },

  // Inline voice row (in the settings panel below the hero)
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

  // Reading list
  seg:     { padding: 14, borderRadius: RADII.md },
  segHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  segLbl:  { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  segBody: { fontSize: 14.5, lineHeight: 22, fontWeight: '500' },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE[600] },

  // Speed picker
  speedRow:       { flexDirection: 'row', gap: 8, marginTop: 10 },
  speedChip:      { flex: 1, paddingVertical: 10, borderRadius: RADII.pill, alignItems: 'center' },
  speedChipTxt:   { fontSize: 12.5, fontWeight: '900' },

  previewLbl:  { fontSize: 10.5, fontWeight: '900', letterSpacing: 2.2, marginBottom: 6 },
  previewBody: { fontSize: 13, lineHeight: 19, fontWeight: '500' },

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

  // ── Reflection-pause overlay ──────────────────────────────────────────────
  overlayRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 260,
    height: 260,
  },
  // Concentric shockwave rings. Sized so the smallest scale (0.55) still
  // appears around the orb (220) and the largest (2.9) reaches well past
  // the edge of the screen on typical phones.
  shockRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 3,
  },
  // Central orb. Gradient lives inside an absolutely-positioned LinearGradient;
  // overflow:'hidden' on the orb clips the gradient + inner column.
  overlayOrb: {
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 22,
  },
  overlayOrbInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  overlayEye: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 2.6,
    opacity: 0.92,
  },
  overlayNum: {
    color: '#fff',
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2.6,
    lineHeight: 78,
    marginTop: 4,
  },
  overlayBody: {
    color: '#fff',
    opacity: 0.92,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
  overlayProgressTrack: {
    width: 150,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 14,
    overflow: 'hidden',
  },
  overlayProgressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  overlayHintWrap: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  overlayHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  helperTxt:   { fontSize: 11.5, fontWeight: '600', marginTop: 8, lineHeight: 16 },
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
  head:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  eyebrow:  { fontSize: 10, fontWeight: '900', letterSpacing: 2.4 },
  title:    { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },
  sub:      { fontSize: 12, fontWeight: '600', marginTop: 3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeBtnTxt: { fontSize: 14, fontWeight: '900' },

  groupLbl: { fontSize: 10.5, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  row:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: RADII.md,
  },
  dot:      {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
  },
  rowName:  { fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  rowMeta:  { fontSize: 12, fontWeight: '600', marginTop: 2 },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
});
