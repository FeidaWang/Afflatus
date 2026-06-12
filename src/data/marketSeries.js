import { rand } from '../utils/math.js';

export const PERIOD_CONFIG = {
  '1D': {bars:42, start:137.94, end:138.66, noise:.004, shock:[12,-.006,18,.008]},
  '1W': {bars:55, start:134.80, end:138.66, noise:.007, shock:[24,-.018,34,.018]},
  '1M': {bars:70, start:127.30, end:138.66, noise:.011, shock:[28,-.028,44,.024]},
  '6M': {bars:95, start:100, end:138.66, noise:.012, shock:[28,-.034,32,.022]},
  '1Y': {bars:132, start:100, end:138.66, noise:.014, shock:[42,-.052,52,.038]},
  '5Y': {bars:180, start:41.20, end:138.66, noise:.018, shock:[72,-.09,96,.07]}
};

export const PERIOD_META = {
  '1D': {zh:'日', en:'D', ret:'+0.52%', value:'138.66', start:'T-1D · 137.94'},
  '1W': {zh:'周', en:'W', ret:'+2.86%', value:'138.66', start:'T-1W · 134.80'},
  '1M': {zh:'月', en:'M', ret:'+8.92%', value:'138.66', start:'T-1M · 127.30'},
  '6M': {zh:'半年', en:'6M', ret:'+38.66%', value:'138.66', start:'T-6M · 100.00'},
  '1Y': {zh:'一年', en:'1Y', ret:'+38.66%', value:'138.66', start:'T-1Y · 100.00'},
  '5Y': {zh:'五年', en:'5Y', ret:'+27.40%', value:'138.66', start:'T-5Y · 41.20'}
};

export function genCandles(period = '1Y') {
  const cfg = PERIOD_CONFIG[period] || PERIOD_CONFIG['1Y'];
  const candles = [];
  let prev = cfg.start;
  const trend = Math.pow(cfg.end / cfg.start, 1 / cfg.bars) - 1;

  for (let i = 0; i < cfg.bars; i++) {
    const open = prev;
    let close = open * (1 + trend + rand(-cfg.noise, cfg.noise));

    if (i === cfg.shock[0] || i === cfg.shock[0] + 1 || i === cfg.shock[0] + 2) {
      close = open * (1 + rand(cfg.shock[1], cfg.shock[1] * .35));
    }
    if (i === cfg.shock[2] || i === cfg.shock[2] + 1) {
      close = open * (1 + rand(cfg.shock[3] * .28, cfg.shock[3]));
    }

    candles.push({
      open,
      high: Math.max(open, close) * (1 + Math.abs(rand(.001, .014))),
      low: Math.min(open, close) * (1 - Math.abs(rand(.001, .014))),
      close
    });
    prev = close;
  }

  candles[candles.length - 1].close = cfg.end;
  candles[candles.length - 1].high = Math.max(candles[candles.length - 1].high, cfg.end * 1.007);
  return candles;
}

export function movingAverage(candles, period) {
  return candles.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    return sum / period;
  });
}
