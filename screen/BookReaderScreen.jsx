// screens/BookReaderScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Generic reader for any "daily-entry" book in the library.
//
// Used by Victory Month Prayer Bulletin, Teacher Manual, and any future book
// that ships its content as numbered entries. Sunday School is NOT routed here
// — it has its own bespoke HomeScreen flow.
//
// Route params:
//   bookSlug    — required, e.g. 'victory-month-2026'
//   bookTitle   — used in the topbar before the GET completes
//   accent      — book's accent_color, drives chip + button tints
//
// Layout (matches DevotionalReadingScreen design language):
//   ←Back  ·  {bookTitle}  ·  📊 Stats
//   Hero card: today's date + focus + scripture
//   DAY chip strip (DAY 01 … DAY N) + VIGILS strip
//   Inspirational message (long-read)
//   "Let us pray" — numbered prayer points (collapsible)
//   Optional: hymn, discussion questions, declarations, special intercession
//   Bottom: AppTabBar (Home active)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }     from '../context/ThemeContext';
import { useLanguage }  from '../context/LanguageContext';
import { getTokens, PALETTE } from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';
import AppTabBar, { ICONS } from '../components/AppTabBar';
import { fetchBook, fetchBookEntries, fetchBookEntry } from '../services/api';
import { RichVerseText } from '../components/BibleVerseLink';

const VIGIL_LABELS = {
  daily:          'DAY',
  family_vigil:   'FAMILY VIGIL',
  youth_vigil:    'YOUTH VIGIL',
  women_vigil:    'WOMEN VIGIL',
  men_vigil:      'MEN VIGIL',
  general_vigil:  'GENERAL VIGIL',
};

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  } catch { return ''; }
};

// ── DAY CHIP ──────────────────────────────────────────────────────────────────
const DayChip = ({ entry, active, onPress, accent, tk }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.78}
    style={{
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
      borderWidth: 1.5,
      backgroundColor: active ? accent : tk.surfaceEl,
      borderColor:     active ? accent : tk.border,
      minWidth: 56, alignItems: 'center',
    }}>
    <Text style={{
      fontSize: 13, fontWeight: '900', letterSpacing: -0.3,
      color: active ? '#fff' : tk.textPrimary,
    }}>
      {String(entry.entry_number).padStart(2, '0')}
    </Text>
  </TouchableOpacity>
);

// ── PRAYER POINT (numbered list with the book's accent badge) ─────────────────
const PrayerPoint = ({ index, text, accent, tk, isDark }) => (
  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
    <View style={{
      width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
      backgroundColor: accent + '18', flexShrink: 0, marginTop: 1,
    }}>
      <Text style={{ fontSize: 12, fontWeight: '900', color: accent }}>{index + 1}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <RichVerseText text={text} isDark={isDark} lineHeight={22}
        style={{ fontSize: 14.5, color: tk.textSec }} />
    </View>
  </View>
);

