// screen/victory/VictoryReminders.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Recurring prayer reminders.
//
//   • Quick presets (Morning Devotion 6am, Midday 12pm, Watchman 12am, etc.)
//   • Custom reminder builder — label, time, days of the week, enable toggle
//   • Listing with edit/delete + per-row toggle
//
// Storage is local (victoryStore.addReminder). When the app's notification
// service is initialised, the reminder list is the source of truth — the
// service can read it and schedule via expo-notifications. For now the screen
// works fully and the data is ready when wiring lands.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  StatusBar, Animated, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }    from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import {
  GlassCard, BackBar, Eyebrow, SectionHead, Chip, GradientCTA, EmptyState,
} from './VictoryUI';
import {
  BLUE, INDIGO, EMERALD, AMBER, ROSE, RADII, victoryTones,
} from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import { useReminders } from './victoryHooks';

const PRESETS = [
  { id: 'morning', label: 'Morning Devotion',  time: '06:00', emoji: '🌅' },
  { id: 'midday',  label: 'Midday Pause',      time: '12:00', emoji: '☀️' },
  { id: 'evening', label: 'Evening Prayer',    time: '18:00', emoji: '🌇' },
  { id: 'night',   label: 'Watchman (Night)',  time: '00:00', emoji: '🌙' },
  { id: 'sab',     label: 'Sabbath Eve',       time: '18:00', emoji: '🕯️' },
];

