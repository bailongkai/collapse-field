import type Phaser from 'phaser';
import { PICKUP_CAP } from '../../config';
import { GAME_FRAME_SCALE } from '../atlas';
import { pickupDef } from '../../core/content/registry';
import type { World } from '../../core/sim/world';

/** Pooled pickup images; the pool is small, so no culling is needed. */
export class PickupView {
  private images: Phaser.GameObjects.Image[] = [];
  private frames: string[] = new Array<string>(PICKUP_CAP).fill('');

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    for (let i = 0; i < PICKUP_CAP; i++) {
      const img = scene.add.image(0, 0, 'game', 'pk_coin').setScale(GAME_FRAME_SCALE).setVisible(false);
      layer.add(img);
      this.images.push(img);
    }
  }

  sync(world: World, timeMs: number): void {
    for (let i = 0; i < PICKUP_CAP; i++) {
      if (!world.pickups.items[i].active && this.images[i].visible) this.images[i].setVisible(false);
    }
    const alive = world.pickups.aliveList();
    for (let i = 0; i < world.pickups.count; i++) {
      const item = world.pickups.items[alive[i]];
      const img = this.images[item.id];
      const def = pickupDef(item.defId);
      if (this.frames[item.id] !== def.frame) {
        this.frames[item.id] = def.frame;
        img.setFrame(def.frame);
      }
      img.setVisible(true);
      // a gentle bob so pickups read as items rather than scenery
      img.setPosition(item.x, item.y + Math.sin((timeMs + item.id * 300) / 300) * 3);
    }
  }

  destroy(): void {
    for (const img of this.images) img.destroy();
    this.images.length = 0;
  }
}
