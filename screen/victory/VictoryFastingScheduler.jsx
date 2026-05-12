// screen/victory/VictoryFastingScheduler.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Configure a new fast: title, type, start / end, recurring cadence.
//
// Built with platform-friendly inputs (no native date picker dependency) —
// we use a date+time string format the user can adjust in 6h chunks via
// quick buttons or directly via TextInput. Validates that end > start.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  StatusBar, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }    from '../../context/ThemeContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry } from '../../hooks/useFluidAnim';
import {
  GlassCard, BackBar, Eyebrow, SectionHead, Chip, GradientCTA, CelebrateOverlay,
} from './VictoryUI';
import {
  BLUE, INDIGO, EMERALD, AMBER, RADII, victoryTones,
} from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import { useFasts, useAchievementsHook } from './victoryHooks';
import { BADGE_BY_ID } from './victoryAchievements';

const TYPES = [
  { id: 'partial', label: 'Partial' },
  { id: 'full',    label: 'Full water' },
  { id: 'daniel',  label: 'Daniel' },
  { id: 'custom',  label: 'Custom' },
];

const RECURRENCE = [
  { id: 'none',    label: 'Just once' },
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
];

// Template → suggested duration in hours
const TPL_HOURS = { partial: 12, full: 24, daniel: 72, custom: 24 };

// Format a Date to a "YYYY-MM-DD HH:MM" string the user can edit directly.
const formatLocal = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// Parse the same back. Tolerant of extra spaces / partial input.
const parseLocal = (str) => {
  const m = String(str || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[\s T]+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, Y, M, D, h, mn] = m;
  const d = new Date(Number(Y), Number(M) - 1, Number(D), Number(h), Number(mn));
  return isNaN(d.getTime()) ? null : d;
};

