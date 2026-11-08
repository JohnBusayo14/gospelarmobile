// screens/PaymentScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Single-page checkout for Sunday School plans and per-book SKUs.
//
//   1 · Details   One scrolling page: plan (+ age group), billing email,
//                 payment method, order summary and a sticky "Pay ₦X" bar.
//   2 · Payment   The provider's hosted checkout opens in a Chrome Custom Tab
//                 (Android) / ASWebAuthenticationSession (iOS) through
//                 WebBrowser.openAuthSessionAsync. Google Play treats this as
//                 the system browser, not a native WebView, so the Payments
//                 policy restriction on in-app checkout does not apply. The
//                 backend's /api/payments/callback redirects to
//                 gospelar://payment-success?ref=…, the tab closes and we
//                 verify with POST /api/verify-payment.
//   3 · Done      Receipt.
//
// Robustness:
//   • Every return path (auth-session redirect, Linking deep link, the user
//     closing the tab by hand) converges on ONE de-duplicated verify call.
//   • Closing the tab without the redirect triggers a quiet verify, so a user
//     who paid and closed early is still activated; one who didn't pay lands
//     on a recoverable "not confirmed yet" state (Reopen / Check again)
//     instead of a scary "Payment failed".
//   • The in-flight transaction is persisted (PENDING_KEY). If Android kills
//     the app while the user is in their bank app, the next visit to this
//     screen confirms the payment instead of stranding a paid user.
//   • Logged-in users pay with their account email (locked). Paying with a
//     different email would re-key the subscription and trip the session
//     check into a forced logout.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, StatusBar,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Pressable,
  Linking, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage        from '@react-native-async-storage/async-storage';
import * as WebBrowser     from 'expo-web-browser';
import LottieView          from 'lottie-react-native';
import { API_BASE_URL }    from '../services/api';
import { useComingSoonCategories } from '../services/comingSoon';
import { useTheme }        from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage }     from '../context/LanguageContext';
import { getTokens }       from '../theme/tokens';
import { useScreenEntry, usePressScale } from '../hooks/useFluidAnim';
import { ICONS }           from '../components/icons';

const BLUE   = '#1A56DB';
const PURPLE = '#7C3AED';
const GREEN  = '#10B981';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';

const REDIRECT_URL    = 'gospelar://payment-success';
const PENDING_KEY     = 'gospelar_pending_payment';
const PENDING_TTL_MS  = 6 * 60 * 60 * 1000;   // bank transfers can take a while
const INIT_TIMEOUT_MS = 45_000;
const EMAIL_RE        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SINGLE_CATS     = ['children', 'intermediate', 'youth', 'adult'];
const DEFAULT_PLANS   = {
  single: { price_kobo: 50000,  days: 300 },
  all:    { price_kobo: 100000, days: 300 },
};

const BROWSER_OPTS = {
  showInRecents:      false,
  controlsColor:      '#FFFFFF',
  toolbarColor:       '#060E20',
  dismissButtonStyle: 'close',
};

// Flip `enabled` to offer a provider. With one enabled provider the method
// section renders as a single confirmed row — no extra decision for the user.
const PROVIDERS = [
  { id: 'paystack',    label: 'Paystack',    methods: 'Card · Bank transfer · USSD',         currency: 'NGN', enabled: true  },
  { id: 'flutterwave', label: 'Flutterwave', methods: 'Card · Bank transfer · Mobile money', currency: 'NGN', enabled: false },
  { id: 'stripe',      label: 'Stripe',      methods: 'International cards · Apple Pay',     currency: 'USD', enabled: false },
];
const AVAILABLE_PROVIDERS = PROVIDERS.filter((p) => p.enabled);

// Paystack statuses that mean "money may still be on its way" (bank transfer,
// USSD). Those keep the pending record alive instead of discarding it.
const IN_PROGRESS_STATUSES = ['ongoing', 'pending', 'processing', 'queued', 'send_birthday', 'send_otp'];

const formatNaira = (kobo) => '₦' + Math.round((kobo || 0) / 100).toLocaleString('en-NG');
const formatDate  = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return ''; }
};
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + (days || 0)); return d; };

const buildCategories = (t) => [
  { id: 'children',     label: t('cat_children', 'Children'),         emoji: '🌟', color: '#F97316', desc: t('cat_children_range', 'Ages 4 – 11')      },
  { id: 'intermediate', label: t('cat_intermediate', 'Intermediate'), emoji: '✝️', color: '#10B981', desc: t('cat_intermediate_range', 'Ages 12 – 17') },
  { id: 'youth',        label: t('cat_youth', 'Youth'),               emoji: '🎯', color: '#2563EB', desc: t('cat_youth_range', 'Ages 18 – 25')        },
  { id: 'adult',        label: t('cat_adult', 'Adult'),               emoji: '📖', color: '#7C3AED', desc: t('cat_adult_range', '26 & above')           },
];

// Verify-failure codes that no amount of retrying will fix.
const isHardFailure = (code = '') =>
  code === 'email_mismatch' || code === 'amount_mismatch' || /_auth$|_key_missing$/.test(code);

// Pull the provider's transaction status out of a failed verify result. Newer
// backends send it as a field; older ones only embed it in the message.
const txnStatusOf = (r) =>
  (r?.txnStatus || r?.message?.match(/status is "([a-z_]+)"/i)?.[1] || '').toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────────────────
