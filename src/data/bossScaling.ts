/**
 * How much harder a boss is for a build that has outgrown it.
 *
 * Boss health was authored against the autopilot, which reaches 5:00 at about level 6 and 15:00 at
 * about level 13. A person reaches the same minutes at level 30 and level 90, with every weapon
 * evolved, and killed each boss in ten to thirty seconds: two charges into a fight whose set piece
 * comes round every five. A flat multiplier cannot fix that, because the two players are a factor
 * of six apart and whatever suits one is wrong for the other.
 *
 * Two rules, one after the other. On arrival, health follows the level: `authored` is the level up
 * to which the fight stands exactly as written, twice what the autopilot brings, and past it health
 * grows by `gain` of itself for every further multiple of that level, up to `cap`. Level is a poor
 * proxy for output, though: two level-sixty builds measured a factor of two apart, the caps were
 * reached by level sixty, and a human-like build still killed twenty-two of twenty-four bosses
 * inside twenty-five seconds and never saw an enrage.
 *
 * So once it is being hit, the boss measures what it is taking, in windows of `measureMs` from its
 * first hit, and if that rate would finish it before `targetSeconds` it multiplies its health and
 * its maximum alike (the bar never jumps) so the rate takes the rest of the target. It checks through
 * the first half of the target, catching a fight that warms up as the boss walks into the blade,
 * and only ever upwards: a build slower than the target, a first run among them, meets the fight
 * as written. `dpsCap` bounds a runaway figure. The final boss gets the longest target because its
 * enrage at ninety seconds is meant to be a threat a slow fight can reach.
 *
 * The evaluation proposed measuring the run's damage over its last minute against the crowd, and
 * that was built first. It read a fighting build at a half to a third of what it dealt to the boss
 * (crowd bodies die before they show a weapon's whole rate) and a kiting one at seven times (the
 * crowd it farmed was not the boss it ran from); the boss's own intake has neither problem.
 *
 * A chest opened during the check would otherwise feed the reward into the boss: before the first
 * settlement the straddling window is discarded, after it the check ends.
 */
export const BOSS_SCALING = {
  authored: { base: 6, perMinute: 4 / 3 },
  gain: { boss: 1.9, final: 1.05 },
  cap: { boss: 4.5, final: 3.5 },
  /** seconds from the first hit the 5:00, the 10:00 and the final fight are meant to take */
  targetSeconds: { first: 25, second: 40, final: 60 },
  /** the check may raise health to at most this many times the authored figure */
  dpsCap: 60,
  /** how long a boss measures its own intake, from its first hit, before it settles its health */
  measureMs: 4000,
  /** the shortest span a rate is taken over, so one opening burst is not read as a rate */
  measureFloorMs: 2000,
} as const;
