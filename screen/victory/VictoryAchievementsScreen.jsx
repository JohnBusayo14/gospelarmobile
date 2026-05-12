// screen/victory/VictoryAchievementsScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Achievement wall — every badge in the catalogue, grouped by category, with
// unlocked badges glowing in their tier colour and locked badges faded out.
//
// The page also surfaces:
//   • A hero with total unlock count + tier breakdown
//   • Streak / fasting / hours-prayed live counters
//   • Re-check button that triggers recomputeAchievements (in case the user
//     wants to see if anything has just qualified)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }    from '../../context/ThemeContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import {
  GlassCard, BackBar, Eyebrow, SectionHead, ProgressRing, CelebrateOverlay,
} from './VictoryUI';
import {
  BLUE, INDIGO, EMERALD, AMBER, RADII, AMBIENT_SHADOW, victoryTones,
} from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import {
  BADGES, BADGE_BY_ID, TIER_COLOURS, recomputeAchievements,
} from './victoryAchievements';
import {
  getAchievements, getCompleted, getFasts, getTotalSeconds, onStoreChange,
} from './victoryStore';
import { TOTAL_DAYS, todayDayIndex } from '../../data/victoryMonth';

const { width: W } = Dimensions.get('window');
const TILE = (W - 20 * 2 - 12 * 2) / 3;

export default function VictoryAchievementsScreen({ navigation }) {
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [unlocked, setUnlocked]   = useState({});
  const [completed, setCompleted] = useState({});
  const [fasts, setFasts]         = useState([]);
  const [totalSec, setTotalSec]   = useState(0);
  const [celebrate, setCelebrate] = useState(null);

  const reload = useCallback(async () => {
    const [u, c, f, t] = await Promise.all([
      getAchievements(), getCompleted(), getFasts(), getTotalSeconds(),
    ]);
    setUnlocked(u); setCompleted(c); setFasts(f); setTotalSec(t);
  }, []);

  useEffect(() => {
    reload();
    const sub = onStoreChange(() => reload());
    return () => sub?.remove?.();
  }, [reload]);

  const unlockedCount = Object.keys(unlocked).length;
  const totalCount    = BADGES.length;
  const pct           = Math.round((unlockedCount / totalCount) * 100);

  // Streak + fast counts for the live stat row.
  const currentStreak = useMemo(() => {
    let n = 0;
    for (let d = todayDayIndex(); d >= 1; d--) {
      if (completed[d]) n += 1; else break;
    }
    return n;
  }, [completed]);
  const doneCount    = useMemo(() => Object.values(completed).filter(Boolean).length, [completed]);
  const fastsDone    = useMemo(() => fasts.filter((f) => f.completed).length, [fasts]);
  const hoursPrayed  = (totalSec / 3600).toFixed(1);

  // Group badges by category for display.
  const groups = useMemo(() => {
    const map = {};
    BADGES.forEach((b) => {
      (map[b.category] ||= []).push(b);
    });
    return Object.entries(map);
  }, []);

  const recheck = async () => {
    const newly = await recomputeAchievements();
    if (newly.length) setCelebrate(BADGE_BY_ID[newly[0]]);
    await reload();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.7} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: fade, transform: [{ translateY }] }}
      >
        <BackBar
          onBack={() => navigation.goBack()}
          eyebrow="VICTORY MONTH"
          title="Achievements"
          tones={tones}
          tk={tk}
          right={
            <TouchableOpacity onPress={recheck} activeOpacity={0.8}>
              <Text style={{ fontSize: 18, color: tones.chipFg, fontWeight: '900' }}>↺</Text>
            </TouchableOpacity>
          }
        />

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
          <LinearGradient
            colors={[BLUE[800], INDIGO[600]]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.hero, AMBIENT_SHADOW]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <ProgressRing
                size={120}
                stroke={10}
                pct={pct}
                colours={['#fff', '#A5B4FC']}
                trackColour="rgba(255,255,255,0.18)"
              >
                <Text style={s.heroPct}>{pct}%</Text>
                <Text style={s.heroPctSub}>unlocked</Text>
              </ProgressRing>
              <View style={{ flex: 1 }}>
                <Eyebrow color="rgba(255,255,255,0.78)">YOUR LEGACY</Eyebrow>
                <Text style={s.heroTitle}>
                  {unlockedCount} <Text style={s.heroOf}>/ {totalCount}</Text>
                </Text>
                <Text style={s.heroSub}>
                  badges earned in your Victory Month journey.
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ── LIVE STATS ────────────────────────────────────────────────── */}
        <View style={s.statRow}>
          <LiveStat label="Days prayed"   value={`${doneCount}/${TOTAL_DAYS}`} accent={BLUE[600]} tones={tones} />
          <LiveStat label="Current streak" value={`${currentStreak}d`}        accent={AMBER[500]} tones={tones} />
          <LiveStat label="Fasts done"     value={fastsDone}                  accent={INDIGO[600]} tones={tones} />
          <LiveStat label="Hours prayed"   value={hoursPrayed}                accent={EMERALD[500]} tones={tones} />
        </View>

        {/* ── BADGE WALL ────────────────────────────────────────────────── */}
        {groups.map(([catName, badges]) => (
          <View key={catName} style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <SectionHead
              tk={tk} tones={tones}
              eyebrow={`${badges.filter((b) => unlocked[b.id]).length} OF ${badges.length}`}
              title={catName}
            />
            <View style={s.grid}>
              {badges.map((b, i) => (
                <Badge
                  key={b.id}
                  badge={b}
                  unlockedAt={unlocked[b.id]?.unlocked_at}
                  index={i}
                  tones={tones}
                  tk={tk}
                />
              ))}
            </View>
          </View>
        ))}
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
const LiveStat = ({ label, value, accent, tones }) => (
  <View style={[s.liveStat, { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge }]}>
    <Text style={[s.liveStatVal, { color: accent }]}>{value}</Text>
    <Text style={[s.liveStatLbl, { color: tones.chipFg }]}>{label}</Text>
  </View>
);

