import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, realWait, waitScene } from './helpers';

/**
 * Performance gates. CPU-side numbers (simulation plus sprite sync) are meaningful anywhere; frame
 * time is only asserted when the renderer is a real GPU, because headless Chromium draws through
 * SwiftShader where the number says nothing about the game.
 */
test('perf: 500 enemies with a full kit stay inside the frame budget', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=99');
  await startRun(page, 99);
  await waitScene(page, 'game');

  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
    window.__game.giveWeapon('plasmaBlade', 8);
    window.__game.giveWeapon('guidedLaser', 8);
    window.__game.giveWeapon('railgun', 8);
    window.__game.giveWeapon('orbitalDrones', 8);
    window.__game.giveWeapon('empField', 8);
    window.__game.spawn('mech', 500, { ring: true, radius: 420 });
    window.__game.spawnGems(300, 'blue');
  });

  const before = await state(page);
  expect(before.counts.enemies).toBe(500);
  expect(before.counts.gems).toBeGreaterThan(200);

  await page.evaluate(() => window.__game.profile.start());
  await realWait(10_000);
  const perf = await page.evaluate(() => window.__game.profile.stop());

  console.log(
    `renderer=${perf.renderer} frames=${perf.frames} sim=${perf.simMs.toFixed(2)} sync=${perf.syncMs.toFixed(2)} ` +
      `render=${perf.renderMs.toFixed(2)} p50=${perf.p50.toFixed(2)} p95=${perf.p95.toFixed(2)} heap=${perf.heapMB?.toFixed(1) ?? 'n/a'}MB`,
  );

  expect(perf.frames).toBeGreaterThan(60);
  expect(perf.simMs + perf.syncMs, `sim ${perf.simMs.toFixed(2)} + sync ${perf.syncMs.toFixed(2)} ms`).toBeLessThan(8);
  expect((await page.evaluate(() => window.__game.getPerf())).activeSounds).toBeLessThanOrEqual(16);

  const software = /swiftshader|llvmpipe|software/i.test(perf.renderer);
  if (!software) {
    // On a real GPU the loop is vsync-locked, so the median is one 60 Hz frame. p95 sits a little
    // above that from ordinary scheduling jitter even when the game itself costs ~1 ms of CPU, so
    // the meaningful gates are "the median really is 60 fps" and "no frame is properly dropped".
    expect(perf.p50, `p50 ${perf.p50.toFixed(2)} ms on ${perf.renderer}`).toBeLessThan(17.5);
    expect(perf.p95, `p95 ${perf.p95.toFixed(2)} ms on ${perf.renderer}`).toBeLessThan(22);
    expect(perf.histogram['>33'] / perf.frames, 'share of dropped frames').toBeLessThan(0.01);
  }

  await snap(page, 'perf-500');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('perf: a wide view carries its larger crowd', async ({ page }) => {
  // an ultrawide window shows more of the map and therefore holds proportionally more enemies
  await page.setViewportSize({ width: 1720, height: 720 });
  const errors = await openGame(page, '?test=1&seed=97');
  await page.evaluate(() => window.__game.startRun({ seed: 97 }));
  await waitScene(page, 'game');

  const view = await page.evaluate(() => window.__game.getViewSize());
  expect(view.width).toBeGreaterThan(1280);

  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
    window.__game.giveWeapon('railgun', 8);
    window.__game.giveWeapon('orbitalDrones', 8);
    window.__game.giveWeapon('empField', 8);
    window.__game.setTime(14 * 60);
  });
  await page.evaluate(() => window.__game.fastForward(45, { levelUpPolicy: 'first' }));

  const busy = await state(page);
  console.log(`wide view ${view.width}x${view.height}: ${busy.counts.enemies} enemies`);
  expect(busy.counts.enemies).toBeGreaterThan(250);

  await page.evaluate(() => window.__game.profile.start());
  await realWait(6000);
  const perf = await page.evaluate(() => window.__game.profile.stop());
  console.log(`wide renderer=${perf.renderer} sim=${perf.simMs.toFixed(2)} sync=${perf.syncMs.toFixed(2)} p50=${perf.p50.toFixed(2)} p95=${perf.p95.toFixed(2)}`);
  expect(perf.simMs + perf.syncMs).toBeLessThan(8);
  if (!/swiftshader|llvmpipe|software/i.test(perf.renderer)) {
    expect(perf.p50).toBeLessThan(17.5);
  }
  await snap(page, 'perf-wide');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('perf: a long run does not leak memory or entities', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=55');
  await startRun(page, 55);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.setTimeScale(0);
  });

  const sample = async () => (await page.evaluate(() => window.__game.profile.stop())).heapMB;
  await page.evaluate(() => window.__game.profile.start());
  await page.evaluate(() => window.__game.fastForward(120, { levelUpPolicy: 'first' }));
  const first = await sample();

  await page.evaluate(() => window.__game.profile.start());
  await page.evaluate(() => window.__game.fastForward(120, { levelUpPolicy: 'first' }));
  const second = await sample();

  const s = await state(page);
  expect(s.counts.enemies).toBeLessThanOrEqual(1024);
  expect(s.counts.projectiles).toBeLessThanOrEqual(512);
  expect(s.counts.gems).toBeLessThanOrEqual(400);
  if (first !== undefined && second !== undefined) {
    console.log(`heap after 2 min=${first.toFixed(1)}MB, after 4 min=${second.toFixed(1)}MB`);
    expect(second - first).toBeLessThan(40);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
