import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { SITE_MANIFEST, SITE_LOCALES } from '../src/config/siteManifest.js';
import {
  buildRouteStructuredData,
  loadRouteSeoFacts,
  transformRouteSeoSource,
  validateRouteStructuredData,
} from '../scripts/route-seo.mjs';

const activeRoutes = SITE_MANIFEST.filter((route) => route.status === 'active');
const facts = await loadRouteSeoFacts(process.cwd(), activeRoutes);

const graphTypes = (graph) =>
  new Set(
    graph['@graph'].flatMap((node) =>
      Array.isArray(node['@type']) ? node['@type'] : [node['@type']],
    ),
  );

describe('route SEO architecture', () => {
  it('builds valid adaptive and fixed-locale graphs for every active route', () => {
    for (const route of activeRoutes) {
      for (const locale of ['adaptive', ...SITE_LOCALES]) {
        const graph = buildRouteStructuredData(route, {
          locale,
          facts: facts[route.id],
        });
        expect(
          validateRouteStructuredData(route, graph),
          `${route.id}/${locale}`,
        ).toEqual([]);
        const serialized = JSON.stringify(graph);
        expect(serialized).toContain('https://schema.org');
        if (locale !== 'adaptive') {
          expect(serialized).toContain(`https://feida.au/${locale}`);
          expect(serialized).toContain(route.seo.social.images[locale]);
        }
      }
    }
  });

  it('only claims datasets and editorial types where the public artifacts support them', () => {
    const sectors = buildRouteStructuredData(
      activeRoutes.find((route) => route.id === 'sectors'),
      { facts: facts.sectors },
    );
    const signal = buildRouteStructuredData(
      activeRoutes.find((route) => route.id === 'signal'),
      { facts: facts.signal },
    );
    const arena = buildRouteStructuredData(
      activeRoutes.find((route) => route.id === 'arena'),
      { facts: facts.arena },
    );
    const stats = buildRouteStructuredData(
      activeRoutes.find((route) => route.id === 'stats'),
      { facts: facts.stats },
    );

    expect(graphTypes(sectors).has('Dataset')).toBe(false);
    expect(graphTypes(signal).has('NewsArticle')).toBe(false);
    expect(graphTypes(arena)).toContain('Dataset');
    expect(graphTypes(stats)).toContain('DataCatalog');
    expect(graphTypes(stats)).toContain('Dataset');
  });

  it('derives trustworthy route dates from declared public provenance', () => {
    for (const route of activeRoutes) {
      const declaredDates = facts[route.id].provenance
        .map((entry) => entry.date)
        .filter(Boolean)
        .sort((left, right) => Date.parse(right) - Date.parse(left));
      expect(facts[route.id].dateModified, route.id).toBe(declaredDates[0] || null);
      for (const date of declaredDates) expect(Number.isFinite(Date.parse(date)), `${route.id}: ${date}`).toBe(true);
    }
  });

  it('keeps source SEO synchronization idempotent', async () => {
    for (const route of activeRoutes) {
      const source = await readFile(route.file, 'utf8');
      const once = transformRouteSeoSource(source, route, {
        facts: facts[route.id],
      });
      const twice = transformRouteSeoSource(once, route, {
        facts: facts[route.id],
      });
      expect(twice, route.file).toBe(once);
      expect(once.match(/afflatus:route-seo:start/g)).toHaveLength(1);
      expect(once.match(/data-afflatus-route-schema=/g)).toHaveLength(1);
      expect(once).toContain('<meta property="og:image:type" content="image/jpeg">');
      expect(once).toContain(route.metadata.ogImage);
    }
  });

  it('uses the plural reader route family in serial structured data', () => {
    const serial = activeRoutes.find((route) => route.id === 'serial');
    for (const locale of ['adaptive', ...SITE_LOCALES]) {
      const graph = buildRouteStructuredData(serial, {
        locale,
        facts: facts.serial,
      });
      const serialized = JSON.stringify(graph);
      expect(serialized).toContain('/novels/yuxi-gongci/');
      expect(serialized).not.toContain('/novel/');
    }
  });
});
