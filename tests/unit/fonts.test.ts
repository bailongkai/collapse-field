import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { zhCN } from '../../src/i18n/zh-CN';
import { en } from '../../src/i18n/en';

/**
 * The two bundled faces are subsets, cut to the game's strings by scripts/subset-fonts.py. A string
 * added after the cut draws its new characters in a system face instead, one glyph at a time, and
 * nothing else notices: the first cut missed 147 characters, the game's own title among them.
 */

const HEADING = 'public/assets/fonts/CFHeading-subset.ttf';
const DISPLAY = 'public/assets/fonts/CFDisplay-subset.ttf';

interface Table {
  offset: number;
  length: number;
}

function tables(buf: Buffer): Record<string, Table> {
  const n = buf.readUInt16BE(4);
  const out: Record<string, Table> = {};
  for (let i = 0; i < n; i++) {
    const rec = 12 + i * 16;
    out[buf.toString('latin1', rec, rec + 4)] = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
  }
  return out;
}

/** Code points the font maps, from its Unicode cmap subtable (format 4 or 12). */
function codepoints(path: string): Set<number> {
  const buf = readFileSync(path);
  const cmap = tables(buf).cmap.offset;
  const count = buf.readUInt16BE(cmap + 2);
  const out = new Set<number>();
  for (let i = 0; i < count; i++) {
    const rec = cmap + 4 + i * 8;
    const platform = buf.readUInt16BE(rec);
    const sub = cmap + buf.readUInt32BE(rec + 4);
    const format = buf.readUInt16BE(sub);
    if (platform !== 3 && platform !== 0) continue;
    if (format === 12) {
      const groups = buf.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const at = sub + 16 + g * 12;
        for (let c = buf.readUInt32BE(at); c <= buf.readUInt32BE(at + 4); c++) out.add(c);
      }
    } else if (format === 4) {
      const segs = buf.readUInt16BE(sub + 6) / 2;
      const ends = sub + 14;
      const starts = ends + segs * 2 + 2;
      for (let s = 0; s < segs; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        const start = buf.readUInt16BE(starts + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) out.add(c);
      }
    }
  }
  return out;
}

/** Every name record's text, keyed by name id, from the Windows Unicode entries. */
function names(path: string): { id: number; text: string }[] {
  const buf = readFileSync(path);
  const name = tables(buf).name.offset;
  const count = buf.readUInt16BE(name + 2);
  const strings = name + buf.readUInt16BE(name + 4);
  const out: { id: number; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    const rec = name + 6 + i * 12;
    if (buf.readUInt16BE(rec) !== 3) continue;
    const at = strings + buf.readUInt16BE(rec + 10);
    const len = buf.readUInt16BE(rec + 8);
    const chars: string[] = [];
    for (let j = 0; j < len; j += 2) chars.push(String.fromCharCode(buf.readUInt16BE(at + j)));
    out.push({ id: buf.readUInt16BE(rec + 6), text: chars.join('') });
  }
  return out;
}

describe('the bundled fonts', () => {
  it('the heading face draws every character of every string', () => {
    const have = codepoints(HEADING);
    const missing = new Set<string>();
    for (const table of [zhCN, en]) {
      for (const s of Object.values(table)) {
        // placeholders are replaced before drawing; only what the player reads has to be there
        for (const ch of String(s).replace(/\{\w+\}/g, '')) {
          if (ch === '\n' || ch === ' ') continue;
          if (!have.has(ch.codePointAt(0)!)) missing.add(ch);
        }
      }
    }
    expect([...missing].join(''), 'run python3 scripts/subset-fonts.py').toBe('');
  });

  it('the display face draws letters, digits and the punctuation of times, percentages and labels', () => {
    // what the display face is used for; Orbitron itself has no glyph for a few symbols such as ^,
    // which is the upstream font and not the subset
    const have = codepoints(DISPLAY);
    const wanted = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:%+-./,!?()\'';
    const missing = [...wanted].filter((ch) => !have.has(ch.codePointAt(0)!));
    expect(missing.join('')).toBe('');
  });

  it('neither presents a name its licence reserves', () => {
    // clause 3 of the OFL: a Modified Version, which a subset is, may not use a Reserved Font Name.
    // The copyright notice (name id 0) must keep them; everything else must not show them.
    for (const path of [HEADING, DISPLAY]) {
      for (const { id, text } of names(path)) {
        if (id === 0) continue;
        for (const reserved of ['Smiley', '得意黑', 'Orbitron']) expect(text, `${path} name ${id}`).not.toContain(reserved);
      }
    }
  });
});
