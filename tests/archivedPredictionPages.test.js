import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gamesPath = 'data-archive/stats/2026-09-05/games-data.json';
const leaguesPath = 'data-archive/stats/2026-09-05/leagues-data.json';
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('retired prediction pages', () => {
  it('sends every retired page URL to the homepage', () => {
    for (const page of ['/games.html', '/league.html', '/boot.html', '/stats.html']) {
      expect(vercel.redirects).toContainEqual({ source: page, destination: '/', statusCode: 301 });
      expect(existsSync(page.slice(1))).toBe(false);
    }
  });

  it('retains exact, non-public snapshots of both prediction datasets', () => {
    expect(existsSync('public/games-data.json')).toBe(false);
    expect(existsSync('public/leagues-data.json')).toBe(false);
    expect(sha256(gamesPath)).toBe('7761bb4d9b0e8289828999ddee9100960ad5d2d130c5fc4dc06bc44ab6c2a7e2');
    expect(sha256(leaguesPath)).toBe('c25a6c48ecc98917e00c1b55059e613e8ce892f4dd8451ab373448f8d4ef22dc');
  });
});
