import { portfolioLogo } from './portfolioLogos.js';

// FY 2025-26 trading record, derived from the Stake financial-year report pack
// (1 Jul 2025 - 30 Jun 2026). Only percentages are published; no dollar amounts.
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const isZh = document.documentElement.lang.toLowerCase().startsWith('zh');
const L = (en, zh) => (isZh ? zh : en);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function localizeMarkup() {
  const locale = isZh ? 'zh' : 'en';
  $$('[data-en][data-zh]').forEach(el => { el.textContent = el.dataset[locale]; });
  $$('[data-aria-en][data-aria-zh]').forEach(el => el.setAttribute('aria-label', el.dataset[isZh ? 'ariaZh' : 'ariaEn']));
  const link = $('[data-header-language]');
  if (link) {
    link.textContent = isZh ? 'EN' : '中文';
    link.setAttribute('aria-label', isZh ? 'Switch to English' : 'Switch to Chinese');
    link.href = `/${isZh ? 'en' : 'zh'}/portfolio.html${location.hash}`;
  }
}
localizeMarkup();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(localizeMarkup), { once: true });
else requestAnimationFrame(localizeMarkup);
addEventListener('hashchange', localizeMarkup);
if (isZh) document.title = '2025–26 财年交易记录 · AFFLATUS';

