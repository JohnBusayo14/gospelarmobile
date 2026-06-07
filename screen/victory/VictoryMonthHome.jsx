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
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ImageBackground,
  Dimensions, StatusBar, Animated, Modal, Platform, Pressable, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
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
import { BLUE, INDIGO, AMBER, EMERALD, RADII, AMBIENT_SHADOW, victoryTones, groupAccent } from './victoryTheme';
import EmojiIcon from '../../components/EmojiIcon';

const { width: W } = Dimensions.get('window');
const STORAGE_KEY = 'vmp_completed_days';

// Header background photo. The header is an image blended under a blue
// gradient so the brand color still reads while the photo adds depth.
//
// ⚠️ Add the praying-hands photo as frontend/assets/prayer-hands.jpg, then set:
//      const HEADER_IMAGE = require('../../assets/prayer-hands.jpg');
//    Until the file exists this stays null and the header falls back to the
//    plain blue gradient (Metro can't bundle a require() to a missing file).
const HEADER_IMAGE = require('../../assets/prayer-hands.jpg');

// Meter color ramp — interpolates red → amber → green across 0–100% so the
// gauge reads "low / mid / full" at a glance. Returns a {from, to} gradient
// pair for the progress arc.
function meterColors(pct) {
  const p = Math.max(0, Math.min(100, pct));
  if (p < 34)  return { from: '#EF4444', to: '#F97316' };   // red → orange
  if (p < 67)  return { from: '#F59E0B', to: '#FACC15' };   // amber → yellow
  return { from: '#22C55E', to: '#16A34A' };                // green → deep green
}

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
        {/* ── HEADER — image background blended with blue, + today's focus ─── */}
        <View style={s.headerWrap}>
          <ImageBackground
            source={HEADER_IMAGE}
            resizeMode="cover"
            style={s.headerCard}
            imageStyle={{ borderRadius: RADII.xl }}
            onError={(e) => console.warn('[VictoryHeader] image failed:', e?.nativeEvent?.error)}
          >
            {/* Blue gradient blend over the photo. */}
            <LinearGradient
              colors={isDark
                ? ['rgba(11,18,32,0.72)', 'rgba(16,33,63,0.84)', 'rgba(11,18,32,0.92)']
                : ['rgba(29,78,216,0.72)', 'rgba(37,99,235,0.80)', 'rgba(2,132,199,0.88)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Soft decorative orbs for depth */}
            <View style={[s.headerOrb, s.headerOrbA]} />
            <View style={[s.headerOrb, s.headerOrbB]} />

            <View style={s.headerContent}>
              <View style={s.headerTopRow}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Library')}
                  activeOpacity={0.8}
                  accessibilityLabel="Library"
                  style={s.headerIconBtn}
                >
                  <ICONS.BookStack color="#FFFFFF" size={18} sw={2.25} />
                </TouchableOpacity>

                <View style={s.headerPill}>
                  <View style={s.headerDot} />
                  <Text style={s.headerPillTxt}>{t('vmp_caps', 'VICTORY MONTH')}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => navigation.navigate('VictoryAbout')}
                  activeOpacity={0.8}
                  accessibilityLabel={t('vmp_about_eyebrow', 'About this guide')}
                  style={s.headerIconBtn}
                >
                  <Text style={s.headerIconTxt}>i</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.headerYear}>{meta.year}</Text>
              {!!meta.theme && (
                <Text style={s.headerTheme} numberOfLines={2}>{meta.theme}</Text>
              )}

              {/* Today's focus — folded into the header now the carousel is gone. */}
              <View style={s.headerFocusRow}>
                <View style={s.headerDayBadge}>
                  <Text style={s.headerDayNum}>{dayNum}</Text>
                  <Text style={s.headerDayOf}>/ {TOTAL_DAYS}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.headerFocusEyebrow}>{t('vmp_today_focus', "TODAY'S FOCUS")}</Text>
                  <Text style={s.headerFocusTitle} numberOfLines={3}>{today.focus}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('VictoryDayScreen', { day: dayNum })}
                activeOpacity={0.9}
                style={s.headerCta}
              >
                <Text style={s.headerCtaTxt}>{t('vmp_open_today', "Open today's prayer")}  →</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        </View>

        {/* ── PROGRESS METER — animated semicircle speedometer ───────────── */}
        <View style={[s.section, { marginBottom: 28 }]}>
          <SectionHead
            title={t('vmp_progress', 'Your progress')}
            action={t('vmp_browse_all', 'Browse all')}
            tk={tk}
            tones={tones}
            onAction={() => navigation.navigate('VictoryDayList')}
          />
          <View style={[s.meterCard, { backgroundColor: tones.glassFill, borderColor: tones.glassEdge, ...AMBIENT_SHADOW }]}>
            <VictorySpeedometer
              pct={donePct}
              doneCount={doneCount}
              total={TOTAL_DAYS}
              tones={tones}
              tk={tk}
              t={t}
            />
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
              icon={<ICONS.Calendar color={BLUE[600]} size={22} sw={2.25} />}
              tint={BLUE[600]}
              label={t('vmp_qa_browse_days', 'All Days')}
              sub={`${TOTAL_DAYS} entries`}
              onPress={() => navigation.navigate('VictoryDayList')}
              tones={tones}
              tk={tk}
            />
            <ExploreBox
              icon={<ICONS.Prayer color={INDIGO[600]} size={22} sw={2.25} />}
              tint={INDIGO[600]}
              label={t('vmp_qa_vigils', 'Vigils')}
              sub={`${TOTAL_VIGILS} group guides`}
              onPress={() => navigation.navigate('VictoryVigilList')}
              tones={tones}
              tk={tk}
            />
            <ExploreBox
              icon={<ICONS.Stats color={EMERALD[500]} size={22} sw={2.25} />}
              tint={EMERALD[500]}
              label={t('vmp_qa_progress', 'My Journey')}
              sub={`${donePct}% done`}
              onPress={() => navigation.navigate('VictoryProgress')}
              tones={tones}
              tk={tk}
            />
            <ExploreBox
              icon={<ICONS.Sun color={AMBER[500]} size={22} sw={2.25} />}
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
                    <ICONS.Calendar color={tones.textMuted} size={11} sw={2.25} />
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
              <Icon color={tint} size={20} sw={2.25} />
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
  { emoji: '🌿', label: 'Prayer categories',   sub: '9 spiritual focus areas',     route: 'VictoryCategories',        gradient: [EMERALD[500], '#22C55E'] },
  { emoji: '🏆', label: 'Achievements',        sub: 'Badges, streaks, milestones', route: 'VictoryAchievementsScreen', gradient: [AMBER[500], '#DC2626'] },
];

