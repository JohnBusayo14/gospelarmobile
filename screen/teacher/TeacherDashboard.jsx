// screens/teacher/TeacherDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors the student Homescreen layout exactly:
//   • Same topbar (avatar + greeting + icon buttons)
//   • Promo banner row
//   • Hero "summary" card (parallel to QuarterCard)
//   • "My Classes" grid (parallel to "Age Group" cards)
//   • "Today's Snapshot" feed (parallel to "Recent Lessons")
//   • Quick Access 2×2 grid
//   • Bottom AppTabBar — same SVG icons as Homescreen
// Primary color: BLUE (#1A56DB)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ActivityIndicator,
  TextInput, Modal, Alert, Pressable, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { useTheme }       from '../../context/ThemeContext';
import { useLanguage }    from '../../context/LanguageContext';
import { useTeacherSync } from '../../services/syncWorker';
import { API_BASE_URL }   from '../../services/api';
import AppTabBar          from '../../components/AppTabBar';
import { rosterSize }     from '../../services/teacherLocal';
import { getTokens } from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import { Animated } from 'react-native';

const { width } = Dimensions.get('window');
const API = API_BASE_URL;

// ── Design tokens — IDENTICAL to Homescreen.js ────────────────────────────────
const BLUE       = '#1A56DB';
const BLUE_LIGHT = '#EFF6FF';

const CATEGORY_COLORS = {
  adult:        '#7C3AED',
  youth:        BLUE,
  intermediate: '#10B981',
  children:     '#F97316',
};

const buildCategoryLabels = (t) => ({
  adult:        t('cat_adult', 'Adult'),
  youth:        t('cat_youth', 'Youth'),
  intermediate: t('cat_intermediate', 'Intermediate'),
  children:     t('cat_children', 'Children'),
});

