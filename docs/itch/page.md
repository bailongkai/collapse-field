# itch.io page

Everything needed to publish Collapse Field on itch.io: the upload, the settings the embed needs,
and the page text in both languages. The images are generated, not committed; see the last section.

## Upload

```bash
npm run package:itch        # builds, checks, and writes release/collapse-field-html5.zip
```

The script refuses to write the zip if anything would break under itch's hosting: a reference that
starts with `/` (itch serves the game from a path of its own, so it would load from the wrong place),
more than 1000 files, or a file over 200 MB. Today it is 52 files and about 7 MB.

On the project's **Edit game** page:

| Setting | Value | Why |
|---|---|---|
| Kind of project | HTML | |
| Upload | `collapse-field-html5.zip`, ticked **This file will be played in the browser** | |
| Embed options → Viewport dimensions | **1280 × 720** | the size the game is authored at; it adapts to any other, but this is the one the balance was measured on |
| Mobile friendly | **on**, orientation **Landscape** | touch controls appear on the first touch; portrait works but landscape shows more of the field |
| Automatically start on page load | off | the first click is what lets the browser start the music |
| Fullscreen button | **on** | |
| Enable scrollbars | off | |
| SharedArrayBuffer support | off | not used |

**AI disclosure.** Most of the game's art — characters, enemies, bosses, props, floors — was generated
with AI image models (FLUX, via fal.ai). itch.io asks creators to disclose generative AI: on the Edit
game page, under **AI generation disclosure**, choose that the project contains AI-generated content
and tick **Graphics**. Sound effects are Kenney's CC0 packs and the music is synthesised in code, so
leave the audio boxes unticked.

**Credits.** The zip carries `CREDITS.txt`, and the settings screen shows a one-line credit. Kenney
Future is CC BY-SA 3.0 and the two display fonts are OFL; put this line at the end of the page:

> Credits: interface pieces, particles and sound effects by Kenney (CC0) · Kenney Future font by
> Kenney (CC BY-SA 3.0) · Smiley Sans by atelierAnchor and Orbitron by The Orbitron Project Authors
> (SIL OFL 1.1, shipped renamed) · all other art AI-generated for this game.

Analytics: the build sends anonymous run events to PostHog when `VITE_POSTHOG_KEY` is set in
`.env.local` at build time. `public/privacy.html` ships in the zip and says so; link it from the page.
Build without the key if the itch build should send nothing.

## Page text (English)

**Title:** Collapse Field

**Short description (tagline):** A sci-fi survivors-like. Your weapons fire themselves; where you stand is the whole game.

**Genre:** Action · **Tags:** survivors-like, bullet-heaven, roguelite, auto-shooter, arena-shooter, sci-fi, pixel-art, singleplayer, mobile, browser

**Description:**

> The station is coming apart. Fight your way out.
>
> Collapse Field is a survivors-like in the Vampire Survivors mould: move, and your weapons do the
> rest. Every run is fifteen minutes on one of eight stages, against waves that thicken by the
> minute, a boss at 5:00, another at 10:00 and the stage's final boss at 15:00. Kill the final boss
> and the stage is cleared.
>
> **You face left or right, and that is the skill.** The blade sweeps both sides at once, the railgun
> fires down the side you face, the arc anchors stay where you drive them. Only the guided laser
> picks its own target. Positioning matters from the first second.
>
> **Weapons evolve.** Max a weapon, hold its paired item, and the next supply chest turns it into
> something else entirely. Chests weigh their rewards toward whatever is closest to maxing, so a
> build you commit to gets finished.
>
> **The floor gives way.** On the first stage, sections of the station collapse with a supply chest
> in the middle. Nine seconds: walk in for it, or go round, or lead the crowd onto it.
>
> - 8 characters, each with a starting weapon and a signature ability
> - 16 weapons, 8 of them evolutions, and 11 items
> - 8 stages, each with its own enemies and three bosses of its own
> - An upgrade bay, 24 achievements, a bestiary, and a challenge setting for more gold
> - Keyboard or touch; English and Chinese
>
> **Controls:** WASD or arrow keys to move · weapons fire on their own · Esc or P to pause.
> On a phone, drag anywhere on the left of the screen.
>
> Progress is saved in your browser.

## 页面文字（中文）

**标题：** 塌缩带 Collapse Field

**一句话介绍：** 科幻题材的幸存者类游戏。武器自动开火，站位就是全部。

**介绍：**

> 空间站正在塌缩，杀出一条生路。
>
> 《塌缩带》是一款《吸血鬼幸存者》式的游戏：你只管移动，武器自动攻击。每局 15 分钟，八个关卡任选，
> 敌潮每分钟都在加厚：5:00 一个 Boss，10:00 另一个，15:00 是这一关的最终 Boss，击败它才算通关。
>
> **角色只朝左或右，这就是操作的全部。** 等离子刃同时横扫两侧，磁轨炮打向你面对的一侧，电弧锚桩钉在哪里就在哪里。
> 只有制导激光会自己找目标。从第一秒起，站位就决定一切。
>
> **武器会进化。** 武器升满、再带上对应装备，下一个补给箱就会让它进化成全新的武器。补给箱会优先升级最接近满级的武器，
> 认定的构筑一定能成型。
>
> **地板会塌。** 第一关里，空间站的地板会整块塌落，补给箱就在圈中央。九秒钟：冲进去拿，绕开走，或者把敌群引上去。
>
> - 8 名角色，各有起始武器和专属能力
> - 16 种武器（其中 8 种是进化形态）、11 种装备
> - 8 个关卡，各有专属敌人和三个专属 Boss
> - 升级舱、24 项成就、敌人图鉴，以及换取更多金币的挑战模式
> - 支持键盘和触屏；中文 / 英文
>
> **操作：** WASD 或方向键移动 · 武器自动攻击 · Esc 或 P 暂停。手机上在屏幕左侧拖动即可。
>
> 进度保存在浏览器中。

## Images

The cover (630 × 500, and a 1260 × 1000 copy for high-density screens) and the screenshots are
captured from the game itself at 1920 × 1080, in English, and are written to `release/itch-page/`.
They are regenerated rather than kept in git, because they go stale with every visual change.

Suggested order on the page: the ring of the horde closing in, the boss fight, the collapsing floor,
a level-up offer, and the deploy screen with the roster.
