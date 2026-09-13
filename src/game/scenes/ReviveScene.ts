import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { fitPanel } from '../layout';
import { sfx } from '../audio/sfx';
import { getPlatform, analytics } from '../../platform';
import type { GameScene } from './GameScene';

/**
 * The offer at death: watch an ad and get back up, or let the death stand. The run is frozen on
 * 'revivePrompt' underneath, so nothing moves until one of the two buttons has been pressed and,
 * for the first, the ad has really finished. Closing the overlay any other way counts as a decline.
 */
export class ReviveScene extends Phaser.Scene {
  private busy = false;
  private status?: Phaser.GameObjects.Text;
  private accept?: UiButton;
  private decline?: UiButton;

  constructor() {
    super('Revive');
  }

  create(): void {
    restartOnResize(this);
    this.busy = false;
    window.__game?.pushEvent('revive:prompt');
    // the offer is half the funnel: without it, an unanswered prompt is indistinguishable from one
    // that was never shown
    analytics.track({ name: 'ad_offer', kind: 'revive' });
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const panel = fitPanel(this, 520, 300);
    const k = Math.min(1, panel.w / 520);
    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.7);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: 0x16243a, rule: false });
    this.add.text(cx, cy - panel.h / 2 + 44 * k, t('revive.title'), textStyle(Math.round(30 * k), { bold: true, color: COLORS.warn })).setOrigin(0.5);
    this.add
      .text(cx, cy - 20 * k, t('revive.body'), textStyle(Math.round(17 * k), { color: COLORS.text, wrapWidth: panel.w - 60, align: 'center' }))
      .setOrigin(0.5);
    this.status = this.add.text(cx, cy + 28 * k, '', textStyle(Math.round(15 * k), { color: COLORS.dim })).setOrigin(0.5);

    const btnW = Math.min(220, panel.w / 2 - 30);
    const btnY = cy + panel.h / 2 - 48 * k;
    this.accept = new UiButton(this, cx - btnW / 2 - 10, btnY, { id: 'revive.accept', label: t('revive.accept'), width: btnW, height: Math.round(48 * k), fontSize: 18, onPress: () => void this.watch() });
    this.decline = new UiButton(this, cx + btnW / 2 + 10, btnY, { id: 'revive.decline', label: t('revive.decline'), width: btnW, height: Math.round(48 * k), onPress: () => this.giveUp() });
    this.input.keyboard?.on('keydown-ENTER', () => void this.watch());
    this.input.keyboard?.on('keydown-ESC', () => this.giveUp());
  }

  private async watch(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    sfx.play('click');
    this.accept?.setEnabled(false);
    this.decline?.setEnabled(false);
    this.status?.setText(t('revive.loading'));
    const ads = getPlatform().ads;
    const earned = await ads.showRewarded('revive');
    analytics.track({ name: 'ad_shown', kind: 'revive', earned, result: ads.lastResult() });
    // the scene can have been torn down while the ad played: a resize restarts it, a hook can end the run
    if (!this.scene.isActive()) return;
    const game = this.scene.get('Game') as GameScene;
    if (earned) {
      game.resolveAdRevive(true);
      this.scene.stop();
      return;
    }
    this.status?.setText(t('revive.failed'));
    this.busy = false;
    this.decline?.setEnabled(true);
  }

  private giveUp(): void {
    if (this.busy) return;
    sfx.play('click');
    const game = this.scene.get('Game') as GameScene;
    game.resolveAdRevive(false);
    this.scene.stop();
  }
}
