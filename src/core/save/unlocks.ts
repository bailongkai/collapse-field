import { CONTENT } from '../content/registry';
import { STAGE_ORDER } from '../../data/stages';
import { writeSave, type SaveData, type SaveStorage } from './saveData';

/** A character is playable when it has no price or has been bought. */
export function isCharacterUnlocked(save: SaveData, id: string): boolean {
  const def = CONTENT.characters[id];
  if (!def) return false;
  return def.cost === undefined || save.unlocks.characters.includes(id);
}

/** The first stage is always open; every later one opens when the one before it has been survived. */
export function isStageUnlocked(save: SaveData, id: string): boolean {
  const def = CONTENT.stages[id];
  if (!def) return false;
  if (def.order === 0) return true;
  const previous = STAGE_ORDER[def.order - 1];
  return previous !== undefined && save.unlocks.stages.includes(previous.id);
}

export type BuyCharacterResult = 'bought' | 'owned' | 'poor' | 'unknown';

/** Buys a character with gold, persists, and reports why not otherwise. */
export function buyCharacter(st: SaveStorage, save: SaveData, id: string): { result: BuyCharacterResult; save: SaveData } {
  const def = CONTENT.characters[id];
  if (!def) return { result: 'unknown', save };
  if (isCharacterUnlocked(save, id)) return { result: 'owned', save };
  const cost = def.cost ?? 0;
  if (save.gold < cost) return { result: 'poor', save };
  const next: SaveData = {
    ...save,
    settings: { ...save.settings },
    upgrades: { ...save.upgrades },
    stageBest: { ...save.stageBest },
    unlocks: { characters: [...save.unlocks.characters, id], stages: [...save.unlocks.stages] },
    gold: save.gold - cost,
  };
  writeSave(st, next);
  return { result: 'bought', save: next };
}

/** The stage that surviving `stageId` opens, if it was not open already. */
export function stageUnlockedBySurviving(save: SaveData, stageId: string): string | null {
  const def = CONTENT.stages[stageId];
  if (!def) return null;
  const next = STAGE_ORDER[def.order + 1];
  if (!next) return null;
  return isStageUnlocked(save, next.id) ? null : next.id;
}
