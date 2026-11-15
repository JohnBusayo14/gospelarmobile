// config/features.js
// ─────────────────────────────────────────────────────────────────────────────
// Feature flags.
//
// The app is FREEMIUM:
//   • Free     — Sunday School lessons, devotionals, Bible, hymnal… with ads.
//   • Premium  — one paid plan (the admin-priced 'all' plan, ₦1,000 by
//                default): no ads anywhere, plus premium books such as
//                Victory Month Prayer.
//
// PREMIUM_ENABLED (default ON) — the Premium plan: ad-free for subscribers and
// the paywall on premium books. EXPO_PUBLIC_PREMIUM_ENABLED=false turns it off
// (every book open, ads for everyone).
//
// SUBSCRIPTIONS_ENABLED (default OFF) — the legacy hard paywall on Sunday
// School itself (SubscriptionGuard) plus the one-time 30-day free trial.
// Leave it off for the freemium model. EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true
// brings it back.
// ─────────────────────────────────────────────────────────────────────────────
export const PREMIUM_ENABLED =
  process.env.EXPO_PUBLIC_PREMIUM_ENABLED !== 'false';

export const SUBSCRIPTIONS_ENABLED =
  process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';
