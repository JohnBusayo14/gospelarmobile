// screen/victory/VictoryUI.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared, fully-themed building blocks for every Victory Month screen.
//
// Exports:
//   <GlassCard>       — soft glass surface with ambient shadow
//   <GradientCTA>     — signature blue gradient pill button
//   <SectionHead>     — uppercase eyebrow + title + optional action
//   <Eyebrow>         — small label-style text
//   <Chip>            — pill chip used for filters / status
//   <ProgressRing>    — circular SVG progress ring
//   <ProgressBar>     — flat horizontal progress bar
//   <BackBar>         — sticky top bar (back · centre · right slot)
//   <EmptyState>      — friendly empty state with optional CTA
//   <CelebrateOverlay>— full-screen celebration with sparkles
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { BLUE, INDIGO, EMERALD, AMBER, RADII, AMBIENT_SHADOW, victoryTones } from './victoryTheme';

const { width: W } = Dimensions.get('window');

// ── GlassCard ───────────────────────────────────────────────────────────────
// Always renders a 1px hairline border from `tones.glassEdge`. In light mode
// the card fill (#FFFFFF) sits on a near-white page bg (#F4F6FB) and the
// ambient shadow alone isn't enough on every device — the border guarantees
// the box is visible. In dark mode the same edge is a subtle slate that just
// reinforces the lift the shadow already provides.
export const GlassCard = ({ tones, style, children, padding = 18, lifted = true }) => (
  <View
    style={[
      {
        backgroundColor: tones.glassFill,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: tones.glassEdge,
        padding,
      },
      lifted && AMBIENT_SHADOW,
      style,
    ]}
  >
    {children}
  </View>
);

// ── GradientCTA ─────────────────────────────────────────────────────────────
export const GradientCTA = ({
  label, onPress, icon, colors = [BLUE[700], BLUE[500]], variant = 'primary',
  style, textStyle, disabled, size = 'lg',
}) => {
  const heights = { sm: 40, md: 48, lg: 54 };
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.86}
      style={[
        {
          borderRadius: RADII.pill,
          shadowColor: colors[0],
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 18,
          elevation: 6,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          height: heights[size],
          borderRadius: RADII.pill,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 22,
        }}
      >
        {!!icon && <Text style={{ fontSize: 16 }}>{icon}</Text>}
        <Text style={[{ color: '#fff', fontSize: 14.5, fontWeight: '900', letterSpacing: 0.3 }, textStyle]}>
          {label}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ── Eyebrow / chip / section head ──────────────────────────────────────────
export const Eyebrow = ({ children, color }) => (
  <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 2.2, color }}>
    {String(children).toUpperCase()}
  </Text>
);

export const Chip = ({ label, active, onPress, accent = BLUE[600], bg, fg }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={{
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADII.pill,
      backgroundColor: active ? accent : (bg || 'rgba(26, 86, 219, 0.10)'),
    }}
  >
    <Text style={{
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.3,
      color: active ? '#fff' : (fg || accent),
    }}>
      {label}
    </Text>
  </TouchableOpacity>
);

export const SectionHead = ({ title, action, onAction, tk, tones, eyebrow }) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  }}>
    <View>
      {!!eyebrow && <Eyebrow color={tones.chipFg}>{eyebrow}</Eyebrow>}
      <Text style={{
        fontSize: 18, fontWeight: '900', letterSpacing: -0.3,
        color: tk.textPrimary, marginTop: eyebrow ? 4 : 0,
      }}>
        {title}
      </Text>
    </View>
    {!!action && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.75}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: tones.chipFg }}>
          {action} →
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

// ── Progress ring (SVG) ────────────────────────────────────────────────────
export const ProgressRing = ({
  size = 120, stroke = 10, pct = 0,
  colours = [BLUE[700], BLUE[400]],
  trackColour = 'rgba(26, 86, 219, 0.12)',
  children,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safePct = Math.max(0, Math.min(100, pct));
  const dash = (safePct / 100) * c;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGrad id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colours[0]} />
            <Stop offset="1" stopColor={colours[1]} />
          </SvgGrad>
        </Defs>
        <Circle cx={size/2} cy={size/2} r={r} stroke={trackColour} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size/2} cy={size/2} r={r}
          stroke="url(#g)" strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
};

