# Launch posts

Text for announcing Collapse Field. The clips are generated, not committed: they are in
`release/marketing/`.

| File | Length | Use |
|---|---|---|
| `horde.mp4` | 8 s | an evolved build in the late game, the crowd closing in. The lead clip |
| `boss.mp4` | 8 s | the Bio Lab's 10:00 boss on screen, taking hits |
| `collapse.mp4` | 7.5 s | the floor counts down, cracks, bursts, and swallows the crowd on it |
| `evolution.mp4` | 5.4 s | a supply chest pays out an evolution |
| `*-short.gif` | 4 s, under 3 MB | for the itch page and anywhere that takes GIFs but not video |
| `*.gif` | full length, 1.5–8 MB | where size does not matter |

Reddit, Bluesky and X all play MP4 inline, and it is sharper and smaller than a GIF, so post the MP4
there. The GIFs are for the itch page.

**Before posting to any subreddit, read its rules.** Several game subreddits ban AI-generated art
outright or require it to be declared, and most of this game's sprites are AI-generated. Where it is
allowed, say so in the post; the drafts below already do. Reddit also frowns on accounts that only
post their own work, so comment on other people's games too, and don't post the same text to many
subreddits on the same day.

---

## itch.io Devlog

**Title:** Collapse Field is out: a survivors-like where the floor gives way

**Body:**

Collapse Field is live, free, and plays in the browser on desktop and phone.

It's a survivors-like in the Vampire Survivors mould: you move, your weapons fire themselves, and
every run is fifteen minutes against waves that thicken by the minute. A boss arrives at 5:00,
another at 10:00, and the stage's final boss at 15:00. Kill the final boss and the stage is cleared.

**What makes it its own game**

*You face left or right, and that's the skill.* The blade sweeps both sides at once, the railgun
fires down the side you face, and the arc anchors stay where you drive them. Only the guided laser
picks its own target. Early versions aimed everything at the nearest enemy, and that removed
positioning from the game entirely, so it went.

*The floor gives way.* On the first stage, sections of the station collapse. A circle is marked with
a supply chest in the middle, and nine seconds later the floor goes, taking the chest and everything
standing on it. You can walk in for the chest, go round, or lead the crowd onto it. It's an
experiment in what the game is named after. If it plays well, the other stages get their own.

*Weapons evolve, and you'll actually see it.* Max a weapon, hold its paired item, and the next supply
chest turns it into something else. Chests weight their rewards towards whatever is closest to
maxing. Before that, sixteen test runs in a row finished without a single evolution: a whole tier
of weapons that nobody ever saw.

**What's in it**

- 8 characters, each with a starting weapon and a signature ability
- 16 weapons, 8 of them evolutions, and 11 items
- 8 stages, each with its own enemies and three bosses
- An upgrade bay, 24 achievements, a bestiary, and a challenge setting for more gold
- Keyboard or touch; English and Chinese

**Controls:** WASD or arrow keys to move, P or Esc to pause. In fullscreen, use P: the browser
always takes Esc to leave fullscreen. On a phone, drag anywhere on the left of the screen.

**How it's made:** Phaser 4 and TypeScript, by one developer. The rules engine runs without a
browser, so the test suite plays whole fifteen-minute runs in seconds, and balance changes are
measured across many seeded runs rather than by feel. The music is synthesised live in the browser rather
than played from a file. The character, enemy and boss sprites are AI-generated; the interface
pieces and sound effects are Kenney's CC0 packs.

Tell me where you died and what you were holding. Every run's build is recorded, so feedback like
"I never found a use for X" goes straight into the next balance pass.

*(attach: `horde.mp4` or `horde-short.gif` at the top, `collapse-short.gif` after the paragraph on the floor)*

---

## Reddit: r/WebGames

A subreddit for games that play in the browser. Check its current rules first; this game is free, runs in the page and needs no account.

**Title:** Collapse Field: a free survivors-like in the browser. The floor collapses under the horde

**Body:**

Move, and your weapons fire on their own; last fifteen minutes and kill the final boss. You only
face left or right, so where you stand decides what your weapons hit. On the first stage the floor
collapses with a supply chest in the middle: nine seconds to grab it and get out.

Works on desktop and phone (touch controls), no signup, progress saved in the browser.

https://bailongkai.itch.io/collapse-field

Solo project; the sprites are AI-generated. Feedback on difficulty very welcome.

*(attach: `horde.mp4`)*

---

## Reddit: r/roguelites

**Title:** I made a survivors-like where you only face left or right, and positioning is the whole game

**Body:**

Collapse Field is free and plays in the browser. Fifteen-minute runs, a boss at 5 and 10 minutes,
a final boss at 15.

The design decision I'd most like feedback on: your character faces only left or right. The blade
sweeps both sides, the railgun fires the way you face, and only one weapon (the guided laser) aims
itself. I tried aiming everything at the nearest enemy early on, and it removed positioning
entirely: you could just kite in circles.

Other things in it: weapons evolve when a maxed weapon meets its paired item on the next supply
chest, and chests prefer whatever is closest to maxing, so a build you commit to gets finished. On
the first stage, sections of the floor collapse under the crowd.

8 characters, 16 weapons (8 evolutions), 8 stages with 3 bosses each. Sprites are AI-generated;
code and design are mine.

https://bailongkai.itch.io/collapse-field

*(attach: `collapse.mp4`)*

---

## Reddit: r/playmygame

The subreddit asks for a specific question, not just a link.

**Title:** [Browser] Collapse Field: survivors-like, looking for feedback on the difficulty curve

**Body:**

Free in the browser, about 15 minutes a run: https://bailongkai.itch.io/collapse-field

What I'd like to know:
1. How long did your first run last, and what killed you?
2. Did the level-up cards make it clear what each upgrade would do for your build?
3. On the first stage, did you go into the collapsing circles for the chest?

Desktop or phone both work. Sprites are AI-generated.

*(attach: `boss.mp4`)*

---

## Bluesky / X

**Post (under 280 characters):**

Collapse Field is out: a free survivors-like that plays in your browser, on desktop or phone.

You face left or right, your weapons fire themselves, and the floor collapses under the horde.

https://bailongkai.itch.io/collapse-field

#indiedev #gamedev #survivorslike

*(attach: `collapse.mp4`)*

---

## 中文（B站 / 小红书 / 微博）

**标题：** 我做了一款能在浏览器里直接玩的幸存者类游戏：《塌缩带》

**正文：**

《吸血鬼幸存者》那一类的玩法：你只管走位，武器自动开火。每局 15 分钟，5 分钟和 10 分钟各来一个 Boss，15 分钟是最终 Boss，打倒它才算通关。

几个自己比较满意的设计：
- **角色只朝左或右**：等离子刃同时横扫两侧，磁轨炮只打你面朝的一侧，站位就是全部操作。
- **地板会塌**：第一关里，空间站的地板会整块塌落，补给箱就在圈中央。九秒钟，冲进去抢，还是把怪引进去一起埋掉。
- **武器会进化**：武器满级再配上对应装备，开下一个补给箱就会进化，补给箱会优先升级你最接近满级的武器。

8 个角色、16 种武器（其中 8 种进化形态）、8 个关卡、每关 3 个 Boss。电脑和手机都能玩，不用注册，中英文都有。

一个人做的，角色和怪物的美术由 AI 生成。欢迎来玩，告诉我你死在第几分钟 👇

https://bailongkai.itch.io/collapse-field

#独立游戏 #游戏开发 #幸存者like

*（配 `horde.mp4` 或 `collapse.mp4`）*
