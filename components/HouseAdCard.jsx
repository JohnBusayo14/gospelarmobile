// components/HouseAdCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Gospelar's own announcement / sponsor banner (managed in the admin dashboard,
// served by /api/banners/active), shown as a normal inline card on the Library.
//
// Replaces the old full-screen popup (AdBanner), which opened itself over the
// app a few seconds after launch — Google Play treats ads that appear
// unexpectedly or cover app content as "disruptive". This card:
//   • sits in the page like any other card, never over content
//   • is labelled "Sponsored"
//   • has a clearly visible ✕ and only opens its link when the card is tapped
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { API_BASE_URL } from '../context/SubscriptionContext';

const dismissedIds = new Set();   // per session

export default function HouseAdCard({ tk }) {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/banners/active`);
        if (!res.ok) return;
        const { banner: b } = await res.json();
        if (alive && b && !dismissedIds.has(b.id)) setBanner(b);
      } catch { /* offline → nothing to show */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!banner) return null;

  const img = banner.image_base64
    ? { uri: `data:image/jpeg;base64,${banner.image_base64}` }
    : banner.image_url ? { uri: banner.image_url } : null;

  const close = () => { dismissedIds.add(banner.id); setBanner(null); };
  const open  = () => { if (banner.link_url) Linking.openURL(banner.link_url).catch(() => {}); };

  return (
    <View style={[s.card, { backgroundColor: tk?.surfaceEl || '#F3F4F6' }]}>
      <View style={s.head}>
        <Text style={[s.label, { color: tk?.textMuted || '#6B7280' }]}>SPONSORED</Text>
        <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Text style={[s.x, { color: tk?.textMuted || '#6B7280' }]}>✕</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity activeOpacity={banner.link_url ? 0.88 : 1} onPress={open}>
        {img ? <Image source={img} style={s.img} resizeMode="cover" /> : null}
        {!!banner.title && (
          <Text style={[s.title, { color: tk?.textPrimary || '#111' }]} numberOfLines={2}>{banner.title}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card:  { marginHorizontal: 20, marginBottom: 18, borderRadius: 16, padding: 12 },
  head:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  x:     { fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
  img:   { width: '100%', aspectRatio: 16 / 9, borderRadius: 10 },
  title: { fontSize: 14, fontWeight: '700', marginTop: 8 },
});
