const TIERS = {
  low: {
    energy: 72,
    smoke: 36,
    lineEvents: 6,
    lineVertices: 256,
    beamSegments: 5,
    arcSegments: 7,
    arcBranches: 1,
    burst: 0.35,
    energyReserve: 18,
    smokeReserve: 9,
    plumeParticles: 1,
    plumeIntervalMs: 125,
    plumeLifeMs: 240,
    energyPointPx: 64,
    smokePointPx: 72,
  },
  medium: {
    energy: 192,
    smoke: 96,
    lineEvents: 14,
    lineVertices: 768,
    beamSegments: 8,
    arcSegments: 9,
    arcBranches: 2,
    burst: 0.65,
    energyReserve: 48,
    smokeReserve: 24,
    plumeParticles: 1,
    plumeIntervalMs: 84,
    plumeLifeMs: 300,
    energyPointPx: 96,
    smokePointPx: 104,
  },
  high: {
    energy: 384,
    smoke: 192,
    lineEvents: 28,
    lineVertices: 2048,
    beamSegments: 12,
    arcSegments: 12,
    arcBranches: 3,
    burst: 1,
    energyReserve: 96,
    smokeReserve: 48,
    plumeParticles: 2,
    plumeIntervalMs: 70,
    plumeLifeMs: 330,
    energyPointPx: 120,
    smokePointPx: 128,
  },
};

const ENERGY_FIRE = 1;
const ENERGY_CHARGE = 2;
const ENERGY_BLOOM = 3;
const ENERGY_PLUME = 4;
const LINE_BEAM = 1;
const LINE_SHIELD = 2;
const PRIORITY_LOW = 1;
const PRIORITY_IMPORTANT = 2;
const PRIORITY_CRITICAL = 3;

function normalizeTier(tier) {
  if (tier === 'low' || tier === 'lite' || tier === 0) return 'low';
  if (tier === 'high' || tier === 'ultra' || tier === 'cinematic' || tier === 2) return 'high';
  return 'medium';
}

function component(value, key, index, fallback = 0) {
  const candidate = value?.[key] ?? value?.[index];
  return Number.isFinite(candidate) ? candidate : fallback;
}

function clampLife(value, fallback) {
  return Math.min(8000, Math.max(16, Number.isFinite(value) ? value : fallback));
}

function unitNoise(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function countActive(values, limit) {
  let count = 0;
  for (let index = 0; index < limit; index += 1) count += values[index];
  return count;
}

function countPriority(active, priorities, limit, priority) {
  let count = 0;
  for (let index = 0; index < limit; index += 1) {
    if (active[index] && priorities[index] === priority) count += 1;
  }
  return count;
}

function createPointLayer(THREE, capacity, { smoke, glowTexture }) {
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const alphas = new Float32Array(capacity);
  const kinds = new Float32Array(capacity);
  const seeds = new Float32Array(capacity);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  for (const attribute of Object.values(geometry.attributes)) attribute.setUsage(THREE.DynamicDrawUsage);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCameraScale: { value: 100 },
      uGlowMap: { value: glowTexture ?? null },
      uUseGlowMap: { value: glowTexture ? 1 : 0 },
      uTime: { value: 0 },
      uMaxPointSize: { value: smoke ? 104 : 96 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aKind;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;
      varying float vSeed;
      varying vec2 vSpin;
      varying float vFlicker;
      uniform float uCameraScale;
      uniform float uMaxPointSize;
      uniform float uTime;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * uCameraScale / max(4.0, -viewPosition.z), 1.0, uMaxPointSize);
        vColor = color;
        vAlpha = aAlpha;
        vKind = aKind;
        vSeed = aSeed;
        float spinAngle = aSeed * 6.2831853 + uTime * (0.16 + fract(aSeed * 7.73) * 0.24);
        vSpin = vec2(cos(spinAngle), sin(spinAngle));
        vFlicker = 0.9 + 0.1 * sin(uTime * 19.0 + aSeed * 47.0);
      }
    `,
    fragmentShader: smoke ? `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying vec2 vSpin;
      uniform sampler2D uGlowMap;
      uniform float uUseGlowMap;
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        if (radius > 1.0) discard;
        vec2 rolled = mat2(vSpin.x, -vSpin.y, vSpin.y, vSpin.x) * centered;
        float cloud = smoothstep(1.0, 0.08, radius);
        float billow = sin(rolled.x * 17.0 + rolled.y * 23.0 + vSeed * 31.0);
        float breakup = 0.78 + 0.22 * billow;
        vec4 texel = texture2D(uGlowMap, rolled + 0.5);
        float textureMask = max(texel.a, max(texel.r, max(texel.g, texel.b)));
        cloud *= mix(1.0, textureMask, uUseGlowMap) * clamp(breakup, 0.32, 1.0);
        gl_FragColor = vec4(vColor * (0.82 + cloud * 0.18), vAlpha * cloud);
      }
    ` : `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;
      varying float vSeed;
      varying float vFlicker;
      uniform sampler2D uGlowMap;
      uniform float uUseGlowMap;
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        if (radius > 1.0) discard;
        float halo = exp(-3.8 * radius * radius);
        float core = smoothstep(0.44, 0.0, radius);
        float bloomWeight = step(2.5, vKind);
        float plumeWeight = step(3.5, vKind);
        float energy = mix(core + halo * 0.48, core * 0.72 + halo, bloomWeight);
        energy = mix(energy, core * 1.08 + halo * 0.62, plumeWeight) * vFlicker;
        vec4 texel = texture2D(uGlowMap, gl_PointCoord);
        float textureMask = max(texel.a, max(texel.r, max(texel.g, texel.b)));
        energy *= mix(1.0, textureMask, uUseGlowMap);
        gl_FragColor = vec4(vColor * (1.0 + core * 0.7), vAlpha * energy);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = smoke ? 40 : 41;

  return {
    points,
    geometry,
    material,
    positions,
    colors,
    sizes,
    alphas,
    kinds,
    seeds,
    active: new Uint8Array(capacity),
    kind: new Uint8Array(capacity),
    priority: new Uint8Array(capacity),
    born: new Float64Array(capacity),
    death: new Float64Array(capacity),
    origin: new Float32Array(capacity * 3),
    velocity: new Float32Array(capacity * 3),
    baseSize: new Float32Array(capacity),
    phase: new Float32Array(capacity),
    spread: new Float32Array(capacity),
    cursor: 0,
  };
}

