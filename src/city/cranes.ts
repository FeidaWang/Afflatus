import { rngFromString } from '../bootengine/seed';
import type { CityBounds, CityPlan, CityPoint, CitySchedule } from './model';

export type CityCraneDetail = 'high' | 'medium' | 'silhouette';
export type CityCraneTone = 'orange' | 'pale' | 'dark';
export type CityCranePriority = 'flagship' | 'hero' | 'large-building';
export const CITY_MAX_ACTIVE_CRANES = 6;

export interface CityCranePlan {
  id: string;
  ownerId: string;
  priority: CityCranePriority;
  position: Readonly<CityPoint>;
  rotationY: number;
  maxMastHeight: number;
  jibLength: number;
  counterJibLength: number;
  retreatDays: number;
  motionPhase: number;
  schedule: Readonly<CitySchedule>;
}

export interface CityCraneState {
  visible: boolean;
  mastHeight: number;
  baseY: number;
  retreatProgress: number;
  trolleyDistance: number;
  hookDrop: number;
}

export interface CityCraneBoxPart {
  id: string;
  craneId: string;
  tone: CityCraneTone;
  position: Readonly<CityPoint>;
  scale: Readonly<CityPoint>;
  rotationY: number;
}

export interface CityCraneLinePart {
  craneId: string;
  from: Readonly<CityPoint>;
  to: Readonly<CityPoint>;
}

export interface CityCraneRenderPlan {
  activeCraneIds: readonly string[];
  boxes: readonly CityCraneBoxPart[];
  lines: readonly CityCraneLinePart[];
}

