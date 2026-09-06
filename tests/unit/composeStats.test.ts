import { describe, it, expect } from 'vitest';
import { composeStats } from '../../src/core/stats/composeStats';
import { CONTENT, characterDef } from '../../src/core/content/registry';

const ch = characterDef('survivor');

describe('composeStats', () => {
  it('applies multiplicative passives as fractional bonuses', () => {
    const s = composeStats(ch, [{ id: 'reactorCore', level: 3 }], CONTENT, 1);
    expect(s.might).toBeCloseTo(1.3, 6);
  });
  it('applies flat passives additively', () => {
    const s = composeStats(ch, [{ id: 'nanoArmor', level: 4 }], CONTENT, 1);
    expect(s.armor).toBe(4);
  });
  it('stacks maxHealth multiplicatively from the base', () => {
    const s = composeStats(ch, [{ id: 'lifeCore', level: 5 }], CONTENT, 1);
    expect(s.maxHealth).toBeCloseTo(200, 6);
  });
  it('clamps cooldown at 0.1 even with extreme reductions', () => {
    const s = composeStats(ch, [{ id: 'coolingSystem', level: 5 }], CONTENT, 1, { cooldown: -5 });
    expect(s.cooldown).toBe(0.1);
  });
  it('adds the level bonus once per full 10 levels', () => {
    expect(composeStats(ch, [], CONTENT, 9).might).toBeCloseTo(1, 6);
    expect(composeStats(ch, [], CONTENT, 10).might).toBeCloseTo(1.1, 6);
    expect(composeStats(ch, [], CONTENT, 25).might).toBeCloseTo(1.2, 6);
  });
  it('ignores unknown passive ids', () => {
    expect(composeStats(ch, [{ id: 'nope', level: 3 }], CONTENT, 1).might).toBeCloseTo(1, 6);
  });
});
