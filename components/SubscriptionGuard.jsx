// components/SubscriptionGuard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// States:
//   loading/unchecked  → spinner
//   serverError        → retry
//   isSubscribed       → render children (+ expiry warning)
//   unsubscribed       → blur + centred 80% card with plan + category steps,
//                        then redirect to PaymentScreen (which opens the
//                        provider's hosted checkout in the SYSTEM BROWSER —
//                        no in-app WebView, for Google Play compliance).
//
// Category access enforcement:
//   planType === 'all'    → all 4 categories unlocked
//   planType === 'single' → only subscribedCategory unlocked
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Easing, ActivityIndicator, Platform, Dimensions,
  ScrollView,
} from 'react-native';
import { BlurView }        from 'expo-blur';
import { LinearGradient }  from 'expo-linear-gradient';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme }        from '../context/ThemeContext';
import { useLanguage }     from '../context/LanguageContext';
import AsyncStorage        from '@react-native-async-storage/async-storage';
import { ICONS }           from './icons';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BLUE        = '#1A56DB';
const BLUE_DARK   = '#0D2EA0';
const BLUE_MID    = '#1D4ED8';
const BLUE_LIGHT  = '#EFF6FF';
const PURPLE      = '#7C3AED';
const PURPLE_DARK = '#5B21B6';
// Paystack credentials live entirely on the backend. This file is purely a
// gate / paywall card — it routes unsubscribed users to PaymentScreen, which
// hands off the actual payment to the system browser via Linking.openURL.
// Do not re-introduce inline.js or in-app payment WebViews here; Google
// Play's Payments policy forbids native WebView checkout for digital content.

// ── Plans ─────────────────────────────────────────────────────────────────────
// Format kobo (1/100 of NGN) → "₦500" / "₦1,000"
const formatNaira = (kobo) => '₦' + (Math.round(kobo / 100)).toLocaleString('en-NG');

// Price + days come from admin-configured pricing in `plans` map
const buildPlans = (t, plans) => [
  {
    id: 'single', label: t('plan_single', 'Single Category'), tagline: t('plan_single_tagline', 'One age group of your choice'),
    price: formatNaira(plans.single.price_kobo), kobo: plans.single.price_kobo, days: plans.single.days,
    icon: '🎯', color: BLUE, gradient: [BLUE, BLUE_MID], tag: t('guard_tag_popular', 'POPULAR'),
    features: [
      t('guard_feat_one_cat', '1 category (your choice)'),
      t('guard_feat_devotionals', '📅 Daily devotionals'),
      t('guard_feat_quizzes', '⚡ Lesson quizzes'),
      t('guard_feat_languages', '🌐 4-language support'),
    ],
  },
  {
    id: 'all', label: t('plan_all', 'All Categories'), tagline: t('plan_all_tagline', 'Every age group unlocked'),
    price: formatNaira(plans.all.price_kobo), kobo: plans.all.price_kobo, days: plans.all.days,
    icon: '🌟', color: PURPLE, gradient: [PURPLE, PURPLE_DARK], tag: t('guard_tag_best_value', 'BEST VALUE'),
    features: [
      t('guard_feat_all_cats', 'All 4 categories'),
      t('guard_feat_devotionals', '📅 Daily devotionals'),
      t('guard_feat_quizzes', '⚡ Lesson quizzes'),
      t('guard_feat_languages', '🌐 4-language support'),
      t('guard_feat_best_value', '🎁 Best value'),
    ],
  },
];

// ── Age categories ─────────────────────────────────────────────────────────────
const buildCategories = (t) => [
  { id: 'children',     label: t('cat_children', 'Children'),         emoji: '👧',   color: '#F97316', desc: t('cat_children_range', 'Ages 4 – 11')  },
  { id: 'intermediate', label: t('cat_intermediate', 'Intermediate'), emoji: '🧒',   color: '#10B981', desc: t('cat_intermediate_range', 'Ages 12 – 17') },
  { id: 'youth',        label: t('cat_youth', 'Youth'),               emoji: '🧑',   color: BLUE,      desc: t('cat_youth_range', 'Ages 18 – 25') },
  { id: 'adult',        label: t('cat_adult', 'Adult'),               emoji: '🧑‍🦳', color: PURPLE,    desc: t('cat_adult_range', '26 & above')   },
];

