/**
 * The game atlas is packed at this many texture pixels per logical unit (`density` in
 * scripts/asset-manifest.json): a frame authored at `size` 44 is 88 pixels on its longest side, so
 * it still has a pixel to spend when the canvas renders at up to three device pixels per unit
 * (src/game/render.ts). Anything drawing a game frame at its native size scales it by
 * GAME_FRAME_SCALE, and nothing on screen changes size; setDisplaySize callers need nothing.
 *
 * Bobs cannot scale, and the WebGL Blitter renderer ignores the blitter's own transform (it adds
 * its position as an offset and applies only the camera and a parent matrix), so a Blitter drawing
 * game frames sits in a Container scaled by GAME_FRAME_SCALE and its Bobs are placed in atlas
 * pixels (a logical position times GAME_ATLAS_DENSITY).
 *
 * The ui atlas is still 1x: its frames are nine-sliced with corner sizes written at every call.
 */
export const GAME_ATLAS_DENSITY = 2;
export const GAME_FRAME_SCALE = 1 / GAME_ATLAS_DENSITY;
