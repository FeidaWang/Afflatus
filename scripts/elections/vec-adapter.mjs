/* VEC results data feed (EML XML with VEC extensions), Verbose files, parsed
   against the September 2026 user guide and the published sample files.
   Verbose is self-contained: names, parties and Elected need no set-up join. */
import { seatCatalogue } from '../../src/lib/electionCatalogue.js';
import { child, childrenOf, parseXml } from './safe-xml.mjs';
import { FeedError } from './bounded-fetch.mjs';

const TARGET_TERM = '2026-2030';
const ELECTION_DATE = '2026-11-28';
// VEC: the last redivision finished in October 2021 and no later one has been called.
const BOUNDARY_VERSION = 'ebc-2021';

const drift = (message) => new FeedError('schema_drift', message);

function integer(node, label) {
  const text = node?.text.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) throw drift(`${label} is not a whole number: ${text}`);
  return Number(text);
}

const attributeInteger = (node, name) => {
  const value = node?.attributes[name];
  if (value === undefined || value === '') return null;
  if (!/^\d+$/.test(value)) throw drift(`${name} is not a whole number: ${value}`);
  return Number(value);
};

function flag(node, label) {
  const text = node?.text.trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (!text) return null;
  throw drift(`${label} is not true or false: ${text}`);
}

/** An empty timestamp means no completed result. It must stay null and never borrow another time. */
function timestamp(value, label) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw drift(`${label} has no usable offset: ${value}`);
  return new Date(parsed).toISOString();
}

// Created has no offset in the feed. It is Melbourne wall-clock time, per the file-name convention.
export function melbourneToUtc(naive) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(naive || '');
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  for (const offset of [11, 10]) {
    const guess = new Date(wall - offset * 3600000);
    const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hourCycle: 'h23', hour: 'numeric' }).format(guess);
    if (Number(parts) === hour) return guess.toISOString();
  }
  return null;
}

// Pending the VEC affiliation file due 10 November. Exact names only, so "Liberal Democrats" is not the Coalition.
const PARTY_RULES = [
  [/^Australian Labor Party\b/i, 'labor'],
  [/^Liberal Party of Australia\b/i, 'coalition'],
  [/^(The )?Nationals\b|^National Party of Australia\b/i, 'coalition'],
  [/^(The )?(Australian )?Greens\b/i, 'greens'],
];

export function partyIdFor(name, independent) {
  if (independent) return 'teal';
  if (!name) return null;
  return PARTY_RULES.find(([pattern]) => pattern.test(name))?.[1] || 'other';
}

const stripSuffix = (name) => name.replace(/\s+(District|Region)$/, '');

function seatsFor(office, contestName) {
  const name = stripSuffix(contestName);
  return seatCatalogue('vic-2026', office).filter((seat) => (office === 'assembly' ? seat.label.en === name : seat.group === name));
}

function assemblyCandidates(first, nothingCounted) {
  return childrenOf(first, 'Candidate').map((node) => {
    const identifier = child(node, 'CandidateIdentifier');
    const affiliation = child(child(node, 'Affiliation'), 'AffiliationIdentifier');
    const independent = node.attributes.Independent === 'yes';
    const party = child(affiliation, 'RegisteredName')?.text.trim() || null;
    const votes = integer(child(node, 'Votes'), 'Candidate votes');
    return {
      candidateId: `vec-${identifier?.attributes.Id}`,
      name: child(identifier, 'CandidateName')?.text.trim() || null,
      party,
      partyId: partyIdFor(party, independent),
      independent,
      caucus: null,
      ballotPosition: integer(child(node, 'BallotPosition'), 'Ballot position'),
      votes: nothingCounted ? null : votes,
      elected: flag(child(node, 'Elected'), 'Elected') === true,
    };
  });
}

