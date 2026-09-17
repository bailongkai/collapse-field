import { describe, it, expect } from 'vitest';
import type Phaser from 'phaser';
import { RENDER_SCALE_KEY, shake } from '../../src/game/layout';

/** A scene stub with only what shake() touches: the registry and the main camera's shake. */
function stub(k: number | undefined): { scene: Phaser.Scene; calls: [number, number][] } {
  const calls: [number, number][] = [];
  const scene = {
    registry: { get: (key: string) => (key === RENDER_SCALE_KEY ? k : undefined) },
    cameras: { main: { shake: (ms: number, i: number) => calls.push([ms, i]) } },
  } as unknown as Phaser.Scene;
  return { scene, calls };
}

describe('camera shake under the render scale', () => {
  it('passes the authored strength through untouched at scale 1', () => {
    const { scene, calls } = stub(1);
    shake(scene, 150, 0.006);
    expect(calls).toEqual([[150, 0.006]]);
  });

  it('divides by the scale squared, since Phaser multiplies by canvas width and zoom and applies the result in world units', () => {
    const { scene, calls } = stub(2.95);
    shake(scene, 150, 0.006);
    expect(calls[0][0]).toBe(150);
    // what reaches the screen is intensity x width x zoom x zoom: this brings it back to 0.006 x width
    expect(calls[0][1] * 2.95 * 2.95).toBeCloseTo(0.006, 6);
  });

  it('treats a missing scale as 1', () => {
    const { scene, calls } = stub(undefined);
    shake(scene, 90, 0.004);
    expect(calls).toEqual([[90, 0.004]]);
  });
});
