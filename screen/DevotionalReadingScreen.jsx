// screens/DevotionalReadingScreen.jsx — Bamboo fintech redesign
// White cards #F5F7FA · Blue primary #1A56DB · Big icons · Collapsible sections

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, StatusBar, Animated, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import AppTabBar, { ICONS } from '../components/AppTabBar';
import { useLanguage } from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { bookTones, AMBIENT_SHADOW as BOOK_SHADOW } from '../theme/bookSurfaces';
import { useScreenEntry } from '../hooks/useFluidAnim';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { silentReadingCheckIn } from '../services/reading';
import { RichVerseText } from '../components/BibleVerseLink';

const { width } = Dimensions.get('window');
const BLUE='#1A56DB', BLUE_MID='#3B82F6', BLUE_LIGHT='#EFF6FF', AMBER='#F59E0B', AMBER_LIGHT='#FEF3C7';

const getDevotionalContent = (day, lang='en') => {
  if (!day) return { prayer:'', reflection:'', application:'' };
  const sc = day.scripture||'';
  if (lang==='yo') return {
    prayer:      `Baba Ọ̀run, bí mo ṣe ń ronú lórí ${sc} lónìí, ṣí ojú ọkàn mi kí n lè rí ohun tí O fẹ́ kọ́ mí. Ràn mí lọ́wọ́ kí n má ṣe gbọ́ Ọ̀rọ̀ Rẹ nìkan, ṣùgbọ́n kí n tẹ̀lé e. Ní orúkọ Jesu, Àmín.`,
    reflection:  `Ìwé mímọ́ òní — ${sc} — sọ̀rọ̀ tọ̀síhàn sí àkọlé ẹ̀kọ́ ti ìfihàn ìgbésí ayé Kristẹni. Béèrè lọ́wọ́ ara rẹ: Ní àgbègbè wo ní ìgbésí ayé mi ni Ọlọ́run ń pè mí láti fi òtítọ́ yìí sẹ̀ lónìí?`,
    application: `Kọ ìgbésẹ̀ kan pàtó tí iwọ yóò gbé lónìí lórí ohun tí o ti kà. Pín rẹ̀ pẹ̀lú ẹlẹgbẹ́ onígbàgbọ́ kan tó lè ṣe ọ̀rọ̀ iṣẹ́.`,
  };
  if (lang==='ig') return {
    prayer:      `Nna m n'elu igwe, ka m na-echeghachi ${sc} taa, meghee anya obi m ka m hụ ihe Ị chọọ ka m mụta. Ka Okwu Gị bụ ọgụgụ n'ụkwụ m. N'aha Jizọs, Amen.`,
    reflection:  `Akwụkwọ Nsọ nke taa — ${sc} — na-ekwu ozugbo maka isiokwu mmụta. Jụọ onwe gị: N'akụkụ ole nke ndụ m Chineke na-akpọ m ka m tinye eziokwu a n'ọrụ taa?`,
    application: `Dee omume otu a nke ị ga-eme taa dabere n'ihe ị gụrụ. Kesaa ya na otu nwunye na ọgọ nke ga-ejide gị aha.`,
  };
  if (lang==='ha') return {
    prayer:      `Ya Ubanmu na sama, yayin da nake tunani akan ${sc} yau, buɗe idanun zuciyata don in ga abin da Kake so in koya. Bari Maganarka ta zama fitila ga ƙafafuna. Da sunan Yesu, Amin.`,
    reflection:  `Nassin yau — ${sc} — yana magana kai tsaye game da taken darasi. Tambayi kanka: A wane yanki na rayuwata ne Allah yake kirana don aiwatar da wannan gaskiya yau?`,
    application: `Rubuta wani takamaiman aiki ɗaya da za ka yi yau. Raba shi da wani mai imani da zai iya riƙe ka da muhimmanci.`,
  };
  return {
    prayer:      `Heavenly Father, as I meditate on ${sc} today, open the eyes of my heart to see what You want me to learn. Let Your Word be a lamp to my feet and a light to my path. In Jesus' name, Amen.`,
    reflection:  `Today's scripture — ${sc} — speaks directly to the lesson theme. Ask yourself: In what specific area of my life is God calling me to put this truth into practice today? Christian growth always finds expression in daily choices and relationships.`,
    application: `Write down one specific action you will take today based on what you've read. Share it with a fellow believer who can hold you accountable. The power of God's Word is released when we obey it step by step, day by day.`,
  };
};

