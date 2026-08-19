import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RELEASE_CANDIDATE_ROUTES,
  SITE_MANIFEST,
} from '../src/config/siteManifest.js';

const require = createRequire(import.meta.url);
const baseline = require('../lighthouse-baseline.json');
const generated = require('../src/config/lighthouseRoutes.generated.json');
const lighthouse = require('../lighthouserc.cjs');
const lighthouseSource = readFileSync(new URL('../lighthouserc.cjs', import.meta.url), 'utf8');

describe('Lighthouse regression contract', () => {
  const active = SITE_MANIFEST.filter((route) => route.status === 'active');
  const gated = [...active, ...RELEASE_CANDIDATE_ROUTES];

  it('covers every active and release-candidate route from the manifest exactly once', () => {
    expect(generated.routes).toEqual(gated.map(({ id, path }) => ({ id, path })));
    expect(baseline.routes.map(({ id, path }) => ({ id, path }))).toEqual(generated.routes);
    expect(lighthouse.ci.collect.url).toHaveLength(gated.length);
    expect(lighthouse.ci.assert.assertMatrix).toHaveLength(gated.length);
  });

  it('stores the field p75 targets and privacy dimensions explicitly', () => {
    expect(baseline.fieldBudgets).toEqual({
      LCP: 2500,
      INP: 200,
      CLS: 0.1,
      percentile: 75,
    });
    expect(baseline.dimensions).toEqual(['route', 'locale', 'device_tier']);
    expect(baseline.regressionAllowance).toBe(0.05);
    expect(baseline.tbtNoiseAllowanceMs).toBe(100);
    expect(baseline.tbtRegressionAllowance).toBe(0.25);
  });

  it('has finite route-level lab budgets and a documented Sectors exception', () => {
    for (const route of baseline.routes) {
      expect(route.speedIndexMs).toBeGreaterThan(0);
      expect(route.cls).toBeGreaterThanOrEqual(0);
      expect(route.clsBudgetBase).toBeGreaterThanOrEqual(route.cls);
      expect(route.scriptBytes).toBeGreaterThan(0);
      expect(route.totalBytes).toBeGreaterThan(route.scriptBytes);
      if (route.id === 'sectors') {
        expect(route.lcpMs).toBeNull();
        expect(route.fcpMs).toBeGreaterThan(0);
        expect(route.lcpAudit).toContain('production field p75');
      } else {
        expect(route.lcpMs).toBeGreaterThan(0);
        expect(route.tbtMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('uses hard per-route metric/script gates and warning-only aggregate scores', () => {
    for (const [index, row] of lighthouse.ci.assert.assertMatrix.entries()) {
      const route = baseline.routes[index];
      expect(row.matchingUrlPattern).toMatch(/^\^https/);
      expect(row.assertions['cumulative-layout-shift'][0]).toBe('error');
      expect(row.assertions['cumulative-layout-shift'][1].maxNumericValue)
        .toBeLessThanOrEqual(Math.max(0.01, route.clsBudgetBase * 1.05 + 0.001));
      expect(row.assertions['speed-index'][0]).toBe('error');
      expect(row.assertions['resource-summary:script:size'][0]).toBe('error');
      expect(row.assertions['resource-summary:total:size'][0]).toBe('warn');
      if (route.tbtMs != null) {
        const tbtAssertion = row.assertions['total-blocking-time'];
        expect(tbtAssertion[0]).toBe('error');
        expect(tbtAssertion[1].aggregationMethod).toBe('median');
        expect(tbtAssertion[1].maxNumericValue).toBe(Math.max(
          baseline.tbtNoiseAllowanceMs,
          Math.ceil(route.tbtMs + baseline.tbtNoiseAllowanceMs),
          Math.ceil(route.tbtMs * (1 + baseline.tbtRegressionAllowance)),
        ));
      }
    }
  });

  it('supports an explicit route-id filter for focused candidate baselines', () => {
    expect(lighthouseSource).toContain('process.env.LIGHTHOUSE_ROUTE_IDS');
    expect(lighthouseSource).toContain('Unknown Lighthouse route id(s)');
  });
});
