// screen/videos/VideoEditScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin: create or edit one video — metadata, video file, thumbnail, publish
// state, delete.
//
// Save pipeline (each step only runs if needed, and a failure keeps every
// earlier step's result so Retry resumes where it stopped):
//   1. create / update metadata  → draft row exists before any file is sent,
//                                  so storage never holds a file with no row
//   2. upload video   (signed URL → stream from disk → server verifies)
//   3. upload thumbnail
//   4. publish (only for "Save & publish")
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import { LoadingState } from '../../components/FetchStates';
import {
  VideoError, fetchVideoMeta, fetchAdminVideo, createVideo, updateVideo, setVideoPublished,
  deleteVideo, prepareAsset, uploadPreparedFile, completeVideoUpload, formatBytes,
} from '../../services/videos';
import {
  BLUE, ScreenHeader, Chip, Pill, VideoThumb, ProgressBar, SessionExpiredState,
  InlineNotice, ageLabel, formatDuration,
} from './videoShared';
import { statusOf } from './VideoAdminScreen';

const EMPTY_FORM = { title: '', description: '', bible_reference: '', category: '', age_group: 'all' };
const LIMITS = { title: 120, description: 2000, bible_reference: 120, category: 60 };
const FALLBACK_CATEGORIES = ['Bible Stories', 'Sunday School Lessons', 'Memory Verses', 'Worship', 'Prayer', 'Christian Education'];

const formFrom = (v) => ({
  title: v?.title || '',
  description: v?.description || '',
  bible_reference: v?.bible_reference || '',
  category: v?.category || '',
  age_group: v?.age_group || 'all',
});

function validateForm(form, t) {
  const e = {};
  if (!form.title.trim()) e.title = t('vid_err_title', 'Please enter a title.');
  else if (form.title.trim().length > LIMITS.title) e.title = t('vid_err_too_long', 'Too long.');
  if (!form.category.trim()) e.category = t('vid_err_category', 'Please choose or enter a category.');
  else if (form.category.trim().length > LIMITS.category) e.category = t('vid_err_too_long', 'Too long.');
  if (form.description.length > LIMITS.description) e.description = t('vid_err_too_long', 'Too long.');
  if (form.bible_reference.trim().length > LIMITS.bible_reference) e.bible_reference = t('vid_err_too_long', 'Too long.');
  return e;
}

