import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const FIGHTER_ASSET_PROFILE = Object.freeze({
  id: 'fictional-6th-gen-fighter',
  url: '/assets/combat/models/fictional-6th-gen-fighter.glb',
  source: 'https://sketchfab.com/3d-models/fictional-6th-gen-fighter-b45853e311ce4ef2a0ff7b36b6873e55',
  title: 'Fictional 6th Gen Fighter',
  author: 'yoshikawa_Kosuke',
  license: 'CC-BY-4.0',
  sourceForward: '-x',
  targetLength: 8.2,
});

export const CIC_FIGHTER_ASSET_PROFILE = Object.freeze({
  ...FIGHTER_ASSET_PROFILE,
  id: 'fictional-6th-gen-fighter-cic',
  url: '/assets/combat/models/fictional-6th-gen-fighter-cic.glb',
});

export const CAPITAL_ASSET_PROFILE = Object.freeze({
  id: 'venator-class-star-destroyer',
  url: '/assets/combat/models/venator-class-star-destroyer.glb',
  source: 'https://sketchfab.com/3d-models/venator-class-star-destroyer-ff65cd3c27234615a3b68088f67e99e4',
  title: 'Venator Class Star Destroyer',
  author: 'ForkyForklift',
  license: 'CC-BY-4.0',
  sourceForward: '+z',
  targetLength: 12.72,
});

// The hero experiment keeps the complete web derivative above. The CIC uses
// a separate silhouette-first derivative so entering Command does not decode
// texture sets and greeble geometry that are sub-pixel in the pilot feed.
export const CIC_CAPITAL_ASSET_PROFILE = Object.freeze({
  ...CAPITAL_ASSET_PROFILE,
  id: 'venator-class-star-destroyer-cic',
  url: '/assets/combat/models/venator-class-star-destroyer-cic.glb',
});

function removeEmbeddedViewNodes(root) {
  const removable = [];
  root.traverse((node) => {
    if (node.isCamera || node.isLight) removable.push(node);
  });
  for (const node of removable) node.parent?.remove(node);
  return removable.length;
}

/**
 * Normalise a glTF scene to the combat convention: Y up, nose +Z, centred.
 * The downloaded Sketchfab model is authored Y-up with its nose along -X.
 */
export function normalizeCombatAsset(sourceRoot, profile = FIGHTER_ASSET_PROFILE) {
  if (!sourceRoot?.isObject3D) throw new TypeError('A Three.js Object3D is required.');

  const removedViewNodes = removeEmbeddedViewNodes(sourceRoot);
  const content = new THREE.Group();
  content.name = `${profile.id}-content`;
  content.add(sourceRoot);

  if (profile.sourceForward === '-x') content.rotation.y = Math.PI / 2;
  content.updateMatrixWorld(true);

  const sourceBounds = new THREE.Box3().setFromObject(content);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const sourceLength = sourceSize.z;
  if (!Number.isFinite(sourceLength) || sourceLength <= 0) {
    throw new Error(`Combat asset "${profile.id}" has no measurable length.`);
  }

  const scale = profile.targetLength / sourceLength;
  content.scale.setScalar(scale);
  content.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(content);
  const centre = scaledBounds.getCenter(new THREE.Vector3());
  content.position.sub(centre);
  content.updateMatrixWorld(true);

  // Keep the public combat root at an identity transform. Scene-level yaw,
  // weapon anchors and cloned formation offsets must live in normalized
  // combat units, not inherit a Sketchfab source scale that can be ~1e-6.
  const root = new THREE.Group();
  root.name = `${profile.id}-normalized`;
  root.add(content);
  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  let meshes = 0;
  root.traverse((node) => { if (node.isMesh) meshes += 1; });

  return {
    root,
    diagnostics: Object.freeze({
      id: profile.id,
      meshes,
      removedViewNodes,
      sourceLength,
      normalizedLength: size.z,
      scale,
      up: '+y',
      forward: '+z',
    }),
  };
}

export function disposeCombatAsset(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root?.traverse?.((node) => {
    if (node.geometry) geometries.add(node.geometry);
    node.skeleton?.dispose?.();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
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

export function createCombatAssetLoader(renderer, { workerLimit = 2 } = {}) {
  let ktx2Loader = null;
  let loader = null;
  let loaderDisposed = false;
  let resourcesDisposed = false;
  let disposePromise = null;
  const activeLoads = new Set();

  function ensureLoader() {
    if (loaderDisposed) throw new Error('Combat asset loader has been disposed.');
    if (loader) return loader;
    ktx2Loader = new KTX2Loader()
      .setTranscoderPath('/vendor/basis/')
      .setWorkerLimit(workerLimit)
      .detectSupport(renderer);
    loader = new GLTFLoader()
      .setKTX2Loader(ktx2Loader)
      .setMeshoptDecoder(MeshoptDecoder);
    return loader;
  }

  function disposeResources() {
    if (resourcesDisposed) return;
    resourcesDisposed = true;
    // KTX2Loader's WorkerPool does not reject queued work when terminated in
    // Three r160. Only terminate after every GLTF request has naturally
    // settled, otherwise callers can retain a permanently pending Promise.
    ktx2Loader?.dispose();
    ktx2Loader = null;
    loader = null;
  }

  function load(profile) {
    if (loaderDisposed) throw new Error('Combat asset loader has been disposed.');
    const request = (async () => {
      let gltf;
      try {
        gltf = await ensureLoader().loadAsync(profile.url);
        const normalized = normalizeCombatAsset(gltf.scene, profile);
        let disposed = false;
        return {
          ...normalized,
          animations: gltf.animations || [],
          profile,
          dispose() {
            if (disposed) return;
            disposed = true;
            normalized.root.removeFromParent();
            disposeCombatAsset(normalized.root);
          },
        };
      } catch (error) {
        if (gltf?.scene) disposeCombatAsset(gltf.scene);
        throw error;
      }
    })();
    activeLoads.add(request);
    request.finally(() => { activeLoads.delete(request); }).catch(() => {});
    return request;
  }

  return {
    load,
    dispose() {
      if (disposePromise) return disposePromise;
      loaderDisposed = true;
      if (!activeLoads.size) {
        disposeResources();
        disposePromise = Promise.resolve();
        return disposePromise;
      }
      disposePromise = Promise.allSettled([...activeLoads]).then(disposeResources);
      return disposePromise;
    },
  };
}

export async function loadCombatAsset(renderer, profile) {
  const loader = createCombatAssetLoader(renderer);
  try {
    return await loader.load(profile);
  } finally {
    loader.dispose();
  }
}

export function loadCombatFighterAsset(renderer, profile = FIGHTER_ASSET_PROFILE) {
  return loadCombatAsset(renderer, profile);
}
