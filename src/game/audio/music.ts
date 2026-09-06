/**
 * Procedural ambient score. There is no CC0 music in the Kenney packs, and a downloaded track
 * would need its own licence check, so the game synthesises its own: a slow bass drone, a filtered
 * pad and a sparse arpeggio in a minor pentatonic, driven by the Web Audio clock. It lives entirely
 * on the presentation side and never touches the simulation.
 */
const ROOT_HZ = 55; // A1
const PENTATONIC = [0, 3, 5, 7, 10, 12, 15]; // minor pentatonic across an octave and a half
const STEP_SEC = 0.5;

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteAt = 0;
  private step = 0;
  private volume = 0.35;
  private intensity = 0;
  private enabled = false;
  private seed = 7;

  /** Starts on a user gesture (the menu Start button); no-op when disabled or unsupported. */
  start(getContext: () => AudioContext | null): void {
    if (this.timer || !this.enabled) return;
    const ctx = getContext();
    if (!ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 2);

    this.drone(ROOT_HZ);
    this.drone(ROOT_HZ * 1.5, 0.35);
    this.nextNoteAt = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  isPlaying(): boolean {
    return this.timer !== null;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.2);
  }

  /** 0..1, raises the arpeggio density and brightness as the run heats up. */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.master && this.ctx) {
      const m = this.master;
      m.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      setTimeout(() => m.disconnect(), 1500);
    }
    this.master = null;
    this.ctx = null;
  }

  private drone(freq: number, gain = 0.6): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.value = gain * 0.25;
    osc.connect(filter).connect(g).connect(this.master);
    osc.start();
    // slow breathing on the filter so the drone never sits still
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
  }

  private rng(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /** Look-ahead scheduler: fills the next ~250 ms of the sequence on each tick. */
  private schedule(): void {
    if (!this.ctx || !this.master) return;
    while (this.nextNoteAt < this.ctx.currentTime + 0.25) {
      const density = 0.25 + this.intensity * 0.55;
      if (this.rng() < density) {
        const degree = PENTATONIC[Math.floor(this.rng() * PENTATONIC.length)];
        const octave = this.rng() < 0.3 + this.intensity * 0.4 ? 3 : 2;
        this.pluck(ROOT_HZ * Math.pow(2, octave) * Math.pow(2, degree / 12), this.nextNoteAt);
      }
      this.step++;
      this.nextNoteAt += STEP_SEC * (this.intensity > 0.7 && this.step % 2 === 0 ? 0.5 : 1);
    }
  }

  private pluck(freq: number, at: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.18, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.9);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900 + this.intensity * 1800;
    osc.connect(filter).connect(g).connect(this.master);
    osc.start(at);
    osc.stop(at + 1);
  }
}

export const music = new Music();
