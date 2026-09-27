/** Offline review only. No fetching, publication, scheduling or credentials. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSnapshot } from '../src/sectors/frontier/frontier-core.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const identity = row => row.id ?? JSON.stringify([row.cohort_id, row.model_id, row.metric_id, row.protocol_id]);
const collections = ['sources', 'metrics', 'cohorts', 'models', 'observations'];

export function reviewSnapshots(previous, candidate) {
  assertSnapshot(previous);
  assertSnapshot(candidate);
  if (!candidate.snapshot_id || candidate.snapshot_id === previous.snapshot_id) throw Error('A new snapshot_id is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.retrieved_on) || !Number.isFinite(Date.parse(candidate.retrieved_on)) || new Date(candidate.retrieved_on).toISOString().slice(0, 10) !== candidate.retrieved_on) throw Error('retrieved_on must be a date.');
  if (candidate.retrieved_on < previous.retrieved_on) throw Error('Candidate retrieval date precedes baseline.');
  const changes = [];
  for (const name of collections) {
    const before = new Map(previous[name].map(row => [identity(row), row]));
    const after = new Map(candidate[name].map(row => [identity(row), row]));
    for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      const a = before.get(id), b = after.get(id);
      if (!a || !b) changes.push({ collection: name, id, field: '*', before: a ?? null, after: b ?? null });
      else for (const field of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
        if (!same(a[field], b[field])) changes.push({ collection: name, id, field, before: a[field] ?? null, after: b[field] ?? null });
      }
    }
  }
  for (const field of [...new Set([...Object.keys(previous), ...Object.keys(candidate)])].sort()) {
    if (!collections.includes(field) && !same(previous[field], candidate[field])) changes.push({ collection: 'snapshot', id: candidate.snapshot_id, field, before: previous[field] ?? null, after: candidate[field] ?? null });
  }
  const flags = new Set(['Human review required; this tool cannot publish.']);
  for (const c of changes) {
    if (c.collection === 'sources') flags.add('Source identity/content changed: review provenance and usage rights.');
    if (['metrics', 'cohorts'].includes(c.collection)) flags.add('Metric/cohort definition changed: split version histories; do not infer improvement across rebases.');
    if (c.collection === 'observations') flags.add('Observation changed: review numeric drift, missingness, configuration and potential ranking effects.');
    if (c.collection === 'models') flags.add('Model metadata/prices changed: verify configuration, units and source mapping.');
  }
  return { status: 'needs_review', publishable: false, flags: [...flags], changes };
}

const cell = value => JSON.stringify(value).replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function renderReview(review) {
  return ['# Sectors snapshot review', '', 'Status: needs_review. Publication is not implemented.', '',
    ...review.flags.map(flag => `- ${flag}`), '',
    '| Collection | Identity | Field | Before | After |', '| --- | --- | --- | --- | --- |',
    ...review.changes.map(c => `| ${cell(c.collection)} | ${cell(c.id)} | ${cell(c.field)} | ${cell(c.before)} | ${cell(c.after)} |`), '',
    'Reviewer must reconcile each changed value against the retained raw material. Hashes prove byte identity, not truth or extraction accuracy.', '',
  ].join('\n');
}

/** Evidence paths are relative to the manifest. Raw files never enter public/. */
export async function createReviewBundle({ baseline, candidate, evidence, root }) {
  const [beforeBytes, afterBytes, evidenceBytes] = await Promise.all([baseline, candidate, evidence].map(path => readFile(path)));
  const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes);
  const review = reviewSnapshots(before, after);
  const manifest = JSON.parse(evidenceBytes);
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.records) || !manifest.records.length) throw Error('Evidence manifest schema_version 1 and records required.');
  const records = [];
  for (const record of manifest.records) {
    if (!after.sources.some(source => source.id === record.source_id && source.url === record.url)) throw Error('Evidence source identity must match candidate source.');
    if (!record.version || typeof record.version !== 'string') throw Error('Explicit source version required (use unknown when unavailable).');
    if (!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(record.retrieved_at) || !Number.isFinite(Date.parse(record.retrieved_at))) throw Error('UTC retrieval timestamp required.');
    if (!['api_response', 'manual_export'].includes(record.method)) throw Error('Supported acquisition method required.');
    if (typeof record.raw_path !== 'string' || !record.raw_path) throw Error('raw_path required.');
    const bytes = await readFile(resolve(dirname(evidence), record.raw_path));
    const digest = sha256(bytes);
    if (record.sha256 !== digest) throw Error(`Raw hash mismatch for ${record.source_id}.`);
    records.push({ source_id: record.source_id, url: record.url, version: record.version, retrieved_at: record.retrieved_at, method: record.method, sha256: digest, bytes });
  }
  // A source used by a changed numeric record must be supplied, not merely named.
  const supplied = new Set(records.map(record => record.source_id));
  for (const change of review.changes.filter(c => c.collection === 'sources')) {
    if (after.sources.some(source => source.id === change.id) && !supplied.has(change.id)) throw Error('Changed source requires retained raw evidence.');
  }
  for (const record of records) {
    if (/unknown/i.test(record.version)) review.flags.push(`Source ${record.source_id} has an unknown version: resolve before comparing histories.`);
  }
  const changedObservations = review.changes.filter(c => c.collection === 'observations').map(c => c.id);
  for (const row of after.observations) {
    if (changedObservations.includes(identity(row)) && row.value !== null && !row.source_ids.every(id => supplied.has(id))) throw Error('Changed observation requires retained raw evidence for every source.');
  }
  for (const change of review.changes.filter(c => c.collection === 'models')) {
    const model = after.models.find(row => row.id === change.id);
    if (model && !model.source_ids.every(id => supplied.has(id))) throw Error('Changed model requires retained raw evidence for every source.');
  }
  const hashes = { baseline: sha256(beforeBytes), candidate: sha256(afterBytes), evidence: sha256(evidenceBytes) };
  // Always use the caller's private review root, never an arbitrary output file.
  const directory = join(root, `${hashes.candidate}-${hashes.evidence}`);
  await mkdir(root, { recursive: true });
  await mkdir(directory); // EEXIST deliberately refuses to overwrite an earlier review.
  const provenance = { schema_version: 1, hashes, created_at: new Date().toISOString(), records: records.map(({ bytes, ...record }) => ({ ...record, raw_file: `raw-${record.sha256}.bin` })) };
  await Promise.all([
    writeFile(join(directory, 'baseline.json'), beforeBytes, { flag: 'wx' }),
    writeFile(join(directory, 'candidate.json'), afterBytes, { flag: 'wx' }),
    writeFile(join(directory, 'evidence-input.json'), evidenceBytes, { flag: 'wx' }),
    writeFile(join(directory, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' }),
    writeFile(join(directory, 'review.json'), JSON.stringify(review, null, 2) + '\n', { flag: 'wx' }),
    writeFile(join(directory, 'review.md'), renderReview(review), { flag: 'wx' }),
  ]);
  for (const [digest, bytes] of new Map(records.map(record => [record.sha256, record.bytes]))) await writeFile(join(directory, `raw-${digest}.bin`), bytes, { flag: 'wx' });
  return directory;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args.some(arg => arg.startsWith('--'))) {
    console.error('Usage: node scripts/sectors-refresh-review.mjs BASELINE.json CANDIDATE.json EVIDENCE.json');
    process.exitCode = 1;
  } else {
    try {
      const root = fileURLToPath(new URL('../artifacts/sectors-refresh/', import.meta.url));
      console.log(await createReviewBundle({ baseline: args[0], candidate: args[1], evidence: args[2], root }));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
