import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { restartOnResize } from '../ui/responsive';
import { UPGRADE_LIST } from '../../data/upgrades';
import { buyUpgrade, upgradeCost, upgradeLevel } from '../../core/save/upgrades';
import { app } from '../app';
import { sfx } from '../audio/sfx';

const ROW_H = 58;

/** Between-run shop: gold from finished runs buys permanent stat upgrades. */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create(): void {
    restartOnResize(this);
    const ctx = app();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const panelW = 760;
    const panelH = 150 + UPGRADE_LIST.length * ROW_H;
    const left = cx - panelW / 2 + 36;

    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.85);
    this.add.nineslice(cx, cy, 'ui', 'panel_glass', panelW, panelH, 24, 24, 24, 24).setAlpha(0.97).setTint(0x16243a);
    this.add.text(left, cy - panelH / 2 + 40, t('shop.title'), textStyle(30, { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
    this.add.text(cx + panelW / 2 - 36, cy - panelH / 2 + 40, t('shop.gold', { n: ctx.save.gold }), textStyle(22, { bold: true, color: COLORS.gold })).setOrigin(1, 0.5);

    UPGRADE_LIST.forEach((def, i) => {
      const y = cy - panelH / 2 + 96 + i * ROW_H;
      const level = upgradeLevel(ctx.save, def.id);
      const cost = upgradeCost(def, level);
      this.add.image(left + 20, y, 'game', def.icon).setDisplaySize(36, 36);
      this.add.text(left + 52, y - 12, t(def.nameKey), textStyle(19, { bold: true })).setOrigin(0, 0.5);
      this.add.text(left + 52, y + 12, t(def.descKey), textStyle(14, { color: COLORS.dim })).setOrigin(0, 0.5);
      this.add.text(cx + 60, y, t('shop.level', { a: level, b: def.maxLevel }), textStyle(16, { color: level >= def.maxLevel ? COLORS.good : COLORS.text })).setOrigin(0, 0.5);
      const btn = new UiButton(this, cx + panelW / 2 - 110, y, {
        id: `shop.buy.${def.id}`,
        label: cost === null ? t('shop.max') : t('shop.buy', { n: cost }),
        width: 150,
        height: 44,
        fontSize: 17,
        onPress: () => this.buy(def.id),
      });
      if (cost === null || ctx.save.gold < cost) btn.setEnabled(false);
    });

    new UiButton(this, cx, cy + panelH / 2 - 40, { id: 'shop.back', label: t('common.back'), width: 200, height: 48, onPress: () => this.close() });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private buy(id: string): void {
    const ctx = app();
    const { result, save } = buyUpgrade(ctx.storage, ctx.save, id);
    if (result === 'bought') {
      ctx.save = save;
      sfx.play('levelup');
      this.scene.restart();
    } else {
      sfx.play('click');
    }
  }

  private close(): void {
    this.scene.stop();
    const menu = this.scene.get('Menu');
    if (menu) menu.scene.restart();
  }
}
