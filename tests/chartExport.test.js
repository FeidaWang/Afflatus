import { describe, it, expect } from 'vitest';
import { chartLink, chartSVG } from '../src/ui/chartExport.js';

const fixture = {
  title: 'Public <model>', date: 'FY2025–26; exact cutoff undisclosed; method 2026-08-08',
  source: 'Published summary', note: 'MODEL ESTIMATE · not audited',
  series: [{ id: 'return', label: 'Estimate', unit: '%', symbol: '━' }],
  records: [{ label: 'A', series: 'return', value: -22, unit: '%', status: 'Estimate', accountBalance: 'PRIVATE-123' },
    { label: 'B', series: 'return', value: null, unit: '%', status: 'No data' },
    { label: 'C', series: 'return', value: 0, unit: '%', status: 'Estimate' }],
  labels: { hidden: 'Hidden', scale: 'Scale', missing: 'No data', missingNote: 'Missing is not zero' },
};
describe('public chart sharing', () => {
  it('strips private query and selection state from links', () => {
    expect(chartLink({ href: 'https://feida.au/zh/portfolio.html?account=secret&token=private#position-123' }, 'chart-cycles'))
      .toBe('https://feida.au/zh/portfolio.html#chart-cycles');
    expect(() => chartLink({ href: 'https://feida.au/' }, 'account-secret')).toThrow();
  });
  it('exports metadata and marks from an explicit field allowlist', () => {
    const svg = chartSVG(fixture);
    for (const word of ['FY2025', 'Published summary', 'MODEL ESTIMATE', '-22', 'No data', 'Missing is not zero', 'Public &lt;model&gt;']) expect(svg).toContain(word);
    for (const word of ['PRIVATE-123', 'accountBalance', '<foreignObject', '<script', '<animate', 'NaN']) expect(svg).not.toContain(word);
    expect(svg.match(/<rect /g)).toHaveLength(3); // background, negative bar, zero bar; no missing mark
  });
  it('retains original scales and clear identities for filtered exports', () => {
    const svg = chartSVG({ ...fixture, hidden: new Set(['return']) });
    expect(svg).toContain('Estimate (%) · Hidden');
    expect(svg).toContain('Scale: -25 — 0 %');
    expect(svg).not.toContain('A · -22');
  });
});
