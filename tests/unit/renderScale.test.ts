import { describe, it, expect } from 'vitest';
import { MAX_CANVAS_PIXELS_COARSE, MAX_CANVAS_PIXELS_FINE, MAX_RENDER_SCALE, logicalSizeFor, renderScaleFor } from '../../src/config';

describe('render scale: device pixels per logical unit', () => {
  it('is exactly 1 at the reference view on a plain monitor, so nothing moves where the game was authored', () => {
    expect(renderScaleFor(1280, 720, 1280, 1, MAX_CANVAS_PIXELS_FINE)).toBe(1);
  });

  it('gives a retina 4K desktop one canvas pixel per device pixel', () => {
    const v = logicalSizeFor(2000, 1005);
    const k = renderScaleFor(v.width, v.height, 2000, 2, MAX_CANVAS_PIXELS_FINE);
    expect(v.width * k).toBeCloseTo(4000, -2);
    expect(k).toBeLessThanOrEqual(MAX_RENDER_SCALE);
  });

  it('never renders below the view: a small window is stretched no more than it always was', () => {
    expect(renderScaleFor(1280, 720, 900, 1, MAX_CANVAS_PIXELS_FINE)).toBe(1);
  });

  it('stays inside the pixel budget on a dense phone, and still renders above the view', () => {
    const v = logicalSizeFor(932, 430);
    const k = renderScaleFor(v.width, v.height, 932, 3, MAX_CANVAS_PIXELS_COARSE);
    expect(v.width * k * v.height * k).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_COARSE * 1.01);
    expect(k).toBeGreaterThan(1);
  });
});
