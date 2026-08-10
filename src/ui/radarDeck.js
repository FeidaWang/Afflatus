import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';

const MAX_CONTACTS = 48;
const MAX_TRACK_POINTS = 5;
const TRACK_MEMORY_MS = 1600;
const SCAN_PERIOD_MS = 2600;

const PALETTE = Object.freeze({
  comet: '#ffb15d',
  ally: '#71f4c3',
  ciws: '#fff1b8',
  missile: '#ffca70',
  nuke: '#ff648f',
  enforcer: '#ff6de1',
});

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function radarFrameInterval(policy = {}) {
  if (policy.reducedMotion) return 125;
  if (policy.qualityTier === 'low') return 1000 / 15;
  if (policy.qualityTier === 'medium') return 1000 / 24;
  return 1000 / 30;
}

export function radarScanPhase(timestamp, { reducedMotion = false, periodMs = SCAN_PERIOD_MS } = {}) {
  if (reducedMotion) return 0.5;
  const period = Math.max(400, finite(periodMs, SCAN_PERIOD_MS));
  return ((finite(timestamp) % period) + period) % period / period;
}

export function classifyRadarProjectile(type) {
  if (type === 'phalanx') return 'ciws';
  if (type === 'missile') return 'missile';
  if (type === 'nuke') return 'nuke';
  return null;
}

/**
 * Converts the authoritative CombatState snapshot into a small, bounded sensor
 * packet. CIWS rounds deliberately remain a separate class from missiles so
 * the scan rail preserves the four defense systems' visual identities.
 */
export function collectRadarContacts(snapshot = {}, limit = MAX_CONTACTS) {
  const max = Math.max(1, Math.min(MAX_CONTACTS, Math.trunc(finite(limit, MAX_CONTACTS))));
  const contacts = [];
  const add = (contact) => {
    if (contacts.length < max) contacts.push(Object.freeze(contact));
  };

  if (snapshot.target) {
    add({
      id: String(snapshot.target.id || 'target'),
      kind: 'comet',
      x: finite(snapshot.target.x),
      y: finite(snapshot.target.y),
      vx: finite(snapshot.target.vx),
      vy: finite(snapshot.target.vy),
      size: snapshot.target.sizeClass === 'giant' ? 1.35 : 1,
      risk: clamp(finite(snapshot.target.collisionRisk)),
      locked: Boolean(snapshot.target.locked),
    });
  }

  // Strategic ordnance stays visible even during a dense CIWS barrage.
  for (const type of ['nuke', 'missile']) {
    for (const projectile of snapshot.projectiles || []) {
      if (contacts.length >= max) break;
      if (projectile.type !== type) continue;
      add({
        id: String(projectile.id || `${type}-${contacts.length}`),
        kind: type,
        x: finite(projectile.x),
        y: finite(projectile.y),
        vx: finite(projectile.vx),
        vy: finite(projectile.vy),
        stage: String(projectile.stage || ''),
        size: type === 'nuke' ? 1.25 : 0.9,
      });
    }
  }

  for (const escort of snapshot.escorts || []) {
    if (contacts.length >= max) break;
    add({
      id: String(escort.id || `ally-${contacts.length}`),
      kind: 'ally',
      subtype: String(escort.type || ''),
      x: finite(escort.x),
      y: finite(escort.y),
      vx: finite(escort.vx),
      vy: finite(escort.vy),
      size: escort.type === 'b2' ? 1.2 : 0.92,
    });
  }

  for (const projectile of snapshot.projectiles || []) {
    if (contacts.length >= max) break;
    const kind = classifyRadarProjectile(projectile.type);
    if (kind !== 'ciws') continue;
    add({
      id: String(projectile.id || `ciws-${contacts.length}`),
      kind,
      x: finite(projectile.x),
      y: finite(projectile.y),
      vx: finite(projectile.vx),
      vy: finite(projectile.vy),
      stage: String(projectile.stage || ''),
      size: 0.7,
    });
  }

  return Object.freeze(contacts);
}

