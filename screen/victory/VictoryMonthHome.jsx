// screen/victory/VictoryMonthHome.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Victory Month Prayer — landing screen.
//
// Layout intentionally asymmetrical (DESIGN.md principle) — generous spacing,
// no 1px borders, surfaces defined by tonal shifts and ambient shadows.
//
// Sections:
//   1. Brand banner with backdrop orbs + theme line
//   2. Today's prayer hero (gradient CTA)
//   3. Progress ring + streak strip
//   4. 30-day calendar grid
//   5. Quick-access tiles: Days · Vigils · About · My Progress
//   6. Vigil highlight strip (horizontal)
//   7. Footer
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, Modal, Platform, Pressable, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { useTheme }      from '../../context/ThemeContext';
import { useLanguage }   from '../../context/LanguageContext';
import { getTokens }     from '../../theme/tokens';
import { useScreenEntry } from '../../hooks/useFluidAnim';
import { ICONS } from '../../components/AppTabBar';
import { todayDayIndex } from '../../data/victoryMonth';
import {
  useVictoryDays, useVictoryVigils, useVictoryMeta,
} from '../../hooks/useVictoryContent';
import { LinearGradient } from 'expo-linear-gradient';
import { BLUE, INDIGO, AMBER, EMERALD, RADII, AMBIENT_SHADOW, victoryTones, groupAccent } from './victoryTheme';
import { RichVerseText } from '../../components/BibleVerseLink';

const { width: W } = Dimensions.get('window');
const STORAGE_KEY = 'vmp_completed_days';

