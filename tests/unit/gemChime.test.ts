import { describe, it, expect } from 'vitest';
import { GemChime, MAX_STEPS, WINDOW_MS } from '../../src/game/audio/gemChime';

describe('the gem chime climbs', () => {
  it('a semitone per gem inside the window, an octave at most, and back to the root after a pause', () => {
    const c = new GemChime();
    expect(c.next(0)).toBeCloseTo(1, 9);
    expect(c.next(100)).toBeCloseTo(Math.pow(2, 1 / 12), 9);
    let rate = 0;
    for (let i = 0; i < 40; i++) rate = c.next(200 + i * 50);
    expect(rate).toBeCloseTo(2, 9);
    expect(MAX_STEPS).toBe(12);
    // a pause longer than the window drops it to the root again
    expect(c.next(200 + 40 * 50 + WINDOW_MS + 1)).toBeCloseTo(1, 9);
  });

  it('reset forgets the ladder', () => {
    const c = new GemChime();
    c.next(0);
    c.next(10);
    c.reset();
    expect(c.next(20)).toBeCloseTo(1, 9);
  });
});
