/* ============================================================
   ARENA PRE-MARKET DECISION PROVENANCE

   A published pick is an executable decision only when its source evidence
   and immutable decision fields reproduce the hashes below. The proposal id
   is derived from the decision hash, so editing a symbol, side, quantity,
   thesis, signal, source, timestamp, or execution window necessarily creates
   a visibly different proposal rather than silently rewriting the old one.

   This module is browser-safe because validateArenaPicks.js runs both in the
   publication CLI and in fetchJson's client-side validator. It therefore uses
   a small synchronous SHA-256 implementation instead of node:crypto.
   ============================================================ */

export const PREMARKET_PROVENANCE_SCHEMA = 'arena-premarket-decision/v1';
export const PREMARKET_PROVENANCE_REQUIRED_FROM = '2026-08-12';
export const PREMARKET_DECISION_WINDOW = 'pre-market';
export const EXECUTABLE_ARENA_WINDOWS = ['open-window', 'late-window', 'post-market'];
import { arenaExecutionWindowName, assessArenaWindow } from './arenaWindowGate.js';
import { ARENA_MODEL_EXECUTION_WINDOWS } from './arenaExecution.js';

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotateRight(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

/** Browser-safe SHA-256. Returns 64 lowercase hexadecimal characters. */
export function sha256Hex(text) {
  const input = new TextEncoder().encode(String(text));
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const bitLength = input.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotateRight(words[i - 15], 7) ^ rotateRight(words[i - 15], 18) ^ (words[i - 15] >>> 3);
      const s1 = rotateRight(words[i - 2], 17) ^ rotateRight(words[i - 2], 19) ^ (words[i - 2] >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const upperE = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const t1 = (h + upperE + choose + SHA256_K[i] + words[i]) >>> 0;
      const upperA = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (upperA + majority) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeArenaSourceHash(pick) {
  return `sha256:${sha256Hex(canonicalJson(pick.sourceRefs))}`;
}

function decisionPayload(model, pick) {
  return {
    schema: pick.provenanceSchema,
    model,
    sessionDate: pick.sessionDate,
    decidedAt: pick.decidedAt,
    decisionWindow: pick.decisionWindow,
    expiresAt: pick.expiresAt,
    allowedExecutionWindows: [...pick.allowedExecutionWindows].sort(),
    sourceHash: pick.sourceHash,
    order: { sym: pick.sym, side: pick.order.side, qty: pick.order.qty },
    analysis: {
      positionSide: pick.side,
      confidence: pick.confidence,
      entry: pick.entry,
      stop: pick.stop,
      target: pick.target,
      thesis_en: pick.thesis_en,
      thesis_zh: pick.thesis_zh,
      signals: pick.signals,
      ...(pick.exitBy != null ? { exitBy: pick.exitBy } : {}),
    },
  };
}

export function computeArenaDecisionHash(model, pick) {
  return `sha256:${sha256Hex(canonicalJson(decisionPayload(model, pick)))}`;
}

export function computeArenaProposalId(model, pick) {
  const decisionHash = computeArenaDecisionHash(model, pick).slice('sha256:'.length);
  return `arena:${pick.sessionDate}:${model}:${decisionHash.slice(0, 20)}`;
}

const nyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function newYorkTimestampParts(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const parts = Object.fromEntries(nyFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return {
    timestamp,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * Resolve execution intents against the already-published pick snapshot.
 * The caller may name proposalId and optionally repeat sym/side/qty, but the
 * returned order is rebuilt from the signed snapshot. Repeated fields must
 * match exactly; raw refPx is ignored so the rules engine uses priceMap.
 */
export function bindPremarketOrders({
  snapshot, book, sessionDate, window, nowIso, priceMap = {}, proposedOrders = [],
  consumedProposalIds = [], late = false, catchup = false,
}) {
  if (!Array.isArray(proposedOrders)) throw new Error('proposedOrders must be an array');
  if (!ARENA_MODEL_EXECUTION_WINDOWS[book]?.includes(window)) {
    throw new Error(`Model ${book} cannot execute in ${JSON.stringify(window)}`);
  }
  if (late) throw new Error('late recovery may mark to market only; pre-market proposals cannot be executed');
  if (catchup) throw new Error('catch-up may mark to market only; pre-market proposals cannot be executed');
  if (proposedOrders.length === 0) return { orders: [], skipped: [] };
  if (!EXECUTABLE_ARENA_WINDOWS.includes(window)) throw new Error(`window ${JSON.stringify(window)} cannot execute a pre-market proposal`);
  if (!snapshot || snapshot.date !== sessionDate) throw new Error('proposal snapshot and settlement must identify the same market session');

  const now = newYorkTimestampParts(nowIso);
  if (!now || now.date !== sessionDate) throw new Error('execution timestamp must be in the proposal session in America/New_York');
  const picks = snapshot.models?.[book];
  if (!Array.isArray(picks)) throw new Error(`proposal snapshot has no model ${book}`);
  const byId = new Map(picks.map((pick) => [pick.proposalId, pick]));
  const used = new Set();
  const consumed = new Set(consumedProposalIds);
  const orders = [];
  const skipped = [];

  for (const [index, raw] of proposedOrders.entries()) {
    if (!raw || typeof raw !== 'object') throw new Error(`proposedOrders[${index}] must be an object`);
    const allowedIntentFields = new Set(['proposalId', 'sym', 'side', 'qty', 'decisionHash', 'sourceHash']);
    const unexpected = Object.keys(raw).filter((field) => !allowedIntentFields.has(field));
    if (unexpected.length) throw new Error(`proposedOrders[${index}] contains unsigned execution fields: ${unexpected.join(', ')}`);
    if (typeof raw.proposalId !== 'string' || !raw.proposalId) throw new Error(`proposedOrders[${index}].proposalId is required`);
    if (used.has(raw.proposalId)) throw new Error(`proposal ${raw.proposalId} cannot execute twice in one run`);
    if (consumed.has(raw.proposalId)) throw new Error(`proposal ${raw.proposalId} has already been consumed by an earlier run`);
    used.add(raw.proposalId);
    const pick = byId.get(raw.proposalId);
    if (!pick) throw new Error(`proposal ${raw.proposalId} is not present in the published model ${book} snapshot`);
    if (pick.sessionDate !== sessionDate) throw new Error(`proposal ${raw.proposalId} belongs to a different market session`);
    if (!pick.allowedExecutionWindows.includes(window)) throw new Error(`proposal ${raw.proposalId} does not allow execution in ${window}`);
    const decided = newYorkTimestampParts(pick.decidedAt);
    const expires = newYorkTimestampParts(pick.expiresAt);
    if (!decided || !expires || now.timestamp < decided.timestamp) throw new Error(`proposal ${raw.proposalId} cannot execute before it was decided`);
    if (now.timestamp > expires.timestamp) throw new Error(`proposal ${raw.proposalId} expired at ${pick.expiresAt}`);
    if (!assessArenaWindow(arenaExecutionWindowName(window), new Date(now.timestamp)).due) {
      throw new Error(`real execution clock is outside ${window}`);
    }
    if (computeArenaSourceHash(pick) !== pick.sourceHash || computeArenaDecisionHash(book, pick) !== pick.decisionHash || computeArenaProposalId(book, pick) !== pick.proposalId) {
      throw new Error(`proposal ${raw.proposalId} failed source/decision integrity verification`);
    }
    for (const field of ['sym', 'side', 'qty']) {
      const signed = field === 'sym' ? pick.sym : pick.order[field];
      if (raw[field] != null && raw[field] !== signed) throw new Error(`proposal ${raw.proposalId} ${field} differs from the signed pre-market decision`);
    }
    if (raw.decisionHash != null && raw.decisionHash !== pick.decisionHash) throw new Error(`proposal ${raw.proposalId} decisionHash mismatch`);
    if (raw.sourceHash != null && raw.sourceHash !== pick.sourceHash) throw new Error(`proposal ${raw.proposalId} sourceHash mismatch`);

    const liveRefPx = priceMap[pick.sym];
    if (!(typeof liveRefPx === 'number' && Number.isFinite(liveRefPx) && liveRefPx > 0)) {
      skipped.push({ proposalId: pick.proposalId, sym: pick.sym, reason: 'live reference price unavailable' });
      continue;
    }
    // For BUY decisions, entry is not a retrospective display estimate: it is
    // the signed maximum price the mechanical executor may pay. A less
    // favorable tape therefore causes an audited skip, never a rewritten
    // threshold or a risk-engine rejection.
    if (pick.order.side === 'buy' && liveRefPx > pick.entry) {
      skipped.push({
        proposalId: pick.proposalId,
        sym: pick.sym,
        reason: `live reference price ${liveRefPx} exceeds signed maximum entry ${pick.entry}`,
      });
      continue;
    }

    orders.push({
      sym: pick.sym,
      side: pick.order.side,
      qty: pick.order.qty,
      refPx: liveRefPx,
      ...(pick.order.side === 'buy' ? { maxExecPx: pick.entry } : {}),
      confidence: pick.confidence,
      signals: pick.signals,
      ...(pick.exitBy != null ? { exitBy: pick.exitBy } : {}),
      proposalId: pick.proposalId,
      decisionHash: pick.decisionHash,
      sourceHash: pick.sourceHash,
      decidedAt: pick.decidedAt,
    });
  }
  return { orders, skipped };
}
