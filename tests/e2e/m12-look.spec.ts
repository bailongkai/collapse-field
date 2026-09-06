import { test, expect } from '@playwright/test';
import { openGame, snap, startRun, state, waitScene, realWait } from './helpers';

test('look: a busy mid-run field with every enemy family on screen', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=301');
  await startRun(page, 301);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.setStat('growth', 0);
    window.__game.setStat('moveSpeed', 0);
    window.__game.giveWeapon('railgun', 5);
    window.__game.giveWeapon('orbitalDrones', 4);
    window.__game.giveWeapon('empField', 3);
    for (const [id, n, r] of [['infected', 24, 300], ['robot', 12, 340], ['mech', 6, 380], ['spitter', 5, 300], ['dasher', 5, 260], ['drone', 16, 420]] as [string, number, number][]) {
      window.__game.spawn(id, n, { radius: r });
    }
    window.__game.spawnBoss();
    window.__game.spawnGems(30, 'green');
  });
  await realWait(1800);
  const s = await state(page);
  expect(s.counts.enemies).toBeGreaterThan(50);
  await snap(page, 'look-field');
  expect(errors, errors.join('\n')).toEqual([]);
});
