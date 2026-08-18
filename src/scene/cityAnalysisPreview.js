import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  CITY_PACKAGE_STREAMING_BUDGET,
  selectCityPackageLruEvictions,
  selectCityPackageStreamingSet,
} from '../city/packageStreaming.ts';
import {
  createWebGLContextLifecycle,
  disposeThreeObject3D,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';
import {
  applyCityStyleTwin,
  cityStyleTwinForSnapshot,
} from './cityStyleTwin.ts';
import {
  collectCityWaterSurfaceMaterials,
  updateCityWaterSurfaceTime,
} from './cityWaterSurface.ts';
import { createCityOutdoorEnvironment } from './cityOutdoorEnvironment.ts';
import {
  collectAuthoredCityNightLightMaterials,
  updateAuthoredCityNightLightTime,
} from './cityNightLighting.ts';

const percentile95 = (values) => {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)];
};
const assetKey = (tileId, lod) => `${tileId}:lod${lod}`;

function pickedFeatureId(intersection) {
  const geometry = intersection.object?.geometry;
  const featureIds = geometry?.getAttribute?.('_feature_id_0');
  if (!featureIds) return null;
  let vertexIndex = null;
  if (intersection.object.isMesh && intersection.face) vertexIndex = intersection.face.a;
  else if (intersection.object.isPoints) vertexIndex = intersection.index;
  else if (intersection.object.isLineSegments && Number.isSafeInteger(intersection.index)) {
    vertexIndex = geometry.index
      ? geometry.index.getX(intersection.index * 2)
      : intersection.index * 2;
  }
  if (!Number.isSafeInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= featureIds.count) return null;
  const featureId = featureIds.getX(vertexIndex);
  return Number.isSafeInteger(featureId) ? featureId : Math.round(featureId);
}

