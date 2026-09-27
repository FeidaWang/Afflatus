import { portfolioLogo } from './portfolioLogos.js';
import { seeded, drawPen, drawInkGrid, installInkFilters, inkLineD, inkPathD, polyD, wobblyQuad, penSquareEdges, strokeOutline, shade } from './portfolioInk.js';
import { TetrisScript, drawWell, drawWellCells, shapeCells, TYPES } from './portfolioTetris.js';

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
  mem: { en: 'Memory & storage', zh: '存储与内存', color: '#8b7fe0' },
  cpu: { en: 'Compute chips', zh: '算力芯片', color: '#6a9bcc' },
  net: { en: 'Custom silicon', zh: '定制芯片与网络', color: '#7fb38f' },
  kor: { en: 'Korea ETFs', zh: '韩国 ETF', color: '#e8996a' },
  fab: { en: 'Foundry & tools', zh: '代工与设备', color: '#d98aa0' },
  opt: { en: 'Optics', zh: '光通信', color: '#d2af52' },
  space: { en: 'Space', zh: '太空', color: '#8a9bb8' },
  other: { en: 'Other', zh: '其他', color: '#c9c3b0' },
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

/* ------------------------------------------------------------- pen palette */
installInkFilters();
// One tetromino per theme, so the opening game already speaks the page's colours.
const PIECE_COLORS = { I: THEMES.cpu.color, O: THEMES.mem.color, T: THEMES.net.color, S: THEMES.kor.color, Z: THEMES.fab.color, J: THEMES.space.color, L: THEMES.opt.color };
const BUY = THEMES.mem.color, SELL = THEMES.cpu.color;

/* ------------------------------------------------------ scrollytelling stage */
const stage = $('#pfStage');
const canvas = $('#pfTiles');
const labelHost = $('#pfLabels');
const scrolly = $('#pfScrolly');
const steps = $$('.pf-step', scrolly);
const ctx = canvas.getContext('2d');
const rnd = seeded(20260630);
const gridCanvas = $('#pfGrid');
const tiles = FILLS.map((fill, i) => ({ ...fill, i, variant: i % 12, rot: (rnd() - .5) * .07, delay: rnd() }));
let W = 0, H = 0, S = 12, layouts = [], labelSets = [];
// Opening: two self-playing wells either side of the headline.
const wideGames = [new TetrisScript({ seed: 20250701, length: 240 }), new TetrisScript({ seed: 20260630, length: 240 })];
const phoneGames = new Map();
let heroGames = wideGames;
let wells = [], heroT = 26, heroFrames = [];

const monthIndex = f => (f.y - 2025) * 12 + f.m - 7; // Jul 2025 = 0
const MONTHS_EN = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
const MONTHS_ZH = ['7月','8月','9月','10月','11月','12月','1月','2月','3月','4月','5月','6月'];

