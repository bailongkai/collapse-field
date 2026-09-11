import { test, expect, type Page } from '@playwright/test';
import { openGame, startRun, waitScene, state, events, step, press, snap, realWait } from './helpers';

/** Presses through whatever overlay is up (a chest reveal, a level-up) until the run is running. */
async function settle(page: Page): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (!(await page.evaluate(() => window.__game.hasRun()))) return;
    const phase = (await state(page)).phase;
    if (phase === 'running') return;
    if (phase === 'levelup') {
      await page.evaluate(() => window.__game.pickChoice(0));
    } else if (await page.evaluate(() => window.__game.activeScenes().includes('Chest'))) {
      // a revive's clear can drop a wreck chest, which opens its reveal over the run
      await press(page, 'chest.continue');
    }
    await realWait(60);
  }
}

/** Surrounds the player with heavies and steps until the run is no longer running. */
async function die(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.spawn('mech', 30, { ring: true, radius: 40 });
  });
  for (let i = 0; i < 40; i++) {
    // the run can end inside a batch, which unbinds the hook: that is the outcome wanted here
    if (!(await page.evaluate(() => window.__game.hasRun()))) return;
    const phase = (await state(page)).phase;
    if (phase === 'running') {
      await step(page, 60);
      continue;
    }
    if (phase === 'revivePrompt' || phase === 'ended') return;
    await settle(page);
  }
}

test('revive: death opens the ad offer, and watching the ad puts the player back', async ({ page }) => {
  const errors = await openGame(page, '?test=1&ads=1&seed=51');
  await startRun(page, 51);
  await waitScene(page, 'game');
  await die(page);
  expect((await state(page)).phase).toBe('revivePrompt');
  await waitScene(page, 'revive');
  await snap(page, 'm15-revive');
  expect((await events(page))).toContain('revive:offer');

  // the fake ad resolves at once under test; the overlay closes on its own once it has
  await press(page, 'revive.accept');
  await page.waitForFunction(() => window.__game.getState().adRevived === true);
  await settle(page);
  await waitScene(page, 'game');
  const s = await state(page);
  expect(s.adRevived).toBe(true);
  expect(s.hp).toBeGreaterThan(0);
  expect(s.enemies.alive).toBe(0);
  expect(await events(page)).toContain('revive');
  const tracked = await page.evaluate(() => window.__game.analytics().map((e) => e.name));
  expect(tracked).toContain('ad_shown');

  // the second death is final
  await die(page);
  await waitScene(page, 'results');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('revive: declining ends the run where it died', async ({ page }) => {
  const errors = await openGame(page, '?test=1&ads=1&seed=52');
  await startRun(page, 52);
  await waitScene(page, 'game');
  await die(page);
  await waitScene(page, 'revive');
  await press(page, 'revive.decline');
  await waitScene(page, 'results');
  expect(await events(page)).toContain('died');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('revive: without ads a death is a plain death', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=57');
  await startRun(page, 57);
  await waitScene(page, 'game');
  await die(page);
  await waitScene(page, 'results');
  expect(await events(page)).not.toContain('revive:offer');
  expect(errors, errors.join('\\n')).toEqual([]);
});

test('revive: a fast-forward declines for itself rather than stalling', async ({ page }) => {
  const errors = await openGame(page, '?test=1&ads=1&seed=53');
  await startRun(page, 53);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.spawn('mech', 30, { ring: true, radius: 40 }));
  await page.evaluate(() => window.__game.fastForward(30));
  await waitScene(page, 'results');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('results: the gold of the run doubles for an ad, once', async ({ page }) => {
  const errors = await openGame(page, '?test=1&ads=1&seed=54');
  await startRun(page, 54);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    const p = window.__game.getState().player;
    for (let i = 0; i < 5; i++) window.__game.spawnPickup('coin', p.x, p.y);
  });
  await step(page, 10);
  const gold = (await state(page)).gold;
  expect(gold).toBeGreaterThan(0);
  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  const before = await page.evaluate(() => window.__game.save.get().gold);
  expect(await press(page, 'results.doubleGold')).toBe(true);
  await page.waitForFunction((g) => window.__game.save.get().gold === g, before + gold);
  await realWait(120);
  await snap(page, 'm15-double-gold');
  // the offer is gone once taken
  const ids = await page.evaluate(() => window.__game.ui.buttons().map((b) => b.id));
  expect(ids).not.toContain('results.doubleGold');
  expect(ids).toContain('results.retry');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('shop: the store sells and restores through the platform fake', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  await page.evaluate(() => window.__game.ui.press('menu.shop'));
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.iap.remove_ads'));
  await snap(page, 'm15-store');
  const before = await page.evaluate(() => window.__game.save.get());
  expect(before.removeAds).toBe(false);
  await press(page, 'shop.iap.remove_ads');
  await page.waitForFunction(() => window.__game.save.get().removeAds === true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.iap.remove_ads' && !b.enabled));
  await press(page, 'shop.iap.gold_2000');
  await page.waitForFunction((g) => window.__game.save.get().gold === g + 2000, before.gold);
  await press(page, 'shop.iap.all_characters');
  await page.waitForFunction(() => window.__game.save.get().unlocks.characters.includes('navigator'));
  const tracked = await page.evaluate(() => window.__game.analytics().filter((e) => e.name === 'purchase').length);
  expect(tracked).toBe(3);
  expect(await press(page, 'shop.restore')).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('tutorial: the first run opens on the briefing and it is never shown again', async ({ page }) => {
  const errors = await openGame(page, '?test=1&tutorial=1&seed=55');
  expect(await page.evaluate(() => window.__game.save.get().tutorialDone)).toBe(false);
  await page.evaluate(() => window.__game.ui.press('menu.start'));
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.start'));
  await page.evaluate(() => window.__game.ui.press('launch.start'));
  await waitScene(page, 'tutorial');
  await snap(page, 'm15-tutorial');
  // the clock waits for the briefing
  expect((await state(page)).phase).toBe('paused');
  expect(await step(page, 60)).toBe(0);
  await press(page, 'tutorial.next');
  await press(page, 'tutorial.next');
  await press(page, 'tutorial.next');
  await waitScene(page, 'game');
  expect((await state(page)).phase).toBe('running');
  expect(await page.evaluate(() => window.__game.save.get().tutorialDone)).toBe(true);
  expect(await events(page)).toContain('tutorial:open');

  // a second run starts straight into play
  await startRun(page, 56);
  await waitScene(page, 'game');
  await realWait(100);
  expect(await page.evaluate(() => window.__game.activeScenes())).not.toContain('Tutorial');
  expect(errors, errors.join('\n')).toEqual([]);
});