export default function VictoryFastingScheduler({ route, navigation }) {
  const initialTpl = route?.params?.template || 'partial';
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const { add } = useFasts();
  const { recompute } = useAchievementsHook();

  const [type,      setType]     = useState(initialTpl);
  const [title,     setTitle]    = useState('');
  const [recurring, setRecurring] = useState('none');
  const [startStr,  setStartStr] = useState('');
  const [endStr,    setEndStr]   = useState('');
  const [celebrate, setCelebrate] = useState(null);

  // Default start = next round hour. End = start + template hours.
  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + (TPL_HOURS[type] || 24));
    setStartStr(formatLocal(start));
    setEndStr(formatLocal(end));
  }, [type]);

  // When user shifts start, slide end alongside it (keep duration).
  const adjustStart = (deltaHours) => {
    const s = parseLocal(startStr);
    const e = parseLocal(endStr);
    if (!s) return;
    const dur = e ? (e.getTime() - s.getTime()) : (TPL_HOURS[type] || 24) * 3600000;
    s.setHours(s.getHours() + deltaHours);
    setStartStr(formatLocal(s));
    const ne = new Date(s.getTime() + dur);
    setEndStr(formatLocal(ne));
  };

  const adjustDuration = (deltaHours) => {
    const e = parseLocal(endStr);
    if (!e) return;
    e.setHours(e.getHours() + deltaHours);
    setEndStr(formatLocal(e));
  };

  const startDate = parseLocal(startStr);
  const endDate   = parseLocal(endStr);
  const validRange = startDate && endDate && endDate.getTime() > startDate.getTime();
  const durHrs    = validRange ? Math.round((endDate - startDate) / 3600000) : 0;

  const save = async () => {
    if (!validRange) {
      Alert.alert('Invalid range', 'Please check the start and end times — end must be after start.');
      return;
    }
    await add({
      title:     (title || autoTitle(type, durHrs)),
      type,
      startISO:  startDate.toISOString(),
      endISO:    endDate.toISOString(),
      recurring,
    });
    const newly = await recompute();
    if (newly.length) {
      setCelebrate(BADGE_BY_ID[newly[0]]);
      setTimeout(() => navigation.goBack(), 2300);
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.6} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: fade, transform: [{ translateY }] }}
      >
        <BackBar
          onBack={() => navigation.goBack()}
          eyebrow="VICTORY MONTH"
          title="Schedule a fast"
          tones={tones}
          tk={tk}
        />

        {/* ── TITLE ────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
          <GlassCard tones={tones} padding={18}>
            <Eyebrow color={tones.chipFg}>NAME YOUR FAST</Eyebrow>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={autoTitle(type, durHrs)}
              placeholderTextColor={tk.textMuted}
              style={[s.titleInput, { color: tk.textPrimary }]}
            />
          </GlassCard>
        </View>

        {/* ── TYPE ─────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
          <SectionHead tk={tk} tones={tones} eyebrow="TYPE" title="What kind of fast?" />
          <View style={s.chipRow}>
            {TYPES.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                active={t.id === type}
                onPress={() => setType(t.id)}
                bg={tones.chipBg}
                fg={tones.chipFg}
                accent={BLUE[600]}
              />
            ))}
          </View>
        </View>

        {/* ── START ────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
          <SectionHead tk={tk} tones={tones} eyebrow="START" title="When does this fast begin?" />
          <GlassCard tones={tones} padding={14}>
            <TextInput
              value={startStr}
              onChangeText={setStartStr}
              placeholder="YYYY-MM-DD HH:MM"
              placeholderTextColor={tk.textMuted}
              style={[s.dateInput, { color: tk.textPrimary, backgroundColor: tones.chipBg }]}
            />
            <View style={s.quickRow}>
              <Quick label="−6h"  onPress={() => adjustStart(-6)} tones={tones} />
              <Quick label="−1h"  onPress={() => adjustStart(-1)} tones={tones} />
              <Quick label="Now"  onPress={() => {
                const n = new Date(); n.setSeconds(0, 0);
                setStartStr(formatLocal(n));
              }} tones={tones} accent />
              <Quick label="+1h"  onPress={() => adjustStart(+1)} tones={tones} />
              <Quick label="+6h"  onPress={() => adjustStart(+6)} tones={tones} />
            </View>
          </GlassCard>
        </View>

        {/* ── END ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
          <SectionHead tk={tk} tones={tones} eyebrow="END" title="When does it finish?" />
          <GlassCard tones={tones} padding={14}>
            <TextInput
              value={endStr}
              onChangeText={setEndStr}
              placeholder="YYYY-MM-DD HH:MM"
              placeholderTextColor={tk.textMuted}
              style={[s.dateInput, { color: tk.textPrimary, backgroundColor: tones.chipBg }]}
            />
            <View style={s.quickRow}>
              <Quick label="−6h"  onPress={() => adjustDuration(-6)} tones={tones} />
              <Quick label="−1h"  onPress={() => adjustDuration(-1)} tones={tones} />
              <Quick label="+1h"  onPress={() => adjustDuration(+1)} tones={tones} />
              <Quick label="+6h"  onPress={() => adjustDuration(+6)} tones={tones} />
              <Quick label="+24h" onPress={() => adjustDuration(+24)} tones={tones} accent />
            </View>
            <View style={s.durRow}>
              <Text style={[s.durLbl, { color: tones.chipFg }]}>DURATION</Text>
              <Text style={[s.durVal, {
                color: validRange ? tk.textPrimary : '#DC2626',
              }]}>
                {validRange ? `${durHrs} hours` : 'Invalid range'}
              </Text>
            </View>
          </GlassCard>
        </View>

        {/* ── RECURRENCE ───────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <SectionHead tk={tk} tones={tones} eyebrow="REPEAT" title="Recur this fast?" />
          <View style={s.chipRow}>
            {RECURRENCE.map((r) => (
              <Chip
                key={r.id}
                label={r.label}
                active={r.id === recurring}
                onPress={() => setRecurring(r.id)}
                bg={tones.chipBg}
                fg={tones.chipFg}
                accent={INDIGO[600]}
              />
            ))}
          </View>
        </View>

        {/* CTAs */}
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <GradientCTA
            label={validRange ? 'Schedule fast →' : 'Fix range to schedule'}
            onPress={save}
            disabled={!validRange}
          />
          <GradientCTA
            label="Cancel"
            onPress={() => navigation.goBack()}
            colors={['#94A3B8', '#475569']}
          />
        </View>
      </Animated.ScrollView>

      <CelebrateOverlay
        visible={!!celebrate}
        badge={celebrate}
        onDone={() => setCelebrate(null)}
      />
    </SafeAreaView>
  );
}

const autoTitle = (type, hours) => {
  const m = {
    partial: 'Partial fast',
    full:    'Full fast',
    daniel:  'Daniel fast',
    custom:  hours ? `${hours}-hour fast` : 'My fast',
  };
  return m[type] || 'My fast';
};

const Quick = ({ label, onPress, tones, accent }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[
      s.quick,
      { backgroundColor: accent ? BLUE[600] : tones.chipBg },
    ]}
  >
    <Text style={[s.quickTxt, { color: accent ? '#fff' : tones.chipFg }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  titleInput: {
    fontSize: 20, fontWeight: '900', letterSpacing: -0.4, marginTop: 8, paddingVertical: 4,
  },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateInput:  {
    fontSize: 15, fontWeight: '800', letterSpacing: 0.1,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
  },
  quickRow:   { flexDirection: 'row', gap: 6, marginTop: 10 },
  quick:      { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  quickTxt:   { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  durRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  durLbl:     { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4 },
  durVal:     { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
});
