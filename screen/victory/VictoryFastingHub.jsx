// screen/victory/VictoryFastingHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Fasting dashboard.
//
//   • Active fast hero (countdown ring, elapsed / remaining time)
//   • Quick-start templates (Daniel, Partial, Full, Custom)
//   • Upcoming fasts list (scheduled but not yet started)
//   • Past fasts (completed/expired) with mark-as-completed
//   • CTA → VictoryFastingScheduler
//
// Live countdown ticks every second via useFastingCountdown.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }    from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import {
  GlassCard, BackBar, Eyebrow, SectionHead, ProgressRing,
  GradientCTA, EmptyState, CelebrateOverlay,
} from './VictoryUI';
import {
  BLUE, INDIGO, EMERALD, AMBER, ROSE, RADII, AMBIENT_SHADOW, victoryTones,
} from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import { useFasts, useActiveFast, useFastingCountdown, useAchievementsHook } from './victoryHooks';
import { BADGE_BY_ID } from './victoryAchievements';

const TEMPLATES = [
  { id: 'partial', name: 'Partial',  hours: 12, blurb: '6am — 6pm. Skip breakfast and lunch.', emoji: '🌅' },
  { id: 'daniel',  name: 'Daniel',   hours: 72, blurb: '3-day Daniel fast. Veg + water.',      emoji: '🌿' },
  { id: 'full',    name: 'Full',     hours: 24, blurb: '24-hour water-only fast.',             emoji: '💧' },
  { id: 'custom',  name: 'Custom',   hours: 0,  blurb: 'Choose your own start & end.',         emoji: '⏱️' },
];

