// screens/teacher/TeacherMarkSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Attendance + marks page — redesigned to match Homescreen / TeacherDashboard
// design language: same surface tokens, soft cards, BLUE primary, SVG AppTabBar.
//
//   • Topbar: back + class name + Save
//   • Hero summary card: lesson selector + present/points/marks stats
//   • Section header: "Students"
//   • Each student in a clean card — present toggle + mark buttons
//   • Bottom: shared AppTabBar (Attendance tab active)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }     from '../../context/ThemeContext';
import { useLanguage }  from '../../context/LanguageContext';
import AppTabBar        from '../../components/AppTabBar';
import {
  getAttendanceForLesson, setBulkAttendance,
  getMarksForLesson, addMark, removeMark, updateMark,
} from '../../services/teacherLocal';
import { getTokens } from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';

// ── Design tokens — IDENTICAL to Homescreen.js / TeacherDashboard.jsx ─────────
const BLUE       = '#1A56DB';
const BLUE_LIGHT = '#EFF6FF';

const buildMarkTypes = (t) => [
  { key: 'answered_question', label: t('tmark_answered_question', 'Answered Question'), icon: '💬', points: 2, color: '#2563EB', bg: '#EFF6FF' },
  { key: 'memory_verse',      label: t('tmark_memory_verse', 'Memory Verse'),           icon: '📖', points: 5, color: '#F97316', bg: '#FFF7ED' },
  { key: 'bonus',             label: t('tmark_bonus_points', 'Bonus Points'),          icon: '⭐', points: 1, color: '#F59E0B', bg: '#FEF3C7' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — matches Homescreen
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ title, sub, action, onAction, tk }) => (
  <View style={sh.row}>
    <View style={{ flex:1 }}>
      <Text style={[sh.title, { color:tk.textPrimary }]}>{title}</Text>
      {!!sub && <Text style={[sh.sub, { color:tk.textMuted }]}>{sub}</Text>}
    </View>
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
  sub:    { fontSize:11, fontWeight:'600', marginTop:3 },
  action: { fontSize:13, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT CARD
// ─────────────────────────────────────────────────────────────────────────────
const StudentCard = ({ student, onTogglePresent, onAwardMark, onEditMark, marks, tk, t, isDark, index = 0 }) => {
  const MARK_TYPES = buildMarkTypes(t);
  const studentMarks = marks.filter(m => m.student_email === student.student_email);
  const totalPts     = studentMarks.reduce((s, m) => s + (parseInt(m.points) || 0), 0);
  const present      = !!student.present;
  const attendancePending = student.attendanceSynced === false;
  const studentPending    = student.studentSynced    === false;
  const showPending       = attendancePending || studentPending;
  const { fade, translateY } = useStaggerEntry(index);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
    <View style={[sc.card, {
      backgroundColor: tk.surface,
      borderColor:     present ? '#10B98140' : tk.border,
    }]}>
      {/* Top row — avatar, name, present toggle */}
      <View style={sc.topRow}>
        <View style={[sc.avatar, { backgroundColor: present ? '#10B98118' : (isDark ? tk.surfaceEl : '#F3F4F6') }]}>
          <Text style={{ fontSize:22 }}>{student.avatar_emoji || '👤'}</Text>
        </View>
        <View style={{ flex:1, marginLeft:12 }}>
          <View style={sc.nameRow}>
            <Text style={[sc.name, { color:tk.textPrimary, flexShrink:1 }]} numberOfLines={1}>
              {student.display_name}
            </Text>
            {showPending ? (
              <View style={sc.pendingPill} accessibilityLabel="pending sync">
                <Text style={sc.pendingPillTxt}>⏳ Pending</Text>
              </View>
            ) : (
              <View style={sc.syncedPill} accessibilityLabel="synced">
                <Text style={sc.syncedPillTxt}>✓</Text>
              </View>
            )}
          </View>
          <Text style={[sc.email, { color:tk.textMuted }]} numberOfLines={1}>
            {student.student_email}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onTogglePresent(student.student_email)}
          activeOpacity={0.85}
          style={[sc.toggle, { backgroundColor: present ? '#10B981' : tk.surfaceEl, borderColor: present ? '#10B981' : tk.border }]}>
          <Text style={[sc.toggleTxt, { color: present ? '#fff' : tk.textMuted }]}>
            {present ? t('tmark_present', '✓ Present') : t('tmark_absent', 'Absent')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mark buttons — one row of 3 pill buttons */}
      <View style={sc.markRow}>
        {MARK_TYPES.map(mt => (
          <TouchableOpacity
            key={mt.key}
            onPress={() => onAwardMark(student.student_email, mt)}
            activeOpacity={0.85}
            style={[sc.markBtn, { backgroundColor: isDark ? tk.surfaceEl : mt.bg, borderColor: mt.color + '30' }]}>
            <Text style={{ fontSize:13 }}>{mt.icon}</Text>
            <Text style={[sc.markBtnTxt, { color: mt.color }]}>+{mt.points}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Awarded marks summary. Each pill is tappable — opens an action sheet
          where the teacher can change the mark's type/points or remove it. */}
      {studentMarks.length > 0 && (
        <View style={[sc.awardRow, { borderTopColor: tk.border }]}>
          <Text style={[sc.awardLbl, { color: tk.textMuted }]}>
            {t('tmark_pts_awarded', '+{n} pts awarded').replace('{n}', String(totalPts))}
            <Text style={[sc.awardEditHint, { color: tk.textMuted }]}>  ·  tap to edit</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection:'row', gap:6 }}>
              {studentMarks.map((m, i) => {
                const mt = MARK_TYPES.find(x => x.key === m.mark_type) || MARK_TYPES[2];
                const markPending = m.synced === false;
                return (
                  <TouchableOpacity
                    key={m.id || i}
                    onPress={() => onEditMark && onEditMark(m)}
                    activeOpacity={0.7}
                    style={[sc.awardPill, {
                      backgroundColor: mt.color + '15',
                      borderColor:     markPending ? '#F59E0B' : (mt.color + '30'),
                      borderStyle:     markPending ? 'dashed' : 'solid',
                      borderWidth:     markPending ? 1.5 : 1,
                    }]}>
                    <Text style={{ fontSize: 10 }}>{mt.icon}</Text>
                    <Text style={[sc.awardPillTxt, { color: mt.color }]}>+{m.points}</Text>
                    {markPending && <Text style={sc.awardPillPending}>⏳</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
    </Animated.View>
  );
};
const sc = StyleSheet.create({
  card:        { borderRadius:18, borderWidth:1, padding:14, marginBottom:12, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.04, shadowRadius:8, elevation:2 },
  topRow:      { flexDirection:'row', alignItems:'center', marginBottom:12 },
  avatar:      { width:48, height:48, borderRadius:24, justifyContent:'center', alignItems:'center' },
  name:        { fontSize:15, fontWeight:'800' },
  email:       { fontSize:11, fontWeight:'500', marginTop:2 },
  toggle:      { borderRadius:10, borderWidth:1.5, paddingHorizontal:12, paddingVertical:7 },
  toggleTxt:   { fontSize:11, fontWeight:'800', letterSpacing:0.3 },
  markRow:     { flexDirection:'row', gap:8 },
  markBtn:     { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', borderRadius:12, borderWidth:1, paddingVertical:9, gap:5 },
  markBtnTxt:  { fontSize:13, fontWeight:'900' },
  awardRow:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderTopWidth:1, marginTop:12, paddingTop:10, gap:8 },
  awardLbl:    { fontSize:11, fontWeight:'700' },
  awardPill:   { borderRadius:8, borderWidth:1, paddingHorizontal:8, paddingVertical:4, flexDirection:'row', alignItems:'center', gap:3 },
  awardPillTxt:{ fontSize:10, fontWeight:'800' },
  awardPillPending: { fontSize: 9, marginLeft: 1 },
  awardEditHint:    { fontSize: 10, fontWeight: '600', fontStyle: 'italic' },

  nameRow:        { flexDirection:'row', alignItems:'center', gap:6 },
  pendingPill:    { backgroundColor:'#FEF3C7', borderColor:'#F59E0B', borderWidth:1, borderStyle:'dashed', borderRadius:8, paddingHorizontal:6, paddingVertical:2 },
  pendingPillTxt: { fontSize:9, fontWeight:'800', color:'#B45309', letterSpacing:0.3 },
  syncedPill:     { backgroundColor:'#D1FAE5', borderRadius:8, paddingHorizontal:5, paddingVertical:2 },
  syncedPillTxt:  { fontSize:10, fontWeight:'900', color:'#059669', lineHeight:12 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherMarkSheet({ route, navigation }) {
  const { classId, className, teacherEmail } = route.params;
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const MARK_TYPES = useMemo(() => buildMarkTypes(t), [t]);
  const { fade, translateY } = useScreenEntry();

  const [lessonNumber, setLessonNumber] = useState(1);
  const [students,     setStudents]     = useState([]);
  const [marks,        setMarks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);

  // Local-storage roster + attendance + marks for the selected lesson.
  // Roster stays in sync with TeacherClassDetail since both screens read the
  // same `teach_class_${classId}` AsyncStorage key.
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roster, lessonMarks] = await Promise.all([
        getAttendanceForLesson(classId, lessonNumber),
        getMarksForLesson(classId, lessonNumber),
      ]);
      // Adapt to the row shape this screen uses (student_email = local id).
      // Carry sync flags through so the card can show pending state.
      setStudents(roster.map(r => ({
        student_email:    r.id,
        display_name:     r.name,
        emailHint:        r.email || '',
        avatar_emoji:     null,
        present:          !!r.present,
        attendanceSynced: r.attendanceSynced !== false,
        studentSynced:    r.studentSynced !== false,
      })));
      setMarks(lessonMarks.map(m => ({
        id:            m.id,                  // preserve so edit/remove can target this row
        student_email: m.studentId,
        mark_type:     m.mark_type,
        points:        m.points,
        note:          m.note,
        synced:        m.synced !== false,
      })));
    } catch (e) { Alert.alert(t('teach_error', 'Error'), e.message); }
    finally { setLoading(false); }
  }, [classId, lessonNumber, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const togglePresent = (id) => {
    setStudents(prev => prev.map(s =>
      s.student_email === id ? { ...s, present: !s.present } : s
    ));
  };

  const awardMark = async (studentId, markType) => {
    // Optimistic UI update with a temp id we can swap once AsyncStorage assigns
    // the real one. Without the temp id, the pill is un-tappable until the
    // async write completes, which feels broken on slow devices.
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setMarks(prev => [...prev, {
      id:            tempId,
      student_email: studentId,
      mark_type:     markType.key,
      points:        markType.points,
      note:          markType.label,
      synced:        false,
    }]);
    try {
      const entry = await addMark(classId, lessonNumber, {
        studentId,
        mark_type: markType.key,
        points:    markType.points,
        note:      markType.label,
      });
      // Swap the temp id for the persistent one so subsequent edits/removes
      // address the same row the store knows about.
      if (entry?.id) {
        setMarks(prev => prev.map(m => (m.id === tempId ? { ...m, id: entry.id } : m)));
      }
    } catch (e) { console.warn('awardMark:', e.message); }
  };

  // Tap an awarded pill → action sheet. Lets the teacher remove a mistaken
  // mark or convert it to a different type/points without having to delete
  // and re-add. Local store and UI state stay in lockstep — if the persist
  // fails the optimistic update is reverted from the original snapshot.
  const editMark = async (mark, newType) => {
    const snapshot = marks;
    setMarks(prev => prev.map(m =>
      m.id === mark.id
        ? { ...m, mark_type: newType.key, points: newType.points, note: newType.label, synced: false }
        : m
    ));
    try {
      await updateMark(classId, lessonNumber, mark.id, {
        mark_type: newType.key,
        points:    newType.points,
        note:      newType.label,
      });
    } catch (e) {
      console.warn('editMark:', e.message);
      setMarks(snapshot);
    }
  };

  const deleteMark = async (mark) => {
    const snapshot = marks;
    setMarks(prev => prev.filter(m => m.id !== mark.id));
    try {
      await removeMark(classId, lessonNumber, mark.id);
    } catch (e) {
      console.warn('removeMark:', e.message);
      setMarks(snapshot);
    }
  };

  // Open the per-pill action sheet. We hand the StudentCard a single handler
  // that already knows about MARK_TYPES + the current mark, so the card stays
  // dumb and presentation-only.
  const openMarkActions = (mark) => {
    const current = MARK_TYPES.find(x => x.key === mark.mark_type) || MARK_TYPES[2];
    const otherTypes = MARK_TYPES.filter(x => x.key !== current.key);
    Alert.alert(
      `${current.icon} ${current.label} · +${mark.points}`,
      'Change this mark or remove it.',
      [
        ...otherTypes.map(mt => ({
          text: `Change to ${mt.label} (+${mt.points})`,
          onPress: () => editMark(mark, mt),
        })),
        { text: 'Remove', style: 'destructive', onPress: () => deleteMark(mark) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      await setBulkAttendance(
        classId,
        lessonNumber,
        students.map(s => ({ studentId: s.student_email, present: s.present })),
      );
      Alert.alert('Saved ✓', `Attendance for Lesson ${lessonNumber} saved on this device.`);
    } catch (e) { Alert.alert(t('teach_error', 'Error'), e.message); }
    finally { setSaving(false); }
  };

  const presentCount    = students.filter(s => s.present).length;
  const totalPtsAwarded = marks.reduce((s, m) => s + (parseInt(m.points) || 0), 0);

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
            <Text style={[s.topSubtitle, { color:tk.textMuted   }]}>
              {t('teach_mark_attendance', 'Mark Attendance')}
            </Text>
          </View>
          <TouchableOpacity onPress={saveAttendance} disabled={saving} activeOpacity={0.85}
            style={[s.saveBtn, { backgroundColor: BLUE, opacity: saving ? 0.7 : 1 }]}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.saveBtnTxt}>{t('btn_save', 'Save')} ✓</Text>}
          </TouchableOpacity>
        </View>

        {/* ── HERO SUMMARY CARD — lesson selector + stats ── */}
        <View style={s.section}>
          <View style={[s.heroCard, { backgroundColor:tk.surface, borderColor:tk.border }]}>
            <Text style={[s.heroLbl, { color:tk.textMuted }]}>SELECT LESSON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4 }}>
              {Array.from({ length: 13 }, (_, i) => i + 1).map(n => {
                const active = n === lessonNumber;
                return (
                  <TouchableOpacity key={n} onPress={() => setLessonNumber(n)} activeOpacity={0.85}
                    style={[s.lessonChip, {
                      backgroundColor: active ? BLUE : (isDark ? tk.surfaceEl : BLUE_LIGHT),
                      borderColor:     active ? BLUE : 'transparent',
                    }]}>
                    <Text style={[s.lessonChipTxt, { color: active ? '#fff' : BLUE }]}>
                      {String(n).padStart(2,'0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[s.statRow, { borderTopColor: tk.border }]}>
              <View style={s.stat}>
                <Text style={[s.statVal, { color:'#10B981' }]}>{presentCount}/{students.length || 0}</Text>
                <Text style={[s.statLbl, { color:tk.textMuted }]}>PRESENT</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: tk.border }]} />
              <View style={s.stat}>
                <Text style={[s.statVal, { color: BLUE }]}>+{totalPtsAwarded}</Text>
                <Text style={[s.statLbl, { color:tk.textMuted }]}>POINTS</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: tk.border }]} />
              <View style={s.stat}>
                <Text style={[s.statVal, { color:'#F97316' }]}>{marks.length}</Text>
                <Text style={[s.statLbl, { color:tk.textMuted }]}>MARKS</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── MARK TYPE LEGEND ── */}
        <View style={s.section}>
          <View style={[s.legend, { backgroundColor: tk.surface, borderColor: tk.border }]}>
            {MARK_TYPES.map(mt => (
              <View key={mt.key} style={s.legendItem}>
                <Text style={{ fontSize:14 }}>{mt.icon}</Text>
                <Text style={[s.legendTxt, { color: mt.color }]}>{mt.label}</Text>
                <Text style={[s.legendPts, { color: tk.textMuted }]}>+{mt.points}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── STUDENTS LIST ── */}
        <View style={s.section}>
          <SectionHeader
            title={`Students  ·  Lesson ${lessonNumber}`}
            sub={students.length ? `${presentCount} of ${students.length} present` : null}
            action={students.length > 0 ? (presentCount < students.length ? 'Mark all' : 'Clear all') : null}
            onAction={() => setStudents(prev => prev.map(s => ({ ...s, present: presentCount < students.length })))}
            tk={tk}
          />

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={BLUE} size="small" />
              <Text style={[s.loadingTxt, { color: tk.textMuted }]}>Loading students…</Text>
            </View>
          ) : students.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
              <Text style={{ fontSize: 48, marginBottom: 14 }}>👥</Text>
              <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>No students in this class yet</Text>
              <Text style={[s.emptySub, { color: tk.textMuted }]}>
                Add students from the class detail page to start marking attendance.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('TeacherClassDetail', { classId, className, teacherEmail })}
                activeOpacity={0.85}
                style={[s.emptyBtn, { backgroundColor: BLUE }]}>
                <Text style={s.emptyBtnTxt}>Manage Roster</Text>
              </TouchableOpacity>
            </View>
          ) : (
            students.map((student, i) => (
              <StudentCard
                key={student.student_email}
                student={student}
                index={i}
                marks={marks}
                onTogglePresent={togglePresent}
                onAwardMark={awardMark}
                onEditMark={openMarkActions}
                tk={tk}
                t={t}
                isDark={isDark}
              />
            ))
          )}
        </View>

      </Animated.ScrollView>

      {/* ── BOTTOM TAB BAR ──
          Settings tab removed — Settings lives on the Library home only. */}
      <AppTabBar
        activeTab={2}
        onTab={(i) => {
          if (i === 0) navigation.navigate('HomeScreen');
          if (i === 1) navigation.navigate('TeacherDashboard');
          if (i === 2) {/* already here */}
          if (i === 3) navigation.navigate('TeacherClassDetail', { classId, className, teacherEmail });
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

  // Topbar (Homescreen-aligned)
  topbar:      { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:10, paddingBottom:14 },
  iconBtn:     { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },
  topTitle:    { fontSize:17, fontWeight:'900', letterSpacing:-0.2 },
  topSubtitle: { fontSize:11, fontWeight:'600', marginTop:2 },
  saveBtn:     { borderRadius:14, paddingHorizontal:14, paddingVertical:10 },
  saveBtnTxt:  { color:'#fff', fontSize:13, fontWeight:'800' },

  section:     { paddingHorizontal:20, marginBottom:20 },

  // Hero summary card
  heroCard:    { borderRadius:18, borderWidth:1, padding:16, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },
  heroLbl:     { fontSize:10, fontWeight:'800', letterSpacing:1.5, marginBottom:10 },
  lessonChip:  { borderRadius:10, borderWidth:1.5, paddingHorizontal:13, paddingVertical:8, marginRight:6 },
  lessonChipTxt:{ fontSize:14, fontWeight:'900' },
  statRow:     { flexDirection:'row', alignItems:'center', marginTop:14, paddingTop:14, borderTopWidth:1 },
  stat:        { flex:1, alignItems:'center' },
  statVal:     { fontSize:20, fontWeight:'900', letterSpacing:-0.5 },
  statLbl:     { fontSize:9, fontWeight:'800', letterSpacing:1, marginTop:2 },
  statDivider: { width:1, height:36 },

  // Mark legend
  legend:      { flexDirection:'row', flexWrap:'wrap', borderRadius:14, borderWidth:1, padding:12, gap:14 },
  legendItem:  { flexDirection:'row', alignItems:'center', gap:5 },
  legendTxt:   { fontSize:11, fontWeight:'700' },
  legendPts:   { fontSize:10, fontWeight:'700' },

  // Loading + empty
  loadingBox:  { padding:32, alignItems:'center', gap:10 },
  loadingTxt:  { fontSize:13 },
  emptyCard:   { borderRadius:18, borderWidth:1, padding:32, alignItems:'center' },
  emptyTitle:  { fontSize:18, fontWeight:'900', marginBottom:8, textAlign:'center' },
  emptySub:    { fontSize:13, textAlign:'center', lineHeight:20, marginBottom:20 },
  emptyBtn:    { borderRadius:14, paddingHorizontal:24, paddingVertical:12 },
  emptyBtnTxt: { color:'#fff', fontSize:14, fontWeight:'800' },
});