/**
 * Bounded combat VFX for the current WebGL2/Three r160 renderer.
 * The three shared primitives keep the entire layer to three draw calls:
 * additive energy points, alpha-blended smoke points, and linked line segments.
 */
export function createCombatVfx(THREE, {
  scene,
  glowTexture = null,
  qualityTier = 'medium',
} = {}) {
  const maximum = TIERS.high;
  const energy = createPointLayer(THREE, maximum.energy, { smoke: false, glowTexture });
  const smoke = createPointLayer(THREE, maximum.smoke, { smoke: true, glowTexture });
  const linePositions = new Float32Array(maximum.lineVertices * 3);
  const lineColors = new Float32Array(maximum.lineVertices * 3);
  const lineAlphas = new Float32Array(maximum.lineVertices);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
  lineGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(lineAlphas, 1));
  for (const attribute of Object.values(lineGeometry.attributes)) attribute.setUsage(THREE.DynamicDrawUsage);
  lineGeometry.setDrawRange(0, 0);

  const lineMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.frustumCulled = false;
  lines.renderOrder = 42;

  scene.add(smoke.points, energy.points, lines);

  const lineActive = new Uint8Array(maximum.lineEvents);
  const lineKind = new Uint8Array(maximum.lineEvents);
  const linePriority = new Uint8Array(maximum.lineEvents);
  const lineBorn = new Float64Array(maximum.lineEvents);
  const lineDeath = new Float64Array(maximum.lineEvents);
  const lineData = new Float32Array(maximum.lineEvents * 12);
  const scratchColor = new THREE.Color();
  const dropped = { energy: 0, smoke: 0, lines: 0 };
  const preempted = { energy: 0, smoke: 0, lines: 0 };
  const plumeEmitterTimes = new Map();
  let tierName = normalizeTier(qualityTier);
  let tier = TIERS[tierName];
  let lineCursor = 0;
  let serial = 1;
  let disposed = false;
  let lastNow = typeof performance !== 'undefined' ? performance.now() : Date.now();

  function prepareColor(value, fallback) {
    scratchColor.set(value ?? fallback);
    return scratchColor;
  }

  function allocatePoint(pool, limit, now, dropKey, priority, reserve = 0) {
    const allocationLimit = priority === PRIORITY_LOW
      ? Math.max(1, limit - Math.max(0, reserve))
      : limit;
    let replacement = -1;
    let replacementPriority = priority;
    let oldestBorn = Infinity;
    for (let offset = 0; offset < allocationLimit; offset += 1) {
      const index = (pool.cursor + offset) % allocationLimit;
      if (!pool.active[index] || pool.death[index] <= now) {
        pool.cursor = (index + 1) % allocationLimit;
        pool.active[index] = 1;
        return index;
      }
      if (pool.priority[index] < replacementPriority
        || (pool.priority[index] === replacementPriority && pool.priority[index] < priority && pool.born[index] < oldestBorn)) {
        replacement = index;
        replacementPriority = pool.priority[index];
        oldestBorn = pool.born[index];
      }
    }
    // Low-priority callers scan only allocationLimit, leaving the tail reserve
    // untouched. Important and critical callers use limit above, so they see
    // the entire pool and may reclaim the lowest-priority oldest live slot.
    if (replacement >= 0) {
      pool.cursor = (replacement + 1) % allocationLimit;
      pool.active[replacement] = 1;
      preempted[dropKey] += 1;
      return replacement;
    }
    dropped[dropKey] += 1;
    return -1;
  }

  function seedPoint(pool, limit, dropKey, {
    now,
    lifeMs,
    kind,
    x,
    y,
    z,
    vx = 0,
    vy = 0,
    vz = 0,
    color,
    size,
    phase = 0,
    spread = 0,
    priority = PRIORITY_IMPORTANT,
    reserve = 0,
    seed = serial,
  }) {
    const index = allocatePoint(pool, limit, now, dropKey, priority, reserve);
    if (index < 0) return false;
    const offset = index * 3;
    pool.kind[index] = kind;
    pool.priority[index] = priority;
    pool.born[index] = now;
    pool.death[index] = now + lifeMs;
    pool.origin[offset] = x;
    pool.origin[offset + 1] = y;
    pool.origin[offset + 2] = z;
    pool.velocity[offset] = vx;
    pool.velocity[offset + 1] = vy;
    pool.velocity[offset + 2] = vz;
    pool.colors[offset] = color.r;
    pool.colors[offset + 1] = color.g;
    pool.colors[offset + 2] = color.b;
    pool.baseSize[index] = size;
    pool.phase[index] = phase;
    pool.spread[index] = spread;
    pool.kinds[index] = kind;
    pool.seeds[index] = unitNoise(seed + 0.371);
    pool.geometry.getAttribute('color').needsUpdate = true;
    pool.geometry.getAttribute('aKind').needsUpdate = true;
    pool.geometry.getAttribute('aSeed').needsUpdate = true;
    return true;
  }

  function spawnBloom(x, y, z, color, size, lifeMs, now, priority = PRIORITY_CRITICAL) {
    return seedPoint(energy, tier.energy, 'energy', {
      now,
      lifeMs,
      kind: ENERGY_BLOOM,
      x,
      y,
      z,
      color,
      size,
      priority,
      reserve: tier.energyReserve,
    });
  }

  function allocateLine(now, priority = PRIORITY_IMPORTANT) {
    let replacement = -1;
    let replacementPriority = priority;
    let oldestBorn = Infinity;
    for (let offset = 0; offset < tier.lineEvents; offset += 1) {
      const index = (lineCursor + offset) % tier.lineEvents;
      if (!lineActive[index] || lineDeath[index] <= now) {
        lineCursor = (index + 1) % tier.lineEvents;
        lineActive[index] = 1;
        return index;
      }
      if (linePriority[index] < replacementPriority
        || (linePriority[index] === replacementPriority && linePriority[index] < priority && lineBorn[index] < oldestBorn)) {
        replacement = index;
        replacementPriority = linePriority[index];
        oldestBorn = lineBorn[index];
      }
    }
    if (replacement >= 0) {
      lineCursor = (replacement + 1) % tier.lineEvents;
      lineActive[replacement] = 1;
      preempted.lines += 1;
      return replacement;
    }
    dropped.lines += 1;
    return -1;
  }

  function setQuality(nextTier) {
    tierName = normalizeTier(nextTier);
    tier = TIERS[tierName];
    energy.geometry.setDrawRange(0, tier.energy);
    smoke.geometry.setDrawRange(0, tier.smoke);
    energy.material.uniforms.uMaxPointSize.value = tier.energyPointPx;
    smoke.material.uniforms.uMaxPointSize.value = tier.smokePointPx;
    for (let index = tier.energy; index < maximum.energy; index += 1) {
      energy.active[index] = 0;
      energy.priority[index] = 0;
      energy.alphas[index] = 0;
    }
    for (let index = tier.smoke; index < maximum.smoke; index += 1) {
      smoke.active[index] = 0;
      smoke.priority[index] = 0;
      smoke.alphas[index] = 0;
    }
    for (let index = tier.lineEvents; index < maximum.lineEvents; index += 1) {
      lineActive[index] = 0;
      linePriority[index] = 0;
    }
    energy.geometry.getAttribute('aAlpha').needsUpdate = true;
    smoke.geometry.getAttribute('aAlpha').needsUpdate = true;
    energy.cursor %= tier.energy;
    smoke.cursor %= tier.smoke;
    lineCursor %= tier.lineEvents;
    plumeEmitterTimes.clear();
    return tierName;
  }

  function linkedBeam({
    from,
    to,
    color = 0x54dcff,
    lifeMs = 220,
    jitter = 0.12,
  } = {}) {
    if (disposed || !from || !to) return false;
    const now = lastNow;
    const index = allocateLine(now, PRIORITY_IMPORTANT);
    if (index < 0) return false;
    const offset = index * 12;
    const beamColor = prepareColor(color, 0x54dcff);
    lineKind[index] = LINE_BEAM;
    linePriority[index] = PRIORITY_IMPORTANT;
    lineBorn[index] = now;
    lineDeath[index] = now + clampLife(lifeMs, 220);
    lineData[offset] = component(from, 'x', 0);
    lineData[offset + 1] = component(from, 'y', 1);
    lineData[offset + 2] = component(from, 'z', 2);
    lineData[offset + 3] = component(to, 'x', 0);
    lineData[offset + 4] = component(to, 'y', 1);
    lineData[offset + 5] = component(to, 'z', 2);
    lineData[offset + 6] = beamColor.r;
    lineData[offset + 7] = beamColor.g;
    lineData[offset + 8] = beamColor.b;
    lineData[offset + 9] = Math.max(0, jitter);
    lineData[offset + 10] = serial += 1;
    spawnBloom(lineData[offset], lineData[offset + 1], lineData[offset + 2], beamColor, 0.34, 120, now, PRIORITY_IMPORTANT);
    spawnBloom(lineData[offset + 3], lineData[offset + 4], lineData[offset + 5], beamColor, 0.48, 150, now, PRIORITY_IMPORTANT);
    return true;
  }

  function charge({
    at,
    color = 0x69efff,
    lifeMs = 700,
    radius = 0.8,
  } = {}) {
    if (disposed || !at) return false;
    const now = lastNow;
    const duration = clampLife(lifeMs, 700);
    const chargeColor = prepareColor(color, 0x69efff);
    const x = component(at, 'x', 0);
    const y = component(at, 'y', 1);
    const z = component(at, 'z', 2);
    const count = Math.max(4, Math.round(28 * tier.burst));
    let spawned = false;
    for (let index = 0; index < count; index += 1) {
      const phase = (index / count) * Math.PI * 2 + unitNoise(serial + index) * 0.25;
      spawned = seedPoint(energy, tier.energy, 'energy', {
        now,
        lifeMs: duration,
        kind: ENERGY_CHARGE,
        x,
        y,
        z,
        color: chargeColor,
        size: 0.09 + Math.max(0.1, radius) * 0.05,
        phase,
        spread: Math.max(0.1, radius),
        priority: PRIORITY_CRITICAL,
        reserve: tier.energyReserve,
        seed: serial + index,
      }) || spawned;
    }
    spawnBloom(x, y, z, chargeColor, Math.max(0.3, radius * 0.85), duration, now);
    serial += count;
    return spawned;
  }

  function fireSmoke({
    at,
    velocity,
    color = 0xff8a2b,
    lifeMs = 720,
    scale = 1,
    nuclear = false,
    continuous = false,
  } = {}) {
    if (disposed || !at) return false;
    const now = lastNow;
    const duration = clampLife(lifeMs, 720);
    const hotColor = prepareColor(color, 0xff8a2b);
    const hotR = hotColor.r;
    const hotG = hotColor.g;
    const hotB = hotColor.b;
    const x = component(at, 'x', 0);
    const y = component(at, 'y', 1);
    const z = component(at, 'z', 2);
    const vx = component(velocity, 'x', 0);
    const vy = component(velocity, 'y', 1, 0.35);
    const vz = component(velocity, 'z', 2);
    // World-size is bounded before it reaches the point-size shader clamp. It
    // prevents a malformed event from covering most of the viewport with a
    // stack of translucent quads, while retaining the authored nuke scale.
    const safeScale = Math.min(nuclear ? 5 : 3.6, Math.max(0.05, scale));
    const multiplier = nuclear ? 1.55 : 1;
    const priority = continuous ? PRIORITY_LOW : PRIORITY_CRITICAL;
    const hotCount = Math.max(continuous ? 2 : 3, Math.round((continuous ? 5 : 22) * tier.burst * multiplier));
    const smokeCount = Math.max(continuous ? 1 : 2, Math.round((continuous ? 3 : 18) * tier.burst * multiplier));
    let spawned = false;

    for (let index = 0; index < hotCount; index += 1) {
      const seed = serial + index;
      const rx = unitNoise(seed) - 0.5;
      const ry = unitNoise(seed + 19) - 0.5;
      const rz = unitNoise(seed + 41) - 0.5;
      const whiteHeat = 0.12 + unitNoise(seed + 61) * (nuclear ? 0.46 : 0.3);
      scratchColor.setRGB(
        hotR + (1 - hotR) * whiteHeat,
        hotG + (1 - hotG) * whiteHeat,
        hotB + (1 - hotB) * whiteHeat,
      );
      spawned = seedPoint(energy, tier.energy, 'energy', {
        now,
        lifeMs: duration * (0.42 + unitNoise(seed + 7) * 0.46),
        kind: ENERGY_FIRE,
        x: x + rx * safeScale * 0.18,
        y: y + ry * safeScale * 0.18,
        z: z + rz * safeScale * 0.18,
        vx: vx + rx * safeScale * (nuclear ? 2.8 : 1.1),
        vy: vy + ry * safeScale * (nuclear ? 2.8 : 1.1),
        vz: vz + rz * safeScale * (nuclear ? 2.8 : 1.1),
        color: scratchColor,
        size: safeScale * (nuclear ? 0.48 : 0.2) * (0.75 + unitNoise(seed + 3) * 0.5),
        phase: unitNoise(seed + 5) * Math.PI * 2,
        spread: safeScale * 0.06,
        priority,
        reserve: tier.energyReserve,
        seed,
      }) || spawned;
    }

    const smokeColor = scratchColor.setRGB(
      Math.min(0.38, (nuclear ? 0.19 : 0.1) + hotR * 0.11),
      Math.min(0.34, (nuclear ? 0.15 : 0.12) + hotG * 0.08),
      Math.min(0.38, (nuclear ? 0.17 : 0.15) + hotB * 0.09),
    );
    for (let index = 0; index < smokeCount; index += 1) {
      const seed = serial + hotCount + index;
      const rx = unitNoise(seed) - 0.5;
      const ry = unitNoise(seed + 23) - 0.5;
      const rz = unitNoise(seed + 47) - 0.5;
      spawned = seedPoint(smoke, tier.smoke, 'smoke', {
        now,
        lifeMs: duration * (0.7 + unitNoise(seed + 11) * 0.55),
        kind: 1,
        x: x + rx * safeScale * 0.25,
        y: y + ry * safeScale * 0.25,
        z: z + rz * safeScale * 0.25,
        vx: vx * 0.55 + rx * safeScale * (nuclear ? 1.4 : 0.45),
        vy: vy * 0.55 + Math.abs(ry) * safeScale * 0.55,
        vz: vz * 0.55 + rz * safeScale * (nuclear ? 1.4 : 0.45),
        color: smokeColor,
        size: safeScale * (nuclear ? 0.72 : 0.3) * (0.8 + unitNoise(seed + 17) * 0.5),
        phase: unitNoise(seed + 29) * Math.PI * 2,
        spread: safeScale * 0.08,
        priority,
        reserve: tier.smokeReserve,
        seed,
      }) || spawned;
    }
    spawnBloom(
      x,
      y,
      z,
      scratchColor.setRGB(hotR, hotG, hotB),
      safeScale * (nuclear ? 2.8 : continuous ? 0.34 : 0.55),
      Math.min(duration, continuous ? 180 : 420),
      now,
      priority,
    );
    serial += hotCount + smokeCount;
    return spawned;
  }

  /**
   * Emits a bounded ion/flame plume into the two existing point layers.
   * `direction` (or the backwards-compatible `velocity` alias) points away
   * from the nozzle. Supplying a stable emitterId enables tier-aware cadence
   * limiting, so callers may invoke this once per frame without flooding the
   * pool. Plumes are deliberately low priority: impacts, shields and charge
   * effects can reclaim their oldest slots when the scene becomes saturated.
   */
  function plume({
    at,
    direction,
    velocity,
    color = 0x58cfff,
    coreColor = 0xeaffff,
    lifeMs,
    scale = 1,
    power = 1,
    smoke: smokeAmount = 0,
    emitterId,
    rateHz,
  } = {}) {
    if (disposed || !at) return false;
    const now = lastNow;
    const safePower = Math.min(1.5, Math.max(0, Number.isFinite(power) ? power : 1));
    if (safePower <= 0.01) return false;

    if (emitterId !== undefined && emitterId !== null) {
      const key = String(emitterId);
      const requestedInterval = Number.isFinite(rateHz) && rateHz > 0
        ? 1000 / Math.min(60, rateHz)
        : tier.plumeIntervalMs;
      const interval = Math.max(16, requestedInterval);
      const previous = plumeEmitterTimes.get(key);
      if (Number.isFinite(previous) && now - previous < interval) return false;
      plumeEmitterTimes.delete(key);
      plumeEmitterTimes.set(key, now);
      while (plumeEmitterTimes.size > 64) {
        plumeEmitterTimes.delete(plumeEmitterTimes.keys().next().value);
      }
    }

    const x = component(at, 'x', 0);
    const y = component(at, 'y', 1);
    const z = component(at, 'z', 2);
    const axis = direction ?? velocity;
    let dx = component(axis, 'x', 0);
    let dy = component(axis, 'y', 1);
    let dz = component(axis, 'z', 2, 1);
    const axisLength = Math.hypot(dx, dy, dz) || 1;
    dx /= axisLength;
    dy /= axisLength;
    dz /= axisLength;

    let px;
    let py;
    let pz;
    if (Math.abs(dy) < 0.9) {
      px = -dz;
      py = 0;
      pz = dx;
    } else {
      px = 0;
      py = dz;
      pz = -dy;
    }
    const perpendicularLength = Math.hypot(px, py, pz) || 1;
    px /= perpendicularLength;
    py /= perpendicularLength;
    pz /= perpendicularLength;
    const qx = dy * pz - dz * py;
    const qy = dz * px - dx * pz;
    const qz = dx * py - dy * px;

    const tailColor = prepareColor(color, 0x58cfff);
    const tailR = tailColor.r;
    const tailG = tailColor.g;
    const tailB = tailColor.b;
    const hotCore = prepareColor(coreColor, 0xeaffff);
    const coreR = hotCore.r;
    const coreG = hotCore.g;
    const coreB = hotCore.b;
    const safeScale = Math.min(2.8, Math.max(0.05, Number.isFinite(scale) ? scale : 1));
    const duration = clampLife(lifeMs, tier.plumeLifeMs);
    const particleCount = Math.max(1, Math.round(
      tier.plumeParticles * Math.min(1.35, Math.max(0.5, safePower)),
    ));
    let spawned = false;

    for (let index = 0; index < particleCount; index += 1) {
      const seed = serial + index;
      const radialAngle = unitNoise(seed + 5) * Math.PI * 2;
      const radialAmount = safeScale * (0.025 + unitNoise(seed + 17) * 0.075);
      const radialX = (px * Math.cos(radialAngle) + qx * Math.sin(radialAngle)) * radialAmount;
      const radialY = (py * Math.cos(radialAngle) + qy * Math.sin(radialAngle)) * radialAmount;
      const radialZ = (pz * Math.cos(radialAngle) + qz * Math.sin(radialAngle)) * radialAmount;
      const speed = safeScale * (1.15 + safePower * 1.65) * (0.72 + unitNoise(seed + 29) * 0.52);
      const heat = 0.28 + unitNoise(seed + 37) * 0.58;
      scratchColor.setRGB(
        tailR + (coreR - tailR) * heat,
        tailG + (coreG - tailG) * heat,
        tailB + (coreB - tailB) * heat,
      );
      spawned = seedPoint(energy, tier.energy, 'energy', {
        now,
        lifeMs: duration * (0.76 + unitNoise(seed + 43) * 0.4),
        kind: ENERGY_PLUME,
        x: x + radialX,
        y: y + radialY,
        z: z + radialZ,
        vx: dx * speed + radialX * 3.4,
        vy: dy * speed + radialY * 3.4,
        vz: dz * speed + radialZ * 3.4,
        color: scratchColor,
        size: safeScale * (0.13 + safePower * 0.09) * (0.78 + unitNoise(seed + 53) * 0.42),
        phase: radialAngle,
        spread: safeScale * 0.035,
        priority: PRIORITY_LOW,
        reserve: tier.energyReserve,
        seed,
      }) || spawned;
    }

    const safeSmoke = Math.min(1.5, Math.max(0, Number.isFinite(smokeAmount) ? smokeAmount : 0));
    const smokeCount = tierName === 'low' || safeSmoke <= 0.04
      ? 0
      : Math.min(tierName === 'high' ? 2 : 1, Math.ceil(safeSmoke * tier.burst));
    for (let index = 0; index < smokeCount; index += 1) {
      const seed = serial + particleCount + index;
      const jitterX = (unitNoise(seed + 7) - 0.5) * safeScale * 0.12;
      const jitterY = (unitNoise(seed + 19) - 0.5) * safeScale * 0.12;
      const jitterZ = (unitNoise(seed + 31) - 0.5) * safeScale * 0.12;
      scratchColor.setRGB(
        Math.min(0.34, 0.08 + tailR * 0.16),
        Math.min(0.34, 0.1 + tailG * 0.14),
        Math.min(0.38, 0.13 + tailB * 0.15),
      );
      spawned = seedPoint(smoke, tier.smoke, 'smoke', {
        now,
        lifeMs: duration * (1.1 + unitNoise(seed + 41) * 0.38),
        kind: 1,
        x: x + jitterX,
        y: y + jitterY,
        z: z + jitterZ,
        vx: dx * safeScale * 0.62 + jitterX,
        vy: dy * safeScale * 0.62 + jitterY,
        vz: dz * safeScale * 0.62 + jitterZ,
        color: scratchColor,
        size: safeScale * (0.2 + safeSmoke * 0.12),
        phase: unitNoise(seed + 59) * Math.PI * 2,
        spread: safeScale * 0.065,
        priority: PRIORITY_LOW,
        reserve: tier.smokeReserve,
        seed,
      }) || spawned;
    }
    serial += particleCount + smokeCount;
    return spawned;
  }

  function shieldArc({
    center,
    hitDirection,
    radius = 1,
    color = 0x65e8ff,
    lifeMs = 320,
  } = {}) {
    if (disposed || !center || !hitDirection) return false;
    const now = lastNow;
    const index = allocateLine(now, PRIORITY_CRITICAL);
    if (index < 0) return false;
    const offset = index * 12;
    const arcColor = prepareColor(color, 0x65e8ff);
    let dx = component(hitDirection, 'x', 0);
    let dy = component(hitDirection, 'y', 1);
    let dz = component(hitDirection, 'z', 2, 1);
    const length = Math.hypot(dx, dy, dz) || 1;
    dx /= length;
    dy /= length;
    dz /= length;
    lineKind[index] = LINE_SHIELD;
    linePriority[index] = PRIORITY_CRITICAL;
    lineBorn[index] = now;
    lineDeath[index] = now + clampLife(lifeMs, 320);
    lineData[offset] = component(center, 'x', 0);
    lineData[offset + 1] = component(center, 'y', 1);
    lineData[offset + 2] = component(center, 'z', 2);
    lineData[offset + 3] = dx;
    lineData[offset + 4] = dy;
    lineData[offset + 5] = dz;
    lineData[offset + 6] = arcColor.r;
    lineData[offset + 7] = arcColor.g;
    lineData[offset + 8] = arcColor.b;
    lineData[offset + 9] = Math.max(0.05, radius);
    lineData[offset + 10] = serial += 1;
    spawnBloom(
      lineData[offset] + dx * radius,
      lineData[offset + 1] + dy * radius,
      lineData[offset + 2] + dz * radius,
      arcColor,
      Math.max(0.4, radius * 0.55),
      Math.min(240, clampLife(lifeMs, 320)),
      now,
    );
    return true;
  }

  function bloom({
    at,
    color = 0xffffff,
    size = 1,
    lifeMs = 180,
  } = {}) {
    if (disposed || !at) return false;
    return spawnBloom(
      component(at, 'x', 0),
      component(at, 'y', 1),
      component(at, 'z', 2),
      prepareColor(color, 0xffffff),
      Math.max(0.05, size),
      clampLife(lifeMs, 180),
      lastNow,
    );
  }

  function updatePointLayer(pool, limit, now, isSmoke) {
    for (let index = 0; index < limit; index += 1) {
      if (!pool.active[index]) {
        pool.alphas[index] = 0;
        continue;
      }
      if (now >= pool.death[index]) {
        pool.active[index] = 0;
        pool.priority[index] = 0;
        pool.alphas[index] = 0;
        continue;
      }
      const offset = index * 3;
      const elapsed = Math.max(0, now - pool.born[index]);
      const duration = pool.death[index] - pool.born[index];
      const age = Math.min(1, elapsed / duration);
      const seconds = elapsed / 1000;
      const fade = 1 - age;
      if (isSmoke) {
        const wobble = Math.sin(pool.phase[index] + seconds * 2.7) * pool.spread[index];
        pool.positions[offset] = pool.origin[offset] + pool.velocity[offset] * seconds + wobble;
        pool.positions[offset + 1] = pool.origin[offset + 1] + pool.velocity[offset + 1] * seconds + age * age * pool.spread[index] * 2;
        pool.positions[offset + 2] = pool.origin[offset + 2] + pool.velocity[offset + 2] * seconds - wobble * 0.7;
        pool.sizes[index] = pool.baseSize[index] * (0.72 + age * 2.25);
        pool.alphas[index] = Math.sin(Math.PI * Math.min(0.96, age + 0.04)) * 0.48;
      } else if (pool.kind[index] === ENERGY_CHARGE) {
        const angle = pool.phase[index] + seconds * 8.5;
        const inward = pool.spread[index] * (0.16 + fade * 0.84);
        pool.positions[offset] = pool.origin[offset] + Math.cos(angle) * inward;
        pool.positions[offset + 1] = pool.origin[offset + 1] + Math.sin(angle * 1.7) * inward * 0.36;
        pool.positions[offset + 2] = pool.origin[offset + 2] + Math.sin(angle) * inward;
        pool.sizes[index] = pool.baseSize[index] * (0.75 + fade * 0.55);
        pool.alphas[index] = Math.min(1, age * 5) * (0.35 + fade * 0.65);
      } else if (pool.kind[index] === ENERGY_BLOOM) {
        pool.positions[offset] = pool.origin[offset];
        pool.positions[offset + 1] = pool.origin[offset + 1];
        pool.positions[offset + 2] = pool.origin[offset + 2];
        pool.sizes[index] = pool.baseSize[index] * (0.7 + age * 1.5);
        pool.alphas[index] = fade * fade;
      } else if (pool.kind[index] === ENERGY_PLUME) {
        const wobble = Math.sin(pool.phase[index] + seconds * 22) * pool.spread[index] * fade;
        pool.positions[offset] = pool.origin[offset] + pool.velocity[offset] * seconds + wobble;
        pool.positions[offset + 1] = pool.origin[offset + 1] + pool.velocity[offset + 1] * seconds;
        pool.positions[offset + 2] = pool.origin[offset + 2] + pool.velocity[offset + 2] * seconds - wobble;
        pool.sizes[index] = pool.baseSize[index] * (0.82 + age * 0.72);
        pool.alphas[index] = Math.min(1, age * 9) * Math.pow(fade, 0.62);
      } else {
        const wobble = Math.sin(pool.phase[index] + seconds * 18) * pool.spread[index] * fade;
        pool.positions[offset] = pool.origin[offset] + pool.velocity[offset] * seconds + wobble;
        pool.positions[offset + 1] = pool.origin[offset + 1] + pool.velocity[offset + 1] * seconds;
        pool.positions[offset + 2] = pool.origin[offset + 2] + pool.velocity[offset + 2] * seconds - wobble;
        pool.sizes[index] = pool.baseSize[index] * (0.72 + age * 0.9);
        pool.alphas[index] = Math.pow(fade, 0.72);
      }
    }
    pool.geometry.getAttribute('position').needsUpdate = true;
    pool.geometry.getAttribute('aSize').needsUpdate = true;
    pool.geometry.getAttribute('aAlpha').needsUpdate = true;
  }

  function updateLines(now) {
    let vertex = 0;
    const capacity = tier.lineVertices;

    function writeVertex(x, y, z, r, g, b, alpha) {
      if (vertex >= capacity) return false;
      const offset = vertex * 3;
      linePositions[offset] = x;
      linePositions[offset + 1] = y;
      linePositions[offset + 2] = z;
      lineColors[offset] = r;
      lineColors[offset + 1] = g;
      lineColors[offset + 2] = b;
      lineAlphas[vertex] = alpha;
      vertex += 1;
      return true;
    }

    for (let index = 0; index < tier.lineEvents && vertex < capacity; index += 1) {
      if (!lineActive[index]) continue;
      if (now >= lineDeath[index]) {
        lineActive[index] = 0;
        linePriority[index] = 0;
        continue;
      }
      const offset = index * 12;
      const age = Math.max(0, Math.min(1, (now - lineBorn[index]) / (lineDeath[index] - lineBorn[index])));
      const alpha = Math.min(1, age * 8) * (1 - age);
      const r = lineData[offset + 6];
      const g = lineData[offset + 7];
      const b = lineData[offset + 8];

      if (lineKind[index] === LINE_BEAM) {
        const x0 = lineData[offset];
        const y0 = lineData[offset + 1];
        const z0 = lineData[offset + 2];
        const x1 = lineData[offset + 3];
        const y1 = lineData[offset + 4];
        const z1 = lineData[offset + 5];
        let dx = x1 - x0;
        let dy = y1 - y0;
        let dz = z1 - z0;
        const length = Math.hypot(dx, dy, dz) || 1;
        dx /= length;
        dy /= length;
        dz /= length;
        let px;
        let py;
        let pz;
        if (Math.abs(dy) < 0.9) {
          px = -dz;
          py = 0;
          pz = dx;
        } else {
          px = 0;
          py = dz;
          pz = -dy;
        }
        const perpendicularLength = Math.hypot(px, py, pz) || 1;
        px /= perpendicularLength;
        py /= perpendicularLength;
        pz /= perpendicularLength;
        const qx = dy * pz - dz * py;
        const qy = dz * px - dx * pz;
        const qz = dx * py - dy * px;
        let previousX = x0;
        let previousY = y0;
        let previousZ = z0;
        for (let step = 1; step <= tier.beamSegments && vertex + 1 < capacity; step += 1) {
          const t = step / tier.beamSegments;
          const envelope = Math.sin(Math.PI * t) * lineData[offset + 9];
          const phase = lineData[offset + 10] + age * 29 + step * 2.37;
          const waveA = Math.sin(phase) * envelope;
          const waveB = Math.cos(phase * 1.73) * envelope * 0.66;
          const nextX = x0 + (x1 - x0) * t + px * waveA + qx * waveB;
          const nextY = y0 + (y1 - y0) * t + py * waveA + qy * waveB;
          const nextZ = z0 + (z1 - z0) * t + pz * waveA + qz * waveB;
          writeVertex(previousX, previousY, previousZ, r, g, b, alpha);
          writeVertex(nextX, nextY, nextZ, r, g, b, alpha);
          previousX = nextX;
          previousY = nextY;
          previousZ = nextZ;
        }
      } else {
        const cx = lineData[offset];
        const cy = lineData[offset + 1];
        const cz = lineData[offset + 2];
        const dx = lineData[offset + 3];
        const dy = lineData[offset + 4];
        const dz = lineData[offset + 5];
        let tx;
        let ty;
        let tz;
        if (Math.abs(dy) < 0.9) {
          tx = -dz;
          ty = 0;
          tz = dx;
        } else {
          tx = 0;
          ty = dz;
          tz = -dy;
        }
        const tangentLength = Math.hypot(tx, ty, tz) || 1;
        tx /= tangentLength;
        ty /= tangentLength;
        tz /= tangentLength;
        const bx = dy * tz - dz * ty;
        const by = dz * tx - dx * tz;
        const bz = dx * ty - dy * tx;
        const radius = lineData[offset + 9];
        for (let branch = 0; branch < tier.arcBranches && vertex < capacity; branch += 1) {
          let previousX;
          let previousY;
          let previousZ;
          for (let step = 0; step <= tier.arcSegments && vertex < capacity; step += 1) {
            const t = step / tier.arcSegments;
            const theta = -0.95 + t * 1.9 + branch * 2.18 + age * 0.75;
            const jag = Math.sin(lineData[offset + 10] + branch * 7.1 + step * 3.7) * 0.035;
            const ringX = tx * Math.cos(theta) + bx * Math.sin(theta);
            const ringY = ty * Math.cos(theta) + by * Math.sin(theta);
            const ringZ = tz * Math.cos(theta) + bz * Math.sin(theta);
            let nx = dx + ringX * (0.44 + jag);
            let ny = dy + ringY * (0.44 + jag);
            let nz = dz + ringZ * (0.44 + jag);
            const normalLength = Math.hypot(nx, ny, nz) || 1;
            nx /= normalLength;
            ny /= normalLength;
            nz /= normalLength;
            const nextX = cx + nx * radius;
            const nextY = cy + ny * radius;
            const nextZ = cz + nz * radius;
            if (step > 0 && vertex + 1 < capacity) {
              writeVertex(previousX, previousY, previousZ, r, g, b, alpha * 1.4);
              writeVertex(nextX, nextY, nextZ, r, g, b, alpha * 1.4);
            }
            previousX = nextX;
            previousY = nextY;
            previousZ = nextZ;
          }
        }
      }
    }
    lineGeometry.setDrawRange(0, vertex);
    lineGeometry.getAttribute('position').needsUpdate = true;
    lineGeometry.getAttribute('color').needsUpdate = true;
    lineGeometry.getAttribute('aAlpha').needsUpdate = true;
  }

  function beginFrame(now) {
    if (disposed) return;
    lastNow = Number.isFinite(now) ? now : (typeof performance !== 'undefined' ? performance.now() : Date.now());
  }

  function update(now, camera, viewportHeightPx = 720) {
    if (disposed) return;
    beginFrame(now);
    const shaderTime = lastNow / 1000;
    energy.material.uniforms.uTime.value = shaderTime;
    smoke.material.uniforms.uTime.value = shaderTime;
    if (camera?.isPerspectiveCamera && Number.isFinite(camera.fov)) {
      const halfFov = Math.max(0.2, THREE.MathUtils.degToRad(camera.fov * 0.5));
      const cameraScale = Math.max(1, Number(viewportHeightPx) || 720) * 0.5 / Math.tan(halfFov);
      energy.material.uniforms.uCameraScale.value = cameraScale;
      smoke.material.uniforms.uCameraScale.value = cameraScale;
    }
    updatePointLayer(energy, tier.energy, lastNow, false);
    updatePointLayer(smoke, tier.smoke, lastNow, true);
    updateLines(lastNow);
  }

  function getDiagnostics() {
    let activeBeams = 0;
    let activeArcs = 0;
    for (let index = 0; index < tier.lineEvents; index += 1) {
      if (lineActive[index] && lineKind[index] === LINE_BEAM) activeBeams += 1;
      if (lineActive[index] && lineKind[index] === LINE_SHIELD) activeArcs += 1;
    }
    return {
      qualityTier: tierName,
      drawCalls: disposed ? 0 : 3,
      active: {
        energy: countActive(energy.active, tier.energy),
        smoke: countActive(smoke.active, tier.smoke),
        linkedBeams: activeBeams,
        shieldArcs: activeArcs,
      },
      capacities: {
        energy: tier.energy,
        smoke: tier.smoke,
        lineEvents: tier.lineEvents,
        lineVertices: tier.lineVertices,
      },
      reserves: {
        energy: tier.energyReserve,
        smoke: tier.smokeReserve,
      },
      pointSizePx: {
        energy: tier.energyPointPx,
        smoke: tier.smokePointPx,
      },
      priorities: {
        low: {
          energy: countPriority(energy.active, energy.priority, tier.energy, PRIORITY_LOW),
          smoke: countPriority(smoke.active, smoke.priority, tier.smoke, PRIORITY_LOW),
          lines: countPriority(lineActive, linePriority, tier.lineEvents, PRIORITY_LOW),
        },
        important: {
          energy: countPriority(energy.active, energy.priority, tier.energy, PRIORITY_IMPORTANT),
          smoke: countPriority(smoke.active, smoke.priority, tier.smoke, PRIORITY_IMPORTANT),
          lines: countPriority(lineActive, linePriority, tier.lineEvents, PRIORITY_IMPORTANT),
        },
        critical: {
          energy: countPriority(energy.active, energy.priority, tier.energy, PRIORITY_CRITICAL),
          smoke: countPriority(smoke.active, smoke.priority, tier.smoke, PRIORITY_CRITICAL),
          lines: countPriority(lineActive, linePriority, tier.lineEvents, PRIORITY_CRITICAL),
        },
      },
      dropped: { ...dropped },
      preempted: { ...preempted },
    };
  }

  function setVisible(visible) {
    const next = Boolean(visible) && !disposed;
    smoke.points.visible = next;
    energy.points.visible = next;
    lines.visible = next;
  }

  function getWarmupObjects() {
    return [energy.points, smoke.points, lines];
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(smoke.points, energy.points, lines);
    smoke.geometry.dispose();
    smoke.material.dispose();
    energy.geometry.dispose();
    energy.material.dispose();
    lineGeometry.dispose();
    lineMaterial.dispose();
    plumeEmitterTimes.clear();
  }

  setQuality(tierName);

  return {
    setQuality,
    beginFrame,
    linkedBeam,
    charge,
    fireSmoke,
    plume,
    shieldArc,
    bloom,
    update,
    setVisible,
    getWarmupObjects,
    dispose,
    getDiagnostics,
  };
}
