// screen/victory/victoryStore.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralised AsyncStorage layer for everything Victory Month writes back.
//
// One store, many concerns:
//   • completed_days   → { 1: true, 4: true }       (existing)
//   • notes            → { 4: { reflection, testimony, note, updated_at } }
//   • custom_points    → { 4: [{ id, text, created_at, prayed }] }
//   • fasts            → [{ id, title, startISO, endISO, type, recurring }]
//   • reminders        → [{ id, label, time: "HH:MM", days: [0..6], enabled }]
//   • achievements     → { badgeId: { unlocked_at } }
//   • category_prayers → { categoryId: [{ id, text, created_at, prayed }] }
//   • audio_settings   → { ambient: 'rain' | 'piano' | 'off', rate: 0.9, voice }
//   • room_history     → [{ roomId, joined_at, duration_s }]
//
// All reads return a plain JS value via async helpers; mutations also publish a
// "victory:store-changed" event so screens that don't poll can listen and
// re-render. Stay framework-agnostic — components consume it through the hook
// in victoryHooks.js.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

const KEYS = {
  completed:   'vmp_completed_days',           // unchanged — used by existing screens
  notes:       'vmp_notes_v1',
  custom:      'vmp_custom_points_v1',
  fasts:       'vmp_fasts_v1',
  reminders:   'vmp_reminders_v1',
  achievements:'vmp_achievements_v1',
  catPrayers:  'vmp_cat_prayers_v1',
  audio:       'vmp_audio_settings_v1',
  rooms:       'vmp_room_history_v1',
  totalSeconds:'vmp_total_seconds_v1',
  userRooms:   'vmp_user_rooms_v1',
};

const EVENT = 'victory:store-changed';

// ── low-level helpers ───────────────────────────────────────────────────────
const safeParse = (raw, fallback) => {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};

const readJson = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return safeParse(raw, fallback);
  } catch { return fallback; }
};

const writeJson = async (key, value) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); }
  catch { /* swallow */ }
  DeviceEventEmitter.emit(EVENT, { key });
  return value;
};

// Tiny stable-id helper.
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ── public API ──────────────────────────────────────────────────────────────
export const onStoreChange = (cb) => DeviceEventEmitter.addListener(EVENT, cb);

// ── 1. Completion ───────────────────────────────────────────────────────────
export const getCompleted = () => readJson(KEYS.completed, {});

export const setCompleted = async (dayNum, value) => {
  const map = await getCompleted();
  if (value) map[dayNum] = true; else delete map[dayNum];
  return writeJson(KEYS.completed, map);
};

// ── 2. Notes / reflections / testimonies per day ────────────────────────────
const BLANK_NOTE = { reflection: '', testimony: '', note: '', updated_at: null };

export const getNotes = () => readJson(KEYS.notes, {});

export const getDayNote = async (dayNum) => {
  const all = await getNotes();
  return { ...BLANK_NOTE, ...(all[dayNum] || {}) };
};

export const saveDayNote = async (dayNum, patch) => {
  const all  = await getNotes();
  const next = {
    ...(all[dayNum] || BLANK_NOTE),
    ...patch,
    updated_at: Date.now(),
  };
  all[dayNum] = next;
  await writeJson(KEYS.notes, all);
  return next;
};

// ── 3. User-added prayer points ─────────────────────────────────────────────
export const getCustomPoints = () => readJson(KEYS.custom, {});

export const getDayCustomPoints = async (dayNum) => {
  const all = await getCustomPoints();
  return Array.isArray(all[dayNum]) ? all[dayNum] : [];
};

export const addCustomPoint = async (dayNum, text) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  const all  = await getCustomPoints();
  const list = Array.isArray(all[dayNum]) ? all[dayNum] : [];
  const point = { id: uid(), text: trimmed, created_at: Date.now(), prayed: false };
  all[dayNum] = [...list, point];
  await writeJson(KEYS.custom, all);
  return point;
};

