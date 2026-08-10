/* Background starfield renderer — runs OFF the main thread.
   Mirrors the draw logic in backgroundScene.js 1:1 (kept duplicated rather
   than shared via import because a couple of the shared helpers are trivial
   and duplicating avoids fighting Vite's worker-bundling edge cases for a
   two-function utility). If this file and backgroundScene.js's fallback
   path drift apart, keep drawApproach/draw/buildStars in sync. */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(min, max) { return min + Math.random() * (max - min); }

let canvas = null;
let ctx = null;
let width = 1, height = 1, dpr = 1;
let innerWidth = 1, innerHeight = 1;
let stars = [];
let pointer = { x: -9999, y: -9999 };
let warpIntensity = 0.18;
let running = false;
let shouldRun = false;
let loopGeneration = 0;
let lastFrameAt = 0;
const TELEMETRY_INTERVAL_FRAMES = 2;
let telemetryFrameCount = 0;
let telemetryPeakDurationMs = 0;

function resetTelemetryWindow() {
  telemetryFrameCount = 0;
  telemetryPeakDurationMs = 0;
}

function recordDrawDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  telemetryFrameCount += 1;
  telemetryPeakDurationMs = Math.max(telemetryPeakDurationMs, durationMs);
  if (telemetryFrameCount < TELEMETRY_INTERVAL_FRAMES) return;
  self.postMessage({ type: 'draw-duration', durationMs: telemetryPeakDurationMs });
  resetTelemetryWindow();
}

function buildStars() {
  stars = [];
  const count = Math.min(280, Math.max(150, Math.floor(innerWidth * innerHeight / 4300)));
  const cols = ['#e4eaf6', '#c4d0ea', '#7a89af'];
  for (let i = 0; i < count; i += 1) {
    const l = Math.random();
    stars.push({
      x: rand(-1.18, 1.18),
      y: rand(-1.08, 1.08),
      z: rand(0.18, 1.9),
      speed: rand(0.72, 1.28),
      r: l < 0.7 ? rand(0.32, 0.7) : rand(0.7, 1.5),
      a: rand(0.28, 0.85),
      l,
      tw: Math.random() < 0.15 ? rand(2.8, 5.6) : 0,
      ph: rand(0, Math.PI * 2),
      col: cols[Math.floor(l * 3)],
    });
  }
}

function resetStar(star) {
  star.x = rand(-1.18, 1.18);
  star.y = rand(-1.08, 1.08);
  star.z = rand(1.35, 1.95);
}

function drawApproach(now, intensity) {
  const compact = innerWidth < 880;
  const cx = innerWidth * (compact ? 0.69 : 0.72);
  const cy = innerHeight * (compact ? 0.35 : 0.38);
  const dt = lastFrameAt ? clamp((now - lastFrameAt) / 1000, 0, 0.05) : 1 / 60;
  lastFrameAt = now;
  const travel = dt * (0.08 + intensity * 0.34);
  const focal = compact ? 0.34 : 0.38;

  ctx.save();
  ctx.scale(dpr, dpr);
  for (const s of stars) {
    s.z -= travel * s.speed;
    if (s.z < 0.14) resetStar(s);

    const currentScale = focal / s.z;
    const previousScale = focal / Math.max(s.z + travel * s.speed * (1.8 + intensity * 4.5), 0.15);
    let x = cx + s.x * innerWidth * currentScale;
    let y = cy + s.y * innerHeight * currentScale;
    const px = cx + s.x * innerWidth * previousScale;
    const py = cy + s.y * innerHeight * previousScale;

    if (x < -80 || x > innerWidth + 80 || y < -80 || y > innerHeight + 80) {
      resetStar(s);
      continue;
    }

    const dxp = x - pointer.x;
    const dyp = y - pointer.y;
    const d2 = dxp * dxp + dyp * dyp;
    if (d2 > 0 && d2 < 8100) {
      const d = Math.sqrt(d2);
      const nudge = (1 - d / 90) * 7;
      x += (dxp / d) * nudge;
      y += (dyp / d) * nudge;
    }

    const proximity = clamp(1 - s.z / 1.95, 0, 1);
    const alpha = s.a * (0.24 + proximity * 0.76);
    let twinkle = 1;
    if (s.tw > 0) twinkle = 0.72 + 0.28 * Math.sin(now / s.tw + s.ph);
    const lineLength = Math.hypot(x - px, y - py);
    ctx.globalAlpha = alpha * twinkle;

    if (lineLength > 0.7) {
      const g = ctx.createLinearGradient(px, py, x, y);
      g.addColorStop(0, 'rgba(220,230,250,0)');
      g.addColorStop(1, s.col);
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.min(1.75, s.r * (0.7 + proximity));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.fillStyle = s.col;
      ctx.beginPath();
      ctx.arc(x, y, Math.min(1.8, s.r * (0.55 + proximity)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function draw(now) {
  if (!ctx) return;
  const intensity = warpIntensity;
  ctx.fillStyle = '#04060a';
  ctx.fillRect(0, 0, width, height);
  drawApproach(now, intensity);
}

// Dedicated-worker rAF support is inconsistent across engines. Cruise needs
// only 30fps; reserve 60fps for the short warp ramp where streak continuity is
// visually important.
function loop(generation) {
  if (!running || generation !== loopGeneration) return;
  const drawStartedAt = performance.now();
  draw(drawStartedAt);
  const drawDurationMs = performance.now() - drawStartedAt;
  recordDrawDuration(drawDurationMs);
  const targetFps = warpIntensity > 0.45 ? 60 : 30;
  // Compensate for the work just submitted; otherwise an 8ms draw plus a
  // 16.7ms timer silently turns the nominal 60fps warp pass into ~40fps.
  setTimeout(() => loop(generation), Math.max(0, 1000 / targetFps - drawDurationMs));
}

function startLoop() {
  if (running || !canvas) return;
  running = true;
  loopGeneration += 1;
  resetTelemetryWindow();
  loop(loopGeneration);
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
    buildStars();
    lastFrameAt = 0;
    resetTelemetryWindow();
    if (shouldRun) startLoop();
  } else if (msg.type === 'resize') {
    innerWidth = msg.innerWidth; innerHeight = msg.innerHeight; dpr = msg.dpr;
    if (canvas) {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      width = canvas.width; height = canvas.height;
    }
    buildStars();
    lastFrameAt = 0;
    resetTelemetryWindow();
  } else if (msg.type === 'pointer') {
    pointer.x = msg.x; pointer.y = msg.y;
  } else if (msg.type === 'intensity') {
    warpIntensity = msg.value;
  } else if (msg.type === 'stop') {
    shouldRun = false;
    running = false;
    loopGeneration += 1;
    resetTelemetryWindow();
  } else if (msg.type === 'start') {
    shouldRun = true;
    startLoop();
  }
};
