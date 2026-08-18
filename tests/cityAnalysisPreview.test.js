import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MELBOURNE_ANALYSIS_BASELINE,
  MELBOURNE_ANALYSIS_EVIDENCE_MANIFEST_SHA256,
  MELBOURNE_ANALYSIS_MANIFEST_SHA256,
  isMelbourneAnalysisPreviewAllowed,
  melbourneCandidateSourceUrl,
  summarizeMelbourneAnalysisBaseline,
} from '../src/city/analysisPreview.ts';
import { loadCandidateCityTiles } from '../src/city/packageLoader.ts';
import { BUILD_ROUTES } from '../src/config/siteManifest.js';

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGE_DIR = resolve(
  ROOT,
  'data/city/candidates/melbourne-flinders-federation-v1',
);
const MANIFEST_PATH = resolve(PACKAGE_DIR, 'manifest.json');
const manifestBytes = readFileSync(MANIFEST_PATH);
const manifest = JSON.parse(manifestBytes);

describe('local Melbourne Analysis preview contract', () => {
  it('is restricted to the development server on loopback hosts', () => {
    expect(isMelbourneAnalysisPreviewAllowed({ dev: true, hostname: '127.0.0.1' })).toBe(true);
    expect(isMelbourneAnalysisPreviewAllowed({ dev: true, hostname: 'localhost' })).toBe(true);
    expect(isMelbourneAnalysisPreviewAllowed({ dev: true, hostname: 'feida.au' })).toBe(false);
    expect(isMelbourneAnalysisPreviewAllowed({ dev: false, hostname: '127.0.0.1' })).toBe(false);
  });

  it('rewrites only immutable package-local asset names', () => {
    expect(melbourneCandidateSourceUrl(
      '/assets/city/packages/melbourne-flinders-federation-v1/tile-c01-r02-lod0-analysis.glb',
    )).toBe(
      '/data/city/candidates/melbourne-flinders-federation-v1/tile-c01-r02-lod0-analysis.glb',
    );
    expect(melbourneCandidateSourceUrl('/data/city/raw/private.zip')).toBeNull();
    expect(melbourneCandidateSourceUrl(
      '/assets/city/packages/melbourne-flinders-federation-v1/../manifest.json',
    )).toBeNull();
  });

  it('pins the manifest and first-frame dependency closure to its measured baseline', async () => {
    expect(createHash('sha256').update(manifestBytes).digest('hex'))
      .toBe(MELBOURNE_ANALYSIS_MANIFEST_SHA256);
    const result = await loadCandidateCityTiles({
      manifest,
      requestedTileIds: MELBOURNE_ANALYSIS_BASELINE.requestedTileIds,
      lod: MELBOURNE_ANALYSIS_BASELINE.lod,
      fetchAsset: async (uri) => readFileSync(resolve(PACKAGE_DIR, uri.split('/').at(-1))),
    });
    expect(result.status).toBe('ready');
    expect(summarizeMelbourneAnalysisBaseline(result)).toEqual({
      tileCount: 4,
      bytes: 428448,
      drawCalls: 22,
      triangles: 6640,
      lineSegments: 2049,
      points: 43,
      matchesFrozenBaseline: true,
    });
  });

  it('keeps the preview page out of production routes and declares candidate truth', () => {
    const html = readFileSync(resolve(ROOT, 'city-analysis-preview.html'), 'utf8');
    const pageSource = readFileSync(resolve(ROOT, 'src/pages/cityAnalysisPreview.js'), 'utf8');
    const shellSource = readFileSync(resolve(ROOT, 'src/pages/cityAnalysisShellPreview.js'), 'utf8');
    const rendererSource = readFileSync(resolve(ROOT, 'src/scene/cityAnalysisPreview.js'), 'utf8');
    const stabilityViteConfig = readFileSync(resolve(ROOT, 'vite.city-analysis.config.js'), 'utf8');
    expect(BUILD_ROUTES.some(({ file }) => file === 'city-analysis-preview.html')).toBe(false);
    expect(html).toContain('noindex,nofollow,noarchive');
    expect(html).toContain('Non-public · local engineering only');
    expect(pageSource).toContain('import.meta.env.DEV');
    expect(pageSource).toContain('MELBOURNE_ANALYSIS_MANIFEST_SHA256');
    expect(pageSource).toContain('prepareMelbourneAnalysisRuntime');
    expect(rendererSource).toContain('setMeshoptDecoder(MeshoptDecoder)');
    expect(rendererSource).toContain('selectCityPackageStreamingSet');
    expect(rendererSource).toContain('applyCityStyleTwin');
    expect(rendererSource).toContain('setEnvironment(snapshot)');
    expect(rendererSource).toContain('setCameraPreset');
    expect(rendererSource).toContain('applyCameraPreset(previous)');
    expect(rendererSource).toContain('selection: pickedEntity');
    expect(rendererSource).toContain('disposeThreeObject3D(record.group)');
    expect(rendererSource).toContain("getAttribute?.('_feature_id_0')");
    expect(rendererSource).toContain('disposeThreeScene(scene, renderer)');
    expect(shellSource).toContain('MELBOURNE_ENVIRONMENT_CLOCK');
    expect(stabilityViteConfig).toContain('hmr: false');
  });

  it('pins the five- and 30-minute stability evidence to both visual baselines', () => {
    for (const window of ['5m', '30m']) {
      const evidence = JSON.parse(readFileSync(resolve(
        ROOT,
        `data/city/reviews/2026-08-16-melbourne-analysis-stability-${window}.json`,
      ), 'utf8'));
      expect(evidence).toMatchObject({
        schemaVersion: 'city-analysis-stability-evidence-v1',
        packageId: 'melbourne-flinders-federation-v1',
        manifestSha256: MELBOURNE_ANALYSIS_EVIDENCE_MANIFEST_SHA256,
        result: {
          status: 'pass',
          visitedViews: 18,
          allSamplesWithinVisibleBudget: true,
          allSamplesWithinResidentBudget: true,
          allSamplesWithoutLifecycleFallback: true,
        },
      });
      expect(evidence.result.heap.medianGrowthBytes).toBeLessThanOrEqual(
        evidence.limits.maximumHeapMedianGrowthBytes,
      );
      expect(evidence.result.warmP95Ms).toBeLessThanOrEqual(evidence.limits.warmP95Ms);
      if (window === '30m') {
        expect(evidence.method.requestedDurationMs).toBe(1_800_000);
        expect(evidence.method.measuredDurationMs).toBeGreaterThanOrEqual(1_800_000);
        expect(evidence.result.heap.slopeBytesPerMinute).toBeLessThanOrEqual(
          evidence.limits.maximumHeapSlopeBytesPerMinute,
        );
      }
      for (const baseline of evidence.visualBaselines) {
        const bytes = readFileSync(resolve(ROOT, baseline.path));
        expect(bytes.byteLength).toBe(baseline.byteLength);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(baseline.sha256);
      }
    }
  });

  it('pins the four current environment views plus the refreshed fallback poster', () => {
    const evidence = JSON.parse(readFileSync(resolve(
      ROOT,
      'data/city/reviews/2026-08-17-melbourne-environment-engineering.json',
    ), 'utf8'));
    expect(evidence).toMatchObject({
      schemaVersion: 'city-environment-engineering-evidence-v1',
      packageId: 'melbourne-flinders-federation-v1',
      manifestSha256: MELBOURNE_ANALYSIS_EVIDENCE_MANIFEST_SHA256,
      productionReleaseGranted: false,
      invariants: {
        sameGeometry: true,
        sameCamera: true,
        sameLod: true,
        materialIdentityPreserved: true,
        invalidOrInjectedEnvironmentFallsBackToAnalysis: true,
        pickedEntitySurvivesEnvironmentChange: true,
        pickedEntityAttributionHasIndependentBilingualDom: true,
      },
      browserVerification: {
        consoleErrors: 0,
        uncaughtPageErrors: 0,
        stabilitySoakRerun: true,
        multiEnvironmentStabilityEvidence:
          'data/city/reviews/2026-08-17-melbourne-multi-environment-stability-30m.json',
      },
    });
    expect(evidence.visualBaselines.map(({ environment }) => environment)).toEqual([
      'analysis',
      'day',
      'sunset',
      'night',
      'analysis-fallback-poster',
    ]);
    for (const baseline of evidence.visualBaselines) {
      const bytes = readFileSync(resolve(ROOT, baseline.path));
      expect(bytes.byteLength).toBe(baseline.byteLength);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(baseline.sha256);
    }
  });

  it('records the short four-environment soak-driver smoke without promoting it', () => {
    const evidence = JSON.parse(readFileSync(resolve(
      ROOT,
      'data/city/reviews/2026-08-17-melbourne-multi-environment-smoke.json',
    ), 'utf8'));
    expect(evidence).toMatchObject({
      schemaVersion: 'city-multi-environment-smoke-evidence-v1',
      packageId: 'melbourne-flinders-federation-v1',
      manifestSha256: MELBOURNE_ANALYSIS_EVIDENCE_MANIFEST_SHA256,
      formalReleaseEvidence: false,
      followUpEvidence:
        'data/city/reviews/2026-08-17-melbourne-multi-environment-stability-30m.json',
      method: {
        requestedDurationMs: 15_000,
        expectedDistinctViews: 18,
        environments: ['analysis', 'day', 'sunset', 'night'],
      },
      result: {
        status: 'pass',
        visitedViews: 18,
        visitedEnvironments: ['analysis', 'day', 'night', 'sunset'],
        allSamplesWithinVisibleBudget: true,
        allSamplesWithinResidentBudget: true,
        allSamplesWithoutLifecycleFallback: true,
        heap: { slopeAcceptedAsLongTermEvidence: false },
      },
    });
    expect(evidence.method.measuredDurationMs).toBeGreaterThanOrEqual(15_000);
    expect(evidence.result.cache.residentBytes).toBeLessThanOrEqual(evidence.limits.residentBytes);
    expect(evidence.result.cache.residentAssets).toBeLessThanOrEqual(evidence.limits.residentAssets);
    expect(evidence.result.warmP95Ms).toBeLessThanOrEqual(evidence.limits.warmP95Ms);
  });

  it('pins the formal four-environment 30-minute stability gate without granting release', () => {
    const evidence = JSON.parse(readFileSync(resolve(
      ROOT,
      'data/city/reviews/2026-08-17-melbourne-multi-environment-stability-30m.json',
    ), 'utf8'));
    expect(evidence).toMatchObject({
      schemaVersion: 'city-multi-environment-stability-evidence-v1',
      packageId: 'melbourne-flinders-federation-v1',
      manifestSha256: MELBOURNE_ANALYSIS_EVIDENCE_MANIFEST_SHA256,
      formalEngineeringGate: true,
      productionReleaseGranted: false,
      harness: {
        developmentTransformRequired: true,
        hmrEnabled: false,
        longRunTraceMode: 'off',
      },
      method: {
        requestedDurationMs: 1_800_000,
        expectedDistinctViews: 18,
        environments: ['analysis', 'day', 'sunset', 'night'],
      },
      result: {
        status: 'pass',
        visitedViews: 18,
        visitedEnvironments: ['analysis', 'day', 'night', 'sunset'],
        allSamplesWithinVisibleBudget: true,
        allSamplesWithinResidentBudget: true,
        allSamplesRendererWebgl: true,
        allSamplesWithinEnvironmentContract: true,
        allSamplesWithoutLifecycleFallback: true,
        allSamplesWithoutHorizontalOverflow: true,
        pageLifecycleContinuous: true,
        consoleErrors: 0,
        uncaughtPageErrors: 0,
      },
    });
    expect(evidence.method.measuredDurationMs).toBeGreaterThanOrEqual(1_800_000);
    expect(evidence.result.environmentSwitchCount).toBeGreaterThanOrEqual(
      evidence.result.iterations,
    );
    expect(evidence.result.heap.samples).toBeGreaterThanOrEqual(evidence.limits.minimumHeapSamples);
    expect(evidence.result.heap.distinctValues).toBe(evidence.result.heap.samples);
    expect(evidence.result.heap.medianGrowthBytes).toBeLessThanOrEqual(
      evidence.limits.maximumHeapMedianGrowthBytes,
    );
    expect(evidence.result.heap.slopeBytesPerMinute).toBeLessThanOrEqual(
      evidence.limits.maximumHeapSlopeBytesPerMinute,
    );
    expect(evidence.result.finalCache.residentBytes).toBeLessThanOrEqual(
      evidence.limits.maximumResidentBytes,
    );
    expect(evidence.result.finalCache.residentAssets).toBeLessThanOrEqual(
      evidence.limits.maximumResidentAssets,
    );
    expect(evidence.result.warmP95Ms).toBeLessThanOrEqual(evidence.limits.warmP95Ms);
    expect(evidence.result.maximumSteadyP95Ms).toBeLessThanOrEqual(
      evidence.limits.maximumSteadyP95Ms,
    );
  });
});
