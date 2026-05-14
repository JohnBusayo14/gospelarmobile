// screen/victory/VictoryAbout.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Introduction / theme briefing for the Victory Month book.
//
// Lifts the "Introduction" + "Foreword" sections from the source PDF into
// a calm, devotional reading layout. Includes the GOFAMINT NA committee credits,
// the 7 "dos and don'ts" of Victory Month prayer, and the General Overseer's
// pastoral note. Designed to be read once at the start of the fast and
// referenced as needed throughout.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }    from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import { ICONS } from '../../components/AppTabBar';
import { useVictoryMeta, useVictoryDays, useVictoryVigils } from '../../hooks/useVictoryContent';
import { BLUE, INDIGO, EMERALD, AMBER, RADII, AMBIENT_SHADOW, victoryTones } from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';

const DOS = [
  'Join other brethren in the church daily for the corporate prayers (Heb 10:25).',
  'Do justice to the prayer points by praying them exhaustively.',
  'Take enough time to pray on your own at a seclusive time and place (Matt 6:6).',
  'Do the fast to the best of your ability — not below or beyond your ability. The blessings of fasting are far more than the pains (Matt 17:20).',
  'Be sensitive when praying. Allow God to speak to you while you are speaking to Him (Hab 2:1).',
  'Do whatever you can do to bless less-privileged and elderly people with what you reserve while fasting.',
  '"Much prayer brings much power; little prayer brings little power; no prayer brings no power."',
];

const COMMITTEE = [
  'Pastor Richard Usenu',
  'Pastor Bola Taiwo',
  'Pastor J. K. Akinola',
  'Pastor S. O. Shoretire',
];

