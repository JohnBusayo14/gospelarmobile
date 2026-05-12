// screens/ChangePasswordScreen.jsx
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, StatusBar,
  ActivityIndicator, Platform, Alert, Animated, Pressable,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { API_BASE_URL }   from '../services/api';
import { useTheme }       from '../context/ThemeContext';
import { useLanguage }    from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { useScreenEntry, usePressScale } from '../hooks/useFluidAnim';

const API    = API_BASE_URL;
const ACCENT = '#2563EB';

const Field = ({ label, placeholder, value, onChangeText, secure, tk, error }) => {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom:16 }}>
      <Text style={[f.label, { color: tk.textSec }]}>{label}</Text>
      <View style={[f.wrap, { backgroundColor:tk.surface, borderColor: error ? '#EF4444' : focused ? ACCENT : tk.border }]}>
        <TextInput
          style={[f.input, { color: tk.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={tk.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !show}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow(v=>!v)} activeOpacity={0.7} style={{padding:4}}>
            <Text style={{fontSize:16}}>{show ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={f.error}>{error}</Text>}
    </View>
  );
};
const f = StyleSheet.create({
  label: { fontSize:12, fontWeight:'700', letterSpacing:0.5, marginBottom:8 },
  wrap:  { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1.5, paddingHorizontal:14, paddingVertical:13 },
  input: { flex:1, fontSize:15, fontWeight:'500', padding:0 },
  error: { fontSize:12, color:'#EF4444', marginTop:5, marginLeft:4, fontWeight:'600' },
});

export default function ChangePasswordScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const updBtn = usePressScale();
  const [current, setCurrent]   = useState('');
  const [next,    setNext]      = useState('');
  const [confirm, setConfirm]   = useState('');
  const [errors,  setErrors]    = useState({});
  const [loading, setLoading]   = useState(false);

  const validate = () => {
    const e = {};
    if (!current)          e.current = t('chpw_current_required', 'Enter your current password.');
    if (!next)             e.next    = t('chpw_new_required', 'Enter a new password.');
    else if (next.length < 6) e.next = t('chpw_new_min', 'Must be at least 6 characters.');
    if (!confirm)          e.confirm = t('chpw_confirm_required', 'Confirm your new password.');
    else if (confirm !== next) e.confirm = t('register_password_mismatch', 'Passwords do not match.');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      const res = await fetch(`${API}/api/auth/change-password`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, current_password: current, new_password: next }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors({ form: data.error || t('chpw_failed', 'Failed.') }); return; }
      Alert.alert(t('chpw_changed_title', '✅ Password Changed'), t('chpw_changed_msg', 'Your password has been updated successfully.'), [
        { text:t('btn_ok', 'OK'), onPress: () => navigation.goBack() },
      ]);
    } catch {
      setErrors({ form: t('err_network', 'Network error. Please check your connection.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[{flex:1, backgroundColor:tk.bg}]} edges={['top','bottom']}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={tk.bg} />
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <Animated.ScrollView contentContainerStyle={{flexGrow:1}} keyboardShouldPersistTaps="handled"
          style={{ opacity: fade, transform: [{ translateY }] }}>
          {/* Topbar */}
          <View style={[{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1,borderBottomColor:tk.border}]}>
            <TouchableOpacity onPress={()=>navigation.goBack()} style={[{width:42,height:42,borderRadius:14,justifyContent:'center',alignItems:'center',backgroundColor:tk.surface}]}>
              <Text style={{fontSize:20,fontWeight:'600',color:tk.textPrimary}}>←</Text>
            </TouchableOpacity>
            <Text style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'900',color:tk.textPrimary,marginRight:42}}>{t('change_password', 'Change Password')}</Text>
          </View>

          <View style={{padding:20}}>
            {!!errors.form && (
              <View style={{backgroundColor:'#FEF2F2',borderRadius:12,padding:12,marginBottom:16,borderWidth:1,borderColor:'#FECACA'}}>
                <Text style={{fontSize:13.5,color:'#DC2626',fontWeight:'600'}}>⚠  {errors.form}</Text>
              </View>
            )}

            {/* Info card */}
            <View style={{backgroundColor:ACCENT+'10',borderRadius:16,padding:16,marginBottom:24,borderWidth:1,borderColor:ACCENT+'25'}}>
              <Text style={{fontSize:13,fontWeight:'600',color:ACCENT,lineHeight:20}}>
                {t('chpw_info_card', '🔐  For your security, enter your current password first before setting a new one.')}
              </Text>
            </View>

            <Field label={t('chpw_current_label', 'CURRENT PASSWORD')}  placeholder={t('chpw_current_placeholder', 'Enter current password')}  value={current} onChangeText={v=>{setCurrent(v);setErrors(e=>({...e,current:null,form:null}))}} secure tk={tk} error={errors.current} />
            <Field label={t('chpw_new_label', 'NEW PASSWORD')}           placeholder={t('register_password_placeholder', 'Min. 6 characters')}       value={next}    onChangeText={v=>{setNext(v);setErrors(e=>({...e,next:null}))}}             secure tk={tk} error={errors.next} />
            <Field label={t('chpw_confirm_label', 'CONFIRM PASSWORD')}   placeholder={t('chpw_confirm_placeholder', 'Re-enter new password')}   value={confirm} onChangeText={v=>{setConfirm(v);setErrors(e=>({...e,confirm:null}))}}      secure tk={tk} error={errors.confirm} />

            <Animated.View style={{ marginTop:8, transform:[{ scale: updBtn.scale }] }}>
              <Pressable onPress={handleChange} disabled={loading}
                onPressIn={updBtn.onPressIn} onPressOut={updBtn.onPressOut}
                style={{borderRadius:16,overflow:'hidden'}}>
                <LinearGradient colors={[ACCENT,'#1D4ED8']} start={{x:0,y:0}} end={{x:1,y:0}} style={{paddingVertical:17,alignItems:'center'}}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{color:'#fff',fontSize:16,fontWeight:'900',letterSpacing:0.3}}>{t('chpw_update_btn', 'Update Password  →')}</Text>
                  }
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}