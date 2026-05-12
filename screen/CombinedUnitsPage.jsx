// screens/CombinedUnitsPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Bamboo fintech pattern (matches Homescreen exactly)
//   • White cards on #F5F7FA  ·  Dark: #1A1A1A on #0D0D0D
//   • Blue primary #1A56DB
//   • SectionHeader + clean card rows (same as Homescreen)
//   • Unit accordion: expand/collapse to reveal lesson rows
//   • Big illustrative emoji icons per section
//   • Premium bottom tab bar with sliding indicator
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Easing, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }    from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchUnits, fetchLessonsByUnit } from '../services/api';
import { API_BASE_URL } from '../context/SubscriptionContext';
import AppTabBar from '../components/AppTabBar';
import { getTokens } from '../theme/tokens';
import { bookTones, AMBIENT_SHADOW as BOOK_SHADOW } from '../theme/bookSurfaces';
import { useScreenEntry } from '../hooks/useFluidAnim';

const { width } = require('react-native').Dimensions.get('window');

// ── Design tokens (same as Homescreen) ────────────────────────────────────────
const BLUE       = '#1A56DB';
const BLUE_MID   = '#3B82F6';
const BLUE_LIGHT = '#EFF6FF';

const buildCatMeta = (t) => ({
  adult:        { icon: '📖', color: '#7C3AED', label: t('cunits_adult_class', 'Adult Class') },
  youth:        { icon: '⚡', color: BLUE,       label: t('cunits_youth_class', 'Youth Class') },
  intermediate: { icon: '🌱', color: '#10B981',  label: t('cunits_intermediate_class', 'Intermediate Class') },
  children:     { icon: '🌟', color: '#F97316',  label: t('cunits_childrens_class', "Children's Class") },
});

// Unit accent colours (cycles per unit index)
const UNIT_ACCENTS = [BLUE, '#7C3AED', '#10B981', '#F97316', '#DC2626', '#0891B2'];

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: SectionHeader — identical to Homescreen
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ title, action, onAction, tk }) => (
  <View style={sh.row}>
    <Text style={[sh.title, { color: tk.textPrimary }]}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={[sh.action, { color: BLUE }]}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);
