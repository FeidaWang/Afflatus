import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('home flagship progressive GPU renderer', () => {
  it('loads the authored Venator once and makes device loss terminal for the micro-narrative', () => {
    const source = readFileSync('src/scene/homeFlagshipWebGPU.js', 'utf8');
    expect(source).toContain('createProgressiveRenderer');
    expect(source).toContain('createAfflatusVanguard');
    expect(source).toContain('loadCombatAsset');
    expect(source).toContain('CAPITAL_ASSET_PROFILE');
    expect(source).toContain("modelStatus = 'venator-ready'");
    expect(source).toContain('dataset.model = modelStatus');
    expect(source).toContain("fallbackShip.name = 'HomeFlagshipProceduralFallback'");
    expect(source).toContain("authoredAsset.root.name = 'HomeVenatorClassStarDestroyerCCBY'");
    expect(source).toContain("modelStatus = 'device-lost-poster'");
    expect(source).toContain("onUnavailable?.('webgpu-device-lost')");
    expect(source).not.toContain("modelStatus = 'reloading-webgl2'");
    expect(source).not.toContain('loadAuthoredFlagship(state.renderer)');
    expect(source).toContain('const authoredReady = loadAuthoredFlagship(renderer).then(Boolean)');
    expect(source).toContain('ready: authoredReady');
    expect(source).toContain('previousAsset?.dispose()');
    expect(source).toContain('releaseAuthoredFlagship()');
    expect(source).toContain("backendController?.backend === 'poster'");
    expect(source).toContain('targetRenderer !== backendController?.renderer');
    expect(source.match(/loadGeneration \+= 1/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("return modelStatus === 'venator-ready'");
    expect(source).toContain('onModelStatus?.(modelStatus)');
    expect(source).toContain("backendController.fallback('render-failed')");
    expect(source).toContain('shieldGridTexture');
    expect(source).toContain('shipRig.add(plume)');
    expect(source).toContain('shipRig.add(shield)');
  });
});
