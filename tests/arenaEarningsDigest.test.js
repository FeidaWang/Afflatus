import { describe, expect, it } from 'vitest';
import {
  arenaRelevantEarningsSymbols,
  assessArenaEarningsWindow,
  mergeArenaDigestEarnings,
  validateArenaEarningsDigestSupplement,
  validateArenaEarningsInput,
} from '../src/lib/arenaEarningsDigest.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';

const ledger = {
  models: {
    S: { positions: [{ sym: 'WAB' }, { sym: 'T' }] },
    P: { positions: [] },
    T: { positions: [] },
  },
};
const picks = { models: { S: [], P: [], T: [{ sym: 'MU' }] } };
const digest = {
  date: '2026-08-13',
  generatedAt: '2026-08-13T20:35:00.000Z',
  note_en: 'Settled.',
  note_zh: '已结算。',
  books: ['S', 'P', 'T'].map((model) => ({ model, pnlPct: 0, tradesCount: 0, note_en: 'No trade.', note_zh: '无交易。' })),
  tomorrowPicksCount: 0,
  delayed: [],
  earnings: [],
};
const reported = {
  date: '2026-08-13',
  checkedAt: '2026-08-13T21:05:00.000Z',
  items: [{
    symbol: 'MU',
    status: 'reported',
    eventDate: '2026-08-13',
    timing: 'after-market',
    publishedAt: '2026-08-13T20:55:00.000Z',
    sourceType: 'company-ir',
    source: 'Micron Investor Relations',
    url: 'https://investors.micron.com/example',
    headline_en: 'Micron reports results',
    headline_zh: '美光发布财报',
    summary_en: 'Official reported figures and guidance.',
    summary_zh: '官方披露的业绩与指引。',
  }],
};

describe('Arena earnings digest evidence', () => {
  it('limits monitoring to held and same-session sealed-pick symbols', () => {
    expect(arenaRelevantEarningsSymbols(ledger, picks)).toEqual(['MU', 'T', 'WAB']);
    expect(validateArenaEarningsInput(reported, {
      relevantSymbols: arenaRelevantEarningsSymbols(ledger, picks),
      sessionDate: digest.date,
      digestGeneratedAt: reported.checkedAt,
    })).toEqual({ ok: true, errors: [] });
    const unrelated = structuredClone(reported);
    unrelated.items[0].symbol = 'NVDA';
    expect(validateArenaEarningsInput(unrelated, {
      relevantSymbols: arenaRelevantEarningsSymbols(ledger, picks),
      sessionDate: digest.date,
    }).ok).toBe(false);
    const fakeIr = structuredClone(reported);
    fakeIr.items[0].url = 'https://example.com/earnings';
    expect(validateArenaEarningsInput(fakeIr, {
      relevantSymbols: ['MU'], sessionDate: digest.date, digestGeneratedAt: fakeIr.checkedAt,
    }).ok).toBe(false);
  });

  it('accepts only genuinely near-term upcoming earnings', () => {
    const upcoming = structuredClone(reported);
    upcoming.items[0] = { ...upcoming.items[0], status: 'upcoming', eventDate: '2026-08-19' };
    delete upcoming.items[0].publishedAt;
    expect(validateArenaEarningsInput(upcoming, {
      relevantSymbols: ['MU'], sessionDate: '2026-08-13', digestGeneratedAt: upcoming.checkedAt,
    }).ok).toBe(true);
    upcoming.items[0].eventDate = '2026-08-21';
    expect(validateArenaEarningsInput(upcoming, {
      relevantSymbols: ['MU'], sessionDate: '2026-08-13', digestGeneratedAt: upcoming.checkedAt,
    }).ok).toBe(false);
  });

  it('appends a new official report without rewriting settlement content', () => {
    const candidate = mergeArenaDigestEarnings({ digest, input: reported, ledger, picks, now: new Date(reported.checkedAt) });
    expect(validateArenaDigest(candidate)).toEqual({ ok: true, errors: [] });
    expect(validateArenaEarningsDigestSupplement({ baselineDigest: digest, candidateDigest: candidate, ledger, picks }))
      .toEqual({ ok: true, errors: [] });
    expect(candidate.books).toEqual(digest.books);
    expect(candidate.earnings).toHaveLength(1);
  });

  it('rejects stale evidence and any settlement rewrite', () => {
    const stale = structuredClone(reported);
    stale.items[0].publishedAt = '2026-08-13T20:30:00.000Z';
    const staleCandidate = mergeArenaDigestEarnings({ digest, input: stale, ledger, picks, now: new Date(reported.checkedAt) });
    expect(validateArenaEarningsDigestSupplement({ baselineDigest: digest, candidateDigest: staleCandidate, ledger, picks }).ok).toBe(false);
    const tampered = mergeArenaDigestEarnings({ digest, input: reported, ledger, picks, now: new Date(reported.checkedAt) });
    tampered.books[0].tradesCount = 99;
    expect(validateArenaEarningsDigestSupplement({ baselineDigest: digest, candidateDigest: tampered, ledger, picks }).ok).toBe(false);
  });

  it('uses a real post-close earnings supplement window', () => {
    expect(assessArenaEarningsWindow(new Date('2026-08-13T20:05:00.000Z'))).toMatchObject({ due: true, date: '2026-08-13' });
    expect(assessArenaEarningsWindow(new Date('2026-08-13T19:59:00.000Z')).due).toBe(false);
    expect(assessArenaEarningsWindow(new Date('2026-08-13T21:05:00.000Z'))).toMatchObject({ due: true });
  });
});
