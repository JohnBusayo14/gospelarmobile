// screens/OnboardingScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// First-launch onboarding. Four swipeable slides introducing the app, then a
// "Get Started" CTA that flips a persistent AsyncStorage flag and routes the
// user to Login (or back to Splash if they're already signed in).
//
// Routing wiring: SplashScreen reads `hasOnboarded` from AsyncStorage and
// sends first-time users here before Login. Subsequent launches skip this
// screen entirely.
//
// Visual language matches the rest of the app:
//   • bottom-tab-style outline icons from components/icons (sw 2.25)
//   • tinted icon badges via TintedIcon for the per-slide hero
//   • dark blue gradient backdrop matching SplashScreen
//   • dot pagination + skip button top-right
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';
import { ICONS } from '../components/icons';
import TintedIcon from '../components/TintedIcon';

export const ONBOARDED_KEY = 'gospelar.onboarded.v1';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Brand-darks matching SplashScreen so the transition from splash → onboarding
// → login feels continuous instead of a hard cut.
const BG_TOP     = '#0D1B5E';
const BG_BOTTOM  = '#1A56DB';
const TEXT_LIGHT = '#FFFFFF';
const TEXT_MUTED = 'rgba(255,255,255,0.72)';
const DOT_INACTIVE = 'rgba(255,255,255,0.28)';
const DOT_ACTIVE   = '#FFFFFF';
const CTA_BG       = '#FFFFFF';
const CTA_FG       = '#0D1B5E';

// Slide definitions. Each slide gets:
//   - Icon (lucide-style outline from ICONS)
//   - tone for the TintedIcon background  (primary | accent | success | warning)
//   - title + body  (translation-aware via useLanguage's t())
// Adding a new slide is just a new entry in this array — pagination, swipe,
// and CTA copy all read from `SLIDES.length`.
function makeSlides(t) {
  return [
    {
      key:   'welcome',
      Icon:  ICONS.Book,
      tone:  'primary',
      title: t('ob_welcome_title', 'Welcome to Gospelar'),
      body:  t(
        'ob_welcome_body',
        'Your Sunday School companion — lessons, devotionals, prayer, and your church identity, all in one place.',
      ),
    },
    {
      key:   'lessons',
      Icon:  ICONS.Lessons,
      tone:  'accent',
      title: t('ob_lessons_title', 'Sunday School, every week'),
      body:  t(
        'ob_lessons_body',
        'Read this quarter\'s lessons across Adult, Youth, Intermediate, and Children\'s classes — with audio reading, memory verses, and quizzes.',
      ),
    },
    {
      key:   'prayer',
      Icon:  ICONS.Flame,
      tone:  'warning',
      title: t('ob_prayer_title', 'Victory Month Prayer'),
      body:  t(
        'ob_prayer_body',
        'Walk the 30-day prayer journey — fasting tools, audio prayer rooms, vigils, and the daily intercession bulletin.',
      ),
    },
    {
      key:   'identity',
      Icon:  ICONS.ShieldCheck,
      tone:  'success',
      title: t('ob_identity_title', 'Your Gospeler ID'),
      body:  t(
        'ob_identity_body',
        'A church-verifiable digital identity card you carry with you — earn it, share it, and use it across the Gospelar ecosystem.',
      ),
    },
  ];
}

