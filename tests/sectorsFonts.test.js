// tests/sectorsFonts.test.js
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('sectors fonts', () => {
  it.each(['newsreader-var', 'hanken-grotesk-var', 'noto-serif-sc-subset'])('%s exists and is small', (f) => {
    const p = `public/assets/fonts/${f}.woff2`;
    expect(existsSync(p)).toBe(true);
    expect(statSync(p).size).toBeLessThan(f.startsWith('noto') ? 400_000 : 150_000);
  });
  it('keeps first paint stable when optional fonts arrive late', () => {
    const css = readFileSync('public/page-turn.css', 'utf8');
    expect(css.match(/@font-face[^}]+font-display:\s*optional/g)?.length).toBeGreaterThanOrEqual(3);
    // page-turn.css already had other optional faces, so also name the three new families.
    for (const family of ['Newsreader', 'Hanken Grotesk', 'Noto Serif SC Subset']) {
      expect(css).toMatch(new RegExp(`@font-face\\{font-family:"${family}"[^}]+font-display:optional`));
    }
  });
});