type CraneOwner = {
  id: string;
  position: CityPoint;
  bounds: CityBounds;
  schedule: CitySchedule;
  priority: CityCranePriority;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ease = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const CRANE_PRIORITY_ORDER: Readonly<Record<CityCranePriority, number>> = Object.freeze({
  flagship: 0,
  hero: 1,
  'large-building': 2,
});

function staysWithinActiveBudget(cranes: readonly CityCranePlan[]): boolean {
  const events = cranes.flatMap((crane) => [
    { day: crane.schedule.startDay, delta: 1 },
    { day: crane.schedule.endDay + crane.retreatDays, delta: -1 },
  ]).sort((left, right) => left.day - right.day || left.delta - right.delta);
  let active = 0;
  for (const event of events) {
    active += event.delta;
    if (active > CITY_MAX_ACTIVE_CRANES) return false;
  }
  return true;
}

/** Landmark cranes plus a bounded candidate pool for the largest ordinary sites. */
export function createCityCranePlans(plan: CityPlan): readonly CityCranePlan[] {
  const cbd = plan.buildings.find((building) => building.id === plan.landmarkId);
  const largeBuildings = plan.buildings
    .filter((building) => building.id !== plan.landmarkId && building.bounds.height >= 58)
    .sort((left, right) => (
      right.bounds.height - left.bounds.height
      || left.id.localeCompare(right.id)
    ))
    .slice(0, 8);
  const owners: CraneOwner[] = [
    ...(cbd ? [{ ...cbd, priority: 'flagship' as const }] : []),
    ...plan.heroLandmarks.map((landmark) => ({ ...landmark, priority: 'hero' as const })),
    ...largeBuildings.map((building) => ({ ...building, priority: 'large-building' as const })),
  ];

  const candidates = owners.map((owner) => {
    const rng = rngFromString(`${plan.seed}:crane:${owner.id}`);
    const angle = rng() * Math.PI * 2;
    const clearance = Math.max(owner.bounds.width, owner.bounds.depth) * 0.5 + 5;
    const position = Object.freeze({
      x: owner.position.x + Math.cos(angle) * clearance,
      y: 0,
      z: owner.position.z + Math.sin(angle) * clearance,
    });
    const toOwnerX = owner.position.x - position.x;
    const toOwnerZ = owner.position.z - position.z;
    return Object.freeze({
      id: `crane-${owner.id}`,
      ownerId: owner.id,
      priority: owner.priority,
      position,
      rotationY: Math.atan2(-toOwnerZ, toOwnerX),
      maxMastHeight: owner.bounds.height + 16,
      jibLength: Math.max(34, Math.max(owner.bounds.width, owner.bounds.depth) * 1.55),
      counterJibLength: 11 + rng() * 3,
      retreatDays: 10 + rng() * 4,
      motionPhase: rng() * Math.PI * 2,
      schedule: Object.freeze({ ...owner.schedule }),
    });
  });
  const required = candidates.filter((crane) => crane.priority !== 'large-building');
  const selected = [...required];
  for (const candidate of candidates.filter((crane) => crane.priority === 'large-building')) {
    if (staysWithinActiveBudget([...selected, candidate])) selected.push(candidate);
  }
  return Object.freeze(selected);
}

/** Reversible lifecycle: completed cranes remain present while lowering below grade. */
export function cityCraneStateAt(crane: CityCranePlan, rawDay: number): Readonly<CityCraneState> {
  const day = Number.isFinite(rawDay) ? rawDay : 0;
  if (day < crane.schedule.startDay || day >= crane.schedule.endDay + crane.retreatDays) {
    return Object.freeze({
      visible: false,
      mastHeight: 0,
      baseY: 0,
      retreatProgress: day >= crane.schedule.endDay ? 1 : 0,
      trolleyDistance: 0,
      hookDrop: 0,
    });
  }

  const duration = Math.max(0.001, crane.schedule.endDay - crane.schedule.startDay);
  const buildProgress = clamp01((day - crane.schedule.startDay) / duration);
  const retreatProgress = day <= crane.schedule.endDay
    ? 0
    : clamp01((day - crane.schedule.endDay) / crane.retreatDays);
  const mastHeight = Math.max(18, crane.maxMastHeight * Math.min(1, buildProgress + 0.18));
  const motion = 0.5 + 0.5 * Math.sin(day * 0.18 + crane.motionPhase);

  return Object.freeze({
    visible: true,
    mastHeight,
    baseY: -ease(retreatProgress) * (crane.maxMastHeight + 18),
    retreatProgress,
    trolleyDistance: crane.jibLength * (0.22 + motion * 0.5),
    hookDrop: 8 + motion * Math.max(9, crane.maxMastHeight * 0.23),
  });
}

function rotateLocal(crane: CityCranePlan, x: number, y: number, z: number): CityPoint {
  const cosine = Math.cos(crane.rotationY);
  const sine = Math.sin(crane.rotationY);
  return {
    x: crane.position.x + x * cosine + z * sine,
    y,
    z: crane.position.z - x * sine + z * cosine,
  };
}

/** Compiles every visible crane into three shared box batches plus one line buffer. */
export function createCityCraneRenderPlan(
  cranes: readonly CityCranePlan[],
  day: number,
  detail: CityCraneDetail = 'high',
): Readonly<CityCraneRenderPlan> {
  const boxes: CityCraneBoxPart[] = [];
  const lines: CityCraneLinePart[] = [];
  const activeCraneIds: string[] = [];
  const selected = cranes
    .map((crane) => ({ crane, state: cityCraneStateAt(crane, day) }))
    .filter((entry) => entry.state.visible)
    .sort((left, right) => (
      CRANE_PRIORITY_ORDER[left.crane.priority] - CRANE_PRIORITY_ORDER[right.crane.priority]
      || right.crane.maxMastHeight - left.crane.maxMastHeight
      || left.crane.id.localeCompare(right.crane.id)
    ))
    .slice(0, CITY_MAX_ACTIVE_CRANES);

  for (const { crane, state } of selected) {
    activeCraneIds.push(crane.id);
    const top = state.baseY + state.mastHeight;

    const addBox = (
      id: string,
      tone: CityCraneTone,
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      rotationOffset = 0,
    ) => {
      boxes.push(Object.freeze({
        id: `${crane.id}-${id}`,
        craneId: crane.id,
        tone,
        position: Object.freeze(rotateLocal(crane, x, y, z)),
        scale: Object.freeze({ x: width, y: height, z: depth }),
        rotationY: crane.rotationY + rotationOffset,
      }));
    };
    const addLine = (from: CityPoint, to: CityPoint) => {
      lines.push(Object.freeze({
        craneId: crane.id,
        from: Object.freeze(rotateLocal(crane, from.x, from.y, from.z)),
        to: Object.freeze(rotateLocal(crane, to.x, to.y, to.z)),
      }));
    };

    if (detail === 'silhouette') {
      addBox('mast-silhouette', 'orange', 0, state.baseY + state.mastHeight / 2, 0, 1.45, state.mastHeight, 1.45);
      addBox('jib-silhouette', 'orange', crane.jibLength * 0.34, top + 1.4, 0, crane.jibLength + crane.counterJibLength, 0.55, 0.6);
      addBox('counterweight-silhouette', 'pale', -crane.counterJibLength + 1.2, top + 0.6, 0, 3.2, 2.5, 2.2);
      continue;
    }

    for (const x of [-0.72, 0.72]) {
      for (const z of [-0.72, 0.72]) {
        addBox(`mast-post-${x}-${z}`, 'orange', x, state.baseY + state.mastHeight / 2, z, 0.24, state.mastHeight, 0.24);
      }
    }

    const levelCount = detail === 'high' ? 7 : 4;
    for (let level = 0; level <= levelCount; level += 1) {
      const y = state.baseY + state.mastHeight * (level / levelCount);
      addBox(`mast-x-${level}-a`, 'orange', 0, y, -0.72, 1.7, 0.14, 0.16);
      addBox(`mast-x-${level}-b`, 'orange', 0, y, 0.72, 1.7, 0.14, 0.16);
      addBox(`mast-z-${level}-a`, 'orange', -0.72, y, 0, 1.7, 0.14, 0.16, Math.PI / 2);
      addBox(`mast-z-${level}-b`, 'orange', 0.72, y, 0, 1.7, 0.14, 0.16, Math.PI / 2);
      if (detail === 'high' && level < levelCount) {
        const nextY = state.baseY + state.mastHeight * ((level + 1) / levelCount);
        addLine({ x: -0.72, y, z: -0.73 }, { x: 0.72, y: nextY, z: -0.73 });
        addLine({ x: 0.72, y, z: 0.73 }, { x: -0.72, y: nextY, z: 0.73 });
        addLine({ x: -0.73, y, z: 0.72 }, { x: -0.73, y: nextY, z: -0.72 });
        addLine({ x: 0.73, y, z: -0.72 }, { x: 0.73, y: nextY, z: 0.72 });
      }
    }

    addBox('top-platform', 'pale', 0, top + 0.2, 0, 3.5, 0.36, 3.2);
    addBox('slew-column', 'orange', 0, top + 1.1, 0, 1.05, 1.8, 1.05);
    addBox('jib-rail-left', 'orange', crane.jibLength / 2, top + 2.1, -0.52, crane.jibLength, 0.2, 0.2);
    addBox('jib-rail-right', 'orange', crane.jibLength / 2, top + 2.1, 0.52, crane.jibLength, 0.2, 0.2);
    addBox('jib-top', 'orange', crane.jibLength * 0.46, top + 4.3, 0, crane.jibLength * 0.92, 0.18, 0.18);
    addBox('counter-jib', 'orange', -crane.counterJibLength / 2, top + 2.1, 0, crane.counterJibLength, 0.3, 0.65);
    addBox('counterweight', 'pale', -crane.counterJibLength + 1.1, top + 1.25, 0, 3.1, 2.7, 2.4);

    const jibSections = detail === 'high' ? 7 : 4;
    for (let section = 0; section <= jibSections; section += 1) {
      const x = crane.jibLength * (section / jibSections);
      addBox(`jib-hanger-${section}`, 'orange', x, top + 3.15, 0, 0.15, 2.1, 0.15);
      if (detail === 'high' && section < jibSections) {
        const nextX = crane.jibLength * ((section + 1) / jibSections);
        addLine({ x, y: top + 2.2, z: -0.54 }, { x: nextX, y: top + 4.2, z: -0.05 });
        addLine({ x, y: top + 4.2, z: 0.05 }, { x: nextX, y: top + 2.2, z: 0.54 });
      }
    }

    addBox('cab-platform', 'pale', -1.55, top + 1.05, -1.45, 3.2, 0.25, 2.5);
    addBox('cab-body', 'pale', -1.65, top + 2.25, -1.45, 2.7, 2.4, 2.25);
    addBox('cab-roof', 'orange', -1.65, top + 3.62, -1.45, 3.15, 0.28, 2.65);
    addBox('cab-front-glass', 'dark', -0.27, top + 2.38, -1.45, 0.08, 1.45, 1.72);
    if (detail === 'high') {
      addBox('cab-side-glass-a', 'dark', -1.65, top + 2.38, -0.3, 1.7, 1.45, 0.08);
      addBox('cab-side-glass-b', 'dark', -1.65, top + 2.38, -2.6, 1.7, 1.45, 0.08);
      addBox('trolley', 'orange', state.trolleyDistance, top + 1.75, 0, 1.2, 0.55, 1.15);
      const hookY = Math.max(state.baseY + 3, top + 1.3 - state.hookDrop);
      addBox('hook-block', 'dark', state.trolleyDistance, hookY, 0, 0.55, 0.9, 0.55);
      addLine(
        { x: state.trolleyDistance, y: top + 1.7, z: -0.18 },
        { x: state.trolleyDistance, y: hookY + 0.45, z: -0.18 },
      );
      addLine(
        { x: state.trolleyDistance, y: top + 1.7, z: 0.18 },
        { x: state.trolleyDistance, y: hookY + 0.45, z: 0.18 },
      );
      addLine(
        { x: state.trolleyDistance, y: hookY - 0.45, z: 0 },
        { x: state.trolleyDistance + 0.7, y: hookY - 1.2, z: 0 },
      );
    }
  }

  return Object.freeze({
    activeCraneIds: Object.freeze(activeCraneIds),
    boxes: Object.freeze(boxes),
    lines: Object.freeze(lines),
  });
}
