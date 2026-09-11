import type { SaveData, SaveStorage } from './saveData';
import { writeSave } from './saveData';
import { CHARACTER_LIST } from '../../data/characters';

/** The store products and what each does to the save. Ids are the contract with both stores. */
export type ProductId = 'remove_ads' | 'gold_500' | 'gold_2000' | 'all_characters';
export const PRODUCT_IDS: readonly ProductId[] = ['remove_ads', 'gold_500', 'gold_2000', 'all_characters'];
export const CONSUMABLE: Readonly<Record<ProductId, boolean>> = { remove_ads: false, gold_500: true, gold_2000: true, all_characters: false };

/** Whether a non-consumable is already reflected in the save; consumables never are. */
export function productOwned(save: SaveData, id: ProductId): boolean {
  if (id === 'remove_ads') return save.removeAds;
  if (id === 'all_characters') return CHARACTER_LIST.every((c) => save.unlocks.characters.includes(c.id));
  return false;
}

/** Applies a completed purchase and persists. Idempotent for the non-consumables. */
export function applyPurchase(st: SaveStorage, save: SaveData, id: ProductId): SaveData {
  let next: SaveData;
  switch (id) {
    case 'remove_ads':
      next = { ...save, removeAds: true };
      break;
    case 'gold_500':
      next = { ...save, gold: save.gold + 500 };
      break;
    case 'gold_2000':
      next = { ...save, gold: save.gold + 2000 };
      break;
    case 'all_characters': {
      const characters = [...new Set([...save.unlocks.characters, ...CHARACTER_LIST.map((c) => c.id)])];
      next = { ...save, unlocks: { ...save.unlocks, characters } };
      break;
    }
  }
  writeSave(st, next);
  return next;
}
