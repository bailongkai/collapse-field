import type { CharacterDef, PlayerStats } from './types';

const BASE_STATS: PlayerStats = {
  maxHealth: 100, recovery: 0, armor: 0, moveSpeed: 1, might: 1, area: 1,
  projectileSpeed: 1, duration: 1, amount: 0, cooldown: 1, luck: 1,
  growth: 1, greed: 1, magnet: 1, revival: 0, curse: 0,
};
const stats = (over: Partial<PlayerStats>): PlayerStats => ({ ...BASE_STATS, ...over });

/**
 * Eight characters for eight starting weapons. A character is stats plus a starting weapon plus a
 * level-up bonus, and that is enough: the blade sweeps both sides, the laser aims itself, the
 * railgun is a cone, the drones orbit and the field is an aura, so the first minute already plays
 * eight different ways before a single upgrade is chosen: the pylons are placed and stay where
 * they were put, the conduit will not fire at all unless a body is close, and the pivot cannon
 * fires only on the tick the player turns.
 */
export const CHARACTERS = {
  survivor: {
    id: 'survivor',
    nameKey: 'character.survivor.name',
    descKey: 'character.survivor.desc',
    frame: 'player',
    radius: 16,
    baseStats: BASE_STATS,
    startingWeapon: 'plasmaBlade',
    levelBonuses: [{ everyLevels: 10, stat: 'might', amount: 0.1 }],
    signature: { kind: 'secondWind', nameKey: 'signature.survivor.name', descKey: 'signature.survivor.desc', threshold: 0.3, healFraction: 0.3, invulnMs: 2000, cooldownMs: 60_000 },
  },
  // 陆战队员: firepower. Slightly slower, and the only character whose growth is more shots.
  marine: {
    id: 'marine',
    nameKey: 'character.marine.name',
    descKey: 'character.marine.desc',
    frame: 'player_marine',
    radius: 16,
    baseStats: stats({ might: 1.15, maxHealth: 110, moveSpeed: 0.95 }),
    startingWeapon: 'railgun',
    levelBonuses: [{ everyLevels: 15, stat: 'amount', amount: 1 }],
    signature: { kind: 'killStreak', nameKey: 'signature.marine.name', descKey: 'signature.marine.desc', kills: 25, bonus: { amount: 2 }, durationMs: 5000 },
    cost: 600,
  },
  // 系统工程师: a glass cannon that builds fast. Cooldown, luck and magnet, on 85 health.
  engineer: {
    id: 'engineer',
    nameKey: 'character.engineer.name',
    descKey: 'character.engineer.desc',
    frame: 'player_engineer',
    radius: 15,
    baseStats: stats({ cooldown: 0.95, luck: 1.15, magnet: 1.3, maxHealth: 85, might: 0.9 }),
    startingWeapon: 'guidedLaser',
    levelBonuses: [{ everyLevels: 12, stat: 'cooldown', amount: -0.03 }],
    signature: { kind: 'chestSurge', nameKey: 'signature.engineer.name', descKey: 'signature.engineer.desc', bonus: { cooldown: -0.5 }, durationMs: 10_000 },
    cost: 800,
  },
  // 维护单元 M-7: the tank. Wades in behind an aura; slow, armoured, and it regenerates.
  unit: {
    id: 'unit',
    nameKey: 'character.unit.name',
    descKey: 'character.unit.desc',
    frame: 'player_unit',
    radius: 17,
    baseStats: stats({ maxHealth: 120, armor: 1, recovery: 0.2, moveSpeed: 0.85, might: 0.9 }),
    startingWeapon: 'empField',
    levelBonuses: [{ everyLevels: 12, stat: 'armor', amount: 1 }],
    signature: { kind: 'shield', nameKey: 'signature.unit.name', descKey: 'signature.unit.desc', cooldownMs: 75_000 },
    cost: 1000,
  },
  // 领航员: growth and greed. Only a little faster — speed is the one stat that makes running
  // away stronger, and the stage already struggles to punish that.
  navigator: {
    id: 'navigator',
    nameKey: 'character.navigator.name',
    descKey: 'character.navigator.desc',
    frame: 'player_navigator',
    radius: 15,
    baseStats: stats({ moveSpeed: 1.05, growth: 1.15, greed: 1.25, maxHealth: 90 }),
    startingWeapon: 'orbitalDrones',
    levelBonuses: [{ everyLevels: 10, stat: 'growth', amount: 0.05 }],
    signature: { kind: 'onHurt', nameKey: 'signature.navigator.name', descKey: 'signature.navigator.desc', bonus: { moveSpeed: 0.6 }, durationMs: 2000, cooldownMs: 8000 },
    cost: 1200,
  },

  /**
   * 阵地工兵: the only character who cannot simply outrun the answer, and the only one whose weapon
   * stays where she puts it. Standing still plants an anchor and the stacks build; panicking and
   * running sheds them.
   */
  sapper: {
    id: 'sapper',
    nameKey: 'character.sapper.name',
    descKey: 'character.sapper.desc',
    frame: 'player_sapper',
    radius: 16,
    baseStats: stats({ maxHealth: 110, armor: 1, moveSpeed: 0.88, might: 0.9, area: 1.1, magnet: 1.15 }),
    startingWeapon: 'arcPylons',
    levelBonuses: [{ everyLevels: 12, stat: 'area', amount: 0.05 }],
    signature: { kind: 'dugIn', nameKey: 'signature.sapper.name', descKey: 'signature.sapper.desc', radius: 140, rampMs: 1800, maxStacks: 4, perStack: { might: 0.05, armor: 0.4 }, decayMs: 900 },
    cost: 1400,
  },
  // 熔接工: armour that only exists while the crowd is on top of him, which is the one character
  // whose defence and whose damage are both paid for by the same decision.
  welder: {
    id: 'welder',
    nameKey: 'character.welder.name',
    descKey: 'character.welder.desc',
    frame: 'player_welder',
    radius: 17,
    baseStats: stats({ maxHealth: 95, recovery: 0.3, moveSpeed: 0.9, might: 1, area: 1.1 }),
    startingWeapon: 'arcConduit',
    levelBonuses: [{ everyLevels: 12, stat: 'recovery', amount: 0.15 }],
    signature: { kind: 'pressure', nameKey: 'signature.welder.name', descKey: 'signature.welder.desc', radius: 96, minEnemies: 8, maxStacks: 8, perEnemy: { armor: 1, recovery: 0.15 } },
    cost: 1500,
  },
  // 炮长: eighty health, and a gun that only goes off when she turns. The most fragile character in
  // the game and the only one whose damage is a matter of timing rather than position.
  gunner: {
    id: 'gunner',
    nameKey: 'character.gunner.name',
    descKey: 'character.gunner.desc',
    frame: 'player_gunner',
    radius: 16,
    baseStats: stats({ maxHealth: 80, might: 1.1, area: 1.2, projectileSpeed: 1.25 }),
    startingWeapon: 'pivotCannon',
    levelBonuses: [{ everyLevels: 14, stat: 'area', amount: 0.08 }],
    signature: { kind: 'reversal', nameKey: 'signature.gunner.name', descKey: 'signature.gunner.desc', count: 5, arcDeg: 70, range: 320, bonus: { might: 0.5, cooldown: -0.3 }, durationMs: 4000, cooldownMs: 9000 },
    cost: 1600,
  },
} as const satisfies Record<string, CharacterDef>;

export type CharacterId = keyof typeof CHARACTERS;
export const CHARACTER_LIST: readonly CharacterDef[] = Object.values(CHARACTERS);
export const DEFAULT_CHARACTER_ID = 'survivor';
