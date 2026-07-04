/* Vercel serverless proxy for Finnhub real-time quotes.
   Keeps the API key server-side (set FINNHUB_KEY in Vercel → Project → Settings →
   Environment Variables). The browser calls /api/quote?symbol=NVDA — no key ever
   reaches the client. Returns the raw Finnhub quote shape { c, pc, o, h, l, ... }.

   D1 (2026-07-04): tightened the symbol shape to a real-ticker pattern (was an
   open `.{1,12}` proxy) and added a per-IP rate limit — this endpoint has no
   auth and the free-tier Finnhub quota is shared across every site visitor.
   V13 lets users load ANY US ticker (not just the Arena watchlist), so this is
   deliberately NOT a fixed symbol whitelist — see ROADMAP §1 D1 for why. */
import { checkRateLimit, clientIp } from '../src/lib/rateLimit.js';

const SYMBOL_RE = /^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$/;
const RATE_LIMIT = { limit: 60, windowMs: 60000 };
const hits = new Map();

export default async function handler(req, res) {
  const symbol = (req.query.symbol || '').toString().trim();
  if (!symbol || !SYMBOL_RE.test(symbol)) { res.status(400).json({ error: 'invalid symbol' }); return; }
  const rl = checkRateLimit(hits, clientIp(req), { ...RATE_LIMIT, now: Date.now() });
  if (!rl.allowed) { res.setHeader('Retry-After', Math.ceil(rl.resetMs / 1000)); res.status(429).json({ error: 'rate limited' }); return; }
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