function buildLayouts() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = stage.clientWidth; H = stage.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (gridCanvas) {
    gridCanvas.width = W * dpr; gridCanvas.height = H * dpr;
    gridCanvas.style.width = `${W}px`; gridCanvas.style.height = `${H}px`;
    const g = gridCanvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    drawInkGrid(g, W, H, { step: W < 720 ? 16 : 20, major: 4, seed: 7, strength: .8 });
  }
  const narrow = W < 720;
  // hero wells: in the margins on wide screens, faint behind the headline on narrow ones
  const side = W >= 1000 ? (W - Math.min(860, W * .6)) / 2 : W * .5;
  const WS = W >= 1000 ? clamp(Math.floor((side - 70) / 10), 12, 30) : clamp(Math.floor((side - 26) / 10), 9, 16);
  const wellS = Math.max(8, Math.min(WS, Math.floor((H - 190) / 20)));
  const wy = Math.max(96, (H - wellS * 20) / 2 + 24);
  wells = [
    { x: Math.round(side / 2 - wellS * 5), y: wy, S: wellS, cols: 10, rows: 20, seed: 3, label: L('BUYS', '买入') },
    { x: Math.round(W - side / 2 - wellS * 5), y: wy, S: wellS, cols: 10, rows: 20, seed: 9, label: L('SELLS', '卖出') },
  ];
  heroGames = wideGames;
  if (W < 720) {
    // phones: one wide, shallow well in the band above the headline
    const pS = 14, pCols = Math.floor((W - 40) / pS), pRows = clamp(Math.floor((H * .5 - 230) / pS), 6, 11);
    if (!phoneGames.has(pCols * 100 + pRows)) phoneGames.set(pCols * 100 + pRows, new TetrisScript({ cols: pCols, rows: pRows, seed: 2026, length: 300, ceiling: .8 }));
    heroGames = [phoneGames.get(pCols * 100 + pRows)];
    wells = [{ x: Math.round((W - pCols * pS) / 2), y: 44, S: pS, cols: pCols, rows: pRows, seed: 5, label: L('BUYS · SELLS', '买入 · 卖出') }];
  } else if (W < 1000) { wells[0].x = Math.round(W * .03); wells[1].x = Math.round(W * .97 - wellS * 10); }
  heroFrames = heroGames.map(g => g.frame(heroT));
  const topPad = narrow ? 70 : 90;
  const usableH = H - topPad - (narrow ? H * .36 : 70);
  const ax0 = narrow ? W * .05 : W * .38, ax1 = narrow ? W * .95 : W * .96, aw = ax1 - ax0;

  // L1: the fills scattered as loose tetrominoes, buys and sells kept in separate pieces
  S = narrow ? 13 : clamp(Math.round(Math.min(W, 1500) / 58), 14, 24);
  const cell = S * 1.14;
  const cols = Math.floor(W / cell), rows = Math.floor((H - 8) / cell);
  const taken = new Uint8Array(cols * rows);
  const r0 = seeded(99);
  const order = tiles.slice().sort((a, b) => (a.side === b.side ? a.i - b.i : a.side === 'B' ? -1 : 1));
  const L1 = new Array(tiles.length);
  const free = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !taken[r * cols + c];
  for (let g = 0; g < order.length; g += 4) {
    const group = order.slice(g, g + 4);
    let placed = null;
    for (let attempt = 0; attempt < 400 && !placed; attempt++) {
      const type = TYPES[Math.floor(r0() * 7)], shape = shapeCells(type, Math.floor(r0() * 4)).slice(0, group.length);
      const c0 = Math.floor(r0() * cols), rr = Math.floor(r0() * rows);
      // keep a one-cell moat around every piece so the shapes stay legible
      const ok = shape.every(([x, y]) => free(c0 + x, rr + y)) && shape.every(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
        const c = c0 + x + dx, r = rr + y + dy;
        return shape.some(([sx, sy]) => sx === x + dx && sy === y + dy) || c < 0 || r < 0 || c >= cols || r >= rows || !taken[r * cols + c];
      }));
      if (ok) placed = shape.map(([x, y]) => [c0 + x, rr + y]);
    }
    if (!placed) placed = group.map((_, k) => [Math.floor(r0() * cols), Math.floor(r0() * rows)]);
    placed.forEach(([c, r]) => { if (c < cols && r < rows) taken[r * cols + c] = 1; });
    group.forEach((t, k) => {
      const [c, r] = placed[k];
      L1[t.i] = { x: c * cell + (cell - S) / 2, y: 4 + r * cell + (cell - S) / 2, s: S, a: 1, color: t.side === 'B' ? BUY : SELL };
    });
  }
  const L0 = L1; // replaced every frame by the live hero wells (see heroLayout)

  // L2: monthly columns (Jul -> Jun)
  const perRow = narrow ? 3 : 4;
  const maxCount = 92;
  const colW = aw / 12;
  const s2 = Math.max(4, Math.min(colW / perRow * .8, usableH / Math.ceil(maxCount / perRow) * .86));
  const gap2 = s2 * 1.18;
  const baseY = topPad + usableH;
  const counts = new Array(12).fill(0);
  const L2 = tiles.map(t => {
    const m = monthIndex(t), k = counts[m]++;
    const x0 = ax0 + m * colW + (colW - perRow * gap2) / 2;
    return { x: x0 + (k % perRow) * gap2, y: baseY - (Math.floor(k / perRow) + 1) * gap2, s: s2, a: 1, color: m >= 9 ? BUY : '#c9c3b0' };
  });
  const monthLabels = MONTHS_EN.map((_, m) => ({
    x: ax0 + m * colW + colW / 2, y: baseY + 10,
    text: isZh ? MONTHS_ZH[m] : MONTHS_EN[m], sub: counts[m] ? String(counts[m]) : '', align: 'top',
  }));

  // L3: theme clusters
  const groups = THEME_ORDER.map(key => tiles.filter(t => t.theme === key));
  const clusterCols = 4;
  const clusterRows = Math.ceil(THEME_ORDER.length / clusterCols);
  const cw = aw / clusterCols;
  const perRow3 = narrow ? 6 : 8;
  const s3 = Math.max(4, Math.min(cw / perRow3 * .74, (usableH / clusterRows - 44) / Math.ceil(74 / perRow3) * .84));
  const gap3 = s3 * 1.16;
  const rowH = usableH / clusterRows;
  const L3 = new Array(tiles.length);
  const themeLabels = [];
  groups.forEach((group, gi) => {
    const col = gi % clusterCols, row = Math.floor(gi / clusterCols);
    const x0 = ax0 + col * cw + (cw - perRow3 * gap3) / 2;
    const base = topPad + (row + 1) * rowH - 34;
    group.forEach((t, k) => {
      L3[t.i] = { x: x0 + (k % perRow3) * gap3, y: base - (Math.floor(k / perRow3) + 1) * gap3, s: s3, a: 1, color: THEMES[t.theme].color };
    });
    themeLabels.push({ x: ax0 + col * cw + cw / 2, y: base + 8, text: THEMES[THEME_ORDER[gi]][isZh ? 'zh' : 'en'], sub: `${group.length}`, align: 'top' });
  });

  // L4: 10 x 10 waffle of realized gains by theme; unused fills fade away
  const s4 = Math.min(narrow ? W * .07 : 34, usableH / 11.2);
  const gap4 = s4 * 1.14;
  const gx = narrow ? (W - gap4 * 10) / 2 : ax0 + (aw - gap4 * 10 - 180) / 2;
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
  let acc = 0, lastY = -Infinity;
  Object.entries(GAIN_SQUARES).forEach(([key, n]) => {
    if (n >= 10) {
      const row = Math.floor((acc + n / 2) / 10);
      const y = Math.max(gy + row * gap4 + s4 / 2, lastY + 50);
      lastY = y;
      waffleLabels.push({ x: gx + gap4 * 10 + 16, y, text: THEMES[key][isZh ? 'zh' : 'en'], sub: `${GAIN_SHARE[key]}%`, align: 'side' });
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
      el.className = `pf-tile-label pf-tile-label--${label.align}${W < 720 ? ' is-compact' : ''}`;
      el.dataset.layer = li;
      el.style.left = `${label.x}px`; el.style.top = `${label.y}px`;
      el.innerHTML = `<b></b><small></small>`;
      el.firstChild.textContent = label.text; el.lastChild.textContent = label.sub;
      labelHost.append(el);
    });
  });
}

