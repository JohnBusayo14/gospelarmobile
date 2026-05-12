// theme/bookSurfaces.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared visual language for every "book" surface in the app — the same
// solid-card, hairline-bordered, ambient-lift look that the Victory Month
// Prayer book uses. Promoted here from screen/victory/victoryTheme so the
// Sunday-School flow and any future books can pull from one source.
//
// Exports:
//   • bookTones(isDark)  — page bg / card fill / edge / chip / verse-pill
//                          palettes, keyed to the active colour scheme
//   • RADII              — radius scale (sm/md/lg/xl/pill)
//   • AMBIENT_SHADOW     — soft elevation preset for floating cards
//
// Anything that should look identical across books (Sunday School cards,
// Victory Month cards, etc.) should import from here.
// ─────────────────────────────────────────────────────────────────────────────

import {
  victoryTones as _victoryTones,
  RADII        as _RADII,
  AMBIENT_SHADOW as _AMBIENT_SHADOW,
} from '../screen/victory/victoryTheme';

// Re-export under book-neutral names. The underlying values are tuned for the
// modern, solid-card design (see screen/victory/victoryTheme.js for the
// full ramp explanations).
export const bookTones    = _victoryTones;
export const RADII        = _RADII;
export const AMBIENT_SHADOW = _AMBIENT_SHADOW;
