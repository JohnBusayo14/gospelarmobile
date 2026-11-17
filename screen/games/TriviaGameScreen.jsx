// screen/games/TriviaGameScreen.jsx
// Bible Trivia Challenge — 5 levels × 10 timed questions.
//   • 20 s per question; faster answers earn a small bonus.
//   • Pass a level with PASS_MARK correct answers; a 4th wrong answer ends it.
//   • Lifelines (once per level each): 50:50 and Skip — paid with a rewarded
//     ad, or a free use when no ad can be shown (see RewardButton.jsx).
//   • "Second chance": when the level would end, an optional ad keeps it going.
//   • Interstitials only between levels, never mid-question.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing, ScrollView, Alert, StatusBar, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens, type, space, radii } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import RewardButton, { useRewardGate, gateCaption } from '../../components/games/RewardButton';
import { gt } from '../../data/games/strings';
import { LEVELS, QUESTIONS_PER_LEVEL, PASS_MARK, buildLevel, spareQuestion } from '../../data/games/trivia';
import { getGameStats, recordRound, submitGameXp, gameLang } from '../../services/games';
import { showGameInterstitial } from '../../services/ads';

const ACCENT = '#DB2777';
const SECONDS = 20;
const MAX_WRONG = QUESTIONS_PER_LEVEL - PASS_MARK;   // 3 wrong answers allowed
const LEVEL_COLORS = ['#10B981', '#0EA5E9', '#F59E0B', '#F97316', '#DC2626'];

