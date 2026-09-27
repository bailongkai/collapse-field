import type Phaser from 'phaser';
import type { World } from '../../core/sim/world';
import { hash2 } from '../../core/rng';
import { GAME_FRAME_SCALE } from '../atlas';
import { COLORS, textStyle } from '../ui/textStyles';

const DANGER = 0xff5a3c;
const DANGER_EDGE = 0xffb08a;
const EMBER = 0x7a1a10;
const MAX_LABELS = 3;

/** how long the hole stays open after the floor has gone */
const HOLE_MS = 3200;
/** the last stretch of the warning, in which the edge cracks */
const CRACK_MS = 1500;
const CRACKS = 11;
/** how long a body takes to fall in */
const FALL_MS = 520;
const MAX_FALLING = 64;
const SHARDS = 22;
const SHARD_MS = 750;
/** the shock ring the burst throws out, as a fraction of the circle it started from */
const WAVE_MS = 420;
const WAVE_REACH = 0.9;

interface Hole {
  x: number;
  y: number;
  radius: number;
  ageMs: number;
  seed: number;
}
interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  size: number;
  ageMs: number;
}
interface Falling {
  img: Phaser.GameObjects.Image;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  ageMs: number;
  spin: number;
  flip: boolean;
}

/**
 * The marked floor that is about to give way, the moment it goes, and the hole it leaves.
 *
 * Danger on the ground has one colour and one shape here and nothing else uses them: weapons are
 * cyan and green, experience is a small diamond, and this is a wide orange disc with a number in
 * it. The disc is the area that will hurt; the ring closing inside it is the time left, so both
 * questions a player has — where, and how long — are answered by looking at the same place.
 *
 * The collapse itself is sold in three beats: the edge cracks in the last second and a half, the
 * floor bursts outward in shards, and whatever was standing on it falls in, shrinking and turning
 * as it goes. The last is the one that matters. The simulation takes those bodies away on the tick
 * the floor goes, and without a fall they simply stopped existing, which reads as a bug.
 *
 * Everything here is presentation: it draws from `world.collapses` and from the events, and never
 * writes back. Randomness is a hash of the circle's position, not `Math.random`, so the same
 * collapse cracks the same way every time it is replayed.
 */
export class CollapseView {
  private scene: Phaser.Scene;
  private g: Phaser.GameObjects.Graphics;
  private fxG: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private holes: Hole[] = [];
  private shards: Shard[] = [];
  private falling: Falling[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private fallLayer: Phaser.GameObjects.Layer;
  private phase = 0;

  constructor(scene: Phaser.Scene, floorLayer: Phaser.GameObjects.Layer, fallLayer: Phaser.GameObjects.Layer, fxLayer: Phaser.GameObjects.Layer, labelLayer: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.fallLayer = fallLayer;
    this.g = scene.add.graphics();
    floorLayer.add(this.g);
    this.fxG = scene.add.graphics();
    fxLayer.add(this.fxG);
    for (let i = 0; i < MAX_LABELS; i++) {
      const label = scene.add.text(0, 0, '', textStyle(40, { bold: true, color: COLORS.warn, stroke: true })).setOrigin(0.5).setVisible(false);
      labelLayer.add(label);
      this.labels.push(label);
    }
  }

  /** The floor has gone: open the hole and throw the floor that was there outwards. */
  collapsed(x: number, y: number, radius: number): void {
    const seed = hash2(Math.round(x), Math.round(y));
    this.holes.push({ x, y, radius, ageMs: 0, seed });
    for (let i = 0; i < SHARDS; i++) {
      const h = hash2(seed, i);
      const a = ((h & 0xffff) / 0x10000) * Math.PI * 2;
      const from = radius * (0.55 + (((h >>> 16) & 0xff) / 0x100) * 0.45);
      const speed = 160 + ((h >>> 24) & 0xff) * 1.4;
      this.shards.push({
        x: x + Math.cos(a) * from,
        y: y + Math.sin(a) * from,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        spin: (((h >>> 8) & 0xff) / 0x80 - 1) * 12,
        angle: a,
        size: 9 + ((h >>> 4) & 0xf),
        ageMs: 0,
      });
    }
  }

  /** A body the floor took: it falls towards the middle of the most recent hole. */
  swallowed(x: number, y: number, frame: string | undefined): void {
    const hole = this.holes[this.holes.length - 1];
    if (!hole || !frame || this.falling.length >= MAX_FALLING) return;
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, 'game', frame);
    img.setFrame(frame).setVisible(true).setAlpha(1).setTint(0xffffff).setPosition(x, y).setScale(GAME_FRAME_SCALE).setRotation(0);
    this.fallLayer.add(img);
    const h = hash2(Math.round(x), Math.round(y));
    this.falling.push({ img, fromX: x, fromY: y, toX: hole.x, toY: hole.y, ageMs: 0, spin: (h & 1 ? 1 : -1) * (2.5 + (h & 0xff) / 64), flip: x < hole.x });
  }

