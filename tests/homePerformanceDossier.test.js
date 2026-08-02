import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const copy = readFileSync('src/data/content.js', 'utf8');

describe('FY2025–26 homepage performance dossier', () => {
  it('keeps realized facts separate from modeled portfolio statistics', () => {
    expect(html).toContain('CLOSED PROFITABLE SUBSET');
    expect(html).toContain('+$5,782.97');
    expect(html).toContain('+2.78%');
    expect(html).toContain('ANNUALIZED / 02');
    expect(html).toContain('+261.2%');
    expect(html).toContain('MODEL / 03');
    expect(html).toContain('37.5–41.4%');
    expect(html).toContain('method-dependent estimates');
  });

  it('publishes all five supplied profitable trade cycles', () => {
    for (const ticker of ['AVGO', 'DRAM', 'SNDK', 'NVO', 'XLE']) {
      expect(html).toContain(`<span>${ticker}</span>`);
    }
    for (const annualized of ['+260.4%', '+208.5%', '+257.9%', '+32.6%', '+85.6%']) {
      expect(html).toContain(annualized);
    }
  });

  it('removes the incompatible synthetic equity curve and legacy headline metrics', () => {
    expect(html).not.toContain('id="kchart"');
    expect(html).not.toContain('data-counter="38.66"');
    expect(copy).not.toContain("sf:['vs SPX +9.4");
  });
});
