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
const PAGES = BUILD_ROUTES.map((route) => route.file);
const FOLLOWING_PAGES = PAGES.filter((file) => file !== 'boot.html');

const attr = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value ?? null;
const classes = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);

function* walk(node) {
  yield node;
  for (const child of node?.childNodes || []) yield* walk(child);
}

function documentOf(file) {
  return parse(readFileSync(resolve(ROOT, file), 'utf8'));
}

function findClass(root, className) {
  return [...walk(root)].find((node) => node.tagName && classes(node).includes(className)) || null;
}

function brandOf(file) {
  return findClass(documentOf(file), 'afflatus-brand');
}

describe('AI 顶部状态', () => {
  it('只有在页面顶端展开完整 Afflatus', () => {
    expect(brandStateFromTop(true)).toBe(AFFLATUS_BRAND_FULL);
    expect(brandStateFromTop(false)).toBe(AFFLATUS_BRAND_COMPACT);
  });
});

describe.each(PAGES)('%s 自适应 AI 字标', (file) => {
  const doc = documentOf(file);
  const brand = findClass(doc, 'afflatus-brand');

  it('存在、可返回首页且拥有稳定的可访问名', () => {
    expect(brand?.tagName).toBe('a');
    expect(attr(brand, 'href')).toBe('/');
    expect(attr(brand, 'aria-label')).toBeTruthy();
    expect(attr(brand, 'data-afflatus-brand')).not.toBeNull();
  });

  it('完整字名拆为 A / ff / l / atus，紧凑态另有信号与核心层', () => {
    expect(findClass(brand, 'afflatus-brand__a')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__before')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__l')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__after')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__signal')).toBeTruthy();
    expect(findClass(brand, 'afflatus-brand__core')).toBeTruthy();
  });

  it('不含反斜杠结构，也不使用逐页 SVG 变体', () => {
    expect(findClass(brand, 'afflatus-brand__vector')).toBeNull();
    expect([...walk(brand)].some((node) => node.tagName === 'svg')).toBe(false);
    expect(readFileSync(resolve(ROOT, file), 'utf8')).not.toContain('afflatus-brand__vector');
  });

  it('加载共享样式并声明该页独有视觉人格', () => {
    const links = [...walk(doc)].filter((node) => node.tagName === 'link');
    expect(links.some((node) => attr(node, 'href') === '/styles/afflatus-brand.css')).toBe(true);
    expect(attr(brand, 'data-brand-persona')).toBeTruthy();
  });
});

describe.each(FOLLOWING_PAGES)('%s 跟随式品牌', (file) => {
  it('字标位于跟随页面滚动的顶部容器', () => {
    const doc = documentOf(file);
    const brand = findClass(doc, 'afflatus-brand');
    const header = [...walk(doc)].find((node) => (
      node.tagName
      && classes(node).includes('site-header--follow')
      && [...walk(node)].includes(brand)
    ));
    expect(header).toBeTruthy();
  });
});

describe('跨页一致性与差异化', () => {
  const css = readFileSync(resolve(ROOT, 'public/styles/afflatus-brand.css'), 'utf8');

  it('所有构建页面使用完全相同的字形节点序列', () => {
    const signatures = PAGES.map((file) => [...walk(brandOf(file))]
      .filter((node) => node.tagName)
      .map((node) => `${node.tagName}.${classes(node).join('.')}`)
      .join('|'));
    expect(new Set(signatures).size).toBe(1);
  });

  it('每个页面拥有唯一人格，不会退回一套通用皮肤', () => {
    const personas = PAGES.map((file) => attr(brandOf(file), 'data-brand-persona'));
    expect(new Set(personas).size).toBe(PAGES.length);
  });

  it('共享样式中彻底移除旧反斜杠向量', () => {
    expect(css).not.toContain('afflatus-brand__vector');
  });

  it('压缩态把原字名中的小写 l 重绘为清晰的大写 AI 字标', () => {
    expect(css).toMatch(/\.afflatus-brand__l::after\s*{[^}]*content:\s*"I"/s);
    expect(css).toMatch(/data-afflatus-brand-state="compact"[^}]+\.afflatus-brand__l\s*{[^}]*color:\s*transparent/s);
    expect(css).toMatch(/data-afflatus-brand-state="compact"[^}]+\.afflatus-brand__l::after\s*{[^}]*opacity:\s*1/s);
  });

  it.each(PAGES)('%s 的人格字体与专属变换均在共享样式内定义', (file) => {
    const persona = attr(brandOf(file), 'data-brand-persona');
    expect(css).toContain(`[data-brand-persona="${persona}"]`);
    expect(css).toContain(`--afflatus-brand-font:`);
    expect(css).toMatch(new RegExp(`data-brand-persona="${persona}"\\] \\.afflatus-brand__stage \\{[^}]*animation: afflatus-${persona}-resolve`));
    expect(css).toContain(`@keyframes afflatus-${persona}-resolve`);
  });

  it('首页拥有太空战机、锁定和射击动作，小说页拥有左右翻书动作', () => {
    expect(css).toContain('afflatus-home-fighter');
    expect(css).toContain('afflatus-home-shot');
    expect(css).toContain('afflatus-serial-left-page');
    expect(css).toContain('afflatus-serial-right-page');
    expect(css).toContain('afflatus-serial-page-left');
    expect(css).toContain('afflatus-serial-page-right');
    expect(css).toMatch(/@keyframes afflatus-serial-page-left[^}]+rotateY/s);
  });

  it('减少动态效果模式会关闭舞台、AI 字形与装饰层动画', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('.afflatus-brand__stage,');
    expect(reduced).toContain('.afflatus-brand__stage::before');
    expect(reduced).toContain('.afflatus-brand__l::after');
    expect(reduced).toContain('.afflatus-brand__signal');
    expect(reduced).toContain('animation: none !important');
  });
});
