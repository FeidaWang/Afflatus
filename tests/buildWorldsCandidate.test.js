import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateWorldsData } from '../src/lib/validateWorldsData.js';

// Offline replay of the 2026-10-25 12:00 UTC capture: R1–R2 complete, four R3
// series listed by gol.gg and four more only priced on Polymarket.
const FIXTURES = 'tests/fixtures/worlds';
const FILES = {
  'matchlist-main.html': 'matchlist-rows.html',
  'game-83653.html': 'game-draft.html',
  'champions.html': 'champions-table.html',
  'players.html': 'players-table.html',
  'polymarket.json': 'polymarket-events.json',
  'polymarket-winner.json': 'polymarket-winner.json',
  'kalshi.json': 'kalshi.json',
  'teams.html': 'teams-table.html',
  'ddragon-versions.json': 'ddragon-versions.json',
  'ddragon-champions.json': 'ddragon-champions.json',
};
const ROUND2 = ['teams.html', 'ddragon-versions.json', 'ddragon-champions.json'];

function build({ without = [], matchlist = (html) => html, baseline = '/nonexistent', now = '2026-10-25T12:30:00Z' } = {}) {
  const fixtures = mkdtempSync(join(tmpdir(), 'worlds-fixtures-'));
  for (const [target, source] of Object.entries(FILES)) if (!without.includes(target)) copyFileSync(join(FIXTURES, source), join(fixtures, target));
  writeFileSync(join(fixtures, 'matchlist-main.html'), matchlist(readFileSync(join(FIXTURES, FILES['matchlist-main.html']), 'utf8')));
  const output = mkdtempSync(join(tmpdir(), 'worlds-cand-'));
  execFileSync('node', ['scripts/build-worlds-candidate.mjs', `--output=${output}`, `--offline-fixtures=${fixtures}`, `--now=${now}`, `--baseline=${baseline}`], { encoding: 'utf8' });
  return {
    data: JSON.parse(readFileSync(join(output, 'worlds-data.json'), 'utf8')),
    payload: JSON.parse(readFileSync(join(output, 'worlds-run-payload.json'), 'utf8')),
  };
}

describe('build-worlds-candidate (offline fixtures)', () => {
  const { data, payload } = build();

  it('produces a validator-clean candidate dated in America/Chicago', () => {
    expect(validateWorldsData(data)).toEqual({ ok: true, errors: [] });
    expect(data.updated).toBe('2026-10-25');
    expect(data.version).toBe(1);
    expect(data.mode).toBe('live');
  });

  it('settles R1–R2 and schedules all eight R3 series with the right formats', () => {
    const resolved = data.series.filter((s) => s.result);
    expect(resolved).toHaveLength(16);
    expect(resolved.every((s) => s.pick === null && s.missed)).toBe(true);
    const r3 = Object.fromEntries(data.series.filter((s) => s.round === 3).map((s) => [s.id, s]));
    expect(Object.keys(r3).sort()).toEqual(['r3-dk-mkoi', 'r3-gen-lyon', 'r3-hle-ig', 'r3-kc-blg', 'r3-los-tsw', 'r3-t1-cfo', 'r3-tes-g2', 'r3-tl-al']);
    expect(Object.fromEntries(Object.values(r3).map((s) => [s.id, s.bo]))).toEqual({
      'r3-gen-lyon': 3, 'r3-dk-mkoi': 3, 'r3-tes-g2': 1, 'r3-hle-ig': 1, 'r3-tl-al': 3, 'r3-los-tsw': 3, 'r3-t1-cfo': 1, 'r3-kc-blg': 1,
    });
    for (const s of Object.values(r3)) {
      expect(s.pick).not.toBeNull();
      expect(Date.parse(s.pick.decidedAt)).toBeLessThan(Date.parse(s.kickoff));
      expect(s.market.src).toBe('polymarket');
    }
    // Review Focus #2: market probabilities follow team names, not outcome order.
    expect(r3['r3-tes-g2'].market.pWin).toEqual([0.475, 0.525]);
    expect(r3['r3-kc-blg'].market.pWin[1]).toBeGreaterThan(0.5);
  });

  it('derives the swiss table and a normalised champion board', () => {
    const table = Object.fromEntries(data.swiss.map((t) => [t.team, `${t.w}-${t.l}`]));
    expect(table).toMatchObject({ GEN: '2-0', DK: '2-0', MKOI: '2-0', LYON: '2-0', TL: '0-2', AL: '0-2', LOS: '0-2', TSW: '0-2' });
    const sum = data.champion.reduce((acc, c) => acc + c.prob, 0);
    expect(sum).toBeCloseTo(100, 6);
    expect(data.champion[0].team).toBe('GEN');
    expect(data.meta).toHaveLength(12);
    expect(payload.series).toHaveLength(8);
    expect(payload.rules).toBe('prompts/leagues-worlds.md');
  });

  it('records the picks of a game draft on the resolved series', () => {
    const tlBlg = data.series.find((s) => s.id === 'r2-tl-blg');
    expect(tlBlg.result).toMatchObject({ home: 0, away: 1 });
    expect(tlBlg.result.games[0].picks.away).toEqual(['Lee Sin', 'Orianna', 'Camille', 'Jhin', 'Nautilus']);
  });
});

