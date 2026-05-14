// screens/UnitLessonsPage.jsx  — PREMIUM REDESIGN
import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Dimensions, StatusBar, RefreshControl, Animated, Pressable,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }    from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { buildTheme, BRAND } from '../theme/colors';
import { fetchLessonsByUnit } from '../services/api';
import useApi from '../hooks/useApi';
import { SkeletonList, ErrorState, EmptyState } from '../components/FetchStates';

const { width } = Dimensions.get('window');
const P = {
  ink: '#050D1F', navy: '#0A1628', sky: '#2563EB', gold: '#F59E0B',
  violet: '#7C3AED', emerald: '#10B981', coral: '#EF4444',
};

const ACCENT_CYCLE = [P.sky, P.violet, P.emerald, '#F97316', P.coral, '#EC4899'];

const normaleLesson = (row) => {
  const jsonContent = row.content || {};
  const lessonPart     = row.lesson_part?.length     ? row.lesson_part    : (jsonContent.lesson_part    || []);
  const devotionalDays = row.devotional_days?.length ? row.devotional_days : (jsonContent.devotional_days || []);
  const questions      = row.questions?.length        ? row.questions       : (jsonContent.questions       || []);
  return {
    id: row.id, title: row.title, date: row.lesson_date, topic: row.topic,
    content: {
      lesson_number: row.lesson_number, lesson_date: row.lesson_date,
      description: row.description || jsonContent.description,
      qauter_theme: row.quarter_theme || jsonContent.qauter_theme,
      suggested_hymns: row.suggested_hymns, devotional_reading: row.devotional_reading,
      topic_for_adults: jsonContent.topic_for_adults, topic_for_youth: jsonContent.topic_for_youth,
      topic_for_intermediate: jsonContent.topic_for_intermediate, lesson_scriptures: jsonContent.lesson_scriptures,
      memory_verse: row.memory_verse, memoryVerse_bible_passage: row.memory_verse_passage,
      lesson_background: row.lesson_background, lesson_conclusion: row.lesson_conclusion,
      lesson_part: lessonPart, devotional_days: devotionalDays, questions,
    },
  };
};

