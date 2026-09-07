import type Phaser from 'phaser';
import { logicalSizeFor } from '../config';

/**
 * The logical view matches the shape of the display, so a wide monitor, a phone held sideways and a
 * phone held upright all fill their screen. Nothing may assume the reference size: anything laid
 * out against the view has to read it at runtime.
 */
export interface ViewSize {
  width: number;
  height: number;
}

export function logicalSizeForWindow(innerWidth: number, innerHeight: number): ViewSize {
  return logicalSizeFor(innerWidth, innerHeight);
}

/** The current logical size of a scene's canvas. */
export function viewOf(scene: Phaser.Scene): ViewSize {
  return { width: scene.scale.width, height: scene.scale.height };
}

export function centerX(scene: Phaser.Scene): number {
  return scene.scale.width / 2;
}

export function centerY(scene: Phaser.Scene): number {
  return scene.scale.height / 2;
}

/** True when this scene's canvas is taller than it is wide. */
export function isPortraitScene(scene: Phaser.Scene): boolean {
  return scene.scale.height > scene.scale.width;
}

/**
 * A panel that fits: the requested size, shrunk to leave a margin on a screen too small for it.
 * Portrait phones are narrow enough that every fixed panel width overflowed.
 */
export function fitPanel(scene: Phaser.Scene, wantW: number, wantH: number, margin = 24): { w: number; h: number } {
  return {
    w: Math.min(wantW, scene.scale.width - margin * 2),
    h: Math.min(wantH, scene.scale.height - margin * 2),
  };
}

/** Apple's minimum comfortable touch target, in CSS pixels. */
export const MIN_TOUCH_CSS = 46;
/** The height a plain button is authored at, in logical units. */
export const BASE_BUTTON_H = 56;

/**
 * How much bigger the interface has to be drawn on this display. The world is authored for a
 * 720-tall view, but on a phone that view is squeezed into a few hundred CSS pixels, which turned a
 * 64-unit button into a thirty-pixel sliver no thumb could reliably hit. Scaling the interface
 * leaves the world, and therefore the wave density calibration, untouched.
 */
export function uiScale(scene: Phaser.Scene): number {
  const canvas = scene.game.canvas;
  const cssWidth = canvas?.getBoundingClientRect().width ?? scene.scale.width;
  if (!cssWidth) return 1;
  const cssPerUnit = cssWidth / scene.scale.width;
  if (!Number.isFinite(cssPerUnit) || cssPerUnit <= 0) return 1;
  const needed = MIN_TOUCH_CSS / (BASE_BUTTON_H * cssPerUnit);
  return Math.max(1, Math.min(2.6, needed));
}

/** Logical size that a target must have to reach MIN_TOUCH_CSS on this display. */
export function minTouchUnits(scene: Phaser.Scene): number {
  const canvas = scene.game.canvas;
  const cssWidth = canvas?.getBoundingClientRect().width ?? scene.scale.width;
  const cssPerUnit = cssWidth ? cssWidth / scene.scale.width : 1;
  if (!Number.isFinite(cssPerUnit) || cssPerUnit <= 0) return MIN_TOUCH_CSS;
  return MIN_TOUCH_CSS / cssPerUnit;
}
