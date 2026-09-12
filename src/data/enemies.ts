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
  // ---- the final bosses, at fifteen minutes: one per stage, each the stage's own idea taken to the end ----
  juggernaut: {
    id: 'juggernaut', nameKey: 'enemy.juggernaut.name', frame: 'enemy_juggernaut', faceTarget: false,
    hp: 3600, damage: 55, speed: 110, radius: 74, gemTier: 'none', knockbackResist: 1,
    behavior: 'boss', bossBar: true, deathFx: 'big',
    boss: {
      // the deck's answer: slow, enormous, and the floor behind it is a minefield
      chargeEveryMs: 4000, telegraphMs: 900, chargeMs: 900, chargeSpeedMult: 6, summon: 'loader', summonCount: 3, summonEveryMs: 12000,
      mine: { enemy: 'mine', everyMs: 1200, max: 20 },
      final: { enrageAfterMs: 90000, enrageSpeedMult: 2.2, enrageDmgMult: 2, gold: 300 },
    },
  },
  hivequeen: {
    id: 'hivequeen', nameKey: 'enemy.hivequeen.name', frame: 'enemy_hivequeen', faceTarget: false,
    hp: 3000, damage: 40, speed: 95, radius: 78, gemTier: 'none', knockbackResist: 1,
    behavior: 'boss', bossBar: true, deathFx: 'big',
    split: { enemy: 'spore', count: 20 },
    boss: {
      // the lab's answer: never charges, pulls you into the brood it keeps hatching
      chargeEveryMs: 1e9, telegraphMs: 600, chargeMs: 400, chargeSpeedMult: 1, summon: 'spore', summonCount: 14, summonEveryMs: 3500,
      pull: { range: 340, strength: 150 },
      final: { enrageAfterMs: 90000, enrageSpeedMult: 2.5, enrageDmgMult: 2, gold: 300 },
    },
  },
  voidship: {
    id: 'voidship', nameKey: 'enemy.voidship.name', frame: 'enemy_voidship', faceTarget: false,
    hp: 3200, damage: 45, speed: 170, radius: 64, gemTier: 'none', knockbackResist: 1,
    behavior: 'boss', bossBar: true, deathFx: 'big',
    boss: {
      // the orbit's answer: it is already fast, and it does not need to cross the gap to reach you
      chargeEveryMs: 1e9, telegraphMs: 450, chargeMs: 500, chargeSpeedMult: 4.5, summon: 'phaser', summonCount: 4, summonEveryMs: 8000,
      blink: { everyMs: 4000, distance: 300, telegraphMs: 450 },
      volley: { everyMs: 2800, count: 9, spreadDeg: 360, boltSpeed: 240, boltDamage: 14 },
      final: { enrageAfterMs: 90000, enrageSpeedMult: 1.5, enrageDmgMult: 2, gold: 300 },
    },
  },
  // the station's, and the first one a player meets
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
  // ===== 熔毁反应层 / Meltdown Deck =====
  slagger: {
    id: 'slagger', nameKey: 'enemy.slagger.name', frame: 'enemy_slagger', faceTarget: true,
    hp: 40, damage: 9, speed: 130, radius: 18, gemTier: 'green', knockbackResist: 0.25,
    behavior: 'chase', deathFx: 'small', split: { enemy: 'slagPool', count: 1 },
  },
  slagPool: {
    id: 'slagPool', nameKey: 'enemy.slagPool.name', frame: 'enemy_slagPool', faceTarget: false,
    hp: 26, damage: 0, speed: 0, radius: 56, gemTier: 'none', knockbackResist: 1,
    behavior: 'mire', deathFx: 'small',
    mire: { radius: 78, dragPxPerSec: 84, ttlMs: 6500, fadeMs: 1000 },
  },
  bombard: {
    id: 'bombard', nameKey: 'enemy.bombard.name', frame: 'enemy_bombard', faceTarget: false,
    hp: 76, damage: 8, speed: 46, radius: 21, gemTier: 'green', knockbackResist: 0.5,
    behavior: 'mortar', deathFx: 'big',
    mortar: { standRange: 520, retreatRange: 400, retreatSpeedMult: 0.7, windupMs: 800, salvo: 2, salvoGapMs: 280, intervalMs: 4800, leadPx: 150, spreadPx: 46, shell: 'bombardShell', maxShells: 6 },
  },
  bombardShell: {
    id: 'bombardShell', nameKey: 'enemy.bombardShell.name', frame: 'enemy_bombardShell', faceTarget: false,
    hp: 20, damage: 0, speed: 0, radius: 16, gemTier: 'none', knockbackResist: 1,
    behavior: 'bomber', deathFx: 'big',
    explode: { triggerRange: 9999, fuseMs: 1150, radius: 120, damage: 22 },
  },
  pinner: {
    id: 'pinner', nameKey: 'enemy.pinner.name', frame: 'enemy_pinner', faceTarget: true,
    hp: 60, damage: 6, speed: 60, radius: 19, gemTier: 'green', knockbackResist: 0.4,
    behavior: 'suppressor', deathFx: 'small',
    suppress: { armRange: 300, windupMs: 1300, tellAt: 0.55, decayMult: 2.2, count: 5, spreadDeg: 34, boltSpeed: 300, boltDamage: 13, cooldownMs: 3400, advanceSpeedMult: 0.55 },
  },
  coolantTank: {
    id: 'coolantTank', nameKey: 'enemy.coolantTank.name', frame: 'enemy_coolantTank', faceTarget: false,
    hp: 32, damage: 0, speed: 0, radius: 22, gemTier: 'none', knockbackResist: 1,
    behavior: 'prop', deathFx: 'big', drops: [{ pickup: 'coin', chance: 0.65 }, { pickup: 'heal', chance: 0.15 }], split: { enemy: 'slagPool', count: 1 },
  },
  siegeShell: {
    id: 'siegeShell', nameKey: 'enemy.siegeShell.name', frame: 'enemy_siegeShell', faceTarget: false,
    hp: 34, damage: 0, speed: 0, radius: 18, gemTier: 'none', knockbackResist: 1,
    behavior: 'bomber', deathFx: 'big',
    explode: { triggerRange: 9999, fuseMs: 1300, radius: 150, damage: 30 },
  },
  slagmaw: {
    id: 'slagmaw', nameKey: 'enemy.slagmaw.name', frame: 'enemy_slagmaw', faceTarget: false,
    hp: 760, damage: 26, speed: 46, radius: 64, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }],
    boss: { chargeEveryMs: 6500, telegraphMs: 1000, chargeMs: 700, chargeSpeedMult: 5, summon: 'slagPool', summonCount: 3, summonEveryMs: 7000 },
  },
  cannonade: {
    id: 'cannonade', nameKey: 'enemy.cannonade.name', frame: 'enemy_cannonade', faceTarget: false,
    hp: 700, damage: 28, speed: 40, radius: 66, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }],
    boss: { chargeEveryMs: 1e+09, telegraphMs: 700, chargeMs: 500, chargeSpeedMult: 1, summon: 'pinner', summonCount: 2, summonEveryMs: 11000, mortar: { windupMs: 900, salvo: 4, salvoGapMs: 260, intervalMs: 5000, leadPx: 150, spreadPx: 70, shell: 'siegeShell', maxShells: 10 } },
  },
  meltdown: {
    id: 'meltdown', nameKey: 'enemy.meltdown.name', frame: 'enemy_meltdown', faceTarget: false,
    hp: 3400, damage: 48, speed: 105, radius: 76, gemTier: 'none', knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true,
    boss: { chargeEveryMs: 4600, telegraphMs: 800, chargeMs: 700, chargeSpeedMult: 4.5, summon: 'slagPool', summonCount: 3, summonEveryMs: 7000, pulse: { everyMs: 5200, telegraphMs: 1000, radius: 240, damage: 32 }, final: { enrageAfterMs: 90000, enrageSpeedMult: 2.3, enrageDmgMult: 2, gold: 300 } },
  },
  // ===== 漂流残骸舰 / Derelict Hulk =====
  crewHusk: {
    id: 'crewHusk', nameKey: 'enemy.crewHusk.name', frame: 'enemy_crewHusk', faceTarget: true,
    hp: 20, damage: 7, speed: 74, radius: 16, gemTier: 'blue', knockbackResist: 0.15,
    behavior: 'chase', deathFx: 'small',
  },
  ventCrawler: {
    id: 'ventCrawler', nameKey: 'enemy.ventCrawler.name', frame: 'enemy_ventCrawler', faceTarget: false,
    hp: 24, damage: 10, speed: 95, radius: 15, gemTier: 'green', knockbackResist: 0.25,
    behavior: 'flanker', deathFx: 'small',
    flank: { hoverRange: 160, columnHalfWidth: 56, columnJitterPx: 34, arcSpeedMult: 2.6, settleMs: 450, diveSpeedMult: 4.2, diveMs: 340, recoverMs: 900 },
  },
  plateWelder: {
    id: 'plateWelder', nameKey: 'enemy.plateWelder.name', frame: 'enemy_plateWelder', faceTarget: false,
    hp: 105, damage: 15, speed: 55, radius: 24, gemTier: 'green', gemCount: 2, knockbackResist: 0.85,
    behavior: 'bulwark', deathFx: 'big',
    bulwark: { arcDeg: 150, frontScale: 0.3, turnDegPerSec: 32, walkFacing: true, tellEveryMs: 600 },
  },
  deckGun: {
    id: 'deckGun', nameKey: 'enemy.deckGun.name', frame: 'enemy_deckGun', faceTarget: false,
    hp: 76, damage: 8, speed: 46, radius: 20, gemTier: 'green', gemCount: 2, knockbackResist: 0.5,
    behavior: 'mortar', deathFx: 'big',
    mortar: { standRange: 520, retreatRange: 400, retreatSpeedMult: 0.7, windupMs: 800, salvo: 2, salvoGapMs: 280, intervalMs: 4600, leadPx: 150, spreadPx: 46, shell: 'deckShell', maxShells: 6 },
  },
  deckShell: {
    id: 'deckShell', nameKey: 'enemy.deckShell.name', frame: 'enemy_deckShell', faceTarget: false,
    hp: 20, damage: 0, speed: 0, radius: 16, gemTier: 'none', knockbackResist: 1,
    behavior: 'bomber', deathFx: 'big',
    explode: { triggerRange: 9999, fuseMs: 1150, radius: 120, damage: 22 },
  },
  cableRig: {
    id: 'cableRig', nameKey: 'enemy.cableRig.name', frame: 'enemy_cableRig', faceTarget: false,
    hp: 78, damage: 10, speed: 68, radius: 20, gemTier: 'green', knockbackResist: 0.45,
    behavior: 'tether', deathFx: 'small',
    tether: { linkRange: 300, breakRange: 420, relinkMs: 400, beamHalfWidth: 24, push: 320, approachSpeedMult: 0.85 },
  },
  cryopod: {
    id: 'cryopod', nameKey: 'enemy.cryopod.name', frame: 'enemy_cryopod', faceTarget: false,
    hp: 34, damage: 0, speed: 0, radius: 22, gemTier: 'none', knockbackResist: 1,
    behavior: 'prop', deathFx: 'small', drops: [{ pickup: 'coin', chance: 0.65 }, { pickup: 'heal', chance: 0.18 }, { pickup: 'vacuum', chance: 0.04 }],
  },
  salvageArm: {
    id: 'salvageArm', nameKey: 'enemy.salvageArm.name', frame: 'enemy_salvageArm', faceTarget: false,
    hp: 540, damage: 26, speed: 48, radius: 58, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }],
    boss: { chargeEveryMs: 5200, telegraphMs: 900, chargeMs: 700, chargeSpeedMult: 4.2, summon: 'plateWelder', summonCount: 2, summonEveryMs: 15000, shield: { arcDeg: 160, frontScale: 0.3, turnDegPerSec: 26, tellEveryMs: 600, chargeAlongFacing: true } },
  },
  anchorWinch: {
    id: 'anchorWinch', nameKey: 'enemy.anchorWinch.name', frame: 'enemy_anchorWinch', faceTarget: false,
    hp: 680, damage: 28, speed: 62, radius: 64, gemTier: 'red', gemCount: 13, knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }],
    boss: { chargeEveryMs: 1e+09, telegraphMs: 700, chargeMs: 400, chargeSpeedMult: 1, summon: 'cableRig', summonCount: 4, summonEveryMs: 5000, harpoon: { everyMs: 5200, telegraphMs: 700, range: 900, pull: 300, durationMs: 1100, damage: 14 }, mortar: { windupMs: 900, salvo: 4, salvoGapMs: 260, intervalMs: 5000, leadPx: 150, spreadPx: 70, shell: 'deckShell', maxShells: 10 } },
  },
  sleeper: {
    id: 'sleeper', nameKey: 'enemy.sleeper.name', frame: 'enemy_sleeper', faceTarget: false,
    hp: 3200, damage: 48, speed: 92, radius: 72, gemTier: 'none', knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true,
    boss: { chargeEveryMs: 5000, telegraphMs: 800, chargeMs: 700, chargeSpeedMult: 4, summon: 'ventCrawler', summonCount: 5, summonEveryMs: 8000, rotor: { arcDeg: 150, frontScale: 0.18, spinDegPerSec: 42, reverseEveryMs: 6500, tellEveryMs: 500, enrageSpinMult: 1.8, chargeAlongFacing: true }, mortar: { windupMs: 800, salvo: 3, salvoGapMs: 240, intervalMs: 4200, leadPx: 150, spreadPx: 80, shell: 'deckShell', maxShells: 12 }, final: { enrageAfterMs: 90000, enrageSpeedMult: 2.3, enrageDmgMult: 2, gold: 300 } },
  },
  // ===== 战争铸造厂 / War Foundry =====
  blank: {
    id: 'blank', nameKey: 'enemy.blank.name', frame: 'enemy_blank', faceTarget: true,
    hp: 14, damage: 6, speed: 86, radius: 15, gemTier: 'blue', knockbackResist: 0.1,
    behavior: 'chase', deathFx: 'small',
  },
  assembler: {
    id: 'assembler', nameKey: 'enemy.assembler.name', frame: 'enemy_assembler', faceTarget: false,
    hp: 150, damage: 5, speed: 0, radius: 28, gemTier: 'red', gemCount: 3, knockbackResist: 1,
    behavior: 'nest', deathFx: 'big', drops: [{ pickup: 'coin', chance: 0.35 }],
    nest: { summon: 'blank', count: 3, intervalMs: 3400 },
  },
  castwall: {
    id: 'castwall', nameKey: 'enemy.castwall.name', frame: 'enemy_castwall', faceTarget: false,
    hp: 120, damage: 18, speed: 54, radius: 25, gemTier: 'green', knockbackResist: 0.85,
    behavior: 'bulwark', deathFx: 'big',
    bulwark: { arcDeg: 110, frontScale: 0.22, turnDegPerSec: 45, walkFacing: true, tellEveryMs: 600 },
  },
  rivetgun: {
    id: 'rivetgun', nameKey: 'enemy.rivetgun.name', frame: 'enemy_rivetgun', faceTarget: true,
    hp: 58, damage: 6, speed: 62, radius: 18, gemTier: 'green', knockbackResist: 0.4,
    behavior: 'suppressor', deathFx: 'small',
    suppress: { armRange: 300, windupMs: 1300, tellAt: 0.55, decayMult: 2.2, count: 3, spreadDeg: 26, boltSpeed: 300, boltDamage: 26, cooldownMs: 3600, advanceSpeedMult: 0.55 },
  },
  arcwelder: {
    id: 'arcwelder', nameKey: 'enemy.arcwelder.name', frame: 'enemy_arcwelder', faceTarget: true,
    hp: 34, damage: 4, speed: 72, radius: 16, gemTier: 'green', knockbackResist: 0.25,
    behavior: 'healer', deathFx: 'small',
    heal: { range: 300, intervalMs: 1300, amount: 16, keepDistance: 200 },
  },
  reclaimer: {
    id: 'reclaimer', nameKey: 'enemy.reclaimer.name', frame: 'enemy_reclaimer', faceTarget: false,
    hp: 48, damage: 5, speed: 116, radius: 16, gemTier: 'red', gemCount: 10, knockbackResist: 0.1,
    behavior: 'scavenger', deathFx: 'small',
    scavenge: { fleeRange: 260, fleeSpeedMult: 1.15, seekRange: 280, eatRadius: 30, eatPauseMs: 260, maxGemValue: 12, gemsMax: 20, scanMs: 150, escapeMs: 18000, escapeTellMs: 900 },
  },
  ingotstack: {
    id: 'ingotstack', nameKey: 'enemy.ingotstack.name', frame: 'enemy_ingotstack', faceTarget: false,
    hp: 38, damage: 0, speed: 0, radius: 22, gemTier: 'none', knockbackResist: 1,
    behavior: 'prop', deathFx: 'small', drops: [{ pickup: 'coin', chance: 0.65 }, { pickup: 'heal', chance: 0.15 }],
  },
  forgepress: {
    id: 'forgepress', nameKey: 'enemy.forgepress.name', frame: 'enemy_forgepress', faceTarget: false,
    hp: 700, damage: 26, speed: 50, radius: 62, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], split: { enemy: 'castwall', count: 4 },
    boss: { chargeEveryMs: 5200, telegraphMs: 1200, chargeMs: 600, chargeSpeedMult: 7, summon: 'castwall', summonCount: 2, summonEveryMs: 8500, pull: { range: 240, strength: 95 } },
  },
  proliferator: {
    id: 'proliferator', nameKey: 'enemy.proliferator.name', frame: 'enemy_proliferator', faceTarget: false,
    hp: 720, damage: 30, speed: 52, radius: 64, gemTier: 'red', gemCount: 14, knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }], split: { enemy: 'assembler', count: 3 },
    boss: { chargeEveryMs: 7000, telegraphMs: 900, chargeMs: 900, chargeSpeedMult: 5, summon: 'assembler', summonCount: 2, summonEveryMs: 8000 },
  },
  foundrycore: {
    id: 'foundrycore', nameKey: 'enemy.foundrycore.name', frame: 'enemy_foundrycore', faceTarget: false,
    hp: 3400, damage: 48, speed: 120, radius: 76, gemTier: 'none', knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true,
    boss: { chargeEveryMs: 4600, telegraphMs: 800, chargeMs: 800, chargeSpeedMult: 4.5, summon: 'arcwelder', summonCount: 2, summonEveryMs: 7000, volley: { everyMs: 3000, count: 6, spreadDeg: 52, boltSpeed: 280, boltDamage: 18 }, final: { enrageAfterMs: 90000, enrageSpeedMult: 2, enrageDmgMult: 2, gold: 300 } },
  },
  // ===== 塌缩带 / The Collapse Field =====
  collapser: {
    id: 'collapser', nameKey: 'enemy.collapser.name', frame: 'enemy_collapser', faceTarget: true,
    hp: 44, damage: 9, speed: 76, radius: 18, gemTier: 'green', knockbackResist: 0.2,
    behavior: 'chase', deathFx: 'small', split: { enemy: 'gravwell', count: 1 },
  },
  gravwell: {
    id: 'gravwell', nameKey: 'enemy.gravwell.name', frame: 'enemy_gravwell', faceTarget: false,
    hp: 12, damage: 0, speed: 0, radius: 56, gemTier: 'none', knockbackResist: 1,
    behavior: 'mire', deathFx: 'small',
    mire: { radius: 96, dragPxPerSec: 84, ttlMs: 8000, fadeMs: 1200 },
  },
  voidTug: {
    id: 'voidTug', nameKey: 'enemy.voidTug.name', frame: 'enemy_voidTug', faceTarget: true,
    hp: 95, damage: 8, speed: 58, radius: 22, gemTier: 'green', knockbackResist: 0.6,
    behavior: 'tractor', deathFx: 'big',
    tractor: { range: 320, pull: 110, keepDistance: 240 },
  },
  riftAnchor: {
    id: 'riftAnchor', nameKey: 'enemy.riftAnchor.name', frame: 'enemy_riftAnchor', faceTarget: false,
    hp: 88, damage: 11, speed: 70, radius: 20, gemTier: 'green', knockbackResist: 0.45,
    behavior: 'tether', deathFx: 'small',
    tether: { linkRange: 300, breakRange: 420, relinkMs: 400, beamHalfWidth: 24, push: 240, approachSpeedMult: 0.85 },
  },
  imploder: {
    id: 'imploder', nameKey: 'enemy.imploder.name', frame: 'enemy_imploder', faceTarget: false,
    hp: 82, damage: 8, speed: 50, radius: 20, gemTier: 'green', knockbackResist: 0.5,
    behavior: 'mortar', deathFx: 'big',
    mortar: { standRange: 520, retreatRange: 400, retreatSpeedMult: 0.7, windupMs: 800, salvo: 2, salvoGapMs: 280, intervalMs: 4600, leadPx: 150, spreadPx: 46, shell: 'implodeShell', maxShells: 6 },
  },
  implodeShell: {
    id: 'implodeShell', nameKey: 'enemy.implodeShell.name', frame: 'enemy_implodeShell', faceTarget: false,
    hp: 20, damage: 0, speed: 0, radius: 16, gemTier: 'none', knockbackResist: 1,
    behavior: 'bomber', deathFx: 'big',
    explode: { triggerRange: 9999, fuseMs: 1150, radius: 120, damage: 22 },
  },
  riftShard: {
    id: 'riftShard', nameKey: 'enemy.riftShard.name', frame: 'enemy_riftShard', faceTarget: false,
    hp: 48, damage: 0, speed: 80, radius: 22, gemTier: 'none', knockbackResist: 1,
    behavior: 'prop', deathFx: 'big', drops: [{ pickup: 'coin', chance: 0.7 }, { pickup: 'heal', chance: 0.12 }, { pickup: 'vacuum', chance: 0.04 }],
  },
  accretionMass: {
    id: 'accretionMass', nameKey: 'enemy.accretionMass.name', frame: 'enemy_accretionMass', faceTarget: false,
    hp: 90, damage: 20, speed: 0, radius: 22, gemTier: 'none', knockbackResist: 1,
    behavior: 'chase', deathFx: 'small',
  },
  tideShell: {
    id: 'tideShell', nameKey: 'enemy.tideShell.name', frame: 'enemy_tideShell', faceTarget: false,
    hp: 30, damage: 0, speed: 0, radius: 18, gemTier: 'none', knockbackResist: 1,
    behavior: 'bomber', deathFx: 'big',
    explode: { triggerRange: 9999, fuseMs: 1300, radius: 140, damage: 30 },
  },
  accretor: {
    id: 'accretor', nameKey: 'enemy.accretor.name', frame: 'enemy_accretor', faceTarget: false,
    hp: 880, damage: 28, speed: 48, radius: 58, gemTier: 'red', gemCount: 12, knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }],
    boss: { chargeEveryMs: 5200, telegraphMs: 800, chargeMs: 700, chargeSpeedMult: 4.5, summon: 'collapser', summonCount: 4, summonEveryMs: 9000, pull: { range: 320, strength: 115 }, accretion: { enemy: 'accretionMass', count: 10, radius: 170, degPerSec: 18, refillMs: 2600 } },
  },
  tidalhulk: {
    id: 'tidalhulk', nameKey: 'enemy.tidalhulk.name', frame: 'enemy_tidalhulk', faceTarget: false,
    hp: 780, damage: 32, speed: 44, radius: 68, gemTier: 'red', gemCount: 14, knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true, drops: [{ pickup: 'bossChest', chance: 1 }],
    boss: { chargeEveryMs: 1e+09, telegraphMs: 700, chargeMs: 400, chargeSpeedMult: 1, summon: 'voidTug', summonCount: 3, summonEveryMs: 10000, tide: { everyMs: 5600, telegraphMs: 700, inhaleMs: 1300, range: 640, pullStrength: 300, pushMs: 350, pushStrength: 420 }, mortar: { windupMs: 700, salvo: 4, salvoGapMs: 260, intervalMs: 5600, leadPx: 120, spreadPx: 110, shell: 'tideShell', maxShells: 10 } },
  },
  eventhorizon: {
    id: 'eventhorizon', nameKey: 'enemy.eventhorizon.name', frame: 'enemy_eventhorizon', faceTarget: false,
    hp: 3550, damage: 52, speed: 120, radius: 78, gemTier: 'none', knockbackResist: 1,
    behavior: 'boss', deathFx: 'big', bossBar: true,
    boss: { chargeEveryMs: 6500, telegraphMs: 700, chargeMs: 700, chargeSpeedMult: 5, summon: 'riftAnchor', summonCount: 4, summonEveryMs: 8500, pull: { range: 520, strength: 130 }, collapse: { everyMs: 12000, telegraphMs: 1400, drawMs: 800, drawSpeed: 300, radius: 240, damage: 58 }, final: { enrageAfterMs: 90000, enrageSpeedMult: 1.7, enrageDmgMult: 2, gold: 300 } },
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;
export const ENEMY_LIST: readonly EnemyDef[] = Object.values(ENEMIES);
