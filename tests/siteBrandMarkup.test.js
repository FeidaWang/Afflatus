/**
 * v1.7 H3 — 统一品牌块的结构与无障碍不变量。
 *
 * 这些是**无需浏览器**就能验证的项。真正需要真机的部分（对比度实测、axe 全量、
 * CLS 实测）不在这里假装覆盖——见 roadmap §7.10 的诚实清单。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import { BUILD_ROUTES } from '../src/config/siteManifest.js';

const ROOT = resolve(import.meta.dirname, '..');
/** Labs 内保留旧版通用品牌块的两个页面；其余 Labs 页面使用自身人格锁定件。 */
const PAGES = ['stats.html', 'course.html'];

const attr = (n, name) => n.attrs?.find((a) => a.name === name)?.value ?? null;
const classesOf = (n) => (attr(n, 'class') || '').split(/\s+/).filter(Boolean);

function* walk(node) {
  yield node;
  for (const c of node.childNodes || []) yield* walk(c);
}

function brandOf(file) {
  const doc = parse(readFileSync(resolve(ROOT, file), 'utf8'));
  for (const n of walk(doc)) {
    if (n.tagName && classesOf(n).includes('site-brand')) return n;
  }
  return null;
}

const findClass = (root, cls) => [...walk(root)].find((n) => n.tagName && classesOf(n).includes(cls)) || null;
const textOf = (n) => [...walk(n)].filter((x) => x.nodeName === '#text').map((x) => x.value).join('').trim();

describe.each(PAGES)('%s 的 .site-brand', (file) => {
  const brand = brandOf(file);

  it('存在且是可点击返回首页的 <a> —— 手势必须全站一致', () => {
    expect(brand).not.toBeNull();
    expect(brand.tagName).toBe('a');
    expect(attr(brand, 'href')).toBe('/');
  });

  it('有可访问名 —— 否则读屏只会念出一串装饰字符', () => {
    expect(attr(brand, 'aria-label')).toBeTruthy();
    expect(attr(brand, 'data-aria-en')).toBeTruthy();
    expect(attr(brand, 'data-aria-zh')).toBeTruthy();
  });

  it('字母标 SVG 对辅助技术隐藏且不可聚焦', () => {
    const svg = [...walk(brand)].find((n) => n.tagName === 'svg');
    expect(svg).toBeTruthy();
    // aria-hidden：避免与 aria-label 重复播报
    expect(attr(svg, 'aria-hidden')).toBe('true');
    // focusable=false：IE/旧 Edge 会把 SVG 塞进 Tab 序列，留下一个空停靠点
    expect(attr(svg, 'focusable')).toBe('false');
  });

  it('SVG 用 currentColor 描边 —— 随各页主题走，不硬编码颜色', () => {
    const path = [...walk(brand)].find((n) => n.tagName === 'path');
    expect(attr(path, 'stroke')).toBe('currentColor');
  });

  it('副标题双语成对（i18n 门禁）', () => {
    const sub = findClass(brand, 'site-brand__sub');
    expect(sub).toBeTruthy();
    expect(attr(sub, 'data-en')).toBeTruthy();
    expect(attr(sub, 'data-zh')).toBeTruthy();
  });

  it('字标文本保留在 DOM 里 —— 紧凑态靠 CSS 收起，不得从可访问性树移除', () => {
    const word = findClass(brand, 'site-brand__word');
    expect(textOf(word)).toBe('AFFLATUS');
  });

  it('可收起部分被包在单一容器内 —— 动画只作用于一个节点', () => {
    const text = findClass(brand, 'site-brand__text');
    expect(text).toBeTruthy();
    expect(findClass(text, 'site-brand__word')).toBeTruthy();
    expect(findClass(text, 'site-brand__sub')).toBeTruthy();
  });
});

describe('跨页一致性（防漂移）', () => {
  it('只有两个 Labs 页面保留旧版通用品牌块', () => {
    const found = BUILD_ROUTES
      .map((route) => route.file)
      .filter((file) => brandOf(file));
    expect(found.sort()).toEqual([...PAGES].sort());
  });

  it('两页的 SVG 路径完全相同 —— 复制粘贴的标志最容易悄悄分叉', () => {
    const paths = PAGES.map((f) => {
      const p = [...walk(brandOf(f))].find((n) => n.tagName === 'path');
      return attr(p, 'd');
    });
    expect(new Set(paths).size).toBe(1);
  });

  it('两页的类名结构完全相同', () => {
    const shapes = PAGES.map((f) => {
      const b = brandOf(f);
      return [...walk(b)]
        .filter((n) => n.tagName)
        .map((n) => `${n.tagName}.${classesOf(n).join('.')}`)
        .join('|');
    });
    expect(new Set(shapes).size).toBe(1);
  });

  it('副标题各页不同 —— 统一的是结构，不是内容', () => {
    const subs = PAGES.map((f) => attr(findClass(brandOf(f), 'site-brand__sub'), 'data-en'));
    expect(new Set(subs).size).toBe(PAGES.length);
  });
});

describe('.brand → .page-hero 重命名收尾', () => {
  const RENAMED = ['arena.html', 'horoscope.html', 'games.html', 'league.html'];

  it.each(RENAMED)('%s 的报头已改名，不再占用 .brand', (file) => {
    const doc = parse(readFileSync(resolve(ROOT, file), 'utf8'));
    const nodes = [...walk(doc)].filter((n) => n.tagName);
    expect(nodes.some((n) => classesOf(n).includes('page-hero'))).toBe(true);
    expect(nodes.some((n) => classesOf(n).includes('brand'))).toBe(false);
  });

  it.each(RENAMED)('%s 的报头仍含 <h1> —— 改名不得改变语义', (file) => {
    const doc = parse(readFileSync(resolve(ROOT, file), 'utf8'));
    const hero = [...walk(doc)].find((n) => n.tagName && classesOf(n).includes('page-hero'));
    expect([...walk(hero)].some((n) => n.tagName === 'h1')).toBe(true);
  });
});
