import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import {
  AFFLATUS_BRAND_COMPACT,
  AFFLATUS_BRAND_FULL,
  brandStateFromTop,
} from '../src/lib/afflatusBrand.js';
import { BUILD_ROUTES } from '../src/config/siteManifest.js';

const ROOT = resolve(import.meta.dirname, '..');
const NON_LABS = BUILD_ROUTES
  .filter((route) => route.status === 'active' && route.nav?.group !== 'labs')
  .map((route) => route.file);
const LABS = BUILD_ROUTES
  .filter((route) => route.status === 'active' && route.nav?.group === 'labs')
  .map((route) => route.file);

const attr = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value ?? null;
const classes = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);

function* walk(node) {
  yield node;
  for (const child of node.childNodes || []) yield* walk(child);
}

function documentOf(file) {
  return parse(readFileSync(resolve(ROOT, file), 'utf8'));
}

function findClass(root, className) {
  return [...walk(root)].find((node) => node.tagName && classes(node).includes(className)) || null;
}

describe('A·l 顶部状态', () => {
  it('只有在页面顶端展开完整 Afflatus', () => {
    expect(brandStateFromTop(true)).toBe(AFFLATUS_BRAND_FULL);
    expect(brandStateFromTop(false)).toBe(AFFLATUS_BRAND_COMPACT);
  });
});

describe.each(NON_LABS)('%s 自适应 AI 字标', (file) => {
  const doc = documentOf(file);
  const brand = findClass(doc, 'afflatus-brand');

  it('存在、可返回首页且拥有稳定的可访问名', () => {
    expect(brand?.tagName).toBe('a');
    expect(attr(brand, 'href')).toBe('/');
    expect(attr(brand, 'aria-label')).toBeTruthy();
    expect(attr(brand, 'data-afflatus-brand')).not.toBeNull();
  });

  it('完整字名被拆为 A / ff / l / atus，A 与 l 可独立收束', () => {
    expect(findClass(brand, 'afflatus-brand__a')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__before')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__l')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__after')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__vector')).toBeTruthy();
  });

  it('使用共享 CSS 字形而非逐页 SVG 变体', () => {
    expect([...walk(brand)].some((node) => node.tagName === 'svg')).toBe(false);
  });

  it('顶部栏声明跟随滚动', () => {
    const header = [...walk(doc)].find((node) => (
      node.tagName
      && classes(node).includes('site-header--follow')
      && [...walk(node)].includes(brand)
    ));
    expect(header).toBeTruthy();
  });

  it('加载共享字标样式', () => {
    const links = [...walk(doc)].filter((node) => node.tagName === 'link');
    expect(links.some((node) => attr(node, 'href') === '/styles/afflatus-brand.css')).toBe(true);
  });
});

describe('Labs 排除合同', () => {
  it.each(LABS)('%s 不挂载新 A·l 字标', (file) => {
    expect(findClass(documentOf(file), 'afflatus-brand')).toBeNull();
  });
});

describe('跨页一致性', () => {
  it('四个非 Labs 页面使用完全相同的字形节点序列', () => {
    const signatures = NON_LABS.map((file) => {
      const brand = findClass(documentOf(file), 'afflatus-brand');
      return [...walk(brand)]
        .filter((node) => node.tagName)
        .map((node) => `${node.tagName}.${classes(node).join('.')}`)
        .join('|');
    });
    expect(new Set(signatures).size).toBe(1);
  });
});
