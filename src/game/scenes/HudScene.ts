import Phaser from 'phaser';
import { RUN_SECONDS } from '../../config';
import { formatTime, onLocaleChanged, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { DIGIT_FONT_KEY } from '../fonts/retroDigits';
import { IconRow } from '../ui/iconRow';
import { UiButton } from '../ui/button';
import { app } from '../app';
import type { GameScene } from './GameScene';

/** Screen-space HUD. Runs in parallel with GameScene and only redraws when a value changes. */
export class HudScene extends Phaser.Scene {
  private timer!: Phaser.GameObjects.BitmapText;
  private levelText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossName!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastMs = 0;
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

  create(): void {
    // reset per-run caches: the scene instance is reused between runs
    this.last = { time: -1, level: -1, kills: -1, xp: -1, build: '' };
    this.lastSignature = '';

    this.xpBarBg = this.add.rectangle(this.scale.width / 2, 10, this.scale.width, 20, 0x0d1420).setOrigin(0.5);
    this.xpBarFill = this.add.rectangle(0, 10, 0, 20, 0x4fe0ff).setOrigin(0, 0.5);
    this.levelText = this.add.text(this.scale.width - 12, 10, '', textStyle(14, { bold: true })).setOrigin(1, 0.5);
    this.timer = this.add.bitmapText(this.scale.width / 2, 30, DIGIT_FONT_KEY, '00:00', 32).setOrigin(0.5, 0);
    this.killsText = this.add.text(this.scale.width - 12, 76, '', textStyle(16, { color: COLORS.dim, align: 'right' })).setOrigin(1, 0);
    this.signatureText = this.add.text(this.scale.width - 12, 98, '', textStyle(14, { color: COLORS.accent, align: 'right' })).setOrigin(1, 0);
    this.bossBarW = Math.min(400, this.scale.width - 80);
    this.bossBarBg = this.add.rectangle(this.scale.width / 2, this.scale.height - 40, this.bossBarW, 12, 0x2a0f14).setOrigin(0.5).setVisible(false);
    this.bossBarFill = this.add
      .rectangle(this.scale.width / 2 - this.bossBarW / 2, this.scale.height - 40, this.bossBarW, 12, 0xff5555)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.bossName = this.add.text(this.scale.width / 2, this.scale.height - 58, '', textStyle(16, { bold: true, color: COLORS.warn })).setOrigin(0.5).setVisible(false);
    this.toast = this.add.text(this.scale.width / 2, 120, '', textStyle(22, { bold: true, color: COLORS.gold, stroke: true })).setOrigin(0.5).setVisible(false);

    // touch players have no Escape key, so they get a button once touch is detected
    const touch = app().touch;
    this.pauseButton = new UiButton(this, this.scale.width - 60, 130, {
      id: 'hud.pause',
      label: '',
      icon: 'icon_pause',
      width: 72,
      height: 56,
      fontSize: 22,
      onPress: () => (this.scene.get('Game') as GameScene | undefined)?.openPause(),
    });
    this.pauseButton.setVisible(touch.active);
    this.offTouch = touch.onChange((on) => this.pauseButton?.setVisible(on));

    this.weaponRow = new IconRow(this, 34, 52, 6, 32);
    this.passiveRow = new IconRow(this, 34, 92, 6, 32);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.offLocale = onLocaleChanged(() => {
      this.last.level = -1;
      this.last.kills = -1;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
    this.scene.restart();
  }

  /** Shows a short message; the game scene calls this from simulation events. */
  showToast(text: string, ms = 2200): void {
    this.toast.setText(text);
    this.toast.setVisible(true);
    this.toast.setAlpha(1);
    this.toastMs = ms;
  }

  override update(_time: number, delta: number): void {
    const game = this.scene.get('Game') as GameScene | undefined;
    if (!game?.sim) return;
    const run = game.sim.run;

    if (this.toastMs > 0) {
      this.toastMs -= delta;
      if (this.toastMs <= 0) this.toast.setVisible(false);
      else this.toast.setAlpha(Math.min(1, this.toastMs / 600));
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
      this.xpBarFill.setSize(this.scale.width * ratio, 20);
    }
  }
}
