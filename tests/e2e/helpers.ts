import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import type { GameDebugApi, HookRunState } from '../../src/debug/hook';

export type { GameDebugApi, HookRunState };

const SHOT_DIR = 'tests/e2e/screenshots';

export async function openGame(page: Page, query = '?test=1'): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__game?.ready === true, undefined, { timeout: 30_000 });
  return errors;
}

export async function snap(page: Page, name: string): Promise<void> {
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

export function state(page: Page): Promise<HookRunState> {
  return page.evaluate(() => window.__game.getState());
}

export function events(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__game.getEvents());
}

export function sceneName(page: Page): Promise<string> {
  return page.evaluate(() => window.__game.scene());
}

export function press(page: Page, id: string): Promise<boolean> {
  return page.evaluate((i) => window.__game.ui.press(i), id);
}

export function startRun(page: Page, seed = 42): Promise<void> {
  return page.evaluate((s) => window.__game.startRun({ seed: s }), seed);
}

export function step(page: Page, ticks: number): Promise<number> {
  return page.evaluate((n) => window.__game.step(n), ticks);
}

/**
 * Steps the simulation, resolving any level-up offer that opens on the way. Batched stepping stops
 * when the run freezes for a level-up, so tests that just want N ticks of gameplay use this.
 */
export async function stepResolving(page: Page, ticks: number): Promise<number> {
  let done = 0;
  for (let guard = 0; guard < 64 && done < ticks; guard++) {
    done += await step(page, ticks - done);
    if (done >= ticks) break;
    const phase = (await state(page)).phase;
    if (phase !== 'levelup') break;
    await page.evaluate(() => window.__game.pickChoice(0));
  }
  return done;
}

export function ff(page: Page, sec: number): Promise<void> {
  return page.evaluate((s) => window.__game.fastForward(s, { levelUpPolicy: 'first' }), sec);
}

export async function waitScene(page: Page, name: string, timeout = 10_000): Promise<void> {
  await page.waitForFunction((n) => window.__game.scene() === n, name, { timeout });
}

/**
 * Waits until exactly these scenes are active. Phaser defers stopping a scene to the next frame,
 * so an immediate check can still see an overlay that is on its way out.
 */
export async function expectScenes(page: Page, expected: string[], timeout = 5000): Promise<void> {
  await page.waitForFunction(
    (want) => JSON.stringify(window.__game.activeScenes()) === JSON.stringify(want),
    expected,
    { timeout },
  );
}

/**
 * A multi-finger touch session on the canvas. Playwright's touchscreen API only taps, and the
 * virtual stick is driven by dragging while other fingers may be pressing buttons, so the touch
 * events are synthesised here with a correct `touches` list across all active fingers.
 * Coordinates are CSS pixels relative to the viewport.
 */
export class TouchSession {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private run(action: 'start' | 'move' | 'end', id: number, x: number, y: number): Promise<void> {
    return this.page.evaluate(
      ({ action: a, id: identifier, x: cx, y: cy }) => {
        const w = window as unknown as { __touches?: Map<number, { x: number; y: number }> };
        w.__touches ??= new Map();
        const active = w.__touches;
        const canvas = document.querySelector('canvas');
        if (!canvas) throw new Error('no canvas');

        if (a === 'end') active.delete(identifier);
        else active.set(identifier, { x: cx, y: cy });

        const make = (i: number, p: { x: number; y: number }): Touch =>
          new Touch({ identifier: i, target: canvas, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y });
        const all = [...active.entries()].map(([i, p]) => make(i, p));
        const changed = [make(identifier, { x: cx, y: cy })];
        const type = a === 'start' ? 'touchstart' : a === 'move' ? 'touchmove' : 'touchend';
        canvas.dispatchEvent(
          new TouchEvent(type, { touches: all, targetTouches: all, changedTouches: changed, bubbles: true, cancelable: true }),
        );
      },
      { action, id, x, y },
    );
  }

  press(id: number, at: { x: number; y: number }): Promise<void> {
    return this.run('start', id, at.x, at.y);
  }

  async dragTo(id: number, at: { x: number; y: number }, steps = 6): Promise<void> {
    const from = await this.page.evaluate((i) => {
      const w = window as unknown as { __touches?: Map<number, { x: number; y: number }> };
      return w.__touches?.get(i) ?? null;
    }, id);
    if (!from) throw new Error(`touch ${id} is not down`);
    for (let i = 1; i <= steps; i++) {
      await this.run('move', id, from.x + ((at.x - from.x) * i) / steps, from.y + ((at.y - from.y) * i) / steps);
    }
  }

  release(id: number, at: { x: number; y: number }): Promise<void> {
    return this.run('end', id, at.x, at.y);
  }
}

/**
 * Converts a position in game space into viewport pixels on the scaled canvas. The logical width
 * follows the display's aspect ratio, so the scale factor is read from the running game rather
 * than assumed.
 */
export function toScreen(page: Page, gameX: number, gameY: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / window.__game.phaser.scale.width;
      return { x: rect.left + x * scale, y: rect.top + y * scale };
    },
    { x: gameX, y: gameY },
  );
}

export function realWait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
