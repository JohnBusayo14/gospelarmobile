// components/QuizModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Quiz modal — fetches questions filtered by category + language
//
// NEW props added:
//   categoryId {string}  e.g. 'adult' | 'youth' | 'intermediate' | 'children' | 'all'
//   lang       {string}  e.g. 'en' | 'yo' | 'ig' | 'ha'
//   onComplete {fn}      called when quiz is submitted (for once-per-lesson tracking)
//
// The API call now sends:
//   GET /api/quiz/:lessonId?category=adult&lang=yo
//
// Server returns questions where:
//   category_id IN ('all', 'adult')   AND   lang IN ('en', 'yo')
// so shared questions (category='all', lang='en') always appear alongside
// category/language-specific ones.
// ─────────────────────────────────────────────────────────────────────────────

// ── ONLY CHANGE NEEDED IN YOUR EXISTING QuizModal.jsx ────────────────────────
//
// 1. Add `categoryId = 'all', lang = 'en', onComplete` to your props:
//
//   export default function QuizModal({ visible, onClose, lessonId, lessonTitle,
//                                       T, categoryId = 'all', lang = 'en', onComplete }) {
//
// 2. Update the fetch URL to include query params:
//
//   BEFORE:
//     const res = await fetch(`${API_BASE_URL}/api/quiz/${lessonId}`);
//
//   AFTER:
//     const params = new URLSearchParams();
//     if (categoryId && categoryId !== 'all') params.set('category', categoryId);
//     if (lang       && lang       !== 'en')  params.set('lang',     lang);
//     const qs  = params.toString();
//     const url = `${API_BASE_URL}/api/quiz/${lessonId}${qs ? '?' + qs : ''}`;
//     const res = await fetch(url);
//
// 3. Call onComplete after successful submission:
//
//   BEFORE:
//     onClose();
//
//   AFTER:
//     onComplete?.();
//     onClose();
//
// ─────────────────────────────────────────────────────────────────────────────
// Full drop-in replacement below if you prefer it:
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet,
  Dimensions, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { API_BASE_URL } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const { width, height } = Dimensions.get('window');
const BLUE = '#1A56DB';