const DAYS = [
  { i: 0, short: 'S', full: 'Sun' },
  { i: 1, short: 'M', full: 'Mon' },
  { i: 2, short: 'T', full: 'Tue' },
  { i: 3, short: 'W', full: 'Wed' },
  { i: 4, short: 'T', full: 'Thu' },
  { i: 5, short: 'F', full: 'Fri' },
  { i: 6, short: 'S', full: 'Sat' },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function VictoryReminders({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const { list, add, update, remove } = useReminders();

  const [editing, setEditing] = useState(null);

  // ── Composer state ──────────────────────────────────────────────────
  const [label, setLabel] = useState('');
  const [time,  setTime]  = useState('06:00');
  const [days,  setDays]  = useState(ALL_DAYS);

  const toggleDay = (i) =>
    setDays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort());

  const addReminder = async () => {
    if (!label.trim() || !/^\d{2}:\d{2}$/.test(time)) {
      Alert.alert('Almost there', 'Add a label and a valid time (HH:MM).');
      return;
    }
    if (days.length === 0) {
      Alert.alert('Choose at least one day', 'Pick the weekdays this reminder repeats on.');
      return;
    }
    if (editing) {
      await update(editing, { label, time, days });
      setEditing(null);
    } else {
      await add({ label, time, days, enabled: true });
    }
    setLabel(''); setTime('06:00'); setDays(ALL_DAYS);
  };

  const startEdit = (r) => {
    setEditing(r.id);
    setLabel(r.label);
    setTime(r.time);
    setDays(r.days);
  };

  const usePreset = (p) => {
    setLabel(p.label);
    setTime(p.time);
    setDays(ALL_DAYS);
    setEditing(null);
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
          title={t('vmp_reminders_title', 'Prayer Reminders')}
          tones={tones}
          tk={tk}
        />

        {/* ── INTRO ────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
          <GlassCard tones={tones} padding={18}>
            <Eyebrow color={tones.chipFg}>{t('vmp_reminders_eyebrow', 'STAY IN RHYTHM')}</Eyebrow>
            <Text style={[s.heroTitle, { color: tk.textPrimary }]}>
              {t('vmp_reminders_hero_title', 'Set times to meet with God')}
            </Text>
            <Text style={[s.heroBody, { color: tk.textSec }]}>
              {t('vmp_reminders_hero_body', 'Build a daily rhythm. Each reminder fires at the time you choose, on the days you choose. Tap a preset below to start fast.')}
            </Text>
          </GlassCard>
        </View>

        {/* ── PRESETS ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <SectionHead tk={tk} tones={tones}
            eyebrow={t('vmp_reminders_presets_eyebrow', 'QUICK')}
            title={t('vmp_reminders_presets_title', 'Presets')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 20 }}
            style={{ marginHorizontal: -20, paddingLeft: 20 }}
          >
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => usePreset(p)}
                activeOpacity={0.85}
                style={[s.preset, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}
              >
                <Text style={{ fontSize: 26 }}>{p.emoji}</Text>
                <Text style={[s.presetTime, { color: tones.chipFg }]}>{p.time}</Text>
                <Text style={[s.presetLbl, { color: tk.textPrimary }]} numberOfLines={1}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── COMPOSER ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <SectionHead
            tk={tk} tones={tones}
            eyebrow={editing ? t('vmp_reminders_editing_eyebrow', 'EDITING') : t('vmp_reminders_create_eyebrow', 'CREATE')}
            title={editing ? t('vmp_reminders_editing_title', 'Edit this reminder') : t('vmp_reminders_create_title', 'Add a new reminder')}
            action={editing ? t('vmp_reminders_cancel_edit', 'Cancel edit') : null}
            onAction={editing ? () => { setEditing(null); setLabel(''); setTime('06:00'); setDays(ALL_DAYS); } : null}
          />
          <GlassCard tones={tones} padding={16}>
            <View style={{ gap: 14 }}>
              <View>
                <Text style={[s.fieldLbl, { color: tones.chipFg }]}>{t('vmp_reminders_field_label', 'LABEL')}</Text>
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder={t('vmp_reminders_label_placeholder', 'Morning Devotion')}
                  placeholderTextColor={tk.textMuted}
                  style={[s.field, { color: tk.textPrimary, backgroundColor: tones.chipBg }]}
                />
              </View>
              <View>
                <Text style={[s.fieldLbl, { color: tones.chipFg }]}>{t('vmp_reminders_field_time', 'TIME (24H)')}</Text>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="06:00"
                  placeholderTextColor={tk.textMuted}
                  style={[s.field, { color: tk.textPrimary, backgroundColor: tones.chipBg }]}
                  maxLength={5}
                />
              </View>
              <View>
                <Text style={[s.fieldLbl, { color: tones.chipFg }]}>{t('vmp_reminders_field_repeat', 'REPEAT ON')}</Text>
                <View style={s.daysRow}>
                  {DAYS.map((d) => {
                    const active = days.includes(d.i);
                    return (
                      <TouchableOpacity
                        key={d.i}
                        onPress={() => toggleDay(d.i)}
                        activeOpacity={0.85}
                        style={[
                          s.dayPill,
                          { backgroundColor: active ? BLUE[600] : tones.chipBg },
                        ]}
                      >
                        <Text style={[s.dayPillTxt, { color: active ? '#fff' : tones.chipFg }]}>
                          {d.short}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <GradientCTA
                label={editing ? t('vmp_reminders_save', 'Save changes') : t('vmp_reminders_add', 'Add reminder')}
                onPress={addReminder}
                size="md"
              />
            </View>
          </GlassCard>
        </View>

        {/* ── EXISTING ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <SectionHead tk={tk} tones={tones}
            eyebrow={t('vmp_reminders_active_eyebrow', 'YOUR')}
            title={t('vmp_reminders_active_title', 'Active reminders')} />
          {list.length === 0 ? (
            <EmptyState
              tones={tones} tk={tk}
              emoji="🔔"
              title={t('vmp_reminders_empty_title', 'No reminders yet')}
              body={t('vmp_reminders_empty_body', 'Add a daily rhythm of prayer above — your reminders will appear here.')}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {list.map((r, i) => (
                <ReminderRow
                  key={r.id}
                  r={r}
                  index={i}
                  tk={tk}
                  tones={tones}
                  t={t}
                  onEdit={() => startEdit(r)}
                  onRemove={() => remove(r.id)}
                  onToggle={() => update(r.id, { enabled: !r.enabled })}
                />
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const ReminderRow = ({ r, index, tk, tones, onEdit, onRemove, onToggle, t = (k, f) => f }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 6));
  const daysLabel = (() => {
    if (r.days.length === 7) return t('vmp_reminders_every_day', 'Every day');
    if (r.days.length === 5 && r.days.every((d) => d >= 1 && d <= 5)) return t('vmp_reminders_weekdays', 'Weekdays');
    if (r.days.length === 2 && r.days.includes(0) && r.days.includes(6)) return t('vmp_reminders_weekends', 'Weekends');
    return r.days.map((i) => DAYS[i].full).join(', ');
  })();
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <GlassCard tones={tones} padding={14}>
        <View style={s.rowHead}>
          <View>
            <Text style={[s.rowTime, { color: r.enabled ? BLUE[700] : tk.textMuted }]}>{r.time}</Text>
            <Text style={[s.rowLbl, { color: r.enabled ? tk.textPrimary : tk.textMuted }]}>
              {r.label}
            </Text>
          </View>
          <Switch
            value={!!r.enabled}
            onValueChange={onToggle}
            trackColor={{ true: BLUE[400], false: '#CBD5E1' }}
            thumbColor={r.enabled ? BLUE[700] : '#fff'}
          />
        </View>
        <View style={s.rowMetaRow}>
          <Text style={[s.rowMeta, { color: tones.chipFg }]}>{daysLabel}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={onEdit} activeOpacity={0.78}>
              <Text style={[s.rowAction, { color: BLUE[600] }]}>{t('vmp_edit_btn', 'Edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onRemove} activeOpacity={0.78}>
              <Text style={[s.rowAction, { color: ROSE[500] }]}>{t('vmp_delete_btn', 'Delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  heroTitle: { fontSize: 19, fontWeight: '900', lineHeight: 25, letterSpacing: -0.3, marginTop: 6 },
  heroBody:  { fontSize: 13.5, lineHeight: 20, fontWeight: '500', marginTop: 8 },

  preset:    {
    width: 140, padding: 14, borderRadius: RADII.lg, gap: 4,
  },
  presetTime:{ fontSize: 18, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  presetLbl: { fontSize: 12.5, fontWeight: '800' },

  fieldLbl: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4, marginBottom: 6 },
  field:    {
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12,
    fontSize: 15, fontWeight: '800',
  },

  daysRow:    { flexDirection: 'row', gap: 6 },
  dayPill:    { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  dayPillTxt: { fontSize: 13, fontWeight: '900' },

  rowHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTime:    { fontSize: 24, fontWeight: '900', letterSpacing: -0.7 },
  rowLbl:     { fontSize: 14, fontWeight: '800', marginTop: 2 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rowMeta:    { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },
  rowAction:  { fontSize: 12.5, fontWeight: '900' },
});
