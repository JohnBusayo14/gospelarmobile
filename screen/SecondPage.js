// screens/SecondPage.jsx  — PREMIUM REDESIGN
import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Dimensions, StatusBar, RefreshControl, Animated, Pressable,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { buildTheme, BRAND } from '../theme/colors';
import { useTheme }    from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchUnits }  from '../services/api';
import useApi from '../hooks/useApi';
import { SkeletonList, ErrorState } from '../components/FetchStates';

const { width } = Dimensions.get('window');

const P = {
  ink:   '#050D1F',
  navy:  '#0A1628',
  sky:   '#2563EB',
  gold:  '#F59E0B',
  glass: 'rgba(255,255,255,0.06)',
};

// ── Animated unit card ────────────────────────────────────────────────────────
const UnitCard = ({ unit, index, onPress, T, t, isDark }) => {
  const scale    = useRef(new Animated.Value(0.96)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(30)).current;
  const isOdd    = index % 2 !== 0;
  const accent   = isOdd ? '#7C3AED' : P.sky;
  const accentAlt= isOdd ? '#5B21B6' : '#1D4ED8';

  useEffect(() => {
    const delay = index * 90;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, delay, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, delay, tension: 80, friction: 8,  useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: slideY }, { scale }] }}>
      <Pressable
        onPress={() => onPress(unit)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[s.card, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
          borderColor: isDark ? `${accent}30` : `${accent}20`,
        }]}
      >
        {/* Top stripe */}
        <LinearGradient colors={[accent, accentAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cardStripe} />

        <View style={s.cardBody}>
          {/* Number badge */}
          <View style={[s.numBadge, { backgroundColor: `${accent}15`, borderColor: `${accent}35` }]}>
            <Text style={[s.numText, { color: accent }]}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={[s.numLabel, { color: `${accent}99` }]}>UNIT</Text>
          </View>

          {/* Content */}
          <View style={s.cardContent}>
            <Text style={[s.cardTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={2}>
              {unit.title}
            </Text>
            {!!unit.description && (
              <Text style={[s.cardDesc, { color: isDark ? '#64748B' : '#94A3B8' }]} numberOfLines={2}>
                {unit.description}
              </Text>
            )}
            <View style={s.cardMeta}>
              <View style={[s.rangePill, { backgroundColor: `${accent}12`, borderColor: `${accent}28` }]}>
                <Text style={[s.rangeText, { color: accent }]}>
                  {unit.lesson_range || unit.lessonRange}
                </Text>
              </View>
              <Text style={[s.tapHint, { color: accent }]}>{t('tapToOpen')}</Text>
            </View>
          </View>

          {/* Arrow */}
          <View style={[s.arrow, { backgroundColor: `${accent}12` }]}>
            <Text style={[s.arrowText, { color: accent }]}>›</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function SecondPage({ navigation }) {
  const { isDark }   = useTheme();
  const { t, lang }  = useLanguage();
  const T = useMemo(() => buildTheme(isDark), [isDark]);
  const headerAnim   = useRef(new Animated.Value(0)).current;

  const fetcher = useCallback(() => fetchUnits(lang), [lang]);
  const { data: units, loading, error, refetch } = useApi(fetcher, [lang]);

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: isDark ? P.ink : '#F0F4FF' }]}>
      <StatusBar barStyle="light-content" backgroundColor={P.ink} />

      {/* ── Hero header ── */}
      <LinearGradient colors={[P.ink, '#081122', P.navy]} style={s.header}>
        <View style={s.orb1} />
        <LinearGradient colors={[`${P.sky}18`, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

        <Animated.View style={{ opacity: headerAnim }}>
          <View style={s.headerRow}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']} style={s.backBtnInner}>
                <Text style={s.backText}>{t('back')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={s.headerTitle}>{t('quarterlyUnits')}</Text>
            <View style={{ width: 70 }} />
          </View>

          {/* Quarter hero */}
          <View style={s.heroContent}>
            <View style={[s.quarterPill, { borderColor: `${P.gold}40`, backgroundColor: `${P.gold}12` }]}>
              <Text style={[s.quarterPillText, { color: P.gold }]}>{t('units_quarter_period', '4TH QUARTER  •  JUNE – AUG 2023')}</Text>
            </View>
            <LinearGradient colors={['transparent', P.gold, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.goldRule} />
            <Text style={s.heroTheme}>{t('units_theme_prefix', 'Demonstration of the')}</Text>
            <Text style={[s.heroThemeBold, { color: P.sky }]}>{t('units_theme_main', 'CHRISTIAN LIFE')}</Text>
            <View style={s.heroDivRow}>
              <View style={s.heroDivLine} /><Text style={s.heroDivText}>{t('units_theme_sub', 'EXPOSITION ON THE BOOK OF PHILEMON')}</Text><View style={s.heroDivLine} />
            </View>
          </View>
          <LinearGradient colors={['transparent', `${P.sky}40`, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.headerBottom} />
        </Animated.View>
      </LinearGradient>

      {/* ── Error ── */}
      {error && !loading && <ErrorState message={error} onRetry={refetch} T={T} />}

      {/* ── Content ── */}
      {!error && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={P.sky} colors={[P.sky]} />}
        >
          {/* Section label */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: P.sky }]} />
            <Text style={[s.sectionLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>{t('unitsOfStudy')}</Text>
            <Text style={[s.sectionCount, { color: isDark ? '#475569' : '#CBD5E1' }]}>
              {units ? t('units_count', '{n} Units').replace('{n}', String(units.length)) : ''}
            </Text>
          </View>

          {/* Skeleton */}
          {loading && <SkeletonList count={3} T={T} />}

          {/* Unit cards */}
          {!loading && Array.isArray(units) && (
            <View style={s.list}>
              {units.map((unit, i) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  index={i}
                  onPress={(u) => navigation.navigate('UnitLessons', { unit: u })}
                  T={T} t={t} isDark={isDark}
                />
              ))}
            </View>
          )}

          {/* Footer */}
          {!loading && units && (
            <View style={s.footer}>
              <LinearGradient colors={['transparent', P.gold, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.footerRule} />
              <Text style={[s.footerText, { color: isDark ? '#334155' : '#94A3B8' }]}>{t('unitsFooter')}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingBottom: 28, overflow: 'hidden' },
  orb1: { position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: `${P.sky}12` },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, marginBottom: 20 },
  backBtn: { borderRadius: 12, overflow: 'hidden' },
  backBtnInner: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  backText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  heroContent: { alignItems: 'center', paddingHorizontal: 20 },
  quarterPill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7, marginBottom: 16 },
  quarterPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  goldRule: { width: 48, height: 2, borderRadius: 1, marginBottom: 14 },
  heroTheme: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '300', textAlign: 'center' },
  heroThemeBold: { fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, marginTop: 2, marginBottom: 14 },
  heroDivRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  heroDivLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroDivText: { color: 'rgba(255,255,255,0.38)', fontSize: 8.5, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center', flex: 2 },
  headerBottom: { width: '110%', height: 2, marginTop: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionLabel: { flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  sectionCount: { fontSize: 11, fontWeight: '600' },
  list: { paddingHorizontal: 20, gap: 14 },
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  cardStripe: { height: 3 },
  cardBody: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  numBadge: { width: 54, height: 60, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', gap: 2 },
  numText: { fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  numLabel: { fontSize: 7, fontWeight: '800', letterSpacing: 1.5 },
  cardContent: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, lineHeight: 21 },
  cardDesc: { fontSize: 12, fontWeight: '400', lineHeight: 17 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  rangePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  rangeText: { fontSize: 10, fontWeight: '700' },
  tapHint: { fontSize: 11, fontWeight: '800' },
  arrow: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  arrowText: { fontSize: 24, fontWeight: '300', marginTop: -2 },
  footer: { alignItems: 'center', paddingHorizontal: 20, marginTop: 28, gap: 10 },
  footerRule: { width: 40, height: 1.5, borderRadius: 1 },
  footerText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
});