export default function QuizModal({
  visible, onClose, lessonId, lessonTitle,
  T, categoryId = 'all', lang = 'en', onComplete,
}) {
  const { t } = useLanguage();
  const [questions,  setQuestions]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [answers,    setAnswers]    = useState({});
  const [submitted,  setSubmitted]  = useState(false);
  const [score,      setScore]      = useState(0);
  const [maxScore,   setMaxScore]   = useState(0);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Fetch questions filtered by category + lang
  const loadQuestions = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    try {
      const params = new URLSearchParams();
      if (categoryId && categoryId !== 'all') params.set('category', categoryId);
      if (lang       && lang       !== 'en')  params.set('lang',     lang);
      const qs  = params.toString();
      const url = `${API_BASE_URL}/api/quiz/${lessonId}${qs ? '?' + qs : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
      setMaxScore(Array.isArray(data) ? data.reduce((a, q) => a + (q.points || 10), 0) : 0);
    } catch (e) {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [lessonId, categoryId, lang]);

  useEffect(() => {
    if (visible) {
      loadQuestions();
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  const selectAnswer = (qId, opt) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qId]: opt }));
  };

  const submit = async () => {
    if (submitted) return;
    let earned = 0;
    questions.forEach(q => {
      if ((answers[q.id] || '').toLowerCase() === (q.correct_answer || '').toLowerCase()) {
        earned += (q.points || 10);
      }
    });
    setScore(earned);
    setSubmitted(true);

    // Save score to server
    try {
      const email = await import('@react-native-async-storage/async-storage')
        .then(m => m.default.getItem('userEmail'));
      if (email && lessonId) {
        await fetch(`${API_BASE_URL}/api/quiz/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, lessonId, score: earned }),
        });
      }
    } catch {}

    // Notify LessonPage so it marks quiz as done
    onComplete?.();
  };

  const close = () => { setAnswers({}); setSubmitted(false); onClose(); };
  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id]);
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close}/>
        <View style={[s.sheet, { backgroundColor: T?.surface || '#fff' }]}>

          {/* Header */}
          <View style={[s.header, { borderBottomColor: T?.border || '#E8EAED' }]}>
            <View style={s.headerLeft}>
              <Text style={s.headerIcon}>⚡</Text>
              <View>
                <Text style={[s.headerTitle, { color: T?.textPrimary || '#111' }]}>
                  {submitted ? t('quiz_results', 'Quiz Results') : t('quiz_lesson_quiz', 'Lesson Quiz')}
                </Text>
                <Text style={[s.headerSub, { color: T?.textMuted || '#9AA0AB' }]} numberOfLines={1}>
                  {lessonTitle || t('quiz_quiz_label', 'Quiz')}
                  {categoryId && categoryId !== 'all' ? ` · ${categoryId}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={close} style={[s.closeBtn, { backgroundColor: T?.surfaceEl || '#F0F2F5' }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T?.textPrimary || '#111' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={BLUE} size="large"/>
              <Text style={[s.loadingTxt, { color: T?.textMuted || '#9AA0AB' }]}>{t('quiz_loading', 'Loading questions…')}</Text>
            </View>
          ) : questions.length === 0 ? (
            <View style={s.loadingBox}>
              <Text style={{ fontSize: 44 }}>📭</Text>
              <Text style={[s.loadingTxt, { color: T?.textMuted || '#9AA0AB' }]}>{t('quiz_no_questions', 'No quiz questions yet for this lesson.')}</Text>
            </View>
          ) : submitted ? (
            /* Results screen */
            <ScrollView contentContainerStyle={s.body}>
              <View style={[s.scoreCard, { backgroundColor: pct >= 70 ? '#ECFDF5' : '#FEF2F2', borderColor: pct >= 70 ? '#6EE7B7' : '#FECACA' }]}>
                <Text style={{ fontSize: 52 }}>{pct >= 70 ? '🏆' : '📖'}</Text>
                <Text style={[s.scorePct, { color: pct >= 70 ? '#065F46' : '#991B1B' }]}>{pct}%</Text>
                <Text style={[s.scoreSub, { color: pct >= 70 ? '#065F46' : '#991B1B' }]}>
                  {t('quiz_score_format', '{score} / {max} points').replace('{score}', String(score)).replace('{max}', String(maxScore))}
                </Text>
                <Text style={[s.scoreMsg, { color: pct >= 70 ? '#065F46' : '#991B1B' }]}>
                  {pct >= 90 ? t('quiz_excellent', 'Excellent! 🎉') : pct >= 70 ? t('quiz_well_done', 'Well done! ✓') : t('quiz_keep_studying', 'Keep studying! 💪')}
                </Text>
              </View>
              {questions.map((q, i) => {
                const chosen   = answers[q.id] || '';
                const correct  = (q.correct_answer || '').toLowerCase();
                const isRight  = chosen.toLowerCase() === correct;
                const opts     = q.options || {};
                return (
                  <View key={q.id} style={[s.qCard, { backgroundColor: T?.surfaceEl || '#F0F2F5', borderColor: isRight ? '#6EE7B7' : '#FECACA' }]}>
                    <Text style={[s.qNum, { color: BLUE }]}>{t('quiz_q_label', 'Q')}{i+1}</Text>
                    <Text style={[s.qText, { color: T?.textPrimary || '#111' }]}>{q.question}</Text>
                    {Object.entries(opts).map(([k, v]) => {
                      const isCorrect = k.toLowerCase() === correct;
                      const isChosen  = k.toLowerCase() === chosen.toLowerCase();
                      return (
                        <View key={k} style={[s.optRow, {
                          backgroundColor: isCorrect ? '#ECFDF5' : isChosen ? '#FEF2F2' : 'transparent',
                          borderColor:     isCorrect ? '#6EE7B7' : isChosen ? '#FECACA' : 'transparent',
                        }]}>
                          <Text style={[s.optK, { color: isCorrect ? '#065F46' : isChosen ? '#991B1B' : T?.textMuted || '#9AA0AB' }]}>
                            {k.toUpperCase()}.
                          </Text>
                          <Text style={[s.optV, { color: T?.textPrimary || '#111' }]}>{v}</Text>
                          {isCorrect && <Text style={{ fontSize: 14 }}>✓</Text>}
                          {isChosen && !isCorrect && <Text style={{ fontSize: 14 }}>✗</Text>}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              <TouchableOpacity onPress={close} style={[s.submitBtn, { backgroundColor: BLUE }]}>
                <Text style={s.submitBtnTxt}>{t('btn_done', 'Done')}</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* Questions screen */
            <ScrollView contentContainerStyle={s.body}>
              <View style={[s.progressBar, { backgroundColor: T?.surfaceEl || '#F0F2F5' }]}>
                <View style={[s.progressFill, { backgroundColor: BLUE, width: `${Math.round((Object.keys(answers).length / questions.length) * 100)}%` }]}/>
              </View>
              <Text style={[s.progressLabel, { color: T?.textMuted || '#9AA0AB' }]}>
                {t('quiz_n_of_total_answered', '{n} of {total} answered').replace('{n}', String(Object.keys(answers).length)).replace('{total}', String(questions.length))}
              </Text>
              {questions.map((q, i) => {
                const opts = q.options || {};
                const chosen = answers[q.id];
                return (
                  <View key={q.id} style={[s.qCard, { backgroundColor: T?.surfaceEl || '#F0F2F5' }]}>
                    <Text style={[s.qNum, { color: BLUE }]}>{t('quiz_q_label', 'Q')}{i+1} · {q.points || 10} {t('quiz_pts', 'pts')}</Text>
                    <Text style={[s.qText, { color: T?.textPrimary || '#111' }]}>{q.question}</Text>
                    {Object.entries(opts).map(([k, v]) => (
                      <TouchableOpacity key={k} onPress={() => selectAnswer(q.id, k)} activeOpacity={0.75}
                        style={[s.optRow, {
                          backgroundColor: chosen === k ? BLUE + '18' : 'transparent',
                          borderColor:     chosen === k ? BLUE       : T?.border || '#E8EAED',
                          borderWidth: 1.5,
                        }]}>
                        <View style={[s.optCircle, { borderColor: chosen === k ? BLUE : T?.border || '#E8EAED', backgroundColor: chosen === k ? BLUE : 'transparent' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: chosen === k ? '#fff' : T?.textMuted || '#9AA0AB' }}>{k.toUpperCase()}</Text>
                        </View>
                        <Text style={[s.optV, { color: T?.textPrimary || '#111' }]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
              <TouchableOpacity onPress={submit} disabled={!allAnswered} activeOpacity={0.85}
                style={[s.submitBtn, { backgroundColor: allAnswered ? BLUE : T?.surfaceEl || '#F0F2F5' }]}>
                <Text style={[s.submitBtnTxt, { color: allAnswered ? '#fff' : T?.textMuted || '#9AA0AB' }]}>
                  {allAnswered ? t('quiz_submit_answers', 'Submit Answers →') : t('quiz_answer_all_n', 'Answer all {n} questions').replace('{n}', String(questions.length))}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' },
  sheet:       { borderTopLeftRadius:28, borderTopRightRadius:28, maxHeight:height*0.92, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:-4}, shadowOpacity:.12, shadowRadius:16, elevation:16 },
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:16, borderBottomWidth:1 },
  headerLeft:  { flexDirection:'row', alignItems:'center', gap:12, flex:1 },
  headerIcon:  { fontSize:28 },
  headerTitle: { fontSize:16, fontWeight:'900' },
  headerSub:   { fontSize:11, marginTop:2 },
  closeBtn:    { width:34, height:34, borderRadius:17, justifyContent:'center', alignItems:'center' },
  loadingBox:  { paddingVertical:48, alignItems:'center', gap:14 },
  loadingTxt:  { fontSize:14, textAlign:'center', paddingHorizontal:24 },
  body:        { padding:20, paddingBottom:40 },
  progressBar: { height:6, borderRadius:3, marginBottom:8, overflow:'hidden' },
  progressFill:{ height:6, borderRadius:3 },
  progressLabel:{ fontSize:11, marginBottom:16, textAlign:'right' },
  qCard:       { borderRadius:16, padding:16, marginBottom:14, borderWidth:1.5 },
  qNum:        { fontSize:10, fontWeight:'900', letterSpacing:1, marginBottom:6 },
  qText:       { fontSize:14, fontWeight:'700', lineHeight:22, marginBottom:14 },
  optRow:      { flexDirection:'row', alignItems:'center', gap:10, borderRadius:12, paddingHorizontal:12, paddingVertical:10, marginBottom:8 },
  optCircle:   { width:28, height:28, borderRadius:14, borderWidth:1.5, justifyContent:'center', alignItems:'center', flexShrink:0 },
  optK:        { fontSize:12, fontWeight:'900', width:22 },
  optV:        { flex:1, fontSize:13, lineHeight:20 },
  submitBtn:   { borderRadius:16, paddingVertical:15, alignItems:'center', marginTop:8 },
  submitBtnTxt:{ fontSize:15, fontWeight:'800' },
  scoreCard:   { borderRadius:20, borderWidth:1.5, padding:24, alignItems:'center', marginBottom:20 },
  scorePct:    { fontSize:52, fontWeight:'900', lineHeight:60, marginTop:8 },
  scoreSub:    { fontSize:16, fontWeight:'700', marginTop:4 },
  scoreMsg:    { fontSize:14, fontWeight:'600', marginTop:8 },
});