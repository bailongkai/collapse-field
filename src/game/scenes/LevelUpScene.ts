import Phaser from 'phaser';
import { restartOnResize } from '../ui/responsive';
import { t, tDynamic } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { registerButton } from '../ui/buttonRegistry';
import { sfx } from '../audio/sfx';
import { describeDeltas } from '../../core/levelup/roll';
import { weaponParams } from '../../core/stats/weaponParams';
import { CONTENT } from '../../core/content/registry';
import type { LevelUpChoice } from '../../core/sim/runState';
import type { GameScene } from './GameScene';

/** The Kenney UI art is light; these tints keep the overlay readable over the dark station floor. */
const PANEL_TINT = 0x16243a;
const CARD_TINT = 0x2a3a52;
const CARD_TINT_SELECTED = 0x4a90c4;

const CARD_W = 480;
const CARD_H = 96;
const CARD_GAP = 12;

/** Overlay that presents the level-up offer. Fully keyboard driven, and each card is pressable by id. */
export class LevelUpScene extends Phaser.Scene {
  private cards: Phaser.GameObjects.Container[] = [];
  private selected = 0;
  private cleanups: (() => void)[] = [];
  /** id of the pointer that pressed a card, or -1 */
  private armed = -1;

  constructor() {
    super('LevelUp');
  }

  create(): void {
    restartOnResize(this);
    // Phaser reuses the scene instance across launches, so per-launch state must be reset here or
    // the second level-up would still point at the first one's destroyed cards.
    this.cards = [];
    this.selected = 0;
    this.cleanups = [];
    this.armed = -1;
    window.__game?.pushEvent('levelup:open');

    const game = this.scene.get('Game') as GameScene;
    const choices = game.sim.run.choices ?? [];

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x05070c, 0.6);
    const panelH = 140 + choices.length * (CARD_H + CARD_GAP);
    this.add.nineslice(this.scale.width / 2, this.scale.height / 2, 'ui', 'panel_glass', 560, panelH, 24, 24, 24, 24).setAlpha(0.96).setTint(PANEL_TINT);
    this.add.text(this.scale.width / 2, this.scale.height / 2 - panelH / 2 + 42, t('levelup.title'), textStyle(32, { bold: true, color: COLORS.accent })).setOrigin(0.5);

    const top = this.scale.height / 2 - panelH / 2 + 96;
    choices.forEach((choice, i) => {
      const y = top + i * (CARD_H + CARD_GAP) + CARD_H / 2;
      this.cards.push(this.buildCard(choice, i, y));
    });

    this.setSelected(0);

