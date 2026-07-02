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

// 2026-07-03 (ROADMAP §4b item 8): camera-cut whip-flash at shot-phase
// boundaries, so multi-shot sequences (nuke's 5 shots) and the missile's
// lock→ignition beat read as edited cuts instead of parameters silently
// crossing a threshold mid-frame. `boundaryFlash` is purely a function of the
// elapsed fraction `e` (no extra state needed — nuke's shots are crossed
// exactly once per cycle since e is monotonic within one weapon camera run).
function boundaryFlash(e, boundary, width = 0.015) {
  const d = Math.abs(e - boundary);
  return d < width ? 1 - d / width : 0;
}
function cutFlash(ctx, w, h, strength) {
  if (strength <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${(0.55 * strength).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
// The real kill (halley.destroyed) can land at any point in the cine's
// elapsed timeline, not just near the scripted impact beat — previously
// `e = Math.max(e, IMPACT)` silently teleported the animation forward with
// no visual cue, which reads as a glitch rather than an edit when the jump
// is large (kill lands early in the flight/track phase). These per-weapon
// one-shot flags fire a short decaying flash exactly on the frame the real
// kill is first observed, then re-arm automatically once `opts.killed` goes
// false again for the next weapon cycle — same rising-edge pattern already
// used in topdownCombat.js's kill-flash detection (see ROADMAP §4 Phase 2b).
let missilePrevKilled = false, missileKillFlashFrames = 0;
let nukePrevKilled = false, nukeKillFlashFrames = 0;

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
// AIM-120 AMRAAM drawn nose-up (-y) at origin: white body, long ogive radome,
// twin gold/tan bands, slim mid strakes, large swept cruciform tail fins, glowing
// nozzle + optional rocket flame. (ref: AMRAAM beauty render)
function missileBody(ctx, u, s, flameLen) {
  const L = u * 0.06 * s, W = u * 0.0105 * s;      // L = half-length, W = body half-width
  const noseBase = -L * 0.46, tail = L;            // ogive runs noseTip(-L) → shoulder(noseBase)
  // large swept rear cruciform fins (drawn first, behind the body)
  ctx.fillStyle = '#9aa3ad';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * W, tail - L * 0.34);
    ctx.lineTo(sx * W * 3.6, tail - L * 0.04);
    ctx.lineTo(sx * W * 3.6, tail + L * 0.06);
    ctx.lineTo(sx * W, tail);
    ctx.closePath(); ctx.fill();
  }
  // slim mid-body strakes
  ctx.fillStyle = '#b7c0ca';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * W, -L * 0.06);
    ctx.lineTo(sx * W * 1.9, L * 0.06);
    ctx.lineTo(sx * W * 1.9, L * 0.34);
    ctx.lineTo(sx * W, L * 0.3);
    ctx.closePath(); ctx.fill();
  }
  // cylindrical white body with soft round shading
  const bg = ctx.createLinearGradient(-W, 0, W, 0);
  bg.addColorStop(0, '#aeb6bf'); bg.addColorStop(0.32, '#f3f5f7'); bg.addColorStop(0.6, '#ffffff'); bg.addColorStop(1, '#c2cad2');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(-W, noseBase); ctx.lineTo(W, noseBase); ctx.lineTo(W, tail); ctx.lineTo(-W, tail); ctx.closePath(); ctx.fill();
  // long ogive radome (white, slightly warm tip)
  const ng = ctx.createLinearGradient(-W, 0, W, 0);
  ng.addColorStop(0, '#bcc4cd'); ng.addColorStop(0.5, '#ffffff'); ng.addColorStop(1, '#cdd5dd');
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.moveTo(0, -L);
  ctx.quadraticCurveTo(W * 1.05, noseBase - L * 0.18, W, noseBase);
  ctx.lineTo(-W, noseBase);
  ctx.quadraticCurveTo(-W * 1.05, noseBase - L * 0.18, 0, -L);
  ctx.closePath(); ctx.fill();
  // tip marker band (amber) + two gold/tan body bands
  ctx.fillStyle = '#d98a32'; ctx.fillRect(-W * 0.7, -L * 0.78, W * 1.4, Math.max(1, L * 0.03));
  ctx.fillStyle = '#b89a52';
  ctx.fillRect(-W, -L * 0.14, W * 2, Math.max(1, L * 0.05));
  ctx.fillRect(-W, L * 0.42, W * 2, Math.max(1, L * 0.05));
  // panel seams
  ctx.fillStyle = 'rgba(70,78,88,.5)';
  ctx.fillRect(-W, noseBase, W * 2, Math.max(1, L * 0.012));
  ctx.fillRect(-W, L * 0.18, W * 2, Math.max(1, L * 0.012));
  // tail nozzle — glows hot once the motor is lit
  const lit = flameLen > 0;
  ctx.fillStyle = lit ? '#ffcf6b' : '#3a4048';
  ctx.beginPath(); ctx.ellipse(0, tail, W * 0.85, Math.max(1, L * 0.04), 0, 0, TAU); ctx.fill();
  if (lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,180,90,.8)'; ctx.beginPath(); ctx.ellipse(0, tail, W * 0.5, Math.max(1, L * 0.025), 0, 0, TAU); ctx.fill(); ctx.restore(); }
  if (flameLen > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fl = ctx.createLinearGradient(0, tail, 0, tail + flameLen);
    fl.addColorStop(0, 'rgba(255,245,210,.95)'); fl.addColorStop(0.4, 'rgba(255,150,50,.8)'); fl.addColorStop(1, 'rgba(255,80,30,0)');
    ctx.fillStyle = fl; ctx.beginPath(); ctx.moveTo(-W * 0.9, tail); ctx.lineTo(0, tail + flameLen); ctx.lineTo(W * 0.9, tail); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/* ── MISSILE ────────────────────────────────────────────────────────────── */
export function drawMissileCine(ctx, w, h, now, e, opts = {}) {
  const lang = opts.lang || 'en', u = Math.min(w, h);
  const t = targetXY(opts.halley, w, h);
  const missileJustKilled = !!opts.killed && !missilePrevKilled;
  missilePrevKilled = !!opts.killed;
  if (missileJustKilled && e < 0.86) missileKillFlashFrames = 5; // cut-to-impact cue, only when we're actually skipping ahead
  if (opts.killed) e = Math.max(e, 0.86); // snap to impact the instant the real comet dies (frame-level sync)
  spaceBg(ctx, w, h, now, false);
  const alive = e < 0.9;
  const cr = u * 0.045 * (1 + e * 1.1);
  if (alive) cometAt(ctx, t.x, t.y, cr, now);

  // lock box (closes 0→0.28), then tracks
  if (e < 0.86) {
    const lp = clamp(e / 0.28, 0, 1), box = lerp(u * 0.32, cr * 2.4, lp);
    const locked = lp >= 1 || opts.locked; // snap to LOCK when the real target is being tracked
    ctx.strokeStyle = locked ? 'rgba(93,255,157,.95)' : 'rgba(255,176,32,.9)'; ctx.lineWidth = Math.max(1, u * 0.005);
    const c = box / 2, cn = box * 0.28;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(t.x + sx * c - sx * cn, t.y + sy * c); ctx.lineTo(t.x + sx * c, t.y + sy * c); ctx.lineTo(t.x + sx * c, t.y + sy * c - sy * cn); ctx.stroke();
    }
    label(ctx, locked ? 'LOCK' : 'LOCKING', t.x, t.y - box * 0.62, Math.max(8, u * 0.03), locked ? 'rgba(93,255,157,.95)' : 'rgba(255,176,32,.9)');
  }

  // missile 0.20 → 0.86: cold-eject from bay → ignition → accelerating homing boost
  if (e >= 0.2 && e < 0.9) {
    const bayX = w * 0.5, bayY = h * 1.04;            // weapons bay, just off the bottom edge
    const ejEndY = h * 0.82;                          // where the cold-ejected round hangs before light-off
    const EJ = 0.30, IGN_END = 0.36;                  // 0.20–0.30 eject · ~0.30 ignition · then boost
    let mx, my, ang, flame = 0, boosting = false;

    if (e < EJ) {
      // COLD EJECT — pushed clear of the bay, motor UNLIT, drifting + tumbling
      const ejP = clamp((e - 0.2) / (EJ - 0.2), 0, 1);
      const eo = 1 - (1 - ejP) * (1 - ejP);            // ease-out: quick off the rail, then coasting
      mx = bayX + Math.sin(e * 36) * u * 0.006;
      my = lerp(bayY, ejEndY, eo);
      ang = -Math.PI / 2 + Math.sin(e * 26) * 0.18;    // nose ~up with a gentle unpowered wobble
    } else {
      // BOOST — motor lit, accelerating toward the target (distance ∝ p² → visibly speeding up)
      boosting = true;
      const bp = clamp((e - EJ) / (0.86 - EJ), 0, 1);
      const acc = bp * bp;
      const bend = Math.sin(bp * Math.PI) * (t.x - bayX) * 0.18;
      mx = lerp(bayX, t.x, acc) + bend * (1 - acc);
      my = lerp(ejEndY, t.y, acc);
      ang = Math.atan2(t.y - my, t.x - mx);
      flame = u * (0.015 + bp * 0.085);                // exhaust lengthens as it spools up
      // exhaust + smoke trail (only once the motor is lit)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 12; i++) {
        const tp = bp - i * 0.04; if (tp < 0) break;
        const ta = tp * tp;
        const tx = lerp(bayX, t.x, ta), ty = lerp(ejEndY, t.y, ta);
        const k = 1 - i / 12;
        ctx.fillStyle = `rgba(${230 + (k * 25 | 0)},${190 + (k * 50 | 0)},${150 + (k * 80 | 0)},${0.34 * k})`;
        ctx.beginPath(); ctx.arc(tx, ty, u * 0.016 * (0.6 + k), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    // ignition flash at motor light-off
    if (e >= EJ - 0.01 && e < IGN_END) {
      const fp = 1 - (e - (EJ - 0.01)) / (IGN_END - (EJ - 0.01));
      flash(ctx, mx, my + u * 0.05, u * 0.17 * fp, fp);
    }

    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang + Math.PI / 2); missileBody(ctx, u, 1.0, flame); ctx.restore();

    const phase = e < EJ ? (lang === 'zh' ? '弹射' : 'EJECT')
                : e < IGN_END ? (lang === 'zh' ? '点火' : 'IGNITION')
                : (lang === 'zh' ? '加速' : 'BOOST');
    label(ctx, `MSL · ${phase}`, w * 0.5, h - u * 0.05, Math.max(7, u * 0.026),
      boosting ? 'rgba(255,200,120,.9)' : 'rgba(154,229,255,.85)');
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

  // camera cuts: lock-acquired (~0.28) and motor ignition (~0.30) beats, plus
  // the forced cut-to-impact flash when a real kill skips ahead of schedule.
  const boundaryCut = Math.max(boundaryFlash(e, 0.28, 0.02), boundaryFlash(e, 0.30, 0.02));
  const killCut = missileKillFlashFrames > 0 ? missileKillFlashFrames / 5 : 0;
  cutFlash(ctx, w, h, Math.max(boundaryCut, killCut));
  if (missileKillFlashFrames > 0) missileKillFlashFrames -= 1;
}

/* ── NUKE (multi-shot VLS sequence) ─────────────────────────────────────── */
export function drawNukeCine(ctx, w, h, now, e, opts = {}) {
  const lang = opts.lang || 'en', u = Math.min(w, h), cx = w * 0.5;
  const t = targetXY(opts.halley, w, h);
  const nukeJustKilled = !!opts.killed && !nukePrevKilled;
  nukePrevKilled = !!opts.killed;
  if (nukeJustKilled && e < 0.9) nukeKillFlashFrames = 5; // cut-to-detonation cue, only when actually skipping ahead
  if (opts.killed) e = Math.max(e, 0.9); // detonate the instant the real comet dies (frame-level sync)

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
      ctx.save(); ctx.translate(cx, ny); missileBody(ctx, u, 1.4, rp > 0.5 ? u * 0.09 : 0); ctx.restore();
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
    ctx.save(); ctx.translate(nx, ny); missileBody(ctx, u, 1.9, u * 0.16); ctx.restore(); // big booster flame (image 3)
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

  // camera cuts: the three shot-boundary edits (designate→VLS→terminal track)
  // plus a forced cut-to-detonation flash when a real kill skips ahead.
  const boundaryCut = Math.max(boundaryFlash(e, 0.18), boundaryFlash(e, 0.5), boundaryFlash(e, 0.9));
  const killCut = nukeKillFlashFrames > 0 ? nukeKillFlashFrames / 5 : 0;
  cutFlash(ctx, w, h, Math.max(boundaryCut, killCut));
  if (nukeKillFlashFrames > 0) nukeKillFlashFrames -= 1;
}
