// screen/victory/victoryAudioData.js
// ─────────────────────────────────────────────────────────────────────────────
// Catalogue of audio prayer rooms — both live and recorded. The shape mirrors
// what a real backend would return so swapping AsyncStorage for an HTTP fetch
// (and the simulated participant feed for a WebRTC/Socket presence channel)
// later is a drop-in.
//
// Each room carries:
//   id, kind ('live' | 'recorded' | 'vigil'), category, title, host, scripture,
//   description, duration_min, scheduled_at, participants (simulated), ambient.
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIO_ROOMS = [
  {
    id: 'live-midnight',
    kind: 'live',
    category: 'Midnight Prayer',
    title: 'Watchmen on the Wall',
    host: 'Pastor S. Adeyemi',
    scripture: 'Isaiah 62:6-7',
    description:
      'Stand watch in prayer between 12am and 1am with believers around the world. Open with worship, then Spirit-led intercession.',
    duration_min: 60,
    scheduled_at: '00:00',
    participants_simulated: 248,
    ambient: 'piano',
    accent: '#7C3AED',
    gradient: ['#4C1D95', '#7C3AED'],
  },
  {
    id: 'live-breakthrough',
    kind: 'live',
    category: 'Breakthrough',
    title: 'Jericho Walls Falling',
    host: 'Sis. M. Okonkwo',
    scripture: 'Joshua 6:20',
    description:
      'A 30-minute high-faith breakthrough room. Bring your "wall" — health, finance, calling — and march by faith with a praying community.',
    duration_min: 30,
    scheduled_at: '06:30',
    participants_simulated: 412,
    ambient: 'piano',
    accent: '#DC2626',
    gradient: ['#7F1D1D', '#DC2626'],
  },
  {
    id: 'live-thanksgiving',
    kind: 'live',
    category: 'Thanksgiving',
    title: 'A Heart of Gratitude',
    host: 'Pastor T. Fagbuyi',
    scripture: 'Psalm 103',
    description:
      'No requests — just thanksgiving. Open your mouth and tell of His benefits. Bring scripture, bring song, bring tears of joy.',
    duration_min: 45,
    scheduled_at: '07:00',
    participants_simulated: 187,
    ambient: 'strings',
    accent: '#F59E0B',
    gradient: ['#92400E', '#F59E0B'],
  },
  {
    id: 'live-healing',
    kind: 'live',
    category: 'Healing',
    title: 'By His Stripes',
    host: 'Pastor (Dr.) E. Abina',
    scripture: 'Isaiah 53:5',
    description:
      'Bring your body, soul or loved one before the Lord. Brief scriptural exhortation followed by 35 minutes of intercession.',
    duration_min: 50,
    scheduled_at: '19:00',
    participants_simulated: 1024,
    ambient: 'piano',
    accent: '#0EA5E9',
    gradient: ['#0C4A6E', '#0EA5E9'],
  },

  // — Recorded sessions (always available) —
  {
    id: 'rec-family-vigil',
    kind: 'recorded',
    category: 'Family Vigil',
    title: 'Cover Over the Home',
    host: 'Pastor B. Taiwo',
    scripture: 'Job 1:10',
    description:
      'A 25-minute recorded family vigil — opening exhortation, scripture, then a guided prayer walk through six spheres of the home.',
    duration_min: 25,
    scheduled_at: null,
    participants_simulated: 96,
    ambient: 'piano',
    accent: '#1A56DB',
    gradient: ['#1E3A8A', '#3B82F6'],
  },
  {
    id: 'rec-youth-vigil',
    kind: 'recorded',
    category: 'Youth Vigil',
    title: 'Set Apart — A Youth Fire Service',
    host: 'Sis. J. Akinola',
    scripture: '1 Timothy 4:12',
    description:
      'For young hearts asking, "Lord, what is my next step?" Worship, declaration and prayer over destiny, purity and purpose.',
    duration_min: 35,
    scheduled_at: null,
    participants_simulated: 142,
    ambient: 'piano',
    accent: '#4F46E5',
    gradient: ['#3730A3', '#6366F1'],
  },
  {
    id: 'rec-deliverance',
    kind: 'recorded',
    category: 'Deliverance',
    title: 'Freedom Is the Children\'s Bread',
    host: 'Pastor R. Usenu',
    scripture: 'Galatians 5:1',
    description:
      'Renunciation, repentance and release. A guided 40-minute deliverance session. Best taken with a Bible open.',
    duration_min: 40,
    scheduled_at: null,
    participants_simulated: 78,
    ambient: 'strings',
    accent: '#0F766E',
    gradient: ['#134E4A', '#14B8A6'],
  },
  {
    id: 'rec-personal',
    kind: 'recorded',
    category: 'Personal Prayer',
    title: 'In the Secret Place',
    host: 'Sis. R. Olaomi',
    scripture: 'Psalm 27:4',
    description:
      'A quiet 15-minute personal devotion. Just you and the Father. Scripture, silence, surrender.',
    duration_min: 15,
    scheduled_at: null,
    participants_simulated: 64,
    ambient: 'piano',
    accent: '#10B981',
    gradient: ['#065F46', '#10B981'],
  },
];

