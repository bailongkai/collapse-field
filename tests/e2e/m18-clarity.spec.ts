import { test, expect } from '@playwright/test';
import { openGame, startRun, waitScene, snap, step, realWait, events, hudToasts } from './helpers';

test('clarity: the comfort switches are saved and the launch screen explains the challenge', async ({ page }) => {
  const errors = await openGame(page, '?test=1');
  expect(await page.evaluate(() => window.__game.ui.press('menu.settings'))).toBe(true);
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'settings.shake'));
  expect(await page.evaluate(() => window.__game.save.get().settings)).toMatchObject({ shake: true, damageNumbers: true });
  await page.evaluate(() => {
    window.__game.ui.press('settings.shake');
    window.__game.ui.press('settings.damageNumbers');
  });
  expect(await page.evaluate(() => window.__game.save.get().settings)).toMatchObject({ shake: false, damageNumbers: false });
  await snap(page, 'clarity-settings');
  // every button of the taller panel is still on the screen
  const view = await page.evaluate(() => window.__game.viewSize());
  for (const b of await page.evaluate(() => window.__game.ui.buttons())) {
    expect(b.y + b.hitH / 2, `${b.id} overflows the bottom`).toBeLessThanOrEqual(view.height + 1);
    expect(b.y - b.hitH / 2, `${b.id} overflows the top`).toBeGreaterThanOrEqual(-1);
  }
  await page.evaluate(() => window.__game.ui.press('settings.back'));

  // closing the settings restarts the menu, and Phaser does that on a frame boundary: press the
  // menu that is coming, not the one that is leaving
  await page.waitForFunction(() => !window.__game.ui.buttons().some((b) => b.id === 'settings.back'));
  await realWait(200);
  await page.waitForFunction(() => window.__game.ui.press('menu.start'));
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'launch.start'));
  await page.evaluate(() => window.__game.ui.press('launch.curse.20'));
  await snap(page, 'clarity-launch');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('clarity: no damage numbers are drawn once they are switched off', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=61');
  await page.evaluate(() => window.__game.ui.press('menu.settings'));
  await page.waitForFunction(() => window.__game.ui.buttons().some((b) => b.id === 'settings.damageNumbers'));
  await page.evaluate(() => window.__game.ui.press('settings.damageNumbers'));
  await page.evaluate(() => window.__game.ui.press('settings.back'));
  await startRun(page, 61);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.giveWeapon('empField', 5);
    window.__game.spawn('infected', 30, { radius: 60 });
  });
  await step(page, 90);
  const s = await page.evaluate(() => window.__game.getState());
  expect(s.kills, 'nothing was hit, so the test proves nothing').toBeGreaterThan(0);
  expect(s.counts.dmgNumbers).toBe(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('clarity: a collapse is announced, drawn, and takes its cache when nobody comes', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=62');
  await startRun(page, 62);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.setStat('moveSpeed', 0);
    // the station's events are sorted by time: the rush at 90 s, then the first collapse
    window.__game.triggerEvent(1);
  });
  await step(page, 30);
  const during = await page.evaluate(() => window.__game.getState().pickups.map((p) => p.defId));
  expect(during).toContain('riftCache');
  await snap(page, 'clarity-collapse');
  await step(page, 60 * 10);
  const after = await page.evaluate(() => window.__game.getState());
  expect(after.pickups.map((p) => p.defId)).not.toContain('riftCache');
  expect(after.chestsOpened).toBe(0);
  expect(after.phase).toBe('running');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('clarity: the clock gives way to the objective once the final boss is on the field', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=63');
  await startRun(page, 63);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.spawnFinal();
  });
  await step(page, 10);
  expect((await page.evaluate(() => window.__game.getState())).finalSpawned).toBe(true);
  await snap(page, 'clarity-final');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('clarity: losing focus pauses the run, the way hiding the tab does', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=64');
  await startRun(page, 64);
  await waitScene(page, 'game');
  expect((await page.evaluate(() => window.__game.getState())).phase).toBe('running');
  // what the browser sends when a click lands outside the game's iframe
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitScene(page, 'pause');
  expect((await page.evaluate(() => window.__game.getState())).phase).toBe('paused');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('clarity: a resize while paused reaches the battlefield too', async ({ page }) => {
  // On itch.io, Esc in fullscreen opens the pause menu and shrinks the frame at the same moment. The
  // paused battlefield used to keep its old zoom, and the floor filled only part of the screen.
  const errors = await openGame(page, '?test=1&seed=65');
  await startRun(page, 65);
  await waitScene(page, 'game');
  await page.keyboard.press('Escape');
  await waitScene(page, 'pause');
  for (const [w, h] of [[1440, 900], [960, 540], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await realWait(400);
    const cam = await page.evaluate(() => ({
      zoom: (window.__game.phaser.scene.getScene('Game') as Phaser.Scene).cameras.main.zoom,
      scale: window.__game.viewSize().renderScale,
    }));
    expect(cam.zoom, `battlefield zoom at ${w}x${h}`).toBeCloseTo(cam.scale, 3);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('clarity: going fullscreen says how to pause without leaving it', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 }, screen: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = await openGame(page, '?test=1&seed=66');
  await startRun(page, 66);
  await waitScene(page, 'game');
  expect(await events(page)).not.toContain('hint:fullscreen');
  // the frame grows to the size of the screen, as itch's fullscreen button makes it
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForFunction(() => window.__game.getEvents().includes('hint:fullscreen'));
  expect(errors, errors.join('\n')).toEqual([]);
  await ctx.close();
});

test('clarity: a collapse warning is not pushed off the screen by the banners that follow it', async ({ page }) => {
  // The HUD had one toast slot and the last message won: the fullscreen hint overwrote the collapse
  // warning in the evaluation's own screenshot. Two slots, and a lower priority never takes a higher
  // one's room. The station's events are sorted by time: 0 the rush at 90 s, 1 the collapse, 2 the
  // first sentinel. Toasts only play in real time (step() skips the visual branch), so the run runs.
  const errors = await openGame(page, '?test=1&seed=67');
  await startRun(page, 67);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.godMode(true);
    window.__game.setStat('moveSpeed', 0);
    window.__game.triggerEvent(1);
  });
  await page.waitForFunction(() => (window.__game.phaser.scene.getScene('Hud') as unknown as { toasts(): string[] }).toasts().length > 0);
  const warn = (await hudToasts(page))[0];
  expect(warn).toBe(await page.evaluate(() => window.__game.i18n.t('toast.collapseWarn')));
  // a sentinel and a rush both announce themselves now, and neither displaces the warning
  await page.evaluate(() => window.__game.triggerEvent(2));
  await realWait(120);
  const withElite = await hudToasts(page);
  expect(withElite).toContain(warn);
  expect(withElite.some((t) => t !== warn && t.length > 0), 'the sentinel was not announced').toBe(true);
  await page.evaluate(() => window.__game.triggerEvent(0));
  await realWait(120);
  const withRush = await hudToasts(page);
  expect(withRush).toContain(warn);
  expect(withRush).toHaveLength(2);
  expect(withRush.find((t) => t !== warn)).not.toBe(withElite.find((t) => t !== warn));
  expect(errors, errors.join('\n')).toEqual([]);
});

test('clarity: a death is held for a beat, then the results say what did it', async ({ page }) => {
  // the results used to start on the frame health reached zero: no body, no pause, no cause
  const errors = await openGame(page, '?test=1&seed=68');
  await startRun(page, 68);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    window.__game.setTimeScale(0);
    window.__game.spawn('mech', 30, { ring: true, radius: 40 });
  });
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__game.hasRun() && window.__game.getState().phase === 'running')); i++) await step(page, 60);
  // the run is over and the battlefield is still on screen
  const held = await page.evaluate(() => (window.__game.hasRun() ? window.__game.getState() : null));
  expect(held, 'the results came up on the very frame of the death').not.toBeNull();
  expect(held!.phase).toBe('ended');
  expect(held!.ended).toBe('died');
  expect(held!.killedBy).toBe('mech');
  const sceneAt = await page.evaluate(() => window.__game.scene());
  expect(sceneAt).toBe('game');
  await snap(page, 'clarity-death');
  await waitScene(page, 'results');
  const names = await page.evaluate(() => {
    type Node = { text?: string; list?: Node[] };
    const scene = window.__game.phaser.scene.getScene('Results') as unknown as { children: { list: Node[] } };
    const out: string[] = [];
    const walk = (n: Node): void => {
      if (n.text) out.push(n.text);
      for (const c of n.list ?? []) walk(c);
    };
    for (const c of scene.children.list) walk(c);
    return out;
  });
  expect(names).toContain(await page.evaluate(() => window.__game.i18n.t('results.killedBy')));
  expect(names).toContain(await page.evaluate(() => window.__game.i18n.t('enemy.mech.name')));
  expect(errors, errors.join('\n')).toEqual([]);
});

