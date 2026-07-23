#!/usr/bin/env node
/* bootstrap-season2.mjs — one-time Season 1 -> Season 2 ledger transition
 * (urgent.md Part 4 §18.1.3/§20 Phase 4).
 *
 * Archives the current public/arena-ledger.json (Season 1, Models A/B, 11
 * days of real settled history) byte-for-byte to public/arena-ledger-s1.json
 * — same convention already used for arena-universe-s1.json — then writes a
 * brand-new Season 2 ledger (Models S/P/T, three fresh $10,000 books) via
 * src/lib/arenaRun.js's bootstrapSeason2(). Refuses to run twice: if
 * arena-ledger.json already has S/P/T model keys, this is a no-op (exit 0,
 * not an error — safe to re-run by accident).
 *
 * Usage: node scripts/bootstrap-season2.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bootstrapSeason2 } from '../src/lib/arenaRun.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const LEDGER_PATH = join(REPO, 'public', 'arena-ledger.json');
const LEDGER_S1_PATH = join(REPO, 'public', 'arena-ledger-s1.json');

function fail(msg) {
  console.error(`[bootstrap-season2] ERROR: ${msg}`);
  process.exit(1);
}

if (!existsSync(LEDGER_PATH)) fail(`${LEDGER_PATH} does not exist`);

const current = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
const modelKeys = Object.keys(current.models || {});

if (modelKeys.includes('S') && modelKeys.includes('P') && modelKeys.includes('T')) {
  console.log('[bootstrap-season2] arena-ledger.json already has S/P/T — Season 2 already live, nothing to do.');
  process.exit(0);
}
if (!modelKeys.includes('A') || !modelKeys.includes('B')) {
  fail(`arena-ledger.json has unexpected model keys [${modelKeys.join(',')}] — expected Season 1's A/B before flipping`);
}

// 1. Archive Season 1 byte-for-byte (only if the archive doesn't already exist —
//    never overwrite a prior archive, that would be the one truly destructive mistake here).
if (existsSync(LEDGER_S1_PATH)) {
  fail(`${LEDGER_S1_PATH} already exists — refusing to overwrite a prior Season 1 archive. ` +
    'Delete it manually first only if you are certain it is safe to replace.');
}
writeFileSync(LEDGER_S1_PATH, `${JSON.stringify(current, null, 2)}\n`);
console.log(`[bootstrap-season2] archived Season 1 (day ${current.day}, ${current.models.A.trades.length + current.models.B.trades.length} total trades) -> ${LEDGER_S1_PATH}`);

// 2. Write the fresh Season 2 ledger.
const NOTE_EN = 'Arena Autopilot — three simulated $10,000 ledgers (S: ORACLE, sentiment/event-driven; P: PULSE, intraday structure; T: ATLAS, alt-data fusion) trading the full S&P 500 (public/arena-universe.json) under code-enforced risk rules (src/lib/arenaRules.js — the model proposes, the rules engine settles, never the other way around). Season 1 (Models A/B, fixed 30-symbol AI-hardware watchlist) is archived at arena-ledger-s1.json. Not investment advice.';
const NOTE_ZH = 'Arena Autopilot——三本各 $10,000 的模拟账本（S：ORACLE，情绪/事件驱动；P：PULSE，盘中结构；T：ATLAS，另类数据融合），在全标普 500（public/arena-universe.json）范围内按代码强制的风控规则运作（src/lib/arenaRules.js——模型只提案，规则引擎收单，永远不是反过来）。Season 1（Model A/B，固定 30 只 AI 硬件自选股）归档于 arena-ledger-s1.json。非投资建议。';

const season2 = bootstrapSeason2(current, {
  day: 0,
  promptVersions: { S: 'S-v1', P: 'P-v1', T: 'T-v1' },
  note_en: NOTE_EN,
  note_zh: NOTE_ZH,
});
writeFileSync(LEDGER_PATH, `${JSON.stringify(season2, null, 2)}\n`);
console.log(`[bootstrap-season2] wrote fresh Season 2 ledger (season ${season2.season}, day ${season2.day}, models S/P/T @ $10,000 each) -> ${LEDGER_PATH}`);