export function projectRadarContact(contact, telemetry = {}, bounds = {}) {
  const width = Math.max(1, finite(bounds.width, 1));
  const height = Math.max(1, finite(bounds.height, 1));
  const left = finite(bounds.left, 7);
  const right = finite(bounds.right, width - 7);
  const top = finite(bounds.top, 5);
  const bottom = finite(bounds.bottom, height - 8);
  const plotWidth = Math.max(1, right - left);
  const plotHeight = Math.max(1, bottom - top);
  const viewportWidth = Math.max(1, finite(telemetry.viewportWidth, 1));
  const viewportHeight = Math.max(1, finite(telemetry.viewportHeight, 1));
  const xNorm = clamp(finite(contact?.x) / viewportWidth);
  const yNorm = clamp(finite(contact?.y) / viewportHeight);
  const speed = Math.hypot(finite(contact?.vx), finite(contact?.vy));
  const vectorScale = speed > 1e-5 ? Math.min(7, 3 + Math.log2(1 + speed)) / speed : 0;

  return Object.freeze({
    x: left + xNorm * plotWidth,
    y: top + yNorm * plotHeight,
    vx: finite(contact?.vx) * vectorScale,
    vy: finite(contact?.vy) * vectorScale,
    xNorm,
    yNorm,
  });
}

function makeStaticCanvas(canvas) {
  try {
    return canvas.ownerDocument?.createElement?.('canvas') || null;
  } catch {
    return null;
  }
}

function weaponColor(weapon) {
  if (weapon === 'cannon') return PALETTE.ciws;
  return PALETTE[weapon] || '#82eaff';
}

