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

test('score: the results name the score against the stage best, and the launch tile shows the best', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=22&lang=zh-CN');
  await page.evaluate(() => window.__game.save.set({ ...window.__game.save.get(), stageBestScore: {}, tutorialDone: true }));
  await page.evaluate(() => window.__game.startRun({ seed: 22 }));
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTime(120);
    window.__game.setLevel(10);
    window.__game.endRun('died');
  });
  await waitScene(page, 'results');
  const texts = await sceneTexts(page, 'Results');
  expect(texts).toContain(await page.evaluate(() => window.__game.i18n.t('results.score')));
  const scoreLine = texts.find((x) => x.includes(' · ') && x.includes('新纪录'));
  expect(scoreLine, texts.join(' | ')).toBeTruthy();
  const score = Number(scoreLine!.split(' · ')[0]);
  expect(score).toBeGreaterThanOrEqual(120 * 10 + 10 * 50);
  expect((await page.evaluate(() => window.__game.save.get())).stageBestScore.station).toBe(score);
  await snap(page, 'm20-results-score');

  // a second, worse run is compared with the first
  await page.evaluate(() => window.__game.startRun({ seed: 23 }));
  await waitScene(page, 'game');
  await page.evaluate(() => window.__game.endRun('died'));
  await waitScene(page, 'results');
  const again = await sceneTexts(page, 'Results');
  expect(again.some((x) => x.includes(`本关最佳 ${score}`))).toBe(true);

  await page.evaluate(() => window.__game.goto('menu'));
  await openLaunch(page);
  const tile = await page.evaluate(() => {
    const scene = window.__game.phaser.scene.getScene('Launch') as unknown as { children: { getByName(n: string): { text: string } | null } };
    return scene.children.getByName('launch.score.station')?.text ?? null;
  });
  expect(tile).toBe(score >= 10000 ? `${(score / 1000).toFixed(1)}k` : String(score));
  await snap(page, 'm20-launch-score');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('shop: an upgrade says what it is worth now and next, a character what its weapon does', async ({ page }) => {
  const errors = await openGame(page, '?test=1&lang=zh-CN');
  await page.evaluate(() => window.__game.save.addGold(500));
  expect(await page.evaluate(() => window.__game.ui.press('menu.shop'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buy.hull' && b.enabled));
  const value = (): Promise<string | null> =>
    page.evaluate(() => {
      const scene = window.__game.phaser.scene.getScene('Shop') as unknown as { children: { getByName(n: string): { text: string } | null } };
      return scene.children.getByName('shop.value.hull')?.text ?? null;
    });
  expect(await value()).toContain('当前 0 → +10%');
  expect(await page.evaluate(() => window.__game.ui.press('shop.buy.hull'))).toBe(true);
  await page.waitForFunction(() => window.__game.save.get().upgrades.hull === 1);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buy.hull'));
  await expect.poll(value).toContain('当前 +10% → +20%');
  const texts = await sceneTexts(page, 'Shop');
  expect(texts.some((x) => x.startsWith('磁轨炮 · 伤害 6.5 · 1.0 秒 · ×2'))).toBe(true);
  await snap(page, 'm20-shop-numbers');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('shop: a row that cannot fit its description still names the stat it raises', async ({ page }) => {
  // the desktop rows fell back to the numbers alone: "now 0 → +10%" beside Hull Plating, and in
  // Chinese the hull, coolant, magnet and the three charge rows said how much but not of what
  for (const lang of ['en', 'zh-CN']) {
    const errors = await openGame(page, `?test=1&lang=${lang}`);
    expect(await page.evaluate(() => window.__game.ui.press('menu.shop'))).toBe(true);
    await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'shop.buy.hull'));
    const rows = await page.evaluate(() => {
      const scene = window.__game.phaser.scene.getScene('Shop') as unknown as { children: { getByName(n: string): { text: string } | null } };
      const labels: Record<string, string> = {
        hull: 'stat.maxHealth', coolant: 'stat.cooldown', magnet: 'stat.magnet', firepower: 'stat.might',
        reroll: 'shop.charge.reroll', skip: 'shop.charge.skip', banish: 'shop.charge.banish',
      };
      return Object.entries(labels).map(([id, key]) => ({
        id,
        text: scene.children.getByName(`shop.value.${id}`)?.text ?? '',
        label: window.__game.i18n.t(key as Parameters<typeof window.__game.i18n.t>[0]),
      }));
    });
    for (const r of rows) expect(r.text, `${lang} ${r.id}`).toContain(r.label);
    expect(errors, errors.join('\n')).toEqual([]);
  }
});
