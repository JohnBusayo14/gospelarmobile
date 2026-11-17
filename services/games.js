// services/games.js
// ─────────────────────────────────────────────────────────────────────────────
// Bible Games: local progress (works offline) + XP reporting to the server.
//
//   • Local stats live in AsyncStorage under 'games_stats_v1':
//       { trivia: { best, plays, unlocked, levels: { [n]: best } }, ... ,
//         totalXp }
//   • submitGameXp(game, score) posts to POST /api/games/score with the
//     saved session token. Offline or failed posts are queued and retried on
//     the next submit / when the Games hub opens. The server applies the daily
//     XP cap, so retries can never over-award.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { withApiFailover } from './apiFailover';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './api';

const K_STATS   = 'games_stats_v1';
const K_PENDING = 'games_pending_xp_v1';
const MAX_PENDING = 30;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});
withApiFailover(client);
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('userToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Local stats ──────────────────────────────────────────────────────────────
export async function getGameStats() {
  try {
    const raw = await AsyncStorage.getItem(K_STATS);
    const s = raw ? JSON.parse(raw) : {};
    return s && typeof s === 'object' ? s : {};
  } catch { return {}; }
}

async function saveGameStats(s) {
  try { await AsyncStorage.setItem(K_STATS, JSON.stringify(s)); } catch {}
}

// Merge a finished round into local stats. Returns the updated game entry.
//   extra.level / extra.passed → per-level bests and unlocking (trivia).
export async function recordRound(game, score, extra = {}) {
  const s = await getGameStats();
  const g = s[game] || { best: 0, plays: 0, unlocked: 1, levels: {} };
  g.plays = (g.plays || 0) + 1;
  g.best  = Math.max(g.best || 0, score);
  if (extra.level) {
    g.levels = g.levels || {};
    g.levels[extra.level] = Math.max(g.levels[extra.level] || 0, score);
    if (extra.passed) g.unlocked = Math.max(g.unlocked || 1, extra.level + 1);
  }
  s[game] = g;
  await saveGameStats(s);
  return g;
}

// XP the server confirmed, kept locally for the hub's hero number.
async function addLocalXp(xp) {
  if (!(xp > 0)) return;
  const s = await getGameStats();
  s.totalXp = (s.totalXp || 0) + xp;
  await saveGameStats(s);
}

// ── XP reporting ─────────────────────────────────────────────────────────────
async function readPending() {
  try { return JSON.parse((await AsyncStorage.getItem(K_PENDING)) || '[]') || []; } catch { return []; }
}
async function writePending(list) {
  try { await AsyncStorage.setItem(K_PENDING, JSON.stringify(list.slice(-MAX_PENDING))); } catch {}
}

async function post(item) {
  const { data } = await client.post('/api/games/score', item);
  await addLocalXp(data?.xp_awarded || 0);
  return data;
}

// Retry anything queued while offline. 4xx (bad/expired session, unknown
// game) is dropped — retrying can't fix it.
export async function flushPendingXp() {
  const token = await AsyncStorage.getItem('userToken');
  if (!token) return;
  const list = await readPending();
  if (!list.length) return;
  const keep = [];
  for (const item of list) {
    try { await post(item); }
    catch (e) {
      const st = e?.response?.status;
      if (!st || st >= 500) keep.push(item);
    }
  }
  await writePending(keep);
}

// Fire-and-forget from the game screen. Resolves { xp_awarded } or null.
export async function submitGameXp(game, score, meta = {}) {
  const token = await AsyncStorage.getItem('userToken');
  if (!token || !(score > 0)) return null;
  const item = { game, score: Math.round(score), meta };
  flushPendingXp().catch(() => {});
  try {
    return await post(item);
  } catch (e) {
    const st = e?.response?.status;
    if (!st || st >= 500) await writePending([...(await readPending()), item]);
    return null;
  }
}

export async function fetchServerGameStats() {
  try {
    const { data } = await client.get('/api/games/stats');
    return data;
  } catch { return null; }
}

// ── Small helpers shared by the games ────────────────────────────────────────
export const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Games only know four content languages; anything else plays in English.
export const gameLang = (lang) => (['en', 'yo', 'ig', 'ha'].includes(lang) ? lang : 'en');

// ── Rewards (XP → vouchers) ──────────────────────────────────────────────────
// Errors carry .reason ('not_enough_xp' | 'out_of_stock' | 'limit_reached' |
// 'account_too_new') and the server's plain-English message.
const rewardError = (e) => {
  const err = new Error(e?.response?.data?.error || e?.message || 'Something went wrong.');
  err.reason = e?.response?.data?.reason;
  err.status = e?.response?.status;
  return err;
};
export async function fetchRewards() {
  try { return (await client.get('/api/rewards')).data; } catch (e) { throw rewardError(e); }
}
export async function redeemReward(id, bank) {
  try { return (await client.post(`/api/rewards/${id}/redeem`, bank || {})).data; } catch (e) { throw rewardError(e); }
}
export async function fetchMyVouchers() {
  try { return (await client.get('/api/rewards/mine')).data.redemptions || []; } catch (e) { throw rewardError(e); }
}
