/* ============================================================
   TACTICAL OVERLAY — U25b. The 2D HUD info layer drawn over the 3D
   top-down combat blit. Replaces the synthetic drawPilotHmd pass in that
   branch: every bracket/marker here sits on a REAL projected 3D position
   (topdownCombat's getHudFeeds()), and every readout is live state
   (charter ②). Colour discipline is charter ⑤: cyan = world/data,
   amber/red = warnings only.

   Pure helpers (fmtRange/edgeClamp) are exported for vitest.
   ============================================================ */

const CYAN = 'rgba(154,229,255,';
const AMBER = 'rgba(232,179,128,';
const RED = 'rgba(255,92,98,';

// world units → display km (fixed presentation scale; one place, one truth)
export function fmtRange(dist) {
  const km = dist * 0.12;
  return km >= 10 ? `${km.toFixed(0)}km` : `${km.toFixed(1)}km`;
}

// Clamp an (possibly off-screen / behind-camera) normalized point to the
// panel edge; returns pixel coords + the angle an edge chevron should face.
export function edgeClamp(nx, ny, behind, w, h, margin = 16) {
  let dx = nx - 0.5, dy = ny - 0.5;
  if (behind) { dx = -dx; dy = -dy; }           // behind camera → mirror
  if (dx === 0 && dy === 0) dx = 0.0001;
  const sx = (0.5 - margin / w) / Math.abs(dx || 1e-9);
  const sy = (0.5 - margin / h) / Math.abs(dy || 1e-9);
  const s = Math.min(sx, sy);
  return {
    x: (0.5 + dx * s) * w,
    y: (0.5 + dy * s) * h,
    ang: Math.atan2(dy, dx),
  };
}

const FLIGHT_TAG = {
  catapult: 'CAT', rotate: 'ROT', climb: 'CLB', join: 'JOIN',
  break: 'BRK', approach: 'APP', flare: 'FLR', touchdown: 'TD',
};

export function drawTacticalOverlay(ctx, w, h, now, feeds, snap, label) {
  if (!feeds) return;
  const mono = (px) => `${px}px 'JetBrains Mono',monospace`;
  ctx.save();

  // ── mode label (top-left, replaces the old drawPilotHmd banner) ────────
  ctx.font = mono(Math.max(8, Math.min(11, w * 0.02)));
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = `${CYAN}.62)`;
  ctx.fillText(label, w * 0.045, h * 0.06);

  // ── camera readout (bottom-center, real fov + shot name) ───────────────
  ctx.font = mono(Math.max(7, Math.min(9, w * 0.015)));
  ctx.textAlign = 'center';
  ctx.fillStyle = `${CYAN}.40)`;
  ctx.fillText(`CAM ${String(feeds.shot).toUpperCase()} · FOV ${feeds.fov}°`, w * 0.5, h * 0.925);

  // ── wingman markers (small diamonds on real projections) ───────────────
  for (const f of feeds.fighters || []) {
    if (!f.on) continue;
    const x = f.x * w, y = f.y * h, d = 5;
    ctx.strokeStyle = `${CYAN}.55)`; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y);
    ctx.closePath(); ctx.stroke();
    ctx.font = mono(Math.max(6, Math.min(8, w * 0.013)));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = f.flight ? `${AMBER}.85)` : `${CYAN}.45)`;
    ctx.fillText(f.flight ? `W${f.id} · ${FLIGHT_TAG[f.flight] || f.flight}` : `W${f.id}`, x + d + 4, y);
  }

  // ── target bracket (the real comet projection) ─────────────────────────
  const t = feeds.target;
  if (t && t.on) {
    const x = t.x * w, y = t.y * h;
    // bracket shrinks slightly with range — reads as depth
    const s = Math.max(14, Math.min(30, 640 / Math.max(20, t.dist)));
    const locked = !!(snap && snap.halley && snap.halley.hover);
    ctx.strokeStyle = locked ? `${AMBER}.92)` : `${CYAN}.85)`;
    ctx.lineWidth = 1.2;
    const arm = s * 0.42;
    // four corner ticks (SC-style thin bracket)
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(x + cx * s, y + cy * s - cy * arm);
      ctx.lineTo(x + cx * s, y + cy * s);
      ctx.lineTo(x + cx * s - cx * arm, y + cy * s);
      ctx.stroke();
    }
    // name above · live range below
    ctx.font = mono(Math.max(7, Math.min(10, w * 0.016)));
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = `${CYAN}.85)`;
    ctx.fillText('1P/HALLEY', x, y - s - 5);
    ctx.textBaseline = 'top';
    ctx.fillStyle = `${CYAN}.62)`;
    ctx.fillText(fmtRange(t.dist), x, y + s + 5);
    // hull bar — real hp (0..200), amber under 35%
    if (snap && snap.halley && !snap.halley.destroyed) {
      const frac = Math.max(0, Math.min(1, (snap.halley.hp ?? 100) / 200));
      const bw = s * 2, bh = 2.5, bx = x - s, by = y + s + 5 + Math.max(9, w * 0.016) + 3;
      ctx.fillStyle = `${CYAN}.16)`; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = frac < 0.35 ? `${AMBER}.85)` : `${CYAN}.72)`;
      ctx.fillRect(bx, by, bw * frac, bh);
    }
    // lock pulse ring while the real target is hovered/locked
    if (locked) {
      const pl = 1 - ((now / 900) % 1);
      ctx.strokeStyle = `${AMBER}${(0.5 * pl).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, s * (1.25 + (1 - pl) * 0.5), 0, Math.PI * 2); ctx.stroke();
    }
  } else if (t) {
    // off-screen / behind: edge chevron pointing at the target
    const e = edgeClamp(t.x, t.y, t.behind, w, h);
    ctx.save();
    ctx.translate(e.x, e.y); ctx.rotate(e.ang);
    ctx.strokeStyle = `${RED}.8)`; ctx.fillStyle = `${RED}.5)`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.font = mono(Math.max(6, Math.min(8, w * 0.013)));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `${RED}.6)`;
    const lx = Math.max(30, Math.min(w - 30, e.x - Math.cos(e.ang) * 26));
    const ly = Math.max(12, Math.min(h - 12, e.y - Math.sin(e.ang) * 26));
    ctx.fillText(fmtRange(t.dist), lx, ly);
  }

  ctx.restore();
}
