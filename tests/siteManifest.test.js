import { describe, expect, it } from 'vitest';
import {
  BUILD_ROUTES,
  NAV_ROUTES,
  RELEASE_CANDIDATE_ROUTES,
  SITE_LOCALES,
  SITE_MANIFEST,
  SOCIAL_CARD,
  SITEMAP_ROUTES,
  findRouteByPath,
  localizedRoutePath,
  localizedRouteUrl,
  normalizeRoutePath,
} from '../src/config/siteManifest.js';

describe('siteManifest', () => {
  it('has unique route ids, files and paths', () => {
    for (const key of ['id', 'file', 'path']) {
      const values = SITE_MANIFEST.map((route) => route[key]);
      expect(new Set(values).size, `duplicate ${key}`).toBe(values.length);
    }
  });

  it('keeps build routes explicit and backed by an HTML file', () => {
    expect(BUILD_ROUTES.length).toBeGreaterThan(0);
    for (const route of BUILD_ROUTES) {
      expect(route.build).toBe(true);
      expect(route.file.endsWith('.html')).toBe(true);
      expect(route.file.startsWith('public/')).toBe(false);
    }
  });

  it('derives navigation only from ordered active routes', () => {
    expect(NAV_ROUTES.map((route) => route.path)).toEqual([
      '/',
      '/portfolio.html',
      '/arena.html',
      '/sectors.html',
      '/signal.html',
      '/horoscope.html',
      '/serial.html',
      '/course.html',
    ]);
    for (const route of NAV_ROUTES) {
      expect(route.en).toBeTruthy();
      expect(route.zh).toBeTruthy();
      expect(findRouteByPath(route.path)?.status).toBe('active');
    }
  });

  it('includes only active, explicitly discoverable routes in the sitemap', () => {
    expect(SITEMAP_ROUTES.length).toBe(NAV_ROUTES.length);
    for (const route of SITEMAP_ROUTES) {
      expect(route.status).toBe('active');
      expect(route.sitemap).toBe(true);
      expect(route.metadata.canonical).toMatch(/^https:\/\/feida\.au\//);
    }
  });

  it('has complete EN/ZH locale metadata for every route', () => {
    for (const route of SITE_MANIFEST) {
      expect(['en', 'zh']).toContain(route.defaultLocale);
      expect(route.publishedLocales || SITE_LOCALES).toContain(route.defaultLocale);
      for (const locale of ['en', 'zh']) {
        expect(route.locales[locale].title).toBeTruthy();
        expect(route.locales[locale].description).toBeTruthy();
      }
    }
  });

  it('derives stable self-canonical locale paths for every discoverable route', () => {
    expect(SITE_LOCALES).toEqual(['en', 'zh']);
    for (const route of SITEMAP_ROUTES) {
      expect(localizedRoutePath(route, 'en')).toBe(
        route.id === 'serial'
          ? '/zh/serial.html'
          : (route.path === '/' ? '/en/' : `/en${route.path}`),
      );
      expect(localizedRouteUrl(route, 'zh')).toBe(
        route.path === '/' ? 'https://feida.au/zh/' : `https://feida.au/zh${route.path}`,
      );
    }
    expect(localizedRoutePath('/serial.html', 'en')).toBe('/zh/serial.html');
  });

  it('requires active routes to carry the metadata audited in source HTML', () => {
    const socialImages = new Set();
    for (const route of SITE_MANIFEST.filter((item) => item.status === 'active')) {
      expect(route.metadata.title).toBeTruthy();
      expect(route.metadata.description).toBeTruthy();
      expect(route.metadata.canonical).toBe(`https://feida.au${route.path}`);
      expect(route.metadata.ogTitle).toBeTruthy();
      expect(route.metadata.ogDescription).toBeTruthy();
      expect(route.metadata.ogImage).toMatch(/^https:\/\/feida\.au\//);
      expect(route.seo.structuredData.kind).toBeTruthy();
      for (const locale of SITE_LOCALES) {
        const image = route.seo.social.images[locale];
        expect(image).toBe(
          `https://feida.au/assets/og/${route.id}-${locale}.${SOCIAL_CARD.extension}`,
        );
        expect(socialImages.has(image)).toBe(false);
        socialImages.add(image);
        expect(route.seo.social.alt[locale]).toBeTruthy();
        expect(route.seo.social.title[locale]).toBeTruthy();
      }
      expect(route.themeColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(socialImages.size).toBe(
      SITE_MANIFEST.filter((item) => item.status === 'active').length
        * SITE_LOCALES.length,
    );
  });

  it('keeps redirects pointed at active routes and prototypes out of discovery', () => {
    for (const route of SITE_MANIFEST.filter((item) => item.status === 'redirect')) {
      expect(findRouteByPath(route.redirectTo)?.status).toBe('active');
      expect(route.build).toBe(false);
      expect(route.sitemap).toBe(false);
      expect(route.nav).toBeNull();
    }
    for (const route of SITE_MANIFEST.filter((item) => ['prototype', 'system'].includes(item.status))) {
      expect(route.sitemap).toBe(false);
      expect(route.nav).toBeNull();
      expect(route.capabilities).toContain('noindex');
    }
  });

  it('keeps release candidates explicit, built and undiscoverable', () => {
    expect(RELEASE_CANDIDATE_ROUTES.map((route) => route.id)).toEqual([]);
    for (const route of RELEASE_CANDIDATE_ROUTES) {
      expect(route.status).toBe('prototype');
      expect(route.build).toBe(true);
      expect(route.sitemap).toBe(false);
      expect(route.nav).toBeNull();
      expect(route.capabilities).toContain('noindex');
    }
  });

  it('normalizes root and index paths consistently', () => {
    expect(normalizeRoutePath('/index.html')).toBe('/');
    expect(normalizeRoutePath('/en/index.html')).toBe('/');
    expect(normalizeRoutePath('/zh/arena.html')).toBe('/arena.html');
    expect(normalizeRoutePath('')).toBe('/');
    expect(findRouteByPath('/index.html')?.id).toBe('main');
    expect(findRouteByPath('/zh/arena.html')?.id).toBe('arena');
    expect(findRouteByPath('/missing.html')).toBeNull();
  });
});
