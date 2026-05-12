// components/FetchStates.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable loading skeleton and error view used by every data-fetching screen.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';

// ── Shimmer skeleton block ─────────────────────────────────────────────────────
const ShimmerBlock = ({ width = '100%', height = 16, radius = 8, T }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  return (
    <Animated.View
      style={{
        width, height, borderRadius: radius,
        backgroundColor: T?.divider || '#D6DEEE',
        opacity,
        marginBottom: 10,
      }}
    />
  );
};

// ── Full loading state for list screens ───────────────────────────────────────
export const LoadingState = ({ T, message }) => {
  const { t } = useLanguage();
  return (
    <View style={[st.center, { backgroundColor: T?.bg || '#FDF8EE' }]}>
      <ActivityIndicator size="large" color={BRAND.red} />
      <Text style={[st.loadingText, { color: T?.textMuted || '#6B7A99' }]}>{message || t('fetch_loading', 'Loading...')}</Text>
    </View>
  );
};

// ── Card skeleton for unit/lesson lists ──────────────────────────────────────
export const SkeletonList = ({ count = 4, T }) => (
  <View style={{ paddingHorizontal: 20, gap: 14, paddingTop: 20 }}>
    {Array.from({ length: count }).map((_, i) => (
      <View
        key={i}
        style={[st.skeletonCard, { backgroundColor: T?.card || '#FFFFFF', borderColor: T?.border || '#D6DEEE' }]}
      >
        <ShimmerBlock width={44} height={44} radius={12} T={T} />
        <View style={{ flex: 1, gap: 6 }}>
          <ShimmerBlock width="70%" height={14} T={T} />
          <ShimmerBlock width="90%" height={11} T={T} />
          <ShimmerBlock width="40%" height={10} T={T} />
        </View>
      </View>
    ))}
  </View>
);

// ── Full-screen error with retry ─────────────────────────────────────────────
export const ErrorState = ({ message, onRetry, T }) => {
  const { t } = useLanguage();
  return (
    <View style={[st.center, { backgroundColor: T?.bg || '#FDF8EE' }]}>
      <View style={[st.errorCard, { backgroundColor: T?.card || '#FFFFFF', borderColor: T?.border || '#D6DEEE' }]}>
        <Text style={st.errorEmoji}>⚠️</Text>
        <Text style={[st.errorTitle, { color: T?.textPrimary || '#0E1F47' }]}>
          {t('fetch_something_wrong', 'Something went wrong')}
        </Text>
        <Text style={[st.errorMsg, { color: T?.textMuted || '#6B7A99' }]}>
          {message || t('fetch_failed_load', 'Failed to load data. Please check your connection and try again.')}
        </Text>
        {onRetry && (
          <TouchableOpacity
            style={[st.retryBtn, { backgroundColor: BRAND.red }]}
            onPress={onRetry}
            activeOpacity={0.85}
          >
            <Text style={st.retryText}>{t('fetch_try_again', 'Try Again')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ── Empty state ──────────────────────────────────────────────────────────────
export const EmptyState = ({ message, T }) => {
  const { t } = useLanguage();
  return (
    <View style={[st.center, { backgroundColor: T?.bg || '#FDF8EE' }]}>
      <Text style={st.emptyEmoji}>📭</Text>
      <Text style={[st.errorMsg, { color: T?.textMuted || '#6B7A99' }]}>{message || t('fetch_no_content', 'No content found.')}</Text>
    </View>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  loadingText: { fontSize: 13, fontWeight: '600', marginTop: 8 },

  skeletonCard: {
    borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    padding: 18, gap: 16, borderWidth: 1,
  },

  errorCard: {
    borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1,
    width: '100%', gap: 10,
  },
  errorEmoji: { fontSize: 40 },
  errorTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  errorMsg:   { fontSize: 13, lineHeight: 20, textAlign: 'center', fontWeight: '500' },
  retryBtn:   { marginTop: 8, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  retryText:  { color: '#FFF', fontSize: 14, fontWeight: '900' },

  emptyEmoji: { fontSize: 40, marginBottom: 4 },
});