export async function createCityPackageRenderer({
  canvas,
  cityId = 'melbourne',
  tileLoad,
  tileSession,
  cameraPreset,
  initialEnvironment,
  onTelemetry = () => {},
  onStreamingChange = () => {},
  onPick = () => {},
  onFallback = () => {},
} = {}) {
  if (!canvas) throw new Error('CityPackage renderer requires a canvas.');
  if (tileLoad?.status !== 'ready') throw new Error('CityPackage renderer requires verified tiles.');
  if (!tileSession?.loadTileAssets) throw new Error('CityPackage renderer requires a verified package session.');
  if (!cameraPreset) throw new Error('CityPackage renderer requires a fixed camera preset.');
  if (!initialEnvironment) throw new Error('CityPackage renderer requires an environment snapshot.');

  let renderer = null;
  let scene = null;
  let controls = null;
  let resizeObserver = null;
  let outdoorEnvironment = null;
  let outdoorAtmosphereState = null;
  let clearColor = null;
  let raf = 0;
  let destroyed = false;
  let running = false;
  let currentSelection = null;
  let pickedEntity = null;
  let streamGeneration = 0;
  let streamAbortController = null;
  let residentTick = 0;
  let evictionCount = 0;
  let decodedAssetCount = 0;
  let environmentSwitchCount = 0;
  let styledMaterialCount = 0;
  let windowLightingMaterialCount = 0;
  let physicalWaterMaterialCount = 0;
  let authoredNightLightMaterialCount = 0;
  let streetLightMaterialCount = 0;
  let aviationLightMaterialCount = 0;
  let landmarkLightMaterialCount = 0;
  let pointerStart = null;
  let currentEnvironment = initialEnvironment;
  let currentStyle = cityStyleTwinForSnapshot(initialEnvironment, cityId);
  const frameTimes = [];
  const residentAssets = new Map();
  const lifecycle = createWebGLContextLifecycle({
    id: 'city-analysis-preview',
    canvas,
    onLost: () => stop(),
    onRestore: () => {
      renderer?.resetState?.();
      resize();
      start();
    },
    onFallback: (state) => {
      streamAbortController?.abort();
      onFallback(state);
    },
  });
  if (!lifecycle.canInitialize) {
    return Object.freeze({
      available: false,
      resetCamera: () => {},
      setView: async () => null,
      setCameraPreset: async () => null,
      setEnvironment: () => null,
      getTelemetry: () => null,
      updateStreaming: async () => null,
      destroy: () => lifecycle.dispose(),
    });
  }

  const camera = new THREE.PerspectiveCamera(cameraPreset.fov, 1, 0.5, 25000);
  const cameraDistance = () => camera.position.distanceTo(controls.target);
  const selectionForCamera = () => selectCityPackageStreamingSet(tileSession.index, {
    target: { x: controls.target.x, z: controls.target.z },
    cameraDistance: cameraDistance(),
    previousLod: currentSelection?.lod ?? null,
  });

  const cacheTelemetry = () => {
    let residentBytes = 0;
    let referencedAssets = 0;
    for (const record of residentAssets.values()) {
      residentBytes += record.byteLength;
      if (record.referenceCount > 0) referencedAssets += 1;
    }
    return Object.freeze({
      residentBytes,
      residentAssets: residentAssets.size,
      referencedAssets,
      decodedAssetCount,
      evictionCount,
      maximumResidentBytes: CITY_PACKAGE_STREAMING_BUDGET.maximumResidentBytes,
      maximumResidentAssets: CITY_PACKAGE_STREAMING_BUDGET.maximumResidentAssets,
    });
  };

  const environmentTelemetry = () => Object.freeze({
    requestedEnvironment: currentEnvironment.requestedEnvironment,
    environment: currentEnvironment.environment,
    solarBand: currentEnvironment.solarBand,
    instant: currentEnvironment.instant,
    localDateTime: currentEnvironment.localDateTime,
    timeZone: currentEnvironment.location.timeZone,
    sunAltitudeDegrees: currentEnvironment.sun.altitudeDegrees,
    sunAzimuthDegrees: currentEnvironment.sun.azimuthDegrees,
    simulatedLighting: currentEnvironment.simulatedLighting,
    styleId: currentStyle.id,
    pbr: true,
    imageBasedLighting: Boolean(scene?.environment),
    outdoorIbl: Boolean(outdoorAtmosphereState),
    atmosphereProfileId: outdoorAtmosphereState?.id ?? null,
    atmosphereTurbidity: outdoorAtmosphereState?.turbidity ?? null,
    atmosphereRayleigh: outdoorAtmosphereState?.rayleigh ?? null,
    transitionMode: currentEnvironment.environment === 'analysis'
      ? 'fixed-analysis'
      : 'solar-altitude-continuous',
    solarBlend: outdoorAtmosphereState?.solarBlend ?? null,
    iblIntensity: scene?.environmentIntensity ?? null,
    boundedShadows: Boolean(renderer?.shadowMap?.enabled),
    wholeBuildingEmission: false,
    windowLightingMaterials: windowLightingMaterialCount,
    physicalWaterMaterials: physicalWaterMaterialCount,
    animatedWaterSpecular: physicalWaterMaterialCount > 0,
    waterProfileId: currentStyle.waterProfileId ?? null,
    waterVisualBasis: currentStyle.waterVisualBasis ?? null,
    waterFlowDirection: currentStyle.waterSurface.flowDirection,
    authoredNightLightMaterials: authoredNightLightMaterialCount,
    streetLightMaterials: streetLightMaterialCount,
    aviationLightMaterials: aviationLightMaterialCount,
    landmarkLightMaterials: landmarkLightMaterialCount,
    nightLightBasis: 'authored-light-geometry-only',
    switchCount: environmentSwitchCount,
    styledMaterialCount,
  });

  const getTelemetry = () => Object.freeze({
    packageId: tileLoad.packageId,
    requestedTileIds: currentSelection ? [currentSelection.primaryTileId] : tileLoad.requestedTileIds,
    resolvedTileIds: currentSelection?.resolvedTileIds ?? tileLoad.resolvedTileIds,
    primaryTileId: currentSelection?.primaryTileId ?? tileLoad.requestedTileIds[0],
    lod: currentSelection?.lod ?? tileLoad.tiles[0]?.lod ?? 0,
    visibleAssetBytes: currentSelection?.assetBytes ?? 0,
    visibleAssetDrawCalls: currentSelection?.drawCalls ?? 0,
    visibleAssetTriangles: currentSelection?.triangles ?? 0,
    rendererDrawCalls: renderer?.info.render.calls ?? 0,
    rendererTriangles: renderer?.info.render.triangles ?? 0,
    frameSamples: frameTimes.length,
    p95Ms: Math.round(percentile95(frameTimes) * 100) / 100,
    camera: Object.freeze({
      position: Object.freeze({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
      target: Object.freeze({ x: controls.target.x, y: controls.target.y, z: controls.target.z }),
      distance: cameraDistance(),
      verticalFovDegrees: camera.fov,
    }),
    environment: environmentTelemetry(),
    selection: pickedEntity,
    cache: cacheTelemetry(),
    lifecycle: lifecycle.getState(),
  });

  const applyCameraPreset = (preset = cameraPreset) => {
    camera.position.set(
      preset.position.x,
      preset.position.y,
      preset.position.z,
    );
    controls?.target.set(
      preset.target.x,
      preset.target.y,
      preset.target.z,
    );
    camera.fov = preset.fov;
    camera.updateProjectionMatrix();
    controls?.update();
  };

  const resize = () => {
    if (!renderer || destroyed) return;
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const frame = () => {
    if (!running || destroyed) return;
    const startedAt = performance.now();
    controls.update();
    const waterTimeSeconds = performance.now() * 0.001;
    for (const record of residentAssets.values()) {
      if (record.referenceCount <= 0) continue;
      for (const material of record.waterSurfaceMaterials) {
        updateCityWaterSurfaceTime(material, waterTimeSeconds);
      }
      for (const material of record.authoredNightLightMaterials) {
        updateAuthoredCityNightLightTime(material, waterTimeSeconds);
      }
    }
    const gl = renderer.getContext();
    if (gl.isContextLost()) {
      raf = requestAnimationFrame(frame);
      return;
    }
    try {
      renderer.render(scene, camera);
    } catch (error) {
      if (gl.isContextLost() || lifecycle.getState().fallback) {
        stop();
        return;
      }
      throw error;
    }
    frameTimes.push(performance.now() - startedAt);
    if (frameTimes.length > 180) frameTimes.shift();
    if (frameTimes.length % 30 === 0) onTelemetry(getTelemetry());
    raf = requestAnimationFrame(frame);
  };

  function start() {
    if (running || destroyed || lifecycle.getState().fallback) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  try {
    scene = new THREE.Scene();
    clearColor = new THREE.Color(currentStyle.background);
    scene.background = clearColor;
    scene.fog = new THREE.Fog(
      currentStyle.fog.color,
      currentStyle.fog.near,
      currentStyle.fog.far,
    );
    const hemisphere = new THREE.HemisphereLight(
      currentStyle.hemisphere.skyColor,
      currentStyle.hemisphere.groundColor,
      currentStyle.hemisphere.intensity,
    );
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(currentStyle.sun.color, currentStyle.sun.intensity);
    sun.position.set(-420, 680, 360);
    sun.castShadow = true;
    const tileBounds = tileSession.index?.tileScheme?.boundsLocal;
    const shadowSpan = tileBounds
      ? Math.min(900, Math.max(
        tileBounds.maxX - tileBounds.minX,
        tileBounds.maxZ - tileBounds.minZ,
      ) * 0.62)
      : 700;
    sun.shadow.mapSize.set(
      window.matchMedia?.('(max-width: 760px)').matches ? 1024 : 2048,
      window.matchMedia?.('(max-width: 760px)').matches ? 1024 : 2048,
    );
    sun.shadow.camera.left = -shadowSpan;
    sun.shadow.camera.right = shadowSpan;
    sun.shadow.camera.top = shadowSpan;
    sun.shadow.camera.bottom = -shadowSpan;
    sun.shadow.camera.near = 50;
    sun.shadow.camera.far = 2400;
    sun.shadow.bias = -0.00008;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);

    const pickMarker = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xf15a24, depthTest: false }),
    );
    pickMarker.renderOrder = 10;
    pickMarker.visible = false;
    scene.add(pickMarker);

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = currentStyle.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(clearColor, 1);
    outdoorEnvironment = createCityOutdoorEnvironment({
      renderer,
      scene,
      cityId,
      snapshot: initialEnvironment,
    });
    outdoorAtmosphereState = outdoorEnvironment.state;
    scene.environmentIntensity = currentStyle.iblIntensity;

    const applyEnvironment = (
      snapshot,
      { countSwitch = true, refreshOutdoor = true } = {},
    ) => {
      const style = cityStyleTwinForSnapshot(snapshot, cityId);
      const sunDirection = snapshot?.sun?.direction;
      if (
        !snapshot?.location?.timeZone
        || !sunDirection
        || ![sunDirection.x, sunDirection.y, sunDirection.z].every(Number.isFinite)
      ) throw new Error('Analysis environment snapshot is incomplete.');
      currentEnvironment = snapshot;
      currentStyle = style;
      clearColor.setHex(style.background);
      scene.fog.color.setHex(style.fog.color);
      scene.fog.near = style.fog.near;
      scene.fog.far = style.fog.far;
      hemisphere.color.setHex(style.hemisphere.skyColor);
      hemisphere.groundColor.setHex(style.hemisphere.groundColor);
      hemisphere.intensity = style.hemisphere.intensity;
      sun.color.setHex(style.sun.color);
      sun.intensity = style.sun.intensity;
      if (style.sun.followsEnvironmentClock) {
        sun.position.set(
          sunDirection.x * 1000,
          sunDirection.y * 1000,
          sunDirection.z * 1000,
        );
      } else {
        sun.position.set(-420, 680, 360);
      }
      if (refreshOutdoor) {
        outdoorAtmosphereState = outdoorEnvironment.update(snapshot);
      }
      renderer.toneMappingExposure = style.exposure;
      scene.environmentIntensity = style.iblIntensity;
      renderer.setClearColor(clearColor, 1);
      styledMaterialCount = 0;
      windowLightingMaterialCount = 0;
      physicalWaterMaterialCount = 0;
      authoredNightLightMaterialCount = 0;
      streetLightMaterialCount = 0;
      aviationLightMaterialCount = 0;
      landmarkLightMaterialCount = 0;
      for (const record of residentAssets.values()) {
        const styleResult = applyCityStyleTwin(record.group, snapshot, cityId);
        record.styleMaterialCount = styleResult.materialCount;
        record.windowLightingMaterialCount = styleResult.windowLightingMaterials;
        record.physicalWaterMaterialCount = styleResult.physicalWaterMaterials;
        record.authoredNightLightMaterialCount = styleResult.authoredNightLightMaterials;
        record.streetLightMaterialCount = styleResult.streetLightMaterials;
        record.aviationLightMaterialCount = styleResult.aviationLightMaterials;
        record.landmarkLightMaterialCount = styleResult.landmarkLightMaterials;
        styledMaterialCount += record.styleMaterialCount;
        windowLightingMaterialCount += record.windowLightingMaterialCount;
        physicalWaterMaterialCount += record.physicalWaterMaterialCount;
        authoredNightLightMaterialCount += record.authoredNightLightMaterialCount;
        streetLightMaterialCount += record.streetLightMaterialCount;
        aviationLightMaterialCount += record.aviationLightMaterialCount;
        landmarkLightMaterialCount += record.landmarkLightMaterialCount;
      }
      if (countSwitch) environmentSwitchCount += 1;
      return environmentTelemetry();
    };

    applyEnvironment(initialEnvironment, { countSwitch: false, refreshOutdoor: false });

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 80;
    controls.maxDistance = 12000;
    controls.maxPolarAngle = Math.PI * 0.49;
    applyCameraPreset();

    await MeshoptDecoder.ready;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

    const decodeTiles = async (tiles) => {
      const decoded = [];
      try {
        for (const tile of tiles) {
          const gltf = await loader.parseAsync(tile.bytes, '');
          const key = assetKey(tile.id, tile.lod);
          gltf.scene.name = `${tile.id}-lod${tile.lod}-verified-city-package`;
          gltf.scene.traverse((object) => {
            object.userData.cityPackageAssetKey = key;
            if (!object.isMesh) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            const names = materials.map((material) => material?.name?.toLowerCase?.() ?? '');
            object.castShadow = names.some((name) => name.startsWith('buildings-'));
            object.receiveShadow = names.some((name) => (
              name.startsWith('terrain-')
              || name.startsWith('roads-')
              || name.startsWith('buildings-')
            ));
          });
          const styleResult = applyCityStyleTwin(gltf.scene, currentEnvironment, cityId);
          decoded.push({
            key,
            tileId: tile.id,
            lod: tile.lod,
            group: gltf.scene,
            byteLength: tile.bytes.byteLength,
            features: new Map(tile.features.map((feature) => [feature.featureId, feature])),
            referenceCount: 0,
            lastUsed: ++residentTick,
            styleMaterialCount: styleResult.materialCount,
            windowLightingMaterialCount: styleResult.windowLightingMaterials,
            physicalWaterMaterialCount: styleResult.physicalWaterMaterials,
            waterSurfaceMaterials: collectCityWaterSurfaceMaterials(gltf.scene),
            authoredNightLightMaterialCount: styleResult.authoredNightLightMaterials,
            streetLightMaterialCount: styleResult.streetLightMaterials,
            aviationLightMaterialCount: styleResult.aviationLightMaterials,
            landmarkLightMaterialCount: styleResult.landmarkLightMaterials,
            authoredNightLightMaterials: collectAuthoredCityNightLightMaterials(gltf.scene),
          });
        }
        return decoded;
      } catch (error) {
        decoded.forEach(({ group }) => disposeThreeObject3D(group));
        throw error;
      }
    };

    const installDecoded = (records) => {
      for (const record of records) {
        if (residentAssets.has(record.key)) {
          disposeThreeObject3D(record.group);
          continue;
        }
        record.group.visible = false;
        residentAssets.set(record.key, record);
        scene.add(record.group);
        decodedAssetCount += 1;
        styledMaterialCount += record.styleMaterialCount;
        windowLightingMaterialCount += record.windowLightingMaterialCount;
        physicalWaterMaterialCount += record.physicalWaterMaterialCount;
        authoredNightLightMaterialCount += record.authoredNightLightMaterialCount;
        streetLightMaterialCount += record.streetLightMaterialCount;
        aviationLightMaterialCount += record.aviationLightMaterialCount;
        landmarkLightMaterialCount += record.landmarkLightMaterialCount;
      }
    };

    const evictUnreferenced = () => {
      const evictionKeys = selectCityPackageLruEvictions([...residentAssets.values()]);
      for (const key of evictionKeys) {
        const record = residentAssets.get(key);
        if (!record) continue;
        residentAssets.delete(record.key);
        styledMaterialCount -= record.styleMaterialCount;
        windowLightingMaterialCount -= record.windowLightingMaterialCount;
        physicalWaterMaterialCount -= record.physicalWaterMaterialCount;
        authoredNightLightMaterialCount -= record.authoredNightLightMaterialCount;
        streetLightMaterialCount -= record.streetLightMaterialCount;
        aviationLightMaterialCount -= record.aviationLightMaterialCount;
        landmarkLightMaterialCount -= record.landmarkLightMaterialCount;
        scene.remove(record.group);
        disposeThreeObject3D(record.group);
        evictionCount += 1;
      }
      if (evictionKeys.length > 0) renderer.renderLists?.dispose?.();
    };

    const applySelection = (selection) => {
      const desiredKeys = new Set(selection.resolvedTileIds.map((tileId) => assetKey(tileId, selection.lod)));
      for (const record of residentAssets.values()) {
        const referenced = desiredKeys.has(record.key);
        record.referenceCount = referenced ? 1 : 0;
        record.group.visible = referenced;
        if (referenced) record.lastUsed = ++residentTick;
      }
      currentSelection = selection;
      evictUnreferenced();
      onStreamingChange(Object.freeze({
        status: 'ready',
        selection,
        cache: cacheTelemetry(),
      }));
    };

    const initialSelection = selectionForCamera();
    if (
      !initialSelection
      || initialSelection.lod !== tileLoad.tiles[0]?.lod
      || initialSelection.resolvedTileIds.join(',') !== tileLoad.resolvedTileIds.join(',')
    ) throw new Error('Verified first-frame tiles do not match the streaming policy.');
    installDecoded(await decodeTiles(tileLoad.tiles));
    applySelection(initialSelection);

    const updateStreaming = async () => {
      if (destroyed) return null;
      const selection = selectionForCamera();
      if (!selection) {
        onStreamingChange(Object.freeze({ status: 'fallback', reason: 'selection-invalid' }));
        return null;
      }
      if (selection.key === currentSelection?.key) return selection;
      const desiredKeys = new Set(selection.resolvedTileIds.map((tileId) => assetKey(tileId, selection.lod)));
      const missingTileIds = selection.resolvedTileIds.filter((tileId) => (
        !residentAssets.has(assetKey(tileId, selection.lod))
      ));
      const generation = ++streamGeneration;
      streamAbortController?.abort();
      const controller = new AbortController();
      streamAbortController = controller;
      onStreamingChange(Object.freeze({
        status: 'loading',
        selection,
        cache: cacheTelemetry(),
      }));
      let records = [];
      try {
        if (missingTileIds.length > 0) {
          const loaded = await tileSession.loadTileAssets({
            tileIds: missingTileIds,
            lod: selection.lod,
            signal: controller.signal,
          });
          if (loaded.status === 'cancelled') return null;
          if (loaded.status !== 'ready') throw new Error(`tile-load:${loaded.reason}`);
          records = await decodeTiles(loaded.tiles);
        }
        if (destroyed || generation !== streamGeneration) {
          records.forEach(({ group }) => disposeThreeObject3D(group));
          return null;
        }
        installDecoded(records);
        for (const key of desiredKeys) {
          if (!residentAssets.has(key)) throw new Error(`missing-resident:${key}`);
        }
        applySelection(selection);
        return selection;
      } catch (error) {
        records.forEach(({ group }) => disposeThreeObject3D(group));
        if (controller.signal.aborted || destroyed) return null;
        onStreamingChange(Object.freeze({
          status: 'fallback',
          reason: error.message,
          selection: currentSelection,
          cache: cacheTelemetry(),
        }));
        return null;
      }
    };

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 2;
    raycaster.params.Points.threshold = 3;
    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event) => {
      if (
        !pointerStart
        || pointerStart.id !== event.pointerId
        || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5
      ) {
        pointerStart = null;
        return;
      }
      pointerStart = null;
      const bounds = canvas.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const visibleGroups = [...residentAssets.values()]
        .filter(({ referenceCount }) => referenceCount > 0)
        .map(({ group }) => group);
      const intersection = raycaster.intersectObjects(visibleGroups, true)[0];
      if (!intersection) {
        pickMarker.visible = false;
        pickedEntity = null;
        onPick(null);
        return;
      }
      const key = intersection.object.userData.cityPackageAssetKey;
      const record = residentAssets.get(key);
      const featureId = pickedFeatureId(intersection);
      const feature = featureId == null ? null : record?.features.get(featureId);
      if (!record || !feature) {
        pickMarker.visible = false;
        pickedEntity = null;
        onPick(null);
        return;
      }
      pickMarker.position.copy(intersection.point);
      pickMarker.visible = true;
      pickedEntity = Object.freeze({
        ...feature,
        tileId: record.tileId,
        lod: record.lod,
        position: Object.freeze({
          x: intersection.point.x,
          y: intersection.point.y,
          z: intersection.point.z,
        }),
      });
      onPick(pickedEntity);
    };

    controls.addEventListener('end', updateStreaming);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resize)
      : null;
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', resize, { passive: true });
    resize();
    start();

    const setCameraPreset = async (preset) => {
      const values = [
        preset?.position?.x,
        preset?.position?.y,
        preset?.position?.z,
        preset?.target?.x,
        preset?.target?.y,
        preset?.target?.z,
        preset?.fov,
      ];
      if (!values.every(Number.isFinite) || preset.fov <= 0 || preset.fov >= 90) {
        throw new Error('CityPackage camera preset requires finite position/target and a FOV between 0 and 90.');
      }
      const previous = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
        fov: camera.fov,
      };
      applyCameraPreset(preset);
      const selection = await updateStreaming();
      if (selection) return selection;
      applyCameraPreset(previous);
      return null;
    };

    return Object.freeze({
      get available() {
        return !destroyed && !lifecycle.getState().fallback;
      },
      resetCamera() {
        return setCameraPreset(cameraPreset);
      },
      setView({ position, target }) {
        return setCameraPreset({ position, target, fov: camera.fov });
      },
      setCameraPreset,
      setEnvironment(snapshot) {
        return applyEnvironment(snapshot);
      },
      updateStreaming,
      getTelemetry,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        streamAbortController?.abort();
        stop();
        window.removeEventListener('resize', resize);
        resizeObserver?.disconnect();
        controls?.removeEventListener('end', updateStreaming);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointerup', onPointerUp);
        controls?.dispose();
        lifecycle.dispose();
        outdoorEnvironment?.destroy();
        disposeThreeScene(scene, renderer);
        residentAssets.clear();
      },
    });
  } catch (error) {
    destroyed = true;
    streamAbortController?.abort();
    stop();
    window.removeEventListener('resize', resize);
    resizeObserver?.disconnect();
    controls?.dispose();
    lifecycle.dispose();
    outdoorEnvironment?.destroy();
    disposeThreeScene(scene, renderer);
    residentAssets.clear();
    throw error;
  }
}

// The local Melbourne engineering pages retain their old import while the
// production shell consumes the city-neutral renderer name.
export const createCityAnalysisPreviewRenderer = createCityPackageRenderer;
