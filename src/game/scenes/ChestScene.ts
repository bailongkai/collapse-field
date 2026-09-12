import Phaser from 'phaser';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { fitPanel, minTouchUnits } from '../layout';
import { t } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { registerButton } from '../ui/buttonRegistry';
import { sfx } from '../audio/sfx';
import { describeChoice } from '../ui/choiceCard';
import { CONTENT } from '../../core/content/registry';
import type { ChestResult } from '../../core/sim/runState';
import type { GameScene } from './GameScene';

const PANEL_TINT = 0x16243a;
const ROW_TINT = 0x2a3a52;
const ROW_TINT_EVOLVE = 0x5a2f52;

/**
 * Milliseconds from the moment the overlay opens. The chest flies in, is knocked three times, and
 * bursts; then one reward lands every `REVEAL_GAP` until the stack is complete.
 *
 * The three knocks are the point. They are what makes the count readable before the rewards
 * appear — the player learns that a chest which keeps thumping is about to pay five — and they are
 * spaced well clear of the sound bus's forty-millisecond per-key limit so none of them is dropped.
 */
const FLY_MS = 260;
const THUMPS = [200, 380, 560];
const BURST_MS = 700;
const FIRST_REVEAL_MS = 900;
const REVEAL_GAP = 340;
/** the last reward of a five lands after a held beat, because the pause is what sells it */
const FINALE_EXTRA_MS = 260;

const ROW_H = 74;
const ROW_GAP = 10;
/** title, chest and the prompt: everything in the panel that is not a reward row */
const CHROME_H = 208;

interface Row {
  container: Phaser.GameObjects.Container;
  at: number;
  shown: boolean;
}

/**
 * The supply chest reveal. Everything it shows has already been applied to the run inside the
 * simulation tick that opened the chest, so this scene is theatre over a committed result: it can
 * be skipped, interrupted or never shown at all and the rules do not change. That is what lets a
 * chest exist without a run phase of its own, and why every headless harness keeps working.
 */
export class ChestScene extends Phaser.Scene {
  private result: ChestResult | null = null;
  private elapsed = 0;
  private rows: Row[] = [];
  private thumpsDone = 0;
  private burst = false;
  private chestImg?: Phaser.GameObjects.Image;
  private ring?: Phaser.GameObjects.Image;
  private hint?: Phaser.GameObjects.Text;
  private cleanups: (() => void)[] = [];
  private armed = -1;
  private scaleUi = 1;
  private done = false;

  constructor() {
    super('Chest');
  }

  create(): void {
    restartOnResize(this);
    // Phaser reuses the scene instance across launches: without this the second chest of a run
    // would animate against the first one's destroyed rows.
    this.elapsed = 0;
    this.rows = [];
    this.thumpsDone = 0;
    this.burst = false;
    this.cleanups = [];
    this.armed = -1;
    this.done = false;

    const game = this.scene.get('Game') as GameScene;
    this.result = game.sim.takeChestResult();
    window.__game?.pushEvent('chest:open');
    if (!this.result) {
      this.close();
      return;
    }
    const result = this.result;

    const items = this.revealItems(result);
    // One vertical factor, applied to the rows, the gaps AND the chrome above and below them.
    // Flooring the row height alone was wrong: six rows on a 472-unit landscape phone floored to 56
    // and then rebuilt a 604-tall panel, which put the title above the screen and the only prompt
    // the reveal has below it. A boss chest rolls five rewards a quarter of the time.
    const wantH = CHROME_H + items.length * (ROW_H + ROW_GAP);
    const u = fitPanel(this, 560, wantH);
    const kH = Math.min(1, u.h / wantH);
    this.scaleUi = Math.min(1, u.w / 560, kH);
    const rowW = Math.min(460, u.w - 80);
    const rowH = ROW_H * kH;
    const rowGap = ROW_GAP * kH;
    const chrome = CHROME_H * kH;
    const panelW = rowW + 80;
    const panelH = chrome + items.length * (rowH + rowGap);
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.62);
    techPanel(this, cx, cy, panelW, panelH, { alpha: 0.96, tint: PANEL_TINT, rule: false });