export default function OnboardingScreen({ navigation }) {
  const { t } = useLanguage();
  const SLIDES = makeSlides(t);
  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  function onScroll(ev) {
    const x = ev.nativeEvent.contentOffset.x;
    scrollX.setValue(x);
    const next = Math.round(x / SCREEN_W);
    if (next !== index) setIndex(next);
  }

  function goToSlide(i) {
    scrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
  }

  async function finishOnboarding() {
    try { await AsyncStorage.setItem(ONBOARDED_KEY, '1'); } catch { /* harmless */ }
    navigation.replace('Login');
  }

  function onNext() {
    if (index < SLIDES.length - 1) goToSlide(index + 1);
    else finishOnboarding();
  }

  return (
    <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG_TOP} translucent />
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>

        {/* Top bar — brand mark on the left, Skip on the right. Skip writes
            the same onboarded flag so a sceptical user doesn't see this
            screen again on relaunch. */}
        <View style={s.topBar}>
          <View style={s.brand}>
            <Image
              source={require('../assets/logo.png')}
              style={s.brandLogo}
              resizeMode="contain"
            />
            <Text style={s.brandText}>Gospelar</Text>
          </View>
          <TouchableOpacity
            onPress={finishOnboarding}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Skip onboarding"
          >
            <Text style={s.skipTxt}>{t('ob_skip', 'Skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Swipeable slide deck. Pager-style ScrollView with snap-to-page. */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={s.deck}
        >
          {SLIDES.map((slide) => (
            <Slide key={slide.key} slide={slide} />
          ))}
        </ScrollView>

        {/* Pagination dots — width animates on the active dot via a small
            scrollX interpolation per dot so the active one stretches into a
            pill shape, matching common modern onboarding patterns. */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [
              (i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W,
            ];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  s.dot,
                  { width: dotWidth, opacity: dotOpacity, backgroundColor: i === index ? DOT_ACTIVE : DOT_INACTIVE },
                ]}
              />
            );
          })}
        </View>

        {/* Primary CTA — "Next" on intermediate slides, "Get Started" on the
            last. Tapping anywhere on this button advances or finishes. */}
        <View style={s.footer}>
          <TouchableOpacity
            onPress={onNext}
            activeOpacity={0.85}
            style={s.cta}
          >
            <Text style={s.ctaTxt}>
              {index === SLIDES.length - 1
                ? t('ob_get_started', 'Get Started')
                : t('ob_next', 'Next')}
            </Text>
            <ICONS.ArrowRight color={CTA_FG} size={18} sw={2.25} />
          </TouchableOpacity>

          {/* Sign-in deep-link for returning users who reinstalled the app
              and don't need the tour — sends them straight to Login while
              still recording the onboarding flag so they're not nagged. */}
          <TouchableOpacity
            onPress={finishOnboarding}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginTop: 14, alignSelf: 'center' }}
          >
            <Text style={s.signInLink}>
              {t('ob_have_account', 'Already have an account? ')}
              <Text style={s.signInLinkBold}>{t('ob_sign_in', 'Sign in')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Per-slide layout. Lives in this file because each slide's content is
// trivial enough that splitting it would just be ceremony.
function Slide({ slide }) {
  const { Icon, tone, title, body } = slide;
  return (
    <View style={[s.slide, { width: SCREEN_W }]}>
      <View style={s.iconWrap}>
        {/* Outer halo — soft glow under the tinted badge so it sits in space
            rather than floating flat on the gradient. */}
        <View style={s.iconHalo} />
        <TintedIcon Icon={Icon} tone={tone} size="lg" sw={2.4} />
      </View>
      <Text style={s.slideTitle} numberOfLines={2}>{title}</Text>
      <Text style={s.slideBody}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 4,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: { width: 28, height: 28 },
  brandText: { color: TEXT_LIGHT, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  skipTxt:   { color: TEXT_MUTED, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },

  deck: { flex: 1 },

  slide: {
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 132, height: 132,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 36,
  },
  iconHalo: {
    position: 'absolute',
    width: 132, height: 132, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  slideTitle: {
    color: TEXT_LIGHT,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 16,
  },
  slideBody: {
    color: TEXT_MUTED,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CTA_BG,
    paddingVertical: 16,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaTxt: {
    color: CTA_FG,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  signInLink:     { color: TEXT_MUTED, fontSize: 13, fontWeight: '500' },
  signInLinkBold: { color: TEXT_LIGHT, fontWeight: '900' },
});
