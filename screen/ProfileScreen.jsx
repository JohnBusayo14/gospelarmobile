// screens/ProfileScreen.jsx — Bamboo fintech redesign
// White cards #F5F7FA · Blue #1A56DB · All edit/save/avatar/lang logic preserved

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar, TextInput, Switch, Alert, ActivityIndicator, Platform, Animated, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../services/api';
import { cacheStats, cacheClear } from '../services/cache';
import { prefetchAllForOffline, formatBytes, formatLastSync } from '../services/prefetch';
import AppTabBar from '../components/AppTabBar';
import { ICONS } from '../components/icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useSubscription } from '../context/SubscriptionContext';
import { getTokens } from '../theme/tokens';
import { bookTones, AMBIENT_SHADOW as BOOK_SHADOW } from '../theme/bookSurfaces';
import { useScreenEntry, usePressScale } from '../hooks/useFluidAnim';

const API=API_BASE_URL;
const BLUE='#1A56DB', BLUE_LIGHT='#EFF6FF';
const AVATARS=['👤','😊','🙏','✝️','📖','🌟','🎵','🏆','🌍','💡','🦁','✨'];
const buildLangOptions=(t)=>[
  {code:'en',label:t('set_lang_english','English'),flag:'🇬🇧'},
  {code:'ig',label:t('set_lang_igbo','Igbo'),flag:'🇳🇬'},
  {code:'yo',label:t('set_lang_yoruba','Yoruba'),flag:'🇳🇬'},
  {code:'ha',label:t('set_lang_hausa','Hausa'),flag:'🇳🇬'},
];

// Both SectionHead and Row accept either the legacy emoji `icon` string OR a
// Lucide-style `Icon` component (from ICONS). New code should prefer Icon.
const SectionHead=({title,icon,Icon,tk})=>(
  <View style={{paddingHorizontal:20,paddingTop:24,paddingBottom:10,flexDirection:'row',alignItems:'center',gap:8}}>
    {Icon
      ? <Icon color={tk.textMuted} size={14} sw={2} />
      : icon ? <Text style={{fontSize:18}}>{icon}</Text> : null}
    <Text style={{fontSize:10,fontWeight:'900',letterSpacing:2.5,color:tk.textMuted}}>{title}</Text>
  </View>
);

