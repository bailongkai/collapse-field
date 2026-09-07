import Phaser from 'phaser';
import { ENEMY_CAP } from '../../config';
import type { World } from '../../core/sim/world';

const CULL_MARGIN = 96;

/**
 * One pooled Image per enemy slot, pre-created and parented to a fixed layer: nothing is created or
 * destroyed at runtime, the display list never re-sorts, and every enemy draws from one atlas so
 * the horde costs a handful of draw calls.
 */
export class EnemyView {
  private images: Phaser.GameObjects.Image[] = [];
  private frames: string[] = new Array<string>(ENEMY_CAP).fill('');
  private flashing = new Uint8Array(ENEMY_CAP);
  /** the tint currently applied to each slot's Image; -1 means "unknown, set it" */
  private tints = new Int32Array(ENEMY_CAP).fill(-1);

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    for (let i = 0; i < ENEMY_CAP; i++) {
      const img = scene.add.image(0, 0, 'game', 'enemy_drone').setVisible(false);
      layer.add(img);
      this.images.push(img);
    }
  }

  sync(world: World, camX: number, camY: number, viewW: number, viewH: number): void {
    const minX = camX - viewW / 2 - CULL_MARGIN;
    const maxX = camX + viewW / 2 + CULL_MARGIN;
    const minY = camY - viewH / 2 - CULL_MARGIN;
    const maxY = camY + viewH / 2 + CULL_MARGIN;

    // hide slots that are no longer alive
    for (let i = 0; i < this.images.length; i++) {
      if (!world.enemies.items[i].active && this.images[i].visible) this.images[i].setVisible(false);
    }

    const alive = world.enemies.aliveList();
    for (let i = 0; i < world.enemies.count; i++) {
      const e = world.enemies.items[alive[i]];
      const img = this.images[e.id];
      if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) {
        if (img.visible) img.setVisible(false);
        continue;
      }
      const def = e.def!;
      if (this.frames[e.id] !== def.frame) {
        this.frames[e.id] = def.frame;
        img.setFrame(def.frame);
      }
      img.setVisible(true);
      img.setPosition(e.x, e.y);
      if (def.faceTarget) img.setFlipX(Math.cos(e.facing) < 0);
      else img.setRotation(e.facing + Math.PI / 2);

      // The tint is tracked per slot rather than per definition: pool slots are reused immediately,
      // so an untinted mech taking a dead infected's slot would otherwise inherit its green.
      const wantFlash = e.flashMs > 0 ? 1 : 0;
      const wantTint = wantFlash ? 0xffffff : (def.tint ?? 0xffffff);
      if (this.flashing[e.id] !== wantFlash) {
        this.flashing[e.id] = wantFlash;
        img.setTintMode(wantFlash ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
        img.setTint(wantTint);
        this.tints[e.id] = wantTint;
      } else if (this.tints[e.id] !== wantTint) {
        img.setTint(wantTint);
        this.tints[e.id] = wantTint;
      }
    }
  }

  destroy(): void {
    for (const img of this.images) img.destroy();
    this.images.length = 0;
  }
}
