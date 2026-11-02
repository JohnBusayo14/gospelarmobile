// screen/BibleScreen.jsx
// Holy Bible — read any book and chapter offline, switch versions, search.
// KJV is built into the app; the other versions download once (services/bible.js).
//
// Route params (all optional): { book: 0-65, chapter: 1.. }

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet,
  ActivityIndicator, StatusBar, Modal, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme }    from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getTokens, type, space, radii } from '../theme/tokens';
import { ICONS } from '../components/icons';
import {
  VERSIONS, OT_BOOKS, versionInfo, loadVersion, chapterVerses, searchBible,
  getSelectedVersion, setSelectedVersion, getLastPosition, setLastPosition,
  downloadedVersions, downloadVersion, deleteVersion,
} from '../services/bible';

const ACCENT = '#B45309';
const FONT_KEY = 'bible_font_size';
const FONT_SIZES = [15, 17, 19, 22, 26];

export default function BibleScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);

  const [versionId, setVersionId] = useState(null);
  const [bible, setBible]         = useState(null);
  const [error, setError]         = useState(false);
  const [pos, setPos]             = useState(null);           // { book, chapter }
  const [mode, setMode]           = useState('read');         // read | books | search
  const [pickBook, setPickBook]   = useState(null);           // book index while choosing a chapter
  const [testament, setTestament] = useState('ot');
  const [fontIdx, setFontIdx]     = useState(1);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const listRef = useRef(null);

  // ── Initial load: saved version, saved position (or route params), font ──
  useEffect(() => {
    (async () => {
      const [v, last] = await Promise.all([getSelectedVersion(), getLastPosition()]);
      const p = route?.params?.book != null
        ? { book: route.params.book, chapter: route.params.chapter || 1 }
        : last;
      setPos(p);
      setTestament(p.book < OT_BOOKS ? 'ot' : 'nt');
      setVersionId(v);
      try {
        const f = parseInt(await AsyncStorage.getItem(FONT_KEY), 10);
        if (f >= 0 && f < FONT_SIZES.length) setFontIdx(f);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    setError(false);
    loadVersion(versionId)
      .then((b) => { if (!cancelled) setBible(b); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [versionId]);

  useEffect(() => { if (pos) setLastPosition(pos); }, [pos]);

  const book      = bible && pos ? bible.books[pos.book] : null;
  const chapters  = book ? book.c.length : 0;
  const verses    = useMemo(() => (bible && pos ? chapterVerses(bible, pos.book, pos.chapter) : []), [bible, pos]);
  const fontSize  = FONT_SIZES[fontIdx];

  const goTo = useCallback((b, c) => {
    setPos({ book: b, chapter: c });
    setMode('read');
    setPickBook(null);
    requestAnimationFrame(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: false }));
  }, []);

  const step = (dir) => {
    if (!bible || !pos) return;
    let { book: b, chapter: c } = pos;
    c += dir;
    if (c < 1) { if (b === 0) return; b -= 1; c = bible.books[b].c.length; }
    else if (c > bible.books[b].c.length) { if (b === 65) return; b += 1; c = 1; }
    goTo(b, c);
  };

  const changeFont = (d) => {
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, fontIdx + d));
    setFontIdx(next);
    AsyncStorage.setItem(FONT_KEY, String(next)).catch(() => {});
  };

  const shareVerse = (v) => {
    Share.share({ message: `“${v.text}”\n— ${book.n} ${pos.chapter}:${v.verse} (${bible.short})` }).catch(() => {});
  };

  const chooseVersion = async (id) => {
    setVersionsOpen(false);
    if (id === versionId) return;
    await setSelectedVersion(id);
    setBible(null);
    setVersionId(id);
  };

  // ── Header ───────────────────────────────────────────────────────────────
  const title = mode === 'search'
    ? t('bible_search', 'Search')
    : mode === 'books'
      ? (pickBook != null && bible ? bible.books[pickBook].n : t('bible_choose_book', 'Choose a book'))
      : book ? `${book.n} ${pos.chapter}` : t('bible_title', 'Holy Bible');

  const onBack = () => {
    if (mode === 'books' && pickBook != null) return setPickBook(null);
    if (mode !== 'read') return setMode('read');
    navigation.goBack();
  };

  const topbar = (
    <View style={s.topbar}>
      <TouchableOpacity onPress={onBack} hitSlop={6} accessibilityRole="button"
        accessibilityLabel={t('btn_back', 'Back')} style={[s.iconBtn, { backgroundColor: tk.surface }]}>
        <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
      </TouchableOpacity>
      <TouchableOpacity
        style={s.titleBtn}
        disabled={mode !== 'read' || !bible}
        onPress={() => { setTestament(pos.book < OT_BOOKS ? 'ot' : 'nt'); setMode('books'); }}
        accessibilityRole="button"
        accessibilityLabel={t('bible_choose_book', 'Choose a book')}
      >
        <Text style={[type.h3, { color: tk.textPrimary }]} numberOfLines={1}>{title}</Text>
        {mode === 'read' && bible && <ICONS.ChevronDown color={tk.textMuted} size={18} />}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setVersionsOpen(true)} style={[s.versionChip, { backgroundColor: ACCENT + '1F' }]}
        accessibilityRole="button" accessibilityLabel={t('bible_versions', 'Bible versions')}>
        <Text style={[s.versionTxt, { color: isDark ? '#FBBF24' : ACCENT }]}>{versionInfo(versionId).short}</Text>
      </TouchableOpacity>
      {mode !== 'search' && (
        <TouchableOpacity onPress={() => setMode('search')} hitSlop={6} accessibilityRole="button"
          accessibilityLabel={t('bible_search', 'Search')} style={[s.iconBtn, { backgroundColor: tk.surface, marginLeft: space.sm }]}>
          <ICONS.Search color={tk.textPrimary} size={18} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Body ─────────────────────────────────────────────────────────────────
  let body;
  if (error) {
    body = (
      <View style={s.center}>
        <Text style={[type.h3, { color: tk.textPrimary, textAlign: 'center' }]}>
          {t('bible_load_error', 'Could not open this Bible version.')}
        </Text>
        <TouchableOpacity onPress={() => chooseVersion('kjv')} style={[s.primaryBtn, { backgroundColor: ACCENT }]}>
          <Text style={s.primaryTxt}>{t('bible_open_kjv', 'Open King James Version')}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (!bible || !pos) {
    body = (
      <View style={s.center}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={[type.sub, { color: tk.textMuted, marginTop: space.lg }]}>{t('bible_loading', 'Opening the Bible…')}</Text>
      </View>
    );
  } else if (mode === 'books') {
    body = pickBook == null
      ? <BookPicker bible={bible} tk={tk} t={t} testament={testament} setTestament={setTestament}
          current={pos.book} onPick={(i) => (bible.books[i].c.length === 1 ? goTo(i, 1) : setPickBook(i))} />
      : <ChapterGrid count={bible.books[pickBook].c.length} tk={tk}
          current={pickBook === pos.book ? pos.chapter : null} onPick={(c) => goTo(pickBook, c)} />;
  } else if (mode === 'search') {
    body = <SearchView bible={bible} tk={tk} t={t} onOpen={goTo} />;
  } else {
    body = (
      <FlatList
        ref={listRef}
        data={verses}
        keyExtractor={(v) => String(v.verse)}
        contentContainerStyle={s.reader}
        initialNumToRender={20}
        renderItem={({ item }) => (
          <Text onLongPress={() => shareVerse(item)} suppressHighlighting
            style={{ color: tk.textPrimary, fontSize, lineHeight: Math.round(fontSize * 1.6), marginBottom: space.sm }}>
            <Text style={{ color: isDark ? '#FBBF24' : ACCENT, fontSize: Math.round(fontSize * 0.7), fontWeight: '800' }}>
              {item.verse}{'  '}
            </Text>
            {item.text}
          </Text>
        )}
        ListFooterComponent={
          <View style={{ marginTop: space.xl }}>
            <View style={s.navRow}>
              <TouchableOpacity onPress={() => step(-1)} disabled={pos.book === 0 && pos.chapter === 1}
                style={[s.navBtn, { backgroundColor: tk.surface, borderColor: tk.border }]}>
                <ICONS.ArrowLeft color={tk.textPrimary} size={16} />
                <Text style={[s.navTxt, { color: tk.textPrimary }]}>{t('bible_prev', 'Previous')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => step(1)} disabled={pos.book === 65 && pos.chapter === chapters}
                style={[s.navBtn, { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                <Text style={[s.navTxt, { color: '#fff' }]}>{t('bible_next', 'Next')}</Text>
                <ICONS.ArrowRight color="#fff" size={16} />
              </TouchableOpacity>
            </View>
            <Text style={[s.copyright, { color: tk.textMuted }]}>{bible.name} · {bible.copyright}</Text>
          </View>
        }
      />
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      {topbar}
      {mode === 'read' && bible && (
        <View style={[s.toolRow, { borderBottomColor: tk.border }]}>
          <Text style={[s.toolLabel, { color: tk.textMuted }]} numberOfLines={1}>{bible.name}</Text>
          <TouchableOpacity onPress={() => changeFont(-1)} style={[s.fontBtn, { backgroundColor: tk.surface }]}
            accessibilityLabel={t('bible_smaller_text', 'Smaller text')}>
            <Text style={{ color: tk.textPrimary, fontSize: 13, fontWeight: '800' }}>A−</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeFont(1)} style={[s.fontBtn, { backgroundColor: tk.surface }]}
            accessibilityLabel={t('bible_larger_text', 'Larger text')}>
            <Text style={{ color: tk.textPrimary, fontSize: 17, fontWeight: '800' }}>A+</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ flex: 1 }}>{body}</View>

      <VersionSheet visible={versionsOpen} onClose={() => setVersionsOpen(false)} current={versionId}
        onChoose={chooseVersion} tk={tk} t={t} isDark={isDark} />
    </SafeAreaView>
  );
}

// ── Book picker ─────────────────────────────────────────────────────────────
function BookPicker({ bible, tk, t, testament, setTestament, current, onPick }) {
  const list = bible.books.map((b, i) => ({ b, i })).filter(({ i }) => (testament === 'ot' ? i < OT_BOOKS : i >= OT_BOOKS));
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.tabs, { backgroundColor: tk.surface }]}>
        {[['ot', t('bible_old_testament', 'Old Testament')], ['nt', t('bible_new_testament', 'New Testament')]].map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setTestament(k)}
            style={[s.tab, testament === k && { backgroundColor: ACCENT }]}>
            <Text style={[s.tabTxt, { color: testament === k ? '#fff' : tk.textSec }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(x) => String(x.i)}
        contentContainerStyle={{ paddingBottom: space['3xl'] }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPick(item.i)} style={[s.bookRow, { borderBottomColor: tk.border }]}>
            <Text style={[s.bookName, { color: item.i === current ? (ACCENT) : tk.textPrimary }]}>{item.b.n}</Text>
            <Text style={{ color: tk.textMuted, fontSize: 13 }}>{item.b.c.length}</Text>
            <ICONS.ChevronRight color={tk.textMuted} size={16} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ChapterGrid({ count, tk, current, onPick }) {
  return (
    <ScrollView contentContainerStyle={s.grid}>
      {Array.from({ length: count }, (_, i) => i + 1).map((c) => (
        <TouchableOpacity key={c} onPress={() => onPick(c)}
          style={[s.cell, { backgroundColor: c === current ? ACCENT : tk.surface, borderColor: tk.border }]}>
          <Text style={{ color: c === current ? '#fff' : tk.textPrimary, fontSize: 16, fontWeight: '700' }}>{c}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────
function SearchView({ bible, tk, t, onOpen }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);
  const run = () => setHits(searchBible(bible, q));
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.search, { backgroundColor: tk.surface, borderColor: tk.border }]}>
        <ICONS.Search color={tk.textMuted} size={18} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={run}
          returnKeyType="search"
          autoFocus
          placeholder={t('bible_search_placeholder', 'Search words in the Bible…')}
          placeholderTextColor={tk.textMuted}
          style={[s.searchInput, { color: tk.textPrimary }]}
        />
      </View>
      {hits && (
        <Text style={[s.toolLabel, { color: tk.textMuted, marginHorizontal: space.xl, marginBottom: space.sm }]}>
          {hits.length
            ? t('bible_results', '{n} verses').replace('{n}', hits.length >= 200 ? '200+' : String(hits.length))
            : t('bible_no_results', 'No verses found for “{q}”').replace('{q}', q.trim())}
        </Text>
      )}
      <FlatList
        data={hits || []}
        keyExtractor={(h) => `${h.bookIdx}:${h.chapter}:${h.verse}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space['3xl'] }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onOpen(item.bookIdx, item.chapter)} style={[s.hit, { borderBottomColor: tk.border }]}>
            <Text style={[s.hitRef, { color: ACCENT }]}>{bible.books[item.bookIdx].n} {item.chapter}:{item.verse}</Text>
            <Text style={{ color: tk.textPrimary, fontSize: 14, lineHeight: 21 }} numberOfLines={3}>{item.text}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ── Version sheet ───────────────────────────────────────────────────────────
function VersionSheet({ visible, onClose, current, onChoose, tk, t, isDark }) {
  const [have, setHave] = useState([]);
  const [busy, setBusy] = useState({});   // id → progress 0..1

  const refresh = useCallback(() => downloadedVersions().then(setHave), []);
  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);

  const download = async (id) => {
    setBusy((b) => ({ ...b, [id]: 0 }));
    try {
      await downloadVersion(id, (p) => setBusy((b) => ({ ...b, [id]: p })));
      await refresh();
    } catch {
      Alert.alert(t('bible_versions', 'Bible versions'),
        t('bible_download_failed', 'Could not download this version. Check your internet connection and try again.'));
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  const remove = (v) => {
    Alert.alert(v.short, t('bible_remove_confirm', 'Remove {v} from this phone? You can download it again later.').replace('{v}', v.name), [
      { text: t('btn_cancel', 'Cancel'), style: 'cancel' },
      { text: t('bible_remove', 'Remove'), style: 'destructive', onPress: async () => {
        await deleteVersion(v.id);
        if (v.id === current) onChoose('kjv');
        refresh();
      } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: isDark ? '#111111' : '#FFFFFF' }]}>
          <View style={[s.grabber, { backgroundColor: tk.border }]} />
          <Text style={[type.h3, { color: tk.textPrimary, marginBottom: space.xs }]}>{t('bible_versions', 'Bible versions')}</Text>
          <Text style={{ color: tk.textMuted, fontSize: 13, marginBottom: space.lg }}>
            {t('bible_versions_sub', 'Downloaded versions work without internet.')}
          </Text>
          <ScrollView style={{ maxHeight: 460 }}>
            {VERSIONS.map((v) => {
              const ready = have.includes(v.id);
              const progress = busy[v.id];
              const active = v.id === current;
              return (
                <View key={v.id} style={[s.vRow, { borderColor: active ? ACCENT : tk.border, backgroundColor: active ? ACCENT + '14' : 'transparent' }]}>
                  <TouchableOpacity style={{ flex: 1 }} disabled={!ready} onPress={() => onChoose(v.id)}>
                    <Text style={{ color: tk.textPrimary, fontSize: 15, fontWeight: '800' }}>{v.short} · {v.name}</Text>
                    <Text style={{ color: tk.textMuted, fontSize: 12, marginTop: 2 }}>
                      {v.bundled
                        ? t('bible_built_in', 'Built in · works offline')
                        : ready
                          ? t('bible_downloaded', 'Downloaded · works offline')
                          : progress != null
                            ? t('bible_downloading', 'Downloading… {p}%').replace('{p}', String(Math.round(progress * 100)))
                            : t('bible_size_mb', '{n} MB download').replace('{n}', String(v.sizeMB))}
                    </Text>
                  </TouchableOpacity>
                  {active && <ICONS.CheckCircle color={ACCENT} size={22} />}
                  {!active && ready && !v.bundled && (
                    <TouchableOpacity onPress={() => remove(v)} hitSlop={8} style={s.vAction}
                      accessibilityLabel={t('bible_remove', 'Remove')}>
                      <ICONS.Trash color={tk.textMuted} size={18} />
                    </TouchableOpacity>
                  )}
                  {!ready && (progress != null
                    ? <ActivityIndicator color={ACCENT} />
                    : (
                      <TouchableOpacity onPress={() => download(v.id)} style={[s.dlBtn, { backgroundColor: ACCENT }]}>
                        <ICONS.Download color="#fff" size={14} />
                        <Text style={s.dlTxt}>{t('bible_download', 'Download')}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  topbar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm },
  iconBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginHorizontal: space.sm },
  versionChip: { minHeight: 32, borderRadius: radii.full, paddingHorizontal: space.md, justifyContent: 'center' },
  versionTxt:  { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  toolRow:     { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  toolLabel:   { flex: 1, fontSize: 12, fontWeight: '600' },
  fontBtn:     { width: 40, height: 32, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  reader:      { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space['3xl'] },
  navRow:      { flexDirection: 'row', gap: space.md },
  navBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: 46, borderRadius: radii.lg, borderWidth: 1 },
  navTxt:      { fontSize: 14, fontWeight: '800' },
  copyright:   { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: space.xl },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space['2xl'] },
  primaryBtn:  { marginTop: space.xl, minHeight: 46, borderRadius: radii.lg, paddingHorizontal: space.xl, justifyContent: 'center' },
  primaryTxt:  { color: '#fff', fontSize: 14, fontWeight: '800' },
  tabs:        { flexDirection: 'row', marginHorizontal: space.xl, marginVertical: space.sm, borderRadius: radii.full, padding: 4 },
  tab:         { flex: 1, minHeight: 38, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  tabTxt:      { fontSize: 13, fontWeight: '800' },
  bookRow:     { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  bookName:    { flex: 1, fontSize: 16, fontWeight: '600' },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.xl },
  cell:        { width: 54, height: 54, borderRadius: radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search:      { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.xl, marginVertical: space.md, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: space.md, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: space.sm },
  hit:         { paddingHorizontal: space.xl, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  hitRef:      { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, paddingBottom: space['3xl'] },
  grabber:     { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: space.lg },
  vRow:        { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radii.lg, padding: space.md, marginBottom: space.sm },
  vAction:     { padding: 4 },
  dlBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, borderRadius: radii.full, paddingHorizontal: space.md },
  dlTxt:       { color: '#fff', fontSize: 12, fontWeight: '800' },
});
