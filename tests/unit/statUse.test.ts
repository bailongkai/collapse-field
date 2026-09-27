import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WEAPON_STAT_USE, isDeadPick, passiveBenefit } from '../../src/core/weapons/statUse';
import { rollLevelUp } from '../../src/core/levelup/roll';
import { describeChoice } from '../../src/game/ui/choiceCard';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';

const source = (behavior: string): string => readFileSync(`src/core/weapons/behaviors/${behavior}.ts`, 'utf8');

describe('which stats a weapon can use', () => {
  it('covers every archetype a weapon is made of', () => {
    for (const w of Object.values(CONTENT.weapons)) expect(WEAPON_STAT_USE[w.behavior], w.id).toBeDefined();
  });

  it('agrees with the behaviours about speed and bodies', () => {
    for (const [behavior, use] of Object.entries(WEAPON_STAT_USE)) {
      const src = source(behavior);
      expect(use.includes('projectileSpeed'), `${behavior} speed`).toBe(src.includes('eff.speed'));
      expect(use.includes('amount'), `${behavior} amount`).toBe(src.includes('eff.amount'));
      // the blade reads its duration too, but only to keep the picture on screen
      if (behavior !== 'slash') expect(use.includes('duration'), `${behavior} duration`).toBe(src.includes('eff.durationMs'));
    }
  });

  it('the stabiliser does nothing for a build that is only the blade', () => {
    const blade = [{ id: 'plasmaBlade', level: 1 }];
    expect(isDeadPick(CONTENT.passives.stabilizer, blade, CONTENT.weapons)).toBe(true);
    expect(isDeadPick(CONTENT.passives.reactorCore, blade, CONTENT.weapons)).toBe(false);
    // armour is for the character, whatever they are holding
    expect(isDeadPick(CONTENT.passives.nanoArmor, blade, CONTENT.weapons)).toBe(false);
    expect(passiveBenefit(CONTENT.passives.stabilizer, [...blade, { id: 'orbitalDrones', level: 1 }], CONTENT.weapons).weapons).toEqual(['orbitalDrones']);
  });

  it('a dead pick is offered far less often, and still sometimes', () => {
    const share = (weapons: { id: string; level: number }[]): number => {
      const rng = new Rng(7);
      let seen = 0;
      for (let i = 0; i < 2000; i++) {
        const offer = rollLevelUp({ weapons, passives: [], luck: 1, rng, reg: CONTENT });
        if (offer.some((c) => c.kind === 'passive' && c.id === 'stabilizer')) seen++;
      }
      return seen / 2000;
    };
    const dead = share([{ id: 'plasmaBlade', level: 1 }]);
    const live = share([{ id: 'orbitalDrones', level: 1 }]);
    expect(dead).toBeGreaterThan(0);
    expect(dead).toBeLessThan(live * 0.4);
  });

  it('the card says who the passive is for', () => {
    const card = (weapons: { id: string; level: number }[]): string => describeChoice({ kind: 'passive', id: 'stabilizer', toLevel: 1 }, undefined, weapons).body;
    const plain = describeChoice({ kind: 'passive', id: 'stabilizer', toLevel: 1 }).body;
    expect(card([{ id: 'plasmaBlade', level: 1 }])).not.toBe(plain);
    expect(card([{ id: 'plasmaBlade', level: 1 }])).not.toBe(card([{ id: 'orbitalDrones', level: 1 }]));
    expect(card([{ id: 'plasmaBlade', level: 1 }, { id: 'orbitalDrones', level: 1 }]).split('\n')).toHaveLength(2);
    // nothing to add for one that changes the character
    expect(describeChoice({ kind: 'passive', id: 'nanoArmor', toLevel: 1 }, undefined, [{ id: 'plasmaBlade', level: 1 }]).body).not.toContain('\n');
  });
});
