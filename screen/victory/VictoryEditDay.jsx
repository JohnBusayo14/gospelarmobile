// screen/victory/VictoryEditDay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Personal journaling for a Victory Month day. Lets the user add to the
// otherwise-fixed devotional with:
//   • Reflection — free-form journal of what the day meant
//   • Testimony  — what God did during the prayer
//   • Note       — any additional context they want to remember
//   • Custom prayer points — their own intercessions, with tick boxes
//
// All changes save instantly via the victoryStore. Achievements re-evaluate
// after every save so the celebration overlay fires when a milestone unlocks.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }     from '../../context/ThemeContext';
import { getTokens }    from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import { useVictoryDay, useVictoryDays } from '../../hooks/useVictoryContent';
import {
  GlassCard, GradientCTA, BackBar, Eyebrow, SectionHead, CelebrateOverlay, EmptyState,
} from './VictoryUI';
import {
  BLUE, INDIGO, EMERALD, AMBER, ROSE, RADII, victoryTones,
} from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import {
  useDayNote, useCustomPoints, useAchievementsHook,
} from './victoryHooks';
import { BADGE_BY_ID } from './victoryAchievements';

const TABS = [
  { id: 'reflection', label: 'Reflection',  emoji: '✍️', placeholder: 'What is God saying to you today? How did this prayer move your heart?' },
  { id: 'testimony',  label: 'Testimony',   emoji: '🗣️', placeholder: 'What did God do today as you prayed? Record it before you forget.' },
  { id: 'note',       label: 'Notes',       emoji: '📝', placeholder: 'Additional context — names, scriptures, anything you want to remember.' },
];

