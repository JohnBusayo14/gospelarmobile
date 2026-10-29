// screen/videos/VideoPlayerSurface.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The expo-video player itself. Imported lazily by VideoPlayerScreen only
// after confirming the ExpoVideo native module exists in this binary.
//
// Signed playback URLs expire. If the player errors (expired URL, network
// blip), we fetch a fresh URL from the backend, swap the source in place and
// seek back to where the viewer was — up to MAX_AUTO_RECOVERIES times before
// showing a manual Retry.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import { ICONS } from '../../components/icons';
import { BLUE, formatDuration } from './videoShared';

const MAX_AUTO_RECOVERIES = 2;
const SEEK_STEP_SECONDS = 10;

export default function VideoPlayerSurface({ initialUrl, resumeAt, refreshUrl, onTime, onEnded, onFatal, title, tk, t }) {
  const viewRef = useRef(null);
  const lastTime = useRef(0);
  const pendingSeek = useRef(resumeAt > 0 ? resumeAt : null);
  const started = useRef(false);
  const recoveries = useRef(0);
  const [recovering, setRecovering] = useState(false);
  const [failed, setFailed] = useState(null);
  const [time, setTime] = useState({ current: 0, duration: 0 });

  // initialUrl never changes for a mounted surface (the parent remounts it
  // on manual retry); URL refreshes go through replaceAsync below.
  const player = useVideoPlayer({ uri: initialUrl }, (p) => {
    p.timeUpdateEventInterval = 1;
    p.loop = false;
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    lastTime.current = currentTime;
    const duration = player.duration || 0;
    setTime({ current: currentTime, duration });
    onTime?.(currentTime, duration);
  });
  useEventListener(player, 'playToEnd', () => onEnded?.(player.duration || lastTime.current));

  useEffect(() => {
    if (status === 'readyToPlay') {
      if (pendingSeek.current != null) {
        const d = player.duration || 0;
        // Don't resume into the last few seconds — start over instead.
        if (!d || pendingSeek.current < d - 5) player.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
      if (!started.current) {
        started.current = true;
        player.play();
      }
      return;
    }
    if (status !== 'error') return;
    if (recoveries.current >= MAX_AUTO_RECOVERIES) {
      setFailed(t('vid_play_error', "This video couldn't be played. Check your connection and try again."));
      return;
    }
    recoveries.current += 1;
    let cancelled = false;
    (async () => {
      setRecovering(true);
      try {
        const position = lastTime.current;
        const freshUrl = await refreshUrl();
        if (cancelled) return;
        pendingSeek.current = position > 0 ? position : null;
        await player.replaceAsync({ uri: freshUrl });
        player.play();
      } catch (e) {
        if (!cancelled) {
          if (e?.code === 'session_expired') onFatal?.(e);
          else setFailed(e?.message || t('vid_play_error', "This video couldn't be played."));
        }
      } finally {
        if (!cancelled) setRecovering(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const togglePlay = () => (isPlaying ? player.pause() : player.play());
  const seekBy = (delta) => player.seekBy(delta);
  const toggleMute = () => { player.muted = !player.muted; };
  const enterFullscreen = () => viewRef.current?.enterFullscreen?.().catch?.(() => {});

  const busy = !failed && (recovering || status === 'loading' || status === 'idle');

  return (
    <View>
      <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
        <VideoView
          ref={viewRef}
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls
          // The app is portrait-locked. Android's fullscreen activity can
          // rotate on its own; on iOS forcing landscape against a portrait-only
          // Info.plist risks an orientation exception, so we leave it 'default'.
          fullscreenOptions={{ enable: true, orientation: Platform.OS === 'android' ? 'landscape' : 'default' }}
          allowsPictureInPicture={false}
          accessibilityLabel={title}
        />
        {busy && (
          <View style={st.overlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            {recovering && <Text style={st.overlayTxt}>{t('vid_reconnecting', 'Reconnecting…')}</Text>}
          </View>
        )}
        {!!failed && (
          <View style={[st.overlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
            <ICONS.AlertTriangle color="#fff" size={28} />
            <Text style={[st.overlayTxt, { textAlign: 'center', paddingHorizontal: 24 }]}>{failed}</Text>
          </View>
        )}
      </View>

      {/* Large, labelled controls below the video for small hands and screen readers.
          Native controls on the video handle scrubbing. */}
      {!failed && (
        <View style={[st.controls, { backgroundColor: tk.surface }]}>
          <Text style={[st.time, { color: tk.textSec }]} accessibilityLabel={`${formatDuration(time.current)} / ${formatDuration(time.duration)}`}>
            {formatDuration(time.current)} / {formatDuration(time.duration)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CtrlBtn onPress={() => seekBy(-SEEK_STEP_SECONDS)} label={t('vid_back10', 'Back 10 seconds')} tk={tk}>
              <ICONS.Rewind color={tk.textPrimary} size={18} />
            </CtrlBtn>
            <CtrlBtn onPress={togglePlay} label={isPlaying ? t('vid_pause', 'Pause') : t('vid_play', 'Play')} tk={tk} primary>
              {isPlaying ? <ICONS.Pause color="#fff" size={20} /> : <ICONS.Play color="#fff" size={20} fill="#fff" />}
            </CtrlBtn>
            <CtrlBtn onPress={() => seekBy(SEEK_STEP_SECONDS)} label={t('vid_fwd10', 'Forward 10 seconds')} tk={tk}>
              <ICONS.FastForward color={tk.textPrimary} size={18} />
            </CtrlBtn>
            <CtrlBtn onPress={toggleMute} label={muted ? t('vid_unmute', 'Unmute') : t('vid_mute', 'Mute')} tk={tk}>
              {muted ? <ICONS.VolumeOff color={tk.textPrimary} size={18} /> : <ICONS.Volume color={tk.textPrimary} size={18} />}
            </CtrlBtn>
            <CtrlBtn onPress={enterFullscreen} label={t('vid_fullscreen', 'Full screen')} tk={tk}>
              <ICONS.Maximize color={tk.textPrimary} size={18} />
            </CtrlBtn>
          </View>
        </View>
      )}
    </View>
  );
}

function CtrlBtn({ onPress, label, children, tk, primary }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={[st.ctrl, { backgroundColor: primary ? BLUE : tk.surfaceEl }]}
    >
      {children}
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.35)' },
  overlayTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, flexWrap: 'wrap', gap: 8 },
  time: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ctrl: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
