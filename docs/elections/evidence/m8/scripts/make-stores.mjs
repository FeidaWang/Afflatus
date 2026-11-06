// All data here is invented, stays in the scratchpad and is only served on 127.0.0.1.
import { mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
const [root, SP] = process.argv.slice(2);
const { collectOnce, directoryTransport } = await import(root + '/scripts/elections/collector.mjs');
const { sourceById } = await import(root + '/src/config/electionSources.js');
const { seatCatalogue } = await import(root + '/src/lib/electionCatalogue.js');
const { snapshotErrors, pointerErrors } = await import(root + '/src/lib/electionResults.js');
const { VIC_REGIONS } = await import(root + '/src/config/electionElectorates.generated.js');
const F = await import(root + '/tests/helpers/electionFixtures.js');
const source = sourceById('vec-sample');
const seats = seatCatalogue('vic-2026', 'assembly').map((s) => s.label.en);
const utc = (stamp) => { const m = stamp.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/); return Date.UTC(+m[1], +m[2]-1, +m[3], +m[4]-11, +m[5], +m[6]); };
const iso = (stamp) => { const m = stamp.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/); return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`; };

function contest(name, i, stage, stamp) {
  const updated = `${iso(stamp)}+11:00`;
  const n = i % 10;
  // Labor leads about 45%, Liberal 35%, Greens 12%, Independent 8%: no party reaches 45 of 88.
  const leader = n < 4 ? 'a' : n < 7 ? 'b' : n === 7 ? 'c' : n === 8 ? 'd' : 'a';
  const other = leader === 'b' ? 'a' : 'b';
  const base = 2000 + i * 13 + stage * 700;
  const votes = { a: base, b: base - 150 - (i % 40), c: Math.round(base * 0.3), d: Math.round(base * 0.2) };
  if (leader !== 'a') { votes[leader] = base + 200; }
  if (leader === 'b') votes.a = base - 200;
  const out = { name, updated, id: 100 + i, returned: 2 + stage, expected: 12, votes, informal: 3 };
  if (i % 11 !== 3) out.tcp = { [leader]: base + 900, [other]: base + 300 };
  if (i === 5) out.tcp = 'withheld';
  if (i === 6) out.tcp = { [leader]: base, [other]: base }; // a true tie
  return out;
}
const lowerAt = (stamp, stage, { count, omit = [], declared = [], correct = [] }) => {
  const list = seats.slice(0, count).map((name, i) => [name, i]).filter(([name]) => !omit.includes(name));
  const contests = list.map(([name, i]) => {
    const c = contest(name, i, stage, stamp);
    if (correct.includes(name)) { c.votes.a -= 950; c.tcp = c.tcp && c.tcp !== 'withheld' ? Object.fromEntries(Object.entries(c.tcp).map(([k, v]) => [k, v])) : c.tcp; }
    if (declared.includes(name)) { c.declared = true; c.elected = Object.keys(c.votes).sort((x, y) => c.votes[y] - c.votes[x])[0]; }
    return F.contestXml(c);
  });
  return F.feedXml({ contests, created: iso(stamp) });
};
const upperAt = (stamp, stage, count) => F.feedXml({ category: 'UpperHouse', created: iso(stamp), contests: VIC_REGIONS.slice(0, count).map((r, i) => F.regionXml({ name: r.name, updated: `${iso(stamp)}+11:00`, returned: 2 + stage, groups: [['Group Alpha', 4000 + i * 10 + stage * 200], ['Group Beta', 3000 + stage * 100]], ungrouped: 50 })) });

const dir = join(SP, 'zips/vic'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const store = join(SP, 'stores/vic-live'); rmSync(store, { recursive: true, force: true });
const declared = seats.slice(0, 12);
const series = [
  ['20261128_190000', lowerAt('20261128_190000', 1, { count: 30 }), upperAt('20261128_190000', 1, 2)],
  ['20261128_193000', lowerAt('20261128_193000', 2, { count: 60 }), upperAt('20261128_193000', 2, 4)],
  ['20261128_200000', lowerAt('20261128_200000', 3, { count: 66, omit: [seats[20]] }), upperAt('20261128_200000', 3, 5)],
  ['20261209_120000', lowerAt('20261209_120000', 5, { count: 66, declared }), upperAt('20261209_120000', 5, 5)],
  // Correction and a withdrawn declaration in one published file.
  ['20261210_120000', lowerAt('20261210_120000', 5, { count: 66, declared: declared.slice(1), correct: [seats[8], seats[0]] }), upperAt('20261210_120000', 5, 5)],
];
const log = [];
for (const [stamp, lower, upper] of series) {
  writeFileSync(join(dir, F.lowerName(stamp)), F.zipOf('l.xml', lower));
  writeFileSync(join(dir, F.upperName(stamp)), F.zipOf('u.xml', upper));
  log.push([stamp, await collectOnce({ source, store, force: true, now: utc(stamp) + 60000, transport: directoryTransport(dir, { asOf: stamp.replace('_', '') }) })]);
}
// Source error store: a copy plus one corrupt lower-house file.
const errStore = join(SP, 'stores/vic-error'); rmSync(errStore, { recursive: true, force: true }); cpSync(store, errStore, { recursive: true });
const bad = '20261210_130000';
writeFileSync(join(dir, F.lowerName(bad)), Buffer.from('this is not a zip file at all, not even close to one....'));
writeFileSync(join(dir, F.upperName(bad)), F.zipOf('u.xml', upperAt(bad, 6, 5)));
log.push(['error', await collectOnce({ source, store: errStore, force: true, now: utc(bad) + 60000, transport: directoryTransport(dir, { asOf: bad.replace('_', '') }) })]);
console.log(JSON.stringify(log.map(([s, r]) => [s, r.outcome, r.kinds]), null, 0));

// ---- US: hand-written, because no US adapter exists. Validated with the page's own validator.
const now = '2026-11-06T02:00:00.000Z';
const prov = (id) => ({ sourceId: 'civicapi', sourceUrl: 'https://example.invalid/synthetic', sourceUpdatedAt: '2026-11-05T22:30:00.000Z', fetchedAt: now, publishedAt: now, snapshotId: id, payloadHash: 'synthetic' });
const cand = (id, name, party, partyId, votes, pos) => ({ candidateId: id, name, party, partyId, independent: partyId === 'other', caucus: null, ballotPosition: pos, votes });
const called = (id) => ({ status: 'provider_called', candidateIds: [id], authority: 'SYNTHETIC desk', evidenceUrl: 'https://example.invalid/call', decidedAt: '2026-11-05T12:00:00.000Z', firstObservedAt: null });
const uncalled = { status: 'uncalled', candidateIds: [], authority: null, evidenceUrl: null, decidedAt: null, firstObservedAt: null };
function usRace(office, seat, i, id) {
  const d = 90000 + i * 37, r = 88000 + (i % 13) * 3100;
  const list = [cand('d', 'SYNTHETIC Dem', 'Democratic', 'dem', d, 1), cand('r', 'SYNTHETIC Rep', 'Republican', 'rep', r, 2)];
  const race = { raceId: `us-2026/${office}/${seat.seatId}`, eventId: 'us-2026', electionDate: '2026-11-03', office, seatIds: [seat.seatId], contestName: seat.label.en, contestKind: seat.contest || 'regular', targetTerm: seat.term, candidates: list, totals: { formal: null, informal: null, total: d + r }, twoCandidate: null, leaderBasis: 'votes', coverage: 'available', counting: { method: 'plurality', status: 'counting', round: null }, decision: uncalled, progress: { unit: 'precincts', reported: 300 + i, total: 500 + i, isEstimate: false }, provenance: prov(id) };
  return race;
}
const usId = 'us-2026-synth-1';
const house = seatCatalogue('us-2026', 'house'); const senate = seatCatalogue('us-2026', 'senate').filter((s) => s.onBallot);
const races = [];
house.forEach((seat, i) => {
  if (i % 11 === 5) return; // partial coverage
  const race = usRace('house', seat, i, usId);
  const k = i % 10;
  if (k < 4) race.decision = called('d');
  else if (k < 8) race.decision = called('r');
  else if (k === 8) race.candidates[0].votes = race.candidates[1].votes + 500;
  if (seat.seatId === 'AK-AL') { race.counting = { method: 'rcv', status: 'rcv_pending', round: 1 }; race.decision = uncalled; }
  if (seat.seatId === 'CA-12') { race.candidates = [cand('d', 'SYNTHETIC First', 'Democratic', 'dem', 150000, 1), cand('d2', 'SYNTHETIC Second', 'Democratic', 'dem', 120000, 2)]; race.decision = uncalled; race.totals.total = 270000; }
  if (seat.seatId === 'VT-AL') { race.candidates = [cand('i', 'SYNTHETIC Independent', null, 'other', 200000, 1), cand('wi', 'Write-ins', null, null, null, 2)]; race.decision = uncalled; }
  if (seat.seatId === 'WY-AL') { race.counting.status = 'no_votes'; race.candidates.forEach((c) => { c.votes = null; }); race.decision = uncalled; race.totals.total = null; race.progress = { unit: 'precincts', reported: null, total: null, isEstimate: false }; }
  races.push(race);
});
senate.forEach((seat, i) => { const race = usRace('senate', seat, i, usId); if (i % 3 === 0) race.decision = called('d'); else if (i % 3 === 1) race.decision = called('r'); races.push(race); });
const usSnap = { schemaVersion: 1, eventId: 'us-2026', snapshotId: usId, mode: 'preview', isSynthetic: true, sourceIds: ['civicapi'], publishedAt: now, sourcePublishedAt: now, contentHash: 'x', previousSnapshotId: null, scope: { offices: ['house', 'senate'] }, changes: [], races };
const usPtr = { schemaVersion: 1, eventId: 'us-2026', revision: 1, snapshotId: usId, publishedAt: now, isSynthetic: true, sourceIds: ['civicapi'], updatedAt: now, history: [{ snapshotId: usId, publishedAt: now, sourcePublishedAt: now, isSynthetic: true }], sources: [{ sourceId: 'civicapi', name: 'SYNTHETIC US', url: 'https://example.invalid', status: 'ok', feeds: [], lastCheckedAt: now, sourceUpdatedAt: '2026-11-05T22:30:00.000Z', lastSuccessAt: now, lastError: null }] };
console.log('US errors', snapshotErrors(usSnap).slice(0, 5), pointerErrors(usPtr));
const write = (st, ev, ptr, snap) => { mkdirSync(join(st, ev, 'snapshots'), { recursive: true }); writeFileSync(join(st, ev, 'latest.json'), JSON.stringify(ptr)); for (const s of [].concat(snap)) writeFileSync(join(st, ev, 'snapshots', s.snapshotId + '.json'), JSON.stringify(s)); };
for (const st of [store, errStore]) write(st, 'us-2026', usPtr, usSnap);

// ---- Validator gaps: values the page trusts without checking. nsw = injection, au = crash.
const nsw = seatCatalogue('nsw-2027', 'assembly')[0];
const nid = 'nsw-synth-1';
const evil = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const nswRace = { raceId: 'nsw/a', eventId: 'nsw-2027', electionDate: '2027-03-13', office: 'assembly', seatIds: [nsw.seatId], contestName: nsw.label.en, contestKind: 'regular', candidates: [cand('a', 'A', 'x', 'labor', 10, 1), cand('b', 'B', 'y', 'coalition', 5, 2)], totals: { formal: 15 }, twoCandidate: { status: 'available', candidates: [{ candidateId: 'a', votes: evil }, { candidateId: 'b', votes: evil }] }, leaderBasis: 'votes', coverage: 'available', counting: { method: 'preferential', status: 'counting', round: null }, decision: uncalled, progress: { unit: 'polling_places', reported: 1, total: 2 }, provenance: { ...prov(nid), sourceId: 'civicapi' } };
const nswSnap = { schemaVersion: 1, eventId: 'nsw-2027', snapshotId: nid, mode: 'preview', isSynthetic: true, sourceIds: ['civicapi'], publishedAt: now, changes: [{ type: 'new_batch', raceId: 'nsw/a', delta: evil }], races: [nswRace] };
const nswPtr = { schemaVersion: 1, eventId: 'nsw-2027', revision: 1, snapshotId: nid, publishedAt: now, isSynthetic: true, sourceIds: ['civicapi'], history: [], sources: [{ sourceId: 'civicapi', name: 'x', status: 'ok', feeds: [], lastCheckedAt: now, sourceUpdatedAt: now, lastSuccessAt: now }] };
console.log('NSW errors', snapshotErrors(nswSnap), pointerErrors(nswPtr));
write(store, 'nsw-2027', nswPtr, nswSnap);
const aid = 'au-synth-1';
const auSnap = { schemaVersion: 1, eventId: 'au-2028', snapshotId: aid, mode: 'preview', isSynthetic: true, sourceIds: ['civicapi'], publishedAt: 'not a date', changes: [{ type: 'made_up_type', raceId: 'x' }], races: [] };
const auPtr = { schemaVersion: 1, eventId: 'au-2028', revision: 1, snapshotId: aid, publishedAt: 'not a date', isSynthetic: true, sourceIds: ['civicapi'], history: [], sources: [{ sourceId: 'civicapi', name: 'x', status: 'ok', feeds: [], lastCheckedAt: 'not a date', sourceUpdatedAt: 'not a date', lastSuccessAt: now }] };
console.log('AU errors', snapshotErrors(auSnap), pointerErrors(auPtr));
write(store, 'au-2028', auPtr, auSnap);
