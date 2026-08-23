import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  flightPathNodesForProfile,
  MOBILE_FLIGHT_PATH_NODES,
} from '../src/showcase/experience/FlightDirector.js';
import { RENDER_BUDGETS, resolveQualityProfile } from '../src/showcase/experience/qualityProfile.js';
import { SPACE_LAYER_PROFILE_MATRIX } from '../src/showcase/experience/spaceLayers.js';

const experienceSource = readFileSync('src/showcase/experience/ExperienceRoot.jsx', 'utf8');
const appSource = readFileSync('src/showcase/App.jsx', 'utf8');
const showcaseCss = readFileSync('src/showcase/showcase.css', 'utf8');
const framePaths = [
  'public/assets/showcase/static-journey/bow-approach.avif',
  'public/assets/showcase/static-journey/parallel-drift.avif',
  'public/assets/showcase/static-journey/engine-departure.avif',
];

describe('M16 cross-device performance and static journey', () => {
  it('uses exactly three mobile camera beats and the documented mobile budget', () => {
    expect(MOBILE_FLIGHT_PATH_NODES.map(({ id }) => id)).toEqual([
      'bow-approach',
      'port-side-parallel-drift',
      'engine-pass',
    ]);
    expect(flightPathNodesForProfile('mobile')).toBe(MOBILE_FLIGHT_PATH_NODES);
    expect(RENDER_BUDGETS.mobile).toMatchObject({ dpr: 1.2, degradedDpr: 0.9, fps: 30 });
    expect(SPACE_LAYER_PROFILE_MATRIX.mobile.dust / SPACE_LAYER_PROFILE_MATRIX.high.dust)
      .toBeCloseTo(1 / 3, 2);
  });

  it('selects poster-first profiles before WebGL initialization', () => {
    const capable = {
      deviceMemory: 8,
      experienceMode: 'cinematic',
      hardwareConcurrency: 8,
      motionEnabled: true,
      viewportHeight: 844,
      viewportWidth: 390,
      webglAvailable: true,
    };
    expect(resolveQualityProfile({ ...capable, reducedMotion: true })).toBe('reduced');
    expect(resolveQualityProfile({ ...capable, saveData: true })).toBe('reduced');
    expect(resolveQualityProfile({ ...capable, experienceMode: 'static' })).toBe('static');
    expect(experienceSource.indexOf('profileSupportsWebGL(preliminary)'))
      .toBeLessThan(experienceSource.indexOf("import('./SignatureScene.jsx')"));
  });

  it('ships three compact, art-directed AVIF frames with bow-first priority', () => {
    for (const path of framePaths) {
      const bytes = readFileSync(path);
      expect(bytes.subarray(4, 12).toString('ascii')).toContain('ftypavi');
      expect(statSync(path).size).toBeLessThan(100_000);
    }
    expect(experienceSource).toContain("fetchPriority={index === 0 ? 'high' : 'low'}");
    expect(experienceSource.match(/static-journey\/[a-z-]+\.avif/g)).toHaveLength(3);
  });
});

describe('M16 accessibility contract', () => {
  it('keeps the visual scene decorative and exposes a persistent skip target', () => {
    expect(experienceSource).toContain('aria-hidden="true"');
    expect(appSource).toContain('href="#main-content"');
    expect(appSource).toContain('id="main-content"');
    expect(appSource).toContain('tabIndex="-1"');
  });

  it('keeps touch controls and static states free of hidden motion', () => {
    expect(showcaseCss).toMatch(/\.brand\s*\{[\s\S]*?min-height:\s*44px/);
    expect(showcaseCss).toMatch(/\.motion-toggle\s*\{[\s\S]*?min-height:\s*44px/);
    expect(showcaseCss).toContain('.static-journey__frame { transition: none; }');
    expect(showcaseCss).toContain('html[data-motion="off"]');
  });
});
