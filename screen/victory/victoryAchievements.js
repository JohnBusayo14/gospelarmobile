// screen/victory/victoryAchievements.js
// ─────────────────────────────────────────────────────────────────────────────
// Catalogue of badges + the predicate functions that decide when each one
// unlocks. Called by useAchievements() after every mutation that affects
// completion/streak/fasting. Returns the list of newly-unlocked ids so the
// caller can show a celebration toast.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getCompleted, getNotes, getCustomPoints, getFasts,
  getRoomHistory, getTotalSeconds, getAchievements, unlockAchievement,
} from './victoryStore';
import { TOTAL_DAYS, todayDayIndex } from '../../data/victoryMonth';

// ── Badge catalogue ─────────────────────────────────────────────────────────
// Tier dictates the colour of the badge ring on the wall:
//   • bronze (warm copper), silver (cool slate), gold (vibrant amber),
//     sapphire (deep blue), diamond (icy white-blue).
export const BADGES = [
  // — Onboarding —
  { id: 'first-prayer',     name: 'First Steps',          desc: 'Mark your first day as prayed',     tier: 'bronze',   icon: '🌱', category: 'Start' },
  { id: 'first-note',       name: 'Open Heart',           desc: 'Write your first reflection',       tier: 'bronze',   icon: '✍️', category: 'Start' },
  { id: 'first-testimony',  name: 'Testimony Seed',       desc: 'Record your first testimony',       tier: 'bronze',   icon: '🌿', category: 'Start' },
  { id: 'first-custom',     name: 'Voice of Prayer',      desc: 'Add your first custom prayer point', tier: 'bronze',  icon: '✨', category: 'Start' },

  // — Streaks —
  { id: 'streak-3',         name: '3-Day Streak',         desc: '3 consecutive days prayed',         tier: 'silver',   icon: '⚡', category: 'Streaks' },
  { id: 'streak-7',         name: 'Week of Faith',        desc: '7 consecutive days prayed',         tier: 'silver',   icon: '🔥', category: 'Streaks' },
  { id: 'streak-14',        name: 'Fortnight Flame',      desc: '14 consecutive days prayed',        tier: 'gold',     icon: '🔥', category: 'Streaks' },
  { id: 'streak-30',        name: 'Faithful 30',          desc: '30 consecutive days prayed',        tier: 'diamond',  icon: '👑', category: 'Streaks' },

  // — Completion —
  { id: 'half-way',         name: 'Halfway There',        desc: '15 days completed',                 tier: 'silver',   icon: '🌗', category: 'Milestones' },
  { id: 'twenty-five',      name: 'Quarter Glory',        desc: '25 days completed',                 tier: 'gold',     icon: '🌟', category: 'Milestones' },
  { id: 'all-thirty',       name: 'Victory Month',        desc: 'Complete all 30 days',              tier: 'diamond',  icon: '🏆', category: 'Milestones' },

  // — Reflection / Notes —
  { id: 'reflect-5',        name: 'Reflective Heart',     desc: 'Write 5 reflections',               tier: 'silver',   icon: '📖', category: 'Reflection' },
  { id: 'reflect-15',       name: 'Deep Waters',          desc: 'Write 15 reflections',              tier: 'gold',     icon: '🌊', category: 'Reflection' },
  { id: 'testimonies-5',    name: 'Witness',              desc: 'Capture 5 testimonies',             tier: 'gold',     icon: '🗣️', category: 'Reflection' },

  // — Custom prayer points —
  { id: 'custom-10',        name: 'Voice of Many Waters', desc: 'Add 10 personal prayer points',     tier: 'silver',   icon: '🌊', category: 'Custom' },
  { id: 'custom-30',        name: 'River of Prayer',      desc: 'Add 30 personal prayer points',     tier: 'gold',     icon: '🌀', category: 'Custom' },

  // — Fasting —
  { id: 'fast-first',       name: 'First Fast',           desc: 'Schedule your first fast',          tier: 'bronze',   icon: '🍃', category: 'Fasting' },
  { id: 'fast-3day',        name: 'Three-Day Consecration', desc:'Complete a 3-day fast',            tier: 'gold',     icon: '🕯️', category: 'Fasting' },
  { id: 'fast-7day',        name: 'Daniel Fast',          desc: 'Complete a 7-day fast',             tier: 'diamond',  icon: '🌌', category: 'Fasting' },

  // — Audio rooms —
  { id: 'room-join',        name: 'Gathered',             desc: 'Join your first audio prayer room', tier: 'bronze',   icon: '🎙️', category: 'Community' },
  { id: 'room-5',           name: 'Faithful Gathering',   desc: 'Join 5 audio prayer rooms',         tier: 'silver',   icon: '🤝', category: 'Community' },
  { id: 'hours-3',          name: 'Hours of Prayer',      desc: 'Pray for 3 hours total',            tier: 'silver',   icon: '⏳', category: 'Community' },
  { id: 'hours-10',         name: 'A Vessel Set Apart',   desc: 'Pray for 10 hours total',           tier: 'diamond',  icon: '🌟', category: 'Community' },
];

