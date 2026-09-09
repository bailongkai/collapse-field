import type { StatBlock, StatKey } from '../../data/types';
import type { UpgradeDef } from '../../data/upgrades';
import { UPGRADES } from '../../data/upgrades';
import { writeSave, type SaveData, type SaveStorage } from './saveData';

/** Gold needed for the next level of an upgrade, or null when it is maxed. */
export function upgradeCost(def: UpgradeDef, currentLevel: number): number | null {
  if (currentLevel >= def.maxLevel) return null;
  return def.costs[currentLevel] ?? def.costs[def.costs.length - 1];
}

export function upgradeLevel(save: SaveData, id: string): number {
  return save.upgrades[id] ?? 0;
}

/** The permanent stat bonuses a save grants, in the same fractional/flat form as a passive. */
export function metaBonuses(save: SaveData): StatBlock {
  const out: Partial<Record<StatKey, number>> = {};
  for (const def of Object.values(UPGRADES) as UpgradeDef[]) {
    const level = upgradeLevel(save, def.id);
    if (level <= 0 || !def.stat) continue;
    out[def.stat] = (out[def.stat] ?? 0) + def.perLevel * level;
  }
  return out;
}

/** The rerolls, skips and banishes a save grants each run. */
export function metaCharges(save: SaveData): { reroll: number; skip: number; banish: number } {
  const out = { reroll: 0, skip: 0, banish: 0 };
  for (const def of Object.values(UPGRADES) as UpgradeDef[]) {
    const level = upgradeLevel(save, def.id);
    if (level <= 0 || !def.charge) continue;
    out[def.charge] += def.perLevel * level;
  }
  return out;
}

export type BuyResult = 'bought' | 'maxed' | 'poor' | 'unknown';

/** Buys one level if affordable, persists, and reports why not otherwise. */
export function buyUpgrade(st: SaveStorage, save: SaveData, id: string): { result: BuyResult; save: SaveData } {
  const def = (UPGRADES as Record<string, UpgradeDef>)[id];
  if (!def) return { result: 'unknown', save };
  const level = upgradeLevel(save, id);
  const cost = upgradeCost(def, level);
  if (cost === null) return { result: 'maxed', save };
  if (save.gold < cost) return { result: 'poor', save };
  const next: SaveData = { ...save, settings: { ...save.settings }, gold: save.gold - cost, upgrades: { ...save.upgrades, [id]: level + 1 } };
  writeSave(st, next);
  return { result: 'bought', save: next };
}