let stepFloat = 0, drawn = -1;
const WELL_FONT = `600 ${W < 720 ? 10 : 11}px Inter, system-ui, sans-serif`;
// Where each execution square sits while the opening games are on screen.
function heroLayout() {
  const out = new Array(tiles.length);
  let k = 0;
  heroFrames.forEach((frame, wi) => {
    const w = wells[wi];
    frame.cells.forEach(cell => {
      if (k >= tiles.length || cell.r < -.5) return;
      out[k++] = { x: w.x + cell.c * w.S, y: w.y + cell.r * w.S, s: w.S, a: cell.alpha * (W < 1000 && W >= 720 ? .42 : 1), color: PIECE_COLORS[cell.type], rot: 0 };
    });
  });
  const L1 = layouts[1];
  for (; k < tiles.length; k++) out[k] = { ...L1[k], y: L1[k].y - 60, s: L1[k].s * .4, a: 0 };
  return out;
}
function drawHero(alpha = 1) {
  const faint = W < 1000 && W >= 720 ? .42 : 1;
  wells.forEach((w, wi) => {
    drawWell(ctx, { ...w, alpha: alpha * (W < 1000 && W >= 720 ? .5 : 1), lines: heroFrames[wi].lines, next: heroFrames[wi].next, colors: PIECE_COLORS, font: WELL_FONT });
  });
  if (alpha >= .999) wells.forEach((w, wi) => drawWellCells(ctx, heroFrames[wi], { ...w, colors: PIECE_COLORS, alpha: faint }));
}
function draw() {
  if (!layouts.length) return;
  ctx.clearRect(0, 0, W, H);
  if (stepFloat <= .0005) { drawHero(1); updateLabels(); return; }
  if (stepFloat < .45) drawHero(1 - stepFloat / .45);
  const i0 = Math.floor(stepFloat), i1 = Math.min(i0 + 1, layouts.length - 1), f = stepFloat - i0;
  const A = i0 === 0 ? heroLayout() : layouts[i0], B = i1 === 0 ? heroLayout() : layouts[i1];
  for (let k = 0; k < tiles.length; k++) {
    const t = tiles[k], a = A[k], b = B[k];
    const local = ease(clamp((f - t.delay * .35) / .65));
    const x = a.x + (b.x - a.x) * local, y = a.y + (b.y - a.y) * local;
    const s = a.s + (b.s - a.s) * local, alpha = a.a + (b.a - a.a) * local;
    if (alpha < .02) continue;
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2); ctx.rotate(t.rot * (i0 === 0 ? local : 1));
    if (a.color === b.color) drawPen(ctx, a.color, t.variant, 'full', -s / 2, -s / 2, s, alpha);
    else { drawPen(ctx, a.color, t.variant, 'full', -s / 2, -s / 2, s, alpha * (1 - local)); drawPen(ctx, b.color, t.variant, 'full', -s / 2, -s / 2, s, alpha * local); }
    ctx.restore();
  }
  updateLabels();
}
function updateLabels() {
  $$('.pf-tile-label', labelHost).forEach(el => {
    const layer = +el.dataset.layer;
    el.style.opacity = String(clamp(1 - Math.abs(stepFloat - layer) * 1.6));
  });
}

// Auto-play runs only while the opening is on screen and not yet scrolled into the story.
let heroRaf = 0, heroLast = 0;
function heroTick(now) {
  heroRaf = 0;
  if (stepFloat > .0005 || scrollY > scrolly.offsetTop + innerHeight) return;
  const dt = heroLast ? Math.min(64, now - heroLast) : 16;
  heroLast = now;
  heroT += dt * .00105;
  heroFrames = heroGames.map(g => g.frame(heroT));
  draw();
  heroRaf = requestAnimationFrame(heroTick);
}
function startHero() {
  if (reduced.matches || heroRaf) return;
  heroLast = 0;
  heroRaf = requestAnimationFrame(heroTick);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(heroRaf); heroRaf = 0; } else startHero(); });

function onScroll() {
  // Each layout is fully formed when its step block's bottom meets the viewport
  // bottom; tiles hold briefly there, then morph toward the next anchor.
  const top = scrolly.getBoundingClientRect().top + scrollY;
  const anchors = steps.map((el, idx) => (idx === 0 ? top : top + el.offsetTop + el.offsetHeight - innerHeight));
  const y = scrollY;
  let i = 0;
  while (i < anchors.length - 2 && y >= anchors[i + 1]) i++;
  const f = clamp((y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]));
  stepFloat = clamp(i + clamp((f - .25) / .55), 0, layouts.length - 1);
  const active = Math.round(i + f);
  steps.forEach((el, idx) => el.classList.toggle('is-active', active === idx));
  const bar = $('#pfProgress');
  if (bar) bar.style.transform = `scaleX(${clamp(scrollY / (document.documentElement.scrollHeight - innerHeight))})`;
  if (stepFloat !== drawn) { drawn = stepFloat; draw(); }
  if (stepFloat <= .0005) startHero();
}

let resizeTimer = 0;
function setup() { buildLayouts(); drawn = -1; onScroll(); draw(); }
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
// A trade drawn by hand: ruled grid of uneven weight, a wandering price line,
// the gain hatched in marker, entry and exit boxed with overshooting pen strokes.
function highlightChart(h, tone, idx, rise) {
  const r = seeded(4099 + idx * 131);
  let grid = '';
  [0, 1, 2, 3, 4, 5].forEach(k => {
    const y = 10 + k * 30;
    grid += `<path d="${inkLineD(-2, y + (r() - .5), 302, y + (r() - .5) * 1.4, k % 5 === 0 ? 1.4 : 1, r, { taper: .05, wobble: .4 })}" opacity="${(.22 + r() * .26).toFixed(2)}"/>`;
  });
  [0, 1, 2, 3, 4, 5, 6].forEach(k => {
    const x = k * 50;
    grid += `<path d="${inkLineD(x + (r() - .5), -2, x + (r() - .5) * 1.4, 172, 1, r, { taper: .05, wobble: .4 })}" opacity="${(.16 + r() * .24).toFixed(2)}"/>`;
  });
  // Brownian bridge from entry to exit, so the line reads as a price path, not a ruler.
  const n = 22, pts = [];
  let walk = 0; const steps = [];
  for (let i = 0; i < n; i++) { walk += (r() - .5) * 11; steps.push(walk); }
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = 40 + 220 * t;
    const drift = i === 0 || i === n ? 0 : steps[i - 1] - steps[n - 1] * t;
    pts.push([x, clamp(150 + (rise - 150) * (t * t * (3 - 2 * t) * .6 + t * .4) + drift * Math.sin(Math.PI * t), 14, 158)]);
  }
  const area = pts.concat([[260, 150], [40, 150]]);
  let hatch = '';
  for (let i = -3; i < 16; i++) {
    const x = 20 + i * 18 + (r() - .5) * 6;
    hatch += `<path d="${inkLineD(x, 158, x + 70, rise - 12, 15 + r() * 6, r, { taper: .1, wobble: 1.2 })}" opacity="${(.42 + r() * .4).toFixed(2)}"/>`;
  }
  // the line itself in a few passes of slightly different weight
  const line = [0, 1].map(pass => `<path class="pf-hl-ink" d="${inkPathD(pts, pass ? 1.2 : 2.3, r, { taper: .12, wobble: .5 })}" opacity="${pass ? .35 : .88}"/>`).join('');
  const box = (x, y, filled) => {
    const edges = penSquareEdges(x - 7, y - 7, 14, 14, r, 4).map(([a, b]) => `<path d="${inkLineD(a[0], a[1], b[0], b[1], 1.7, r, { taper: .3 })}"/>`).join('');
    const wash = filled ? `<path class="pf-hl-wash" d="${polyD(wobblyQuad(x - 7, y - 7, 14, 14, r, 1))}"/>` : `<path class="pf-hl-paper" d="${polyD(wobblyQuad(x - 7, y - 7, 14, 14, r, 1))}"/>`;
    return `<g class="pf-hl-dot${filled ? ' pf-hl-dot--exit' : ''}">${wash}<g class="pf-hl-edge">${edges}</g></g>`;
  };
  const clipId = `pfHlClip${idx}`, maskId = `pfHlMask${idx}`;
  return `<svg class="pf-hl-chart" viewBox="0 0 300 170" aria-hidden="true">
      <defs><clipPath id="${clipId}"><path d="${polyD(area)}"/></clipPath>
      <mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="170"><rect class="pf-hl-reveal" x="0" y="0" width="300" height="170" fill="#fff"/></mask></defs>
      <g class="pf-hl-grid" filter="url(#pf-mk-rule)">${grid}</g>
      <g mask="url(#${maskId})">
        <g class="pf-hl-area" clip-path="url(#${clipId})" filter="url(#pf-mk-marker)" style="fill:${tone}">${hatch}</g>
        <g filter="url(#pf-mk-dry)">${line}</g>
      </g>
      ${box(40, 150, false)}${box(260, pts[n][1], true)}
    </svg>`;
}

