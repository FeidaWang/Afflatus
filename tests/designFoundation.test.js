import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const foundation = readFileSync('public/styles/afflatus-foundation.css', 'utf8');
const showcase = readFileSync('src/showcase/showcase.css', 'utf8');
const cinematicEntry = readFileSync('index.html', 'utf8');
const legacyEntry = readFileSync('portfolio.html', 'utf8');

describe('M02 design foundation', () => {
  it('owns the semantic color, typography, layout, focus, and layering contracts', () => {
    for (const token of [
      '--af-void', '--af-hull', '--af-command', '--af-ion',
      '--af-font-sans', '--af-font-serif', '--af-font-mono', '--af-font-signature',
      '--shell-max', '--reading-max', '--gutter', '--section-y',
      '--af-focus-ring', '--af-duration-base', '--af-z-header', '--af-z-modal',
    ]) {
      expect(foundation).toContain(token);
    }
    expect(foundation).toMatch(/:focus-visible\s*\{[^}]*outline:/s);
    expect(foundation).not.toMatch(/:focus-visible\s*\{[^}]*transition:/s);
  });

  it('loads before either home experience and keeps showcase aliases temporary', () => {
    expect(cinematicEntry).toContain('/styles/afflatus-foundation.css');
    expect(legacyEntry).toContain('/styles/afflatus-foundation.css');
    expect(foundation).toContain('body.showcase-page');
    expect(showcase).not.toMatch(/--void:\s*#/);
    expect(showcase).toContain('var(--shell-max)');
    expect(showcase).toContain('var(--gutter)');
    expect(showcase).toContain('var(--af-font-signature)');
    expect(showcase).toContain('var(--af-z-modal)');
  });
});
