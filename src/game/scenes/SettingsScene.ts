import Phaser from 'phaser';
import { getLocale, setLocale, t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { viewOf, fitPanel } from '../layout';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { writeSave } from '../../core/save/saveData';
import { app } from '../app';

/** Language and volume, persisted into the save as soon as they change. */
export class SettingsScene extends Phaser.Scene {
  private volumeText!: Phaser.GameObjects.Text;
  private musicText!: Phaser.GameObjects.Text;
  private zhButton!: UiButton;
  private enButton!: UiButton;

  constructor() {
    super('Settings');
  }

  create(): void {
    restartOnResize(this);
    const cx = viewOf(this).width / 2;
    const cy = viewOf(this).height / 2;
    this.add.rectangle(cx, cy, viewOf(this).width, viewOf(this).height, 0x05070c, 0.7);
    const panel = fitPanel(this, 560, 440);
    const col = Math.min(220, panel.w / 2 - 24);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: 0x16243a, rule: true });
    this.add.text(cx, cy - 170, t('settings.title'), textStyle(30, { bold: true, color: COLORS.accent })).setOrigin(0.5);

    this.add.text(cx - col, cy - 90, t('settings.language'), textStyle(18, { color: COLORS.dim })).setOrigin(0, 0.5);
    this.zhButton = new UiButton(this, cx + col * 0.1, cy - 90, { id: 'settings.lang.zh', label: t('settings.lang.zh'), width: 130, height: 44, fontSize: 18, onPress: () => this.setLang('zh-CN') });
    this.enButton = new UiButton(this, cx + col * 0.78, cy - 90, { id: 'settings.lang.en', label: t('settings.lang.en'), width: 130, height: 44, fontSize: 18, onPress: () => this.setLang('en') });

    this.add.text(cx - col, cy - 20, t('settings.volume'), textStyle(18, { color: COLORS.dim })).setOrigin(0, 0.5);
    new UiButton(this, cx + col * 0.1, cy - 20, { id: 'settings.volume.down', label: '−', width: 60, height: 44, fontSize: 22, onPress: () => this.nudgeVolume(-0.1) });
    this.volumeText = this.add.text(cx + col * 0.45, cy - 20, '', textStyle(20, { bold: true })).setOrigin(0.5);
    new UiButton(this, cx + col * 0.82, cy - 20, { id: 'settings.volume.up', label: '+', width: 60, height: 44, fontSize: 22, onPress: () => this.nudgeVolume(0.1) });

    this.add.text(cx - col, cy + 50, t('settings.music'), textStyle(18, { color: COLORS.dim })).setOrigin(0, 0.5);
    new UiButton(this, cx + col * 0.1, cy + 50, { id: 'settings.music.down', label: '−', width: 60, height: 44, fontSize: 22, onPress: () => this.nudgeMusic(-0.1) });
    this.musicText = this.add.text(cx + col * 0.45, cy + 50, '', textStyle(20, { bold: true })).setOrigin(0.5);
    new UiButton(this, cx + col * 0.82, cy + 50, { id: 'settings.music.up', label: '+', width: 60, height: 44, fontSize: 22, onPress: () => this.nudgeMusic(0.1) });

    new UiButton(this, cx, cy + 150, { id: 'settings.back', label: t('common.back'), width: 200, onPress: () => this.close() });
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

  private refresh(): void {
    const ctx = app();
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
