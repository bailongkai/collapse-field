import Phaser from 'phaser';
import { GAME_FRAME_SCALE } from '../atlas';

/**
 * Shared particle emitters for deaths and impacts. One emitter per effect is created up front and
 * reused via explode(), so hundreds of deaths per second never allocate.
 */
export class FxView {
  private spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private auraRing: Phaser.GameObjects.Image;
  private pulse = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.auraRing = scene.add
      .image(0, 0, 'game', 'fx_ring')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x40c0ff)
      .setVisible(false);
    layer.add(this.auraRing);
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
  }

  death(x: number, y: number, big: boolean): void {
    this.spark.explode(big ? 10 : 3, x, y);
    if (big) this.smoke.explode(4, x, y);
  }

  destroy(): void {
    this.spark.destroy();
    this.smoke.destroy();
    this.auraRing.destroy();
  }
}
