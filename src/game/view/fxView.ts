import type Phaser from 'phaser';

/**
 * Shared particle emitters for deaths and impacts. One emitter per effect is created up front and
 * reused via explode(), so hundreds of deaths per second never allocate.
 */
export class FxView {
  private spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.spark = scene.add.particles(0, 0, 'game', {
      frame: 'p_spark',
      speed: { min: 40, max: 160 },
      lifespan: 320,
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 1,
      emitting: false,
    });
    this.smoke = scene.add.particles(0, 0, 'game', {
      frame: 'p_smoke',
      speed: { min: 20, max: 80 },
      lifespan: 520,
      scale: { start: 0.5, end: 0.05 },
      alpha: { start: 0.7, end: 0 },
      quantity: 1,
      emitting: false,
    });
    layer.add(this.spark);
    layer.add(this.smoke);
  }

  death(x: number, y: number, big: boolean): void {
    this.spark.explode(big ? 10 : 3, x, y);
    if (big) this.smoke.explode(4, x, y);
  }

  destroy(): void {
    this.spark.destroy();
    this.smoke.destroy();
  }
}
