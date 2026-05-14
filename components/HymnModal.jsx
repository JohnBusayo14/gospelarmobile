// components/HymnModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Slide-up modal that displays Gospel Hymn Book lyrics.
// Fetches from /api/hymns?numbers=75,433 — local data.hymns used as fallback
// when offline or the number isn't in the DB yet.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Animated, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchHymns as fetchHymnsApi } from '../services/api';
import { useLanguage }    from '../context/LanguageContext';
// Parse "G.H.B. 75, 433" → [75, 433] — data always comes from the API
function parseHymnRef(ref) {
  if (!ref || typeof ref !== 'string') return [];
  const stripped = ref.replace(/G\.?\s*H\.?\s*B\.?\s*/i, '').trim();
  if (!stripped) return [];
  return stripped
    .split(/[\s,]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0);
}

const { height } = Dimensions.get('window');
const SHEET_H    = height * 0.82;

// ── Design tokens ─────────────────────────────────────────────────────────────
const L = { bg:'#FFFFFF', surface:'#F7F8FA', border:'#EEEFF2', textPrimary:'#111827', textSec:'#6B7280', textMuted:'#9CA3AF' };
const D = { bg:'#0F1117',  surface:'#1A1D27', border:'#2A2D3A', textPrimary:'#F9FAFB', textSec:'#9CA3AF',  textMuted:'#6B7280' };

const GRADIENTS = [
  ['#FFF7ED','#FFEDD5','#FED7AA'],
  ['#F5F3FF','#EDE9FE','#DDD6FE'],
  ['#ECFDF5','#D1FAE5','#A7F3D0'],
  ['#EFF6FF','#DBEAFE','#BFDBFE'],
];
const ACCENTS = ['#F97316','#7C3AED','#10B981','#2563EB'];

const palette = (i) => ({
  grad:   GRADIENTS[i % GRADIENTS.length],
  accent: ACCENTS[i   % ACCENTS.length],
});

// ─── sub-components ───────────────────────────────────────────────────────────
// `text` can be a plain string (legacy bundled data) or a `{text, number}`
// object (the shape JSONB returns from the hymns.verses column). Normalise
// here so VerseBlock always gets a string to render — without this guard,
// React throws "Objects are not valid as a React child".
const verseString = (v) =>
  v == null ? '' : (typeof v === 'string' ? v : String(v.text ?? ''));
const verseNumber = (v, fallback) =>
  v && typeof v === 'object' && Number.isFinite(v.number) ? v.number : fallback;

