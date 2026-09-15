import type Phaser from 'phaser';

export const FONT_CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
/** headings and buttons: a condensed oblique CJK face with some speed in it, bundled and subset */
export const FONT_TITLE = `"Smiley Sans", ${FONT_CJK}`;
/** latin display: the wide geometric face for taglines, numbers and labels */
export const FONT_DISPLAY = `"Orbitron", "kenvector_future", ${FONT_CJK}`;

export const COLORS = {
  text: '#e8f1ff',
  dim: '#9fb3c8',
  accent: '#4fe0ff',
  warn: '#ff6b6b',
  gold: '#ffd166',
  good: '#7bf1a8',
};

let textResolution = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);

/**
 * Text is rasterised at this many pixels per logical unit. It is the render scale (see
 * src/game/render.ts): a glyph drawn once at the density it is shown at is sharp, and one drawn at
 * the device's own ratio was still stretched whenever the canvas was smaller than the screen.
 */
export function setTextResolution(k: number): void {
  textResolution = Math.max(1, Math.min(4, k));
}

function resolution(): number {
  return textResolution;
}

export interface StyleOpts {
  color?: string;
  bold?: boolean;
  display?: boolean;
  align?: 'left' | 'center' | 'right';
  stroke?: boolean;
  wrapWidth?: number;
  /** the heading face; every bold text takes it unless `plain` says otherwise */
  title?: boolean;
  plain?: boolean;
  letterSpacing?: number;
}

export function textStyle(size: number, o: StyleOpts = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const s: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: o.display ? FONT_DISPLAY : o.title || (o.bold && !o.plain) ? FONT_TITLE : FONT_CJK,
    fontSize: `${size}px`,
    fontStyle: o.bold ? 'bold' : 'normal',
    color: o.color ?? COLORS.text,
    align: o.align ?? 'left',
    resolution: resolution(),
    padding: { y: 4 },
  };
  if (o.stroke) {
    s.stroke = '#000000';
    s.strokeThickness = Math.max(2, Math.round(size / 8));
  }
  if (o.wrapWidth) s.wordWrap = { width: o.wrapWidth, useAdvancedWrap: true };
  if (o.letterSpacing) s.letterSpacing = o.letterSpacing;
  return s;
}
