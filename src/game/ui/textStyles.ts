import type Phaser from 'phaser';

export const FONT_CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
export const FONT_DISPLAY = `"kenvector_future", ${FONT_CJK}`;

export const COLORS = {
  text: '#e8f1ff',
  dim: '#9fb3c8',
  accent: '#4fe0ff',
  warn: '#ff6b6b',
  gold: '#ffd166',
  good: '#7bf1a8',
};

function resolution(): number {
  return Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
}

export interface StyleOpts {
  color?: string;
  bold?: boolean;
  display?: boolean;
  align?: 'left' | 'center' | 'right';
  stroke?: boolean;
  wrapWidth?: number;
}

export function textStyle(size: number, o: StyleOpts = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const s: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: o.display ? FONT_DISPLAY : FONT_CJK,
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
  return s;
}
