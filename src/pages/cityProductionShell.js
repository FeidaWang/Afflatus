import {
  loadCityProductionFirstFrame,
  prepareCityProductionRuntime,
} from '../city/productionRuntime.ts';
import { createCityEnvironmentClock } from '../city/environmentClock.ts';
import { createAutoLocalEnvironmentScheduler } from '../city/autoLocalEnvironment.ts';
import { createCityPackageRenderer } from '../scene/cityPackageRenderer.js';

export async function createCityProductionShell({
  canvas,
  cityId,
  packageReference,
  signal,
  initialEnvironment = 'day',
  readBytes,
  onTelemetry = () => {},
  onStreamingChange = () => {},
  onEnvironmentChange = () => {},
  onEnvironmentRefreshError = () => {},
  onViewChange = () => {},
  onPick = () => {},
  onFallback = () => {},
} = {}) {
  const runtime = await prepareCityProductionRuntime({
    cityId,
    packageReference,
    signal,
    readBytes,
  });
  if (runtime.status !== 'ready') return runtime;

  const firstFrame = await loadCityProductionFirstFrame({ runtime, signal });
  if (firstFrame.status !== 'ready') {
    return firstFrame.status === 'cancelled'
      ? firstFrame
      : Object.freeze({ status: 'fallback', reason: `first-frame-${firstFrame.reason}` });
  }

  const clock = createCityEnvironmentClock(cityId);
  const environment = clock.resolve(initialEnvironment);
  let scene;
  let autoLocalScheduler = null;
  try {
    scene = await createCityPackageRenderer({
      canvas,
      cityId,
      tileLoad: firstFrame.tileLoad,
      tileSession: runtime.session,
      cameraPreset: firstFrame.cameraPreset,
      initialEnvironment: environment,
      onTelemetry,
      onStreamingChange,
      onPick,
      onFallback: (state) => {
        autoLocalScheduler?.pause();
        onFallback(state);
      },
    });
  } catch {
    return Object.freeze({ status: 'fallback', reason: 'renderer-initialization-failed' });
  }
  if (!scene.available) {
    scene.destroy();
    return Object.freeze({ status: 'fallback', reason: 'webgl-unavailable' });
  }

  const refreshEnvironment = (request, instant) => {
    if (!scene.available) throw new Error('Production renderer is unavailable.');
    const snapshot = clock.resolve(request, request === 'auto-local' ? instant : undefined);
    scene.setEnvironment(snapshot);
    onEnvironmentChange(snapshot);
    return snapshot;
  };
  autoLocalScheduler = createAutoLocalEnvironmentScheduler({
    refresh: refreshEnvironment,
    onRefreshError: (error) => {
      onEnvironmentRefreshError(Object.freeze({
        reason: `auto-local-refresh:${error?.message ?? 'unknown'}`,
        retainedVerifiedState: true,
      }));
    },
  });
  const onVisibilityChange = () => {
    if (document.hidden) autoLocalScheduler.pause();
    else autoLocalScheduler.resume();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  const setEnvironment = (request, instant) => autoLocalScheduler.select(request, instant);
  const canonicalViews = runtime.manifest.canonicalViews;
  let currentView = canonicalViews[0];
  const setCanonicalView = async (viewId) => {
    const view = canonicalViews.find(({ id }) => id === viewId);
    if (!view) throw new Error(`Unknown production camera: ${viewId}`);
    const selection = await scene.setCameraPreset({
      position: view.positionLocal,
      target: view.targetLocal,
      fov: view.verticalFovDegrees,
    });
    if (!selection) return null;
    currentView = view;
    onViewChange(view);
    return view;
  };
  onEnvironmentChange(environment);
  onViewChange(currentView);
  return Object.freeze({
    status: 'ready',
    runtime,
    firstFrame,
    scene,
    environment,
    canonicalViews,
    setEnvironment,
    setCanonicalView,
    getCanonicalView: () => currentView,
    getAutoLocalState: () => autoLocalScheduler.getState(),
    pauseAutoLocal: () => autoLocalScheduler.pause(),
    resumeAutoLocal: () => autoLocalScheduler.resume(),
    destroy() {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      autoLocalScheduler.destroy();
      scene.destroy();
    },
  });
}
