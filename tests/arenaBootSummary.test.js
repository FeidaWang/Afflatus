import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arenaBootSummary } from '../src/lib/arenaBootSummary.js';

describe('arenaBootSummary', () => {
  it('reads the current Season 2 S/P/T ledger contract', () => {
    const ledger = JSON.parse(readFileSync('public/arena-ledger.json', 'utf8'));
    expect(arenaBootSummary(ledger)).toMatchObject({
      primary: { id: 'S', equity: ledger.models.S.equity },
      secondary: [
        { id: 'P', equity: ledger.models.P.equity },
        { id: 'T', equity: ledger.models.T.equity },
      ],
      day: ledger.day,
      season: 2,
    });
  });

  it('fails honestly instead of rendering a question mark for an old schema', () => {
    expect(() => arenaBootSummary({ day: 1, season: 1, models: { A: { equity: 10_000 } } }))
      .toThrow(/S\/P\/T/);
  });
});
