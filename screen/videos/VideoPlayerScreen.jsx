// screen/videos/VideoPlayerScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dedicated player for one library video. Fetches a short-lived signed URL
// from the backend (which re-checks the video is published), plays it with
// expo-video, resumes from the viewer's saved position and periodically saves
// progress so "Continue watching" works across devices.
//
// expo-video is a native module added in this release. To keep OTA updates
// safe for older binaries that don't include it, the player component is
// required lazily and only after confirming the native module exists; older
// builds see an "update the app" message instead of crashing.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requireOptionalNativeModule } from 'expo';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import { fetchPlayback, saveVideoProgress } from '../../services/videos';
import {
  ScreenHeader, Pill, InlineNotice, SessionExpiredState,
  ageLabel, categoryAccent, formatDuration,
} from './videoShared';

const SAVE_EVERY_MS = 15_000;

const hasNativeVideo = () => Platform.OS === 'web' || !!requireOptionalNativeModule('ExpoVideo');

let PlayerSurface = null;
function getPlayerSurface() {
  if (!PlayerSurface) PlayerSurface = require('./VideoPlayerSurface').default;
  return PlayerSurface;
}

export default function VideoPlayerScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const videoId = route.params?.videoId;

  const [video, setVideo] = useState(route.params?.video || null);
  const [playback, setPlayback] = useState(null);     // { url, resumeAt }
  const [state, setState] = useState(() => (hasNativeVideo() ? 'loading' : 'unsupported'));
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);           // bump to remount the surface

  // ── Progress saving ──
  const progressRef = useRef({ position: 0, duration: 0, completed: false, lastSaved: -1, lastSavedAt: 0 });

  const flushProgress = useCallback((force = false) => {
    const p = progressRef.current;
    const position = Math.floor(p.position);
    if (!videoId || position <= 0) return;
    if (!force && (position === p.lastSaved || Date.now() - p.lastSavedAt < SAVE_EVERY_MS)) return;
    p.lastSaved = position;
    p.lastSavedAt = Date.now();
    saveVideoProgress(videoId, { position_seconds: position, completed: p.completed })
      .catch(() => { /* best-effort; next tick retries */ });
  }, [videoId]);

  const onTime = useCallback((current, duration) => {
    const p = progressRef.current;
    p.position = current;
    p.duration = duration;
    if (duration > 0 && current >= duration - 3) p.completed = true;
    flushProgress(false);
  }, [flushProgress]);

  const onEnded = useCallback((duration) => {
    const p = progressRef.current;
    p.position = duration || p.position;
    p.completed = true;
    flushProgress(true);
  }, [flushProgress]);

  // Save on leave, and when the app is backgrounded via navigation blur.
  useEffect(() => navigation.addListener('blur', () => flushProgress(true)), [navigation, flushProgress]);
  useEffect(() => () => flushProgress(true), [flushProgress]);

  // ── Load signed URL ──
  const load = useCallback(async () => {
    if (!videoId) {
      setError({ message: t('vid_not_found', 'Video not found.') });
      setState('error');
      return;
    }
    setState('loading');
    setError(null);
    try {
      const res = await fetchPlayback(videoId);
      setVideo(res.video);
      const prog = res.video?.progress;
      setPlayback({
        url: res.url,
        resumeAt: prog && !prog.completed && prog.position_seconds > 5 ? prog.position_seconds : 0,
      });
      setState('ready');
    } catch (e) {
      setError(e);
      setState(e?.code === 'session_expired' ? 'session' : 'error');
    }
  }, [videoId, t]);

  useEffect(() => {
    if (state !== 'unsupported') load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Used by the surface when a URL expires mid-playback.
  const refreshUrl = useCallback(async () => {
    const res = await fetchPlayback(videoId);
    return res.url;
  }, [videoId]);

  const retry = () => { setAttempt((n) => n + 1); load(); };

  const accent = categoryAccent(video?.category);
  const Surface = state === 'ready' ? getPlayerSurface() : null;

  if (state === 'session') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
        <ScreenHeader title={video?.title || t('vid_player', 'Video')} onBack={() => navigation.goBack()} tk={tk} t={t} />
        <SessionExpiredState navigation={navigation} tk={tk} t={t} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      <ScreenHeader
        title={video?.title || t('vid_player', 'Video')}
        subtitle={video?.is_draft ? t('vid_draft_preview', 'Draft preview — not visible to users') : video?.category}
        onBack={() => navigation.goBack()}
        tk={tk} t={t}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: 960, alignSelf: 'center' }}>
          {state === 'ready' && Surface && (
            <Surface
              key={attempt}
              initialUrl={playback.url}
              resumeAt={playback.resumeAt}
              refreshUrl={refreshUrl}
              onTime={onTime}
              onEnded={onEnded}
              onFatal={() => setState('session')}
              title={video?.title}
              tk={tk} t={t}
            />
          )}
          {state === 'loading' && (
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
              <ICONS.Video color="#ffffff88" size={36} />
              <Text style={{ color: '#ffffffaa', marginTop: 8, fontWeight: '700' }}>{t('vid_loading', 'Loading video…')}</Text>
            </View>
          )}
          {state === 'error' && (
            <InlineNotice
              icon="AlertTriangle" color="#EF4444" tk={tk}
              title={t('vid_play_error_title', "Can't play this video")}
              message={error?.message}
              actionLabel={error?.status === 404 ? t('btn_back', 'Back') : t('fetch_try_again', 'Try Again')}
              onAction={error?.status === 404 ? () => navigation.goBack() : retry}
            />
          )}
          {state === 'unsupported' && (
            <InlineNotice
              icon="Download" tk={tk}
              title={t('vid_update_title', 'Update required')}
              message={t('vid_update_msg', 'Please update Gospelar from the app store to watch videos.')}
            />
          )}

          {!!video && (
            <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: tk.textPrimary, letterSpacing: -0.5 }} accessibilityRole="header">
                {video.title}
              </Text>
              {!!video.bible_reference && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ICONS.Book color={accent} size={16} />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: accent }}>{video.bible_reference}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Pill label={video.category} color={accent} />
                <Pill label={ageLabel(video.age_group, t)} color={tk.textSec} />
                {!!video.duration_seconds && <Pill label={formatDuration(video.duration_seconds)} color={tk.textSec} />}
              </View>
              {!!video.description && (
                <Text style={{ fontSize: 15, lineHeight: 23, color: tk.textSec, marginTop: 4 }}>{video.description}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
