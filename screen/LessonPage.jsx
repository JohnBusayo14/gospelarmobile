// screens/LessonPage.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, ActivityIndicator,
  Platform, Modal, Easing,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import AppTabBar, { ICONS } from '../components/AppTabBar';
import { useTheme }       from '../context/ThemeContext';
import { useLanguage }    from '../context/LanguageContext';
import { fetchLessonById } from '../services/api';
import { silentReadingCheckIn } from '../services/reading';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { buildTheme }     from '../theme/colors';
import QuizModal          from '../components/QuizModal';
import BibleVerseLink, { RichVerseText } from '../components/BibleVerseLink';
import HymnModal          from '../components/HymnModal';
import { getTokens } from '../theme/tokens';
import { bookTones, AMBIENT_SHADOW as BOOK_SHADOW } from '../theme/bookSurfaces';
import { useScreenEntry } from '../hooks/useFluidAnim';

const { width, height } = Dimensions.get('window');

const BLUE       = '#1A56DB';
const BLUE_MID   = '#3B82F6';
const BLUE_LIGHT = '#EFF6FF';

// Blue-only accent palette
const ACCENTS = [BLUE, BLUE_MID, '#1D4ED8', '#2563EB', '#1E40AF', '#3B82F6'];

const READ_THEMES = {
  light: { bg:'#FFFFFF', surface:'#F8F9FA', text:'#1A1A2E', textSec:'#4A5568', border:'#E2E8F0', icon:'☀️' },
  sepia: { bg:'#FBF0E0', surface:'#F5E6CC', text:'#3D2B1F', textSec:'#6B4C3B', border:'#D4A574', icon:'📜' },
  dark:  { bg:'#0F1117', surface:'#1A1D27', text:'#F1F5F9', textSec:'#94A3B8', border:'#2A2D3A', icon:'🌙' },
};
const FONT_SIZES = [14, 16, 18, 20, 22];

