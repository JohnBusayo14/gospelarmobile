// screen/victory/reminderNotifications.js
// ─────────────────────────────────────────────────────────────────────────────
// Local-notification scheduling for Victory Month *recurring prayer reminders*.
//
// Each reminder record looks like:
//   { id, label, time: 'HH:MM', days: [0..6], enabled, notif_ids: [] }
//
// A reminder that fires every day at 06:00 is scheduled as seven weekly
// triggers (one per weekday) — that's the most reliable cross-platform recipe
// with expo-notifications, and it gives us per-day cancellation if the user
// later un-checks a day. Sunday is `weekday: 1` in expo-notifications (mirrors
// the Calendar API).
//
// The persisted OS notification ids live on the reminder record (notif_ids),
// so updates can cancel cleanly without leaking alarms. All functions are
// best-effort: permission denial, past-time triggers, or platform rejection
// are swallowed so the rest of the app keeps working.
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getReminders, updateReminder } from './victoryStore';

const ANDROID_CHANNEL = 'gofamint_reminders';

// expo-notifications uses weekday: 1 = Sunday, 7 = Saturday. Our reminder
// `days` array uses 0 = Sunday, 6 = Saturday (matches JS Date.getDay).
const toExpoWeekday = (jsDay) => ((Number(jsDay) || 0) + 1);

// ── Schedule a single weekly trigger for one weekday/time combination ───────
const scheduleWeekly = async (jsWeekday, hour, minute, content) => {
  try {
    const trigger = {
      type:    Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: toExpoWeekday(jsWeekday),
      hour,
      minute,
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
    console.warn('[Reminder Notif] scheduleWeekly error:', e?.message);
    return null;
  }
};

// ── Cancel every notification belonging to this reminder ───────────────────
export const cancelReminderNotifications = async (reminder) => {
  if (!reminder?.notif_ids?.length) return;
  for (const nid of reminder.notif_ids) {
    if (!nid) continue;
    try { await Notifications.cancelScheduledNotificationAsync(nid); }
    catch { /* already fired / unknown id — ignore */ }
  }
};

// Parse "HH:MM" into { hour, minute }; returns null when the string is
// malformed so we don't schedule a garbage trigger.
const parseTime = (str) => {
  const m = String(str || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour   = Math.max(0, Math.min(23, Number(m[1])));
  const minute = Math.max(0, Math.min(59, Number(m[2])));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
};

// ── Schedule a reminder — one weekly trigger per active weekday ─────────────
// Idempotent: cancels any previously scheduled ids before re-scheduling.
export const scheduleReminderNotifications = async (reminder) => {
  if (!reminder?.id) return [];

  // Always start clean. The user may have edited the time / days; the old
  // alarms would otherwise still fire on the old schedule.
  await cancelReminderNotifications(reminder);

  // Disabled reminders don't get scheduled, but they keep their record so
  // the user can re-enable later without losing the configuration.
  if (reminder.enabled === false) {
    try { await updateReminder(reminder.id, { notif_ids: [] }); } catch {}
    return [];
  }

  const time = parseTime(reminder.time);
  if (!time) return [];

  const days = Array.isArray(reminder.days) && reminder.days.length
    ? reminder.days
    : [0, 1, 2, 3, 4, 5, 6];

  const label = reminder.label || 'Prayer time';
  const ids   = [];

  for (const d of days) {
    const id = await scheduleWeekly(d, time.hour, time.minute, {
      title: `🔔 ${label}`,
      body:  'A quiet moment with God. Tap to open your prayer points.',
      data:  { type: 'prayerReminder', reminderId: reminder.id },
    });
    if (id) ids.push(id);
  }

  if (ids.length) {
    try { await updateReminder(reminder.id, { notif_ids: ids }); } catch {}
  }
  return ids;
};

// ── Re-sync after app launch ────────────────────────────────────────────────
// Re-schedule every enabled reminder so cold launches don't lose their
// alarms. The OS sometimes drops scheduled notifications after long idle
// periods, OS updates, or app reinstalls; this guarantees the user's
// configuration survives.
export const rescheduleAllReminders = async () => {
  try {
    const list = await getReminders();
    for (const r of list) {
      if (r?.enabled === false) {
        // Make sure any leftover alarms from a previous "enabled" state are
        // cancelled. This handles users who flipped a reminder off before
        // a force-stop / reinstall.
        await cancelReminderNotifications(r);
        if (r.notif_ids?.length) {
          try { await updateReminder(r.id, { notif_ids: [] }); } catch {}
        }
        continue;
      }
      await scheduleReminderNotifications(r);
    }
  } catch (e) {
    console.warn('[Reminder Notif] rescheduleAllReminders error:', e?.message);
  }
};

// Cancel every reminder alarm (used when the user wipes notifications or
// signs out).
export const cancelAllReminders = async () => {
  try {
    const list = await getReminders();
    for (const r of list) {
      await cancelReminderNotifications(r);
      if (r.notif_ids?.length) {
        try { await updateReminder(r.id, { notif_ids: [] }); } catch {}
      }
    }
  } catch (e) {
    console.warn('[Reminder Notif] cancelAllReminders error:', e?.message);
  }
};
