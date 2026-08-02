import { clamp } from '../utils/math.js';

const DEFAULT_PROJECTILE_SPEED = Object.freeze({
  cannon: 1.9,
  missile: 0.62,
  nuke: 0.4,
  enforcer: Infinity,
});

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function point(value = {}) {
  return Object.freeze({ x: finite(value.x), y: finite(value.y) });
}

/**
 * Constant-velocity fire-control solution in screen-space units.
 * Positions are CSS pixels, velocity is px/ms and projectileSpeed is px/ms.
 * This is the same coordinate system used by the live combat simulation, so
 * the lead marker, radar and weapon launch all agree without a display-only
 * approximation.
 */
export function solveIntercept({
  shooter = { x: 0, y: 0 },
  target = { x: 0, y: 0 },
  velocity = { x: 0, y: 0 },
  projectileSpeed,
  maxTimeMs = 20_000,
} = {}) {
  const origin = point(shooter);
  const contact = point(target);
  const v = point(velocity);
  const speed = Number(projectileSpeed);
  if (speed === Infinity) {
    return Object.freeze({
      valid: true,
      interceptMs: 0,
      aimPoint: contact,
      leadPx: 0,
      missDistancePx: 0,
    });
  }
  if (!Number.isFinite(speed) || speed <= 0) {
    return Object.freeze({
      valid: false,
      interceptMs: null,
      aimPoint: contact,
      leadPx: 0,
      missDistancePx: null,
    });
  }

  const rx = contact.x - origin.x;
  const ry = contact.y - origin.y;
  const a = v.x * v.x + v.y * v.y - speed * speed;
  const b = 2 * (rx * v.x + ry * v.y);
  const c = rx * rx + ry * ry;
  let time = null;

  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9) {
      const root = -c / b;
      if (root >= 0) time = root;
    }
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const sqrt = Math.sqrt(discriminant);
      const roots = [(-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a)]
        .filter((root) => root >= 0)
        .sort((left, right) => left - right);
      time = roots[0] ?? null;
    }
  }

  if (time === null || time > maxTimeMs) {
    return Object.freeze({
      valid: false,
      interceptMs: null,
      aimPoint: contact,
      leadPx: 0,
      missDistancePx: null,
    });
  }

  const aimPoint = point({
    x: contact.x + v.x * time,
    y: contact.y + v.y * time,
  });
  return Object.freeze({
    valid: true,
    interceptMs: Math.round(time),
    aimPoint,
    leadPx: Math.hypot(aimPoint.x - contact.x, aimPoint.y - contact.y),
    missDistancePx: 0,
  });
}

function copyTarget(target) {
  if (!target || target.destroyed) return null;
  return Object.freeze({
    id: String(target.id || '1P/HALLEY'),
    x: finite(target.x),
    y: finite(target.y),
    vx: finite(target.vx),
    vy: finite(target.vy),
    hp: Math.max(0, finite(target.hp)),
    hpMax: Math.max(1, finite(target.hpMax, 1)),
    sizeClass: String(target.sizeClass || 'unknown'),
    radius: Math.max(1, finite(target.radius, 40)),
    speedKms: Math.max(0, finite(target.speedKms)),
    headingDeg: ((finite(target.headingDeg) % 360) + 360) % 360,
    collisionRisk: clamp(finite(target.collisionRisk), 0, 1),
    lockProgress: clamp(finite(target.lockProgress), 0, 1),
    locked: Boolean(target.locked),
    destroyed: false,
  });
}

function copyList(items, mapper) {
  return Object.freeze((Array.isArray(items) ? items : []).map(mapper));
}

/**
 * The single authoritative presentation state for the CIC.
 *
 * The simulation still owns its mutable entities. It synchronises them here
 * once per frame; all HUD/render consumers receive the immutable snapshot.
 * Named events are retained briefly so low-frequency renderers can consume
 * every weapon/camera/feed cue exactly once.
 */
