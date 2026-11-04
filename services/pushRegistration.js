// services/pushRegistration.js
// ─────────────────────────────────────────────────────────────────────────────
// Registers this device for server push notifications (new videos, new and
// updated Library books — backend services/push.js). Gets the Expo push
// token, creates the Android "content_updates" channel the server sends on,
// and tells the backend the token + signed-in email + app language.
//
// Safe to call any time (app start, after sign-in, language change): it never
// throws, and it only re-posts when the token/email/language changed or the
// last registration is over a day old.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

export const CONTENT_CHANNEL = 'content_updates';
const LAST_KEY = 'push_registration';
const REFRESH_MS = 24 * 60 * 60 * 1000;

const projectId = () =>
  Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

async function ensurePermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

export async function registerForPush({ force = false } = {}) {
  try {
    if (!Device.isDevice) return null;                  // simulators can't receive push
    if (!(await ensurePermission())) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CONTENT_CHANNEL, {
        name: 'New videos & book updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#1A56DB',
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    if (!token) return null;

    const [email, lang, lastRaw] = await Promise.all([
      AsyncStorage.getItem('userEmail'),
      AsyncStorage.getItem('app_lang'),
      AsyncStorage.getItem(LAST_KEY),
    ]);
    const sig = `${token}|${email || ''}|${lang || 'en'}`;
    let last = null;
    try { last = lastRaw ? JSON.parse(lastRaw) : null; } catch {}
    if (!force && last?.sig === sig && Date.now() - (last.at || 0) < REFRESH_MS) return token;

    const res = await fetch(`${API_BASE_URL}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email: email || null, lang: lang || 'en', platform: Platform.OS }),
    });
    if (res.ok) await AsyncStorage.setItem(LAST_KEY, JSON.stringify({ sig, at: Date.now() }));
    return token;
  } catch (e) {
    console.warn('[Push] registration skipped:', e?.message);
    return null;
  }
}
