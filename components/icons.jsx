// components/icons.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Single shared icon registry — every chrome icon in the app comes from here.
//
// All icons:
//   • 24×24 viewBox, thin-stroke (sw default 1.8), round caps + joins
//   • accept { color, size, sw } so callers can theme + scale them
//   • render via react-native-svg primitives so they work on iOS, Android, web
//
// AppTabBar re-exports ICONS from this file for backward compatibility —
// existing imports like `import { ICONS } from '../components/AppTabBar'`
// keep working while new code can do `import { ICONS } from '../components/icons'`.
//
// Adding a new icon: drop a new entry into ICONS keyed by PascalCase name,
// use the helper template at the top. That's it — no further registration.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';

// Standard wrapper for every icon — gives identical defaults + stroke rules.
const Glyph = ({ children, color, size = 22, sw = 1.8, fill = 'none' }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </Svg>
);

export const ICONS = {
  // ── Bottom-nav set ─────────────────────────────────────────────────────────
  Home: (p) => (
    <Glyph {...p}>
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <Path d="M9 21V12h6v9" />
    </Glyph>
  ),
  Lessons: (p) => (
    <Glyph {...p}>
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <Line x1="9" y1="7" x2="15" y2="7" />
      <Line x1="9" y1="11" x2="15" y2="11" />
    </Glyph>
  ),
  Notes: (p) => (
    <Glyph {...p}>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1="16" y1="13" x2="8" y2="13" />
      <Line x1="16" y1="17" x2="8" y2="17" />
      <Polyline points="10 9 9 9 8 9" />
    </Glyph>
  ),
  Stats: (p) => (
    <Glyph {...p}>
      <Polyline points="3 17 9 11 13 15 21 7" />
      <Polyline points="15 7 21 7 21 13" />
    </Glyph>
  ),
  Settings: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Glyph>
  ),

  // ── Teacher tabs ───────────────────────────────────────────────────────────
  Classes: (p) => (
    <Glyph {...p}>
      <Rect x="3" y="3" width="18" height="14" rx="2" />
      <Line x1="3" y1="9" x2="21" y2="9" />
      <Line x1="8" y1="21" x2="16" y2="21" />
      <Line x1="12" y1="17" x2="12" y2="21" />
    </Glyph>
  ),
  Attendance: (p) => (
    <Glyph {...p}>
      <Path d="M9 11l3 3L22 4" />
      <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Glyph>
  ),
  Progress: (p) => (
    <Glyph {...p}>
      <Line x1="3" y1="20" x2="21" y2="20" />
      <Rect x="6"  y="12" width="3" height="8" />
      <Rect x="11" y="7"  width="3" height="13" />
      <Rect x="16" y="3"  width="3" height="17" />
    </Glyph>
  ),

  // ── Devotional section icons ───────────────────────────────────────────────
  Prayer: (p) => (
    <Glyph {...p}>
      <Path d="M9 21V11a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v10" />
      <Path d="M9 11V5a1.5 1.5 0 0 0-3 0v9a4 4 0 0 0 1.2 2.85L9 18.5" />
      <Path d="M15 11V5a1.5 1.5 0 0 1 3 0v9a4 4 0 0 1-1.2 2.85L15 18.5" />
    </Glyph>
  ),
  Reflection: (p) => (
    <Glyph {...p}>
      <Path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <Path d="M19 14l.7 2.1L22 17l-2.3.9L19 20l-.7-2.1L16 17l2.3-.9L19 14z" />
      <Path d="M5 16l.5 1.5L7 18l-1.5.5L5 20l-.5-1.5L3 18l1.5-.5L5 16z" />
    </Glyph>
  ),
  Application: (p) => (
    <Glyph {...p}>
      <Path d="M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1z" />
      <Path d="M16 5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" />
      <Path d="M9 13l2 2 4-4" />
    </Glyph>
  ),
  Sun: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2" />
      <Path d="M12 20v2" />
      <Path d="M4.93 4.93l1.41 1.41" />
      <Path d="M17.66 17.66l1.41 1.41" />
      <Path d="M2 12h2" />
      <Path d="M20 12h2" />
      <Path d="M4.93 19.07l1.41-1.41" />
      <Path d="M17.66 6.34l1.41-1.41" />
    </Glyph>
  ),
  Book: (p) => (
    <Glyph {...p}>
      <Path d="M2 5a2 2 0 0 1 2-2h6v17H4a2 2 0 0 1-2-2V5z" />
      <Path d="M22 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 0 2-2V5z" />
    </Glyph>
  ),
  Calendar: (p) => (
    <Glyph {...p}>
      <Rect x="3" y="5"  width="18" height="16" rx="2" />
      <Line x1="3" y1="10" x2="21" y2="10" />
      <Line x1="8" y1="3"  x2="8"  y2="7" />
      <Line x1="16" y1="3" x2="16" y2="7" />
    </Glyph>
  ),
  Highlight: (p) => (
    <Glyph {...p}>
      <Path d="M9 14l-3 6 6-3" />
      <Path d="M14 4l6 6-9 9-6-6 9-9z" />
      <Line x1="14" y1="4" x2="20" y2="10" />
    </Glyph>
  ),
  ChevronDown: (p) => (
    <Glyph {...p}>
      <Polyline points="6 9 12 15 18 9" />
    </Glyph>
  ),
  ChevronRight: (p) => (
    <Glyph {...p}>
      <Polyline points="9 6 15 12 9 18" />
    </Glyph>
  ),
  ArrowLeft: (p) => (
    <Glyph {...p}>
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </Glyph>
  ),
  ArrowRight: (p) => (
    <Glyph {...p}>
      <Line x1="5" y1="12" x2="19" y2="12" />
      <Polyline points="12 5 19 12 12 19" />
    </Glyph>
  ),
  X: (p) => (
    <Glyph {...p}>
      <Line x1="18" y1="6"  x2="6"  y2="18" />
      <Line x1="6"  y1="6"  x2="18" y2="18" />
    </Glyph>
  ),

  // ── Lesson-overview icons ──────────────────────────────────────────────────
  Quote: (p) => (
    <Glyph {...p}>
      <Path d="M3 11c0-3 2-5 5-5v3c-1 0-2 1-2 2v6H3v-6z" />
      <Path d="M13 11c0-3 2-5 5-5v3c-1 0-2 1-2 2v6h-3v-6z" />
    </Glyph>
  ),
  Music: (p) => (
    <Glyph {...p}>
      <Path d="M9 18V5l12-2v13" />
      <Circle cx="6"  cy="18" r="3" />
      <Circle cx="18" cy="16" r="3" />
    </Glyph>
  ),
  Landmark: (p) => (
    <Glyph {...p}>
      <Line x1="3"  y1="22" x2="21" y2="22" />
      <Line x1="6"  y1="18" x2="6"  y2="11" />
      <Line x1="10" y1="18" x2="10" y2="11" />
      <Line x1="14" y1="18" x2="14" y2="11" />
      <Line x1="18" y1="18" x2="18" y2="11" />
      <Path d="M3 11h18l-9-7-9 7z" />
      <Line x1="3"  y1="18" x2="21" y2="18" />
    </Glyph>
  ),
  Target: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="12" r="9" />
      <Circle cx="12" cy="12" r="5" />
      <Circle cx="12" cy="12" r="1.5" fill={p.color} />
    </Glyph>
  ),

  // ── New CHROME icons (this round) ──────────────────────────────────────────
  Lock: (p) => (
    <Glyph {...p}>
      <Rect x="4" y="11" width="16" height="10" rx="2" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Glyph>
  ),
  Unlock: (p) => (
    <Glyph {...p}>
      <Rect x="4" y="11" width="16" height="10" rx="2" />
      <Path d="M8 11V7a4 4 0 0 1 8 0" />
    </Glyph>
  ),
  Check: (p) => (
    <Glyph {...p}>
      <Polyline points="20 6 9 17 4 12" />
    </Glyph>
  ),
  CheckCircle: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="9 12 11 14 16 9" />
    </Glyph>
  ),
  AlertTriangle: (p) => (
    <Glyph {...p}>
      <Path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9"  x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Glyph>
  ),
  AlertCircle: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="8"  x2="12" y2="12" />
      <Line x1="12" y1="16" x2="12.01" y2="16" />
    </Glyph>
  ),
  Info: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8"  x2="12.01" y2="8" />
    </Glyph>
  ),
  Bell: (p) => (
    <Glyph {...p}>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Glyph>
  ),
  Globe: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="12" r="10" />
      <Line x1="2" y1="12" x2="22" y2="12" />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Glyph>
  ),
  User: (p) => (
    <Glyph {...p}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Glyph>
  ),
  Users: (p) => (
    <Glyph {...p}>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Glyph>
  ),
  Trash: (p) => (
    <Glyph {...p}>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
      <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Glyph>
  ),
  Eye: (p) => (
    <Glyph {...p}>
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Glyph>
  ),
  EyeOff: (p) => (
    <Glyph {...p}>
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <Path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </Glyph>
  ),
  Clock: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </Glyph>
  ),
  Hourglass: (p) => (
    <Glyph {...p}>
      <Path d="M6 2h12" />
      <Path d="M6 22h12" />
      <Path d="M6 2c0 6 6 6 6 10s-6 4-6 10" />
      <Path d="M18 2c0 6-6 6-6 10s6 4 6 10" />
    </Glyph>
  ),
  Zap: (p) => (
    <Glyph {...p}>
      <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Glyph>
  ),
  Star: (p) => (
    <Glyph {...p}>
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Glyph>
  ),
  Heart: (p) => (
    <Glyph {...p}>
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Glyph>
  ),
  Moon: (p) => (
    <Glyph {...p}>
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Glyph>
  ),
  BookStack: (p) => (
    <Glyph {...p}>
      <Path d="M4 4v17h16V4" />
      <Path d="M4 7h16" />
      <Path d="M4 10h16" />
      <Path d="M9 4v17" />
    </Glyph>
  ),
  Trophy: (p) => (
    <Glyph {...p}>
      <Path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
      <Path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
      <Path d="M6 5h12v6a6 6 0 0 1-12 0z" />
      <Path d="M9 21h6" />
      <Path d="M12 17v4" />
    </Glyph>
  ),
  Crown: (p) => (
    <Glyph {...p}>
      <Path d="M2 7l5 5 5-8 5 8 5-5v11H2z" />
    </Glyph>
  ),
  Mail: (p) => (
    <Glyph {...p}>
      <Rect x="2" y="4" width="20" height="16" rx="2" />
      <Polyline points="22 4 12 13 2 4" />
    </Glyph>
  ),
  Inbox: (p) => (
    <Glyph {...p}>
      <Polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Glyph>
  ),
  RefreshCw: (p) => (
    <Glyph {...p}>
      <Polyline points="23 4 23 10 17 10" />
      <Polyline points="1 20 1 14 7 14" />
      <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <Path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </Glyph>
  ),
  Plus: (p) => (
    <Glyph {...p}>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Glyph>
  ),
  LogOut: (p) => (
    <Glyph {...p}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </Glyph>
  ),
  Share: (p) => (
    <Glyph {...p}>
      <Circle cx="18" cy="5" r="3" />
      <Circle cx="6" cy="12" r="3" />
      <Circle cx="18" cy="19" r="3" />
      <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </Glyph>
  ),
  Edit: (p) => (
    <Glyph {...p}>
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Glyph>
  ),
  Search: (p) => (
    <Glyph {...p}>
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Glyph>
  ),
  Send: (p) => (
    <Glyph {...p}>
      <Line x1="22" y1="2" x2="11" y2="13" />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Glyph>
  ),
  Award: (p) => (
    <Glyph {...p}>
      <Circle cx="12" cy="8" r="7" />
      <Polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </Glyph>
  ),
};
