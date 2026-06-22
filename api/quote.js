/* Vercel serverless proxy for Finnhub real-time quotes.
   Keeps the API key server-side (set FINNHUB_KEY in Vercel → Project → Settings →
   Environment Variables). The browser calls /api/quote?symbol=NVDA — no key ever
   reaches the client. Returns the raw Finnhub quote shape { c, pc, o, h, l, ... }. */
export default async function handler(req, res) {
  const symbol = (req.query.symbol || '').toString().trim();
  if (!symbol || !/^[A-Za-z.\-]{1,12}$/.test(symbol)) { res.status(400).json({ error: 'invalid symbol' }); return; }
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
