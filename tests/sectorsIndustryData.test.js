// tests/sectorsIndustryData.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateIndustry, LAYERS } from '../src/sectors/industry/industry-core.js';

const data = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
const edge = (id) => data.edges.find((e) => e.id === id);

describe('industry dataset 2026-09-27', () => {
  it('validates', () => expect(validateIndustry(data)).toEqual([]));
  it('fills every layer with at least one tier-1 or tier-2 company', () => {
    for (const layer of LAYERS) {
      expect(data.companies.some((c) => c.layer === layer && c.tier <= 2), layer).toBe(true);
    }
  });
  it('encodes Anthropic × SpaceX as cooperation and competition', () => {
    expect(edge('spcx-ant-colossus').type).toBe('compute');
    expect(edge('ant-spcx-rival').type).toBe('competitor');
  });
  it('marks the Anthropic IPO as a projection, not a fact', () => {
    expect(data.facts.ipo.find((f) => f.id === 'anthropic').status).toBe('projection');
  });
  it('lists only US exchanges for listed/adr companies', () => {
    for (const c of data.companies.filter((x) => ['listed', 'adr'].includes(x.listing))) {
      expect(['NASDAQ', 'NYSE'], c.id).toContain(c.exchange);
    }
  });
});