// ── Lesson row card ───────────────────────────────────────────────────────────
const LessonRow = ({ lesson, index, onPress, isDark, t }) => {
  const scale  = useRef(new Animated.Value(0.97)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(24)).current;
  const accent  = ACCENT_CYCLE[index % ACCENT_CYCLE.length];
  const altAccent = ACCENT_CYCLE[(index + 1) % ACCENT_CYCLE.length];

  useEffect(() => {
    const delay = index * 75;
    // Hold the handle so unmount can stop it. Without this, a card whose
    // entry animation is still running when the user taps the screen
    // header (back / book switcher) leaves the native animator with an
    // Animated.Value whose owner has been GC'd — surfaces as
    // "Cannot read property 'stopTracking' of undefined".
    const handle = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, delay, tension: 65, friction: 9, useNativeDriver: true }),
    ]);
    handle.start();
    return () => { try { handle.stop(); } catch { /* already done */ } };
  }, []);

  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200 }).start();

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: slideY }, { scale }] }}>
      <Pressable
        onPress={() => onPress(lesson)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[s.lessonCard, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
          borderColor: isDark ? `${accent}25` : `${accent}18`,
        }]}
      >
        <LinearGradient colors={[accent, altAccent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.lessonStripe} />
        <View style={s.lessonBody}>
          {/* Number */}
          <View style={[s.lessonNum, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
            <Text style={[s.lessonNumText, { color: accent }]}>{String(lesson.content.lesson_number ?? index + 1).padStart(2, '0')}</Text>
            <Text style={[s.lessonWord, { color: `${accent}80` }]}>{t('lesson')}</Text>
          </View>

          {/* Info */}
          <View style={s.lessonInfo}>
            <Text style={[s.lessonTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={2}>
              {lesson.title}
            </Text>
            {!!lesson.topic && (
              <Text style={[s.lessonTopic, { color: isDark ? '#64748B' : '#94A3B8' }]} numberOfLines={1}>
                {lesson.topic}
              </Text>
            )}
            {!!lesson.content.memory_verse && (
              <View style={[s.verseBar, { borderLeftColor: accent }]}>
                <Text style={[s.verseText, { color: isDark ? '#475569' : '#94A3B8' }]} numberOfLines={1}>
                  "{lesson.content.memory_verse}"
                </Text>
              </View>
            )}
            <View style={s.lessonMeta}>
              {!!lesson.date && (
                <View style={[s.datePill, { backgroundColor: `${accent}10`, borderColor: `${accent}25` }]}>
                  <Text style={[s.dateText, { color: accent }]}>{lesson.date}</Text>
                </View>
              )}
              {!!lesson.content.memoryVerse_bible_passage && (
                <View style={[s.scriptPill, { backgroundColor: `${P.gold}10` }]}>
                  <Text style={[s.scriptText, { color: P.gold }]}>{lesson.content.memoryVerse_bible_passage}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Arrow */}
          <View style={[s.lessonArrow, { backgroundColor: `${accent}12` }]}>
            <Text style={[s.lessonArrowText, { color: accent }]}>›</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function UnitLessonsPage({ route, navigation }) {
  const { unit } = route.params;
  const { isDark } = useTheme();
  const { t, lang } = useLanguage();
  const T = useMemo(() => buildTheme(isDark), [isDark]);
  const heroAnim = useRef(new Animated.Value(0)).current;

  const fetcher = useCallback(() => fetchLessonsByUnit(unit.id, lang), [unit.id, lang]);
  const { data: rawLessons, loading, error, refetch } = useApi(fetcher, [unit.id, lang]);
  const lessons = useMemo(() => rawLessons ? rawLessons.map(normaleLesson) : null, [rawLessons]);

  useEffect(() => {
    // Same cleanup pattern as the card-entry animation above. The hero
    // is a 650ms timing, so a quick header tap can easily catch it mid-flight.
    const handle = Animated.timing(heroAnim, { toValue: 1, duration: 650, useNativeDriver: true });
    handle.start();
    return () => { try { handle.stop(); } catch { /* already done */ } };
  }, []);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: isDark ? P.ink : '#F0F4FF' }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={P.ink} />
      {error && !loading && <ErrorState message={error} onRetry={refetch} T={T} />}

      {!error && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 56 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={P.sky} colors={[P.sky]} />}
        >
          {/* ── Hero ── */}
          <LinearGradient colors={[P.ink, '#081122', P.navy, '#0F2040']} locations={[0, 0.3, 0.7, 1]} style={s.hero}>
            <View style={s.heroOrb1} /><View style={s.heroOrb2} />
            <LinearGradient colors={[`${P.sky}18`, 'transparent', `${P.violet}14`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

            <Animated.View style={{ opacity: heroAnim, width: '100%' }}>
              <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.75}>
                <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']} style={s.backBtnInner}>
                  <Text style={s.backText}>{t('back')}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={s.heroCenter}>
                <View style={[s.unitBadge, { borderColor: `${P.gold}40`, backgroundColor: `${P.gold}12` }]}>
                  <Text style={[s.unitBadgeText, { color: P.gold }]}>{t('unitOfStudy')}</Text>
                </View>
                <LinearGradient colors={['transparent', P.gold, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.goldRule} />
                <Text style={s.heroTitle}>{unit.title}</Text>
                {!!unit.description && <Text style={s.heroDesc}>{unit.description}</Text>}
                <View style={s.heroDiv}>
                  <View style={s.heroDivLine} />
                  {!!(unit.lesson_range || unit.lessonRange) && (
                    <Text style={s.heroDivText}>{unit.lesson_range || unit.lessonRange}</Text>
                  )}
                  <View style={s.heroDivLine} />
                </View>
                {lessons != null && (
                  <View style={[s.countPill, { backgroundColor: `${P.sky}25`, borderColor: `${P.sky}50` }]}>
                    <Text style={s.countText}>
                      {lessons.length === 1
                        ? t('unit_one_lesson', '1 Lesson')
                        : t('unit_n_lessons', '{n} Lessons').replace('{n}', String(lessons.length))}
                    </Text>
                  </View>
                )}
              </View>
              <LinearGradient colors={['transparent', `${P.sky}45`, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.heroBottom} />
            </Animated.View>
          </LinearGradient>

          {/* Section header */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: P.sky }]} />
            <Text style={[s.sectionLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>{t('lessonsSection')}</Text>
            <Text style={[s.sectionCount, { color: isDark ? '#475569' : '#CBD5E1' }]}>
              {lessons ? `${lessons.length}` : ''}
            </Text>
          </View>

          {loading && <SkeletonList count={4} T={T} />}
          {!loading && lessons && lessons.length === 0 && <EmptyState message={t('noLessons')} T={T} />}

          {!loading && lessons && lessons.length > 0 && (
            <View style={s.list}>
              {lessons.map((lesson, i) => (
                <LessonRow
                  key={lesson.id ?? i}
                  lesson={lesson} index={i}
                  onPress={(l) => navigation.navigate('LessonPage', {
                    items: l,
                    // Pass category so LessonPage shows the right age-group content
                    category: { id: unit.category_id || l.category_id || unit.id?.split('_')[0] || 'adult' },
                  })}
                  isDark={isDark} t={t}
                />
              ))}
            </View>
          )}

          {!loading && lessons && lessons.length > 0 && (
            <View style={s.footer}>
              <LinearGradient colors={['transparent', P.gold, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.footerRule} />
              <Text style={[s.footerText, { color: isDark ? '#334155' : '#94A3B8' }]}>{t('tapToStudy')}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32, overflow: 'hidden', position: 'relative', minHeight: 280 },
  heroOrb1: { position: 'absolute', top: -60, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: `${P.sky}12` },
  heroOrb2: { position: 'absolute', bottom: -40, left: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: `${P.violet}14` },
  backBtn: { alignSelf: 'flex-start', borderRadius: 12, overflow: 'hidden', marginBottom: 22 },
  backBtnInner: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  backText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  heroCenter: { alignItems: 'center' },
  unitBadge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 14 },
  unitBadgeText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 2 },
  goldRule: { width: 44, height: 2, borderRadius: 1, marginBottom: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: Math.min(27, width * 0.07), fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, lineHeight: 33, marginBottom: 10 },
  heroDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  heroDiv: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginBottom: 16 },
  heroDivLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroDivText: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, flex: 2, textAlign: 'center' },
  countPill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7, marginBottom: 16 },
  countText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  heroBottom: { width: '110%', height: 2, marginTop: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionLabel: { flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  sectionCount: { fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: 20, gap: 12 },
  lessonCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  lessonStripe: { height: 3 },
  lessonBody: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 13 },
  lessonNum: { width: 54, height: 60, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', gap: 2 },
  lessonNumText: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  lessonWord: { fontSize: 7, fontWeight: '800', letterSpacing: 1.5 },
  lessonInfo: { flex: 1, gap: 5 },
  lessonTitle: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2, lineHeight: 20 },
  lessonTopic: { fontSize: 11.5, fontWeight: '400', lineHeight: 16 },
  verseBar: { borderLeftWidth: 2.5, paddingLeft: 8, marginVertical: 2 },
  verseText: { fontSize: 11, fontStyle: 'italic', lineHeight: 16 },
  lessonMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  datePill: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  dateText: { fontSize: 10, fontWeight: '700' },
  scriptPill: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  scriptText: { fontSize: 10, fontWeight: '700' },
  lessonArrow: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  lessonArrowText: { fontSize: 22, fontWeight: '300', marginTop: -2 },
  footer: { alignItems: 'center', marginTop: 28, paddingHorizontal: 20, gap: 10 },
  footerRule: { width: 40, height: 1.5, borderRadius: 1 },
  footerText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
});