export default function VictoryFastingHub({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const { list: fasts, update, remove } = useFasts();
  const { fast: active } = useActiveFast();
  const countdown = useFastingCountdown(active);
  const { recompute } = useAchievementsHook();
  const [celebrate, setCelebrate] = useState(null);

  // Periodic re-render so date-based filters (upcoming / awaitingFinish)
  // refresh as time passes, not only when the fasts list mutates. 30s is a
  // good balance — cheap to run, and the user sees the "Fast ended" banner
  // within a window that feels real-time without thrashing renders.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const upcoming = useMemo(() => {
    return fasts.filter((f) => !f.completed && new Date(f.startISO).getTime() > nowTick);
  }, [fasts, nowTick]);
  const past = useMemo(() => {
    return fasts.filter((f) => f.completed || new Date(f.endISO).getTime() < nowTick);
  }, [fasts, nowTick]);

  // "Just ended" awaiting acknowledgement — fasts whose end time has passed
  // but the user hasn't manually marked complete yet. Mirrors what the alarm
  // notification was prompting about, so opening the hub from the alarm
  // surfaces a clear next action.
  const awaitingFinish = useMemo(() => {
    return fasts.filter((f) => !f.completed && new Date(f.endISO).getTime() <= nowTick);
  }, [fasts, nowTick]);

  const markComplete = async (f) => {
    await update(f.id, { completed: true });
    const newly = await recompute();
    if (newly.length) setCelebrate(BADGE_BY_ID[newly[0]]);
  };

  // Confirmed delete for items in the Past Fasts list. We require an explicit
  // confirmation because the row vanishes immediately and can't be recovered
  // (no soft-delete / trash). A long press wouldn't be discoverable enough,
  // so the row shows a small trash button and this confirms before calling
  // remove().
  const confirmDeletePast = (f) => {
    Alert.alert(
      'Delete fast?',
      `Remove "${f.title}" from your history? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(f.id) },
      ],
    );
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
          eyebrow={t('vmp_caps', 'VICTORY MONTH')}
          title={t('vmp_fasting_title', 'Fasting Hub')}
          tones={tones}
          tk={tk}
        />

        {/* ── ENDED-AWAITING BANNER ────────────────────────────────────────
            Fasts whose end time has already passed but the user hasn't yet
            tapped Mark complete. This is what the user lands on when they
            tap the "Fasting time is over!" alarm — a clear, one-tap finish. */}
        {awaitingFinish.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 18, gap: 10 }}>
            {awaitingFinish.map((f) => (
              <LinearGradient
                key={f.id}
                colors={[EMERALD[500], '#14B8A6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.endedBanner, AMBIENT_SHADOW]}
              >
                <View style={s.endedRow}>
                  <Text style={{ fontSize: 32 }}>⏰</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.endedEyebrow}>{t('vmp_fasting_time_over', 'FASTING TIME IS OVER')}</Text>
                    <Text style={s.endedTitle} numberOfLines={1}>{f.title}</Text>
                    <Text style={s.endedSub}>
                      {t('vmp_fasting_break_msg', 'Break your fast in thanksgiving — God has heard you.')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => markComplete(f)}
                  activeOpacity={0.86}
                  style={[s.endedCta, { backgroundColor: '#fff' }]}
                >
                  <Text style={[s.endedCtaTxt, { color: EMERALD[600] }]}>
                    {t('vmp_fasting_mark_complete', '✓  Mark complete')}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            ))}
          </View>
        )}

        {/* ── ACTIVE FAST HERO ─────────────────────────────────────────── */}
        {active && countdown ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <LinearGradient
              colors={[BLUE[800], INDIGO[600]]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[s.activeCard, AMBIENT_SHADOW]}
            >
              <Eyebrow color="rgba(255,255,255,0.78)">{t('vmp_fasting_now', 'FASTING NOW')}</Eyebrow>
              <Text style={s.activeTitle}>{active.title}</Text>
              <View style={s.activeRingRow}>
                <ProgressRing
                  size={150}
                  stroke={11}
                  pct={countdown.pct}
                  colours={['#fff', '#A5B4FC']}
                  trackColour="rgba(255,255,255,0.18)"
                >
                  <Text style={s.activeRingPct}>{countdown.pct}%</Text>
                  <Text style={s.activeRingSub}>complete</Text>
                </ProgressRing>
                <View style={{ flex: 1 }}>
                  <KV label={t('vmp_fasting_remaining', 'Remaining')} value={countdown.remainStr} accent="#fff" />
                  <KV label={t('vmp_fasting_elapsed', 'Elapsed')}     value={countdown.elapsedStr} accent="rgba(255,255,255,0.85)" />
                  <KV label={t('vmp_fasting_type', 'Type')}           value={active.type}        accent="rgba(255,255,255,0.85)" />
                </View>
              </View>
              <View style={s.activeFootRow}>
                <TouchableOpacity
                  onPress={() => markComplete(active)}
                  activeOpacity={0.85}
                  style={[s.activeBtn, { backgroundColor: '#fff' }]}
                >
                  <Text style={[s.activeBtnTxt, { color: BLUE[800] }]}>
                    {t('vmp_fasting_mark_complete_short', '✓ Mark complete')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => remove(active.id)}
                  activeOpacity={0.85}
                  style={[s.activeBtn, { backgroundColor: 'rgba(255,255,255,0.16)' }]}
                >
                  <Text style={s.activeBtnTxt}>{t('vmp_fasting_cancel', 'Cancel')}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <GlassCard tones={tones} padding={20}>
              <Eyebrow color={tones.chipFg}>{t('vmp_fasting_no_active', 'NO ACTIVE FAST')}</Eyebrow>
              <Text style={[s.noFastTitle, { color: tk.textPrimary }]}>
                {t('vmp_fasting_no_active_title', 'Set apart a time to seek God')}
              </Text>
              <Text style={[s.noFastBody, { color: tk.textSec }]}>
                {t('vmp_fasting_no_active_body', 'Fasting humbles the soul and amplifies prayer. Choose a quick template below or set a custom start and end.')}
              </Text>
            </GlassCard>
          </View>
        )}

        {/* ── QUICK START ──────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <SectionHead
            tk={tk}
            tones={tones}
            eyebrow={t('vmp_fasting_quick_start', 'QUICK START')}
            title={t('vmp_fasting_quick_start_title', 'Choose a fasting template')}
          />
          <View style={s.templateGrid}>
            {TEMPLATES.map((t, i) => (
              <TemplateTile
                key={t.id}
                template={t}
                index={i}
                tk={tk}
                tones={tones}
                onPress={() =>
                  navigation.navigate('VictoryFastingScheduler', { template: t.id })
                }
              />
            ))}
          </View>
        </View>

        {/* ── UPCOMING ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <SectionHead
            tk={tk}
            tones={tones}
            eyebrow={t('vmp_fasting_upcoming', 'UPCOMING')}
            title={t('vmp_fasting_upcoming_title', 'Scheduled fasts')}
          />
          {upcoming.length === 0 ? (
            <EmptyState
              tones={tones} tk={tk}
              emoji="🗓️"
              title={t('vmp_fasting_empty_title', 'No scheduled fasts')}
              body={t('vmp_fasting_empty_body', "Plan ahead — knowing when you'll fast helps you prepare your body and spirit.")}
              action={t('vmp_fasting_schedule_action', 'Schedule a fast')}
              onAction={() => navigation.navigate('VictoryFastingScheduler', { template: 'custom' })}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {upcoming.map((f, i) => (
                <FastRow
                  key={f.id} fast={f} index={i}
                  tk={tk} tones={tones}
                  onCancel={() => remove(f.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── HISTORY ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <SectionHead
            tk={tk}
            tones={tones}
            eyebrow="HISTORY"
            title="Past fasts"
          />
          {past.length === 0 ? (
            <View style={{ opacity: 0.7 }}>
              <EmptyState
                tones={tones} tk={tk}
                emoji="✨"
                title="No history yet"
                body="Completed and expired fasts will appear here so you can look back on your consecration journey."
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {past.map((f, i) => (
                <FastRow
                  key={f.id} fast={f} index={i}
                  tk={tk} tones={tones}
                  finished
                  onDelete={() => confirmDeletePast(f)}
                />
              ))}
            </View>
          )}
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 20 }}>
          <GradientCTA
            label="Schedule a custom fast →"
            onPress={() => navigation.navigate('VictoryFastingScheduler', { template: 'custom' })}
            colors={[BLUE[700], BLUE[500]]}
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

// ── Sub-components ─────────────────────────────────────────────────────────
const KV = ({ label, value, accent }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={[s.kvLbl, { color: 'rgba(255,255,255,0.65)' }]}>{label.toUpperCase()}</Text>
    <Text style={[s.kvVal, { color: accent }]}>{value}</Text>
  </View>
);

const TemplateTile = ({ template, index, tk, tones, onPress }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 6));
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }], width: '48%' }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <GlassCard tones={tones} padding={16}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>{template.emoji}</Text>
          <Text style={[s.tplName, { color: tk.textPrimary }]}>{template.name}</Text>
          <Text style={[s.tplHours, { color: tones.chipFg }]}>
            {template.hours > 0 ? `${template.hours}h` : 'Flexible'}
          </Text>
          <Text style={[s.tplBlurb, { color: tk.textMuted }]} numberOfLines={2}>
            {template.blurb}
          </Text>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
};

const FastRow = ({ fast, index, tk, tones, onCancel, onDelete, finished }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 6));
  const start = new Date(fast.startISO);
  const end   = new Date(fast.endISO);
  const hrs   = Math.round((end - start) / 3600000);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <GlassCard tones={tones} padding={14}>
        <View style={s.fastRow}>
          <View style={[s.fastBadge, { backgroundColor: tones.chipBg }]}>
            <Text style={[s.fastBadgeTxt, { color: tones.chipFg }]}>
              {fast.type.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.fastTitle, { color: tk.textPrimary }]} numberOfLines={1}>
              {fast.title}
            </Text>
            <Text style={[s.fastMeta, { color: tk.textMuted }]} numberOfLines={1}>
              {start.toLocaleDateString()} → {end.toLocaleDateString()}  ·  {hrs}h
            </Text>
          </View>
          {finished ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.fastTag, { backgroundColor: EMERALD[100] }]}>
                <Text style={[s.fastTagTxt, { color: EMERALD[600] }]}>
                  {fast.completed ? '✓ Done' : 'Ended'}
                </Text>
              </View>
              {onDelete && (
                <TouchableOpacity
                  onPress={onDelete}
                  activeOpacity={0.7}
                  accessibilityLabel="Delete this fast from history"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={s.fastDeleteBtn}
                >
                  <Text style={{ fontSize: 14 }}>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : onCancel ? (
            <TouchableOpacity onPress={onCancel} activeOpacity={0.78}>
              <Text style={{ color: ROSE[500], fontSize: 14, fontWeight: '900' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </GlassCard>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  // "Fasting time is over!" banner — fires when the OS notification taps
  // route the user here, or when an end time has passed in-app.
  endedBanner:    { padding: 18, borderRadius: RADII.xl, gap: 14 },
  endedRow:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  endedEyebrow:   { fontSize: 11, fontWeight: '900', letterSpacing: 2.2, color: 'rgba(255,255,255,0.85)' },
  endedTitle:     { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.4, marginTop: 2 },
  endedSub:       { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  endedCta:       { paddingVertical: 13, borderRadius: 999, alignItems: 'center' },
  endedCtaTxt:    { fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },

  activeCard:    { padding: 22, borderRadius: RADII.xl },
  activeTitle:   { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: 6 },
  activeRingRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 18 },
  activeRingPct: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -1.2 },
  activeRingSub: { fontSize: 10.5, fontWeight: '800', color: 'rgba(255,255,255,0.78)', letterSpacing: 0.4, marginTop: 2 },
  kvLbl:         { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  kvVal:         { fontSize: 18, fontWeight: '900', marginTop: 3, letterSpacing: -0.3 },
  activeFootRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  activeBtn:     { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  activeBtnTxt:  { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },

  noFastTitle:   { fontSize: 19, fontWeight: '900', lineHeight: 25, letterSpacing: -0.3, marginTop: 6 },
  noFastBody:    { fontSize: 13.5, lineHeight: 20, fontWeight: '500', marginTop: 8 },

  templateGrid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  tplName:       { fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  tplHours:      { fontSize: 18, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  tplBlurb:      { fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 6 },

  fastRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fastBadge:     { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  fastBadgeTxt:  { fontSize: 15, fontWeight: '900' },
  fastTitle:     { fontSize: 14, fontWeight: '900' },
  fastMeta:      { fontSize: 11.5, fontWeight: '700', marginTop: 3 },
  fastTag:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  fastTagTxt:    { fontSize: 11, fontWeight: '900' },
  fastDeleteBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
