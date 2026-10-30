// screen/HymnBookScreen.jsx
// Gospel Hymn Book — browse and search every hymn; tapping one opens the same
// HymnModal sheet the lessons use.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, StatusBar, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }       from '../context/ThemeContext';
import { useLanguage }    from '../context/LanguageContext';
import { fetchHymnBook, fetchBookEntries, fetchBookEntry } from '../services/api';
import { getTokens, type, space, radii } from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';
import { ICONS }          from '../components/icons';
import HymnModal          from '../components/HymnModal';

const ACCENT = '#6D28D9';

// Lower-case and strip diacritics so "ọ" matches "o" in search.
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const firstVerse = (h) => {
  const v = Array.isArray(h.verses) ? h.verses[0] : null;
  const text = v == null ? '' : (typeof v === 'string' ? v : String(v.text ?? ''));
  return text.replace(/\s+/g, ' ').trim();
};

const HymnRow = React.memo(({ hymn, preview, tk, onPress }) => (
  <TouchableOpacity
    onPress={() => onPress(hymn.number)}
    activeOpacity={0.7}
    accessibilityRole="button"
    style={[r.row, { borderBottomColor: tk.border }]}
  >
    <View style={[r.badge, { backgroundColor: ACCENT + '1A' }]}>
      <Text style={[r.num, { color: ACCENT }]}>{hymn.number}</Text>
    </View>
    <View style={r.mid}>
      <Text style={[r.title, { color: tk.textPrimary }]} numberOfLines={1}>{hymn.title}</Text>
      {!!preview && (
        <Text style={[r.preview, { color: tk.textMuted }]} numberOfLines={1}>{preview}</Text>
      )}
    </View>
    <ICONS.ChevronRight color={tk.textMuted} size={18} />
  </TouchableOpacity>
));
const r = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingHorizontal: space.xl, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  badge:   { width: 48, height: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  num:     { fontSize: 15, fontWeight: '900' },
  mid:     { flex: 1, marginRight: space.sm },
  title:   { fontSize: 15, fontWeight: '700' },
  preview: { fontSize: 12.5, marginTop: 3 },
});

// Category slug stored as book_entries.entry_type, e.g. "the_word_of_god" → "The Word of God".
const SMALL_WORDS = new Set(['of', 'and', 'the', 'in', 'to', 'a']);
const categoryLabel = (slug) =>
  String(slug || '').split('_').filter(Boolean)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