// ─────────────────────────────────────────────────────────────────────────────
// BANNER CARD — same component shape as Homescreen BannerCard
// ─────────────────────────────────────────────────────────────────────────────
const BannerCard = ({ item }) => (
  <View style={[bn.card, { backgroundColor: item.color }]}>
    <Text style={bn.emoji}>{item.emoji}</Text>
    <Text style={bn.title} numberOfLines={1}>{item.title}</Text>
    <Text style={bn.sub}   numberOfLines={1}>{item.sub}</Text>
  </View>
);
const bn = StyleSheet.create({
  card:  { width:140, borderRadius:16, padding:14, marginRight:12, justifyContent:'space-between', height:100 },
  emoji: { fontSize:24, marginBottom:6 },
  title: { fontSize:13, fontWeight:'700', color:'#fff' },
  sub:   { fontSize:11, color:'rgba(255,255,255,.75)', marginTop:2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY CARD — parallel to Homescreen QuarterCard
// ─────────────────────────────────────────────────────────────────────────────
const SummaryCard = ({ teacherName, classesCount, studentsCount, tk, t, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9}
    style={[qc.card, { backgroundColor:tk.surface, borderColor:tk.border }]}>
    <View style={qc.row}>
      <View style={{ flex:1 }}>
        <Text style={[qc.meta, { color:tk.textMuted }]}>
          {t('teach_dashboard_title', 'Teacher Dashboard')}
        </Text>
        <Text style={[qc.theme, { color:tk.textPrimary }]}>
          {t('teach_welcome_back', 'Welcome back,')} {teacherName}
        </Text>
        <Text style={[qc.themeSub, { color:tk.textMuted }]} numberOfLines={1}>
          {t('teach_hero_book', 'Manage classes · Mark attendance · Award points')}
        </Text>
      </View>
      <View style={[qc.badge, { backgroundColor:BLUE_LIGHT }]}>
        <Text style={[qc.badgeBig, { color:BLUE }]}>{classesCount}</Text>
        <Text style={[qc.badgeSub, { color:BLUE }]}>{t('teach_classes', 'Classes')}</Text>
      </View>
    </View>
    <View style={[qc.divider, { backgroundColor:tk.border }]} />
    <View style={qc.row}>
      <Text style={[qc.bookLabel, { color:tk.textMuted }]}>
        👥  {studentsCount} {t('teach_students_lbl', 'students')}
      </Text>
      <View style={[qc.startBtn, { backgroundColor:BLUE }]}>
        <Text style={qc.startBtnTxt}>{t('teach_new_class_btn', '+  New Class')}</Text>
      </View>
    </View>
  </TouchableOpacity>
);
const qc = StyleSheet.create({
  card:      { borderRadius:18, borderWidth:1, padding:20, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.06, shadowRadius:12, elevation:3 },
  row:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  meta:      { fontSize:12, fontWeight:'600', marginBottom:6, letterSpacing:.3 },
  theme:     { fontSize:20, fontWeight:'800', lineHeight:26 },
  badge:     { borderRadius:14, padding:12, alignItems:'center', minWidth:68 },
  badgeBig:  { fontSize:22, fontWeight:'900', lineHeight:26 },
  badgeSub:  { fontSize:11, fontWeight:'700' },
  divider:   { height:1, marginVertical:18 },
  themeSub:  { fontSize:11, fontWeight:'500', marginTop:3 },
  bookLabel: { fontSize:13, fontWeight:'500' },
  startBtn:  { borderRadius:20, paddingHorizontal:14, paddingVertical:9 },
  startBtnTxt:{ color:'#fff', fontSize:13, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CLASS CARD — parallel to Homescreen AgeGroupCard (2-col grid, big circle)
// ─────────────────────────────────────────────────────────────────────────────
const ClassCard = ({ cls, active, onPress, tk, t, index = 0 }) => {
  const color    = CATEGORY_COLORS[cls.category] || BLUE;
  const labels   = buildCategoryLabels(t);
  const catLabel = labels[cls.category] || cls.category || t('teach_class', 'Class');
  const count    = parseInt(cls.student_count || 0);
  const { fade, translateY } = useStaggerEntry(index);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.82}
      style={[ag.card, {
        backgroundColor: active ? color : tk.surface,
        borderColor:     active ? color : tk.border,
        shadowColor:     active ? color : '#000',
      }]}>
      <View style={[ag.imgRing, {
        borderColor:     active ? 'rgba(255,255,255,0.5)' : color + '40',
        backgroundColor: active ? 'rgba(255,255,255,0.15)' : color + '12',
      }]}>
        <Text style={[ag.bigCount, { color: active ? '#fff' : color }]}>{count}</Text>
        <Text style={[ag.bigLbl, { color: active ? 'rgba(255,255,255,0.8)' : color }]}>
          {t('teach_students_lbl', 'students')}
        </Text>
      </View>
      <Text style={[ag.label, { color: active ? '#fff' : tk.textPrimary }]} numberOfLines={1}>
        {cls.name}
      </Text>
      <Text style={[ag.ageRange, { color: active ? 'rgba(255,255,255,0.85)' : tk.textMuted }]}>
        {catLabel}
      </Text>
      {!!cls.invite_code && (
        <View style={[ag.codePill, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : color + '15' }]}>
          <Text style={[ag.codePillTxt, { color: active ? '#fff' : color }]}>#{cls.invite_code}</Text>
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
};
const ag = StyleSheet.create({
  card:        { width:(width-52)/2, alignItems:'center', borderRadius:18, borderWidth:1.5, paddingVertical:20, paddingHorizontal:8, shadowOffset:{width:0,height:4}, shadowOpacity:.12, shadowRadius:10, elevation:4, marginBottom:12 },
  imgRing:     { width:80, height:80, borderRadius:40, borderWidth:2.5, justifyContent:'center', alignItems:'center', marginBottom:12 },
  bigCount:    { fontSize:24, fontWeight:'900', letterSpacing:-1 },
  bigLbl:      { fontSize:9, fontWeight:'700', letterSpacing:.5, marginTop:1 },
  label:       { fontSize:13, fontWeight:'900', letterSpacing:.2, textAlign:'center', paddingHorizontal:6 },
  ageRange:    { fontSize:11, fontWeight:'600', textAlign:'center', marginTop:3 },
  codePill:    { borderRadius:10, paddingHorizontal:8, paddingVertical:3, marginTop:6 },
  codePillTxt: { fontSize:9, fontWeight:'900', letterSpacing:.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — identical to Homescreen
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ title, action, onAction, tk }) => (
  <View style={sh.row}>
    <Text style={[sh.title, { color:tk.textPrimary }]}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.75}>
        <Text style={[sh.action, { color:BLUE }]}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);
const sh = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  title:  { fontSize:18, fontWeight:'800' },
  action: { fontSize:13, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE CLASS MODAL (kept from previous version, restyled to BLUE)
// ─────────────────────────────────────────────────────────────────────────────
const CreateClassModal = ({ visible, onClose, onCreated, teacherEmail, tk, t }) => {
  const [name,     setName]     = useState('');
  const [desc,     setDesc]     = useState('');
  const [category, setCategory] = useState('adult');
  const [loading,  setLoading]  = useState(false);
  const categories = ['adult', 'youth', 'intermediate', 'children'];
  const CATEGORY_LABELS = buildCategoryLabels(t);

  const create = async () => {
    if (!name.trim()) return Alert.alert(t('teach_error', 'Error'), t('teach_class_name_required', 'Class name is required.'));
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/teacher/classes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_email: teacherEmail, name: name.trim(), description: desc.trim(), category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated(data);
      setName(''); setDesc(''); setCategory('adult');
    } catch (e) { Alert.alert(t('teach_error', 'Error'), e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1 }}>
        {/* Backdrop — tap to dismiss */}
        <Pressable style={cm.backdrop} onPress={onClose}>
          {/* Card — stop propagation so tapping inside doesn't dismiss */}
          <Pressable onPress={() => {}} style={[cm.card, { backgroundColor: tk.bg, borderColor: tk.border }]}>
            <View style={cm.head}>
              <Text style={[cm.title, { color: tk.textPrimary }]}>
                {t('teach_create_new_class', 'Create New Class')}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}
                style={[cm.closeBtn, { backgroundColor: tk.surfaceEl || tk.surface }]}>
                <Text style={[cm.closeX, { color: tk.textSec }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[cm.lbl, { color: tk.textMuted }]}>{t('teach_class_name_lbl', 'CLASS NAME')}</Text>
            <TextInput
              style={[cm.input, { backgroundColor: tk.surface, borderColor: tk.border, color: tk.textPrimary }]}
              placeholder={t('teach_class_name_placeholder', 'e.g. Sunday Morning Adults')}
              placeholderTextColor={tk.textMuted}
              value={name} onChangeText={setName}
            />

            <Text style={[cm.lbl, { color: tk.textMuted }]}>{t('teach_description_lbl', 'DESCRIPTION (optional)')}</Text>
            <TextInput
              style={[cm.input, cm.inputMulti, { backgroundColor: tk.surface, borderColor: tk.border, color: tk.textPrimary }]}
              placeholder={t('teach_description_placeholder', 'Brief description...')}
              placeholderTextColor={tk.textMuted}
              value={desc} onChangeText={setDesc}
              multiline numberOfLines={3}
            />

            <Text style={[cm.lbl, { color: tk.textMuted }]}>{t('teach_age_group_lbl', 'AGE GROUP')}</Text>
            <View style={cm.catRow}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat} onPress={() => setCategory(cat)} activeOpacity={0.8}
                  style={[cm.catBtn, { backgroundColor: category === cat ? BLUE : tk.surface, borderColor: category === cat ? BLUE : tk.border }]}
                >
                  <Text style={[cm.catTxt, { color: category === cat ? '#fff' : tk.textSec }]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={cm.btnRow}>
              <TouchableOpacity onPress={onClose} style={[cm.cancelBtn, { borderColor: tk.border }]}>
                <Text style={[cm.cancelTxt, { color: tk.textSec }]}>{t('btn_cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={create} disabled={loading} style={[cm.createBtn, { backgroundColor: BLUE }]}>
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={cm.createTxt}>{t('teach_create_class_btn', 'Create Class')}</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const cm = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  card:      { width: '100%', maxWidth: 420, borderRadius: 22, borderWidth: 1, padding: 22, shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.18, shadowRadius:24, elevation:14 },
  head:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:18 },
  title:     { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, flex: 1 },
  closeBtn:  { width:30, height:30, borderRadius:15, justifyContent:'center', alignItems:'center', marginLeft:12 },
  closeX:    { fontSize:14, fontWeight:'800' },
  lbl:       { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  input:     { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, marginBottom: 18 },
  inputMulti:{ height: 80, textAlignVertical: 'top' },
  catRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  catBtn:    { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8 },
  catTxt:    { fontSize: 12, fontWeight: '800' },
  btnRow:    { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, alignItems: 'center' },
  cancelTxt: { fontSize: 14, fontWeight: '700' },
  createBtn: { flex: 2, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  createTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherDashboard({ navigation }) {
  const { isDark }  = useTheme();
  const { t }       = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherName,  setTeacherName]  = useState('');
  const [classes,      setClasses]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [activeClassId,setActiveClassId]= useState(null);

  // Drains offline attendance/marks to the server. Shows a badge when entries
  // are queued; auto-runs on mount + on network reconnect.
  const { pending, lastResult, lastSyncAt, syncNow, refreshPending } = useTeacherSync();

  // Promo banners — teacher-relevant
  const BANNERS = [
    { id:1, color:BLUE,      emoji:'📋', title: t('teach_mark_attendance', 'Mark Attendance'), sub: t('teach_mark_attendance_sub', 'Record who was present today') },
    { id:2, color:'#10B981', emoji:'👥', title: t('teach_my_classes', 'My Classes'),            sub: `${classes.length} ${t('teach_classes', 'Classes')}` },
    { id:3, color:'#F97316', emoji:'📊', title: t('teach_view_progress', 'View Progress'),     sub: t('teach_view_progress_sub', 'Leaderboard & attendance heatmap') },
    { id:4, color:'#7C3AED', emoji:'⭐', title: t('tmark_bonus_points', 'Bonus Points'),       sub: t('progress_top_learners', 'Top Learners') },
  ];

  useEffect(() => {
    (async () => {
      const email = await AsyncStorage.getItem('userEmail') || '';
      const name  = await AsyncStorage.getItem('userName')  || '';
      setTeacherEmail(email);
      setTeacherName(name);
      fetchClasses(email);
    })();
  }, []);

  const fetchClasses = useCallback(async (email) => {
    if (!email) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/teacher/classes?teacher_email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      // Roster lives in AsyncStorage now — replace the server-side student_count
      // with the locally-stored roster size for each class so the dashboard
      // counts and per-card badges reflect what the teacher actually sees.
      const withLocalCounts = await Promise.all(
        list.map(async (c) => ({ ...c, student_count: await rosterSize(c.id) }))
      );
      setClasses(withLocalCounts);
      if (withLocalCounts.length && !activeClassId) setActiveClassId(withLocalCounts[0].id);
      // Refresh the pending-sync count whenever class data reloads — covers
      // the case where the teacher just added/marked something on another
      // screen and pops back here.
      refreshPending();
    } catch (e) { console.warn('fetchClasses:', e.message); }
    finally { setLoading(false); }
  }, [activeClassId, refreshPending]);

  // Refresh on focus so newly added students/classes show up
  useEffect(() => {
    const unsub = navigation.addListener?.('focus', () => {
      if (teacherEmail) fetchClasses(teacherEmail);
    });
    return unsub;
  }, [navigation, teacherEmail, fetchClasses]);

  const totalStudents = classes.reduce((s, c) => s + parseInt(c.student_count || 0), 0);
  const activeClass   = classes.find(c => c.id === activeClassId) || classes[0];
  const displayName   = teacherName || teacherEmail.split('@')[0] || t('teach_teacher_default', 'Teacher');

  const handleCreated = (cls) => {
    setClasses(prev => [{ ...cls, student_count: 0 }, ...prev]);
    setActiveClassId(cls.id);
    setShowCreate(false);
    Alert.alert(
      t('teach_class_created_title', 'Class Created! 🎉'),
      t('teach_class_created_msg', 'Invite code: {code}\nShare this with your students.').replace('{code}', String(cls.invite_code))
    );
  };

  const goToAttendance = () => {
    if (!activeClass) return Alert.alert(t('teach_no_classes_yet', 'No classes yet'), t('teach_no_classes_msg', 'Create your first class and share the invite code with your students.'));
    navigation.navigate('TeacherMarkSheet', { classId: activeClass.id, className: activeClass.name, teacherEmail });
  };
  const goToProgress = () => {
    if (!activeClass) return Alert.alert(t('teach_no_classes_yet', 'No classes yet'), t('teach_no_classes_msg', 'Create your first class and share the invite code with your students.'));
    navigation.navigate('TeacherClassDetail', { classId: activeClass.id, className: activeClass.name, category: activeClass.category, teacherEmail });
  };

  // Quick access — same 2×2 grid pattern as Homescreen
  const QUICK_ACCESS = [
    { icon:'✓', label: t('teach_mark_attendance', 'Mark Attendance'), sub: t('teach_mark_attendance_sub', 'Record who was present today'), bg:'#ECFDF5', onPress: goToAttendance },
    { icon:'📊', label: t('teach_view_progress', 'View Progress'),    sub: t('teach_view_progress_sub', 'Leaderboard & attendance heatmap'), bg:'#EFF6FF', onPress: goToProgress },
    { icon:'➕', label: t('teach_create_class_btn', 'Create Class'),   sub: t('teach_create_new_class', 'Create New Class'), bg:'#F5F3FF', onPress: () => setShowCreate(true) },
    { icon:'🏛️', label: t('library', 'Library'),                     sub: t('library_sub', 'Switch books · settings'), bg:'#FFF7ED', onPress: () => navigation.navigate('Library') },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor:tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg}/>

      <CreateClassModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        teacherEmail={teacherEmail}
        tk={tk}
        t={t}
      />

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        {/* ── TOP BAR — same as Homescreen ── */}
        <View style={[s.topbar, { backgroundColor:tk.bg }]}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8} style={s.userRow}>
            <View style={[s.avatar, { backgroundColor:BLUE }]}>
              <Text style={s.avatarLetter}>{displayName[0]?.toUpperCase() || 'T'}</Text>
            </View>
            <View>
              <Text style={[s.greeting, { color:tk.textMuted }]}>{t('teach_teacher_tag', 'TEACHER')} 👋</Text>
              <Text style={[s.userName,  { color:tk.textPrimary }]}>{displayName}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.topActions}>
            {/* Sync chip — three states:
                  • pending > 0  → amber pill, tappable to sync now
                  • pending = 0  → tiny "Synced ✓ <time-ago>" text in muted
                  • last sync failed offline → red dot warning
                tapping always re-runs syncNow() so it doubles as a manual button. */}
            <TouchableOpacity
              onPress={async () => {
                const r = await syncNow({ force: true });
                const msg =
                  r.ok                              ? `Synced. Sent ${r.sent.attendance || 0} attendance, ${r.sent.marks || 0} marks.`
                  : r.reason === 'offline'          ? 'You\'re offline. Will sync automatically when you\'re back online.'
                  : r.reason === 'no-data'          ? 'Nothing to sync — everything is up to date.'
                  : r.reason === 'no-teacher-email' ? 'Sign in as a teacher to sync.'
                  : r.code    === 'no_account'      ? 'No teacher account on the server for your email. Tap Sign Out, then Register and choose Teacher with your church invite code.'
                  : r.code    === 'not_a_teacher'   ? 'Your account is registered as a student, not a teacher. Sign out and re-register as a teacher with your church invite code.'
                  : r.code    === 'no_church'       ? 'Your teacher account isn\'t linked to a church yet. Re-register with the invite code your church admin gave you.'
                  : r.reason === 'timeout'          ? 'Sync timed out. Check your connection and try again.'
                  :                                   `Sync failed: ${r.reason}`;
                Alert.alert('Sync', msg);
              }}
              activeOpacity={0.75}
              style={[s.iconBtn, {
                backgroundColor: pending > 0 ? '#F59E0B22' : tk.surfaceEl,
                paddingHorizontal: pending > 0 ? 10 : undefined,
                width: pending > 0 ? undefined : 40,
                flexDirection: 'row', gap: 4,
              }]}>
              <Text style={{ fontSize: 14 }}>
                {pending > 0 ? '☁️↑' : (lastResult?.ok || lastSyncAt ? '☁️✓' : '☁️')}
              </Text>
              {pending > 0 && (
                <Text style={{ fontSize: 11, fontWeight: '900', color: '#F59E0B' }}>
                  {pending}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('HomeScreen')} activeOpacity={0.75}
              style={[s.iconBtn, { backgroundColor:BLUE_LIGHT }]}>
              <Text style={{ fontSize:16 }}>🏠</Text>
            </TouchableOpacity>
            {/* Settings icon replaced with Library — Settings is reachable
                only from the Library home so it covers every book. */}
            <TouchableOpacity onPress={() => navigation.navigate('Library')} activeOpacity={0.75}
              accessibilityLabel="Library"
              style={[s.iconBtn, { backgroundColor:tk.surfaceEl }]}>
              <Text style={{ fontSize:16 }}>🏛️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── PROMO BANNERS ── */}
        <View style={s.bannerSection}>
          <FlatList data={BANNERS} keyExtractor={b=>String(b.id)} horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal:20 }}
            renderItem={({ item }) => <BannerCard item={item}/>}/>
        </View>

        {/* ── SUMMARY CARD ── */}
        <View style={s.section}>
          <SummaryCard
            teacherName={displayName}
            classesCount={classes.length}
            studentsCount={totalStudents}
            tk={tk}
            t={t}
            onPress={() => setShowCreate(true)}
          />
        </View>

        {/* ── MY CLASSES ── */}
        <View style={s.section}>
          <SectionHeader
            title={t('teach_my_classes', 'My Classes')}
            action={classes.length ? `+ ${t('teach_new_class_btn', 'New Class').replace('+  ', '')}` : null}
            onAction={() => setShowCreate(true)}
            tk={tk}
          />
          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={BLUE} size="small"/>
              <Text style={[s.loadingText, { color:tk.textMuted }]}>{t('teach_loading_classes', 'Loading classes…')}</Text>
            </View>
          ) : classes.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor:tk.surface, borderColor:tk.border }]}>
              <Text style={{ fontSize:48, marginBottom:14 }}>🏫</Text>
              <Text style={[s.emptyTitle, { color:tk.textPrimary }]}>{t('teach_no_classes_yet', 'No classes yet')}</Text>
              <Text style={[s.emptySub, { color:tk.textMuted }]}>
                {t('teach_no_classes_msg', 'Create your first class and share the invite code with your students.')}
              </Text>
              <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.85}
                style={[s.emptyBtn, { backgroundColor:BLUE }]}>
                <Text style={s.emptyBtnTxt}>{t('teach_create_first_class', 'Create First Class')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.classGrid}>
              {classes.map((cls, i) => (
                <ClassCard
                  key={cls.id}
                  cls={cls}
                  index={i}
                  active={activeClassId === cls.id}
                  tk={tk}
                  t={t}
                  onPress={() => {
                    setActiveClassId(cls.id);
                    navigation.navigate('TeacherClassDetail', { classId: cls.id, className: cls.name, category: cls.category, teacherEmail });
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── TODAY'S SNAPSHOT (mirrors Homescreen Recent Lessons feed) ── */}
        {classes.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title={t('teach_attendance', 'Attendance')}
              action={t('view_all', 'View All →')}
              onAction={goToProgress}
              tk={tk}
            />
            <View style={[s.card, { backgroundColor:tk.surface, borderColor:tk.border }]}>
              <TouchableOpacity onPress={goToAttendance} activeOpacity={0.7}
                style={[lr.row, { borderBottomColor:tk.border, borderBottomWidth:1 }]}>
                <View style={[lr.iconBox, { backgroundColor:'#ECFDF5' }]}>
                  <Text style={{ fontSize:20 }}>✓</Text>
                </View>
                <View style={lr.mid}>
                  <Text style={[lr.title, { color:tk.textPrimary }]} numberOfLines={1}>
                    {t('teach_mark_attendance', 'Mark Attendance')}
                  </Text>
                  <Text style={[lr.sub, { color:tk.textMuted }]}>
                    {activeClass?.name || ''}
                  </Text>
                </View>
                <View style={[lr.numBadge, { backgroundColor:BLUE_LIGHT }]}>
                  <Text style={[lr.num, { color:BLUE }]}>›</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={goToProgress} activeOpacity={0.7}
                style={[lr.row, { borderBottomColor:tk.border, borderBottomWidth:0 }]}>
                <View style={[lr.iconBox, { backgroundColor:BLUE_LIGHT }]}>
                  <Text style={{ fontSize:20 }}>📊</Text>
                </View>
                <View style={lr.mid}>
                  <Text style={[lr.title, { color:tk.textPrimary }]} numberOfLines={1}>
                    {t('teach_view_progress', 'View Progress')}
                  </Text>
                  <Text style={[lr.sub, { color:tk.textMuted }]}>
                    {totalStudents} {t('teach_students_lbl', 'students')}
                  </Text>
                </View>
                <View style={[lr.numBadge, { backgroundColor:BLUE_LIGHT }]}>
                  <Text style={[lr.num, { color:BLUE }]}>›</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── QUICK ACCESS — same 2×2 grid as Homescreen ── */}
        <View style={s.section}>
          <SectionHeader title={t('quick_access', 'Quick Actions')} tk={tk}/>
          <View style={s.qaGrid}>
            {QUICK_ACCESS.map((item, i) => (
              <TouchableOpacity key={i} onPress={item.onPress} activeOpacity={0.78}
                style={[s.qaItem, { backgroundColor:tk.surface, borderColor:tk.border }]}>
                <View style={[s.qaIcon, { backgroundColor: isDark ? tk.surfaceEl : item.bg }]}>
                  <Text style={{ fontSize:26 }}>{item.icon}</Text>
                </View>
                <Text style={[s.qaLabel, { color:tk.textPrimary }]}>{item.label}</Text>
                <Text style={[s.qaSub,   { color:tk.textMuted }]}>{item.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── FOOTER — same as Homescreen ── */}
        <View style={s.footer}>
          <Text style={[s.footerTxt, { color:tk.textMuted }]}>{t('login_footer', '© Gospelar Sunday School Department')}</Text>
          <Text style={[s.footerSite, { color:BLUE }]}>www.gospelar.com</Text>
        </View>

      </Animated.ScrollView>

      {/* ── BOTTOM TAB BAR — same component / same SVG icons as Homescreen
          Settings tab removed — Settings lives on the Library home only. */}
      <AppTabBar
        activeTab={1}
        onTab={(i) => {
          if (i === 0) navigation.navigate('HomeScreen');
          if (i === 1) {/* already here */}
          if (i === 2) goToAttendance();
          if (i === 3) goToProgress();
        }}
        tk={tk}
        tabs={[
          { key:'Home',       label: t('tab_home',          'Home')     },
          { key:'Classes',    label: t('teach_tab_classes', 'Classes')  },
          { key:'Attendance', label: t('teach_tab_attend',  'Attend')   },
          { key:'Progress',   label: t('teach_tab_progress','Progress') },
        ]}
      />
    </SafeAreaView>
  );
}

// Lesson row sub-styles — same as Homescreen LessonRow
const lr = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:16 },
  iconBox:  { width:44, height:44, borderRadius:13, justifyContent:'center', alignItems:'center', marginRight:14 },
  mid:      { flex:1, marginRight:10 },
  title:    { fontSize:14, fontWeight:'600', marginBottom:3 },
  sub:      { fontSize:12 },
  numBadge: { borderRadius:10, paddingHorizontal:10, paddingVertical:6 },
  num:      { fontSize:14, fontWeight:'900' },
});

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:         { flex:1 },
  scrollContent:{ paddingBottom:110 },

  // Top bar
  topbar:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:10, paddingBottom:20 },
  userRow:      { flexDirection:'row', alignItems:'center', gap:12 },
  avatar:       { width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center' },
  avatarLetter: { color:'#fff', fontSize:17, fontWeight:'900' },
  greeting:     { fontSize:11, fontWeight:'700', marginBottom:2, letterSpacing:1 },
  userName:     { fontSize:17, fontWeight:'900' },
  topActions:   { flexDirection:'row', gap:8 },
  iconBtn:      { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },

  // Banners
  bannerSection:{ marginBottom:28 },

  // Sections
  section:      { paddingHorizontal:20, marginBottom:28 },

  // Class grid (2-col like Homescreen age-group)
  classGrid:    { flexDirection:'row', flexWrap:'wrap', gap:12 },

  // Loading + empty
  loadingBox:   { padding:32, alignItems:'center', gap:10, borderRadius:18, borderWidth:1, borderColor:'transparent' },
  loadingText:  { fontSize:13 },
  emptyCard:    { borderRadius:18, borderWidth:1, padding:32, alignItems:'center' },
  emptyTitle:   { fontSize:18, fontWeight:'900', marginBottom:8 },
  emptySub:     { fontSize:13, textAlign:'center', lineHeight:20, marginBottom:20 },
  emptyBtn:     { borderRadius:14, paddingHorizontal:24, paddingVertical:12 },
  emptyBtnTxt:  { color:'#fff', fontSize:14, fontWeight:'800' },

  // Card (for "Today's Snapshot")
  card:         { borderRadius:18, borderWidth:1, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },

  // Quick access 2×2 grid
  qaGrid:   { flexDirection:'row', flexWrap:'wrap', gap:14 },
  qaItem:   { width:(width-54)/2, borderRadius:18, borderWidth:1, padding:18, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:8, elevation:1 },
  qaIcon:   { width:52, height:52, borderRadius:16, justifyContent:'center', alignItems:'center', marginBottom:12 },
  qaLabel:  { fontSize:15, fontWeight:'800', marginBottom:4 },
  qaSub:    { fontSize:12, lineHeight:17 },

  // Footer
  footer:    { alignItems:'center', paddingHorizontal:20, paddingTop:8, paddingBottom:10 },
  footerTxt: { fontSize:11, marginBottom:5 },
  footerSite:{ fontSize:12, fontWeight:'800' },
});
