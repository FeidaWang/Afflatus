import { describe, it, expect } from 'vitest';
import {
  TEAM_SEED_ELO,
  eloExpected,
  updateElo,
  seriesWinProbFromGame,
  gameProbFromSeries,
  blendGameProb,
  fearlessDelta,
  enumerateSeries,
  impliedOdds,
  applyAdjustment,
  simulateChampion,
  mvpWeights,
  mvpBoard,
  scoreSeries,
  buildRecord,
} from '../src/lib/worldsModel.js';

const CODES = Object.keys(TEAM_SEED_ELO);

function swissTeams(overrides = {}) {
  return CODES.map((code) => ({ code, w: 0, l: 0, status: 'active', ...(overrides[code] || {}) }));
}

describe('worldsModel: series probabilities', () => {
  it('Bo1/Bo3/Bo5 are symmetric at p=0.5', () => {
    expect(seriesWinProbFromGame(0.5, 1)).toBe(0.5);
    expect(seriesWinProbFromGame(0.5, 3)).toBeCloseTo(0.5, 12);
    expect(seriesWinProbFromGame(0.5, 5)).toBeCloseTo(0.5, 12);
  });

  it('Bo3 and Bo5 amplify the favourite', () => {
    expect(seriesWinProbFromGame(0.6, 3)).toBeCloseTo(0.648, 6);
    expect(seriesWinProbFromGame(0.6, 5)).toBeGreaterThan(seriesWinProbFromGame(0.6, 3));
  });

  it('gameProbFromSeries inverts seriesWinProbFromGame', () => {
    expect(gameProbFromSeries(seriesWinProbFromGame(0.62, 5), 5)).toBeCloseTo(0.62, 6);
    expect(gameProbFromSeries(seriesWinProbFromGame(0.4, 3), 3)).toBeCloseTo(0.4, 6);
    expect(gameProbFromSeries(0.7, 1)).toBe(0.7);
  });

  it('blendGameProb uses the market only when finite', () => {
    expect(blendGameProb({ pMarket: 0.7, pElo: 0.5 })).toBeCloseTo(0.62, 12);
    expect(blendGameProb({ pMarket: null, pElo: 0.55 })).toBe(0.55);
    expect(blendGameProb({ pMarket: NaN, pElo: 0.55 })).toBe(0.55);
  });

  it('fearlessDelta is clamped to ±0.05', () => {
    expect(fearlessDelta(20, 2)).toBe(0.05);
    expect(fearlessDelta(2, 20)).toBe(-0.05);
    expect(fearlessDelta(12, 10)).toBeCloseTo(0.02, 12);
  });

  it('enumerateSeries: symmetric p gives 50/50, scores sum to 1', () => {
    const s = enumerateSeries(0.5, 3);
    expect(s.pWin[0]).toBeCloseTo(0.5, 12);
    expect(s.pWin[1]).toBeCloseTo(0.5, 12);
    const total = Object.values(s.scores).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 12);
    expect(Object.keys(s.scores).sort()).toEqual(['0-2', '1-2', '2-0', '2-1']);
    expect(s.best.p).toBeCloseTo(0.25, 12);
  });

  it('enumerateSeries: Bo1 and fearless delta', () => {
    const bo1 = enumerateSeries(0.7, 1);
    expect(bo1.pWin[0]).toBe(0.7);
    expect(bo1.pWin[1]).toBeCloseTo(0.3, 12);
    expect(bo1.best).toEqual({ score: '1-0', p: 0.7 });
    expect(enumerateSeries(0.7, 3).best).toEqual({ score: '2-0', p: expect.closeTo(0.49, 12) });
    // Positive delta boosts the home side from game 2 onward.
    const flat = enumerateSeries(0.5, 5);
    const boosted = enumerateSeries(0.5, 5, 0.05);
    expect(boosted.pWin[0]).toBeGreaterThan(flat.pWin[0]);
    expect(boosted.pWin[0] + boosted.pWin[1]).toBeCloseTo(1, 12);
    expect(Object.keys(boosted.scores)).toHaveLength(6);
  });

  it('impliedOdds rounds to 2dp with a 1.01 floor', () => {
    expect(impliedOdds([0.64, 0.36])).toEqual([1.56, 2.78]);
    expect(impliedOdds([0.999, 0.001])).toEqual([1.01, 1000]);
  });

  it('applyAdjustment accepts |adj| ≤ 0.05 and rejects beyond', () => {
    expect(applyAdjustment(0.6, 0.07)).toBeNull();
    expect(applyAdjustment(0.6, -0.051)).toBeNull();
    expect(applyAdjustment(0.6, 0.05)).toBeCloseTo(0.65, 12);
    expect(applyAdjustment(0.98, 0.05)).toBeLessThanOrEqual(0.99);
  });
});

