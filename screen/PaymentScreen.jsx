// screens/PaymentScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Gospelar Premium checkout. The app is freemium: Sunday School is free with
// ads; ONE paid plan — Premium — removes all ads and unlocks premium books
// (Victory Month Prayer). Premium is the admin-priced 'all' plan on the
// backend, which already grants the 'all' books wildcard.
//
//   1 · Details   Premium card (price, benefits), billing email, Pay button.
//   2 · Payment   Provider's hosted checkout in a Chrome Custom Tab (Android)
//                 / ASWebAuthenticationSession (iOS) via
//                 WebBrowser.openAuthSessionAsync — Google Play treats this as
//                 the system browser, not a native WebView, so its Payments
//                 policy restriction does not apply. /api/payments/callback
//                 redirects to gospelar://payment-success?ref=…, the tab
//                 closes and we verify with POST /api/verify-payment.
//   3 · Done      Receipt.
//
// Robustness (unchanged from the previous checkout):
//   • Every return path (redirect, Linking deep link, user closing the tab)
//     converges on ONE de-duplicated verify call.
//   • Closing the tab without the redirect triggers a quiet verify — paid
//     users are activated; unpaid ones get Reopen / Check again.
//   • The in-flight transaction is persisted (PENDING_KEY) so a payment
//     interrupted by Android killing the app is confirmed on the next visit.
//   • Logged-in users pay with their account email (locked) — another email
//     would re-key the subscription and force a logout.
//
// Route params (all optional):
//   returnTo: { name, params }  — where to go after paying (e.g. the book the
//                                 user was trying to open). Default: back.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, StatusBar,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Pressable,
  Linking, BackHandler, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage        from '@react-native-async-storage/async-storage';
import * as WebBrowser     from 'expo-web-browser';
import LottieView          from 'lottie-react-native';
import { API_BASE_URL }    from '../services/api';
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

const PREMIUM_PLAN    = 'all';   // backend plan_id that Premium maps to
const REDIRECT_URL    = 'gospelar://payment-success';
const PENDING_KEY     = 'gospelar_pending_payment';
const PENDING_TTL_MS  = 6 * 60 * 60 * 1000;   // bank transfers can take a while
const INIT_TIMEOUT_MS = 45_000;
const EMAIL_RE        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PREMIUM = { price_kobo: 100000, days: 300 };
// Online checkouts. Kora Pay is offered only when the backend has its key
// (GET /api/payments/providers); its checkout shows every channel Kora has.
const PROVIDERS = {
  paystack: { id: 'paystack', label: 'Paystack', methods: 'Card · Bank transfer · USSD' },
  korapay:  { id: 'korapay',  label: 'Kora Pay', methods: 'Card · Bank transfer · Pay with Bank' },
};

const BROWSER_OPTS = {
  // MUST be true. false adds FLAG_ACTIVITY_NO_HISTORY on Android, which
  // destroys the checkout the moment the user switches to their bank app to
  // make Paystack's bank transfer / approve an OTP — they'd come back to
  // nothing. With true the checkout survives as its own Recents entry.
  showInRecents:      true,
  // iOS: skip the confusing "Gospelar wants to use paystack.co to Sign In"
  // system alert (no cookies are needed for a one-off checkout).
  preferEphemeralSession: true,
  controlsColor:      '#FFFFFF',
  toolbarColor:       '#060E20',
  dismissButtonStyle: 'close',
};

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

// Verify-failure codes that no amount of retrying will fix.
const isHardFailure = (code = '') =>
  code === 'email_mismatch' || code === 'amount_mismatch' || /_auth$|_key_missing$/.test(code);

// Provider transaction status from a failed verify. Newer backends send it as
// a field; older ones only embed it in the message.
const txnStatusOf = (r) =>
  (r?.txnStatus || r?.message?.match(/status is "([a-z_]+)"/i)?.[1] || '').toLowerCase();

// JSON fetch with a timeout. Never throws: { ok, status, data }.
async function fetchJson(path, { method = 'GET', body, timeoutMs = 30_000 } = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res  = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    body ? JSON.stringify(body) : undefined,
      signal:  ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: {}, aborted: e?.name === 'AbortError' };
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks
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

