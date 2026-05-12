// screens/Homescreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Bamboo fintech aesthetic — Professional spacing, Bamboo card patterns
//   • Age group selector with human icons (replaces quick-action buttons)
//   • Recent Lessons — last 5 visited (from AsyncStorage)
//   • Quick Access: Notes · Lessons · Language · Devotional
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, ActivityIndicator, FlatList, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { useTheme }      from '../context/ThemeContext';
import { useLanguage }   from '../context/LanguageContext';
import { fetchPreviewLessons } from '../services/api';
import { API_BASE_URL, useSubscription } from '../context/SubscriptionContext';
import AppTabBar from '../components/AppTabBar';
import { ICONS } from '../components/icons';
import { getTokens, PALETTE } from '../theme/tokens';
import { bookTones, AMBIENT_SHADOW as BOOK_SHADOW } from '../theme/bookSurfaces';
import { useScreenEntry, useStaggerEntry } from '../hooks/useFluidAnim';

const { width } = require('react-native').Dimensions.get('window');

// Brand-blue accent kept for Sunday-school content (banners, links).
// Surface/text/etc. now come from the centralized tokens (theme/tokens.js).
const BLUE       = PALETTE.blue;
const BLUE_LIGHT = '#EFF6FF';

// ── Age group definitions with human icons ────────────────────────────────────
// Age-group images — one photo per category
const CATEGORY_IMAGES = {
  adult:        require('../assets/adult.jpg'),
  youth:        require('../assets/youth.jpg'),
  intermediate: require('../assets/intermediate.jpg'),
  children:     require('../assets/children.jpg'),
};

const CATEGORIES = [
  { id:'adult',        label:'Adult',        ageRange:'Ages 26+',  emoji:'🧑‍🦳', color:'#7C3AED', route:'SecondPage' },
  { id:'youth',        label:'Youth',        ageRange:'Ages 18–25', emoji:'🧑',   color:BLUE,       route:'SecondPage' },
  { id:'intermediate', label:'Intermediate', ageRange:'Ages 12–17', emoji:'🧒',   color:'#10B981',  route:'SecondPage' },
  { id:'children',     label:'Children',     ageRange:'Ages 4–11',  emoji:'👧',   color:'#F97316',  route:'SecondPage' },
];

// ── Promo banner colors/emojis (titles/subs translated at render time) ────────
const BANNERS_META = [
  { id:1, color:BLUE,      emoji:'✛',  titleKey:'home_banner_quarter_title',     titleFb:'Q4 2026 Quarter',    subKey:'home_banner_quarter_sub',     subFb:'Exposition on Philemon'  },
  { id:2, color:'#1976D2', emoji:'📖', titleKey:'home_banner_devotionals_title', titleFb:'Daily Devotionals',  subKey:'home_banner_devotionals_sub', subFb:'Read & grow each morning' },
  { id:3, color:'#B8860B', emoji:'⚡', titleKey:'home_banner_quiz_title',        titleFb:'Quiz Challenge',     subKey:'home_banner_quiz_sub',        subFb:'Earn points this week'    },
  { id:4, color:'#6A1B9A', emoji:'🏆', titleKey:'home_banner_leaderboard_title', titleFb:'Leaderboard',        subKey:'home_banner_leaderboard_sub', subFb:'See where you rank'       },
];

