import { describe, it, expect } from 'vitest';
import { MOODS, LOOP_STEPS, STEPS_PER_BAR, chordForBar, semitoneToHz, stepEvents, stepSeconds, ROOT_HZ, type Mood } from '../../src/game/audio/score';

const MOOD_LIST: Mood[] = ['menu', 'battle', 'boss', 'final'];
/** a fixed generator, so a test asserts the arrangement and not the luck of the draw */
const fixed = (v: number) => () => v;

describe('the score', () => {
  it('every mood is louder and faster than the one before it', () => {
    for (let i = 1; i < MOOD_LIST.length; i++) {
      const prev = MOODS[MOOD_LIST[i - 1]];
      const cur = MOODS[MOOD_LIST[i]];
      expect(cur.bpm, MOOD_LIST[i]).toBeGreaterThan(prev.bpm);
      expect(cur.brightness).toBeGreaterThan(prev.brightness);
    }
  });

  it('the menu has no drums and the fight does', () => {
    expect(MOODS.menu.drums).toBe(0);
    for (let step = 0; step < LOOP_STEPS; step++) {
      const e = stepEvents('menu', step, 1, fixed(0));
      expect(e.kick || e.snare || e.hat, `menu drummed on step ${step}`).toBe(false);
    }
    const beats = Array.from({ length: STEPS_PER_BAR }, (_, s) => stepEvents('battle', s, 0, fixed(1)));
    expect(beats.filter((e) => e.kick).length).toBeGreaterThan(0);
    expect(beats.filter((e) => e.snare).length).toBe(2);
  });

  it('a boss puts the kick on every beat', () => {
    const bar = Array.from({ length: STEPS_PER_BAR }, (_, s) => stepEvents('boss', s, 0, fixed(1)));
    expect(bar.filter((e) => e.kick).length).toBe(4);
    expect(bar[0].kick).toBe(true);
    expect(bar[1].kick).toBe(false);
  });

  it('the progression is four bars and repeats', () => {
    expect(chordForBar(0)).toEqual(chordForBar(4));
    expect(chordForBar(1)).not.toEqual(chordForBar(0));
    const roots = [0, 1, 2, 3].map((b) => chordForBar(b).root);
    expect(new Set(roots).size).toBe(4);
  });

  it('the pad is revoiced once a bar, on the bar line', () => {
    for (let step = 0; step < LOOP_STEPS; step++) {
      const e = stepEvents('battle', step, 0.5, fixed(1));
      expect(Boolean(e.pad), `step ${step}`).toBe(step % STEPS_PER_BAR === 0);
    }
  });

  it('the bass lands on the downbeat of every bar', () => {
    for (let bar = 0; bar < 4; bar++) {
      const e = stepEvents('battle', bar * STEPS_PER_BAR, 0, fixed(1));
      expect(e.bass).toBe(chordForBar(bar).root - 12);
    }
  });

  it('a hotter run plays more notes', () => {
    const count = (intensity: number): number => {
      let n = 0;
      for (let s = 0; s < LOOP_STEPS; s++) if (stepEvents('battle', s, intensity, fixed(0.3)).arp !== null) n++;
      return n;
    };
    expect(count(1)).toBeGreaterThan(count(0));
  });

  it('every note it can play is inside the audible range', () => {
    for (const mood of MOOD_LIST) {
      for (let s = 0; s < LOOP_STEPS; s++) {
        for (const r of [0, 0.4, 0.99]) {
          const e = stepEvents(mood, s, 1, fixed(r));
          for (const semi of [e.bass, e.arp, ...(e.pad ?? [])]) {
            if (semi === null || semi === undefined) continue;
            const hz = semitoneToHz(semi);
            expect(hz, `${mood} step ${s}`).toBeGreaterThan(20);
            expect(hz).toBeLessThan(4000);
          }
        }
      }
    }
  });

  it('a sixteenth is shorter the faster the mood', () => {
    expect(stepSeconds('menu')).toBeGreaterThan(stepSeconds('final'));
    expect(stepSeconds('battle')).toBeCloseTo(60 / MOODS.battle.bpm / 4);
    expect(semitoneToHz(0)).toBe(ROOT_HZ);
    expect(semitoneToHz(12)).toBeCloseTo(ROOT_HZ * 2);
  });
});
