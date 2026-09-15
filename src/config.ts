/** Global, engine-agnostic constants. Keep gameplay numbers in src/data; keep engine limits here. */
/**
 * The reference view the content is authored against. Wave counts, the spawn ring and every tuned
 * number in src/data mean "at this size"; anything wider is compensated for by density rather than
 * by handing the player a bigger field for free.
 */
export const REF_W = 1280;
export const REF_H = 720;
export const REF_AREA = REF_W * REF_H;

/** Kept for layouts that want the reference size; live layout should read the scale manager. */
export const GAME_H = REF_H;
export const GAME_W = REF_W;
/**
 * How many CSS pixels one logical unit should cover, at least. A phone is only a few hundred CSS
 * pixels across, and holding the logical view at the reference size squeezed a 64-unit button down
 * to thirty CSS pixels and the player sprite to twenty — too small to hit and too small to read.
 * Below this ratio the view shrinks instead, so everything is drawn bigger.
 */
export const MIN_CSS_PER_UNIT = 0.72;
/** Aspect bounds for the logical view: wide enough for an ultrawide, tall enough for a phone. */
export const MIN_VIEW_ASPECT = 0.45;
export const MAX_VIEW_ASPECT = 2.6;
/** No dimension may collapse below this, whatever the window shape. */
export const MIN_VIEW_SIDE = 420;

/**
 * The logical view for a display of this CSS size.
 *
 * The view matches the display's shape exactly, so nothing is ever letterboxed, and covers a fixed
 * area of the world so that how much a player can see — and therefore the difficulty, which scales
 * with visible area — does not depend on their device. The one exception is a physically small
 * screen: there the area shrinks until a logical unit is worth at least MIN_CSS_PER_UNIT, because
 * a view nobody can read or tap is worse than a smaller one.
 *
 * At the reference 1280x720 this returns exactly the reference view.
 */
export function logicalSizeFor(cssWidth: number, cssHeight: number): { width: number; height: number } {
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  const aspect = Math.max(MIN_VIEW_ASPECT, Math.min(MAX_VIEW_ASPECT, w / h));
  const area = Math.min(REF_AREA, (w * h) / (MIN_CSS_PER_UNIT * MIN_CSS_PER_UNIT));
  let height = Math.round(Math.sqrt(area / aspect));
  let width = Math.round(height * aspect);
  // never let a dimension collapse: a slit of a view is unplayable whatever its area
  if (width < MIN_VIEW_SIDE) {
    width = MIN_VIEW_SIDE;
    height = Math.round(width / aspect);
  }
  if (height < MIN_VIEW_SIDE) {
    height = MIN_VIEW_SIDE;
    width = Math.round(height * aspect);
  }
  return { width, height };
}

/** True when the view is taller than it is wide, which changes how the panels lay out. */
export function isPortrait(width: number, height: number): boolean {
  return height > width;
}
export const FIXED_DT_MS = 1000 / 60;
export const FIXED_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
export const MAX_FRAME_DELTA_MS = 100;

export const ENEMY_CAP = 1024;
export const PROJECTILE_CAP = 512;
export const GEM_CAP_POOL = 400;
// the consumables' ground limits already sum to 31, so this leaves headroom for boss chests, which
// are deliberately uncapped and never recycled
export const PICKUP_CAP = 40;
/** gold a supply chest awards when the build has nothing left to upgrade */
export const CHEST_CONSOLATION_GOLD = 120;
export const DMG_NUMBER_POOL = 48;
export const DMG_NUMBERS_PER_STEP = 8;

export const GRID_CELL = 64;
export const GRID_SIZE = 64; // cells per axis, anchored on the player

export const IFRAME_MS = 400;
export const RUN_SECONDS = 900;
export const PLAYER_BASE_SPEED = 200; // px/s at moveSpeed 1
export const MAGNET_BASE_RADIUS = 60; // px at magnet 1
export const GEM_COLLECT_RADIUS = 16;
export const KNOCKBACK_UNIT = 240; // px/s per knockback point
export const KNOCKBACK_MAX = 600;
export const KNOCKBACK_DECAY = 0.85;
export const SEPARATION_MAX_PUSH = 4;
export const SEPARATION_MARGIN = 128;
export const HIT_FLASH_MS = 80;
/**
 * Largest enemy collision radius in src/data/enemies.ts. Broadphase queries pad by this, because
 * the grid stores an enemy's centre: a body whose centre is outside the query box can still
 * overlap it. A content test keeps this in step with the data.
 */
export const MAX_ENEMY_RADIUS = 80;
/** the player's body, for walls; contact uses its own slack */
export const PLAYER_RADIUS = 16;

export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 6;

export const SAVE_KEY = 'xjxcz.save.v1';
export const VERSION = '0.1.0';

/**
 * How many device pixels the canvas may hold, so that rendering at native resolution on a 4K or
 * retina display does not turn into a fill-rate bill a phone cannot pay. A desktop takes the larger
 * figure; a touch device gets the smaller one, which is still about a 2x render on most phones.
 */
export const MAX_CANVAS_PIXELS_FINE = 8_400_000;
export const MAX_CANVAS_PIXELS_COARSE = 3_600_000;
export const MAX_RENDER_SCALE = 3;

/**
 * Device pixels per logical unit the canvas is rendered at. The logical view is what the game is
 * laid out and balanced in and it does not change here; what changes is how many pixels each unit
 * gets. Rendering at the view's own size and letting the browser stretch it to the screen is what
 * made a 4K display look out of focus, so 1 is the floor and the pixel budget is the ceiling.
 */
export function renderScaleFor(logicalW: number, logicalH: number, cssW: number, dpr: number, maxPixels: number): number {
  const wanted = (Math.max(1, cssW) * Math.max(1, dpr)) / Math.max(1, logicalW);
  const budget = Math.sqrt(maxPixels / Math.max(1, logicalW * logicalH));
  const k = Math.min(wanted, budget, MAX_RENDER_SCALE);
  return Math.max(1, Math.round(k * 100) / 100);
}
