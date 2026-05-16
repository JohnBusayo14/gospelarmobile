// screen/gospelerId/GospelerIdHubScreen.jsx
// Entry point for the "My Gospeler ID" flow surfaced from Settings.
//
// Two states:
//   1. No ID yet  → big CTA encouraging the user to create one + benefits list.
//   2. Has ID     → glass preview card with current code, version, role badge,
//                   plus action rows (View card, Edit, Regenerate, History).
//
// Network behaviour: fetches on mount + on focus so the screen always reflects
// the latest server state (e.g. after the form screen pops back, the new ID
// shows up without a manual refresh).

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator,
  StatusBar, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import { ICONS } from '../components/icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';
import { fetchGospelerId, regenerateGospelerId } from '../services/api';

const BLUE = '#1A56DB';
const BLUE_DEEP = '#1E3A8A';
const BLUE_LIGHT = '#EFF6FF';

const ROLE_LABEL = {
  member: 'Member', worker: 'Worker', pastor: 'Pastor',
  youth: 'Youth', leader: 'Leader', minister: 'Minister',
};

// Pretty "Mar 5, 2026" used on the preview tile. Falls back gracefully on
// any string the server might return.
const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return ''; }
};

export default function GospelerIdHubScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [email, setEmail] = useState('');
  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const em = await AsyncStorage.getItem('userEmail');
      if (!em) { setLoading(false); return; }
      setEmail(em);
      const row = await fetchGospelerId(em);
      setId(row);
    } catch (e) {
      console.warn('[GospelerIdHub] fetch failed:', e?.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const u = navigation.addListener('focus', load);
    return u;
  }, [navigation, load]);

  const handleRegenerate = () => {
    Alert.alert(
      t('gid_regenerate_title', 'Regenerate Gospeler ID?'),
      t('gid_regenerate_msg',
        'Your current code and QR will be retired. The new code will replace it everywhere. This action cannot be undone.'),
      [
        { text: t('btn_cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('gid_regenerate', 'Regenerate'),
          style: 'destructive',
          onPress: async () => {
            setRegenerating(true);
            try {
              const fresh = await regenerateGospelerId(email, 'user_requested');
              setId(fresh);
              navigation.navigate('GospelerIdCard');
            } catch (e) {
              Alert.alert(t('error', 'Error'), e?.message || String(e));
            }
            setRegenerating(false);
          },
        },
      ],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      {/* Top bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}
          style={{
            width: 40, height: 40, borderRadius: 20, justifyContent: 'center',
            alignItems: 'center', backgroundColor: tk.surfaceEl,
          }}>
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} sw={2} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: tk.textPrimary }}>
          {t('gid_title', 'Gospeler ID')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={BLUE} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          style={{ opacity: fade, transform: [{ translateY }] }}
        >
          {id ? (
            <HasIdView
              id={id}
              tk={tk}
              t={t}
              regenerating={regenerating}
              onView={() => navigation.navigate('GospelerIdCard')}
              onEdit={() => navigation.navigate('GospelerIdForm', { mode: 'edit' })}
              onRegenerate={handleRegenerate}
            />
          ) : (
            <EmptyView
              tk={tk}
              t={t}
              email={email}
              onCreate={() => navigation.navigate('GospelerIdForm', { mode: 'create' })}
            />
          )}
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Empty state — user has not generated an ID yet ───────────────────────────
function EmptyView({ tk, t, email, onCreate }) {
  const benefits = [
    {
      Icon: ICONS.ShieldCheck,
      label: t('gid_benefit_verify_title', 'Church-verified identity'),
      sub: t('gid_benefit_verify_sub',
        'A trusted digital badge that confirms your membership at any event or service.'),
    },
    {
      Icon: ICONS.QrCode,
      label: t('gid_benefit_qr_title', 'Personal QR code'),
      sub: t('gid_benefit_qr_sub',
        'Scan in for attendance, retreats, and event check-ins — no paper, no queues.'),
    },
    {
      Icon: ICONS.Crown,
      label: t('gid_benefit_role_title', 'Role and ministry badges'),
      sub: t('gid_benefit_role_sub',
        'Member, Worker, Pastor, Youth — your role travels with your ID.'),
    },
    {
      Icon: ICONS.RefreshCw,
      label: t('gid_benefit_history_title', 'Lifetime ID history'),
      sub: t('gid_benefit_history_sub',
        'Every regeneration is preserved with version tracking and an audit trail.'),
    },
  ];

  return (
    <View>
      {/* Hero gradient banner */}
      <LinearGradient
        colors={[BLUE_DEEP, BLUE, '#3B82F6']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          marginHorizontal: 20, borderRadius: 24, padding: 24,
          shadowColor: BLUE, shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.25, shadowRadius: 24, elevation: 8,
        }}
      >
        {/* Soft light orb — purely decorative */}
        <View style={{
          position: 'absolute', top: -30, right: -30, width: 140, height: 140,
          borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.12)',
        }} />
        <View style={{
          width: 56, height: 56, borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.18)',
          justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        }}>
          <ICONS.ShieldCheck color="#fff" size={28} sw={2} />
        </View>
        <Text style={{
          fontSize: 9, fontWeight: '900', letterSpacing: 2.5,
          color: 'rgba(255,255,255,0.85)', marginBottom: 6,
        }}>
          {t('gid_eyebrow', 'YOUR DIGITAL CHRISTIAN IDENTITY')}
        </Text>
        <Text style={{
          fontSize: 26, fontWeight: '900', letterSpacing: -0.5,
          color: '#fff', marginBottom: 8,
        }}>
          {t('gid_empty_title', 'Create your\nGospeler ID')}
        </Text>
        <Text style={{
          fontSize: 13, fontWeight: '500', lineHeight: 19,
          color: 'rgba(255,255,255,0.88)',
        }}>
          {t('gid_empty_sub',
            'A unique, beautiful digital membership card you can carry into every service, retreat, and conference.')}
        </Text>
      </LinearGradient>

      {/* Benefits */}
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
        <Text style={{
          fontSize: 10, fontWeight: '900', letterSpacing: 2.5,
          color: tk.textMuted, marginBottom: 12,
        }}>
          {t('gid_whats_inside', 'WHAT’S INSIDE')}
        </Text>
      </View>

      <View style={{
        marginHorizontal: 20, borderRadius: 20, overflow: 'hidden',
        backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
      }}>
        {benefits.map((b, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row', alignItems: 'flex-start',
              paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: i === benefits.length - 1 ? 0 : 1,
              borderBottomColor: tk.border,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: BLUE_LIGHT,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <b.Icon color={BLUE} size={20} sw={1.9} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: tk.textPrimary, marginBottom: 3 }}>
                {b.label}
              </Text>
              <Text style={{ fontSize: 12, color: tk.textMuted, lineHeight: 17 }}>{b.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <TouchableOpacity onPress={onCreate} activeOpacity={0.88}>
          <LinearGradient
            colors={[BLUE_DEEP, BLUE]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 16, borderRadius: 16,
              alignItems: 'center', flexDirection: 'row',
              justifyContent: 'center', gap: 10,
              shadowColor: BLUE, shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
            }}
          >
            <ICONS.Plus color="#fff" size={20} sw={2.4} />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 }}>
              {t('gid_create_cta', 'Create my Gospeler ID')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {!!email && (
          <Text style={{ fontSize: 11, color: tk.textMuted, textAlign: 'center', marginTop: 10 }}>
            {t('gid_signed_in_as', 'Signed in as')} {email}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Has-ID state — preview tile + action rows ────────────────────────────────
function HasIdView({ id, tk, t, regenerating, onView, onEdit, onRegenerate }) {
  const initials = (id.full_name || 'G').trim().split(/\s+/).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '').join('') || 'G';
  const roleLabel = ROLE_LABEL[id.membership_role] || 'Member';

  return (
    <View>
      {/* Glass preview card — tap to open full ID */}
      <TouchableOpacity onPress={onView} activeOpacity={0.92}>
        <LinearGradient
          colors={[BLUE_DEEP, BLUE, '#60A5FA']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            marginHorizontal: 20, borderRadius: 22, padding: 20,
            shadowColor: BLUE, shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
            overflow: 'hidden',
          }}
        >
          {/* Decorative light blobs */}
          <View style={{
            position: 'absolute', top: -40, right: -20, width: 160, height: 160,
            borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)',
          }} />
          <View style={{
            position: 'absolute', bottom: -50, left: -30, width: 140, height: 140,
            borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)',
          }} />

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Avatar */}
            <View style={{
              width: 56, height: 56, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.22)',
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
              overflow: 'hidden',
            }}>
              {id.photo_base64 ? (
                <Image source={{ uri: id.photo_base64 }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{initials}</Text>
              )}
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{
                fontSize: 9, fontWeight: '900', letterSpacing: 2,
                color: 'rgba(255,255,255,0.85)', marginBottom: 4,
              }}>
                {t('gid_card_eyebrow', 'GOSPELER ID')}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff' }}
                numberOfLines={1}>
                {[id.title, id.full_name].filter(Boolean).join(' ') || ''}
              </Text>
              <Text style={{
                fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)',
                marginTop: 2,
              }} numberOfLines={1}>
                {id.assembly || id.church_name || t('gid_card_no_church', 'No church set')}
              </Text>
            </View>
          </View>

          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 18, paddingTop: 14,
            borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)',
          }}>
            <View>
              <Text style={{
                fontSize: 9, fontWeight: '800', letterSpacing: 1.8,
                color: 'rgba(255,255,255,0.75)', marginBottom: 3,
              }}>
                {t('gid_code_label', 'CODE')}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }}>
                {id.gospeler_code}
              </Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.22)',
              paddingHorizontal: 10, paddingVertical: 5,
              borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5,
            }}>
              <ICONS.Crown color="#fff" size={12} sw={2} />
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
                {roleLabel.toUpperCase()}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Meta strip */}
      <View style={{
        flexDirection: 'row', marginHorizontal: 20, marginTop: 14, gap: 10,
      }}>
        <MetaPill
          tk={tk}
          label={t('gid_version', 'Version')}
          value={`v${id.version}`}
        />
        <MetaPill
          tk={tk}
          label={t('gid_issued', 'Issued')}
          value={fmtDate(id.issued_at)}
        />
        <MetaPill
          tk={tk}
          label={t('gid_status', 'Status')}
          value={id.verified ? t('gid_verified', 'Verified') : t('gid_active', 'Active')}
          tone={id.verified ? 'green' : 'blue'}
        />
      </View>

      {/* Actions */}
      <View style={{ paddingTop: 22, paddingHorizontal: 20 }}>
        <Text style={{
          fontSize: 10, fontWeight: '900', letterSpacing: 2.5,
          color: tk.textMuted, marginBottom: 12,
        }}>
          {t('gid_actions', 'MANAGE')}
        </Text>
      </View>
      <View style={{
        marginHorizontal: 20, borderRadius: 20, overflow: 'hidden',
        backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
      }}>
        <ActionRow Icon={ICONS.QrCode}
          label={t('gid_view_full', 'View digital ID card')}
          sub={t('gid_view_full_sub', 'Open the full-screen card with QR')}
          tk={tk} onPress={onView} />
        <ActionRow Icon={ICONS.Edit}
          label={t('gid_edit_info', 'Edit information')}
          sub={t('gid_edit_info_sub',
            'Updating name, church, branch, or role will regenerate the code')}
          tk={tk} onPress={onEdit} />
        <ActionRow Icon={ICONS.RefreshCw}
          label={t('gid_regen', 'Regenerate ID')}
          sub={t('gid_regen_sub',
            'Mint a new code and QR — the current version is archived')}
          tk={tk} onPress={onRegenerate}
          right={regenerating ? <ActivityIndicator color={BLUE} size="small" /> : null}
          danger
          noBorder />
      </View>
    </View>
  );
}

