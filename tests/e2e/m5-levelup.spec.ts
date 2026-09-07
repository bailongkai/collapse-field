import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, step, events, ff, realWait, waitScene, sceneName } from './helpers';

test('M5: gems, the level-up overlay and applying a choice', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=64');
  await startRun(page, 64);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));
  await page.evaluate(() => window.__game.godMode(true));

  // gems appear on the field and are drawn
  await page.evaluate(() => window.__game.spawnGems(40, 'blue'));
  expect((await state(page)).counts.gems).toBe(40);

  // reaching a threshold freezes the run and opens the overlay
  await page.evaluate(() => window.__game.addXp(5));
  await step(page, 1);
  expect((await state(page)).phase).toBe('levelup');
  await waitScene(page, 'levelup');

  const frozen = await state(page);
  expect(await step(page, 60)).toBe(0);
  await realWait(500);
  expect((await state(page)).time).toBeCloseTo(frozen.time, 3);

  const choices = await page.evaluate(() => window.__game.getChoices());
  expect(choices?.length).toBeGreaterThanOrEqual(2);
  expect(choices?.length).toBeLessThanOrEqual(4);
  await snap(page, 'm5-levelup');

  // picking a card applies it and hands control back
  await page.evaluate(() => window.__game.pickChoice(0));
  await waitScene(page, 'game');
  const after = await state(page);
  expect(after.phase).toBe('running');
  expect(after.level).toBe(2);
  const changed = after.weapons.length + after.passives.length > 1 || after.weapons[0].level > 1 || after.gold > 0 || after.hp > 0;
  expect(changed).toBe(true);
  expect(await step(page, 10)).toBe(10);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('M5: two levels in one grant offer two consecutive cards', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=77');
  await startRun(page, 77);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));
  await page.evaluate(() => window.__game.godMode(true));

  await page.evaluate(() => window.__game.addXp(40));
  await step(page, 1);
  const levelUps = (await events(page)).filter((e) => e.startsWith('levelup:'));
  expect(levelUps.length).toBeGreaterThanOrEqual(2);

  await waitScene(page, 'levelup');
  await page.evaluate(() => window.__game.pickChoice(0));
  expect((await state(page)).phase).toBe('levelup');
  await page.evaluate(() => window.__game.pickChoice(0));
  await waitScene(page, 'game');
  expect((await state(page)).phase).toBe('running');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('M5: the level-up card can be pressed by id and by keyboard', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=88');
  await startRun(page, 88);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.godMode(true));

  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');
  const buttons = await page.evaluate(() => window.__game.ui.buttons().map((b) => b.id));
  expect(buttons).toContain('levelup.card0');
  expect(await page.evaluate(() => window.__game.ui.press('levelup.card0'))).toBe(true);
  await waitScene(page, 'game');

  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitScene(page, 'game');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('M5: killing enemies pulls in their gems and levels the player up', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=101');
  await startRun(page, 101);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.setStat('magnet', 8);
    window.__game.giveWeapon('guidedLaser', 5);
    window.__game.giveWeapon('plasmaBlade', 5);
    window.__game.spawn('drone', 80, { radius: 180 });
  });
  // fast-forward resolves each level-up offer as it appears, the way a player would
  await ff(page, 20);
  const s = await state(page);
  expect(s.kills).toBeGreaterThan(10);
  expect(s.level).toBeGreaterThan(1);
  expect(s.weapons.length + s.passives.length).toBeGreaterThan(1);
  await snap(page, 'm5-gems');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M5: a level-up opens the overlay exactly once', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=91');
  await startRun(page, 91);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.godMode(true));

  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');
  await realWait(900); // well past the 250 ms delay, so a second open would have landed
  const opens = (await events(page)).filter((e) => e === 'levelup:open');
  expect(opens, 'the overlay was opened more than once for one level-up').toHaveLength(1);

  await page.evaluate(() => window.__game.pickChoice(0));
  await waitScene(page, 'game');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('M5: a release with no matching press never picks a card', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=92');
  await startRun(page, 92);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.godMode(true));

  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');
  const card = await page.evaluate(() => window.__game.ui.buttons().find((b) => b.id === 'levelup.card0'));
  const at = await page.evaluate(
    ({ x, y }) => {
      const c = document.querySelector('canvas')!;
      const r = c.getBoundingClientRect();
      const s = r.width / window.__game.phaser.scale.width;
      return { x: r.left + x * s, y: r.top + y * s };
    },
    { x: card!.x, y: card!.y },
  );

  // a bare mouse-up over the card, as if the button had appeared under a finger already down
  await page.mouse.move(at.x, at.y);
  await page.evaluate((p) => {
    const c = document.querySelector('canvas')!;
    c.dispatchEvent(new PointerEvent('pointerup', { clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1, button: 0 }));
  }, at);
  await realWait(300);
  expect(await sceneName(page), 'a bare release chose a card').toBe('levelup');

  // a real press and release does choose
  await page.mouse.down();
  await page.mouse.up();
  await waitScene(page, 'game');
  expect(errors, errors.join('\n')).toEqual([]);
});
