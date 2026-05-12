// screens/StatsScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Daily Reading Tracker + Gamification.
// Glassmorphic Clinical Warmth, blue primary. Pill-tabbed single screen:
//   Today  ·  Calendar  ·  Badges  ·  Leaderboard
// Plus an always-visible footer card with Total days / This week / This month / XP.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Animated, Pressable, ActivityIndicator, RefreshControl, Modal, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient as SvgLG, Stop } from 'react-native-svg';

import { useTheme }       from '../context/ThemeContext';
import { useLanguage }    from '../context/LanguageContext';
import { useSubscription } from '../context/SubscriptionContext';
import { getTokens, type, radii, space } from '../theme/tokens';
import {
  useScreenEntry, useStaggerEntry, useCountUp, useAnimatedWidth, usePressScale,
} from '../hooks/useFluidAnim';
import AppTabBar          from '../components/AppTabBar';
import { ICONS }          from '../components/icons';
import {
  fetchReadingStats, fetchReadingCalendar, fetchReadingLeaderboard,
  submitReadingCheckIn,
} from '../services/reading';

// Brand palette — blue primary per the spec.
const BLUE       = '#1A56DB';
const BLUE_DEEP  = '#1E40AF';
const BLUE_MID   = '#3B82F6';
const BLUE_LIGHT = '#EFF6FF';
const AMBER      = '#F59E0B';
const SLATE      = '#94A3B8';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─────────────────────────────────────────────────────────────────────────────
// Glassmorphic surface — translucent fill on top of a BlurView. Matches the
// "Glassmorphic Clinical Warmth" spec: ghost outline, no hard 1 px borders,
// 24 px radius for major panels.
// ─────────────────────────────────────────────────────────────────────────────
function Glass({ children, style, isDark, padding = 18, radius = 20 }) {
  const fill   = isDark ? 'rgba(20,28,46,0.70)' : 'rgba(255,255,255,0.70)';
  const stroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={isDark ? 38 : 50}
        tint={isDark ? 'dark' : 'light'}
        style={{ borderRadius: radius }}
      >
        <View
          style={{
            backgroundColor: fill,
            borderWidth:  1,
            borderColor:  stroke,
            borderRadius: radius,
            padding,
          }}
        >
          {children}
        </View>
      </BlurView>
    </View>
  );
}

// Soft blue mesh background — three stacked radial-ish gradients painted with
// LinearGradient (no extra deps).
function MeshBackground({ isDark }) {
  if (isDark) {
    return (
      <>
        <LinearGradient
          colors={['#0B1228', '#0A0E1F', '#08111E']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(26,86,219,0.18)', 'transparent']}
          style={[StyleSheet.absoluteFill, { top: -120 }]}
          start={{ x: 0.1, y: 0.1 }} end={{ x: 0.9, y: 0.6 }}
        />
      </>
    );
  }
  return (
    <>
      <LinearGradient
        colors={['#F0F5FF', '#FFFFFF', '#EAF1FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(26,86,219,0.10)', 'transparent']}
        style={[StyleSheet.absoluteFill, { top: -180 }]}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 0.7 }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Streak ring — circular SVG progress, animates strokeDashoffset 0 → 1.
// Centred number is the count-up of `current_streak`.
// ─────────────────────────────────────────────────────────────────────────────
function StreakRing({ streak, longest, tk, isDark, size = 168 }) {
  const stroke = 14;
  const r      = (size - stroke) / 2;
  const C      = 2 * Math.PI * r;

  // Goal is the next milestone — 7, 30, 100, then 365.
  const goal = streak < 7 ? 7 : streak < 30 ? 30 : streak < 100 ? 100 : 365;
  const pct  = Math.min(1, streak / goal);

  const anim = useRef(new Animated.Value(C)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: C * (1 - pct),
      duration: 1100,
      useNativeDriver: false,
    }).start();
  }, [pct, C, anim]);

  const animatedStreak = useCountUp(streak);
  const trackColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLG id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={BLUE_MID} />
            <Stop offset="1" stopColor={BLUE_DEEP} />
          </SvgLG>
        </Defs>
        <Circle cx={size/2} cy={size/2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size/2} cy={size/2} r={r}
          stroke="url(#ringGrad)" strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={anim}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <View style={{ position:'absolute', alignItems:'center' }}>
        <Text style={{ fontSize:11, fontWeight:'800', color: tk.textMuted, letterSpacing:1.5 }}>STREAK</Text>
        <Text style={{ fontSize:54, fontWeight:'900', color: tk.textPrimary, letterSpacing:-2 }}>
          {Math.round(animatedStreak)}
        </Text>
        <Text style={{ fontSize:12, fontWeight:'700', color: tk.textSec }}>
          🔥  Longest: {longest} {longest === 1 ? 'day' : 'days'}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// XP bar
