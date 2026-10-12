import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The FY26 record publishes returns and trade counts only; principal,
// transaction values and account balances must never reach the page.
describe('portfolio privacy', () => {
  it.each(['portfolio.html', 'src/pages/portfolioFY26.js'])('%s carries no currency amounts', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/\$[0-9]/);
    expect(source).not.toMatch(/\b(?:AUD|USD)\b/);
  });
});