/* ------------------------------------------------------------------ data */
const THEMES = {
  mem: { en: 'Memory & storage', zh: '存储与内存', color: '#9d90ec' },
  cpu: { en: 'Compute chips', zh: '算力芯片', color: '#83b0ec' },
  net: { en: 'Custom silicon', zh: '定制芯片与网络', color: '#8cc2a8' },
  kor: { en: 'Korea ETFs', zh: '韩国 ETF', color: '#eeb08a' },
  fab: { en: 'Foundry & tools', zh: '代工与设备', color: '#e39ea6' },
  opt: { en: 'Optics', zh: '光通信', color: '#d8bf78' },
  space: { en: 'Space', zh: '太空', color: '#8fa1bd' },
  other: { en: 'Other', zh: '其他', color: '#d9d5c6' },
};
const THEME_ORDER = ['mem', 'cpu', 'net', 'kor', 'fab', 'opt', 'space', 'other'];
const TICKERS = ['AAOI','ALLW','AMD','ASML','AVGO','AXTI','COHR','COPX','CRCL','DRAM','EWY','FLKR','GLW','GOOGL','GPRO','HPE','HPE.PRC','IBM','INTC','IREN','LITE','MRVL','MU','NOK','NVDA','NVO','QCOM','SNDK','SPCX','STM','TSM','XLE','YANG'];
const TICKER_THEME = {
  SNDK:'mem', DRAM:'mem', MU:'mem', FLKR:'kor', EWY:'kor', MRVL:'net', AVGO:'net', QCOM:'net',
  INTC:'cpu', AMD:'cpu', NVDA:'cpu', IBM:'cpu', HPE:'cpu', 'HPE.PRC':'cpu', LITE:'opt', COHR:'opt',
  AAOI:'opt', GLW:'opt', AXTI:'opt', NOK:'opt', TSM:'fab', ASML:'fab', STM:'fab', SPCX:'space',
};
// yymmdd + side + ticker index, one entry per executed fill (237).
const FILLS = '250828B25;251106B18;251106B24;260127B11;260127B27;260127B27;260129B7;260130S1;260130S2;260130S2;260130S27;260130B27;260130S27;260130B27;260202S7;260202S7;260204B18;260204S18;260204B27;260205S27;260211B11;260211B22;260211S22;260211B22;260211B24;260212B27;260213B11;260213B30;260218B10;260303B31;260303B31;260303B31;260309S31;260310B11;260310S31;260310S32;260310S32;260318S11;260318S22;260318S27;260319B31;260324S31;260331B11;260409S11;260410B9;260410S30;260413S9;260414B0;260414B11;260414B18;260414B18;260414B18;260414B22;260414B22;260415S10;260415S11;260415S11;260415S22;260415S24;260417S0;260417S18;260421B11;260422B18;260422B18;260423S11;260423S14;260423S18;260424B6;260424B21;260427B26;260428S26;260429S26;260501B3;260501B11;260501B11;260501B20;260501S21;260501B24;260501S25;260501B30;260504B2;260504B9;260504S11;260504S30;260505S2;260506S3;260506S6;260506S9;260506S9;260506S9;260506S9;260506S9;260506S9;260506B9;260506B12;260506S12;260506S20;260506S24;260507S9;260507S9;260507S9;260507B9;260507B9;260507B11;260507B20;260507S20;260507B26;260507S26;260507B26;260507S26;260508B2;260508B18;260508B26;260511S2;260511B5;260511S5;260511B8;260511B8;260511B8;260511S8;260511S9;260511B9;260511S9;260511S9;260511S9;260511B11;260511B11;260511S11;260511S18;260511B19;260511S19;260511B20;260511S20;260511S26;260511S26;260512B6;260512S6;260512B9;260512B18;260512S18;260512B22;260515B9;260515B11;260515S18;260518B4;260518B11;260518S22;260521B9;260521S11;260521S11;260521B20;260521B21;260521B30;260522S4;260522S4;260522S9;260522S9;260522S20;260522S21;260522S30;260526B9;260526B9;260526S9;260526B21;260602B4;260602B17;260602S21;260602B22;260602B23;260603B4;260603B13;260603B15;260603B16;260603S16;260603S16;260603S16;260603B21;260603B21;260603B21;260603S21;260604S13;260604B21;260604B21;260604S22;260604B22;260605S22;260605B22;260605S22;260605B22;260605B29;260612B28;260612S28;260612S29;260615B9;260615B11;260615S22;260616S4;260616S9;260616B9;260616S9;260616S11;260616S15;260616S17;260616S21;260616B22;260616S22;260616S23;260616B28;260616B28;260616S28;260616B28;260616S28;260622B9;260622B23;260622S23;260622B28;260622S28;260623B9;260623B9;260623B9;260623B22;260623B22;260624B9;260624B9;260624B18;260624B18;260624B21;260625S9;260625B9;260625B9;260625S18;260625S21;260625S22;260629B21;260629B21;260629B21;260629B22'.split(';').map(code => {
  const m = code.match(/^(\d{2})(\d{2})(\d{2})([BS])(\d+)$/);
  const ticker = TICKERS[+m[5]];
  return { y: 2000 + +m[1], m: +m[2], d: +m[3], side: m[4], ticker, theme: TICKER_THEME[ticker] || 'other' };
});
// Share of realized gains among profitable stocks (FIFO, fee-inclusive), rounded to 100 squares.
const GAIN_SQUARES = { mem: 46, cpu: 21, net: 14, kor: 12, fab: 3, opt: 2, space: 2 };
const GAIN_SHARE = { mem: 46.5, cpu: 20.6, net: 13.7, kor: 11.6, fab: 2.8, opt: 2.5, space: 2.4 };
// Profitable closed round trips: ticker, entry, exit, calendar days held, fee-inclusive return %.
const ROUND_TRIPS = [["SNDK","2026-01-27","2026-01-30",3,33.1],["MRVL","2026-05-26","2026-06-02",7,32.3],["INTC","2025-11-06","2026-02-04",90,25.0],["INTC","2026-04-22","2026-04-23",1,17.9],["DRAM","2026-05-04","2026-05-06",2,16.5],["AMD","2026-05-04","2026-05-05",1,15.9],["SPCX","2026-06-12","2026-06-12",0,14.0],["INTC","2026-05-08","2026-05-11",3,13.9],["SNDK","2026-02-12","2026-03-18",34,13.6],["MU","2026-02-11","2026-03-18",35,12.6],["DRAM","2026-05-07","2026-05-11",4,12.1],["MU","2026-06-05","2026-06-15",10,11.2],["FLKR","2026-03-31","2026-04-09",9,11.2],["MU","2026-06-23","2026-06-25",2,11.2],["QCOM","2026-04-27","2026-04-29",2,10.7],["FLKR","2026-01-27","2026-03-18",50,9.8],["DRAM","2026-06-23","2026-06-25",2,9.4],["LITE","2026-05-21","2026-05-22",1,9.3],["AMD","2026-05-08","2026-05-11",3,8.8],["DRAM","2026-06-24","2026-06-25",1,7.9],["MRVL","2026-06-04","2026-06-16",12,7.1],["STM","2026-06-05","2026-06-12",7,5.6],["NVDA","2026-02-11","2026-05-06",84,5.2],["EWY","2026-02-18","2026-04-15",56,5.2],["FLKR","2026-05-07","2026-05-11",4,4.6],["DRAM","2026-05-15","2026-05-22",7,4.5],["INTC","2026-06-24","2026-06-25",1,4.4],["ASML","2026-05-01","2026-05-06",5,4.1],["MU","2026-04-14","2026-04-15",1,4.0],["INTC","2026-04-14","2026-04-17",3,3.8],["FLKR","2026-05-18","2026-05-21",3,3.7],["LITE","2026-05-01","2026-05-06",5,3.4],["NVDA","2025-11-06","2026-04-15",160,3.1],["COHR","2026-04-24","2026-05-06",12,2.9],["FLKR","2026-05-01","2026-05-04",3,2.8],["FLKR","2026-05-15","2026-05-21",6,2.7],["FLKR","2026-02-11","2026-03-18",35,2.6],["DRAM","2026-05-11","2026-05-11",0,2.6],["FLKR","2026-03-10","2026-03-18",8,2.4],["QCOM","2026-05-08","2026-05-11",3,2.4],["NOK","2026-06-22","2026-06-22",0,2.3],["DRAM","2026-05-12","2026-05-22",10,2.3],["NVDA","2026-02-11","2026-04-15",63,2.1],["TSM","2026-05-21","2026-05-22",1,1.7],["SNDK","2026-02-04","2026-02-05",1,1.6],["FLKR","2026-02-13","2026-03-18",33,1.6],["MU","2026-06-16","2026-06-16",0,1.6],["DRAM","2026-06-15","2026-06-16",1,1.6],["QCOM","2026-05-07","2026-05-07",0,1.5],["FLKR","2026-04-21","2026-04-23",2,1.3],["XLE","2026-03-19","2026-03-24",5,1.3],["MRVL","2026-05-21","2026-05-22",1,1.3],["TSM","2026-02-13","2026-04-10",56,1.1],["FLKR","2026-04-14","2026-04-15",1,0.9],["NVDA","2026-05-01","2026-05-06",5,0.6],["AAOI","2026-04-14","2026-04-17",3,0.5],["DRAM","2026-05-06","2026-05-07",1,0.2],["MU","2026-06-02","2026-06-04",2,0.2],["MRVL","2026-04-24","2026-05-01",7,0.2],["DRAM","2026-05-21","2026-05-22",1,0.2],["INTC","2026-05-12","2026-05-12",0,0.2],["TSM","2026-05-01","2026-05-04",3,0.1],["DRAM","2026-04-10","2026-04-13",3,0.1]];

