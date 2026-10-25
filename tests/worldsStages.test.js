import { describe, it, expect } from 'vitest';
import { STAGES, buildStages, currentStageIndex, nextKickoff } from '../src/lib/worldsStages.js';

function s(id, stage, round, kickoff, result = null) {
  return { id, stage, round, bo: 3, kickoff, home: 'GEN', away: 'T1', pick: null, missed: false, market: null, result };
}
const WIN = { home: 2, away: 0, games: [] };

describe('STAGES', () => {
  it('has 8 frozen entries R1–R5, QF, SF, F', () => {
    expect(STAGES.map((x) => x.key)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'qf', 'sf', 'f']);
    expect(STAGES.map((x) => x.label_en)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'QF', 'SF', 'F']);
    expect(STAGES[0]).toMatchObject({ stage: 'swiss', round: 1, label_zh: 'R1', long_en: 'Swiss round 1', long_zh: '瑞士轮第一轮' });
    expect(STAGES[5]).toMatchObject({ stage: 'qf', long_en: 'Quarterfinals', long_zh: '八强' });
    expect(STAGES[6]).toMatchObject({ stage: 'sf', long_en: 'Semifinals', long_zh: '半决赛' });
    expect(STAGES[7]).toMatchObject({ stage: 'final', long_en: 'Final', long_zh: '决赛' });
    expect(Object.isFrozen(STAGES)).toBe(true);
  });
});

describe('buildStages', () => {
  it('buckets swiss by round and knockouts by stage, sorted by kickoff', () => {
    const series = [
      s('r1-b', 'swiss', 1, '2026-10-15T10:00:00Z'),
      s('r1-a', 'swiss', 1, '2026-10-15T08:00:00Z'),
      s('r3-a', 'swiss', 3, '2026-10-20T08:00:00Z'),
      s('qf1', 'qf', undefined, '2026-10-28T08:00:00Z'),
      s('f', 'final', undefined, '2026-11-08T08:00:00Z'),
      s('bogus', 'group', 1, '2026-10-01T00:00:00Z'),
      s('r9', 'swiss', 9, '2026-10-01T00:00:00Z'),
    ];
    const stages = buildStages(series);
    expect(stages).toHaveLength(8);
    expect(stages[0].matches.map((m) => m.id)).toEqual(['r1-a', 'r1-b']);
    expect(stages[1].matches).toEqual([]);
    expect(stages[2].matches.map((m) => m.id)).toEqual(['r3-a']);
    expect(stages[5].matches.map((m) => m.id)).toEqual(['qf1']);
    expect(stages[7].matches.map((m) => m.id)).toEqual(['f']);
    expect(stages[0]).toMatchObject({ key: 'r1', label_en: 'R1' });
    const all = stages.flatMap((st) => st.matches.map((m) => m.id));
    expect(all).not.toContain('bogus');
    expect(all).not.toContain('r9');
  });
});

describe('currentStageIndex', () => {
  const now = Date.parse('2026-10-20T00:00:00Z');
  it('is the first stage with an unresolved match (R1–R2 resolved, R3 open → 2)', () => {
    const stages = buildStages([
      s('r1', 'swiss', 1, '2026-10-15T08:00:00Z', WIN),
      s('r2', 'swiss', 2, '2026-10-16T08:00:00Z', WIN),
      s('r3', 'swiss', 3, '2026-10-20T08:00:00Z'),
      s('r4', 'swiss', 4, '2026-10-21T08:00:00Z'),
    ]);
    expect(currentStageIndex(stages, now)).toBe(2);
  });
  it('falls back to the last stage with matches when everything is resolved', () => {
    const stages = buildStages([
      s('r1', 'swiss', 1, '2026-10-15T08:00:00Z', WIN),
      s('r2', 'swiss', 2, '2026-10-16T08:00:00Z', WIN),
    ]);
    expect(currentStageIndex(stages, now)).toBe(1);
  });
  it('is 0 when there are no matches at all', () => {
    expect(currentStageIndex(buildStages([]), now)).toBe(0);
  });
});

describe('nextKickoff', () => {
  const series = [
    s('r1', 'swiss', 1, '2026-10-15T08:00:00Z', WIN),
    s('r3-late', 'swiss', 3, '2026-10-20T12:00:00Z'),
    s('r3-early', 'swiss', 3, '2026-10-20T08:00:00Z'),
    s('r3-past-open', 'swiss', 3, '2026-10-19T08:00:00Z'),
  ];
  it('returns the earliest unresolved kickoff strictly after now, skipping resolved and past series', () => {
    expect(nextKickoff(series, Date.parse('2026-10-20T00:00:00Z'))).toBe('2026-10-20T08:00:00Z');
    expect(nextKickoff(series, new Date('2026-10-20T08:00:00Z'))).toBe('2026-10-20T12:00:00Z');
  });
  it('returns null when nothing is upcoming', () => {
    expect(nextKickoff(series, Date.parse('2026-12-01T00:00:00Z'))).toBeNull();
    expect(nextKickoff([], 0)).toBeNull();
  });
});
