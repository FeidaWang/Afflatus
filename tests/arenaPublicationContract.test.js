import { describe, expect, it } from 'vitest';
import { validateArenaPremarketGroup } from '../src/lib/arenaPublicationContract.js';

function group(sourceRefs) {
  const news = {
    date: '2026-08-12',
    evidenceCutoffAt: '2026-08-12T12:40:00.000Z',
    generatedAt: '2026-08-12T12:44:00.000Z',
    items: [
      { category: 'macro-policy', url: 'https://www.bls.gov/cpi/' },
      { category: 'company-earnings', url: 'https://www.sec.gov/Archives/example' },
      { category: 'compute', url: 'https://investor.nvidia.com/example' },
      { category: 'cloud-demand', url: 'https://www.microsoft.com/investor/example' },
    ],
  };
  const picks = {
    date: '2026-08-12',
    generatedAt: '2026-08-12T12:46:00.000Z',
    decisionStatus: 'sealed',
    executable: true,
    quoteAllowlist: ['SPY', 'QQQ', 'SMH'],
    models: { S: [{ sourceRefs }], P: [], T: [] },
  };
  const runlog = { runs: [
    { date: picks.date, window: 'pre-market-gather', model: 'gatherer', status: 'done' },
    { date: picks.date, window: 'picks-publish', model: 'gatherer', status: 'done' },
  ] };
  return { news, picks, runlog };
}

describe('Arena atomic pre-market source contract', () => {
  it('accepts URLs and stable ids from the same news snapshot', () => {
    const { news, picks, runlog } = group([
      'https://www.bls.gov/cpi/',
      'arena-news:2026-08-12:item-1',
    ]);
    expect(validateArenaPremarketGroup(news, picks, runlog)).toEqual({ ok: true, errors: [] });
  });

  it('rejects a self-hashed source that is absent from the published research', () => {
    const { news, picks, runlog } = group(['https://example.com/unpublished']);
    const result = validateArenaPremarketGroup(news, picks, runlog);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/not present/);
  });

  it('rejects cross-date publication groups', () => {
    const { news, picks, runlog } = group(['https://www.bls.gov/cpi/']);
    picks.date = '2026-08-11';
    expect(validateArenaPremarketGroup(news, picks, runlog).ok).toBe(false);
  });

  it('requires four independent sources and research categories', () => {
    const { news, picks, runlog } = group(['https://www.bls.gov/cpi/']);
    news.items = news.items.slice(0, 3);
    const result = validateArenaPremarketGroup(news, picks, runlog);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/four distinct source/),
      expect.stringMatching(/four distinct research categories/),
    ]));
  });

  it('accepts an explicit non-executable missed snapshot only with archived research and a missed run', () => {
    const { news, picks, runlog } = group([]);
    picks.models = { S: [], P: [], T: [] };
    picks.decisionStatus = 'missed';
    picks.executable = false;
    runlog.runs[1].status = 'missed';
    expect(validateArenaPremarketGroup(news, picks, runlog)).toEqual({ ok: true, errors: [] });
  });

  it('does not let a picks status hide a missing research gather run', () => {
    const { news, picks, runlog } = group(['https://www.bls.gov/cpi/']);
    runlog.runs[0].status = 'missed';
    expect(validateArenaPremarketGroup(news, picks, runlog).errors.join(' ')).toMatch(/gather run must be done/);
  });

  it('requires held positions in the quote allowlist', () => {
    const { news, picks, runlog } = group(['https://www.bls.gov/cpi/']);
    picks.quoteAllowlist = ['SPY'];
    const ledger = { models: { S: { positions: [{ sym: 'WAB' }] }, P: {}, T: {} } };
    expect(validateArenaPremarketGroup(news, picks, runlog, ledger).errors).toContain('quoteAllowlist: missing held position WAB');
  });

  it('requires fixed benchmark symbols and every proposed symbol in the quote allowlist', () => {
    const { news, picks, runlog } = group(['https://www.bls.gov/cpi/']);
    picks.models.S[0].sym = 'NVDA';
    picks.quoteAllowlist = ['SPY'];
    const errors = validateArenaPremarketGroup(news, picks, runlog).errors;
    expect(errors).toEqual(expect.arrayContaining([
      'quoteAllowlist: missing fixed execution/benchmark symbol QQQ',
      'quoteAllowlist: missing fixed execution/benchmark symbol SMH',
      'quoteAllowlist: missing published proposal NVDA',
    ]));
  });

  it('rejects research generated after its decision or with an invalid evidence cutoff', () => {
    const { news, picks, runlog } = group(['https://www.bls.gov/cpi/']);
    news.generatedAt = '2026-08-12T12:47:00.000Z';
    news.evidenceCutoffAt = '2026-08-12T12:48:00.000Z';
    expect(validateArenaPremarketGroup(news, picks, runlog).errors.join(' ')).toMatch(/cannot be after/);
  });
});
