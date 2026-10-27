// components/BottomSheet.jsx
// Shared slide-up sheet used by HymnModal and BibleVerseModal.
// Sized from the live window (not module-load Dimensions), capped in width on
// wide screens, padded for the system navigation bar, and dismissible by
// swiping the handle/header down. Only core RN APIs — gesture-handler is
// installed but not set up with a root view, so it must not be used here.

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View, Modal, Pressable, TouchableOpacity, Animated, PanResponder,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokens, radii, space } from '../theme/tokens';
import { ICONS } from './icons';
import { useLanguage } from '../context/LanguageContext';

const MAX_WIDTH = 640;

export default function BottomSheet({
  visible, onClose, isDark, heightRatio = 0.8, header, footer, children,
}) {
  const { t } = useLanguage();
  const tk = getTokens(isDark === true);
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetH = Math.round(Math.min(winH * heightRatio, winH - insets.top - 24));
  const bottomPad = Math.max(insets.bottom, space.lg);

  const slideY    = useRef(new Animated.Value(sheetH)).current;
  const backdropO = useRef(new Animated.Value(0)).current;
  const sheetHRef = useRef(sheetH);
  sheetHRef.current = sheetH;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Keep the in-flight handle so a fast toggle or unmount mid-animation can
  // stop it — otherwise RN crashes with "stopTracking of undefined".
  const anim = useRef(null);
  const run = (a) => {
    try { anim.current?.stop(); } catch { /* already done */ }
    anim.current = a;
    a.start();
  };
  const springOpen = () => Animated.spring(slideY, {
    toValue: 0, useNativeDriver: true, damping: 22, stiffness: 150,
  });

  useEffect(() => {
    if (visible) {
      slideY.setValue(sheetHRef.current);
      run(Animated.parallel([
        springOpen(),
        Animated.timing(backdropO, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]));
    } else {
      run(Animated.parallel([
        Animated.timing(slideY,    { toValue: sheetHRef.current, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropO, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]));
    }
    return () => { try { anim.current?.stop(); } catch { /* already done */ } };
  }, [visible]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => { try { anim.current?.stop(); } catch { /* already done */ } },
    onPanResponderMove: (_, g) => slideY.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > sheetHRef.current * 0.25 || g.vy > 1.2) onCloseRef.current?.();
      else run(springOpen());
    },
    onPanResponderTerminate: () => run(springOpen()),
  }), []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropO }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('btn_close', 'Close')}
        />
      </Animated.View>

      <View style={s.dock} pointerEvents="box-none">
        <Animated.View
          style={[
            s.sheet,
            { height: sheetH, backgroundColor: tk.bg, transform: [{ translateY: slideY }] },
          ]}
        >
          <View {...pan.panHandlers}>
            <View style={s.handleArea}>
              <View style={[s.handle, { backgroundColor: tk.border }]} />
            </View>
            <View style={[s.headerRow, { borderBottomColor: tk.border }]}>
              <View style={{ flex: 1 }}>{header}</View>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.75}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('btn_close', 'Close')}
                style={[s.closeBtn, { backgroundColor: tk.surface }]}
              >
                <ICONS.X color={tk.textSec} size={18} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1 }}>{children}</View>

          {footer ? (
            <View style={[s.footer, { borderTopColor: tk.border, paddingBottom: bottomPad }]}>
              {footer}
            </View>
          ) : (
            <View style={{ height: bottomPad }} />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:   { backgroundColor: 'rgba(0,0,0,0.55)' },
  dock:       { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: MAX_WIDTH,
    borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'],
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 20,
  },
  handleArea: { alignItems: 'center', paddingTop: space.md, paddingBottom: space.xs },
  handle:     { width: 40, height: 4, borderRadius: 2 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, marginLeft: space.md,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: space.xl, paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
