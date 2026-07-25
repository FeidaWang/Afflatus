/**
 * Three.js combat fighter — now the NIGHTHAWK (shared model from nighthawk.js),
 * so the home-page escorts and the top-down scene use one detailed model.
 *
 * Drop-in for spriteCraft: exposes drawOriented(ctx, type, {az, el, size, alpha})
 * (nose up in frame; az/el = view angle). Renders the model offscreen for the
 * requested orientation and drawImage-s it, centred, into the 2D event-layer.
 * Only 'f47' is 3D; 'b2' returns false so the bomber keeps its sprite.
 */
import * as THREE from 'three';
import { createNighthawk } from './nighthawk.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import {
  canAcquireWebGLContext,
  createWebGLContextLifecycle,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';

const DEG = Math.PI / 180;

export function createFighter3D() {
  const renderCoordinator = getRenderBudgetCoordinator();
  let budgetActive = false;
  let contextReady = true;
  let surfaceActive = false;
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
    },
    onRestore() {
      renderer.resetState?.();
      contextReady = true;
      surfaceActive = budgetActive;
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
      const nextSize = policy.qualityTier === 'low' ? 192 : policy.qualityTier === 'balanced' ? 256 : 320;
      if (nextSize !== renderSize) {
        renderSize = nextSize;
        renderer.setSize(renderSize, renderSize, false);
      }
    },
    onDispose() {
      rendererLifecycle.dispose();
      disposeThreeScene(scene, renderer);
    },
  });

  return {
    drawOriented,
    available: () => ready && surfaceActive,
    destroy() { renderSurface.dispose(); },
  };
}
