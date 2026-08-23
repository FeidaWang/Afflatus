const freezeProfile = (profile) => Object.freeze({ ...profile });

export const SPACE_LAYER_IDS = Object.freeze([
  'deep-stars',
  'distant-environment',
  'midfield-dust',
  'near-field-scale-references',
  'carrier',
]);

export const SPACE_LAYER_PROFILE_MATRIX = Object.freeze({
  high: freezeProfile({ deepStars: 96, distantEnvironment: true, dust: 24, windows: 42, escorts: 3, drones: 6 }),
  medium: freezeProfile({ deepStars: 64, distantEnvironment: true, dust: 14, windows: 27, escorts: 2, drones: 4 }),
  mobile: freezeProfile({ deepStars: 34, distantEnvironment: true, dust: 8, windows: 15, escorts: 1, drones: 2 }),
});

export const SCALE_REFERENCE_KINDS = Object.freeze([
  'hull-windows',
  'hangar-aperture',
  'escort-craft',
  'maintenance-drones',
]);

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function smoothRange(value, start, end) {
  const t = Math.min(1, Math.max(0, (value - start) / Math.max(0.0001, end - start)));
  return t * t * (3 - 2 * t);
}

function createDeepStars(THREE, count) {
  const random = seededRandom(0xaff109);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const cluster = index % 5 === 0;
    const side = index % 3 === 0 ? -1 : 1;
    positions[index * 3] = cluster
      ? side * (2.8 + random() * 3.4)
      : random() * 13 - 6.5;
    positions[index * 3 + 1] = cluster
      ? 0.8 + random() * 3.4
      : random() * 8 - 4;
    positions[index * 3 + 2] = -16 - random() * 12;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xd8e7ee,
    depthWrite: false,
    opacity: 0.22,
    size: 1,
    sizeAttenuation: false,
    transparent: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'Layer01_DeepStars';
  points.renderOrder = -20;
  return points;
}

function createDistantEnvironment(THREE) {
  const group = new THREE.Group();
  group.name = 'Layer02_DistantEnvironment';
  const material = new THREE.MeshBasicMaterial({
    color: 0x161d25,
    depthWrite: false,
    opacity: 0,
    side: THREE.FrontSide,
    transparent: true,
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(18, 32, 18), material);
  planet.name = 'SingleDistantPlanet';
  planet.position.set(18, -11, -44);
  group.add(planet);

  const limbMaterial = new THREE.MeshBasicMaterial({
    color: 0x7ab9cd,
    depthWrite: false,
    opacity: 0,
    side: THREE.BackSide,
    transparent: true,
  });
  const limb = new THREE.Mesh(new THREE.SphereGeometry(18.18, 32, 18), limbMaterial);
  limb.name = 'PlanetLimb';
  limb.position.copy(planet.position);
  group.add(limb);
  return { group, materials: [material, limbMaterial] };
}

function createMidfieldDust(THREE, count) {
  const random = seededRandom(0xd0572026);
  const positions = new Float32Array(count * 6);
  for (let index = 0; index < count; index += 1) {
    const x = random() * 10 - 5;
    const y = random() * 6 - 3;
    const z = -2 - random() * 14;
    const cursor = index * 6;
    positions[cursor] = x;
    positions[cursor + 1] = y;
    positions[cursor + 2] = z;
    positions[cursor + 3] = x + (random() - 0.5) * 0.025;
    positions[cursor + 4] = y + (random() - 0.5) * 0.025;
    positions[cursor + 5] = z + 0.12 + random() * 0.24;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xb5c8d0,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const dust = new THREE.LineSegments(geometry, material);
  dust.name = 'Layer03_MidfieldDust';
  return { dust, material };
}

function setInstanceTransform(THREE, mesh, index, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  mesh.setMatrixAt(index, matrix);
}

function createWindows(THREE, count) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x7fc8df,
    emissive: 0x2c91b1,
    emissiveIntensity: 0.28,
    metalness: 0.15,
    roughness: 0.35,
  });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.035, 0.18), material, count);
  mesh.name = 'ScaleRef_InstancedHullWindows';
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const lane = row % 3;
    const z = -4.15 + ((row % 15) / 14) * 8.3;
    const x = side * (2.9 + lane * 0.32);
    const y = 0.12 + lane * 0.13;
    setInstanceTransform(THREE, mesh, index, [x, y, z], [1, 1, 0.72 + lane * 0.12]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return { material, mesh };
}

function createHangar(THREE) {
  const group = new THREE.Group();
  group.name = 'ScaleRef_HangarAperture';
  const material = new THREE.MeshStandardMaterial({
    color: 0x131a20,
    emissive: 0xff6b4a,
    emissiveIntensity: 0.18,
    metalness: 0.72,
    roughness: 0.4,
  });
  const frameGeometry = new THREE.BoxGeometry(1, 1, 1);
  const pieces = [
    [[3.18, 0.18, 0.95], [0.08, 0.72, 1.45]],
    [[3.18, 0.18, -0.95], [0.08, 0.72, 1.45]],
    [[3.18, 0.82, 0], [0.08, 0.08, 2]],
    [[3.18, -0.46, 0], [0.08, 0.08, 2]],
  ];
  for (const [position, scale] of pieces) {
    const frame = new THREE.Mesh(frameGeometry, material);
    frame.position.fromArray(position);
    frame.scale.fromArray(scale);
    group.add(frame);
  }
  return { group, material };
}

