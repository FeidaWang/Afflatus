import { readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import { headerBlockFor, headerFiles } from '../scripts/shared-header.mjs';
import { NAV_ROUTES } from '../src/config/navRoutes.generated.js';

const attr = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value ?? null;
const classesOf = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);
function* walk(node) {
  yield node;
  for (const child of node.childNodes || []) yield* walk(child);
}
const elements = (root) => [...walk(root)].filter((node) => node.tagName);
const byClass = (root, name) => elements(root).find((node) => classesOf(node).includes(name));

// Every built page (and the 404 page) carries the one generated header; the
// per-page "persona" wordmarks were retired on 2026-09-27.
describe.each(headerFiles)('%s shared header', (file) => {
  const source = readFileSync(file, 'utf8');
  const nodes = elements(parse(source));
  const headers = nodes.filter((node) => attr(node, 'data-afflatus-header') !== null);
  const header = headers[0];

  it('contains exactly one generated header and its stylesheet', () => {
    expect(headers).toHaveLength(1);
    expect(source.split(headerBlockFor()).length - 1).toBe(1);
    expect(source).toContain('href="/styles/shared-header.css"');
  });

  it('has no retired brand markup', () => {
    for (const legacy of ['afflatus-brand', 'site-brand', 'brand']) {
      expect(nodes.some((node) => classesOf(node).includes(legacy))).toBe(false);
    }
    expect(nodes.some((node) => attr(node, 'data-brand-persona') !== null)).toBe(false);
  });

  it('links the wordmark home with a stable accessible name', () => {
    const wordmark = byClass(header, 'af-wordmark');
    expect(wordmark.tagName).toBe('a');
    expect(attr(wordmark, 'href')).toBe('/en/');
    expect(attr(wordmark, 'data-header-path')).toBe('/');
    expect(attr(wordmark, 'aria-label')).toBeTruthy();
    expect(attr(wordmark, 'data-aria-en')).toBeTruthy();
    expect(attr(wordmark, 'data-aria-zh')).toBeTruthy();
    expect(attr(byClass(wordmark, 'af-brand-art'), 'aria-hidden')).toBe('true');
    expect(elements(wordmark).some((node) => node.tagName === 'svg')).toBe(false);
    for (const part of ['af-brand-full', 'af-brand-compact', 'af-brand-a', 'af-brand-i', 'af-brand-underscore']) {
      expect(byClass(wordmark, part)).toBeTruthy();
    }
  });

  it('points every disclosure at a menu that exists, initially collapsed', () => {
    const ids = new Set(nodes.map((node) => attr(node, 'id')).filter(Boolean));
    const toggles = elements(header).filter((node) => attr(node, 'aria-controls'));
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      expect(ids.has(attr(toggle, 'aria-controls'))).toBe(true);
      expect(attr(toggle, 'aria-expanded')).toBe('false');
    }
  });

  // nav.js imports the controller into the hashed bundle and localises the
  // language switch; only the unbuilt 404 page may load the raw public copy.
  it.skipIf(file === 'public/404.html')('loads the header controller only through the bundle', () => {
    expect(source).not.toContain('src="/lib/header-controller.js"');
  });

  it('has exactly one h1, outside the header', () => {
    const headings = nodes.filter((node) => node.tagName === 'h1');
    expect(headings).toHaveLength(1);
    expect(elements(header).some((node) => node.tagName === 'h1')).toBe(false);
  });
});

// One en/zh label per destination: header, static footers and NAV_ROUTES agree.
describe('destination labels', () => {
  // The brand link to / is the wordmark, not a labelled destination.
  const labelFor = (path) => path !== '/' && NAV_ROUTES.find((route) => route.path === path);
  const linkLabels = (root) => elements(root)
    .filter((node) => node.tagName === 'a' && labelFor(attr(node, 'data-header-path') || attr(node, 'href')))
    .map((node) => {
      const path = attr(node, 'data-header-path') || attr(node, 'href');
      const label = elements(node).find((child) => attr(child, 'data-en') !== null) || node;
      return { path, en: attr(label, 'data-en'), zh: attr(label, 'data-zh') };
    });

  it.each(headerFiles)('%s uses the manifest label for every header and footer link', (file) => {
    const root = parse(readFileSync(file, 'utf8'));
    const regions = elements(root).filter((node) => attr(node, 'data-afflatus-header') !== null || classesOf(node).includes('pa-footer'));
    for (const { path, en, zh } of regions.flatMap(linkLabels)) {
      expect({ path, en, zh }).toEqual({ path, en: labelFor(path).en, zh: labelFor(path).zh });
    }
  });

  it('links search outside the five entries', () => {
    const header = elements(parse(headerBlockFor()));
    const search = header.find((node) => classesOf(node).includes('af-header-search'));
    expect(attr(search, 'href')).toBe('/en/search.html#q');
    expect(attr(search, 'data-header-path')).toBe('/search.html#q');
    expect([attr(search, 'data-aria-en'), attr(search, 'data-aria-zh')]).toEqual(['Search', '搜索']);
    expect(header.find((node) => attr(node, 'id') === 'af-primary-nav').childNodes).not.toContain(search);
  });

  it('renders five top-level entries from the nav groups', () => {
    const nav = elements(parse(headerBlockFor())).find((node) => attr(node, 'id') === 'af-primary-nav');
    const label = (node) => elements(node).find((child) => classesOf(child).includes('af-nav-label'));
    const entries = nav.childNodes.filter((node) => node.tagName);
    expect(entries.map((node) => [node.tagName, attr(label(node), 'data-en'), attr(label(node), 'data-zh')])).toEqual([
      ['div', 'Analysis', '分析'],
      ['a', 'Courses', '课程'],
      ['a', 'Serials', '连载'],
      ['div', 'Labs', '实验室'],
      ['a', 'About', '关于'],
    ]);
    const paths = (id) => elements(elements(nav).find((node) => attr(node, 'id') === id))
      .filter((node) => node.tagName === 'a').map((node) => attr(node, 'data-header-path'));
    expect(paths('af-analysis')).toEqual(['/portfolio.html', '/arena.html', '/signal.html', '/sectors.html', '/elections.html']);
    expect(paths('af-labs')).toEqual(['/horoscope.html', '/worlds.html']);
  });

  it('gives every dropdown row a bilingual sublabel and every group a compact title', () => {
    const nodes = elements(parse(headerBlockFor()));
    const rows = nodes.filter((node) => classesOf(node).includes('af-header-dropdown')).flatMap(elements).filter((node) => node.tagName === 'a');
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      const sublabel = byClass(row, 'af-nav-sublabel');
      expect(attr(sublabel, 'data-en')).toBeTruthy();
      expect(attr(sublabel, 'data-zh')).toBeTruthy();
    }
    expect(nodes.filter((node) => classesOf(node).includes('af-header-group-title')).map((node) => attr(node, 'data-zh'))).toEqual(['分析', '实验室']);
  });

  it('links English navigation to the Chinese-only serial', () => {
    const serial = elements(parse(headerBlockFor())).find((node) => attr(node, 'data-header-path') === '/serial.html');
    expect(attr(serial, 'href')).toBe('/zh/serial.html');
  });

  it('has no single-item dropdown', () => {
    const groups = elements(parse(headerBlockFor())).filter((node) => classesOf(node).includes('af-header-dropdown'));
    for (const group of groups) expect(elements(group).filter((node) => node.tagName === 'a').length).toBeGreaterThan(1);
  });
});
