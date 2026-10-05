import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseFragment } from 'parse5';
import { describe, expect, it } from 'vitest';
import { PremiereFooter } from '../src/showcase/PremiereFooter.jsx';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';
import { transformLocalizedDocument } from '../scripts/localize-site.mjs';

const home = readFileSync('index.html', 'utf8'), course = readFileSync('course.html', 'utf8');
const footer = html => html.match(/<footer\b[\s\S]*?<\/footer>/)[0];
const links = html => {
  const result = [];
  const visit = node => {
    if (node.tagName === 'a') {
      const attrs = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
      result.push({ href: attrs.href, target: attrs.target, rel: attrs.rel, aria: attrs['aria-label'] });
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
});
