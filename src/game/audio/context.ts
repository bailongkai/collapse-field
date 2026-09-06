import type Phaser from 'phaser';

/** The Web Audio context behind Phaser's sound manager, or null on the no-audio / HTML5 paths. */
export function audioContextOf(manager: Phaser.Sound.BaseSoundManager): AudioContext | null {
  const ctx = (manager as unknown as { context?: AudioContext }).context;
  if (!ctx) return null;
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
