import Phaser from 'phaser';
import { GAME_W, RUN_SECONDS } from '../../config';
import { formatTime, onLocaleChanged, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { DIGIT_FONT_KEY } from '../fonts/retroDigits';
import { IconRow } from '../ui/iconRow';
import type { GameScene } from './GameScene';

/** Screen-space HUD. Runs in parallel with GameScene and only redraws when a value changes. */
export class HudScene extends Phaser.Scene {
  private timer!: Phaser.GameObjects.BitmapText;
  private levelText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private weaponRow!: IconRow;
  private passiveRow!: IconRow;
  private last = { time: -1, level: -1, kills: -1, xp: -1, build: '' };
  private offLocale: (() => void) | null = null;

  constructor() {
    super('Hud');
  }

  create(): void {
    // reset per-run caches: the scene instance is reused between runs
    this.last = { time: -1, level: -1, kills: -1, xp: -1, build: '' };

    this.xpBarBg = this.add.rectangle(GAME_W / 2, 10, GAME_W, 20, 0x0d1420).setOrigin(0.5);
    this.xpBarFill = this.add.rectangle(0, 10, 0, 20, 0x4fe0ff).setOrigin(0, 0.5);
    this.levelText = this.add.text(GAME_W - 12, 10, '', textStyle(14, { bold: true })).setOrigin(1, 0.5);
    this.timer = this.add.bitmapText(GAME_W / 2, 30, DIGIT_FONT_KEY, '00:00', 32).setOrigin(0.5, 0);
    this.killsText = this.add.text(GAME_W - 12, 76, '', textStyle(16, { color: COLORS.dim, align: 'right' })).setOrigin(1, 0);
    this.weaponRow = new IconRow(this, 34, 52, 6, 32);
    this.passiveRow = new IconRow(this, 34, 92, 6, 32);

    this.offLocale = onLocaleChanged(() => {
      this.last.level = -1;
      this.last.kills = -1;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offLocale?.();
      this.offLocale = null;
    });
  }

  override update(): void {
    const game = this.scene.get('Game') as GameScene | undefined;
    if (!game?.sim) return;
    const run = game.sim.run;

    const sec = Math.min(RUN_SECONDS, Math.floor(run.timeMs / 1000));
    if (sec !== this.last.time) {
      this.last.time = sec;
      this.timer.setText(formatTime(sec));
    }
    if (run.level !== this.last.level) {
      this.last.level = run.level;
      this.levelText.setText(t('hud.level', { n: run.level }));
    }
    if (run.kills !== this.last.kills) {
      this.last.kills = run.kills;
      this.killsText.setText(`${t('hud.kills')} ${run.kills}`);
    }
    const build = run.weapons.map((w) => `${w.id}${w.level}`).join(',') + '|' + run.passives.map((p) => `${p.id}${p.level}`).join(',');
    if (build !== this.last.build) {
      this.last.build = build;
      this.weaponRow.setItems(run.weapons, 'weapon');
      this.passiveRow.setItems(run.passives, 'passive');
    }

    const ratio = run.xpNext > 0 ? Math.min(1, run.xp / run.xpNext) : 0;
    if (ratio !== this.last.xp) {
      this.last.xp = ratio;
      this.xpBarFill.setSize(GAME_W * ratio, 20);
    }
  }
}
