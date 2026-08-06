import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateDailyTransits } from '../src/lib/validateDailyTransits.js';
import { validateSectorsEcosystem } from '../src/lib/validateSectorsEcosystem.js';

const fixture = (path) => JSON.parse(readFileSync(path, 'utf8'));

describe('scheduled data artifact validators', () => {
  it('accepts the current Arena ledger', () => {
    expect(validateArenaLedger(fixture('public/arena-ledger.json'))).toEqual({ ok: true, errors: [] });
  });

  it('requires an explicit prediction coverage date', () => {
    const predlog = fixture('public/arena-predlog.json');
    expect(validateArenaPredlog(predlog)).toEqual({ ok: true, errors: [] });
    const { checkedThrough: _checkedThrough, ...withoutCoverage } = predlog;
    expect(validateArenaPredlog(withoutCoverage).ok).toBe(false);
  });

  it('accepts the generated transit and sectors ecosystem shapes', () => {
    expect(validateDailyTransits(fixture('public/transits-daily.json')).ok).toBe(true);
    expect(validateSectorsEcosystem(fixture('public/sectors-ecosystem.json')).ok).toBe(true);
  });
});
