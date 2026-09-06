import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, step, sceneName, realWait, waitScene, expectScenes } from './helpers';

test('M2: fixed-step movement, camera follow and pause semantics', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=42');
  await startRun(page, 42);
  await waitScene(page, 'game');

  // freeze real-time stepping so only explicit step() calls advance the simulation
  await page.evaluate(() => window.__game.setTimeScale(0));
  const start = await state(page);
  expect(start.phase).toBe('running');

  // 120 ticks of full-right input = 2 seconds at 200 px/s
  await page.evaluate(() => window.__game.setInput(1, 0));
  expect(await step(page, 120)).toBe(120);
  const moved = await state(page);
  expect(moved.player.x - start.player.x).toBeCloseTo(400, 0);
  expect(moved.player.y - start.player.y).toBeCloseTo(0, 3);
  expect(moved.time - start.time).toBeCloseTo(2, 2);

  // the hook's pause freezes the simulation: step() is a no-op and wall-clock time does not advance it
  await page.evaluate(() => window.__game.pause());
  const paused = await state(page);
  expect(paused.phase).toBe('paused');
  expect(await step(page, 60)).toBe(0);
  await realWait(500);
  expect((await state(page)).time).toBeCloseTo(paused.time, 3);

  await page.evaluate(() => window.__game.resume());
  expect(await step(page, 60)).toBe(60);
  expect((await state(page)).time).toBeGreaterThan(paused.time);

  // the HUD runs in parallel with the game scene and nothing else is left over
  await expectScenes(page, ['Game', 'Hud']);
  expect(await sceneName(page)).toBe('game');

  await page.evaluate(() => window.__game.setInput(0, 0));
  await snap(page, 'm2-world');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M2: real keyboard input moves the player and the run can end into results', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=7');
  await page.evaluate(() => window.__game.ui.press('menu.start'));
  await waitScene(page, 'game');
  // no experience means no level-up overlay can interrupt the movement being measured
  await page.evaluate(() => window.__game.setStat('growth', 0));

  const before = await state(page);
  // poll rather than time a fixed wall-clock window: headless Chromium throttles rendering when
  // several workers run at once, so a frame budget would make this flaky without telling us anything
  await page.keyboard.down('KeyD');
  await page.waitForFunction((x0) => window.__game.getState().player.x > x0 + 20, before.player.x, { timeout: 15_000 });
  await page.keyboard.up('KeyD');

  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  await snap(page, 'm2-results');
  expect(errors, errors.join('\n')).toEqual([]);
});
