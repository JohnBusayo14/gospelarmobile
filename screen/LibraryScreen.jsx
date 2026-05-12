// screens/LibraryScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The post-auth launcher screen. Lists every book in the catalog as a featured
// hero card on top + a 2-column grid below. Tap behavior depends on state:
//
//   • subscribed (or book.requiresSubscription === false) → navigate to homepage
//   • locked, requiresSubscription                         → BookPaywallScreen
//   • available === false                                  → "Coming Soon" alert
//
// Featured book = first BOOK entry with available === true. Everything else
// falls into the grid below. This lets us promote Sunday School today and
// flip the order later (e.g. push Victory Month Prayer as the seasonal
// flagship) by reordering frontend/data/books.js — no screen code change.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ImageBackground, Animated, Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { useTheme }      from '../context/ThemeContext';
import { useLanguage }   from '../context/LanguageContext';
import { useSubscription } from '../context/SubscriptionContext';
import { getTokens, PALETTE } from '../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../hooks/useFluidAnim';
import { LinearGradient } from 'expo-linear-gradient';
import { BOOKS } from '../data/books';
import { fetchBooks } from '../services/api';
import { ICONS } from '../components/icons';
import { allLive, allRecorded } from './victory/victoryAudioData';
import { useUserRooms } from './victory/victoryHooks';

// Normalize a row from /api/books into the shape the cards already render.
// Falls back to the matching local BOOKS entry for image assets (require())
// since the DB only stores absolute URLs and our placeholder books haven't
// shipped real CDN-hosted covers yet.
function normalizeBook(row) {
  const fallback = BOOKS.find((b) => b.id === row.slug || b.id === row.id) || {};
  return {
    id:                  row.slug || fallback.id,
    title:               row.title || fallback.title,
    subtitle:            row.subtitle || fallback.subtitle,
    description:         row.description || fallback.description,
    cover:               fallback.cover,                       // local require() if we have one
    cover_image_url:     row.cover_image_url || null,          // remote URL if seeded
    cover_emoji:         row.cover_emoji || fallback.cover_emoji || '📖',
    accent:              row.accent_color || fallback.accent || PALETTE.blue,
    available:           row.available !== false,
    requiresSubscription:fallback.requiresSubscription || false,
    pricing:             fallback.pricing || null,
    route:               row.route_screen === 'BookReader' ? 'BookReader' : (row.route_screen || fallback.route || 'HomeScreen'),
    routeParams:         row.route_screen === 'BookReader'
                           ? { bookSlug: row.slug, bookTitle: row.title, accent: row.accent_color }
                           : (fallback.routeParams || undefined),
    entries_count:       parseInt(row.entries_count || 0, 10),
  };
}

