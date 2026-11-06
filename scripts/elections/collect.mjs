#!/usr/bin/env node
/* Local entry point for the election collector. See docs/elections/M5_RUNBOOK.md.
     node scripts/elections/collect.mjs --source vec-sample --dir <folder of ZIPs> --store <private folder> [--series]
   --series runs once per published file, in order, using each file's own time.
   It exists to record a replay from the sample files and only accepts synthetic sources. */
import { readdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { sourceById } from '../../src/config/electionSources.js';
import { collectOnce, directoryTransport } from './collector.mjs';
import { melbourneToUtc } from './vec-adapter.mjs';

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    dir: { type: 'string' },
    store: { type: 'string' },
    series: { type: 'boolean', default: false },
  },
});

const source = sourceById(values.source);
if (!source || !values.dir || !values.store) {
  console.error('Usage: collect.mjs --source <id> --dir <folder> --store <private folder> [--series]');
  process.exit(2);
}

if (values.series) {
  if (!source.synthetic) {
    console.error('--series is for synthetic sources only: real time must not be re-created.');
    process.exit(2);
  }
  const stamps = new Set();
  for (const name of await readdir(values.dir)) {
    for (const feed of source.feeds) {
      const match = feed.pattern.exec(name);
      if (match) stamps.add(`${match[1]}${match[2]}`);
    }
  }
  for (const stamp of [...stamps].sort()) {
    const wall = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}`;
    const result = await collectOnce({ source, store: values.store, force: true, now: Date.parse(melbourneToUtc(wall)), transport: directoryTransport(values.dir, { asOf: stamp }) });
    console.log(stamp, JSON.stringify(result));
  }
} else {
  const result = await collectOnce({ source, store: values.store, transport: directoryTransport(values.dir) });
  console.log(JSON.stringify(result));
  if (result.outcome === 'failed') process.exitCode = 1;
}
