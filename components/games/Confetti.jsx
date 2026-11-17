// components/games/Confetti.jsx
// Plain Animated confetti (no GL / native modules) for level-passed and
// puzzle-solved moments. Renders on top of its parent, ignores touches, and
// removes itself once the pieces have fallen.
//
//   {passed && <Confetti />}

import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#F5C451', '#DB2777', '#10B981', '#0EA5E9', '#7C3AED', '#F97316', '#FFFFFF'];

export default function Confetti({ count = 44, duration = 2600 }) {
  const { width, height } = Dimensions.get('window');
  const [done, setDone] = useState(false);

  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    key: i,
    left: Math.random() * width,
    size: 7 + Math.random() * 7,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 500,
    drift: (Math.random() - 0.5) * 120,
    spin: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3),
    round: Math.random() > 0.6,
    fall: new Animated.Value(0),
  })), [count, width]);

  useEffect(() => {
    const anims = pieces.map((p) => Animated.timing(p.fall, {
      toValue: 1, duration: duration + Math.random() * 600, delay: p.delay,
      easing: Easing.in(Easing.quad), useNativeDriver: true,
    }));
    Animated.parallel(anims).start(() => setDone(true));
    return () => anims.forEach((a) => a.stop());
  }, [pieces, duration]);

  if (done) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants">
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute', top: -20, left: p.left,
            width: p.size, height: p.round ? p.size : p.size * 1.7,
            borderRadius: p.round ? p.size : 2, backgroundColor: p.color,
            opacity: p.fall.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.fall.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
              { translateX: p.fall.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 360}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