const PrimaryButton = ({ label, onPress, disabled, icon: Icon, color = BLUE, style }) => {
  const press = usePressScale();
  return (
    <Animated.View style={[{ transform: [{ scale: press.scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        style={[st.primaryBtn, { backgroundColor: color, opacity: disabled ? 0.55 : 1, shadowColor: color }]}
      >
        {Icon && <Icon color="#fff" size={16} sw={2.5} />}
        <Text style={st.primaryBtnTxt}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

const SecondaryButton = ({ label, onPress, tk, icon: Icon }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    style={[st.secondaryBtn, { borderColor: tk.border, backgroundColor: tk.surface }]}
  >
    {Icon && <Icon color={tk.textPrimary} size={16} sw={2.25} />}
    <Text style={[st.secondaryBtnTxt, { color: tk.textPrimary }]}>{label}</Text>
  </TouchableOpacity>
);

const LinkButton = ({ label, onPress, tk }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={st.linkBtn} accessibilityRole="button">
    <Text style={[st.linkBtnTxt, { color: tk.textSec }]}>{label}</Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
// Header + stepper
// ─────────────────────────────────────────────────────────────────────────────
const Header = ({ title, onBack, tk }) => (
  <View style={[st.header, { borderBottomColor: tk.border }]}>
    <View style={st.headerSide}>
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[st.iconBtn, { backgroundColor: tk.surfaceEl }]}
        >
          <ICONS.ArrowLeft color={tk.textPrimary} size={18} sw={2.4} />
        </TouchableOpacity>
      )}
    </View>
    <Text style={[st.headerTitle, { color: tk.textPrimary }]} numberOfLines={1}>{title}</Text>
    <View style={st.headerSide} />
  </View>
);

const Stepper = ({ index, tk, t }) => {
  const steps = [
    t('pay_step_details', 'Details'),
    t('pay_step_payment', 'Payment'),
    t('pay_step_done', 'Done'),
  ];
  return (
    <View style={st.stepper}>
      {steps.map((label, i) => {
        const done    = i < index || index === steps.length - 1;
        const current = i === index && !done;
        const color   = done ? GREEN : current ? BLUE : tk.textMuted;
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <View style={[st.stepLine, { backgroundColor: i <= index ? (done ? GREEN : BLUE) : tk.border }]} />
            )}
            <View style={st.stepItem}>
              <View style={[st.stepDot, {
                backgroundColor: done ? GREEN : current ? BLUE : 'transparent',
                borderColor:     done ? GREEN : current ? BLUE : tk.border,
              }]}>
                {done
                  ? <ICONS.Check color="#fff" size={11} sw={3.2} />
                  : <Text style={[st.stepNum, { color: current ? '#fff' : tk.textMuted }]}>{i + 1}</Text>}
              </View>
              <Text style={[st.stepLabel, { color }]}>{label}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Checkout building blocks
// ─────────────────────────────────────────────────────────────────────────────
const Section = ({ title, children, tk }) => (
  <View style={st.section}>
    <Text style={[st.sectionTitle, { color: tk.textSec }]}>{title}</Text>
    {children}
  </View>
);

const Radio = ({ active, color, tk }) => (
  <View style={[st.radio, { borderColor: active ? color : tk.border }]}>
    {active && <View style={[st.radioDot, { backgroundColor: color }]} />}
  </View>
);

const PlanOption = ({ active, title, sub, price, days, badge, accent, onPress, tk, t, isDark }) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ checked: active }}
    style={[st.option, {
      backgroundColor: active ? (isDark ? accent + '1F' : accent + '0D') : tk.surface,
      borderColor:     active ? accent : tk.border,
      borderWidth:     active ? 1.5 : 1,
    }]}
  >
    <Radio active={active} color={accent} tk={tk} />
    <View style={{ flex: 1 }}>
      <View style={st.optionTitleRow}>
        <Text style={[st.optionTitle, { color: tk.textPrimary }]}>{title}</Text>
        {!!badge && (
          <View style={[st.badge, { backgroundColor: accent + '1A' }]}>
            <Text style={[st.badgeTxt, { color: accent }]}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[st.optionSub, { color: tk.textSec }]}>{sub}</Text>
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[st.optionPrice, { color: tk.textPrimary }]}>{price}</Text>
      <Text style={[st.optionDays, { color: tk.textMuted }]}>{days} {t('pay_days', 'days')}</Text>
    </View>
  </TouchableOpacity>
);

const SummaryRow = ({ label, value, tk, strong, valueColor, note }) => (
  <View style={st.sumRow}>
    <Text style={[strong ? st.sumLabelStrong : st.sumLabel, { color: strong ? tk.textPrimary : tk.textSec }]}>{label}</Text>
    <View style={{ flex: 1, alignItems: 'flex-end' }}>
      <Text
        style={[strong ? st.sumValueStrong : st.sumValue, { color: valueColor || tk.textPrimary }]}
        numberOfLines={2}
      >
        {value}
      </Text>
      {!!note && <Text style={[st.sumNote, { color: GREEN }]}>{note}</Text>}
    </View>
  </View>
);

const Notice = ({ tone, text }) => {
  const palette = tone === 'error'
    ? { bg: '#FEF2F2', border: '#FECACA', fg: '#B91C1C', Icon: ICONS.AlertCircle }
    : { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1E40AF', Icon: ICONS.Info };
  return (
    <View style={[st.notice, { backgroundColor: palette.bg, borderColor: palette.border }]} accessibilityLiveRegion="polite">
      <palette.Icon color={palette.fg} size={16} sw={2.25} />
      <Text style={[st.noticeTxt, { color: palette.fg }]}>{text}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Status (processing / verifying / pending / failed) and receipt views
// ─────────────────────────────────────────────────────────────────────────────
const StatusView = ({ tone, icon: Icon, spinner, title, body, children, tk }) => {
  const color = { blue: BLUE, amber: AMBER, red: RED, green: GREEN }[tone] || BLUE;
  return (
    <ScrollView contentContainerStyle={st.statusWrap} showsVerticalScrollIndicator={false}>
      <View style={[st.statusIcon, { backgroundColor: color + '14', borderColor: color + '33' }]}>
        {spinner ? <ActivityIndicator size="large" color={color} /> : <Icon color={color} size={34} sw={2.25} />}
      </View>
      <Text style={[st.statusTitle, { color: tk.textPrimary }]}>{title}</Text>
      {!!body && <Text style={[st.statusBody, { color: tk.textSec }]}>{body}</Text>}
      <View style={{ width: '100%', maxWidth: 380, marginTop: 8 }}>{children}</View>
    </ScrollView>
  );
};

const MiniOrder = ({ tx, tk, t }) => (
  <View style={[st.miniOrder, { backgroundColor: tk.surface, borderColor: tk.border }]}>
    <View style={{ flex: 1 }}>
      <Text style={[st.miniTitle, { color: tk.textPrimary }]} numberOfLines={1}>{tx.title}</Text>
      <Text style={[st.miniSub, { color: tk.textMuted }]} numberOfLines={1}>{tx.access}</Text>
      {!!tx.reference && (
        <Text style={[st.miniRef, { color: tk.textMuted }]} numberOfLines={1} selectable>
          {t('pay_row_reference', 'Ref')}: {tx.reference}
        </Text>
      )}
    </View>
    <Text style={[st.miniPrice, { color: tk.textPrimary }]}>{formatNaira(tx.amountKobo)}</Text>
  </View>
);

const ReceiptView = ({ tx, expiryDate, onDone, tk, t, bottomInset }) => {
  const scale = useRef(new Animated.Value(0.92)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 1, duration: 320, useNativeDriver: true }),
    ]);
    anim.start();
    return () => { try { anim.stop(); } catch { /* already finished */ } };
  }, [scale, fade]);

  const rows = [
    { label: t('pay_row_amount', 'Amount paid'), value: formatNaira(tx.amountKobo) },
    { label: t('pay_row_plan', 'Plan'),          value: tx.title },
    { label: t('pay_row_access', 'Access'),      value: tx.access },
    { label: t('pay_row_valid_until', 'Valid until'), value: formatDate(expiryDate) || '—' },
    { label: t('pay_row_billed_to', 'Billed to'), value: tx.email },
    { label: t('pay_row_reference', 'Reference'), value: tx.reference, mono: true },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={[st.receipt, { backgroundColor: tk.surface, borderColor: tk.border, opacity: fade, transform: [{ scale }] }]}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <LottieView source={require('../assets/lottie/success.json')} autoPlay loop={false} style={{ width: 120, height: 120 }} />
            <Text style={[st.receiptTitle, { color: tk.textPrimary }]}>{t('pay_success_title_v2', 'Payment successful')}</Text>
            <Text style={[st.receiptSub, { color: tk.textSec }]}>
              {t('pay_success_sub_v2', 'Your subscription is active. A confirmation has been sent to your email.')}
            </Text>
          </View>
          <View style={[st.receiptDivider, { borderColor: tk.border }]} />
          {rows.map((r) => (
            <View key={r.label} style={st.receiptRow}>
              <Text style={[st.receiptLabel, { color: tk.textMuted }]}>{r.label}</Text>
              <Text
                style={[st.receiptValue, { color: tk.textPrimary }, r.mono && st.mono]}
                numberOfLines={r.mono ? 1 : 2}
                ellipsizeMode="middle"
                selectable
              >
                {r.value}
              </Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
      <View style={[st.footer, { paddingBottom: bottomInset + 14, backgroundColor: tk.bg, borderTopColor: tk.border }]}>
        <PrimaryButton label={t('pay_start_learning', 'Start learning')} onPress={onDone} color={GREEN} />
      </View>
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
  const insets     = useSafeAreaInsets();
  const { fade, translateY } = useScreenEntry();
  const {
    verifyPayment, plans: ctxPlans, email: accountEmail, expiryDate,
    isSubscribed, isTrial, planType, subscribedCategory,
  } = useSubscription();

  const params     = route?.params || {};
  const bookId     = params.book_id ? String(params.book_id).toLowerCase() : null;
  const isBookFlow = !!bookId;
  const plans      = useMemo(() => ({
    ...ctxPlans,
    single: ctxPlans?.single || DEFAULT_PLANS.single,
    all:    ctxPlans?.all    || DEFAULT_PLANS.all,
  }), [ctxPlans]);
  const categories = useMemo(() => buildCategories(t), [t]);
  const comingSoon = useComingSoonCategories('en');

  // ── Selections ───────────────────────────────────────────────────────────
  // Pre-select from route params (Upgrade → all, Renew → current plan), else
  // the user's existing single category, else the all-access plan.
  const hasSinglePlan = planType === 'single' && SINGLE_CATS.includes(subscribedCategory) && !isTrial;
  const [planId, setPlanId] = useState(() =>
    params.plan === 'single' || params.plan === 'all' ? params.plan : (hasSinglePlan ? 'single' : 'all'));
  const [category, setCategory] = useState(() =>
    SINGLE_CATS.includes(params.category) ? params.category : (hasSinglePlan ? subscribedCategory : null));
  const [email, setEmail]           = useState(accountEmail || '');
  const [emailFocused, setEmailFocused] = useState(false);
  const [providerId, setProviderId] = useState(AVAILABLE_PROVIDERS[0]?.id || 'paystack');
  const emailLocked = !!accountEmail;

  useEffect(() => { if (accountEmail) setEmail(accountEmail); }, [accountEmail]);
  useEffect(() => {
    if (category && comingSoon.has(category)) setCategory(null);
  }, [comingSoon, category]);

  // ── Flow state ───────────────────────────────────────────────────────────
  // checkout → processing → (verifying) → success
  //                       ↘ pending (tab closed, not confirmed) ↔ verifying
  //                       ↘ failed  (unrecoverable / server error)
  const [phase, setPhase]           = useState('checkout');
  const [notice, setNotice]         = useState(null);   // { tone, text } on checkout
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingMsg, setPendingMsg] = useState('');
  const [failure, setFailure]       = useState(null);   // { message, canRecheck }
  const [tx, setTx]                 = useState(null);
  const txRef      = useRef(null);
  const busyRef    = useRef(false);
  const doneRef    = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── Order (what the user is buying) ──────────────────────────────────────
  const order = useMemo(() => {
    if (isBookFlow) {
      const serverPlan = plans[`book_${bookId}`];
      return {
        title:     params.book_title || t('pay_book_subscription', 'Book subscription'),
        access:    t('pay_book_access', 'Every chapter of this book'),
        priceKobo: serverPlan?.price_kobo || params.price_kobo || 50000,
        days:      serverPlan?.days || 365,
        accent:    params.accent || BLUE,
      };
    }
    const p   = plans[planId];
    const cat = categories.find((c) => c.id === category);
    return {
      title:     planId === 'all' ? t('plan_all', 'All Categories') : t('plan_single', 'Single Category'),
      access:    planId === 'all'
        ? t('pay_access_all', 'All 4 age groups')
        : (cat ? `${cat.label} · ${cat.desc}` : t('pay_choose_age_group', 'Choose an age group below')),
      priceKobo: p.price_kobo,
      days:      p.days,
      accent:    planId === 'all' ? PURPLE : BLUE,
    };
  }, [isBookFlow, bookId, plans, planId, category, categories, params.book_title, params.price_kobo, params.accent, t]);

  // Renewing the same active plan stacks on top of the remaining days
  // (backend extends from the current expiry in that case).
  const carryOver = !isBookFlow && isSubscribed && !isTrial && !!expiryDate
    && new Date(expiryDate) > new Date()
    && planType === planId
    && (planId === 'all' || subscribedCategory === category);
  const validUntil = addDays(carryOver ? new Date(expiryDate) : new Date(), order.days);

  const savingsPct = Math.round((1 - plans.all.price_kobo / (plans.single.price_kobo * 4)) * 100);
  const provider   = PROVIDERS.find((p) => p.id === providerId) || AVAILABLE_PROVIDERS[0];

  // ── Pending-transaction persistence ──────────────────────────────────────
  const savePending  = (next) =>
    AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ ...next, savedAt: Date.now() })).catch(() => {});
  const clearPending = () => AsyncStorage.removeItem(PENDING_KEY).catch(() => {});

  // ── Verify (single funnel for every confirmation path) ───────────────────
  const runVerify = useCallback(async (target, { quiet = false, restoring = false } = {}) => {
    if (!target?.reference || busyRef.current || doneRef.current) return;
    busyRef.current = true;
    setPhase('verifying');

    let r;
    try { r = await verifyPayment(target.reference, target.email, target.category, target.bookId); }
    catch (e) { r = { success: false, message: e?.message }; }
    busyRef.current = false;
    if (!mountedRef.current) return;

    if (r.success) {
      doneRef.current = true;
      clearPending();
      setPhase('success');
      return;
    }

    const code       = r.code || '';
    const status     = txnStatusOf(r);
    const inProgress = IN_PROGRESS_STATUSES.includes(status);

    if (isHardFailure(code)) {
      clearPending();
      setFailure({
        canRecheck: false,
        message: /_auth$|_key_missing$/.test(code)
          ? t('pay_err_provider_config', 'Payments are temporarily unavailable. Please try again later.')
          : (r.message || t('pay_failed_msg', 'Payment was not completed. You can try again.')),
      });
      setPhase('failed');
      return;
    }
    if (code === 'verify_failed') {
      setFailure({
        canRecheck: true,
        message: t('pay_err_activate', "We received a response from the payment provider but couldn't activate your plan just now. If you were charged, your payment is safe — tap Check again in a moment."),
      });
      setPhase('failed');
      return;
    }

    // A restored attempt that was simply abandoned isn't worth interrupting
    // the user for — drop it and show the normal checkout.
    if (restoring && !inProgress && code) {
      clearPending();
      txRef.current = null;
      setTx(null);
      setPhase('checkout');
      return;
    }

    setPendingMsg(
      !code
        ? t('pay_check_network', "We couldn't reach the server to confirm your payment. Check your connection and tap Check again.")
        : inProgress
          ? t('pay_in_progress', 'Your payment is still processing. Bank transfers can take a few minutes — tap Check again shortly.')
          : quiet
            ? t('pay_not_completed', "The checkout was closed before payment finished. Reopen it to complete your payment — you haven't been charged.")
            : t('pay_not_received', "We haven't received this payment yet. If you've just paid, wait a moment and check again."),
    );
    setPhase('pending');
  }, [verifyPayment, t]);

  // ── Return-URL handling (auth-session redirect + Linking deep link) ──────
  const handleReturnUrl = useCallback((url) => {
    const current = txRef.current;
    if (!url || !current) return;
    // Ignore deep links for some other (older) transaction.
    const m = url.match(/[?&](?:ref|reference|trxref|tx_ref|session_id)=([^&#]+)/);
    if (m && decodeURIComponent(m[1]) !== current.reference) return;

    if (/[?&]status=cancelled/i.test(url)) {
      clearPending();
      setPhase('checkout');
      setNotice({ tone: 'info', text: t('pay_cancelled_note', "Payment cancelled — you haven't been charged.") });
      return;
    }
    if (/[?&]status=failed/i.test(url)) {
      setPendingMsg(t('pay_failed_msg', 'Payment was not completed. You can try again.'));
      setPhase('pending');
      return;
    }
    runVerify(current);
  }, [runVerify, t]);

  const openCheckout = useCallback(async (target) => {
    if (!target?.authUrl) return;
    setPhase('processing');
    let result;
    try {
      result = await WebBrowser.openAuthSessionAsync(target.authUrl, REDIRECT_URL, BROWSER_OPTS);
    } catch {
      if (!mountedRef.current) return;
      setPendingMsg(t('pay_open_failed', "We couldn't open the secure checkout. Tap Reopen checkout to try again."));
      setPhase('pending');
      return;
    }
    if (!mountedRef.current || doneRef.current) return;
    if (result?.type === 'success' && result.url) handleReturnUrl(result.url);
    // Closed by hand — the user may still have paid. Check quietly.
    else runVerify(target, { quiet: true });
  }, [handleReturnUrl, runVerify, t]);

  // Deep links can also arrive through Linking (e.g. "Return to app" on the
  // callback page). Same funnel; runVerify de-dupes.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url || doneRef.current || !txRef.current) return;
      if (/^gospelar:\/\/payment-success|gospelar\.com\/payment-success/i.test(url)) handleReturnUrl(url);
    });
    return () => sub.remove();
  }, [handleReturnUrl]);

  // Resume a transaction interrupted by the app being killed mid-payment.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PENDING_KEY).then((raw) => {
      if (!alive || !raw) return;
      let saved = null;
      try { saved = JSON.parse(raw); } catch { /* corrupt */ }
      if (!saved?.reference || Date.now() - (saved.savedAt || 0) > PENDING_TTL_MS) { clearPending(); return; }
      txRef.current = saved;
      setTx(saved);
      runVerify(saved, { restoring: true });
    }).catch(() => {});
    return () => { alive = false; };
    // Mount-only: we only ever resume once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start checkout ───────────────────────────────────────────────────────
  const startCheckout = async () => {
    const errs = {};
    if (!isBookFlow && planId === 'single' && !category) {
      errs.category = t('pay_err_no_category', 'Please select an age category for your plan.');
    }
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) {
      errs.email = em
        ? t('pay_email_invalid', 'Enter a valid email address.')
        : t('pay_email_required', 'Please enter your email.');
    }
    setFieldErrors(errs);
    if (errs.category || errs.email) {
      setNotice({ tone: 'error', text: errs.category || errs.email });
      return;
    }

    setNotice(null);
    doneRef.current = false;
    setPhase('processing');

    const verifyCategory = isBookFlow ? null : (planId === 'all' ? 'all' : category);
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), INIT_TIMEOUT_MS);
    let data = {};
    let ok   = false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/initialize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  ctrl.signal,
        body: JSON.stringify({
          email:    em,
          plan:     isBookFlow ? 'single' : planId,
          category: verifyCategory || 'adult',
          book_id:  bookId,
          provider: providerId,
        }),
      });
      data = await res.json().catch(() => ({}));
      ok   = data.status === 'success' && !!data.authorization_url && !!data.reference;
      if (!ok && !data.message) data.message = `${t('pay_init_failed', "Couldn't start payment")} (HTTP ${res.status})`;
    } catch (e) {
      data = {
        message: e?.name === 'AbortError'
          ? t('pay_err_timeout', 'The connection timed out. Please try again.')
          : t('pay_err_network', 'Network error — check your connection and try again.'),
      };
    } finally {
      clearTimeout(timer);
    }
    if (!mountedRef.current) return;

    if (!ok) {
      setPhase('checkout');
      setNotice({
        tone: 'error',
        text: /_auth$|_key_missing$/.test(data.code || '')
          ? t('pay_err_provider_config', 'Payments are temporarily unavailable. Please try again later.')
          : data.message,
      });
      return;
    }

    const next = {
      reference:  data.reference,
      authUrl:    data.authorization_url,
      email:      em,
      category:   verifyCategory,
      bookId,
      provider:   providerId,
      title:      order.title,
      access:     order.access,
      amountKobo: data.amount_kobo || order.priceKobo,
      dest:       isBookFlow ? 'Library' : 'HomeScreen',
    };
    txRef.current = next;
    setTx(next);
    savePending(next);
    openCheckout(next);
  };

  // ── Navigation ───────────────────────────────────────────────────────────
  const exitScreen = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Library');
  }, [navigation]);

  const backToCheckout = useCallback(() => {
    setFailure(null);
    setPendingMsg('');
    setPhase('checkout');
  }, []);

  const finish = useCallback(() => {
    navigation.replace(txRef.current?.dest || (isBookFlow ? 'Library' : 'HomeScreen'));
  }, [navigation, isBookFlow]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'processing' || phase === 'verifying') return true;
      if (phase === 'pending' || phase === 'failed')       { backToCheckout(); return true; }
      if (phase === 'success')                             { finish(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [phase, backToCheckout, finish]);

  const stepIndex = phase === 'checkout' ? 0 : phase === 'success' ? 2 : 1;
  const headerTitle = phase === 'success'
    ? t('pay_receipt', 'Receipt')
    : t('pay_checkout', 'Checkout');
  const onHeaderBack =
    phase === 'checkout' ? exitScreen :
    phase === 'pending' || phase === 'failed' ? backToCheckout :
    null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      <Header title={headerTitle} onBack={onHeaderBack} tk={tk} />
      <Stepper index={stepIndex} tk={tk} t={t} />

      {phase === 'checkout' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.ScrollView
            style={{ opacity: fade, transform: [{ translateY }] }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── 1. What you're buying ─────────────────────────────────── */}
            {isBookFlow ? (
              <Section title={t('pay_section_item', 'Your purchase')} tk={tk}>
                <View style={[st.option, { backgroundColor: tk.surface, borderColor: order.accent, borderWidth: 1.5 }]}>
                  <View style={[st.bookIcon, { backgroundColor: order.accent + '1A' }]}>
                    <ICONS.Book color={order.accent} size={20} sw={2.25} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.optionTitle, { color: tk.textPrimary }]} numberOfLines={2}>{order.title}</Text>
                    <Text style={[st.optionSub, { color: tk.textSec }]}>{order.access}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[st.optionPrice, { color: tk.textPrimary }]}>{formatNaira(order.priceKobo)}</Text>
                    <Text style={[st.optionDays, { color: tk.textMuted }]}>{order.days} {t('pay_days', 'days')}</Text>
                  </View>
                </View>
              </Section>
            ) : (
              <Section title={t('pay_section_plan', 'Choose your plan')} tk={tk}>
                <PlanOption
                  active={planId === 'all'}
                  title={t('plan_all', 'All Categories')}
                  sub={savingsPct >= 10
                    ? t('pay_save_pct', 'Every age group · save {n}%').replace('{n}', String(savingsPct))
                    : t('pay_all_tagline', 'Access every age group')}
                  price={formatNaira(plans.all.price_kobo)}
                  days={plans.all.days}
                  badge={t('pay_tag_best_value', 'BEST VALUE')}
                  accent={PURPLE}
                  onPress={() => { setPlanId('all'); setNotice(null); setFieldErrors({}); }}
                  tk={tk} t={t} isDark={isDark}
                />
                <PlanOption
                  active={planId === 'single'}
                  title={t('plan_single', 'Single Category')}
                  sub={t('pay_single_tagline', 'Access one age group')}
                  price={formatNaira(plans.single.price_kobo)}
                  days={plans.single.days}
                  accent={BLUE}
                  onPress={() => { setPlanId('single'); setNotice(null); }}
                  tk={tk} t={t} isDark={isDark}
                />

                {planId === 'single' && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={[st.subLabel, { color: fieldErrors.category ? RED : tk.textSec }]}>
                      {t('pay_select_age_group', 'Age group')}
                    </Text>
                    <View style={st.catGrid}>
                      {categories.map((cat) => {
                        const active = category === cat.id;
                        const soon   = comingSoon.has(cat.id);
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            disabled={soon}
                            activeOpacity={0.88}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active, disabled: soon }}
                            onPress={() => { setCategory(cat.id); setNotice(null); setFieldErrors((e) => ({ ...e, category: null })); }}
                            style={[st.catCard, {
                              backgroundColor: active ? (isDark ? cat.color + '22' : cat.color + '0E') : tk.surface,
                              borderColor:     active ? cat.color : (fieldErrors.category ? RED + '66' : tk.border),
                              borderWidth:     active ? 1.5 : 1,
                              opacity:         soon ? 0.5 : 1,
                            }]}
                          >
                            <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[st.catLabel, { color: tk.textPrimary }]} numberOfLines={1}>{cat.label}</Text>
                              <Text style={[st.catDesc, { color: soon ? cat.color : tk.textMuted }]} numberOfLines={1}>
                                {soon ? t('class_coming_soon', 'Coming soon') : cat.desc}
                              </Text>
                            </View>
                            {active && (
                              <View style={[st.catCheck, { backgroundColor: cat.color }]}>
                                <ICONS.Check color="#fff" size={10} sw={3} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View style={[st.included, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                  {[
                    t('pay_inc_lessons', 'Weekly lessons'),
                    t('pay_inc_devotionals', 'Daily devotionals'),
                    t('pay_inc_quizzes', 'Lesson quizzes'),
                    t('pay_inc_languages', '4 languages'),
                  ].map((f) => (
                    <View key={f} style={st.includedItem}>
                      <ICONS.Check color={GREEN} size={13} sw={3} />
                      <Text style={[st.includedTxt, { color: tk.textSec }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* ── 2. Billing email ──────────────────────────────────────── */}
            <Section title={t('pay_section_email', 'Billing email')} tk={tk}>
              {emailLocked ? (
                <View style={[st.option, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                  <View style={[st.bookIcon, { backgroundColor: BLUE + '14' }]}>
                    <ICONS.Mail color={BLUE} size={18} sw={2.25} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.optionTitle, { color: tk.textPrimary, fontSize: 14.5 }]} numberOfLines={1}>{email}</Text>
                    <Text style={[st.optionSub, { color: tk.textMuted }]}>{t('pay_email_linked', 'Linked to your account')}</Text>
                  </View>
                  <ICONS.ShieldCheck color={GREEN} size={18} sw={2.25} />
                </View>
              ) : (
                <>
                  <View style={[st.inputWrap, {
                    backgroundColor: tk.surface,
                    borderColor: fieldErrors.email ? RED : emailFocused ? BLUE : tk.border,
                  }]}>
                    <ICONS.Mail color={tk.textMuted} size={18} sw={2.25} />
                    <TextInput
                      style={[st.input, { color: tk.textPrimary }]}
                      placeholder={t('register_email_placeholder', 'you@example.com')}
                      placeholderTextColor={tk.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="done"
                      value={email}
                      onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: null })); setNotice(null); }}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                    />
                  </View>
                  <Text style={[st.helpTxt, { color: fieldErrors.email ? RED : tk.textMuted }]}>
                    {fieldErrors.email || t('pay_email_help_short', 'Use this email to restore access on any device.')}
                  </Text>
                </>
              )}
            </Section>

            {/* ── 3. Payment method ─────────────────────────────────────── */}
            <Section title={t('pay_section_method', 'Payment method')} tk={tk}>
              {AVAILABLE_PROVIDERS.map((p) => {
                const active = providerId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.9}
                    disabled={AVAILABLE_PROVIDERS.length === 1}
                    onPress={() => setProviderId(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    style={[st.option, {
                      backgroundColor: tk.surface,
                      borderColor: active ? BLUE : tk.border,
                      borderWidth: active ? 1.5 : 1,
                    }]}
                  >
                    <Radio active={active} color={BLUE} tk={tk} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.optionTitle, { color: tk.textPrimary }]}>{p.label}</Text>
                      <Text style={[st.optionSub, { color: tk.textSec }]}>{p.methods}</Text>
                    </View>
                    <ICONS.CreditCard color={tk.textMuted} size={20} sw={2} />
                  </TouchableOpacity>
                );
              })}
            </Section>

            {/* ── Order summary ─────────────────────────────────────────── */}
            <Section title={t('pay_section_summary', 'Order summary')} tk={tk}>
              <View style={[st.summary, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                <SummaryRow label={t('pay_row_plan', 'Plan')}   value={order.title}  tk={tk} />
                <SummaryRow label={t('pay_row_access', 'Access')} value={order.access} tk={tk}
                  valueColor={!isBookFlow && planId === 'single' && !category ? tk.textMuted : undefined} />
                <SummaryRow label={t('pay_row_duration', 'Duration')} value={`${order.days} ${t('pay_days', 'days')}`} tk={tk} />
                <SummaryRow
                  label={t('pay_row_valid_until', 'Valid until')}
                  value={formatDate(validUntil)}
                  note={carryOver ? t('pay_carry_over', 'Includes your remaining days') : null}
                  tk={tk}
                />
                <View style={[st.sumDivider, { backgroundColor: tk.border }]} />
                <SummaryRow label={t('pay_row_total', 'Total')} value={formatNaira(order.priceKobo)} tk={tk} strong />
              </View>
              <Text style={[st.finePrint, { color: tk.textMuted }]}>
                {t('pay_fine_print', 'One-time payment. No automatic renewal — you choose whether to renew when your plan ends.')}
                {provider?.currency && provider.currency !== 'NGN'
                  ? ' ' + t('pay_usd_note', 'Charged in {c} at checkout.').replace('{c}', provider.currency)
                  : ''}
              </Text>
            </Section>
          </Animated.ScrollView>

          {/* ── Sticky pay bar ──────────────────────────────────────────── */}
          <View style={[st.footer, { paddingBottom: insets.bottom + 12, backgroundColor: tk.bg, borderTopColor: tk.border }]}>
            {!!notice && <Notice tone={notice.tone} text={notice.text} />}
            <View style={st.footerRow}>
              <View>
                <Text style={[st.footerLabel, { color: tk.textMuted }]}>{t('pay_row_total', 'Total')}</Text>
                <Text style={[st.footerPrice, { color: tk.textPrimary }]}>{formatNaira(order.priceKobo)}</Text>
              </View>
              <PrimaryButton
                style={{ flex: 1 }}
                icon={ICONS.Lock}
                label={t('pay_pay_amount', 'Pay {amount}').replace('{amount}', formatNaira(order.priceKobo))}
                onPress={startCheckout}
              />
            </View>
            <View style={st.secureRow}>
              <ICONS.ShieldCheck color={tk.textMuted} size={12} sw={2.25} />
              <Text style={[st.secureTxt, { color: tk.textMuted }]}>
                {t('pay_secured_by', 'Payments are processed securely by {p}').replace('{p}', provider?.label || 'Paystack')}
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {phase === 'processing' && (
        <StatusView
          tone="blue" spinner tk={tk}
          title={t('pay_opening_secure_v2', 'Opening secure checkout…')}
          body={t('pay_opening_body', "Complete your payment in the secure window. You'll come back here automatically when you're done.")}
        >
          {tx && <MiniOrder tx={tx} tk={tk} t={t} />}
        </StatusView>
      )}

      {phase === 'verifying' && (
        <StatusView
          tone="blue" spinner tk={tk}
          title={t('pay_confirming', 'Confirming your payment…')}
          body={t('pay_confirming_body', "This usually takes a few seconds. Please don't close the app.")}
        >
          {tx && <MiniOrder tx={tx} tk={tk} t={t} />}
        </StatusView>
      )}

      {phase === 'pending' && tx && (
        <StatusView tone="amber" icon={ICONS.Clock} tk={tk}
          title={t('pay_pending_title', 'Payment not confirmed yet')}
          body={pendingMsg}
        >
          <MiniOrder tx={tx} tk={tk} t={t} />
          <PrimaryButton label={t('pay_reopen_checkout', 'Reopen checkout')} icon={ICONS.Lock} onPress={() => openCheckout(txRef.current)} />
          <View style={{ height: 10 }} />
          <SecondaryButton label={t('pay_ive_paid_check', "I've paid — check again")} icon={ICONS.RefreshCw} onPress={() => runVerify(txRef.current)} tk={tk} />
          <LinkButton label={t('pay_back_to_checkout', 'Back to checkout')} onPress={backToCheckout} tk={tk} />
        </StatusView>
      )}

      {phase === 'failed' && (
        <StatusView tone="red" icon={ICONS.AlertTriangle} tk={tk}
          title={failure?.canRecheck ? t('pay_activation_delayed', 'Activation delayed') : t('pay_failed_title', 'Payment Failed')}
          body={failure?.message}
        >
          {tx && <MiniOrder tx={tx} tk={tk} t={t} />}
          {failure?.canRecheck ? (
            <>
              <PrimaryButton label={t('pay_check_again', 'Check again')} icon={ICONS.RefreshCw} onPress={() => runVerify(txRef.current)} />
              <LinkButton label={t('pay_back_to_checkout', 'Back to checkout')} onPress={backToCheckout} tk={tk} />
            </>
          ) : (
            <PrimaryButton label={t('pay_try_again', 'Try Again')} onPress={backToCheckout} />
          )}
        </StatusView>
      )}

      {phase === 'success' && tx && (
        <ReceiptView tx={tx} expiryDate={expiryDate} onDone={finish} tk={tk} t={t} bottomInset={insets.bottom} />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerSide:   { width: 44 },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  iconBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Stepper
  stepper:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 28, paddingTop: 14, paddingBottom: 6 },
  stepItem:     { alignItems: 'center', width: 64 },
  stepDot:      { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepNum:      { fontSize: 11, fontWeight: '800' },
  stepLabel:    { fontSize: 11, fontWeight: '700', marginTop: 5 },
  stepLine:     { flex: 1, height: 2, borderRadius: 1, marginTop: 10, marginHorizontal: -14 },

  // Sections
  section:      { marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10, letterSpacing: 0.1 },
  subLabel:     { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4 },

  // Generic selectable row
  option:         { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  optionTitle:    { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.2 },
  optionSub:      { fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  optionPrice:    { fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  optionDays:     { fontSize: 11, fontWeight: '600', marginTop: 1 },
  badge:          { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt:       { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:       { width: 10, height: 10, borderRadius: 5 },
  bookIcon:       { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Category grid
  catGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  catCard:      { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  catLabel:     { fontSize: 13.5, fontWeight: '800' },
  catDesc:      { fontSize: 11, fontWeight: '600', marginTop: 1 },
  catCheck:     { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // Included strip
  included:     { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, rowGap: 8, marginTop: 6 },
  includedItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6 },
  includedTxt:  { fontSize: 12, fontWeight: '600' },

  // Email
  inputWrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, height: 52 },
  input:        { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  helpTxt:      { fontSize: 12, fontWeight: '600', marginTop: 6, marginLeft: 2 },

  // Summary
  summary:        { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  sumRow:         { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 12 },
  sumLabel:       { fontSize: 13, fontWeight: '600' },
  sumLabelStrong: { fontSize: 15, fontWeight: '800' },
  sumValue:       { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  sumValueStrong: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  sumNote:        { fontSize: 11, fontWeight: '700', marginTop: 2 },
  sumDivider:     { height: 1, marginVertical: 4 },
  finePrint:      { fontSize: 11.5, lineHeight: 17, marginTop: 10, paddingHorizontal: 2 },

  // Footer
  footer:       { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12 },
  footerRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  footerLabel:  { fontSize: 11, fontWeight: '700' },
  footerPrice:  { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  secureRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
  secureTxt:    { fontSize: 11, fontWeight: '600' },

  // Notice
  notice:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 10 },
  noticeTxt:    { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },

  // Buttons
  primaryBtn:      { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
  primaryBtnTxt:   { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  secondaryBtn:    { height: 50, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryBtnTxt: { fontSize: 14.5, fontWeight: '700' },
  linkBtn:         { alignItems: 'center', paddingVertical: 14 },
  linkBtnTxt:      { fontSize: 13.5, fontWeight: '700' },

  // Status views
  statusWrap:   { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  statusIcon:   { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  statusTitle:  { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, textAlign: 'center', marginBottom: 8 },
  statusBody:   { fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 340, marginBottom: 14 },
  miniOrder:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  miniTitle:    { fontSize: 14, fontWeight: '800' },
  miniSub:      { fontSize: 12, fontWeight: '600', marginTop: 2 },
  miniRef:      { fontSize: 10.5, fontWeight: '600', marginTop: 4 },
  miniPrice:    { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },

  // Receipt
  receipt:        { borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingBottom: 10 },
  receiptTitle:   { fontSize: 21, fontWeight: '900', letterSpacing: -0.4, textAlign: 'center' },
  receiptSub:     { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, marginBottom: 4, paddingHorizontal: 6 },
  receiptDivider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 14 },
  receiptRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, gap: 16 },
  receiptLabel:   { fontSize: 12.5, fontWeight: '600' },
  receiptValue:   { flex: 1, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  mono:           { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11.5, fontWeight: '600' },
});
