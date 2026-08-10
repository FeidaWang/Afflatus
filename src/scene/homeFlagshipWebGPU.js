import * as THREE from 'three';
import { createProgressiveRenderer } from '../lib/renderBackendSelector.js';
import { createAfflatusVanguard } from './afflatusVanguard.js';
import {
  CAPITAL_ASSET_PROFILE,
  loadCombatAsset,
} from './combatAssetLoader.js';

function shieldGridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(148,231,255,.72)';
  ctx.lineWidth = 1.2;
  const radius = 13;
  for (let row = -1; row < 7; row += 1) {
    for (let col = -1; col < 12; col += 1) {
      const x = col * radius * 1.72 + (row & 1 ? radius * .86 : 0);
      const y = row * radius * 1.49;
      ctx.beginPath();
      for (let side = 0; side < 6; side += 1) {
        const angle = Math.PI / 3 * side;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (!side) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1.1);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function plumeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const length = ctx.createLinearGradient(0, 0, 0, canvas.height);
  length.addColorStop(0, 'rgba(245,255,255,.96)');
  length.addColorStop(.14, 'rgba(112,226,255,.7)');
  length.addColorStop(.5, 'rgba(72,156,255,.22)');
  length.addColorStop(1, 'rgba(43,93,255,0)');
  ctx.fillStyle = length;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-in';
  const feather = ctx.createLinearGradient(0, 0, canvas.width, 0);
  feather.addColorStop(0, 'rgba(255,255,255,0)');
  feather.addColorStop(.35, 'rgba(255,255,255,.88)');
  feather.addColorStop(.5, 'rgba(255,255,255,1)');
  feather.addColorStop(.65, 'rgba(255,255,255,.88)');
  feather.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = feather;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root?.traverse?.((child) => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

export async function createHomeFlagshipWebGPU({
  container,
  onModelStatus,
  onUnavailable,
} = {}) {
  if (!container) return null;
  const canvas = container.ownerDocument.createElement('canvas');
  canvas.className = 'home-flagship-narrative home-flagship-narrative--gpu';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  let activeCanvas = canvas;
  let backend = 'poster';
  let backendController = null;
  let disposed = false;
  let authoredAsset = null;
  let fallbackShip = null;
  let modelStatus = 'procedural';
  let loadGeneration = 0;
  let lastLoadError = '';

  function releaseAuthoredFlagship() {
    if (!authoredAsset) return;
    const staleAsset = authoredAsset;
    authoredAsset = null;
    staleAsset.root.removeFromParent?.();
    staleAsset.dispose();
  }

  function markStatus() {
    if (!activeCanvas?.dataset) return;
    activeCanvas.dataset.model = modelStatus;
    activeCanvas.dataset.renderer = backend;
    if (lastLoadError) activeCanvas.dataset.modelError = lastLoadError;
    else delete activeCanvas.dataset.modelError;
    onModelStatus?.(modelStatus);
  }

  backendController = await createProgressiveRenderer({
    THREE,
    canvas,
    scope: container.ownerDocument.defaultView || globalThis,
    onBackendChange(state) {
      const previousBackend = backend;
      activeCanvas = state.canvas;
      backend = state.backend;
      activeCanvas.className = 'home-flagship-narrative home-flagship-narrative--gpu';
      activeCanvas.setAttribute('aria-hidden', 'true');
      activeCanvas.hidden = backend === 'poster';

      if (backend === 'poster') {
        // Invalidate a decode that may still be resolving against the renderer
        // we just discarded. Otherwise it can attach a fresh 11 MB asset after
        // the scene has already committed to its static fallback.
        loadGeneration += 1;
        releaseAuthoredFlagship();
        modelStatus = 'poster-fallback';
        queueMicrotask(() => { onUnavailable?.(state.reason || 'poster-fallback'); });
      }

      // A WebGPU device loss is terminal for this five-second flourish. A GLB
      // decoded for the lost backend must not be transcoded and uploaded again
      // in the background; the owner disposes this short-lived fallback
      // context and keeps the model-derived poster instead.
      if (previousBackend === 'webgpu' && backend === 'webgl2' && fallbackShip) {
        loadGeneration += 1;
        releaseAuthoredFlagship();
        fallbackShip.visible = false;
        modelStatus = 'device-lost-poster';
        queueMicrotask(() => { onUnavailable?.('webgpu-device-lost'); });
      }
      markStatus();
    },
  });
  if (backendController.backend === 'poster') {
    activeCanvas.remove();
    backendController.dispose();
    return null;
  }

  const renderer = backendController.renderer;
  renderer?.setClearColor?.(0x000000, 0);
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if ('toneMapping' in renderer) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 140);
  camera.position.set(0, 2.8, 19);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xa7dfff, 0x09101b, 1.45));
  const key = new THREE.DirectionalLight(0xffd3a0, 5.2);
  key.position.set(8, 9, 11);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5fc9ff, 4.4);
  rim.position.set(-9, 2, -8);
  scene.add(rim);

  const shipRig = new THREE.Group();
  shipRig.name = 'HomeVenatorNarrativeRig';
  shipRig.rotation.set(.13, -.92, -.055);
  scene.add(shipRig);

  const procedural = createAfflatusVanguard(THREE, { detail: 'full', forwardNegativeZ: false });
  fallbackShip = procedural.group;
  fallbackShip.name = 'HomeFlagshipProceduralFallback';
  shipRig.add(fallbackShip);

  const plumeMap = plumeTexture();
  const plumeMaterial = new THREE.MeshBasicMaterial({
    color: 0x86e8ff,
    map: plumeMap,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const plumes = [-1.45, -.72, 0, .72, 1.45].map((x, index) => {
    const plume = new THREE.Mesh(
      new THREE.PlaneGeometry(index === 2 ? .42 : .28, index === 2 ? 2.8 : 2.1),
      plumeMaterial,
    );
    plume.rotation.x = -Math.PI / 2;
    plume.position.set(x, -.08, index === 2 ? -7.75 : -7.4);
    shipRig.add(plume);
    return plume;
  });

  const shieldTexture = shieldGridTexture();
  const shieldMaterial = new THREE.MeshBasicMaterial({
    color: 0x83e6ff,
    map: shieldTexture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(6.65, 32, 20), shieldMaterial);
  shield.scale.set(.64, .18, 1.02);
  shield.visible = false;
  shipRig.add(shield);

  const lensMaterial = new THREE.MeshBasicMaterial({
    color: 0xa9eaff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const lensRings = [0, 1, 2].map((index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8 + index * .8, .018, 6, 72), lensMaterial.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.set(3.8, 1.4, -8 - index * .3);
    scene.add(ring);
    return ring;
  });

  async function loadAuthoredFlagship(targetRenderer = backendController?.renderer) {
    if (disposed || !targetRenderer || backendController?.backend === 'poster') return null;
    const generation = ++loadGeneration;
    modelStatus = authoredAsset ? 'reloading-venator' : 'loading-venator';
    lastLoadError = '';
    markStatus();
    try {
      const nextAsset = await loadCombatAsset(targetRenderer, CAPITAL_ASSET_PROFILE);
      if (
        disposed
        || generation !== loadGeneration
        || backendController?.backend === 'poster'
        || targetRenderer !== backendController?.renderer
      ) {
        nextAsset.dispose();
        return null;
      }
      const previousAsset = authoredAsset;
      authoredAsset = nextAsset;
      authoredAsset.root.name = 'HomeVenatorClassStarDestroyerCCBY';
      shipRig.add(authoredAsset.root);
      fallbackShip.visible = false;
      authoredAsset.root.visible = true;
      modelStatus = 'venator-ready';
      markStatus();
      previousAsset?.root.removeFromParent?.();
      previousAsset?.dispose();
      return authoredAsset;
    } catch (error) {
      if (disposed || generation !== loadGeneration) return null;
      releaseAuthoredFlagship();
      fallbackShip.visible = true;
      modelStatus = 'procedural-fallback';
      lastLoadError = error instanceof Error ? error.message : String(error);
      markStatus();
      return null;
    }
  }

  const authoredReady = loadAuthoredFlagship(renderer).then(Boolean);

  let width = 1;
  let height = 1;
  let dpr = 1;
  function resize(nextWidth, nextHeight, nextDpr = 1) {
    width = Math.max(1, nextWidth || 1);
    height = Math.max(1, nextHeight || 1);
    dpr = Math.min(1.25, Math.max(.7, nextDpr || 1));
    const activeRenderer = backendController.renderer;
    activeRenderer?.setPixelRatio?.(dpr);
    activeRenderer?.setSize?.(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(now, state) {
    if (disposed || backendController.backend === 'poster') return false;
    const compact = width < 860;
    const finalX = compact ? 2.15 : 3.45;
    shipRig.visible = state.reveal > .01;
    shipRig.position.set(
      THREE.MathUtils.lerp(4.8, finalX, state.travel),
      THREE.MathUtils.lerp(1.7, compact ? -1.45 : -.8, state.travel),
      THREE.MathUtils.lerp(-12, 0, state.travel),
    );
    const scale = THREE.MathUtils.lerp(.12, compact ? .48 : .72, state.reveal);
    shipRig.scale.setScalar(scale);
    shipRig.rotation.z = -.055 + Math.sin(now * .0007) * .012;
    plumeMaterial.opacity = state.enginePower * .74;
    for (const [index, plume] of plumes.entries()) {
      const pulse = .94 + Math.sin(now * .018 + index * .9) * .06;
      plume.scale.set(1, Math.max(.04, state.enginePower * pulse), 1);
      plume.visible = state.enginePower > .01;
    }
    shield.visible = state.shieldPulse > .002;
    shieldMaterial.opacity = state.shieldPulse * .42;
    const shieldExpansion = 1 + state.rippleProgress * .08;
    shield.scale.set(.64 * shieldExpansion, .18 * shieldExpansion, 1.02 * shieldExpansion);
    for (const [index, ring] of lensRings.entries()) {
      ring.material.opacity = state.lensEnergy * (.22 - index * .045);
      ring.scale.setScalar(1 + (1 - state.lensEnergy) * (.18 + index * .04));
      ring.visible = state.lensEnergy > .005;
    }
    try {
      const result = backendController.renderer?.render?.(scene, camera);
      result?.catch?.(() => { void backendController.fallback('render-failed'); });
      return modelStatus === 'venator-ready';
    } catch {
      void backendController.fallback('render-failed');
      return false;
    }
  }

  return Object.freeze({
    get backend() { return backendController.backend; },
    get modelStatus() { return modelStatus; },
    get canvas() { return activeCanvas; },
    ready: authoredReady,
    getDiagnostics() {
      return Object.freeze({
        backend: backendController.backend,
        modelStatus,
        model: authoredAsset?.diagnostics || null,
        error: lastLoadError,
      });
    },
    resize,
    render,
    setVisible(visible) {
      activeCanvas.hidden = !visible || backendController.backend === 'poster';
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      loadGeneration += 1;
      releaseAuthoredFlagship();
      backendController.dispose();
      disposeObject(scene);
      activeCanvas.remove();
    },
  });
}
