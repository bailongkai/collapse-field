import Phaser from 'phaser';
import { FIXED_DT_MS, GAME_H, GAME_W, MAX_FRAME_DELTA_MS, MAX_STEPS_PER_FRAME } from '../../config';
import { Simulation } from '../../core/sim/simulation';
import { DEFAULT_CHARACTER_ID } from '../../data/characters';
import { DEFAULT_STAGE_ID } from '../../data/stages';
import type { EnemyBehaviorId, StatKey } from '../../data/types';
import type { RunEnd } from '../../core/sim/runState';
import { InputController } from '../input/inputController';
import { FloorView } from '../view/floorView';
import { PlayerView } from '../view/playerView';
import { EnemyView } from '../view/enemyView';
import { GemView } from '../view/gemView';
import { PickupView } from '../view/pickupView';
import { ProjectileView } from '../view/projectileView';
import { DamageNumbers } from '../view/damageNumbers';
import { FxView } from '../view/fxView';
import { Profiler } from '../../debug/profiler';
import type { FrameStats, HookRunState, RunHandlers } from '../../debug/hook';
import { rendererString } from '../../debug/hook';
import { sfx } from '../audio/sfx';
import { app } from '../app';
import { t } from '../../i18n';
import type { HudScene } from './HudScene';

export interface GameSceneData {
  seed?: number;
  characterId?: string;
  stageId?: string;
}

/** Owns the Simulation, drives it with a fixed-step accumulator and mirrors it into pooled views. */
export class GameScene extends Phaser.Scene {
  sim!: Simulation;
  private input_!: InputController;
  private floorView!: FloorView;
  private playerView!: PlayerView;
  private enemyView!: EnemyView;
  private gemView!: GemView;
  private pickupView!: PickupView;
  private projectileView!: ProjectileView;
  private damageNumbers!: DamageNumbers;
  private fxView!: FxView;
  private profiler = new Profiler();
  private accumulator = 0;
  private levelUpPending = false;
  private timeScale = 1;
  private layers!: Record<'floor' | 'decor' | 'gems' | 'pickups' | 'enemies' | 'player' | 'projectiles' | 'fx' | 'numbers', Phaser.GameObjects.Layer>;

  constructor() {
    super('Game');
  }

  create(data: GameSceneData): void {
    // the scene instance is reused between runs, so every per-run field is reset here
    this.accumulator = 0;
    this.timeScale = 1;
    this.levelUpPending = false;
    this.slotCache = [];

    const seed = data.seed ?? app().seed ?? (Date.now() >>> 0);
    this.sim = new Simulation({
      seed,
      characterId: data.characterId ?? DEFAULT_CHARACTER_ID,
      stageId: data.stageId ?? DEFAULT_STAGE_ID,
    });

    this.cameras.main.setBackgroundColor('#05070c');
    this.layers = {
      floor: this.add.layer(), decor: this.add.layer(), gems: this.add.layer(), pickups: this.add.layer(),
      enemies: this.add.layer(), player: this.add.layer(), projectiles: this.add.layer(), fx: this.add.layer(),
      numbers: this.add.layer(),
    };
    let depth = 0;
    for (const key of ['floor', 'decor', 'gems', 'pickups', 'enemies', 'player', 'projectiles', 'fx', 'numbers'] as const) {
      this.layers[key].setDepth(depth++);
    }

    this.floorView = new FloorView(this, this.sim.stage, this.layers.floor, this.layers.decor);
    this.playerView = new PlayerView(this, this.sim.character, this.layers.player);
    this.enemyView = new EnemyView(this, this.layers.enemies);
    this.gemView = new GemView(this, this.layers.gems);
    this.pickupView = new PickupView(this, this.layers.pickups);
    this.projectileView = new ProjectileView(this, this.layers.projectiles, this.layers.fx);
    this.damageNumbers = new DamageNumbers(this, this.layers.numbers);
    this.fxView = new FxView(this, this.layers.fx);
    this.input_ = new InputController(this);

    this.cameras.main.startFollow(this.playerView.gameObject, true, 0.12, 0.12);
    this.cameras.main.centerOn(0, 0);

    this.scene.launch('Hud');
    this.profiler.attach(this.game);
    this.bindHook();

    this.input.keyboard?.on('keydown-ESC', () => this.openPause());
    this.input.keyboard?.on('keydown-P', () => this.openPause());
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  private onHidden = (): void => {
    if (this.scene.isActive() && this.sim.run.phase === 'running') this.openPause();
  };

  /** Single teardown path: stops child scenes, detaches the profiler and unbinds the debug hook. */
  private teardown(): void {
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden);
    this.scene.stop('Hud');
    this.scene.stop('LevelUp');
    this.scene.stop('Pause');
    this.profiler.detach();
    window.__game?.detach();
    this.floorView.destroy();
    this.playerView.destroy();
    this.enemyView.destroy();
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
    this.cameras.main.flash(200, 90, 200, 255);
    sfx.play('levelup');
    this.time.delayedCall(250, () => {
      this.levelUpPending = false;
      if (this.sim.run.phase !== 'levelup') return;
      this.scene.launch('LevelUp');
      this.scene.bringToTop('LevelUp');
    });
  }

