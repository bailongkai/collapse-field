import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { t, setLocale, formatTime, allKeys } from '../../src/i18n';
import { en } from '../../src/i18n/en';

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('i18n', () => {
  it('interpolates {n}', () => {
    setLocale('zh-CN');
    expect(t('hud.level', { n: 7 })).toBe('Lv 7');
    expect(t('levelup.gold', { n: 25 })).toBe('金币 +25');
  });
  it('falls back to zh-CN for keys missing in en', () => {
    setLocale('en');
    expect(t('menu.start')).toBe('Start');
    // the table is complete now, so the fallback is exercised by taking a key away
    const table = en as Record<string, string | undefined>;
    const kept = table['weapon.plasmaBlade.name'];
    delete table['weapon.plasmaBlade.name'];
    try {
      expect(t('weapon.plasmaBlade.name')).toBe('等离子刃');
    } finally {
      table['weapon.plasmaBlade.name'] = kept;
    }
    setLocale('zh-CN');
  });
  it('en covers every key, so the English build has no Chinese in it', () => {
    const missing = allKeys().filter((k) => !(k in en));
    expect(missing, missing.join(', ')).toEqual([]);
  });
  it('en only contains known keys', () => {
    const known = new Set<string>(allKeys());
    for (const k of Object.keys(en)) expect(known.has(k), k).toBe(true);
  });
  it('formats mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65.9)).toBe('01:05');
    expect(formatTime(900)).toBe('15:00');
  });
  it('no CJK characters are hard-coded outside src/i18n', () => {
    const files = walk('src').filter((p) => !p.startsWith(join('src', 'i18n')));
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // strip comments so documentation may use Chinese
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (/[㐀-鿿]/.test(code)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});
