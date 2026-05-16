// screen/gospelerId/GospelerIdCardScreen.jsx
// The signature surface of the Gospeler ID feature: a premium glassmorphic
// digital membership card. Modelled on Apple Wallet / Revolut card aesthetics
// while staying church-flavoured via worship-blue gradient + soft light orbs.
//
// What renders:
//   • Hero card — gradient, decorative light blobs, photo or initials,
//     full name, role badge, church + branch, verification chip.
//   • QR — uses react-native-qrcode-svg. Payload is the opaque gospeler_ids.id
//     (NOT the human code) so scanning hits POST /api/gospeler-id/verify/:token.
//   • Identity strip — code, version, issued date, country/state, DOB.
//   • Actions — Share (native), Download (placeholder), and a quick link back
//     to the form for edits. Regenerate lives one tap deeper in the Hub.
//
// Share/Download in this slice: Share opens a native sheet with the verify-URL
// + member summary as plain text (works without extra deps). Download is a
// visible stub that pings the user to expect it in the next release — the
// alternative (snapshotting the view to a PNG/PDF) needs react-native-view-shot
// + expo-sharing which are deliberately out of scope for the first slice.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator,
  StatusBar, Alert, Share, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';

import { ICONS } from '../components/icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';
import { fetchGospelerId, API_BASE_URL } from '../services/api';

const BLUE = '#1A56DB';
const BLUE_DEEP = '#1E3A8A';

const ROLE_LABEL = {
  member: 'Member', worker: 'Worker', pastor: 'Pastor',
  youth: 'Youth', leader: 'Leader', minister: 'Minister',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return '—'; }
};

