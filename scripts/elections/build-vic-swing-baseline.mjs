import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { vicPrimaryVotes } from '../../src/lib/electionResults.js';
import { VIC_SWING_BOUNDARY, vicComparableTcp } from './vic-swing-rules.mjs';

// Rebuild from the audited official VEC archive, not the live results store.
// git show 3fa86125^:public/assets/elections/baselines/2026-11-13/vic-2022.json |
//   node scripts/elections/build-vic-swing-baseline.mjs > scripts/elections/data/vic-2022-comparison.json
const source = readFileSync(0);
const sha256 = createHash('sha256').update(source).digest('hex');
if (sha256 !== 'fad94c9717e9cd195f613c40e2508f4056440f4e0c6a523b104a92dff229504a') {
  throw new Error('Unexpected Victorian historical archive');
}

const { races } = JSON.parse(source);
const output = races.map((race) => {
  const primary = vicPrimaryVotes(race);
  if (!primary || Object.values(primary.partyVotes).reduce((sum, votes) => sum + votes, 0) !== primary.formal) {
    throw new Error(`Historical first preferences do not reconcile for ${race.raceId}`);
  }
  return [race.raceId, { date: race.electionDate, ...primary, tcp: vicComparableTcp(race) }];
});

console.log(`{
  "year": 2022,
  "boundaryVersion": ${JSON.stringify(VIC_SWING_BOUNDARY)},
  "sourceUrl": "https://www.vec.vic.gov.au/results/state-election-results/2022-state-election-results/",
  "archiveSha256": ${JSON.stringify(sha256)},
  "races": {
${output.map(([id, race]) => `    ${JSON.stringify(id)}: ${JSON.stringify(race)}`).join(',\n')}
  }
}`);
