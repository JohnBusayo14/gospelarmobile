// services/notificationRouting.js
// ─────────────────────────────────────────────────────────────────────────────
// One place that knows where a notification goes when tapped — used for phone
// pushes (App.js, including the tap that cold-starts the app) and for rows on
// the in-app Notifications page.
//
// `data` is the push payload / inbox item data:
//   { type: 'video', videoId }          new Sunday School video
//   { type: 'book', slug }              new/updated book (opened via Library so
//                                       paywalls and per-book routing apply)
//   { type: 'screen', screen }          admin announcement → a whitelisted screen
//   { type: 'url', url }                admin announcement → web link
//   { type: 'inbox' }                   admin announcement with no link
//   quiz / devotional / fast* / prayerReminder — local reminders
// ─────────────────────────────────────────────────────────────────────────────

import { Linking } from 'react-native';
import { markRead } from './inbox';

const SCREENS = ['Library', 'HomeScreen', 'PaymentScreen', 'VideoLibrary', 'Bible', 'Notifications'];

// Screens the app shows before the user is signed in / past start-up. A tap
// that arrives while one of these is showing is held until the app gets past.
export const STARTUP_ROUTES = ['SplashScreen', 'Onboarding', 'Login', 'Register'];

export function openNotificationTarget(nav, data = {}, { fromInbox = false } = {}) {
  if (!nav) return;
  if (data.notificationId) markRead(data.notificationId);
  const type = data.type;

  if (type === 'video' && data.videoId) {
    nav.navigate('VideoPlayer', { videoId: data.videoId });
  } else if (type === 'book' && data.slug) {
    nav.navigate('Library', { openBook: data.slug });
  } else if (type === 'screen' && SCREENS.includes(data.screen)) {
    nav.navigate(data.screen);
  } else if (type === 'url' && /^https:\/\//i.test(data.url || '')) {
    Linking.openURL(data.url).catch(() => {});
  } else if (type === 'quiz' || type === 'devotional') {
    nav.navigate('HomeScreen');
  } else if (type === 'fastEnded' || type === 'fastStarted' || type === 'fastMidpoint') {
    nav.navigate('VictoryFastingHub');
  } else if (type === 'prayerReminder') {
    nav.navigate('VictoryReminders');
  } else if (!fromInbox && data.notificationId) {
    // Announcement without a link — show it in the inbox.
    nav.navigate('Notifications');
  }
}
