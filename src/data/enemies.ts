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
  /**
   * 掠夺者哨兵: a walking supply chest. Deliberately not a boss — no health bar, no charge, no
   * summons, and it hits softly — because its job is to be a few seconds of detour that punctuates
   * the run, and the stage already has two scripted boss fights. What it does have is enough health
   * to need shooting and almost total knockback resistance, so it cannot be shoved aside and
   * ignored: the decision it asks for is whether to stop and deal with it.
   */
  sentinel: {
    id: 'sentinel', nameKey: 'enemy.sentinel.name', frame: 'enemy_sentinel', tint: 0xffd166, faceTarget: true,
    hp: 160, damage: 8, speed: 52, radius: 30, gemTier: 'red', gemCount: 6, knockbackResist: 0.95,
    behavior: 'chase', drops: [{ pickup: 'chest', chance: 1 }], deathFx: 'big',
  },
  mech: {
    id: 'mech', nameKey: 'enemy.mech.name', frame: 'enemy_mech', faceTarget: true,
    hp: 120, damage: 18, speed: 45, radius: 26, gemTier: 'red', knockbackResist: 0.8,
    behavior: 'chase', deathFx: 'big',
  },
  spitter: {
    id: 'spitter', nameKey: 'enemy.spitter.name', frame: 'enemy_spitter', faceTarget: true,
    hp: 22, damage: 6, speed: 55, radius: 18, gemTier: 'green', knockbackResist: 0.3,
    behavior: 'ranged', deathFx: 'small',
    ranged: { range: 260, intervalMs: 2400, boltSpeed: 240, boltDamage: 8 },
  },
  dasher: {
    id: 'dasher', nameKey: 'enemy.dasher.name', frame: 'enemy_dasher', tint: 0xff9966, faceTarget: true,
    hp: 18, damage: 12, speed: 75, radius: 16, gemTier: 'green', knockbackResist: 0.2,
    behavior: 'dasher', deathFx: 'small',
    dash: { triggerRange: 240, telegraphMs: 500, durationMs: 450, speedMult: 5, cooldownMs: 2200 },
  },
  /**
   * 母舰. Its health lives in the two boss events rather than here, because the two fights are five
   * minutes apart and the build in between them is not comparable. Measured over the runs that
   * actually reach each boss: about 17 damage per second at 5:00 and about 173 at 10:00, ten times
   * as much. A single number for both is a wall at the first and a formality at the second.
   */
  mothership: {
    id: 'mothership', nameKey: 'enemy.mothership.name', frame: 'enemy_mothership', faceTarget: false,
    hp: 400, damage: 25, speed: 55, radius: 60, gemTier: 'red', gemCount: 10, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: { chargeEveryMs: 6000, telegraphMs: 900, chargeMs: 700, chargeSpeedMult: 4.5, summon: 'drone', summonCount: 6, summonEveryMs: 9000 },
  },
  annihilator: {
    id: 'annihilator', nameKey: 'enemy.annihilator.name', frame: 'enemy_annihilator', tint: 0x883355, faceTarget: false,
    hp: 1e9, damage: 9999, speed: 220, radius: 50, gemTier: 'none', knockbackResist: 1,
    behavior: 'reaper', invulnerable: true, deathFx: 'big',
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;
export const ENEMY_LIST: readonly EnemyDef[] = Object.values(ENEMIES);
