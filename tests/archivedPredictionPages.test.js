import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gamesHtml = readFileSync('games.html', 'utf8');
const leagueHtml = readFileSync('league.html', 'utf8');
const arenaHtml = readFileSync('arena.html', 'utf8');
const leagueScript = readFileSync('src/pages/league.js', 'utf8');
const leagueEntry = readFileSync('src/pages/leagueEntry.js', 'utf8');
const i18nScript = readFileSync('src/lib/i18n.js', 'utf8');
const gamesPath = 'data-archive/stats/2026-09-05/games-data.json';
const leaguesPath = 'data-archive/stats/2026-09-05/leagues-data.json';
const gamesData = JSON.parse(readFileSync(gamesPath, 'utf8'));
const gamesScript = readFileSync('src/pages/games.js', 'utf8');
const gamesEntry = readFileSync('src/pages/gamesEntry.js', 'utf8');
const leagueData = JSON.parse(readFileSync(leaguesPath, 'utf8'));
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('completed prediction archives', () => {
  it('does not present the completed World Cup record as a live daily service', () => {
    expect(gamesHtml).toContain('World Cup 2026 Prediction Archive');
    expect(gamesHtml).toContain('FINAL ARCHIVE · CLOSED 20 JUL 2026');
    expect(gamesHtml).not.toMatch(/UPDATED DAILY|live predictions|refreshed daily/);
    expect(gamesData.mode).toBe('archive');
    expect(gamesData.archiveSource.url).toContain('fifa.com/');
    expect(gamesData.record.note_en).not.toContain('Updated daily');
    expect(gamesScript).toContain('The final scored match log is retained in the repository data archive.');
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

  it('keeps dynamic archive badges outside nodes rewritten by i18n', () => {
    expect(leagueHtml).toContain('<h3><span data-en="PRE-FINAL CHAMPION ODDS · FEARLESS POOL"');
    expect(leagueHtml).toContain(' <span class="sub" id="updated"></span></h3>');
    expect(gamesHtml).toContain('<h3><span data-en="FINAL AWARDS · GOLDEN BALL / GOLDEN BOOT"');
    expect(leagueHtml).not.toMatch(/<h3[^>]*data-en[^>]*>[^<]*<span class="sub"/);
    expect(gamesHtml).not.toMatch(/<h3[^>]*data-en[^>]*>[^<]*<span class="sub"/);
  });

  it('keeps the retired source interfaces bilingual without publishing Stats redirects', () => {
    expect(gamesHtml).toContain('data-afflatus-locale="inline"');
    expect(leagueHtml).toContain('data-afflatus-locale="inline"');
    expect(i18nScript).toContain("dataset.afflatusLocale === 'inline'");
    expect(vercel.redirects.some(({ source, destination }) => (
      source.includes('stats.html') || destination.includes('stats.html')
    ))).toBe(false);
  });

  it('retains exact, non-public snapshots of both prediction datasets', () => {
    expect(existsSync('public/games-data.json')).toBe(false);
    expect(existsSync('public/leagues-data.json')).toBe(false);
    expect(sha256(gamesPath)).toBe('7761bb4d9b0e8289828999ddee9100960ad5d2d130c5fc4dc06bc44ab6c2a7e2');
    expect(sha256(leaguesPath)).toBe('c25a6c48ecc98917e00c1b55059e613e8ce892f4dd8451ab373448f8d4ef22dc');
  });

  it('initializes locale state before either archive starts dynamic rendering', () => {
    expect(gamesEntry.indexOf("import '../lib/i18n.js'")).toBeLessThan(gamesEntry.indexOf("import './games.js'"));
    expect(leagueEntry.indexOf("import '../lib/i18n.js'")).toBeLessThan(leagueEntry.indexOf("import './league.js'"));
    expect(i18nScript).toMatch(/\n  apply\(\);\n  if \(document\.readyState === 'loading'\)/);
  });

  it('paints archived probabilities at their settled value on the first frame', () => {
    for (const script of [gamesScript, leagueScript]) {
      expect(script).toContain('<b class="pval">${it.prob}%</b>');
      expect(script).not.toContain('data-to="${it.prob}"');
      expect(script).not.toContain('(ts - t0) / 900');
    }
  });

  it('keeps the Arena mobile introduction concise and action-led', () => {
    const brief = arenaHtml.match(/<p class="brief"[^>]*data-en="([^"]+)"/)?.[1] || '';
    expect(brief).toContain('Review the latest published snapshot');
    expect(brief.split(/\s+/)).toHaveLength(36);
    expect(brief).not.toContain('moving averages');
  });
});
