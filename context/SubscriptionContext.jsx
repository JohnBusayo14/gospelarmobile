// context/SubscriptionContext.js
// ─────────────────────────────────────────────────────────────────────────────
// RULES:
//   1. Server (DB) is the ONLY source of truth
//   2. hasChecked=false until server responds at least once with current email
//   3. While hasChecked=false → Guard shows spinner (never shows blur/modal)
//   4. isSubscribed only updated AFTER server responds
//   5. Cache = UI display only, never grants access
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

// Configurable via EXPO_PUBLIC_API_BASE_URL. Defaults to api.gospelar.com
// (CNAME → Railway); override in frontend/.env for local development.
export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.gospelar.com')
    .replace(/\/$/, '');

// Render's free plan can take 30–60s to wake from sleep. Generous timeouts
// prevent first-call cold-starts from looking like network failures to users.
const STATUS_TIMEOUT_MS  = 60_000;   // routine subscription status check
const PAYMENT_TIMEOUT_MS = 90_000;   // verify-payment (Paystack + DB write)

const CACHE_EXPIRY_KEY = 'gofamint_sub_expiry';
const CACHE_ACTIVE_KEY = 'gofamint_sub_active';
const STALE_KEYS       = ['subscriptionExpiry', 'gofamint_sub_expiry_old'];

const DEFAULT_PLANS = {
  single: { plan_id:'single', price_kobo: 50000,  days: 300 },
  all:    { plan_id:'all',    price_kobo: 100000, days: 300 },
};

const SubscriptionContext = createContext({
  isSubscribed:        false,
  // True only when the user holds a real Sunday-School plan ('single' or
  // 'all') — used by SubscriptionGuard so a Victory-Month-only buyer can't
  // walk into the SS flow.
  hasSundaySchool:     false,
  isLoading:           true,
  hasChecked:          false,
  serverError:         false,
  expiryDate:          null,
  daysRemaining:       null,
  subscribedCategory:  null,
  planType:            'single',
  email:               null,
  plans:               DEFAULT_PLANS,
  subscribedBooks:     [],
  refreshPlans:        () => {},
  canAccessCategory:   () => false,
  canAccessBook:       () => false,
  verifyPayment:       async () => ({ success: false }),
  recheck:             () => {},
});

