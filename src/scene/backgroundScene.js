import { clamp, rand } from '../utils/math.js';

// Hard backing-store budget. Three fullscreen canvases (starfield,
// black-hole WebGL, event-layer) all share this dpr. The previous stepped
// cap (1.25/1.5/2 by area) still let each canvas grow without an absolute
// ceiling, so at fullscreen the three backing stores together blew past the
// GPU tile-memory budget and Chrome re-rastered the WHOLE document — text
// included — at reduced scale. Here we instead pin each canvas to <= a fixed
// pixel ceiling: dpr = sqrt(BUDGET / viewportArea), clamped. Soft glow can't
// tell 0.9x from 2x, but freeing that memory lets the root/text layer keep
// its native scale and stay sharp. Half-screen windows stay near 2x (crisp),
// which is why half-screen already looked fine.
const BUDGET_PX = 3_600_000; // ~ a 2560x1440 frame, per canvas
function computeDpr(w, h) {
  const area = Math.max(1, w * h);
  const budgetDpr = Math.sqrt(BUDGET_PX / area);
  return Math.min(devicePixelRatio || 1, Math.max(0.6, budgetDpr));
}

// Runs the star/warp draw loop in a Worker via OffscreenCanvas so the main
// thread only pays for tiny postMessage calls each frame (pointer x/y +
// warp intensity) instead of ~240 star draws + the warp-tunnel loop.
// 2026-07-03: added as the "highest ROI" perf step from ROADMAP §6. Falls
// back to the original main-thread canvas path (untouched below) on any
// browser/engine that lacks transferControlToOffscreen or module Workers —
// no feature gets worse, it just doesn't get the offload.
function tryCreateWorkerScene(canvas) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  if (typeof canvas.transferControlToOffscreen !== 'function') return null;
  if (typeof Worker === 'undefined') return null;
  try {
    const offscreen = canvas.transferControlToOffscreen();
    const worker = new Worker(new URL('./backgroundScene.worker.js', import.meta.url), { type: 'module' });
    let width = 1, height = 1, dpr = 1;
    let inited = false;

    function resize() {
      dpr = computeDpr(innerWidth, innerHeight);
      width = Math.round(innerWidth * dpr);
      height = Math.round(innerHeight * dpr);
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      const payload = { innerWidth, innerHeight, dpr };
      if (!inited) {
        inited = true;
        worker.postMessage({ type: 'init', canvas: offscreen, ...payload }, [offscreen]);
      } else {
        worker.postMessage({ type: 'resize', ...payload });
      }
      return { width, height, dpr };
    }

    // Actual drawing happens inside the worker on its own timer; the real
    // `draw` hook (assigned by createBackgroundScene below, since it needs
    // getPointer/getWarpIntensity) just forwards the two live inputs the
    // worker needs each time main.js's render loop calls it.
    return {
      resize,
      draw: null, // replaced below once we know getPointer/getWarpIntensity
      get width() { return width; },
      get height() { return height; },
      get dpr() { return dpr; },
      _worker: worker,
    };
  } catch (err) {
    console.warn('[backgroundScene] worker offload failed, falling back to main thread', err);
    return null;
  }
}

export function createBackgroundScene({ canvas, getPointer, getWarpIntensity }) {
  const workerScene = tryCreateWorkerScene(canvas);
  if (workerScene) {
    const worker = workerScene._worker;
    let lastIntensity = null;
    workerScene.draw = () => {
      const pointer = getPointer();
      worker.postMessage({ type: 'pointer', x: pointer.x, y: pointer.y });
      const intensity = getWarpIntensity();
      if (intensity !== lastIntensity) {
        lastIntensity = intensity;
        worker.postMessage({ type: 'intensity', value: intensity });
      }
    };
    return {
      draw: workerScene.draw,
      resize: workerScene.resize,
      get width() { return workerScene.width; },
      get height() { return workerScene.height; },
      get dpr() { return workerScene.dpr; },
    };
  }

  // ---- Fallback: original main-thread Canvas2D implementation ----
  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 1;
  let height = 1;
  let dpr = 1;
  let stars = [];
  let warpStars = [];

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

  function resize() {
    dpr = computeDpr(innerWidth, innerHeight);
    width = canvas.width = innerWidth * dpr;
    height = canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    buildStars();
    buildWarp();
    return { width, height, dpr };
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
    // U28 28g: stretch factors roughly doubled (6.5→13 speed, 18→34 tail
    // length) so warp-hover reads as a genuine high-speed stargate jump
    // instead of a mild drift. Keep this in sync with backgroundScene.worker.js.
    for (const s of warpStars) {
      s.r += s.speed * (0.6 + 13 * intensity);
      if (s.r > maxR) {
        s.r = eventR + rand(2, 25);
        s.ang = Math.random() * Math.PI * 2;
      }
      if (s.r < eventR * 1.35) continue;
      const x = cxw + Math.cos(s.ang) * s.r;
      const y = cyw + Math.sin(s.ang) * s.r;
      const closeness = clamp(s.r / maxR, 0, 1);
      const tail = (0.5 + 34 * intensity) * s.z * closeness;
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
    const pointer = getPointer();
    const intensity = getWarpIntensity();
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

  return {
    draw,
    resize,
    get width() { return width; },
    get height() { return height; },
    get dpr() { return dpr; },
  };
}