const Row=({icon,Icon,label,value,onPress,right,tk,danger,noBorder})=>{
  const tint = danger ? '#EF4444' : BLUE;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress?0.7:1}
      style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:14,borderBottomWidth:noBorder?0:1,borderBottomColor:tk.glassEdge}}>
      <View style={{width:44,height:44,borderRadius:14,justifyContent:'center',alignItems:'center',backgroundColor:danger?'#EF444414':BLUE_LIGHT}}>
        {Icon
          ? <Icon color={tint} size={20} sw={1.9} />
          : <Text style={{fontSize:20}}>{icon}</Text>}
      </View>
      <View style={{flex:1,marginLeft:14}}>
        <Text style={{fontSize:14.5,fontWeight:'600',color:danger?'#EF4444':tk.textPrimary}}>{label}</Text>
        {!!value&&<Text style={{fontSize:12,marginTop:2,color:tk.textMuted}} numberOfLines={1}>{value}</Text>}
      </View>
      {right}
      {onPress&&!right&&(
        <View style={{marginLeft:8}}>
          <ICONS.ChevronRight color={tk.textMuted} size={18} sw={1.9} />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function ProfileScreen({navigation}) {
  const {isDark,toggleTheme}=useTheme();
  const {lang,setLang,t}=useLanguage();
  const {isSubscribed, daysRemaining}=useSubscription();
  const tk = useMemo(() => ({ ...getTokens(isDark), ...bookTones(isDark) }), [isDark]);
  const LANG_OPTIONS=useMemo(()=>buildLangOptions(t),[t]);
  const { fade, translateY } = useScreenEntry();
  const saveBtn = usePressScale();

  const [email,setEmail]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const [displayName,setDisplayName]=useState('');
  const [avatar,setAvatar]=useState('👤');
  const [church,setChurch]=useState('');
  const [location,setLocation]=useState('');
  const [notifications,setNotifications]=useState(true);
  const [showAvatarPicker,setShowAvatarPicker]=useState(false);

  // Offline content state
  const [offlineStats,setOfflineStats]=useState({count:0,bytes:0,latestTs:null});
  const [downloading,setDownloading]=useState(false);
  const [downloadProgress,setDownloadProgress]=useState({done:0,total:0,label:''});

  const refreshOfflineStats=useCallback(async()=>{
    const s=await cacheStats();
    setOfflineStats(s);
  },[]);
  useEffect(()=>{refreshOfflineStats();},[refreshOfflineStats]);

  const handleDownloadOffline=async()=>{
    if(downloading)return;
    setDownloading(true);
    setDownloadProgress({done:0,total:0,label:t('offline_starting','Starting…')});
    try{
      const result=await prefetchAllForOffline({
        langs:['en','yo','ig','ha'],
        onProgress:(p)=>setDownloadProgress(p),
      });
      await refreshOfflineStats();
      Alert.alert(
        t('offline_done_title','Download Complete'),
        t('offline_done_msg','{n} items cached for offline use. {e} errors.')
          .replace('{n}',String(result.downloaded))
          .replace('{e}',String(result.errors)),
      );
    }catch(e){
      Alert.alert(t('offline_failed','Download Failed'),e.message||'Unknown error');
    }finally{
      setDownloading(false);
      setDownloadProgress({done:0,total:0,label:''});
    }
  };

  const handleClearOffline=()=>{
    Alert.alert(
      t('offline_clear_title','Clear Offline Content'),
      t('offline_clear_msg','This removes all downloaded lessons, hymns and translations from this device. The app will need internet to reload them.'),
      [
        {text:t('btn_cancel','Cancel'),style:'cancel'},
        {text:t('offline_clear_btn','Clear'),style:'destructive',onPress:async()=>{
          await cacheClear();
          await refreshOfflineStats();
        }},
      ],
    );
  };

  const loadProfile=useCallback(async()=>{
    setLoading(true);
    try{
      const em=await AsyncStorage.getItem('userEmail');
      if(!em){setLoading(false);return;}
      setEmail(em);
      const res=await fetch(`${API}/api/profile/${encodeURIComponent(em)}`);
      const data=await res.json();
      setDisplayName(data.display_name||'');setAvatar(data.avatar_emoji||'👤');
      setChurch(data.church||'');setLocation(data.location||'');
      setNotifications(data.notifications!==false);
    }catch(e){console.error('Profile:',e.message);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{loadProfile();},[]);

  const saveProfile=async()=>{
    if(!email)return;setSaving(true);
    try{
      const res=await fetch(`${API}/api/profile/${encodeURIComponent(email)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({display_name:displayName||null,avatar_emoji:avatar,church:church||null,location:location||null,lang_pref:lang,dark_mode:isDark,notifications})});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||`Error ${res.status}`);}
      setEditMode(false);await loadProfile();
    }catch(e){Alert.alert(t('profile_save_failed','Save Failed'),e.message||t('profile_could_not_save','Could not save.'));}
    finally{setSaving(false);}
  };

  const handleLangChange=(code)=>{setLang(code);if(email)fetch(`${API}/api/profile/${encodeURIComponent(email)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang_pref:code})}).catch(()=>{});};
  const handleThemeToggle=()=>{toggleTheme();if(email)fetch(`${API}/api/profile/${encodeURIComponent(email)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({dark_mode:!isDark})}).catch(()=>{});};
  const handleLogout=()=>{Alert.alert(t('sign_out','Sign Out'),t('set_signout_confirm','Are you sure?'),[{text:t('btn_cancel','Cancel'),style:'cancel'},{text:t('sign_out','Sign Out'),style:'destructive',onPress:async()=>{await AsyncStorage.multiRemove(['userEmail','userToken']);navigation.reset({index:0,routes:[{name:'HomeScreen'}]});}}]);};

  const firstLetter=(displayName||email||'?')[0].toUpperCase();

  return (
    <SafeAreaView style={{flex:1,backgroundColor:tk.pageBg}} edges={['top']}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={tk.pageBg}/>
      {/* TOP BAR */}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:12,borderBottomWidth:1,borderBottomColor:tk.glassEdge}}>
        <TouchableOpacity onPress={()=>navigation.goBack()} activeOpacity={0.7} style={{width:42,height:42,borderRadius:14,justifyContent:'center',alignItems:'center',backgroundColor:tk.glassFill}}>
          <Text style={{fontSize:20,fontWeight:'600',color:tk.textPrimary}}>←</Text>
        </TouchableOpacity>
        <Text style={{fontSize:17,fontWeight:'900',color:tk.textPrimary}}>{t('profile_title', 'Profile & Settings')}</Text>
        <Animated.View style={{ transform:[{ scale: saveBtn.scale }] }}>
          <Pressable onPress={()=>editMode?saveProfile():setEditMode(true)}
            onPressIn={saveBtn.onPressIn} onPressOut={saveBtn.onPressOut}
            style={{borderRadius:12,borderWidth:1.5,paddingHorizontal:16,paddingVertical:8,backgroundColor:editMode?BLUE:tk.glassFill,borderColor:editMode?BLUE:tk.glassEdge}}>
            {saving?<ActivityIndicator color={editMode?'#fff':BLUE} size="small"/>
              :<Text style={{fontSize:13.5,fontWeight:'800',color:editMode?'#fff':BLUE}}>{editMode?t('btn_save','Save'):t('profile_edit','Edit')}</Text>}
          </Pressable>
        </Animated.View>
      </View>

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:100}}
        style={{ opacity: fade, transform: [{ translateY }] }}>
        {loading?<View style={{paddingVertical:60,alignItems:'center'}}><ActivityIndicator color={BLUE} size="large"/></View>:(
          <>
            {/* PROFILE HERO */}
            <View style={{paddingHorizontal:20,paddingTop:24,paddingBottom:24,alignItems:'center',backgroundColor:tk.pageBg}}>
              {/* Avatar */}
              <TouchableOpacity onPress={()=>editMode&&setShowAvatarPicker(v=>!v)} activeOpacity={editMode?0.7:1}
                style={{width:100,height:100,borderRadius:50,borderWidth:2,justifyContent:'center',alignItems:'center',marginBottom:16,position:'relative',backgroundColor:BLUE_LIGHT,borderColor:BLUE+'40'}}>
                {avatar&&avatar!=='👤'?<Text style={{fontSize:44}}>{avatar}</Text>:(
                  <View style={{width:80,height:80,borderRadius:40,backgroundColor:BLUE,justifyContent:'center',alignItems:'center'}}>
                    <Text style={{color:'#fff',fontSize:34,fontWeight:'900'}}>{firstLetter}</Text>
                  </View>
                )}
                {editMode&&<View style={{position:'absolute',bottom:4,right:4,width:24,height:24,borderRadius:12,backgroundColor:BLUE,justifyContent:'center',alignItems:'center'}}>
                  <ICONS.Edit color="#fff" size={11} sw={2.2} />
                </View>}
              </TouchableOpacity>
              {/* Avatar picker */}
              {showAvatarPicker&&editMode&&(
                <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',borderRadius:16,borderWidth:1,padding:12,marginBottom:12,width:'100%',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
                  {AVATARS.map(a=>(
                    <TouchableOpacity key={a} onPress={()=>{setAvatar(a);setShowAvatarPicker(false);}}
                      style={{width:44,height:44,borderRadius:10,justifyContent:'center',alignItems:'center',margin:4,backgroundColor:avatar===a?BLUE+'20':undefined}}>
                      <Text style={{fontSize:24}}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {editMode?(
                <TextInput style={{fontSize:18,fontWeight:'700',borderWidth:1.5,borderRadius:12,paddingHorizontal:14,paddingVertical:10,width:'80%',marginBottom:8,textAlign:'center',color:tk.textPrimary,borderColor:tk.glassEdge,backgroundColor:tk.glassFill}}
                  value={displayName} onChangeText={setDisplayName} placeholder={t('profile_display_name', 'Display name')} placeholderTextColor={tk.textMuted}/>
              ):(
                <Text style={{fontSize:22,fontWeight:'900',letterSpacing:-0.4,marginBottom:4,color:tk.textPrimary}}>{displayName||email.split('@')[0]||t('set_my_profile', 'My Profile')}</Text>
              )}
              <Text style={{fontSize:13,fontWeight:'500',marginBottom:16,color:tk.textMuted}}>{email}</Text>
            </View>

            {/* PERSONAL INFO */}
            <SectionHead title={t('profile_personal_info', 'PERSONAL INFO')} Icon={ICONS.User} tk={tk}/>
            <View style={{marginHorizontal:20,borderRadius:18,borderWidth:1,overflow:'hidden',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
              <Row Icon={ICONS.Landmark} label={t('profile_church_label', 'Church / Assembly')} value={editMode?undefined:church||t('profile_not_set','Not set')} tk={tk}
                right={editMode?<TextInput style={{flex:1,borderWidth:1,borderRadius:10,paddingHorizontal:10,paddingVertical:7,fontSize:13,maxWidth:160,color:tk.textPrimary,borderColor:tk.glassEdge}} value={church} onChangeText={setChurch} placeholder={t('profile_church_placeholder','Church name')} placeholderTextColor={tk.textMuted}/>:null}/>
              <Row Icon={ICONS.Globe} label={t('profile_location_label', 'Location')} value={editMode?undefined:location||t('profile_not_set','Not set')} tk={tk} noBorder
                right={editMode?<TextInput style={{flex:1,borderWidth:1,borderRadius:10,paddingHorizontal:10,paddingVertical:7,fontSize:13,maxWidth:160,color:tk.textPrimary,borderColor:tk.glassEdge}} value={location} onChangeText={setLocation} placeholder={t('profile_location_placeholder','City, Country')} placeholderTextColor={tk.textMuted}/>:null}/>
            </View>

            {/* LANGUAGE */}
            <SectionHead title={t('language','Language').toUpperCase()} Icon={ICONS.Globe} tk={tk}/>
            <View style={{marginHorizontal:20,borderRadius:18,borderWidth:1,overflow:'hidden',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
              <View style={{flexDirection:'row',flexWrap:'wrap',padding:12}}>
                {LANG_OPTIONS.map(({code,label,flag})=>(
                  <TouchableOpacity key={code} onPress={()=>handleLangChange(code)} activeOpacity={0.75}
                    style={{flexDirection:'row',alignItems:'center',borderRadius:12,borderWidth:1.5,paddingHorizontal:12,paddingVertical:9,margin:4,minWidth:'44%',flex:1,backgroundColor:lang===code?BLUE:tk.surfaceEl,borderColor:lang===code?BLUE:tk.glassEdge}}>
                    <Text style={{fontSize:18}}>{flag}</Text>
                    <Text style={{flex:1,fontSize:13,fontWeight:'700',marginLeft:8,color:lang===code?'#fff':tk.textPrimary}}>{label}</Text>
                    {lang===code&&<ICONS.Check color="#fff" size={14} sw={3} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* APPEARANCE */}
            <SectionHead title={t('appearance','Appearance').toUpperCase()} Icon={ICONS.Sun} tk={tk}/>
            <View style={{marginHorizontal:20,borderRadius:18,borderWidth:1,overflow:'hidden',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
              <Row Icon={isDark?ICONS.Moon:ICONS.Sun} label={isDark?t('dark_mode','Dark Mode'):t('light_mode','Light Mode')} value={t('profile_toggle_theme','Toggle app theme')} tk={tk} noBorder
                right={<Switch value={isDark} onValueChange={handleThemeToggle} trackColor={{false:'#D1D5DB',true:BLUE+'90'}} thumbColor={isDark?BLUE:'#fff'} ios_backgroundColor="#D1D5DB"/>}/>
            </View>

            {/* OFFLINE CONTENT */}
            <SectionHead title={t('offline_section','Offline Content').toUpperCase()} Icon={ICONS.Inbox} tk={tk}/>
            <View style={{marginHorizontal:20,borderRadius:18,borderWidth:1,overflow:'hidden',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
              <Row
                icon="⬇️"
                label={downloading
                  ? t('offline_downloading','Downloading…')
                  : t('offline_download','Download for Offline')}
                value={downloading
                  ? `${downloadProgress.done}/${downloadProgress.total||'?'} · ${downloadProgress.label||''}`
                  : (offlineStats.latestTs
                      ? t('offline_synced_at','Last synced {when} · {n} items · {size}')
                          .replace('{when}',formatLastSync(offlineStats.latestTs)||'')
                          .replace('{n}',String(offlineStats.count))
                          .replace('{size}',formatBytes(offlineStats.bytes))
                      : t('offline_not_yet','Not yet downloaded · tap to start'))}
                tk={tk}
                onPress={downloading?undefined:handleDownloadOffline}
                right={downloading?<ActivityIndicator color={BLUE} size="small"/>:undefined}
              />
              {offlineStats.count>0&&(
                <Row
                  Icon={ICONS.Trash}
                  label={t('offline_clear','Clear Offline Content')}
                  value={t('offline_clear_sub','Remove cached lessons, hymns, translations')}
                  tk={tk}
                  onPress={handleClearOffline}
                  noBorder
                  danger
                />
              )}
            </View>

            {/* NOTIFICATIONS */}
            <SectionHead title={t('notifications','Notifications').toUpperCase()} Icon={ICONS.Bell} tk={tk}/>
            <View style={{marginHorizontal:20,borderRadius:18,borderWidth:1,overflow:'hidden',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
              <Row Icon={ICONS.Bell} label={t('profile_push_notifications','Push Notifications')} value={t('profile_push_sub','Lesson reminders and updates')} tk={tk} noBorder
                right={<Switch value={notifications} onValueChange={setNotifications} trackColor={{false:'#D1D5DB',true:'#10B98190'}} thumbColor={notifications?'#10B981':'#fff'} ios_backgroundColor="#D1D5DB"/>}/>
            </View>

            {/* ACCOUNT & SUBSCRIPTION */}
            <SectionHead title={t('account','Account').toUpperCase()} Icon={ICONS.Lock} tk={tk}/>
            <View style={{marginHorizontal:20,borderRadius:18,borderWidth:1,overflow:'hidden',backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
              <Row
                Icon={ICONS.Award}
                label={t('profile_subscription_status', 'Subscription Status')}
                value={isSubscribed
                  ? t('profile_n_days_remaining', '{n} days remaining').replace('{n}', String(daysRemaining))
                  : t('profile_no_subscription', 'No active subscription')}
                tk={tk}
              />
              <Row Icon={ICONS.LogOut} label={t('sign_out','Sign Out')} tk={tk} onPress={handleLogout} danger noBorder/>
            </View>

            <View style={{alignItems:'center',marginTop:28,paddingHorizontal:20,marginBottom:8}}>
              <Text style={{fontSize:11,textAlign:'center',marginBottom:5,color:tk.textMuted}}>{t('login_footer', '© Gospelar Sunday School Department')}</Text>
              <Text style={{fontSize:12,fontWeight:'700',color:BLUE}}>www.gospelar.com</Text>
            </View>
          </>
        )}
      </Animated.ScrollView>

      {/* Settings tab removed — Settings lives on the Library home only.
          Profile was previously bound to activeTab={4}; now it sits over the
          bar without a highlighted tab so the user knows they're on a sub-
          screen reached from Settings rather than a primary destination. */}
      <AppTabBar activeTab={-1} onTab={(i)=>{ if(i===0)navigation.navigate('HomeScreen'); if(i===1)navigation.navigate('SecondPage',{category:{id:'adult',route:'SecondPage'}}); if(i===2)navigation.navigate('Notes'); if(i===3)navigation.navigate('Progress'); }} tk={tk} tabs={[{key:'Home',label:t('tab_home','Home')},{key:'Lessons',label:t('tab_lessons','Lessons')},{key:'Notes',label:t('tab_notes','Notes')},{key:'Stats',label:t('tab_progress','Progress')}]}/>
    </SafeAreaView>
  );
}