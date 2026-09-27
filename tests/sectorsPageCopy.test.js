// tests/sectorsPageCopy.test.js — static copy must agree with the data it sits next to (final review, Task 15).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('sectors.html', 'utf8');
const industry = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
const attr = (re) => html.match(re)?.[1];

describe('sectors page copy', () => {
  it('dates the modules fed by the 2026-09-27 snapshot as 27 September', () => {
    // #editorialIntro eyebrow, the evidence wall and the model board all render the 09-27 snapshot.
    expect(attr(/<p class="editorialEyebrow" data-en="(THE RESEARCH[^"]*)"/)).toMatch(/27 SEPTEMBER 2026/);
    expect(attr(/data-en="(SELECTED MODEL EVIDENCE[^"]*)"/)).toMatch(/2026-09-27/);
    expect(attr(/class="frontierEditorialNote" data-en="([^"]*)"/)).toMatch(/27 September 2026/);
    // The no-script fallback table is the 14-model 09-23 snapshot and keeps its own date.
    expect(attr(/data-en="(2026-09-2\d · Artificial Analysis[^"]*)"/)).toMatch(/^2026-09-23/);
  });
  it('does not claim every globe company is US-listed', () => {
    const unlisted = industry.companies.filter((c) => !['listed', 'adr'].includes(c.listing));
    expect(unlisted.length).toBeGreaterThan(2);
    const lede = attr(/<h2 id="industryGlobeTitle"[^>]*>[^<]*<\/h2>\s*<p data-en="([^"]*)"/);
    expect(lede).not.toMatch(/^Every company/);
    expect(lede).toMatch(/[Hh]ollow markers/);
  });
});