function hexToRgba(hex, alpha) {
  const value = Number.parseInt(String(hex).replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawStaticGrid(ctx, width, height) {
  const left = 7;
  const right = width - 7;
  const top = 5;
  const bottom = height - 8;
  const plotHeight = Math.max(1, bottom - top);
  const background = ctx.createLinearGradient(0, top, 0, bottom);
  background.addColorStop(0, 'rgba(6,25,33,.9)');
  background.addColorStop(0.55, 'rgba(2,13,20,.76)');
  background.addColorStop(1, 'rgba(1,7,12,.92)');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1;
  for (let row = 0; row <= 10; row += 1) {
    const y = top + plotHeight * row / 10;
    ctx.strokeStyle = row % 5 === 0 ? 'rgba(142,233,255,.24)' : 'rgba(142,233,255,.1)';
    ctx.beginPath();
    ctx.moveTo(left, y + 0.5);
    ctx.lineTo(right, y + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(142,233,255,.15)';
  for (const fraction of [0.25, 0.5, 0.75]) {
    const x = left + (right - left) * fraction;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(142,233,255,.34)';
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right, top);
  ctx.stroke();

  // Own-ship datum at the near end of the vertical sensor volume.
  const cx = width * 0.5;
  ctx.fillStyle = 'rgba(216,249,255,.78)';
  ctx.beginPath();
  ctx.moveTo(cx, bottom - 6);
  ctx.lineTo(cx + 3.5, bottom - 1);
  ctx.lineTo(cx, bottom - 2.4);
  ctx.lineTo(cx - 3.5, bottom - 1);
  ctx.closePath();
  ctx.fill();
}

function drawContactGlyph(ctx, track, alpha, scanEnergy) {
  const { x, y, contact } = track;
  const color = PALETTE[contact.kind] || '#82eaff';
  const size = (contact.kind === 'comet' ? 3.7 : contact.kind === 'nuke' ? 3.3 : 2.6)
    * finite(contact.size, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = hexToRgba(color, 0.18 + scanEnergy * 0.34);
  ctx.lineWidth = 0.9 + scanEnergy * 0.8;

  if (scanEnergy > 0.02) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 4 + scanEnergy * 7;
  }

  ctx.beginPath();
  if (contact.kind === 'comet') {
    ctx.moveTo(x, y - size * 1.4);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size * 1.4);
    ctx.lineTo(x - size, y);
    ctx.closePath();
  } else if (contact.kind === 'ally') {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y + size * 0.35);
    ctx.lineTo(x - size, y + size);
    ctx.closePath();
  } else if (contact.kind === 'ciws') {
    ctx.moveTo(x - size * 1.4, y + size * 0.55);
    ctx.lineTo(x + size * 1.4, y - size * 0.55);
  } else if (contact.kind === 'missile') {
    ctx.moveTo(x, y - size * 1.6);
    ctx.lineTo(x + size * 0.7, y + size);
    ctx.lineTo(x, y + size * 0.5);
    ctx.lineTo(x - size * 0.7, y + size);
    ctx.closePath();
  } else if (contact.kind === 'nuke') {
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.moveTo(x - size * 1.55, y);
    ctx.lineTo(x + size * 1.55, y);
    ctx.moveTo(x, y - size * 1.55);
    ctx.lineTo(x, y + size * 1.55);
  } else {
    ctx.rect(x - size, y - size, size * 2, size * 2);
  }
  ctx.fill();
  ctx.stroke();

  if (contact.kind === 'comet') {
    const risk = clamp(finite(contact.risk));
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,83,91,${0.3 + risk * 0.58})`;
    ctx.lineWidth = 0.7 + risk * 0.8;
    if (contact.locked) ctx.setLineDash([2, 1.5]);
    ctx.beginPath();
    ctx.arc(x, y, size * (1.65 + risk * 0.45), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (Math.abs(track.vx) + Math.abs(track.vy) > 0.1) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + track.vx, y + track.vy);
    ctx.stroke();
  }
  ctx.restore();
}

export function createRadarDeck(canvas, options = {}) {
  const {
    maxDpr = 1.75,
    renderCoordinator = getRenderBudgetCoordinator(),
    ResizeObserverClass = globalThis.ResizeObserver,
    measureNow = () => performance.now(),
  } = options;
  let renderPolicy = renderCoordinator.getPolicy({ cost: 'low', targetFps: 30 });
  let active = false;
  const ctx = canvas.getContext('2d');
  const staticCanvas = makeStaticCanvas(canvas);
  const staticCtx = staticCanvas?.getContext?.('2d') || null;
  const state = {
    cssWidth: 1,
    cssHeight: 1,
    dpr: 1,
    lastPaintAt: -Infinity,
    tracks: new Map(),
    lastEventId: 0,
    weaponPulse: null,
  };
  let renderSurface = null;
  let resizeObserver = null;

  function rebuildStaticLayer() {
    if (!staticCanvas || !staticCtx) return;
    staticCanvas.width = Math.max(1, Math.floor(state.cssWidth * state.dpr));
    staticCanvas.height = Math.max(1, Math.floor(state.cssHeight * state.dpr));
    staticCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    staticCtx.clearRect(0, 0, state.cssWidth, state.cssHeight);
    drawStaticGrid(staticCtx, state.cssWidth, state.cssHeight);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = renderPolicy.computeDpr(width, height, { minDpr: 0.75, maxDpr });
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    const changed = canvas.width !== pixelWidth
      || canvas.height !== pixelHeight
      || state.cssWidth !== width
      || state.cssHeight !== height
      || state.dpr !== dpr;
    state.cssWidth = width;
    state.cssHeight = height;
    state.dpr = dpr;
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (changed) rebuildStaticLayer();
    return dpr;
  }

  function consumeWeaponEvents(snapshot, timestamp) {
    let newest = null;
    for (const event of snapshot.events || []) {
      const id = finite(event.id);
      if (id <= state.lastEventId) continue;
      state.lastEventId = Math.max(state.lastEventId, id);
      if (event.type === 'weapon:charge' || event.type === 'weapon:fire' || event.type === 'weapon:impact') {
        newest = event;
      }
    }
    if (!newest) return;
    const duration = newest.type === 'weapon:charge'
      ? clamp(finite(newest.durationMs, 1200), 450, 5000)
      : newest.type === 'weapon:impact' ? 900 : 650;
    state.weaponPulse = {
      type: newest.type,
      weapon: String(newest.weapon || snapshot.fireControl?.activeWeapon || 'cannon'),
      startedAt: timestamp,
      until: timestamp + duration,
    };
  }

  function updateTracks(contacts, snapshot, timestamp, scanY, bounds) {
    for (const contact of contacts) {
      const point = projectRadarContact(contact, snapshot.telemetry, bounds);
      let track = state.tracks.get(contact.id);
      if (!track) {
        track = { contact, x: point.x, y: point.y, vx: point.vx, vy: point.vy, points: [], hitAt: -Infinity, lastSeenAt: timestamp };
        state.tracks.set(contact.id, track);
      }
      track.contact = contact;
      track.x = point.x;
      track.y = point.y;
      track.vx = point.vx;
      track.vy = point.vy;
      track.lastSeenAt = timestamp;
      const previous = track.points[track.points.length - 1];
      if (!previous || timestamp - previous.at >= 120 || Math.hypot(point.x - previous.x, point.y - previous.y) >= 1.5) {
        track.points.push({ x: point.x, y: point.y, at: timestamp });
        if (track.points.length > MAX_TRACK_POINTS) track.points.shift();
      }
      if (Math.abs(point.y - scanY) <= Math.max(4, state.cssHeight / 18)) track.hitAt = timestamp;
    }

    for (const [id, track] of state.tracks) {
      if (timestamp - track.lastSeenAt > TRACK_MEMORY_MS) state.tracks.delete(id);
    }
    while (state.tracks.size > MAX_CONTACTS) {
      const oldest = [...state.tracks.entries()].reduce((candidate, entry) => (
        !candidate || entry[1].lastSeenAt < candidate[1].lastSeenAt ? entry : candidate
      ), null);
      if (!oldest) break;
      state.tracks.delete(oldest[0]);
    }
  }

  function drawTrackHistory(track, alpha) {
    if (track.points.length < 2) return;
    const color = PALETTE[track.contact.kind] || '#82eaff';
    ctx.save();
    ctx.strokeStyle = hexToRgba(color, 0.24 * alpha);
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    track.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawSolution(snapshot, bounds) {
    if (!snapshot.target || !snapshot.solution?.valid || !snapshot.solution.aimPoint) return;
    const target = projectRadarContact(snapshot.target, snapshot.telemetry, bounds);
    const solution = projectRadarContact(snapshot.solution.aimPoint, snapshot.telemetry, bounds);
    ctx.save();
    ctx.strokeStyle = 'rgba(142,233,255,.54)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(target.x, target.y);
    ctx.lineTo(solution.x, solution.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeRect(solution.x - 2, solution.y - 2, 4, 4);
    ctx.restore();
  }

  function drawWeaponPulse(timestamp, bounds) {
    const pulse = state.weaponPulse;
    if (!pulse || timestamp >= pulse.until) {
      state.weaponPulse = null;
      return;
    }
    const duration = Math.max(1, pulse.until - pulse.startedAt);
    const progress = clamp((timestamp - pulse.startedAt) / duration);
    const life = 1 - progress;
    const color = weaponColor(pulse.weapon);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexToRgba(color, 0.18 + life * 0.62);
    ctx.fillStyle = hexToRgba(color, 0.05 + life * 0.16);
    if (pulse.weapon === 'enforcer') {
      const x = state.cssWidth * 0.5;
      ctx.lineWidth = pulse.type === 'weapon:charge' ? 1 + progress * 2.2 : 2.8 * life + 0.7;
      ctx.beginPath();
      ctx.moveTo(x, bounds.bottom);
      ctx.lineTo(x, pulse.type === 'weapon:charge' ? bounds.bottom - (bounds.bottom - bounds.top) * progress : bounds.top);
      ctx.stroke();
    } else if (pulse.weapon === 'nuke') {
      const x = state.cssWidth * 0.5;
      const y = bounds.bottom - (bounds.bottom - bounds.top) * progress;
      const radius = 3 + progress * Math.min(16, state.cssWidth * 0.22);
      ctx.lineWidth = 1.1 + life;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.moveTo(x - radius * 1.35, y);
      ctx.lineTo(x + radius * 1.35, y);
      ctx.moveTo(x, y - radius * 1.35);
      ctx.lineTo(x, y + radius * 1.35);
      ctx.stroke();
    } else if (pulse.weapon === 'missile') {
      const x = bounds.left + (bounds.right - bounds.left) * 0.7;
      const y = bounds.bottom - (bounds.bottom - bounds.top) * progress;
      ctx.lineWidth = 1 + life;
      ctx.beginPath();
      ctx.moveTo(x, bounds.bottom);
      ctx.lineTo(x, y);
      ctx.lineTo(x - 2.5, y + 5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2.5, y + 5);
      ctx.stroke();
    } else {
      const y = bounds.bottom - (bounds.bottom - bounds.top) * progress;
      const span = bounds.right - bounds.left;
      ctx.fillRect(bounds.left, y - 2.6, span * 0.46, 1.4);
      ctx.fillRect(bounds.left + span * 0.54, y, span * 0.46, 1.4);
      ctx.fillRect(bounds.left + span * 0.18, y + 3.2, span * 0.64, 1);
    }
    ctx.restore();
  }

  function paint(timestamp, snapshot) {
    const { cssWidth: width, cssHeight: height, dpr } = state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (staticCanvas) ctx.drawImage(staticCanvas, 0, 0, width, height);
    else drawStaticGrid(ctx, width, height);

    const bounds = { width, height, left: 7, right: width - 7, top: 5, bottom: height - 8 };
    const phase = radarScanPhase(timestamp, renderPolicy);
    const scanY = bounds.top + (bounds.bottom - bounds.top) * phase;
    const rowHeight = Math.max(4, height / 18);
    const activeColor = weaponColor(snapshot.fireControl?.activeWeapon);

    ctx.fillStyle = hexToRgba(activeColor, 0.72);
    ctx.fillRect(1, bounds.top, 1, bounds.bottom - bounds.top);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(118,239,224,.055)';
    ctx.fillRect(bounds.left, scanY - rowHeight * 1.8, bounds.right - bounds.left, rowHeight * 2.2);
    ctx.fillStyle = 'rgba(205,255,247,.72)';
    ctx.fillRect(bounds.left, scanY, bounds.right - bounds.left, 0.8);
    ctx.restore();

    const contacts = collectRadarContacts(snapshot);
    updateTracks(contacts, snapshot, timestamp, scanY, bounds);
    for (const track of state.tracks.values()) {
      const age = timestamp - track.lastSeenAt;
      const alpha = age <= 0 ? 1 : clamp(1 - age / TRACK_MEMORY_MS);
      const scanEnergy = clamp(1 - (timestamp - track.hitAt) / 720);
      drawTrackHistory(track, alpha);
      drawContactGlyph(ctx, track, alpha, scanEnergy);
    }
    drawSolution(snapshot, bounds);
    consumeWeaponEvents(snapshot, timestamp);
    drawWeaponPulse(timestamp, bounds);

    const lock = Math.round(clamp(finite(snapshot.solution?.lockQuality) / 100) * 100);
    const activeWeapon = String(snapshot.fireControl?.activeWeapon || 'cannon').toUpperCase();
    ctx.save();
    ctx.fillStyle = 'rgba(201,246,239,.62)';
    ctx.font = `${Math.max(5.5, Math.min(7, width * 0.075))}px 'JetBrains Mono',monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${activeWeapon.slice(0, 4)} · ${String(lock).padStart(2, '0')}`, 4, height - 1.5);
    ctx.restore();
  }

  renderSurface = renderCoordinator.register({
    id: 'home:radar-deck',
    element: canvas,
    cost: 'low',
    targetFps: 30,
    onResume() { active = true; },
    onPause() { active = false; },
    onResize: resize,
    onQualityChange(nextPolicy) {
      renderPolicy = nextPolicy;
      canvas.dataset.radarQuality = nextPolicy.qualityTier;
      canvas.dataset.radarMotion = nextPolicy.reducedMotion ? 'reduced' : 'full';
      resize();
    },
  });

  if (ResizeObserverClass) {
    resizeObserver = new ResizeObserverClass(() => resize());
    resizeObserver.observe(canvas);
  }

  return {
    canvas,
    ctx,
    state,
    resize,
    render(timestamp, snapshot = {}) {
      if (!active || !ctx) return false;
      const interval = radarFrameInterval(renderPolicy);
      if (timestamp - state.lastPaintAt < interval - 0.5) return false;
      state.lastPaintAt = timestamp;
      const drawStartedAt = measureNow();
      paint(timestamp, snapshot);
      renderSurface?.reportFrame(measureNow() - drawStartedAt);
      return true;
    },
    get active() { return active; },
    destroy() {
      resizeObserver?.disconnect();
      state.tracks.clear();
      renderSurface?.unregister();
    },
  };
}
