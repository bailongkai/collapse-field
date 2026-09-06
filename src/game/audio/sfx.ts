import type Phaser from 'phaser';

export const SFX_KEYS = ['fire', 'rail', 'emp', 'boss', 'explode', 'hit', 'death', 'hurt', 'gem', 'levelup', 'pickup', 'click'] as const;
export type SfxKey = (typeof SFX_KEYS)[number];

const PER_KEY_CAP = 4;
const GLOBAL_CAP = 16;
const MIN_INTERVAL_MS = 40;

/**
 * Pooled, rate-limited SFX bus. Sound instances are created once in init(); play() reuses idle
 * instances and drops calls when caps are exceeded. Muted busses never touch a Sound object.
 */
class SfxBus {
  private manager: Phaser.Sound.BaseSoundManager | null = null;
  private pools = new Map<SfxKey, Phaser.Sound.BaseSound[]>();
  private lastPlay = new Map<SfxKey, number>();
  private muted = false;
  private volume = 0.8;
  private rng = 1;

  init(manager: Phaser.Sound.BaseSoundManager, opts: { muted: boolean; volume: number }): void {
    this.manager = manager;
    this.muted = opts.muted;
    this.volume = opts.volume;
    this.pools.clear();
    if (this.muted) return;
    for (const key of SFX_KEYS) {
      if (!manager.game.cache.audio.exists(key)) continue;
      const list: Phaser.Sound.BaseSound[] = [];
      for (let i = 0; i < PER_KEY_CAP; i++) list.push(manager.add(key));
      this.pools.set(key, list);
    }
  }

  setMuted(on: boolean): void {
    this.muted = on;
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
  }

  isMuted(): boolean {
    return this.muted;
  }

  activeCount(): number {
    let n = 0;
    for (const list of this.pools.values()) for (const s of list) if (s.isPlaying) n++;
    return n;
  }

  play(key: SfxKey, o: { volume?: number; rate?: number } = {}): boolean {
    if (this.muted || !this.manager || this.manager.locked) return false;
    const list = this.pools.get(key);
    if (!list) return false;
    const now = performance.now();
    const last = this.lastPlay.get(key) ?? -1e9;
    if (now - last < MIN_INTERVAL_MS) return false;
    if (this.activeCount() >= GLOBAL_CAP) return false;
    const snd = list.find((s) => !s.isPlaying);
    if (!snd) return false;
    // cheap deterministic-enough jitter; audio is not part of the simulation
    this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff;
    const jitter = 0.95 + (this.rng / 0x7fffffff) * 0.1;
    snd.play({ volume: this.volume * (o.volume ?? 1), rate: (o.rate ?? 1) * jitter });
    this.lastPlay.set(key, now);
    return true;
  }

  pauseAll(): void {
    this.manager?.pauseAll();
  }

  resumeAll(): void {
    this.manager?.resumeAll();
  }
}

export const sfx = new SfxBus();
