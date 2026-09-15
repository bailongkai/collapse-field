import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { viewOf, fitPanel } from '../layout';
import { sfx } from '../audio/sfx';
import { app } from '../app';
import { setFlag } from '../../core/save/saveData';
import { analytics } from '../../platform';
import type { GameScene } from './GameScene';

const PAGES = ['tutorial.p1', 'tutorial.p2', 'tutorial.p3'] as const;

/**
 * Three pages shown once, over the first run's frozen opening frame. The save remembers it was
 * seen, and the test harness marks it seen up front so no other test meets it.
 */
export class TutorialScene extends Phaser.Scene {
  private page = 0;
  private body?: Phaser.GameObjects.Text;
  private next?: UiButton;
  private dots: Phaser.GameObjects.Arc[] = [];
  private openedAt = 0;

  constructor() {
    super('Tutorial');
  }

  create(data: { page?: number }): void {
    restartOnResize(this, { page: this.page });
    this.page = data?.page ?? 0;
    this.dots = [];
    window.__game?.pushEvent('tutorial:open');
    if (this.page === 0) {
      this.openedAt = Date.now();
      analytics.track({ name: 'tutorial_begin' });
    }
    const cx = viewOf(this).width / 2;
    const cy = viewOf(this).height / 2;
    const panel = fitPanel(this, 600, 340);
    const k = Math.min(1, panel.w / 600);
    this.add.rectangle(cx, cy, viewOf(this).width, viewOf(this).height, 0x05070c, 0.7);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: 0x16243a, rule: false });
    this.add.text(cx, cy - panel.h / 2 + 40 * k, t('tutorial.title'), textStyle(Math.round(26 * k), { bold: true, color: COLORS.accent })).setOrigin(0.5);
    this.body = this.add
      .text(cx, cy - 10 * k, '', textStyle(Math.round(17 * k), { color: COLORS.text, wrapWidth: panel.w - 64, align: 'center' }))
      .setOrigin(0.5);
    PAGES.forEach((_, i) => {
      this.dots.push(this.add.circle(cx + (i - 1) * 18 * k, cy + panel.h / 2 - 92 * k, 4 * k, 0xffffff));
    });
    const btnW = Math.min(200, panel.w / 2 - 30);
    const btnY = cy + panel.h / 2 - 46 * k;
    new UiButton(this, cx - btnW / 2 - 10, btnY, { id: 'tutorial.skip', label: t('tutorial.skip'), width: btnW, height: Math.round(44 * k), onPress: () => this.finish() });
    this.next = new UiButton(this, cx + btnW / 2 + 10, btnY, { id: 'tutorial.next', label: '', width: btnW, height: Math.round(44 * k), onPress: () => this.advance() });
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.show();
  }

  private show(): void {
    this.body?.setText(t(PAGES[this.page]));
    this.dots.forEach((d, i) => d.setAlpha(i === this.page ? 1 : 0.3));
    this.next?.setLabel(this.page === PAGES.length - 1 ? t('tutorial.done') : t('tutorial.next'));
  }

  private advance(): void {
    sfx.play('click');
    if (this.page >= PAGES.length - 1) {
      this.finish();
      return;
    }
    this.page++;
    this.show();
  }

  private finish(): void {
    const ctx = app();
    ctx.save = setFlag(ctx.storage, ctx.save, { tutorialDone: true });
    analytics.track({ name: 'tutorial_done', sec: Math.round((Date.now() - this.openedAt) / 1000) });
    (this.scene.get('Game') as GameScene).closeTutorial();
    this.scene.stop();
  }
}
