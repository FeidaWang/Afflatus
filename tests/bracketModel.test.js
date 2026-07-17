import { describe, it, expect } from 'vitest';
import { parseScoreLabel, buildWcStages, codeFor } from '../src/lib/bracketModel.js';

const LOG = [
  { id: 'wc-fra-mar', label_en: 'France 2-0 Morocco' },
  { id: 'wc-sui-col', label_en: 'Switzerland 0-0 Colombia (Switzerland win 4-3 pens)' },
  { id: 'wc-nor-eng', label_en: 'Norway 1-2 England (AET)' },
  { id: 'wc-fra-esp', label_en: 'France 0-2 Spain' },
  { id: 'wc-arg-eng', label_en: 'Argentina 2-1 England' },
];

const leg = (id, home, away, winner, extra = {}) => ({
  [id.key]: id.val, home, home_zh: home, homeFlag: '🏳️', away, away_zh: away, awayFlag: '🏳️', winner, ...extra,
});

const BRACKET = {
  qf: [{ id: 'qf1', date: '2026-07-09', legs: [
    leg({ key: 'r16Id', val: 'wc-fra-mar' }, 'France', 'Morocco', 'home'),
    leg({ key: 'r16Id', val: 'wc-sui-col' }, 'Switzerland', 'Colombia', 'home'),
  ] }],
  sf: [{ id: 'sf1', date: '2026-07-14', legs: [
    leg({ key: 'qfId', val: 'wc-nor-eng' }, 'Norway', 'England', 'away'),
  ] }],
  third: [{ id: 'wc-third', date: '2026-07-18', venue_en: 'Miami', venue_zh: '迈阿密',
    home: 'France', home_zh: '法国', homeFlag: '🏳️', away: 'England', away_zh: '英格兰', awayFlag: '🏳️', winner: null }],
  final: [{ id: 'final', date: '2026-07-19', venue_en: 'East Rutherford', venue_zh: '东卢瑟福', legs: [
    leg({ key: 'sfId', val: 'wc-fra-esp' }, 'France', 'Spain', 'away'),
    leg({ key: 'sfId', val: 'wc-arg-eng' }, 'Argentina', 'England', 'home'),
  ] }],
};

describe('parseScoreLabel', () => {
  it('parses a plain scoreline', () => {
    expect(parseScoreLabel('France 2-0 Morocco')).toEqual({ left: 'France', h: 2, a: 0, right: 'Morocco', extra: '' });
  });
  it('parses penalties and AET annotations', () => {
    const p = parseScoreLabel('Switzerland 0-0 Colombia (Switzerland win 4-3 pens)');
    expect(p.h).toBe(0); expect(p.a).toBe(0); expect(p.extra).toContain('pens');
    expect(parseScoreLabel('Norway 1-2 England (AET)').extra).toBe('(AET)');
  });
  it('returns null on junk', () => {
    expect(parseScoreLabel('no score here')).toBeNull();
    expect(parseScoreLabel('')).toBeNull();
  });
});

describe('buildWcStages', () => {
  const stages = buildWcStages(BRACKET, LOG);

  it('derives R16/QF/SF/third/F, each stage from the next slot\'s legs', () => {
    expect(stages.map((s) => s.key)).toEqual(['r16', 'qf', 'sf', 'third', 'f']);
    expect(stages[0].matches).toHaveLength(2);
    expect(stages[1].matches).toHaveLength(1);
    expect(stages[2].matches).toHaveLength(2);
  });

  it('renders an unplayed 3rd-place match with no score/winner', () => {
    const third = stages[3].matches[0];
    expect(third.home.name_en).toBe('France');
    expect(third.away.name_en).toBe('England');
    expect(third.score).toBeNull();
    expect(third.winner).toBeNull();
  });

  it('derives the 3rd-place score/winner once the log has a result', () => {
    const played = buildWcStages(BRACKET, [...LOG, { id: 'wc-third', label_en: 'France 3-1 England' }]);
    const third = played.find((s) => s.key === 'third').matches[0];
    expect(third.score).toEqual({ h: 3, a: 1, extra: '' });
    expect(third.winner).toBe('home');
  });

  it('attaches oriented scores from the log', () => {
    const fraMar = stages[0].matches[0];
    expect(fraMar.score).toEqual({ h: 2, a: 0, extra: '' });
    const norEng = stages[1].matches[0];
    expect(norEng.score.extra).toBe('(AET)');
    expect(norEng.winner).toBe('away');
  });

  it('builds the final pairing from the final slot leg winners (ESP vs ARG)', () => {
    const f = stages[4].matches[0];
    expect(f.home.name_en).toBe('Spain');
    expect(f.away.name_en).toBe('Argentina');
    expect(f.date).toBe('2026-07-19');
    expect(f.score).toBeNull();   // not played in this fixture
    expect(f.winner).toBeNull();
  });

  it('tolerates partial tournaments (qf only)', () => {
    const early = buildWcStages({ qf: BRACKET.qf }, LOG);
    expect(early.map((s) => s.key)).toEqual(['r16']);
  });

  it('handles empty/missing input', () => {
    expect(buildWcStages(null)).toEqual([]);
    expect(buildWcStages({}, [])).toEqual([]);
  });
});

describe('codeFor', () => {
  it('maps known teams and falls back to 3 letters', () => {
    expect(codeFor('Switzerland')).toBe('SUI');
    expect(codeFor('Netherlands')).toBe('NED');
    expect(codeFor('Atlantis')).toBe('ATL');
  });
});
