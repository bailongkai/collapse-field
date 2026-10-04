import Phaser from 'phaser';
import { viewOf } from '../layout';
import { RUN_SECONDS } from '../../config';
import { formatTime, onLocaleChanged, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { DIGIT_FONT_KEY } from '../fonts/retroDigits';
import { IconRow } from '../ui/iconRow';
import { UiButton } from '../ui/button';
import { app } from '../app';
import { safeInsets } from '../safeArea';
import type { GameScene } from './GameScene';

/** The toast slots, handed from the HUD a resize tears down to the one it builds. */
interface ToastCarry {
  slots: { msg: string; ms: number; priority: number }[] | null;
}

/** Screen-space HUD. Runs in parallel with GameScene and only redraws when a value changes. */
export class HudScene extends Phaser.Scene {
  private timer!: Phaser.GameObjects.BitmapText;
  private objective!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossName!: Phaser.GameObjects.Text;
  /**
   * Two toast slots rather than one. A single slot showed whatever came last, and what came last
   * during a collapse warning was the fullscreen hint: the one line that said the floor was going
   * was overwritten by the one that said how to pause. A slot now keeps its message until a toast of
   * at least its own priority wants the room, so a boss or a collapse is never pushed off by a hint.
   */
  private toastSlots: { text: Phaser.GameObjects.Text; msg: string; ms: number; priority: number }[] = [];
  /**
   * What the slots held when a resize restarted the scene. A resize rebuilds the HUD, and the
   * rebuild used to start with both slots empty: the fullscreen hint, sent by the same resize, and
   * any collapse or boss warning on the screen were gone before anyone read them.
   */
  private carry: ToastCarry | null = null;
  private bossBarW = 400;
  private weaponRow!: IconRow;
  private signatureText!: Phaser.GameObjects.Text;
  private lastSignature = '';
  private passiveRow!: IconRow;
  private last = { time: -1, level: -1, kills: -1, xp: -1, build: '' };
  private pauseButton: UiButton | null = null;
  private offLocale: (() => void) | null = null;
  private offTouch: (() => void) | null = null;

  constructor() {
    super('Hud');
  }

  create(data?: ToastCarry): void {
    // reset per-run caches: the scene instance is reused between runs
    this.last = { time: -1, level: -1, kills: -1, xp: -1, build: '' };
    this.lastSignature = '';

    // a phone's notch and rounded corners: everything at an edge moves in by the inset
    const inset = safeInsets(this);
    const top = inset.top;
    const right = viewOf(this).width - inset.right;
    const left = inset.left;
    this.xpBarBg = this.add.rectangle(viewOf(this).width / 2, top + 10, viewOf(this).width, 20, 0x0d1420).setOrigin(0.5);
    this.xpBarFill = this.add.rectangle(0, top + 10, 0, 20, 0x4fe0ff).setOrigin(0, 0.5);
    this.levelText = this.add.text(right - 12, top + 10, '', textStyle(14, { bold: true, stroke: true })).setOrigin(1, 0.5);
    this.timer = this.add.bitmapText(viewOf(this).width / 2, top + 30, DIGIT_FONT_KEY, '00:00', 32).setOrigin(0.5, 0);
    // Once the final boss is on the field the clock has nothing left to say: it stopped at 15:00
    // and the run did not. What replaces it is the thing the player is now there to do.
    this.objective = this.add
      .text(viewOf(this).width / 2, top + 34, t('hud.objective_final'), textStyle(22, { bold: true, color: COLORS.warn, stroke: true }))
      .setOrigin(0.5, 0)
      .setVisible(false);
    // The right column, top down: the pause button for touch players, then the kill count, then the
    // signature line. The button used to sit at top+130 over a signature line at top+98, so on every
    // phone the ability's name was printed under the one button a finger has to find. Both texts are
    // outlined: the field scrolls behind the HUD, and a thin grey number over a crowd is not there.
    const pauseH = 56;
    const pauseY = top + 34 + pauseH / 2;
    this.killsText = this.add.text(right - 12, pauseY + pauseH / 2 + 8, '', textStyle(16, { color: COLORS.text, align: 'right', stroke: true })).setOrigin(1, 0);
    this.signatureText = this.add.text(right - 12, pauseY + pauseH / 2 + 30, '', textStyle(14, { color: COLORS.accent, align: 'right', stroke: true })).setOrigin(1, 0);
    this.bossBarW = Math.min(400, viewOf(this).width - 80);
    const bottom = viewOf(this).height - inset.bottom;
    this.bossBarBg = this.add.rectangle(viewOf(this).width / 2, bottom - 40, this.bossBarW, 12, 0x2a0f14).setOrigin(0.5).setVisible(false);
    this.bossBarFill = this.add
      .rectangle(viewOf(this).width / 2 - this.bossBarW / 2, bottom - 40, this.bossBarW, 12, 0xff5555)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.bossName = this.add.text(viewOf(this).width / 2, bottom - 58, '', textStyle(16, { bold: true, color: COLORS.warn })).setOrigin(0.5).setVisible(false);
    this.toastSlots = [0, 1].map((i) => ({
      text: this.add.text(viewOf(this).width / 2, top + 124 + i * 32, '', textStyle(22, { bold: true, color: COLORS.gold, stroke: true })).setOrigin(0.5).setVisible(false),
      msg: '',
      ms: 0,
      priority: -1,
    }));
    // only a restart from onResize passes this; a new run's launch passes nothing
    this.carry = null;
    data?.slots?.forEach((c, i) => {
      if (c.ms <= 0) return;
      const slot = this.toastSlots[i];
      slot.text.setText(c.msg).setVisible(true).setAlpha(Math.min(1, c.ms / 600));
      Object.assign(slot, c);
    });

    // touch players have no Escape key, so they get a button once touch is detected
    const touch = app().touch;
    this.pauseButton = new UiButton(this, right - 48, pauseY, {
      id: 'hud.pause',
      label: '',
      icon: 'icon_pause',
      width: 72,
      height: pauseH,
      fontSize: 22,
      onPress: () => (this.scene.get('Game') as GameScene | undefined)?.openPause(),
    });
    this.pauseButton.setVisible(touch.active);
    this.offTouch = touch.onChange((on) => this.pauseButton?.setVisible(on));

    this.weaponRow = new IconRow(this, left + 34, top + 52, 6, 32);
    this.passiveRow = new IconRow(this, left + 34, top + 92, 6, 32);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.offLocale = onLocaleChanged(() => {
      this.last.level = -1;
      this.last.kills = -1;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // read on the way out rather than when the resize arrived: whatever the same resize sent
      // (the fullscreen hint) lands in the old slots between the two
      if (this.carry) this.carry.slots = this.toastSlots.map(({ msg, ms, priority }) => ({ msg, ms, priority }));
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.offLocale?.();
      this.offLocale = null;
      this.offTouch?.();
      this.offTouch = null;
      this.pauseButton = null;
    });
  }

  /** The logical width changes with the display's aspect, so the HUD is rebuilt rather than stretched. */
  private onResize(): void {
    if (this.carry) return;
    this.carry = { slots: null };
    this.scene.restart(this.carry);
  }

  /**
   * Shows a short message; the game scene calls this from simulation events. `priority` decides
   * who gives way: a free slot is taken first, then the slot holding the lowest priority no higher
   * than this one, and a message that outranks both slots is dropped rather than shown over them.
   */
  showToast(text: string, ms = 2200, priority = 0): void {
    let slot = this.toastSlots.find((s) => s.ms <= 0);
    if (!slot) {
      let lowest = this.toastSlots[0];
      for (const s of this.toastSlots) if (s.priority < lowest.priority) lowest = s;
      if (lowest.priority > priority) return;
      slot = lowest;
    }
    slot.text.setText(text).setVisible(true).setAlpha(1);
    slot.msg = text;
    slot.ms = ms;
    slot.priority = priority;
  }

  /** What the toasts currently say, top slot first; for the tests. */
  toasts(): string[] {
    return this.toastSlots.filter((s) => s.ms > 0 && s.text.visible).map((s) => s.text.text);
  }

  override update(_time: number, delta: number): void {
    const game = this.scene.get('Game') as GameScene | undefined;
    if (!game?.sim) return;
    const run = game.sim.run;

    for (const slot of this.toastSlots) {
      if (slot.ms <= 0) continue;
      slot.ms -= delta;
      if (slot.ms <= 0) {
        slot.text.setVisible(false);
        slot.priority = -1;
      } else slot.text.setAlpha(Math.min(1, slot.ms / 600));
    }

    const boss = game.sim.bossStatus();
    if (boss) {
      this.bossBarBg.setVisible(true);
      this.bossBarFill.setVisible(true);
      this.bossName.setVisible(true).setText(t(boss.name as Parameters<typeof t>[0]));
      this.bossBarFill.setSize(this.bossBarW * Math.max(0, Math.min(1, boss.hp / boss.maxHp)), 12);
    } else if (this.bossBarBg.visible) {
      this.bossBarBg.setVisible(false);
      this.bossBarFill.setVisible(false);
      this.bossName.setVisible(false);
    }

    const finale = run.finalSpawned && run.phase !== 'ended';
    if (finale !== this.objective.visible) {
      this.objective.setVisible(finale);
      this.timer.setVisible(!finale);
    }
    const sec = Math.min(RUN_SECONDS, Math.floor(run.timeMs / 1000));
    if (sec !== this.last.time) {
      this.last.time = sec;
      this.timer.setText(formatTime(sec));
    }
    if (run.level !== this.last.level) {
      this.last.level = run.level;
      this.levelText.setText(t('hud.level', { n: run.level }));
    }
    if (run.kills !== this.last.kills) {
      this.last.kills = run.kills;
      this.killsText.setText(`${t('hud.kills')} ${run.kills}`);
    }
    // the signature ability: its name, and whether it is ready, running, or how long until it is
    const sig = game.sim.signature;
    const sigDef = game.sim.character.signature;
    const sigState = sig.activeMs > 0 ? t('hud.signature_active') : sig.cooldownMs > 0 ? t('hud.signature_cooldown', { s: Math.ceil(sig.cooldownMs / 1000) }) : t('hud.signature_ready');
    const sigLine = `${t(sigDef.nameKey)} · ${sigState}`;
    if (sigLine !== this.lastSignature) {
      this.lastSignature = sigLine;
      this.signatureText.setText(sigLine).setColor(sig.activeMs > 0 ? '#ffd166' : sig.cooldownMs > 0 ? '#8a94a6' : '#4fe0ff');
    }

    const build = run.weapons.map((w) => `${w.id}${w.level}`).join(',') + '|' + run.passives.map((p) => `${p.id}${p.level}`).join(',');
    if (build !== this.last.build) {
      this.last.build = build;
      this.weaponRow.setItems(run.weapons, 'weapon');
      this.passiveRow.setItems(run.passives, 'passive');
    }

    const ratio = run.xpNext > 0 ? Math.min(1, run.xp / run.xpNext) : 0;
    if (ratio !== this.last.xp) {
      this.last.xp = ratio;
      this.xpBarFill.setSize(viewOf(this).width * ratio, 20);
    }
  }
}
