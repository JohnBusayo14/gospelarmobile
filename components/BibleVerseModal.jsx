// components/BibleVerseModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Slide-up modal that fetches and displays Bible verse text.
// Design tokens match Homescreen / CombinedUnitsPage exactly (L/D system).
// Usage:
//   <BibleVerseModal
//     reference="John 3:16"
//     visible={true}
//     onClose={() => setVisible(false)}
//     isDark={isDark}
//   />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Animated, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchVerse }     from '../services/bibleApi';
import { API_BASE_URL } from '../context/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';

const { height, width } = Dimensions.get('window');
const SHEET_H = height * 0.72;

// ── Design tokens — same as Homescreen.js ────────────────────────────────────
const L = {
  bg:          '#FFFFFF',
  surface:     '#F7F8FA',
  border:      '#EEEFF2',
  textPrimary: '#111827',
  textSec:     '#6B7280',
  textMuted:   '#9CA3AF',
};
const D = {
  bg:          '#0F1117',
  surface:     '#1A1D27',
  border:      '#2A2D3A',
  textPrimary: '#F9FAFB',
  textSec:     '#9CA3AF',
  textMuted:   '#6B7280',
};

// Accent cycle — same as rest of app
const ACCENTS = ['#2563EB', '#7C3AED', '#10B981', '#F97316', '#EF4444', '#0891B2'];
const PASTEL_PAIR = [
  ['#EFF6FF', '#DBEAFE'],
  ['#F5F3FF', '#EDE9FE'],
  ['#ECFDF5', '#D1FAE5'],
  ['#FFF7ED', '#FFEDD5'],
  ['#FFF1F2', '#FFE4E6'],
  ['#ECFEFF', '#CFFAFE'],
];

