// screen/games/FinishHymnScreen.jsx
// Finish the Hymn — a line from a Gospel Hymn Book hymn is shown; pick the
// line that comes next from four. 10 questions, 20 s each. 50:50 and a second
// chance are paid for with a rewarded ad (or a free use, see RewardButton).
// Hymns come from fetchHymnBook (cached), so it works offline after one visit.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, ScrollView, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens, type, space, radii } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import RewardButton, { useRewardGate, gateCaption } from '../../components/games/RewardButton';
import Confetti from '../../components/games/Confetti';
import HymnModal from '../../components/HymnModal';
import { gt } from '../../data/games/strings';
import { fetchHymnBook } from '../../services/api';
import { recordRound, submitGameXp, shuffle, gameLang } from '../../services/games';
import { showGameInterstitial } from '../../services/ads';

const ACCENT = '#7C3AED';
const COUNT = 10;
const SECONDS = 20;
const PASS = 7;
const MAX_WRONG = COUNT - PASS;

const lines = (h) => {
  const parts = [...(Array.isArray(h.verses) ? h.verses : []), h.chorus].filter(Boolean);
  return parts.map((p) => (typeof p === 'string' ? p : String(p.text ?? '')))
    .map((blk) => blk.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 8));
};

// One question: line i → line i+1 inside the same verse/chorus block.
function buildQuestions(hymns) {
  const usable = hymns.filter((h) => lines(h).some((b) => b.length >= 3));
  const allLines = usable.flatMap((h) => lines(h).flat());
  const out = [];
  for (const h of shuffle(usable)) {
    if (out.length >= COUNT) break;
    const blocks = lines(h).filter((b) => b.length >= 3);
    const block = blocks[Math.floor(Math.random() * blocks.length)];
    const i = Math.floor(Math.random() * (block.length - 1));
    const prompt = block[i], answer = block[i + 1];
    const wrong = shuffle(allLines.filter((l) => l !== answer && l !== prompt && Math.abs(l.length - answer.length) < 40)).slice(0, 3);
    if (wrong.length < 3) continue;
    const opts = shuffle([answer, ...wrong]);
    out.push({ id: `${h.number}-${i}`, number: h.number, title: h.title, prompt, options: opts, answer: opts.indexOf(answer) });
  }
  return out;
}