test('clarity: a railgun pointed away from the crowd for five seconds earns a turn hint, and only then', async ({ page }) => {
  const errors = await openGame(page, '?test=1&seed=69');
  await startRun(page, 69);
  await waitScene(page, 'game');
  await page.evaluate(() => {
    const g = window.__game;
    g.godMode(true);
    g.clearEnemies();
    g.giveWeapon('railgun', 1);
    g.setInput(1, 0); // face right
    g.step(1);
    g.setInput(0, 0);
    g.spawn('drone', 6, { x: -140, y: 0 }); // the crowd is behind
    g.step(1);
    g.setTimeScale(0); // the field stands still; the hint is the view's clock
  });
  await realWait(2500);
  expect(await events(page)).not.toContain('hint:turn');
  // the hold is counted in frame deltas, which are clamped, so under four workers five seconds of
  // hold can take well over five seconds of wall clock
  await page.waitForFunction(() => window.__game.getEvents().includes('hint:turn'), undefined, { timeout: 15000 });
  expect(await hudToasts(page)).toContain(await page.evaluate(() => window.__game.i18n.t('toast.turn')));
  await snap(page, 'clarity-turn-hint');

  // facing the crowd, it never comes
  await page.evaluate(() => {
    const g = window.__game;
    g.setTimeScale(1);
    g.setInput(-1, 0);
    g.step(1);
    g.setInput(0, 0);
    g.setTimeScale(0);
  });
  const before = (await events(page)).filter((e) => e === 'hint:turn').length;
  await realWait(6000);
  expect((await events(page)).filter((e) => e === 'hint:turn').length).toBe(before);
  expect(errors, errors.join('\n')).toEqual([]);
});
