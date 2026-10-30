// components/HymnModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Slide-up sheet that displays Gospel Hymn Book lyrics.
// Fetches from /api/hymns?numbers=75,433 via services/api.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { fetchHymns as fetchHymnsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { getTokens, type, space, radii, card } from '../theme/tokens';
import { ICONS } from './icons';
import BottomSheet from './BottomSheet';

// Parse "G.H.B. 75, 433" → [75, 433]
function parseHymnRef(ref) {
  if (!ref || typeof ref !== 'string') return [];
  const stripped = ref.replace(/G\.?\s*H\.?\s*B\.?\s*/i, '').trim();
  if (!stripped) return [];
  return stripped
    .split(/[\s,]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0);
}

const ACCENTS = ['#F97316', '#7C3AED', '#10B981', '#2563EB'];
const accentFor = (i) => ACCENTS[i % ACCENTS.length];

// `v` can be a plain string (legacy bundled data) or a `{text, number}` object
// (JSONB from the hymns.verses column). Rendering the object directly throws
// "Objects are not valid as a React child".
const verseString = (v) =>
  v == null ? '' : (typeof v === 'string' ? v : String(v.text ?? ''));
const verseNumber = (v, fallback) =>
  v && typeof v === 'object' && Number.isFinite(v.number) ? v.number : fallback;

// ─── sub-components ───────────────────────────────────────────────────────────
const VerseBlock = ({ text, label, accent, tk }) => (
  <View style={[card(tk), vb.wrap]}>
    <Text style={[type.label, vb.label, { color: accent }]}>{label}</Text>
    <Text style={[vb.text, { color: tk.textPrimary }]}>{verseString(text)}</Text>
  </View>
);
const vb = StyleSheet.create({
  wrap:  { padding: space.lg, marginBottom: space.md },
  label: { marginBottom: space.sm },
  text:  { fontSize: 16, lineHeight: 27, fontWeight: '400' },
});

const ChorusBlock = ({ text, accent, tk, t }) => (
  <View style={[cb.wrap, { backgroundColor: accent + '14', borderColor: accent + '40' }]}>
    <View style={[cb.chip, { backgroundColor: accent }]}>
      <Text style={[type.label, cb.chipTxt]}>{t('hymn_chorus', 'CHORUS')}</Text>
    </View>
    <Text style={[cb.text, { color: tk.textPrimary }]}>{text}</Text>
  </View>
);
const cb = StyleSheet.create({
  wrap:    { borderRadius: radii.xl, borderWidth: 1, padding: space.lg, marginBottom: space.md },
  chip:    { alignSelf: 'flex-start', borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 4, marginBottom: space.sm },
  chipTxt: { color: '#fff', fontSize: 9 },
  text:    { fontSize: 16, lineHeight: 27, fontWeight: '600' },
});

const StateView = ({ Icon, title, sub, tk, children }) => (
  <View style={st.wrap}>
    <View style={[st.iconCircle, { backgroundColor: tk.surface }]}>
      <Icon color={tk.textMuted} size={32} />
    </View>
    <Text style={[type.h3, st.title, { color: tk.textPrimary }]}>{title}</Text>
    {!!sub && <Text style={[type.sub, st.sub, { color: tk.textMuted }]}>{sub}</Text>}
    {children}
  </View>
);
const st = StyleSheet.create({
  wrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space['3xl'], paddingHorizontal: space['2xl'] },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  title:      { textAlign: 'center', marginBottom: space.sm },
  sub:        { textAlign: 'center', marginBottom: space.xl },
});

