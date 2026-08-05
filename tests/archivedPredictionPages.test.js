import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gamesHtml = readFileSync('games.html', 'utf8');
const leagueHtml = readFileSync('league.html', 'utf8');
const arenaHtml = readFileSync('arena.html', 'utf8');
const leagueScript = readFileSync('src/pages/league.js', 'utf8');
const gamesData = JSON.parse(readFileSync('public/games-data.json', 'utf8'));
const gamesScript = readFileSync('src/pages/games.js', 'utf8');
const leagueData = JSON.parse(readFileSync('public/leagues-data.json', 'utf8'));

describe('completed prediction archives', () => {
  it('does not present the completed World Cup record as a live daily service', () => {
    expect(gamesHtml).toContain('World Cup 2026 Prediction Archive');
    expect(gamesHtml).toContain('FINAL ARCHIVE · CLOSED 20 JUL 2026');
    expect(gamesHtml).not.toMatch(/UPDATED DAILY|live predictions|refreshed daily/);
    expect(gamesData.mode).toBe('archive');
    expect(gamesData.archiveSource.url).toContain('fifa.com/');
    expect(gamesData.record.note_en).not.toContain('Updated daily');
    expect(gamesScript).toContain('The final scored match log now lives in the unified Stats archive.');
  });

  it('closes the MSI ledger with the verified Grand Final result', () => {
    const final = leagueData.series.find((series) => series.id === 'msi-grand-final');
    expect(leagueHtml).toContain('MSI 2026 Prediction Archive');
    expect(leagueHtml).toContain('FINAL ARCHIVE · CLOSED 12 JUL 2026');
    expect(leagueHtml).not.toMatch(/UPDATED DAILY|live predictions|refreshed daily/);
    expect(leagueData).toMatchObject({
      mode: 'archive',
      finalsMvp: 'Zeus · HLE',
      record: { resolved: 14, correctOutcome: 7, exactScore: 2, winRate: 50 },
    });
    expect(final.result).toEqual({ home: 2, away: 3 });
    expect(leagueData.archiveSource.url).toContain('gol.gg/');
    expect(leagueData.record.note_en).not.toContain('Updated daily');
    expect(leagueScript).toContain("data.mode === 'archive' ? data.series");
  });

  it('keeps the Arena mobile introduction concise and action-led', () => {
    const brief = arenaHtml.match(/<p class="brief"[^>]*data-en="([^"]+)"/)?.[1] || '';
    expect(brief).toContain('Review the latest published snapshot');
    expect(brief.split(/\s+/)).toHaveLength(36);
    expect(brief).not.toContain('moving averages');
  });
});
