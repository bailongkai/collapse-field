import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, stepResolving, waitScene } from './helpers';

const WEAPONS = ['plasmaBlade', 'guidedLaser', 'railgun', 'orbitalDrones', 'empField'];

for (const id of WEAPONS) {
  test(`M6: ${id} alone clears a crowd`, async ({ page }) => {
    const errors = await openGame(page, '?test=1&seed=7');
    await startRun(page, 7);
    await waitScene(page, 'game');
    await page.evaluate(() => window.__game.setTimeScale(0));
    await page.evaluate((weapon) => {
      window.__game.godMode(true);
      window.__game.setStat('growth', 0); // no level-ups, so the measurement is uninterrupted
      window.__game.giveWeapon(weapon, 4);
      window.__game.spawn('drone', 100, { radius: 140 });
    }, id);

    await stepResolving(page, 60 * 8);
    const s = await state(page);
    expect(s.kills, `${id} killed ${s.kills}`).toBeGreaterThanOrEqual(20);
    await snap(page, `m6-${id}`);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('M6: passives change the run and the pause screen shows the build', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=13');
  await startRun(page, 13);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));

  // a passive that pins move speed makes the player travel further in the same ticks
  const travel = async (moveSpeed: number) => {
    await page.evaluate((v) => window.__game.setStat('moveSpeed', v), moveSpeed);
    const before = (await state(page)).player.x;
    await page.evaluate(() => window.__game.setInput(1, 0));
    await stepResolving(page, 120);
    const after = (await state(page)).player.x;
    await page.evaluate(() => window.__game.setInput(0, 0));
    return after - before;
  };
  const slow = await travel(1);
  const fast = await travel(1.5);
  expect(fast).toBeGreaterThan(slow * 1.4);

  await page.evaluate(() => {
    window.__game.giveWeapon('guidedLaser', 3);
    window.__game.giveWeapon('railgun', 2);
    window.__game.giveWeapon('orbitalDrones', 5);
    window.__game.giveWeapon('empField', 2);
    window.__game.givePassive('reactorCore', 3);
    window.__game.givePassive('nanoArmor', 2);
  });
  const build = await state(page);
  expect(build.weapons).toHaveLength(5);
  expect(build.passives).toHaveLength(2);
  expect(build.stats.armor).toBe(2);

  await page.evaluate(() => window.__game.pause());
  await waitScene(page, 'pause');
  expect((await state(page)).phase).toBe('paused');
  const scenes = await page.evaluate(() => window.__game.activeScenes());
  expect(scenes).toContain('Pause');
  expect(scenes.indexOf('Pause')).toBeGreaterThan(scenes.indexOf('Hud'));
  await snap(page, 'm6-pause');

  expect(await page.evaluate(() => window.__game.ui.press('pause.resume'))).toBe(true);
  await waitScene(page, 'game');
  expect((await state(page)).phase).toBe('running');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('M6: Escape pauses and resumes from the keyboard', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=17');
  await startRun(page, 17);
  await waitScene(page, 'game');

  await page.keyboard.press('Escape');
  await waitScene(page, 'pause');
  await page.keyboard.press('Escape');
  await waitScene(page, 'game');
  expect((await state(page)).phase).toBe('running');

  expect(errors, errors.join('\n')).toEqual([]);
});