export default function FinishHymnScreen({ navigation }) {
  const { isDark } = useTheme();
  const { lang: appLang } = useLanguage();
  const lang = gameLang(appLang);
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const T = useCallback((k, v) => gt(lang, k, v), [lang]);
  const gate = useRewardGate(2);

  const [hymns, setHymns] = useState(null);
  const [phase, setPhase] = useState('play');           // play | result
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [score, setScore] = useState(0);
  const [usedFifty, setUsedFifty] = useState(false);
  const [usedChance, setUsedChance] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [result, setResult] = useState(null);
  const [sheet, setSheet] = useState(null);             // hymn number to open

  const bar = useRef(new Animated.Value(1)).current;
  const startedAt = useRef(0);
  const timeoutRef = useRef(null);
  const advanceRef = useRef(null);
  const onAnswerRef = useRef(() => {});
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; clearTimeout(timeoutRef.current); clearTimeout(advanceRef.current); }, []);

  useEffect(() => {
    fetchHymnBook(lang)
      .then((list) => { if (mounted.current) setHymns(Array.isArray(list) ? list : []); })
      .catch(() => { if (mounted.current) setHymns([]); });
  }, [lang]);

  const newRound = useCallback(() => {
    if (!hymns) return;
    const list = buildQuestions(hymns);
    setQs(list); setIdx(0); setPicked(null); setHidden([]); setCorrect(0); setWrong(0); setScore(0);
    setUsedFifty(false); setUsedChance(false); setPrompt(false); setResult(null); setPhase('play');
  }, [hymns]);
  useEffect(() => { newRound(); }, [newRound]);

  const q = qs[idx];

  const stopTimer = useCallback(() => { clearTimeout(timeoutRef.current); bar.stopAnimation(); }, [bar]);
  useEffect(() => {
    if (phase === 'play' && q && picked === null && !prompt) {
      stopTimer();
      startedAt.current = Date.now();
      bar.setValue(1);
      Animated.timing(bar, { toValue: 0, duration: SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
      timeoutRef.current = setTimeout(() => onAnswerRef.current(-1), SECONDS * 1000);
    }
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, q && q.id]);

  const finish = async (passed, c, sc, lastWrongHymn) => {
    stopTimer();
    setResult({ passed, correct: c, score: sc, hymn: lastWrongHymn, xp: undefined });
    setPhase('result');
    await recordRound('finish_hymn', sc);
    const res = await submitGameXp('finish_hymn', sc, { passed });
    if (mounted.current) setResult((r) => (r ? { ...r, xp: res ? res.xp_awarded : null } : r));
  };

  const next = (c, sc) => {
    if (idx + 1 >= qs.length) { finish(c >= PASS, c, sc, null); return; }
    setIdx(idx + 1); setPicked(null); setHidden([]);
  };

  function onAnswer(i) {
    if (picked !== null) return;
    stopTimer();
    const elapsed = (Date.now() - startedAt.current) / 1000;
    const right = i === qs[idx]?.answer;
    setPicked(i);
    let c = correct, w = wrong, sc = score;
    if (right) { c++; sc += 10 + Math.max(0, Math.floor((SECONDS - elapsed) / 4)); setCorrect(c); setScore(sc); }
    else { w++; setWrong(w); }
    advanceRef.current = setTimeout(() => {
      if (!mounted.current) return;
      if (!right && w > MAX_WRONG) {
        if (!usedChance) { setPrompt(true); return; }
        finish(false, c, sc, qs[idx].number); return;
      }
      next(c, sc);
    }, right ? 900 : 1900);
  }
  onAnswerRef.current = onAnswer;

  const takeChance = async () => {
    if (await gate.request()) {
      setUsedChance(true); setPrompt(false);
      const w = wrong - 1; setWrong(w);
      next(correct, score);
    } else if (gate.mode === 'ad') Alert.alert(T('ad_unavailable'));
  };

  const fifty = () => {
    if (!q || picked !== null) return;
    const wrongIdx = q.options.map((_, i) => i).filter((i) => i !== q.answer);
    setHidden(shuffle(wrongIdx).slice(0, 2)); setUsedFifty(true);
  };

  const withAd = async (fn) => { try { await showGameInterstitial(); } catch {} fn(); };

  const header = (
    <View style={s.top}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[s.iconBtn, { backgroundColor: tk.surface }]}>
        <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
      </TouchableOpacity>
      <Text style={[type.h3, { color: tk.textPrimary, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{T('g_hymn')}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (hymns === null) {
    return <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>{header}<View style={s.center}><ActivityIndicator color={ACCENT} /><Text style={[type.sub, { color: tk.textSec, marginTop: 10 }]}>{T('fh_loading')}</Text></View></SafeAreaView>;
  }
  if (!qs.length) {
    return <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>{header}<View style={s.center}><Text style={[type.body, { color: tk.textSec, textAlign: 'center', paddingHorizontal: 32 }]}>{T('fh_none')}</Text></View></SafeAreaView>;
  }

  if (phase === 'result' && result) {
    const col = result.passed ? '#10B981' : '#DC2626';
    return (
      <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {header}
        <ScrollView contentContainerStyle={{ padding: space.xl, alignItems: 'center' }}>
          <Text style={{ fontSize: 60, marginTop: space.lg }}>{result.passed ? '🎶' : '📖'}</Text>
          <Text style={[type.h1, { color: col, marginTop: space.md, textAlign: 'center' }]}>{result.passed ? T('level_passed') : T('level_failed')}</Text>
          <View style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border }]}>
            <Text style={[s.big, { color: tk.textPrimary }]}>{result.score}</Text>
            <Text style={[type.label, { color: tk.textMuted }]}>{T('score').toUpperCase()}</Text>
            <Text style={[type.body, { color: tk.textSec, marginTop: space.md }]}>{T('result_line', { a: result.correct, b: COUNT })}</Text>
            <Text style={[type.caption, { color: ACCENT, marginTop: space.md }]}>
              {result.xp === undefined ? '…' : result.xp > 0 ? T('xp_earned', { n: result.xp }) : result.xp === 0 ? T('xp_cap') : T('xp_offline')}
            </Text>
          </View>
          {!!result.hymn && (
            <TouchableOpacity onPress={() => setSheet(result.hymn)} style={[s.secondary, { borderColor: tk.border }]} accessibilityRole="button">
              <ICONS.Music color={ACCENT} size={18} /><Text style={[s.secondaryTxt, { color: tk.textPrimary }]}>{T('fh_open')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.primary, { backgroundColor: ACCENT }]} onPress={() => withAd(newRound)} accessibilityRole="button">
            <Text style={s.primaryTxt}>{T('retry')}</Text>
          </TouchableOpacity>
        </ScrollView>
        {result.passed && <Confetti />}
        <HymnModal hymnRef={sheet ? `G.H.B. ${sheet}` : null} visible={!!sheet} onClose={() => setSheet(null)} isDark={isDark} />
      </SafeAreaView>
    );
  }

  if (!q) return null;
  const barColor = bar.interpolate({ inputRange: [0, 0.3, 1], outputRange: ['#DC2626', '#F59E0B', '#10B981'] });
  const width = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const revealed = picked !== null;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {header}
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm }}>
        <View style={s.meta}>
          <Text style={[type.caption, { color: tk.textSec }]}>{T('q_of', { a: idx + 1, b: qs.length })}</Text>
          <Text style={[type.caption, { color: ACCENT }]}>{T('score')} {score}</Text>
        </View>
        <View style={[s.track, { backgroundColor: tk.surfaceEl }]}><Animated.View style={[s.fill, { width, backgroundColor: barColor }]} /></View>

        <View style={[s.qCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
          <Text style={[type.label, { color: ACCENT }]}>{T('fh_hymn', { n: q.number })} · {q.title}</Text>
          <Text style={[s.qText, { color: tk.textPrimary }]}>“{q.prompt}”</Text>
          <Text style={[type.sub, { color: tk.textMuted, marginTop: 8 }]}>{T('fh_prompt')}</Text>
        </View>

        {q.options.map((opt, i) => {
          if (hidden.includes(i)) return <View key={i} style={{ height: 68 }} />;
          const isAnswer = i === q.answer, isPicked = i === picked;
          let bg = tk.surface, bd = tk.border;
          if (revealed && isAnswer) { bg = '#10B98122'; bd = '#10B981'; } else if (revealed && isPicked) { bg = '#DC262622'; bd = '#DC2626'; }
          return (
            <TouchableOpacity key={i} disabled={revealed} onPress={() => onAnswer(i)} activeOpacity={0.85} accessibilityRole="button" style={[s.opt, { backgroundColor: bg, borderColor: bd }]}>
              <Text style={[s.optTxt, { color: tk.textPrimary }]}>{opt}</Text>
              {revealed && isAnswer && <ICONS.CheckCircle color="#10B981" size={20} />}
              {revealed && isPicked && !isAnswer && <ICONS.X color="#DC2626" size={20} />}
            </TouchableOpacity>
          );
        })}

        {revealed && (
          <Text style={[type.sub, { color: picked === q.answer ? '#10B981' : '#DC2626', textAlign: 'center', marginTop: space.sm }]}>
            {picked === q.answer ? T('correct') : picked === -1 ? T('time_up') : T('wrong')}
          </Text>
        )}

        {!revealed && !prompt && (
          <View style={{ flexDirection: 'row', marginTop: space.md }}>
            <RewardButton gate={gate} lang={lang} tk={tk} accent={ACCENT} label={T('fifty')} used={usedFifty} onReward={fifty} icon={<ICONS.Zap color={ACCENT} size={16} />} />
          </View>
        )}

        {prompt && (
          <View style={[s.chance, { backgroundColor: tk.surface, borderColor: ACCENT + '66' }]}>
            <Text style={[type.h3, { color: tk.textPrimary }]}>{T('second_chance_title')}</Text>
            <Text style={[type.sub, { color: tk.textSec, marginTop: 4 }]}>{gate.mode === 'ad' ? T('second_chance_body') : T('second_chance_free')}</Text>
            <TouchableOpacity disabled={gate.mode === 'none' || gate.busy} onPress={takeChance} style={[s.primary, { backgroundColor: gate.mode === 'none' ? tk.surfaceEl : ACCENT, marginTop: space.md, alignSelf: 'stretch' }]} accessibilityRole="button">
              <Text style={s.primaryTxt}>{T('continue')}{gate.mode !== 'none' ? ` · ${gateCaption(gate, lang)}` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPrompt(false); finish(false, correct, score, q.number); }} style={s.link} accessibilityRole="button">
              <Text style={[type.h3, { color: tk.textSec }]}>{T('end_level')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: space.lg },
  fill: { height: '100%', borderRadius: 4 },
  qCard: { padding: 18, borderRadius: radii.xl, borderWidth: 1, marginBottom: space.lg },
  qText: { fontSize: 19, fontWeight: '800', lineHeight: 27, marginTop: 8, fontStyle: 'italic' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.lg, borderWidth: 1.5, marginBottom: 10, minHeight: 58 },
  optTxt: { flex: 1, fontSize: 15.5, fontWeight: '700', lineHeight: 21 },
  chance: { marginTop: space.lg, padding: 18, borderRadius: radii.xl, borderWidth: 1.5 },
  card: { alignSelf: 'stretch', alignItems: 'center', padding: 24, borderRadius: radii.xl, borderWidth: 1, marginVertical: space.xl },
  big: { fontSize: 56, fontWeight: '900', letterSpacing: -1 },
  primary: { alignSelf: 'stretch', minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 10 },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { alignSelf: 'stretch', minHeight: 54, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryTxt: { fontSize: 16, fontWeight: '800' },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
});
