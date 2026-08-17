import {
  MELBOURNE_ANALYSIS_BASELINE,
  MELBOURNE_ANALYSIS_MANIFEST_SHA256,
  isMelbourneAnalysisPreviewAllowed,
} from '../city/analysisPreview.ts';
import {
  normalizeMelbourneAnalysisFailureMode,
  prepareMelbourneAnalysisRuntime,
} from '../city/analysisRuntime.ts';

const canvas = document.querySelector('[data-analysis-canvas]');
const stage = document.querySelector('[data-analysis-stage]');
const status = document.querySelector('[data-analysis-status]');
const resetButton = document.querySelector('[data-analysis-reset]');
const outputs = Object.freeze(Object.fromEntries([
  'tiles', 'bytes', 'draw-calls', 'triangles', 'primary', 'resident', 'picked', 'attribution', 'p95', 'manifest',
].map((key) => [key, document.querySelector(`[data-analysis-output="${key}"]`)])));
const abortController = new AbortController();
let preview = null;
let loadedBaseline = null;
let selectedFeature = null;
let sourceLayers = new Map();

function setStatus(message, state = 'loading') {
  status.textContent = message;
  stage.dataset.analysisState = state;
}

function setOutput(key, value) {
  if (outputs[key]) outputs[key].textContent = String(value);
}

function renderStreamingState(selection, cache) {
  if (selection) {
    setOutput('tiles', `${selection.resolvedTileIds.length} (1 requested)`);
    setOutput('bytes', new Intl.NumberFormat('en-AU').format(selection.assetBytes));
    setOutput('draw-calls', selection.drawCalls);
    setOutput('triangles', new Intl.NumberFormat('en-AU').format(selection.triangles));
    setOutput('primary', `${selection.primaryTileId} / LOD${selection.lod}`);
  }
  if (cache) {
    setOutput(
      'resident',
      `${cache.residentAssets} · ${new Intl.NumberFormat('en-AU').format(cache.residentBytes)} B · ${cache.evictionCount} evicted`,
    );
  }
}

async function fetchBytes(url, signal) {
  const response = await fetch(url, { signal, cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Local candidate request failed (${response.status}).`);
  return response.arrayBuffer();
}

async function mount() {
  stage.setAttribute('aria-busy', 'true');
  const allowed = isMelbourneAnalysisPreviewAllowed({
    dev: import.meta.env.DEV,
    hostname: window.location.hostname,
  });
  if (!allowed) {
    setStatus(
      'Blocked: this candidate renderer is available only from the local Vite development server. / 已阻止：候选 renderer 仅可通过本地 Vite 开发服务器使用。',
      'blocked',
    );
    stage.setAttribute('aria-busy', 'false');
    return;
  }

  try {
    setStatus('Verifying frozen manifest and first-frame assets… / 正在验证冻结清单与首屏资产…');
    const runtime = await prepareMelbourneAnalysisRuntime({
      readBytes: fetchBytes,
      signal: abortController.signal,
      failureMode: normalizeMelbourneAnalysisFailureMode(
        new URLSearchParams(window.location.search).get('failure'),
      ),
    });
    const {
      manifest,
      session,
      tileLoad,
      baseline,
    } = runtime;
    sourceLayers = new Map(manifest.sourceLayers.map((source) => [source.ledgerLayerId, source]));
    loadedBaseline = baseline;

    setOutput('tiles', `${baseline.tileCount} (${tileLoad.requestedTileIds.length} requested)`);
    setOutput('bytes', new Intl.NumberFormat('en-AU').format(baseline.bytes));
    setOutput('draw-calls', baseline.drawCalls);
    setOutput('triangles', new Intl.NumberFormat('en-AU').format(baseline.triangles));
    setOutput('manifest', MELBOURNE_ANALYSIS_MANIFEST_SHA256.slice(0, 12));

    const { createCityAnalysisPreviewRenderer } = await import('../scene/cityAnalysisPreview.js');
    preview = await createCityAnalysisPreviewRenderer({
      canvas,
      tileLoad,
      tileSession: session,
      cameraPreset: MELBOURNE_ANALYSIS_BASELINE.camera,
      onTelemetry: (telemetry) => setOutput('p95', `${telemetry.p95Ms.toFixed(2)} ms`),
      onStreamingChange: (streaming) => {
        renderStreamingState(streaming.selection, streaming.cache);
        if (streaming.status === 'loading') {
          setStatus(
            `Loading verified ${streaming.selection.primaryTileId} LOD${streaming.selection.lod}… / 正在加载已验证空间 tile…`,
            'streaming',
          );
        } else if (streaming.status === 'ready' && preview) {
          setStatus(
            `Verified ${streaming.selection.primaryTileId} LOD${streaming.selection.lod}. Orbit or zoom to stream another set. / 已验证空间切片，可环绕或缩放继续调度。`,
            'ready',
          );
        } else if (streaming.status === 'fallback') {
          setStatus(
            `Streaming failed closed; retaining the last verified set (${streaming.reason}). / 空间加载已安全回退，保留上一组已验证 tiles。`,
            'fallback',
          );
        }
      },
      onPick: (feature) => {
        const source = feature ? sourceLayers.get(feature.layerId) : null;
        selectedFeature = feature ? Object.freeze({
          ...feature,
          provider: source?.provider ?? null,
          attribution: source?.attribution ?? null,
        }) : null;
        setOutput('picked', feature
          ? `${feature.layerId} · ${feature.entityId}`
          : 'none / 未选择');
        setOutput('attribution', source?.attribution ?? '—');
      },
      onFallback: () => setStatus(
        'WebGL failed closed; verified package facts remain visible. / WebGL 已安全回退；已验证的数据包事实仍然可见。',
        'fallback',
      ),
    });
    if (!preview.available) throw new Error('WebGL is unavailable.');
    resetButton.disabled = false;
    canvas.dataset.renderer = 'webgl';
    setStatus(
      'Verified local Analysis slice ready. Candidate only—not published. / 已验证本地 Analysis 切片。仅为候选，未发布。',
      'ready',
    );
  } catch (error) {
    if (abortController.signal.aborted) return;
    console.warn('[city-analysis-preview] failed closed', error);
    canvas.dataset.renderer = 'poster';
    resetButton.disabled = true;
    setStatus(
      `Preview failed closed: ${error.message} / 预览已安全回退。`,
      'fallback',
    );
  } finally {
    stage.setAttribute('aria-busy', 'false');
  }
}

resetButton.addEventListener('click', () => preview?.resetCamera());
window.addEventListener('pagehide', () => {
  abortController.abort();
  preview?.destroy();
}, { once: true });

Object.defineProperty(window, '__AFFLATUS_CITY_ANALYSIS_PREVIEW__', {
  configurable: true,
  value: Object.freeze({
    resetCamera: () => preview?.resetCamera?.() ?? null,
    setView: (view) => preview?.setView?.(view) ?? null,
    getState: () => Object.freeze({
      state: stage.dataset.analysisState,
      baseline: loadedBaseline,
      telemetry: preview?.getTelemetry?.() ?? null,
      selectedFeature,
      manifestSha256: MELBOURNE_ANALYSIS_MANIFEST_SHA256,
    }),
  }),
});

mount();
