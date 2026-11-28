import { describe, expect, it } from 'vitest';
import baseline from '../scripts/elections/data/vic-2022-comparison.json';
import { withVicSwing } from '../scripts/elections/vic-swing.mjs';

const district = (id, votes, tcp, boundaryVersion = 'ebc-2021') => ({
  raceId: `vic-2026/assembly/${id}`,
  office: 'assembly',
  boundaryVersion,
  coverage: 'available',
  totals: { formal: Object.values(votes).reduce((sum, count) => sum + count, 0) },
  candidates: Object.entries(votes).map(([partyId, count]) => ({ candidateId: partyId, partyId, votes: count })),
  twoCandidate: tcp && { status: 'available', candidates: Object.entries(tcp).map(([candidateId, count]) => ({ candidateId, votes: count })) },
});
const snapshot = (...races) => ({ eventId: 'vic-2026', mode: 'live', isSynthetic: false, sourceIds: ['vec-2026'], races });

describe('Victorian swing', () => {
  it('reconciles the historical formal vote to official totals including the Narracan supplementary', () => {
    const races = Object.entries(baseline.races);
    const sum = (office) => races.filter(([id]) => id.includes(`/${office}/`)).reduce((total, [, race]) => total + race.formal, 0);
    expect(races).toHaveLength(96);
    expect(sum('assembly')).toBe(3_617_000 + 37_205);
    expect(sum('council')).toBe(3_752_406);
  });

  it('calculates raw and fixed-weight swings on identical contests without treating missing returns as zero', () => {
    const result = withVicSwing(snapshot(
      district('albert-park', { labor: 3, coalition: 7 }),
      district('narracan', { labor: 60, coalition: 40 }),
      district('bass', { labor: 0, coalition: 0 }),
      district('bayswater', { labor: 30, coalition: 70 }, null, 'changed-boundary'),
    )).comparison;
    const assembly = result.offices.assembly;
    expect(assembly).toMatchObject({ matchedContests: 2, totalContests: 88, currentFormal: 110 });
    const labor = assembly.parties.find((party) => party.party === 'labor');
    const prior = 14254 / (39110 + 37205) * 100;
    expect(labor.priorPct).toBeCloseTo(prior);
    expect(labor.currentPct).toBeCloseTo(63 / 110 * 100);
    expect(labor.deltaPp).toBeCloseTo(63 / 110 * 100 - prior);
    expect(labor.weightedDeltaPp).toBeCloseTo((39110 * 30 + 37205 * 60) / (39110 + 37205) - prior);
    expect(result.races['vic-2026/assembly/narracan'].priorDate).toBe('2023-01-28');
    expect(result.races).not.toHaveProperty('vic-2026/assembly/bass');
    expect(result.races).not.toHaveProperty('vic-2026/assembly/bayswater');
  });

  it('uses the actual 2CP denominator and declines changed finalist pairs', () => {
    const same = district('albert-park', { labor: 40, coalition: 30, greens: 30 }, { coalition: 49, labor: 41 });
    const different = district('albert-park', { labor: 40, coalition: 30, greens: 30 }, { coalition: 49, greens: 41 });
    const id = same.raceId;
    const rows = withVicSwing(snapshot(same)).comparison.races[id].tcp;
    expect(rows.find((party) => party.party === 'coalition').deltaPp).toBeCloseTo(49 / 90 * 100 - 15194 / 39110 * 100);
    expect(withVicSwing(snapshot(different)).comparison.races[id].tcp).toBeNull();
    const synthetic = { ...snapshot(same), isSynthetic: true };
    expect(withVicSwing(synthetic)).toBe(synthetic);
  });
});
