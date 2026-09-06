import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, stepResolving, events, waitScene, expectScenes } from './helpers';

test('M7: the boss arrives, drops a chest and the chest upgrades a weapon', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=31');
  await startRun(page, 31);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
  });

  await page.evaluate(() => window.__game.setTime(299));
  await stepResolving(page, 120);
  expect(await events(page)).toContain('boss:spawn:mothership');
  const withBoss = await state(page);
  expect(withBoss.enemies.byBehavior.boss).toBe(1);
  await snap(page, 'm7-boss');

  const before = (await state(page)).weapons.reduce((n, w) => n + w.level, 0);
  await page.evaluate(() => window.__game.killAll());
  await stepResolving(page, 2);
  expect((await state(page)).enemies.byBehavior.boss).toBe(0);

  const chest = (await state(page)).pickups.find((p) => p.defId === 'chest');
  expect(chest, 'the boss dropped a supply chest').toBeDefined();
  await page.evaluate((x) => window.__game.setPlayerPos(x.x, x.y), { x: chest!.x, y: chest!.y });
  await stepResolving(page, 4);
  expect(await events(page)).toContain('pickup:chest');
  expect((await state(page)).weapons.reduce((n, w) => n + w.level, 0)).toBeGreaterThan(before);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('M7: a swarm crosses the field', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=41');
  await startRun(page, 41);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
    window.__game.setTime(89);
  });

  await stepResolving(page, 120);
  expect(await events(page)).toContain('rush');
  const s = await state(page);
  expect(s.enemies.byBehavior.line).toBeGreaterThanOrEqual(20);
  await snap(page, 'm7-swarm');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M7: surviving to fifteen minutes brings the reaper and the results screen', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=51');
  await startRun(page, 51);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
    window.__game.setStat('moveSpeed', 0);
    window.__game.setTime(899);
  });

  await stepResolving(page, 120);
  expect(await events(page)).toContain('reaper');
  expect((await state(page)).reaperSpawned).toBe(true);

  // the reaper kills through god mode, and reaching the mark counts as surviving
  await stepResolving(page, 60 * 30);
  await waitScene(page, 'results');
  await snap(page, 'm7-results');

  const save = await page.evaluate(() => window.__game.save.get());
  expect(save.runsPlayed).toBe(1);
  expect(save.bestTimeSec).toBeGreaterThan(890);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('M7: retrying from the results screen starts a clean run', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  await startRun(page, 61);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.giveWeapon('railgun', 4);
    window.__game.endRun('died');
  });
  await waitScene(page, 'results');

  expect(await page.evaluate(() => window.__game.ui.press('results.retry'))).toBe(true);
  await waitScene(page, 'game');
  await expectScenes(page, ['Game', 'Hud']);
  const fresh = await state(page);
  expect(fresh.time).toBeLessThan(1);
  expect(fresh.kills).toBe(0);
  expect(fresh.weapons).toEqual([{ id: 'plasmaBlade', level: 1 }]);

  expect(errors, errors.join('\n')).toEqual([]);
});
