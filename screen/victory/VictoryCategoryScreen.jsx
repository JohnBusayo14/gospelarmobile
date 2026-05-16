// screen/victory/VictoryCategoryScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A single prayer-category screen. Shows the curated starter prayers + the
// user's own prayers for the same focus area. Each prayer card has:
//   • Title + scripture pill + body
//   • Mark-as-prayed (increments prayed_count for user prayers)
//   • Favourite / unfavourite
//   • Delete (own prayers only)
//
// Composer at the top lets the user add a new prayer in <10s. After saving,
// the new prayer slides in at the top of the list.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  StatusBar, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }    from '../../context/ThemeContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import {
  GlassCard, BackBar, Eyebrow, SectionHead, GradientCTA, EmptyState,
} from './VictoryUI';
import {
  BLUE, INDIGO, EMERALD, AMBER, ROSE, RADII, AMBIENT_SHADOW, victoryTones,
} from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import { getCategory } from './victoryCategoriesData';
import { useCategoryPrayers } from './victoryHooks';
import { RichVerseText } from '../../components/BibleVerseLink';

export default function VictoryCategoryScreen({ route, navigation }) {
  const id = route?.params?.id;
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const cat = useMemo(() => getCategory(id), [id]);

  const { list: userPrayers, add, update, remove } = useCategoryPrayers(cat.id);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title,        setTitle]    = useState('');
  const [scripture,    setScripture]= useState('');
  const [body,         setBody]     = useState('');

  const submit = async () => {
    if (!body.trim()) {
      Alert.alert('Add a prayer', 'Please write at least the prayer body.');
      return;
    }
    await add({ title: title.trim() || 'My prayer', scripture: scripture.trim(), body: body.trim() });
    setTitle(''); setScripture(''); setBody('');
    setComposerOpen(false);
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
          eyebrow="CATEGORY"
          title={cat.name}
          tones={tones}
          tk={tk}
        />

        {/* ── HEADER GRADIENT ──────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <LinearGradient
            colors={cat.gradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.hero, AMBIENT_SHADOW]}
          >
            <View style={[s.orb, { top: -22, right: -16 }]} />
            <View style={[s.orb, { bottom: -28, left: -20, opacity: 0.4 }]} />
            <Text style={s.heroEmoji}>{cat.emoji}</Text>
            <Text style={s.heroEyebrow}>{cat.name.toUpperCase()}</Text>
            <Text style={s.heroTitle}>{cat.blurb}</Text>
            <View style={s.heroStats}>
              <HeroStat label="Starter prayers" value={cat.starters.length} />
              <HeroStat label="My prayers"      value={userPrayers.length} />
              <HeroStat label="Favourites"      value={userPrayers.filter((p) => p.favourite).length} />
            </View>
          </LinearGradient>
        </View>

        {/* ── ADD CTA ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          {!composerOpen ? (
            <GradientCTA
              label="＋  Add your own prayer"
              onPress={() => setComposerOpen(true)}
              colors={[BLUE[700], BLUE[500]]}
            />
          ) : (
            <GlassCard tones={tones} padding={16}>
              <Eyebrow color={tones.chipFg}>NEW PRAYER</Eyebrow>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title (optional)"
                placeholderTextColor={tk.textMuted}
                style={[s.composerTitle, { color: tk.textPrimary }]}
              />
              <TextInput
                value={scripture}
                onChangeText={setScripture}
                placeholder="Scripture reference (optional, e.g. Isaiah 40:31)"
                placeholderTextColor={tk.textMuted}
                style={[s.composerScripture, { color: tk.textSec, backgroundColor: tones.chipBg }]}
              />
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Write your prayer here…"
                placeholderTextColor={tk.textMuted}
                multiline
                style={[s.composerBody, { color: tk.textPrimary, backgroundColor: tones.chipBg }]}
              />
              <View style={s.composerCtas}>
                <TouchableOpacity
                  onPress={() => { setComposerOpen(false); setTitle(''); setScripture(''); setBody(''); }}
                  activeOpacity={0.85}
                  style={[s.composerCancel, { backgroundColor: tones.chipBg }]}
                >
                  <Text style={[s.composerCancelTxt, { color: tk.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <GradientCTA
                  label="Save prayer"
                  onPress={submit}
                  size="md"
                  colors={[cat.gradient[0], cat.gradient[1]]}
                  style={{ flex: 1 }}
                />
              </View>
            </GlassCard>
          )}
        </View>

        {/* ── USER PRAYERS ────────────────────────────────────────────── */}
        {userPrayers.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <SectionHead tk={tk} tones={tones} eyebrow="MINE" title="My prayers" />
            <View style={{ gap: 10 }}>
              {userPrayers.map((p, i) => (
                <PrayerCard
                  key={p.id}
                  p={p}
                  index={i}
                  cat={cat}
                  tk={tk}
                  tones={tones}
                  isDark={isDark}
                  ownable
                  onPrayed={() => update(p.id, { prayed_count: (p.prayed_count || 0) + 1 })}
                  onFavourite={() => update(p.id, { favourite: !p.favourite })}
                  onDelete={() => remove(p.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── STARTERS ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20 }}>
          <SectionHead tk={tk} tones={tones} eyebrow="STARTER" title="Curated prayers" />
          <View style={{ gap: 10 }}>
            {cat.starters.map((p, i) => (
              <PrayerCard
                key={p.id}
                p={p}
                index={i + userPrayers.length}
                cat={cat}
                tk={tk}
                tones={tones}
                isDark={isDark}
              />
            ))}
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
const HeroStat = ({ label, value }) => (
  <View style={s.heroStat}>
    <Text style={s.heroStatVal}>{value}</Text>
    <Text style={s.heroStatLbl}>{label}</Text>
  </View>
);

const PrayerCard = ({ p, index, cat, tk, tones, ownable, onPrayed, onFavourite, onDelete, isDark }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 8));
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <GlassCard tones={tones} padding={16}>
        <View style={s.cardHead}>
          <Text style={[s.cardTitle, { color: tk.textPrimary }]} numberOfLines={2}>
            {p.title}
          </Text>
          {ownable && (
            <TouchableOpacity onPress={onFavourite} activeOpacity={0.78} style={s.favBtn}>
              <Text style={{ fontSize: 18 }}>{p.favourite ? '⭐' : '☆'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {!!p.scripture && (
          <View style={[s.versePill, { backgroundColor: cat.accentBg, flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={[s.versePillTxt, { color: cat.gradient[0] }]}>📖  </Text>
            <View style={{ flex: 1 }}>
              <RichVerseText text={p.scripture} isDark={isDark} lineHeight={18}
                style={[s.versePillTxt, { color: cat.gradient[0] }]} />
            </View>
          </View>
        )}
        <RichVerseText text={p.body} isDark={isDark} lineHeight={s.cardBody?.lineHeight || 22}
          style={[s.cardBody, { color: tk.textSec }]} />

        <View style={s.cardFootRow}>
          {ownable ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={[s.prayedCount, { color: tones.chipFg }]}>
                Prayed {p.prayed_count || 0}×
              </Text>
              <TouchableOpacity onPress={onDelete} activeOpacity={0.78}>
                <Text style={[s.delTxt, { color: ROSE[500] }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : <View />}
          <TouchableOpacity
            onPress={onPrayed || (() => {})}
            activeOpacity={0.86}
            style={[s.prayBtn, { backgroundColor: cat.gradient[0] }]}
          >
            <Text style={s.prayBtnTxt}>✓ Mark prayed</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  hero:        { padding: 22, borderRadius: RADII.xl, overflow: 'hidden' },
  orb:         { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroEmoji:   { fontSize: 36 },
  heroEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 2.4, color: 'rgba(255,255,255,0.85)', marginTop: 10 },
  heroTitle:   { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4, lineHeight: 28, marginTop: 6 },
  heroStats:   { flexDirection: 'row', gap: 10, marginTop: 16 },
  heroStat:    { flex: 1, padding: 10, borderRadius: RADII.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroStatVal: { fontSize: 19, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  heroStatLbl: { fontSize: 9.5, fontWeight: '900', color: 'rgba(255,255,255,0.78)', letterSpacing: 1.1, marginTop: 2 },

  composerTitle:     { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginTop: 8, paddingVertical: 6 },
  composerScripture: { fontSize: 13, fontWeight: '700', padding: 10, borderRadius: 10, marginTop: 4 },
  composerBody:      { fontSize: 14.5, lineHeight: 22, padding: 12, borderRadius: 12, marginTop: 10, minHeight: 100, textAlignVertical: 'top' },
  composerCtas:      { flexDirection: 'row', gap: 10, marginTop: 14 },
  composerCancel:    { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999, justifyContent: 'center' },
  composerCancelTxt: { fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },

  cardHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:   { fontSize: 16, fontWeight: '900', letterSpacing: -0.3, flex: 1, lineHeight: 22 },
  favBtn:      { padding: 4 },
  versePill:   { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 8, marginBottom: 4 },
  versePillTxt:{ fontSize: 11.5, fontWeight: '800' },
  cardBody:    { fontSize: 14, lineHeight: 21, fontWeight: '500', marginTop: 8 },
  cardFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  prayBtn:     { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  prayBtnTxt:  { color: '#fff', fontSize: 12.5, fontWeight: '900' },
  prayedCount: { fontSize: 11.5, fontWeight: '800' },
  delTxt:      { fontSize: 12, fontWeight: '900' },
});
