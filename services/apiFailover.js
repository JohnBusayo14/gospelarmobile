// services/apiFailover.js
// ─────────────────────────────────────────────────────────────────────────────
// api.gospelar.com and api2.gospelar.com are two hostnames for the SAME backend
// (same Railway service, same database). This module wraps global.fetch so any
// request to either hostname goes to whichever one is healthy:
//
//   • Requests go to the preferred host (api.gospelar.com by default).
//   • If that host can't be reached (DNS / TLS / connection error), the same
//     request is retried once on the other host.
//   • GET/HEAD requests also fail over on gateway errors (502/503/504/52x).
//     Writes (POST/PUT/DELETE) only fail over on connection errors, so a
//     payment verify or progress save the server may already have processed
//     is never sent twice.
//   • A request the caller aborted (timeout / cancel) is never retried.
//   • After a failover the working host is remembered for 30 min (persisted
//     across launches), then the primary is tried again.
//
// Requests to any other origin (Paystack, Bible APIs, a local dev server)
// pass through untouched. Imported first in index.js so it's installed before
// any screen or service issues a request. Mirrors the web dashboards'
// src/apiFailover.js.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_HOSTS   = ['https://api.gospelar.com', 'https://api2.gospelar.com'];
export const PRIMARY_API = API_HOSTS[0];

const PREF_KEY  = 'gospelar_api_host';
const STICKY_MS = 30 * 60 * 1000;
const RETRY_STATUS = new Set([502, 503, 504, 520, 521, 522, 523, 524, 530]);
const IDEMPOTENT   = new Set(['GET', 'HEAD', 'OPTIONS']);

let state = { host: PRIMARY_API, at: 0 };

// Restore the last working host. Requests made before this resolves simply
// start from the primary and fail over if needed.
AsyncStorage.getItem(PREF_KEY)
  .then((raw) => {
    const p = raw ? JSON.parse(raw) : null;
    if (p && API_HOSTS.includes(p.host) && state.at === 0) state = p;
  })
  .catch(() => {});

export function activeApiHost() {
  if (state.host !== PRIMARY_API && Date.now() - state.at > STICKY_MS) {
    state = { host: PRIMARY_API, at: 0 };
  }
  return state.host;
}

function setActive(host) {
  if (host === state.host) return;
  state = { host, at: Date.now() };
  AsyncStorage.setItem(PREF_KEY, JSON.stringify(state)).catch(() => {});
}

function pathOf(url) {
  const h = API_HOSTS.find((x) => url === x || url.startsWith(x + '/'));
  return h ? url.slice(h.length) : null;
}

function install() {
  const nativeFetch = global.fetch;
  if (!nativeFetch || nativeFetch.__gospelarFailover) return;

  const wrapped = async (input, init = {}) => {
    const url  = typeof input === 'string' ? input : null;
    const path = url ? pathOf(url) : null;
    if (path == null) return nativeFetch(input, init);   // not our API → untouched

    const method = String(init?.method || 'GET').toUpperCase();
    const first  = activeApiHost();
    const order  = [first, ...API_HOSTS.filter((h) => h !== first)];
    let gatewayRes = null;
    let lastErr    = null;

    for (let i = 0; i < order.length; i++) {
      const host = order[i];
      const last = i === order.length - 1;
      try {
        const res = await nativeFetch(host + path, init);
        if (!last && IDEMPOTENT.has(method) && RETRY_STATUS.has(res.status)) {
          gatewayRes = res;                                  // try the other host
          continue;
        }
        if (!RETRY_STATUS.has(res.status)) setActive(host);
        return res;
      } catch (e) {
        if (init?.signal?.aborted || e?.name === 'AbortError') throw e;   // caller cancelled
        lastErr = e;
        if (last) break;
      }
    }
    if (gatewayRes) return gatewayRes;
    throw lastErr;
  };

  wrapped.__gospelarFailover = true;
  global.fetch = wrapped;
}

install();

// ── axios clients ────────────────────────────────────────────────────────────
// axios on React Native uses XMLHttpRequest, not fetch, so the wrapper above
// doesn't see its requests. Call withApiFailover(client) right after
// axios.create() to give an axios instance the same behaviour.
export function withApiFailover(client) {
  client.interceptors.request.use((config) => {
    const base = (config.baseURL || '').replace(/\/$/, '');
    if (!config.__gospelarRetried && pathOf(base) === '') {
      config.baseURL = activeApiHost();
      config.__gospelarHost = config.baseURL;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => {
      if (res.config?.__gospelarHost) setActive(res.config.__gospelarHost);
      return res;
    },
    (err) => {
      const config = err?.config;
      if (!config?.__gospelarHost || config.__gospelarRetried) return Promise.reject(err);
      if (err.code === 'ERR_CANCELED' || err.code === 'ECONNABORTED') return Promise.reject(err); // cancelled / timed out
      const status = err.response?.status;
      const method = String(config.method || 'get').toUpperCase();
      const unreachable = !err.response;
      const gateway     = status && RETRY_STATUS.has(status) && IDEMPOTENT.has(method);
      if (!unreachable && !gateway) {
        setActive(config.__gospelarHost);        // host answered (e.g. 401/404): it's up
        return Promise.reject(err);
      }
      const other = API_HOSTS.find((h) => h !== config.__gospelarHost);
      config.__gospelarRetried = true;
      config.__gospelarHost    = other;
      config.baseURL           = other;
      return client.request(config);
    },
  );
  return client;
}
