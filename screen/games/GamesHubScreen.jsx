// screen/games/GamesHubScreen.jsx
// The "Bible Games" book: a hero with the player's game XP + four game cards.
// Games not built yet show "Coming soon"; flip `ready` below as each ships.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens, type, space, radii } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import AdSlot from '../../components/ads/AdSlot';
import { gt } from '../../data/games/strings';
import { getGameStats, flushPendingXp, fetchServerGameStats, gameLang } from '../../services/games';

const ACCENT = '#DB2777';

const GAMES = [
  { id: 'trivia', route: 'TriviaGame',  title: 'g_trivia', sub: 'g_trivia_sub', color: '#DB2777', icon: 'Trophy', ready: true  },
  { id: 'word',   route: 'DailyWord',   title: 'g_word',   sub: 'g_word_sub',   color: '#0EA5E9', icon: 'Book',   ready: false },
  { id: 'verse',  route: 'VerseBuilder',title: 'g_verse',  sub: 'g_verse_sub',  color: '#10B981', icon: 'Quote',  ready: false },
  { id: 'hymn',   route: 'FinishHymn',  title: 'g_hymn',   sub: 'g_hymn_sub',   color: '#7C3AED', icon: 'Music',  ready: false },
];

export default function GamesHubScreen({ navigation }) {
  const { isDark } = useTheme();
  const { lang: appLang } = useLanguage();
  const lang = gameLang(appLang);
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const T = useCallback((k, v) => gt(lang, k, v), [lang]);

  const [xp, setXp] = useState(0);
  const [best, setBest] = useState(0);
  const [cap, setCap] = useState(60);

  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      const local = await getGameStats();
      if (live) { setXp(local.totalXp || 0); setBest((local.trivia && local.trivia.best) || 0); }
      await flushPendingXp().catch(() => {});
      const server = await fetchServerGameStats();
      if (live && server) {
        setCap(server.daily_cap || 60);
        const total = Object.values(server.games || {}).reduce((a, g) => a + (g.xp || 0), 0);
        if (total) setXp(total);
      }
    })();
    return () => { live = false; };
  }, []));

  return (
    <SafeAreaView style={[s.root, { backgroundColor: tk.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.top}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[s.iconBtn, { backgroundColor: tk.surface }]}>
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} />
        </TouchableOpacity>
        <Text style={[type.h3, { color: tk.textPrimary, flex: 1, textAlign: 'center' }]}>{T('hub_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm }}>
        <LinearGradient colors={['#4C1D95', '#BE185D', ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <Text style={s.heroTitle}>{T('hub_title')}</Text>
          <Text style={s.heroSub}>{T('hub_sub')}</Text>
          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statNum}>{xp}</Text><Text style={s.statLbl}>{T('hub_xp')}</Text></View>
            <View style={s.statDiv} />
            <View style={s.stat}><Text style={s.statNum}>{best}</Text><Text style={s.statLbl}>{T('hub_best')}</Text></View>
          </View>
          <Text style={s.cap}>{T('hub_daily_cap', { n: cap })}</Text>
        </LinearGradient>

        {GAMES.map((g) => {
          const Icon = ICONS[g.icon] || ICONS.Star;
          return (
            <TouchableOpacity
              key={g.id}
              disabled={!g.ready}
              onPress={() => navigation.navigate(g.route)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !g.ready }}
              style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border, opacity: g.ready ? 1 : 0.6 }]}
            >
              <View style={[s.cardIcon, { backgroundColor: g.color + '22' }]}><Icon color={g.color} size={26} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[type.h3, { color: tk.textPrimary }]} numberOfLines={2}>{T(g.title)}</Text>
                <Text style={[type.caption, { color: tk.textMuted, marginTop: 3 }]} numberOfLines={2}>{T(g.sub)}</Text>
              </View>
              <View style={[s.pill, { backgroundColor: g.ready ? g.color : tk.surfaceEl }]}>
                <Text style={[s.pillTxt, { color: g.ready ? '#fff' : tk.textMuted }]}>{g.ready ? T('hub_play') : T('hub_soon')}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <AdSlot />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 22, borderRadius: radii['2xl'], marginBottom: space.xl },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13.5, marginTop: 4, fontWeight: '600', lineHeight: 19 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 26, fontWeight: '900' },
  statLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  statDiv: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.3)' },
  cap: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radii.xl, borderWidth: 1, marginBottom: space.md, minHeight: 80 },
  cardIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  pillTxt: { fontSize: 11.5, fontWeight: '800' },
});
