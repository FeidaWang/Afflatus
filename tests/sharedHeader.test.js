import { readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import { headerBlockFor, headerFiles } from '../scripts/shared-header.mjs';

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
