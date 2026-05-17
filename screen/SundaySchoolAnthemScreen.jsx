// screens/SundaySchoolAnthemScreen.jsx
// Static text-display screen for the Sunday School anthem. Reached from the
// music-note button on the Home screen's quarter card.

import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }       from '../context/ThemeContext';
import { useLanguage }    from '../context/LanguageContext';
import { getTokens }      from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';
import { ICONS }          from '../components/icons';

const ACCENT = '#2563EB';

const STANZAS = [
  [
    'I cherish you my Sunday School',
    'Oh how precious thou art',
    'I long to see you every day',
    'I rejoice in thy joy.',
    'In you the word of the Lord revive our soul',
    'And prepares our soul, for blessed home',
    'To reign with Christ the Lord.',
  ],
  [
    'Spirit of God our light divine',
    'Instruct us in your word',
    'Guide us into your holy truth and teach us how to live',
    'We speak and live depending on your power abide in us',
    'And live through us to day and ever more.',
  ],
];

export default function SundaySchoolAnthemScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 42, height: 42, borderRadius: 14,
            justifyContent: 'center', alignItems: 'center',
            backgroundColor: tk.surface,
          }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: tk.textPrimary }}>←</Text>
        </TouchableOpacity>
        <Text style={{
          flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900',
          color: tk.textPrimary, marginRight: 42,
        }}>
          {t('anthem_title', 'Sunday School Anthem')}
        </Text>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        <LinearGradient
          colors={isDark ? ['#1A1D27', '#0F1117'] : ['#EFF6FF', '#FFFFFF']}
          style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: isDark ? '#0F1117' : '#fff',
            borderWidth: 2, borderColor: ACCENT + '30',
            justifyContent: 'center', alignItems: 'center', marginBottom: 18,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.10, shadowRadius: 12, elevation: 5,
          }}>
            <ICONS.Music color={ACCENT} size={36} sw={2} />
          </View>
          <Text style={{
            fontSize: 22, fontWeight: '900',
            color: isDark ? '#F9FAFB' : '#111827',
            letterSpacing: 0.8, marginBottom: 4, textAlign: 'center',
          }}>
            {t('anthem_title', 'Sunday School Anthem')}
          </Text>
          <View style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: ACCENT, marginTop: 12 }} />
        </LinearGradient>

        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {STANZAS.map((lines, idx) => (
            <View
              key={idx}
              style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border, marginBottom: 16 }]}>
              <View style={[s.stripe, { backgroundColor: idx === 0 ? ACCENT : '#10B981' }]} />
              <View style={{ padding: 20 }}>
                <Text style={{
                  fontSize: 10, fontWeight: '900', letterSpacing: 2.2,
                  color: tk.textMuted, textTransform: 'uppercase', marginBottom: 12,
                }}>
                  {t('anthem_stanza', 'Stanza')} {idx + 1}
                </Text>
                {lines.map((line, i) => (
                  <Text key={i} style={[s.line, { color: tk.textSec }]}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  card:   { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  stripe: { height: 4 },
  line:   { fontSize: 16, fontWeight: '500', lineHeight: 26, marginBottom: 4 },
});
