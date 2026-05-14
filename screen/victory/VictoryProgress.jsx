// screen/victory/VictoryProgress.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Personal progress dashboard for the Victory Month book.
//
// Shows:
//   • Big completion ring + stats
//   • Current streak / longest streak
//   • Heatmap (5 rows × 6 days) for at-a-glance pattern
//   • Recently prayed list (last 5 completed days)
//   • Reset button (with a confirm dialog)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage     from '@react-native-async-storage/async-storage';
import { useTheme }     from '../../context/ThemeContext';
import { useLanguage }  from '../../context/LanguageContext';
import { getTokens }    from '../../theme/tokens';
import { useScreenEntry } from '../../hooks/useFluidAnim';
import { ICONS } from '../../components/AppTabBar';
import { todayDayIndex } from '../../data/victoryMonth';
import { useVictoryDays } from '../../hooks/useVictoryContent';
import { BLUE, EMERALD, AMBER, INDIGO, RADII, AMBIENT_SHADOW, victoryTones } from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';

const STORAGE_KEY = 'vmp_completed_days';

export default function VictoryProgress({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);

  // Backend-driven list (cache-first); the heatmap + recent-list use this.
  const { days: VICTORY_DAYS } = useVictoryDays(navigation);
  const TOTAL_DAYS = VICTORY_DAYS.length || 30;
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [completed, setCompleted] = useState({});
  const refresh = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setCompleted(raw ? JSON.parse(raw) : {});
    } catch { setCompleted({}); }
  }, []);
  useEffect(() => {
    refresh();
    const unsub = navigation.addListener('focus', refresh);
    return unsub;
  }, [navigation, refresh]);

  // ── Derived stats ───────────────────────────────────────────────────────
  const doneCount = useMemo(
    () => Object.values(completed).filter(Boolean).length,
    [completed],
  );
  const donePct = Math.round((doneCount / TOTAL_DAYS) * 100);

  // Longest run of consecutive days anywhere in the 30-day window
  // + the streak that ends on today (used as "current streak").
  const { currentStreak, longestStreak } = useMemo(() => {
    let cur = 0, longest = 0;
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      if (completed[d]) { cur += 1; longest = Math.max(longest, cur); }
      else cur = 0;
    }
    let end = 0;
    const todayN = todayDayIndex();
    for (let d = todayN; d >= 1; d--) {
      if (completed[d]) end += 1; else break;
    }
    return { currentStreak: end, longestStreak: longest };
  }, [completed]);

  // Most-recently completed days (highest day number first).
  const recent = useMemo(() => {
    const done = VICTORY_DAYS.filter((d) => completed[d.day]);
    return done.slice(-5).reverse();
  }, [completed]);

  const resetProgress = () => {
    Alert.alert(
      'Reset progress?',
      'This will clear every "Prayed" check across the 30 days. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
              setCompleted({});
            } catch { /* ignore */ }
          },
        },
      ],
    );
  };

  // Heatmap layout: 5 rows × 6 days = 30 days total
  const heatmap = useMemo(() => {
    const rows = [];
    for (let r = 0; r < 5; r++) {
      const row = [];
      for (let c = 0; c < 6; c++) {
        const dayN = r * 6 + c + 1;
        if (dayN <= TOTAL_DAYS) row.push({ day: dayN, done: !!completed[dayN] });
      }
      rows.push(row);
    }
    return rows;
  }, [completed]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.7} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: fade, transform: [{ translateY }] }}
      >
        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <View style={s.topbar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor: tones.chipBg }]}
          >
            <ICONS.ArrowLeft color={tones.chipFg} size={20} sw={2} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.eyebrow, { color: tones.chipFg }]}>{t('vmp_caps', 'VICTORY MONTH')}</Text>
            <Text style={[s.topTitle, { color: tk.textPrimary }]}>{t('vmp_qa_progress', 'My Journey')}</Text>
          </View>
          <TouchableOpacity
            onPress={resetProgress}
            activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor: tones.chipBg }]}
          >
            <Text style={[s.iconBtnTxt, { color: tones.chipFg }]}>↺</Text>
          </TouchableOpacity>
        </View>

        {/* ── HERO RING ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={[s.hero, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge, ...AMBIENT_SHADOW }]}>
            <View style={[s.ringOuter, { backgroundColor: tones.chipBg }]}>
              <View style={[s.ringInner, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
                <Text style={[s.ringPct, { color: BLUE[700] }]}>{donePct}%</Text>
                <Text style={[s.ringSub, { color: tk.textMuted }]}>{t('vmp_progress_complete', 'complete')}</Text>
              </View>
            </View>
            <Text style={[s.heroLabel, { color: tones.chipFg }]}>{t('vmp_progress_label', 'YOUR PROGRESS')}</Text>
            <Text style={[s.heroVal, { color: tk.textPrimary }]}>
              {doneCount}<Text style={{ color: tk.textMuted, fontSize: 19 }}> / {TOTAL_DAYS} {t('vmp_progress_days', 'days')}</Text>
            </Text>
            <Text style={[s.heroSub, { color: tk.textSec }]}>
              {t('vmp_progress_motivation', 'Keep going — every prayer plants a seed.')}
            </Text>
          </View>
        </View>

        {/* ── STREAK CARDS ───────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          <StatCard
            label={t('vmp_progress_current_streak', 'Current streak')}
            value={currentStreak}
            unit={currentStreak === 1 ? t('vmp_progress_day_singular', 'day') : t('vmp_progress_days', 'days')}
            accent={AMBER[500]}
            accentBg="#FEF3C7"
            tones={tones}
            tk={tk}
            symbol="⚡"
          />
          <StatCard
            label={t('vmp_progress_longest_streak', 'Longest streak')}
            value={longestStreak}
            unit={longestStreak === 1 ? t('vmp_progress_day_singular', 'day') : t('vmp_progress_days', 'days')}
            accent={EMERALD[600]}
            accentBg="#D1FAE5"
            tones={tones}
            tk={tk}
            symbol="🏆"
          />
        </View>

        {/* ── HEATMAP ────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={[s.sectionLabel, { color: tones.chipFg }]}>{t('vmp_progress_overview', 'OVERVIEW')}</Text>
          <View style={[s.heatmapCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
            {heatmap.map((row, ri) => (
              <View key={ri} style={s.heatmapRow}>
                {row.map((cell) => (
                  <View
                    key={cell.day}
                    style={[
                      s.heatCell,
                      { backgroundColor: cell.done ? BLUE[600] : tones.chipBg },
                    ]}
                  >
                    <Text style={[
                      s.heatCellTxt,
                      { color: cell.done ? '#fff' : tk.textMuted },
                    ]}>
                      {cell.day}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={s.heatmapLegend}>
              <View style={[s.heatmapDot, { backgroundColor: tones.chipBg }]} />
              <Text style={[s.heatmapLegendTxt, { color: tk.textMuted }]}>{t('vmp_progress_not_yet', 'Not yet')}</Text>
              <View style={[s.heatmapDot, { backgroundColor: BLUE[600], marginLeft: 14 }]} />
              <Text style={[s.heatmapLegendTxt, { color: tk.textMuted }]}>{t('vmp_prayed_label_full', 'Prayed')}</Text>
            </View>
          </View>
        </View>

        {/* ── RECENT ─────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={[s.sectionLabel, { color: tones.chipFg }]}>{t('vmp_progress_recent', 'RECENT')}</Text>
          {recent.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
              <Text style={s.emptyEmoji}>🌱</Text>
              <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>{t('vmp_progress_empty_title', 'No prayers yet')}</Text>
              <Text style={[s.emptyBody, { color: tk.textMuted }]}>
                {t('vmp_progress_empty_body', 'Mark your first day as prayed to start your journey.')}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {recent.map((d) => (
                <TouchableOpacity
                  key={d.day}
                  onPress={() => navigation.navigate('VictoryDayScreen', { day: d.day })}
                  activeOpacity={0.85}
                  style={[s.recentRow, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}
                >
                  <View style={[s.recentBadge, { backgroundColor: EMERALD[100] }]}>
                    <ICONS.Check color={EMERALD[600]} size={14} sw={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.recentTitle, { color: tk.textPrimary }]} numberOfLines={1}>
                      {t('vmp_progress_day_focus', 'Day {n} · {focus}').replace('{n}', String(d.day)).replace('{focus}', d.focus)}
                    </Text>
                    <Text style={[s.recentMeta, { color: tk.textMuted }]} numberOfLines={1}>
                      {d.date}
                    </Text>
                  </View>
                  <Text style={[s.recentChev, { color: tk.textMuted }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('VictoryDayList')}
            activeOpacity={0.86}
            style={[s.cta, { backgroundColor: BLUE[600], shadowColor: tones.ctaShadow }]}
          >
            <Text style={s.ctaTxt}>{t('vmp_progress_continue', 'Continue praying  →')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const StatCard = ({ label, value, unit, accent, accentBg, tones, tk, symbol }) => (
  <View style={[s.statCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
    <View style={[s.statIcon, { backgroundColor: accentBg }]}>
      <Text style={[s.statIconTxt, { color: accent }]}>{symbol}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[s.statLbl, { color: tk.textMuted }]}>{label}</Text>
      <Text style={[s.statVal, { color: tk.textPrimary }]}>
        {value}<Text style={[s.statUnit, { color: tk.textMuted }]}> {unit}</Text>
      </Text>
    </View>
  </View>
);

const s = StyleSheet.create({
  topbar:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  iconBtn:    { width: 42, height: 42, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  iconBtnTxt: { fontSize: 18, fontWeight: '800' },
  eyebrow:    { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  topTitle:   { fontSize: 14, fontWeight: '900', marginTop: 2 },

  hero:       { padding: 24, borderRadius: RADII.xl, alignItems: 'center', gap: 10 },
  ringOuter:  { width: 140, height: 140, borderRadius: 999, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  ringInner:  { width: 116, height: 116, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  ringPct:    { fontSize: 30, fontWeight: '900', letterSpacing: -1.4 },
  ringSub:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginTop: 2 },
  heroLabel:  { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  heroVal:    { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  heroSub:    { fontSize: 12.5, fontWeight: '600', textAlign: 'center', marginTop: 2 },

  statsRow:   { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 22 },
  statCard:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: RADII.md },
  statIcon:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statIconTxt:{ fontSize: 16 },
  statLbl:    { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  statVal:    { fontSize: 19, fontWeight: '900', letterSpacing: -0.5, marginTop: 1 },
  statUnit:   { fontSize: 12, fontWeight: '700' },

  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2.2, marginBottom: 10 },

  heatmapCard:  { padding: 14, borderRadius: RADII.lg, gap: 6 },
  heatmapRow:   { flexDirection: 'row', gap: 6 },
  heatCell:     { flex: 1, aspectRatio: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  heatCellTxt:  { fontSize: 11, fontWeight: '900' },
  heatmapLegend:{ flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  heatmapDot:   { width: 12, height: 12, borderRadius: 4, marginRight: 6 },
  heatmapLegendTxt: { fontSize: 11, fontWeight: '700' },

  recentRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: RADII.md },
  recentBadge:  { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  recentTitle:  { fontSize: 14, fontWeight: '800' },
  recentMeta:   { fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  recentChev:   { fontSize: 20, fontWeight: '700' },

  emptyCard:   { padding: 26, borderRadius: RADII.xl, alignItems: 'center', gap: 6 },
  emptyEmoji:  { fontSize: 32, marginBottom: 4 },
  emptyTitle:  { fontSize: 15, fontWeight: '900' },
  emptyBody:   { fontSize: 12.5, fontWeight: '600', textAlign: 'center', lineHeight: 18 },

  cta:    {
    paddingVertical: 15, borderRadius: RADII.pill, alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
  },
  ctaTxt: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
});
