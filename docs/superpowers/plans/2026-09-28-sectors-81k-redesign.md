# Sectors 81k 改造 + 美股 AI 版图 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `sectors.html` 改造成 81k 式长文页面：吸顶点阵舞台，加上"美国双雄 / 中美 / 公司地球 / 关系网络 / IPO"五个新模块。配色用美中两国国旗色，所有数值带来源与状态标签。

**Architecture:** 数据层与视图层分开。
- 数据层：两份带日期的 JSON 快照（模型、产业），各配一个校验器，并接入 `npm run data:check`。
- 计算层：全部是纯函数（对比、分歧份额、投影、聚类、网络布局），由 Vitest 覆盖。
- 视图层：每个模块一个 `mountX(host, data, lang)`，只写 DOM/SVG/Canvas，不做计算。
- 入口：由 `src/pages/sectors.js` 统一装配。

**Tech Stack:** Vite 多页站点、原生 ES 模块、Canvas 2D、内联 SVG、Vitest、Playwright（含 axe），Python fonttools（`pyftsubset` 已安装）。

**Spec:** `docs/superpowers/specs/2026-09-28-sectors-81k-redesign-design.md`
- 执行者必须读 §0–§7 与 **§8 修订 v2**
- §8 与前文冲突时以 §8 为准

**范围说明：** spec §5 的"全站字体切换"是独立子系统，另写一份计划（`2026-09-28-site-font-switch.md`），不在本计划内。本计划只把字体文件与 `@font-face` 放进 `page-turn.css`，并只在 `.sectors` 下启用字体变量，其他页面外观不变。

## Global Constraints

- 工作目录：`.worktrees/sectors-81k`，分支 `feat/sectors-81k-redesign`，所有命令在此目录执行
- 部署：不部署；本地 `npm run build` + `npm run preview` 验证
- 颜色 token（§8.2）：`--us:#0A3161` `--us-tint:rgba(10,49,97,.14)` `--cn:#EE1C25` `--cn-ink:#B8141B` `--cn-tint:rgba(238,28,37,.12)` `--other:#77756E` `--paper:#FAF9F5` `--stage:#E8E6DC` `--ink:#141413` `--text:#30302E` `--muted:#77756E` `--rule:#D6D4CC` `--mark:#BFDE8D`
- 线型：合作用 1.5px 实线；竞争用 1.5px 虚线 `6 4`；美–中跨国线用 `--us→--cn` 渐变
- 文字使用 `--cn-ink`，不用 `--cn`（后者对比度 4.1，只用于图形）
- 双语：每个可见字符串都有 `data-en` 与 `data-zh`，JS 生成的文字用 `translate(en, zh, lang)`（`src/sectors/content.js`）
- 事实状态只有六种：`official | independent | lab_claimed | reported | projection | unverified`。`unverified` 不渲染；`lab_claimed` 与 `projection` 必须显示可见标签
- 数值：不手写"领先 / 落后"结论，一律由 `headToHead` / `divergingShares` 的输出生成
- 不使用阴影、渐变底、霓虹、发光（跨国连线的渐变除外）
- 动效必须尊重 `prefers-reduced-motion: reduce`，此时显示静态终态
- 断点：320 / 390 / 768 / 1440 宽度下无横向滚动
- 提交信息结尾两行固定为：
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QocpzTvQugnPKBxkTb49Wg
  ```
- 测试命令：单元测试 `npx vitest run <file>`；端到端测试 `npx playwright test <file> --project=chromium`（先 `npm run build`）

## Review Focus

1. **某模型某指标缺值（`null`）**：对比条应显示"未公布 / Not published"，不画零长度条，也不计入谁领先。→ 任务 5 测试 `missing`
2. **两家公司总部重合**（湾区约 25 家）：地球上应聚成计数气泡，点击后列出成员，不能叠成一团无法点击。→ 任务 9 测试 `clusterMarkers`
3. **同一对公司既合作又竞争**（Anthropic–Google、Anthropic–SpaceX）：应画两条平行线，不能互相覆盖。→ 任务 10 测试 pair offset
4. **标志文件加载失败**（网络中断、文件被删）：显示公司首字母圆章加品牌色，布局不塌陷。→ 任务 9 视图 `onerror` 回退 + 任务 13 e2e `logo failures fall back to monograms`
5. **手机 320px 宽度下的网络图**：不渲染 SVG 网络，改为"选公司 → 关系列表"，所有边仍可读、可筛选。→ 任务 10 e2e 用例

---

## 文件结构

| 路径 | 职责 | 新建/修改 |
|---|---|---|
| `public/styles/sectors-v2.css` | 新版 token、版式、各新模块样式（旧 `sectors.css` 只留给历史档案） | 新建 |
| `public/data/sectors-frontier/2026-09-27.json` | 新模型快照 | 新建（脚本生成） |
| `scripts/build-frontier-2026-09-27.mjs` | 由 09-23 快照加补丁生成新快照 | 新建 |
| `scripts/data/sectors-industry-seed.mjs` | 产业数据种子（公司、边、事实、来源），用紧凑元组写 | 新建 |
| `scripts/build-sectors-industry.mjs` | 种子 → `public/data/sectors-industry/2026-09-27.json`，生成后立即校验 | 新建 |
| `src/sectors/industry/industry-core.js` | 常量、`validateIndustry`、`renderable` | 新建 |
| `src/sectors/industry/head-to-head.js` | `headToHead`、`pairedScale` | 新建 |
| `src/sectors/industry/rivalry-math.js` | `geographyLeaders`、`snapshotDims`、`divergingShares` | 新建 |
| `src/sectors/stage/projection.js` | `rotateToView`、`projectLatLon`、`projectXyz` | 新建 |
| `src/sectors/stage/layouts.js` | 舞台 6 个场景的纯函数布局 | 新建 |
| `src/sectors/stage/stage.js` | Canvas 渲染 + 滚动映射 | 新建 |
| `src/sectors/industry/globe-layout.js` | `TIER_RADIUS`、`clusterMarkers`、`companyMarkers` | 新建 |
| `src/sectors/industry/graph-layout.js` | `layoutIndustryGraph`、`STORIES` | 新建 |
| `src/sectors/industry/*-view.js` | 五个模块的视图 | 新建 |
| `scripts/fetch-official-logos.mjs` | 从官网取标志，写 manifest | 新建 |
| `scripts/lib/svg-color.mjs` | `dominantSvgColor` | 新建 |
| `public/assets/sectors/logos/manifest.json` | 标志来源台账 | 新建 |
| `scripts/subset-cjk-fonts.mjs` | 思源宋体子集化 | 新建 |
| `sectors.html` | 按 §8.3 重组章节 | 修改 |
| `src/pages/sectors.js` | 装配新模块、切换到新快照 | 修改 |
| `src/lib/fetchJson.js:61` | 新增两个静态资源键 | 修改 |
| `scripts/validate-data.mjs:35` | 新增两份校验 | 修改 |
| `tests/sectors*.test.js`、`e2e/sectors-story.spec.js` | 见各任务 | 新建/修改 |

---

### Task 0: 把主工作区未提交的 sectors 测试带进分支

**Files:**
- Copy from main workspace: `e2e/sectors-*.spec.js`、`e2e/sectors-bfcache.browser.js`、`tests/sectors{Frontier,RefreshP5,DossierP4,ExplorerP3,DependenciesP2}.test.js`

- [ ] **Step 1: 列出未跟踪文件**

Run: `git -C ../.. status --short -- e2e tests | grep '^??' | grep -i sector`
Expected: 列出上述文件。如有额外的 sectors 文件，一并加入复制清单。

- [ ] **Step 2: 复制并运行，记录基线**

```bash
for f in $(git -C ../.. status --short -- e2e tests | grep '^??' | grep -i sector | awk '{print $2}'); do cp "../../$f" "$f"; done
npx vitest run tests/sectors
```
Expected: 全部 PASS（这是改造前的基线；有失败则先停下，报告给用户）。

- [ ] **Step 3: Commit**

```bash
git add e2e tests
git commit -m "test: bring sectors test suite into redesign branch"
```

---

### Task 1: 国旗配色 token 与对比度测试

**Files:**
- Create: `public/styles/sectors-v2.css`
- Modify: `sectors.html`（`<head>` 中 `sectors.css` 之后加一行 `<link rel="stylesheet" href="/styles/sectors-v2.css">`）
- Test: `tests/sectorsPalette.test.js`

**Interfaces:**
- Produces: CSS 自定义属性（见 Global Constraints），挂在 `.sectors` 根元素上（`<main class="sectors">`，没有就给页面主容器加这个 class）

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsPalette.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('public/styles/sectors-v2.css', 'utf8');
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('sectors v2 palette', () => {
  it('uses the flag colours', () => {
    expect(token('us')).toBe('#0A3161');
    expect(token('cn')).toBe('#EE1C25');
  });
  it('keeps text tokens at AA on paper and stage', () => {
    for (const t of ['ink', 'text', 'muted', 'us', 'cn-ink']) {
      expect(contrast(token(t), token('paper')), t).toBeGreaterThanOrEqual(4.5);
    }
    for (const t of ['ink', 'text', 'muted', 'us', 'cn-ink']) {
      expect(contrast(token(t), token('stage')), t).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps graphic tokens at 3:1', () => {
    expect(contrast(token('cn'), token('paper'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('cn'), token('stage'))).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsPalette.test.js`
Expected: FAIL，`ENOENT: public/styles/sectors-v2.css`

- [ ] **Step 3: 写 token**

```css
/* public/styles/sectors-v2.css — 81k redesign layer. Spec §3, §8.2. */
.sectors{
  --paper:#FAF9F5; --stage:#E8E6DC; --ink:#141413; --text:#30302E;
  --muted:#66645E; --rule:#D6D4CC; --mark:#BFDE8D;
  --us:#0A3161; --us-tint:rgba(10,49,97,.14);
  --cn:#EE1C25; --cn-ink:#B8141B; --cn-tint:rgba(238,28,37,.12);
  --other:#77756E;
  --land:rgba(20,20,19,.18);
  --w-text:640px; --w-module:1120px;
  background:var(--paper); color:var(--text);
}
.sectors .is-us{color:var(--us)}
.sectors .is-cn{color:var(--cn-ink)}
.sectors .status-tag{font:600 11px/1 var(--font-sans,system-ui);letter-spacing:.08em;text-transform:uppercase;
  border:1px solid currentColor;border-radius:999px;padding:3px 7px;color:var(--muted);white-space:nowrap}
.sectors .status-tag[data-status="projection"]{color:var(--ink);background:repeating-linear-gradient(135deg,transparent 0 4px,var(--rule) 4px 5px)}
.sectors .status-tag[data-status="lab_claimed"]{color:var(--ink)}
.sectors .edge-coop{stroke-width:1.5;fill:none}
.sectors .edge-compete{stroke-width:1.5;fill:none;stroke-dasharray:6 4}
```

说明：`--muted` 从 spec 的 `#77756E` 改为 `#66645E`。原值在 `--stage` 底上不到 4.5:1，而 `--muted` 会出现在舞台说明文字上；新值为 4.7:1（纸面 5.6:1）。`--other` 仍用 `#77756E`，它只用于图形。

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run tests/sectorsPalette.test.js`
Expected: PASS（3 项）

- [ ] **Step 5: Commit**

```bash
git add public/styles/sectors-v2.css sectors.html tests/sectorsPalette.test.js
git commit -m "feat(sectors): flag-colour palette tokens with contrast tests"
```

---

### Task 2: 新模型快照 2026-09-27

**Files:**
- Create: `scripts/build-frontier-2026-09-27.mjs`
- Create (generated): `public/data/sectors-frontier/2026-09-27.json`
- Modify: `scripts/validate-data.mjs:35`（新增一条 CHECK）、`src/lib/fetchJson.js:61`（新增键 `'sectors-frontier-2026-09-27'`）、`src/pages/sectors.js:30`（改用新键）
- Test: `tests/sectorsFrontierSnapshot0927.test.js`

**Interfaces:**
- Consumes: `validateSnapshot(data): string[]`（`src/sectors/frontier/frontier-core.mjs`）
- Produces: 模型 id：`opus55-max`（新增）、`grok47-xhigh`（替换 `grok-xhigh`），其余 13 个 id 不变；共 15 个模型 × 12 项指标

- [ ] **Step 1: 当天重新核对数据（研究步骤，结果写进 Step 3 的 PATCH）**

在浏览器打开以下页面，逐项记录 12 项指标（`intelligence, briefcase, gdpval, automation, terminal, scicode, hle, gdp_pdf, critpt, omniscience, lcr, cost_task`），外加价格（input/output/cache_read）、上下文长度。页面上没有的项记 `null`：
- https://artificialanalysis.ai/models/claude-opus-5-5 （找不到就在 https://artificialanalysis.ai/leaderboards/models 搜 "Opus 5.5"，把实际 URL 记为 `AA-OPUS55`）
- https://www.anthropic.com/claude-opus-5-5 （价格、上下文、发布日期）
- https://artificialanalysis.ai/leaderboards/models （Grok 4.7 xhigh 一行；实际模型页 URL 记为 `AA-GROK47`）
- https://www.marktechpost.com/2026/09/21/spacexai-releases-grok-4-7/

研究底稿值（仅作核对参照）：
- Opus 5.5 max：intelligence 58，价格 $4/$20
- Grok 4.7 xhigh：intelligence 46，cost_task 3.74，价格 $2/$6，上下文 500000

执行当天的实测值与底稿不一致时，以实测为准。

- [ ] **Step 2: 写失败测试**

```js
// tests/sectorsFrontierSnapshot0927.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateSnapshot } from '../src/sectors/frontier/frontier-core.mjs';

const snap = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const obs = (m, k) => snap.observations.find((o) => o.model_id === m && o.metric_id === k)?.value;

describe('frontier snapshot 2026-09-27', () => {
  it('passes the existing schema validator', () => expect(validateSnapshot(snap)).toEqual([]));
  it('has 15 models and one observation per model × metric', () => {
    expect(snap.models).toHaveLength(15);
    expect(snap.observations).toHaveLength(15 * snap.metrics.length);
  });
  it('adds Opus 5.5 and replaces Grok 4.6 with Grok 4.7', () => {
    expect(obs('opus55-max', 'intelligence')).toBeGreaterThanOrEqual(50);
    expect(snap.models.some((m) => m.id === 'grok-xhigh')).toBe(false);
    expect(snap.models.find((m) => m.id === 'grok47-xhigh').name).toBe('Grok 4.7');
  });
  it('keeps the 2026-09-23 file untouched as history', () => {
    const old = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-23.json', 'utf8'));
    expect(old.snapshot_id).toBe('frontier-selected-2026-09-23');
  });
});
```

- [ ] **Step 3: 写生成脚本（PATCH 中的数值用 Step 1 的实测值）**

```js
// scripts/build-frontier-2026-09-27.mjs
// Derives the 09-27 snapshot from 09-23 so the diff stays reviewable.
import { readFileSync, writeFileSync } from 'node:fs';
import { validateSnapshot } from '../src/sectors/frontier/frontier-core.mjs';

const DATE = '2026-09-27';
const base = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-23.json', 'utf8'));
const METRICS = base.metrics.map((m) => m.id);

// Values below: record from Task 2 Step 1 on execution day. null = not published.
const PATCH = {
  add: {
    model: {
      id: 'opus55-max', name: 'Claude Opus 5.5', lab: 'Anthropic', lab_geography: 'US',
      configuration: 'max', open_weights: false, license: null, total_parameters_b: null,
      context_tokens: 1000000, declared_input_modalities: ['text', 'image'],
      status: 'reported_snapshot', source_ids: ['AA-OPUS55', 'ANT-OPUS55'],
      prices: { currency: 'USD', per_tokens: 1000000, input: 4, output: 20, cache_read: null, cache_write: null,
        as_of: DATE, source_ids: ['ANT-OPUS55'], note: 'Published reference rate, not a guaranteed quote.' },
    },
    values: { intelligence: 58, briefcase: null, gdpval: null, automation: null, terminal: null, scicode: null,
      hle: null, gdp_pdf: null, critpt: null, omniscience: null, lcr: null, cost_task: null },
  },
  replace: {
    from: 'grok-xhigh',
    model: { id: 'grok47-xhigh', name: 'Grok 4.7', source_ids: ['AA-GROK47'],
      prices: { input: 2, output: 6, as_of: DATE, source_ids: ['AA-GROK47'] } },
    values: { intelligence: 46, cost_task: 3.74 },
  },
  sources: [
    { id: 'AA-OPUS55', title: 'Claude Opus 5.5 — Artificial Analysis', url: 'https://artificialanalysis.ai/models/claude-opus-5-5' },
    { id: 'ANT-OPUS55', title: 'Claude Opus 5.5', url: 'https://www.anthropic.com/claude-opus-5-5' },
    { id: 'AA-GROK47', title: 'Grok 4.7 — Artificial Analysis', url: 'https://artificialanalysis.ai/leaderboards/models' },
  ],
};

const obsFor = (modelId, values, sourceIds) => METRICS.map((metric_id) => ({
  model_id: modelId, metric_id, cohort_id: base.cohorts[0].id,
  protocol_id: base.observations.find((o) => o.metric_id === metric_id).protocol_id,
  value: values[metric_id] ?? null, unit: base.metrics.find((m) => m.id === metric_id).unit,
  display_precision: base.observations.find((o) => o.metric_id === metric_id).display_precision,
  observed_on: DATE, measured_at: null, source_ids: sourceIds,
  evidence_status: 'reported_snapshot', confidence_interval: null,
  source_locator: `${modelId} / ${metric_id}`,
}));

const out = structuredClone(base);
out.snapshot_id = `frontier-selected-${DATE}`;
out.retrieved_on = DATE;
out.coverage_description = 'Selected public evaluator snapshots: 15 configurations from 11 named labs; not a full global leaderboard or a simultaneous rerun. Submetric coverage is narrower.';

const old = out.models.find((m) => m.id === PATCH.replace.from);
const replaced = { ...old, ...PATCH.replace.model, prices: { ...old.prices, ...PATCH.replace.model.prices } };
out.models = out.models.map((m) => (m.id === PATCH.replace.from ? replaced : m));
out.observations = out.observations
  .filter((o) => o.model_id !== PATCH.replace.from)
  .concat(obsFor(replaced.id, { ...Object.fromEntries(base.observations
    .filter((o) => o.model_id === PATCH.replace.from).map((o) => [o.metric_id, null])), ...PATCH.replace.values }, replaced.source_ids));

out.models.unshift(PATCH.add.model);
out.observations.push(...obsFor(PATCH.add.model.id, PATCH.add.values, PATCH.add.model.source_ids));

for (const s of PATCH.sources) out.sources.push({ publisher: 'Primary publisher identified by URL', evidence_type: 'evaluator_page',
  published_at: null, retrieved_on: DATE, extraction_method: 'manual browser read', raw_run_export_available: false, note: '', ...s });

