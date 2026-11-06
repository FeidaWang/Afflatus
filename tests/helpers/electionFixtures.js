/* Synthetic VEC-shaped feed files for tests. Everything here is invented, uses
   the sample event name, and never leaves tests/: no fixture is served by the site. */
import { crc32 } from 'node:zlib';

export const SYNTH_EVENT = 'Test State Election 2026';

const person = (id, name, party) => ({ id, name, party, independent: party === null });
export const CAST = Object.freeze({
  a: person(1, 'SYNTHETIC, Alpha', 'Australian Labor Party - Victorian Branch'),
  b: person(2, 'SYNTHETIC, Beta', 'Liberal Party of Australia - Victorian Division'),
  c: person(3, 'SYNTHETIC, Gamma', 'Australian Greens - Victoria'),
  d: person(4, 'SYNTHETIC, Delta', null),
});

const votesEl = (votes) => `<Votes>${votes ?? ''}</Votes>`;

export function candidateXml({ id, name, party, independent }, votes, { elected = false, position = 1 } = {}) {
  const affiliation = party ? `<Affiliation><eml:AffiliationIdentifier Id="9"><eml:RegisteredName>${party}</eml:RegisteredName></eml:AffiliationIdentifier></Affiliation>` : '';
  return `<Candidate Independent="${independent ? 'yes' : 'no'}"><eml:CandidateIdentifier Id="${id}"><eml:CandidateName>${name}</eml:CandidateName></eml:CandidateIdentifier>${affiliation}<Elected>${elected}</Elected><BallotPosition>${position}</BallotPosition>${votesEl(votes)}</Candidate>`;
}

/** votes: { a: 10, b: 5 }. tcp: { a: 7, b: 8 }, 'withheld', or omitted. */
export function contestXml({ name, updated = '2026-11-28T20:00:00+11:00', declared = false, returned = 3, expected = 10, votes, formal, informal = 1, tcp, elected = null, tcpUpdated = updated, id = 100 }) {
  const keys = Object.keys(votes);
  const total = formal ?? keys.reduce((sum, key) => sum + (votes[key] ?? 0), 0);
  const people = keys.map((key, index) => candidateXml(CAST[key], votes[key], { elected: elected === key, position: index + 1 })).join('');
  let two = '';
  if (tcp === 'withheld') two = `<TwoCandidatePreferred PollingPlacesReturned="0" PollingPlacesExpected="${expected}" Updated="${tcpUpdated}" Maverick="true"></TwoCandidatePreferred>`;
  else if (tcp) two = `<TwoCandidatePreferred PollingPlacesReturned="${returned}" PollingPlacesExpected="${expected}" Updated="${tcpUpdated}">${Object.entries(tcp).map(([key, value]) => `<Candidate><eml:CandidateIdentifier Id="${CAST[key].id}"><eml:CandidateName>${CAST[key].name}</eml:CandidateName></eml:CandidateIdentifier>${votesEl(value)}</Candidate>`).join('')}</TwoCandidatePreferred>`;
  return `<Contest Updated="${updated}"><eml:ContestIdentifier Id="${id}"><eml:ContestName>${name} District</eml:ContestName></eml:ContestIdentifier><PollingDistrictIdentifier Id="${id}"><Name>${name} District</Name></PollingDistrictIdentifier><Declared>${declared}</Declared><NumberOfPositions>1</NumberOfPositions><Enrolment>5000</Enrolment><FirstPreferences PollingPlacesReturned="${returned}" PollingPlacesExpected="${expected}" Updated="${updated}">${people}<Formal>${votesEl(total)}</Formal><Informal>${votesEl(informal)}</Informal><Total>${votesEl(total + informal)}</Total></FirstPreferences>${two}</Contest>`;
}

export function regionXml({ name, updated = '2026-11-28T20:00:00+11:00', declared = false, returned = 3, groups = [['Group Alpha', 40], ['Group Beta', 30]], ungrouped = 5 }) {
  const items = groups.map(([group, votes], index) => `<Group><GroupIdentifier Id="${index + 50}"><GroupName>${group}</GroupName></GroupIdentifier><TicketVotes><Votes>${votes}</Votes></TicketVotes><GroupVotes><Votes>${votes}</Votes></GroupVotes></Group>`).join('');
  const formal = groups.reduce((sum, [, votes]) => sum + votes, 0) + ungrouped;
  return `<Contest Updated="${updated}"><eml:ContestIdentifier Id="9"><eml:ContestName>${name} Region</eml:ContestName></eml:ContestIdentifier><Declared>${declared}</Declared><eml:NumberOfPositions>5</eml:NumberOfPositions><Enrolment>5000</Enrolment><FirstPreferences PollingPlacesReturned="${returned}" PollingPlacesExpected="9" Updated="${updated}">${items}<UngroupedCandidate><eml:CandidateIdentifier Id="77"><eml:CandidateName>SYNTHETIC, Solo</eml:CandidateName></eml:CandidateIdentifier><Elected>false</Elected><BallotPosition>9</BallotPosition><Votes>${ungrouped}</Votes></UngroupedCandidate><Formal><Votes>${formal}</Votes></Formal><Informal><Votes>1</Votes></Informal><Total><Votes>${formal + 1}</Votes></Total></FirstPreferences></Contest>`;
}

export function feedXml({ contests, created = '2026-11-28T20:05:00', eventName = SYNTH_EVENT, category = 'LowerHouse', electionName = `${category === 'LowerHouse' ? 'Lower' : 'Upper'} House election for the State of Victoria 2026` }) {
  const house = category === 'LowerHouse' ? 'House' : 'Senate';
  return `<?xml version="1.0" encoding="utf-8"?><MediaFeed xmlns:eml="urn:oasis:names:tc:evs:schema:eml" Verbose="true" Id="x" Created="${created}" Phase="ElectionNight" xmlns="http://www.vec.vic.gov.au"><eml:EventIdentifier Id="1"><eml:EventName>${eventName}</eml:EventName></eml:EventIdentifier><Election><eml:ElectionIdentifier Id="${category[0]}"><eml:ElectionName>${electionName}</eml:ElectionName><eml:ElectionCategory>${category}</eml:ElectionCategory></eml:ElectionIdentifier><${house}><Contests>${contests.join('')}</Contests></${house}></Election></MediaFeed>`;
}

/** A one-file ZIP with no compression. The collector reads it like a VEC archive. */
export function zipOf(name, content) {
  const data = Buffer.from(content);
  const fileName = Buffer.from(name);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(data.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(fileName.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + fileName.length, 12);
  end.writeUInt32LE(30 + fileName.length + data.length, 16);
  return Buffer.concat([local, fileName, data, entry, fileName, end]);
}

export const lowerName = (stamp) => `TestState2026mediafileverboselhv2_${stamp}.zip`;
export const upperName = (stamp) => `TestState2026mediafileverboseuhv2_${stamp}.zip`;
