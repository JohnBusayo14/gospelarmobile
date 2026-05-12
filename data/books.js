// data/books.js
// ─────────────────────────────────────────────────────────────────────────────
// Library catalog — the source of truth for every book the app surfaces on
// the launcher (frontend/screen/LibraryScreen.jsx).
//
// Why this lives in a single file:
//   • The shape below is deliberately the same JSON we'll later return from
//     `GET /api/books`. When the admin-side CRUD is built, the migration is
//     to replace the body of this module with a cacheFirst() fetch — no
//     screen code changes.
//   • Adding a new book is a one-entry diff here. No new screens, routes,
//     or services need to land in lockstep.
//
// Per-entry shape:
//   id          — stable slug, used for analytics keys + future API paths +
//                 the suffix on the subscription_plans.plan_id ('book_<id>')
//   title       — card heading
//   subtitle    — one-line context line under the title
//   description — longer copy shown in BookPaywallScreen + Coming-Soon alert
//   cover       — require(...) image module ref
//   accent      — hex color for the gradient overlay + status pill
//   available   — false → "Coming Soon" alert on tap (no homepage exists yet)
//                 true  → tap navigates to .route (after paywall if locked)
//   requiresSubscription — true → tap is gated by canAccessBook(); locked
//                 cards open BookPaywallScreen.
//                 false → tap goes straight to .route (e.g. Sunday School
//                 still uses its own category gate, not the book gate).
//   pricing     — { price_kobo, plan_id } pair for the Subscribe CTA. Matches
//                 a row in the backend subscription_plans table.
//   route       — only used when available + (subscribed OR !requiresSubscription).
//   routeParams — optional params object passed to navigation.navigate(...)
//   preview     — array of 3 sample-content rows shown in BookPaywallScreen
//                 to hint at what the user is paying for.
// ─────────────────────────────────────────────────────────────────────────────

export const BOOKS = [
  {
    id:          'sunday_school',
    title:       'Sunday School Manual',
    subtitle:    'Weekly lessons · 4 age groups',
    description: '13 weekly expositions per quarter across Adult, Youth, Intermediate, and Children. Quizzes, hymns, and daily devotionals included.',
    cover:       require('../assets/adult.jpg'),
    accent:      '#1A56DB',
    available:   true,
    // Sunday School keeps its existing per-category gate (canAccessCategory)
    // and its own /SubscriptionScreen flow — book-level gating is opt-in,
    // not retrofitted onto the legacy product.
    requiresSubscription: false,
    route:       'HomeScreen',
    routeParams: undefined,
  },
  {
    id:          'victory_month_prayer',
    title:       'Victory Month Prayer',
    subtitle:    '31-day prayer focus',
    description: 'Walk through 31 days of Spirit-led prayer, scripture meditation, and bold declarations. Each day pairs a focused theme with practical prayer points and a reflection prompt.',
    cover:       require('../assets/children.jpg'),
    accent:      '#F97316',
    available:   true,
    requiresSubscription: true,
    pricing: { price_kobo: 50000, plan_id: 'book_victory_month_prayer' },
    route:       'VictoryMonthHome',
    routeParams: undefined,
    preview: [
      { day: 1,  title: 'The God of New Beginnings', scripture: 'Isaiah 43:18–19' },
      { day: 2,  title: 'Breakthrough',              scripture: 'Psalm 18:29'     },
      { day: 3,  title: 'Restoration',               scripture: 'Joel 2:25'       },
    ],
  },
  {
    id:          'teacher_manual',
    title:       'Teacher Manual',
    subtitle:    'Lesson plans + class notes',
    description: 'Coming soon — guidance and weekly lesson plans for Sunday School teachers, including discussion prompts and class activities.',
    cover:       require('../assets/youth.jpg'),
    accent:      '#10B981',
    available:   false,
  },
];