// ─────────────────────────────────────────────────────────────────────────────
function XPBar({ level, xpIntoLevel, xpForNext, lifetimeXP, pct, tk, isDark }) {
  const width = useAnimatedWidth(pct);
  const trackColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)';
  const animXP = useCountUp(lifetimeXP);
  return (
    <View>
      <View style={{ flexDirection:'row', alignItems:'baseline', justifyContent:'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap: 8 }}>
          <View style={{ backgroundColor: BLUE, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ color:'#fff', fontWeight:'900', fontSize:12, letterSpacing:0.4 }}>Lv {level}</Text>
          </View>
          <Text style={{ color: tk.textPrimary, fontWeight:'800', fontSize: 14 }}>
            {Math.round(animXP).toLocaleString()} XP
          </Text>
        </View>
        <Text style={{ color: tk.textMuted, fontWeight:'700', fontSize: 11 }}>
          {xpIntoLevel} / {xpIntoLevel + xpForNext} to Lv {level + 1}
        </Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: trackColor, overflow:'hidden' }}>
        <Animated.View style={{ height: '100%', width, borderRadius: 999, overflow: 'hidden' }}>
          <LinearGradient
            colors={[BLUE_MID, BLUE_DEEP]}
            start={{ x:0, y:0 }} end={{ x:1, y:0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Today panel — checked-in vs not. Manual check-in CTA when not.
// ─────────────────────────────────────────────────────────────────────────────
function TodayPanel({ stats, onCheckIn, busy, tk, isDark }) {
  const press   = usePressScale();
  const checked = !!stats?.checked_in_today;
  const todayRow = stats?.today
    || (stats?.recent_log || []).find(r => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const dd= String(d.getDate()).padStart(2,'0');
      return (r.reading_date || '').slice(0,10) === `${y}-${m}-${dd}`;
    });

  if (checked) {
    const mins = Math.round(((todayRow?.duration_seconds) || 0) / 60);
    return (
      <Glass isDark={isDark} radius={24} padding={20}>
        <View style={{ flexDirection:'row', alignItems:'center', gap: 14 }}>
          <View style={{
            width: 56, height: 56, borderRadius: 16, backgroundColor: BLUE_LIGHT,
            alignItems:'center', justifyContent:'center',
          }}>
            <ICONS.CheckCircle color="#10B981" size={26} sw={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...type.h3, color: tk.textPrimary }}>Today's reading complete</Text>
            <Text style={{ marginTop: 2, fontSize: 13, color: tk.textSec, fontWeight:'600' }}>
              {mins > 0 ? `${mins} min today · ` : ''}Streak +1{todayRow?.source_type ? `  ·  Source: ${todayRow.source_type}` : ''}
            </Text>
          </View>
        </View>
      </Glass>
    );
  }

  return (
    <Glass isDark={isDark} radius={24} padding={20}>
      <Text style={{ ...type.h3, color: tk.textPrimary }}>Haven't read today yet</Text>
      <Text style={{ marginTop: 4, fontSize: 13, color: tk.textSec, fontWeight:'500' }}>
        Tap below to mark today complete and keep your streak alive.
      </Text>
      <Animated.View style={{ marginTop: 14, transform: [{ scale: press.scale }] }}>
        <Pressable
          onPress={onCheckIn} disabled={busy}
          onPressIn={press.onPressIn} onPressOut={press.onPressOut}
          style={{ borderRadius: 999, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[BLUE_MID, BLUE_DEEP]}
            start={{ x:0, y:0 }} end={{ x:1, y:1 }}
            style={{ paddingVertical: 14, paddingHorizontal: 22, alignItems:'center' }}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color:'#fff', fontWeight:'900', fontSize:15, letterSpacing:0.3 }}>Mark today complete</Text>
            }
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Glass>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar grid — last 35 days, 5 rows × 7 cols, dot tinted by source.
// ─────────────────────────────────────────────────────────────────────────────
function CalendarGrid({ days, tk, isDark }) {
  // Always render exactly 35 cells; pad with empties at the front so today
  // lands at the bottom-right.
  const rows = 5, cols = 7;
  const totalCells = rows * cols;
  const tail   = (days || []).slice(-totalCells);
  const padded = [...new Array(Math.max(0, totalCells - tail.length)).fill(null), ...tail];

  const colorFor = (cell) => {
    if (!cell || !cell.checked_in) return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    if (cell.source_type === 'devotional') return AMBER;
    if (cell.source_type === 'manual')     return SLATE;
    return BLUE;
  };

  const [tip, setTip] = useState(null);

  const cellSize = 34;
  const gap = 8;

  return (
    <View>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom: 10 }}>
        <Text style={{ ...type.label, color: tk.textMuted }}>LAST 35 DAYS</Text>
        <View style={{ flexDirection:'row', gap: 10 }}>
          <Legend dot={BLUE}  label="Lesson"     tk={tk} />
          <Legend dot={AMBER} label="Devotional" tk={tk} />
          <Legend dot={SLATE} label="Manual"     tk={tk} />
        </View>
      </View>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap }}>
        {padded.map((cell, i) => (
          <Pressable
            key={i}
            onPress={() => setTip(cell)}
            style={{
              width: cellSize, height: cellSize, borderRadius: 10,
              backgroundColor: colorFor(cell),
              alignItems:'center', justifyContent:'center',
              opacity: cell ? 1 : 0.6,
            }}
          />
        ))}
      </View>
      {tip && (
        <View style={{ marginTop: 14, alignItems:'center' }}>
          <Text style={{ fontSize: 12, fontWeight:'700', color: tk.textPrimary }}>
            {tip.date} —{' '}
            {tip.checked_in
              ? `${Math.max(1, Math.round((tip.duration_seconds||0)/60))} min · ${tip.source_type}`
              : 'No reading'}
          </Text>
        </View>
      )}
    </View>
  );
}

