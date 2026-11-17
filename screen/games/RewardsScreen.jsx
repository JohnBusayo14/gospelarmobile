// screen/games/RewardsScreen.jsx
// Redeem XP for vouchers the admin created (backend: routes/rewards.js).
// The server owns prices, stock and the XP balance; this screen only shows
// them and asks to redeem. A voucher code is shown once on success and stays
// under "My vouchers".

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Share, RefreshControl, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens, type, space, radii } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import Confetti from '../../components/games/Confetti';
import { gt } from '../../data/games/strings';
import { fetchRewards, redeemReward, fetchMyVouchers, gameLang } from '../../services/games';

const ACCENT = '#DB2777';

export default function RewardsScreen({ navigation }) {
  const { isDark } = useTheme();
  const { lang: appLang } = useLanguage();
  const lang = gameLang(appLang);
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const T = useCallback((k, v) => gt(lang, k, v), [lang]);

  const [tab, setTab] = useState('rewards');
  const [data, setData] = useState(null);          // { balance, items }
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [won, setWon] = useState(null);            // redemption just made
  const [bankFor, setBankFor] = useState(null);    // cash reward being requested
  const [bank, setBank] = useState({ bank_name: '', account_number: '', account_name: '' });
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const token = await AsyncStorage.getItem('userToken');
    if (!token) { setSignedIn(false); setLoading(false); return; }
    setSignedIn(true);
    try {
      const [d, m] = await Promise.all([fetchRewards(), fetchMyVouchers()]);
      setData(d); setMine(m);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const redeem = (item) => {
    if (item.kind === 'cash') { setBankFor(item); return; }
    Alert.alert(
      T('rw_confirm_title', { t: item.title }),
      T('rw_confirm_body', { n: item.xp_cost }),
      [
        { text: T('rw_cancel'), style: 'cancel' },
        {
          text: T('rw_redeem'),
          onPress: async () => {
            setBusyId(item.id);
            try {
              const r = await redeemReward(item.id);
              setWon(r.redemption);
              await load();
            } catch (e) { Alert.alert(e.message); await load(); }
            setBusyId(null);
          },
        },
      ],
    );
  };

  const submitBank = () => {
    const item = bankFor;
    Alert.alert(T('rw_confirm_title', { t: item.title }), T('rw_confirm_body', { n: item.xp_cost }), [
      { text: T('rw_cancel'), style: 'cancel' },
      { text: T('rw_submit'), onPress: async () => {
        setBusyId(item.id);
        try {
          await redeemReward(item.id, bank);
          setBankFor(null); setSent(true); setBank({ bank_name: '', account_number: '', account_name: '' });
          await load();
        } catch (e) { Alert.alert(e.message); }
        setBusyId(null);
      } },
    ]);
  };

  const shareCode = (c) => Share.share({ message: `${c.title}${c.value_label ? ` (${c.value_label})` : ''}: ${c.code}` }).catch(() => {});

  const header = (
    <View style={s.top}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[s.iconBtn, { backgroundColor: tk.surface }]}>
        <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
      </TouchableOpacity>
      <Text style={[type.h3, { color: tk.textPrimary, flex: 1, textAlign: 'center' }]}>{T('rw_title')}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!signedIn) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>{header}
        <View style={s.center}><Text style={[type.body, { color: tk.textSec, textAlign: 'center', paddingHorizontal: 32 }]}>{T('rw_signin')}</Text></View>
      </SafeAreaView>
    );
  }

  if (sent) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
        {header}
        <View style={s.center}>
          <Text style={{ fontSize: 60 }}>⏳</Text>
          <Text style={[type.h1, { color: ACCENT, marginTop: space.md, textAlign: 'center' }]}>{T('rw_sent')}</Text>
          <Text style={[type.body, { color: tk.textSec, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 }]}>{T('rw_sent_body')}</Text>
          <TouchableOpacity style={[s.primary, { backgroundColor: ACCENT, alignSelf: 'stretch', marginHorizontal: space.xl, marginTop: space.xl }]} onPress={() => { setSent(false); setTab('mine'); }} accessibilityRole="button">
            <Text style={s.primaryTxt}>{T('rw_vouchers')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (bankFor) {
    const field = (key, label, extra = {}) => (
      <View style={{ marginBottom: space.md }}>
        <Text style={[type.caption, { color: tk.textSec, marginBottom: 6 }]}>{label}</Text>
        <TextInput
          value={bank[key]} onChangeText={(v) => setBank((b) => ({ ...b, [key]: v }))}
          placeholderTextColor={tk.textMuted} autoCorrect={false}
          style={[s.input, { color: tk.textPrimary, backgroundColor: tk.surface, borderColor: tk.border }]}
          {...extra}
        />
      </View>
    );
    const ready = bank.bank_name.trim().length > 1 && /^\d{10}$/.test(bank.account_number.replace(/\s+/g, '')) && bank.account_name.trim().length > 2;
    return (
      <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={s.top}>
          <TouchableOpacity onPress={() => setBankFor(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[s.iconBtn, { backgroundColor: tk.surface }]}>
            <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
          </TouchableOpacity>
          <Text style={[type.h3, { color: tk.textPrimary, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{bankFor.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
            <Text style={[type.h2, { color: tk.textPrimary }]}>{T('rw_bank_title')}</Text>
            <Text style={[type.sub, { color: tk.textSec, marginTop: 6, marginBottom: space.lg }]}>{T('rw_bank_hint')}</Text>
            {field('bank_name', T('rw_bank_name'), { autoCapitalize: 'words' })}
            {field('account_number', T('rw_acct_no'), { keyboardType: 'number-pad', maxLength: 12 })}
            {field('account_name', T('rw_acct_name'), { autoCapitalize: 'words' })}
            <TouchableOpacity disabled={!ready || busyId === bankFor.id} onPress={submitBank} accessibilityRole="button"
              style={[s.primary, { backgroundColor: ready ? ACCENT : tk.surfaceEl, marginTop: space.md }]}>
              {busyId === bankFor.id ? <ActivityIndicator color="#fff" /> : <Text style={[s.primaryTxt, { color: ready ? '#fff' : tk.textMuted }]}>{T('rw_submit')} · {bankFor.xp_cost.toLocaleString()} XP</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Voucher just redeemed — show the code.
  if (won) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {header}
        <ScrollView contentContainerStyle={{ padding: space.xl, alignItems: 'center' }}>
          <Text style={{ fontSize: 64, marginTop: space.lg }}>🎁</Text>
          <Text style={[type.h1, { color: ACCENT, marginTop: space.md, textAlign: 'center' }]}>{T('rw_success')}</Text>
          <Text style={[type.h3, { color: tk.textPrimary, marginTop: 6 }]}>{won.title}{won.value_label ? ` · ${won.value_label}` : ''}</Text>
          <View style={[s.codeBox, { backgroundColor: tk.surface, borderColor: ACCENT }]}>
            <Text selectable style={[s.code, { color: tk.textPrimary }]}>{won.code}</Text>
          </View>
          <TouchableOpacity style={[s.primary, { backgroundColor: ACCENT }]} onPress={() => shareCode(won)} accessibilityRole="button">
            <ICONS.Share color="#fff" size={18} /><Text style={s.primaryTxt}>{T('rw_copy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.link} onPress={() => setWon(null)} accessibilityRole="button">
            <Text style={[type.h3, { color: tk.textSec }]}>{T('rw_done')}</Text>
          </TouchableOpacity>
        </ScrollView>
        <Confetti />
      </SafeAreaView>
    );
  }

  const balance = data ? data.balance : 0;
  return (
    <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {header}
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <LinearGradient colors={['#4C1D95', '#BE185D', ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <Text style={s.heroLbl}>{T('rw_balance').toUpperCase()}</Text>
          <Text style={s.heroNum}>{balance.toLocaleString()}</Text>
        </LinearGradient>

        <View style={[s.seg, { backgroundColor: tk.surface }]}>
          {[['rewards', T('rw_rewards')], ['mine', T('rw_vouchers')]].map(([id, label]) => (
            <TouchableOpacity key={id} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} style={[s.segBtn, tab === id && { backgroundColor: ACCENT }]}>
              <Text style={{ color: tab === id ? '#fff' : tk.textSec, fontWeight: '800', fontSize: 13.5 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} /> : !!error ? (
          <Text style={[type.body, { color: '#DC2626', textAlign: 'center', marginTop: 30 }]}>{error}</Text>
        ) : tab === 'rewards' ? (
          !data || !data.items.length ? (
            <Text style={[type.body, { color: tk.textSec, textAlign: 'center', marginTop: 30 }]}>{T('rw_none')}</Text>
          ) : data.items.map((it) => {
            const short = balance < it.xp_cost;
            const off = short || !it.in_stock || it.limit_reached || busyId === it.id;
            return (
              <View key={it.id} style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                <Text style={s.emoji}>{it.emoji || '🎁'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[type.h3, { color: tk.textPrimary }]}>{it.title}</Text>
                  {!!it.value_label && <Text style={[type.caption, { color: ACCENT, marginTop: 2 }]}>{it.kind === 'cash' ? `${T('rw_cash')} · ` : ''}{it.value_label}</Text>}
                  {it.already_redeemed > 0 && <Text style={[type.caption, { color: '#10B981', marginTop: 2 }]}>✓ {T('rw_redeemed_n', { n: it.already_redeemed })}</Text>}
                  {!!it.description && <Text style={[type.sub, { color: tk.textMuted, marginTop: 4 }]} numberOfLines={3}>{it.description}</Text>}
                  <Text style={[type.caption, { color: tk.textSec, marginTop: 6 }]}>
                    {it.xp_cost.toLocaleString()} XP{short && it.in_stock ? ` · ${T('rw_need', { n: (it.xp_cost - balance).toLocaleString() })}` : ''}
                  </Text>
                </View>
                <TouchableOpacity disabled={off} onPress={() => redeem(it)} accessibilityRole="button"
                  style={[s.redeem, { backgroundColor: off ? tk.surfaceEl : ACCENT }]}>
                  {busyId === it.id ? <ActivityIndicator color="#fff" /> : (
                    <Text style={{ color: off ? tk.textMuted : '#fff', fontWeight: '800', fontSize: 13 }}>
                      {!it.in_stock ? T('rw_out') : it.limit_reached ? T('rw_limit') : T('rw_redeem')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : mine.length === 0 ? (
          <Text style={[type.body, { color: tk.textSec, textAlign: 'center', marginTop: 30 }]}>{T('rw_no_vouchers')}</Text>
        ) : mine.map((m) => (
          <View key={m.id} style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border, alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: tk.textPrimary }]}>{m.title}{m.value_label ? ` · ${m.value_label}` : ''}</Text>
              {m.kind === 'cash' ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={{ color: m.status === 'paid' ? '#10B981' : m.status === 'rejected' ? '#DC2626' : '#F59E0B', fontWeight: '800', fontSize: 13.5 }}>
                    {m.status === 'paid' ? T('rw_st_paid') : m.status === 'rejected' ? T('rw_st_rejected') : T('rw_st_pending')}
                  </Text>
                  <Text style={[type.caption, { color: tk.textSec, marginTop: 3 }]}>{m.bank_name} · {m.account_number}</Text>
                  {!!m.paid_ref && <Text style={[type.caption, { color: tk.textSec }]}>{T('rw_ref', { r: m.paid_ref })}</Text>}
                  {!!m.admin_note && <Text style={[type.caption, { color: tk.textSec }]}>{m.admin_note}</Text>}
                </View>
              ) : <Text selectable style={[s.codeSm, { color: tk.textPrimary }]}>{m.code}</Text>}
              <Text style={[type.caption, { color: tk.textMuted, marginTop: 4 }]}>{new Date(m.created_at).toLocaleDateString()} · {m.xp_cost} XP</Text>
            </View>
            {m.kind !== 'cash' && (
              <TouchableOpacity onPress={() => shareCode(m)} hitSlop={10} accessibilityRole="button" accessibilityLabel={T('rw_copy')}>
                <ICONS.Share color={ACCENT} size={20} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 22, borderRadius: radii['2xl'], alignItems: 'center', marginBottom: space.lg },
  heroLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroNum: { color: '#fff', fontSize: 48, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: space.lg },
  segBtn: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.xl, borderWidth: 1, marginBottom: space.md },
  emoji: { fontSize: 34 },
  redeem: { minWidth: 86, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  codeBox: { alignSelf: 'stretch', padding: 22, borderRadius: radii.xl, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', marginVertical: space.xl },
  code: { fontSize: 26, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 16, fontWeight: '600' },
  codeSm: { fontSize: 16, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  primary: { alignSelf: 'stretch', minHeight: 54, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
