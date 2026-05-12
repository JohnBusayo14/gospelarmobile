// screens/ProgressScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Combined progress dashboard — Sunday School.
//   • Twin hero cards: Quiz Average  +  Reading Streak
//   • Today's Devotional card with the 2-min point rule explicit on screen
//   • Tab pills: Quizzes · Reading · Leaderboard
//       Quizzes     — lesson rows with score / grade pill
//       Reading     — 35-day calendar heatmap + recent log
//       Leaderboard — XP-based reading leaderboard
//   • Mini-stats footer row (days / week / month / XP)
// Data sources:
//   GET /api/progress/:email           — quiz/lesson scores
//   GET /api/reading/stats/:email      — streak, XP, badges
//   GET /api/reading/calendar/:email   — 35-day heatmap
//   GET /api/reading/leaderboard       — XP leaderboard
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, Animated, RefreshControl, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage     from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient as SvgLG, Stop } from 'react-native-svg';

import { API_BASE_URL } from '../services/api';
import { useTheme }     from '../context/ThemeContext';
import { useLanguage }  from '../context/LanguageContext';
import AppTabBar        from '../components/AppTabBar';
import { ICONS }        from '../components/icons';
import { getTokens, type, radii, PALETTE } from '../theme/tokens';
import { bookTones } from '../theme/bookSurfaces';
import {
  useScreenEntry, useStaggerEntry, useCountUp, useAnimatedWidth,
} from '../hooks/useFluidAnim';
import {
  fetchReadingStats, fetchReadingCalendar, fetchReadingLeaderboard,
} from '../services/reading';

const API = API_BASE_URL;

