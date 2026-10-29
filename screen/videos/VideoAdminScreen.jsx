// screen/videos/VideoAdminScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin: every video including drafts and incomplete uploads, with quick
// publish / unpublish / delete. Reached from the Video Library's "Manage"
// button, which only renders when /api/videos/meta says can_manage — but all
// of /api/admin/videos/* is enforced by superAdminAuth on the server, so a
// non-admin who navigates here anyway just gets a permission notice.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import { SkeletonList } from '../../components/FetchStates';
import {
  fetchAdminVideos, setVideoPublished, deleteVideo, formatBytes,
} from '../../services/videos';
import {
  BLUE, ScreenHeader, Chip, Pill, VideoThumb, InlineNotice, SessionExpiredState,
} from './videoShared';

const PAGE_SIZE = 20;

export function statusOf(video, t) {
  if (!video.has_video) {
    return video.upload_pending
      ? { label: t('vid_status_incomplete', 'Upload incomplete'), color: '#EF4444' }
      : { label: t('vid_status_nofile', 'No video file'), color: '#EF4444' };
  }
  return video.published
    ? { label: t('vid_status_published', 'Published'), color: '#10B981' }
    : { label: t('vid_status_draft', 'Draft'), color: '#F59E0B' };
}

function AdminRow({ video, onOpen, onTogglePublish, onDelete, busy, tk, t }) {
  const st = statusOf(video, t);
  return (
    <View style={{ backgroundColor: tk.surface, borderRadius: 16, padding: 12, marginHorizontal: 20, marginBottom: 12, gap: 10 }}>
      <TouchableOpacity
        onPress={() => onOpen(video)}
        accessibilityRole="button"
        accessibilityLabel={`${t('btn_edit', 'Edit')} ${video.title}. ${st.label}`}
        style={{ flexDirection: 'row', gap: 12 }}
      >
        <VideoThumb video={video} style={{ width: 112 }} radius={10} showPlay={false} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: tk.textPrimary }} numberOfLines={2}>{video.title}</Text>
          <Text style={{ fontSize: 12, color: tk.textMuted, fontWeight: '600' }} numberOfLines={1}>
            {video.category}{video.file_size_bytes ? ` · ${formatBytes(video.file_size_bytes)}` : ''}
          </Text>
          <Pill label={st.label} color={st.color} />
        </View>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={() => onTogglePublish(video)}
          disabled={busy || !video.has_video}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || !video.has_video }}
          style={{ flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                   backgroundColor: video.published ? tk.surfaceEl : BLUE, opacity: busy || !video.has_video ? 0.5 : 1 }}
        >
          <Text style={{ fontWeight: '900', fontSize: 13, color: video.published ? tk.textPrimary : '#fff' }}>
            {video.published ? t('vid_unpublish', 'Unpublish') : t('vid_publish', 'Publish')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onOpen(video)}
          accessibilityRole="button"
          accessibilityLabel={t('btn_edit', 'Edit')}
          style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tk.surfaceEl }}
        >
          <ICONS.Edit color={tk.textPrimary} size={18} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(video)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('vid_delete', 'Delete video')}
          style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF44441F', opacity: busy ? 0.5 : 1 }}
        >
          {busy ? <ActivityIndicator color="#EF4444" /> : <ICONS.Trash color="#EF4444" size={18} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function VideoAdminScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);

  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async ({ refresh = false, silent = false } = {}) => {
    const id = ++requestId.current;
    if (refresh) setRefreshing(true); else if (!silent) setStatus('loading');
    try {
      const page = await fetchAdminVideos({ status: filter, offset: 0, limit: PAGE_SIZE });
      if (id !== requestId.current) return;
      setItems(page.items || []);
      setNextOffset(page.next_offset);
      setError(null);
      setStatus('ready');
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e);
      setStatus('error');
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, [filter]);

  const loadMore = async () => {
    if (nextOffset == null || loadingMore || status !== 'ready') return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchAdminVideos({ status: filter, offset: nextOffset, limit: PAGE_SIZE });
      if (id !== requestId.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...(page.items || []).filter((v) => !seen.has(v.id))];
      });
      setNextOffset(page.next_offset);
    } catch { /* next scroll retries */ } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(); }, [load]);
  // Pick up edits made on the edit screen.
  const firstFocus = useRef(true);
  useEffect(() => navigation.addListener('focus', () => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    load({ silent: true });
  }), [navigation, load]);

  const replaceItem = (updated) => setItems((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

  const togglePublish = async (video) => {
    setBusyId(video.id);
    try {
      replaceItem(await setVideoPublished(video.id, !video.published));
    } catch (e) {
      Alert.alert(t('vid_action_failed', 'Action failed'), e.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (video) => {
    Alert.alert(
      t('vid_delete_title', 'Delete this video?'),
      t('vid_delete_msg', '"{title}" and its files will be permanently deleted. This cannot be undone.').replace('{title}', video.title),
      [
        { text: t('btn_cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('btn_delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(video.id);
            try {
              await deleteVideo(video.id);
              setItems((prev) => prev.filter((v) => v.id !== video.id));
            } catch (e) {
              Alert.alert(t('vid_delete_failed', "Couldn't delete"), e.message, [
                { text: t('btn_cancel', 'Cancel'), style: 'cancel' },
                { text: t('fetch_try_again', 'Try Again'), onPress: () => confirmDelete(video) },
              ]);
              load({ silent: true });   // it may have been unpublished
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  if (error?.code === 'session_expired') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
        <ScreenHeader title={t('vid_admin_title', 'Manage Videos')} onBack={() => navigation.goBack()} tk={tk} t={t} />
        <SessionExpiredState navigation={navigation} tk={tk} t={t} />
      </SafeAreaView>
    );
  }

  let empty = null;
  if (status === 'loading') empty = <SkeletonList count={3} T={{ card: tk.surface, border: tk.border, divider: tk.surfaceEl }} />;
  else if (status === 'error' && error?.code === 'forbidden') {
    empty = <InlineNotice icon="Lock" tk={tk} title={t('vid_admin_only', 'Administrators only')} message={t('vid_admin_only_msg', "Your account doesn't have permission to manage videos.")} />;
  } else if (status === 'error') {
    empty = <InlineNotice icon="AlertTriangle" color="#EF4444" tk={tk} title={t('vid_load_error', "Couldn't load videos")} message={error?.message} actionLabel={t('fetch_try_again', 'Try Again')} onAction={() => load()} />;
  } else {
    empty = <InlineNotice icon="Upload" tk={tk} title={t('vid_admin_empty', 'No videos here yet')} message={t('vid_admin_empty_msg', 'Tap "New video" to upload your first lesson.')} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      <ScreenHeader
        title={t('vid_admin_title', 'Manage Videos')}
        subtitle={t('vid_admin_sub', 'Drafts and published lessons')}
        onBack={() => navigation.goBack()}
        right={error?.code === 'forbidden' ? null : (
          <TouchableOpacity
            onPress={() => navigation.navigate('VideoEdit')}
            accessibilityRole="button"
            accessibilityLabel={t('vid_new', 'New video')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BLUE, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 }}
          >
            <ICONS.Plus color="#fff" size={16} />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{t('vid_new', 'New video')}</Text>
          </TouchableOpacity>
        )}
        tk={tk} t={t}
      />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
        {[['all', t('vid_filter_all', 'All')], ['draft', t('vid_filter_drafts', 'Drafts')], ['published', t('vid_filter_published', 'Published')]].map(([key, label]) => (
          <Chip key={key} label={label} active={filter === key} onPress={() => setFilter(key)} tk={tk} />
        ))}
      </View>
      <FlatList
        data={status === 'ready' ? items : []}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <AdminRow
            video={item} busy={busyId === item.id} tk={tk} t={t}
            onOpen={(v) => navigation.navigate('VideoEdit', { videoId: v.id })}
            onTogglePublish={togglePublish}
            onDelete={confirmDelete}
          />
        )}
        ListEmptyComponent={empty}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={BLUE} style={{ marginVertical: 16 }} /> : <View style={{ height: 32 }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={BLUE} colors={[BLUE]} />}
      />
    </SafeAreaView>
  );
}