export default function VictoryEditDay({ route, navigation }) {
  // TOTAL_DAYS comes from the admin-managed days list (length is the source
  // of truth — admin can extend beyond 30 by adding more daily entries).
  const { days: allDays } = useVictoryDays(navigation);
  const TOTAL_DAYS = allDays?.length || 30;
  const dayNum = Math.max(1, Math.min(TOTAL_DAYS, Number(route?.params?.day) || 1));
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  // Day body (focus, scripture, etc.) is admin-editable and pulled live.
  const { day: dayDb } = useVictoryDay(dayNum, navigation);
  const day = dayDb || { date: '', focus: '', scripture: '', message: '', prayer_points: [], intercession: '' };

  const { note, save }                  = useDayNote(dayNum);
  const { list: customs, add, update, remove } = useCustomPoints(dayNum);
  const { recompute }                   = useAchievementsHook();

  const [tab, setTab]   = useState('reflection');
  const [draft, setDraft] = useState({ reflection: '', testimony: '', note: '' });
  const [newPoint, setNewPoint] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const debounceRef = useRef(null);

  // Hydrate draft when the note loads.
  useEffect(() => {
    setDraft({
      reflection: note.reflection || '',
      testimony:  note.testimony  || '',
      note:       note.note       || '',
    });
  }, [note.reflection, note.testimony, note.note]);

  // Debounced auto-save.
  const setField = (key) => (value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await save({ [key]: value });
      setSavedAt(Date.now());
      const newly = await recompute();
      if (newly.length) setCelebrate(BADGE_BY_ID[newly[0]]);
    }, 600);
  };

  const addPoint = async () => {
    const v = newPoint.trim();
    if (!v) return;
    await add(v);
    setNewPoint('');
    const newly = await recompute();
    if (newly.length) setCelebrate(BADGE_BY_ID[newly[0]]);
  };

  const togglePrayed = async (id, cur) => {
    await update(id, { prayed: !cur });
  };

  // Snapshot of how much the user has written, surfaced in the hero pill.
  const journalChars = (note.reflection || '').length + (note.testimony || '').length + (note.note || '').length;
  const filledTabs   = ['reflection', 'testimony', 'note'].filter((k) => (draft[k] || '').trim()).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.6} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
          style={{ opacity: fade, transform: [{ translateY }] }}
          keyboardShouldPersistTaps="handled"
        >
          <BackBar
            onBack={() => navigation.goBack()}
            eyebrow={`DAY ${dayNum} · JOURNAL`}
            title={day.focus?.slice(0, 32) || 'My journal'}
            tones={tones}
            tk={tk}
          />

          {/* ── HERO ───────────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
            <GlassCard tones={tones} padding={20}>
              <Eyebrow color={tones.chipFg}>{day.date}</Eyebrow>
              <Text style={[s.heroTitle, { color: tk.textPrimary, marginTop: 6 }]}>
                {day.focus}
              </Text>
              <View style={s.heroStats}>
                <Pill label={`${journalChars} chars`}  bg={tones.versePillBg} fg={tones.versePillFg} />
                <Pill label={`${filledTabs}/3 sections`} bg={EMERALD[500] + '22'} fg={EMERALD[600]} />
                <Pill label={`${customs.length} custom pts`} bg={AMBER[500] + '22'} fg={AMBER[600]} />
              </View>
            </GlassCard>
          </View>

          {/* ── TABS ───────────────────────────────────────────────────── */}
          <View style={s.tabRow}>
            {TABS.map((t) => {
              const active   = tab === t.id;
              const hasValue = !!(draft[t.id] || '').trim();
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  activeOpacity={0.85}
                  style={[s.tab, {
                    backgroundColor: active ? BLUE[600] : tones.chipBg,
                  }]}
                >
                  <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
                  <Text style={[s.tabLbl, { color: active ? '#fff' : tones.chipFg }]}>
                    {t.label}
                  </Text>
                  {hasValue && !active && (
                    <View style={s.tabDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── EDITOR ─────────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <GlassCard tones={tones} padding={18}>
              <View style={s.editorHeadRow}>
                <Eyebrow color={tones.chipFg}>
                  {TABS.find((t) => t.id === tab)?.label}
                </Eyebrow>
                {!!savedAt && (
                  <Text style={[s.savedLbl, { color: EMERALD[600] }]}>
                    ✓ Saved
                  </Text>
                )}
              </View>
              <TextInput
                value={draft[tab]}
                onChangeText={setField(tab)}
                placeholder={TABS.find((t) => t.id === tab)?.placeholder}
                placeholderTextColor={tk.textMuted}
                multiline
                textAlignVertical="top"
                style={[s.editor, { color: tk.textPrimary }]}
              />
            </GlassCard>
          </View>

          {/* ── CUSTOM PRAYER POINTS ──────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <SectionHead
              tk={tk}
              tones={tones}
              eyebrow="MY ADDITIONS"
              title="Custom prayer points"
            />
            <GlassCard tones={tones} padding={14}>
              {/* Composer */}
              <View style={[s.composer, { backgroundColor: tones.chipBg }]}>
                <TextInput
                  value={newPoint}
                  onChangeText={setNewPoint}
                  placeholder="Father, I add to today's prayer…"
                  placeholderTextColor={tk.textMuted}
                  style={[s.composerInput, { color: tk.textPrimary }]}
                  onSubmitEditing={addPoint}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={addPoint}
                  disabled={!newPoint.trim()}
                  activeOpacity={0.85}
                  style={[s.composerBtn, { backgroundColor: BLUE[600], opacity: newPoint.trim() ? 1 : 0.4 }]}
                >
                  <Text style={s.composerBtnTxt}>＋ Add</Text>
                </TouchableOpacity>
              </View>

              {/* List */}
              {customs.length === 0 ? (
                <View style={s.emptyInline}>
                  <Text style={{ fontSize: 26 }}>✨</Text>
                  <Text style={[s.emptyInlineTxt, { color: tk.textMuted }]}>
                    No custom prayer points yet. Add your own to extend today's prayer.
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 12, gap: 8 }}>
                  {customs.map((p, i) => (
                    <PointRow
                      key={p.id}
                      index={i + 1}
                      text={p.text}
                      prayed={p.prayed}
                      onTogglePrayed={() => togglePrayed(p.id, p.prayed)}
                      onRemove={() => remove(p.id)}
                      tk={tk}
                      tones={tones}
                    />
                  ))}
                </View>
              )}
            </GlassCard>
          </View>

          {/* ── CTAs ──────────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            <GradientCTA
              label="Listen to today's prayer →"
              onPress={() => navigation.navigate('VictoryAudioPlayer', { day: dayNum })}
              colors={[INDIGO[700], INDIGO[500]]}
            />
            <GradientCTA
              label="Back to day"
              onPress={() => navigation.navigate('VictoryDayScreen', { day: dayNum })}
              colors={[BLUE[700], BLUE[500]]}
            />
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <CelebrateOverlay
        visible={!!celebrate}
        badge={celebrate}
        onDone={() => setCelebrate(null)}
      />
    </SafeAreaView>
  );
}

const Pill = ({ label, bg, fg }) => (
  <View style={[s.pill, { backgroundColor: bg }]}>
    <Text style={[s.pillTxt, { color: fg }]}>{label}</Text>
  </View>
);

const PointRow = ({ index, text, prayed, onTogglePrayed, onRemove, tk, tones }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 8));
  return (
    <Animated.View style={[
      s.pointRow,
      { backgroundColor: tones.chipBg, opacity: fade, transform: [{ translateY }] },
    ]}>
      <TouchableOpacity
        onPress={onTogglePrayed}
        activeOpacity={0.8}
        style={[
          s.pointTick,
          { backgroundColor: prayed ? EMERALD[500] : 'transparent', borderColor: prayed ? EMERALD[500] : tones.chipFg },
        ]}
      >
        {prayed && <Text style={s.pointTickTxt}>✓</Text>}
      </TouchableOpacity>
      <Text
        style={[
          s.pointTxt,
          {
            color: prayed ? tk.textMuted : tk.textSec,
            textDecorationLine: prayed ? 'line-through' : 'none',
          },
        ]}
      >
        {text}
      </Text>
      <TouchableOpacity onPress={onRemove} activeOpacity={0.75} style={s.pointDel}>
        <Text style={[s.pointDelTxt, { color: ROSE[500] }]}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  heroTitle: { fontSize: 19, fontWeight: '900', lineHeight: 25, letterSpacing: -0.4 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pill:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADII.pill },
  pillTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  tab:    {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: RADII.pill, position: 'relative',
  },
  tabLbl: { fontSize: 12.5, fontWeight: '900', letterSpacing: 0.3 },
  tabDot: {
    position: 'absolute', top: 8, right: 8, width: 6, height: 6,
    borderRadius: 3, backgroundColor: EMERALD[500],
  },

  editorHeadRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  savedLbl: { fontSize: 11.5, fontWeight: '900', letterSpacing: 0.3 },
  editor:   {
    minHeight: 160, fontSize: 15, lineHeight: 23, fontWeight: '500',
    padding: 0,
  },

  composer:      {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 14, paddingRight: 6, paddingVertical: 6, borderRadius: RADII.pill, gap: 8,
  },
  composerInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 8 },
  composerBtn:   { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADII.pill },
  composerBtnTxt:{ color: '#fff', fontSize: 12.5, fontWeight: '900' },

  emptyInline:    { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyInlineTxt: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', paddingHorizontal: 14, lineHeight: 18 },

  pointRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14,
  },
  pointTick: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  pointTickTxt: { fontSize: 11, fontWeight: '900', color: '#fff' },
  pointTxt:     { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  pointDel:     { padding: 4 },
  pointDelTxt:  { fontSize: 14, fontWeight: '900' },
});
