import Phaser from 'phaser';
import { viewOf } from '../layout';
import { STAGES } from '../../data/stages';
import { t } from '../../i18n';
import { textStyle } from '../ui/textStyles';
import { SFX_KEYS, sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { app } from '../app';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    const barW = 420;
    const barH = 18;
    const x = (viewOf(this).width - barW) / 2;
    const y = viewOf(this).height / 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a2230, 1).fillRect(x, y, barW, barH);
    const fill = this.add.graphics();
    this.add.text(viewOf(this).width / 2, y - 30, t('common.loading'), textStyle(20)).setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      fill.clear().fillStyle(0x4fe0ff, 1).fillRect(x + 2, y + 2, (barW - 4) * p, barH - 4);
    });

    this.load.setPath('assets/');
    this.load.atlas('game', 'atlas/game.png', 'atlas/game.json');
    this.load.atlas('ui', 'atlas/ui.png', 'atlas/ui.json');
    for (const stage of Object.values(STAGES)) this.load.image(stage.floorTexture, `tiles/${stage.floorTexture}.png`);
    for (const key of SFX_KEYS) this.load.audio(key, `audio/${key}.ogg`);
  }

  create(): void {
    const ctx = app();
    sfx.init(this.sound, { muted: ctx.testMode, volume: ctx.save.settings.sfxVolume });
    music.setVolume(ctx.save.settings.musicVolume);
    music.setEnabled(!ctx.testMode && ctx.save.settings.musicVolume > 0);
    this.scene.start('Menu');
  }
}
