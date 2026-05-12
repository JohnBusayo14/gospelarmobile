// components/AppTabBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Professional bottom tab bar with proper SVG stroke icons.
// Tabs: Home · Lessons · Notes · Stats · Settings
// Active tab gets filled/stroked accent colour + animated pill + label bold.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Platform,
} from 'react-native';
import { ICONS } from './icons';

// Re-export so legacy imports `import { ICONS } from '../components/AppTabBar'`
// keep working without a sweep. New code should import directly from
// './components/icons' instead.
export { ICONS };

const BLUE = '#1A56DB';


// Default tab set (the student/home experience). Each tab is { key, label }.
// `key` must be one of the ICONS map keys.
const DEFAULT_TABS = [
  { key:'Home',     label:'Home' },
  { key:'Lessons',  label:'Lessons' },
  { key:'Notes',    label:'Notes' },
  { key:'Stats',    label:'Stats' },
  { key:'Settings', label:'Settings' },
];

export default function AppTabBar({ activeTab = 0, onTab, tk, labels, tabs }) {
  // Resolve which tab config to use:
  //   - explicit `tabs` prop wins (e.g. teacher dashboard passes its own)
  //   - else default set, with optional `labels` array overriding the names
  const TABS = (tabs && tabs.length)
    ? tabs
    : DEFAULT_TABS.map((t, i) => ({ ...t, label: (labels && labels[i]) || t.label }));

  // Per-tab animation instances. These are kept on a ref so they survive
  // re-renders but reset when the tab count changes (teacher↔student swap).
  const animsRef = useRef(null);
  if (!animsRef.current || animsRef.current.length !== TABS.length) {
    animsRef.current = TABS.map((_, i) => new Animated.Value(i === activeTab ? 1 : 0));
  }
  const _anims = animsRef.current;
  const prevTab = useRef(activeTab);
  const bg      = tk?.surface  || '#FFFFFF';
  const border  = tk?.border   || '#E8EAED';
  const muted   = tk?.textMuted|| '#9AA0AB';

  useEffect(() => {
    const prev = prevTab.current;
    if (prev !== activeTab) {
      Animated.timing(_anims[prev], { toValue: 0, duration: 160, useNativeDriver: true }).start();
      prevTab.current = activeTab;
    }
    Animated.spring(_anims[activeTab], { toValue: 1, tension: 140, friction: 9, useNativeDriver: true }).start();
  }, [activeTab]);

  return (
    <View style={[s.bar, { backgroundColor: bg, borderTopColor: border }]}>
      {TABS.map((tab, i) => {
        const active    = i === activeTab;
        const IconComp  = ICONS[tab.key] || ICONS.Home;
        const iconColor = active ? BLUE : muted;
        const label     = tab.label;
        const scaleAnim = _anims[i].interpolate({ inputRange: [0, 1], outputRange: [1, 1.10] });

        return (
          <TouchableOpacity
            key={tab.key + i}
            onPress={() => onTab(i)}
            activeOpacity={0.72}
            style={s.item}
          >
            {/* Icon — scales slightly on active */}
            <Animated.View style={[s.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
              <IconComp
                color={iconColor}
                size={22}
                sw={active ? 2.1 : 1.6}
              />
            </Animated.View>

            {/* Label */}
            <Text style={[s.label, { color: active ? BLUE : muted, fontWeight: active ? '700' : '400' }]}>
              {label}
            </Text>

            {/* Thin active underline dot only */}
            {active && <View style={[s.activeLine, { backgroundColor: BLUE }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection:  'row',
    borderTopWidth: 1,
    paddingBottom:  Platform.OS === 'ios' ? 28 : 10,
    paddingTop:     8,
    position:       'absolute',
    bottom:         0, left: 0, right: 0,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: -3 },
    shadowOpacity:  0.07,
    shadowRadius:   12,
    elevation:      14,
  },
  item: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     4,
    position:       'relative',
  },
  iconWrap: {
    width:          26,
    height:         26,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   3,
  },
  label: {
    fontSize:      9.5,
    letterSpacing: 0.1,
    includeFontPadding: false,
  },
  activeLine: {
    position:     'absolute',
    top:          0,
    left:         '25%',
    right:        '25%',
    height:       2.5,
    borderRadius: 2,
  },
});