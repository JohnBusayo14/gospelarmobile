// screens/SplashScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Logo-only splash screen. Shows for 2 seconds then auto-navigates.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  View, Image, StyleSheet, StatusBar, Animated, Easing, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const BLUE_DARK = '#0D1B5E';
const LOGO_SIZE = 180;

export default function SplashScreen({ navigation }) {
  const logoScale  = useRef(new Animated.Value(0.5)).current;
  const logoOpac   = useRef(new Animated.Value(0)).current;
  const logoRot    = useRef(new Animated.Value(0)).current;
  const pulse      = useRef(new Animated.Value(0)).current;
  const glowOpac   = useRef(new Animated.Value(0)).current;
  const ringRot    = useRef(new Animated.Value(0)).current;
  const orb1       = useRef(new Animated.Value(0)).current;
  const orb2       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Every animation handle is captured so the cleanup can .stop() them
    // all when the screen unmounts (e.g. if the user taps fast enough to
    // exit Splash before the 2s timer fires, or auto-nav happens mid-loop).
    // Without this, RN's native animator throws "Cannot read property
    // 'stopTracking' of undefined" trying to finalise an Animated.Value
    // whose owner has been GC'd.
    const floatOrb = (anim, dur, delay) =>
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue:1, duration:dur, delay, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
        Animated.timing(anim, { toValue:0, duration:dur, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
      ]));

    const orb1Loop  = floatOrb(orb1, 3500, 0);
    const orb2Loop  = floatOrb(orb2, 4800, 700);
    const entrance  = Animated.parallel([
      Animated.spring(logoScale, { toValue:1, tension:60, friction:8, useNativeDriver:true }),
      Animated.timing(logoOpac,  { toValue:1, duration:550, easing:Easing.out(Easing.cubic), useNativeDriver:true }),
      Animated.timing(logoRot,   { toValue:1, duration:900, easing:Easing.out(Easing.cubic), useNativeDriver:true }),
      Animated.timing(glowOpac,  { toValue:1, duration:700, delay:200, useNativeDriver:true }),
    ]);
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue:1, duration:1100, delay:600, easing:Easing.inOut(Easing.quad), useNativeDriver:true }),
      Animated.timing(pulse, { toValue:0, duration:1100, easing:Easing.inOut(Easing.quad), useNativeDriver:true }),
    ]));
    const ringLoop = Animated.loop(
      Animated.timing(ringRot, { toValue:1, duration:6000, easing:Easing.linear, useNativeDriver:true })
    );

    const handles = [orb1Loop, orb2Loop, entrance, pulseLoop, ringLoop];
    handles.forEach((h) => h.start());

    // Auto-navigate after 2s.
    const timer = setTimeout(async () => {
      // Fade out — also held so we can stop it on unmount.
      const fadeOut = Animated.timing(logoOpac, { toValue:0, duration:280, useNativeDriver:true });
      fadeOut.start();
      handles.push(fadeOut);

      try {
        const email = await AsyncStorage.getItem('userEmail');
        // Signed-in users land on the Library launcher to pick which book to
        // open. The Sunday-School flow still lives at HomeScreen, one tap deeper.
        navigation.replace(email ? 'Library' : 'Login');
      } catch {
        navigation.replace('Login');
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      handles.forEach((h) => { try { h.stop(); } catch { /* already done */ } });
    };
  }, []);

  const orb1Y = orb1.interpolate({ inputRange:[0,1], outputRange:[0,-22] });
  const orb2Y = orb2.interpolate({ inputRange:[0,1], outputRange:[0,-16] });
  const spinIn = logoRot.interpolate({ inputRange:[0,1], outputRange:['-25deg','0deg'] });
  const ringSpin = ringRot.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] });
  const pulseScale = pulse.interpolate({ inputRange:[0,1], outputRange:[1, 1.06] });
  const pulseGlow = pulse.interpolate({ inputRange:[0,1], outputRange:[0.6, 1] });

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE_DARK} translucent/>

      {/* Background orbs */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[s.orb, s.orb1, { transform:[{translateY:orb1Y}] }]}/>
        <Animated.View style={[s.orb, s.orb2, { transform:[{translateY:orb2Y}] }]}/>
        <Animated.View style={s.orb3}/>
      </View>

      {/* Centred logo with rotating glow ring and gentle pulse. */}
      <Animated.View
        style={[
          s.logoWrap,
          { opacity:logoOpac, transform:[{ scale: Animated.multiply(logoScale, pulseScale) }, { rotate: spinIn }] },
        ]}
      >
        <Animated.View
          style={[s.glowRing, { opacity: Animated.multiply(glowOpac, pulseGlow), transform:[{ rotate: ringSpin }] }]}
        />
        <Image
          source={require('../assets/logo.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  safe:    { flex:1, backgroundColor:BLUE_DARK, justifyContent:'center', alignItems:'center' },
  orb:     { position:'absolute', borderRadius:999 },
  orb1:    { width:320, height:320, backgroundColor:'rgba(59,130,246,0.15)', top:-80, right:-80 },
  orb2:    { width:220, height:220, backgroundColor:'rgba(255,255,255,0.05)', bottom:80, left:-60 },
  orb3:    { position:'absolute', width:180, height:180, borderRadius:999, backgroundColor:'rgba(59,130,246,0.08)', top:height*0.38, right:-50 },
  logoWrap:{ alignItems:'center', justifyContent:'center' },
  glowRing:{ position:'absolute', width:220, height:220, borderRadius:110, borderWidth:2, borderColor:'rgba(59,130,246,0.35)', backgroundColor:'rgba(37,99,235,0.18)' },
  logo:    { width:LOGO_SIZE, height:LOGO_SIZE },
});