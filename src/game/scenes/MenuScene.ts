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
  private achievementsBtn!: UiButton;
  private gold!: Phaser.GameObjects.Text;
  private mark!: Phaser.GameObjects.Text;
  private titleGlow!: Phaser.GameObjects.Text;
  private ringA?: Phaser.GameObjects.Image;
  private ringB?: Phaser.GameObjects.Image;
  private hex?: Phaser.GameObjects.Graphics;
  private startGlow?: Phaser.GameObjects.Image;
  private stars: { bob: Phaser.GameObjects.Bob; rate: number; phase: number }[] | null = null;
  private offLocale: (() => void) | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    restartOnResize(this);
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const W = this.scale.width;
    const H = this.scale.height;
    const narrow = isPortraitScene(this) || W < 700;
    this.cameras.main.setBackgroundColor('#04060b');

    // --- the backdrop: deep space over the station floor, with a slow drift ---
    const floor = this.add.tileSprite(cx, cy, W, H, 'floor_station').setTint(0x1c2838).setAlpha(0.55);
    this.tweens.add({ targets: floor, tilePositionX: 256, tilePositionY: 256, duration: 40000, repeat: -1 });
    this.stars = this.buildStars(W, H);
    // a cyan haze rising from the bottom and a vignette closing the corners
    this.add.image(cx, H + 40, 'game', 'p_flare').setDisplaySize(W * 1.6, H * 0.9).setTint(0x1d6f8a).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(cx, cy, 'game', 'p_flare').setDisplaySize(W * 1.2, H * 1.2).setTint(0x000000).setAlpha(0);
    this.buildScanlines(W, H);
    this.buildFrame(W, H);

    // --- the emblem: two counter-rotating rings behind the title ---
    const titleY = narrow ? cy - 200 : cy - 170;
    const emblemR = Math.min(180, W * 0.28);
    this.ringA = this.add.image(cx, titleY, 'game', 'fx_ring').setDisplaySize(emblemR * 2, emblemR * 2).setTint(0x4fe0ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.ringB = this.add.image(cx, titleY, 'game', 'fx_ring').setDisplaySize(emblemR * 1.5, emblemR * 1.5).setTint(0x7bf1a8).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD);
    this.hex = this.add.graphics();
    this.drawHex(this.hex, emblemR * 0.82, 0x4fe0ff, 0.5);
    this.hex.setPosition(cx, titleY);
    this.add.image(cx, titleY, 'game', 'p_flare').setDisplaySize(emblemR * 2.6, emblemR * 2.6).setTint(0x2aa8c8).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD);

    // --- the title: an English mark above, the Chinese name in the heading face with a glow ---
    const titleSize = Math.round(Math.min(72, W * 0.1));
    this.mark = this.add.text(cx, titleY - titleSize * 0.85, 'COLLAPSE FIELD', textStyle(Math.round(titleSize * 0.26), { display: true, color: COLORS.accent, letterSpacing: 6 })).setOrigin(0.5).setAlpha(0.9);
    this.titleGlow = this.add.text(cx, titleY, '', textStyle(titleSize, { title: true, color: COLORS.accent, letterSpacing: 4 })).setOrigin(0.5).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setScale(1.06);
    this.title = this.add.text(cx, titleY, '', textStyle(titleSize, { title: true, color: '#ffffff', stroke: true, letterSpacing: 4 })).setOrigin(0.5);
    this.title.setShadow(0, 0, '#4fe0ff', 18, false, true);
    this.subtitle = this.add.text(cx, titleY + titleSize * 0.75, '', textStyle(17, { color: COLORS.dim, align: 'center', wrapWidth: W - 48 })).setOrigin(0.5);
    // a thin rule under the subtitle, the way a HUD would underline a heading
    this.add.rectangle(cx, titleY + titleSize * 0.75 + 20, Math.min(360, W - 80), 1, 0x4fe0ff, 0.5);

    // --- buttons: the start big and glowing, the rest in a row ---
    const startY = narrow ? cy + 10 : cy + 20;
    const startW = Math.min(320, W - 80);
    this.startGlow = this.add.image(cx, startY, 'game', 'p_flare').setDisplaySize(startW * 1.5, 160).setTint(0x4fe0ff).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD);
    this.startBtn = new UiButton(this, cx, startY, { id: 'menu.start', label: '', width: startW, height: 68, fontSize: 28, onPress: () => this.startGame() });

    const rowW = narrow ? Math.min(260, W - 80) : 200;
    if (narrow) {
      this.shopBtn = new UiButton(this, cx, startY + 90, { id: 'menu.shop', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openShop() });
      this.achievementsBtn = new UiButton(this, cx, startY + 154, { id: 'menu.achievements', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openOverlay('Achievements') });
      this.settingsBtn = new UiButton(this, cx, startY + 218, { id: 'menu.settings', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openSettings() });
    } else {
      this.shopBtn = new UiButton(this, cx - rowW - 12, startY + 90, { id: 'menu.shop', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openShop() });
      this.achievementsBtn = new UiButton(this, cx, startY + 90, { id: 'menu.achievements', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openOverlay('Achievements') });
      this.settingsBtn = new UiButton(this, cx + rowW + 12, startY + 90, { id: 'menu.settings', label: '', width: rowW, height: 50, fontSize: 20, onPress: () => this.openSettings() });
    }

    // --- the corners: gold, best time, version, all in the HUD's voice ---
    this.gold = this.add.text(W - 22, 18, '', textStyle(18, { bold: true, color: COLORS.gold, letterSpacing: 1 })).setOrigin(1, 0);
    const footer = narrow ? startY + 290 : startY + 180;
    this.hint = this.add
      .text(cx, footer, '', textStyle(14, { color: COLORS.dim, align: 'center', wrapWidth: W - 48 }))
      .setOrigin(0.5);
    this.best = this.add.text(cx, footer + 40, '', textStyle(15, { display: true, color: COLORS.gold, letterSpacing: 1 })).setOrigin(0.5);
    this.add.text(W - 22, H - 16, `v${VERSION} · Phaser ${Phaser.VERSION}`, textStyle(11, { display: true, color: COLORS.dim })).setOrigin(1, 1).setAlpha(0.7);
    this.add.text(22, H - 16, 'SYS.ONLINE', textStyle(11, { display: true, color: COLORS.good })).setOrigin(0, 1).setAlpha(0.7);

    this.applyStrings();
    this.offLocale = onLocaleChanged(() => this.applyStrings());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offLocale?.();
      this.offLocale = null;
      this.stars = null;
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());

    // Browsers will not start audio before a gesture, so the menu takes the first one it gets —
    // a press anywhere, a key, or the Start button on its way through startGame().
    music.setMood('menu');
    this.input.once('pointerdown', () => this.unlockAudio());
    this.input.keyboard?.once('keydown', () => this.unlockAudio());

    if (window.__game) window.__game.ready = true;
  }

  override update(time: number, delta: number): void {
    // the emblem turns, the start button breathes, the stars twinkle: all cheap, all continuous
    const t = time / 1000;
    if (this.ringA) this.ringA.rotation += delta * 0.00012;
    if (this.ringB) this.ringB.rotation -= delta * 0.0002;
    if (this.hex) this.hex.rotation += delta * 0.00005;
    if (this.startGlow) this.startGlow.setAlpha(0.16 + Math.sin(t * 2.2) * 0.08);
    if (this.titleGlow) this.titleGlow.setAlpha(0.28 + Math.sin(t * 1.4) * 0.1);
    if (this.stars) {
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        s.bob.alpha = 0.35 + 0.35 * Math.sin(t * s.rate + s.phase);
      }
    }
  }

  /** A field of pixel stars in two depths, drawn with one Blitter. */
  private buildStars(W: number, H: number): { bob: Phaser.GameObjects.Bob; rate: number; phase: number }[] {
    const blitter = this.add.blitter(0, 0, 'game', 'px');
    const stars: { bob: Phaser.GameObjects.Bob; rate: number; phase: number }[] = [];
    // a fixed seed keeps the sky the same between visits, which is what a menu wants
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const n = Math.round((W * H) / 9000);
    for (let i = 0; i < n; i++) {
      const bob = blitter.create(rnd() * W, rnd() * H);
      const big = rnd() < 0.15;
      bob.setAlpha(0.6);
      bob.setTint(big ? 0xbfefff : 0x8fb4d8);
      // px is 4 units square; Bobs cannot scale, so the two sizes come from the same frame
      stars.push({ bob, rate: 0.6 + rnd() * 1.6, phase: rnd() * Math.PI * 2 });
    }
    blitter.setAlpha(0.8);
    return stars;
  }

  /** Horizontal scanlines, faint enough to read as a screen rather than a texture. */
  private buildScanlines(W: number, H: number): void {
    const g = this.add.graphics();
    g.lineStyle(1, 0x000000, 0.18);
    for (let y = 0; y < H; y += 3) g.lineBetween(0, y + 0.5, W, y + 0.5);
  }

  /** Corner brackets and a top rule: the frame of an instrument, not a poster. */
  private buildFrame(W: number, H: number): void {
    const g = this.add.graphics();
    const m = 14;
    const len = Math.min(48, W * 0.08);
    g.lineStyle(2, 0x4fe0ff, 0.55);
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const x = sx > 0 ? m : W - m;
      const y = sy > 0 ? m : H - m;
      g.lineBetween(x, y, x + sx * len, y);
      g.lineBetween(x, y, x, y + sy * len);
    }
    g.lineStyle(1, 0x4fe0ff, 0.2);
    g.lineBetween(m + len + 12, m, W - m - len - 12, m);
    g.lineBetween(m + len + 12, H - m, W - m - len - 12, H - m);
  }

  private drawHex(g: Phaser.GameObjects.Graphics, r: number, color: number, alpha: number): void {
    g.lineStyle(2, color, alpha);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.strokePath();
    // tick marks on the ring, like a dial
    g.lineStyle(1, color, alpha * 0.7);
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI / 12) * i;
      const r0 = r * 1.06;
      const r1 = r * (i % 6 === 0 ? 1.16 : 1.1);
      g.lineBetween(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
    }
  }

  private applyStrings(): void {
    this.title.setText(t('menu.title'));
    this.titleGlow.setText(t('menu.title'));
    this.subtitle.setText(t('menu.subtitle'));
    this.startBtn.setLabel(t('menu.start'));
    this.settingsBtn.setLabel(t('menu.settings'));
    this.shopBtn.setLabel(t('menu.shop'));
    this.achievementsBtn.setLabel(t('menu.achievements'));
    this.gold.setText(t('menu.gold', { n: app().save.gold }));
    this.hint.setText(t('menu.hint'));
    const save = app().save;
    this.best.setText(save.bestTimeSec > 0 ? t('menu.best', { t: formatTime(save.bestTimeSec) }) : '');
  }

  /** Starts the score if it is not already running; safe to call more than once. */
  private unlockAudio(): void {
    try {
      music.start(() => audioContextOf(this.sound));
    } catch (error) {
      console.warn('music failed to start', error);
    }
  }

  private startGame(): void {
    if (!this.scene.get('Game')) {
      console.warn('Game scene not registered yet');
      return;
    }
    // the shop and settings are overlays on top of this scene, which still has the keyboard: Enter
    // would otherwise start a run underneath an open panel
    if (this.scene.isActive('Shop') || this.scene.isActive('Settings') || this.scene.isActive('Launch') || this.scene.isActive('Achievements') || this.scene.isActive('Bestiary')) return;
    this.unlockAudio();
    this.scene.launch('Launch');
    this.scene.bringToTop('Launch');
  }

  private openOverlay(key: string): void {
    this.scene.launch(key);
    this.scene.bringToTop(key);
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
