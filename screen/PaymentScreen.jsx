// screens/PaymentScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Category-gated subscription flow:
//   Step 1 → Choose a plan (single category ₦500 OR all-access ₦1000)
//   Step 2 → Enter email
//   Step 3 → Paystack WebView
//   Step 4 → Verify + persist category to AsyncStorage
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../services/api';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated, Pressable,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { WebView }         from 'react-native-webview';
import { useTheme }        from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage }     from '../context/LanguageContext';
import { getTokens }       from '../theme/tokens';
import { useScreenEntry, usePressScale } from '../hooks/useFluidAnim';
import { ICONS }                         from '../components/icons';

const { width } = Dimensions.get('window');

const BLUE       = '#1A56DB';
const BLUE_DEEP  = '#1D4ED8';
const BLUE_LIGHT = '#EFF6FF';
const PURPLE     = '#7C3AED';

// Paystack credentials live entirely on the backend now. The mobile app
// asks /api/payments/initialize (which uses PAYSTACK_SECRET_KEY server-side)
// and opens the returned authorization_url in a WebView. No public key in
// the bundle, no client-side amount construction, no inline.js.

// Format kobo (1/100 of NGN) → "₦500" / "₦1,000"
const formatNaira = (kobo) => '₦' + (Math.round(kobo / 100)).toLocaleString('en-NG');

// ── Plan + category definitions ───────────────────────────────────────────────
const buildCategories = (t) => [
  { id: 'children',     label: t('cat_children', 'Children'),         emoji: '🌟', color: '#F97316', desc: t('cat_children_range', 'Ages 4 – 11')      },
  { id: 'intermediate', label: t('cat_intermediate', 'Intermediate'), emoji: '✝️', color: '#10B981', desc: t('cat_intermediate_range', 'Ages 12 – 17') },
  { id: 'youth',        label: t('cat_youth', 'Youth'),               emoji: '🎯', color: '#2563EB', desc: t('cat_youth_range', 'Ages 18 – 25')        },
  { id: 'adult',        label: t('cat_adult', 'Adult'),               emoji: '📖', color: '#7C3AED', desc: t('cat_adult_range', '26 & above')           },
];

