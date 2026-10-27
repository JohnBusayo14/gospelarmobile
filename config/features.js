// config/features.js
// ─────────────────────────────────────────────────────────────────────────────
// Feature flags. Flip SUBSCRIPTIONS_ENABLED to re-activate the subscribe /
// paywall flow — all the code (PaymentScreen, SubscriptionGuard, BookGuard,
// trial logic) is intact and simply bypassed while this is false.
//
// Override per build with EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true.
// ─────────────────────────────────────────────────────────────────────────────
export const SUBSCRIPTIONS_ENABLED =
  process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';
