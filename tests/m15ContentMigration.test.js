import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_CASES,
  CONTENT_COLLECTIONS,
  CONTENT_MIGRATION,
  CONTENT_TEMPLATES,
} from '../src/config/contentMigration.js';
import { LEGACY_ROUTE_COMPATIBILITY, PRIMARY_NAVIGATION } from '../src/config/primaryNavigation.js';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';

const ROOT = resolve(import.meta.dirname, '..');
const migratedRouteIds = ['capital', 'capital-record', 'intelligence', 'solar-atlas', 'field-notes', 'experiments'];

describe('M15 content migration', () => {
  it('keeps all templates free of continuous 3D presentation', () => {
    expect(Object.values(CONTENT_TEMPLATES).every((template) => template.continuousThree === false)).toBe(true);
  });

  it('maps published subjects to dedicated homes without changing their retained sources', () => {
    expect(CONTENT_MIGRATION.map(({ id, destination, source }) => ({ id, destination, source }))).toEqual(expect.arrayContaining([
      { id: 'fy25-26-field-record', destination: '/capital/fy25-26/', source: '/portfolio.html#fy2026Performance' },
      { id: 'fed-long-end', destination: '/signal.html', source: '/signal.html' },
      { id: 'solar-atlas', destination: '/intelligence/solar-atlas/', source: '/portfolio.html#solarAtlas' },
      { id: 'qf-01', destination: '/arena.html', source: '/arena.html' },
      { id: 'course', destination: '/course.html', source: '/course.html' },
      { id: 'novels', destination: '/serial.html', source: '/serial.html' },
    ]));
  });

  it('publishes quiet index and case-study routes with stable SEO contracts', () => {
    const routes = SITE_MANIFEST.filter(({ id }) => migratedRouteIds.includes(id));
    expect(routes).toHaveLength(migratedRouteIds.length);
    expect(routes.every((route) => route.status === 'active' && route.build && route.sitemap)).toBe(true);
    expect(routes.filter((route) => route.schema.includes('Article')).map(({ id }) => id)).toEqual(['capital-record', 'solar-atlas']);
    expect(routes.every((route) => !route.capabilities.includes('canvas'))).toBe(true);
  });

  it('uses the Feature + Complete Index and wide/narrow case-study surfaces', () => {
    expect(Object.keys(CONTENT_COLLECTIONS)).toEqual(['capital', 'intelligence', 'field-notes', 'experiments']);
    expect(Object.keys(CONTENT_CASES)).toEqual(['capital-record', 'solar-atlas']);
    const source = readFileSync(resolve(ROOT, 'src/content/ContentApp.jsx'), 'utf8');
    expect(source).toContain('content-feature-panel');
    expect(source).toContain('content-complete-index');
    expect(source).toContain('content-case-prose');
    expect(source).toContain('content-breakout');
  });

  it('moves the primary concepts while retaining Markets, Lab and Writing aliases', () => {
    expect(PRIMARY_NAVIGATION.map(({ path }) => path)).toEqual([
      '/capital/', '/intelligence/', '/field-notes/', '/experiments/', '/#about',
    ]);
    const aliases = LEGACY_ROUTE_COMPATIBILITY.filter(({ type }) => type === 'redirect');
    expect(aliases).toEqual(expect.arrayContaining([
      { source: '/markets', type: 'redirect', target: '/intelligence/' },
      { source: '/lab', type: 'redirect', target: '/experiments/' },
      { source: '/writing', type: 'redirect', target: '/field-notes/' },
    ]));
  });
});
