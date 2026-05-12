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
  Animated, StatusBar, ActivityIndicator, Platform, Alert, Image, Pressable,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { API_BASE_URL }   from '../services/api';
import { useTheme }       from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage }     from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { usePressScale } from '../hooks/useFluidAnim';

const { width, height } = Dimensions.get('window');
const API = API_BASE_URL;

const ACCENT = '#2563EB';

// ── InputField ────────────────────────────────────────────────────────────────
const InputField = ({
  icon, placeholder, value, onChangeText, secureTextEntry,
  keyboardType, autoCapitalize, tk, error, onToggleSecure, isSecure,
}) => {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

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
        <Text style={inf.icon}>{icon}</Text>
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
            <Text style={{ fontSize: 16 }}>{isSecure ? '🙈' : '👁️'}</Text>
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
  icon:  { fontSize: 18, marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', padding: 0 },
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

  // ── Entrance animations ───────────────────────────────────────────────────
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;
  const logoScale  = useRef(new Animated.Value(0.7)).current;
  const logoOpacity= useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1,   tension: 80, friction: 8,  useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0,  tension: 60, friction: 10, useNativeDriver: true }),
      ]),
    ]).start();
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
      navigation.reset({ index: 0, routes: [{ name: 'Library' }] });

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
          {/* ── Hero header ────────────────────────────────────────────────── */}
          <LinearGradient
            colors={
              isDark
                ? ['#0F1117', '#1A1D27', '#0F1117']
                : ['#EFF6FF', '#DBEAFE', '#FFFFFF']
            }
            style={s.hero}
          >
            <Animated.View
              style={[
                s.logoCircle,
                {
                  backgroundColor: isDark ? '#1A1D27' : '#fff',
                  borderColor:     isDark ? '#2A2D3A' : ACCENT + '30',
                  transform:       [{ scale: logoScale }],
                  opacity:         logoOpacity,
                },
              ]}
            >
              <Image
                source={require('../assets/image2.png')}
                style={s.logoImg}
                resizeMode="contain"
              />
            </Animated.View>

            <Text style={[s.appName, { color: isDark ? '#F9FAFB' : '#111827' }]}>
              Gospelar
            </Text>
            <Text style={[s.appSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('login_sunday_school', 'Sunday School')}
            </Text>

            <View style={[s.heroDivider, { backgroundColor: ACCENT }]} />

            <Text style={[s.heroTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
              {t('login_welcome_back', 'Welcome back')}
            </Text>
            <Text style={[s.heroSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('login_welcome_sub', 'Sign in to continue your learning journey')}
            </Text>
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

              {/* Form-level error banner */}
              {!!errors.form && (
                <View style={s.formError}>
                  <Text style={s.formErrorTxt}>⚠  {errors.form}</Text>
                </View>
              )}

              <InputField
                icon="✉️"
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
                icon="🔒"
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
    alignItems: 'center',
    paddingTop: 40, paddingBottom: 36, paddingHorizontal: 24,
  },
  logoCircle:  {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  logoImg:     { width: 60, height: 60 },
  appName:     { fontSize: 28, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
  appSub:      { fontSize: 14, fontWeight: '600', letterSpacing: 0.5, marginBottom: 20 },
  heroDivider: { width: 40, height: 3, borderRadius: 2, marginBottom: 20 },
  heroTitle:   { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  heroSub:     { fontSize: 14, textAlign: 'center', lineHeight: 21 },
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