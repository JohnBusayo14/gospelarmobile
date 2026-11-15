// services/inbox.js
// ─────────────────────────────────────────────────────────────────────────────
// In-app notification inbox (backend: GET /api/app-notifications).
//
// Read state lives on the device: everything older than `lastSeenAt` (set when
// the Notifications page is opened) counts as read, plus individually tapped
// ids (a push tapped from the phone's tray). The unread count is shared via a
// tiny pub/sub so the Library bell updates live.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

const K_SEEN  = 'inbox_last_seen_at';
const K_READ  = 'inbox_read_ids';
const K_CACHE = 'inbox_cache';

let unread = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(unread); } catch {} });

async function readState() {
  const [seen, ids] = await Promise.all([AsyncStorage.getItem(K_SEEN), AsyncStorage.getItem(K_READ)]);
  let readIds = [];
  try { readIds = JSON.parse(ids || '[]'); } catch {}
  return { lastSeenAt: seen ? new Date(seen).getTime() : 0, readIds: new Set(readIds) };
}

export const isUnread = (item, state) =>
  new Date(item.created_at).getTime() > state.lastSeenAt && !state.readIds.has(item.id);

// Fetch the inbox. Signed-in users send their session so personal and
// plan-specific notifications are included.
export async function fetchInbox() {
  const [email, token, lang] = await Promise.all([
    AsyncStorage.getItem('userEmail'),
    AsyncStorage.getItem('userToken'),
    AsyncStorage.getItem('app_lang'),
  ]);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${API_BASE_URL}/api/app-notifications?lang=${encodeURIComponent(lang || 'en')}`, {
      headers: email && token ? { 'x-user-email': email, 'x-user-token': token } : {},
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data.notifications) ? data.notifications : [];
    AsyncStorage.setItem(K_CACHE, JSON.stringify({ owner: email || '', items })).catch(() => {});
    await recount(items);
    return { items, offline: false };
  } catch {
    // Offline → last cached list (only if it belongs to this account, so a
    // different user on the same phone never sees someone else's messages).
    let items = [];
    try {
      const c = JSON.parse((await AsyncStorage.getItem(K_CACHE)) || '{}');
      if ((c.owner || '') === (email || '') && Array.isArray(c.items)) items = c.items;
    } catch {}
    return { items, offline: true };
  } finally {
    clearTimeout(timer);
  }
}

async function recount(items) {
  const st = await readState();
  unread = items.filter((i) => isUnread(i, st)).length;
  emit();
}

export async function refreshUnread() {
  await fetchInbox().catch(() => {});
}

export async function getReadState() {
  return readState();
}

// Opening the Notifications page marks everything up to now as seen.
export async function markAllSeen() {
  await AsyncStorage.multiSet([[K_SEEN, new Date().toISOString()], [K_READ, '[]']]);
  unread = 0;
  emit();
}

export async function markRead(id) {
  if (!id) return;
  try {
    const st = await readState();
    if (st.readIds.has(id)) return;
    const ids = [...st.readIds, id].slice(-200);
    await AsyncStorage.setItem(K_READ, JSON.stringify(ids));
    if (unread > 0) { unread -= 1; emit(); }
  } catch {}
}

// Live unread count for badges. Refreshes on mount and when the app returns
// to the foreground.
export function useUnreadCount() {
  const [n, setN] = useState(unread);
  useEffect(() => {
    listeners.add(setN);
    refreshUnread();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshUnread(); });
    return () => { listeners.delete(setN); sub.remove(); };
  }, []);
  return n;
}