export const updateCustomPoint = async (dayNum, id, patch) => {
  const all  = await getCustomPoints();
  const list = Array.isArray(all[dayNum]) ? all[dayNum] : [];
  all[dayNum] = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await writeJson(KEYS.custom, all);
  return all[dayNum];
};

export const removeCustomPoint = async (dayNum, id) => {
  const all  = await getCustomPoints();
  const list = Array.isArray(all[dayNum]) ? all[dayNum] : [];
  all[dayNum] = list.filter((p) => p.id !== id);
  await writeJson(KEYS.custom, all);
  return all[dayNum];
};

// ── 4. Fasts (scheduled + active + history) ─────────────────────────────────
//    type: 'partial' | 'full' | 'daniel' | 'custom'
//    Each record may also carry:
//      • notif_ids: string[]  — OS notification ids scheduled for this fast
//      • completed: boolean   — manually marked done by the user
//
// Notification scheduling lives in ./fastingNotifications. We require it
// lazily to avoid a hard dependency on expo-notifications inside this module
// (keeps unit-testing the store easy and stops circular imports).
const fastingNotifs = () => {
  try { return require('./fastingNotifications'); }
  catch { return null; }
};

export const getFasts = () => readJson(KEYS.fasts, []);

export const addFast = async (fast) => {
  const list = await getFasts();
  const next = {
    id:        uid(),
    title:     fast.title || 'My Fast',
    type:      fast.type  || 'partial',
    startISO:  fast.startISO,
    endISO:    fast.endISO,
    recurring: fast.recurring || 'none',  // 'none' | 'daily' | 'weekly'
    notif_ids: [],
    created_at:Date.now(),
    completed: false,
  };
  await writeJson(KEYS.fasts, [...list, next]);
  // Fire-and-forget: schedule the start / midpoint / end alarms. The
  // notifications module will updateFast(next.id, { notif_ids }) once the
  // OS hands back ids.
  const mod = fastingNotifs();
  if (mod?.scheduleFastNotifications) {
    mod.scheduleFastNotifications(next).catch(() => {});
  }
  return next;
};

export const updateFast = async (id, patch) => {
  const list = await getFasts();
  const prev = list.find((f) => f.id === id);
  const next = list.map((f) => (f.id === id ? { ...f, ...patch } : f));
  await writeJson(KEYS.fasts, next);
  const merged = next.find((f) => f.id === id);

  // If the fast has just been marked complete or its window changed, sync
  // notifications accordingly. We compare against `prev` so a no-op patch
  // doesn't re-fire scheduling.
  const mod = fastingNotifs();
  if (mod && prev) {
    const becameComplete = !prev.completed && merged.completed;
    const windowChanged  = prev.startISO !== merged.startISO || prev.endISO !== merged.endISO;
    if (becameComplete && mod.cancelFastNotifications) {
      mod.cancelFastNotifications(prev).catch(() => {});
    } else if (windowChanged && !merged.completed && mod.scheduleFastNotifications) {
      mod.scheduleFastNotifications(merged).catch(() => {});
    }
  }
  return merged;
};

export const removeFast = async (id) => {
  const list  = await getFasts();
  const gone  = list.find((f) => f.id === id);
  const next  = list.filter((f) => f.id !== id);
  await writeJson(KEYS.fasts, next);
  // Cancel any pending alarms for the deleted fast so the user doesn't get
  // an "end of fast" alarm for a fast that no longer exists.
  const mod = fastingNotifs();
  if (mod?.cancelFastNotifications && gone) {
    mod.cancelFastNotifications(gone).catch(() => {});
  }
  return next;
};

// Currently-running fast (now is between start and end).
export const getActiveFast = async () => {
  const now  = Date.now();
  const list = await getFasts();
  return list.find((f) => {
    const start = new Date(f.startISO).getTime();
    const end   = new Date(f.endISO).getTime();
    return !f.completed && start <= now && now <= end;
  }) || null;
};

