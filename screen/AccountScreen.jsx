// screens/AccountScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Redesigned to match Homescreen's design language:
//   • Same colour tokens (BLUE #1A56DB, light/dark surfaces)
//   • Professional SVG stroke icons throughout (react-native-svg)
//   • Section cards matching Homescreen card style
//   • LinearGradient hero identical in structure to Homescreen banners
//   • All broken context references fixed (no clearAccess / checkStatus)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { useTheme }        from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage }     from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';

// ── Design tokens (identical to Homescreen) ───────────────────────────────────
const BLUE      = '#1A56DB';
const BLUE_LIGHT= '#EFF6FF';
const BLUE_DARK = '#0D2EA0';
const BLUE_MID  = '#1D4ED8';

// ── Category metadata ─────────────────────────────────────────────────────────
const buildCAT = (t) => ({
  children:     { label:t('cat_children','Children'),         ageRange:t('cat_children_range','Ages 4 – 11'),    color:'#F97316', grad:['#F97316','#EA580C'] },
  intermediate: { label:t('cat_intermediate','Intermediate'), ageRange:t('cat_intermediate_range','Ages 12 – 17'),   color:'#10B981', grad:['#10B981','#059669'] },
  youth:        { label:t('cat_youth','Youth'),               ageRange:t('cat_youth_range','Ages 18 – 25'),   color:BLUE,      grad:[BLUE,BLUE_MID]       },
  adult:        { label:t('cat_adult','Adult'),               ageRange:t('cat_adult_range','26 & above'),     color:'#7C3AED', grad:['#7C3AED','#6D28D9'] },
  all:          { label:t('account_all_categories','All Categories'), ageRange:t('account_all_age_groups','All age groups'), color:BLUE,      grad:[BLUE,BLUE_DARK]      },
});

// ── SVG icon component ────────────────────────────────────────────────────────
function Icon({ d, size=18, color=BLUE, sw=1.8, extra }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
      {extra}
    </Svg>
  );
}

// Icon path dictionary
const IC = {
  back:     'M15 18l-6-6 6-6',
  refresh:  'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  mail:     'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  calendar: 'M3 4h18v18H3V4z M16 2v4M8 2v4M3 10h18',
  clock:    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  star:     'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  zap:      'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  lock:     'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4',
  logout:   'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  check:    'M20 6L9 17l-5-5',
  upgrade:  'M12 19V5M5 12l7-7 7 7',
  tag:      'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  info:     'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8h.01M12 12v4',
  users:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
};

// ── Reusable sub-components ───────────────────────────────────────────────────
function SectionHeader({ title, tk }) {
  return (
    <View style={sh.row}>
      <View style={sh.line} />
      <Text style={[sh.title, { color: tk.textMuted }]}>{title}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', gap:10, marginBottom:14 },
  line:  { width:3, height:16, borderRadius:2, backgroundColor:BLUE },
  title: { fontSize:10, fontWeight:'900', letterSpacing:2.5, textTransform:'uppercase' },
});

