/**
 * Combat-view weapon cinematics (2D canvas, drawn into #pilotFeed).
 *
 *  drawMissileCine — auto-lock onto the comet → missile launch → homing track →
 *                    impact flash + shockwave + fragments.
 *  drawNukeCine    — multi-shot: Nighthawk escorts laser-designate the comet then
 *                    peel off both edges → mothership VLS hatch opens → nuke rises
 *                    + ignites → camera tracks it in → detonation.
 *
 * Both are driven by `e` (elapsed 0..1 across the weapon's camera window, set by
 * pilotView.started/until) so they stay time-aligned with the real weapon effect.
 * The comet is aimed by the live halley screen position (opts.halley) for rough
 * spatial alignment with the page battle.
 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

function spaceBg(ctx, w, h, now, streak) {
  ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#bcd';
  for (let i = 0; i < 70; i++) {
    const sx = (i * 71 % w), base = (i * 53 % h);
    const y = streak ? (base + (now * 0.4 * (0.5 + (i % 5) / 5))) % h : base;
    ctx.globalAlpha = 0.15 + (i % 7) / 14;
    ctx.fillRect(sx, y, streak ? 1 : 1.3, streak ? 3 + (i % 4) : 1.3);
  }
  ctx.globalAlpha = 1;
}
function cometAt(ctx, x, y, r, now) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const tail = ctx.createLinearGradient(x, y, x + r * 4, y - r * 2);
  tail.addColorStop(0, 'rgba(150,210,255,.5)'); tail.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = tail; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 5, y - r * 3); ctx.lineTo(x + r * 5, y - r * 1.2); ctx.closePath(); ctx.fill();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
  g.addColorStop(0, 'rgba(220,240,255,.95)'); g.addColorStop(0.4, 'rgba(120,190,255,.6)'); g.addColorStop(1, 'rgba(60,120,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#2a3340'; ctx.beginPath();
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, rr = r * (0.7 + 0.3 * Math.sin(i * 3 + now * 0.001)); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function shock(ctx, x, y, r, a, col) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}
function flash(ctx, x, y, r, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.4, `rgba(200,230,255,${a * 0.6})`); g.addColorStop(1, 'rgba(150,200,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
function targetXY(halley, w, h) {
  let nx = 0.5, ny = 0.3;
  try {
    if (halley && typeof halley.curX === 'number') {
      nx = clamp(0.5 + (halley.curX / window.innerWidth - 0.5) * 0.7, 0.22, 0.78);
      ny = clamp(0.34 + (halley.curY / window.innerHeight - 0.5) * 0.5, 0.16, 0.5);
    }
  } catch (e) {}
  return { x: nx * w, y: ny * h };
}
function label(ctx, s, x, y, size, col, align) {
  ctx.font = `${size}px 'JetBrains Mono',monospace`; ctx.fillStyle = col; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}

/* ── MISSILE ────────────────────────────────────────────────────────────── */
export function drawMissileCine(ctx, w, h, now, e, opts = {}) {
  const lang = opts.lang || 'en', u = Math.min(w, h);
  const t = targetXY(opts.halley, w, h);
  spaceBg(ctx, w, h, now, false);
  const alive = e < 0.9;
  const cr = u * 0.045 * (1 + e * 1.1);
  if (alive) cometAt(ctx, t.x, t.y, cr, now);

  // lock box (closes 0→0.28), then tracks
  if (e < 0.86) {
    const lp = clamp(e / 0.28, 0, 1), box = lerp(u * 0.32, cr * 2.4, lp);
    const locked = lp >= 1;
    ctx.strokeStyle = locked ? 'rgba(93,255,157,.95)' : 'rgba(255,176,32,.9)'; ctx.lineWidth = Math.max(1, u * 0.005);
    const c = box / 2, cn = box * 0.28;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(t.x + sx * c - sx * cn, t.y + sy * c); ctx.lineTo(t.x + sx * c, t.y + sy * c); ctx.lineTo(t.x + sx * c, t.y + sy * c - sy * cn); ctx.stroke();
    }
    label(ctx, locked ? 'LOCK' : 'LOCKING', t.x, t.y - box * 0.62, Math.max(8, u * 0.03), locked ? 'rgba(93,255,157,.95)' : 'rgba(255,176,32,.9)');
  }

  // missile flight 0.22 → 0.86 (homing arc from bottom-centre)
  if (e >= 0.2 && e < 0.9) {
    const p = clamp((e - 0.2) / 0.66, 0, 1), ep = p * p * (3 - 2 * p);
    const sx0 = w * 0.5, sy0 = h * 1.02;
    const bend = Math.sin(p * Math.PI) * (t.x - sx0) * 0.25;
    const mx = lerp(sx0, t.x, ep) + bend * (1 - ep), my = lerp(sy0, t.y, ep);
    const ang = Math.atan2(t.y - my, t.x - mx);
    // smoke trail
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 10; i++) { const tp = p - i * 0.03; if (tp < 0) break; const tx = lerp(sx0, t.x, tp * tp * (3 - 2 * tp)), ty = lerp(sy0, t.y, tp); ctx.fillStyle = `rgba(255,180,120,${0.4 * (1 - i / 10)})`; ctx.beginPath(); ctx.arc(tx, ty, u * 0.012 * (1 - i / 12), 0, TAU); ctx.fill(); }
    ctx.restore();
    // missile body
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#cfd8e2'; ctx.beginPath(); ctx.moveTo(0, -u * 0.03); ctx.lineTo(u * 0.01, u * 0.02); ctx.lineTo(-u * 0.01, u * 0.02); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; const fl = ctx.createLinearGradient(0, u * 0.02, 0, u * 0.07); fl.addColorStop(0, 'rgba(255,240,200,.9)'); fl.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = fl; ctx.beginPath(); ctx.moveTo(-u * 0.008, u * 0.02); ctx.lineTo(0, u * 0.075); ctx.lineTo(u * 0.008, u * 0.02); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(ctx, `MSL · ${Math.round((1 - p) * 1800)} m`, w * 0.5, h - u * 0.05, Math.max(7, u * 0.026), 'rgba(154,229,255,.8)');
  }

  // impact
  if (e >= 0.84) {
    const ip = clamp((e - 0.84) / 0.16, 0, 1);
    flash(ctx, t.x, t.y, u * (0.1 + ip * 0.5), (1 - ip));
    shock(ctx, t.x, t.y, u * (0.05 + ip * 0.6), (1 - ip) * 0.9, '200,230,255');
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, d = u * ip * 0.5; ctx.fillStyle = `rgba(255,${180 - i * 6},120,${(1 - ip) * 0.8})`; ctx.fillRect(t.x + Math.cos(a) * d, t.y + Math.sin(a) * d, 2.5, 2.5); }
    if (ip > 0.3) label(ctx, lang === 'zh' ? '目标摧毁' : 'TARGET DESTROYED', t.x, t.y + u * 0.12, Math.max(9, u * 0.034), 'rgba(93,255,157,.95)');
  }
  // frame label
  label(ctx, lang === 'zh' ? '导弹 · 自主制导' : 'MISSILE · GUIDED', w * 0.5, u * 0.05, Math.max(7, u * 0.026), 'rgba(154,229,255,.7)');
}

