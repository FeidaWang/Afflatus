import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AFFLATUS_SCENE_SIGNAL_EVENT } from '../../lib/sceneSignals.js';
import {
  createCinematicLighting,
  createSelectiveBloomPipeline,
} from './cinematicPipeline.js';
import { resolvePointerParallax } from './FlightDirector.js';
import { createCarrierProxy } from './createCarrierProxy.js';
import {
  applyVanguardSurfaceTextures,
  disposeVanguardSurfaceTextures,
  loadVanguardSurfaceTextures,
} from '../../scene/afflatusVanguard.js';
import { createQualityGovernor } from './qualityGovernor.js';
import { RENDER_BUDGETS, RESOURCE_MATRIX } from './qualityProfile.js';
import { measureSceneResources } from './resourceMetrics.js';
import { SCENE_STATUS } from './sceneState.js';
import { createSpaceLayers } from './spaceLayers.js';

function applyFlightFrame(camera, renderer, frame, viewport, parallax) {
  camera.position.fromArray(frame.cameraPosition);
  camera.fov = frame.fov;
  camera.aspect = viewport.width / viewport.height;
  camera.rotation.set(0, 0, 0);
  camera.lookAt(...frame.lookAt);
  camera.rotateZ(THREE.MathUtils.degToRad(frame.roll));
  camera.setViewOffset(
    viewport.width,
    viewport.height,
    -parallax.x,
    -parallax.y,
    viewport.width,
    viewport.height,
  );
  camera.updateProjectionMatrix();
  renderer.toneMappingExposure = frame.exposure;
}

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material?.dispose?.());
  });
}