function DetailRow({ iconPath, label, value, valueColor, isLast, tk }) {
  return (
    <View style={[dr.row, !isLast && { borderBottomWidth:1, borderBottomColor:tk.border }]}>
      <View style={[dr.iconBox, { backgroundColor: BLUE_LIGHT }]}>
        <Icon d={iconPath} color={BLUE} size={14} sw={1.8} />
      </View>
      <Text style={[dr.label, { color: tk.textMuted }]}>{label}</Text>
      <Text style={[dr.value, { color: valueColor || tk.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
const dr = StyleSheet.create({
  row:     { flexDirection:'row', alignItems:'center', paddingVertical:11, gap:12 },
  iconBox: { width:30, height:30, borderRadius:9, justifyContent:'center', alignItems:'center', flexShrink:0 },
  label:   { fontSize:12, fontWeight:'600', flex:1 },
  value:   { fontSize:13, fontWeight:'800', maxWidth:'52%', textAlign:'right' },
});

function ActionBtn({ gradient, iconPath, label, sub, onPress, shadowColor }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.87}
      style={[ab.wrap, { shadowColor }]}>
      <LinearGradient colors={gradient} start={{x:0,y:0}} end={{x:1,y:0}} style={ab.grad}>
        <View style={ab.iconBox}>
          <Icon d={iconPath} color="#fff" size={18} sw={2} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={ab.label}>{label}</Text>
          {sub && <Text style={ab.sub}>{sub}</Text>}
        </View>
        <Icon d="M9 18l6-6-6-6" color="rgba(255,255,255,0.65)" size={16} sw={2.2} />
      </LinearGradient>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  wrap:    { marginHorizontal:20, marginTop:12, borderRadius:18, overflow:'hidden', shadowOffset:{width:0,height:6}, shadowOpacity:0.3, shadowRadius:14, elevation:8 },
  grad:    { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:16, paddingHorizontal:18 },
  iconBox: { width:40, height:40, borderRadius:12, backgroundColor:'rgba(255,255,255,0.18)', justifyContent:'center', alignItems:'center' },
  label:   { color:'#fff', fontSize:14, fontWeight:'900' },
  sub:     { color:'rgba(255,255,255,0.72)', fontSize:11, marginTop:2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function AccountScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const CAT = useMemo(() => buildCAT(t), [t]);
  const { fade, translateY } = useScreenEntry();

  const {
    email, expiryDate, daysRemaining,
    subscribedCategory, planType, isSubscribed, recheck,
  } = useSubscription();

  const [refreshing, setRefreshing] = useState(false);

  const expiry   = expiryDate ? new Date(expiryDate) : null;
  const daysLeft = daysRemaining ?? (expiry ? Math.max(0, Math.ceil((expiry - new Date()) / 86400000)) : 0);
  const isExpired= !isSubscribed || !expiry || new Date() > expiry;
  const catKey   = subscribedCategory || 'adult';
  const catMeta  = CAT[catKey] || CAT.adult;
  const isAll    = planType === 'all' || catKey === 'all';

  const formatDate = (d) =>
    d ? d.toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' }) : '—';

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await recheck(); } catch {}
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      t('sign_out', 'Sign Out'),
      t('account_signout_msg', 'This will sign you out from this device. Your subscription stays active and can be restored by logging in again.'),
      [
        { text:t('btn_cancel', 'Cancel'), style:'cancel' },
        {
          text:t('sign_out', 'Sign Out'), style:'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove([
              'userToken','userEmail','userName','userRole',
              'gofamint_sub_expiry','gofamint_sub_active',
              'isSubscribed','sub_category','sub_plan_type',
            ]);
            navigation.reset({ index:0, routes:[{ name:'Login' }] });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor:tk.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE_DARK} />

      {/* ── Top bar ── */}
      <View style={[s.topbar, { backgroundColor:BLUE_DARK }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={s.iconBtn}>
          <Icon d={IC.back} color="#fff" size={20} sw={2.3} />
        </TouchableOpacity>
        <Text style={s.topbarTitle}>{t('my_account', 'My Account')}</Text>
        <TouchableOpacity onPress={handleRefresh} activeOpacity={0.75} style={s.iconBtn} disabled={refreshing}>
          {refreshing
            ? <ActivityIndicator color="#fff" size="small" />
            : <Icon d={IC.refresh} color="#fff" size={17} sw={2} />}
        </TouchableOpacity>
      </View>

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:52 }}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        {/* ── Hero ── */}
        <LinearGradient colors={[BLUE, BLUE_DARK, '#040A1C']}
          start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
          <View style={s.orb1}/><View style={s.orb2}/>

          {/* Shield avatar */}
          <View style={s.avatarRing}>
            <View style={s.avatarInner}>
              <Icon d={IC.shield} color="#fff" size={34} sw={1.6} />
            </View>
          </View>

          <Text style={s.heroEmail} numberOfLines={1}>{email || '—'}</Text>

          {/* Category pill */}
          <View style={[s.catPill, { backgroundColor:catMeta.color+'28', borderColor:catMeta.color+'60' }]}>
            <Icon d={isAll ? IC.users : IC.tag} color={catMeta.color} size={12} sw={1.8} />
            <Text style={[s.catPillLabel, { color:'#fff' }]}>{catMeta.label}</Text>
            <View style={s.catPillDivider}/>
            <Text style={[s.catPillAge, { color:'rgba(255,255,255,0.65)' }]}>{catMeta.ageRange}</Text>
          </View>

          {/* Status pill */}
          <View style={[s.statusPill, {
            backgroundColor: isExpired ? '#EF444428' : '#10B98128',
            borderColor:      isExpired ? '#EF444460' : '#10B98160',
          }]}>
            <View style={[s.statusDot, { backgroundColor: isExpired ? '#EF4444' : '#10B981' }]}/>
            <Text style={[s.statusTxt, { color: isExpired ? '#FCA5A5' : '#6EE7B7' }]}>
              {isExpired
                ? t('account_sub_expired', 'Subscription expired')
                : (daysLeft === 1
                    ? t('account_active_one_day', 'Active · 1 day remaining')
                    : t('account_active_n_days', 'Active · {n} days remaining').replace('{n}', String(daysLeft)))}
            </Text>
          </View>
        </LinearGradient>

        {/* ── Plan card ── */}
        <View style={[s.card, { backgroundColor:tk.surface, borderColor:tk.border }]}>
          <SectionHeader title={t('your_plan', 'Your Plan')} tk={tk} />
          <View style={[s.planCard, { backgroundColor:catMeta.color+'0e', borderColor:catMeta.color+'28' }]}>
            <View style={[s.planIconBox, { backgroundColor:catMeta.color+'22' }]}>
              <Icon d={isAll ? IC.users : IC.tag} color={catMeta.color} size={22} sw={1.8} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={[s.planName, { color:catMeta.color }]}>{catMeta.label}</Text>
              <Text style={[s.planAge,  { color:tk.textMuted  }]}>{catMeta.ageRange}</Text>
              <Text style={[s.planNote, { color:tk.textSec    }]}>
                {isAll
                  ? t('account_full_access_note', 'Full access to all 4 age groups.')
                  : t('account_single_plan_note', 'Single category plan · Upgrade to unlock all.')}
              </Text>
            </View>
            <View style={[s.badge, {
              backgroundColor: isAll ? '#10B98114' : BLUE_LIGHT,
              borderColor:     isAll ? '#10B98140' : BLUE+'30',
            }]}>
              <Icon d={isAll ? IC.check : IC.star}
                color={isAll ? '#10B981' : BLUE} size={11} sw={2.2} />
              <Text style={[s.badgeTxt, { color:isAll ? '#10B981' : BLUE }]}>
                {isAll ? t('account_badge_all_access', 'All Access') : t('account_badge_500_plan', '₦500 Plan')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Details card ── */}
        <View style={[s.card, { backgroundColor:tk.surface, borderColor:tk.border }]}>
          <SectionHeader title={t('subscription_details', 'Subscription Details')} tk={tk} />
          <DetailRow iconPath={IC.mail}     label={t('account_email', 'Email')}          value={email || '—'}             tk={tk} />
          <DetailRow iconPath={IC.tag}      label={t('account_category', 'Category')}    value={catMeta.label}             tk={tk} />
          <DetailRow iconPath={IC.star}     label={t('plan_type', 'Plan Type')}          value={isAll ? t('account_all_categories', 'All Categories') : t('account_single', 'Single')} tk={tk} />
          <DetailRow iconPath={IC.info}     label={t('status', 'Status')}                value={isExpired ? t('expired', 'Expired') : t('active', 'Active')}
            valueColor={isExpired ? '#EF4444' : '#10B981'} tk={tk} />
          <DetailRow iconPath={IC.calendar} label={t('expires_on', 'Expires On')}        value={formatDate(expiry)}        tk={tk} />
          <DetailRow iconPath={IC.clock}    label={t('days_remaining', 'Days Remaining')} isLast
            value={isExpired
              ? t('account_zero_days', '0 days')
              : (daysLeft === 1
                  ? t('account_one_day', '1 day')
                  : t('account_n_days', '{n} days').replace('{n}', String(daysLeft)))}
            valueColor={!isExpired && daysLeft <= 14 ? '#F59E0B' : undefined} tk={tk} />
        </View>

        {/* ── Action buttons ── */}
        {!isExpired && !isAll && (
          <ActionBtn gradient={['#7C3AED','#5B21B6']} iconPath={IC.upgrade}
            label={t('account_upgrade_label', 'Upgrade to All Categories')} sub={t('account_upgrade_sub', 'Unlock every age group · ₦1,000')}
            shadowColor="#7C3AED" onPress={() => navigation.navigate('PaymentScreen')} />
        )}
        {(isExpired || daysLeft <= 30) && (
          <ActionBtn
            gradient={isExpired ? ['#EF4444','#B91C1C'] : [BLUE,BLUE_DARK]}
            iconPath={isExpired ? IC.lock : IC.zap}
            label={isExpired ? t('renew', 'Renew Subscription') : t('extend', 'Extend Subscription')}
            sub={isExpired
              ? t('account_renew_sub', 'Reactivate your access · from ₦500')
              : t('account_extend_sub', '{n} days left — top up now').replace('{n}', String(daysLeft))}
            shadowColor={isExpired ? '#EF4444' : BLUE}
            onPress={() => navigation.navigate('PaymentScreen')} />
        )}
        {!isSubscribed && (
          <ActionBtn gradient={[BLUE,BLUE_DARK]} iconPath={IC.star}
            label={t('account_subscribe_now', 'Subscribe Now')} sub={t('account_subscribe_sub', 'From ₦500 · Choose your category')}
            shadowColor={BLUE} onPress={() => navigation.navigate('PaymentScreen')} />
        )}

        {/* ── Sign out ── */}
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}
          style={[s.logoutBtn, { backgroundColor:tk.surface, borderColor:tk.border }]}>
          <Icon d={IC.logout} color="#EF4444" size={17} sw={2} />
          <Text style={s.logoutTxt}>{t('account_signout_device', 'Sign Out of This Device')}</Text>
        </TouchableOpacity>

        <Text style={[s.note, { color:tk.textMuted }]}>
          {t('account_signout_note', 'Signing out removes local data only. Your subscription remains active and can be restored by logging in again.')}
        </Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex:1 },
  topbar:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', height:56, paddingHorizontal:16 },
  iconBtn:     { width:40, height:40, borderRadius:12, backgroundColor:'rgba(255,255,255,0.12)', justifyContent:'center', alignItems:'center' },
  topbarTitle: { fontSize:17, fontWeight:'900', color:'#fff', letterSpacing:-0.3 },

  hero:        { paddingTop:32, paddingBottom:26, alignItems:'center', overflow:'hidden', position:'relative' },
  orb1:        { position:'absolute', width:220, height:220, borderRadius:110, backgroundColor:'rgba(255,255,255,0.04)', top:-70, right:-60 },
  orb2:        { position:'absolute', width:130, height:130, borderRadius:65,  backgroundColor:'rgba(255,255,255,0.04)', bottom:-40, left:10 },
  avatarRing:  { width:82, height:82, borderRadius:41, backgroundColor:'rgba(255,255,255,0.12)', borderWidth:2, borderColor:'rgba(255,255,255,0.22)', justifyContent:'center', alignItems:'center', marginBottom:14, shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.28, shadowRadius:14, elevation:8 },
  avatarInner: { width:62, height:62, borderRadius:31, backgroundColor:'rgba(255,255,255,0.08)', justifyContent:'center', alignItems:'center' },
  heroEmail:   { color:'rgba(255,255,255,0.8)', fontSize:13, fontWeight:'700', marginBottom:12, maxWidth:'80%' },

  catPill:     { flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:14, paddingVertical:8, borderRadius:20, borderWidth:1, marginBottom:10 },
  catPillLabel:{ fontSize:12, fontWeight:'800' },
  catPillDivider:{ width:1, height:11, backgroundColor:'rgba(255,255,255,0.3)' },
  catPillAge:  { fontSize:10, fontWeight:'600' },
  statusPill:  { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:13, paddingVertical:6, borderRadius:20, borderWidth:1 },
  statusDot:   { width:7, height:7, borderRadius:4 },
  statusTxt:   { fontSize:11, fontWeight:'700', letterSpacing:0.3 },

  card:        { marginHorizontal:20, marginTop:16, borderRadius:18, borderWidth:1, padding:18, shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.06, shadowRadius:10, elevation:3 },

  planCard:    { flexDirection:'row', alignItems:'flex-start', gap:12, borderRadius:14, borderWidth:1, padding:13 },
  planIconBox: { width:46, height:46, borderRadius:13, justifyContent:'center', alignItems:'center', flexShrink:0, marginTop:2 },
  planName:    { fontSize:15, fontWeight:'900', marginBottom:2 },
  planAge:     { fontSize:11, fontWeight:'600', marginBottom:5 },
  planNote:    { fontSize:12, lineHeight:17 },
  badge:       { borderRadius:10, paddingHorizontal:8, paddingVertical:5, flexDirection:'row', alignItems:'center', gap:4, alignSelf:'flex-start', marginTop:2, borderWidth:1 },
  badgeTxt:    { fontSize:10, fontWeight:'800', letterSpacing:0.3 },

  logoutBtn:   { marginHorizontal:20, marginTop:14, height:52, borderRadius:16, borderWidth:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10 },
  logoutTxt:   { fontSize:13, fontWeight:'700', color:'#EF4444' },
  note:        { marginHorizontal:24, marginTop:14, fontSize:11, lineHeight:17, textAlign:'center', fontStyle:'italic' },
});