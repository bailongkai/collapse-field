/**
 * How much harder a boss is for a build that has outgrown it. Decided once, on the tick the boss
 * arrives, from the player's level; a boss's health never changes after that.
 *
 * Boss health was authored against the autopilot, which reaches 5:00 at about level 6 and 15:00 at
 * about level 13. A person reaches the same minutes at level 30 and level 90, with every weapon
 * evolved, and killed each boss in ten to thirty seconds: two charges into a fight whose set piece
 * comes round every five. The gap is not a factor of four, which is what the first version of this
 * rule allowed: measured as the damage a boss takes per second, the human-like builds need
 * seventeen to thirty-five times the authored health to last the fights' intended lengths (25 s at
 * 5:00, 40 s at 10:00, 60 s for the final, the enrage at 90 s meant to be reachable), and the
 * autopilot's builds need about one times it.
 *
 * `authored` is the level up to which the fight stands exactly as written: twice what the autopilot
 * brings, so a first run never meets a scaled boss. Past it, health grows by `gain` of itself for
 * every further multiple of that level, up to `cap`. The gains were fitted to measured intake over
 * eight seeds and all eight stages: a level-14 build at 5:00 needs about x2.7 and gets x2.3, a
 * level-20 build x7.4 and gets x7.9, level 30 x19 and gets x17; at 10:00 level 40 needs x14.7 and
 * gets x13.8, level 60 x26 and gets x26; at the final, level 60 needs x11 and gets x13, level 90 x25
 * and gets x24. Between stages the same build is out by up to a factor of two either way, which a
 * number fixed at arrival cannot follow. The station's mothership is the shortest 5:00 fight for a
 * strong build, but its authored 400 hp stays: it is the fight a first run meets, and a 5:00 boss
 * that walled weak builds was once the loudest complaint the game had (content.test.ts guards it).
 *
 * An adaptive version that re-measured the boss's intake during the fight was built and withdrawn:
 * it kept the length exactly but made a player's damage upgrades invisible against bosses, and a
 * bar that climbs during a fight reads as a bug. Health is fixed.
 */
export const BOSS_SCALING = {
  authored: { base: 6, perMinute: 4 / 3 },
  gain: { boss: 12, final: 9.5 },
  cap: { boss: 30, final: 28 },
} as const;
