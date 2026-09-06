import Phaser from 'phaser';
import { getLocale, setLocale, t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { sfx } from '../audio/sfx';
import { writeSave } from '../../core/save/saveData';
import { app } from '../app';

/** Language and volume, persisted into the save as soon as they change. */
export class SettingsScene extends Phaser.Scene {
  private volumeText!: Phaser.GameObjects.Text;
  private zhButton!: UiButton;
  private enButton!: UiButton;

  constructor() {
    super('Settings');
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.7);
    this.add.nineslice(cx, cy, 'ui', 'panel_glass', 560, 380, 24, 24, 24, 24).setAlpha(0.97).setTint(0x16243a);
    this.add.text(cx, cy - 140, t('settings.title'), textStyle(30, { bold: true, color: COLORS.accent })).setOrigin(0.5);

    this.add.text(cx - 220, cy - 60, t('settings.language'), textStyle(18, { color: COLORS.dim })).setOrigin(0, 0.5);
    this.zhButton = new UiButton(this, cx + 20, cy - 60, { id: 'settings.lang.zh', label: t('settings.lang.zh'), width: 130, height: 44, fontSize: 18, onPress: () => this.setLang('zh-CN') });
    this.enButton = new UiButton(this, cx + 170, cy - 60, { id: 'settings.lang.en', label: t('settings.lang.en'), width: 130, height: 44, fontSize: 18, onPress: () => this.setLang('en') });

    this.add.text(cx - 220, cy + 20, t('settings.volume'), textStyle(18, { color: COLORS.dim })).setOrigin(0, 0.5);
    new UiButton(this, cx + 20, cy + 20, { id: 'settings.volume.down', label: '−', width: 60, height: 44, fontSize: 22, onPress: () => this.nudgeVolume(-0.1) });
    this.volumeText = this.add.text(cx + 100, cy + 20, '', textStyle(20, { bold: true })).setOrigin(0.5);
    new UiButton(this, cx + 180, cy + 20, { id: 'settings.volume.up', label: '+', width: 60, height: 44, fontSize: 22, onPress: () => this.nudgeVolume(0.1) });

    new UiButton(this, cx, cy + 120, { id: 'settings.back', label: t('common.back'), width: 200, onPress: () => this.close() });
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

  private refresh(): void {
    const ctx = app();
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