// Plans now derive price + days from admin-configured pricing in `plans` map
const buildPlans = (t, plans) => [
  {
    id:      'single',
    label:   t('plan_single', 'Single Category'),
    price:   plans.single.price_kobo,
    display: formatNaira(plans.single.price_kobo),
    days:    plans.single.days,
    tagline: t('pay_single_tagline', 'Access one age group'),
    features: [
      t('pay_feat_one_cat', 'One category of your choice'),
      t('pay_feat_devotionals', '📅 Daily devotionals'),
      t('pay_feat_quizzes', '⚡ Lesson quizzes'),
      t('pay_feat_languages', '🌐 4-language support'),
    ],
    color:   BLUE,
    tag:     t('pay_tag_popular', 'POPULAR'),
  },
  {
    id:      'all',
    label:   t('plan_all', 'All Categories'),
    price:   plans.all.price_kobo,
    display: formatNaira(plans.all.price_kobo),
    days:    plans.all.days,
    tagline: t('pay_all_tagline', 'Access every age group'),
    features: [
      t('pay_feat_all_cats', 'All 4 categories'),
      t('pay_feat_devotionals', '📅 Daily devotionals'),
      t('pay_feat_quizzes', '⚡ Lesson quizzes'),
      t('pay_feat_languages', '🌐 4-language support'),
      t('pay_feat_best_value', '🎁 Best value'),
    ],
    color:   PURPLE,
    tag:     t('pay_tag_best_value', 'BEST VALUE'),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Reusable primary CTA — solid Homescreen-blue button (matches the "Start →"
// button on the QuarterCard). No gradient, soft shadow.
// ─────────────────────────────────────────────────────────────────────────────
const PrimaryCTA = ({ label, onPress, disabled }) => {
  const press = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled}
        style={{
          height: 54, borderRadius: 16,
          backgroundColor: BLUE,
          alignItems: 'center', justifyContent: 'center',
          opacity: disabled ? 0.55 : 1,
          shadowColor: BLUE, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18, shadowRadius: 12, elevation: 4,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Plan + Category selection
// ─────────────────────────────────────────────────────────────────────────────
const PlanStep = ({ onProceed, tk, t, plans, isDark }) => {
  const PLANS      = useMemo(() => buildPlans(t, plans), [t, plans]);
  const CATEGORIES = useMemo(() => buildCategories(t), [t]);
  const [selectedPlan,     setSelectedPlan]     = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error,            setError]            = useState('');
  const { fade, translateY } = useScreenEntry();

  const proceed = () => {
    if (!selectedPlan) {
      setError(t('pay_err_no_plan', 'Please choose a subscription plan.'));
      return;
    }
    if (selectedPlan.id === 'single' && !selectedCategory) {
      setError(t('pay_err_no_category', 'Please select an age category for your plan.'));
      return;
    }
    setError('');
    onProceed({
      plan:     selectedPlan,
      category: selectedPlan.id === 'all' ? 'all' : selectedCategory,
    });
  };

  return (
    <Animated.ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 56 }}
      style={{ opacity: fade, transform: [{ translateY }] }}
    >
      {/* Hero — Homescreen-style "QuarterCard" pattern: light surface, big
          title with accent badge on the right, divider, footer line. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
        <View style={[ps.hero, { backgroundColor: tk.surface, borderColor: tk.border }]}>
          <View style={ps.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[ps.heroEyebrow, { color: tk.textMuted }]}>
                {t('pay_hero_sub', 'Sunday School · Digital Access')}
              </Text>
              <Text style={[ps.heroTitle, { color: tk.textPrimary }]}>
                {t('pay_hero_title', 'Subscribe to Gospelar')}
              </Text>
              <Text style={[ps.heroBody, { color: tk.textMuted }]} numberOfLines={2}>
                {t('pay_hero_body', 'Pick a plan and unlock weekly lessons, hymns and quizzes for your category.')}
              </Text>
            </View>
            <View style={[ps.heroBadge, { backgroundColor: BLUE_LIGHT }]}>
              <Text style={{ fontSize: 24 }}>🕊️</Text>
            </View>
          </View>
          <View style={[ps.heroDivider, { backgroundColor: tk.border }]} />
          <View style={ps.heroFootRow}>
            <Text style={[ps.heroFootLeft, { color: tk.textMuted }]}>
              🔒  {t('pay_trust_paystack', 'Secured by Paystack')}
            </Text>
            <Text style={[ps.heroFootRight, { color: BLUE }]}>
              ⚡ {t('pay_trust_instant', 'Instant Activation')}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <Text style={[ps.sectionLabel, { color: tk.textMuted }]}>
          {t('pay_choose_plan', 'CHOOSE YOUR PLAN')}
        </Text>

        {/* Plan cards — accent border + faint tint on select, not flood-fill */}
        {PLANS.map((plan) => {
          const active = selectedPlan?.id === plan.id;
          const tintBg = isDark ? plan.color + '22' : plan.color + '0e';
          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={0.92}
              onPress={() => { setSelectedPlan(plan); setError(''); }}
              style={[ps.planCard, {
                backgroundColor: active ? tintBg : tk.surface,
                borderColor:     active ? plan.color : tk.border,
                borderWidth:     active ? 2 : 1,
                shadowOpacity:   active ? 0.10 : 0.04,
                shadowRadius:    active ? 14 : 6,
                elevation:       active ? 4 : 1,
              }]}
            >
              <View style={ps.planHeadRow}>
                <View style={[ps.planTag, { backgroundColor: plan.color + '18' }]}>
                  <Text style={[ps.planTagTxt, { color: plan.color }]}>{plan.tag}</Text>
                </View>
                <View style={[ps.planRadio, {
                  borderColor: active ? plan.color : tk.border,
                  backgroundColor: active ? plan.color : 'transparent',
                }]}>
                  {active && <ICONS.Check color="#fff" size={12} sw={3} />}
                </View>
              </View>

              <Text style={[ps.planLabel, { color: tk.textPrimary }]}>{plan.label}</Text>
              <Text style={[ps.planTagline, { color: tk.textMuted }]}>{plan.tagline}</Text>

              <View style={ps.planPriceRow}>
                <Text style={[ps.planPrice, { color: plan.color }]}>{plan.display}</Text>
                <Text style={[ps.planDays, { color: tk.textMuted }]}>
                  / {plan.days} {t('pay_days', 'days')}
                </Text>
              </View>

              <View style={[ps.featList, { borderTopColor: tk.border }]}>
                {plan.features.map((f, i) => (
                  <View key={i} style={ps.featRow}>
                    <View style={[ps.featDot, { backgroundColor: plan.color }]} />
                    <Text style={[ps.featText, { color: tk.textSec }]} numberOfLines={1}>
                      {f}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Category picker — only shown for single plan */}
        {selectedPlan?.id === 'single' && (
          <View style={{ marginTop: 18 }}>
            <Text style={[ps.sectionLabel, { color: tk.textMuted, marginBottom: 12 }]}>
              {t('pay_select_age_category', 'SELECT YOUR AGE CATEGORY')}
            </Text>
            <View style={ps.catGrid}>
              {CATEGORIES.map(cat => {
                const active = selectedCategory === cat.id;
                const tintBg = isDark ? cat.color + '22' : cat.color + '0e';
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.88}
                    onPress={() => { setSelectedCategory(cat.id); setError(''); }}
                    style={[ps.catCard, {
                      backgroundColor: active ? tintBg : tk.surface,
                      borderColor:     active ? cat.color : tk.border,
                      borderWidth:     active ? 2 : 1,
                    }]}
                  >
                    <View style={[ps.catEmojiCircle, {
                      backgroundColor: cat.color + (active ? '22' : '14'),
                      borderColor: cat.color + (active ? '60' : '30'),
                    }]}>
                      <Text style={{ fontSize: 26 }}>{cat.emoji}</Text>
                    </View>
                    <Text style={[ps.catLabel, { color: tk.textPrimary }]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                    <Text style={[ps.catDesc, { color: tk.textMuted }]} numberOfLines={1}>
                      {cat.desc}
                    </Text>
                    {active && (
                      <View style={[ps.catCheck, { backgroundColor: cat.color }]}>
                        <ICONS.Check color="#fff" size={10} sw={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Error */}
        {!!error && (
          <View style={ps.errorBar}>
            <Text style={ps.errorTxt}>⚠  {error}</Text>
          </View>
        )}

        {/* CTA — sits below the cards. The hero already has the trust copy,
            so we don't repeat trust badges down here. */}
        <View style={{ marginTop: 22 }}>
          <PrimaryCTA
            label={t('pay_continue_btn', 'Continue to Payment →')}
            onPress={proceed}
          />
        </View>

        {/* Footer line — matches Homescreen's footer */}
        <View style={{ alignItems: 'center', marginTop: 22 }}>
          <Text style={{ fontSize: 11, color: tk.textMuted, marginBottom: 4 }}>
            {t('login_footer', '© Gospelar Sunday School Department')}
          </Text>
          <Text style={{ fontSize: 12, color: BLUE, fontWeight: '800' }}>www.gospelar.com</Text>
        </View>
      </View>
    </Animated.ScrollView>
  );
};

const ps = StyleSheet.create({
  // Hero — Homescreen "QuarterCard" pattern: white surface, soft border + shadow.
  hero:           { borderRadius: 18, borderWidth: 1, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  heroRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  heroEyebrow:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' },
  heroTitle:      { fontSize: 22, fontWeight: '900', letterSpacing: -0.4, lineHeight: 27 },
  heroBody:       { fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 6 },
  heroBadge:      { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroDivider:    { height: 1, marginVertical: 16 },
  heroFootRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroFootLeft:   { fontSize: 12, fontWeight: '600' },
  heroFootRight:  { fontSize: 12, fontWeight: '700' },

  // Section label
  sectionLabel:   { fontSize: 10, fontWeight: '900', letterSpacing: 2.2, marginBottom: 12 },

  // Plan card — softer shadow, rounded 18, accent border + faint tint on select.
  planCard:       { borderRadius: 18, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 10 },
  planHeadRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  planTag:        { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  planTagTxt:     { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  planRadio:      { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  planLabel:      { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  planTagline:    { fontSize: 12.5, fontWeight: '500', marginTop: 2, marginBottom: 10 },
  planPriceRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 14 },
  planPrice:      { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  planDays:       { fontSize: 12, fontWeight: '600' },

  // Features
  featList:       { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  featRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featDot:        { width: 6, height: 6, borderRadius: 3 },
  featText:       { fontSize: 13, fontWeight: '600', flex: 1 },

  // Category grid — modeled on Homescreen AgeGroupCard
  catGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard:        { width: (width - 20*2 - 12) / 2, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  catEmojiCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1.5 },
  catLabel:       { fontSize: 14, fontWeight: '900', marginBottom: 2, letterSpacing: 0.1, textAlign: 'center' },
  catDesc:        { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  catCheck:       { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Error
  errorBar:       { marginTop: 14, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorTxt:       { fontSize: 13, color: '#DC2626', fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Email entry
// ─────────────────────────────────────────────────────────────────────────────
const EmailStep = ({ plan, category, onProceed, onBack, tk, t, isDark }) => {
  const CATEGORIES = useMemo(() => buildCategories(t), [t]);
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const validate = () => {
    const v = email.trim().toLowerCase();
    if (!v) { setError(t('pay_email_required', 'Please enter your email.')); shake(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError(t('pay_email_invalid', 'Enter a valid email address.')); shake(); return;
    }
    setError('');
    onProceed(v);
  };

  const catObj    = CATEGORIES.find(c => c.id === category);
  const accent    = plan.color;
  // Use the standard surface bg (matches Homescreen QuarterCard) with a
  // subtle accent stripe on the left rather than tinting the whole card.
  const summaryBg = tk.surface;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48, backgroundColor: tk.bg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Order summary — accent stripe on the left, soft surface card. */}
        <View style={[es.summary, { backgroundColor: summaryBg, borderColor: tk.border }]}>
          <View style={[es.sumStripe, { backgroundColor: accent }]} />
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 14, paddingVertical: 14 }}>
            <View style={[es.sumIcon, { backgroundColor: accent + '14', borderColor: accent + '40' }]}>
              <Text style={{ fontSize: 24 }}>{catObj?.emoji || '🌟'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[es.sumLabel, { color: tk.textMuted }]}>
                {t('pay_row_plan', 'Plan').toUpperCase()}
              </Text>
              <Text style={[es.sumTitle, { color: tk.textPrimary }]} numberOfLines={1}>
                {plan.label}
              </Text>
              <Text style={[es.sumCat, { color: accent }]} numberOfLines={1}>
                {catObj?.label || t('pay_all_access', 'All Access')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[es.sumPrice, { color: accent }]}>{plan.display}</Text>
              <TouchableOpacity onPress={onBack} style={[es.changeBtn, { borderColor: accent + '60' }]}>
                <Text style={[es.changeTxt, { color: accent }]}>
                  {t('pay_change', 'Change')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Email input */}
        <View style={{ paddingHorizontal: 20, paddingTop: 26 }}>
          <Text style={[es.title,  { color: tk.textPrimary }]}>
            {t('pay_enter_email_title', 'Enter Your Email')}
          </Text>
          <Text style={[es.subTxt, { color: tk.textMuted }]}>
            {t('pay_email_help', 'Your subscription will be linked to this email. Use the same email to restore access on any device.')}
          </Text>

          <Animated.View style={[es.inputWrap, {
            backgroundColor: tk.surface,
            borderColor: error ? '#EF4444' : focused ? BLUE : tk.border,
            transform: [{ translateX: shakeAnim }],
          }]}>
            <View style={{ marginRight: 10 }}>
              <ICONS.Mail color={tk.textMuted} size={18} sw={1.9} />
            </View>
            <TextInput
              style={[es.input, { color: tk.textPrimary }]}
              placeholder={t('register_email_placeholder', 'you@example.com')}
              placeholderTextColor={tk.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              value={email}
              onChangeText={txt => { setEmail(txt); setError(''); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={validate}
            />
            {email.length > 0 && (
              <TouchableOpacity onPress={() => setEmail('')} hitSlop={10}>
                <View style={[es.clearBtn, { backgroundColor: tk.surfaceEl }]}>
                  <Text style={{ color: tk.textSec, fontSize: 14, fontWeight: '700' }}>×</Text>
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
          {!!error && <Text style={es.errorTxt}>{error}</Text>}

          <View style={{ marginTop: 22 }}>
            <PrimaryCTA
              label={t('pay_proceed_btn', 'Proceed to Payment →')}
              onPress={validate}
            />
          </View>

          {/* Reassurance line */}
          <View style={es.reassureRow}>
            <ICONS.Lock color={tk.textMuted} size={12} sw={2.2} />
            <Text style={[es.reassureTxt, { color: tk.textMuted }]}>
              {t('pay_trust_paystack', 'Secured by Paystack')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const es = StyleSheet.create({
  summary:     { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, borderRadius: 18, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sumStripe:   { width: 4 },
  sumIcon:     { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  sumLabel:    { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.6 },
  sumTitle:    { fontSize: 15, fontWeight: '800', marginTop: 2 },
  sumCat:      { fontSize: 12, fontWeight: '700', marginTop: 1 },
  sumPrice:    { fontSize: 18, fontWeight: '900', letterSpacing: -0.4, marginBottom: 6 },
  changeBtn:   { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  changeTxt:   { fontSize: 11, fontWeight: '800' },

  title:       { fontSize: 22, fontWeight: '900', letterSpacing: -0.3, marginBottom: 6 },
  subTxt:      { fontSize: 13, lineHeight: 20, fontWeight: '500', marginBottom: 18 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, height: 54, marginBottom: 6 },
  input:       { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  clearBtn:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  errorTxt:    { color: '#EF4444', fontSize: 12, fontWeight: '700', marginTop: 4, marginLeft: 4 },

  reassureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 },
  reassureTxt: { fontSize: 12, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Paystack WebView — fully server-driven.
//
// Flow:
//   1. On mount, POST /api/payments/initialize with { email, plan, category,
//      book_id }. Backend resolves the price from subscription_plans (so the
//      amount can never be tampered with on the device), calls Paystack with
//      the secret key, and returns { authorization_url, reference }.
//   2. WebView opens authorization_url. User completes payment in Paystack's
//      hosted checkout — no public key, no inline.js, nothing custom.
//   3. Paystack redirects to callback_url (api.gospelar.com/api/payments/callback
//      with ?reference=…). onShouldStartLoadWithRequest intercepts that URL,
//      pulls the reference out, and calls onSuccess(reference).
//   4. Caller calls /api/verify-payment with that reference to activate.
// ─────────────────────────────────────────────────────────────────────────────
const PaystackWebView = ({ email, plan, category, bookId, onSuccess, onCancel, t }) => {
  const [authUrl, setAuthUrl]       = useState(null);
  const [initError, setInitError]   = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const refSeenRef = useRef(null);   // de-dup: don't fire onSuccess twice

  // Step 1 — ask backend to initialize the transaction.
  useEffect(() => {
    let cancelled = false;
    setAuthUrl(null);
    setInitError('');
    setPageLoading(true);

    fetch(`${API_BASE_URL}/api/payments/initialize`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        plan:     plan?.id   || 'single',
        category: category?.id || 'adult',
        book_id:  bookId      || null,
      }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (data.status === 'success' && data.authorization_url) {
          setAuthUrl(data.authorization_url);
        } else {
          setInitError(data.message || `Init failed (HTTP ${r.status})`);
        }
      })
      .catch((e) => { if (!cancelled) setInitError(e.message || 'Network error'); });

    return () => { cancelled = true; };
  }, [email, plan?.id, category?.id, bookId]);

  // Step 3 — intercept navigation back to our callback URL. Pulling the ref
  // out of the URL is more reliable than waiting for a postMessage that
  // might not fire if the user closes the WebView mid-redirect.
  const onNavChange = useCallback((navState) => {
    const url = navState.url || '';
    // Successful payment redirect — extract reference from the query string.
    if (url.includes('/api/payments/callback')) {
      const m = url.match(/(?:reference|trxref)=([^&#]+)/);
      const ref = m ? decodeURIComponent(m[1]) : null;
      if (ref && refSeenRef.current !== ref) {
        refSeenRef.current = ref;
        onSuccess(ref);
      }
      return;
    }
    // User tapped Cancel / Close on Paystack's checkout page.
    if (url.includes('paystack.shop/cancelled') || url.includes('checkout.paystack.com/cancelled')) {
      onCancel();
    }
  }, [onSuccess, onCancel]);

  // Init failed (no key, network down, Paystack rejected) — show a recoverable error.
  if (initError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#060E20', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
        <ICONS.AlertTriangle color="#F59E0B" size={40} sw={2} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' }}>
          {t('pay_init_failed', "Couldn't start payment")}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
          {initError}
        </Text>
        <TouchableOpacity onPress={onCancel} activeOpacity={0.8}
          style={{ marginTop: 8, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, backgroundColor: BLUE }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{t('btn_close', 'Close')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#060E20' }}>
      {authUrl ? (
        <WebView
          source={{ uri: authUrl }}
          onNavigationStateChange={onNavChange}
          onLoadEnd={() => setPageLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          style={{ flex: 1, backgroundColor: '#060E20' }}
        />
      ) : null}
      {(pageLoading || !authUrl) && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#060E20', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={{ color: 'rgba(255,255,255,.7)', fontSize: 14, fontWeight: '600' }}>
            {t('pay_opening_secure', 'Opening secure payment...')}
          </Text>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Verifying step
// ─────────────────────────────────────────────────────────────────────────────
const VerifyingStep = ({ tk, t }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: tk.bg }}>
    <View style={{
      width: 84, height: 84, borderRadius: 42,
      backgroundColor: BLUE + '14',
      borderWidth: 1, borderColor: BLUE + '33',
      justifyContent: 'center', alignItems: 'center', marginBottom: 22,
    }}>
      <ActivityIndicator size="large" color={BLUE} />
    </View>
    <Text style={{ fontSize: 20, fontWeight: '900', marginBottom: 10, textAlign: 'center', color: tk.textPrimary, letterSpacing: -0.3 }}>
      {t('pay_verifying_title', 'Verifying your payment...')}
    </Text>
    <Text style={{ fontSize: 13.5, lineHeight: 21, textAlign: 'center', color: tk.textMuted, maxWidth: 320 }}>
      {t('pay_verifying_sub', 'Please wait while we confirm your payment and activate your subscription.')}
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Success step
// ─────────────────────────────────────────────────────────────────────────────
const SuccessStep = ({ email, expiryDate, plan, category, tk, t }) => {
  const CATEGORIES = useMemo(() => buildCategories(t), [t]);
  const scaleAnim  = useRef(new Animated.Value(0.8)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);

  const expiry = expiryDate
    ? new Date(expiryDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
    : `${plan?.days || 300} ${t('pay_days_from_today', 'days from today')}`;
  const catObj   = CATEGORIES.find(c => c.id === category);
  const catLabel = category === 'all'
    ? t('pay_all_cats_full', 'All Categories (Full Access)')
    : `${catObj?.label || category} ${t('pay_only_suffix', 'Only')}`;
  const accent   = plan?.color || BLUE;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: tk.bg }}>
      <Animated.View style={[suc.card, {
        backgroundColor: tk.surface, borderColor: tk.border,
        opacity: fadeAnim, transform: [{ scale: scaleAnim }],
      }]}>
        <View style={[suc.stripe, { backgroundColor: accent }]} />
        <View style={{ padding: 26, alignItems: 'center' }}>
          <View style={[suc.icon, { backgroundColor: '#10B98114', borderColor: '#10B98140' }]}>
            <ICONS.Check color="#10B981" size={42} sw={3} />
          </View>
          <Text style={[suc.title, { color: tk.textPrimary }]}>
            {t('pay_success_title', 'Access Granted!')}
          </Text>
          <Text style={[suc.sub, { color: tk.textMuted }]}>
            {t('pay_success_sub', 'Your subscription is now active. Welcome to Gospelar Sunday School!')}
          </Text>

          <View style={[suc.receipt, { backgroundColor: tk.bg === '#FFFFFF' ? '#FAFAFA' : tk.surfaceEl }]}>
            {[
              { label: t('pay_row_email', 'Email'),       value: email },
              { label: t('pay_row_plan', 'Plan'),         value: plan?.label || t('pay_row_standard', 'Standard') },
              { label: t('pay_row_category', 'Category'), value: catLabel },
              { label: t('pay_row_expires', 'Expires'),   value: expiry },
            ].map((row, i, arr) => (
              <View key={i} style={[suc.row, {
                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: tk.border,
              }]}>
                <Text style={[suc.rowLabel, { color: tk.textMuted }]}>{row.label}</Text>
                <Text style={[suc.rowValue, { color: tk.textPrimary }]} numberOfLines={1}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[suc.note, { color: tk.textMuted }]}>
            {t('pay_success_note', 'The app will open automatically. Enjoy your studies! 🕊️')}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const suc = StyleSheet.create({
  card:     { borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 420, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  stripe:   { height: 4 },
  icon:     { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1.5 },
  title:    { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 8, letterSpacing: -0.4 },
  sub:      { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20, paddingHorizontal: 8 },
  receipt:  { width: '100%', borderRadius: 14, paddingHorizontal: 14, marginBottom: 16 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, alignItems: 'center' },
  rowLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  rowValue: { fontSize: 13, fontWeight: '800', flex: 1, textAlign: 'right', marginLeft: 12 },
  note:     { fontSize: 12, lineHeight: 18, textAlign: 'center', fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Failed step
// ─────────────────────────────────────────────────────────────────────────────
const FailedStep = ({ failMsg, onRetry, tk, t }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: tk.bg }}>
    <View style={[fs.card, { backgroundColor: tk.surface, borderColor: tk.border }]}>
      <View style={[fs.icon, { backgroundColor: '#EF444414', borderColor: '#EF444440' }]}>
        <ICONS.X color="#EF4444" size={40} sw={3} />
      </View>
      <Text style={[fs.title, { color: tk.textPrimary }]}>
        {t('pay_failed_title', 'Payment Failed')}
      </Text>
      <Text style={[fs.sub, { color: tk.textMuted }]}>{failMsg}</Text>
      <View style={{ width: '100%', marginTop: 6 }}>
        <PrimaryCTA label={t('pay_try_again', 'Try Again')} onPress={onRetry} />
      </View>
    </View>
  </View>
);

const fs = StyleSheet.create({
  card:  { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 26, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 6 },
  icon:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1.5 },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  sub:   { fontSize: 13.5, lineHeight: 21, textAlign: 'center', marginBottom: 22 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Topbar — shared header
// ─────────────────────────────────────────────────────────────────────────────
const Topbar = ({ title, onBack, tk }) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: tk.border,
    backgroundColor: tk.bg,
  }}>
    <View style={{ width: 70 }}>
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={{
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
            backgroundColor: tk.surfaceEl, alignSelf: 'flex-start',
          }}
        >
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: tk.textPrimary }}>
            ‹  Back
          </Text>
        </TouchableOpacity>
      )}
    </View>
    <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: tk.textPrimary, letterSpacing: -0.2 }}>
      {title}
    </Text>
    <View style={{ width: 70 }} />
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Progress dots (3-step)
// ─────────────────────────────────────────────────────────────────────────────
const StepDots = ({ step, tk }) => {
  const order = ['plan', 'email', 'webview'];
  const idx   = order.indexOf(step);
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 6 }}>
      {order.map((s, i) => (
        <View
          key={s}
          style={{
            flex: 1, height: 3, borderRadius: 2,
            backgroundColor: i <= idx ? BLUE : tk.border,
          }}
        />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function PaymentScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk         = useMemo(() => getTokens(isDark), [isDark]);
  const { verifyPayment, expiryDate, plans } = useSubscription();

  // Book-SKU branch — when BookPaywallScreen routes here with a book_id, we
  // skip the plan/category selection step entirely. The single source of
  // pricing truth is the BookPaywall route params (matched to the backend
  // subscription_plans row keyed by 'book_<id>').
  const routeBookId    = route?.params?.book_id    || null;
  const routeBookTitle = route?.params?.book_title || '';
  const routePlanId    = route?.params?.plan_id    || null;
  const routePriceKobo = route?.params?.price_kobo || null;
  const routeAccent    = route?.params?.accent     || BLUE;
  const isBookFlow     = !!routeBookId;

  // Pre-build a synthetic plan object so the existing email + Paystack steps
  // can render unchanged. Label uses the book title to keep the UX clear.
  const bookPlan = useMemo(() => {
    if (!isBookFlow) return null;
    return {
      id:      routePlanId,
      label:   routeBookTitle || t('pay_book_subscription', 'Book subscription'),
      price:   routePriceKobo || 50000,
      display: formatNaira(routePriceKobo || 50000),
      days:    365,
      tagline: t('pay_book_tagline', 'Unlock every chapter'),
      features: [],
      color:   routeAccent,
      tag:     '',
    };
  }, [isBookFlow, routePlanId, routeBookTitle, routePriceKobo, routeAccent, t]);

  const [step,     setStep]     = useState(isBookFlow ? 'email' : 'plan'); // book flow skips plan step
  const [email,    setEmail]    = useState('');
  const [plan,     setPlan]     = useState(bookPlan);
  const [category, setCategory] = useState(null);
  const [failMsg,  setFailMsg]  = useState('');

  const handlePlanProceed = ({ plan: p, category: c }) => {
    setPlan(p); setCategory(c); setStep('email');
  };

  const handleEmailProceed = (em) => { setEmail(em); setStep('webview'); };

  const handlePaymentSuccess = async (ref) => {
    setStep('verifying');
    const r = await verifyPayment(ref, email, category || 'adult', routeBookId);
    if (r.success) {
      setStep('success');
      // Book-flow lands back on Library so the user can open their newly-unlocked
      // book one tap from where they paid. Category-flow keeps the legacy
      // HomeScreen destination unchanged.
      const dest = isBookFlow ? 'Library' : 'HomeScreen';
      setTimeout(() => navigation.replace(dest), 2800);
    } else {
      setFailMsg(r.message);
      setStep('failed');
    }
  };

  const handleCancel = () => setStep('email');

  const showTopbar = step === 'plan' || step === 'email' || step === 'failed' || step === 'webview';
  const topTitle   =
    step === 'webview' ? t('pay_secure_payment', 'Secure Payment') :
    step === 'failed'  ? t('pay_failed_title', 'Payment Failed')   :
    isBookFlow         ? routeBookTitle || t('pay_topbar_subscribe', 'Subscribe') :
                         t('pay_topbar_subscribe', 'Subscribe');
  // Back arrow behaviour by step:
  //   plan    → return to Library (so a brand-new user from the Library
  //             tap on Sunday School can back out without losing their
  //             place; navigation stack may not have a "previous" if we
  //             arrived here via reset, so we navigate explicitly).
  //   email   → book flow: back to BookPaywall · category flow: back to plan step
  //   webview → handleCancel (returns to email step inside the screen)
  //   failed  → null (the screen has its own Try Again button)
  const onBack =
    step === 'plan'    ? () => navigation.navigate('Library') :
    step === 'email'   ? (isBookFlow ? () => navigation.goBack() : () => setStep('plan')) :
    step === 'webview' ? handleCancel          :
    null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      {showTopbar && <Topbar title={topTitle} onBack={onBack} tk={tk} />}

      {/* Step dots only apply to the category flow; the book flow is single-step. */}
      {!isBookFlow && (step === 'plan' || step === 'email') && <StepDots step={step} tk={tk} />}

      {step === 'webview' && (
        <PaystackWebView
          email={email}
          plan={plan}
          category={category}
          bookId={routeBookId}
          onSuccess={handlePaymentSuccess}
          onCancel={handleCancel}
          t={t}
        />
      )}

      {step === 'plan'      && <PlanStep      onProceed={handlePlanProceed} tk={tk} t={t} plans={plans} isDark={isDark} />}
      {step === 'email'     && <EmailStep     plan={plan} category={category} onProceed={handleEmailProceed} onBack={() => setStep('plan')} tk={tk} t={t} isDark={isDark} />}
      {step === 'verifying' && <VerifyingStep tk={tk} t={t} />}
      {step === 'success'   && <SuccessStep   email={email} expiryDate={expiryDate} plan={plan} category={category} tk={tk} t={t} />}
      {step === 'failed'    && <FailedStep    failMsg={failMsg} onRetry={() => { setStep('email'); setFailMsg(''); }} tk={tk} t={t} />}
    </SafeAreaView>
  );
}
