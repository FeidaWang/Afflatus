/* audit-header.mjs — v1.7 Part 2 / H0 出口物。
 *
 * roadmap.md §9.2 断言「全站 header 品牌块不统一」。这个脚本把断言变成**可复跑的
 * 事实**：解析每个构建入口的真实 DOM，报告品牌块的标签、子结构、是否可点击。
 *
 * 为什么用 parse5 而不是 grep：品牌块跨行、属性顺序不定、有的在 <a> 有的在 <div>，
 * 正则会漏也会误报——本次审计初稿就被 grep 骗过一次（sectors/stats/course 明明
 * 有 .brand 却匹配不到 `<div class="brand"`）。
 *
 * 用法：
 *   node scripts/audit-header.mjs          # 人读报告
 *   node scripts/audit-header.mjs --json   # 机读
 *   node scripts/audit-header.mjs --check  # 不一致时退出码 1（H1 完工后可进 CI）
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { BUILD_ROUTES } from '../src/config/siteManifest.js';

const ROOT = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const CHECK = argv.includes('--check');

/* ── parse5 遍历工具 ─────────────────────────────────────────────── */

const attr = (node, name) =>
  node.attrs?.find((a) => a.name === name)?.value ?? null;

const classesOf = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);

function* walk(node) {
  yield node;
  for (const child of node.childNodes || []) yield* walk(child);
}

function findByClass(root, className) {
  for (const n of walk(root)) {
    if (n.tagName && classesOf(n).includes(className)) return n;
  }
  return null;
}

function collectClasses(root, prefix) {
  const found = [];
  for (const n of walk(root)) {
    if (!n.tagName) continue;
    for (const c of classesOf(n)) if (c.startsWith(prefix)) found.push(c);
  }
  return found;
}

const textOf = (node) => {
  let out = '';
  for (const n of walk(node)) if (n.nodeName === '#text') out += n.value;
  return out.replace(/\s+/g, ' ').trim();
};

/* ── 审计 ────────────────────────────────────────────────────────── */

const pages = BUILD_ROUTES.map((r) => ({ id: r.id, file: r.file }))
  .filter((p) => existsSync(resolve(ROOT, p.file)));

/* ⚠️ `.brand` 在本仓库被复用于三种不同语义。审计初稿把它们混为一谈，若照此
   「统一」会把站点 logo 塞进页面大标题的位置——直接破坏四个页面的版式。
   分类是本脚本存在的核心理由，不是附加功能。

   header-brand ：<header> 内、紧邻 nav 的紧凑品牌，可点击返回首页（v1.7 的改造对象）
   page-hero    ：含 <h1> 的页面报头，图标+标题+描述（**不在 v1.7 范围内，不要动**）
   nav-mark     ：index 特有，在 nav 内但不可点击、结构独特 */
function classifyBrand(brand) {
  const hasH1 = [...walk(brand)].some((n) => n.tagName === 'h1');
  if (hasH1) return 'page-hero';
  if (brand.tagName === 'a' && attr(brand, 'href')) return 'header-brand';
  return 'nav-mark';
}

/* ⚠️ 第二次踩同一个坑：初版把「没有 .brand 类名」直接判成「缺品牌块」，报出
   signal/serial/boot 三页缺失。实际上它们**各有等价件，只是类名不同**——

     signal  .seal   O5 议会印章（SCP 人格）
     serial  .seal   书章（小说人格）
     boot    #osTag  「AFFLATUS OS v1.5 · BRIDGE SIM」舰桥 OS 标牌

   design.md 宪章①/U27d：**每页一个人格，不做缝合怪**。在 O5 印章旁边再挂一个
   通用 AFFLATUS 标志，正是该条明令禁止的事。所以这三页不是待补齐项，而是
   **已有自己的品牌锁定件**，v1.7 不得触碰。

   教训与 page-hero 那次相同：类名缺席 ≠ 元素缺席。审计要按语义找，不能按类名找。 */
