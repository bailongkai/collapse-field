import { FIXED_DT, FIXED_DT_MS, GAME_H, GAME_W, RUN_SECONDS } from '../../config';
import type { PlayerStats, StatKey } from '../../data/types';
import { CONTENT, characterDef, stageDef, type ContentRegistry } from '../content/registry';
import { composeStats } from '../stats/composeStats';
import { xpToReach } from '../stats/xpCurve';
import { World } from './world';
import { setPlayerInput, stepPlayer } from './systems/playerSystem';
import { applyKnockback, stepEnemies } from './systems/enemySystem';
import { stepSeparation } from './systems/separationSystem';
import { Spawner, spawnEnemy, spawnRingRadius, type SpawnOptions } from './systems/spawnSystem';
import { stepContact } from './systems/collisionSystem';
import { dropForEnemy } from './systems/dropSystem';
import { stepWeapons } from './systems/weaponSystem';
import { stepProjectiles } from './systems/projectileSystem';
import { stepGems, vacuumGems } from './systems/gemSystem';
import { EventScheduler } from './systems/eventSystem';
import { rollDrops, spawnPickup, stepPickups, type PickupCollected } from './systems/pickupSystem';
import { rollLevelUp } from '../levelup/roll';
import { auraRadius } from '../weapons/behaviors/aura';
import { weaponParams } from '../stats/weaponParams';
import { spawnGem } from './systems/dropSystem';
import type { GemTier } from '../../data/types';
import type { WeaponContext, WeaponInstance } from '../weapons/types';
import { ENEMY_CAP, WEAPON_SLOTS, PASSIVE_SLOTS } from '../../config';
import type { Enemy } from './entities/enemy';
import { PLAYER_BASE_SPEED } from '../../config';
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
  /** debug-hook overrides: each key forces that stat to an exact value */
  private forcedStats: Partial<Record<StatKey, number>> = {};
  private cachedStats: PlayerStats;
  private spawner = new Spawner();
  private events = new EventScheduler();
  private autopilot = false;
  private collected: PickupCollected[] = [];
  private weaponCtx: WeaponContext;

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
    this.weaponCtx = {
      rng: this.world.rng,
      tick: 0,
      player: this.world.player,
      stats: this.cachedStats,
      spawnProjectile: () => this.world.projectiles.spawn(),
      nearestEnemy: (x, y, maxDist) => this.world.nearestEnemy(x, y, maxDist),
      queryEnemies: (x0, y0, x1, y1, out) => this.world.grid.queryInto(x0, y0, x1, y1, out),
      enemyById: (id) => this.world.enemies.items[id],
      forEachProjectile: (slot, fn) => {
        const pool = this.world.projectiles;
        const alive = pool.aliveList();
        for (let i = 0; i < pool.count; i++) {
          const p = pool.items[alive[i]];
          if (p.weaponSlot === slot) fn(p);
        }
      },
      hitEnemy: (e, dmg, dirX, dirY, kb) => this.damageEnemy(e, dmg, dirX, dirY, kb),
    };
    this.giveWeapon(ch.startingWeapon, 1);
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
    const stats = composeStats(this.character, this.run.passives, this.reg, this.run.level);
    const forced = this.forcedStats;
    if (Object.keys(forced).length === 0) return stats;
    const out = { ...stats } as Record<StatKey, number>;
    for (const k of Object.keys(forced) as StatKey[]) out[k] = forced[k] as number;
    return out;
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

  /** Debug/test hook: pins a stat to an exact value until the run ends. */
  setStatOverride(key: StatKey, value: number): void {
    this.forcedStats[key] = value;
    this.refreshStats();
  }

  setInput(dx: number, dy: number): void {
    setPlayerInput(this.world.player, dx, dy);
  }

  /**
   * Hands the player over to a simple kiting policy: run away from the local crowd, with a slow
   * orbit blended in so the run does not degenerate into a straight line off the map. This is what
   * makes an unattended balance run mean something — a motionless player dies to any wave table.
   */
  setAutopilot(on: boolean): void {
    this.autopilot = on;
  }

  isAutopilot(): boolean {
    return this.autopilot;
  }

  private driveAutopilot(): void {
    const { world } = this;
    const p = world.player;

    // 1. back off only when something is actually about to touch us. A policy that simply flees
    //    outruns the whole horde (the player is faster than every chase enemy) and then never
    //    kills anything, which measures nothing.
    const danger = 90;
    const n = world.grid.queryInto(p.x - danger, p.y - danger, p.x + danger, p.y + danger, world.queryBuf);
    let awayX = 0;
    let awayY = 0;
    let threats = 0;
    for (let i = 0; i < n; i++) {
      const e = world.enemies.items[world.queryBuf[i]];
      if (!e.active) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1 || d2 > danger * danger) continue;
      const w = 1 / d2;
      awayX += dx * w;
      awayY += dy * w;
      threats++;
    }

    if (threats > 0) {
      const len = Math.hypot(awayX, awayY) || 1;
      setPlayerInput(p, awayX / len, awayY / len);
      return;
    }

    // 2. otherwise go and collect the nearest gem, which is what keeps a real run levelling
    let bestX = 0;
    let bestY = 0;
    let bestD2 = 600 * 600;
    let found = false;
    const gems = world.gems.aliveList();
    for (let i = 0; i < world.gems.count; i++) {
      const g = world.gems.items[gems[i]];
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestX = dx;
        bestY = dy;
        found = true;
      }
    }
    if (found) {
      const len = Math.hypot(bestX, bestY) || 1;
      setPlayerInput(p, bestX / len, bestY / len);
      return;
    }

    // 3. nothing to do: drift in a slow circle so fresh enemies keep walking into the weapons
    const angle = (this.run.tick / 60) * 0.5;
    setPlayerInput(p, Math.cos(angle), Math.sin(angle));
  }

  /** Advances one fixed tick. Returns false when the run is not running. */
  step(): boolean {
    if (this.run.phase !== 'running') return false;
    const dt = FIXED_DT;
    const { world, run } = this;
    const stage = this.stage;
    const stats = this.cachedStats;

    run.timeMs += FIXED_DT_MS;
    run.tick++;

    if (this.autopilot) this.driveAutopilot();
    stepPlayer(world.player, stats, dt);
    this.spawner.step(world, stage, run.timeMs, stats.curse, dt);
    if (this.events.step(world, stage, run.timeMs)) run.reaperSpawned = true;
    stepEnemies(world, world.player, dt, PLAYER_BASE_SPEED * stats.moveSpeed);
    world.rebuildGrid();
    stepSeparation(world, world.rng, GAME_W, GAME_H);

    this.weaponCtx.tick = run.tick;
    this.weaponCtx.stats = stats;
    this.weaponCtx.rng = world.rng;
    stepWeapons(world.weaponInstances, this.weaponCtx, FIXED_DT_MS);
    stepProjectiles(world, FIXED_DT_MS, (e, dmg, dx, dy, kb) => this.damageEnemy(e, dmg, dx, dy, kb));

    const contact = stepContact(world, stats, run.god, dt);
    if (contact.damage > 0 || contact.fatal) this.onPlayerHurt(contact.fatal);

    if (run.phase === 'running') {
      const harvest = stepGems(world, stats, dt, spawnRingRadius(stage) * stage.despawnFactor);
      if (harvest.xp > 0) this.addXp(harvest.xp * stats.growth);

      stepPickups(world, stats, dt, this.collected);
      for (const c of this.collected) this.applyPickup(c);
    }

    // the level-up overlay opens only once the tick is otherwise finished, and never over a corpse
    if (run.phase === 'running' && run.pendingLevelUps > 0) this.openLevelUp();

    run.hp = world.player.hp;
    return true;
  }

  /**
   * Death check. Reaching the fifteen-minute mark counts as surviving even though the reaper is
   * what finally kills you, which is how the timer resolves: it never ends the run on its own.
   */
  private onPlayerHurt(fatal: boolean): void {
    const { run, world } = this;
    if (world.player.hp > 0) return;
    if (!fatal && this.cachedStats.revival > run.revivalsUsed) {
      run.revivalsUsed++;
      world.player.hp = Math.round(this.cachedStats.maxHealth * 0.5);
      world.player.iframesMs = 2000;
      this.killAllOnScreen();
      world.events.push('revive', world.player.x, world.player.y, run.revivalsUsed);
      return;
    }
    world.player.hp = 0;
    run.hp = 0;
    run.phase = 'ended';
    const survived = run.timeMs >= RUN_SECONDS * 1000;
    run.ended = survived ? 'survived' : 'died';
    world.events.push(survived ? 'survived' : 'died', world.player.x, world.player.y, run.timeMs / 1000);
  }

  /** Damage entry point shared by every weapon; handles knockback, flash, death and drops. */
  damageEnemy(e: Enemy, dmg: number, dirX: number, dirY: number, knockback: number): void {
    const def = e.def;
    if (!def || def.invulnerable) return;
    const rounded = Math.max(1, Math.round(dmg));
    e.hp -= rounded;
    e.flashMs = 80;
    if (knockback > 0) applyKnockback(e, dirX, dirY, knockback * 240);
    this.world.events.push('hit', e.x, e.y, rounded, e.defId, rounded >= e.maxHp * 0.5);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy): void {
    if (!e.active || !e.def) return;
    const isBoss = e.behavior === 'boss';
    this.run.kills++;
    this.world.events.push('death', e.x, e.y, 0, e.defId, e.def.deathFx === 'big');
    dropForEnemy(this.world, e, this.stage.gemCap);
    rollDrops(this.world, e, this.world.rng, this.cachedStats.luck, this.reg.pickupList);
    if (isBoss) this.world.events.push('bossKilled', e.x, e.y, 0, e.defId, true);
    this.world.enemies.free(e);
  }

  /** Kills every vulnerable enemy currently on screen (EMP pickup, revival). */
  killAllOnScreen(): number {
    let killed = 0;
    this.world.enemies.forEach((e) => {
      if (e.def?.invulnerable) return;
      this.killEnemy(e);
      killed++;
    });
    return killed;
  }

  /** Applies a collected pickup's effect and emits the event the HUD and tests listen for. */
  private applyPickup(c: PickupCollected): void {
    const { world, run } = this;
    const effect = c.def.effect;
    switch (effect.kind) {
      case 'heal':
        world.player.hp = Math.min(this.cachedStats.maxHealth, world.player.hp + effect.amount);
        run.hp = world.player.hp;
        world.events.push('heal', c.x, c.y, effect.amount, c.def.id);
        break;
      case 'gold':
        run.gold += Math.round(effect.amount * this.cachedStats.greed);
        world.events.push('pickup', c.x, c.y, effect.amount, c.def.id);
        break;
      case 'vacuum':
        world.events.push('vacuum', c.x, c.y, vacuumGems(world), c.def.id);
        break;
      case 'nuke':
        world.events.push('nuke', c.x, c.y, this.killAllOnScreen(), c.def.id);
        break;
      case 'chest': {
        const upgraded = this.grantWeaponLevels(effect.weaponLevels);
        world.events.push('chest', c.x, c.y, upgraded, c.def.id, true);
        break;
      }
    }
  }

  /** Chest reward: raises random owned weapons that are not yet maxed. */
  private grantWeaponLevels(count: number): number {
    let granted = 0;
    for (let i = 0; i < count; i++) {
      const upgradable = this.run.weapons.filter((w) => w.level < this.reg.weapons[w.id].maxLevel);
      if (upgradable.length === 0) break;
      const pick = upgradable[this.world.rng.int(0, upgradable.length - 1)];
      this.giveWeapon(pick.id, pick.level + 1);
      granted++;
    }
    return granted;
  }

  /** Debug hook: place a pickup on the ground. */
  spawnPickup(defId: string, x?: number, y?: number): boolean {
    return spawnPickup(this.world, defId, x ?? this.world.player.x + 60, y ?? this.world.player.y);
  }

  /** Debug hook: collect a specific pickup regardless of distance. */
  collectPickup(id: number): boolean {
    const item = this.world.pickups.items[id];
    if (!item?.active) return false;
    item.x = this.world.player.x;
    item.y = this.world.player.y;
    return true;
  }

  /** Fires a stage event immediately, by index. */
  triggerEvent(index: number): boolean {
    return this.events.fireIndex(this.world, this.stage, index);
  }

  spawnBoss(): void {
    const index = this.stage.events.findIndex((e) => e.kind === 'boss');
    if (index >= 0) this.events.fireIndex(this.world, this.stage, index);
  }

  spawnReaper(): void {
    const index = this.stage.events.findIndex((e) => e.kind === 'reaper');
    if (index >= 0) {
      this.events.fireIndex(this.world, this.stage, index);
      this.run.reaperSpawned = true;
    }
  }

  despawnReaper(): void {
    this.world.enemies.forEach((e) => {
      if (e.behavior === 'reaper') this.world.enemies.free(e);
    });
    this.run.reaperSpawned = false;
  }

  /** Grants XP, levelling as many times as it covers; each level queues one level-up offer. */
  addXp(amount: number): void {
    const run = this.run;
    if (amount <= 0 || run.phase === 'ended') return;
    run.xp += amount;
    while (run.xp >= run.xpNext) {
      run.xp -= run.xpNext;
      run.level++;
      run.xpNext = xpToReach(run.level + 1);
      run.pendingLevelUps++;
      this.world.events.push('levelUp', this.world.player.x, this.world.player.y, run.level);
    }
    this.refreshStats();
  }

  /** Rolls the offer and freezes the simulation until a choice is applied. */
  openLevelUp(): void {
    const run = this.run;
    if (run.pendingLevelUps <= 0) return;
    run.choices = rollLevelUp({
      weapons: run.weapons,
      passives: run.passives,
      luck: this.cachedStats.luck,
      rng: this.world.rng,
      reg: this.reg,
    });
    run.phase = 'levelup';
    this.world.events.push('levelUpOpen', this.world.player.x, this.world.player.y, run.level);
  }

  /**
   * Applies one offered choice. If more level-ups are queued the offer is re-rolled in place,
   * otherwise the run resumes.
   */
  applyChoice(index: number): boolean {
    const run = this.run;
    const choices = run.choices;
    if (!choices || index < 0 || index >= choices.length) return false;
    const choice = choices[index];
    switch (choice.kind) {
      case 'weapon':
        this.giveWeapon(choice.id, choice.toLevel);
        break;
      case 'passive':
        this.givePassive(choice.id, choice.toLevel);
        break;
      case 'gold':
        run.gold += choice.amount;
        break;
      case 'heal':
        this.world.player.hp = Math.min(this.cachedStats.maxHealth, this.world.player.hp + choice.amount);
        run.hp = this.world.player.hp;
        break;
    }
    run.pendingLevelUps = Math.max(0, run.pendingLevelUps - 1);
    run.choices = null;
    if (run.pendingLevelUps > 0) this.openLevelUp();
    else if (run.phase === 'levelup') run.phase = 'running';
    return true;
  }

  /** Sets the run level directly (debug hook); does not queue offers. */
  setLevel(level: number): void {
    const run = this.run;
    run.level = Math.max(1, Math.floor(level));
    run.xp = 0;
    run.xpNext = xpToReach(run.level + 1);
    this.refreshStats();
  }

  /** Debug hook: drop `n` gems of a tier near the player. */
  spawnGems(n: number, tier: Exclude<GemTier, 'none'> = 'blue', o: { x?: number; y?: number } = {}): void {
    const value = tier === 'red' ? 5 : tier === 'green' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const r = 120 + (i % 7) * 30;
      spawnGem(
        this.world,
        o.x ?? this.world.player.x + Math.cos(a) * r,
        o.y ?? this.world.player.y + Math.sin(a) * r,
        value,
        tier,
        this.stage.gemCap,
      );
    }
  }

  /** The boss currently on the field, if any, for the HUD's health bar. */
  bossStatus(): { name: string; hp: number; maxHp: number } | null {
    const alive = this.world.enemies.aliveList();
    for (let i = 0; i < this.world.enemies.count; i++) {
      const e = this.world.enemies.items[alive[i]];
      if (e.def?.bossBar) return { name: e.def.nameKey, hp: e.hp, maxHp: e.maxHp };
    }
    return null;
  }

  /** Radius of the EMP field for the current build, or 0 when the weapon is not owned. */
  auraRadius(): number {
    const owned = this.run.weapons.find((w) => this.reg.weapons[w.id]?.behavior === 'aura');
    if (!owned) return 0;
    const def = this.reg.weapons[owned.id];
    const params = weaponParams(def, owned.level);
    return auraRadius(params.area * this.cachedStats.area);
  }

  vacuum(): number {
    return vacuumGems(this.world);
  }

  /** Adds a weapon or raises it to `level`, capped at the weapon's maximum and the slot count. */
  giveWeapon(id: string, level = 1): boolean {
    const def = this.reg.weapons[id];
    if (!def) throw new Error(`unknown weapon: ${id}`);
    const target = Math.min(level, def.maxLevel);
    const owned = this.run.weapons.find((w) => w.id === id);
    if (owned) {
      owned.level = Math.max(owned.level, target);
    } else {
      if (this.run.weapons.length >= WEAPON_SLOTS) return false;
      this.run.weapons.push({ id, level: target });
      const inst: WeaponInstance = {
        defId: id,
        slot: this.run.weapons.length - 1,
        level: target,
        cooldownLeft: 0,
        volleyLeft: 0,
        volleyTimer: 0,
        activeCount: 0,
        lastHitTick: new Int32Array(ENEMY_CAP).fill(-1e9),
      };
      this.world.weaponInstances.push(inst);
    }
    const inst = this.world.weaponInstances.find((i) => i.defId === id);
    if (inst) inst.level = Math.max(inst.level, target);
    this.refreshStats();
    return true;
  }

  /** Adds a passive or raises it to `level`, capped at its maximum and the slot count. */
  givePassive(id: string, level = 1): boolean {
    const def = this.reg.passives[id];
    if (!def) throw new Error(`unknown passive: ${id}`);
    const target = Math.min(level, def.maxLevel);
    const owned = this.run.passives.find((p) => p.id === id);
    if (owned) owned.level = Math.max(owned.level, target);
    else {
      if (this.run.passives.length >= PASSIVE_SLOTS) return false;
      this.run.passives.push({ id, level: target });
    }
    this.refreshStats();
    return true;
  }

  /** Test/debug helper: place `n` enemies of `defId`, on the off-screen ring by default. */
  spawn(defId: string, n: number, o: { ring?: boolean; radius?: number | 'offscreen'; x?: number; y?: number } = {}): number {
    const stage = this.stage;
    const ringR = spawnRingRadius(stage);
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      let opts: SpawnOptions;
      if (o.x !== undefined || o.y !== undefined) {
        opts = { x: o.x, y: o.y };
      } else {
        const radius = o.radius === 'offscreen' || o.radius === undefined ? (o.ring === false ? 200 : ringR) : o.radius;
        const a = (i / Math.max(1, n)) * Math.PI * 2 + this.world.rng.next() * 0.1;
        opts = { x: this.world.player.x + Math.cos(a) * radius, y: this.world.player.y + Math.sin(a) * radius };
      }
      if (!spawnEnemy(this.world, defId, opts)) break;
      spawned++;
    }
    return spawned;
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
    // events already in the past must not all fire at once on the next tick
    this.events.skipTo(this.stage, sec);
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
