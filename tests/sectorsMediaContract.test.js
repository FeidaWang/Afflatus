import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('sectors media contract', () => {
  it('ships the responsive observatory without loading the archived graph or photo wall', () => {
    const css = readFileSync('public/styles/sectors-observatory.css', 'utf8');
    const entry = readFileSync('src/pages/sectors.js', 'utf8');
    expect(css).toContain('.ob-hero');
    expect(css).toMatch(/@media\s*\(max-width:\s*620px\)/);
    expect(css).toContain('prefers-reduced-motion');
    expect(entry).toContain('initObservatory');
    expect(entry).not.toMatch(/graphController|rivalryController|MEDIA_MANIFEST/);
  });
});
