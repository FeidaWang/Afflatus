#!/usr/bin/env node
/* validate-data.mjs — single CI entry point that runs every data file's
 * validator in one pass (U21 Phase 1, rfcs/2026-07-12-u21-phase1-tech-audit.md
 * §2.7). Each file already has (or now has) a per-file validator in src/lib/
 * following the pattern established by validateSignalEvents.js/
 * validateSectorsData.js — this script just aggregates them for
 * .github/workflows/ci.yml. The unified publisher and settlement scripts call
 * the same validators before replacing any production artifact; this entry
 * point provides an independent full-repository check in CI.
 *
 * Exits 0 if every checked file is valid or absent (a file that doesn't
 * exist yet — e.g. before a scheduled task's first run — is not a failure).
 * Exits 1 and prints every problem if any present file is invalid. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateSectorsData } from '../src/lib/validateSectorsData.js';
import { validateSectorsCompetition } from '../src/lib/validateSectorsCompetition.js';
import { validateSectorsRivalry } from '../src/lib/validateSectorsRivalry.js';
import { validateSignalEvents } from '../src/lib/validateSignalEvents.js';
import { validateLeaguesData } from '../src/lib/validateLeaguesData.js';
import { validateGamesData } from '../src/lib/validateGamesData.js';
import { validateNovelsIndex, validateNovelBook } from '../src/lib/validateNovelsData.js';
import { validateArenaUniverse, validateArenaUniverseArchive } from '../src/lib/validateArenaUniverse.js';
import { validateArenaPicks } from '../src/lib/validateArenaPicks.js';
import { validateArenaQuantModel } from '../src/lib/validateArenaQuantModel.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';
import { validateArenaNews } from '../src/lib/validateArenaNews.js';
import { validateArenaLedger, validateArenaLedgerArchive } from '../src/lib/validateArenaLedger.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateDailyTransits } from '../src/lib/validateDailyTransits.js';
import { validateSectorsEcosystem } from '../src/lib/validateSectorsEcosystem.js';
import {
  validateAudioPlaylist,
  validateNyseCalendar,
  validateSignalReleaseDates,
} from '../src/lib/validateStaticPublicData.js';

const CHECKS = [
  { path: 'public/sectors-data.json', validate: validateSectorsData },
  { path: 'public/sectors-competition.json', validate: validateSectorsCompetition },
  { path: 'public/sectors-rivalry.json', validate: validateSectorsRivalry },
  { path: 'public/sectors-ecosystem.json', validate: validateSectorsEcosystem },
  { path: 'public/signal-events.json', validate: validateSignalEvents },
  { path: 'public/leagues-data.json', validate: validateLeaguesData },
  { path: 'public/games-data.json', validate: validateGamesData },
  { path: 'public/novels-index.json', validate: validateNovelsIndex },
  // Live and immutable archive artifacts have distinct schemas, but both are
  // public contracts and therefore both remain checked.
  { path: 'public/arena-universe.json', validate: validateArenaUniverse },
  { path: 'public/arena-universe-s1.json', validate: validateArenaUniverseArchive },
  { path: 'public/arena-picks.json', validate: validateArenaPicks },
  { path: 'public/arena-quant-model.json', validate: validateArenaQuantModel },
  { path: 'public/arena-runlog.json', validate: validateArenaRunlog },
  { path: 'public/arena-daily-digest.json', validate: validateArenaDigest },
  { path: 'public/arena-news.json', validate: validateArenaNews },
  { path: 'public/arena-ledger.json', validate: validateArenaLedger },
  { path: 'public/arena-ledger-s1.json', validate: validateArenaLedgerArchive },
  { path: 'public/arena-predlog.json', validate: validateArenaPredlog },
  { path: 'public/transits-daily.json', validate: validateDailyTransits },
  { path: 'public/audio/playlist.json', validate: validateAudioPlaylist },
  { path: 'public/nyse-holidays-2026.json', validate: validateNyseCalendar },
  { path: 'public/signal-release-dates-2026.json', validate: validateSignalReleaseDates },
];

let anyFail = false;
let checked = 0;
const registeredPaths = new Set(CHECKS.map(({ path }) => path));

for (const { path, validate } of CHECKS) {
  if (!existsSync(path)) { console.log(`SKIP: ${path} does not exist yet`); continue; }
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`FAIL: ${path} is not valid JSON — ${e.message}`);
    anyFail = true; checked++;
    continue;
  }
  const { ok, errors } = validate(data);
  checked++;
  if (!ok) {
    console.error(`FAIL: ${path} (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
    for (const e of errors) console.error(`  - ${e}`);
    anyFail = true;
  } else {
    console.log(`OK: ${path}`);
  }
}

// novels/<id>.json chapter files: validate every file the index references,
// rather than hardcoding book ids here.
if (existsSync('public/novels-index.json')) {
  try {
    const idx = JSON.parse(readFileSync('public/novels-index.json', 'utf8'));
    for (const n of idx.novels || []) {
      const p = `public/novels/${n.id}.json`;
      registeredPaths.add(p);
      if (!existsSync(p)) { console.error(`FAIL: ${p} referenced by novels-index.json but missing`); anyFail = true; checked++; continue; }
      const data = JSON.parse(readFileSync(p, 'utf8'));
      const { ok, errors } = validateNovelBook(data);
      checked++;
      if (!ok) { console.error(`FAIL: ${p} (${errors.length}):`); errors.forEach((e) => console.error(`  - ${e}`)); anyFail = true; }
      else console.log(`OK: ${p}`);
    }
  } catch (e) {
    console.error(`FAIL: could not cross-check public/novels/*.json against the index — ${e.message}`);
    anyFail = true;
  }
}

// Coverage gate: schema registration must grow in the same change as any new
// public JSON. Referenced novel books are registered dynamically above; an
// orphan book is intentionally reported here too.
function listJsonFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listJsonFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
  }
  return files;
}
for (const path of listJsonFiles('public')) {
  if (!registeredPaths.has(path)) {
    console.error(`FAIL: ${path} has no registered schema validator`);
    anyFail = true;
  }
}

console.log(`\n${checked} file(s) checked.`);
process.exit(anyFail ? 1 : 0);