const errors = validateSnapshot(out);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
writeFileSync(`public/data/sectors-frontier/${DATE}.json`, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${out.models.length} models, ${out.observations.length} observations`);
```

Grok 4.7 的子指标：09-23 快照里 Grok 4.6 的子指标全是 `null`，替换时一律置 `null`，只保留 `PATCH.replace.values` 中的实测项。Grok 4.6 的旧值不能沿用。

- [ ] **Step 4: 生成并接线**

```bash
node scripts/build-frontier-2026-09-27.mjs
```
Expected: `wrote 15 models, 180 observations`

修改 `scripts/validate-data.mjs`，在 09-23 那条后面复制一条，把路径改为 `2026-09-27.json`。
修改 `src/lib/fetchJson.js`，在第 61 行后加一行：
```js
  'sectors-frontier-2026-09-27': { url: '/data/sectors-frontier/2026-09-27.json', freshness: 6 * 60 * 60_000, validate: validators.sectorsFrontier },
```
修改 `src/pages/sectors.js:30`：`fetchJson('sectors-frontier-2026-09-23'` → `fetchJson('sectors-frontier-2026-09-27'`

- [ ] **Step 5: 运行测试**

Run: `npx vitest run tests/sectorsFrontierSnapshot0927.test.js tests/sectorsFrontier.test.js && npm run data:check`
Expected: 全部 PASS。旧测试如写死了"14 个模型"或"Grok 4.6"，把断言改为读快照本身的长度 / 名称，并在提交信息中列出改了哪些断言。

- [ ] **Step 6: Commit**

```bash
git add scripts/build-frontier-2026-09-27.mjs public/data/sectors-frontier/2026-09-27.json scripts/validate-data.mjs src/lib/fetchJson.js src/pages/sectors.js tests
git commit -m "data(sectors): 2026-09-27 frontier snapshot with Opus 5.5 and Grok 4.7"
```

---

### Task 3: 产业数据集 schema 与校验器

**Files:**
- Create: `src/sectors/industry/industry-core.js`
- Test: `tests/sectorsIndustryCore.test.js`

**Interfaces:**
- Produces:
  - `LAYERS: string[]` = `['labs','apps','compute','foundry','memory','network','infra','power']`（卡片 01–08 顺序）
  - `GRAPH_COLUMNS: string[]` = `['power','foundry','memory','compute','network','infra','labs','apps']`
  - `EDGE_TYPES` = `['investment','compute','chips','models','competitor']`
  - `LISTINGS` = `['listed','adr','pre_ipo','non_us','private']`
  - `FACT_STATUS` = `['official','independent','lab_claimed','reported','projection','unverified']`
  - `LAYER_LABEL: Record<layer,{en,zh}>`、`EDGE_LABEL: Record<type,{en,zh}>`、`STATUS_LABEL: Record<status,{en,zh}>`
  - `validateIndustry(data): string[]`
  - `renderable(item): boolean`

数据结构（`schema_version: 1`）：
```text
{ schema_version, snapshot_id, retrieved_on,
  companies: [{ id, ticker|null, exchange|null, listing, name:{en,zh}, country:'US'|'CN'|'TW'|'KR'|'NL'|'UK'|'IE',
                hq:{ city:{en,zh}, lat, lon }, layer, tier:1|2|3, role:{en,zh}, official_domain, source_ids? }],
  edges:     [{ id, source, target, type, as_of, amount_usd_b|null, label:{en,zh}, status, source_ids }],
  facts:     { gap:[...], dims:[...], flows:[...], ipo:[...], valuation:[...], scale:[...], rsi:[...] },
  sources:   [{ id, title, url, publisher, published_at|null }] }
```
每条 fact 都有 `{ id, status, source_ids, label:{en,zh} }`，其余字段按组各自不同（见任务 4）。

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsIndustryCore.test.js
import { describe, expect, it } from 'vitest';
import { validateIndustry, renderable } from '../src/sectors/industry/industry-core.js';

const ok = () => ({
  schema_version: 1, snapshot_id: 'industry-test', retrieved_on: '2026-09-27',
  sources: [{ id: 'S1', title: 't', url: 'https://example.com', publisher: 'p', published_at: null }],
  companies: [
    { id: 'nvda', ticker: 'NVDA', exchange: 'NASDAQ', listing: 'listed', name: { en: 'NVIDIA', zh: '英伟达' }, country: 'US',
      hq: { city: { en: 'Santa Clara', zh: '圣克拉拉' }, lat: 37.37, lon: -121.96 }, layer: 'compute', tier: 1,
      role: { en: 'GPUs', zh: 'GPU' }, official_domain: 'nvidia.com' },
    { id: 'anthropic', ticker: null, exchange: null, listing: 'pre_ipo', name: { en: 'Anthropic', zh: 'Anthropic' }, country: 'US',
      hq: { city: { en: 'San Francisco', zh: '旧金山' }, lat: 37.79, lon: -122.4 }, layer: 'labs', tier: 1,
      role: { en: 'Claude', zh: 'Claude' }, official_domain: 'anthropic.com' },
  ],
  edges: [{ id: 'e1', source: 'nvda', target: 'anthropic', type: 'investment', as_of: '2025-11-18', amount_usd_b: 10,
    label: { en: 'x', zh: 'x' }, status: 'official', source_ids: ['S1'] }],
  facts: { gap: [{ id: 'g1', status: 'independent', source_ids: ['S1'], label: { en: 'x', zh: 'x' }, value: 7 }] },
});

describe('validateIndustry', () => {
  it('accepts a well-formed dataset', () => expect(validateIndustry(ok())).toEqual([]));
  it.each([
    ['duplicate company id', (d) => d.companies.push({ ...d.companies[0] }), /duplicate/],
    ['bad tier', (d) => { d.companies[0].tier = 4; }, /tier/],
    ['listed without ticker', (d) => { d.companies[0].ticker = null; }, /ticker/],
    ['bad coordinates', (d) => { d.companies[0].hq.lat = 123; }, /coordinates/],
    ['missing zh name', (d) => { d.companies[0].name.zh = ''; }, /names/],
    ['unknown edge endpoint', (d) => { d.edges[0].target = 'nobody'; }, /endpoint/],
    ['self loop', (d) => { d.edges[0].target = 'nvda'; }, /self loop/],
    ['unknown edge type', (d) => { d.edges[0].type = 'friendship'; }, /type/],
    ['edge without sources', (d) => { d.edges[0].source_ids = []; }, /no source_ids/],
    ['edge cites unknown source', (d) => { d.edges[0].source_ids = ['NOPE']; }, /unknown source/],
    ['fact with bad status', (d) => { d.facts.gap[0].status = 'rumour'; }, /status/],
    ['source without https', (d) => { d.sources[0].url = 'http://x'; }, /https/],
  ])('rejects %s', (_, mutate, pattern) => {
    const d = ok(); mutate(d);
    expect(validateIndustry(d).join('\n')).toMatch(pattern);
  });
});

describe('renderable', () => {
  it('hides unverified items only', () => {
    expect(renderable({ status: 'unverified' })).toBe(false);
    expect(renderable({ status: 'projection' })).toBe(true);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsIndustryCore.test.js`
Expected: FAIL，找不到模块

- [ ] **Step 3: 实现**

```js
// src/sectors/industry/industry-core.js
export const LAYERS = ['labs', 'apps', 'compute', 'foundry', 'memory', 'network', 'infra', 'power'];
export const GRAPH_COLUMNS = ['power', 'foundry', 'memory', 'compute', 'network', 'infra', 'labs', 'apps'];
export const EDGE_TYPES = ['investment', 'compute', 'chips', 'models', 'competitor'];
export const LISTINGS = ['listed', 'adr', 'pre_ipo', 'non_us', 'private'];
export const FACT_STATUS = ['official', 'independent', 'lab_claimed', 'reported', 'projection', 'unverified'];

export const LAYER_LABEL = {
  labs: { en: 'Labs & platforms', zh: '实验室与平台' },
  apps: { en: 'Software & apps', zh: '软件与应用' },
  compute: { en: 'Compute chips', zh: '算力芯片' },
  foundry: { en: 'Foundry & equipment', zh: '代工与设备' },
  memory: { en: 'Memory & storage', zh: '存储' },
  network: { en: 'Networking & optics', zh: '网络与光通信' },
  infra: { en: 'Servers & neoclouds', zh: '服务器与新云' },
  power: { en: 'Power & cooling', zh: '电力与散热' },
};
export const EDGE_LABEL = {
  investment: { en: 'Investment', zh: '投资' },
  compute: { en: 'Compute & cloud', zh: '算力与云' },
  chips: { en: 'Chips, memory & tools', zh: '芯片、存储与设备' },
  models: { en: 'Model licensing', zh: '模型授权' },
  competitor: { en: 'Competition', zh: '竞争' },
};
export const STATUS_LABEL = {
  official: { en: 'Official', zh: '官方' },
  independent: { en: 'Independent', zh: '第三方' },
  lab_claimed: { en: 'Lab-claimed', zh: '实验室自报' },
  reported: { en: 'Reported', zh: '媒体报道' },
  projection: { en: 'Projection', zh: '预期' },
  unverified: { en: 'Unverified', zh: '未核验' },
};

export const renderable = (item) => item?.status !== 'unverified';

export function validateIndustry(data) {
  if (!data || data.schema_version !== 1) return ['schema_version must be 1'];
  const errors = [];
  const sources = new Set();
  for (const s of data.sources ?? []) {
    if (!s.id || sources.has(s.id)) errors.push(`source id missing or duplicate: ${s.id}`);
    sources.add(s.id);
    if (!/^https:\/\//.test(s.url ?? '')) errors.push(`source ${s.id} needs an https url`);
  }
  const cite = (where, ids) => {
    if (!Array.isArray(ids) || ids.length === 0) errors.push(`${where} has no source_ids`);
    else for (const id of ids) if (!sources.has(id)) errors.push(`${where} cites unknown source ${id}`);
  };
  const bilingual = (v) => Boolean(v?.en && v?.zh);

  const ids = new Set();
  for (const c of data.companies ?? []) {
    const w = `company ${c.id}`;
    if (!c.id || ids.has(c.id)) errors.push(`${w}: id missing or duplicate`);
    ids.add(c.id);
    if (!LAYERS.includes(c.layer)) errors.push(`${w}: unknown layer ${c.layer}`);
    if (![1, 2, 3].includes(c.tier)) errors.push(`${w}: tier must be 1, 2 or 3`);
    if (!LISTINGS.includes(c.listing)) errors.push(`${w}: unknown listing ${c.listing}`);
    if (['listed', 'adr'].includes(c.listing) && !c.ticker) errors.push(`${w}: listed company needs a ticker`);
    const { lat, lon } = c.hq ?? {};
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) errors.push(`${w}: invalid hq coordinates`);
    if (!bilingual(c.name) || !bilingual(c.hq?.city) || !bilingual(c.role)) errors.push(`${w}: needs en and zh names`);
    if (!c.official_domain) errors.push(`${w}: needs official_domain`);
    if (c.source_ids) cite(w, c.source_ids);
  }
  for (const e of data.edges ?? []) {
    const w = `edge ${e.id}`;
    if (!ids.has(e.source) || !ids.has(e.target)) errors.push(`${w}: unknown endpoint`);
    if (e.source === e.target) errors.push(`${w}: self loop`);
    if (!EDGE_TYPES.includes(e.type)) errors.push(`${w}: unknown type ${e.type}`);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(e.as_of ?? '')) errors.push(`${w}: as_of must be YYYY-MM or YYYY-MM-DD`);
    if (!bilingual(e.label)) errors.push(`${w}: needs en and zh label`);
    if (!FACT_STATUS.includes(e.status)) errors.push(`${w}: unknown status ${e.status}`);
    cite(w, e.source_ids);
  }
  for (const [group, list] of Object.entries(data.facts ?? {})) {
    for (const f of list) {
      const w = `fact ${group}/${f.id}`;
      if (!FACT_STATUS.includes(f.status)) errors.push(`${w}: unknown status ${f.status}`);
      if (!bilingual(f.label)) errors.push(`${w}: needs en and zh label`);
      cite(w, f.source_ids);
    }
  }
  return errors;
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run tests/sectorsIndustryCore.test.js`
Expected: PASS（14 项）

- [ ] **Step 5: Commit**

```bash
git add src/sectors/industry/industry-core.js tests/sectorsIndustryCore.test.js
git commit -m "feat(sectors): industry dataset schema and validator"
```

---

### Task 4: 产业数据种子、生成脚本与官方标志

**Files:**
- Create: `scripts/data/sectors-industry-seed.mjs`、`scripts/build-sectors-industry.mjs`
- Create (generated): `public/data/sectors-industry/2026-09-27.json`
- Create: `scripts/lib/svg-color.mjs`、`scripts/fetch-official-logos.mjs`、`public/assets/sectors/logos/manifest.json`
- Modify: `scripts/validate-data.mjs`（CHECKS 加一条）、`src/lib/fetchJson.js`（加键 `'sectors-industry-2026-09-27'`）
- Test: `tests/sectorsIndustryData.test.js`、`tests/sectorsLogoManifest.test.js`

**Interfaces:**
- Consumes: `validateIndustry`（任务 3）
- Produces:
  - 数据文件，公司 id 见下方种子（小写代码或名称）
  - `manifest.json`：`{ [companyId]: { file, source_url, retrieved_on, sha256, brand_color, color_basis: 'brand_guide'|'logo_file'|'fallback' } }`
  - `dominantSvgColor(svgText): string|null`

- [ ] **Step 1: 写种子文件**

事实核对规则（执行者必须遵守）：
- 每条边、每条事实在写入前都打开其来源 URL 核对原文
- 打不开，或原文与下表不符：状态改为 `unverified`（不渲染），或按原文修改数值
- 媒体只有标题可见（Bloomberg 付费墙）：状态为 `reported`

```js
// scripts/data/sectors-industry-seed.mjs
// Compact tuples → expanded by build-sectors-industry.mjs. Research date 2026-09-27; re-verify each row on execution.

// [id, ticker, exchange, listing, nameEn, nameZh, country, cityEn, cityZh, lat, lon, layer, tier, domain, roleEn, roleZh]
export const COMPANIES = [
  ['anthropic', null, null, 'pre_ipo', 'Anthropic', 'Anthropic', 'US', 'San Francisco', '旧金山', 37.79, -122.40, 'labs', 1, 'anthropic.com', 'Claude models; confidential S-1 filed June 2026', 'Claude 模型；2026 年 6 月秘密递交 S-1'],
  ['openai', null, null, 'pre_ipo', 'OpenAI', 'OpenAI', 'US', 'San Francisco', '旧金山', 37.76, -122.41, 'labs', 1, 'openai.com', 'GPT models; confidential IPO filing June 2026', 'GPT 模型；2026 年 6 月秘密递交 IPO 申请'],
  ['msft', 'MSFT', 'NASDAQ', 'listed', 'Microsoft', '微软', 'US', 'Redmond', '雷德蒙德', 47.67, -122.12, 'labs', 1, 'microsoft.com', 'Azure cloud; investor in OpenAI and Anthropic', 'Azure 云；OpenAI 与 Anthropic 的投资方'],
  ['googl', 'GOOGL', 'NASDAQ', 'listed', 'Alphabet (Google)', 'Alphabet（谷歌）', 'US', 'Mountain View', '山景城', 37.42, -122.08, 'labs', 1, 'google.com', 'Gemini, Google Cloud and TPUs', 'Gemini、谷歌云与 TPU'],
  ['amzn', 'AMZN', 'NASDAQ', 'listed', 'Amazon', '亚马逊', 'US', 'Seattle', '西雅图', 47.61, -122.33, 'labs', 1, 'aboutamazon.com', 'AWS and Trainium', 'AWS 与 Trainium 芯片'],
  ['meta', 'META', 'NASDAQ', 'listed', 'Meta', 'Meta', 'US', 'Menlo Park', '门洛帕克', 37.48, -122.15, 'labs', 2, 'meta.com', 'Muse Spark models', 'Muse Spark 模型'],
  ['orcl', 'ORCL', 'NYSE', 'listed', 'Oracle', '甲骨文', 'US', 'Austin', '奥斯汀', 30.27, -97.74, 'labs', 2, 'oracle.com', 'Stargate cloud capacity', '"星际之门"云算力'],
  ['spcx', 'SPCX', 'NASDAQ', 'listed', 'SpaceX (incl. xAI)', 'SpaceX（含 xAI）', 'US', 'Starbase', '星舰基地', 25.99, -97.16, 'labs', 2, 'spacex.com', 'Grok models, Colossus compute, Cursor', 'Grok 模型、Colossus 算力、Cursor'],
  ['baba', 'BABA', 'NYSE', 'adr', 'Alibaba', '阿里巴巴', 'CN', 'Hangzhou', '杭州', 30.27, 120.16, 'labs', 2, 'alibabagroup.com', 'Qwen models and Alibaba Cloud', '通义千问与阿里云'],
  ['bidu', 'BIDU', 'NASDAQ', 'adr', 'Baidu', '百度', 'CN', 'Beijing', '北京', 40.05, 116.30, 'labs', 3, 'baidu.com', 'Ernie models', '文心大模型'],
  ['deepseek', null, null, 'private', 'DeepSeek', '深度求索', 'CN', 'Hangzhou', '杭州', 30.25, 120.21, 'labs', 2, 'deepseek.com', 'Open-weights models; not listed', '开放权重模型；未上市'],
  ['moonshot', null, null, 'private', 'Moonshot AI', '月之暗面', 'CN', 'Beijing', '北京', 39.98, 116.31, 'labs', 3, 'moonshot.cn', 'Kimi models; not listed', 'Kimi 模型；未上市'],
  ['zhipu', null, 'HKEX', 'non_us', 'Zhipu (Z.ai)', '智谱', 'CN', 'Beijing', '北京', 39.99, 116.33, 'labs', 3, 'zhipuai.cn', 'GLM models; listed in Hong Kong', 'GLM 模型；香港上市'],
  ['minimax', null, 'HKEX', 'non_us', 'MiniMax', 'MiniMax', 'CN', 'Shanghai', '上海', 31.23, 121.47, 'labs', 3, 'minimax.io', 'MiniMax models; listed in Hong Kong', 'MiniMax 模型；香港上市'],
  ['nvda', 'NVDA', 'NASDAQ', 'listed', 'NVIDIA', '英伟达', 'US', 'Santa Clara', '圣克拉拉', 37.37, -121.96, 'compute', 1, 'nvidia.com', 'GPUs and systems', 'GPU 与整机系统'],
  ['avgo', 'AVGO', 'NASDAQ', 'listed', 'Broadcom', '博通', 'US', 'Palo Alto', '帕洛阿尔托', 37.44, -122.14, 'compute', 1, 'broadcom.com', 'Custom accelerators (TPU, OpenAI) and networking', '定制加速器（TPU、OpenAI）与网络芯片'],
  ['amd', 'AMD', 'NASDAQ', 'listed', 'AMD', 'AMD', 'US', 'Santa Clara', '圣克拉拉', 37.38, -121.96, 'compute', 2, 'amd.com', 'Instinct GPUs', 'Instinct GPU'],
  ['mrvl', 'MRVL', 'NASDAQ', 'listed', 'Marvell', '迈威尔', 'US', 'Santa Clara', '圣克拉拉', 37.38, -121.97, 'compute', 2, 'marvell.com', 'Custom silicon and optics DSPs', '定制芯片与光通信 DSP'],
  ['arm', 'ARM', 'NASDAQ', 'adr', 'Arm', 'Arm', 'UK', 'Cambridge', '剑桥', 52.20, 0.12, 'compute', 2, 'arm.com', 'CPU architecture in AI servers', 'AI 服务器 CPU 架构'],
  ['cbrs', 'CBRS', 'NASDAQ', 'listed', 'Cerebras', 'Cerebras', 'US', 'Sunnyvale', '桑尼维尔', 37.37, -122.04, 'compute', 3, 'cerebras.ai', 'Wafer-scale inference; IPO May 2026', '晶圆级推理芯片；2026 年 5 月上市'],
  ['intc', 'INTC', 'NASDAQ', 'listed', 'Intel', '英特尔', 'US', 'Santa Clara', '圣克拉拉', 37.39, -121.96, 'compute', 3, 'intel.com', 'Server CPUs and foundry', '服务器 CPU 与代工'],
  ['qcom', 'QCOM', 'NASDAQ', 'listed', 'Qualcomm', '高通', 'US', 'San Diego', '圣地亚哥', 32.90, -117.20, 'compute', 3, 'qualcomm.com', 'On-device AI chips', '端侧 AI 芯片'],
  ['tsm', 'TSM', 'NYSE', 'adr', 'TSMC', '台积电', 'TW', 'Hsinchu', '新竹', 24.78, 120.99, 'foundry', 1, 'tsmc.com', 'Leading-edge foundry for AI chips', 'AI 芯片先进制程代工'],
  ['asml', 'ASML', 'NASDAQ', 'adr', 'ASML', '阿斯麦', 'NL', 'Veldhoven', '费尔德霍芬', 51.41, 5.41, 'foundry', 1, 'asml.com', 'EUV lithography', 'EUV 光刻机'],
  ['amat', 'AMAT', 'NASDAQ', 'listed', 'Applied Materials', '应用材料', 'US', 'Santa Clara', '圣克拉拉', 37.37, -121.99, 'foundry', 2, 'appliedmaterials.com', 'Deposition and etch tools', '沉积与刻蚀设备'],
  ['lrcx', 'LRCX', 'NASDAQ', 'listed', 'Lam Research', '泛林', 'US', 'Fremont', '弗里蒙特', 37.52, -121.98, 'foundry', 2, 'lamresearch.com', 'Etch tools for memory and logic', '存储与逻辑芯片刻蚀设备'],
  ['klac', 'KLAC', 'NASDAQ', 'listed', 'KLA', '科磊', 'US', 'Milpitas', '米尔皮塔斯', 37.43, -121.91, 'foundry', 2, 'kla.com', 'Process control and inspection', '制程检测'],
  ['skhy', 'SKHY', 'NASDAQ', 'adr', 'SK hynix', 'SK 海力士', 'KR', 'Icheon', '利川', 37.27, 127.44, 'memory', 1, 'skhynix.com', 'HBM leader; ADR listed July 2026', 'HBM 龙头；2026 年 7 月 ADR 上市'],
  ['mu', 'MU', 'NASDAQ', 'listed', 'Micron', '美光', 'US', 'Boise', '博伊西', 43.62, -116.20, 'memory', 1, 'micron.com', 'HBM, DRAM and SSD', 'HBM、DRAM 与固态硬盘'],
  ['samsung', null, 'KRX', 'non_us', 'Samsung Electronics', '三星电子', 'KR', 'Suwon', '水原', 37.26, 127.03, 'memory', 1, 'samsung.com', 'HBM4 supplier; no US listing', 'HBM4 供应商；未在美上市'],
  ['sndk', 'SNDK', 'NASDAQ', 'listed', 'Sandisk', '闪迪', 'US', 'Milpitas', '米尔皮塔斯', 37.43, -121.90, 'memory', 3, 'sandisk.com', 'NAND flash', 'NAND 闪存'],
  ['wdc', 'WDC', 'NASDAQ', 'listed', 'Western Digital', '西部数据', 'US', 'San Jose', '圣何塞', 37.34, -121.89, 'memory', 3, 'westerndigital.com', 'Data-centre hard drives', '数据中心硬盘'],
  ['stx', 'STX', 'NASDAQ', 'listed', 'Seagate', '希捷', 'IE', 'Dublin', '都柏林', 53.35, -6.26, 'memory', 3, 'seagate.com', 'Data-centre hard drives', '数据中心硬盘'],
  ['anet', 'ANET', 'NYSE', 'listed', 'Arista Networks', 'Arista', 'US', 'Santa Clara', '圣克拉拉', 37.38, -121.97, 'network', 2, 'arista.com', 'AI data-centre switches', 'AI 数据中心交换机'],
  ['csco', 'CSCO', 'NASDAQ', 'listed', 'Cisco', '思科', 'US', 'San Jose', '圣何塞', 37.41, -121.95, 'network', 3, 'cisco.com', 'Networking', '网络设备'],
  ['cohr', 'COHR', 'NYSE', 'listed', 'Coherent', 'Coherent', 'US', 'Saxonburg', '萨克森堡', 40.75, -79.81, 'network', 2, 'coherent.com', 'Optical transceivers', '光模块'],
  ['lite', 'LITE', 'NASDAQ', 'listed', 'Lumentum', 'Lumentum', 'US', 'San Jose', '圣何塞', 37.34, -121.89, 'network', 2, 'lumentum.com', 'Lasers and optical components', '激光器与光器件'],
  ['crdo', 'CRDO', 'NASDAQ', 'listed', 'Credo', 'Credo', 'US', 'San Jose', '圣何塞', 37.34, -121.89, 'network', 3, 'credosemi.com', 'Active electrical cables', '有源电缆'],
  ['alab', 'ALAB', 'NASDAQ', 'listed', 'Astera Labs', 'Astera Labs', 'US', 'San Jose', '圣何塞', 37.34, -121.89, 'network', 3, 'asteralabs.com', 'PCIe/CXL connectivity', 'PCIe/CXL 互连'],
  ['cien', 'CIEN', 'NYSE', 'listed', 'Ciena', 'Ciena', 'US', 'Hanover', '汉诺威', 39.19, -76.72, 'network', 3, 'ciena.com', 'Data-centre interconnect', '数据中心互联'],
  ['dell', 'DELL', 'NYSE', 'listed', 'Dell Technologies', '戴尔', 'US', 'Round Rock', '朗德罗克', 30.51, -97.68, 'infra', 2, 'dell.com', 'AI servers', 'AI 服务器'],
  ['smci', 'SMCI', 'NASDAQ', 'listed', 'Supermicro', '超微电脑', 'US', 'San Jose', '圣何塞', 37.37, -121.92, 'infra', 2, 'supermicro.com', 'AI servers', 'AI 服务器'],
  ['crwv', 'CRWV', 'NASDAQ', 'listed', 'CoreWeave', 'CoreWeave', 'US', 'Livingston', '利文斯顿', 40.79, -74.31, 'infra', 2, 'coreweave.com', 'GPU cloud', 'GPU 云'],
  ['nbis', 'NBIS', 'NASDAQ', 'listed', 'Nebius', 'Nebius', 'NL', 'Amsterdam', '阿姆斯特丹', 52.37, 4.90, 'infra', 3, 'nebius.com', 'GPU cloud', 'GPU 云'],
  ['vrt', 'VRT', 'NYSE', 'listed', 'Vertiv', '维谛', 'US', 'Westerville', '韦斯特维尔', 40.13, -82.93, 'power', 2, 'vertiv.com', 'Power and liquid cooling', '供电与液冷'],
  ['gev', 'GEV', 'NYSE', 'listed', 'GE Vernova', 'GE Vernova', 'US', 'Cambridge, MA', '剑桥（马萨诸塞）', 42.37, -71.11, 'power', 2, 'gevernova.com', 'Gas turbines and grid equipment', '燃气轮机与电网设备'],
  ['ceg', 'CEG', 'NASDAQ', 'listed', 'Constellation Energy', '星座能源', 'US', 'Baltimore', '巴尔的摩', 39.29, -76.61, 'power', 2, 'constellationenergy.com', 'Nuclear power for data centres', '为数据中心供应核电'],
  ['vst', 'VST', 'NYSE', 'listed', 'Vistra', 'Vistra', 'US', 'Irving', '欧文', 32.81, -96.95, 'power', 3, 'vistracorp.com', 'Power generation', '发电'],
  ['etn', 'ETN', 'NYSE', 'listed', 'Eaton', '伊顿', 'IE', 'Dublin', '都柏林', 53.35, -6.26, 'power', 3, 'eaton.com', 'Electrical equipment', '电气设备'],
  ['oklo', 'OKLO', 'NYSE', 'listed', 'Oklo', 'Oklo', 'US', 'Santa Clara', '圣克拉拉', 37.35, -121.95, 'power', 3, 'oklo.com', 'Small modular reactors', '小型模块化反应堆'],
  ['pltr', 'PLTR', 'NASDAQ', 'listed', 'Palantir', 'Palantir', 'US', 'Denver', '丹佛', 39.74, -104.99, 'apps', 3, 'palantir.com', 'AI platforms for enterprise and government', '面向企业与政府的 AI 平台'],
  ['crm', 'CRM', 'NYSE', 'listed', 'Salesforce', 'Salesforce', 'US', 'San Francisco', '旧金山', 37.79, -122.40, 'apps', 3, 'salesforce.com', 'Enterprise AI agents', '企业 AI 智能体'],
  ['now', 'NOW', 'NYSE', 'listed', 'ServiceNow', 'ServiceNow', 'US', 'Santa Clara', '圣克拉拉', 37.40, -121.98, 'apps', 3, 'servicenow.com', 'Workflow AI', '工作流 AI'],
  ['snow', 'SNOW', 'NYSE', 'listed', 'Snowflake', 'Snowflake', 'US', 'Bozeman', '博兹曼', 45.68, -111.04, 'apps', 3, 'snowflake.com', 'Data platform', '数据平台'],
  ['adbe', 'ADBE', 'NASDAQ', 'listed', 'Adobe', 'Adobe', 'US', 'San Jose', '圣何塞', 37.33, -121.89, 'apps', 3, 'adobe.com', 'Creative AI', '创意 AI'],
];

// [id, source, target, type, as_of, amountUsdB|null, status, labelEn, labelZh, sourceIds]
export const EDGES = [
  ['spcx-ant-colossus', 'spcx', 'anthropic', 'compute', '2026-05-06', null, 'official', 'All of Colossus 1 (Memphis): >300 MW, >220,000 NVIDIA GPUs', 'Colossus 1（孟菲斯）整体供给：300 MW 以上、22 万块以上 NVIDIA GPU', ['ANT-SPACEX', 'XAI-ANT']],
  ['ant-spcx-pay', 'anthropic', 'spcx', 'compute', '2026-05-20', 40, 'reported', 'Anthropic pays $1.25B a month to May 2029 (>$40B); 90-day exit for either side', 'Anthropic 每月支付 12.5 亿美元至 2029 年 5 月（总额超过 400 亿）；双方均可提前 90 天退出', ['TC-ANT-SPACEX']],
  ['ant-spcx-rival', 'anthropic', 'spcx', 'competitor', '2026-01-12', null, 'reported', 'Claude vs Grok; Anthropic cut xAI’s Claude access via Cursor, which SpaceX later bought for $60B', 'Claude 对 Grok；Anthropic 切断了 xAI 经 Cursor 使用 Claude 的权限，SpaceX 随后以 600 亿美元收购 Cursor', ['RUNDOWN-XAI', 'CNBC-CURSOR']],
  ['googl-ant-invest', 'googl', 'anthropic', 'investment', '2026-04-24', 40, 'reported', 'Up to $40B: $10B now at a $350B valuation, $30B on milestones; 5 GW of Google Cloud', '最多 400 亿美元：先投 100 亿（估值 3500 亿），300 亿按里程碑；另含 5 GW 谷歌云算力', ['TC-GOOG-ANT']],
  ['googl-ant-tpu', 'googl', 'anthropic', 'compute', '2025-10-23', null, 'official', 'Up to 1M TPUs, over 1 GW', '最多 100 万块 TPU，超过 1 GW', ['CNBC-TPU']],
  ['avgo-ant-tpu', 'avgo', 'anthropic', 'chips', '2026-04-06', null, 'official', 'Multi-gigawatt next-generation TPU capacity from 2027 (with Google)', '与谷歌合作，自 2027 年起提供数 GW 下一代 TPU 算力', ['ANT-AVGO']],
  ['googl-ant-rival', 'googl', 'anthropic', 'competitor', '2026-09', null, 'independent', 'Gemini competes with Claude on the same leaderboards', 'Gemini 与 Claude 在同一榜单上竞争', ['AA-BOARD']],
  ['amzn-ant-invest', 'amzn', 'anthropic', 'investment', '2026-04-20', 25, 'official', '$5B now plus up to $20B more, on top of $8B earlier', '先投 50 亿，追加最多 200 亿，此前已投 80 亿', ['ANT-AMZN']],
  ['amzn-ant-cloud', 'amzn', 'anthropic', 'compute', '2026-04-20', 100, 'official', '>$100B on AWS over 10 years; up to 5 GW Trainium incl. Project Rainier', '10 年在 AWS 投入超过 1000 亿；最多 5 GW Trainium，含 Project Rainier', ['ANT-AMZN']],
  ['msft-ant-invest', 'msft', 'anthropic', 'investment', '2025-11-18', 5, 'official', 'Microsoft invests $5B', '微软投资 50 亿美元', ['GEEKWIRE-MSFT-ANT']],
  ['nvda-ant-invest', 'nvda', 'anthropic', 'investment', '2025-11-18', 10, 'official', 'NVIDIA invests up to $10B and co-designs chips', 'NVIDIA 投资最多 100 亿美元，并合作芯片设计', ['CNBC-MSFT-ANT']],
  ['msft-ant-azure', 'msft', 'anthropic', 'compute', '2025-11-18', 30, 'official', '$30B Azure commitment; Claude in Foundry and Copilot', '承诺在 Azure 投入 300 亿美元；Claude 进入 Foundry 与 Copilot', ['GEEKWIRE-MSFT-ANT']],
  ['mu-ant-invest', 'mu', 'anthropic', 'investment', '2026-06-23', null, 'official', 'Micron invests in Series H', '美光参与 H 轮投资', ['MU-ANT', 'BLOCKS-MU']],
  ['mu-ant-memory', 'mu', 'anthropic', 'chips', '2026-06-23', null, 'official', 'HBM, DRAM and SSD supply agreement', 'HBM、DRAM 与固态硬盘供应协议', ['MU-ANT']],
  ['msft-oai-invest', 'msft', 'openai', 'investment', '2025-10-28', null, 'reported', 'Microsoft holds about 27% after OpenAI’s restructuring', 'OpenAI 重组后微软持股约 27%', ['CNBC-OAI-PBC']],
  ['msft-oai-azure', 'msft', 'openai', 'compute', '2025-10-28', 250, 'reported', 'OpenAI commits $250B to Azure', 'OpenAI 承诺在 Azure 投入 2500 亿美元', ['CNBC-OAI-PBC']],
  ['orcl-oai-stargate', 'orcl', 'openai', 'compute', '2025-07', null, 'official', 'Stargate: 4.5 GW partnership', '"星际之门"：4.5 GW 合作', ['OAI-ORCL']],
  ['nvda-oai-chips', 'nvda', 'openai', 'chips', '2025-09-22', null, 'official', '10 GW letter of intent', '10 GW 意向书', ['OAI-NVDA']],
  ['nvda-oai-invest', 'nvda', 'openai', 'investment', '2026-03-04', 30, 'reported', 'About $30B in OpenAI’s round, scaled back from “up to $100B”', '在 OpenAI 本轮融资中投资约 300 亿美元，低于此前"最多 1000 亿"的意向', ['CNBC-NVDA-OAI']],
  ['amd-oai-chips', 'amd', 'openai', 'chips', '2025-10-06', null, 'official', '6 GW of Instinct GPUs; warrant for up to 160M AMD shares', '6 GW Instinct GPU；可认购最多 1.6 亿股 AMD 股票', ['AMD-OAI']],
  ['avgo-oai-chips', 'avgo', 'openai', 'chips', '2025-10-13', null, 'official', '10 GW of custom accelerators', '10 GW 定制加速器', ['OAI-AVGO']],
  ['crwv-oai-compute', 'crwv', 'openai', 'compute', '2025-09-25', 22.4, 'official', 'About $22.4B in total contracts', '合同总额约 224 亿美元', ['CRWV-OAI']],
  ['amzn-oai-cloud', 'amzn', 'openai', 'compute', '2025-11-03', 38, 'reported', '$38B AWS agreement', '380 亿美元 AWS 协议', ['TIPRANKS-AMZN-OAI']],
  ['cbrs-oai-compute', 'cbrs', 'openai', 'compute', '2026-01-14', 10, 'reported', '>$10B, about 750 MW through 2028', '超过 100 亿美元，至 2028 年约 750 MW', ['CNBC-CBRS']],
  ['oai-ant-rival', 'openai', 'anthropic', 'competitor', '2026-09', null, 'independent', 'GPT-6 Astra vs Claude on the same index', 'GPT-6 Astra 与 Claude 在同一指数上竞争', ['AA-BOARD']],
  ['oai-googl-rival', 'openai', 'googl', 'competitor', '2026-09', null, 'independent', 'GPT vs Gemini', 'GPT 对 Gemini', ['AA-BOARD']],
  ['oai-spcx-rival', 'openai', 'spcx', 'competitor', '2026-09', null, 'independent', 'GPT vs Grok', 'GPT 对 Grok', ['AA-BOARD']],
  ['googl-meta-tpu', 'googl', 'meta', 'compute', '2026-02-26', null, 'reported', 'Multibillion-dollar TPU rental deal', '数十亿美元 TPU 租用协议', ['SILICON-GOOG-META']],
  ['tsm-nvda-foundry', 'tsm', 'nvda', 'chips', '2025-10', null, 'official', 'Blackwell wafers, including in Arizona', 'Blackwell 晶圆，含亚利桑那工厂', ['DCD-TSMC-AZ']],
  ['asml-tsm-euv', 'asml', 'tsm', 'chips', '2026-09-08', null, 'reported', 'EUV and High-NA EUV tools', 'EUV 与高数值孔径 EUV 光刻机', ['CNBC-HIGHNA']],
  ['skhy-nvda-hbm', 'skhy', 'nvda', 'chips', '2026', null, 'reported', 'HBM4 for Vera Rubin', '为 Vera Rubin 供应 HBM4', ['INVESTING-HBM4']],
  ['mu-nvda-hbm', 'mu', 'nvda', 'chips', '2026-03-16', null, 'official', 'HBM4 for Vera Rubin in volume production', '为 Vera Rubin 量产 HBM4', ['MU-HBM', 'INVESTING-HBM4']],
  ['samsung-nvda-hbm', 'samsung', 'nvda', 'chips', '2026', null, 'reported', 'HBM4 for Vera Rubin', '为 Vera Rubin 供应 HBM4', ['INVESTING-HBM4']],
  ['nvda-crwv-invest', 'nvda', 'crwv', 'investment', '2026-01-26', 2, 'reported', 'NVIDIA invests $2B', 'NVIDIA 投资 20 亿美元', ['CNBC-NVDA-CRWV']],
  ['nbis-msft-compute', 'nbis', 'msft', 'compute', '2025-09', 17.4, 'reported', '$17.4–19.4B GPU capacity contract', '174–194 亿美元 GPU 算力合同', ['FOOL-NBIS']],
  ['nbis-meta-compute', 'nbis', 'meta', 'compute', '2026-04', 27, 'reported', 'Up to $27B GPU capacity', '最多 270 亿美元 GPU 算力', ['FOOL-NBIS']],
  ['nvda-spcx-gpus', 'nvda', 'spcx', 'chips', '2026-05', null, 'official', 'GPUs for Colossus', '为 Colossus 供应 GPU', ['ANT-SPACEX']],
  ['moonshot-spcx-kimi', 'moonshot', 'spcx', 'models', '2026-03-22', null, 'reported', 'Cursor’s Composer 2 was built on Kimi K2.5 (before SpaceX bought Cursor)', 'Cursor 的 Composer 2 基于 Kimi K2.5（在 SpaceX 收购 Cursor 之前）', ['TC-CURSOR-KIMI']],
  ['ant-baba-rival', 'anthropic', 'baba', 'competitor', '2026-09-10', null, 'reported', 'Anthropic names Alibaba in a distillation report (151M exchanges)', 'Anthropic 在蒸馏报告中点名阿里巴巴（1.51 亿次交互）', ['TC-DISTILL']],
  ['ant-moonshot-rival', 'anthropic', 'moonshot', 'competitor', '2026-09-10', null, 'reported', 'Named in the same distillation report', '在同一份蒸馏报告中被点名', ['TC-DISTILL']],
  ['ant-deepseek-rival', 'anthropic', 'deepseek', 'competitor', '2026-09-10', null, 'reported', 'Named in the same distillation report', '在同一份蒸馏报告中被点名', ['TC-DISTILL']],
];

export const FACTS = {
  gap: [
    { id: 'epoch', value: 7, low: 4, high: 14, unit: 'months', status: 'independent', source_ids: ['EPOCH-GAP'], label: { en: 'Epoch AI: average lag since 2023', zh: 'Epoch AI：2023 年以来平均落后' } },
    { id: 'caisi', value: 8, unit: 'months', status: 'official', source_ids: ['NIST-CAISI'], label: { en: 'NIST CAISI: DeepSeek V4 Pro vs leading US models', zh: 'NIST CAISI：DeepSeek V4 Pro 对比美国领先模型' } },
    { id: 'mozilla', value: 4.4, unit: 'months', status: 'reported', source_ids: ['MOZILLA-OSAI'], label: { en: 'Mozilla: Chinese open weights vs US closed models', zh: 'Mozilla：中国开放权重对比美国闭源模型' } },
  ],
  dims: [
    { id: 'gpu_share', us: 75, cn: 15, unit: 'pct', better: 'higher', status: 'independent', source_ids: ['EPOCH-GPU'], label: { en: 'Share of global GPU-cluster performance', zh: '全球 GPU 集群算力份额' } },
    { id: 'private_invest', us: 285.9, cn: 12.4, unit: 'usd_b', better: 'higher', status: 'independent', source_ids: ['STANFORD-2026'], label: { en: 'Private AI investment, 2025', zh: '2025 年私人 AI 投资' } },
    { id: 'capex', us: 764, cn: 102, unit: 'usd_b', better: 'higher', status: 'reported', source_ids: ['ALJ-4CHARTS'], label: { en: 'Hyperscaler capex, 2026', zh: '2026 年超大规模云厂商资本开支' } },
    { id: 'robots', us: 34200, cn: 295000, unit: 'count', better: 'higher', status: 'independent', source_ids: ['STANFORD-2026'], label: { en: 'Industrial robots installed', zh: '工业机器人装机量' } },
    { id: 'papers', us: 12.6, cn: 23.2, unit: 'pct', better: 'higher', status: 'independent', source_ids: ['STANFORD-2026'], label: { en: 'Share of AI publications', zh: 'AI 论文份额' } },
  ],
  shares: [
    { id: 'hf', geo: 'CN', value: 41, unit: 'pct', status: 'reported', source_ids: ['HF-41'], label: { en: 'Chinese share of Hugging Face downloads (past year)', zh: '过去一年 Hugging Face 下载量中国份额' } },
    { id: 'openrouter', geo: 'CN', value: 46, unit: 'pct', status: 'reported', source_ids: ['CNBC-OPENROUTER'], label: { en: 'Peak weekly OpenRouter token share, Chinese models', zh: '中国模型在 OpenRouter 的单周 token 份额峰值' } },
  ],
  flows: [
    { id: 'h200', from: 'US', to: 'CN', friction: true, status: 'official', source_ids: ['MORGAN-BIS'], label: { en: 'H200-class chips: case-by-case licences, capped at 50% of US volume', zh: 'H200 级芯片：个案许可，上限为美国销量的 50%' } },
    { id: 'h200-first', from: 'US', to: 'CN', friction: false, status: 'reported', source_ids: ['TNW-H200'], label: { en: 'First H200s arrived in the July quarter; NVIDIA guides to zero China data-centre revenue', zh: '首批 H200 于 7 月季度到货；NVIDIA 指引按零中国数据中心收入计' } },
    { id: 'hbm', from: 'US', to: 'CN', friction: true, status: 'independent', source_ids: ['SEMI-HUAWEI'], label: { en: 'HBM is China’s bottleneck after the December 2024 ban', zh: '2024 年 12 月禁令后，HBM 成为中国的瓶颈' } },
    { id: 'distill', from: 'US', to: 'CN', friction: true, status: 'reported', source_ids: ['TC-DISTILL'], label: { en: 'Anthropic reports ~200M distillation exchanges in five campaigns', zh: 'Anthropic 报告五次蒸馏行动、约 2 亿次交互' } },
    { id: 'rare-earths', from: 'CN', to: 'US', friction: true, status: 'reported', source_ids: ['TECHTIMES-RE'], label: { en: 'Seven heavy rare earths still under licence; yttrium to the US fell from ~333 t to 17 t', zh: '7 种重稀土仍需许可；对美钇出口从约 333 吨降至 17 吨' } },
    { id: 'qcom', from: 'CN', to: 'US', friction: false, status: 'reported', source_ids: ['LR-QCOM'], label: { en: 'China was 46% of Qualcomm’s FY2025 revenue', zh: '中国占高通 2025 财年营收的 46%' } },
    { id: 'apple', from: 'CN', to: 'US', friction: false, status: 'reported', source_ids: ['TL-APPLE'], label: { en: 'Greater China: $18.8B of Apple’s fiscal Q3 2026 revenue', zh: '大中华区：苹果 2026 财年第三季度营收 188 亿美元' } },
    { id: 'airbnb', from: 'CN', to: 'US', friction: false, status: 'reported', source_ids: ['FORBES-AIRBNB'], label: { en: 'Airbnb’s service agent runs on Qwen', zh: 'Airbnb 客服智能体使用通义千问' } },
    { id: 'cursor', from: 'CN', to: 'US', friction: false, status: 'reported', source_ids: ['TC-CURSOR-KIMI'], label: { en: 'Cursor Composer 2 built on Kimi K2.5', zh: 'Cursor Composer 2 基于 Kimi K2.5' } },
  ],
  ipo: [
    { id: 'aramco', year: 2019, raised_usd_b: 29.4, status: 'official', source_ids: ['WIKI-SPACEX-IPO'], label: { en: 'Saudi Aramco', zh: '沙特阿美' } },
    { id: 'spacex', year: 2026, raised_usd_b: 86, valuation_usd_b: 1750, status: 'reported', source_ids: ['NPR-SPACEX', 'WIKI-SPACEX-IPO'], label: { en: 'SpaceX (priced 11 June 2026)', zh: 'SpaceX（2026 年 6 月 11 日定价）' } },
    { id: 'anthropic', year: 2026, raised_usd_b: 100, valuation_usd_b: 2000, status: 'projection', source_ids: ['YAHOO-ANT-2T'], label: { en: 'Anthropic (reported target, not priced)', zh: 'Anthropic（报道目标，未定价）' } },
  ],
  valuation: [
    { id: 'ant-g', company: 'anthropic', date: '2026-02', usd_b: 380, status: 'reported', source_ids: ['FOOL-ANT-130'], label: { en: 'Series G', zh: 'G 轮' } },
    { id: 'ant-h', company: 'anthropic', date: '2026-05-28', usd_b: 965, status: 'reported', source_ids: ['FORTUNE-ANT-S1'], label: { en: 'Series H', zh: 'H 轮' } },
    { id: 'ant-ipo', company: 'anthropic', date: '2026-10', usd_b: 2000, status: 'projection', source_ids: ['YAHOO-ANT-2T'], label: { en: 'Reported IPO target', zh: '报道的 IPO 目标' } },
    { id: 'oai-mar', company: 'openai', date: '2026-03', usd_b: 852, status: 'reported', source_ids: ['FORBES-OAI-IPO'], label: { en: 'March 2026 round', zh: '2026 年 3 月融资' } },
  ],
  scale: [
    { id: 'ant-rev', company: 'anthropic', usd_b: 65, date: '2026-07', status: 'reported', source_ids: ['TC-ANT-65'], label: { en: 'Annualised revenue', zh: '年化收入' } },
    { id: 'oai-rev', company: 'openai', usd_b: 40, date: '2026-08', status: 'reported', source_ids: ['BLOOM-OAI-40'], label: { en: 'Annualised revenue', zh: '年化收入' } },
  ],
  rsi: [
    { id: 'speedup', value: 52, unit: 'x', status: 'lab_claimed', source_ids: ['ANT-RSI'], label: { en: 'Claude speed-up on code-optimisation tasks (≈3× in 2025)', zh: 'Claude 在代码优化任务上的提速（2025 年约 3 倍）' } },
    { id: 'w2s', value: 97, unit: 'pct', status: 'lab_claimed', source_ids: ['ANT-RSI'], label: { en: 'Weak-to-strong gap recovered on open research problems', zh: '开放研究问题上恢复的弱到强差距' } },
    { id: 'doubling', value: 4, unit: 'months', status: 'lab_claimed', source_ids: ['ANT-RSI'], label: { en: 'Task-length doubling time', zh: '任务长度翻倍时间' } },
    { id: 'critics', value: null, unit: null, status: 'reported', source_ids: ['SCIAM-RSI'], label: { en: 'Critics call the RSI warning hype timed to the IPO', zh: '批评者认为 RSI 警告是配合 IPO 的炒作' } },
  ],
};

// [id, title, url, publisher, publishedAt]
export const SOURCES = [
  ['ANT-SPACEX', 'Higher limits with SpaceX compute', 'https://www.anthropic.com/news/higher-limits-spacex', 'Anthropic', '2026-05-06'],
  ['XAI-ANT', 'Anthropic compute partnership', 'https://x.ai/news/anthropic-compute-partnership', 'xAI', '2026-05-06'],
  ['TC-ANT-SPACEX', 'Anthropic will pay xAI $1.25B per month for compute', 'https://techcrunch.com/2026/05/20/anthropic-will-pay-xai-1-25-billion-per-month-for-compute/', 'TechCrunch', '2026-05-20'],
  ['RUNDOWN-XAI', 'Anthropic pulls plug on xAI’s Claude access', 'https://www.therundown.ai/p/anthropic-pulls-plug-on-xais-claude-access', 'The Rundown', '2026-01-12'],
  ['CNBC-CURSOR', 'SpaceX to acquire Cursor', 'https://www.cnbc.com/2026/06/16/spacex-spcx-cursor-acquisition-ipo.html', 'CNBC', '2026-06-16'],
  ['TC-GOOG-ANT', 'Google to invest up to $40B in Anthropic', 'https://techcrunch.com/2026/04/24/google-to-invest-up-to-40b-in-anthropic-in-cash-and-compute/', 'TechCrunch', '2026-04-24'],
  ['CNBC-TPU', 'Anthropic–Google Cloud TPU deal', 'https://www.cnbc.com/2025/10/23/anthropic-google-cloud-deal-tpu.html', 'CNBC', '2025-10-23'],
  ['ANT-AVGO', 'Google and Broadcom partnership for compute', 'https://www.anthropic.com/news/google-broadcom-partnership-compute', 'Anthropic', '2026-04-06'],
  ['AA-BOARD', 'LLM leaderboard', 'https://artificialanalysis.ai/leaderboards/models', 'Artificial Analysis', null],
  ['ANT-AMZN', 'Anthropic and Amazon compute', 'https://www.anthropic.com/news/anthropic-amazon-compute', 'Anthropic', '2026-04-20'],
  ['GEEKWIRE-MSFT-ANT', 'Microsoft to invest $5B in Anthropic', 'https://www.geekwire.com/2025/microsoft-to-invest-5b-in-anthropic-as-claude-maker-commits-30b-to-azure-in-new-nvidia-alliance/', 'GeekWire', '2025-11-18'],
  ['CNBC-MSFT-ANT', 'Anthropic, Microsoft and NVIDIA alliance', 'https://www.cnbc.com/2025/11/18/anthropic-ai-azure-microsoft-nvidia.html', 'CNBC', '2025-11-18'],
  ['MU-ANT', 'Micron and Anthropic strategic agreement', 'https://investors.micron.com/news/press-release/2026/Micron-and-Anthropic-Announce-Strategic-Agreement-to-Scale-Next-Generation-AI-Infrastructure/default.aspx', 'Micron', '2026-06-23'],
  ['BLOCKS-MU', 'Micron invests in Anthropic', 'https://www.blocksandfiles.com/ai-ml/2026/06/23/micron-invests-in-anthropic-and-grants-it-a-supply-deal/5260050', 'Blocks & Files', '2026-06-23'],
  ['MU-HBM', 'Micron HBM4 for Vera Rubin', 'https://investors.micron.com/news/press-release/2026/Micron-in-High-Volume-Production-of-HBM4-Designed-for-NVIDIA-Vera-Rubin-PCIe-Gen6-SSD-and-SOCAMM2-03-16-2026/default.aspx', 'Micron', '2026-03-16'],
  ['CNBC-OAI-PBC', 'OpenAI completes for-profit restructuring', 'https://www.cnbc.com/2025/10/28/open-ai-for-profit-microsoft.html', 'CNBC', '2025-10-28'],
  ['OAI-ORCL', 'Stargate advances with Oracle', 'https://openai.com/index/stargate-advances-with-partnership-with-oracle/', 'OpenAI', null],
  ['OAI-NVDA', 'OpenAI–NVIDIA systems partnership', 'https://openai.com/index/openai-nvidia-systems-partnership/', 'OpenAI', '2025-09-22'],
  ['CNBC-NVDA-OAI', 'Huang on NVIDIA’s OpenAI investment', 'https://www.cnbc.com/2026/03/04/nvidia-huang-openai-investment.html', 'CNBC', '2026-03-04'],
  ['AMD-OAI', 'AMD and OpenAI 6 GW partnership', 'https://ir.amd.com/news-events/press-releases/detail/1260/amd-and-openai-announce-strategic-partnership-to-deploy-6-gigawatts-of-amd-gpus', 'AMD', '2025-10-06'],
  ['OAI-AVGO', 'OpenAI–Broadcom inference chip', 'https://openai.com/index/openai-broadcom-jalapeno-inference-chip/', 'OpenAI', null],
  ['CRWV-OAI', 'CoreWeave expands agreement with OpenAI', 'https://investors.coreweave.com/news/news-details/2025/CoreWeave-Expands-Agreement-with-OpenAI-by-up-to-6-5B/default.aspx', 'CoreWeave', '2025-09-25'],
  ['TIPRANKS-AMZN-OAI', 'OpenAI secures $38B AWS deal', 'https://www.tipranks.com/news/private-companies/openai-secures-38-billion-aws-deal-to-scale-ai-infrastructure', 'TipRanks', '2025-11-03'],
  ['CNBC-CBRS', 'Cerebras scores OpenAI deal', 'https://www.cnbc.com/2026/01/14/cerebras-scores-openai-deal-worth-over-10-billion.html', 'CNBC', '2026-01-14'],
  ['SILICON-GOOG-META', 'Google and Meta TPU deal', 'https://siliconangle.com/2026/02/26/google-meta-reportedly-strike-new-multibillion-dollar-ai-chip-deal/', 'SiliconANGLE', '2026-02-26'],
  ['DCD-TSMC-AZ', 'First US-made Blackwell wafer', 'https://www.datacenterdynamics.com/en/news/first-us-made-nvidia-blackwell-wafer-manufactured-at-tsmcs-arizona-fab/', 'DCD', null],
  ['CNBC-HIGHNA', 'TSMC, Samsung and ASML High-NA EUV', 'https://www.cnbc.com/2026/09/08/tsmc-samsung-asml-high-na-euv-machine-ai-chips.html', 'CNBC', '2026-09-08'],
  ['INVESTING-HBM4', 'NVIDIA certifies three HBM4 suppliers', 'https://www.investing.com/news/stock-market-news/nvidia-certifies-samsung-sk-hynix-and-micron-for-vera-rubin-hbm4-supply-4728612', 'Investing.com', null],
  ['CNBC-NVDA-CRWV', 'NVIDIA invests in CoreWeave', 'https://www.cnbc.com/2026/01/26/3coreweave-nvidia-stock-ai-data-centers.html', 'CNBC', '2026-01-26'],
  ['FOOL-NBIS', 'Nebius signs $46B in AI cloud deals', 'https://www.fool.com/investing/2026/04/02/nebius-just-signed-46-billion-in-ai-cloud-deals-wi/', 'Motley Fool', '2026-04-02'],
  ['TC-CURSOR-KIMI', 'Cursor’s model built on Kimi', 'https://techcrunch.com/2026/03/22/cursor-admits-its-new-coding-model-was-built-on-top-of-moonshot-ais-kimi', 'TechCrunch', '2026-03-22'],
  ['TC-DISTILL', 'Anthropic details distillation campaigns', 'https://techcrunch.com/2026/09/10/anthropic-details-distillation-campaigns-from-alibaba-moonshot-ai-and-deepseek/', 'TechCrunch', '2026-09-10'],
  ['EPOCH-GAP', 'US vs China on the Epoch Capabilities Index', 'https://epoch.ai/data-insights/us-vs-china-eci', 'Epoch AI', '2026-01-02'],
  ['NIST-CAISI', 'CAISI evaluation of DeepSeek V4 Pro', 'https://www.nist.gov/news-events/news/2026/05/caisi-evaluation-deepseek-v4-pro', 'NIST', '2026-05'],
  ['MOZILLA-OSAI', 'Chinese open models narrow gap', 'https://www.androidheadlines.com/2026/09/chinese-open-ai-models-narrow-gap-to-us-frontiers.html', 'Android Headlines', '2026-09'],
  ['EPOCH-GPU', 'AI supercomputer performance share by country', 'https://epoch.ai/data-insights/ai-supercomputers-performance-share-by-country', 'Epoch AI', '2025-05'],
  ['STANFORD-2026', 'Stanford AI Index 2026 summary', 'https://thenextweb.com/news/stanford-ai-index-2026-china-us-performance-gap', 'The Next Web', '2026'],
  ['ALJ-4CHARTS', 'China vs US: who is winning the AI race', 'https://www.aljazeera.com/news/2026/9/24/china-vs-us-who-is-winning-the-ai-race-in-four-charts', 'Al Jazeera', '2026-09-24'],
  ['HF-41', 'Chinese models 41% of Hugging Face downloads', 'https://equalocean.com/news/2026073122070-chinese-models-account-41-hugging-face-downloads-overtaking-us', 'EqualOcean', '2026-07-31'],
  ['CNBC-OPENROUTER', 'Chinese AI models capture token share', 'https://finance.yahoo.com/technology/ai/articles/chinese-ai-models-now-capture-020440715.html', 'CNBC via Yahoo', '2026-07'],
  ['MORGAN-BIS', 'BIS revises export review policy', 'https://www.morganlewis.com/pubs/2026/01/bis-revises-export-review-policy-for-advanced-ai-chips-destined-for-china-and-macau', 'Morgan Lewis', '2026-01'],
  ['TNW-H200', 'NVIDIA H200 China, zero-revenue guidance', 'https://thenextweb.com/news/nvidia-h200-china-zero-revenue-guidance-europe-gigafactories', 'The Next Web', '2026-08'],
  ['SEMI-HUAWEI', 'Huawei Ascend production ramp', 'https://newsletter.semianalysis.com/p/huawei-ascend-production-ramp', 'SemiAnalysis', null],
  ['TECHTIMES-RE', 'China rare earth controls still bite', 'https://www.techtimes.com/articles/317208/20260526/china-rare-earth-export-controls-april-curbs-still-bite-after-beijing-summit.htm', 'Tech Times', '2026-05-26'],
  ['LR-QCOM', 'Qualcomm defies US-China tensions', 'https://www.lightreading.com/regulatory-politics/qualcomm-defies-us-china-trade-tensions', 'Light Reading', null],
  ['TL-APPLE', 'Apple Q3 2026 revenue', 'https://telecomlead.com/smart-phone/apple-q3-2026-revenue-jumps-16-to-109-4-bn-as-iphone-mac-services-and-china-drive-growth-127024', 'TelecomLead', '2026-07'],
  ['FORBES-AIRBNB', 'Airbnb CEO on Chinese AI', 'https://www.forbes.com/sites/anishasircar/2026/05/21/airbnb-ceo-brian-chesky-called-chinese-ai-fast-and-cheap-now-congress-wants-answers/', 'Forbes', '2026-05-21'],
  ['WIKI-SPACEX-IPO', 'Initial public offering of SpaceX', 'https://en.wikipedia.org/wiki/Initial_public_offering_of_SpaceX', 'Wikipedia', null],
  ['NPR-SPACEX', 'SpaceX IPO price', 'https://www.npr.org/2026/06/11/nx-s1-5853199/spacex-ipo-price-elon-musk', 'NPR', '2026-06-11'],
  ['YAHOO-ANT-2T', 'Anthropic moving forward at $2 trillion', 'https://finance.yahoo.com/markets/stocks/articles/anthropic-moving-forward-2-trillion-123756375.html', 'Yahoo Finance', '2026-09-15'],
  ['FOOL-ANT-130', 'Anthropic has raised $130B ahead of IPO', 'https://www.fool.com/investing/2026/09/04/anthropic-has-already-raised-130-billion-ahead-of/', 'Motley Fool', '2026-09-04'],
  ['FORTUNE-ANT-S1', 'Anthropic confidentially files for IPO', 'https://fortune.com/2026/06/01/anthropic-confidentially-files-ipo-965-billion-valuation/', 'Fortune', '2026-06-01'],
  ['FORBES-OAI-IPO', 'OpenAI IPO: things to know', 'https://www.forbes.com/sites/investor-hub/article/openai-ipo-things-to-know/', 'Forbes', null],
  ['TC-ANT-65', 'Anthropic annualised revenue surges to $65B', 'https://techcrunch.com/2026/08/17/anthropics-annualized-revenue-surges-to-65b/', 'TechCrunch', '2026-08-17'],
  ['BLOOM-OAI-40', 'OpenAI revenue run rate tops $40B', 'https://www.bloomberg.com/news/articles/2026-08-13/openai-s-revenue-run-rate-tops-40-billion-ahead-of-ipo', 'Bloomberg (headline)', '2026-08-13'],
  ['ANT-RSI', 'When AI builds itself', 'https://www.anthropic.com/institute/recursive-self-improvement', 'Anthropic Institute', '2026-09-18'],
  ['SCIAM-RSI', 'Anthropic warns AI may soon begin recursive self-improvement', 'https://www.scientificamerican.com/article/anthropic-warns-ai-may-soon-begin-recursive-self-improvement/', 'Scientific American', '2026-06'],
];
```

- [ ] **Step 2: 写生成脚本**

```js
// scripts/build-sectors-industry.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { COMPANIES, EDGES, FACTS, SOURCES } from './data/sectors-industry-seed.mjs';
import { validateIndustry } from '../src/sectors/industry/industry-core.js';

const DATE = '2026-09-27';
const data = {
  schema_version: 1, snapshot_id: `industry-${DATE}`, retrieved_on: DATE,
  companies: COMPANIES.map(([id, ticker, exchange, listing, nameEn, nameZh, country, cityEn, cityZh, lat, lon, layer, tier, domain, roleEn, roleZh]) => ({
    id, ticker, exchange, listing, name: { en: nameEn, zh: nameZh }, country,
    hq: { city: { en: cityEn, zh: cityZh }, lat, lon }, layer, tier,
    role: { en: roleEn, zh: roleZh }, official_domain: domain,
  })),
  edges: EDGES.map(([id, source, target, type, as_of, amount_usd_b, status, en, zh, source_ids]) => ({
    id, source, target, type, as_of, amount_usd_b, status, label: { en, zh }, source_ids,
  })),
  facts: FACTS,
  sources: SOURCES.map(([id, title, url, publisher, published_at]) => ({ id, title, url, publisher, published_at })),
};
const errors = validateIndustry(data);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
mkdirSync('public/data/sectors-industry', { recursive: true });
writeFileSync(`public/data/sectors-industry/${DATE}.json`, `${JSON.stringify(data, null, 2)}\n`);
console.log(`wrote ${data.companies.length} companies, ${data.edges.length} edges`);
```

- [ ] **Step 3: 写数据测试（失败）**

```js
// tests/sectorsIndustryData.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateIndustry, LAYERS } from '../src/sectors/industry/industry-core.js';

const data = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
const edge = (id) => data.edges.find((e) => e.id === id);

describe('industry dataset 2026-09-27', () => {
  it('validates', () => expect(validateIndustry(data)).toEqual([]));
  it('fills every layer with at least one tier-1 or tier-2 company', () => {
    for (const layer of LAYERS) {
      expect(data.companies.some((c) => c.layer === layer && c.tier <= 2), layer).toBe(true);
    }
  });
  it('encodes Anthropic × SpaceX as cooperation and competition', () => {
    expect(edge('spcx-ant-colossus').type).toBe('compute');
    expect(edge('ant-spcx-rival').type).toBe('competitor');
  });
  it('marks the Anthropic IPO as a projection, not a fact', () => {
    expect(data.facts.ipo.find((f) => f.id === 'anthropic').status).toBe('projection');
  });
  it('lists only US exchanges for listed/adr companies', () => {
    for (const c of data.companies.filter((x) => ['listed', 'adr'].includes(x.listing))) {
      expect(['NASDAQ', 'NYSE'], c.id).toContain(c.exchange);
    }
  });
});
```

Run: `npx vitest run tests/sectorsIndustryData.test.js`
Expected: FAIL，找不到数据文件

- [ ] **Step 4: 核对每一行，然后生成**

按 Step 1 的核对规则逐行打开来源。改动（数值更正、状态改为 `unverified`）直接改在种子文件里。

```bash
node scripts/build-sectors-industry.mjs
npx vitest run tests/sectorsIndustryData.test.js
```
Expected: `wrote 55 companies, 41 edges`（核对后行数可能变化）；测试 PASS

- [ ] **Step 5: 写 SVG 主色函数与测试**

```js
// scripts/lib/svg-color.mjs
const NEUTRAL = new Set(['#000000', '#FFFFFF', '#FFF', '#000']);
export function dominantSvgColor(svg) {
  const counts = new Map();
  for (const [, hex] of svg.matchAll(/(?:fill|stop-color|stroke)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g)) {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
    const key = full.toUpperCase();
    if (NEUTRAL.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
```

```js
// tests/sectorsLogoManifest.test.js  (part 1)
import { describe, expect, it } from 'vitest';
import { dominantSvgColor } from '../scripts/lib/svg-color.mjs';

describe('dominantSvgColor', () => {
  it('picks the most frequent non-neutral fill', () => {
    expect(dominantSvgColor('<svg><path fill="#76b900"/><path fill="#76B900"/><path fill="#000"/><path fill="#ff0000"/></svg>')).toBe('#76B900');
  });
  it('expands short hex and ignores black/white', () => {
    expect(dominantSvgColor('<svg style="fill:#f60"><path fill="#fff"/></svg>')).toBe('#FF6600');
  });
  it('returns null for monochrome logos', () => {
    expect(dominantSvgColor('<svg><path fill="#000000"/></svg>')).toBeNull();
  });
});
```

Run: `npx vitest run tests/sectorsLogoManifest.test.js` → PASS（3 项）

- [ ] **Step 6: 写取标志脚本**

取标志要在用户的电脑上执行（device shell 或本机终端），因为云端沙盒无法访问公司官网。执行顺序：
1. 先运行脚本
2. 脚本写入 `status: 'needs_manual'` 的公司，用浏览器打开官网，手动保存官方标志（网页头部 SVG 或官方 press/brand kit），再运行一次脚本补齐 manifest

```js
// scripts/fetch-official-logos.mjs
// Usage: node scripts/fetch-official-logos.mjs [--only=id,id]
// Reads LOGO_SOURCES; downloads each URL, checks the host belongs to the company's official domain,
// writes the file and a manifest row. Existing files in public/assets/sectors/logos are reused.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { COMPANIES } from './data/sectors-industry-seed.mjs';
import { dominantSvgColor } from './lib/svg-color.mjs';

const DIR = 'public/assets/sectors/logos';
const TODAY = new Date().toISOString().slice(0, 10);
// Official brand-guide colours, where the company publishes one (id → { hex, url }).
// Fill in only from a page on the official domain; otherwise leave the id out and the logo file decides.
const BRAND_GUIDE = {};
// id → { page, asset }: page = official page showing the logo (must be on the official domain);
// asset = the file URL that page loads (may sit on the company's CDN). Fill during Step 6.
const LOGO_SOURCES = JSON.parse(readFileSync('scripts/data/logo-sources.json', 'utf8'));

const manifestPath = `${DIR}/manifest.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

for (const [id, , , , nameEn, , , , , , , , , domain] of COMPANIES) {
  if (only && !only.includes(id)) continue;
  const entry = LOGO_SOURCES[id];
  if (!entry?.page || !entry?.asset) { manifest[id] = { ...(manifest[id] ?? {}), status: 'needs_manual' }; continue; }
  const host = new URL(entry.page).hostname;
  if (!(host === domain || host.endsWith(`.${domain}`))) { console.error(`${id}: page ${host} is not under ${domain}`); process.exitCode = 1; continue; }
  const url = entry.asset;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 AFFLATUS logo provenance' } });
  if (!res.ok) { manifest[id] = { ...(manifest[id] ?? {}), status: 'needs_manual', last_error: res.status }; continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const file = `${id}.${['svg', 'png', 'webp'].includes(ext) ? ext : 'svg'}`;
  writeFileSync(`${DIR}/${file}`, buf);
  const guide = BRAND_GUIDE[id];
  const fromFile = file.endsWith('.svg') ? dominantSvgColor(buf.toString('utf8')) : null;
  manifest[id] = {
    name: nameEn, file: `/assets/sectors/logos/${file}`, source_page: entry.page, source_url: url, retrieved_on: TODAY,
    sha256: createHash('sha256').update(buf).digest('hex'),
    brand_color: guide?.hex ?? fromFile ?? '#141413',
    color_basis: guide ? 'brand_guide' : fromFile ? 'logo_file' : 'fallback',
    color_source_url: guide?.url ?? entry.page, status: 'ok',
  };
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
```

新建 `scripts/data/logo-sources.json`，格式为 `{ "nvda": { "page": "https://www.nvidia.com/en-us/", "asset": "https://www.nvidia.com/...logo.svg" }, ... }`。填法：
- 逐家打开官网首页，或官方 press / brand kit 页面，作为 `page`
- 在浏览器开发者工具里找到该页面实际加载的标志文件地址，作为 `asset`
- `page` 必须在官方域名下；`asset` 可以在公司自己的 CDN 上（例如 `www-cdn.anthropic.com`）
- 已有的 `public/assets/sectors/logos/*.svg` 若能在官网找到同一文件，就填该 URL（脚本会覆盖并记录）
- 找不到原始地址的旧文件不能沿用，必须重新从官网取

- [ ] **Step 7: manifest 完整性测试（追加到同一测试文件）**

```js
// tests/sectorsLogoManifest.test.js  (part 2)
import { existsSync, readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('public/assets/sectors/logos/manifest.json', 'utf8'));
const industry = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));

describe('logo manifest', () => {
  it.each(industry.companies.map((c) => [c.id, c]))('%s has an official, recorded logo', (id, c) => {
    const row = manifest[id];
    expect(row?.status, id).toBe('ok');
    expect(existsSync(`public${row.file}`)).toBe(true);
    const host = new URL(row.source_page).hostname;
    expect(host === c.official_domain || host.endsWith(`.${c.official_domain}`)).toBe(true);
    expect(row.brand_color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

Run: `npx vitest run tests/sectorsLogoManifest.test.js`
Expected: 全部 PASS。
- 只要还有 `needs_manual`，测试就失败，不得提交
- 某官网确实拦截脚本抓取：用浏览器从官网手动下载文件放进 `public/assets/sectors/logos/`，在 `logo-sources.json` 里照常填 `page` 与 `asset`，然后在脚本中改为读本地文件（对该 id 跳过 fetch，用 `readFileSync` 读取已存在的文件），重跑 `--only=<id>` 写入 sha256 与来源

- [ ] **Step 8: 接线并提交**

在 `scripts/validate-data.mjs` 的 CHECKS 中加入：
```js
  { path: 'public/data/sectors-industry/2026-09-27.json', validate: (data) => {
    const errors = validateIndustry(data);
    return { ok: errors.length === 0, errors };
  } },
```
并在文件顶部加 `import { validateIndustry } from '../src/sectors/industry/industry-core.js';`

在 `src/lib/fetchJson.js` 的 `STATIC_RESOURCES` 中加入：
```js
  'sectors-industry-2026-09-27': { url: '/data/sectors-industry/2026-09-27.json', freshness: 6 * 60 * 60_000, validate: objectWith('companies', 'edges', 'facts', 'sources') },
```
在 `THIRD_PARTY_NOTICES.md` 加一节"Company logos"：说明标志为各公司商标，仅用于识别，来源见 `manifest.json`。

```bash
npm run data:check
git add scripts/data scripts/build-sectors-industry.mjs scripts/lib/svg-color.mjs scripts/fetch-official-logos.mjs public/data/sectors-industry public/assets/sectors/logos scripts/validate-data.mjs src/lib/fetchJson.js THIRD_PARTY_NOTICES.md tests/sectorsIndustryData.test.js tests/sectorsLogoManifest.test.js
git commit -m "data(sectors): US-listed AI industry dataset, relationships and official logo provenance"
```

---

### Task 5: 美国双雄对比（纯函数）

**Files:**
- Create: `src/sectors/industry/head-to-head.js`
- Test: `tests/sectorsHeadToHead.test.js`

**Interfaces:**
- Consumes: 任务 2 的快照结构（`metrics[].direction` 取 `'higher'|'lower'`，`observations[]`）
- Produces:
  - `valueOf(snapshot, modelId, metricId): number|null`
  - `headToHead(snapshot, aId, bId, { refId }?) → { rows: Row[], aLeads: string[], bLeads: string[], ties: string[], missing: string[] }`，其中 `Row = { metricId, label:{en,zh}, unit, direction, a, b, ref, leader: 'a'|'b'|'tie'|null, delta }`
  - `pairedScale(row) → (v:number|null) => number|null`（0–1，同一指标内可比）

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsHeadToHead.test.js
import { describe, expect, it } from 'vitest';
import { headToHead, pairedScale } from '../src/sectors/industry/head-to-head.js';

const snap = {
  metrics: [
    { id: 'intelligence', label: { en: 'Overall', zh: '综合' }, unit: 'pts', direction: 'higher' },
    { id: 'cost_task', label: { en: 'Cost', zh: '成本' }, unit: 'usd', direction: 'lower' },
    { id: 'lcr', label: { en: 'LCR', zh: '长上下文' }, unit: 'pts', direction: 'higher' },
    { id: 'hle', label: { en: 'HLE', zh: 'HLE' }, unit: 'pts', direction: 'higher' },
  ],
  observations: [
    { model_id: 'a', metric_id: 'intelligence', value: 58 }, { model_id: 'b', metric_id: 'intelligence', value: 53 },
    { model_id: 'a', metric_id: 'cost_task', value: 7.6 }, { model_id: 'b', metric_id: 'cost_task', value: 3.3 },
    { model_id: 'a', metric_id: 'lcr', value: 85 }, { model_id: 'b', metric_id: 'lcr', value: 85 },
    { model_id: 'a', metric_id: 'hle', value: null }, { model_id: 'b', metric_id: 'hle', value: 55 },
    { model_id: 'r', metric_id: 'intelligence', value: 53 },
  ],
};

describe('headToHead', () => {
  const r = headToHead(snap, 'a', 'b', { refId: 'r' });
  it('respects metric direction', () => {
    expect(r.aLeads).toEqual(['intelligence']);
    expect(r.bLeads).toEqual(['cost_task']);
  });
  it('reports ties and missing values without picking a leader', () => {
    expect(r.ties).toEqual(['lcr']);
    expect(r.missing).toEqual(['hle']);
    expect(r.rows.find((x) => x.metricId === 'hle').delta).toBeNull();
  });
  it('carries the reference model', () => expect(r.rows[0].ref).toBe(53));
});

describe('pairedScale', () => {
  it('maps the larger value to 1 with a zero baseline', () => {
    const s = pairedScale({ a: 58, b: 53, ref: 53 });
    expect(s(58)).toBe(1);
    expect(s(53)).toBeCloseTo(53 / 58);
    expect(s(null)).toBeNull();
  });
  it('handles negative values from the omniscience metric', () => {
    const s = pairedScale({ a: -10, b: 20, ref: null });
    expect(s(-10)).toBe(0);
    expect(s(20)).toBe(1);
  });
  it('returns null when nothing is known', () => expect(pairedScale({ a: null, b: null, ref: null })).toBeNull());
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsHeadToHead.test.js` → FAIL（找不到模块）

- [ ] **Step 3: 实现**

```js
// src/sectors/industry/head-to-head.js
export const valueOf = (snapshot, modelId, metricId) =>
  snapshot.observations.find((o) => o.model_id === modelId && o.metric_id === metricId)?.value ?? null;

export function headToHead(snapshot, aId, bId, { refId = null } = {}) {
  const rows = snapshot.metrics.map((m) => {
    const a = valueOf(snapshot, aId, m.id);
    const b = valueOf(snapshot, bId, m.id);
    const ref = refId ? valueOf(snapshot, refId, m.id) : null;
    let leader = null;
    if (a != null && b != null) leader = a === b ? 'tie' : (a > b) === (m.direction !== 'lower') ? 'a' : 'b';
    return { metricId: m.id, label: m.label, unit: m.unit, direction: m.direction, a, b, ref, leader,
      delta: a != null && b != null ? a - b : null };
  });
  const ids = (k) => rows.filter((r) => r.leader === k).map((r) => r.metricId);
  return { rows, aLeads: ids('a'), bLeads: ids('b'), ties: ids('tie'), missing: ids(null) };
}

export function pairedScale(row) {
  const vals = [row.a, row.b, row.ref].filter((v) => v != null);
  if (!vals.length) return null;
  const lo = Math.min(0, ...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  return (v) => (v == null ? null : (v - lo) / span);
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run tests/sectorsHeadToHead.test.js` → PASS（6 项）

- [ ] **Step 5: 用真实快照做一次冒烟检查（追加测试）**

```js
// append to tests/sectorsHeadToHead.test.js
import { readFileSync } from 'node:fs';
it('runs on the 2026-09-27 snapshot: Opus 5.5 leads the overall index', () => {
  const real = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
  const r = headToHead(real, 'opus55-max', 'astra-max', { refId: 'fable-max' });
  expect(r.aLeads).toContain('intelligence');
  expect(r.rows).toHaveLength(real.metrics.length);
});
```
Run → PASS

- [ ] **Step 6: Commit**

```bash
git add src/sectors/industry/head-to-head.js tests/sectorsHeadToHead.test.js
git commit -m "feat(sectors): head-to-head comparison for the two US leaders"
```

---

### Task 6: 中美对比（纯函数）

**Files:**
- Create: `src/sectors/industry/rivalry-math.js`
- Test: `tests/sectorsRivalryMath.test.js`

**Interfaces:**
- Consumes: `valueOf`（任务 5）、快照、`industry.facts.dims`
- Produces:
  - `geographyLeaders(snapshot, metricId='intelligence') → { US:{modelId,name,value}|null, CN:{...}|null, points:number|null }`
  - `snapshotDims(snapshot) → Dim[]`：三个维度，id 为 `top_index`、`open_configs`、`median_output_price`
  - `divergingShares(dims) → (Dim & { usShare, cnShare, leader:'US'|'CN'|'tie' })[]`
  - 其中 `Dim = { id, us, cn, unit, better:'higher'|'lower', status, source_ids, label }`

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsRivalryMath.test.js
import { describe, expect, it } from 'vitest';
import { divergingShares, geographyLeaders, snapshotDims } from '../src/sectors/industry/rivalry-math.js';

const snap = {
  metrics: [{ id: 'intelligence', direction: 'higher' }],
  models: [
    { id: 'u1', name: 'U1', lab_geography: 'US', open_weights: false, prices: { output: 20 } },
    { id: 'u2', name: 'U2', lab_geography: 'US', open_weights: false, prices: { output: 50 } },
    { id: 'c1', name: 'C1', lab_geography: 'CN', open_weights: true, prices: { output: 0.87 } },
    { id: 'c2', name: 'C2', lab_geography: 'CN', open_weights: true, prices: { output: 4.4 } },
    { id: 'c3', name: 'C3', lab_geography: 'CN', open_weights: true, prices: { output: 1.2 } },
  ],
  observations: [
    { model_id: 'u1', metric_id: 'intelligence', value: 58 }, { model_id: 'u2', metric_id: 'intelligence', value: 53 },
    { model_id: 'c1', metric_id: 'intelligence', value: 46 }, { model_id: 'c2', metric_id: 'intelligence', value: 45 },
    { model_id: 'c3', metric_id: 'intelligence', value: null },
  ],
};

describe('geographyLeaders', () => {
  it('finds the best model per geography and the point gap', () => {
    const g = geographyLeaders(snap);
    expect(g.US.modelId).toBe('u1');
    expect(g.CN.modelId).toBe('c1');
    expect(g.points).toBe(12);
  });
});

describe('snapshotDims', () => {
  it('derives index, open-weights count and median output price', () => {
    const d = Object.fromEntries(snapshotDims(snap).map((x) => [x.id, x]));
    expect([d.top_index.us, d.top_index.cn]).toEqual([58, 46]);
    expect([d.open_configs.us, d.open_configs.cn]).toEqual([0, 3]);
    expect(d.median_output_price.us).toBe(35);
    expect(d.median_output_price.cn).toBe(1.2);
    expect(d.median_output_price.better).toBe('lower');
  });
});

describe('divergingShares', () => {
  it('splits each pair into shares and names the leader by direction', () => {
    const [a, b, c] = divergingShares([
      { id: 'gpu', us: 75, cn: 15, better: 'higher' },
      { id: 'price', us: 35, cn: 1.2, better: 'lower' },
      { id: 'even', us: 1, cn: 1, better: 'higher' },
    ]);
    expect(a.usShare).toBeCloseTo(75 / 90); expect(a.leader).toBe('US');
    expect(b.leader).toBe('CN');
    expect(c.leader).toBe('tie'); expect(c.usShare).toBe(0.5);
  });
  it('keeps a 50/50 split when both values are zero', () => {
    expect(divergingShares([{ id: 'z', us: 0, cn: 0, better: 'higher' }])[0].usShare).toBe(0.5);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsRivalryMath.test.js` → FAIL

- [ ] **Step 3: 实现**

```js
// src/sectors/industry/rivalry-math.js
import { valueOf } from './head-to-head.js';

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function geographyLeaders(snapshot, metricId = 'intelligence') {
  const best = { US: null, CN: null };
  for (const m of snapshot.models) {
    if (!(m.lab_geography in best)) continue;
    const v = valueOf(snapshot, m.id, metricId);
    if (v == null) continue;
    if (!best[m.lab_geography] || v > best[m.lab_geography].value) best[m.lab_geography] = { modelId: m.id, name: m.name, value: v };
  }
  return { ...best, points: best.US && best.CN ? best.US.value - best.CN.value : null };
}

export function snapshotDims(snapshot) {
  const geo = (g) => snapshot.models.filter((m) => m.lab_geography === g);
  const leaders = geographyLeaders(snapshot);
  const src = { status: 'independent', source_ids: ['snapshot'] };
  return [
    { id: 'top_index', us: leaders.US?.value ?? null, cn: leaders.CN?.value ?? null, unit: 'index_points', better: 'higher', ...src,
      label: { en: 'Best overall index in this snapshot', zh: '本快照最高综合指数' } },
    { id: 'open_configs', us: geo('US').filter((m) => m.open_weights).length, cn: geo('CN').filter((m) => m.open_weights).length,
      unit: 'count', better: 'higher', ...src, label: { en: 'Open-weights configurations', zh: '开放权重配置数' } },
    { id: 'median_output_price', us: median(geo('US').map((m) => m.prices?.output)), cn: median(geo('CN').map((m) => m.prices?.output)),
      unit: 'usd_per_m', better: 'lower', ...src, label: { en: 'Median output price per 1M tokens', zh: '每百万输出 token 中位价格' } },
  ];
}

export function divergingShares(dims) {
  return dims.map((d) => {
    const total = d.us + d.cn;
    const usShare = total > 0 ? d.us / total : 0.5;
    const leader = d.us === d.cn ? 'tie' : (d.us > d.cn) === (d.better !== 'lower') ? 'US' : 'CN';
    return { ...d, usShare, cnShare: 1 - usShare, leader };
  });
}
```

说明：`snapshotDims` 的 `source_ids: ['snapshot']` 不进产业数据集，因此不经过 `validateIndustry`。视图把 `'snapshot'` 渲染为"本页模型快照（2026-09-27）"，并链接到页内来源台账。

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run tests/sectorsRivalryMath.test.js` → PASS（5 项）

- [ ] **Step 5: Commit**

```bash
git add src/sectors/industry/rivalry-math.js tests/sectorsRivalryMath.test.js
git commit -m "feat(sectors): US–China gap, diverging shares and snapshot-derived dimensions"
```

---

### Task 7: 正交投影（舞台与公司地球共用）

**Files:**
- Create: `src/sectors/stage/projection.js`
- Test: `tests/sectorsProjection.test.js`

**Interfaces:**
- Consumes: `spherePoint(lat, lon, r)`（`src/showcase/globeMath.js`，+Y 北、+Z 在 (0°,0°)、+X 东）
- Produces:
  - `projectXyz([x,y,z], view) → { x, y, depth, visible }`
  - `projectLatLon(lat, lon, view)`（同上返回）
  - 其中 `view = { lat0, lon0, radius, cx, cy }`

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsProjection.test.js
import { describe, expect, it } from 'vitest';
import { projectLatLon } from '../src/sectors/stage/projection.js';

const view = { lat0: 30, lon0: -100, radius: 200, cx: 300, cy: 300 };

describe('orthographic projection', () => {
  it('puts the view centre at the canvas centre', () => {
    const p = projectLatLon(30, -100, view);
    expect(p.x).toBeCloseTo(300); expect(p.y).toBeCloseTo(300); expect(p.visible).toBe(true);
  });
  it('puts east to the right and north up', () => {
    expect(projectLatLon(30, -90, view).x).toBeGreaterThan(300);
    expect(projectLatLon(40, -100, view).y).toBeLessThan(300);
  });
  it('hides the far side', () => expect(projectLatLon(-30, 80, view).visible).toBe(false));
  it('keeps visible points inside the disc', () => {
    for (let lon = -180; lon <= 180; lon += 15) for (let lat = -80; lat <= 80; lat += 20) {
      const p = projectLatLon(lat, lon, view);
      if (p.visible) expect(Math.hypot(p.x - 300, p.y - 300)).toBeLessThanOrEqual(200.0001);
    }
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsProjection.test.js` → FAIL

- [ ] **Step 3: 实现**

```js
// src/sectors/stage/projection.js
import { spherePoint } from '../../showcase/globeMath.js';

const RAD = Math.PI / 180;

export function projectXyz([x, y, z], { lat0, lon0, radius, cx, cy }) {
  const cl = Math.cos(lon0 * RAD), sl = Math.sin(lon0 * RAD);
  const x1 = x * cl - z * sl;          // rotate about Y so lon0 faces the camera
  const z1 = x * sl + z * cl;
  const cp = Math.cos(lat0 * RAD), sp = Math.sin(lat0 * RAD);
  const y2 = y * cp - z1 * sp;         // tilt about X so lat0 sits at the centre
  const z2 = y * sp + z1 * cp;
  return { x: cx + radius * x1, y: cy - radius * y2, depth: z2, visible: z2 >= 0 };
}

export const projectLatLon = (lat, lon, view) => projectXyz(spherePoint(lat, lon, 1), view);
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run tests/sectorsProjection.test.js` → PASS（4 项）

- [ ] **Step 5: Commit**

```bash
git add src/sectors/stage/projection.js tests/sectorsProjection.test.js
git commit -m "feat(sectors): shared orthographic projection"
```

---

### Task 8: 舞台布局、渲染与静态回退

**Files:**
- Create: `src/sectors/stage/layouts.js`、`src/sectors/stage/stage.js`
- Modify: `sectors.html`（用 `<section class="stage" id="sectorsStage">` 取代 `#sectorsEarth`，文字卡片沿用 spec §2.1 表中的现有文案）；`src/pages/sectors.js`（`mountSectorsEarth` → `mountStage`）；`public/styles/sectors-v2.css`（舞台样式）
- Test: `tests/sectorsStageLayouts.test.js`

**Interfaces:**
- Consumes: `projectLatLon`（任务 7）、`headToHead` 不需要；快照、产业数据、`loadGlobeAsset()`（`points` 为 XYZ 扁平数组）
- Produces:
  - `SCENES = ['open','ecosystems','distributions','frontier','dependencies','value']`
  - `buildDots(snapshot) → Dot[]`，其中 `Dot = { i, modelId, metricId, geo }`
  - `sceneTargets(scene, { dots, snapshot, industry, width, height }) → Target[]`，其中 `Target = { x, y, r, color, alpha }`，与 `dots` 等长
  - `interpolate(from, to, t, i, n) → Target`
  - `mountStage(host, { snapshot, industry }) → () => void`（返回销毁函数）

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsStageLayouts.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENES, buildDots, sceneTargets, interpolate } from '../src/sectors/stage/layouts.js';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const industry = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
const dots = buildDots(snapshot);
const ctx = { dots, snapshot, industry, width: 1200, height: 800 };

describe('stage layouts', () => {
  it('has one dot per model × metric', () => expect(dots).toHaveLength(snapshot.models.length * snapshot.metrics.length));
  it.each(SCENES)('%s conserves dots and stays on canvas', (scene) => {
    const t = sceneTargets(scene, ctx);
    expect(t).toHaveLength(dots.length);
    for (const p of t) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1200);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(800);
    }
  });
  it('colours dots by geography with the flag tokens in the ecosystems scene', () => {
    const t = sceneTargets('ecosystems', ctx);
    dots.forEach((d, i) => expect(t[i].color).toBe(d.geo === 'US' ? '#0A3161' : '#EE1C25'));
  });
  it('stacks equal values vertically without overlap in the distributions scene', () => {
    const t = sceneTargets('distributions', ctx);
    const seen = new Set();
    t.forEach((p, i) => { if (p.alpha > 0) { const k = `${Math.round(p.x)}|${Math.round(p.y)}`; expect(seen.has(k), `dot ${i}`).toBe(false); seen.add(k); } });
  });
  it('interpolates endpoints exactly', () => {
    const a = { x: 0, y: 0, r: 2, color: '#0A3161', alpha: 1 }, b = { x: 10, y: 20, r: 4, color: '#EE1C25', alpha: 0 };
    expect(interpolate(a, b, 0, 0, 10)).toMatchObject({ x: 0, y: 0 });
    expect(interpolate(a, b, 1, 9, 10)).toMatchObject({ x: 10, y: 20, color: '#EE1C25' });
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsStageLayouts.test.js` → FAIL

- [ ] **Step 3: 实现布局**

```js
// src/sectors/stage/layouts.js
import { projectLatLon } from './projection.js';
import { valueOf } from '../industry/head-to-head.js';

export const SCENES = ['open', 'ecosystems', 'distributions', 'frontier', 'dependencies', 'value'];
const US = '#0A3161', CN = '#EE1C25', INK = '#141413', MUTED = '#66645E';
const HQ = { US: [37.6, -122.2], CN: [34.5, 116.4] };  // lab-origin anchors at country level (Bay Area; Beijing–Hangzhou band)
const geoColor = (g) => (g === 'US' ? US : CN);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixColor = (a, b, t) => `#${hex(a).map((v, i) => Math.round(mix(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export function buildDots(snapshot) {
  const out = [];
  for (const m of snapshot.models) for (const k of snapshot.metrics) out.push({ i: out.length, modelId: m.id, metricId: k.id, geo: m.lab_geography });
  return out;
}

const globeView = (w, h, lon0) => ({ lat0: 25, lon0, radius: Math.min(w, h) * 0.38, cx: w / 2, cy: h / 2 });
const jitter = (i, s) => [((i * 73) % 97) / 97 - 0.5, ((i * 37) % 89) / 89 - 0.5].map((v) => v * s);
const clampTo = (p, w, h) => ({ ...p, x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) });

export function sceneTargets(scene, { dots, snapshot, industry, width: w, height: h }) {
  const n = dots.length;
  if (scene === 'open' || scene === 'ecosystems') {
    const view = globeView(w, h, scene === 'open' ? -40 : 10);
    return dots.map((d, i) => {
      const [lat, lon] = HQ[d.geo] ?? [0, 0];
      const [dl, dn] = jitter(i, 9);
      const p = projectLatLon(lat + dl, lon + dn, view);
      return clampTo({ x: p.x, y: p.y, r: 2.4, color: scene === 'open' ? INK : geoColor(d.geo), alpha: p.visible ? 1 : 0.15 }, w, h);
    });
  }
  if (scene === 'distributions') {
    const metrics = snapshot.metrics.map((m) => m.id);
    const band = (h * 0.8) / metrics.length;
    const stacks = new Map();
    return dots.map((d) => {
      const m = snapshot.metrics.find((x) => x.id === d.metricId);
      const values = snapshot.observations.filter((o) => o.metric_id === m.id && o.value != null).map((o) => o.value);
      const v = valueOf(snapshot, d.modelId, d.metricId);
      if (v == null) return { x: w / 2, y: h - 4, r: 0, color: MUTED, alpha: 0 };
      const lo = Math.min(...values), hi = Math.max(...values);
      const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
      const x = w * 0.12 + t * w * 0.76;
      const row = metrics.indexOf(d.metricId);
      const key = `${row}|${Math.round(x)}`;
      const k = stacks.get(key) ?? 0; stacks.set(key, k + 1);
      return clampTo({ x, y: h * 0.1 + band * (row + 0.5) - k * 6, r: 2.4, color: geoColor(d.geo), alpha: 1 }, w, h);
    });
  }
  if (scene === 'frontier') {
    const cost = (id) => valueOf(snapshot, id, 'cost_task');
    const score = (id) => valueOf(snapshot, id, 'intelligence');
    const costs = snapshot.models.map((m) => cost(m.id)).filter((v) => v > 0);
    const [c0, c1] = [Math.log(Math.min(...costs)), Math.log(Math.max(...costs))];
    return dots.map((d) => {
      const c = cost(d.modelId), s = score(d.modelId);
      if (!(c > 0) || s == null) return { x: w / 2, y: h - 4, r: 0, color: MUTED, alpha: 0 };
      const x = w * 0.12 + ((Math.log(c) - c0) / (c1 - c0 || 1)) * w * 0.76;
      const y = h * 0.88 - ((s - 25) / 40) * h * 0.76;
      return clampTo({ x, y, r: d.metricId === 'intelligence' ? 6 : 0, color: geoColor(d.geo), alpha: d.metricId === 'intelligence' ? 1 : 0 }, w, h);
    });
  }
  // dependencies / value: model dots sink to the "models" layer; tier-1 companies light up in the other rows
  const rows = ['labs', 'compute', 'memory', 'foundry', 'power'];
  const tier1 = industry.companies.filter((c) => c.tier === 1);
  return dots.map((d, i) => {
    const slot = i % Math.max(1, tier1.length);
    const c = tier1[slot];
    const onModels = d.metricId === 'intelligence';
    const row = onModels ? 0 : Math.max(0, rows.indexOf(c.layer));
    const col = onModels ? snapshot.models.findIndex((m) => m.id === d.modelId) / snapshot.models.length : slot / tier1.length;
    const visible = scene === 'dependencies' ? (onModels || i < tier1.length * 2) : onModels && ['anthropic', 'openai'].includes(snapshot.models.find((m) => m.id === d.modelId)?.lab?.toLowerCase());
    const color = onModels ? geoColor(d.geo) : c.country === 'CN' ? CN : c.country === 'US' ? US : MUTED;
    return clampTo({ x: w * 0.1 + col * w * 0.8, y: h * 0.15 + row * h * 0.17, r: onModels ? 4 : 3, color, alpha: visible ? 1 : 0.08 }, w, h);
  });
}

export function interpolate(from, to, t, i, n) {
  const stagger = n > 1 ? (i / (n - 1)) * 0.12 : 0;
  const k = ease(Math.max(0, Math.min(1, (t - stagger) / (1 - 0.12 || 1))));
  const kk = t >= 1 ? 1 : k;
  return { x: mix(from.x, to.x, kk), y: mix(from.y, to.y, kk), r: mix(from.r, to.r, kk),
    color: kk >= 1 ? to.color : mixColor(from.color, to.color, kk), alpha: mix(from.alpha, to.alpha, kk) };
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run tests/sectorsStageLayouts.test.js` → PASS（10 项：1 + 6 个场景 + 3）

- [ ] **Step 5: 实现渲染器**

```js
// src/sectors/stage/stage.js
import { loadGlobeAsset } from '../../showcase/globeAsset.js';
import { projectXyz } from './projection.js';
import { SCENES, buildDots, sceneTargets, interpolate } from './layouts.js';

export function mountStage(host, { snapshot, industry }) {
  if (!host) return () => {};
  const canvas = host.querySelector('canvas');
  const cards = [...host.querySelectorAll('[data-scene]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx2d = canvas?.getContext('2d');
  if (!ctx2d || reduce) { host.dataset.mode = 'static'; return () => {}; }   // CSS shows the static frames
  host.dataset.mode = 'live';
  const dots = buildDots(snapshot);
  let land = null, frames = [], w = 0, h = 0, raf = 0, visible = true, spin = 0, last = 0;
  loadGlobeAsset().then((g) => { land = g.points; }).catch(() => {});

  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    frames = SCENES.map((s) => sceneTargets(s, { dots, snapshot, industry, width: w, height: h }));
  };
  const progress = () => {
    const r = host.getBoundingClientRect();
    const travel = r.height - innerHeight;
    return Math.max(0, Math.min(SCENES.length - 1, (-r.top / (travel || 1)) * (SCENES.length - 1)));
  };
  const drawLand = (lon0, alpha) => {
    if (!land || alpha <= 0) return;
    const view = { lat0: 25, lon0, radius: Math.min(w, h) * 0.38, cx: w / 2, cy: h / 2 };
    ctx2d.fillStyle = `rgba(20,20,19,${0.18 * alpha})`;
    for (let i = 0; i < land.length; i += 9) {          // every 3rd point keeps 60fps on phones
      const p = projectXyz([land[i], land[i + 1], land[i + 2]], view);
      if (p.visible) ctx2d.fillRect(p.x, p.y, 1.2, 1.2);
    }
  };
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const dt = last ? (now - last) / 1000 : 0; last = now;
    const p = progress();
    const s = Math.floor(p), t = p - s;
    spin = p < 1 ? (spin + dt * 6) % 360 : spin;
    ctx2d.clearRect(0, 0, w, h);
    drawLand(-40 + spin * (1 - Math.min(1, p)) + 50 * Math.min(1, p), Math.max(0, 1 - Math.max(0, p - 1)));
    const a = frames[s], b = frames[Math.min(s + 1, frames.length - 1)];
    for (let i = 0; i < dots.length; i++) {
      const q = interpolate(a[i], b[i], t, i, dots.length);
      if (q.alpha <= 0.01 || q.r <= 0.1) continue;
      ctx2d.globalAlpha = q.alpha; ctx2d.fillStyle = q.color;
      ctx2d.beginPath(); ctx2d.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx2d.fill();
    }
    ctx2d.globalAlpha = 1;
    const active = Math.round(p);
    cards.forEach((c) => c.toggleAttribute('data-active', Number(c.dataset.scene) === active));
  };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = 0; });
  io.observe(host);
  addEventListener('resize', resize);
  resize(); raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); io.disconnect(); removeEventListener('resize', resize); };
}
```

- [ ] **Step 6: HTML 与 CSS**

在 `sectors.html` 中用下面的结构替换 `<section class="sectors-earth" id="sectorsEarth" …>…</section>`。
- 6 张卡片的 `h2/p` 文案取自 spec §2.1 表"文字卡片"列所指的现有元素，原样复制 `data-en/data-zh`
- S0 保留三句打字机与 01–03 按钮
- 说明行按 §2.1 两种文案切换

```html
<section class="stage" id="sectorsStage" aria-label="Scroll story: from models to value" data-aria-en="Scroll story: from models to value" data-aria-zh="滚动叙事：从模型到价值">
  <div class="stage-sticky">
    <canvas class="stage-canvas" aria-hidden="true"></canvas>
    <p class="stage-legend" data-scene-legend="obs" data-en="Each dot is one observation" data-zh="每个点 = 一条观测">Each dot is one observation</p>
    <p class="stage-legend" data-scene-legend="entity" hidden data-en="Each dot is one model or company" data-zh="每个点 = 一个模型或公司">Each dot is one model or company</p>
  </div>
  <div class="stage-cards">
    <article class="stage-card" data-scene="0"><!-- S0: h1, lede, typewriter (copied from #sectorsEarth) --></article>
    <article class="stage-card" data-scene="1"><!-- S1: copy from #geographyEditorial head --></article>
    <article class="stage-card" data-scene="2"><!-- S2: copy from #capability first paragraph --></article>
    <article class="stage-card" data-scene="3"><!-- S3: copy from #sectorsFrontier lede --></article>
    <article class="stage-card" data-scene="4"><!-- S4: copy from #supply lede --></article>
    <article class="stage-card" data-scene="5"><!-- S5: copy from #issuers first sentence --></article>
  </div>
  <figure class="stage-static" aria-hidden="true"></figure>
  <a class="stage-jump" href="#editorialIntro" data-en="Jump to story ↓" data-zh="跳至正文 ↓">Jump to story ↓</a>
  <p class="stage-credit" data-en="Earth geometry: Natural Earth (public domain). Model dots are placed at country level, not at offices or servers." data-zh="地球几何：Natural Earth（公有领域）。模型点按国家层面放置，不代表办公室或服务器位置。">Earth geometry: Natural Earth (public domain). Model dots are placed at country level, not at offices or servers.</p>
</section>
```
（上面的注释只标明该复制哪段现有 HTML，执行时把注释替换成复制来的元素。）

在 `stage.js` 的 `tick` 末尾加一行：说明行在 `active >= 4` 时切换到 entity 版。

```js
    host.querySelector('[data-scene-legend="obs"]').hidden = active >= 4;
    host.querySelector('[data-scene-legend="entity"]').hidden = active < 4;
```

追加到 `sectors-v2.css`：
```css
.stage{position:relative;background:var(--stage);height:calc(100vh * 6)}
.stage-sticky{position:sticky;top:0;height:100vh}
.stage-canvas{width:100%;height:100%;display:block}
.stage-cards{position:absolute;inset:0;pointer-events:none}
.stage-card{position:absolute;left:max(20px,calc((100vw - var(--w-module))/2));top:calc(var(--i,0) * 100vh + 22vh);
  max-width:440px;background:var(--paper);padding:24px;border:1px solid var(--rule);pointer-events:auto;opacity:.35;transition:opacity .4s}
.stage-card[data-active]{opacity:1}
.stage-card:nth-child(1){--i:0}.stage-card:nth-child(2){--i:1}.stage-card:nth-child(3){--i:2}
.stage-card:nth-child(4){--i:3}.stage-card:nth-child(5){--i:4}.stage-card:nth-child(6){--i:5}
.stage-legend{position:absolute;right:24px;bottom:24px;font:500 13px/1.4 var(--font-sans,system-ui);color:var(--muted)}
.stage-static{display:none}
.stage[data-mode="static"]{height:auto}
.stage[data-mode="static"] .stage-sticky{display:none}
.stage[data-mode="static"] .stage-cards{position:static;display:grid;gap:24px;padding:48px 20px}
.stage[data-mode="static"] .stage-card{position:static;opacity:1}
@media (max-width:640px){.stage-card{left:20px;right:20px;max-width:none}}
```

在 `src/pages/sectors.js` 中：
- 删掉 `mountSectorsEarth` 的 import 与调用
- 改为：前沿快照与产业数据都取到后调用 `mountStage(byId('sectorsStage'), { snapshot, industry })`，把返回的销毁函数并入现有的 destroy 流程

- [ ] **Step 7: 浏览器冒烟检查**

```bash
npm run build && npm run preview
```
打开 `http://127.0.0.1:4173/en/sectors.html` 与 `/zh/sectors.html`，从头滚到舞台结束，检查：
- 6 个场景依次出现，倒着滚能回放
- S1 为蓝 / 红两色
- DevTools 开"减少动态"后显示 6 张静态卡片

截图存到 `docs/sectors-81k-evidence/stage-*.png`。

- [ ] **Step 8: Commit**

```bash
git add src/sectors/stage sectors.html src/pages/sectors.js public/styles/sectors-v2.css tests/sectorsStageLayouts.test.js docs/sectors-81k-evidence
git commit -m "feat(sectors): sticky dot stage with six scroll scenes and reduced-motion fallback"
```

---

### Task 9: 公司地球与分层卡片

**Files:**
- Create: `src/sectors/industry/globe-layout.js`、`src/sectors/industry/globe-view.js`
- Modify: `sectors.html`（新章 `#industryGlobe`）、`public/styles/sectors-v2.css`、`src/pages/sectors.js`
- Test: `tests/sectorsGlobeLayout.test.js`

**Interfaces:**
- Consumes: `projectLatLon`（任务 7），产业数据，`manifest.json`（任务 4），`LAYERS/LAYER_LABEL`（任务 3），`translate/currentLanguage`（`src/sectors/content.js`）
- Produces:
  - `TIER_RADIUS = {1:18, 2:13, 3:9}`
  - `companyMarkers(companies, view, { layer }?) → Marker[]`，其中 `Marker = { id, x, y, r, visible, country, tier }`，按 depth 从远到近排序
  - `clusterMarkers(markers, { gap=3 }?) → Cluster[]`，其中 `Cluster = { x, y, r, ids }`，单个公司也是一个长度为 1 的 cluster
  - `mountCompanyGlobe(host, { industry, manifest, lang }) → () => void`

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsGlobeLayout.test.js
import { describe, expect, it } from 'vitest';
import { TIER_RADIUS, clusterMarkers, companyMarkers } from '../src/sectors/industry/globe-layout.js';

const c = (id, lat, lon, tier = 2, layer = 'compute', country = 'US') => ({ id, hq: { lat, lon }, tier, layer, country });
const view = { lat0: 35, lon0: -110, radius: 300, cx: 400, cy: 400 };

describe('companyMarkers', () => {
  it('sizes by tier and filters by layer', () => {
    const m = companyMarkers([c('a', 37.4, -122, 1), c('b', 37.4, -122, 3, 'power')], view, { layer: 'compute' });
    expect(m).toHaveLength(1);
    expect(m[0].r).toBe(TIER_RADIUS[1]);
  });
  it('drops far-side companies', () => {
    expect(companyMarkers([c('tw', 24.8, 121)], view)).toHaveLength(0);
  });
});

describe('clusterMarkers', () => {
  it('groups Bay Area companies and keeps distant ones apart', () => {
    const m = companyMarkers([c('nvda', 37.37, -121.96, 1), c('amd', 37.38, -121.96), c('alab', 37.34, -121.89, 3), c('ceg', 39.29, -76.61)], view);
    const cl = clusterMarkers(m);
    const bay = cl.find((k) => k.ids.includes('nvda'));
    expect(bay.ids.sort()).toEqual(['alab', 'amd', 'nvda']);
    expect(cl.find((k) => k.ids.includes('ceg')).ids).toEqual(['ceg']);
  });
  it('never loses a company', () => {
    const m = companyMarkers(Array.from({ length: 30 }, (_, i) => c(`x${i}`, 30 + (i % 5), -120 + i)), view);
    expect(clusterMarkers(m).flatMap((k) => k.ids)).toHaveLength(m.length);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsGlobeLayout.test.js` → FAIL

- [ ] **Step 3: 实现布局**

```js
// src/sectors/industry/globe-layout.js
import { projectLatLon } from '../stage/projection.js';

export const TIER_RADIUS = { 1: 18, 2: 13, 3: 9 };

export function companyMarkers(companies, view, { layer = null } = {}) {
  return companies
    .filter((c) => !layer || c.layer === layer)
    .map((c) => ({ c, p: projectLatLon(c.hq.lat, c.hq.lon, view) }))
    .filter(({ p }) => p.visible)
    .sort((a, b) => a.p.depth - b.p.depth)
    .map(({ c, p }) => ({ id: c.id, x: p.x, y: p.y, r: TIER_RADIUS[c.tier], visible: true, country: c.country, tier: c.tier }));
}

export function clusterMarkers(markers, { gap = 3 } = {}) {
  const order = [...markers].sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  const clusters = [];
  for (const m of order) {
    const hit = clusters.find((k) => Math.hypot(k.x - m.x, k.y - m.y) < k.r + m.r + gap);
    if (hit) { hit.ids.push(m.id); hit.r = Math.min(28, hit.r + 1.5); } else clusters.push({ x: m.x, y: m.y, r: m.r, ids: [m.id] });
  }
  return clusters;
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run tests/sectorsGlobeLayout.test.js` → PASS（4 项）

- [ ] **Step 5: 实现视图**

```js
// src/sectors/industry/globe-view.js
import { loadGlobeAsset } from '../../showcase/globeAsset.js';
import { projectXyz } from '../stage/projection.js';
import { spherePoint } from '../../showcase/globeMath.js';
import { clusterMarkers, companyMarkers } from './globe-layout.js';
import { LAYERS, LAYER_LABEL } from './industry-core.js';
import { escapeHtml, translate } from '../content.js';

const RING = { US: 'var(--us)', CN: 'var(--cn)' };
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

export function mountCompanyGlobe(host, { industry, manifest, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const companies = byId(industry.companies);
  const svg = host.querySelector('svg.globe');
  const list = host.querySelector('.globe-list');
  const cards = host.querySelector('.layer-cards');
  let view = { lat0: 30, lon0: -100, radius: 300, cx: 320, cy: 320 };
  let layer = null, land = [], drag = null;

  // Numbered layer cards 01–08 (81k category cards)
  cards.innerHTML = LAYERS.map((id, i) => {
    const members = industry.companies.filter((c) => c.layer === id);
    const top = members.filter((c) => c.tier === 1).slice(0, 4);
    return `<li><button type="button" data-layer="${id}" aria-pressed="false">
      <span class="layer-no">${String(i + 1).padStart(2, '0')}</span>
      <strong>${escapeHtml(t(LAYER_LABEL[id]))}</strong>
      <span class="layer-count">${translate(`${members.length} companies`, `${members.length} 家公司`, lang)}</span>
      <span class="layer-logos">${top.map((c) => logo(c)).join('')}</span></button></li>`;
  }).join('');

  function logo(c, size = 20) {
    const m = manifest[c.id];
    const fallback = escapeHtml((c.ticker ?? c.name.en).slice(0, 2));
    return m?.file
      ? `<img src="${m.file}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'logo-fallback',textContent:'${fallback}'}))">`
      : `<b class="logo-fallback" style="--brand:${m?.brand_color ?? 'var(--ink)'}">${fallback}</b>`;
  }

  function draw() {
    const clusters = clusterMarkers(companyMarkers(industry.companies, view, { layer }));
    const dots = [];
    for (let i = 0; i < land.length; i += 9) {
      const p = projectXyz([land[i], land[i + 1], land[i + 2]], view);
      if (p.visible) dots.push(`M${p.x.toFixed(1)} ${p.y.toFixed(1)}h1.2`);
    }
    svg.innerHTML = `<circle cx="${view.cx}" cy="${view.cy}" r="${view.radius}" class="globe-disc"/>
      <path d="${dots.join('')}" class="globe-land"/>
      ${clusters.map((k) => {
        const c = companies[k.ids[0]];
        const listed = ['listed', 'adr'].includes(c.listing);
        const label = k.ids.length > 1 ? translate(`${k.ids.length} companies near ${c.hq.city.en}`, `${c.hq.city.zh}附近 ${k.ids.length} 家公司`, lang) : t(c.name);
        return `<g class="marker${listed ? '' : ' is-unlisted'}" tabindex="0" role="button" data-ids="${k.ids.join(',')}" aria-label="${escapeHtml(label)}" transform="translate(${k.x.toFixed(1)} ${k.y.toFixed(1)})">
          <circle r="${k.r}" style="stroke:${RING[c.country] ?? 'var(--other)'}"/>
          ${k.ids.length > 1 ? `<text dy="4">${k.ids.length}</text>`
            : `<image href="${manifest[c.id]?.file ?? ''}" x="${-k.r * 0.62}" y="${-k.r * 0.62}" width="${k.r * 1.24}" height="${k.r * 1.24}"/>`}
        </g>`;
      }).join('')}`;
  }

  function show(ids) {
    list.innerHTML = ids.map((id) => {
      const c = companies[id];
      return `<li>${logo(c, 28)}<div><strong>${escapeHtml(t(c.name))}</strong>
        <span>${escapeHtml(c.ticker ? `${c.exchange}: ${c.ticker}` : translate('Not US-listed', '未在美上市', lang))} · ${escapeHtml(t(c.hq.city))}</span>
        <span>${escapeHtml(t(LAYER_LABEL[c.layer]))} · ${translate(`Tier ${c.tier}`, `${c.tier} 级`, lang)}</span>
        <p>${escapeHtml(t(c.role))}</p></div></li>`;
    }).join('');
  }

  const onPick = (e) => { const g = e.target.closest('[data-ids]'); if (g) show(g.dataset.ids.split(',')); };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(e); } };
  const onLayer = (e) => {
    const b = e.target.closest('[data-layer]'); if (!b) return;
    layer = layer === b.dataset.layer ? null : b.dataset.layer;
    cards.querySelectorAll('[data-layer]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.layer === layer)));
    draw();
  };
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, lon0: view.lon0, lat0: view.lat0 }; svg.setPointerCapture(e.pointerId); };
  const onMove = (e) => { if (!drag) return; view = { ...view, lon0: drag.lon0 - (e.clientX - drag.x) * 0.3, lat0: Math.max(-60, Math.min(70, drag.lat0 + (e.clientY - drag.y) * 0.3)) }; draw(); };
  const onUp = () => { drag = null; };
  const presets = host.querySelectorAll('[data-view]');
  const onPreset = (e) => { const [lat0, lon0] = e.currentTarget.dataset.view.split(',').map(Number); view = { ...view, lat0, lon0 }; draw(); };

  svg.addEventListener('click', onPick); svg.addEventListener('keydown', onKey);
  svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onMove); svg.addEventListener('pointerup', onUp);
  cards.addEventListener('click', onLayer);
  presets.forEach((b) => b.addEventListener('click', onPreset));
  loadGlobeAsset().then((g) => { land = g.points; draw(); }).catch(() => draw());
  draw(); show(industry.companies.filter((c) => c.tier === 1).map((c) => c.id));
  return () => { cards.removeEventListener('click', onLayer); presets.forEach((b) => b.removeEventListener('click', onPreset)); };
}
```

在 `sectors.html` 中，在第 3 章后插入第 4 章（章号小标签按 §8.3 顺序）：
```html
<section class="chapter" id="industryGlobe" aria-labelledby="industryGlobeTitle">
  <header class="chapter-head"><p class="chapter-no" data-en="04 · THE LISTED AI ECONOMY" data-zh="04 · 美股 AI 版图">04 · THE LISTED AI ECONOMY</p>
    <h2 id="industryGlobeTitle" data-en="The listed AI economy on one globe" data-zh="地球上的美股 AI 公司">The listed AI economy on one globe</h2>
    <p data-en="Every company here trades in New York, directly or through ADRs—plus the two labs that have filed to join them. Size shows how essential a company is to frontier AI; the ring shows where it is based." data-zh="这里的公司都在纽约交易，直接上市或通过 ADR；另加两家已递交上市申请的实验室。圆的大小表示对前沿 AI 的不可或缺程度，外圈颜色表示所在地。">Every company here trades in New York, directly or through ADRs—plus the two labs that have filed to join them. Size shows how essential a company is to frontier AI; the ring shows where it is based.</p></header>
  <ol class="layer-cards"></ol>
  <div class="globe-wrap">
    <svg class="globe" viewBox="0 0 640 640" role="group" aria-label="Globe of company headquarters" data-aria-en="Globe of company headquarters" data-aria-zh="公司总部地球"></svg>
    <div class="globe-presets" role="group" aria-label="Jump to region" data-aria-en="Jump to region" data-aria-zh="跳至地区">
      <button type="button" data-view="30,-100" data-en="North America" data-zh="北美">North America</button>
      <button type="button" data-view="35,120" data-en="East Asia" data-zh="东亚">East Asia</button>
      <button type="button" data-view="50,5" data-en="Europe" data-zh="欧洲">Europe</button></div>
    <ul class="globe-list" aria-live="polite"></ul>
  </div>
  <p class="chapter-note" data-en="Tier 1: frontier AI cannot be built without it today. Tier 2: a major supplier or platform. Tier 3: relevant. Tiers are editorial judgements; hollow markers are not listed in the US. Logos are trademarks of their owners, taken from official sites (see source ledger)." data-zh="1 级：当前没有它就做不出前沿 AI；2 级：主要供应商或平台；3 级：相关。等级为编辑判断；空心标记表示未在美上市。标志为各公司商标，取自官网（见来源台账）。">Tier 1: frontier AI cannot be built without it today. Tier 2: a major supplier or platform. Tier 3: relevant. Tiers are editorial judgements; hollow markers are not listed in the US. Logos are trademarks of their owners, taken from official sites (see source ledger).</p>
</section>
```

CSS（追加）：
```css
.chapter{max-width:var(--w-module);margin:160px auto 0;padding:0 20px}
.chapter-head{max-width:var(--w-text)}
.chapter-no{font:600 12px/1 var(--font-sans,system-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.layer-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--rule);border:1px solid var(--rule);list-style:none;padding:0;margin:40px 0}
.layer-cards button{all:unset;box-sizing:border-box;display:grid;gap:6px;width:100%;height:100%;padding:16px;background:var(--paper);cursor:pointer}
.layer-cards button[aria-pressed="true"]{background:var(--mark)}
.layer-cards button:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}
.layer-no{font:400 28px/1 var(--font-serif,Georgia);color:var(--ink)}
.layer-logos{display:flex;gap:6px}
.globe-wrap{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:32px;align-items:start}
.globe{width:100%;height:auto;touch-action:none}
.globe-disc{fill:var(--stage)}
.globe-land{stroke:var(--land);stroke-width:1.2}
.marker circle{fill:var(--paper);stroke-width:2}
.marker.is-unlisted circle{fill:none;stroke-dasharray:3 2}
.marker text{font:600 12px var(--font-sans,system-ui);text-anchor:middle;fill:var(--ink)}
.marker:focus-visible circle{stroke:var(--ink);stroke-width:3}
.globe-list{list-style:none;padding:0;max-height:560px;overflow:auto;display:grid;gap:16px}
.globe-list li{display:grid;grid-template-columns:28px 1fr;gap:12px}
.globe-list span{display:block;color:var(--muted);font-size:13px}
.logo-fallback{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--brand,var(--ink));color:#fff;font:700 9px var(--font-sans,system-ui)}
@media (max-width:768px){.layer-cards{grid-template-columns:repeat(2,1fr)}.globe-wrap{grid-template-columns:1fr}}
```

在 `src/pages/sectors.js` 装配：
- 取产业数据：`fetchJson('sectors-industry-2026-09-27')`
- 取 manifest：`fetch('/assets/sectors/logos/manifest.json').then(r => r.json())`
- 然后调用 `mountCompanyGlobe(byId('industryGlobe'), { industry, manifest, lang: currentLanguage() })`

- [ ] **Step 6: 浏览器检查**

`npm run build && npm run preview`，确认：
- 湾区显示为计数气泡，点击列出成员
- 点"03 算力芯片"后只剩该层公司
- 拖动能旋转
- 键盘 Tab 能聚焦标记，Enter 列出成员
- 断网（DevTools → Offline）刷新后，标志显示首字母圆章

截图到 `docs/sectors-81k-evidence/globe-*.png`。

- [ ] **Step 7: Commit**

```bash
git add src/sectors/industry/globe-layout.js src/sectors/industry/globe-view.js sectors.html public/styles/sectors-v2.css src/pages/sectors.js tests/sectorsGlobeLayout.test.js docs/sectors-81k-evidence
git commit -m "feat(sectors): company globe with tiered official logos and layer cards"
```

---

### Task 10: 关系网络、预设故事与手机端列表

**Files:**
- Create: `src/sectors/industry/graph-layout.js`、`src/sectors/industry/graph-view.js`
- Modify: `sectors.html`（新章 `#industryGraph`）、`public/styles/sectors-v2.css`、`src/pages/sectors.js`
- Test: `tests/sectorsIndustryGraph.test.js`

**Interfaces:**
- Consumes: `GRAPH_COLUMNS, EDGE_TYPES, EDGE_LABEL, STATUS_LABEL, LAYER_LABEL, renderable`（任务 3），manifest
- Produces:
  - `NODE_RADIUS = {1:14, 2:10, 3:7}`
  - `STORIES: { id, label:{en,zh}, focus, edgeIds:string[] }[]`
  - `layoutIndustryGraph(data, { width, height, types?, focus?, edgeIds? }) → { nodes: GNode[], edges: GEdge[] }`，其中：
    - `GNode = { id, x, y, r, column, country, dim }`
    - `GEdge = { id, type, stance:'cooperate'|'compete', crossBorder, dim, path }`
  - `edgesOf(data, id) → Edge[]`（按 `as_of` 倒序，只含 renderable）
  - `mountIndustryGraph(host, { industry, manifest, lang }) → () => void`

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsIndustryGraph.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRAPH_COLUMNS } from '../src/sectors/industry/industry-core.js';
import { STORIES, edgesOf, layoutIndustryGraph } from '../src/sectors/industry/graph-layout.js';

const data = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
const opts = { width: 1120, height: 760 };

describe('layoutIndustryGraph', () => {
  it('places every company once, left-to-right by supply-chain column', () => {
    const { nodes } = layoutIndustryGraph(data, opts);
    expect(nodes).toHaveLength(data.companies.length);
    const xOf = (col) => nodes.find((n) => n.column === col)?.x;
    const xs = GRAPH_COLUMNS.map(xOf).filter((x) => x != null);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    for (const n of nodes) { expect(n.y).toBeGreaterThan(0); expect(n.y).toBeLessThan(760); }
  });
  it('filters by edge type', () => {
    const { edges } = layoutIndustryGraph(data, { ...opts, types: ['competitor'] });
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((e) => e.stance === 'compete')).toBe(true);
  });
  it('draws cooperation and competition between the same pair as separate, offset paths', () => {
    const { edges } = layoutIndustryGraph(data, opts);
    const coop = edges.find((e) => e.id === 'spcx-ant-colossus');
    const rival = edges.find((e) => e.id === 'ant-spcx-rival');
    expect(coop.stance).toBe('cooperate');
    expect(rival.stance).toBe('compete');
    expect(coop.path).not.toBe(rival.path);
  });
  it('flags US–China edges as cross-border', () => {
    const { edges } = layoutIndustryGraph(data, opts);
    expect(edges.find((e) => e.id === 'ant-baba-rival').crossBorder).toBe(true);
    expect(edges.find((e) => e.id === 'tsm-nvda-foundry').crossBorder).toBe(false);
  });
  it('dims everything outside the focus neighbourhood', () => {
    const { nodes, edges } = layoutIndustryGraph(data, { ...opts, focus: 'anthropic' });
    expect(nodes.find((n) => n.id === 'googl').dim).toBe(false);
    expect(nodes.find((n) => n.id === 'vrt').dim).toBe(true);
    expect(edges.find((e) => e.id === 'tsm-nvda-foundry').dim).toBe(true);
  });
  it('skips unverified edges', () => {
    const copy = structuredClone(data);
    copy.edges[0].status = 'unverified';
    expect(layoutIndustryGraph(copy, opts).edges.some((e) => e.id === copy.edges[0].id)).toBe(false);
  });
});

describe('stories and ledger', () => {
  it('every story edge exists', () => {
    const ids = new Set(data.edges.map((e) => e.id));
    for (const s of STORIES) for (const id of s.edgeIds) expect(ids.has(id), `${s.id}:${id}`).toBe(true);
  });
  it('lists a company’s edges newest first', () => {
    const list = edgesOf(data, 'anthropic');
    expect(list.length).toBeGreaterThan(8);
    expect(list.map((e) => e.as_of)).toEqual([...list.map((e) => e.as_of)].sort().reverse());
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsIndustryGraph.test.js` → FAIL

- [ ] **Step 3: 实现布局**

```js
// src/sectors/industry/graph-layout.js
import { EDGE_TYPES, GRAPH_COLUMNS, renderable } from './industry-core.js';

export const NODE_RADIUS = { 1: 14, 2: 10, 3: 7 };

export const STORIES = [
  { id: 'ant-spacex', focus: 'anthropic', label: { en: 'Anthropic × SpaceX: partners and rivals', zh: 'Anthropic × SpaceX：既合作又竞争' },
    edgeIds: ['spcx-ant-colossus', 'ant-spcx-pay', 'ant-spcx-rival', 'nvda-spcx-gpus'] },
  { id: 'ant-capital', focus: 'anthropic', label: { en: 'The capital web around Anthropic', zh: '围绕 Anthropic 的资本网' },
    edgeIds: ['googl-ant-invest', 'amzn-ant-invest', 'msft-ant-invest', 'nvda-ant-invest', 'mu-ant-invest', 'googl-ant-rival'] },
  { id: 'oai-compute', focus: 'openai', label: { en: 'OpenAI’s compute web', zh: 'OpenAI 的算力网' },
    edgeIds: ['msft-oai-azure', 'orcl-oai-stargate', 'nvda-oai-chips', 'amd-oai-chips', 'avgo-oai-chips', 'crwv-oai-compute', 'amzn-oai-cloud', 'cbrs-oai-compute'] },
  { id: 'hbm', focus: 'nvda', label: { en: 'Three memory makers, one customer', zh: '三家存储厂，同一个客户' },
    edgeIds: ['skhy-nvda-hbm', 'mu-nvda-hbm', 'samsung-nvda-hbm', 'tsm-nvda-foundry'] },
];

export const edgesOf = (data, id) => data.edges
  .filter((e) => renderable(e) && (e.source === id || e.target === id))
  .sort((a, b) => (a.as_of < b.as_of ? 1 : a.as_of > b.as_of ? -1 : 0));

function curve(a, b, offset) {
  if (a.x === b.x) {                               // same column: arc out to the left
    const cx = a.x - 70 - Math.abs(offset) * 3;
    return `M${a.x} ${a.y}Q${cx} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y + offset}C${mx} ${a.y + offset} ${mx} ${b.y + offset} ${b.x} ${b.y + offset}`;
}

export function layoutIndustryGraph(data, { width, height, types = EDGE_TYPES, focus = null, edgeIds = null, pad = 36 }) {
  const pos = new Map();
  const colW = (width - 2 * pad) / (GRAPH_COLUMNS.length - 1);
  GRAPH_COLUMNS.forEach((col, i) => {
    const list = data.companies.filter((c) => c.layer === col).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    const step = (height - 2 * pad) / Math.max(list.length, 1);
    list.forEach((c, j) => pos.set(c.id, { id: c.id, x: pad + i * colW, y: pad + step * (j + 0.5), r: NODE_RADIUS[c.tier], column: col, country: c.country }));
  });
  const shown = data.edges.filter((e) => renderable(e) && types.includes(e.type) && (!edgeIds || edgeIds.includes(e.id)));
  const touches = (e) => !focus || e.source === focus || e.target === focus;
  const neighbours = focus ? new Set([focus, ...shown.filter(touches).flatMap((e) => [e.source, e.target])]) : null;
  const seen = new Map();
  const edges = shown.map((e) => {
    const a = pos.get(e.source), b = pos.get(e.target);
    const key = [e.source, e.target].sort().join('|');
    const k = seen.get(key) ?? 0; seen.set(key, k + 1);
    const offset = k === 0 ? 0 : (k % 2 ? 4 : -4) * Math.ceil(k / 2);
    const pair = new Set([a.country, b.country]);
    return { id: e.id, type: e.type, stance: e.type === 'competitor' ? 'compete' : 'cooperate',
      crossBorder: pair.has('US') && pair.has('CN'), dim: !touches(e), path: curve(a, b, offset) };
  });
  const nodes = [...pos.values()].map((n) => ({ ...n, dim: neighbours ? !neighbours.has(n.id) : false }));
  return { nodes, edges };
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run tests/sectorsIndustryGraph.test.js` → PASS（8 项）

- [ ] **Step 5: 实现视图（桌面 SVG + 手机列表 + 台账）**

```js
// src/sectors/industry/graph-view.js
import { EDGE_LABEL, EDGE_TYPES, GRAPH_COLUMNS, LAYER_LABEL, STATUS_LABEL } from './industry-core.js';
import { STORIES, edgesOf, layoutIndustryGraph } from './graph-layout.js';
import { escapeHtml, translate } from '../content.js';

export function mountIndustryGraph(host, { industry, manifest, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const byId = Object.fromEntries(industry.companies.map((c) => [c.id, c]));
  const src = Object.fromEntries(industry.sources.map((s) => [s.id, s]));
  const svg = host.querySelector('svg.graph');
  const ledger = host.querySelector('.graph-ledger');
  const picker = host.querySelector('select.graph-picker');
  const filters = host.querySelector('.graph-filters');
  const stories = host.querySelector('.graph-stories');
  const W = 1120, H = 760;
  let state = { types: [...EDGE_TYPES], focus: null, edgeIds: null };

  filters.innerHTML = EDGE_TYPES.map((k) => `<button type="button" data-type="${k}" aria-pressed="true" class="chip chip-${k}">${escapeHtml(t(EDGE_LABEL[k]))}</button>`).join('');
  stories.innerHTML = STORIES.map((s) => `<button type="button" data-story="${s.id}" aria-pressed="false">${escapeHtml(t(s.label))}</button>`).join('');
  picker.innerHTML = `<option value="">${translate('Choose a company', '选择公司', lang)}</option>` +
    GRAPH_COLUMNS.map((col) => `<optgroup label="${escapeHtml(t(LAYER_LABEL[col]))}">${industry.companies.filter((c) => c.layer === col)
      .map((c) => `<option value="${c.id}">${escapeHtml(t(c.name))}${c.ticker ? ` (${c.ticker})` : ''}</option>`).join('')}</optgroup>`).join('');

  function row(e) {
    const other = byId[e.source === state.focus ? e.target : e.source];
    const dir = e.source === state.focus ? '→' : '←';
    const amount = e.amount_usd_b ? translate(`$${e.amount_usd_b}B`, `${e.amount_usd_b * 10} 亿美元`, lang) : '';
    const links = e.source_ids.map((id) => `<a href="${src[id].url}" rel="noopener" target="_blank">${escapeHtml(src[id].publisher)}</a>`).join(' · ');
    return `<li class="ledger-${e.type}"><span class="ledger-type">${escapeHtml(t(EDGE_LABEL[e.type]))}</span>
      <strong>${dir} ${escapeHtml(t(other.name))}</strong> <time>${e.as_of}</time> ${amount ? `<b>${amount}</b>` : ''}
      <span class="status-tag" data-status="${e.status}">${escapeHtml(t(STATUS_LABEL[e.status]))}</span>
      <p>${escapeHtml(t(e.label))}</p><small>${links}</small></li>`;
  }

  function render() {
    const { nodes, edges } = layoutIndustryGraph(industry, { width: W, height: H, ...state });
    svg.innerHTML = `<defs><linearGradient id="usCn" gradientUnits="userSpaceOnUse" x1="0" x2="${W}"><stop offset="0" stop-color="var(--us)"/><stop offset="1" stop-color="var(--cn)"/></linearGradient></defs>
      ${GRAPH_COLUMNS.map((col, i) => `<text class="graph-col" x="${36 + i * ((W - 72) / 7)}" y="16">${escapeHtml(t(LAYER_LABEL[col]))}</text>`).join('')}
      ${edges.map((e) => `<path d="${e.path}" class="edge ${e.stance === 'compete' ? 'edge-compete' : 'edge-coop'} edge-${e.type}${e.dim ? ' is-dim' : ''}" ${e.crossBorder ? 'stroke="url(#usCn)"' : ''}/>`).join('')}
      ${nodes.map((n) => { const c = byId[n.id]; return `<g class="gnode${n.dim ? ' is-dim' : ''}${n.id === state.focus ? ' is-focus' : ''}" data-id="${n.id}" tabindex="0" role="button" aria-label="${escapeHtml(t(c.name))}" transform="translate(${n.x} ${n.y})">
        <circle r="${n.r}" class="ring-${n.country}"/><image href="${manifest[n.id]?.file ?? ''}" x="${-n.r * 0.6}" y="${-n.r * 0.6}" width="${n.r * 1.2}" height="${n.r * 1.2}"/>
        <text x="${n.r + 4}" dy="4">${escapeHtml(c.ticker ?? t(c.name))}</text></g>`; }).join('')}`;
    const list = state.focus ? edgesOf(industry, state.focus).filter((e) => state.types.includes(e.type) && (!state.edgeIds || state.edgeIds.includes(e.id))) : [];
    ledger.innerHTML = state.focus
      ? `<h3>${escapeHtml(t(byId[state.focus].name))}</h3><ol>${list.map(row).join('')}</ol>`
      : `<p>${translate('Select a company or a story to read its relationships.', '选择一家公司或一个故事，阅读其关系。', lang)}</p>`;
    picker.value = state.focus ?? '';
  }

  const onFilter = (e) => { const b = e.target.closest('[data-type]'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on));
    state = { ...state, types: EDGE_TYPES.filter((k) => filters.querySelector(`[data-type="${k}"]`).getAttribute('aria-pressed') === 'true') }; render(); };
  const onStory = (e) => { const b = e.target.closest('[data-story]'); if (!b) return;
    const s = STORIES.find((x) => x.id === b.dataset.story); const active = state.edgeIds === s.edgeIds;
    stories.querySelectorAll('[data-story]').forEach((x) => x.setAttribute('aria-pressed', String(!active && x === b)));
    state = active ? { ...state, focus: null, edgeIds: null } : { ...state, focus: s.focus, edgeIds: s.edgeIds }; render(); };
  const onNode = (e) => { const g = e.target.closest('[data-id]'); if (!g) return; if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
    e.preventDefault?.(); state = { ...state, focus: state.focus === g.dataset.id ? null : g.dataset.id, edgeIds: null }; render(); };
  const onPick = () => { state = { ...state, focus: picker.value || null, edgeIds: null }; render(); };

  filters.addEventListener('click', onFilter); stories.addEventListener('click', onStory);
  svg.addEventListener('click', onNode); svg.addEventListener('keydown', onNode); picker.addEventListener('change', onPick);
  render();
  return () => { filters.removeEventListener('click', onFilter); stories.removeEventListener('click', onStory); picker.removeEventListener('change', onPick); };
}
```

HTML（插在第 4 章后）：
```html
<section class="chapter" id="industryGraph" aria-labelledby="industryGraphTitle">
  <header class="chapter-head"><p class="chapter-no" data-en="05 · RELATIONSHIPS" data-zh="05 · 关系">05 · RELATIONSHIPS</p>
    <h2 id="industryGraphTitle" data-en="Who depends on whom—and who competes" data-zh="谁依赖谁，谁和谁竞争">Who depends on whom—and who competes</h2>
    <p data-en="Solid lines are cooperation; dashed lines are competition. Where the same two companies do both, you will see two lines. Lines that cross the Pacific fade from US blue to China red." data-zh="实线代表合作，虚线代表竞争；同一对公司既合作又竞争时，会出现两条线。跨越太平洋的线由美国蓝渐变为中国红。">Solid lines are cooperation; dashed lines are competition. Where the same two companies do both, you will see two lines. Lines that cross the Pacific fade from US blue to China red.</p></header>
  <div class="graph-stories" role="group" aria-label="Stories" data-aria-en="Stories" data-aria-zh="故事"></div>
  <div class="graph-filters" role="group" aria-label="Relationship types" data-aria-en="Relationship types" data-aria-zh="关系类型"></div>
  <label class="graph-picker-label"><span class="sr-only" data-en="Company" data-zh="公司">Company</span><select class="graph-picker"></select></label>
  <div class="graph-wrap"><svg class="graph" viewBox="0 0 1120 760" role="group" aria-label="Relationship network" data-aria-en="Relationship network" data-aria-zh="关系网络"></svg>
    <aside class="graph-ledger" aria-live="polite"></aside></div>
</section>
```

CSS（追加）：
```css
.graph-wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px}
.graph{width:100%;height:auto}
.graph-col{font:600 11px var(--font-sans,system-ui);letter-spacing:.06em;text-transform:uppercase;fill:var(--muted);text-anchor:middle}
.edge{stroke:var(--ink);opacity:.55}
.edge-investment{stroke:var(--ink)}
.edge.is-dim,.gnode.is-dim{opacity:.08}
.gnode circle{fill:var(--paper);stroke-width:2}
.ring-US{stroke:var(--us)}.ring-CN{stroke:var(--cn)}.ring-TW,.ring-KR,.ring-NL,.ring-UK,.ring-IE{stroke:var(--other)}
.gnode.is-focus circle{fill:var(--mark)}
.gnode text{font:500 11px var(--font-sans,system-ui);fill:var(--text)}
.gnode:focus-visible circle{stroke:var(--ink);stroke-width:3}
.graph-filters,.graph-stories{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.graph-filters button,.graph-stories button{font:500 13px var(--font-sans,system-ui);border:1px solid var(--rule);background:var(--paper);border-radius:999px;padding:6px 12px;cursor:pointer}
.graph-filters [aria-pressed="false"]{opacity:.45}
.graph-stories [aria-pressed="true"]{background:var(--mark);border-color:var(--ink)}
.graph-picker-label{display:none}
.graph-ledger ol{list-style:none;padding:0;display:grid;gap:14px}
.ledger-type{font:600 11px var(--font-sans,system-ui);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:block}
.ledger-competitor strong{text-decoration:underline dashed}
@media (max-width:768px){.graph{display:none}.graph-picker-label{display:block}.graph-wrap{grid-template-columns:1fr}}
```

装配：`mountIndustryGraph(byId('industryGraph'), { industry, manifest, lang: currentLanguage() })`

- [ ] **Step 6: Review Focus #5 的 e2e 用例（写进 `e2e/sectors-story.spec.js`，任务 13 统一扩充）**

```js
// e2e/sectors-story.spec.js
import { test, expect } from '@playwright/test';

test('relationship ledger works without the SVG on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/zh/sectors.html#industryGraph');
  await expect(page.locator('#industryGraph svg.graph')).toBeHidden();
  await page.selectOption('#industryGraph select.graph-picker', 'anthropic');
  await expect(page.locator('#industryGraph .graph-ledger li').first()).toBeVisible();
  await page.click('#industryGraph [data-type="competitor"]');
  await expect(page.locator('#industryGraph .ledger-competitor')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
```

Run: `npm run build && npx playwright test e2e/sectors-story.spec.js --project=chromium` → PASS

- [ ] **Step 7: 浏览器检查并提交**

检查以下三点，截图到 `docs/sectors-81k-evidence/graph-*.png`：
- 点"Anthropic × SpaceX"故事：出现 4 条线，其中 SpaceX↔Anthropic 为一实一虚平行线
- Anthropic↔阿里巴巴的线为蓝→红渐变虚线
- 右侧台账每条都有来源链接和状态标签

```bash
git add src/sectors/industry/graph-layout.js src/sectors/industry/graph-view.js sectors.html public/styles/sectors-v2.css src/pages/sectors.js tests/sectorsIndustryGraph.test.js e2e/sectors-story.spec.js docs/sectors-81k-evidence
git commit -m "feat(sectors): supply-chain relationship network with stories and source ledger"
```

---

### Task 11: 美国双雄与中美两章的视图

**Files:**
- Create: `src/sectors/industry/head-to-head-view.js`、`src/sectors/industry/rivalry-view.js`
- Modify: `sectors.html`（新章 `#usLeaders`、`#usChina`，放在第 1 章之后）、`public/styles/sectors-v2.css`、`src/pages/sectors.js`
- Test: `tests/sectorsIndustryViews.test.js`（jsdom 环境；文件顶部加 `// @vitest-environment jsdom`，确认 `jsdom` 已在 devDependencies，没有就 `npm i -D jsdom`）

**Interfaces:**
- Consumes: `headToHead, pairedScale`（任务 5）；`geographyLeaders, snapshotDims, divergingShares`（任务 6）；`renderable, STATUS_LABEL`（任务 3）
- Produces:
  - `mountHeadToHead(host, { snapshot, industry, lang, a='opus55-max', b='astra-max', ref='fable-max' }) → () => void`
  - `mountUsChina(host, { snapshot, industry, lang }) → () => void`

- [ ] **Step 1: 写失败测试**

```js
// tests/sectorsIndustryViews.test.js
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { mountHeadToHead } from '../src/sectors/industry/head-to-head-view.js';
import { mountUsChina } from '../src/sectors/industry/rivalry-view.js';

const snapshot = JSON.parse(readFileSync('public/data/sectors-frontier/2026-09-27.json', 'utf8'));
const industry = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));
let host;
beforeEach(() => { document.body.innerHTML = '<section id="h"><div class="h2h-bars"></div><div class="h2h-cards"></div><div class="h2h-scale"></div><div class="h2h-rsi"></div></section><section id="u"><div class="gap"></div><div class="dims"></div><div class="flows"></div></section>'; });

describe('mountHeadToHead', () => {
  beforeEach(() => { host = document.getElementById('h'); mountHeadToHead(host, { snapshot, industry, lang: 'zh' }); });
  it('draws one paired row per metric', () => expect(host.querySelectorAll('.h2h-row')).toHaveLength(snapshot.metrics.length));
  it('writes "not published" instead of a zero bar for missing values', () => {
    const missing = [...host.querySelectorAll('.h2h-row[data-missing]')];
    for (const r of missing) expect(r.textContent).toContain('未公布');
  });
  it('labels lab-claimed RSI figures', () => expect(host.querySelector('.h2h-rsi [data-status="lab_claimed"]')).not.toBeNull());
});

describe('mountUsChina', () => {
  beforeEach(() => { host = document.getElementById('u'); mountUsChina(host, { snapshot, industry, lang: 'en' }); });
  it('names a leader on every diverging row', () => {
    const rows = [...host.querySelectorAll('.dim-row')];
    expect(rows.length).toBe(industry.facts.dims.filter((d) => d.status !== 'unverified').length + 3);
    for (const r of rows) expect(['US', 'CN', 'tie']).toContain(r.dataset.leader);
  });
  it('marks friction flows as dashed', () => expect(host.querySelectorAll('.flow[data-friction="true"]').length).toBeGreaterThan(0));
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run tests/sectorsIndustryViews.test.js` → FAIL

- [ ] **Step 3: 实现双雄视图**

```js
// src/sectors/industry/head-to-head-view.js
import { headToHead, pairedScale } from './head-to-head.js';
import { STATUS_LABEL, renderable } from './industry-core.js';
import { escapeHtml, translate } from '../content.js';

const fmt = (v, unit) => (v == null ? null : unit === 'usd' || unit === 'usd_per_task' ? `$${v.toFixed(2)}` : String(v));

export function mountHeadToHead(host, { snapshot, industry, lang, a = 'opus55-max', b = 'astra-max', ref = 'fable-max' }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const name = (id) => snapshot.models.find((m) => m.id === id)?.name ?? id;
  const tag = (f) => `<span class="status-tag" data-status="${f.status}">${escapeHtml(t(STATUS_LABEL[f.status]))}</span>`;
  const r = headToHead(snapshot, a, b, { refId: ref });
  const na = translate('Not published', '未公布', lang);

  host.querySelector('.h2h-bars').innerHTML = `<p class="h2h-key"><i class="k-a"></i>${escapeHtml(name(a))} <i class="k-b"></i>${escapeHtml(name(b))} <i class="k-ref"></i>${escapeHtml(name(ref))}</p>` +
    r.rows.map((row) => {
      const s = pairedScale(row);
      if (row.leader === null) return `<div class="h2h-row" data-missing><span class="h2h-label">${escapeHtml(t(row.label))}</span><span class="h2h-na">${na}</span></div>`;
      const bar = (who, v) => `<span class="h2h-bar h2h-${who}${row.leader === who ? ' is-lead' : ''}" style="--w:${(s(v) * 100).toFixed(1)}%"><b>${fmt(v, row.unit)}</b></span>`;
      const refTick = row.ref != null ? `<span class="h2h-ref" style="--x:${(s(row.ref) * 100).toFixed(1)}%" title="${escapeHtml(name(ref))}: ${fmt(row.ref, row.unit)}"></span>` : '';
      const verdict = row.leader === 'tie' ? translate('Tie', '持平', lang) : translate(`${name(row.leader === 'a' ? a : b)} leads`, `${name(row.leader === 'a' ? a : b)} 领先`, lang);
      return `<div class="h2h-row" data-leader="${row.leader}"><span class="h2h-label">${escapeHtml(t(row.label))}${row.direction === 'lower' ? translate(' (lower is better)', '（越低越好）', lang) : ''}</span>
        <span class="h2h-track">${bar('a', row.a)}${bar('b', row.b)}${refTick}</span><span class="h2h-verdict">${escapeHtml(verdict)}</span></div>`;
    }).join('');

  const list = (ids) => ids.map((id) => t(snapshot.metrics.find((m) => m.id === id).label)).join(translate(', ', '、', lang));
  host.querySelector('.h2h-cards').innerHTML = `
    <article><h3>${escapeHtml(translate(`Where ${name(a)} leads`, `${name(a)} 领先之处`, lang))}</h3><p>${escapeHtml(list(r.aLeads) || '—')}</p></article>
    <article><h3>${escapeHtml(translate(`Where ${name(b)} leads`, `${name(b)} 领先之处`, lang))}</h3><p>${escapeHtml(list(r.bLeads) || '—')}</p></article>
    <article><h3>${escapeHtml(translate('Level', '持平', lang))}</h3><p>${escapeHtml(list(r.ties) || '—')}</p></article>
    <article><h3>${escapeHtml(translate('Not yet measured for both', '尚未同时测得', lang))}</h3><p>${escapeHtml(list(r.missing) || '—')}</p></article>`;

  const price = (id) => snapshot.models.find((m) => m.id === id)?.prices;
  const scale = industry.facts.scale.filter(renderable);
  host.querySelector('.h2h-scale').innerHTML = `<dl>
    ${[a, b].map((id) => `<div><dt>${escapeHtml(name(id))}</dt><dd>${translate(`$${price(id).input} / $${price(id).output} per 1M tokens`, `每百万 token $${price(id).input} / $${price(id).output}`, lang)}</dd></div>`).join('')}
    ${scale.map((f) => `<div><dt>${escapeHtml(f.company === 'anthropic' ? 'Anthropic' : 'OpenAI')} · ${escapeHtml(t(f.label))}</dt><dd>$${f.usd_b}B <time>${f.date}</time> ${tag(f)}</dd></div>`).join('')}</dl>`;

  host.querySelector('.h2h-rsi').innerHTML = industry.facts.rsi.filter(renderable).map((f) =>
    `<blockquote class="quote"><p>${f.value != null ? `<strong>${f.value}${f.unit === 'pct' ? '%' : f.unit === 'x' ? '×' : translate(' months', ' 个月', lang)}</strong> ` : ''}${escapeHtml(t(f.label))}</p>
     <footer>${tag(f)} ${f.source_ids.map((id) => { const s = industry.sources.find((x) => x.id === id); return `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.publisher)}</a>`; }).join(' · ')}</footer></blockquote>`).join('');
  return () => {};
}
```

说明：`cost_task` 在快照里的 `unit` 按实际值匹配 `fmt`。先运行 `node -e "console.log(require('./public/data/sectors-frontier/2026-09-27.json').metrics.find(m=>m.id==='cost_task').unit)"`，如果不是 `usd` 或 `usd_per_task`，把 `fmt` 中的条件改成该值。

- [ ] **Step 4: 实现中美视图**

```js
// src/sectors/industry/rivalry-view.js
import { divergingShares, geographyLeaders, snapshotDims } from './rivalry-math.js';
import { STATUS_LABEL, renderable } from './industry-core.js';
import { escapeHtml, translate } from '../content.js';

const num = (v, unit, lang) => unit === 'pct' ? `${v}%` : unit === 'usd_b' ? (lang === 'zh' ? `${v * 10} 亿美元` : `$${v}B`)
  : unit === 'usd_per_m' ? `$${v}` : unit === 'count' ? v.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-AU') : String(v);

export function mountUsChina(host, { snapshot, industry, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const tag = (f) => `<span class="status-tag" data-status="${f.status}">${escapeHtml(t(STATUS_LABEL[f.status]))}</span>`;
  const leaders = geographyLeaders(snapshot);

  const gaps = industry.facts.gap.filter(renderable);
  const max = Math.max(...gaps.map((g) => g.high ?? g.value)) + 2;
  host.querySelector('.gap').innerHTML = `<p class="gap-lede">${escapeHtml(translate(
    `In this snapshot the best US configuration (${leaders.US.name}, ${leaders.US.value}) leads the best Chinese one (${leaders.CN.name}, ${leaders.CN.value}) by ${leaders.points} index points. Estimates of the lag in time:`,
    `本快照中，美国最佳配置（${leaders.US.name}，${leaders.US.value}）领先中国最佳配置（${leaders.CN.name}，${leaders.CN.value}）${leaders.points} 个指数点。以时间计的落后估计：`, lang))}</p>
    <ol class="gap-scale">${gaps.map((g) => `<li style="--v:${(g.value / max) * 100}%;--lo:${((g.low ?? g.value) / max) * 100}%;--hi:${((g.high ?? g.value) / max) * 100}%">
      <span class="gap-label">${escapeHtml(t(g.label))} ${tag(g)}</span><span class="gap-track"><i class="gap-range"></i><b class="gap-dot">${g.value}</b></span></li>`).join('')}</ol>
    <p class="gap-axis">${escapeHtml(translate('Months behind the US frontier', '落后美国前沿的月数', lang))}</p>`;

  const dims = divergingShares([...snapshotDims(snapshot), ...industry.facts.dims.filter(renderable)]);
  host.querySelector('.dims').innerHTML = `<p class="dims-key"><span class="is-us">${translate('United States', '美国', lang)}</span><span class="is-cn">${translate('China', '中国', lang)}</span></p>` +
    dims.map((d) => `<div class="dim-row" data-leader="${d.leader}">
      <span class="dim-label">${escapeHtml(t(d.label))}${d.better === 'lower' ? translate(' (lower is better)', '（越低越好）', lang) : ''} ${d.source_ids[0] === 'snapshot' ? '' : tag(d)}</span>
      <span class="dim-bar"><i class="dim-us" style="--s:${(d.usShare * 100).toFixed(1)}%" data-v="${escapeHtml(num(d.us, d.unit, lang))}"></i><i class="dim-cn" style="--s:${(d.cnShare * 100).toFixed(1)}%" data-v="${escapeHtml(num(d.cn, d.unit, lang))}"></i></span>
      <span class="sr-only">${escapeHtml(translate(`US ${num(d.us, d.unit, lang)}, China ${num(d.cn, d.unit, lang)}`, `美国 ${num(d.us, d.unit, lang)}，中国 ${num(d.cn, d.unit, lang)}`, lang))}</span>
      <span class="dim-verdict ${d.leader === 'US' ? 'is-us' : d.leader === 'CN' ? 'is-cn' : ''}">${escapeHtml(d.leader === 'tie' ? translate('Level', '持平', lang) : d.leader === 'US' ? translate('US leads', '美国领先', lang) : translate('China leads', '中国领先', lang))}</span></div>`).join('') +
    industry.facts.shares.filter(renderable).map((s) => `<p class="share-callout is-cn"><strong>${s.value}%</strong> ${escapeHtml(t(s.label))} ${tag(s)}</p>`).join('');

  const flows = industry.facts.flows.filter(renderable);
  const col = (from) => flows.filter((f) => f.from === from).map((f) =>
    `<li class="flow" data-friction="${f.friction}">${escapeHtml(t(f.label))} ${tag(f)}</li>`).join('');
  host.querySelector('.flows').innerHTML = `<div class="flow-col"><h3 class="is-us">${translate('United States → China', '美国 → 中国', lang)}</h3><ul>${col('US')}</ul></div>
    <svg class="flow-arrows" viewBox="0 0 80 200" aria-hidden="true"><defs><linearGradient id="flowGrad" x1="0" x2="1"><stop offset="0" stop-color="var(--us)"/><stop offset="1" stop-color="var(--cn)"/></linearGradient></defs>
      <path d="M4 60H72" stroke="url(#flowGrad)" stroke-width="2" marker-end="url(#a)"/><path d="M76 140H8" stroke="url(#flowGrad)" stroke-width="2" stroke-dasharray="6 4"/></svg>
    <div class="flow-col"><h3 class="is-cn">${translate('China → United States', '中国 → 美国', lang)}</h3><ul>${col('CN')}</ul></div>
    <p class="flow-note">${escapeHtml(translate('Dashed items are points of friction: controls, bans or accusations.', '虚线标记的是摩擦点：管制、禁令或指控。', lang))}</p>`;
  return () => {};
}
```

- [ ] **Step 5: HTML、CSS、装配**

在 `sectors.html` 第 1 章之后插入两章，章号 02 与 03：
- 双雄章：`<section class="chapter" id="usLeaders">` 含 `.h2h-bars .h2h-cards .h2h-scale .h2h-rsi` 四个容器。章首文案：
  - 标题"同一国家的两个最强者 / Two leaders, one country"
  - 导语："Claude Opus 5.5 now tops the independent index; GPT-6 Astra still leads on several tasks and costs less per task on some. Read both columns. / Claude Opus 5.5 目前在第三方指数上居首；GPT-6 Astra 仍在若干任务上领先，在部分任务上每次成本更低。两列都要读。"
- 中美章：`<section class="chapter" id="usChina">` 含 `.gap .dims .flows`。标题"差距、所长与相互依赖 / Gap, strengths and mutual dependence"

原有章节编号依次后移：原"02 地域"并入舞台，按 spec §2.3 第 2 条删除。

CSS 追加：
```css
.h2h-row,.dim-row{display:grid;grid-template-columns:200px minmax(0,1fr) 120px;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--rule)}
.h2h-track{position:relative;display:grid;gap:3px}
.h2h-bar{display:block;height:12px;width:var(--w);border-radius:2px 5px 4px 2px;position:relative}
.h2h-bar b{position:absolute;left:calc(100% + 6px);top:-2px;font:500 12px var(--font-sans,system-ui);font-variant-numeric:tabular-nums}
.h2h-a{background:color-mix(in srgb,var(--us) 35%,var(--paper))}.h2h-a.is-lead{background:var(--us)}
.h2h-b{background:color-mix(in srgb,var(--us) 18%,var(--paper));outline:1px solid var(--us)}.h2h-b.is-lead{background:#4A6A96}
.h2h-ref{position:absolute;top:-3px;bottom:-3px;left:var(--x);width:0;border-left:1.5px dashed var(--ink)}
.h2h-na{color:var(--muted);font-style:italic}
.h2h-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--rule);border:1px solid var(--rule);margin:40px 0}
.h2h-cards article{background:var(--paper);padding:20px}
.quote{border-left:2px solid var(--ink);margin:32px 0;padding-left:20px;font:400 22px/1.4 var(--font-serif,Georgia);max-width:var(--w-text)}
.quote footer{font:600 12px var(--font-sans,system-ui);letter-spacing:.06em;text-transform:uppercase;margin-top:8px}
.dim-bar{display:flex;height:14px;margin:18px 0 0;position:relative}
.dim-us{width:var(--s);background:var(--us)}.dim-cn{width:var(--s);background:var(--cn)}
.dim-bar i{position:relative;font-style:normal;min-width:2px}
.dim-bar i::before{content:attr(data-v);position:absolute;bottom:calc(100% + 3px);font:500 12px/1 var(--font-sans,system-ui);font-variant-numeric:tabular-nums;white-space:nowrap}
.dim-us::before{left:0;color:var(--us)}.dim-cn::before{right:0;color:var(--cn-ink)}
.gap-track{position:relative;display:block;height:20px}
.gap-range{position:absolute;left:var(--lo);right:calc(100% - var(--hi));top:9px;height:2px;background:var(--rule)}
.gap-dot{position:absolute;left:var(--v);transform:translateX(-50%);font:600 12px var(--font-sans,system-ui);background:var(--ink);color:var(--paper);border-radius:999px;padding:2px 6px}
.flows{display:grid;grid-template-columns:1fr 80px 1fr;gap:16px}
.flow[data-friction="true"]{border-left:2px dashed currentColor;padding-left:8px}
.flow-note{grid-column:1/-1;color:var(--muted)}
@media (max-width:640px){.h2h-row,.dim-row{grid-template-columns:1fr}.h2h-cards{grid-template-columns:1fr}.flows{grid-template-columns:1fr}.flow-arrows{display:none}}
```

说明：分歧条的数值放在色条上方，用 `--us` / `--cn-ink` 写在纸面上。白字压在国旗红上只有 4.3:1，达不到正文要求，因此色条保持纯国旗色、不放文字；同时给屏幕阅读器写一份 `sr-only` 文本。

在 `src/pages/sectors.js` 中，快照与产业数据都就绪后，调用 `mountHeadToHead(byId('usLeaders'), …)` 与 `mountUsChina(byId('usChina'), …)`。

- [ ] **Step 6: 运行测试**

Run: `npx vitest run tests/sectorsIndustryViews.test.js` → PASS（5 项）

- [ ] **Step 7: Commit**

```bash
git add src/sectors/industry/head-to-head-view.js src/sectors/industry/rivalry-view.js sectors.html public/styles/sectors-v2.css src/pages/sectors.js tests/sectorsIndustryViews.test.js package.json package-lock.json
git commit -m "feat(sectors): US leaders light-and-shade bars and US–China gap, strengths and dependence"
```

---

### Task 12: IPO 与资本章

**Files:**
- Create: `src/sectors/industry/ipo-view.js`
- Modify: `sectors.html`（新章 `#capital`，章号 06）、`public/styles/sectors-v2.css`、`src/pages/sectors.js`
- Test: 追加到 `tests/sectorsIndustryViews.test.js`

**Interfaces:**
- Consumes: `industry.facts.ipo`、`industry.facts.valuation`、`renderable, STATUS_LABEL`
- Produces: `mountIpo(host, { industry, lang }) → () => void`

- [ ] **Step 1: 写失败测试（追加）**

```js
import { mountIpo } from '../src/sectors/industry/ipo-view.js';
describe('mountIpo', () => {
  it('hatches projections and sorts by amount raised', () => {
    document.body.innerHTML = '<section id="c"><div class="ipo-bars"></div><div class="ipo-ladder"></div></section>';
    const c = document.getElementById('c');
    mountIpo(c, { industry, lang: 'zh' });
    const bars = [...c.querySelectorAll('.ipo-bar')];
    expect(bars.map((b) => Number(b.dataset.raised))).toEqual([...bars.map((b) => Number(b.dataset.raised))].sort((a, b) => a - b));
    expect(c.querySelector('.ipo-bar[data-status="projection"] .status-tag').textContent).toBe('预期');
  });
});
```

Run → FAIL

- [ ] **Step 2: 实现**

```js
// src/sectors/industry/ipo-view.js
import { STATUS_LABEL, renderable } from './industry-core.js';
import { escapeHtml, translate } from '../content.js';

export function mountIpo(host, { industry, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const tag = (f) => `<span class="status-tag" data-status="${f.status}">${escapeHtml(t(STATUS_LABEL[f.status]))}</span>`;
  const usd = (b) => (lang === 'zh' ? `${b * 10} 亿美元` : `$${b}B`);
  const ipo = industry.facts.ipo.filter(renderable).sort((a, b) => a.raised_usd_b - b.raised_usd_b);
  const max = Math.max(...ipo.map((f) => f.raised_usd_b));
  host.querySelector('.ipo-bars').innerHTML = `<h3>${escapeHtml(translate('Money raised at IPO', 'IPO 募资额', lang))}</h3>` + ipo.map((f) =>
    `<div class="ipo-bar" data-status="${f.status}" data-raised="${f.raised_usd_b}"><span>${escapeHtml(t(f.label))} · ${f.year}</span>
     <i style="--w:${(f.raised_usd_b / max) * 100}%"></i><b>${usd(f.raised_usd_b)}</b> ${tag(f)}</div>`).join('');

  const val = industry.facts.valuation.filter(renderable);
  const vmax = Math.max(...val.map((v) => v.usd_b));
  const lane = (company, label) => `<div class="ladder-lane"><h4>${label}</h4><ol>${val.filter((v) => v.company === company)
    .map((v) => `<li data-status="${v.status}" style="--h:${(v.usd_b / vmax) * 100}%"><i></i><b>${usd(v.usd_b)}</b><span>${escapeHtml(t(v.label))} · ${v.date}</span> ${tag(v)}</li>`).join('')}</ol></div>`;
  host.querySelector('.ipo-ladder').innerHTML = `<h3>${escapeHtml(translate('Valuation steps', '估值阶梯', lang))}</h3>${lane('anthropic', 'Anthropic')}${lane('openai', 'OpenAI')}`;
  return () => {};
}
```

HTML：`<section class="chapter" id="capital">`，含 `.ipo-bars .ipo-ladder`。章首文案：
- 标题"历史上最大的 IPO？/ The largest IPO ever?"
- 导语："SpaceX set the record in June. Reports say Anthropic is preparing to raise more—until it prices, that remains a projection. / SpaceX 在 6 月创下纪录。报道称 Anthropic 准备募集更多资金——在正式定价前，这仍只是预期。"

CSS 追加：
```css
.ipo-bar{display:grid;grid-template-columns:220px minmax(0,1fr) 90px auto;gap:12px;align-items:center;padding:8px 0}
.ipo-bar i{display:block;height:18px;width:var(--w);background:var(--ink);border-radius:2px 5px 4px 2px}
.ipo-bar[data-status="projection"] i{background:repeating-linear-gradient(135deg,var(--ink) 0 3px,transparent 3px 7px);outline:1px solid var(--ink)}
.ladder-lane ol{display:flex;align-items:flex-end;gap:16px;height:220px;list-style:none;padding:0}
.ladder-lane li{display:grid;align-content:end;gap:4px;width:120px}
.ladder-lane li i{display:block;height:calc(var(--h) * 1.6px + 4px);background:var(--us)}
.ladder-lane li[data-status="projection"] i{background:repeating-linear-gradient(135deg,var(--us) 0 3px,transparent 3px 7px);outline:1px solid var(--us)}
@media (max-width:640px){.ipo-bar{grid-template-columns:1fr}}
```

- [ ] **Step 3: 运行测试并提交**

Run: `npx vitest run tests/sectorsIndustryViews.test.js` → PASS

```bash
git add src/sectors/industry/ipo-view.js sectors.html public/styles/sectors-v2.css src/pages/sectors.js tests/sectorsIndustryViews.test.js
git commit -m "feat(sectors): IPO and valuation chapter with projection hatching"
```

---

### Task 13: 章节重组、删除清单与文案比对

**Files:**
- Modify: `sectors.html`（按 §8.3 顺序排章，执行 §2.3 删除清单）、`public/styles/sectors-v2.css`（长文版式）
- Create: `scripts/sectors-copy-parity.mjs`、`tests/sectorsCopyParity.test.js`
- Modify: `e2e/sectors-story.spec.js`（扩充）
- 被取代的 e2e 用例：`e2e/sectors-{editorial,frontier,p2,p3,p4,reference-design}.spec.js`，其中仍有效的断言迁移到 `sectors-story.spec.js`，然后删除这几个文件（bfcache 用例保留）

**Interfaces:**
- Consumes: 改造前的 `sectors.html`（`git show main:sectors.html`）
- Produces: `extractCopy(html) → Set<string>`（所有 `data-en` 与 `data-zh` 的值）

- [ ] **Step 1: 写文案比对测试（失败）**

```js
// tests/sectorsCopyParity.test.js
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractCopy } from '../scripts/sectors-copy-parity.mjs';

// §2.3 deletions: strings that may disappear. Fill with the exact data-en values of the removed elements.
const ALLOWED_REMOVALS = JSON.parse(readFileSync('scripts/data/sectors-allowed-removals.json', 'utf8'));
const before = extractCopy(execSync('git show main:sectors.html', { encoding: 'utf8' }));
const after = extractCopy(readFileSync('sectors.html', 'utf8'));

describe('sectors copy parity', () => {
  it('drops only strings listed in the §2.3 deletion list', () => {
    const lost = [...before].filter((s) => !after.has(s) && !ALLOWED_REMOVALS.includes(s));
    expect(lost).toEqual([]);
  });
  it('keeps en/zh paired on every element', () => {
    const html = readFileSync('sectors.html', 'utf8');
    const en = (html.match(/\sdata-en="/g) ?? []).length;
    const zh = (html.match(/\sdata-zh="/g) ?? []).length;
    expect(en).toBe(zh);
  });
});
```

```js
// scripts/sectors-copy-parity.mjs
export function extractCopy(html) {
  const out = new Set();
  for (const [, v] of html.matchAll(/\sdata-(?:en|zh)="([^"]*)"/g)) if (v.trim()) out.add(v.trim());
  return out;
}
```

新建 `scripts/data/sectors-allowed-removals.json`，初始为 `[]`。

Run: `npx vitest run tests/sectorsCopyParity.test.js`
Expected: 任务 8 已删掉 `#sectorsEarth` 等元素，所以第一项 FAIL，并列出丢失的字符串。

- [ ] **Step 2: 执行重组**

按 §8.3 表格的章节顺序，调整现有 section 在 `sectors.html` 中的位置：
- 给保留的现有 section（`#editorialIntro`、`#frontierEditorial`、`#issuers`、`#evidence`、来源台账、`#researchArchive`）加上 `chapter` class，不另外包一层，id 保持在原元素上
- 各 section 内部 HTML 保持不变
- 删除 §2.3 列出的 6 类元素

然后逐条处理 Step 1 输出的丢失字符串：
- 属于 §2.3 删除清单的，加进 `sectors-allowed-removals.json`
- 不属于的，说明被误删，恢复到新位置

长文版式 CSS 追加：
```css
.chapter-head h2{font:400 40px/1.15 var(--font-serif,Georgia);letter-spacing:-.01em;color:var(--ink);text-wrap:balance;margin:12px 0}
.chapter p{font:400 20px/1.6 var(--font-serif,Georgia);max-width:var(--w-text)}
:lang(zh) .chapter p{font:400 17px/1.8 var(--font-sans-zh,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif);max-width:38em}
:lang(zh) .chapter-head h2{font-family:var(--font-serif-zh,"Noto Serif SC",serif);font-weight:600}
@media (max-width:640px){.chapter{margin-top:96px}.chapter-head h2{font-size:30px}.chapter p{font-size:18px}}
```

Run: `npx vitest run tests/sectorsCopyParity.test.js` → PASS

- [ ] **Step 3: 扩充 e2e**

```js
// append to e2e/sectors-story.spec.js
import AxeBuilder from '@axe-core/playwright';

for (const lang of ['en', 'zh']) {
  for (const width of [320, 390, 768, 1440]) {
    test(`${lang} @${width}: no horizontal scroll, chapters in order`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${lang}/sectors.html`);
      const ids = await page.$$eval('.stage, .chapter', (els) => els.map((e) => e.id));
      expect(ids.slice(0, 8)).toEqual(['sectorsStage', 'editorialIntro', 'frontierEditorial', 'usLeaders', 'usChina', 'industryGlobe', 'industryGraph', 'capital']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('reduced motion shows static stage frames', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/en/sectors.html');
  await expect(page.locator('#sectorsStage')).toHaveAttribute('data-mode', 'static');
  await expect(page.locator('#sectorsStage .stage-card')).toHaveCount(6);
});

test('Anthropic × SpaceX story shows both cooperation and competition', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/sectors.html#industryGraph');
  await page.click('[data-story="ant-spacex"]');
  await expect(page.locator('#industryGraph .edge-coop:not(.is-dim)')).not.toHaveCount(0);
  await expect(page.locator('#industryGraph .edge-compete:not(.is-dim)')).not.toHaveCount(0);
  await expect(page.locator('#industryGraph .graph-ledger a[href^="https://"]').first()).toBeVisible();
});

test('projection labels are visible on the IPO chapter', async ({ page }) => {
  await page.goto('/zh/sectors.html#capital');
  await expect(page.locator('#capital [data-status="projection"] .status-tag').first()).toHaveText('预期');
});

test('no serious or critical axe violations', async ({ page }) => {
  await page.goto('/en/sectors.html');
  const r = await new AxeBuilder({ page }).include('main').analyze();
  expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact))).toEqual([]);
});

test('logo failures fall back to monograms', async ({ page }) => {
  await page.route(/\/assets\/sectors\/logos\/.+\.(svg|png|webp)$/, (r) => r.abort());
  await page.goto('/en/sectors.html#industryGlobe');
  await expect(page.locator('#industryGlobe .layer-cards .logo-fallback').first()).toBeVisible();
});

test('keyboard reaches globe markers and graph nodes', async ({ page }) => {
  await page.goto('/en/sectors.html#industryGlobe');
  await page.locator('#industryGlobe .marker').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#industryGlobe .globe-list li').first()).toBeVisible();
});
```

- [ ] **Step 4: 迁移并删除旧 e2e**

逐个阅读 `sectors-{editorial,frontier,p2,p3,p4,reference-design}.spec.js`：
- 对应模块仍存在的断言（排行榜切换、弹窗、证据墙、依赖网络、历史档案展开），改用新选择器后复制进 `sectors-story.spec.js`
- 然后 `git rm` 这 6 个文件

更新 `e2e/visualization-accessibility.spec.js`、`e2e/afflatus-brand.spec.js` 中涉及 sectors 的选择器。

Run: `npm run build && npx playwright test e2e/sectors-story.spec.js e2e/sectors-bfcache.browser.js e2e/visualization-accessibility.spec.js --project=chromium`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add -A sectors.html public/styles/sectors-v2.css scripts/sectors-copy-parity.mjs scripts/data/sectors-allowed-removals.json tests/sectorsCopyParity.test.js e2e
git commit -m "feat(sectors): 81k chapter order, deletion list and copy parity guard"
```

---

### Task 14: 字体（仅 sectors 启用）

**Files:**
- Create: `public/assets/fonts/newsreader-var.woff2`、`hanken-grotesk-var.woff2`、`noto-serif-sc-subset.woff2`、`scripts/subset-cjk-fonts.mjs`
- Modify: `public/page-turn.css`（`@font-face` + 变量）、`package.json`（`prebuild` 开头加 `node scripts/subset-cjk-fonts.mjs &&`）、`sectors.html`（preload 两个拉丁字体）、`THIRD_PARTY_NOTICES.md`（OFL）
- Test: `tests/sectorsFonts.test.js`

**Interfaces:**
- Produces: CSS 变量 `--font-serif` `--font-sans` `--font-serif-zh` `--font-sans-zh`，定义在 `.sectors` 上（全站切换留给另一份计划）

- [ ] **Step 1: 下载字体（用户电脑上执行）**

从 Google Fonts 的 GitHub 源（https://github.com/google/fonts ：`ofl/newsreader`、`ofl/hankengrotesk`、`ofl/notoserifsc`）下载可变字体 TTF，再转换：
```bash
pyftsubset Newsreader[opsz,wght].ttf --unicodes="U+0000-024F,U+2000-206F,U+20AC,U+2122" --flavor=woff2 --output-file=public/assets/fonts/newsreader-var.woff2 --layout-features='*'
pyftsubset HankenGrotesk[wght].ttf --unicodes="U+0000-024F,U+2000-206F,U+20AC,U+2122" --flavor=woff2 --output-file=public/assets/fonts/hanken-grotesk-var.woff2 --layout-features='*'
```
把 `NotoSerifSC-SemiBold.ttf` 放到 `scripts/fonts-src/`（加入 `.gitignore`）。

- [ ] **Step 2: 写失败测试**

```js
// tests/sectorsFonts.test.js
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('sectors fonts', () => {
  it.each(['newsreader-var', 'hanken-grotesk-var', 'noto-serif-sc-subset'])('%s exists and is small', (f) => {
    const p = `public/assets/fonts/${f}.woff2`;
    expect(existsSync(p)).toBe(true);
    expect(statSync(p).size).toBeLessThan(f.startsWith('noto') ? 400_000 : 150_000);
  });
  it('declares font-display: swap', () => {
    const css = readFileSync('public/page-turn.css', 'utf8');
    expect(css.match(/@font-face[^}]+font-display:\s*swap/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
```
Run → FAIL（CJK 子集尚不存在）

- [ ] **Step 3: 子集化脚本**

```js
// scripts/subset-cjk-fonts.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';

const SRC = 'scripts/fonts-src/NotoSerifSC-SemiBold.ttf';
const OUT = 'public/assets/fonts/noto-serif-sc-subset.woff2';
if (!existsSync(SRC)) { console.log('subset-cjk-fonts: source font missing, keeping committed subset'); process.exit(0); }
const files = ['sectors.html', ...readdirSync('public/data/sectors-industry').map((f) => `public/data/sectors-industry/${f}`)];
const chars = new Set();
for (const f of files) for (const ch of readFileSync(f, 'utf8')) if (/[　-鿿＀-￯]/.test(ch)) chars.add(ch);
writeFileSync('scripts/fonts-src/chars.txt', [...chars].join(''));
execFileSync('pyftsubset', [SRC, '--text-file=scripts/fonts-src/chars.txt', '--flavor=woff2', `--output-file=${OUT}`]);
console.log(`subset-cjk-fonts: ${chars.size} glyphs`);
```

在 `page-turn.css` 顶部加：
```css
@font-face{font-family:"Newsreader";src:url(/assets/fonts/newsreader-var.woff2) format("woff2");font-weight:200 800;font-display:swap}
@font-face{font-family:"Hanken Grotesk";src:url(/assets/fonts/hanken-grotesk-var.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Noto Serif SC Subset";src:url(/assets/fonts/noto-serif-sc-subset.woff2) format("woff2");font-weight:600;font-display:swap}
.sectors{--font-serif:"Newsreader",Georgia,serif;--font-sans:"Hanken Grotesk",system-ui,sans-serif;
  --font-serif-zh:"Noto Serif SC Subset","Noto Serif SC","Songti SC",serif;--font-sans-zh:"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif}
```
在 `sectors.html` 的 `<head>` 加入：
```html
<link rel="preload" href="/assets/fonts/newsreader-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/hanken-grotesk-var.woff2" as="font" type="font/woff2" crossorigin>
```

- [ ] **Step 4: 运行并提交**

```bash
node scripts/subset-cjk-fonts.mjs && npx vitest run tests/sectorsFonts.test.js
git add public/assets/fonts scripts/subset-cjk-fonts.mjs public/page-turn.css package.json sectors.html THIRD_PARTY_NOTICES.md tests/sectorsFonts.test.js .gitignore
git commit -m "feat(sectors): Newsreader, Hanken Grotesk and subset Noto Serif SC for the sectors page"
```

---

### Task 15: 全量验收

**Files:**
- Create: `docs/sectors-81k-evidence/README.md`（截图索引 + 验收结果）

- [ ] **Step 1: 全量构建与测试**

```bash
npm run build
npm test
npx playwright test e2e/sectors-story.spec.js e2e/sectors-bfcache.browser.js e2e/visualization-accessibility.spec.js e2e/quality-gates.spec.js
```
Expected: 全部通过。任何失败先用 superpowers:systematic-debugging 定位，不能跳过。

- [ ] **Step 2: 数值逐项比对**

```bash
node -e "
const s=require('./public/data/sectors-frontier/2026-09-27.json');
const i=require('./public/data/sectors-industry/2026-09-27.json');
console.log('models',s.models.length,'obs',s.observations.length,'companies',i.companies.length,'edges',i.edges.length);
console.log('unverified edges',i.edges.filter(e=>e.status==='unverified').map(e=>e.id));
"
```
在预览页面中逐章抽查：每个数字都能在两份 JSON 中找到同值，列表写进 README。

- [ ] **Step 3: Lighthouse**

Run: `npm run test:lighthouse`
Expected: sectors 页的 LCP、CLS 不劣于 `lighthouse-baseline.json`。劣化时优先检查舞台画布（改为首帧后再加载陆地点阵）和字体 preload。

- [ ] **Step 4: 截图**

对 en/zh × 320/390/768/1440 截取以下内容，存入 `docs/sectors-81k-evidence/`，并在 README 列出：
- 整页
- 双雄、中美、地球、网络、资本各章

- [ ] **Step 5: 独立复核**

用 superpowers:requesting-code-review 派一个未参与实现的审查者，给它 spec §8 与本计划。审查重点：
1. 页面上每个"领先"表述是否都来自计算结果
2. `projection` / `lab_claimed` 标签是否可见
3. 标志来源是否全部来自官方域名
4. 色彩 token 是否全部生效

- [ ] **Step 6: Commit**

```bash
git add docs/sectors-81k-evidence
git commit -m "docs(sectors): acceptance evidence for the 81k redesign"
```

不部署。把预览地址和截图索引交给用户确认后，再按 superpowers:finishing-a-development-branch 合并。