  sync(world: World, dtMs: number): void {
    this.phase += dtMs / 1000;
    const g = this.g;
    const fx = this.fxG;
    g.clear();
    fx.clear();

    this.drawHoles(g, dtMs);
    this.drawFalling(dtMs);
    this.drawShards(fx, dtMs);
    for (const hole of this.holes) this.drawBurst(fx, hole);

    const zones = world.collapses;
    for (let i = 0; i < this.labels.length; i++) {
      const zone = zones[i];
      const label = this.labels[i];
      if (!zone) {
        label.setVisible(false);
        continue;
      }
      const left = Math.max(0, zone.leftMs / zone.totalMs);
      // beats faster as the time runs out, so the last seconds read as urgent without the number
      const beat = 0.5 + 0.5 * Math.sin(this.phase * (3 + 9 * (1 - left)));
      g.fillStyle(DANGER, 0.1 + 0.16 * (1 - left) + 0.06 * beat);
      g.fillCircle(zone.x, zone.y, zone.radius);
      g.lineStyle(4, DANGER_EDGE, 0.75 + 0.25 * beat);
      g.strokeCircle(zone.x, zone.y, zone.radius);
      g.lineStyle(2, DANGER_EDGE, 0.55);
      g.strokeCircle(zone.x, zone.y, Math.max(2, zone.radius * left));
      if (zone.leftMs < CRACK_MS) this.drawCracks(g, zone.x, zone.y, zone.radius, 1 - zone.leftMs / CRACK_MS);
      // the last second shakes the number, the way the floor under it is about to
      const jitter = zone.leftMs < 1000 ? Math.sin(this.phase * 60) * 3 : 0;
      label.setVisible(true).setPosition(zone.x + jitter, zone.y + 64).setText(String(Math.ceil(zone.leftMs / 1000)));
    }
  }

  /**
   * Jagged lines from the rim inwards, growing with `t` from 0 to 1. Each one is a few segments
   * whose bends are fixed by the circle's position, so they grow rather than flicker.
   */
  private drawCracks(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, t: number): void {
    const seed = hash2(Math.round(x), Math.round(y));
    g.lineStyle(3, 0x1a0503, 0.9);
    for (let c = 0; c < CRACKS; c++) {
      const h = hash2(seed, c + 100);
      let a = (c / CRACKS) * Math.PI * 2 + ((h & 0xff) / 0x100 - 0.5) * 0.4;
      let r = radius;
      let px = x + Math.cos(a) * r;
      let py = y + Math.sin(a) * r;
      const reach = radius * (0.35 + ((h >>> 8) & 0xff) / 0x100 * 0.45) * t;
      const steps = 4;
      g.beginPath();
      g.moveTo(px, py);
      for (let s = 1; s <= steps; s++) {
        const hs = hash2(h, s);
        a += ((hs & 0xff) / 0x100 - 0.5) * 0.5;
        r = radius - (reach * s) / steps;
        px = x + Math.cos(a) * r;
        py = y + Math.sin(a) * r;
        g.lineTo(px, py);
      }
      g.strokePath();
    }
  }

  /** The first instant: the disc flashes hot and a ring runs outwards from its edge. */
  private drawBurst(g: Phaser.GameObjects.Graphics, hole: Hole): void {
    if (hole.ageMs >= WAVE_MS) return;
    const t = hole.ageMs / WAVE_MS;
    if (t < 0.35) {
      g.fillStyle(0xffe0c0, 0.55 * (1 - t / 0.35));
      g.fillCircle(hole.x, hole.y, hole.radius);
    }
    g.lineStyle(10 * (1 - t) + 2, DANGER_EDGE, 0.8 * (1 - t));
    g.strokeCircle(hole.x, hole.y, hole.radius * (1 + WAVE_REACH * Math.sqrt(t)));
  }

