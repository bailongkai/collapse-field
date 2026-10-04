import Phaser from 'phaser';
import { GAME_FRAME_SCALE } from '../atlas';
import type { World } from '../../core/sim/world';

/** how long an aim line is drawn, and how many shooters can be winding up at once on screen */
const AIM_MS = 420;
const MAX_AIMS = 48;
const AIM_COLOR = 0xb7ff5a;
const PULSE_FX_MS = 320;
/** how long the turn arrow is shown beside the character */
export const TURN_HINT_MS = 2000;

/**
 * Shared particle emitters for deaths and impacts. One emitter per effect is created up front and
 * reused via explode(), so hundreds of deaths per second never allocate.
 */
export class FxView {
  private spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private auraRing: Phaser.GameObjects.Image;
  private pulse = 0;
  /** the field's pull, drawn as a ring closing from its reach onto the field */
  private pulseRing: Phaser.GameObjects.Image;
  private pulseMs = 0;
  private pulseFrom = 0;
  /** the turn hint: an arrow beside the character pointing the way to face */
  private turnArrow: Phaser.GameObjects.Image;
  private turnMs = 0;
  private turnDir = 1;
  private aimG: Phaser.GameObjects.Graphics;
  /** shooters winding up: the slot and serial they were in, and how long their line has left */
  private aims: { id: number; serial: number; ms: number }[] = [];

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.auraRing = scene.add
      .image(0, 0, 'game', 'fx_ring')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x40c0ff)
      .setVisible(false);
    layer.add(this.auraRing);
    this.pulseRing = scene.add.image(0, 0, 'game', 'fx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9fe6ff).setVisible(false);
    layer.add(this.pulseRing);
    this.turnArrow = scene.add.image(0, 0, 'game', 'ui_arrow').setTint(0xffd166).setDisplaySize(30, 30).setVisible(false);
    layer.add(this.turnArrow);
    this.aimG = scene.add.graphics();
    layer.add(this.aimG);
    this.spark = scene.add.particles(0, 0, 'game', {
      frame: 'p_spark',
      speed: { min: 40, max: 160 },
      lifespan: 320,
      scale: { start: 0.35 * GAME_FRAME_SCALE, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 1,
      emitting: false,
    });
    this.smoke = scene.add.particles(0, 0, 'game', {
      frame: 'p_smoke',
      speed: { min: 20, max: 80 },
      lifespan: 520,
      scale: { start: 0.5 * GAME_FRAME_SCALE, end: 0.05 * GAME_FRAME_SCALE },
      alpha: { start: 0.7, end: 0 },
      quantity: 1,
      emitting: false,
    });
    layer.add(this.spark);
    layer.add(this.smoke);
  }

  /** Shows the EMP field at its current radius, or hides it when the weapon is not owned. */
  updateAura(x: number, y: number, radius: number, deltaMs: number): void {
    if (radius <= 0) {
      if (this.auraRing.visible) this.auraRing.setVisible(false);
      return;
    }
    this.pulse += deltaMs / 1000;
    this.auraRing.setVisible(true);
    this.auraRing.setPosition(x, y);
    this.auraRing.setDisplaySize(radius * 2, radius * 2);
    this.auraRing.setAlpha(0.25 + 0.15 * (0.5 + 0.5 * Math.sin(this.pulse * 4)));
    if (this.pulseMs > 0) {
      this.pulseMs = Math.max(0, this.pulseMs - deltaMs);
      const k = this.pulseMs / PULSE_FX_MS; // 1 at the pulse, 0 when it has closed
      const r = radius + (this.pulseFrom - radius) * k;
      this.pulseRing.setVisible(true).setPosition(x, y).setDisplaySize(r * 2, r * 2).setAlpha(0.5 * (1 - k) + 0.1);
      if (this.pulseMs === 0) this.pulseRing.setVisible(false);
    }
  }

  /** Show the turn arrow, pointing `dir` (+1 right, -1 left), for TURN_HINT_MS. */
  turnHint(dir: number): void {
    this.turnDir = dir;
    this.turnMs = TURN_HINT_MS;
  }

  /** Keeps the arrow beside the character, bobbing the way it should go. */
  syncTurnHint(px: number, py: number, deltaMs: number): void {
    if (this.turnMs <= 0) {
      if (this.turnArrow.visible) this.turnArrow.setVisible(false);
      return;
    }
    this.turnMs = Math.max(0, this.turnMs - deltaMs);
    const t = (TURN_HINT_MS - this.turnMs) / 1000;
    const bob = Math.sin(t * Math.PI * 4) * 6;
    this.turnArrow
      .setVisible(true)
      .setPosition(px + this.turnDir * (48 + bob), py - 8)
      .setRotation(this.turnDir > 0 ? 0 : Math.PI)
      .setAlpha(Math.min(1, this.turnMs / 400));
  }

  /** The field pulsed: a ring closes from `reach` onto the field over a third of a second. */
  auraPulse(reach: number): void {
    this.pulseFrom = reach;
    this.pulseMs = PULSE_FX_MS;
  }

  /**
   * A shooter announced its wind-up: a thin line from it towards the player, fading over the
   * tell, so the bolt that follows is a thing that was seen coming rather than a surprise.
   */
  windup(world: World, id: number): void {
    const e = world.enemies.items[id];
    if (!e?.active) return;
    if (this.aims.length >= MAX_AIMS) this.aims.shift();
    this.aims.push({ id, serial: e.serial, ms: AIM_MS });
  }

  /** Redraws the aim lines from where each shooter is now; a dead or recycled shooter loses its line. */
  syncAims(world: World, deltaMs: number): void {
    const g = this.aimG;
    g.clear();
    const p = world.player;
    for (let i = this.aims.length - 1; i >= 0; i--) {
      const a = this.aims[i];
      a.ms -= deltaMs;
      const e = world.enemies.items[a.id];
      if (a.ms <= 0 || !e.active || e.serial !== a.serial) {
        this.aims.splice(i, 1);
        continue;
      }
      const k = a.ms / AIM_MS;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(d, 320);
      g.lineStyle(2, AIM_COLOR, 0.15 + 0.45 * k);
      g.lineBetween(e.x, e.y, e.x + (dx / d) * reach, e.y + (dy / d) * reach);
    }
  }

  death(x: number, y: number, big: boolean): void {
    this.spark.explode(big ? 10 : 3, x, y);
    if (big) this.smoke.explode(4, x, y);
  }

  destroy(): void {
    this.spark.destroy();
    this.smoke.destroy();
    this.auraRing.destroy();
    this.pulseRing.destroy();
    this.turnArrow.destroy();
    this.aimG.destroy();
    this.aims.length = 0;
  }
}
