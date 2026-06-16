/* ============================================================
   Arena background — mechanical caterpillars weaving cyber-prosthetic
   threads across a faint PCB / chip substrate (Marathon-inspired).
   Canvas, low opacity, behind all content. Reduced-motion → static.
   ============================================================ */
(() => {
  'use strict';
  const cv = document.getElementById('bgCanvas'); if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0, board = null, cats = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // static PCB substrate: traces, vias, chips — drawn once to an offscreen canvas
  function buildBoard() {
    board = document.createElement('canvas'); board.width = W; board.height = H;
    const b = board.getContext('2d');
    b.clearRect(0, 0, W, H);
    const grid = 52 * dpr;
    b.lineWidth = 1 * dpr; b.strokeStyle = 'rgba(90,120,180,0.10)';
    // right-angle traces
    for (let i = 0; i < Math.ceil(W / grid) + 2; i++) {
      const x = i * grid + rnd(-10, 10) * dpr; b.beginPath(); b.moveTo(x, 0);
      let y = 0; while (y < H) { const seg = rnd(40, 120) * dpr; b.lineTo(x, y + seg); if (Math.random() < 0.4) { const dx = (Math.random() < 0.5 ? 1 : -1) * grid; b.lineTo(x + dx, y + seg); } y += seg; } b.stroke();
    }
    for (let j = 0; j < Math.ceil(H / grid) + 2; j++) { const y = j * grid + rnd(-10, 10) * dpr; b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.globalAlpha = 0.5; b.stroke(); b.globalAlpha = 1; }
    // vias (nodes)
    b.fillStyle = 'rgba(39,231,255,0.16)';
    for (let i = 0; i < (W * H) / (90 * 90 * dpr * dpr); i++) { b.fillRect(rnd(0, W), rnd(0, H), 2 * dpr, 2 * dpr); }
    // chips
    for (let i = 0; i < 7; i++) { const cw = rnd(40, 90) * dpr, ch = rnd(30, 60) * dpr, x = rnd(0, W - cw), y = rnd(0, H - ch); b.strokeStyle = 'rgba(58,91,255,0.16)'; b.strokeRect(x, y, cw, ch); b.fillStyle = 'rgba(58,91,255,0.05)'; b.fillRect(x, y, cw, ch); b.fillStyle = 'rgba(120,150,210,0.12)'; for (let p = 0; p < cw; p += 7 * dpr) { b.fillRect(x + p, y - 3 * dpr, 2 * dpr, 3 * dpr); b.fillRect(x + p, y + ch, 2 * dpr, 3 * dpr); } }
  }

  function spawnCat(seedLeft) {
    const baseY = rnd(0.08, 0.92) * H;
    return { x: seedLeft ? rnd(-200, -40) * dpr : rnd(0, W), y: baseY, baseY, phase: rnd(0, 6.283), amp: rnd(18, 60) * dpr, freq: rnd(0.006, 0.013) / dpr, speed: rnd(0.5, 1.3) * dpr, seg: Math.round(rnd(9, 16)), r: rnd(5, 9) * dpr, trail: [] };
  }
  function init() {
    W = cv.width = Math.floor(innerWidth * dpr); H = cv.height = Math.floor(innerHeight * dpr);
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    buildBoard();
    const n = Math.max(4, Math.min(8, Math.round(innerWidth / 220)));
    cats = []; for (let i = 0; i < n; i++) cats.push(spawnCat(false));
  }

  function drawCat(cat) {
    const tr = cat.trail; if (tr.length < 2) return;
    // woven thread (the cyber-prosthetic filament) trailing behind, warm orange
    ctx.lineWidth = 1.4 * dpr; ctx.strokeStyle = 'rgba(255,122,60,0.5)'; ctx.beginPath();
    for (let i = 0; i < tr.length; i++) { const p = tr[i]; i ? ctx.lineTo(p.x, p.y + 5 * dpr) : ctx.moveTo(p.x, p.y + 5 * dpr); } ctx.stroke();
    ctx.strokeStyle = 'rgba(255,205,80,0.28)'; ctx.beginPath();
    for (let i = 0; i < tr.length; i++) { const p = tr[i]; i ? ctx.lineTo(p.x, p.y - 4 * dpr) : ctx.moveTo(p.x, p.y - 4 * dpr); } ctx.stroke();
    // glossy green segments
    const step = Math.max(1, Math.floor(tr.length / cat.seg));
    for (let i = tr.length - 1, k = 0; i >= 0 && k < cat.seg; i -= step, k++) {
      const p = tr[i], rr = cat.r * (0.55 + 0.45 * (1 - k / cat.seg));
      const g = ctx.createRadialGradient(p.x - rr * 0.4, p.y - rr * 0.5, rr * 0.1, p.x, p.y, rr);
      g.addColorStop(0, 'rgba(210,255,225,0.95)'); g.addColorStop(0.4, 'rgba(61,255,154,0.85)'); g.addColorStop(1, 'rgba(20,120,70,0.7)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(p.x - rr * 0.35, p.y - rr * 0.4, rr * 0.18, 0, 6.283); ctx.fill();
    }
    // head: dark capsule + cyan sensor
    const h = tr[tr.length - 1];
    ctx.fillStyle = 'rgba(235,245,255,0.9)'; ctx.beginPath(); ctx.arc(h.x + cat.speed * 4, h.y, cat.r * 0.92, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(39,231,255,0.95)'; ctx.beginPath(); ctx.arc(h.x + cat.speed * 6, h.y, cat.r * 0.22, 0, 6.283); ctx.fill();
  }

  function step() {
    for (const cat of cats) {
      cat.x += cat.speed; cat.y = cat.baseY + Math.sin(cat.x * cat.freq + cat.phase) * cat.amp;
      cat.trail.push({ x: cat.x, y: cat.y }); if (cat.trail.length > cat.seg * 6) cat.trail.shift();
      if (cat.x > W + 220 * dpr) { Object.assign(cat, spawnCat(true)); }
    }
  }
  function render() { ctx.clearRect(0, 0, W, H); if (board) ctx.drawImage(board, 0, 0); for (const cat of cats) drawCat(cat); }

  function frame() { step(); render(); requestAnimationFrame(frame); }

  init();
  if (RM) { for (const cat of cats) { for (let i = 0; i < cat.seg * 5; i++) { cat.x += cat.speed; cat.y = cat.baseY + Math.sin(cat.x * cat.freq + cat.phase) * cat.amp; cat.trail.push({ x: cat.x, y: cat.y }); } } render(); }
  else requestAnimationFrame(frame);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(init, 200); });
})();
