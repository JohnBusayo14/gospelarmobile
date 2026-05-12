// hooks/useFluidAnim.js
// ─────────────────────────────────────────────────────────────────────────────
// Fluid screen-entry + list-stagger + count-up animation primitives, all
// built on React Native's stock Animated API (no Reanimated dependency).
//
// Usage examples:
//
//   // 1. Screen-level fade + slide on mount
//   const { fade, translateY } = useScreenEntry();
//   <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
//
//   // 2. Staggered list-row entry
//   {items.map((item, i) => {
//     const { fade, translateY } = useStaggerEntry(i);
//     return <Animated.View key={item.id} style={{ opacity: fade, transform: [{ translateY }] }}>...</Animated.View>;
//   })}
//
//   // 3. Press scale-down feedback
//   const { scale, onPressIn, onPressOut } = usePressScale();
//   <Animated.View style={{ transform: [{ scale }] }}>
//     <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>...</Pressable>
//   </Animated.View>
//
//   // 4. Number count-up (for hero metrics like "$0.00 → $1,250.00")
//   const animated = useCountUp(currentValue, 800);
//   <Text>{animated.toFixed(2)}</Text>
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

// Standard easing — same curve everywhere for visual consistency.
const EASE_OUT = Easing.out(Easing.cubic);

// ─────────────────────────────────────────────────────────────────────────────
// Screen entry: fade-in + slide-up on first mount.
// ─────────────────────────────────────────────────────────────────────────────
export function useScreenEntry({ delay = 0, duration = 420, slide = 16 } = {}) {
  const fade       = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slide)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,       { toValue: 1, duration, delay, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, [duration, delay, fade, translateY]);

  return { fade, translateY };
}

// ─────────────────────────────────────────────────────────────────────────────
// Staggered list entry: rows pop in 60ms apart for a natural cascade.
// Capped at 12 rows so a long list doesn't take forever to settle.
// ─────────────────────────────────────────────────────────────────────────────
export function useStaggerEntry(index = 0, { stagger = 60, max = 12, slide = 14 } = {}) {
  const delay = Math.min(index, max) * stagger;
  return useScreenEntry({ delay, duration: 380, slide });
}

// ─────────────────────────────────────────────────────────────────────────────
// Press feedback: scale 1 → 0.96 on press-in, spring back on press-out.
// Use with Pressable; wrap the visible content in Animated.View.
// ─────────────────────────────────────────────────────────────────────────────
export function usePressScale({ to = 0.96 } = {}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, tension: 200, friction: 12 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1,  useNativeDriver: true, tension: 200, friction: 12 }).start();
  return { scale, onPressIn, onPressOut };
}

// ─────────────────────────────────────────────────────────────────────────────
// Count-up: smoothly animates from the previous value to the new one.
// Useful for hero metrics — running totals, scores, streaks.
// Uses Animated.Value internally but reads it back via a JS listener so the
// caller gets a plain number it can format with .toFixed() / toLocaleString().
// ─────────────────────────────────────────────────────────────────────────────
export function useCountUp(target, duration = 800) {
  const anim          = useRef(new Animated.Value(0)).current;
  const [value, set]  = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => set(v));
    Animated.timing(anim, {
      toValue: Number(target) || 0,
      duration,
      easing: EASE_OUT,
      useNativeDriver: false,   // listener requires JS driver
    }).start();
    return () => anim.removeListener(id);
  }, [target, duration, anim]);

  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated progress bar: width interpolates from 0% → target%.
// Returns a width string (e.g. "65%") suitable for a View's style.
// ─────────────────────────────────────────────────────────────────────────────
export function useAnimatedWidth(targetPct = 0, duration = 700) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, Number(targetPct) || 0)),
      duration,
      easing: EASE_OUT,
      useNativeDriver: false,
    }).start();
  }, [targetPct, duration, anim]);
  return anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
}
