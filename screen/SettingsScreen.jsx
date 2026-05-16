// screens/SettingsScreen.jsx — Bamboo fintech, simplified
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Switch,
         Alert, ActivityIndicator, Platform, Animated } from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import AsyncStorage        from '@react-native-async-storage/async-storage';
import { API_BASE_URL }   from '../services/api';
import { ICONS } from '../components/icons';
import { useTheme }       from '../context/ThemeContext';
import { useLanguage }    from '../context/LanguageContext';
import NotificationService, { DEFAULTS } from '../services/NotificationService';
import { getTokens } from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';

const API  = API_BASE_URL;
const BLUE = '#1A56DB', BLUE_LIGHT = '#EFF6FF';

// ── Language definitions with native name + description ───────────────────────
const buildLangs = (t) => [
  { code:'en', label:t('set_lang_english','English'),  native:'English',     flag:'🇬🇧', desc:t('set_lang_english_desc','Default app language')   },
  { code:'yo', label:t('set_lang_yoruba','Yoruba'),    native:'Èdè Yorùbá',  flag:'🇳🇬', desc:t('set_lang_yoruba_desc','South-west Nigeria')     },
  { code:'ig', label:t('set_lang_igbo','Igbo'),        native:'Asụsụ Igbo',  flag:'🇳🇬', desc:t('set_lang_igbo_desc','South-east Nigeria')       },
  { code:'ha', label:t('set_lang_hausa','Hausa'),      native:'Harshen Hausa',flag:'🇳🇬', desc:t('set_lang_hausa_desc','Northern Nigeria')        },
];

const HOURS   = Array.from({ length:24 }, (_,i) => i);
const MINUTES = [0,5,10,15,20,25,30,35,40,45,50,55];

// ── Helpers ───────────────────────────────────────────────────────────────────
// `Icon` is preferred (Lucide-style SVG from ICONS registry). Legacy `icon`
// emoji string kept as a fallback so we don't have to touch every call site
// at once. Pass exactly one of the two.
const SectionHead = ({ title, icon, Icon, tk }) => (
  <View style={{ paddingHorizontal:20, paddingTop:28, paddingBottom:10,
    flexDirection:'row', alignItems:'center', gap:8 }}>
    {Icon
      ? <Icon color={tk.textMuted} size={14} sw={2} />
      : icon ? <Text style={{ fontSize:16 }}>{icon}</Text> : null}
    <Text style={{ fontSize:10, fontWeight:'900', letterSpacing:2.5, color:tk.textMuted }}>
      {title}
    </Text>
  </View>
);

const Card = ({ children, tk }) => (
  <View style={{ marginHorizontal:20, borderRadius:18, borderWidth:1, overflow:'hidden',
    shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05,
    shadowRadius:10, elevation:2, backgroundColor:tk.surface, borderColor:tk.border }}>
    {children}
  </View>
);

