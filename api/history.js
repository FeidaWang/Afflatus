/* Vercel serverless proxy for Twelve Data historical candles.
   Keeps the API key server-side (set TWELVE_KEY in Vercel env vars). The browser
   calls /api/history?symbol=NVDA&interval=1day&outputsize=120 — no key on client.
   Returns the raw Twelve Data time_series JSON { status, values:[...] }.

   D1 (2026-07-04): tightened the symbol shape to a real-ticker pattern (was an
   open `.{1,12}` proxy) and added a per-IP rate limit — this endpoint has no
   auth and the free-tier Twelve Data quota is shared across every site visitor.
   V13 lets users load ANY US ticker (not just the Arena watchlist), so this is
   deliberately NOT a fixed symbol whitelist — see ROADMAP §1 D1 for why.

   Part 4 (urgent.md §18.4/§20, 2026-07-23): same allowlist + admin-key gate
   as api/quote.js — see that file's header for the full rationale. */
import { checkRateLimit, clientIp } from '../src/lib/rateLimit.js';
import { resolveAllowlist, isSymbolAllowed, checkAdminKey } from '../src/lib/arenaAccess.js';

const SYMBOL_RE = /^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$/;
const RATE_LIMIT = { limit: 20, windowMs: 60000 };
const hits = new Map();

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
  const interval = (req.query.interval || '').toString().trim();
  const outputsize = Math.min(5000, parseInt(req.query.outputsize, 10) || 100);
  if (!symbol || !SYMBOL_RE.test(symbol) || !/^[0-9a-z]{1,6}$/.test(interval)) { res.status(400).json({ error: 'invalid params' }); return; }
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

  const key = process.env.TWELVE_KEY;
  if (!key) { res.status(500).json({ error: 'TWELVE_KEY not configured' }); return; }
  try {
    const u = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}&apikey=${key}`;
    const r = await fetch(u);
    if (!r.ok) { res.status(502).json({ error: 'upstream', status: r.status }); return; }
    const j = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(j);
  } catch (e) { res.status(502).json({ error: 'fetch failed' }); }
}
