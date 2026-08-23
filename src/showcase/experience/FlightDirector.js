import { CHAPTER_IDS, clampProgress } from './scrollTimeline.js';

const ACTIVE_SYSTEM_BY_CHAPTER = Object.freeze({
  '01-cold-void': 'orientation',
  '02-the-approach': 'operating-posture',
  '03-parallel-drift': 'capital-software-intelligence',
  '04-bridge-aperture': 'current-intelligence',
  '05-the-wake': 'field-record',
  '06-departure': 'manifesto',
});

const freezeNode = (node) => Object.freeze({
  ...node,
  cameraPosition: Object.freeze(node.cameraPosition),
  lookAt: Object.freeze(node.lookAt),
});

export const FLIGHT_PATH_NODES = Object.freeze([
  freezeNode({
    id: 'distant-observation',
    label: 'Distant observation',
    progress: 0,
    cameraPosition: [10.8, 4.8, 14.2],
    lookAt: [1.4, 0.15, 4.8],
    fov: 38,
    exposure: 0.84,
    roll: -0.12,
  }),
  freezeNode({
    id: 'bow-approach',
    label: 'Bow approach',
    progress: 0.12,
    cameraPosition: [6.4, 2.35, 9.4],
    lookAt: [0.25, 0.12, 5.9],
    fov: 33,
    exposure: 0.92,
    roll: -0.34,
  }),
  freezeNode({
    id: 'port-side-parallel-drift',
    label: 'Port-side parallel drift',
    progress: 0.28,
    cameraPosition: [-5.4, 1.45, 4.1],
    lookAt: [-0.8, 0.22, 1.8],
    fov: 31,
    exposure: 0.88,
    roll: 0.42,
  }),
  freezeNode({
    id: 'bridge-aperture',
    label: 'Bridge aperture',
    progress: 0.5,
    cameraPosition: [-3.9, 2.2, -0.1],
    lookAt: [0, 0.78, -1.75],
    fov: 29,
    exposure: 1.02,
    roll: 0.58,
  }),
  freezeNode({
    id: 'mid-hull-shadow',
    label: 'Mid-hull shadow',
    progress: 0.68,
    cameraPosition: [-5.1, 0.45, -2.75],
    lookAt: [-0.65, 0.05, -2.95],
    fov: 32,
    exposure: 0.78,
    roll: 0.26,
  }),
  freezeNode({
    id: 'engine-pass',
    label: 'Engine pass',
    progress: 0.84,
    cameraPosition: [-4.25, 0.72, -7.35],
    lookAt: [-1.45, -0.02, -5.05],
    fov: 31,
    exposure: 1.04,
    roll: -0.46,
  }),
  freezeNode({
    id: 'departure-vector',
    label: 'Departure vector',
    progress: 1,
    cameraPosition: [10.8, 6.1, -18.4],
    lookAt: [0, 0.1, -1.4],
    fov: 38,
    exposure: 0.9,
    roll: 0,
  }),
]);

export const MOBILE_FLIGHT_PATH_NODES = Object.freeze([
  freezeNode({ ...FLIGHT_PATH_NODES[1], progress: 0 }),
  freezeNode({ ...FLIGHT_PATH_NODES[2], progress: 0.52 }),
  freezeNode({ ...FLIGHT_PATH_NODES[5], progress: 1 }),
]);

export function flightPathNodesForProfile(profile) {
  return profile === 'mobile' ? MOBILE_FLIGHT_PATH_NODES : FLIGHT_PATH_NODES;
}

export const BASELINE_FLIGHT = Object.freeze({
  cameraPosition: FLIGHT_PATH_NODES[0].cameraPosition,
  exposure: FLIGHT_PATH_NODES[0].exposure,
  fov: FLIGHT_PATH_NODES[0].fov,
  lookAt: FLIGHT_PATH_NODES[0].lookAt,
  roll: FLIGHT_PATH_NODES[0].roll,
});

function finiteOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, finiteOr(value, minimum)));
}

function smoothstep(value) {
  const t = clampProgress(value);
  return t * t * (3 - 2 * t);
}

function catmullRomScalar(p0, p1, p2, p3, value) {
  const t = clampProgress(value);
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1)
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function interpolateVector(nodes, key, index, value) {
  const p0 = nodes[Math.max(0, index - 1)][key];
  const p1 = nodes[index][key];
  const p2 = nodes[index + 1][key];
  const p3 = nodes[Math.min(nodes.length - 1, index + 2)][key];
  return p1.map((coordinate, axis) => catmullRomScalar(
    p0[axis],
    coordinate,
    p2[axis],
    p3[axis],
    value,
  ));
}

