/*
 * Full-site Afflatus header audit.
 * Every build route must expose the same CSS-only Afflatus → AI structure,
 * while `data-brand-persona` supplies a unique page-native visual system.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { BUILD_ROUTES } from '../src/config/siteManifest.js';

const ROOT = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const CHECK = argv.includes('--check');

const attr = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value ?? null;
const classes = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);

function* walk(node) {
  yield node;
  for (const child of node.childNodes || []) yield* walk(child);
}

function findClass(root, className) {
  return [...walk(root)].find((node) => node.tagName && classes(node).includes(className)) || null;
}

function collectParts(root) {
  return [...walk(root)]
    .filter((node) => node.tagName)
    .flatMap((node) => classes(node).filter((className) => className.startsWith('afflatus-brand')));
}

const expectedParts = [
  'afflatus-brand',
  'afflatus-brand__stage',
  'afflatus-brand__a',
  'afflatus-brand__before',
  'afflatus-brand__l',
  'afflatus-brand__after',
  'afflatus-brand__signal',
  'afflatus-brand__core',
  'afflatus-brand__sr',
];

const pages = BUILD_ROUTES
  .filter((route) => existsSync(resolve(ROOT, route.file)))
  .map((route) => {
    const source = readFileSync(resolve(ROOT, route.file), 'utf8');
    const doc = parse(source);
    const brand = findClass(doc, 'afflatus-brand');
    const parts = brand ? collectParts(brand) : [];
    const followingHeader = brand
      ? [...walk(doc)].find((node) => node.tagName
        && classes(node).includes('site-header--follow')
        && [...walk(node)].includes(brand))
      : null;

    return {
      id: route.id,
      file: route.file,
      status: route.status,
      present: Boolean(brand),
      tag: brand?.tagName || null,
      homeLink: attr(brand, 'href') === '/',
      persona: attr(brand, 'data-brand-persona'),
      parts,
      hasSvg: brand ? [...walk(brand)].some((node) => node.tagName === 'svg') : false,
      hasVector: Boolean(brand && findClass(brand, 'afflatus-brand__vector')),
      loadsCss: [...walk(doc)].some((node) => node.tagName === 'link'
        && attr(node, 'href') === '/styles/afflatus-brand.css'),
      follows: route.file === 'boot.html' ? true : Boolean(followingHeader),
      sourceHasBackslashPart: source.includes('afflatus-brand__vector'),
    };
  });

const issues = [];
const missing = pages.filter((page) => !page.present);
if (missing.length) issues.push(`缺少自适应字标: ${missing.map((page) => page.id).join(', ')}`);

for (const page of pages.filter((entry) => entry.present)) {
  if (page.tag !== 'a' || !page.homeLink) issues.push(`${page.id}: 字标必须是返回首页的链接`);
  if (!page.persona) issues.push(`${page.id}: 缺少 data-brand-persona`);
  if (!page.loadsCss) issues.push(`${page.id}: 未加载共享字标样式`);
  if (!page.follows) issues.push(`${page.id}: 字标未放入跟随式顶部栏`);
  if (page.hasSvg) issues.push(`${page.id}: 字标重新引入 SVG`);
  if (page.hasVector || page.sourceHasBackslashPart) issues.push(`${page.id}: 仍含旧反斜杠向量`);
  const missingParts = expectedParts.filter((part) => !page.parts.includes(part));
  if (missingParts.length) issues.push(`${page.id}: 结构缺少 ${missingParts.join(', ')}`);
}

const partSets = new Set(pages.filter((page) => page.present).map((page) => page.parts.join(',')));
if (partSets.size > 1) issues.push(`字标子结构出现 ${partSets.size} 种变体`);

const personas = pages.map((page) => page.persona).filter(Boolean);
if (new Set(personas).size !== pages.length) issues.push('页面人格缺失或重复');

const report = {
  schemaVersion: 2,
  auditedAt: new Date().toISOString().slice(0, 10),
  pageCount: pages.length,
  adaptiveAdoption: `${pages.length - missing.length}/${pages.length}`,
  personaCount: new Set(personas).size,
  issues,
  pages,
};

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const pad = (value, width) => String(value ?? '—').padEnd(width);
  console.log('\n全站 Afflatus → AI 品牌审计\n');
  console.log(`${pad('页面', 12)}${pad('状态', 11)}${pad('人格', 12)}${pad('链接', 7)}${pad('跟随', 7)}${pad('SVG', 6)}反斜杠`);
  console.log('─'.repeat(72));
  for (const page of pages) {
    console.log(
      pad(page.id, 12)
      + pad(page.status, 11)
      + pad(page.persona, 12)
      + pad(page.homeLink ? '是' : '否', 7)
      + pad(page.follows ? '是' : '否', 7)
      + pad(page.hasSvg ? '是' : '否', 6)
      + (page.hasVector || page.sourceHasBackslashPart ? '有' : '无'),
    );
  }
  console.log(`\nCSS AI 覆盖：${report.adaptiveAdoption}；独立视觉人格：${report.personaCount}/${pages.length}`);
  if (issues.length) {
    console.log('\n待修复：');
    for (const issue of issues) console.log(`  • ${issue}`);
  } else {
    console.log('\n✔ 全部构建页面使用无反斜杠、同结构、不同人格的 AI 字标。');
  }
  console.log('');
}

if (CHECK && issues.length) process.exit(1);
