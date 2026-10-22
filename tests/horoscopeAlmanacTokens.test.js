import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { almanacContrastReport, almanacThemes } from '../scripts/check-almanac-contrast.mjs';

const css = readFileSync(new URL('../public/styles/horoscope-almanac.css', import.meta.url), 'utf8');

describe('horoscope almanac tokens (DESIGN.md §4.1)', () => {
  it('ships every DESIGN.md token in both themes', () => {
    const { day, night } = almanacThemes(css);
    const names = ['paper', 'panel', 'ink', 'mid', 'lo', 'lit', 'lit-ink', 'on-lit', 'face', 'top', 'side', 'wood', 'fire', 'earth', 'metal', 'water'];
    for (const name of names) {
      expect(day[name], `day --${name}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(night[name], `night --${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('meets AA for text pairs and matches the documented ratios', () => {
    const failing = almanacContrastReport(css).filter((row) => !row.ok);
    expect(failing).toEqual([]);
  });

  it('scopes every rule to the almanac switch and adds no !important', () => {
    expect(css).not.toMatch(/!important/);
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\{[^}]*\}/g, '').match(/[^{}@]+(?=\{)/g)
      .flatMap((group) => group.split(/,(?![^(]*\))/))
      .map((selector) => selector.trim())
      .filter((selector) => selector && !/^(media|\(|max-width|min-width|prefers)/.test(selector));
    for (const selector of selectors) expect(selector, selector).toMatch(/^html\[data-fx="almanac"\]/);
  });
});
