export const STOCK_RANGES = ['D', 'M', '3M', 'YTD', 'Y', 'MAX'];

// Anchor to the newest source date, rather than silently relabelling stale data.
export function stockWindow(candles, range, position = 1) {
  if (!candles.length) return { candles: [], start: 0, end: 0, count: 0, maxStart: 0 };
  if (range === 'D') return { candles, start: 0, end: candles.length, count: candles.length, maxStart: 0 };
  const latest = new Date(`${candles.at(-1).t.slice(0, 10)}T00:00:00Z`);
  let count = candles.length;
  if (range !== 'MAX') {
    const cutoff = new Date(latest);
    if (range === 'YTD') cutoff.setUTCMonth(0, 1);
    else {
      const month = cutoff.getUTCMonth() - ({ M: 1, '3M': 3, Y: 12 }[range] ?? 3);
      const day = cutoff.getUTCDate();
      cutoff.setUTCDate(1);
      cutoff.setUTCMonth(month);
      const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
      cutoff.setUTCDate(Math.min(day, lastDay));
    }
    const first = candles.findIndex(c => c.t.slice(0, 10) >= cutoff.toISOString().slice(0, 10));
    count = candles.length - Math.max(0, first);
  }
  const maxStart = Math.max(0, candles.length - count);
  const start = Math.round(Math.max(0, Math.min(1, position)) * maxStart);
  return { candles: candles.slice(start, start + count), start, end: start + count, count, maxStart };
}

// Preserve true OHLC extrema when many sessions share a screen pixel.
export function aggregateCandles(candles, limit) {
  const step = Math.max(1, Math.ceil(candles.length / limit));
  const result = [];
  for (let index = 0; index < candles.length; index += step) {
    const group = candles.slice(index, index + step);
    result.push({ t: group[0].t, end: group.at(-1).t, o: group[0].o, c: group.at(-1).c,
      h: Math.max(...group.map(c => c.h)), l: Math.min(...group.map(c => c.l)),
      v: group.reduce((sum, c) => sum + (c.v || 0), 0) });
  }
  return { candles: result, step };
}

export function normalizeIntraday(values) {
  return values.map(v => ({ t: String(v.datetime), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +v.volume || 0 }))
    .filter(c => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(c.t)
      && [c.o, c.h, c.l, c.c].every(n => Number.isFinite(n) && n > 0)
      && c.h >= Math.max(c.o, c.c) && c.l <= Math.min(c.o, c.c)
      && c.t.slice(11, 16) >= '09:30' && c.t.slice(11, 16) < '16:00')
    .sort((a, b) => a.t.localeCompare(b.t));
}
