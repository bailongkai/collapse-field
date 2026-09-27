/** title and heading rule: everything above the first row of the summary */
export const RESULTS_HEADER = 96;
/** between the summary and the build when one sits under the other */
export const RESULTS_BLOCK_GAP = 22;
/** the height the panel had when it was a constant, kept as its least so a short run looks the same */
const PANEL_MIN_H = 640;
const ONE_COLUMN_W = 720;
const TWO_COLUMN_W = 880;
/** narrower than this there is no room for the summary and the build side by side */
const TWO_COLUMN_MIN_W = 680;

export interface ResultsBlocks {
  /** the rows, the stage that opened and the achievements */
  stats: number;
  /** the icons and the damage bars */
  build: number;
}

export interface ResultsPlan {
  columns: 1 | 2;
  panelW: number;
  panelH: number;
  /** applied to the summary and the build, never to the title or the buttons */
  scale: number;
}

export function oneColumnWidth(maxW: number): number {
  return Math.min(ONE_COLUMN_W, maxW);
}

/** Zero when the screen is too narrow for two columns. */
export function twoColumnWidth(maxW: number): number {
  return maxW >= TWO_COLUMN_MIN_W ? Math.min(TWO_COLUMN_W, maxW) : 0;
}

/**
 * How the results screen fits what it has to show.
 *
 * It used to place everything at fixed offsets from the top of a 640-unit panel and the buttons at
 * a fixed offset from the bottom, which only works while the two never meet. A run that opened a
 * stage, earned achievements and used four weapons is 40 units taller than one that did not, and
 * the last damage bar went under the buttons. So the content is measured and the footer reserved:
 * the panel grows while the screen has room, then the summary and the build go side by side, and
 * only then does anything shrink.
 *
 * The achievements line wraps differently in a narrower column, so each arrangement brings its
 * own measured heights; `two` is null on a screen too narrow to have one.
 */
export function planResults(input: { maxW: number; maxH: number; footerH: number; one: ResultsBlocks; two: ResultsBlocks | null }): ResultsPlan {
  const { maxW, maxH, footerH, one, two } = input;
  const room = Math.max(1, maxH - RESULTS_HEADER - footerH);
  const oneH = one.stats + RESULTS_BLOCK_GAP + one.build;

  if (oneH <= room) {
    const need = RESULTS_HEADER + oneH + footerH;
    return { columns: 1, panelW: oneColumnWidth(maxW), panelH: Math.min(maxH, Math.max(PANEL_MIN_H, need)), scale: 1 };
  }

  const oneScale = room / oneH;
  const twoW = twoColumnWidth(maxW);
  if (two && twoW > 0) {
    const twoScale = Math.min(1, room / Math.max(two.stats, two.build));
    if (twoScale > oneScale) return { columns: 2, panelW: twoW, panelH: maxH, scale: twoScale };
  }
  return { columns: 1, panelW: oneColumnWidth(maxW), panelH: maxH, scale: oneScale };
}