    const titleKey = result.grade === 'boss' ? 'chest.title_boss' : 'chest.title';
    this.add
      .text(cx, cy - panelH / 2 + Math.round(40 * kH), t(titleKey), textStyle(Math.round(30 * this.scaleUi), { bold: true, color: COLORS.accent }))
      .setOrigin(0.5);

    // the light behind the lid, and the chest itself flying in from where it was picked up
    this.ring = this.add.image(cx, cy - panelH / 2 + Math.round(100 * kH), 'game', 'fx_ring')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.burstTint(items.length))
      .setAlpha(0)
      .setScale(0.6 * this.scaleUi);
    this.chestImg = this.add.image(cx, cy - panelH / 2 + Math.round(100 * kH), 'game', 'pk_chest')
      .setDisplaySize(Math.round(68 * this.scaleUi), Math.round(68 * this.scaleUi));

    const top = cy - panelH / 2 + Math.round((CHROME_H - 60) * kH);
    items.forEach((item, i) => {
      const at = FIRST_REVEAL_MS + i * REVEAL_GAP + (i === items.length - 1 && items.length >= 5 ? FINALE_EXTRA_MS : 0);
      const y = top + i * (rowH + rowGap) + rowH / 2;
      this.rows.push({ container: this.buildRow(item, cx, y, rowW, rowH), at, shown: false });
    });

    this.hint = this.add
      .text(cx, cy + panelH / 2 - Math.round(26 * kH), t('chest.continue'), textStyle(Math.round(16 * this.scaleUi), { color: COLORS.dim }))
      .setOrigin(0.5)
      .setAlpha(0);

    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const c of this.cleanups) c();
      this.cleanups.length = 0;
    });
  }

  /** Rewards first, then any evolution, which is the loudest thing in the stack and lands last. */
  private revealItems(result: ChestResult): { info: ReturnType<typeof describeChoice>; evolve: boolean }[] {
    const out = result.rewards.map((choice) => ({ info: describeChoice(choice), evolve: false }));
    for (const id of result.evolved) {
      const def = CONTENT.weapons[id];
      if (!def) continue;
      out.push({
        info: { title: t(def.nameKey), tag: t('chest.evolved'), body: t(def.descKey), icon: def.icon, iconTint: def.iconTint },
        evolve: true,
      });
    }
    if (out.length === 0 && result.gold > 0) {
      out.push({ info: { title: t('levelup.gold', { n: result.gold }), tag: '', body: t('levelup.gold_desc', { n: result.gold }), icon: 'pk_coin' }, evolve: false });
    }
    return out;
  }

  private burstTint(count: number): number {
    if (count >= 5) return 0xff96ff;
    if (count >= 3) return 0xffd166;
    return 0xffffff;
  }

  private buildRow(item: { info: ReturnType<typeof describeChoice>; evolve: boolean }, cx: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const u = this.scaleUi;
    const info = item.info;
    const c = this.add.container(cx, y).setAlpha(0).setVisible(false);
    const bg = this.add.nineslice(0, 0, 'ui', 'panel_rect', w, h, 16, 16, 16, 16).setTint(item.evolve ? ROW_TINT_EVOLVE : ROW_TINT);
    const iconSize = Math.round(40 * u);
    const icon = this.add.image(-w / 2 + Math.round(40 * u), 0, 'game', info.icon).setDisplaySize(iconSize, iconSize);
    if (info.iconTint !== undefined) icon.setTint(info.iconTint);
    const title = this.add.text(-w / 2 + Math.round(76 * u), -Math.round(16 * u), info.title, textStyle(Math.round(20 * u), { bold: true })).setOrigin(0, 0.5);
    const tag = this.add
      .text(w / 2 - Math.round(14 * u), -Math.round(16 * u), info.tag, textStyle(Math.round(15 * u), { color: item.evolve ? COLORS.accent : COLORS.accent }))
      .setOrigin(1, 0.5);
    const body = this.add
      .text(-w / 2 + Math.round(76 * u), Math.round(14 * u), info.body, textStyle(Math.round(14 * u), { color: COLORS.dim, wrapWidth: w - Math.round(96 * u) }))
      .setOrigin(0, 0.5);
    c.add([bg, icon, title, tag, body]);
    return c;
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    const go = (): void => this.advance();
    kb?.on('keydown-ENTER', go);
    kb?.on('keydown-SPACE', go);
    kb?.on('keydown-ESC', go);

    // the whole panel is the button: on a phone there is nothing else to hit
    // the whole screen, not just the panel: the reveal has exactly one action, and a dead margin
    // around the panel only serves to summon the virtual joystick underneath it
    const hit = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, Math.max(this.scale.width, minTouchUnits(this)), Math.max(this.scale.height, minTouchUnits(this)), 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.armed = p.id;
    });
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.armed !== p.id) return;
      this.armed = -1;
      this.advance();
    });
    this.cleanups.push(
      registerButton({
        id: 'chest.continue',
        getPos: () => ({ x: hit.x, y: hit.y }),
        getHitSize: () => ({ w: hit.width, h: hit.height }),
        isEnabled: () => hit.active,
        press: () => this.advance(),
      }),
    );
  }

  /** First press shows everything at once; the second closes. Nobody should have to sit through it twice. */
  private advance(): void {
    if (this.done) {
      this.close();
      return;
    }
    this.settle();
  }

  /** Snap to the finished state: every row visible, chest open, hint showing. */
  private settle(): void {
    for (const row of this.rows) {
      if (!row.shown) {
        row.shown = true;
        row.container.setVisible(true).setAlpha(1).setScale(1);
      }
    }
    this.chestImg?.setAngle(0);
    this.ring?.setAlpha(0.7);
    this.hint?.setAlpha(1);
    this.done = true;
  }

  override update(_time: number, delta: number): void {
    if (this.done) return;
    this.elapsed += delta;
    const e = this.elapsed;

    // fly in
    if (this.chestImg && e < FLY_MS) {
      const p = e / FLY_MS;
      const eased = 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2);
      this.chestImg.setScale((0.5 + 0.5 * eased) * (this.chestImg.scaleX / Math.max(this.chestImg.scaleX, 1e-6)));
      this.chestImg.setAlpha(Math.min(1, p * 2));
    }

    // three knocks, each a little higher than the last
    while (this.thumpsDone < THUMPS.length && e >= THUMPS[this.thumpsDone]) {
      sfx.play('hit', { rate: [0.9, 1, 1.12][this.thumpsDone], volume: 0.9 });
      this.cameras.main.shake(90, 0.004);
      this.thumpsDone++;
    }
    if (this.chestImg && this.thumpsDone > 0 && !this.burst) {
      const since = e - THUMPS[this.thumpsDone - 1];
      this.chestImg.setAngle(since < 90 ? Math.sin((since / 90) * Math.PI * 2) * 7 : 0);
    }

    // the lid
    if (!this.burst && e >= BURST_MS) {
      this.burst = true;
      const count = this.rows.length;
      const tint = this.burstTint(count);
      this.cameras.main.flash(140, (tint >> 16) & 0xff, (tint >> 8) & 0xff, tint & 0xff);
      sfx.play('levelup');
      this.chestImg?.setAngle(0);
    }
    if (this.ring && this.burst) {
      this.ring.setAlpha(Math.min(0.7, this.ring.alpha + delta / 300));
      this.ring.setAngle(this.ring.angle + (delta / 1000) * 12);
    }

    // one reward at a time, each landing with its own note a step higher than the last
    let allShown = true;
    this.rows.forEach((row, i) => {
      if (row.shown) return;
      if (e < row.at) {
        allShown = false;
        return;
      }
      row.shown = true;
      row.container.setVisible(true);
      sfx.play('gem', { rate: 1 + i * 0.08, volume: 0.9 });
    });
    for (const row of this.rows) {
      if (!row.shown || row.container.alpha >= 1) continue;
      row.container.setAlpha(Math.min(1, row.container.alpha + delta / 160));
      row.container.setScale(0.94 + 0.06 * row.container.alpha);
      allShown = false;
    }

    if (allShown && this.rows.every((r) => r.shown)) {
      this.done = true;
      this.hint?.setAlpha(1);
    }
  }

  private close(): void {
    const game = this.scene.get('Game') as GameScene;
    game.closeChestOverlay();
  }
}
