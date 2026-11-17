// components/games/RewardButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One gate for every game lifeline / hint / second chance:
//
//   const gate = useRewardGate(2);          // 2 free uses per game
//   <RewardButton gate={gate} label="50:50" onReward={applyFifty} />
//   await gate.request()                    // → true when the reward is granted
//
// How a reward is "paid for", in order:
//   1. Premium (ad-free)        → always free, unlimited.
//   2. A rewarded ad is ready   → the player watches it; reward only when the
//                                 ad reports EARNED_REWARD.
//   3. Free uses left           → used up one by one (children, teachers, no
//                                 ad loaded, no rewarded unit yet, offline).
//   4. Otherwise                → button disabled. Play is never blocked.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, ActivityIndicator } from 'react-native';
import { isAdFree, rewardedAvailable, showRewarded, subscribeAds } from '../../services/ads';
import { gt } from '../../data/games/strings';

export function useRewardGate(freeUses = 2) {
  const [freeLeft, setFreeLeft] = useState(freeUses);
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const busyRef = useRef(false);

  // Re-render when an ad finishes loading or Premium status changes.
  useEffect(() => subscribeAds(() => force((n) => n + 1)), []);

  const premium = isAdFree();
  const adReady = !premium && rewardedAvailable();
  const mode = premium ? 'premium' : adReady ? 'ad' : freeLeft > 0 ? 'free' : 'none';

  const request = useCallback(async () => {
    if (busyRef.current) return false;
    if (isAdFree()) return true;
    if (rewardedAvailable()) {
      busyRef.current = true; setBusy(true);
      try { return await showRewarded(); }
      finally { busyRef.current = false; setBusy(false); }
    }
    if (freeLeft > 0) { setFreeLeft((n) => n - 1); return true; }
    return false;
  }, [freeLeft]);

  const reset = useCallback(() => setFreeLeft(freeUses), [freeUses]);

  return { mode, freeLeft, busy, request, reset };
}

// Small caption describing how this lifeline will be paid for.
export function gateCaption(gate, lang) {
  if (gate.mode === 'premium') return gt(lang, 'premium_free');
  if (gate.mode === 'ad')      return gt(lang, 'watch_ad');
  if (gate.mode === 'free')    return gt(lang, 'use_free', { n: gate.freeLeft });
  return '';
}

export default function RewardButton({
  gate, label, icon, onReward, used = false, disabled = false, lang = 'en', tk, accent = '#DB2777',
}) {
  const off = used || disabled || gate.mode === 'none' || gate.busy;
  const press = async () => {
    if (off) return;
    if (await gate.request()) onReward?.();
  };
  return (
    <TouchableOpacity
      onPress={press}
      disabled={off}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={`${label}. ${gateCaption(gate, lang)}`}
      style={[
        s.btn,
        { borderColor: off ? tk.border : accent + '66', backgroundColor: off ? tk.surface : accent + '14', opacity: used ? 0.45 : 1 },
      ]}
    >
      <View style={s.row}>
        {gate.busy ? <ActivityIndicator size="small" color={accent} /> : icon}
        <Text style={[s.label, { color: off ? tk.textMuted : accent }]}>{label}</Text>
      </View>
      {!used && gate.mode !== 'none' && (
        <Text style={[s.cap, { color: tk.textMuted }]} numberOfLines={1}>
          {gate.mode === 'ad' ? '▶ ' : ''}{gateCaption(gate, lang)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn:   { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1.5, paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 14, fontWeight: '800' },
  cap:   { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
});
