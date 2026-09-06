# Working in this repository

星际幸存者 is a Vampire Survivors-like in Phaser 4 + TypeScript. Read `README.md`
first for what the game is and how to run it.

## The one rule that shapes everything

`src/core`, `src/data` and `src/i18n` must stay free of Phaser and of
`Math.random`. Lint enforces the imports and `tests/unit/coreBoundary.test.ts`
enforces the ambient namespace too. The payoff is that the entire rules engine
runs under vitest in milliseconds and whole runs are reproducible from a seed;
breaking it would cost the test suite its speed and its determinism.

Randomness comes from `world.rng` (mulberry32). Time comes from the fixed step,
never from `Date.now` or a Phaser timer.

## Where things live

- `src/core/sim/simulation.ts` — the tick order, and the entry point for every
  rule. `step()` only advances while the run is `running`, so pausing and the
  level-up offer freeze time by construction.
- `src/core/sim/systems/` — one file per system, called in tick order.
- `src/core/weapons/behaviors/` — one file per weapon archetype. A behavior says
  whether the weapon system arms its cooldown (`'cooldown'`) or it does so
  itself (`'hold'`, which is how the orbit weapon waits for its drones).
- `src/data/` — all content. Balance changes belong here and nowhere else.
- `src/game/view/` — pooled display objects. Views read simulation state; they
  never write it.
- `src/debug/hook.ts` — `window.__game`, the only way the tests drive the game.

## Adding content

A weapon of an existing archetype is a data change in `src/data/weapons.ts` plus
an atlas frame in `scripts/asset-manifest.json`. A new archetype also needs a
behavior file and an entry in `src/core/weapons/registry.ts`. An enemy is a data
change plus a frame. `tests/unit/content.test.ts` will fail if a referenced
frame, i18n key or behavior is missing, so run the unit tests first.

Every player-visible string goes in `src/i18n/zh-CN.ts`. A test fails on any CJK
character written anywhere else in `src/`.

## Testing

Prefer a unit test: the simulation runs headlessly, so most behaviour can be
asserted in a few milliseconds without a browser. Use Playwright when the thing
being checked is presentation, input or scene lifecycle.

Two traps worth knowing, both of which have already caused bugs here:

- Phaser reuses scene instances across launches. Reset per-run fields in
  `create()` or the next launch points at the previous one's destroyed objects.
- Phaser drains its scene queue on frame boundaries. Stopping scenes and
  starting new ones in the same tick leaves the stack half-dismantled; wait a
  frame between the two.

The starting weapon fires from the first tick, so a test that measures a crowd
has to account for it. `tests/unit/horde.test.ts` strips the weapons for exactly
this reason.

The logical view is 720 tall with a variable width, so scene layout must read
`this.scale.width` rather than a constant, and anything gameplay-facing takes
the view size as an explicit input. `Simulation` receives it in its options and
defaults to the reference 1280x720, which is why unit tests still see exactly
the authored balance.

Calibrating balance needs more seeds than feels necessary. Three seeds gave a
confident but wrong answer about how view width affects difficulty; the spread
between seeds was larger than the effect. Sixteen seeds settled it.

Touch input needs `input.activePointers` above the default of one, or a second
finger never reaches a button while the virtual stick is held. `tests/e2e/
mobile.spec.ts` covers that with real multi-finger events; it fails if the
config is dropped.

When gating on a command's exit status, do not pipe it into `head` or `tail`:
the pipeline reports the last command's status and a failing test run will look
like a pass.