const ToolkitSheet = ({ visible, onClose, onPick, tk, tones, t = (k, f) => f }) => {
  const slide   = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hold the handle so toggling visible rapidly (or unmounting while
    // mid-animation) doesn't leave the animator finalising a dead value.
    const handle = Animated.parallel([
      Animated.timing(slide,    { toValue: visible ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]);
    handle.start();
    return () => { try { handle.stop(); } catch { /* already done */ } };
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
                  <EmojiIcon emoji={it.emoji} color="#374151" size={20} sw={2.25} />
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

// ─────────────────────────────────────────────────────────────────────────────
// VictorySpeedometer — animated semicircle gauge. A 180° track arc with a
// gradient progress arc that sweeps 0 → pct on mount (and whenever pct changes),
// plus a marker dot riding the arc and a center readout. Uses react-native-svg;
// the sweep is driven by a JS-driver Animated.Value (strokeDasharray + the
// marker position can't run on the native driver).
// ─────────────────────────────────────────────────────────────────────────────
const SPEEDO_W = W - 40 - 36;          // card inner width (page gutter + card padding)
const SPEEDO_SIZE = Math.min(SPEEDO_W, 300);
const SPEEDO_STROKE = 18;

// Polar point on the gauge arc for a given fraction (0..1) of the 180° sweep.
// The sweep runs left→right across the top half: 180° (left) → 0° (right).
function gaugePoint(cx, cy, r, frac) {
  const angle = Math.PI * (1 - Math.max(0, Math.min(1, frac))); // π → 0
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

const VictorySpeedometer = ({ pct, doneCount, total, tones, tk, t }) => {
  const size   = SPEEDO_SIZE;
  const stroke = SPEEDO_STROKE;
  const r      = (size - stroke) / 2;
  const cx     = size / 2;
  const cy     = size / 2;             // baseline of the semicircle
  const arcLen = Math.PI * r;          // length of a 180° arc

  const safePct = Math.max(0, Math.min(100, pct || 0));

  // Animate the sweep fraction 0 → safePct/100. JS driver because we read the
  // value back to position the marker and set strokeDasharray.
  const anim = useRef(new Animated.Value(0)).current;
  const [frac, setFrac] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setFrac(value));
    const handle = Animated.timing(anim, {
      toValue: safePct / 100,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    handle.start();
    return () => {
      try { handle.stop(); } catch { /* already done */ }
      anim.removeListener(id);
    };
  }, [safePct, anim]);

  const dash   = frac * arcLen;
  const marker = gaugePoint(cx, cy, r, frac);

  // Responsive color — red at low fill, amber mid, green when full. Keyed off
  // the animated fraction so the arc shifts hue as it sweeps.
  const animatedPctTxt = Math.round(frac * 100);
  const ramp = meterColors(animatedPctTxt);

  // Arc path: start at left end (180°), sweep over the top to the right end (0°).
  const start = gaugePoint(cx, cy, r, 0);
  const end   = gaugePoint(cx, cy, r, 1);
  const arcPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

  // Semicircle only needs the top half — height is radius + stroke padding.
  const svgH = cy + stroke / 2 + 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: svgH }}>
        <Svg width={size} height={svgH}>
          <Defs>
            <SvgGrad id="speedo" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={ramp.from} />
              <Stop offset="1" stopColor={ramp.to} />
            </SvgGrad>
          </Defs>
          {/* Track */}
          <Path
            d={arcPath}
            stroke={tones.chipBg}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
          {/* Progress */}
          <Path
            d={arcPath}
            stroke="url(#speedo)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${arcLen}`}
          />
          {/* Marker dot riding the arc tip */}
          <Circle cx={marker.x} cy={marker.y} r={stroke / 2 + 3} fill="#fff" />
          <Circle cx={marker.x} cy={marker.y} r={stroke / 2 - 1} fill={ramp.to} />
        </Svg>

        {/* Center readout — overlaid at the base of the semicircle. */}
        <View style={[s.meterCenter, { width: size }]}>
          <Text style={[s.meterPct, { color: tk.textPrimary }]}>{animatedPctTxt}%</Text>
          <Text style={[s.meterSub, { color: tones.textMuted }]}>
            {doneCount} {t('vmp_of', 'of')} {total} {t('vmp_days', 'days')}
          </Text>
        </View>
      </View>

      <Text style={[s.meterFoot, { color: tones.textMuted }]}>
        {total - doneCount} {total - doneCount === 1 ? t('vmp_day', 'day') : t('vmp_days', 'days')} {t('vmp_to_go', 'to go')}
      </Text>
    </View>
  );
};

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
  // Image-backed header hero — photo under a blue gradient blend.
  headerWrap:  { paddingHorizontal: 16, paddingTop: 6, marginBottom: 24 },
  headerCard:  {
    borderRadius: RADII.xl, overflow: 'hidden',
    shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28, shadowRadius: 22, elevation: 8,
  },
  headerContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22 },
  headerOrb:   { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  headerOrbA:  { width: 160, height: 160, top: -70, right: -40 },
  headerOrbB:  { width: 110, height: 110, bottom: -50, left: -30, backgroundColor: 'rgba(255,255,255,0.07)' },
  headerTopRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: RADII.pill,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  headerIconTxt: { fontSize: 16, fontWeight: '900', fontStyle: 'italic', color: '#FFFFFF' },
  headerPill:  {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADII.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  headerDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  headerPillTxt:{ fontSize: 10, fontWeight: '900', letterSpacing: 2.2, color: '#FFFFFF' },
  headerYear:   { fontSize: 38, fontWeight: '900', letterSpacing: -1.5, color: '#FFFFFF', marginTop: 16 },
  headerTheme:  { fontSize: 13, fontWeight: '700', lineHeight: 19, color: 'rgba(255,255,255,0.88)', marginTop: 4 },

  // Today's-focus block folded into the header
  headerFocusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 22 },
  headerDayBadge: {
    width: 64, height: 64, borderRadius: RADII.lg,
    justifyContent: 'center', alignItems: 'center', paddingTop: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
  },
  headerDayNum:   { fontSize: 26, fontWeight: '900', letterSpacing: -1, lineHeight: 28, color: '#FFFFFF' },
  headerDayOf:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: -1, color: 'rgba(255,255,255,0.85)' },
  headerFocusEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 5, color: 'rgba(255,255,255,0.85)' },
  headerFocusTitle:   { fontSize: 18, fontWeight: '500', lineHeight: 24, letterSpacing: -0.3, color: '#FFFFFF' },
  headerCta:    {
    marginTop: 18, alignSelf: 'flex-start',
    paddingVertical: 13, paddingHorizontal: 22, borderRadius: RADII.pill,
    backgroundColor: '#FFFFFF',
  },
  headerCtaTxt: { fontSize: 14, fontWeight: '900', letterSpacing: 0.3, color: BLUE[700] },

  // Progress meter (semicircle speedometer)
  meterCard:   { padding: 18, borderRadius: RADII.lg, borderWidth: 1, alignItems: 'center' },
  meterCenter: {
    position: 'absolute', bottom: 6, alignItems: 'center', justifyContent: 'center',
  },
  meterPct:    { fontSize: 40, fontWeight: '900', letterSpacing: -1.5, lineHeight: 44 },
  meterSub:    { fontSize: 13, fontWeight: '700', marginTop: 2 },
  meterFoot:   { fontSize: 12, fontWeight: '600', marginTop: 10 },

  // Section heading row
  section:       { paddingHorizontal: 20, marginBottom: 28 },
  sectionHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  sectionAction: { fontSize: 13, fontWeight: '800' },

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
