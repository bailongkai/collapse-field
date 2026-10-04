import { test, expect, type Page } from '@playwright/test';
import { openGame, snap, startRun, state, step, waitScene, press } from './helpers';

/** A full build: six weapons at eight, six passives maxed, so the next offer is a limit break. */
async function fullBuild(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = window.__game;
    for (const id of ['plasmaBlade', 'railgun', 'guidedLaser', 'orbitalDrones', 'empField', 'arcPylons']) g.giveWeapon(id, 8);
    for (const id of ['reactorCore', 'coolingSystem', 'fieldAmp', 'nanoArmor', 'lifeCore', 'stabilizer']) g.givePassive(id, 99);
  });
}

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

test('verbs: a full build is offered verb cards, they read as verbs, and picking one teaches the weapon', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=19&lang=zh-CN');
  await startRun(page, 19);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));
  await page.evaluate(() => window.__game.godMode(true));
  await fullBuild(page);

  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');
  const choices = await page.evaluate(() => window.__game.getChoices());
  expect(choices!.length).toBeGreaterThanOrEqual(3);
  for (const c of choices!) expect(c.kind).toBe('verb');

  const first = choices![0] as { kind: 'verb'; id: string; toStacks: number };
  const texts = await sceneTexts(page, 'LevelUp');
  const behavior = await page.evaluate((id) => {
    const map: Record<string, string> = { plasmaBlade: 'slash', railgun: 'stream', guidedLaser: 'aimed', orbitalDrones: 'orbit', empField: 'aura', arcPylons: 'pylon' };
    return map[id];
  }, first.id);
  const verbName = await page.evaluate((b) => window.__game.i18n.t(`verb.${b}.name`), behavior);
  const verbDesc = await page.evaluate((b) => window.__game.i18n.t(`verb.${b}.desc`), behavior);
  expect(texts.some((s) => s.includes(verbName))).toBe(true);
  expect(texts).toContain(verbDesc);
  expect(texts).toContain('极限突破 · 动词 0 → 1');
  await snap(page, 'm19-verb-cards');

  expect(await press(page, 'levelup.card0')).toBe(true);
  await waitScene(page, 'game');
  const after = await state(page);
  expect(after.verbs[first.id]).toBe(1);
  expect(after.phase).toBe('running');
  expect(await step(page, 30)).toBe(30);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('verbs: once a weapon has learned its verb three times its +% cards come back', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=20');
  await startRun(page, 20);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.setTimeScale(0));
  await page.evaluate(() => window.__game.godMode(true));
  await fullBuild(page);
  await page.evaluate(() => {
    for (const id of ['plasmaBlade', 'railgun', 'guidedLaser', 'orbitalDrones', 'empField', 'arcPylons']) window.__game.setVerb(id, 3);
  });
  await page.evaluate(() => window.__game.triggerLevelUp());
  await waitScene(page, 'levelup');
  const choices = await page.evaluate(() => window.__game.getChoices());
  for (const c of choices!) expect(c.kind).toBe('limit');
  expect(errors, errors.join('\n')).toEqual([]);
});