// ─────────────────────────────────────────────────────────────────────────────
// BANNER CARD
// ─────────────────────────────────────────────────────────────────────────────
const BannerCard = ({ item, t }) => (
  <View style={[bn.card, { backgroundColor: item.color }]}>
    <Text style={bn.emoji}>{item.emoji}</Text>
    <Text style={bn.title} numberOfLines={1}>{t(item.titleKey, item.titleFb)}</Text>
    <Text style={bn.sub}   numberOfLines={1}>{t(item.subKey,   item.subFb)}</Text>
  </View>
);
const bn = StyleSheet.create({
  card:  { width:140, borderRadius:16, padding:14, marginRight:12, justifyContent:'space-between', height:100 },
  emoji: { fontSize:24, marginBottom:6 },
  title: { fontSize:13, fontWeight:'700', color:'#fff' },
  sub:   { fontSize:11, color:'rgba(255,255,255,.75)', marginTop:2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// QUARTER CARD — like Bamboo's wealth card
// ─────────────────────────────────────────────────────────────────────────────
const QuarterCard = ({ cat, quarterInfo, tk, onPress, t }) => {
  const catLabel = t(`cat_${cat.id}`, cat.label);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}
      style={[qc.card, { backgroundColor:tk.glassFill, borderColor:tk.glassEdge }]}>
      <View style={qc.row}>
        <View style={{ flex:1 }}>
          <Text style={[qc.meta, { color:tk.textMuted }]}>
            {quarterInfo.quarter} · {t('home_class_for', '{label} Class').replace('{label}', catLabel)}
          </Text>
          <Text style={[qc.theme, { color:tk.textPrimary }]}>
            {quarterInfo.theme_title || t('cunits_default_theme', 'Demonstration of the Christian Life')}
          </Text>
          {!!quarterInfo.theme_sub && (
            <Text style={[qc.themeSub, { color:tk.textMuted }]} numberOfLines={1}>
              {quarterInfo.theme_sub}
            </Text>
          )}
        </View>
        <View style={[qc.badge, { backgroundColor:BLUE_LIGHT }]}>
          <Text style={[qc.badgeBig, { color:BLUE }]}>{quarterInfo.lesson_count || 13}</Text>
          <Text style={[qc.badgeSub, { color:BLUE }]}>{t('lessons', 'Lessons')}</Text>
        </View>
      </View>
      <View style={[qc.divider, { backgroundColor:tk.glassEdge }]} />
      <View style={qc.row}>
        <Text style={[qc.bookLabel, { color:tk.textMuted }]}>
          📜  {quarterInfo.book_full || t('cunits_book_philemon', 'Book of Philemon')}
        </Text>
        <View style={[qc.startBtn, { backgroundColor:BLUE }]}>
          <Text style={qc.startBtnTxt}>{t('home_start', 'Start →')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
const qc = StyleSheet.create({
  card:      { borderRadius:18, borderWidth:1, padding:20, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.06, shadowRadius:12, elevation:3 },
  row:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  meta:      { fontSize:12, fontWeight:'600', marginBottom:6, letterSpacing:.3 },
  theme:     { fontSize:20, fontWeight:'800', lineHeight:26 },
  badge:     { borderRadius:14, padding:12, alignItems:'center', minWidth:68 },
  badgeBig:  { fontSize:22, fontWeight:'900', lineHeight:26 },
  badgeSub:  { fontSize:11, fontWeight:'700' },
  divider:   { height:1, marginVertical:18 },
  themeSub:  { fontSize:11, fontWeight:'500', marginTop:3 },
  bookLabel: { fontSize:13, fontWeight:'500' },
  startBtn:  { borderRadius:20, paddingHorizontal:18, paddingVertical:9 },
  startBtnTxt:{ color:'#fff', fontSize:13, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// AGE GROUP CARD — circular image (or emoji fallback) + label + active state
// ─────────────────────────────────────────────────────────────────────────────
const AgeGroupCard = ({ item, active, locked, onPress, tk, t, index = 0 }) => {
  const imgSrc = CATEGORY_IMAGES[item.id];
  const label    = t(`cat_${item.id}`,       item.label);
  const ageRange = t(`cat_${item.id}_range`, item.ageRange);
  // Staggered fade+slide entry — each card pops in 60ms after the previous one
  const { fade, translateY } = useStaggerEntry(index);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.82}
      style={[ag.card, {
        backgroundColor: active && !locked ? item.color : tk.glassFill,
        borderColor:     active && !locked ? item.color : tk.glassEdge,
        shadowColor:     active && !locked ? item.color : '#000',
        opacity:         locked ? 0.55 : 1,
      }]}>
      {/* Circular image or emoji */}
      <View style={[ag.imgRing, {
        borderColor: active && !locked ? 'rgba(255,255,255,0.5)' : item.color + '40',
        backgroundColor: active && !locked ? 'rgba(255,255,255,0.15)' : item.color + '12',
      }]}>
        {imgSrc ? (
          <Image source={imgSrc} style={ag.img} resizeMode="cover"/>
        ) : (
          <Text style={ag.emoji}>{item.emoji}</Text>
        )}
        {locked && (
          <View style={ag.lockOverlay}>
            <ICONS.Lock color="#fff" size={20} sw={2.2} />
          </View>
        )}
      </View>
      <Text style={[ag.label, { color: active && !locked ? '#fff' : tk.textPrimary }]}>{label}</Text>
      <Text style={[ag.ageRange, { color: active && !locked ? 'rgba(255,255,255,0.85)' : tk.textMuted }]}>
        {ageRange}
      </Text>
      {active && !locked && (
        <View style={[ag.activePill, { backgroundColor:'rgba(255,255,255,0.22)' }]}>
          <Text style={ag.activePillTxt}>{t('home_selected', 'Selected')}</Text>
        </View>
      )}
      {locked && (
        <View style={[ag.lockedPill, { backgroundColor: tk.surfaceEl, borderColor: tk.glassEdge }]}>
          <Text style={[ag.lockedPillTxt, { color: tk.textMuted }]}>{t('home_locked_pill', '🔒  Locked')}</Text>
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
};
const ag = StyleSheet.create({
  card:        { width:(require('react-native').Dimensions.get('window').width-52)/2, alignItems:'center', borderRadius:18, borderWidth:1.5, paddingVertical:20, paddingHorizontal:8, shadowOffset:{width:0,height:4}, shadowOpacity:.12, shadowRadius:10, elevation:4 },
  imgRing:     { width:80, height:80, borderRadius:40, borderWidth:2.5, overflow:'hidden', justifyContent:'center', alignItems:'center', marginBottom:12, position:'relative' },
  img:         { width:80, height:80, borderRadius:40 },
  emoji:       { fontSize:34 },
  label:       { fontSize:13, fontWeight:'900', letterSpacing:.2, textAlign:'center' },
  ageRange:    { fontSize:11, fontWeight:'600', textAlign:'center', marginTop:3 },
  activePill:  { borderRadius:10, paddingHorizontal:8, paddingVertical:3, marginTop:6 },
  activePillTxt:{ fontSize:9, fontWeight:'900', color:'#fff', letterSpacing:.5 },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(13,15,18,0.55)', borderRadius:40, justifyContent:'center', alignItems:'center' },
  lockIcon:    { fontSize:24 },
  lockedPill:  { borderRadius:10, paddingHorizontal:10, paddingVertical:3, marginTop:6, borderWidth:1 },
  lockedPillTxt:{ fontSize:9, fontWeight:'900', letterSpacing:.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LESSON ROW — Bamboo portfolio row style
// ─────────────────────────────────────────────────────────────────────────────
const LessonRow = ({ lesson, tk, onPress, isLast }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}
    style={[lr.row, { borderBottomColor:tk.glassEdge, borderBottomWidth:isLast?0:1 }]}>
    <View style={[lr.iconBox, { backgroundColor:BLUE_LIGHT }]}>
      <ICONS.Book color={BLUE} size={20} sw={2} />
    </View>
    <View style={lr.mid}>
      <Text style={[lr.title, { color:tk.textPrimary }]} numberOfLines={1}>
        {lesson.title || lesson.lessonTitle || `Lesson ${lesson.lessonNumber}`}
      </Text>
      <Text style={[lr.sub, { color:tk.textMuted }]}>
        {lesson.lessonDate || lesson.scripture || `Lesson ${lesson.lessonNumber || ''}`}
      </Text>
    </View>
    <View style={[lr.numBadge, { backgroundColor:BLUE_LIGHT }]}>
      <Text style={[lr.num, { color:BLUE }]}>
        {String(lesson.lessonNumber || lesson.lesson_number || '').padStart(2,'0') || 'L'}
      </Text>
    </View>
  </TouchableOpacity>
);
const lr = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:16 },
  iconBox:  { width:44, height:44, borderRadius:13, justifyContent:'center', alignItems:'center', marginRight:14 },
  mid:      { flex:1, marginRight:10 },
  title:    { fontSize:14, fontWeight:'600', marginBottom:3 },
  sub:      { fontSize:12 },
  numBadge: { borderRadius:10, paddingHorizontal:10, paddingVertical:6 },
  num:      { fontSize:12, fontWeight:'900' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — Bamboo style
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ title, action, onAction, tk }) => (
  <View style={sh.row}>
    <Text style={[sh.title, { color:tk.textPrimary }]}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.75}>
        <Text style={[sh.action, { color:BLUE }]}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);
const sh = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  title:  { fontSize:18, fontWeight:'800' },
  action: { fontSize:13, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function Homescreen({ navigation }) {
  const { isDark }  = useTheme();
  const { t, lang } = useLanguage();
  const { canAccessCategory, planType, subscribedCategory, isSubscribed } = useSubscription();
  const tk = useMemo(() => ({ ...getTokens(isDark), ...bookTones(isDark) }), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const initialCategoryId = isSubscribed && planType === 'single' && subscribedCategory
    ? subscribedCategory
    : CATEGORIES[0].id;
  const [categoryId,      setCategoryId]      = useState(initialCategoryId);

  // Snap selection back to the user's allowed category if their plan changes
  useEffect(() => {
    if (isSubscribed && planType === 'single' && subscribedCategory && categoryId !== subscribedCategory) {
      if (!canAccessCategory(categoryId)) setCategoryId(subscribedCategory);
    }
  }, [isSubscribed, planType, subscribedCategory]);
  const [userRole,        setUserRole]        = useState('student');
  const [userName,        setUserName]        = useState('');
  const [recentLessons,   setRecentLessons]   = useState([]);
  const [previewLessons,  setPreviewLessons]  = useState([]);
  const [lessonsLoading,  setLessonsLoading]  = useState(false);
  const [activeTab,       setActiveTab]       = useState(0);
  const [quarterInfo,     setQuarterInfo]     = useState({
    quarter:      'Q4 2026',
    theme_title:  'Demonstration of the Christian Life',
    theme_sub:    'Exposition on the Book of Philemon',
    book_full:    'Book of Philemon',
    lesson_count: 13,
  });

  const cat       = useMemo(() => CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0], [categoryId]);
  const safeRoute = cat.route || 'SecondPage';

  // Load user info
  useEffect(() => {
    AsyncStorage.getItem('userRole').then(r => { if (r) setUserRole(r); }).catch(() => {});
    AsyncStorage.getItem('userName').then(n => { if (n) setUserName(n); }).catch(() => {});
  }, []);

  // Fetch quarter/theme info from database
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/quarter-info?lang=${lang}`)
      .then(r => r.json())
      .then(data => { if (data?.theme_title) setQuarterInfo(data); })
      .catch(() => {}); // silently fall back to defaults
  }, [lang]); // re-fetch when language changes

  // Load recently visited lessons from AsyncStorage
  const loadRecentLessons = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('gofamint_recent_lessons');
      if (raw) setRecentLessons(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    loadRecentLessons();
    // Refresh when screen is focused
    const unsubscribe = navigation.addListener('focus', loadRecentLessons);
    return unsubscribe;
  }, [navigation, loadRecentLessons]);

  // Load preview lessons as fallback if no recent lessons yet
  useEffect(() => {
    if (recentLessons.length > 0) return; // prefer recent
    let active = true;
    setLessonsLoading(true);
    fetchPreviewLessons(lang, 5, categoryId)
      .then(data => { if (active) setPreviewLessons(data || []); })
      .catch(() => { if (active) setPreviewLessons([]); })
      .finally(() => { if (active) setLessonsLoading(false); });
    return () => { active = false; };
  }, [categoryId, lang, recentLessons.length]);

  const displayedLessons = recentLessons.length > 0 ? recentLessons : previewLessons;
  const isRecentMode     = recentLessons.length > 0;

  // Tab navigation
  // 4-tab mapping: 0=Home 1=Units 2=Notes 3=Stats
  // Settings intentionally removed — it lives on the Library home now so a
  // single, central entry covers every book in the catalogue.
  const handleTab = useCallback((i) => {
    setActiveTab(i);
    if (i === 1) navigation.navigate(safeRoute, { category: cat });
    if (i === 2) navigation.navigate('Notes');
    if (i === 3) navigation.navigate('Progress');
  }, [navigation, safeRoute, cat]);

  // Safe-navigate helper.
  //
  // Wrapping `navigation.navigate(...)` in requestAnimationFrame defers it to
  // the next frame so the TouchableOpacity's internal Pressability finishes
  // its press-up cycle BEFORE the screen unmounts. Without this, a press that
  // triggers a synchronous navigation tears the touchable's responder out
  // mid-flight and React Native throws:
  //
  //     Cannot read property 'stopTracking' of undefined
  //
  // …from Pressability's cleanup. The defer fully resolves it without
  // perceptible delay (one frame ≈ 16 ms).
  const navTo = useCallback((screen, params) => {
    requestAnimationFrame(() => navigation.navigate(screen, params));
  }, [navigation]);

  const displayName = userName || t('learner', 'Learner');

  // Quick access items.
  // The old "Language" tile that routed to Settings has been replaced with a
  // "Library" tile — Settings is no longer reachable from Sunday School; it
  // lives on the Library home so it's centralised for all books.
  const QUICK_ACCESS = [
    { icon:'📝', label:t('notes','Notes'),           sub:t('notes_sub','Your class notes'),         bg:'#EFF6FF', onPress:()=>navigation.navigate('Notes') },
    { icon:'📚', label:t('lessons','Lessons'),       sub:t('lessons_sub','Browse all units'),       bg:'#F5F3FF', onPress:()=>navigation.navigate(safeRoute, { category: cat }) },
    { icon:'🏛️', label:t('library','Library'),       sub:t('library_sub','Switch books · settings'),bg:'#ECFDF5', onPress:()=>navigation.navigate('Library') },
    { icon:'🌅', label:t('devotional','Devotional'), sub:t('devotional_sub','Daily reading plan'),  bg:'#FFF7ED', locked:true,
      onPress:()=>Alert.alert(t('devotional','Devotional'), t('home_coming_soon','This feature is coming soon.')) },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor:tk.pageBg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.pageBg}/>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        {/* ── TOP BAR ──
            All navigation calls go through navTo() so the press animation
            finishes before the screen unmounts (see Pressability comment
            above). Bare `navigation.navigate(...)` here was the source of
            the "stopTracking of undefined" crash. */}
        <View style={[s.topbar, { backgroundColor:tk.pageBg }]}>
          <TouchableOpacity onPress={() => navTo('Profile')} activeOpacity={0.8} style={s.userRow}>
            <View style={[s.avatar, { backgroundColor:BLUE }]}>
              <Text style={s.avatarLetter}>{displayName[0]?.toUpperCase() || 'G'}</Text>
            </View>
            <View>
              <Text style={[s.greeting, { color:tk.textMuted }]}>{t('home_good_day', 'Good day 👋')}</Text>
              <Text style={[s.userName,  { color:tk.textPrimary }]}>{displayName}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.topActions}>
            {/* Back to the Library so the user can switch books without
                fully logging out + relaunching the app. */}
            <TouchableOpacity onPress={() => navTo('Library')} activeOpacity={0.75}
              accessibilityLabel="Library"
              style={[s.iconBtn, { backgroundColor:BLUE_LIGHT }]}>
              <ICONS.BookStack color={BLUE} size={18} sw={1.9} />
            </TouchableOpacity>
            {userRole === 'teacher' && (
              <TouchableOpacity onPress={() => navTo('TeacherDashboard')} activeOpacity={0.75}
                accessibilityLabel="Teacher dashboard"
                style={[s.iconBtn, { backgroundColor:BLUE_LIGHT }]}>
                <ICONS.Classes color={BLUE} size={18} sw={1.9} />
              </TouchableOpacity>
            )}
            {/* Settings intentionally removed — Settings is now reachable only
                from the Library home so it covers every book in one place. */}
          </View>
        </View>

        {/* ── PROMO BANNERS ── */}
        <View style={s.bannerSection}>
          <FlatList data={BANNERS_META} keyExtractor={b=>String(b.id)} horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal:20 }}
            renderItem={({ item }) => <BannerCard item={item} t={t}/>}/>
        </View>

        {/* ── QUARTER CARD ── */}
        <View style={s.section}>
          <QuarterCard
            cat={cat}
            quarterInfo={quarterInfo}
            tk={tk}
            t={t}
            onPress={() => navigation.navigate(safeRoute, { category:cat })}
          />
        </View>

        {/* ── AGE GROUP SELECTOR (replaces quick-action buttons) ── */}
        <View style={s.section}>
          <SectionHeader title={t('age_group', 'Age Group')} tk={tk}/>
          <View style={s.ageRow}>
            {CATEGORIES.map((c, i) => {
              const locked = isSubscribed && !canAccessCategory(c.id);
              return (
                <AgeGroupCard
                  key={c.id}
                  item={c}
                  index={i}
                  active={categoryId === c.id}
                  locked={locked}
                  onPress={() => {
                    if (locked) {
                      const subbedCat = CATEGORIES.find(x => x.id === subscribedCategory);
                      const subbedLbl = subbedCat ? t(`cat_${subbedCat.id}`, subbedCat.label) : t('home_subscribed', 'subscribed');
                      const targetLbl = t(`cat_${c.id}`, c.label);
                      Alert.alert(
                        t('category_locked', 'Category Locked'),
                        t('home_locked_alert_msg', 'Your ₦500 plan only unlocks the {label} category. Upgrade to All Categories (₦1,000) to access {target}.')
                          .replace('{label}', subbedLbl)
                          .replace('{target}', targetLbl),
                        [
                          { text: t('btn_not_now', 'Not now'), style: 'cancel' },
                          { text: t('upgrade', 'Upgrade'), onPress: () => navigation.navigate('PaymentScreen') },
                        ],
                      );
                      return;
                    }
                    setCategoryId(c.id);
                    navigation.navigate(c.route || 'SecondPage', { category:c });
                  }}
                  tk={tk}
                  t={t}
                />
              );
            })}
          </View>
        </View>

        {/* ── RECENT LESSONS ── */}
        <View style={s.section}>
          <SectionHeader
            title={isRecentMode ? t('recently_visited', 'Recently Visited') : t('recent_lessons', 'Recent Lessons')}
            action={t('view_all', 'View All →')}
            onAction={() => navigation.navigate(safeRoute, { category:cat })}
            tk={tk}
          />
          <View style={[s.card, { backgroundColor:tk.glassFill, borderColor:tk.glassEdge }]}>
            {lessonsLoading && !isRecentMode ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={BLUE} size="small"/>
                <Text style={[s.loadingText, { color:tk.textMuted }]}>{t('home_loading_lessons', 'Loading lessons…')}</Text>
              </View>
            ) : displayedLessons.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={{ fontSize:36, marginBottom:10 }}>📖</Text>
                <Text style={[s.emptyText, { color:tk.textMuted }]}>
                  {t('home_no_recent', 'No recently visited lessons yet.')}
                </Text>
                <Text style={[s.emptyHint, { color:tk.textMuted }]}>
                  {t('home_open_lesson_hint', 'Open a lesson and it will appear here.')}
                </Text>
              </View>
            ) : (
              displayedLessons.slice(0, 5).map((lesson, i) => (
                <LessonRow
                  key={lesson.id || i}
                  lesson={lesson}
                  tk={tk}
                  isLast={i === Math.min(displayedLessons.length, 5) - 1}
                  onPress={() => {
                    if (isRecentMode && lesson.id) {
                      navigation.navigate('LessonPage', { items:lesson, category:cat });
                    } else {
                      navigation.navigate(safeRoute, { category:cat });
                    }
                  }}
                />
              ))
            )}
          </View>
          {isRecentMode && (
            <Text style={[s.recentHint, { color:tk.textMuted }]}>
              {(recentLessons.length === 1
                ? t('home_recent_count_one',  'Showing your last visited lesson')
                : t('home_recent_count_many', 'Showing your last {n} visited lessons').replace('{n}', String(Math.min(recentLessons.length, 5))))}
            </Text>
          )}
        </View>

        {/* ── QUICK ACCESS ── */}
        <View style={s.section}>
          <SectionHeader title={t('quick_access', 'Quick Actions')} tk={tk}/>
          <View style={s.qaGrid}>
            {QUICK_ACCESS.map((item, i) => (
              <TouchableOpacity key={i} onPress={item.onPress} activeOpacity={0.78}
                style={[s.qaItem, {
                  backgroundColor: tk.glassFill,
                  borderColor:     tk.glassEdge,
                  opacity:         item.locked ? 0.55 : 1,
                }]}>
                <View style={[s.qaIcon, { backgroundColor: isDark ? tk.surfaceEl : item.bg }]}>
                  <Text style={{ fontSize:26 }}>{item.icon}</Text>
                  {item.locked && (
                    <View style={s.qaLockOverlay}>
                      <ICONS.Lock color="#fff" size={14} sw={2.2} />
                    </View>
                  )}
                </View>
                <Text style={[s.qaLabel, { color:tk.textPrimary }]}>{item.label}</Text>
                <Text style={[s.qaSub,   { color:tk.textMuted }]}>{item.sub}</Text>
                {item.locked && (
                  <View style={[s.qaLockedPill, { backgroundColor: tk.surfaceEl, borderColor: tk.glassEdge, flexDirection:'row', alignItems:'center', gap:6 }]}>
                    <ICONS.Lock color={tk.textMuted} size={11} sw={2.2} />
                    <Text style={[s.qaLockedTxt, { color: tk.textMuted }]}>{t('home_coming_soon_pill','Coming Soon')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <Text style={[s.footerTxt, { color:tk.textMuted }]}>{t('login_footer', '© Gospelar Sunday School Department')}</Text>
          <Text style={[s.footerSite, { color:BLUE }]}>www.gospelar.com</Text>
        </View>

      </Animated.ScrollView>

      {/* ── TAB BAR ──
          Four tabs: Home · Lessons · Notes · Stats. Settings lives on the
          Library home so it's reachable from every book in one place. */}
      <AppTabBar
        activeTab={activeTab}
        onTab={handleTab}
        tk={tk}
        tabs={[
          { key: 'Home',    label: t('tab_home',    'Home') },
          { key: 'Lessons', label: t('tab_lessons', 'Lessons') },
          { key: 'Notes',   label: t('tab_notes',   'Notes') },
          { key: 'Stats',   label: t('tab_progress', 'Progress') },
        ]}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:         { flex:1 },
  scrollContent:{ paddingBottom:110 },

  // Top bar
  topbar:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:10, paddingBottom:20 },
  userRow:      { flexDirection:'row', alignItems:'center', gap:12 },
  avatar:       { width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center' },
  avatarLetter: { color:'#fff', fontSize:17, fontWeight:'900' },
  greeting:     { fontSize:11, fontWeight:'500', marginBottom:2 },
  userName:     { fontSize:17, fontWeight:'900' },
  topActions:   { flexDirection:'row', gap:8 },
  iconBtn:      { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },

  // Banners
  bannerSection:{ marginBottom:28 },

  // Sections — consistent 28px bottom margin
  section:      { paddingHorizontal:20, marginBottom:28 },

  // Age group row
  ageRow:       { flexDirection:'row', flexWrap:'wrap', gap:12 },

  // Recent lessons card
  card:         { borderRadius:18, borderWidth:1, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },
  loadingBox:   { padding:32, alignItems:'center', gap:10 },
  loadingText:  { fontSize:13 },
  emptyBox:     { padding:32, alignItems:'center' },
  emptyText:    { fontSize:14, fontWeight:'600', textAlign:'center', marginBottom:6 },
  emptyHint:    { fontSize:12, textAlign:'center' },
  recentHint:   { fontSize:11, marginTop:8, textAlign:'center', fontStyle:'italic' },

  // Quick access 2×2 grid
  qaGrid:   { flexDirection:'row', flexWrap:'wrap', gap:14 },
  qaItem:   { width:(width-54)/2, borderRadius:18, borderWidth:1, padding:18, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:8, elevation:1 },
  qaIcon:   { width:52, height:52, borderRadius:16, justifyContent:'center', alignItems:'center', marginBottom:12, position:'relative' },
  qaLabel:  { fontSize:15, fontWeight:'800', marginBottom:4 },
  qaSub:    { fontSize:12, lineHeight:17 },
  qaLockOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(13,15,18,0.55)', borderRadius:16, justifyContent:'center', alignItems:'center' },
  qaLockIcon:   { fontSize:18 },
  qaLockedPill: { alignSelf:'flex-start', borderRadius:8, paddingHorizontal:8, paddingVertical:3, marginTop:8, borderWidth:1 },
  qaLockedTxt:  { fontSize:9, fontWeight:'900', letterSpacing:.5 },

  // Footer
  footer:    { alignItems:'center', paddingHorizontal:20, paddingTop:8, paddingBottom:10 },
  footerTxt: { fontSize:11, marginBottom:5 },
  footerSite:{ fontSize:12, fontWeight:'800' },
});