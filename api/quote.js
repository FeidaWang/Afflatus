/* Vercel serverless proxy for Finnhub real-time quotes.
   Keeps the API key server-side (set FINNHUB_KEY in Vercel → Project → Settings →
   Environment Variables). The browser calls /api/quote?symbol=NVDA — no key ever
   reaches the client. Returns the raw Finnhub quote shape { c, pc, o, h, l, ... }.

   D1 (2026-07-04): tightened the symbol shape to a real-ticker pattern (was an
   open `.{1,12}` proxy) and added a per-IP rate limit — this endpoint has no
   auth and the free-tier Finnhub quota is shared across every site visitor.
   V13 lets users load ANY US ticker (not just the Arena watchlist), so this is
   deliberately NOT a fixed symbol whitelist — see ROADMAP §1 D1 for why.

   Part 4 (urgent.md §18.4/§20, 2026-07-23): a symbol outside today's
   allowlist (arena-picks.json's quoteAllowlist, picks-only — see
   arenaAccess.js's resolveAllowlist() header) now requires an `x-arena-key`
   header matching ARENA_ADMIN_KEY (Vercel env var) — a quota gate, not real
   auth. Set ARENA_ADMIN_KEY in Vercel → Project → Settings → Environment
   Variables to enable admin unlock; until it's set, checkAdminKey() fails
   closed for everyone (the allowlist-permitted symbols are unaffected
   either way). */
import { checkRateLimit, clientIp } from '../src/lib/rateLimit.js';
import { resolveAllowlist, isSymbolAllowed, checkAdminKey } from '../src/lib/arenaAccess.js';

const SYMBOL_RE = /^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$/;
const RATE_LIMIT = { limit: 60, windowMs: 60000 };
const hits = new Map();

// Per-container cache of the resolved allowlist — avoids re-fetching
// arena-picks.json on every request. 5min TTL: fresh enough that a new
// picks publish shows up quickly, coarse enough that a burst of quote
// requests only costs one extra fetch.
const ALLOWLIST_TTL_MS = 5 * 60 * 1000;
let allowlistCache = { at: 0, allowlist: null };

async function getAllowlist(req) {
  const now = Date.now();
  if (allowlistCache.allowlist && now - allowlistCache.at < ALLOWLIST_TTL_MS) return allowlistCache.allowlist;
  const origin = (req.headers && req.headers.host) ? `https://${req.headers.host}` : 'https://feida.au';
  let picks = null;
  try {
    const pr = await fetch(`${origin}/arena-picks.json`, { cache: 'no-store' });
    if (pr.ok) picks = await pr.json();
  } catch (e) { /* network hiccup — resolveAllowlist degrades gracefully on whatever we got */ }
  const allowlist = resolveAllowlist({ picks });
  allowlistCache = { at: now, allowlist };
  return allowlist;
}

export default async function handler(req, res) {
  const symbol = (req.query.symbol || '').toString().trim();
  if (!symbol || !SYMBOL_RE.test(symbol)) { res.status(400).json({ error: 'invalid symbol' }); return; }
  const rl = checkRateLimit(hits, clientIp(req), { ...RATE_LIMIT, now: Date.now() });
  if (!rl.allowed) { res.setHeader('Retry-After', Math.ceil(rl.resetMs / 1000)); res.status(429).json({ error: 'rate limited' }); return; }

  const allowlist = await getAllowlist(req);
  if (!isSymbolAllowed(symbol, allowlist)) {
    const adminKey = (req.headers['x-arena-key'] || '').toString();
    if (!checkAdminKey(adminKey, process.env.ARENA_ADMIN_KEY)) {
      res.status(403).json({ error: 'gated', hint: "symbol outside today's pool — admin unlock required" });
      return;
    }
  }

  const key = process.env.FINNHUB_KEY;
  if (!key) { res.status(500).json({ error: 'FINNHUB_KEY not configured' }); return; }
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
    if (!r.ok) { res.status(502).json({ error: 'upstream', status: r.status }); return; }
    const q = await r.json();
    res.setHeader('Cache-Control', 's-maxage=12, stale-while-revalidate=24');
    res.status(200).json(q);
  } catch (e) { res.status(502).json({ error: 'fetch failed' }); }
}
