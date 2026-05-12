// hooks/useReadingTimer.js
// ─────────────────────────────────────────────────────────────────────────────
// Tracks how long a screen has been *actively* visible. Used by LessonPage,
// DevotionalReadingScreen, and VictoryDayScreen to:
//   • feed `duration_seconds` into the daily check-in
//   • gate the "Mark as completed / prayed" action behind a minimum dwell time
//     so users can't drive-by tap and rack up bogus progress
//
// Why "actively"? If the user opens a lesson and locks the phone, we don't
// want to count the 8 hours they were asleep as reading time. AppState
// transitions to 'background' / 'inactive' pause the timer; 'active' resumes
// it.
//
// Implementation: we keep two refs — `startedAt` (the last time the timer
// resumed) and `accumulatedMs` (the total committed reading time). Each time
// the app backgrounds, we flush `now - startedAt` into the accumulator and
// clear `startedAt`. On foreground, we reset `startedAt = now`. Reading
// `getElapsedSeconds()` adds the in-flight chunk if the timer is currently
// running.
//
// `minSeconds` option turns the hook into a live gate:
//   • a 1Hz interval ticks while the timer is running
//   • `elapsedSeconds` (live state) is exposed for the UI
//   • `remaining` counts down to 0; `ready` flips true at 0
// Components can render a "✓ ready" or "30s to go" hint without managing
// their own setInterval.
//
// Returned API:
//   {
//     getElapsedSeconds(),  // synchronous, exact, ref-based
//     elapsedSeconds,       // live state, updates every second
//     remaining,            // seconds left until minSeconds is hit (0 once met)
//     ready,                // true once elapsedSeconds >= minSeconds
//     reset(),
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState } from 'react-native';

export function useReadingTimer({ enabled = true, minSeconds = 0 } = {}) {
  const startedAt     = useRef(null);   // ms timestamp when current run began
  const accumulatedMs = useRef(0);      // total committed ms across pauses
  const isMounted     = useRef(true);

  // Live elapsed time, surfaced as state so React can re-render the gate UI.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Begin / pause helpers — pure ref math, no re-renders.
  const begin = () => { if (startedAt.current == null) startedAt.current = Date.now(); };
  const pause = () => {
    if (startedAt.current != null) {
      accumulatedMs.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }
  };

  const reset = useCallback(() => {
    accumulatedMs.current = 0;
    startedAt.current     = enabled ? Date.now() : null;
    setElapsedSeconds(0);
  }, [enabled]);

  const getElapsedSeconds = useCallback(() => {
    const live = startedAt.current != null ? Date.now() - startedAt.current : 0;
    return Math.floor((accumulatedMs.current + live) / 1000);
  }, []);

  // Mount + AppState lifecycle
  useEffect(() => {
    isMounted.current = true;
    if (enabled) begin();

    const sub = AppState.addEventListener('change', (state) => {
      if (!isMounted.current || !enabled) return;
      if (state === 'active')                  begin();
      else if (state === 'background' || state === 'inactive') pause();
    });

    return () => {
      isMounted.current = false;
      sub.remove();
      pause();   // flush whatever was running so getElapsedSeconds is accurate
    };
  }, [enabled]);

  // 1 Hz ticker — only needed when the caller wants the live state (minSeconds
  // > 0 implies they're rendering a gate / countdown). We still expose
  // `elapsedSeconds` in the no-min case but we tick once per second regardless
  // so callers that bind to the state get smooth updates.
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      if (!isMounted.current) return;
      setElapsedSeconds(getElapsedSeconds());
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, getElapsedSeconds]);

  const remaining = Math.max(0, minSeconds - elapsedSeconds);
  const ready     = minSeconds === 0 ? true : elapsedSeconds >= minSeconds;

  return { getElapsedSeconds, elapsedSeconds, remaining, ready, reset };
}

export default useReadingTimer;
