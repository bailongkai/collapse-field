import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { PROTOCOLS, PROTOCOL_LIST, PROTOCOL_TUNING } from '../../src/data/protocols';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { DEFAULT_SAVE, loadSave, writeSave } from '../../src/core/save/saveData';
import { MemoryStorage } from '../../src/core/save/memoryStorage';
import { isProtocolUnlocked } from '../../src/core/save/unlocks';
import { FIXED_DT_MS } from '../../src/config';
import type { ProtocolId } from '../../src/data/protocols';

const run = (protocol: ProtocolId | null, stageId = 'station', weapon = 'plasmaBlade') => {
  const s = new Simulation({ seed: 12, characterId: 'survivor', stageId, protocol });
  s.world.enemies.clear();
  s.run.weapons.length = 0;
  s.world.weaponInstances.length = 0;
  s.run.god = true;
  s.setStatOverride('curse', -1);
  if (weapon) s.giveWeapon(weapon, 1);
  return s;
};
const tank = (s: Simulation, x: number, y: number) => {
  s.spawn('mech', 1, { x, y });
  const e = s.world.enemies.items.find((k) => k.active && k.x === x && k.y === y)!;
  e.hp = e.maxHp = 1e9;
  e.speedMult = 0;
  return e;
};

describe('protocols', () => {
  it('each is opened by an achievement that exists, and has its strings', () => {
    for (const p of PROTOCOL_LIST) {
      expect((ACHIEVEMENTS as Record<string, unknown>)[p.achievement], p.id).toBeTruthy();
      const save = { ...DEFAULT_SAVE, achievements: [] as string[] };
      expect(isProtocolUnlocked(save, p.id)).toBe(false);
      expect(isProtocolUnlocked({ ...save, achievements: [p.achievement] }, p.id)).toBe(true);
    }
    expect(isProtocolUnlocked(DEFAULT_SAVE, 'nonsense')).toBe(false);
  });

  it('the run records the protocol it was started with; an unknown one is none', () => {
    expect(run('dash').run.protocol).toBe('dash');
    expect(run(null).run.protocol).toBe('');
    expect(new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station', protocol: 'bogus' as ProtocolId }).run.protocol).toBe('');
  });
});

describe('塌缩加剧', () => {
  it('a stage without collapsing floor gets the station\'s three; the station keeps its own', () => {
    const count = (s: Simulation) => s.stage.events.filter((e) => e.kind === 'collapse').length;
    expect(count(run(null, 'cargo'))).toBe(0);
    expect(count(run('collapse', 'cargo'))).toBe(3);
    expect(count(run('collapse', 'station'))).toBe(count(run(null, 'station')));
    const at = run('collapse', 'cargo').stage.events.map((e) => e.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('the cache pays half as many rewards again; any other chest pays as usual', () => {
    const open = (protocol: ProtocolId | null, pickup: string) => {
      const s = run(protocol);
      for (const id of ['railgun', 'guidedLaser', 'orbitalDrones', 'empField']) s.giveWeapon(id, 1);
      s.spawnPickup(pickup, s.world.player.x, s.world.player.y);
      s.stepMany(3);
      return s.takeChestResult()!.rewards.length;
    };
    const plain = open(null, 'riftCache');
    expect(open('collapse', 'riftCache')).toBe(Math.round(plain * PROTOCOL_TUNING.collapse.rewardMult));
    expect(open('collapse', 'chest')).toBe(open(null, 'chest'));
  });
});

describe('单向火控', () => {
  it('nothing lands behind her, and what lands ahead hits 40% harder', () => {
    const swing = (protocol: ProtocolId | null) => {
      const s = run(protocol);
      const ahead = tank(s, 90, 0);
      const behind = tank(s, -90, 0);
      s.stepMany(20);
      return { ahead: 1e9 - ahead.hp, behind: 1e9 - behind.hp };
    };
    const plain = swing(null);
    const one = swing('oneSide');
    expect(plain.behind).toBeGreaterThan(0);
    expect(one.behind).toBe(0);
    expect(one.ahead / plain.ahead).toBeCloseTo(1.4, 1);
  });

  it('the guided laser does not spend a bolt on a body behind her', () => {
    const s = run('oneSide', 'station', 'guidedLaser');
    tank(s, -150, 0);
    s.stepMany(90);
    expect(s.world.projectiles.count).toBe(0);
  });
});

describe('无磁力', () => {
  it('a gem a step away stays where it is until she walks onto it, and experience pays 1.3x', () => {
    const gem = (protocol: ProtocolId | null) => {
      const s = run(protocol);
      s.spawnGems(1, 'blue', { x: 45, y: 0 });
      s.stepMany(60);
      return { s, left: s.world.gems.count };
    };
    expect(gem(null).left).toBe(0);
    const { s, left } = gem('noMagnet');
    expect(left).toBe(1);
    s.setInput(1, 0);
    s.stepMany(30);
    expect(s.world.gems.count).toBe(0);
    expect(s.stats.growth / run(null).stats.growth).toBeCloseTo(1.3, 5);
  });
});

describe('回身冲刺', () => {
  it('a turn carries her 40 along the new facing with a moment of i-frames, at most every two seconds', () => {
    const turn = (protocol: ProtocolId | null) => {
      const s = run(protocol, 'station', '');
      s.setInput(1, 0);
      s.stepMany(10);
      const x0 = s.world.player.x;
      s.setInput(-1, 0);
      s.step();
      return { s, moved: x0 - s.world.player.x };
    };
    const plain = turn(null);
    const dash = turn('dash');
    expect(dash.moved - plain.moved).toBeCloseTo(PROTOCOL_TUNING.dash.px, 0);
    expect(dash.s.world.player.iframesMs).toBeGreaterThan(PROTOCOL_TUNING.dash.iframesMs - 2 * FIXED_DT_MS);
    // turning straight back is not another dash
    const s = dash.s;
    s.stepMany(5);
    const x1 = s.world.player.x;
    s.setInput(1, 0);
    s.step();
    expect(s.world.player.x - x1).toBeLessThan(10);
    // after the cooldown it is
    s.stepMany(Math.round(PROTOCOL_TUNING.dash.cooldownMs / FIXED_DT_MS));
    const x2 = s.world.player.x;
    s.setInput(-1, 0);
    s.step();
    expect(x2 - s.world.player.x).toBeGreaterThan(PROTOCOL_TUNING.dash.px);
  });

  it('walking up or down is not a turn, so it is not a dash', () => {
    const s = run('dash', 'station', '');
    s.setInput(1, 0);
    s.stepMany(Math.round(PROTOCOL_TUNING.dash.cooldownMs / FIXED_DT_MS) + 5);
    let dashes = 0;
    // the autopilot's straight up is cos(pi/2) = 6e-17, and a thumb pushing up leans a little
    for (const [dx, dy] of [[Math.cos(Math.PI / 2), -1], [Math.cos(-Math.PI / 2), 1], [-0.15, -1], [0.2, 1], [-0.2, -1]]) {
      s.setInput(dx, dy);
      for (let t = 0; t < Math.round(PROTOCOL_TUNING.dash.cooldownMs / FIXED_DT_MS) + 5; t++) {
        s.world.events.clear();
        s.step();
        for (let i = 0; i < s.world.events.length; i++) if (s.world.events.at(i).type === 'dash') dashes++;
      }
      expect(s.world.player.facing, `input ${dx}, ${dy}`).toBe(0);
    }
    expect(dashes).toBe(0);
  });
});

describe('facing', () => {
  it('follows a deliberate horizontal press and ignores vertical movement and a slight lean', () => {
    const s = run(null, 'station', '');
    const p = s.world.player;
    s.setInput(-1, 0);
    s.step();
    expect(p.facing).toBe(Math.PI);
    for (const [dx, dy] of [[0, 1], [0, -1], [Math.cos(Math.PI / 2), 1], [1e-9, -1], [0.25, 1], [0.2, -1]]) {
      s.setInput(dx, dy);
      s.stepMany(3);
      expect(p.facing, `input ${dx}, ${dy}`).toBe(Math.PI);
    }
    // a keyboard diagonal is meant as sideways, and so is any push well off the vertical
    s.setInput(1, -1);
    s.step();
    expect(p.facing).toBe(0);
    s.setInput(-0.5, 1);
    s.step();
    expect(p.facing).toBe(Math.PI);
    s.setInput(1, 0);
    s.step();
    expect(p.facing).toBe(0);
  });
});

describe('the save', () => {
  it('a version-2 save without the field loads with no protocol, and a chosen one round-trips', () => {
    const st = new MemoryStorage();
    const old = { ...DEFAULT_SAVE } as Record<string, unknown>;
    delete old.lastProtocol;
    st.write(JSON.stringify(old));
    expect(loadSave(st).lastProtocol).toBe('');
    writeSave(st, { ...loadSave(st), lastProtocol: 'dash' });
    expect(loadSave(st).lastProtocol).toBe('dash');
    st.write(JSON.stringify({ ...DEFAULT_SAVE, lastProtocol: 'nonsense' }));
    expect(loadSave(st).lastProtocol).toBe('');
    expect(Object.keys(PROTOCOLS)).toHaveLength(4);
  });
});