// ── 5. Recurring prayer reminders ───────────────────────────────────────────
//    days: [0..6] where 0 = Sunday
//    Each record also carries:
//      • notif_ids: string[]  — OS notification ids scheduled for this reminder
//                              (one per active weekday, set by the notification
//                              module after expo-notifications returns ids)
//
// Like the fasting layer, we keep the notifications module behind a lazy
// require so the store stays unit-testable without expo-notifications, and
// so a missing module never breaks reminder CRUD.
const reminderNotifs = () => {
  try { return require('./reminderNotifications'); }
  catch { return null; }
};

export const getReminders = () => readJson(KEYS.reminders, []);

export const addReminder = async (r) => {
  const list = await getReminders();
  const next = {
    id:    uid(),
    label: r.label || 'Prayer time',
    time:  r.time  || '06:00',           // HH:MM 24h
    days:  Array.isArray(r.days) ? r.days : [0,1,2,3,4,5,6],
    enabled: r.enabled !== false,
    notif_ids:  [],
    created_at: Date.now(),
  };
  await writeJson(KEYS.reminders, [...list, next]);
  // Fire-and-forget: schedule the per-weekday alarms. The notifications
  // module will updateReminder(next.id, { notif_ids }) once the OS hands
  // back ids.
  const mod = reminderNotifs();
  if (mod?.scheduleReminderNotifications) {
    mod.scheduleReminderNotifications(next).catch(() => {});
  }
  return next;
};

export const updateReminder = async (id, patch) => {
  const list = await getReminders();
  const prev = list.find((r) => r.id === id);
  const next = list.map((r) => (r.id === id ? { ...r, ...patch } : r));
  await writeJson(KEYS.reminders, next);
  const merged = next.find((r) => r.id === id);

  // Only re-schedule when an alarm-relevant field changed. Avoids feedback
  // loops when the notif module itself calls updateReminder(notif_ids).
  const mod = reminderNotifs();
  if (mod && prev && merged && patch && !('notif_ids' in patch)) {
    const fieldsChanged =
      prev.label   !== merged.label  ||
      prev.time    !== merged.time   ||
      prev.enabled !== merged.enabled ||
      JSON.stringify(prev.days || []) !== JSON.stringify(merged.days || []);
    if (fieldsChanged && mod.scheduleReminderNotifications) {
      mod.scheduleReminderNotifications(merged).catch(() => {});
    }
  }
  return merged;
};

export const removeReminder = async (id) => {
  const list  = await getReminders();
  const gone  = list.find((r) => r.id === id);
  const next  = list.filter((r) => r.id !== id);
  await writeJson(KEYS.reminders, next);
  // Cancel pending alarms so the user doesn't get notifications for a
  // reminder that no longer exists.
  const mod = reminderNotifs();
  if (mod?.cancelReminderNotifications && gone) {
    mod.cancelReminderNotifications(gone).catch(() => {});
  }
  return next;
};

// ── 6. Achievements ─────────────────────────────────────────────────────────
export const getAchievements = () => readJson(KEYS.achievements, {});

export const unlockAchievement = async (badgeId) => {
  const map = await getAchievements();
  if (map[badgeId]) return null;        // already unlocked
  map[badgeId] = { unlocked_at: Date.now() };
  await writeJson(KEYS.achievements, map);
  return badgeId;
};

// ── 7. Category prayers (user-created) ──────────────────────────────────────
export const getCategoryPrayers = () => readJson(KEYS.catPrayers, {});

export const getCategoryList = async (catId) => {
  const all = await getCategoryPrayers();
  return Array.isArray(all[catId]) ? all[catId] : [];
};

export const addCategoryPrayer = async (catId, payload) => {
  const all = await getCategoryPrayers();
  const list = Array.isArray(all[catId]) ? all[catId] : [];
  const next = {
    id:         uid(),
    title:      payload.title || 'Prayer',
    body:       payload.body  || '',
    scripture:  payload.scripture || '',
    created_at: Date.now(),
    prayed_count: 0,
    favourite:  false,
  };
  all[catId] = [...list, next];
  await writeJson(KEYS.catPrayers, all);
  return next;
};