const Badge = ({ badge, unlockedAt, index, tones, tk }) => {
  const colours = TIER_COLOURS[badge.tier] || TIER_COLOURS.silver;
  const isLocked = !unlockedAt;
  const { fade, translateY } = useStaggerEntry(Math.min(index, 9));
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }], width: TILE }}>
      <View style={[s.badge, isLocked && { opacity: 0.42 }]}>
        <View
          style={[
            s.badgeRing,
            {
              backgroundColor: colours.glow,
              borderColor: colours.ring,
            },
          ]}
        >
          <Text style={s.badgeEmoji}>{badge.icon}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={[s.badgeName, { color: tk.textPrimary }]}
        >
          {badge.name}
        </Text>
        <Text
          numberOfLines={2}
          style={[s.badgeDesc, { color: tk.textMuted }]}
        >
          {badge.desc}
        </Text>
        {isLocked && (
          <View style={[s.lockedTag, { backgroundColor: tones.chipBg }]}>
            <Text style={[s.lockedTagTxt, { color: tones.chipFg }]}>LOCKED</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  hero:    { padding: 22, borderRadius: RADII.xl },
  heroPct: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -1.2 },
  heroPctSub: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.78)', letterSpacing: 1.2, marginTop: 2 },
  heroTitle: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 4 },
  heroOf:    { fontSize: 18, color: 'rgba(255,255,255,0.6)' },
  heroSub:   { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.78)', lineHeight: 18, marginTop: 4 },

  statRow:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8, marginBottom: 22 },
  liveStat:  { width: '47%', flexGrow: 1, padding: 14, borderRadius: RADII.md },
  liveStatVal:{ fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  liveStatLbl:{ fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginTop: 4 },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badge:       { alignItems: 'center', position: 'relative' },
  badgeRing:   {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
  },
  badgeEmoji:  { fontSize: 32 },
  badgeName:   { fontSize: 12, fontWeight: '900', marginTop: 10, textAlign: 'center', letterSpacing: -0.2 },
  badgeDesc:   { fontSize: 10.5, fontWeight: '600', textAlign: 'center', marginTop: 4, lineHeight: 14, paddingHorizontal: 2 },
  lockedTag:   { position: 'absolute', top: 0, right: 0, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  lockedTagTxt:{ fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
});