export default function VictoryMonthHome({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  // Backend-driven content (cache-first, falls back to bundled data offline).
  const { days   } = useVictoryDays(navigation);
  const { vigils } = useVictoryVigils(navigation);
  const { meta   } = useVictoryMeta(navigation);

  const TOTAL_DAYS   = days.length   || 30;
  const TOTAL_VIGILS = vigils.length || 6;

  // Today's day — wraps inside the active window.
  const dayNum = todayDayIndex();
  const today  = days[dayNum - 1] || days[0] || { focus: '', scripture: '' };

  // Completion map (also read by VictoryDayList for the same source of truth).
  const [completed, setCompleted] = useState({});
  const refresh = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setCompleted(raw ? JSON.parse(raw) : {});
    } catch { setCompleted({}); }
  }, []);
  useEffect(() => {
    refresh();
    const unsub = navigation.addListener('focus', refresh);
    return unsub;
  }, [navigation, refresh]);

  const doneCount = Object.values(completed).filter(Boolean).length;
  const donePct   = Math.round((doneCount / TOTAL_DAYS) * 100);

  // Bottom-nav state — Toolkit tab opens a bottom sheet listing the five
  // spiritual-toolkit destinations (audio rooms / fasting / reminders /
  // categories / achievements) so all of them stay reachable from the bar
  // without bloating it past five primary tabs.
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const handleTab = useCallback((key) => {
    if (key === 'home')    return; // already here
    if (key === 'days')    navigation.navigate('VictoryDayList');
    if (key === 'vigils')  navigation.navigate('VictoryVigilList');
    if (key === 'toolkit') { setToolkitOpen(true); return; }
    if (key === 'journey') navigation.navigate('VictoryProgress');
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tones.pageBg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tones.pageBg} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: NAV_HEIGHT + 24 }}
        style={{ opacity: fade, transform: [{ translateY }] }}
      >
        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <View style={s.topbar}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Library')}
            activeOpacity={0.75}
            accessibilityLabel="Library"
            style={[s.iconBtn, { backgroundColor: tones.chipBg }]}
          >
            <ICONS.BookStack color={tones.chipFg} size={18} sw={1.9} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.eyebrow, { color: tones.chipFg }]}>
              {t('vmp_caps', 'VICTORY MONTH')}
            </Text>
            <Text style={[s.topTitle, { color: tk.textPrimary }]} numberOfLines={1}>
              {meta.year}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('VictoryAbout')}
            activeOpacity={0.75}
            accessibilityLabel={t('vmp_about_eyebrow', 'About this guide')}
            style={[s.iconBtn, { backgroundColor: tones.chipBg }]}
          >
            <Text style={[s.iconBtnTxt, { color: tones.chipFg }]}>i</Text>
          </TouchableOpacity>
        </View>

        {/* ── THEME RIBBON ───────────────────────────────────────────────── */}
        <View style={s.themeRibbonWrap}>
          <View style={[s.themeRibbon, { backgroundColor: tones.glassFill, borderColor: tones.glassEdge }]}>
            <Text style={[s.themeLabel, { color: tones.chipFg }]}>
              {t('vmp_theme', 'THEME')}
            </Text>
            <Text style={[s.themeText, { color: tk.textPrimary }]} numberOfLines={2}>
              {meta.theme}
            </Text>
            <Text style={[s.themeWindow, { color: tones.textMuted }]}>
              {meta.window}
            </Text>
          </View>
        </View>

        {/* ── TODAY HERO ─────────────────────────────────────────────────── */}
        <View style={s.heroWrap}>
          <View style={[s.heroCard, { backgroundColor: tones.glassFill, borderColor: tones.glassEdge, ...AMBIENT_SHADOW }]}>
            <View style={s.heroRow}>
              <View style={[s.heroBadge, { backgroundColor: tones.todayBg }]}>
                <Text style={[s.heroBadgeDay, { color: tones.todayFg }]}>{dayNum}</Text>
                <Text style={[s.heroBadgeOf, { color: tones.todayFg }]}>
                  / {TOTAL_DAYS}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroEyebrow, { color: tones.chipFg }]}>
                  {t('vmp_today_focus', "TODAY'S FOCUS")}
                </Text>
                <Text style={[s.heroTitle, { color: tk.textPrimary }]} numberOfLines={3}>
                  {today.focus}
                </Text>
              </View>
            </View>

            {!!today.scripture && (
              <View style={[s.versePill, { backgroundColor: tones.versePillBg }]}>
                <ICONS.Book color={tones.versePillFg} size={14} sw={2} />
                <View style={{ flex: 1 }}>
                  <RichVerseText text={today.scripture} isDark={isDark} lineHeight={18}
                    style={[s.versePillTxt, { color: tones.versePillFg }]} />
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('VictoryDayScreen', { day: dayNum })}
              activeOpacity={0.88}
              style={[s.heroCta, { shadowColor: tones.ctaShadow }]}
            >
              <View style={[s.heroCtaInner, { backgroundColor: tones.ctaFrom }]}>
                <Text style={s.heroCtaTxt}>{t('vmp_open_today', "Open today's prayer")}  →</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── PROGRESS STRIP ─────────────────────────────────────────────── */}
        <View style={s.progressWrap}>
          <View style={[s.progressCard, { backgroundColor: tones.glassFill, borderColor: tones.glassEdge }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.progressEye, { color: tones.chipFg }]}>{t('vmp_progress', 'YOUR PROGRESS')}</Text>
              <Text style={[s.progressVal, { color: tk.textPrimary }]}>
                {doneCount} <Text style={[s.progressOf, { color: tones.textMuted }]}>of {TOTAL_DAYS}</Text>
              </Text>
              <Text style={[s.progressSub, { color: tones.textMuted }]}>
                {donePct}% complete · {TOTAL_DAYS - doneCount} {TOTAL_DAYS - doneCount === 1 ? 'day' : 'days'} to go
              </Text>
            </View>
            <View style={[s.progressRing, { backgroundColor: tones.chipBg }]}>
              <Text style={[s.progressRingVal, { color: tones.chipFg }]}>{donePct}%</Text>
            </View>
          </View>
          <View style={[s.progressBar, { backgroundColor: tones.chipBg }]}>
            <View
              style={[s.progressBarFill, { width: `${donePct}%`, backgroundColor: BLUE[600] }]}
            />
          </View>
        </View>

        {/* ── 30-DAY GRID ────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHead
            title={t('vmp_30_days', '30 Days of Prayer')}
            action={t('vmp_browse_all', 'Browse all')}
            tk={tk}
            tones={tones}
            onAction={() => navigation.navigate('VictoryDayList')}
          />
          <View style={s.daysGrid}>
            {days.map((d) => {
              const isToday = d.day === dayNum;
              const isDone  = !!completed[d.day];
              const bg      = isToday ? BLUE[600]
                            : isDone  ? EMERALD[500]
                            : tones.chipBg;
              const fg      = (isToday || isDone) ? '#fff' : tones.chipFg;
              return (
                <TouchableOpacity
                  key={d.day}
                  onPress={() => navigation.navigate('VictoryDayScreen', { day: d.day })}
                  activeOpacity={0.78}
                  style={[s.dayTile, { backgroundColor: bg }]}
                >
                  <Text style={[s.dayTileNum, { color: fg }]}>{d.day}</Text>
                  {isDone && !isToday && (
                    <View style={s.dayTileCheck}>
                      <ICONS.Check color="#fff" size={9} sw={2.8} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── EXPLORE GRID ───────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHead
            title={t('vmp_explore', 'Explore')}
            tk={tk}
            tones={tones}
          />
          <View style={s.exploreGrid}>
            <ExploreBox
              icon={<ICONS.Calendar color={BLUE[600]} size={22} sw={2} />}
              tint={BLUE[600]}
              label={t('vmp_qa_browse_days', 'All Days')}
              sub={`${TOTAL_DAYS} entries`}
              onPress={() => navigation.navigate('VictoryDayList')}
              tones={tones}
              tk={tk}
            />
            <ExploreBox
              icon={<ICONS.Prayer color={INDIGO[600]} size={22} sw={2} />}
              tint={INDIGO[600]}
              label={t('vmp_qa_vigils', 'Vigils')}
              sub={`${TOTAL_VIGILS} group guides`}
              onPress={() => navigation.navigate('VictoryVigilList')}
              tones={tones}
              tk={tk}
            />
            <ExploreBox
              icon={<ICONS.Stats color={EMERALD[500]} size={22} sw={2} />}
              tint={EMERALD[500]}
              label={t('vmp_qa_progress', 'My Journey')}
              sub={`${donePct}% done`}
              onPress={() => navigation.navigate('VictoryProgress')}
              tones={tones}
              tk={tk}
            />
            <ExploreBox
              icon={<ICONS.Sun color={AMBER[500]} size={22} sw={2} />}
              tint={AMBER[500]}
              label={t('vmp_qa_about', 'About')}
              sub="Theme & guidelines"
              onPress={() => navigation.navigate('VictoryAbout')}
              tones={tones}
              tk={tk}
            />
          </View>
        </View>

        {/* ── VIGIL HIGHLIGHT STRIP ──────────────────────────────────────── */}
        <View style={[s.section, { paddingHorizontal: 0 }]}>
          <View style={{ paddingHorizontal: 20 }}>
            <SectionHead
              title={t('vmp_vigils', 'Group Vigils')}
              action={t('vmp_view_all', 'View all')}
              tk={tk}
              tones={tones}
              onAction={() => navigation.navigate('VictoryVigilList')}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {vigils.map((v) => {
              const accent = groupAccent(v.group);
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => navigation.navigate('VictoryVigilScreen', { id: v.id })}
                  activeOpacity={0.85}
                  style={[s.vigilCard, { backgroundColor: tones.glassFill, borderColor: tones.glassEdge }]}
                >
                  <View style={[s.vigilTag, { backgroundColor: accent.bg }]}>
                    <Text style={[s.vigilTagTxt, { color: accent.deep }]}>{v.group}</Text>
                  </View>
                  <Text style={[s.vigilTitle, { color: tk.textPrimary }]} numberOfLines={2}>
                    {v.focus}
                  </Text>
                  <View style={s.vigilMetaRow}>
                    <ICONS.Calendar color={tones.textMuted} size={11} sw={2} />
                    <Text style={[s.vigilMeta, { color: tones.textMuted }]} numberOfLines={1}>
                      {v.date.split(',')[1]?.trim() || v.date}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={[s.footerLine, { color: tones.textMuted }]}>
            © {meta.year} {meta.organisation}
          </Text>
          <Text style={[s.footerVerse, { color: tones.chipFg }]}>
            "Those who know their God shall be strong and do exploits" — Dan 11:32
          </Text>
        </View>
      </Animated.ScrollView>

      {/* ── BOTTOM NAV ───────────────────────────────────────────────────── */}
      <VictoryBottomNav activeKey="home" onTab={handleTab} tk={tk} tones={tones} />

      {/* ── TOOLKIT SHEET ────────────────────────────────────────────────── */}
      <ToolkitSheet
        visible={toolkitOpen}
        onClose={() => setToolkitOpen(false)}
        onPick={(routeName) => {
          setToolkitOpen(false);
          // Defer so the modal dismissal animation can finish before the
          // navigation transition starts — otherwise the sheet vanishes mid-
          // slide which feels jumpy on lower-end Androids.
          setTimeout(() => navigation.navigate(routeName), 180);
        }}
        tk={tk}
        tones={tones}
        t={t}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom nav — 5 tabs. Sits absolutely at the bottom; the ScrollView pads
// itself enough to leave room. Pure Animated for the pill press feedback so
// we don't add a Reanimated dep.
// ─────────────────────────────────────────────────────────────────────────────
const NAV_HEIGHT = Platform.OS === 'ios' ? 86 : 68;

const NAV_TABS = [
  { key: 'home',    label: 'Home',    Icon: ICONS.Home },
  { key: 'days',    label: 'Days',    Icon: ICONS.Calendar },
  { key: 'vigils',  label: 'Vigils',  Icon: ICONS.Prayer },
  { key: 'toolkit', label: 'Toolkit', Icon: ICONS.Star },
  { key: 'journey', label: 'Journey', Icon: ICONS.Stats },
];

const VictoryBottomNav = ({ activeKey, onTab, tk, tones }) => {
  return (
    <View
      style={[
        nav.bar,
        {
          backgroundColor: tones.glassFill,
          borderWidth: 1, borderColor: tones.glassEdge, borderTopColor:  tones.glassEdge,
          shadowColor:     '#0F172A',
        },
      ]}
    >
      {NAV_TABS.map((t) => {
        const active = t.key === activeKey;
        const tint   = active ? BLUE[600] : tones.textMuted;
        const Icon   = t.Icon;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onTab(t.key)}
            activeOpacity={0.75}
            style={nav.item}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: active }}
          >
            {/* Active "pill" sits behind the icon so the bar still reads at
                a glance even when the icons aren't tinted strongly. */}
            {active && (
              <View style={[nav.activePill, { backgroundColor: BLUE[50] }]} />
            )}
            <View style={nav.iconWrap}>
              <Icon color={tint} size={20} sw={1.9} />
            </View>
            <Text
              style={[
                nav.label,
                { color: tint, fontWeight: active ? '900' : '700' },
              ]}
              numberOfLines={1}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const nav = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    paddingTop:    8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    borderTopWidth: 1,
    shadowOffset:  { width: 0, height: -8 },
    shadowOpacity: 0.10,
    shadowRadius:  18,
    elevation:     16,
  },
  item: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 4, position: 'relative',
  },
  activePill: {
    position: 'absolute', top: -2,
    width: 44, height: 30, borderRadius: 999,
  },
  iconWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  label:    { fontSize: 10, letterSpacing: 0.1, includeFontPadding: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// Toolkit bottom sheet — opened by the Toolkit tab. Lists the five spiritual
// toolkit destinations exactly as they appear in the page section so users
// can mentally map "the row I saw" → "the tab that brings it back".
// ─────────────────────────────────────────────────────────────────────────────
// Audio prayer rooms intentionally omitted — they're surfaced from the Library
// home now so any signed-in user can join without owning the Victory book.
const TOOLKIT_ITEMS = [
  { emoji: '🕯️', label: 'Fasting hub',         sub: 'Schedule consecrated time',   route: 'VictoryFastingHub',        gradient: [INDIGO[700], INDIGO[500]] },
  { emoji: '🔔', label: 'Prayer reminders',    sub: 'Build a daily rhythm',        route: 'VictoryReminders',         gradient: ['#0EA5E9', '#3B82F6'] },
  { emoji: '🌿', label: 'Prayer categories',   sub: '9 spiritual focus areas',     route: 'VictoryCategories',        gradient: [EMERALD[500], '#14B8A6'] },
  { emoji: '🏆', label: 'Achievements',        sub: 'Badges, streaks, milestones', route: 'VictoryAchievementsScreen', gradient: [AMBER[500], '#DC2626'] },
];

const ToolkitSheet = ({ visible, onClose, onPick, tk, tones, t = (k, f) => f }) => {
  const slide   = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide,    { toValue: visible ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, slide, backdrop]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[sheet.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          sheet.card,
          { backgroundColor: tones.glassFill, borderWidth: 1, borderColor: tones.glassEdge, transform: [{ translateY }] },
        ]}
      >
        <View style={sheet.handle} />
        <View style={sheet.headerRow}>
          <Text style={[sheet.eyebrow, { color: tones.chipFg }]}>{t('vmp_toolkit_eyebrow', 'DEEPEN YOUR WALK')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}
            style={[sheet.closeBtn, { backgroundColor: tones.chipBg }]}>
            <ICONS.X color={tones.chipFg} size={14} sw={2.4} />
          </TouchableOpacity>
        </View>
        <Text style={[sheet.title, { color: tk.textPrimary }]}>{t('vmp_toolkit_title', 'Spiritual toolkit')}</Text>

        <View style={{ gap: 10, marginTop: 14 }}>
          {TOOLKIT_ITEMS.map((it) => (
            <TouchableOpacity
              key={it.route}
              onPress={() => onPick(it.route)}
              activeOpacity={0.88}
            >
              <View style={[sheet.row, { backgroundColor: tones.pageBg, borderColor: tones.glassEdge }]}>
                <View style={[sheet.rowIcon, { backgroundColor: tones.chipBg }]}>
                  <Text style={{ fontSize: 20 }}>{it.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sheet.rowLabel, { color: tk.textPrimary }]} numberOfLines={1}>
                    {it.label}
                  </Text>
                  <Text style={[sheet.rowSub, { color: tones.textMuted }]} numberOfLines={1}>
                    {it.sub}
                  </Text>
                </View>
                <Text style={[sheet.rowChev, { color: tones.textMuted }]}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
};

const sheet = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 14, 30, 0.55)',
  },
  card: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    paddingTop:    10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    shadowColor:   '#0B2A6B',
    shadowOffset:  { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius:  28,
    elevation:     20,
  },
  handle: {
    alignSelf: 'center', width: 44, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.18)', marginBottom: 14,
  },
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow:    { fontSize: 10, fontWeight: '900', letterSpacing: 2.4 },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  title:      { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginTop: 4 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, borderWidth: 1 },
  rowIcon:    { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  rowLabel:   { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2 },
  rowSub:     { fontSize: 12, fontWeight: '600', marginTop: 2 },
  rowChev:    { fontSize: 22, fontWeight: '700', marginLeft: 4 },
});