    const kb = this.input.keyboard;
    kb?.on('keydown-UP', () => this.move(-1));
    kb?.on('keydown-W', () => this.move(-1));
    kb?.on('keydown-DOWN', () => this.move(1));
    kb?.on('keydown-S', () => this.move(1));
    kb?.on('keydown-ENTER', () => this.choose(this.selected));
    kb?.on('keydown-SPACE', () => this.choose(this.selected));
    for (let i = 0; i < Math.min(4, choices.length); i++) {
      kb?.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR'][i]}`, () => this.choose(i));
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const c of this.cleanups) c();
      this.cleanups.length = 0;
    });
  }

  private describe(choice: LevelUpChoice): { title: string; tag: string; body: string; icon: string; iconTint?: number } {
    if (choice.kind === 'weapon') {
      const def = CONTENT.weapons[choice.id];
      const isNew = choice.toLevel === 1;
      const delta = isNew ? null : def.levels[choice.toLevel - 2];
      let body = isNew
        ? t(def.descKey)
        : describeDeltas(delta ?? {})
            .map((d) => tDynamic(d.key, { v: d.value }))
            .join(' · ');
      // reaching max level is when the evolution becomes possible; say so on the card
      if (!isNew && choice.toLevel === def.maxLevel && def.evolution) {
        const passive = CONTENT.passives[def.evolution.requires];
        const into = CONTENT.weapons[def.evolution.into];
        if (passive && into) body += ` · ${t('evolve.hint', { passive: t(passive.nameKey), into: t(into.nameKey) })}`;
      }
      return {
        title: t(def.nameKey),
        tag: isNew ? t('levelup.new_weapon') : t('levelup.level_to', { a: choice.toLevel - 1, b: choice.toLevel }),
        body: body || t(def.descKey),
        icon: def.icon,
        iconTint: def.iconTint,
      };
    }
    if (choice.kind === 'passive') {
      const def = CONTENT.passives[choice.id];
      const isNew = choice.toLevel === 1;
      return {
        title: t(def.nameKey),
        tag: isNew ? t('levelup.new_passive') : t('levelup.level_to', { a: choice.toLevel - 1, b: choice.toLevel }),
        body: t(def.descKey),
        icon: def.icon,
      };
    }
    if (choice.kind === 'gold') {
      return { title: t('levelup.gold', { n: choice.amount }), tag: '', body: t('levelup.gold_desc', { n: choice.amount }), icon: 'pk_coin' };
    }
    const healAmount = choice.kind === 'heal' ? choice.amount : 0;
    return { title: t('levelup.heal'), tag: '', body: t('levelup.heal_desc', { n: healAmount }), icon: 'pk_heal' };
  }

  private buildCard(choice: LevelUpChoice, index: number, y: number): Phaser.GameObjects.Container {
    const info = this.describe(choice);
    const container = this.add.container(this.scale.width / 2, y);
    const bg = this.add.nineslice(0, 0, 'ui', 'panel_rect', CARD_W, CARD_H, 16, 16, 16, 16).setTint(CARD_TINT);
    const icon = this.add.image(-CARD_W / 2 + 44, 0, 'game', info.icon).setDisplaySize(44, 44);
    if (info.iconTint !== undefined) icon.setTint(info.iconTint);
    const title = this.add.text(-CARD_W / 2 + 84, -24, info.title, textStyle(22, { bold: true })).setOrigin(0, 0.5);
    const tag = this.add.text(CARD_W / 2 - 16, -24, info.tag, textStyle(16, { color: COLORS.accent })).setOrigin(1, 0.5);
    const body = this.add.text(-CARD_W / 2 + 84, 12, info.body, textStyle(15, { color: COLORS.dim, wrapWidth: CARD_W - 110 })).setOrigin(0, 0.5);
    container.add([bg, icon, title, tag, body]);
    container.setData('bg', bg);

    const hit = new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
    container.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    container.on('pointerover', () => this.setSelected(index));
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.armed = pointer.id;
      this.setSelected(index);
    });
    container.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // the overlay appears 250 ms after the flash, often under a finger that is already down:
      // acting on that release would pick a card the player never got to read
      if (this.armed !== pointer.id) return;
      this.armed = -1;
      this.choose(index);
    });

    this.cleanups.push(
      registerButton({
        id: `levelup.card${index}`,
        getPos: () => ({ x: container.x, y: container.y }),
        isEnabled: () => container.active,
        press: () => this.choose(index),
      }),
    );
    return container;
  }

  private move(delta: number): void {
    if (this.cards.length === 0) return;
    this.setSelected((this.selected + delta + this.cards.length) % this.cards.length);
    sfx.play('click');
  }

  private setSelected(index: number): void {
    this.selected = index;
    this.cards.forEach((card, i) => {
      const bg = card.getData('bg') as Phaser.GameObjects.NineSlice;
      const on = i === index;
      bg.setTint(on ? CARD_TINT_SELECTED : CARD_TINT);
      card.setScale(on ? 1.03 : 1);
    });
  }

  private choose(index: number): void {
    const game = this.scene.get('Game') as GameScene;
    sfx.play('levelup');
    game.applyLevelUpChoice(index);
  }

  /** Weapon params are shown on the pause screen; exposed here so both agree on the source. */
  static paramsFor(id: string, level: number) {
    return weaponParams(CONTENT.weapons[id], level);
  }
}
