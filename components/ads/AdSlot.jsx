// components/ads/AdSlot.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Adaptive AdMob banner that fits inline in a list or above a tab bar.
//   • Renders nothing (zero height) until an ad has actually loaded, and again
//     if loading fails — never a blank grey gap.
//   • Re-requests when the child-safe audience setting changes.
//   • Shows a small "Advertisement" label (Google policy: ads must be
//     distinguishable from content).
//
//   <AdSlot category={categoryId} />       // category keeps child mode accurate
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  adsReady, bannersAllowed, adsChildMode, bannerUnitId, getGMA,
  subscribeAds, setAudience, isChildCategory,
} from '../../services/ads';

export default function AdSlot({ category, style, dark = false, enabled = true }) {
  const [, force] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Tell the ad service which audience is on screen (child-safe settings).
  useEffect(() => { if (category) setAudience(category); }, [category]);

  // Re-render when the SDK becomes ready or the audience mode flips.
  useEffect(() => subscribeAds(() => { setFailed(false); setLoaded(false); force((n) => n + 1); }), []);

  const GMA = getGMA();
  // No ads for children/intermediate, on screens with nothing to show yet, or
  // before the SDK + consent are ready.
  if (!enabled || isChildCategory(category)) return null;
  if (!GMA || !adsReady() || !bannersAllowed() || failed) return null;

  const { BannerAd, BannerAdSize } = GMA;
  return (
    <View style={[s.wrap, !loaded && s.hidden, style]} pointerEvents={loaded ? 'auto' : 'none'}>
      <Text style={[s.label, dark && { color: '#9CA3AF' }]}>Advertisement</Text>
      <BannerAd
        unitId={bannerUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: adsChildMode() }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => { setLoaded(false); setFailed(true); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  // Generous vertical space so the ad is never jammed against a tappable card
  // or button (accidental clicks are an AdMob policy violation).
  wrap:   { alignItems: 'center', marginVertical: 24, overflow: 'hidden' },
  // Keep mounted (so it can load) but take no space until there is an ad.
  hidden: { height: 0, marginVertical: 0, opacity: 0 },
  label:  { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: '#6B7280', marginBottom: 2 },
});
