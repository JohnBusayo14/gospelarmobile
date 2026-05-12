// screen/victory/VictoryBackdrop.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Previously rendered slow-drifting blurred orbs as the Victory Month book's
// ambient background. The book is now using a plain, modern surface design,
// so the backdrop is intentionally a no-op.
//
// Kept as an exported component (and not deleted) so the 16 screens that
// already import + mount <VictoryBackdrop /> keep compiling without a churn-
// only sweep. New screens shouldn't bother importing it.
// ─────────────────────────────────────────────────────────────────────────────

export default function VictoryBackdrop() {
  return null;
}
