/**
 * Star-Citizen-style ship HUD for the combat view (#pilotFeed), drawn in 2D.
 *
 * Faithful to the reference flight HUD: a ship hologram + gimbal/gun readout
 * top-left, an "ONLINE" status banner + heading tape up top, dual vertical
 * throttle bars (SCM speed left, throttle/AB right) with green/red segments and
 * a knob, ESP/CPLD mode toggles, H/Q fuel, a G-meter node graphic, decoy/noise,
 * R-ALT/VSI/ATMO, a centre pitch ladder + boresight reticle, and amber/red
 * warning text. Cyan default; amber/red when damaged.
 *
 * Pure canvas: drawCombatHudSC(ctx, w, h, now, state). `state` is optional —
 * sensible demo values fill any gaps, so it renders standalone for previews.
 */
const F = "'JetBrains Mono','Orbitron',monospace";
const COL = { cy: '#5fd0ff', cyD: 'rgba(95,208,255,.45)', gr: '#5dff9d', rd: '#ff5c66', am: '#ffb020', grn: '#39d98a', dim: 'rgba(150,200,230,.5)' };

function txt(ctx, s, x, y, size, color, align, weight) {
  ctx.font = `${weight || 400} ${size}px ${F}`;
  ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function drawCombatHudSC(ctx, w, h, now, state) {
  const S = Object.assign({
    mode: 'GUN', scm: 'SCM', speed: 0, throttle: 0.0, ab: 1.0, hFuel: 99, qFuel: 100,
    alt: 3, vsi: 0, atmo: null, g: 0.0, gMax: 1.0, heading: 0, decoy: 48, noise: 5,
    shieldF: 75, shieldR: 75, status: 'ONLINE', warn: [], gimbal: 'P F', group: 'GUNS (ALL)',
    accent: 'cy', ladder: false
  }, state || {});
  const A = COL[S.accent] || COL.cy;           // theme accent (cy / am / rd)
  const cx = w * 0.5, cy = h * 0.5;
  const u = Math.min(w, h);
  const fs = Math.max(7, u * 0.026);           // base label size
  ctx.save();
  ctx.lineWidth = Math.max(1, u * 0.004);

  // ── corner frame brackets ───────────────────────────────────────────────
  ctx.strokeStyle = COL.cyD;
  const m = u * 0.05, L = u * 0.06;
  [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke();
  });

  // ── top-left: ship hologram + gimbal/gun ────────────────────────────────
  const hx = m + u * 0.01, hy = m + u * 0.01, hw = u * 0.2, hh = u * 0.15;
  ctx.strokeStyle = 'rgba(95,208,255,.28)';
  ctx.strokeRect(hx, hy, hw, hh);
  // top-view ship wireframe (arrow body + 2 nacelles) in the box
  ctx.save();
  ctx.translate(hx + hw * 0.5, hy + hh * 0.5);
  ctx.strokeStyle = A; ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(1, u * 0.0028);
  // top-view wireframe of the Condor / Enforcer (voyage-log ship): long hull,
  // spine, broad swept wings, rear engine pods, twin bow guns (bow = -y)
  const Ld = hh * 0.4, Wd = hw * 0.12;
  ctx.beginPath(); ctx.moveTo(0, -Ld); ctx.lineTo(Wd, -Ld * 0.5); ctx.lineTo(Wd, Ld * 0.72); ctx.lineTo(-Wd, Ld * 0.72); ctx.lineTo(-Wd, -Ld * 0.5); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -Ld * 0.45); ctx.lineTo(0, Ld * 0.6); ctx.stroke();
  for (const sgx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sgx * Wd, -Ld * 0.05); ctx.lineTo(sgx * Wd * 4.2, Ld * 0.28); ctx.lineTo(sgx * Wd * 3.7, Ld * 0.5); ctx.lineTo(sgx * Wd, Ld * 0.42); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sgx * Wd * 0.45, -Ld * 0.5); ctx.lineTo(sgx * Wd * 0.45, -Ld * 1.05); ctx.stroke(); // bow gun
    ctx.strokeRect(sgx * Wd * 0.55 - Wd * 0.18, Ld * 0.62, Wd * 0.36, Ld * 0.3); // engine pod
  }
  ctx.restore();
  txt(ctx, S.shieldF, hx + hw * 0.32, hy + hh + fs * 0.9, fs * 0.9, COL.gr, 'center', 600);
  txt(ctx, S.shieldR, hx + hw * 0.68, hy + hh + fs * 0.9, fs * 0.9, COL.gr, 'center', 600);
  ctx.strokeStyle = COL.gr; ctx.beginPath(); ctx.moveTo(hx + hw * 0.2, hy + hh + fs * 0.2); ctx.lineTo(hx + hw * 0.44, hy + hh + fs * 0.2); ctx.moveTo(hx + hw * 0.56, hy + hh + fs * 0.2); ctx.lineTo(hx + hw * 0.8, hy + hh + fs * 0.2); ctx.stroke();
  txt(ctx, 'GIMBAL', hx + hw + u * 0.02, hy + fs * 0.6, fs, A, 'left', 600);
  txt(ctx, 'GROUP', hx + hw + u * 0.02, hy + fs * 2.0, fs, A, 'left', 600);
  txt(ctx, S.gimbal, hx + hw + u * 0.02, hy + fs * 3.4, fs, COL.dim);
  txt(ctx, S.group, hx + hw + u * 0.02, hy + fs * 4.6, fs, COL.dim);

  // ── top-centre: status banner + heading tape ────────────────────────────
  if (S.status) {
    const bw = u * 0.16, bh = fs * 1.6, bx = cx - bw / 2, by = m + u * 0.005;
    ctx.fillStyle = 'rgba(57,217,138,.16)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = COL.grn; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = COL.grn; ctx.fillRect(bx + 4, by + bh * 0.25, 3, bh * 0.5); ctx.fillRect(bx + bw - 7, by + bh * 0.25, 3, bh * 0.5);
    txt(ctx, S.status, cx, by + bh / 2, fs * 1.1, COL.grn, 'center', 700);
  }
  const tapeY = m + u * 0.08, ppd = u * 0.0125;
  ctx.strokeStyle = COL.cyD; ctx.fillStyle = A;
  for (let d = -40; d <= 40; d += 10) {
    const hd = Math.round(S.heading + d), x = cx + d * ppd;
    if (Math.abs(d) <= 36) {
      ctx.beginPath(); ctx.moveTo(x, tapeY); ctx.lineTo(x, tapeY + fs * 0.5); ctx.stroke();
      txt(ctx, ((hd % 360) + 360) % 360, x, tapeY - fs * 0.6, fs * 0.92, COL.dim, 'center');
    }
  }
  ctx.fillStyle = A; ctx.beginPath(); ctx.moveTo(cx, tapeY + fs * 0.9); ctx.lineTo(cx - fs * 0.5, tapeY + fs * 1.6); ctx.lineTo(cx + fs * 0.5, tapeY + fs * 1.6); ctx.closePath(); ctx.fill();
  txt(ctx, (((Math.round(S.heading)) % 360) + 360) % 360, cx, tapeY + fs * 2.4, fs, A, 'center', 600);

  // ── vertical throttle bar helper ────────────────────────────────────────
  function bar(x, val) {
    const top = h * 0.34, len = h * 0.34, segs = 26;
    ctx.fillStyle = A; ctx.fillRect(x - fs * 0.35, top - fs * 0.5, fs * 0.7, fs * 0.5);   // top cap
    for (let i = 0; i < segs; i++) {
      const f = 1 - i / (segs - 1), y = top + (i / (segs - 1)) * len;
      const reverse = f < 0.18;
      const lit = f <= val + 0.02;
      ctx.strokeStyle = reverse ? (lit ? COL.rd : 'rgba(255,92,102,.25)') : (lit ? COL.gr : 'rgba(93,255,157,.22)');
      ctx.lineWidth = Math.max(1, u * 0.004);
      ctx.beginPath(); ctx.moveTo(x - fs * 0.5, y); ctx.lineTo(x + fs * 0.5, y); ctx.stroke();
    }
    const ky = top + (1 - val) * len;
    ctx.fillStyle = COL.cy; ctx.fillRect(x + fs * 0.6, ky - fs * 0.3, fs * 0.6, fs * 0.6);    // knob
    ctx.strokeStyle = COL.cy; ctx.beginPath(); ctx.moveTo(x - fs * 0.5, ky); ctx.lineTo(x + fs * 0.6, ky); ctx.stroke();
  }

  // ── left column: ESP/CPLD, gimbal cross, SCM/GUN, speed, fuel ───────────
  const lx = w * 0.27;
  bar(lx, Math.max(0.04, Math.min(1, S.speed / Math.max(1, (S.scm === 'SCM' ? 220 : 1200)))));
  const ex = w * 0.15;
  ctx.strokeStyle = A;
  ['ESP', 'CPLD'].forEach((s, i) => { const by = h * 0.49 + i * fs * 1.8; ctx.strokeRect(ex - fs * 1.6, by - fs * 0.7, fs * 3.2, fs * 1.4); txt(ctx, s, ex, by, fs, A, 'center', 600); });
  // gimbal cross [+]
  const gx = w * 0.23, gy = h * 0.49;
  ctx.strokeStyle = COL.rd; ctx.beginPath(); ctx.moveTo(gx - fs, gy); ctx.lineTo(gx + fs, gy); ctx.moveTo(gx, gy - fs); ctx.lineTo(gx, gy + fs); ctx.stroke();
  ctx.fillStyle = 'rgba(255,92,102,.85)'; ctx.fillRect(gx + fs * 1.1, gy - fs * 0.45, fs * 0.9, fs * 0.9); txt(ctx, '+', gx + fs * 1.55, gy, fs, '#fff', 'center', 700);
  txt(ctx, S.scm, w * 0.18, h * 0.30, fs * 1.05, A, 'left', 700);
  txt(ctx, S.mode, w * 0.18, h * 0.30 + fs * 1.4, fs * 1.05, A, 'left', 700);
  txt(ctx, Math.round(S.speed), lx, h * 0.74, fs * 2.0, '#eaf6ff', 'center', 700);
  txt(ctx, 'm/s', lx, h * 0.74 + fs * 1.6, fs, COL.dim, 'center');
  // fuel — bottom-left corner, clear of the speed readout
  txt(ctx, S.hFuel + '%', m, h * 0.86, fs, '#eaf6ff', 'left', 600); txt(ctx, 'H-FUEL', m + fs * 2.9, h * 0.86, fs, A, 'left');
  txt(ctx, S.qFuel + '%', m, h * 0.86 + fs * 1.5, fs, '#eaf6ff', 'left', 600); txt(ctx, 'Q-FUEL', m + fs * 2.9, h * 0.86 + fs * 1.5, fs, A, 'left');

  // ── right column: AB bar, G-meter node, decoy/noise, alt/vsi ────────────
  const rx = w * 0.73;
  bar(rx, Math.max(0.04, Math.min(1, S.ab)));
  txt(ctx, Math.round(S.ab * 100) + '%', rx, h * 0.72, fs * 1.6, '#eaf6ff', 'center', 700);
  txt(ctx, 'AB', rx, h * 0.72 + fs * 1.5, fs, COL.dim, 'center');
  // G-meter node graphic
  const ngx = w * 0.82, ngy = h * 0.5, nr = fs * 1.7;
  ctx.strokeStyle = COL.cyD;
  ctx.beginPath(); ctx.arc(ngx, ngy, fs * 0.5, 0, 7); ctx.stroke();
  for (let a = 0; a < 4; a++) { const ax = ngx + Math.cos(a * Math.PI / 2) * nr, ay = ngy + Math.sin(a * Math.PI / 2) * nr; ctx.beginPath(); ctx.moveTo(ngx + Math.cos(a * Math.PI / 2) * fs * 0.6, ngy + Math.sin(a * Math.PI / 2) * fs * 0.6); ctx.lineTo(ax, ay); ctx.stroke(); ctx.fillStyle = COL.cyD; ctx.beginPath(); ctx.arc(ax, ay, fs * 0.18, 0, 7); ctx.fill(); }
  txt(ctx, S.g.toFixed(1), w * 0.9, ngy - fs * 0.5, fs * 1.7, '#eaf6ff', 'right', 700); txt(ctx, 'G', w * 0.9 + fs * 0.4, ngy - fs * 0.5, fs, A, 'left');
  txt(ctx, S.gMax.toFixed(1), w * 0.9, ngy + fs * 1.1, fs, COL.dim, 'right');
  txt(ctx, 'DECOY', w * 0.78, h * 0.31, fs, A); txt(ctx, S.decoy, w * 0.86, h * 0.31, fs, '#eaf6ff', 'left', 600);
  txt(ctx, 'NOISE', w * 0.78, h * 0.31 + fs * 1.4, fs, A); txt(ctx, S.noise, w * 0.86, h * 0.31 + fs * 1.4, fs, '#eaf6ff', 'left', 600);
  txt(ctx, 'R-ALT', w * 0.79, h * 0.80, fs, A); txt(ctx, S.alt + 'm', w * 0.96, h * 0.80, fs, '#eaf6ff', 'right', 600);
  txt(ctx, 'VSI', w * 0.79, h * 0.80 + fs * 1.5, fs, A); txt(ctx, S.vsi + 'm/s', w * 0.96, h * 0.80 + fs * 1.5, fs, '#eaf6ff', 'right', 600);
  if (S.atmo != null) { txt(ctx, 'ATMO', w * 0.79, h * 0.80 + fs * 3.0, fs, A); txt(ctx, S.atmo, w * 0.96, h * 0.80 + fs * 3.0, fs, '#eaf6ff', 'right', 600); }

  // ── centre: pitch ladder (atmo/hangar only) + boresight reticle ─────────
  if (S.ladder) {
    ctx.strokeStyle = COL.cyD;
    for (const sgy of [-1, 1]) for (let i = 1; i <= 2; i++) {
      const ly = cy + sgy * i * h * 0.1;
      for (const sgx of [-1, 1]) { const bxp = cx + sgx * w * 0.13; ctx.beginPath(); ctx.moveTo(bxp - sgx * fs * 1.4, ly); ctx.lineTo(bxp, ly); ctx.lineTo(bxp, ly - fs * 0.7); ctx.stroke(); txt(ctx, -35 - (i - 1) * 5, bxp - sgx * fs * 2.2, ly, fs * 0.85, COL.dim, sgx < 0 ? 'right' : 'left'); }
    }
  }
  // side arcs ")("
  ctx.strokeStyle = A;
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.16, -Math.PI * 0.16, Math.PI * 0.16); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.16, Math.PI - Math.PI * 0.16, Math.PI + Math.PI * 0.16); ctx.stroke();
  // boresight
  ctx.strokeStyle = A; ctx.lineWidth = Math.max(1, u * 0.003);
  ctx.beginPath(); ctx.moveTo(cx - fs, cy); ctx.lineTo(cx - fs * 0.4, cy); ctx.moveTo(cx + fs, cy); ctx.lineTo(cx + fs * 0.4, cy); ctx.moveTo(cx, cy - fs); ctx.lineTo(cx, cy - fs * 0.4); ctx.moveTo(cx, cy + fs); ctx.lineTo(cx, cy + fs * 0.4); ctx.stroke();
  ctx.strokeRect(cx - 1.5, cy - 1.5, 3, 3);

  // ── warnings (amber/red) ────────────────────────────────────────────────
  (S.warn || []).forEach((wln, i) => {
    txt(ctx, wln, cx, cy - h * 0.22 + i * fs * 1.5, fs * 1.05, i === 0 ? COL.am : COL.rd, 'center', 700);
  });

  ctx.restore();
}
