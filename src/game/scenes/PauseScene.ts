import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { viewOf, fitPanel } from '../layout';
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
    const cx = viewOf(this).width / 2;
    const cy = viewOf(this).height / 2;
    // one column on a phone held upright, two when there is room for them
    const oneColumn = fitPanel(this, PANEL_W, PANEL_H).w < 640;
    const sig = game.sim.character.signature;
    const recipes = run.weapons.length;
    // upright, the recipes and the signature go under the stats, so the panel is as tall as they need
    const panel = fitPanel(this, PANEL_W, oneColumn ? PANEL_H + 40 + recipes * 22 + 90 : PANEL_H);
    const left = cx - panel.w / 2 + 40;
    const right = oneColumn ? left : cx + 60;

    this.add.rectangle(cx, cy, viewOf(this).width, viewOf(this).height, 0x05070c, 0.65);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: 0x16243a, rule: true });
    this.add.text(cx, cy - panel.h / 2 + 40, t('pause.title'), textStyle(30, { bold: true, color: COLORS.accent })).setOrigin(0.5);

    // Everything between the title and the buttons goes in one container, so that a screen too
    // short for it shrinks it as a whole instead of running the last lines under the buttons.
    const content = this.add.container(0, 0);
    const put = (o: Phaser.GameObjects.GameObject): void => {
      content.add(o);
    };
    // build: weapons then passives, with their levels
    const top = cy - panel.h / 2 + 90;
    put(this.add.text(left, top, t('pause.weapons'), textStyle(17, { color: COLORS.dim })).setOrigin(0, 0.5));
    const weaponRow = new IconRow(this, left + 20, top + 44, 6, 32);
    weaponRow.setItems(run.weapons, 'weapon');
    weaponRow.addTo(content);
    put(this.add.text(left, top + 92, t('pause.passives'), textStyle(17, { color: COLORS.dim })).setOrigin(0, 0.5));
    const passiveRow = new IconRow(this, left + 20, top + 136, 6, 32);
    passiveRow.setItems(run.passives, 'passive');
    passiveRow.addTo(content);

    // What each weapon becomes and what it still needs. The icons say what is owned; nothing on
    // screen said what any of it was for, and an evolution is the one thing worth planning.
    const listW = oneColumn ? panel.w - 80 : panel.w / 2 - 60;
    const recipesTop = oneColumn ? top + 180 + 30 + Math.ceil(SHOWN_STATS.length / 2) * 26 + 24 : top + 184;
    put(this.add.text(left, recipesTop, t('pause.recipes'), textStyle(17, { color: COLORS.dim })).setOrigin(0, 0.5));
    run.weapons.forEach((w, i) => {
      const def = CONTENT.weapons[w.id];
      const evo = def.evolution;
      const passive = evo ? CONTENT.passives[evo.requires] : undefined;
      const into = evo ? CONTENT.weapons[evo.into] : undefined;
      const name = `${t(def.nameKey)} Lv${w.level}`;
      let line = name;
      let ready = false;
      if (def.evolvedOnly) line = `${name} · ${t('pause.evolved')}`;
      else if (passive && into) {
        const held = run.passives.some((p) => p.id === passive.id);
        ready = held && w.level >= def.maxLevel;
        line = `${name} + ${t(passive.nameKey)}${held ? ' ✓' : ''} → ${t(into.nameKey)}`;
      }
      put(this.add
        .text(left, recipesTop + 26 + i * 22, line, textStyle(14, { color: def.evolvedOnly ? COLORS.accent : ready ? COLORS.gold : COLORS.text, wrapWidth: listW }))
        .setOrigin(0, 0.5));
    });
    const sigTop = recipesTop + 26 + recipes * 22 + 10;
    put(this.add
      .text(left, sigTop, t('launch.signature', { name: t(sig.nameKey), desc: t(sig.descKey) }), textStyle(14, { color: COLORS.dim, wrapWidth: listW }))
      .setOrigin(0, 0)
      .setLineSpacing(2));

    // stats
    // A narrow panel has no room for one tall column of stats: it ran under the buttons. Split it
    // into two shorter columns instead.
    const statsTop = oneColumn ? top + 180 : top;
    const columns = oneColumn ? 2 : 1;
    const perColumn = Math.ceil(SHOWN_STATS.length / columns);
    const columnW = oneColumn ? (panel.w - 80) / 2 : 300;
    put(this.add.text(right, statsTop, t('pause.stats'), textStyle(17, { color: COLORS.dim })).setOrigin(0, 0.5));
    SHOWN_STATS.forEach((key, i) => {
      const column = Math.floor(i / perColumn);
      const row = i % perColumn;
      const x = right + column * (columnW + 16);
      const y = statsTop + 30 + row * 26;
      const value = ABSOLUTE_STATS.has(key) ? String(Math.round(stats[key] * 10) / 10) : `${Math.round(stats[key] * 100)}%`;
      put(this.add.text(x, y, t(`stat.${key}` as Parameters<typeof t>[0]), textStyle(15, { color: COLORS.dim })).setOrigin(0, 0.5));
      put(this.add.text(x + columnW - 12, y, value, textStyle(15, { bold: true })).setOrigin(1, 0.5));
    });

    const footerTop = cy + panel.h / 2 - 44 - 28 - 10;
    const bounds = content.getBounds();
    const k = Math.min(1, (footerTop - top + 14) / Math.max(1, bounds.bottom - top + 14));
    // scaled about the top of the content, in the middle of the panel
    content.setScale(k).setPosition(cx * (1 - k), (top - 14) * (1 - k));

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
