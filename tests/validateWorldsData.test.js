import { describe, it, expect } from 'vitest';
import { validateWorldsData } from '../src/lib/validateWorldsData.js';

function pick(overrides = {}) {
  return {
    side: 'home', pWin: [0.62, 0.38], score: '2-1', pScore: 0.41,
    oddsImplied: [1.61, 2.63], adj: 0.02, decidedAt: '2026-10-19T12:00:00Z',
    ...overrides,
  };
}

function series(overrides = {}) {
  return {
    id: 'r3-gen-t1', stage: 'swiss', round: 3, bo: 1, kickoff: '2026-10-20T08:00:00Z',
    home: 'GEN', away: 'T1', pick: pick(), missed: false,
    market: { pWin: [0.6, 0.4], src: 'polymarket', liquidity: 12000 },
    result: null,
    ...overrides,
  };
}

function fixture(overrides = {}) {
  return {
    tournament: 'Worlds 2026', updated: '2026-10-19', version: 1, mode: 'live',
    decidedAt: '2026-10-19T12:00:00Z',
    teamLogos: { GEN: 'https://x/gen.png', T1: 'https://x/t1.png' },
    swiss: [
      { team: 'GEN', w: 2, l: 0, status: 'active' },
      { team: 'T1', w: 2, l: 0, status: 'active' },
    ],
    series: [series()],
    champion: [{ team: 'GEN', prob: 55 }, { team: 'T1', prob: 45 }],
    mvp: [{ player: 'Chovy', teamCode: 'GEN', prob: 60 }, { player: 'Faker', teamCode: 'T1', prob: 40 }],
    fearless: [{ team: 'GEN', depth: 24, champs: [] }],
    meta: [{ champ: 'Azir', picks: 10, bans: 4, presence: 0.7, winrate: 0.55 }],
    record: { since: '2026-10-14', resolved: 0, correctOutcome: 0, exactScore: 0, brier: 0 },
    sources: [{ label: 'gol.gg', url: 'https://gol.gg/', fetchedAt: '2026-10-19T11:00:00Z' }],
    ...overrides,
  };
}

function errorsOf(data) { return validateWorldsData(data).errors.join('\n'); }

describe('validateWorldsData — accepts', () => {
  it('a minimal valid live fixture', () => {
    expect(validateWorldsData(fixture())).toEqual({ ok: true, errors: [] });
  });
  it('null pick/market/result, empty champion/mvp, empty result.games', () => {
    const resolved = series({ id: 'r1-gen-t1', round: 1, kickoff: '2026-10-15T08:00:00Z', pick: pick({ decidedAt: '2026-10-14T12:00:00Z' }), result: { home: 1, away: 0, games: [] } });
    const data = fixture({
      series: [series({ pick: null, market: null }), resolved],
      champion: [], mvp: [],
      record: { resolved: 1, correctOutcome: 1, exactScore: 0, brier: 0.14 },
    });
    expect(validateWorldsData(data)).toEqual({ ok: true, errors: [] });
  });
});

describe('validateWorldsData — top level', () => {
  it('rejects non-object input', () => {
    expect(validateWorldsData(null).ok).toBe(false);
    expect(validateWorldsData([]).ok).toBe(false);
  });
  it('rejects missing/typed-wrong required keys', () => {
    const e = errorsOf({ ...fixture(), tournament: '', version: '1', mode: 'draft', updated: '2026/10/19', decidedAt: 'yesterday', teamLogos: [] });
    expect(e).toMatch(/^tournament/m);
    expect(e).toMatch(/^version/m);
    expect(e).toMatch(/^mode/m);
    expect(e).toMatch(/^updated/m);
    expect(e).toMatch(/^decidedAt/m);
    expect(e).toMatch(/^teamLogos/m);
  });
  it('rejects missing arrays and record', () => {
    const { swiss, series: _s, champion, mvp, fearless, meta, record, sources, ...rest } = fixture();
    const e = errorsOf(rest);
    for (const k of ['swiss', 'series', 'champion', 'mvp', 'fearless', 'meta', 'record', 'sources']) expect(e).toMatch(new RegExp(`^${k}`, 'm'));
  });
});

describe('validateWorldsData — swiss[]', () => {
  it('rejects bad team/w/l/status', () => {
    const e = errorsOf(fixture({ swiss: [{ team: '', w: 1.5, l: -1, status: 'out' }] }));
    expect(e).toContain('swiss[0].team');
    expect(e).toContain('swiss[0].w');
    expect(e).toContain('swiss[0].l');
    expect(e).toContain('swiss[0].status');
  });
});

