import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openGame, snap, state, waitScene } from './helpers';

/**
 * The in-browser half of the balance harness. The headless version in tests/unit/balance.test.ts is
 * the fast gate; this one proves the same run plays out in the real game and leaves a screenshot of
 * the late game to look at.
 */
test('AFK: a hands-off run plays out in the browser and ends in results', async ({ page }) => {
  const seed = 11;
  const errors = await openGame(page, `?test=1&seed=${seed}`);
  await page.evaluate((s) => window.__game.startRun({ seed: s }), seed);
  await waitScene(page, 'game');

  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.setAutopilot(true);
  });

  // run in chunks so a screenshot can be taken while the field is busy
  await page.evaluate(() => window.__game.fastForward(300, { levelUpPolicy: 'first', budgetMs: 120_000 }));
  const midRun = await state(page);
  expect(midRun.time).toBeGreaterThan(250);
  expect(midRun.kills).toBeGreaterThan(50);
  expect(midRun.level).toBeGreaterThan(3);
  await page.evaluate(() => window.__game.setTimeScale(1));
  await page.waitForTimeout(800);
  await snap(page, 'afk-midrun');
  await page.evaluate(() => window.__game.setTimeScale(0));

  await page.evaluate(() => window.__game.fastForward(700, { levelUpPolicy: 'first', budgetMs: 240_000 }));
  await waitScene(page, 'results');
  const save = await page.evaluate(() => window.__game.save.get());

  const record = { seed, bestTimeSec: save.bestTimeSec, bestKills: save.bestKills, midRunLevel: midRun.level };
  mkdirSync('test-results', { recursive: true });
  writeFileSync(`test-results/afk-${seed}.json`, JSON.stringify(record, null, 2));
  console.log(`seed ${seed}: survived ${save.bestTimeSec}s with ${save.bestKills} kills`);

  expect(save.bestTimeSec).toBeGreaterThan(300);
  await snap(page, 'afk-results');
  expect(errors, errors.join('\n')).toEqual([]);
});
