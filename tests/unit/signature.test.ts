import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { CHARACTER_LIST } from '../../src/data/characters';

const sim = (characterId: string, seed = 3) => {
  const s = new Simulation({ seed, characterId, stageId: 'station' });
  s.setStatOverride('growth', 0);
  return s;
};

describe('signature abilities', () => {
  it('every character has one, and each is a different kind', () => {
    const kinds = new Set(CHARACTER_LIST.map((c) => c.signature.kind));
    expect(kinds.size).toBe(CHARACTER_LIST.length);
  });

  it('幸存者 战场急救: heals and grants invulnerability when health falls low, once per cooldown', () => {
    const s = sim('survivor');
    s.world.player.hp = 20;
    s.stepMany(1);
    expect(s.world.player.hp).toBe(20 + 30);
    expect(s.world.player.iframesMs).toBeGreaterThan(1000);
    expect(s.signature.fired).toBe(1);
    s.world.player.hp = 10;
    s.stepMany(1);
    expect(s.world.player.hp, 'it must not fire again while cooling down').toBe(10);
  });

  it('陆战队员 弹链: every 25 kills adds two projectiles for five seconds', () => {
    const s = sim('marine');
    const base = s.stats.amount;
    for (let i = 0; i < 24; i++) {
      s.spawn('drone', 1, { x: 500, y: 0 });
      const alive = s.world.enemies.aliveList();
      s.damageEnemy(s.world.enemies.items[alive[s.world.enemies.count - 1]], 1e6, 1, 0, 0);
    }
    expect(s.stats.amount).toBe(base);
    s.spawn('drone', 1, { x: 500, y: 0 });
    const alive = s.world.enemies.aliveList();
    s.damageEnemy(s.world.enemies.items[alive[s.world.enemies.count - 1]], 1e6, 1, 0, 0);
    expect(s.stats.amount).toBe(base + 2);
    s.stepMany(60 * 6);
    expect(s.stats.amount, 'the bonus should have worn off').toBe(base);
  });

  it('系统工程师 超频: a chest halves cooldowns for ten seconds', () => {
    const s = sim('engineer');
    s.run.god = true;
    const before = s.stats.cooldown;
    s.spawnPickup('chest', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    expect(s.stats.cooldown).toBeLessThan(before * 0.6);
    s.stepMany(60 * 11);
    expect(s.stats.cooldown).toBeCloseTo(before, 6);
  });

  it('维护单元 应急护盾: the first hit is negated outright, then the charge takes time to return', () => {
    const s = sim('unit');
    s.setStatOverride('moveSpeed', 0);
    s.setStatOverride('might', 0);
    expect(s.world.player.shieldCharges).toBe(1);
    s.spawn('mech', 1, { x: 30, y: 0 });
    s.stepMany(3);
    expect(s.world.player.hp).toBe(s.stats.maxHealth);
    expect(s.world.player.shieldCharges).toBe(0);
    expect(s.signature.cooldownMs).toBeGreaterThan(0);
    // the next hit, after the i-frames, lands
    s.stepMany(60);
    expect(s.world.player.hp).toBeLessThan(s.stats.maxHealth);
  });

  it('领航员 应急推进: taking a hit speeds her up for a moment', () => {
    const s = sim('navigator');
    s.setStatOverride('might', 0);
    const base = s.stats.moveSpeed;
    // a drone: it hurts enough to trigger the ability and not enough to end the run before it wears off
    s.spawn('drone', 1, { x: 30, y: 0 });
    s.stepMany(3);
    expect(s.stats.moveSpeed).toBeGreaterThan(base * 1.4);
    s.stepMany(60 * 3);
    expect(s.stats.moveSpeed).toBeCloseTo(base, 6);
  });
});
