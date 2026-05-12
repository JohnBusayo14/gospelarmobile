// screens/DeleteAccountScreen.jsx
// Requires password confirmation before permanently deleting the account.

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
import { ICONS } from '../components/icons';

const API = API_BASE_URL;

export default function DeleteAccountScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const delBtn = usePressScale();

  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focused,  setFocused]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleDelete = () => {
    if (!password) { setError(t('delacc_password_required', 'Please enter your password to confirm.')); return; }
    Alert.alert(
      t('delacc_final_warning_title', '⚠️ Final Warning'),
      t('delacc_final_warning_msg', 'This will permanently delete your account, all quiz scores, and profile data. There is no way to recover this.'),
      [
        { text:t('btn_cancel', 'Cancel'), style:'cancel' },
        { text:t('delacc_delete_forever', 'Delete Forever'), style:'destructive', onPress: doDelete },
      ]
    );
  };

  const doDelete = async () => {
    setLoading(true);
    setError('');
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error(t('delacc_not_logged_in', 'Not logged in.'));
      const res = await fetch(`${API}/api/auth/account`, {
        method:'DELETE', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('delacc_failed', 'Failed to delete account.')); return; }
      await AsyncStorage.multiRemove(['userEmail','userToken','userName','completedLessons']);
      Alert.alert(t('delacc_deleted_title', 'Account Deleted'), t('delacc_deleted_msg', 'Your account has been permanently deleted.'), [
        { text:t('btn_ok', 'OK'), onPress: () => navigation.reset({ index:0, routes:[{ name:'Login' }] }) },
      ]);
    } catch (e) {
      setError(e.message || t('err_network', 'Network error. Please check your connection.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[{ flex:1, backgroundColor: tk.bg }]} edges={['top','bottom']}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={tk.bg} />
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <Animated.ScrollView contentContainerStyle={{ flexGrow:1 }} keyboardShouldPersistTaps="handled"
          style={{ opacity: fade, transform: [{ translateY }] }}>

          {/* Topbar — no border */}
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:14 }}>
            <TouchableOpacity onPress={()=>navigation.goBack()} style={{ width:42, height:42, borderRadius:14, justifyContent:'center', alignItems:'center', backgroundColor: tk.surface }}>
              <Text style={{ fontSize:20, fontWeight:'600', color: tk.textPrimary }}>←</Text>
            </TouchableOpacity>
            <Text style={{ flex:1, textAlign:'center', fontSize:17, fontWeight:'900', color: tk.textPrimary, marginRight:42 }}>{t('delete_account', 'Delete Account')}</Text>
          </View>

          <View style={{ padding:20 }}>
            {/* Warning card */}
            <View style={s.warnCard}>
              <ICONS.AlertTriangle color="#F59E0B" size={28} sw={2} />
              <Text style={s.warnTitle}>{t('delacc_irreversible', 'This action is irreversible')}</Text>
              <Text style={s.warnBody}>
                {t('delacc_remove_intro', 'Deleting your account will permanently remove:')}{'\n\n'}
                {t('delacc_remove_item_1', '• Your account and login credentials')}{'\n'}
                {t('delacc_remove_item_2', '• All quiz scores and progress')}{'\n'}
                {t('delacc_remove_item_3', '• Your profile and preferences')}{'\n'}
                {t('delacc_remove_item_4', '• Your position on the leaderboard')}
              </Text>
            </View>

            {/* Password confirmation */}
            <Text style={[{ fontSize:12, fontWeight:'800', letterSpacing:0.5, color: tk.textSec, marginBottom:8 }]}>
              {t('delacc_confirm_password', 'CONFIRM YOUR PASSWORD')}
            </Text>
            <View style={[s.inputWrap, { backgroundColor: tk.surface, borderColor: error ? '#EF4444' : focused ? '#EF4444' : tk.border }]}>
              <View style={{ marginRight:10 }}>
                <ICONS.Lock color={tk.textMuted} size={17} sw={2} />
              </View>
              <TextInput
                style={[s.input, { color: tk.textPrimary }]}
                placeholder={t('delacc_password_placeholder', 'Enter your password to confirm')}
                placeholderTextColor={tk.textMuted}
                value={password}
                onChangeText={v => { setPassword(v); setError(''); }}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPass(v=>!v)} style={{ padding:4 }}>
                <Text style={{ fontSize:16 }}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {!!error && <Text style={{ fontSize:12, color:'#EF4444', marginTop:6, fontWeight:'600' }}>{error}</Text>}

            {/* Delete button */}
            <Animated.View style={{ marginTop:24, transform:[{ scale: delBtn.scale }] }}>
              <Pressable onPress={handleDelete} disabled={loading}
                onPressIn={delBtn.onPressIn} onPressOut={delBtn.onPressOut}
                style={s.deleteBtn}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.deleteBtnTxt}>{t('delacc_delete_btn', '🗑️  Delete My Account Forever')}</Text>
                }
              </Pressable>
            </Animated.View>

            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={[s.cancelBtn, { borderColor: tk.border }]}>
              <Text style={[s.cancelBtnTxt, { color: tk.textPrimary }]}>{t('delacc_keep_account', 'Cancel — Keep My Account')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  warnCard:    { backgroundColor:'#FEF2F2', borderRadius:20, borderWidth:1, borderColor:'#FECACA', padding:20, marginBottom:28 },
  warnEmoji:   { fontSize:36, textAlign:'center', marginBottom:12 },
  warnTitle:   { fontSize:17, fontWeight:'900', color:'#DC2626', textAlign:'center', marginBottom:12 },
  warnBody:    { fontSize:14, lineHeight:22, color:'#7F1D1D' },
  inputWrap:   { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1.5, paddingHorizontal:14, paddingVertical:13, marginBottom:4 },
  input:       { flex:1, fontSize:15, fontWeight:'500', padding:0 },
  deleteBtn:   { backgroundColor:'#DC2626', borderRadius:16, paddingVertical:17, alignItems:'center' },
  deleteBtnTxt:{ color:'#fff', fontSize:15, fontWeight:'900' },
  cancelBtn:   { borderRadius:14, borderWidth:1.5, paddingVertical:14, alignItems:'center', marginTop:12 },
  cancelBtnTxt:{ fontSize:14, fontWeight:'700' },
});