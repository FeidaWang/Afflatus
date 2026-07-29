import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/styles.css', 'utf8');
const forge = readFileSync('src/scene/alphardForge.js', 'utf8');

describe('home stardrive layout contracts', () => {
  it('does not translate the jump-point stage by a full viewport', () => {
    expect(styles).not.toMatch(/@keyframes\s+stardrivePin/);
    expect(styles).not.toMatch(/translateY\(100svh\)/);
    expect(forge).toContain('const cssPin = false');
  });

  it('keeps the annualized-return value inside a fixed numeric slot', () => {
    expect(styles).toMatch(/\.stardrive \.strip-cell\{[^}]*overflow:hidden/);
    expect(styles).toMatch(/\.stardrive \.strip-value\{[^}]*font-variant-numeric:tabular-nums/);
    expect(styles).not.toMatch(/\.stardrive \.hero-metric \.strip-value\{[^}]*transform:scale/);
  });

  it('normalizes the localized language link decoration', () => {
    expect(styles).toMatch(/\.nav-right #langBtn\{[\s\S]*?text-decoration:none/);
  });
});
