import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('third-party notices', () => {
  it('retains the font and research-integration license notices', () => {
    expect(existsSync('THIRD_PARTY_NOTICES.md')).toBe(true);
    const notice = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    expect(notice).toContain('SIL Open Font License');
    expect(notice).toContain('Vibe-Trading research integration');
  });
});
