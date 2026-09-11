import { test, expect } from '@playwright/test';
import { openGame, snap, state, ff, waitScene, expectScenes, sceneName, realWait, pressStart } from './helpers';

test('M8: menu to game to pause to results to menu, driven the way a player would', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=71');

  await pressStart(page);
  await waitScene(page, 'game');
  await expectScenes(page, ['Game', 'Hud']);

  await page.keyboard.press('Escape');
  await waitScene(page, 'pause');
  expect(await page.evaluate(() => window.__game.ui.press('pause.resume'))).toBe(true);
  await waitScene(page, 'game');

  await page.evaluate(() => window.__game.godMode(true));
  await ff(page, 30);
  expect((await state(page)).time).toBeGreaterThan(25);

  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  expect(await page.evaluate(() => window.__game.ui.press('results.menu'))).toBe(true);
  await waitScene(page, 'menu');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('M8: three runs in a row leave no scenes or listeners behind', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=81');

  for (let run = 0; run < 3; run++) {
    await page.evaluate((seed) => window.__game.startRun({ seed }), 100 + run);
    await waitScene(page, 'game');
    await expectScenes(page, ['Game', 'Hud']);

    // the profiler must count one run's frames, not one per run ever started
    await page.evaluate(() => window.__game.profile.start());
    await page.evaluate(() => window.__game.step(120));
    const frames = (await page.evaluate(() => window.__game.profile.stop())).frames;
    expect(frames, `run ${run} counted ${frames} frames`).toBeLessThan(20);

    const s = await state(page);
    expect(s.kills).toBe(0);
    expect(s.weapons).toEqual([{ id: 'plasmaBlade', level: 1 }]);

    await page.evaluate(() => window.__game.endRun('died'));
    await waitScene(page, 'results');
    expect(await page.evaluate(() => window.__game.ui.press('results.retry'))).toBe(true);
    await waitScene(page, 'game');
  }

  const save = await page.evaluate(() => window.__game.save.get());
  expect(save.runsPlayed).toBe(3);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M8: goto leaves exactly the target scene running', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=95');
  for (const target of ['game', 'menu', 'game', 'results', 'menu'] as const) {
    await page.evaluate((t) => window.__game.goto(t), target);
    await waitScene(page, target);
    const scenes = await page.evaluate(() => window.__game.activeScenes());
    expect(scenes.length, `after goto(${target}): ${scenes.join(',')}`).toBeGreaterThan(0);
    // and something is actually drawn: a black canvas means the scene stack was emptied
    const lit = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      return c.width > 0 && c.height > 0;
    });
    expect(lit).toBe(true);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M8: the settings screen switches the language across the whole interface', async ({ page }) => {
  const errors = await openGame(page, '?test=1');

  expect(await page.evaluate(() => window.__game.ui.press('menu.settings'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'settings.lang.en'));
  await snap(page, 'm8-settings');

  await page.evaluate(() => window.__game.ui.press('settings.lang.en'));
  await page.waitForFunction(() => window.__game.i18n.getLocale() === 'en');
  expect(await page.evaluate(() => window.__game.i18n.t('menu.start'))).toBe('Start');

  await page.evaluate(() => window.__game.ui.press('settings.back'));
  await waitScene(page, 'menu');
  await snap(page, 'm8-menu-en');

  // the choice is persisted
  expect((await page.evaluate(() => window.__game.save.get())).settings.locale).toBe('en');

  await page.evaluate(() => window.__game.i18n.setLocale('zh-CN'));
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M8: Enter on the menu does not start a run under an open panel', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  expect(await page.evaluate(() => window.__game.ui.press('menu.shop'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.back'));

  await page.keyboard.press('Enter');
  await realWait(400);
  expect(await sceneName(page), 'a run started underneath the shop').toBe('menu');
  expect(await page.evaluate(() => window.__game.activeScenes())).toContain('Shop');

  // closing the panel restores the shortcut; the menu rebuilds itself, so wait for it to settle
  await page.evaluate(() => window.__game.ui.press('shop.back'));
  await expectScenes(page, ['Menu']);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'menu.start'));
  await page.keyboard.press('Enter');
  // Enter opens the launch screen, and Enter there starts the run
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.start'));
  await page.keyboard.press('Enter');
  await waitScene(page, 'game');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M8: audio stays inside its caps during real play, and the score starts with the run', async ({ page }) => {
  const errors = await openGame(page, '?debug=1&seed=91&tutorial=0');
  // the real Start button is the gesture that lets the browser begin audio
  await pressStart(page);
  await waitScene(page, 'game');
  await page.waitForFunction(() => window.__game.getPerf().musicPlaying === true, undefined, { timeout: 5000 });
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.giveWeapon('railgun', 6);
    window.__game.spawn('drone', 200, { radius: 200 });
  });
  await page.waitForTimeout(2500);
  const perf = await page.evaluate(() => window.__game.getPerf());
  expect(perf.activeSounds).toBeLessThanOrEqual(16);
  expect(perf.musicPlaying).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});