export default function VideoEditScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);

  const [videoId, setVideoId] = useState(route.params?.videoId || null);
  const [video, setVideo] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadState, setLoadState] = useState('loading');   // loading | ready | error
  const [loadError, setLoadError] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [customCategory, setCustomCategory] = useState(false);

  const [pickedVideo, setPickedVideo] = useState(null);
  const [pickedThumb, setPickedThumb] = useState(null);

  const [phase, setPhase] = useState('idle');   // idle | saving | video | thumbnail | publishing | deleting
  const [progress, setProgress] = useState(0);
  const [banner, setBanner] = useState(null);    // { type, message, retry? }

  const taskRef = useRef(null);
  const cancelledRef = useRef(false);
  const failedStage = useRef({ video: null, thumbnail: null });
  const busy = phase !== 'idle';

  // ── Load ──
  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const [m, v] = await Promise.all([
        fetchVideoMeta(),
        videoId ? fetchAdminVideo(videoId) : Promise.resolve(null),
      ]);
      if (!m.can_manage) throw new VideoError(t('vid_admin_only_msg', "Your account doesn't have permission to manage videos."), { code: 'forbidden' });
      setMeta(m);
      if (v) {
        setVideo(v);
        setForm(formFrom(v));
        const suggestions = m.suggested_categories || FALLBACK_CATEGORIES;
        setCustomCategory(!!v.category && !suggestions.includes(v.category));
      }
      setLoadState('ready');
    } catch (e) {
      if (e.code === 'session_expired') setSessionExpired(true);
      setLoadError(e);
      setLoadState('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Leaving mid-upload ──
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (phase !== 'video' && phase !== 'thumbnail') return;
    e.preventDefault();
    Alert.alert(
      t('vid_leave_title', 'Upload in progress'),
      t('vid_leave_msg', 'Leaving will cancel the upload. Your details are saved as a draft and you can upload the file later.'),
      [
        { text: t('vid_stay', 'Stay'), style: 'cancel' },
        {
          text: t('vid_leave', 'Cancel upload'),
          style: 'destructive',
          onPress: () => {
            cancelledRef.current = true;
            taskRef.current?.cancelAsync?.().catch(() => {});
            navigation.dispatch(e.data.action);
          },
        },
      ],
    );
  }), [navigation, phase, t]);

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  const dirty = useMemo(() => {
    const base = formFrom(video);
    return Object.keys(EMPTY_FORM).some((k) => String(form[k]).trim() !== String(base[k]).trim());
  }, [form, video]);

  // ── Pickers ──
  const pickVideo = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        // iOS: hand us H.264 rather than HEVC so Android devices can play it too.
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (res.canceled || !res.assets?.length) return;
      const prepared = await prepareAsset(res.assets[0], 'video', meta);
      setPickedVideo(prepared);
      failedStage.current.video = null;
      setBanner(null);
    } catch (e) {
      Alert.alert(t('vid_bad_video', "Can't use this video"), e.message);
    }
  };

  const pickThumb = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.length) return;
      const prepared = await prepareAsset(res.assets[0], 'thumbnail', meta);
      setPickedThumb(prepared);
      failedStage.current.thumbnail = null;
      setBanner(null);
    } catch (e) {
      Alert.alert(t('vid_bad_image', "Can't use this image"), e.message);
    }
  };

  // Upload, or — if the bytes already reached storage last time and only the
  // verification call failed — just re-run verification.
  const sendFile = async (id, kind, prepared) => {
    setPhase(kind);
    setProgress(0);
    cancelledRef.current = false;
    try {
      if (failedStage.current[kind] === 'complete') {
        try {
          return await completeVideoUpload(id, { kind, duration_seconds: prepared.durationSeconds });
        } catch (e) {
          if (e.status !== 409) throw e;   // 409 → file isn't there; upload again
        }
      }
      const updated = await uploadPreparedFile(id, kind, prepared, {
        onProgress: setProgress,
        onTask: (task) => { taskRef.current = task; },
        isCancelled: () => cancelledRef.current,
      });
      failedStage.current[kind] = null;
      return updated;
    } catch (e) {
      failedStage.current[kind] = e.stage || null;
      throw e;
    } finally {
      taskRef.current = null;
    }
  };

  // ── Save pipeline ──
  const save = async ({ publish }) => {
    if (busy) return;
    const errs = validateForm(form, t);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setBanner({ type: 'error', message: t('vid_fix_fields', 'Please fix the highlighted fields.') });
      return;
    }
    setBanner(null);
    let id = videoId;
    let current = video;
    try {
      if (!id || dirty) {
        setPhase('saving');
        const payload = {
          title: form.title, description: form.description, bible_reference: form.bible_reference,
          category: form.category, age_group: form.age_group,
        };
        current = id ? await updateVideo(id, payload) : await createVideo(payload);
        id = current.id;
        setVideo(current);
        setForm(formFrom(current));
        if (!videoId) {
          setVideoId(id);
          navigation.setParams({ videoId: id });
        }
      }
      if (pickedVideo) {
        current = await sendFile(id, 'video', pickedVideo);
        setVideo(current);
        setPickedVideo(null);
      }
      if (pickedThumb) {
        current = await sendFile(id, 'thumbnail', pickedThumb);
        setVideo(current);
        setPickedThumb(null);
      }
      if (publish && !current.published) {
        if (!current.has_video) {
          throw new VideoError(t('vid_need_file', 'Choose a video file before publishing.'));
        }
        setPhase('publishing');
        current = await setVideoPublished(id, true);
        setVideo(current);
      }
      setBanner({
        type: 'success',
        message: current.published
          ? t('vid_saved_published', 'Saved. This video is published and visible to everyone.')
          : t('vid_saved_draft', 'Saved as a draft. Only administrators can see it.'),
      });
    } catch (e) {
      if (e.code === 'session_expired') { setSessionExpired(true); return; }
      if (e.fields) setFieldErrors(e.fields);
      setBanner({
        type: e.code === 'cancelled' ? 'info' : 'error',
        message: e.message,
        retry: e.code === 'forbidden' ? null : () => save({ publish }),
      });
    } finally {
      setPhase('idle');
    }
  };

  const togglePublished = async () => {
    if (!video || busy) return;
    setPhase('publishing');
    setBanner(null);
    try {
      const updated = await setVideoPublished(video.id, !video.published);
      setVideo(updated);
      setBanner({
        type: 'success',
        message: updated.published
          ? t('vid_now_published', 'Published. Everyone can now watch this video.')
          : t('vid_now_unpublished', 'Unpublished. Only administrators can see it now.'),
      });
    } catch (e) {
      if (e.code === 'session_expired') { setSessionExpired(true); return; }
      setBanner({ type: 'error', message: e.message, retry: togglePublished });
    } finally {
      setPhase('idle');
    }
  };

  const confirmDelete = () => {
    if (!video || busy) return;
    Alert.alert(
      t('vid_delete_title', 'Delete this video?'),
      t('vid_delete_msg', '"{title}" and its files will be permanently deleted. This cannot be undone.').replace('{title}', video.title),
      [
        { text: t('btn_cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('btn_delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            setPhase('deleting');
            try {
              await deleteVideo(video.id);
              setPhase('idle');
              navigation.goBack();
            } catch (e) {
              setPhase('idle');
              setBanner({ type: 'error', message: e.message, retry: confirmDelete });
              fetchAdminVideo(video.id).then(setVideo).catch(() => {});
            }
          },
        },
      ],
    );
  };

  const cancelUpload = () => {
    cancelledRef.current = true;
    taskRef.current?.cancelAsync?.().catch(() => {});
  };

  // ── Render ──
  const header = (
    <ScreenHeader
      title={videoId ? t('vid_edit_title', 'Edit video') : t('vid_new_title', 'New video')}
      subtitle={video ? statusOf(video, t).label : t('vid_new_sub', 'Saved as a draft until you publish')}
      onBack={() => navigation.goBack()}
      tk={tk} t={t}
    />
  );

  if (sessionExpired) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
        {header}
        <SessionExpiredState navigation={navigation} tk={tk} t={t} />
      </SafeAreaView>
    );
  }
  if (loadState !== 'ready') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
        {header}
        {loadState === 'loading'
          ? <LoadingState T={{ bg: tk.bg, textMuted: tk.textMuted }} />
          : (
            <InlineNotice
              icon={loadError?.code === 'forbidden' ? 'Lock' : 'AlertTriangle'}
              color={loadError?.code === 'forbidden' ? BLUE : '#EF4444'}
              tk={tk}
              title={loadError?.code === 'forbidden' ? t('vid_admin_only', 'Administrators only') : t('vid_load_error_one', "Couldn't load this video")}
              message={loadError?.message}
              actionLabel={loadError?.code === 'forbidden' ? null : t('fetch_try_again', 'Try Again')}
              onAction={load}
            />
          )}
      </SafeAreaView>
    );
  }

  const suggestions = meta?.suggested_categories || FALLBACK_CATEGORIES;
  const storageMissing = meta && meta.storage_configured === false;
  const thumbPreview = pickedThumb ? { ...video, thumbnail_url: pickedThumb.uri } : video;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">

          {storageMissing && (
            <Banner tk={tk} type="error" message={t('vid_storage_missing', 'Video storage is not configured on the server yet. You can save details as a draft, but uploads will fail until it is set up.')} />
          )}
          {!!banner && <Banner tk={tk} t={t} {...banner} disabled={busy} />}

          {/* ── Details ── */}
          <Section title={t('vid_details', 'Details')} tk={tk}>
            <Field label={t('vid_f_title', 'Title')} required error={fieldErrors.title} tk={tk}
              count={`${form.title.length}/${LIMITS.title}`}>
              <Input value={form.title} onChangeText={(v) => setField('title', v)} maxLength={LIMITS.title}
                placeholder={t('vid_f_title_ph', 'e.g. David and Goliath')} tk={tk} editable={!busy} />
            </Field>
            <Field label={t('vid_f_desc', 'Description')} error={fieldErrors.description} tk={tk}
              count={`${form.description.length}/${LIMITS.description}`}>
              <Input value={form.description} onChangeText={(v) => setField('description', v)} maxLength={LIMITS.description}
                placeholder={t('vid_f_desc_ph', 'What will children learn from this video?')} multiline tk={tk} editable={!busy} />
            </Field>
            <Field label={t('vid_f_ref', 'Bible reference')} error={fieldErrors.bible_reference} tk={tk}>
              <Input value={form.bible_reference} onChangeText={(v) => setField('bible_reference', v)} maxLength={LIMITS.bible_reference}
                placeholder={t('vid_f_ref_ph', 'e.g. 1 Samuel 17:1–50')} tk={tk} editable={!busy} />
            </Field>
            <Field label={t('vid_f_category', 'Category')} required error={fieldErrors.category} tk={tk}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map((c) => (
                  <Chip key={c} label={c} tk={tk} active={!customCategory && form.category === c}
                    onPress={() => { setCustomCategory(false); setField('category', c); }} />
                ))}
                <Chip label={t('vid_f_other', 'Other…')} tk={tk} active={customCategory}
                  onPress={() => { setCustomCategory(true); setField('category', ''); }} />
              </View>
              {customCategory && (
                <Input value={form.category} onChangeText={(v) => setField('category', v)} maxLength={LIMITS.category}
                  placeholder={t('vid_f_category_ph', 'Type a category')} tk={tk} style={{ marginTop: 10 }} editable={!busy} autoFocus />
              )}
            </Field>
            <Field label={t('vid_f_age', 'Age group')} tk={tk} error={fieldErrors.age_group}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(meta?.age_groups || ['children', 'teens', 'adults', 'all']).map((ag) => (
                  <Chip key={ag} label={ageLabel(ag, t)} tk={tk} active={form.age_group === ag} onPress={() => setField('age_group', ag)} />
                ))}
              </View>
            </Field>
          </Section>

          {/* ── Video file ── */}
          <Section title={t('vid_file', 'Video file')} tk={tk}
            hint={t('vid_file_hint', 'MP4 or MOV, up to {max}. Short 720p clips work best.').replace('{max}', formatBytes(meta?.max_video_bytes || 50 * 1024 * 1024))}>
            <FileRow
              tk={tk}
              icon="Video"
              title={pickedVideo
                ? pickedVideo.name
                : video?.has_video
                  ? t('vid_file_uploaded', 'Video uploaded')
                  : video?.upload_pending
                    ? t('vid_file_incomplete', 'Previous upload did not finish')
                    : t('vid_file_none', 'No video chosen')}
              subtitle={pickedVideo
                ? `${formatBytes(pickedVideo.size)}${pickedVideo.durationSeconds ? ` · ${formatDuration(pickedVideo.durationSeconds)}` : ''} · ${t('vid_ready_to_upload', 'uploads when you save')}`
                : video?.has_video
                  ? `${formatBytes(video.file_size_bytes)}${video.duration_seconds ? ` · ${formatDuration(video.duration_seconds)}` : ''}`
                  : null}
              actionLabel={pickedVideo || video?.has_video ? t('vid_replace', 'Replace') : t('vid_choose_video', 'Choose video')}
              onAction={pickVideo}
              disabled={busy}
            />
            {phase === 'video' && <UploadProgress progress={progress} onCancel={cancelUpload} tk={tk} t={t} />}
            {video?.has_video && !pickedVideo && (
              <TouchableOpacity
                onPress={() => navigation.navigate('VideoPlayer', { videoId: video.id, video })}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44 }}
              >
                <ICONS.Play color={BLUE} size={16} />
                <Text style={{ color: BLUE, fontWeight: '900' }}>{t('vid_preview', 'Preview video')}</Text>
              </TouchableOpacity>
            )}
          </Section>

          {/* ── Thumbnail ── */}
          <Section title={t('vid_thumb', 'Thumbnail')} tk={tk} hint={t('vid_thumb_hint', 'Optional. A 16:9 image shown in the library.')}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <VideoThumb video={{ ...thumbPreview, category: form.category }} style={{ width: 140 }} radius={10} showPlay={false} />
              <TouchableOpacity onPress={pickThumb} disabled={busy} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tk.surfaceEl, borderRadius: 12, paddingHorizontal: 14, minHeight: 44, opacity: busy ? 0.5 : 1 }}>
                <ICONS.Image color={tk.textPrimary} size={18} />
                <Text style={{ fontWeight: '900', color: tk.textPrimary }}>
                  {video?.thumbnail_url || pickedThumb ? t('vid_change', 'Change') : t('vid_choose_image', 'Choose image')}
                </Text>
              </TouchableOpacity>
            </View>
            {phase === 'thumbnail' && <UploadProgress progress={progress} onCancel={cancelUpload} tk={tk} t={t} />}
          </Section>

          {/* ── Actions ── */}
          <View style={{ gap: 10 }}>
            {!video?.published && (
              <PrimaryButton
                label={t('vid_save_publish', 'Save & publish')}
                onPress={() => save({ publish: true })}
                disabled={busy || (!pickedVideo && !video?.has_video)}
                loading={busy && phase !== 'deleting'}
                tk={tk}
              />
            )}
            <SecondaryButton
              label={video?.published ? t('vid_save_changes', 'Save changes') : t('vid_save_draft', 'Save as draft')}
              onPress={() => save({ publish: false })}
              disabled={busy}
              tk={tk}
            />
            {phase === 'saving' && <Text style={{ textAlign: 'center', color: tk.textMuted }}>{t('vid_saving', 'Saving details…')}</Text>}
            {phase === 'publishing' && <Text style={{ textAlign: 'center', color: tk.textMuted }}>{t('vid_publishing', 'Updating…')}</Text>}
          </View>

          {!!video && (
            <Section title={t('vid_visibility', 'Visibility')} tk={tk}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Pill label={statusOf(video, t).label} color={statusOf(video, t).color} />
                {video.has_video && (
                  <TouchableOpacity onPress={togglePublished} disabled={busy} accessibilityRole="button"
                    style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', backgroundColor: video.published ? tk.surfaceEl : BLUE, opacity: busy ? 0.5 : 1 }}>
                    <Text style={{ fontWeight: '900', color: video.published ? tk.textPrimary : '#fff' }}>
                      {video.published ? t('vid_unpublish', 'Unpublish') : t('vid_publish', 'Publish')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={confirmDelete} disabled={busy} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 12, backgroundColor: '#EF44441A', marginTop: 6, opacity: busy ? 0.5 : 1 }}>
                {phase === 'deleting' ? <ActivityIndicator color="#EF4444" /> : <ICONS.Trash color="#EF4444" size={18} />}
                <Text style={{ color: '#EF4444', fontWeight: '900' }}>{t('vid_delete', 'Delete video')}</Text>
              </TouchableOpacity>
            </Section>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Small presentational pieces ──────────────────────────────────────────────

function Section({ title, hint, children, tk }) {
  return (
    <View style={{ backgroundColor: tk.surface, borderRadius: 18, padding: 16, gap: 14 }}>
      <View>
        <Text style={{ fontSize: 16, fontWeight: '900', color: tk.textPrimary }} accessibilityRole="header">{title}</Text>
        {!!hint && <Text style={{ fontSize: 12.5, color: tk.textMuted, marginTop: 3, lineHeight: 17 }}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function Field({ label, required, error, count, children, tk }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: tk.textSec }}>
          {label}{required ? <Text style={{ color: '#EF4444' }}> *</Text> : null}
        </Text>
        {!!count && <Text style={{ fontSize: 11.5, color: tk.textMuted }}>{count}</Text>}
      </View>
      {children}
      {!!error && <Text style={{ color: '#EF4444', fontSize: 12.5, fontWeight: '700' }} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}

function Input({ tk, multiline, style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={tk.textMuted}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[{
        backgroundColor: tk.bg, color: tk.textPrimary, borderRadius: 12, borderWidth: 1, borderColor: tk.border,
        paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: multiline ? 110 : 48,
      }, style]}
      {...props}
    />
  );
}

function FileRow({ icon, title, subtitle, actionLabel, onAction, disabled, tk }) {
  const Icon = ICONS[icon];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: BLUE + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Icon color={BLUE} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '800', color: tk.textPrimary }} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={{ fontSize: 12, color: tk.textMuted, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text>}
      </View>
      <TouchableOpacity onPress={onAction} disabled={disabled} accessibilityRole="button"
        style={{ backgroundColor: tk.surfaceEl, borderRadius: 12, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
        <Text style={{ fontWeight: '900', color: tk.textPrimary }}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function UploadProgress({ progress, onCancel, tk, t }) {
  const pct = Math.round(progress * 100);
  return (
    <View style={{ gap: 8 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', color: tk.textSec }}>
          {pct < 100 ? t('vid_uploading', 'Uploading… {pct}%').replace('{pct}', pct) : t('vid_verifying', 'Verifying upload…')}
        </Text>
        {pct < 100 && (
          <TouchableOpacity onPress={onCancel} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: '#EF4444', fontWeight: '900' }}>{t('btn_cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <ProgressBar fraction={progress} track={tk.surfaceEl} height={8} />
    </View>
  );
}

function Banner({ type, message, retry, disabled, tk, t }) {
  const color = type === 'success' ? '#10B981' : type === 'info' ? BLUE : '#EF4444';
  const Icon = type === 'success' ? ICONS.CheckCircle : type === 'info' ? ICONS.Info : ICONS.AlertCircle;
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: color + '1A' }}
      accessibilityLiveRegion="polite">
      <Icon color={color} size={20} />
      <Text style={{ flex: 1, color: tk.textPrimary, fontWeight: '600', lineHeight: 19 }}>{message}</Text>
      {!!retry && (
        <TouchableOpacity onPress={retry} disabled={disabled} accessibilityRole="button"
          style={{ backgroundColor: color, borderRadius: 10, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '900' }}>{t ? t('vid_retry', 'Retry') : 'Retry'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, loading }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled, busy: loading }}
      style={{ backgroundColor: BLUE, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{label}</Text>}
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress, disabled, tk }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={{ backgroundColor: tk.surfaceEl, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: tk.textPrimary, fontWeight: '900', fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}
