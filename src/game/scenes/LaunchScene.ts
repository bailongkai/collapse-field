import Phaser from 'phaser';
import { formatTime, t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { registerButton } from '../ui/buttonRegistry';
import { restartOnResize } from '../ui/responsive';
import { fitPanel, isPortraitScene, minTouchUnits } from '../layout';
import { app } from '../app';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { audioContextOf } from '../audio/context';
import { CHARACTER_LIST } from '../../data/characters';
import { STAGE_ORDER } from '../../data/stages';
import { isCharacterUnlocked, isStageUnlocked } from '../../core/save/unlocks';
import { writeSave } from '../../core/save/saveData';
import type { CharacterDef, StageDef } from '../../data/types';

const PANEL_TINT = 0x16243a;
const CARD_TINT = 0x2a3a52;
const CARD_TINT_SELECTED = 0x4a90c4;
const CARD_TINT_LOCKED = 0x1c2430;

/**
 * The launch screen: pick a character and a stage, then go. It sits over the menu like the shop
 * does, and it is the only place a run is started from the menu, so the selection is remembered
 * in the save and offered back next time.
 *
 * Locked items are shown, not hidden: a character with a price on it and a stage that says which
 * clear opens it are both goals. Hiding them would hide the reason to come back.
 */
export class LaunchScene extends Phaser.Scene {
  private characterId = 'survivor';
  private stageId = 'station';
  private cardBgs = new Map<string, Phaser.GameObjects.NineSlice>();
  private startBtn!: UiButton;
  private cleanups: (() => void)[] = [];

  constructor() {
    super('Launch');
  }

  create(): void {
    restartOnResize(this);
    // the scene instance is reused: every per-open field is reset here
    this.cardBgs = new Map();
    this.cleanups = [];
    const save = app().save;
    this.characterId = isCharacterUnlocked(save, save.lastCharacterId) ? save.lastCharacterId : 'survivor';
    this.stageId = isStageUnlocked(save, save.lastStageId) ? save.lastStageId : 'station';

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const portrait = isPortraitScene(this) || this.scale.width < 760;
    const chars = CHARACTER_LIST;
    const stages = STAGE_ORDER;

    // two columns side by side on a wide screen, stacked on a phone held upright
    const cardH = portrait ? 58 : 66;
    const gap = 8;
    const colCount = portrait ? 1 : 2;
    const listH = (n: number): number => 34 + n * (cardH + gap);
    const wantH = portrait ? 150 + listH(chars.length) + listH(stages.length) : 170 + Math.max(listH(chars.length), listH(stages.length));
    const panel = fitPanel(this, portrait ? 520 : 900, wantH);
    const k = Math.min(1, panel.h / wantH);
    const rowH = cardH * k;
    const rowGap = gap * k;
    const colW = (panel.w - 24 * (colCount + 1)) / colCount;
    const top = cy - panel.h / 2;

    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.85);
    this.add.nineslice(cx, cy, 'ui', 'panel_glass', panel.w, panel.h, 24, 24, 24, 24).setAlpha(0.97).setTint(PANEL_TINT);
    this.add.text(cx, top + 36 * k, t('launch.title'), textStyle(Math.round(28 * k), { bold: true, color: COLORS.accent })).setOrigin(0.5);

    const leftX = cx - panel.w / 2 + 24;
    const charX = leftX;
    const stageX = portrait ? leftX : leftX + colW + 24;
    const charTop = top + 76 * k;
    const stageTop = portrait ? charTop + listH(chars.length) * k : charTop;

    this.add.text(charX, charTop, t('launch.character'), textStyle(Math.round(17 * k), { bold: true, color: COLORS.dim })).setOrigin(0, 0.5);
    chars.forEach((c, i) => this.characterCard(c, charX, charTop + 30 * k + i * (rowH + rowGap), colW, rowH, k));
    this.add.text(stageX, stageTop, t('launch.stage'), textStyle(Math.round(17 * k), { bold: true, color: COLORS.dim })).setOrigin(0, 0.5);
    stages.forEach((s, i) => this.stageCard(s, stageX, stageTop + 30 * k + i * (rowH + rowGap), colW, rowH, k));

    const btnY = cy + panel.h / 2 - 40 * k;
    const btnW = Math.min(220, panel.w / 2 - 30);
    new UiButton(this, cx - btnW / 2 - 10, btnY, { id: 'launch.back', label: t('common.back'), width: btnW, height: Math.round(48 * k), onPress: () => this.close() });
    this.startBtn = new UiButton(this, cx + btnW / 2 + 10, btnY, { id: 'launch.start', label: t('launch.start'), width: btnW, height: Math.round(48 * k), fontSize: 22, onPress: () => this.start() });

    this.refresh();
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.close());
    kb?.on('keydown-ENTER', () => this.start());
    kb?.on('keydown-SPACE', () => this.start());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const c of this.cleanups) c();
      this.cleanups.length = 0;
    });
  }

  private characterCard(def: CharacterDef, x: number, y: number, w: number, h: number, k: number): void {
    const save = app().save;
    const unlocked = isCharacterUnlocked(save, def.id);
    const weapon = def.startingWeapon;
    const weaponName = t(`weapon.${weapon}.name` as Parameters<typeof t>[0]);
    const sub = unlocked ? weaponName : `${t('launch.locked_character')} · ${def.cost ?? 0}`;
    this.card(`launch.char.${def.id}`, x, y, w, h, k, def.frame, t(def.nameKey), sub, unlocked, () => {
      this.characterId = def.id;
      this.refresh();
    });
  }

  private stageCard(def: StageDef, x: number, y: number, w: number, h: number, k: number): void {
    const save = app().save;
    const unlocked = isStageUnlocked(save, def.id);
    const best = save.stageBest[def.id];
    const cleared = save.unlocks.stages.includes(def.id);
    let sub = t(def.descKey);
    if (!unlocked) sub = t('launch.locked_stage');
    else if (cleared) sub = `${t('launch.cleared')} · ${t(def.descKey)}`;
    else if (best) sub = `${t('launch.best', { t: formatTime(best) })} · ${t(def.descKey)}`;
    this.card(`launch.stage.${def.id}`, x, y, w, h, k, def.decorFrames[0], t(def.nameKey), sub, unlocked, () => {
      this.stageId = def.id;
      this.refresh();
    });
  }

  private card(id: string, x: number, y: number, w: number, h: number, k: number, icon: string, title: string, sub: string, enabled: boolean, onPick: () => void): void {
    const cx = x + w / 2;
    const bg = this.add.nineslice(cx, y, 'ui', 'panel_rect', w, h, 16, 16, 16, 16).setTint(enabled ? CARD_TINT : CARD_TINT_LOCKED);
    this.cardBgs.set(id, bg);
    const iconSize = Math.round(36 * k);
    const img = this.add.image(x + Math.round(28 * k), y, 'game', icon).setDisplaySize(iconSize, iconSize);
    if (!enabled) img.setAlpha(0.45);
    const textX = x + Math.round(56 * k);
    this.add.text(textX, y - Math.round(11 * k), title, textStyle(Math.round(17 * k), { bold: true, color: enabled ? COLORS.text : COLORS.dim })).setOrigin(0, 0.5);
    this.add
      .text(textX, y + Math.round(11 * k), sub, textStyle(Math.round(12 * k), { color: COLORS.dim, wrapWidth: w - Math.round(70 * k) }))
      .setOrigin(0, 0.5);

    // the hit rectangle is authored from the top-left: Phaser normalises a container's hit test by
    // its displayOrigin, and a centred rectangle here would sit half a card up and to the left
    const hitW = Math.max(w, minTouchUnits(this));
    const hitH = Math.max(h, minTouchUnits(this));
    const zone = this.add.zone(cx, y, hitW, hitH).setOrigin(0.5);
    zone.setInteractive(new Phaser.Geom.Rectangle(0, 0, hitW, hitH), Phaser.Geom.Rectangle.Contains);
    let armed = -1;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      armed = p.id;
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (armed !== p.id) return;
      armed = -1;
      if (!enabled) {
        sfx.play('click');
        return;
      }
      sfx.play('click');
      onPick();
    });
    this.cleanups.push(
      registerButton({
        id,
        getPos: () => ({ x: cx, y }),
        getHitSize: () => ({ w: hitW, h: hitH }),
        isEnabled: () => enabled,
        press: () => {
          if (enabled) onPick();
        },
      }),
    );
  }

  /** Repaints the selection; the cards themselves are static. */
  private refresh(): void {
    for (const [id, bg] of this.cardBgs) {
      const selected = id === `launch.char.${this.characterId}` || id === `launch.stage.${this.stageId}`;
      const locked = id.startsWith('launch.char.') ? !isCharacterUnlocked(app().save, id.slice('launch.char.'.length)) : !isStageUnlocked(app().save, id.slice('launch.stage.'.length));
      bg.setTint(selected ? CARD_TINT_SELECTED : locked ? CARD_TINT_LOCKED : CARD_TINT);
    }
  }

  private start(): void {
    const ctx = app();
    if (!isCharacterUnlocked(ctx.save, this.characterId) || !isStageUnlocked(ctx.save, this.stageId)) return;
    ctx.save = { ...ctx.save, lastCharacterId: this.characterId, lastStageId: this.stageId };
    writeSave(ctx.storage, ctx.save);
    // this press is the user gesture browsers require before audio may start; audio must never be
    // able to stop a run from starting
    try {
      music.start(() => audioContextOf(this.sound));
      music.setIntensity(0.15);
    } catch (error) {
      console.warn('music failed to start', error);
    }
    const seed = ctx.seed ?? (Date.now() >>> 0);
    const selection = { seed, characterId: this.characterId, stageId: this.stageId };
    // the menu owns the transition: starting Game from here would leave the menu underneath it
    this.scene.stop();
    this.scene.get('Menu').scene.start('Game', selection);
  }

  private close(): void {
    this.scene.stop();
  }
}