function Legend({ dot, label, tk }) {
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <Text style={{ fontSize: 10, fontWeight:'700', color: tk.textMuted }}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges grid — locked (greyscale + 🔒) vs unlocked (colored + glow). Tap → sheet.
// ─────────────────────────────────────────────────────────────────────────────
function BadgeCard({ b, i, isUnlocked, unlockedAt, onPress, tk, isDark }) {
  const stagger = useStaggerEntry(i);
  return (
    <Animated.View
      style={{ width: '31.5%', opacity: stagger.fade, transform: [{ translateY: stagger.translateY }] }}
    >
      <Pressable onPress={() => onPress({ ...b, unlocked: isUnlocked, unlocked_at: unlockedAt })}>
        <Glass isDark={isDark} radius={18} padding={12}>
          <View style={{ alignItems:'center' }}>
            <View style={{
              width: 52, height: 52, borderRadius: 14,
              backgroundColor: isUnlocked ? (isDark ? 'rgba(26,86,219,0.18)' : BLUE_LIGHT) : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
              alignItems:'center', justifyContent:'center',
              shadowColor: isUnlocked ? BLUE : 'transparent',
              shadowOpacity: isUnlocked ? 0.45 : 0,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}>
              <Text style={{ fontSize: 26, opacity: isUnlocked ? 1 : 0.35 }}>{b.emoji}</Text>
            </View>
            <Text
              numberOfLines={2}
              style={{
                marginTop: 8, fontSize: 11, fontWeight: '800', textAlign:'center',
                color: isUnlocked ? tk.textPrimary : tk.textMuted, minHeight: 28,
              }}
            >
              {b.title}
            </Text>
            {!isUnlocked && (
              <Text style={{ marginTop: 2, fontSize: 10, color: tk.textMuted }}>🔒 Locked</Text>
            )}
          </View>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

function BadgesGrid({ unlocked, catalog, tk, isDark }) {
  const [sheet, setSheet] = useState(null);
  const unlockedIds = new Set((unlocked || []).map(b => b.id));

  return (
    <View>
      <Text style={{ ...type.label, color: tk.textMuted, marginBottom: 12 }}>
        {unlocked.length} / {catalog.length} EARNED
      </Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap: 12 }}>
        {catalog.map((b, i) => (
          <BadgeCard
            key={b.id}
            b={b}
            i={i}
            isUnlocked={unlockedIds.has(b.id)}
            unlockedAt={unlocked.find(u => u.id === b.id)?.unlocked_at}
            onPress={setSheet}
            tk={tk}
            isDark={isDark}
          />
        ))}
      </View>

      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable onPress={() => setSheet(null)} style={{ flex: 1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()}>
            <Glass isDark={isDark} radius={24} padding={24} style={{ marginHorizontal: 16, marginBottom: 24 }}>
              <View style={{ alignItems:'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 56 }}>{sheet?.emoji}</Text>
                <Text style={{ ...type.h2, color: tk.textPrimary, marginTop: 8 }}>{sheet?.title}</Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: tk.textSec, textAlign:'center' }}>
                  {sheet?.description}
                </Text>
                <View style={{
                  marginTop: 14, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
                  backgroundColor: sheet?.unlocked ? BLUE : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)'),
                }}>
                  <Text style={{ color: sheet?.unlocked ? '#fff' : tk.textMuted, fontWeight: '800', fontSize: 12 }}>
                    {sheet?.unlocked
                      ? (sheet?.unlocked_at ? `Unlocked ${String(sheet.unlocked_at).slice(0,10)}` : 'Unlocked')
                      : '🔒 Keep reading to unlock'}
                  </Text>
                </View>
              </View>
            </Glass>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard list
// ─────────────────────────────────────────────────────────────────────────────
function LeaderRow({ r, i, me, isDark, tk }) {
  const stagger = useStaggerEntry(i);
  const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`;
  return (
    <Animated.View style={{ opacity: stagger.fade, transform: [{ translateY: stagger.translateY }] }}>
      <Glass isDark={isDark} radius={16} padding={12}>
        <View style={{ flexDirection:'row', alignItems:'center', gap: 12 }}>
          <View style={{
            minWidth: 32, height: 32, borderRadius: 10, paddingHorizontal: 8,
            backgroundColor: me ? BLUE : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
            alignItems:'center', justifyContent:'center',
          }}>
            <Text style={{ color: me ? '#fff' : tk.textPrimary, fontWeight:'900', fontSize: 14 }}>{medal}</Text>
          </View>
          <View style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: BLUE_LIGHT,
            alignItems:'center', justifyContent:'center',
          }}>
            <Text style={{ fontSize: 16 }}>{r.avatar_emoji || '👤'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight:'800', color: tk.textPrimary }}>
              {r.display_name || r.email}
            </Text>
            <Text style={{ fontSize: 11, fontWeight:'700', color: tk.textMuted, marginTop: 1 }}>
              Lv {r.level || 1}  ·  🔥 {r.current_streak || 0}d  ·  🎖 {r.badges_count || 0}
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight:'900', color: BLUE }}>
            {Number(r.lifetime_xp || 0).toLocaleString()} XP
          </Text>
        </View>
      </Glass>
    </Animated.View>
  );
}

function LeaderboardList({ rows, myEmail, tk, isDark }) {
  if (!rows || rows.length === 0) {
    return (
      <View style={{ alignItems:'center', paddingVertical: 32 }}>
        <Text style={{ fontSize: 36 }}>🏆</Text>
        <Text style={{ ...type.body, color: tk.textMuted, marginTop: 8 }}>
          No one on the board yet — be the first.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <LeaderRow
          key={`${r.email}-${i}`}
          r={r}
          i={i}
          me={r.email && myEmail && r.email.toLowerCase() === String(myEmail).toLowerCase()}
          isDark={isDark}
          tk={tk}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function StatsScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const { email: ctxEmail } = useSubscription();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [email,    setEmail]    = useState(ctxEmail || null);
  const [stats,    setStats]    = useState(null);
  const [calendar, setCalendar] = useState([]);
  const [board,    setBoard]    = useState([]);
  const [tab,      setTab]      = useState('today');     // today | calendar | badges | leaderboard
  const [scope,    setScope]    = useState('global');    // global | church
  const [period,   setPeriod]   = useState('all');       // 7 | 30 | all
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);
  const [busyCi,   setBusyCi]   = useState(false);

  // Resolve email — context first, then AsyncStorage as a backup.
  useEffect(() => {
    if (ctxEmail) { setEmail(ctxEmail); return; }
    AsyncStorage.getItem('userEmail').then((e) => { if (e) setEmail(e); }).catch(() => {});
  }, [ctxEmail]);

  // Initial + tab/scope-change loads.
  const loadAll = useCallback(async () => {
    if (!email) return;
    try {
      const [s, c, b] = await Promise.all([
        fetchReadingStats(email),
        fetchReadingCalendar(email, 35),
        fetchReadingLeaderboard(scope, period),
      ]);
      setStats(s);
      setCalendar(c?.calendar || c?.days || (Array.isArray(c) ? c : []));
      setBoard(b?.leaders || b?.rows || (Array.isArray(b) ? b : []));
    } catch (e) {
      console.warn('[Stats] load failed', e?.message || e);
    } finally {
      setLoading(false);   setRefresh(false);
    }
  }, [email, scope, period]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reload leaderboard alone when the user toggles scope/period.
  useEffect(() => {
    if (!email) return;
    fetchReadingLeaderboard(scope, period)
      .then((b) => setBoard(b?.leaders || b?.rows || (Array.isArray(b) ? b : [])))
      .catch(() => {});
  }, [scope, period, email]);

  const onCheckIn = useCallback(async () => {
    if (!email || busyCi) return;
    setBusyCi(true);
    try {
      const res = await submitReadingCheckIn(email, { source_type: 'manual' });
      if (res?.new_badges?.length) {
        const titles = res.new_badges.map(b => `${b.emoji}  ${b.title}`).join('\n');
        Alert.alert('New badge unlocked!', titles);
      }
      await loadAll();
    } catch (e) {
      Alert.alert('Could not check in', e?.message || 'Network error.');
    } finally {
      setBusyCi(false);
    }
  }, [email, busyCi, loadAll]);

  // Stats-grid values — fields are flat on the stats response.
  const totalDays = stats?.total_days_read ?? 0;
  const thisWeek  = stats?.this_week ?? 0;
  const thisMonth = stats?.this_month ?? 0;
  const xp        = stats?.lifetime_xp ?? 0;
  const level     = stats?.level ?? 1;
  const xpInto    = stats?.xp_into_level ?? 0;
  const xpNext    = stats?.xp_for_next ?? 100;
  const pct       = stats?.level_progress_pct ?? 0;
  const streak    = stats?.current_streak ?? 0;
  const longest   = stats?.longest_streak ?? 0;
  const badgesUnlocked = stats?.badges || [];
  // Backend uses `desc`; normalise to `description` for the badge sheet.
  const badgeCatalog   = (stats?.badge_catalog || []).map(b => ({
    ...b,
    description: b.description || b.desc || '',
  }));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: isDark ? '#08111E' : '#FFFFFF' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <MeshBackground isDark={isDark} />

      {/* Topbar */}
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.iconBtn}
          accessibilityLabel="Back">
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} sw={2} />
        </TouchableOpacity>
        <Text style={[type.h2, { color: tk.textPrimary }]}>{t('stats_title', 'Reading')}</Text>
        {/* Settings icon removed — Settings is reached from the Library
            home only so every book shares one central entry. Spacer keeps
            the title centred. */}
        <View style={s.iconBtn} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fade, transform: [{ translateY }] }}
        refreshControl={
          <RefreshControl
            refreshing={refresh}
            onRefresh={() => { setRefresh(true); loadAll(); }}
            tintColor={BLUE}
          />
        }
      >
        {loading ? (
          <View style={{ paddingVertical: 80, alignItems:'center' }}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={{ marginTop: 12, color: tk.textMuted, fontSize: 13, fontWeight:'600' }}>
              Loading your reading stats…
            </Text>
          </View>
        ) : (
          <>
            {/* Today panel */}
            <TodayPanel stats={stats} onCheckIn={onCheckIn} busy={busyCi} tk={tk} isDark={isDark} />

            {/* Streak ring + XP bar in one card */}
            <Glass isDark={isDark} radius={24} padding={20} style={{ marginTop: 12 }}>
              <View style={{ alignItems:'center', marginBottom: 18 }}>
                <StreakRing streak={streak} longest={longest} tk={tk} isDark={isDark} />
              </View>
              <XPBar
                level={level} xpIntoLevel={xpInto} xpForNext={xpNext}
                lifetimeXP={xp} pct={pct}
                tk={tk} isDark={isDark}
              />
            </Glass>

            {/* Pill tabs */}
            <View style={[s.pillRow, { marginTop: 16 }]}>
              {[
                { id:'today',       label:'Today' },
                { id:'calendar',    label:'Calendar' },
                { id:'badges',      label:'Badges' },
                { id:'leaderboard', label:'Ranks' },
              ].map((p) => {
                const active = p.id === tab;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setTab(p.id)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 999, alignItems:'center',
                      backgroundColor: active ? BLUE : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'),
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : tk.textPrimary, fontWeight:'800', fontSize: 12 }}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 14 }}>
              {tab === 'today' && (
                <Glass isDark={isDark} radius={20} padding={18}>
                  <Text style={{ ...type.label, color: tk.textMuted, marginBottom: 12 }}>RECENT</Text>
                  {(stats?.recent_log || []).slice(0, 7).map((r, i) => (
                    <View key={i} style={{
                      flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                      paddingVertical: 10, borderBottomWidth: i < (stats.recent_log.length - 1) ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                    }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap: 10 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4,
                          backgroundColor: r.source_type === 'devotional' ? AMBER : r.source_type === 'manual' ? SLATE : BLUE }} />
                        <Text style={{ fontSize: 13, fontWeight:'700', color: tk.textPrimary }}>
                          {String(r.reading_date).slice(0,10)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: tk.textMuted, fontWeight:'600' }}>
                        {Math.max(1, Math.round((r.duration_seconds||0)/60))} min · {r.source_type}
                      </Text>
                    </View>
                  ))}
                  {(!stats?.recent_log || stats.recent_log.length === 0) && (
                    <Text style={{ color: tk.textMuted, fontSize: 13 }}>
                      Once you start reading, your last 14 sessions will show up here.
                    </Text>
                  )}
                </Glass>
              )}

              {tab === 'calendar' && (
                <Glass isDark={isDark} radius={20} padding={18}>
                  <CalendarGrid days={calendar} tk={tk} isDark={isDark} />
                </Glass>
              )}

              {tab === 'badges' && (
                <BadgesGrid unlocked={badgesUnlocked} catalog={badgeCatalog} tk={tk} isDark={isDark} />
              )}

              {tab === 'leaderboard' && (
                <View>
                  <View style={[s.pillRow, { marginBottom: 12 }]}>
                    {['global','church'].map(sc => {
                      const active = sc === scope;
                      return (
                        <Pressable
                          key={sc} onPress={() => setScope(sc)}
                          style={{
                            flex: 1, paddingVertical: 9, borderRadius: 999, alignItems:'center',
                            backgroundColor: active ? BLUE_DEEP : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'),
                          }}
                        >
                          <Text style={{ color: active ? '#fff' : tk.textPrimary, fontWeight:'800', fontSize: 12 }}>
                            {sc === 'global' ? '🌍 Global' : '⛪ My Church'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={[s.pillRow, { marginBottom: 14 }]}>
                    {[{id:'7',label:'7 d'},{id:'30',label:'30 d'},{id:'all',label:'All time'}].map(pr => {
                      const active = pr.id === period;
                      return (
                        <Pressable
                          key={pr.id} onPress={() => setPeriod(pr.id)}
                          style={{
                            flex: 1, paddingVertical: 8, borderRadius: 999, alignItems:'center',
                            backgroundColor: active ? BLUE : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'),
                          }}
                        >
                          <Text style={{ color: active ? '#fff' : tk.textPrimary, fontWeight:'800', fontSize: 11 }}>
                            {pr.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <LeaderboardList rows={board} myEmail={email} tk={tk} isDark={isDark} />
                </View>
              )}
            </View>

            {/* Footer 4-stat grid */}
            <Glass isDark={isDark} radius={20} padding={16} style={{ marginTop: 16 }}>
              <View style={{ flexDirection:'row' }}>
                <MiniStat label="TOTAL DAYS" value={totalDays} accent={BLUE}      tk={tk} />
                <MiniStat label="THIS WEEK"  value={thisWeek}  accent={BLUE_MID}  tk={tk} />
                <MiniStat label="THIS MONTH" value={thisMonth} accent={BLUE_DEEP} tk={tk} />
                <MiniStat label="TOTAL XP"   value={xp}        accent={AMBER}     tk={tk} last />
              </View>
            </Glass>
          </>
        )}
      </Animated.ScrollView>

      {/* Settings tab removed — Settings lives on the Library home only. */}
      <AppTabBar
        activeTab={3}
        onTab={(i) => {
          if (i === 0) navigation.navigate('HomeScreen');
          if (i === 1) navigation.navigate('SecondPage', { category: { id:'adult', route:'SecondPage' } });
          if (i === 2) navigation.navigate('Notes');
        }}
        tk={tk}
        tabs={[
          { key:'Home',    label: t('tab_home',    'Home')    },
          { key:'Lessons', label: t('tab_lessons', 'Lessons') },
          { key:'Notes',   label: t('tab_notes',   'Notes')   },
          { key:'Stats',   label: t('tab_stats',   'Stats')   },
        ]}
      />
    </SafeAreaView>
  );
}

function MiniStat({ label, value, accent, tk, last }) {
  const animated = useCountUp(Number(value) || 0);
  return (
    <View style={{
      flex: 1, alignItems:'center', paddingHorizontal: 4,
      borderRightWidth: last ? 0 : StyleSheet.hairlineWidth,
      borderRightColor: 'rgba(127,127,127,0.2)',
    }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: accent, letterSpacing: -0.5 }}>
        {Math.round(animated).toLocaleString()}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 9.5, fontWeight: '800', color: tk.textMuted, letterSpacing: 0.8 }}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  topbar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop:     6,
    paddingBottom:  10,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems:'center', justifyContent:'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
});