export function createCombatState({ now = Date.now, eventLimit = 96 } = {}) {
  let revision = 0;
  let eventId = 0;
  let events = [];
  let snapshot = Object.freeze({
    revision,
    now: now(),
    phase: 'standby',
    fireControl: Object.freeze({ mode: 'auto', selectedWeapon: 'auto', activeWeapon: 'cannon' }),
    target: null,
    projectiles: Object.freeze([]),
    escorts: Object.freeze([]),
    fleet: Object.freeze({ hpPct: 100, ammoPct: 100, deckPct: 100, kills: 0, giantKills: 0 }),
    telemetry: Object.freeze({
      headingDeg: null,
      speedKms: null,
      gLoad: null,
      frameP95Ms: 0,
      drawCalls: 0,
      triangles: 0,
      qualityTier: 'high',
      thermalState: 'nominal',
      viewportWidth: 1,
      viewportHeight: 1,
    }),
    solution: Object.freeze({
      weapon: 'cannon',
      valid: false,
      interceptMs: null,
      aimPoint: null,
      rangePx: null,
      leadPx: 0,
      missDistancePx: null,
      lockQuality: 0,
    }),
    events: Object.freeze([]),
  });

  function emit(type, payload = {}, at = now()) {
    const event = Object.freeze({
      id: ++eventId,
      type: String(type),
      at: finite(at, now()),
      ...payload,
    });
    events = [...events, event].slice(-eventLimit);
    return event;
  }

  function sync(input = {}) {
    revision += 1;
    const target = copyTarget(input.target);
    const activeWeapon = String(input.fireControl?.activeWeapon || 'cannon');
    const speed = finite(
      input.projectileSpeeds?.[activeWeapon],
      DEFAULT_PROJECTILE_SPEED[activeWeapon],
    );
    const rawSolution = target
      ? solveIntercept({
        shooter: input.shooter,
        target,
        velocity: { x: target.vx, y: target.vy },
        projectileSpeed: activeWeapon === 'enforcer' ? Infinity : speed,
      })
      : solveIntercept({ projectileSpeed: 0 });
    const lockQuality = target
      ? Math.round(clamp(target.lockProgress * (rawSolution.valid ? 1 : 0), 0, 1) * 100)
      : 0;
    const telemetry = input.telemetry || {};

    snapshot = Object.freeze({
      revision,
      now: finite(input.now, now()),
      phase: String(input.phase || 'standby'),
      fireControl: Object.freeze({
        mode: input.fireControl?.mode === 'manual' ? 'manual' : 'auto',
        selectedWeapon: String(input.fireControl?.selectedWeapon || 'auto'),
        activeWeapon,
      }),
      target,
      projectiles: copyList(input.projectiles, (item) => Object.freeze({
        id: String(item.id || ''),
        type: String(item.type || 'unknown'),
        stage: String(item.stage || ''),
        x: finite(item.x),
        y: finite(item.y),
        vx: finite(item.vx),
        vy: finite(item.vy),
      })),
      escorts: copyList(input.escorts, (item) => Object.freeze({
        id: String(item.id || ''),
        type: String(item.type || 'unknown'),
        state: String(item.state || 'standby'),
        x: finite(item.x),
        y: finite(item.y),
        vx: finite(item.vx),
        vy: finite(item.vy),
        hp: clamp(finite(item.hp, 100), 0, 100),
      })),
      fleet: Object.freeze({
        hpPct: clamp(finite(input.fleet?.hpPct, 100), 0, 100),
        ammoPct: clamp(finite(input.fleet?.ammoPct, 100), 0, 100),
        deckPct: clamp(finite(input.fleet?.deckPct, 100), 0, 100),
        kills: Math.max(0, Math.trunc(finite(input.fleet?.kills))),
        giantKills: Math.max(0, Math.trunc(finite(input.fleet?.giantKills))),
      }),
      telemetry: Object.freeze({
        headingDeg: Number.isFinite(telemetry.headingDeg) ? ((telemetry.headingDeg % 360) + 360) % 360 : null,
        speedKms: Number.isFinite(telemetry.speedKms) ? Math.max(0, telemetry.speedKms) : null,
        gLoad: Number.isFinite(telemetry.gLoad) ? Math.max(0, telemetry.gLoad) : null,
        frameP95Ms: Math.max(0, finite(telemetry.frameP95Ms)),
        drawCalls: Math.max(0, Math.trunc(finite(telemetry.drawCalls))),
        triangles: Math.max(0, Math.trunc(finite(telemetry.triangles))),
        qualityTier: String(telemetry.qualityTier || 'high'),
        thermalState: String(telemetry.thermalState || 'nominal'),
        viewportWidth: Math.max(1, finite(telemetry.viewportWidth, 1)),
        viewportHeight: Math.max(1, finite(telemetry.viewportHeight, 1)),
      }),
      solution: Object.freeze({
        weapon: activeWeapon,
        ...rawSolution,
        rangePx: target ? Math.hypot(
          target.x - finite(input.shooter?.x),
          target.y - finite(input.shooter?.y),
        ) : null,
        lockQuality,
      }),
      events: Object.freeze([...events]),
    });
    return snapshot;
  }

  return Object.freeze({
    emit,
    sync,
    getSnapshot: () => snapshot,
    eventsAfter(lastId = 0) {
      return events.filter((event) => event.id > lastId);
    },
  });
}