function councilCandidates(first, nothingCounted) {
  const groups = childrenOf(first, 'Group').map((node) => {
    const identifier = child(node, 'GroupIdentifier');
    const name = child(identifier, 'GroupName')?.text.trim() || null;
    const votes = integer(child(child(node, 'GroupVotes'), 'Votes'), 'Group votes');
    return { candidateId: `vec-group-${identifier?.attributes.Id}`, name, party: null, partyId: null, independent: false, caucus: null, ballotPosition: null, votes: nothingCounted ? null : votes, elected: false };
  });
  const ungrouped = childrenOf(first, 'UngroupedCandidate').map((node) => {
    const identifier = child(node, 'CandidateIdentifier');
    const votes = integer(child(node, 'Votes'), 'Ungrouped votes');
    return { candidateId: `vec-${identifier?.attributes.Id}`, name: child(identifier, 'CandidateName')?.text.trim() || null, party: null, partyId: 'teal', independent: true, caucus: null, ballotPosition: integer(child(node, 'BallotPosition'), 'Ballot position'), votes: nothingCounted ? null : votes, elected: flag(child(node, 'Elected'), 'Elected') === true };
  });
  return [...groups, ...ungrouped];
}

function twoCandidate(node, candidates) {
  if (!node) return { status: 'absent', candidates: [], reported: null, total: null, updatedAt: null };
  const base = { reported: attributeInteger(node, 'PollingPlacesReturned'), total: attributeInteger(node, 'PollingPlacesExpected'), updatedAt: timestamp(node.attributes.Updated, 'TCP Updated') };
  if (node.attributes.Maverick === 'true') return { status: 'withheld', candidates: [], ...base };
  const pair = childrenOf(node, 'Candidate').map((item) => ({
    candidateId: `vec-${child(item, 'CandidateIdentifier')?.attributes.Id}`,
    votes: integer(child(item, 'Votes'), 'TCP votes'),
  }));
  if (pair.length !== 2) throw drift(`TwoCandidatePreferred needs exactly two candidates, found ${pair.length}`);
  // Zeros with nothing returned are a zero file, not a tied count. A recount keeps its votes with returned at 0.
  if (!base.reported && pair.every((item) => !item.votes)) for (const item of pair) item.votes = null;
  for (const { candidateId } of pair) {
    if (!candidates.some((item) => item.candidateId === candidateId)) throw drift(`TCP candidate ${candidateId} is not in the contest`);
  }
  return { status: 'available', candidates: pair, ...base };
}