const VerseBlock = ({ text, label, accent, tk, t = (_,f)=>f }) => (
  <View style={[vb.wrap, { borderColor: tk.border }]}>
    <View style={[vb.badge, { backgroundColor: accent + '18', borderColor: accent + '35', borderWidth: 1 }]}>
      <Text style={[vb.num, { color: accent }]}>{label || t('hymn_verse_n', 'Verse {n}').replace('{n}', '1')}</Text>
    </View>
    <Text style={[vb.text, { color: tk.textPrimary }]}>{verseString(text)}</Text>
  </View>
);
const vb = StyleSheet.create({
  wrap:  { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  num:   { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  text:  { fontSize: 15.5, lineHeight: 27, fontStyle: 'italic' },
});

const ChorusBlock = ({ text, accent, tk, t = (_,f)=>f }) => (
  <LinearGradient
    colors={[accent + '18', accent + '06']}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={[cb.wrap, { borderColor: accent + '40' }]}
  >
    <View style={[cb.label, { backgroundColor: accent }]}>
      <Text style={cb.labelTxt}>{t('hymn_chorus', 'CHORUS')}</Text>
    </View>
    <Text style={[cb.text, { color: tk.textPrimary }]}>{text}</Text>
  </LinearGradient>
);
const cb = StyleSheet.create({
  wrap:     { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 10 },
  label:    { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  labelTxt: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  text:     { fontSize: 15.5, lineHeight: 27, fontWeight: '600' },
});

// ─── Single hymn view ─────────────────────────────────────────────────────────
const HymnView = ({ hymn, colorIdx, tk, t = (_,f)=>f }) => {
  const { grad, accent } = palette(colorIdx);

  if (!hymn) return (
    <View style={hv.empty}>
      <Text style={hv.emptyEmoji}>🎵</Text>
      <Text style={[hv.emptyTitle, { color: tk.textPrimary }]}>{t('hymn_not_found', 'Hymn not found')}</Text>
      <Text style={[hv.emptySub,   { color: tk.textMuted   }]}>{t('hymn_not_in_db', "This number isn't in the database yet.")}</Text>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Header card */}
      <LinearGradient colors={grad} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={hv.headerCard}>
        <View style={[hv.decoCircle, { backgroundColor: accent + '22' }]} />
        <View style={[hv.numPill, { backgroundColor: accent }]}>
          <Text style={hv.numPillTxt}>{t('hymn_ghb_number', 'G.H.B. No. {n}').replace('{n}', String(hymn.number))}</Text>
        </View>
        <Text style={[hv.title, { color: '#111827' }]}>{hymn.title}</Text>
        {!!hymn.author && <Text style={[hv.author, { color: '#6B7280' }]}>{hymn.author}</Text>}
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        {/* Scripture intro */}
        <View style={[hv.intro, { backgroundColor: accent + '10', borderColor: accent + '30' }]}>
          <Text style={{ fontSize: 16 }}>🎵</Text>
          <Text style={[hv.introTxt, { color: accent }]}>
            {t('hymn_intro_verse', 'Sing to the Lord a new song; sing to the Lord, all the earth. — Psalm 96:1')}
          </Text>
        </View>

        {/* Verses interleaved with chorus. Verses can be strings or
            {text, number} objects from JSONB — verseString() inside VerseBlock
            handles both. */}
        {(hymn.verses || []).map((verse, i) => {
          const n = verseNumber(verse, i + 1);
          return (
            <React.Fragment key={i}>
              <VerseBlock
                text={verse}
                label={t('hymn_verse_n', 'Verse {n}').replace('{n}', String(n))}
                accent={accent}
                tk={tk}
                t={t}
              />
              {!!hymn.chorus && (
                <ChorusBlock text={hymn.chorus} accent={accent} tk={tk} t={t} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
  );
};
const hv = StyleSheet.create({
  headerCard:  { marginHorizontal: 20, borderRadius: 20, padding: 20, overflow: 'hidden', position: 'relative' },
  decoCircle:  { position: 'absolute', width: 140, height: 140, borderRadius: 70, top: -35, right: -35 },
  numPill:     { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  numPillTxt:  { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  title:       { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, lineHeight: 27, marginBottom: 6 },
  author:      { fontSize: 12, fontWeight: '500' },
  intro:       { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  introTxt:    { flex: 1, fontSize: 12, fontStyle: 'italic', fontWeight: '600', lineHeight: 18, marginLeft: 8 },
  empty:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyEmoji:  { fontSize: 48, marginBottom: 16 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptySub:    { fontSize: 13.5, textAlign: 'center', lineHeight: 21 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────
export default function HymnModal({ hymnRef, visible, onClose, isDark }) {
  const { t } = useLanguage();
  const tk      = (isDark === true ? D : L) || L;
  const numbers = parseHymnRef(hymnRef || '');

  const [phase,    setPhase]    = useState('idle');   // idle | loading | done | error
  const [hymns,    setHymns]    = useState([]);  // always an array
  const [errMsg,   setErrMsg]   = useState('');
  const [pageIdx,  setPageIdx]  = useState(0);

  // Sheet animation
  const slideY    = useRef(new Animated.Value(SHEET_H)).current;
  const backdropO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setPageIdx(0);
      Animated.parallel([
        Animated.spring(slideY,    { toValue: 0,       useNativeDriver: true, damping: 22, stiffness: 130 }),
        Animated.timing(backdropO, { toValue: 1,       duration: 260, useNativeDriver: true }),
      ]).start();
      if (numbers.length > 0) fetchHymns(numbers);
    } else {
      Animated.parallel([
        Animated.timing(slideY,    { toValue: SHEET_H, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 0,       duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, hymnRef]);

  const fetchHymns = async (nums) => {
    setPhase('loading');
    setHymns([]);
    setErrMsg('');
    try {
      const data = await fetchHymnsApi(nums);
      const merged = nums.map((n) =>
        Array.isArray(data) ? data.find((h) => h && h.number === n) || null : null,
      );
      setHymns(merged);
      setPhase('done');
    } catch (e) {
      console.error('HymnModal: hymn fetch failed:', e.message);
      setErrMsg(e.message || t('hymn_could_not_connect', 'Could not connect to server. Check your network.'));
      setPhase('error');
    }
  };

  const { accent } = palette(pageIdx);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropO }]}>
        <TouchableOpacity style={s.backdropTouch} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { backgroundColor: tk.bg, transform: [{ translateY: slideY }] }]}>
        <View style={[s.handle, { backgroundColor: tk.border }]} />

        {/* Top bar */}
        <View style={[s.topBar, { borderBottomColor: tk.border }]}>
          <View style={s.topLeft}>
            <View style={[s.musicIcon, { backgroundColor: accent + '18' }]}>
              <Text style={{ fontSize: 18 }}>🎵</Text>
            </View>
            <View>
              <Text style={[s.sheetTitle, { color: tk.textPrimary }]}>{t('hymn_gospel_hymn_book', 'Gospel Hymn Book')}</Text>
              <Text style={[s.sheetSub,   { color: tk.textMuted   }]}>{hymnRef}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose} activeOpacity={0.75}
            style={[s.closeBtn, { backgroundColor: tk.surface }]}
          >
            <Text style={[s.closeTxt, { color: tk.textSec }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Hymn number tabs when multiple */}
        {phase === 'done' && Array.isArray(hymns) && hymns.length > 1 && (
          <View style={[s.tabRow, { borderBottomColor: tk.border }]}>
            {(Array.isArray(hymns) ? hymns : []).map((hymn, i) => {
              const { accent: a } = palette(i);
              const active = i === pageIdx;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setPageIdx(i)}
                  activeOpacity={0.75}
                  style={[s.tab, { backgroundColor: active ? a : tk.surface, borderColor: active ? a : tk.border }]}
                >
                  <Text style={[s.tabTxt, { color: active ? '#fff' : tk.textSec }]}>
                    {t('hymn_no_n', 'No. {n}').replace('{n}', String(numbers[i]))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Body */}
        {phase === 'loading' && (
          <View style={s.center}>
            <ActivityIndicator color={accent} size="large" />
            <Text style={[s.loadingTxt, { color: tk.textMuted }]}>{t('hymn_loading', 'Loading hymns…')}</Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={s.center}>
            <Text style={s.errEmoji}>🎵</Text>
            <Text style={[s.errTitle, { color: tk.textPrimary }]}>{t('hymn_load_error', 'Could not load hymn')}</Text>
            <Text style={[s.errSub,   { color: tk.textMuted   }]}>{errMsg}</Text>
            <TouchableOpacity
              onPress={() => fetchHymns(numbers)}
              activeOpacity={0.75}
              style={[s.retryBtn, { backgroundColor: accent }]}
            >
              <Text style={s.retryTxt}>{t('bv_try_again', 'Try again')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'done' && (
          <View style={{ flex: 1 }}>
            <HymnView hymn={(Array.isArray(hymns) ? hymns[pageIdx] : null) || null} colorIdx={pageIdx} tk={tk} t={t} />
          </View>
        )}

        {/* Prev / Next nav */}
        {phase === 'done' && Array.isArray(hymns) && hymns.length > 1 && (
          <View style={[s.navBar, { backgroundColor: tk.bg, borderTopColor: tk.border }]}>
            <TouchableOpacity
              onPress={() => setPageIdx(i => Math.max(0, i - 1))}
              disabled={pageIdx === 0}
              activeOpacity={0.75}
              style={[s.navBtn, { backgroundColor: tk.surface, opacity: pageIdx === 0 ? 0.3 : 1 }]}
            >
              <Text style={[s.navTxt, { color: tk.textPrimary }]}>{t('hymn_prev', '← Prev')}</Text>
            </TouchableOpacity>
            <Text style={[s.navCount, { color: tk.textMuted }]}>{pageIdx + 1} / {hymns.length}</Text>
            <TouchableOpacity
              onPress={() => setPageIdx(i => Math.min(hymns.length - 1, i + 1))}
              disabled={pageIdx === hymns.length - 1}
              activeOpacity={0.75}
              style={[s.navBtn, { backgroundColor: accent, opacity: pageIdx === hymns.length - 1 ? 0.3 : 1 }]}
            >
              <Text style={[s.navTxt, { color: '#fff' }]}>{t('hymn_next', 'Next →')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch: { flex: 1 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_H,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 20,
  },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  topLeft:    { flexDirection: 'row', alignItems: 'center' },
  musicIcon:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  sheetSub:   { fontSize: 11, fontWeight: '500', marginTop: 2 },
  closeBtn:   { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  closeTxt:   { fontSize: 14, fontWeight: '700' },
  tabRow:     { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  tab:        { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  tabTxt:     { fontSize: 12, fontWeight: '700' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  loadingTxt: { marginTop: 16, fontSize: 13.5, fontWeight: '500' },
  errEmoji:   { fontSize: 48, marginBottom: 16 },
  errTitle:   { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  errSub:     { fontSize: 13.5, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  retryBtn:   { borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  retryTxt:   { color: '#fff', fontSize: 14, fontWeight: '800' },
  navBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 28 : 12 },
  navBtn:     { borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 },
  navTxt:     { fontSize: 14, fontWeight: '800' },
  navCount:   { fontSize: 13, fontWeight: '600' },
});