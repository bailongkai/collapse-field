import type Phaser from 'phaser';
import { GAME_H, logicalWidthFor, MAX_VIEW_W, MIN_VIEW_W } from '../config';

/**
 * The logical view is a fixed 720 tall with a width that follows the display's aspect ratio, so a
 * wide phone or monitor fills its screen instead of sitting between black bars. Everything laid out
 * against the width has to read it at runtime rather than from a constant.
 */
export interface ViewSize {
  width: number;
  height: number;
}

export function logicalSizeForWindow(innerWidth: number, innerHeight: number): ViewSize {
  const aspect = innerHeight > 0 ? innerWidth / innerHeight : 16 / 9;
  return { width: logicalWidthFor(aspect), height: GAME_H };
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

export const VIEW_WIDTH_BOUNDS = { min: MIN_VIEW_W, max: MAX_VIEW_W };
