import { test, expect, devices, type Page } from '@playwright/test';
import { openGame, snap, state, waitScene, realWait, startRun, step, press, hudCorner } from './helpers';

/**
 * A phone held upright. The view takes the shape of the display rather than being letterboxed, so
 * every panel has to fit a narrow screen and every target still has to be reachable by a thumb.
 */
const MIN_TOUCH_CSS = 44;

async function view(page: Page) {
  return page.evaluate(() => {
    const g = window.__game;
    const c = document.querySelector('canvas')!;
    const r = c.getBoundingClientRect();
    return {
      logicalW: g.viewSize().width,
      logicalH: g.viewSize().height,
      cssW: r.width,
      cssH: r.height,
      left: r.left,
      top: r.top,
      scale: r.width / g.viewSize().width,
    };
  });
}

async function target(page: Page, id: string) {
  const v = await view(page);
  const b = await page.evaluate((i) => window.__game.ui.buttons().find((x) => x.id === i), id);
  expect(b, `no button ${id}`).toBeDefined();
  return {
    x: v.left + b!.x * v.scale,
    y: v.top + b!.y * v.scale,
    w: b!.hitW * v.scale,
    h: b!.hitH * v.scale,
    logical: b!,
    v,
  };
}

test('portrait: the canvas fills the screen and the view is taller than it is wide', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  const vp = page.viewportSize()!;
  const v = await view(page);
  expect(v.cssW / vp.width, 'the canvas does not fill the width').toBeGreaterThan(0.97);
  expect(v.cssH / vp.height, 'the canvas does not fill the height').toBeGreaterThan(0.97);
  expect(v.logicalH, `${v.logicalW}x${v.logicalH}`).toBeGreaterThan(v.logicalW);
  expect(v.scale, 'a logical unit is too small to read').toBeGreaterThanOrEqual(0.7);
  await snap(page, 'portrait-menu');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('portrait: every menu target fits on screen and is thumb sized', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  const v = await view(page);
  for (const id of ['menu.start', 'menu.shop', 'menu.settings']) {
    const t = await target(page, id);
    expect(t.h, `${id} is ${t.h.toFixed(0)} CSS px tall`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
    // and it is actually inside the screen
    expect(t.logical.x - t.logical.hitW / 2, `${id} overflows the left edge`).toBeGreaterThanOrEqual(0);
    expect(t.logical.x + t.logical.hitW / 2, `${id} overflows the right edge`).toBeLessThanOrEqual(v.logicalW);
    expect(t.logical.y + t.logical.hitH / 2, `${id} overflows the bottom`).toBeLessThanOrEqual(v.logicalH);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('portrait: the whole flow works with taps alone', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  const start = await target(page, 'menu.start');
  await page.touchscreen.tap(start.x, start.y);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.start'));
  await snap(page, 'portrait-launch');
  const go = await target(page, 'launch.start');
  expect(go.h).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
  await page.touchscreen.tap(go.x, go.y);
  await waitScene(page, 'game');
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'hud.pause' && b.enabled));
  await snap(page, 'portrait-game');

  const pause = await target(page, 'hud.pause');
  expect(pause.h).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
  await page.touchscreen.tap(pause.x, pause.y);
  await waitScene(page, 'pause');
  await snap(page, 'portrait-pause');

  const resume = await target(page, 'pause.resume');
  await page.touchscreen.tap(resume.x, resume.y);
  await waitScene(page, 'game');
  await realWait(200);
  expect((await state(page)).phase).toBe('running');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('portrait: the level-up cards fit and can be tapped', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1');
  await page.evaluate(() => window.__game.startRun({ seed: 4 }));
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');

  const v = await view(page);
  const card = await target(page, 'levelup.card0');
  expect(card.h, `card is ${card.h.toFixed(0)} CSS px tall`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
  expect(card.logical.x - card.logical.hitW / 2, 'the card overflows the screen').toBeGreaterThanOrEqual(0);
  expect(card.logical.x + card.logical.hitW / 2, 'the card overflows the screen').toBeLessThanOrEqual(v.logicalW);
  await snap(page, 'portrait-levelup');

  await page.touchscreen.tap(card.x, card.y);
  await waitScene(page, 'game');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('portrait: the shop and results screens fit', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  await page.evaluate(() => window.__game.save.addGold(400));
  await page.evaluate(() => window.__game.goto('menu'));
  await waitScene(page, 'menu');

  const shop = await target(page, 'menu.shop');
  await page.touchscreen.tap(shop.x, shop.y);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.back'));
  const v = await view(page);
  for (const b of await page.evaluate(() => window.__game.ui.buttons())) {
    expect(b.x - b.hitW / 2, `${b.id} overflows the left edge`).toBeGreaterThanOrEqual(-1);
    expect(b.x + b.hitW / 2, `${b.id} overflows the right edge`).toBeLessThanOrEqual(v.logicalW + 1);
    expect(b.y + b.hitH / 2, `${b.id} overflows the bottom`).toBeLessThanOrEqual(v.logicalH + 1);
  }
  // The store block (shown because ?test=1 fakes a store, as a native build has one) used to run
  // under the back button. Upright, it is a page of its own; no two targets on either page overlap.
  const noOverlap = async () => {
    const all = (await page.evaluate(() => window.__game.ui.buttons())).filter((b) => b.id.startsWith('shop.'));
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        // hit areas are padded to a thumb, so neighbours may touch; neither centre may sit on the other
        const inside = (p: typeof a, q: typeof a) => Math.abs(p.x - q.x) * 2 < q.hitW && Math.abs(p.y - q.y) * 2 < q.hitH;
        expect(inside(a, b) || inside(b, a), `${a.id} overlaps ${b.id}`).toBe(false);
      }
      expect(all[i].y + all[i].hitH / 2, `${all[i].id} overflows the bottom`).toBeLessThanOrEqual(v.logicalH + 1);
    }
    return all;
  };
  await noOverlap();
  const page2 = await target(page, 'shop.page');
  await page.touchscreen.tap(page2.x, page2.y);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.iap.remove_ads'));
  await realWait(100);
  const storeButtons = await noOverlap();
  expect(storeButtons.filter((b) => b.id.startsWith('shop.iap.')).length).toBe(4);
  await snap(page, 'portrait-shop-store');
  const back2 = await target(page, 'shop.page');
  await page.touchscreen.tap(back2.x, back2.y);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buy.hull'));
  await realWait(100);
  await snap(page, 'portrait-shop');

  const back = await target(page, 'shop.back');
  await page.touchscreen.tap(back.x, back.y);
  await waitScene(page, 'menu');

  await page.evaluate(() => window.__game.startRun({ seed: 9 }));
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  await snap(page, 'portrait-results');
  for (const b of await page.evaluate(() => window.__game.ui.buttons())) {
    expect(b.y + b.hitH / 2, `${b.id} overflows the bottom`).toBeLessThanOrEqual(v.logicalH + 1);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('portrait: the chest reveal fits an upright phone', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=41');
  await startRun(page, 41);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.giveWeapon('guidedLaser', 3);
    window.__game.givePassive('reactorCore', 2);
    const s = window.__game.getState();
    window.__game.spawnPickup('bossChest', s.player.x, s.player.y);
  });
  await step(page, 4);
  await waitScene(page, 'chest');
  await press(page, 'chest.continue');

  const view = await page.evaluate(() => ({ w: window.__game.viewSize().width, h: window.__game.viewSize().height }));
  expect(view.h, 'the view should be taller than it is wide').toBeGreaterThan(view.w);
  // the panel and its one button have to sit inside the screen, not off the bottom of it
  const btn = (await page.evaluate(() => window.__game.ui.buttons())).find((b) => b.id === 'chest.continue');
  expect(btn, 'the reveal had nothing to press').toBeDefined();
  expect(btn!.x).toBeGreaterThan(0);
  expect(btn!.x).toBeLessThan(view.w);
  expect(btn!.y).toBeGreaterThan(0);
  expect(btn!.y).toBeLessThan(view.h);

  await snap(page, 'portrait-chest');
  await press(page, 'chest.continue');
  await waitScene(page, 'game');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('portrait: the pause button does not cover the HUD text held upright either', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1');
  await page.evaluate(() => window.__game.startRun({ seed: 7 }));
  await waitScene(page, 'game');
  await realWait(200);
  const corner = await hudCorner(page);
  expect(corner.pause).not.toBeNull();
  expect(corner.iconVisible).toBe(true);
  for (const t of corner.texts) {
    const p = corner.pause!;
    const apart = t.x >= p.x + p.w || t.x + t.w <= p.x || t.y >= p.y + p.h || t.y + t.h <= p.y;
    expect(apart, `${t.name} overlaps the pause button`).toBe(true);
  }
  await snap(page, 'portrait-hud-corner');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('portrait: the launch screen fits a narrow phone, protocol labels and the stage goal included', async ({ browser }) => {
  // On an iPhone SE the protocol labels ran over their buttons and the stage block cut its goal line
  // off; on an iPhone 14 the last protocol button ran past the challenge row.
  for (const device of ['iPhone 14', 'iPhone SE']) {
    for (const lang of ['en', 'zh-CN']) {
      const ctx = await browser.newContext({ ...devices[device] });
      const page = await ctx.newPage();
      const errors = await openGame(page, `?test=1&lang=${lang}`);
      await page.evaluate(() => window.__game.save.set({ ...window.__game.save.get(), tutorialDone: true, stageBestScore: { station: 12345 } }));
      await page.evaluate(() => window.__game.goto('menu'));
      await waitScene(page, 'menu');
      expect(await page.evaluate(() => window.__game.ui.press('menu.start'))).toBe(true);
      await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.start'));
      await realWait(150);
      const m = await page.evaluate(() => {
        type Box = { x: number; y: number; width: number; height: number; displayHeight: number };
        type Btn = { x: number; list: { width: number; text?: string }[] };
        const scene = window.__game.phaser.scene.getScene('Launch') as unknown as {
          children: { getByName(n: string): Box | null; list: unknown[] };
        };
        const buttons = window.__game.ui.buttons().filter((b) => b.id.startsWith('launch.protocol.') || b.id.startsWith('launch.curse.'));
        const containers = scene.children.list.filter((c): c is Btn => Array.isArray((c as Btn).list) && (c as Btn).list.length >= 2 && typeof (c as Btn).list[1].text === 'string');
        const rows = buttons.map((b) => {
          const c = containers.find((k) => Math.abs(k.x - b.x) < 0.5 && Math.abs((k as unknown as { y: number }).y - b.y) < 0.5)!;
          return { id: b.id, x: b.x, w: c.list[0].width, label: c.list[1].width, text: c.list[1].text };
        });
        const box = scene.children.getByName('launch.stageDetail.box')!;
        const text = scene.children.getByName('launch.stageDetail.text')!;
        return { rows, boxBottom: box.y + box.height / 2, textBottom: text.y + text.height, view: window.__game.viewSize() };
      });
      const curseRight = Math.max(...m.rows.filter((r) => r.id.startsWith('launch.curse.')).map((r) => r.x + r.w / 2));
      const panelRight = m.view.width - 24;
      for (const r of m.rows) {
        expect(r.label, `${device} ${lang}: "${r.text}" overflows ${r.id}`).toBeLessThanOrEqual(r.w - 8);
        expect(r.x + r.w / 2, `${device} ${lang}: ${r.id} runs past the panel`).toBeLessThanOrEqual(panelRight);
      }
      const protoRight = Math.max(...m.rows.filter((r) => r.id.startsWith('launch.protocol.')).map((r) => r.x + r.w / 2));
      expect(protoRight, `${device} ${lang}: the protocol row runs past the challenge row`).toBeLessThanOrEqual(Math.max(curseRight, panelRight - 24) + 1);
      expect(m.textBottom, `${device} ${lang}: the stage block cuts off its text`).toBeLessThanOrEqual(m.boxBottom);
      await snap(page, `portrait-launch-${device.replace(' ', '')}-${lang}`);
      expect(errors, errors.join('\n')).toEqual([]);
      await ctx.close();
    }
  }
});
