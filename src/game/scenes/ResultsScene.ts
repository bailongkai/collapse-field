import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../../config';
import { formatTime, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import type { RunEnd } from '../../core/sim/runState';

export interface ResultsData {
  timeSec: number;
  kills: number;
  level: number;
  gold: number;
  ended: RunEnd;
}

/** Minimal results screen; the full build summary and save commit land with the full-run milestone. */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    const cx = GAME_W / 2;
    const survived = data.ended === 'survived';
    this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x05070c, 0.92);
    this.add.text(cx, 180, survived ? t('results.survived') : t('results.died'),
      textStyle(48, { bold: true, color: survived ? COLORS.good : COLORS.warn })).setOrigin(0.5);

    const rows: [string, string][] = [
      [t('results.time'), formatTime(data.timeSec ?? 0)],
      [t('results.level'), String(data.level ?? 1)],
      [t('results.kills'), String(data.kills ?? 0)],
    ];
    rows.forEach(([label, value], i) => {
      const y = 280 + i * 40;
      this.add.text(cx - 120, y, label, textStyle(22, { color: COLORS.dim })).setOrigin(0, 0.5);
      this.add.text(cx + 120, y, value, textStyle(22, { bold: true })).setOrigin(1, 0.5);
    });

    new UiButton(this, cx - 130, 480, { id: 'results.retry', label: t('results.retry'), width: 220, onPress: () => this.retry() });
    new UiButton(this, cx + 130, 480, { id: 'results.menu', label: t('results.menu'), width: 220, onPress: () => this.scene.start('Menu') });
    this.input.keyboard?.on('keydown-ENTER', () => this.retry());
    this.input.keyboard?.on('keydown-M', () => this.scene.start('Menu'));
  }

  private retry(): void {
    this.scene.start('Game', { seed: Date.now() >>> 0 });
  }
}
