// screen/victory/VictoryReadingMode.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Focused, distraction-free reading view of a single Victory Month day. Each
// segment of the day (intro · scripture · message · each prayer point ·
// intercession) is shown one at a time on a large, calm page. Users move
// through them with Prev / Next; the last segment surfaces a "Mark as prayed"
// CTA that respects the same 2-minute dwell gate as the regular day screen.
//
// Why a separate screen?
//   • The regular day screen shows everything scrollable — great for
//     skimming, busy for prayer.
//   • Reading mode strips chrome, breaks content into "pages", and lets the
//     user pray a single point with their full attention.
//
// Information architecture per segment:
//   • intro      — date + day-of-30 + focus
//   • scripture  — the reference + cue to open the Bible
//   • message    — the inspirational message
//   • point[i]   — one prayer point, numbered
//   • inter      — special intercession (focal prayer)
//
// Navigation:
//   • Prev / Next pills at the bottom
//   • Top bar exposes the position pill (e.g. "3 / 12") and a close button
//   • Top progress dots give an at-a-glance map; tapping a dot jumps
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Dimensions, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { useTheme }      from '../../context/ThemeContext';
import { useLanguage }   from '../../context/LanguageContext';
import { getTokens }     from '../../theme/tokens';
import { useReadingTimer } from '../../hooks/useReadingTimer';
import { ICONS }         from '../../components/AppTabBar';
import { useVictoryDay, useVictoryDays } from '../../hooks/useVictoryContent';
import { RichVerseText } from '../../components/BibleVerseLink';
import {
  BLUE, INDIGO, EMERALD, AMBER, RADII, AMBIENT_SHADOW, victoryTones,
} from './victoryTheme';

const { width: W } = Dimensions.get('window');
const STORAGE_KEY = 'vmp_completed_days';
const MIN_PRAY_SECONDS = 120;     // matches the gate on VictoryDayScreen

