import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { restartOnResize } from '../ui/responsive';
import { fitPanel, isPortraitScene } from '../layout';
import { app } from '../app';
import { ENEMY_LIST } from '../../data/enemies';

/** Every enemy, lit once it has been met. The unmet ones are silhouettes with a question mark. */
export class BestiaryScene extends Phaser.Scene {
  constructor() {
    super('Bestiary');
  }

  create(): void {
    restartOnResize(this);
    const save = app().save;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const portrait = isPortraitScene(this) || this.scale.width < 760;
    const cols = portrait ? 3 : 6;
    const cell = portrait ? 96 : 118;
    const rows = Math.ceil(ENEMY_LIST.length / cols);
    const panel = fitPanel(this, cols * cell + 48, 150 + rows * cell);
    const k = Math.min(1, panel.h / (150 + rows * cell));
    const cw = cell * Math.min(1, (panel.w - 48) / (cols * cell));
    const ch = cell * k;
    const met = ENEMY_LIST.filter((e) => save.seen.includes(e.id)).length;

    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.85);
    this.add.nineslice(cx, cy, 'ui', 'panel_glass', panel.w, panel.h, 24, 24, 24, 24).setAlpha(0.97).setTint(0x16243a);
    this.add.text(cx - panel.w / 2 + 24, cy - panel.h / 2 + 36 * k, t('bestiary.title'), textStyle(Math.round(26 * k), { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
    this.add
      .text(cx + panel.w / 2 - 24, cy - panel.h / 2 + 36 * k, t('bestiary.progress', { a: met, b: ENEMY_LIST.length }), textStyle(Math.round(18 * k), { bold: true, color: COLORS.gold }))
      .setOrigin(1, 0.5);

    const left = cx - (cols * cw) / 2;
    const top = cy - panel.h / 2 + 76 * k;
    ENEMY_LIST.forEach((def, i) => {
      const x = left + (i % cols) * cw + cw / 2;
      const y = top + Math.floor(i / cols) * ch + ch / 2;
      const seen = save.seen.includes(def.id);
      const img = this.add.image(x, y - 12 * k, 'game', def.frame).setDisplaySize(Math.round(44 * k), Math.round(44 * k));
      if (seen) {
        if (def.tint !== undefined) img.setTint(def.tint);
      } else {
        img.setTint(0x000000).setAlpha(0.5);
      }
      this.add
        .text(x, y + 22 * k, seen ? t(def.nameKey) : '???', textStyle(Math.round(12 * k), { color: seen ? COLORS.text : COLORS.dim }))
        .setOrigin(0.5);
    });

    new UiButton(this, cx, cy + panel.h / 2 - 36 * k, { id: 'bestiary.back', label: t('common.back'), width: Math.min(200, panel.w - 48), height: Math.round(48 * k), onPress: () => this.close() });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close(): void {
    this.scene.stop();
    this.scene.launch('Achievements');
    this.scene.bringToTop('Achievements');
  }
}
