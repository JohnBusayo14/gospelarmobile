// screen/victory/VictoryAudioRoom.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Immersive "you are inside the room" view.
//
// What's live:
//   • Animated "speaking now" rings + rotating active speaker
//   • Mic mute toggle with simulated voice-level meter when un-muted
//   • Raise-hand queue that grows as the user and mock participants raise hands
//   • Live prayer chat — mock amens stream in; the user can send a message
//   • Floating reactions (🙏 ✋ 🕊️ 🔥 ❤️) — tap to send, others arrive on a drift
//   • Ambient sound picker with "Playing softly" indicator
//   • Confirmation prompt on leave; logs duration to the achievements engine
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Easing, Dimensions, Alert, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme }    from '../../context/ThemeContext';
import { getTokens }   from '../../theme/tokens';
import { useScreenEntry } from '../../hooks/useFluidAnim';
import {
  GlassCard, BackBar, Eyebrow, CelebrateOverlay, IconButton,
} from './VictoryUI';
import {
  BLUE, EMERALD, AMBER, ROSE, RADII, AMBIENT_SHADOW, victoryTones,
} from './victoryTheme';
import { getRoom, AMBIENT_TRACKS } from './victoryAudioData';
import { logRoomVisit, addTotalSeconds } from './victoryStore';
import {
  useAudioSettings, useAchievementsHook, useUserRooms,
} from './victoryHooks';
import { BADGE_BY_ID } from './victoryAchievements';
import { RichVerseText } from '../../components/BibleVerseLink';

const { width: W } = Dimensions.get('window');

// Synthetic participant strip — avatars + initials, used by the bottom bar.
const PARTICIPANTS = [
  { name: 'Tola',     emoji: '🙏', accent: '#1A56DB' },
  { name: 'Bola',     emoji: '✝️', accent: '#4F46E5' },
  { name: 'Grace',    emoji: '🕊️', accent: '#10B981' },
  { name: 'Pst Sam',  emoji: '🎙️', accent: '#F59E0B' },
  { name: 'Daniel',   emoji: '🔥', accent: '#DC2626' },
  { name: 'Esther',   emoji: '🌿', accent: '#0F766E' },
  { name: 'Joshua',   emoji: '⚔️', accent: '#7C3AED' },
  { name: 'Mary',     emoji: '🌟', accent: '#0EA5E9' },
];

// Stock prayer-chat messages — cycled and lightly randomised so the room
// always feels populated. Anonymous "amen" beats get mixed in between.
const MOCK_LINES = [
  'Father, we thank You for this gathering 🙏',
  'Cover every home represented in this room',
  'Amen 🙏',
  'I receive my breakthrough in Jesus name',
  'Healing flows tonight',
  'Pray for my mum, she\'s in surgery tomorrow',
  'Glory to God!',
  'Hallelujah 🔥',
  'Send revival to GOFAMINT worldwide',
  'I forgive everyone who has hurt me',
  'Praying for jobs for the unemployed',
  'Open doors that no man can shut',
  'Amen and amen 🕊️',
  'My family is covered by the blood',
  'God is moving in this room ✨',
];

const REACTIONS = [
  { id: 'pray',  emoji: '🙏', color: '#FBBF24' },
  { id: 'fire',  emoji: '🔥', color: '#F97316' },
  { id: 'dove',  emoji: '🕊️', color: '#93C5FD' },
  { id: 'love',  emoji: '❤️', color: '#FB7185' },
  { id: 'amen',  emoji: '✋', color: '#A78BFA' },
];

