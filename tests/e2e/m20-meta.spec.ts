import { test, expect, type Page } from '@playwright/test';
import { openGame, snap, state, waitScene } from './helpers';

/** Every text drawn by a scene, containers included. */
function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    type Node = { text?: string; list?: Node[] };
    const scene = window.__game.phaser.scene.getScene(k) as unknown as { children: { list: Node[] } };
    const out: string[] = [];
    const walk = (n: Node): void => {
      if (n.text) out.push(n.text);
      for (const c of n.list ?? []) walk(c);
    };
    for (const c of scene.children.list) walk(c);
    return out;
  }, key);
}

async function openLaunch(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.__game.ui.press('menu.start'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.start'));
}

test('protocols: the launch screen lists them, a locked one says what opens it, an open one goes into the run', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=20&lang=zh-CN');
  // the first boss kill opens 回身冲刺; the rest stay locked
  await page.evaluate(() => window.__game.save.set({ ...window.__game.save.get(), achievements: ['bossSlayer'], tutorialDone: true }));
  await openLaunch(page);
  const ids = (await page.evaluate(() => window.__game.ui.buttons())).map((b) => b.id);
  for (const p of ['none', 'collapse', 'oneSide', 'noMagnet', 'dash']) expect(ids).toContain(`launch.protocol.${p}`);

  // a locked protocol can be read, not taken
  await page.evaluate(() => window.__game.ui.press('launch.protocol.collapse'));
  const lockedNote = (await sceneTexts(page, 'Launch')).join('\n');
  expect(lockedNote).toContain(await page.evaluate(() => window.__game.i18n.t('protocol.collapse.desc')));
  expect(lockedNote).toContain(await page.evaluate(() => window.__game.i18n.t('achievement.clearStation.desc')));
  await snap(page, 'm20-protocol-locked');

  await page.evaluate(() => window.__game.ui.press('launch.protocol.dash'));
  await snap(page, 'm20-protocol-dash');
  expect(await page.evaluate(() => window.__game.ui.press('launch.start'))).toBe(true);
  await waitScene(page, 'game');
  expect((await state(page)).protocol).toBe('dash');
  expect((await page.evaluate(() => window.__game.save.get())).lastProtocol).toBe('dash');
  const start = (await page.evaluate(() => window.__game.analytics())).filter((e) => e.name === 'run_start').pop() as unknown as { protocol: string };
  expect(start.protocol).toBe('dash');

  // the run end reports it too
  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  const end = (await page.evaluate(() => window.__game.analytics())).filter((e) => e.name === 'run_end').pop() as unknown as { protocol: string };
  expect(end.protocol).toBe('dash');
  expect(await sceneTexts(page, 'Results')).toContain(await page.evaluate(() => window.__game.i18n.t('protocol.dash.name')));
  expect(errors, errors.join('\n')).toEqual([]);
});

test('protocols: a locked protocol in the save is not taken into the run', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=21');
  await page.evaluate(() => window.__game.save.set({ ...window.__game.save.get(), achievements: [], lastProtocol: 'oneSide', tutorialDone: true }));
  await openLaunch(page);
  await page.evaluate(() => window.__game.ui.press('launch.protocol.oneSide'));
  expect(await page.evaluate(() => window.__game.ui.press('launch.start'))).toBe(true);
  await waitScene(page, 'game');
  expect((await state(page)).protocol).toBe('');
  expect(errors, errors.join('\n')).toEqual([]);
});
