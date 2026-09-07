import { test, expect, type Page } from '@playwright/test';
import { openGame, snap, state, waitScene, realWait } from './helpers';

/**
 * The iPhone in landscape is the smallest canvas the game runs on, and the one where a finger has
 * the least room. Everything here is about a real thumb rather than a precisely-aimed tap: the
 * emulated taps in mobile.spec.ts always land dead centre, which is exactly why they missed a
 * Start button that had shrunk to thirty CSS pixels tall.
 */
const MIN_TOUCH_CSS = 44; // Apple's minimum comfortable target

async function cssSizeOf(page: Page, id: string): Promise<{ w: number; h: number; x: number; y: number }> {
  return page.evaluate((buttonId) => {
    const g = window.__game;
    const canvas = document.querySelector('canvas')!;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / g.phaser.scale.width;
    const b = g.ui.buttons().find((x) => x.id === buttonId)!;
    return { w: b.hitW * scale, h: b.hitH * scale, x: rect.left + b.x * scale, y: rect.top + b.y * scale };
  }, id);
}

test('iphone: a button is hit everywhere it is drawn, not just its top-left', async ({ page }) => {
  // Phaser normalises a container's hit test by its displayOrigin, so a centred hit rectangle sits
  // half a button up and to the left of the drawing. Every earlier test pressed buttons through the
  // registry, which skips hit testing entirely, so nothing noticed until a thumb did.
  const errors = await openGame(page, '?test=1');
  const s = await cssSizeOf(page, 'menu.start');
  const offsets: [number, number][] = [
    [0, 0],
    [0, s.h * 0.35],
    [0, -s.h * 0.35],
    [s.w * 0.35, 0],
    [-s.w * 0.35, 0],
    [s.w * 0.3, s.h * 0.3],
    [-s.w * 0.3, -s.h * 0.3],
  ];
  for (const [dx, dy] of offsets) {
    await openGame(page, '?test=1');
    await page.touchscreen.tap(s.x + dx, s.y + dy);
    await page.waitForTimeout(400);
    const scene = await page.evaluate(() => window.__game.scene());
    expect(scene, `a tap at (${dx.toFixed(0)}, ${dy.toFixed(0)}) from the centre did nothing`).toBe('game');
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('iphone: menu targets are big enough for a thumb', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  for (const id of ['menu.start', 'menu.shop', 'menu.settings']) {
    const s = await cssSizeOf(page, id);
    expect(s.h, `${id} is ${s.h.toFixed(0)} CSS px tall`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
    expect(s.w, `${id} is ${s.w.toFixed(0)} CSS px wide`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
  }
  await snap(page, 'iphone-menu');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('iphone: a thumb-sized tap near the edge of Start still begins the run', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  const s = await cssSizeOf(page, 'menu.start');
  // a real thumb lands off-centre; aim a third of the way towards the top edge
  await page.touchscreen.tap(s.x, s.y - s.h / 3);
  await waitScene(page, 'game');
  expect((await state(page)).time).toBeGreaterThanOrEqual(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('iphone: in-run targets are big enough too', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1');
  await page.evaluate(() => window.__game.startRun({ seed: 3 }));
  await waitScene(page, 'game');

  const pause = await cssSizeOf(page, 'hud.pause');
  expect(pause.h, `pause button is ${pause.h.toFixed(0)} CSS px tall`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
  expect(pause.w, `pause button is ${pause.w.toFixed(0)} CSS px wide`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);

  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');
  const card = await cssSizeOf(page, 'levelup.card0');
  expect(card.h, `level-up card is ${card.h.toFixed(0)} CSS px tall`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
  await snap(page, 'iphone-levelup');

  // and an off-centre tap on a card still picks it
  await page.touchscreen.tap(card.x, card.y + card.h / 3);
  await waitScene(page, 'game');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('iphone: the whole flow works with taps alone', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  const start = await cssSizeOf(page, 'menu.start');
  await page.touchscreen.tap(start.x, start.y);
  await waitScene(page, 'game');
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'hud.pause' && b.enabled));
  const pause = await cssSizeOf(page, 'hud.pause');
  await page.touchscreen.tap(pause.x, pause.y);
  await waitScene(page, 'pause');
  await snap(page, 'iphone-pause');

  const resume = await cssSizeOf(page, 'pause.resume');
  expect(resume.h).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
  await page.touchscreen.tap(resume.x, resume.y);
  await waitScene(page, 'game');

  await realWait(300);
  expect((await state(page)).phase).toBe('running');
  expect(errors, errors.join('\n')).toEqual([]);
});