// Each section now carries a Lucide-style component instead of an emoji glyph
// so it picks up the same visual language as the bottom nav.
const buildSections = (t) => [
  {key:'prayer',      Icon:ICONS.Prayer,      label:t('dev_prayer','Prayer'),           color:BLUE,    lightBg:BLUE_LIGHT},
  {key:'reflection',  Icon:ICONS.Reflection,  label:t('dev_reflection','Reflection'),   color:'#7C3AED',lightBg:'#F5F3FF'},
  {key:'application', Icon:ICONS.Application, label:t('dev_application','Application'), color:AMBER,   lightBg:AMBER_LIGHT},
];

// SectionHeader takes an Icon component (preferred) or falls back to an emoji
// string for backward-compat with anywhere that hasn't migrated yet.
const SectionHeader = ({title,Icon,iconColor,tk}) => (
  <View style={{flexDirection:'row',alignItems:'center',marginBottom:12}}>
    {Icon && (
      <View style={{marginRight:8}}>
        <Icon color={iconColor || tk.textMuted} size={20} sw={1.9} />
      </View>
    )}
    <Text style={{fontSize:18,fontWeight:'800',color:tk.textPrimary}}>{title}</Text>
  </View>
);

const DayChip = ({day,index,active,onPress,tk}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.75}
    style={{alignItems:'center',borderRadius:14,paddingHorizontal:14,paddingVertical:8,marginRight:8,borderWidth:1.5,minWidth:60,
      backgroundColor:active?BLUE:tk.surfaceEl,borderColor:active?BLUE:tk.glassEdge}}>
    <Text style={{fontSize:14,fontWeight:'900',letterSpacing:-0.3,color:active?'#fff':tk.textPrimary}}>{String(index+1).padStart(2,'0')}</Text>
    {!!day?.day&&<Text style={{fontSize:9,fontWeight:'700',marginTop:2,color:active?'rgba(255,255,255,.75)':tk.textMuted}} numberOfLines={1}>{day.day.split('—')[0]?.trim()||''}</Text>}
  </TouchableOpacity>
);

const DevSection = ({sectionKey,Icon,label,color,lightBg,content,highlights,onHighlight,onRemove,tk,isDark,t}) => {
  const [open,setOpen]=useState(true);
  const isHL=highlights.includes(sectionKey);
  const rotAnim=useRef(new Animated.Value(1)).current;
  const spin=rotAnim.interpolate({inputRange:[0,1],outputRange:['0deg','180deg']});
  const toggle=()=>{Animated.timing(rotAnim,{toValue:open?0:1,duration:200,useNativeDriver:true}).start();setOpen(v=>!v);};
  const handleLP=()=>{Alert.alert(isHL?t('dev_remove_hl','Remove Highlight'):t('dev_hl_section','Highlight Section'),isHL?t('dev_remove_hl_q','Remove this highlight?'):t('dev_save_section_q','Save this section?'),[{text:t('btn_cancel','Cancel'),style:'cancel'},{text:isHL?t('dev_remove','Remove'):t('dev_highlight','Highlight'),style:isHL?'destructive':'default',onPress:()=>isHL?onRemove(sectionKey):onHighlight(sectionKey)}]);};
  return (
    <View style={{borderRadius:18,borderWidth:1,overflow:'hidden',marginBottom:12,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:.05,shadowRadius:10,elevation:2,backgroundColor:tk.glassFill,borderColor:isHL?color:tk.glassEdge}}>

      <TouchableOpacity onPress={toggle} onLongPress={handleLP} delayLongPress={400} activeOpacity={0.75}
        style={{flexDirection:'row',alignItems:'center',gap:14,padding:16}}>
        <View style={{width:52,height:52,borderRadius:16,justifyContent:'center',alignItems:'center',flexShrink:0,backgroundColor:isDark?color+'22':lightBg}}>
          <Icon color={color} size={26} sw={2} />
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:10,fontWeight:'900',letterSpacing:2,marginBottom:4,color:tk.textMuted}}>{label.toUpperCase()}</Text>
          {isHL&&<View style={{alignSelf:'flex-start',borderRadius:8,borderWidth:1,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,backgroundColor:color+'18',borderColor:color+'30'}}>
            <ICONS.Highlight color={color} size={11} sw={2} />
            <Text style={{fontSize:10,fontWeight:'800',color}}>{t('dev_highlighted_pill_label', 'Highlighted')}</Text>
          </View>}
        </View>
        <Animated.View style={{width:34,height:34,borderRadius:10,justifyContent:'center',alignItems:'center',backgroundColor:tk.surfaceEl,transform:[{rotate:spin}]}}>
          <ICONS.ChevronDown color={tk.textMuted} size={18} sw={2.2} />
        </Animated.View>
      </TouchableOpacity>
      {open&&(
        <View style={{borderTopWidth:1,borderTopColor:tk.glassEdge,padding:18}}>
          <RichVerseText text={content} isDark={isDark} lineHeight={26}
            style={{fontSize:14.5,fontWeight:'400',marginBottom:10,color:tk.textSec}} />
          <Text style={{fontSize:10,fontStyle:'italic',color:tk.textMuted}}>{t('dev_long_press_to_hl', 'Long-press to highlight')}</Text>
        </View>
      )}
    </View>
  );
};


