import Phaser from 'phaser';
import type { World } from '../../core/sim/world';
import { pylonBeams } from '../../core/weapons/behaviors/pylon';

/**
 * The arcs of the 电弧锚桩 lattice. Without them the weapon is invisible: the stakes are small and
 * the damage happens in the space between them, so the beams are the weapon.
 *
 * The player's own arcs are drawn a stop brighter and a touch thicker than stake-to-stake ones.
 * That difference is the whole message of the archetype — walk away and most of the lattice goes
 * dim — and if the two read the same the player never learns it.
 */
export class PylonView {
  private g: Phaser.GameObjects.Graphics;
  private buf: number[] = [];
  private phase = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    layer.add(this.g);
  }

  sync(world: World, camX: number, camY: number, viewW: number, viewH: number, dtMs: number): void {
    this.phase += dtMs / 1000;
    const beams = pylonBeams(world, this.buf);
    this.g.clear();
    if (beams.length === 0) return;
    const minX = camX - viewW / 2 - 200;
    const maxX = camX + viewW / 2 + 200;
    const minY = camY - viewH / 2 - 200;
    const maxY = camY + viewH / 2 + 200;
    const pulse = 0.8 + 0.2 * Math.sin(this.phase * 5);
    for (let i = 0; i < beams.length; i += 5) {
      const x1 = beams[i];
      const y1 = beams[i + 1];
      const x2 = beams[i + 2];
      const y2 = beams[i + 3];
      const toPlayer = beams[i + 4] === 1;
      if (Math.max(x1, x2) < minX || Math.min(x1, x2) > maxX || Math.max(y1, y2) < minY || Math.min(y1, y2) > maxY) continue;
      this.g.lineStyle(toPlayer ? 16 : 12, 0x5cf0b0, (toPlayer ? 0.26 : 0.16) * pulse);
      this.g.lineBetween(x1, y1, x2, y2);
      this.g.lineStyle(toPlayer ? 5 : 3, 0xd8ffe8, (toPlayer ? 0.9 : 0.6) * pulse);
      this.g.lineBetween(x1, y1, x2, y2);
    }
  }

  destroy(): void {
    this.g.destroy();
  }
}
