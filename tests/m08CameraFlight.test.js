import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createFlightDirector,
  FLIGHT_PATH_NODES,
  flightDebugEnabled,
  resolvePointerParallax,
  sampleFlightPath,
} from '../src/showcase/experience/FlightDirector.js';
import {
  CARRIER_STATIC_TRANSFORM,
  createCarrierProxy,
} from '../src/showcase/experience/createCarrierProxy.js';

const sceneSource = readFileSync('src/showcase/experience/SignatureScene.jsx', 'utf8');
const rootSource = readFileSync('src/showcase/experience/ExperienceRoot.jsx', 'utf8');

const EXPECTED_ROUTE = [
  ['distant-observation', 0],
  ['bow-approach', 0.12],
  ['port-side-parallel-drift', 0.28],
  ['bridge-aperture', 0.5],
  ['mid-hull-shadow', 0.68],
  ['engine-pass', 0.84],
  ['departure-vector', 1],
];

function projectedCarrierCorners(frame, aspect = 1.44) {
  const carrier = createCarrierProxy(THREE, 'high');
  carrier.group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(carrier.group);
  const camera = new THREE.PerspectiveCamera(frame.fov, aspect, 0.05, 120);
  camera.position.fromArray(frame.cameraPosition);
  camera.lookAt(...frame.lookAt);
  camera.rotateZ(THREE.MathUtils.degToRad(frame.roll));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corners.push(new THREE.Vector3(x, y, z).project(camera));
      }
    }
  }
  return corners;
}

function fullyFramed(corners) {
  return corners.every(({ x, y, z }) => (
    Math.abs(x) <= 1 && Math.abs(y) <= 1 && z >= -1 && z <= 1
  ));
}

describe('M08 camera flight route', () => {
  it('defines the seven ordered composition nodes at the approved boundaries', () => {
    expect(FLIGHT_PATH_NODES.map(({ id, progress }) => [id, progress])).toEqual(EXPECTED_ROUTE);
    expect(FLIGHT_PATH_NODES.every(Object.isFrozen)).toBe(true);
  });

  it('hits every authored keyframe and respects the FOV and roll guardrails', () => {
    for (const node of FLIGHT_PATH_NODES) {
      const frame = sampleFlightPath(node.progress);
      frame.cameraPosition.forEach((value, axis) => expect(value).toBeCloseTo(node.cameraPosition[axis], 10));
      frame.lookAt.forEach((value, axis) => expect(value).toBeCloseTo(node.lookAt[axis], 10));
      expect(frame.exposure).toBeCloseTo(node.exposure, 10);
      expect(frame.fov).toBeCloseTo(node.fov, 10);
      expect(frame.progress).toBe(node.progress);
      expect(frame.roll).toBeCloseTo(node.roll, 10);
    }

    for (let index = 0; index <= 1000; index += 1) {
      const frame = sampleFlightPath(index / 1000);
      expect([...frame.cameraPosition, ...frame.lookAt, frame.fov, frame.exposure, frame.roll].every(Number.isFinite)).toBe(true);
      expect(frame.fov).toBeGreaterThanOrEqual(28);
      expect(frame.fov).toBeLessThanOrEqual(40);
      expect(Math.abs(frame.roll)).toBeLessThanOrEqual(0.8);
    }
  });

  it('is continuous across boundaries and deterministic in reverse', () => {
    const epsilon = 0.00001;
    for (const node of FLIGHT_PATH_NODES.slice(1, -1)) {
      const before = sampleFlightPath(node.progress - epsilon);
      const after = sampleFlightPath(node.progress + epsilon);
      const deltas = [
        ...before.cameraPosition.map((value, axis) => Math.abs(value - after.cameraPosition[axis])),
        ...before.lookAt.map((value, axis) => Math.abs(value - after.lookAt[axis])),
        Math.abs(before.fov - after.fov),
        Math.abs(before.roll - after.roll),
      ];
      expect(Math.max(...deltas)).toBeLessThan(0.001);
    }

    const forward = [0, 0.17, 0.39, 0.63, 0.88, 1].map((progress) => sampleFlightPath(progress));
    const reverse = [1, 0.88, 0.63, 0.39, 0.17, 0].map((progress) => sampleFlightPath(progress)).reverse();
    expect(reverse).toEqual(forward);
  });

  it('keeps the carrier cropped through the first 70% and reveals it on departure', () => {
    for (let index = 0; index <= 70; index += 2) {
      expect(fullyFramed(projectedCarrierCorners(sampleFlightPath(index / 100)))).toBe(false);
    }
    expect(fullyFramed(projectedCarrierCorners(sampleFlightPath(1)))).toBe(true);
  });

  it('keeps camera motion primary and the carrier transform invariant', () => {
    const carrier = createCarrierProxy(THREE, 'medium');
    expect(carrier.group.position.toArray()).toEqual(CARRIER_STATIC_TRANSFORM.position);
    expect(carrier.group.rotation.toArray().slice(0, 3)).toEqual(CARRIER_STATIC_TRANSFORM.rotation);
    expect(carrier.group.scale.toArray()).toEqual([1.18, 1.18, 1.18]);
    expect(carrier.triangleCount).toBeLessThan(5000);
    expect(sceneSource).not.toContain('OrbitControls');
    const renderBody = sceneSource.slice(sceneSource.indexOf('const render ='), sceneSource.indexOf('const start ='));
    expect(renderBody).not.toMatch(/carrier\.(?:group\.)?rotation\s*[.=]/);
    expect(sceneSource).toContain("host.dataset.shipMotion = 'camera-only'");
  });

  it('bounds pointer parallax without changing the sampled route', () => {
    expect(resolvePointerParallax({ clientX: 0, clientY: 0, width: 1000, height: 800 })).toEqual({ x: -5, y: -5 });
    expect(resolvePointerParallax({ clientX: 1000, clientY: 800, width: 1000, height: 800 })).toEqual({ x: 5, y: 5 });
    expect(resolvePointerParallax({ clientX: 5000, clientY: -5000, width: 1000, height: 800, maxPixels: 20 })).toEqual({ x: 6, y: -6 });
    const before = sampleFlightPath(0.43);
    resolvePointerParallax({ clientX: 12, clientY: 34, width: 100, height: 100 });
    expect(sampleFlightPath(0.43)).toEqual(before);
  });

  it('exposes the overlay only behind the development query gate', () => {
    expect(flightDebugEnabled({ development: true, search: '?flight-debug=1' })).toBe(true);
    expect(flightDebugEnabled({ development: false, search: '?flight-debug=1' })).toBe(false);
    expect(flightDebugEnabled({ development: true, search: '?flight-debug=0' })).toBe(false);
    expect(rootSource).toContain('development: import.meta.env.DEV');
  });

  it('keeps raw chapter cues while the camera follows smoothed progress', () => {
    const director = createFlightDirector();
    const frame = director.update({
      chapterId: '06-departure',
      direction: 1,
      progress: 0.33,
      targetProgress: 1,
    });
    expect(frame).toMatchObject({
      chapterCue: '06-departure',
      pathNode: sampleFlightPath(0.33).pathNode,
      progress: 0.33,
      targetProgress: 1,
    });
  });
});
