import { FIXED_DT, FIXED_DT_MS, MAX_ENEMY_RADIUS, REF_AREA, REF_H, REF_W } from '../../config';
import type { PlayerStats, StatBlock, StatKey } from '../../data/types';
import { CONTENT, characterDef, stageDef, type ContentRegistry } from '../content/registry';
import { composeStats } from '../stats/composeStats';
import { xpToReach } from '../stats/xpCurve';
import { World } from './world';
import { setPlayerInput, stepPlayer } from './systems/playerSystem';
import { applyKnockback, stepEnemies } from './systems/enemySystem';
import { stepSeparation } from './systems/separationSystem';
import { Spawner, spawnEnemy, spawnRing, spawnRingRadius, type SpawnOptions } from './systems/spawnSystem';
import { applyPlayerDamage, stepContact } from './systems/collisionSystem';
import { dropForEnemy } from './systems/dropSystem';
import { stepWeapons } from './systems/weaponSystem';
import { stepProjectiles } from './systems/projectileSystem';
import { stepGems, vacuumGems } from './systems/gemSystem';
import { EventScheduler } from './systems/eventSystem';
import { rollDrops, spawnPickup, stepPickups, type PickupCollected } from './systems/pickupSystem';
import { rollLevelUp } from '../levelup/roll';
import { rollChestRewards, type ChestGrade } from '../levelup/chest';
import { CHEST_CONSOLATION_GOLD } from '../../config';
import { driveAutopilot } from './autopilot';
import { resolveCircle } from './obstacles';
import { bulwarkScale } from '../enemies/behaviors/bulwark';
import { bossArmourScale } from '../enemies/behaviors/bossExtras';
import { inBlast } from '../enemies/behaviors/bomber';
import { createSignature, onSignatureCrowd, onSignatureTurn, signatureBonus, signatureStep, onSignatureChest, onSignatureHurt, onSignatureKill, type SignatureState } from './signature';
import { auraRadius } from '../weapons/behaviors/aura';
import { weaponParams } from '../stats/weaponParams';
import { spawnGem } from './systems/dropSystem';
import type { GemTier } from '../../data/types';
import type { WeaponContext, WeaponInstance } from '../weapons/types';
import { ENEMY_CAP, WEAPON_SLOTS, PASSIVE_SLOTS } from '../../config';
import type { Enemy } from './entities/enemy';
import { PLAYER_RADIUS } from '../../config';
import type { ChestResult, LevelUpChoice, OwnedItem, RunEnd, RunPhase } from './runState';

export interface SimulationOptions {
  seed: number;
  characterId: string;
  stageId: string;
  /**
   * The world area the player can see, in world pixels. Wave density, the spawn ring and how far a
   * gem may drift all derive from it, so a wider display gets a proportionally bigger crowd rather
   * than an easier run. Defaults to the reference view the content is authored against.
   */
  viewW?: number;
  viewH?: number;
  /** permanent bonuses from the save's upgrades, applied like an extra passive */
  metaBonuses?: StatBlock;
  /** rerolls, skips and banishes the save has bought, spent over the run */
  charges?: { reroll: number; skip: number; banish: number };
  /**
   * A challenge the player opted into on the launch screen: the fraction added to curse, and to
   * experience and gold in return. More bodies, tougher and sooner, for a bigger payout.
   */
  curse?: number;
  /** weapon and passive ids the level-up offer must not show: not yet earned */
  lockedItems?: readonly string[];
  /**
   * Whether death should pause on an offer rather than end the run at once. The view sets it when
   * a rewarded ad can be shown; headless runs never do, so the balance harness never sees it.
   */
  adRevive?: boolean;
}