export default function VictoryReadingMode({ route, navigation }) {
  // Pull live totals + day body from the backend (admin-editable). Hooks
  // return bundled fallbacks synchronously on first render.
  const { days: allDays } = useVictoryDays(navigation);
  const TOTAL_DAYS = allDays?.length || 30;
  const dayNum = Math.max(1, Math.min(TOTAL_DAYS, Number(route?.params?.day) || 1));
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { day: dayDb } = useVictoryDay(dayNum, navigation);
  const day = dayDb || { date: '', focus: '', scripture: '', message: '', prayer_points: [], intercession: '' };

  // Persist + read the same completion map the regular day screen uses, so
  // marking prayed here flows back into the calendar grid / streak counter.
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setCompleted(!!(raw ? JSON.parse(raw) : {})[dayNum]))
      .catch(() => setCompleted(false));
  }, [dayNum]);

  const { remaining, ready } = useReadingTimer({
    enabled:    !completed,
    minSeconds: MIN_PRAY_SECONDS,
  });

  // Build the linear list of "pages" — same shape the audio player uses, so
  // a future enhancement could share the segment builder if needed.
  const segments = useMemo(() => {
    const list = [];
    list.push({
      kind:    'intro',
      eyebrow: `DAY ${dayNum} OF ${TOTAL_DAYS}`,
      title:   day.focus || 'Today',
      body:    day.date || '',
    });
    if (day.scripture) {
      list.push({
        kind:    'scripture',
        eyebrow: t('vmp_reading_scripture_eyebrow', 'SCRIPTURE'),
        title:   day.scripture,
        body:    t('vmp_read_open_bible', 'Pause here. Open your Bible and read the passage above before continuing.'),
      });
    }
    if (day.message) {
      list.push({
        kind:    'message',
        eyebrow: t('vmp_reading_message_eyebrow', 'INSPIRATIONAL MESSAGE'),
        title:   day.focus,
        body:    day.message,
      });
    }
    (day.prayer_points || []).forEach((p, i) => {
      list.push({
        kind:    'point',
        index:   i + 1,
        eyebrow: t('vmp_reading_point_eyebrow', 'PRAYER POINT {n} OF {total}')
                   .replace('{n}', String(i + 1))
                   .replace('{total}', String(day.prayer_points.length)),
        title:   '',
        body:    p,
      });
    });
    if (day.intercession) {
      list.push({
        kind:    'inter',
        eyebrow: t('vmp_reading_intercession_eyebrow', '★ SPECIAL INTERCESSION'),
        title:   '',
        body:    day.intercession,
      });
    }
    return list;
  }, [day, dayNum, t]);

  const [idx, setIdx] = useState(0);
  const total = segments.length;
  const cur   = segments[idx] || segments[0];

  // Soft cross-fade on every segment change so transitions feel paced rather
  // than abrupt. Native driver — no JS work per frame.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    // Hold the handle so the cleanup can stop it on segment change or
    // unmount — otherwise leaving the screen mid-fade triggers
    // "Cannot read property 'stopTracking' of undefined".
    const handle = Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    handle.start();
    return () => { try { handle.stop(); } catch { /* already done */ } };
  }, [idx, fade]);

  const goNext = () => idx < total - 1 && setIdx(idx + 1);
  const goPrev = () => idx > 0          && setIdx(idx - 1);

  const toggleCompleted = async () => {
    if (!completed && !ready) return;
    try {
      const raw  = await AsyncStorage.getItem(STORAGE_KEY);
      const map  = raw ? JSON.parse(raw) : {};
      const next = !completed;
      if (next) map[dayNum] = true; else delete map[dayNum];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      setCompleted(next);
    } catch { /* state still set */ }
  };

  const fmtMMSS = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Per-segment accent. Keeps the page calm but instantly differentiated.
  const accent =
      cur.kind === 'scripture' ? INDIGO[600]
    : cur.kind === 'point'     ? BLUE[600]
    : cur.kind === 'inter'     ? AMBER[600]
    : cur.kind === 'message'   ? BLUE[700]
                               : BLUE[600];
  const accentBg =
      cur.kind === 'scripture' ? tones.versePillBg
    : cur.kind === 'inter'     ? '#FEF3C7'
                               : tones.chipBg;

  const isLast = idx === total - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tones.pageBg || tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tones.pageBg || tk.bg} />

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <View style={s.topbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          style={[s.iconBtn, { backgroundColor: tones.chipBg }]}
          accessibilityLabel={t('vmp_close_reading', 'Close reading mode')}
        >
          <Text style={[s.closeTxt, { color: tones.chipFg }]}>✕</Text>
        </TouchableOpacity>
        <View style={[s.posPill, { backgroundColor: tones.chipBg }]}>
          <Text style={[s.posPillTxt, { color: tones.chipFg }]}>
            {idx + 1} / {total}
          </Text>
        </View>
        <View style={[s.iconBtn, { opacity: 0 }]} />
      </View>

      {/* ── PROGRESS DOTS ───────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 6, alignItems: 'center' }}
        style={{ flexGrow: 0, paddingBottom: 10 }}
      >
        {segments.map((seg, i) => {
          const active = i === idx;
          const past   = i < idx;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setIdx(i)}
              activeOpacity={0.78}
              style={[
                s.dot,
                {
                  width: active ? 28 : 8,
                  backgroundColor: active ? BLUE[600] : past ? BLUE[300] : tones.chipBg,
                },
              ]}
            />
          );
        })}
      </ScrollView>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.body, { opacity: fade }]}>
        <ScrollView
          contentContainerStyle={s.bodyInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.kindPill, { backgroundColor: accentBg }]}>
            <Text style={[s.kindPillTxt, { color: accent }]}>{cur.eyebrow}</Text>
          </View>

          {/* For prayer points, lead with a huge accent number so the reader
              has a strong anchor. Other kinds skip this in favour of the
              title-only treatment. */}
          {cur.kind === 'point' && (
            <Text style={[s.bigNum, { color: accent }]}>{String(cur.index).padStart(2, '0')}</Text>
          )}

          {!!cur.title && (
            cur.kind === 'scripture' ? (
              <RichVerseText
                text={cur.title}
                isDark={isDark}
                lineHeight={s.title?.lineHeight || 36}
                style={[s.title, { color: tk.textPrimary }]}
              />
            ) : (
              <Text style={[s.title, { color: tk.textPrimary }]}>{cur.title}</Text>
            )
          )}

          {!!cur.body && (
            <RichVerseText
              text={cur.body}
              isDark={isDark}
              lineHeight={cur.kind === 'inter' ? 28 : (s.bodyTxt?.lineHeight || 26)}
              style={[
                s.bodyTxt,
                { color: tk.textSec },
                cur.kind === 'inter' && { fontSize: 19, fontWeight: '600', color: accent },
              ]}
            />
          )}
        </ScrollView>
      </Animated.View>

      {/* ── BOTTOM NAV ───────────────────────────────────────────────────── */}
      <View style={s.foot}>
        <TouchableOpacity
          onPress={goPrev}
          disabled={idx === 0}
          activeOpacity={0.86}
          style={[s.navBtn, {
            backgroundColor: tones.chipBg,
            opacity: idx === 0 ? 0.4 : 1,
          }]}
        >
          <Text style={[s.navBtnTxt, { color: tones.chipFg }]}>
            ←  {t('vmp_prev', 'Prev')}
          </Text>
        </TouchableOpacity>

        {/* On the last segment the centre slot becomes the Mark-as-Prayed
            CTA (gated by the 2-min dwell timer). Everywhere else, it's just
            a soft position counter. */}
        {isLast ? (
          <TouchableOpacity
            onPress={toggleCompleted}
            disabled={!completed && !ready}
            activeOpacity={0.88}
            style={[s.markBtn, {
              backgroundColor: completed ? EMERALD[500] : (ready ? BLUE[600] : tones.chipBg),
              shadowColor:    tones.ctaShadow,
              opacity:        (!completed && !ready) ? 0.85 : 1,
            }]}
          >
            <Text style={[s.markTxt, (!completed && !ready) && { color: tones.chipFg }]}>
              {completed
                ? t('vmp_prayed_check', '✓ Prayed')
                : ready
                  ? t('vmp_mark_prayed', 'Mark as prayed')
                  : `${fmtMMSS(remaining)}`}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.counterCenter, { backgroundColor: tones.chipBg }]}>
            <Text style={[s.counterTxt, { color: tones.chipFg }]}>
              {cur.kind === 'point' ? `${t('vmp_point', 'Point')} ${cur.index}` : ''}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={goNext}
          disabled={idx === total - 1}
          activeOpacity={0.86}
          style={[s.navBtn, {
            backgroundColor: tones.chipBg,
            opacity: idx === total - 1 ? 0.4 : 1,
          }]}
        >
          <Text style={[s.navBtnTxt, { color: tones.chipFg }]}>
            {t('vmp_next', 'Next')}  →
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn:  { width: 42, height: 42, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  closeTxt: { fontSize: 18, fontWeight: '900' },
  posPill:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  posPillTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },

  dot:      { height: 8, borderRadius: 4 },

  body:     { flex: 1, paddingHorizontal: 24 },
  bodyInner:{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24, gap: 14 },
  kindPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 4 },
  kindPillTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  bigNum:   { fontSize: 64, fontWeight: '900', letterSpacing: -2, lineHeight: 64, marginTop: 4, marginBottom: 4 },
  title:    { fontSize: 26, fontWeight: '900', lineHeight: 33, letterSpacing: -0.5 },
  bodyTxt:  { fontSize: 18, lineHeight: 28, fontWeight: '500' },

  foot:     {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
  },
  navBtn:        { flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  navBtnTxt:     { fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  counterCenter: { flex: 1.2, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  counterTxt:    { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  markBtn:       {
    flex: 1.4, paddingVertical: 14, borderRadius: 999, alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
  },
  markTxt:       { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
});
