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

## The shape of a run

Aiming is the player's job, and the character faces left or right only. Facing
follows horizontal input and vertical movement leaves it alone, so turning is
one deliberate press rather than a direction vector that drifts with every step.
The blade sweeps a horizontal band to both sides at once; the railgun fires in a
cone to the side it faces; only the guided laser picks its own target, and that
is its whole identity. Two earlier rules were both wrong and are worth not
re-inventing: firing along the full movement direction makes the starting weapon
useless the moment the player backs away from a crowd, and aiming every weapon
at the nearest enemy removes positioning from the game entirely. Changing any of
this shifts the whole difficulty curve, so re-measure with
`tests/unit/balance.test.ts` over at least sixteen seeds before believing it.

Weapons evolve rather than only levelling: a maxed weapon plus its paired
passive turns the next supply chest into an evolution. Evolutions live in the
same weapon table with `evolvedOnly`, are never offered on level-up, and replace
their base in place.

Supply chests are what make that reachable, and the reason is arithmetic worth
remembering. Evolving needs seven levels on one weapon; a run hands out about
nine level-ups; the offer shows three cards drawn from ten items, so the weapon
being pushed appears about a third of the time. With the two boss chests the
stage used to have, sixteen measured seeds produced zero evolutions — five
weapons of content nobody had ever seen. A chest concentrates where a level-up
scatters: `src/core/levelup/chest.ts` weights rewards steeply towards whatever
is nearest to maxing, so a five-reward chest can finish a weapon.

A chest resolves entirely inside `Simulation.openChest`, on the tick it is
collected, and pushes a `ChestResult` onto `run.chestQueue`. `ChestScene` is
theatre played over a decision already made. That is deliberate: it means chests
need no run phase of their own, so the balance harness, `stepResolving` and
`fastForward` all work without knowing they exist. `fastForward` does have to
drain the queue, or one chest pauses the run and the span returns early looking
like a run that simply ended. Enemy behaviour is a per-instance state machine on
`aiState` / `aiTimer` / `aiTimer2`, which is how the ranged, dashing and boss
enemies telegraph before they act.

Presentation that is not simulation belongs on the view side: the score in
`src/game/audio/music.ts` is synthesised from the Web Audio clock, and the
ground shadows in `src/game/view/shadowView.ts` are a single Blitter. Shadows do
more work than they look like: they are what makes sprites drawn from three
different art packs read as standing on the same floor.

## Characters and stages

A character is stats plus a starting weapon plus a level-up bonus, and there is
one per base weapon, so the first minute already plays five ways. Priced
characters are bought with gold in the shop (`src/core/save/unlocks.ts`); the
launch screen (`LaunchScene`) is the only place the menu starts a run from, and
it remembers the last selection in the save.

Stages are a chain: surviving stage n opens n + 1, recorded in
`save.unlocks.stages` by `commitRun`. Each stage owns its floor texture
(`scripts/build-floor.mjs` makes one per entry in `manifest.floors`), its decor,
its wave table and its events. `WaveEntry.speedMult` exists because the player
moves at 200 px/s and the fastest ordinary enemy at 150, so nothing short of it
can make running in a straight line stop working; only the orbit uses it.

## Adding content

A weapon of an existing archetype is a data change in `src/data/weapons.ts` plus
an atlas frame in `scripts/asset-manifest.json`. A character is a data change in
`src/data/characters.ts` plus a frame; a stage is a data change in
`src/data/stages.ts` plus a floor entry and decor frames. A new archetype also needs a
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

The logical view takes the shape of the display and can be portrait, so scene
layout must read `this.scale.width` / `.height` rather than any constant, panels
must go through `fitPanel`, and a screen with two columns needs a one-column
fallback for a narrow phone. Anything gameplay-facing takes the view size as an
explicit input: `Simulation` receives it in its options and defaults to the
reference 1280x720, which is why unit tests still see exactly the authored
balance.

Touch targets are the other constraint the reference size hides. On a phone a
logical unit is worth well under one CSS pixel, so anything a finger has to hit
is checked against `minTouchUnits`. Buttons are containers: Phaser normalises a
container's hit test by its displayOrigin, so a hit rectangle for one that has
had `setSize` called must be authored from the top-left, not centred.

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