export default function TriviaGameScreen({ navigation }) {
  const { isDark } = useTheme();
  const { lang: appLang } = useLanguage();
  const lang = gameLang(appLang);
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const T = useCallback((k, v) => gt(lang, k, v), [lang]);
  const gate = useRewardGate(2);

  const [phase, setPhase]     = useState('levels');       // levels | play | result
  const [stats, setStats]     = useState({});
  const [level, setLevel]     = useState(1);
  const [qs, setQs]           = useState([]);
  const [idx, setIdx]         = useState(0);
  const [picked, setPicked]   = useState(null);           // option index, or -1 on timeout
  const [hidden, setHidden]   = useState([]);             // options removed by 50:50
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong]     = useState(0);
  const [score, setScore]     = useState(0);
  const [usedFifty, setUsedFifty] = useState(false);
  const [usedSkip, setUsedSkip]   = useState(false);
  const [usedChance, setUsedChance] = useState(false);
  const [prompt, setPrompt]   = useState(false);          // second-chance prompt
  const [result, setResult]   = useState(null);

  const bar = useRef(new Animated.Value(1)).current;
  const startedAt = useRef(0);
  const timeoutRef = useRef(null);
  const advanceRef = useRef(null);
  const mounted = useRef(true);
  const usedIds = useRef(new Set());
  const onAnswerRef = useRef(() => {});

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timeoutRef.current); clearTimeout(advanceRef.current); }; }, []);
  const refreshStats = useCallback(() => getGameStats().then((s) => mounted.current && setStats(s.trivia || {})), []);
  useEffect(() => { refreshStats(); }, [refreshStats]);

  const q = qs[idx];

  // ── Timer ──────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    clearTimeout(timeoutRef.current);
    bar.stopAnimation();
  }, [bar]);

  const startTimer = useCallback(() => {
    stopTimer();
    startedAt.current = Date.now();
    bar.setValue(1);
    Animated.timing(bar, { toValue: 0, duration: SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    timeoutRef.current = setTimeout(() => onAnswerRef.current(-1), SECONDS * 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer, bar]);

  // Start the clock whenever a new question is shown.
  useEffect(() => {
    if (phase === 'play' && q && picked === null && !prompt) startTimer();
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, q && q.id]);

  // ── Flow ───────────────────────────────────────────────────────────────────
  const startLevel = (n) => {
    const list = buildLevel(n, lang);
    usedIds.current = new Set(list.map((x) => x.id));
    setLevel(n); setQs(list); setIdx(0); setPicked(null); setHidden([]);
    setCorrect(0); setWrong(0); setScore(0);
    setUsedFifty(false); setUsedSkip(false); setUsedChance(false); setPrompt(false);
    setResult(null); setPhase('play');
  };

  const finish = async (passed, finalCorrect, finalScore) => {
    stopTimer();
    const g = await recordRound('trivia', finalScore, { level, passed });
    refreshStats();
    setResult({ passed, correct: finalCorrect, score: finalScore, xp: undefined, best: g.best });
    setPhase('result');
    const res = await submitGameXp('trivia', finalScore, { level, passed });
    if (mounted.current) setResult((r) => (r ? { ...r, xp: res ? res.xp_awarded : null } : r));
  };

  const next = (nextCorrect, nextWrong, nextScore) => {
    const last = idx + 1 >= qs.length;
    if (last) { finish(nextCorrect >= PASS_MARK, nextCorrect, nextScore); return; }
    setIdx(idx + 1); setPicked(null); setHidden([]);
  };

  function onAnswer(i) {
    if (picked !== null) return;
    stopTimer();
    const elapsed = (Date.now() - startedAt.current) / 1000;
    const isRight = i === qs[idx]?.answer;
    setPicked(i);
    let c = correct, w = wrong, sc = score;
    if (isRight) {
      c += 1; sc += 10 + Math.max(0, Math.floor((SECONDS - elapsed) / 4));
      setCorrect(c); setScore(sc);
    } else {
      w += 1; setWrong(w);
    }
    advanceRef.current = setTimeout(() => {
      if (!mounted.current) return;
      if (!isRight && w > MAX_WRONG) {
        // The level can no longer be passed — offer a second chance once.
        if (!usedChance) { setPrompt(true); return; }
        finish(false, c, sc); return;
      }
      next(c, w, sc);
    }, isRight ? 1000 : 1800);
  }

  onAnswerRef.current = onAnswer;   // timer callbacks always see the latest state

  const takeSecondChance = async () => {
    if (await gate.request()) {
      setUsedChance(true); setPrompt(false);
      const w = wrong - 1; setWrong(w);          // forgive that mistake
      next(correct, w, score);
    } else if (gate.mode === 'ad') {
      Alert.alert(T('ad_unavailable'));
    }
  };
  const declineChance = () => { setPrompt(false); finish(false, correct, score); };

  // ── Lifelines ──────────────────────────────────────────────────────────────
  const fifty = () => {
    if (!q || picked !== null) return;
    const wrongIdx = q.options.map((_, i) => i).filter((i) => i !== q.answer);
    setHidden(wrongIdx.sort(() => Math.random() - 0.5).slice(0, 2));
    setUsedFifty(true);
  };
  const skip = () => {
    if (!q || picked !== null) return;
    const spare = spareQuestion(level, lang, usedIds.current);
    if (!spare) return;
    usedIds.current.add(spare.id);
    const copy = qs.slice(); copy[idx] = spare;
    setQs(copy); setHidden([]); setUsedSkip(true);
  };

  // ── Leaving ────────────────────────────────────────────────────────────────
  const confirmQuit = useCallback(() => {
    if (phase !== 'play') { navigation.goBack(); return true; }
    stopTimer();
    Alert.alert(T('quit_title'), T('quit_body'), [
      { text: T('stay'), style: 'cancel', onPress: () => { if (picked === null && !prompt) startTimer(); } },
      { text: T('quit'), style: 'destructive', onPress: () => { setPhase('levels'); refreshStats(); } },
    ]);
    return true;
  }, [phase, picked, prompt, T, navigation, stopTimer, startTimer, refreshStats]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (phase === 'play' ? confirmQuit() : false));
    return () => sub.remove();
  }, [phase, confirmQuit]);

  const withInterstitial = async (fn) => { try { await showGameInterstitial(); } catch {} fn(); };

  // ── Render ─────────────────────────────────────────────────────────────────
  const header = (
    <View style={s.top}>
      <TouchableOpacity onPress={confirmQuit} hitSlop={10} accessibilityRole="button" accessibilityLabel={T('back_levels')} style={[s.iconBtn, { backgroundColor: tk.surface }]}>
        <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
      </TouchableOpacity>
      <Text style={[type.h3, { color: tk.textPrimary, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{T('g_trivia')}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (phase === 'levels') {
    const unlocked = stats.unlocked || 1;
    return (
      <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {header}
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm }}>
          <LinearGradient colors={['#831843', '#BE185D', ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <ICONS.Trophy color="#F5C451" size={30} />
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{T('g_trivia')}</Text>
              <Text style={s.heroSub}>{T('pass_rule', { n: PASS_MARK })}</Text>
            </View>
          </LinearGradient>
          {LEVELS.map((n) => {
            const locked = n > unlocked;
            const best = stats.levels && stats.levels[n];
            const col = LEVEL_COLORS[n - 1];
            return (
              <TouchableOpacity
                key={n}
                disabled={locked}
                onPress={() => startLevel(n)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled: locked }}
                style={[s.levelCard, { backgroundColor: tk.surface, borderColor: tk.border, opacity: locked ? 0.55 : 1 }]}
              >
                <View style={[s.levelBadge, { backgroundColor: col + '22' }]}>
                  {locked ? <ICONS.Lock color={tk.textMuted} size={20} /> : <Text style={[s.levelNum, { color: col }]}>{n}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.h3, { color: tk.textPrimary }]}>{T('level', { n })} · {T(`lv${n}`)}</Text>
                  <Text style={[type.caption, { color: tk.textMuted, marginTop: 2 }]}>
                    {locked ? T('locked', { n: n - 1 }) : best ? T('best', { n: best }) : T('q_of', { a: QUESTIONS_PER_LEVEL, b: QUESTIONS_PER_LEVEL })}
                  </Text>
                </View>
                {!locked && <ICONS.ChevronRight color={tk.textMuted} size={18} />}
              </TouchableOpacity>
            );
          })}
          {unlocked > LEVELS.length && (
            <Text style={[type.body, { color: tk.textSec, textAlign: 'center', marginTop: space.lg }]}>{T('all_done')}</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'result' && result) {
    const col = result.passed ? '#10B981' : '#DC2626';
    const hasNext = result.passed && level < LEVELS.length;
    return (
      <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {header}
        <ScrollView contentContainerStyle={{ padding: space.xl, alignItems: 'center' }}>
          <Text style={{ fontSize: 64, marginTop: space.lg }}>{result.passed ? '🏆' : '📖'}</Text>
          <Text style={[type.h1, { color: col, marginTop: space.md, textAlign: 'center' }]}>{result.passed ? T('level_passed') : T('level_failed')}</Text>
          <Text style={[type.sub, { color: tk.textSec, marginTop: 6 }]}>{T('level', { n: level })} · {T(`lv${level}`)}</Text>

          <View style={[s.resultCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
            <Text style={[s.bigNum, { color: tk.textPrimary }]}>{result.score}</Text>
            <Text style={[type.label, { color: tk.textMuted }]}>{T('score').toUpperCase()}</Text>
            <Text style={[type.body, { color: tk.textSec, marginTop: space.md }]}>{T('result_line', { a: result.correct, b: QUESTIONS_PER_LEVEL })}</Text>
            {!result.passed && <Text style={[type.caption, { color: tk.textMuted, marginTop: 4 }]}>{T('pass_rule', { n: PASS_MARK })}</Text>}
            <Text style={[type.caption, { color: ACCENT, marginTop: space.md }]}>
              {result.xp === undefined ? '…'
                : result.xp > 0 ? T('xp_earned', { n: result.xp })
                : result.xp === 0 ? T('xp_cap')
                : T('xp_offline')}
            </Text>
          </View>

          {hasNext && (
            <TouchableOpacity style={[s.primary, { backgroundColor: ACCENT }]} onPress={() => withInterstitial(() => startLevel(level + 1))} accessibilityRole="button">
              <Text style={s.primaryTxt}>{T('next_level')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[hasNext ? s.secondary : s.primary, hasNext ? { borderColor: tk.border } : { backgroundColor: ACCENT }]}
            onPress={() => withInterstitial(() => startLevel(level))}
            accessibilityRole="button"
          >
            <Text style={hasNext ? [s.secondaryTxt, { color: tk.textPrimary }] : s.primaryTxt}>{T('retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.link} onPress={() => withInterstitial(() => { setPhase('levels'); refreshStats(); })} accessibilityRole="button">
            <Text style={[type.h3, { color: tk.textSec }]}>{T('back_levels')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
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
          <Text style={[type.caption, { color: tk.textSec }]}>{T('level', { n: level })} · {T('q_of', { a: idx + 1, b: qs.length })}</Text>
          <Text style={[type.caption, { color: ACCENT }]}>{T('score')} {score}</Text>
        </View>
        <View style={[s.track, { backgroundColor: tk.surfaceEl }]}>
          <Animated.View style={[s.fill, { width, backgroundColor: barColor }]} />
        </View>

        <View style={[s.qCard, { backgroundColor: tk.surface, borderColor: tk.border }]}>
          <Text style={[s.qText, { color: tk.textPrimary }]}>{q.q}</Text>
        </View>

        {q.options.map((opt, i) => {
          if (hidden.includes(i)) return <View key={i} style={s.optGap} />;
          const isAnswer = i === q.answer;
          const isPicked = i === picked;
          let bg = tk.surface, bd = tk.border, fg = tk.textPrimary;
          if (revealed && isAnswer) { bg = '#10B98122'; bd = '#10B981'; }
          else if (revealed && isPicked) { bg = '#DC262622'; bd = '#DC2626'; }
          return (
            <TouchableOpacity
              key={i}
              disabled={revealed}
              onPress={() => onAnswer(i)}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={[s.opt, { backgroundColor: bg, borderColor: bd }]}
            >
              <View style={[s.optKey, { backgroundColor: tk.surfaceEl }]}><Text style={[s.optKeyTxt, { color: tk.textSec }]}>{'ABCD'[i]}</Text></View>
              <Text style={[s.optTxt, { color: fg }]}>{opt}</Text>
              {revealed && isAnswer && <ICONS.CheckCircle color="#10B981" size={20} />}
              {revealed && isPicked && !isAnswer && <ICONS.X color="#DC2626" size={20} />}
            </TouchableOpacity>
          );
        })}

        {revealed && (
          <Text style={[type.sub, { color: picked === q.answer ? '#10B981' : '#DC2626', textAlign: 'center', marginTop: space.sm }]}>
            {picked === q.answer ? T('correct') : `${picked === -1 ? T('time_up') : T('wrong')} · ${T('answer_was', { a: q.options[q.answer] })}`}
            {'  ·  '}{q.ref}
          </Text>
        )}

        {!revealed && !prompt && (
          <View style={s.lifelines}>
            <RewardButton gate={gate} lang={lang} tk={tk} accent={ACCENT} label={T('fifty')} used={usedFifty} onReward={fifty} icon={<ICONS.Zap color={ACCENT} size={16} />} />
            <RewardButton gate={gate} lang={lang} tk={tk} accent={ACCENT} label={T('skip')} used={usedSkip} onReward={skip} icon={<ICONS.FastForward color={ACCENT} size={16} />} />
          </View>
        )}

        {prompt && (
          <View style={[s.chance, { backgroundColor: tk.surface, borderColor: ACCENT + '66' }]}>
            <Text style={[type.h3, { color: tk.textPrimary }]}>{T('second_chance_title')}</Text>
            <Text style={[type.sub, { color: tk.textSec, marginTop: 4 }]}>{gate.mode === 'ad' ? T('second_chance_body') : T('second_chance_free')}</Text>
            <TouchableOpacity
              disabled={gate.mode === 'none' || gate.busy}
              onPress={takeSecondChance}
              style={[s.primary, { backgroundColor: gate.mode === 'none' ? tk.surfaceEl : ACCENT, marginTop: space.md, alignSelf: 'stretch' }]}
              accessibilityRole="button"
            >
              <Text style={s.primaryTxt}>{T('continue')}{gate.mode !== 'none' ? ` · ${gateCaption(gate, lang)}` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={declineChance} style={s.link} accessibilityRole="button">
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
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radii.xl, marginBottom: space.lg },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 2, fontWeight: '600' },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radii.xl, borderWidth: 1, marginBottom: space.md, minHeight: 72 },
  levelBadge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  levelNum: { fontSize: 22, fontWeight: '900' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: space.lg },
  fill: { height: '100%', borderRadius: 4 },
  qCard: { padding: 20, borderRadius: radii.xl, borderWidth: 1, marginBottom: space.lg, minHeight: 110, justifyContent: 'center' },
  qText: { fontSize: 19, fontWeight: '800', lineHeight: 27 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.lg, borderWidth: 1.5, marginBottom: 10, minHeight: 56 },
  optGap: { height: 56 + 10 },
  optKey: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optKeyTxt: { fontSize: 13, fontWeight: '900' },
  optTxt: { flex: 1, fontSize: 15.5, fontWeight: '700', lineHeight: 21 },
  lifelines: { flexDirection: 'row', gap: 10, marginTop: space.md },
  chance: { marginTop: space.lg, padding: 18, borderRadius: radii.xl, borderWidth: 1.5 },
  resultCard: { alignSelf: 'stretch', alignItems: 'center', padding: 24, borderRadius: radii.xl, borderWidth: 1, marginVertical: space.xl },
  bigNum: { fontSize: 56, fontWeight: '900', letterSpacing: -1 },
  primary: { alignSelf: 'stretch', minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 10 },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { alignSelf: 'stretch', minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginTop: 10 },
  secondaryTxt: { fontSize: 16, fontWeight: '800' },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
});