describe('worldsModel: Elo', () => {
  it('eloExpected is the 400-point logistic', () => {
    expect(eloExpected(1600, 1600)).toBe(0.5);
    expect(eloExpected(1800, 1600)).toBeCloseTo(0.7597, 3);
    expect(eloExpected(1600, 1800) + eloExpected(1800, 1600)).toBeCloseTo(1, 12);
  });

  it('updateElo moves the winner up by K·(1−E) and does not mutate input', () => {
    const before = { GEN: 1750, LOS: 1500 };
    const after = updateElo(before, [{ winner: 'LOS', loser: 'GEN' }]);
    const e = eloExpected(1500, 1750);
    expect(after.LOS).toBeCloseTo(1500 + 40 * (1 - e), 9);
    expect(after.GEN).toBeCloseTo(1750 - 40 * (1 - e), 9);
    expect(before).toEqual({ GEN: 1750, LOS: 1500 });
    expect(TEAM_SEED_ELO.GEN).toBe(1750);
    expect(Object.keys(TEAM_SEED_ELO)).toHaveLength(16);
  });
});

describe('worldsModel: simulateChampion', () => {
  const ratings = TEAM_SEED_ELO;

  it('is deterministic for a seed and sums to exactly 100', () => {
    const args = { teams: swissTeams(), ratings, runs: 2000, seed: 7 };
    const a = simulateChampion(args);
    const b = simulateChampion(args);
    expect(a).toEqual(b);
    const sum = Object.values(a).reduce((x, y) => x + y, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
    expect(Object.keys(a).sort()).toEqual([...CODES].sort());
    for (const v of Object.values(a)) expect(v).toBe(Math.round(v * 10) / 10);
  });

  it('eliminated teams get 0 and advanced teams are alive', () => {
    const teams = swissTeams({
      LOS: { w: 0, l: 3, status: 'eliminated' },
      TSW: { w: 1, l: 3, status: 'eliminated' },
      GEN: { w: 3, l: 0, status: 'advanced' },
    });
    const out = simulateChampion({ teams, ratings, runs: 3000, seed: 3 });
    expect(out.LOS).toBe(0);
    expect(out.TSW).toBe(0);
    expect(out.GEN).toBeGreaterThan(10);
  });

  it('honours scheduled series probabilities', () => {
    const teams = swissTeams();
    const scheduled = [{ home: 'LOS', away: 'GEN', bo: 1, pWinHome: 0.999 }];
    const withSched = simulateChampion({ teams, ratings, scheduled, runs: 3000, seed: 5 });
    const without = simulateChampion({ teams, ratings, runs: 3000, seed: 5 });
    expect(withSched.LOS).toBeGreaterThan(without.LOS);
  });

  it('runs 10,000 simulations quickly', () => {
    const t0 = performance.now();
    simulateChampion({ teams: swissTeams(), ratings, runs: 10000, seed: 1 });
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});

describe('worldsModel: MVP', () => {
  const players = [
    { player: 'Chovy', teamCode: 'GEN', role: 'mid', kda: 6, kp: 0.7, dpm: 600 },
    { player: 'Ruler', teamCode: 'GEN', role: 'adc', kda: 7, kp: 0.72, dpm: 650 },
    { player: 'Canyon', teamCode: 'GEN', role: 'jng', kda: 5, kp: 0.75, dpm: 300 },
    { player: 'Kiin', teamCode: 'GEN', role: 'top', kda: 4, kp: 0.6, dpm: 450 },
    { player: 'Duro', teamCode: 'GEN', role: 'sup', kda: 4, kp: 0.78, dpm: 150 },
    { player: 'Faker', teamCode: 'T1', role: 'mid', kda: 5, kp: 0.7, dpm: 550 },
    { player: 'Gumayusi', teamCode: 'T1', role: 'adc', kda: 6, kp: null, dpm: 620 },
  ];

  it('mvpWeights normalises to 1 within each team and tolerates missing stats', () => {
    const w = mvpWeights(players);
    const sum = (code) => w.filter((x) => x.teamCode === code).reduce((a, x) => a + x.w, 0);
    expect(sum('GEN')).toBeCloseTo(1, 12);
    expect(sum('T1')).toBeCloseTo(1, 12);
    expect(w.find((x) => x.player === 'Gumayusi').w).toBeGreaterThan(0);
    expect(mvpWeights([])).toEqual([]);
  });

  it('mvpBoard returns ≤6 rows summing to 100±0.2', () => {
    const board = mvpBoard({ GEN: 60, T1: 40 }, mvpWeights(players));
    expect(board.length).toBeLessThanOrEqual(6);
    const sum = board.reduce((a, x) => a + x.prob, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.2);
    expect(board[0].prob).toBeGreaterThanOrEqual(board[board.length - 1].prob);
    expect(board[0]).toEqual(expect.objectContaining({ player: expect.any(String), teamCode: expect.any(String) }));
    expect(mvpBoard({}, [])).toEqual([]);
  });
});

describe('worldsModel: scoring and record', () => {
  const base = { id: 'r3-gen-lyon', home: 'GEN', away: 'LYON', kickoff: '2026-10-26T20:00:00Z', bo: 3 };

  it('scoreSeries returns null without pick or result', () => {
    expect(scoreSeries({ ...base, pick: null, result: null })).toBeNull();
    expect(scoreSeries({ ...base, pick: { side: 'home', pWin: [0.7, 0.3], score: '2-0' }, result: null })).toBeNull();
  });

  it('scoreSeries: exact requires hit; brier follows pick side', () => {
    const pick = { side: 'home', pWin: [0.7, 0.3], score: '2-0' };
    expect(scoreSeries({ ...base, pick, result: { home: 2, away: 0 } })).toEqual({ hit: true, exact: true, brier: expect.closeTo(0.09, 12) });
    expect(scoreSeries({ ...base, pick, result: { home: 2, away: 1 } })).toEqual({ hit: true, exact: false, brier: expect.closeTo(0.09, 12) });
    const miss = scoreSeries({ ...base, pick: { side: 'home', pWin: [0.7, 0.3], score: '0-2' }, result: { home: 0, away: 2 } });
    expect(miss).toEqual({ hit: false, exact: false, brier: expect.closeTo(0.49, 12) });
  });

  it('buildRecord([]) degrades gracefully', () => {
    expect(buildRecord([], '2026-10-14')).toEqual({
      since: '2026-10-14', resolved: 0, correctOutcome: 0, exactScore: 0, winRate: 0, brier: 0, log: [],
    });
  });

  it('buildRecord aggregates, labels bilingually and keeps the last 12 oldest-first', () => {
    const series = [];
    for (let i = 0; i < 14; i++) {
      const hit = i % 2 === 0;
      series.push({
        id: `r1-a${i}-b${i}`, home: `A${i}`, away: `B${i}`, bo: 1,
        kickoff: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
        pick: { side: 'home', pWin: [0.6, 0.4], score: '1-0' },
        result: hit ? { home: 1, away: 0 } : { home: 0, away: 1 },
      });
    }
    series.push({ id: 'r9-x-y', home: 'X', away: 'Y', kickoff: '2026-11-01T00:00:00Z', pick: null, result: null });
    const rec = buildRecord(series.slice().reverse(), '2026-10-14');
    expect(rec.resolved).toBe(14);
    expect(rec.correctOutcome).toBe(7);
    expect(rec.exactScore).toBe(7);
    expect(rec.winRate).toBe(50);
    expect(rec.brier).toBeCloseTo(0.26, 3);
    expect(rec.log).toHaveLength(12);
    expect(rec.log[0].id).toBe('r1-a2-b2');
    expect(rec.log[11].id).toBe('r1-a13-b13');
    expect(rec.log[0]).toEqual({
      id: 'r1-a2-b2', label_en: 'A2 1-0 B2', label_zh: 'A2 1-0 B2', pick_en: 'A2 win', pick_zh: 'A2 胜', ok: true, exact: true,
    });
    expect(rec.log[11].ok).toBe(false);
  });
});