/* --------------------------------------------------------- watercolor tiles */
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
const spriteCache = new Map();
function tileSprite(color, variant) {
  const key = `${color}|${variant}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const size = 64, pad = 4, c = document.createElement('canvas');
  c.width = c.height = size + pad * 2;
  const g = c.getContext('2d'), rnd = seeded(variant * 7919 + color.length * 31 + parseInt(color.slice(1), 16));
  const [r, gg, b] = hexRgb(color);
  // irregular painted edge
  g.beginPath();
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const side = Math.floor(i / 6), f = (i % 6) / 6, j = () => (rnd() - .5) * 2.2;
    const p = [[pad + f * size, pad], [pad + size, pad + f * size], [pad + size - f * size, pad + size], [pad, pad + size - f * size]][side];
    pts.push([p[0] + j(), p[1] + j()]);
  }
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  const grad = g.createLinearGradient(0, pad, 0, pad + size);
  grad.addColorStop(0, `rgba(${r},${gg},${b},${.72 + rnd() * .12})`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},${.9 + rnd() * .1})`);
  g.fillStyle = grad; g.fill();
  // pigment granulation and vertical brush streaks
  g.save(); g.clip();
  for (let i = 0; i < 26; i++) {
    const x = pad + rnd() * size;
    g.fillStyle = `rgba(${r * .8 | 0},${gg * .8 | 0},${b * .85 | 0},${rnd() * .08})`;
    g.fillRect(x, pad, 1 + rnd() * 3, size);
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * .12})`;
    g.fillRect(pad + rnd() * size, pad + rnd() * size, 1.4, 1.4);
  }
  g.restore();
  // darker pooled edge
  g.lineWidth = 1.2; g.strokeStyle = `rgba(${r * .72 | 0},${gg * .72 | 0},${b * .78 | 0},.35)`; g.stroke();
  spriteCache.set(key, c);
  return c;
}

/* ------------------------------------------------------ scrollytelling stage */
const stage = $('#pfStage');
const canvas = $('#pfTiles');
const labelHost = $('#pfLabels');
const scrolly = $('#pfScrolly');
const steps = $$('.pf-step', scrolly);
const ctx = canvas.getContext('2d');
const rnd = seeded(20260630);
const tiles = FILLS.map((fill, i) => ({ ...fill, i, variant: i % 9, rot: (rnd() - .5) * .06, delay: rnd() }));
let W = 0, H = 0, S = 12, layouts = [], labelSets = [];

const monthIndex = f => (f.y - 2025) * 12 + f.m - 7; // Jul 2025 = 0
const MONTHS_EN = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
const MONTHS_ZH = ['7月','8月','9月','10月','11月','12月','1月','2月','3月','4月','5月','6月'];

function buildLayouts() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = stage.clientWidth; H = stage.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const narrow = W < 720;
  const topPad = narrow ? 70 : 90;
  const usableH = H - topPad - (narrow ? H * .36 : 70);

  // L0/L1: loose mosaic over a grid (hero + "each square is a fill")
  S = narrow ? 13 : clamp(Math.round(Math.min(W, 1500) / 58), 14, 24);
  const cell = S * 1.5;
  const cols = Math.floor(W / cell), rows = Math.floor(H / cell);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
  const r0 = seeded(99);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r0() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const scatter = tiles.map((t, i) => {
    const [c, r] = cells[i % cells.length];
    return { x: c * cell + (cell - S) / 2, y: r * cell + (cell - S) / 2, s: S, a: 1 };
  });
  const L0 = scatter.map((p, i) => ({ ...p, color: '#dcd8c9', a: .9 }));
  const L1 = scatter.map((p, i) => ({ ...p, color: tiles[i].side === 'B' ? '#9d90ec' : '#83b0ec' }));

  // L2: monthly columns (Jul -> Jun)
  const perRow = narrow ? 3 : 4;
  const maxCount = 92;
  const s2 = Math.max(4, Math.min((W * .86 / 12) / perRow * .82, usableH / Math.ceil(maxCount / perRow) * .86));
  const gap2 = s2 * 1.18;
  const colW = W * .9 / 12;
  const baseY = topPad + usableH;
  const counts = new Array(12).fill(0);
  const L2 = tiles.map(t => {
    const m = monthIndex(t), k = counts[m]++;
    const x0 = W * .05 + m * colW + (colW - perRow * gap2) / 2;
    return { x: x0 + (k % perRow) * gap2, y: baseY - (Math.floor(k / perRow) + 1) * gap2, s: s2, a: 1, color: m >= 9 ? '#9d90ec' : '#cfc9b6' };
  });
  const monthLabels = MONTHS_EN.map((_, m) => ({
    x: W * .05 + m * colW + colW / 2, y: baseY + 10,
    text: isZh ? MONTHS_ZH[m] : MONTHS_EN[m], sub: counts[m] ? String(counts[m]) : '', align: 'top',
  }));

  // L3: theme clusters
  const groups = THEME_ORDER.map(key => tiles.filter(t => t.theme === key));
  const clusterCols = narrow ? 4 : 8;
  const clusterRows = Math.ceil(THEME_ORDER.length / clusterCols);
  const cw = W * .9 / clusterCols;
  const perRow3 = narrow ? 6 : 7;
  const s3 = Math.max(4, Math.min(cw / perRow3 * .78, (usableH / clusterRows - 40) / Math.ceil(74 / perRow3) * .84));
  const gap3 = s3 * 1.16;
  const rowH = usableH / clusterRows;
  const L3 = new Array(tiles.length);
  const themeLabels = [];
  groups.forEach((group, gi) => {
    const col = gi % clusterCols, row = Math.floor(gi / clusterCols);
    const x0 = W * .05 + col * cw + (cw - perRow3 * gap3) / 2;
    const base = topPad + (row + 1) * rowH - 34;
    group.forEach((t, k) => {
      L3[t.i] = { x: x0 + (k % perRow3) * gap3, y: base - (Math.floor(k / perRow3) + 1) * gap3, s: s3, a: 1, color: THEMES[t.theme].color };
    });
    themeLabels.push({ x: W * .05 + col * cw + cw / 2, y: base + 8, text: THEMES[THEME_ORDER[gi]][isZh ? 'zh' : 'en'], sub: `${group.length}`, align: 'top' });
  });

  // L4: 10 x 10 waffle of realized gains by theme; unused fills fade away
  const s4 = Math.min(narrow ? W * .07 : 34, usableH / 11.2);
  const gap4 = s4 * 1.14;
  const gx = (W - gap4 * 10) / 2 + (narrow ? 0 : W * .12);
  const gy = topPad + (usableH - gap4 * 10) / 2;
  const slots = [];
  Object.entries(GAIN_SQUARES).forEach(([key, n]) => { for (let k = 0; k < n; k++) slots.push(key); });
  const pool = {}; THEME_ORDER.forEach(k => { pool[k] = groups[THEME_ORDER.indexOf(k)].slice(); });
  const used = new Set();
  const L4 = new Array(tiles.length);
  slots.forEach((key, idx) => {
    let t = pool[key].shift();
    if (!t) t = tiles.find(x => !used.has(x.i) && x.theme === 'other') || tiles.find(x => !used.has(x.i));
    used.add(t.i);
    const col = idx % 10, row = Math.floor(idx / 10);
    L4[t.i] = { x: gx + col * gap4, y: gy + row * gap4, s: s4, a: 1, color: THEMES[key].color };
  });
  tiles.forEach(t => { if (!L4[t.i]) L4[t.i] = { ...L3[t.i], a: 0, s: L3[t.i].s * .4 }; });
  const waffleLabels = [];
  let acc = 0;
  Object.entries(GAIN_SQUARES).forEach(([key, n]) => {
    if (n >= 10) {
      const mid = acc + n / 2, row = Math.floor(mid / 10);
      waffleLabels.push({ x: gx + gap4 * 10 + 14, y: gy + row * gap4 + s4 / 2, text: THEMES[key][isZh ? 'zh' : 'en'], sub: `${GAIN_SHARE[key]}%`, align: 'side' });
    }
    acc += n;
  });

  layouts = [L0, L1, L2, L3, L4];
  labelSets = [[], [], monthLabels, themeLabels, narrow ? [] : waffleLabels];
  renderLabels();
}

function renderLabels() {
  labelHost.textContent = '';
  labelSets.forEach((set, li) => {
    set.forEach(label => {
      const el = document.createElement('span');
      el.className = `pf-tile-label pf-tile-label--${label.align}`;
      el.dataset.layer = li;
      el.style.left = `${label.x}px`; el.style.top = `${label.y}px`;
      el.innerHTML = `<b></b><small></small>`;
      el.firstChild.textContent = label.text; el.lastChild.textContent = label.sub;
      labelHost.append(el);
    });
  });
}

let stepFloat = 0, drawn = -1;
function draw() {
  if (!layouts.length) return;
  ctx.clearRect(0, 0, W, H);
  const i0 = Math.floor(stepFloat), i1 = Math.min(i0 + 1, layouts.length - 1), f = stepFloat - i0;
  const A = layouts[i0], B = layouts[i1];
  for (let k = 0; k < tiles.length; k++) {
    const t = tiles[k], a = A[k], b = B[k];
    const local = ease(clamp((f - t.delay * .35) / .65));
    const x = a.x + (b.x - a.x) * local, y = a.y + (b.y - a.y) * local;
    const s = a.s + (b.s - a.s) * local, alpha = a.a + (b.a - a.a) * local;
    if (alpha < .02) continue;
    const pad = s * 4 / 64;
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2); ctx.rotate(t.rot);
    const drawSprite = (color, al) => {
      if (al < .01) return;
      ctx.globalAlpha = al;
      ctx.drawImage(tileSprite(color, t.variant), -s / 2 - pad, -s / 2 - pad, s + pad * 2, s + pad * 2);
    };
    if (a.color === b.color) drawSprite(a.color, alpha);
    else { drawSprite(a.color, alpha * (1 - local)); drawSprite(b.color, alpha * local); }
    ctx.restore();
  }
  $$('.pf-tile-label', labelHost).forEach(el => {
    const layer = +el.dataset.layer;
    el.style.opacity = String(clamp(1 - Math.abs(stepFloat - layer) * 1.6));
  });
}

function onScroll() {
  const rect = scrolly.getBoundingClientRect();
  const total = scrolly.offsetHeight - innerHeight;
  const p = clamp(-rect.top / Math.max(1, total));
  // each step card occupies an equal slice; hold on each layout, morph between
  const raw = p * (steps.length - 1) * 1.0;
  const i = Math.floor(raw), f = raw - i;
  const next = i + clamp((f - .2) / .6);
  stepFloat = clamp(next, 0, layouts.length - 1);
  steps.forEach((el, idx) => el.classList.toggle('is-active', Math.round(raw) === idx));
  const bar = $('#pfProgress');
  if (bar) bar.style.transform = `scaleX(${clamp(scrollY / (document.documentElement.scrollHeight - innerHeight))})`;
  if (stepFloat !== drawn) { drawn = stepFloat; draw(); }
}

let resizeTimer = 0;
function setup() { buildLayouts(); drawn = -1; onScroll(); }
setup();
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 120); });
addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });

/* ------------------------------------------------------------- hero count */
function countUp(el, to, { decimals = 1, prefix = '', suffix = '%', duration = 1600 } = {}) {
  const fmt = v => `${prefix}${v.toFixed(decimals)}${suffix}`;
  if (reduced.matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const tick = now => {
    const t = clamp((now - t0) / duration);
    el.textContent = fmt(to * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* --------------------------------------------------------- reveal on view */
const onView = (el, fn, threshold = .3) => {
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { fn(entry.target); io.unobserve(entry.target); }
  }), { threshold });
  io.observe(el);
};
$$('[data-count]').forEach(el => onView(el, () => countUp(el, +el.dataset.count, {
  decimals: +(el.dataset.decimals ?? 1), prefix: el.dataset.prefix || '', suffix: el.dataset.suffix ?? '%',
}), .6));
$$('.pf-reveal').forEach(el => onView(el, node => node.classList.add('is-in'), .18));

/* ------------------------------------------------------------- highlights */
const NAMES = { SNDK: 'Sandisk', MRVL: 'Marvell', INTC: 'Intel', DRAM: L('Roundhill Memory ETF', 'Roundhill 存储 ETF'), AMD: 'AMD', SPCX: 'SpaceX', MU: 'Micron' };
const HIGHLIGHTS = [
  { t: 'SNDK', r: 33.1, from: '2026-01-27', to: '2026-01-30', hold: L('3 days', '3 天'),
    en: 'Bought into the storage rally and sold three days later: the largest single gain of the year.',
    zh: '顺着存储板块的上涨买入，三天后卖出：全年收益最大的一笔。' },
  { t: 'MRVL', r: 32.3, from: '2026-05-26', to: '2026-06-02', hold: L('1 week', '1 周'),
    en: 'A one-week position in custom AI silicon that captured almost a third in price.',
    zh: '定制 AI 芯片的一周持仓，价差接近三分之一。' },
  { t: 'INTC', r: 17.9, from: '2026-04-22', to: '2026-04-23', hold: L('Overnight', '隔夜'),
    en: 'A full-size position held for one night and sold into strength the next session.',
    zh: '满额仓位只持有一晚，次个交易日冲高即兑现。' },
  { t: 'DRAM', r: 16.5, from: '2026-05-04', to: '2026-05-06', hold: L('2 days', '2 天'),
    en: 'The memory theme expressed through a basket: the first of two double-digit swings in the ETF inside one week.',
    zh: '用存储 ETF 表达主题：一周之内两段两位数波段中的第一段。' },
  { t: 'AMD', r: 15.9, from: '2026-05-04', to: '2026-05-05', hold: L('Overnight', '隔夜'),
    en: 'An overnight hold on the compute theme, then repeated four days later for a second gain.',
    zh: '围绕算力主题隔夜持有；四天后再次操作，再度获利。' },
  { t: 'SPCX', r: 14.0, from: '2026-06-12', to: '2026-06-12', hold: L('Same day', '当日'),
    en: 'In and out within a single session as the space category moved.',
    zh: '太空板块异动当天，一个交易日内完成进出。' },
];
const fmtDate = iso => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(isZh ? 'zh-CN' : 'en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const hlHost = $('#pfHighlights');
HIGHLIGHTS.forEach((h, idx) => {
  const theme = THEMES[TICKER_THEME[h.t]];
  const card = document.createElement('article');
  card.className = 'pf-hl pf-reveal';
  card.style.setProperty('--tone', theme.color);
  card.style.setProperty('--i', idx);
  const rise = 150 - h.r * 3.6;
  card.innerHTML = `
    <header><span class="pf-hl-rank">${String(idx + 1).padStart(2, '0')}</span><span class="pf-hl-theme"></span></header>
    <h3><span class="pf-hl-logo">${portfolioLogo(h.t, { decorative: true })}</span><span class="pf-hl-name"></span></h3>
    <svg class="pf-hl-chart" viewBox="0 0 300 170" aria-hidden="true">
      <g class="pf-hl-grid">${[0,1,2,3,4,5].map(k => `<line x1="0" x2="300" y1="${10 + k * 30}" y2="${10 + k * 30}"/>`).join('')}${[0,1,2,3,4,5,6].map(k => `<line y1="0" y2="170" x1="${k * 50}" x2="${k * 50}"/>`).join('')}</g>
      <rect class="pf-hl-area" x="40" y="${rise}" width="220" height="${150 - rise}"/>
      <path class="pf-hl-line" d="M40 150 L260 ${rise}" pathLength="1"/>
      <rect class="pf-hl-dot" x="33" y="143" width="14" height="14"/>
      <rect class="pf-hl-dot pf-hl-dot--exit" x="253" y="${rise - 7}" width="14" height="14"/>
    </svg>
    <div class="pf-hl-figure"><strong data-count="${h.r}" data-prefix="+">+${h.r}%</strong><span class="pf-hl-hold"></span></div>
    <p class="pf-hl-dates"></p>
    <p class="pf-hl-copy"></p>`;
  card.querySelector('.pf-hl-theme').textContent = theme[isZh ? 'zh' : 'en'];
  card.querySelector('.pf-hl-name').textContent = `${NAMES[h.t]} · ${h.t}`;
  card.querySelector('.pf-hl-hold').textContent = h.hold;
  card.querySelector('.pf-hl-dates').textContent = h.from === h.to ? fmtDate(h.from) + ' 2026' : `${fmtDate(h.from)} → ${fmtDate(h.to)} 2026`;
  card.querySelector('.pf-hl-copy').textContent = isZh ? h.zh : h.en;
  hlHost.append(card);
  onView(card, node => node.classList.add('is-in'), .25);
  const num = card.querySelector('[data-count]');
  onView(num, () => countUp(num, h.r, { prefix: '+' }), .6);
});

/* --------------------------------------------------------- scatter chart */
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => { const el = document.createElementNS(SVGNS, name); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
function buildScatter() {
  const host = $('#pfScatter');
  const tip = $('#pfScatterTip');
  const Wv = 960, Hv = 500, m = { l: 64, r: 28, t: 26, b: 64 };
  const svg = svgEl('svg', { viewBox: `0 0 ${Wv} ${Hv}`, role: 'img', 'aria-label': L('Profitable round trips by holding period and return', '盈利往返交易：持有天数与收益率') });
  const xs = d => m.l + Math.log1p(d) / Math.log1p(180) * (Wv - m.l - m.r);
  const ys = r => Hv - m.b - r / 35 * (Hv - m.t - m.b);
  const grid = svgEl('g', { class: 'pf-sc-grid' });
  [0, 5, 10, 15, 20, 25, 30, 35].forEach(r => {
    grid.append(svgEl('line', { x1: m.l, x2: Wv - m.r, y1: ys(r), y2: ys(r) }));
    const tx = svgEl('text', { x: m.l - 12, y: ys(r) + 4, 'text-anchor': 'end' }); tx.textContent = `${r}%`; grid.append(tx);
  });
  [[0, L('same day', '当日')], [1, '1d'], [3, '3d'], [7, L('1 wk', '1 周')], [30, L('1 mo', '1 月')], [90, L('3 mo', '3 月')], [180, L('6 mo', '6 月')]].forEach(([d, label]) => {
    grid.append(svgEl('line', { x1: xs(d), x2: xs(d), y1: m.t, y2: Hv - m.b, class: 'v' }));
    const tx = svgEl('text', { x: xs(d), y: Hv - m.b + 24, 'text-anchor': 'middle' }); tx.textContent = label; grid.append(tx);
  });
  const xt = svgEl('text', { x: (Wv + m.l) / 2, y: Hv - 12, 'text-anchor': 'middle', class: 'pf-sc-axis' }); xt.textContent = L('Holding period (log scale)', '持有期（对数刻度）');
  grid.append(xt);
  // one-week band
  svg.append(svgEl('rect', { x: m.l, y: m.t, width: xs(7) - m.l, height: Hv - m.t - m.b, class: 'pf-sc-band' }));
  svg.append(grid);
  const bandLabel = svgEl('text', { x: m.l + 10, y: m.t + 18, class: 'pf-sc-bandlabel' });
  bandLabel.textContent = L('≤ 1 week: 46 of 63 winners', '一周内：63 笔中的 46 笔');
  svg.append(bandLabel);
  const dots = svgEl('g');
  const jitter = seeded(7);
  ROUND_TRIPS.forEach(([t, b, s, d, r], idx) => {
    const g = svgEl('g', { class: 'pf-sc-dot', style: `--d:${idx * 18}ms` });
    const cx = xs(d) + (jitter() - .5) * 10, cy = ys(r);
    const size = 9 + Math.sqrt(r) * 2.2;
    const rect = svgEl('rect', { x: cx - size / 2, y: cy - size / 2, width: size, height: size, fill: THEMES[TICKER_THEME[t] || 'other'].color, transform: `rotate(${(jitter() - .5) * 8} ${cx} ${cy})` });
    const title = svgEl('title'); title.textContent = `${t} · +${r}% · ${d} ${L('days', '天')}`;
    g.append(title, rect);
    g.addEventListener('pointerenter', ev => {
      tip.hidden = false;
      tip.innerHTML = '<b></b><span></span><small></small>';
      tip.children[0].textContent = `${t} +${r}%`;
      tip.children[1].textContent = `${fmtDate(b)} → ${fmtDate(s)}`;
      tip.children[2].textContent = d === 0 ? L('Same-day trade', '当日交易') : `${d} ${L(d === 1 ? 'day' : 'days', '天')}`;
      const box = host.getBoundingClientRect();
      tip.style.left = `${clamp(cx / Wv * box.width, 70, box.width - 70)}px`;
      tip.style.top = `${cy / Hv * box.height}px`;
    });
    g.addEventListener('pointerleave', () => { tip.hidden = true; });
    dots.append(g);
  });
  // annotate the two headline trades
  [['SNDK', 3, 33.1], ['MRVL', 7, 32.3]].forEach(([t, d, r]) => {
    const tx = svgEl('text', { x: xs(d) + 14, y: ys(r) + 4, class: 'pf-sc-note' }); tx.textContent = `${t} +${r}%`; dots.append(tx);
  });
  svg.append(dots);
  host.prepend(svg);
  onView(host, () => host.classList.add('is-in'), .3);
  const legend = $('#pfScatterLegend');
  ['mem', 'cpu', 'net', 'kor', 'fab', 'opt', 'space', 'other'].forEach(k => {
    const s = document.createElement('span');
    s.innerHTML = '<i></i>';
    s.firstChild.style.background = THEMES[k].color;
    s.append(THEMES[k][isZh ? 'zh' : 'en']);
    legend.append(s);
  });
}
buildScatter();

/* ----------------------------------------------------- cycle journeys bars */
const JOURNEYS = [
  { t: 'MU', r: 215, en: 'Micron · first buy Feb → best exit Jun', zh: '美光 · 2 月首次买入 → 6 月最佳卖出' },
  { t: 'DRAM', r: 141, en: 'Memory ETF · first buy Apr → best exit Jun', zh: '存储 ETF · 4 月首次买入 → 6 月最佳卖出' },
  { t: 'MRVL', r: 92, en: 'Marvell · first buy Apr → best exit Jun', zh: 'Marvell · 4 月首次买入 → 6 月最佳卖出' },
  { t: 'SNDK', r: 50, en: 'Sandisk · first buy Jan → best exit Mar', zh: 'Sandisk · 1 月首次买入 → 3 月最佳卖出' },
];
const jHost = $('#pfJourneys');
JOURNEYS.forEach((j, idx) => {
  const row = document.createElement('div');
  row.className = 'pf-jr pf-reveal';
  row.style.setProperty('--w', `${j.r / 215 * 100}%`);
  row.style.setProperty('--tone', THEMES[TICKER_THEME[j.t]].color);
  row.style.setProperty('--i', idx);
  row.innerHTML = `<div class="pf-jr-head"><b>${j.t}</b><span></span></div><div class="pf-jr-track"><i></i></div><strong data-count="${j.r}" data-decimals="0" data-prefix="+">+${j.r}%</strong>`;
  row.querySelector('span').textContent = isZh ? j.zh : j.en;
  jHost.append(row);
  onView(row, node => node.classList.add('is-in'), .4);
  const num = row.querySelector('[data-count]');
  onView(num, () => countUp(num, j.r, { decimals: 0, prefix: '+' }), .6);
});

/* ---------------------------------------------------- closing book waffle */
const BOOK = [['DRAM', 46, 46.39, 'mem', '#9d90ec'], ['MU', 30, 30.21, 'mem', '#b9b0f2'], ['MRVL', 24, 23.39, 'net', '#8cc2a8']];
const waffle = $('#pfBookWaffle');
let cellIdx = 0;
BOOK.forEach(([t, n, pct, theme, color]) => {
  for (let k = 0; k < n; k++) {
    const i = document.createElement('i');
    i.style.background = color;
    i.style.setProperty('--d', `${cellIdx * 9}ms`);
    i.style.setProperty('--r', `${((cellIdx * 37) % 7 - 3) * .5}deg`);
    waffle.append(i); cellIdx++;
  }
});
onView(waffle, () => waffle.classList.add('is-in'), .3);
const bookLegend = $('#pfBookLegend');
BOOK.forEach(([t, , pct, , color]) => {
  const row = document.createElement('li');
  row.innerHTML = `<i></i><b>${t}</b><span></span><strong>${pct.toFixed(1)}%</strong>`;
  row.querySelector('i').style.background = color;
  row.querySelector('span').textContent = { DRAM: L('Roundhill Memory ETF', 'Roundhill 存储 ETF'), MU: L('Micron', '美光'), MRVL: 'Marvell' }[t];
  bookLegend.append(row);
});

/* ------------------------------------------------------------------ ideas */
const IDEAS = [
  ['NVDA', 'NVIDIA', ['AI compute', 'AI 算力'], ['The compute and networking platform at the centre of large-scale AI deployments.', '大型 AI 部署中的算力与网络平台核心。'], ['Watch data-centre demand, export constraints and customer concentration.', '关注数据中心需求、出口限制与客户集中度。']],
  ['MSFT', 'Microsoft', ['Software + cloud', '软件与云'], ['Azure and Copilot connect enterprise distribution to AI inference demand.', 'Azure 与 Copilot 把企业分发能力连接到 AI 推理需求。'], ['Watch AI monetisation against the cost of new capacity.', '关注 AI 变现能否覆盖新增基础设施成本。']],
  ['TSM', 'TSMC', ['Semiconductor foundry', '半导体代工'], ['Advanced nodes and packaging sit on the manufacturing path for leading AI chips.', '先进制程与封装是领先 AI 芯片的制造必经环节。'], ['Watch capacity expansion, geography and capital intensity.', '关注扩产、地缘因素与资本开支强度。']],
  ['AVGO', 'Broadcom', ['Custom silicon + networking', '定制芯片与网络'], ['Custom accelerators and high-speed networks offer a second route into AI infrastructure.', '定制加速器与高速网络是参与 AI 基础设施的另一条路径。'], ['Watch the concentration of a small set of hyperscale customers.', '关注少数大型云客户带来的集中度。']],
  ['MU', 'Micron', ['HBM + memory', '高带宽存储'], ['High-bandwidth memory links the AI accelerator cycle to a constrained component market.', '高带宽内存把 AI 加速器周期与紧俏元件市场连接起来。'], ['Watch pricing durability and the next HBM ramp.', '关注价格持续性与新一代 HBM 爬坡。']],
  ['VRT', 'Vertiv', ['Power + cooling', '电力与散热'], ['More compute requires more data-centre power delivery and thermal management.', '更多算力意味着更多数据中心供电与热管理需求。'], ['Watch order conversion and execution capacity.', '关注订单转化率与交付能力。']],
  ['RKLB', 'Rocket Lab', ['Space systems', '太空系统'], ['Launch plus spacecraft hardware provides exposure to a growing commercial and government space stack.', '发射服务加航天器硬件，覆盖商业与政府太空基础设施。'], ['Watch launch cadence, Neutron milestones and cash use.', '关注发射频率、Neutron 进度与现金消耗。']],
  ['LLY', 'Eli Lilly', ['Biomedicine', '生物医药'], ['A deep obesity and metabolic pipeline complements a large existing commercial franchise.', '肥胖症与代谢疾病管线结合已有的大型商业化业务。'], ['Watch supply, reimbursement and trial readouts.', '关注供应、支付覆盖与临床结果。']],
  ['CRSP', 'CRISPR Therapeutics', ['Gene editing', '基因编辑'], ['CASGEVY gives gene editing a commercial base while the broader pipeline develops.', 'CASGEVY 为基因编辑建立商业化基础，其他管线继续推进。'], ['Watch patient access, treatment throughput and clinical milestones.', '关注患者可及性、治疗交付速度与临床节点。']],
  ['COIN', 'Coinbase', ['Web3 infrastructure', 'Web3 基础设施'], ['Exchange, custody and on-chain services create multiple ways to participate in digital assets.', '交易、托管与链上服务构成参与数字资产市场的多条路径。'], ['Watch regulation, trading cycles and recurring revenue quality.', '关注监管、交易周期与经常性收入质量。']],
];
const IDEA_TONES = ['#83b0ec', '#8fa1bd', '#e39ea6', '#8cc2a8', '#9d90ec', '#d8bf78', '#8fa1bd', '#eeb08a', '#eeb08a', '#83b0ec'];
const ideaHost = $('#pfIdeas');
IDEAS.forEach(([ticker, name, sector, thesis, watch], idx) => {
  const card = document.createElement('article');
  card.className = 'pf-idea pf-reveal';
  card.style.setProperty('--tone', IDEA_TONES[idx]);
  card.style.setProperty('--i', idx % 5);
  card.innerHTML = `<header><span>${String(idx + 1).padStart(2, '0')}</span><span class="pf-idea-logo">${portfolioLogo(ticker, { decorative: true })}</span></header><h3></h3><b></b><p></p><small><em></em></small>`;
  card.querySelector('h3').textContent = name;
  card.querySelector('b').textContent = `${ticker} · ${sector[isZh ? 1 : 0]}`;
  card.querySelector('p').textContent = thesis[isZh ? 1 : 0];
  card.querySelector('em').textContent = L('What to watch', '观察要点');
  card.querySelector('small').append(` ${watch[isZh ? 1 : 0]}`);
  ideaHost.append(card);
  onView(card, node => node.classList.add('is-in'), .15);
});
