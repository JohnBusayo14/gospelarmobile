// screens/ChurchDirectoryScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Public directory of every registered church and its branches.
//   • Search by church / branch name or location text
//   • Filter chips built from the locations actually in the data
//   • "Open in Maps" hands the place to Google Maps (or the device's maps app)
//
// Data: GET /api/churches/directory (no auth). Locations are free text, so the
// chips group by the first comma-separated segment ("Lagos, phase one" → "Lagos").
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, StatusBar, Linking, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }    from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL } from '../context/SubscriptionContext';
import { getTokens }   from '../theme/tokens';
import { ICONS }       from '../components/icons';

const BLUE = '#1A56DB';

const titleCase = (s) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// "Lagos, phase one" → "Lagos"; empty → null
const areaOf = (loc) => {
  const first = String(loc || '').split(',')[0].trim();
  return first ? titleCase(first) : null;
};

// One row per place a user can visit: each branch, or the church itself when
// it has none recorded.
const flatten = (churches) => churches.flatMap((c) => {
  if (!c.branches?.length) {
    return [{ key: `c${c.id}`, church: c.name, branch: null, hq: false, location: c.location }];
  }
  return c.branches.map((b) => ({
    key:      `b${b.id}`,
    church:   c.name,
    branch:   b.is_headquarters && /^headquarters$/i.test(b.name) ? null : b.name,
    hq:       !!b.is_headquarters,
    location: b.location || c.location,
  }));
});

const mapsUrl = (p) => {
  const query = [p.church, p.branch, p.location].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export default function ChurchDirectoryScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);

  const [places,     setPlaces]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(false);
  const [query,      setQuery]      = useState('');
  const [area,       setArea]       = useState(null);   // null = All

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/churches/directory`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPlaces(flatten(await res.json()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const areas = useMemo(() => {
    const counts = new Map();
    for (const p of places) {
      const a = areaOf(p.location);
      if (a) counts.set(a, (counts.get(a) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [places]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p) => {
      if (area && areaOf(p.location) !== area) return false;
      if (!q) return true;
      return [p.church, p.branch, p.location].some((v) => v && v.toLowerCase().includes(q));
    });
  }, [places, query, area]);

  const openMaps = async (p) => {
    try {
      await Linking.openURL(mapsUrl(p));
    } catch {
      Alert.alert(t('dir_maps_error_title', 'Could not open Maps'),
                  t('dir_maps_error_msg', 'No maps app is available on this device.'));
    }
  };

  const Chip = ({ label, active, onPress, count }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.chip, { backgroundColor: active ? BLUE : tk.surfaceEl, borderColor: active ? BLUE : tk.border }]}
    >
      <Text style={[s.chipTxt, { color: active ? '#fff' : tk.textPrimary }]}>
        {label}{count != null ? `  ${count}` : ''}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item: p }) => (
    <View style={[s.card, { backgroundColor: tk.surface, borderColor: tk.border }]}>
      <View style={[s.cardIcon, { backgroundColor: BLUE + '18' }]}>
        <ICONS.Landmark color={BLUE} size={20} sw={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.cardTitle, { color: tk.textPrimary }]} numberOfLines={2}>{p.church}</Text>
        {!!p.branch && <Text style={[s.cardBranch, { color: tk.textSec }]} numberOfLines={1}>{p.branch}</Text>}
        {!!p.location && <Text style={[s.cardLoc, { color: tk.textMuted }]} numberOfLines={2}>📍 {p.location}</Text>}
        {p.hq && <Text style={s.hqTag}>{t('dir_headquarters', 'HEADQUARTERS')}</Text>}
      </View>
      <TouchableOpacity
        onPress={() => openMaps(p)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${t('dir_open_maps', 'Open in Maps')}: ${p.church}`}
        style={s.mapBtn}
      >
        <Text style={s.mapBtnTxt}>{t('dir_open_maps', 'Open in Maps')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tk.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <View style={s.topbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('back', 'Back')}
          style={[s.iconBtn, { backgroundColor: tk.surfaceEl }]}
        >
          <ICONS.ArrowLeft color={tk.textPrimary} size={18} sw={2.25} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: tk.textPrimary }]}>{t('dir_title', 'Find a Church')}</Text>
          <Text style={[s.sub, { color: tk.textMuted }]}>
            {loading ? ' ' : `${visible.length} ${visible.length === 1 ? t('dir_place', 'place') : t('dir_places', 'places')}`}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={[s.search, { backgroundColor: tk.surfaceEl, borderColor: tk.border }]}>
        <ICONS.Search color={tk.textMuted} size={16} sw={2.25} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('dir_search_ph', 'Search church, branch or location')}
          placeholderTextColor={tk.textMuted}
          style={[s.searchInput, { color: tk.textPrimary }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <ICONS.X color={tk.textMuted} size={16} sw={2.25} />
          </TouchableOpacity>
        )}
      </View>

      {/* Location filter chips */}
      {areas.length > 0 && (
        <View style={{ height: 46 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            <Chip label={t('dir_all', 'All')} active={!area} onPress={() => setArea(null)} />
            {areas.map(([a, n]) => (
              <Chip key={a} label={a} count={n} active={area === a} onPress={() => setArea(area === a ? null : a)} />
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={BLUE} /></View>
      ) : error ? (
        <View style={s.center}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>📡</Text>
          <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>{t('dir_error', 'Could not load churches')}</Text>
          <TouchableOpacity onPress={() => load()} activeOpacity={0.85} style={s.retry}>
            <Text style={s.retryTxt}>{t('btn_retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.key}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={BLUE} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>{t('dir_empty', 'No churches found')}</Text>
              <Text style={[s.sub, { color: tk.textMuted, textAlign: 'center' }]}>
                {t('dir_empty_hint', 'Try a different search or location.')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  topbar:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  iconBtn:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title:       { fontSize: 22, fontWeight: '900' },
  sub:         { fontSize: 12, fontWeight: '600' },
  search:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  chips:       { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  chip:        { paddingHorizontal: 14, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: 'center' },
  chipTxt:     { fontSize: 12, fontWeight: '700' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:  { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  retry:       { marginTop: 14, backgroundColor: BLUE, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 32 },
  retryTxt:    { color: '#fff', fontWeight: '800', fontSize: 14 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  cardIcon:    { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle:   { fontSize: 15, fontWeight: '800' },
  cardBranch:  { fontSize: 12, fontWeight: '600', marginTop: 1 },
  cardLoc:     { fontSize: 12, marginTop: 3 },
  hqTag:       { alignSelf: 'flex-start', marginTop: 5, fontSize: 9, fontWeight: '900', letterSpacing: 1, color: BLUE },
  mapBtn:      { backgroundColor: BLUE, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  mapBtnTxt:   { color: '#fff', fontSize: 11, fontWeight: '800' },
});
