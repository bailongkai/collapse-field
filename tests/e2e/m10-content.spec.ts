import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, stepResolving, events, waitScene } from './helpers';

test('content: a supply chest evolves a maxed weapon whose passive is owned', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=201');
  await startRun(page, 201);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
    window.__game.giveWeapon('plasmaBlade', 8);
    window.__game.givePassive('reactorCore', 1);
    window.__game.spawnPickup('chest');
  });
  const chest = (await state(page)).pickups.find((p) => p.defId === 'chest');
  expect(chest).toBeDefined();
  await page.evaluate((c) => window.__game.setPlayerPos(c.x, c.y), { x: chest!.x, y: chest!.y });
  await stepResolving(page, 4);

  expect(await events(page)).toContain('evolve:annihilationBlade');
  const s = await state(page);
  expect(s.weapons.map((w) => w.id)).toContain('annihilationBlade');
  expect(s.weapons.map((w) => w.id)).not.toContain('plasmaBlade');

  // the evolved blade is a visibly different weapon
  await page.evaluate(() => window.__game.spawn('robot', 40, { radius: 120 }));
  await page.evaluate(() => window.__game.setTimeScale(1));
  await page.waitForTimeout(600);
  await snap(page, 'content-evolved');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('content: the mid-run field has spitters firing and dashers lunging', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=202');
  await startRun(page, 202);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
    window.__game.setStat('moveSpeed', 0);
    window.__game.spawn('spitter', 6, { radius: 300 });
    window.__game.spawn('dasher', 6, { radius: 320 });
  });
  await stepResolving(page, 60 * 5);
  const s = await state(page);
  expect(s.enemies.byBehavior.ranged).toBeGreaterThan(0);
  expect(s.enemies.byBehavior.dasher).toBeGreaterThan(0);
  // spitters have been shooting: hostile bolts are part of the projectile count
  expect(s.counts.projectiles).toBeGreaterThan(0);
  await snap(page, 'content-newenemies');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('content: the boss telegraphs its charge and summons reinforcements', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=203');
  await startRun(page, 203);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
    window.__game.setStat('moveSpeed', 0);
    window.__game.spawnBoss();
  });
  const before = (await state(page)).counts.enemies;
  await stepResolving(page, 60 * 12);
  const after = await state(page);
  expect(after.enemies.byBehavior.boss).toBe(1);
  expect(after.counts.enemies).toBeGreaterThan(before);
  await snap(page, 'content-boss');
  expect(errors, errors.join('\n')).toEqual([]);
});
