import { displayPartyId } from '../../src/lib/electionRules.js';

export const VIC_SWING_BOUNDARY = 'ebc-2021';
const STABLE_TCP_PARTIES = new Set(['coalition', 'labor', 'greens', 'onenation']);

// Independents and the catch-all category do not identify the same finalist across elections.
export function vicComparableTcp(race) {
  const pair = race.twoCandidate;
  if (race.office !== 'assembly' || pair?.status !== 'available' || pair.candidates.length !== 2) return null;
  const entries = pair.candidates.map(({ candidateId, votes }) => {
    const party = displayPartyId(race.candidates.find((candidate) => candidate.candidateId === candidateId));
    return [party, votes];
  });
  if (entries.some(([party, votes]) => !STABLE_TCP_PARTIES.has(party) || !Number.isInteger(votes) || votes < 0) ||
      entries[0][0] === entries[1][0] || entries[0][1] + entries[1][1] === 0) return null;
  return Object.fromEntries(entries);
}
