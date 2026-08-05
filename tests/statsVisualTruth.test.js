import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const script = readFileSync('src/pages/stats.js', 'utf8');
const html = readFileSync('stats.html', 'utf8');

describe('stats visual truth', () => {
  it('renders settled headline values without a false count-up phase', () => {
    expect(script).not.toContain('function countUp');
    expect(script).not.toContain('(time - startedAt) / 850');
    expect(script).toContain('value.textContent = `${decimals == null ? target : target.toFixed(decimals)}${suffix}`');
  });

  it('lets an odd final metric span the mobile summary width', () => {
    expect(html).toContain('.strip .stat:last-child:nth-child(odd){grid-column:1/-1}');
  });
});
