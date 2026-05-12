// services/teacherLocal.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-class roster + attendance + teacher-marks, stored in AsyncStorage on the
// teacher's device. No server involvement — students are added by name (and
// optionally email), attendance and marks live entirely on this device.
//
// Storage shape, one key per class:
//   `teach_class_${classId}` → {
//     roster:     [ { id, name, email?, addedAt } ],
//     attendance: { [lessonNumber]: { [studentId]: { present, markedAt } } },
//     marks:      { [lessonNumber]: [ { studentId, mark_type, points, note, awardedAt } ] },
//   }
//
// Tradeoff: this data is per-device — uninstalling or switching phones loses
// it. That's acceptable for a personal Sunday-school tracker; if cross-device
// sync is later needed, the same shape can be POSTed to /api/teacher/* and
// hydrated back on next login.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY        = (classId) => `teach_class_${classId}`;
const REGISTRY   = 'teach_class_registry';   // array of all class IDs the teacher has local data for

const EMPTY = () => ({ roster: [], attendance: {}, marks: {} });

// ── Registry helpers ─────────────────────────────────────────────────────────
// We need to know every class ID the teacher has touched so the sync worker
// can drain them all without depending on any UI state.
async function rememberClass(classId) {
  try {
    const raw = await AsyncStorage.getItem(REGISTRY);
    const ids = raw ? JSON.parse(raw) : [];
    if (!ids.includes(classId)) {
      ids.push(classId);
      await AsyncStorage.setItem(REGISTRY, JSON.stringify(ids));
    }
  } catch {}
}
async function listKnownClasses() {
  try {
    const raw = await AsyncStorage.getItem(REGISTRY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── ID generation — stable, sortable, collision-resistant ────────────────────
const newId = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

// ── Read / write whole class blob ────────────────────────────────────────────
export async function loadClass(classId) {
  try {
    const raw = await AsyncStorage.getItem(KEY(classId));
    if (!raw) return EMPTY();
    const parsed = JSON.parse(raw);
    return {
      roster:     Array.isArray(parsed.roster) ? parsed.roster : [],
      attendance: parsed.attendance && typeof parsed.attendance === 'object' ? parsed.attendance : {},
      marks:      parsed.marks      && typeof parsed.marks      === 'object' ? parsed.marks      : {},
    };
  } catch {
    return EMPTY();
  }
}

async function saveClass(classId, data) {
  await AsyncStorage.setItem(KEY(classId), JSON.stringify(data));
  await rememberClass(classId);   // keep the registry in sync for the sync worker
}

// ── Roster ───────────────────────────────────────────────────────────────────
export async function addStudent(classId, { name, email }) {
  const trimmedName  = (name  || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  if (!trimmedName) throw new Error('Student name is required.');

  const data = await loadClass(classId);

  // Reject exact-name duplicates (case-insensitive) so the teacher gets a
  // clear error rather than a silently-doubled list entry.
  const exists = data.roster.some(
    s => s.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (exists) throw new Error('A student with this name is already in this class.');

  const student = {
    id:      newId(),
    name:    trimmedName,
    email:   trimmedEmail || null,
    addedAt: new Date().toISOString(),
    synced:  false,                 // sync worker drains this
  };
  data.roster = [...data.roster, student].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  await saveClass(classId, data);
  return student;
}

export async function removeStudent(classId, studentId) {
  const data = await loadClass(classId);
  data.roster = data.roster.filter(s => s.id !== studentId);

  // Cascade: drop their attendance and marks across all lessons.
  for (const ln of Object.keys(data.attendance)) {
    if (data.attendance[ln][studentId]) delete data.attendance[ln][studentId];
  }
  for (const ln of Object.keys(data.marks)) {
    data.marks[ln] = (data.marks[ln] || []).filter(m => m.studentId !== studentId);
  }

  await saveClass(classId, data);
}

// ── Attendance ───────────────────────────────────────────────────────────────
// Returns the roster annotated with `present` + `attendanceSynced` (whether
// the most recent attendance change for this lesson has been pushed to the
// server) + `studentSynced` (whether the student's own row has been pushed).
// Both default to true when no entry exists (clean state).
export async function getAttendanceForLesson(classId, lessonNumber) {
  const data = await loadClass(classId);
  const lessonAtt = data.attendance[String(lessonNumber)] || {};
  return data.roster.map(s => {
    const att = lessonAtt[s.id];
    return {
      ...s,
      present:           !!att?.present,
      attendanceSynced:  !att || att.synced !== false,
      studentSynced:     s.synced !== false,
    };
  });
}

export async function setBulkAttendance(classId, lessonNumber, records) {
  const data   = await loadClass(classId);
  const stamp  = new Date().toISOString();
  const map    = { ...(data.attendance[String(lessonNumber)] || {}) };
  for (const r of records) {
    // Bump synced=false on every change so re-toggling resends to server.
    map[r.studentId] = { present: !!r.present, markedAt: stamp, synced: false };
  }
  data.attendance[String(lessonNumber)] = map;
  await saveClass(classId, data);
}

// All attendance records as a flat array (used by the heatmap).
export async function getAllAttendance(classId) {
  const data = await loadClass(classId);
  const flat = [];
  for (const ln of Object.keys(data.attendance)) {
    const lessonNumber = parseInt(ln, 10);
    for (const [studentId, rec] of Object.entries(data.attendance[ln] || {})) {
      flat.push({
        studentId,
        lesson_number: lessonNumber,
        present:       !!rec.present,
        marked_at:     rec.markedAt,
        synced:        rec.synced !== false,   // surface for heatmap
      });
    }
  }
  return flat;
}

// ── Marks ───────────────────────────────────────────────────────────────────
export async function getMarksForLesson(classId, lessonNumber) {
  const data = await loadClass(classId);
  return data.marks[String(lessonNumber)] || [];
}

export async function addMark(classId, lessonNumber, { studentId, mark_type, points, note }) {
  const data = await loadClass(classId);
  const arr  = data.marks[String(lessonNumber)] || [];
  arr.push({
    id: newId(),                     // local id so sync can mark this exact entry synced later
    studentId,
    mark_type,
    points: parseInt(points, 10) || 0,
    note: note || null,
    awardedAt: new Date().toISOString(),
    synced: false,
  });
  data.marks[String(lessonNumber)] = arr;
  await saveClass(classId, data);
}

// ── Aggregated stats per student (powers the leaderboard) ────────────────────
export async function getProgress(classId) {
  const data = await loadClass(classId);
  return data.roster.map(s => {
    let teacherPoints     = 0;
    let lessonsAttended   = 0;
    let lessonsMarked     = 0;
    let pendingAttendance = 0;
    let pendingMarks      = 0;

    for (const ln of Object.keys(data.attendance)) {
      const rec = data.attendance[ln][s.id];
      if (rec) {
        lessonsMarked += 1;
        if (rec.present)        lessonsAttended++;
        if (rec.synced === false) pendingAttendance++;
      }
    }
    for (const ln of Object.keys(data.marks)) {
      for (const m of data.marks[ln] || []) {
        if (m.studentId === s.id) {
          teacherPoints += parseInt(m.points, 10) || 0;
          if (m.synced === false) pendingMarks++;
        }
      }
    }

    return {
      studentId:       s.id,
      display_name:    s.name,
      email:           s.email || null,
      teacher_points:  teacherPoints,
      quiz_total:      0,
      lessons_attended: lessonsAttended,
      lessons_marked:   lessonsMarked,
      // Sync indicators for the leaderboard rows
      pending_attendance: pendingAttendance,
      pending_marks:      pendingMarks,
      student_synced:     s.synced !== false,
    };
  }).sort((a, b) => b.teacher_points - a.teacher_points);
}

// Roster size — used by the dashboard's class-card count.
export async function rosterSize(classId) {
  const data = await loadClass(classId);
  return data.roster.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC HELPERS — called by services/syncWorker.js
// ─────────────────────────────────────────────────────────────────────────────

// Build the payload for a single class — only entries with synced:false.
// Returns null if the class has nothing pending (sync worker can skip it).
export async function getUnsyncedForClass(classId) {
  const data = await loadClass(classId);
  const roster = data.roster.filter(s => s.synced === false);

  const attendance = [];
  for (const ln of Object.keys(data.attendance)) {
    for (const [studentId, rec] of Object.entries(data.attendance[ln] || {})) {
      if (rec.synced === false) {
        attendance.push({
          server_class_id: classId,
          lesson_number:   parseInt(ln, 10),
          student_local_id: studentId,
          // For students added to local-only roster, sync endpoint will resolve
          // student_local_id → server email via the mapping returned from a
          // previous sync (or generate a synthetic one).
          present:   !!rec.present,
          marked_at: rec.markedAt,
        });
      }
    }
  }

  const marks = [];
  for (const ln of Object.keys(data.marks)) {
    for (const m of data.marks[ln] || []) {
      if (m.synced === false) {
        marks.push({
          local_id:        m.id,
          server_class_id: classId,
          lesson_number:   parseInt(ln, 10),
          student_local_id: m.studentId,
          mark_type:       m.mark_type,
          points:          m.points,
          note:            m.note,
          awarded_at:      m.awardedAt,
        });
      }
    }
  }

  if (!roster.length && !attendance.length && !marks.length) return null;

  return {
    classId,
    roster: roster.map(s => ({
      local_id:        s.id,
      server_class_id: classId,
      name:            s.name,
      email:           s.email,
    })),
    attendance,
    marks,
  };
}

// Aggregate every class's pending entries into one batch the sync worker can
// POST in a single request. Returns null if nothing's pending app-wide.
export async function buildSyncBatch() {
  const ids = await listKnownClasses();
  const classes = [], roster = [], attendance = [], marks = [];
  for (const cid of ids) {
    const blob = await getUnsyncedForClass(cid);
    if (!blob) continue;
    roster.push(...blob.roster);
    attendance.push(...blob.attendance);
    marks.push(...blob.marks);
  }
  if (!roster.length && !attendance.length && !marks.length) return null;
  return { classes, roster, attendance, marks };
}

// After a successful sync, walk every entry that was just sent and flip its
// synced flag to true. The mappings returned from the server (local→server
// student email) are also persisted on the matching roster entries so future
// syncs of the same students can use the real email.
export async function markBatchSynced({ studentMappings = {} } = {}) {
  const ids = await listKnownClasses();
  for (const cid of ids) {
    const data = await loadClass(cid);
    let mutated = false;
    for (const s of data.roster) {
      if (s.synced === false) {
        s.synced = true;
        const mapped = studentMappings[s.id];
        if (mapped && !s.email) s.email = mapped;   // remember server-assigned email
        mutated = true;
      }
    }
    for (const ln of Object.keys(data.attendance)) {
      for (const sid of Object.keys(data.attendance[ln] || {})) {
        if (data.attendance[ln][sid].synced === false) {
          data.attendance[ln][sid].synced = true;
          mutated = true;
        }
      }
    }
    for (const ln of Object.keys(data.marks)) {
      for (const m of data.marks[ln] || []) {
        if (m.synced === false) { m.synced = true; mutated = true; }
      }
    }
    if (mutated) await saveClass(cid, data);
  }
}

// How many entries are waiting to sync — used by the dashboard badge.
export async function pendingSyncCount() {
  const ids = await listKnownClasses();
  let count = 0;
  for (const cid of ids) {
    const data = await loadClass(cid);
    count += data.roster.filter(s => s.synced === false).length;
    for (const ln of Object.keys(data.attendance)) {
      for (const sid of Object.keys(data.attendance[ln] || {})) {
        if (data.attendance[ln][sid].synced === false) count++;
      }
    }
    for (const ln of Object.keys(data.marks)) {
      count += (data.marks[ln] || []).filter(m => m.synced === false).length;
    }
  }
  return count;
}