describe('build-worlds-candidate round-2 fields', () => {
  const { data, payload } = build();
  const open = data.series.filter((s) => s.pick && !s.result);

  it('adds a scoreline distribution to every open pick and a decider to Bo3s', () => {
    for (const s of open) {
      expect(Object.values(s.pick.scores).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
      if (s.bo === 3) expect(s.pick.pDecider).toBeGreaterThan(0);
      else expect(s.pick).not.toHaveProperty('pDecider');
    }
  });

  it('names team tactic extremes for all sixteen teams and player extremes where rosters exist', () => {
    expect(data.teams).toHaveLength(16);
    for (const t of data.teams) expect(t.tactics.best.key).toBeTruthy();
    const withPlayers = data.teams.filter((t) => t.players);
    expect(withPlayers.length).toBeGreaterThan(0);
    for (const t of withPlayers) expect(t.players.best.player).toBeTruthy();
    expect(payload.teams).toHaveLength(16);
  });

  it('prices champion and MVP boards as implied odds', () => {
    expect(data.champion.every((c) => (c.prob === 0 ? c.oddsImplied === null : c.oddsImplied >= 1))).toBe(true);
    expect(data.mvp.every((m) => m.oddsImplied >= 1)).toBe(true);
    expect(payload.champion[0].oddsImplied).toBe(data.champion[0].oddsImplied);
  });

  it('tags meta champions with Data Dragon ids', () => {
    expect(data.ddragon).toBe('16.21.1');
    for (const m of data.meta) expect(m.key).toMatch(/^[A-Za-z]+$/);
    expect(validateWorldsData(data)).toEqual({ ok: true, errors: [] });
  });

  it('still builds without the round-2 sources and says so in notes', () => {
    const bare = build({ without: ROUND2 }).data;
    expect(validateWorldsData(bare).ok).toBe(true);
    expect(bare.teams.every((t) => !t.tactics)).toBe(true);
    expect(bare.notes.some((n) => /teams\.html/.test(n))).toBe(true);
    expect(bare.notes.some((n) => /ddragon/i.test(n))).toBe(true);
  });
});

describe('build-worlds-candidate series-score rows', () => {
  // gol.gg lists a Bo3 as one row with the series score; play Gen.G 1-2 LYON.
  const played = (html) => html.replace(
    /(title='Gen\.G vs LYON Preview'>Gen\.G vs LYON<\/a><\/td><td class='text-right'>Gen\.G<\/td><td class='text-center'>) - /,
    '$11 - 2',
  );
  const dir = mkdtempSync(join(tmpdir(), 'worlds-base-'));
  const baseline = join(dir, 'worlds-data.json');
  writeFileSync(baseline, JSON.stringify({ series: [{ id: 'r3-lyon-gen', stage: 'swiss', round: 3, home: 'LYON', away: 'GEN', kickoff: '2026-10-25T17:00:00.000Z', pick: null }] }));
  const { data } = build({ matchlist: played, baseline, now: '2026-10-26T12:00:00Z' });

  it('settles a Bo3 from one 1-2 row and keeps the baseline orientation and id', () => {
    const series = data.series.find((s) => s.round === 3 && [s.home, s.away].sort().join() === 'GEN,LYON');
    expect(series.id).toBe('r3-lyon-gen');
    expect(series.result).toMatchObject({ home: 2, away: 1 });
    expect(data.swiss.find((t) => t.team === 'LYON')).toMatchObject({ w: 3, l: 0, status: 'advanced' });
  });
});
