import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const PURE_DIRS = ['src/core', 'src/data', 'src/i18n'];

describe('core boundary', () => {
  const files = PURE_DIRS.flatMap((d) => walk(d));
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  it('never imports phaser or references the Phaser namespace', () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (/from\s+['"]phaser['"]/.test(src) || /\bPhaser\./.test(src)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
  it('never uses Math.random', () => {
    const bad = files.filter((f) => /Math\.random/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
