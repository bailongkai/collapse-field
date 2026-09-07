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
/** Bounds on the logical width, so an ultrawide monitor cannot reveal half the map. */
export const MIN_VIEW_W = 1024;
export const MAX_VIEW_W = 1760;
/** A phone gets a smaller logical view; below this it would show too little of the map. */
export const MIN_VIEW_H = 420;
/**
 * How many CSS pixels one logical unit should cover, at least. A phone in landscape is only a few
 * hundred CSS pixels tall, and holding the logical view at 720 squeezed a 64-unit button down to
 * thirty CSS pixels and the player sprite to twenty — too small to hit and too small to read. Below
 * this ratio the view shrinks instead, so everything is drawn bigger.
 */
export const MIN_CSS_PER_UNIT = 0.72;
/** Aspect bounds for the logical view, so it never becomes a slit or a square. */
export const MIN_VIEW_ASPECT = 1.25;
export const MAX_VIEW_ASPECT = 2.6;

/** Logical width for a display of the given aspect ratio, at the reference height. */
export function logicalWidthFor(aspect: number): number {
  const raw = Math.round(REF_H * aspect);
  return Math.max(MIN_VIEW_W, Math.min(MAX_VIEW_W, raw));
}

/** The logical view for a display of this CSS size. */
export function logicalSizeFor(cssWidth: number, cssHeight: number): { width: number; height: number } {
  const aspect = cssHeight > 0 ? cssWidth / cssHeight : 16 / 9;
  const height = Math.max(MIN_VIEW_H, Math.min(REF_H, Math.round(cssHeight / MIN_CSS_PER_UNIT)));
  const clampedAspect = Math.max(MIN_VIEW_ASPECT, Math.min(MAX_VIEW_ASPECT, aspect));
  const width = Math.max(MIN_VIEW_W, Math.min(MAX_VIEW_W, Math.round(height * clampedAspect)));
  return { width, height };
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
export const MAX_ENEMY_RADIUS = 60;

export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 6;

export const SAVE_KEY = 'xjxcz.save.v1';
export const VERSION = '0.1.0';
