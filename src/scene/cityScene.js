import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cityHelicopterPoseAt, createCityHelicopterRig } from '../city/airTraffic.ts';
import { createCityAssetInventory } from '../city/assetInventory.ts';
import { createCityAssetVisibility } from '../city/assetVisibility.ts';
import {
  CITY_TOUR_BASE_FOV,
  cityTourPresentationAt,
  constructionProgressToTourProgress,
  createCityCameraRig,
  createCityTourFocusPath,
  createCityTourPath,
  createCityTourTimeline,
} from '../city/camera.ts';
import {
  createCityTourSafetyField,
  resolveCityTourClearance,
} from '../city/cameraSafety.ts';
import {
  CITY_MAX_ACTIVE_CRANES,
  createCityCranePlans,
  createCityCraneRenderPlan,
} from '../city/cranes.ts';
import { createCityEnvironmentVisibility } from '../city/environment.ts';
import { createCityFacadePlan } from '../city/facades.ts';
import { createCityHeroRenderPlan } from '../city/landmarks.ts';
import { createCityLeisurePlan } from '../city/leisure.ts';
import { createCityRooftopPlan } from '../city/rooftops.ts';
import { createCityRidgeMeshData } from '../city/ridge.ts';
import {
  CITY_SCENE_RENDER_BUDGET,
  cityBudgetClassForDevice,
  evaluateCityRenderBudget,
} from '../city/budget.ts';
import {
  appendBoxEdges,
  appendEllipsoidLines,
  appendEllipticCylinderLines,
  appendEllipticFrustumLines,
} from '../city/outlines.ts';
import {
  cityVehicleReadyAt,
  constructionStateAt,
  roadProgressAt,
} from '../city/schedule.ts';
import { projectedDiameterPx, selectProceduralLod } from '../lib/proceduralLod.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import { createWebGLContextLifecycle, disposeThreeScene } from '../lib/webglLifecycle.js';

const HIDDEN_SCALE = 0.0001;
const INSTANCE_MATRIX = new THREE.Matrix4();
const INSTANCE_QUATERNION = new THREE.Quaternion();
const INSTANCE_EULER = new THREE.Euler();
const INSTANCE_POSITION = new THREE.Vector3();
const INSTANCE_SCALE = new THREE.Vector3();
const CURVE_LINE_OPTIONS = Object.freeze({
  high: Object.freeze({
    radialSegments: 12,
    verticalLines: 8,
    ringFractions: Object.freeze([0, 0.25, 0.5, 0.75, 1]),
  }),
  medium: Object.freeze({
    radialSegments: 8,
    verticalLines: 4,
    ringFractions: Object.freeze([0, 0.5, 1]),
  }),
});

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const ease = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export const createCitySceneAssetInventory = createCityAssetInventory;

function setInstance(mesh, index, position, scale, rotationY = 0) {
  INSTANCE_EULER.set(0, rotationY, 0);
  INSTANCE_QUATERNION.setFromEuler(INSTANCE_EULER);
  INSTANCE_POSITION.set(position.x, position.y, position.z);
  INSTANCE_SCALE.set(
    Math.max(HIDDEN_SCALE, scale.x),
    Math.max(HIDDEN_SCALE, scale.y),
    Math.max(HIDDEN_SCALE, scale.z),
  );
  INSTANCE_MATRIX.compose(INSTANCE_POSITION, INSTANCE_QUATERNION, INSTANCE_SCALE);
  mesh.setMatrixAt(index, INSTANCE_MATRIX);
}

function hideInstance(mesh, index) {
  setInstance(mesh, index, { x: 0, y: -500, z: 0 }, {
    x: HIDDEN_SCALE,
    y: HIDDEN_SCALE,
    z: HIDDEN_SCALE,
  });
}

function createDynamicLineGeometry(floatCapacity) {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(
    new Float32Array(Math.max(3, Math.ceil(floatCapacity / 3) * 3)),
    3,
  );
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setDrawRange(0, 0);
  return geometry;
}

function updateDynamicLineGeometry(geometry, positions) {
  const position = geometry.getAttribute('position');
  if (positions.length > position.array.length) {
    throw new Error(`City line buffer capacity exceeded (${positions.length}/${position.array.length}).`);
  }
  position.array.set(positions, 0);
  position.clearUpdateRanges();
  position.addUpdateRange(0, positions.length);
  position.needsUpdate = true;
  geometry.setDrawRange(0, positions.length / 3);
}

const lineSegmentCount = (geometry) => (
  Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count / 2 : 0
);

