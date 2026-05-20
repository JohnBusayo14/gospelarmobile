// screens/OnboardingScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// First-launch onboarding. Four swipeable image-led slides that auto-advance
// every 4s, then a "Get Started" CTA that flips a persistent AsyncStorage
// flag and routes the user to Login.
//
// Auto-play behaviour:
//   • interval advances the page every AUTO_MS
//   • last slide → loops back to first (so the carousel is endless until
//     the user taps)
//   • any manual interaction (swipe / dot tap / Next) pauses auto-play
//     and resumes it after RESUME_MS of inactivity
//
// Routing wiring: SplashScreen reads `hasOnboarded` from AsyncStorage and
// sends first-time users here before Login. Subsequent launches skip this
// screen entirely.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';
import { ICONS } from '../components/icons';

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

// Auto-play tuning. AUTO_MS is the cadence; RESUME_MS is how long we wait
// after the user touches the carousel before resuming auto-advance.
const AUTO_MS   = 4000;
const RESUME_MS = 6000;

// Slide definitions. Each slide picks a real image from assets/, plus
// translation-aware title + body via useLanguage's t(). Adding a slide is
// just a new entry — auto-play, swipe, dots, and CTA copy all derive from
// SLIDES.length.
function makeSlides(t) {
  return [
    {
      key:   'welcome',
      image: require('../assets/welcome.png'),
      title: t('ob_welcome_title', 'Welcome to Gospelar'),
      body:  t(
        'ob_welcome_body',
        'Your Sunday School companion — lessons, devotionals, prayer, and your church identity, all in one place.',
      ),
    },
    {
      key:   'lessons',
      image: require('../assets/sunday school class.png'),
      title: t('ob_lessons_title', 'Sunday School, every week'),
      body:  t(
        'ob_lessons_body',
        'Read this quarter\'s lessons across Adult, Youth, Intermediate, and Children\'s classes — with audio reading, memory verses, and quizzes.',
      ),
    },
    {
      key:   'prayer',
      image: require('../assets/prayer.png'),
      title: t('ob_prayer_title', 'Victory Month Prayer'),
      body:  t(
        'ob_prayer_body',
        'Walk the 30-day prayer journey — fasting tools, audio prayer rooms, vigils, and the daily intercession bulletin.',
      ),
    },
    {
      key:   'identity',
      image: require('../assets/identification.png'),
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
  const [autoPlay, setAutoPlay] = useState(true);
  const resumeTimerRef = useRef(null);

  // Auto-advance loop. Re-runs whenever index or autoPlay flips so the
  // setInterval always sees the latest index without stale-closure bugs.
  useEffect(() => {
    if (!autoPlay) return undefined;
    const id = setInterval(() => {
      const next = (index + 1) % SLIDES.length;
      scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [autoPlay, index, SLIDES.length]);

  // Clear any pending resume timer on unmount.
  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  // Pause auto-play on touch, schedule a resume after RESUME_MS of idle.
  function pauseAuto() {
    setAutoPlay(false);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setAutoPlay(true), RESUME_MS);
  }

  function onScroll(ev) {
    const x = ev.nativeEvent.contentOffset.x;
    scrollX.setValue(x);
    const next = Math.round(x / SCREEN_W);
    if (next !== index) setIndex(next);
  }

  function goToSlide(i) {
    pauseAuto();
    scrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
  }

  async function finishOnboarding() {
    try { await AsyncStorage.setItem(ONBOARDED_KEY, '1'); } catch { /* harmless */ }
    navigation.replace('Login');
  }

  function onNext() {
    pauseAuto();
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * SCREEN_W, animated: true });
    } else {
      finishOnboarding();
    }
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

        {/* Swipeable slide deck. onScrollBeginDrag pauses auto-play
            immediately so user gestures always feel responsive. */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          onScrollBeginDrag={pauseAuto}
          scrollEventThrottle={16}
          style={s.deck}
        >
          {SLIDES.map((slide) => (
            <Slide key={slide.key} slide={slide} />
          ))}
        </ScrollView>

        {/* Pagination dots — width animates on the active dot via a small
            scrollX interpolation per dot so the active one stretches into a
            pill shape. Tapping a dot jumps to that slide. */}
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
              <TouchableOpacity
                key={i}
                onPress={() => goToSlide(i)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <Animated.View
                  style={[
                    s.dot,
                    { width: dotWidth, opacity: dotOpacity, backgroundColor: i === index ? DOT_ACTIVE : DOT_INACTIVE },
                  ]}
                />
              </TouchableOpacity>
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

// Per-slide layout. Image hero on top, title + body underneath. The
// images are transparent character illustrations, so we use resizeMode
// 'contain' (preserve aspect, no crop) and skip the dark card backdrop
// from the previous version — the gradient screen background reads
// through cleanly behind the figures.
function Slide({ slide }) {
  const { image, title, body } = slide;
  return (
    <View style={[s.slide, { width: SCREEN_W }]}>
      <View style={s.imageWrap}>
        {/* Subtle soft glow behind the figure — pulls focus to the
            illustration without putting it in a hard-edged card. */}
        <View style={s.imageGlow} />
        <Image source={image} style={s.image} resizeMode="contain" />
      </View>
      <Text style={s.slideTitle} numberOfLines={2}>{title}</Text>
      <Text style={s.slideBody}>{body}</Text>
    </View>
  );
}

// Image hero sizing — larger than the previous photo card. Transparent
// PNG illustrations look best when they take the dominant share of the
// screen, capped at ~50% of viewport height so there's still room for
// title + body + dots + CTA on a typical 6.1" phone (~844pt).
const IMAGE_W = SCREEN_W - 24;
const IMAGE_H = Math.min(IMAGE_W, SCREEN_H * 0.50);

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
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  imageWrap: {
    width: IMAGE_W,
    height: IMAGE_H,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  // Soft radial-feel halo sitting behind the illustration. Pure View with
  // a translucent white fill + huge corner radius reads as a light glow
  // against the dark gradient backdrop.
  imageGlow: {
    position: 'absolute',
    width: IMAGE_W * 0.78,
    height: IMAGE_W * 0.78,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  image: { width: '100%', height: '100%' },

  slideTitle: {
    color: TEXT_LIGHT,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
  },
  slideBody: {
    color: TEXT_MUTED,
    fontSize: 14.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 18,
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
