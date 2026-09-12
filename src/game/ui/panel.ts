import type Phaser from 'phaser';

/**
 * The panel every overlay sits in: a dark glass slab, a cyan hairline around it, corner brackets
 * and a short accent rule under the title. It is drawn rather than authored so one change of mind
 * about the look reaches every screen at once, and so the UI needs no extra art pack.
 */
export interface PanelOpts {
  tint?: number;
  alpha?: number;
  /** the accent colour of the brackets and rules */
  accent?: number;
  /** draw the short rule under the heading */
  rule?: boolean;
}

export function techPanel(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, o: PanelOpts = {}): Phaser.GameObjects.NineSlice {
  const accent = o.accent ?? 0x4fe0ff;
  const slab = scene.add
    .nineslice(cx, cy, 'ui', 'panel_glass', w, h, 24, 24, 24, 24)
    .setAlpha(o.alpha ?? 0.97)
    .setTint(o.tint ?? 0x16243a);

  const g = scene.add.graphics();
  const left = cx - w / 2;
  const top = cy - h / 2;
  const right = cx + w / 2;
  const bottom = cy + h / 2;
  const len = Math.min(34, w * 0.1, h * 0.1);

  g.lineStyle(1, accent, 0.25);
  g.strokeRect(left + 4, top + 4, w - 8, h - 8);
  g.lineStyle(2, accent, 0.75);
  for (const [x, y, sx, sy] of [
    [left + 4, top + 4, 1, 1],
    [right - 4, top + 4, -1, 1],
    [left + 4, bottom - 4, 1, -1],
    [right - 4, bottom - 4, -1, -1],
  ] as const) {
    g.lineBetween(x, y, x + sx * len, y);
    g.lineBetween(x, y, x, y + sy * len);
  }
  if (o.rule !== false) {
    g.lineStyle(1, accent, 0.35);
    g.lineBetween(cx - w * 0.18, top + 62, cx + w * 0.18, top + 62);
  }
  return slab;
}
