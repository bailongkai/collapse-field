import Phaser from 'phaser';
import { ENEMY_CAP, GAME_H, GAME_W } from '../../config';
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

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    for (let i = 0; i < ENEMY_CAP; i++) {
      const img = scene.add.image(0, 0, 'game', 'enemy_drone').setVisible(false);
      layer.add(img);
      this.images.push(img);
    }
  }

  sync(world: World, camX: number, camY: number): void {
    const minX = camX - GAME_W / 2 - CULL_MARGIN;
    const maxX = camX + GAME_W / 2 + CULL_MARGIN;
    const minY = camY - GAME_H / 2 - CULL_MARGIN;
    const maxY = camY + GAME_H / 2 + CULL_MARGIN;

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

      const wantFlash = e.flashMs > 0 ? 1 : 0;
      if (this.flashing[e.id] !== wantFlash) {
        this.flashing[e.id] = wantFlash;
        if (wantFlash) img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        else img.setTint(def.tint ?? 0xffffff).setTintMode(Phaser.TintModes.MULTIPLY);
      } else if (!wantFlash && def.tint !== undefined) {
        img.setTint(def.tint);
      }
    }
  }

  destroy(): void {
    for (const img of this.images) img.destroy();
    this.images.length = 0;
  }
}
