// components/BookGuard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Per-book access gate. Wraps any screen that belongs to a paid book; if the
// user doesn't own that book, redirects to BookPaywallScreen.
//
// Mirrors SubscriptionGuard.jsx (which gates the Sunday-School category flow)
// — different scope, same trust model:
//   • Server (the subscribed_books column) is the authoritative gate
//   • The in-context canAccessBook() is the local mirror used for instant UI
//   • hasChecked=false → render a loader (never flash content the user
//     hasn't paid for, never flash the paywall to a paying user)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useSubscription }  from '../context/SubscriptionContext';
import { useTheme }         from '../context/ThemeContext';

export default function BookGuard({ bookId, navigation, children }) {
  const { hasChecked, canAccessBook } = useSubscription();
  const { isDark } = useTheme();

  const allowed = canAccessBook(bookId);

  useEffect(() => {
    // Redirect after the first authoritative check has landed. `replace` (not
    // `navigate`) so the back button doesn't drop the user back onto the
    // protected screen they just got bounced from.
    if (hasChecked && !allowed) {
      navigation.replace('BookPaywall', { bookId });
    }
  }, [hasChecked, allowed, bookId, navigation]);

  if (!hasChecked || !allowed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#000' : '#fff' }}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }
  return children;
}
