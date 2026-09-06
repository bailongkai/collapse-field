import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, step, realWait, waitScene } from './helpers';

test('M3: 500 enemies stay inside the CPU frame budget', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=99');
  await startRun(page, 99);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.godMode(true));

  expect(await page.evaluate(() => window.__game.spawn('drone', 500, { ring: true, radius: 400 }))).toBe(500);
  expect((await state(page)).counts.enemies).toBe(500);

  await page.evaluate(() => window.__game.profile.start());
  await realWait(5000);
  const perf = await page.evaluate(() => window.__game.profile.stop());

  expect(perf.frames).toBeGreaterThan(60);
  // CPU-side work is meaningful in headless; the frame time is not, because WebGL falls back to
  // SwiftShader there, so only gate it on a real GPU.
  expect(perf.simMs + perf.syncMs, `sim ${perf.simMs.toFixed(2)} + sync ${perf.syncMs.toFixed(2)} ms`).toBeLessThan(8);
  if (!/swiftshader|llvmpipe|software/i.test(perf.renderer)) {
    expect(perf.p95, `p95 ${perf.p95.toFixed(2)} ms on ${perf.renderer}`).toBeLessThan(16.7);
  }

  await snap(page, 'm3-horde');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M3: the horde damages the player, god mode blocks it, and death ends the run', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=5');
  await startRun(page, 5);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));

  await page.evaluate(() => window.__game.godMode(true));
  await page.evaluate(() => window.__game.spawn('infected', 30, { radius: 30 }));
  const full = await state(page);
  expect(await step(page, 300)).toBe(300);
  expect((await state(page)).hp).toBe(full.hp);

  await page.evaluate(() => window.__game.godMode(false));
  await step(page, 60);
  const hurt = await state(page);
  expect(hurt.hp).toBeLessThan(full.hp);

  await step(page, 3600);
  const dead = await state(page);
  expect(dead.phase).toBe('ended');
  expect(dead.ended).toBe('died');
  await waitScene(page, 'results');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M3: waves fill the field on their own and enemies arrive from off screen', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=11');
  await startRun(page, 11);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));
  await page.evaluate(() => window.__game.godMode(true));

  await step(page, 60 * 30);
  const s = await state(page);
  expect(s.counts.enemies).toBeGreaterThan(8);
  expect(s.enemies.byBehavior.chase).toBe(s.counts.enemies);

  const kills = await page.evaluate(() => {
    window.__game.killAll();
    return window.__game.getState().kills;
  });
  expect(kills).toBeGreaterThan(0);
  expect((await state(page)).counts.enemies).toBe(0);
  expect((await state(page)).counts.gems).toBeGreaterThan(0);

  await snap(page, 'm3-waves');
  expect(errors, errors.join('\n')).toEqual([]);
});
