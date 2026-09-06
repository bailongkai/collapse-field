import { describe, it, expect } from 'vitest';
import { reroll, wrapDecor, type DecorSlot } from '../../src/core/decor';

const VIEW_W = 1280;
const VIEW_H = 720;

function slot(x: number, y: number): DecorSlot {
  const s: DecorSlot = { x, y, frame: 0, rotation: 0, scale: 1 };
  reroll(s, 8);
  return s;
}

describe('wrapDecor', () => {
  it('brings a far slot back inside the window', () => {
    const s = slot(9000, -7000);
    wrapDecor(s, 0, 0, VIEW_W, VIEW_H, 8);
    expect(Math.abs(s.x)).toBeLessThanOrEqual((VIEW_W + 512) / 2);
    expect(Math.abs(s.y)).toBeLessThanOrEqual((VIEW_H + 512) / 2);
  });
  it('reports no wrap when the slot is already inside', () => {
    const s = slot(100, 50);
    expect(wrapDecor(s, 0, 0, VIEW_W, VIEW_H, 8)).toBe(false);
  });
  it('keeps frames in range and is deterministic for the same position', () => {
    const a = slot(1234, -987);
    const b = slot(1234, -987);
    expect(a.frame).toBe(b.frame);
    expect(a.rotation).toBe(b.rotation);
    for (let i = 0; i < 200; i++) {
      const s = slot(i * 137, i * -211);
      expect(s.frame).toBeGreaterThanOrEqual(0);
      expect(s.frame).toBeLessThan(8);
      expect(s.scale).toBeGreaterThan(0.5);
    }
  });
  it('follows the camera over a long walk without drifting out of the window', () => {
    const s = slot(0, 0);
    for (let i = 0; i < 500; i++) {
      const camX = i * 37;
      const camY = i * -19;
      wrapDecor(s, camX, camY, VIEW_W, VIEW_H, 8);
      expect(Math.abs(s.x - camX)).toBeLessThanOrEqual((VIEW_W + 512) / 2 + 1);
      expect(Math.abs(s.y - camY)).toBeLessThanOrEqual((VIEW_H + 512) / 2 + 1);
    }
  });
});
