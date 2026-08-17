import {
  normalizeMelbourneAnalysisFailureMode,
  prepareMelbourneAnalysisRuntime,
} from '../city/analysisRuntime.ts';
import { MELBOURNE_ANALYSIS_BASELINE } from '../city/analysisPreview.ts';
import {
  MELBOURNE_ENVIRONMENT_CLOCK,
  normalizeCityEnvironmentRequest,
} from '../city/environmentClock.ts';
import { createCityAnalysisPreviewRenderer } from '../scene/cityAnalysisPreview.js';

async function fetchBytes(url, signal) {
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`Local candidate request failed (${response.status}).`);
  return response.arrayBuffer();
}

export async function createCityAnalysisShellPreview({
  canvas,
  signal,
  failureMode = 'none',
  initialEnvironment = 'analysis',
  environmentFailureMode = 'none',
  onTelemetry = () => {},
  onStreamingChange = () => {},
  onEnvironmentChange = () => {},
  onPick = () => {},
  onFallback = () => {},
} = {}) {
  const runtime = await prepareMelbourneAnalysisRuntime({
    readBytes: fetchBytes,
    signal,
    failureMode: normalizeMelbourneAnalysisFailureMode(failureMode),
  });
  const sourceLayers = new Map(
    runtime.manifest.sourceLayers.map((source) => [source.ledgerLayerId, source]),
  );
  const resolveEnvironment = (requestValue) => {
    const normalized = normalizeCityEnvironmentRequest(requestValue);
    try {
      if (!normalized) throw new Error(`unknown-environment:${String(requestValue)}`);
      if (environmentFailureMode === normalized) {
        throw new Error(`injected-environment-failure:${normalized}`);
      }
      const snapshot = MELBOURNE_ENVIRONMENT_CLOCK.resolve(
        normalized,
        normalized === 'auto-local' ? new Date() : undefined,
      );
      return Object.freeze({
        status: 'ready',
        requestedEnvironment: normalized,
        reason: null,
        snapshot,
      });
    } catch (error) {
      return Object.freeze({
        status: 'fallback',
        requestedEnvironment: normalized ?? String(requestValue),
        reason: error instanceof Error ? error.message : 'environment-resolution-failed',
        snapshot: MELBOURNE_ENVIRONMENT_CLOCK.resolve('analysis'),
      });
    }
  };
  let environmentState = resolveEnvironment(initialEnvironment);
  const scene = await createCityAnalysisPreviewRenderer({
    canvas,
    tileLoad: runtime.tileLoad,
    tileSession: runtime.session,
    cameraPreset: MELBOURNE_ANALYSIS_BASELINE.camera,
    initialEnvironment: environmentState.snapshot,
    onTelemetry,
    onStreamingChange,
    onPick: (feature) => {
      const source = feature ? sourceLayers.get(feature.layerId) : null;
      onPick(feature ? Object.freeze({
        ...feature,
        provider: source?.provider ?? null,
        attribution: source?.attribution ?? null,
      }) : null);
    },
    onFallback,
  });
  if (!scene.available) throw new Error('WebGL is unavailable.');
  const setEnvironment = (request) => {
    environmentState = resolveEnvironment(request);
    scene.setEnvironment(environmentState.snapshot);
    onEnvironmentChange(environmentState);
    return environmentState;
  };
  onEnvironmentChange(environmentState);
  return Object.freeze({
    scene,
    runtime,
    get environment() {
      return environmentState;
    },
    setEnvironment,
  });
}
