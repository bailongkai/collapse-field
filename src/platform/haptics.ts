import { Capacitor } from '@capacitor/core';
import type * as HapticsNs from '@capacitor/haptics';

export type HapticKind = 'light' | 'medium' | 'heavy';

let plugin: Promise<typeof HapticsNs | null> | null = null;
let lastAt = 0;

/**
 * A tap through the phone for the moments that matter: a hit taken, a level, a chest, a boss
 * down. Nothing on the web, and never more than ten a second so a swarm cannot turn into a buzz.
 */
export function haptic(kind: HapticKind): void {
  if (!Capacitor.isNativePlatform()) return;
  const now = performance.now();
  if (now - lastAt < 100) return;
  lastAt = now;
  plugin ??= import('@capacitor/haptics').catch(() => null);
  void plugin.then((m) => {
    if (!m) return;
    const style = kind === 'light' ? m.ImpactStyle.Light : kind === 'medium' ? m.ImpactStyle.Medium : m.ImpactStyle.Heavy;
    return m.Haptics.impact({ style });
  }).catch(() => undefined);
}
