// screen/videos/VideoLibraryScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Video Library — every signed-in user. Lists PUBLISHED Sunday School videos
// (the server never returns drafts here) with search, category / age filters,
// newest/oldest sort, pull-to-refresh, infinite scroll and a "Continue
// watching" row. Admins additionally see a "Manage" button; that's purely a
// convenience — every admin endpoint is enforced server-side.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTokens } from '../../theme/tokens';
import { ICONS } from '../../components/icons';
import { SkeletonList } from '../../components/FetchStates';
import { fetchVideoMeta, fetchVideos, fetchRecentVideos } from '../../services/videos';
import {
  BLUE, ScreenHeader, Chip, Pill, VideoThumb, ProgressBar, SessionExpiredState,
  InlineNotice, ageLabel, categoryAccent, formatDuration, s as shared,
} from './videoShared';

const PAGE_SIZE = 20;

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

const progressFraction = (video) => {
  const p = video.progress;
  if (!p) return 0;
  if (p.completed) return 1;
  return video.duration_seconds ? p.position_seconds / video.duration_seconds : 0;
};

// ── Cards ────────────────────────────────────────────────────────────────────
function VideoCard({ video, onPress, tk, t, style }) {
  const accent = categoryAccent(video.category);
  const frac = progressFraction(video);
  return (
    <TouchableOpacity
      onPress={() => onPress(video)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${video.title}. ${video.category}. ${ageLabel(video.age_group, t)}`}
      accessibilityHint={t('vid_open_hint', 'Opens the video player')}
      style={[{ backgroundColor: tk.surface, borderRadius: 18, overflow: 'hidden' }, style]}
    >
      <VideoThumb video={video} radius={0}>
        {!!video.duration_seconds && (
          <View style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>{formatDuration(video.duration_seconds)}</Text>
          </View>
        )}
        {frac > 0 && (
          <ProgressBar fraction={frac} color={video.progress?.completed ? '#10B981' : BLUE} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />
        )}
      </VideoThumb>
      <View style={{ padding: 14, gap: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: tk.textPrimary, letterSpacing: -0.2 }} numberOfLines={2}>
          {video.title}
        </Text>
        {!!video.bible_reference && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ICONS.Book color={accent} size={14} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: accent }} numberOfLines={1}>{video.bible_reference}</Text>
          </View>
        )}
        {!!video.description && (
          <Text style={{ fontSize: 13, lineHeight: 19, color: tk.textSec }} numberOfLines={2}>{video.description}</Text>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          <Pill label={video.category} color={accent} />
          <Pill label={ageLabel(video.age_group, t)} color={tk.textSec} />
          {video.progress?.completed && <Pill label={t('vid_watched', 'Watched')} color="#10B981" />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function RecentCard({ video, onPress, tk }) {
  return (
    <TouchableOpacity
      onPress={() => onPress(video)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={video.title}
      style={{ width: 200 }}
    >
      <VideoThumb video={video} radius={12}>
        <ProgressBar fraction={progressFraction(video)} color={video.progress?.completed ? '#10B981' : BLUE} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />
      </VideoThumb>
      <Text style={{ fontSize: 13, fontWeight: '800', color: tk.textPrimary, marginTop: 6 }} numberOfLines={2}>{video.title}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function VideoLibraryScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { width } = useWindowDimensions();
  const numColumns = width >= 720 ? 2 : 1;   // tablets / landscape get a grid

  const [meta, setMeta] = useState(null);
  const [recent, setRecent] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim(), 350);
  const [category, setCategory] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [sort, setSort] = useState('newest');

  const [items, setItems] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [status, setStatus] = useState('loading');   // loading | ready | error
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const requestId = useRef(0);

  const handleError = useCallback((e) => {
    if (e?.code === 'session_expired') setSessionExpired(true);
    return e;
  }, []);

  const loadMeta = useCallback(() => {
    fetchVideoMeta().then(setMeta).catch(handleError);
  }, [handleError]);

  const loadRecent = useCallback(() => {
    fetchRecentVideos().then((r) => setRecent(r.items || [])).catch(() => { /* optional row */ });
  }, []);

  const loadFirstPage = useCallback(async ({ refresh = false } = {}) => {
    const id = ++requestId.current;
    if (refresh) setRefreshing(true); else setStatus('loading');
    setError(null);
    try {
      const page = await fetchVideos({ search: debouncedSearch, category, ageGroup, sort, offset: 0, limit: PAGE_SIZE });
      if (id !== requestId.current) return;   // a newer filter change won the race
      setItems(page.items || []);
      setNextOffset(page.next_offset);
      setStatus('ready');
    } catch (e) {
      if (id !== requestId.current) return;
      setError(handleError(e));
      setStatus('error');
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, [debouncedSearch, category, ageGroup, sort, handleError]);

  const loadMore = useCallback(async () => {
    if (nextOffset == null || loadingMore || status !== 'ready') return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchVideos({ search: debouncedSearch, category, ageGroup, sort, offset: nextOffset, limit: PAGE_SIZE });
      if (id !== requestId.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...(page.items || []).filter((v) => !seen.has(v.id))];
      });
      setNextOffset(page.next_offset);
    } catch (e) {
      handleError(e);   // keep what we have; the next scroll retries
    } finally {
      setLoadingMore(false);
    }
  }, [nextOffset, loadingMore, status, debouncedSearch, category, ageGroup, sort, handleError]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);
  // Refresh "Continue watching" whenever we come back from the player.
  useEffect(() => navigation.addListener('focus', loadRecent), [navigation, loadRecent]);

  const onRefresh = () => {
    loadMeta();
    loadRecent();
    loadFirstPage({ refresh: true });
  };

  const openVideo = (video) => navigation.navigate('VideoPlayer', { videoId: video.id, video });
  const filtersActive = !!(debouncedSearch || category || ageGroup);

  if (sessionExpired) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
        <ScreenHeader title={t('vid_library_title', 'Video Library')} onBack={() => navigation.goBack()} tk={tk} t={t} />
        <SessionExpiredState navigation={navigation} tk={tk} t={t} />
      </SafeAreaView>
    );
  }

  const manageButton = meta?.can_manage ? (
    <TouchableOpacity
      onPress={() => navigation.navigate('VideoAdmin')}
      accessibilityRole="button"
      accessibilityLabel={t('vid_manage', 'Upload and manage videos')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BLUE, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 }}
    >
      <ICONS.Upload color="#fff" size={16} />
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{t('vid_manage_short', 'Manage')}</Text>
    </TouchableOpacity>
  ) : null;

  const listHeader = (
    !filtersActive && recent.length > 0 ? (
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: tk.textPrimary, paddingHorizontal: 20, marginBottom: 10 }}>
          {t('vid_continue', 'Continue watching')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {recent.map((v) => <RecentCard key={v.id} video={v} onPress={openVideo} tk={tk} />)}
        </ScrollView>
        <Text style={{ fontSize: 16, fontWeight: '900', color: tk.textPrimary, paddingHorizontal: 20, marginTop: 20 }}>
          {t('vid_all_videos', 'All videos')}
        </Text>
      </View>
    ) : null
  );

  let listEmpty = null;
  if (status === 'loading') listEmpty = <SkeletonList count={3} T={{ card: tk.surface, border: tk.border, divider: tk.surfaceEl }} />;
  else if (status === 'error') {
    listEmpty = (
      <InlineNotice
        icon="AlertTriangle" color="#EF4444" tk={tk}
        title={t('vid_load_error', "Couldn't load videos")}
        message={error?.message}
        actionLabel={t('fetch_try_again', 'Try Again')}
        onAction={() => loadFirstPage()}
      />
    );
  } else if (filtersActive) {
    listEmpty = (
      <InlineNotice
        icon="Search" tk={tk}
        title={t('vid_no_matches', 'No matching videos')}
        message={t('vid_no_matches_msg', 'Try a different search or clear the filters.')}
        actionLabel={t('vid_clear_filters', 'Clear filters')}
        onAction={() => { setSearch(''); setCategory(''); setAgeGroup(''); }}
      />
    );
  } else {
    listEmpty = (
      <InlineNotice
        icon="Video" tk={tk}
        title={t('vid_empty_title', 'No videos yet')}
        message={t('vid_empty_msg', 'New Sunday School videos will appear here as soon as they are published.')}
      />
    );
  }

  const ageOptions = ['', ...(meta?.age_groups || ['children', 'teens', 'adults', 'all'])];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      <ScreenHeader
        title={t('vid_library_title', 'Video Library')}
        subtitle={t('vid_library_sub', 'Bible stories, lessons and worship')}
        onBack={() => navigation.goBack()}
        right={manageButton}
        tk={tk} t={t}
      />

      {/* Search — outside the FlatList so the keyboard never loses focus on re-render */}
      <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tk.surface, borderRadius: 14, paddingHorizontal: 14, minHeight: 46 }}>
          <ICONS.Search color={tk.textMuted} size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('vid_search_ph', 'Search videos')}
            placeholderTextColor={tk.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel={t('vid_search_ph', 'Search videos')}
            style={{ flex: 1, color: tk.textPrimary, fontSize: 15, paddingVertical: 10 }}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('vid_clear_search', 'Clear search')}>
              <ICONS.X color={tk.textMuted} size={18} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 8 }}>
        <Chip label={t('vid_all_categories', 'All categories')} active={!category} onPress={() => setCategory('')} tk={tk} />
        {(meta?.categories || []).map((c) => (
          <Chip key={c} label={c} active={category === c} onPress={() => setCategory(category === c ? '' : c)} tk={tk} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12, alignItems: 'center' }}>
        {ageOptions.map((ag) => (
          <Chip key={ag || 'any'} label={ag ? ageLabel(ag, t) : t('vid_any_age', 'Any age')} active={ageGroup === ag} onPress={() => setAgeGroup(ag)} tk={tk} />
        ))}
        <View style={{ width: 1, height: 24, backgroundColor: tk.border, marginHorizontal: 4 }} />
        <TouchableOpacity
          onPress={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
          accessibilityRole="button"
          accessibilityLabel={t('vid_sort_label', 'Sort order')}
          accessibilityValue={{ text: sort === 'newest' ? t('vid_sort_newest', 'Newest first') : t('vid_sort_oldest', 'Oldest first') }}
          style={[shared.chip, { backgroundColor: tk.surfaceEl, borderColor: tk.surfaceEl, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
        >
          <ICONS.Clock color={tk.textPrimary} size={14} />
          <Text style={[shared.chipTxt, { color: tk.textPrimary }]}>
            {sort === 'newest' ? t('vid_sort_newest', 'Newest first') : t('vid_sort_oldest', 'Oldest first')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <FlatList
        key={`cols-${numColumns}`}
        data={status === 'ready' ? items : []}
        keyExtractor={(v) => v.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? { gap: 14, paddingHorizontal: 20 } : undefined}
        renderItem={({ item }) => (
          <VideoCard
            video={item} onPress={openVideo} tk={tk} t={t}
            style={numColumns > 1 ? { flex: 1, marginBottom: 14 } : { marginHorizontal: 20, marginBottom: 14 }}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={BLUE} style={{ marginVertical: 16 }} /> : <View style={{ height: 32 }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} colors={[BLUE]} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}
