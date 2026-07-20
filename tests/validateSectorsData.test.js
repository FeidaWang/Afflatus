import { describe, it, expect } from 'vitest';
import { validateSectorsData } from '../src/lib/validateSectorsData.js';

function baseModelWatchCard(vendor) {
  return {
    vendor, route: vendor === 'zhipu' ? 'open' : 'closed',
    current_line: 'v1', developments: [{ t_zh: '动态', t_en: 'dev', src: 'https://x', confidence: 0.7 }],
    gap_note_zh: '差距', gap_note_en: 'gap',
  };
}

function baseCard(overrides = {}) {
  return {
    ticker: 'MU', tracks: ['T1'], status: 'unchanged',
    moat_zh: '护城河', thesis_zh: '论点', key_risk_zh: '风险',
    moat_en: 'moat', thesis_en: 'thesis', key_risk_en: 'risk',
    catalysts: [{ what: 'earnings', when: '2026-08', src: 'https://x' }],
    confidence: 0.6, last_reviewed: '2026-07-05',
    ...overrides,
  };
}

function basePopulated(overrides = {}) {
  return {
    updated: '2026-07-05T00:00:00Z', version: 1, as_of: '2026-07-05',
    modelWatch: ['anthropic', 'openai', 'zhipu', 'alibaba'].map(baseModelWatchCard),
    baskets: [{ vendor: 'anthropic', market: 'US', equities: [{ ticker: 'MSFT', relation: 'infra', correlation_note_zh: '算力', confidence: 0.5 }] }],
    weeklyTake: { zh: '本周', en: 'this week' },
    postMemory: {
      as_of: '2026-07-05', mode: 'weekly',
      tracks: [{ id: 'T1', state_zh: 'HBM', state_en: 'HBM' }, { id: 'T2', state_zh: 'CXL', state_en: 'CXL' }, { id: 'T3', state_zh: 'NAND', state_en: 'NAND' }],
      cards: [baseCard()],
      take_zh: '总结', take_en: 'summary',
    },
    ...overrides,
  };
}

describe('validateSectorsData — empty seed state', () => {
  it('accepts the bootstrap seed with no modelWatch/baskets/postMemory yet', () => {
    const { ok, errors } = validateSectorsData({ updated: null, version: 1 });
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });
  it('rejects a bad version even in seed state', () => {
    const { ok, errors } = validateSectorsData({ updated: null, version: 2 });
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/version/);
  });
});

describe('validateSectorsData — populated state', () => {
  it('accepts a fully valid populated document', () => {
    const { ok, errors } = validateSectorsData(basePopulated());
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('rejects wrong top-level shape', () => {
    expect(validateSectorsData(null).ok).toBe(false);
    expect(validateSectorsData([]).ok).toBe(false);
  });

  it('requires exactly 11 modelWatch vendor cards when populated (4 accepted for legacy data)', () => {
    const data = basePopulated({ modelWatch: [baseModelWatchCard('anthropic')] });
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/expected 11 vendor cards/);
  });

  it('accepts an 11-card modelWatch roster (V12 expansion)', () => {
    const all = ['anthropic', 'openai', 'google', 'xai', 'meta', 'cohere', 'deepseek', 'alibaba', 'zhipu', 'moonshot', 'minimax'];
    const data = basePopulated({ modelWatch: all.map(baseModelWatchCard) });
    const { ok, errors } = validateSectorsData(data);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('rejects an unrecognized vendor', () => {
    const data = basePopulated();
    data.modelWatch[0] = baseModelWatchCard('mistral');
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/vendor: must be one of/);
  });

  it('rejects duplicate vendor cards', () => {
    const data = basePopulated();
    data.modelWatch[1] = baseModelWatchCard('anthropic');
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/duplicate "anthropic"/);
  });

  it('caps developments at 3 per vendor card', () => {
    const data = basePopulated();
    data.modelWatch[0].developments = Array.from({ length: 4 }, () => ({ t_zh: 'x', t_en: 'x', src: 'https://x', confidence: 0.5 }));
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/at most 3 developments/);
  });

  it('rejects a numeric correlation coefficient on a basket equity (discipline guard)', () => {
    const data = basePopulated();
    data.baskets[0].equities[0].correlation = 0.83;
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/numeric correlation coefficients are not allowed/);
  });

  it('rejects an unrecognized relation tag', () => {
    const data = basePopulated();
    data.baskets[0].equities[0].relation = 'bullish';
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/relation: must be one of/);
  });

  it('rejects a postMemory card with no tracks', () => {
    const data = basePopulated();
    data.postMemory.cards[0] = baseCard({ tracks: [] });
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/tracks: must be a non-empty array/);
  });

  it('rejects duplicate tickers in postMemory cards', () => {
    const data = basePopulated();
    data.postMemory.cards.push(baseCard());
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/duplicate "MU"/);
  });

  it('allows swap_proposals to be entirely absent (most weeks propose nothing)', () => {
    const data = basePopulated();
    delete data.postMemory.swap_proposals;
    expect(validateSectorsData(data).ok).toBe(true);
  });

  it('validates swap_proposals entries when present', () => {
    const data = basePopulated();
    data.postMemory.swap_proposals = [{ out: 'PSTG', why_zh: '流动性' }]; // missing "in"
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/swap_proposals\[0\]\.in/);
  });

  it('rejects an out-of-range confidence value', () => {
    const data = basePopulated();
    data.postMemory.cards[0].confidence = 1.5;
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/confidence: must be a number in \[0,1\]/);
  });

  it('rejects an unrecognized track id', () => {
    const data = basePopulated();
    data.postMemory.tracks[0].id = 'T9';
    const { ok, errors } = validateSectorsData(data);
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/tracks\[0\]\.id: must be one of/);
  });
});
