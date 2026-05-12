// screen/victory/VictoryAudioRoomList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Discover audio prayer rooms — live (scheduled), recorded (always available),
// and "My rooms" (anything the user has created on this device). Each card
// uses its own gradient palette so they're instantly recognisable. Tapping a
// card routes to the room screen; a + FAB launches the create-room flow.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }    from '../../context/ThemeContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry, useStaggerEntry } from '../../hooks/useFluidAnim';
import {
  GlassCard, BackBar, Eyebrow, SectionHead, Chip, EmptyState,
} from './VictoryUI';
import { BLUE, RADII, AMBIENT_SHADOW, victoryTones } from './victoryTheme';
import VictoryBackdrop from './VictoryBackdrop';
import { AUDIO_ROOMS, allLive, allRecorded } from './victoryAudioData';
import { useUserRooms } from './victoryHooks';

const FILTERS = ['All', 'Live', 'Recorded', 'My rooms'];

export default function VictoryAudioRoomList({ navigation }) {
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const [filter, setFilter] = useState('All');

  const { list: userRooms, remove: removeUserRoom } = useUserRooms();

  const live      = useMemo(() => allLive(userRooms),     [userRooms]);
  const recorded  = useMemo(() => allRecorded(userRooms), [userRooms]);
  const mine      = useMemo(() => userRooms || [],         [userRooms]);

  const showLive     = filter === 'All' || filter === 'Live';
  const showRecorded = filter === 'All' || filter === 'Recorded';
  const showMine     = filter === 'All' || filter === 'My rooms';

  const handleDelete = (room) => {
    Alert.alert(
      'Delete this room?',
      `"${room.title}" will be removed from your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeUserRoom(room.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <VictoryBackdrop isDark={isDark} intensity={0.6} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        style={{ opacity: fade, transform: [{ translateY }] }}
      >
        <BackBar
          onBack={() => navigation.goBack()}
          eyebrow="VICTORY MONTH"
          title="Audio Prayer Rooms"
          tones={tones}
          tk={tk}
          right={
            <TouchableOpacity
              onPress={() => navigation.navigate('VictoryCreateRoom')}
              activeOpacity={0.8}
              style={{
                width: 42, height: 42, borderRadius: 999,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: tones.chipBg,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '900', color: tones.chipFg, marginTop: -2 }}>＋</Text>
            </TouchableOpacity>
          }
        />

        {/* Hero */}
        <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
          <GlassCard tones={tones} padding={18}>
            <Eyebrow color={tones.chipFg}>GATHER IN PRAYER</Eyebrow>
            <Text style={[s.heroTitle, { color: tk.textPrimary }]}>
              Pray with a community at any hour
            </Text>
            <Text style={[s.heroBody, { color: tk.textSec }]}>
              Live rooms are hosted at scheduled times. Recorded rooms are guided sessions you can join at your own pace. Tap ＋ to start your own.
            </Text>
            <View style={s.heroStats}>
              <StatPill emoji="🔴" label={`${live.length} live`} />
              <StatPill emoji="📼" label={`${recorded.length} recorded`} />
              <StatPill emoji="✨" label={`${mine.length} of yours`} />
            </View>
          </GlassCard>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 16 }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={f}
              active={filter === f}
              onPress={() => setFilter(f)}
              bg={tones.chipBg}
              fg={tones.chipFg}
            />
          ))}
        </ScrollView>

        {/* My rooms */}
        {showMine && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <SectionHead
              tk={tk}
              tones={tones}
              eyebrow="HOSTED BY YOU"
              title="My rooms"
              action="Create"
              onAction={() => navigation.navigate('VictoryCreateRoom')}
            />
            {mine.length === 0 ? (
              <EmptyState
                emoji="🛐"
                title="You haven't created a room yet"
                body="Start a midnight watch, a thanksgiving circle or a quick breakthrough room. Anyone with the app can join."
                action="Create my first room"
                onAction={() => navigation.navigate('VictoryCreateRoom')}
                tones={tones}
                tk={tk}
              />
            ) : (
              <View style={{ gap: 12 }}>
                {mine.map((r, i) => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    index={i}
                    tk={tk}
                    tones={tones}
                    onPress={() => navigation.navigate('VictoryAudioRoom', { id: r.id })}
                    onLongPress={() => handleDelete(r)}
                    showOwnedBadge
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Live */}
        {showLive && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <SectionHead
              tk={tk}
              tones={tones}
              eyebrow="LIVE TODAY"
              title="Scheduled gatherings"
            />
            <View style={{ gap: 12 }}>
              {live.map((r, i) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  index={i}
                  tk={tk}
                  tones={tones}
                  onPress={() => navigation.navigate('VictoryAudioRoom', { id: r.id })}
                  onLongPress={r.owned ? () => handleDelete(r) : undefined}
                  showOwnedBadge={!!r.owned}
                />
              ))}
            </View>
          </View>
        )}

        {/* Recorded */}
        {showRecorded && (
          <View style={{ paddingHorizontal: 20 }}>
            <SectionHead
              tk={tk}
              tones={tones}
              eyebrow="ANYTIME"
              title="Recorded sessions"
            />
            <View style={{ gap: 12 }}>
              {recorded.map((r, i) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  index={i}
                  tk={tk}
                  tones={tones}
                  onPress={() => navigation.navigate('VictoryAudioRoom', { id: r.id })}
                  onLongPress={r.owned ? () => handleDelete(r) : undefined}
                  showOwnedBadge={!!r.owned}
                />
              ))}
            </View>
          </View>
        )}
      </Animated.ScrollView>

      {/* Floating action button — quick create */}
      <TouchableOpacity
        onPress={() => navigation.navigate('VictoryCreateRoom')}
        activeOpacity={0.86}
        style={s.fabWrap}
      >
        <LinearGradient
          colors={[BLUE[700], BLUE[500]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.fab}
        >
          <Text style={s.fabPlus}>＋</Text>
          <Text style={s.fabLbl}>Create room</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const StatPill = ({ emoji, label }) => (
  <View style={s.statPill}>
    <Text style={{ fontSize: 13 }}>{emoji}</Text>
    <Text style={s.statPillTxt}>{label}</Text>
  </View>
);

const RoomCard = ({ room, index, tk, tones, onPress, onLongPress, showOwnedBadge }) => {
  const { fade, translateY } = useStaggerEntry(Math.min(index, 6));
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.86}
        delayLongPress={400}
      >
        <LinearGradient
          colors={room.gradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.card, AMBIENT_SHADOW]}
        >
          {/* Decorative orbs */}
          <View style={[s.orb, { top: -22, right: -16 }]} />
          <View style={[s.orb, { bottom: -28, left: -20, opacity: 0.4 }]} />

          <View style={s.cardHead}>
            <View style={s.cardTag}>
              <Text style={s.cardTagTxt}>
                {room.kind === 'live' ? '🔴  LIVE' : '📼  RECORDED'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {showOwnedBadge && (
                <View style={s.ownTag}>
                  <Text style={s.ownTagTxt}>YOURS</Text>
                </View>
              )}
              <Text style={s.cardCategory}>{room.category}</Text>
            </View>
          </View>
          <Text style={s.cardTitle} numberOfLines={2}>{room.title}</Text>
          {!!room.scripture && (
            <Text style={s.cardScripture}>📖  {room.scripture}</Text>
          )}

          <View style={s.cardMetaRow}>
            <Meta label="Host"        value={room.host} />
            <Meta label="Duration"    value={`${room.duration_min}m`} />
            <Meta
              label={room.kind === 'live' ? 'Starts' : 'Length'}
              value={room.kind === 'live' ? (room.scheduled_at || '—') : `${room.duration_min}m`}
            />
          </View>

          <View style={s.cardFootRow}>
            <View style={s.participants}>
              <Text style={s.participantsDot}>●</Text>
              <Text style={s.participantsTxt}>
                {Number(room.participants_simulated || 0).toLocaleString()} praying
              </Text>
            </View>
            <View style={s.cardCta}>
              <Text style={s.cardCtaTxt}>
                {room.kind === 'live' ? 'Join room  →' : 'Listen  →'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const Meta = ({ label, value }) => (
  <View style={{ flex: 1 }}>
    <Text style={s.metaLbl}>{label.toUpperCase()}</Text>
    <Text style={s.metaVal} numberOfLines={1}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  heroTitle: { fontSize: 19, fontWeight: '900', lineHeight: 25, letterSpacing: -0.3, marginTop: 6 },
  heroBody:  { fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 6 },
  heroStats: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  statPill:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADII.pill, backgroundColor: 'rgba(26, 86, 219, 0.10)',
  },
  statPillTxt: { fontSize: 11, fontWeight: '900', color: BLUE[700], letterSpacing: 0.3 },

  card:        { padding: 20, borderRadius: RADII.lg, overflow: 'hidden' },
  orb:         { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.16)' },
  cardHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTag:     {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cardTagTxt:  { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#fff' },
  ownTag:      {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  ownTagTxt:   { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, color: '#1E3A8A' },
  cardCategory:{ fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: 'rgba(255,255,255,0.78)' },
  cardTitle:   { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4, lineHeight: 27 },
  cardScripture:{ fontSize: 12.5, fontWeight: '800', color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  cardMetaRow: { flexDirection: 'row', marginTop: 16, paddingTop: 14, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  metaLbl:     { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4, color: 'rgba(255,255,255,0.72)' },
  metaVal:     { fontSize: 13, fontWeight: '800', color: '#fff', marginTop: 3 },
  cardFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  participants:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantsDot: { fontSize: 10, color: '#34D399' },
  participantsTxt: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.92)' },
  cardCta:     {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  cardCtaTxt:  { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

  fabWrap:     {
    position: 'absolute', right: 18, bottom: 22,
    shadowColor: BLUE[700], shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 18, elevation: 8,
  },
  fab:         {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 13, borderRadius: 999,
  },
  fabPlus:     { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: -2 },
  fabLbl:      { color: '#fff', fontSize: 13.5, fontWeight: '900', letterSpacing: 0.4 },
});
