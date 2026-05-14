// screen/victory/VictoryDayList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Browse all 30 days. Each row shows the day number, focus, date and scripture,
// with a completion indicator pulled from AsyncStorage. Filter chips:
//   All · Unread · Completed
//
// Search field filters by focus and scripture. Visual language matches the
// Victory Month book — glass surfaces, blue accents, no 1px borders.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated,
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
import { BLUE, EMERALD, RADII, AMBIENT_SHADOW, victoryTones } from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';

const STORAGE_KEY = 'vmp_completed_days';

const FILTERS = (t) => [
  { id: 'all',       label: t('vmp_filter_all',       'All')       },
  { id: 'today',     label: t('vmp_filter_today',     'Today')     },
  { id: 'unread',    label: t('vmp_filter_unread',    'Unread')    },
  { id: 'completed', label: t('vmp_filter_completed', 'Completed') },
];

export default function VictoryDayList({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [filter, setFilter]       = useState('all');
  const [q, setQ]                 = useState('');
  const [completed, setCompleted] = useState({});
  const dayNum = todayDayIndex();
  const { days } = useVictoryDays(navigation);
  const TOTAL_DAYS = days.length || 30;

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

  const visible = useMemo(() => {
    let arr = days;
    if (filter === 'completed') arr = arr.filter((d) => completed[d.day]);
    else if (filter === 'unread') arr = arr.filter((d) => !completed[d.day]);
    else if (filter === 'today') arr = arr.filter((d) => d.day === dayNum);
    if (q.trim()) {
      const term = q.toLowerCase();
      arr = arr.filter((d) =>
        d.focus?.toLowerCase().includes(term) ||
        d.scripture?.toLowerCase().includes(term) ||
        d.date?.toLowerCase().includes(term),
      );
    }
    return arr;
  }, [days, filter, q, completed, dayNum]);

  const doneCount = Object.values(completed).filter(Boolean).length;
  const donePct   = Math.round((doneCount / TOTAL_DAYS) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.6} />

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
            <Text style={[s.eyebrow, { color: tones.chipFg }]}>
              {t('vmp_caps', 'VICTORY MONTH')}
            </Text>
            <Text style={[s.topTitle, { color: tk.textPrimary }]}>
              {t('vmp_browse_days', 'Browse Days')}
            </Text>
          </View>
          <View style={[s.iconBtn, { opacity: 0 }]} />
        </View>

        {/* ── PROGRESS HEADER ────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
          <View style={[s.progressCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge, ...AMBIENT_SHADOW }]}>
            <View>
              <Text style={[s.progressLbl, { color: tones.chipFg }]}>{t('vmp_progress', 'PROGRESS')}</Text>
              <Text style={[s.progressVal, { color: tk.textPrimary }]}>
                {doneCount} <Text style={{ color: tk.textMuted, fontSize: 16, fontWeight: '700' }}>/ {TOTAL_DAYS}</Text>
              </Text>
              <Text style={[s.progressSub, { color: tk.textSec }]}>
                {donePct}% complete
              </Text>
            </View>
            <View style={[s.progressBig, { backgroundColor: BLUE[100] }]}>
              <Text style={[s.progressBigTxt, { color: BLUE[700] }]}>{donePct}%</Text>
            </View>
          </View>
          <View style={[s.bar, { backgroundColor: tones.chipBg }]}>
            <View style={[s.barFill, { width: `${donePct}%`, backgroundColor: BLUE[600] }]} />
          </View>
        </View>

        {/* ── SEARCH ─────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={[s.search, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
            <Text style={[s.searchIcon, { color: tk.textMuted }]}>🔎</Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('vmp_search_placeholder', 'Search by focus, scripture or date…')}
              placeholderTextColor={tk.textMuted}
              style={[s.searchInput, { color: tk.textPrimary }]}
              returnKeyType="search"
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ('')}>
                <Text style={[s.searchClear, { color: tk.textMuted }]}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── FILTER CHIPS ───────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 18 }}
        >
          {FILTERS(t).map((f) => {
            const active = f.id === filter;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.85}
                style={[s.chip, {
                  backgroundColor: active ? BLUE[600] : tones.chipBg,
                }]}
              >
                <Text style={[s.chipTxt, { color: active ? '#fff' : tones.chipFg }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── DAY CARDS ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {visible.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
              <Text style={[s.emptyEmoji]}>🔍</Text>
              <Text style={[s.emptyTxt, { color: tk.textPrimary }]}>
                {t('vmp_no_results', 'No days match this view.')}
              </Text>
              <Text style={[s.emptySub, { color: tk.textMuted }]}>
                {t('vmp_no_results_sub', 'Try a different filter or clear the search.')}
              </Text>
            </View>
          ) : (
            visible.map((d) => {
              const isDone  = !!completed[d.day];
              const isToday = d.day === dayNum;
              return (
                <TouchableOpacity
                  key={d.day}
                  onPress={() => navigation.navigate('VictoryDayScreen', { day: d.day })}
                  activeOpacity={0.85}
                  style={[s.dayCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}
                >
                  <View style={[
                    s.dayBadge,
                    {
                      backgroundColor: isDone  ? EMERALD[500]
                                      : isToday ? BLUE[600]
                                      : tones.chipBg,
                    },
                  ]}>
                    <Text style={[s.dayBadgeNum, {
                      color: (isDone || isToday) ? '#fff' : tones.chipFg,
                    }]}>
                      {String(d.day).padStart(2, '0')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.dayCardHead}>
                      {isToday && (
                        <View style={[s.todayTag, { backgroundColor: BLUE[100] }]}>
                          <Text style={[s.todayTagTxt, { color: BLUE[700] }]}>TODAY</Text>
                        </View>
                      )}
                      <Text style={[s.dayCardDate, { color: tk.textMuted }]} numberOfLines={1}>
                        {d.date?.split(',')[1]?.trim() || d.date}
                      </Text>
                    </View>
                    <Text style={[s.dayCardTitle, { color: tk.textPrimary }]} numberOfLines={2}>
                      {d.focus}
                    </Text>
                    {!!d.scripture && (
                      <View style={s.dayCardMeta}>
                        <ICONS.Book color={tk.textMuted} size={11} sw={2} />
                        <Text style={[s.dayCardMetaTxt, { color: tk.textMuted }]} numberOfLines={1}>
                          {d.scripture}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isDone && (
                    <View style={[s.doneBadge, { backgroundColor: EMERALD[500] }]}>
                      <ICONS.Check color="#fff" size={12} sw={2.6} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  topbar:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  iconBtn:  { width: 42, height: 42, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  eyebrow:  { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  topTitle: { fontSize: 14, fontWeight: '900', marginTop: 2 },

  // Progress
  progressCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: RADII.lg, marginBottom: 12,
  },
  progressLbl:  { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  progressVal:  { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  progressSub:  { fontSize: 12, fontWeight: '600', marginTop: 4 },
  progressBig:  { width: 64, height: 64, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  progressBigTxt: { fontSize: 15, fontWeight: '900' },
  bar:          { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill:      { height: 8, borderRadius: 4 },

  // Search
  search:       {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADII.pill,
  },
  searchIcon:   { fontSize: 14 },
  searchInput:  { flex: 1, fontSize: 14, fontWeight: '500', padding: 0 },
  searchClear:  { fontSize: 22, fontWeight: '700', paddingHorizontal: 4 },

  // Chips
  chip:    { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADII.pill },
  chipTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  // Day cards
  dayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: RADII.lg,
  },
  dayBadge:     { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  dayBadgeNum:  { fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  dayCardHead:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  todayTag:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  todayTagTxt:  { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  dayCardDate:  { fontSize: 11, fontWeight: '700' },
  dayCardTitle: { fontSize: 14.5, fontWeight: '800', lineHeight: 19, letterSpacing: -0.2 },
  dayCardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  dayCardMetaTxt:{ fontSize: 11, fontWeight: '700' },
  doneBadge:    { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },

  // Empty
  emptyCard:  { padding: 28, borderRadius: RADII.xl, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 32, marginBottom: 4 },
  emptyTxt:   { fontSize: 15, fontWeight: '900' },
  emptySub:   { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
