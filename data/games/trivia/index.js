// data/games/trivia/index.js
// Combines the five level files into playable questions.
//   buildLevel(level, lang) → [{ id, ref, q, options[4], answer }]
// Options are shuffled per play; if a language is missing the English text is used.

import { shuffle } from '../../../services/games';
import level1 from './level1';
import level2 from './level2';
import level3 from './level3';
import level4 from './level4';
import level5 from './level5';

export const LEVELS = [1, 2, 3, 4, 5];
export const QUESTIONS_PER_LEVEL = 10;
export const PASS_MARK = 7;               // correct answers needed to pass a level

const RAW = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };

export const bankSize = (level) => (RAW[level] || []).length;

const pick = (entry, lang) => {
  const row = entry[lang] || entry.en;
  return { q: row[0], answers: row.slice(1) };
};

export function buildLevel(level, lang, count = QUESTIONS_PER_LEVEL, shuffleFn) {
  const sh = shuffleFn || shuffle;
  const pool = sh(RAW[level] || []).slice(0, count);
  return pool.map(([ref, entry]) => {
    const { q, answers } = pick(entry, lang);
    const order = sh(answers.map((text, idx) => ({ text, correct: idx === 0 })));
    return {
      id: `${level}|${ref}|${entry.en[0]}`,
      ref,
      q,
      options: order.map((o) => o.text),
      answer: order.findIndex((o) => o.correct),
    };
  });
}

// Spare questions for "Skip" — same level, not already in the round.
export function spareQuestion(level, lang, usedIds, shuffleFn) {
  return buildLevel(level, lang, 999, shuffleFn).find((x) => !usedIds.has(x.id)) || null;
}