// ── COLLAPSIBLE SECTION CARD ──────────────────────────────────────────────────
const SectionCard = ({ Icon, title, color, lightBg, children, tk, isDark, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{
      borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 12,
      backgroundColor: tk.surface, borderColor: tk.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    }}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
          backgroundColor: isDark ? color + '22' : lightBg,
        }}>
          {Icon && <Icon color={color} size={22} sw={2} />}
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '900', letterSpacing: -0.2, color: tk.textPrimary }}>
          {title}
        </Text>
        <View style={{ width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: tk.surfaceEl, transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ICONS.ChevronDown color={tk.textMuted} size={16} sw={2.2} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={{ borderTopWidth: 1, borderTopColor: tk.border, padding: 18 }}>
          {children}
        </View>
      )}
    </View>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function BookReaderScreen({ route, navigation }) {
  const { bookSlug, bookTitle: paramTitle, accent: paramAccent } = route.params || {};
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [book,    setBook]    = useState(null);
  const [list,    setList]    = useState([]);            // entries summary list
  const [active,  setActive]  = useState({ number: 1, type: 'daily' });
  const [content, setContent] = useState(null);          // currently-loaded full entry
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const accent = book?.accent_color || paramAccent || PALETTE.blue;

  // Initial load: book metadata + entries summary in parallel.
  useEffect(() => {
    if (!bookSlug) { setError('No book specified.'); setLoading(false); return; }
    let cancelled = false;
    Promise.all([fetchBook(bookSlug), fetchBookEntries(bookSlug)])
      .then(([b, summary]) => {
        if (cancelled) return;
        setBook(b);
        const entries = summary?.entries || [];
        setList(entries);
        const first = entries.find((e) => e.entry_type === 'daily') || entries[0];
        if (first) setActive({ number: first.entry_number, type: first.entry_type });
      })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load book.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookSlug]);

  // Load the active entry's full content whenever the user switches days.
  useEffect(() => {
    if (!bookSlug || !active.number) return;
    let cancelled = false;
    fetchBookEntry(bookSlug, active.number, active.type)
      .then((data) => { if (!cancelled) setContent(data); })
      .catch(() => { if (!cancelled) setContent(null); });
    return () => { cancelled = true; };
  }, [bookSlug, active.number, active.type]);

  // Derive separate strips for daily vs each vigil type so the UI can
  // group them visually.
  const dailyEntries = useMemo(() => list.filter((e) => e.entry_type === 'daily'), [list]);
  const vigilGroups  = useMemo(() => {
    const groups = {};
    list.filter((e) => e.entry_type !== 'daily').forEach((e) => {
      groups[e.entry_type] = groups[e.entry_type] || [];
      groups[e.entry_type].push(e);
    });
    return groups;
  }, [list]);

  const switchTo = useCallback((entry) => {
    setActive({ number: entry.entry_number, type: entry.entry_type });
  }, []);

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
        <View style={s.center}><ActivityIndicator color={accent} size="large" /></View>
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
        <View style={s.center}>
          <Text style={{ fontSize: 16, color: tk.textPrimary, marginBottom: 8 }}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backLink, { backgroundColor: tk.surfaceEl }]}>
            <Text style={{ color: tk.textPrimary, fontWeight: '700' }}>← Back to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const title = book?.title || paramTitle || 'Book';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <Animated.ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        {/* TOP BAR */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}
            style={[s.iconBtn, { backgroundColor: tk.surfaceEl }]}>
            <ICONS.ArrowLeft color={tk.textPrimary} size={20} sw={2} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.topTitle, { color: tk.textPrimary }]} numberOfLines={1}>{title}</Text>
            {!!book?.subtitle && (
              <Text style={[s.topSub, { color: tk.textMuted }]} numberOfLines={1}>{book.subtitle}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Progress')} activeOpacity={0.75}
            accessibilityLabel="Progress"
            style={[s.iconBtn, { backgroundColor: accent + '18' }]}>
            <ICONS.Stats color={accent} size={20} sw={2} />
          </TouchableOpacity>
        </View>

        {/* HERO */}
        {content && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={[s.hero, { borderColor: tk.border, backgroundColor: tk.surface }]}>
              <View style={{ padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
                    backgroundColor: accent + '18',
                  }}>
                    <ICONS.Sun color={accent} size={28} sw={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.heroEyebrow, { color: tk.textMuted }]}>
                      {VIGIL_LABELS[content.entry_type] || 'DAY'} {String(content.entry_number).padStart(2, '0')}
                      {content.entry_date ? '  ·  ' + fmtDate(content.entry_date) : ''}
                    </Text>
                    <Text style={[s.heroFocus, { color: tk.textPrimary }]} numberOfLines={4}>
                      {content.focus || ''}
                    </Text>
                  </View>
                </View>
                {!!content.scripture_text && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
                    backgroundColor: '#FEF3C7', borderColor: '#F59E0B40',
                  }}>
                    <ICONS.Book color="#92400E" size={16} sw={2} />
                    <View style={{ flex: 1 }}>
                      <RichVerseText text={content.scripture_text} isDark={isDark} lineHeight={18}
                        style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }} />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* DAY SELECTOR */}
        {dailyEntries.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
            <Text style={[s.sectionLbl, { color: tk.textMuted }]}>SELECT DAY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dailyEntries.map((e) => (
                <DayChip key={`d${e.entry_number}`} entry={e}
                  active={active.type === 'daily' && active.number === e.entry_number}
                  onPress={() => switchTo(e)} accent={accent} tk={tk} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* VIGIL SELECTOR(S) */}
        {Object.keys(vigilGroups).length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <Text style={[s.sectionLbl, { color: tk.textMuted }]}>VIGILS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.entries(vigilGroups).flatMap(([type, entries]) =>
                entries.map((e) => {
                  const isActive = active.type === type && active.number === e.entry_number;
                  return (
                    <TouchableOpacity key={`${type}_${e.entry_number}`} onPress={() => switchTo(e)} activeOpacity={0.78}
                      style={{
                        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8,
                        borderWidth: 1.5,
                        backgroundColor: isActive ? accent : tk.surfaceEl,
                        borderColor:     isActive ? accent : tk.border,
                      }}>
                      <Text style={{
                        fontSize: 11, fontWeight: '900', letterSpacing: 0.5,
                        color: isActive ? '#fff' : tk.textPrimary,
                      }}>
                        {VIGIL_LABELS[type]} {entries.length > 1 ? String(e.entry_number).padStart(2, '0') : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {/* CONTENT BODY */}
        {!content ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={accent} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {/* Inspirational message */}
            {!!content.inspirational_message && (
              <SectionCard Icon={ICONS.Book} title={t('book_message', 'Inspirational Message')}
                color={accent} lightBg={accent + '18'} tk={tk} isDark={isDark} defaultOpen>
                <RichVerseText text={content.inspirational_message} isDark={isDark} lineHeight={24}
                  style={{ fontSize: 14.5, color: tk.textSec }} />
              </SectionCard>
            )}

            {/* Hymn */}
            {!!content.hymn && (
              <SectionCard Icon={ICONS.Sun} title={content.hymn.title || t('book_hymn', 'Hymn')}
                color="#F97316" lightBg="#FFF7ED" tk={tk} isDark={isDark} defaultOpen={false}>
                {(content.hymn.verses || []).map((v, i) => (
                  <Text key={i} style={{ fontSize: 14, lineHeight: 22, color: tk.textSec, marginBottom: 12 }}>
                    {v}
                  </Text>
                ))}
                {!!content.hymn.chorus && (
                  <Text style={{ fontSize: 14, lineHeight: 22, color: tk.textSec, fontStyle: 'italic', marginTop: 4 }}>
                    {content.hymn.chorus}
                  </Text>
                )}
              </SectionCard>
            )}

            {/* Prayer points */}
            {Array.isArray(content.prayer_points) && content.prayer_points.length > 0 && (
              <SectionCard Icon={ICONS.Prayer} title={t('book_let_us_pray', 'Let Us Pray')}
                color={accent} lightBg={accent + '18'} tk={tk} isDark={isDark} defaultOpen>
                {content.prayer_points.map((p, i) => (
                  <PrayerPoint key={i} index={i} text={p} accent={accent} tk={tk} isDark={isDark} />
                ))}
              </SectionCard>
            )}

            {/* Discussion questions (vigil entries) */}
            {Array.isArray(content.discussion_questions) && content.discussion_questions.length > 0 && (
              <SectionCard Icon={ICONS.Highlight} title={t('book_discussion', 'Discussion Questions')}
                color="#7C3AED" lightBg="#F5F3FF" tk={tk} isDark={isDark} defaultOpen={false}>
                {content.discussion_questions.map((q, i) => (
                  <PrayerPoint key={i} index={i} text={q} accent="#7C3AED" tk={tk} isDark={isDark} />
                ))}
              </SectionCard>
            )}

            {/* Declarations */}
            {Array.isArray(content.declarations) && content.declarations.length > 0 && (
              <SectionCard Icon={ICONS.Reflection} title={t('book_declarations', 'Declarations')}
                color="#10B981" lightBg="#ECFDF5" tk={tk} isDark={isDark} defaultOpen={false}>
                {content.declarations.map((d, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <Text style={{ color: '#10B981', fontWeight: '900', fontSize: 14 }}>•</Text>
                    <View style={{ flex: 1 }}>
                      <RichVerseText text={d} isDark={isDark} lineHeight={22}
                        style={{ fontSize: 14.5, color: tk.textSec, fontWeight: '600' }} />
                    </View>
                  </View>
                ))}
              </SectionCard>
            )}

            {/* Special intercession */}
            {!!content.special_intercession && (
              <SectionCard Icon={ICONS.Highlight} title={t('book_intercession', 'Special Intercession')}
                color="#F59E0B" lightBg="#FEF3C7" tk={tk} isDark={isDark} defaultOpen={false}>
                <RichVerseText text={content.special_intercession} isDark={isDark} lineHeight={24}
                  style={{ fontSize: 14.5, color: tk.textSec, fontStyle: 'italic' }} />
              </SectionCard>
            )}
          </View>
        )}

        {/* FOOTER */}
        <View style={{ alignItems: 'center', marginTop: 12, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 11, color: tk.textMuted }}>
            {t('book_footer', '© Gospelar Library')}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: accent, marginTop: 2 }}>
            www.gospelar.com
          </Text>
        </View>

      </Animated.ScrollView>

      {/* Tab bar — Settings removed. It now lives only on the Library home
          so the entry point is shared across every book in the catalogue. */}
      <AppTabBar
        activeTab={0}
        onTab={(i) => {
          if (i === 0) navigation.navigate('Library');
          if (i === 1) navigation.navigate('SecondPage', { category: { id: 'adult', route: 'SecondPage' } });
          if (i === 2) navigation.navigate('Notes');
          if (i === 3) navigation.navigate('Progress');
        }}
        tk={tk}
        tabs={[
          { key: 'Home',    label: t('tab_home',     'Home') },
          { key: 'Lessons', label: t('tab_lessons',  'Lessons') },
          { key: 'Notes',   label: t('tab_notes',    'Notes') },
          { key: 'Stats',   label: t('tab_progress', 'Progress') },
        ]}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  backLink:{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },

  topbar:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  iconBtn:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  topTitle:  { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  topSub:    { fontSize: 11, fontWeight: '600', marginTop: 2 },

  hero:        { borderRadius: 18, borderWidth: 1, overflow: 'hidden',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  heroFocus:   { fontSize: 17, fontWeight: '900', letterSpacing: -0.3, lineHeight: 23 },

  sectionLbl:  { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
});
