import { ENEMY_CAP, GEM_CAP_POOL, GRID_CELL, GRID_SIZE, PICKUP_CAP, PROJECTILE_CAP } from '../../config';
import { Pool } from '../pool';
import { SpatialGrid } from '../spatialGrid';
import { EventBuffer } from '../events';
import { Rng } from '../rng';
import { createEnemy, type Enemy } from './entities/enemy';
import { createProjectile, type Projectile } from './entities/projectile';
import { createGem, type Gem } from './entities/gem';
import { createPickup, type Pickup } from './entities/pickup';
import { createPlayer, type Player } from './entities/player';
import type { WeaponInstance } from '../weapons/types';

/** Entity storage plus the broadphase and scratch buffers shared by every system. */
/** How many distinct targets a single volley can be spread over. */
const MAX_TARGET_RANK = 12;
// scratch for nthNearestEnemy; the simulation must not allocate inside its own loop
const rankDist = new Float64Array(MAX_TARGET_RANK);
const rankId = new Int32Array(MAX_TARGET_RANK);

export class World {
  readonly enemies = new Pool<Enemy>(ENEMY_CAP, createEnemy);
  readonly projectiles = new Pool<Projectile>(PROJECTILE_CAP, createProjectile);
  readonly gems = new Pool<Gem>(GEM_CAP_POOL, createGem);
  readonly pickups = new Pool<Pickup>(PICKUP_CAP, createPickup);
  readonly player: Player = createPlayer();
  readonly grid = new SpatialGrid(GRID_CELL, GRID_SIZE, ENEMY_CAP);
  readonly events = new EventBuffer();
  rng: Rng;
  /** scratch query buffers; systems reuse these to avoid per-step allocation */
  readonly queryBuf = new Int32Array(ENEMY_CAP);
  readonly queryBuf2 = new Int32Array(ENEMY_CAP);
  private serialCounter = 1;
  /** weapon instances that must have their per-enemy hit timers reset when a slot is reused */
  weaponInstances: WeaponInstance[] = [];

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  reset(seed: number): void {
    this.enemies.clear();
    this.projectiles.clear();
    this.gems.clear();
    this.pickups.clear();
    this.events.clear();
    this.rng = new Rng(seed);
    this.serialCounter = 1;
    const p = this.player;
    p.x = 0;
    p.y = 0;
    p.facing = 0;
    p.inputX = 0;
    p.inputY = 0;
    p.iframesMs = 0;
    p.healFraction = 0;
  }

  nextSerial(): number {
    return this.serialCounter++;
  }

  /**
   * Clears every weapon's hit timer for a reused enemy slot, so a fresh enemy is never treated as
   * "recently hit" by an aura or orbiter that hit the previous occupant.
   */
  onEnemySpawn(id: number): void {
    for (const inst of this.weaponInstances) inst.lastHitTick[id] = -1e9;
  }

  rebuildGrid(): void {
    const { grid, enemies, player } = this;
    grid.begin(player.x, player.y);
    const alive = enemies.aliveList();
    for (let i = 0; i < enemies.count; i++) {
      const e = enemies.items[alive[i]];
      grid.insert(e.id, e.x, e.y);
    }
  }

  /**
   * The target for shot number `index` of a volley: the index-th nearest enemy, wrapping round
   * when the volley has more shots than there are bodies in range.
   *
   * A weapon whose every shot calls `nearestEnemy` puts the whole volley into one body, because
   * the shots are a hundred milliseconds apart and nothing has moved between them. Wrapping rather
   * than clamping matters too: with two enemies and five shots, clamping piles four of them onto
   * whichever one happens to be nearest.
   */
  volleyTarget(x: number, y: number, maxDist: number, index: number): Enemy | null {
    if (index <= 0) return this.nearestEnemy(x, y, maxDist);
    const r = maxDist;
    const n = this.grid.queryInto(x - r, y - r, x + r, y + r, this.queryBuf);
    // an insertion sort over the few nearest is cheaper than sorting the whole query
    let held = 0;
    for (let i = 0; i < n; i++) {
      const id = this.queryBuf[i];
      const e = this.enemies.items[id];
      if (!e.active || e.def?.invulnerable) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d > r * r) continue;
      if (held === MAX_TARGET_RANK && d >= rankDist[held - 1]) continue;
      let at = Math.min(held, MAX_TARGET_RANK - 1);
      while (at > 0 && rankDist[at - 1] > d) {
        rankDist[at] = rankDist[at - 1];
        rankId[at] = rankId[at - 1];
        at--;
      }
      rankDist[at] = d;
      rankId[at] = id;
      if (held < MAX_TARGET_RANK) held++;
    }
    if (held === 0) return null;
    return this.enemies.items[rankId[index % held]];
  }

  nearestEnemy(x: number, y: number, maxDist: number): Enemy | null {
    const r = maxDist;
    const n = this.grid.queryInto(x - r, y - r, x + r, y + r, this.queryBuf);
    let best: Enemy | null = null;
    let bestD = r * r;
    for (let i = 0; i < n; i++) {
      const e = this.enemies.items[this.queryBuf[i]];
      if (!e.active || e.def?.invulnerable) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
}
