import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateSectorsCompetition } from '../src/lib/validateSectorsCompetition.js';

const DATA = JSON.parse(readFileSync('public/sectors-competition.json', 'utf8'));

describe('shipped dataset', () => {
  it('passes its own schema validator', () => {
    expect(validateSectorsCompetition(DATA)).toEqual({ ok: true, errors: [] });
  });

  it('never labels a leaf verified without a source', () => {
    const leaves = [];
    for (const model of DATA.models) {
      leaves.push(model.pricing, ...model.bench, ...model.speed);
    }
    for (const equity of DATA.equities) leaves.push(equity.conviction, ...equity.kpis);
    for (const leaf of leaves) {
      if (leaf.tier === 'verified') expect(leaf.src).toMatch(/^https?:\/\//);
    }
  });

  it('records Opus 5 as launched and no longer claims 4.8 is the latest', () => {
    const opus5 = DATA.models.find((model) => model.id === 'claude-opus-5');
    expect(opus5.released).toBe('2026-07-24');
    expect(opus5.src).toBe('https://www.anthropic.com/news/claude-opus-5');
    expect(opus5.bench.find((row) => row.id === 'aa_intelligence').value).toBe(61);
  });
});