/* ── NUKE (multi-shot VLS sequence) ─────────────────────────────────────── */
export function drawNukeCine(ctx, w, h, now, e, opts = {}) {
  const lang = opts.lang || 'en', u = Math.min(w, h), cx = w * 0.5;
  const t = targetXY(opts.halley, w, h);

  if (e < 0.18) {
    // SHOT 1 — escorts laser-designate, then peel off both edges
    spaceBg(ctx, w, h, now, false);
    cometAt(ctx, t.x, t.y, u * 0.05, now);
    const p = e / 0.18;
    for (const sx of [-1, 1]) {
      const fx = lerp(cx + sx * w * 0.12, cx + sx * w * 0.7, p), fy = h * 0.78 - p * h * 0.1;
      // laser designation beam to comet (fades as they leave)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(120,255,140,${0.5 * (1 - p)})`; ctx.lineWidth = Math.max(1, u * 0.004);
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.restore();
      // dark Nighthawk dart
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(sx * 0.5); ctx.fillStyle = '#10161f'; ctx.beginPath(); ctx.moveTo(0, -u * 0.035); ctx.lineTo(u * 0.022, u * 0.02); ctx.lineTo(-u * 0.022, u * 0.02); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,220,255,.8)'; ctx.fillRect(-u * 0.004, u * 0.018, u * 0.008, u * 0.012); ctx.restore();
    }
    label(ctx, lang === 'zh' ? '护航 · 激光指示' : 'ESCORTS · LASER DESIGNATION', cx, u * 0.06, Math.max(7, u * 0.026), 'rgba(120,255,140,.8)');
  } else if (e < 0.5) {
    // SHOT 2/3 — mothership VLS hatch opens, nuke rises + ignites
    spaceBg(ctx, w, h, now, false);
    const p = (e - 0.18) / 0.32;
    // mothership hull band across the lower frame
    ctx.fillStyle = '#222a33'; ctx.fillRect(0, h * 0.55, w, h * 0.5);
    ctx.fillStyle = '#161c24'; ctx.fillRect(0, h * 0.55, w, h * 0.04);
    for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 2 ? '#2b3440' : '#1d242c'; ctx.fillRect((i / 18) * w, h * 0.6, w / 18 - 2, h * 0.06); }
    // VLS bay
    const bayX = cx - w * 0.12, bayW = w * 0.24, bayY = h * 0.55, bayH = h * 0.14;
    ctx.fillStyle = '#05080c'; ctx.fillRect(bayX, bayY, bayW, bayH);
    const open = clamp(p / 0.4, 0, 1); // doors part 0..0.4
    ctx.fillStyle = '#3a4552';
    ctx.fillRect(bayX, bayY, (bayW / 2) * (1 - open), bayH); ctx.fillRect(bayX + bayW - (bayW / 2) * (1 - open), bayY, (bayW / 2) * (1 - open), bayH);
    // interior glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const ig = ctx.createLinearGradient(0, bayY, 0, bayY + bayH); ig.addColorStop(0, `rgba(120,200,255,${0.5 * open})`); ig.addColorStop(1, 'rgba(120,200,255,0)'); ctx.fillStyle = ig; ctx.fillRect(bayX, bayY, bayW, bayH); ctx.restore();
    // nuke rises after doors open (p>0.4)
    if (p > 0.38) {
      const rp = clamp((p - 0.38) / 0.62, 0, 1), ny = lerp(bayY + bayH * 0.6, bayY - h * 0.18, rp);
      ctx.fillStyle = '#d7dee6'; ctx.beginPath(); ctx.moveTo(cx, ny - u * 0.05); ctx.lineTo(cx + u * 0.02, ny + u * 0.03); ctx.lineTo(cx - u * 0.02, ny + u * 0.03); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b03030'; ctx.fillRect(cx - u * 0.02, ny + u * 0.005, u * 0.04, u * 0.012);
      if (rp > 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const fl = ctx.createLinearGradient(0, ny + u * 0.03, 0, ny + u * 0.12); fl.addColorStop(0, 'rgba(255,240,200,.95)'); fl.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = fl; ctx.beginPath(); ctx.moveTo(cx - u * 0.015, ny + u * 0.03); ctx.lineTo(cx, ny + u * 0.13); ctx.lineTo(cx + u * 0.015, ny + u * 0.03); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
    label(ctx, lang === 'zh' ? '母舰 · 垂直发射系统' : 'CARRIER · VLS LAUNCH', cx, u * 0.06, Math.max(7, u * 0.026), 'rgba(255,176,32,.85)');
  } else if (e < 0.9) {
    // SHOT 4 — camera tracks the nuke flying in (starfield streaks, comet grows)
    spaceBg(ctx, w, h, now, true);
    const p = (e - 0.5) / 0.4;
    const cr = u * 0.04 * (1 + p * 3.2);
    cometAt(ctx, t.x, t.y, cr, now);
    // nuke held mid-frame, trail downward
    const nx = lerp(cx, t.x, p * 0.6), ny = lerp(h * 0.8, t.y + cr, p);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 14; i++) { const a = 1 - i / 14; ctx.fillStyle = `rgba(255,${190 - i * 8},120,${0.5 * a})`; ctx.beginPath(); ctx.arc(nx, ny + i * u * 0.03, u * 0.014 * a, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.translate(nx, ny); ctx.fillStyle = '#e2e8ee'; ctx.beginPath(); ctx.moveTo(0, -u * 0.05); ctx.lineTo(u * 0.022, u * 0.03); ctx.lineTo(-u * 0.022, u * 0.03); ctx.closePath(); ctx.fill(); ctx.restore();
    label(ctx, `T-${((1 - p) * 3).toFixed(1)}`, cx, h - u * 0.05, Math.max(9, u * 0.036), 'rgba(255,90,90,.9)');
    label(ctx, lang === 'zh' ? '核弹 · 末段跟踪' : 'NUCLEAR · TERMINAL TRACK', cx, u * 0.06, Math.max(7, u * 0.026), 'rgba(255,176,32,.85)');
  } else {
    // SHOT 5 — detonation
    spaceBg(ctx, w, h, now, false);
    const p = (e - 0.9) / 0.1;
    flash(ctx, t.x, t.y, u * (0.2 + p * 0.95), (1 - p * 0.6));
    shock(ctx, t.x, t.y, u * (0.1 + p * 0.85), (1 - p), '255,240,210');
    shock(ctx, t.x, t.y, u * (0.05 + p * 0.55), (1 - p) * 0.8, '255,160,90');
    if (p > 0.25) label(ctx, lang === 'zh' ? '目标消灭' : 'TARGET ELIMINATED', cx, h * 0.5, Math.max(10, u * 0.04), 'rgba(255,235,235,.95)');
  }
}
