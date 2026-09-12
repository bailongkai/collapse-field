import { test, expect, type Page } from '@playwright/test';
import { openGame, waitScene, pressStart, realWait } from './helpers';

const perf = (page: Page) => page.evaluate(() => window.__game.getPerf());

test('audio: the menu starts the score on the first press, and the fight and the boss change it', async ({ page }) => {
  // not ?test=1: that mutes the bus and disables the score, which is what every other spec wants
  const errors = await openGame(page, '?debug=1&seed=71&tutorial=0');
  await waitScene(page, 'menu');
  expect((await perf(page)).musicPlaying, 'the score started with no gesture at all').toBe(false);

  // a press anywhere on the menu is the gesture the browser wants
  await page.mouse.click(60, 400);
  await page.waitForFunction(() => window.__game.getPerf().musicPlaying === true, undefined, { timeout: 5000 });
  expect((await perf(page)).musicMood).toBe('menu');

  await pressStart(page);
  await waitScene(page, 'game');
  await page.waitForFunction(() => window.__game.getPerf().musicMood === 'battle', undefined, { timeout: 5000 });

  // a boss on the field lifts it, and killing the boss hands it back
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.spawnBoss();
  });
  await page.waitForFunction(() => window.__game.getPerf().musicMood === 'boss', undefined, { timeout: 5000 });
  await page.evaluate(() => window.__game.killAll());
  await page.waitForFunction(() => window.__game.getPerf().musicMood === 'battle', undefined, { timeout: 5000 });

  // the final boss has its own mood, and the results screen goes back to the menu theme
  await page.evaluate(() => {
    window.__game.setTime(899);
    window.__game.step(120);
  });
  await page.waitForFunction(() => window.__game.getPerf().musicMood === 'final', undefined, { timeout: 5000 });
  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  await page.waitForFunction(() => window.__game.getPerf().musicMood === 'menu', undefined, { timeout: 5000 });

  // it never stops along the way, and the sound bus stays inside its cap
  await realWait(300);
  const p = await perf(page);
  expect(p.musicPlaying).toBe(true);
  expect(p.activeSounds).toBeLessThanOrEqual(16);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('audio: silence is respected — a muted score never starts', async ({ page }) => {
  const errors = await openGame(page, '?debug=1&seed=72&tutorial=0');
  await waitScene(page, 'menu');
  await page.evaluate(() => {
    const save = window.__game.save.get();
    save.settings.musicVolume = 0;
    window.__game.save.set(save);
  });
  await page.evaluate(() => window.__game.goto('menu'));
  await waitScene(page, 'menu');
  await page.mouse.click(60, 400);
  await realWait(400);
  expect((await perf(page)).musicPlaying, 'the score played at zero volume').toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});
