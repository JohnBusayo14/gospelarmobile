// screen/ForgotPasswordScreen.jsx
// Self-service password reset (backend: routes/passwordReset.js).
//   1. email   → POST /api/auth/forgot-password          (emails a 6-digit code)
//   2. code    → POST /api/auth/forgot-password/verify   (returns a one-time token)
//   3. password→ POST /api/auth/forgot-password/reset    (sets the new password)
// The server answers the same way whether or not the email has an account, so
// step 2 is where a wrong address simply never gets a valid code.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getTokens, type, space, radii } from '../theme/tokens';
import { ICONS } from '../components/icons';
import { API_BASE_URL } from '../services/api';
import { ft } from '../data/forgotPasswordStrings';

const ACCENT = '#2563EB';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// JSON POST with a timeout. Never throws: { ok, status, data } (status 0 = offline).
async function post(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch { return { ok: false, status: 0, data: {} }; }
  finally { clearTimeout(timer); }
}

export default function ForgotPasswordScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const { lang: appLang } = useLanguage();
  const lang = ['en', 'yo', 'ig', 'ha'].includes(appLang) ? appLang : 'en';
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const T = useCallback((k, v) => ft(lang, k, v), [lang]);

  const [step, setStep] = useState('email');          // email | code | password | done
  const [email, setEmail] = useState(String(route?.params?.email || '').trim());
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);                // seconds until "send again"
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Resend countdown.
  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const failMsg = (r) => {
    if (r.status === 0) return T('fp_network');
    switch (r.data?.reason) {
      case 'wrong_code':   return T('fp_err_wrong', { n: r.data.attempts_left ?? 0 });
      case 'expired':      return step === 'password' ? T('fp_err_reset_expired') : T('fp_err_expired');
      case 'locked':       return T('fp_err_locked');
      case 'rate_limited': return T('fp_err_rate');
      case 'email_failed': return T('fp_err_email');
      case 'invalid_email': return T('fp_invalid_email');
      case 'invalid_code': return T('fp_err_code6');
      case 'weak_password': return T('fp_short');
      default: return T('fp_err_generic');
    }
  };

  const sendCode = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setError(T('fp_invalid_email'));
    setBusy(true); setError('');
    const r = await post('/api/auth/forgot-password', { email: e });
    if (!mounted.current) return;
    setBusy(false);
    if (!r.ok) return setError(failMsg(r));
    setEmail(e); setCode(''); setWait(r.data.resend_after || 60); setStep('code');
  };

  const verify = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length !== 6) return setError(T('fp_err_code6'));
    setBusy(true); setError('');
    const r = await post('/api/auth/forgot-password/verify', { email, code: c });
    if (!mounted.current) return;
    setBusy(false);
    if (!r.ok) return setError(failMsg(r));
    setToken(r.data.reset_token); setStep('password');
  };

  const save = async () => {
    if (pw.length < 8) return setError(T('fp_short'));
    if (pw !== pw2) return setError(T('fp_mismatch'));
    setBusy(true); setError('');
    const r = await post('/api/auth/forgot-password/reset', { reset_token: token, new_password: pw });
    if (!mounted.current) return;
    setBusy(false);
    if (!r.ok) {
      if (r.data?.reason === 'expired') { setStep('email'); setPw(''); setPw2(''); }
      return setError(failMsg(r));
    }
    setStep('done');
  };

  const back = () => {
    if (step === 'code') { setStep('email'); setError(''); return; }
    if (step === 'password') { setStep('code'); setError(''); return; }
    navigation.goBack();
  };

  const input = (props) => (
    <TextInput
      placeholderTextColor={tk.textMuted} autoCorrect={false} autoCapitalize="none"
      style={[s.input, { color: tk.textPrimary, backgroundColor: tk.surface, borderColor: error ? '#EF4444' : tk.border }]}
      {...props}
    />
  );
  const button = (label, onPress, enabled = true) => (
    <TouchableOpacity disabled={!enabled || busy} onPress={onPress} activeOpacity={0.85} accessibilityRole="button"
      style={[s.primary, { backgroundColor: enabled ? ACCENT : tk.surfaceEl }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={[s.primaryTxt, { color: enabled ? '#fff' : tk.textMuted }]}>{label}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.top}>
        {step !== 'done' ? (
          <TouchableOpacity onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[s.iconBtn, { backgroundColor: tk.surface }]}>
            <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
        <Text style={[type.h3, { color: tk.textPrimary, flex: 1, textAlign: 'center' }]}>{T('fp_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
          {step === 'email' && (
            <>
              <Text style={[type.sub, { color: tk.textSec, marginBottom: space.lg }]}>{T('fp_email_sub')}</Text>
              <Text style={[s.label, { color: tk.textSec }]}>{T('fp_email_label')}</Text>
              {input({ value: email, onChangeText: (v) => { setEmail(v); setError(''); }, keyboardType: 'email-address', autoComplete: 'email', textContentType: 'emailAddress', returnKeyType: 'send', onSubmitEditing: sendCode })}
              {!!error && <Text style={s.error}>{error}</Text>}
              {button(T('fp_send'), sendCode, email.trim().length > 3)}
            </>
          )}

          {step === 'code' && (
            <>
              <Text style={[type.h2, { color: tk.textPrimary }]}>{T('fp_code_title')}</Text>
              <Text style={[type.sub, { color: tk.textSec, marginTop: 6 }]}>{T('fp_code_sub', { e: email })}</Text>
              <Text style={[type.caption, { color: tk.textMuted, marginTop: 6, marginBottom: space.lg }]}>{T('fp_spam')}</Text>
              <Text style={[s.label, { color: tk.textSec }]}>{T('fp_code_label')}</Text>
              {input({ value: code, onChangeText: (v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }, keyboardType: 'number-pad', maxLength: 6, autoComplete: 'sms-otp', textContentType: 'oneTimeCode', style: [s.input, s.codeInput, { color: tk.textPrimary, backgroundColor: tk.surface, borderColor: error ? '#EF4444' : tk.border }] })}
              {!!error && <Text style={s.error}>{error}</Text>}
              {button(T('fp_verify'), verify, code.length === 6)}
              <TouchableOpacity disabled={wait > 0 || busy} onPress={sendCode} style={s.link} accessibilityRole="button">
                <Text style={[type.h3, { color: wait > 0 ? tk.textMuted : ACCENT }]}>{wait > 0 ? T('fp_resend_in', { s: wait }) : T('fp_resend')}</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'password' && (
            <>
              <Text style={[type.h2, { color: tk.textPrimary }]}>{T('fp_pw_title')}</Text>
              <Text style={[type.sub, { color: tk.textSec, marginTop: 6, marginBottom: space.lg }]}>{T('fp_pw_sub')}</Text>
              <Text style={[s.label, { color: tk.textSec }]}>{T('fp_new')}</Text>
              {input({ value: pw, onChangeText: (v) => { setPw(v); setError(''); }, secureTextEntry: !showPw, textContentType: 'newPassword', autoComplete: 'new-password' })}
              <Text style={[s.label, { color: tk.textSec, marginTop: space.md }]}>{T('fp_confirm')}</Text>
              {input({ value: pw2, onChangeText: (v) => { setPw2(v); setError(''); }, secureTextEntry: !showPw, textContentType: 'newPassword', returnKeyType: 'done', onSubmitEditing: save })}
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={{ alignSelf: 'flex-end', marginTop: 8 }} accessibilityRole="button">
                <ICONS.Eye color={tk.textMuted} size={20} />
              </TouchableOpacity>
              {!!error && <Text style={s.error}>{error}</Text>}
              {button(T('fp_save'), save, pw.length > 0 && pw2.length > 0)}
            </>
          )}

          {step === 'done' && (
            <View style={{ alignItems: 'center', paddingTop: space['3xl'] }}>
              <Text style={{ fontSize: 64 }}>✅</Text>
              <Text style={[type.h1, { color: tk.textPrimary, marginTop: space.md, textAlign: 'center' }]}>{T('fp_done_title')}</Text>
              <Text style={[type.body, { color: tk.textSec, textAlign: 'center', marginTop: 8, marginBottom: space.xl }]}>{T('fp_done_body')}</Text>
              <View style={{ alignSelf: 'stretch' }}>
                {button(T('fp_signin'), () => navigation.navigate('Login', { email }), true)}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  input: { minHeight: 54, borderRadius: radii.lg, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 16, fontWeight: '600' },
  codeInput: { fontSize: 28, fontWeight: '800', letterSpacing: 10, textAlign: 'center' },
  error: { color: '#EF4444', fontSize: 13, fontWeight: '600', marginTop: 8 },
  primary: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
  primaryTxt: { fontSize: 16, fontWeight: '800' },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
});
