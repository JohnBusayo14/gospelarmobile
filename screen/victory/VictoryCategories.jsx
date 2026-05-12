// screen/victory/VictoryCategories.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Grid of spiritual gathering / prayer-focus categories.
//
// Each tile uses a unique gradient + emoji, and the tile reveals the user's
// own added-prayer count on top of the curated starter count. Tapping routes
// to the dedicated category screen.
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
  GlassCard, BackBar, Eyebrow, SectionHead,
} from './VictoryUI';
import {
  BLUE, RADII, AMBIENT_SHADOW, victoryTones,
} from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import { CATEGORIES } from './victoryCategoriesData';
import { getCategoryPrayers, onStoreChange } from './victoryStore';

const { width: W } = Dimensions.get('window');
const TILE_W = (W - 20 * 2 - 12) / 2;

export default function VictoryCategories({ navigation }) {
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  // Per-category user prayer counts (reactive).
  const [userCounts, setUserCounts] = useState({});
  const reload = useCallback(async () => {
    const map = await getCategoryPrayers();
    const counts = {};
    for (const cat of CATEGORIES) {
      counts[cat.id] = Array.isArray(map[cat.id]) ? map[cat.id].length : 0;
    }
    setUserCounts(counts);
  }, []);
  useEffect(() => {
    reload();
    const sub = onStoreChange(() => reload());
    return () => sub?.remove?.();
  }, [reload]);

  const totalUser = Object.values(userCounts).reduce((a, b) => a + b, 0);

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
          eyebrow="VICTORY MONTH"
          title="Prayer Categories"
          tones={tones}
          tk={tk}
        />

        {/* Intro */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <GlassCard tones={tones} padding={18}>
            <Eyebrow color={tones.chipFg}>SPIRITUAL GATHERINGS</Eyebrow>
            <Text style={[s.heroTitle, { color: tk.textPrimary }]}>
              Pray with focus — choose your battle line
            </Text>
            <Text style={[s.heroBody, { color: tk.textSec }]}>
              Each category opens a curated set of prayers you can pray immediately,
              plus space for your own intercessions on the same theme.
            </Text>
            <View style={s.heroStats}>
              <Stat label="Categories" value={CATEGORIES.length}  bg={tones.chipBg} fg={tones.chipFg} />
              <Stat label="Starter prayers"
                    value={CATEGORIES.reduce((sum, c) => sum + c.starters.length, 0)}
                    bg={tones.versePillBg} fg={tones.versePillFg} />
              <Stat label="Your prayers" value={totalUser} bg="#FEF3C7" fg="#92400E" />
            </View>
          </GlassCard>
        </View>

        {/* Grid */}
        <View style={s.grid}>
          {CATEGORIES.map((cat, i) => (
            <Tile
              key={cat.id}
              cat={cat}
              index={i}
              userCount={userCounts[cat.id] || 0}
              onPress={() => navigation.navigate('VictoryCategoryScreen', { id: cat.id })}
            />
          ))}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
const Stat = ({ label, value, bg, fg }) => (
  <View style={[s.statPill, { backgroundColor: bg }]}>
    <Text style={[s.statVal, { color: fg }]}>{value}</Text>
    <Text style={[s.statLbl, { color: fg }]}>{label}</Text>
  </View>
);

const Tile = ({ cat, index, userCount, onPress }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 9));
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.86}>
        <LinearGradient
          colors={cat.gradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.tile, AMBIENT_SHADOW, { width: TILE_W }]}
        >
          <View style={[s.tileOrb, { top: -22, right: -16 }]} />
          <View style={[s.tileOrb, { bottom: -28, left: -20, opacity: 0.35 }]} />
          <Text style={s.tileEmoji}>{cat.emoji}</Text>
          <Text style={s.tileName}>{cat.name}</Text>
          <Text style={s.tileBlurb}>{cat.blurb}</Text>
          <View style={s.tileFoot}>
            <Text style={s.tileCount}>
              {cat.starters.length}
              {userCount > 0 && <Text style={s.tileExtra}>  +{userCount}</Text>}
            </Text>
            <Text style={s.tileArrow}>→</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  heroTitle: { fontSize: 19, fontWeight: '900', lineHeight: 25, letterSpacing: -0.3, marginTop: 6 },
  heroBody:  { fontSize: 13.5, lineHeight: 20, fontWeight: '500', marginTop: 8, marginBottom: 10 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  statPill:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADII.pill, alignItems: 'center' },
  statVal:   { fontSize: 14, fontWeight: '900', letterSpacing: -0.3 },
  statLbl:   { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, marginTop: 1 },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  tile:      {
    height: 178, padding: 16, borderRadius: RADII.lg,
    justifyContent: 'space-between', overflow: 'hidden',
  },
  tileOrb:   { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.18)' },
  tileEmoji: { fontSize: 32 },
  tileName:  { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: -0.3, marginTop: 6 },
  tileBlurb: { fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.86)', marginTop: 3, minHeight: 28 },
  tileFoot:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  tileCount: { fontSize: 13, fontWeight: '900', color: '#fff' },
  tileExtra: { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.78)' },
  tileArrow: { fontSize: 18, fontWeight: '900', color: '#fff' },
});