describe('validateWorldsData — series[]', () => {
  it('rejects duplicate ids, bad stage/round/bo/kickoff/home/away/missed', () => {
    const e = errorsOf(fixture({ series: [series(), series({ stage: 'group', round: 7, bo: 2, kickoff: 'soon', home: '', missed: 'no' })] }));
    expect(e).toContain('series[1].id');
    expect(e).toContain('series[1].stage');
    expect(e).toContain('series[1].bo');
    expect(e).toContain('series[1].kickoff');
    expect(e).toContain('series[1]: home/away');
    expect(e).toContain('series[1].missed');
  });
  it('requires integer round 1–5 for swiss only', () => {
    expect(errorsOf(fixture({ series: [series({ round: 6 })] }))).toContain('series[0].round');
    expect(errorsOf(fixture({ series: [series({ round: 2.5 })] }))).toContain('series[0].round');
    expect(validateWorldsData(fixture({ series: [series({ id: 'qf1-gen-t1', stage: 'qf', round: undefined, bo: 5 })] })).ok).toBe(true);
  });
  it('rejects decidedAt >= kickoff', () => {
    expect(errorsOf(fixture({ series: [series({ pick: pick({ decidedAt: '2026-10-20T08:00:00Z' }) })] }))).toContain('series[0].pick.decidedAt');
    expect(errorsOf(fixture({ series: [series({ pick: pick({ decidedAt: '2026-10-21T00:00:00Z' }) })] }))).toContain('series[0].pick.decidedAt');
    expect(errorsOf(fixture({ series: [series({ pick: pick({ decidedAt: 'nope' }) })] }))).toContain('series[0].pick.decidedAt');
  });
  it('rejects pWin not normalised or out of (0,1)', () => {
    expect(errorsOf(fixture({ series: [series({ pick: pick({ pWin: [0.7, 0.4] }) })] }))).toContain('series[0].pick.pWin');
    expect(errorsOf(fixture({ series: [series({ pick: pick({ pWin: [1, 0] }) })] }))).toContain('series[0].pick.pWin');
    expect(errorsOf(fixture({ series: [series({ pick: pick({ pWin: [0.6] }) })] }))).toContain('series[0].pick.pWin');
    expect(errorsOf(fixture({ series: [series({ market: { pWin: [0.7, 0.4], src: 'pm', liquidity: 1 } })] }))).toContain('series[0].market.pWin');
  });
  it('rejects the remaining pick fields when malformed', () => {
    const e = errorsOf(fixture({ series: [series({ pick: pick({ side: 'left', score: '2:1', pScore: 0, oddsImplied: [0.9, 2], adj: 0.07 }) })] }));
    expect(e).toContain('series[0].pick.side');
    expect(e).toContain('series[0].pick.score');
    expect(e).toContain('series[0].pick.pScore');
    expect(e).toContain('series[0].pick.oddsImplied');
    expect(e).toContain('series[0].pick.adj');
  });
  it('rejects malformed market and result', () => {
    const e = errorsOf(fixture({
      series: [series({
        market: { pWin: [0.5, 0.5], src: '', liquidity: 'lots' },
        result: { home: 2, away: 'x', games: [{ winner: 'draw', picks: { home: 'Azir', away: [] } }] },
      })],
      record: { resolved: 0, correctOutcome: 0, exactScore: 0, brier: 0 },
    }));
    expect(e).toContain('series[0].market.src');
    expect(e).toContain('series[0].market.liquidity');
    expect(e).toContain('series[0].result.away');
    expect(e).toContain('series[0].result.games[0].winner');
    expect(e).toContain('series[0].result.games[0].picks.home');
  });
});

describe('validateWorldsData — boards', () => {
  it('rejects champion sum 90', () => {
    expect(errorsOf(fixture({ champion: [{ team: 'GEN', prob: 50 }, { team: 'T1', prob: 40 }] }))).toContain('champion: probabilities sum to 90');
  });
  it('rejects mvp sum drift and missing player/teamCode', () => {
    const e = errorsOf(fixture({ mvp: [{ player: 'Chovy', prob: 60 }, { teamCode: 'T1', prob: 20 }] }));
    expect(e).toContain('mvp[0].teamCode');
    expect(e).toContain('mvp[1].player');
    expect(e).toContain('mvp: probabilities sum to 80');
  });
  it('rejects malformed fearless and meta entries', () => {
    const e = errorsOf(fixture({ fearless: [{ team: 'GEN', depth: '24', champs: null }], meta: [{ champ: 'Azir', picks: 1, bans: 1, presence: '70%' }] }));
    expect(e).toContain('fearless[0].depth');
    expect(e).toContain('fearless[0].champs');
    expect(e).toContain('meta[0].presence');
    expect(e).toContain('meta[0].winrate');
  });
});

describe('validateWorldsData — record drift guard', () => {
  const early = pick({ decidedAt: '2026-10-14T12:00:00Z' });
  const resolvedHit = series({ id: 'r1-gen-t1', round: 1, kickoff: '2026-10-15T08:00:00Z', bo: 3, pick: early, result: { home: 2, away: 1, games: [] } });
  const resolvedMiss = series({ id: 'r2-gen-t1', round: 2, kickoff: '2026-10-16T08:00:00Z', bo: 3, pick: early, result: { home: 0, away: 2, games: [] } });
  const unpicked = series({ id: 'r2-t1-gen', round: 2, kickoff: '2026-10-16T10:00:00Z', pick: null, result: { home: 1, away: 0, games: [] } });

  it('accepts matching counts (exact needs correct outcome + score match; unpicked series do not count)', () => {
    const data = fixture({ series: [resolvedHit, resolvedMiss, unpicked], record: { resolved: 2, correctOutcome: 1, exactScore: 1, brier: 0.2 } });
    expect(validateWorldsData(data)).toEqual({ ok: true, errors: [] });
  });
  it('rejects record.resolved drift', () => {
    const e = errorsOf(fixture({ series: [resolvedHit, resolvedMiss], record: { resolved: 3, correctOutcome: 1, exactScore: 1, brier: 0.2 } }));
    expect(e).toContain('record.resolved');
  });
  it('rejects correctOutcome/exactScore drift and non-finite brier', () => {
    const e = errorsOf(fixture({ series: [resolvedHit, resolvedMiss], record: { resolved: 2, correctOutcome: 2, exactScore: 0, brier: NaN } }));
    expect(e).toContain('record.correctOutcome');
    expect(e).toContain('record.exactScore');
    expect(e).toContain('record.brier');
  });
});

describe('validateWorldsData — sources[]', () => {
  it('rejects non-https url and missing label/fetchedAt', () => {
    const e = errorsOf(fixture({ sources: [{ label: '', url: 'http://gol.gg/', fetchedAt: 1 }] }));
    expect(e).toContain('sources[0].label');
    expect(e).toContain('sources[0].url');
    expect(e).toContain('sources[0].fetchedAt');
  });
});
