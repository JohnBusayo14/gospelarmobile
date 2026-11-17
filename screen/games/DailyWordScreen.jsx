// screen/games/DailyWordScreen.jsx
// Daily Scripture Word — one 5-letter Bible word a day, six guesses, the same
// puzzle for everyone (picked by date). A rewarded ad (or a free use) can
// reveal a letter or give one extra guess. Result is shareable on WhatsApp.
// Progress is saved per day, so closing the app never loses a game.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Share, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens, type, space, radii } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import RewardButton, { useRewardGate } from '../../components/games/RewardButton';
import Confetti from '../../components/games/Confetti';
import { gt } from '../../data/games/strings';
import WORDS from '../../data/games/dailyWords';
import { recordRound, submitGameXp, gameLang } from '../../services/games';
import { showGameInterstitial } from '../../services/ads';

const ACCENT = '#0EA5E9';
const LEN = 5;
const BASE_GUESSES = 6;
const K_STATE = 'daily_word_v1';
const K_STREAK = 'daily_word_streak_v1';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.gospelar.app';
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', '*ZXCVBNM<'];
const COL = { correct: '#10B981', present: '#F59E0B', absent: '#6B7280' };

const dayNumber = () => Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000);
const wordForDay = (d) => WORDS[(((d * 5) % WORDS.length) + WORDS.length) % WORDS.length];

// Standard two-pass scoring: greens first, then yellows limited by letter counts.
export function scoreGuess(guess, answer) {
  const res = Array(LEN).fill('absent');
  const left = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === answer[i]) res[i] = 'correct';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (res[i] === 'correct') continue;
    if (left[guess[i]] > 0) { res[i] = 'present'; left[guess[i]]--; }
  }
  return res;
}