function findSegment(progress, nodes = FLIGHT_PATH_NODES) {
  const safeProgress = clampProgress(progress);
  let index = nodes.length - 2;
  for (let cursor = 0; cursor < nodes.length - 1; cursor += 1) {
    if (safeProgress <= nodes[cursor + 1].progress) {
      index = cursor;
      break;
    }
  }
  const from = nodes[index];
  const to = nodes[index + 1];
  const duration = Math.max(0.00001, to.progress - from.progress);
  return {
    from,
    index,
    progress: safeProgress,
    segmentProgress: clampProgress((safeProgress - from.progress) / duration),
    to,
  };
}

export function sampleFlightPath(progress, nodes = FLIGHT_PATH_NODES) {
  const segment = findSegment(progress, nodes);
  const eased = smoothstep(segment.segmentProgress);
  const nearest = segment.segmentProgress < 0.5 ? segment.from : segment.to;
  return {
    cameraPosition: interpolateVector(nodes, 'cameraPosition', segment.index, eased),
    exposure: clamp(
      segment.from.exposure + (segment.to.exposure - segment.from.exposure) * eased,
      0.72,
      1.08,
    ),
    fov: clamp(segment.from.fov + (segment.to.fov - segment.from.fov) * eased, 28, 40),
    lookAt: interpolateVector(nodes, 'lookAt', segment.index, eased),
    nextPathNode: segment.to.id,
    pathNode: nearest.id,
    pathNodeIndex: nodes.indexOf(nearest),
    progress: segment.progress,
    roll: clamp(segment.from.roll + (segment.to.roll - segment.from.roll) * eased, -0.8, 0.8),
    segmentProgress: segment.segmentProgress,
  };
}

export function resolvePointerParallax({
  clientX = 0,
  clientY = 0,
  height = 0,
  maxPixels = 5,
  width = 0,
} = {}) {
  const safeWidth = Math.max(1, finiteOr(width, 1));
  const safeHeight = Math.max(1, finiteOr(height, 1));
  const limit = clamp(Math.abs(maxPixels), 0, 6);
  return Object.freeze({
    x: clamp(((finiteOr(clientX) / safeWidth) * 2 - 1) * limit, -limit, limit),
    y: clamp(((finiteOr(clientY) / safeHeight) * 2 - 1) * limit, -limit, limit),
  });
}

export function flightDebugEnabled({ development = false, search = '' } = {}) {
  if (!development) return false;
  try {
    return new URLSearchParams(search).get('flight-debug') === '1';
  } catch {
    return false;
  }
}

function safeChapterId(value) {
  return CHAPTER_IDS.includes(value) ? value : CHAPTER_IDS[0];
}

function readonlySnapshot(frame) {
  return Object.freeze({
    ...frame,
    cameraPosition: Object.freeze([...frame.cameraPosition]),
    lookAt: Object.freeze([...frame.lookAt]),
  });
}

export function createFlightDirector() {
  let profile = 'high';
  let frame = {
    ...sampleFlightPath(0),
    activeSystem: ACTIVE_SYSTEM_BY_CHAPTER[CHAPTER_IDS[0]],
    chapterCue: CHAPTER_IDS[0],
    chapterIndex: 0,
    direction: 0,
    targetProgress: 0,
  };

  return Object.freeze({
    getSnapshot() {
      return readonlySnapshot(frame);
    },
    update(timelineFrame = {}) {
      const chapterCue = safeChapterId(timelineFrame.chapterId);
      const pathFrame = sampleFlightPath(timelineFrame.progress, flightPathNodesForProfile(profile));
      frame = {
        ...pathFrame,
        activeSystem: ACTIVE_SYSTEM_BY_CHAPTER[chapterCue],
        chapterCue,
        chapterIndex: CHAPTER_IDS.indexOf(chapterCue),
        direction: [-1, 0, 1].includes(timelineFrame.direction) ? timelineFrame.direction : 0,
        targetProgress: clampProgress(timelineFrame.targetProgress),
      };
      return frame;
    },
    setProfile(nextProfile) {
      profile = nextProfile === 'mobile' ? 'mobile' : 'high';
    },
  });
}
