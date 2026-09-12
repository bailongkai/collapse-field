export interface Player {
  x: number;
  y: number;
  hp: number;
  /**
   * Which way the character faces, as an angle of either 0 (right) or PI (left). Directional
   * weapons fire along it. It is deliberately not the full movement direction: a character that
   * aimed exactly where they walked would swing into empty space the moment they backed away from
   * a crowd, and one that aimed at the nearest enemy would need no positioning at all.
   */
  facing: number;
  /** last input direction, normalised; zero means standing still */
  inputX: number;
  inputY: number;
  iframesMs: number;
  /** fractional HP carried between steps so `recovery` below 1 HP/s still works */
  healFraction: number;
  /** hits the signature shield will still negate outright */
  shieldCharges: number;
  /**
   * px/s taken off this step's movement by whatever floor the player is standing on. Set by the
   * mire pools each tick and consumed by `stepPlayer`, so nothing has to remember to clear it.
   */
  drag: number;
}

export function createPlayer(): Player {
  return { x: 0, y: 0, hp: 100, facing: 0, inputX: 0, inputY: 0, iframesMs: 0, healFraction: 0, shieldCharges: 0, drag: 0 };
}
