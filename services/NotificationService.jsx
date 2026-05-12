// // services/NotificationService.js
// // ─────────────────────────────────────────────────────────────────────────────
// // Notifications for Gospelar Sunday School:
// //   • Sunday School Quiz Reminder  — EVERY SUNDAY at 3:00 PM (constant, not configurable)
// //   • Daily Devotional Reminder    — every day at the user-configured time
// //
// // Requires:
// //   npx expo install expo-notifications expo-device
// // ─────────────────────────────────────────────────────────────────────────────

// import * as Notifications from 'expo-notifications';
// import * as Device        from 'expo-device';
// import AsyncStorage       from '@react-native-async-storage/async-storage';
// import { Platform }       from 'react-native';

// // ── Storage keys ──────────────────────────────────────────────────────────────
// const KEYS = {
//   devotionalEnabled: 'notif_dev_enabled',
//   devotionalHour:    'notif_dev_hour',
//   devotionalMinute:  'notif_dev_minute',
//   devotionalId:      'notif_dev_id',
//   sundayQuizId:      'notif_sunday_quiz_id',
//   permissionGranted: 'notif_permission',
// };

// // ── Sunday 3pm quiz — CONSTANT (users cannot change this) ─────────────────────
// export const SUNDAY_QUIZ = { weekday: 1, hour: 15, minute: 0 };
// // Note: expo-notifications weekday: 1 = Sunday

// // ── Devotional defaults ───────────────────────────────────────────────────────
// export const DEFAULTS = {
//   quiz:       { hour: 9,  minute: 0  },   // kept for API compat
//   devotional: { hour: 6,  minute: 30 },
// };

// // ── Foreground handler ────────────────────────────────────────────────────────
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge:  true,
//   }),
// });

// // ─────────────────────────────────────────────────────────────────────────────
// const NotificationService = {

//   // ── Request permission + setup Android channel ────────────────────────────
//   async requestPermission() {
//     if (!Device.isDevice) {
//       console.log('[Notif] Not a physical device — skipping permission');
//       return false;
//     }
//     try {
//       const { status: existing } = await Notifications.getPermissionsAsync();
//       let finalStatus = existing;
//       if (existing !== 'granted') {
//         const { status } = await Notifications.requestPermissionsAsync();
//         finalStatus = status;
//       }
//       if (finalStatus !== 'granted') {
//         console.warn('[Notif] Permission denied by user');
//         return false;
//       }
//       if (Platform.OS === 'android') {
//         await Notifications.setNotificationChannelAsync('gofamint_reminders', {
//           name:             'Gospelar Reminders',
//           importance:       Notifications.AndroidImportance.HIGH,
//           vibrationPattern: [0, 300, 200, 300],
//           lightColor:       '#1A56DB',
//           sound:            true,
//           enableVibrate:    true,
//         });
//       }
//       await AsyncStorage.setItem(KEYS.permissionGranted, '1');
//       return true;
//     } catch (e) {
//       console.warn('[Notif] requestPermission error:', e.message);
//       return false;
//     }
//   },

//   async hasPermission() {
//     try {
//       const { status } = await Notifications.getPermissionsAsync();
//       return status === 'granted';
//     } catch { return false; }
//   },

//   // ── Init — call from App.js ───────────────────────────────────────────────
//   async init() {
//     const granted = await this.requestPermission();
//     if (!granted) return;
//     await this._rescheduleFromStorage();
//   },

//   // ── SUNDAY QUIZ — every Sunday at 3:00 PM (constant, cannot be changed) ──
//   async scheduleSundayQuizReminder() {
//     try {
//       // Cancel existing first
//       const oldId = await AsyncStorage.getItem(KEYS.sundayQuizId);
//       if (oldId) {
//         await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
//       }

//       const trigger = Platform.OS === 'ios'
//         ? {
//             type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
//             weekday: SUNDAY_QUIZ.weekday,
//             hour:    SUNDAY_QUIZ.hour,
//             minute:  SUNDAY_QUIZ.minute,
//           }
//         : {
//             // Android: use calendar trigger for weekly
//             type:    'weekly',
//             weekday: SUNDAY_QUIZ.weekday,
//             hour:    SUNDAY_QUIZ.hour,
//             minute:  SUNDAY_QUIZ.minute,
//           };

