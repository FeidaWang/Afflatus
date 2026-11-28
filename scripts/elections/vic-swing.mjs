import { PARTIES } from '../../src/lib/electionRules.js';
import { vicPrimaryVotes } from '../../src/lib/electionResults.js';
import baseline from './data/vic-2022-comparison.json' with { type: 'json' };
import { vicComparableTcp } from './vic-swing-rules.mjs';

const PARTY_IDS = PARTIES.au.map(({ id }) => id);
const OFFICES = ['assembly', 'council'];

const share = (votes, formal) => votes / formal * 100;
const row = (party, priorPct, currentPct, currentVotes) => ({ party, priorPct, currentPct, deltaPp: currentPct - priorPct, currentVotes });

function primaryRows(prior, current) {
  return PARTY_IDS.flatMap((party) => {
    const before = prior.partyVotes[party] ?? 0;
    const after = current.partyVotes[party] ?? 0;
    return before || after ? [row(party, share(before, prior.formal), share(after, current.formal), after)] : [];
  });
}

function tcpRows(prior, race) {
  const current = vicComparableTcp(race);
  if (!prior || !current) return null;
  const pair = Object.keys(current);
  if (pair.some((party) => !Object.hasOwn(prior, party))) return null;
  const [a, b] = pair;
  return pair.map((party) => row(party, share(prior[party], prior[a] + prior[b]), share(current[party], current[a] + current[b]), current[party]));
}

function officeSwing(matched, office) {
  if (!matched.length) return null;
  const prior = { formal: 0, partyVotes: {} };
  const current = { formal: 0, partyVotes: {} };
  const weighted = {};
  for (const { before, after } of matched) {
    prior.formal += before.formal;
    current.formal += after.formal;
    for (const party of PARTY_IDS) {
      const priorVotes = before.partyVotes[party] ?? 0;
      const currentVotes = after.partyVotes[party] ?? 0;
      prior.partyVotes[party] = (prior.partyVotes[party] ?? 0) + priorVotes;
      current.partyVotes[party] = (current.partyVotes[party] ?? 0) + currentVotes;
      // Fixed prior formal-vote weights hold the geographic mix constant.
      weighted[party] = (weighted[party] ?? 0) + before.formal * (share(currentVotes, after.formal) - share(priorVotes, before.formal));
    }
  }
  const totalContests = Object.keys(baseline.races).filter((id) => id.startsWith(`vic-2026/${office}/`)).length;
  return {
    matchedContests: matched.length,
    totalContests,
    currentFormal: current.formal,
    parties: primaryRows(prior, current).map((result) => ({ ...result, weightedDeltaPp: weighted[result.party] / prior.formal })),
  };
}

/** Derive comparisons at read time. Historical inputs never enter the published snapshot store. */
export function withVicSwing(snapshot) {
  if (snapshot?.eventId !== 'vic-2026' || snapshot.mode !== 'live' || snapshot.isSynthetic ||
      snapshot.sourceIds?.length !== 1 || snapshot.sourceIds[0] !== 'vec-2026') return snapshot;
  const matched = { assembly: [], council: [] };
  const races = {};
  for (const race of snapshot.races) {
    const before = baseline.races[race.raceId];
    if (!before || race.boundaryVersion !== baseline.boundaryVersion || !Object.hasOwn(matched, race.office)) continue;
    const after = vicPrimaryVotes(race);
    if (!after || Object.values(after.partyVotes).reduce((sum, votes) => sum + votes, 0) !== after.formal) continue;
    matched[race.office].push({ before, after });
    races[race.raceId] = {
      priorDate: before.date,
      primary: primaryRows(before, after),
      tcp: tcpRows(before.tcp, race),
    };
  }
  if (!Object.keys(races).length) return snapshot;
  return {
    ...snapshot,
    comparison: {
      schemaVersion: 1,
      priorYear: baseline.year,
      boundaryVersion: baseline.boundaryVersion,
      sourceUrl: baseline.sourceUrl,
      statewideWeights: 'prior_formal_votes',
      offices: Object.fromEntries(OFFICES.map((office) => [office, officeSwing(matched[office], office)])),
      races,
    },
  };
}
