import * as THREE from 'three';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import {
  canAcquireWebGLContext,
  createWebGLContextLifecycle,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';

const SURFACE_ID = 'home:portfolio-solar-system';
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const LIVE_SIM_DAYS_PER_SECOND = 0.06;

// Astronomical periods, axial tilts, eccentricities and inclinations follow
// real Solar System relationships. Distances and radii are perceptually
// compressed so every body remains legible inside a 520px atlas.
export const BODY_PROFILES = [
  { body: 'SUN', type: 'sun', size: .92, axialTilt: 7.25, rotationHours: 609.12, color: '#ffb34f', accent: '#fff2b2' },
  { body: 'MERCURY', type: 'rock', size: .27, orbit: 1.28, periodDays: 87.969, rotationHours: 1407.6, axialTilt: .034, eccentricity: .2056, inclination: 7.005, meanLongitude: 252.251, perihelion: 77.457, color: '#8c8176', accent: '#ded2c0' },
  { body: 'VENUS', type: 'venus', size: .35, orbit: 1.68, periodDays: 224.701, rotationHours: -5832.5, axialTilt: 177.36, eccentricity: .0068, inclination: 3.395, meanLongitude: 181.979, perihelion: 131.602, color: '#c8873f', accent: '#ffe1a3' },
  { body: 'EARTH', type: 'earth', size: .36, orbit: 2.08, periodDays: 365.256, rotationHours: 23.934, axialTilt: 23.44, eccentricity: .0167, inclination: .0001, meanLongitude: 100.464, perihelion: 102.937, color: '#2c79b7', accent: '#a6e4ff', clouds: true },
  { body: 'MARS', type: 'mars', size: .3, orbit: 2.48, periodDays: 686.98, rotationHours: 24.623, axialTilt: 25.19, eccentricity: .0934, inclination: 1.85, meanLongitude: 355.453, perihelion: 336.041, color: '#a94f2e', accent: '#ffc099' },
  { body: 'JUPITER', type: 'jupiter', size: .58, orbit: 2.96, periodDays: 4332.59, rotationHours: 9.925, axialTilt: 3.13, eccentricity: .0489, inclination: 1.303, meanLongitude: 34.404, perihelion: 14.753, color: '#b88d68', accent: '#f2d1a7' },
  { body: 'SATURN', type: 'saturn', size: .52, orbit: 3.43, periodDays: 10759.22, rotationHours: 10.656, axialTilt: 26.73, eccentricity: .0565, inclination: 2.485, meanLongitude: 49.944, perihelion: 92.431, color: '#c6aa70', accent: '#fff0bd', ring: 'saturn' },
  { body: 'URANUS', type: 'uranus', size: .42, orbit: 3.84, periodDays: 30688.5, rotationHours: -17.24, axialTilt: 97.77, eccentricity: .0457, inclination: .773, meanLongitude: 313.232, perihelion: 170.964, color: '#77c5c8', accent: '#d9ffff', ring: 'uranus' },
  { body: 'NEPTUNE', type: 'neptune', size: .41, orbit: 4.2, periodDays: 60182, rotationHours: 16.11, axialTilt: 28.32, eccentricity: .0113, inclination: 1.77, meanLongitude: 304.88, perihelion: 44.971, color: '#3155c8', accent: '#a9c9ff' },
  { body: 'PLUTO', type: 'pluto', size: .24, orbit: 4.55, periodDays: 90560, rotationHours: -153.293, axialTilt: 119.59, eccentricity: .2488, inclination: 17.16, meanLongitude: 238.929, perihelion: 224.067, color: '#9b7b68', accent: '#ead4c5' },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, value) => {
  const t = clamp((value - a) / Math.max(.00001, b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash2(x, y, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

function fbm(x, y, seed, octaves = 5) {
  let value = 0;
  let amplitude = .54;
  let frequency = 1;
  let normalizer = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise(x * frequency, y * frequency, seed + octave * 13.7) * amplitude;
    normalizer += amplitude;
    frequency *= 2.03;
    amplitude *= .49;
  }
  return value / normalizer;
}

function rgb(hex) {
  const color = new THREE.Color(hex);
  return [color.r * 255, color.g * 255, color.b * 255];
}

function blendColor(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function writePixel(data, offset, color, alpha = 255) {
  data[offset] = clamp(Math.round(color[0]), 0, 255);
  data[offset + 1] = clamp(Math.round(color[1]), 0, 255);
  data[offset + 2] = clamp(Math.round(color[2]), 0, 255);
  data[offset + 3] = clamp(Math.round(alpha), 0, 255);
}

function bodyColor(profile, u, v, noise, detail) {
  const latitude = (v - .5) * Math.PI;
  const band = Math.sin(latitude * 32 + noise * 5);
  if (profile.type === 'sun') {
    const cell = smoothstep(.2, .92, noise * .78 + detail * .34);
    const hot = rgb('#fff4b0');
    const gold = rgb('#ffad32');
    const ember = rgb('#c84c13');
    let color = blendColor(ember, gold, cell);
    color = blendColor(color, hot, smoothstep(.69, .96, detail));
    const spot = detail < .18 && noise < .38 ? .38 : 1;
    return color.map(channel => channel * spot);
  }
  if (profile.type === 'rock') {
    const low = rgb('#3d3935');
    const high = rgb('#b9ab99');
    return blendColor(low, high, smoothstep(.16, .88, noise * .72 + detail * .28));
  }
  if (profile.type === 'venus') {
    const amber = rgb('#9a5627');
    const cream = rgb('#f7d28b');
    const swirl = .5 + .5 * Math.sin(v * 74 + noise * 11 + Math.sin(u * TAU * 3));
    return blendColor(amber, cream, smoothstep(.08, .92, swirl * .55 + detail * .45));
  }
  if (profile.type === 'earth') {
    const continent = fbm(u * 6.1 + Math.sin(v * 7) * .45, v * 5.2, 305, 6);
    const polar = smoothstep(.78, .98, Math.abs(v - .5) * 2);
    if (polar > .18) return blendColor(rgb('#a6c6d2'), rgb('#f2fbff'), polar);
    if (continent > .535) {
      const elevation = smoothstep(.535, .82, continent);
      return blendColor(rgb('#507a3e'), rgb('#b6a36c'), elevation);
    }
    const oceanDepth = smoothstep(.25, .58, continent);
    return blendColor(rgb('#061a4c'), rgb('#1978b3'), oceanDepth);
  }
  if (profile.type === 'mars') {
    const polar = smoothstep(.86, .98, Math.abs(v - .5) * 2);
    const terrain = blendColor(rgb('#4b241c'), rgb('#c66a38'), smoothstep(.14, .9, noise));
    const dust = blendColor(terrain, rgb('#e3a06f'), detail * .24);
    return blendColor(dust, rgb('#f4ddd1'), polar);
  }
  if (profile.type === 'jupiter') {
    const bands = .5 + .5 * Math.sin(v * 92 + noise * 7 + Math.sin(u * TAU * 2) * 1.5);
    let color = blendColor(rgb('#6d493b'), rgb('#e5c59b'), smoothstep(.08, .92, bands * .74 + detail * .26));
    const dx = Math.min(Math.abs(u - .72), 1 - Math.abs(u - .72)) / .085;
    const dy = (v - .64) / .045;
    const redSpot = Math.exp(-(dx * dx + dy * dy));
    color = blendColor(color, rgb('#b94b32'), redSpot * .88);
    return color;
  }
  if (profile.type === 'saturn') {
    const bands = .5 + .5 * Math.sin(v * 118 + noise * 4);
    return blendColor(rgb('#826d50'), rgb('#ead7a5'), smoothstep(.08, .93, bands * .42 + detail * .58));
  }
  if (profile.type === 'uranus') {
    const tint = .48 + band * .07 + noise * .14;
    return blendColor(rgb('#438f98'), rgb('#b8edef'), tint);
  }
  if (profile.type === 'neptune') {
    const streak = Math.pow(smoothstep(.72, .94, detail), 2) * (.5 + .5 * Math.sin(u * 46 + v * 18));
    return blendColor(blendColor(rgb('#10246e'), rgb('#376bd5'), noise), rgb('#b8dcff'), streak * .8);
  }
  if (profile.type === 'pluto') {
    let color = blendColor(rgb('#4e403a'), rgb('#cbb09b'), smoothstep(.12, .88, noise));
    const x = (u - .56) * 7;
    const y = (v - .48) * 7;
    const heart = Math.pow(x * x + y * y - .72, 3) - x * x * y * y * y;
    color = blendColor(color, rgb('#e5d4c5'), heart < 0 ? .72 : 0);
    return color;
  }
  return rgb(profile.color);
}

function makeBodyMaps(profile, seed, anisotropy) {
  const width = 768;
  const height = 384;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = width;
  colorCanvas.height = bumpCanvas.height = height;
  const colorContext = colorCanvas.getContext('2d');
  const bumpContext = bumpCanvas.getContext('2d');
  if (!colorContext || !bumpContext) return { map: null, bumpMap: null };
  const colorImage = colorContext.createImageData(width, height);
  const bumpImage = bumpContext.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const warpedX = u * 7 + Math.sin(v * TAU * 2) * .18;
      const warpedY = v * 6;
      const noise = fbm(warpedX, warpedY, seed, 6);
      const detail = fbm(u * 24, v * 18, seed + 81, 4);
      const color = bodyColor(profile, u, v, noise, detail);
      const offset = (y * width + x) * 4;
      writePixel(colorImage.data, offset, color);
      const bump = clamp((noise * .66 + detail * .34) * 255, 0, 255);
      writePixel(bumpImage.data, offset, [bump, bump, bump]);
    }
  }
  colorContext.putImageData(colorImage, 0, 0);
  bumpContext.putImageData(bumpImage, 0, 0);

  // Craters are drawn into both albedo and height so rocky worlds retain
  // recognizable relief when enlarged by the atlas interaction.
  if (['rock', 'mars', 'pluto'].includes(profile.type)) {
    const count = profile.type === 'rock' ? 92 : 42;
    for (let i = 0; i < count; i += 1) {
      const cx = hash2(i, seed, 3) * width;
      const cy = hash2(seed, i, 9) * height;
      const radius = 1.5 + hash2(i * 2, seed, 17) * (profile.type === 'rock' ? 11 : 7);
      for (const [ctx, opacity] of [[colorContext, .21], [bumpContext, .34]]) {
        const crater = ctx.createRadialGradient(cx, cy, radius * .1, cx, cy, radius);
        crater.addColorStop(0, `rgba(5,7,10,${opacity})`);
        crater.addColorStop(.63, `rgba(5,7,10,${opacity * .72})`);
        crater.addColorStop(.78, `rgba(255,240,220,${opacity * .36})`);
        crater.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = crater;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = anisotropy;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.anisotropy = anisotropy;
  return { map, bumpMap };
}

function makeCloudTexture(anisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const u = x / canvas.width;
      const v = y / canvas.height;
      const cloud = fbm(u * 9 + Math.sin(v * 14) * .4, v * 8, 712, 6);
      const wisps = fbm(u * 28, v * 15, 903, 3);
      const alpha = smoothstep(.57, .79, cloud * .78 + wisps * .22) * 205;
      writePixel(image.data, (y * canvas.width + x) * 4, [230, 244, 255], alpha);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}

function makeGlowTexture(colors = ['rgba(255,252,229,1)', 'rgba(255,174,72,.62)', 'rgba(255,137,45,0)']) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const glow = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  glow.addColorStop(0, colors[0]);
  glow.addColorStop(.18, colors[1]);
  glow.addColorStop(1, colors[2]);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeNebulaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const nx = (x / canvas.width - .5) * 2;
      const ny = (y / canvas.height - .5) * 2;
      const radial = Math.exp(-(nx * nx * 1.8 + ny * ny * 5.2));
      const cloud = fbm(x / 116, y / 116, 1114, 6);
      const alpha = radial * smoothstep(.38, .82, cloud) * 112;
      writePixel(image.data, (y * canvas.width + x) * 4, [42 + cloud * 56, 58 + cloud * 72, 118 + cloud * 92], alpha);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRingTexture(kind, anisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 1) {
    const t = x / (canvas.width - 1);
    const fine = fbm(t * 82, 2.7, kind === 'saturn' ? 818 : 919, 4);
    const division = kind === 'saturn' && t > .54 && t < .61 ? .08 : 1;
    const edge = smoothstep(0, .045, t) * (1 - smoothstep(.955, 1, t));
    const alpha = edge * division * (.24 + fine * .68) * (kind === 'saturn' ? 235 : 102);
    const color = kind === 'saturn'
      ? blendColor(rgb('#78684d'), rgb('#f0ddb0'), fine)
      : blendColor(rgb('#5ea7aa'), rgb('#bff4f2'), fine);
    for (let y = 0; y < canvas.height; y += 1) writePixel(image.data, (y * canvas.width + x) * 4, color, alpha);
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}

function makeRingGeometry(innerRadius, outerRadius, radialSegments = 72) {
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 192, radialSegments);
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index += 1) {
    const radius = Math.hypot(positions.getX(index), positions.getY(index));
    const radialUv = clamp((radius - innerRadius) / (outerRadius - innerRadius), 0, 1);
    uvs.setXY(index, radialUv, .5);
  }
  uvs.needsUpdate = true;
  return geometry;
}

function solveEccentricAnomaly(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly;
  for (let i = 0; i < 6; i += 1) {
    eccentricAnomaly -= (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly)
      / (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  return eccentricAnomaly;
}

function orbitalPosition(profile, epochDays, target = new THREE.Vector3()) {
  if (!profile.periodDays) return target.set(0, 0, 0);
  const meanAnomaly = ((profile.meanLongitude - profile.perihelion) * DEG
    + epochDays / profile.periodDays * TAU) % TAU;
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, profile.eccentricity);
  const x = profile.orbit * (Math.cos(eccentricAnomaly) - profile.eccentricity);
  const z = profile.orbit * Math.sqrt(1 - profile.eccentricity ** 2) * Math.sin(eccentricAnomaly);
  target.set(x, 0, z);
  target.applyAxisAngle(new THREE.Vector3(1, 0, 0), profile.inclination * DEG);
  target.applyAxisAngle(new THREE.Vector3(0, 1, 0), profile.perihelion * DEG);
  return target;
}

function makeOrbit(profile, opacity) {
  const points = [];
  for (let i = 0; i < 320; i += 1) {
    const eccentricAnomaly = i / 320 * TAU;
    const x = profile.orbit * (Math.cos(eccentricAnomaly) - profile.eccentricity);
    const z = profile.orbit * Math.sqrt(1 - profile.eccentricity ** 2) * Math.sin(eccentricAnomaly);
    const point = new THREE.Vector3(x, 0, z);
    point.applyAxisAngle(new THREE.Vector3(1, 0, 0), profile.inclination * DEG);
    point.applyAxisAngle(new THREE.Vector3(0, 1, 0), profile.perihelion * DEG);
    points.push(point);
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: 0x6ea8c7,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function makeAtmosphere(profile) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(profile.accent) },
      uIntensity: { value: profile.type === 'earth' ? .72 : .36 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main(){
        vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
        vNormal=normalize(normalMatrix*normal);
        vViewPosition=mvPosition.xyz;
        gl_Position=projectionMatrix*mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main(){
        float rim=pow(1.0-max(dot(normalize(vNormal),normalize(-vViewPosition)),0.0),3.1);
        gl_FragColor=vec4(uColor,rim*uIntensity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(profile.size * 1.075, 64, 42), material);
}

function buildStarField() {
  const positions = [];
  const colors = [];
  const random = (index, channel) => hash2(index, channel, 2903);
  for (let i = 0; i < 1800; i += 1) {
    const radius = 10 + random(i, 1) * 18;
    const theta = random(i, 2) * TAU;
    const phi = Math.acos(2 * random(i, 3) - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
    const warmth = random(i, 4);
    colors.push(.55 + warmth * .45, .67 + warmth * .26, .88 + (1 - warmth) * .12);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    size: .035,
    vertexColors: true,
    transparent: true,
    opacity: .86,
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
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  let contextReady = true;
  let budgetActive = false;
  let running = false;
  let raf = 0;
  let lastFrame = 0;
  let startTime = performance.now();
  let activeIndex = 0;
  let currentPicks = picks;
  let surface = null;
  const epochMs = Date.now();
  const currentEpochDays = (epochMs - J2000_MS) / DAY_MS;
  const epochLabel = document.getElementById('solarEpoch');

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
      else render(performance.now(), 0);
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

  renderer.setClearColor(0x01030a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030a);
  scene.fog = new THREE.FogExp2(0x01030a, .018);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 80);
  camera.position.set(0, 4.25, 13.8);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x1c2d48, .72));
  const sunLight = new THREE.PointLight(0xffc473, 78, 22, 1.45);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.bias = -.0002;
  scene.add(sunLight);
  const coldRim = new THREE.DirectionalLight(0x6f9fff, 1.65);
  coldRim.position.set(-6, 5, 8);
  scene.add(coldRim);

  const system = new THREE.Group();
  system.rotation.x = .13;
  system.rotation.z = -.025;
  scene.add(system);
  const starField = buildStarField();
  scene.add(starField);

  const nebulaTexture = makeNebulaTexture();
  const nebulae = [
    [-5.2, 2.4, -6, 10.5, 0x4d63a8, .25],
    [5.8, -2.2, -8, 12.5, 0x815b85, .18],
    [0, 5.7, -10, 14, 0x395f75, .14],
  ].map(([x, y, z, scale, color, opacity]) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nebulaTexture,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    sprite.position.set(x, y, z);
    sprite.scale.set(scale, scale * .58, 1);
    scene.add(sprite);
    return sprite;
  });

  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const glowTexture = makeGlowTexture();
  const blueGlowTexture = makeGlowTexture(['rgba(226,247,255,1)', 'rgba(112,181,255,.42)', 'rgba(67,109,255,0)']);
  const bodies = [];

  BODY_PROFILES.forEach((profile, index) => {
    const group = new THREE.Group();
    group.name = profile.body;
    group.userData.targetScale = 1;
    group.userData.currentScale = 1;
    system.add(group);
    if (index > 0) system.add(makeOrbit(profile, .09 + index * .004));

    const detail = new THREE.Group();
    detail.rotation.z = profile.axialTilt * DEG;
    group.add(detail);
    const maps = makeBodyMaps(profile, 300 + index * 79, maxAnisotropy);
    const geometry = new THREE.SphereGeometry(profile.size, index === 0 ? 112 : 72, index === 0 ? 72 : 48);
    const material = index === 0
      ? new THREE.MeshBasicMaterial({ map: maps.map, color: 0xffca70 })
      : new THREE.MeshPhysicalMaterial({
        map: maps.map,
        bumpMap: maps.bumpMap,
        bumpScale: ['rock', 'mars', 'pluto'].includes(profile.type) ? .055 : .018,
        color: 0xffffff,
        roughness: ['earth', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(profile.type) ? .57 : .88,
        metalness: 0,
        clearcoat: ['earth', 'venus', 'uranus', 'neptune'].includes(profile.type) ? .34 : .08,
        clearcoatRoughness: .48,
        emissive: new THREE.Color(profile.color).multiplyScalar(.015),
        emissiveIntensity: .22,
      });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = index > 0;
    sphere.receiveShadow = index > 0;
    detail.add(sphere);

    let cloudLayer = null;
    if (profile.clouds) {
      const cloudMap = makeCloudTexture(maxAnisotropy);
      cloudLayer = new THREE.Mesh(
        new THREE.SphereGeometry(profile.size * 1.018, 72, 48),
        new THREE.MeshPhysicalMaterial({
          map: cloudMap,
          transparent: true,
          opacity: .72,
          depthWrite: false,
          roughness: .8,
          blending: THREE.NormalBlending,
        }),
      );
      detail.add(cloudLayer);
    }

    let atmosphere = null;
    if (index > 0) {
      atmosphere = makeAtmosphere(profile);
      detail.add(atmosphere);
    }

    let ring = null;
    if (profile.ring) {
      const ringTexture = makeRingTexture(profile.ring, maxAnisotropy);
      const innerRadius = profile.size * (profile.ring === 'saturn' ? 1.28 : 1.48);
      const outerRadius = profile.size * (profile.ring === 'saturn' ? 2.55 : 2.05);
      ring = new THREE.Mesh(
        makeRingGeometry(innerRadius, outerRadius, profile.ring === 'saturn' ? 96 : 48),
        new THREE.MeshBasicMaterial({
          map: ringTexture,
          color: 0xffffff,
          transparent: true,
          opacity: profile.ring === 'saturn' ? .94 : .5,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.NormalBlending,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      detail.add(ring);
    }

    const focusGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: index === 0 ? glowTexture : blueGlowTexture,
      color: profile.accent,
      transparent: true,
      opacity: index === 0 ? .86 : .035,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const glowSize = profile.size * (index === 0 ? 3.8 : 4.1);
    focusGlow.scale.set(glowSize, glowSize, 1);
    group.add(focusGlow);

    const prominences = [];
    if (index === 0) {
      for (let flareIndex = 0; flareIndex < 10; flareIndex += 1) {
        const angle = flareIndex / 10 * TAU + hash2(flareIndex, 2, 99) * .3;
        const flare = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture,
          color: flareIndex % 2 ? 0xff9a3d : 0xffd37c,
          transparent: true,
          opacity: .16,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }));
        flare.position.set(Math.cos(angle) * profile.size * 1.02, Math.sin(angle) * profile.size * 1.02, 0);
        flare.scale.set(.24, .1, 1);
        flare.material.rotation = angle;
        group.add(flare);
        prominences.push(flare);
      }
    }

    bodies.push({ profile, group, detail, sphere, cloudLayer, atmosphere, ring, focusGlow, prominences });
  });

  const projected = new THREE.Vector3();
  const orbitScratch = new THREE.Vector3();
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
      node.style.setProperty('--atlas-scale', body.group.userData.currentScale.toFixed(3));
    });
  }

  function applyActiveState() {
    host.dataset.activeBody = BODY_PROFILES[activeIndex]?.body || 'SUN';
    bodies.forEach((body, index) => {
      const active = index === activeIndex;
      const weight = Number(currentPicks[index]?.pct) || 1;
      const weightScale = index === 0 ? 1 : .94 + Math.min(weight, 18) / 160;
      const focusMultiplier = active ? (index === 0 ? 1.42 : body.profile.type === 'jupiter' ? 2.05 : 2.75) : 1;
      body.group.userData.targetScale = weightScale * focusMultiplier;
      body.focusGlow.material.opacity = index === 0
        ? (active ? .98 : .78)
        : (active ? .7 : .035);
      if (body.atmosphere) body.atmosphere.material.uniforms.uIntensity.value = active ? .98 : (body.profile.type === 'earth' ? .72 : .36);
      if (body.sphere.material?.emissiveIntensity !== undefined) body.sphere.material.emissiveIntensity = active ? .64 : .22;
    });
  }

  function size() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = policy.computeDpr(width, height, {
      minDpr: 1,
      maxDpr: policy.qualityTier === 'high' ? 2 : policy.qualityTier === 'balanced' ? 1.55 : 1.2,
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(now, delta) {
    const elapsedSeconds = Math.max(0, now - startTime) / 1000;
    const liveEpochDays = currentEpochDays + elapsedSeconds * LIVE_SIM_DAYS_PER_SECOND;
    bodies.forEach((body, index) => {
      if (index > 0) body.group.position.copy(orbitalPosition(body.profile, liveEpochDays, orbitScratch));
      const targetScale = body.group.userData.targetScale;
      body.group.userData.currentScale += (targetScale - body.group.userData.currentScale) * Math.min(1, delta * 5.6);
      body.group.scale.setScalar(body.group.userData.currentScale);

      const rotationDirection = Math.sign(body.profile.rotationHours || 1);
      const visualRotationSeconds = Math.max(2.8, Math.abs(body.profile.rotationHours || 600) * .22);
      body.sphere.rotation.y += rotationDirection * delta * TAU / visualRotationSeconds;
      if (body.cloudLayer) body.cloudLayer.rotation.y += delta * TAU / 8.6;
      if (body.ring) body.ring.rotation.z += delta * .015 * rotationDirection;
      if (index === 0) {
        const pulse = .86 + Math.sin(now * .0017) * .08;
        body.focusGlow.material.opacity = (index === activeIndex ? .98 : .78) * pulse;
        body.prominences.forEach((flare, flareIndex) => {
          const flarePulse = .72 + .28 * Math.sin(now * .0023 + flareIndex * 1.7);
          flare.material.opacity = .08 + flarePulse * .16;
          flare.scale.y = .08 + flarePulse * .07;
        });
      }
    });
    starField.rotation.y = now * .0000025;
    nebulae.forEach((sprite, index) => {
      sprite.material.rotation = Math.sin(now * .00004 + index) * .08;
    });
    renderer.render(scene, camera);
    syncNodePositions();
  }

  function loop(now) {
    const minFrame = 1000 / (policy.qualityTier === 'low' ? 30 : 45);
    if (lastFrame && now - lastFrame < minFrame) {
      if (running) raf = requestAnimationFrame(loop);
      return;
    }
    const frameDuration = lastFrame ? now - lastFrame : minFrame;
    lastFrame = now;
    render(now, Math.min(frameDuration, 60) / 1000);
    surface?.reportFrame(frameDuration, {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
    if (running) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || !contextReady || policy.reducedMotion) return;
    running = true;
    lastFrame = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  if (epochLabel) {
    const epoch = new Date(epochMs).toISOString().slice(0, 10);
    epochLabel.textContent = `${epoch} UTC · J2000 EPHEMERIS`;
  }
  size();
  applyActiveState();
  render(performance.now(), 1);
  host.classList.add('solar-ready', 'solar-atlas-ready');
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
      if (!running) render(performance.now(), 0);
    },
    onQualityChange(nextPolicy) {
      policy = nextPolicy;
      size();
      if (nextPolicy.reducedMotion) stop();
    },
    onDispose() {
      lifecycle.dispose();
      disposeThreeScene(scene, renderer, [glowTexture, blueGlowTexture, nebulaTexture]);
      host.classList.remove('solar-ready', 'solar-atlas-ready');
    },
  });

  return {
    setActive(index) {
      activeIndex = Math.trunc(clamp(Number(index) || 0, 0, bodies.length - 1));
      applyActiveState();
      if (policy.reducedMotion) {
        bodies.forEach((body) => {
          body.group.userData.currentScale = body.group.userData.targetScale;
        });
      }
      if (!running) render(performance.now(), 1 / 45);
    },
    updatePicks(nextPicks = []) {
      currentPicks = nextPicks;
      applyActiveState();
      if (!running) render(performance.now(), 1 / 45);
    },
    destroy() {
      stop();
      surface?.dispose();
    },
  };
}
