/**
 * The end-of-run score: one number a player can compare with their last run and post. It is a sum
 * of what the run already counts, with weights chosen so that no one term can carry it alone, then
 * scaled by the challenge the player opted into:
 *
 *   score = (10 x seconds survived + kills + 50 x level + 1000 x bosses killed + 5000 if cleared)
 *           x (1 + curse)
 *
 * Measured on the station: the immortal autopilot (the nearest thing to a good run) clears it for
 * about 30,000 — 9,700 for time, 9,700 for kills, 3,200 for level, 3,000 for bosses and 5,000 for
 * the clear; the mortal one dying just after the 5:00 boss scores 4,000 to 5,000.
 */
export const SCORE_WEIGHTS = { perSecond: 10, perKill: 1, perLevel: 50, perBoss: 1000, clear: 5000 } as const;
