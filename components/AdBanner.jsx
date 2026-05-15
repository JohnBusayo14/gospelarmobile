// components/AdBanner.jsx
// ─────────────────────────────────────────────────────────────────────────────
// In-app ad banner modal. Appears over any screen.
// Fetches active banner from /api/banners/active every time the app foregrounds.
// Dismissed per session by tapping ✕. Respects scheduled_at + expires_at.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, Modal, StyleSheet,
  Dimensions, Animated, Easing, Linking, Platform, AppState,
} from 'react-native';
import { API_BASE_URL } from '../context/SubscriptionContext';

const { width, height } = Dimensions.get('window');
const BLUE = '#1A56DB';

export default function AdBanner() {
  const [banner,  setBanner]  = useState(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0.85)).current;  // scale anim for center modal
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const dismissed = useRef(new Set()).current;   // track dismissed banner IDs per session

  const fetchBanner = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/banners/active`);
      if (!res.ok) return;
      const { banner } = await res.json();
      if (!banner) return;
      // Don't re-show if already dismissed this session
      if (dismissed.has(banner.id)) return;
      setBanner(banner);
      setVisible(true);
    } catch { /* no network — silently skip */ }
  }, []);

  // Show on mount
  useEffect(() => {
    const timer = setTimeout(fetchBanner, 3000);  // 3s delay so screen renders first
    return () => clearTimeout(timer);
  }, []);

  // Re-check when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') fetchBanner();
    });
    return () => sub.remove();
  }, [fetchBanner]);

  // Animate in when visible changes
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(0.85);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = () => {
    if (banner) dismissed.add(banner.id);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0.85, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const handleTap = () => {
    if (banner?.link_url) {
      Linking.openURL(banner.link_url).catch(() => {});
    }
    dismiss();
  };

  if (!visible || !banner) return null;

  // Image source — prefer base64, fallback to URL
  const imgSource = banner.image_base64
    ? { uri: `data:image/jpeg;base64,${banner.image_base64}` }
    : banner.image_url
      ? { uri: banner.image_url }
      : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        {/* Tap backdrop to dismiss */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss}/>

        <Animated.View style={[s.sheet, { transform: [{ scale: slideAnim }] }]}>
          {/* Close button — always visible */}
          <TouchableOpacity onPress={dismiss} style={s.closeBtn} activeOpacity={0.85} hitSlop={{top:10,right:10,bottom:10,left:10}}>
            <View style={s.closeCircle}>
              <Text style={s.closeX}>✕</Text>
            </View>
          </TouchableOpacity>

          {/* Banner content */}
          <TouchableOpacity onPress={handleTap} activeOpacity={banner?.link_url ? 0.9 : 1} style={s.content}>
            {imgSource ? (
              <Image
                source={imgSource}
                style={s.bannerImage}
                resizeMode="cover"
              />
            ) : (
              /* Fallback if no image — show title card */
              <View style={[s.fallback, { backgroundColor: BLUE }]}>
                <Text style={s.fallbackEmoji}>📢</Text>
                <Text style={s.fallbackTitle}>{banner.title || 'Announcement'}</Text>
              </View>
            )}

            {/* Title overlay if present */}
            {!!banner.title && imgSource && (
              <View style={s.titleBar}>
                <Text style={s.titleText} numberOfLines={2}>{banner.title}</Text>
                {!!banner.link_url && (
                  <Text style={s.tapHint}>Tap to learn more →</Text>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Handle bar */}
          <View style={s.handle}/>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // 80% × 80% of the phone screen, centred. Sheet is a fixed-size flex
  // container — the image inside flexes to fill whatever space the
  // optional title bar / close button leaves behind.
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.65)', justifyContent:'center', alignItems:'center' },
  sheet:        { width: width * 0.8, height: height * 0.8, borderRadius:24, backgroundColor:'#fff', overflow:'hidden',
                  shadowColor:'#000', shadowOffset:{width:0,height:16}, shadowOpacity:.22, shadowRadius:32, elevation:20 },
  handle:       { display:'none' },  // not needed for center modal
  closeBtn:     { position:'absolute', top:12, right:12, zIndex:10 },
  closeCircle:  { width:34, height:34, borderRadius:17, backgroundColor:'rgba(0,0,0,0.40)', justifyContent:'center', alignItems:'center' },
  closeX:       { color:'#fff', fontSize:14, fontWeight:'800' },
  content:      { width:'100%', flex:1 },
  bannerImage:  { width:'100%', flex:1, backgroundColor:'#F0F2F5' },
  fallback:     { width:'100%', flex:1, justifyContent:'center', alignItems:'center' },
  fallbackEmoji:{ fontSize:52, marginBottom:12 },
  fallbackTitle:{ fontSize:22, fontWeight:'900', color:'#fff', textAlign:'center', paddingHorizontal:24 },
  titleBar:     { padding:16, paddingBottom:16, backgroundColor:'#fff' },
  titleText:    { fontSize:16, fontWeight:'800', color:'#0D0F12', marginBottom:4 },
  tapHint:      { fontSize:12, color:BLUE, fontWeight:'600' },
});