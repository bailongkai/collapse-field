import type Phaser from 'phaser';
import { ENEMY_CAP } from '../../config';
import type { World } from '../../core/sim/world';

/** Pre-scaled shadow frames, chosen by body radius. Bobs cannot scale, so the sizes are baked. */
const SIZES = [
  { frame: 'shadow_s', w: 28, maxRadius: 15 },
  { frame: 'shadow_m', w: 44, maxRadius: 22 },
  { frame: 'shadow_l', w: 68, maxRadius: 40 },
  { frame: 'shadow_xl', w: 140, maxRadius: Infinity },
];
const CULL_MARGIN = 96;

function pick(radius: number): { frame: string; w: number } {
  for (const s of SIZES) if (radius <= s.maxRadius) return s;
  return SIZES[SIZES.length - 1];
}

/**
 * A single Blitter drawing a soft shadow under the player and every enemy. It costs one draw call
 * and is what makes sprites from three different art packs look like they share a floor.
 */
export class ShadowView {
  private blitter: Phaser.GameObjects.Blitter;
  private bobs: Phaser.GameObjects.Bob[] = [];
  private frames: string[] = new Array<string>(ENEMY_CAP + 1).fill('');
  private widths: number[] = new Array<number>(ENEMY_CAP + 1).fill(0);
  /** the last slot is the player's */
  private readonly playerSlot = ENEMY_CAP;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.blitter = scene.add.blitter(0, 0, 'game');
    layer.add(this.blitter);
    for (let i = 0; i <= ENEMY_CAP; i++) {
      const bob = this.blitter.create(0, 0, 'shadow_s', true);
      bob.visible = false;
      this.bobs.push(bob);
    }
  }

  private place(slot: number, x: number, y: number, radius: number): void {
    const size = pick(radius);
    if (this.frames[slot] !== size.frame) {
      this.frames[slot] = size.frame;
      this.widths[slot] = size.w;
      this.bobs[slot].setFrame(size.frame);
    }
    const bob = this.bobs[slot];
    bob.x = x - size.w / 2;
    // the shadow sits under the body's feet, not under its centre, or it just darkens the sprite
    bob.y = y - size.w * 0.21 + radius * 0.85;
    bob.visible = true;
  }

  sync(world: World, camX: number, camY: number, viewW: number, viewH: number): void {
    const minX = camX - viewW / 2 - CULL_MARGIN;
    const maxX = camX + viewW / 2 + CULL_MARGIN;
    const minY = camY - viewH / 2 - CULL_MARGIN;
    const maxY = camY + viewH / 2 + CULL_MARGIN;

    for (let i = 0; i < ENEMY_CAP; i++) {
      if (!world.enemies.items[i].active && this.bobs[i].visible) this.bobs[i].visible = false;
    }

    const alive = world.enemies.aliveList();
    for (let i = 0; i < world.enemies.count; i++) {
      const e = world.enemies.items[alive[i]];
      if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) {
        this.bobs[e.id].visible = false;
        continue;
      }
      this.place(e.id, e.x, e.y, e.radius);
    }

    this.place(this.playerSlot, world.player.x, world.player.y, 16);
  }

  destroy(): void {
    this.blitter.destroy();
    this.bobs.length = 0;
  }
}
