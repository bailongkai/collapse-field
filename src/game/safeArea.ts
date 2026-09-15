import type Phaser from 'phaser';
import { viewOf } from './layout';

/** The notch and home-indicator insets, in the scene's logical units. Zero on any ordinary screen. */
export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let probe: HTMLDivElement | null = null;

/** Reads env(safe-area-inset-*) through a hidden element, since CSS is the only place it exists. */
function cssInsets(): SafeInsets {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:0;height:0;' +
      'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
      'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
}

export function safeInsets(scene: Phaser.Scene): SafeInsets {
  const css = cssInsets();
  const canvas = scene.game.canvas;
  const view = viewOf(scene);
  const cssW = canvas?.clientWidth || view.width;
  // logical units per CSS pixel: the canvas is FIT-scaled, so one factor serves both axes
  const k = view.width / cssW;
  return { top: css.top * k, right: css.right * k, bottom: css.bottom * k, left: css.left * k };
}
