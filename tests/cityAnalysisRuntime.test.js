import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MelbourneAnalysisRuntimeError,
  normalizeMelbourneAnalysisFailureMode,
  prepareMelbourneAnalysisRuntime,
} from '../src/city/analysisRuntime.ts';

const PACKAGE_DIR = resolve(
  import.meta.dirname,
  '../data/city/candidates/melbourne-flinders-federation-v1',
);

function localReader(calls = []) {
  return async (url) => {
    calls.push(url);
    return readFile(resolve(PACKAGE_DIR, url.split('/').at(-1)));
  };
}

describe('shared Melbourne Analysis runtime', () => {
  it('opens one verified session and preserves the frozen first-frame baseline', async () => {
    const calls = [];
    const runtime = await prepareMelbourneAnalysisRuntime({ readBytes: localReader(calls) });
    expect(runtime.manifest.packageId).toBe('melbourne-flinders-federation-v1');
    expect(runtime.baseline).toMatchObject({
      tileCount: 4,
      bytes: 428448,
      drawCalls: 22,
      triangles: 6640,
      matchesFrozenBaseline: true,
    });
    expect(calls.filter((url) => url.endsWith('entities-index.json'))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith('.glb'))).toHaveLength(4);
  });

  it.each([
    ['404', 'injected-404'],
    ['checksum', 'injected-checksum'],
    ['offline', 'injected-offline'],
  ])('fails closed for the %s regression path', async (failureMode, code) => {
    await expect(prepareMelbourneAnalysisRuntime({
      readBytes: localReader(),
      failureMode,
    })).rejects.toMatchObject({
      name: MelbourneAnalysisRuntimeError.name,
      code,
      failureMode,
    });
  });

  it('normalizes unsupported failure query values to the safe success path', () => {
    expect(normalizeMelbourneAnalysisFailureMode('404')).toBe('404');
    expect(normalizeMelbourneAnalysisFailureMode('network-chaos')).toBe('none');
    expect(normalizeMelbourneAnalysisFailureMode(null)).toBe('none');
  });
});
