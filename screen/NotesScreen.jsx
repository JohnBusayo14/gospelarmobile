// screens/NotesScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Class Notes — write and save what you learn in class
//   • AsyncStorage key: gospeler_class_notes
//   • Create · Edit · Delete notes
//   • Each note: id, title, body, lessonRef, lessonNumber, createdAt, updatedAt
//   • Word count shown while editing
//   • Opened from LessonPage (prefills lesson ref + title)
//   • Search / filter notes
//   • Bamboo fintech: white cards, blue #1A56DB primary
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Animated, Alert, Platform,
  KeyboardAvoidingView, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage    from '@react-native-async-storage/async-storage';
import { useTheme }    from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { bookTones, AMBIENT_SHADOW as BOOK_SHADOW } from '../theme/bookSurfaces';
import { useScreenEntry } from '../hooks/useFluidAnim';
import { ICONS } from '../components/icons';

const STORAGE_KEY = 'gospeler_class_notes';
const { width } = require('react-native').Dimensions.get('window');

const BLUE       = '#1A56DB';
const BLUE_LIGHT = '#EFF6FF';
const NOTE_ACCENTS = [BLUE,'#7C3AED','#10B981','#F97316','#DC2626','#0891B2','#8B5CF6','#EC4899'];

const makeId = () => `note_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const wordCount = (str='') => str.trim().split(/\s+/).filter(Boolean).length;
const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
};

// ── Note Card (list item) ─────────────────────────────────────────────────────
const NoteCard = ({ note, index, tk, onEdit, onDelete, t = (_,f)=>f }) => {
  const accent   = NOTE_ACCENTS[index % NOTE_ACCENTS.length];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim= useRef(new Animated.Value(16)).current;
  useEffect(()=>{
    // Hold the handle so a card unmounting mid-stagger doesn't leave the
    // animator finalising a dead Animated.Value.
    const handle = Animated.parallel([
      Animated.timing(fadeAnim, {toValue:1,duration:380,delay:index*50,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.timing(slideAnim,{toValue:0,duration:380,delay:index*50,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
    ]);
    handle.start();
    return () => { try { handle.stop(); } catch { /* already done */ } };
  },[]);
  const preview = (note.body||'').trim().slice(0,120) + ((note.body||'').length>120?'…':'');
  const wc = wordCount(note.body);
  return (
    <Animated.View style={{opacity:fadeAnim,transform:[{translateY:slideAnim}],marginBottom:12}}>
      {/* Clean card — same shape as Homescreen cards: soft shadow, no border, no accent stripes */}
      <View style={{borderRadius:18,padding:16,backgroundColor:tk.glassFill,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:.05,shadowRadius:10,elevation:2}}>
        {!!note.lessonRef&&(
          <View style={{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',borderRadius:8,paddingHorizontal:10,paddingVertical:4,marginBottom:10,backgroundColor:accent+'15'}}>
            <Text style={{fontSize:12}}>📖</Text>
            <Text style={{fontSize:11,fontWeight:'700',color:accent,maxWidth:width*0.5}} numberOfLines={1}>{note.lessonRef}</Text>
          </View>
        )}
        <Text style={{fontSize:16,fontWeight:'800',lineHeight:22,marginBottom:8,color:tk.textPrimary}} numberOfLines={2}>{note.title||t('notes_untitled', 'Untitled Note')}</Text>
        {!!preview&&<Text style={{fontSize:13,lineHeight:20,marginBottom:12,color:tk.textSec}} numberOfLines={3}>{preview}</Text>}
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <Text style={{fontSize:11,fontWeight:'500',color:tk.textMuted}}>{fmtDate(note.updatedAt||note.createdAt)} · {wc} {wc===1?t('notes_word','word'):t('notes_words','words')}</Text>
          <View style={{flexDirection:'row',gap:8}}>
            <TouchableOpacity onPress={()=>onEdit(note)} activeOpacity={0.75}
              style={{borderRadius:8,paddingHorizontal:12,paddingVertical:6,backgroundColor:accent+'12'}}>
              <Text style={{fontSize:12,fontWeight:'700',color:accent}}>{t('notes_edit', '✏️ Edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>onDelete(note.id)} activeOpacity={0.75}
              style={{borderRadius:8,paddingHorizontal:12,paddingVertical:6,backgroundColor:'#FEE2E2'}}>
              <Text style={{fontSize:12,fontWeight:'700',color:'#DC2626'}}>{t('notes_delete', '🗑 Delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// ── Note Editor (full-screen overlay) ─────────────────────────────────────────
const NoteEditor = ({ note, prefillLesson, prefillNumber, tk, onSave, onCancel, t = (_,f)=>f }) => {
  const [title, setTitle] = useState(note?.title||'');
  const [body,  setBody]  = useState(note?.body||'');
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if (!note && prefillLesson) setTitle(t('notes_prefill_title', 'Notes — {lesson}').replace('{lesson}', prefillLesson));
    Animated.parallel([
      Animated.timing(fadeAnim, {toValue:1,duration:280,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.timing(slideAnim,{toValue:0,duration:280,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
    ]).start();
  },[]);

  const wc = wordCount(body);
  const canSave = title.trim().length>0 || body.trim().length>0;
  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    onSave({
      id:           note?.id || makeId(),
      title:        title.trim() || t('notes_untitled', 'Untitled Note'),
      body:         body.trim(),
      lessonRef:    note?.lessonRef    || prefillLesson || '',
      lessonNumber: note?.lessonNumber || prefillNumber || null,
      createdAt:    note?.createdAt    || now,
      updatedAt:    now,
    });
  };

  return (
    <Animated.View style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:999,opacity:fadeAnim,transform:[{translateY:slideAnim}],backgroundColor:tk.pageBg}}>
      <SafeAreaView style={{flex:1}} edges={['top']}>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
          {/* Top bar */}
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:tk.glassEdge}}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.75} style={{borderRadius:10,paddingHorizontal:14,paddingVertical:8,backgroundColor:tk.surfaceEl}}>
              <Text style={{fontSize:14,fontWeight:'600',color:tk.textPrimary}}>{t('btn_cancel', 'Cancel')}</Text>
            </TouchableOpacity>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <View style={{width:32,height:32,borderRadius:8,justifyContent:'center',alignItems:'center',backgroundColor:BLUE_LIGHT}}>
                <Text style={{fontSize:18}}>📝</Text>
              </View>
              <Text style={{fontSize:16,fontWeight:'800',color:tk.textPrimary}}>{note?t('notes_edit_note','Edit Note'):t('notes_new_note','New Note')}</Text>
            </View>
            <TouchableOpacity onPress={handleSave} disabled={!canSave} activeOpacity={0.85}
              style={{borderRadius:10,paddingHorizontal:14,paddingVertical:8,backgroundColor:canSave?BLUE:tk.surfaceEl}}>
              <Text style={{fontSize:14,fontWeight:'800',color:canSave?'#fff':tk.textMuted}}>{t('btn_save', 'Save')}</Text>
            </TouchableOpacity>
          </View>
          {/* Lesson badge */}
          {(prefillLesson||note?.lessonRef)&&(
            <View style={{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:20,marginTop:14,borderRadius:10,borderWidth:1,paddingHorizontal:12,paddingVertical:8,backgroundColor:BLUE_LIGHT,borderColor:BLUE+'30'}}>
              <Text style={{fontSize:16}}>📖</Text>
              <Text style={{fontSize:12,fontWeight:'700',flex:1,color:BLUE}}>{prefillLesson||note?.lessonRef}</Text>
            </View>
          )}
          <ScrollView keyboardShouldPersistTaps="handled">
            <TextInput
              style={{fontSize:22,fontWeight:'900',paddingHorizontal:20,paddingVertical:18,borderBottomWidth:1,borderBottomColor:tk.glassEdge,color:tk.textPrimary}}
              value={title} onChangeText={setTitle}
              placeholder={t('notes_title_placeholder','Note title…')} placeholderTextColor={tk.textMuted}
              returnKeyType="next" maxLength={120}/>
            <TextInput
              style={{fontSize:15,lineHeight:26,paddingHorizontal:20,paddingTop:16,paddingBottom:120,minHeight:300,color:tk.textPrimary}}
              value={body} onChangeText={setBody}
              placeholder={t('notes_body_placeholder', 'Write what you learned in class today…')}
              placeholderTextColor={tk.textMuted}
              multiline textAlignVertical="top" autoFocus={!note}/>
          </ScrollView>
          {/* Footer with word count + save */}
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:14,borderTopWidth:1,borderTopColor:tk.glassEdge,backgroundColor:tk.pageBg}}>
            <Text style={{fontSize:12,fontWeight:'500',color:tk.textMuted}}>{wc} {wc===1?t('notes_word','word'):t('notes_words','words')}</Text>
            <TouchableOpacity onPress={handleSave} disabled={!canSave} activeOpacity={0.85}
              style={{flexDirection:'row',alignItems:'center',gap:8,borderRadius:14,paddingHorizontal:20,paddingVertical:12,backgroundColor:canSave?BLUE:tk.surfaceEl}}>
              <Text style={{fontSize:16}}>📝</Text>
              <Text style={{fontSize:14,fontWeight:'800',color:canSave?'#fff':tk.textMuted}}>{note?t('notes_update_note','Update Note'):t('notes_save_note','Save Note')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function NotesScreen({ route, navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => ({ ...getTokens(isDark), ...bookTones(isDark) }), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const prefillLesson = route?.params?.prefillLesson || '';
  const prefillNumber = route?.params?.prefillNumber || null;

  const [notes,       setNotes]       = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [showEditor,  setShowEditor]  = useState(false);

  useEffect(()=>{
    AsyncStorage.getItem(STORAGE_KEY).then(raw=>setNotes(raw?JSON.parse(raw):[])).catch(()=>setNotes([]));
  },[]);

  useEffect(()=>{
    if (prefillLesson && !showEditor) { setEditingNote(null); setShowEditor(true); }
  },[prefillLesson]);

  const persist = useCallback(async(updated)=>{
    try{await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(updated));}catch{}
  },[]);

  const handleSave = useCallback((saved)=>{
    setNotes(prev=>{
      const idx=prev.findIndex(n=>n.id===saved.id);
      const updated=idx>=0?prev.map(n=>n.id===saved.id?saved:n):[saved,...prev];
      persist(updated); return updated;
    });
    setShowEditor(false); setEditingNote(null);
  },[persist]);

  const handleDelete = useCallback((id)=>{
    Alert.alert(t('notes_delete_title', 'Delete Note'), t('notes_delete_confirm', 'Delete this note permanently?'),[
      {text:t('btn_cancel', 'Cancel'),style:'cancel'},
      {text:t('btn_delete', 'Delete'),style:'destructive',onPress:()=>{
        setNotes(prev=>{const updated=prev.filter(n=>n.id!==id);persist(updated);return updated;});
      }},
    ]);
  },[persist]);

  const filtered = useMemo(()=>{
    if (!searchQuery.trim()) return notes;
    const q=searchQuery.toLowerCase();
    return notes.filter(n=>
      n.title?.toLowerCase().includes(q)||
      n.body?.toLowerCase().includes(q)||
      n.lessonRef?.toLowerCase().includes(q)
    );
  },[notes,searchQuery]);

  const totalWords = useMemo(()=>notes.reduce((a,n)=>a+wordCount(n.body),0),[notes]);

  return (
    <SafeAreaView style={{flex:1,backgroundColor:tk.pageBg}} edges={['top']}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={tk.pageBg}/>

      {/* TOP BAR */}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:8,paddingBottom:16,backgroundColor:tk.pageBg}}>
        <TouchableOpacity onPress={()=>navigation.goBack()} activeOpacity={0.75}
          style={{width:40,height:40,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:tk.surfaceEl}}>
          <Text style={{fontSize:20,color:tk.textPrimary}}>←</Text>
        </TouchableOpacity>
        <View style={{alignItems:'center'}}>
          <Text style={{fontSize:17,fontWeight:'800',color:tk.textPrimary}}>{t('notes_class_notes', 'Class Notes')}</Text>
          <Text style={{fontSize:11,marginTop:2,color:tk.textMuted}}>{notes.length} {notes.length===1?t('notes_note','note'):t('notes_notes','notes')} · {totalWords} {t('notes_words','words')}</Text>
        </View>
        <TouchableOpacity onPress={()=>{setEditingNote(null);setShowEditor(true);}} activeOpacity={0.85}
          style={{borderRadius:20,paddingHorizontal:16,paddingVertical:9,backgroundColor:BLUE}}>
          <Text style={{color:'#fff',fontSize:13,fontWeight:'800'}}>{t('notes_new_button', '+ New')}</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      {notes.length>0&&(
        <View style={{flexDirection:'row',alignItems:'center',marginHorizontal:20,marginBottom:16,borderRadius:14,borderWidth:1,paddingHorizontal:14,paddingVertical:10,backgroundColor:tk.surfaceEl,borderColor:tk.glassEdge}}>
          <View style={{marginRight:8}}>
            <ICONS.Search color={tk.textMuted} size={16} sw={1.9} />
          </View>
          <TextInput style={{flex:1,fontSize:14,fontWeight:'500',color:tk.textPrimary}} value={searchQuery} onChangeText={setSearchQuery} placeholder={t('notes_search_placeholder', 'Search notes…')} placeholderTextColor={tk.textMuted} returnKeyType="search"/>
          {!!searchQuery&&<TouchableOpacity onPress={()=>setSearchQuery('')} activeOpacity={0.7} hitSlop={8}><ICONS.X color={tk.textMuted} size={16} sw={2.2} /></TouchableOpacity>}
        </View>
      )}

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:100}}
        style={{ opacity: fade, transform: [{ translateY }] }}>
        {/* STATS ROW */}
        {notes.length>0&&(
          <View style={{flexDirection:'row',gap:10,paddingHorizontal:20,marginBottom:16}}>
            {[{icon:'📝',label:t('notes','Notes'),val:notes.length},{icon:'💬',label:t('notes_stat_words','Words'),val:totalWords},{icon:'📖',label:t('lessons','Lessons'),val:[...new Set(notes.map(n=>n.lessonRef).filter(Boolean))].length}].map(stat=>(
              <View key={stat.label} style={{flex:1,alignItems:'center',borderRadius:16,borderWidth:1,padding:14,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:.04,shadowRadius:6,elevation:1,backgroundColor:tk.glassFill,borderColor:tk.glassEdge}}>
                <Text style={{fontSize:20,marginBottom:4}}>{stat.icon}</Text>
                <Text style={{fontSize:18,fontWeight:'900',marginBottom:2,color:tk.textPrimary}}>{stat.val}</Text>
                <Text style={{fontSize:10,fontWeight:'600',color:tk.textMuted}}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* EMPTY STATE */}
        {notes.length===0&&(
          <View style={{alignItems:'center',paddingVertical:60,paddingHorizontal:36}}>
            <View style={{width:100,height:100,borderRadius:30,justifyContent:'center',alignItems:'center',marginBottom:20,backgroundColor:BLUE_LIGHT}}>
              <Text style={{fontSize:48}}>📝</Text>
            </View>
            <Text style={{fontSize:20,fontWeight:'900',marginBottom:10,textAlign:'center',color:tk.textPrimary}}>{t('notes_empty_title', 'No notes yet')}</Text>
            <Text style={{fontSize:14,lineHeight:22,textAlign:'center',marginBottom:28,color:tk.textMuted}}>{t('notes_empty_sub', 'Write down what you learn in class. Your notes are saved privately on this device.')}</Text>
            <TouchableOpacity onPress={()=>{setEditingNote(null);setShowEditor(true);}} activeOpacity={0.85}
              style={{flexDirection:'row',alignItems:'center',gap:10,borderRadius:16,paddingHorizontal:24,paddingVertical:14,backgroundColor:BLUE}}>
              <Text style={{fontSize:20}}>📝</Text>
              <Text style={{fontSize:15,fontWeight:'800',color:'#fff'}}>{t('notes_write_first', 'Write Your First Note')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* NO RESULTS */}
        {notes.length>0&&filtered.length===0&&(
          <View style={{alignItems:'center',paddingVertical:40}}>
            <View style={{marginBottom:14}}>
              <ICONS.Search color={tk.textMuted} size={36} sw={1.8} />
            </View>
            <Text style={{fontSize:18,fontWeight:'800',marginBottom:8,color:tk.textPrimary}}>{t('notes_no_match_title', 'No matching notes')}</Text>
            <Text style={{fontSize:13,textAlign:'center',color:tk.textMuted}}>{t('notes_no_match_sub', 'Try a different search term.')}</Text>
          </View>
        )}

        {/* NOTE CARDS */}
        {filtered.length>0&&(
          <View style={{paddingHorizontal:20,paddingTop:4}}>
            {filtered.map((note,i)=>(
              <NoteCard key={note.id} note={note} index={i} tk={tk}
                onEdit={n=>{setEditingNote(n);setShowEditor(true);}}
                onDelete={handleDelete} t={t}/>
            ))}
          </View>
        )}

        <View style={{alignItems:'center',marginTop:20,paddingHorizontal:20,paddingBottom:8,flexDirection:'row',justifyContent:'center',gap:6}}>
          <Text style={{fontSize:11,color:tk.textMuted}}>{t('notes_device_only', 'Notes are saved on this device only')}</Text>
          <ICONS.Lock color={tk.textMuted} size={12} sw={2.2} />
        </View>
      </Animated.ScrollView>

      {/* FAB */}
      {notes.length>0&&(
        <TouchableOpacity onPress={()=>{setEditingNote(null);setShowEditor(true);}} activeOpacity={0.88}
          style={{position:'absolute',right:20,bottom:30,width:56,height:56,borderRadius:28,justifyContent:'center',alignItems:'center',shadowColor:BLUE,shadowOffset:{width:0,height:6},shadowOpacity:.35,shadowRadius:12,elevation:10,backgroundColor:BLUE}}>
          <Text style={{fontSize:24,color:'#fff'}}>+</Text>
        </TouchableOpacity>
      )}

      {/* EDITOR OVERLAY */}
      {showEditor&&(
        <NoteEditor
          note={editingNote}
          prefillLesson={prefillLesson}
          prefillNumber={prefillNumber}
          tk={tk}
          onSave={handleSave}
          onCancel={()=>{setShowEditor(false);setEditingNote(null);}}
          t={t}
        />
      )}
    </SafeAreaView>
  );
}