export default function DailyWordScreen({ navigation }) {
  const { isDark } = useTheme();
  const { lang: appLang } = useLanguage();
  const lang = gameLang(appLang);
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const T = useCallback((k, v) => gt(lang, k, v), [lang]);
  const gate = useRewardGate(2);

  const day = useMemo(dayNumber, []);
  const [word, clue, ref] = useMemo(() => wordForDay(day), [day]);

  const [ready, setReady] = useState(false);
  const [guesses, setGuesses] = useState([]);       // submitted words
  const [current, setCurrent] = useState('');
  const [status, setStatus] = useState('playing');  // playing | won | lost
  const [extra, setExtra] = useState(false);
  const [revealed, setRevealed] = useState([]);     // letter positions shown as hints
  const [streak, setStreak] = useState(0);
  const [msg, setMsg] = useState('');
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const maxGuesses = BASE_GUESSES + (extra ? 1 : 0);

  // ── Load today's saved game + streak ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [raw, sraw] = await Promise.all([AsyncStorage.getItem(K_STATE), AsyncStorage.getItem(K_STREAK)]);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && saved.day === day) {
          setGuesses(saved.guesses || []); setStatus(saved.status || 'playing');
          setExtra(!!saved.extra); setRevealed(saved.revealed || []);
        }
        const st = sraw ? JSON.parse(sraw) : null;
        if (st && day - st.last <= 1) setStreak(st.count || 0);
      } catch {}
      if (mounted.current) setReady(true);
    })();
  }, [day]);

  const persist = (next) => {
    AsyncStorage.setItem(K_STATE, JSON.stringify({ day, guesses, status, extra, revealed, ...next })).catch(() => {});
  };

  // ── Input ──────────────────────────────────────────────────────────────────
  const flash = (m) => { setMsg(m); setTimeout(() => mounted.current && setMsg(''), 1600); };

  const finishGame = async (won, used) => {
    const score = won ? Math.max(20, (BASE_GUESSES + 1 - used) * 20) : 0;
    await recordRound('daily_word', score);
    if (won) {
      const next = streak + 1;
      setStreak(next);
      AsyncStorage.setItem(K_STREAK, JSON.stringify({ last: day, count: next })).catch(() => {});
      submitGameXp('daily_word', score, { guesses: used });
    }
  };

  const press = (k) => {
    if (status !== 'playing') return;
    if (k === '<') return setCurrent((c) => c.slice(0, -1));
    if (k === '*') {
      if (current.length < LEN) return flash(T('dw_short'));
      const g = current.toUpperCase();
      const nextGuesses = [...guesses, g];
      const won = g === word;
      const lost = !won && nextGuesses.length >= maxGuesses;
      const nextStatus = won ? 'won' : lost ? 'lost' : 'playing';
      setGuesses(nextGuesses); setCurrent(''); setStatus(nextStatus);
      persist({ guesses: nextGuesses, status: nextStatus });
      if (won || lost) finishGame(won, nextGuesses.length);
      return;
    }
    setCurrent((c) => (c.length < LEN ? c + k : c));
  };

  // ── Rewarded helpers ───────────────────────────────────────────────────────
  const reveal = () => {
    const known = new Set(revealed);
    guesses.forEach((g) => scoreGuess(g, word).forEach((r, i) => { if (r === 'correct') known.add(i); }));
    const open = [...Array(LEN).keys()].filter((i) => !known.has(i));
    if (!open.length) return flash(T('dw_no_more'));
    const pick = open[Math.floor(Math.random() * open.length)];
    const next = [...revealed, pick];
    setRevealed(next); persist({ revealed: next }); flash(T('dw_hint_used'));
  };
  const addExtra = () => {
    setExtra(true); setStatus('playing');
    persist({ extra: true, status: 'playing' });
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const share = () => {
    const grid = guesses.map((g) => scoreGuess(g, word).map((r) => (r === 'correct' ? '🟩' : r === 'present' ? '🟨' : '⬛')).join('')).join('\n');
    const head = T('dw_share_text', { n: day + 1, a: status === 'won' ? guesses.length : 'X', b: BASE_GUESSES });
    Share.share({ message: `${head}\n\n${grid}\n\n${T('dw_get')} ${PLAY_URL}` }).catch(() => {});
  };

  const leave = async () => {
    if (status !== 'playing') { try { await showGameInterstitial(); } catch {} }
    navigation.goBack();
  };

  // ── Derived keyboard colours ───────────────────────────────────────────────
  const keyState = useMemo(() => {
    const m = {};
    const rank = { absent: 1, present: 2, correct: 3 };
    guesses.forEach((g) => scoreGuess(g, word).forEach((r, i) => {
      if (!m[g[i]] || rank[r] > rank[m[g[i]]]) m[g[i]] = r;
    }));
    return m;
  }, [guesses, word]);

  if (!ready) return <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]} />;

  const rows = [];
  for (let r = 0; r < maxGuesses; r++) {
    const g = guesses[r];
    const typing = r === guesses.length && status === 'playing';
    const res = g ? scoreGuess(g, word) : null;
    rows.push(
      <View key={r} style={s.gridRow}>
        {[...Array(LEN).keys()].map((i) => {
          const letter = g ? g[i] : typing ? (current[i] || '') : '';
          const bg = res ? COL[res[i]] : tk.surface;
          const hintLetter = !letter && typing && revealed.includes(i) ? word[i] : '';
          return (
            <View key={i} style={[s.tile, { backgroundColor: bg, borderColor: res ? bg : letter ? tk.textMuted : tk.border }]}>
              <Text style={[s.tileTxt, { color: res ? '#fff' : tk.textPrimary }]}>{letter || ''}</Text>
              {!!hintLetter && <Text style={[s.tileTxt, { color: ACCENT, opacity: 0.55, position: 'absolute' }]}>{hintLetter}</Text>}
            </View>
          );
        })}
      </View>,
    );
  }

  const finished = status !== 'playing';
  return (
    <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.top}>
        <TouchableOpacity onPress={leave} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[s.iconBtn, { backgroundColor: tk.surface }]}>
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
        </TouchableOpacity>
        <Text style={[type.h3, { color: tk.textPrimary, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{T('g_word')}</Text>
        <View style={[s.streak, { backgroundColor: ACCENT + '22' }]}><Text style={{ color: ACCENT, fontWeight: '800', fontSize: 12 }}>🔥 {streak}</Text></View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, alignItems: 'center' }}>
        <View style={[s.clue, { backgroundColor: tk.surface, borderColor: tk.border }]}>
          <Text style={[type.label, { color: ACCENT }]}>{T('dw_clue').toUpperCase()} · {ref}</Text>
          <Text style={[type.body, { color: tk.textPrimary, marginTop: 4 }]}>{clue}</Text>
        </View>

        <View style={{ marginVertical: space.lg }}>{rows}</View>

        {!!msg && <Text style={[type.sub, { color: ACCENT, marginBottom: 8 }]}>{msg}</Text>}

        {finished ? (
          <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
            <Text style={[type.h2, { color: status === 'won' ? '#10B981' : '#DC2626', textAlign: 'center' }]}>
              {status === 'won' ? T('dw_solved') : T('dw_failed', { w: word })}
            </Text>
            {status === 'won' && <Text style={[type.sub, { color: tk.textSec, marginTop: 4 }]}>{T('dw_streak', { n: streak })}</Text>}
            <TouchableOpacity style={[s.primary, { backgroundColor: ACCENT }]} onPress={share} accessibilityRole="button">
              <ICONS.Share color="#fff" size={18} /><Text style={s.primaryTxt}>{T('dw_share')}</Text>
            </TouchableOpacity>
            {status === 'lost' && !extra && (
              <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
                <RewardButton gate={gate} lang={lang} tk={tk} accent={ACCENT} label={T('dw_extra')} onReward={addExtra} icon={<ICONS.Plus color={ACCENT} size={16} />} />
              </View>
            )}
            <Text style={[type.sub, { color: tk.textMuted, marginTop: space.lg, textAlign: 'center' }]}>{T('dw_back')}</Text>
          </View>
        ) : (
          <>
            <View style={{ alignSelf: 'stretch', flexDirection: 'row', marginBottom: space.md }}>
              <RewardButton gate={gate} lang={lang} tk={tk} accent={ACCENT} label={T('dw_reveal')} onReward={reveal} icon={<ICONS.Eye color={ACCENT} size={16} />} />
            </View>
            <View style={{ alignSelf: 'stretch' }}>
              {ROWS.map((row, ri) => (
                <View key={ri} style={s.kbRow}>
                  {row.split('').map((k) => {
                    const st = keyState[k];
                    const wide = k === '*' || k === '<';
                    return (
                      <TouchableOpacity
                        key={k}
                        onPress={() => press(k)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={k === '*' ? T('dw_enter') : k === '<' ? 'Delete' : k}
                        style={[s.key, wide && { flex: 1.6 }, { backgroundColor: st ? COL[st] : tk.surfaceEl }]}
                      >
                        <Text style={[s.keyTxt, { color: st ? '#fff' : tk.textPrimary }]}>{k === '*' ? '⏎' : k === '<' ? '⌫' : k}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {status === 'won' && <Confetti />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  streak: { minWidth: 40, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  clue: { alignSelf: 'stretch', padding: 14, borderRadius: radii.xl, borderWidth: 1 },
  gridRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tile: { width: 52, height: 52, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tileTxt: { fontSize: 24, fontWeight: '900' },
  kbRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 8 },
  key: { flex: 1, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  keyTxt: { fontSize: 15, fontWeight: '800' },
  primary: { alignSelf: 'stretch', minHeight: 54, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
