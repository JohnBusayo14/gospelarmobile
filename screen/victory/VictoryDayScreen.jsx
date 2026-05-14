// screen/victory/VictoryDayScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Detail view for a single day of the Victory Month bulletin.
//
// Information architecture:
//   • Sticky top bar (back · day-of-30 · mark-as-prayed)
//   • Hero (date · focus · scripture pill)
//   • Inspirational message card
//   • Prayer points (numbered, staggered entrance)
//   • Special intercession (highlighted callout)
//   • Prev / Mark / Next nav row at the bottom
//
// Adheres to DESIGN.md: surfaces are tonal, radii are generous, depth comes
// from ambient shadow rather than borders. Blue is the primary, indigo the
// secondary accent.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage     from '@react-native-async-storage/async-storage';
import { useTheme }     from '../../context/ThemeContext';
import { useLanguage }  from '../../context/LanguageContext';
import { getTokens }    from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import { useReadingTimer } from '../../hooks/useReadingTimer';
import { ICONS } from '../../components/AppTabBar';
import { useVictoryDay, useVictoryDays } from '../../hooks/useVictoryContent';
import { BLUE, INDIGO, EMERALD, AMBER, RADII, AMBIENT_SHADOW, victoryTones } from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import { RichVerseText } from '../../components/BibleVerseLink';

const STORAGE_KEY = 'vmp_completed_days';
// User must dwell on a day's content for at least this many seconds before
// "Mark as prayed" can be tapped. Stops drive-by completions from inflating
// streaks / unlocking achievements without real engagement.
const MIN_PRAY_SECONDS = 120;