const ALT_BRAND = Object.freeze({
  seal: (doc) => findByClass(doc, 'seal'),
  osTag: (doc) => [...walk(doc)].find((n) => attr(n, 'id') === 'osTag') || null,
});

const results = pages.map(({ id, file }) => {
  const doc = parse(readFileSync(resolve(ROOT, file), 'utf8'));
  const brand = findByClass(doc, 'brand');

  /* v1.7 收尾：arena/horoscope/games/league 的报头已由 `.brand` 改名为
     `.page-hero`，命名撞车消除。于是这里可以**按类名直接判定**，不必再靠
     「是否含 <h1>」的启发式去猜——下面 classifyBrand() 的那条启发式保留为
     安全网，防止将来又有人把报头写成 .brand。 */
  const hero = findByClass(doc, 'page-hero');
  if (!brand && hero) {
    return {
      id, file, present: true, kind: 'page-hero', tag: hero.tagName, isLink: false,
      parts: [], hasSvg: [...walk(hero)].some((n) => n.tagName === 'svg'),
      text: textOf(hero).slice(0, 28) || null, version: null,
    };
  }

  if (!brand) {
    for (const [kind, find] of Object.entries(ALT_BRAND)) {
      const alt = find(doc);
      if (alt) {
        return {
          id, file, present: true, kind: `alt:${kind}`, tag: alt.tagName, isLink: false,
          parts: [], hasSvg: [...walk(alt)].some((n) => n.tagName === 'svg'),
          text: textOf(alt).replace(/\s+/g, ' ').slice(0, 28) || null, version: null,
        };
      }
    }
    return {
      id, file, present: false, kind: null, tag: null, isLink: false,
      parts: [], hasSvg: false, text: null, version: null,
    };
  }

  const hasSvg = [...walk(brand)].some((n) => n.tagName === 'svg');
  const versionNode = findByClass(brand, 'brand-version');

  return {
    id,
    file,
    present: true,
    kind: classifyBrand(brand),
    tag: brand.tagName,
    isLink: brand.tagName === 'a' && Boolean(attr(brand, 'href')),
    parts: collectClasses(brand, 'site-brand'),
    hasSvg,
    text: textOf(brand) || null,
    version: versionNode ? textOf(versionNode) : null,
  };
});

/* ── 一致性判定 ──────────────────────────────────────────────────── */

const present = results.filter((r) => r.present);
const missing = results.filter((r) => !r.present);
// v1.7 的改造范围**只含** header-brand 与 nav-mark；page-hero 是页面报头，不动。
/* index 的 nav-mark 是**有据可查的排除项**，不是待统一项：
   它的 .brand 是 P1-11 刚迁移完的组件（容器查询 + 渐变字标，src/styles.css
   注释写明「this is now the only owner」，design.md 有三带响应式视觉合同）。
   H0 把它单列为 nav-mark 正因为它是有意为之的独立设计；统一掉等于毁掉刚做完的
   工作。故 inScope 只含 header-brand。 */
const inScope = present.filter((r) => r.kind === 'header-brand');
const navMarks = present.filter((r) => r.kind === 'nav-mark');
const heroes = present.filter((r) => r.kind === 'page-hero');
const alts = present.filter((r) => r.kind.startsWith('alt:'));
const tags = [...new Set(inScope.map((r) => r.tag))];
const linkStates = [...new Set(inScope.map((r) => r.isLink))];
const partSets = [...new Set(inScope.map((r) => r.parts.join(',')))];
const versions = [...new Set(inScope.map((r) => r.version).filter(Boolean))];
const withSvg = inScope.filter((r) => r.hasSvg);

const issues = [];
/* notes 与 issues 分开：notes 是「已裁决、记录在案」，issues 才是待办项。
   只有 issues 才让 --check 失败——否则门禁永远为红，也就永远没人看。 */
