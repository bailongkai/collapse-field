import { describe, it, expect } from 'vitest';
import { describeChoice, describeRewards } from '../../src/game/ui/choiceCard';
import type { LevelUpChoice } from '../../src/core/sim/runState';

describe('how a chest reads', () => {
  it('folds two levels of one weapon into a single row', () => {
    // the chest from the report: blade 4 → 5, field 2 → 3, blade 5 → 6
    const rewards: LevelUpChoice[] = [
      { kind: 'weapon', id: 'plasmaBlade', toLevel: 5 },
      { kind: 'weapon', id: 'empField', toLevel: 3 },
      { kind: 'weapon', id: 'plasmaBlade', toLevel: 6 },
    ];
    const rows = describeRewards(rewards);
    expect(rows).toHaveLength(2);
    expect(rows[0].tag).toBe('Lv 4 → 6');
    // both levels' gains are on the row, not only the last one's
    const l5 = describeChoice(rewards[0]).body;
    const l6 = describeChoice(rewards[2]).body;
    expect(rows[0].body).toContain(l5);
    expect(rows[0].body).toContain(l6);
    expect(rows[1]).toEqual(describeChoice(rewards[1]));
  });

  it('adds up a stat raised by more than one of the levels', () => {
    // blade levels 7 and 8 are both damage +8
    const rows = describeRewards([
      { kind: 'weapon', id: 'plasmaBlade', toLevel: 7 },
      { kind: 'weapon', id: 'plasmaBlade', toLevel: 8 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].tag).toBe('Lv 6 → 8');
    expect(rows[0].body).toContain('+16');
    expect(rows[0].body).not.toContain('+8');
  });

  it('folds passives and leaves single rewards exactly as the level-up card words them', () => {
    const rewards: LevelUpChoice[] = [
      { kind: 'passive', id: 'reactorCore', toLevel: 2 },
      { kind: 'weapon', id: 'plasmaBlade', toLevel: 3 },
      { kind: 'passive', id: 'reactorCore', toLevel: 3 },
    ];
    const rows = describeRewards(rewards);
    expect(rows.map((r) => r.tag)).toEqual(['Lv 1 → 3', 'Lv 2 → 3']);
    expect(rows[1]).toEqual(describeChoice(rewards[1]));
  });
});
