import Phaser from 'phaser';
import { restartOnResize } from '../ui/responsive';
import { fitPanel, minTouchUnits } from '../layout';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { registerButton } from '../ui/buttonRegistry';
import { sfx } from '../audio/sfx';
import { weaponParams } from '../../core/stats/weaponParams';
import { CONTENT } from '../../core/content/registry';
import { describeChoice } from '../ui/choiceCard';
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
  private scaleUi = 1;
  private cardW = CARD_W;
  private cardH = CARD_H;

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

    this.scaleUi = 1;
    const wanted = fitPanel(this, 560, 140 + choices.length * (CARD_H + CARD_GAP));
    this.cardW = Math.min(CARD_W, wanted.w - 80);
    this.cardH = Math.min(CARD_H, Math.max(72, (wanted.h - 140) / Math.max(1, choices.length) - CARD_GAP));
    const gap = CARD_GAP;

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x05070c, 0.6);
    const panelH = 140 + choices.length * (this.cardH + gap);
    const panelW = this.cardW + 80;
    this.add.nineslice(this.scale.width / 2, this.scale.height / 2, 'ui', 'panel_glass', panelW, panelH, 24, 24, 24, 24).setAlpha(0.96).setTint(PANEL_TINT);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - panelH / 2 + Math.round(42 * this.scaleUi), t('levelup.title'), textStyle(Math.round(32 * this.scaleUi), { bold: true, color: COLORS.accent }))
      .setOrigin(0.5);

    const top = this.scale.height / 2 - panelH / 2 + Math.round(96 * this.scaleUi);
    choices.forEach((choice, i) => {
      const y = top + i * (this.cardH + gap) + this.cardH / 2;
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

  private buildCard(choice: LevelUpChoice, index: number, y: number): Phaser.GameObjects.Container {
    const info = describeChoice(choice);
    const u = this.scaleUi;
    const w = this.cardW;
    const h = this.cardH;
    const container = this.add.container(this.scale.width / 2, y);
    const bg = this.add.nineslice(0, 0, 'ui', 'panel_rect', w, h, 16, 16, 16, 16).setTint(CARD_TINT);
    const iconSize = Math.round(44 * u);
    const icon = this.add.image(-w / 2 + Math.round(44 * u), 0, 'game', info.icon).setDisplaySize(iconSize, iconSize);
    if (info.iconTint !== undefined) icon.setTint(info.iconTint);
    const title = this.add.text(-w / 2 + Math.round(84 * u), -Math.round(24 * u), info.title, textStyle(Math.round(22 * u), { bold: true })).setOrigin(0, 0.5);
    const tag = this.add.text(w / 2 - Math.round(16 * u), -Math.round(24 * u), info.tag, textStyle(Math.round(16 * u), { color: COLORS.accent })).setOrigin(1, 0.5);
    const body = this.add
      .text(-w / 2 + Math.round(84 * u), Math.round(12 * u), info.body, textStyle(Math.round(15 * u), { color: COLORS.dim, wrapWidth: w - Math.round(110 * u) }))
      .setOrigin(0, 0.5);
    container.add([bg, icon, title, tag, body]);
    container.setData('bg', bg);

    const minUnits = minTouchUnits(this);
    const hitW = Math.max(w, minUnits);
    const hitH = Math.max(h, minUnits);
    // no setSize on this container, so its displayOrigin is zero and the rectangle really is
    // centred on the card. See UiButton for why that distinction matters.
    container.setInteractive(new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH), Phaser.Geom.Rectangle.Contains);
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
        getHitSize: () => ({ w: hitW, h: hitH }),
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
