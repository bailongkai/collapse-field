import type { PassiveDef, StatKey, WeaponBehaviorId, WeaponDef } from '../../data/types';

/**
 * The player stats that change what a weapon of each archetype does. Everything takes damage and
 * area; the rest depends on how the archetype spends its parameters. The blade is the case that
 * matters: its sweep resolves on the tick it is made and then lingers as a picture, so duration
 * buys it nothing, and a new player offered +12% duration on their only weapon picked an upgrade
 * and did not get stronger.
 *
 * Kept next to the behaviours rather than in the data because it states what the code does, not
 * what the balance is. `tests/unit/statUse.test.ts` holds it to the behaviours.
 */
export const WEAPON_STAT_USE: Readonly<Record<WeaponBehaviorId, readonly StatKey[]>> = {
  slash: ['might', 'area', 'amount', 'cooldown'],
  aimed: ['might', 'area', 'amount', 'cooldown', 'projectileSpeed'],
  stream: ['might', 'area', 'amount', 'cooldown', 'projectileSpeed'],
  orbit: ['might', 'area', 'amount', 'cooldown', 'duration', 'projectileSpeed'],
  // never fires: its cooldown is infinite and it has no bodies to count
  aura: ['might', 'area'],
  pylon: ['might', 'area', 'amount', 'cooldown', 'duration', 'projectileSpeed'],
  chain: ['might', 'area', 'amount', 'cooldown'],
  pivot: ['might', 'area', 'amount', 'cooldown', 'duration'],
};

/** Stats that act through weapons. Any other stat changes the character and always counts. */
const WEAPON_STATS: ReadonlySet<StatKey> = new Set<StatKey>(['might', 'area', 'amount', 'cooldown', 'duration', 'projectileSpeed']);

export interface PassiveBenefit {
  /** changes the character itself: armour, health, speed and the like */
  player: boolean;
  /** owned weapons it makes stronger, in slot order */
  weapons: string[];
}

/** What a passive would do for the build that is being offered it. */
export function passiveBenefit(passive: PassiveDef, owned: readonly { id: string }[], weapons: Readonly<Record<string, WeaponDef>>): PassiveBenefit {
  const stats = Object.keys(passive.perLevel) as StatKey[];
  const player = stats.some((k) => !WEAPON_STATS.has(k));
  const out: string[] = [];
  for (const o of owned) {
    const def = weapons[o.id];
    if (!def) continue;
    const use = WEAPON_STAT_USE[def.behavior];
    if (stats.some((k) => use.includes(k))) out.push(o.id);
  }
  return { player, weapons: out };
}

/** True when picking the passive would change nothing about the build as it stands. */
export function isDeadPick(passive: PassiveDef, owned: readonly { id: string }[], weapons: Readonly<Record<string, WeaponDef>>): boolean {
  const b = passiveBenefit(passive, owned, weapons);
  return !b.player && b.weapons.length === 0;
}