// ── Status (processing / verifying / pending / failed) + receipt ────────────
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
    { label: t('pay_row_amount', 'Amount paid'),      value: formatNaira(tx.amountKobo) },
    { label: t('pay_row_plan', 'Plan'),               value: tx.title },
    { label: t('pay_row_valid_until', 'Valid until'), value: formatDate(expiryDate) || '—' },
    { label: t('pay_row_billed_to', 'Billed to'),     value: tx.email },
    { label: t('pay_row_reference', 'Reference'),     value: tx.reference, mono: true },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={[st.receipt, { backgroundColor: tk.surface, borderColor: tk.border, opacity: fade, transform: [{ scale }] }]}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <LottieView source={require('../assets/lottie/success.json')} autoPlay loop={false} style={{ width: 120, height: 120 }} />
            <Text style={[st.receiptTitle, { color: tk.textPrimary }]}>{t('premium_success_title', "You're Premium!")}</Text>
            <Text style={[st.receiptSub, { color: tk.textSec }]}>
              {t('premium_success_sub', 'Ads are gone and Victory Month Prayer is unlocked. A receipt has been sent to your email.')}
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
        <PrimaryButton label={t('btn_continue', 'Continue')} onPress={onDone} color={GREEN} />
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
    verifyPayment, plans, email: accountEmail, expiryDate,
    isSubscribed, isTrial, planType, refreshPlans, recheck,
  } = useSubscription();

  // Show the price the server will actually charge (the admin may have
  // changed it since the plans were cached at launch).
  useEffect(() => { refreshPlans?.(); }, [refreshPlans]);

  const returnTo = route?.params?.returnTo || null;
  const premium  = plans?.[PREMIUM_PLAN] || DEFAULT_PREMIUM;
  const title    = t('premium_title', 'Gospelar Premium');

  const [email, setEmail]               = useState(accountEmail || '');
  const [emailFocused, setEmailFocused] = useState(false);
  const [emailError, setEmailError]     = useState('');
  const emailLocked = !!accountEmail;
  useEffect(() => { if (accountEmail) setEmail(accountEmail); }, [accountEmail]);

  // ── Payment method: card (Paystack, instant) or direct bank transfer ─────
  const [method, setMethod]         = useState('card');
  const [btInfo, setBtInfo]         = useState(null);   // { enabled, bank_name, account_number, account_name, amount_kobo }
  const [btReq, setBtReq]           = useState(null);   // { code, status, amount_kobo, sender_name, note, … }
  const [btBank, setBtBank]         = useState(null);
  const [senderName, setSenderName] = useState('');
  const [senderError, setSenderError] = useState('');
  const [btBusy, setBtBusy]         = useState(false);
  const [btMsg, setBtMsg]           = useState('');

  // ── Flow state ───────────────────────────────────────────────────────────
  // checkout → processing → (verifying) → success
  //                       ↘ pending (tab closed, not confirmed) ↔ verifying
  //                       ↘ failed  (unrecoverable / server error)
  const [phase, setPhase]           = useState('checkout');
  const [notice, setNotice]         = useState(null);   // { tone, text } on checkout
  const [pendingMsg, setPendingMsg] = useState('');
  const [failure, setFailure]       = useState(null);   // { message, canRecheck }
  const [tx, setTx]                 = useState(null);
  const txRef      = useRef(null);
  const busyRef    = useRef(false);
  const doneRef    = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Already Premium (paid, not a trial) → paying again stacks on the days left.
  const activePremium = isSubscribed && !isTrial && planType === PREMIUM_PLAN
    && !!expiryDate && new Date(expiryDate) > new Date();
  const validUntil = addDays(activePremium ? new Date(expiryDate) : new Date(), premium.days);

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
    const inProgress = IN_PROGRESS_STATUSES.includes(txnStatusOf(r));

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
    AsyncStorage.getItem(PENDING_KEY).then(async (raw) => {
      if (!alive || !raw) return;
      let saved = null;
      try { saved = JSON.parse(raw); } catch { /* corrupt */ }
      if (!saved?.reference || Date.now() - (saved.savedAt || 0) > PENDING_TTL_MS) { clearPending(); return; }
      // Started by a different account on this device (logged out since)?
      // Verifying it would switch the stored account email and trip the
      // session check into a forced logout — leave it alone.
      const current = ((await AsyncStorage.getItem('userEmail')) || '').toLowerCase();
      if (current && saved.email !== current) { clearPending(); return; }
      if (!alive) return;
      txRef.current = saved;
      setTx(saved);
      runVerify(saved, { restoring: true });
    }).catch(() => {});
    return () => { alive = false; };
    // Mount-only: we only ever resume once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Bank transfer ────────────────────────────────────────────────────────
  // Load whether direct transfer is offered, and any transfer this account
  // already has in flight (so reopening the screen shows where it stands).
  // Which online checkouts the server can take (Kora Pay appears once its
  // key is set). Paystack is always offered.
  const [liveProviders, setLiveProviders] = useState(['paystack']);
  useEffect(() => {
    let alive = true;
    fetchJson('/api/payments/providers').then(({ ok, data }) => {
      if (alive && ok && Array.isArray(data.providers)) setLiveProviders(['paystack', ...data.providers]);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchJson('/api/payments/bank-transfer/info').then(({ ok, data }) => {
      if (alive && ok && data.enabled) setBtInfo(data);
    });
    if (accountEmail) {
      fetchJson(`/api/payments/bank-transfer/status/${encodeURIComponent(accountEmail)}`).then(({ ok, data }) => {
        if (!alive || !ok || !data.request) return;
        if (data.request.status === 'approved' && !isSubscribed) recheck?.();
        if (data.request.status === 'submitted' || data.request.status === 'awaiting_transfer') {
          setBtReq(data.request);
          setBtBank(data.bank);
          if (data.request.sender_name) setSenderName(data.request.sender_name);
        }
      });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountEmail]);

  const validEmailOrFlag = () => {
    const em = email.trim().toLowerCase();
    if (EMAIL_RE.test(em)) return em;
    const msg = em
      ? t('pay_email_invalid', 'Enter a valid email address.')
      : t('pay_email_required', 'Please enter your email.');
    setEmailError(msg);
    setNotice({ tone: 'error', text: msg });
    return null;
  };

  const startTransfer = async () => {
    const em = validEmailOrFlag();
    if (!em) return;
    setNotice(null);
    setBtBusy(true);
    const { ok, data, aborted } = await fetchJson('/api/payments/bank-transfer', { method: 'POST', body: { email: em } });
    setBtBusy(false);
    if (!mountedRef.current) return;
    if (!ok || !data.request) {
      setNotice({
        tone: 'error',
        text: data.message || (aborted
          ? t('pay_err_timeout', 'The connection timed out. Please try again.')
          : t('pay_err_network', 'Network error — check your connection and try again.')),
      });
      return;
    }
    setBtReq(data.request);
    setBtBank(data.bank);
    setBtMsg('');
    setPhase(data.request.status === 'submitted' ? 'transfer_review' : 'transfer');
  };

  const submitTransfer = async () => {
    const name = senderName.trim();
    if (name.length < 3) {
      setSenderError(t('bt_sender_required', 'Enter the name on the account you sent the money from.'));
      return;
    }
    setBtBusy(true);
    const { ok, data } = await fetchJson(`/api/payments/bank-transfer/${encodeURIComponent(btReq.code)}/submit`, {
      method: 'POST', body: { email: btReq.email, sender_name: name },
    });
    setBtBusy(false);
    if (!mountedRef.current) return;
    if (!ok || !data.request) {
      setSenderError(data.message || t('pay_err_network', 'Network error — check your connection and try again.'));
      return;
    }
    setBtReq(data.request);
    setBtMsg('');
    setPhase('transfer_review');
  };

  const checkTransfer = async () => {
    if (!btReq) return;
    setBtBusy(true);
    const { ok, data } = await fetchJson(`/api/payments/bank-transfer/status/${encodeURIComponent(btReq.email)}`);
    if (!mountedRef.current) return;
    if (!ok) {
      setBtBusy(false);
      setBtMsg(t('pay_check_network', "We couldn't reach the server to confirm your payment. Check your connection and tap Check again."));
      return;
    }
    const r = data.request?.code === btReq.code ? data.request : btReq;
    setBtReq(r);
    if (r.status === 'approved') {
      await recheck?.();   // pull the new Premium status (ads off, books unlocked)
      setBtBusy(false);
      if (!mountedRef.current) return;
      const done = {
        reference: r.code, email: r.email, title, amountKobo: r.amount_kobo, returnTo,
      };
      txRef.current = done;
      setTx(done);
      doneRef.current = true;
      setPhase('success');
      return;
    }
    setBtBusy(false);
    setBtMsg(r.status === 'rejected'
      ? ''
      : t('bt_not_yet', "Not confirmed yet. We check transfers several times a day and will email you as soon as Premium is active."));
  };

  const shareTransferDetails = () => {
    const bank = btBank || btInfo || {};
    Share.share({
      message:
        `${bank.bank_name}\n${bank.account_number}\n${bank.account_name}\n`
        + `${t('bt_amount', 'Amount')}: ${formatNaira(btReq?.amount_kobo)}\n`
        + `${t('bt_narration', 'Narration')}: ${btReq?.code}`,
    }).catch(() => {});
  };

  const payWithCardInstead = () => {
    setMethod('card');
    setBtMsg('');
    setPhase('checkout');
  };

  // ── Start checkout ───────────────────────────────────────────────────────
  const startCheckout = async () => {
    const em = validEmailOrFlag();
    if (!em) return;

    setNotice(null);
    doneRef.current = false;
    setPhase('processing');

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), INIT_TIMEOUT_MS);
    let data = {};
    let ok   = false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/initialize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  ctrl.signal,
        body: JSON.stringify({ email: em, plan: PREMIUM_PLAN, category: 'all', provider: provider.id }),
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
      category:   'all',
      bookId:     null,
      title,
      amountKobo: data.amount_kobo || premium.price_kobo,
      returnTo,
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

  // After paying: open what the user was trying to reach (e.g. the Victory
  // book), otherwise return to wherever they tapped "Remove ads".
  const finish = useCallback(() => {
    const dest = txRef.current?.returnTo || returnTo;
    if (!dest?.name) { exitScreen(); return; }
    // The book's paywall underneath already swapped itself for the book the
    // moment access was granted — just go back to it instead of stacking a
    // second copy (which made Back show the same screen twice).
    const nav  = navigation.getState?.();
    const prev = nav?.routes?.[nav.index - 1];
    if (prev?.name === dest.name) navigation.goBack();
    else navigation.replace(dest.name, dest.params);
  }, [navigation, returnTo, exitScreen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'processing' || phase === 'verifying') return true;
      if (phase === 'pending' || phase === 'failed' || phase === 'transfer' || phase === 'transfer_review') {
        backToCheckout(); return true;
      }
      if (phase === 'success')                             { finish(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [phase, backToCheckout, finish]);

  const stepIndex = phase === 'checkout' ? 0 : phase === 'success' ? 2 : 1;
  const onHeaderBack =
    phase === 'checkout' ? exitScreen :
    ['pending', 'failed', 'transfer', 'transfer_review'].includes(phase) ? backToCheckout :
    null;
  const transferAvailable = !!btInfo?.enabled;
  const usingTransfer     = transferAvailable && method === 'transfer';
  const koraAvailable     = liveProviders.includes('korapay');
  const provider          = koraAvailable && method === 'korapay' ? PROVIDERS.korapay : PROVIDERS.paystack;
  const methodOptions = [
    { id: 'card', Icon: ICONS.CreditCard,
      title: t('pay_method_card', 'Card, USSD or bank app'),
      sub:   t('pay_method_card_sub', 'Instant · secured by Paystack') },
    koraAvailable && { id: 'korapay', Icon: ICONS.CreditCard,
      title: t('pay_method_korapay', 'Card, bank transfer or Pay with Bank'),
      sub:   t('pay_method_korapay_sub', 'Instant · secured by Kora Pay') },
    transferAvailable && { id: 'transfer', Icon: ICONS.Landmark,
      title: t('pay_method_transfer', 'Direct bank transfer'),
      sub:   t('pay_method_transfer_sub', 'To our {bank} account · confirmed within a few hours')
        .replace('{bank}', String(btInfo.bank_name || '').replace(/\s*MFB$/i, '')) },
  ].filter(Boolean);

  const benefits = [
    { Icon: ICONS.EyeOff, text: t('premium_benefit_ads', 'No ads anywhere in the app') },
    { Icon: ICONS.Book,   text: t('premium_benefit_victory', 'Victory Month Prayer — all 31 days') },
    { Icon: ICONS.Star,   text: t('premium_benefit_books', 'Every premium book we add') },
    { Icon: ICONS.Heart,  text: t('premium_benefit_support', 'Supports the Sunday School ministry') },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      <Header title={phase === 'success' ? t('pay_receipt', 'Receipt') : title} onBack={onHeaderBack} tk={tk} />
      <Stepper index={stepIndex} tk={tk} t={t} />

      {phase === 'checkout' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.ScrollView
            style={{ opacity: fade, transform: [{ translateY }] }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Premium card ─────────────────────────────────────────── */}
            <View style={[st.planCard, { backgroundColor: isDark ? PURPLE + '1A' : PURPLE + '0B', borderColor: PURPLE + '55' }]}>
              <View style={st.planHead}>
                <View style={[st.crown, { backgroundColor: PURPLE }]}>
                  <ICONS.Crown color="#fff" size={20} sw={2.25} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.planTitle, { color: tk.textPrimary }]}>{title}</Text>
                  <Text style={[st.planSub, { color: tk.textSec }]}>
                    {t('premium_one_time', 'One-time payment · no auto-renewal')}
                  </Text>
                </View>
              </View>

              <View style={st.priceRow}>
                <Text style={[st.price, { color: tk.textPrimary }]}>{formatNaira(premium.price_kobo)}</Text>
                <Text style={[st.priceDays, { color: tk.textMuted }]}>/ {premium.days} {t('pay_days', 'days')}</Text>
              </View>

              <View style={[st.benefits, { borderTopColor: PURPLE + '33' }]}>
                {benefits.map(({ Icon, text }) => (
                  <View key={text} style={st.benefitRow}>
                    <View style={[st.benefitIcon, { backgroundColor: PURPLE + '1A' }]}>
                      <Icon color={PURPLE} size={14} sw={2.4} />
                    </View>
                    <Text style={[st.benefitTxt, { color: tk.textPrimary }]}>{text}</Text>
                  </View>
                ))}
              </View>
            </View>

            {activePremium && (
              <View style={[st.infoRow, { backgroundColor: GREEN + '12', borderColor: GREEN + '40' }]}>
                <ICONS.CheckCircle color={GREEN} size={16} sw={2.25} />
                <Text style={[st.infoTxt, { color: tk.textPrimary }]}>
                  {t('premium_extend_note', "You're Premium until {date}. Paying now adds {n} more days.")
                    .replace('{date}', formatDate(expiryDate))
                    .replace('{n}', String(premium.days))}
                </Text>
              </View>
            )}

            {/* ── Billing email ────────────────────────────────────────── */}
            <Text style={[st.sectionTitle, { color: tk.textSec }]}>{t('pay_section_email', 'Billing email')}</Text>
            {emailLocked ? (
              <View style={[st.emailRow, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                <ICONS.Mail color={BLUE} size={18} sw={2.25} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.emailTxt, { color: tk.textPrimary }]} numberOfLines={1}>{email}</Text>
                  <Text style={[st.emailSub, { color: tk.textMuted }]}>{t('pay_email_linked', 'Linked to your account')}</Text>
                </View>
                <ICONS.ShieldCheck color={GREEN} size={18} sw={2.25} />
              </View>
            ) : (
              <>
                <View style={[st.inputWrap, {
                  backgroundColor: tk.surface,
                  borderColor: emailError ? RED : emailFocused ? BLUE : tk.border,
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
                    onChangeText={(v) => { setEmail(v); setEmailError(''); setNotice(null); }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    onSubmitEditing={startCheckout}
                  />
                </View>
                <Text style={[st.helpTxt, { color: emailError ? RED : tk.textMuted }]}>
                  {emailError || t('pay_email_help_short', 'Use this email to restore access on any device.')}
                </Text>
              </>
            )}

            {/* ── Pay with (when there is more than one way to pay) ───── */}
            {methodOptions.length > 1 && (
              <>
                <Text style={[st.sectionTitle, { color: tk.textSec }]}>{t('pay_section_method', 'Pay with')}</Text>
                {methodOptions.map((m) => {
                  const active = method === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.9}
                      onPress={() => { setMethod(m.id); setNotice(null); }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      style={[st.methodRow, {
                        backgroundColor: tk.surface,
                        borderColor: active ? PURPLE : tk.border,
                        borderWidth: active ? 1.5 : 1,
                      }]}
                    >
                      <View style={[st.radio, { borderColor: active ? PURPLE : tk.border }]}>
                        {active && <View style={[st.radioDot, { backgroundColor: PURPLE }]} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.emailTxt, { color: tk.textPrimary }]}>{m.title}</Text>
                        <Text style={[st.emailSub, { color: tk.textMuted }]}>{m.sub}</Text>
                      </View>
                      <m.Icon color={tk.textMuted} size={20} sw={2} />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* A transfer already in flight for this account */}
            {btReq && btReq.status === 'submitted' && (
              <TouchableOpacity
                onPress={() => setPhase('transfer_review')}
                activeOpacity={0.85}
                style={[st.infoRow, { backgroundColor: AMBER + '14', borderColor: AMBER + '55' }]}
              >
                <ICONS.Clock color={AMBER} size={16} sw={2.25} />
                <Text style={[st.infoTxt, { color: tk.textPrimary }]}>
                  {t('bt_in_review_banner', 'Your bank transfer ({code}) is being confirmed. Tap to check its status.')
                    .replace('{code}', btReq.code)}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[st.finePrint, { color: tk.textMuted }]}>
              {t('premium_valid_until', 'Premium is valid until {date}. Renew any time — you choose whether to continue.')
                .replace('{date}', formatDate(validUntil))}
            </Text>
          </Animated.ScrollView>

          {/* ── Sticky pay bar ─────────────────────────────────────────── */}
          <View style={[st.footer, { paddingBottom: insets.bottom + 12, backgroundColor: tk.bg, borderTopColor: tk.border }]}>
            {!!notice && <Notice tone={notice.tone} text={notice.text} />}
            {usingTransfer ? (
              <PrimaryButton
                icon={ICONS.Landmark}
                color={PURPLE}
                disabled={btBusy}
                label={btBusy ? t('pay_checking', 'Checking…') : t('bt_get_details', 'Get bank details')}
                onPress={startTransfer}
              />
            ) : (
              <PrimaryButton
                icon={ICONS.Lock}
                color={PURPLE}
                label={t('pay_pay_amount', 'Pay {amount}').replace('{amount}', formatNaira(premium.price_kobo))}
                onPress={startCheckout}
              />
            )}
            <View style={st.secureRow}>
              <ICONS.ShieldCheck color={tk.textMuted} size={12} sw={2.25} />
              <Text style={[st.secureTxt, { color: tk.textMuted }]}>
                {usingTransfer
                  ? t('bt_footer_note', 'Premium is switched on after we confirm your transfer')
                  : t('pay_secured_methods', 'Secured by {p} · {m}')
                      .replace('{p}', provider.label)
                      .replace('{m}', provider.methods)}
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {phase === 'transfer' && btReq && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[st.btTitle, { color: tk.textPrimary }]}>
              {t('bt_title', 'Transfer {amount}').replace('{amount}', formatNaira(btReq.amount_kobo))}
            </Text>
            <Text style={[st.btSub, { color: tk.textSec }]}>
              {t('bt_sub', 'Send exactly this amount from your bank app to the account below.')}
            </Text>

            <View style={[st.btCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
              {[
                { label: t('bt_bank', 'Bank'),                 value: (btBank || btInfo)?.bank_name },
                { label: t('bt_account_number', 'Account number'), value: (btBank || btInfo)?.account_number, big: true },
                { label: t('bt_account_name', 'Account name'), value: (btBank || btInfo)?.account_name },
                { label: t('bt_amount', 'Amount'),             value: formatNaira(btReq.amount_kobo), big: true },
                { label: t('bt_narration', 'Narration / description'), value: btReq.code, accent: true },
              ].map((r, i, arr) => (
                <View key={r.label} style={[st.btRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: tk.border }]}>
                  <Text style={[st.btLabel, { color: tk.textMuted }]}>{r.label}</Text>
                  <Text
                    selectable
                    style={[r.big ? st.btValueBig : st.btValue, { color: r.accent ? PURPLE : tk.textPrimary }]}
                  >
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>
            <View style={st.btShareRow}>
              <Text style={[st.btHint, { color: tk.textMuted }]}>
                {t('bt_copy_hint', 'Press and hold a detail to copy it')}
              </Text>
              <TouchableOpacity onPress={shareTransferDetails} hitSlop={8} accessibilityRole="button">
                <Text style={[st.btShare, { color: BLUE }]}>{t('bt_share', 'Share details')}</Text>
              </TouchableOpacity>
            </View>

            {[
              t('bt_step1', 'Open your bank app and send {amount} to the account above.').replace('{amount}', formatNaira(btReq.amount_kobo)),
              t('bt_step2', 'Type {code} in the narration so we can match your payment.').replace('{code}', btReq.code),
              t('bt_step3', 'Come back here, enter the sender name and tap "I\'ve made the transfer".'),
            ].map((txt, i) => (
              <View key={i} style={st.btStep}>
                <View style={[st.btStepNum, { backgroundColor: PURPLE }]}>
                  <Text style={st.btStepNumTxt}>{i + 1}</Text>
                </View>
                <Text style={[st.btStepTxt, { color: tk.textPrimary }]}>{txt}</Text>
              </View>
            ))}

            <Text style={[st.sectionTitle, { color: tk.textSec }]}>{t('bt_sender_label', 'Name on the sending account')}</Text>
            <View style={[st.inputWrap, { backgroundColor: tk.surface, borderColor: senderError ? RED : tk.border }]}>
              <ICONS.User color={tk.textMuted} size={18} sw={2.25} />
              <TextInput
                style={[st.input, { color: tk.textPrimary }]}
                placeholder={t('bt_sender_placeholder', 'e.g. Adaeze Okafor')}
                placeholderTextColor={tk.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                returnKeyType="done"
                value={senderName}
                onChangeText={(v) => { setSenderName(v); setSenderError(''); }}
                onSubmitEditing={submitTransfer}
              />
            </View>
            <Text style={[st.helpTxt, { color: senderError ? RED : tk.textMuted }]}>
              {senderError || t('bt_sender_help', 'Helps us find your transfer quickly.')}
            </Text>
          </ScrollView>

          <View style={[st.footer, { paddingBottom: insets.bottom + 12, backgroundColor: tk.bg, borderTopColor: tk.border }]}>
            <PrimaryButton
              icon={ICONS.Check}
              color={PURPLE}
              disabled={btBusy}
              label={btBusy ? t('pay_checking', 'Checking…') : t('bt_done_btn', "I've made the transfer")}
              onPress={submitTransfer}
            />
            <LinkButton label={t('bt_pay_card_instead', 'Pay with card instead')} onPress={payWithCardInstead} tk={tk} />
          </View>
        </KeyboardAvoidingView>
      )}

      {phase === 'transfer_review' && btReq && (
        btReq.status === 'rejected' ? (
          <StatusView tone="red" icon={ICONS.AlertTriangle} tk={tk}
            title={t('bt_rejected_title', "We couldn't confirm your transfer")}
            body={(btReq.note ? `${btReq.note}\n\n` : '')
              + t('bt_rejected_body', "If you did send the money, reply to the email we sent you with your transfer receipt and we'll sort it out.")}
          >
            <PrimaryButton label={t('bt_pay_card_instead', 'Pay with card instead')} icon={ICONS.CreditCard} onPress={payWithCardInstead} />
            <LinkButton label={t('bt_try_again', 'Start a new transfer')} onPress={() => { setMethod('transfer'); setBtReq(null); setPhase('checkout'); }} tk={tk} />
          </StatusView>
        ) : (
          <StatusView tone="amber" icon={ICONS.Clock} tk={tk}
            title={t('bt_review_title', "We're confirming your transfer")}
            body={t('bt_review_body', "As soon as we see {amount} from {sender}, Premium switches on — usually within a few hours. We'll email {email}, so you can close the app.")
              .replace('{amount}', formatNaira(btReq.amount_kobo))
              .replace('{sender}', btReq.sender_name || t('bt_you', 'you'))
              .replace('{email}', btReq.email)}
          >
            <View style={[st.miniOrder, { backgroundColor: tk.surface, borderColor: tk.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.miniTitle, { color: tk.textPrimary }]}>{title}</Text>
                <Text style={[st.miniRef, { color: tk.textMuted }]} selectable>
                  {t('bt_narration', 'Narration / description')}: {btReq.code}
                </Text>
              </View>
              <Text style={[st.miniPrice, { color: tk.textPrimary }]}>{formatNaira(btReq.amount_kobo)}</Text>
            </View>
            {!!btMsg && <Text style={[st.btMsg, { color: tk.textSec }]}>{btMsg}</Text>}
            <PrimaryButton
              label={btBusy ? t('pay_checking', 'Checking…') : t('bt_check_status', 'Check status')}
              icon={ICONS.RefreshCw}
              disabled={btBusy}
              onPress={checkTransfer}
            />
            <View style={{ height: 10 }} />
            <SecondaryButton label={t('bt_view_details', 'View transfer details')} icon={ICONS.Landmark} onPress={() => setPhase('transfer')} tk={tk} />
            <LinkButton label={t('bt_pay_card_instead', 'Pay with card instead')} onPress={payWithCardInstead} tk={tk} />
          </StatusView>
        )
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

  // Premium card
  planCard:     { borderRadius: 18, borderWidth: 1.5, padding: 18 },
  planHead:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crown:        { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planTitle:    { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  planSub:      { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  priceRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 16 },
  price:        { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  priceDays:    { fontSize: 13, fontWeight: '700' },
  benefits:     { borderTopWidth: 1, marginTop: 14, paddingTop: 14, gap: 11 },
  benefitRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon:  { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  benefitTxt:   { flex: 1, fontSize: 14, fontWeight: '700' },

  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },

  // Payment method + bank transfer
  methodRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10 },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:     { width: 10, height: 10, borderRadius: 5 },
  btTitle:      { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  btSub:        { fontSize: 13.5, lineHeight: 20, marginTop: 4, marginBottom: 14 },
  btCard:       { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  btRow:        { paddingVertical: 11 },
  btLabel:      { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },
  btValue:      { fontSize: 15, fontWeight: '800', marginTop: 3 },
  btValueBig:   { fontSize: 22, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },
  btShareRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 18, paddingHorizontal: 2 },
  btHint:       { fontSize: 11.5, fontWeight: '600' },
  btShare:      { fontSize: 13, fontWeight: '800' },
  btStep:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  btStepNum:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  btStepNumTxt: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
  btStepTxt:    { flex: 1, fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
  btMsg:        { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 12 },
  infoTxt:      { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },

  // Email
  sectionTitle: { fontSize: 13, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  emailRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  emailTxt:     { fontSize: 14.5, fontWeight: '800' },
  emailSub:     { fontSize: 12, fontWeight: '600', marginTop: 1 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, height: 52 },
  input:        { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  helpTxt:      { fontSize: 12, fontWeight: '600', marginTop: 6, marginLeft: 2 },
  finePrint:    { fontSize: 11.5, lineHeight: 17, marginTop: 16, paddingHorizontal: 2 },

  // Footer
  footer:       { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12 },
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
