import type Phaser from 'phaser';
import { logicalSizeFor } from '../config';

/**
 * The logical view matches the shape of the display, so a wide monitor, a phone held sideways and a
 * phone held upright all fill their screen. Nothing may assume the reference size: anything laid
 * out against the view has to read it at runtime, and it has to read it from here rather than from
 * `scene.scale`, because the canvas holds `renderScale` times more pixels than the view.
 */
export interface ViewSize {
  width: number;
  height: number;
}

export function logicalSizeForWindow(innerWidth: number, innerHeight: number): ViewSize {
  return logicalSizeFor(innerWidth, innerHeight);
}

/** Registry key for the render scale, device pixels per logical unit, written by src/game/render.ts. */
export const RENDER_SCALE_KEY = 'renderScale';

/** Device pixels per logical unit the canvas is rendered at; 1 wherever nothing has set it. */
export function renderScale(scene: Phaser.Scene): number {
  const k = scene.registry?.get(RENDER_SCALE_KEY) as unknown;
  return typeof k === 'number' && k > 0 ? k : 1;
}

/**
 * The current logical size of a scene's view. The canvas is bigger by the render scale and the
 * camera zooms by the same factor, so anything laid out against this size lands where it should
 * whatever the display's density.
 */
export function viewOf(scene: Phaser.Scene): ViewSize {
  const k = renderScale(scene);
  return { width: scene.scale.width / k, height: scene.scale.height / k };
}

export function centerX(scene: Phaser.Scene): number {
  return viewOf(scene).width / 2;
}

export function centerY(scene: Phaser.Scene): number {
  return viewOf(scene).height / 2;
}

/** True when this scene's view is taller than it is wide. */
export function isPortraitScene(scene: Phaser.Scene): boolean {
  const v = viewOf(scene);
  return v.height > v.width;
}

/**
 * A panel that fits: the requested size, shrunk to leave a margin on a screen too small for it.
 * Portrait phones are narrow enough that every fixed panel width overflowed.
 */
export function fitPanel(scene: Phaser.Scene, wantW: number, wantH: number, margin = 24): { w: number; h: number } {
  const v = viewOf(scene);
  return {
    w: Math.min(wantW, v.width - margin * 2),
    h: Math.min(wantH, v.height - margin * 2),
  };
}

/**
 * Where an object with scroll factor 0 has to be placed to appear at a logical screen position.
 * The camera zooms about its centre, and the scroll that puts the centre over the view is exactly
 * what a scroll-free object ignores, so it lands short by half the difference between canvas and
 * view. Only the floor, the relic arrow and the virtual stick draw that way.
 */
export function screenOffset(scene: Phaser.Scene): { x: number; y: number } {
  const k = renderScale(scene);
  const v = viewOf(scene);
  return { x: (v.width * (k - 1)) / 2, y: (v.height * (k - 1)) / 2 };
}

/**
 * Points every camera of a scene at the logical view: zoomed by the render scale and centred on
 * it, so the scene's coordinates stay logical while the canvas fills the device's pixels. A camera
 * that follows something keeps its own centre.
 */
export function applyRenderScale(scene: Phaser.Scene): void {
  const k = renderScale(scene);
  const v = viewOf(scene);
  for (const cam of scene.cameras.cameras) {
    cam.setZoom(k);
    const following = (cam as unknown as { _follow: unknown })._follow;
    if (!following) cam.centerOn(v.width / 2, v.height / 2);
  }
}

/**
 * A camera shake at its authored strength. Phaser sizes the shake by the camera's pixel width
 * times its zoom and then applies it in world units, so every one of those grew with the render
 * scale and a 0.006 shake on a 4K display threw the screen about nine times as far as on the
 * 1280-wide view it was tuned on. Dividing by the scale squared puts it back.
 */
export function shake(scene: Phaser.Scene, durationMs: number, intensity: number): void {
  const k = renderScale(scene);
  scene.cameras.main.shake(durationMs, intensity / (k * k));
}

/** Apple's minimum comfortable touch target, in CSS pixels. */
export const MIN_TOUCH_CSS = 46;
/** The height a plain button is authored at, in logical units. */
export const BASE_BUTTON_H = 56;

/** CSS pixels one logical unit covers on this display, or 0 when the canvas has no size yet. */
function cssPerUnit(scene: Phaser.Scene): number {
  const canvas = scene.game.canvas;
  const view = viewOf(scene);
  const cssWidth = canvas?.getBoundingClientRect().width ?? view.width;
  if (!cssWidth) return 0;
  const ratio = cssWidth / view.width;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
}

/**
 * How much bigger the interface has to be drawn on this display. The world is authored for a
 * 720-tall view, but on a phone that view is squeezed into a few hundred CSS pixels, which turned a
 * 64-unit button into a thirty-pixel sliver no thumb could reliably hit. Scaling the interface
 * leaves the world, and therefore the wave density calibration, untouched.
 */
export function uiScale(scene: Phaser.Scene): number {
  const ratio = cssPerUnit(scene);
  if (!ratio) return 1;
  const needed = MIN_TOUCH_CSS / (BASE_BUTTON_H * ratio);
  return Math.max(1, Math.min(2.6, needed));
}

/** Logical size that a target must have to reach MIN_TOUCH_CSS on this display. */
export function minTouchUnits(scene: Phaser.Scene): number {
  const ratio = cssPerUnit(scene);
  if (!ratio) return MIN_TOUCH_CSS;
  return MIN_TOUCH_CSS / ratio;
}
