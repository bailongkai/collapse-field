import type { CharacterDef, PlayerStats } from './types';

const BASE_STATS: PlayerStats = {
  maxHealth: 100, recovery: 0, armor: 0, moveSpeed: 1, might: 1, area: 1,
  projectileSpeed: 1, duration: 1, amount: 0, cooldown: 1, luck: 1,
  growth: 1, greed: 1, magnet: 1, revival: 0, curse: 0,
};
const stats = (over: Partial<PlayerStats>): PlayerStats => ({ ...BASE_STATS, ...over });

/**
 * Five characters for five starting weapons. A character is stats plus a starting weapon plus a
 * level-up bonus, and that is enough: the blade sweeps both sides, the laser aims itself, the
 * railgun is a cone, the drones orbit and the field is an aura, so the first minute already plays
 * five different ways before a single upgrade is chosen.
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
    cost: 600,
  },
  // 系统工程师: a glass cannon that builds fast. Cooldown, luck and magnet, on 85 health.
  engineer: {
    id: 'engineer',
    nameKey: 'character.engineer.name',
    descKey: 'character.engineer.desc',
    frame: 'player_engineer',
    radius: 15,
    baseStats: stats({ cooldown: 0.9, luck: 1.2, magnet: 1.3, maxHealth: 85, might: 0.95 }),
    startingWeapon: 'guidedLaser',
    levelBonuses: [{ everyLevels: 10, stat: 'cooldown', amount: -0.05 }],
    cost: 800,
  },
  // 维护单元 M-7: the tank. Wades in behind an aura; slow, armoured, and it regenerates.
  unit: {
    id: 'unit',
    nameKey: 'character.unit.name',
    descKey: 'character.unit.desc',
    frame: 'player_unit',
    radius: 17,
    baseStats: stats({ maxHealth: 150, armor: 2, recovery: 0.5, moveSpeed: 0.85, might: 0.9 }),
    startingWeapon: 'empField',
    levelBonuses: [{ everyLevels: 10, stat: 'armor', amount: 1 }],
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
    baseStats: stats({ moveSpeed: 1.1, growth: 1.15, greed: 1.25, maxHealth: 90 }),
    startingWeapon: 'orbitalDrones',
    levelBonuses: [{ everyLevels: 10, stat: 'growth', amount: 0.05 }],
    cost: 1200,
  },
} as const satisfies Record<string, CharacterDef>;

export type CharacterId = keyof typeof CHARACTERS;
export const CHARACTER_LIST: readonly CharacterDef[] = Object.values(CHARACTERS);
export const DEFAULT_CHARACTER_ID = 'survivor';
