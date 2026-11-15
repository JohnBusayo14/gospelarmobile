// screens/NotificationsScreen.jsx
// ─────────────────────────────────────────────────────────────────────────────
// In-app notification inbox: admin announcements, new videos / books, and
// personal updates (Premium activated, bank transfer confirmed…). Opened from
// the bell on the Library, or by tapping an announcement push with no link.
//
// Unread items (newer than the last visit) get a dot; opening the page marks
// everything seen. Shows a banner when phone notifications are switched off.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, StatusBar,
  RefreshControl, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useTheme }    from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getTokens }   from '../theme/tokens';
import { ICONS }       from '../components/icons';
import { fetchInbox, getReadState, isUnread, markAllSeen } from '../services/inbox';
import { openNotificationTarget } from '../services/notificationRouting';
import { registerForPush } from '../services/pushRegistration';

const BLUE = '#1A56DB';

const KIND_STYLE = {
  announcement: { Icon: ICONS.Bell,   color: BLUE },
  video_new:    { Icon: ICONS.Video,  color: '#DC2626' },
  book_new:     { Icon: ICONS.Book,   color: '#F97316' },
  book_update:  { Icon: ICONS.Book,   color: '#10B981' },
  payment:      { Icon: ICONS.Crown,  color: '#7C3AED' },
  account:      { Icon: ICONS.User,   color: '#0EA5E9' },
};

function timeAgo(iso, t) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)     return t('time_just_now', 'Just now');
  if (s < 3600)   return t('time_min_ago', '{n}m ago').replace('{n}', String(Math.floor(s / 60)));
  if (s < 86400)  return t('time_hr_ago', '{n}h ago').replace('{n}', String(Math.floor(s / 3600)));
  if (s < 604800) return t('time_day_ago', '{n}d ago').replace('{n}', String(Math.floor(s / 86400)));
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t }      = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);

  const [items, setItems]         = useState([]);
  const [readState, setReadState] = useState(null);   // snapshot from before this visit
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline]     = useState(false);
  const [permission, setPermission] = useState('granted');

  const load = useCallback(async () => {
    const r = await fetchInbox();
    setItems(r.items);
    setOffline(r.offline);
  }, []);

  useEffect(() => {
    (async () => {
      setReadState(await getReadState());   // keep the dots for this visit
      await load();
      setLoading(false);
      markAllSeen();
    })();
    Notifications.getPermissionsAsync()
      .then(({ status }) => setPermission(status))
      .catch(() => {});
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    markAllSeen();
  };

  const enablePush = async () => {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && canAskAgain === false) {
      Linking.openSettings().catch(() => {});
      return;
    }
    await registerForPush({ force: true });
    const after = await Notifications.getPermissionsAsync();
    setPermission(after.status);
  };

  const renderItem = ({ item }) => {
    const style  = KIND_STYLE[item.kind] || KIND_STYLE.announcement;
    const unread = readState ? isUnread(item, readState) : false;
    const hasLink = item.data && item.data.type && item.data.type !== 'inbox';
    return (
      <TouchableOpacity
        activeOpacity={hasLink ? 0.8 : 1}
        disabled={!hasLink}
        onPress={() => openNotificationTarget(navigation, { ...item.data, notificationId: item.id }, { fromInbox: true })}
        style={[s.card, {
          backgroundColor: unread ? (isDark ? BLUE + '1A' : BLUE + '0A') : tk.surface,
          borderColor: unread ? BLUE + '40' : tk.border,
        }]}
        accessibilityRole={hasLink ? 'button' : undefined}
      >
        <View style={[s.icon, { backgroundColor: style.color + '1A' }]}>
          <style.Icon color={style.color} size={18} sw={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={[s.title, { color: tk.textPrimary }]} numberOfLines={2}>{item.title}</Text>
            {unread && <View style={s.dot} />}
          </View>
          {!!item.body && <Text style={[s.body, { color: tk.textSec }]}>{item.body}</Text>}
          <View style={s.metaRow}>
            <Text style={[s.time, { color: tk.textMuted }]}>{timeAgo(item.created_at, t)}</Text>
            {hasLink && (
              <Text style={[s.open, { color: BLUE }]}>
                {item.data.type === 'url' ? t('notif_open_link', 'Open link') : t('notif_open', 'Open')} ›
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />
      <View style={[s.header, { borderBottomColor: tk.border }]}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Library'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[s.iconBtn, { backgroundColor: tk.surfaceEl }]}
        >
          <ICONS.ArrowLeft color={tk.textPrimary} size={18} sw={2.4} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: tk.textPrimary }]}>{t('notifications', 'Notifications')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('notif_settings', 'Notification settings')}
          style={[s.iconBtn, { backgroundColor: tk.surfaceEl }]}
        >
          <ICONS.Settings color={tk.textPrimary} size={18} sw={2.25} />
        </TouchableOpacity>
      </View>

      {permission !== 'granted' && Platform.OS !== 'web' && (
        <TouchableOpacity onPress={enablePush} activeOpacity={0.85} style={[s.permBanner, { borderColor: '#F59E0B66' }]}>
          <ICONS.Bell color="#B45309" size={18} sw={2.25} />
          <View style={{ flex: 1 }}>
            <Text style={s.permTitle}>{t('notif_off_title', 'Phone notifications are off')}</Text>
            <Text style={s.permBody}>{t('notif_off_body', 'Turn them on to hear about new videos, books and announcements.')}</Text>
          </View>
          <Text style={s.permBtn}>{t('notif_turn_on', 'Turn on')}</Text>
        </TouchableOpacity>
      )}

      {offline && !loading && (
        <Text style={[s.offline, { color: tk.textMuted }]}>
          {t('notif_offline', "You're offline — showing saved notifications.")}
        </Text>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={BLUE} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} colors={[BLUE]} />}
          ListEmptyComponent={(
            <View style={s.center}>
              <View style={[s.emptyIcon, { backgroundColor: tk.surfaceEl }]}>
                <ICONS.Bell color={tk.textMuted} size={28} sw={2} />
              </View>
              <Text style={[s.emptyTitle, { color: tk.textPrimary }]}>{t('notif_empty_title', "You're all caught up")}</Text>
              <Text style={[s.emptyBody, { color: tk.textMuted }]}>
                {t('notif_empty_body', 'Announcements, new videos and book updates will show up here.')}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  iconBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  permBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 0, padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: '#FFFBEB' },
  permTitle:   { fontSize: 13.5, fontWeight: '800', color: '#92400E' },
  permBody:    { fontSize: 12, fontWeight: '500', color: '#92400E', marginTop: 1 },
  permBtn:     { fontSize: 13, fontWeight: '900', color: '#B45309' },
  offline:     { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 12 },

  card:        { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  icon:        { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title:       { flex: 1, fontSize: 14.5, fontWeight: '800', lineHeight: 19 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginTop: 6 },
  body:        { fontSize: 13, lineHeight: 19, marginTop: 4 },
  metaRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  time:        { fontSize: 11.5, fontWeight: '600' },
  open:        { fontSize: 12, fontWeight: '800' },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:   { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle:  { fontSize: 17, fontWeight: '900', marginBottom: 6 },
  emptyBody:   { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 280 },
});