export default function VictoryAbout({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  // Pull live values from the backend (admin-editable). Hooks return the
  // bundled fallback on first render so the screen never flashes empty.
  const { meta }   = useVictoryMeta(navigation);
  const { days }   = useVictoryDays(navigation);
  const { vigils } = useVictoryVigils(navigation);
  const totalDays   = days?.length   || 30;
  const totalVigils = vigils?.length || 6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.7} />

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
              {t('vmp_about_eyebrow', 'ABOUT THIS GUIDE')}
            </Text>
            <Text style={[s.topTitle, { color: tk.textPrimary }]}>
              {t('vmp_about_title', 'Introduction')}
            </Text>
          </View>
          <View style={[s.iconBtn, { opacity: 0 }]} />
        </View>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <View style={[s.hero, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge, ...AMBIENT_SHADOW }]}>
            <Text style={[s.heroYear, { color: tones.chipFg }]}>
              {meta.year} {t('vmp_caps', 'VICTORY MONTH')}
            </Text>
            <Text style={[s.heroTitle, { color: tk.textPrimary }]}>{meta.theme}</Text>
            <View style={[s.heroPill, { backgroundColor: tones.versePillBg }]}>
              <Text style={[s.heroPillTxt, { color: tones.versePillFg }]}>
                📅  {meta.window}
              </Text>
            </View>
            <Text style={[s.heroBody, { color: tk.textSec }]}>
              {meta.organisation}
            </Text>
          </View>
        </View>

        {/* ── STATS ──────────────────────────────────────────────────────── */}
        <View style={s.statsWrap}>
          <Stat label={t('vmp_about_stat_days', 'Days of prayer')}   value={totalDays}    accent={BLUE[600]}    bg={tones.glassFill} tk={tk} />
          <Stat label={t('vmp_about_stat_vigils', 'Group vigils')}   value={totalVigils}  accent={INDIGO[600]}  bg={tones.glassFill} tk={tk} />
          <Stat label={t('vmp_about_stat_pages', 'Pages')}           value={meta.pages}   accent={EMERALD[500]} bg={tones.glassFill} tk={tk} />
        </View>

        {/* ── INTRO MESSAGE ──────────────────────────────────────────────── */}
        <Section title={t('vmp_about_foreword', 'Foreword')} tk={tk} tones={tones}>
          <View style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
            <Text style={[s.body, { color: tk.textSec }]}>
              {t('vmp_about_foreword_p1', 'Revival is the best and greatest thing that can happen to the world — especially the Church. It is a divine manifestation with commensurate reception by humans. Under a true revival atmosphere, God\'s needs are met by human beings and human needs are also met by God.')}
            </Text>
            <Text style={[s.body, { color: tk.textSec, marginTop: 12 }]}>
              {t('vmp_about_foreword_p2', 'We expect that as our hearts unite in prayer, expectation and consecration, God will position us for deeper encounters with His power and greater demonstrations of His glory. True revival is not merely an event — it is a heart awakened, a faith strengthened, and a church stirred to action.')}
            </Text>
            <Text style={[s.attribution, { color: tones.chipFg }]}>
              {t('vmp_about_attribution', '— Pastor (Dr.) Elijah Oludele Abina, General Overseer, GOFAMINT')}
            </Text>
          </View>
        </Section>

        {/* ── DOS ────────────────────────────────────────────────────────── */}
        <Section title={t('vmp_about_guidelines', 'Guidelines for Prayer & Fasting')} tk={tk} tones={tones}>
          <View style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
            {DOS.map((d, i) => (
              <ListRow key={i} index={i + 1} text={d} accentBg={tones.chipBg} accentFg={tones.chipFg} tk={tk} />
            ))}
          </View>
        </Section>

        {/* ── COMMITTEE ──────────────────────────────────────────────────── */}
        <Section title={t('vmp_about_committee', 'Victory Month Committee')} tk={tk} tones={tones}>
          <View style={[s.card, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
            {COMMITTEE.map((p, i) => (
              <View key={i} style={s.committeeRow}>
                <View style={[s.committeeBadge, { backgroundColor: tones.chipBg }]}>
                  <Text style={[s.committeeBadgeTxt, { color: tones.chipFg }]}>{i + 1}</Text>
                </View>
                <Text style={[s.committeeName, { color: tk.textPrimary }]}>{p}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* ── CTAS ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 4, gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('VictoryDayList')}
            activeOpacity={0.86}
            style={[s.cta, { backgroundColor: BLUE[600], shadowColor: tones.ctaShadow }]}
          >
            <Text style={s.ctaTxt}>{t('vmp_about_cta_start', 'Start with Day 1  →')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('VictoryVigilList')}
            activeOpacity={0.86}
            style={[s.ctaSoft, { backgroundColor: tones.chipBg }]}
          >
            <Text style={[s.ctaSoftTxt, { color: tones.chipFg }]}>{t('vmp_about_cta_vigils', 'Browse group vigils')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const Section = ({ title, children, tk, tones }) => (
  <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
    <Text style={[s.sectionLabel, { color: tones.chipFg }]}>
      {title.toUpperCase()}
    </Text>
    {children}
  </View>
);

const Stat = ({ label, value, accent, bg, tk }) => (
  <View style={[s.statBox, { backgroundColor: bg }]}>
    <Text style={[s.statVal, { color: accent }]}>{value}</Text>
    <Text style={[s.statLbl, { color: tk.textMuted }]}>{label}</Text>
  </View>
);

const ListRow = ({ index, text, accentBg, accentFg, tk }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 8));
  return (
    <Animated.View style={[s.listRow, { opacity: fade, transform: [{ translateY }] }]}>
      <View style={[s.listNum, { backgroundColor: accentBg }]}>
        <Text style={[s.listNumTxt, { color: accentFg }]}>{index}</Text>
      </View>
      <Text style={[s.listTxt, { color: tk.textSec }]}>{text}</Text>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  topbar:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  iconBtn:  { width: 42, height: 42, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  eyebrow:  { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  topTitle: { fontSize: 14, fontWeight: '900', marginTop: 2 },

  hero:        { padding: 22, borderRadius: RADII.xl, gap: 10 },
  heroYear:    { fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  heroTitle:   { fontSize: 24, fontWeight: '900', lineHeight: 30, letterSpacing: -0.5 },
  heroPill:    { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADII.pill },
  heroPillTxt: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
  heroBody:    { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 4 },

  // Stats row
  statsWrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 22 },
  statBox:   { flex: 1, padding: 16, borderRadius: RADII.md, alignItems: 'center' },
  statVal:   { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  statLbl:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 4, textAlign: 'center' },

  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2.2, marginBottom: 10 },
  card:         { padding: 18, borderRadius: RADII.lg },
  body:         { fontSize: 14.5, lineHeight: 23, fontWeight: '500' },
  attribution:  { fontSize: 12.5, fontWeight: '800', fontStyle: 'italic', marginTop: 14, letterSpacing: 0.1 },

  // List rows
  listRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  listNum:    { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  listNumTxt: { fontSize: 12.5, fontWeight: '900' },
  listTxt:    { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '500' },

  // Committee
  committeeRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  committeeBadge:  { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  committeeBadgeTxt: { fontSize: 12, fontWeight: '900' },
  committeeName:   { fontSize: 14.5, fontWeight: '800' },

  // CTAs
  cta:        {
    paddingVertical: 15, borderRadius: RADII.pill, alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5,
  },
  ctaTxt:     { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  ctaSoft:    { paddingVertical: 14, borderRadius: RADII.pill, alignItems: 'center' },
  ctaSoftTxt: { fontSize: 13.5, fontWeight: '800', letterSpacing: 0.2 },
});