// ─── Small building blocks ────────────────────────────────────────────────────
function MetaPill({ tk, label, value, tone = 'neutral' }) {
  const toneColor =
    tone === 'green' ? '#059669' :
    tone === 'blue'  ? BLUE :
    tk.textPrimary;
  return (
    <View style={{
      flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
      backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
    }}>
      <Text style={{
        fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
        color: tk.textMuted, marginBottom: 4,
      }}>
        {String(label || '').toUpperCase()}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '900', color: toneColor }} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );
}

function ActionRow({ Icon, label, sub, onPress, tk, right, danger, noBorder }) {
  const tint = danger ? '#DC2626' : BLUE;
  return (
    <TouchableOpacity
      onPress={onPress} activeOpacity={0.78}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 15,
        borderBottomWidth: noBorder ? 0 : 1, borderBottomColor: tk.border,
      }}
    >
      <View style={{
        width: 42, height: 42, borderRadius: 13,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: danger ? '#FEE2E2' : BLUE_LIGHT,
      }}>
        <Icon color={tint} size={20} sw={1.9} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: danger ? '#DC2626' : tk.textPrimary }}>
          {label}
        </Text>
        {!!sub && (
          <Text style={{ fontSize: 12, color: tk.textMuted, marginTop: 2 }} numberOfLines={2}>
            {sub}
          </Text>
        )}
      </View>
      {right || <ICONS.ChevronRight color={tk.textMuted} size={18} sw={1.9} />}
    </TouchableOpacity>
  );
}