export interface RunState {
  seed: number;
  characterId: string;
  stageId: string;
  /** the challenge fraction the run was started with, for the results screen */
  curse: number;
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
  /** level-up agency: rerolls, skips and banishes left this run, and what has been banished */
  rerolls: number;
  skips: number;
  banishes: number;
  banished: string[];
  /** items the save has not earned yet; treated like banished for the offer */
  locked: string[];
  bossKills: number;
  /** damage dealt per weapon slot, for the results breakdown */
  damageBySlot: number[];
  /** whether the one ad revive this run allows has been offered already */
  adReviveOffered: boolean;
  adRevived: boolean;
  /** chests opened and already applied, waiting for the view to play their reveal */
  chestQueue: ChestResult[];
  /** how many chests this run has opened, for the results screen */
  chestsOpened: number;
  finalSpawned: boolean;
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
  private adRevive: boolean;
  private viewW: number;
  private viewH: number;
  /** experience per gem is divided by the visible-area factor densityScale multiplies bodies by */
  private xpScale = 1;
  private metaBonuses: StatBlock;
  private collected: PickupCollected[] = [];
  private detonated: Enemy[] = [];
  private weaponCtx: WeaponContext;
  /** the character's signature ability: timers and charges */
  readonly signature: SignatureState;

  constructor(opts: SimulationOptions) {
    this.viewW = opts.viewW ?? REF_W;
    this.viewH = opts.viewH ?? REF_H;
    this.xpScale = Math.min(1, REF_AREA / (this.viewW * this.viewH));
    this.adRevive = opts.adRevive ?? false;
    const curse = opts.curse ?? 0;
    this.metaBonuses = { ...(opts.metaBonuses ?? {}) };
    if (curse > 0) {
      const mb = this.metaBonuses as Record<string, number>;
      mb.curse = (mb.curse ?? 0) + curse;
      mb.growth = (mb.growth ?? 0) + curse;
      mb.greed = (mb.greed ?? 0) + curse;
    }
    this.world = new World(opts.seed);
    const ch = characterDef(opts.characterId);
    this.run = {
      seed: opts.seed,
      characterId: opts.characterId,
      stageId: opts.stageId,
      curse: opts.curse ?? 0,
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
      rerolls: opts.charges?.reroll ?? 0,
      skips: opts.charges?.skip ?? 0,
      banishes: opts.charges?.banish ?? 0,
      banished: [],
      locked: [...(opts.lockedItems ?? [])],
      bossKills: 0,
      damageBySlot: [],
      adReviveOffered: false,
      adRevived: false,
      chestQueue: [],
      chestsOpened: 0,
      finalSpawned: false,
      god: false,
    };
    this.signature = createSignature(ch.signature);
    for (const r of this.stage.relics ?? []) spawnPickup(this.world, r.pickup, r.x, r.y);
    this.world.obstacles = (this.stage.obstacles ?? []).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    this.cachedStats = this.computeStats();
    this.world.player.hp = this.cachedStats.maxHealth;
    this.world.player.shieldCharges = this.signature.shieldReady ? 1 : 0;
    this.weaponCtx = {
      rng: this.world.rng,
      tick: 0,
      player: this.world.player,
      stats: this.cachedStats,
      spawnProjectile: () => this.world.projectiles.spawn(),
      events: this.world.events,
      nearestEnemy: (x, y, maxDist) => this.world.nearestEnemy(x, y, maxDist),
      volleyTarget: (x, y, maxDist, index) => this.world.volleyTarget(x, y, maxDist, index),
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
      hitEnemy: (e, dmg, dirX, dirY, kb, src) => this.damageEnemy(e, dmg, dirX, dirY, kb, src.slot),
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
    const bonus = signatureBonus(this.signature, this.character.signature);
    const extra: StatBlock = bonus ? { ...this.metaBonuses } : this.metaBonuses;
    if (bonus) for (const k of Object.keys(bonus) as StatKey[]) (extra as Record<StatKey, number>)[k] = ((extra as Record<StatKey, number>)[k] ?? 0) + (bonus[k] ?? 0);
    const stats = composeStats(this.character, this.run.passives, this.reg, this.run.level, extra);
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
  /** The visible world area. Changing it re-scales wave density from the next tick onwards. */
  setViewSize(width: number, height: number): void {
    this.viewW = Math.max(320, width);
    this.viewH = Math.max(240, height);
    this.xpScale = Math.min(1, REF_AREA / (this.viewW * this.viewH));
  }

  getViewSize(): { width: number; height: number } {
    return { width: this.viewW, height: this.viewH };
  }

  setAutopilot(on: boolean): void {
    this.autopilot = on;
  }

  isAutopilot(): boolean {
    return this.autopilot;
  }

  /** Advances one fixed tick. Returns false when the run is not running. */
  step(): boolean {
    if (this.run.phase !== 'running') return false;
    const dt = FIXED_DT;
    const { world, run } = this;
    const stage = this.stage;
    let stats = this.cachedStats;

    run.timeMs += FIXED_DT_MS;
    run.tick++;

    if (this.autopilot) driveAutopilot(this.world, run.tick);
    const facingBefore = world.player.facing;
    stepPlayer(world.player, stats, dt);
    if (world.obstacles.length > 0 && resolveCircle(world.obstacles, world.player.x, world.player.y, PLAYER_RADIUS, this.scratch)) {
      world.player.x = this.scratch.x;
      world.player.y = this.scratch.y;
    }
    this.spawner.step(world, stage, run.timeMs, stats.curse, dt, this.viewW, this.viewH);
    if (this.events.step(world, stage, run.timeMs, this.viewW, this.viewH)) run.finalSpawned = true;
    stepEnemies(world, world.player, dt, this.detonated);
    for (const b of this.detonated) this.detonate(b);
    // set pieces queue their area damage rather than dealing it: armor, i-frames and god mode are
    // the simulation's to apply, and a boss that bypassed them would be a bug nobody could see
    for (const blast of world.blasts) {
      const bx = world.player.x - blast.x;
      const by = world.player.y - blast.y;
      if (bx * bx + by * by > blast.radius * blast.radius) continue;
      if (applyPlayerDamage(world, stats, run.god, blast.damage, blast.id) > 0) this.onPlayerHurt(false);
    }
    world.blasts.length = 0;
    world.rebuildGrid();
    stepSeparation(world, world.rng, this.viewW, this.viewH);
    if (world.obstacles.length > 0) this.keepEnemiesOutOfWalls();

    // The about-face is judged after the grid is rebuilt, against this tick's bodies rather than
    // last tick's, and the refreshed stats are handed to the weapons below — otherwise the bonus a
    // turn earned could never reach the shot that same turn fires, which is the whole ability.
    const sig = this.character.signature;
    if (sig.kind === 'reversal' && world.player.facing !== facingBefore) {
      if (onSignatureTurn(this.signature, sig, this.countInArc(sig.range, sig.arcDeg))) {
        this.refreshStats();
        stats = this.cachedStats;
        world.events.push('signature', world.player.x, world.player.y, 0, run.characterId, true);
      }
    }
    // the crowd is counted once a tick and handed to the stacking signature; it is the one ability
    // whose value is read rather than triggered
    if (sig.kind === 'pressure' && onSignatureCrowd(this.signature, sig, this.countNear(sig.radius))) {
      this.refreshStats();
      stats = this.cachedStats;
    }

    this.weaponCtx.tick = run.tick;
    this.weaponCtx.stats = stats;
    this.weaponCtx.rng = world.rng;
    stepWeapons(world.weaponInstances, this.weaponCtx, FIXED_DT_MS);
    stepProjectiles(
      world,
      FIXED_DT_MS,
      (e, dmg, dx, dy, kb, slot) => this.damageEnemy(e, dmg, dx, dy, kb, slot),
      (raw, source) => {
        if (applyPlayerDamage(world, stats, run.god, raw, source) > 0) this.onPlayerHurt(false);
      },
    );

    const contact = stepContact(world, stats, run.god);
    if (contact.enemyId >= 0) {
      const toucher = world.enemies.items[contact.enemyId];
      // a mine or bomber that is touched goes off at once; the fuse was for the ones that chase
      if (toucher.active && toucher.behavior === 'bomber') this.detonate(toucher);
    }
    if (contact.damage > 0 || contact.fatal) this.onPlayerHurt(contact.fatal);

    if (signatureStep(this.signature, this.character.signature, world.player, stats, FIXED_DT_MS)) this.refreshStats();

    if (run.phase === 'running') {
      const harvest = stepGems(world, stats, dt, spawnRingRadius(stage, this.viewW, this.viewH) * stage.despawnFactor);
      // densityScale gives a wider view proportionally more bodies so it is not an easier run; the
      // experience those bodies drop is scaled back by the same factor so it is not a faster one.
      // Measured before this: a 1760-wide view ended a median three levels above the reference.
      if (harvest.xp > 0) this.addXp(harvest.xp * stats.growth * this.xpScale);

      stepPickups(world, stats, dt, spawnRingRadius(stage, this.viewW, this.viewH) * stage.despawnFactor, this.collected);
      for (const c of this.collected) this.applyPickup(c);
    }

    // the level-up overlay opens only once the tick is otherwise finished, and never over a corpse
    if (run.phase === 'running' && run.pendingLevelUps > 0) this.openLevelUp();

    run.hp = world.player.hp;
    return true;
  }

  /**
   * Death check. The timer never ends a run on its own: fifteen minutes brings the final boss, and
   * only its death is a clear. Dying after the mark is still dying, with the results saying how
   * far that was.
   */
  private onPlayerHurt(fatal: boolean): void {
    const { run, world } = this;
    if (!fatal && onSignatureHurt(this.signature, this.character.signature, world.player, this.cachedStats)) {
      this.refreshStats();
      world.events.push('signature', world.player.x, world.player.y, 0, run.characterId, true);
    }
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
    // one second chance a run, offered rather than taken: the run freezes on a prompt and the
    // view decides — ad watched, or not
    if (!fatal && this.adRevive && !run.adReviveOffered) {
      run.adReviveOffered = true;
      run.phase = 'revivePrompt';
      world.events.push('revivePrompt', world.player.x, world.player.y, run.timeMs / 1000);
      return;
    }
    run.phase = 'ended';
    run.ended = 'died';
    world.events.push('died', world.player.x, world.player.y, run.timeMs / 1000);
  }

  /** Damage entry point shared by every weapon; handles knockback, flash, death and drops. */
  damageEnemy(e: Enemy, dmg: number, dirX: number, dirY: number, knockback: number, slot = -1): void {
    const def = e.def;
    if (!def || def.invulnerable) return;
    // a shield in the way takes almost all of it; the answer to a bulwark is an angle, not a number
    const rounded = Math.max(1, Math.round(dmg * bulwarkScale(e, dirX, dirY) * bossArmourScale(e, dirX, dirY)));
    e.hp -= rounded;
    // credited to the weapon slot that landed it, for the results screen; overkill counts, the
    // way it does in the reference game, so the tally is what was dealt and not what was needed
    if (slot >= 0) this.run.damageBySlot[slot] = (this.run.damageBySlot[slot] ?? 0) + rounded;
    e.flashMs = 80;
    if (knockback > 0) applyKnockback(e, dirX, dirY, knockback * 240);
    this.world.events.push('hit', e.x, e.y, rounded, e.defId, rounded >= e.maxHp * 0.5);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private scratch = { x: 0, y: 0 };

  /** Ground bodies slide around walls; rushes cross over, scenery sits where it is. */
  private keepEnemiesOutOfWalls(): void {
    const world = this.world;
    const alive = world.enemies.aliveList();
    for (let i = 0; i < world.enemies.count; i++) {
      const e = world.enemies.items[alive[i]];
      if (e.behavior === 'line' || e.behavior === 'prop') continue;
      if (resolveCircle(world.obstacles, e.x, e.y, e.radius, this.scratch)) {
        e.x = this.scratch.x;
        e.y = this.scratch.y;
      }
    }
  }

  /** Resolves a bomber's blast: damage to the player if inside it, and the bomber is spent. */
  private detonate(e: Enemy): void {
    if (!e.active || !e.def?.explode) return;
    const cfg = e.def.explode;
    this.world.events.push('explode', e.x, e.y, cfg.radius, e.defId, true);
    if (inBlast(e, this.world)) {
      if (applyPlayerDamage(this.world, this.cachedStats, this.run.god, cfg.damage * e.dmgMult, e.defId) > 0) this.onPlayerHurt(false);
    }
    // it does not count as a kill and drops nothing: the player did not earn it
    this.world.enemies.free(e);
  }

  killEnemy(e: Enemy): void {
    if (!e.active || !e.def) return;
    const isBoss = e.behavior === 'boss';
    const scenery = e.def.behavior === 'prop';
    if (!scenery) this.run.kills++;
    if (!scenery && onSignatureKill(this.signature, this.character.signature, this.run.kills)) {
      this.refreshStats();
      this.world.events.push('signature', this.world.player.x, this.world.player.y, 0, this.run.characterId, true);
    }
    const split = e.def.split;
    const sx = e.x;
    const sy = e.y;
    this.world.events.push('death', e.x, e.y, 0, e.defId, e.def.deathFx === 'big');
    dropForEnemy(this.world, e, this.stage.gemCap);
    rollDrops(this.world, e, this.world.rng, this.cachedStats.luck, this.reg.pickupList, this.run.timeMs);
    if (isBoss) {
      this.run.bossKills++;
      this.world.events.push('bossKilled', e.x, e.y, 0, e.defId, true);
    }
    const final = e.def.boss?.final;
    if (final) {
      // the stage is cleared the moment it dies; the gold stands in for the chest a run that is
      // over could never open
      this.run.gold += Math.round(final.gold * this.cachedStats.greed);
      this.world.enemies.free(e);
      this.endRun('survived');
      return;
    }
    // the children are spawned before the parent's slot is freed, so a handle to the parent goes
    // dead instead of quietly becoming one of its own spores
    if (split) spawnRing(this.world, split.enemy, split.count, 18, { x: sx, y: sy, hpMult: 1, dmgMult: e.dmgMult, speedMult: e.speedMult });
    this.world.enemies.free(e);
  }

  /**
   * Kills every enemy currently on screen. The EMP pickup and a revive spare the bosses: a boss
   * is a fight, and a 0.2% drop deciding it would make the fight not matter.
   */
  killAllOnScreen(includeBosses = false): number {
    let killed = 0;
    this.world.enemies.forEach((e) => {
      if (e.def?.invulnerable) return;
      if (!includeBosses && e.def?.bossBar) return;
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
      case 'nuke': {
        // queue the event first: the kills it triggers each emit their own events
        world.events.push('nuke', c.x, c.y, 0, c.def.id);
        this.killAllOnScreen();
        break;
      }
      case 'chest':
        this.openChest(effect.grade, c.x, c.y);
        break;
    }
  }

  /** Rolls the current offer again, if a reroll is left. */
  rerollChoices(): boolean {
    const run = this.run;
    if (run.phase !== 'levelup' || run.rerolls <= 0) return false;
    run.rerolls--;
    run.choices = rollLevelUp({
      weapons: run.weapons,
      passives: run.passives,
      luck: this.cachedStats.luck,
      rng: this.world.rng,
      reg: this.reg,
      excluded: new Set([...run.banished, ...run.locked]),
    });
    return true;
  }

  /** Declines the whole offer, if a skip is left; the level is still gained. */
  skipLevelUp(): boolean {
    const run = this.run;
    if (run.phase !== 'levelup' || run.skips <= 0) return false;
    run.skips--;
    run.pendingLevelUps = Math.max(0, run.pendingLevelUps - 1);
    run.choices = null;
    if (run.pendingLevelUps > 0) this.openLevelUp();
    else run.phase = 'running';
    return true;
  }

  /** Removes one card's item from every offer for the rest of the run, and rolls a replacement. */
  banishChoice(index: number): boolean {
    const run = this.run;
    const choices = run.choices;
    if (run.phase !== 'levelup' || run.banishes <= 0 || !choices) return false;
    const choice = choices[index];
    if (!choice || (choice.kind !== 'weapon' && choice.kind !== 'passive')) return false;
    // an owned item cannot be banished: its levels are already part of the build
    const owned = [...run.weapons, ...run.passives].some((o) => o.id === choice.id);
    if (owned) return false;
    run.banishes--;
    run.banished.push(choice.id);
    run.choices = rollLevelUp({
      weapons: run.weapons,
      passives: run.passives,
      luck: this.cachedStats.luck,
      rng: this.world.rng,
      reg: this.reg,
      excluded: new Set([...run.banished, ...run.locked]),
    });
    return true;
  }

  /** A weapon that can evolve right now: maxed, with its paired passive owned. */
  evolvableWeapon(): { id: string; into: string } | null {
    for (const w of this.run.weapons) {
      const def = this.reg.weapons[w.id];
      const evo = def?.evolution;
      if (!evo || w.level < def.maxLevel) continue;
      if (!this.run.passives.some((p) => p.id === evo.requires)) continue;
      if (!this.reg.weapons[evo.into]) continue;
      return { id: w.id, into: evo.into };
    }
    return null;
  }

  /** Replaces the first evolvable weapon with its evolution, in the same slot. Returns the new id. */
  evolveEligibleWeapon(): string | null {
    const target = this.evolvableWeapon();
    if (!target) return null;
    const into = this.reg.weapons[target.into];
    const owned = this.run.weapons.find((w) => w.id === target.id)!;
    owned.id = target.into;
    owned.level = into.maxLevel; // evolutions do not level; treating them as maxed keeps them off the offer
    const inst = this.world.weaponInstances.find((i) => i.defId === target.id);
    if (inst) {
      inst.defId = target.into;
      inst.level = into.maxLevel;
      inst.cooldownLeft = 0;
      inst.volleyLeft = 0;
      inst.activeCount = 0;
      inst.lastHitTick.fill(-1e9);
    }
    // any drones or bolts the old weapon owned are recycled, so the evolution starts clean
    this.world.projectiles.forEach((p) => {
      if (!p.hostile && inst && p.weaponSlot === inst.slot) {
        p.hitSerials.length = 0;
        this.world.projectiles.free(p);
      }
    });
    this.refreshStats();
    this.world.events.push('evolve', this.world.player.x, this.world.player.y, 0, target.into, true);
    return target.into;
  }

  /** Chest reward: raises random owned weapons that are not yet maxed. */
  /**
   * Opens a chest: rolls its rewards, applies them, and queues the result for the view to reveal.
   *
   * Everything commits inside this tick. The reveal that the player sees is theatre played over a
   * decision already made, which is what lets a chest exist without a run phase of its own — every
   * headless harness, the balance runs and the fast-forward in the debug hook all keep working
   * without knowing chests exist.
   *
   * The order matters and used to be the other way round. Evolving ran first and returned early, so
   * a chest whose own levels were what pushed a weapon to max could not then act on the condition
   * it had just created; the player had to find another chest, and there were only ever two in a
   * run. Levels are granted first now, and then every weapon that has become eligible evolves, as a
   * bonus on top rather than instead.
   */
  openChest(grade: ChestGrade, x: number, y: number): ChestResult {
    const run = this.run;
    const rewards = rollChestRewards({
      weapons: run.weapons,
      passives: run.passives,
      grade,
      luck: this.cachedStats.luck,
      rng: this.world.rng,
      reg: this.reg,
    });
    for (const r of rewards) {
      if (r.kind === 'weapon') this.giveWeapon(r.id, r.toLevel);
      else if (r.kind === 'passive') this.givePassive(r.id, r.toLevel);
    }

    const evolved: string[] = [];
    // a chest that maxes two weapons at once evolves both
    for (let guard = 0; guard < WEAPON_SLOTS; guard++) {
      const into = this.evolveEligibleWeapon();
      if (!into) break;
      evolved.push(into);
    }

    // a focused build can max and evolve everything it owns; a chest must never be empty
    let gold = 0;
    if (rewards.length === 0 && evolved.length === 0) {
      gold = Math.round(CHEST_CONSOLATION_GOLD * this.cachedStats.greed);
      run.gold += gold;
      this.world.events.push('pickup', x, y, gold, 'coin');
    }

    if (onSignatureChest(this.signature, this.character.signature)) {
      this.refreshStats();
      this.world.events.push('signature', x, y, 0, run.characterId, true);
    }
    const result: ChestResult = { grade, x, y, rewards, evolved, gold };
    run.chestQueue.push(result);
    run.chestsOpened++;
    this.world.events.push('chest', x, y, rewards.length, grade, true);
    return result;
  }

  /** Drops the oldest queued chest result, for the view once it has played the reveal. */
  takeChestResult(): ChestResult | null {
    return this.run.chestQueue.shift() ?? null;
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
    return this.events.fireIndex(this.world, this.stage, index, this.viewW, this.viewH);
  }

  spawnBoss(): void {
    const index = this.stage.events.findIndex((e) => e.kind === 'boss');
    if (index >= 0) this.events.fireIndex(this.world, this.stage, index, this.viewW, this.viewH);
  }

  spawnFinal(): void {
    const index = this.stage.events.findIndex((e) => e.kind === 'final');
    if (index >= 0) {
      this.events.fireIndex(this.world, this.stage, index, this.viewW, this.viewH);
      this.run.finalSpawned = true;
    }
  }

  despawnFinal(): void {
    this.world.enemies.forEach((e) => {
      if (e.def?.boss?.final) this.world.enemies.free(e);
    });
    this.run.finalSpawned = false;
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
      excluded: new Set([...run.banished, ...run.locked]),
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
      case 'limit': {
        const inst = this.world.weaponInstances.find((i) => i.defId === choice.id);
        if (inst) inst.limit[choice.stat] += choice.amount;
        break;
      }
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
  /** Bodies within `r` of the player. Cheap: one grid query and a circle test. */
  private countNear(r: number): number {
    const w = this.world;
    const p = w.player;
    const q = r + MAX_ENEMY_RADIUS;
    const n = w.grid.queryInto(p.x - q, p.y - q, p.x + q, p.y + q, w.queryBuf);
    let count = 0;
    for (let i = 0; i < n; i++) {
      const e = w.enemies.items[w.queryBuf[i]];
      if (!e.active || !e.def || e.def.behavior === 'prop' || e.def.behavior === 'mire') continue;
      // a body that does its work by exploding still counts: those are the crowds that kill you
      if (e.def.damage <= 0 && !e.def.explode) continue;
      const rr = r + e.radius;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy <= rr * rr) count++;
    }
    return count;
  }

  /** Bodies inside a cone of `arcDeg` about the player's facing, out to `range`. */
  private countInArc(range: number, arcDeg: number): number {
    const w = this.world;
    const p = w.player;
    const q = range + MAX_ENEMY_RADIUS;
    const n = w.grid.queryInto(p.x - q, p.y - q, p.x + q, p.y + q, w.queryBuf);
    const fx = Math.cos(p.facing);
    const fy = Math.sin(p.facing);
    const cos = Math.cos((arcDeg * Math.PI) / 360);
    let count = 0;
    for (let i = 0; i < n; i++) {
      const e = w.enemies.items[w.queryBuf[i]];
      if (!e.active || !e.def || e.def.behavior === 'prop') continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range || d < 1e-3) continue;
      if ((dx / d) * fx + (dy / d) * fy < cos) continue;
      count++;
    }
    return count;
  }

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
        volleyFacing: 0,
        limit: { damage: 0, area: 0, cooldown: 0, speed: 0 },
        activeCount: 0,
        plantSerial: 0,
        holdMs: 0,
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
    const ringR = spawnRingRadius(stage, this.viewW, this.viewH);
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

  /** The ad was watched: back on your feet at half health, the screen cleared, as a shop revive does. */
  acceptAdRevive(): boolean {
    const { run, world } = this;
    if (run.phase !== 'revivePrompt') return false;
    run.adRevived = true;
    world.player.hp = Math.round(this.cachedStats.maxHealth * 0.5);
    run.hp = world.player.hp;
    world.player.iframesMs = 2000;
    this.killAllOnScreen();
    run.phase = 'running';
    world.events.push('revive', world.player.x, world.player.y, run.revivalsUsed + 1);
    return true;
  }

  /** The offer was declined, or no ad could be shown: the death stands. */
  declineAdRevive(): void {
    if (this.run.phase !== 'revivePrompt') return;
    this.run.phase = 'ended';
    this.run.ended = 'died';
    this.world.events.push('died', this.world.player.x, this.world.player.y, this.run.timeMs / 1000);
  }

  endRun(cause: RunEnd): void {
    if (this.run.phase === 'ended') return;
    this.run.phase = 'ended';
    this.run.ended = cause;
    this.world.events.push(cause === 'died' ? 'died' : 'survived', this.world.player.x, this.world.player.y, this.run.timeMs / 1000);
  }
}
