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
  // The three chests differ only in how they are earned and how much they pay.
  //
  // All of them home in on the player from anywhere on the field, slightly faster than the player
  // can run, rather than sitting where they dropped. A chest that has to be walked back for is a
  // chest that gets left behind — measured, four of them a run — and on a phone the walk back is
  // not a decision, it is a chore. The decision is whether to fight the thing carrying it.
  chest: {
    id: 'chest', nameKey: 'pickup.chest.name', frame: 'pk_chest', radius: 26,
    effect: { kind: 'chest', grade: 'standard' }, dropChance: 0,
    magnetic: true, magnetRadius: 4000, magnetSpeed: 250, persistent: true, sfx: 'levelup',
  },
  bossChest: {
    id: 'bossChest', nameKey: 'pickup.bossChest.name', frame: 'pk_chest', radius: 30,
    effect: { kind: 'chest', grade: 'boss' }, dropChance: 0,
    magnetic: true, magnetRadius: 4000, magnetSpeed: 250, persistent: true, sfx: 'levelup',
  },
  // the only chest that can fall out of an ordinary kill, and the only one that is not persistent
  wreckChest: {
    id: 'wreckChest', nameKey: 'pickup.wreckChest.name', frame: 'pk_chest', radius: 24,
    effect: { kind: 'chest', grade: 'standard' }, dropChance: 0.004, maxOnGround: 1,
    magnetic: true, magnetRadius: 4000, magnetSpeed: 250, persistent: true, sfx: 'levelup',
  },
} as const satisfies Record<string, PickupDef>;

export type PickupId = keyof typeof PICKUPS;
export const PICKUP_LIST: readonly PickupDef[] = Object.values(PICKUPS);
