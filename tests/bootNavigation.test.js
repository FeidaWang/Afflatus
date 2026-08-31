import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('boot.html', 'utf8');

describe('boot station navigation', () => {
  it('keeps the asset deck distinct from exiting the simulation', () => {
    expect(html).toMatch(/<a class="station" href="\/portfolio\.html">ASSET DECK/);
    expect(html).toMatch(/<a class="station self" href="\/">EXIT SIM/);
  });
});
