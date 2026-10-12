import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// public/vendor/black-hole still ships, so its licence notice must stay.
describe('third-party notices', () => {
  it('retains the renderer and star-catalogue license notice', () => {
    expect(existsSync('THIRD_PARTY_NOTICES.md')).toBe(true);
    const notice = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    expect(notice).toContain('Eric Bruneton Black Hole Shader');
    expect(notice).toContain('BSD 3-Clause License');
    expect(notice).toContain('Gaia DR2');
    expect(notice).toContain('Tycho-2');
  });
});
