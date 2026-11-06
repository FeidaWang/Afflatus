/* One bounded collector run: read each feed once, validate, then publish one
   coherent immutable snapshot and move the pointer last. Any failure leaves the
   previous snapshot published and records the true age. Output goes to a private
   store directory; it never goes under public/ or dist/. */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { FeedError, boundedFetch } from './bounded-fetch.mjs';
import { readSingleFile } from './safe-zip.mjs';
import { parseVecFeed } from './vec-adapter.mjs';
import { raceChanges, resolveRaces, snapshotErrors, snapshotProblems } from '../../src/lib/electionResults.js';

const HISTORY_LIMIT = 2000;
const LOCK_STALE_MS = 10 * 60 * 1000;
const MAX_ZIP_BYTES = 64 * 1024 * 1024;
const MAX_XML_BYTES = 256 * 1024 * 1024;
const TIMEOUT_MS = 30000;
const MAX_BACKOFF_SECONDS = 3600;

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Rename is atomic on one volume, so a reader sees the old file or the new one, never half.
async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`);
  await rename(temporary, path);
}

export function assertPrivateStore(store) {
  const root = resolve(store);
  for (const blocked of ['public', 'dist']) {
    const path = resolve(process.cwd(), blocked);
    if (root === path || root.startsWith(path + sep)) throw new Error(`The store cannot be inside ${blocked}/`);
  }
  return root;
}

async function withLock(root, now, work) {
  const lock = join(root, '.lock');
  await mkdir(root, { recursive: true });
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const info = await stat(lock);
    if (now - info.mtimeMs < LOCK_STALE_MS) return { outcome: 'locked' };
    await rm(lock, { recursive: true, force: true });
    await mkdir(lock);
  }
  try {
    return await work();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

const stamp = (name, pattern) => {
  const match = pattern.exec(name);
  return match ? `${match[1]}${match[2]}` : null;
};

/** Transport for a folder of feed ZIPs. asOf limits it to files published by then, for local replays. */
export function directoryTransport(directory, { asOf = null } = {}) {
  return async (feed, feedState) => {
    const names = (await readdir(directory))
      .filter((name) => stamp(name, feed.pattern) && (!asOf || stamp(name, feed.pattern) <= asOf))
      .sort((a, b) => stamp(a, feed.pattern).localeCompare(stamp(b, feed.pattern)));
    const latest = names.at(-1);
    if (!latest) throw new FeedError('gone', `No ${feed.key} file in the folder`);
    if (latest === feedState?.fileName) return { status: 304 };
    return { status: 200, fileName: latest, bytes: await readFile(join(directory, latest)) };
  };
}

/** Transport for one allowlisted URL, with conditional requests. VEC's own endpoint is not known yet. */
export function urlTransport(urlFor, { allowedHosts, headers = {}, fetchImpl, now }) {
  return async (feed, feedState) => {
    const response = await boundedFetch(urlFor(feed), {
      allowedHosts, headers, fetchImpl, now, timeoutMs: TIMEOUT_MS, maxBytes: MAX_ZIP_BYTES, etag: feedState?.etag, lastModified: feedState?.lastModified,
    });
    if (response.status === 304) return { status: 304 };
    return { status: 200, bytes: response.bytes, etag: response.etag, lastModified: response.lastModified };
  };
}

function backoffSeconds(error, failures, pollSeconds) {
  const exponential = Math.min(pollSeconds * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_SECONDS);
  return Math.max(exponential, error.retryAfterSeconds ?? 0);
}

function readFeed(bytes, { feed, source, fetchedAt, fileName }) {
  const payloadHash = sha256(bytes);
  let xml;
  try {
    xml = readSingleFile(bytes, { maxBytes: MAX_XML_BYTES }).bytes.toString('utf8');
  } catch (error) {
    throw new FeedError('malformed', error.message);
  }
  return { payloadHash, ...parseVecFeed(xml, { feed, source, fetchedAt, payloadHash, fileName }) };
}

// A contest a new file omits keeps its last good values and real time, marked stale.
// Other offices simply carry on: an unchanged or failed file is reported per feed on the pointer.
function mergeRaces(previousSnapshot, freshBySource, sourceId) {
  const fresh = resolveRaces([sourceId], freshBySource);
  const offices = new Set(fresh.map((race) => race.office));
  const carried = (previousSnapshot?.races || [])
    .filter((race) => !fresh.some((item) => item.raceId === race.raceId))
    .map((race) => (offices.has(race.office) ? { ...race, coverage: 'stale' } : race));
  return [...fresh, ...carried];
}

// The feed has no declaration date, so a declaration keeps the first time it was observed.
function keepFirstObserved(race, previous) {
  if (race.decision.status !== 'certified' || previous?.decision.status !== 'certified') return race;
  if (race.decision.candidateIds.join(' ') !== previous.decision.candidateIds.join(' ')) return race;
  return { ...race, decision: { ...race.decision, firstObservedAt: previous.decision.firstObservedAt } };
}

// The sample files show a recount as no places returned with votes kept. A first sighting of that may just be early votes.
function confirmRecount(race, previous) {
  if (race.counting.status !== 'recount') return race;
  if (previous?.counting.status === 'recount' || previous?.progress.reported > 0) return race;
  return { ...race, counting: { ...race.counting, status: 'counting' }, progress: { ...race.progress, reported: 0 } };
}

function withRescission(race, previous) {
  const wasDecided = previous && ['certified', 'provider_called', 'call_rescinded'].includes(previous.decision.status);
  if (!wasDecided || race.decision.status !== 'uncalled') return race;
  // A withdrawal keeps who made the decision and the first time the withdrawal was seen.
  const { authority, evidenceUrl, firstObservedAt, status } = previous.decision;
  const seenAt = status === 'call_rescinded' ? firstObservedAt : race.provenance.publishedAt ?? race.provenance.fetchedAt;
  return { ...race, decision: { ...race.decision, status: 'call_rescinded', authority, evidenceUrl, firstObservedAt: seenAt } };
}

/**
 * One run. `transport(feed, feedState)` returns { status: 304 } or { status: 200, bytes, ... }.
 * Returns { outcome }: locked, backoff, unchanged, published, or failed.
 */
export async function collectOnce({ source, store, transport, now = Date.now(), force = false }) {
  if (!source.enabled && !source.synthetic) throw new Error(`${source.id} is disabled: ${source.blockedBy || 'no written decision'}`);
  if (!source.feeds.length) throw new Error(`${source.id} has no verified feed`);
  const root = assertPrivateStore(store);
  const fetchedAt = new Date(now).toISOString();

  return withLock(root, now, async () => {
    const eventRoot = join(root, source.eventId);
    const statePath = join(eventRoot, 'private', `${source.id}.json`);
    const pointerPath = join(eventRoot, 'latest.json');
    const sourceState = (await readJson(statePath)) || { feeds: {}, failures: 0, backoffUntil: null };
    const pointer = await readJson(pointerPath);

    if (!force && sourceState.backoffUntil && now < Date.parse(sourceState.backoffUntil)) {
      return { outcome: 'backoff', until: sourceState.backoffUntil };
    }

    const results = [];
    const failures = [];
    const feeds = { ...sourceState.feeds };
    for (const feed of source.feeds) {
      try {
        const response = await transport(feed, feeds[feed.key]);
        if (response.status === 304) continue;
        const parsed = readFeed(response.bytes, { feed, source, fetchedAt, fileName: response.fileName ?? null });
        if (source.liveNotBefore && (!parsed.publishedAt || Date.parse(parsed.publishedAt) < Date.parse(source.liveNotBefore))) {
          throw new FeedError('wrong_identity', `File dated ${parsed.publishedAt} is before polls closed`);
        }
        // A cache can serve an older file with a 200. It must not roll anything back.
        const lastPublished = feeds[feed.key]?.publishedAt;
        if (lastPublished && parsed.publishedAt && parsed.publishedAt < lastPublished) continue;
        results.push({ feed, parsed, response });
      } catch (error) {
        if (!(error instanceof FeedError)) throw error;
        failures.push({ feed, error });
      }
    }

    const previous = pointer ? await readJson(join(eventRoot, 'snapshots', `${pointer.snapshotId}.json`)) : null;
    const before = new Map((previous?.races || []).map((race) => [race.raceId, race]));
    // A file can parse and still break a rule. A contest that breaks one keeps its last good values, marked
    // stale, and the rest publish. If the snapshot as a whole, or every new contest, breaks a rule, the file
    // takes the failure path: old values stay and the page says so.
    let races = [];
    let rejected = [];
    if (results.length) {
      races = mergeRaces(previous, { [source.id]: results.flatMap(({ parsed }) => parsed.races) }, source.id)
        .map((race) => confirmRecount(withRescission(keepFirstObserved(race, before.get(race.raceId)), before.get(race.raceId)), before.get(race.raceId)))
        .sort((a, b) => a.raceId.localeCompare(b.raceId));
      const problems = snapshotProblems({ schemaVersion: 1, eventId: source.eventId, snapshotId: 'candidate', mode: source.synthetic ? 'preview' : 'live', isSynthetic: Boolean(source.synthetic), races });
      const freshIds = results.flatMap(({ parsed }) => parsed.races.map((race) => race.raceId));
      if (problems.errors.length || freshIds.every((id) => problems.races.has(id))) {
        const errors = [...problems.errors, ...[...problems.races.values()].flat()];
        const error = new FeedError('schema_drift', errors.slice(0, 20).join('; '));
        failures.push(...results.splice(0).map(({ feed }) => ({ feed, error })));
        races = [];
      } else if (problems.races.size) {
        rejected = [...problems.races.keys()];
        races = races.flatMap((race) => {
          if (!problems.races.has(race.raceId)) return [race];
          const old = before.get(race.raceId);
          return old ? [{ ...old, coverage: 'stale' }] : [];
        });
        const message = [...problems.races.values()].flat().slice(0, 20).join('; ');
        await writeJsonAtomic(join(eventRoot, 'private', 'quarantine', `${fetchedAt.replace(/[:.]/g, '-')}-contests.json`), { at: fetchedAt, kind: 'schema_drift', races: rejected, message });
      }
    }

    const nextFailures = failures.length ? sourceState.failures + 1 : 0;
    const previousSource = pointer?.sources.find((item) => item.sourceId === source.id);
    const worst = failures.reduce((longest, { error }) => Math.max(longest, backoffSeconds(error, nextFailures, source.pollSeconds)), 0);
    const backoffUntil = failures.length ? new Date(now + worst * 1000).toISOString() : null;

    for (const { error, feed } of failures) {
      await writeJsonAtomic(join(eventRoot, 'private', 'quarantine', `${fetchedAt.replace(/[:.]/g, '-')}-${feed.key}.json`), { at: fetchedAt, feed: feed.key, kind: error.kind, message: error.message });
    }

    let snapshotId = pointer?.snapshotId ?? null;
    let history = pointer?.history ?? [];
    let publishedAt = pointer?.publishedAt ?? null;
    let published = false;
    const fresh = results.flatMap(({ parsed }) => parsed.races).filter((race) => !rejected.includes(race.raceId));

    if (fresh.length) {
      const content = sha256(JSON.stringify(races.map((race) => ({ ...race, provenance: { ...race.provenance, fetchedAt: null, publishedAt: null, snapshotId: null, payloadHash: null } }))));
      const sourcePublishedAt = results.map(({ parsed }) => parsed.publishedAt).filter(Boolean).sort().at(-1) ?? null;

      if (content !== previous?.contentHash) {
        const id = `${source.eventId}-${fetchedAt.replace(/[-:.]/g, '')}-${content.slice(0, 8)}`;
        const changes = races.flatMap((race) => raceChanges(before.get(race.raceId), race, sourcePublishedAt ?? fetchedAt));
        const snapshot = {
          schemaVersion: 1,
          eventId: source.eventId,
          snapshotId: id,
          mode: source.synthetic ? 'preview' : 'live',
          isSynthetic: Boolean(source.synthetic),
          sourceIds: [source.id],
          publishedAt: fetchedAt,
          sourcePublishedAt,
          contentHash: content,
          previousSnapshotId: previous?.snapshotId ?? null,
          scope: { offices: [...new Set(races.map((race) => race.office))] },
          changes,
          races: races.map((race) => ({ ...race, provenance: { ...race.provenance, snapshotId: id } })),
        };
        const errors = snapshotErrors(snapshot);
        if (errors.length) throw new Error(`Refusing an invalid snapshot: ${errors.join('; ')}`);
        await writeJsonAtomic(join(eventRoot, 'snapshots', `${id}.json`), snapshot);
        snapshotId = id;
        publishedAt = fetchedAt;
        history = [...history, { snapshotId: id, publishedAt: fetchedAt, sourcePublishedAt, isSynthetic: snapshot.isSynthetic }].slice(-HISTORY_LIMIT);
        published = true;
      }
    }

    for (const { feed, parsed, response } of results) {
      feeds[feed.key] = { fileName: response.fileName ?? null, etag: response.etag ?? null, lastModified: response.lastModified ?? null, publishedAt: parsed.publishedAt ?? null };
    }
    await writeJsonAtomic(statePath, { feeds, failures: nextFailures, backoffUntil });

    if (snapshotId) {
      // Newest source time ever seen: a run that refreshed only the older house must not move it back.
      const sourceUpdatedAt = [...fresh.map((race) => race.provenance.sourceUpdatedAt), previousSource?.sourceUpdatedAt].filter(Boolean).sort().at(-1) ?? null;
      await writeJsonAtomic(pointerPath, {
        schemaVersion: 1,
        eventId: source.eventId,
        revision: (pointer?.revision ?? 0) + 1,
        snapshotId,
        publishedAt,
        isSynthetic: Boolean(source.synthetic),
        sourceIds: [source.id],
        updatedAt: fetchedAt,
        history,
        sources: [{
          sourceId: source.id,
          name: source.name,
          url: source.url,
          status: failures.length ? 'error' : 'ok',
          feeds: source.feeds.map((feed) => ({ key: feed.key, office: feed.office, status: failures.some((item) => item.feed === feed) ? 'error' : 'ok' })),
          lastCheckedAt: fetchedAt,
          // A 304 or a failure moves lastCheckedAt only. The source's own time stays what it was.
          sourceUpdatedAt,
          lastSuccessAt: failures.length ? previousSource?.lastSuccessAt ?? null : fetchedAt,
          lastError: failures.length ? { kind: failures[0].error.kind, at: fetchedAt } : null,
        }],
      });
    }

    if (failures.length) return { outcome: published ? 'partial' : 'failed', kinds: failures.map(({ error }) => error.kind), backoffUntil, ...(rejected.length ? { rejected } : {}) };
    if (rejected.length) return { outcome: published ? 'partial' : 'unchanged', kinds: ['schema_drift'], rejected, snapshotId };
    return { outcome: published ? 'published' : 'unchanged', snapshotId };
  });
}
