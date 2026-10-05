import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('sectors.html', 'utf8');
const data = JSON.parse(readFileSync('public/data/sectors-observatory/2026-10-06.json', 'utf8'));

describe('sectors page measurement copy', () => {
  it('dates the research snapshot separately from source publication periods', () => {
    expect(data.snapshot).toBe('2026-10-06');
    expect(html).toContain('Research cut-off: 6 October 2026');
    const investment = data.comparison.find(c => c.id === 'investment');
    expect(investment.note.en).toContain('2025');
    expect(investment.unit.en).toContain('2025');
    expect(html).toContain('Reported · FY2025');
    expect(html).toContain('Official · May 2026');
    for (const source of data.sources) expect(html).toContain(`<time>${source.date}</time>`);
  });
  it('identifies directory counts, IPO reporting and AGI gates without implying stronger evidence', () => {
    expect(html).toContain(`${data.companies.length}`);
    expect(html).toContain('counts do not represent independent parent companies');
    expect(html).toContain('not market shares, capacity or national rankings');
    expect(html).toContain('not a market capitalization');
    expect(html).toContain('neither a countdown nor an estimate of completion');
    expect(data.anthropic.listingStatus).toContain('public terms unverified');
  });
});
