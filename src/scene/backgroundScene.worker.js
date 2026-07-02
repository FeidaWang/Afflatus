/* Background starfield renderer — runs OFF the main thread.
   Mirrors the draw logic in backgroundScene.js 1:1 (kept duplicated rather
   than shared via import because a couple of the shared helpers are trivial
   and duplicating avoids fighting Vite's worker-bundling edge cases for a
   two-function utility). If this file and backgroundScene.js's fallback
   path drift apart, keep drawWarp/draw/buildStars/buildWarp in sync. */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(min, max) { return min + Math.random() * (max - min); }

let canvas = null;
let ctx = null;
let width = 1, height = 1, dpr = 1;
let innerWidth = 1, innerHeight = 1;
let stars = [];
let warpStars = [];
let pointer = { x: -9999, y: -9999 };
let warpIntensity = 0.18;
let running = false;

function buildStars() {
  stars = [];
  const count = Math.min(240, Math.floor(innerWidth * innerHeight / 5200));
  const cols = ['#e4eaf6', '#c4d0ea', '#7a89af'];
  for (let i = 0; i < count; i += 1) {
    const l = Math.random();
    stars.push({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: l < 0.7 ? rand(0.32, 0.7) : rand(0.7, 1.5),
      a: rand(0.28, 0.85),
      l,
      tw: Math.random() < 0.15 ? rand(2.8, 5.6) : 0,
      ph: rand(0, Math.PI * 2),
      col: cols[Math.floor(l * 3)],
    });
  }
}

function buildWarp() {
  warpStars = [];
  const maxR = Math.max(innerWidth, innerHeight) * 0.65;
  for (let i = 0; i < 160; i += 1) {
    warpStars.push({
      ang: Math.random() * Math.PI * 2,
      r: rand(20, maxR),
      speed: rand(0.25, 1.1),
      z: rand(0.3, 1),
    });
  }
}

function drawWarp(intensity) {
  const compact = innerWidth < 880;
  const cxw = innerWidth * (compact ? 0.82 : 0.84);
  const cyw = innerHeight * (compact ? 0.28 : 0.33);
  const maxR = Math.max(innerWidth, innerHeight) * 0.65;
  const eventR = Math.min(
    compact ? 330 : 540,
    Math.max(compact ? 215 : 370, Math.min(innerWidth, innerHeight) * 0.46),
  ) * (compact ? 0.98 + intensity * 0.02 : 1.0 + intensity * 0.035);

  ctx.save();
  ctx.scale(dpr, dpr);
  for (const s of warpStars) {
    s.r += s.speed * (0.6 + 6.5 * intensity);
    if (s.r > maxR) {
      s.r = eventR + rand(2, 25);
      s.ang = Math.random() * Math.PI * 2;
    }
    if (s.r < eventR * 1.35) continue;
    const x = cxw + Math.cos(s.ang) * s.r;
    const y = cyw + Math.sin(s.ang) * s.r;
    const closeness = clamp(s.r / maxR, 0, 1);
    const tail = (0.5 + 18 * intensity) * s.z * closeness;
    const alpha = (0.12 + 0.55 * closeness * s.z) * (0.6 + 0.4 * intensity);
    const tx = cxw + Math.cos(s.ang) * (s.r + tail);
    const ty = cyw + Math.sin(s.ang) * (s.r + tail);
    if (tail > 1.5) {
      const g = ctx.createLinearGradient(x, y, tx, ty);
      g.addColorStop(0, `rgba(220,230,250,${alpha})`);
      g.addColorStop(1, 'rgba(220,230,250,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.4 + s.z * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(220,230,250,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.5 + s.z * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function draw(now) {
  if (!ctx) return;
  const intensity = warpIntensity;
  ctx.fillStyle = 'rgba(4,6,10,0.22)';
  ctx.fillRect(0, 0, width, height);

  for (const s of stars) {
    let sx = s.x;
    let sy = s.y;
    const dxp = sx - pointer.x;
    const dyp = sy - pointer.y;
    const d2 = dxp * dxp + dyp * dyp;
    if (d2 < 12100) {
      const d = Math.sqrt(d2);
      const f = (1 - d / 110) * 22 * (0.4 + s.l * 0.6);
      sx += (dxp / d) * f;
      sy += (dyp / d) * f;
    }
    let alpha = s.a;
    if (s.tw > 0) alpha *= 0.55 + 0.45 * Math.sin(now / s.tw + s.ph);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.col;
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, s.r * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawWarp(intensity);
}

// Dedicated-worker rAF support is inconsistent across engines; a fixed
// ~60fps setTimeout driver is universally available via `self` and keeps
// this independent of that API's availability.
function loop() {
  if (!running) return;
  draw(performance.now());
  setTimeout(loop, 16);
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'init') {
    canvas = msg.canvas;
    ctx = canvas.getContext('2d', { alpha: false });
    innerWidth = msg.innerWidth; innerHeight = msg.innerHeight; dpr = msg.dpr;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    width = canvas.width; height = canvas.height;
    buildStars(); buildWarp();
    running = true;
    loop();
  } else if (msg.type === 'resize') {
    innerWidth = msg.innerWidth; innerHeight = msg.innerHeight; dpr = msg.dpr;
    if (canvas) {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      width = canvas.width; height = canvas.height;
    }
    buildStars(); buildWarp();
  } else if (msg.type === 'pointer') {
    pointer.x = msg.x; pointer.y = msg.y;
  } else if (msg.type === 'intensity') {
    warpIntensity = msg.value;
  } else if (msg.type === 'stop') {
    running = false;
  }
};