const hlHost = $('#pfHighlights');
HIGHLIGHTS.forEach((h, idx) => {
  const theme = THEMES[TICKER_THEME[h.t]];
  const card = document.createElement('article');
  card.className = 'pf-hl pf-reveal';
  card.style.setProperty('--tone', theme.color);
  card.style.setProperty('--i', idx);
  const rise = 150 - h.r * 3.6;
  const chart = highlightChart(h, theme.color, idx, rise);
  card.innerHTML = `
    <header><span class="pf-hl-rank">${String(idx + 1).padStart(2, '0')}</span><span class="pf-hl-theme"></span></header>
    <h3><span class="pf-hl-logo">${portfolioLogo(h.t, { decorative: true })}</span><span class="pf-hl-name"></span></h3>
    ${chart}
    <div class="pf-hl-figure"><strong data-count="${h.r}" data-prefix="+">+${h.r}%</strong><span class="pf-hl-hold"></span></div>
    <p class="pf-hl-dates"></p>
    <p class="pf-hl-copy"></p>`;
  card.querySelector('.pf-hl-theme').textContent = theme[isZh ? 'zh' : 'en'];
  card.querySelector('.pf-hl-name').textContent = `${NAMES[h.t]} · ${h.t}`;
  card.querySelector('.pf-hl-hold').textContent = h.hold;
  const span = h.from === h.to ? fmtDate(h.from) : `${fmtDate(h.from)} → ${fmtDate(h.to)}`;
  card.querySelector('.pf-hl-dates').textContent = isZh ? `2026 年 ${span}` : `${span} 2026`;
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
  const r = seeded(63);
  const svg = svgEl('svg', { viewBox: `0 0 ${Wv} ${Hv}`, role: 'img', 'aria-label': L('Profitable round trips by holding period and return', '盈利往返交易：持有天数与收益率') });
  const xs = d => m.l + Math.log1p(d) / Math.log1p(180) * (Wv - m.l - m.r);
  const ys = v => Hv - m.b - v / 35 * (Hv - m.t - m.b);
  // one-week band: a loose marker wash laid down in vertical passes
  const band = svgEl('g', { class: 'pf-sc-band', filter: 'url(#pf-mk-marker)' });
  for (let x = m.l - 4; x < xs(7) + 2; x += 16) {
    band.append(svgEl('path', { d: inkLineD(x + (r() - .5) * 4, m.t - 2, x + (r() - .5) * 6, Hv - m.b + 3, 19 + r() * 6, r, { taper: .04, wobble: 1.4 }), opacity: (.12 + r() * .12).toFixed(3) }));
  }
  svg.append(band);
  const grid = svgEl('g', { class: 'pf-sc-grid' });
  const rules = svgEl('g', { class: 'pf-sc-rules', filter: 'url(#pf-mk-rule)' });
  [0, 5, 10, 15, 20, 25, 30, 35].forEach(v => {
    rules.append(svgEl('path', { d: inkLineD(m.l - 4, ys(v) + (r() - .5), Wv - m.r + 3, ys(v) + (r() - .5) * 1.6, v === 0 ? 1.6 : 1, r, { taper: .04, wobble: .5 }), opacity: (v === 0 ? .6 : .22 + r() * .24).toFixed(2) }));
    const tx = svgEl('text', { x: m.l - 12, y: ys(v) + 4, 'text-anchor': 'end' }); tx.textContent = `${v}%`; grid.append(tx);
  });
  [[0, L('same day', '当日')], [1, '1d'], [3, '3d'], [7, L('1 wk', '1 周')], [30, L('1 mo', '1 月')], [90, L('3 mo', '3 月')], [180, L('6 mo', '6 月')]].forEach(([d, label]) => {
    // dashed pen rule: each dash its own weight and opacity
    for (let y = m.t; y < Hv - m.b; y += 9) {
      rules.append(svgEl('path', { d: inkLineD(xs(d) + (r() - .5) * .8, y, xs(d) + (r() - .5) * .8, Math.min(Hv - m.b, y + 4 + r() * 2), .9, r, { taper: .3 }), opacity: (.2 + r() * .3).toFixed(2) }));
    }
    const tx = svgEl('text', { x: xs(d), y: Hv - m.b + 24, 'text-anchor': 'middle' }); tx.textContent = label; grid.append(tx);
  });
  const xt = svgEl('text', { x: (Wv + m.l) / 2, y: Hv - 12, 'text-anchor': 'middle', class: 'pf-sc-axis' }); xt.textContent = L('Holding period (log scale)', '持有期（对数刻度）');
  grid.append(xt);
  svg.append(rules, grid);
  const bandLabel = svgEl("text", { x: m.l + 12, y: ys(23), class: "pf-sc-bandlabel pf-hand", transform: `rotate(-4 ${m.l + 12} ${ys(23)})` });
  bandLabel.textContent = L('≤ 1 week: 46 of 63 winners', '一周内：63 笔中的 46 笔');
  svg.append(bandLabel);
  const dots = svgEl('g', { class: 'pf-sc-dots' });
  const jitter = seeded(7);
  ROUND_TRIPS.forEach(([t, b, s, d, v], idx) => {
    const tone = THEMES[TICKER_THEME[t] || 'other'].color;
    const g = svgEl('g', { class: 'pf-sc-dot', style: `--d:${idx * 18}ms` });
    const cx = xs(d) + (jitter() - .5) * 10, cy = ys(v);
    const size = 9 + Math.sqrt(v) * 2.2;
    const x0 = cx - size / 2, y0 = cy - size / 2;
    const ink = svgEl('g', { class: 'pf-sc-ink', filter: 'url(#pf-mk-marker)', transform: `rotate(${(jitter() - .5) * 8} ${cx} ${cy})`, style: `fill:${tone}` });
    ink.append(svgEl('path', { d: polyD(wobblyQuad(x0, y0, size, size, r, .9)), opacity: (.45 + r() * .2).toFixed(2) }));
    const passes = size > 16 ? 3 : 2;
    for (let k = 0; k < passes; k++) {
      const yy = y0 + size * (k + .5) / passes + (r() - .5) * 2;
      ink.append(svgEl('path', { d: inkLineD(x0 - 1 + r() * 2, yy, x0 + size + 1 - r() * 2, yy + (r() - .5) * 2, size / passes * 1.35, r, { taper: .1, wobble: .5 }), opacity: (.6 + r() * .4).toFixed(2) }));
    }
    penSquareEdges(x0, y0, size, size, r, 3).forEach(([p1, p2]) => ink.append(svgEl('path', { class: 'pf-sc-edge', d: inkLineD(p1[0], p1[1], p2[0], p2[1], 1.3, r, { taper: .3 }), style: `fill:${shade(tone, .55)}` })));
    const hit = svgEl('rect', { x: x0 - 3, y: y0 - 3, width: size + 6, height: size + 6, class: 'pf-sc-hit' });
    const title = svgEl('title'); title.textContent = `${t} · +${v}% · ${d} ${L('days', '天')}`;
    g.append(title, ink, hit);
    g.addEventListener('pointerenter', () => {
      tip.hidden = false;
      tip.innerHTML = '<b></b><span></span><small></small>';
      tip.children[0].textContent = `${t} +${v}%`;
      tip.children[1].textContent = `${fmtDate(b)} → ${fmtDate(s)}`;
      tip.children[2].textContent = d === 0 ? L('Same-day trade', '当日交易') : `${d} ${L(d === 1 ? 'day' : 'days', '天')}`;
      const box = host.getBoundingClientRect();
      tip.style.left = `${clamp(cx / Wv * box.width, 70, box.width - 70)}px`;
      tip.style.top = `${cy / Hv * box.height}px`;
    });
    g.addEventListener('pointerleave', () => { tip.hidden = true; });
    dots.append(g);
  });
  // annotate the two headline trades in handwriting, with pen arrows
  [['SNDK', 3, 33.1, 58, 30], ['MRVL', 7, 32.3, 70, 44]].forEach(([t, d, v, dx, dy]) => {
    const x = xs(d), y = ys(v);
    const tx = svgEl('text', { x: x + dx, y: y + dy + 5, class: 'pf-sc-note pf-hand' }); tx.textContent = `${t} +${v}%`;
    const bend = [[x + dx - 4, y + dy - 2], [x + dx * .45, y + dy * .9], [x + 13, y + 5]];
    const arrow = svgEl('g', { class: 'pf-sc-arrow', filter: 'url(#pf-mk-dry)' });
    arrow.append(svgEl('path', { d: inkPathD(bend, 1.5, r, { taper: .35 }) }));
    const [hx, hy] = bend[2];
    arrow.append(svgEl('path', { d: inkLineD(hx, hy, hx + 7, hy - 1, 1.4, r, { taper: .4 }) }), svgEl('path', { d: inkLineD(hx, hy, hx + 3, hy + 6, 1.4, r, { taper: .4 }) }));
    dots.append(arrow, tx);
  });
  svg.append(dots);
  host.prepend(svg);
  onView(host, () => host.classList.add('is-in'), .3);
  const legend = $('#pfScatterLegend');
  ['mem', 'cpu', 'net', 'kor', 'fab', 'opt', 'space', 'other'].forEach(k => {
    const sp = document.createElement('span');
    const lr = seeded(k.length * 97 + k.charCodeAt(0));
    sp.innerHTML = `<svg viewBox="-2 -2 14 14" aria-hidden="true"><g filter="url(#pf-mk-marker)" style="fill:${THEMES[k].color}"><path d="${polyD(wobblyQuad(0, 0, 10, 10, lr, .8))}" opacity=".85"/></g></svg>`;
    sp.append(THEMES[k][isZh ? 'zh' : 'en']);
    legend.append(sp);
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
// A marker bar: two or three overlapping passes, heavier where they cross,
// over a hand-ruled scale of ten ticks.
function markerBar(share, tone, idx) {
  const r = seeded(811 + idx * 37), w = 600 * share;
  let ticks = '';
  for (let k = 0; k <= 10; k++) {
    const x = 1 + k * 59.8;
    ticks += `<path d="${inkLineD(x + (r() - .5), 3 + r() * 3, x + (r() - .5) * 1.4, 31 - r() * 3, k ? 1.1 : 1.8, r, { taper: .1 })}" opacity="${(k ? .2 + r() * .22 : .6).toFixed(2)}"/>`;
  }
  let passes = '';
  [[17, 22], [12, 10], [23, 9]].forEach(([y, h], k) => {
    const end = w - (k ? 6 + r() * 24 : 0);
    if (end > 8) passes += `<path d="${inkLineD(2, y + (r() - .5) * 2, end, y + (r() - .5) * 3, h, r, { taper: .06, wobble: 1.1 })}" opacity="${(k ? .35 + r() * .25 : .78).toFixed(2)}"/>`;
  });
  return `<svg viewBox="0 0 600 34" preserveAspectRatio="none" aria-hidden="true"><g class="pf-jr-ticks" filter="url(#pf-mk-rule)">${ticks}</g><g class="pf-jr-bar" filter="url(#pf-mk-marker)" style="fill:${tone}">${passes}</g></svg>`;
}
const jHost = $('#pfJourneys');
JOURNEYS.forEach((j, idx) => {
  const row = document.createElement('div');
  row.className = 'pf-jr pf-reveal';
  row.style.setProperty('--w', `${j.r / 215 * 100}%`);
  row.style.setProperty('--tone', THEMES[TICKER_THEME[j.t]].color);
  row.style.setProperty('--i', idx);
  row.innerHTML = `<div class="pf-jr-head"><b>${j.t}</b><span></span></div><div class="pf-jr-track">${markerBar(j.r / 215, THEMES[TICKER_THEME[j.t]].color, idx)}</div><strong data-count="${j.r}" data-decimals="0" data-prefix="+">+${j.r}%</strong>`;
  row.querySelector('span').textContent = isZh ? j.zh : j.en;
  jHost.append(row);
  onView(row, node => node.classList.add('is-in'), .4);
  const num = row.querySelector('[data-count]');
  onView(num, () => countUp(num, j.r, { decimals: 0, prefix: '+' }), .6);
});

/* ---------------------------------------------------- closing book waffle */
const BOOK = [['DRAM', 46, 46.39, 'mem', THEMES.mem.color], ['MU', 30, 30.21, 'mem', '#b3a9ef'], ['MRVL', 24, 23.39, 'net', THEMES.net.color]];
const waffle = $('#pfBookWaffle');
{
  // 10 x 10 face of hand-inked squares, like one side of a marker-drawn cube.
  const r = seeded(630), cell = 46, gap = 0;
  let idx = 0, body = '';
  BOOK.forEach(([t, n, pct, theme, color]) => {
    for (let k = 0; k < n; k++, idx++) {
      const c = idx % 10, row = Math.floor(idx / 10), x = c * (cell + gap) + 3, y = row * (cell + gap) + 3, s = cell - 6;
      let g = `<path d="${polyD(wobblyQuad(x, y, s, s, r, 1.2))}" opacity="${(.28 + r() * .14).toFixed(2)}"/>`;
      const diag = r() < .3;
      for (let p = 0; p < 3; p++) {
        const off = (p + .5) * s / 3 + (r() - .5) * 3;
        g += diag
          ? `<path d="${inkLineD(x - 2 + off * .4, y + s + 1, x + off * .7 + s * .5, y - 1, s / 2.6, r, { taper: .1 })}" opacity="${(.3 + r() * .45).toFixed(2)}"/>`
          : `<path d="${inkLineD(x - 1, y + off, x + s + 1, y + off + (r() - .5) * 3, s / 2.6, r, { taper: .1 })}" opacity="${(.36 + r() * .46).toFixed(2)}"/>`;
      }
      const edges = penSquareEdges(x, y, s, s, r, 3.5).map(([p1, p2]) => `<path class="pf-wf-edge" d="${inkLineD(p1[0], p1[1], p2[0], p2[1], 1.5, r, { taper: .3 })}" style="fill:${shade(color, .55)}"/>`).join('');
      body += `<g class="pf-wf-cell" style="--d:${idx * 9}ms;--r:${((idx * 37) % 7 - 3) * .5}deg;fill:${color}"><g filter="url(#pf-mk-marker)">${g}</g>${edges}</g>`;
    }
  });
  waffle.innerHTML = `<svg viewBox="0 0 466 466" aria-hidden="true">${body}</svg>`;
}
onView(waffle, () => waffle.classList.add('is-in'), .3);
const bookLegend = $('#pfBookLegend');
BOOK.forEach(([t, , pct, , color]) => {
  const row = document.createElement('li');
  row.innerHTML = `<i></i><b>${t}</b><span></span><strong>${pct.toFixed(1)}%</strong>`;
  row.querySelector('i').style.setProperty('--tone', color);
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
const IDEA_TONES = ['cpu', 'space', 'fab', 'net', 'mem', 'opt', 'space', 'kor', 'kor', 'cpu'].map(k => THEMES[k].color);
// Claude's own ten, chosen without reference to Astra's list; overlaps are the easter egg.
const CLAUDE_IDEAS = [
  ['TSM', 'TSMC', ['Foundry + advanced packaging', '代工与先进封装'], ['Merchant GPU or custom accelerator, the leading AI chips still route through its leading-edge nodes and CoWoS packaging.', '无论通用 GPU 还是定制加速器，领先的 AI 芯片仍要经过它的先进制程与 CoWoS 封装。'], ['Watch overseas-fab margins, the 2nm ramp and packaging capacity.', '关注海外工厂毛利、2 纳米爬坡与封装产能。'], 'fab'],
  ['ASML', 'ASML', ['Lithography', '光刻'], ['The sole supplier of EUV scanners; High-NA adoption sets the pace of the next nodes.', 'EUV 光刻机的唯一供应商；High-NA 的导入节奏决定下一代制程的速度。'], ['Watch China export rules and when High-NA reaches volume production.', '关注对华出口规则，以及 High-NA 何时进入量产。'], 'fab'],
  ['AVGO', 'Broadcom', ['Custom XPUs + AI Ethernet', '定制 XPU 与 AI 以太网'], ['Custom accelerators and Ethernet fabrics let hyperscalers build around, not only on, merchant GPUs.', '定制加速器和以太网组网，让云厂商不必只依赖通用 GPU。'], ['Watch how many XPU customers reach volume, and the margin mix.', '关注有多少 XPU 客户进入量产，以及毛利结构。'], 'net'],
  ['MU', 'Micron', ['HBM + DRAM', 'HBM 与 DRAM'], ['The US memory maker in the HBM race — where AI demand met the tightest supply this year.', '参与 HBM 竞赛的美国存储厂商——今年 AI 需求正是在这里撞上最紧的供给。'], ['Watch HBM4 qualification and whether DRAM pricing holds as capacity grows.', '关注 HBM4 认证，以及扩产后 DRAM 价格能否守住。'], 'mem'],
  ['GOOGL', 'Alphabet', ['Full-stack AI', '全栈 AI'], ['TPUs, Gemini, Cloud and Search distribution: one of few companies that own the stack from chip to user.', 'TPU、Gemini、云与搜索分发：少数从芯片到用户整条链都自己掌握的公司。'], ['Watch Search economics as answers move into AI, and Cloud margins.', '关注答案转向 AI 之后的搜索经济性，以及云业务利润率。'], 'cpu'],
  ['META', 'Meta Platforms', ['AI + advertising', 'AI 与广告'], ['AI ranking and generative ad tools turn model spending into ad revenue faster than most.', 'AI 排序与生成式广告工具，把模型投入更快地转化为广告收入。'], ['Watch capex intensity against ad growth, and Reality Labs losses.', '关注资本开支强度与广告增速的对比，以及 Reality Labs 的亏损。'], 'cpu'],
  ['ALAB', 'Astera Labs', ['AI connectivity', 'AI 互连'], ['Retimers, CXL and fabric switches attack the data-movement bottleneck inside AI racks.', 'Retimer、CXL 与交换芯片，瞄准 AI 机柜内部的数据搬运瓶颈。'], ['Watch customer concentration and competition from the largest chipmakers.', '关注客户集中度，以及来自大型芯片公司的竞争。'], 'net'],
  ['GEV', 'GE Vernova', ['Power + grid', '发电与电网'], ['Gas turbines, grid equipment and small modular reactors sit on AI’s power bottleneck.', '燃气轮机、电网设备与小型模块化核电，正处在 AI 的电力瓶颈上。'], ['Watch turbine backlog pricing and losses in the wind business.', '关注燃机订单定价，以及风电业务亏损。'], 'opt'],
  ['ISRG', 'Intuitive Surgical', ['Surgical robotics', '手术机器人'], ['da Vinci 5 and a recurring instruments business: an installed base that compounds.', 'da Vinci 5 加上经常性的器械收入：一个会复利增长的装机基础。'], ['Watch procedure growth, GLP-1 effects on bariatric surgery and tariffs.', '关注手术量增长、GLP-1 对减重手术的影响，以及关税。'], 'kor'],
  ['ASTS', 'AST SpaceMobile', ['Direct-to-cell satellites', '卫星直连手机'], ['Broadband from orbit straight to ordinary phones, in partnership with major carriers.', '从轨道直接为普通手机提供宽带，与大型运营商合作。'], ['Watch satellite launch cadence, funding needs and dilution.', '关注卫星发射节奏、融资需求与股权稀释。'], 'space'],
];
const astraIndex = new Map(IDEAS.map(([t], i) => [t, i]));
const ideaCards = { astra: new Map(), claude: new Map() };

function ideaCard(host, [ticker, name, sector, thesis, watch], idx, tone, owner) {
  const card = document.createElement('article');
  card.className = 'pf-idea pf-reveal';
  card.style.setProperty('--tone', tone);
  card.style.setProperty('--i', idx % 5);
  const r = seeded(ticker.charCodeAt(0) * 131 + idx * 7 + (owner === 'claude' ? 999 : 0));
  const stroke = `<svg class="pf-idea-stroke" viewBox="0 0 240 12" preserveAspectRatio="none" aria-hidden="true"><g filter="url(#pf-mk-marker)" style="fill:${tone}"><path d="${inkLineD(-4, 6, 244, 5 + (r() - .5) * 3, 9, r, { taper: .03, wobble: 1.2 })}" opacity=".8"/><path d="${inkLineD(-4, 4, 180 + r() * 60, 5, 5, r, { taper: .05 })}" opacity=".4"/></g></svg>`;
  card.innerHTML = `${stroke}<header><span>${String(idx + 1).padStart(2, '0')}</span><span class="pf-idea-logo">${portfolioLogo(ticker, { decorative: true })}</span></header><h3></h3><b></b><p></p><small><em></em></small>`;
  card.querySelector('h3').textContent = name;
  card.querySelector('b').textContent = `${ticker} · ${sector[isZh ? 1 : 0]}`;
  card.querySelector('p').textContent = thesis[isZh ? 1 : 0];
  card.querySelector('em').textContent = L('Watch', '关注');
  card.querySelector('small').append(` ${watch[isZh ? 1 : 0].replace(/^Watch |^关注/, '')}`);
  host.append(card);
  onView(card, node => node.classList.add('is-in'), .15);
  ideaCards[owner].set(ticker, card);
  return card;
}
const ideaHost = $('#pfIdeas');
IDEAS.forEach((idea, idx) => ideaCard(ideaHost, idea, idx, IDEA_TONES[idx], 'astra'));
const claudeHost = $('#pfIdeasClaude');
if (claudeHost) {
  CLAUDE_IDEAS.forEach((idea, idx) => {
    const card = ideaCard(claudeHost, idea, idx, THEMES[idea[5]].color, 'claude');
    const twin = astraIndex.get(idea[0]);
    if (twin === undefined) return;
    card.classList.add('is-shared');
    ideaCards.astra.get(idea[0])?.classList.add('is-shared');
    const stamp = document.createElement('button');
    stamp.type = 'button';
    stamp.className = 'pf-idea-stamp';
    stamp.textContent = L(`✦ Astra's #${twin + 1} too`, `✦ Astra 也选了（#${twin + 1}）`);
    stamp.setAttribute('aria-label', L(`${idea[1]} is also on Astra's list, at number ${twin + 1}. Play the effect.`, `${idea[1]} 也在 Astra 的名单上，第 ${twin + 1} 位。播放特效。`));
    card.append(stamp);
    const play = () => celebrate(card, ideaCards.astra.get(idea[0]), THEMES[idea[5]].color);
    stamp.addEventListener('click', play);
    card.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') play(); });
  });
}

/* ------------------------------------------------ easter egg: shared picks */
// A pen loop drawn around both cards, and a handful of tetrominoes tossed into the air.
let burstCanvas = null, burstParts = [], burstRaf = 0;
function ring(card, tone) {
  if (!card) return;
  card.querySelector('.pf-idea-ring')?.remove();
  const w = card.offsetWidth + 22, h = card.offsetHeight + 22, r = seeded(Math.round(performance.now()));
  const pts = [];
  const n = 64, turn = 1.12; // a little past one lap, like a quick circling gesture
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI * .75 + turn * Math.PI * 2 * i / n;
    const cx = w / 2, cy = h / 2, rx = w / 2 - 5 + (r() - .5) * 3, ry = h / 2 - 5 + (r() - .5) * 3;
    // superellipse keeps the loop close to the card's rectangle
    const c = Math.cos(a), s = Math.sin(a), k = .35;
    pts.push([cx + rx * Math.sign(c) * Math.abs(c) ** k, cy + ry * Math.sign(s) * Math.abs(s) ** k + i * .12]);
  }
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'pf-idea-ring');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="M${pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L')}" pathLength="1" style="stroke:${shade(tone, .7)}" filter="url(#pf-mk-dry)"/>`;
  card.append(svg);
  requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('is-drawn')));
  setTimeout(() => svg.classList.add('is-fading'), 2600);
  setTimeout(() => svg.remove(), 3400);
}
function burst(card) {
  if (reduced.matches) return;
  if (!burstCanvas) {
    burstCanvas = document.createElement('canvas');
    burstCanvas.className = 'pf-burst';
    burstCanvas.setAttribute('aria-hidden', 'true');
    document.body.append(burstCanvas);
  }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  burstCanvas.width = innerWidth * dpr; burstCanvas.height = innerHeight * dpr;
  const box = card.getBoundingClientRect(), r = seeded(Math.round(performance.now()));
  for (let i = 0; i < 16; i++) {
    const type = TYPES[Math.floor(r() * TYPES.length)];
    burstParts.push({
      type, x: box.left + box.width * (.2 + r() * .6), y: box.top + 30 + r() * 40,
      vx: (r() - .5) * 9, vy: -7 - r() * 7, rot: r() * 6.28, vr: (r() - .5) * .22, s: 8 + r() * 6, life: 1, v: Math.floor(r() * 12),
    });
  }
  if (!burstRaf) burstRaf = requestAnimationFrame(burstTick);
}
function burstTick() {
  const g = burstCanvas.getContext('2d'), dpr = burstCanvas.width / innerWidth;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  burstParts.forEach(p => {
    p.vy += .32; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.rot += p.vr; p.life -= .011;
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
    shapeCells(p.type, 0).forEach(([cx, cy]) => drawPen(g, PIECE_COLORS[p.type], p.v, 'full', (cx - 1.5) * p.s, (cy - 1) * p.s, p.s, Math.max(0, Math.min(1, p.life * 1.6))));
    g.restore();
  });
  burstParts = burstParts.filter(p => p.life > 0 && p.y < innerHeight + 60);
  burstRaf = burstParts.length ? requestAnimationFrame(burstTick) : 0;
  if (!burstRaf) g.clearRect(0, 0, innerWidth, innerHeight);
}
const lastPlayed = new WeakMap();
function celebrate(card, twin, tone) {
  const now = performance.now();
  if (now - (lastPlayed.get(card) || 0) < 1800) return;
  lastPlayed.set(card, now);
  ring(card, tone); ring(twin, tone); burst(card);
  twin?.classList.add('is-echo');
  setTimeout(() => twin?.classList.remove('is-echo'), 2400);
}

/* --------------------------------------------------------------- finale */
// The page ends where it began: a wide self-playing game whose floor is the
// footer. Time keeps it moving; scrolling scrubs it forwards and backwards.
const finale = $('#pfFinale');
if (finale) {
  const fctx = finale.getContext('2d');
  let game = null, geo = null, fT = 14, fRaf = 0, fLast = 0, visible = false;
  const scrub = () => {
    const box = finale.getBoundingClientRect();
    return clamp((innerHeight - box.top) / (innerHeight + box.height)) * 22;
  };
  const fDraw = () => {
    if (!game) return;
    fctx.clearRect(0, 0, geo.W, geo.H);
    drawWellCells(fctx, game.frame(fT + scrub()), { ...geo, colors: PIECE_COLORS });
  };
  const fSetup = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const Wf = finale.parentElement.clientWidth;
    const S2 = clamp(Math.round(Wf / 46), 13, 26);
    const cols = Math.max(12, Math.floor((Wf - S2 * 2) / S2)), rows = 7;
    const Hf = (rows + 3) * S2;
    finale.width = Wf * dpr; finale.height = Hf * dpr;
    finale.style.width = `${Wf}px`; finale.style.height = `${Hf}px`;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geo = { x: Math.round((Wf - cols * S2) / 2), y: 3 * S2, S: S2, cols, W: Wf, H: Hf };
    game = new TetrisScript({ cols, rows, seed: 2027, length: 320, ceiling: .9 });
    fDraw();
  };
  const fTick = now => {
    fRaf = 0;
    if (!visible) return;
    fT += (fLast ? Math.min(64, now - fLast) : 16) * .0011;
    fLast = now;
    fDraw();
    fRaf = requestAnimationFrame(fTick);
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !reduced.matches && !fRaf) { fLast = 0; fRaf = requestAnimationFrame(fTick); }
  }).observe(finale);
  addEventListener('scroll', () => { if (visible && reduced.matches) fDraw(); }, { passive: true });
  addEventListener('resize', () => { clearTimeout(finale._t); finale._t = setTimeout(fSetup, 150); });
  fSetup();
}