// ── Expiry warning strip ───────────────────────────────────────────────────────
const sg = StyleSheet.create({
  warningBanner: { flexDirection:'row', alignItems:'center', backgroundColor:'#FEF3C7', paddingHorizontal:14, paddingVertical:10, gap:8, borderBottomWidth:1, borderBottomColor:'#FDE68A' },
  warningIcon:   { fontSize:16 },
  warningTxt:    { flex:1, fontSize:12, fontWeight:'700', color:'#92400E', lineHeight:17 },
  renewBtn:      { borderRadius:8, paddingHorizontal:12, paddingVertical:6, backgroundColor:'#F59E0B' },
  renewTxt:      { fontSize:11, fontWeight:'900', color:'#fff' },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Plan picker
// ─────────────────────────────────────────────────────────────────────────────
const PlanStep = ({ onSelect, t, plans }) => {
  const PLANS = buildPlans(t, plans);
  const [selected, setSelected] = useState(null);

  return (
    <View style={ss.stepWrap}>
      <Text style={ss.stepTitle}>{t('guard_choose_plan', 'Choose your plan')}</Text>
      <Text style={ss.stepSub}>{t('guard_choose_plan_sub', 'Select a subscription that works for you')}</Text>

      {PLANS.map((plan) => {
        const active = selected?.id === plan.id;
        return (
          <TouchableOpacity
            key={plan.id}
            activeOpacity={0.85}
            onPress={() => setSelected(plan)}
            style={[ss.planCard, {
              borderColor:     active ? plan.color : '#E8EAED',
              borderWidth:     active ? 2 : 1,
              backgroundColor: active ? plan.color + '0d' : '#fff',
              shadowColor:     active ? plan.color : '#000',
              shadowOpacity:   active ? 0.15 : 0.04,
              shadowOffset:    { width: 0, height: active ? 5 : 2 },
              shadowRadius:    active ? 12 : 5,
              elevation:       active ? 5 : 1,
            }]}
          >
            {/* Tag */}
            <View style={[ss.tag, { backgroundColor: plan.color }]}>
              <Text style={ss.tagTxt}>{plan.tag}</Text>
            </View>

            <View style={ss.planRow}>
              <View style={[ss.planIcon, { backgroundColor: plan.color + '18' }]}>
                <Text style={{ fontSize: 20 }}>{plan.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ss.planLabel, { color: active ? plan.color : '#0D0F12' }]}>{plan.label}</Text>
                <Text style={[ss.planTagline, { color: active ? plan.color + 'bb' : '#9AA0AB' }]}>{plan.tagline}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[ss.planPrice, { color: plan.color }]}>{plan.price}</Text>
                <Text style={ss.planDays}>{plan.days} {t('guard_days', 'days')}</Text>
              </View>
              <View style={[ss.check, { backgroundColor: active ? plan.color : 'transparent', borderColor: active ? plan.color : '#E8EAED' }]}>
                {active && <ICONS.Check color="#fff" size={10} sw={3} />}
              </View>
            </View>

            <View style={[ss.featWrap, { borderTopColor: active ? plan.color + '30' : '#F0F2F5' }]}>
              {plan.features.map((f, i) => (
                <View key={i} style={ss.featRow}>
                  <View style={[ss.featDot, { backgroundColor: plan.color }]} />
                  <Text style={[ss.featTxt, { color: active ? '#374151' : '#6B7280' }]}>{f}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        activeOpacity={selected ? 0.87 : 1}
        onPress={() => selected && onSelect(selected)}
        style={ss.ctaWrap}
      >
        <LinearGradient
          colors={selected ? selected.gradient : ['#C4C9D4', '#C4C9D4']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={ss.cta}
        >
          <Text style={ss.ctaTxt}>
            {selected ? t('guard_continue_with', 'Continue with {price}  →').replace('{price}', selected.price) : t('select_plan', 'Select a plan above')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Category picker (only for single plan)
// ─────────────────────────────────────────────────────────────────────────────
const CategoryStep = ({ plan, onSelect, onBack, t }) => {
  const CATEGORIES = buildCategories(t);
  const [selected, setSelected] = useState(null);

  return (
    <View style={ss.stepWrap}>
      {/* Back */}
      <TouchableOpacity onPress={onBack} style={ss.backBtn}>
        <Text style={ss.backTxt}>{t('guard_back_to_plans', '← Back to plans')}</Text>
      </TouchableOpacity>

      <Text style={ss.stepTitle}>{t('guard_choose_category', 'Choose your category')}</Text>
      <Text style={ss.stepSub}>{t('guard_choose_category_sub', "You'll only have access to this age group with the ₦500 plan")}</Text>

      {/* Plan recap badge */}
      <View style={[ss.planRecap, { backgroundColor: plan.color + '12', borderColor: plan.color + '35' }]}>
        <Text style={{ fontSize: 16 }}>{plan.icon}</Text>
        <Text style={[ss.planRecapLabel, { color: plan.color }]}>{plan.label} — {plan.price}</Text>
        <Text style={[ss.planRecapDays,  { color: plan.color + 'aa' }]}>{plan.days} {t('guard_days', 'days')}</Text>
      </View>

      {/* Category grid */}
      <View style={ss.catGrid}>
        {CATEGORIES.map((cat) => {
          const active = selected?.id === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.82}
              onPress={() => setSelected(cat)}
              style={[ss.catCard, {
                backgroundColor: active ? cat.color : '#fff',
                borderColor:     active ? cat.color : '#E8EAED',
                borderWidth:     active ? 2 : 1,
                shadowColor:     active ? cat.color : '#000',
                shadowOpacity:   active ? 0.20 : 0.04,
                shadowOffset:    { width: 0, height: active ? 5 : 2 },
                shadowRadius:    active ? 10 : 4,
                elevation:       active ? 5 : 1,
              }]}
            >
              <Text style={ss.catEmoji}>{cat.emoji}</Text>
              <Text style={[ss.catLabel, { color: active ? '#fff' : '#0D0F12' }]}>{cat.label}</Text>
              <Text style={[ss.catDesc,  { color: active ? 'rgba(255,255,255,0.78)' : '#9AA0AB' }]}>{cat.desc}</Text>
              {active && (
                <View style={ss.catCheck}>
                  <ICONS.Check color={cat.color} size={10} sw={3} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selected && (
        <View style={[ss.selNote, { backgroundColor: selected.color + '10', borderColor: selected.color + '30' }]}>
          <Text style={{ fontSize: 14 }}>{selected.emoji}</Text>
          <Text style={[ss.selNoteText, { color: selected.color }]}>
            {t('guard_youll_access_prefix', "You'll access ")}<Text style={{ fontWeight: '900' }}>{selected.label}</Text>{t('guard_youll_access_suffix', ' content only')}
          </Text>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={selected ? 0.87 : 1}
        onPress={() => selected && onSelect(selected)}
        style={ss.ctaWrap}
      >
        <LinearGradient
          colors={selected ? plan.gradient : ['#C4C9D4', '#C4C9D4']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={ss.cta}
        >
          <Text style={ss.ctaTxt}>
            {selected ? t('guard_pay_format', 'Pay {price} — {label}  →').replace('{price}', plan.price).replace('{label}', selected.label) : t('select_category', 'Select a category above')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const ss = StyleSheet.create({
  stepWrap:      { padding: 16, gap: 12 },
  stepTitle:     { fontSize: 17, fontWeight: '900', color: '#0D0F12', textAlign: 'center' },
  stepSub:       { fontSize: 12, color: '#9AA0AB', textAlign: 'center', lineHeight: 17, marginBottom: 4 },
  backBtn:       { alignSelf: 'flex-start', paddingVertical: 4 },
  backTxt:       { fontSize: 13, fontWeight: '700', color: BLUE },

  // Plan card
  planCard:      { borderRadius: 14, overflow: 'hidden' },
  tag:           { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, margin: 10, marginBottom: 0 },
  tagTxt:        { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  planRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingTop: 6 },
  planIcon:      { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  planLabel:     { fontSize: 14, fontWeight: '800', marginBottom: 1 },
  planTagline:   { fontSize: 11 },
  planPrice:     { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  planDays:      { fontSize: 10, color: '#9AA0AB', fontWeight: '600' },
  check:         { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  featWrap:      { borderTopWidth: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 4 },
  featRow:       { flexDirection: 'row', alignItems: 'center', gap: 7 },
  featDot:       { width: 5, height: 5, borderRadius: 3 },
  featTxt:       { fontSize: 11, fontWeight: '500' },

  // Plan recap
  planRecap:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  planRecapLabel:{ fontSize: 13, fontWeight: '800', flex: 1 },
  planRecapDays: { fontSize: 11 },

  // Category grid
  catGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard:       { width: '47%', borderRadius: 14, padding: 14, alignItems: 'center', position: 'relative' },
  catEmoji:      { fontSize: 28, marginBottom: 6 },
  catLabel:      { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  catDesc:       { fontSize: 11, fontWeight: '500' },
  catCheck:      { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },

  // Selection note
  selNote:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 2 },
  selNoteText:   { fontSize: 13, fontWeight: '600', flex: 1 },

  // CTA
  ctaWrap:       { borderRadius: 14, overflow: 'hidden', shadowColor: BLUE, shadowOffset: { width:0, height:5 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 7 },
  cta:           { height: 50, alignItems: 'center', justifyContent: 'center' },
  ctaTxt:        { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// OUTER CARD — centred 80% container with gradient header + scrollable steps
// ─────────────────────────────────────────────────────────────────────────────
const SubscribeCard = ({ onPay, onLogout, t, plans }) => {
  const [flowStep, setFlowStep] = useState('plan');
  const [plan,     setPlan]     = useState(null);
  const [category, setCategory] = useState(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    // Hold the parallel handle so unmount can stop it. Without this, a quick
    // navigate-away (or a react-native-screens reconnect) mid-entry crashes
    // with "Cannot read property 'stopTracking' of undefined" when the
    // native animator finalises a value owned by a now-gone component.
    const handle = Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 11, delay: 100, useNativeDriver: true }),
    ]);
    handle.start();
    return () => { try { handle.stop(); } catch {} };
  }, []);

  const handleSelectPlan = (p) => {
    setPlan(p);
    if (p.id === 'all') {
      // All-access: skip category step, go straight to payment
      onPay(p, null);
    } else {
      setFlowStep('category');
    }
  };

  const handleSelectCategory = (cat) => {
    setCategory(cat);
    onPay(plan, cat);
  };

  const cardWidth = SW * 0.88;
  const maxCardH  = SH * 0.78;

  return (
    <Animated.View style={[oc.card, { width: cardWidth, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Gradient header */}
      <LinearGradient colors={[BLUE, BLUE_DARK, '#040A1C']} style={oc.header}>
        <View style={oc.orb1} /><View style={oc.orb2} />
        <View style={oc.logoCircle}><Text style={{ fontSize: 26 }}>✨</Text></View>
        <Text style={oc.headerTitle}>{t('guard_header_title', 'Gospelar Sunday School')}</Text>
        <Text style={oc.headerSub}>{t('guard_header_sub', 'Subscribe to unlock your content')}</Text>

        {/* Step indicator dots */}
        <View style={oc.stepDots}>
          {['plan', 'category'].map((s, i) => (
            <View key={s} style={[oc.stepDot, {
              backgroundColor: flowStep === s
                ? '#fff'
                : i < ['plan', 'category'].indexOf(flowStep)
                  ? 'rgba(255,255,255,0.6)'
                  : 'rgba(255,255,255,0.2)',
              width: flowStep === s ? 20 : 7,
            }]} />
          ))}
        </View>

        {/* Trust pills */}
        <View style={oc.trustRow}>
          <View style={oc.trustPill}><Text style={oc.trustTxt}>{t('guard_trust_paystack', '🔒 Paystack secured')}</Text></View>
          <View style={oc.trustPill}><Text style={oc.trustTxt}>{t('guard_trust_instant', '⚡ Instant access')}</Text></View>
        </View>
      </LinearGradient>

      {/* Scrollable step body */}
      <ScrollView
        style={{ maxHeight: maxCardH - 180 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {flowStep === 'plan' && <PlanStep onSelect={handleSelectPlan} t={t} plans={plans} />}
        {flowStep === 'category' && (
          <CategoryStep
            plan={plan}
            onSelect={handleSelectCategory}
            onBack={() => setFlowStep('plan')}
            t={t}
          />
        )}
      </ScrollView>

      {/* Log out link */}
      <TouchableOpacity onPress={onLogout} activeOpacity={0.75} style={oc.logoutRow}>
        <Text style={oc.logoutTxt}>{t('guard_logout', '🚪  Log out')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const oc = StyleSheet.create({
  card:        { borderRadius: 24, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.28, shadowRadius: 32, elevation: 24, alignSelf: 'center' },
  header:      { paddingTop: 22, paddingBottom: 18, paddingHorizontal: 20, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  orb1:        { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.05)', top: -50, right: -40 },
  orb2:        { position: 'absolute', width: 90,  height: 90,  borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: 10 },
  logoCircle:  { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.4, marginBottom: 3 },
  headerSub:   { color: 'rgba(255,255,255,0.68)', fontSize: 11, marginBottom: 12 },
  stepDots:    { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 10 },
  stepDot:     { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  trustRow:    { flexDirection: 'row', gap: 8 },
  trustPill:   { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.10)' },
  trustTxt:    { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },
  logoutRow:   { alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F2F5' },
  logoutTxt:   { fontSize: 12, fontWeight: '700', color: '#9AA0AB' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — SubscriptionGuard
// ─────────────────────────────────────────────────────────────────────────────
export default function SubscriptionGuard({ children, navigation }) {
  const {
    isSubscribed, hasSundaySchool, isLoading, hasChecked, serverError,
    email, recheck, daysRemaining = null, plans,
  } = useSubscription();

  // This guard wraps the Sunday-School flow (HomeScreen, Lessons, Devotional,
  // etc.). Access requires an actual Sunday-School plan ('single' / 'all') —
  // a per-book purchase (Victory Month etc.) does NOT count. Book-only users
  // get bounced to the PaymentScreen just like an unsubscribed user.
  const hasAccess = hasSundaySchool;

  const { isDark } = useTheme();
  const { t }      = useLanguage();
  useEffect(() => { if (!hasChecked) recheck(); }, [hasChecked]);

  // When the guard determines the user doesn't have a Sunday-School plan,
  // send them straight to PaymentScreen. We use `replace` so the gated screen
  // doesn't sit in the back stack — otherwise hitting back from PaymentScreen
  // returns the user to the gated screen, the guard fires again, and they
  // ping-pong. PaymentScreen's own back arrow now navigates to Library.
  useEffect(() => {
    if (hasChecked && !isLoading && !hasAccess && !serverError) {
      (navigation?.replace || navigation?.navigate)?.call(navigation, 'PaymentScreen');
    }
  }, [hasChecked, isLoading, hasAccess, serverError, navigation]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!hasChecked || (isLoading && !hasAccess)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' }}>
        <ActivityIndicator color={BLUE} size="large" />
        <Text style={{ marginTop: 14, fontSize: 14, fontWeight: '600', color: '#9AA0AB' }}>
          {t('guard_checking_access', 'Checking your access…')}
        </Text>
      </View>
    );
  }

  // ── Server error ─────────────────────────────────────────────────────────
  if (serverError && !hasAccess) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA', padding: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📡</Text>
        <Text style={{ fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 10, color: '#0D0F12' }}>
          {t('guard_cannot_reach_server', 'Cannot Reach Server')}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 22, textAlign: 'center', color: '#6B7280', marginBottom: 28 }}>
          {t('guard_check_connection', 'Check your internet connection and ensure the app server is running.')}
        </Text>
        <TouchableOpacity onPress={recheck} activeOpacity={0.85}
          style={{ borderRadius: 16, paddingVertical: 15, paddingHorizontal: 40, backgroundColor: BLUE,
                   shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{t('btn_retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Subscribed (with a Sunday-School plan) ──────────────────────────────
  // A book-only buyer falls through to the redirect below — they have an
  // active row in subscribers but no SS plan_type, so hasAccess is false.
  if (hasAccess) return children;

  // ── Not subscribed — quick redirect to PaymentScreen ─────────────────────
  // The useEffect above fires the navigation; this just keeps the screen
  // calm (matching the colour treatment we use elsewhere) while the
  // navigator transitions in.
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' }}>
      <ActivityIndicator color={BLUE} size="large" />
      <Text style={{ marginTop: 14, fontSize: 14, fontWeight: '600', color: '#9AA0AB' }}>
        {t('guard_redirecting', 'Opening subscription…')}
      </Text>
    </View>
  );
}