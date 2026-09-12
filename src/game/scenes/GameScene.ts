import Phaser from 'phaser';
import { FIXED_DT_MS, GAME_H, GAME_W, MAX_FRAME_DELTA_MS, MAX_STEPS_PER_FRAME, RUN_SECONDS } from '../../config';
import { Simulation } from '../../core/sim/simulation';
import { DEFAULT_CHARACTER_ID } from '../../data/characters';
import { DEFAULT_STAGE_ID } from '../../data/stages';
import type { EnemyBehaviorId, StatKey } from '../../data/types';
import type { RunEnd } from '../../core/sim/runState';
import { InputController } from '../input/inputController';
import { VirtualJoystick } from '../input/touchControls';
import { FloorView } from '../view/floorView';
import { PlayerView } from '../view/playerView';
import { EnemyView } from '../view/enemyView';
import { CarriedView } from '../view/carriedView';
import { TetherView } from '../view/tetherView';
import { RelicView } from '../view/relicView';
import { ObstacleView } from '../view/obstacleView';
import { ShadowView } from '../view/shadowView';
import { GemView } from '../view/gemView';
import { PickupView } from '../view/pickupView';
import { ProjectileView } from '../view/projectileView';
import { DamageNumbers } from '../view/damageNumbers';
import { FxView } from '../view/fxView';
import { recoilKindFor } from '../view/anim';
import { Profiler } from '../../debug/profiler';
import type { FrameStats, HookRunState, RunHandlers } from '../../debug/hook';
import { rendererString } from '../../debug/hook';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { app } from '../app';
import { metaBonuses, metaCharges } from '../../core/save/upgrades';
import { lockedItems } from '../../core/save/saveData';
import { t } from '../../i18n';
import { analytics, getPlatform } from '../../platform';
import { haptic } from '../../platform/haptics';
import type { HudScene } from './HudScene';

export interface GameSceneData {
  seed?: number;
  characterId?: string;
  stageId?: string;
  curse?: number;
}

/** Owns the Simulation, drives it with a fixed-step accumulator and mirrors it into pooled views. */
export class GameScene extends Phaser.Scene {
  sim!: Simulation;
  private input_!: InputController;
  private joystick!: VirtualJoystick;
  private offTouch: (() => void) | null = null;
  private floorView!: FloorView;
  private playerView!: PlayerView;
  private enemyView!: EnemyView;
  private carriedView!: CarriedView;
  private tetherView!: TetherView;
  private relicView!: RelicView;
  private obstacleView!: ObstacleView;
  private shadowView!: ShadowView;
  private gemView!: GemView;
  private pickupView!: PickupView;
  private projectileView!: ProjectileView;
  private damageNumbers!: DamageNumbers;
  private fxView!: FxView;
  private profiler = new Profiler();
  private accumulator = 0;
  private levelUpPending = false;
  private chestPending = false;
  private revivePending = false;
  private timeScale = 1;
  private layers!: Record<
    'floor' | 'decor' | 'shadows' | 'gems' | 'pickups' | 'enemies' | 'player' | 'projectiles' | 'fx' | 'numbers',
    Phaser.GameObjects.Layer
  >;

  constructor() {
    super('Game');
  }

