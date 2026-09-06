import type Phaser from 'phaser';
import { CONTENT } from '../../core/content/registry';
import type { OwnedItem } from '../../core/sim/runState';
import { textStyle, COLORS } from './textStyles';

const SLOT = 36;
const GAP = 6;

/** A row of weapon or passive icons with their level, used by both the HUD and the pause screen. */
export class IconRow {
  private icons: Phaser.GameObjects.Image[] = [];
  private levels: Phaser.GameObjects.Text[] = [];
  private size: number;

  constructor(scene: Phaser.Scene, x: number, y: number, slots: number, size = SLOT) {
    this.size = size;
    for (let i = 0; i < slots; i++) {
      const cx = x + i * (size + GAP);
      const icon = scene.add.image(cx, y, 'game', 'pk_coin').setDisplaySize(size, size).setVisible(false);
      const level = scene.add
        .text(cx + size / 2 - 2, y + size / 2 - 2, '', textStyle(12, { bold: true, color: COLORS.gold }))
        .setOrigin(1, 1)
        .setVisible(false);
      this.icons.push(icon);
      this.levels.push(level);
    }
  }

  addTo(layerOrScene: { add: (o: Phaser.GameObjects.GameObject[]) => unknown }): void {
    layerOrScene.add([...this.icons, ...this.levels]);
  }

  setItems(items: readonly OwnedItem[], kind: 'weapon' | 'passive'): void {
    for (let i = 0; i < this.icons.length; i++) {
      const item = items[i];
      if (!item) {
        this.icons[i].setVisible(false);
        this.levels[i].setVisible(false);
        continue;
      }
      const def = kind === 'weapon' ? CONTENT.weapons[item.id] : CONTENT.passives[item.id];
      if (!def) continue;
      this.icons[i].setFrame(def.icon);
      this.icons[i].setDisplaySize(this.size, this.size);
      this.icons[i].setVisible(true);
      this.levels[i].setText(String(item.level));
      this.levels[i].setVisible(true);
    }
  }

  get objects(): Phaser.GameObjects.GameObject[] {
    return [...this.icons, ...this.levels];
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.icons.length = 0;
    this.levels.length = 0;
  }
}
