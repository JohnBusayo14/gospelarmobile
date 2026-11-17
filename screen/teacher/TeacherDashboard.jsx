// screens/teacher/TeacherDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The teacher's home. Same design language as the Library and sign-in screens
// (theme/tokens, vector ICONS, no emoji, dark-mode aware):
//
//   • Header        — avatar, time-of-day greeting, Home / Library buttons
//   • Hero          — gradient card with live class / student counts + New class
//   • Sync status   — offline marks/attendance waiting to upload, one tap to sync
//   • Quick actions — Attendance · Progress · New class · Library
//   • Spotlight     — the selected class: shareable invite code + two big actions
//   • My classes    — a row per class (student count ring, age group, code)
//   • Empty state   — 3-step "get started" guide for a teacher with no classes
//
// Data, offline queue and navigation are unchanged from the previous version.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator,
  TextInput, Modal, Alert, Pressable, KeyboardAvoidingView, Platform, Share,
  Animated, useWindowDimensions,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { useTheme }       from '../../context/ThemeContext';
import { useLanguage }    from '../../context/LanguageContext';
import { useTeacherSync } from '../../services/syncWorker';
import { API_BASE_URL }   from '../../services/api';
import AppTabBar          from '../../components/AppTabBar';
import { ICONS }          from '../../components/icons';
import { rosterSize }     from '../../services/teacherLocal';
import { getTokens, type, space, radii } from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';

const API  = API_BASE_URL;
const BLUE = '#1A56DB';
const AMBER = '#F59E0B';

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

// Hex + alpha helper: tint('#7C3AED', 0.12) → '#7C3AED1F'
const tint = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

// ─────────────────────────────────────────────────────────────────────────────
// Small pieces
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ title, action, onAction, tk }) => (
  <View style={st.sectionHead}>
    <Text style={[type.h2, { color: tk.textPrimary }]}>{title}</Text>
    {!!action && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.75} hitSlop={10}
        style={st.sectionAction} accessibilityRole="button">
        <Text style={{ color: BLUE, fontSize: 13, fontWeight: '800' }}>{action}</Text>
        <ICONS.ChevronRight color={BLUE} size={14} sw={2.6} />
      </TouchableOpacity>
    )}
  </View>
);

