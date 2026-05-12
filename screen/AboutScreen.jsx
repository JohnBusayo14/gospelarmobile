// screens/AboutScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Stripped-down About page — just three sections: Mission, Vision, Contact.
// All other content (version / built-with / backend / release date) removed
// per design request. Same hero + token system as the rest of the app.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Linking, Image, Animated,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }       from '../context/ThemeContext';
import { useLanguage }    from '../context/LanguageContext';
import { getTokens }      from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';

const ACCENT = '#2563EB';

// Reusable section header — small ALL-CAPS label + accent stripe inside the
// card. Keeps the three sections visually rhymed.
const SectionLabel = ({ children, color }) => (
  <Text style={{
    fontSize: 10, fontWeight: '900', letterSpacing: 2.2,
    color, textTransform: 'uppercase', marginBottom: 12,
  }}>
    {children}
  </Text>
);

// Reusable contact row — icon + label + value, optional press handler that
// opens the link/mail. Used for both website and email.
const ContactRow = ({ icon, label, value, onPress, tk, noBorder }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: noBorder ? 0 : 1,
      borderBottomColor: tk.border,
    }}>
    <View style={{
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: ACCENT + '15',
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: tk.textMuted, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: tk.textPrimary, marginTop: 2 }}>{value}</Text>
    </View>
    {!!onPress && <Text style={{ fontSize: 18, color: ACCENT }}>›</Text>}
  </TouchableOpacity>
);

export default function AboutScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      {/* Topbar — back button only, title centered */}
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
          {t('about', 'About')}
        </Text>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: fade, transform: [{ translateY }] }}>

        {/* ── HERO ── */}
        <LinearGradient
          colors={isDark ? ['#1A1D27', '#0F1117'] : ['#EFF6FF', '#FFFFFF']}
          style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: isDark ? '#0F1117' : '#fff',
            borderWidth: 2, borderColor: ACCENT + '30',
            justifyContent: 'center', alignItems: 'center', marginBottom: 20,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.10, shadowRadius: 12, elevation: 5,
          }}>
            <Image
              source={require('../assets/image2.png')}
              style={{ width: 68, height: 68 }}
              resizeMode="contain"
            />
          </View>
          <Text style={{
            fontSize: 26, fontWeight: '900',
            color: isDark ? '#F9FAFB' : '#111827',
            letterSpacing: 1.5, marginBottom: 4,
          }}>
            Gospelar
          </Text>
          <Text style={{
            fontSize: 14, fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 8,
          }}>
            {t('about_dept', 'Sunday School Department')}
          </Text>
          <View style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: ACCENT, marginBottom: 16 }} />
          <Text style={{
            fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280',
            textAlign: 'center', lineHeight: 20, maxWidth: 280,
          }}>
            {t('about_tagline', 'Empowering believers through systematic Bible study and spiritual formation.')}
          </Text>
        </LinearGradient>

        {/* ── 1. OUR MISSION ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 32 }}>
          <View style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border }]}>
            <View style={[s.stripe, { backgroundColor: ACCENT }]} />
            <View style={{ padding: 20 }}>
              <SectionLabel color={tk.textMuted}>{t('about_our_mission', 'Our Mission')}</SectionLabel>
              <Text style={[s.body, { color: tk.textSec }]}>
                {t('about_mission_body',
                  'Gospelar Sunday School is dedicated to providing quality, biblically-sound lessons that equip members of all ages for Christian living. Our app brings the Sunday School experience to your fingertips — anytime, anywhere.'
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 2. OUR VISION ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <View style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border }]}>
            <View style={[s.stripe, { backgroundColor: '#10B981' }]} />
            <View style={{ padding: 20 }}>
              <SectionLabel color={tk.textMuted}>{t('about_our_vision', 'Our Vision')}</SectionLabel>
              <Text style={[s.body, { color: tk.textSec }]}>
                {t('about_vision_body',
                  'To raise a generation of believers grounded in scripture, equipped to live out their faith with confidence and conviction — and to make the depth of Sunday School teaching accessible to every member of our church family, in every language they speak, on every device they own.'
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 3. CONTACT ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <View style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border, overflow: 'hidden' }]}>
            <View style={[s.stripe, { backgroundColor: '#7C3AED' }]} />
            <View style={{ paddingTop: 6, paddingBottom: 4 }}>
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
                <SectionLabel color={tk.textMuted}>{t('about_contact', 'Contact')}</SectionLabel>
              </View>
              <ContactRow
                icon="🌐"
                label={t('about_website', 'WEBSITE')}
                value="www.gospelar.com"
                tk={tk}
                onPress={() => Linking.openURL('https://www.gospelar.com')}
              />
              <ContactRow
                icon="✉️"
                label={t('about_email', 'EMAIL')}
                value="askgospelar@gmail.com"
                tk={tk}
                onPress={() => Linking.openURL('mailto:askgospelar@gmail.com')}
                noBorder
              />
            </View>
          </View>
        </View>

        {/* Copyright — small footer line, no card */}
        <View style={{ alignItems: 'center', paddingTop: 36, paddingHorizontal: 20 }}>
          <Text style={{
            fontSize: 11, color: tk.textMuted,
            textAlign: 'center', lineHeight: 18,
          }}>
            {t('about_copyright', '© 2026 Gospelar Sunday School Department\nAll rights reserved.')}
          </Text>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card:   { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  stripe: { height: 4 },
  body:   { fontSize: 15, fontWeight: '500', lineHeight: 24 },
});
