import type { EnemyDef } from './types';

/** Enemy content at wave multiplier 1. Radii are collision radii in px, speeds px/s. */
export const ENEMIES = {
  drone: {
    id: 'drone', nameKey: 'enemy.drone.name', frame: 'enemy_drone', faceTarget: false,
    hp: 3, damage: 3, speed: 70, radius: 14, gemTier: 'blue', knockbackResist: 0,
    behavior: 'chase', deathFx: 'small',
  },
  infected: {
    id: 'infected', nameKey: 'enemy.infected.name', frame: 'enemy_infected', tint: 0x88ff88, faceTarget: true,
    hp: 12, damage: 6, speed: 80, radius: 16, gemTier: 'blue', knockbackResist: 0.1,
    behavior: 'chase', deathFx: 'small',
  },
  robot: {
    id: 'robot', nameKey: 'enemy.robot.name', frame: 'enemy_robot', faceTarget: true,
    hp: 30, damage: 10, speed: 60, radius: 18, gemTier: 'green', knockbackResist: 0.4,
    behavior: 'chase', deathFx: 'small',
  },
  interceptor: {
    id: 'interceptor', nameKey: 'enemy.interceptor.name', frame: 'enemy_interceptor', faceTarget: false,
    hp: 8, damage: 5, speed: 150, radius: 14, gemTier: 'blue', knockbackResist: 0.2,
    behavior: 'chase', deathFx: 'small',
  },
  mech: {
    id: 'mech', nameKey: 'enemy.mech.name', frame: 'enemy_mech', faceTarget: true,
    hp: 120, damage: 18, speed: 45, radius: 26, gemTier: 'red', knockbackResist: 0.8,
    behavior: 'chase', deathFx: 'big',
  },
  mothership: {
    id: 'mothership', nameKey: 'enemy.mothership.name', frame: 'enemy_mothership', faceTarget: false,
    hp: 1500, damage: 25, speed: 55, radius: 60, gemTier: 'red', gemCount: 10, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'chest', chance: 1 }], deathFx: 'big',
  },
  annihilator: {
    id: 'annihilator', nameKey: 'enemy.annihilator.name', frame: 'enemy_annihilator', tint: 0x883355, faceTarget: false,
    hp: 1e9, damage: 9999, speed: 220, radius: 50, gemTier: 'none', knockbackResist: 1,
    behavior: 'reaper', invulnerable: true, deathFx: 'big',
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;
export const ENEMY_LIST: readonly EnemyDef[] = Object.values(ENEMIES);
