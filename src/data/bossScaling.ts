/**
 * How much harder a boss is for a build that has outgrown it.
 *
 * Boss health was authored against the autopilot, which reaches 5:00 at about level 6 and 15:00 at
 * about level 13. A person reaches the same minutes at level 30 and level 90, with every weapon
 * evolved, and killed each boss in ten to thirty seconds: two charges into a fight whose set piece
 * comes round every five. A flat multiplier cannot fix that, because the two players are a factor
 * of six apart and whatever suits one is wrong for the other. So health follows the level the
 * player arrives at, the way the genre's own bosses do.
 *
 * `authored` is the level up to which the fight stands exactly as written: twice what the
 * autopilot brings, so a first run never meets a scaled boss. Past it, health grows by `gain` of
 * itself for every further multiple of that level, up to `cap`. It is a ratio rather than a count
 * of levels because levels spread out as a run goes on: twenty levels over is a different build at
 * 5:00 than at 15:00.
 *
 * The final boss gains less and is capped lower because it enrages at ninety seconds, and a fight
 * nobody can finish before the enrage is a different rule, not a harder one. A first version that
 * gave it the same slope as the others took the autopilot's three clears in sixteen seeds to none.
 */
export const BOSS_SCALING = {
  authored: { base: 6, perMinute: 4 / 3 },
  gain: { boss: 1.9, final: 1.05 },
  cap: { boss: 4.5, final: 3.5 },
} as const;
