export interface Player {
  x: number;
  y: number;
  hp: number;
  facing: number;
  /** last input direction, normalised; zero means standing still */
  inputX: number;
  inputY: number;
  iframesMs: number;
  /** fractional HP carried between steps so `recovery` below 1 HP/s still works */
  healFraction: number;
}

export function createPlayer(): Player {
  return { x: 0, y: 0, hp: 100, facing: 0, inputX: 0, inputY: 0, iframesMs: 0, healFraction: 0 };
}
