import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';

const missionHeaderSource = readFileSync('src/mission/MissionHeader.jsx', 'utf8');
const sceneSource = readFileSync('src/showcase/experience/SignatureScene.jsx', 'utf8');
const contentCss = readFileSync('src/content/content.css', 'utf8');

describe('M17 release candidate contracts', () => {
  it('keeps every active route in the release audit set', () => {
    const active = SITE_MANIFEST.filter(({ status }) => status === 'active');
    expect(active).toHaveLength(18);
    expect(active.every(({ build }) => build)).toBe(true);
  });

  it('renders React-owned navigation before paint without a dynamic-import waterfall', () => {
    expect(missionHeaderSource).toContain("import { enhanceNavigation } from '../lib/nav.js'");
    expect(missionHeaderSource).toContain('useLayoutEffect');
    expect(missionHeaderSource).not.toContain("import('../lib/nav.js')");
  });

  it('does not force unnecessary three-line desktop index titles', () => {
    expect(contentCss).toMatch(/\.content-hero\s*\{\s*max-width:\s*1040px/);
    expect(contentCss).toMatch(/\.content-hero h1\s*\{[\s\S]*?max-width:\s*1040px/);
  });

  it('has no deprecated renderer switch and includes the release documentation set', () => {
    expect(sceneSource).not.toContain('useLegacyLights');
    for (const path of [
      'README.md',
      'docs/refactor/architecture.md',
      'docs/refactor/content-map.md',
      'docs/refactor/motion-policy.md',
      'docs/refactor/m16-cross-device-accessibility.md',
      'docs/refactor/m17-release-candidate.md',
    ]) expect(existsSync(path), path).toBe(true);
  });
});
