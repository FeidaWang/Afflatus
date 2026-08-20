import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateArenaNews } from '../src/lib/validateArenaNews.js';

const safeItem = Object.freeze({
  category: 'macro-policy',
  title_en: 'Verified policy update',
  title_zh: '已核实的政策更新',
  summary_en: 'A bounded test fixture for unattended briefing validation.',
  summary_zh: '用于无人值守简报校验的有界测试夹具。',
  source: 'Federal Reserve',
  url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260814a.htm',
  tickers: ['SPY'],
  publishedAt: '2026-08-13T13:00:00.000Z',
});

function withFixtureItems(data, count = 2) {
  return {
    ...data,
    items: Array.from({ length: count }, (_, index) => ({
      ...safeItem,
      title_en: `${safeItem.title_en} ${index + 1}`,
      title_zh: `${safeItem.title_zh} ${index + 1}`,
    })),
  };
}

describe('validateArenaNews', () => {
  it('accepts the currently published Arena briefing', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    expect(validateArenaNews(data)).toEqual({ ok: true, errors: [] });
  });

  it('rejects markup and executable source links from unattended tasks', () => {
    const data = withFixtureItems(JSON.parse(readFileSync('public/arena-news.json', 'utf8')), 1);
    data.items[0].title_en = '<img src=x onerror=alert(1)>';
    data.items[0].url = 'javascript:alert(1)';
    const result = validateArenaNews(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('title_en'))).toBe(true);
    expect(result.errors.some((error) => error.includes('.url'))).toBe(true);
  });

  it('requires source publication times for new briefings and rejects stale sources', () => {
    const data = withFixtureItems(JSON.parse(readFileSync('public/arena-news.json', 'utf8')));
    data.date = '2026-08-14';
    data.generatedAt = '2026-08-14T13:00:00.000Z';
    data.evidenceCutoffAt = '2026-08-14T12:55:00.000Z';
    data.freshnessPolicy = 'session-news-v1';
    data.coverageStatus = 'complete';
    data.items.forEach((item) => { item.publishedAt = '2026-08-13T13:00:00.000Z'; });
    expect(validateArenaNews(data)).toEqual({ ok: true, errors: [] });

    data.items[0].publishedAt = '2026-07-09T12:00:00.000Z';
    expect(validateArenaNews(data).errors.join(' ')).toMatch(/older than the 72-hour/);
  });

  it('rejects missing and post-cutoff source timestamps in new briefings', () => {
    const data = withFixtureItems(JSON.parse(readFileSync('public/arena-news.json', 'utf8')));
    data.date = '2026-08-14';
    data.generatedAt = '2026-08-14T13:00:00.000Z';
    data.evidenceCutoffAt = '2026-08-14T12:55:00.000Z';
    data.freshnessPolicy = 'session-news-v1';
    data.coverageStatus = 'limited';
    const missingTimestamp = { ...data.items[0] };
    delete missingTimestamp.publishedAt;
    data.items = [missingTimestamp, { ...data.items[1], publishedAt: '2026-08-14T12:56:00.000Z' }];
    const errors = validateArenaNews(data).errors.join(' ');
    expect(errors).toMatch(/official publication timestamp/);
    expect(errors).toMatch(/cannot be after evidenceCutoffAt/);
  });
});