export default function GospelerIdCardScreen({ navigation }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const em = await AsyncStorage.getItem('userEmail');
      if (!em) { setLoading(false); return; }
      const row = await fetchGospelerId(em);
      setId(row);
    } catch (e) {
      console.warn('[GospelerIdCard] fetch failed:', e?.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const u = navigation.addListener('focus', load);
    return u;
  }, [navigation, load]);

  // QR payload: the verify-URL the server resolves to. Includes the opaque
  // gospeler_ids.id (rotates on every regeneration) so a leaked screenshot
  // becomes invalid the moment the user regenerates.
  const verifyUrl = id ? `${API_BASE_URL}/api/gospeler-id/verify/${id.id}` : '';

  const handleShare = async () => {
    if (!id) return;
    try {
      // Prefer the structured webapp-aligned fields when present; fall back
      // to legacy church_name / branch for pre-migration rows.
      const placeLine = id.assembly
        ? [id.assembly, id.district, id.region].filter(Boolean).join(' · ')
        : [id.church_name, id.church_branch].filter(Boolean).join(' · ');
      await Share.share({
        message: [
          `Gospeler ID — ${[id.title, id.full_name].filter(Boolean).join(' ')}`,
          `Code: ${id.gospeler_code}`,
          placeLine ? `Church: ${placeLine}` : null,
          id.church_status ? `Status: ${id.church_status}` : null,
          `Role: ${ROLE_LABEL[id.membership_role] || 'Member'}`,
          `Verify: ${verifyUrl}`,
        ].filter(Boolean).join('\n'),
      });
    } catch { /* user cancelled */ }
  };

  const handleDownload = () => {
    Alert.alert(
      t('gid_download_title', 'Download coming soon'),
      t('gid_download_msg',
        'You’ll soon be able to save your Gospeler ID as a high-resolution image and PDF. For now, please use Share.'),
      [{ text: t('btn_ok', 'OK') }],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

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
          {t('gid_card_title', 'My Gospeler ID')}
        </Text>
        <TouchableOpacity onPress={handleShare} activeOpacity={0.75}
          accessibilityLabel="Share"
          style={{
            width: 40, height: 40, borderRadius: 20, justifyContent: 'center',
            alignItems: 'center', backgroundColor: tk.surfaceEl,
          }}>
          <ICONS.Share color={tk.textPrimary} size={18} sw={1.9} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={BLUE} size="large" />
        </View>
      ) : !id ? (
        <NoCard tk={tk} t={t}
          onCreate={() => navigation.replace('GospelerIdForm', { mode: 'create' })} />
      ) : (
        <Animated.ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          style={{ opacity: fade, transform: [{ translateY }] }}
        >
          <CardArtwork id={id} verifyUrl={verifyUrl} t={t} />

          {/* Identity strip */}
          <View style={{
            marginHorizontal: 20, marginTop: 18, borderRadius: 18,
            backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
            overflow: 'hidden',
          }}>
            <DetailRow label={t('gid_code_label', 'Gospeler code')} value={id.gospeler_code} tk={tk} mono />
            <DetailRow label={t('gid_version', 'Version')}          value={`v${id.version}`} tk={tk} />
            <DetailRow label={t('gid_issued', 'Issued')}            value={fmtDate(id.issued_at)} tk={tk} />
            <DetailRow label={t('gid_updated', 'Last updated')}     value={fmtDate(id.updated_at)} tk={tk} />
            <DetailRow label={t('gid_role', 'Role')}                value={ROLE_LABEL[id.membership_role] || 'Member'} tk={tk} />
            {!!id.church_status && (
              <DetailRow label={t('gid_status', 'Status')} value={id.church_status} tk={tk} mono />
            )}
            {!!id.age_bracket && (
              <DetailRow label={t('gid_age_bracket', 'Age bracket')} value={id.age_bracket} tk={tk} />
            )}
            <DetailRow label={t('gid_phone', 'Phone')}              value={id.phone || '—'} tk={tk} />
            <DetailRow label={t('gid_country', 'Country')}          value={id.country || '—'} tk={tk} />
            {!!id.city && (
              <DetailRow label={t('gid_city', 'City')} value={id.city} tk={tk} />
            )}
            {!!id.region && (
              <DetailRow label={t('gid_region', 'Region')} value={id.region} tk={tk} />
            )}
            {!!id.district && (
              <DetailRow label={t('gid_district', 'District')} value={id.district} tk={tk} />
            )}
            {!!id.assembly && (
              <DetailRow label={t('gid_assembly', 'Assembly')} value={id.assembly} tk={tk} />
            )}
            <DetailRow label={t('gid_dob', 'Date of birth')}        value={id.date_of_birth ? fmtDate(id.date_of_birth) : '—'} tk={tk} noBorder />
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 18, gap: 10 }}>
            <ActionTile
              Icon={ICONS.Share} label={t('gid_btn_share', 'Share')}
              onPress={handleShare} tk={tk} />
            <ActionTile
              Icon={ICONS.Download} label={t('gid_btn_download', 'Download')}
              onPress={handleDownload} tk={tk} />
            <ActionTile
              Icon={ICONS.Edit} label={t('gid_btn_edit', 'Edit')}
              onPress={() => navigation.navigate('GospelerIdForm', { mode: 'edit' })}
              tk={tk} />
          </View>

          <Text style={{
            paddingHorizontal: 28, marginTop: 22, fontSize: 11, lineHeight: 16,
            color: tk.textMuted, textAlign: 'center',
          }}>
            {t('gid_card_footer',
              'Show this QR at the church entrance, retreat check-in, or any Gospeler-verified event. The QR is unique to your current Gospeler ID and rotates on every regeneration.')}
          </Text>
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── The card artwork (gradient hero) ─────────────────────────────────────────
// All the visual weight of the feature lives here. Two stacked decorative
// orbs + a 3-stop gradient produce the "Ethereal" lit-from-within feel; the
// real content sits on top in a column.
function CardArtwork({ id, verifyUrl, t }) {
  const initials = (id.full_name || 'G').trim().split(/\s+/).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '').join('') || 'G';
  const roleLabel = ROLE_LABEL[id.membership_role] || 'Member';
  // Display name prefixed with the title ("Pastor John Doe"). Falls back
  // to the bare name when no title is on file.
  const displayName = [id.title, id.full_name].filter(Boolean).join(' ');
  // Webapp-aligned Status (PASTOR, ELD, HOD, etc.). Renders alongside the
  // friendly role label as a small monospaced code chip — feels official
  // and matches how the registration webapp's badges look.
  const churchStatus = id.church_status || '';
  // Church location string. Prefer the structured (assembly · district · region)
  // shape when present; fall back to the older (church_name / church_branch)
  // pair for rows minted before the webapp-alignment migration.
  const placeLines = (() => {
    if (id.assembly || id.district || id.region) {
      return {
        primary: id.assembly || id.district || id.region,
        secondary: [id.district, id.region].filter(Boolean).join(' · ') || null,
      };
    }
    return {
      primary: id.church_name || t('gid_no_church', 'No church set'),
      secondary: id.church_branch || null,
    };
  })();

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <LinearGradient
        colors={[BLUE_DEEP, BLUE, '#60A5FA']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 26, padding: 24, overflow: 'hidden',
          shadowColor: BLUE, shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.35, shadowRadius: 28, elevation: 10,
        }}
      >
        {/* Decorative orbs */}
        <View style={{
          position: 'absolute', top: -60, right: -40, width: 200, height: 200,
          borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.14)',
        }} />
        <View style={{
          position: 'absolute', bottom: -80, left: -50, width: 220, height: 220,
          borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)',
        }} />
        <View style={{
          position: 'absolute', top: 100, left: 60, width: 80, height: 80,
          borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)',
        }} />

        {/* Top row */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <View>
            <Text style={{
              fontSize: 9, fontWeight: '900', letterSpacing: 2.5,
              color: 'rgba(255,255,255,0.85)', marginBottom: 4,
            }}>
              {t('gid_card_eyebrow', 'GOSPELER ID')}
            </Text>
            <Text style={{
              fontSize: 10, fontWeight: '700',
              color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3,
            }}>
              {t('gid_card_subline', 'Digital Christian Identity')}
            </Text>
          </View>
          <VerificationChip verified={id.verified} t={t} />
        </View>

        {/* Avatar + name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22 }}>
          <View style={{
            width: 68, height: 68, borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.22)',
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
            overflow: 'hidden',
          }}>
            {id.photo_base64 ? (
              <Image source={{ uri: id.photo_base64 }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{initials}</Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{
              fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3,
            }} numberOfLines={2}>
              {displayName || t('gid_no_name', 'No name yet')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.22)',
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                flexDirection: 'row', alignItems: 'center', gap: 5,
              }}>
                <ICONS.Crown color="#fff" size={11} sw={2} />
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
                  {roleLabel.toUpperCase()}
                </Text>
              </View>
              {!!churchStatus && churchStatus !== roleLabel.toUpperCase() && (
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.32)',
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
                    {churchStatus}
                  </Text>
                </View>
              )}
              {!!id.age_bracket && (
                <Text style={{
                  fontSize: 11, fontWeight: '600',
                  color: 'rgba(255,255,255,0.85)',
                }} numberOfLines={1}>
                  {id.age_bracket}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Church location — prefers the structured assembly/district/region
            block from the webapp-aligned form; falls back to legacy church
            name + branch for pre-migration rows. */}
        <View style={{
          marginTop: 18, paddingTop: 16,
          borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)',
        }}>
          <Text style={{
            fontSize: 9, fontWeight: '800', letterSpacing: 1.8,
            color: 'rgba(255,255,255,0.75)', marginBottom: 4,
          }}>
            {t('gid_church_label', 'CHURCH')}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }} numberOfLines={1}>
            {placeLines.primary}
          </Text>
          {!!placeLines.secondary && (
            <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}
              numberOfLines={1}>
              {placeLines.secondary}
            </Text>
          )}
        </View>

        {/* Bottom: code + QR */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
          marginTop: 18,
        }}>
          <View style={{ flex: 1, paddingRight: 14 }}>
            <Text style={{
              fontSize: 9, fontWeight: '800', letterSpacing: 1.8,
              color: 'rgba(255,255,255,0.75)', marginBottom: 4,
            }}>
              {t('gid_code_label', 'CODE')}
            </Text>
            <Text style={{
              fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.5,
            }} numberOfLines={1}>
              {id.gospeler_code}
            </Text>
            <Text style={{
              fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
              color: 'rgba(255,255,255,0.7)', marginTop: 8,
            }}>
              {t('gid_card_version_issued', 'v{v} · Issued {date}')
                .replace('{v}', id.version)
                .replace('{date}', fmtDate(id.issued_at))}
            </Text>
          </View>

          {/* QR — white tile so the dark QR stays readable on the gradient. */}
          <View style={{
            backgroundColor: '#fff', padding: 8, borderRadius: 14,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
          }}>
            <QRCode
              value={verifyUrl || id.gospeler_code}
              size={92}
              color={BLUE_DEEP}
              backgroundColor="#fff"
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function VerificationChip({ verified, t }) {
  const bg = verified ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.18)';
  const stroke = verified ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.3)';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
      backgroundColor: bg, borderWidth: 1, borderColor: stroke,
    }}>
      <ICONS.ShieldCheck color="#fff" size={12} sw={2.2} />
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
        {verified
          ? t('gid_verified_badge', 'CHURCH VERIFIED').toUpperCase()
          : t('gid_active_badge', 'ACTIVE').toUpperCase()}
      </Text>
    </View>
  );
}

