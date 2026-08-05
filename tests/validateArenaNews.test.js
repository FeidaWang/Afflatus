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
});
