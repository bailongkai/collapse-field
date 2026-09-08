import Phaser from 'phaser';
import { formatTime, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { restartOnResize } from '../ui/responsive';
import { fitPanel } from '../layout';
import { IconRow } from '../ui/iconRow';
import { commitRun } from '../../core/save/saveData';
import { stageUnlockedBySurviving } from '../../core/save/unlocks';
import { CONTENT } from '../../core/content/registry';
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
  characterId: string;
  stageId: string;
}

/** End-of-run summary. Commits the run into the save on entry, then offers a retry or the menu. */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    const cx = this.scale.width / 2;
    const survived = data.ended === 'survived';
    const ctx = app();

    // a resize rebuilds the screen with the same summary; the run is only committed once, and the
    // stage it opened is remembered so the rebuilt screen can still say so
    let unlockedStage: string | null = (data as ResultsData & { unlockedStage?: string | null }).unlockedStage ?? null;
    if (!(data as ResultsData & { committed?: boolean }).committed) {
      unlockedStage = survived && data.stageId ? stageUnlockedBySurviving(ctx.save, data.stageId) : null;
      ctx.save = commitRun(ctx.storage, ctx.save, {
        timeSec: data.timeSec ?? 0,
        kills: data.kills ?? 0,
        gold: data.gold ?? 0,
        stageId: data.stageId,
        characterId: data.characterId,
        survived,
      });
    }
    restartOnResize(this, { ...data, committed: true, unlockedStage });

    const cy = this.scale.height / 2;
    const panel = fitPanel(this, 720, 520);
    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.93);
    this.add.nineslice(cx, cy, 'ui', 'panel_glass', panel.w, panel.h, 24, 24, 24, 24).setAlpha(0.97).setTint(0x16243a);
    this.add
      .text(cx, cy - panel.h / 2 + 52, survived ? t('results.survived') : t('results.died'), textStyle(Math.round(Math.min(44, panel.w * 0.075)), { bold: true, color: survived ? COLORS.good : COLORS.warn }))
      .setOrigin(0.5);

    const stage = data.stageId ? CONTENT.stages[data.stageId] : undefined;
    const rows: [string, string][] = [
      [t('results.stage'), stage ? t(stage.nameKey) : '—'],
      [t('results.time'), formatTime(data.timeSec ?? 0)],
      [t('results.level'), String(data.level ?? 1)],
      [t('results.kills'), String(data.kills ?? 0)],
      [t('results.gold'), String(data.gold ?? 0)],
    ];
    const half = Math.min(150, panel.w / 2 - 30);
    const rowsTop = cy - panel.h / 2 + 120;
    rows.forEach(([label, value], i) => {
      const y = rowsTop + i * 36;
      this.add.text(cx - half, y, label, textStyle(19, { color: COLORS.dim })).setOrigin(0, 0.5);
      this.add.text(cx + half, y, value, textStyle(19, { bold: true })).setOrigin(1, 0.5);
    });

    if (unlockedStage) {
      const next = CONTENT.stages[unlockedStage];
      this.add
        .text(cx, rowsTop + rows.length * 36 + 2, t('results.unlocked_stage', { name: next ? t(next.nameKey) : unlockedStage }), textStyle(16, { bold: true, color: COLORS.good }))
        .setOrigin(0.5);
    }
    const iconsTop = rowsTop + rows.length * 36 + (unlockedStage ? 40 : 24);
    const weapons = new IconRow(this, cx - 130, iconsTop, 6, 32);
    weapons.setItems(data.weapons ?? [], 'weapon');
    const passives = new IconRow(this, cx - 130, iconsTop + 42, 6, 32);
    passives.setItems(data.passives ?? [], 'passive');

    const btnW = Math.min(220, panel.w / 2 - 24);
    const btnY = cy + panel.h / 2 - 48;
    const stacked = panel.w < 520;
    if (stacked) {
      new UiButton(this, cx, btnY - 60, { id: 'results.retry', label: t('results.retry'), width: Math.min(260, panel.w - 48), onPress: () => this.retry(data) });
      new UiButton(this, cx, btnY, { id: 'results.menu', label: t('results.menu'), width: Math.min(260, panel.w - 48), onPress: () => this.scene.start('Menu') });
    } else {
      new UiButton(this, cx - btnW / 2 - 10, btnY, { id: 'results.retry', label: t('results.retry'), width: btnW, onPress: () => this.retry(data) });
      new UiButton(this, cx + btnW / 2 + 10, btnY, { id: 'results.menu', label: t('results.menu'), width: btnW, onPress: () => this.scene.start('Menu') });
    }
    this.input.keyboard?.on('keydown-ENTER', () => this.retry(data));
    this.input.keyboard?.on('keydown-M', () => this.scene.start('Menu'));
  }

  private retry(data: ResultsData): void {
    // a fixed ?seed= keeps replays reproducible; otherwise every retry is a fresh run
    const seed = app().seed ?? (data.seed + 1) >>> 0;
    this.scene.start('Game', { seed, characterId: data.characterId, stageId: data.stageId });
  }
}
