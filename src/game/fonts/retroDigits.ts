import Phaser from 'phaser';

export const DIGIT_FONT_KEY = 'digits';
const CHARS = '0123456789:+-';
const CELL_W = 24;
const CELL_H = 32;

/**
 * Builds a RetroFont (BitmapText font) containing only digits and ':' '+' '-' from a canvas texture
 * so damage numbers and the timer never re-rasterise canvas Text at runtime.
 */
export function buildDigitFont(scene: Phaser.Scene): boolean {
  if (scene.cache.bitmapFont.exists(DIGIT_FONT_KEY)) return true;
  const texKey = 'digits_tex';
  const w = CELL_W * CHARS.length;
  const canvas = scene.textures.createCanvas(texKey, w, CELL_H);
  if (!canvas) return false;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, w, CELL_H);
  ctx.font = `bold 26px "kenvector_future", "Menlo", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < CHARS.length; i++) {
    ctx.fillText(CHARS[i], i * CELL_W + CELL_W / 2, CELL_H / 2 + 1);
  }
  canvas.refresh();
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: texKey,
    width: CELL_W,
    height: CELL_H,
    chars: CHARS,
    charsPerRow: CHARS.length,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(DIGIT_FONT_KEY, data);
  return true;
}
