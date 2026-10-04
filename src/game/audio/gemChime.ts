/**
 * The pitch of the gem chime. Every gem collected within `WINDOW_MS` of the last one is a step up
 * the ladder, up to `MAX_STEPS`, and a pause drops it back to the root: a run through a field of
 * gems climbs, and the climb is the half of the genre's rhythm the game did not have. Pure
 * arithmetic on the view's own clock, so it is testable and never touches the simulation.
 */
export const WINDOW_MS = 700;
export const MAX_STEPS = 12;
/** a semitone per step, so twelve steps is an octave */
const STEP = Math.pow(2, 1 / 12);

export class GemChime {
  private lastMs = -Infinity;
  private steps = 0;

  /** Registers a gem collected at `nowMs` and returns the playback rate for its chime. */
  next(nowMs: number): number {
    this.steps = nowMs - this.lastMs <= WINDOW_MS ? Math.min(MAX_STEPS, this.steps + 1) : 0;
    this.lastMs = nowMs;
    return Math.pow(STEP, this.steps);
  }

  reset(): void {
    this.lastMs = -Infinity;
    this.steps = 0;
  }
}
