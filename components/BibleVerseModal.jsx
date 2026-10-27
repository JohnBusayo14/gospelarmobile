// components/BibleVerseModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Slide-up sheet that fetches and displays Bible verse text.
// Usage:
//   <BibleVerseModal reference="John 3:16" visible onClose={...} isDark={isDark} />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { fetchVerse }   from '../services/bibleApi';
import { API_BASE_URL } from '../context/SubscriptionContext';
import { useLanguage }  from '../context/LanguageContext';
import { getTokens, type, space, radii, card } from '../theme/tokens';
import { ICONS } from './icons';
import BottomSheet from './BottomSheet';

const ACCENTS = ['#2563EB', '#7C3AED', '#10B981', '#F97316', '#EF4444', '#0891B2'];

// Consistent accent per reference so the same verse always looks the same.
function accentFor(ref = '') {
  let h = 0;
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) & 0xff;
  return ACCENTS[h % ACCENTS.length];
}

const VerseRow = ({ verse, accent, tk, isFirst }) => (
  <View style={[vr.row, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tk.border }]}>
    <View style={[vr.numBadge, { backgroundColor: accent + '18', borderColor: accent + '35' }]}>
      <Text style={[vr.num, { color: accent }]}>{verse.verse}</Text>
    </View>
    <Text style={[vr.text, { color: tk.textPrimary }]}>{verse.text?.trim?.() ?? ''}</Text>
  </View>
);
const vr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: space.md, paddingHorizontal: space.lg },
  numBadge: { width: 28, height: 28, borderRadius: radii.sm, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginTop: 2, marginRight: space.md },
  num:      { fontSize: 11, fontWeight: '900' },
  text:     { flex: 1, fontSize: 16, lineHeight: 26, fontWeight: '400' },
});

// ─────────────────────────────────────────────────────────────────────────────
export default function BibleVerseModal({ reference, visible, onClose, isDark }) {
  const { t }  = useLanguage();
  const tk     = getTokens(isDark === true);
  const accent = accentFor(reference);

  const [phase,  setPhase]  = useState('idle'); // idle | loading | done | error
  const [data,   setData]   = useState(null);
  const [errMsg, setErrMsg] = useState('');

  const loadVerse = useCallback(async (ref) => {
    setPhase('loading');
    setData(null);
    setErrMsg('');
    try {
      // Admin-managed DB verses take priority over the public API.
      try {
        const dbRes = await fetch(`${API_BASE_URL}/api/bible-verse/${encodeURIComponent(ref)}`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData.text) {
            setData({
              reference:       ref,
              text:            dbData.text,
              verses:          [{ text: dbData.text }],
              translationName: dbData.version || 'Admin',
              source:          'db',
            });
            setPhase('done');
            return;
          }
        }
      } catch { /* DB not available — fall through to external API */ }

      const result = await fetchVerse(ref);
      setData(result);
      setPhase('done');
    } catch (e) {
      setErrMsg(e.message || t('bv_could_not_load', 'Could not load verse.'));
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (visible && reference) loadVerse(reference);
  }, [visible, reference]);

  const verses = Array.isArray(data?.verses) ? data.verses : [];
  const isMulti = verses.length > 1;

  const header = (
    <View style={s.headRow}>
      <View style={[s.iconTile, { backgroundColor: accent + '1F' }]}>
        <ICONS.Book color={accent} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: accent }]}>{t('bv_bible_tag', 'BIBLE')}</Text>
        <Text style={[type.h2, { color: tk.textPrimary, marginTop: 2 }]} numberOfLines={2}>
          {data?.reference || reference}
        </Text>
      </View>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} isDark={isDark} heightRatio={0.75} header={header}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space.xl, flexGrow: 1 }}
      >
        {phase === 'loading' && (
          <View style={s.center}>
            <ActivityIndicator color={accent} size="large" />
            <Text style={[type.sub, s.stateText, { color: tk.textMuted }]}>
              {t('bv_loading_ref', 'Loading {ref}…').replace('{ref}', String(reference || ''))}
            </Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={s.center}>
            <View style={[s.stateIcon, { backgroundColor: tk.surface }]}>
              <ICONS.Book color={tk.textMuted} size={32} />
            </View>
            <Text style={[type.h3, { color: tk.textPrimary, marginBottom: space.sm }]}>
              {t('bv_verse_not_found', 'Verse not found')}
            </Text>
            <Text style={[type.sub, s.stateText, { color: tk.textMuted }]}>{errMsg}</Text>
            <TouchableOpacity
              onPress={() => loadVerse(reference)}
              activeOpacity={0.75}
              accessibilityRole="button"
              style={[s.retryBtn, { backgroundColor: accent }]}
            >
              <ICONS.RefreshCw color="#fff" size={16} />
              <Text style={s.retryText}>{t('bv_try_again', 'Try again')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'done' && data && (
          <>
            {!!data.translationName && (
              <View style={[s.transPill, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                <Text style={[type.caption, { color: tk.textSec }]}>{data.translationName}</Text>
              </View>
            )}

            {isMulti ? (
              <View style={[card(tk), s.cardWrap]}>
                <View style={[s.stripe, { backgroundColor: accent }]} />
                {verses.map((v, i) => (
                  <VerseRow key={i} verse={v} accent={accent} tk={tk} isFirst={i === 0} />
                ))}
              </View>
            ) : (
              <View style={[card(tk), s.cardWrap]}>
                <View style={[s.stripe, { backgroundColor: accent }]} />
                <View style={s.singleBody}>
                  <ICONS.Quote color={accent} size={26} />
                  <Text style={[s.singleText, { color: tk.textPrimary }]}>
                    {String(data.text || verses[0]?.text || '').trim()}
                  </Text>
                  <View style={[s.singleRefRow, { borderTopColor: tk.border }]}>
                    <Text style={[s.singleRef, { color: accent }]}>— {data.reference || reference}</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={[type.caption, s.source, { color: tk.textMuted }]}>
              {data.source === 'db'
                ? data.translationName
                : 'World English Bible (WEB) · bible-api.com'}
            </Text>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  headRow:      { flexDirection: 'row', alignItems: 'center' },
  iconTile:     { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space['3xl'] },
  stateIcon:    { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  stateText:    { textAlign: 'center', marginTop: space.md, marginBottom: space.xl },
  retryBtn:     { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, borderRadius: radii.lg, paddingHorizontal: space.xl },
  retryText:    { color: '#fff', fontSize: 14, fontWeight: '800' },
  transPill:    { alignSelf: 'flex-start', borderRadius: radii.full, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: 5, marginBottom: space.lg },
  cardWrap:     { overflow: 'hidden' },
  stripe:       { height: 4 },
  singleBody:   { padding: space.xl },
  singleText:   { fontSize: 18, lineHeight: 30, fontWeight: '400', marginTop: space.md },
  singleRefRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.lg, paddingTop: space.md },
  singleRef:    { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  source:       { textAlign: 'center', marginTop: space.lg },
});
