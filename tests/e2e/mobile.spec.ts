import { test, expect } from '@playwright/test';
import { openGame, snap, state, waitScene, realWait, sceneName, TouchSession, toScreen } from './helpers';

/**
 * Touch play on a phone held landscape. Everything here goes through real touch events rather than
 * the debug hook, because the point is that a player with no keyboard can start a run, move, pause
 * and pick an upgrade.
 */
const STICK = 1;
const SECOND_FINGER = 2;

test('mobile: a tap starts the run and the virtual stick drives the player', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=42');
  const size = page.viewportSize()!;
  const touch = new TouchSession(page);

  const startButton = await page.evaluate(() => window.__game.ui.buttons().find((b) => b.id === 'menu.start'));
  expect(startButton).toBeDefined();
  const startAt = await toScreen(page, startButton!.x, startButton!.y);
  await page.touchscreen.tap(startAt.x, startAt.y);
  await waitScene(page, 'game');

  // touching the screen is what reveals the touch controls
  expect(await page.evaluate(() => window.__game.ui.buttons().map((b) => b.id))).toContain('hud.pause');

  const before = await state(page);
  const origin = { x: size.width * 0.3, y: size.height * 0.7 };
  await touch.press(STICK, origin);
  await touch.dragTo(STICK, { x: origin.x + 120, y: origin.y });
  await page.waitForFunction((x0) => window.__game.getState().player.x > x0 + 30, before.player.x, { timeout: 15_000 });
  await snap(page, 'mobile-stick');

  const moving = await state(page);
  expect(moving.player.x).toBeGreaterThan(before.player.x + 30);
  expect(Math.abs(moving.player.y - before.player.y)).toBeLessThan(40);

  // the stick follows the thumb: dragging back reverses the direction without lifting
  await touch.dragTo(STICK, { x: origin.x - 120, y: origin.y });
  await page.waitForFunction((x0) => window.__game.getState().player.x < x0, moving.player.x, { timeout: 15_000 });

  // and letting go stops the player
  await touch.release(STICK, { x: origin.x - 120, y: origin.y });
  await realWait(200);
  const released = await state(page);
  await realWait(400);
  expect(Math.abs((await state(page)).player.x - released.player.x)).toBeLessThan(5);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('mobile: a second finger can press a button while the stick is held', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1&seed=45');
  await page.evaluate(() => window.__game.startRun({ seed: 45 }));
  await waitScene(page, 'game');
  const size = page.viewportSize()!;
  const touch = new TouchSession(page);

  const origin = { x: size.width * 0.25, y: size.height * 0.75 };
  await touch.press(STICK, origin);
  await touch.dragTo(STICK, { x: origin.x, y: origin.y - 120 });
  await page.waitForFunction(() => window.__game.getState().player.y < -20, undefined, { timeout: 15_000 });

  // the pause button is tapped with a second finger while the first still holds the stick
  const pause = await page.evaluate(() => window.__game.ui.buttons().find((b) => b.id === 'hud.pause'));
  expect(pause).toBeDefined();
  const pauseAt = await toScreen(page, pause!.x, pause!.y);
  await touch.press(SECOND_FINGER, pauseAt);
  await touch.release(SECOND_FINGER, pauseAt);
  await waitScene(page, 'pause');
  expect((await state(page)).phase).toBe('paused');
  await snap(page, 'mobile-pause');

  await touch.release(STICK, { x: origin.x, y: origin.y - 120 });
  expect(await page.evaluate(() => window.__game.ui.press('pause.resume'))).toBe(true);
  await waitScene(page, 'game');
  expect((await state(page)).phase).toBe('running');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('mobile: the stick ignores the HUD strip so buttons there stay reachable', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1&seed=46');
  await page.evaluate(() => window.__game.startRun({ seed: 46 }));
  await waitScene(page, 'game');
  const size = page.viewportSize()!;
  const touch = new TouchSession(page);

  const high = { x: size.width * 0.5, y: size.height * 0.06 };
  await touch.press(STICK, high);
  await touch.dragTo(STICK, { x: high.x + 140, y: high.y });
  await realWait(300);
  expect(Math.abs((await state(page)).player.x)).toBeLessThan(5);
  await touch.release(STICK, { x: high.x + 140, y: high.y });

  expect(errors, errors.join('\n')).toEqual([]);
});

test('mobile: a level-up card can be tapped', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1&seed=44');
  await page.evaluate(() => window.__game.startRun({ seed: 44 }));
  await waitScene(page, 'game');

  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');
  const card = await page.evaluate(() => window.__game.ui.buttons().find((b) => b.id === 'levelup.card0'));
  expect(card).toBeDefined();
  await snap(page, 'mobile-levelup');

  const at = await toScreen(page, card!.x, card!.y);
  await page.touchscreen.tap(at.x, at.y);
  await waitScene(page, 'game');
  expect((await state(page)).phase).toBe('running');
  expect((await state(page)).weapons.length + (await state(page)).passives.length).toBeGreaterThan(0);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('mobile: rotating to portrait keeps the game playable', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1&seed=61');
  await page.evaluate(() => window.__game.startRun({ seed: 61 }));
  await waitScene(page, 'game');

  const landscape = await page.evaluate(() => window.__game.getViewSize());
  expect(landscape.width).toBeGreaterThan(landscape.height);

  // the run survives the rotation and the view takes the new shape
  await page.setViewportSize({ width: 360, height: 863 });
  await page.waitForFunction(() => {
    const v = window.__game.getViewSize();
    return v.height > v.width;
  }, undefined, { timeout: 10_000 });
  expect(await sceneName(page)).toBe('game');
  const portrait = await page.evaluate(() => window.__game.getViewSize());
  expect(portrait.height / portrait.width).toBeCloseTo(863 / 360, 0);
  await snap(page, 'mobile-portrait');

  // and it is still playable: the stick moves the player
  const before = (await state(page)).player.y;
  const touch = new TouchSession(page);
  const origin = { x: 180, y: 700 };
  await touch.press(STICK, origin);
  await touch.dragTo(STICK, { x: origin.x, y: origin.y - 150 });
  await page.waitForFunction((y0) => window.__game.getState().player.y < y0 - 20, before, { timeout: 15_000 });
  await touch.release(STICK, { x: origin.x, y: origin.y - 150 });

  await page.setViewportSize({ width: 863, height: 360 });
  await page.waitForFunction(() => window.__game.getViewSize().width > window.__game.getViewSize().height);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('mobile: the canvas fills the phone width instead of sitting between bars', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1&seed=47');
  const viewport = page.viewportSize()!;

  const canvas = await page.evaluate(() => {
    const el = document.querySelector('canvas')!;
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, logicalW: window.__game.phaser.scale.width, logicalH: window.__game.phaser.scale.height };
  });

  // the view follows the display: wide enough to fill the screen, and small enough that one
  // logical unit covers enough CSS pixels for sprites to read and buttons to be hit
  expect(canvas.width / viewport.width, 'the canvas does not fill the width').toBeGreaterThan(0.97);
  const cssPerUnit = canvas.width / canvas.logicalW;
  expect(cssPerUnit, `one logical unit is only ${cssPerUnit.toFixed(2)} CSS px`).toBeGreaterThanOrEqual(0.7);
  expect(canvas.logicalH).toBeLessThanOrEqual(720);
  expect(canvas.logicalW / canvas.logicalH).toBeCloseTo(viewport.width / viewport.height, 1);

  await page.evaluate(() => window.__game.startRun({ seed: 47 }));
  await waitScene(page, 'game');
  // the simulation is told about the wider view, so the crowd scales with it
  const size = await page.evaluate(() => window.__game.getViewSize());
  expect(size.width).toBe(canvas.logicalW);
  await snap(page, 'mobile-wide');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('mobile: the stick lets go when the finger is lifted during a pause', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1&seed=51');
  await page.evaluate(() => window.__game.startRun({ seed: 51 }));
  await waitScene(page, 'game');
  const size = page.viewportSize()!;
  const touch = new TouchSession(page);

  // run upward, pause with a second finger, then lift the stick finger while the panel is open
  const origin = { x: size.width * 0.25, y: size.height * 0.75 };
  await touch.press(STICK, origin);
  await touch.dragTo(STICK, { x: origin.x, y: origin.y - 120 });
  await page.waitForFunction(() => window.__game.getState().player.y < -20, undefined, { timeout: 15_000 });

  const pause = await page.evaluate(() => window.__game.ui.buttons().find((b) => b.id === 'hud.pause'));
  const pauseAt = await toScreen(page, pause!.x, pause!.y);
  await touch.press(SECOND_FINGER, pauseAt);
  await touch.release(SECOND_FINGER, pauseAt);
  await waitScene(page, 'pause');
  await touch.release(STICK, { x: origin.x, y: origin.y - 120 });

  await page.evaluate(() => window.__game.ui.press('pause.resume'));
  await waitScene(page, 'game');

  // with nothing on the screen the player must stand still
  await realWait(400);
  const a = await state(page);
  await realWait(500);
  const b = await state(page);
  expect(Math.hypot(b.player.x - a.player.x, b.player.y - a.player.y), 'the player drifts with no finger down').toBeLessThan(5);

  // and a fresh press must grab the stick again
  const again = { x: size.width * 0.6, y: size.height * 0.7 };
  await touch.press(STICK, again);
  await touch.dragTo(STICK, { x: again.x + 120, y: again.y });
  await page.waitForFunction((x0) => window.__game.getState().player.x > x0 + 25, b.player.x, { timeout: 15_000 });
  await touch.release(STICK, { x: again.x + 120, y: again.y });

  expect(errors, errors.join('\n')).toEqual([]);
});

test('mobile: the stick lets go when the finger is lifted over an overlay button', async ({ page }) => {
  const errors = await openGame(page, '?test=1&touch=1&seed=52');
  await page.evaluate(() => window.__game.startRun({ seed: 52 }));
  await waitScene(page, 'game');
  const size = page.viewportSize()!;
  const touch = new TouchSession(page);

  // drag the stick onto the pause button and lift there: the HUD scene captures the release
  const origin = { x: size.width * 0.3, y: size.height * 0.7 };
  await touch.press(STICK, origin);
  await touch.dragTo(STICK, { x: origin.x + 100, y: origin.y });
  await page.waitForFunction(() => window.__game.getState().player.x > 20, undefined, { timeout: 15_000 });

  const pause = await page.evaluate(() => window.__game.ui.buttons().find((b) => b.id === 'hud.pause'));
  const pauseAt = await toScreen(page, pause!.x, pause!.y);
  await touch.dragTo(STICK, pauseAt, 3);
  await touch.release(STICK, pauseAt);
  await realWait(300);

  // whether or not the button fired, the stick must not still be held
  const held = await page.evaluate(() => window.__game.getPerf().stickHeld);
  expect(held, 'the stick is still held after the finger was lifted').toBe(false);

  expect(errors, errors.join('\n')).toEqual([]);
});
