/**
 * Three.js combat fighter — loads the licensed sixth-generation fighter GLB,
 * with the procedural NIGHTHAWK retained as the async/low-tier/GPU fallback.
 *
 * Drop-in for spriteCraft: exposes drawOriented(ctx, type, {az, el, size, alpha})
 * (nose up in frame; az/el = view angle). Renders the model offscreen for the
 * requested orientation and drawImage-s it, centred, into the 2D event-layer.
 * Only 'f47' is 3D; 'b2' returns false so the bomber keeps its sprite.
 */
import * as THREE from 'three';
import { createNighthawk } from './nighthawk.js';
import {
  FIGHTER_ASSET_PROFILE,
  loadCombatFighterAsset,
} from './combatAssetLoader.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import {
  canAcquireWebGLContext,
  createWebGLContextLifecycle,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';

const DEG = Math.PI / 180;
// The licensed model's 12.7-unit wingspan is wider than its 8.2-unit length;
// keep the square offscreen camera from clipping the stealth planform.
const AUTHORED_DISPLAY_SCALE = 0.25;

export function createFighter3D() {
  const renderCoordinator = getRenderBudgetCoordinator();
  let budgetActive = false;
  let contextReady = true;
  let surfaceActive = false;
  let qualityTier = 'balanced';
  let destroyed = false;
  let loadStarted = false;
  let loadStatus = 'deferred';
  let loadError = '';
  let authoredAsset = null;
  let pendingSwap = false;
  let renderer;
  if (!canAcquireWebGLContext('home:fighter-3d')) return null;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  const rendererLifecycle = createWebGLContextLifecycle({
    id: 'home:fighter-3d',
    canvas: renderer.domElement,
    showFallback: false,
    onLost() {
      contextReady = false;
      surfaceActive = false;
      syncModelVisibility();
    },
    onRestore() {
      renderer.resetState?.();
      contextReady = true;
      surfaceActive = budgetActive;
      syncModelVisibility();
      void startAuthoredLoad();
    },
    onFallback() {
      contextReady = false;
      surfaceActive = false;
    },
  });
  if (!rendererLifecycle.canInitialize) {
    rendererLifecycle.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  let renderSize = 320;
  renderer.setSize(renderSize, renderSize, false);
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2); camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x33465a, 1.5));
  const key = new THREE.DirectionalLight(0xdcecff, 2.6); key.position.set(5, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6f9fff, 1.6); rim.position.set(-6, 1, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xa9c4ff, 0.8); fill.position.set(0, -5, 3); scene.add(fill);

  // Nighthawk model (nose +Z). Recentre + scale so it frames like the old fighter.
  const nh = createNighthawk(THREE, {});
  nh.setMode('combat');
  nh.group.scale.setScalar(0.42);
  nh.group.position.set(0, -0.05, -0.5);   // model centroid sits forward of origin → pull back to centre
  const fighter = new THREE.Group();
  fighter.add(nh.group);
  scene.add(fighter);
  fighter.rotation.order = 'YXZ';

  const ready = true;

  function gpuCanLoadAuthoredAsset() {
    const context = renderer.getContext?.();
    return Boolean(context && !context.isContextLost?.());
  }

  function syncModelVisibility() {
    const useAuthored = Boolean(authoredAsset && qualityTier !== 'low' && contextReady);
    if (authoredAsset) authoredAsset.root.visible = useAuthored;
    if (useAuthored) {
      // Keep Nighthawk for the first authored render so the async hand-off
      // cannot create a transparent frame.
      nh.group.visible = true;
      pendingSwap = true;
    } else {
      nh.group.visible = true;
      pendingSwap = false;
    }
  }

  async function startAuthoredLoad() {
    if (loadStarted || destroyed || qualityTier === 'low') return;
    if (!gpuCanLoadAuthoredAsset()) {
      loadStatus = 'gpu-unavailable';
      return;
    }
    loadStarted = true;
    loadStatus = 'loading';
    try {
      const asset = await loadCombatFighterAsset(renderer);
      if (destroyed) {
        asset.dispose();
        return;
      }
      authoredAsset = asset;
      authoredAsset.root.scale.multiplyScalar(AUTHORED_DISPLAY_SCALE);
      fighter.add(authoredAsset.root);
      loadStatus = 'ready';
      syncModelVisibility();
    } catch (error) {
      if (destroyed) return;
      loadStatus = 'failed';
      loadError = error instanceof Error ? error.message : String(error);
      syncModelVisibility();
    }
  }

  function getAssetStatus() {
    const authoredVisible = Boolean(authoredAsset?.root.visible);
    const activeModel = authoredVisible && !nh.group.visible
      ? FIGHTER_ASSET_PROFILE.id
      : authoredVisible ? 'transition' : 'nighthawk';
    const reason = qualityTier === 'low'
      ? 'quality-low'
      : !contextReady ? 'context-unavailable'
        : loadStatus === 'failed' ? 'load-failed'
          : loadStatus === 'gpu-unavailable' ? 'gpu-unavailable' : '';
    return Object.freeze({
      loadStatus,
      activeModel,
      reason,
      error: loadError,
      profile: FIGHTER_ASSET_PROFILE,
    });
  }

  function orient(az, el, now) {
    fighter.rotation.set(0, 0, 0);
    fighter.rotateX(-Math.PI / 2 + (el - 30) * DEG * 0.5);  // nose up; tip with elevation
    fighter.rotateY((az - 90) * DEG * 0.7);                 // bank / yaw with heading
    nh.tick(now * 0.001);                                   // engine flicker / nav blink
  }

  function drawOriented(ctx, type, { az = 90, el = 45, size = 96, alpha = 1 } = {}) {
    if (type === 'b2' || !ready || !surfaceActive) return false;   // bomber keeps its sprite
    orient(az, el, performance.now());
    renderer.render(scene, camera);
    if (pendingSwap && authoredAsset?.root.visible) {
      nh.group.visible = false;
      pendingSwap = false;
    }
    const draw = size * 1.6;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    ctx.drawImage(renderer.domElement, -draw / 2, -draw / 2, draw, draw);
    ctx.globalAlpha = a;
    return true;
  }

  const renderSurface = renderCoordinator.register({
    id: 'home:fighter-3d',
    observe: false,
    cost: 'medium',
    targetFps: 60,
    onResume() {
      budgetActive = true;
      surfaceActive = contextReady;
    },
    onPause() {
      budgetActive = false;
      surfaceActive = false;
    },
    onQualityChange(policy) {
      qualityTier = policy.qualityTier;
      const nextSize = policy.qualityTier === 'low' ? 192 : policy.qualityTier === 'balanced' ? 256 : 320;
      if (nextSize !== renderSize) {
        renderSize = nextSize;
        renderer.setSize(renderSize, renderSize, false);
      }
      syncModelVisibility();
      void startAuthoredLoad();
    },
    onDispose() {
      destroyed = true;
      authoredAsset?.dispose();
      authoredAsset = null;
      rendererLifecycle.dispose();
      disposeThreeScene(scene, renderer);
    },
  });

  return {
    drawOriented,
    available: () => ready && surfaceActive,
    getAssetStatus,
    getDiagnostics: () => Object.freeze({
      asset: getAssetStatus(),
      model: authoredAsset?.diagnostics || null,
      qualityTier,
      contextReady,
      surfaceActive,
    }),
    destroy() { renderSurface.dispose(); },
  };
}
