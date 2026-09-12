import Phaser from 'phaser';
import type { World } from '../../core/sim/world';
import { tetherBeams } from '../../core/enemies/behaviors/tether';

/**
 * The beams between linked 束缚者. Without them the pattern is not a mechanic, it is a poltergeist:
 * the player is shoved by a wall they cannot see. One Graphics object, redrawn each frame, because
 * a stage fields a handful of pairs and never a crowd of them.
 */
export class TetherView {
  private g: Phaser.GameObjects.Graphics;
  private buf: number[] = [];
  private phase = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    layer.add(this.g);
  }

  sync(world: World, camX: number, camY: number, viewW: number, viewH: number, dtMs: number): void {
    this.phase += dtMs / 1000;
    const beams = tetherBeams(world, this.buf);
    this.g.clear();
    if (beams.length === 0) return;
    const minX = camX - viewW / 2 - 200;
    const maxX = camX + viewW / 2 + 200;
    const minY = camY - viewH / 2 - 200;
    const maxY = camY + viewH / 2 + 200;
    // a hot core inside a wider glow, pulsing, so it reads as live energy and not as a drawn line
    const pulse = 0.75 + 0.25 * Math.sin(this.phase * 6);
    for (let i = 0; i < beams.length; i += 4) {
      const [x1, y1, x2, y2] = [beams[i], beams[i + 1], beams[i + 2], beams[i + 3]];
      if (Math.max(x1, x2) < minX || Math.min(x1, x2) > maxX || Math.max(y1, y2) < minY || Math.min(y1, y2) > maxY) continue;
      this.g.lineStyle(14, 0x4fe0ff, 0.18 * pulse);
      this.g.lineBetween(x1, y1, x2, y2);
      this.g.lineStyle(4, 0xbfefff, 0.75 * pulse);
      this.g.lineBetween(x1, y1, x2, y2);
    }
  }

  destroy(): void {
    this.g.destroy();
  }
}
