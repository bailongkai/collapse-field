import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../../config';
import { formatTime, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { IconRow } from '../ui/iconRow';
import { commitRun } from '../../core/save/saveData';
import { app } from '../app';
import type { OwnedItem, RunEnd } from '../../core/sim/runState';

export interface ResultsData {
  timeSec: number;
  kills: number;
  level: number;
  gold: number;
  ended: RunEnd;
  weapons: OwnedItem[];
  passives: OwnedItem[];
  seed: number;
}

/** End-of-run summary. Commits the run into the save on entry, then offers a retry or the menu. */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    const cx = GAME_W / 2;
    const survived = data.ended === 'survived';
    const ctx = app();

    ctx.save = commitRun(ctx.storage, ctx.save, {
      timeSec: data.timeSec ?? 0,
      kills: data.kills ?? 0,
      gold: data.gold ?? 0,
    });

    this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x05070c, 0.93);
    this.add.nineslice(cx, GAME_H / 2, 'ui', 'panel_glass', 720, 520, 24, 24, 24, 24).setAlpha(0.97).setTint(0x16243a);
    this.add
      .text(cx, 168, survived ? t('results.survived') : t('results.died'), textStyle(44, { bold: true, color: survived ? COLORS.good : COLORS.warn }))
      .setOrigin(0.5);

    const rows: [string, string][] = [
      [t('results.time'), formatTime(data.timeSec ?? 0)],
      [t('results.level'), String(data.level ?? 1)],
      [t('results.kills'), String(data.kills ?? 0)],
      [t('results.gold'), String(data.gold ?? 0)],
    ];
    rows.forEach(([label, value], i) => {
      const y = 250 + i * 36;
      this.add.text(cx - 150, y, label, textStyle(20, { color: COLORS.dim })).setOrigin(0, 0.5);
      this.add.text(cx + 150, y, value, textStyle(20, { bold: true })).setOrigin(1, 0.5);
    });

    const weapons = new IconRow(this, cx - 130, 430, 6, 32);
    weapons.setItems(data.weapons ?? [], 'weapon');
    const passives = new IconRow(this, cx - 130, 472, 6, 32);
    passives.setItems(data.passives ?? [], 'passive');

    new UiButton(this, cx - 130, 540, { id: 'results.retry', label: t('results.retry'), width: 220, onPress: () => this.retry(data.seed) });
    new UiButton(this, cx + 130, 540, { id: 'results.menu', label: t('results.menu'), width: 220, onPress: () => this.scene.start('Menu') });
    this.input.keyboard?.on('keydown-ENTER', () => this.retry(data.seed));
    this.input.keyboard?.on('keydown-M', () => this.scene.start('Menu'));
  }

  private retry(previousSeed: number): void {
    // a fixed ?seed= keeps replays reproducible; otherwise every retry is a fresh run
    const seed = app().seed ?? (previousSeed + 1) >>> 0;
    this.scene.start('Game', { seed });
  }
}