//       const id = await Notifications.scheduleNotificationAsync({
//         content: {
//           title: '⚡ Sunday School Quiz Time!',
//           body:  "It's 3:00 PM — time for your weekly Sunday School lesson quiz. Tap to start now!",
//           sound: true,
//           data:  { type: 'quiz', time: '15:00' },
//           ...(Platform.OS === 'android' && { channelId: 'gofamint_reminders' }),
//         },
//         trigger,
//       });

//       await AsyncStorage.setItem(KEYS.sundayQuizId, id);
//       console.log('[Notif] Sunday quiz scheduled every Sunday at 3:00 PM — id:', id);
//       return id;
//     } catch (e) {
//       console.warn('[Notif] scheduleSundayQuizReminder error:', e.message);
//       return null;
//     }
//   },

//   async cancelSundayQuizReminder() {
//     try {
//       const id = await AsyncStorage.getItem(KEYS.sundayQuizId);
//       if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
//       await AsyncStorage.setItem(KEYS.sundayQuizId, '');
//     } catch (e) { console.warn('[Notif] cancelSundayQuizReminder:', e.message); }
//   },

//   // ── Kept for backward compat with SettingsScreen ──────────────────────────
//   async scheduleQuizReminder({ hour, minute } = {}) {
//     // Redirect to the Sunday-only scheduler — quiz is always Sunday 3pm
//     return this.scheduleSundayQuizReminder();
//   },
//   async cancelQuizReminder() {
//     return this.cancelSundayQuizReminder();
//   },

//   // ── DEVOTIONAL REMINDER — daily at user-configured time ──────────────────
//   async scheduleDevotionalReminder({ hour, minute, title, body } = {}) {
//     const h = (hour   !== undefined && hour   !== null) ? hour   : DEFAULTS.devotional.hour;
//     const m = (minute !== undefined && minute !== null) ? minute : DEFAULTS.devotional.minute;
//     try {
//       const oldId = await AsyncStorage.getItem(KEYS.devotionalId);
//       if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});

//       const trigger = Platform.OS === 'ios'
//         ? {
//             type:    Notifications.SchedulableTriggerInputTypes.DAILY,
//             hour:    h,
//             minute:  m,
//           }
//         : {
//             type:    'daily',
//             hour:    h,
//             minute:  m,
//           };

//       const id = await Notifications.scheduleNotificationAsync({
//         content: {
//           title: title || '📖 Daily Devotional Reading',
//           body:  body  || "Your daily devotional is ready. Open the app to start today's reading and reflection.",
//           sound: true,
//           data:  { type: 'devotional' },
//           ...(Platform.OS === 'android' && { channelId: 'gofamint_reminders' }),
//         },
//         trigger,
//       });

//       await AsyncStorage.multiSet([
//         [KEYS.devotionalEnabled, '1'],
//         [KEYS.devotionalHour,    String(h)],
//         [KEYS.devotionalMinute,  String(m)],
//         [KEYS.devotionalId,      id],
//       ]);
//       console.log('[Notif] Devotional reminder scheduled at', h + ':' + String(m).padStart(2,'0'), '— id:', id);
//       return id;
//     } catch (e) {
//       console.warn('[Notif] scheduleDevotionalReminder error:', e.message);
//       return null;
//     }
//   },

//   async cancelDevotionalReminder() {
//     try {
//       const id = await AsyncStorage.getItem(KEYS.devotionalId);
//       if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
//       await AsyncStorage.multiSet([
//         [KEYS.devotionalEnabled, '0'],
//         [KEYS.devotionalId,      ''],
//       ]);
//     } catch (e) { console.warn('[Notif] cancelDevotionalReminder:', e.message); }
//   },

//   async cancelAll() {
//     await Notifications.cancelAllScheduledNotificationsAsync();
//     await AsyncStorage.multiSet([
//       [KEYS.devotionalEnabled, '0'],
//       [KEYS.devotionalId,      ''],
//       [KEYS.sundayQuizId,      ''],
//     ]);
//   },

