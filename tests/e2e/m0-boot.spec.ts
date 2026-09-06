import { test, expect } from '@playwright/test';
import { openGame, snap, sceneName, events } from './helpers';

test('M0: boots to the menu with WebGL and the Phaser 4 API smoke passes', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  expect(await sceneName(page)).toBe('menu');
  const ev = await events(page);
  const fail = ev.find((e) => e.startsWith('smoke:fail'));
  expect(fail, fail).toBeUndefined();
  expect(ev).toContain('smoke:ok');

  const perf = await page.evaluate(() => window.__game.getPerf());
  const isWebGL = await page.evaluate(() => window.__game.phaser.renderer.type === (window as unknown as { Phaser?: { WEBGL: number } }).Phaser?.WEBGL || (window.__game.phaser.renderer as unknown as { gl?: unknown }).gl !== undefined);
  expect(isWebGL, `renderer: ${perf.renderer}`).toBe(true);
  expect(perf.renderer.length).toBeGreaterThan(0);

  const buttons = await page.evaluate(() => window.__game.ui.buttons());
  expect(buttons.map((b) => b.id)).toContain('menu.start');
  expect(await page.evaluate(() => window.__game.version)).toBeTruthy();

  await snap(page, 'm0-menu');
  expect(errors, errors.join('\n')).toEqual([]);
});
