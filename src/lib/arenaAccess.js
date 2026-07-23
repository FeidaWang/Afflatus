/* ============================================================
   ARENA API GATING — allowlist resolution + admin-key check
   (Part 4 §18.4). Pure functions only (no fetch/env/Date.now() defaults),
   same discipline as rateLimit.js — the actual network fetch + caching
   + process.env read live in api/quote.js and api/history.js (thin I/O
   wrappers), this module is what they call to make the decision.
   ============================================================ */
import { timingSafeEqual } from 'node:crypto';

/**
 * Resolve today's allowed-without-admin-key symbol set.
 *
 * Picks-only, matching §18.4.1's original intent: just
 * arena-picks.json's `quoteAllowlist` (today's recommended symbols plus the
 * SPY/QQQ/SMH benchmarks the pipeline always includes in it). Free browsing
 * of the full ~500-symbol universe now requires the admin key (§20) — the
 * "Today's Recommended Trades" picks board (arenaPicks.js) is the primary
 * no-key surface, and arenaTech.js's search only loads history/quote data
 * for a symbol once the user picks or searches it, so gating to picks-only
 * here is what actually conserves the free-tier quota. `universe` is no
 * longer consulted; the param is kept so callers don't need to change their
 * call shape. Deliberately does NOT check `picks.date` against "today": a
 * stale picks file still describes real symbols worth allowing.
 */
export function resolveAllowlist({ picks } = {}) {
  const set = new Set();
  if (picks && Array.isArray(picks.quoteAllowlist)) {
    for (const s of picks.quoteAllowlist) if (s) set.add(s);
  }
  return set;
}

export function isSymbolAllowed(symbol, allowlist) {
  if (allowlist instanceof Set) return allowlist.has(symbol);
  return Array.isArray(allowlist) && allowlist.includes(symbol);
}

/**
 * Constant-time admin-key comparison. Fails closed in every edge case —
 * no configured key (ARENA_ADMIN_KEY unset), no/empty provided key, or a
 * length mismatch (compared non-timing-sensitively first, which is fine:
 * key LENGTH isn't the secret, only its VALUE is) all return false rather
 * than throwing or silently granting access. `timingSafeEqual` throws on
 * mismatched buffer lengths, hence the length check before calling it.
 */
export function checkAdminKey(providedKey, configuredKey) {
  if (typeof providedKey !== 'string' || !providedKey) return false;
  if (typeof configuredKey !== 'string' || !configuredKey) return false;
  const a = Buffer.from(providedKey, 'utf8');
  const b = Buffer.from(configuredKey, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
