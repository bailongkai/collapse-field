import Phaser from 'phaser';
import { VERSION } from '../../config';
import { formatTime, onLocaleChanged, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { restartOnResize } from '../ui/responsive';
import { isPortraitScene } from '../layout';
import { app } from '../app';
import { music } from '../audio/music';
import { audioContextOf } from '../audio/context';

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
    const cy = this.scale.height / 2;
    const narrow = isPortraitScene(this) || this.scale.width < 700;
    this.cameras.main.setBackgroundColor('#05070c');
    const floor = this.add.tileSprite(cx, cy, this.scale.width, this.scale.height, 'floor').setTint(0x3a4452).setAlpha(0.6);
    this.tweens.add({ targets: floor, tilePositionX: 256, tilePositionY: 256, duration: 30000, repeat: -1 });

    // laid out around the centre so the same design works on a wide monitor and a phone held upright
    const titleSize = Math.round(Math.min(64, this.scale.width * 0.09));
    this.title = this.add.text(cx, cy - 170, '', textStyle(titleSize, { bold: true, color: COLORS.accent, stroke: true })).setOrigin(0.5);
    this.subtitle = this.add.text(cx, cy - 110, '', textStyle(18, { color: COLORS.dim, align: 'center', wrapWidth: this.scale.width - 48 })).setOrigin(0.5);

    const startW = Math.min(300, this.scale.width - 80);
    this.startBtn = new UiButton(this, cx, cy, { id: 'menu.start', label: '', width: startW, height: 64, fontSize: 26, onPress: () => this.startGame() });

    // side by side when there is room, stacked when there is not
    const rowW = narrow ? Math.min(260, this.scale.width - 80) : 220;
    if (narrow) {
      this.shopBtn = new UiButton(this, cx, cy + 84, { id: 'menu.shop', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openShop() });
      this.settingsBtn = new UiButton(this, cx, cy + 148, { id: 'menu.settings', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openSettings() });
    } else {
      this.shopBtn = new UiButton(this, cx - 120, cy + 84, { id: 'menu.shop', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openShop() });
      this.settingsBtn = new UiButton(this, cx + 120, cy + 84, { id: 'menu.settings', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openSettings() });
    }

    this.gold = this.add.text(this.scale.width - 16, 16, '', textStyle(18, { bold: true, color: COLORS.gold })).setOrigin(1, 0);
    const footer = narrow ? cy + 220 : cy + 180;
    this.hint = this.add
      .text(cx, footer, '', textStyle(15, { color: COLORS.dim, align: 'center', wrapWidth: this.scale.width - 48 }))
      .setOrigin(0.5);
    this.best = this.add.text(cx, footer + 46, '', textStyle(15, { color: COLORS.gold })).setOrigin(0.5);
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
    // the shop and settings are overlays on top of this scene, which still has the keyboard: Enter
    // would otherwise start a run underneath an open panel
    if (this.scene.isActive('Shop') || this.scene.isActive('Settings')) return;
    // this press is the user gesture browsers require before audio may start
    // audio must never be able to stop a run from starting
    try {
      music.start(() => audioContextOf(this.sound));
      music.setIntensity(0.15);
    } catch (error) {
      console.warn('music failed to start', error);
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