const { width } = Dimensions.get('window');
const GUTTER      = 20;
const COL_GAP     = 14;
const CARD_WIDTH  = (width - GUTTER * 2 - COL_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.35;

const BLUE       = PALETTE.blue;
const BLUE_LIGHT = '#EFF6FF';

const fmtNaira = (kobo) => '₦' + Math.round((kobo || 0) / 100).toLocaleString();

// Resolve the visual + tap state for a card. Pure function so it can be
// tested independently of the React tree if we ever want to.
//   returns { state: 'subscribed' | 'locked' | 'coming_soon' | 'open',
//             pillTxt, pillBg, pillFg, showLock }
function resolveCardState(book, canAccessBook, t) {
  if (book.available === false) {
    return {
      state: 'coming_soon',
      pillTxt: t('lib_coming_soon', 'Coming Soon'),
      pillBg:  '#F59E0B',
      pillFg:  '#fff',
      showLock: false,
    };
  }
  if (book.requiresSubscription) {
    if (canAccessBook(book.id)) {
      return {
        state: 'subscribed',
        pillTxt: t('lib_owned', 'Owned'),
        pillBg:  '#10B981',
        pillFg:  '#fff',
        showLock: false,
      };
    }
    const price = book.pricing?.price_kobo || 50000;
    return {
      state: 'locked',
      pillTxt: fmtNaira(price),
      pillBg:  book.accent,
      pillFg:  '#fff',
      showLock: true,
    };
  }
  return {
    state: 'open',
    pillTxt: t('lib_available', 'Available'),
    pillBg:  '#10B981',
    pillFg:  '#fff',
    showLock: false,
  };
}

// ── Featured hero card (full width, 2:1 ratio) ────────────────────────────────
const FeaturedCard = ({ book, onPress, t }) => {
  if (!book) return null;
  const { fade, translateY } = useStaggerEntry(0);

  // Pick whichever cover source is available; fall back to the book's accent
  // colour so we never render a broken image area.
  const Inner = () => (
    <View style={s.featuredInner}>
      <View style={s.featuredBadge}>
        <Text style={s.featuredBadgeTxt}>{t('lib_featured', 'FEATURED')}</Text>
      </View>
      <View>
        <Text style={s.featuredTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={s.featuredSubtitle} numberOfLines={1}>{book.subtitle}</Text>
        <View style={s.featuredCta}>
          <Text style={s.featuredCtaTxt}>{t('lib_open_book', 'Open book')}  →</Text>
        </View>
      </View>
    </View>
  );
  const source = book.cover_image_url ? { uri: book.cover_image_url } : book.cover;

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }], paddingHorizontal: GUTTER, marginBottom: 18 }}>
      <TouchableOpacity onPress={() => onPress(book)} activeOpacity={0.88} style={s.featuredCard}>
        {source ? (
          <ImageBackground source={source} style={s.featuredImg} imageStyle={s.featuredImgRadius}>
            <View style={[s.featuredTint, { backgroundColor: book.accent + 'B0' }]} />
            <Inner />
          </ImageBackground>
        ) : (
          // No image at all — solid accent background with the book's emoji glyph.
          <View style={[s.featuredImg, s.featuredImgRadius, { backgroundColor: book.accent }]}>
            <Text style={s.featuredEmoji}>{book.cover_emoji || '📖'}</Text>
            <Inner />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Audio Rooms hero card ────────────────────────────────────────────────────
// First content on the Library home — the community-prayer entry point. Lives
// here (not inside Victory Month) so any signed-in user can join a live or
// recorded session regardless of book subscription state.
const AudioRoomsCard = ({ onPress, t }) => {
  const { fade, translateY } = useStaggerEntry(0);
  // Real counts so the card reflects activity instead of static copy.
  const { list: userRooms = [] } = useUserRooms();
  const liveCount     = allLive(userRooms).length;
  const recordedCount = allRecorded(userRooms).length;
  return (
    <Animated.View
      style={{ opacity: fade, transform: [{ translateY }], paddingHorizontal: GUTTER, marginBottom: 22 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={s.audioCard}>
        <LinearGradient
          colors={['#1E3A8A', '#1A56DB', '#3B82F6']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.audioGradient}
        >
          {/* Decorative orbs for depth */}
          <View style={[s.audioOrb, { top: -28, right: -20 }]} />
          <View style={[s.audioOrb, { bottom: -32, left: -22, opacity: 0.4 }]} />

          {/* Header row: live badge + animated-looking waveform decoration */}
          <View style={s.audioHeadRow}>
            <View style={s.audioLiveBadge}>
              <View style={s.audioLiveDot} />
              <Text style={s.audioLiveTxt}>{t('lib_audio_live', 'LIVE NOW')}</Text>
            </View>
            <View style={s.audioWave}>
              {[6, 14, 10, 18, 12, 8, 16, 11].map((h, i) => (
                <View key={i} style={[s.audioWaveBar, { height: h }]} />
              ))}
            </View>
          </View>

          {/* Body */}
          <Text style={s.audioTitle}>
            {t('lib_audio_title', 'Audio Prayer Rooms')}
          </Text>
          <Text style={s.audioSub} numberOfLines={2}>
            {t('lib_audio_sub', 'Join a community of believers praying together — live or on demand.')}
          </Text>

          {/* Stats + CTA */}
          <View style={s.audioFootRow}>
            <View style={s.audioStats}>
              <View style={s.audioStatPill}>
                <Text style={s.audioStatVal}>{liveCount}</Text>
                <Text style={s.audioStatLbl}>{t('lib_audio_live_count', 'live')}</Text>
              </View>
              <View style={s.audioStatPill}>
                <Text style={s.audioStatVal}>{recordedCount}</Text>
                <Text style={s.audioStatLbl}>{t('lib_audio_recorded', 'recorded')}</Text>
              </View>
            </View>
            <View style={s.audioCta}>
              <Text style={s.audioCtaTxt}>{t('lib_audio_open', 'Open rooms')}  →</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Grid card ─────────────────────────────────────────────────────────────────
const BookCard = ({ book, index, onPress, tk, isDark, t, canAccessBook }) => {
  const { fade, translateY } = useStaggerEntry(index + 1);
  const cardState = resolveCardState(book, canAccessBook, t);
  const dim       = cardState.state === 'coming_soon';

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }], width: CARD_WIDTH }}>
      <TouchableOpacity
        onPress={() => onPress(book)}
        activeOpacity={0.85}
        style={[
          s.card,
          { backgroundColor: tk.surface, borderColor: tk.border, opacity: dim ? 0.78 : 1 },
        ]}
      >
        {/* Cover image with accent gradient overlay */}
        <View style={[s.cover, { backgroundColor: book.accent + '22' }]}>
          {book.cover_image_url ? (
            // Remote URL from /api/books — admin-uploaded cover.
            <ImageBackground source={{ uri: book.cover_image_url }} style={s.coverImg} imageStyle={s.coverImgRadius}>
              <View style={[s.coverTint, { backgroundColor: book.accent + (dim ? 'AA' : '55') }]} />
              {cardState.showLock && (
                <View style={s.lockChip}><ICONS.Lock color="#fff" size={14} sw={2.4} /></View>
              )}
            </ImageBackground>
          ) : book.cover ? (
            // Bundled require()'d image (used for the legacy local entries).
            <ImageBackground source={book.cover} style={s.coverImg} imageStyle={s.coverImgRadius}>
              <View style={[s.coverTint, { backgroundColor: book.accent + (dim ? 'AA' : '55') }]} />
              {cardState.showLock && (
                <View style={s.lockChip}><ICONS.Lock color="#fff" size={14} sw={2.4} /></View>
              )}
            </ImageBackground>
          ) : (
            // No cover at all — render the book's emoji glyph on its accent tint.
            <View style={[s.coverImg, s.coverImgRadius, { backgroundColor: book.accent, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={s.coverEmoji}>{book.cover_emoji || '📖'}</Text>
              {cardState.showLock && (
                <View style={s.lockChip}><ICONS.Lock color="#fff" size={14} sw={2.4} /></View>
              )}
            </View>
          )}

          {/* Status pill — top-right corner */}
          <View style={[s.pill, { backgroundColor: cardState.pillBg }]}>
            <Text style={[s.pillTxt, { color: cardState.pillFg }]}>{cardState.pillTxt}</Text>
          </View>
        </View>

        {/* Title + subtitle */}
        <View style={s.cardBody}>
          <Text style={[s.title, { color: tk.textPrimary }]} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={[s.subtitle, { color: tk.textMuted }]} numberOfLines={1}>
            {book.subtitle}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LibraryScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const { canAccessBook, isSubscribed } = useSubscription();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  // Ref so the brand-mark tap can scroll the page back to the top. Avoids any
  // navigation-side-effect on tap, which was the crash vector reported as
  // "[stopTracking of undefined]" when the logo was wired to navigate or reset.
  const scrollRef = useRef(null);
  const scrollToTop = () => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  };

  // Catalog comes from the server. cacheFirst means we render the cached list
  // instantly offline; if there's no cache (first launch, no network) we
  // still fall back to the bundled BOOKS array so the user sees something.
  const [catalog, setCatalog] = useState(BOOKS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchBooks()
      .then((rows) => {
        if (cancelled) return;
        const list = (Array.isArray(rows) && rows.length > 0)
          ? rows.map(normalizeBook)
          : BOOKS;
        setCatalog(list);
      })
      .catch(() => { /* keep BOOKS fallback */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Featured book = first AVAILABLE book in the catalog. Everything else
  // (including coming-soon entries) goes in the grid.
  const featured = useMemo(() => catalog.find((b) => b.available !== false), [catalog]);
  const others   = useMemo(() => catalog.filter((b) => b !== featured), [catalog, featured]);

  const handleOpen = async (book) => {
    // Coming-soon — same legacy behavior
    if (book.available === false) {
      Alert.alert(
        book.title,
        book.description,
        [
          {
            text: t('lib_notify_me', 'Notify me'),
            onPress: async () => {
              try { await AsyncStorage.setItem(`book_interest_${book.id}`, '1'); } catch {}
            },
          },
          { text: t('btn_ok', 'OK'), style: 'cancel' },
        ],
      );
      return;
    }
    // Per-book paywall (Victory Month etc.) — preview + Subscribe
    if (book.requiresSubscription && !canAccessBook(book.id)) {
      navigation.navigate('BookPaywall', { bookId: book.id });
      return;
    }
    // Sunday School path: gated by canAccessCategory under the hood. If the
    // user has no general subscription yet, route them straight to the
    // Subscribe page (with a back arrow) instead of bouncing through the
    // HomeScreen + SubscriptionGuard ping-pong.
    if (book.route === 'HomeScreen' && !isSubscribed) {
      navigation.navigate('PaymentScreen', { fromLibrary: true });
      return;
    }
    // Open — either no subscription required, or the user already owns it.
    navigation.navigate(book.route, book.routeParams);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: fade, transform: [{ translateY }] }}
      >
        {/* TOP BAR — brand on the left taps to scroll back to top (safe,
            in-screen action that has no navigation side-effects). */}
        <View style={[s.topbar, { backgroundColor: tk.bg }]}>
          <TouchableOpacity
            onPress={scrollToTop}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Scroll to top"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View style={[s.brandMark, { backgroundColor: BLUE }]}>
              <Text style={s.brandMarkTxt}>G</Text>
            </View>
            <View>
              <Text style={[s.brand,    { color: tk.textPrimary }]}>Gospelar</Text>
              <Text style={[s.brandSub, { color: tk.textMuted   }]}>
                {t('lib_library_caps', 'LIBRARY')}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.75}
            accessibilityLabel="Settings"
            style={[s.iconBtn, { backgroundColor: tk.surfaceEl }]}
          >
            <ICONS.Settings color={tk.textPrimary} size={18} sw={1.9} />
          </TouchableOpacity>
        </View>

        {/* COMPACT HERO — just a welcome line; the screen leads with action,
            not a wall of copy. */}
        <View style={s.heroCompact}>
          <Text style={[s.heroLabel, { color: BLUE }]}>
            {t('lib_eyebrow', 'YOUR LIBRARY')}
          </Text>
          <Text style={[s.heroTitleCompact, { color: tk.textPrimary }]}>
            {t('lib_title_short', 'Welcome')}
          </Text>
        </View>

        {/* AUDIO PRAYER ROOMS — first thing the user sees on entry. Always
            available regardless of book subscription so the wider community
            can pray together. */}
        <AudioRoomsCard
          onPress={() => navigation.navigate('VictoryAudioRoomList')}
          t={t}
        />

        {/* SECTION DIVIDER — Books section header */}
        <View style={s.sectionDivider}>
          <Text style={[s.sectionTitle, { color: tk.textPrimary }]}>
            {t('lib_books_section', 'Books')}
          </Text>
          <Text style={[s.sectionSub, { color: tk.textMuted }]}>
            {t('lib_sub', 'Tap any cover to open. New books arrive every quarter.')}
          </Text>
        </View>

        {/* FEATURED */}
        <FeaturedCard book={featured} onPress={handleOpen} t={t} />

        {/* GRID HEADER */}
        {others.length > 0 && (
          <View style={s.gridHead}>
            <Text style={[s.gridHeadTitle, { color: tk.textPrimary }]}>
              {t('lib_more_books', 'More books')}
            </Text>
            <Text style={[s.gridHeadCount, { color: tk.textMuted }]}>
              {others.length} {others.length === 1 ? t('lib_book', 'book') : t('lib_books', 'books')}
            </Text>
          </View>
        )}

        {/* GRID */}
        <View style={s.grid}>
          {others.map((book, i) => (
            <BookCard
              key={book.id}
              book={book}
              index={i}
              onPress={handleOpen}
              tk={tk}
              isDark={isDark}
              t={t}
              canAccessBook={canAccessBook}
            />
          ))}
        </View>

        <View style={s.footer}>
          <Text style={[s.footerTxt, { color: tk.textMuted }]}>
            {t('lib_footer', '© Gospelar Sunday School Department')}
          </Text>
          <Text style={[s.footerLink, { color: BLUE }]}>www.gospelar.com</Text>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Topbar
  topbar: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: GUTTER,
    paddingTop:        8,
    paddingBottom:     14,
  },
  brandMark: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  brandMarkTxt: { color:'#fff', fontWeight:'900', fontSize:18, letterSpacing:-0.4 },
  brand:        { fontSize:16, fontWeight:'900', letterSpacing:-0.3 },
  brandSub:     { fontSize:9.5, fontWeight:'800', letterSpacing:2, marginTop:2 },
  iconBtn:      { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },

  // Hero
  hero:       { paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 22 },
  heroLabel:  { fontSize:10.5, fontWeight:'900', letterSpacing:2, marginBottom:8 },
  heroTitle:  { fontSize:30, fontWeight:'900', letterSpacing:-1, lineHeight:36, marginBottom:8 },
  heroSub:    { fontSize:14, lineHeight:20, fontWeight:'500', maxWidth:300 },

  // Compact hero — used when audio rooms get top billing
  heroCompact:      { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 16 },
  heroTitleCompact: { fontSize: 24, fontWeight: '900', letterSpacing: -0.6, lineHeight: 28, marginTop: 4 },

  // Books section divider (between Audio Rooms and the featured book)
  sectionDivider: {
    paddingHorizontal: GUTTER,
    paddingTop: 6, paddingBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  sectionSub:   { fontSize: 13, fontWeight: '500', lineHeight: 18 },

  // Audio Rooms hero card
  audioCard: {
    borderRadius: 22, overflow: 'hidden',
    shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30, shadowRadius: 20, elevation: 8,
  },
  audioGradient: { padding: 20, overflow: 'hidden' },
  audioOrb: {
    position: 'absolute', width: 120, height: 120,
    borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.16)',
  },
  audioHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  audioLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: 'rgba(239, 68, 68, 0.85)',
  },
  audioLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  audioLiveTxt: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  audioWave:    { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20 },
  audioWaveBar: { width: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.65)' },
  audioTitle:   { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, lineHeight: 28 },
  audioSub:     { color: 'rgba(255,255,255,0.86)', fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 6, marginBottom: 16 },
  audioFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  audioStats:   { flexDirection: 'row', gap: 8 },
  audioStatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)',
  },
  audioStatVal: { color: '#fff', fontSize: 13, fontWeight: '900' },
  audioStatLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  audioCta: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  audioCtaTxt: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },

  // Featured card
  featuredCard: {
    borderRadius: 22, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 6,
  },
  featuredImg: { aspectRatio: 16/9, justifyContent: 'flex-end' },
  featuredImgRadius: { borderRadius: 22 },
  featuredTint:{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  featuredInner: { padding: 22, justifyContent: 'space-between', flex: 1 },
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
  },
  featuredBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  featuredTitle:    { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.6, lineHeight: 30, marginBottom: 4 },
  featuredSubtitle: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '700', marginBottom: 14 },
  featuredCta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12,
  },
  featuredCtaTxt: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },

  // Grid header
  gridHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GUTTER, marginBottom: 12, marginTop: 4,
  },
  gridHeadTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  gridHeadCount: { fontSize: 12, fontWeight: '700' },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    paddingHorizontal: GUTTER,
    gap:           COL_GAP,
  },

  // Card
  card: {
    borderRadius:  18,
    borderWidth:   1,
    overflow:      'hidden',
    marginBottom:  COL_GAP,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius:  12,
    elevation:     3,
  },
  cover: {
    width:  CARD_WIDTH,
    height: CARD_HEIGHT * 0.62,
    position: 'relative',
  },
  coverImg:       { flex: 1 },
  coverImgRadius: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  coverTint:      { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  coverGlyph:     { fontSize: 30, color: '#FFFFFFDD' },
  // Big emoji used when a book has no cover image (uses cover_emoji from API).
  coverEmoji:     { fontSize: 56, color: '#fff' },
  featuredEmoji:  { fontSize: 110, color: '#FFFFFF22', position: 'absolute', right: 18, top: 14 },

  // Lock chip overlay (top-left of locked card)
  lockChip: {
    position: 'absolute', top: 10, left: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  lockChipTxt: { color: '#fff', fontSize: 14 },

  // Status pill (top-right of card)
  pill: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999,
  },
  pillTxt: { fontWeight: '900', fontSize: 9.5, letterSpacing: 0.5 },

  cardBody: { padding: 14 },
  title:    { fontSize: 14, fontWeight: '800', letterSpacing: -0.2, lineHeight: 18, marginBottom: 4 },
  subtitle: { fontSize: 11.5, fontWeight: '600' },

  // Footer
  footer:    { alignItems:'center', marginTop: 18, paddingHorizontal: GUTTER, gap: 4 },
  footerTxt: { fontSize: 11, fontWeight: '500' },
  footerLink:{ fontSize: 12, fontWeight: '700' },
});
