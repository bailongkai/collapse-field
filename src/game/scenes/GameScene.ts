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
import { Profiler } from '../../debug/profiler';
import type { FrameStats, HookRunState, RunHandlers } from '../../debug/hook';
import { rendererString } from '../../debug/hook';
import { sfx } from '../audio/sfx';
import { app } from '../app';

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
  private profiler = new Profiler();
  private accumulator = 0;
  private timeScale = 1;
  private layers!: Record<'floor' | 'decor' | 'gems' | 'pickups' | 'enemies' | 'player' | 'projectiles' | 'fx' | 'numbers', Phaser.GameObjects.Layer>;

  constructor() {
    super('Game');
  }

  create(data: GameSceneData): void {
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

  resumeFromPause(): void {
    this.accumulator = 0;
    this.input_.reset();
    this.sim.resume();
    sfx.resumeAll();
  }

  override update(_time: number, delta: number): void {
    const run = this.sim.run;
    if (run.phase === 'running') {
      const dir = this.input_.read();
      this.sim.setInput(dir.x, dir.y);
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

    if (run.phase === 'ended') this.finishRun();
  }

  private finishRun(): void {
    const run = this.sim.run;
    const summary = { timeSec: run.timeMs / 1000, kills: run.kills, level: run.level, gold: run.gold, ended: run.ended ?? 'died' };
    this.scene.start('Results', summary);
  }

  private syncViews(deltaMs: number): void {
    const cam = this.cameras.main;
    const p = this.sim.world.player;
    this.playerView.update(p, this.sim.run.hp, this.sim.stats.maxHealth, deltaMs);
    this.floorView.update(cam.midPoint.x, cam.midPoint.y, cam.scrollX, cam.scrollY);
    this.sim.world.events.clear();
  }

  // --- debug hook ------------------------------------------------------------
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
      counts: { enemies: w.enemies.count, projectiles: w.projectiles.count, gems: w.gems.count, pickups: w.pickups.count, dmgNumbers: 0 },
      pickups: [],
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
      pause: () => {
        this.sim.pause();
      },
      resume: () => {
        this.resumeFromPause();
      },
      setTimeScale: (n: number) => {
        this.timeScale = Math.max(0, n);
      },
      step: (ticks: number) => {
        const done = this.sim.stepMany(ticks);
        this.syncViews(ticks * FIXED_DT_MS);
        return done;
      },
      fastForward: async (sec: number, o = {}) => {
        const budgetMs = o.budgetMs ?? 240_000;
        const total = Math.round(sec * 60);
        const started = performance.now();
        let done = 0;
        while (done < total) {
          const chunk = Math.min(600, total - done);
          const ran = this.sim.stepMany(chunk);
          done += chunk;
          if (ran < chunk) break;
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
      setPlayerPos: (x: number, y: number) => {
        this.sim.world.player.x = x;
        this.sim.world.player.y = y;
      },
      spawn: () => this.notImplemented('spawn'),
      spawnBoss: () => this.notImplemented('spawnBoss'),
      spawnReaper: () => this.notImplemented('spawnReaper'),
      despawnReaper: () => this.notImplemented('despawnReaper'),
      killAll: () => this.notImplemented('killAll'),
      clearEnemies: () => this.sim.world.enemies.clear(),
      triggerEvent: () => this.notImplemented('triggerEvent'),
      spawnGems: () => this.notImplemented('spawnGems'),
      spawnPickup: () => this.notImplemented('spawnPickup'),
      collectPickup: () => this.notImplemented('collectPickup'),
      giveWeapon: () => this.notImplemented('giveWeapon'),
      givePassive: () => this.notImplemented('givePassive'),
      setLevel: () => this.notImplemented('setLevel'),
      addXp: () => this.notImplemented('addXp'),
      triggerLevelUp: () => this.notImplemented('triggerLevelUp'),
      getChoices: () => this.sim.run.choices,
      pickChoice: () => this.notImplemented('pickChoice'),
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