  /** Called by the overlay; applies the pick and closes or re-rolls in place. */
  applyLevelUpChoice(index: number): boolean {
    if (!this.sim.applyChoice(index)) return false;
    this.scene.stop('LevelUp');
    if (this.sim.run.phase === 'levelup') this.openLevelUpOverlay();
    return true;
  }

  override update(_time: number, delta: number): void {
    const run = this.sim.run;
    if (run.phase === 'running') {
      // the autopilot writes the input inside the simulation; real input must not fight it
      if (!this.sim.isAutopilot()) {
        const dir = this.input_.read();
        this.sim.setInput(dir.x, dir.y);
      }
      this.accumulator += Math.min(delta, MAX_FRAME_DELTA_MS) * this.timeScale;
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

    const syncStart = performance.now();
    this.syncViews(delta);
    this.profiler.markSync(performance.now() - syncStart);
    this.profiler.endFrame();

    if (run.phase === 'levelup') this.openLevelUpOverlay();
    if (run.phase === 'ended') this.finishRun();
  }

  private finishRun(): void {
    const run = this.sim.run;
    this.scene.start('Results', {
      timeSec: run.timeMs / 1000,
      kills: run.kills,
      level: run.level,
      gold: run.gold,
      ended: run.ended ?? 'died',
      weapons: run.weapons.map((w) => ({ ...w })),
      passives: run.passives.map((p) => ({ ...p })),
      seed: run.seed,
    });
  }

  private syncViews(deltaMs: number): void {
    // a run can end mid-batch, which starts the results scene and tears this one down; the
    // trailing sync of that batch must not touch destroyed cameras or views
    if (!this.scene.isActive() || !this.cameras?.main) return;
    const cam = this.cameras.main;
    const p = this.sim.world.player;
    this.playerView.update(p, this.sim.run.hp, this.sim.stats.maxHealth, deltaMs);
    this.floorView.update(cam.midPoint.x, cam.midPoint.y, cam.scrollX, cam.scrollY);
    this.enemyView.sync(this.sim.world, cam.midPoint.x, cam.midPoint.y);
    this.gemView.sync(this.sim.world, cam.midPoint.x, cam.midPoint.y);
    this.pickupView.sync(this.sim.world, this.sim.run.timeMs);
    this.projectileView.sync(this.sim.world, this.weaponIdBySlot(), cam.midPoint.x, cam.midPoint.y);
    this.fxView.updateAura(p.x, p.y, this.sim.auraRadius(), deltaMs);
    this.pumpEvents(true);
    this.damageNumbers.update(deltaMs);
  }

  private toast(text: string): void {
    const hud = this.scene.get('Hud') as HudScene | undefined;
    hud?.showToast(text);
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
        case 'reaper':
          hook?.pushEvent('reaper');
          break;
        case 'rush':
          hook?.pushEvent('rush');
          break;
        case 'chest':
          hook?.pushEvent('pickup:chest');
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
        default:
          break;
      }
      if (!visual) continue;
      switch (e.type) {
        case 'hurt':
          this.playerView.flashHurt();
          this.cameras.main.shake(150, 0.006);
          sfx.play('hurt');
          break;
        case 'death':
          this.fxView.death(e.x, e.y, e.big);
          sfx.play(e.big ? 'explode' : 'death');
          break;
        case 'hit':
          this.damageNumbers.spawn(e.x, e.y - 12, e.n, e.big);
          if (e.big) this.cameras.main.shake(120, 0.004);
          sfx.play('hit');
          break;
        case 'bossSpawned':
          this.toast(t('toast.boss'));
          this.cameras.main.shake(400, 0.008);
          sfx.play('boss');
          break;
        case 'reaper':
          this.toast(t('toast.reaper'));
          this.cameras.main.shake(600, 0.01);
          sfx.play('boss');
          break;
        case 'chest':
          this.toast(t('toast.chest', { n: e.n }));
          sfx.play('levelup');
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
    return { chase: 0, line: 0, boss: 0, reaper: 0 };
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
      reaperSpawned: run.reaperSpawned,
      ended: run.ended,
    };
  }

  private notImplemented(name: string): never {
    throw new Error(`__game.${name}() is not implemented yet at this milestone`);
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
      setPlayerPos: (x: number, y: number) => {
        this.sim.world.player.x = x;
        this.sim.world.player.y = y;
      },
      spawn: (id: string, n: number, o) => this.sim.spawn(id, n, o),
      spawnBoss: () => this.sim.spawnBoss(),
      spawnReaper: () => this.sim.spawnReaper(),
      despawnReaper: () => this.sim.despawnReaper(),
      killAll: () => {
        this.sim.killAllOnScreen();
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