// Brand palette — keep the same blue identity as the rest of the SS book.
const PRIMARY      = PALETTE.blue;
const PRIMARY_DEEP = '#0E3FB0';
const ON_PRIMARY   = '#FFFFFF';
const AMBER        = '#F59E0B';
const SLATE        = '#94A3B8';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Grading scale for quiz percentage → A/B/C/D/F + color.
const grade = (pct) => {
  if (pct >= 90) return { label:'A', color: PALETTE.green };
  if (pct >= 75) return { label:'B', color: PALETTE.blue  };
  if (pct >= 60) return { label:'C', color: PALETTE.amber };
  if (pct >= 45) return { label:'D', color: PALETTE.red   };
  return                   { label:'F', color: '#9CA3AF'  };
};

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ HERO — average score with animated bar and three sub-stats.
// ─────────────────────────────────────────────────────────────────────────────
const QuizHero = ({ pct, completed, total, points, myRank, tk, isDark, t }) => {
  const animPct    = useCountUp(pct, 900);
  const animPoints = useCountUp(points, 900);
  const ringWidth  = useAnimatedWidth(pct, 900);
  const ringColor =
    pct >= 75 ? PALETTE.green :
    pct >= 50 ? PALETTE.lime  :
                PALETTE.amber;

  return (
    <View style={[h.card, { backgroundColor: tk.glassFill, borderColor: tk.glassEdge }]}>
      <View style={h.topRow}>
        <View style={[h.iconBox, { backgroundColor: '#0F2348' }]}>
          <Text style={{ fontSize: 22 }}>🏆</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[type.caption, { color: tk.textMuted, letterSpacing: 1.4 }]}>
            {t('progress_avg', 'Quiz Average').toUpperCase()}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: '900', color: tk.textPrimary, marginTop: 2, letterSpacing: -1 }}>
            {Math.round(animPct)}%
          </Text>
        </View>
      </View>

      <View style={[h.barTrack, { backgroundColor: isDark ? '#000' : tk.surfaceEl }]}>
        <Animated.View style={[h.barFill, { width: ringWidth, backgroundColor: ringColor }]} />
      </View>

      <View style={[h.subRow, { borderTopColor: isDark ? '#000' : tk.glassEdge }]}>
        <View style={h.subStat}>
          <Text style={[type.caption, { color: tk.textMuted }]}>
            {t('progress_completed', 'Lessons')}
          </Text>
          <Text style={[h.subVal, { color: tk.textPrimary }]}>{completed}/{total}</Text>
        </View>
        <View style={[h.subDiv, { backgroundColor: isDark ? '#000' : tk.glassEdge }]} />
        <View style={h.subStat}>
          <Text style={[type.caption, { color: tk.textMuted }]}>
            {t('progress_points', 'Points')}
          </Text>
          <Text style={[h.subVal, { color: tk.textPrimary }]}>{Math.round(animPoints)}</Text>
        </View>
        <View style={[h.subDiv, { backgroundColor: isDark ? '#000' : tk.glassEdge }]} />
        <View style={h.subStat}>
          <Text style={[type.caption, { color: tk.textMuted }]}>
            {t('progress_rank', 'Rank')}
          </Text>
          <Text style={[h.subVal, { color: tk.textPrimary }]}>{myRank ? `#${myRank}` : '—'}</Text>
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// READING HERO — circular streak ring, total days / this week / this month.
// ─────────────────────────────────────────────────────────────────────────────
const ReadingHero = ({ streak, longest, totalDays, thisWeek, thisMonth, xp, tk, isDark, t }) => {
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const goal = streak < 7 ? 7 : streak < 30 ? 30 : streak < 100 ? 100 : 365;
  const pct  = Math.min(1, streak / Math.max(1, goal));

  const anim = useRef(new Animated.Value(C)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: C * (1 - pct),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [pct, C, anim]);

  const animStreak = useCountUp(streak, 900);
  const animXp     = useCountUp(xp, 900);
  const trackColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)';

  return (
    <View style={[h.card, { backgroundColor: tk.glassFill, borderColor: tk.glassEdge }]}>
      <View style={h.topRow}>
        <View style={{ width: size, height: size, alignItems:'center', justifyContent:'center' }}>
          <Svg width={size} height={size}>
            <Defs>
              <SvgLG id="rdRing" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#3B82F6" />
                <Stop offset="1" stopColor={PRIMARY_DEEP} />
              </SvgLG>
            </Defs>
            <Circle cx={size/2} cy={size/2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
            <AnimatedCircle
              cx={size/2} cy={size/2} r={r}
              stroke="url(#rdRing)" strokeWidth={stroke} fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C} ${C}`}
              strokeDashoffset={anim}
              transform={`rotate(-90 ${size/2} ${size/2})`}
            />
          </Svg>
          <View style={{ position:'absolute', alignItems:'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: tk.textPrimary, letterSpacing: -0.5 }}>
              {Math.round(animStreak)}
            </Text>
            <Text style={{ fontSize: 9, fontWeight: '800', color: tk.textMuted, letterSpacing: 1 }}>
              {t('progress_day_streak', 'DAYS')}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[type.caption, { color: tk.textMuted, letterSpacing: 1.4 }]}>
            {t('progress_reading_streak', 'Reading Streak').toUpperCase()}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: tk.textPrimary, marginTop: 4 }}>
            🔥 {t('progress_longest', 'Longest')}: {longest} {longest === 1 ? t('progress_day_one','day') : t('progress_days','days')}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: tk.textSec, marginTop: 4 }}>
            {Math.round(animXp).toLocaleString()} XP
          </Text>
        </View>
      </View>

      <View style={[h.subRow, { borderTopColor: isDark ? '#000' : tk.glassEdge }]}>
        <View style={h.subStat}>
          <Text style={[type.caption, { color: tk.textMuted }]}>
            {t('progress_total_days', 'Total')}
          </Text>
          <Text style={[h.subVal, { color: tk.textPrimary }]}>{totalDays}</Text>
        </View>
        <View style={[h.subDiv, { backgroundColor: isDark ? '#000' : tk.glassEdge }]} />
        <View style={h.subStat}>
          <Text style={[type.caption, { color: tk.textMuted }]}>
            {t('progress_this_week', 'Week')}
          </Text>
          <Text style={[h.subVal, { color: tk.textPrimary }]}>{thisWeek}</Text>
        </View>
        <View style={[h.subDiv, { backgroundColor: isDark ? '#000' : tk.glassEdge }]} />
        <View style={h.subStat}>
          <Text style={[type.caption, { color: tk.textMuted }]}>
            {t('progress_this_month', 'Month')}
          </Text>
          <Text style={[h.subVal, { color: tk.textPrimary }]}>{thisMonth}</Text>
        </View>
      </View>
    </View>
  );
};

const h = StyleSheet.create({
  card:    { borderRadius: radii.xl, padding: 18, borderWidth: 1 },
  topRow:  { flexDirection:'row', alignItems:'center' },
  iconBox: { width: 56, height: 56, borderRadius: 18, justifyContent:'center', alignItems:'center' },
  barTrack:{ height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 16 },
  barFill: { height: 6, borderRadius: 3 },
  subRow:  { flexDirection:'row', alignItems:'center', borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  subStat: { flex: 1, alignItems: 'center' },
  subVal:  { fontSize: 15, fontWeight: '900', marginTop: 4, letterSpacing: -0.3 },
  subDiv:  { width: 1, height: 28 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TODAY DEVOTIONAL CARD — surfaces today's status + the 2-minute rule.
// ─────────────────────────────────────────────────────────────────────────────
const TodayCard = ({ stats, onOpen, tk, isDark, t }) => {
  const checked = !!stats?.checked_in_today;
  const todayRow = stats?.today
    || (stats?.recent_log || []).find(r => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const dd= String(d.getDate()).padStart(2,'0');
      return (r.reading_date || '').slice(0,10) === `${y}-${m}-${dd}`;
    });
  const mins = Math.round(((todayRow?.duration_seconds) || 0) / 60);

  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85}
      style={[td.card, {
        backgroundColor: tk.glassFill,
        borderColor: checked ? '#10B98140' : tk.glassEdge,
      }]}>
      <View style={td.row}>
        <View style={[td.iconBox, { backgroundColor: checked ? '#D1FAE5' : '#EFF6FF' }]}>
          {checked
            ? <ICONS.CheckCircle color="#10B981" size={24} sw={2.2} />
            : <ICONS.Book        color={PRIMARY}  size={22} sw={2.2} />}
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: tk.textPrimary }}>
            {checked
              ? t('progress_today_done', "Today's reading complete")
              : t('progress_today_pending', "Haven't read today yet")}
          </Text>
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: tk.textSec, marginTop: 3 }}>
            {checked
              ? `${mins > 0 ? `${mins} min · ` : ''}${t('progress_streak_plus', 'Streak +1')}`
              : t('progress_open_devotional', 'Open today\'s devotional →')}
          </Text>
        </View>
      </View>

      {/* 2-min rule explainer — non-negotiable surfacing so the user knows
          why opening the page doesn't immediately award a point. */}
      <View style={[td.ruleRow, { backgroundColor: isDark ? 'rgba(245,158,11,0.10)' : '#FEF3C7' }]}>
        <Text style={{ fontSize: 14, marginRight: 6 }}>⏱️</Text>
        <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: isDark ? '#FDE68A' : '#92400E' }}>
          {t('progress_two_min_rule',
             'Spend at least 2 minutes actively reading the daily devotional to earn your point for the day.')}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
const td = StyleSheet.create({
  card:    { borderRadius: radii.xl, padding: 16, borderWidth: 1 },
  row:     { flexDirection:'row', alignItems:'center' },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent:'center', alignItems:'center' },
  ruleRow: { flexDirection:'row', alignItems:'center', marginTop: 14, padding: 10, borderRadius: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LESSON ROW — quiz score per lesson.
// ─────────────────────────────────────────────────────────────────────────────
const LessonRow = ({ item, index, tk, isDark }) => {
  const { fade, translateY } = useStaggerEntry(index);
  const barWidth = useAnimatedWidth(item.percent, 700 + index * 30);
  const g = grade(item.percent);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <View style={[lr.row, { backgroundColor: tk.glassFill }]}>
        <View style={[lr.numBox, { backgroundColor: isDark ? '#000' : tk.surfaceEl }]}>
          <Text style={[lr.num, { color: tk.textPrimary }]}>
            {String(item.lessonNumber).padStart(2,'0')}
          </Text>
        </View>
        <View style={lr.body}>
          <Text style={[lr.title, { color: tk.textPrimary }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[lr.barTrack, { backgroundColor: isDark ? '#000' : tk.glassEdge }]}>
            <Animated.View style={[lr.barFill, { width: barWidth, backgroundColor: g.color }]} />
          </View>
          <Text style={[lr.meta, { color: tk.textMuted }]}>
            {item.bestScore}/{item.totalQuestions} · {item.percent}%
          </Text>
        </View>
        <View style={[lr.gradePill, { backgroundColor: g.color + '22' }]}>
          <Text style={[lr.gradeTxt, { color: g.color }]}>{g.label}</Text>
        </View>
      </View>
    </Animated.View>
  );
};
const lr = StyleSheet.create({
  row:       { flexDirection:'row', alignItems:'center', padding: 14, borderRadius: radii.lg, marginBottom: 10 },
  numBox:    { width: 44, height: 44, borderRadius: 12, justifyContent:'center', alignItems:'center', marginRight: 12 },
  num:       { fontSize: 14, fontWeight: '900', letterSpacing: -0.3 },
  body:      { flex: 1, marginRight: 12 },
  title:     { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  barTrack:  { height: 5, borderRadius: 3, overflow:'hidden', marginBottom: 6 },
  barFill:   { height: 5, borderRadius: 3 },
  meta:      { fontSize: 11, fontWeight: '600' },
  gradePill: { width: 38, height: 38, borderRadius: 12, justifyContent:'center', alignItems:'center' },
  gradeTxt:  { fontSize: 16, fontWeight: '900' },
});

// ─────────────────────────────────────────────────────────────────────────────
// READING CALENDAR — 35-day heatmap. Devotional = amber, lesson = blue, manual = slate.
// ─────────────────────────────────────────────────────────────────────────────
const ReadingCalendar = ({ days, tk, isDark, t }) => {
  const rows = 5, cols = 7;
  const totalCells = rows * cols;
  const tail   = (days || []).slice(-totalCells);
  const padded = [...new Array(Math.max(0, totalCells - tail.length)).fill(null), ...tail];

  const colorFor = (cell) => {
    if (!cell || !cell.checked_in) return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    if (cell.source_type === 'devotional') return AMBER;
    if (cell.source_type === 'manual')     return SLATE;
    return PRIMARY;
  };

  const [tip, setTip] = useState(null);

  return (
    <View>
      <View style={cal.legendRow}>
        <Legend dot={PRIMARY} label={t('progress_legend_lesson',     'Lesson')}     tk={tk}/>
        <Legend dot={AMBER}   label={t('progress_legend_devotional', 'Devotional')} tk={tk}/>
        <Legend dot={SLATE}   label={t('progress_legend_manual',     'Manual')}     tk={tk}/>
      </View>
      <View style={cal.grid}>
        {padded.map((cell, i) => (
          <Pressable
            key={i}
            onPress={() => setTip(cell)}
            style={[cal.cell, { backgroundColor: colorFor(cell), opacity: cell ? 1 : 0.6 }]}
          />
        ))}
      </View>
      {tip && (
        <View style={{ marginTop: 12, alignItems:'center' }}>
          <Text style={{ fontSize: 12, fontWeight:'700', color: tk.textPrimary }}>
            {tip.date} —{' '}
            {tip.checked_in
              ? `${Math.max(1, Math.round((tip.duration_seconds||0)/60))} min · ${tip.source_type}`
              : t('progress_no_reading', 'No reading')}
          </Text>
        </View>
      )}
    </View>
  );
};
const Legend = ({ dot, label, tk }) => (
  <View style={{ flexDirection:'row', alignItems:'center', gap: 5 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
    <Text style={{ fontSize: 10, fontWeight:'700', color: tk.textMuted }}>{label}</Text>
  </View>
);
const cal = StyleSheet.create({
  legendRow: { flexDirection:'row', justifyContent:'flex-end', gap: 10, marginBottom: 12 },
  grid:      { flexDirection:'row', flexWrap:'wrap', gap: 8 },
  cell:      { width: 34, height: 34, borderRadius: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LEADER ROW — combined leaderboard (XP-driven from reading).
// ─────────────────────────────────────────────────────────────────────────────
const LeaderRow = ({ item, myEmail, index, tk, isDark, t }) => {
  const { fade, translateY } = useStaggerEntry(index);
  const isMe   = item.email && myEmail && item.email.toLowerCase() === String(myEmail).toLowerCase();
  const rank   = index + 1;
  const medal  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const name   = item.display_name || (item.email || '').replace(/(.{2}).+(@.+)/, '$1•••$2');

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <View style={[lr.row, {
        backgroundColor: isMe ? PRIMARY + '14' : tk.glassFill,
        borderWidth:     isMe ? 1 : 0,
        borderColor:     isMe ? PRIMARY + '40' : 'transparent',
      }]}>
        <View style={[lr.numBox, { backgroundColor: isDark ? '#000' : tk.surfaceEl }]}>
          {medal
            ? <Text style={{ fontSize: 22 }}>{medal}</Text>
            : <Text style={[lr.num, { color: tk.textSec }]}>#{rank}</Text>}
        </View>
        <View style={lr.body}>
          <Text style={[lr.title, { color: tk.textPrimary }]} numberOfLines={1}>
            {item.avatar_emoji || '👤'}  {name}{isMe ? ` ${t('progress_you_suffix', '(You)')}` : ''}
          </Text>
          <Text style={[lr.meta, { color: tk.textMuted }]}>
            🔥 {item.current_streak || 0}d  ·  Lv {item.level || 1}
          </Text>
        </View>
        <View style={[lb.pts, { backgroundColor: PRIMARY + '20' }]}>
          <Text style={lb.ptsTxt}>⭐ {Number(item.lifetime_xp || 0).toLocaleString()}</Text>
        </View>
      </View>
    </Animated.View>
  );
};
const lb = StyleSheet.create({
  pts:    { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  ptsTxt: { fontSize: 12, fontWeight: '900', color: PRIMARY_DEEP },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProgressScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => ({ ...getTokens(isDark), ...bookTones(isDark) }), [isDark]);

  const [email,       setEmail]       = useState(null);
  const [progress,    setProgress]    = useState(null);
  const [stats,       setStats]       = useState(null);
  const [calendar,    setCalendar]    = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('quizzes');

  const { fade, translateY } = useScreenEntry();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const em = await AsyncStorage.getItem('userEmail');
      setEmail(em);
      if (!em) { setLoading(false); return; }

      // Fire all four in parallel. Reading endpoints are cacheFirst so they
      // return instantly from cache then revalidate in the background.
      const [pr, st, cl, lb] = await Promise.all([
        fetch(`${API}/api/progress/${encodeURIComponent(em)}`).then(r => r.json()).catch(() => null),
        fetchReadingStats(em).catch(() => null),
        fetchReadingCalendar(em, 35).catch(() => null),
        fetchReadingLeaderboard('global', 'all').catch(() => null),
      ]);
      setProgress(pr || { lessons: [] });
      setStats(st);
      setCalendar(cl?.calendar || cl?.days || (Array.isArray(cl) ? cl : []));
      setLeaderboard(lb?.leaders || lb?.rows || (Array.isArray(lb) ? lb : []));
    } catch (e) {
      console.warn('[Progress] load failed', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Derived metrics.
  const quizPct       = progress?.averagePercent ?? (progress?.lessons?.length
    ? Math.round(progress.lessons.reduce((s,l)=>s+(l.percent||0),0) / progress.lessons.length)
    : 0);
  const completed     = progress?.completedCount ?? (progress?.lessons?.length || 0);
  const totalLessons  = progress?.totalLessons   ?? 0;
  const points        = progress?.totalPoints    ?? 0;
  const myQuizRank    = progress?.rank ?? null;

  const streak    = stats?.current_streak ?? 0;
  const longest   = stats?.longest_streak ?? 0;
  const totalDays = stats?.total_days_read ?? 0;
  const thisWeek  = stats?.this_week ?? 0;
  const thisMonth = stats?.this_month ?? 0;
  const xp        = stats?.lifetime_xp ?? 0;

  // Sunday School devotional doesn't carry a single deep-link day, so we
  // bounce the user back to the SS home where they pick today's lesson.
  const openTodaysDevotional = () => navigation.navigate('HomeScreen');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.pageBg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.pageBg} />

      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY }] }}>

        {/* TOP BAR — back arrow only. Settings reachable from Library home. */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}
            style={s.back}>
            <Text style={[s.backTxt, { color: tk.textPrimary }]}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 130, paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load}
            tintColor={tk.textSec} colors={[PRIMARY]} />}>

          {/* Title */}
          <Text style={[type.h1, { color: tk.textPrimary, marginTop: 8 }]}>
            {t('progress_my_progress', 'My Progress')}
          </Text>
          <Text style={[type.body, { color: tk.textSec, marginTop: 6, marginBottom: 22 }]}>
            {t('progress_intro', 'Track your daily devotional reading and Sunday School quiz scores.')}
          </Text>

          {loading && (
            <View style={{ paddingVertical: 80, alignItems: 'center' }}>
              <ActivityIndicator color={PRIMARY} size="large" />
              <Text style={{ marginTop: 12, color: tk.textMuted, fontSize: 13, fontWeight:'600' }}>
                {t('progress_loading', 'Loading your progress…')}
              </Text>
            </View>
          )}

          {/* HERO STACK — Quiz on top, Reading underneath. */}
          {!loading && (
            <>
              <QuizHero
                pct={quizPct}
                completed={completed}
                total={totalLessons}
                points={points}
                myRank={myQuizRank}
                tk={tk}
                isDark={isDark}
                t={t}
              />
              <View style={{ height: 12 }} />
              <ReadingHero
                streak={streak}
                longest={longest}
                totalDays={totalDays}
                thisWeek={thisWeek}
                thisMonth={thisMonth}
                xp={xp}
                tk={tk}
                isDark={isDark}
                t={t}
              />

              {/* TODAY DEVOTIONAL — explicit 2-min rule. */}
              <View style={{ marginTop: 14 }}>
                <TodayCard
                  stats={stats}
                  onOpen={openTodaysDevotional}
                  tk={tk}
                  isDark={isDark}
                  t={t}
                />
              </View>

              {/* TAB PILLS */}
              <View style={[s.tabPills, { backgroundColor: tk.glassFill }]}>
                {[
                  { k: 'quizzes',     icon: '📊', label: t('progress_tab_quizzes',     'Quizzes') },
                  { k: 'reading',     icon: '🌅', label: t('progress_tab_reading',     'Reading') },
                  { k: 'leaderboard', icon: '🏆', label: t('progress_leaderboard',     'Leaders') },
                ].map(({ k, icon, label }) => {
                  const active = tab === k;
                  return (
                    <TouchableOpacity key={k} onPress={() => setTab(k)} activeOpacity={0.85}
                      style={[s.tabPill, { backgroundColor: active ? PRIMARY : 'transparent' }]}>
                      <Text style={{ fontSize: 14 }}>{icon}</Text>
                      <Text style={[s.tabPillTxt, {
                        color: active ? ON_PRIMARY : tk.textSec,
                      }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* QUIZZES */}
              {tab === 'quizzes' && (
                (progress?.lessons?.length === 0 || !progress)
                  ? (
                    <View style={s.emptyWrap}>
                      <Text style={{ fontSize: 56, marginBottom: 16 }}>📝</Text>
                      <Text style={[type.h2, { color: tk.textPrimary, textAlign:'center' }]}>
                        {t('progress_no_quizzes', 'No quizzes yet')}
                      </Text>
                      <Text style={[type.body, { color: tk.textMuted, textAlign:'center', marginTop: 8, marginBottom: 22 }]}>
                        {t('progress_complete_quiz_msg', 'Complete a lesson quiz to see your scores.')}
                      </Text>
                      <TouchableOpacity onPress={() => navigation.navigate('HomeScreen')}
                        style={[s.cta, { backgroundColor: PRIMARY }]} activeOpacity={0.85}>
                        <Text style={s.ctaTxt}>{t('progress_start_studying', 'Start Studying')} →</Text>
                      </TouchableOpacity>
                    </View>
                  )
                  : (
                    <>
                      <Text style={[type.label, { color: tk.textMuted, marginTop: 24, marginBottom: 12 }]}>
                        {t('progress_lesson_scores', 'LESSON SCORES')}
                      </Text>
                      {progress.lessons.map((item, i) => (
                        <LessonRow key={item.lessonId} item={item} index={i} tk={tk} isDark={isDark}/>
                      ))}
                    </>
                  )
              )}

              {/* READING */}
              {tab === 'reading' && (
                <>
                  <Text style={[type.label, { color: tk.textMuted, marginTop: 24, marginBottom: 12 }]}>
                    {t('progress_last_35', 'LAST 35 DAYS')}
                  </Text>
                  <View style={[s.readingCard, { backgroundColor: tk.glassFill, borderColor: tk.glassEdge }]}>
                    <ReadingCalendar days={calendar} tk={tk} isDark={isDark} t={t}/>
                  </View>

                  <Text style={[type.label, { color: tk.textMuted, marginTop: 18, marginBottom: 12 }]}>
                    {t('progress_recent_sessions', 'RECENT SESSIONS')}
                  </Text>
                  <View style={[s.readingCard, { backgroundColor: tk.glassFill, borderColor: tk.glassEdge }]}>
                    {(stats?.recent_log || []).slice(0, 7).map((rg, i) => (
                      <View key={i} style={[s.logRow, {
                        borderBottomWidth: i < Math.min((stats.recent_log || []).length, 7) - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                      }]}>
                        <View style={{ flexDirection:'row', alignItems:'center', gap: 10 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4,
                            backgroundColor: rg.source_type === 'devotional' ? AMBER : rg.source_type === 'manual' ? SLATE : PRIMARY }} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: tk.textPrimary }}>
                            {String(rg.reading_date).slice(0,10)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: tk.textMuted, fontWeight: '600' }}>
                          {Math.max(1, Math.round((rg.duration_seconds || 0)/60))} {t('progress_min','min')} · {rg.source_type}
                        </Text>
                      </View>
                    ))}
                    {(!stats?.recent_log || stats.recent_log.length === 0) && (
                      <Text style={{ color: tk.textMuted, fontSize: 13, padding: 6 }}>
                        {t('progress_recent_empty', 'Once you start reading, your last sessions will appear here.')}
                      </Text>
                    )}
                  </View>
                </>
              )}

              {/* LEADERBOARD */}
              {tab === 'leaderboard' && (
                <>
                  <Text style={[type.label, { color: tk.textMuted, marginTop: 24, marginBottom: 12 }]}>
                    {t('progress_top_learners', 'TOP LEARNERS')}
                  </Text>
                  {leaderboard.length === 0 ? (
                    <View style={s.emptyWrap}>
                      <Text style={{ fontSize: 56, marginBottom: 16 }}>🏆</Text>
                      <Text style={[type.h2, { color: tk.textPrimary, textAlign:'center' }]}>
                        {t('progress_no_scores', 'No scores yet')}
                      </Text>
                      <Text style={[type.body, { color: tk.textMuted, textAlign:'center', marginTop: 8 }]}>
                        {t('progress_be_first', 'Be the first to complete a quiz!')}
                      </Text>
                    </View>
                  ) : leaderboard.map((item, i) => (
                    <LeaderRow key={item.email || i} item={item} myEmail={email} index={i} tk={tk} isDark={isDark} t={t}/>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>

      </Animated.View>

      {/* BOTTOM TAB BAR — Progress is the 4th tab. We keep `Stats` as the
          icon key so the SVG icon already registered in components/icons.js
          continues to render without needing a new entry. */}
      <AppTabBar
        activeTab={3}
        onTab={(i) => {
          if (i === 0) navigation.navigate('HomeScreen');
          if (i === 1) navigation.navigate('SecondPage', { category: { id:'adult', route:'SecondPage' } });
          if (i === 2) navigation.navigate('Notes');
        }}
        tk={tk}
        tabs={[
          { key:'Home',     label: t('tab_home',     'Home')     },
          { key:'Lessons',  label: t('tab_lessons',  'Lessons')  },
          { key:'Notes',    label: t('tab_notes',    'Notes')    },
          { key:'Stats',    label: t('tab_progress', 'Progress') },
        ]}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  topbar:   { flexDirection:'row', alignItems:'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  back:     { width: 36, height: 36, justifyContent:'center', alignItems:'flex-start' },
  backTxt:  { fontSize: 22, fontWeight: '600' },

  tabPills:    { flexDirection:'row', borderRadius: radii.lg, padding: 5, marginTop: 22, gap: 4 },
  tabPill:     { flex: 1, flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical: 11, borderRadius: 12, gap: 8 },
  tabPillTxt:  { fontSize: 12, fontWeight: '800' },

  readingCard: { borderRadius: radii.xl, padding: 16, borderWidth: 1 },
  logRow:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical: 10 },

  emptyWrap:   { alignItems:'center', paddingVertical: 60 },
  cta:         { borderRadius: radii.lg, paddingHorizontal: 26, paddingVertical: 14 },
  ctaTxt:      { color: ON_PRIMARY, fontSize: 14, fontWeight: '900' },
});
