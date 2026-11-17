// screen/games/VerseBuilderScreen.jsx
// Memory Verse Builder — rebuild a lesson memory verse in the player's own
// language, two ways:
//   Order   — tap the shuffled words into the right order.
//   Fill in — tap the missing words into the blanks.
// A hint (rewarded ad / free use) places the next right word. After a finished
// verse, "Double XP" (rewarded) banks the same score a second time.
// Verses come from the lessons the app already caches, so it works offline.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens, type, space, radii } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import RewardButton, { useRewardGate } from '../../components/games/RewardButton';
import Confetti from '../../components/games/Confetti';
import { gt } from '../../data/games/strings';
import { fetchPreviewLessons, fetchLessonById } from '../../services/api';
import { recordRound, submitGameXp, shuffle, gameLang } from '../../services/games';
import { showGameInterstitial } from '../../services/ads';

const ACCENT = '#10B981';
const BASE_SCORE = 50;
const clean = (t) => String(t || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const letters = (w) => w.replace(/[^\p{L}\p{N}]/gu, '');

export default function VerseBuilderScreen({ navigation }) {
  const { isDark } = useTheme();
  const { lang: appLang } = useLanguage();
  const lang = gameLang(appLang);
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const T = useCallback((k, v) => gt(lang, k, v), [lang]);
  const gate = useRewardGate(2);

  const [verses, setVerses] = useState(null);      // null = loading, [] = none
  const [vi, setVi] = useState(0);
  const [mode, setMode] = useState('order');
  const [round, setRound] = useState(null);       // { tokens, tray, placed, blanks, filled }
  const [hintsUsed, setHintsUsed] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(null);         // { score }
  const [doubled, setDoubled] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // ── Load verses ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchPreviewLessons(lang, 13, 'adult');
        const picks = shuffle(Array.isArray(list) ? list : []).slice(0, 6);
        const lessons = await Promise.all(picks.map((l) => fetchLessonById(l.id, lang).catch(() => null)));
        const out = lessons
          .filter(Boolean)
          .map((l) => ({ text: clean(l.memory_verse), ref: clean(l.memory_verse_passage) }))
          .filter((v) => v.text.split(' ').length >= 6 && v.text.split(' ').length <= 40);
        if (mounted.current) setVerses(out);
      } catch { if (mounted.current) setVerses([]); }
    })();
  }, [lang]);

  const verse = verses && verses.length ? verses[vi % verses.length] : null;

  // ── Build a round ──────────────────────────────────────────────────────────
  const buildRound = useCallback((v, m) => {
    const tokens = v.text.split(' ').map((text, i) => ({ id: i, text }));
    if (m === 'order') {
      return { tokens, tray: shuffle(tokens.map((t) => t.id)), placed: [], blanks: [], filled: {} };
    }
    const candidates = tokens.filter((t, i) => i > 0 && letters(t.text).length > 3).map((t) => t.id);
    const n = Math.min(candidates.length, tokens.length > 18 ? 4 : 3);
    const blanks = shuffle(candidates).slice(0, n).sort((a, b) => a - b);
    const distractors = shuffle(tokens.filter((t) => !blanks.includes(t.id) && letters(t.text).length > 3)).slice(0, 2).map((t) => t.id);
    return { tokens, tray: shuffle([...blanks, ...distractors]), placed: [], blanks, filled: {} };
  }, []);

  const startRound = useCallback((v, m) => {
    setRound(buildRound(v, m)); setHintsUsed(0); setWrong(0); setMsg(''); setDone(null); setDoubled(false);
  }, [buildRound]);

  useEffect(() => { if (verse) startRound(verse, mode); /* eslint-disable-next-line */ }, [verses, vi, mode]);

  // ── Interactions ───────────────────────────────────────────────────────────
  const tapTray = (id) => {
    if (!round || done) return;
    if (mode === 'order') {
      setRound({ ...round, tray: round.tray.filter((x) => x !== id), placed: [...round.placed, id] });
    } else {
      const slot = round.blanks.find((b) => round.filled[b] === undefined);
      if (slot === undefined) return;
      setRound({ ...round, tray: round.tray.filter((x) => x !== id), filled: { ...round.filled, [slot]: id } });
    }
  };
  const tapPlaced = (id) => {
    if (!round || done) return;
    setRound({ ...round, placed: round.placed.filter((x) => x !== id), tray: [...round.tray, id] });
  };
  const tapBlank = (slot) => {
    if (!round || done || round.filled[slot] === undefined) return;
    const id = round.filled[slot];
    const filled = { ...round.filled }; delete filled[slot];
    setRound({ ...round, filled, tray: [...round.tray, id] });
  };

  const complete = mode === 'order'
    ? round && round.tray.length === 0
    : round && round.blanks.every((b) => round.filled[b] !== undefined);

  const check = async () => {
    if (!round || !complete) return;
    let ok;
    if (mode === 'order') {
      ok = round.placed.every((id, i) => round.tokens[id].text === round.tokens[i].text);
    } else {
      ok = round.blanks.every((b) => round.tokens[round.filled[b]].text === round.tokens[b].text);
    }
    if (!ok) { setWrong((w) => w + 1); setMsg(T('vb_try_again')); return; }
    const score = Math.max(10, BASE_SCORE - wrong * 10 - hintsUsed * 10);
    setDone({ score });
    await recordRound('verse_builder', score);
    submitGameXp('verse_builder', score, { mode });
  };

  const hint = () => {
    if (!round || done) return;
    setHintsUsed((h) => h + 1);
    if (mode === 'order') {
      // Keep the correct prefix, drop anything after it, then place the next word.
      let keep = 0;
      while (keep < round.placed.length && round.tokens[round.placed[keep]].text === round.tokens[keep].text) keep++;
      const removed = round.placed.slice(keep);
      const placed = round.placed.slice(0, keep);
      const tray = [...round.tray, ...removed];
      const want = round.tokens[keep].text;
      const pick = tray.find((id) => round.tokens[id].text === want);
      if (pick === undefined) return;
      setRound({ ...round, placed: [...placed, pick], tray: tray.filter((x) => x !== pick) });
    } else {
      const slot = round.blanks.find((b) => {
        const f = round.filled[b];
        return f === undefined || round.tokens[f].text !== round.tokens[b].text;
      });
      if (slot === undefined) return;
      const filled = { ...round.filled };
      let tray = round.tray.slice();
      if (filled[slot] !== undefined) { tray.push(filled[slot]); delete filled[slot]; }
      const pick = tray.find((id) => round.tokens[id].text === round.tokens[slot].text);
      if (pick === undefined) return;
      filled[slot] = pick; tray = tray.filter((x) => x !== pick);
      setRound({ ...round, filled, tray });
    }
  };

  const nextVerse = async () => {
    try { await showGameInterstitial(); } catch {}
    setVi((i) => i + 1);
  };
  const double = async () => {
    setDoubled(true);
    if (done) { await recordRound('verse_builder', done.score); submitGameXp('verse_builder', done.score, { double: true }); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const chip = (id, onPress, key) => (
    <TouchableOpacity key={key ?? id} onPress={onPress} activeOpacity={0.75} accessibilityRole="button"
      style={[s.chip, { backgroundColor: tk.surface, borderColor: tk.border }]}>
      <Text style={[s.chipTxt, { color: tk.textPrimary }]}>{round.tokens[id].text}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.top}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[s.iconBtn, { backgroundColor: tk.surface }]}>
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
        </TouchableOpacity>
        <Text style={[type.h3, { color: tk.textPrimary, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{T('g_verse')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {verses === null ? (
        <View style={s.center}><ActivityIndicator color={ACCENT} /><Text style={[type.sub, { color: tk.textSec, marginTop: 10 }]}>{T('vb_loading')}</Text></View>
      ) : !verse || !round ? (
        <View style={s.center}><Text style={[type.body, { color: tk.textSec, textAlign: 'center', paddingHorizontal: 32 }]}>{T('vb_none')}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm }}>
          <View style={[s.seg, { backgroundColor: tk.surface }]}>
            {['order', 'fill'].map((m) => (
              <TouchableOpacity key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
                style={[s.segBtn, mode === m && { backgroundColor: ACCENT }]}>
                <Text style={{ color: mode === m ? '#fff' : tk.textSec, fontWeight: '800', fontSize: 13.5 }}>{T(m === 'order' ? 'vb_order' : 'vb_fill')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[type.label, { color: ACCENT, marginTop: space.lg }]}>{verse.ref.toUpperCase()}</Text>
          <Text style={[type.sub, { color: tk.textSec, marginTop: 4 }]}>{T(mode === 'order' ? 'vb_tap_order' : 'vb_tap_fill')}</Text>

          {/* Answer area */}
          <View style={[s.area, { backgroundColor: tk.surface, borderColor: done ? ACCENT : tk.border }]}>
            {mode === 'order' ? (
              <View style={s.wrap}>{round.placed.map((id) => chip(id, () => tapPlaced(id), `p${id}`))}</View>
            ) : (
              <View style={s.wrap}>
                {round.tokens.map((t) => {
                  if (!round.blanks.includes(t.id)) return <Text key={t.id} style={[s.plain, { color: tk.textPrimary }]}>{t.text}</Text>;
                  const f = round.filled[t.id];
                  return (
                    <TouchableOpacity key={t.id} onPress={() => tapBlank(t.id)} style={[s.blank, { borderColor: f === undefined ? tk.textMuted : ACCENT, backgroundColor: f === undefined ? 'transparent' : ACCENT + '22' }]} accessibilityRole="button">
                      <Text style={[s.chipTxt, { color: tk.textPrimary }]}>{f === undefined ? '     ' : round.tokens[f].text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {!!msg && !done && <Text style={[type.sub, { color: '#DC2626', textAlign: 'center', marginTop: 10 }]}>{msg}</Text>}

          {/* Word tray */}
          {!done && <View style={[s.wrap, { marginTop: space.lg }]}>{round.tray.map((id) => chip(id, () => tapTray(id), `t${id}`))}</View>}

          {!done ? (
            <View style={{ marginTop: space.xl }}>
              <TouchableOpacity disabled={!complete} onPress={check} accessibilityRole="button"
                style={[s.primary, { backgroundColor: complete ? ACCENT : tk.surfaceEl }]}>
                <Text style={[s.primaryTxt, { color: complete ? '#fff' : tk.textMuted }]}>{T('vb_check')}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <RewardButton gate={gate} lang={lang} tk={tk} accent={ACCENT} label={T('vb_hint')} onReward={hint} icon={<ICONS.Zap color={ACCENT} size={16} />} />
                <TouchableOpacity onPress={() => startRound(verse, mode)} accessibilityRole="button" style={[s.reset, { borderColor: tk.border, backgroundColor: tk.surface }]}>
                  <ICONS.RefreshCw color={tk.textSec} size={16} /><Text style={{ color: tk.textSec, fontWeight: '800', fontSize: 14 }}>{T('vb_reset')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', marginTop: space.xl }}>
              <Text style={{ fontSize: 48 }}>🌟</Text>
              <Text style={[type.h1, { color: ACCENT, marginTop: 6 }]}>{T('vb_perfect')}</Text>
              <Text style={[type.body, { color: tk.textSec, marginTop: 6 }]}>{T('score')} {done.score} · {T('xp_earned', { n: Math.max(1, Math.floor(done.score / 5)) })}</Text>
              {!doubled && (
                <View style={{ alignSelf: 'stretch', marginTop: space.lg, flexDirection: 'row' }}>
                  <RewardButton gate={gate} lang={lang} tk={tk} accent={ACCENT} label={T('vb_double')} onReward={double} icon={<ICONS.Star color={ACCENT} size={16} />} />
                </View>
              )}
              <TouchableOpacity onPress={nextVerse} style={[s.primary, { backgroundColor: ACCENT, alignSelf: 'stretch', marginTop: 10 }]} accessibilityRole="button">
                <Text style={[s.primaryTxt, { color: '#fff' }]}>{T('vb_next')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
      {done && <Confetti />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  area: { minHeight: 130, padding: 14, borderRadius: radii.xl, borderWidth: 1.5, marginTop: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 12, minHeight: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { fontSize: 16, fontWeight: '700' },
  plain: { fontSize: 16, fontWeight: '600', lineHeight: 30 },
  blank: { paddingHorizontal: 10, minHeight: 36, minWidth: 64, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  reset: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { fontSize: 16, fontWeight: '800' },
});
