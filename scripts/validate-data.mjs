#!/usr/bin/env node
/* validate-data.mjs — single CI entry point that runs every data file's
 * validator in one pass (U21 Phase 1, rfcs/2026-07-12-u21-phase1-tech-audit.md
 * §2.7). Each file already has (or now has) a per-file validator in src/lib/
 * following the pattern established by validateSignalEvents.js/
 * validateSectorsData.js — this script just aggregates them for
 * .github/workflows/ci.yml. Individual scheduled tasks continue to call
 * their own single-file validate-*.mjs script directly (unchanged); this
 * script additionally covers files that don't have their own CLI wrapper.
 *
 * Files intentionally NOT covered here: arena-ledger.json / arena-predlog.json
 * are only ever written by their code-enforced settlement scripts
 * (scripts/apply-arena-run.mjs / apply-arena-predlog.mjs), which already are
 * the correctness gate for those files — see RFC §2.6. A schema validator on
 * top would be redundant, not defense in depth.
 *
 * Exits 0 if every checked file is valid or absent (a file that doesn't
 * exist yet — e.g. before a scheduled task's first run — is not a failure).
 * Exits 1 and prints every problem if any present file is invalid. */
import { readFileSync, existsSync } from 'node:fs';
import { validateSectorsData } from '../src/lib/validateSectorsData.js';
import { validateSignalEvents } from '../src/lib/validateSignalEvents.js';
import { validateLeaguesData } from '../src/lib/validateLeaguesData.js';
import { validateGamesData } from '../src/lib/validateGamesData.js';
import { validateNovelsIndex, validateNovelBook } from '../src/lib/validateNovelsData.js';
import { validateArenaUniverse } from '../src/lib/validateArenaUniverse.js';
import { validateArenaPicks } from '../src/lib/validateArenaPicks.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';

const CHECKS = [
  { path: 'public/sectors-data.json', validate: validateSectorsData },
  { path: 'public/signal-events.json', validate: validateSignalEvents },
  { path: 'public/leagues-data.json', validate: validateLeaguesData },
  { path: 'public/games-data.json', validate: validateGamesData },
  { path: 'public/novels-index.json', validate: validateNovelsIndex },
  // Part 4 (urgent.md SS18.1): arena-universe.json's live v2 ("market") shape,
  // and the new pipeline artifacts. arena-universe-s1.json is Season 1's
  // frozen archive and is deliberately NOT checked here (historical, never
  // written again). arena-ledger.json/arena-predlog.json stay excluded per
  // the note above -- their own settlement scripts are the correctness gate.
  { path: 'public/arena-universe.json', validate: validateArenaUniverse },
  { path: 'public/arena-picks.json', validate: validateArenaPicks },
  { path: 'public/arena-runlog.json', validate: validateArenaRunlog },
  { path: 'public/arena-daily-digest.json', validate: validateArenaDigest },
];

let anyFail = false;
let checked = 0;

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

console.log(`\n${checked} file(s) checked.`);
process.exit(anyFail ? 1 : 0);
