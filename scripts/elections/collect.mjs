#!/usr/bin/env node
/* Operator entry point. See docs/elections/M5_RUNBOOK.md. */
import { readdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { sourceById } from '../../src/config/electionSources.js';
import { assertPrivateStore, collectOnce, directoryTransport, readVecZip, stampTime } from './collector.mjs';
import { publishVecLatest } from './publish.mjs';
import { parseVecFeed, vecFeedHeader } from './vec-adapter.mjs';
import { vecAzureTransport } from './vec-azure-transport.mjs';
import { publicStorage } from './vec-public-store.mjs';
import { snapshotErrors } from '../../src/lib/electionResults.js';

function configureSource(id, inspect, env) {
  if (id === 'vec-sample') return sourceById(id);
  if (id !== 'vec-2026' && id !== 'vec-trial') throw new Error('Choose vec-2026, vec-trial, or vec-sample');
  const source = sourceById('vec-2026');
  const expectedEventName = env.VEC_EVENT_NAME?.trim();
  const expectedEventId = env.VEC_EVENT_ID?.trim();
  if (!inspect && (!expectedEventName || !expectedEventId ||
      (id === 'vec-2026' && /\b(test|trial|sample|mock)\b/i.test(expectedEventName)))) {
    throw new Error('Set VEC_EVENT_NAME and VEC_EVENT_ID from the matching VEC ZIP using --inspect');
  }
  const identity = { expectedEventName, expectedEventId };
  if (id === 'vec-2026') return { ...source, ...identity, enabled: true };
  return {
    ...source,
    ...identity,
    id,
    name: 'VEC election night trial',
    enabled: true,
    synthetic: true,
    liveNotBefore: '2026-11-24T13:00:00Z',
    liveBefore: '2026-11-25T13:00:00Z',
    feeds: source.feeds.map((feed) => ({
      ...feed,
      pattern: new RegExp(feed.pattern.source.replace('^State', '^(?:Test)?State'), 'i'),
    })),
  };
}

async function main() {
  process.umask(0o077);
  const { values } = parseArgs({
    options: {
      source: { type: 'string', default: 'vec-2026' },
      dir: { type: 'string' },
      azure: { type: 'boolean' },
      store: { type: 'string' },
      inspect: { type: 'boolean' },
      series: { type: 'boolean' },
      watch: { type: 'boolean' },
      force: { type: 'boolean' },
      publish: { type: 'boolean' },
    },
  });
  if (Boolean(values.dir) === Boolean(values.azure) || (!values.inspect && !values.store) ||
      (values.inspect && (values.watch || values.publish || values.series)) ||
      (values.series && (!values.dir || values.source !== 'vec-sample' || values.watch)) ||
      (values.watch && values.force) || (values.publish && values.source !== 'vec-2026')) {
    throw new Error('Usage: collect.mjs --source <vec-2026|vec-trial|vec-sample> (--azure|--dir <ZIP folder>) (--inspect|--store <private folder> [--watch] [--publish])');
  }

  const source = configureSource(values.source, values.inspect, process.env);
  const transport = () => values.azure
    ? vecAzureTransport(process.env.VEC_AZURE_SAS_URL, { prefix: process.env.VEC_BLOB_PREFIX })
    : directoryTransport(values.dir);

  if (values.azure) transport(); // Fail on invalid configuration before entering the watch loop.
  if (values.publish) {
    if (process.env.VEC_PUBLIC_RESULTS !== '1') throw new Error('VEC public publication is disabled');
    publicStorage(process.env.ELECTION_SNAPSHOT_WRITER_URL);
  }
  if (values.inspect) {
    const read = transport();
    for (const feed of source.feeds) {
      try {
        const { bytes, fileName } = await read(feed);
        const xml = readVecZip(bytes);
        const { header } = vecFeedHeader(xml);
        const pinned = {
          ...source,
          expectedEventName: source.expectedEventName ?? header.eventName,
          expectedEventId: source.expectedEventId ?? header.eventId,
        };
        const { races } = parseVecFeed(xml, { feed, source: pinned, fetchedAt: new Date().toISOString(), fileName, payloadHash: null });
        const errors = snapshotErrors({
          schemaVersion: 1, eventId: source.eventId, snapshotId: 'inspection',
          mode: 'preview', isSynthetic: true, races,
        });
        console.log(JSON.stringify({ fileName, ...header, contests: races.length, validationErrors: errors.length }));
        if (errors.length) process.exitCode = 1;
      } catch (error) {
        console.error(JSON.stringify({ feed: feed.key, error: error.kind ?? error.code ?? 'inspection_failed' }));
        process.exitCode = 1;
      }
    }
    return;
  }

  const store = assertPrivateStore(values.store);
  if (values.series) {
    const stamps = new Set();
    for (const name of await readdir(values.dir)) {
      for (const feed of source.feeds) {
        const match = feed.pattern.exec(name);
        if (match) stamps.add(match[1] + match[2]);
      }
    }
    for (const stamp of [...stamps].sort()) {
      const result = await collectOnce({
        source, store, force: true, now: Date.parse(stampTime(stamp)),
        transport: directoryTransport(values.dir, { asOf: stamp }),
      });
      console.log(stamp, JSON.stringify(result));
      if (result.outcome === 'failed') process.exitCode = 1;
    }
    return;
  }

  const run = async () => {
    if (source.id === 'vec-2026' && Date.now() < Date.parse(source.liveNotBefore)) return { outcome: 'waiting_for_polls_to_close' };
    const result = await collectOnce({ source, store, transport: transport(), force: values.force });
    if (values.publish && result.outcome !== 'locked') result.publication = await publishVecLatest(store);
    return result;
  };

  const tick = async () => {
    try {
      const result = await run();
      console.log(JSON.stringify(result));
      if (!values.watch && result.outcome === 'failed') process.exitCode = 1;
    } catch (error) {
      console.error(JSON.stringify({ outcome: 'failed', kind: error.kind ?? error.code ?? 'operator_error' }));
      if (!values.watch) throw error;
    }
  };

  // Runs are serial. The collector also honours server retry-after and persistent backoff.
  do {
    const started = Date.now();
    await tick();
    if (values.watch) await sleep(Math.max(1000, source.pollSeconds * 1000 - (Date.now() - started)));
  } while (values.watch);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
