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
