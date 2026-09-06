import { GAME_H, GAME_W } from '../../../config';
import type { EnemyDef, StageDef, WaveEntry } from '../../../data/types';
import { enemyDef } from '../../content/registry';
import type { Enemy } from '../entities/enemy';
import type { World } from '../world';

/** Radius of the ring just outside the view where enemies appear. */
export function spawnRingRadius(stage: StageDef): number {
  return Math.hypot(GAME_W / 2, GAME_H / 2) + stage.spawnMargin;
}

export function waveRow(stage: StageDef, timeMs: number): WaveEntry {
  const minute = Math.floor(timeMs / 60000);
  return stage.waves[Math.min(minute, stage.waves.length - 1)];
}

export interface SpawnOptions {
  x?: number;
  y?: number;
  isEvent?: boolean;
  behavior?: Enemy['behavior'];
  hpMult?: number;
  dmgMult?: number;
  dirX?: number;
  dirY?: number;
  speedMult?: number;
}

/** Creates one enemy; returns null when the pool is full (spawns are refused, never queued). */
export function spawnEnemy(world: World, defId: string, o: SpawnOptions = {}): Enemy | null {
  const def: EnemyDef = enemyDef(defId);
  const e = world.enemies.spawn();
  if (!e) return null;
  e.serial = world.nextSerial();
  e.defId = defId;
  e.def = def;
  e.behavior = o.behavior ?? def.behavior;
  e.x = o.x ?? world.player.x;
  e.y = o.y ?? world.player.y;
  e.maxHp = def.hp * (o.hpMult ?? 1);
  e.hp = e.maxHp;
  e.radius = def.radius;
  e.kbx = 0;
  e.kby = 0;
  e.flashMs = 0;
  e.isEvent = o.isEvent ?? false;
  e.dmgMult = o.dmgMult ?? 1;
  e.dirX = o.dirX ?? 0;
  e.dirY = o.dirY ?? 0;
  e.lineSpeed = def.speed * (o.speedMult ?? 1);
  e.lifeMs = 12000;
  e.facing = 0;
  world.onEnemySpawn(e.id);
  world.events.push('spawn', e.x, e.y, 0, defId);
  return e;
}

/** Places `n` enemies evenly around the player at `radius`, offset by a random phase. */
export function spawnRing(world: World, defId: string, n: number, radius: number, o: SpawnOptions = {}): number {
  let spawned = 0;
  const phase = world.rng.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const e = spawnEnemy(world, defId, { ...o, x: world.player.x + Math.cos(a) * radius, y: world.player.y + Math.sin(a) * radius });
    if (!e) break;
    spawned++;
  }
  return spawned;
}

/** Spawns one enemy at a random point on the off-screen ring. */
export function spawnOnRing(world: World, defId: string, radius: number, o: SpawnOptions = {}): Enemy | null {
  const a = world.rng.next() * Math.PI * 2;
  const r = radius + world.rng.next() * 64;
  return spawnEnemy(world, defId, { ...o, x: world.player.x + Math.cos(a) * r, y: world.player.y + Math.sin(a) * r });
}

export class Spawner {
  private timerMs = 0;
  /** scratch weights so the spawn loop allocates nothing */
  private weights = new Float64Array(16);

  reset(): void {
    this.timerMs = 0;
  }

  /**
   * Tops the field up to the wave row's minimum, then relocates enemies that have fallen far
   * behind the player back onto the ring. Line, boss and reaper enemies are exempt from that
   * relocation: a swarm must be allowed to cross the screen and a boss must never teleport.
   */
  step(world: World, stage: StageDef, timeMs: number, curse: number, dt: number): void {
    const row = waveRow(stage, timeMs);
    const ring = spawnRingRadius(stage);
    const running = timeMs < stage.durationSec * 1000;

    if (running) {
      const minCount = Math.round(row.minCount * (1 + curse));
      const interval = row.interval / (1 + curse);
      this.timerMs += dt * 1000;
      let normalAlive = 0;
      const alive = world.enemies.aliveList();
      for (let i = 0; i < world.enemies.count; i++) {
        if (!world.enemies.items[alive[i]].isEvent) normalAlive++;
      }
      if (this.timerMs >= interval) {
        this.timerMs = 0;
        if (normalAlive < minCount) {
          if (this.weights.length < row.mix.length) this.weights = new Float64Array(row.mix.length);
          const w = this.weights.subarray(0, row.mix.length);
          for (let i = 0; i < row.mix.length; i++) w[i] = row.mix[i].weight;
          const hpMult = row.hpMult * (1 + curse);
          for (let i = 0; i < row.batch; i++) {
            const idx = world.rng.weightedIndex(w);
            if (idx < 0) break;
            if (!spawnOnRing(world, row.mix[idx].enemy, ring, { hpMult, dmgMult: row.dmgMult })) break;
          }
        }
      }
    }

    const far = ring * stage.despawnFactor;
    const far2 = far * far;
    world.enemies.forEach((e) => {
      if (e.behavior === 'line') {
        if (e.lifeMs <= 0) world.enemies.free(e);
        return;
      }
      if (e.behavior === 'boss' || e.behavior === 'reaper') return;
      const dx = e.x - world.player.x;
      const dy = e.y - world.player.y;
      if (dx * dx + dy * dy <= far2) return;
      if (e.isEvent) {
        world.enemies.free(e);
        return;
      }
      const a = world.rng.next() * Math.PI * 2;
      e.x = world.player.x + Math.cos(a) * ring;
      e.y = world.player.y + Math.sin(a) * ring;
      e.kbx = 0;
      e.kby = 0;
    });
  }
}