function normaliseContest(contest, { office, publishedAt, fetchedAt, payloadHash, snapshotHint, source }) {
  const contestName = child(child(contest, 'ContestIdentifier'), 'ContestName')?.text.trim();
  if (!contestName) throw drift('Contest has no name');
  const seats = seatsFor(office, contestName);
  if (!seats.length) throw new FeedError('wrong_identity', `${contestName} is not in the ${office} catalogue`);

  const first = child(contest, 'FirstPreferences');
  if (!first) throw drift(`${contestName} has no FirstPreferences`);
  const reported = attributeInteger(first, 'PollingPlacesReturned');
  const total = attributeInteger(first, 'PollingPlacesExpected');
  const sourceFormal = integer(child(child(first, 'Formal'), 'Votes'), 'Formal votes');
  // The guide says a zero can mean "nothing reported yet", so nothing counted is unknown, not zero.
  const nothingCounted = !reported && !sourceFormal;
  // A recount publishes contest totals only: returned falls to 0 while the votes stay. See the 2 Oct sample files.
  const recount = reported === 0 && Boolean(sourceFormal);
  const candidates = office === 'assembly' ? assemblyCandidates(first, nothingCounted) : councilCandidates(first, nothingCounted);
  if (!candidates.length) throw drift(`${contestName} has no candidates`);
  const ids = new Set(candidates.map((item) => item.candidateId));
  if (ids.size !== candidates.length || ids.has('vec-undefined')) throw drift(`${contestName} repeats a candidate`);

  // The source's own total is used and never recomputed. A sum that disagrees means the shape changed.
  const formal = nothingCounted ? null : sourceFormal;
  if (formal !== null && candidates.some((item) => item.votes === null)) throw drift(`${contestName}: a candidate has no votes while Formal says ${formal}`);
  const counted = candidates.reduce((sum, item) => sum + (item.votes ?? 0), 0);
  if (formal !== null && counted !== formal) throw drift(`${contestName}: candidates add to ${counted}, Formal says ${formal}`);

  const declared = flag(child(contest, 'Declared'), 'Declared') === true;
  const winners = candidates.filter((item) => item.elected).map((item) => item.candidateId);
  // Declared with no winner would read as the VEC withdrawing a result, when the file has only changed shape.
  if (declared && office === 'assembly' && winners.length !== 1) throw drift(`${contestName} is declared with ${winners.length} elected`);

  return {
    raceId: `vic-2026/${office}/${office === 'assembly' ? seats[0].seatId : seats[0].area}`,
    eventId: 'vic-2026',
    electionDate: ELECTION_DATE,
    office,
    seatIds: seats.map((seat) => seat.seatId),
    contestName,
    sourceContestId: child(contest, 'ContestIdentifier').attributes.Id ?? null,
    contestKind: 'regular',
    targetTerm: TARGET_TERM,
    boundaryVersion: BOUNDARY_VERSION,
    positions: integer(child(contest, 'NumberOfPositions'), 'Positions'),
    enrolment: integer(child(contest, 'Enrolment'), 'Enrolment'),
    candidates: candidates.map(({ elected: _elected, ...candidate }) => candidate),
    totals: {
      formal,
      informal: nothingCounted ? null : integer(child(child(first, 'Informal'), 'Votes'), 'Informal votes'),
      total: nothingCounted ? null : integer(child(child(first, 'Total'), 'Votes'), 'Total votes'),
    },
    twoCandidate: office === 'assembly' ? twoCandidate(child(contest, 'TwoCandidatePreferred'), candidates) : null,
    leaderBasis: office === 'assembly' ? 'tcp' : null,
    coverage: 'available',
    counting: { method: office === 'assembly' ? 'preferential' : 'stv', status: nothingCounted ? 'no_votes' : recount ? 'recount' : 'counting', round: null },
    decision: declared
      ? { status: 'certified', candidateIds: winners, authority: 'VEC', evidenceUrl: source.url, decidedAt: null, firstObservedAt: publishedAt ?? fetchedAt }
      : { status: 'uncalled', candidateIds: [], authority: null, evidenceUrl: null, decidedAt: null, firstObservedAt: null },
    progress: { unit: 'polling_places', reported: recount ? null : reported, total, isEstimate: false },
    provenance: {
      sourceId: source.id,
      sourceUrl: source.url,
      sourceUpdatedAt: timestamp(contest.attributes.Updated, `${contestName} Updated`),
      fetchedAt,
      publishedAt,
      snapshotId: snapshotHint,
      payloadHash,
    },
  };
}

/** Turns one feed file into races, after checking it is the election and house it should be. */
export function parseVecFeed(xml, { feed, source, fetchedAt, payloadHash, fileName }) {
  let root;
  try {
    root = parseXml(xml);
  } catch (error) {
    throw new FeedError('malformed', error.message);
  }
  if (root.name !== 'MediaFeed') throw drift(`Root element is ${root.name}`);
  const eventName = child(child(root, 'EventIdentifier'), 'EventName')?.text.trim();
  if (!source.expectedEventName || eventName !== source.expectedEventName) {
    throw new FeedError('wrong_identity', `Event is "${eventName}", expected "${source.expectedEventName}"`);
  }
  const election = child(root, 'Election');
  const identifier = child(election, 'ElectionIdentifier');
  const category = child(identifier, 'ElectionCategory')?.text.trim();
  if (category !== feed.category) throw new FeedError('wrong_identity', `File is ${category}, expected ${feed.category}`);
  if (!/2026/.test(child(identifier, 'ElectionName')?.text || '')) throw new FeedError('wrong_identity', 'Election name does not say 2026');

  const publishedAt = melbourneToUtc(root.attributes.Created);
  // Lower House contests sit under House, Upper House under Senate.
  const contests = childrenOf(child(child(election, feed.category === 'UpperHouse' ? 'Senate' : 'House'), 'Contests'), 'Contest');
  if (!contests.length) throw drift('File has no contests');
  const seen = new Set();
  const races = contests.map((contest) => {
    const race = normaliseContest(contest, { office: feed.office, publishedAt, fetchedAt, payloadHash, snapshotHint: fileName, source });
    if (seen.has(race.raceId)) throw drift(`${race.contestName} appears twice`);
    seen.add(race.raceId);
    return race;
  });
  return { eventName, publishedAt, phase: root.attributes.Phase ?? null, races };
}
