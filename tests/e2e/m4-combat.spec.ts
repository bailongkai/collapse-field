import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, step, waitScene } from './helpers';

test('M4: weapons fire, kill enemies and show damage numbers', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=21');
  await startRun(page, 21);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));
  await page.evaluate(() => window.__game.godMode(true));

  // the character starts with the plasma blade
  expect((await state(page)).weapons).toEqual([{ id: 'plasmaBlade', level: 1 }]);

  await page.evaluate(() => window.__game.giveWeapon('guidedLaser', 3));
  await page.evaluate(() => window.__game.spawn('drone', 60, { radius: 220 }));
  expect((await state(page)).counts.enemies).toBe(60);

  await step(page, 600);
  const s = await state(page);
  expect(s.kills).toBeGreaterThan(0);
  expect(s.counts.gems).toBeGreaterThan(0);
  // floating numbers appear for fresh hits and stay inside the pool and the per-step spawn cap
  await page.evaluate(() => window.__game.spawn('mech', 12, { radius: 60 }));
  await step(page, 60);
  const withNumbers = await state(page);
  expect(withNumbers.counts.dmgNumbers).toBeGreaterThan(0);
  expect(withNumbers.counts.dmgNumbers).toBeLessThanOrEqual(48);
  // the test build never creates audio nodes
  expect((await page.evaluate(() => window.__game.getPerf())).activeSounds).toBe(0);

  // let the game run at normal speed for a moment so the screenshot catches live combat
  await page.evaluate(() => {
    window.__game.setTimeScale(1);
    window.__game.spawn('drone', 80, { radius: 200 });
  });
  await page.waitForTimeout(700);
  await snap(page, 'm4-combat');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M4: a full kit clears a large ring of enemies', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=33');
  await startRun(page, 33);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.giveWeapon('plasmaBlade', 8);
    window.__game.giveWeapon('guidedLaser', 8);
    window.__game.givePassive('reactorCore', 5);
    window.__game.spawn('drone', 200, { radius: 260 });
  });

  await step(page, 900);
  const s = await state(page);
  expect(s.kills).toBeGreaterThan(40);
  expect(s.stats.might).toBeCloseTo(1.5, 5);

  await snap(page, 'm4-kit');
  expect(errors, errors.join('\n')).toEqual([]);
});
