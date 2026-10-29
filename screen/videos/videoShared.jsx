// screen/videos/videoShared.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks shared by the video library, player and admin
// screens. Visual language follows LibraryScreen: theme/tokens.js colours,
// PALETTE.blue primary, heavy-weight headings, rounded cards, ICONS registry.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PALETTE } from '../../theme/tokens';
import { ICONS } from '../../components/icons';

export const BLUE = PALETTE.blue;

export const ageLabel = (ag, t) => ({
  children: t('vid_age_children', 'Children'),
  teens:    t('vid_age_teens', 'Teenagers'),
  adults:   t('vid_age_adults', 'Adults'),
  all:      t('vid_age_all', 'All ages'),
}[ag] || ag);

// Stable accent per category so placeholder thumbnails are distinguishable.
const ACCENTS = ['#1A56DB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#0EA5E9', '#EF4444'];
export function categoryAccent(category) {
  let h = 0;
  for (const ch of String(category || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function goToLogin(navigation) {
  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
}

// ── Header ───────────────────────────────────────────────────────────────────
export function ScreenHeader({ title, subtitle, onBack, right, tk, t }) {
  return (
    <View style={s.header}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('btn_back', 'Back')}
        style={[s.iconBtn, { backgroundColor: tk.surfaceEl }]}
      >
        <ICONS.ArrowLeft color={tk.textPrimary} size={18} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[s.headerTitle, { color: tk.textPrimary }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {!!subtitle && <Text style={[s.headerSub, { color: tk.textMuted }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

// ── Chips & pills ────────────────────────────────────────────────────────────
export function Chip({ label, active, onPress, tk }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[s.chip, active ? { backgroundColor: BLUE, borderColor: BLUE } : { backgroundColor: tk.surface, borderColor: tk.border }]}
    >
      <Text style={[s.chipTxt, { color: active ? '#fff' : tk.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Pill({ label, color, solid }) {
  return (
    <View style={[s.pill, { backgroundColor: solid ? color : color + '1F' }]}>
      <Text style={[s.pillTxt, { color: solid ? '#fff' : color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── Thumbnail ────────────────────────────────────────────────────────────────
// Signed thumbnail URL when present, otherwise a category-tinted gradient
// with a play glyph — never a blank box.
export function VideoThumb({ video, style, radius = 14, showPlay = true, children }) {
  const accent = categoryAccent(video?.category);
  return (
    <View style={[{ aspectRatio: 16 / 9, borderRadius: radius, overflow: 'hidden', backgroundColor: accent }, style]}>
      {video?.thumbnail_url ? (
        <Image source={{ uri: video.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={[accent, accent + 'AA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {showPlay && (
        <View style={s.playWrap} pointerEvents="none">
          <View style={s.playBtn}><ICONS.Play color="#fff" size={18} fill="#fff" /></View>
        </View>
      )}
      {children}
    </View>
  );
}

export function ProgressBar({ fraction, color = BLUE, track = 'rgba(255,255,255,0.35)', height = 4, style }) {
  const pct = Math.max(0, Math.min(1, Number(fraction) || 0));
  return (
    <View style={[{ height, backgroundColor: track, borderRadius: height }, style]}>
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

// ── Session expired ──────────────────────────────────────────────────────────
export function SessionExpiredState({ navigation, tk, t }) {
  return (
    <View style={s.center}>
      <View style={[s.notice, { backgroundColor: tk.surface, borderColor: tk.border }]}>
        <ICONS.Lock color={BLUE} size={30} />
        <Text style={[s.noticeTitle, { color: tk.textPrimary }]}>{t('vid_session_title', 'Please sign in again')}</Text>
        <Text style={[s.noticeMsg, { color: tk.textSec }]}>
          {t('vid_session_msg', 'Your session has expired. Sign in to keep watching.')}
        </Text>
        <TouchableOpacity onPress={() => goToLogin(navigation)} style={[s.primaryBtn, { backgroundColor: BLUE }]} accessibilityRole="button">
          <Text style={s.primaryBtnTxt}>{t('sign_in', 'Sign In')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Inline message card used for empty / error states inside lists, so the
// header and filters stay visible (unlike the full-screen FetchStates views).
export function InlineNotice({ icon = 'Info', title, message, actionLabel, onAction, tk, color = BLUE }) {
  const Icon = ICONS[icon] || ICONS.Info;
  return (
    <View style={[s.notice, { backgroundColor: tk.surface, borderColor: tk.border, marginHorizontal: 20, marginTop: 24 }]}>
      <Icon color={color} size={30} />
      {!!title && <Text style={[s.noticeTitle, { color: tk.textPrimary }]}>{title}</Text>}
      {!!message && <Text style={[s.noticeMsg, { color: tk.textSec }]}>{message}</Text>}
      {!!actionLabel && (
        <TouchableOpacity onPress={onAction} style={[s.primaryBtn, { backgroundColor: color }]} accessibilityRole="button">
          <Text style={s.primaryBtnTxt}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  chip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  chipTxt: { fontSize: 13, fontWeight: '800' },

  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', paddingLeft: 3,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notice: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 10 },
  noticeTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  noticeMsg: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', fontWeight: '500' },
  primaryBtn: { marginTop: 6, borderRadius: 12, paddingHorizontal: 24, minHeight: 44, justifyContent: 'center' },
  primaryBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