export function createCitySceneRenderer({
  canvas,
  renderPlan,
  initialDay = 0,
  initialAssetVisibility = {},
  onDayChange = () => {},
  onPlaybackChange = () => {},
  onTourChange = () => {},
  onFallback = () => {},
} = {}) {
  if (!canvas) throw new Error('City scene requires a canvas.');
  if (!renderPlan) throw new Error('City scene requires a render plan.');
  const plan = renderPlan;

  let renderer = null;
  let budgetSurface = null;
  let budgetPolicy = null;
  let raf = 0;
  let restoreRaf = 0;
  let running = false;
  let initialized = false;
  let destroyed = false;
  let resumeRequested = false;
  let currentDay = Math.min(plan.profile.totalDays, Math.max(0, initialDay));
  let renderedDay = -1;
  let announcedDay = -1;
  let playing = false;
  let tourActive = false;
  let lastTime = 0;
  let elapsed = 0;
  let cityLod = '';
  let heroViewIndex = -1;
  let tourNarrativeProgress = 0;
  let tourPhase = 'idle';
  let tourClearanceLift = 0;
  let activeCraneCount = 0;
  let visibleTreeCount = 0;
  let visibleVehicleCount = 0;
  let visibleLeisureAssetCount = 0;
  let renderedRoadCount = 0;
  let renderedBuildingShellCount = 0;
  let renderedBuildingRoofCount = 0;
  let renderedBuildingSkeletonPartCount = 0;
  let renderedBuildingSlabCount = 0;
  let renderedRooftopAssetCount = 0;
  let renderedRooftopKindCounts = Object.freeze({});
  let renderedHeroComponentCount = 0;
  let renderedHeroRoofCount = 0;
  let renderedHeroSkeletonPartCount = 0;
  let renderedHeroSlabCount = 0;
  let currentEnvironmentTime = 0;
  let lastStaticVehicleKey = '';
  let assetVisibility = createCityAssetVisibility(initialAssetVisibility);
  let start = () => {};
  let resize = () => {};
  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (restoreRaf) cancelAnimationFrame(restoreRaf);
    raf = 0;
    restoreRaf = 0;
  };
  const coordinator = getRenderBudgetCoordinator();
  const budgetClass = cityBudgetClassForDevice(
    window.innerWidth,
    window.matchMedia?.('(pointer: coarse)')?.matches,
  );
  const cameraRig = createCityCameraRig(plan);
  const tourTimeline = createCityTourTimeline(plan);
  const tourSafetyField = createCityTourSafetyField(plan);
  const helicopterRig = createCityHelicopterRig(plan);
  const cranePlans = createCityCranePlans(plan);
  const leisurePlan = createCityLeisurePlan(plan);
  let environmentVisibility = createCityEnvironmentVisibility(plan, 'high');
  let environmentTreeIds = new Set(environmentVisibility.treeIds);
  let environmentVehicleIds = new Set(environmentVisibility.vehicleIds);

  const lifecycle = createWebGLContextLifecycle({
    id: 'cityview-primary',
    canvas,
    onLost: stop,
    onRestore: () => {
      if (canvas.dataset) canvas.dataset.renderer = 'restoring';
      // The lifecycle listener is registered before Three's own listener.
      // Wait for that listener and one browser frame to rebuild programs and
      // uniforms before allowing the render loop to touch the restored context.
      restoreRaf = requestAnimationFrame(() => {
        restoreRaf = requestAnimationFrame(() => {
          restoreRaf = 0;
          if (destroyed || lifecycle.getState().fallback) return;
          renderer?.resetState?.();
          resize();
          if (canvas.dataset) canvas.dataset.renderer = 'webgl';
          if (resumeRequested) start();
        });
      });
    },
    onFallback: (state) => {
      resumeRequested = false;
      stop();
      budgetSurface?.pause();
      playing = false;
      tourActive = false;
      onPlaybackChange(false);
      onTourChange(false);
      onFallback(state);
    },
  });
  if (!lifecycle.canInitialize) {
    return Object.freeze({
      available: false,
      destroy: () => lifecycle.dispose(),
      getDay: () => currentDay,
      setDay: () => {},
      setPlaying: () => {},
      isPlaying: () => false,
      isTourActive: () => false,
      startTour: () => false,
      cancelTour: () => false,
      resetCamera: () => {},
      focusNextHero: () => null,
      getHeroViewState: () => null,
      setAssetVisibility: () => assetVisibility,
      getAssetVisibility: () => assetVisibility,
      getTelemetry: () => null,
    });
  }

  let scene = null;
  let controls = null;
  let onTourPointerDown = null;

  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7e8e5);
    scene.fog = new THREE.Fog(0xe7e8e5, 480, 900);

  const camera = new THREE.PerspectiveCamera(CITY_TOUR_BASE_FOV, 1, 0.5, 1600);
  camera.position.set(
    cameraRig.home.position.x,
    cameraRig.home.position.y,
    cameraRig.home.position.z,
  );

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(scene.background, 1);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 25;
  controls.maxDistance = 1250;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(cameraRig.home.target.x, cameraRig.home.target.y, cameraRig.home.target.z);
  controls.update();

  const materials = {
    white: new THREE.MeshBasicMaterial({ color: 0xf8f8f4 }),
    pale: new THREE.MeshBasicMaterial({ color: 0xeeeeea }),
    skeleton: new THREE.MeshBasicMaterial({ color: 0x737875 }),
    road: new THREE.MeshBasicMaterial({ color: 0xc9cbc8 }),
    roadStripe: new THREE.MeshBasicMaterial({ color: 0xf6f6f1 }),
    water: new THREE.MeshBasicMaterial({ color: 0xaebfc2, transparent: true, opacity: 0.88 }),
    green: new THREE.MeshBasicMaterial({ color: 0x9eb6a1 }),
    orange: new THREE.MeshBasicMaterial({ color: 0xd98555 }),
    dark: new THREE.MeshBasicMaterial({ color: 0x696d6a }),
    outline: new THREE.LineBasicMaterial({ color: 0x737875, transparent: true, opacity: 0.72 }),
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshBasicMaterial({ color: 0xe7e8e5 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  scene.add(ground);

  const grid = new THREE.GridHelper(1600, 32, 0xbfc2be, 0xd4d6d2);
  grid.position.y = -0.06;
  scene.add(grid);

  const unitBox = new THREE.BoxGeometry(1, 1, 1);

  const ridgeData = createCityRidgeMeshData(plan);
  const ridgePeakCount = ridgeData.peakCount;
  const ridgeGeometry = new THREE.BufferGeometry();
  ridgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ridgeData.positions, 3));
  ridgeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(ridgeData.colors, 3));
  ridgeGeometry.setIndex(ridgeData.indices);
  ridgeGeometry.computeBoundingSphere();
  const ridgeMesh = new THREE.Mesh(
    ridgeGeometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  ridgeMesh.visible = ridgePeakCount > 0;
  scene.add(ridgeMesh);

  const helicopter = new THREE.Group();
  helicopter.name = 'city-survey-helicopter';
  const helicopterBodyGeometry = new THREE.SphereGeometry(1, 8, 5);
  const helicopterTailGeometry = new THREE.CylinderGeometry(0.45, 1.25, 11, 6, 1, false);
  const helicopterBody = new THREE.Mesh(helicopterBodyGeometry, materials.white);
  helicopterBody.scale.set(5.6, 2.7, 3.1);
  helicopter.add(helicopterBody);

  const helicopterCockpit = new THREE.Mesh(helicopterBodyGeometry, materials.dark);
  helicopterCockpit.position.set(3.5, 0.35, 0);
  helicopterCockpit.scale.set(2.45, 2.05, 2.75);
  helicopter.add(helicopterCockpit);

  const helicopterTail = new THREE.Mesh(helicopterTailGeometry, materials.white);
  helicopterTail.position.set(-7.1, 0.7, 0);
  helicopterTail.rotation.z = Math.PI / 2;
  helicopter.add(helicopterTail);

  const helicopterOrangeParts = new THREE.InstancedMesh(unitBox, materials.orange, 2);
  setInstance(helicopterOrangeParts, 0, { x: -12.1, y: 2.1, z: 0 }, {
    x: 1.4,
    y: 4.3,
    z: 0.42,
  });
  setInstance(helicopterOrangeParts, 1, { x: 0, y: 3.4, z: 0 }, {
    x: 0.96,
    y: 1.15,
    z: 0.96,
  });
  helicopterOrangeParts.instanceMatrix.needsUpdate = true;
  helicopter.add(helicopterOrangeParts);

  const helicopterMainRotor = new THREE.Group();
  helicopterMainRotor.position.set(0, 3.4, 0);
  const mainRotorBlades = new THREE.InstancedMesh(unitBox, materials.dark, 2);
  setInstance(mainRotorBlades, 0, { x: 0, y: 0, z: 0 }, { x: 17, y: 0.16, z: 0.42 });
  setInstance(mainRotorBlades, 1, { x: 0, y: 0, z: 0 }, { x: 0.42, y: 0.16, z: 17 });
  mainRotorBlades.instanceMatrix.needsUpdate = true;
  helicopterMainRotor.add(mainRotorBlades);
  helicopter.add(helicopterMainRotor);

  const helicopterTailRotor = new THREE.Group();
  helicopterTailRotor.position.set(-12.45, 1.05, 0);
  const tailRotorBlades = new THREE.InstancedMesh(unitBox, materials.dark, 2);
  setInstance(tailRotorBlades, 0, { x: 0, y: 0, z: 0 }, { x: 0.16, y: 3.2, z: 0.28 });
  setInstance(tailRotorBlades, 1, { x: 0, y: 0, z: 0 }, { x: 0.16, y: 0.28, z: 3.2 });
  tailRotorBlades.instanceMatrix.needsUpdate = true;
  helicopterTailRotor.add(tailRotorBlades);
  helicopter.add(helicopterTailRotor);

  const helicopterSkids = new THREE.InstancedMesh(unitBox, materials.dark, 6);
  let skidPartIndex = 0;
  for (const z of [-2.75, 2.75]) {
    setInstance(helicopterSkids, skidPartIndex, { x: 0, y: -3.05, z }, {
      x: 8.4,
      y: 0.28,
      z: 0.3,
    });
    skidPartIndex += 1;
    for (const x of [-2.2, 2.2]) {
      setInstance(helicopterSkids, skidPartIndex, { x, y: -1.85, z: z * 0.82 }, {
        x: 0.3,
        y: 2.5,
        z: 0.3,
      });
      skidPartIndex += 1;
    }
  }
  helicopterSkids.instanceMatrix.needsUpdate = true;
  helicopter.add(helicopterSkids);
  scene.add(helicopter);

  const waterMesh = new THREE.InstancedMesh(unitBox, materials.water, Math.max(1, plan.water.length));
  waterMesh.count = plan.water.length;
  plan.water.forEach((channel, index) => {
    const scale = channel.axis === 'x'
      ? { x: channel.length, y: 0.28, z: channel.width }
      : { x: channel.width, y: 0.28, z: channel.length };
    setInstance(waterMesh, index, { ...channel.position, y: 0.18 }, scale);
  });
  waterMesh.instanceMatrix.needsUpdate = true;
  scene.add(waterMesh);

  const roadMesh = new THREE.InstancedMesh(unitBox, materials.road, plan.roads.length);
  const roadStripeMesh = new THREE.InstancedMesh(unitBox, materials.roadStripe, plan.roads.length);
  roadMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  roadStripeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  roadMesh.frustumCulled = false;
  roadStripeMesh.frustumCulled = false;
  scene.add(roadMesh, roadStripeMesh);

  const buildingCount = plan.buildings.length;
  const facadePlan = createCityFacadePlan(plan.buildings);
  const rooftopPlan = createCityRooftopPlan(plan.buildings);
  const rooftopAssetsByBuilding = new Map();
  rooftopPlan.assets.forEach((asset) => {
    const assets = rooftopAssetsByBuilding.get(asset.buildingId) ?? [];
    assets.push(asset);
    rooftopAssetsByBuilding.set(asset.buildingId, assets);
  });
  const buildingById = new Map(plan.buildings.map((building) => [building.id, building]));
  const boxShells = new THREE.InstancedMesh(unitBox, materials.white, buildingCount);
  const cylinderShells = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false),
    materials.white,
    buildingCount,
  );
  const skeletons = new THREE.InstancedMesh(unitBox, materials.skeleton, buildingCount * 4);
  const slabs = new THREE.InstancedMesh(unitBox, materials.pale, buildingCount * 3);
  const plateRoofs = new THREE.InstancedMesh(unitBox, materials.white, buildingCount);
  const spireRoofs = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.5, 1, 8),
    materials.white,
    buildingCount,
  );
  const landmarkSegments = new THREE.InstancedMesh(unitBox, materials.white, 12);
  for (const mesh of [boxShells, cylinderShells, skeletons, slabs, plateRoofs, spireRoofs, landmarkSegments]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Each batch spans the whole city and starts with most instances hidden below
    // ground. Three caches an InstancedMesh bounding sphere, so later construction
    // matrices can otherwise remain culled against the day-zero bounds.
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  const rooftopToneColors = Object.freeze({
    white: new THREE.Color(0xf8f8f4),
    pale: new THREE.Color(0xeeeeea),
    green: new THREE.Color(0x9eb6a1),
    orange: new THREE.Color(0xd98555),
  });
  const rooftopMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rooftopDetails = new THREE.InstancedMesh(
    unitBox,
    rooftopMaterial,
    Math.max(1, rooftopPlan.assets.length),
  );
  rooftopDetails.count = 0;
  rooftopDetails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rooftopDetails.frustumCulled = false;
  scene.add(rooftopDetails);

  const facadeStrips = new THREE.InstancedMesh(
    unitBox,
    materials.pale,
    Math.max(1, facadePlan.strips.length),
  );
  const facadeBalconies = new THREE.InstancedMesh(
    unitBox,
    materials.white,
    Math.max(1, facadePlan.balconies.length),
  );
  facadeStrips.count = facadePlan.strips.length;
  facadeBalconies.count = facadePlan.balconies.length;
  facadeStrips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  facadeBalconies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  facadeStrips.frustumCulled = false;
  facadeBalconies.frustumCulled = false;
  scene.add(facadeStrips, facadeBalconies);

  const outlineGeometry = createDynamicLineGeometry(
    Math.max(72, buildingCount * 1008 + rooftopPlan.assets.length * 72),
  );
  const outlines = new THREE.LineSegments(outlineGeometry, materials.outline);
  outlines.frustumCulled = false;
  outlines.raycast = () => {};
  scene.add(outlines);

  const facadeOutlineGeometry = createDynamicLineGeometry(
    Math.max(72, (facadePlan.strips.length + facadePlan.balconies.length) * 72),
  );
  const facadeOutlines = new THREE.LineSegments(facadeOutlineGeometry, materials.outline);
  facadeOutlines.frustumCulled = false;
  facadeOutlines.raycast = () => {};
  scene.add(facadeOutlines);

  const heroRenderPlan = createCityHeroRenderPlan(plan.heroLandmarks);
  const heroFormCounts = Object.freeze(plan.heroLandmarks.reduce((counts, landmark) => {
    counts[landmark.form] = (counts[landmark.form] ?? 0) + 1;
    return counts;
  }, {}));
  const heroLandmarkById = new Map(plan.heroLandmarks.map((hero) => [hero.id, hero]));
  const heroComponentsByPrimitive = Object.freeze({
    box: heroRenderPlan.filter((component) => component.primitive === 'box'),
    cylinder: heroRenderPlan.filter((component) => component.primitive === 'cylinder'),
    sphere: heroRenderPlan.filter((component) => component.primitive === 'sphere'),
    cone: heroRenderPlan.filter((component) => component.primitive === 'cone'),
  });
  const heroToneColors = Object.freeze({
    white: new THREE.Color(0xf8f8f4),
    pale: new THREE.Color(0xeeeeea),
    orange: new THREE.Color(0xd98555),
    green: new THREE.Color(0x9eb6a1),
  });
  const heroMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const heroGeometries = Object.freeze({
    box: unitBox,
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false),
    sphere: new THREE.IcosahedronGeometry(0.5, 2),
    cone: new THREE.ConeGeometry(0.5, 1, 10),
  });
  const heroMeshes = {};
  for (const primitive of Object.keys(heroComponentsByPrimitive)) {
    const components = heroComponentsByPrimitive[primitive];
    const mesh = new THREE.InstancedMesh(heroGeometries[primitive], heroMaterial, Math.max(1, components.length));
    mesh.count = components.length;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    components.forEach((component, index) => mesh.setColorAt(index, heroToneColors[component.tone]));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    heroMeshes[primitive] = mesh;
    scene.add(mesh);
  }

  const heroLandmarkCount = plan.heroLandmarks.length;
  const heroSkeletons = new THREE.InstancedMesh(
    unitBox,
    materials.skeleton,
    Math.max(1, heroLandmarkCount * 4),
  );
  const heroSlabs = new THREE.InstancedMesh(
    unitBox,
    materials.pale,
    Math.max(1, heroLandmarkCount * 3),
  );
  const heroRoofs = new THREE.InstancedMesh(
    unitBox,
    materials.white,
    Math.max(1, heroLandmarkCount),
  );
  heroSkeletons.count = 0;
  heroSlabs.count = 0;
  heroRoofs.count = 0;
  for (const mesh of [heroSkeletons, heroSlabs, heroRoofs]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  const heroOutlineGeometry = createDynamicLineGeometry(Math.max(72, heroRenderPlan.length * 504));
  const heroOutlines = new THREE.LineSegments(heroOutlineGeometry, materials.outline);
  heroOutlines.frustumCulled = false;
  heroOutlines.raycast = () => {};
  scene.add(heroOutlines);

  const treeCount = plan.trees.length;
  const treeTrunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.45, 0.55, 1, 6),
    materials.dark,
    treeCount,
  );
  const treeCrowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    materials.green,
    treeCount,
  );
  treeTrunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  treeCrowns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  treeTrunks.frustumCulled = false;
  treeCrowns.frustumCulled = false;
  scene.add(treeTrunks, treeCrowns);

  const leisureToneColors = Object.freeze({
    pale: new THREE.Color(0xeeeeea),
    dark: new THREE.Color(0x696d6a),
    orange: new THREE.Color(0xd98555),
  });
  const leisureMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const leisureMesh = new THREE.InstancedMesh(
    unitBox,
    leisureMaterial,
    Math.max(1, leisurePlan.assets.length),
  );
  leisureMesh.count = 0;
  leisureMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leisureMesh.frustumCulled = false;
  scene.add(leisureMesh);
  const leisureOutlineGeometry = createDynamicLineGeometry(
    Math.max(72, leisurePlan.assets.length * 72),
  );
  const leisureOutlines = new THREE.LineSegments(leisureOutlineGeometry, materials.outline);
  leisureOutlines.frustumCulled = false;
  leisureOutlines.raycast = () => {};
  scene.add(leisureOutlines);

  const vehicleMesh = new THREE.InstancedMesh(unitBox, materials.white, plan.vehicles.length);
  const vehicleAccentMesh = new THREE.InstancedMesh(unitBox, materials.orange, plan.vehicles.length);
  vehicleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  vehicleAccentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  vehicleMesh.frustumCulled = false;
  vehicleAccentMesh.frustumCulled = false;
  scene.add(vehicleMesh, vehicleAccentMesh);

  const craneCapacity = CITY_MAX_ACTIVE_CRANES * 96;
  const craneMeshes = Object.freeze({
    orange: new THREE.InstancedMesh(unitBox, materials.orange, craneCapacity),
    pale: new THREE.InstancedMesh(unitBox, materials.pale, craneCapacity),
    dark: new THREE.InstancedMesh(unitBox, materials.dark, craneCapacity),
  });
  for (const mesh of Object.values(craneMeshes)) {
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  const craneLineGeometry = createDynamicLineGeometry(CITY_MAX_ACTIVE_CRANES * 256 * 6);
  const craneLines = new THREE.LineSegments(craneLineGeometry, materials.outline);
  craneLines.frustumCulled = false;
  craneLines.raycast = () => {};
  scene.add(craneLines);

  const structureMeshes = Object.freeze([
    boxShells,
    cylinderShells,
    skeletons,
    slabs,
    plateRoofs,
    spireRoofs,
    landmarkSegments,
    rooftopDetails,
    heroSkeletons,
    heroSlabs,
    heroRoofs,
    ...Object.values(heroMeshes),
  ]);
  const facadeMeshes = Object.freeze([facadeStrips, facadeBalconies]);
  const infrastructureMeshes = Object.freeze([waterMesh, roadMesh]);
  const landscapeMeshes = Object.freeze([treeTrunks, treeCrowns, leisureMesh]);
  const mobilityMeshes = Object.freeze([vehicleMesh]);
  const craneBatchMeshes = Object.freeze(Object.values(craneMeshes));

  let tourPath = createCityTourPath(cameraRig.home.position, cameraRig);
  let tourFocusPath = createCityTourFocusPath(cameraRig);

  function shellProgressFor(state) {
    if (state.phase === 'shell') return ease(state.phaseProgress);
    return state.phase === 'roof' || state.phase === 'complete' ? 1 : 0;
  }

  function curveLineOptions() {
    return cityLod === 'high' || cityLod === ''
      ? CURVE_LINE_OPTIONS.high
      : CURVE_LINE_OPTIONS.medium;
  }

  function updateRoads(day) {
    renderedRoadCount = 0;
    plan.roads.forEach((road, index) => {
      const progress = ease(roadProgressAt(road, day));
      if (progress <= 0) {
        hideInstance(roadMesh, index);
        hideInstance(roadStripeMesh, index);
        return;
      }
      const length = road.length * progress;
      const roadScale = road.axis === 'x'
        ? { x: length, y: 0.45, z: road.width }
        : { x: road.width, y: 0.45, z: length };
      const stripeScale = road.axis === 'x'
        ? { x: length, y: 0.04, z: 0.28 }
        : { x: 0.28, y: 0.04, z: length };
      const position = road.axis === 'x'
        ? { x: 0, y: 0.12, z: road.position }
        : { x: road.position, y: 0.12, z: 0 };
      setInstance(roadMesh, index, position, roadScale);
      setInstance(roadStripeMesh, index, { ...position, y: 0.37 }, stripeScale);
      renderedRoadCount += 1;
    });
    roadMesh.instanceMatrix.needsUpdate = true;
    roadStripeMesh.instanceMatrix.needsUpdate = true;
  }

  function updateBuildings(day) {
    const linePositions = [];
    let plateRoofCursor = 0;
    let rooftopAssetCursor = 0;
    const rooftopKindCounts = {};
    renderedBuildingShellCount = 0;
    renderedBuildingRoofCount = 0;
    renderedBuildingSkeletonPartCount = 0;
    renderedBuildingSlabCount = 0;
    for (let segment = 0; segment < 12; segment += 1) hideInstance(landmarkSegments, segment);
    plan.buildings.forEach((building, index) => {
      const state = constructionStateAt(building.schedule, day);
      const { width, height, depth } = building.bounds;
      const { x, z } = building.position;
      hideInstance(boxShells, index);
      hideInstance(cylinderShells, index);
      hideInstance(spireRoofs, index);
      for (let corner = 0; corner < 4; corner += 1) hideInstance(skeletons, index * 4 + corner);
      for (let floor = 0; floor < 3; floor += 1) hideInstance(slabs, index * 3 + floor);

      if (state.phase === 'hidden') return;

      const skeletonHeight = state.phase === 'skeleton'
        ? Math.max(1, height * ease(state.phaseProgress))
        : height;
      if (state.phase === 'skeleton' || state.phase === 'slabs') {
        const corners = [
          [-width / 2, -depth / 2], [width / 2, -depth / 2],
          [width / 2, depth / 2], [-width / 2, depth / 2],
        ];
        corners.forEach(([offsetX, offsetZ], corner) => {
          setInstance(skeletons, index * 4 + corner, {
            x: x + offsetX,
            y: skeletonHeight / 2,
            z: z + offsetZ,
          }, { x: 0.72, y: skeletonHeight, z: 0.72 }, building.rotationY);
          renderedBuildingSkeletonPartCount += 1;
        });
      }

      if (state.phase === 'slabs') {
        const visibleSlabs = Math.max(1, Math.ceil(state.phaseProgress * 3));
        for (let floor = 0; floor < visibleSlabs; floor += 1) {
          const y = ((floor + 1) / 4) * height;
          setInstance(slabs, index * 3 + floor, { x, y, z }, {
            x: width * 0.96,
            y: 0.42,
            z: depth * 0.96,
          }, building.rotationY);
          renderedBuildingSlabCount += 1;
        }
      }

      const shellProgress = shellProgressFor(state);
      if (shellProgress > 0) {
        renderedBuildingShellCount += 1;
        const visibleHeight = height * shellProgress;
        if (building.kind === 'landmark') {
          const segmentHeight = height / 12;
          const segmentsVisible = shellProgress * 12;
          for (let segment = 0; segment < 12; segment += 1) {
            const partial = clamp01(segmentsVisible - segment);
            if (partial <= 0) {
              hideInstance(landmarkSegments, segment);
              continue;
            }
            const localHeight = segmentHeight * partial;
            const rotationStep = plan.profile.landmarkForm === 'twist' ? 0.055 : 0.006;
            const taperStep = plan.profile.landmarkForm === 'twist' ? 0.018 : 0.044;
            const rotation = building.rotationY + segment * rotationStep;
            const taper = 1 - segment * taperStep;
            setInstance(landmarkSegments, segment, {
              x,
              y: segment * segmentHeight + localHeight / 2,
              z,
            }, {
              x: width * taper,
              y: localHeight,
              z: depth * taper,
            }, rotation);
            appendBoxEdges(
              linePositions,
              x,
              segment * segmentHeight,
              z,
              width * taper,
              localHeight,
              depth * taper,
              rotation,
            );
          }
        } else {
          const shellMesh = building.buildingKind === 'cylinder' ? cylinderShells : boxShells;
          setInstance(shellMesh, index, { x, y: visibleHeight / 2, z }, {
            x: width,
            y: visibleHeight,
            z: depth,
          }, building.rotationY);
          if (building.buildingKind === 'cylinder') {
            appendEllipticCylinderLines(
              linePositions,
              x,
              0,
              z,
              width,
              visibleHeight,
              depth,
              building.rotationY,
              curveLineOptions(),
            );
          } else {
            appendBoxEdges(linePositions, x, 0, z, width, visibleHeight, depth, building.rotationY);
          }
        }
      }

      if (state.phase === 'roof' || state.phase === 'complete') {
        renderedBuildingRoofCount += 1;
        const roofProgress = state.phase === 'complete' ? 1 : ease(state.phaseProgress);
        const roofY = height + Math.max(0.15, roofProgress * 1.4) / 2;
        if (building.roofKind === 'spire') {
          const spireHeight = Math.max(0.1, roofProgress * 8);
          setInstance(spireRoofs, index, { x, y: height + roofProgress * 4, z }, {
            x: width * 0.32,
            y: spireHeight,
            z: depth * 0.32,
          }, building.rotationY);
          appendEllipticFrustumLines(
            linePositions,
            x,
            height,
            z,
            width * 0.32,
            depth * 0.32,
            0,
            0,
            spireHeight,
            building.rotationY,
            curveLineOptions(),
          );
        } else {
          const crownScale = building.roofKind === 'crown' ? 0.62 : 0.86;
          const roofHeight = Math.max(0.1, roofProgress * 1.4);
          setInstance(plateRoofs, plateRoofCursor, { x, y: roofY, z }, {
            x: width * crownScale,
            y: roofHeight,
            z: depth * crownScale,
          }, building.rotationY);
          plateRoofCursor += 1;
          appendBoxEdges(
            linePositions,
            x,
            height,
            z,
            width * crownScale,
            roofHeight,
            depth * crownScale,
            building.rotationY,
          );

          for (const asset of rooftopAssetsByBuilding.get(building.id) ?? []) {
            const reveal = ease(clamp01(
              (roofProgress - asset.revealStart) / Math.max(0.02, 1 - asset.revealStart),
            ));
            if (reveal <= 0) continue;
            const finalBaseY = asset.position.y - asset.bounds.height / 2;
            const baseY = height + roofHeight + finalBaseY - (height + 1.4);
            const visibleHeight = asset.bounds.height * reveal;
            setInstance(rooftopDetails, rooftopAssetCursor, {
              x: asset.position.x,
              y: baseY + visibleHeight / 2,
              z: asset.position.z,
            }, {
              x: asset.bounds.width,
              y: visibleHeight,
              z: asset.bounds.depth,
            }, asset.rotationY);
            rooftopDetails.setColorAt(rooftopAssetCursor, rooftopToneColors[asset.tone]);
            appendBoxEdges(
              linePositions,
              asset.position.x,
              baseY,
              asset.position.z,
              asset.bounds.width,
              visibleHeight,
              asset.bounds.depth,
              asset.rotationY,
            );
            rooftopAssetCursor += 1;
            rooftopKindCounts[asset.kind] = (rooftopKindCounts[asset.kind] ?? 0) + 1;
          }
        }
      }
    });

    plateRoofs.count = plateRoofCursor;
    for (const mesh of [boxShells, cylinderShells, skeletons, slabs, plateRoofs, spireRoofs, landmarkSegments]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    rooftopDetails.count = rooftopAssetCursor;
    rooftopDetails.instanceMatrix.needsUpdate = true;
    if (rooftopDetails.instanceColor) rooftopDetails.instanceColor.needsUpdate = true;
    renderedRooftopAssetCount = rooftopAssetCursor;
    renderedRooftopKindCounts = Object.freeze(rooftopKindCounts);
    updateDynamicLineGeometry(outlineGeometry, linePositions);
  }

  function updateFacades(day) {
    const linePositions = [];
    const stateByBuilding = new Map();
    const stateFor = (building) => {
      if (!stateByBuilding.has(building.id)) {
        stateByBuilding.set(building.id, constructionStateAt(building.schedule, day));
      }
      return stateByBuilding.get(building.id);
    };

    facadePlan.strips.forEach((strip, index) => {
      hideInstance(facadeStrips, index);
      const building = buildingById.get(strip.buildingId);
      if (!building) return;
      const shellProgress = shellProgressFor(stateFor(building));
      if (shellProgress <= 0) return;
      const visibleHeight = strip.height * shellProgress;
      setInstance(facadeStrips, index, {
        x: strip.position.x,
        y: visibleHeight / 2,
        z: strip.position.z,
      }, {
        x: strip.width,
        y: visibleHeight,
        z: strip.depth,
      }, strip.rotationY);
      appendBoxEdges(
        linePositions,
        strip.position.x,
        0,
        strip.position.z,
        strip.width,
        visibleHeight,
        strip.depth,
        strip.rotationY,
      );
    });

    facadePlan.balconies.forEach((balcony, index) => {
      hideInstance(facadeBalconies, index);
      const building = buildingById.get(balcony.buildingId);
      if (!building) return;
      const visibleHeight = building.bounds.height * shellProgressFor(stateFor(building));
      const reveal = ease(clamp01((visibleHeight - balcony.position.y + 1.2) / 1.2));
      if (reveal <= 0) return;
      const width = balcony.width * reveal;
      const depth = balcony.depth * reveal;
      setInstance(facadeBalconies, index, {
        x: balcony.position.x,
        y: balcony.position.y - (1 - reveal) * 0.35,
        z: balcony.position.z,
      }, {
        x: width,
        y: balcony.height,
        z: depth,
      }, balcony.rotationY);
      appendBoxEdges(
        linePositions,
        balcony.position.x,
        balcony.position.y - balcony.height / 2,
        balcony.position.z,
        width,
        balcony.height,
        depth,
        balcony.rotationY,
      );
    });

    facadeStrips.instanceMatrix.needsUpdate = true;
    facadeBalconies.instanceMatrix.needsUpdate = true;
    updateDynamicLineGeometry(facadeOutlineGeometry, linePositions);
  }

  function updateHeroLandmarks(day) {
    const linePositions = [];
    let heroSkeletonCursor = 0;
    let heroSlabCursor = 0;
    let heroRoofCursor = 0;
    renderedHeroComponentCount = 0;
    renderedHeroRoofCount = 0;
    renderedHeroSkeletonPartCount = 0;
    renderedHeroSlabCount = 0;
    const stateByLandmark = new Map();
    const stateFor = (landmark) => {
      if (!stateByLandmark.has(landmark.id)) {
        stateByLandmark.set(landmark.id, constructionStateAt(landmark.schedule, day));
      }
      return stateByLandmark.get(landmark.id);
    };

    plan.heroLandmarks.forEach((landmark) => {
      const state = stateFor(landmark);
      const { width, height, depth } = landmark.bounds;
      if (state.phase === 'skeleton' || state.phase === 'slabs') {
        const skeletonHeight = state.phase === 'skeleton'
          ? Math.max(1, height * ease(state.phaseProgress))
          : height;
        const cosine = Math.cos(landmark.rotationY);
        const sine = Math.sin(landmark.rotationY);
        const corners = [
          [-width / 2, -depth / 2], [width / 2, -depth / 2],
          [width / 2, depth / 2], [-width / 2, depth / 2],
        ];
        corners.forEach(([localX, localZ]) => {
          setInstance(heroSkeletons, heroSkeletonCursor, {
            x: landmark.position.x + localX * cosine + localZ * sine,
            y: skeletonHeight / 2,
            z: landmark.position.z - localX * sine + localZ * cosine,
          }, { x: 0.72, y: skeletonHeight, z: 0.72 }, landmark.rotationY);
          heroSkeletonCursor += 1;
          renderedHeroSkeletonPartCount += 1;
        });
      }
      if (state.phase === 'slabs') {
        const visibleSlabs = Math.max(1, Math.ceil(state.phaseProgress * 3));
        for (let floor = 0; floor < visibleSlabs; floor += 1) {
          setInstance(heroSlabs, heroSlabCursor, {
            x: landmark.position.x,
            y: ((floor + 1) / 4) * height,
            z: landmark.position.z,
          }, {
            x: width * 0.94,
            y: 0.42,
            z: depth * 0.94,
          }, landmark.rotationY);
          heroSlabCursor += 1;
          renderedHeroSlabCount += 1;
        }
      }
      if (state.phase === 'roof' || state.phase === 'complete') {
        renderedHeroRoofCount += 1;
        const roofProgress = state.phase === 'complete' ? 1 : ease(state.phaseProgress);
        setInstance(heroRoofs, heroRoofCursor, {
          x: landmark.position.x,
          y: height + roofProgress * 0.7,
          z: landmark.position.z,
        }, {
          x: width * 0.34,
          y: Math.max(0.1, roofProgress * 1.4),
          z: depth * 0.34,
        }, landmark.rotationY);
        heroRoofCursor += 1;
      }
    });

    for (const primitive of Object.keys(heroComponentsByPrimitive)) {
      const components = heroComponentsByPrimitive[primitive];
      const mesh = heroMeshes[primitive];
      components.forEach((component, index) => {
        hideInstance(mesh, index);
        const landmark = heroLandmarkById.get(component.landmarkId);
        if (!landmark) return;
        const shellProgress = shellProgressFor(stateFor(landmark));
        const reveal = ease(clamp01(
          (shellProgress - component.revealStart)
          / Math.max(0.02, component.revealEnd - component.revealStart),
        ));
        if (reveal <= 0) return;

        const baseY = component.position.y - component.bounds.height / 2;
        const currentHeight = component.bounds.height * reveal;
        const radialReveal = primitive === 'sphere' || primitive === 'cone' ? reveal : 1;
        const width = component.bounds.width * radialReveal;
        const depth = component.bounds.depth * radialReveal;
        const position = {
          x: component.position.x,
          y: baseY + currentHeight / 2,
          z: component.position.z,
        };
        setInstance(mesh, index, position, {
          x: width,
          y: currentHeight,
          z: depth,
        }, component.rotationY);
        renderedHeroComponentCount += 1;

        if (primitive === 'box') {
          appendBoxEdges(
            linePositions,
            position.x,
            baseY,
            position.z,
            width,
            currentHeight,
            depth,
            component.rotationY,
          );
        } else if (primitive === 'cylinder') {
          appendEllipticCylinderLines(
            linePositions,
            position.x,
            baseY,
            position.z,
            width,
            currentHeight,
            depth,
            component.rotationY,
            curveLineOptions(),
          );
        } else if (primitive === 'sphere') {
          appendEllipsoidLines(
            linePositions,
            position.x,
            position.y,
            position.z,
            width,
            currentHeight,
            depth,
            component.rotationY,
            {
              radialSegments: curveLineOptions().radialSegments,
              meridians: curveLineOptions().verticalLines,
              latitudeFractions: cityLod === 'high' || cityLod === '' ? [-0.5, 0, 0.5] : [0],
            },
          );
        } else {
          appendEllipticFrustumLines(
            linePositions,
            position.x,
            baseY,
            position.z,
            width,
            depth,
            0,
            0,
            currentHeight,
            component.rotationY,
            curveLineOptions(),
          );
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
    }

    heroSkeletons.count = heroSkeletonCursor;
    heroSlabs.count = heroSlabCursor;
    heroRoofs.count = heroRoofCursor;
    heroSkeletons.instanceMatrix.needsUpdate = true;
    heroSlabs.instanceMatrix.needsUpdate = true;
    heroRoofs.instanceMatrix.needsUpdate = true;

    updateDynamicLineGeometry(heroOutlineGeometry, linePositions);
  }

  function updateTrees(day) {
    visibleTreeCount = 0;
    plan.trees.forEach((tree) => {
      if (!environmentTreeIds.has(tree.id) || day < tree.availableDay) return;
      const reveal = ease(clamp01((day - tree.availableDay) / 12));
      setInstance(treeTrunks, visibleTreeCount, {
        x: tree.position.x,
        y: tree.height * reveal / 2,
        z: tree.position.z,
      }, { x: 1.05, y: tree.height * reveal, z: 1.05 });
      setInstance(treeCrowns, visibleTreeCount, {
        x: tree.position.x,
        y: tree.height * reveal,
        z: tree.position.z,
      }, {
        x: tree.radius * reveal,
        y: tree.radius * 0.86 * reveal,
        z: tree.radius * reveal,
      });
      visibleTreeCount += 1;
    });
    treeTrunks.count = visibleTreeCount;
    treeCrowns.count = visibleTreeCount;
    treeTrunks.instanceMatrix.needsUpdate = true;
    treeCrowns.instanceMatrix.needsUpdate = true;
  }

  function updateLeisure(day) {
    const linePositions = [];
    visibleLeisureAssetCount = 0;
    if (cityLod !== 'silhouette') {
      for (const asset of leisurePlan.assets) {
        if (day < asset.availableDay) continue;
        const reveal = ease(clamp01((day - asset.availableDay) / 12));
        if (reveal <= 0) continue;
        const baseY = asset.position.y - asset.bounds.height / 2;
        const visibleHeight = asset.bounds.height * reveal;
        setInstance(leisureMesh, visibleLeisureAssetCount, {
          x: asset.position.x,
          y: baseY + visibleHeight / 2,
          z: asset.position.z,
        }, {
          x: asset.bounds.width,
          y: visibleHeight,
          z: asset.bounds.depth,
        }, asset.rotationY);
        leisureMesh.setColorAt(visibleLeisureAssetCount, leisureToneColors[asset.tone]);
        appendBoxEdges(
          linePositions,
          asset.position.x,
          baseY,
          asset.position.z,
          asset.bounds.width,
          visibleHeight,
          asset.bounds.depth,
          asset.rotationY,
        );
        visibleLeisureAssetCount += 1;
      }
    }
    leisureMesh.count = visibleLeisureAssetCount;
    leisureMesh.instanceMatrix.needsUpdate = true;
    if (leisureMesh.instanceColor) leisureMesh.instanceColor.needsUpdate = true;
    updateDynamicLineGeometry(leisureOutlineGeometry, linePositions);
  }

  function updateCrane(day) {
    const detail = cityLod === 'silhouette'
      ? 'silhouette'
      : cityLod === 'medium'
        ? 'medium'
        : 'high';
    const renderPlan = createCityCraneRenderPlan(cranePlans, day, detail);
    activeCraneCount = renderPlan.activeCraneIds.length;

    for (const tone of Object.keys(craneMeshes)) {
      const mesh = craneMeshes[tone];
      const parts = renderPlan.boxes.filter((part) => part.tone === tone);
      mesh.count = parts.length;
      parts.forEach((part, index) => {
        setInstance(mesh, index, part.position, part.scale, part.rotationY);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }

    const linePositions = [];
    for (const line of renderPlan.lines) {
      linePositions.push(
        line.from.x, line.from.y, line.from.z,
        line.to.x, line.to.y, line.to.z,
      );
    }
    updateDynamicLineGeometry(craneLineGeometry, linePositions);
  }

  function updateConstruction(day) {
    updateRoads(day);
    updateBuildings(day);
    updateFacades(day);
    updateHeroLandmarks(day);
    updateTrees(day);
    updateLeisure(day);
    updateCrane(day);
  }

  function updateVehicles(timeSeconds, { force = false } = {}) {
    if (!assetVisibility.mobility) {
      if (force || vehicleMesh.count || vehicleAccentMesh.count) {
        visibleVehicleCount = 0;
        vehicleMesh.count = 0;
        vehicleAccentMesh.count = 0;
        vehicleMesh.instanceMatrix.needsUpdate = true;
        vehicleAccentMesh.instanceMatrix.needsUpdate = true;
      }
      lastStaticVehicleKey = 'hidden';
      return;
    }

    const reducedMotion = Boolean(budgetPolicy?.reducedMotion);
    const staticKey = reducedMotion
      ? `${Math.round(currentDay)}:${environmentVisibility.tier}`
      : '';
    if (!force && staticKey && staticKey === lastStaticVehicleKey) return;

    const half = plan.extent / 2;
    visibleVehicleCount = 0;
    plan.vehicles.forEach((vehicle) => {
      if (!environmentVehicleIds.has(vehicle.id) || !cityVehicleReadyAt(plan, vehicle, currentDay)) return;
      const travel = (vehicle.offset + timeSeconds * vehicle.speed * vehicle.direction + half) % plan.extent;
      const along = (travel + plan.extent) % plan.extent - half;
      const position = vehicle.axis === 'x'
        ? { x: along, y: 1.05, z: vehicle.lane }
        : { x: vehicle.lane, y: 1.05, z: along };
      const rotation = vehicle.axis === 'x' ? 0 : Math.PI / 2;
      const scale = vehicle.axis === 'x'
        ? { x: 7.1, y: 1.7, z: 2.25 }
        : { x: 7.1, y: 1.7, z: 2.25 };
      setInstance(vehicleMesh, visibleVehicleCount, position, scale, rotation);
      setInstance(vehicleAccentMesh, visibleVehicleCount, { ...position, y: 2.05 }, {
        x: 2.7,
        y: 0.45,
        z: 1.7,
      }, rotation);
      visibleVehicleCount += 1;
    });
    vehicleMesh.count = visibleVehicleCount;
    vehicleAccentMesh.count = visibleVehicleCount;
    vehicleMesh.instanceMatrix.needsUpdate = true;
    vehicleAccentMesh.instanceMatrix.needsUpdate = true;
    lastStaticVehicleKey = staticKey;
  }

  function updateHelicopter(timeSeconds) {
    helicopter.visible = assetVisibility.mobility && environmentVisibility.helicopterVisible;
    if (!helicopter.visible) return;
    const pose = cityHelicopterPoseAt(timeSeconds, helicopterRig);
    helicopter.position.set(pose.position.x, pose.position.y, pose.position.z);
    helicopter.rotation.y = pose.yaw;
    helicopterMainRotor.rotation.y = pose.mainRotorAngle;
    helicopterTailRotor.rotation.x = pose.tailRotorAngle;
  }

  function applyAssetVisibility() {
    const detailed = cityLod !== 'silhouette';
    const high = cityLod === 'high' || cityLod === '';
    structureMeshes.forEach((mesh) => { mesh.visible = assetVisibility.structures; });
    facadeMeshes.forEach((mesh) => { mesh.visible = assetVisibility.facades && detailed; });
    infrastructureMeshes.forEach((mesh) => { mesh.visible = assetVisibility.infrastructure; });
    landscapeMeshes.forEach((mesh) => { mesh.visible = assetVisibility.landscape; });
    ridgeMesh.visible = assetVisibility.landscape && ridgePeakCount > 0;
    mobilityMeshes.forEach((mesh) => { mesh.visible = assetVisibility.mobility; });
    craneBatchMeshes.forEach((mesh) => { mesh.visible = assetVisibility.cranes; });

    outlines.visible = assetVisibility.structures && detailed;
    heroOutlines.visible = assetVisibility.structures && detailed;
    facadeOutlines.visible = assetVisibility.facades && detailed;
    roadStripeMesh.visible = assetVisibility.infrastructure && high;
    vehicleAccentMesh.visible = assetVisibility.mobility && high;
    craneLines.visible = assetVisibility.cranes && detailed;
    leisureMesh.visible = assetVisibility.landscape && detailed;
    leisureOutlines.visible = assetVisibility.landscape && detailed;
    helicopter.visible = assetVisibility.mobility && environmentVisibility.helicopterVisible;
    helicopterCockpit.visible = detailed;
    helicopterTailRotor.visible = high;
    helicopterSkids.visible = high;
    updateVehicles(currentEnvironmentTime, { force: true });
  }

  function setAssetVisibility(nextVisibility) {
    assetVisibility = createCityAssetVisibility(nextVisibility);
    applyAssetVisibility();
    return assetVisibility;
  }

  function updateLod() {
    const projectedPixels = projectedDiameterPx({
      radius: plan.extent * 0.58,
      distance: camera.position.distanceTo(controls.target),
      verticalFovDegrees: camera.fov,
      viewportHeight: Math.max(1, canvas.clientHeight),
    });
    const next = selectProceduralLod({
      projectedPixels,
      previousTier: cityLod,
      qualityTier: budgetPolicy?.qualityTier,
    });
    if (next === cityLod) return;
    cityLod = next;
    environmentVisibility = createCityEnvironmentVisibility(plan, next);
    environmentTreeIds = new Set(environmentVisibility.treeIds);
    environmentVehicleIds = new Set(environmentVisibility.vehicleIds);
    renderedDay = -1;
    applyAssetVisibility();
  }

  function announceDay(force = false) {
    const rounded = Math.round(currentDay);
    if (!force && rounded === announcedDay) return;
    announcedDay = rounded;
    onDayChange(currentDay);
  }

  function setDay(day, { cancelTour = true } = {}) {
    currentDay = Math.min(plan.profile.totalDays, Math.max(0, Number(day) || 0));
    if (cancelTour && tourActive) {
      tourActive = false;
      controls.enabled = true;
      tourNarrativeProgress = 0;
      tourPhase = 'idle';
      tourClearanceLift = 0;
      restoreTourPresentation();
      onTourChange(false);
    } else if (cancelTour) {
      tourNarrativeProgress = 0;
      tourPhase = 'idle';
      tourClearanceLift = 0;
      restoreTourPresentation();
    }
    renderedDay = -1;
    announceDay(true);
  }

  function setPlaying(next) {
    const value = Boolean(next);
    if (value && budgetPolicy?.reducedMotion) {
      setDay(plan.profile.totalDays, { cancelTour: !tourActive });
      playing = false;
      onPlaybackChange(false);
      return;
    }
    if (value && currentDay >= plan.profile.totalDays) setDay(0, { cancelTour: !tourActive });
    if (playing === value) return;
    playing = value;
    onPlaybackChange(playing);
  }

  function resetCamera() {
    cancelTour();
    heroViewIndex = -1;
    tourNarrativeProgress = 0;
    tourPhase = 'idle';
    tourClearanceLift = 0;
    controls.enabled = true;
    camera.position.set(
      cameraRig.home.position.x,
      cameraRig.home.position.y,
      cameraRig.home.position.z,
    );
    controls.target.set(cameraRig.home.target.x, cameraRig.home.target.y, cameraRig.home.target.z);
    restoreTourPresentation();
    controls.update();
  }

  function restoreTourPresentation() {
    if (Math.abs(camera.fov - CITY_TOUR_BASE_FOV) > 0.001) {
      camera.fov = CITY_TOUR_BASE_FOV;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(controls.target);
  }

  function getHeroViewState() {
    if (heroViewIndex < 0 || !cameraRig.heroViews[heroViewIndex]) return null;
    const view = cameraRig.heroViews[heroViewIndex];
    return Object.freeze({
      index: heroViewIndex,
      total: cameraRig.heroViews.length,
      id: view.id,
      labels: view.labels,
      occlusionCount: view.occlusionCount ?? 0,
    });
  }

  function focusNextHero() {
    if (!cameraRig.heroViews.length) return null;
    cancelTour();
    tourNarrativeProgress = 0;
    tourPhase = 'idle';
    tourClearanceLift = 0;
    heroViewIndex = (heroViewIndex + 1) % cameraRig.heroViews.length;
    const view = cameraRig.heroViews[heroViewIndex];
    camera.position.set(view.position.x, view.position.y, view.position.z);
    controls.target.set(view.target.x, view.target.y, view.target.z);
    controls.update();
    return getHeroViewState();
  }

  function startTour() {
    heroViewIndex = -1;
    if (budgetPolicy?.reducedMotion) {
      setDay(plan.profile.totalDays, { cancelTour: false });
      camera.position.set(
        cameraRig.home.position.x,
        cameraRig.home.position.y,
        cameraRig.home.position.z,
      );
      controls.target.set(cameraRig.home.target.x, cameraRig.home.target.y, cameraRig.home.target.z);
      tourNarrativeProgress = 0;
      tourPhase = 'idle';
      tourClearanceLift = 0;
      restoreTourPresentation();
      controls.update();
      onTourChange('reduced');
      return false;
    }
    tourPath = createCityTourPath(
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      cameraRig,
    );
    tourFocusPath = createCityTourFocusPath(cameraRig, {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z,
    });
    setDay(0, { cancelTour: false });
    tourActive = true;
    tourNarrativeProgress = 0;
    tourPhase = 'outer';
    tourClearanceLift = 0;
    controls.enabled = false;
    setPlaying(true);
    onTourChange(true);
    return true;
  }

  function cancelTour() {
    if (!tourActive) return false;
    tourActive = false;
    controls.enabled = true;
    tourNarrativeProgress = 0;
    tourPhase = 'idle';
    tourClearanceLift = 0;
    restoreTourPresentation();
    onTourChange(false);
    return true;
  }

  onTourPointerDown = () => {
    cancelTour();
  };

  canvas.addEventListener('pointerdown', onTourPointerDown, { capture: true });

  resize = () => {
    if (!renderer || destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = budgetPolicy?.computeDpr(width, height, { minDpr: 0.75, maxDpr: 1.5 }) ?? 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  function frame(timestamp) {
    raf = 0;
    if (!running || destroyed) return;
    const frameStart = performance.now();
    const delta = lastTime ? Math.min(0.05, (timestamp - lastTime) / 1000) : 0;
    lastTime = timestamp;
    elapsed += delta;

    if (playing) {
      currentDay = Math.min(plan.profile.totalDays, currentDay + delta * 9);
      if (currentDay >= plan.profile.totalDays) {
        playing = false;
        onPlaybackChange(false);
      }
      announceDay();
    }

    const roundedDay = Math.round(currentDay);
    if (roundedDay !== renderedDay) {
      renderedDay = roundedDay;
      updateConstruction(currentDay);
    }
    currentEnvironmentTime = budgetPolicy?.reducedMotion ? 0 : elapsed;
    updateVehicles(currentEnvironmentTime);
    updateHelicopter(currentEnvironmentTime);

    if (tourActive) {
      const constructionProgress = clamp01(currentDay / plan.profile.totalDays);
      const u = constructionProgressToTourProgress(constructionProgress, tourTimeline);
      const presentation = cityTourPresentationAt(u);
      tourNarrativeProgress = u;
      tourPhase = presentation.phase;
      const rawPoint = tourPath.pos(u);
      const clearance = resolveCityTourClearance(
        rawPoint,
        tourSafetyField,
        clamp01(u / 0.06),
      );
      const point = clearance.position;
      tourClearanceLift = clearance.lift;
      const focus = tourFocusPath.pos(u);
      camera.position.set(point.x, point.y, point.z);
      controls.target.set(focus.x, focus.y, focus.z);
      camera.lookAt(focus.x, focus.y, focus.z);
      camera.rotateZ(presentation.roll);
      if (Math.abs(camera.fov - presentation.fov) > 0.001) {
        camera.fov = presentation.fov;
        camera.updateProjectionMatrix();
      }
      if (constructionProgress >= 1) {
        tourActive = false;
        controls.enabled = true;
        tourNarrativeProgress = 1;
        tourPhase = 'complete';
        tourClearanceLift = 0;
        restoreTourPresentation();
        onTourChange(false);
      }
    } else {
      controls.update();
    }

    updateLod();
    const gl = renderer.getContext();
    if (gl.isContextLost()) {
      raf = requestAnimationFrame(frame);
      return;
    }
    try {
      renderer.render(scene, camera);
    } catch (error) {
      // WEBGL_lose_context can become observable one task before the browser
      // dispatches webglcontextlost. Three may then receive null shader logs;
      // treat that interval as a lost frame instead of surfacing a page error.
      if (gl.isContextLost() || lifecycle.getState().fallback) {
        stop();
        return;
      }
      throw error;
    }
    budgetSurface?.reportFrame(performance.now() - frameStart, {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
    raf = requestAnimationFrame(frame);
  }

  start = () => {
    if (!initialized || running || destroyed) return;
    running = true;
    lastTime = 0;
    raf = requestAnimationFrame(frame);
  };

  budgetSurface = coordinator.register({
    id: 'cityview-primary',
    element: canvas,
    observe: true,
    cost: 'high',
    targetFps: CITY_SCENE_RENDER_BUDGET[budgetClass].targetFps,
    onResume: () => {
      resumeRequested = true;
      start();
    },
    onPause: () => {
      resumeRequested = false;
      stop();
    },
    onResize: resize,
    onQualityChange: (policy) => {
      const enteredReducedMotion = budgetPolicy != null
        && !budgetPolicy.reducedMotion
        && policy.reducedMotion;
      budgetPolicy = policy;
      if (enteredReducedMotion) {
        const hadActiveTour = tourActive;
        tourActive = false;
        playing = false;
        controls.enabled = true;
        tourNarrativeProgress = 0;
        tourPhase = 'idle';
        tourClearanceLift = 0;
        setDay(plan.profile.totalDays, { cancelTour: false });
        camera.position.set(
          cameraRig.home.position.x,
          cameraRig.home.position.y,
          cameraRig.home.position.z,
        );
        controls.target.set(cameraRig.home.target.x, cameraRig.home.target.y, cameraRig.home.target.z);
        restoreTourPresentation();
        controls.update();
        onPlaybackChange(false);
        if (hadActiveTour) onTourChange(false);
        onTourChange('reduced');
      }
      resize();
    },
  });

  initialized = true;
  budgetPolicy = budgetSurface.getPolicy();
  resize();
  applyAssetVisibility();
  updateConstruction(currentDay);
  updateVehicles(0);
  updateHelicopter(0);
  announceDay(true);
  if (resumeRequested) start();

  return Object.freeze({
    get available() {
      return !destroyed && !lifecycle.getState().fallback;
    },
    getDay: () => currentDay,
    setDay,
    setPlaying,
    isPlaying: () => playing,
    isTourActive: () => tourActive,
    startTour,
    cancelTour,
    resetCamera,
    focusNextHero,
    getHeroViewState,
    setAssetVisibility,
    getAssetVisibility: () => assetVisibility,
    getTelemetry() {
      const surface = coordinator.getTelemetry().surfaces.find((record) => record.id === 'cityview-primary');
      const budgetEvaluation = evaluateCityRenderBudget({
        drawCalls: surface?.drawCalls ?? renderer?.info.render.calls ?? 0,
        triangles: surface?.triangles ?? renderer?.info.render.triangles ?? 0,
        p95Ms: surface?.p95Ms ?? 0,
      }, budgetClass);
      return Object.freeze({
        day: currentDay,
        profile: plan.profile.key,
        truthClass: plan.profile.truthClass,
        waterChannels: plan.water.length,
        heroLandmarks: plan.heroLandmarks.length,
        heroForms: heroFormCounts,
        heroComponents: heroRenderPlan.length,
        cameraRig: Object.freeze({
          home: cameraRig.home.id,
          heroViews: cameraRig.heroViews.length,
          currentHeroView: getHeroViewState()?.id ?? null,
          currentHeroOcclusions: getHeroViewState()?.occlusionCount ?? 0,
          tourOuterRadius: cameraRig.tour.outerRadius,
          tourCbdEndDay: tourTimeline.cbdEndDay,
          tourProgress: tourNarrativeProgress,
          tourPhase,
          safetyEnvelopes: tourSafetyField.envelopes.length,
          clearanceLift: tourClearanceLift,
        }),
        playing,
        tourActive,
        lod: cityLod,
        qualityTier: budgetPolicy?.qualityTier ?? 'balanced',
        reducedMotion: Boolean(budgetPolicy?.reducedMotion),
        active: Boolean(surface?.active),
        evaluatedWindows: surface?.evaluatedWindows ?? 0,
        p95Ms: surface?.p95Ms ?? 0,
        drawCalls: surface?.drawCalls ?? renderer?.info.render.calls ?? 0,
        triangles: surface?.triangles ?? renderer?.info.render.triangles ?? 0,
        thermalState: surface?.thermalState ?? 'nominal',
        budgetClass,
        budgetEvaluation,
        assetVisibility,
        facadeInstances: Object.freeze({
          strips: facadePlan.strips.length,
          balconies: facadePlan.balconies.length,
        }),
        constructionRender: Object.freeze({
          roads: Object.freeze({
            rendered: renderedRoadCount,
            planned: plan.roads.length,
          }),
          buildings: Object.freeze({
            shells: renderedBuildingShellCount,
            roofs: renderedBuildingRoofCount,
            rooftopAssets: renderedRooftopAssetCount,
            rooftopKinds: renderedRooftopKindCounts,
            plannedRooftopAssets: rooftopPlan.assets.length,
            skeletonParts: renderedBuildingSkeletonPartCount,
            slabs: renderedBuildingSlabCount,
            planned: plan.buildings.length,
          }),
          heroes: Object.freeze({
            components: renderedHeroComponentCount,
            roofs: renderedHeroRoofCount,
            skeletonParts: renderedHeroSkeletonPartCount,
            slabs: renderedHeroSlabCount,
            plannedComponents: heroRenderPlan.length,
            plannedLandmarks: plan.heroLandmarks.length,
          }),
        }),
        helicopter: Object.freeze({
          orbitRadius: helicopterRig.orbitRadius,
          height: helicopterRig.height,
          moving: !Boolean(budgetPolicy?.reducedMotion),
        }),
        cranes: Object.freeze({
          planned: cranePlans.length,
          active: activeCraneCount,
          maxActive: CITY_MAX_ACTIVE_CRANES,
        }),
        environment: Object.freeze({
          tier: environmentVisibility.tier,
          vehiclesVisible: assetVisibility.mobility ? visibleVehicleCount : 0,
          vehiclesPlanned: plan.vehicles.length,
          treesVisible: visibleTreeCount,
          treesPlanned: plan.trees.length,
          ridgePeaks: ridgePeakCount,
          leisureAssetsVisible: assetVisibility.landscape ? visibleLeisureAssetCount : 0,
          leisureAssetsPlanned: leisurePlan.assets.length,
          helicopterVisible: helicopter.visible,
          motionFrozen: Boolean(budgetPolicy?.reducedMotion),
        }),
        structureLineSegments: (
          lineSegmentCount(outlineGeometry)
          + lineSegmentCount(facadeOutlineGeometry)
          + lineSegmentCount(heroOutlineGeometry)
          + lineSegmentCount(leisureOutlineGeometry)
        ),
        curveLineDensity: curveLineOptions(),
        lifecycle: lifecycle.getState(),
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resumeRequested = false;
      stop();
      canvas.removeEventListener('pointerdown', onTourPointerDown, { capture: true });
      controls?.dispose();
      budgetSurface?.dispose();
      lifecycle.dispose();
      disposeThreeScene(scene, renderer);
    },
  });
  } catch (error) {
    destroyed = true;
    resumeRequested = false;
    stop();
    if (onTourPointerDown) {
      canvas.removeEventListener('pointerdown', onTourPointerDown, { capture: true });
    }
    controls?.dispose();
    budgetSurface?.dispose();
    lifecycle.dispose();
    disposeThreeScene(scene, renderer);
    throw error;
  }
}
