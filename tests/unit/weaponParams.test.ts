import { describe, it, expect } from 'vitest';
import { effectiveWeapon, weaponParams } from '../../src/core/stats/weaponParams';
import { composeStats } from '../../src/core/stats/composeStats';
import { CONTENT, characterDef, weaponDef } from '../../src/core/content/registry';

const ch = characterDef('survivor');
const base = composeStats(ch, [], CONTENT, 1);

describe('weaponParams', () => {
  it('level 1 equals the base table', () => {
    const w = weaponDef('plasmaBlade');
    expect(weaponParams(w, 1)).toEqual(w.base);
  });
  it('level 8 sums every delta', () => {
    const w = weaponDef('plasmaBlade');
    const p = weaponParams(w, 8);
    expect(p.damage).toBe(10 + 5 + 8 + 8 + 8);
    expect(p.amount).toBe(2);
    expect(p.area).toBeCloseTo(1.2, 6);
  });
  it('clamps levels outside the range', () => {
    const w = weaponDef('railgun');
    expect(weaponParams(w, 0)).toEqual(weaponParams(w, 1));
    expect(weaponParams(w, 99)).toEqual(weaponParams(w, 8));
  });
  it('railgun gains amount and pierce over its levels', () => {
    const p = weaponParams(weaponDef('railgun'), 8);
    expect(p.amount).toBe(6);
    expect(p.pierce).toBe(3);
  });
});

describe('effectiveWeapon', () => {
  it('scales damage by might and cooldown by cooldown', () => {
    const stats = composeStats(ch, [{ id: 'reactorCore', level: 5 }, { id: 'coolingSystem', level: 5 }], CONTENT, 1);
    const eff = effectiveWeapon(weaponParams(weaponDef('guidedLaser'), 1), stats);
    expect(eff.damage).toBeCloseTo(15, 6);
    expect(eff.cooldownMs).toBeCloseTo(1200 * 0.6, 4);
  });
  it('adds the amount stat and multiplies area and speed', () => {
    const stats = composeStats(ch, [{ id: 'fieldAmp', level: 2 }], CONTENT, 1, { amount: 2, projectileSpeed: 0.5 });
    const eff = effectiveWeapon(weaponParams(weaponDef('railgun'), 1), stats);
    expect(eff.amount).toBe(3);
    expect(eff.area).toBeCloseTo(1.2, 6);
    expect(eff.speed).toBeCloseTo(1.5, 6);
  });
  it('keeps an infinite cooldown infinite for the aura', () => {
    const eff = effectiveWeapon(weaponParams(weaponDef('empField'), 1), base);
    expect(eff.cooldownMs).toBe(Infinity);
    expect(eff.hitCooldownMs).toBe(1300);
  });
});