// ─── Single hymn view ─────────────────────────────────────────────────────────
const HymnView = ({ hymn, accent, tk, t }) => {
  if (!hymn) {
    return (
      <StateView
        Icon={ICONS.Music}
        title={t('hymn_not_found', 'Hymn not found')}
        sub={t('hymn_not_in_db', "This number isn't in the database yet.")}
        tk={tk}
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: space.xl, paddingBottom: space['2xl'] }}
    >
      <View style={[card(tk), hv.titleCard]}>
        <View style={[hv.accentBar, { backgroundColor: accent }]} />
        <View style={hv.titleBody}>
          <View style={[hv.numPill, { backgroundColor: accent }]}>
            <Text style={hv.numPillTxt}>
              {hymn.label || t('hymn_ghb_number', 'G.H.B. No. {n}').replace('{n}', String(hymn.number))}
            </Text>
          </View>
          <Text style={[type.h2, { color: tk.textPrimary }]}>{hymn.title}</Text>
          {!!hymn.author && (
            <Text style={[type.sub, { color: tk.textSec, marginTop: space.xs }]}>{hymn.author}</Text>
          )}
        </View>
      </View>

      <View style={[hv.intro, { backgroundColor: accent + '10', borderColor: accent + '30' }]}>
        <ICONS.Quote color={accent} size={16} />
        <Text style={[hv.introTxt, { color: accent }]}>
          {t('hymn_intro_verse', 'Sing to the Lord a new song; sing to the Lord, all the earth. — Psalm 96:1')}
        </Text>
      </View>

      {(hymn.verses || []).map((verse, i) => (
        <React.Fragment key={i}>
          <VerseBlock
            text={verse}
            label={t('hymn_verse_n', 'Verse {n}').replace('{n}', String(verseNumber(verse, i + 1)))}
            accent={accent}
            tk={tk}
          />
          {!!hymn.chorus && <ChorusBlock text={hymn.chorus} accent={accent} tk={tk} t={t} />}
        </React.Fragment>
      ))}
    </ScrollView>
  );
};
const hv = StyleSheet.create({
  titleCard:  { flexDirection: 'row', overflow: 'hidden', marginBottom: space.lg },
  accentBar:  { width: 4 },
  titleBody:  { flex: 1, padding: space.lg },
  numPill:    { alignSelf: 'flex-start', borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 4, marginBottom: space.sm },
  numPillTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  intro:      { flexDirection: 'row', alignItems: 'flex-start', borderRadius: radii.md, borderWidth: 1, padding: space.md, marginBottom: space.lg },
  introTxt:   { flex: 1, fontSize: 12.5, fontStyle: 'italic', fontWeight: '600', lineHeight: 19, marginLeft: space.sm },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────
// `loadHymn` (optional) loads one hymn from another hymnal instead of G.H.B.;
// `bookTitle` then replaces the "Gospel Hymn Book" heading.
export default function HymnModal({ hymnRef, visible, onClose, isDark, loadHymn, bookTitle }) {
  const { t }   = useLanguage();
  const tk      = getTokens(isDark === true);
  const numbers = parseHymnRef(hymnRef || '');

  const [phase,   setPhase]   = useState('idle');   // idle | loading | done | error
  const [hymns,   setHymns]   = useState([]);
  const [errMsg,  setErrMsg]  = useState('');
  const [pageIdx, setPageIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setPageIdx(0);
    if (loadHymn) fetchOne();
    else if (numbers.length > 0) fetchHymns(numbers);
  }, [visible, hymnRef]);

  const fetchOne = async () => {
    setPhase('loading');
    setHymns([]);
    setErrMsg('');
    try {
      setHymns([(await loadHymn()) || null]);
      setPhase('done');
    } catch (e) {
      setErrMsg(e.message || t('hymn_could_not_connect', 'Could not connect to server. Check your network.'));
      setPhase('error');
    }
  };
  const retry = () => (loadHymn ? fetchOne() : fetchHymns(numbers));

  const fetchHymns = async (nums) => {
    setPhase('loading');
    setHymns([]);
    setErrMsg('');
    try {
      const data = await fetchHymnsApi(nums);
      setHymns(nums.map((n) =>
        Array.isArray(data) ? data.find((h) => h && h.number === n) || null : null,
      ));
      setPhase('done');
    } catch (e) {
      console.error('HymnModal: hymn fetch failed:', e.message);
      setErrMsg(e.message || t('hymn_could_not_connect', 'Could not connect to server. Check your network.'));
      setPhase('error');
    }
  };

  const accent = accentFor(pageIdx);
  const multi  = phase === 'done' && hymns.length > 1;

  const header = (
    <View style={s.headRow}>
      <View style={[s.iconTile, { backgroundColor: accent + '1F' }]}>
        <ICONS.Music color={accent} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.h3, { color: tk.textPrimary }]} numberOfLines={1}>
          {bookTitle || t('hymn_gospel_hymn_book', 'Gospel Hymn Book')}
        </Text>
        {!!hymnRef && (
          <Text style={[type.caption, { color: tk.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {hymnRef}
          </Text>
        )}
      </View>
    </View>
  );

  const footer = multi ? (
    <View style={s.navRow}>
      <TouchableOpacity
        onPress={() => setPageIdx(i => Math.max(0, i - 1))}
        disabled={pageIdx === 0}
        activeOpacity={0.75}
        accessibilityRole="button"
        style={[s.navBtn, { backgroundColor: tk.surface, opacity: pageIdx === 0 ? 0.35 : 1 }]}
      >
        <Text style={[s.navTxt, { color: tk.textPrimary }]}>{t('hymn_prev', '← Prev')}</Text>
      </TouchableOpacity>
      <Text style={[type.caption, { color: tk.textMuted }]}>{pageIdx + 1} / {hymns.length}</Text>
      <TouchableOpacity
        onPress={() => setPageIdx(i => Math.min(hymns.length - 1, i + 1))}
        disabled={pageIdx === hymns.length - 1}
        activeOpacity={0.75}
        accessibilityRole="button"
        style={[s.navBtn, { backgroundColor: accent, opacity: pageIdx === hymns.length - 1 ? 0.35 : 1 }]}
      >
        <Text style={[s.navTxt, { color: '#fff' }]}>{t('hymn_next', 'Next →')}</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      heightRatio={0.85}
      header={header}
      footer={footer}
    >
      {multi && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[s.tabScroll, { borderBottomColor: tk.border }]}
          contentContainerStyle={s.tabRow}
        >
          {hymns.map((_, i) => {
            const a = accentFor(i);
            const active = i === pageIdx;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setPageIdx(i)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[s.tab, { backgroundColor: active ? a : tk.surface, borderColor: active ? a : tk.border }]}
              >
                <Text style={[s.tabTxt, { color: active ? '#fff' : tk.textSec }]}>
                  {t('hymn_no_n', 'No. {n}').replace('{n}', String(numbers[i]))}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {phase === 'loading' && (
        <View style={s.center}>
          <ActivityIndicator color={accent} size="large" />
          <Text style={[type.sub, { color: tk.textMuted, marginTop: space.lg }]}>
            {t('hymn_loading', 'Loading hymns…')}
          </Text>
        </View>
      )}

      {phase === 'error' && (
        <StateView Icon={ICONS.Music} title={t('hymn_load_error', 'Could not load hymn')} sub={errMsg} tk={tk}>
          <TouchableOpacity
            onPress={retry}
            activeOpacity={0.75}
            accessibilityRole="button"
            style={[s.retryBtn, { backgroundColor: accent }]}
          >
            <ICONS.RefreshCw color="#fff" size={16} />
            <Text style={s.retryTxt}>{t('bv_try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </StateView>
      )}

      {phase === 'done' && (
        <HymnView hymn={hymns[pageIdx] || null} accent={accent} tk={tk} t={t} />
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  headRow:   { flexDirection: 'row', alignItems: 'center' },
  iconTile:  { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  tabScroll: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  tabRow:    { paddingHorizontal: space.xl, paddingVertical: space.md, gap: space.sm },
  tab:       { minHeight: 36, borderRadius: radii.full, borderWidth: 1, paddingHorizontal: space.lg, justifyContent: 'center' },
  tabTxt:    { fontSize: 13, fontWeight: '700' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space['3xl'] },
  retryBtn:  { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, borderRadius: radii.lg, paddingHorizontal: space.xl },
  retryTxt:  { color: '#fff', fontSize: 14, fontWeight: '800' },
  navRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn:    { minHeight: 44, borderRadius: radii.lg, paddingHorizontal: space.xl, justifyContent: 'center' },
  navTxt:    { fontSize: 14, fontWeight: '800' },
});
