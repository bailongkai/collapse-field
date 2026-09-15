import type Phaser from 'phaser';

import { GAME_FRAME_SCALE } from '../atlas';
import { screenOffset, viewOf } from '../layout';
import type { StageDef } from '../../data/types';
import { reroll, wrapDecor, type DecorSlot } from '../../core/decor';
import { hash2 } from '../../core/rng';

const DECOR_COUNT = 24;

/**
 * Infinite floor: a camera-locked TileSprite whose tile offset follows the camera scroll, plus a
 * small pool of decorations that wrap around the view so the station never looks like bare tiles.
 */
export class FloorView {
  private tile: Phaser.GameObjects.TileSprite;
  private decor: Phaser.GameObjects.Image[] = [];
  private slots: DecorSlot[] = [];
  private frames: readonly string[];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, stage: StageDef, floorLayer: Phaser.GameObjects.Layer, decorLayer: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.frames = stage.decorFrames;
    const view = viewOf(scene);
    const off = screenOffset(scene);
    this.tile = scene.add
      .tileSprite(view.width / 2 + off.x, view.height / 2 + off.y, view.width, view.height, stage.floorTexture)
      .setScrollFactor(0)
      .setTint(stage.floorTint);
    floorLayer.add(this.tile);

    for (let i = 0; i < DECOR_COUNT; i++) {
      const h = hash2(i, 1337);
      const slot: DecorSlot = {
        x: ((h % 4096) - 2048) * 0.9,
        y: (((h >>> 12) % 4096) - 2048) * 0.9,
        frame: 0,
        rotation: 0,
        scale: 1,
      };
      reroll(slot, this.frames.length);
      this.slots.push(slot);
      const img = scene.add.image(slot.x, slot.y, 'game', this.frames[slot.frame]).setAlpha(0.55);
      decorLayer.add(img);
      this.decor.push(img);
    }
  }

  update(camX: number, camY: number, scrollX: number, scrollY: number, viewW: number, viewH: number): void {
    if (this.tile.width !== viewW || this.tile.height !== viewH) this.tile.setSize(viewW, viewH);
    // scroll-free, so it is placed at the offset rather than the centre: see screenOffset
    const off = screenOffset(this.scene);
    this.tile.setPosition(viewW / 2 + off.x, viewH / 2 + off.y);
    this.tile.tilePositionX = scrollX;
    this.tile.tilePositionY = scrollY;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (wrapDecor(slot, camX, camY, viewW, viewH, this.frames.length)) {
        this.decor[i].setFrame(this.frames[slot.frame]);
      }
      const img = this.decor[i];
      img.setPosition(slot.x, slot.y);
      img.setRotation(slot.rotation);
      img.setScale(slot.scale * GAME_FRAME_SCALE);
    }
  }

  destroy(): void {
    this.tile.destroy();
    for (const d of this.decor) d.destroy();
    this.decor.length = 0;
    this.slots.length = 0;
  }
}
