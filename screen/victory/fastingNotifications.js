// screen/victory/fastingNotifications.js
// ─────────────────────────────────────────────────────────────────────────────
// Local-notification scheduling for Victory Month fasts. Each fast gets up to
// three alarms:
//
//   • START      — gentle nudge when the fast begins
//   • MIDPOINT   — "halfway through" encouragement (only if fast ≥ 4 hours)
//   • END  ⏰    — the alarm the user wants when fasting time is over
//
// The END notification is the headline feature: high-priority, sound on, and
// routed to a `fastEnded` data type so taps deep-link to VictoryFastingHub.
//
// We persist the OS notification IDs *alongside* the fast itself (on the fast
// record, via updateFast), so we can cancel them cleanly on removeFast and
// on app-launch reconciliation we never schedule duplicates.
//
// All functions are best-effort: if permissions are denied or the platform
// rejects the trigger (e.g. the time is in the past), we swallow the error
// and the rest of the app keeps working.
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getFasts, updateFast } from './victoryStore';

const ANDROID_CHANNEL = 'gofamint_reminders';

const isFuture = (iso) => {
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) && ts > Date.now();
};

// ── Schedule one calendar-trigger notification at the given ISO time ────────
// Returns the OS notification id, or null on any error.
const scheduleAt = async (whenISO, content) => {
  if (!isFuture(whenISO)) return null;
  try {
    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(whenISO),
    };
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        ...content,
        sound: 'notification.wav',
        ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL }),
      },
      trigger,
    });
    return id || null;
  } catch (e) {
    console.warn('[Fast Notif] scheduleAt error:', e?.message);
    return null;
  }
};

// ── Cancel any previously scheduled notifications for this fast ─────────────
export const cancelFastNotifications = async (fast) => {
  if (!fast?.notif_ids?.length) return;
  for (const nid of fast.notif_ids) {
    if (!nid) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(nid);
    } catch { /* already fired / unknown id — ignore */ }
  }
};

// ── Schedule all alarms for a fast and persist the ids back onto it ─────────
// Idempotent: cancels any previously scheduled ids before scheduling again.
export const scheduleFastNotifications = async (fast) => {
  if (!fast?.id) return [];

  // Cancel old IDs first so a re-scheduled fast doesn't leave orphan alarms.
  await cancelFastNotifications(fast);

  const ids = [];
  const title = fast.title || 'My Fast';

  // 1. Start nudge — only schedule if start is still in the future.
  if (isFuture(fast.startISO)) {
    const id = await scheduleAt(fast.startISO, {
      title:    `🕯️ ${title} begins now`,
      body:     'Your fasting window has started. Stay close to the Lord through the hours ahead.',
      data:     { type: 'fastStarted', fastId: fast.id },
    });
    if (id) ids.push(id);
  }

  // 2. Midpoint encouragement — only when the fast is long enough to matter
  //    (4h+) and the midpoint hasn't passed yet.
  const startMs = new Date(fast.startISO).getTime();
  const endMs   = new Date(fast.endISO).getTime();
  const durMs   = endMs - startMs;
  if (Number.isFinite(durMs) && durMs >= 4 * 3600 * 1000) {
    const midISO = new Date(startMs + durMs / 2).toISOString();
    if (isFuture(midISO)) {
      const hoursLeft = Math.round(durMs / 2 / 3600000);
      const id = await scheduleAt(midISO, {
        title:    `⛅ Halfway through "${title}"`,
        body:     `${hoursLeft}h to go. Keep your heart soft and your eyes on God.`,
        data:     { type: 'fastMidpoint', fastId: fast.id },
      });
      if (id) ids.push(id);
    }
  }

  // 3. End alarm — the headline feature. High-priority, treated as an alarm.
  if (isFuture(fast.endISO)) {
    const id = await scheduleAt(fast.endISO, {
      title:        `⏰ Fasting time is over!`,
      body:         `"${title}" has ended. Break your fast in thanksgiving — God has heard you.`,
      data:         { type: 'fastEnded', fastId: fast.id },
      // Higher priority on Android; iOS uses interruptionLevel 'time-sensitive'
      // so it can break through Focus modes.
      priority:     Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: 'timeSensitive',
      vibrate:      [0, 300, 200, 300, 200, 300],
    });
    if (id) ids.push(id);
  }

  // Persist the new id list back onto the fast so the next update/remove
  // can reach them.
  if (ids.length) {
    try { await updateFast(fast.id, { notif_ids: ids }); } catch {}
  }
  return ids;
};

// ── Re-sync after app launch ────────────────────────────────────────────────
// Cancel notifications for completed / past fasts; re-schedule for fasts that
// are still in the future. Called from NotificationService.init().
export const rescheduleAllFasts = async () => {
  try {
    const list = await getFasts();
    for (const fast of list) {
      const endMs = new Date(fast.endISO).getTime();
      if (fast.completed || (Number.isFinite(endMs) && endMs <= Date.now())) {
        // Past / completed — cancel any leftover alarms.
        await cancelFastNotifications(fast);
        if (fast.notif_ids?.length) {
          try { await updateFast(fast.id, { notif_ids: [] }); } catch {}
        }
        continue;
      }
      // Future or in-flight — re-schedule. If startISO is already in the
      // past, scheduleFastNotifications skips the start alarm and only
      // schedules end (and possibly midpoint, if it's still ahead).
      await scheduleFastNotifications(fast);
    }
  } catch (e) {
    console.warn('[Fast Notif] rescheduleAllFasts error:', e?.message);
  }
};

// ── Convenience: mark a fast complete + cancel any pending alarms ──────────
export const markFastComplete = async (fast) => {
  if (!fast?.id) return;
  await cancelFastNotifications(fast);
  try { await updateFast(fast.id, { completed: true, notif_ids: [] }); } catch {}
};
