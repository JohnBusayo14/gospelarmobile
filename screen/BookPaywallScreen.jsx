// screens/BookPaywallScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Preview + paywall for any book whose `requiresSubscription: true` flag is
// set in frontend/data/books.js. Renders the cover, description, sample
// "What's inside" rows, and a sticky bottom Subscribe CTA.
//
// Route params: { bookId }
//   Falls back to the Library if the bookId is unknown — no crashes if a
//   stale deep link points at a deleted book.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ImageBackground, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }     from '../context/ThemeContext';
import { useLanguage }  from '../context/LanguageContext';
import { useSubscription } from '../context/SubscriptionContext';
import { getTokens, PALETTE } from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';
import { ICONS } from '../components/AppTabBar';
import { BOOKS } from '../data/books';

const { width } = Dimensions.get('window');
const BLUE      = PALETTE.blue;

const fmtNaira = (kobo) => '₦' + Math.round((kobo || 0) / 100).toLocaleString();

export default function BookPaywallScreen({ route, navigation }) {
  const { bookId } = route.params || {};
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const { canAccessBook, recheck, isSubscribed } = useSubscription();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const book = useMemo(() => BOOKS.find((b) => b.id === bookId), [bookId]);

  // If they already own this book (e.g. they reopened the deep link after
  // paying), drop them into the book's homepage instead of showing the wall.
  useEffect(() => {
    if (book && canAccessBook(book.id)) {
      navigation.replace(book.route, book.routeParams);
    }
  }, [book, canAccessBook, navigation]);

  // Unknown book → silent bounce back to Library.
  if (!book) {
    navigation.replace('Library');
    return null;
  }

  const price = book.pricing?.price_kobo || 50000;

  const handleSubscribe = () => {
    navigation.navigate('PaymentScreen', {
      book_id: book.id,
      book_title: book.title,
      plan_id: book.pricing?.plan_id || `book_${book.id}`,
      price_kobo: price,
      accent: book.accent,
    });
  };

  // "Already paid on another device?" → force a server refresh so any new
  // entitlement reflected in subscribed_books gets pulled down.
  const handleRecheck = async () => {
    await recheck();
    if (canAccessBook(book.id)) {
      navigation.replace(book.route, book.routeParams);
    } else {
      Alert.alert(
        t('paywall_not_found_title', 'Subscription not found'),
        t('paywall_not_found_msg', "We couldn't find a {book} subscription on this account. Tap Subscribe to start a new one.").replace('{book}', book.title),
      );
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        style={{ opacity: fade, transform: [{ translateY }] }}
      >
        {/* TOP BAR */}
        <View style={[s.topbar, { backgroundColor: tk.bg }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor: tk.surfaceEl }]}>
            <ICONS.ArrowLeft color={tk.textPrimary} size={20} sw={2} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.topLabel, { color: tk.textMuted }]}>{t('paywall_caps', 'PREVIEW')}</Text>
          </View>
          <View style={[s.iconBtn, { opacity: 0 }]} />{/* spacer to balance back btn */}
        </View>

        {/* HERO COVER */}
        <View style={s.heroWrap}>
          <ImageBackground source={book.cover} style={s.hero} imageStyle={s.heroImg}>
            <View style={[s.heroTint, { backgroundColor: book.accent + 'B0' }]} />
            <View style={s.heroInner}>
              <View style={s.lockPill}>
                <ICONS.Lock color="#fff" size={12} sw={2.4} />
                <Text style={s.lockPillTxt}>{fmtNaira(price)} · {t('paywall_lifetime_or_renew', 'subscription')}</Text>
              </View>
              <Text style={s.heroTitle} numberOfLines={2}>{book.title}</Text>
              <Text style={s.heroSub} numberOfLines={1}>{book.subtitle}</Text>
            </View>
          </ImageBackground>
        </View>

        {/* DESCRIPTION */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: tk.textMuted }]}>{t('paywall_about', 'ABOUT THIS BOOK')}</Text>
          <Text style={[s.descr, { color: tk.textSec }]}>{book.description}</Text>
        </View>

        {/* WHAT'S INSIDE — pulled from book.preview */}
        {Array.isArray(book.preview) && book.preview.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: tk.textMuted }]}>{t('paywall_inside', "WHAT'S INSIDE")}</Text>
            <View style={[s.previewCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
              {book.preview.map((p, i) => (
                <View key={i} style={[s.previewRow, i < book.preview.length - 1 && { borderBottomWidth: 1, borderBottomColor: tk.border }]}>
                  <View style={[s.previewDay, { backgroundColor: book.accent + '18' }]}>
                    <Text style={[s.previewDayTxt, { color: book.accent }]}>
                      {p.day != null ? String(p.day).padStart(2, '0') : (i + 1).toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.previewTitle, { color: tk.textPrimary }]} numberOfLines={1}>{p.title}</Text>
                    {!!p.scripture && (
                      <View style={s.previewMeta}>
                        <ICONS.Book color={tk.textMuted} size={11} sw={2} />
                        <Text style={[s.previewMetaTxt, { color: tk.textMuted }]}>{p.scripture}</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.previewLockMini}>
                    <ICONS.Lock color={tk.textMuted} size={12} sw={2.2} />
                  </View>
                </View>
              ))}
              <View style={[s.previewFooter, { borderTopColor: tk.border }]}>
                <Text style={[s.previewFooterTxt, { color: tk.textMuted }]}>
                  {t('paywall_unlock_to_read', 'Subscribe to unlock every day.')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* TRUST STRIP */}
        <View style={s.section}>
          <View style={[s.trustRow, { backgroundColor: tk.surface, borderColor: tk.border }]}>
            <View style={s.trustItem}>
              <ICONS.Book color={tk.textPrimary} size={18} sw={1.9} />
              <Text style={[s.trustTxt, { color: tk.textPrimary }]}>{t('paywall_offline', 'Offline-friendly')}</Text>
            </View>
            <View style={[s.trustDivider, { backgroundColor: tk.border }]} />
            <View style={s.trustItem}>
              <ICONS.Globe color={tk.textPrimary} size={18} sw={1.9} />
              <Text style={[s.trustTxt, { color: tk.textPrimary }]}>{t('paywall_languages', '4 languages')}</Text>
            </View>
            <View style={[s.trustDivider, { backgroundColor: tk.border }]} />
            <View style={s.trustItem}>
              <ICONS.Lock color={tk.textPrimary} size={18} sw={1.9} />
              <Text style={[s.trustTxt, { color: tk.textPrimary }]}>{t('paywall_secure_pay', 'Secure pay')}</Text>
            </View>
          </View>
        </View>

        {/* RECHECK LINK */}
        {!isSubscribed && (
          <TouchableOpacity onPress={handleRecheck} activeOpacity={0.75} style={s.recheckBtn}>
            <Text style={[s.recheckTxt, { color: tk.textMuted }]}>
              {t('paywall_already_subscribed', 'Already subscribed? Refresh status')}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.ScrollView>

      {/* STICKY CTA */}
      <View style={[s.ctaWrap, { backgroundColor: tk.bg, borderTopColor: tk.border }]}>
        <View style={s.ctaPrice}>
          <Text style={[s.ctaPriceLabel, { color: tk.textMuted }]}>{t('paywall_price_label', 'PRICE')}</Text>
          <Text style={[s.ctaPriceTxt,   { color: tk.textPrimary }]}>{fmtNaira(price)}</Text>
        </View>
        <TouchableOpacity onPress={handleSubscribe} activeOpacity={0.85}
          style={[s.cta, { backgroundColor: book.accent }]}>
          <Text style={s.ctaTxt}>{t('paywall_subscribe', 'Subscribe')}</Text>
          <ICONS.ArrowLeft color="#fff" size={18} sw={2.4} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  iconBtn:  { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  topLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },

  // Hero
  heroWrap: { paddingHorizontal: 20, marginBottom: 24 },
  hero:     { aspectRatio: 16/10, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImg:  { borderRadius: 22 },
  heroTint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroInner:{ padding: 20 },
  lockPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.32)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, marginBottom: 14,
  },
  lockPillTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.8, lineHeight: 32, marginBottom: 6 },
  heroSub:   { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: '700' },

  // Sections
  section:      { paddingHorizontal: 20, marginBottom: 24 },
  sectionLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  descr:        { fontSize: 14.5, lineHeight: 22 },

  // Preview card
  previewCard:    { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  previewRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  previewDay:     { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  previewDayTxt:  { fontSize: 13, fontWeight: '900', letterSpacing: -0.2 },
  previewTitle:   { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  previewMeta:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  previewMetaTxt: { fontSize: 11, fontWeight: '600' },
  previewLockMini:{ paddingHorizontal: 6 },
  previewFooter:  { borderTopWidth: 1, paddingVertical: 10, alignItems: 'center' },
  previewFooterTxt:{ fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  // Trust strip
  trustRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 6 },
  trustItem:   { flex: 1, alignItems: 'center', gap: 6 },
  trustDivider:{ width: 1, height: 28 },
  trustEmoji:  { fontSize: 18 },
  trustTxt:    { fontSize: 11, fontWeight: '700' },

  // Recheck link
  recheckBtn: { alignItems: 'center', paddingVertical: 14 },
  recheckTxt: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },

  // Sticky CTA
  ctaWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22,
    borderTopWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  ctaPrice:      { alignItems: 'flex-start' },
  ctaPriceLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  ctaPriceTxt:   { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  cta: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
});
