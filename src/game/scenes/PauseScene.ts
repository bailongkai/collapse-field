import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { restartOnResize } from '../ui/responsive';
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
    const left = cx - PANEL_W / 2 + 48;
    const right = cx + 60;

    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.65);
    this.add.nineslice(cx, cy, 'ui', 'panel_glass', PANEL_W, PANEL_H, 24, 24, 24, 24).setAlpha(0.97).setTint(0x16243a);
    this.add.text(cx, cy - PANEL_H / 2 + 44, t('pause.title'), textStyle(34, { bold: true, color: COLORS.accent })).setOrigin(0.5);

    // build: weapons then passives, with their levels
    this.add.text(left, cy - 150, t('pause.weapons'), textStyle(18, { color: COLORS.dim })).setOrigin(0, 0.5);
    const weaponRow = new IconRow(this, left + 22, cy - 104, 6);
    weaponRow.setItems(run.weapons, 'weapon');
    this.add.text(left, cy - 40, t('pause.passives'), textStyle(18, { color: COLORS.dim })).setOrigin(0, 0.5);
    const passiveRow = new IconRow(this, left + 22, cy + 6, 6);
    passiveRow.setItems(run.passives, 'passive');

    // names of what is owned, so the icons are not a guessing game
    const names = [
      ...run.weapons.map((w) => `${t(CONTENT.weapons[w.id].nameKey)} Lv${w.level}`),
      ...run.passives.map((p) => `${t(CONTENT.passives[p.id].nameKey)} Lv${p.level}`),
    ];
    this.add.text(left, cy + 70, names.join('\n'), textStyle(15, { color: COLORS.text, wrapWidth: 360 })).setOrigin(0, 0);

    // stats
    this.add.text(right, cy - 150, t('pause.stats'), textStyle(18, { color: COLORS.dim })).setOrigin(0, 0.5);
    SHOWN_STATS.forEach((key, i) => {
      const y = cy - 118 + i * 26;
      const value = ABSOLUTE_STATS.has(key) ? String(Math.round(stats[key] * 10) / 10) : `${Math.round(stats[key] * 100)}%`;
      this.add.text(right, y, t(`stat.${key}` as Parameters<typeof t>[0]), textStyle(16, { color: COLORS.dim })).setOrigin(0, 0.5);
      this.add.text(right + 300, y, value, textStyle(16, { bold: true })).setOrigin(1, 0.5);
    });

    new UiButton(this, cx - 130, cy + PANEL_H / 2 - 48, { id: 'pause.resume', label: t('pause.resume'), width: 220, onPress: () => this.resumeGame() });
    new UiButton(this, cx + 130, cy + PANEL_H / 2 - 48, { id: 'pause.menu', label: t('pause.menu'), width: 220, onPress: () => this.toMenu() });

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
