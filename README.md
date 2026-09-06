# 星际幸存者 (Star Survivors)

A sci-fi bullet-heaven in the shape of Vampire Survivors: you hold position on a
station overrun by alien swarms, your weapons fire themselves, and you live or
die on where you stand. Built with Phaser 4 and TypeScript, playable in a
browser, Chinese interface with English available in the settings.

## Running it

```bash
npm install
npm run assets     # downloads the Kenney CC0 packs and builds the atlases (only needed once)
npm run dev        # http://localhost:5173
```

The built asset atlases are committed, so `npm run assets` is only needed when
changing what art the game uses.

## The game

Fifteen minutes on one map. Enemies arrive in waves that thicken every minute,
the mothership comes at 5:00 and 10:00, and at 15:00 an invulnerable reaper
arrives and ends the run however strong you are. Killing enemies drops XP; each
level offers three upgrades to pick from.

| | Desktop | Touch |
|---|---|---|
| Move | WASD, arrow keys, gamepad stick | virtual stick: press anywhere in the lower screen and drag |
| Pause | Esc or P | the button in the top right |
| Level-up | 1-4, or arrows and Enter | tap a card |

On a phone the game wants landscape; held upright it asks to be rotated. The
touch controls stay hidden until the screen is actually touched, so a laptop
with a touchscreen is not cluttered with them. `?touch=1` forces them on.

Five weapons (等离子刃, 制导激光, 磁轨炮, 轨道无人机, EMP力场) and five passives,
each to level 8 and 5 respectively, in six slots each.

## How it is built

The rules live in `src/core` as a Phaser-free, fixed-step, seeded simulation.
Nothing in there imports Phaser or calls `Math.random`, which is enforced by
lint and by a test. That is what makes whole runs reproducible, testable without
a browser, and fast-forwardable.

`src/data` holds the content as typed constants: weapons with their per-level
deltas, passives, enemies, the wave table and its timed events, pickups and the
character. Adding a sixth weapon of an existing archetype is a data change.

`src/game` holds the Phaser scenes and the views that mirror simulation state
into pooled display objects once per frame. Entities are never allocated during
play: enemies, projectiles, gems and damage numbers all come from fixed pools,
collisions go through an `Int32Array` uniform grid, and gems draw through a
Blitter.

`window.__game` exposes the whole simulation to tests: spawn hordes, grant
builds, jump the clock, fast-forward whole runs, press any button by id, and
read frame timings. Every Playwright spec drives the game through it.

## Verifying a change

```bash
npm run verify     # types, lint, unit tests, functional specs, touch specs, performance gates
npm run bench      # the same performance spec headed, on a real GPU
```

Touch specs run against an emulated phone in landscape and drive the game with
synthesised multi-finger touch events, so holding the stick while tapping a
button is covered rather than assumed.

Measured on an Apple M4 with 500 enemies, five maxed weapons and 300 gems on the
field: simulation 0.22 ms, sprite sync 0.14 ms, render 0.55 ms, median frame
16.7 ms. Headless Chromium draws through SwiftShader, so frame time is only
asserted in the bench project.

`tests/unit/balance.test.ts` plays whole runs with a kiting autopilot and checks
the difficulty curve, so a wave-table change that makes the game trivial or
unwinnable fails a test rather than waiting to be noticed.

## Credits

All art and audio by [Kenney](https://kenney.nl), CC0. See `CREDITS.md`.
