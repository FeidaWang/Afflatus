import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import { clamp, rand } from '../utils/math.js';

const FULLSCREEN_CANVAS_DPR_LIMITS = Object.freeze({
  high: Object.freeze({ minDpr: 0.6, maxDpr: 1.4 }),
  balanced: Object.freeze({ minDpr: 0.6, maxDpr: 1.2 }),
  low: Object.freeze({ minDpr: 0.6, maxDpr: 1 }),
});

// Full-viewport 2D surfaces trade backing-store area for very little visible
// detail above these ceilings. Keep this exported so the shared event layer can
// use the exact same limits without duplicating the quality policy.
export function getFullscreenCanvasDprLimits(qualityTier = 'balanced') {
  return FULLSCREEN_CANVAS_DPR_LIMITS[qualityTier]
    || FULLSCREEN_CANVAS_DPR_LIMITS.balanced;
}

// Runs the star/warp draw loop in a Worker via OffscreenCanvas so the main
// thread only pays for tiny postMessage calls each frame (pointer x/y +
// warp intensity) instead of ~240 star draws + the warp-tunnel loop.
// 2026-07-03: added as the "highest ROI" perf step from ROADMAP §6. Falls
// back to the original main-thread canvas path (untouched below) on any
// browser/engine that lacks transferControlToOffscreen or module Workers —
// no feature gets worse, it just doesn't get the offload.
function tryCreateWorkerScene(canvas, computeDpr) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  if (typeof canvas.transferControlToOffscreen !== 'function') return null;
  if (typeof Worker === 'undefined') return null;
  let worker = null;
  try {
    // Construct the module worker before irreversibly transferring the DOM
    // canvas. A synchronous Worker/CSP failure can then still use the real
    // main-thread Canvas2D fallback below.
    worker = new Worker(new URL('./backgroundScene.worker.js', import.meta.url), { type: 'module' });
    const offscreen = canvas.transferControlToOffscreen();
    let width = 1, height = 1, dpr = 1;
    let inited = false;
    let destroyed = false;
    let frameReporter = null;

    function handleWorkerMessage(event) {
      if (event.data?.type !== 'draw-duration') return;
      const durationMs = Number(event.data.durationMs);
      if (!Number.isFinite(durationMs) || durationMs <= 0) return;
      frameReporter?.(durationMs);
    }
    worker.addEventListener('message', handleWorkerMessage);

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
      pause() { worker.postMessage({ type: 'stop' }); },
      resume() { worker.postMessage({ type: 'start' }); },
      setFrameReporter(reporter) {
        frameReporter = typeof reporter === 'function' ? reporter : null;
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        frameReporter = null;
        worker.removeEventListener('message', handleWorkerMessage);
        worker.terminate();
      },
      get width() { return width; },
      get height() { return height; },
      get dpr() { return dpr; },
      _worker: worker,
    };
  } catch (err) {
    worker?.terminate();
    console.warn('[backgroundScene] worker offload failed, falling back to main thread', err);
    return null;
  }
}

export function createBackgroundScene({ canvas, getPointer, getWarpIntensity }) {
  const coordinator = getRenderBudgetCoordinator();
  let renderPolicy = coordinator.getPolicy({ cost: 'medium', targetFps: 60 });
  const computeDpr = (width, height) => renderPolicy.computeDpr(
    width,
    height,
    getFullscreenCanvasDprLimits(renderPolicy.qualityTier),
  );
  const workerScene = tryCreateWorkerScene(canvas, computeDpr);
  if (workerScene) {
    const worker = workerScene._worker;
    let lastIntensity = null;
    let sized = false;
    workerScene.draw = () => {
      const pointer = getPointer();
      worker.postMessage({ type: 'pointer', x: pointer.x, y: pointer.y });
      const intensity = getWarpIntensity();
      if (intensity !== lastIntensity) {
        lastIntensity = intensity;
        worker.postMessage({ type: 'intensity', value: intensity });
      }
    };
    const resize = () => {
      sized = true;
      return workerScene.resize();
    };
    const surface = coordinator.register({
      id: 'home:background-worker',
      element: canvas,
      observe: false,
      cost: 'medium',
      targetFps: 60,
      onPause: workerScene.pause,
      onResume: workerScene.resume,
      onQualityChange(nextPolicy) {
        renderPolicy = nextPolicy;
        if (sized) resize();
      },
    });
    workerScene.setFrameReporter((durationMs) => surface.reportFrame(durationMs));
    return {
      draw: workerScene.draw,
      resize,
      pause: workerScene.pause,
      resume: workerScene.resume,
      destroy() {
        surface.unregister();
        workerScene.destroy();
      },
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
  let lastFrameAt = 0;
  let sized = false;

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

  function resize() {
    sized = true;
    dpr = computeDpr(innerWidth, innerHeight);
    width = canvas.width = Math.round(innerWidth * dpr);
    height = canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    buildStars();
    lastFrameAt = 0;
    return { width, height, dpr };
  }

  function drawApproach(now, intensity, pointer) {
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
    const pointer = getPointer();
    const intensity = getWarpIntensity();
    // Opaque clearing prevents the old trail accumulation that produced
    // parallel star bands. Every point now belongs to one perspective field.
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, width, height);
    drawApproach(now, intensity, pointer);
  }

  const surface = coordinator.register({
    id: 'home:background-canvas',
    element: canvas,
    observe: false,
    cost: 'medium',
    targetFps: 60,
    onQualityChange(nextPolicy) {
      renderPolicy = nextPolicy;
      if (sized) resize();
    },
  });

  return {
    draw,
    resize,
    pause() {},
    resume() {},
    destroy() { surface.unregister(); },
    get width() { return width; },
    get height() { return height; },
    get dpr() { return dpr; },
  };
}