const ActionTile = ({ Icon, label, color, onPress, tk, index }) => {
  const { fade, translateY } = useStaggerEntry(index);
  return (
    <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button"
        accessibilityLabel={label}
        style={[st.tile, { backgroundColor: tk.surface, borderColor: tk.border }]}>
        <LinearGradient colors={[color, tint(color, 0.72)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={st.tileIcon}>
          <Icon color="#fff" size={22} sw={2.2} />
        </LinearGradient>
        <Text style={[st.tileLabel, { color: tk.textPrimary }]} numberOfLines={2}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// A row per class — student ring on the left, details, chevron.
const ClassRow = ({ cls, active, onPress, tk, t, index = 0 }) => {
  const color    = CATEGORY_COLORS[cls.category] || BLUE;
  const catLabel = buildCategoryLabels(t)[cls.category] || cls.category || t('teach_class', 'Class');
  const count    = parseInt(cls.student_count || 0, 10);
  const { fade, translateY } = useStaggerEntry(index);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.82} accessibilityRole="button"
        accessibilityLabel={`${cls.name}, ${count} ${t('teach_students_lbl', 'students')}`}
        style={[st.classRow, {
          backgroundColor: tk.surface,
          borderColor: active ? color : tk.border,
          borderWidth: active ? 1.5 : 1,
        }]}>
        <View style={[st.classStripe, { backgroundColor: color }]} />
        <View style={[st.countRing, { borderColor: tint(color, 0.35), backgroundColor: tint(color, 0.1) }]}>
          <Text style={[st.countNum, { color }]}>{count}</Text>
          <Text style={[st.countLbl, { color }]}>{t('teach_students_lbl', 'students').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginHorizontal: space.md }}>
          <Text style={[type.h3, { color: tk.textPrimary }]} numberOfLines={1}>{cls.name}</Text>
          <View style={st.metaRow}>
            <View style={[st.chip, { backgroundColor: tint(color, 0.14) }]}>
              <Text style={[st.chipTxt, { color }]}>{catLabel}</Text>
            </View>
            {!!cls.invite_code && (
              <Text style={[st.codeTxt, { color: tk.textMuted }]}>#{cls.invite_code}</Text>
            )}
          </View>
        </View>
        <ICONS.ChevronRight color={tk.textMuted} size={20} sw={2.2} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Create-class dialog
// ─────────────────────────────────────────────────────────────────────────────
const CreateClassModal = ({ visible, onClose, onCreated, teacherEmail, tk, t }) => {
  const [name,     setName]     = useState('');
  const [desc,     setDesc]     = useState('');
  const [category, setCategory] = useState('adult');
  const [loading,  setLoading]  = useState(false);
  const categories = ['adult', 'youth', 'intermediate', 'children'];
  const labels = buildCategoryLabels(t);

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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={cm.backdrop} onPress={onClose}>
          <Pressable onPress={() => {}} style={[cm.card, { backgroundColor: tk.bg, borderColor: tk.border }]}>
            <View style={cm.head}>
              <LinearGradient colors={[BLUE, '#3B82F6']} style={cm.headIcon}>
                <ICONS.Plus color="#fff" size={20} sw={2.6} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[type.h2, { color: tk.textPrimary }]}>{t('teach_create_new_class', 'Create New Class')}</Text>
                <Text style={[type.caption, { color: tk.textMuted, marginTop: 2 }]}>
                  {t('teach_create_hint', 'Students join with the invite code.')}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={t('btn_cancel', 'Cancel')}
                style={[cm.closeBtn, { backgroundColor: tk.surfaceEl }]}>
                <ICONS.X color={tk.textSec} size={16} sw={2.6} />
              </TouchableOpacity>
            </View>

            <Text style={[type.label, { color: tk.textMuted, marginBottom: 8 }]}>{t('teach_class_name_lbl', 'CLASS NAME')}</Text>
            <TextInput
              style={[cm.input, { backgroundColor: tk.surface, borderColor: tk.border, color: tk.textPrimary }]}
              placeholder={t('teach_class_name_placeholder', 'e.g. Sunday Morning Adults')}
              placeholderTextColor={tk.textMuted}
              value={name} onChangeText={setName}
            />

            <Text style={[type.label, { color: tk.textMuted, marginBottom: 8 }]}>{t('teach_description_lbl', 'DESCRIPTION (optional)')}</Text>
            <TextInput
              style={[cm.input, cm.inputMulti, { backgroundColor: tk.surface, borderColor: tk.border, color: tk.textPrimary }]}
              placeholder={t('teach_description_placeholder', 'Brief description...')}
              placeholderTextColor={tk.textMuted}
              value={desc} onChangeText={setDesc}
              multiline numberOfLines={3}
            />

            <Text style={[type.label, { color: tk.textMuted, marginBottom: 8 }]}>{t('teach_age_group_lbl', 'AGE GROUP')}</Text>
            <View style={cm.catRow}>
              {categories.map((cat) => {
                const on = category === cat, c = CATEGORY_COLORS[cat];
                return (
                  <TouchableOpacity key={cat} onPress={() => setCategory(cat)} activeOpacity={0.8}
                    style={[cm.catBtn, { backgroundColor: on ? c : tk.surface, borderColor: on ? c : tk.border }]}>
                    {on && <ICONS.Check color="#fff" size={14} sw={3} />}
                    <Text style={[cm.catTxt, { color: on ? '#fff' : tk.textSec }]}>{labels[cat]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={cm.btnRow}>
              <TouchableOpacity onPress={onClose} style={[cm.cancelBtn, { borderColor: tk.border }]}>
                <Text style={{ color: tk.textSec, fontSize: 14, fontWeight: '700' }}>{t('btn_cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={create} disabled={loading} activeOpacity={0.85}
                style={[cm.createBtn, { backgroundColor: BLUE, opacity: loading ? 0.7 : 1 }]}>
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{t('teach_create_class_btn', 'Create Class')}</Text>}
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
  card:      { width: '100%', maxWidth: 440, borderRadius: radii['2xl'], borderWidth: 1, padding: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 26, elevation: 16 },
  head:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  headIcon:  { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  closeBtn:  { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  input:     { borderRadius: radii.md, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, marginBottom: 18 },
  inputMulti:{ height: 80, textAlignVertical: 'top' },
  catRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  catBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.md, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 9 },
  catTxt:    { fontSize: 12.5, fontWeight: '800' },
  btnRow:    { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderRadius: radii.md, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  createBtn: { flex: 2, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherDashboard({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  useWindowDimensions();   // re-render on rotation / split-screen

  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherName,  setTeacherName]  = useState('');
  const [classes,      setClasses]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [activeClassId, setActiveClassId] = useState(null);
  const [syncing,      setSyncing]      = useState(false);

  // Drains offline attendance/marks to the server; auto-runs on mount and on
  // reconnect. `pending` = entries still queued on this phone.
  const { pending, lastResult, lastSyncAt, syncNow, refreshPending } = useTeacherSync();

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
    if (!email) { setLoading(false); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/teacher/classes?teacher_email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      // Roster lives on the phone — show the locally stored roster size.
      const withLocalCounts = await Promise.all(
        list.map(async (c) => ({ ...c, student_count: await rosterSize(c.id) }))
      );
      setClasses(withLocalCounts);
      if (withLocalCounts.length && !activeClassId) setActiveClassId(withLocalCounts[0].id);
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

  const totalStudents = classes.reduce((s, c) => s + parseInt(c.student_count || 0, 10), 0);
  const activeClass   = classes.find((c) => c.id === activeClassId) || classes[0];
  const displayName   = teacherName || teacherEmail.split('@')[0] || t('teach_teacher_default', 'Teacher');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greet_morning', 'Good morning')
                 : hour < 17 ? t('greet_afternoon', 'Good afternoon')
                 :             t('greet_evening', 'Good evening');

  const handleCreated = (cls) => {
    setClasses((prev) => [{ ...cls, student_count: 0 }, ...prev]);
    setActiveClassId(cls.id);
    setShowCreate(false);
    Alert.alert(
      t('teach_class_created_title', 'Class Created!'),
      t('teach_class_created_msg', 'Invite code: {code}\nShare this with your students.').replace('{code}', String(cls.invite_code)),
    );
  };

  const needClass = () => Alert.alert(
    t('teach_no_classes_yet', 'No classes yet'),
    t('teach_no_classes_msg', 'Create your first class and share the invite code with your students.'),
  );
  const goToAttendance = () => {
    if (!activeClass) return needClass();
    navigation.navigate('TeacherMarkSheet', { classId: activeClass.id, className: activeClass.name, teacherEmail });
  };
  const goToProgress = () => {
    if (!activeClass) return needClass();
    navigation.navigate('TeacherClassDetail', { classId: activeClass.id, className: activeClass.name, category: activeClass.category, teacherEmail });
  };

  const shareCode = async (cls) => {
    try {
      await Share.share({
        message: t('teach_share_msg', 'Join my Sunday School class "{name}" on Gospelar. Invite code: {code}')
          .replace('{name}', cls.name).replace('{code}', String(cls.invite_code)),
      });
    } catch { /* user dismissed */ }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
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
    } finally { setSyncing(false); }
  };

  const synced = pending === 0;
  const syncColor = synced ? '#10B981' : AMBER;

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <CreateClassModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        teacherEmail={teacherEmail}
        tk={tk}
        t={t}
      />

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        {/* ── HEADER ── */}
        <View style={st.topbar}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}
            style={st.userRow} accessibilityRole="button" accessibilityLabel={t('profile', 'Profile')}>
            <LinearGradient colors={[BLUE, '#3B82F6']} style={st.avatar}>
              <Text style={st.avatarLetter}>{displayName[0]?.toUpperCase() || 'T'}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[type.caption, { color: tk.textMuted }]}>{greeting}</Text>
              <Text style={[type.h2, { color: tk.textPrimary }]} numberOfLines={1}>{displayName}</Text>
            </View>
          </TouchableOpacity>
          <View style={st.topActions}>
            <TouchableOpacity onPress={() => navigation.navigate('HomeScreen')} activeOpacity={0.75}
              accessibilityLabel={t('tab_home', 'Home')} hitSlop={6}
              style={[st.iconBtn, { backgroundColor: tint(BLUE, 0.1) }]}>
              <ICONS.Home color={BLUE} size={19} sw={2.2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Library')} activeOpacity={0.75}
              accessibilityLabel={t('library', 'Library')} hitSlop={6}
              style={[st.iconBtn, { backgroundColor: tk.surfaceEl }]}>
              <ICONS.BookStack color={tk.textPrimary} size={19} sw={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── HERO ── */}
        <View style={st.section}>
          <LinearGradient colors={['#1E3A8A', BLUE, '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={st.hero}>
            <View style={[st.orb, { width: 190, height: 190, top: -70, right: -50, opacity: 0.14 }]} />
            <View style={[st.orb, { width: 110, height: 110, bottom: -40, left: -30, opacity: 0.10 }]} />

            <View style={st.heroPill}>
              <ICONS.Classes color="#fff" size={13} sw={2.4} />
              <Text style={st.heroPillTxt}>{t('teach_dashboard_title', 'Teacher Dashboard').toUpperCase()}</Text>
            </View>
            <Text style={st.heroTitle}>
              {t('teach_hero_title', 'Shape young lives, one class at a time')}
            </Text>

            <View style={st.heroStats}>
              <View style={st.heroStat}>
                <Text style={st.heroStatNum}>{classes.length}</Text>
                <Text style={st.heroStatLbl}>{t('teach_classes', 'Classes')}</Text>
              </View>
              <View style={st.heroDivider} />
              <View style={st.heroStat}>
                <Text style={st.heroStatNum}>{totalStudents}</Text>
                <Text style={st.heroStatLbl}>{t('teach_students_lbl', 'students')}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.85}
                accessibilityRole="button" style={st.heroBtn}>
                <ICONS.Plus color={BLUE} size={16} sw={2.8} />
                <Text style={st.heroBtnTxt}>{t('teach_new_class_short', 'New class')}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── SYNC STATUS ── */}
        <View style={st.section}>
          <TouchableOpacity onPress={runSync} disabled={syncing} activeOpacity={0.8} accessibilityRole="button"
            accessibilityLabel={synced ? t('teach_all_synced', 'All synced') : t('teach_sync_now', 'Sync now')}
            style={[st.syncCard, { backgroundColor: tint(syncColor, isDark ? 0.14 : 0.09), borderColor: tint(syncColor, 0.35) }]}>
            <View style={[st.syncIcon, { backgroundColor: tint(syncColor, 0.2) }]}>
              {syncing
                ? <ActivityIndicator size="small" color={syncColor} />
                : synced
                  ? <ICONS.CheckCircle color={syncColor} size={20} sw={2.4} />
                  : <ICONS.Cloud color={syncColor} size={20} sw={2.4} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: tk.textPrimary }]}>
                {synced
                  ? t('teach_all_synced', 'All synced')
                  : `${pending} ${t('teach_waiting_sync', 'waiting to upload')}`}
              </Text>
              <Text style={[type.caption, { color: tk.textMuted, marginTop: 2 }]} numberOfLines={1}>
                {synced
                  ? (lastSyncAt || lastResult?.ok
                      ? t('teach_synced_sub', 'Attendance and marks are safely saved.')
                      : t('teach_works_offline', 'Works offline — saves automatically when you\'re online.'))
                  : t('teach_tap_to_sync', 'Tap to upload now. It also happens automatically.')}
              </Text>
            </View>
            <View style={[st.syncBtn, { backgroundColor: syncColor }]}>
              <ICONS.RefreshCw color="#fff" size={14} sw={2.6} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={st.section}>
          <SectionHeader title={t('quick_access', 'Quick Actions')} tk={tk} />
          <View style={st.tileRow}>
            <ActionTile index={0} Icon={ICONS.Attendance} color="#10B981" tk={tk}
              label={t('teach_tab_attend', 'Attendance')} onPress={goToAttendance} />
            <ActionTile index={1} Icon={ICONS.Progress} color={BLUE} tk={tk}
              label={t('teach_tab_progress', 'Progress')} onPress={goToProgress} />
            <ActionTile index={2} Icon={ICONS.Plus} color="#7C3AED" tk={tk}
              label={t('teach_new_class_short', 'New class')} onPress={() => setShowCreate(true)} />
            <ActionTile index={3} Icon={ICONS.BookStack} color="#F97316" tk={tk}
              label={t('library', 'Library')} onPress={() => navigation.navigate('Library')} />
          </View>
        </View>

        {/* ── SPOTLIGHT: selected class ── */}
        {!loading && !!activeClass && (() => {
          const color = CATEGORY_COLORS[activeClass.category] || BLUE;
          const catLabel = buildCategoryLabels(t)[activeClass.category] || '';
          return (
            <View style={st.section}>
              <LinearGradient colors={[color, tint(color, 0.78)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={st.spot}>
                <View style={[st.orb, { width: 150, height: 150, top: -60, right: -40, opacity: 0.14 }]} />
                <Text style={st.spotEyebrow}>{t('teach_selected_class', 'SELECTED CLASS').toUpperCase()}</Text>
                <Text style={st.spotName} numberOfLines={1}>{activeClass.name}</Text>
                <Text style={st.spotSub}>
                  {catLabel} · {parseInt(activeClass.student_count || 0, 10)} {t('teach_students_lbl', 'students')}
                </Text>

                {!!activeClass.invite_code && (
                  <View style={st.codeBox}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.codeLabel}>{t('teach_invite_code', 'INVITE CODE')}</Text>
                      <Text style={st.codeValue} selectable>{activeClass.invite_code}</Text>
                    </View>
                    <TouchableOpacity onPress={() => shareCode(activeClass)} activeOpacity={0.85}
                      accessibilityRole="button" accessibilityLabel={t('teach_share_code', 'Share invite code')}
                      style={st.shareBtn}>
                      <ICONS.Share color={color} size={16} sw={2.4} />
                      <Text style={[st.shareTxt, { color }]}>{t('teach_share', 'Share')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={st.spotBtns}>
                  <TouchableOpacity onPress={goToAttendance} activeOpacity={0.85} style={st.spotPrimary}
                    accessibilityRole="button">
                    <ICONS.Attendance color={color} size={18} sw={2.4} />
                    <Text style={[st.spotPrimaryTxt, { color }]}>{t('teach_mark_attendance', 'Mark Attendance')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={goToProgress} activeOpacity={0.85} style={st.spotGhost}
                    accessibilityRole="button">
                    <ICONS.Progress color="#fff" size={18} sw={2.4} />
                    <Text style={st.spotGhostTxt}>{t('teach_view_progress', 'View Progress')}</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          );
        })()}

        {/* ── MY CLASSES ── */}
        <View style={st.section}>
          <SectionHeader
            title={t('teach_my_classes', 'My Classes')}
            action={classes.length ? t('teach_new_class_short', 'New class') : null}
            onAction={() => setShowCreate(true)}
            tk={tk}
          />
          {loading ? (
            <View style={st.loadingBox}>
              <ActivityIndicator color={BLUE} size="small" />
              <Text style={[type.sub, { color: tk.textMuted }]}>{t('teach_loading_classes', 'Loading classes…')}</Text>
            </View>
          ) : classes.length === 0 ? (
            <View style={[st.emptyCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
              <LinearGradient colors={[BLUE, '#3B82F6']} style={st.emptyIcon}>
                <ICONS.Classes color="#fff" size={34} sw={2} />
              </LinearGradient>
              <Text style={[type.h2, { color: tk.textPrimary, textAlign: 'center' }]}>
                {t('teach_no_classes_yet', 'No classes yet')}
              </Text>
              <Text style={[type.sub, { color: tk.textMuted, textAlign: 'center', marginTop: 6 }]}>
                {t('teach_no_classes_msg', 'Create your first class and share the invite code with your students.')}
              </Text>

              <View style={st.steps}>
                {[
                  [ICONS.Plus,       t('teach_step1', 'Create a class')],
                  [ICONS.Share,      t('teach_step2', 'Share the invite code')],
                  [ICONS.Attendance, t('teach_step3', 'Mark attendance each Sunday')],
                ].map(([Ic, label], i) => (
                  <View key={i} style={st.step}>
                    <View style={[st.stepNum, { backgroundColor: tint(BLUE, 0.12) }]}>
                      <Ic color={BLUE} size={15} sw={2.6} />
                    </View>
                    <Text style={[type.body, { color: tk.textSec, flex: 1 }]}>{label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.85} style={st.emptyBtn}
                accessibilityRole="button">
                <ICONS.Plus color="#fff" size={17} sw={2.8} />
                <Text style={st.emptyBtnTxt}>{t('teach_create_first_class', 'Create First Class')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: space.md }}>
              {classes.map((cls, i) => (
                <ClassRow
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

        {/* ── FOOTER ── */}
        <View style={st.footer}>
          <Text style={[type.caption, { color: tk.textMuted, marginBottom: 4 }]}>
            {t('login_footer', '© Gospelar Sunday School Department')}
          </Text>
          <Text style={{ color: BLUE, fontSize: 12, fontWeight: '800' }}>www.gospelar.com</Text>
        </View>
      </Animated.ScrollView>

      <AppTabBar
        activeTab={1}
        onTab={(i) => {
          if (i === 0) navigation.navigate('HomeScreen');
          if (i === 2) goToAttendance();
          if (i === 3) goToProgress();
        }}
        tk={tk}
        tabs={[
          { key: 'Home',       label: t('tab_home',           'Home')     },
          { key: 'Classes',    label: t('teach_tab_classes',  'Classes')  },
          { key: 'Attendance', label: t('teach_tab_attend',   'Attend')   },
          { key: 'Progress',   label: t('teach_tab_progress', 'Progress') },
        ]}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:          { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  section:       { paddingHorizontal: space.xl, marginBottom: space['2xl'] },

  // Header
  topbar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: 10, paddingBottom: space.xl },
  userRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  avatar:     { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarLetter:{ color: '#fff', fontSize: 19, fontWeight: '900' },
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn:    { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },

  // Section header
  sectionHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  // Hero
  hero:        { borderRadius: radii['2xl'], padding: 22, overflow: 'hidden' },
  orb:         { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  heroPill:    { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 6 },
  heroPillTxt: { color: '#fff', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle:   { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4, lineHeight: 28, marginTop: 14, marginBottom: 20, maxWidth: '88%' },
  heroStats:   { flexDirection: 'row', alignItems: 'center' },
  heroStat:    { alignItems: 'flex-start' },
  heroStatNum: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  heroStatLbl: { color: 'rgba(255,255,255,0.78)', fontSize: 11.5, fontWeight: '700', marginTop: 1 },
  heroDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.28)', marginHorizontal: 18 },
  heroBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: radii.full, paddingHorizontal: 16, paddingVertical: 11 },
  heroBtnTxt:  { color: BLUE, fontSize: 13.5, fontWeight: '900' },

  // Sync card
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radii.xl, borderWidth: 1, padding: 14 },
  syncIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  syncBtn:  { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },

  // Quick action tiles
  tileRow:   { flexDirection: 'row', gap: 10 },
  tile:      { alignItems: 'center', borderRadius: radii.xl, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 6, minHeight: 112 },
  tileIcon:  { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  tileLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center' },

  // Spotlight
  spot:           { borderRadius: radii['2xl'], padding: 22, overflow: 'hidden' },
  spotEyebrow:    { color: 'rgba(255,255,255,0.8)', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4 },
  spotName:       { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 6 },
  spotSub:        { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 3, marginBottom: 16 },
  codeBox:        { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radii.lg, padding: 14, marginBottom: 14 },
  codeLabel:      { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  codeValue:      { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 4, marginTop: 2 },
  shareBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 10 },
  shareTxt:       { fontSize: 13, fontWeight: '900' },
  spotBtns:       { flexDirection: 'row', gap: 10 },
  spotPrimary:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#fff', borderRadius: radii.md, paddingVertical: 13 },
  spotPrimaryTxt: { fontSize: 13, fontWeight: '900' },
  spotGhost:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radii.md, paddingVertical: 13 },
  spotGhostTxt:   { color: '#fff', fontSize: 13, fontWeight: '900' },

  // Class rows
  classRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: radii.xl, padding: 14, paddingLeft: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  classStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  countRing:   { width: 62, height: 62, borderRadius: 31, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  countNum:    { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, lineHeight: 22 },
  countLbl:    { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  chip:        { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 3 },
  chipTxt:     { fontSize: 11, fontWeight: '800' },
  codeTxt:     { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6 },

  // Loading + empty
  loadingBox: { padding: 32, alignItems: 'center', gap: 10 },
  emptyCard:  { borderRadius: radii['2xl'], borderWidth: 1, padding: 26, alignItems: 'center' },
  emptyIcon:  { width: 76, height: 76, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  steps:      { alignSelf: 'stretch', gap: 12, marginTop: 22, marginBottom: 22 },
  step:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum:    { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: BLUE, borderRadius: radii.md, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnTxt:{ color: '#fff', fontSize: 14.5, fontWeight: '900' },

  // Footer
  footer: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: 4, paddingBottom: 10 },
});