// Pick a consistent accent + pastel based on the first char of the reference
function hashRef(ref = '') {
  let h = 0;
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) & 0xff;
  const idx = h % ACCENTS.length;
  return { accent: ACCENTS[idx], pastel: PASTEL_PAIR[idx] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual verse row
// ─────────────────────────────────────────────────────────────────────────────
const VerseRow = ({ verse, accent, tk, isFirst }) => (
  <View style={[vr.row, !isFirst && { borderTopWidth: 1, borderTopColor: tk.border }]}>
    <View style={[vr.numBadge, { backgroundColor: accent + '18', borderColor: accent + '35', borderWidth: 1 }]}>
      <Text style={[vr.num, { color: accent }]}>{verse.verse}</Text>
    </View>
    <Text style={[vr.text, { color: tk.textPrimary }]}>{verse.text.trim()}</Text>
  </View>
);
const vr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 16 },
  numBadge: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 2, marginRight: 12 },
  num:      { fontSize: 11, fontWeight: '900' },
  text:     { flex: 1, fontSize: 15.5, lineHeight: 25, fontWeight: '400' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────
export default function BibleVerseModal({ reference, visible, onClose, isDark }) {
  const { t } = useLanguage();
  const tk     = (isDark === true ? D : L) || L;
  const { accent, pastel } = hashRef(reference);

  const [phase,  setPhase]  = useState('idle'); // idle | loading | done | error
  const [data,   setData]   = useState(null);
  const [errMsg, setErrMsg] = useState('');

  // Sheet animation
  const slideY    = useRef(new Animated.Value(SHEET_H)).current;
  const backdropO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY,    { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 130 }),
        Animated.timing(backdropO, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
      if (reference) loadVerse(reference);
    } else {
      Animated.parallel([
        Animated.timing(slideY,    { toValue: SHEET_H, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 0,        duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, reference]);

  const loadVerse = useCallback(async (ref) => {
    setPhase('loading');
    setData(null);
    setErrMsg('');
    try {
      // ── Check admin-managed DB verses first ─────────────────────────────
      try {
        const dbRes = await fetch(
          `${API_BASE_URL}/api/bible-verse/${encodeURIComponent(ref)}`
        );
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData.text) {
            setData({
              reference:        ref,
              text:             dbData.text,
              verses:           [{ text: dbData.text }],
              translation_name: dbData.version || 'Admin',
              source:           'db',
            });
            setPhase('done');
            return;
          }
        }
      } catch { /* DB not available — fall through to external API */ }

      // ── Fall back to bible-api.com ──────────────────────────────────────
      const result = await fetchVerse(ref);
      setData(result);
      setPhase('done');
    } catch (e) {
      setErrMsg(e.message || t('bv_could_not_load', 'Could not load verse.'));
      setPhase('error');
    }
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropO }]}>
        <TouchableOpacity style={s.backdropTouch} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { backgroundColor: tk.bg, transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Drag handle */}
        <View style={[s.handle, { backgroundColor: tk.border }]} />

        {/* Header gradient */}
        <LinearGradient colors={pastel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.headerGrad}>
          {/* Decorative circle */}
          <View style={[s.decoCircle, { backgroundColor: accent + '20' }]} />

          <View style={s.headerContent}>
            {/* Book tag */}
            <View style={[s.bookTag, { backgroundColor: accent }]}>
              <Text style={s.bookTagText}>{t('bv_bible_tag', 'BIBLE')}</Text>
            </View>

            {/* Reference */}
            <Text style={[s.refText, { color: '#111827' }]}>
              {data?.reference || reference}
            </Text>

            {/* Translation */}
            {!!data?.translationName && (
              <View style={[s.transPill, { backgroundColor: '#fff', borderColor: tk.border }]}>
                <Text style={[s.transText, { color: tk.textSec }]}>
                  📖 {data.translationName}
                </Text>
              </View>
            )}
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={[s.closeBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }]}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Text style={[s.closeBtnText, { color: tk.textPrimary }]}>✕</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Body */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}
        >

          {/* Loading */}
          {phase === 'loading' && (
            <View style={s.centerState}>
              <ActivityIndicator color={accent} size="large" />
              <Text style={[s.stateText, { color: tk.textMuted }]}>
                {t('bv_loading_ref', 'Loading {ref}…').replace('{ref}', String(reference || ''))}
              </Text>
            </View>
          )}

          {/* Error */}
          {phase === 'error' && (
            <View style={s.centerState}>
              <Text style={s.errEmoji}>📖</Text>
              <Text style={[s.stateTitle, { color: tk.textPrimary }]}>
                {t('bv_verse_not_found', 'Verse not found')}
              </Text>
              <Text style={[s.stateText, { color: tk.textMuted }]}>
                {errMsg}
              </Text>
              <TouchableOpacity
                onPress={() => loadVerse(reference)}
                activeOpacity={0.75}
                style={[s.retryBtn, { backgroundColor: accent }]}
              >
                <Text style={s.retryText}>{t('bv_try_again', 'Try again')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Verses */}
          {phase === 'done' && data && (
            <>
              {/* Full text block (single verse) */}
              {data.verses.length === 1 && (
                <View style={[s.singleVerseCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                  <View style={[s.singleStripe, { backgroundColor: accent }]} />
                  <View style={s.singleBody}>
                    <Text style={s.openQuote}>"</Text>
                    <Text style={[s.singleText, { color: tk.textPrimary }]}>
                      {data.text}
                    </Text>
                    <View style={[s.singleRefRow, { borderTopColor: tk.border }]}>
                      <Text style={[s.singleRef, { color: accent }]}>
                        — {data.reference}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Multi-verse list */}
              {data.verses.length > 1 && (
                <View style={[s.multiCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                  <View style={[s.multiStripe, { backgroundColor: accent }]} />
                  {data.verses.map((v, i) => (
                    <VerseRow key={i} verse={v} accent={accent} tk={tk} isFirst={i === 0} />
                  ))}
                </View>
              )}

              {/* Share/copy hint */}
              <View style={s.hintRow}>
                <Text style={[s.hintText, { color: tk.textMuted }]}>
                  World English Bible (WEB) · bible-api.com
                </Text>
              </View>
            </>
          )}

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch:  { flex: 1 },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_H, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 0 },

  // Header gradient
  headerGrad: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    position: 'relative', overflow: 'hidden',
  },
  decoCircle: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    top: -50, right: -40,
  },
  headerContent: { paddingRight: 48 },
  bookTag:      { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  bookTagText:  { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  refText:      { fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginBottom: 10, lineHeight: 28 },
  transPill:    { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  transText:    { fontSize: 12, fontWeight: '600' },

  closeBtn:     { position: 'absolute', top: 18, right: 18, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '700' },

  // Center states
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  errEmoji:    { fontSize: 40, marginBottom: 16 },
  stateTitle:  { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  stateText:   { fontSize: 13.5, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  retryBtn:    { borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  retryText:   { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Single verse card
  singleVerseCard: {
    marginHorizontal: 20, marginTop: 20, borderRadius: 20, borderWidth: 1,
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  singleStripe: { height: 4 },
  singleBody:   { padding: 20 },
  openQuote:    { fontSize: 60, fontWeight: '900', color: '#F59E0B', lineHeight: 48, marginBottom: -10 },
  singleText:   { fontSize: 17, lineHeight: 28, fontWeight: '400', fontStyle: 'italic' },
  singleRefRow: { borderTopWidth: 1, marginTop: 18, paddingTop: 14 },
  singleRef:    { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },

  // Multi-verse card
  multiCard: {
    marginHorizontal: 20, marginTop: 20, borderRadius: 20, borderWidth: 1,
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  multiStripe: { height: 4 },

  // Hint row
  hintRow:  { alignItems: 'center', marginTop: 16, marginBottom: 8 },
  hintText: { fontSize: 11, fontWeight: '500' },
});