export default function VictoryAudioRoom({ route, navigation }) {
  const id = route?.params?.id;
  const { isDark } = useTheme();
  const tk    = useMemo(() => getTokens(isDark), [isDark]);
  const tones = useMemo(() => victoryTones(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();
  const { list: userRooms } = useUserRooms();
  const room = useMemo(() => getRoom(id, userRooms), [id, userRooms]);
  const { settings, save: saveAudio } = useAudioSettings();
  const { recompute } = useAchievementsHook();

  const [joined,    setJoined]    = useState(false);
  const [muted,     setMuted]     = useState(true);
  const [hand,      setHand]      = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [pulseN,    setPulseN]    = useState(room.participants_simulated);
  const [celebrate, setCelebrate] = useState(null);
  const [activeSpeaker, setActiveSpeaker] = useState(room.host);
  const [activeSpeakerEmoji, setActiveSpeakerEmoji] = useState('🎙️');
  const [handQueue, setHandQueue] = useState([]); // [{ name, at }]
  const [chat,      setChat]      = useState([]); // [{ id, name, text, mine?, at }]
  const [floating,  setFloating]  = useState([]); // [{ id, emoji, x, color }]
  const [showChat,  setShowChat]  = useState(false);
  const [draft,     setDraft]     = useState('');

  const startedAtRef = useRef(null);
  const speakerTimerRef = useRef(null);
  const chatTimerRef    = useRef(null);
  const handTimerRef    = useRef(null);
  const reactionTimerRef= useRef(null);

  // ── Tick + presence drift ──────────────────────────────────────────────────
  useEffect(() => {
    if (!joined) return;
    startedAtRef.current = Date.now();
    const tick = setInterval(() => {
      setElapsed((e) => e + 1);
      // ±5 drift to feel alive
      setPulseN((n) => Math.max(10, n + Math.round((Math.random() - 0.45) * 6)));
    }, 1000);
    return () => clearInterval(tick);
  }, [joined]);

  // ── Rotate active speaker every 9-14s ──────────────────────────────────────
  useEffect(() => {
    if (!joined) return;
    setActiveSpeaker(room.host);
    setActiveSpeakerEmoji('🎙️');
    const schedule = () => {
      speakerTimerRef.current = setTimeout(() => {
        const pool = [
          { name: room.host, emoji: '🎙️' },
          ...PARTICIPANTS.map((p) => ({ name: p.name, emoji: p.emoji })),
        ];
        const next = pool[Math.floor(Math.random() * pool.length)];
        setActiveSpeaker(next.name);
        setActiveSpeakerEmoji(next.emoji);
        schedule();
      }, 9000 + Math.random() * 5000);
    };
    schedule();
    return () => clearTimeout(speakerTimerRef.current);
  }, [joined, room.host]);

  // ── Chat stream — a new mock line every 4-7s ──────────────────────────────
  useEffect(() => {
    if (!joined) return;
    const schedule = () => {
      chatTimerRef.current = setTimeout(() => {
        const p = PARTICIPANTS[Math.floor(Math.random() * PARTICIPANTS.length)];
        const text = MOCK_LINES[Math.floor(Math.random() * MOCK_LINES.length)];
        setChat((c) => trimChat([...c, { id: rid(), name: p.name, text, at: Date.now() }]));
        schedule();
      }, 4000 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(chatTimerRef.current);
  }, [joined]);

  // ── Hand-raise queue — every ~20s a random participant joins the queue ────
  useEffect(() => {
    if (!joined) return;
    const schedule = () => {
      handTimerRef.current = setTimeout(() => {
        setHandQueue((q) => {
          const p = PARTICIPANTS[Math.floor(Math.random() * PARTICIPANTS.length)];
          // Don't duplicate if already in queue
          if (q.some((x) => x.name === p.name)) return q;
          return [...q, { name: p.name, at: Date.now() }].slice(-5);
        });
        schedule();
      }, 14000 + Math.random() * 12000);
    };
    schedule();
    return () => clearTimeout(handTimerRef.current);
  }, [joined]);

  // Periodically drain the queue (host calls on someone)
  useEffect(() => {
    if (!joined) return;
    const id = setInterval(() => {
      setHandQueue((q) => (q.length ? q.slice(1) : q));
    }, 18000);
    return () => clearInterval(id);
  }, [joined]);

  // ── Floating reactions — others drop one every 5-9s ───────────────────────
  useEffect(() => {
    if (!joined) return;
    const schedule = () => {
      reactionTimerRef.current = setTimeout(() => {
        const r = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
        pushFloating(r);
        schedule();
      }, 5000 + Math.random() * 4000);
    };
    schedule();
    return () => clearTimeout(reactionTimerRef.current);
  }, [joined]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const trimChat = (arr) => (arr.length > 40 ? arr.slice(arr.length - 40) : arr);

  const pushFloating = useCallback((reaction) => {
    const flt = {
      id:    rid(),
      emoji: reaction.emoji,
      color: reaction.color,
      x:     Math.random() * (W - 80) + 20,
    };
    setFloating((cur) => [...cur, flt]);
    // Auto-prune after the animation finishes
    setTimeout(() => {
      setFloating((cur) => cur.filter((f) => f.id !== flt.id));
    }, 2600);
  }, []);

  const join = async () => {
    setJoined(true);
    setMuted(true);
    await logRoomVisit(room.id, 0);
    const newly = await recompute();
    if (newly.length) setCelebrate(BADGE_BY_ID[newly[0]]);
  };

  const confirmLeave = () => {
    if (!joined) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Leave this room?',
      'Your prayer time will be saved to your achievements.',
      [
        { text: 'Stay',  style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leave },
      ],
    );
  };

  const leave = async () => {
    if (joined) {
      const secs = startedAtRef.current
        ? Math.floor((Date.now() - startedAtRef.current) / 1000)
        : elapsed;
      if (secs > 0) {
        await addTotalSeconds(secs);
        const newly = await recompute();
        if (newly.length) setCelebrate(BADGE_BY_ID[newly[0]]);
      }
    }
    setJoined(false);
    setElapsed(0);
    setChat([]);
    setHandQueue([]);
    setFloating([]);
    navigation.goBack();
  };

  const toggleHand = () => {
    setHand((h) => {
      const next = !h;
      setHandQueue((q) => {
        if (next) {
          if (q.some((x) => x.name === 'You')) return q;
          return [...q, { name: 'You', at: Date.now() }];
        }
        return q.filter((x) => x.name !== 'You');
      });
      return next;
    });
  };

  const sendMessage = () => {
    const t = draft.trim();
    if (!t) return;
    setChat((c) => trimChat([...c, { id: rid(), name: 'You', text: t, mine: true, at: Date.now() }]));
    setDraft('');
  };

  const sendReaction = (r) => {
    pushFloating(r);
  };

  const fmtElapsed = (s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  const ambient = AMBIENT_TRACKS.find((a) => a.id === settings.ambient) || AMBIENT_TRACKS[0];
  const yourPos = handQueue.findIndex((x) => x.name === 'You');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Full-bleed gradient backdrop */}
      <LinearGradient
        colors={[room.gradient[0], room.gradient[1], '#000']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY }] }}>
          {/* TOP BAR */}
          <View style={s.topRow}>
            <TouchableOpacity onPress={confirmLeave} activeOpacity={0.78} style={s.topBtn}>
              <Text style={s.topBtnTxt}>‹  Back</Text>
            </TouchableOpacity>
            <View style={s.liveBadge}>
              <View style={s.liveDot} />
              <Text style={s.liveBadgeTxt}>
                {room.kind === 'live' ? 'LIVE' : 'GUIDED'}
              </Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 220, paddingHorizontal: 22 }}
          >
            <Text style={s.category}>{room.category.toUpperCase()}</Text>
            <Text style={s.title}>{room.title}</Text>
            {!!room.scripture && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Text style={[s.scripture, { marginTop: 0 }]}>📖  </Text>
                <RichVerseText text={room.scripture} isDark={isDark} lineHeight={18}
                  style={[s.scripture, { marginTop: 0 }]} />
              </View>
            )}

            {/* Speaking ring */}
            <View style={{ alignItems: 'center', marginTop: 28 }}>
              <SpeakingRings active={joined} />
              <View style={s.speakerDisc}>
                <Text style={s.speakerEmoji}>{activeSpeakerEmoji}</Text>
              </View>
              <Text style={s.speakerName}>{activeSpeaker}</Text>
              <Text style={s.speakerLbl}>
                {joined ? 'Speaking now' : 'Will host the session'}
              </Text>

              {/* Mic level when un-muted */}
              {joined && !muted && (
                <View style={{ marginTop: 14 }}>
                  <MicLevelMeter active />
                </View>
              )}
            </View>

            {/* Counters */}
            <View style={s.counterRow}>
              <Counter label="Listeners" value={pulseN.toLocaleString()} accent="#34D399" />
              <Counter label="In session" value={fmtElapsed(elapsed)} accent="#FBBF24" />
              <Counter label="Ambient"    value={ambient.name}         accent="#93C5FD" />
            </View>

            {/* Hand queue */}
            {joined && (handQueue.length > 0 || hand) && (
              <View style={s.queueCard}>
                <Eyebrow color="rgba(255,255,255,0.85)">RAISED HANDS</Eyebrow>
                {handQueue.length === 0 ? (
                  <Text style={s.queueEmpty}>No one in queue yet</Text>
                ) : (
                  <View style={{ marginTop: 10, gap: 6 }}>
                    {handQueue.map((h, i) => (
                      <View key={`${h.name}-${h.at}`} style={s.queueRow}>
                        <Text style={s.queueNum}>{i + 1}</Text>
                        <Text style={[s.queueName, h.name === 'You' && { color: '#FBBF24' }]}>
                          {h.name}{h.name === 'You' ? '  (you)' : ''}
                        </Text>
                        {i === 0 && (
                          <Text style={s.queueNext}>NEXT</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
                {hand && yourPos >= 0 && (
                  <Text style={s.queueHint}>
                    {yourPos === 0
                      ? "You're up next — the host will call on you."
                      : `You're #${yourPos + 1} in the queue.`}
                  </Text>
                )}
              </View>
            )}

            {/* Description */}
            {!!room.description && (
              <View style={s.descCard}>
                <Eyebrow color="rgba(255,255,255,0.78)">ABOUT THIS ROOM</Eyebrow>
                <Text style={s.descTxt}>{room.description}</Text>
                <Text style={s.descMeta}>
                  {room.kind === 'live'
                    ? `Starts ${room.scheduled_at || '—'}  ·  ${room.duration_min} min`
                    : `${room.duration_min} min recording`}
                </Text>
              </View>
            )}

            {/* Participants */}
            <View style={{ marginTop: 24 }}>
              <Eyebrow color="rgba(255,255,255,0.78)">IN THE ROOM</Eyebrow>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, marginTop: 10, paddingRight: 22 }}
                style={{ marginHorizontal: -22, paddingLeft: 22 }}
              >
                {PARTICIPANTS.map((p, i) => {
                  const speaking = p.name === activeSpeaker;
                  return (
                    <View key={i} style={s.avatarCol}>
                      <View style={[
                        s.avatar,
                        {
                          backgroundColor: p.accent + (speaking ? '66' : '33'),
                          borderColor: speaking ? '#FBBF24' : p.accent,
                          borderWidth: speaking ? 3 : 2,
                        },
                      ]}>
                        <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                      </View>
                      <Text style={s.avatarName} numberOfLines={1}>{p.name}</Text>
                      {speaking && <Text style={s.avatarTag}>SPEAKING</Text>}
                    </View>
                  );
                })}
                <View style={s.avatarCol}>
                  <View style={[s.avatar, { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.40)' }]}>
                    <Text style={s.avatarPlus}>+{Math.max(0, pulseN - PARTICIPANTS.length)}</Text>
                  </View>
                  <Text style={s.avatarName}>more</Text>
                </View>
              </ScrollView>
            </View>

            {/* Ambient quick-picker */}
            <View style={{ marginTop: 26 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Eyebrow color="rgba(255,255,255,0.78)">BACKGROUND</Eyebrow>
                {settings.ambient !== 'off' && (
                  <View style={s.playingTag}>
                    <View style={s.playingDot} />
                    <Text style={s.playingTxt}>Playing softly</Text>
                  </View>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginTop: 10, paddingRight: 22 }}
                style={{ marginHorizontal: -22, paddingLeft: 22 }}
              >
                {AMBIENT_TRACKS.map((tr) => {
                  const active = settings.ambient === tr.id;
                  return (
                    <TouchableOpacity
                      key={tr.id}
                      onPress={() => saveAudio({ ambient: tr.id })}
                      activeOpacity={0.85}
                      style={[
                        s.ambient,
                        { backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.14)' },
                      ]}
                    >
                      <Text style={{ fontSize: 14 }}>{tr.emoji}</Text>
                      <Text style={[s.ambientTxt, { color: active ? BLUE[800] : '#fff' }]}>
                        {tr.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Reactions */}
            {joined && (
              <View style={{ marginTop: 26 }}>
                <Eyebrow color="rgba(255,255,255,0.78)">REACT</Eyebrow>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  {REACTIONS.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => sendReaction(r)}
                      activeOpacity={0.75}
                      style={s.reactionBtn}
                    >
                      <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Inline chat preview */}
            {joined && chat.length > 0 && (
              <View style={{ marginTop: 26 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Eyebrow color="rgba(255,255,255,0.78)">PRAYER CHAT</Eyebrow>
                  <TouchableOpacity onPress={() => setShowChat((v) => !v)} activeOpacity={0.75}>
                    <Text style={s.chatToggle}>
                      {showChat ? 'Collapse' : 'Open chat'} →
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={s.chatCard}>
                  {chat.slice(-(showChat ? 30 : 3)).map((m) => (
                    <ChatLine key={m.id} m={m} />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Floating reactions overlay */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {floating.map((f) => (
              <FloatingReaction key={f.id} flt={f} />
            ))}
          </View>

          {/* Footer controls + chat input */}
          <View style={s.footer}>
            {!joined ? (
              <TouchableOpacity
                onPress={join}
                activeOpacity={0.86}
                style={s.joinBtn}
              >
                <Text style={s.joinBtnTxt}>JOIN ROOM</Text>
              </TouchableOpacity>
            ) : (
              <>
                {showChat && (
                  <View style={s.chatInputRow}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Type a prayer or amen…"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      style={s.chatInput}
                      onSubmitEditing={sendMessage}
                      returnKeyType="send"
                      maxLength={200}
                    />
                    <TouchableOpacity onPress={sendMessage} activeOpacity={0.8} style={s.chatSend}>
                      <Text style={s.chatSendTxt}>Send</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={s.controls}>
                  <ControlBtn
                    emoji={muted ? '🔇' : '🎙️'}
                    label={muted ? 'Muted' : 'Speaking'}
                    bg={muted ? 'rgba(255,255,255,0.18)' : '#10B981'}
                    onPress={() => setMuted((m) => !m)}
                  />
                  <ControlBtn
                    emoji="✋"
                    label={hand ? 'Hand raised' : 'Raise hand'}
                    bg={hand ? '#F59E0B' : 'rgba(255,255,255,0.18)'}
                    onPress={toggleHand}
                  />
                  <ControlBtn
                    emoji="💬"
                    label={showChat ? 'Hide chat' : 'Chat'}
                    bg={showChat ? '#4F46E5' : 'rgba(255,255,255,0.18)'}
                    onPress={() => setShowChat((v) => !v)}
                  />
                  <ControlBtn
                    emoji="❌"
                    label="Leave"
                    bg="rgba(239, 68, 68, 0.4)"
                    onPress={confirmLeave}
                  />
                </View>
              </>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      <CelebrateOverlay
        visible={!!celebrate}
        badge={celebrate}
        onDone={() => setCelebrate(null)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
const Counter = ({ label, value, accent }) => (
  <View style={s.counter}>
    <Text style={[s.counterLbl, { color: accent }]}>{label.toUpperCase()}</Text>
    <Text style={s.counterVal} numberOfLines={1}>{value}</Text>
  </View>
);

const ControlBtn = ({ emoji, label, bg, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.ctrlBtn}>
    <View style={[s.ctrlIcon, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
    <Text style={s.ctrlLbl}>{label}</Text>
  </TouchableOpacity>
);

const ChatLine = ({ m }) => (
  <View style={[s.chatLine, m.mine && { alignItems: 'flex-end' }]}>
    <Text style={[s.chatName, m.mine && { color: '#FBBF24' }]}>{m.name}</Text>
    <View style={[
      s.chatBubble,
      m.mine
        ? { backgroundColor: 'rgba(251, 191, 36, 0.22)', borderTopRightRadius: 4 }
        : { backgroundColor: 'rgba(255,255,255,0.14)',   borderTopLeftRadius:  4 },
    ]}>
      <Text style={s.chatTxt}>{m.text}</Text>
    </View>
  </View>
);

// Three pulsing concentric rings around the speaker disc.
const SpeakingRings = ({ active }) => {
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = rings.map((r, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(r, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
          Animated.timing(r, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ]),
      ),
    );
    if (active) loops.forEach((l) => l.start());
    else loops.forEach((l) => l.stop());
    return () => loops.forEach((l) => l.stop());
  }, [active]);  // eslint-disable-line
  return (
    <View style={{ position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            width: 130, height: 130, borderRadius: 65,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.55)',
            transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
            opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          }}
        />
      ))}
    </View>
  );
};

// 5-bar mic-level meter, each bar bounces independently when active.
const MicLevelMeter = ({ active }) => {
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!active) {
      bars.forEach((b) => b.setValue(0.2));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, {
            toValue: 0.4 + Math.random() * 0.6,
            duration: 180 + i * 30,
            useNativeDriver: false,
          }),
          Animated.timing(b, {
            toValue: 0.2 + Math.random() * 0.3,
            duration: 200 + i * 25,
            useNativeDriver: false,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active]); // eslint-disable-line
  return (
    <View style={s.micMeter}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5, marginHorizontal: 2,
            borderRadius: 3,
            backgroundColor: '#34D399',
            height: b.interpolate({ inputRange: [0, 1], outputRange: [4, 28] }),
          }}
        />
      ))}
      <Text style={s.micLbl}>Live mic</Text>
    </View>
  );
};

// Single floating emoji that drifts upward and fades out.
const FloatingReaction = ({ flt }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 2400, easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: flt.x,
        bottom: 120,
        opacity: anim.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -260] }) },
          { scale:      anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.1, 0.9] }) },
        ],
      }}
    >
      <Text style={{ fontSize: 34 }}>{flt.emoji}</Text>
    </Animated.View>
  );
};

const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 },
  topBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  topBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(239, 68, 68, 0.85)' },
  liveDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: '#fff' },

  category:  { fontSize: 11, fontWeight: '900', letterSpacing: 2.2, color: 'rgba(255,255,255,0.78)', marginTop: 4 },
  title:     { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 8, letterSpacing: -0.7, lineHeight: 36 },
  scripture: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.85)', marginTop: 8 },

  speakerDisc: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10,
  },
  speakerEmoji: { fontSize: 54 },
  speakerName:  { fontSize: 18, fontWeight: '900', color: '#fff', marginTop: 18, letterSpacing: -0.3 },
  speakerLbl:   { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.72)', marginTop: 3 },

  counterRow:  { flexDirection: 'row', gap: 10, marginTop: 28 },
  counter:     { flex: 1, padding: 12, borderRadius: RADII.md, backgroundColor: 'rgba(255,255,255,0.10)' },
  counterLbl:  { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  counterVal:  { fontSize: 16, fontWeight: '900', color: '#fff', marginTop: 4, letterSpacing: -0.3 },

  queueCard:   { marginTop: 22, padding: 16, borderRadius: RADII.md, backgroundColor: 'rgba(245, 158, 11, 0.18)' },
  queueEmpty:  { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', marginTop: 8 },
  queueRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  queueNum:    { fontSize: 12, fontWeight: '900', color: '#FBBF24', width: 16 },
  queueName:   { fontSize: 13.5, fontWeight: '800', color: '#fff', flex: 1 },
  queueNext:   { fontSize: 9.5, fontWeight: '900', color: '#0B2A6B', letterSpacing: 1.3, backgroundColor: '#FBBF24', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  queueHint:   { marginTop: 10, fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  descCard:    { marginTop: 22, padding: 16, borderRadius: RADII.md, backgroundColor: 'rgba(255,255,255,0.10)' },
  descTxt:     { fontSize: 13.5, lineHeight: 21, color: 'rgba(255,255,255,0.92)', marginTop: 8 },
  descMeta:    { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.65)', marginTop: 10, letterSpacing: 0.4 },

  avatarCol:   { alignItems: 'center', width: 64 },
  avatar:      { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarName:  { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  avatarPlus:  { fontSize: 13, fontWeight: '900', color: '#fff' },
  avatarTag:   { fontSize: 8, fontWeight: '900', letterSpacing: 1.0, color: '#FBBF24', marginTop: 2 },

  ambient:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADII.pill },
  ambientTxt:  { fontSize: 12.5, fontWeight: '900' },
  playingTag:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(16, 185, 129, 0.25)' },
  playingDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  playingTxt:  { fontSize: 10, fontWeight: '900', color: '#A7F3D0', letterSpacing: 0.4 },

  reactionBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },

  chatToggle:  { color: '#FBBF24', fontSize: 12, fontWeight: '900' },
  chatCard:    { marginTop: 10, padding: 12, borderRadius: RADII.md, backgroundColor: 'rgba(255,255,255,0.08)', gap: 8 },
  chatLine:    { gap: 3 },
  chatName:    { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.72)', letterSpacing: 0.3 },
  chatBubble:  { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, maxWidth: '85%' },
  chatTxt:     { fontSize: 13, color: '#fff', fontWeight: '600', lineHeight: 18 },

  micMeter:    { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  micLbl:      { color: '#A7F3D0', fontSize: 11, fontWeight: '900', marginLeft: 8, letterSpacing: 0.4 },

  footer:      { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingBottom: 22, paddingTop: 14, backgroundColor: 'rgba(0,0,0,0.35)' },
  joinBtn:     {
    backgroundColor: '#fff', paddingVertical: 16, borderRadius: 999, alignItems: 'center',
    shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 22, elevation: 8,
  },
  joinBtnTxt:  { color: BLUE[800], fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  controls:    { flexDirection: 'row', justifyContent: 'space-around' },
  ctrlBtn:     { alignItems: 'center', gap: 6 },
  ctrlIcon:    { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  ctrlLbl:     { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.4 },

  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999, paddingLeft: 14, paddingRight: 4, paddingVertical: 4,
  },
  chatInput:   { flex: 1, color: '#fff', fontSize: 13.5, fontWeight: '600', paddingVertical: 10 },
  chatSend:    { backgroundColor: '#FBBF24', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chatSendTxt: { color: '#0B2A6B', fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
});
