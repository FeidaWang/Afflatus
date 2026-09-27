// Self-playing Tetris drawn in marker ink.
// A game is pre-computed as a deterministic script of placements, so any moment
// can be rendered from a single number `t` (pieces played). Time advances it for
// the auto-play; scroll can scrub it forwards and backwards.
import { seeded, drawPen, rgba, shade, strokeOutline } from './portfolioInk.js';

const BASE = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
export const TYPES = Object.keys(BASE);
const SIZE = { I: 4, O: 4 };
function rotated(type, rot) {
  const n = SIZE[type] || 3;
  let cells = BASE[type].map(c => c.slice());
  for (let r = 0; r < rot % 4; r++) cells = cells.map(([x, y]) => [n - 1 - y, x]);
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]);
}
const SHAPES = {};
TYPES.forEach(t => { SHAPES[t] = [0, 1, 2, 3].map(r => rotated(t, r)); });
export const shapeCells = (type, rot) => SHAPES[type][rot % 4];
const ROTS = { O: 1, I: 2, S: 2, Z: 2 };

export class TetrisScript {
  constructor({ cols = 10, rows = 20, seed = 1, length = 260, ceiling = .72 } = {}) {
    this.cols = cols; this.rows = rows; this.moves = [];
    const rnd = seeded(seed);
    let board = new Int32Array(cols * rows); // 0 empty, else placement id + 1
    let bag = [];
    const nextType = () => {
      if (!bag.length) { bag = TYPES.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
      return bag.pop();
    };
    const fits = (b, cells, col, row) => cells.every(([x, y]) => {
      const c = col + x, r = row + y;
      return c >= 0 && c < cols && r < rows && (r < 0 || !b[r * cols + c]);
    });
    const evaluate = b => {
      const heights = new Array(cols).fill(0); let holes = 0;
      for (let c = 0; c < cols; c++) {
        let seen = false;
        for (let r = 0; r < rows; r++) {
          if (b[r * cols + c]) { if (!seen) { heights[c] = rows - r; seen = true; } } else if (seen) holes++;
        }
      }
      const agg = heights.reduce((a, h) => a + h, 0);
      let bump = 0; for (let c = 1; c < cols; c++) bump += Math.abs(heights[c] - heights[c - 1]);
      return { agg, holes, bump, max: Math.max(...heights) };
    };
    const clearRows = b => {
      const full = [];
      for (let r = 0; r < rows; r++) { let ok = true; for (let c = 0; c < cols; c++) if (!b[r * cols + c]) { ok = false; break; } if (ok) full.push(r); }
      if (!full.length) return { b, full };
      const out = new Int32Array(cols * rows); let w = rows - 1;
      for (let r = rows - 1; r >= 0; r--) { if (full.includes(r)) continue; for (let c = 0; c < cols; c++) out[w * cols + c] = b[r * cols + c]; w--; }
      return { b: out, full };
    };
    let lines = 0;
    for (let id = 0; id < length; id++) {
      const type = nextType();
      let best = null;
      for (let rot = 0; rot < (ROTS[type] || 4); rot++) {
        const cells = shapeCells(type, rot);
        const width = Math.max(...cells.map(c => c[0])) + 1;
        for (let col = 0; col <= cols - width; col++) {
          if (!fits(board, cells, col, -2)) continue;
          let row = -2; while (fits(board, cells, col, row + 1)) row++;
          if (cells.some(([, y]) => row + y < 0)) continue;
          const b2 = board.slice(); cells.forEach(([x, y]) => { b2[(row + y) * cols + col + x] = id + 1; });
          const { b: b3, full } = clearRows(b2);
          const e = evaluate(b3);
          // Loosely tuned so the stack breathes instead of staying flat.
          const score = -.34 * e.agg + .9 * full.length * full.length - .62 * e.holes - .2 * e.bump + rnd() * 1.6;
          if (!best || score > best.score) best = { score, rot, col, row, b2, b3, full };
        }
      }
      const spawnCol = Math.floor((cols - (type === 'I' ? 4 : type === 'O' ? 2 : 3)) / 2);
      if (!best || evaluate(best.b3).max > rows * ceiling) {
        // Stack too high: wipe the well with a pen pass and start clean.
        this.moves.push({ wipe: true, before: board, lines });
        board = new Int32Array(cols * rows);
        continue;
      }
      this.moves.push({ id, type, rot: best.rot, col: best.col, row: best.row, spawnCol, before: board, placed: best.b2, cleared: best.full, lines });
      lines += best.full.length;
      board = best.b3;
    }
    this.moves.push({ wipe: true, before: board, lines });
    this.types = new Map(this.moves.filter(m => !m.wipe).map(m => [m.id + 1, m.type]));
  }

  // Cells of the scene at time t: [{c, r, id, type, mode, reveal, alpha}]
  frame(t) {
    const N = this.moves.length;
    const tt = ((t % N) + N) % N;
    const k = Math.floor(tt), f = tt - k, m = this.moves[k], cols = this.cols;
    const out = [];
    const push = (b, skipRows = [], alphaRows = null, alpha = 1) => {
      for (let i = 0; i < b.length; i++) if (b[i]) {
        const r = Math.floor(i / cols);
        if (skipRows.includes(r)) continue;
        out.push({ c: i % cols, r, id: b[i], type: this.types.get(b[i]), mode: 'full', reveal: 1, alpha: alphaRows && alphaRows.has(r) ? alpha : 1 });
      }
    };
    const strikes = [];
    if (m.wipe) {
      // rows fade from the top down, as if erased
      const cut = f * (this.rows + 3);
      for (let i = 0; i < m.before.length; i++) if (m.before[i]) {
        const r = Math.floor(i / cols);
        const a = Math.max(0, Math.min(1, (r + 3 - cut) / 3));
        if (a > 0) out.push({ c: i % cols, r, id: m.before[i], type: this.types.get(m.before[i]), mode: 'full', reveal: 1, alpha: a });
      }
      return { cells: out, strikes, lines: m.lines, next: this.nextType(k) };
    }
    const cells = shapeCells(m.type, m.rot);
    const MOVE = .16, LAND = .78;
    if (f < LAND) {
      push(m.before);
      let col, rot, y;
      if (f < MOVE) {
        const p = f / MOVE;
        col = Math.round(m.spawnCol + (m.col - m.spawnCol) * p);
        rot = Math.round(m.rot * p);
        y = -2;
      } else {
        const p = (f - MOVE) / (LAND - MOVE);
        col = m.col; rot = m.rot;
        y = -2 + (m.row + 2) * p * p; // gravity
      }
      shapeCells(m.type, rot).forEach(([x, yy]) => out.push({ c: col + x, r: y + yy, id: m.id + 1, type: m.type, mode: 'ghost', reveal: 1, alpha: 1, active: true }));
    } else {
      const p = (f - LAND) / (1 - LAND);
      const fade = m.cleared.length ? Math.max(0, Math.min(1, (p - .55) / .45)) : 0;
      const set = new Set(m.cleared);
      for (let i = 0; i < m.placed.length; i++) if (m.placed[i]) {
        const r = Math.floor(i / cols);
        const mine = m.placed[i] === m.id + 1;
        out.push({ c: i % cols, r, id: m.placed[i], type: this.types.get(m.placed[i]), mode: 'full', reveal: mine ? Math.min(1, p * 1.8) : 1, alpha: set.has(r) ? 1 - fade : 1, outlineUnder: mine });
      }
      m.cleared.forEach(r => strikes.push({ r, p: Math.min(1, p * 2.2) }));
    }
    return { cells: out, strikes, lines: m.lines + (f >= LAND ? m.cleared.length : 0), next: this.nextType(k), active: cells };
  }
  nextType(k) {
    for (let i = 1; i < 4; i++) { const m = this.moves[(k + i) % this.moves.length]; if (!m.wipe) return m.type; }
    return 'T';
  }
}

// Pen-drawn well: two walls, a floor, a faint cell grid, a line counter and a next-piece preview.
export function drawWell(ctx, { x, y, S, cols, rows, alpha = 1, seed = 3, label = '', lines = 0, next = null, colors, font }) {
  const rnd = seeded(seed);
  const W = cols * S, H = rows * S;
  ctx.save();
  ctx.globalAlpha = alpha;
  // faint cell grid, uneven like hand ruling
  for (let c = 1; c < cols; c++) {
    ctx.fillStyle = `rgba(135,134,127,${.07 + rnd() * .09})`;
    fill(ctx, strokeOutline([[x + c * S, y + 2], [x + c * S, y + H - 2]], .8, rnd, { taper: .1, wobble: .3 }));
  }
  for (let r = 1; r < rows; r++) {
    ctx.fillStyle = `rgba(135,134,127,${.06 + rnd() * .08})`;
    fill(ctx, strokeOutline([[x + 2, y + r * S], [x + W - 2, y + r * S]], .8, rnd, { taper: .1, wobble: .3 }));
  }
  // walls and floor, heavier, overshooting the corners
  ctx.fillStyle = 'rgba(20,20,19,.62)';
  fill(ctx, strokeOutline([[x - 3, y - S * .6], [x - 2, y + H + 5]], 2.4, rnd, { taper: .25, wobble: .8 }));
  ctx.fillStyle = 'rgba(20,20,19,.58)';
  fill(ctx, strokeOutline([[x + W + 3, y - S * .4], [x + W + 2, y + H + 4]], 2.2, rnd, { taper: .25, wobble: .8 }));
  ctx.fillStyle = 'rgba(20,20,19,.66)';
  fill(ctx, strokeOutline([[x - 9, y + H + 3], [x + W + 10, y + H + 2]], 2.8, rnd, { taper: .2, wobble: .7 }));
  // header: label + counter + next piece
  if (font) {
    ctx.font = font;
    ctx.fillStyle = 'rgba(20,20,19,.62)';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x, y - S * .95);
    const txt = `${String(lines).padStart(3, '0')}`;
    ctx.fillStyle = 'rgba(125,111,224,.9)';
    ctx.fillText(txt, x + W - ctx.measureText(txt).width, y - S * .95);
  }
  if (next) {
    const s = S * .5, cells = shapeCells(next, 0);
    const w = (Math.max(...cells.map(c => c[0])) + 1) * s;
    const nx = x + W / 2 - w / 2, ny = y - S * 1.9;
    cells.forEach(([cx, cy]) => drawPen(ctx, colors[next], 5, 'ghost', nx + cx * s, ny + cy * s, s, alpha * .9));
  }
  ctx.restore();
}
function fill(ctx, pts) { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill(); }