// ── Re-usable bits ───────────────────────────────────────────────────────────
const SectionHead = ({ title, action, onAction, tk, tones }) => (
  <View style={s.sectionHead}>
    <Text style={[s.sectionTitle, { color: tk.textPrimary }]}>{title}</Text>
    {!!action && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.75}>
        <Text style={[s.sectionAction, { color: tones.chipFg }]}>{action} →</Text>
      </TouchableOpacity>
    )}
  </View>
);

// 2×2 grid box for the Explore section — icon up top, label, then sub.
// Two boxes per row, soft surface with a tinted icon plate.
const ExploreBox = ({ icon, tint, label, sub, onPress, tk, tones }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[
      s.exploreBox,
      { backgroundColor: tones.glassFill, borderColor: tones.glassEdge, ...AMBIENT_SHADOW },
    ]}
  >
    <View style={[s.exploreIcon, { backgroundColor: (tint || tones.chipFg) + '1A' }]}>
      {icon}
    </View>
    <Text style={[s.exploreLabel, { color: tk.textPrimary }]} numberOfLines={1}>{label}</Text>
    <Text style={[s.exploreSub,   { color: tones.textMuted }]} numberOfLines={1}>{sub}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  iconBtn:    { width: 42, height: 42, borderRadius: RADII.pill, justifyContent: 'center', alignItems: 'center' },
  iconBtnTxt: { fontSize: 16, fontWeight: '900', fontStyle: 'italic' },
  eyebrow:    { fontSize: 10, fontWeight: '900', letterSpacing: 2.4 },
  topTitle:   { fontSize: 14, fontWeight: '900', marginTop: 2 },

  // Theme ribbon — narrow card, the "first breath" of the screen.
  // Solid fill + 1px border for a clean, modern outline.
  themeRibbonWrap: { paddingHorizontal: 20, marginTop: 8, marginBottom: 22 },
  themeRibbon:     { padding: 16, borderRadius: RADII.lg, borderWidth: 1, ...AMBIENT_SHADOW },
  themeLabel:      { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  themeText:       { fontSize: 17, fontWeight: '900', lineHeight: 23, letterSpacing: -0.3, marginBottom: 6 },
  themeWindow:     { fontSize: 12, fontWeight: '700' },

  // Hero card — asymmetric layout, big day number, gradient CTA
  heroWrap:    { paddingHorizontal: 20, marginBottom: 24 },
  heroCard:    { padding: 22, borderRadius: RADII.xl, borderWidth: 1 },
  heroRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 14 },
  heroBadge:   {
    width: 78, height: 78, borderRadius: RADII.lg,
    justifyContent: 'center', alignItems: 'center', paddingTop: 4,
  },
  heroBadgeDay: { fontSize: 32, fontWeight: '900', letterSpacing: -1.2, lineHeight: 34 },
  heroBadgeOf:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: -2, opacity: 0.85 },
  heroEyebrow:  { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  heroTitle:    { fontSize: 21, fontWeight: '900', lineHeight: 27, letterSpacing: -0.4 },
  versePill:    {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.pill, marginBottom: 16,
  },
  versePillTxt: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.1, maxWidth: W - 120 },
  heroCta:      {
    borderRadius: RADII.pill, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1, shadowRadius: 22, elevation: 6,
  },
  heroCtaInner: {
    paddingVertical: 15, borderRadius: RADII.pill, alignItems: 'center',
  },
  heroCtaTxt:   { color: '#fff', fontSize: 14.5, fontWeight: '900', letterSpacing: 0.3 },

  // Progress card + bar
  progressWrap: { paddingHorizontal: 20, marginBottom: 28 },
  progressCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: RADII.lg, marginBottom: 10,
    borderWidth: 1,
  },
  progressEye:  { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  progressVal:  { fontSize: 28, fontWeight: '900', letterSpacing: -1, lineHeight: 30 },
  progressOf:   { fontSize: 16, fontWeight: '700' },
  progressSub:  { fontSize: 12, fontWeight: '600', marginTop: 4 },
  progressRing: { width: 60, height: 60, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  progressRingVal: { fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  progressBar:  { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },

  // Section heading row
  section:       { paddingHorizontal: 20, marginBottom: 28 },
  sectionHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  sectionAction: { fontSize: 13, fontWeight: '800' },

  // 30-day calendar grid
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayTile: {
    width: (W - 40 - 8 * 5) / 6, aspectRatio: 1, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  dayTileNum:   { fontSize: 14, fontWeight: '900', letterSpacing: -0.3 },
  dayTileCheck: {
    position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.32)', justifyContent: 'center', alignItems: 'center',
  },

  // Explore 2×2 grid — icon stacked over label + sub for a compact tile
  exploreGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    columnGap: 12, rowGap: 12,
  },
  exploreBox:  {
    width: (W - 40 - 12) / 2,
    padding: 16, borderRadius: RADII.lg, borderWidth: 1,
  },
  exploreIcon: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  exploreLabel:{ fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  exploreSub:  { fontSize: 12, fontWeight: '600', marginTop: 4 },

  // Vigil horizontal cards
  vigilCard:    { width: 240, padding: 16, borderRadius: RADII.lg, gap: 10, borderWidth: 1 },
  vigilTag:     { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADII.pill },
  vigilTagTxt:  { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  vigilTitle:   { fontSize: 14.5, fontWeight: '800', lineHeight: 20, letterSpacing: -0.2, minHeight: 40 },
  vigilMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vigilMeta:    { fontSize: 11.5, fontWeight: '700' },

  // Footer
  footer:      { alignItems: 'center', gap: 6, paddingHorizontal: 28, marginTop: 12 },
  footerLine:  { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  footerVerse: { fontSize: 12, fontWeight: '700', fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
});
