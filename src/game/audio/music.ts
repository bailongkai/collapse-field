import { MOODS, LOOP_STEPS, semitoneToHz, stepEvents, stepSeconds, type Mood } from './score';

/**
 * The score, made audible. There is no CC0 music in the art packs and a licensed track would cost
 * megabytes and a licence check, so the game plays its own: a pad, a bass, an arpeggio and a drum
 * kit, all synthesised on the Web Audio clock from the arrangement in `score.ts`.
 *
 * It runs on the presentation side and never touches the simulation. Mood changes (menu, fight,
 * boss, final) take effect on the next bar, so a boss arriving never cuts a note in half.
 */
export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Record<'pad' | 'bass' | 'arp' | 'drums', GainNode | null> = { pad: null, bass: null, arp: null, drums: null };
  private padFilter: BiquadFilterNode | null = null;
  private padVoices: { osc: OscillatorNode; gain: GainNode }[] = [];
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteAt = 0;
  private step = 0;
  private volume = 0.35;
  private intensity = 0;
  private enabled = false;
  private seed = 7;
  private mood: Mood = 'menu';
  private pendingMood: Mood | null = null;

  /** Starts on a user gesture (a press on the menu, or Start); no-op when disabled or unsupported. */
  start(getContext: () => AudioContext | null): void {
    if (this.timer || !this.enabled) return;
    const ctx = getContext();
    if (!ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 2);

    for (const key of ['pad', 'bass', 'arp', 'drums'] as const) {
      const g = ctx.createGain();
      g.gain.value = MOODS[this.mood][key];
      g.connect(this.master);
      this.layers[key] = g;
    }
    // the pad runs through one filter so brightness is a single knob per mood
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 300;
    this.padFilter.Q.value = 1.2;
    this.padFilter.connect(this.layers.pad!);
    this.buildNoise(ctx);

    this.nextNoteAt = ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 100);
  }

  isPlaying(): boolean {
    return this.timer !== null;
  }

  currentMood(): Mood {
    return this.mood;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.2);
  }

  /** 0..1, thickens the arpeggio and the kick pattern as the run heats up. */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  /** Queues a mood; it lands on the next bar so nothing is cut off mid-phrase. */
  setMood(mood: Mood): void {
    if (mood === this.mood && this.pendingMood === null) return;
    if (!this.timer) {
      this.mood = mood;
      this.applyMoodGains(0.01);
      return;
    }
    this.pendingMood = mood;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const v of this.padVoices) {
      try {
        v.osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.padVoices = [];
    if (this.master && this.ctx) {
      const m = this.master;
      m.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      setTimeout(() => m.disconnect(), 1500);
    }
    this.master = null;
    this.padFilter = null;
    this.layers = { pad: null, bass: null, arp: null, drums: null };
    this.ctx = null;
  }

  private applyMoodGains(time = 0.8): void {
    if (!this.ctx) return;
    const cfg = MOODS[this.mood];
    for (const key of ['pad', 'bass', 'arp', 'drums'] as const) {
      this.layers[key]?.gain.setTargetAtTime(cfg[key], this.ctx.currentTime, time);
    }
    this.padFilter?.frequency.setTargetAtTime(260 + cfg.brightness * 900, this.ctx.currentTime, time);
  }

  private buildNoise(ctx: AudioContext): void {
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = this.rng() * 2 - 1;
    this.noise = buf;
  }

  private rng(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /** Look-ahead scheduler: fills the next ~250 ms of the sequence on each tick. */
  private schedule(): void {
    if (!this.ctx || !this.master) return;
    while (this.nextNoteAt < this.ctx.currentTime + 0.25) {
      // a queued mood lands on a bar line, where the progression restarts anyway
      if (this.pendingMood && this.step % 16 === 0) {
        this.mood = this.pendingMood;
        this.pendingMood = null;
        this.applyMoodGains();
      }
      const at = this.nextNoteAt;
      const e = stepEvents(this.mood, this.step, this.intensity, () => this.rng());
      if (e.pad) this.voicePad(e.pad, at);
      if (e.bass !== null) this.bass(semitoneToHz(e.bass), at);
      if (e.arp !== null) this.pluck(semitoneToHz(e.arp), at);
      if (e.kick) this.kick(at);
      if (e.snare) this.snare(at);
      if (e.hat) this.hat(at);
      this.step = (this.step + 1) % LOOP_STEPS;
      this.nextNoteAt += stepSeconds(this.mood);
    }
  }

  /** Retunes the pad to a chord, gliding rather than retriggering so the bed never breaks. */
  private voicePad(chord: readonly number[], at: number): void {
    if (!this.ctx || !this.padFilter) return;
    while (this.padVoices.length < chord.length) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const gain = this.ctx.createGain();
      gain.gain.value = 0.14 / chord.length;
      osc.connect(gain).connect(this.padFilter);
      osc.start();
      this.padVoices.push({ osc, gain });
    }
    chord.forEach((semi, i) => {
      const v = this.padVoices[i];
      if (!v) return;
      // two octaves up from the bass register, and a slow glide into the new chord
      v.osc.frequency.setTargetAtTime(semitoneToHz(semi + 24), at, 0.12);
    });
  }

  private bass(freq: number, at: number): void {
    const layer = this.layers.bass;
    if (!this.ctx || !layer) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, at);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180 + this.intensity * 260, at);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.5, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.35);
    osc.connect(filter).connect(g).connect(layer);
    osc.start(at);
    osc.stop(at + 0.4);
  }

  private pluck(freq: number, at: number): void {
    const layer = this.layers.arp;
    if (!this.ctx || !layer) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.16, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.7);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100 + this.intensity * 2200;
    osc.connect(filter).connect(g).connect(layer);
    osc.start(at);
    osc.stop(at + 0.8);
  }

  private kick(at: number): void {
    const layer = this.layers.drums;
    if (!this.ctx || !layer) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.28);
    osc.connect(g).connect(layer);
    osc.start(at);
    osc.stop(at + 0.3);
  }

  private snare(at: number): void {
    const layer = this.layers.drums;
    if (!this.ctx || !layer || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    src.connect(hp).connect(g).connect(layer);
    src.start(at);
    src.stop(at + 0.2);
  }

  private hat(at: number): void {
    const layer = this.layers.drums;
    if (!this.ctx || !layer || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
    src.connect(hp).connect(g).connect(layer);
    src.start(at);
    src.stop(at + 0.08);
  }
}

export const music = new Music();
export type { Mood } from './score';
