import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';

function prefersReducedMotion() {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function mountAmbientCanvas({
  id,
  canvas,
  cost = 'low',
  build = () => {},
  draw,
}) {
  if (!canvas?.getContext || typeof draw !== 'function') return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const coordinator = getRenderBudgetCoordinator();
  const reduced = prefersReducedMotion();
  let policy = coordinator.getPolicy({ cost, targetFps: 60 });
  let width = 1;
  let height = 1;
  let dpr = 1;
  let running = false;
  let raf = 0;
  let lastFrameT = 0;
  let surface = null;

  function resize() {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    dpr = policy.computeDpr(width, height, { minDpr: 0.75, maxDpr: 2 });
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build({ width, height, dpr });
    draw(ctx, { width, height, dpr, now: 0 });
  }

  function loop(now) {
    if (!running) return;
    const frameMs = lastFrameT ? now - lastFrameT : 0;
    lastFrameT = now;
    draw(ctx, { width, height, dpr, now });
    surface?.reportFrame(frameMs);
    if (running) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    lastFrameT = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  surface = coordinator.register({
    id,
    element: canvas,
    observe: false,
    cost,
    targetFps: 60,
    onResume: start,
    onPause: stop,
    onResize: resize,
    onQualityChange(nextPolicy) { policy = nextPolicy; },
  });

  return {
    destroy() {
      surface.unregister();
      stop();
    },
  };
}

export function mountSignalBackdrop() {
  const canvas = document.getElementById('scpCanvas');
  let nodes = [];

  return mountAmbientCanvas({
    id: 'signal:ambient-grid',
    canvas,
    build({ width, height }) {
      const count = Math.min(26, Math.round(width / 60));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        phase: Math.random() * Math.PI * 2,
      }));
    },
    draw(ctx, { width, height, now }) {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(245,196,0,0.08)';
      ctx.lineWidth = 1;
      for (let x = (now * 0.006) % 90; x < width; x += 90) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 90) {
        const cy = y + Math.sin((y + now * 0.02) * 0.01) * 6;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(width * 0.33, cy + 10, width * 0.66, cy - 10, width, y);
        ctx.stroke();
      }
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance >= 190) continue;
          ctx.strokeStyle = `rgba(240,180,41,${0.05 * (1 - distance / 190)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      for (const node of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.001 + node.phase);
        ctx.fillStyle = `rgba(245,196,0,${0.25 + pulse * 0.4})`;
        ctx.fillRect(node.x - 1.5, node.y - 1.5, 3, 3);
        ctx.strokeStyle = `rgba(245,196,0,${0.15 * pulse})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (Math.random() > 0.985) {
        ctx.fillStyle = 'rgba(214,69,61,0.05)';
        ctx.fillRect(0, Math.random() * height, width, 2 + Math.random() * 30);
      }
    },
  });
}

export function mountSerialBackdrop() {
  const canvas = document.getElementById('retroCanvas');
  return mountAmbientCanvas({
    id: 'serial:ambient-grid',
    canvas,
    draw(ctx, { width, height, now }) {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(201,131,74,0.06)';
      ctx.lineWidth = 1;
      const step = 64;
      for (let x = (now * 0.004) % step; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = (now * 0.002) % step; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(79,214,196,0.05)';
      const radius = 90 + 60 * Math.sin(now * 0.0003);
      ctx.beginPath();
      ctx.arc(width * 0.85, height * 0.15, radius, 0, Math.PI * 2);
      ctx.stroke();
    },
  });
}