//   async loadSettings() {
//     try {
//       const vals = await AsyncStorage.multiGet([
//         KEYS.devotionalEnabled, KEYS.devotionalHour, KEYS.devotionalMinute,
//       ]);
//       const map = Object.fromEntries(vals);
//       return {
//         quiz: { enabled: true, hour: 15, minute: 0 },   // always Sunday 3pm
//         devotional: {
//           enabled: map[KEYS.devotionalEnabled] !== '0',
//           hour:    parseInt(map[KEYS.devotionalHour]   || String(DEFAULTS.devotional.hour),   10),
//           minute:  parseInt(map[KEYS.devotionalMinute] || String(DEFAULTS.devotional.minute), 10),
//         },
//       };
//     } catch {
//       return {
//         quiz:       { enabled: true, hour: 15, minute: 0 },
//         devotional: { enabled: true, ...DEFAULTS.devotional },
//       };
//     }
//   },

//   async _rescheduleFromStorage() {
//     try {
//       // Sunday quiz is ALWAYS scheduled (no user toggle)
//       await this.scheduleSundayQuizReminder();

//       const settings = await this.loadSettings();
//       if (settings.devotional.enabled) {
//         await this.scheduleDevotionalReminder(settings.devotional);
//       }
//     } catch (e) { console.warn('[Notif] _rescheduleFromStorage:', e.message); }
//   },

//   formatTime(hour, minute) {
//     const h    = hour % 12 || 12;
//     const m    = String(minute).padStart(2, '0');
//     const ampm = hour < 12 ? 'AM' : 'PM';
//     return `${h}:${m} ${ampm}`;
//   },
// };

// export default NotificationService;







// ─────────────────────────────────────────────────────────────────────────────
// Notifications for Gospelar Sunday School:
//   • Sunday School Quiz Reminder  — EVERY SUNDAY at 3:00 PM (constant)
//   • Daily Devotional Reminder    — every day at the user-configured time
//   • Test Loop                    — every 5 seconds (for development)
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEYS = {
  devotionalEnabled: 'notif_dev_enabled',
  devotionalHour: 'notif_dev_hour',
  devotionalMinute: 'notif_dev_minute',
  devotionalId: 'notif_dev_id',
  sundayQuizId: 'notif_sunday_quiz_id',
  permissionGranted: 'notif_permission',
};

// ── Configuration Constants ───────────────────────────────────────────────────
export const SUNDAY_QUIZ = { weekday: 1, hour: 15, minute: 0 }; // 1 = Sunday
export const DEFAULTS = {
  devotional: { hour: 6, minute: 30 },
};

// ── Foreground handler (Updated for SDK 53+) ──────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true, 
    shouldShowList: true,   
    shouldPlaySound: true, // Required for sound in foreground
    shouldSetBadge: true,
  }),
});

