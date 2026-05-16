// components/GospelerIdCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The digital Gospeler ID membership card. Designed to feel like a premium
// fintech "wallet card" (Apple Wallet / Revolut / Cash App): single blue
// gradient surface, 28px corner radius, soft ambient lift, no hairline
// borders. The QR sits in a white inset on the right so it stays scannable
// when the parent screen is rendered to PNG for Download / Share.
//
// Props
//   data     — the gospeler_id row from the API (full_name, gospeler_code,
//              church_name, church_branch, membership_role, photo_base64,
//              verified, issued_at, id (QR token), version)
//   compact  — render a tighter variant for in-list previews. Default false.
//
// The component is intentionally presentation-only: no fetching, no state.
// The hub screen owns data; the form screen passes a preview shape. This
// makes the card trivial to snapshot for Download / Share (we'll add a
// react-native-view-shot wrapper in Phase 2).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { ICONS } from './icons';

// Premium blue gradient — same blue ramp used in theme/tokens.js so the card
// stays on-brand with the rest of the app shell, just intensified.
const CARD_GRADIENT = ['#0B2A6B', '#1E40AF', '#2563EB'];

// Build the payload a scanner will see. Keeping it as a URL means any QR
// reader (including the iOS / Android camera app) will offer to open it,
// while our own scanner can parse the trailing token and call
// /api/gospeler-id/verify/:token directly.
const buildQrPayload = (token) =>
  `https://gospelar.com/verify/${encodeURIComponent(token || '')}`;

// Friendly date "Mar 2026" for "Issued" line. The full ISO timestamp is
// preserved in the row for any future "valid through" / audit use.
const fmtIssued = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const ROLE_LABEL = {
  member:   'Member',
  worker:   'Worker',
  pastor:   'Pastor',
  youth:    'Youth',
  leader:   'Leader',
  minister: 'Minister',
};

export default function GospelerIdCard({ data, compact = false }) {
  if (!data) return null;

  const {
    id: qrToken,
    gospeler_code,
    full_name,
    church_name,
    church_branch,
    membership_role,
    photo_base64,
    verified,
    issued_at,
    version,
  } = data;

  const qrSize = compact ? 70 : 96;
  const photoSize = compact ? 44 : 56;
  const initials = (full_name || '?')
    .split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  return (
    <View style={{
      borderRadius: 28,
      overflow: 'hidden',
      // Soft ambient lift — mimics overhead light, no hard border.
      shadowColor: '#0B1228',
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    }}>
      <LinearGradient
        colors={CARD_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: compact ? 18 : 22 }}
      >
        {/* ── Top row: brand mark + verified badge ──────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{
              width: 26, height: 26, borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.18)',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>G</Text>
            </View>
            <Text style={{
              color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800',
              letterSpacing: 2.5,
            }}>
              GOSPELER ID
            </Text>
          </View>

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: verified ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.14)',
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
          }}>
            <ICONS.ShieldCheck color={verified ? '#6EE7B7' : '#fff'} size={12} sw={2.4} />
            <Text style={{
              color: verified ? '#6EE7B7' : '#fff',
              fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
            }}>
              {verified ? 'VERIFIED' : 'ACTIVE'}
            </Text>
          </View>
        </View>

        {/* ── Identity block: photo / name / role ──────────────────────────
            Sits above the QR row so the visual hierarchy reads top-to-bottom:
            who → what → how (church, branch, ID). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: compact ? 18 : 26, gap: 14 }}>
          <View style={{
            width: photoSize, height: photoSize, borderRadius: photoSize / 2,
            backgroundColor: 'rgba(255,255,255,0.18)',
            justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
          }}>
            {photo_base64 ? (
              <Image
                source={{ uri: photo_base64.startsWith('data:') ? photo_base64 : `data:image/jpeg;base64,${photo_base64}` }}
                style={{ width: photoSize, height: photoSize }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: photoSize * 0.4 }}>{initials || '?'}</Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{
              color: '#fff', fontSize: compact ? 16 : 19, fontWeight: '800',
              letterSpacing: -0.3,
            }} numberOfLines={1}>
              {full_name || 'Unnamed Member'}
            </Text>
            <Text style={{
              color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600', marginTop: 2,
            }} numberOfLines={1}>
              {ROLE_LABEL[membership_role] || 'Member'}
              {church_branch ? `  ·  ${church_branch}` : ''}
            </Text>
          </View>
        </View>

        {/* ── QR + identifier row ──────────────────────────────────────────
            QR lives in a white inset for max scan contrast; the gospeler_code
            and church name sit on the left at the same vertical baseline. */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
          marginTop: compact ? 18 : 24,
        }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800',
              letterSpacing: 2,
            }}>
              CHURCH
            </Text>
            <Text style={{
              color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2,
            }} numberOfLines={1}>
              {church_name || '—'}
            </Text>

            <Text style={{
              color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800',
              letterSpacing: 2, marginTop: 14,
            }}>
              ID
            </Text>
            <Text style={{
              color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 2,
              // Monospace-ish look without bundling a custom font.
              fontVariant: ['tabular-nums'],
            }} numberOfLines={1}>
              {gospeler_code || '—'}
            </Text>
          </View>

          <View style={{
            backgroundColor: '#fff',
            padding: 8, borderRadius: 14,
          }}>
            <QRCode
              value={buildQrPayload(qrToken)}
              size={qrSize}
              color="#0B2A6B"
              backgroundColor="#fff"
            />
          </View>
        </View>

        {/* ── Footnote row ─────────────────────────────────────────────────
            Issued + version. Version increments on every regeneration so the
            user can see at a glance whether the card is fresh. */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between',
          marginTop: compact ? 14 : 18,
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' }}>
            Issued · {fmtIssued(issued_at)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' }}>
            v{version || 1}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}
