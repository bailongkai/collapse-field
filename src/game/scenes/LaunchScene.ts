import Phaser from 'phaser';
import { formatTime, t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { registerButton } from '../ui/buttonRegistry';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { viewOf, fitPanel, isPortraitScene, minTouchUnits } from '../layout';
import { app } from '../app';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { audioContextOf } from '../audio/context';
import { CHARACTER_LIST } from '../../data/characters';
import { STAGE_ORDER } from '../../data/stages';
import { isCharacterUnlocked, isProtocolUnlocked, isStageUnlocked } from '../../core/save/unlocks';
import { writeSave } from '../../core/save/saveData';
import { shortScore } from '../../core/save/score';
import type { CharacterDef, StageDef } from '../../data/types';
import { PROTOCOLS, PROTOCOL_LIST, isProtocolId, type ProtocolId } from '../../data/protocols';
import { ACHIEVEMENTS, type AchievementDef } from '../../data/achievements';

const PANEL_TINT = 0x16243a;
const CARD_TINT = 0x2a3a52;
const CARD_TINT_SELECTED = 0x4a90c4;
const CARD_TINT_LOCKED = 0x1c2430;
const CARD_TINT_SHOWN = 0x33465e;
const DETAIL_TINT = 0x1a2740;

const COLS = 4;
const TILE_H = 92;
const GAP = 8;
const LABEL_H = 28;
const HEADER_H = 66;

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
  private curse = 0;
  private curseBtns: UiButton[] = [];
  private cardBgs = new Map<string, Phaser.GameObjects.NineSlice>();
  private startBtn!: UiButton;
  private cleanups: (() => void)[] = [];
  /** what the detail blocks describe: the selection, or a locked tile the player tapped to read */
  private shownCharacter = 'survivor';
  private shownStage = 'station';
  private charDetail: Phaser.GameObjects.Text[] = [];
  private stageDetail: Phaser.GameObjects.Text[] = [];
  private curseNote!: Phaser.GameObjects.Text;
  /** the protocol taken into the run, and the one the note describes (a locked one can be read) */
  private protocol: ProtocolId | '' = '';
  private shownProtocol: ProtocolId | '' = '';
  private protocolBtns: UiButton[] = [];
  private protocolNote!: Phaser.GameObjects.Text;
  private k = 1;

  constructor() {
    super('Launch');
  }

  create(): void {
    restartOnResize(this);
    // the scene instance is reused: every per-open field is reset here
    this.cardBgs = new Map();
    this.cleanups = [];
    const save = app().save;
    this.curse = save.lastCurse;
    this.curseBtns = [];
    this.protocolBtns = [];
    this.protocol = isProtocolId(save.lastProtocol) && isProtocolUnlocked(save, save.lastProtocol) ? save.lastProtocol : '';
    this.shownProtocol = this.protocol;
    this.characterId = isCharacterUnlocked(save, save.lastCharacterId) ? save.lastCharacterId : 'survivor';
    this.stageId = isStageUnlocked(save, save.lastStageId) ? save.lastStageId : 'station';
    this.shownCharacter = this.characterId;
    this.shownStage = this.stageId;

    const view = viewOf(this);
    const cx = view.width / 2;
    const cy = view.height / 2;
    const portrait = isPortraitScene(this) || view.width < 760;
    const chars = CHARACTER_LIST;
    const stages = STAGE_ORDER;

    // Two halves side by side on a wide screen, stacked on a phone held upright. Each half is a
    // grid of tiles over a detail block: the tiles say what there is, the block says what the one
    // in hand does. Sixteen rows of small print said both at once and neither clearly.
    const halves = portrait ? 1 : 2;
    const rowsOf = (n: number): number => Math.ceil(n / COLS);
    const gridH = (n: number): number => rowsOf(n) * (TILE_H + GAP) - GAP;
    const halfH = (n: number, detail: number): number => LABEL_H + gridH(n) + 12 + detail;
    const charDetailH = portrait ? 104 : 96;
    // three lines in an upright phone's column: the description, the goal and the best score wrap
    // there, and at 72 the goal line was cut off by the bottom of the block
    const stageDetailH = portrait ? 100 : 96;
    // upright, the protocol label has a line to itself and the five buttons the full width: beside
    // the label they were 53 units wide on an iPhone SE, and "Collapse+" does not fit in 53
    const protocolH = portrait ? 118 : 46;
    const footerH = (portrait ? 96 : 60) + 64 + protocolH;
    const body = portrait ? halfH(chars.length, charDetailH) + 14 + halfH(stages.length, stageDetailH) : Math.max(halfH(chars.length, charDetailH), halfH(stages.length, stageDetailH));
    const wantH = HEADER_H + body + 14 + footerH;
    const panel = fitPanel(this, portrait ? 520 : 940, wantH);
    const k = Math.min(1, panel.h / wantH);
    this.k = k;
    const colW = (panel.w - 24 * (halves + 1)) / halves;
    const top = cy - panel.h / 2;
    const bottom = cy + panel.h / 2;

    this.add.rectangle(cx, cy, view.width, view.height, 0x05070c, 0.85);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: PANEL_TINT, rule: true });
    this.add.text(cx, top + 36 * k, t('launch.title'), textStyle(Math.round(28 * k), { bold: true, color: COLORS.accent })).setOrigin(0.5);

    const leftX = cx - panel.w / 2 + 24;
    const charX = leftX;
    const stageX = portrait ? leftX : leftX + colW + 24;
    const charTop = top + HEADER_H * k;
    const stageTop = portrait ? charTop + (halfH(chars.length, charDetailH) + 14) * k : charTop;

    const half = (label: string, key: string, x: number, y: number, n: number, detailH: number, tile: (i: number, tx: number, ty: number, tw: number, th: number) => void): Phaser.GameObjects.Text[] => {
      this.add.text(x, y + 10 * k, label, textStyle(Math.round(16 * k), { bold: true, color: COLORS.dim })).setOrigin(0, 0.5);
      const tw = (colW - GAP * (COLS - 1)) / COLS;
      const th = TILE_H * k;
      for (let i = 0; i < n; i++) {
        const tx = x + (i % COLS) * (tw + GAP) + tw / 2;
        const ty = y + LABEL_H * k + Math.floor(i / COLS) * (th + GAP * k) + th / 2;
        tile(i, tx, ty, tw, th);
      }
      const dy = y + (LABEL_H + gridH(n) + 12) * k;
      this.add.nineslice(x + colW / 2, dy + (detailH * k) / 2, 'ui', 'panel_rect', colW, detailH * k, 16, 16, 16, 16).setTint(DETAIL_TINT).setName(`launch.${key}.box`);
      const pad = Math.round(14 * k);
      const name = this.add.text(x + pad, dy + pad + 4 * k, '', textStyle(Math.round(17 * k), { bold: true })).setOrigin(0, 0.5);
      const status = this.add.text(x + colW - pad, dy + pad + 4 * k, '', textStyle(Math.round(13 * k), { bold: true, color: COLORS.gold })).setOrigin(1, 0.5);
      const text = this.add.text(x + pad, dy + pad + 20 * k, '', textStyle(Math.round(13 * k), { color: COLORS.dim, wrapWidth: colW - pad * 2 })).setOrigin(0, 0).setLineSpacing(2).setName(`launch.${key}.text`);
      return [name, status, text];
    };

    this.charDetail = half(t('launch.character'), 'charDetail', charX, charTop, chars.length, charDetailH, (i, tx, ty, tw, th) => this.characterTile(chars[i], tx, ty, tw, th));
    this.stageDetail = half(t('launch.stage'), 'stageDetail', stageX, stageTop, stages.length, stageDetailH, (i, tx, ty, tw, th) => this.stageTile(stages[i], tx, ty, tw, th));

    // the challenge toggle: curse for more experience and gold. It is what a player who has
    // cleared a stage comes back for, and it is the only thing here that makes a stage harder.
    // What it costs and what it pays is written out next to it: "+20%" of what, was the question.
    const curseY = bottom - (portrait ? 142 : 100) * k;
    this.add.text(leftX, curseY, t('launch.challenge'), textStyle(Math.round(15 * k), { bold: true, color: COLORS.dim })).setOrigin(0, 0.5);
    const levels: [number, string][] = [[0, t('launch.challenge_off')], [0.2, '+20%'], [0.4, '+40%'], [0.6, '+60%']];
    const cw = Math.min(88, (panel.w - 48 - 80 * k - 18) / levels.length);
    levels.forEach(([value, label], i) => {
      const bx = leftX + 80 * k + i * (cw + 6) + cw / 2;
      const btn = new UiButton(this, bx, curseY, { id: `launch.curse.${Math.round(value * 100)}`, label, width: cw, height: Math.round(34 * k), fontSize: 13, onPress: () => this.setCurse(value) });
      btn.setData('curse', value);
      this.curseBtns.push(btn);
    });
    const noteX = portrait ? leftX : leftX + 80 * k + levels.length * (cw + 6) + 14;
    const noteY = portrait ? curseY + 40 * k : curseY;
    const noteW = portrait ? panel.w - 48 : cx + panel.w / 2 - 24 - noteX;
    this.curseNote = this.add.text(noteX, noteY, '', textStyle(Math.round(13 * k), { color: COLORS.dim, wrapWidth: noteW })).setOrigin(0, 0.5);

    // protocols: one rule change a run may carry, opened by achievements. A locked one can be
    // tapped to read what opens it, the way a locked tile can; it cannot be taken.
    const protoY = curseY - protocolH * k + (portrait ? 26 * k : 0);
    this.add.text(leftX, portrait ? protoY - 26 * k : protoY, t('launch.protocol'), textStyle(Math.round(15 * k), { bold: true, color: COLORS.dim })).setOrigin(0, 0.5);
    const options: (ProtocolId | '')[] = ['', ...PROTOCOL_LIST.map((p) => p.id)];
    const protoX = portrait ? leftX : leftX + 80 * k;
    // five buttons have four gaps between them: the room was shared out as if they had three, and
    // the last one ran past the challenge row's edge
    const pw = Math.min(104, (cx + panel.w / 2 - 24 - protoX - 6 * (options.length - 1)) / options.length);
    options.forEach((id, i) => {
      const bx = protoX + i * (pw + 6) + pw / 2;
      const label = id ? t(PROTOCOLS[id].nameKey) : t('launch.protocol_off');
      const btn = new UiButton(this, bx, protoY, { id: `launch.protocol.${id || 'none'}`, label, width: pw, height: Math.round(34 * k), fontSize: 12, onPress: () => this.setProtocol(id) });
      btn.setData('protocol', id);
      if (id && !isProtocolUnlocked(save, id)) btn.setAlpha(0.5);
      this.protocolBtns.push(btn);
    });
    const pNoteX = portrait ? leftX : protoX + options.length * (pw + 6) + 14;
    const pNoteY = portrait ? protoY + 40 * k : protoY;
    const pNoteW = portrait ? panel.w - 48 : cx + panel.w / 2 - 24 - pNoteX;
    this.protocolNote = this.add.text(pNoteX, pNoteY, '', textStyle(Math.round(13 * k), { color: COLORS.dim, wrapWidth: pNoteW })).setOrigin(0, 0.5);

    const btnY = bottom - 40 * k;
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

  private characterTile(def: CharacterDef, x: number, y: number, w: number, h: number): void {
    const unlocked = isCharacterUnlocked(app().save, def.id);
    this.tile(`launch.char.${def.id}`, x, y, w, h, def.frame, t(def.nameKey), unlocked ? '' : String(def.cost ?? 0), unlocked, () => {
      this.shownCharacter = def.id;
      if (unlocked) this.characterId = def.id;
      this.refresh();
    });
  }

  private stageTile(def: StageDef, x: number, y: number, w: number, h: number): void {
    const save = app().save;
    const unlocked = isStageUnlocked(save, def.id);
    const cleared = save.unlocks.stages.includes(def.id);
    this.tile(`launch.stage.${def.id}`, x, y, w, h, def.decorFrames[0], t(def.nameKey), cleared ? t('launch.cleared') : '', unlocked, () => {
      this.shownStage = def.id;
      if (unlocked) this.stageId = def.id;
      this.refresh();
    });
    // the stage's best score, opposite the badge: the number a player comes back to beat
    const best = save.stageBestScore[def.id];
    if (best) {
      const k = this.k;
      this.add.text(x - w / 2 + 6 * k, y - h / 2 + 12 * k, shortScore(best), textStyle(Math.round(11 * k), { bold: true, color: COLORS.accent, stroke: true })).setOrigin(0, 0.5).setName(`launch.score.${def.id}`);
    }
  }

  /**
   * One tile of a grid. A locked one can still be tapped: it cannot be chosen, but what it is and
   * what it costs is the reason to come back, and that belongs in the detail block like any other.
   * The debug hook's button stays disabled for it, because pressing it starts nothing.
   */
  private tile(id: string, x: number, y: number, w: number, h: number, icon: string, title: string, badge: string, enabled: boolean, onPick: () => void): void {
    const k = this.k;
    const bg = this.add.nineslice(x, y, 'ui', 'panel_rect', w, h, 16, 16, 16, 16).setTint(enabled ? CARD_TINT : CARD_TINT_LOCKED);
    this.cardBgs.set(id, bg);
    const iconSize = Math.round(40 * k);
    const img = this.add.image(x, y - h / 2 + 8 * k + iconSize / 2, 'game', icon).setDisplaySize(iconSize, iconSize);
    if (!enabled) img.setAlpha(0.45);
    this.add
      .text(x, y + h / 2 - 22 * k, title, textStyle(Math.round(13 * k), { bold: true, color: enabled ? COLORS.text : COLORS.dim, align: 'center', wrapWidth: w - 6 }))
      .setOrigin(0.5)
      .setLineSpacing(-2);
    if (badge) {
      this.add
        .text(x + w / 2 - 6 * k, y - h / 2 + 12 * k, badge, textStyle(Math.round(11 * k), { bold: true, color: enabled ? COLORS.good : COLORS.gold, stroke: true }))
        .setOrigin(1, 0.5);
    }

    // the hit rectangle is authored from the top-left: Phaser normalises a container's hit test by
    // its displayOrigin, and a centred rectangle here would sit half a card up and to the left
    const hitW = Math.max(w, minTouchUnits(this));
    const hitH = Math.max(h, minTouchUnits(this));
    const zone = this.add.zone(x, y, hitW, hitH).setOrigin(0.5);
    zone.setInteractive(new Phaser.Geom.Rectangle(0, 0, hitW, hitH), Phaser.Geom.Rectangle.Contains);
    let armed = -1;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      armed = p.id;
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (armed !== p.id) return;
      armed = -1;
      sfx.play('click');
      onPick();
    });
    this.cleanups.push(
      registerButton({
        id,
        getPos: () => ({ x, y }),
        getHitSize: () => ({ w: hitW, h: hitH }),
        isEnabled: () => enabled,
        press: () => {
          if (enabled) onPick();
        },
      }),
    );
  }

  private setProtocol(id: ProtocolId | ''): void {
    sfx.play('click');
    this.shownProtocol = id;
    if (!id || isProtocolUnlocked(app().save, id)) this.protocol = id;
    this.refresh();
  }

  private setCurse(value: number): void {
    this.curse = value;
    sfx.play('click');
    this.refresh();
  }

  /** Repaints the selection and rewrites the detail blocks; the tiles themselves are static. */
  private refresh(): void {
    const save = app().save;
    for (const b of this.curseBtns) b.setSelected((b.getData('curse') as number) === this.curse);
    for (const [id, bg] of this.cardBgs) {
      const selected = id === `launch.char.${this.characterId}` || id === `launch.stage.${this.stageId}`;
      const shown = id === `launch.char.${this.shownCharacter}` || id === `launch.stage.${this.shownStage}`;
      const locked = id.startsWith('launch.char.') ? !isCharacterUnlocked(save, id.slice('launch.char.'.length)) : !isStageUnlocked(save, id.slice('launch.stage.'.length));
      bg.setTint(selected ? CARD_TINT_SELECTED : shown ? CARD_TINT_SHOWN : locked ? CARD_TINT_LOCKED : CARD_TINT);
    }

    const c = CHARACTER_LIST.find((d) => d.id === this.shownCharacter);
    if (c) {
      const [name, status, text] = this.charDetail;
      name.setText(t(c.nameKey));
      status.setText(isCharacterUnlocked(save, c.id) ? '' : `${t('launch.locked_character')} · ${c.cost ?? 0}`);
      text.setText(`${t(c.descKey)}\n${t('launch.signature', { name: t(c.signature.nameKey), desc: t(c.signature.descKey) })}`);
    }
    const st = STAGE_ORDER.find((d) => d.id === this.shownStage);
    if (st) {
      const [name, status, text] = this.stageDetail;
      const best = save.stageBest[st.id];
      name.setText(t(st.nameKey));
      if (!isStageUnlocked(save, st.id)) status.setText(t('launch.locked_stage'));
      else if (save.unlocks.stages.includes(st.id)) status.setText(t('launch.cleared'));
      else status.setText(best ? t('launch.best', { t: formatTime(best) }) : '');
      const bestScore = save.stageBestScore[st.id];
      text.setText(`${t(st.descKey)}\n${t('launch.goal')}${bestScore ? ` · ${t('launch.best_score', { n: bestScore })}` : ''}`);
    }
    for (const b of this.protocolBtns) b.setSelected((b.getData('protocol') as string) === this.protocol);
    const shown = this.shownProtocol;
    if (!shown) this.protocolNote.setText(t('launch.protocol_note_off'));
    else {
      const def = PROTOCOLS[shown];
      const ach = (ACHIEVEMENTS as Record<string, AchievementDef>)[def.achievement];
      const locked = isProtocolUnlocked(save, shown) ? '' : `\n${t('launch.protocol_locked', { name: ach ? t(ach.nameKey) : def.achievement, cond: ach ? t(ach.descKey) : '' })}`;
      this.protocolNote.setText(t('launch.protocol_line', { name: t(def.nameKey), desc: t(def.descKey) }) + locked);
    }
    this.curseNote.setText(this.curse > 0 ? t('launch.challenge_note', { n: Math.round(this.curse * 100) }) : t('launch.challenge_note_off'));
  }

  private start(): void {
    const ctx = app();
    if (!isCharacterUnlocked(ctx.save, this.characterId) || !isStageUnlocked(ctx.save, this.stageId)) return;
    ctx.save = { ...ctx.save, lastCharacterId: this.characterId, lastStageId: this.stageId, lastCurse: this.curse, lastProtocol: this.protocol };
    writeSave(ctx.storage, ctx.save);
    // this press is the user gesture browsers require before audio may start; audio must never be
    // able to stop a run from starting
    try {
      music.start(() => audioContextOf(this.sound));
      music.setMood('battle');
      music.setIntensity(0.15);
    } catch (error) {
      console.warn('music failed to start', error);
    }
    const seed = ctx.seed ?? (Date.now() >>> 0);
    const selection = { seed, characterId: this.characterId, stageId: this.stageId, curse: this.curse, protocol: this.protocol || null };
    // the menu owns the transition: starting Game from here would leave the menu underneath it
    this.scene.stop();
    this.scene.get('Menu').scene.start('Game', selection);
  }

  private close(): void {
    this.scene.stop();
  }
}