// Like SectionHead — `Icon` component preferred, `icon` emoji string is the
// fallback for any row that still needs to be migrated.
const Row = ({ icon, Icon, label, sub, onPress, right, tk, danger, noBorder }) => {
  const tint = danger ? '#DC2626' : BLUE;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress && !right ? 0.75 : 1}
      style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:18, paddingVertical:15,
        borderBottomWidth:noBorder?0:1, borderBottomColor:tk.border }}>
      <View style={{ width:42, height:42, borderRadius:13, justifyContent:'center',
        alignItems:'center', backgroundColor:danger ? '#FEE2E2' : BLUE_LIGHT }}>
        {Icon
          ? <Icon color={tint} size={20} sw={1.9} />
          : <Text style={{ fontSize:20 }}>{icon}</Text>}
      </View>
      <View style={{ flex:1, marginLeft:14 }}>
        <Text style={{ fontSize:15, fontWeight:'700',
          color:danger ? '#DC2626' : tk.textPrimary }}>{label}</Text>
        {!!sub && <Text style={{ fontSize:12, marginTop:2, color:tk.textMuted }}
          numberOfLines={1}>{sub}</Text>}
      </View>
      {right}
      {onPress && !right && (
        <View style={{ marginLeft:8 }}>
          <ICONS.ChevronRight color={tk.textMuted} size={18} sw={1.9} />
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Language row — full-width, clean, professional ────────────────────────────
const LangRow = ({ code, label, native, flag, desc, active, onPress, tk, isLast }) => {
  const scaleRef = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleRef, { toValue:0.97, duration:80, useNativeDriver:true }),
      Animated.spring(scaleRef, { toValue:1, tension:200, friction:10, useNativeDriver:true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform:[{ scale:scaleRef }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={{
          flexDirection:    'row',
          alignItems:       'center',
          paddingHorizontal: 18,
          paddingVertical:   14,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: tk.border,
          backgroundColor:   active ? BLUE + '0a' : 'transparent',
        }}
      >
        {/* Flag circle */}
        <View style={{
          width:44, height:44, borderRadius:22,
          backgroundColor: active ? BLUE + '18' : tk.surfaceEl,
          justifyContent:'center', alignItems:'center',
          borderWidth: active ? 1.5 : 0,
          borderColor: active ? BLUE + '40' : 'transparent',
          marginRight:14,
        }}>
          <Text style={{ fontSize:22 }}>{flag}</Text>
        </View>

        {/* Text block */}
        <View style={{ flex:1 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:2 }}>
            <Text style={{
              fontSize:15, fontWeight:'800',
              color: active ? BLUE : tk.textPrimary,
            }}>
              {label}
            </Text>
            {/* Native name tag */}
            {native !== label && (
              <View style={{
                backgroundColor: active ? BLUE + '14' : tk.surfaceEl,
                borderRadius:6, paddingHorizontal:7, paddingVertical:2,
              }}>
                <Text style={{
                  fontSize:11, fontWeight:'600',
                  color: active ? BLUE : tk.textMuted,
                }}>
                  {native}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize:12, color:tk.textMuted }}>{desc}</Text>
        </View>

        {/* Right indicator */}
        {active ? (
          /* Filled check circle */
          <View style={{
            width:24, height:24, borderRadius:12,
            backgroundColor:BLUE,
            justifyContent:'center', alignItems:'center',
            shadowColor:BLUE,
            shadowOffset:{ width:0, height:3 },
            shadowOpacity:0.35,
            shadowRadius:6,
            elevation:4,
          }}>
            <ICONS.Check color="#fff" size={12} sw={3} />
          </View>
        ) : (
          /* Empty circle placeholder */
          <View style={{
            width:24, height:24, borderRadius:12,
            borderWidth:1.5, borderColor:tk.border,
          }}/>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const TimePicker = ({ hour, minute, onChange, tk, t }) => {
  const fmt = h => `${h%12||12} ${h<12?'AM':'PM'}`;
  return (
    <View style={{ paddingHorizontal:18, paddingVertical:14,
      borderTopWidth:1, borderTopColor:tk.border }}>
      <Text style={{ fontSize:9, fontWeight:'900', letterSpacing:1.8,
        marginBottom:10, color:tk.textMuted }}>
        {t?.('reminderTime', 'REMINDER TIME') || 'REMINDER TIME'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap:6 }}>
        {HOURS.map(h => (
          <TouchableOpacity key={h} onPress={() => onChange(h, minute)} activeOpacity={0.8}
            style={{ borderRadius:10, borderWidth:1.5, paddingHorizontal:10, paddingVertical:7,
              backgroundColor:h===hour ? BLUE : tk.surfaceEl,
              borderColor:h===hour ? BLUE : tk.border }}>
            <Text style={{ fontSize:11, fontWeight:'800',
              color:h===hour ? '#fff' : tk.textSec }}>{fmt(h)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap:6, marginTop:8 }}>
        {MINUTES.map(m => (
          <TouchableOpacity key={m} onPress={() => onChange(hour, m)} activeOpacity={0.8}
            style={{ borderRadius:10, borderWidth:1.5, paddingHorizontal:10, paddingVertical:7,
              backgroundColor:m===minute ? BLUE : tk.surfaceEl,
              borderColor:m===minute ? BLUE : tk.border }}>
            <Text style={{ fontSize:11, fontWeight:'800',
              color:m===minute ? '#fff' : tk.textSec }}>:{String(m).padStart(2,'0')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation, route }) {
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, t }    = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const LANGS = useMemo(() => buildLangs(t), [t]);
  const { fade, translateY } = useScreenEntry();

  // Book context — drives where the in-screen learning links and the bottom
  // tab bar route. Without this, Prayer-book users tapping ⚙️ landed on a
  // Sunday-School-themed surface (HomeScreen tab, SS lesson library, SS
  // progress) which felt like a forced redirect out of their current book.
  const book      = route?.params?.book || 'sunday_school';
  const isVictory = book === 'victory_month_prayer';

  const [email,       setEmail]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [quizEnabled, setQuizEnabled] = useState(true);
  const [quizHour,    setQuizHour]    = useState(DEFAULTS?.quiz?.hour || 9);
  const [quizMinute,  setQuizMinute]  = useState(DEFAULTS?.quiz?.minute || 0);
  const [devEnabled,  setDevEnabled]  = useState(true);
  const [devHour,     setDevHour]     = useState(DEFAULTS?.devotional?.hour || 6);
  const [devMinute,   setDevMinute]   = useState(DEFAULTS?.devotional?.minute || 0);
  const [notifPerm,   setNotifPerm]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const em = await AsyncStorage.getItem('userEmail');
      if (!em) { setLoading(false); return; }
      setEmail(em);
      const pr = await fetch(`${API}/api/profile/${encodeURIComponent(em)}`);
      if (pr.ok) { const p = await pr.json(); setDisplayName(p.display_name || ''); }
    } catch {}
    try {
      const s = await NotificationService.loadSettings();
      setQuizEnabled(s.quiz.enabled); setQuizHour(s.quiz.hour); setQuizMinute(s.quiz.minute);
      setDevEnabled(s.devotional.enabled); setDevHour(s.devotional.hour);
      setDevMinute(s.devotional.minute);
      setNotifPerm(await NotificationService.hasPermission());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => { const u = navigation.addListener('focus', load); return u; }, [navigation]);

  const saveField = fields => {
    if (!email) return;
    fetch(`${API}/api/profile/${encodeURIComponent(email)}`,
      { method:'PUT', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(fields) }
    ).catch(() => {});
  };

  const handleLogout = () => Alert.alert(t('sign_out', 'Sign Out'), t('set_signout_confirm', 'Are you sure?'), [
    { text:t('btn_cancel', 'Cancel'), style:'cancel' },
    { text:t('sign_out', 'Sign Out'), style:'destructive', onPress: async () => {
      await AsyncStorage.multiRemove(['userEmail','userToken','userName','userRole',
        'gofamint_sub_expiry','gofamint_sub_active']);
      navigation.reset({ index:0, routes:[{ name:'Login' }] });
    }},
  ]);

  const initials = (displayName || email || 'G')[0].toUpperCase();

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg}/>

      {/* TOP BAR */}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
        paddingHorizontal:20, paddingTop:8, paddingBottom:16 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}
          style={{ width:40, height:40, borderRadius:20, justifyContent:'center',
            alignItems:'center', backgroundColor:tk.surfaceEl }}>
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} sw={2} />
        </TouchableOpacity>
        <Text style={{ fontSize:17, fontWeight:'800', color:tk.textPrimary }}>{t('settings', 'Settings')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.75}
          accessibilityLabel="Profile"
          style={{ width:40, height:40, borderRadius:20, justifyContent:'center',
            alignItems:'center', backgroundColor:BLUE_LIGHT }}>
          <ICONS.User color={BLUE} size={18} sw={1.9} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <ActivityIndicator color={BLUE} size="large"/>
        </View>
      ) : (
        // No reserved space for a bottom tab bar — the screen no longer
        // renders one. 30px gives the last row some breathing room.
        <Animated.ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          style={{ opacity: fade, transform: [{ translateY }] }}>

          {/* PROFILE PILL */}
          <View style={{ marginHorizontal:20, marginBottom:8, borderRadius:18, borderWidth:1,
            paddingHorizontal:16, paddingVertical:16, flexDirection:'row', alignItems:'center',
            gap:14, backgroundColor:tk.surface, borderColor:tk.border }}>
            <View style={{ width:52, height:52, borderRadius:26, backgroundColor:BLUE,
              justifyContent:'center', alignItems:'center' }}>
              <Text style={{ color:'#fff', fontSize:20, fontWeight:'900' }}>{initials}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:16, fontWeight:'800', marginBottom:2,
                color:tk.textPrimary }}>
                {displayName || email.split('@')[0] || t('set_my_profile', 'My Profile')}
              </Text>
              <Text style={{ fontSize:11, color:tk.textMuted }} numberOfLines={1}>{email}</Text>
            </View>
          </View>

          {/* MY LEARNING — links route back into the current book, so Prayer
              users stay in the Prayer book and SS users stay in SS.
              The Sunday School "Progress & Scores" link was moved out of
              Settings — SS users now reach it from the Progress tab in the
              Sunday School bottom nav. Victory still surfaces its own
              progress page here because it has a distinct 31-day flow. */}
          <SectionHead title={t('my_learning', 'My Learning').toUpperCase()} Icon={ICONS.BookStack} tk={tk}/>
          <Card tk={tk}>
            {isVictory && (
              <Row Icon={ICONS.Stats}
                label={t('progress_scores', 'Progress & Scores')}
                sub={t('vmp_progress_sub', 'Your 31-day prayer journey')}
                tk={tk}
                onPress={() => navigation.navigate('VictoryProgress')}/>
            )}
            <Row Icon={ICONS.Book}
              label={isVictory
                ? t('vmp_prayer_library', 'Prayer Days')
                : t('lesson_library', 'Lesson Library')}
              sub={isVictory
                ? t('vmp_prayer_library_sub', 'Browse all 31 days')
                : t('lesson_library_sub', 'Browse all Sunday School lessons')}
              tk={tk}
              onPress={() => navigation.navigate(isVictory ? 'VictoryMonthHome' : 'HomeScreen')}
              noBorder/>
          </Card>

          {/* ── IDENTITY ────────────────────────────────────────────────────
              Single entry point into the Gospeler ID hub. The hub itself
              handles the empty / has-card branch so this row stays the same
              for both new and existing users — only the caption shifts. */}
          <SectionHead title={t('identity', 'Identity').toUpperCase()} Icon={ICONS.ShieldCheck} tk={tk}/>
          <Card tk={tk}>
            <Row Icon={ICONS.QrCode}
              label={t('gid_settings_row', 'Gospeler ID')}
              sub={t('gid_settings_sub', 'Your digital Christian identity card')}
              tk={tk}
              onPress={() => navigation.navigate('GospelerId')}
              noBorder/>
          </Card>

          {/* ── LANGUAGE ─────────────────────────────────────────────────── */}
          <SectionHead title={t('language', 'Language').toUpperCase()} Icon={ICONS.Globe} tk={tk}/>

          {/* Active language summary pill */}
          {(() => {
            const activeLang = LANGS.find(l => l.code === lang) || LANGS[0];
            return (
              <View style={{
                marginHorizontal:20, marginBottom:12,
                flexDirection:'row', alignItems:'center', gap:10,
                backgroundColor: BLUE + '0d',
                borderRadius:12, borderWidth:1, borderColor: BLUE + '25',
                paddingHorizontal:14, paddingVertical:10,
              }}>
                <Text style={{ fontSize:20 }}>{activeLang.flag}</Text>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:13, fontWeight:'800', color:BLUE }}>
                    {activeLang.label}
                    {activeLang.native !== activeLang.label ? ` · ${activeLang.native}` : ''}
                  </Text>
                  <Text style={{ fontSize:11, color:BLUE + 'aa', marginTop:1 }}>
                    {t('set_currently_selected', 'Currently selected language')}
                  </Text>
                </View>
                <View style={{
                  backgroundColor:BLUE, borderRadius:8,
                  paddingHorizontal:9, paddingVertical:4,
                }}>
                  <Text style={{ color:'#fff', fontSize:10, fontWeight:'900', letterSpacing:0.5 }}>
                    {t('set_active_badge', 'ACTIVE')}
                  </Text>
                </View>
              </View>
            );
          })()}

          <Card tk={tk}>
            {LANGS.map((l, i) => (
              <LangRow
                key={l.code}
                {...l}
                active={lang === l.code}
                isLast={i === LANGS.length - 1}
                tk={tk}
                onPress={() => {
                  setLang(l.code);
                  saveField({ lang_pref: l.code });
                }}
              />
            ))}
          </Card>

          {/* APPEARANCE */}
          <SectionHead title={t('appearance', 'Appearance').toUpperCase()} Icon={ICONS.Sun} tk={tk}/>
          <Card tk={tk}>
            <Row Icon={isDark ? ICONS.Moon : ICONS.Sun} label={isDark ? t('dark_mode', 'Dark Mode') : t('light_mode', 'Light Mode')}
              sub={t('switch_theme', 'Switch app theme')} tk={tk} noBorder
              right={
                <Switch value={isDark}
                  onValueChange={() => { toggleTheme(); saveField({ dark_mode:!isDark }); }}
                  trackColor={{ false:'#D1D5DB', true:BLUE+'90' }}
                  thumbColor={isDark ? BLUE : '#fff'} ios_backgroundColor="#D1D5DB"/>
              }/>
          </Card>

          {/* NOTIFICATIONS */}
          <SectionHead title={t('notifications', 'Notifications').toUpperCase()} Icon={ICONS.Bell} tk={tk}/>
          <Card tk={tk}>
            {!notifPerm && (
              <TouchableOpacity
                onPress={async () => {
                  const g = await NotificationService.requestPermission();
                  setNotifPerm(g);
                }}
                activeOpacity={0.85}
                style={{ flexDirection:'row', alignItems:'center', margin:14, borderRadius:14,
                  borderWidth:1, padding:14, backgroundColor:BLUE_LIGHT, borderColor:BLUE+'30' }}>
                <ICONS.Bell color={BLUE} size={22} sw={2} />
                <View style={{ flex:1, marginLeft:12 }}>
                  <Text style={{ fontSize:14, fontWeight:'800', marginBottom:2,
                    color:tk.textPrimary }}>{t('set_enable_notifications', 'Enable Notifications')}</Text>
                  <Text style={{ fontSize:12, color:tk.textMuted }}>
                    {t('set_tap_allow_reminders', 'Tap to allow lesson reminders')}
                  </Text>
                </View>
                <View style={{ borderRadius:10, paddingHorizontal:12, paddingVertical:8,
                  backgroundColor:BLUE }}>
                  <Text style={{ color:'#fff', fontSize:12, fontWeight:'800' }}>{t('set_allow', 'Allow')}</Text>
                </View>
              </TouchableOpacity>
            )}
            <Row Icon={ICONS.Zap} label={t('set_quiz_reminder', 'Sunday School Quiz Reminder')}
              sub={t('set_quiz_reminder_sub', 'Every Sunday · 3:00 PM · automatically scheduled')}
              tk={tk}
              right={
                <View style={{ borderRadius:10, paddingHorizontal:10, paddingVertical:5,
                  backgroundColor:BLUE_LIGHT }}>
                  <Text style={{ fontSize:11, fontWeight:'800', color:BLUE }}>{t('set_fixed', '🔒 Fixed')}</Text>
                </View>
              }/>
            <Row Icon={ICONS.Book} label={t('set_devotional_reminder', 'Devotional Reminder')}
              sub={devEnabled
                ? t('set_enabled_at', 'Enabled · {time}').replace('{time}', `${devHour}:${String(devMinute).padStart(2,'0')}`)
                : t('set_disabled', 'Disabled')}
              tk={tk} noBorder
              right={
                <Switch value={devEnabled}
                  onValueChange={async v => {
                    setDevEnabled(v);
                    if (v) await NotificationService
                      .scheduleDevotionalReminder({ hour:devHour, minute:devMinute })
                      .catch(() => {});
                    else await NotificationService.cancelDevotionalReminder().catch(() => {});
                  }}
                  trackColor={{ false:'#D1D5DB', true:BLUE+'90' }}
                  thumbColor={devEnabled ? BLUE : '#fff'} ios_backgroundColor="#D1D5DB"/>
              }/>
            {devEnabled && (
              <TimePicker hour={devHour} minute={devMinute}
                onChange={async (h,m) => {
                  setDevHour(h); setDevMinute(m);
                  await NotificationService
                    .scheduleDevotionalReminder({ hour:h, minute:m })
                    .catch(() => {});
                }} tk={tk} t={t}/>
            )}
          </Card>

          {/* GOSPELER ID — entry point for the digital Christian identity flow.
              Sits above ACCOUNT because it's identity-first, not preferences. */}
          <SectionHead title={t('gid_section', 'GOSPELER ID')} Icon={ICONS.ShieldCheck} tk={tk}/>
          <Card tk={tk}>
            <Row Icon={ICONS.ShieldCheck}
              label={t('gid_settings_label', 'My Gospeler ID')}
              sub={t('gid_settings_sub', 'Digital Christian identity, QR & verification')}
              tk={tk}
              onPress={() => navigation.navigate('GospelerId')}
              noBorder/>
          </Card>

          {/* ACCOUNT */}
          <SectionHead title={t('account', 'Account').toUpperCase()} Icon={ICONS.User} tk={tk}/>
          <Card tk={tk}>
            <Row Icon={ICONS.User} label={t('edit_profile', 'Edit Profile')}    sub={t('edit_profile_sub', 'Name, avatar, church')}
              tk={tk} onPress={() => navigation.navigate('Profile')}/>
            <Row Icon={ICONS.Lock} label={t('change_password', 'Change Password')} sub={t('change_password_sub', 'Update your login password')}
              tk={tk} onPress={() => navigation.navigate('ChangePassword')}/>
            <Row Icon={ICONS.LogOut} label={t('sign_out', 'Sign Out')}         sub={t('sign_out_sub', 'Sign out of this device')}
              tk={tk} danger onPress={handleLogout}/>
            <Row Icon={ICONS.Trash} label={t('delete_account', 'Delete Account')}  sub={t('delete_account_sub', 'Permanently remove data')}
              tk={tk} danger onPress={() => navigation.navigate('DeleteAccount')} noBorder/>
          </Card>

          {/* ABOUT */}
          <SectionHead title={t('about', 'About').toUpperCase()} icon="ℹ️" tk={tk}/>
          <Card tk={tk}>
            <Row icon="ℹ️" label={t('about_app', 'About App')} sub={t('set_version', 'Version 1.0.0 · Gospelar')}
              tk={tk} onPress={() => navigation.navigate('About')}/>
            <Row Icon={ICONS.Globe} label={t('website', 'Website')} sub="www.gospelar.com" tk={tk} noBorder/>
          </Card>

          <View style={{ alignItems:'center', marginTop:28, marginBottom:8, paddingHorizontal:20 }}>
            <Text style={{ fontSize:11, marginBottom:5, color:tk.textMuted }}>
              {t('login_footer', '© Gospelar Sunday School Department')}
            </Text>
            <Text style={{ fontSize:12, fontWeight:'900', color:BLUE }}>www.gospelar.com</Text>
          </View>

        </Animated.ScrollView>
      )}

      {/* Bottom tab bar removed. Settings is reached only from the Library
          home now, so the screen doesn't need its own book-flow nav — users
          return via the top-left back arrow. */}
    </SafeAreaView>
  );
}