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
npm run dev:lan    # also serves on the local network, for testing on a real phone
```

To try it on a phone, run `npm run dev:lan` and open the network address it
prints. Touch controls appear on the first touch. The emulated-phone specs cover
the input and layout; frame rate on real hardware is the one thing they cannot
tell you.

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

A phone works held either way. The touch controls stay hidden until the screen
is actually touched, so a laptop with a touchscreen is not cluttered with them;
`?touch=1` forces them on.

The logical view takes the shape of the display, so a wide monitor, a phone held
sideways and a phone held upright all fill their screen with nothing letterboxed
away. It covers a fixed area of the world, so how much a player can see does not
depend on their device, except on a physically small screen, where the view
shrinks until one logical unit is worth at least 0.72 CSS pixels — a view nobody
can read or tap is worse than a smaller one. Because difficulty scales with
visible area, the wave table follows automatically. Measured with a kiting
autopilot, a view that showed more of the map without that scaling survived 27%
longer; with it, the difference is within seed-to-seed noise.

Five weapons (等离子刃, 制导激光, 磁轨炮, 轨道无人机, EMP力场) and five passives,
each to level 8 and 5 respectively, in six slots each. Max a weapon, own its
paired passive, and the next supply chest evolves it into something else
entirely. Gold banked from finished runs buys permanent upgrades from the
shop on the main menu.

Enemies are not all the same problem: most walk straight at you, 酸液喷吐者
keeps its distance and spits, 突袭者 freezes and then lunges, and the mothership
telegraphs a charge and drops reinforcements.

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
16.7 ms. A 1720-wide view carrying its larger crowd holds the same median frame.
Headless Chromium draws through SwiftShader, so frame time is only asserted in
the bench project.

`tests/unit/balance.test.ts` plays whole runs with a kiting autopilot and checks
the difficulty curve, so a wave-table change that makes the game trivial or
unwinnable fails a test rather than waiting to be noticed.

## Publishing

`.github/workflows/ci.yml` runs the whole verification pipeline on every push
and, on `main`, deploys the built game to GitHub Pages. Enable Pages with
"GitHub Actions" as the source; the build uses relative asset paths, so it works
from a repository subpath without configuration.

## Credits

All art and sound effects by [Kenney](https://kenney.nl), CC0. See `CREDITS.md`.
The score is synthesised at runtime in `src/game/audio/music.ts` rather than
shipped as a file: the Kenney packs have no music, and generating it keeps the
project free of any third-party licence to track.

## Characters and stages

Five characters, one per starting weapon: 幸存者 (等离子刃), 陆战队员 (磁轨炮),
系统工程师 (制导激光), 维护单元 M-7 (EMP 力场), 领航员 (轨道无人机). The four
priced ones are bought with gold in the shop. Four stages in a chain — 失守的空间站,
货运甲板, 生物实验舱, 外层轨道 — each with its own floor, enemies, events and boss;
surviving one opens the next. Both are picked on the launch screen behind Start,
which remembers the last choice.

Hands-off balance over sixteen seeds (survivor, mean survival): station 312 s,
cargo 519 s, lab 395 s, orbit 220 s. The orbit is the hardest on purpose: its
wave rows carry a speed multiplier and its raiders outrun the player, so running
in a straight line stops working there and nowhere else.

## Between runs

Twenty achievements, most paying gold and three opening the later passives.
Reroll, skip and banish are bought in the shop as charges per run. Once a build
is full, level-ups offer limit break cards — one weapon, one stat, no cap. The
launch screen has a challenge toggle (curse +20/40/60%, paid back in experience
and gold), and the results screen ends on which weapon did the work. A bestiary
behind the achievements screen lights every enemy a run has met.

Every stage scatters breakable scenery, places three relics at fixed
coordinates with a guide arrow at the edge of the view, and the cargo deck has
solid containers to fight around.

## 打包手机版 (Capacitor)

The web build is also the mobile build: Capacitor wraps `dist/` in a native shell. The native
projects are generated locally and not committed.

```
xcode-select --install && sudo gem install cocoapods     # iOS (macOS only)
# Android: install Android Studio, then set ANDROID_HOME / JAVA_HOME
npx cap add ios
npx cap add android
npm run cap:sync        # build + copy dist/ into both shells
npm run cap:ios         # opens Xcode
npm run cap:android     # opens Android Studio
```

Monetisation goes through `src/platform/`: `ads.ts` (AdMob rewarded + interstitial), `purchases.ts`
(RevenueCat; product ids in `src/core/save/purchases.ts`) and `analytics.ts`. On the web every
service is a fake that completes at once under `?test=1`, which is what the browser suite
exercises; on a device the native plugin is loaded lazily. Set `VITE_REVENUECAT_KEY` for real
purchases and replace the sample AdMob unit ids in `src/platform/index.ts`. Store icons and the
splash come from `npm run assets:icons` (`public/icons/icon-store-1024.png`, `splash-2732.png`);
the privacy policy the stores ask for is `public/privacy.html`.

A run offers one ad revive at death (`RunPhase 'revivePrompt'`, never in headless runs), the
results screen offers to double the gold for an ad, and an interstitial plays every third run
end unless "去除广告" was bought. The first run opens on a three-page briefing (`?tutorial=1`
opts a test in).

