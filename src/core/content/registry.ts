import type { CharacterDef, EnemyDef, PassiveDef, PickupDef, StageDef, WeaponDef } from '../../data/types';
import { WEAPONS } from '../../data/weapons';
import { PASSIVES } from '../../data/passives';
import { ENEMIES } from '../../data/enemies';
import { PICKUPS } from '../../data/pickups';
import { CHARACTERS } from '../../data/characters';
import { STAGES } from '../../data/stages';

export interface ContentRegistry {
  weapons: Readonly<Record<string, WeaponDef>>;
  passives: Readonly<Record<string, PassiveDef>>;
  enemies: Readonly<Record<string, EnemyDef>>;
  pickups: Readonly<Record<string, PickupDef>>;
  characters: Readonly<Record<string, CharacterDef>>;
  stages: Readonly<Record<string, StageDef>>;
  weaponList: readonly WeaponDef[];
  passiveList: readonly PassiveDef[];
  pickupList: readonly PickupDef[];
}

export const CONTENT: ContentRegistry = {
  weapons: WEAPONS,
  passives: PASSIVES,
  enemies: ENEMIES,
  pickups: PICKUPS,
  characters: CHARACTERS,
  stages: STAGES,
  weaponList: Object.values(WEAPONS),
  passiveList: Object.values(PASSIVES),
  pickupList: Object.values(PICKUPS),
};

export function weaponDef(id: string): WeaponDef {
  const d = CONTENT.weapons[id];
  if (!d) throw new Error(`unknown weapon: ${id}`);
  return d;
}
export function passiveDef(id: string): PassiveDef {
  const d = CONTENT.passives[id];
  if (!d) throw new Error(`unknown passive: ${id}`);
  return d;
}
export function enemyDef(id: string): EnemyDef {
  const d = CONTENT.enemies[id];
  if (!d) throw new Error(`unknown enemy: ${id}`);
  return d;
}
export function pickupDef(id: string): PickupDef {
  const d = CONTENT.pickups[id];
  if (!d) throw new Error(`unknown pickup: ${id}`);
  return d;
}
export function characterDef(id: string): CharacterDef {
  const d = CONTENT.characters[id];
  if (!d) throw new Error(`unknown character: ${id}`);
  return d;
}
export function stageDef(id: string): StageDef {
  const d = CONTENT.stages[id];
  if (!d) throw new Error(`unknown stage: ${id}`);
  return d;
}

/**
 * Whether killing this enemy can drop a supply chest. This, and not "has a drop table", is what
 * the chest marker, the autopilot's prize pull and the no-outrunning rule are about: breakable
 * scenery has a drop table too, and a crate is not worth a marker or a detour.
 */
export function carriesChest(def: EnemyDef): boolean {
  return (def.drops ?? []).some((d) => CONTENT.pickups[d.pickup]?.effect.kind === 'chest');
}
