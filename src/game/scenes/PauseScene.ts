import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { restartOnResize } from '../ui/responsive';
import { fitPanel } from '../layout';
import { IconRow } from '../ui/iconRow';
import { CONTENT } from '../../core/content/registry';
import type { StatKey } from '../../data/types';
import type { GameScene } from './GameScene';

const PANEL_W = 900;
const PANEL_H = 560;
const SHOWN_STATS: StatKey[] = ['maxHealth', 'armor', 'recovery', 'moveSpeed', 'might', 'area', 'cooldown', 'amount', 'magnet'];
/** Stats that are counts or points rather than multipliers, so they must not be shown as a percentage. */
const ABSOLUTE_STATS = new Set<StatKey>(['maxHealth', 'armor', 'amount', 'recovery', 'revival']);

/** Pause overlay with the current build and the run's stats. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    restartOnResize(this);
    const game = this.scene.get('Game') as GameScene;
    const run = game.sim.run;
    const stats = game.sim.stats;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const panel = fitPanel(this, PANEL_W, PANEL_H);
    // one column on a phone held upright, two when there is room for them
    const oneColumn = panel.w < 640;
    const left = cx - panel.w / 2 + 40;
    const right = oneColumn ? left : cx + 60;

    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.65);
    this.add.nineslice(cx, cy, 'ui', 'panel_glass', panel.w, panel.h, 24, 24, 24, 24).setAlpha(0.97).setTint(0x16243a);
    this.add.text(cx, cy - panel.h / 2 + 40, t('pause.title'), textStyle(30, { bold: true, color: COLORS.accent })).setOrigin(0.5);

    // build: weapons then passives, with their levels
    const top = cy - panel.h / 2 + 90;
    this.add.text(left, top, t('pause.weapons'), textStyle(17, { color: COLORS.dim })).setOrigin(0, 0.5);
    const weaponRow = new IconRow(this, left + 20, top + 44, 6, 32);
    weaponRow.setItems(run.weapons, 'weapon');
    this.add.text(left, top + 92, t('pause.passives'), textStyle(17, { color: COLORS.dim })).setOrigin(0, 0.5);
    const passiveRow = new IconRow(this, left + 20, top + 136, 6, 32);
    passiveRow.setItems(run.passives, 'passive');

    // names of what is owned, so the icons are not a guessing game
    const names = [
      ...run.weapons.map((w) => `${t(CONTENT.weapons[w.id].nameKey)} Lv${w.level}`),
      ...run.passives.map((p) => `${t(CONTENT.passives[p.id].nameKey)} Lv${p.level}`),
    ];
    if (!oneColumn) {
      this.add
        .text(left, top + 180, names.join('\n'), textStyle(15, { color: COLORS.text, wrapWidth: panel.w / 2 - 60 }))
        .setOrigin(0, 0);
    }

    // stats
    // A narrow panel has no room for one tall column of stats: it ran under the buttons. Split it
    // into two shorter columns instead.
    const statsTop = oneColumn ? top + 180 : top;
    const columns = oneColumn ? 2 : 1;
    const perColumn = Math.ceil(SHOWN_STATS.length / columns);
    const columnW = oneColumn ? (panel.w - 80) / 2 : 300;
    this.add.text(right, statsTop, t('pause.stats'), textStyle(17, { color: COLORS.dim })).setOrigin(0, 0.5);
    SHOWN_STATS.forEach((key, i) => {
      const column = Math.floor(i / perColumn);
      const row = i % perColumn;
      const x = right + column * (columnW + 16);
      const y = statsTop + 30 + row * 26;
      const value = ABSOLUTE_STATS.has(key) ? String(Math.round(stats[key] * 10) / 10) : `${Math.round(stats[key] * 100)}%`;
      this.add.text(x, y, t(`stat.${key}` as Parameters<typeof t>[0]), textStyle(15, { color: COLORS.dim })).setOrigin(0, 0.5);
      this.add.text(x + columnW - 12, y, value, textStyle(15, { bold: true })).setOrigin(1, 0.5);
    });

    const btnW = Math.min(220, panel.w / 2 - 24);
    const btnY = cy + panel.h / 2 - 44;
    new UiButton(this, cx - btnW / 2 - 10, btnY, { id: 'pause.resume', label: t('pause.resume'), width: btnW, onPress: () => this.resumeGame() });
    new UiButton(this, cx + btnW / 2 + 10, btnY, { id: 'pause.menu', label: t('pause.menu'), width: btnW, onPress: () => this.toMenu() });

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.resumeGame());
    kb?.on('keydown-P', () => this.resumeGame());
    kb?.on('keydown-ENTER', () => this.resumeGame());
    kb?.on('keydown-M', () => this.toMenu());
  }

  private resumeGame(): void {
    (this.scene.get('Game') as GameScene).closePause();
  }

  private toMenu(): void {
    this.scene.stop();
    this.scene.stop('Game');
    this.scene.start('Menu');
  }
}
