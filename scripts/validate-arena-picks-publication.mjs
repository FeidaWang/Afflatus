#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateArenaPicksForPublication } from '../src/lib/validateArenaPicks.js';

const path = resolve(process.argv[2] || 'public/arena-picks.json');
let data;
try {
  data = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
  console.error(`[validate-arena-picks-publication] ${path}: ${error.message}`);
  process.exit(1);
}

// Deliberately no --now option: unattended publication must use the real wall
// clock so a caller cannot make a post-open proposal look pre-market.
const checkedAt = new Date();
const validation = validateArenaPicksForPublication(data, { now: checkedAt });
if (!validation.ok) {
  for (const error of validation.errors) console.error(`[validate-arena-picks-publication] ${error}`);
  process.exit(1);
}
console.log(`[validate-arena-picks-publication] ok ${data.date} checked=${checkedAt.toISOString()}`);
