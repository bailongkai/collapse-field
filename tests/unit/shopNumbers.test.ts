import { describe, it, expect, beforeAll } from 'vitest';
import { upgradeAmount, upgradeValue, weaponLine } from '../../src/game/ui/shopNumbers';
import { UPGRADES } from '../../src/data/upgrades';
import { setLocale } from '../../src/i18n';

/** The shop's numbers: what an upgrade is worth now and next, and a starting weapon's sheet. */
describe('shop numbers', () => {
  beforeAll(() => setLocale('en'));

  it('a percentage upgrade reads as its total now and after the next level', () => {
    expect(upgradeValue(UPGRADES.hull, 0)).toBe('now 0 → +10%');
    expect(upgradeValue(UPGRADES.hull, 2)).toBe('now +20% → +30%');
    expect(upgradeValue(UPGRADES.hull, 5)).toBe('+50%');
  });

  it('a reduction carries its minus, and flat stats and charges carry no percent', () => {
    expect(upgradeAmount(UPGRADES.coolant, 2)).toBe('−6%');
    expect(upgradeAmount(UPGRADES.plating, 2)).toBe('+2');
    expect(upgradeAmount(UPGRADES.reroll, 3)).toBe('+3');
    expect(upgradeValue(UPGRADES.revival, 1)).toBe('+1');
  });

  it('a starting weapon reads as damage, how often, and how many', () => {
    expect(weaponLine('plasmaBlade')).toBe('Plasma Blade · 10 dmg · 1.4 s · x2');
    // the field never fires: what it has is how often a body inside it is hit
    expect(weaponLine('empField')).toMatch(/· 5 dmg · 1\.3 s · x1$/);
    expect(weaponLine('nonsense')).toBe('');
  });
});
