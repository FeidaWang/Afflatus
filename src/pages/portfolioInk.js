// Hand-drawn marker primitives for the portfolio page.
// Every mark is a filled, variable-width polygon rather than a uniform stroke, so
// widths, edges and opacity drift the way a felt pen does on paper.

export function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
export function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
export const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
export const shade = (hex, k, a = 1) => { const [r, g, b] = hexRgb(hex); return `rgba(${r * k | 0},${g * k | 0},${b * k | 0},${a})`; };

// Outline of a pen stroke along a polyline: width breathes, the centre line wanders.
export function strokeOutline(points, width, rnd, { taper = .35, wobble = .5 } = {}) {
  const dense = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 5));
    for (let k = 0; k < n; k++) dense.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
  }
  dense.push(points[points.length - 1]);
  const phase = rnd() * 6.28, phase2 = rnd() * 6.28, freq = .04 + rnd() * .05;
  const left = [], right = [];
  let dist = 0;
  const total = dense.reduce((acc, p, i) => acc + (i ? Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1]) : 0), 0) || 1;
  dense.forEach((p, i) => {
    const q = dense[Math.min(i + 1, dense.length - 1)], o = dense[Math.max(i - 1, 0)];
    let dx = q[0] - o[0], dy = q[1] - o[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    if (i) dist += Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1]);
    const t = dist / total;
    const ends = taper ? Math.min(1, Math.min(t, 1 - t) / taper * 2.4 + .35) : 1;
    const w = width / 2 * ends * (.78 + .22 * Math.sin(dist * freq + phase) + (rnd() - .5) * .12);
    const drift = Math.sin(dist * freq * .6 + phase2) * wobble;
    const cx = p[0] - dy * drift, cy = p[1] + dx * drift;
    left.push([cx - dy * w, cy + dx * w]);
    right.push([cx + dy * w, cy - dx * w]);
  });
  return left.concat(right.reverse());
}
export const polyD = pts => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`;
export function inkLineD(x1, y1, x2, y2, width, rnd, opts) { return polyD(strokeOutline([[x1, y1], [x2, y2]], width, rnd, opts)); }
export function inkPathD(points, width, rnd, opts) { return polyD(strokeOutline(points, width, rnd, opts)); }

// A slightly crooked quadrilateral: corners jitter, edges bow a little.
export function wobblyQuad(x, y, w, h, rnd, j = 1.4) {
  const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => [a + (rnd() - .5) * j * 2, b + (rnd() - .5) * j * 2]);
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const [a, b] = c[i], [d, e] = c[(i + 1) % 4];
    for (let k = 0; k < 4; k++) pts.push([a + (d - a) * k / 4 + (rnd() - .5) * j * .6, b + (e - b) * k / 4 + (rnd() - .5) * j * .6]);
  }
  return pts;
}

// Edges of a hand-ruled square: each side overshoots its corner by a few pixels.
export function penSquareEdges(x, y, w, h, rnd, over = 3) {
  const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => [a + (rnd() - .5) * 1.6, b + (rnd() - .5) * 1.6]);
  return c.map((p, i) => {
    const q = c[(i + 1) % 4];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    const o1 = (rnd() * over) - .5, o2 = (rnd() * over) - .5;
    return [[p[0] - dx / len * o1, p[1] - dy / len * o1], [q[0] + dx / len * o2, q[1] + dy / len * o2]];
  });
}

/* ------------------------------------------------------------ canvas sprites */
export const SPRITE = 64;
export const SPRITE_PAD = 8;
const cache = new Map();
function fillPoly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }

// mode: 'full' (inked square), 'ghost' (falling piece: wash + contour), 'outline' (contour only)
export function penSprite(color, variant = 0, mode = 'full') {
  const key = `${color}|${variant}|${mode}`;
  if (cache.has(key)) return cache.get(key);
  const s = SPRITE, p = SPRITE_PAD, c = document.createElement('canvas');
  c.width = c.height = s + p * 2;
  const g = c.getContext('2d');
  const rnd = seeded(variant * 7919 + parseInt(color.slice(1), 16) + mode.length * 131);
  const quad = wobblyQuad(p, p, s, s, rnd, 1.6);
  if (mode !== 'outline') {
    g.fillStyle = rgba(color, mode === 'ghost' ? .16 : .26 + rnd() * .12);
    fillPoly(g, quad);
  }
  if (mode === 'full') {
    // Overlapping marker passes: where two passes cross the pigment doubles up.
    g.save();
    g.beginPath(); quad.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.lineWidth = 5; g.lineJoin = 'round'; g.strokeStyle = '#000';
    g.clip();
    g.globalCompositeOperation = 'multiply';
    const diagonal = variant % 3 === 2;
    const angle = diagonal ? -.62 + rnd() * .2 : (rnd() - .5) * .16;
    const band = s * (.26 + rnd() * .06);
    const n = Math.ceil((s * (diagonal ? 1.5 : 1.1)) / band) + 1;
    const cx = p + s / 2, cy = p + s / 2, cos = Math.cos(angle), sin = Math.sin(angle);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * band + (rnd() - .5) * band * .35;
      const L = s * .95;
      const ax = cx - cos * L - sin * off, ay = cy - sin * L + cos * off;
      const bx = cx + cos * L - sin * off, by = cy + sin * L + cos * off;
      g.fillStyle = rgba(color, .42 + rnd() * .42);
      fillPoly(g, strokeOutline([[ax, ay], [bx, by]], band * (1.18 + rnd() * .3), rnd, { taper: .12, wobble: 1.2 }));
    }
    g.restore();
    // paper tooth showing through
    g.save();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 150; i++) {
      g.fillStyle = `rgba(0,0,0,${.12 + rnd() * .3})`;
      const r = .5 + rnd() * 1.1;
      g.fillRect(p + rnd() * s, p + rnd() * s, r, r);
    }
    g.restore();
  }
  const edgeAlpha = mode === 'outline' ? .55 : mode === 'ghost' ? .7 : .78;
  penSquareEdges(p, p, s, s, rnd, 5).forEach(([a, b]) => {
    g.fillStyle = shade(color, .58, edgeAlpha * (.8 + rnd() * .2));
    fillPoly(g, strokeOutline([a, b], 2.4 + rnd() * 1.2, rnd, { taper: .3, wobble: .6 }));
  });
  cache.set(key, c);
  return c;
}

// Draw a sprite into a cell of size `size` whose top-left is (x, y).
export function drawPen(ctx, color, variant, mode, x, y, size, alpha = 1, reveal = 1) {
  if (alpha < .01 || size < .5) return;
  const sp = penSprite(color, variant, mode);
  const k = size / SPRITE, pad = SPRITE_PAD * k;
  ctx.globalAlpha = alpha;
  if (reveal >= 1) ctx.drawImage(sp, x - pad, y - pad, size + pad * 2, size + pad * 2);
  else if (reveal > 0) {
    // ink laid down left to right, like a marker pass
    const src = (SPRITE + SPRITE_PAD * 2) * reveal;
    ctx.drawImage(sp, 0, 0, src, sp.height, x - pad, y - pad, (size + pad * 2) * reveal, size + pad * 2);
  }
  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------------- ruled grid */
// A hand-ruled graph paper: lines are drawn in short pen passes whose weight,
// opacity and tint drift, and every fourth line is a heavier major rule.
export function drawInkGrid(ctx, W, H, { step = 18, major = 4, seed = 11, ink = '#87867F', tints = ['#6A9BCC', '#9d90ec', '#d98aa0'], strength = 1, x0 = 0, y0 = 0 } = {}) {
  const rnd = seeded(seed);
  const pass = (x1, y1, x2, y2, isMajor) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    let t = 0;
    while (t < len) {
      const seg = 60 + rnd() * 180;
      const t2 = Math.min(len, t + seg);
      if (rnd() > .035) {
        const f1 = t / len, f2 = t2 / len;
        const tint = rnd() < .07 ? tints[Math.floor(rnd() * tints.length)] : ink;
        const a = (isMajor ? .2 + rnd() * .22 : .08 + rnd() * .14) * strength * (tint === ink ? 1 : 1.25);
        ctx.fillStyle = rgba(tint, a);
        fillPoly(ctx, strokeOutline([[x1 + (x2 - x1) * f1, y1 + (y2 - y1) * f1], [x1 + (x2 - x1) * f2, y1 + (y2 - y1) * f2]], isMajor ? 1.1 + rnd() * .5 : .7 + rnd() * .4, rnd, { taper: .08, wobble: .35 }));
      }
      t = t2 + (rnd() < .1 ? rnd() * 6 : 0);
    }
  };
  for (let i = 0, x = x0; x <= W; i++, x += step) pass(x + (rnd() - .5) * .8, -4, x + (rnd() - .5) * 1.4, H + 4, i % major === 0);
  for (let i = 0, y = y0; y <= H; i++, y += step) pass(-4, y + (rnd() - .5) * .8, W + 4, y + (rnd() - .5) * 1.4, i % major === 0);
}

/* ------------------------------------------------------------- SVG filters */
const NS = 'http://www.w3.org/2000/svg';
export function installInkFilters() {
  if (document.getElementById('pf-ink-defs')) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'pf-ink-defs';
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const f = (id, fq, k3, wq, sc, seed) => `<filter id="${id}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${fq}" numOctaves="2" seed="${seed}" result="grain"/><feColorMatrix in="grain" type="luminanceToAlpha" result="ga"/><feComposite in="SourceGraphic" in2="ga" operator="arithmetic" k1="0" k2="1" k3="${k3}" k4="0" result="inked"/><feTurbulence type="fractalNoise" baseFrequency="${wq}" numOctaves="2" seed="${seed + 6}" result="warp"/><feDisplacementMap in="inked" in2="warp" scale="${sc}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  svg.innerHTML = `<defs>${f('pf-mk-marker', .55, -.3, .11, 2.6, 7)}${f('pf-mk-dry', .9, -.55, .18, 1.8, 4)}${f('pf-mk-rule', .72, -.12, .07, .6, 5)}</defs>`;
  document.body.prepend(svg);
}
