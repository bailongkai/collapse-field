import Phaser from 'phaser';
import type { FrameStats } from './hook';
import { rendererString } from './hook';

const RING = 1200;

/**
 * Samples frame time split into sim / sprite-sync / render. CPU-side numbers are meaningful in
 * headless Chromium; the render and frame-time numbers are only trustworthy on a real GPU, so
 * specs gate on simMs+syncMs unless the renderer string says otherwise.
 */
export class Profiler {
  private frame = new Float64Array(RING);
  private sim = new Float64Array(RING);
  private sync = new Float64Array(RING);
  private render = new Float64Array(RING);
  private n = 0;
  private recording = false;
  private simAcc = 0;
  private syncAcc = 0;
  private renderStart = 0;
  private renderAcc = 0;
  private lastFrameStart = 0;
  private game: Phaser.Game | null = null;
  private onPreRender = () => {
    this.renderStart = performance.now();
  };
  private onPostRender = () => {
    this.renderAcc = performance.now() - this.renderStart;
  };

  attach(game: Phaser.Game): void {
    this.game = game;
    game.events.on(Phaser.Core.Events.PRE_RENDER, this.onPreRender);
    game.events.on(Phaser.Core.Events.POST_RENDER, this.onPostRender);
  }

  detach(): void {
    if (!this.game) return;
    this.game.events.off(Phaser.Core.Events.PRE_RENDER, this.onPreRender);
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.onPostRender);
    this.game = null;
    this.recording = false;
  }

  start(): void {
    this.n = 0;
    this.recording = true;
  }

  markSim(ms: number): void {
    this.simAcc = ms;
  }

  markSync(ms: number): void {
    this.syncAcc = ms;
  }

  /** Called at the end of every game-scene update. */
  endFrame(): void {
    const now = performance.now();
    const frameMs = this.lastFrameStart === 0 ? 0 : now - this.lastFrameStart;
    this.lastFrameStart = now;
    if (!this.recording || this.n >= RING) return;
    this.frame[this.n] = frameMs;
    this.sim[this.n] = this.simAcc;
    this.sync[this.n] = this.syncAcc;
    this.render[this.n] = this.renderAcc;
    this.n++;
  }

  get lastSimMs(): number {
    return this.simAcc;
  }

  get lastSyncMs(): number {
    return this.syncAcc;
  }

  get lastRenderMs(): number {
    return this.renderAcc;
  }

  stop(): FrameStats {
    this.recording = false;
    const n = this.n;
    const slice = Array.from(this.frame.subarray(0, n)).sort((a, b) => a - b);
    const pct = (p: number) => (n === 0 ? 0 : slice[Math.min(n - 1, Math.floor(p * n))]);
    const mean = (arr: Float64Array) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += arr[i];
      return n === 0 ? 0 : s / n;
    };
    const histogram = { '<4': 0, '4-8': 0, '8-12': 0, '12-16.7': 0, '16.7-33': 0, '>33': 0 };
    let longFrames = 0;
    for (let i = 0; i < n; i++) {
      const v = this.frame[i];
      if (v < 4) histogram['<4']++;
      else if (v < 8) histogram['4-8']++;
      else if (v < 12) histogram['8-12']++;
      else if (v < 16.7) histogram['12-16.7']++;
      else if (v < 33) histogram['16.7-33']++;
      else histogram['>33']++;
      if (v > 16.7) longFrames++;
    }
    const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
    return {
      frames: n,
      avgMs: mean(this.frame),
      p50: pct(0.5),
      p95: pct(0.95),
      p99: pct(0.99),
      maxMs: n === 0 ? 0 : slice[n - 1],
      longFrames,
      histogram,
      simMs: mean(this.sim),
      syncMs: mean(this.sync),
      renderMs: mean(this.render),
      heapMB: perf.memory ? perf.memory.usedJSHeapSize / 1048576 : undefined,
      renderer: this.game ? rendererString(this.game) : 'detached',
    };
  }
}
