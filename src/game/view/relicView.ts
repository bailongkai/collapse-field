import type Phaser from 'phaser';
import type { World } from '../../core/sim/world';
import { pickupDef } from '../../core/content/registry';

const EDGE = 42;

/**
 * Points at the nearest relic still on the map when it is off screen. A relic the player does not
 * know about is a relic that does not exist; the arrow is what turns it into a decision.
 */
export class RelicView {
  private arrow: Phaser.GameObjects.Image;
  private icon: Phaser.GameObjects.Image;
  private phase = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.arrow = scene.add.image(0, 0, 'game', 'ui_arrow').setVisible(false).setTint(0xffd166).setDisplaySize(26, 26).setScrollFactor(0);
    this.icon = scene.add.image(0, 0, 'game', 'pk_chest').setVisible(false).setDisplaySize(22, 22).setScrollFactor(0);
    layer.add(this.arrow);
    layer.add(this.icon);
  }

  sync(world: World, camX: number, camY: number, viewW: number, viewH: number, dtMs: number): void {
    this.phase += dtMs / 1000;
    const p = world.player;
    let best: { x: number; y: number; frame: string } | null = null;
    let bestD = Infinity;
    const alive = world.pickups.aliveList();
    for (let i = 0; i < world.pickups.count; i++) {
      const item = world.pickups.items[alive[i]];
      const def = pickupDef(item.defId);
      if (!def.persistent || def.magnetic) continue; // relics: placed, not dropped
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { x: item.x, y: item.y, frame: def.frame };
      }
    }
    const halfW = viewW / 2;
    const halfH = viewH / 2;
    if (!best || (Math.abs(best.x - camX) < halfW - EDGE && Math.abs(best.y - camY) < halfH - EDGE)) {
      if (this.arrow.visible) {
        this.arrow.setVisible(false);
        this.icon.setVisible(false);
      }
      return;
    }
    // clamp the direction to the inside of the view's edge, in screen space
    const dx = best.x - camX;
    const dy = best.y - camY;
    const k = Math.min((halfW - EDGE) / Math.abs(dx || 1e-6), (halfH - EDGE) / Math.abs(dy || 1e-6));
    const sx = halfW + dx * k;
    const sy = halfH + dy * k;
    const angle = Math.atan2(dy, dx);
    const bob = 1 + 0.08 * Math.sin(this.phase * 5);
    this.arrow.setVisible(true).setPosition(sx, sy).setRotation(angle).setScale(bob * (26 / this.arrow.width));
    this.icon.setVisible(true).setFrame(best.frame).setPosition(sx - Math.cos(angle) * 26, sy - Math.sin(angle) * 26).setDisplaySize(22, 22);
  }

  destroy(): void {
    this.arrow.destroy();
    this.icon.destroy();
  }
}
