import { test, expect, type Page } from '@playwright/test';
import { openGame, startRun, waitScene, state, events, step, snap, press, realWait } from './helpers';

/** Drops a chest on the player and waits for the reveal to be up. */
async function openChest(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.getState();
    g.spawnPickup('chest', s.player.x, s.player.y);
  });
  await step(page, 4);
  await waitScene(page, 'chest');
}

test('chest: opening one stops the world and deals the rewards out one at a time', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=31');
  await startRun(page, 31);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.giveWeapon('guidedLaser', 2);
    window.__game.givePassive('reactorCore', 1);
  });
  const before = await state(page);

  await openChest(page);
  expect((await events(page)).join(' ')).toContain('chest:open');

  // the run is frozen behind the panel: the Game scene is still drawing, but time is not moving
  const during = await page.evaluate(() => ({
    scenes: window.__game.activeScenes(),
    phase: window.__game.getState().phase,
    time: window.__game.getState().time,
  }));
  expect(during.scenes, 'the battlefield should keep rendering behind the reveal').toContain('Game');
  expect(during.scenes).toContain('Chest');
  expect(during.phase).toBe('paused');
  expect(await page.evaluate(() => window.__game.step(60)), 'time moved during the reveal').toBe(0);

  // the rewards were applied before a single pixel moved
  const after = await state(page);
  const levels = (s: typeof after): number => [...s.weapons, ...s.passives].reduce((n, w) => n + w.level, 0);
  expect(levels(after), 'the chest paid out nothing').toBeGreaterThan(levels(before));

  // first press shows the whole stack, second closes and hands the clock back
  await press(page, 'chest.continue');
  await snap(page, 'chest-reveal');
  await press(page, 'chest.continue');
  await waitScene(page, 'game');
  expect((await state(page)).phase).toBe('running');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('chest: an evolution is the last thing the reveal shows', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=32');
  await startRun(page, 32);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    // one level short of maxing, holding the passive the evolution needs
    window.__game.giveWeapon('plasmaBlade', 7);
    window.__game.givePassive('reactorCore', 1);
  });

  await openChest(page);
  await press(page, 'chest.continue');
  await snap(page, 'chest-evolution');
  const ids = await page.evaluate(() => window.__game.getState().weapons.map((w) => w.id));
  expect(ids, 'the chest maxed the blade but never evolved it').toContain('annihilationBlade');
  await press(page, 'chest.continue');
  await waitScene(page, 'game');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('chest: two collected on the same tick are revealed one after the other', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=33');
  await startRun(page, 33);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    const s = window.__game.getState();
    window.__game.spawnPickup('chest', s.player.x, s.player.y);
    window.__game.spawnPickup('bossChest', s.player.x, s.player.y);
  });
  await step(page, 4);
  await waitScene(page, 'chest');

  // Press on until the clock comes back, the way a player does. Counting presses would be a race:
  // scene.stop is queued to a frame boundary, so for the rest of the current one the outgoing
  // reveal is still the active scene and a test that waits for 'chest' matches the one leaving.
  for (let i = 0; i < 12 && (await state(page)).phase !== 'running'; i++) {
    await press(page, 'chest.continue');
    await realWait(60);
  }
  expect((await state(page)).phase, 'the run never came back from the reveals').toBe('running');
  // both chests were really shown, not merged into one
  const opens = (await events(page)).filter((e) => e === 'chest:open').length;
  expect(opens, `only ${opens} reveal(s) played for two chests`).toBe(2);
  expect((await state(page)).chestsOpened).toBe(2);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('chest: a sentinel walks in and leaves one behind', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=34');
  await startRun(page, 34);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.spawn('sentinel', 1, { x: 200, y: 0 });
    window.__game.killAll();
  });
  await step(page, 2);
  const pickups = await page.evaluate(() => window.__game.getState().pickups.map((p) => p.defId));
  expect(pickups, 'the sentinel died without leaving a chest').toContain('chest');
  // and it comes to the player rather than being left where it fell
  await step(page, 60 * 6);
  await waitScene(page, 'chest');
  expect(errors, errors.join('\n')).toEqual([]);
});
