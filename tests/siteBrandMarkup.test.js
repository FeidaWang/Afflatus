import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import { BUILD_ROUTES } from '../src/config/siteManifest.js';

const ROOT = resolve(import.meta.dirname, '..');
const PAGES = BUILD_ROUTES.map((route) => route.file);
const attr = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value ?? null;
const classesOf = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);

function* walk(node) {
  yield node;
  for (const child of node.childNodes || []) yield* walk(child);
}

function documentOf(file) {
  return parse(readFileSync(resolve(ROOT, file), 'utf8'));
}

describe('旧版品牌块退场', () => {
  it.each(PAGES)('%s 不再保留 site-brand SVG 锁定件', (file) => {
    const doc = documentOf(file);
    const legacy = [...walk(doc)].find((node) => node.tagName && classesOf(node).includes('site-brand'));
    expect(legacy).toBeUndefined();
  });

  it.each(['stats.html', 'course.html'])('%s 已迁移到统一 Al 结构', (file) => {
    const doc = documentOf(file);
    const adaptive = [...walk(doc)].find((node) => node.tagName && classesOf(node).includes('afflatus-brand'));
    expect(adaptive?.tagName).toBe('a');
    expect(attr(adaptive, 'href')).toBe('/');
    expect([...walk(adaptive)].some((node) => node.tagName === 'svg')).toBe(false);
  });
});

describe('.brand → .page-hero 重命名收尾', () => {
  const RENAMED = ['arena.html', 'horoscope.html', 'games.html', 'league.html'];

  it.each(RENAMED)('%s 的报头已改名，不再占用 .brand', (file) => {
    const nodes = [...walk(documentOf(file))].filter((node) => node.tagName);
    expect(nodes.some((node) => classesOf(node).includes('page-hero'))).toBe(true);
    expect(nodes.some((node) => classesOf(node).includes('brand'))).toBe(false);
  });

  it.each(RENAMED)('%s 的报头仍含 <h1>', (file) => {
    const doc = documentOf(file);
    const hero = [...walk(doc)].find((node) => node.tagName && classesOf(node).includes('page-hero'));
    expect([...walk(hero)].some((node) => node.tagName === 'h1')).toBe(true);
  });
});
