import type { PassiveDef } from './types';

/** Passive items. `perLevel` is added once per level; mult stats are fractional bonuses. */
export const PASSIVES = {
  reactorCore: {
    id: 'reactorCore', nameKey: 'passive.reactorCore.name', descKey: 'passive.reactorCore.desc',
    icon: 'icon_reactorCore', rarity: 100, maxLevel: 5, perLevel: { might: 0.1 },
  },
  nanoArmor: {
    id: 'nanoArmor', nameKey: 'passive.nanoArmor.name', descKey: 'passive.nanoArmor.desc',
    icon: 'icon_nanoArmor', rarity: 90, maxLevel: 5, perLevel: { armor: 1 },
  },
  lifeCore: {
    id: 'lifeCore', nameKey: 'passive.lifeCore.name', descKey: 'passive.lifeCore.desc',
    icon: 'icon_lifeCore', rarity: 90, maxLevel: 5, perLevel: { maxHealth: 0.2 },
  },
  coolingSystem: {
    id: 'coolingSystem', nameKey: 'passive.coolingSystem.name', descKey: 'passive.coolingSystem.desc',
    icon: 'icon_coolingSystem', rarity: 70, maxLevel: 5, perLevel: { cooldown: -0.08 },
  },
  fieldAmp: {
    id: 'fieldAmp', nameKey: 'passive.fieldAmp.name', descKey: 'passive.fieldAmp.desc',
    icon: 'icon_fieldAmp', rarity: 70, maxLevel: 5, perLevel: { area: 0.1 },
  },
  thrusters: {
    id: 'thrusters', nameKey: 'passive.thrusters.name', descKey: 'passive.thrusters.desc',
    icon: 'p_flare', rarity: 60, maxLevel: 3, perLevel: { moveSpeed: 0.06 },
  },
  magazine: {
    id: 'magazine', nameKey: 'passive.magazine.name', descKey: 'passive.magazine.desc',
    icon: 'bolt_rail', rarity: 40, maxLevel: 2, perLevel: { amount: 1 },
  },
  magnetCore: {
    id: 'magnetCore', nameKey: 'passive.magnetCore.name', descKey: 'passive.magnetCore.desc',
    icon: 'pk_vacuum', rarity: 60, maxLevel: 3, perLevel: { magnet: 0.5 },
  },
} as const satisfies Record<string, PassiveDef>;

export type PassiveId = keyof typeof PASSIVES;
export const PASSIVE_LIST: readonly PassiveDef[] = Object.values(PASSIVES);