const NotificationService = {
  // ── Request permission + setup Android channel ────────────────────────────
  async requestPermission() {
    // Bypassed Device.isDevice check for Emulator testing
    if (!Device.isDevice) {
      console.log('[Notif] Running on Emulator — enabling for testing');
    }

    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[Notif] Permission denied by user');
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('gofamint_reminders', {
          name: 'Gospelar Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: '#1A56DB',
          sound: 'notification.wav', // Explicitly set custom sound for the channel
          enableVibrate: true,
        });
        console.log('[Notif] Android channel created with sound: notification.wav');
      }

      await AsyncStorage.setItem(KEYS.permissionGranted, '1');
      return true;
    } catch (e) {
      console.warn('[Notif] requestPermission error:', e.message);
      return false;
    }
  },

  // ── Init — call from App.js ───────────────────────────────────────────────
  async init() {
    const granted = await this.requestPermission();
    if (!granted) return;
    await this._rescheduleFromStorage();
    // Also re-sync any Victory Month fasting alarms. The user might have
    // scheduled a fast in a previous session; the OS only persists pending
    // notifications across cold launches if we re-register them.
    try {
      const { rescheduleAllFasts } = require('../screen/victory/fastingNotifications');
      if (rescheduleAllFasts) await rescheduleAllFasts();
    } catch (e) { /* victory module not present — ignore */ }
    // Same for the Victory Month prayer reminders — re-register every
    // enabled reminder's weekly alarms so cold launches don't lose them.
    try {
      const { rescheduleAllReminders } = require('../screen/victory/reminderNotifications');
      if (rescheduleAllReminders) await rescheduleAllReminders();
    } catch (e) { /* reminders module not present — ignore */ }
  },

  // ── DEBUG TOOL: Rapid-fire notifications every 5 seconds ──────────────────
  startTestLoop() {
    console.log('[Notif] Starting 5-second test loop...');
    const intervalId = setInterval(async () => {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔔 Gospeler Test Alert",
            body: `Testing sound at ${new Date().toLocaleTimeString()}`,
            sound: 'notification.wav', // Trigger the custom sound
            data: { type: 'test' },
            ...(Platform.OS === 'android' && { channelId: 'gofamint_reminders' }),
          },
          trigger: null, // Send immediately
        });
        console.log('[Notif] Notification sent with sound');
      } catch (e) {
        console.warn('[Notif] Test loop error:', e.message);
      }
    }, 5000);

    return intervalId;
  },

  // ── SUNDAY QUIZ — Fixed Weekly Trigger ────────────────────────────────────
  async scheduleSundayQuizReminder() {
    try {
      const oldId = await AsyncStorage.getItem(KEYS.sundayQuizId);
      if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});

      const trigger = {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: SUNDAY_QUIZ.weekday,
        hour: SUNDAY_QUIZ.hour,
        minute: SUNDAY_QUIZ.minute,
      };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚡ Sunday School Quiz Time!',
          body: "It's 3:00 PM — time for your weekly Sunday School lesson quiz.",
          sound: 'notification.wav',
          data: { type: 'quiz' },
          ...(Platform.OS === 'android' && { channelId: 'gofamint_reminders' }),
        },
        trigger,
      });

      await AsyncStorage.setItem(KEYS.sundayQuizId, id);
      return id;
    } catch (e) {
      console.warn('[Notif] scheduleSundayQuizReminder error:', e.message);
      return null;
    }
  },

  // ── DEVOTIONAL REMINDER — Daily Trigger ──────────────────────────────────
  async scheduleDevotionalReminder({ hour, minute } = {}) {
    const h = hour ?? DEFAULTS.devotional.hour;
    const m = minute ?? DEFAULTS.devotional.minute;
    try {
      const oldId = await AsyncStorage.getItem(KEYS.devotionalId);
      if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});

      const trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: h,
        minute: m,
      };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 Daily Devotional Reading',
          body: "Your daily devotional is ready. Open the app to start today's reading.",
          sound: 'notification.wav',
          data: { type: 'devotional' },
          ...(Platform.OS === 'android' && { channelId: 'gofamint_reminders' }),
        },
        trigger,
      });

      await AsyncStorage.multiSet([
        [KEYS.devotionalEnabled, '1'],
        [KEYS.devotionalHour, String(h)],
        [KEYS.devotionalMinute, String(m)],
        [KEYS.devotionalId, id],
      ]);
      return id;
    } catch (e) {
      console.warn('[Notif] scheduleDevotionalReminder error:', e.message);
      return null;
    }
  },

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.multiSet([
      [KEYS.devotionalEnabled, '0'],
      [KEYS.devotionalId, ''],
      [KEYS.sundayQuizId, ''],
    ]);
  },

  async _rescheduleFromStorage() {
    try {
      await this.scheduleSundayQuizReminder();
      const vals = await AsyncStorage.multiGet([KEYS.devotionalEnabled, KEYS.devotionalHour, KEYS.devotionalMinute]);
      const map = Object.fromEntries(vals);
      if (map[KEYS.devotionalEnabled] === '1') {
        await this.scheduleDevotionalReminder({
          hour: parseInt(map[KEYS.devotionalHour], 10),
          minute: parseInt(map[KEYS.devotionalMinute], 10),
        });
      }
    } catch (e) {
      console.warn('[Notif] _rescheduleFromStorage error:', e.message);
    }
  },
};

export default NotificationService;