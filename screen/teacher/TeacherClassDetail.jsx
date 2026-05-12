// screens/teacher/TeacherClassDetail.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Progress page — redesigned to match Homescreen / TeacherDashboard:
//   • Topbar (back + class name + share)
//   • Hero summary card (students count, top score, attendance avg)
//   • Tab pills: Roster · Leaderboard · Heatmap
//   • Roster tab — list with Add/Remove
//   • Leaderboard tab — clean ranked rows with progress bars
//   • Heatmap tab — 13-lesson presence grid per student
//   • Bottom: shared AppTabBar (Progress active)
// Centered AddStudent modal with backdrop tap-to-close.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, TextInput, Modal,
  Share, Alert, Platform, Pressable, KeyboardAvoidingView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }     from '../../context/ThemeContext';
import { useLanguage }  from '../../context/LanguageContext';
import AppTabBar        from '../../components/AppTabBar';
import {
  loadClass, addStudent, removeStudent,
  getAllAttendance, getProgress,
} from '../../services/teacherLocal';
import { getTokens } from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';

// ── Design tokens — IDENTICAL to Homescreen / TeacherDashboard ───────────────
const BLUE       = '#1A56DB';
const BLUE_LIGHT = '#EFF6FF';

const TABS = [
  { key:'roster',      label:'Roster' },
  { key:'leaderboard', label:'Leaderboard' },
  { key:'attendance',  label:'Heatmap' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ADD-STUDENT MODAL — name primary (required), email optional, tap-outside-close
// ─────────────────────────────────────────────────────────────────────────────
const AddStudentModal = ({ visible, onClose, onAdded, classId, tk }) => {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const submit = async () => {
    const trimmedName  = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName)                                                   return setError('Enter the student\'s name.');
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return setError('That email doesn\'t look right.');
    setError('');
    setLoading(true);
    try {
      const student = await addStudent(classId, { name: trimmedName, email: trimmedEmail || undefined });
      setName(''); setEmail('');
      onAdded?.(student);
      onClose?.();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1 }}>
        <Pressable style={asm.backdrop} onPress={onClose}>
          <Pressable onPress={() => {}} style={[asm.card, { backgroundColor: tk.bg, borderColor: tk.border }]}>
            <View style={asm.head}>
              <Text style={[asm.title, { color: tk.textPrimary }]}>Add Student</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}
                style={[asm.closeBtn, { backgroundColor: tk.surface }]}>
                <Text style={[asm.closeX, { color: tk.textSec }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[asm.sub, { color: tk.textMuted }]}>
              Type the student's name. They'll appear in your roster right away — no account needed.
            </Text>

            <Text style={[asm.lbl, { color: tk.textMuted }]}>STUDENT NAME</Text>
            <TextInput
              style={[asm.input, {
                backgroundColor: tk.surface,
                borderColor: error && !name.trim() ? '#EF4444' : tk.border,
                color: tk.textPrimary,
              }]}
              placeholder="e.g. Funmi Adebayo"
              placeholderTextColor={tk.textMuted}
              value={name}
              onChangeText={(v) => { setName(v); setError(''); }}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />

            <Text style={[asm.lbl, { color: tk.textMuted, marginTop: 14 }]}>EMAIL (OPTIONAL)</Text>
            <TextInput
              style={[asm.input, {
                backgroundColor: tk.surface,
                borderColor: error && email.trim() ? '#EF4444' : tk.border,
                color: tk.textPrimary,
              }]}
              placeholder="student@example.com"
              placeholderTextColor={tk.textMuted}
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!error && <Text style={asm.err}>⚠  {error}</Text>}

            <View style={asm.btnRow}>
              <TouchableOpacity onPress={onClose} disabled={loading}
                style={[asm.cancelBtn, { borderColor: tk.border }]}>
                <Text style={[asm.cancelTxt, { color: tk.textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submit} disabled={loading}
                style={[asm.primaryBtn, { backgroundColor: BLUE, opacity: loading ? 0.7 : 1 }]}>
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={asm.primaryTxt}>Add to Class</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const asm = StyleSheet.create({
  backdrop:  { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center', paddingHorizontal:20 },
  card:      { width:'100%', maxWidth:420, borderRadius:22, borderWidth:1, padding:22, shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.18, shadowRadius:24, elevation:14 },
  head:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  title:     { fontSize:20, fontWeight:'900', letterSpacing:-0.3, flex:1 },
  closeBtn:  { width:30, height:30, borderRadius:15, justifyContent:'center', alignItems:'center', marginLeft:12 },
  closeX:    { fontSize:14, fontWeight:'800' },
  sub:       { fontSize:13, lineHeight:19, marginBottom:18 },
  lbl:       { fontSize:10, fontWeight:'800', letterSpacing:1.5, marginBottom:8 },
  input:     { borderRadius:14, borderWidth:1.5, paddingHorizontal:16, paddingVertical:13, fontSize:15, marginBottom:10 },
  err:       { color:'#EF4444', fontSize:12, fontWeight:'700', marginBottom:14 },
  btnRow:    { flexDirection:'row', gap:12, marginTop:6 },
  cancelBtn: { flex:1, borderRadius:14, borderWidth:1.5, paddingVertical:13, alignItems:'center' },
  cancelTxt: { fontSize:14, fontWeight:'700' },
  primaryBtn:{ flex:2, borderRadius:14, paddingVertical:13, alignItems:'center' },
  primaryTxt:{ color:'#fff', fontSize:14, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD ROW — clean, soft card, progress bar
// ─────────────────────────────────────────────────────────────────────────────
const RankBadge = ({ rank, tk }) => {
  const config = rank === 1 ? { bg:'#FEF3C7', color:'#F59E0B', emoji:'🥇' }
               : rank === 2 ? { bg:'#F1F5F9', color:'#64748B', emoji:'🥈' }
               : rank === 3 ? { bg:'#FFF7ED', color:'#F97316', emoji:'🥉' }
               : { bg: tk.surfaceEl, color: tk.textSec, emoji: null };
  return (
    <View style={[rb.badge, { backgroundColor: config.bg }]}>
      {config.emoji
        ? <Text style={{ fontSize: 18 }}>{config.emoji}</Text>
        : <Text style={[rb.num, { color: config.color }]}>#{rank}</Text>}
    </View>
  );
};
const rb = StyleSheet.create({
  badge: { width:38, height:38, borderRadius:11, justifyContent:'center', alignItems:'center' },
  num:   { fontSize:13, fontWeight:'900' },
});

const LeaderboardRow = ({ student, rank, total, tk, index = 0 }) => {
  const teacherPoints = parseInt(student.teacher_points || 0);
  const attended      = parseInt(student.lessons_attended || 0);
  const marked        = parseInt(student.lessons_marked   || 0);
  const grand         = teacherPoints;
  const pct           = total > 0 ? (grand / total) * 100 : 0;
  const attRate       = marked > 0 ? Math.round((attended / marked) * 100) : 0;
  const { fade, translateY } = useStaggerEntry(index);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
    <View style={[lb.card, { backgroundColor: tk.surface, borderColor: tk.border }]}>
      <View style={lb.head}>
        <RankBadge rank={rank} tk={tk} />
        <View style={{ flex:1, marginLeft:12 }}>
          <Text style={[lb.name, { color: tk.textPrimary }]} numberOfLines={1}>
            {student.avatar_emoji || '👤'}  {student.display_name}
          </Text>
          {!!student.email && (
            <Text style={[lb.email, { color: tk.textMuted }]} numberOfLines={1}>
              {student.email}
            </Text>
          )}
        </View>
        <View style={lb.totalWrap}>
          <Text style={[lb.totalVal, { color: BLUE }]}>{grand}</Text>
          <Text style={[lb.totalLbl, { color: tk.textMuted }]}>PTS</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[lb.barTrack, { backgroundColor: tk.surfaceEl }]}>
        <View style={[lb.barFill, { backgroundColor: BLUE, width: `${Math.min(pct, 100)}%` }]} />
      </View>

      {/* Stat cells — Awarded + Attendance (no quiz: students aren't accounts) */}
      <View style={lb.stats}>
        <View style={lb.stat}>
          <Text style={[lb.statVal, { color: '#F97316' }]}>+{teacherPoints}</Text>
          <Text style={[lb.statLbl, { color: tk.textMuted }]}>AWARDED</Text>
        </View>
        <View style={[lb.statDiv, { backgroundColor: tk.border }]} />
        <View style={lb.stat}>
          <Text style={[lb.statVal, { color: '#10B981' }]}>{attRate}%</Text>
          <Text style={[lb.statLbl, { color: tk.textMuted }]}>ATTEND</Text>
        </View>
        <View style={[lb.statDiv, { backgroundColor: tk.border }]} />
        <View style={lb.stat}>
          <Text style={[lb.statVal, { color: '#2563EB' }]}>{marked}</Text>
          <Text style={[lb.statLbl, { color: tk.textMuted }]}>LESSONS</Text>
        </View>
      </View>
    </View>
    </Animated.View>
  );
};
const lb = StyleSheet.create({
  card:     { borderRadius:18, borderWidth:1, padding:14, marginBottom:10, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.04, shadowRadius:8, elevation:2 },
  head:     { flexDirection:'row', alignItems:'center', marginBottom:10 },
  name:     { fontSize:14, fontWeight:'800' },
  email:    { fontSize:11, fontWeight:'500', marginTop:2 },
  totalWrap:{ alignItems:'center', marginLeft:8 },
  totalVal: { fontSize:22, fontWeight:'900', letterSpacing:-0.5 },
  totalLbl: { fontSize:9, fontWeight:'800', letterSpacing:0.8 },
  barTrack: { height:6, borderRadius:3, marginBottom:12, overflow:'hidden' },
  barFill:  { height:6, borderRadius:3 },
  stats:    { flexDirection:'row', alignItems:'center' },
  stat:     { flex:1, alignItems:'center' },
  statVal:  { fontSize:14, fontWeight:'900' },
  statLbl:  { fontSize:9, fontWeight:'800', letterSpacing:0.8, marginTop:2 },
  statDiv:  { width:1, height:24 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE HEATMAP ROW
// ─────────────────────────────────────────────────────────────────────────────
const HeatmapRow = ({ student, records, tk }) => {
  const lessons = Array.from({ length: 13 }, (_, i) => i + 1);
  return (
    <View style={[hm.row, { backgroundColor: tk.surface, borderColor: tk.border }]}>
      <View style={hm.nameCell}>
        <Text style={{ fontSize: 18 }}>{student.avatar_emoji || '👤'}</Text>
        <Text style={[hm.name, { color: tk.textPrimary }]} numberOfLines={1}>
          {(student.display_name || '').split(' ')[0]}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex:1 }}>
        <View style={hm.dots}>
          {lessons.map(n => {
            const rec = records.find(r => r.lesson_number === n && r.student_email === student.student_email);
            const present = rec?.present;
            const marked  = !!rec;
            // Pending records get a dashed border so the teacher can see at
            // a glance which lessons haven't reached the server yet.
            const pending = marked && rec?.synced === false;
            return (
              <View key={n} style={[hm.dot, {
                backgroundColor: !marked ? 'transparent'
                  : present ? '#10B981' : '#EF4444',
                borderColor:    !marked ? tk.border
                  : pending      ? '#F59E0B'        // amber outline = pending sync
                                 : 'transparent',
                borderStyle:    pending ? 'dashed' : 'solid',
                borderWidth:    pending ? 2 : (marked ? 0 : 1.5),
              }]}>
                {!marked && <Text style={[hm.dotNum, { color: tk.textMuted }]}>{n}</Text>}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};
const hm = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1, padding:10, marginBottom:8 },
  nameCell: { width:74, alignItems:'center' },
  name:     { fontSize:11, fontWeight:'700', marginTop:4, textAlign:'center' },
  dots:     { flexDirection:'row', alignItems:'center', paddingHorizontal:4 },
  dot:      { width:24, height:24, borderRadius:7, marginRight:5, borderWidth:1.5, justifyContent:'center', alignItems:'center' },
  dotNum:   { fontSize:9, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherClassDetail({ route, navigation }) {
  const { classId, className, category, teacherEmail } = route.params;
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [tab,           setTab]           = useState(0);
  const [progress,      setProgress]      = useState([]);
  const [members,       setMembers]       = useState([]);
  const [attendance,    setAttendance]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showAddStudent,setShowAddStudent]= useState(false);

  // Pull roster + attendance + computed progress from local AsyncStorage.
  // Re-runs on focus so adds in MarkSheet show up here, and vice versa.
  const refresh = async () => {
    setLoading(true);
    try {
      const data    = await loadClass(classId);
      const prog    = await getProgress(classId);
      const flatAtt = await getAllAttendance(classId);
      // Map to the same shape the rest of the screen expects
      setMembers(data.roster.map(s => ({
        student_email: s.id,                 // reused as the row key
        display_name:  s.name,
        avatar_emoji:  null,
        emailHint:     s.email || '',
        synced:        s.synced !== false,   // surface for the pending pill
      })));
      setAttendance(flatAtt.map(r => ({
        ...r,
        student_email: r.studentId,
      })));
      setProgress(prog.map(p => ({
        ...p,
        student_email: p.studentId,
      })));
    } catch (e) { console.warn('ClassDetail load:', e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* initial */ }, [classId]);
  useEffect(() => {
    const unsub = navigation.addListener?.('focus', refresh);
    return unsub;
  }, [navigation, classId]);

  const maxPossible = useMemo(() => {
    if (!progress.length) return 1;
    return Math.max(...progress.map(s => parseInt(s.teacher_points || 0)), 1);
  }, [progress]);

  // Stats for hero card
  const topScore = useMemo(() => {
    if (!progress.length) return 0;
    return Math.max(...progress.map(s => parseInt(s.teacher_points || 0)), 0);
  }, [progress]);
  const avgAttendance = useMemo(() => {
    if (!progress.length) return 0;
    const rates = progress.map(s => {
      const m = parseInt(s.lessons_marked || 0);
      const a = parseInt(s.lessons_attended || 0);
      return m > 0 ? (a / m) * 100 : 0;
    });
    return Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
  }, [progress]);

  const handleRemove = (studentId, displayName) => {
    Alert.alert(
      'Remove Student',
      `Remove ${displayName} from ${className}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await removeStudent(classId, studentId);
            setMembers(prev => prev.filter(m => m.student_email !== studentId));
            setProgress(prev => prev.filter(p => p.student_email !== studentId));
          } catch (e) { Alert.alert('Error', e.message); }
        }},
      ],
    );
  };

  const handleShare = async () => {
    if (!progress.length) return;
    const lines = progress.map((s, i) =>
      `${i+1}. ${s.display_name}  •  ${parseInt(s.teacher_points||0)} pts  •  ${Math.round((parseInt(s.lessons_attended||0)/Math.max(parseInt(s.lessons_marked||0),1))*100)}% attendance`
    );
    await Share.share({ message: `${className} Progress\n\n${lines.join('\n')}` });
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        {/* ── TOP BAR ── */}
        <View style={[s.topbar, { backgroundColor:tk.bg }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor:tk.surface }]}>
            <Text style={{ fontSize:18, color:tk.textPrimary, fontWeight:'700' }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex:1, marginHorizontal:14 }}>
            <Text style={[s.topTitle,    { color:tk.textPrimary }]} numberOfLines={1}>{className}</Text>
            <Text style={[s.topSubtitle, { color:tk.textMuted   }]} numberOfLines={1}>
              {category}  ·  {members.length} students
            </Text>
          </View>
          <TouchableOpacity onPress={handleShare} activeOpacity={0.85}
            style={[s.iconBtn, { backgroundColor: tk.surface }]}>
            <Text style={{ fontSize:16 }}>📤</Text>
          </TouchableOpacity>
        </View>

        {/* ── HERO CARD ── */}
        <View style={s.section}>
          <View style={[s.heroCard, { backgroundColor:tk.surface, borderColor:tk.border }]}>
            <View style={s.heroTop}>
              <View style={{ flex:1 }}>
                <Text style={[s.heroLbl, { color:tk.textMuted }]}>CLASS OVERVIEW</Text>
                <Text style={[s.heroTitle, { color:tk.textPrimary }]}>{className}</Text>
              </View>
              <View style={[s.heroBadge, { backgroundColor: BLUE_LIGHT }]}>
                <Text style={[s.heroBadgeBig, { color: BLUE }]}>{members.length}</Text>
                <Text style={[s.heroBadgeSub, { color: BLUE }]}>Students</Text>
              </View>
            </View>
            <View style={[s.heroDivider, { backgroundColor: tk.border }]} />
            <View style={s.heroStats}>
              <View style={s.heroStat}>
                <Text style={[s.heroStatVal, { color: '#F59E0B' }]}>{topScore}</Text>
                <Text style={[s.heroStatLbl, { color: tk.textMuted }]}>TOP SCORE</Text>
              </View>
              <View style={[s.heroStatDiv, { backgroundColor: tk.border }]} />
              <View style={s.heroStat}>
                <Text style={[s.heroStatVal, { color: '#10B981' }]}>{avgAttendance}%</Text>
                <Text style={[s.heroStatLbl, { color: tk.textMuted }]}>AVG ATTENDANCE</Text>
              </View>
              <View style={[s.heroStatDiv, { backgroundColor: tk.border }]} />
              <View style={s.heroStat}>
                <Text style={[s.heroStatVal, { color: BLUE }]}>{progress.length}</Text>
                <Text style={[s.heroStatLbl, { color: tk.textMuted }]}>WITH SCORES</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('TeacherMarkSheet', { classId, className, teacherEmail })}
              activeOpacity={0.85}
              style={[s.heroCta, { backgroundColor: BLUE }]}>
              <Text style={s.heroCtaTxt}>✓  {t('teach_mark_attendance', 'Mark Attendance')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── TAB PILLS ── */}
        <View style={s.section}>
          <View style={[s.tabPills, { backgroundColor: tk.surfaceEl }]}>
            {TABS.map((tabDef, i) => {
              const active = i === tab;
              return (
                <TouchableOpacity key={tabDef.key} onPress={() => setTab(i)} activeOpacity={0.85}
                  style={[s.tabPill, { backgroundColor: active ? BLUE : 'transparent' }]}>
                  <Text style={[s.tabPillTxt, { color: active ? '#fff' : tk.textSec }]}>
                    {tabDef.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={BLUE} size="small" />
            <Text style={[s.loadingTxt, { color: tk.textMuted }]}>Loading class data…</Text>
          </View>
        ) : (
          <>
            {/* ─── ROSTER TAB ─── */}
            {tab === 0 && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <View style={{ flex:1 }}>
                    <Text style={[s.sectionTitle, { color: tk.textPrimary }]}>Class Roster</Text>
                    <Text style={[s.sectionSub, { color: tk.textMuted }]}>{members.length} enrolled</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowAddStudent(true)} activeOpacity={0.85}
                    style={[s.addBtn, { backgroundColor: BLUE }]}>
                    <Text style={s.addBtnTxt}>+ Add Student</Text>
                  </TouchableOpacity>
                </View>

                {members.length === 0 ? (
                  <View style={[s.emptyCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                    <Text style={{ fontSize: 48, marginBottom: 14 }}>👥</Text>
                    <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>No students yet</Text>
                    <Text style={[s.emptySub, { color: tk.textMuted }]}>
                      Add your first student by email — they'll appear here immediately.
                    </Text>
                    <TouchableOpacity onPress={() => setShowAddStudent(true)} activeOpacity={0.85}
                      style={[s.emptyBtn, { backgroundColor: BLUE }]}>
                      <Text style={s.emptyBtnTxt}>+ Add First Student</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  members.map(m => (
                    <View key={m.student_email}
                      style={[s.rosterCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                      <View style={[s.rosterAvatar, { backgroundColor: BLUE_LIGHT }]}>
                        <Text style={{ fontSize: 22 }}>{m.avatar_emoji || '👤'}</Text>
                      </View>
                      <View style={{ flex:1, marginLeft:12 }}>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                          <Text style={[s.rosterName, { color: tk.textPrimary, flexShrink:1 }]} numberOfLines={1}>
                            {m.display_name}
                          </Text>
                          {/* Sync state pill — green ✓ when on server, amber ⏳ when only local.
                              Tiny by design so it doesn't compete with the name. */}
                          {m.synced
                            ? <Text style={s.syncedDot} accessibilityLabel="synced">✓</Text>
                            : <Text style={s.pendingDot} accessibilityLabel="pending sync">⏳</Text>}
                        </View>
                        {!!m.emailHint && (
                          <Text style={[s.rosterEmail, { color: tk.textMuted }]} numberOfLines={1}>
                            {m.emailHint}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => handleRemove(m.student_email, m.display_name)} activeOpacity={0.75}
                        style={s.removeBtn}>
                        <Text style={s.removeBtnTxt}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ─── LEADERBOARD TAB ─── */}
            {tab === 1 && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <View style={{ flex:1 }}>
                    <Text style={[s.sectionTitle, { color: tk.textPrimary }]}>Leaderboard</Text>
                    <Text style={[s.sectionSub, { color: tk.textMuted }]}>Quiz + teacher marks combined</Text>
                  </View>
                </View>
                {progress.length === 0 ? (
                  <View style={[s.emptyCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                    <Text style={{ fontSize: 48, marginBottom: 14 }}>📊</Text>
                    <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>No scores yet</Text>
                    <Text style={[s.emptySub, { color: tk.textMuted }]}>
                      Once students take quizzes or earn marks, they'll appear here ranked by points.
                    </Text>
                  </View>
                ) : (
                  progress.map((student, i) => (
                    <LeaderboardRow
                      key={student.student_email}
                      student={student}
                      index={i}
                      rank={i + 1}
                      total={maxPossible}
                      tk={tk}
                    />
                  ))
                )}
              </View>
            )}

            {/* ─── HEATMAP TAB ─── */}
            {tab === 2 && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <View style={{ flex:1 }}>
                    <Text style={[s.sectionTitle, { color: tk.textPrimary }]}>Attendance Heatmap</Text>
                    <View style={s.legend}>
                      <View style={[s.legendDot, { backgroundColor:'#10B981' }]} />
                      <Text style={[s.legendTxt, { color: tk.textMuted }]}>Present</Text>
                      <View style={[s.legendDot, { backgroundColor:'#EF4444', marginLeft:14 }]} />
                      <Text style={[s.legendTxt, { color: tk.textMuted }]}>Absent</Text>
                      <View style={[s.legendDot, { backgroundColor:'transparent', borderWidth:2, borderColor:'#F59E0B', borderStyle:'dashed', marginLeft:14 }]} />
                      <Text style={[s.legendTxt, { color: tk.textMuted }]}>Pending sync</Text>
                    </View>
                  </View>
                </View>

                {/* Lesson number header row */}
                <View style={[s.heatHeader, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                  <View style={{ width: 74 }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection:'row', paddingHorizontal:4 }}>
                      {Array.from({length:13},(_,i)=>i+1).map(n => (
                        <View key={n} style={s.heatHeaderCell}>
                          <Text style={[s.heatHeaderTxt, { color: tk.textMuted }]}>{n}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {members.length === 0 ? (
                  <View style={[s.emptyCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                    <Text style={{ fontSize: 48, marginBottom: 14 }}>👥</Text>
                    <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>No students enrolled</Text>
                    <Text style={[s.emptySub, { color: tk.textMuted }]}>
                      Add students to start tracking attendance.
                    </Text>
                  </View>
                ) : (
                  members.map(member => (
                    <HeatmapRow key={member.student_email} student={member} records={attendance} tk={tk} />
                  ))
                )}
              </View>
            )}
          </>
        )}

      </Animated.ScrollView>

      {/* ── Centered Add-Student modal ── */}
      <AddStudentModal
        visible={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        onAdded={(student) => {
          // Local helper returns { id, name, email, addedAt } — adapt to the
          // member-row shape this screen uses elsewhere.
          const row = {
            student_email: student.id,
            display_name:  student.name,
            avatar_emoji:  null,
            emailHint:     student.email || '',
          };
          setMembers(prev => [...prev, row].sort((a, b) =>
            (a.display_name || '').localeCompare(b.display_name || '')
          ));
          Alert.alert('Added', `${student.name} is now in this class.`);
        }}
        classId={classId}
        tk={tk}
      />

      {/* ── BOTTOM TAB BAR ── */}
      {/* Settings tab removed — Settings lives on the Library home only. */}
      <AppTabBar
        activeTab={3}
        onTab={(i) => {
          if (i === 0) navigation.navigate('HomeScreen');
          if (i === 1) navigation.navigate('TeacherDashboard');
          if (i === 2) navigation.navigate('TeacherMarkSheet', { classId, className, teacherEmail });
          if (i === 3) {/* already here */}
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

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Topbar
  topbar:      { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:10, paddingBottom:14 },
  iconBtn:     { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },
  topTitle:    { fontSize:17, fontWeight:'900', letterSpacing:-0.2 },
  topSubtitle: { fontSize:11, fontWeight:'600', marginTop:2 },

  section:     { paddingHorizontal:20, marginBottom:20 },

  // Hero card
  heroCard:     { borderRadius:18, borderWidth:1, padding:18, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },
  heroTop:      { flexDirection:'row', alignItems:'center' },
  heroLbl:      { fontSize:10, fontWeight:'800', letterSpacing:1.5, marginBottom:5 },
  heroTitle:    { fontSize:18, fontWeight:'800', letterSpacing:-0.3 },
  heroBadge:    { borderRadius:14, padding:12, alignItems:'center', minWidth:68 },
  heroBadgeBig: { fontSize:22, fontWeight:'900', lineHeight:26 },
  heroBadgeSub: { fontSize:11, fontWeight:'700' },
  heroDivider:  { height:1, marginVertical:14 },
  heroStats:    { flexDirection:'row', alignItems:'center', marginBottom:14 },
  heroStat:     { flex:1, alignItems:'center' },
  heroStatVal:  { fontSize:18, fontWeight:'900', letterSpacing:-0.5 },
  heroStatLbl:  { fontSize:9, fontWeight:'800', letterSpacing:0.8, marginTop:3 },
  heroStatDiv:  { width:1, height:30 },
  heroCta:      { borderRadius:14, paddingVertical:13, alignItems:'center' },
  heroCtaTxt:   { color:'#fff', fontSize:14, fontWeight:'800', letterSpacing:0.3 },

  // Tab pills
  tabPills:    { flexDirection:'row', borderRadius:14, padding:4, gap:4 },
  tabPill:     { flex:1, borderRadius:11, paddingVertical:10, alignItems:'center' },
  tabPillTxt:  { fontSize:13, fontWeight:'800' },

  // Section heads
  sectionHead: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  sectionTitle:{ fontSize:18, fontWeight:'800' },
  sectionSub:  { fontSize:11, fontWeight:'600', marginTop:3 },

  // Add button
  addBtn:      { borderRadius:10, paddingHorizontal:12, paddingVertical:8 },
  addBtnTxt:   { color:'#fff', fontSize:13, fontWeight:'800' },

  // Roster
  rosterCard:  { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1, padding:12, marginBottom:8 },
  rosterAvatar:{ width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center' },
  rosterName:  { fontSize:14, fontWeight:'800' },
  rosterEmail: { fontSize:11, fontWeight:'500', marginTop:2 },
  removeBtn:   { paddingHorizontal:12, paddingVertical:7, borderRadius:8, backgroundColor:'#FEF2F2' },
  removeBtnTxt:{ color:'#DC2626', fontSize:12, fontWeight:'800' },
  // Sync state pills next to roster names
  syncedDot:   { fontSize: 10, fontWeight: '900', color: '#10B981', backgroundColor: '#10B98115', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  pendingDot:  { fontSize: 10, fontWeight: '900', color: '#F59E0B', backgroundColor: '#F59E0B15', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },

  // Heatmap header
  heatHeader:    { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1, padding:8, marginBottom:8 },
  heatHeaderCell:{ width:29, alignItems:'center' },
  heatHeaderTxt: { fontSize:10, fontWeight:'800' },

  // Heatmap legend
  legend:    { flexDirection:'row', alignItems:'center', marginTop:6 },
  legendDot: { width:10, height:10, borderRadius:3 },
  legendTxt: { fontSize:11, fontWeight:'600', marginLeft:5 },

  // Loading + empty
  loadingBox:  { padding:60, alignItems:'center', gap:10 },
  loadingTxt:  { fontSize:13 },
  emptyCard:   { borderRadius:18, borderWidth:1, padding:32, alignItems:'center' },
  emptyTitle:  { fontSize:18, fontWeight:'900', marginBottom:8, textAlign:'center' },
  emptySub:    { fontSize:13, textAlign:'center', lineHeight:20, marginBottom:20 },
  emptyBtn:    { borderRadius:14, paddingHorizontal:24, paddingVertical:12 },
  emptyBtnTxt: { color:'#fff', fontSize:14, fontWeight:'800' },
});