function DetailRow({ label, value, tk, noBorder, mono }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: noBorder ? 0 : 1, borderBottomColor: tk.border,
    }}>
      <Text style={{
        fontSize: 12, fontWeight: '700', color: tk.textMuted,
        letterSpacing: 0.3,
      }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13, fontWeight: '800', color: tk.textPrimary,
          letterSpacing: mono ? 0.5 : 0,
          maxWidth: '60%', textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionTile({ Icon, label, onPress, tk }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78}
      style={{
        flex: 1, paddingVertical: 16, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
      }}>
      <Icon color={BLUE} size={20} sw={2} />
      <Text style={{ fontSize: 12, fontWeight: '800', color: tk.textPrimary, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Edge case: user lands on the card screen but no ID exists yet. Should
// only happen on a manual deep-link or stale navigation state.
function NoCard({ tk, t, onCreate }) {
  return (
    <View style={{
      flex: 1, justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 32,
    }}>
      <View style={{
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: tk.surfaceEl,
        justifyContent: 'center', alignItems: 'center', marginBottom: 18,
      }}>
        <ICONS.ShieldCheck color={BLUE} size={36} sw={1.8} />
      </View>
      <Text style={{
        fontSize: 18, fontWeight: '900', color: tk.textPrimary,
        marginBottom: 6, textAlign: 'center',
      }}>
        {t('gid_nocard_title', 'No Gospeler ID yet')}
      </Text>
      <Text style={{
        fontSize: 13, color: tk.textMuted, textAlign: 'center',
        lineHeight: 19, marginBottom: 20,
      }}>
        {t('gid_nocard_msg', 'Create yours in a few quick steps and start using it everywhere.')}
      </Text>
      <TouchableOpacity onPress={onCreate} activeOpacity={0.88}>
        <LinearGradient
          colors={[BLUE_DEEP, BLUE]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{
            paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>
            {t('gid_create_cta', 'Create my Gospeler ID')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}