function createEscorts(THREE, count) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x26343f,
    emissive: 0x3b93ae,
    emissiveIntensity: 0.36,
    metalness: 0.68,
    roughness: 0.38,
  });
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.58, 4), material, count);
  mesh.name = 'ScaleRef_InstancedEscortCraft';
  const positions = [[5.4, 1.45, 6.6], [-6.4, -0.8, 0.4], [4.7, 0.65, -5.8]];
  for (let index = 0; index < count; index += 1) {
    setInstanceTransform(THREE, mesh, index, positions[index], [1, 1, 1], [Math.PI / 2, 0, index % 2 ? -0.2 : 0.18]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return { material, mesh };
}

function createDrones(THREE, count) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x4c5962,
    emissive: 0xff6b4a,
    emissiveIntensity: 0.42,
    metalness: 0.55,
    roughness: 0.42,
  });
  const mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.075, 0), material, count);
  mesh.name = 'ScaleRef_InstancedMaintenanceDrones';
  const positions = [
    [3.65, 1.1, 1.7], [3.9, 0.3, 0.4], [-3.5, 0.85, 2.3],
    [-3.8, -0.1, -1.2], [2.8, 1.35, -2.6], [-2.6, 0.2, -4.2],
  ];
  for (let index = 0; index < count; index += 1) {
    setInstanceTransform(THREE, mesh, index, positions[index]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return { material, mesh };
}

function createScaleReferences(THREE, profile) {
  const group = new THREE.Group();
  group.name = 'Layer04_NearFieldScaleReferences';
  const windows = createWindows(THREE, profile.windows);
  const hangar = createHangar(THREE);
  const escorts = createEscorts(THREE, profile.escorts);
  const drones = createDrones(THREE, profile.drones);
  group.add(windows.mesh, hangar.group, escorts.mesh, drones.mesh);
  group.userData.scaleReferenceKinds = SCALE_REFERENCE_KINDS;
  return {
    group,
    instances: profile.windows + profile.escorts + profile.drones,
    materials: {
      drones: drones.material,
      escorts: escorts.material,
      hangar: hangar.material,
      windows: windows.material,
    },
  };
}

export function createSpaceLayers(THREE, { camera, profile = 'high', scene } = {}) {
  const config = SPACE_LAYER_PROFILE_MATRIX[profile] || SPACE_LAYER_PROFILE_MATRIX.mobile;
  const deepStars = createDeepStars(THREE, config.deepStars);
  const distant = createDistantEnvironment(THREE);
  const midfield = createMidfieldDust(THREE, config.dust);
  const references = createScaleReferences(THREE, config);
  camera.add(deepStars, distant.group, midfield.dust);
  scene.add(references.group);

  const systemMaterials = [references.materials.windows, references.materials.hangar, references.materials.escorts];
  let pulseSignal = '';
  let pulseStartedAt = -Infinity;

  return Object.freeze({
    config,
    diagnostics: Object.freeze({
      enabledLayers: SPACE_LAYER_IDS,
      instancedReferenceCount: references.instances,
      majorDistantBodies: 1,
      profile,
      scaleReferenceKinds: SCALE_REFERENCE_KINDS,
    }),
    pulse(signal, now = 0) {
      pulseSignal = String(signal || '');
      pulseStartedAt = Number(now) || 0;
    },
    update(frame, { dustEnabled = true, now = 0 } = {}) {
      const progress = Math.min(1, Math.max(0, Number(frame?.progress) || 0));
      deepStars.position.x = -progress * 0.055;
      deepStars.position.y = progress * 0.018;

      const environmentIn = smoothRange(progress, 0.44, 0.55);
      const environmentOut = 1 - smoothRange(progress, 0.94, 1);
      const environmentOpacity = environmentIn * environmentOut;
      distant.materials[0].opacity = environmentOpacity * 0.62;
      distant.materials[1].opacity = environmentOpacity * 0.16;

      const wakeIn = smoothRange(progress, 0.66, 0.73);
      const wakeOut = 1 - smoothRange(progress, 0.9, 0.98);
      midfield.material.opacity = dustEnabled ? wakeIn * wakeOut * 0.2 : 0;
      midfield.dust.position.z = -((progress * 2.4) % 0.8);

      const chapterThreeProgress = Math.min(0.999, Math.max(0, (progress - 0.28) / 0.22));
      const activeSystemIndex = Math.min(2, Math.floor(chapterThreeProgress * 3));
      const pulseActive = Number(now) - pulseStartedAt < 420;
      systemMaterials.forEach((material, index) => {
        const active = progress >= 0.28 && progress <= 0.52 && index === activeSystemIndex;
        const signalMatch = pulseSignal.includes(['capital', 'software', 'intelligence'][index]);
        material.emissiveIntensity = active ? 0.82 : 0.18;
        if (pulseActive && signalMatch) material.emissiveIntensity = 1.35;
      });

      return {
        activeScaleReference: ['hull-windows', 'hangar-aperture', 'escort-craft'][activeSystemIndex],
        dustOpacity: midfield.material.opacity,
        environmentOpacity,
        pulseActive,
        pulseSignal: pulseActive ? pulseSignal : '',
      };
    },
  });
}
