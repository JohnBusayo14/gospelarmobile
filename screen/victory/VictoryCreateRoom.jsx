// screen/victory/VictoryCreateRoom.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Form for creating a new audio prayer room. Persists to the user-rooms
// slice of victoryStore. On save, routes the user straight into the new
// room so they can host immediately.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { getTokens } from '../../theme/tokens';
import { useScreenEntry } from '../../hooks/useFluidAnim';
import {
  GlassCard, BackBar, Eyebrow, SectionHead, Chip, GradientCTA,
} from './VictoryUI';
import { BLUE, RADII, AMBIENT_SHADOW, victoryTones } from './victoryTheme';
import {
  AMBIENT_TRACKS, ROOM_GRADIENTS, ROOM_CATEGORIES,
} from './victoryAudioData';
import { useUserRooms } from './victoryHooks';

const KINDS = [
  { id: 'live',     label: 'Live gathering',  blurb: 'Scheduled prayer at a fixed time.' },
  { id: 'recorded', label: 'Guided session',  blurb: 'Always-on, anyone can join solo.' },
];

const DURATIONS = [15, 30, 45, 60, 90];

export default function VictoryCreateRoom({ navigation }) {
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const { add } = useUserRooms();

  const [title, setTitle]         = useState('');
  const [host,  setHost]          = useState('');
  const [scripture, setScripture] = useState('');
  const [description, setDesc]    = useState('');
  const [kind, setKind]           = useState('live');
  const [category, setCategory]   = useState(ROOM_CATEGORIES[0]);
  const [duration, setDuration]   = useState(30);
  const [scheduled, setScheduled] = useState('20:00');
  const [ambient, setAmbient]     = useState('piano');
  const [gradientId, setGradientId] = useState(ROOM_GRADIENTS[4].id);
  const [saving, setSaving]       = useState(false);

  const chosenGrad = ROOM_GRADIENTS.find((g) => g.id === gradientId) || ROOM_GRADIENTS[0];

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Almost there', 'Give the room a short name so people know what they\'re joining.');
      return;
    }
    setSaving(true);
    try {
      const created = await add({
        title:        title.trim(),
        host:         host.trim() || 'You',
        scripture:    scripture.trim(),
        description:  description.trim(),
        kind,
        category,
        duration_min: duration,
        scheduled_at: kind === 'live' ? (scheduled || '20:00') : null,
        ambient,
        accent:       chosenGrad.accent,
        gradient:     chosenGrad.gradient,
      });
      navigation.replace('VictoryAudioRoom', { id: created.id });
    } catch (e) {
      Alert.alert('Could not create room', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  // Live preview card built from the form state — gives the user a sense
  // of what their room will look like in the list before they save it.
  const preview = {
    title:    title.trim() || 'Your prayer room',
    host:     host.trim()  || 'You',
    scripture:scripture.trim() || 'Add a scripture (optional)',
    category,
    kind,
    duration_min: duration,
    scheduled_at: scheduled || '20:00',
    participants_simulated: 1,
    gradient: chosenGrad.gradient,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY }] }}>
          <BackBar
            onBack={() => navigation.goBack()}
            eyebrow="NEW PRAYER ROOM"
            title="Create a room"
            tones={tones}
            tk={tk}
          />

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Preview */}
            <View style={{ marginBottom: 18 }}>
              <LinearGradient
                colors={preview.gradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.preview, AMBIENT_SHADOW]}
              >
                <View style={[s.orb, { top: -22, right: -16 }]} />
                <View style={[s.orb, { bottom: -28, left: -20, opacity: 0.4 }]} />
                <View style={s.pvHead}>
                  <View style={s.pvTag}>
                    <Text style={s.pvTagTxt}>
                      {preview.kind === 'live' ? '🔴  LIVE' : '📼  GUIDED'}
                    </Text>
                  </View>
                  <Text style={s.pvCat}>{preview.category.toUpperCase()}</Text>
                </View>
                <Text style={s.pvTitle} numberOfLines={2}>{preview.title}</Text>
                <Text style={s.pvScripture} numberOfLines={1}>📖  {preview.scripture}</Text>
                <View style={s.pvMetaRow}>
                  <Text style={s.pvMeta}>
                    {preview.kind === 'live' ? `Starts ${preview.scheduled_at}` : 'Always available'}
                  </Text>
                  <Text style={s.pvDot}>·</Text>
                  <Text style={s.pvMeta}>{preview.duration_min}m</Text>
                  <Text style={s.pvDot}>·</Text>
                  <Text style={s.pvMeta}>Host: {preview.host}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Title + host */}
            <GlassCard tones={tones} padding={16} style={{ marginBottom: 14 }}>
              <Field
                label="Room name"
                placeholder="e.g. Midnight Watch — Family Cover"
                value={title}
                onChangeText={setTitle}
                tk={tk}
                tones={tones}
                maxLength={64}
              />
              <Field
                label="Host"
                placeholder="Who is leading?"
                value={host}
                onChangeText={setHost}
                tk={tk}
                tones={tones}
                maxLength={40}
              />
            </GlassCard>

            {/* Kind */}
            <SectionHead tk={tk} tones={tones} eyebrow="ROOM TYPE" title="How will people join?" />
            <View style={{ gap: 10, marginBottom: 14 }}>
              {KINDS.map((k) => {
                const active = kind === k.id;
                return (
                  <TouchableOpacity
                    key={k.id}
                    onPress={() => setKind(k.id)}
                    activeOpacity={0.85}
                    style={[
                      s.kindCard,
                      {
                        backgroundColor: active ? tones.todayBg : tones.chipBg,
                        borderColor:     active ? tones.chipFg  : 'transparent',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.kindTitle, { color: tk.textPrimary }]}>{k.label}</Text>
                      <Text style={[s.kindBlurb, { color: tk.textSec }]}>{k.blurb}</Text>
                    </View>
                    <View style={[
                      s.kindRadio,
                      { borderColor: active ? tones.chipFg : tk.textMuted,
                        backgroundColor: active ? tones.chipFg : 'transparent' },
                    ]}>
                      {active && <View style={s.kindRadioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category */}
            <SectionHead tk={tk} tones={tones} eyebrow="THEME" title="Category" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 20, marginBottom: 14 }}
              style={{ marginHorizontal: -20, paddingLeft: 20 }}
            >
              {ROOM_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={category === c}
                  onPress={() => setCategory(c)}
                  bg={tones.chipBg}
                  fg={tones.chipFg}
                />
              ))}
            </ScrollView>

            {/* Scripture + description */}
            <GlassCard tones={tones} padding={16} style={{ marginBottom: 14 }}>
              <Field
                label="Scripture (optional)"
                placeholder="e.g. Isaiah 62:6-7"
                value={scripture}
                onChangeText={setScripture}
                tk={tk}
                tones={tones}
                maxLength={64}
              />
              <Field
                label="Description"
                placeholder="Tell people what you'll pray about…"
                value={description}
                onChangeText={setDesc}
                tk={tk}
                tones={tones}
                multiline
                maxLength={280}
              />
            </GlassCard>

            {/* Duration */}
            <SectionHead tk={tk} tones={tones} eyebrow="LENGTH" title="Duration" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 20, marginBottom: 14 }}
              style={{ marginHorizontal: -20, paddingLeft: 20 }}
            >
              {DURATIONS.map((d) => (
                <Chip
                  key={d}
                  label={`${d} min`}
                  active={duration === d}
                  onPress={() => setDuration(d)}
                  bg={tones.chipBg}
                  fg={tones.chipFg}
                />
              ))}
            </ScrollView>

            {/* Schedule — only for live */}
            {kind === 'live' && (
              <GlassCard tones={tones} padding={16} style={{ marginBottom: 14 }}>
                <Field
                  label="Starts at (HH:MM)"
                  placeholder="20:00"
                  value={scheduled}
                  onChangeText={setScheduled}
                  tk={tk}
                  tones={tones}
                  maxLength={5}
                />
                <Text style={[s.helper, { color: tk.textMuted }]}>
                  24-hour clock. Anyone who opens the room before this time will see a "Will start at…" indicator.
                </Text>
              </GlassCard>
            )}

            {/* Ambient */}
            <SectionHead tk={tk} tones={tones} eyebrow="BACKGROUND" title="Ambient sound" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 20, marginBottom: 14 }}
              style={{ marginHorizontal: -20, paddingLeft: 20 }}
            >
              {AMBIENT_TRACKS.map((tr) => {
                const active = ambient === tr.id;
                return (
                  <TouchableOpacity
                    key={tr.id}
                    onPress={() => setAmbient(tr.id)}
                    activeOpacity={0.85}
                    style={[
                      s.ambient,
                      { backgroundColor: active ? tones.chipFg : tones.chipBg },
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>{tr.emoji}</Text>
                    <Text style={[
                      s.ambientTxt,
                      { color: active ? '#fff' : tones.chipFg },
                    ]}>
                      {tr.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Gradient swatch */}
            <SectionHead tk={tk} tones={tones} eyebrow="LOOK" title="Card colour" />
            <View style={s.swatchRow}>
              {ROOM_GRADIENTS.map((g) => {
                const active = gradientId === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => setGradientId(g.id)}
                    activeOpacity={0.85}
                    style={[
                      s.swatch,
                      { borderColor: active ? '#fff' : 'transparent' },
                    ]}
                  >
                    <LinearGradient
                      colors={g.gradient}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.swatchFill}
                    />
                    {active && <View style={s.swatchTick}><Text style={s.swatchTickTxt}>✓</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer save */}
          <View style={[s.footer, { backgroundColor: tk.bg }]}>
            <GradientCTA
              label={saving ? 'Creating…' : 'Create & open room'}
              onPress={saving ? undefined : onSave}
              disabled={saving}
              icon="✨"
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Field = ({ label, value, onChangeText, placeholder, multiline, tk, tones, maxLength }) => (
  <View style={{ marginBottom: 12 }}>
    <Eyebrow color={tones.chipFg}>{label}</Eyebrow>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={tk.textMuted}
      multiline={!!multiline}
      maxLength={maxLength}
      style={[
        s.input,
        {
          color: tk.textPrimary,
          backgroundColor: tones.chipBg,
          minHeight: multiline ? 84 : 44,
          textAlignVertical: multiline ? 'top' : 'center',
        },
      ]}
    />
  </View>
);

const s = StyleSheet.create({
  preview:   { padding: 20, borderRadius: RADII.lg, overflow: 'hidden' },
  orb:       { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.16)' },
  pvHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pvTag:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  pvTagTxt:  { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#fff' },
  pvCat:     { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: 'rgba(255,255,255,0.78)' },
  pvTitle:   { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4, lineHeight: 27 },
  pvScripture:{ fontSize: 12.5, fontWeight: '800', color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  pvMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  pvMeta:    { fontSize: 11.5, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
  pvDot:     { fontSize: 11.5, fontWeight: '900', color: 'rgba(255,255,255,0.55)' },

  input:     {
    fontSize: 14, fontWeight: '600',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: RADII.md, marginTop: 6,
  },

  kindCard:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: RADII.md, borderWidth: 1.5,
  },
  kindTitle: { fontSize: 14.5, fontWeight: '900', letterSpacing: -0.2 },
  kindBlurb: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  kindRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  kindRadioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },

  helper:    { fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 4 },

  ambient:   {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADII.pill,
  },
  ambientTxt:{ fontSize: 12.5, fontWeight: '900' },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  swatch:    {
    width: 64, height: 64, borderRadius: 16, borderWidth: 3,
    overflow: 'hidden', position: 'relative',
  },
  swatchFill:{ flex: 1 },
  swatchTick:{
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  swatchTickTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },

  footer:    {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22,
  },
});
