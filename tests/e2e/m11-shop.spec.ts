import { test, expect } from '@playwright/test';
import { openGame, snap, state, waitScene } from './helpers';

test('shop: gold buys a permanent upgrade that carries into the next run', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  await page.evaluate(() => window.__game.save.addGold(500));

  expect(await page.evaluate(() => window.__game.ui.press('menu.shop'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buy.hull'));
  await snap(page, 'shop');

  expect(await page.evaluate(() => window.__game.ui.press('shop.buy.hull'))).toBe(true);
  await page.waitForFunction(() => window.__game.save.get().upgrades.hull === 1);
  expect((await page.evaluate(() => window.__game.save.get())).gold).toBe(400);

  // an upgrade the player cannot afford is not pressable
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buy.revival' && !b.enabled));

  await page.evaluate(() => window.__game.ui.press('shop.back'));
  await waitScene(page, 'menu');
  await page.evaluate(() => window.__game.startRun({ seed: 5 }));
  await waitScene(page, 'game');
  const s = await state(page);
  expect(s.maxHp).toBeCloseTo(110, 5);
  expect(s.hp).toBeCloseTo(110, 5);

  expect(errors, errors.join('\n')).toEqual([]);
});
