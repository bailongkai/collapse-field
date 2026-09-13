import { test, expect, type Page } from '@playwright/test';
import { openGame, startRun, waitScene, state, step, stepResolving, settleOverlays, press, realWait } from './helpers';

const events = (page: Page) => page.evaluate(() => window.__game.analytics());
const named = async (page: Page, name: string) => (await events(page)).filter((e) => e.name === name);

test('telemetry: every started run reports exactly one end, including the ones abandoned', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=81');
  await startRun(page, 81);
  await waitScene(page, 'game');
  expect(await named(page, 'run_start')).toHaveLength(1);
  expect(await named(page, 'run_end'), 'a run ended before it began').toHaveLength(0);

  // quitting from the pause menu is the path that used to drop the run on the floor
  await page.evaluate(() => window.__game.step(120));
  await page.evaluate(() => window.__game.pause());
  await waitScene(page, 'pause');
  await press(page, 'pause.menu');
  await waitScene(page, 'menu');
  const ends = await named(page, 'run_end');
  expect(ends, 'an abandoned run reported nothing').toHaveLength(1);
  expect((ends[0] as unknown as { cause: string }).cause).toBe('quit');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('telemetry: a death reports the run once, with the facts a balance question needs', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=82');
  await startRun(page, 82);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.giveWeapon('railgun', 4);
    window.__game.spawn('mech', 30, { ring: true, radius: 40 });
  });
  for (let i = 0; i < 40 && (await state(page)).phase === 'running'; i++) {
    await step(page, 60);
    await settleOverlays(page);
  }
  await waitScene(page, 'results');
  const ends = await named(page, 'run_end');
  expect(ends).toHaveLength(1);
  const e = ends[0] as unknown as Record<string, unknown>;
  expect(e.cause).toBe('died');
  expect(e.seed, 'the seed is what makes a death reproducible').toBe(82);
  expect(typeof e.minute).toBe('number');
  expect(typeof e.runIndex).toBe('number');
  expect(String(e.build), 'the build was not recorded').toContain('railgun');
  expect(String(e.build).length, 'the build overran the parameter limit').toBeLessThanOrEqual(96);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('telemetry: a level-up records what was offered, not only what was taken', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=83');
  await startRun(page, 83);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.triggerLevelUp();
  });
  await waitScene(page, 'levelup');
  const offered = await page.evaluate(() => window.__game.getChoices());
  await page.evaluate(() => window.__game.pickChoice(0));
  await waitScene(page, 'game');
  const picks = await named(page, 'levelup_pick');
  expect(picks).toHaveLength(1);
  const p = picks[0] as unknown as Record<string, unknown>;
  expect(p.action).toBe('pick');
  // every card that was on the table, so a pick rate can be divided by an offer rate
  expect(String(p.offered).split(',')).toHaveLength(offered!.length);
  expect(typeof p.level).toBe('number');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('telemetry: the charges the player bought are measured when they are spent', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=84');
  await page.evaluate(() => {
    const g = window.__game;
    g.save.addGold(5000);
    for (let i = 0; i < 2; i++) g.ui.press('menu.shop');
  });
  await page.evaluate(() => window.__game.goto('menu'));
  await waitScene(page, 'menu');
  await page.evaluate(() => window.__game.ui.press('menu.shop'));
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buy.reroll'));
  await press(page, 'shop.buy.reroll');
  await press(page, 'shop.back');
  await startRun(page, 84);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.triggerLevelUp();
  });
  await waitScene(page, 'levelup');
  expect(await page.evaluate(() => window.__game.reroll())).toBe(true);
  await realWait(80);
  const rerolls = (await named(page, 'levelup_pick')).filter((e) => (e as unknown as { action: string }).action === 'reroll');
  expect(rerolls, 'a reroll the player paid for was not measured').toHaveLength(1);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('telemetry: the rewarded ad funnel has both ends', async ({ page }) => {
  const errors = await openGame(page, '?test=1&ads=1&seed=85');
  await startRun(page, 85);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.spawn('mech', 30, { ring: true, radius: 40 });
  });
  for (let i = 0; i < 40 && (await state(page)).phase === 'running'; i++) {
    await step(page, 60);
    await settleOverlays(page);
  }
  await waitScene(page, 'revive');
  expect(await named(page, 'ad_offer'), 'the offer itself was never recorded').toHaveLength(1);
  await press(page, 'revive.accept');
  await page.waitForFunction(() => window.__game.getState().adRevived === true);
  const shown = await named(page, 'ad_shown');
  expect(shown).toHaveLength(1);
  expect((shown[0] as unknown as { result: string }).result, 'a boolean cannot tell a decline from a broken SDK').toBe('completed');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('telemetry: nothing is sent anywhere under test, and the sink reports its own health', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=86');
  const health = await page.evaluate(() => window.__game.analyticsHealth());
  expect(health.enabled, 'the test build was wired to a live project').toBe(false);
  expect(health.sent).toBe(0);
  expect(health.failures).toBe(0);
  await startRun(page, 86);
  await waitScene(page, 'game');
  await stepResolving(page, 120);
  // the ring buffer still fills, so the tests above can read it; only the sink is off
  expect((await events(page)).length).toBeGreaterThan(0);
  expect((await page.evaluate(() => window.__game.analyticsHealth())).sent).toBe(0);
  expect(errors, errors.join('\n')).toEqual([]);
});
