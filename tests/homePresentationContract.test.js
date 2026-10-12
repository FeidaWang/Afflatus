import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('home presentation contract', () => {
  it.each(['index.html', 'portfolio.html'])('%s uses the unified AI_ favicon', (file) => {
    expect(readFileSync(file, 'utf8')).toContain('/favicons/home.svg?v=20261007');
    expect(readFileSync('public/favicons/home.svg', 'utf8')).toContain('<path');
  });
});