const sh = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title:  { fontSize: 18, fontWeight: '800' },
  action: { fontSize: 13, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY INFO CARD — like Homescreen's QuarterCard
// ─────────────────────────────────────────────────────────────────────────────
const CategoryInfoCard = ({ cat, catMeta, quarterInfo, tk, onPress, t }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9}
    style={[ci.card, { backgroundColor: tk.glassFill, borderColor: tk.glassEdge }]}>
    <View style={ci.row}>
      <View style={{ flex:1, marginRight:12 }}>
        <Text style={[ci.meta, { color: tk.textMuted }]}>
          {quarterInfo.quarter} · {catMeta.label}
        </Text>
        <Text style={[ci.theme, { color: tk.textPrimary }]}>
          {quarterInfo.theme_title || t('cunits_default_theme', 'Demonstration of the Christian Life')}
        </Text>
        {!!quarterInfo.theme_sub && (
          <Text style={[ci.themeSub, { color: tk.textMuted }]} numberOfLines={1}>
            {quarterInfo.theme_sub}
          </Text>
        )}
      </View>
      <View style={[ci.badge, { backgroundColor: BLUE_LIGHT }]}>
        <Text style={{ fontSize: 28 }}>{catMeta.icon}</Text>
        <Text style={[ci.badgeNum, { color: BLUE }]}>{quarterInfo.lesson_count || 13}</Text>
        <Text style={[ci.badgeSub, { color: BLUE }]}>{t ? t('lessons', 'Lessons') : 'Lessons'}</Text>
      </View>
    </View>
    <View style={[ci.divider, { backgroundColor: tk.glassEdge }]} />
    <View style={ci.row}>
      <Text style={[ci.bookLabel, { color: tk.textMuted }]}>
        📜  {quarterInfo.book_full || (t ? t('cunits_book_philemon', 'Book of Philemon') : 'Book of Philemon')}
      </Text>
      <View style={[ci.startBtn, { backgroundColor: BLUE }]}>
        <Text style={ci.startBtnTxt}>{t ? t('cunits_browse_units', 'Browse Units →') : 'Browse Units →'}</Text>
      </View>
    </View>
  </TouchableOpacity>
);
const ci = StyleSheet.create({
  card:       { borderRadius: 18, borderWidth: 1, padding: 20, shadowColor: '#000', shadowOffset:{width:0,height:2}, shadowOpacity:.06, shadowRadius:12, elevation:3 },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta:       { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing:.3 },
  theme:      { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  badge:      { borderRadius: 16, padding: 14, alignItems: 'center' },
  badgeNum:   { fontSize: 18, fontWeight: '900', marginTop: 4, lineHeight: 22 },
  badgeSub:   { fontSize: 10, fontWeight: '700', letterSpacing: .5 },
  divider:    { height: 1, marginVertical: 16 },
  themeSub:   { fontSize: 11, fontWeight: '500', marginTop: 3 },
  bookLabel:  { fontSize: 13, fontWeight: '500' },
  startBtn:   { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  startBtnTxt:{ color: '#fff', fontSize: 13, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// LESSON ROW — identical pattern to Homescreen LessonRow
// ─────────────────────────────────────────────────────────────────────────────
const LessonRow = ({ lesson, accent, tk, onPress, isLast }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}
    style={[lr.row, { borderBottomColor: tk.glassEdge, borderBottomWidth: isLast ? 0 : 1 }]}>
    <View style={[lr.iconBox, { backgroundColor: accent + '18' }]}>
      <Text style={{ fontSize: 22 }}>📖</Text>
    </View>
    <View style={lr.mid}>
      <Text style={[lr.title, { color: tk.textPrimary }]} numberOfLines={1}>
        {lesson.title}
      </Text>
      <Text style={[lr.sub, { color: tk.textMuted }]}>
        {lesson.lesson_date || `Lesson ${lesson.lesson_number}`}
      </Text>
    </View>
    <View style={[lr.numBadge, { backgroundColor: accent + '15', borderColor: accent + '30' }]}>
      <Text style={[lr.num, { color: accent }]}>
        {String(lesson.lesson_number).padStart(2,'0')}
      </Text>
    </View>
  </TouchableOpacity>
);
const lr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  iconBox:  { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  mid:      { flex: 1, marginRight: 10 },
  title:    { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  sub:      { fontSize: 11 },
  numBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  num:      { fontSize: 13, fontWeight: '900' },
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIT ACCORDION BLOCK — white card, collapse/expand
// ─────────────────────────────────────────────────────────────────────────────
const UnitBlock = ({ unit, index, navigation, lang, tk, category, t }) => {
  const accent    = UNIT_ACCENTS[index % UNIT_ACCENTS.length];
  const [open,    setOpen]    = useState(false);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  // Entrance animation
  const enterAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1, duration: 420, delay: index * 80,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  const ty = enterAnim.interpolate({ inputRange:[0,1], outputRange:[20,0] });

  // Chevron rotation
  const rotAnim = useRef(new Animated.Value(0)).current;
  const spin = rotAnim.interpolate({ inputRange:[0,1], outputRange:['0deg','180deg'] });

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    Animated.timing(rotAnim, { toValue: next?1:0, duration:220, useNativeDriver:true }).start();
    if (next && !loaded) {
      setLoading(true);
      try {
        const data = await fetchLessonsByUnit(unit.id, lang);
        setLessons(data || []);
      } catch(_) {}
      finally { setLoading(false); setLoaded(true); }
    }
  };

  const iconUnits = ['📚','📕','📗','📘','📙','📓'];
  const unitIcon  = iconUnits[index % iconUnits.length];

  return (
    <Animated.View style={{ opacity: enterAnim, transform:[{ translateY:ty }], marginBottom: 12 }}>
      <View style={[ub.card, { backgroundColor: tk.glassFill, borderColor: tk.glassEdge }]}>

        {/* ── Unit header (tap to expand) ── */}
        <TouchableOpacity onPress={toggle} activeOpacity={0.75} style={ub.header}>
          {/* Big icon */}
          <View style={[ub.iconBox, { backgroundColor: accent + '15' }]}>
            <Text style={{ fontSize: 26 }}>{unitIcon}</Text>
          </View>

          <View style={ub.headerMid}>
            <View style={[ub.unitNumPill, { backgroundColor: accent, }]}>
              <Text style={ub.unitNumTxt}>{t('cunits_unit_n', 'Unit {n}').replace('{n}', String(index + 1))}</Text>
            </View>
            <Text style={[ub.unitTitle, { color: tk.textPrimary }]} numberOfLines={2}>
              {unit.title}
            </Text>
            {!!unit.lesson_range && (
              <Text style={[ub.unitRange, { color: tk.textMuted }]}>{unit.lesson_range}</Text>
            )}
          </View>

          {/* Chevron */}
          <Animated.View style={[ub.chevronBox, { backgroundColor: tk.surfaceEl, transform:[{rotate:spin}] }]}>
            <Text style={[ub.chevron, { color: tk.textMuted }]}>⌄</Text>
          </Animated.View>
        </TouchableOpacity>

        {/* ── Description row ── */}
        {!!unit.description && (
          <View style={[ub.descRow, { borderTopColor: tk.glassEdge }]}>
            <Text style={[ub.descText, { color: tk.textSec }]} numberOfLines={open ? undefined : 2}>
              {unit.description}
            </Text>
          </View>
        )}

        {/* ── Expanded lessons ── */}
        {open && (
          <View style={[ub.lessonsContainer, { borderTopColor: tk.glassEdge }]}>
            {/* Lessons label */}
            <View style={ub.lessonHeader}>
              <Text style={[ub.lessonsLabel, { color: tk.textMuted }]}>{t('cunits_lessons_in_unit', 'LESSONS IN THIS UNIT')}</Text>
              {lessons.length > 0 && (
                <View style={[ub.countPill, { backgroundColor: accent+'15', borderColor: accent+'30' }]}>
                  <Text style={[ub.countTxt, { color: accent }]}>{lessons.length}</Text>
                </View>
              )}
            </View>

            {loading ? (
              <View style={ub.loadingRow}>
                <ActivityIndicator color={BLUE} size="small" />
                <Text style={[ub.loadingTxt, { color: tk.textMuted }]}>{t('cunits_loading_lessons', 'Loading lessons…')}</Text>
              </View>
            ) : lessons.length === 0 ? (
              <View style={ub.emptyRow}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
                <Text style={[ub.emptyTxt, { color: tk.textMuted }]}>{t('cunits_no_lessons_in_unit', 'No lessons in this unit yet.')}</Text>
              </View>
            ) : (
              lessons.map((lesson, i) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  accent={accent}
                  tk={tk}
                  isLast={i === lessons.length - 1}
                  onPress={() => navigation.navigate('LessonPage', { items: lesson, category })}
                />
              ))
            )}
          </View>
        )}

      </View>
    </Animated.View>
  );
};
const ub = StyleSheet.create({
  card:              { borderRadius: 18, borderWidth: 1, overflow: 'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },
  header:            { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  iconBox:           { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  headerMid:         { flex: 1 },
  unitNumPill:       { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  unitNumTxt:        { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: .5 },
  unitTitle:         { fontSize: 15, fontWeight: '800', lineHeight: 21, marginBottom: 4 },
  unitRange:         { fontSize: 11, fontWeight: '600' },
  chevronBox:        { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  chevron:           { fontSize: 18, fontWeight: '700', marginTop: -2 },
  descRow:           { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  descText:          { fontSize: 13, lineHeight: 20 },
  lessonsContainer:  { borderTopWidth: 1 },
  lessonHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  lessonsLabel:      { fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  countPill:         { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  countTxt:          { fontSize: 11, fontWeight: '900' },
  loadingRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, justifyContent: 'center' },
  loadingTxt:        { fontSize: 13 },
  emptyRow:          { alignItems: 'center', padding: 24 },
  emptyTxt:          { fontSize: 13 },
});

// ─────────────────────────────────────────────────────────────────────────────
// QUICK STATS ROW — 3 stat pills
// ─────────────────────────────────────────────────────────────────────────────
const StatRow = ({ catMeta, unitCount, tk, quarterInfo, t }) => (
  <View style={st.row}>
    {[
      { icon: '📚', label: t('cunits_stat_units', 'Units'),   val: unitCount || '—' },
      { icon: '📖', label: t('lessons', 'Lessons'), val: quarterInfo?.lesson_count || 13 },
      { icon: '🗓',  label: t('cunits_stat_quarter', 'Quarter'), val: quarterInfo?.quarter || 'Q4 2026' },
    ].map(item => (
      <View key={item.label} style={[st.pill, { backgroundColor: tk.glassFill, borderColor: tk.glassEdge }]}>
        <Text style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</Text>
        <Text style={[st.val, { color: tk.textPrimary }]}>{item.val}</Text>
        <Text style={[st.label, { color: tk.textMuted }]}>{item.label}</Text>
      </View>
    ))}
  </View>
);
const st = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 10 },
  pill:  { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:.04, shadowRadius:6, elevation:1 },
  val:   { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  label: { fontSize: 10, fontWeight: '600' },
});

// Bottom tab bar replaced with shared <AppTabBar/> for icon parity across screens.

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function CombinedUnitsPage({ route, navigation }) {
  const { isDark }  = useTheme();
  const { t, lang } = useLanguage();
  const tk = useMemo(() => ({ ...getTokens(isDark), ...bookTones(isDark) }), [isDark]);
  const CAT_META = useMemo(() => buildCatMeta(t), [t]);
  const { fade, translateY } = useScreenEntry();

  const routeCategory = route?.params?.category || null;
  const catId         = routeCategory?.id || 'adult';
  const catMeta       = CAT_META[catId] || CAT_META.adult;

  const [units,       setUnits]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activeTab,   setActiveTab]   = useState(1);
  const [quarterInfo, setQuarterInfo] = useState({
    quarter:      'Q4 2026',
    theme_title:  t('cunits_default_theme', 'Demonstration of the Christian Life'),
    theme_sub:    t('cunits_default_theme_sub', 'Exposition on the Book of Philemon'),
    book_full:    t('cunits_book_philemon', 'Book of Philemon'),
    lesson_count: 13,
  });

  // Fetch quarter/theme info from DB — re-fetches when language changes
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/quarter-info?lang=${lang}`)
      .then(r => r.json())
      .then(data => { if (data?.theme_title) setQuarterInfo(data); })
      .catch(() => {});
  }, [lang]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    fetchUnits(lang, catId)
      .then(d => { if (active) setUnits(d || []); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lang, catId]);

  // 5-tab: 0=Home 1=Units(stay) 2=Notes 3=Stats 4=Settings
  // Settings intentionally removed — it lives only on the Library home so
  // every book shares a single, central entry point.
  const handleTab = (i) => {
    setActiveTab(i);
    if (i === 0) navigation.navigate('HomeScreen');
    if (i === 2) navigation.navigate('Notes');
    if (i === 3) navigation.navigate('Progress');
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.pageBg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.pageBg} />

      {/* ── TOP BAR ── */}
      <View style={[s.topbar, { backgroundColor: tk.pageBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}
          style={[s.iconBtn, { backgroundColor: tk.surfaceEl }]}>
          <Text style={{ fontSize: 20, color: tk.textPrimary }}>←</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={[s.pageTitle, { color: tk.textPrimary }]}>{catMeta.label}</Text>
          <Text style={[s.pageSub, { color: tk.textMuted }]}>{t('cunits_subtitle_q4', 'Sunday School · Q4 2026')}</Text>
        </View>
        {/* empty view to keep title centered */}
        <View style={s.iconBtn}/>
      </View>

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        {/* ── CATEGORY INFO CARD ── */}
        <View style={s.section}>
          <CategoryInfoCard
            cat={routeCategory}
            catMeta={catMeta}
            quarterInfo={quarterInfo}
            tk={tk}
            onPress={() => {}}
            t={t}
          />
        </View>

        {/* ── STATS ROW ── */}
        <View style={s.section}>
          <StatRow catMeta={catMeta} unitCount={units.length} tk={tk} quarterInfo={quarterInfo} t={t} />
        </View>

        {/* ── UNITS SECTION ── */}
        <View style={s.section}>
          <SectionHeader
            title={t('cunits_units_of_study', 'Units of Study')}
            action={units.length > 0 ? t('units_count', '{n} Units').replace('{n}', String(units.length)) : undefined}
            tk={tk}
          />

          {loading ? (
            <View style={s.loadingBox}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>⏳</Text>
              <ActivityIndicator color={BLUE} size="large" />
              <Text style={[s.loadingTxt, { color: tk.textMuted }]}>{t('cunits_loading_units', 'Loading units…')}</Text>
            </View>
          ) : error ? (
            <View style={s.errorBox}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
              <Text style={[s.errorTxt, { color: '#EF4444' }]}>{error}</Text>
              <TouchableOpacity
                onPress={() => { setLoading(true); fetchUnits(lang, catId).then(setUnits).catch(e=>setError(e.message)).finally(()=>setLoading(false)); }}
                style={[s.retryBtn, { backgroundColor: BLUE }]}>
                <Text style={s.retryTxt}>{t('btn_retry', 'Retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : units.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
              <Text style={[s.emptyTxt, { color: tk.textMuted }]}>{t('cunits_no_units_for', 'No units found for {label}.').replace('{label}', catMeta.label)}</Text>
              <Text style={[s.emptyHint, { color: tk.textMuted }]}>{t('cunits_coming_soon', 'Content may be coming soon.')}</Text>
            </View>
          ) : (
            units.map((unit, i) => (
              <UnitBlock
                key={unit.id}
                unit={unit}
                index={i}
                navigation={navigation}
                lang={lang}
                tk={tk}
                category={routeCategory}
                t={t}
              />
            ))
          )}
        </View>

        {/* ── QUICK ACCESS — identical to Homescreen ── */}
        <View style={s.section}>
          <SectionHeader title={t('quick_access', 'Quick Actions')} tk={tk} />
          <View style={s.qGrid}>
            {[
              { icon:'📝', label:t('notes', 'Notes'),           sub:t('notes_sub', 'Your class notes'),    bg:'#EFF6FF', onPress:()=>navigation.navigate('Notes') },
              { icon:'📚', label:t('lessons', 'Lessons'),       sub:t('lessons_sub', 'Browse all units'),  bg:'#F5F3FF', onPress:()=>navigation.navigate('SecondPage', { category:routeCategory }) },
              { icon:'🏛️', label:t('library', 'Library'),       sub:t('library_sub', 'Switch books · settings'), bg:'#ECFDF5', onPress:()=>navigation.navigate('Library') },
              { icon:'🌅', label:t('devotional', 'Devotional'), sub:t('devotional_sub', 'Daily reading plan'), bg:'#FFF7ED', locked:true,
                onPress:()=>Alert.alert(t('devotional','Devotional'), t('home_coming_soon','This feature is coming soon.')) },
            ].map((item, i) => (
              <TouchableOpacity key={i} onPress={item.onPress} activeOpacity={0.78}
                style={[s.qItem, {
                  backgroundColor: tk.glassFill,
                  borderColor:     tk.glassEdge,
                  opacity:         item.locked ? 0.55 : 1,
                }]}>
                <View style={[s.qIcon, { backgroundColor: isDark ? tk.surfaceEl : item.bg }]}>
                  <Text style={{ fontSize:26 }}>{item.icon}</Text>
                  {item.locked && (
                    <View style={s.qLockOverlay}>
                      <Text style={s.qLockIcon}>🔒</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.qLabel, { color:tk.textPrimary }]}>{item.label}</Text>
                <Text style={[s.qSub, { color:tk.textMuted }]}>{item.sub}</Text>
                {item.locked && (
                  <View style={[s.qLockedPill, { backgroundColor: tk.surfaceEl, borderColor: tk.glassEdge }]}>
                    <Text style={[s.qLockedTxt, { color: tk.textMuted }]}>🔒  {t('home_coming_soon_pill','Coming Soon')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <Text style={[s.footerTxt, { color: tk.textMuted }]}>{t('login_footer', '© Gospelar Sunday School Department')}</Text>
          <Text style={[s.footerSite, { color: BLUE }]}>www.gospelar.com</Text>
        </View>

      </Animated.ScrollView>

      <AppTabBar
        activeTab={activeTab}
        onTab={handleTab}
        tk={tk}
        tabs={[
          { key: 'Home',    label: t('tab_home',         'Home')    },
          { key: 'Lessons', label: t('cunits_tab_units', 'Units')   },
          { key: 'Notes',   label: t('tab_notes',        'Notes')   },
          { key: 'Stats',   label: t('tab_progress',     'Progress')},
        ]}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1 },
  topbar:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:8, paddingBottom:16 },
  iconBtn:   { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },
  topCenter: { alignItems:'center' },
  pageTitle: { fontSize:17, fontWeight:'800' },
  pageSub:   { fontSize:11, marginTop:2 },
  section:   { paddingHorizontal:20, marginBottom:24 },
  loadingBox:{ paddingVertical:48, alignItems:'center', gap:12 },
  loadingTxt:{ fontSize:14 },
  errorBox:  { paddingVertical:40, alignItems:'center', gap:10 },
  errorTxt:  { fontSize:14, textAlign:'center' },
  retryBtn:  { borderRadius:12, paddingHorizontal:24, paddingVertical:11, marginTop:4 },
  retryTxt:  { color:'#fff', fontWeight:'700', fontSize:14 },
  emptyBox:  { paddingVertical:40, alignItems:'center', gap:8 },
  emptyTxt:  { fontSize:14, fontWeight:'600', textAlign:'center' },
  emptyHint: { fontSize:12, textAlign:'center' },
  qGrid:     { flexDirection:'row', flexWrap:'wrap', gap:12 },
  qItem:     { width:(width-54)/2, borderRadius:18, borderWidth:1, padding:18, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:8, elevation:1 },
  qIcon:     { width:52, height:52, borderRadius:16, justifyContent:'center', alignItems:'center', marginBottom:12, position:'relative' },
  qLabel:    { fontSize:15, fontWeight:'800', marginBottom:4 },
  qSub:      { fontSize:11 },
  qLockOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(13,15,18,0.55)', borderRadius:16, justifyContent:'center', alignItems:'center' },
  qLockIcon:   { fontSize:18 },
  qLockedPill: { alignSelf:'flex-start', borderRadius:8, paddingHorizontal:8, paddingVertical:3, marginTop:6, borderWidth:1 },
  qLockedTxt:  { fontSize:9, fontWeight:'900', letterSpacing:.5 },
  footer:    { alignItems:'center', marginTop:8, paddingHorizontal:20, paddingBottom:8 },
  footerTxt: { fontSize:11, marginBottom:4 },
  footerSite:{ fontSize:12, fontWeight:'700' },
});