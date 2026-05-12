// screen/victory/VictoryVigilList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Browse all group vigil guides — Family (×3), Youth, Women, Men, General.
//
// Filter chips by audience group. Each card uses the group-specific accent
// palette (groupAccent in victoryTheme.js) so families, youth and men feel
// visually distinct without abandoning the blue spine of the book.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }    from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry } from '../../hooks/useFluidAnim';
import { ICONS } from '../../components/AppTabBar';
import { useVictoryVigils } from '../../hooks/useVictoryContent';
import { BLUE, RADII, AMBIENT_SHADOW, victoryTones, groupAccent } from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';

const GROUPS = ['All', 'Family', 'Youth', 'Women', 'Men', 'General'];

export default function VictoryVigilList({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const [group, setGroup] = useState('All');
  const { vigils } = useVictoryVigils(navigation);

  const visible = useMemo(() => {
    if (group === 'All') return vigils;
    return vigils.filter((v) => v.group === group);
  }, [vigils, group]);

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
              {t('vmp_vigils_title', 'Group Vigils')}
            </Text>
          </View>
          <View style={[s.iconBtn, { opacity: 0 }]} />
        </View>

        {/* ── INTRO ──────────────────────────────────────────────────────── */}
        <View style={s.introWrap}>
          <View style={[s.introCard, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge, ...AMBIENT_SHADOW }]}>
            <Text style={[s.introEyebrow, { color: tones.chipFg }]}>
              SPECIAL GATHERINGS
            </Text>
            <Text style={[s.introTitle, { color: tk.textPrimary }]}>
              {t('vmp_vigils_intro_title', 'Pray together as a family of faith')}
            </Text>
            <Text style={[s.introBody, { color: tk.textSec }]}>
              {t(
                'vmp_vigils_intro_body',
                "Seven dedicated vigil guides equip every group — families, youth, women, men — to gather, reflect on scripture, discuss application, and intercede in unison through Victory Month.",
              )}
            </Text>
          </View>
        </View>

        {/* ── GROUP FILTER ───────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 18 }}
        >
          {GROUPS.map((g) => {
            const active = g === group;
            const accent = g === 'All' ? null : groupAccent(g);
            return (
              <TouchableOpacity
                key={g}
                onPress={() => setGroup(g)}
                activeOpacity={0.85}
                style={[s.chip, {
                  backgroundColor: active
                    ? (accent ? accent.fg : BLUE[600])
                    : tones.chipBg,
                }]}
              >
                <Text style={[s.chipTxt, {
                  color: active ? '#fff' : (accent ? accent.deep : tones.chipFg),
                }]}>
                  {g}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── VIGIL CARDS ────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {visible.map((v) => {
            const accent = groupAccent(v.group);
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => navigation.navigate('VictoryVigilScreen', { id: v.id })}
                activeOpacity={0.86}
                style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}
              >
                <View style={[s.bigBadge, { backgroundColor: accent.bg }]}>
                  <Text style={[s.bigBadgeTxt, { color: accent.deep }]} numberOfLines={1}>
                    {v.group}
                  </Text>
                </View>
                <Text style={[s.cardTitle, { color: tk.textPrimary }]} numberOfLines={2}>
                  {v.focus}
                </Text>
                {!!v.scripture && (
                  <View style={[s.scripturePill, { backgroundColor: tones.versePillBg }]}>
                    <Text style={[s.scripturePillTxt, { color: tones.versePillFg }]} numberOfLines={1}>
                      📖  {v.scripture}
                    </Text>
                  </View>
                )}
                <View style={s.metaRow}>
                  <ICONS.Calendar color={tk.textMuted} size={12} sw={2} />
                  <Text style={[s.metaTxt, { color: tk.textMuted }]}>{v.date}</Text>
                </View>
                <View style={s.statsRow}>
                  <Stat label="Discussion" value={String(v.discussion?.length || 0)} accent={accent.fg} tk={tk} />
                  <Stat label="Prayer points" value={String(v.prayer_points?.length || 0)} accent={accent.fg} tk={tk} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const Stat = ({ label, value, accent, tk }) => (
  <View style={{ flex: 1 }}>
    <Text style={[s.statVal, { color: accent }]}>{value}</Text>
    <Text style={[s.statLbl, { color: tk.textMuted }]}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  topbar:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  iconBtn:  { width: 42, height: 42, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  eyebrow:  { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  topTitle: { fontSize: 14, fontWeight: '900', marginTop: 2 },

  introWrap:   { paddingHorizontal: 20, marginBottom: 18 },
  introCard:   { padding: 18, borderRadius: RADII.lg },
  introEyebrow:{ fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  introTitle:  { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 8, lineHeight: 23 },
  introBody:   { fontSize: 13.5, lineHeight: 21, fontWeight: '500' },

  chip:    { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADII.pill },
  chipTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  card:       { padding: 18, borderRadius: RADII.lg, gap: 10 },
  bigBadge:   { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADII.pill },
  bigBadgeTxt:{ fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  cardTitle:  { fontSize: 16.5, fontWeight: '900', lineHeight: 22, letterSpacing: -0.3 },
  scripturePill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADII.pill },
  scripturePillTxt: { fontSize: 12, fontWeight: '800' },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt:    { fontSize: 12, fontWeight: '700' },
  statsRow:   { flexDirection: 'row', gap: 16, marginTop: 6 },
  statVal:    { fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  statLbl:    { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.1, marginTop: 1 },
});