  /** A dark pit with embers turning slowly in it, closing over a few seconds. */
  private drawHoles(g: Phaser.GameObjects.Graphics, dtMs: number): void {
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const hole = this.holes[i];
      hole.ageMs += dtMs;
      if (hole.ageMs >= HOLE_MS) {
        this.holes.splice(i, 1);
        continue;
      }
      const t = hole.ageMs / HOLE_MS;
      // opens at once, fades over the last third
      const k = t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34;
      const r = hole.radius * (1 - 0.08 * t);
      g.fillStyle(0x020306, 0.9 * k);
      g.fillCircle(hole.x, hole.y, r);
      g.fillStyle(EMBER, 0.35 * k);
      g.fillCircle(hole.x, hole.y, r * 0.55);
      g.fillStyle(0x020306, 0.8 * k);
      g.fillCircle(hole.x, hole.y, r * 0.3);
      // three arcs turning inside it, so the pit reads as depth and not as a sticker
      const spin = this.phase * 0.9 + (hole.seed & 0xff) / 40;
      for (let a = 0; a < 3; a++) {
        const start = spin + (a * Math.PI * 2) / 3;
        g.lineStyle(3, DANGER, 0.45 * k);
        g.beginPath();
        g.arc(hole.x, hole.y, r * (0.62 + a * 0.1), start, start + 1.1);
        g.strokePath();
      }
      // the rim glows hot for the first moment and then cools
      const hot = Math.max(0, 1 - hole.ageMs / 600);
      g.lineStyle(4 + 6 * hot, hot > 0 ? DANGER_EDGE : DANGER, (0.5 + 0.5 * hot) * k);
      g.strokeCircle(hole.x, hole.y, r);
    }
  }

  private drawFalling(dtMs: number): void {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.ageMs += dtMs;
      const t = Math.min(1, f.ageMs / FALL_MS);
      if (t >= 1) {
        f.img.setVisible(false);
        this.pool.push(f.img);
        this.falling.splice(i, 1);
        continue;
      }
      // eases in: it teeters, then goes
      const e = t * t;
      const shade = Math.round(255 * (1 - 0.8 * t));
      f.img
        .setPosition(f.fromX + (f.toX - f.fromX) * e * 0.7, f.fromY + (f.toY - f.fromY) * e * 0.7)
        .setScale(GAME_FRAME_SCALE * (1 - 0.85 * e))
        .setRotation(f.spin * e)
        .setFlipX(f.flip)
        .setTint((shade << 16) | (Math.round(shade * 0.7) << 8) | Math.round(shade * 0.6))
        .setAlpha(1 - e * 0.6);
    }
  }

  private drawShards(g: Phaser.GameObjects.Graphics, dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.ageMs += dtMs;
      if (s.ageMs >= SHARD_MS) {
        this.shards.splice(i, 1);
        continue;
      }
      const t = s.ageMs / SHARD_MS;
      // flung out and slowing, as floor plate does
      s.vx *= 1 - 3 * dt;
      s.vy *= 1 - 3 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.angle += s.spin * dt;
      const size = s.size * (1 - 0.4 * t);
      const c = Math.cos(s.angle);
      const sn = Math.sin(s.angle);
      // a sliver of plate, glowing from the break at first and cooling to bare metal; it has to be
      // lighter than the floor it is thrown across or it vanishes against it
      g.fillStyle(t < 0.3 ? 0xffd2a8 : 0x9aa6bc, 1 - t * t);
      g.fillTriangle(
        s.x + c * size, s.y + sn * size,
        s.x - c * size * 0.6 - sn * size * 0.45, s.y - sn * size * 0.6 + c * size * 0.45,
        s.x - c * size * 0.6 + sn * size * 0.45, s.y - sn * size * 0.6 - c * size * 0.45,
      );
      g.lineStyle(1.5, DANGER_EDGE, (1 - t) * 0.9);
      g.lineBetween(s.x + c * size, s.y + sn * size, s.x - c * size * 0.6 - sn * size * 0.45, s.y - sn * size * 0.6 + c * size * 0.45);
    }
  }

  destroy(): void {
    this.g.destroy();
    this.fxG.destroy();
    for (const l of this.labels) l.destroy();
    for (const f of this.falling) f.img.destroy();
    for (const img of this.pool) img.destroy();
    this.labels.length = 0;
    this.holes.length = 0;
    this.shards.length = 0;
    this.falling.length = 0;
    this.pool.length = 0;
  }
}