export function SignatureScene({
  assetHref,
  debugEnabled,
  diagnostics,
  director,
  onReady,
  onStatus,
  onUnavailable,
  profile,
  sceneState,
  timeline,
}) {
  const hostRef = useRef(null);
  const debugRef = useRef(null);
  const callbacksRef = useRef({ onReady, onStatus, onUnavailable });

  useEffect(() => {
    callbacksRef.current = { onReady, onStatus, onUnavailable };
  }, [onReady, onStatus, onUnavailable]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const budget = RENDER_BUDGETS[profile];
    if (!budget) {
      callbacksRef.current.onUnavailable?.();
      return undefined;
    }

    let disposed = false;
    let running = false;
    let raf = 0;
    let lastFrame = performance.now();
    let renderer;
    let texture;
    let surfaceTextures;
    let surfaceTextureIdleHandle = 0;
    let surfaceTextureTimeoutHandle = 0;
    let postProcessing;
    let contextRestoreTimer = 0;
    let lastChapterCue = null;
    let lastDebugText = '';
    let parallaxTarget = { x: 0, y: 0 };
    const parallax = { x: 0, y: 0 };
    const viewport = { width: 1, height: 1 };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);
    const initialFlight = director.update(timeline.getSnapshot());
    const governor = createQualityGovernor({ profile });
    let qualitySettings = governor.getSnapshot();

    const reportFailure = () => {
      if (disposed) return;
      running = false;
      window.cancelAnimationFrame(raf);
      diagnostics.mainRafRunning = false;
      diagnostics.activeRafOwners = 0;
      host.dataset.raf = 'stopped';
      callbacksRef.current.onUnavailable?.();
    };

    let carrier;
    try {
      carrier = createCarrierProxy(THREE, profile);
      scene.add(carrier.group);
    } catch {
      disposeScene(scene);
      reportFailure();
      return undefined;
    }

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: budget.antialias,
        powerPreference: profile === 'high' ? 'high-performance' : 'default',
      });
    } catch {
      disposeScene(scene);
      reportFailure();
      return undefined;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = initialFlight.exposure;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, budget.dpr));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.setAttribute('tabindex', '-1');
    renderer.domElement.dataset.qualityProfile = profile;
    host.appendChild(renderer.domElement);

    scene.add(camera);
    const spaceLayers = createSpaceLayers(THREE, { camera, profile, scene });
    const cinematicLighting = createCinematicLighting(THREE, { carrier, profile, scene });
    postProcessing = createSelectiveBloomPipeline(THREE, {
      camera,
      profile,
      renderer,
      scene,
    });
    applyFlightFrame(camera, renderer, initialFlight, viewport, parallax);
    host.dataset.pathNode = initialFlight.pathNode;
    host.dataset.shipMotion = 'camera-only';
    diagnostics.shipTriangles = carrier.triangleCount;
    diagnostics.shipRotation = [
      carrier.group.rotation.x,
      carrier.group.rotation.y,
      carrier.group.rotation.z,
    ];
    diagnostics.spaceLayers = spaceLayers.diagnostics;
    diagnostics.postProcessing = {
      bloomObjects: cinematicLighting.bloomObjects,
      selectiveBloom: postProcessing.enabled,
    };
    diagnostics.resourceProfile = RESOURCE_MATRIX[profile];
    diagnostics.qualityGovernor = qualitySettings;
    diagnostics.surfaceTextures = RESOURCE_MATRIX[profile].surfaceTextures === 'ktx2-basis'
      ? 'scheduled'
      : 'profile-disabled';

    const applyQualitySettings = (nextSettings) => {
      const changed = nextSettings.degradationLevel !== qualitySettings.degradationLevel;
      qualitySettings = nextSettings;
      diagnostics.qualityGovernor = nextSettings;
      postProcessing.setEnabled(nextSettings.bloomEnabled);
      diagnostics.postProcessing.selectiveBloom = postProcessing.enabled;
      if (changed) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, nextSettings.dpr));
        renderer.setSize(viewport.width, viewport.height, false);
        postProcessing.setSize(viewport.width, viewport.height);
      }
      return changed;
    };
    diagnostics.samplePerformance = (frameMs, now) => applyQualitySettings(governor.sample(frameMs, now));

    const onSceneSignal = (event) => {
      const signal = event.detail?.signal;
      diagnostics.lastSceneSignal = signal || '';
      spaceLayers.pulse(signal, performance.now());
    };
    document.addEventListener(AFFLATUS_SCENE_SIGNAL_EVENT, onSceneSignal);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      viewport.width = Math.max(1, Math.round(rect.width));
      viewport.height = Math.max(1, Math.round(rect.height));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualitySettings.dpr));
      renderer.setSize(viewport.width, viewport.height, false);
      postProcessing.setSize(viewport.width, viewport.height);
      applyFlightFrame(camera, renderer, director.getSnapshot(), viewport, parallax);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const finePointer = Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches);
    const onPointerMove = (event) => {
      if (!finePointer || (event.pointerType && event.pointerType !== 'mouse')) return;
      parallaxTarget = resolvePointerParallax({
        clientX: event.clientX,
        clientY: event.clientY,
        height: viewport.height,
        maxPixels: 5,
        width: viewport.width,
      });
    };
    const resetParallax = () => { parallaxTarget = { x: 0, y: 0 }; };
    if (finePointer) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('blur', resetParallax);
    }

    const targetFrameMs = 1000 / budget.fps;
    const render = (now) => {
      if (!running || disposed) return;
      diagnostics.sceneFrames += 1;
      if (now - lastFrame >= targetFrameMs - 0.8) {
        const frameMs = now - lastFrame;
        const delta = Math.min(frameMs / 1000, 0.05);
        lastFrame = now;
        applyQualitySettings(governor.sample(frameMs, now));
        const timelineFrame = timeline.sample(now);
        const flight = director.update(timelineFrame);
        const parallaxAlpha = 1 - Math.exp(-8 * delta);
        parallax.x += (parallaxTarget.x - parallax.x) * parallaxAlpha;
        parallax.y += (parallaxTarget.y - parallax.y) * parallaxAlpha;
        applyFlightFrame(camera, renderer, flight, viewport, parallax);
        diagnostics.layerState = spaceLayers.update(flight, {
          dustEnabled: qualitySettings.dustEnabled,
          now,
        });
        cinematicLighting.update(flight.progress);

        if (lastChapterCue !== flight.chapterCue) {
          lastChapterCue = flight.chapterCue;
          sceneState.update({
            activeSystem: flight.activeSystem,
            chapterId: flight.chapterCue,
          });
          host.dataset.chapterCue = flight.chapterCue;
        }
        if (host.dataset.pathNode !== flight.pathNode) host.dataset.pathNode = flight.pathNode;

        if (debugEnabled && debugRef.current) {
          const debugText = `PROGRESS ${flight.progress.toFixed(3)} · FOV ${flight.fov.toFixed(1)} · NODE ${flight.pathNode}`;
          if (debugText !== lastDebugText) {
            debugRef.current.textContent = debugText;
            lastDebugText = debugText;
          }
        }

        diagnostics.cameraPosition = [...flight.cameraPosition];
        diagnostics.fov = flight.fov;
        diagnostics.parallaxPixels = { ...parallax };
        diagnostics.pathNode = flight.pathNode;
        diagnostics.roll = flight.roll;
        postProcessing.render();
        diagnostics.sceneRenders += 1;
        diagnostics.performance = {
          frameMs: qualitySettings.averageFrameMs,
          fps: qualitySettings.averageFrameMs > 0 ? 1000 / qualitySettings.averageFrameMs : 0,
        };
        if (diagnostics.sceneRenders === 1 || diagnostics.sceneRenders % 120 === 0) {
          diagnostics.resources = measureSceneResources(scene, renderer, texture ? 1 : 0);
        }
      }
      raf = window.requestAnimationFrame(render);
    };

    const start = () => {
      if (running || disposed || !texture) return;
      running = true;
      lastFrame = performance.now();
      diagnostics.mainRafRunning = true;
      diagnostics.activeRafOwners = 1;
      host.dataset.raf = 'running';
      callbacksRef.current.onStatus?.(SCENE_STATUS.READY);
      raf = window.requestAnimationFrame(render);
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(raf);
      diagnostics.mainRafRunning = false;
      diagnostics.activeRafOwners = 0;
      host.dataset.raf = 'paused';
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        callbacksRef.current.onStatus?.(SCENE_STATUS.PAUSED);
      } else {
        start();
      }
    };
    const onPageHide = () => {
      stop();
      callbacksRef.current.onStatus?.(SCENE_STATUS.PAUSED);
    };
    const onPageShow = () => {
      if (!document.hidden) start();
    };
    const onContextLost = (event) => {
      event.preventDefault();
      stop();
      diagnostics.contextState = 'lost-awaiting-restore';
      callbacksRef.current.onStatus?.(SCENE_STATUS.PAUSED);
      window.clearTimeout(contextRestoreTimer);
      contextRestoreTimer = window.setTimeout(reportFailure, 1_200);
    };
    const onContextRestored = () => {
      window.clearTimeout(contextRestoreTimer);
      diagnostics.contextState = 'restored';
      resize();
      postProcessing.render();
      start();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    const scheduleSurfaceTextures = () => {
      if (RESOURCE_MATRIX[profile].surfaceTextures !== 'ktx2-basis') return;
      const load = async () => {
        diagnostics.surfaceTextures = 'loading';
        try {
          const loaded = await loadVanguardSurfaceTextures(THREE, renderer);
          if (disposed) {
            disposeVanguardSurfaceTextures(loaded);
            return;
          }
          surfaceTextures = loaded;
          applyVanguardSurfaceTextures(carrier.group, surfaceTextures, 'high');
          diagnostics.surfaceTextures = 'ktx2-basis';
          diagnostics.resources = measureSceneResources(scene, renderer, texture ? 1 : 0);
        } catch {
          diagnostics.surfaceTextures = 'unavailable';
        }
      };
      if (typeof window.requestIdleCallback === 'function') {
        surfaceTextureIdleHandle = window.requestIdleCallback(load, { timeout: 1_500 });
      } else {
        surfaceTextureTimeoutHandle = window.setTimeout(load, 700);
      }
    };

    new THREE.TextureLoader().load(
      assetHref,
      (loadedTexture) => {
        if (disposed) {
          loadedTexture.dispose();
          return;
        }
        texture = loadedTexture;
        texture.colorSpace = THREE.SRGBColorSpace;
        host.dataset.renderer = 'webgl';
        applyFlightFrame(camera, renderer, director.getSnapshot(), viewport, parallax);
        postProcessing.render();
        callbacksRef.current.onReady?.();
        scheduleSurfaceTextures();
        if (document.hidden) {
          stop();
          callbacksRef.current.onStatus?.(SCENE_STATUS.PAUSED);
        } else {
          start();
        }
      },
      undefined,
      reportFailure,
    );

    return () => {
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener(AFFLATUS_SCENE_SIGNAL_EVENT, onSceneSignal);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.clearTimeout(contextRestoreTimer);
      if (surfaceTextureIdleHandle) window.cancelIdleCallback?.(surfaceTextureIdleHandle);
      window.clearTimeout(surfaceTextureTimeoutHandle);
      if (finePointer) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('blur', resetParallax);
      }
      resizeObserver.disconnect();
      disposeScene(scene);
      texture?.dispose();
      disposeVanguardSurfaceTextures(surfaceTextures);
      postProcessing?.dispose();
      delete diagnostics.samplePerformance;
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    };
  }, [assetHref, debugEnabled, diagnostics, director, profile, sceneState, timeline]);

  return (
    <div
      className="signature-scene"
      ref={hostRef}
      data-renderer="loading"
      data-raf="stopped"
      data-path-node="distant-observation"
      data-ship-motion="camera-only"
    >
      {debugEnabled ? <output className="flight-debug-overlay" ref={debugRef} /> : null}
    </div>
  );
}
