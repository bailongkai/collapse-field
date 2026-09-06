import { FIXED_DT, FIXED_DT_MS, RUN_SECONDS } from '../../config';
import type { PlayerStats, StatBlock, StatKey } from '../../data/types';
import { CONTENT, characterDef, stageDef, type ContentRegistry } from '../content/registry';
import { composeStats } from '../stats/composeStats';
import { xpToReach } from '../stats/xpCurve';
import { World } from './world';
import { setPlayerInput, stepPlayer } from './systems/playerSystem';
import type { LevelUpChoice, OwnedItem, RunEnd, RunPhase } from './runState';

export interface SimulationOptions {
  seed: number;
  characterId: string;
  stageId: string;
}

export interface RunState {
  seed: number;
  characterId: string;
  stageId: string;
  timeMs: number;
  tick: number;
  phase: RunPhase;
  hp: number;
  level: number;
  xp: number;
  xpNext: number;
  kills: number;
  gold: number;
  revivalsUsed: number;
  weapons: OwnedItem[];
  passives: OwnedItem[];
  pendingLevelUps: number;
  choices: LevelUpChoice[] | null;
  reaperSpawned: boolean;
  ended?: RunEnd;
  god: boolean;
}

/**
 * The whole game rules engine: a deterministic, Phaser-free, fixed-step simulation. `step()` only
 * advances while the run is 'running', so pausing and the level-up overlay freeze time by
 * construction and `getState()` can never disagree with what the player sees.
 */
export class Simulation {
  readonly world: World;
  readonly reg: ContentRegistry = CONTENT;
  readonly run: RunState;
  /** extra stat block applied by the debug hook's setStat */
  private statOverrides: Record<string, number> = {};
  private cachedStats: PlayerStats;

  constructor(opts: SimulationOptions) {
    this.world = new World(opts.seed);
    const ch = characterDef(opts.characterId);
    this.run = {
      seed: opts.seed,
      characterId: opts.characterId,
      stageId: opts.stageId,
      timeMs: 0,
      tick: 0,
      phase: 'running',
      hp: ch.baseStats.maxHealth,
      level: 1,
      xp: 0,
      xpNext: xpToReach(2),
      kills: 0,
      gold: 0,
      revivalsUsed: 0,
      weapons: [],
      passives: [],
      pendingLevelUps: 0,
      choices: null,
      reaperSpawned: false,
      god: false,
    };
    this.cachedStats = this.computeStats();
    this.world.player.hp = this.cachedStats.maxHealth;
  }

  get stats(): PlayerStats {
    return this.cachedStats;
  }

  get stage() {
    return stageDef(this.run.stageId);
  }

  get character() {
    return characterDef(this.run.characterId);
  }

  private computeStats(): PlayerStats {
    return composeStats(this.character, this.run.passives, this.reg, this.run.level, this.statOverrides as StatBlock);
  }

  /** Recomputes derived stats after a build change; keeps current HP but respects the new maximum. */
  refreshStats(): void {
    const prevMax = this.cachedStats.maxHealth;
    this.cachedStats = this.computeStats();
    const gained = this.cachedStats.maxHealth - prevMax;
    if (gained > 0) this.world.player.hp = Math.min(this.cachedStats.maxHealth, this.world.player.hp + gained);
    this.world.player.hp = Math.min(this.world.player.hp, this.cachedStats.maxHealth);
    this.run.hp = this.world.player.hp;
  }

  setStatOverride(key: StatKey, value: number): void {
    this.statOverrides[key] = value;
    this.refreshStats();
  }

  setInput(dx: number, dy: number): void {
    setPlayerInput(this.world.player, dx, dy);
  }

  /** Advances one fixed tick. Returns false when the run is not running. */
  step(): boolean {
    if (this.run.phase !== 'running') return false;
    const dt = FIXED_DT;
    const { world, run } = this;

    run.timeMs += FIXED_DT_MS;
    run.tick++;

    stepPlayer(world.player, this.cachedStats, dt);

    world.rebuildGrid();

    run.hp = world.player.hp;

    if (run.timeMs >= RUN_SECONDS * 1000 && !run.reaperSpawned) {
      // the reaper event itself is added in M7; until then the timer simply ends the run
      run.phase = 'ended';
      run.ended = 'survived';
      world.events.push('survived', world.player.x, world.player.y, run.timeMs / 1000);
    }
    return true;
  }

  /** Runs `n` ticks, stopping early if the run leaves the running phase. Returns ticks executed. */
  stepMany(n: number): number {
    let done = 0;
    for (let i = 0; i < n; i++) {
      if (!this.step()) break;
      done++;
    }
    return done;
  }

  setTime(sec: number): void {
    this.run.timeMs = Math.max(0, sec * 1000);
  }

  pause(): void {
    if (this.run.phase === 'running') this.run.phase = 'paused';
  }

  resume(): void {
    if (this.run.phase === 'paused') this.run.phase = 'running';
  }

  endRun(cause: RunEnd): void {
    if (this.run.phase === 'ended') return;
    this.run.phase = 'ended';
    this.run.ended = cause;
    this.world.events.push(cause === 'died' ? 'died' : 'survived', this.world.player.x, this.world.player.y, this.run.timeMs / 1000);
  }
}
