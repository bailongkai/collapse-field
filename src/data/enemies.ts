import type { EnemyDef } from './types';

/** Enemy content at wave multiplier 1. Radii are collision radii in px, speeds px/s. */
export const ENEMIES = {
  drone: {
    id: 'drone', nameKey: 'enemy.drone.name', frame: 'enemy_drone', faceTarget: false,
    hp: 3, damage: 3, speed: 70, radius: 14, gemTier: 'blue', knockbackResist: 0,
    behavior: 'chase', deathFx: 'small',
  },
  infected: {
    id: 'infected', nameKey: 'enemy.infected.name', frame: 'enemy_infected', faceTarget: true,
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
    id: 'sentinel', nameKey: 'enemy.sentinel.name', frame: 'enemy_sentinel', faceTarget: true,
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
    id: 'dasher', nameKey: 'enemy.dasher.name', frame: 'enemy_dasher', faceTarget: true,
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
  /** 自爆无人机: a drone that arms inside arm's reach and detonates after a fuse. Run, or kill it first. */
  bomber: {
    id: 'bomber', nameKey: 'enemy.bomber.name', frame: 'enemy_bomber', faceTarget: false,
    hp: 6, damage: 0, speed: 95, radius: 14, gemTier: 'blue', knockbackResist: 0.2,
    behavior: 'bomber', deathFx: 'big',
    // the fuse is what makes it fair: from arming range a player who runs at once clears the
    // blast with room to spare, and one who ignores the flash for most of a second does not
    explode: { triggerRange: 70, fuseMs: 900, radius: 90, damage: 18 },
  },
  /** 维修工兵: hangs back and repairs the bodies around it. Kill it first or fight a crowd that heals. */
  medic: {
    id: 'medic', nameKey: 'enemy.medic.name', frame: 'enemy_medic', faceTarget: true,
    hp: 24, damage: 4, speed: 65, radius: 16, gemTier: 'green', knockbackResist: 0.3,
    behavior: 'healer', deathFx: 'small',
    heal: { range: 150, intervalMs: 2000, amount: 8, keepDistance: 220 },
  },
  /**
   * 猎犬无人机: the one ordinary enemy faster than the player. It exists because the player moves
   * at 200 px/s and nothing else in the table does, so a straight line was never caught before the
   * reaper; from the ninth minute this is what catches it.
   */
  hound: {
    id: 'hound', nameKey: 'enemy.hound.name', frame: 'enemy_hound', faceTarget: false,
    hp: 14, damage: 7, speed: 215, radius: 13, gemTier: 'blue', knockbackResist: 0.3,
    behavior: 'chase', deathFx: 'small',
  },
  // ---- 货运甲板 ----
  /** 牵引车: holds its distance and drags the player towards the heavy bodies. Does nothing else, needs nothing else. */
  tractor: {
    id: 'tractor', nameKey: 'enemy.tractor.name', frame: 'enemy_tractor', faceTarget: true,
    hp: 60, damage: 8, speed: 50, radius: 24, gemTier: 'green', knockbackResist: 0.7,
    behavior: 'tractor', deathFx: 'big',
    tractor: { range: 260, pull: 130, keepDistance: 200 },
  },
  /** 维修无人机: the cargo deck's healer, tuned for the mechs it flies with. */
  repairDrone: {
    id: 'repairDrone', nameKey: 'enemy.repairDrone.name', frame: 'enemy_repairDrone', faceTarget: false,
    hp: 20, damage: 3, speed: 80, radius: 13, gemTier: 'green', knockbackResist: 0.1,
    behavior: 'healer', deathFx: 'small',
    heal: { range: 170, intervalMs: 1800, amount: 20, keepDistance: 240 },
  },
  /** 装卸机甲: slow, wide and heavily armoured; the cargo deck's whole point is that the bodies are big. */
  loader: {
    id: 'loader', nameKey: 'enemy.loader.name', frame: 'enemy_loader', faceTarget: true,
    hp: 220, damage: 22, speed: 40, radius: 30, gemTier: 'red', knockbackResist: 0.9,
    behavior: 'chase', deathFx: 'big',
  },
  /** 重型运输舰: the cargo boss. Charges harder and more often, and calls loaders instead of drones. */
  hauler: {
    id: 'hauler', nameKey: 'enemy.hauler.name', frame: 'enemy_hauler', faceTarget: false,
    hp: 520, damage: 30, speed: 50, radius: 64, gemTier: 'red', gemCount: 10, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: { chargeEveryMs: 4500, telegraphMs: 800, chargeMs: 800, chargeSpeedMult: 5.5, summon: 'loader', summonCount: 2, summonEveryMs: 12000 },
  },
  // ---- 生物实验舱 ----
  /** 孢子: tiny, fast to spawn, dies to anything. There are a great many of them. */
  spore: {
    id: 'spore', nameKey: 'enemy.spore.name', frame: 'enemy_spore', faceTarget: false,
    hp: 2, damage: 2, speed: 85, radius: 11, gemTier: 'blue', knockbackResist: 0,
    behavior: 'chase', deathFx: 'small',
  },
  /** 分裂体: an infected that comes apart into spores when it dies. Killing it near you is the mistake. */
  splitter: {
    id: 'splitter', nameKey: 'enemy.splitter.name', frame: 'enemy_splitter', faceTarget: true,
    hp: 28, damage: 7, speed: 70, radius: 18, gemTier: 'green', knockbackResist: 0.2,
    behavior: 'chase', deathFx: 'small',
    split: { enemy: 'spore', count: 3 },
  },
  /** 孵化囊: stands where it was planted and hatches spores until someone comes over and stops it. */
  hatchery: {
    id: 'hatchery', nameKey: 'enemy.hatchery.name', frame: 'enemy_hatchery', faceTarget: false,
    hp: 140, damage: 5, speed: 0, radius: 30, gemTier: 'red', gemCount: 3, knockbackResist: 1,
    behavior: 'nest', deathFx: 'big',
    nest: { summon: 'spore', count: 4, intervalMs: 3500 },
  },
  /** 母巢: the lab boss. It does not charge at all; it sits and pours spores out, which is the fight. */
  broodmother: {
    id: 'broodmother', nameKey: 'enemy.broodmother.name', frame: 'enemy_broodmother', faceTarget: false,
    hp: 700, damage: 20, speed: 30, radius: 66, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: { chargeEveryMs: 1e9, telegraphMs: 600, chargeMs: 400, chargeSpeedMult: 1, summon: 'spore', summonCount: 10, summonEveryMs: 4000 },
  },
  // ---- 外层轨道 ----
  /** 掠袭艇: faster than the player. The orbit is the one stage where running is not an answer. */
  raider: {
    id: 'raider', nameKey: 'enemy.raider.name', frame: 'enemy_raider', faceTarget: false,
    hp: 10, damage: 6, speed: 160, radius: 13, gemTier: 'blue', knockbackResist: 0.3,
    behavior: 'chase', deathFx: 'small',
  },
  /** 护航艇: a ranged ship that keeps its distance and shoots. */
  escort: {
    id: 'escort', nameKey: 'enemy.escort.name', frame: 'enemy_escort', faceTarget: false,
    hp: 26, damage: 6, speed: 95, radius: 18, gemTier: 'green', knockbackResist: 0.4,
    behavior: 'ranged', deathFx: 'small',
    ranged: { range: 300, intervalMs: 2000, boltSpeed: 300, boltDamage: 9 },
  },
  /** 布雷艇: circles at a distance and seeds the field with mines. */
  minelayer: {
    id: 'minelayer', nameKey: 'enemy.minelayer.name', frame: 'enemy_minelayer', faceTarget: false,
    hp: 40, damage: 6, speed: 110, radius: 17, gemTier: 'green', knockbackResist: 0.4,
    behavior: 'layer', deathFx: 'small',
    layer: { mine: 'mine', intervalMs: 2600, keepDistance: 300, maxMines: 12 },
  },
  /** 感应雷: a bomber that cannot move. It waits. */
  mine: {
    id: 'mine', nameKey: 'enemy.mine.name', frame: 'enemy_mine', faceTarget: false,
    hp: 4, damage: 0, speed: 0, radius: 12, gemTier: 'none', knockbackResist: 1,
    behavior: 'bomber', deathFx: 'big',
    explode: { triggerRange: 44, fuseMs: 350, radius: 100, damage: 16 },
  },
  /** 相位艇: reappears a short way from the player, in a direction of its own choosing. */
  phaser: {
    id: 'phaser', nameKey: 'enemy.phaser.name', frame: 'enemy_phaser', faceTarget: false,
    hp: 30, damage: 9, speed: 90, radius: 16, gemTier: 'green', knockbackResist: 0.3,
    behavior: 'blink', deathFx: 'small',
    blink: { everyMs: 5000, distance: 150, telegraphMs: 500 },
  },
  /** 旗舰: the orbit boss. Two quick charges, and raiders as reinforcements. */
  flagship: {
    id: 'flagship', nameKey: 'enemy.flagship.name', frame: 'enemy_flagship', faceTarget: false,
    hp: 900, damage: 30, speed: 70, radius: 70, gemTier: 'red', gemCount: 14, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: { chargeEveryMs: 3200, telegraphMs: 600, chargeMs: 500, chargeSpeedMult: 5, summon: 'raider', summonCount: 5, summonEveryMs: 8000 },
  },
  // ---- breakable scenery: not enemies, but the pool and the weapons already know how to hit them ----
  crate: {
    id: 'crate', nameKey: 'enemy.crate.name', frame: 'decor_cargo_1', faceTarget: false,
    hp: 30, damage: 0, speed: 0, radius: 22, gemTier: 'none', knockbackResist: 1,
    behavior: 'prop', deathFx: 'small', drops: [{ pickup: 'coin', chance: 0.6 }, { pickup: 'heal', chance: 0.12 }],
  },
  canister: {
    id: 'canister', nameKey: 'enemy.canister.name', frame: 'decor_lab_5', faceTarget: false,
    hp: 24, damage: 0, speed: 0, radius: 20, gemTier: 'none', knockbackResist: 1,
    behavior: 'prop', deathFx: 'small', drops: [{ pickup: 'coin', chance: 0.5 }, { pickup: 'heal', chance: 0.2 }],
  },
  asteroid: {
    id: 'asteroid', nameKey: 'enemy.asteroid.name', frame: 'prop_asteroid', faceTarget: false,
    hp: 40, damage: 0, speed: 60, radius: 20, gemTier: 'none', knockbackResist: 1,
    behavior: 'prop', deathFx: 'big', drops: [{ pickup: 'coin', chance: 0.7 }, { pickup: 'vacuum', chance: 0.03 }],
  },
  // ---- the second boss of each stage, at ten minutes ----
  warden: {
    id: 'warden', nameKey: 'enemy.warden.name', frame: 'enemy_warden', faceTarget: false,
    hp: 520, damage: 26, speed: 45, radius: 62, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: {
      chargeEveryMs: 9000, telegraphMs: 900, chargeMs: 600, chargeSpeedMult: 4, summon: 'interceptor', summonCount: 6, summonEveryMs: 10000,
      volley: { everyMs: 2600, count: 5, spreadDeg: 44, boltSpeed: 260, boltDamage: 12 },
    },
  },
  crusher: {
    id: 'crusher', nameKey: 'enemy.crusher.name', frame: 'enemy_crusher', faceTarget: false,
    hp: 640, damage: 34, speed: 55, radius: 62, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: {
      chargeEveryMs: 3500, telegraphMs: 700, chargeMs: 800, chargeSpeedMult: 6, summon: 'loader', summonCount: 2, summonEveryMs: 14000,
      mine: { enemy: 'mine', everyMs: 1800, max: 12 },
    },
  },
  abomination: {
    id: 'abomination', nameKey: 'enemy.abomination.name', frame: 'enemy_abomination', faceTarget: false,
    hp: 760, damage: 22, speed: 40, radius: 66, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    split: { enemy: 'spore', count: 12 },
    boss: {
      chargeEveryMs: 1e9, telegraphMs: 600, chargeMs: 400, chargeSpeedMult: 1, summon: 'splitter', summonCount: 3, summonEveryMs: 7000,
      pull: { range: 280, strength: 110 },
    },
  },
  phantom: {
    id: 'phantom', nameKey: 'enemy.phantom.name', frame: 'enemy_phantom', faceTarget: false,
    hp: 820, damage: 30, speed: 80, radius: 60, gemTier: 'red', gemCount: 14, knockbackResist: 1,
    behavior: 'boss', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], deathFx: 'big',
    boss: {
      chargeEveryMs: 1e9, telegraphMs: 500, chargeMs: 500, chargeSpeedMult: 5, summon: 'phaser', summonCount: 3, summonEveryMs: 9000,
      blink: { everyMs: 5000, distance: 280, telegraphMs: 500 },
    },
  },
  // ---- the final boss, at fifteen minutes on every stage ----
  annihilator: {
    id: 'annihilator', nameKey: 'enemy.annihilator.name', frame: 'enemy_annihilator', faceTarget: false,
    hp: 3000, damage: 45, speed: 150, radius: 50, gemTier: 'none', knockbackResist: 1,
    behavior: 'boss', bossBar: true, deathFx: 'big',
    boss: {
      chargeEveryMs: 5000, telegraphMs: 800, chargeMs: 600, chargeSpeedMult: 3.5, summon: 'interceptor', summonCount: 6, summonEveryMs: 8000,
      volley: { everyMs: 3200, count: 7, spreadDeg: 70, boltSpeed: 300, boltDamage: 16 },
      // ninety seconds of a fair fight; after that it outruns anyone and hits twice as hard
      final: { enrageAfterMs: 90000, enrageSpeedMult: 1.6, enrageDmgMult: 2, gold: 300 },
    },
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;
export const ENEMY_LIST: readonly EnemyDef[] = Object.values(ENEMIES);
