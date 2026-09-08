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
  // ---- 货运甲板 ----
  /** 装卸机甲: slow, wide and heavily armoured; the cargo deck's whole point is that the bodies are big. */
  loader: {
    id: 'loader', nameKey: 'enemy.loader.name', frame: 'enemy_loader', tint: 0xff9a4a, faceTarget: true,
    hp: 220, damage: 22, speed: 40, radius: 30, gemTier: 'red', knockbackResist: 0.9,
    behavior: 'chase', deathFx: 'big',
  },
  /** 重型运输舰: the cargo boss. Charges harder and more often, and calls loaders instead of drones. */
  hauler: {
    id: 'hauler', nameKey: 'enemy.hauler.name', frame: 'enemy_hauler', tint: 0xffb070, faceTarget: false,
    hp: 520, damage: 30, speed: 50, radius: 64, gemTier: 'red', gemCount: 10, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: { chargeEveryMs: 4500, telegraphMs: 800, chargeMs: 800, chargeSpeedMult: 5.5, summon: 'loader', summonCount: 2, summonEveryMs: 12000 },
  },
  // ---- 生物实验舱 ----
  /** 孢子: tiny, fast to spawn, dies to anything. There are a great many of them. */
  spore: {
    id: 'spore', nameKey: 'enemy.spore.name', frame: 'enemy_spore', tint: 0xc07cff, faceTarget: false,
    hp: 2, damage: 2, speed: 85, radius: 11, gemTier: 'blue', knockbackResist: 0,
    behavior: 'chase', deathFx: 'small',
  },
  /** 母巢: the lab boss. It does not charge at all; it sits and pours spores out, which is the fight. */
  broodmother: {
    id: 'broodmother', nameKey: 'enemy.broodmother.name', frame: 'enemy_broodmother', tint: 0xb066e0, faceTarget: false,
    hp: 700, damage: 20, speed: 30, radius: 66, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: { chargeEveryMs: 1e9, telegraphMs: 600, chargeMs: 400, chargeSpeedMult: 1, summon: 'spore', summonCount: 10, summonEveryMs: 4000 },
  },
  // ---- 外层轨道 ----
  /** 掠袭艇: faster than the player. The orbit is the one stage where running is not an answer. */
  raider: {
    id: 'raider', nameKey: 'enemy.raider.name', frame: 'enemy_raider', faceTarget: false,
    hp: 10, damage: 6, speed: 175, radius: 13, gemTier: 'blue', knockbackResist: 0.3,
    behavior: 'chase', deathFx: 'small',
  },
  /** 护航艇: a ranged ship that keeps its distance and shoots. */
  escort: {
    id: 'escort', nameKey: 'enemy.escort.name', frame: 'enemy_escort', faceTarget: false,
    hp: 26, damage: 6, speed: 95, radius: 18, gemTier: 'green', knockbackResist: 0.4,
    behavior: 'ranged', deathFx: 'small',
    ranged: { range: 300, intervalMs: 2000, boltSpeed: 300, boltDamage: 9 },
  },
  /** 旗舰: the orbit boss. Two quick charges, and raiders as reinforcements. */
  flagship: {
    id: 'flagship', nameKey: 'enemy.flagship.name', frame: 'enemy_flagship', faceTarget: false,
    hp: 900, damage: 30, speed: 70, radius: 70, gemTier: 'red', gemCount: 14, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: { chargeEveryMs: 3200, telegraphMs: 600, chargeMs: 500, chargeSpeedMult: 5, summon: 'raider', summonCount: 5, summonEveryMs: 8000 },
  },
  annihilator: {
    id: 'annihilator', nameKey: 'enemy.annihilator.name', frame: 'enemy_annihilator', tint: 0x883355, faceTarget: false,
    hp: 1e9, damage: 9999, speed: 220, radius: 50, gemTier: 'none', knockbackResist: 1,
    behavior: 'reaper', invulnerable: true, deathFx: 'big',
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;
export const ENEMY_LIST: readonly EnemyDef[] = Object.values(ENEMIES);
