import { test, expect } from '@playwright/test';
import { openGame, snap, state, waitScene, pressStart, expectScenes } from './helpers';

test('launch: the default selection is the free character on the first stage', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=13');
  await pressStart(page);
  await waitScene(page, 'game');
  const s = await state(page);
  expect(s.weapons).toEqual([{ id: 'plasmaBlade', level: 1 }]);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('launch: locked characters and stages are shown but cannot be picked', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  expect(await page.evaluate(() => window.__game.ui.press('menu.start'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.start'));
  await snap(page, 'launch');
  const buttons = await page.evaluate(() => window.__game.ui.buttons());
  const ids = buttons.map((b) => b.id);
  for (const c of ['survivor', 'marine', 'engineer', 'unit', 'navigator']) expect(ids).toContain(`launch.char.${c}`);
  for (const st of ['station', 'cargo', 'lab', 'orbit']) expect(ids).toContain(`launch.stage.${st}`);
  expect(buttons.find((b) => b.id === 'launch.char.marine')!.enabled).toBe(false);
  expect(buttons.find((b) => b.id === 'launch.stage.cargo')!.enabled).toBe(false);
  // pressing a locked card changes nothing
  expect(await page.evaluate(() => window.__game.ui.press('launch.char.marine'))).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('launch: a character bought in the shop can be picked and starts with its own weapon', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=14');
  await page.evaluate(() => window.__game.save.addGold(700));
  expect(await page.evaluate(() => window.__game.ui.press('menu.shop'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buyChar.marine' && b.enabled));
  await snap(page, 'shop-characters');
  expect(await page.evaluate(() => window.__game.ui.press('shop.buyChar.marine'))).toBe(true);
  await page.waitForFunction(() => window.__game.save.get().unlocks.characters.includes('marine'));
  expect((await page.evaluate(() => window.__game.save.get())).gold).toBe(100);
  // the engineer costs more than what is left, and the marine is now owned rather than for sale
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buyChar.engineer' && !b.enabled));
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buyChar.marine' && !b.enabled));
  await page.evaluate(() => window.__game.ui.press('shop.back'));
  // the shop is stopped on a frame boundary and Start refuses to open the launch screen under an
  // open panel, so wait for the menu to really be alone rather than merely on top
  await expectScenes(page, ['Menu']);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'menu.start'));

  expect(await page.evaluate(() => window.__game.ui.press('menu.start'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.char.marine' && b.enabled));
  expect(await page.evaluate(() => window.__game.ui.press('launch.char.marine'))).toBe(true);
  expect(await page.evaluate(() => window.__game.ui.press('launch.start'))).toBe(true);
  await waitScene(page, 'game');
  const s = await state(page);
  expect(s.weapons).toEqual([{ id: 'railgun', level: 1 }]);
  expect(s.maxHp).toBeCloseTo(110, 5);
  expect((await page.evaluate(() => window.__game.save.get())).lastCharacterId).toBe('marine');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('launch: surviving a stage unlocks the next one and the results say so', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=15');
  await page.evaluate(() => window.__game.startRun({ seed: 15, stageId: 'station' }));
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.endRun('survived'));
  await waitScene(page, 'results');
  await snap(page, 'results-unlock');
  const save = await page.evaluate(() => window.__game.save.get());
  expect(save.unlocks.stages).toContain('station');
  expect(save.stageBest.station).toBeGreaterThanOrEqual(0);

  expect(await page.evaluate(() => window.__game.ui.press('results.menu'))).toBe(true);
  await waitScene(page, 'menu');
  expect(await page.evaluate(() => window.__game.ui.press('menu.start'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.stage.cargo' && b.enabled));
  expect(await page.evaluate(() => window.__game.ui.buttons().find((b) => b.id === 'launch.stage.lab')!.enabled)).toBe(false);
  expect(await page.evaluate(() => window.__game.ui.press('launch.stage.cargo'))).toBe(true);
  expect(await page.evaluate(() => window.__game.ui.press('launch.start'))).toBe(true);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.step(60 * 5));
  await snap(page, 'stage-cargo');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('launch: every stage boots, draws its own floor and reaches its first boss', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=16');
  for (const stageId of ['cargo', 'lab', 'orbit']) {
    await page.evaluate((id) => window.__game.startRun({ seed: 16, stageId: id }), stageId);
    await waitScene(page, 'game');
    await page.evaluate(() => {
      window.__game.godMode(true);
      window.__game.setTimeScale(0);
      window.__game.setTime(299);
    });
    await page.evaluate(() => window.__game.step(120));
    const s = await state(page);
    expect(s.enemies.byBehavior.boss, `${stageId} has no boss at 5:00`).toBeGreaterThanOrEqual(1);
    await snap(page, `stage-${stageId}`);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('launch: the challenge toggle is remembered and shows on the results', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=17');
  expect(await page.evaluate(() => window.__game.ui.press('menu.start'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.curse.40'));
  expect(await page.evaluate(() => window.__game.ui.press('launch.curse.40'))).toBe(true);
  await snap(page, 'launch-challenge');
  expect(await page.evaluate(() => window.__game.ui.press('launch.start'))).toBe(true);
  await waitScene(page, 'game');
  expect((await state(page)).curse).toBeCloseTo(0.4, 6);
  expect((await page.evaluate(() => window.__game.save.get())).lastCurse).toBeCloseTo(0.4, 6);
  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  await snap(page, 'results-challenge');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('achievements: the screen lists them, and a qualifying run earns one on the results', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=18');
  expect(await page.evaluate(() => window.__game.ui.press('menu.achievements'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'achievements.back'));
  await snap(page, 'achievements');
  await page.evaluate(() => window.__game.ui.press('achievements.back'));
  await expectScenes(page, ['Menu']);

  await page.evaluate(() => window.__game.startRun({ seed: 18 }));
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
  });
  // meet the first wave before jumping the clock: setTime spawns nothing on its own
  await page.evaluate(() => window.__game.step(120));
  await page.evaluate(() => window.__game.setTime(305));
  await page.evaluate(() => window.__game.step(2));
  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  const save = await page.evaluate(() => window.__game.save.get());
  expect(save.achievements).toContain('fiveMinutes');
  expect(save.seen.length, 'a five minute run met something').toBeGreaterThan(0);
  await snap(page, 'results-achievement');

  // the bestiary sits behind the achievements screen and lights what has been met
  expect(await page.evaluate(() => window.__game.ui.press('results.menu'))).toBe(true);
  await waitScene(page, 'menu');
  expect(await page.evaluate(() => window.__game.ui.press('menu.achievements'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'achievements.bestiary'));
  expect(await page.evaluate(() => window.__game.ui.press('achievements.bestiary'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'bestiary.back'));
  await snap(page, 'bestiary');
  expect(errors, errors.join('\n')).toEqual([]);
});