export default function VictoryDayScreen({ route, navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  // Pull the full day list (cheap — cache-first) so we know the total day
  // count for clamping and next/prev navigation. Then fetch the requested
  // day in full.
  const { days } = useVictoryDays(navigation);
  const TOTAL_DAYS = days.length || 30;
  const dayNum = Math.max(1, Math.min(TOTAL_DAYS, Number(route?.params?.day) || 1));
  const { day: dayFromHook } = useVictoryDay(dayNum, navigation);
  // The hook returns the bundled record initially; once fresh data lands it
  // re-renders. `day` always has at least the shape the JSX expects.
  const day = dayFromHook || { focus: '', scripture: '', message: '', prayer_points: [], intercession: '' };

  const [completed, setCompleted] = useState(false);

  // 2-minute dwell gate. Live `remaining` ticks down each second so the UI
  // can show "30s to go" hints; `ready` flips to true at zero. AppState
  // backgrounds pause the timer so phone-locked time doesn't count.
  const { elapsedSeconds, remaining, ready } = useReadingTimer({
    enabled:    !completed,           // freeze once already prayed
    minSeconds: MIN_PRAY_SECONDS,
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setCompleted(!!(raw ? JSON.parse(raw) : {})[dayNum]))
      .catch(() => setCompleted(false));
  }, [dayNum]);

  const toggleCompleted = async () => {
    // Block the first mark unless the user has spent the minimum dwell time.
    // Unmarking (toggling off) is always allowed.
    if (!completed && !ready) return;
    try {
      const raw  = await AsyncStorage.getItem(STORAGE_KEY);
      const map  = raw ? JSON.parse(raw) : {};
      const next = !completed;
      if (next) map[dayNum] = true; else delete map[dayNum];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      setCompleted(next);
    } catch { /* state already updated */ }
  };

  // Helper for the UI labels.
  const fmtMMSS = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const shareDay = async () => {
    try {
      await Share.share({
        message: `Victory Month — Day ${dayNum}\n${day.focus}\n${day.scripture}\n\n${day.message}`,
      });
    } catch { /* user cancelled */ }
  };

  const goNext = () => dayNum < TOTAL_DAYS && navigation.replace('VictoryDayScreen', { day: dayNum + 1 });
  const goPrev = () => dayNum > 1          && navigation.replace('VictoryDayScreen', { day: dayNum - 1 });

  const hasContent = !!day.message || (day.prayer_points?.length || 0) > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.7} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        style={{ opacity: fade, transform: [{ translateY }] }}
      >
        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        {/* Single-line eyebrow keeps the topbar tight — the date used to live
            here too but it's now in the hero, so showing it twice was a waste. */}
        <View style={s.topbar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor: tones.chipBg }]}
          >
            <ICONS.ArrowLeft color={tones.chipFg} size={20} sw={2} />
          </TouchableOpacity>
          <Text style={[s.eyebrow, { color: tones.chipFg }]}>
            {t('vmp_day_n_of_30', 'DAY {n} OF {total}')
              .replace('{n}', String(dayNum))
              .replace('{total}', String(TOTAL_DAYS))}
          </Text>
          <TouchableOpacity
            onPress={toggleCompleted}
            disabled={!completed && !ready}
            activeOpacity={0.75}
            style={[s.iconBtn, {
              backgroundColor: completed ? EMERALD[100] : tones.chipBg,
              opacity: (!completed && !ready) ? 0.45 : 1,
            }]}
            accessibilityLabel={t('vmp_mark_prayed', 'Mark as prayed')}
          >
            <ICONS.Check color={completed ? EMERALD[600] : tones.chipFg} size={18} sw={2.4} />
          </TouchableOpacity>
        </View>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        {/* Compact rearrangement: badge + date/focus column on one row, then
            a single bottom row with scripture pill and a textual Listen pill.
            The old 44×44 listen icon button was removed — it was the third
            listen affordance on the screen (the action row also has one). */}
        <View style={s.heroWrap}>
          <View style={[s.heroCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge, ...AMBIENT_SHADOW }]}>
            <View style={s.heroHeadRow}>
              <View style={[s.dayBadge, { backgroundColor: tones.todayBg }]}>
                <Text style={[s.dayBadgeNum, { color: tones.todayFg }]}>{dayNum}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroDate, { color: tk.textMuted }]} numberOfLines={1}>
                  {day.date}
                </Text>
                {/* Some Victory Month topics run 3-4 lines (e.g. Day 5
                    "Prayer for church-wide revival: Lord, grant a dawn of true
                    revival and great exploits…"). Don't clamp — readers need
                    the full focus to know what they're praying. */}
                <Text style={[s.heroFocus, { color: tk.textPrimary }]}>
                  {day.focus}
                </Text>
              </View>
            </View>
            <View style={s.heroBottomRow}>
              {!!day.scripture && (
                <View style={[s.versePill, { backgroundColor: tones.versePillBg }]}>
                  <ICONS.Book color={tones.versePillFg} size={12} sw={2} />
                  <View style={{ flex: 1 }}>
                    <RichVerseText text={day.scripture} isDark={isDark} lineHeight={16}
                      style={[s.versePillTxt, { color: tones.versePillFg }]} />
                  </View>
                </View>
              )}
              <TouchableOpacity
                onPress={() => navigation.navigate('VictoryAudioPlayer', { day: dayNum })}
                activeOpacity={0.82}
                style={[s.listenPill, { backgroundColor: tones.todayBg }]}
                accessibilityLabel={t('vmp_listen', 'Listen to this prayer')}
              >
                <Text style={[s.listenPillTxt, { color: tones.todayFg }]}>🔊  Listen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── MESSAGE ────────────────────────────────────────────────────── */}
        {!!day.message && (
          <Section title={t('vmp_section_message', 'Inspirational Message')} tk={tk} tones={tones}>
            <View style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
              <RichVerseText text={day.message} isDark={isDark} lineHeight={s.body?.lineHeight || 24}
                style={[s.body, { color: tk.textSec }]} />
            </View>
          </Section>
        )}

        {/* ── PRAYER POINTS ──────────────────────────────────────────────── */}
        {Array.isArray(day.prayer_points) && day.prayer_points.length > 0 && (
          <Section title={t('vmp_section_prayer_points', 'Prayer Points')} tk={tk} tones={tones}>
            <View style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
              {day.prayer_points.map((p, i) => (
                <PrayerRow key={i} index={i + 1} text={p} tk={tk} tones={tones} isDark={isDark} />
              ))}
            </View>
          </Section>
        )}

        {/* ── INTERCESSION ───────────────────────────────────────────────── */}
        {!!day.intercession && (
          <Section title={t('vmp_section_intercession', 'Special Intercession')} tk={tk} tones={tones}>
            <View style={[s.intercessionBox, { backgroundColor: tones.versePillBg }]}>
              <Text style={[s.intercessionLabel, { color: tones.versePillFg }]}>★ FOCUS PRAYER</Text>
              <RichVerseText text={day.intercession} isDark={isDark} lineHeight={s.intercessionTxt?.lineHeight || 24}
                style={[s.intercessionTxt, { color: tones.versePillFg }]} />
            </View>
          </Section>
        )}

        {/* ── EMPTY STATE ────────────────────────────────────────────────── */}
        {!hasContent && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={[s.emptyCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
              <View style={[s.emptyIcon, { backgroundColor: tones.chipBg }]}>
                <ICONS.Book color={tones.chipFg} size={28} sw={2} />
              </View>
              <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>
                {t('vmp_empty_title', 'Content arriving soon')}
              </Text>
              <Text style={[s.emptyBody, { color: tk.textMuted }]}>
                {t('vmp_empty_body', "Day {n} hasn't been loaded yet. Check back after the bulletin is published.")
                  .replace('{n}', String(dayNum))}
              </Text>
            </View>
          </View>
        )}

        {/* ── ACTION ROW ─────────────────────────────────────────────────
            Four modes for engaging with the day:
              • Reading mode — focused, one prayer point per page
              • Audio / Listen — TTS read-along
              • Journal — reflections + custom prayer points
              • Share — system share sheet
            Reading + Listen lead because they're the primary "pray-now"
            actions; Journal + Share are secondary.  */}
        <View style={s.actionRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('VictoryReadingMode', { day: dayNum })}
            activeOpacity={0.85}
            style={[s.actionBtn, { backgroundColor: BLUE[700] }]}
          >
            <Text style={s.actionTxtLight}>📖  Read</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('VictoryAudioPlayer', { day: dayNum })}
            activeOpacity={0.85}
            style={[s.actionBtn, { backgroundColor: BLUE[500] }]}
          >
            <Text style={s.actionTxtLight}>🎧  Listen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('VictoryEditDay', { day: dayNum })}
            activeOpacity={0.85}
            style={[s.actionBtn, { backgroundColor: INDIGO[600] }]}
          >
            <Text style={s.actionTxtLight}>✍️  Journal</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareDay} activeOpacity={0.85}
            style={[s.actionBtn, { backgroundColor: tones.chipBg, flex: 0.55 }]}>
            <Text style={[s.actionTxtDark, { color: tones.chipFg }]}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* ── PREV / MARK / NEXT ─────────────────────────────────────────── */}
        <View style={s.navRow}>
          <TouchableOpacity
            onPress={goPrev}
            disabled={dayNum === 1}
            activeOpacity={0.85}
            style={[s.navBtn, {
              backgroundColor: tones.glassFill,
              borderWidth: 1, borderColor: tones.glassEdge, opacity: dayNum === 1 ? 0.4 : 1,
            }]}
          >
            <Text style={[s.navBtnTxt, { color: tk.textPrimary }]}>← {t('vmp_prev', 'Prev')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleCompleted}
            disabled={!completed && !ready}
            activeOpacity={0.88}
            style={[s.markBtn, {
              backgroundColor: completed ? EMERALD[500] : (ready ? BLUE[600] : tones.chipBg),
              shadowColor: tones.ctaShadow,
              opacity: (!completed && !ready) ? 0.85 : 1,
            }]}
          >
            <Text style={[s.markBtnTxt, !completed && !ready && { color: tones.chipFg }]}>
              {completed
                ? t('vmp_prayed_check', '✓  Prayed')
                : ready
                  ? t('vmp_mark_prayed',  'Mark as prayed')
                  // While the 2-min dwell gate is still counting down, show
                  // the user exactly how much time is left so the disabled
                  // state doesn't feel broken.
                  : `${fmtMMSS(remaining)}  ${t('vmp_to_mark', 'to mark')}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNext}
            disabled={dayNum === TOTAL_DAYS}
            activeOpacity={0.85}
            style={[s.navBtn, {
              backgroundColor: tones.glassFill,
              borderWidth: 1, borderColor: tones.glassEdge, opacity: dayNum === TOTAL_DAYS ? 0.4 : 1,
            }]}
          >
            <Text style={[s.navBtnTxt, { color: tk.textPrimary }]}>{t('vmp_next', 'Next')} →</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ── Re-usable bits ───────────────────────────────────────────────────────────
const Section = ({ title, tk, tones, children }) => {
  const { fade, translateY } = useStaggerEntry(0);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }], paddingHorizontal: 20, marginBottom: 20 }}>
      <Text style={[s.sectionLabel, { color: tones.chipFg }]}>
        {String(title).toUpperCase()}
      </Text>
      {children}
    </Animated.View>
  );
};

const PrayerRow = ({ index, text, tk, tones, isDark }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 8));
  return (
    <Animated.View style={[s.prayerRow, { opacity: fade, transform: [{ translateY }] }]}>
      <View style={[s.prayerNum, { backgroundColor: tones.chipBg }]}>
        <Text style={[s.prayerNumTxt, { color: tones.chipFg }]}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <RichVerseText text={text} isDark={isDark} lineHeight={s.prayerTxt?.lineHeight || 22}
          style={[s.prayerTxt, { color: tk.textSec }]} />
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  topbar:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8,
  },
  iconBtn:  { width: 38, height: 38, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  eyebrow:  { fontSize: 10, fontWeight: '900', letterSpacing: 2 },

  // Hero — compact rearrangement. Day badge shrunk 62→48, focus 21→17,
  // padding 20→14, hero marginBottom 22→14, headRow marginBottom 14→8.
  // Net: ~70px less vertical space before the message section begins.
  heroWrap:    { paddingHorizontal: 20, marginBottom: 14 },
  heroCard:    { padding: 14, borderRadius: RADII.xl },
  heroHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  dayBadge:    {
    width: 48, height: 48, borderRadius: RADII.md,
    justifyContent: 'center', alignItems: 'center',
  },
  dayBadgeNum: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8, lineHeight: 24 },
  heroDate:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, marginBottom: 2 },
  heroFocus:   { fontSize: 17, fontWeight: '900', lineHeight: 22, letterSpacing: -0.3 },
  versePill:   {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADII.pill,
    flexShrink: 1,
  },
  versePillTxt: { fontSize: 12, fontWeight: '800', letterSpacing: 0.1 },
  heroBottomRow:{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  listenPill:   {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADII.pill,
  },
  listenPillTxt:{ fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  // Section
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2.2, marginBottom: 10 },
  card:         { padding: 18, borderRadius: RADII.lg },
  body:         { fontSize: 14.5, lineHeight: 23, fontWeight: '500' },

  // Prayer points
  prayerRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  prayerNum:    { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  prayerNumTxt: { fontSize: 12.5, fontWeight: '900' },
  prayerTxt:    { flex: 1, fontSize: 14.5, lineHeight: 22, fontWeight: '500' },

  // Intercession highlight
  intercessionBox:   { padding: 18, borderRadius: RADII.lg },
  intercessionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  intercessionTxt:   { fontSize: 14.5, lineHeight: 22, fontWeight: '600' },

  // Empty state
  emptyCard:  { padding: 26, borderRadius: RADII.xl, alignItems: 'center', gap: 12 },
  emptyIcon:  { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody:  { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },

  // Share row
  shareRow:   { paddingHorizontal: 20, marginBottom: 12 },
  shareBtn:   { paddingVertical: 12, borderRadius: RADII.pill, alignItems: 'center' },
  actionRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  actionBtn:  { flex: 1, paddingVertical: 12, borderRadius: RADII.pill, alignItems: 'center' },
  actionTxtLight: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  actionTxtDark:  { fontSize: 15, fontWeight: '900' },
  shareBtnTxt:{ fontSize: 13, fontWeight: '800' },

  // Navigation row
  navRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 6 },
  navBtn:     { flex: 1, paddingVertical: 14, borderRadius: RADII.pill, alignItems: 'center' },
  navBtnTxt:  { fontSize: 13, fontWeight: '800' },
  markBtn:    {
    flex: 1.4, paddingVertical: 14, borderRadius: RADII.pill, alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
  },
  markBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
});