export const updateCategoryPrayer = async (catId, id, patch) => {
  const all = await getCategoryPrayers();
  const list = Array.isArray(all[catId]) ? all[catId] : [];
  all[catId] = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await writeJson(KEYS.catPrayers, all);
  return all[catId].find((p) => p.id === id);
};

export const removeCategoryPrayer = async (catId, id) => {
  const all = await getCategoryPrayers();
  const list = (Array.isArray(all[catId]) ? all[catId] : []).filter((p) => p.id !== id);
  all[catId] = list;
  await writeJson(KEYS.catPrayers, all);
  return list;
};

// ── 8. Audio settings ───────────────────────────────────────────────────────
const DEFAULT_AUDIO = {
  ambient:  'piano',
  rate:     0.9,       // slightly slower default = clearer for unfamiliar voices
  pitch:    1.0,
  voice:    null,
  volume:   0.8,
  pauseSec: 0,         // seconds of silent reflection between segments (0 = none)
};

export const getAudioSettings = async () => {
  const v = await readJson(KEYS.audio, DEFAULT_AUDIO);
  return { ...DEFAULT_AUDIO, ...v };
};

export const saveAudioSettings = async (patch) => {
  const next = { ...(await getAudioSettings()), ...patch };
  return writeJson(KEYS.audio, next);
};

// ── 9. Audio room history + total minutes prayed ────────────────────────────
export const getRoomHistory = () => readJson(KEYS.rooms, []);

export const logRoomVisit = async (roomId, durationSec = 0) => {
  const list = await getRoomHistory();
  await writeJson(KEYS.rooms, [...list, { roomId, joined_at: Date.now(), duration_s: durationSec }]);
  if (durationSec > 0) await addTotalSeconds(durationSec);
};

export const getTotalSeconds = () => readJson(KEYS.totalSeconds, 0);

export const addTotalSeconds = async (sec) => {
  const cur = await getTotalSeconds();
  return writeJson(KEYS.totalSeconds, cur + Math.max(0, Math.floor(sec)));
};

// ── 10. User-created prayer rooms ───────────────────────────────────────────
// Mirrors the static catalogue shape in victoryAudioData.js so list/room
// screens can merge them with a simple spread.
const DEFAULT_GRADIENT = ['#1E3A8A', '#3B82F6'];

export const getUserRooms = () => readJson(KEYS.userRooms, []);

export const addUserRoom = async (room) => {
  const list = await getUserRooms();
  const next = {
    id:           `user-${uid()}`,
    kind:         room.kind || 'live',
    category:     room.category || 'Prayer',
    title:        (room.title || '').trim() || 'Untitled Prayer Room',
    host:         (room.host  || '').trim() || 'You',
    scripture:    (room.scripture || '').trim(),
    description:  (room.description || '').trim(),
    duration_min: Math.max(5, Math.min(240, Number(room.duration_min) || 30)),
    scheduled_at: room.scheduled_at || null,
    participants_simulated: Math.max(1, Math.floor(8 + Math.random() * 40)),
    ambient:      room.ambient || 'piano',
    accent:       room.accent  || '#1A56DB',
    gradient:     Array.isArray(room.gradient) && room.gradient.length >= 2
                    ? room.gradient
                    : DEFAULT_GRADIENT,
    owned:        true,
    created_at:   Date.now(),
  };
  await writeJson(KEYS.userRooms, [...list, next]);
  return next;
};

export const updateUserRoom = async (id, patch) => {
  const list = await getUserRooms();
  const next = list.map((r) => (r.id === id ? { ...r, ...patch } : r));
  await writeJson(KEYS.userRooms, next);
  return next.find((r) => r.id === id);
};

export const removeUserRoom = async (id) => {
  const list = (await getUserRooms()).filter((r) => r.id !== id);
  return writeJson(KEYS.userRooms, list);
};

// ── 11. Reset everything (debug / settings) ─────────────────────────────────
export const resetAllVictory = async () => {
  await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
  DeviceEventEmitter.emit(EVENT, { key: '__all__' });
};
