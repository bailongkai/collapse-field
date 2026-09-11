import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '../../src/core/save/memoryStorage';
import { loadSave, grantGold, setFlag, interstitialDue } from '../../src/core/save/saveData';
import { applyPurchase, productOwned, PRODUCT_IDS, CONSUMABLE } from '../../src/core/save/purchases';
import { CHARACTER_LIST } from '../../src/data/characters';

const fresh = () => {
  const st = new MemoryStorage();
  return { st, save: loadSave(st) };
};

describe('save flags for the mobile build', () => {
  it('default off and survive a round trip', () => {
    const { st, save } = fresh();
    expect(save.removeAds).toBe(false);
    expect(save.tutorialDone).toBe(false);
    const next = setFlag(st, save, { removeAds: true, tutorialDone: true });
    const back = loadSave(st);
    expect(back.removeAds).toBe(true);
    expect(back.tutorialDone).toBe(true);
    expect(next).toEqual(back);
  });

  it('grantGold adds and persists, and never subtracts', () => {
    const { st, save } = fresh();
    const next = grantGold(st, save, 120);
    expect(next.gold).toBe(save.gold + 120);
    expect(loadSave(st).gold).toBe(next.gold);
    expect(grantGold(st, next, -50).gold).toBe(next.gold);
  });
});

describe('the interstitial cadence', () => {
  it('shows one every third run end, and counts from zero again', () => {
    const { st } = fresh();
    let save = loadSave(st);
    const shown: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const r = interstitialDue(st, save);
      save = r.save;
      shown.push(r.show);
    }
    expect(shown).toEqual([false, false, true, false, false, true, false]);
  });

  it('never shows once ads were bought off', () => {
    const { st } = fresh();
    let save = setFlag(st, loadSave(st), { removeAds: true });
    for (let i = 0; i < 9; i++) {
      const r = interstitialDue(st, save);
      save = r.save;
      expect(r.show).toBe(false);
    }
  });
});

describe('purchases', () => {
  it('each product does what it says on the save', () => {
    const { st, save } = fresh();
    expect(applyPurchase(st, save, 'remove_ads').removeAds).toBe(true);
    expect(applyPurchase(st, save, 'gold_500').gold).toBe(save.gold + 500);
    expect(applyPurchase(st, save, 'gold_2000').gold).toBe(save.gold + 2000);
    const all = applyPurchase(st, save, 'all_characters');
    for (const c of CHARACTER_LIST) expect(all.unlocks.characters).toContain(c.id);
  });

  it('non-consumables read as owned afterwards and applying twice changes nothing more', () => {
    const { st, save } = fresh();
    for (const id of PRODUCT_IDS) {
      if (CONSUMABLE[id]) continue;
      expect(productOwned(save, id)).toBe(false);
      const once = applyPurchase(st, save, id);
      expect(productOwned(once, id)).toBe(true);
      expect(applyPurchase(st, once, id)).toEqual(once);
    }
  });

  it('consumables are never owned, so they can be bought again', () => {
    const { st, save } = fresh();
    const after = applyPurchase(st, save, 'gold_500');
    expect(productOwned(after, 'gold_500')).toBe(false);
  });
});
