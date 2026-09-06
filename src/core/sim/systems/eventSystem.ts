import { GAME_H, GAME_W } from '../../../config';
import type { StageDef, WaveEvent } from '../../../data/types';
import { spawnEnemy, spawnRing, spawnRingRadius } from './spawnSystem';
import type { World } from '../world';

/**
 * Fires the stage's timed events. The pointer only moves forward, so an event never repeats, and
 * jumping the clock forward skips the events that are now in the past rather than firing a burst
 * of them at once.
 */
export class EventScheduler {
  private next = 0;

  reset(): void {
    this.next = 0;
  }

  /** Skips events at or before `sec` without firing them; used by the debug hook's setTime. */
  skipTo(stage: StageDef, sec: number): void {
    this.next = 0;
    while (this.next < stage.events.length && stage.events[this.next].at <= sec) this.next++;
  }

  get nextIndex(): number {
    return this.next;
  }

  /** Returns true when a reaper event fired this step. */
  step(world: World, stage: StageDef, timeMs: number): boolean {
    const sec = timeMs / 1000;
    let reaper = false;
    while (this.next < stage.events.length && stage.events[this.next].at <= sec) {
      const event = stage.events[this.next];
      this.fire(world, stage, event);
      if (event.kind === 'reaper') reaper = true;
      this.next++;
    }
    return reaper;
  }

  /** Fires one event by index regardless of the clock; used by the debug hook. */
  fireIndex(world: World, stage: StageDef, index: number): boolean {
    const event = stage.events[index];
    if (!event) return false;
    this.fire(world, stage, event);
    return true;
  }

  private fire(world: World, stage: StageDef, event: WaveEvent): void {
    const ring = spawnRingRadius(stage);
    switch (event.kind) {
      case 'swarm':
        this.swarm(world, event, ring);
        break;
      case 'ring':
        spawnRing(world, event.enemy, event.count, event.radius, { isEvent: true });
        break;
      case 'boss': {
        const boss = spawnEnemy(world, event.enemy, {
          x: world.player.x + ring,
          y: world.player.y,
          isEvent: true,
          hpMult: event.hpMult,
        });
        if (boss) world.events.push('bossSpawned', boss.x, boss.y, boss.maxHp, event.enemy, true);
        break;
      }
      case 'reaper': {
        const reaper = spawnEnemy(world, event.enemy, {
          x: world.player.x + ring * 0.8,
          y: world.player.y - ring * 0.4,
          isEvent: true,
        });
        if (reaper) world.events.push('reaper', reaper.x, reaper.y, 0, event.enemy, true);
        break;
      }
    }
  }

  /**
   * A line of fast enemies that crosses the screen. They travel at constant velocity, ignore the
   * player and are exempt from the spawner's relocation, so the wave really does sweep past.
   */
  private swarm(world: World, event: Extract<WaveEvent, { kind: 'swarm' }>, ring: number): void {
    const p = world.player;
    const speedMult = event.speedMult ?? 1;
    let dirX = 0;
    let dirY = 0;
    let startX: number;
    let startY: number;
    let stepX = 0;
    let stepY = 0;
    const spacing = 40;

    if (event.pattern === 'hLine') {
      const fromLeft = world.rng.next() < 0.5;
      dirX = fromLeft ? 1 : -1;
      startX = p.x + (fromLeft ? -1 : 1) * (GAME_W / 2 + 80);
      startY = p.y - ((event.count - 1) * spacing) / 2;
      stepY = spacing;
    } else if (event.pattern === 'vLine') {
      const fromTop = world.rng.next() < 0.5;
      dirY = fromTop ? 1 : -1;
      startY = p.y + (fromTop ? -1 : 1) * (GAME_H / 2 + 80);
      startX = p.x - ((event.count - 1) * spacing) / 2;
      stepX = spacing;
    } else {
      dirX = world.rng.next() < 0.5 ? 1 : -1;
      dirY = 1;
      const len = Math.hypot(dirX, dirY);
      dirX /= len;
      dirY /= len;
      startX = p.x - dirX * ring;
      startY = p.y - dirY * ring - ((event.count - 1) * spacing) / 2;
      stepX = spacing * 0.7;
      stepY = spacing * 0.7;
    }

    let spawned = 0;
    for (let i = 0; i < event.count; i++) {
      const e = spawnEnemy(world, event.enemy, {
        x: startX + stepX * i,
        y: startY + stepY * i,
        isEvent: true,
        behavior: 'line',
        dirX,
        dirY,
        speedMult,
      });
      if (!e) break;
      spawned++;
    }
    if (spawned > 0) world.events.push('rush', startX, startY, spawned, event.enemy);
  }
}
