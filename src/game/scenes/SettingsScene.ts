import Phaser from 'phaser';
import { getLocale, setLocale, t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { viewOf, fitPanel, setShakeEnabled } from '../layout';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { writeSave } from '../../core/save/saveData';
import { app } from '../app';

/** Language, volume and the two comfort switches, persisted into the save as soon as they change. */
export class SettingsScene extends Phaser.Scene {
  private volumeText!: Phaser.GameObjects.Text;
  private musicText!: Phaser.GameObjects.Text;
  private zhButton!: UiButton;
  private enButton!: UiButton;
  private shakeButton!: UiButton;
  private numbersButton!: UiButton;

  constructor() {
    super('Settings');
  }

  create(): void {
    restartOnResize(this);
    const cx = viewOf(this).width / 2;
    const cy = viewOf(this).height / 2;
    this.add.rectangle(cx, cy, viewOf(this).width, viewOf(this).height, 0x05070c, 0.7);
    const panel = fitPanel(this, 560, 560);
    const col = Math.min(220, panel.w / 2 - 24);
    // five rows between the title and the button, spaced by what the panel has: a landscape phone
    // is 340 units tall and the rows used to be placed for a panel of 440 whatever it was given
    const k = Math.min(1, panel.h / 560);
    const top = cy - panel.h / 2;
    const rowY = (i: number): number => top + (118 + i * 66) * k;
    const bh = Math.round(44 * k);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: 0x16243a, rule: true });
    this.add.text(cx, top + 50 * k, t('settings.title'), textStyle(Math.round(30 * k), { bold: true, color: COLORS.accent })).setOrigin(0.5);
    const label = (i: number, key: Parameters<typeof t>[0]): void => {
      this.add.text(cx - col, rowY(i), t(key), textStyle(Math.round(18 * k), { color: COLORS.dim })).setOrigin(0, 0.5);
    };

    label(0, 'settings.language');
    this.zhButton = new UiButton(this, cx + col * 0.1, rowY(0), { id: 'settings.lang.zh', label: t('settings.lang.zh'), width: 130, height: bh, fontSize: 18, onPress: () => this.setLang('zh-CN') });
    this.enButton = new UiButton(this, cx + col * 0.78, rowY(0), { id: 'settings.lang.en', label: t('settings.lang.en'), width: 130, height: bh, fontSize: 18, onPress: () => this.setLang('en') });

    label(1, 'settings.volume');
    new UiButton(this, cx + col * 0.1, rowY(1), { id: 'settings.volume.down', label: '−', width: 60, height: bh, fontSize: 22, onPress: () => this.nudgeVolume(-0.1) });
    this.volumeText = this.add.text(cx + col * 0.45, rowY(1), '', textStyle(20, { bold: true })).setOrigin(0.5);
    new UiButton(this, cx + col * 0.82, rowY(1), { id: 'settings.volume.up', label: '+', width: 60, height: bh, fontSize: 22, onPress: () => this.nudgeVolume(0.1) });

    label(2, 'settings.music');
    new UiButton(this, cx + col * 0.1, rowY(2), { id: 'settings.music.down', label: '−', width: 60, height: bh, fontSize: 22, onPress: () => this.nudgeMusic(-0.1) });
    this.musicText = this.add.text(cx + col * 0.45, rowY(2), '', textStyle(20, { bold: true })).setOrigin(0.5);
    new UiButton(this, cx + col * 0.82, rowY(2), { id: 'settings.music.up', label: '+', width: 60, height: bh, fontSize: 22, onPress: () => this.nudgeMusic(0.1) });

    // the two things on screen that some players cannot look at for fifteen minutes
    label(3, 'settings.shake');
    this.shakeButton = new UiButton(this, cx + col * 0.45, rowY(3), { id: 'settings.shake', label: '', width: 130, height: bh, fontSize: 18, onPress: () => this.toggle('shake') });
    label(4, 'settings.damageNumbers');
    this.numbersButton = new UiButton(this, cx + col * 0.45, rowY(4), { id: 'settings.damageNumbers', label: '', width: 130, height: bh, fontSize: 18, onPress: () => this.toggle('damageNumbers') });

    new UiButton(this, cx, top + panel.h - 50 * k, { id: 'settings.back', label: t('common.back'), width: 200, height: Math.round(56 * k), onPress: () => this.close() });
    this.input.keyboard?.on('keydown-ESC', () => this.close());

    this.refresh();
  }

  private setLang(locale: 'zh-CN' | 'en'): void {
    setLocale(locale);
    const ctx = app();
    ctx.save.settings.locale = locale;
    writeSave(ctx.storage, ctx.save);
    this.scene.restart();
  }

  private nudgeVolume(delta: number): void {
    const ctx = app();
    const next = Math.max(0, Math.min(1, Math.round((ctx.save.settings.sfxVolume + delta) * 10) / 10));
    ctx.save.settings.sfxVolume = next;
    sfx.setVolume(next);
    writeSave(ctx.storage, ctx.save);
    this.refresh();
  }

  private nudgeMusic(delta: number): void {
    const ctx = app();
    const next = Math.max(0, Math.min(1, Math.round((ctx.save.settings.musicVolume + delta) * 10) / 10));
    ctx.save.settings.musicVolume = next;
    music.setVolume(next);
    music.setEnabled(!ctx.testMode && next > 0);
    writeSave(ctx.storage, ctx.save);
    this.refresh();
  }

  private toggle(key: 'shake' | 'damageNumbers'): void {
    const ctx = app();
    ctx.save.settings[key] = !ctx.save.settings[key];
    setShakeEnabled(ctx.save.settings.shake);
    writeSave(ctx.storage, ctx.save);
    sfx.play('click');
    this.refresh();
  }

  private refresh(): void {
    const ctx = app();
    this.shakeButton.setLabel(t(ctx.save.settings.shake ? 'settings.on' : 'settings.off'));
    this.numbersButton.setLabel(t(ctx.save.settings.damageNumbers ? 'settings.on' : 'settings.off'));
    this.musicText.setText(t('settings.volume.value', { n: Math.round(ctx.save.settings.musicVolume * 100) }));
    this.volumeText.setText(t('settings.volume.value', { n: Math.round(ctx.save.settings.sfxVolume * 100) }));
    const locale = getLocale();
    this.zhButton.setHighlight(locale === 'zh-CN');
    this.enButton.setHighlight(locale === 'en');
  }

  private close(): void {
    this.scene.stop();
    const menu = this.scene.get('Menu');
    if (menu) menu.scene.restart();
  }
}