const notes = [];
if (missing.length) issues.push(`${missing.length} 页缺品牌块: ${missing.map((r) => r.id).join(', ')}`);
if (tags.length > 1) issues.push(`范围内标签不统一: ${tags.join(' / ')}`);
if (linkStates.length > 1) issues.push('部分可点击返回首页、部分不可——手势不一致');
if (partSets.length > 1) issues.push(`范围内子结构有 ${partSets.length} 种变体`);
if (versions.length > 1) issues.push(`版号不一致: ${versions.join(' / ')}`);
if (withSvg.length !== inScope.length) {
  issues.push(`${inScope.length - withSvg.length}/${inScope.length} 个范围内品牌仍是纯文本（v1.7 目标 inline SVG）`);
}
if (alts.length) {
  notes.push(`${alts.length} 页使用该页人格专属的品牌锁定件`
    + `（${alts.map((r) => `${r.id}=${r.kind.slice(4)}`).join(', ')}）——`
    + '**不是缺失**。宪章①「每页一个人格」禁止在其旁并挂通用标志');
}
if (heroes.length) {
  notes.push(`页面报头 ${heroes.length} 个（${heroes.map((r) => r.id).join(', ')}）`
    + '——已于 v1.7 由 .brand 改名为 .page-hero，命名撞车已消除，不在改造范围内');
}
if (navMarks.length) {
  notes.push(`nav-mark ${navMarks.length} 个（${navMarks.map((r) => r.id).join(', ')}）`
    + '——P1-11 已有专属视觉合同，明确排除，不参与统一');
}

const report = {
  schemaVersion: 1,
  auditedAt: new Date().toISOString().slice(0, 10),
  pageCount: results.length,
  presentCount: present.length,
  missing: missing.map((r) => r.id),
  distinctTags: tags,
  distinctPartSets: partSets,
  versions,
  svgAdoption: `${withSvg.length}/${inScope.length}`,
  issues,
  notes,
  pages: results,
};

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const pad = (s, n) => String(s ?? '—').padEnd(n);
  console.log('\nv1.7 / H0 — 全站 header 品牌块审计\n');
  console.log(`${pad('页面', 12)}${pad('语义', 15)}${pad('标签', 7)}${pad('链接', 6)}${pad('SVG', 6)}${pad('版号', 8)}子结构`);
  console.log('─'.repeat(92));
  for (const r of results) {
    if (!r.present) {
      console.log(`${pad(r.id, 12)}${pad('缺失', 15)}${pad('—', 7)}${pad('—', 6)}${pad('—', 6)}${pad('—', 8)}—`);
      continue;
    }
    console.log(
      pad(r.id, 12) + pad(r.kind, 15) + pad(`<${r.tag}>`, 7) + pad(r.isLink ? '是' : '否', 6)
      + pad(r.hasSvg ? '是' : '否', 6) + pad(r.version, 8)
      + (r.parts.join(' ') || '（无 site-brand* 子节点）'),
    );
  }
  console.log(`\nv1.7 改造范围：${inScope.length} 个 header-brand`
    + `；范围外——页面报头 ${heroes.length}、人格锁定件 ${alts.length}、nav-mark ${navMarks.length}`
    + `；真正缺失 ${missing.length} 个`);
  console.log(`范围内 SVG 采用：${withSvg.length}/${inScope.length}`);
  if (issues.length) {
    console.log('\n待统一项：');
    for (const i of issues) console.log(`  • ${i}`);
  } else {
    console.log('\n✔ 改造范围内全站一致。');
  }
  if (notes.length) {
    console.log('\n已裁决（记录在案，不计入门禁）：');
    for (const n of notes) console.log(`  · ${n}`);
  }
  console.log('');
}

if (CHECK && issues.length) {
  console.error(`audit-header: ${issues.length} 项不一致（H1 完工前预期失败）`);
  process.exit(1);
}
