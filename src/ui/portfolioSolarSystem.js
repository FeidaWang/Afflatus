import * as THREE from 'three';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import {
  canAcquireWebGLContext,
  createWebGLContextLifecycle,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';

const SURFACE_ID = 'home:portfolio-solar-system';
const TAU = Math.PI * 2;

const BODY_PROFILES = [
  { color: '#f2b46f', accent: '#fff1c7', size: .72, speed: 0 },
  { color: '#79a9cf', accent: '#d8efff', size: .16, orbit: 1.05, speed: .125, phase: .42 },
  { color: '#d78b62', accent: '#ffd2a8', size: .23, orbit: 1.48, speed: .09, phase: 2.4 },
  { color: '#c4aa82', accent: '#fff0c9', size: .2, orbit: 1.9, speed: .068, phase: 4.1 },
  { color: '#7396bd', accent: '#d6eaff', size: .27, orbit: 2.35, speed: .052, phase: 1.48, ring: true },
  { color: '#9e7cb4', accent: '#eadcff', size: .25, orbit: 2.78, speed: .043, phase: 5.2 },
  { color: '#bc725e', accent: '#ffd1bd', size: .19, orbit: 3.2, speed: .036, phase: 3.23 },
  { color: '#6eafac', accent: '#d5fff4', size: .2, orbit: 3.61, speed: .031, phase: .95, ring: true },
  { color: '#788bc1', accent: '#e0e7ff', size: .17, orbit: 4.02, speed: .027, phase: 2.93 },
  { color: '#a16b7d', accent: '#ffd8e2', size: .14, orbit: 4.42, speed: .023, phase: 5.73 },
];

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeSurfaceTexture(primary, accent, seed, { sun = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = sun ? 512 : 256;
  canvas.height = sun ? 256 : 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const random = seeded(seed);
  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, accent);
  base.addColorStop(.34, primary);
  base.addColorStop(.72, primary);
  base.addColorStop(1, '#101723');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = sun ? 'screen' : 'soft-light';
  const bands = sun ? 34 : 18;
  for (let i = 0; i < bands; i += 1) {
    const y = random() * canvas.height;
    const amplitude = (sun ? 4 : 2) + random() * (sun ? 8 : 4);
    ctx.beginPath();
    for (let x = -8; x <= canvas.width + 8; x += 8) {
      const wave = Math.sin(x * (.025 + random() * .01) + i) * amplitude;
      if (x === -8) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.strokeStyle = sun
      ? `rgba(255,246,203,${.07 + random() * .14})`
      : `rgba(223,241,255,${.04 + random() * .12})`;
    ctx.lineWidth = .6 + random() * (sun ? 2.8 : 1.8);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'multiply';
  const spots = sun ? 42 : 16;
  for (let i = 0; i < spots; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 1 + random() * (sun ? 8 : 5);
    const spot = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spot.addColorStop(0, `rgba(15,23,37,${.12 + random() * .28})`);
    spot.addColorStop(1, 'rgba(15,23,37,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,247,220,1)');
  glow.addColorStop(.12, 'rgba(255,197,119,.9)');
  glow.addColorStop(.4, 'rgba(232,179,128,.22)');
  glow.addColorStop(1, 'rgba(232,179,128,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeOrbit(radius, opacity) {
  const points = [];
  for (let i = 0; i < 256; i += 1) {
    const angle = i / 256 * TAU;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({
    color: 0x7db8d2,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
}

export function initPortfolioSolarSystem({ canvas, host, picks = [] } = {}) {
  if (!canvas || !host || !canAcquireWebGLContext(SURFACE_ID)) return null;
  const renderCoordinator = getRenderBudgetCoordinator();
  let policy = renderCoordinator.getPolicy({ cost: 'high', targetFps: 45 });
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  let contextReady = true;
  let budgetActive = false;
  let running = false;
  let raf = 0;
  let lastTime = 0;
  let activeIndex = 0;
  let currentPicks = picks;

  const lifecycle = createWebGLContextLifecycle({
    id: SURFACE_ID,
    canvas,
    showFallback: false,
    onLost() {
      contextReady = false;
      stop();
      host.classList.remove('solar-ready');
    },
    onRestore() {
      renderer.resetState?.();
      contextReady = true;
      size();
      host.classList.add('solar-ready');
      if (budgetActive) start();
      else render(performance.now());
    },
    onFallback() {
      contextReady = false;
      stop();
      host.classList.remove('solar-ready');
    },
  });
  if (!lifecycle.canInitialize) {
    lifecycle.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    return null;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 60);
  // Leave generous frustum margin so the ninth orbit and its ticker remain
  // fully visible even inside the narrow mobile square.
  camera.position.set(0, 3.6, 14.2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0x9ccfff, 0x070b12, 1.15));
  const sunLight = new THREE.PointLight(0xffc985, 32, 17, 1.7);
  scene.add(sunLight);
  const rim = new THREE.DirectionalLight(0x88bfff, 1.5);
  rim.position.set(-5, 4, 7);
  scene.add(rim);

  const system = new THREE.Group();
  system.rotation.x = .16;
  system.rotation.z = -.04;
  scene.add(system);

  const glowTexture = makeGlowTexture();
  const sunGroup = new THREE.Group();
  const sunProfile = BODY_PROFILES[0];
  const sunTexture = makeSurfaceTexture(sunProfile.color, sunProfile.accent, 77, { sun: true });
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(sunProfile.size, 80, 48),
    new THREE.MeshBasicMaterial({ map: sunTexture, color: 0xffc783 }),
  );
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffbd72,
    transparent: true,
    opacity: .72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sunGlow.scale.set(2.55, 2.55, 1);
  sunGroup.add(sunGlow, sun);
  system.add(sunGroup);

  const bodies = [{ group: sunGroup, sphere: sun, glow: sunGlow, baseScale: 1 }];
  const orbitPivots = [];
  for (let index = 1; index < BODY_PROFILES.length; index += 1) {
    const profile = BODY_PROFILES[index];
    system.add(makeOrbit(profile.orbit, .055 + index * .004));
    const pivot = new THREE.Group();
    pivot.rotation.y = profile.phase;
    pivot.userData.speed = profile.speed;
    system.add(pivot);
    orbitPivots.push(pivot);

    const group = new THREE.Group();
    group.position.x = profile.orbit;
    pivot.add(group);
    const texture = makeSurfaceTexture(profile.color, profile.accent, 121 + index * 41);
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      color: profile.color,
      roughness: .66,
      metalness: .03,
      clearcoat: .2,
      clearcoatRoughness: .48,
      emissive: new THREE.Color(profile.color).multiplyScalar(.09),
      emissiveIntensity: .5,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(profile.size, 48, 32), material);
    sphere.rotation.z = (index % 2 ? 1 : -1) * (.08 + index * .018);
    group.add(sphere);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(profile.size * 1.065, 40, 24),
      new THREE.MeshBasicMaterial({
        color: profile.accent,
        transparent: true,
        opacity: .08,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(atmosphere);

    if (profile.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(profile.size * 1.42, profile.size * 2.25, 96),
        new THREE.MeshBasicMaterial({
          color: profile.accent,
          transparent: true,
          opacity: .3,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2 + .25;
      group.add(ring);
    }

    const selectionGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: profile.accent,
      transparent: true,
      opacity: .05,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    selectionGlow.scale.set(profile.size * 4.8, profile.size * 4.8, 1);
    group.add(selectionGlow);
    bodies.push({ group, sphere, glow: selectionGlow, baseScale: 1 });
  }

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  const random = seeded(909);
  for (let i = 0; i < 240; i += 1) {
    const angle = random() * TAU;
    const radius = 1.2 + random() * 4.6;
    starPositions.push(Math.cos(angle) * radius, (random() - .5) * 1.3, Math.sin(angle) * radius);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
    color: 0x8ecbe6,
    size: .017,
    transparent: true,
    opacity: .48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  system.add(stars);

  const projected = new THREE.Vector3();
  function syncNodePositions() {
    scene.updateMatrixWorld(true);
    const nodes = host.querySelectorAll('.convoy-node');
    bodies.forEach((body, index) => {
      const node = nodes[index];
      if (!node) return;
      body.group.getWorldPosition(projected);
      projected.project(camera);
      node.style.setProperty('--node-x', `${((projected.x + 1) * 50).toFixed(3)}%`);
      node.style.setProperty('--node-y', `${((1 - projected.y) * 50).toFixed(3)}%`);
    });
  }

  function applyActiveState() {
    bodies.forEach((body, index) => {
      const active = index === activeIndex;
      const weight = Number(currentPicks[index]?.pct) || 1;
      const weightScale = index === 0 ? 1 : .88 + Math.min(weight, 18) / 90;
      body.baseScale = weightScale;
      body.group.scale.setScalar(weightScale * (active ? 1.18 : 1));
      body.glow.material.opacity = index === 0
        ? (active ? .92 : .68)
        : (active ? .56 : .045);
      if (body.sphere.material?.emissiveIntensity !== undefined) {
        body.sphere.material.emissiveIntensity = active ? 1.8 : .5;
      }
    });
  }

  function size() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = policy.computeDpr(width, height, {
      minDpr: 1,
      maxDpr: policy.qualityTier === 'high' ? 2 : policy.qualityTier === 'balanced' ? 1.6 : 1.25,
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(now) {
    sun.rotation.y = now * .00006;
    bodies.slice(1).forEach((body, index) => {
      body.sphere.rotation.y = now * (.000035 + index * .000004);
    });
    renderer.render(scene, camera);
    syncNodePositions();
  }

  function loop(now) {
    const frameDuration = lastTime ? now - lastTime : 0;
    lastTime = now;
    const delta = Math.min(frameDuration || 16.7, 48) / 1000;
    orbitPivots.forEach((pivot) => {
      pivot.rotation.y += pivot.userData.speed * delta;
    });
    render(now);
    surface?.reportFrame(frameDuration, {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
    if (running) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || !contextReady || policy.reducedMotion) return;
    running = true;
    lastTime = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  let surface = null;
  size();
  applyActiveState();
  render(performance.now());
  host.classList.add('solar-ready');
  surface = renderCoordinator.register({
    id: SURFACE_ID,
    element: host,
    cost: 'high',
    targetFps: 45,
    onResume() {
      budgetActive = true;
      start();
    },
    onPause() {
      budgetActive = false;
      stop();
    },
    onResize() {
      size();
      if (!running) render(performance.now());
    },
    onQualityChange(nextPolicy) {
      policy = nextPolicy;
      if (nextPolicy.reducedMotion) stop();
    },
    onDispose() {
      lifecycle.dispose();
      disposeThreeScene(scene, renderer, [glowTexture, sunTexture]);
      host.classList.remove('solar-ready');
    },
  });

  return {
    setActive(index) {
      activeIndex = Math.max(0, Math.min(bodies.length - 1, Number(index) || 0));
      applyActiveState();
      if (!running) render(performance.now());
    },
    updatePicks(nextPicks = []) {
      currentPicks = nextPicks;
      applyActiveState();
      if (!running) render(performance.now());
    },
    destroy() {
      stop();
      surface?.dispose();
    },
  };
}
