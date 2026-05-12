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

import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Animated, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }    from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import { ICONS } from '../../components/AppTabBar';
import { useVictoryVigil, useVictoryVigils } from '../../hooks/useVictoryContent';
import { BLUE, RADII, AMBIENT_SHADOW, victoryTones, groupAccent } from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';

export default function VictoryVigilScreen({ route, navigation }) {
  const id = route?.params?.id;
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk     = useMemo(() => getTokens(isDark), [isDark]);
  const tones  = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  // Backend-driven (cache-first). Fall back to the first vigil if a stale id
  // ever points at a deleted row so the screen still renders a coherent shape.
  const { vigil: vigilFromHook } = useVictoryVigil(id, navigation);
  const { vigils }               = useVictoryVigils(navigation);
  const vigil  = vigilFromHook || vigils[0] || { group: 'General', focus: '', scripture: '', message: '', discussion: [], prayer_points: [] };
  const accent = groupAccent(vigil.group);

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
            {!!vigil.scripture && (
              <View style={[s.scripturePill, { backgroundColor: accent.bg }]}>
                <ICONS.Book color={accent.deep} size={13} sw={2} />
                <Text style={[s.scripturePillTxt, { color: accent.deep }]}>{vigil.scripture}</Text>
              </View>
            )}
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
        {Array.isArray(vigil.prayer_points) && vigil.prayer_points.length > 0 && (
          <Section title="Prayer Points" tk={tk} accentFg={accent.fg}>
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

const Section = ({ title, children, tk, accentFg }) => {
  const { fade, translateY } = useStaggerEntry(0);
  return (
    <Animated.View style={{
      opacity: fade, transform: [{ translateY }],
      paddingHorizontal: 20, marginBottom: 22,
    }}>
      <Text style={[s.sectionLabel, { color: accentFg }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </Animated.View>
  );
};

const NumberedRow = ({ index, text, accent, bg, deep, tk }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 8));
  return (
    <Animated.View style={[s.row, { opacity: fade, transform: [{ translateY }] }]}>
      <View style={[s.num, { backgroundColor: bg }]}>
        <Text style={[s.numTxt, { color: deep }]}>{index}</Text>
      </View>
      <Text style={[s.rowTxt, { color: tk.textSec }]}>{text}</Text>
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
  scripturePill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADII.pill,
  },
  scripturePillTxt: { fontSize: 12.5, fontWeight: '800' },

  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2.2, marginBottom: 10 },
  card:         { padding: 18, borderRadius: RADII.lg },
  body:         { fontSize: 14.5, lineHeight: 23, fontWeight: '500' },

  row:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  num:    { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  numTxt: { fontSize: 12.5, fontWeight: '900' },
  rowTxt: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '500' },

  cta:    {
    paddingVertical: 14, borderRadius: RADII.pill, alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 5,
  },
  ctaTxt: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
});