// A Sunday-School plan is the only kind of subscription that grants access
// to category-gated screens. Book SKUs (plan_type starting with 'book_') do
// not. We bucket null/undefined/legacy values defensively.
const isSundaySchoolPlan = (planType) =>
  planType === 'single' || planType === 'all';

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }) => {
  const [isSubscribed,        setIsSubscribed]        = useState(false);
  const [daysRemaining,       setDaysRemaining]       = useState(null);
  const [isLoading,           setIsLoading]           = useState(true);
  const [hasChecked,          setHasChecked]          = useState(false);
  const [serverError,         setServerError]         = useState(false);
  const [expiryDate,          setExpiryDate]          = useState(null);
  const [email,               setEmail]               = useState(null);
  const [subscribedCategory,  setSubscribedCategory]  = useState(null);
  const [planType,            setPlanType]            = useState('single');
  const [plans,               setPlans]               = useState(DEFAULT_PLANS);
  // Per-book SKUs (e.g. 'victory_month_prayer'). Coexists with subscribedCategory:
  // category gates Sunday-School age groups, books gates whole library entries.
  const [subscribedBooks,     setSubscribedBooks]     = useState([]);
  const lastCheckedEmail = useRef(null);

  // ── Fetch admin-configured plan pricing ────────────────────────────────────
  const refreshPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/subscription/plans`);
      if (!res.ok) return;
      const rows = await res.json();
      const map  = { ...DEFAULT_PLANS };
      for (const p of rows || []) {
        if (p?.plan_id) map[p.plan_id] = p;
      }
      setPlans(map);
      await AsyncStorage.setItem('sub_plans_cache', JSON.stringify(map));
    } catch { /* keep current/default plans on failure */ }
  }, []);

  // Load cached plans synchronously then refresh from server
  useEffect(() => {
    AsyncStorage.getItem('sub_plans_cache')
      .then(s => { if (s) { try { setPlans(JSON.parse(s)); } catch {} } })
      .finally(refreshPlans);
  }, [refreshPlans]);

  const calculateDaysRemaining = (expiry) => {
    if (!expiry) return null;
    const today = new Date();
    const exp   = new Date(expiry);
    const diffTime = exp - today;
    const diffDays  = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const checkSubscription = useCallback(async () => {
    setIsLoading(true);
    setServerError(false);

    try {
      // Clean up legacy stale keys
      for (const key of STALE_KEYS) {
        try { await AsyncStorage.removeItem(key); } catch {}
      }

      const em = await AsyncStorage.getItem('userEmail');
      setEmail(em);

      // Email changed since last check — mark as unchecked so Guard shows spinner
      if (em !== lastCheckedEmail.current) {
        setHasChecked(false);
        setIsSubscribed(false);
        setExpiryDate(null);
        setDaysRemaining(null);
        setSubscribedCategory(null);
        setPlanType('single');
        setSubscribedBooks([]);
      }

      if (!em) {
        setIsSubscribed(false);
        setExpiryDate(null);
        setDaysRemaining(null);
        setHasChecked(true);
        setIsLoading(false);
        lastCheckedEmail.current = null;
        return;
      }

      // ── Query the server (the DB is the ONLY gate) ─────────────────────────
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);

        const res = await fetch(
          `${API_BASE_URL}/api/subscription/status/${encodeURIComponent(em)}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);

        if (res.ok) {
          const data   = await res.json();
          const active = data.active === true;
          const expiry = data.expiry_date || null;
          // Server returns a parsed array; defensive .filter handles legacy
          // shapes that might still send the raw comma-separated string.
          const books  = Array.isArray(data.subscribed_books)
            ? data.subscribed_books.filter(Boolean)
            : String(data.subscribed_books || '').split(',').map(s => s.trim()).filter(Boolean);

          console.log('[Sub] DB check → email:', em, '| active:', active, '| expiry:', expiry, '| books:', books);

          setIsSubscribed(active);
          setExpiryDate(active ? expiry : null);
          setDaysRemaining(active ? calculateDaysRemaining(expiry) : null);
          setSubscribedCategory(active ? (data.subscribed_category || 'adult') : null);
          setPlanType(active ? (data.plan_type || 'single') : 'single');
          // Per-book ownership survives even on category expiry — a user who
          // bought VMP once should keep access even if Sunday School expires.
          // (Same expiry_date today, but the design supports per-book TTLs later.)
          setSubscribedBooks(active ? books : []);

          // Cache for offline category-lock display (never grants server-side access)
          if (active) {
            await AsyncStorage.setItem('sub_category',  data.subscribed_category || 'all');
            await AsyncStorage.setItem('sub_plan_type', data.plan_type            || 'single');
            await AsyncStorage.setItem('sub_books',     JSON.stringify(books));
          } else {
            await AsyncStorage.multiRemove(['sub_category', 'sub_plan_type', 'sub_books']);
          }
          lastCheckedEmail.current = em;

          if (active && expiry) {
            await AsyncStorage.setItem(CACHE_EXPIRY_KEY, expiry);
            await AsyncStorage.setItem(CACHE_ACTIVE_KEY, '1');
          } else {
            await AsyncStorage.removeItem(CACHE_EXPIRY_KEY);
            await AsyncStorage.removeItem(CACHE_ACTIVE_KEY);
          }
        } else {
          console.warn('[Sub] Server returned status', res.status);
          setIsSubscribed(false);
          setDaysRemaining(null);
          lastCheckedEmail.current = em;
        }
      } catch (netErr) {
        console.warn('[Sub] Network error:', netErr.message);
        setServerError(true);
        // Do NOT change isSubscribed on network error — keep previous values for UX
        lastCheckedEmail.current = em;
      }

    } catch (e) {
      console.error('[Sub] Unexpected error:', e.message);
      setIsSubscribed(false);
      setDaysRemaining(null);
    } finally {
      setHasChecked(true);
      setIsLoading(false);
    }
  }, []);

  // Load cached sub data on mount so lock UI shows instantly (before server responds)
  useEffect(() => {
    const loadCache = async () => {
      try {
        const [cat, pt, booksRaw] = await Promise.all([
          AsyncStorage.getItem('sub_category'),
          AsyncStorage.getItem('sub_plan_type'),
          AsyncStorage.getItem('sub_books'),
        ]);
        if (cat) setSubscribedCategory(cat);
        if (pt)  setPlanType(pt);
        if (booksRaw) {
          try {
            const arr = JSON.parse(booksRaw);
            if (Array.isArray(arr)) setSubscribedBooks(arr);
          } catch {}
        }
      } catch {}
    };
    loadCache();
    checkSubscription();
  }, [checkSubscription]);

  // ── Session enforcement ────────────────────────────────────────────────────
  // Runs: (a) immediately on mount
  //       (b) every 5 s while the app is open
  //       (c) whenever the app returns to the foreground
  //
  // If the DB token no longer matches (another device logged in with force=true),
  // we clear storage, reset all subscription state, and trigger the global
  // force-logout which resets navigation to the Login screen.
  useEffect(() => {
    let pollingInterval = null;
    let isRunning       = false;

    const validateSession = async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        const token = await AsyncStorage.getItem('userToken');
        const em    = await AsyncStorage.getItem('userEmail');

        if (!token || !em) return;

        const response = await fetch(`${API_BASE_URL}/api/auth/validate-session`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: em, token }),
        });

        const data = await response.json();

        if (data.valid === false) {
          console.log('[Session] Token invalidated for', em, '— reason:', data.reason);

          if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }

          await AsyncStorage.multiRemove([
            'userToken', 'userEmail', 'userName', 'userRole',
            'gofamint_sub_expiry', 'gofamint_sub_active', 'isSubscribed',
            'sub_books',
          ]);

          setIsSubscribed(false);
          setHasChecked(false);
          setExpiryDate(null);
          setDaysRemaining(null);
          setSubscribedCategory(null);
          setPlanType('single');
          setSubscribedBooks([]);
          setEmail(null);
          lastCheckedEmail.current = null;

          if (global.__gofamintForceLogout) {
            global.__gofamintForceLogout();
          }
        }
      } catch (err) {
        console.warn('[Session] Validation network error:', err.message);
      } finally {
        isRunning = false;
      }
    };

    validateSession();
    pollingInterval = setInterval(validateSession, 5_000);

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') validateSession();
    });

    return () => {
      clearInterval(pollingInterval);
      appStateSub.remove();
    };
  }, []);

  // ── Payment verification ───────────────────────────────────────────────────
  // Accepts either a category SKU (Sunday School single/all plans) OR a book
  // SKU (Victory Month Prayer etc.). When `bookId` is provided, the server
  // appends to subscribed_books instead of overwriting subscribed_category.
  const verifyPayment = useCallback(async (reference, userEmail, category = 'all', bookId = null) => {
    try {
      console.log('[Sub] Verifying:', reference, 'for', userEmail, '| category:', category, '| book:', bookId);

      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), PAYMENT_TIMEOUT_MS);

      const body = { reference, email: userEmail, category };
      if (bookId) body.book_id = bookId;

      const res = await fetch(`${API_BASE_URL}/api/verify-payment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });
      clearTimeout(timer);

      const data   = await res.json();
      const ok     = data.success === true || data.status === 'success';
      const expiry = data.expiry_date || data.data?.expiry_date || null;

      // Bubble the structured error code/detail up to the caller so the
      // UI can show the actual reason ("Paystack rejected our credentials",
      // "Email mismatch", etc.) instead of a generic toast.
      if (!ok) {
        console.warn('[Sub] verify failed:', data.code, '|', data.message, '|', data.detail);
        return {
          success: false,
          code:    data.code || 'verify_failed',
          message: data.message || 'Payment could not be verified.',
          detail:  data.detail || null,
        };
      }

      if (ok) {
        const newPlanType = data.plan_type            || (category === 'all' ? 'all' : 'single');
        const newCategory = data.subscribed_category  || category;
        const newBooks    = Array.isArray(data.subscribed_books)
          ? data.subscribed_books.filter(Boolean)
          : (bookId ? [...new Set([...subscribedBooks, bookId])] : subscribedBooks);

        setIsSubscribed(true);
        setHasChecked(true);
        setExpiryDate(expiry);
        setDaysRemaining(calculateDaysRemaining(expiry));
        setSubscribedCategory(newCategory);
        setPlanType(newPlanType);
        setSubscribedBooks(newBooks);
        setEmail(userEmail);
        setServerError(false);
        lastCheckedEmail.current = userEmail;

        await AsyncStorage.setItem('sub_category',    newCategory);
        await AsyncStorage.setItem('sub_plan_type',   newPlanType);
        await AsyncStorage.setItem('sub_books',       JSON.stringify(newBooks));
        await AsyncStorage.setItem('userEmail',       userEmail);
        if (expiry) {
          await AsyncStorage.setItem(CACHE_EXPIRY_KEY, expiry);
          await AsyncStorage.setItem(CACHE_ACTIVE_KEY, '1');
        }
        console.log('[Sub] ✅ Activated | cat:', newCategory, '| plan:', newPlanType, '| books:', newBooks, '| until:', expiry);
        return { success: true };
      }
      // Unreachable — the !ok early-return above handles the failure path.
      return { success: false, message: 'Payment could not be verified.' };

    } catch (e) {
      console.error('[Sub] verifyPayment error:', e.name, e.message);
      if (e.name === 'AbortError')
        return { success: false, message: 'Connection timed out. Please try again.' };
      return { success: false, message: `Network error: ${e.message}` };
    }
  }, [subscribedBooks]);

  // ── Synchronous category access check (uses in-memory state) ──────────────
  // For a server-authoritative check use /api/subscription/can-access/:email/:catId.
  // Importantly: a per-book purchase (plan_type='book_*') must NOT grant
  // Sunday-School category access — historically a brand-new book-only buyer
  // ended up with subscribed_category='adult' because of a DB column default,
  // so we double-gate on plan_type here.
  const canAccessCategory = (categoryId) => {
    if (!isSubscribed) return false;
    if (!isSundaySchoolPlan(planType)) return false;
    if (planType === 'all' || subscribedCategory === 'all') return true;
    return subscribedCategory === categoryId;
  };

  // Derived: true iff the user holds a Sunday-School plan that's currently
  // active. SubscriptionGuard reads this to decide whether to let the user
  // into HomeScreen / Lessons / Devotional, etc.
  const hasSundaySchool = isSubscribed && isSundaySchoolPlan(planType);

  // ── Synchronous per-book access check ─────────────────────────────────────
  // Empty/undefined bookId → true (caller didn't specify a book; nothing to gate).
  // Server-authoritative variant: GET /api/subscription/can-access-book/:email/:bookId
  const canAccessBook = (bookId) => {
    if (!bookId) return true;
    if (!isSubscribed) return false;
    return subscribedBooks.includes(String(bookId).toLowerCase());
  };

  return (
    <SubscriptionContext.Provider value={{
      isSubscribed,
      hasSundaySchool,
      isLoading,
      hasChecked,
      serverError,
      expiryDate,
      daysRemaining,
      subscribedCategory,
      planType,
      email,
      plans,
      subscribedBooks,
      refreshPlans,
      canAccessCategory,
      canAccessBook,
      verifyPayment,
      recheck: checkSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};