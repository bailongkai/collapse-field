import type Phaser from 'phaser';
import type { World } from '../../core/sim/world';
import { COLORS, textStyle } from '../ui/textStyles';

const DANGER = 0xff5a3c;
const DANGER_EDGE = 0xffb08a;
const SCAR_MS = 1600;
const MAX_LABELS = 3;

/**
 * The marked floor that is about to give way, and the hole it leaves.
 *
 * Danger on the ground has one colour and one shape here and nothing else uses them: weapons are
 * cyan and green, experience is a small diamond, and this is a wide orange disc with a number in
 * it. The disc is the area that will hurt; the ring closing inside it is the time left, so both
 * questions a player has — where, and how long — are answered by looking at the same place.
 */
export class CollapseView {
  private g: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private scars: { x: number; y: number; radius: number; leftMs: number }[] = [];
  private phase = 0;

  constructor(scene: Phaser.Scene, floorLayer: Phaser.GameObjects.Layer, labelLayer: Phaser.GameObjects.Layer) {
    this.g = scene.add.graphics();
    floorLayer.add(this.g);
    for (let i = 0; i < MAX_LABELS; i++) {
      const label = scene.add.text(0, 0, '', textStyle(40, { bold: true, color: COLORS.warn, stroke: true })).setOrigin(0.5).setVisible(false);
      labelLayer.add(label);
      this.labels.push(label);
    }
  }

  /** The floor has gone: leave the hole on screen for a moment so the player sees what it took. */
  collapsed(x: number, y: number, radius: number): void {
    this.scars.push({ x, y, radius, leftMs: SCAR_MS });
  }

  sync(world: World, dtMs: number): void {
    this.phase += dtMs / 1000;
    const g = this.g;
    g.clear();

    for (let i = this.scars.length - 1; i >= 0; i--) {
      const s = this.scars[i];
      s.leftMs -= dtMs;
      if (s.leftMs <= 0) {
        this.scars.splice(i, 1);
        continue;
      }
      const k = s.leftMs / SCAR_MS;
      g.fillStyle(0x020306, 0.85 * k);
      g.fillCircle(s.x, s.y, s.radius);
      g.lineStyle(4, DANGER, 0.7 * k);
      g.strokeCircle(s.x, s.y, s.radius);
    }

    const zones = world.collapses;
    for (let i = 0; i < this.labels.length; i++) {
      const zone = zones[i];
      const label = this.labels[i];
      if (!zone) {
        label.setVisible(false);
        continue;
      }
      const left = Math.max(0, zone.leftMs / zone.totalMs);
      // beats faster as the time runs out, so the last seconds read as urgent without the number
      const beat = 0.5 + 0.5 * Math.sin(this.phase * (3 + 9 * (1 - left)));
      g.fillStyle(DANGER, 0.1 + 0.16 * (1 - left) + 0.06 * beat);
      g.fillCircle(zone.x, zone.y, zone.radius);
      g.lineStyle(4, DANGER_EDGE, 0.75 + 0.25 * beat);
      g.strokeCircle(zone.x, zone.y, zone.radius);
      g.lineStyle(2, DANGER_EDGE, 0.55);
      g.strokeCircle(zone.x, zone.y, Math.max(2, zone.radius * left));
      label.setVisible(true).setPosition(zone.x, zone.y + 64).setText(String(Math.ceil(zone.leftMs / 1000)));
    }
  }

  destroy(): void {
    this.g.destroy();
    for (const l of this.labels) l.destroy();
    this.labels.length = 0;
    this.scars.length = 0;
  }
}
