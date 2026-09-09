import type Phaser from 'phaser';
import type { StageDef } from '../../data/types';

const TILE = 64;

/** Static images tiled over each solid rectangle. They never move, so this is built once. */
export class ObstacleView {
  private images: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, stage: StageDef, layer: Phaser.GameObjects.Layer) {
    for (const o of stage.obstacles ?? []) {
      const cols = Math.max(1, Math.round(o.w / TILE));
      const rows = Math.max(1, Math.round(o.h / TILE));
      const cw = o.w / cols;
      const ch = o.h / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const img = scene.add.image(o.x + cw * (c + 0.5), o.y + ch * (r + 0.5), 'game', o.frame).setDisplaySize(cw + 2, ch + 2);
        layer.add(img);
        this.images.push(img);
      }
    }
  }

  destroy(): void {
    for (const i of this.images) i.destroy();
    this.images.length = 0;
  }
}
