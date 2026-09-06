import type { PickupDef } from './types';

export const PICKUPS = {
  heal: {
    id: 'heal', nameKey: 'pickup.heal.name', frame: 'pk_heal', radius: 18,
    effect: { kind: 'heal', amount: 30 }, dropChance: 0.01, maxOnGround: 3, magnetic: true, sfx: 'pickup',
  },
  vacuum: {
    id: 'vacuum', nameKey: 'pickup.vacuum.name', frame: 'pk_vacuum', radius: 18,
    effect: { kind: 'vacuum' }, dropChance: 0.003, maxOnGround: 2, magnetic: true, sfx: 'pickup',
  },
  nuke: {
    id: 'nuke', nameKey: 'pickup.nuke.name', frame: 'pk_nuke', radius: 18,
    effect: { kind: 'nuke' }, dropChance: 0.002, maxOnGround: 2, magnetic: true, sfx: 'emp',
  },
  coin: {
    id: 'coin', nameKey: 'pickup.coin.name', frame: 'pk_coin', radius: 16,
    effect: { kind: 'gold', amount: 10 }, dropChance: 0.02, maxOnGround: 24, magnetic: true, sfx: 'pickup',
  },
  chest: {
    id: 'chest', nameKey: 'pickup.chest.name', frame: 'pk_chest', radius: 26,
    effect: { kind: 'chest', weaponLevels: 3 }, dropChance: 0, magnetic: false, sfx: 'levelup',
  },
} as const satisfies Record<string, PickupDef>;

export type PickupId = keyof typeof PICKUPS;
export const PICKUP_LIST: readonly PickupDef[] = Object.values(PICKUPS);
