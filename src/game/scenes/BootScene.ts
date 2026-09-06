import Phaser from 'phaser';
import { buildDigitFont, DIGIT_FONT_KEY } from '../fonts/retroDigits';
import { textStyle } from '../ui/textStyles';
import { t } from '../../i18n';

/** Loads fonts, builds runtime textures/fonts and runs the Phaser 4 API smoke, then starts Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    await this.loadFonts();
    buildDigitFont(this);
    await this.smoke();
    this.scene.start('Preload');
  }

  private async loadFonts(): Promise<void> {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    const timeout = new Promise<void>((r) => setTimeout(r, 2000));
    const loads = Promise.all([
      document.fonts.load('32px kenvector_future'),
      document.fonts.load('16px "PingFang SC"'),
    ]).then(() => undefined);
    await Promise.race([loads, timeout]);
  }

  /** Touch every Phaser 4-sensitive API once so an incompatibility fails on day one, not at M6. */
  private async smoke(): Promise<void> {
    const hook = window.__game;
    try {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 32, 32);
      g.generateTexture('smoke_tex', 32, 32);
      g.destroy();

      const img = this.add.image(40, 40, 'smoke_tex');
      img.setTint(0xff0000).setTintMode(Phaser.TintModes.FILL);
      img.setTint(0xffffff).setTintMode(Phaser.TintModes.MULTIPLY);

      const bt = this.add.bitmapText(80, 20, DIGIT_FONT_KEY, '12:34+5-6');
      if (bt.width <= 0) throw new Error('RetroFont produced zero-width text');

      const ns = this.add.nineslice(200, 40, 'smoke_tex', undefined, 120, 40, 4, 4, 4, 4);
      const layer = this.add.layer();
      layer.add([img, ns]);

      const blitter = this.add.blitter(0, 0, 'smoke_tex');
      const bobs = [blitter.create(10, 10), blitter.create(50, 10), blitter.create(90, 10)];
      bobs[0].x = 12;
      if (bobs[0].x !== 12) throw new Error('Bob.x not mutable');
      if (typeof (bobs[0] as unknown as { setScale?: unknown }).setScale === 'function') {
        console.warn('[smoke] Bob has setScale in this Phaser build; gem pre-scaling could be relaxed');
      }

      const emitter = this.add.particles(0, 0, 'smoke_tex', { speed: 50, lifespan: 200, scale: { start: 0.3, end: 0 }, emitting: false });
      emitter.explode(3, 300, 40);

      const ts = this.add.tileSprite(400, 40, 128, 32, 'smoke_tex');
      ts.tilePositionX += 10;

      this.sound.pauseAll();
      this.sound.resumeAll();
      this.input.keyboard?.resetKeys();

      this.scene.pause();
      this.scene.resume();

      const dataUrl = await new Promise<string>((resolve, reject) => {
        this.game.renderer.snapshot((res) => {
          if (res instanceof HTMLImageElement) resolve(res.src);
          else reject(new Error('snapshot returned no image'));
        });
      });
      if (!dataUrl.startsWith('data:image')) throw new Error('snapshot did not yield a data URL');

      const txt = this.add.text(600, 40, t('menu.title'), textStyle(16));
      if (txt.width <= 0) throw new Error('Text produced zero width');

      hook?.pushEvent('smoke:ok');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[smoke] Phaser 4 API smoke failed:', msg);
      hook?.pushEvent(`smoke:fail:${msg}`);
    }
  }
}
