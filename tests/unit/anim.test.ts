import { describe, it, expect } from 'vitest';
import { advancePhase, walkPose, idlePose, squash, recoil, recoilKindFor, dashStretch, STRIDE } from '../../src/game/view/anim';

const pose = () => ({ dy: 0, scaleX: 1, scaleY: 1, rotation: 0 });

describe('procedural animation', () => {
  it('the walk phase is driven by ground covered, one cycle per stride', () => {
    let p = 0;
    p = advancePhase(p, STRIDE / 2);
    expect(p).toBeCloseTo(Math.PI);
    p = advancePhase(p, STRIDE / 2);
    expect(p).toBeCloseTo(0);
    expect(advancePhase(1, 0)).toBe(1);
  });

  it('a body at rest stands exactly on its sprite, and a walking one lifts off it', () => {
    const still = walkPose(0.3, 0, pose());
    expect(still.dy).toBe(0);
    expect(still.rotation).toBe(0);
    const walking = walkPose(Math.PI / 2, 1, pose());
    expect(walking.dy).toBeLessThan(0);
    expect(walking.scaleY).toBeGreaterThan(1);
    expect(walking.scaleX * walking.scaleY).toBeCloseTo(1, 5); // volume is kept
  });

  it('idle breathing never moves the feet', () => {
    for (let t = 0; t < 3; t += 0.1) expect(idlePose(t, pose()).dy).toBe(0);
  });

  it('a squash starts and ends at rest and bulges in between', () => {
    expect(squash(1)).toEqual({ scaleX: 1, scaleY: 1 });
    expect(squash(0).scaleX).toBeCloseTo(1);
    const mid = squash(0.5);
    expect(mid.scaleX).toBeGreaterThan(1);
    expect(mid.scaleY).toBeLessThan(1);
  });

  it('a blade lunges the way it faces and a gun kicks the other way', () => {
    expect(recoil('lunge', 0.5, 1).dx).toBeGreaterThan(0);
    expect(recoil('lunge', 0.5, -1).dx).toBeLessThan(0);
    expect(recoil('kick', 0.5, 1).dx).toBeLessThan(0);
    expect(recoil('pulse', 0.5, 1).dx).toBe(0);
    expect(recoil('lunge', 0, 1).dx).toBeCloseTo(0);
  });

  it('maps every weapon archetype to a recoil', () => {
    expect(recoilKindFor('slash')).toBe('lunge');
    expect(recoilKindFor('stream')).toBe('kick');
    expect(recoilKindFor('aimed')).toBe('kick');
    expect(recoilKindFor('orbit')).toBe('pulse');
    expect(recoilKindFor('aura')).toBe('pulse');
  });

  it('only a real dash stretches the body, and never past a cap', () => {
    expect(dashStretch(1)).toBe(0);
    expect(dashStretch(1.5)).toBe(0);
    expect(dashStretch(3)).toBeGreaterThan(0);
    expect(dashStretch(100)).toBeLessThanOrEqual(0.28);
  });
});
