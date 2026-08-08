import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateArenaNews } from '../src/lib/validateArenaNews.js';

describe('validateArenaNews', () => {
  it('accepts the currently published Arena briefing', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    expect(validateArenaNews(data)).toEqual({ ok: true, errors: [] });
  });

  it('rejects markup and executable source links from unattended tasks', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    data.items[0].title_en = '<img src=x onerror=alert(1)>';
    data.items[0].url = 'javascript:alert(1)';
    const result = validateArenaNews(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('title_en'))).toBe(true);
    expect(result.errors.some((error) => error.includes('.url'))).toBe(true);
  });

  it('rejects a token briefing that skips daily industry research', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    data.items = data.items.slice(0, 1);
    data.researchCoverage.lanes = ['macro'];
    const result = validateArenaNews(data);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/four sourced research items/);
    expect(result.errors.join(' ')).toMatch(/four research lanes/);
  });

  it('requires a reproducible bilingual EBITDA proxy formula', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    delete data.earningsWatch.events[0].formula_zh;
    const result = validateArenaNews(data);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/formula_zh/);
  });

  it('requires bilingual news categories', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    delete data.items[0].category_zh;
    const result = validateArenaNews(data);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/category_zh/);
  });

  it('requires elapsed events to be explicitly released relative to the research cut', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    data.earningsWatch.asOf = '2026-08-12';
    let result = validateArenaNews(data);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/scheduled event cannot predate/);

    data.earningsWatch.events[0].status = 'released';
    result = validateArenaNews(data);
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('keeps the earnings research cut close to the briefing snapshot', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    data.earningsWatch.asOf = '2026-08-20';
    const result = validateArenaNews(data);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/within seven days/);
  });

  it('rejects duplicate evidence URLs and same-host primary-source pairs', () => {
    const duplicate = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    duplicate.earningsWatch.events[0].sources[1].url = duplicate.earningsWatch.events[0].sources[0].url;
    let result = validateArenaNews(duplicate);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/source URLs must be unique/);

    const sameHost = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    sameHost.earningsWatch.events[0].sources[1].url = `${sameHost.earningsWatch.events[0].sources[0].url}?evidence=results`;
    result = validateArenaNews(sameHost);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/two distinct official hostnames/);
  });

  it('requires sources to explicitly declare first-party or official provenance', () => {
    const data = JSON.parse(readFileSync('public/arena-news.json', 'utf8'));
    delete data.earningsWatch.events[0].sources[0].primary;
    const result = validateArenaNews(data);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/must explicitly identify a first-party or official source/);
  });
});
