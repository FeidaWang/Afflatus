import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  createMsiArchive,
  createWorldCupArchive,
  normalizePersonName,
} from '../src/lib/stats/archiveAdapters.js';

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8'));
}

describe('stats archive adapters', () => {
  it('adapts MSI without changing the recorded outcome totals', async () => {
    const data = await fixture('leagues-data.json');
    const archive = createMsiArchive(data);

    expect(archive.scored).toHaveLength(data.record.resolved);
    expect(archive.scored.filter((record) => record.ok)).toHaveLength(data.record.correctOutcome);
    expect(archive.scored.filter((record) => record.exact)).toHaveLength(data.record.exactScore);
    expect(archive.actualChampion).toBeNull();
  });

  it('keeps World Cup full-tournament headlines separate from detailed matches', async () => {
    const data = await fixture('games-data.json');
    const archive = createWorldCupArchive(data);

    expect(archive.headline).toEqual({
      total: data.record.resolved,
      successes: data.record.correctOutcome,
      exact: data.record.exactScore,
    });
    expect(archive.scored).toHaveLength(data.matches.length);
    expect(archive.scored.length).toBeLessThan(archive.headline.total);
  });

  it('normalizes display separators for winner matching', () => {
    expect(normalizePersonName('Rodri · Spain')).toBe('rodri spain');
    expect(normalizePersonName('Rodri/Spain')).toBe('rodri spain');
  });
});
