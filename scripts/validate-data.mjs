#!/usr/bin/env node
/* validate-data.mjs — single CI entry point that runs every public data
 * validator in one pass. Missing optional artifacts are skipped; malformed
 * present artifacts and unregistered public JSON fail closed. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
  if (!existsSync(path)) {
    console.log(`SKIP: ${path} does not exist yet`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`FAIL: ${path} is not valid JSON — ${error.message}`);
    anyFail = true;
    checked += 1;
    continue;
  }
  const { ok, errors } = validate(data);
  checked += 1;
  if (!ok) {
    console.error(`FAIL: ${path} (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(`  - ${error}`);
    anyFail = true;
  } else {
    console.log(`OK: ${path}`);
  }
}

// Validate every novel book referenced by the public index.
if (existsSync('public/novels-index.json')) {
  try {
    const index = JSON.parse(readFileSync('public/novels-index.json', 'utf8'));
    for (const novel of index.novels || []) {
      const path = `public/novels/${novel.id}.json`;
      registeredPaths.add(path);
      if (!existsSync(path)) {
        console.error(`FAIL: ${path} referenced by novels-index.json but missing`);
        anyFail = true;
        checked += 1;
        continue;
      }
      const data = JSON.parse(readFileSync(path, 'utf8'));
      const { ok, errors } = validateNovelBook(data);
      if (data.id !== novel.id) {
        errors.push(`top-level id ${JSON.stringify(data.id)} does not match index id ${JSON.stringify(novel.id)}`);
      }
      if (data.chapters.length !== novel.chapterCount) {
        errors.push(`index chapterCount is ${novel.chapterCount}, but the published book contains ${data.chapters.length} chapters`);
      }
      checked += 1;
      if (!ok || errors.length > 0) {
        console.error(`FAIL: ${path} (${errors.length}):`);
        errors.forEach((error) => console.error(`  - ${error}`));
        anyFail = true;
      } else {
        console.log(`OK: ${path}`);
      }
    }
  } catch (error) {
    console.error(`FAIL: could not cross-check public/novels/*.json against the index — ${error.message}`);
    anyFail = true;
  }
}

// Every public JSON file must have a registered validator.
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