// ─────────────────────────────────────────────────────────────────────────────
// READ MODE MODAL — preserved
// ─────────────────────────────────────────────────────────────────────────────
const ReadModeModal = ({ visible, parts, initialIndex=0, lessonTitle, accent, onClose, t = (k,f)=>f }) => {
  const [partIndex,    setPartIndex]    = useState(initialIndex);
  const [fontSizeIdx,  setFontSizeIdx]  = useState(1);
  const [readTheme,    setReadTheme]    = useState('light');
  const [showControls, setShowControls] = useState(true);
  const [scrollPct,    setScrollPct]    = useState(0);
  const slideAnim   = useRef(new Animated.Value(height)).current;
  const controlFade = useRef(new Animated.Value(1)).current;
  const scrollRef   = useRef(null);
  const ctrlTimer   = useRef(null);
  const rt = READ_THEMES[readTheme];
  const fs = FONT_SIZES[fontSizeIdx];
  const part = parts?.[partIndex];
  const total = parts?.length ?? 0;

  useEffect(() => { if (visible) { setPartIndex(initialIndex); setScrollPct(0); } }, [visible, initialIndex]);
  useEffect(() => {
    if (visible) Animated.spring(slideAnim, { toValue:0, tension:65, friction:12, useNativeDriver:true }).start();
    else Animated.timing(slideAnim, { toValue:height, duration:260, useNativeDriver:true }).start();
  }, [visible]);

  const showCtrl = () => {
    setShowControls(true);
    Animated.timing(controlFade, { toValue:1, duration:180, useNativeDriver:true }).start();
    clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => {
      Animated.timing(controlFade, { toValue:0, duration:400, useNativeDriver:true }).start();
      setShowControls(false);
    }, 3500);
  };
  useEffect(() => { if (visible) showCtrl(); return () => clearTimeout(ctrlTimer.current); }, [visible, partIndex]);

  const goTo = (i) => {
    if (i<0||i>=total) return;
    setPartIndex(i); setScrollPct(0);
    scrollRef.current?.scrollTo({ y:0, animated:false });
    showCtrl();
  };
  const cycleTheme = () => {
    const o=['light','sepia','dark'];
    setReadTheme(t=>o[(o.indexOf(t)+1)%o.length]);
    showCtrl();
  };
  const onScroll = (e) => {
    const { contentOffset:co, contentSize:cs, layoutMeasurement:lm } = e.nativeEvent;
    setScrollPct(Math.min(1, Math.max(0, cs.height<=lm.height ? 1 : co.y/(cs.height-lm.height))));
  };

  if (!visible||!part) return null;
  const isDarkT = readTheme==='dark';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[rm.container, { backgroundColor:rt.bg, transform:[{translateY:slideAnim}] }]}>
        <StatusBar barStyle={isDarkT?'light-content':'dark-content'} backgroundColor={rt.bg}/>
        <View style={[rm.progressTrack, { backgroundColor:rt.border }]}>
          <View style={[rm.progressFill, { backgroundColor:accent, width:`${Math.round(scrollPct*100)}%` }]}/>
        </View>
        <Animated.View pointerEvents={showControls?'auto':'none'}
          style={[rm.topBar, { backgroundColor:rt.bg, opacity:controlFade }]}>
          <TouchableOpacity onPress={onClose} style={[rm.iconBtn,{backgroundColor:rt.surface}]} activeOpacity={0.7}>
            <Text style={{ fontSize:14, fontWeight:'700', color:rt.text }}>✕</Text>
          </TouchableOpacity>
          <View style={rm.topCenter}>
            <Text style={[rm.topTitle,{color:rt.text}]} numberOfLines={1}>{lessonTitle}</Text>
            <Text style={[rm.topSub,{color:rt.textSec}]}>{(t || ((k,f)=>f))('lesson_part_of_total', 'Part {n} of {total}').replace('{n}', String(partIndex+1)).replace('{total}', String(total))}</Text>
          </View>
          <TouchableOpacity onPress={cycleTheme} style={[rm.iconBtn,{backgroundColor:rt.surface}]} activeOpacity={0.7}>
            <Text style={{fontSize:16}}>{rt.icon}</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View pointerEvents={showControls?'auto':'none'} style={{opacity:controlFade}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rm.tabsRow}>
            {parts.map((p,i)=>{
              const active=i===partIndex;
              return (
                <TouchableOpacity key={i} onPress={()=>goTo(i)} activeOpacity={0.75}
                  style={[rm.tab,{backgroundColor:active?accent:rt.surface,borderColor:active?accent:rt.border}]}>
                  <Text style={[rm.tabText,{color:active?'#fff':rt.textSec}]}>{String(i+1).padStart(2,'0')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
        <View style={{flex:1}}>
          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} onScroll={onScroll}
            scrollEventThrottle={16} contentContainerStyle={[rm.body,{paddingBottom:140}]}
            onTouchStart={showCtrl}>
            <View style={rm.partHeader}>
              <View style={[rm.partNumBadge,{backgroundColor:accent+'18',borderColor:accent+'35'}]}>
                <Text style={[rm.partNum,{color:accent}]}>{String(partIndex+1).padStart(2,'0')}</Text>
              </View>
              <Text style={[rm.partTitle,{color:rt.text,fontSize:fs+4}]}>{part.part_topic}</Text>
            </View>
            <View style={[rm.accentRule,{backgroundColor:accent}]}/>
            {!!part.part_para1&&(
              <View style={[rm.paraBlock,{borderLeftColor:accent}]}>
                <RichVerseText text={part.part_para1} isDark={isDarkT}
                  style={[rm.paraText,{color:rt.text,fontSize:fs,lineHeight:fs*1.75}]} lineHeight={fs*1.75}/>
              </View>
            )}
            {!!part.part_para1&&!!part.part_para2&&<View style={[rm.paraDivider,{backgroundColor:rt.border}]}/>}
            {!!part.part_para2&&(
              <View style={[rm.paraBlock,{borderLeftColor:accent+'60'}]}>
                <RichVerseText text={part.part_para2} isDark={isDarkT}
                  style={[rm.paraText,{color:rt.text,fontSize:fs,lineHeight:fs*1.75}]} lineHeight={fs*1.75}/>
              </View>
            )}
          </ScrollView>
        </View>
        <Animated.View pointerEvents={showControls?'auto':'none'}
          style={[rm.bottomBar,{backgroundColor:rt.bg,opacity:controlFade}]}>
          <View style={rm.fontRow}>
            <TouchableOpacity onPress={()=>{setFontSizeIdx(i=>Math.max(0,i-1));showCtrl();}}
              style={[rm.fontBtn,{backgroundColor:rt.surface,borderColor:rt.border}]} activeOpacity={0.75}>
              <Text style={[rm.fontBtnText,{color:rt.textSec,fontSize:13}]}>A−</Text>
            </TouchableOpacity>
            <View style={rm.fontDots}>
              {FONT_SIZES.map((_,i)=>(
                <View key={i} style={[rm.dot,{backgroundColor:i===fontSizeIdx?accent:rt.border}]}/>
              ))}
            </View>
            <TouchableOpacity onPress={()=>{setFontSizeIdx(i=>Math.min(FONT_SIZES.length-1,i+1));showCtrl();}}
              style={[rm.fontBtn,{backgroundColor:rt.surface,borderColor:rt.border}]} activeOpacity={0.75}>
              <Text style={[rm.fontBtnText,{color:rt.textSec,fontSize:17}]}>A+</Text>
            </TouchableOpacity>
          </View>
          <View style={rm.navRow}>
            <TouchableOpacity onPress={()=>goTo(partIndex-1)} disabled={partIndex===0}
              style={[rm.navBtn,{backgroundColor:partIndex===0?rt.border:accent}]} activeOpacity={0.8}>
              <Text style={[rm.navBtnText,{color:partIndex===0?rt.textSec:'#fff'}]}>{t('lesson_prev', '‹ Prev')}</Text>
            </TouchableOpacity>
            <View style={[rm.partPillCenter,{backgroundColor:rt.surface,borderColor:rt.border}]}>
              <Text style={[rm.partPillText,{color:accent}]}>{partIndex+1} / {total}</Text>
            </View>
            <TouchableOpacity onPress={()=>goTo(partIndex+1)} disabled={partIndex===total-1}
              style={[rm.navBtn,{backgroundColor:partIndex===total-1?rt.border:accent}]} activeOpacity={0.8}>
              <Text style={[rm.navBtnText,{color:partIndex===total-1?rt.textSec:'#fff'}]}>{t('lesson_next', 'Next ›')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const rm = StyleSheet.create({
  container:     { flex:1 },
  progressTrack: { height:3 },
  progressFill:  { height:3, borderRadius:2 },
  topBar:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:Platform.OS==='ios'?50:36, paddingBottom:12 },
  iconBtn:       { width:38, height:38, borderRadius:12, justifyContent:'center', alignItems:'center' },
  topCenter:     { flex:1, alignItems:'center', paddingHorizontal:10 },
  topTitle:      { fontSize:14, fontWeight:'800', letterSpacing:-0.2 },
  topSub:        { fontSize:10, fontWeight:'600', letterSpacing:0.5, marginTop:1 },
  tabsRow:       { paddingHorizontal:16, paddingVertical:10, gap:8, flexDirection:'row' },
  tab:           { borderRadius:20, borderWidth:1.5, paddingHorizontal:14, paddingVertical:6 },
  tabText:       { fontSize:12, fontWeight:'800', letterSpacing:0.3 },
  body:          { paddingHorizontal:24, paddingTop:8 },
  partHeader:    { marginBottom:16 },
  partNumBadge:  { alignSelf:'flex-start', borderRadius:10, borderWidth:1.5, paddingHorizontal:12, paddingVertical:5, marginBottom:10 },
  partNum:       { fontSize:12, fontWeight:'900', letterSpacing:-0.2 },
  partTitle:     { fontWeight:'900', lineHeight:32, letterSpacing:-0.5 },
  accentRule:    { height:3, width:40, borderRadius:2, marginBottom:18 },
  paraBlock:     { borderLeftWidth:3, paddingLeft:16, marginBottom:20, paddingVertical:4 },
  paraText:      { fontWeight:'400' },
  paraDivider:   { height:1, marginVertical:18 },
  bottomBar:     { position:'absolute', bottom:0, left:0, right:0, paddingHorizontal:20, paddingBottom:Platform.OS==='ios'?28:16, paddingTop:12 },
  fontRow:       { flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:12 },
  fontBtn:       { width:48, height:36, borderRadius:10, borderWidth:1, justifyContent:'center', alignItems:'center' },
  fontBtnText:   { fontWeight:'800' },
  fontDots:      { flexDirection:'row', alignItems:'center', gap:6, marginHorizontal:14 },
  dot:           { width:7, height:7, borderRadius:3.5 },
  navRow:        { flexDirection:'row', alignItems:'center', gap:10 },
  navBtn:        { flex:1, borderRadius:14, paddingVertical:13, alignItems:'center' },
  navBtnText:    { fontSize:14, fontWeight:'800' },
  partPillCenter:{ paddingHorizontal:16, paddingVertical:10, borderRadius:14, borderWidth:1, alignItems:'center' },
  partPillText:  { fontSize:13, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CENTER MODAL — modern overlay for verse / hymns / background
// ─────────────────────────────────────────────────────────────────────────────
const ContentModal = ({ visible, onClose, title, icon, tk, isDark, children, t }) => {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue:1, tension:80, friction:10, useNativeDriver:true }),
        Animated.timing(fadeAnim,  { toValue:1, duration:220, useNativeDriver:true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue:0.88, duration:180, useNativeDriver:true }),
        Animated.timing(fadeAnim,  { toValue:0,    duration:180, useNativeDriver:true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[cm.overlay, { opacity:fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}/>
        <Animated.View style={[cm.card, { backgroundColor:tk.glassFill, transform:[{scale:scaleAnim}] }]}>
          {/* Header */}
          <View style={[cm.header, { borderBottomColor:tk.glassEdge }]}>
            <View style={[cm.iconBox, { backgroundColor:BLUE_LIGHT }]}>
              <Text style={{ fontSize:26 }}>{icon}</Text>
            </View>
            <Text style={[cm.title, { color:tk.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[cm.closeBtn, { backgroundColor:tk.surfaceEl }]} activeOpacity={0.75}>
              <Text style={[cm.closeX, { color:tk.textPrimary }]}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* Body */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={cm.body}>
            {children}
          </ScrollView>
          {/* Close button */}
          <View style={cm.footer}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={[cm.doneBtn, { backgroundColor:BLUE }]}>
              <Text style={cm.doneTxt}>{t ? t('btn_done', 'Done') : 'Done'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};
const cm = StyleSheet.create({
  overlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center', paddingHorizontal:20 },
  card:     { width:'100%', maxWidth:440, borderRadius:24, maxHeight:height*0.80, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:16}, shadowOpacity:.20, shadowRadius:32, elevation:20 },
  header:   { flexDirection:'row', alignItems:'center', gap:12, padding:18, borderBottomWidth:1 },
  iconBox:  { width:44, height:44, borderRadius:13, justifyContent:'center', alignItems:'center', flexShrink:0 },
  title:    { flex:1, fontSize:17, fontWeight:'900' },
  closeBtn: { width:34, height:34, borderRadius:17, justifyContent:'center', alignItems:'center', flexShrink:0 },
  closeX:   { fontSize:14, fontWeight:'700' },
  body:     { padding:20 },
  footer:   { padding:16 },
  doneBtn:  { borderRadius:14, paddingVertical:13, alignItems:'center' },
  doneTxt:  { color:'#fff', fontSize:15, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ title, icon, tk }) => (
  <View style={sh.row}>
    {icon && <Text style={{ fontSize:20, marginRight:8 }}>{icon}</Text>}
    <Text style={[sh.title, { color:tk.textPrimary }]}>{title}</Text>
  </View>
);
const sh = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', marginBottom:12 },
  title: { fontSize:18, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// LESSON HERO CARD — no top stripe border, left accent bar only
// ─────────────────────────────────────────────────────────────────────────────
const LessonHeroCard = ({
  lesson, content, tk, isDark, onQuiz, quizDone,
  // Quiz-button gate state. When `gated` is true, the user hasn't read for
  // the minimum dwell time yet — show a disabled button with the remaining
  // time so they know why and how long is left.
  gated = false, remainingLabel = '',
  t = (k,f)=>f,
}) => (
  <View style={[hc.card, { backgroundColor:tk.glassFill, borderColor:tk.glassEdge }]}>
        <View style={hc.body}>
          <View style={hc.topRow}>
            <View style={[hc.numBadge, { backgroundColor:BLUE }]}>
              <Text style={hc.numTxt}>{t('lesson_label_caps', 'LESSON')}</Text>
              <Text style={hc.numBig}>{String(content.lesson_number||1).padStart(2,'0')}</Text>
            </View>
            {!!content.lesson_date && (
              <View style={[hc.datePill, { backgroundColor:BLUE_LIGHT }]}>
                <Text style={{ fontSize:13 }}>🗓</Text>
                <Text style={[hc.dateText, { color:BLUE }]}>{content.lesson_date}</Text>
              </View>
            )}
          </View>
          <Text style={[hc.title, { color:tk.textPrimary }]}>{lesson?.title}</Text>
          {!!content.topic && <Text style={[hc.topic, { color:tk.textSec }]} numberOfLines={3}>{content.topic}</Text>}
          <View style={[hc.divider, { backgroundColor:tk.glassEdge }]}/>
          <View style={hc.bottomRow}>
            {!!content.memoryVerse_bible_passage && (
              <View style={[hc.passagePill, { backgroundColor:BLUE_LIGHT }]}>
                <Text style={{ fontSize:13 }}>📜</Text>
                <RichVerseText text={content.memoryVerse_bible_passage} isDark={isDark} lineHeight={18}
                  style={[hc.passageTxt, { color:BLUE }]} />
              </View>
            )}
            {quizDone ? (
              <View style={[hc.quizBtn, { backgroundColor:'#10B981' }]}>
                <Text style={{ fontSize:14 }}>✅</Text>
                <Text style={hc.quizBtnTxt}>{t('btn_done', 'Done')}</Text>
              </View>
            ) : gated ? (
              // Pre-gate: visually muted, non-tappable, shows mm:ss remaining
              // so the user understands they need to keep reading.
              <View style={[hc.quizBtn, { backgroundColor: tk.surfaceEl }]}>
                <Text style={{ fontSize:14 }}>⏳</Text>
                <Text style={[hc.quizBtnTxt, { color: tk.textMuted }]}>{remainingLabel}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={onQuiz} activeOpacity={0.85}
                style={[hc.quizBtn, { backgroundColor:BLUE }]}>
                <Text style={{ fontSize:14 }}>⚡</Text>
                <Text style={hc.quizBtnTxt}>{t('lesson_quiz_short', 'Quiz')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
  </View>
);
const hc = StyleSheet.create({
  card:       { borderRadius:18, borderWidth:1, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:.06, shadowRadius:12, elevation:3 },
  body:       { padding:18 },
  topRow:     { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 },
  numBadge:   { borderRadius:12, paddingHorizontal:14, paddingVertical:10, alignItems:'center' },
  numTxt:     { color:'rgba(255,255,255,.75)', fontSize:8, fontWeight:'900', letterSpacing:2 },
  numBig:     { color:'#fff', fontSize:22, fontWeight:'900', letterSpacing:-1, marginTop:2 },
  datePill:   { flexDirection:'row', alignItems:'center', gap:6, borderRadius:12, paddingHorizontal:12, paddingVertical:8 },
  dateText:   { fontSize:12, fontWeight:'700' },
  title:      { fontSize:20, fontWeight:'900', lineHeight:28, marginBottom:8 },
  topic:      { fontSize:13, lineHeight:20, marginBottom:14 },
  divider:    { height:1, marginBottom:14 },
  bottomRow:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  passagePill:{ flexDirection:'row', alignItems:'center', gap:6, borderRadius:10, paddingHorizontal:12, paddingVertical:8 },
  passageTxt: { fontSize:12, fontWeight:'700' },
  quizBtn:    { flexDirection:'row', alignItems:'center', gap:6, borderRadius:20, paddingHorizontal:18, paddingVertical:10 },
  quizBtnTxt: { color:'#fff', fontSize:13, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW CARD — Bamboo-style square card for horizontal scroll
// Inspired by Bamboo app: colored square icon, title, preview, and a circular
// accent action button that uses the bottom-nav SVG icon language instead of
// a "View →" text label — keeps the card scannable + visually consistent
// with the rest of the app.
// ─────────────────────────────────────────────────────────────────────────────
// Tightened from 178 → 156 so four cards fit cleanly within a horizontal
// scroll on most phone widths without sacrificing legibility.
const CARD_W = 156;

// `Icon` is the thin-stroke SVG component from the bottom-nav ICONS registry
// (passed in by the call site). Falls back to the legacy emoji `icon` string
// for any caller that hasn't migrated, so the swap is non-breaking.
const OverviewCard = ({ Icon, icon, title, preview, onPress, tk, t = (_,f)=>f, accent = BLUE }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.82}
    style={[oc.card, { backgroundColor:tk.glassFill, borderColor:tk.glassEdge }]}>
    <View style={[oc.iconBox, { backgroundColor: accent + '18' }]}>
      {Icon
        ? <Icon color={accent} size={24} sw={2} />
        : <Text style={{ fontSize:24 }}>{icon}</Text>}
    </View>
    <Text style={[oc.title, { color:tk.textPrimary }]} numberOfLines={2}>{title}</Text>
    {!!preview && (
      <Text style={[oc.preview, { color:tk.textMuted }]} numberOfLines={2}>{preview}</Text>
    )}
    {/* Circular accent action — replaces the old "View →" text button. The
        ArrowLeft glyph is rotated 180° to face right, keeping a single icon
        definition in the shared ICONS registry. */}
    <View style={oc.actionRow}>
      <View
        style={[oc.actionBtn, { backgroundColor: accent }]}
        accessibilityLabel={t('lesson_open', 'Open')}
      >
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <ICONS.ArrowLeft color="#fff" size={16} sw={2.4} />
        </View>
      </View>
    </View>
  </TouchableOpacity>
);
const oc = StyleSheet.create({
  card:      { width:CARD_W, borderRadius:18, borderWidth:1, padding:14, marginRight:10,
               shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:.06, shadowRadius:10, elevation:3,
               justifyContent:'space-between' },
  iconBox:   { width:46, height:46, borderRadius:13, justifyContent:'center', alignItems:'center', marginBottom:10 },
  title:     { fontSize:13, fontWeight:'900', marginBottom:4, lineHeight:17 },
  preview:   { fontSize:11, lineHeight:15, marginBottom:10, flexGrow:1 },
  actionRow: { flexDirection:'row', justifyContent:'flex-end' },
  actionBtn: { width:32, height:32, borderRadius:16, justifyContent:'center', alignItems:'center',
               shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.18, shadowRadius:5, elevation:3 },
});


// ─────────────────────────────────────────────────────────────────────────────
// PART CARD — accordion with full dark-mode support, no top stripe
// ─────────────────────────────────────────────────────────────────────────────
const PartCard = ({ part, index, allParts, lessonTitle, tk, isDark, t = (k,f)=>f }) => {
  const accent   = ACCENTS[index % ACCENTS.length];
  const [open,     setOpen]     = useState(index === 0);
  const [readMode, setReadMode] = useState(false);
  const rotAnim = useRef(new Animated.Value(index===0?1:0)).current;
  const spin    = rotAnim.interpolate({ inputRange:[0,1], outputRange:['0deg','180deg'] });

  const toggle = () => {
    Animated.timing(rotAnim, { toValue:open?0:1, duration:220, useNativeDriver:true }).start();
    setOpen(v=>!v);
  };

  return (
    <>
      <ReadModeModal visible={readMode} parts={allParts} initialIndex={index}
        lessonTitle={lessonTitle} accent={accent} onClose={() => setReadMode(false)} t={t}/>
      <View style={[pt.card, { backgroundColor:tk.glassFill, borderColor:tk.glassEdge }]}>
            <TouchableOpacity onPress={toggle} activeOpacity={0.75} style={pt.header}>
              <View style={[pt.numCircle, { backgroundColor:accent }]}>
                <Text style={pt.numCircleTxt}>{String(index+1).padStart(2,'0')}</Text>
              </View>
              <View style={{ flex:1, marginRight:10 }}>
                <Text style={[pt.partNum, { color:accent }]}>{t('lesson_part_num', 'PART {n}').replace('{n}', String(index+1).padStart(2,'0'))}</Text>
                <Text style={[pt.title, { color:tk.textPrimary }]} numberOfLines={open?undefined:2}>
                  {part.part_topic}
                </Text>
              </View>
              <Animated.View style={[pt.chevronBox, { backgroundColor:accent+'18', transform:[{rotate:spin}] }]}>
                <Text style={[pt.chevron, { color:accent }]}>⌄</Text>
              </Animated.View>
            </TouchableOpacity>
            {open && (
              <View style={[pt.body, { borderTopColor:tk.glassEdge }]}>
                {!!part.part_para1 && (
                  <View style={[pt.paraWrap, { borderLeftColor:accent }]}>
                    <RichVerseText text={part.part_para1} isDark={isDark}
                      style={[pt.para, { color:tk.textSec }]} lineHeight={23}/>
                  </View>
                )}
                {!!part.part_para2 && (
                  <View style={[pt.paraWrap, { borderLeftColor:accent+'60' }]}>
                    <RichVerseText text={part.part_para2} isDark={isDark}
                      style={[pt.para, { color:tk.textSec }]} lineHeight={23}/>
                  </View>
                )}
                <TouchableOpacity onPress={() => setReadMode(true)} activeOpacity={0.85}
                  style={[pt.readBtn, { backgroundColor:accent }]}>
                  <Text style={{ fontSize:18 }}>📖</Text>
                  <Text style={pt.readBtnText}>{t('lesson_read_fullscreen', 'Read Full Screen')}</Text>
                </TouchableOpacity>
              </View>
            )}
      </View>
    </>
  );
};
const pt = StyleSheet.create({
  card:       { borderRadius:18, borderWidth:1, overflow:'hidden', marginBottom:10, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },
  header:     { flexDirection:'row', alignItems:'center', gap:12, padding:16 },
  numCircle:  { width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center', flexShrink:0 },
  numCircleTxt:{ color:'#fff', fontSize:15, fontWeight:'900', letterSpacing:-0.5 },
  partNum:    { fontSize:9, fontWeight:'900', letterSpacing:1.5, marginBottom:4 },
  title:      { fontSize:14.5, fontWeight:'800', lineHeight:21 },
  chevronBox: { width:34, height:34, borderRadius:10, justifyContent:'center', alignItems:'center', flexShrink:0 },
  chevron:    { fontSize:18, fontWeight:'700' },
  body:       { borderTopWidth:1, paddingHorizontal:16, paddingBottom:16, paddingTop:14 },
  paraWrap:   { borderLeftWidth:3, paddingLeft:12, marginBottom:14, paddingVertical:4 },
  para:       { fontSize:14, lineHeight:23 },
  readBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderRadius:12, paddingVertical:12, marginTop:4 },
  readBtnText:{ color:'#fff', fontSize:14, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION CARD
// ─────────────────────────────────────────────────────────────────────────────
const QuestionCard = ({ question, index, tk }) => (
  <View style={[qc.card, { backgroundColor:tk.glassFill, borderColor:tk.glassEdge }]}>
    <View style={[qc.numBox, { backgroundColor:BLUE_LIGHT }]}>
      <Text style={{ fontSize:18 }}>💬</Text>
      <Text style={[qc.num, { color:BLUE }]}>{index+1}</Text>
    </View>
    <Text style={[qc.text, { color:tk.textPrimary }]}>
      {typeof question==='string' ? question : question?.text || ''}
    </Text>
  </View>
);
const qc = StyleSheet.create({
  card:     { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1, overflow:'hidden', marginBottom:10, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:.04, shadowRadius:6, elevation:1 },
  numBox:   { width:56, paddingVertical:16, alignItems:'center', flexShrink:0 },
  num:      { fontSize:11, fontWeight:'900', marginTop:2 },
  text:     { flex:1, fontSize:14, lineHeight:22, fontWeight:'500', paddingVertical:16, paddingRight:14 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function LessonPage({ route, navigation }) {
  const { items, category } = route.params;
  const { isDark }  = useTheme();
  const { t, lang } = useLanguage();
  const tk = useMemo(() => ({ ...getTokens(isDark), ...bookTones(isDark) }), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [lesson,        setLesson]        = useState(items);
  const [loading,       setLoading]       = useState(true);
  const [quizVisible,   setQuizVisible]   = useState(false);
  const [quizDone,      setQuizDone]      = useState(false);  // true if quiz already taken for this lesson
  const [hymnVisible,   setHymnVisible]   = useState(false);
  const [activeTab,     setActiveTab]     = useState(1);  // Units tab active on LessonPage
  const [questionsOpen, setQuestionsOpen] = useState(false);

  // Content modals
  const [verseModal,      setVerseModal]      = useState(false);
  const [hymnsModal,      setHymnsModal]      = useState(false);
  const [backgroundModal, setBackgroundModal] = useState(false);
  const [conclusionModal, setConclusionModal] = useState(false);

  // Check if quiz already completed for this lesson
  useEffect(() => {
    if (!lesson?.id) return;
    AsyncStorage.getItem('completedLessons')
      .then(raw => {
        const list = raw ? JSON.parse(raw) : [];
        if (list.includes(lesson.id)) setQuizDone(true);
      })
      .catch(() => {});
  }, [lesson?.id]);

  // Fetch lesson content — runs on mount AND every time the screen is focused
  const fetchLesson = useCallback(async () => {
    if (!items?.id) return;
    setLoading(true);
    try {
      const row = await fetchLessonById(items.id, lang);
      if (row) setLesson(row);
    } catch {}
    finally { setLoading(false); }
  }, [items?.id, lang]);

  // Initial load
  useEffect(() => { fetchLesson(); }, [fetchLesson]);

  // Auto-refresh whenever the screen comes back into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchLesson);
    return unsubscribe;
  }, [navigation, fetchLesson]);

  // ── Auto reading check-in + completion gate ─────────────────────────────
  // Start a timer on mount; pause on background / foreground transitions.
  // On unmount, if the user spent ≥ 120 s actively on the page, fire a
  // silent check-in. Server is idempotent for same-day re-fires, so the
  // user can come back and the streak does not double-count.
  //
  // The same timer also gates the Quiz button — users must dwell on the
  // lesson for the minimum dwell time before they can take the quiz (and
  // therefore before the lesson is marked complete). Stops drive-by taps
  // from inflating completion counts / streaks.
  const MIN_READ_SECONDS = 120;   // 2 minutes
  const readingTimer = useReadingTimer({
    enabled:    !quizDone,
    minSeconds: MIN_READ_SECONDS,
  });
  useEffect(() => {
    return () => {
      const elapsed = readingTimer.getElapsedSeconds();
      if (elapsed < MIN_READ_SECONDS) return;
      AsyncStorage.getItem('userEmail').then((email) => {
        if (!email) return;
        silentReadingCheckIn(email, {
          source_type:      'lesson',
          lesson_id:        items?.id ?? null,
          duration_seconds: elapsed,
        });
      }).catch(() => {});
    };
  }, []); // intentionally empty — fires only on unmount

  // mm:ss helper for the gate label.
  const fmtMMSS = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Track recently visited
  useEffect(() => {
    if (!items?.id) return;
    AsyncStorage.getItem('gofamint_recent_lessons').then(raw => {
      const list = raw ? JSON.parse(raw) : [];
      const record = {
        id: items.id, title: items.title || '',
        lessonNumber: items?.content?.lesson_number ?? 1,
        lessonDate:   items?.content?.lesson_date ?? '',
        categoryId:   category?.id || 'adult',
        visitedAt:    new Date().toISOString(),
      };
      const updated = [record, ...list.filter(r => r.id !== items.id)].slice(0, 5);
      AsyncStorage.setItem('gofamint_recent_lessons', JSON.stringify(updated));
    }).catch(() => {});
  }, [items?.id]);

  const c         = lesson?.content ?? {};
  const lessonNum = c.lesson_number ?? 1;
  const accent    = BLUE;

  // 4-tab: 0=Home 1=Lessons 2=Notes 3=Stats
  // Settings tab removed — it lives on the Library home only.
  const handleTab = (i) => {
    setActiveTab(i);
    if (i===0) navigation.navigate('HomeScreen');
    if (i===1) navigation.navigate('SecondPage', { category:{ id:'adult', route:'SecondPage' } });
    if (i===2) navigation.navigate('Notes');
    if (i===3) navigation.navigate('Progress');
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor:tk.pageBg }]} edges={['top']}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={tk.pageBg}/>

      <QuizModal visible={quizVisible} onClose={()=>setQuizVisible(false)}
        lessonId={lesson?.id} lessonTitle={lesson?.title} T={buildTheme(isDark)}
        categoryId={category?.id || 'adult'} lang={lang}
        onComplete={async () => {
          setQuizDone(true);
          // Persist completion so it survives app restarts
          try {
            const raw = await AsyncStorage.getItem('completedLessons');
            const list = raw ? JSON.parse(raw) : [];
            if (!list.includes(lesson.id)) {
              await AsyncStorage.setItem('completedLessons', JSON.stringify([...list, lesson.id]));
            }
          } catch {}
        }}
      />
      {/* HymnModal expects hymnRef + isDark — the previous prop names
          (hymnsString / T) silently became undefined, so parseHymnRef
          returned [] and nothing ever rendered. */}
      <HymnModal visible={hymnVisible} onClose={()=>setHymnVisible(false)}
        hymnRef={c.suggested_hymns} isDark={isDark}/>

      {/* ── CONTENT MODALS (center overlay) ── */}
      <ContentModal visible={verseModal} onClose={()=>setVerseModal(false)}
        title={t('lesson_memory_verse', 'Memory Verse')} icon="📜" tk={tk} isDark={isDark} t={t}>
        <Text style={[s.modalVerse, { color:tk.textPrimary }]}>"{c.memory_verse}"</Text>
        {!!c.memoryVerse_bible_passage && (
          <View style={[s.modalPassage, { backgroundColor:BLUE_LIGHT, borderColor:BLUE+'30' }]}>
            <Text style={{ fontSize:18 }}>📖</Text>
            <View style={{ flex: 1 }}>
              <RichVerseText text={c.memoryVerse_bible_passage} isDark={isDark} lineHeight={20}
                style={[s.modalPassageTxt, { color:BLUE }]} />
            </View>
          </View>
        )}
      </ContentModal>

      <ContentModal visible={hymnsModal} onClose={()=>setHymnsModal(false)}
        title={t('lesson_suggested_hymns', 'Suggested Hymns')} icon="🎵" tk={tk} isDark={isDark} t={t}>
        <Text style={[s.modalBodyTxt, { color:tk.textSec }]}>{c.suggested_hymns}</Text>
        <TouchableOpacity onPress={() => { setHymnsModal(false); setHymnVisible(true); }}
          activeOpacity={0.85} style={[s.modalActionBtn, { backgroundColor:BLUE }]}>
          <Text style={{ fontSize:18 }}>🎵</Text>
          <Text style={s.modalActionTxt}>{t('lesson_view_full_hymn', 'View Full Hymn')}</Text>
        </TouchableOpacity>
      </ContentModal>

      <ContentModal visible={backgroundModal} onClose={()=>setBackgroundModal(false)}
        title={t('lesson_background', 'Lesson Background')} icon="🏛" tk={tk} isDark={isDark} t={t}>
        <RichVerseText text={c.lesson_background||''} isDark={isDark}
          style={[s.modalBodyTxt, { color:tk.textSec }]} lineHeight={24}/>
      </ContentModal>

      <ContentModal visible={conclusionModal} onClose={()=>setConclusionModal(false)}
        title={t('lesson_conclusion', 'Lesson Conclusion')} icon="🎯" tk={tk} isDark={isDark} t={t}>
        <RichVerseText text={c.lesson_conclusion||''} isDark={isDark}
          style={[s.modalBodyTxt, { color:tk.textSec }]} lineHeight={24}/>
      </ContentModal>

      {/* ── TOP BAR ── */}
      <View style={[s.topbar, { backgroundColor:tk.pageBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}
          style={[s.iconBtn, { backgroundColor:tk.surfaceEl }]}>
          <Text style={{ fontSize:20, color:tk.textPrimary }}>←</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={[s.pageTitle, { color:tk.textPrimary }]}>
            {t('lesson_label', 'Lesson')} {String(lessonNum).padStart(2,'00')}
          </Text>
          {!!c.lesson_date && <Text style={[s.pageSub, { color:tk.textMuted }]}>{c.lesson_date}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notes', {
            prefillLesson: lesson?.title || `Lesson ${String(lessonNum).padStart(2,'0')}`,
            prefillNumber: lessonNum,
          })}
          activeOpacity={0.75} style={[s.iconBtn, { backgroundColor:BLUE_LIGHT }]}>
          <Text style={{ fontSize:20 }}>📝</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <Text style={{ fontSize:44, marginBottom:16 }}>📖</Text>
          <ActivityIndicator color={BLUE} size="large"/>
          <Text style={[s.loadingTxt, { color:tk.textMuted }]}>{t('lesson_loading', 'Loading lesson…')}</Text>
        </View>
      ) : (
        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:110 }}
          style={{ opacity: fade, transform: [{ translateY }] }}>

          {/* HERO */}
          <View style={s.section}>
            <LessonHeroCard
              lesson={lesson} content={c} tk={tk} isDark={isDark}
              onQuiz={() => !quizDone && readingTimer.ready && setQuizVisible(true)}
              quizDone={quizDone}
              // Quiz only unlocks after the 2-min dwell gate has elapsed.
              gated={!quizDone && !readingTimer.ready}
              remainingLabel={`${fmtMMSS(readingTimer.remaining)} ${t('lesson_to_quiz', 'to quiz')}`}
              t={t}
            />
          </View>

          {/* LESSON OVERVIEW — horizontal scroll of Bamboo-style cards */}
          {(!!c.memory_verse || !!c.suggested_hymns || !!c.lesson_background || !!c.lesson_conclusion) && (
            <View style={s.overviewSection}>
              <SectionHeader title={t('lesson_overview', 'Lesson Overview')} icon="ℹ️" tk={tk}/>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.overviewScroll}>
                {!!c.memory_verse && (
                  <OverviewCard Icon={ICONS.Quote} title={t('lesson_memory_verse', 'Memory Verse')}
                    preview={`"${c.memory_verse.slice(0,60)}${c.memory_verse.length>60?'…':'"'}`}
                    accent="#1A56DB"
                    onPress={()=>setVerseModal(true)} tk={tk} t={t}/>
                )}
                {!!c.suggested_hymns && (
                  <OverviewCard Icon={ICONS.Music} title={t('lesson_suggested_hymns', 'Suggested Hymns')}
                    preview={c.suggested_hymns}
                    accent="#7C3AED"
                    onPress={()=>setHymnsModal(true)} tk={tk} t={t}/>
                )}
                {!!c.lesson_background && (
                  <OverviewCard Icon={ICONS.Landmark} title={t('lesson_background_short', 'Background')}
                    preview={c.lesson_background.slice(0,70)+'…'}
                    accent="#10B981"
                    onPress={()=>setBackgroundModal(true)} tk={tk} t={t}/>
                )}
                {!!c.lesson_conclusion && (
                  <OverviewCard Icon={ICONS.Target} title={t('lesson_conclusion_short', 'Conclusion')}
                    preview={c.lesson_conclusion.slice(0,70)+'…'}
                    accent="#F97316"
                    onPress={()=>setConclusionModal(true)} tk={tk} t={t}/>
                )}
              </ScrollView>
            </View>
          )}

          {/* LESSON PARTS — full dark mode */}
          {Array.isArray(c.lesson_part) && c.lesson_part.length>0 && (
            <View style={s.section}>
              <SectionHeader title={t('lesson_notes_on_lesson', 'Notes on the Lesson')} icon="📝" tk={tk}/>
              {c.lesson_part.map((part, i) => (
                <PartCard key={i} part={part} index={i} allParts={c.lesson_part}
                  lessonTitle={lesson?.title} tk={tk} isDark={isDark} t={t}/>
              ))}
            </View>
          )}

          {/* DISCUSSION QUESTIONS (collapsible) */}
          {Array.isArray(c.questions) && c.questions.length>0 && (
            <View style={s.section}>
              <TouchableOpacity onPress={()=>setQuestionsOpen(v=>!v)} activeOpacity={0.75}
                style={[s.collapseHeader, { backgroundColor:tk.glassFill, borderColor:tk.glassEdge }]}>
                <Text style={{ fontSize:22 }}>💬</Text>
                <Text style={[s.collapseTitle, { color:tk.textPrimary }]}>{t('lesson_discussion_questions', 'Discussion Questions')}</Text>
                <View style={[s.collapseBadge, { backgroundColor:BLUE_LIGHT }]}>
                  <Text style={[s.collapseBadgeTxt, { color:BLUE }]}>{c.questions.length}</Text>
                </View>
                <Text style={[s.collapseChevron, { color:tk.textMuted }]}>
                  {questionsOpen ? '⌃' : '⌄'}
                </Text>
              </TouchableOpacity>
              {questionsOpen && (
                <View style={{ marginTop:10 }}>
                  {c.questions.map((q, i) => (
                    <QuestionCard key={i} question={q} index={i} tk={tk}/>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* QUIZ CTA */}
          <View style={s.section}>
            <SectionHeader title={t('lesson_test_yourself', 'Test Yourself')} icon="⚡" tk={tk}/>
            <View style={[s.quizCard, { backgroundColor:tk.glassFill, borderColor:tk.glassEdge }]}>
                    <View style={s.quizBody}>
                    <View style={[s.quizIcon, { backgroundColor:BLUE_LIGHT }]}>
                      <Text style={{ fontSize:36 }}>⚡</Text>
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={[s.quizTitle, { color:tk.textPrimary }]}>
                        {t('lesson_take_quiz_title', 'Take the Lesson Quiz')}
                      </Text>
                      <Text style={[s.quizSub, { color:tk.textMuted }]}>
                        {t('lesson_take_quiz_sub', 'Earn points and track your progress')}
                      </Text>
                    </View>
                  </View>
                  {quizDone ? (
                    <View style={[s.quizBtn, { backgroundColor:'#10B981' }]}>
                      <Text style={{ fontSize:18 }}>✅</Text>
                      <Text style={s.quizBtnTxt}>{t('lesson_quiz_completed', 'Quiz Completed')}</Text>
                    </View>
                  ) : !readingTimer.ready ? (
                    // 2-min dwell gate not yet satisfied — show a disabled
                    // pill with mm:ss remaining so the user knows what they
                    // need to do to unlock the quiz.
                    <View style={[s.quizBtn, { backgroundColor: tk.surfaceEl }]}>
                      <Text style={{ fontSize:18 }}>⏳</Text>
                      <Text style={[s.quizBtnTxt, { color: tk.textMuted }]}>
                        {t('lesson_quiz_in', 'Quiz unlocks in')} {fmtMMSS(readingTimer.remaining)}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={()=>setQuizVisible(true)} activeOpacity={0.85}
                      style={[s.quizBtn, { backgroundColor:BLUE }]}>
                      <Text style={{ fontSize:18 }}>⚡</Text>
                      <Text style={s.quizBtnTxt}>{t('lesson_start_quiz', 'Start Quiz')} →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

          {/* FOOTER */}
          <View style={s.footer}>
            <Text style={[s.footerTxt, { color:tk.textMuted }]}>{t('login_footer', '© Gospelar Sunday School Department')}</Text>
            <Text style={[s.footerSite, { color:BLUE }]}>www.gospelar.com</Text>
          </View>

        </Animated.ScrollView>
      )}

      {/* Daily Reading FAB */}
      {Array.isArray(c.devotional_days) && c.devotional_days.length > 0 && (
        <TouchableOpacity
          onPress={() => navigation.navigate('DevotionalReading', {
            devotional:  c.devotional_days[0],
            allDays:     c.devotional_days,
            lessonTitle: lesson?.title,
            lessonAccent:BLUE,
          })}
          activeOpacity={0.88}
          style={[s.fab, { backgroundColor:BLUE }]}>
          <Text style={s.fabIcon}>📖</Text>
          <Text style={s.fabLabel}>{t('lesson_daily_reading', 'Daily\nReading')}</Text>
        </TouchableOpacity>
      )}

      {/* Settings tab removed — Settings lives on the Library home only. */}
      <AppTabBar activeTab={activeTab} onTab={handleTab} tk={tk} tabs={[{key:'Home',label:t('tab_home','Home')},{key:'Lessons',label:t('tab_lessons','Lessons')},{key:'Notes',label:t('tab_notes','Notes')},{key:'Stats',label:t('tab_progress','Progress')}]}/>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex:1 },
  topbar:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:8, paddingBottom:16 },
  iconBtn:    { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },
  topCenter:  { alignItems:'center' },
  pageTitle:  { fontSize:17, fontWeight:'800' },
  pageSub:    { fontSize:11, marginTop:2 },
  section:    { paddingHorizontal:20, marginBottom:24 },
  overviewSection: { paddingLeft:20, marginBottom:24 },
  overviewScroll:  { paddingRight:20, paddingBottom:4 },
  card:       { borderRadius:18, borderWidth:1, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },
  loadingBox: { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  loadingTxt: { fontSize:14 },

  // Modal content styles
  modalVerse:      { fontSize:17, fontStyle:'italic', fontWeight:'600', lineHeight:28, marginBottom:18 },
  modalPassage:    { flexDirection:'row', alignItems:'center', gap:10, borderRadius:12, borderWidth:1, paddingHorizontal:14, paddingVertical:11 },
  modalPassageTxt: { fontSize:14, fontWeight:'800' },
  modalBodyTxt:    { fontSize:14.5, lineHeight:24 },
  modalActionBtn:  { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginTop:20, borderRadius:14, paddingVertical:13 },
  modalActionTxt:  { color:'#fff', fontSize:15, fontWeight:'800' },

  // Quiz card — no top stripe, left bar instead
  quizCard:      { borderRadius:18, borderWidth:1, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },

  quizBody:      { flexDirection:'row', alignItems:'center', gap:16, padding:18 },
  quizIcon:      { width:60, height:60, borderRadius:18, justifyContent:'center', alignItems:'center', flexShrink:0 },
  quizTitle:     { fontSize:16, fontWeight:'800', marginBottom:4 },
  quizSub:       { fontSize:12, lineHeight:18 },
  quizBtn:       { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, margin:16, marginTop:0, borderRadius:14, paddingVertical:13 },
  quizBtnTxt:    { color:'#fff', fontSize:15, fontWeight:'800' },

  // Collapsible questions
  collapseHeader:   { flexDirection:'row', alignItems:'center', gap:12, borderRadius:18, borderWidth:1, padding:16, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:.05, shadowRadius:10, elevation:2 },
  collapseTitle:    { flex:1, fontSize:16, fontWeight:'800' },
  collapseBadge:    { borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  collapseBadgeTxt: { fontSize:12, fontWeight:'900' },
  collapseChevron:  { fontSize:18, fontWeight:'700' },

  // FAB
  fab:      { position:'absolute', right:20, bottom:90, width:64, height:64, borderRadius:20, justifyContent:'center', alignItems:'center', shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:.22, shadowRadius:14, elevation:10 },
  fabIcon:  { fontSize:22 },
  fabLabel: { fontSize:8.5, fontWeight:'800', color:'#fff', textAlign:'center', marginTop:2, letterSpacing:.3 },

  // Footer
  footer:    { alignItems:'center', marginTop:8, paddingHorizontal:20, paddingBottom:8 },
  footerTxt: { fontSize:11, marginBottom:4 },
  footerSite:{ fontSize:12, fontWeight:'700' },
});