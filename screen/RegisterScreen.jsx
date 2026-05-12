// screens/RegisterScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Register with full name, email, password, confirm password.
// On success → saves session → navigates to HomeScreen.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Dimensions,
  Animated, StatusBar, ActivityIndicator, Platform, Image, Pressable
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { API_BASE_URL }   from '../services/api';
import { useTheme }       from '../context/ThemeContext';
import { useLanguage }    from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { usePressScale } from '../hooks/useFluidAnim';

const { width } = Dimensions.get('window');
const API    = API_BASE_URL;
const ACCENT = '#2563EB';

// ── InputField ────────────────────────────────────────────────────────────────
const InputField = ({ icon, label, placeholder, value, onChangeText, secure,
  keyboardType, autoCapitalize, tk, error, rightElement }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      {!!label && <Text style={[inf.label, { color: tk.textSec }]}>{label}</Text>}
      <View style={[
        inf.wrap,
        { backgroundColor: tk.surface, borderColor: error ? '#EF4444' : focused ? ACCENT : tk.border },
      ]}>
        <Text style={inf.icon}>{icon}</Text>
        <TextInput
          style={[inf.input, { color: tk.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={tk.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!!secure}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={()  => setFocused(false)}
        />
        {rightElement}
      </View>
      {!!error && <Text style={inf.error}>{error}</Text>}
    </View>
  );
};
const inf = StyleSheet.create({
  label: { fontSize:12, fontWeight:'700', letterSpacing:0.5, marginBottom:8 },
  wrap:  { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1.5, paddingHorizontal:14, paddingVertical:13 },
  icon:  { fontSize:17, marginRight:10 },
  input: { flex:1, fontSize:15, fontWeight:'500', padding:0 },
  error: { fontSize:12, color:'#EF4444', marginTop:5, marginLeft:4, fontWeight:'600' },
});

// ── Password strength bar ─────────────────────────────────────────────────────
const StrengthBar = ({ password, t }) => {
  const checks = [
    password.length >= 6,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const labels   = ['', t('register_pw_weak', 'Weak'), t('register_pw_fair', 'Fair'), t('register_pw_good', 'Good'), t('register_pw_strong', 'Strong')];
  const colors   = ['#E5E7EB', '#EF4444', '#F59E0B', '#10B981', '#2563EB'];
  if (!password) return null;
  return (
    <View style={{ marginTop:-8, marginBottom:12 }}>
      <View style={{ flexDirection:'row', marginBottom:4 }}>
        {[1,2,3,4].map(i => (
          <View key={i} style={[sb.seg, { backgroundColor: i <= strength ? colors[strength] : '#E5E7EB' }]} />
        ))}
      </View>
      <Text style={[sb.lbl, { color: colors[strength] }]}>{labels[strength]}</Text>
    </View>
  );
};
const sb = StyleSheet.create({
  seg: { flex:1, height:4, borderRadius:2, marginRight:4 },
  lbl: { fontSize:11, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const regBtn = usePressScale();

  const [role,       setRole]       = useState('student');  // 'student' | 'teacher'
  const [fullName,   setFullName]   = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [errors,     setErrors]     = useState({});
  const [churchCode, setChurchCode] = useState('');     // teachers only
  const [churchName, setChurchName] = useState('');     // resolved from code lookup
  const [churchChecking, setChurchChecking] = useState(false);

  // Entrance animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:600, useNativeDriver:false }),
      Animated.timing(slideAnim, { toValue:0, duration:500, useNativeDriver:false }),
    ]).start();
  }, []);

  const validate = () => {
    const e = {};
    if (!fullName.trim())           e.fullName = t('register_name_required', 'Full name is required.');
    if (!email.trim())              e.email    = t('login_email_required', 'Email is required.');
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('login_email_invalid', 'Enter a valid email.');
    if (!password)                  e.password = t('login_password_required', 'Password is required.');
    else if (password.length < 6)   e.password = t('register_password_min', 'Password must be at least 6 characters.');
    if (!confirm)                   e.confirm  = t('register_confirm_required', 'Please confirm your password.');
    else if (confirm !== password)  e.confirm  = t('register_password_mismatch', 'Passwords do not match.');
    if (role === 'teacher') {
      if (!churchCode.trim())          e.churchCode = t('register_church_code_required', 'Church invite code is required for teachers.');
      else if (!churchName)            e.churchCode = t('register_church_code_invalid', 'Enter a valid church code, then wait for it to verify.');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Live-look-up the church name when the teacher pastes a code. Debounced
  // by checking after a short pause; gives them instant feedback that the
  // code is valid (and shows the church name) before they submit.
  useEffect(() => {
    if (role !== 'teacher') return;
    const code = churchCode.trim().toUpperCase();
    if (code.length < 4) { setChurchName(''); return; }
    const handle = setTimeout(async () => {
      setChurchChecking(true);
      try {
        const r = await fetch(`${API}/api/church/by-code/${encodeURIComponent(code)}`);
        if (!r.ok) { setChurchName(''); return; }
        const d = await r.json();
        setChurchName(d.name || '');
      } catch { setChurchName(''); }
      finally { setChurchChecking(false); }
    }, 400);
    return () => clearTimeout(handle);
  }, [churchCode, role]);

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:       email.trim().toLowerCase(),
          password,
          full_name:   fullName.trim(),
          role,
          church_code: role === 'teacher' ? churchCode.trim().toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ form: data.error || t('register_failed', 'Registration failed.') });
        return;
      }
      // Persist session
      await AsyncStorage.multiSet([
        ['userEmail', data.user.email],
        ['userToken', data.token],
        ['userName',  data.user.full_name || ''],
        ['userRole',  data.user.role || 'student'],
      ]);
      // Everyone — students and teachers — lands on Library after sign-up.
      // From there, tapping a locked book opens PaymentScreen (with a back
      // arrow back to Library), and tapping an unlocked book opens it.
      navigation.reset({ index: 0, routes: [{ name: 'Library' }] });
    } catch (e) {
      setErrors({ form: t('err_network', 'Network error. Please check your connection.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top','bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow:1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <LinearGradient
            colors={isDark ? ['#0F1117','#1A1D27','#0F1117'] : ['#ECFDF5','#D1FAE5','#FFFFFF']}
            style={s.hero}
          >
            <View style={[s.logoCircle, { backgroundColor: isDark ? '#1A1D27' : '#fff', borderColor: isDark ? '#2A2D3A' : '#10B98130' }]}>
              <Image
                source={require('../assets/image2.png')}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={[s.appName, { color: isDark ? '#F9FAFB' : '#111827' }]}>Gospelar</Text>
            <Text style={[s.appSub,  { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('login_sunday_school', 'Sunday School')}</Text>
            <View style={[s.heroDivider, { backgroundColor: '#10B981' }]} />
            <Text style={[s.heroTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>{t('register_title', 'Create account')}</Text>
            <Text style={[s.heroSub,   { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('register_sub', "Join thousands learning God's word daily")}
            </Text>
          </LinearGradient>

          {/* ── Form ── */}
          <Animated.View style={[s.formWrap, { opacity: fadeAnim, transform:[{translateY:slideAnim}] }]}>
            <View style={[s.card, { backgroundColor: tk.bg, borderColor: tk.border }]}>

              {/* Form error */}
              {!!errors.form && (
                <View style={s.formError}>
                  <Text style={s.formErrorTxt}>⚠  {errors.form}</Text>
                </View>
              )}

              {/* Role selector */}
              <Text style={{ fontSize:11, fontWeight:'800', letterSpacing:1.5, color:tk.textMuted, marginBottom:10 }}>{t('register_i_am_a', 'I AM A')}</Text>
              <View style={{ flexDirection:'row', marginBottom:20, gap:10 }}>
                {[{key:'student',icon:'🎓',label:t('register_role_student','Student')},{key:'teacher',icon:'📋',label:t('register_role_teacher','Teacher')}].map(r => (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setRole(r.key)}
                    activeOpacity={0.8}
                    style={{
                      flex:1, borderRadius:14, borderWidth:2, paddingVertical:14, alignItems:'center',
                      backgroundColor: role===r.key ? ACCENT+'15' : tk.surface,
                      borderColor: role===r.key ? ACCENT : tk.border,
                    }}
                  >
                    <Text style={{ fontSize:22, marginBottom:4 }}>{r.icon}</Text>
                    <Text style={{ fontSize:13, fontWeight:'800', letterSpacing:0.5, textTransform:'uppercase',
                      color: role===r.key ? ACCENT : tk.textSec }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <InputField
                icon="👤"
                label={t('register_name_label', 'Full Name')}
                placeholder={t('register_name_placeholder', 'Your full name')}
                value={fullName}
                onChangeText={v => { setFullName(v); setErrors(e => ({...e, fullName:null, form:null})); }}
                autoCapitalize="words"
                tk={tk}
                error={errors.fullName}
              />
              {/* Teachers must register with a church invite code so all
                  data flows to the right church admin. Live-validates the
                  code and shows the church name as confirmation. */}
              {role === 'teacher' && (
                <>
                  <InputField
                    icon="⛪"
                    label={t('register_church_code_label', 'Church Invite Code')}
                    placeholder="e.g. CRX42PHM"
                    value={churchCode}
                    onChangeText={v => {
                      setChurchCode(v.toUpperCase());
                      setErrors(e => ({ ...e, churchCode: null, form: null }));
                    }}
                    autoCapitalize="characters"
                    tk={tk}
                    error={errors.churchCode}
                  />
                  {/* Live confirmation row — shows what we matched */}
                  {!!churchCode.trim() && (
                    <View style={{
                      marginTop: -8, marginBottom: 16, paddingHorizontal: 12, paddingVertical: 8,
                      borderRadius: 10, borderWidth: 1,
                      backgroundColor: churchName ? '#10B98114' : '#EF444414',
                      borderColor:     churchName ? '#10B98140' : '#EF444440',
                    }}>
                      <Text style={{
                        fontSize: 12, fontWeight: '700',
                        color: churchName ? '#10B981' : '#EF4444',
                      }}>
                        {churchChecking ? '⌛  Checking…'
                          : churchName    ? `✓  Linked to ${churchName}`
                          :                 '✗  Unknown church code — ask your church admin'}
                      </Text>
                    </View>
                  )}
                </>
              )}
              <InputField
                icon="✉️"
                label={t('register_email_label', 'Email Address')}
                placeholder={t('register_email_placeholder', 'you@example.com')}
                value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({...e, email:null, form:null})); }}
                keyboardType="email-address"
                tk={tk}
                error={errors.email}
              />
              <InputField
                icon="🔒"
                label={t('register_password_label', 'Password')}
                placeholder={t('register_password_placeholder', 'Min. 6 characters')}
                value={password}
                onChangeText={v => { setPassword(v); setErrors(e => ({...e, password:null, form:null})); }}
                secure={!showPass}
                tk={tk}
                error={errors.password}
                rightElement={
                  <TouchableOpacity onPress={() => setShowPass(v=>!v)} activeOpacity={0.7} style={{ padding:4 }}>
                    <Text style={{ fontSize:16 }}>{showPass ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                }
              />
              <StrengthBar password={password} t={t} />

              <InputField
                icon="✅"
                label={t('register_confirm_label', 'Confirm Password')}
                placeholder={t('register_confirm_placeholder', 'Re-enter password')}
                value={confirm}
                onChangeText={v => { setConfirm(v); setErrors(e => ({...e, confirm:null})); }}
                secure={!showConf}
                tk={tk}
                error={errors.confirm}
                rightElement={
                  <TouchableOpacity onPress={() => setShowConf(v=>!v)} activeOpacity={0.7} style={{ padding:4 }}>
                    <Text style={{ fontSize:16 }}>{showConf ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                }
              />

              {/* Register button */}
              <Animated.View style={{ transform:[{ scale: regBtn.scale }] }}>
                <Pressable onPress={handleRegister} disabled={loading}
                  onPressIn={regBtn.onPressIn} onPressOut={regBtn.onPressOut}
                  style={s.btnWrap}>
                  <LinearGradient colors={['#10B981','#059669']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btn}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.btnTxt}>{t('register_btn', 'Create Account  →')}</Text>
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

              {/* Login link */}
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.8} style={[s.secBtn, { borderColor: tk.border }]}>
                <Text style={[s.secBtnTxt, { color: tk.textPrimary }]}>
                  {t('register_have_account', 'Already have an account?')}  <Text style={{ color: ACCENT, fontWeight:'800' }}>{t('login_signin', 'Sign In')}</Text>
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

const s = StyleSheet.create({
  safe:        { flex:1 },
  hero:        { alignItems:'center', paddingTop:36, paddingBottom:28, paddingHorizontal:24 },
  logoCircle:  { width:90, height:90, borderRadius:45, justifyContent:'center', alignItems:'center', marginBottom:14, borderWidth:2, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.12, shadowRadius:12, elevation:6 },
  logoImg:     { width:60, height:60 },
  appName:     { fontSize:26, fontWeight:'900', letterSpacing:2, marginBottom:2 },
  appSub:      { fontSize:13, fontWeight:'600', letterSpacing:0.5, marginBottom:16 },
  heroDivider: { width:40, height:3, borderRadius:2, marginBottom:16 },
  heroTitle:   { fontSize:24, fontWeight:'900', letterSpacing:-0.5, marginBottom:6 },
  heroSub:     { fontSize:13.5, textAlign:'center', lineHeight:20 },
  formWrap:    { paddingHorizontal:20, paddingBottom:16 },
  card:        { borderRadius:24, borderWidth:1, padding:24, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:12, elevation:3 },
  formError:   { backgroundColor:'#FEF2F2', borderRadius:12, padding:12, marginBottom:16, borderWidth:1, borderColor:'#FECACA' },
  formErrorTxt:{ fontSize:13.5, color:'#DC2626', fontWeight:'600' },
  btnWrap:     { borderRadius:16, overflow:'hidden', marginBottom:16 },
  btn:         { paddingVertical:17, alignItems:'center', justifyContent:'center' },
  btnTxt:      { color:'#fff', fontSize:16, fontWeight:'900', letterSpacing:0.3 },
  divRow:      { flexDirection:'row', alignItems:'center', marginBottom:16 },
  div:         { flex:1, height:1 },
  divTxt:      { fontSize:13, marginHorizontal:12, fontWeight:'600' },
  secBtn:      { borderRadius:14, borderWidth:1.5, paddingVertical:15, alignItems:'center' },
  secBtnTxt:   { fontSize:14, fontWeight:'600' },
  footer:      { textAlign:'center', fontSize:11, paddingVertical:20 },
});