export default function DevotionalReadingScreen({route,navigation}) {
  const {isDark}=useTheme();
  const {t,lang}=useLanguage();
  const tk = useMemo(() => ({ ...getTokens(isDark), ...bookTones(isDark) }), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const {devotional,allDays:paramAllDays,lessonTitle}=route.params||{};
  const allDays=Array.isArray(paramAllDays)&&paramAllDays.length>0?paramAllDays:[devotional].filter(Boolean);
  const SECTIONS=useMemo(()=>buildSections(t),[t]);
  const [dayIndex,setDayIndex]=useState(0);
  const [highlights,setHighlights]=useState([]);
  const fadeAnim=useRef(new Animated.Value(1)).current;
  const scrollRef=useRef(null);
  const currentDay=allDays[dayIndex]||devotional;
  const content=useMemo(()=>getDevotionalContent(currentDay,lang),[currentDay,lang]);
  const STORAGE_KEY=`highlights_dev_${currentDay?.day?.replace(/\s/g,'_')||dayIndex}`;

  useEffect(()=>{AsyncStorage.getItem(STORAGE_KEY).then(raw=>setHighlights(raw?JSON.parse(raw):[])).catch(()=>setHighlights([]));},[STORAGE_KEY]);

  // Auto reading check-in: only fires once the user has spent at least 2 full
  // minutes on this devotional. The backend dedupes per (email, date), so
  // re-entering the screen on the same day re-fires safely.
  const readingTimer = useReadingTimer({ enabled: true });
  useEffect(() => {
    return () => {
      const elapsed = readingTimer.getElapsedSeconds();
      if (elapsed < 120) return;
      AsyncStorage.getItem('userEmail').then((email) => {
        if (!email) return;
        silentReadingCheckIn(email, {
          source_type:      'devotional',
          duration_seconds: elapsed,
        });
      }).catch(() => {});
    };
  }, []);

  const persist=useCallback(async(next)=>{try{await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{}},[STORAGE_KEY]);
  const handleHighlight=useCallback((id)=>{setHighlights(prev=>{const next=[...new Set([...prev,id])];persist(next);return next;});},[persist]);
  const handleRemove=useCallback((id)=>{setHighlights(prev=>{const next=prev.filter(x=>x!==id);persist(next);return next;});},[persist]);
  const switchDay=(idx)=>{if(idx<0||idx>=allDays.length)return;Animated.sequence([Animated.timing(fadeAnim,{toValue:0,duration:120,useNativeDriver:true}),Animated.timing(fadeAnim,{toValue:1,duration:200,useNativeDriver:true})]).start();setDayIndex(idx);scrollRef.current?.scrollTo({y:0,animated:false});};

  return (
    <SafeAreaView style={{flex:1,backgroundColor:tk.pageBg}} edges={['top']}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={tk.pageBg}/>
      {/* TOP BAR */}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:8,paddingBottom:16,backgroundColor:tk.pageBg}}>
        <TouchableOpacity onPress={()=>navigation.goBack()} activeOpacity={0.75} style={{width:40,height:40,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:tk.surfaceEl}}>
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} sw={2} />
        </TouchableOpacity>
        <View style={{alignItems:'center'}}>
          <Text style={{fontSize:17,fontWeight:'800',color:tk.textPrimary}}>{t('dev_daily_devotional', 'Daily Devotional')}</Text>
          {!!lessonTitle&&<Text style={{fontSize:11,marginTop:2,color:tk.textMuted}} numberOfLines={1}>{lessonTitle}</Text>}
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          {/* Voice reading — navigates to a dedicated screen that reads the
              devotional (Intro → Prayer → Reflection → Application) with a
              floating mini-player. Mirrors the Victory book's audio-player
              pattern. The 2-minute reading-timer on that screen keeps
              ticking while audio plays so listeners still earn the point. */}
          <TouchableOpacity
            onPress={()=>navigation.navigate('SundaySchoolVoiceReading',{
              devotional: currentDay,
              allDays,
              dayIndex,
              lessonTitle,
            })}
            activeOpacity={0.75}
            accessibilityLabel={t('dev_start_listening','Listen to devotional')}
            style={{width:40,height:40,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:BLUE_LIGHT}}>
            <Text style={{fontSize:16,color:BLUE,fontWeight:'900'}}>♪</Text>
          </TouchableOpacity>
          {/* Quick-jump to the combined Progress dashboard so the user can
              verify their streak / point updated after the 2-min auto
              check-in fires. */}
          <TouchableOpacity onPress={()=>navigation.navigate('Progress')} activeOpacity={0.75}
            accessibilityLabel={t('dev_view_progress','View progress')}
            style={{width:40,height:40,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:BLUE_LIGHT}}>
            <ICONS.Stats color={BLUE} size={20} sw={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>{Alert.alert(t('dev_clear_hl_title','Clear Highlights'),t('dev_clear_hl_msg','Remove all?'),[{text:t('btn_cancel','Cancel'),style:'cancel'},{text:t('dev_clear','Clear'),style:'destructive',onPress:()=>{setHighlights([]);persist([]);}}]);}}
            activeOpacity={0.75} style={{width:40,height:40,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:highlights.length>0?AMBER_LIGHT:tk.surfaceEl}}>
            <ICONS.Highlight color={highlights.length>0?AMBER:tk.textMuted} size={18} sw={2} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:110}}
        style={{ opacity: fade, transform: [{ translateY }] }}>
        {/* HERO CARD */}
        <View style={{paddingHorizontal:20,marginBottom:24}}>
          <View style={{borderRadius:18,borderWidth:1,overflow:'hidden',shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:.06,shadowRadius:12,elevation:3,backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>

            <View style={{padding:18}}>
              <View style={{flexDirection:'row',alignItems:'flex-start',gap:14,marginBottom:14}}>
                <View style={{width:56,height:56,borderRadius:16,justifyContent:'center',alignItems:'center',backgroundColor:BLUE_LIGHT}}>
                  <ICONS.Sun color={BLUE} size={30} sw={2} />
                </View>
                <View style={{flex:1}}>
                  <Text style={{fontSize:10,fontWeight:'700',letterSpacing:1,marginBottom:6,color:tk.textMuted}}>{t('dev_daily_reading_caps', 'DAILY DEVOTIONAL READING')}</Text>
                  <Text style={{fontSize:18,fontWeight:'900',lineHeight:26,color:tk.textPrimary}} numberOfLines={2}>{currentDay?.title||lessonTitle||t('dev_todays_reading',"Today's Reading")}</Text>
                </View>
              </View>
              {!!currentDay?.scripture&&(
                <View style={{flexDirection:'row',alignItems:'center',gap:8,borderRadius:10,borderWidth:1,paddingHorizontal:12,paddingVertical:8,marginBottom:12,backgroundColor:AMBER_LIGHT,borderColor:AMBER+'40'}}>
                  <ICONS.Book color="#92400E" size={16} sw={2} />
                  <View style={{flex:1}}>
                    <RichVerseText text={currentDay.scripture} isDark={isDark} lineHeight={18}
                      style={{fontSize:13,fontWeight:'700',color:'#92400E'}} />
                  </View>
                </View>
              )}
              {allDays.length>1&&(
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <View style={{flex:1,height:6,borderRadius:3,overflow:'hidden',backgroundColor:tk.glassEdge}}>
                    <View style={{height:6,borderRadius:3,backgroundColor:BLUE,width:`${((dayIndex+1)/allDays.length)*100}%`}}/>
                  </View>
                  <Text style={{fontSize:11,fontWeight:'700',color:tk.textMuted}}>{dayIndex+1}/{allDays.length}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* DAY NAVIGATOR */}
        {allDays.length>1&&(
          <View style={{paddingHorizontal:20,marginBottom:24}}>
            <SectionHeader title={t('dev_select_day', 'Select Day')} Icon={ICONS.Calendar} iconColor={BLUE} tk={tk}/>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {allDays.map((d,i)=><DayChip key={i} day={d} index={i} active={i===dayIndex} onPress={()=>switchDay(i)} tk={tk}/>)}
            </ScrollView>
          </View>
        )}

        {/* DEVOTIONAL SECTIONS */}
        <Animated.View style={{opacity:fadeAnim}}>
          <View style={{paddingHorizontal:20,marginBottom:24}}>
            <SectionHeader title={t('dev_devotional_content', 'Devotional Content')} Icon={ICONS.Book} iconColor={BLUE} tk={tk}/>
            {SECTIONS.map(sec=>(
              <DevSection key={sec.key} sectionKey={sec.key} Icon={sec.Icon} label={sec.label}
                color={sec.color} lightBg={sec.lightBg} content={content[sec.key]||''}
                highlights={highlights} onHighlight={handleHighlight} onRemove={handleRemove}
                tk={tk} isDark={isDark} t={t}/>
            ))}
          </View>
        </Animated.View>

        {/* HIGHLIGHTS */}
        {highlights.length>0&&(
          <View style={{paddingHorizontal:20,marginBottom:24}}>
            <SectionHeader title={t('dev_saved_highlights', 'Saved Highlights')} Icon={ICONS.Highlight} iconColor={AMBER} tk={tk}/>
            <View style={{borderRadius:18,borderWidth:1,overflow:'hidden',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
              {highlights.map((id,i)=>{const sec=SECTIONS.find(s=>s.key===id);return(
                <View key={id} style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:14,gap:12,borderBottomWidth:i<highlights.length-1?1:0,borderBottomColor:tk.glassEdge}}>
                  <View style={{width:10,height:10,borderRadius:5,backgroundColor:sec?.color||BLUE}}/>
                  <Text style={{flex:1,fontSize:14,fontWeight:'600',color:tk.textPrimary}}>{sec?.label||id}</Text>
                  <TouchableOpacity onPress={()=>handleRemove(id)} activeOpacity={0.75}
                    accessibilityLabel={t('dev_remove_hl','Remove Highlight')}
                    style={{width:28,height:28,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#FEE2E2'}}>
                    <ICONS.X color="#EF4444" size={14} sw={2.4} />
                  </TouchableOpacity>
                </View>
              );})}
            </View>
          </View>
        )}

        {/* NAV ARROWS */}
        {allDays.length>1&&(
          <View style={{paddingHorizontal:20,marginBottom:24,flexDirection:'row',alignItems:'center',gap:10}}>
            <TouchableOpacity onPress={()=>switchDay(dayIndex-1)} disabled={dayIndex===0} activeOpacity={0.8}
              style={{flex:1,borderRadius:14,paddingVertical:13,alignItems:'center',backgroundColor:dayIndex===0?tk.surfaceEl:BLUE}}>
              <Text style={{fontSize:14,fontWeight:'800',color:dayIndex===0?tk.textMuted:'#fff'}}>{t('dev_previous', '‹ Previous')}</Text>
            </TouchableOpacity>
            <View style={{paddingHorizontal:16,paddingVertical:10,borderRadius:14,borderWidth:1,alignItems:'center',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
              <Text style={{fontSize:13,fontWeight:'700',color:tk.textPrimary}}>{dayIndex+1}/{allDays.length}</Text>
            </View>
            <TouchableOpacity onPress={()=>switchDay(dayIndex+1)} disabled={dayIndex===allDays.length-1} activeOpacity={0.8}
              style={{flex:1,borderRadius:14,paddingVertical:13,alignItems:'center',backgroundColor:dayIndex===allDays.length-1?tk.surfaceEl:BLUE}}>
              <Text style={{fontSize:14,fontWeight:'800',color:dayIndex===allDays.length-1?tk.textMuted:'#fff'}}>{t('dev_next', 'Next ›')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{alignItems:'center',marginTop:8,paddingHorizontal:20,paddingBottom:8}}>
          <Text style={{fontSize:11,marginBottom:4,color:tk.textMuted}}>{t('login_footer', '© Gospelar Sunday School Department')}</Text>
          <Text style={{fontSize:12,fontWeight:'700',color:BLUE}}>www.gospelar.com</Text>
        </View>
      </Animated.ScrollView>
      {/* Settings tab removed — Settings lives on the Library home only. */}
      <AppTabBar activeTab={0} onTab={(i)=>{ if(i===0)navigation.navigate('HomeScreen'); if(i===1)navigation.navigate('SecondPage',{category:{id:'adult',route:'SecondPage'}}); if(i===2)navigation.navigate('Notes'); if(i===3)navigation.navigate('Progress'); }} tk={tk} tabs={[{key:'Home',label:t('tab_home','Home')},{key:'Lessons',label:t('tab_lessons','Lessons')},{key:'Notes',label:t('tab_notes','Notes')},{key:'Stats',label:t('tab_progress','Progress')}]}/>
    </SafeAreaView>
  );
}