// ── Flat progress bar ──────────────────────────────────────────────────────
export const ProgressBar = ({ pct, tones, height = 8, accent = BLUE[600] }) => (
  <View style={{
    height, borderRadius: height/2, overflow: 'hidden',
    backgroundColor: tones.chipBg,
  }}>
    <View style={{
      height, borderRadius: height/2,
      width: `${Math.max(0, Math.min(100, pct))}%`,
      backgroundColor: accent,
    }} />
  </View>
);

// ── BackBar (sticky top header) ────────────────────────────────────────────
export const BackBar = ({ onBack, eyebrow, title, right, tones, tk }) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  }}>
    <TouchableOpacity
      onPress={onBack}
      activeOpacity={0.75}
      style={{
        width: 42, height: 42, borderRadius: 999,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: tones.chipBg,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '900', color: tones.chipFg }}>‹</Text>
    </TouchableOpacity>
    <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>
      {!!eyebrow && <Eyebrow color={tones.chipFg}>{eyebrow}</Eyebrow>}
      <Text
        numberOfLines={1}
        style={{ fontSize: 14, fontWeight: '900', color: tk.textPrimary, marginTop: 2 }}
      >
        {title}
      </Text>
    </View>
    <View style={{ width: 42, alignItems: 'flex-end' }}>{right || null}</View>
  </View>
);

// ── EmptyState ─────────────────────────────────────────────────────────────
export const EmptyState = ({ emoji = '🌱', title, body, action, onAction, tones, tk }) => (
  <GlassCard tones={tones} padding={26} style={{ alignItems: 'center', gap: 8 }}>
    <Text style={{ fontSize: 38, marginBottom: 4 }}>{emoji}</Text>
    <Text style={{ fontSize: 16, fontWeight: '900', color: tk.textPrimary, textAlign: 'center' }}>
      {title}
    </Text>
    {!!body && (
      <Text style={{
        fontSize: 13, fontWeight: '600', color: tk.textMuted,
        textAlign: 'center', lineHeight: 19, paddingHorizontal: 8,
      }}>
        {body}
      </Text>
    )}
    {!!action && (
      <View style={{ marginTop: 10 }}>
        <GradientCTA label={action} onPress={onAction} size="md" />
      </View>
    )}
  </GlassCard>
);

// ── CelebrateOverlay ───────────────────────────────────────────────────────
// Pops in over the screen for ~2.4s after an achievement unlocks. Falls back
// to a no-op render if `visible` is false. Animation uses native driver.
export const CelebrateOverlay = ({ visible, badge, onDone }) => {
  const fade  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 110, friction: 7, useNativeDriver: true }),
      ]),
      Animated.delay(1800),
      Animated.parallel([
        Animated.timing(fade,  { toValue: 0, duration: 260, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
        Animated.timing(scale, { toValue: 0.7, duration: 260, useNativeDriver: true }),
      ]),
    ]).start(() => onDone?.());
  }, [visible]);   // eslint-disable-line

  if (!visible || !badge) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: 'rgba(11, 42, 107, 0.55)',
          opacity: fade,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={[BLUE[700], INDIGO[600]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 28, paddingHorizontal: 36,
            borderRadius: 28, alignItems: 'center', maxWidth: W - 60,
          }}
        >
          <Text style={{ fontSize: 56, marginBottom: 10 }}>{badge.icon || '🎉'}</Text>
          <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 2.5, color: 'rgba(255,255,255,0.85)' }}>
            ACHIEVEMENT UNLOCKED
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 6, letterSpacing: -0.4, textAlign: 'center' }}>
            {badge.name}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 6, textAlign: 'center' }}>
            {badge.desc}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
};

// ── Soft glass icon button ─────────────────────────────────────────────────
export const IconButton = ({ symbol, onPress, tones, accent }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    style={{
      width: 42, height: 42, borderRadius: 999,
      backgroundColor: tones.chipBg,
      justifyContent: 'center', alignItems: 'center',
    }}
  >
    <Text style={{ fontSize: 16, fontWeight: '900', color: accent || tones.chipFg }}>
      {symbol}
    </Text>
  </TouchableOpacity>
);
