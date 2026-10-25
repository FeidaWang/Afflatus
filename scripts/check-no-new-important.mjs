#!/usr/bin/env node
/* check-no-new-important.mjs — frozen-baseline guard for !important.
 * This is not a full CSS parser: it just fails if the !important count in the
 * checked live stylesheets grows past the latest accepted ratchet. New rules
 * should win through cascade layers or specificity instead.
 *
 * Usage: node scripts/check-no-new-important.mjs
 * A real reduction (cleanup work) simply lowers the number below and the
 * check keeps passing — ratchet, not a fixed target. */
import { readFileSync } from 'node:fs';

const BASELINES = {
  // F06: include the active homepage and shared interaction owners.
  'src/showcase/premiere.css': 0,
  'public/styles/responsive-primitives.css': 0,
  'public/styles/afflatus-brand.css': 3,
  'public/styles/horoscope.css': 1,
  'public/styles/course-hope.css': 1,
  'public/styles/worlds.css': 0,
  'index.html': 2,
};

let anyFail = false;
for (const [path, baseline] of Object.entries(BASELINES)) {
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch (e) {
    console.log(`SKIP: ${path} not found`);
    continue;
  }
  const count = (content.match(/!important/g) || []).length;
  if (count > baseline) {
    console.error(`FAIL: ${path} has ${count} "!important" declarations, above the accepted ratchet of ${baseline}. Win the cascade with layers or specificity instead.`);
    anyFail = true;
  } else {
    console.log(`OK: ${path} — ${count} !important (baseline ${baseline}, ${count < baseline ? 'down' : 'unchanged'})`);
  }
}

process.exit(anyFail ? 1 : 0);
