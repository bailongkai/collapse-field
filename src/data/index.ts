export * from './types';
export { WEAPONS, WEAPON_LIST } from './weapons';
export { PASSIVES, PASSIVE_LIST } from './passives';
export { ENEMIES, ENEMY_LIST } from './enemies';
export { PICKUPS, PICKUP_LIST } from './pickups';
export { CHARACTERS, CHARACTER_LIST, DEFAULT_CHARACTER_ID } from './characters';
export { STAGES, STAGE_LIST, DEFAULT_STAGE_ID } from './stages';

import { WEAPONS } from './weapons';
import { PASSIVES } from './passives';
import { ENEMIES } from './enemies';
import { PICKUPS } from './pickups';
import { CHARACTERS } from './characters';
import { STAGES } from './stages';

/** Consumed by the debug hook so tests can enumerate ids without importing the tables. */
export function contentSummary(): { weapons: string[]; passives: string[]; enemies: string[]; pickups: string[]; characters: string[]; stages: string[] } {
  return {
    weapons: Object.keys(WEAPONS),
    passives: Object.keys(PASSIVES),
    enemies: Object.keys(ENEMIES),
    pickups: Object.keys(PICKUPS),
    characters: Object.keys(CHARACTERS),
    stages: Object.keys(STAGES),
  };
}