// Quick lookup
export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));

export const TIER_COLOURS = {
  bronze:   { ring: '#C77B3F', glow: '#F5D5B0', text: '#7C3F12' },
  silver:   { ring: '#94A3B8', glow: '#E2E8F0', text: '#475569' },
  gold:     { ring: '#F59E0B', glow: '#FEF3C7', text: '#92400E' },
  sapphire: { ring: '#1A56DB', glow: '#DBEAFE', text: '#1E40AF' },
  diamond:  { ring: '#3B82F6', glow: '#E0F2FE', text: '#0C4A6E' },
};

// ── Streak helpers — uses the same model as the existing Progress screen ────
const longestRun = (completed) => {
  let cur = 0, longest = 0;
  for (let d = 1; d <= TOTAL_DAYS; d++) {
    if (completed[d]) { cur += 1; longest = Math.max(longest, cur); }
    else cur = 0;
  }
  return longest;
};

const currentStreakFromToday = (completed) => {
  let n = 0;
  for (let d = todayDayIndex(); d >= 1; d--) {
    if (completed[d]) n += 1; else break;
  }
  return n;
};

// ── Evaluate all rules and unlock newly-qualifying badges. ──────────────────
// Returns an array of newly-unlocked badge ids, in the order they unlocked.
export const recomputeAchievements = async () => {
  const [completed, notes, customMap, fasts, rooms, totalSec, alreadyUnlocked] =
    await Promise.all([
      getCompleted(), getNotes(), getCustomPoints(), getFasts(),
      getRoomHistory(), getTotalSeconds(), getAchievements(),
    ]);

  const doneCount  = Object.values(completed).filter(Boolean).length;
  const noteVals   = Object.values(notes);
  const reflectN   = noteVals.filter((n) => n.reflection?.trim()).length;
  const testiN     = noteVals.filter((n) => n.testimony?.trim()).length;
  const customN    = Object.values(customMap).reduce((sum, list) =>
                       sum + (Array.isArray(list) ? list.length : 0), 0);
  const longest    = longestRun(completed);
  const fastCount  = fasts.length;
  const longFasts  = fasts.filter((f) => {
    const ms = new Date(f.endISO).getTime() - new Date(f.startISO).getTime();
    return f.completed && ms >= 3 * 24 * 3600 * 1000;
  });
  const fast7      = longFasts.filter((f) => {
    const ms = new Date(f.endISO).getTime() - new Date(f.startISO).getTime();
    return ms >= 7 * 24 * 3600 * 1000;
  });
  const roomCount  = rooms.length;
  const hours      = totalSec / 3600;

  // Evaluate every rule. Rule order doesn't matter — we just check which
  // ones now qualify and weren't previously unlocked.
  const checks = [
    ['first-prayer',     doneCount >= 1],
    ['first-note',       reflectN  >= 1],
    ['first-testimony',  testiN    >= 1],
    ['first-custom',     customN   >= 1],

    ['streak-3',         longest >= 3],
    ['streak-7',         longest >= 7],
    ['streak-14',        longest >= 14],
    ['streak-30',        longest >= 30],

    ['half-way',         doneCount >= 15],
    ['twenty-five',      doneCount >= 25],
    ['all-thirty',       doneCount >= 30],

    ['reflect-5',        reflectN >= 5],
    ['reflect-15',       reflectN >= 15],
    ['testimonies-5',    testiN   >= 5],

    ['custom-10',        customN >= 10],
    ['custom-30',        customN >= 30],

    ['fast-first',       fastCount >= 1],
    ['fast-3day',        longFasts.length >= 1],
    ['fast-7day',        fast7.length     >= 1],

    ['room-join',        roomCount >= 1],
    ['room-5',           roomCount >= 5],
    ['hours-3',          hours >= 3],
    ['hours-10',         hours >= 10],
  ];

  const newly = [];
  for (const [id, ok] of checks) {
    if (ok && !alreadyUnlocked[id]) {
      const r = await unlockAchievement(id);
      if (r) newly.push(id);
    }
  }
  return newly;
};