  create(data: GameSceneData): void {
    // the scene instance is reused between runs, so every per-run field is reset here
    this.accumulator = 0;
    this.timeScale = 1;
    this.levelUpPending = false;
    this.chestPending = false;
    this.revivePending = false;
    this.slotCache = [];

    const seed = data.seed ?? app().seed ?? (Date.now() >>> 0);
    this.sim = new Simulation({
      seed,
      characterId: data.characterId ?? DEFAULT_CHARACTER_ID,
      stageId: data.stageId ?? DEFAULT_STAGE_ID,
      viewW: this.scale.width,
      viewH: this.scale.height,
      metaBonuses: metaBonuses(app().save),
      charges: metaCharges(app().save),
      curse: data.curse ?? 0,
      lockedItems: lockedItems(app().save),
      // a rewarded ad can only be offered where one can be shown; the headless harness never sees it
      adRevive: getPlatform().ads.available(),
    });
    analytics.track({ name: 'run_start', stage: this.sim.stage.id, character: this.sim.character.id, curse: this.sim.run.curse });

    this.cameras.main.setBackgroundColor('#05070c');
    this.layers = {
      floor: this.add.layer(), decor: this.add.layer(), shadows: this.add.layer(), gems: this.add.layer(),
      pickups: this.add.layer(), enemies: this.add.layer(), player: this.add.layer(),
      projectiles: this.add.layer(), fx: this.add.layer(), numbers: this.add.layer(),
    };
    let depth = 0;
    for (const key of ['floor', 'decor', 'shadows', 'gems', 'pickups', 'enemies', 'player', 'projectiles', 'fx', 'numbers'] as const) {
      this.layers[key].setDepth(depth++);
    }

    this.floorView = new FloorView(this, this.sim.stage, this.layers.floor, this.layers.decor);
    this.playerView = new PlayerView(this, this.sim.character, this.layers.player);
    this.shadowView = new ShadowView(this, this.layers.shadows);
    this.enemyView = new EnemyView(this, this.layers.enemies);
    // above the bodies, below the numbers: the marker has to survive a crowded screen
    this.carriedView = new CarriedView(this, this.layers.fx);
    // under the bodies: a beam is the floor between them, not something drawn over their heads
    this.tetherView = new TetherView(this, this.layers.shadows);
    this.relicView = new RelicView(this, this.layers.numbers);
    this.obstacleView = new ObstacleView(this, this.sim.stage, this.layers.pickups);
    this.gemView = new GemView(this, this.layers.gems);
    this.pickupView = new PickupView(this, this.layers.pickups);
    this.projectileView = new ProjectileView(this, this.layers.projectiles, this.layers.fx);
    this.damageNumbers = new DamageNumbers(this, this.layers.numbers);
    this.fxView = new FxView(this, this.layers.fx);
    this.input_ = new InputController(this);
    // the stick draws above every world layer but below the HUD scene
    this.joystick = new VirtualJoystick(this, 1000);
    this.input_.setJoystick(this.joystick);
    const touch = app().touch;
    this.joystick.setEnabled(touch.active);
    this.offTouch = touch.onChange((on) => this.joystick.setEnabled(on));

    this.cameras.main.startFollow(this.playerView.gameObject, true, 0.12, 0.12);
    this.cameras.main.centerOn(0, 0);

    this.scene.launch('Hud');
    this.profiler.attach(this.game);
    this.bindHook();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.input.keyboard?.on('keydown-ESC', () => this.openPause());
    this.input.keyboard?.on('keydown-P', () => this.openPause());
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden);
    window.addEventListener('app-back', this.onBack);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    // the first run opens on the briefing; the clock waits for it
    if (!app().save.tutorialDone) {
      this.sim.pause();
      this.scene.launch('Tutorial');
      this.scene.bringToTop('Tutorial');
    }
  }

  /** Called by the briefing when it is dismissed. */
  closeTutorial(): void {
    this.accumulator = 0;
    this.input_.reset();
    this.sim.resume();
  }

  /** Opens the ad offer over the frozen death frame. */
  private openReviveOverlay(): void {
    if (this.revivePending || this.scene.isActive('Revive')) return;
    this.revivePending = true;
    this.scene.launch('Revive');
    this.scene.bringToTop('Revive');
    this.scene.get('Revive').events.once(Phaser.Scenes.Events.CREATE, () => {
      this.revivePending = false;
    });
  }

  /** The offer was answered: the ad was watched, or it was declined or failed. */
  resolveAdRevive(watched: boolean): void {
    if (this.sim.run.phase !== 'revivePrompt') return;
    if (watched) {
      this.sim.acceptAdRevive();
      this.accumulator = 0;
      this.input_.reset();
      this.cameras.main.flash(300, 255, 255, 255);
      sfx.play('levelup');
    } else {
      this.sim.declineAdRevive();
    }
  }

  /** A wider window shows more of the map, so the wave density follows it to keep the pressure. */
  private onResize = (): void => {
    this.sim.setViewSize(this.scale.width, this.scale.height);
  };

  /** Android's back button: pause a running game; overlays already have their own buttons. */
  private onBack = (): void => {
    if (this.scene.isActive() && this.sim.run.phase === 'running') this.openPause();
  };

  private onHidden = (): void => {
    if (this.scene.isActive() && this.sim.run.phase === 'running') this.openPause();
  };

  /** Single teardown path: stops child scenes, detaches the profiler and unbinds the debug hook. */
  private teardown(): void {
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden);
    window.removeEventListener('app-back', this.onBack);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.scene.stop('Hud');
    this.scene.stop('LevelUp');
    this.scene.stop('Chest');
    this.scene.stop('Revive');
    this.scene.stop('Tutorial');
    this.scene.stop('Pause');
    this.profiler.detach();
    this.levelUpPending = false;
    this.chestPending = false;
    this.revivePending = false;
    this.offTouch?.();
    this.offTouch = null;
    this.joystick.destroy();
    window.__game?.detach();
    this.floorView.destroy();
    this.playerView.destroy();
    this.enemyView.destroy();
    this.carriedView.destroy();
    this.tetherView.destroy();
    this.relicView.destroy();
    this.obstacleView.destroy();
    this.shadowView.destroy();
    this.gemView.destroy();
    this.pickupView.destroy();
    this.projectileView.destroy();
    this.damageNumbers.destroy();
    this.fxView.destroy();
  }

  openPause(): void {
    if (this.sim.run.phase !== 'running') return;
    this.sim.pause();
    sfx.pauseAll();
    if (this.scene.get('Pause')) {
      this.scene.launch('Pause');
      this.scene.bringToTop('Pause');
    }
    this.scene.pause();
  }

  /** Closes the pause overlay and hands control back. Shared by the button, Esc and the debug hook. */
  closePause(): void {
    if (this.scene.isActive('Pause') || this.scene.isPaused('Pause')) this.scene.stop('Pause');
    this.scene.resume();
    this.accumulator = 0;
    this.input_.reset();
    this.sim.resume();
    sfx.resumeAll();
  }

  resumeFromPause(): void {
    this.accumulator = 0;
    this.input_.reset();
    this.sim.resume();
    sfx.resumeAll();
  }

  /** Opens the level-up overlay a beat after the flash, so the player sees why time stopped. */
  private openLevelUpOverlay(): void {
    if (this.levelUpPending || this.scene.isActive('LevelUp')) return;
    this.levelUpPending = true;
    haptic('light');
    this.cameras.main.flash(200, 90, 200, 255);
    this.playerView.pop();
    sfx.play('levelup');
    this.time.delayedCall(250, () => {
      if (this.sim.run.phase !== 'levelup') {
        this.levelUpPending = false;
        return;
      }
      this.scene.launch('LevelUp');
      this.scene.bringToTop('LevelUp');
      // the launch is queued, not immediate: clearing the guard here would let the next frame,
      // which still sees phase 'levelup' and an inactive LevelUp scene, open the overlay a second
      // time. Hand the guard over to scene.isActive once the scene really exists.
      this.scene.get('LevelUp').events.once(Phaser.Scenes.Events.CREATE, () => {
        this.levelUpPending = false;
      });
    });
  }

  /**
   * Opens the chest reveal. Unlike the level-up overlay this does not pause the Game scene: the
   * frozen battlefield keeps rendering behind the panel, which is most of what makes the moment
   * feel like a moment. The clock is stopped through the simulation instead.
   */
  private openChestOverlay(): void {
    if (this.chestPending || this.scene.isActive('Chest')) return;
    this.chestPending = true;
    haptic('medium');
    this.sim.pause();
    this.scene.launch('Chest');
    this.scene.bringToTop('Chest');
    // the launch is queued to a frame boundary, so the guard is handed to the scene itself
    this.scene.get('Chest').events.once(Phaser.Scenes.Events.CREATE, () => {
      this.chestPending = false;
    });
  }

  /** Called by the reveal when it is finished with. */
  closeChestOverlay(): void {
    this.scene.stop('Chest');
    // Two chests can be collected on the same tick. The next one is NOT opened here: the stop above
    // is queued to a frame boundary, so `scene.isActive('Chest')` is still true for the rest of this
    // one and opening now would be refused and the queue would strand, leaving the run paused
    // forever. update() opens it on a later frame instead, and the clock stays stopped until the
    // queue is empty because resume() is what hands it back.
    if (this.sim.run.chestQueue.length === 0) this.sim.resume();
  }

  /** Called by the overlay; applies the pick and closes or re-rolls in place. */
  applyLevelUpChoice(index: number): boolean {
    const pick = this.sim.run.choices?.[index];
    if (!this.sim.applyChoice(index)) return false;
    if (pick) analytics.track({ name: 'levelup_pick', kind: pick.kind, id: 'id' in pick ? pick.id : pick.kind });
    this.scene.stop('LevelUp');
    if (this.sim.run.phase === 'levelup') this.openLevelUpOverlay();
    return true;
  }

  /** Reroll, skip or banish from the overlay; the overlay rebuilds itself on success. */
  rerollLevelUp(): boolean {
    if (!this.sim.rerollChoices()) return false;
    this.scene.get('LevelUp').scene.restart();
    return true;
  }

  skipLevelUp(): boolean {
    if (!this.sim.skipLevelUp()) return false;
    this.scene.stop('LevelUp');
    if (this.sim.run.phase === 'levelup') this.openLevelUpOverlay();
    return true;
  }

  banishLevelUp(index: number): boolean {
    if (!this.sim.banishChoice(index)) return false;
    this.scene.get('LevelUp').scene.restart();
    return true;
  }

  override update(_time: number, delta: number): void {
    // an overlay above this scene can swallow the release, so check the stick is still really held
    this.joystick.poll();
    const run = this.sim.run;
    if (run.phase === 'running') {
      // the autopilot writes the input inside the simulation; real input must not fight it
      if (!this.sim.isAutopilot()) {
        const dir = this.input_.read();
        this.sim.setInput(dir.x, dir.y);
      }
      const slow = this.slowMoUntil > performance.now() ? 0.3 : 1;
      this.accumulator += Math.min(delta, MAX_FRAME_DELTA_MS) * this.timeScale * slow;
      let steps = 0;
      const simStart = performance.now();
      while (this.accumulator >= FIXED_DT_MS && steps < MAX_STEPS_PER_FRAME) {
        if (!this.sim.step()) break;
        this.accumulator -= FIXED_DT_MS;
        steps++;
      }
      this.profiler.markSim(performance.now() - simStart);
    } else {
      this.profiler.markSim(0);
    }

    // the score thickens with the run: quiet at the start, busy by the reaper
    music.setIntensity(Math.min(1, run.timeMs / (RUN_SECONDS * 1000)) * 0.85 + (run.phase === 'running' ? 0.1 : 0));

    const syncStart = performance.now();
    this.syncViews(delta);
    this.profiler.markSync(performance.now() - syncStart);
    this.profiler.endFrame();

    // A chest and a level-up can land on the same tick. The chest goes first and the level-up
    // waits, because two overlays opening on top of each other reads as a bug. The phases cooperate
    // by accident and it is worth saying why: sim.pause() only moves out of 'running', so a chest
    // opened during a level-up leaves the phase alone, and closing it leaves the level-up intact.
    const chestBusy = run.chestQueue.length > 0 || this.chestPending || this.scene.isActive('Chest');
    if (run.chestQueue.length > 0) this.openChestOverlay();
    if (run.phase === 'levelup' && !chestBusy) this.openLevelUpOverlay();
    if (run.phase === 'revivePrompt') this.openReviveOverlay();
    if (run.phase === 'ended') this.finishRun();
  }

  private enemyName(id: string): string {
    const def = this.sim.reg.enemies[id];
    return def ? t(def.nameKey) : id;
  }

  private finishRun(): void {
    const run = this.sim.run;
    analytics.track({ name: 'run_end', stage: run.stageId, character: run.characterId, timeSec: Math.round(run.timeMs / 1000), level: run.level, kills: run.kills, cause: run.ended ?? 'died', curse: run.curse });
    this.scene.start('Results', {
      timeSec: run.timeMs / 1000,
      kills: run.kills,
      level: run.level,
      gold: run.gold,
      ended: run.ended ?? 'died',
      weapons: run.weapons.map((w) => ({ ...w })),
      passives: run.passives.map((p) => ({ ...p })),
      seed: run.seed,
      characterId: run.characterId,
      stageId: run.stageId,
      curse: run.curse,
      chestsOpened: run.chestsOpened,
      bossKills: run.bossKills,
      damageByWeapon: run.weapons.map((w, i) => ({ id: w.id, damage: run.damageBySlot[i] ?? 0 })),
      seen: [...this.sim.world.seen],
    });
  }

  private syncViews(deltaMs: number): void {
    // a run can end mid-batch, which starts the results scene and tears this one down; the
    // trailing sync of that batch must not touch destroyed cameras or views
    if (!this.scene.isActive() || !this.cameras?.main) return;
    const cam = this.cameras.main;
    const p = this.sim.world.player;
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    this.playerView.update(p, this.sim.run.hp, this.sim.stats.maxHealth, deltaMs);
    this.floorView.update(cam.midPoint.x, cam.midPoint.y, cam.scrollX, cam.scrollY, viewW, viewH);
    this.shadowView.sync(this.sim.world, cam.midPoint.x, cam.midPoint.y, viewW, viewH);
    this.enemyView.sync(this.sim.world, cam.midPoint.x, cam.midPoint.y, viewW, viewH, deltaMs);
    this.carriedView.sync(this.sim.world, cam.midPoint.x, cam.midPoint.y, viewW, viewH, deltaMs);
    this.tetherView.sync(this.sim.world, cam.midPoint.x, cam.midPoint.y, viewW, viewH, deltaMs);
    this.relicView.sync(this.sim.world, cam.midPoint.x, cam.midPoint.y, viewW, viewH, deltaMs);
    this.gemView.sync(this.sim.world, cam.midPoint.x, cam.midPoint.y, viewW, viewH);
    this.pickupView.sync(this.sim.world, this.sim.run.timeMs);
    this.projectileView.sync(this.sim.world, this.weaponIdBySlot(), cam.midPoint.x, cam.midPoint.y, viewW, viewH);
    this.fxView.updateAura(p.x, p.y, this.sim.auraRadius(), deltaMs);
    this.pumpEvents(true);
    this.damageNumbers.update(deltaMs);
  }

  private toast(text: string, ms?: number): void {
    const hud = this.scene.get('Hud') as HudScene | undefined;
    hud?.showToast(text, ms);
  }

  private slowMoUntil = 0;

  /** A brief dip in time scale as a beat after a big kill; purely presentational and off in tests. */
  private slowMotion(ms: number): void {
    if (app().testMode) return;
    this.slowMoUntil = performance.now() + ms;
  }

  private slotCache: string[] = [];

  private weaponIdBySlot(): string[] {
    const weapons = this.sim.run.weapons;
    if (this.slotCache.length !== weapons.length) this.slotCache = weapons.map((w) => w.id);
    else for (let i = 0; i < weapons.length; i++) this.slotCache[i] = weapons[i].id;
    return this.slotCache;
  }

  /**
   * Drains the simulation's event ring. `visual` is false while fast-forwarding, where only the
   * notable events are worth logging for tests: replaying thousands of ticks of flashes, particles
   * and sounds would be meaningless and slow.
   */
  private pumpEvents(visual: boolean): void {
    const buf = this.sim.world.events;
    const hook = window.__game;
    this.damageNumbers.beginStep();
    for (let i = 0; i < buf.length; i++) {
      const e = buf.at(i);
      switch (e.type) {
        case 'bossSpawned':
          hook?.pushEvent(`boss:spawn:${e.id}`);
          break;
        case 'bossKilled':
          hook?.pushEvent(`boss:kill:${e.id}`);
          break;
        case 'levelUp':
          hook?.pushEvent(`levelup:${e.n}`);
          break;
        case 'final':
          hook?.pushEvent('final');
          break;
        case 'enrage':
          hook?.pushEvent('enrage');
          break;
        case 'rush':
          hook?.pushEvent('rush');
          break;
        case 'chest':
          hook?.pushEvent('pickup:chest');
          break;
        case 'evolve':
          hook?.pushEvent(`evolve:${e.id}`);
          break;
        case 'died':
          hook?.pushEvent('died');
          break;
        case 'survived':
          hook?.pushEvent('survived');
          break;
        case 'revive':
          hook?.pushEvent('revive');
          break;
        case 'revivePrompt':
          hook?.pushEvent('revive:offer');
          break;
        default:
          break;
      }
      if (!visual) continue;
      switch (e.type) {
        case 'hurt':
          haptic('medium');
          this.playerView.flashHurt();
          this.cameras.main.shake(150, 0.006);
          sfx.play('hurt');
          break;
        case 'death':
          this.fxView.death(e.x, e.y, e.big);
          sfx.play(this.sim.reg.enemies[e.id]?.behavior === 'prop' ? 'crate' : e.big ? 'explode' : 'death');
          break;
        case 'shot': {
          // every weapon has its own voice; the bus rate-limits per key so a burst is one sound
          const wdef = this.sim.reg.weapons[e.id];
          const key = wdef?.visual.sfx as Parameters<typeof sfx.play>[0] | undefined;
          if (key) sfx.play(key, { volume: 0.45 });
          if (wdef) this.playerView.recoil(recoilKindFor(wdef.behavior));
          break;
        }
        case 'hit':
          this.damageNumbers.spawn(e.x, e.y - 12, e.n, e.big);
          if (e.big) this.cameras.main.shake(120, 0.004);
          sfx.play('hit');
          break;
        case 'bossSpawned':
          music.setMood('boss');
          this.toast(t('toast.boss', { name: this.enemyName(e.id) }));
          this.cameras.main.shake(400, 0.008);
          sfx.play('boss');
          break;
        case 'final':
          music.setMood('final');
          this.toast(t('toast.final', { name: this.enemyName(e.id) }), 3600);
          this.cameras.main.shake(600, 0.01);
          sfx.play('boss');
          break;
        case 'enrage':
          this.toast(t('toast.enrage', { name: this.enemyName(e.id) }), 3000);
          this.cameras.main.flash(300, 255, 60, 60);
          this.cameras.main.shake(500, 0.01);
          sfx.play('boss');
          break;
        case 'chest':
          // no toast: the reveal that is about to open says all of this at length, and a banner
          // sliding past behind the panel only competes with it
          break;
        case 'evolve': {
          // An evolution that came out of a chest is the last and loudest row of the reveal that is
          // about to open. Naming it in a banner first, behind the panel, gives the ending away
          // before the reveal has dealt a single card.
          if (this.sim.run.chestQueue.length > 0 || this.scene.isActive('Chest')) break;
          const def = this.sim.reg.weapons[e.id];
          this.toast(t('toast.evolve', { name: def ? t(def.nameKey) : e.id }), 3200);
          this.cameras.main.flash(500, 255, 120, 220);
          this.cameras.main.shake(300, 0.006);
          sfx.play('levelup');
          break;
        }
        case 'bossKilled':
          // the final boss ends the run; any other one hands the field back to the ordinary fight
          if (!this.sim.reg.enemies[e.id]?.boss?.final) music.setMood('battle');
          haptic('heavy');
          this.toast(t('toast.bossKilled', { name: this.enemyName(e.id) }), 3000);
          this.cameras.main.flash(400, 255, 255, 255);
          this.cameras.main.shake(700, 0.012);
          this.slowMotion(650);
          sfx.play('explode');
          break;
        case 'explode':
          this.fxView.death(e.x, e.y, true);
          this.cameras.main.shake(180, 0.006);
          sfx.play('explode');
          break;
        case 'shield':
          this.toast(t('toast.shield'), 1400);
          sfx.play('emp');
          break;
        case 'signature': {
          const def = this.sim.character.signature;
          this.toast(t('toast.signature', { name: t(def.nameKey) }), 1600);
          sfx.play('levelup');
          break;
        }
        case 'telegraph':
          this.cameras.main.shake(200, 0.003);
          sfx.play('boss');
          break;
        case 'enemyShot':
          sfx.play('rail', { volume: 0.5 });
          break;
        case 'heal':
        case 'pickup':
          sfx.play('pickup');
          break;
        case 'nuke':
          this.cameras.main.flash(260, 120, 200, 255);
          sfx.play('emp');
          break;
        case 'vacuum':
          sfx.play('pickup');
          break;
        default:
          break;
      }
    }
    buf.clear();
  }

  // --- debug hook ------------------------------------------------------------
  private listPickups(): { id: number; defId: string; x: number; y: number }[] {
    const pool = this.sim.world.pickups;
    const alive = pool.aliveList();
    const out: { id: number; defId: string; x: number; y: number }[] = [];
    for (let i = 0; i < pool.count; i++) {
      const p = pool.items[alive[i]];
      out.push({ id: p.id, defId: p.defId, x: p.x, y: p.y });
    }
    return out;
  }

  private emptyBehaviorCounts(): Record<EnemyBehaviorId, number> {
    return { chase: 0, line: 0, boss: 0, ranged: 0, dasher: 0, bomber: 0, healer: 0, tractor: 0, nest: 0, blink: 0, layer: 0, prop: 0,
      mortar: 0, bulwark: 0, scavenger: 0, tether: 0, mire: 0, flanker: 0, suppressor: 0 };
  }

  private getState(): HookRunState {
    const { sim } = this;
    const run = sim.run;
    const w = sim.world;
    const byBehavior = this.emptyBehaviorCounts();
    const alive = w.enemies.aliveList();
    for (let i = 0; i < w.enemies.count; i++) byBehavior[w.enemies.items[alive[i]].behavior]++;
    return {
      scene: window.__game?.scene() ?? 'game',
      phase: run.phase,
      seed: run.seed,
      time: run.timeMs / 1000,
      hp: run.hp,
      maxHp: sim.stats.maxHealth,
      level: run.level,
      xp: run.xp,
      xpNext: run.xpNext,
      kills: run.kills,
      gold: run.gold,
      chestsOpened: run.chestsOpened,
      adRevived: run.adRevived,
      charges: { reroll: run.rerolls, skip: run.skips, banish: run.banishes, banished: [...run.banished] },
      curse: run.curse,
      signature: {
        kind: sim.character.signature.kind,
        ready: sim.signature.cooldownMs === 0 && sim.signature.activeMs === 0,
        activeMs: sim.signature.activeMs,
        cooldownMs: sim.signature.cooldownMs,
        fired: sim.signature.fired,
      },
      player: { x: w.player.x, y: w.player.y, facing: w.player.facing },
      counts: {
        enemies: w.enemies.count,
        projectiles: w.projectiles.count,
        gems: w.gems.count,
        pickups: w.pickups.count,
        dmgNumbers: this.damageNumbers.activeCount,
      },
      pickups: this.listPickups(),
      enemies: { alive: w.enemies.count, byBehavior },
      weapons: run.weapons.map((x) => ({ ...x })),
      passives: run.passives.map((x) => ({ ...x })),
      stats: sim.stats,
      choices: run.choices,
      god: run.god,
      finalSpawned: run.finalSpawned,
      ended: run.ended,
    };
  }

  private bindHook(): void {
    const handlers: RunHandlers = {
      // the hook takes the same path as pressing Escape, so tests exercise the real pause flow
      pause: () => this.openPause(),
      resume: () => this.closePause(),
      setTimeScale: (n: number) => {
        this.timeScale = Math.max(0, n);
      },
      step: (ticks: number) => {
        let done = 0;
        while (done < ticks) {
          const chunk = Math.min(60, ticks - done);
          const ran = this.sim.stepMany(chunk);
          done += ran;
          if (ran < chunk) break;
          if (done < ticks) this.pumpEvents(false);
        }
        // animate a single frame: the visuals show the final moment, not the whole batch
        this.syncViews(FIXED_DT_MS);
        return done;
      },
      fastForward: async (sec: number, o = {}) => {
        const budgetMs = o.budgetMs ?? 240_000;
        const policy = o.levelUpPolicy ?? 'first';
        const total = Math.round(sec * 60);
        const started = performance.now();
        let done = 0;
        while (done < total) {
          // Resolve every pending offer before stepping again, otherwise the run sits frozen for
          // the rest of the span. Crossing two thresholds at once leaves the phase on 'levelup'
          // after the first pick, so this has to drain the queue rather than assume one pick ends it.
          // A chest reveal is theatre over a result the simulation has already committed, so a
          // hands-off span drains it rather than sitting behind it. Without this one chest pauses
          // the run and the fast-forward returns early having played a fraction of the span it was
          // asked for — quietly, because it looks like a run that simply ended.
          if (this.sim.run.chestQueue.length > 0 || this.scene.isActive('Chest')) {
            this.sim.run.chestQueue.length = 0;
            this.scene.stop('Chest');
            this.chestPending = false;
            this.sim.resume();
          }
          if (this.sim.run.phase === 'revivePrompt') {
            this.scene.stop('Revive');
            this.revivePending = false;
            this.sim.declineAdRevive();
          }
          if (this.sim.run.phase === 'levelup') {
            if (policy === 'none') break;
            let picks = 0;
            while (this.sim.run.phase === 'levelup' && picks < 64) {
              const choices = this.sim.run.choices ?? [];
              if (choices.length === 0) break;
              const index = policy === 'random' ? Math.floor(Math.random() * choices.length) : 0;
              if (!this.applyLevelUpChoice(index)) break;
              picks++;
            }
            if (this.sim.run.phase === 'levelup') break; // genuinely stuck
          }
          if (this.sim.run.phase !== 'running') break;
          const chunk = Math.min(600, total - done);
          const ran = this.sim.stepMany(chunk);
          done += ran;
          this.pumpEvents(false);
          if (performance.now() - started > budgetMs) break;
          await new Promise<void>((r) => setTimeout(r, 0));
        }
        this.syncViews(FIXED_DT_MS);
      },
      setTime: (sec: number) => this.sim.setTime(sec),
      setInput: (dx: number, dy: number) => {
        this.input_.setOverride(dx, dy);
        this.sim.setInput(dx, dy);
      },
      setAutopilot: (on: boolean) => this.sim.setAutopilot(on),
      getViewSize: () => this.sim.getViewSize(),
      setPlayerPos: (x: number, y: number) => {
        this.sim.world.player.x = x;
        this.sim.world.player.y = y;
      },
      spawn: (id: string, n: number, o) => this.sim.spawn(id, n, o),
      spawnBoss: () => this.sim.spawnBoss(),
      spawnFinal: () => this.sim.spawnFinal(),
      despawnFinal: () => this.sim.despawnFinal(),
      killAll: () => {
        this.sim.killAllOnScreen(true);
      },
      clearEnemies: () => this.sim.world.enemies.clear(),
      triggerEvent: (i: number) => {
        this.sim.triggerEvent(i);
      },
      spawnGems: (n: number, tier, o) => this.sim.spawnGems(n, tier ?? 'blue', o ?? {}),
      spawnPickup: (id: string, x?: number, y?: number) => {
        this.sim.spawnPickup(id, x, y);
      },
      collectPickup: (id: number) => {
        this.sim.collectPickup(id);
      },
      giveWeapon: (id: string, level?: number) => {
        this.sim.giveWeapon(id, level ?? 1);
      },
      givePassive: (id: string, level?: number) => {
        this.sim.givePassive(id, level ?? 1);
      },
      setLevel: (n: number) => this.sim.setLevel(n),
      addXp: (n: number) => this.sim.addXp(n),
      triggerLevelUp: () => {
        this.sim.run.pendingLevelUps++;
        this.sim.openLevelUp();
      },
      getChoices: () => this.sim.run.choices,
      pickChoice: (i: number) => this.applyLevelUpChoice(i),
      answerRevive: (watched: boolean) => {
        this.scene.stop('Revive');
        this.revivePending = false;
        this.resolveAdRevive(watched);
      },
      reroll: () => this.rerollLevelUp(),
      skip: () => this.skipLevelUp(),
      banish: (i: number) => this.banishLevelUp(i),
      godMode: (on: boolean) => {
        this.sim.run.god = on;
      },
      setStat: (k: StatKey, v: number) => this.sim.setStatOverride(k, v),
      heal: () => {
        this.sim.world.player.hp = this.sim.stats.maxHealth;
        this.sim.run.hp = this.sim.world.player.hp;
      },
      kill: () => {
        this.sim.world.player.hp = 0;
        this.sim.endRun('died');
      },
      endRun: (cause: RunEnd) => this.sim.endRun(cause),
      setSeed: (seed: number) => {
        this.sim.run.seed = seed;
      },
      getState: () => this.getState(),
      profileStart: () => this.profiler.start(),
      profileStop: (): FrameStats => this.profiler.stop(),
      getPerf: () => ({
        musicPlaying: music.isPlaying(),
        musicMood: music.currentMood(),
        stickHeld: this.joystick.isActive(),
        fps: this.game.loop.actualFps,
        stepMs: this.profiler.lastSimMs,
        syncMs: this.profiler.lastSyncMs,
        renderMs: this.profiler.lastRenderMs,
        renderer: rendererString(this.game),
        activeSounds: sfx.activeCount(),
      }),
      toggleOverlay: () => {
        /* debug overlay lands with the HUD milestone */
      },
    };
    window.__game?.bindRun(handlers);
  }

  static readonly SIZE = { w: GAME_W, h: GAME_H };
}
