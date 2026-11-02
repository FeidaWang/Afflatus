import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseFragment } from 'parse5';
import { describe, expect, it } from 'vitest';
import { PremiereFooter } from '../src/showcase/PremiereFooter.jsx';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';
import { transformLocalizedDocument } from '../scripts/localize-site.mjs';
import { footerRoutes } from '../scripts/shared-header.mjs';
import { HOME_LATEST } from '../src/config/homeLatest.generated.js';
import { NAV_ROUTES, normalizeRoutePath } from '../src/config/navRoutes.generated.js';
import { navigationHref } from '../src/lib/siteNavigation.js';
import { renderHomeCards } from '../src/showcase/homeCards.js';

const home = readFileSync('index.html', 'utf8'), course = readFileSync('course.html', 'utf8');
const footer = html => html.match(/<footer\b[\s\S]*?<\/footer>/)[0];
const links = html => {
  const result = [];
  const visit = node => {
    if (node.tagName === 'a') {
      const attrs = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
      // Language links point at each page's own translation, so they are checked separately.
      if (attrs['data-footer-language'] === undefined) result.push({ href: attrs.href, target: attrs.target, rel: attrs.rel, aria: attrs['aria-label'] });
    }
    node.childNodes?.forEach(visit);
  };
  visit(parseFragment(html)); return result;
};
describe('homepage matches the course footer', () => {
  for (const locale of ['en', 'zh']) it(`keeps all ${locale} navigation and social destinations in sync before and after rendering`, () => {
    const reference = footer(transformLocalizedDocument(course, SITE_MANIFEST.find(route => route.id === 'course'), locale));
    const fallback = footer(transformLocalizedDocument(home, SITE_MANIFEST.find(route => route.id === 'main'), locale));
    const rendered = renderToStaticMarkup(createElement(PremiereFooter, { language: locale }));
    expect(links(fallback)).toEqual(links(reference));
    expect(links(rendered)).toEqual(links(reference));
    expect(rendered).toContain('class="pa-footer-inner"');
    expect(rendered).toContain(locale === 'zh' ? '探索站点' : 'Explore the site');
    expect(home).toContain('href="/styles/course-chrome.css"');
  });

  it('lists every navigation route inside five accordion sections', () => {
    const rendered = renderToStaticMarkup(createElement(PremiereFooter, { language: 'en' }));
    expect(rendered.match(/<details\b/g)).toHaveLength(5);
    const pages = links(rendered.slice(rendered.indexOf('pa-footer-pages'), rendered.indexOf('pa-footer-personal'))).map(link => link.href);
    expect(pages).toEqual(NAV_ROUTES.filter(route => route.path !== '/').map(route => navigationHref(route.path, 'en')));
  });

  for (const route of footerRoutes) it(`${route.file} switches language to its own translation`, () => {
    const translated = locale => footer(transformLocalizedDocument(readFileSync(route.file, 'utf8'), route, locale));
    const languageLinks = html => [...html.matchAll(/href="([^"]+)"[^>]*data-footer-language="(en|zh)"/g)].map(match => [match[2], match[1]]);
    for (const locale of ['en', 'zh']) expect(languageLinks(translated(locale))).toEqual([['en', navigationHref(route.path, 'en')], ['zh', navigationHref(route.path, 'zh')]]);
  });
});

describe('homepage cards', () => {
  const app = source => [...source.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1]);
  const body = home.slice(home.indexOf('<main'), home.indexOf('</main>'));
  const header = home.slice(home.indexOf('id="af-primary-nav"'), home.indexOf('data-header-language'));

  it('stays within the 18-link budget for navigation and page body', () => {
    expect(app(header)).toHaveLength(10);
    expect(app(body)).toHaveLength(8);
    expect(app(header).length + app(body).length).toBeLessThanOrEqual(18);
  });

  it('keeps all nine destinations reachable', () => {
    const reachable = new Set([...app(header), ...app(body)].map(href => normalizeRoutePath(href)));
    for (const route of NAV_ROUTES.filter(route => route.path !== '/')) expect(reachable).toContain(route.path);
  });

  it('writes the generated latest cards into the static fallback', () => {
    expect(body).toContain(renderHomeCards(HOME_LATEST));
    for (const { date } of HOME_LATEST) expect(date.iso).toMatch(/^\d{4}-\d{2}(-\d{2})?$/);
  });

  it('shows no retired section', () => {
    for (const id of ['key-articles', 'about-me', 'destinations']) expect(home).not.toContain(`id="${id}"`);
  });
});
