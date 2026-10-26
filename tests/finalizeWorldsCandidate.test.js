import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateWorldsData } from '../src/lib/validateWorldsData.js';

const KICKOFF = '2030-01-01T17:00:00.000Z';
function candidate() {
  const series = (id, home, away, pWinHome) => ({
    id, stage: 'swiss', round: 3, bo: 3, kickoff: KICKOFF, home, away,
    pick: { side: pWinHome >= 0.5 ? 'home' : 'away', pWin: [pWinHome, 1 - pWinHome], score: '2-0', pScore: 0.4, oddsImplied: [1.5, 3], adj: 0, decidedAt: '2026-10-25T12:00:00.000Z' },
    missed: false, market: null, fearless: { consumed: [], depth: [10, 8], delta: 0.02 }, result: null,
    reason_en: '', reason_zh: '', factors_en: [], factors_zh: [],
  });
  return {
    tournament: 'Worlds 2026', updated: '2026-10-25', version: 1, mode: 'live', decidedAt: '2026-10-25T12:00:00.000Z',
    teamLogos: {}, swiss: [], series: [series('r3-gen-lyon', 'GEN', 'LYON', 0.6), series('r3-tes-g2', 'TES', 'G2', 0.52)],
    champion: [{ team: 'GEN', prob: 100, market: null, reason_en: '', reason_zh: '' }], mvp: [], fearless: [], meta: [],
    record: { since: '2026-10-25', resolved: 0, correctOutcome: 0, exactScore: 0, winRate: 0, brier: 0, log: [] }, sources: [], notes: [],
  };
}

function run(model, mutate = (d) => d) {
  const dir = mkdtempSync(join(tmpdir(), 'worlds-finalize-'));
  writeFileSync(join(dir, 'worlds-data.json'), JSON.stringify(mutate(candidate())));
  if (model) writeFileSync(join(dir, 'worlds-model-output.json'), JSON.stringify(model));
  execFileSync('node', ['scripts/finalize-worlds-candidate.mjs', dir], { encoding: 'utf8' });
  return JSON.parse(readFileSync(join(dir, 'worlds-data.json'), 'utf8'));
}

const factors = ['Fearless pool depth favours GEN', 'Early-game tempo', 'Bo3 experience'];
const factorsZh = ['无畏征召英雄池更深', '前期节奏', 'Bo3 经验'];

describe('finalize-worlds-candidate', () => {
  it('passes the candidate through unchanged without a model output', () => {
    const data = run(null);
    expect(data.series[0].pick.pWin[0]).toBe(0.6);
    expect(data.notes.some((n) => /without model explanations/.test(n))).toBe(true);
    expect(validateWorldsData(data).ok).toBe(true);
  });

  it('drops an out-of-range or unsourced adjustment and records a note', () => {
    const data = run({ series: [
      { id: 'r3-gen-lyon', adj: 0.2, adj_reason: 'too much', adj_src: 'https://example.com', factors_en: factors, factors_zh: factorsZh },
      { id: 'r3-tes-g2', adj: 0.03, adj_reason: '', adj_src: '', factors_en: factors, factors_zh: factorsZh },
    ] });
    expect(data.series[0].pick.pWin[0]).toBe(0.6);
    expect(data.series[1].pick.pWin[0]).toBe(0.52);
    expect(data.notes.filter((n) => /dropped/.test(n))).toHaveLength(2);
    expect(data.series[0].factors_en).toEqual(factors);
  });

  it('applies a bounded sourced adjustment, recomputes the scoreline and flips the side across 0.5', () => {
    const data = run({ series: [{ id: 'r3-tes-g2', adj: -0.05, adj_reason: 'TES starts a substitute jungler', adj_src: 'https://example.com/news', reason_en: 'ok', reason_zh: '好', factors_en: factors, factors_zh: factorsZh }] });
    const pick = data.series[1].pick;
    expect(pick.pWin[0]).toBeCloseTo(0.47, 3);
    expect(pick.side).toBe('away');
    expect(pick.adj).toBe(-0.05);
    expect(pick.score).toMatch(/^\d-\d$/);
    expect(data.series[1].reason_zh).toBe('好');
    expect(validateWorldsData(data).ok).toBe(true);
  });

  it('rejects factor lists without a Fearless angle', () => {
    const data = run({ series: [{ id: 'r3-gen-lyon', adj: 0, factors_en: ['a', 'b', 'c'], factors_zh: ['甲', '乙', '丙'] }] });
    expect(data.series[0].factors_en).toEqual([]);
    expect(data.notes.some((n) => /factors rejected/.test(n))).toBe(true);
  });
});

describe('finalize-worlds-candidate round-2 fields', () => {
  const extreme = (player) => ({ player, role: 'mid', score: 1, stats: { kda: 5, dpm: 600, kp: 70, gd15: 200 }, reason_en: '', reason_zh: '' });
  const tactic = (key) => ({ key, value: '1', pct: 1, reason_en: '', reason_zh: '' });
  const withTeams = (d) => ({
    ...d,
    teams: [
      { team: 'GEN', players: { best: extreme('Chovy'), worst: extreme('Duro') }, tactics: { best: tactic('GD@15'), worst: tactic('DRA%') } },
      { team: 'LYON', tactics: { best: tactic('FB%'), worst: tactic('NASH%') } },
    ],
  });

  it('keeps the scoreline distribution consistent with an adjusted P(win)', () => {
    const data = run({ series: [{ id: 'r3-tes-g2', adj: -0.05, adj_reason: 'sub jungler', adj_src: 'https://example.com/n', factors_en: factors, factors_zh: factorsZh }] });
    const pick = data.series[1].pick;
    const homeWins = Object.entries(pick.scores).filter(([k]) => Number(k[0]) === 2).reduce((a, [, v]) => a + v, 0);
    expect(homeWins).toBeCloseTo(pick.pWin[0], 2);
    expect(pick.pDecider).toBeGreaterThan(0);
    expect(validateWorldsData(data).ok).toBe(true);
  });

  it('merges team extreme reasons and truncates English at 400 characters', () => {
    const data = run({ teams: [{ team: 'GEN', best_player_en: 'x'.repeat(450), best_player_zh: '最强', worst_tactic_en: 'Dragons lag', worst_tactic_zh: '控龙偏弱' }] }, withTeams);
    const gen = data.teams[0];
    expect(gen.players.best.reason_en).toHaveLength(400);
    expect(gen.players.best.reason_zh).toBe('最强');
    expect(gen.tactics.worst.reason_en).toBe('Dragons lag');
    expect(gen.players.worst.reason_en).toBe('');
    expect(data.teams[1].tactics.best.reason_en).toBe('');
  });

  it('allows longer champion reasons (600 / 320)', () => {
    const data = run({ champion: [{ team: 'GEN', reason_en: 'y'.repeat(700), reason_zh: '理'.repeat(400) }] });
    expect(data.champion[0].reason_en).toHaveLength(600);
    expect(data.champion[0].reason_zh).toHaveLength(320);
  });

  it('accepts team reasons for a candidate with no teams field', () => {
    const data = run({ teams: [{ team: 'GEN', best_player_en: 'x' }] });
    expect(data.teams).toBeUndefined();
    expect(validateWorldsData(data).ok).toBe(true);
  });
});
