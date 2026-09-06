import Phaser from 'phaser';
import { VERSION } from '../../config';
import { formatTime, onLocaleChanged, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { restartOnResize } from '../ui/responsive';
import { app } from '../app';

export class MenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private best!: Phaser.GameObjects.Text;
  private startBtn!: UiButton;
  private settingsBtn!: UiButton;
  private shopBtn!: UiButton;
  private gold!: Phaser.GameObjects.Text;
  private offLocale: (() => void) | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    restartOnResize(this);
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor('#05070c');
    const floor = this.add.tileSprite(cx, this.scale.height / 2, this.scale.width, this.scale.height, 'floor').setTint(0x3a4452).setAlpha(0.6);
    this.tweens.add({ targets: floor, tilePositionX: 256, tilePositionY: 256, duration: 30000, repeat: -1 });

    this.title = this.add.text(cx, 190, '', textStyle(64, { bold: true, color: COLORS.accent, stroke: true })).setOrigin(0.5);
    this.subtitle = this.add.text(cx, 250, '', textStyle(20, { color: COLORS.dim })).setOrigin(0.5);
    this.startBtn = new UiButton(this, cx, 360, { id: 'menu.start', label: '', width: 300, height: 64, fontSize: 26, onPress: () => this.startGame() });
    this.shopBtn = new UiButton(this, cx - 120, 440, { id: 'menu.shop', label: '', width: 220, height: 50, fontSize: 20, onPress: () => this.openShop() });
    this.settingsBtn = new UiButton(this, cx + 120, 440, { id: 'menu.settings', label: '', width: 220, height: 50, fontSize: 20, onPress: () => this.openSettings() });
    this.gold = this.add.text(this.scale.width - 16, 16, '', textStyle(18, { bold: true, color: COLORS.gold })).setOrigin(1, 0);
    this.hint = this.add.text(cx, 540, '', textStyle(16, { color: COLORS.dim })).setOrigin(0.5);
    this.best = this.add.text(cx, 580, '', textStyle(16, { color: COLORS.gold })).setOrigin(0.5);
    this.add.text(this.scale.width - 12, this.scale.height - 10, `v${VERSION} · Phaser ${Phaser.VERSION}`, textStyle(12, { color: COLORS.dim })).setOrigin(1, 1);

    this.applyStrings();
    this.offLocale = onLocaleChanged(() => this.applyStrings());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offLocale?.();
      this.offLocale = null;
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());

    if (window.__game) window.__game.ready = true;
  }

  private applyStrings(): void {
    this.title.setText(t('menu.title'));
    this.subtitle.setText(t('menu.subtitle'));
    this.startBtn.setLabel(t('menu.start'));
    this.settingsBtn.setLabel(t('menu.settings'));
    this.shopBtn.setLabel(t('menu.shop'));
    this.gold.setText(t('menu.gold', { n: app().save.gold }));
    this.hint.setText(t('menu.hint'));
    const save = app().save;
    this.best.setText(save.bestTimeSec > 0 ? t('menu.best', { t: formatTime(save.bestTimeSec) }) : '');
  }

  private startGame(): void {
    if (!this.scene.get('Game')) {
      console.warn('Game scene not registered yet');
      return;
    }
    const seed = app().seed ?? (Date.now() >>> 0);
    this.scene.start('Game', { seed });
  }

  private openShop(): void {
    this.scene.launch('Shop');
    this.scene.bringToTop('Shop');
  }

  private openSettings(): void {
    this.scene.launch('Settings');
    this.scene.bringToTop('Settings');
  }
}
