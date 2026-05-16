// screen/victory/VictoryVigilScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A vigil guide detail screen. Each vigil has:
//   • Focus + scripture + audience group
//   • Inspirational message
//   • Discussion / reflection questions (numbered)
//   • Prayer points (numbered)
//
// Uses the group's accent palette throughout so the user instantly knows
// whether they're in the family, youth, women, men or general guide.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Animated, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage    from '@react-native-async-storage/async-storage';
import { useTheme }    from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import { ICONS } from '../../components/AppTabBar';
import { useVictoryVigil, useVictoryVigils } from '../../hooks/useVictoryContent';
import { BLUE, EMERALD, RADII, AMBIENT_SHADOW, victoryTones, groupAccent } from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';

// Per-vigil prayer-point check-offs. Shape: { [vigilId]: { [idx]: true } }.
// Separate from the day-screen's vmp_prayed_points so a user marking points in
// the Women Vigil doesn't bleed into the daily prayer list.
const PRAYED_KEY = 'vmp_vigil_prayed_points';

export default function VictoryVigilScreen({ route, navigation }) {
  const id = route?.params?.id;
  const { isDark } = useTheme();
  const { t, lang } = useLanguage();
  // expo-speech only ships English voices on most devices, so Listen is hidden
  // when the user is on Yoruba / Igbo / Hausa. They'd otherwise hear English
  // TTS reading translated text — garbled at best, embarrassing at worst.
  const ttsAvailable = lang === 'en';
  const tk     = useMemo(() => getTokens(isDark), [isDark]);
  const tones  = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  // Backend-driven (cache-first). Fall back to the first vigil if a stale id
  // ever points at a deleted row so the screen still renders a coherent shape.
  const { vigil: vigilFromHook } = useVictoryVigil(id, navigation);
  const { vigils }               = useVictoryVigils(navigation);
  const vigil  = vigilFromHook || vigils[0] || { group: 'General', focus: '', scripture: '', message: '', discussion: [], prayer_points: [] };
  const accent = groupAccent(vigil.group);

  // ── Voice reading ─────────────────────────────────────────────────────────
  // Hand off to the shared audio player screen (same one used by the day
  // prayer page). It detects the `vigilId` param and switches to vigil mode
  // — group/title/message/discussion/prayer-points become its segments.
  const openAudioPlayer = () => {
    if (vigil?.id == null) return;
    navigation.navigate('VictoryAudioPlayer', { vigilId: vigil.id });
  };

  // ── Mark prayer points ───────────────────────────────────────────────────
  // Per-vigil persistence so each vigil has its own check-off state.
  const vigilKey = vigil?.id != null ? String(vigil.id) : (id != null ? String(id) : null);
  const [prayedPoints, setPrayedPoints] = useState({});

  useEffect(() => {
    if (!vigilKey) return;
    AsyncStorage.getItem(PRAYED_KEY)
      .then((raw) => {
        const all = raw ? JSON.parse(raw) : {};
        setPrayedPoints(all?.[vigilKey] || {});
      })
      .catch(() => setPrayedPoints({}));
  }, [vigilKey]);

  const togglePrayerPoint = async (idx) => {
    if (!vigilKey) return;
    let next;
    setPrayedPoints((cur) => {
      next = { ...cur };
      if (next[idx]) delete next[idx];
      else next[idx] = true;
      return next;
    });
    try {
      const raw = await AsyncStorage.getItem(PRAYED_KEY);
      const all = raw ? JSON.parse(raw) : {};
      if (Object.keys(next).length) all[vigilKey] = next;
      else                          delete all[vigilKey];
      await AsyncStorage.setItem(PRAYED_KEY, JSON.stringify(all));
    } catch { /* in-memory already updated */ }
  };

  const resetPrayerPoints = async () => {
    if (!vigilKey) return;
    setPrayedPoints({});
    try {
      const raw = await AsyncStorage.getItem(PRAYED_KEY);
      const all = raw ? JSON.parse(raw) : {};
      delete all[vigilKey];
      await AsyncStorage.setItem(PRAYED_KEY, JSON.stringify(all));
    } catch { /* state already cleared */ }
  };

  const prayedCount = Object.keys(prayedPoints).length;
  const totalPrayers = Array.isArray(vigil.prayer_points) ? vigil.prayer_points.length : 0;

  const shareVigil = async () => {
    try {
      await Share.share({
        message: `${vigil.title} — ${vigil.group}\n${vigil.focus}\n${vigil.scripture}\n\n${vigil.message}`,
      });
    } catch { /* user cancelled */ }
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
        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <View style={s.topbar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor: accent.bg }]}
          >
            <ICONS.ArrowLeft color={accent.deep} size={20} sw={2} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.eyebrow, { color: accent.fg }]}>
              {String(vigil.group).toUpperCase()} VIGIL
            </Text>
            <Text style={[s.topTitle, { color: tk.textPrimary }]} numberOfLines={1}>
              {vigil.title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={shareVigil}
            activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor: accent.bg }]}
          >
            <Text style={[s.shareIcon, { color: accent.deep }]}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <View style={[s.hero, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge, ...AMBIENT_SHADOW }]}>
            <View style={[s.groupBadge, { backgroundColor: accent.bg }]}>
              <Text style={[s.groupBadgeTxt, { color: accent.deep }]}>{vigil.group} Vigil</Text>
            </View>
            <Text style={[s.heroTitle, { color: tk.textPrimary }]}>{vigil.focus}</Text>
            <View style={s.heroMetaRow}>
              <ICONS.Calendar color={tk.textMuted} size={12} sw={2} />
              <Text style={[s.heroMeta, { color: tk.textMuted }]}>{vigil.date}</Text>
            </View>
            <View style={s.heroPillsRow}>
              {!!vigil.scripture && (
                <View style={[s.scripturePill, { backgroundColor: accent.bg }]}>
                  <ICONS.Book color={accent.deep} size={13} sw={2} />
                  <Text style={[s.scripturePillTxt, { color: accent.deep }]}>{vigil.scripture}</Text>
                </View>
              )}
              {ttsAvailable && (
                <TouchableOpacity
                  onPress={openAudioPlayer}
                  activeOpacity={0.82}
                  style={[s.listenPill, { backgroundColor: accent.bg }]}
                  accessibilityLabel={t('vmp_listen', 'Listen to this vigil')}
                >
                  <Text style={[s.listenPillTxt, { color: accent.deep }]}>
                    🔊  {t('vmp_listen_short', 'Listen')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── MESSAGE ────────────────────────────────────────────────────── */}
        {!!vigil.message && (
          <Section title="Inspirational Message" tk={tk} accentFg={accent.fg}>
            <View style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
              <Text style={[s.body, { color: tk.textSec }]}>{vigil.message}</Text>
            </View>
          </Section>
        )}

        {/* ── DISCUSSION ─────────────────────────────────────────────────── */}
        {Array.isArray(vigil.discussion) && vigil.discussion.length > 0 && (
          <Section title="Reflection & Discussion" tk={tk} accentFg={accent.fg}>
            <View style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
              {vigil.discussion.map((q, i) => (
                <NumberedRow
                  key={i}
                  index={i + 1}
                  text={q}
                  accent={accent.fg}
                  bg={accent.bg}
                  deep={accent.deep}
                  tk={tk}
                />
              ))}
            </View>
          </Section>
        )}

        {/* ── PRAYER POINTS ──────────────────────────────────────────────── */}
        {/* Tap a point to mark it prayed — the badge flips to a green check
            and the text gets a struck-through muted treatment so you can
            see what's left mid-vigil. State is per-vigil and persisted. */}
        {Array.isArray(vigil.prayer_points) && vigil.prayer_points.length > 0 && (
          <Section
            title="Prayer Points"
            tk={tk}
            accentFg={accent.fg}
            right={
              <View style={s.prayedCounterRow}>
                <View style={[s.prayedCounter, {
                  backgroundColor: prayedCount === totalPrayers && totalPrayers > 0
                    ? EMERALD[100]
                    : tones.chipBg,
                }]}>
                  <Text style={[s.prayedCounterTxt, {
                    color: prayedCount === totalPrayers && totalPrayers > 0
                      ? EMERALD[700]
                      : tones.chipFg,
                  }]}>
                    {prayedCount} / {totalPrayers} {t('vmp_prayed_label', 'prayed')}
                  </Text>
                </View>
                {prayedCount > 0 && (
                  <TouchableOpacity onPress={resetPrayerPoints} activeOpacity={0.7}>
                    <Text style={[s.prayedReset, { color: tk.textMuted }]}>
                      {t('vmp_reset', 'Reset')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          >
            <View style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
              {vigil.prayer_points.map((p, i) => (
                <NumberedRow
                  key={i}
                  index={i + 1}
                  text={p}
                  accent={BLUE[600]}
                  bg={tones.chipBg}
                  deep={tones.chipFg}
                  tk={tk}
                  prayed={!!prayedPoints[i]}
                  onToggle={() => togglePrayerPoint(i)}
                />
              ))}
            </View>
          </Section>
        )}

        {/* ── CTA — BACK TO LIST ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('VictoryVigilList')}
            activeOpacity={0.86}
            style={[s.cta, { backgroundColor: accent.fg, shadowColor: accent.fg }]}
          >
            <Text style={s.ctaTxt}>← Browse all vigils</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const Section = ({ title, children, tk, accentFg, right }) => {
  const { fade, translateY } = useStaggerEntry(0);
  return (
    <Animated.View style={{
      opacity: fade, transform: [{ translateY }],
      paddingHorizontal: 20, marginBottom: 22,
    }}>
      <View style={s.sectionHeadRow}>
        <Text style={[s.sectionLabel, { color: accentFg }]}>
          {title.toUpperCase()}
        </Text>
        {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
      </View>
      {children}
    </Animated.View>
  );
};

// When `onToggle` is provided, the row becomes a tappable checkbox: the
// badge flips to a green check and the text gets a strikethrough on press.
// Used for Prayer Points; Discussion rows pass no toggle and render plain.
const NumberedRow = ({ index, text, accent, bg, deep, tk, prayed, onToggle }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 8));
  const markable = typeof onToggle === 'function';

  const badge = markable ? (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!prayed }}
      accessibilityLabel={`Prayer point ${index}, ${prayed ? 'prayed' : 'not prayed'}`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[s.num, { backgroundColor: prayed ? EMERALD[500] : bg }]}
    >
      {prayed
        ? <ICONS.Check color="#fff" size={14} sw={2.6} />
        : <Text style={[s.numTxt, { color: deep }]}>{index}</Text>}
    </TouchableOpacity>
  ) : (
    <View style={[s.num, { backgroundColor: bg }]}>
      <Text style={[s.numTxt, { color: deep }]}>{index}</Text>
    </View>
  );

  const body = (
    <Text style={[s.rowTxt, {
      color: prayed ? tk.textMuted : tk.textSec,
      textDecorationLine: prayed ? 'line-through' : 'none',
    }]}>
      {text}
    </Text>
  );

  return (
    <Animated.View style={[s.row, { opacity: fade, transform: [{ translateY }] }]}>
      {badge}
      {markable
        ? <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={{ flex: 1 }}>{body}</TouchableOpacity>
        : body}
    </Animated.View>
  );
};

const s = StyleSheet.create({
  topbar:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  iconBtn:  { width: 42, height: 42, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  shareIcon:{ fontSize: 16, fontWeight: '900' },
  eyebrow:  { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  topTitle: { fontSize: 14, fontWeight: '900', marginTop: 2, maxWidth: 200, textAlign: 'center' },

  hero:        { padding: 20, borderRadius: RADII.xl, gap: 12 },
  groupBadge:  { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADII.pill },
  groupBadgeTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle:   { fontSize: 22, fontWeight: '900', lineHeight: 28, letterSpacing: -0.4 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMeta:    { fontSize: 12.5, fontWeight: '700' },
  heroPillsRow:{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  scripturePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADII.pill,
    flexShrink: 1,
  },
  scripturePillTxt: { fontSize: 12.5, fontWeight: '800' },
  listenPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADII.pill,
  },
  listenPillTxt: { fontSize: 12.5, fontWeight: '900', letterSpacing: 0.3 },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionLabel:   { fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  card:           { padding: 18, borderRadius: RADII.lg },
  body:           { fontSize: 14.5, lineHeight: 23, fontWeight: '500' },

  row:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  num:    { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  numTxt: { fontSize: 12.5, fontWeight: '900' },
  rowTxt: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '500' },

  // Per-vigil prayer-points progress chip
  prayedCounterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prayedCounter:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  prayedCounterTxt: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6 },
  prayedReset:      { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },

  cta:    {
    paddingVertical: 14, borderRadius: RADII.pill, alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 5,
  },
  ctaTxt: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
});
