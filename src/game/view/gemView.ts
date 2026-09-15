import type Phaser from 'phaser';
import { GEM_CAP_POOL } from '../../config';
import { GAME_ATLAS_DENSITY, GAME_FRAME_SCALE } from '../atlas';
import type { World } from '../../core/sim/world';

const CULL_MARGIN = 64;
const FRAMES = { blue: 'gem_blue', green: 'gem_green', red: 'gem_red', merged: 'gem_big' } as const;

/**
 * Gems drawn through a Blitter: hundreds of them cost one draw call and they never rotate or
 * scale, which is exactly the Bob's feature set in Phaser 4. A Bob has no scale and the WebGL
 * Blitter ignores its own transform, so a Container undoes the atlas density and the Bobs are
 * placed in atlas pixels.
 */
export class GemView {
  private blitter: Phaser.GameObjects.Blitter;
  private root: Phaser.GameObjects.Container;
  private bobs: Phaser.GameObjects.Bob[] = [];
  private frames: string[] = new Array<string>(GEM_CAP_POOL).fill('');

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.blitter = scene.add.blitter(0, 0, 'game');
    this.root = scene.add.container(0, 0, [this.blitter]).setScale(GAME_FRAME_SCALE);
    layer.add(this.root);
    for (let i = 0; i < GEM_CAP_POOL; i++) {
      const bob = this.blitter.create(0, 0, FRAMES.blue, true);
      bob.visible = false;
      this.bobs.push(bob);
    }
  }

  sync(world: World, camX: number, camY: number, viewW: number, viewH: number): void {
    const minX = camX - viewW / 2 - CULL_MARGIN;
    const maxX = camX + viewW / 2 + CULL_MARGIN;
    const minY = camY - viewH / 2 - CULL_MARGIN;
    const maxY = camY + viewH / 2 + CULL_MARGIN;

    for (let i = 0; i < GEM_CAP_POOL; i++) {
      if (!world.gems.items[i].active && this.bobs[i].visible) this.bobs[i].visible = false;
    }

    const alive = world.gems.aliveList();
    for (let i = 0; i < world.gems.count; i++) {
      const g = world.gems.items[alive[i]];
      const bob = this.bobs[g.id];
      if (g.x < minX || g.x > maxX || g.y < minY || g.y > maxY) {
        bob.visible = false;
        continue;
      }
      const frame = FRAMES[g.tier];
      if (this.frames[g.id] !== frame) {
        this.frames[g.id] = frame;
        bob.setFrame(frame);
      }
      // Bobs draw from their top-left corner; the merged gem is the only larger frame
      const half = g.tier === 'merged' ? 14 : g.tier === 'red' ? 9 : 8;
      bob.x = (g.x - half) * GAME_ATLAS_DENSITY;
      bob.y = (g.y - half) * GAME_ATLAS_DENSITY;
      bob.visible = true;
    }
  }

  destroy(): void {
    this.root.destroy(); // takes the blitter with it
    this.bobs.length = 0;
  }
}
