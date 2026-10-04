import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { RANGED_TELL_MS } from '../../src/core/enemies/behaviors/ranged';
import { FIXED_DT_MS } from '../../src/config';

/**
 * Every ranged shooter winds up before it fires. Bolts were the first cause of death on four of
 * eight stages for a kiting player, and the spitter was the one attacker with no tell: it fired on
 * the tick its clock ran out, which for a spitter walking into range was the tick it arrived.
 */
const quiet = (seed = 3) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setStatOverride('curse', -1); // no waves: only the shooters placed here
  s.run.weapons.length = 0;
  s.world.weaponInstances.length = 0;
  return s;
};

/** the tick of every windup and every shot, in order */
function timeline(s: Simulation, ticks: number): { windups: number[]; shots: number[]; flashAtShot: boolean[] } {
  const windups: number[] = [];
  const shots: number[] = [];
  const flashAtShot: boolean[] = [];
  for (let t = 0; t < ticks; t++) {
    s.step();
    const ev = s.world.events;
    for (let i = 0; i < ev.length; i++) {
      const e = ev.at(i);
      if (e.type === 'windup') windups.push(t);
      if (e.type === 'enemyShot') {
        shots.push(t);
        flashAtShot.push(s.world.enemies.items.some((en) => en.active && en.defId === e.id && en.flashMs > 0));
      }
    }
    ev.clear();
  }
  return { windups, shots, flashAtShot };
}

describe('a shooter winds up before it fires', () => {
  for (const id of ['spitter', 'escort']) {
    it(`${id}: every bolt is preceded by a windup a tell earlier, and the first one is no exception`, () => {
      const s = quiet();
      s.spawn(id, 1, { x: 200, y: 0 });
      const tl = timeline(s, 60 * 8);
      expect(tl.shots.length).toBeGreaterThanOrEqual(2);
      expect(tl.windups.length).toBeGreaterThanOrEqual(tl.shots.length);
      const tellTicks = RANGED_TELL_MS / FIXED_DT_MS;
      for (const shot of tl.shots) {
        const w = [...tl.windups].reverse().find((x) => x <= shot);
        expect(w, `the shot at tick ${shot} had no windup`).toBeDefined();
        expect(shot - w!, `tell before the shot at tick ${shot}`).toBeGreaterThanOrEqual(tellTicks - 1);
      }
      // the first shot does not land on arrival: at least a full tell after the first tick in range
      expect(tl.shots[0]).toBeGreaterThanOrEqual(tellTicks - 1);
      expect(tl.flashAtShot.every(Boolean), 'the body was not flashing when it fired').toBe(true);
    });
  }

  it('a spitter walking into range still tells before its first bolt', () => {
    const s = quiet();
    s.spawn('spitter', 1, { x: 900, y: 0 });
    const tl = timeline(s, 60 * 20);
    expect(tl.shots.length).toBeGreaterThan(0);
    expect(tl.windups[0]).toBeLessThan(tl.shots[0]);
    expect(tl.shots[0] - tl.windups[0]).toBeGreaterThanOrEqual(RANGED_TELL_MS / FIXED_DT_MS - 1);
  });

  it('it stands still while it tells', () => {
    const s = quiet();
    s.spawn('spitter', 1, { x: 240, y: 0 });
    const e = s.world.enemies.items.find((x) => x.active && x.defId === 'spitter')!;
    let moved = 0;
    let frozen = 0;
    for (let t = 0; t < 60 * 6; t++) {
      const x0 = e.x;
      const y0 = e.y;
      s.step();
      // the flash outlives the shot by a tick; the clock is what says the body is telling
      if (e.aiTimer2 > 0 && e.aiTimer2 <= RANGED_TELL_MS) {
        if (Math.hypot(e.x - x0, e.y - y0) < 1e-6) frozen++;
        else moved++;
      }
    }
    expect(frozen).toBeGreaterThan(0);
    expect(moved).toBe(0);
  });

  it('the pinner announces its wind-up at its tell too', () => {
    const s = quiet();
    s.spawn('pinner', 1, { x: 500, y: 0 });
    const tl = timeline(s, 60 * 6);
    expect(tl.windups.length).toBeGreaterThan(0);
    expect(tl.shots.length).toBeGreaterThan(0);
    expect(tl.windups[0]).toBeLessThan(tl.shots[0]);
  });
});
