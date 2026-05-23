// screens/LoginScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Login with email + password. Saves userEmail + userToken to AsyncStorage.
// Single-session enforcement: if account is already active on another device,
// prompts user to force-logout that device before continuing.
// On success → navigates to HomeScreen (everyone — teachers reach the
// Teacher Dashboard from in-app navigation rather than as a default landing).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Dimensions,
  Animated, StatusBar, ActivityIndicator, Platform, Alert, Pressable,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import LottieView         from 'lottie-react-native';
import { API_BASE_URL }   from '../services/api';
import { useTheme }       from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage }     from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { usePressScale } from '../hooks/useFluidAnim';
import { ICONS }      from '../components/icons';

const { width, height } = Dimensions.get('window');
const API = API_BASE_URL;

const ACCENT = '#2563EB';

// ── InputField ────────────────────────────────────────────────────────────────
const InputField = ({
  Icon, icon, placeholder, value, onChangeText, secureTextEntry,
  keyboardType, autoCapitalize, tk, error, onToggleSecure, isSecure,
}) => {
  const [focused, setFocused] = useState(false);
  const borderAnim   = useRef(new Animated.Value(0)).current;
  // Hold the in-flight handle so unmount can stop it — otherwise a screen that
  // unmounts mid-focus-transition crashes with "stopTracking of undefined".
  const borderHandle = useRef(null);

  const animateBorder = (toValue) => {
    borderHandle.current?.stop?.();
    borderHandle.current = Animated.timing(borderAnim, { toValue, duration: 180, useNativeDriver: false });
    borderHandle.current.start();
  };
  const handleFocus = () => { setFocused(true);  animateBorder(1); };
  const handleBlur  = () => { setFocused(false); animateBorder(0); };
  useEffect(() => () => { try { borderHandle.current?.stop?.(); } catch { /* already done */ } }, []);

  const borderColor = borderAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [error ? '#EF4444' : tk.border, error ? '#EF4444' : ACCENT],
  });

  return (
    <View style={{ marginBottom: 16 }}>
      <Animated.View style={[
        inf.wrap,
        { backgroundColor: tk.surface, borderColor },
      ]}>
        {Icon
          ? <View style={inf.iconBox}><Icon color={tk.textMuted} size={18} sw={2.25} /></View>
          : <Text style={inf.icon}>{icon}</Text>}
        <TextInput
          style={[inf.input, { color: tk.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={tk.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {isSecure !== undefined && (
          <TouchableOpacity onPress={onToggleSecure} activeOpacity={0.7} style={{ padding: 4 }}>
            {isSecure
              ? <ICONS.EyeOff color={tk.textMuted} size={18} sw={2.25} />
              : <ICONS.Eye    color={tk.textMuted} size={18} sw={2.25} />}
          </TouchableOpacity>
        )}
      </Animated.View>
      {!!error && (
        <Animated.Text style={inf.error}>{error}</Animated.Text>
      )}
    </View>
  );
};

const inf = StyleSheet.create({
  wrap:  {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  icon:    { fontSize: 18, marginRight: 10 },
  iconBox: { marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  input:   { flex: 1, fontSize: 15, fontWeight: '500', padding: 0 },
  error: { fontSize: 12, color: '#EF4444', marginTop: 5, marginLeft: 4, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { isDark }  = useTheme();
  const { recheck } = useSubscription();
  const { t }       = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const signInBtn = usePressScale();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});
  // Approval-state banner (teachers awaiting / declined by their church
  // admin). Distinct from errors.form so it persists when the user re-types
  // their password — they need to keep seeing why they can't sign in yet.
  // Shape: { kind: 'pending' | 'rejected', title, message } | null
  const [statusBanner, setStatusBanner] = useState(null);

  // ── Entrance animations ───────────────────────────────────────────────────
  // Hold the parallel handle so unmount can stop it. Logging in inside the
  // 500ms window (or any unmount mid-entry) would otherwise crash with
  // "Cannot read property 'stopTracking' of undefined" when the native
  // animator finalises an Animated.Value whose owning component is gone.
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    const handle = Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0,  tension: 60, friction: 10, useNativeDriver: true }),
    ]);
    handle.start();
    return () => { try { handle.stop(); } catch { /* already done */ } };
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!email.trim())                     e.email    = t('login_email_required', 'Email is required.');
    else if (!/\S+@\S+\.\S+/.test(email))  e.email    = t('login_email_invalid', 'Enter a valid email.');
    if (!password)                          e.password = t('login_password_required', 'Password is required.');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Login handler ─────────────────────────────────────────────────────────
  // force=false  → normal login attempt
  // force=true   → user confirmed they want to kick the other device
  const handleLogin = async (force = false) => {
    if (!force && !validate()) return;
    setLoading(true);
    setErrors({});
    setStatusBanner(null);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          force,
        }),
      });

      const data = await res.json();

      // ── Another device is already logged in ──────────────────────────────
      if (res.status === 409 && data.error === 'already_logged_in') {
        setLoading(false);
        Alert.alert(
          t('login_already_in_title', '⚠️ Already Logged In'),
          t('login_already_in_msg', 'This account is currently active on another device.\n\nContinuing will immediately log that device out.'),
          [
            {
              text:  t('btn_cancel', 'Cancel'),
              style: 'cancel',
            },
            {
              text:    t('login_logout_other', 'Log Out Other Device'),
              style:   'destructive',
              onPress: () => handleLogin(true),   // retry with force flag
            },
          ],
          { cancelable: true }
        );
        return;
      }

      // ── Teacher awaiting approval ────────────────────────────────────────
      // Backend signals this with 403 + { error: 'pending' }. The literal
      // word "pending" is meaningless to a teacher who's just trying to sign
      // in, so render a proper informational banner with what's actually
      // happening and what they should do next.
      if (res.status === 403 && data.error === 'pending') {
        setStatusBanner({
          kind:    'pending',
          title:   t('login_pending_title', 'Waiting for church admin approval'),
          message: data.message ||
            t('login_pending_msg',
              "Thanks for registering as a teacher. Your church admin still needs to review and approve your account before you can sign in. You'll be able to log in here as soon as they do — there's no action needed from you right now."),
        });
        return;
      }

      // ── Teacher application declined ─────────────────────────────────────
      if (res.status === 403 && data.error === 'rejected') {
        setStatusBanner({
          kind:    'rejected',
          title:   t('login_rejected_title', 'Application declined'),
          message: data.message ||
            t('login_rejected_msg',
              'Your church admin has declined your teacher account application. Please contact your church admin directly to resolve this — they can re-enable your account or let you know what needs to change.'),
        });
        return;
      }

      // ── Other server-side errors ─────────────────────────────────────────
      if (!res.ok) {
        setErrors({ form: data.error || t('login_failed', 'Login failed. Please try again.') });
        return;
      }

      // ── Success — persist session ─────────────────────────────────────────
      await AsyncStorage.multiSet([
        ['userEmail', data.user.email],
        ['userToken', data.token],
        ['userName',  data.user.full_name || ''],
        ['userRole',  data.user.role      || 'student'],
        ['isSubscribed', JSON.stringify(data.subscription?.is_active || false)],
      ]);

      // Force an immediate context refresh so SubscriptionGuard has fresh state
      if (recheck) await recheck();

      // Everyone — students and teachers — lands on Library after sign-in,
      // matching the cold-start path in SplashScreen. Tapping a locked book
      // routes them to PaymentScreen with a back arrow back to Library, so
      // a brand-new user never gets stuck on the paywall before seeing what
      // the app offers.
      //
      // Defer one frame so the sign-in button's Pressability finishes its
      // press cycle before this screen unmounts — synchronous nav here was
      // the source of the "stopTracking of undefined" crash after login.
      requestAnimationFrame(() =>
        navigation.reset({ index: 0, routes: [{ name: 'Library' }] })
      );

    } catch (e) {
      console.error('[Login]', e.message);
      setErrors({ form: t('err_network', 'Network error. Please check your connection.') });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={tk.bg}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero (Lottie) ──────────────────────────────────────────────── */}
          <LinearGradient
            colors={
              isDark
                ? ['#0F1117', '#1A1D27', '#0F1117']
                : ['#EFF6FF', '#DBEAFE', '#FFFFFF']
            }
            style={s.hero}
          >
            <LottieView
              source={require('../assets/lottie/Unlocked.json')}
              autoPlay
              loop
              style={s.lottie}
            />
          </LinearGradient>

          {/* ── Form card ──────────────────────────────────────────────────── */}
          <Animated.View
            style={[
              s.formWrap,
              {
                opacity:   fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={[s.card, { backgroundColor: tk.bg, borderColor: tk.border }]}>

              {/* Teacher approval-state banner — distinct from the red error
                  banner so a "waiting for approval" message reads as info,
                  not as a problem the user can fix by re-typing. */}
              {!!statusBanner && (
                <View style={[
                  s.statusBanner,
                  statusBanner.kind === 'rejected' ? s.statusBannerRejected : s.statusBannerPending,
                ]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {statusBanner.kind === 'rejected'
                      ? <ICONS.AlertCircle color="#B91C1C" size={18} sw={2.25} />
                      : <ICONS.Hourglass   color="#92400E" size={18} sw={2.25} />}
                    <Text style={[
                      s.statusTitle,
                      { color: statusBanner.kind === 'rejected' ? '#991B1B' : '#92400E' },
                    ]}>
                      {statusBanner.title}
                    </Text>
                  </View>
                  <Text style={[
                    s.statusBody,
                    { color: statusBanner.kind === 'rejected' ? '#7F1D1D' : '#78350F' },
                  ]}>
                    {statusBanner.message}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setStatusBanner(null)}
                    style={{ alignSelf: 'flex-start', marginTop: 10 }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.statusDismiss, { color: statusBanner.kind === 'rejected' ? '#B91C1C' : '#B45309' }]}>
                      {t('btn_dismiss', 'Dismiss')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Form-level error banner */}
              {!!errors.form && (
                <View style={[s.formError, { flexDirection:'row', alignItems:'center', gap:8 }]}>
                  <ICONS.AlertTriangle color="#EF4444" size={16} sw={2.25} />
                  <Text style={s.formErrorTxt}>{errors.form}</Text>
                </View>
              )}

              <InputField
                Icon={ICONS.Mail}
                placeholder={t('login_email_placeholder', 'Email address')}
                value={email}
                onChangeText={v => {
                  setEmail(v);
                  setErrors(e => ({ ...e, email: null, form: null }));
                }}
                keyboardType="email-address"
                tk={tk}
                error={errors.email}
              />

              <InputField
                Icon={ICONS.Lock}
                placeholder={t('login_password_placeholder', 'Password')}
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  setErrors(e => ({ ...e, password: null, form: null }));
                }}
                secureTextEntry={!showPass}
                tk={tk}
                error={errors.password}
                isSecure={!showPass}
                onToggleSecure={() => setShowPass(v => !v)}
              />

              {/* Forgot password */}
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    t('login_reset_title', 'Reset Password'),
                    t('login_reset_msg', 'Contact your administrator to reset your password.')
                  )
                }
                activeOpacity={0.7}
                style={{ alignSelf: 'flex-end', marginBottom: 20, marginTop: -8 }}
              >
                <Text style={[s.forgotTxt, { color: ACCENT }]}>{t('login_forgot', 'Forgot password?')}</Text>
              </TouchableOpacity>

              {/* Login button */}
              <Animated.View style={{ transform:[{ scale: signInBtn.scale }] }}>
                <Pressable
                  onPress={() => handleLogin(false)}
                  onPressIn={signInBtn.onPressIn}
                  onPressOut={signInBtn.onPressOut}
                  disabled={loading}
                  style={s.btnWrap}
                >
                  <LinearGradient
                    colors={[ACCENT, '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.btn}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.btnTxt}>{t('login_signin_btn', 'Sign In  →')}</Text>
                    }
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              {/* Divider */}
              <View style={s.divRow}>
                <View style={[s.div, { backgroundColor: tk.border }]} />
                <Text style={[s.divTxt, { color: tk.textMuted }]}>{t('login_or', 'or')}</Text>
                <View style={[s.div, { backgroundColor: tk.border }]} />
              </View>

              {/* Register link */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                activeOpacity={0.8}
                style={[s.secBtn, { borderColor: tk.border }]}
              >
                <Text style={[s.secBtnTxt, { color: tk.textPrimary }]}>
                  {t('login_create_account', 'Create an account')}{'  '}
                  <Text style={{ color: ACCENT, fontWeight: '800' }}>{t('login_register', 'Register')}</Text>
                </Text>
              </TouchableOpacity>

            </View>
          </Animated.View>

          <Text style={[s.footer, { color: tk.textMuted }]}>
            {t('login_footer', '© Gospelar Sunday School Department')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1 },
  hero:        {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 16, paddingBottom: 8, paddingHorizontal: 24,
  },
  lottie:      { width: width * 0.7, height: width * 0.7 },
  formWrap:    { paddingHorizontal: 20, paddingBottom: 16 },
  card:        {
    borderRadius: 24, borderWidth: 1, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  formError:   {
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#FECACA',
  },
  formErrorTxt:{ fontSize: 13.5, color: '#DC2626', fontWeight: '600' },
  statusBanner:         { borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1 },
  statusBannerPending:  { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  statusBannerRejected: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  statusTitle:          { fontSize: 14, fontWeight: '800', letterSpacing: -0.1, flex: 1 },
  statusBody:           { fontSize: 13, fontWeight: '500', lineHeight: 19 },
  statusDismiss:        { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  forgotTxt:   { fontSize: 13, fontWeight: '700' },
  btnWrap:     { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  btn:         { paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  btnTxt:      { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  divRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  div:         { flex: 1, height: 1 },
  divTxt:      { fontSize: 13, marginHorizontal: 12, fontWeight: '600' },
  secBtn:      { borderRadius: 14, borderWidth: 1.5, paddingVertical: 15, alignItems: 'center' },
  secBtnTxt:   { fontSize: 14, fontWeight: '600' },
  footer:      { textAlign: 'center', fontSize: 11, paddingVertical: 20 },
});