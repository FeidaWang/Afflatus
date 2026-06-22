/* Vercel serverless proxy for Twelve Data historical candles.
   Keeps the API key server-side (set TWELVE_KEY in Vercel env vars). The browser
   calls /api/history?symbol=NVDA&interval=1day&outputsize=120 — no key on client.
   Returns the raw Twelve Data time_series JSON { status, values:[...] }. */
export default async function handler(req, res) {
  const symbol = (req.query.symbol || '').toString().trim();
  const interval = (req.query.interval || '').toString().trim();
  const outputsize = Math.min(5000, parseInt(req.query.outputsize, 10) || 100);
  if (!symbol || !/^[A-Za-z.\-]{1,12}$/.test(symbol) || !/^[0-9a-z]{1,6}$/.test(interval)) { res.status(400).json({ error: 'invalid params' }); return; }
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
