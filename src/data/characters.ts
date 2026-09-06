import type { CharacterDef, PlayerStats } from './types';

const BASE_STATS: PlayerStats = {
  maxHealth: 100, recovery: 0, armor: 0, moveSpeed: 1, might: 1, area: 1,
  projectileSpeed: 1, duration: 1, amount: 0, cooldown: 1, luck: 1,
  growth: 1, greed: 1, magnet: 1, revival: 0, curse: 0,
};

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
} as const satisfies Record<string, CharacterDef>;

export type CharacterId = keyof typeof CHARACTERS;
export const CHARACTER_LIST: readonly CharacterDef[] = Object.values(CHARACTERS);
export const DEFAULT_CHARACTER_ID = 'survivor';