// — Ambient soundscapes (visualised in the player; real audio would be wired
// to actual files behind expo-av if available at runtime). —
export const AMBIENT_TRACKS = [
  { id: 'piano',   name: 'Soft Piano',       blurb: 'Worship piano, no melody.',     emoji: '🎹' },
  { id: 'strings', name: 'Strings & Pad',    blurb: 'Cinematic strings under voice.', emoji: '🎻' },
  { id: 'rain',    name: 'Gentle Rain',      blurb: 'Soft rainfall, no thunder.',     emoji: '🌧️' },
  { id: 'choir',   name: 'Distant Choir',    blurb: 'Hushed angelic choir hum.',      emoji: '🎶' },
  { id: 'off',     name: 'No background',    blurb: 'Just your voice and the Word.',  emoji: '🔇' },
];

export const getRoom = (id, userRooms = []) =>
  [...AUDIO_ROOMS, ...userRooms].find((r) => r.id === id) || AUDIO_ROOMS[0];

export const LIVE_ROOMS     = () => AUDIO_ROOMS.filter((r) => r.kind === 'live');
export const RECORDED_ROOMS = () => AUDIO_ROOMS.filter((r) => r.kind === 'recorded');

// Combined list helpers — used by the list/room screens that need both
// the static catalogue and rooms the user has created.
export const allLive     = (userRooms = []) =>
  [...AUDIO_ROOMS, ...userRooms].filter((r) => r.kind === 'live');
export const allRecorded = (userRooms = []) =>
  [...AUDIO_ROOMS, ...userRooms].filter((r) => r.kind === 'recorded');

// Curated gradient presets the create-room form can show as swatches.
export const ROOM_GRADIENTS = [
  { id: 'midnight', accent: '#7C3AED', gradient: ['#4C1D95', '#7C3AED'] },
  { id: 'fire',     accent: '#DC2626', gradient: ['#7F1D1D', '#DC2626'] },
  { id: 'dawn',     accent: '#F59E0B', gradient: ['#92400E', '#F59E0B'] },
  { id: 'ocean',    accent: '#0EA5E9', gradient: ['#0C4A6E', '#0EA5E9'] },
  { id: 'royal',    accent: '#1A56DB', gradient: ['#1E3A8A', '#3B82F6'] },
  { id: 'indigo',   accent: '#4F46E5', gradient: ['#3730A3', '#6366F1'] },
  { id: 'forest',   accent: '#0F766E', gradient: ['#134E4A', '#14B8A6'] },
  { id: 'meadow',   accent: '#10B981', gradient: ['#065F46', '#10B981'] },
];

// Categories the create-room form offers as chips.
export const ROOM_CATEGORIES = [
  'Midnight Prayer', 'Breakthrough', 'Thanksgiving', 'Healing',
  'Family Vigil', 'Youth Vigil', 'Deliverance', 'Personal Prayer',
  'Worship', 'Intercession',
];