// Without params this is the G.H.B. book (hymns table). With { bookSlug, bookTitle }
// it lists a hymnal stored as book entries, one entry per hymn, entry_type = category.
export default function HymnBookScreen({ navigation, route }) {
  const { bookSlug, bookTitle } = route?.params || {};
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const title = bookTitle || t('hymnbook_title', 'Gospel Hymn Book');

  const [hymns,   setHymns]   = useState([]);
  const [phase,   setPhase]   = useState('loading'); // loading | done | error
  const [query,   setQuery]   = useState('');
  const [category, setCategory] = useState(null);
  const [open,    setOpen]    = useState(null);       // { number, type }
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      if (bookSlug) {
        const data = await fetchBookEntries(bookSlug);
        const rows = (data?.entries || [])
          .map((e) => ({ number: e.entry_number, title: e.focus || '', type: e.entry_type, ref: e.scripture_text || '' }))
          .sort((a, b) => a.number - b.number);
        setHymns(rows);
      } else {
        const list = await fetchHymnBook();
        setHymns(Array.isArray(list) ? list : []);
      }
      setPhase('done');
    } catch {
      setPhase('error');
    }
  }, [bookSlug]);
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const seen = [];
    hymns.forEach((h) => { if (h.type && !seen.includes(h.type)) seen.push(h.type); });
    return seen;
  }, [hymns]);

  const indexed = useMemo(
    () => hymns.map((h) => {
      const preview = bookSlug ? [categoryLabel(h.type), h.ref].filter(Boolean).join(' · ') : firstVerse(h);
      return { hymn: h, preview, titleKey: fold(h.title), verseKey: fold(preview) };
    }),
    [hymns, bookSlug],
  );

  const results = useMemo(() => {
    const pool = category ? indexed.filter((x) => x.hymn.type === category) : indexed;
    const q = query.trim();
    if (!q) return pool;
    if (/^\d+$/.test(q)) {
      const exact = pool.filter((x) => String(x.hymn.number) === q);
      const rest  = pool.filter((x) => String(x.hymn.number) !== q && String(x.hymn.number).startsWith(q));
      return [...exact, ...rest];
    }
    const fq = fold(q);
    const inTitle = pool.filter((x) => x.titleKey.includes(fq));
    const inVerse = pool.filter((x) => !x.titleKey.includes(fq) && x.verseKey.includes(fq));
    return [...inTitle, ...inVerse];
  }, [indexed, query, category]);

  const typeByNumber = useMemo(() => Object.fromEntries(hymns.map((h) => [h.number, h.type])), [hymns]);
  const openHymn = useCallback((n) => { setOpen({ number: n, type: typeByNumber[n] }); setSheetOpen(true); }, [typeByNumber]);

  const loadHymn = bookSlug && open
    ? async () => {
        const e = await fetchBookEntry(bookSlug, open.number, open.type);
        const h = e?.hymn || {};
        return {
          number: open.number,
          label:  `No. ${open.number}${e?.scripture_text ? ` · ${e.scripture_text}` : ''}`,
          title:  h.title || e?.focus || '',
          author: h.author || null,
          verses: Array.isArray(h.verses) ? h.verses : [],
          chorus: h.chorus || null,
        };
      }
    : undefined;

  const header = (
    <View>
      <LinearGradient colors={['#2E1065', '#4C1D95', ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroIcon}><ICONS.Music color="#F5C451" size={26} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>{title}</Text>
          <Text style={s.heroSub}>
            {phase === 'done'
              ? t('hymnbook_count', '{n} hymns · tap a hymn to sing along').replace('{n}', String(hymns.length))
              : t('hymnbook_tagline', 'Sing to the Lord a new song')}
          </Text>
        </View>
      </LinearGradient>

      <View style={[s.search, { backgroundColor: tk.surface, borderColor: tk.border }]}>
        <ICONS.Search color={tk.textMuted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('hymnbook_search', 'Search by number, title or words')}
          placeholderTextColor={tk.textMuted}
          style={[s.searchInput, { color: tk.textPrimary }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('btn_clear', 'Clear')}
          >
            <ICONS.X color={tk.textMuted} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {categories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {[null, ...categories].map((c) => {
            const active = category === c;
            return (
              <TouchableOpacity
                key={c || 'all'}
                onPress={() => setCategory(c)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[s.chip, { backgroundColor: active ? ACCENT : tk.surface, borderColor: active ? ACCENT : tk.border }]}
              >
                <Text style={[s.chipTxt, { color: active ? '#fff' : tk.textSec }]}>
                  {c ? categoryLabel(c) : t('hymnbook_all', 'All')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <View style={s.topbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('btn_back', 'Back')}
          style={[s.iconBtn, { backgroundColor: tk.surface }]}
        >
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
        </TouchableOpacity>
        <Text style={[type.h3, s.topTitle, { color: tk.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={s.iconBtn} />
      </View>

      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY }] }}>
        {phase === 'loading' && (
          <>
            {header}
            <View style={s.center}>
              <ActivityIndicator color={ACCENT} size="large" />
              <Text style={[type.sub, { color: tk.textMuted, marginTop: space.lg }]}>
                {t('hymn_loading', 'Loading hymns…')}
              </Text>
            </View>
          </>
        )}

        {phase === 'error' && (
          <>
            {header}
            <View style={s.center}>
              <View style={[s.stateIcon, { backgroundColor: tk.surface }]}>
                <ICONS.Music color={tk.textMuted} size={32} />
              </View>
              <Text style={[type.h3, { color: tk.textPrimary, marginBottom: space.sm }]}>
                {t('hymn_load_error', 'Could not load hymn')}
              </Text>
              <Text style={[type.sub, s.stateText, { color: tk.textMuted }]}>
                {t('hymn_could_not_connect', 'Could not connect to server. Check your network.')}
              </Text>
              <TouchableOpacity
                onPress={load}
                activeOpacity={0.8}
                accessibilityRole="button"
                style={[s.retryBtn, { backgroundColor: ACCENT }]}
              >
                <ICONS.RefreshCw color="#fff" size={16} />
                <Text style={s.retryTxt}>{t('bv_try_again', 'Try again')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {phase === 'done' && (
          <FlatList
            data={results}
            keyExtractor={(x) => String(x.hymn.number)}
            renderItem={({ item }) => (
              <HymnRow hymn={item.hymn} preview={item.preview} tk={tk} onPress={openHymn} />
            )}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={[type.sub, { color: tk.textMuted, textAlign: 'center' }]}>
                  {t('hymnbook_no_match', 'No hymn matches “{q}”').replace('{q}', query.trim())}
                </Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={16}
            windowSize={9}
            contentContainerStyle={{ paddingBottom: space['3xl'] }}
          />
        )}
      </Animated.View>

      <HymnModal
        hymnRef={open ? (bookSlug ? `No. ${open.number}` : `G.H.B. ${open.number}`) : null}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        loadHymn={loadHymn}
        bookTitle={bookSlug ? title : undefined}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  topbar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm },
  iconBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle:    { flex: 1, textAlign: 'center', marginHorizontal: space.sm },
  hero:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: space.xl, marginTop: space.sm, borderRadius: radii.xl, padding: space.xl },
  heroIcon:    { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: space.lg },
  heroTitle:   { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  heroSub:     { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '500', marginTop: 4 },
  search:      { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.xl, marginTop: space.lg, marginBottom: space.sm, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: space.md, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: space.sm },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space['2xl'], paddingBottom: space['3xl'] },
  stateIcon:   { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  stateText:   { textAlign: 'center', marginBottom: space.xl },
  retryBtn:    { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, borderRadius: radii.lg, paddingHorizontal: space.xl },
  retryTxt:    { color: '#fff', fontSize: 14, fontWeight: '800' },
  empty:       { paddingVertical: space['3xl'], paddingHorizontal: space['2xl'] },
  chips:       { paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.sm, gap: space.sm },
  chip:        { minHeight: 34, borderRadius: radii.full, borderWidth: 1, paddingHorizontal: space.lg, justifyContent: 'center' },
  chipTxt:     { fontSize: 13, fontWeight: '700' },
});
