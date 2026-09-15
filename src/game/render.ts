import Phaser from 'phaser';
import { MAX_CANVAS_PIXELS_COARSE, MAX_CANVAS_PIXELS_FINE, logicalSizeFor, renderScaleFor } from '../config';
import { RENDER_SCALE_KEY, applyRenderScale, type ViewSize } from './layout';
import { setTextResolution } from './ui/textStyles';

/**
 * The canvas for a display: the logical view the game is laid out in, the render scale, and the
 * pixel size the canvas gets. The view is the same as it always was; the canvas used to be exactly
 * that size and the browser stretched it to the screen, which on a 4K or retina display meant
 * every glyph and hairline was drawn at a third of the pixels it was shown at.
 */
export interface CanvasPlan {
  logical: ViewSize;
  scale: number;
  width: number;
  height: number;
}

export function planCanvas(cssW: number, cssH: number): CanvasPlan {
  const logical = logicalSizeFor(cssW, cssH);
  const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
  // a touch device is asked for fewer pixels: its GPU pays for every one of them at 60 fps
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const scale = renderScaleFor(logical.width, logical.height, cssW, dpr, coarse ? MAX_CANVAS_PIXELS_COARSE : MAX_CANVAS_PIXELS_FINE);
  return { logical, scale, width: Math.round(logical.width * scale), height: Math.round(logical.height * scale) };
}

/** Records the plan's scale where every scene reads it, and rasterises text at the same density. */
export function commitRenderScale(game: Phaser.Game, plan: CanvasPlan): void {
  game.registry.set(RENDER_SCALE_KEY, plan.scale);
  setTextResolution(plan.scale);
}

/**
 * Every scene gets its cameras pointed at the logical view when it starts, and again when the
 * canvas is resized, so no scene has to know the canvas holds more pixels than the view. START
 * rather than CREATE, because the preload scene draws its progress bar before create() runs; the
 * camera manager has already made the main camera by the time this listener hears START. The
 * first scene can be running before the game is ready, so it is covered directly as well.
 */
export function installRenderScale(game: Phaser.Game): void {
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.getScenes(false)) {
      scene.events.on(Phaser.Scenes.Events.START, () => applyRenderScale(scene));
      scene.events.on(Phaser.Scenes.Events.CREATE, () => applyRenderScale(scene));
    }
    for (const scene of game.scene.getScenes(true)) applyRenderScale(scene);
  });
  game.scale.on(Phaser.Scale.Events.RESIZE, () => {
    for (const scene of game.scene.getScenes(true)) applyRenderScale(scene);
  });
}
