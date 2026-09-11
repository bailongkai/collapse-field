import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';

const dying = (adRevive: boolean) => {
  const s = new Simulation({ seed: 5, characterId: 'survivor', stageId: 'station', adRevive });
  s.spawn('mech', 30, { ring: true, radius: 40 });
  s.setInput(0, 0);
  s.stepMany(60 * 20);
  return s;
};

describe('the ad revive offer', () => {
  it('never appears in a headless run: the balance harness sees a plain death', () => {
    const s = dying(false);
    expect(s.run.phase).toBe('ended');
    expect(s.run.ended).toBe('died');
    expect(s.run.adReviveOffered).toBe(false);
  });

  it('freezes the run on the offer instead of ending it', () => {
    const s = dying(true);
    expect(s.run.phase).toBe('revivePrompt');
    expect(s.run.ended).toBeUndefined();
    expect(s.run.hp).toBe(0);
    // nothing moves while the offer stands
    expect(s.stepMany(60)).toBe(0);
    const buf = s.world.events;
    let offered = false;
    for (let i = 0; i < buf.length; i++) if (buf.at(i).type === 'revivePrompt') offered = true;
    expect(offered).toBe(true);
  });

  it('accepting clears the screen and hands back half health', () => {
    const s = dying(true);
    expect(s.acceptAdRevive()).toBe(true);
    expect(s.run.phase).toBe('running');
    expect(s.run.hp).toBeGreaterThanOrEqual(Math.floor(s.stats.maxHealth * 0.5));
    expect(s.world.enemies.count).toBe(0);
    expect(s.run.adRevived).toBe(true);
  });

  it('declining is the death it deferred', () => {
    const s = dying(true);
    s.declineAdRevive();
    expect(s.run.phase).toBe('ended');
    expect(s.run.ended).toBe('died');
  });

  it('is offered once a run: the second death stands', () => {
    const s = dying(true);
    s.acceptAdRevive();
    s.spawn('mech', 30, { ring: true, radius: 40 });
    // the kills of the first death's clear can level the player up on the way
    for (let i = 0; i < 40 && s.run.phase !== 'ended'; i++) {
      if (s.run.phase === 'levelup') s.applyChoice(0);
      s.stepMany(30);
    }
    expect(s.run.phase).toBe('ended');
  });

  it('is not offered against the reaper', () => {
    const s = new Simulation({ seed: 5, characterId: 'survivor', stageId: 'station', adRevive: true });
    s.setTime(899);
    s.stepMany(60 * 30);
    // the reaper spawns and catches a standing player; that death is fatal
    expect(s.run.phase).toBe('ended');
  });

  it('cannot be accepted or declined at any other time', () => {
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station', adRevive: true });
    expect(s.acceptAdRevive()).toBe(false);
    s.declineAdRevive();
    expect(s.run.phase).toBe('running');
  });
});
