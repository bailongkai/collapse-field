import { test, expect } from '@playwright/test';
import { openGame, startRun, waitScene, state, snap } from './helpers';

test('agency: reroll, skip and banish are on the level-up screen once bought', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=21');
  await page.evaluate(() => window.__game.save.addGold(2000));
  expect(await page.evaluate(() => window.__game.ui.press('menu.shop'))).toBe(true);
  for (const id of ['shop.buy.reroll', 'shop.buy.skip', 'shop.buy.banish']) {
    await page.waitForFunction((b) => window.__game.ui.buttons().some((x) => x.id === b && x.enabled), id);
    expect(await page.evaluate((b) => window.__game.ui.press(b), id)).toBe(true);
    await page.waitForFunction((b) => window.__game.save.get().upgrades[b.split('.').pop()!] === 1, id);
  }
  await page.evaluate(() => window.__game.ui.press('shop.back'));
  await waitScene(page, 'menu');

  await startRun(page, 21);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.triggerLevelUp();
  });
  await waitScene(page, 'levelup');
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'levelup.reroll' && b.enabled));
  await snap(page, 'levelup-agency');
  const before = await page.evaluate(() => JSON.stringify(window.__game.getChoices()));
  expect(await page.evaluate(() => window.__game.ui.press('levelup.reroll'))).toBe(true);
  await page.waitForFunction((b) => JSON.stringify(window.__game.getChoices()) !== b, before);
  expect((await state(page)).charges.reroll).toBe(0);
  // the overlay rebuilt itself with the new offer and the spent button is greyed
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'levelup.reroll' && !b.enabled));

  expect(await page.evaluate(() => window.__game.ui.press('levelup.skip'))).toBe(true);
  await waitScene(page, 'game');
  expect((await state(page)).phase).toBe('running');
  expect((await state(page)).charges.skip).toBe(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('agency: a maxed build is offered limit break cards', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=22');
  await startRun(page, 22);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    const g = window.__game;
    g.setTimeScale(0);
    g.godMode(true);
    // six slots, so a maxed build is six weapons: leave one free and a seventh is still offerable
    for (const id of ['plasmaBlade', 'guidedLaser', 'railgun', 'orbitalDrones', 'empField', 'arcPylons']) g.giveWeapon(id, 8);
    for (const id of g.content().passives) g.givePassive(id, 5);
    g.triggerLevelUp();
  });
  await waitScene(page, 'levelup');
  const choices = await page.evaluate(() => window.__game.getChoices());
  expect(choices!.every((c) => c.kind === 'limit')).toBe(true);
  await snap(page, 'levelup-limit');
  expect(await page.evaluate(() => window.__game.ui.press('levelup.card0'))).toBe(true);
  await waitScene(page, 'game');
  expect(errors, errors.join('\n')).toEqual([]);
});
