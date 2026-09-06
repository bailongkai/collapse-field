/** Global, engine-agnostic constants. Keep gameplay numbers in src/data; keep engine limits here. */
/**
 * The reference view the content is authored against. Wave counts, the spawn ring and every tuned
 * number in src/data mean "at this size"; anything wider is compensated for by density rather than
 * by handing the player a bigger field for free.
 */
export const REF_W = 1280;
export const REF_H = 720;
export const REF_AREA = REF_W * REF_H;

/** The logical height never changes; only the width follows the display's aspect ratio. */
export const GAME_H = REF_H;
/** Kept for layouts that want the reference width; live layout should read the scale manager. */
export const GAME_W = REF_W;
/** Bounds on the logical width, so an ultrawide monitor cannot reveal half the map. */
export const MIN_VIEW_W = 1024;
export const MAX_VIEW_W = 1760;

/** Logical width for a display of the given aspect ratio, clamped to the playable range. */
export function logicalWidthFor(aspect: number): number {
  const raw = Math.round(GAME_H * aspect);
  return Math.max(MIN_VIEW_W, Math.min(MAX_VIEW_W, raw));
}
export const FIXED_DT_MS = 1000 / 60;
export const FIXED_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
export const MAX_FRAME_DELTA_MS = 100;

export const ENEMY_CAP = 1024;
export const PROJECTILE_CAP = 512;
export const GEM_CAP_POOL = 400;
export const PICKUP_CAP = 32;
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

export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 6;

export const SAVE_KEY = 'xjxcz.save.v1';
export const VERSION = '0.1.0';