// Draw one frame of a well's cells (and line-clear strike-throughs).
export function drawWellCells(ctx, frame, { x, y, S, cols, colors, alpha = 1 }) {
  frame.cells.forEach(cell => {
    if (cell.r < -1.2) return;
    const px = x + cell.c * S, py = y + cell.r * S;
    const color = colors[cell.type];
    const v = cell.id % 12;
    if (cell.outlineUnder) drawPen(ctx, color, v, 'ghost', px, py, S, alpha * cell.alpha);
    const top = cell.r < 0 ? Math.max(0, 1 + cell.r) : 1; // fade in above the rim
    drawPen(ctx, color, v, cell.mode, px, py, S, alpha * cell.alpha * top, cell.reveal);
  });
  const rnd = seeded(frame.lines * 17 + 3);
  frame.strikes.forEach(({ r, p }) => {
    const yy = y + r * S + S / 2;
    ctx.save();
    ctx.globalAlpha = alpha * .85;
    ctx.fillStyle = 'rgba(20,20,19,.7)';
    const x2 = x - 6 + (cols * S + 12) * p;
    fill(ctx, strokeOutline([[x - 6, yy + 1], [x2, yy - 1]], 2.6, rnd, { taper: .15, wobble: .9 }));
    ctx.restore();
  });
}

export { rgba, shade };
