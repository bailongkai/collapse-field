import Phaser from 'phaser';
import type { World } from '../../core/sim/world';

/** How many reward carriers can be marked at once. The stage never fields more than a couple. */
const MAX_MARKERS = 6;
const BOB_PX = 5;
const BOB_HZ = 1.6;

/**
 * Draws a supply chest bobbing over any enemy that is carrying one.
 *
 * Without it the feature does not land. A sentinel is the same size and silhouette as half the
 * wave table and reads as one more body to avoid, so the decision it is supposed to ask — stop and
 * deal with this one, it is worth something — is never put to the player at all. Tinting the body
 * gold is not enough in a field of forty enemies; the chest itself has to be visible.
 */
export class CarriedView {
  private markers: Phaser.GameObjects.Image[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private phase = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    for (let i = 0; i < MAX_MARKERS; i++) {
      // p_flare is a soft glow; fx_ring is a thin outline and disappears at this size
      const glow = scene.add.image(0, 0, 'game', 'p_flare')
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffd166)
        .setDisplaySize(72, 72);
      const img = scene.add.image(0, 0, 'game', 'pk_chest').setVisible(false).setDisplaySize(38, 38);
      layer.add(glow);
      layer.add(img);
      this.glows.push(glow);
      this.markers.push(img);
    }
  }

  sync(world: World, camX: number, camY: number, viewW: number, viewH: number, dtMs: number): void {
    this.phase += (dtMs / 1000) * BOB_HZ * Math.PI * 2;
    const minX = camX - viewW / 2;
    const maxX = camX + viewW / 2;
    const minY = camY - viewH / 2;
    const maxY = camY + viewH / 2;

    let used = 0;
    const alive = world.enemies.aliveList();
    for (let i = 0; i < world.enemies.count && used < MAX_MARKERS; i++) {
      const e = world.enemies.items[alive[i]];
      if (!e.def?.drops?.length) continue;
      // clamped to the edge of the view, so a carrier off screen still shows which way to go
      const x = Math.min(maxX - 24, Math.max(minX + 24, e.x));
      const y = Math.min(maxY - 28, Math.max(minY + 28, e.y - e.radius - 30));
      const bob = Math.sin(this.phase + used) * BOB_PX;
      const marker = this.markers[used];
      const glow = this.glows[used];
      marker.setVisible(true).setPosition(x, y + bob);
      glow.setVisible(true).setPosition(x, y + bob).setAlpha(0.55 + 0.25 * Math.sin(this.phase * 0.7 + used));
      used++;
    }
    for (let i = used; i < MAX_MARKERS; i++) {
      if (this.markers[i].visible) this.markers[i].setVisible(false);
      if (this.glows[i].visible) this.glows[i].setVisible(false);
    }
  }

  destroy(): void {
    for (const m of this.markers) m.destroy();
    for (const g of this.glows) g.destroy();
    this.markers.length = 0;
    this.glows.length = 0;
  }
}
