import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateLeaguesData } from '../src/lib/validateLeaguesData.js';
import { validateGamesData } from '../src/lib/validateGamesData.js';
import { validateNovelsIndex, validateNovelBook } from '../src/lib/validateNovelsData.js';

/* U21 Phase 1 (rfcs/2026-07-12-u21-phase1-tech-audit.md §2.3/§2.7): these
   validators are the CI publish gate for unattended scheduled tasks. Two
   things matter equally here: they must accept today's real, already-live
   data (no false positives blocking a legitimate deploy), and they must
   catch the specific bug classes the RFC found by inspection (aggregate
   drift, exact-without-outcome-correct). */

describe('validateLeaguesData', () => {
  it('accepts the real public/leagues-data.json as-is', () => {
    const data = JSON.parse(readFileSync('public/leagues-data.json', 'utf8'));
    const { ok, errors } = validateLeaguesData(data);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('rejects record.exactScore that overcounts vs. series[] (§2.3 drift)', () => {
    const data = {
      tournament: 'T', updated: '2026-01-01',
      series: [
        { id: 's1', home: 'A', away: 'B', opus: 'home', conf: 0.6, opusScore: '3-0', result: { home: 3, away: 0 } },
      ],
      record: { resolved: 1, correctOutcome: 1, exactScore: 5 },
    };
    const { ok, errors } = validateLeaguesData(data);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('exactScore'))).toBe(true);
  });

  it('rejects an unresolvable opus value', () => {
    const data = {
      tournament: 'T', updated: '2026-01-01',
      series: [{ id: 's1', home: 'A', away: 'B', opus: 'draw', conf: 0.6 }],
    };
    const { ok, errors } = validateLeaguesData(data);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('opus'))).toBe(true);
  });
});

describe('validateGamesData', () => {
  it('accepts the real public/games-data.json as-is', () => {
    const data = JSON.parse(readFileSync('public/games-data.json', 'utf8'));
    const { ok, errors } = validateGamesData(data);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('rejects a log entry with exact=true but ok=false', () => {
    const data = {
      tournament: 'T', updated: '2026-01-01',
      record: { resolved: 1, correctOutcome: 0, exactScore: 0, log: [{ id: 'm1', ok: false, exact: true }] },
    };
    const { ok, errors } = validateGamesData(data);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('exact must imply ok'))).toBe(true);
  });

  it('rejects exactScore exceeding correctOutcome', () => {
    const data = { tournament: 'T', updated: '2026-01-01', record: { resolved: 5, correctOutcome: 2, exactScore: 3, log: [] } };
    const { ok, errors } = validateGamesData(data);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('exceeds record.correctOutcome'))).toBe(true);
  });
});

describe('validateNovelsIndex / validateNovelBook (U21 §2.5 split)', () => {
  it('accepts a well-formed index', () => {
    const idx = { novels: [{ id: 'a', novel: { title: 'X' }, chapterCount: 3 }] };
    expect(validateNovelsIndex(idx)).toEqual({ ok: true, errors: [] });
  });

  it('rejects an index that embeds chapter bodies (defeats the point of the split)', () => {
    const idx = { novels: [{ id: 'a', novel: { title: 'X' }, chapterCount: 3, chapters: [{}] }] };
    const { ok, errors } = validateNovelsIndex(idx);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('must not embed chapter bodies'))).toBe(true);
  });

  it('accepts a well-formed book file', () => {
    const book = { id: 'a', chapters: [{ id: 'c1', title: 'Ch1', blocks: [{ type: 'p', text: 'hi' }] }] };
    expect(validateNovelBook(book)).toEqual({ ok: true, errors: [] });
  });

  it('accepts a numeric chapter.id (the real data shape — chapter ids are ints like 1, 2, 3)', () => {
    const book = { id: 'a', chapters: [{ id: 1, title: 'Ch1', blocks: [{ type: 'p', text: 'hi' }] }] };
    expect(validateNovelBook(book)).toEqual({ ok: true, errors: [] });
  });

  it('accepts the real split public/novels/*.json files as-is', () => {
    const index = JSON.parse(readFileSync('public/novels-index.json', 'utf8'));
    const idxResult = validateNovelsIndex(index);
    expect(idxResult.errors).toEqual([]);
    expect(idxResult.ok).toBe(true);
    for (const n of index.novels) {
      const book = JSON.parse(readFileSync(`public/novels/${n.id}.json`, 'utf8'));
      const { ok, errors } = validateNovelBook(book);
      expect(errors).toEqual([]);
      expect(ok).toBe(true);
    }
  });
});
