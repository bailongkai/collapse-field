import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { fitPanel, isPortraitScene } from '../layout';
import { app } from '../app';
import { ACHIEVEMENT_LIST } from '../../data/achievements';
import { CONTENT } from '../../core/content/registry';

const ROW_H = 54;

/**
 * Every achievement, earned or not. The unearned ones are the point: each is a plan for the next
 * run, and the ones that open an item say which.
 */
export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('Achievements');
  }

  create(): void {
    restartOnResize(this);
    const save = app().save;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const wide = this.scale.width >= 980 && !isPortraitScene(this);
    const cols = wide ? 2 : 1;
    const rowsTall = Math.ceil(ACHIEVEMENT_LIST.length / cols);
    const rowH = Math.max(40, Math.min(ROW_H, (this.scale.height - 200) / rowsTall));
    const panel = fitPanel(this, wide ? 1180 : 720, 170 + rowsTall * rowH);
    const colW = (panel.w - 24 * (cols + 1)) / cols;
    const left = cx - panel.w / 2 + 24;
    const earned = ACHIEVEMENT_LIST.filter((a) => save.achievements.includes(a.id)).length;

    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.85);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: 0x16243a, rule: true });
    this.add.text(left, cy - panel.h / 2 + 36, t('achievements.title'), textStyle(26, { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
    this.add
      .text(cx + panel.w / 2 - 24, cy - panel.h / 2 + 36, t('achievements.progress', { a: earned, b: ACHIEVEMENT_LIST.length }), textStyle(18, { bold: true, color: COLORS.gold }))
      .setOrigin(1, 0.5);

    ACHIEVEMENT_LIST.forEach((def, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = left + col * (colW + 24);
      const y = cy - panel.h / 2 + 84 + row * rowH;
      const done = save.achievements.includes(def.id);
      const img = this.add.image(x + 18, y, 'game', def.icon).setDisplaySize(30, 30);
      if (!done) img.setAlpha(0.35);
      this.add.text(x + 44, y - 10, t(def.nameKey), textStyle(16, { bold: true, color: done ? COLORS.text : COLORS.dim })).setOrigin(0, 0.5);
      let reward = '';
      if (def.unlocks?.gold) reward = t('achievements.reward_gold', { n: def.unlocks.gold });
      const itemId = def.unlocks?.passive ?? def.unlocks?.weapon;
      if (itemId) {
        const item = CONTENT.passives[itemId] ?? CONTENT.weapons[itemId];
        reward = t('achievements.reward_item', { name: item ? t(item.nameKey) : itemId });
      }
      this.add.text(x + 44, y + 10, `${t(def.descKey)}${reward ? ' · ' + reward : ''}`, textStyle(12, { color: COLORS.dim, wrapWidth: colW - 60 })).setOrigin(0, 0.5);
      this.add
        .text(x + colW - 8, y, done ? '✓' : t('achievements.locked'), textStyle(13, { bold: true, color: done ? COLORS.good : COLORS.dim }))
        .setOrigin(1, 0.5);
    });

    const bw = Math.min(200, panel.w / 2 - 36);
    new UiButton(this, cx - bw / 2 - 10, cy + panel.h / 2 - 36, { id: 'achievements.bestiary', label: t('bestiary.title'), width: bw, height: 48, onPress: () => this.openBestiary() });
    new UiButton(this, cx + bw / 2 + 10, cy + panel.h / 2 - 36, { id: 'achievements.back', label: t('common.back'), width: bw, height: 48, onPress: () => this.close() });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private openBestiary(): void {
    this.scene.stop();
    this.scene.launch('Bestiary');
    this.scene.bringToTop('Bestiary');
  }

  private close(): void {
    this.scene.stop();
    const menu = this.scene.get('Menu');
    if (menu) menu.scene.restart();
  }
}
