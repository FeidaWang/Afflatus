# U21 Phase 1 · 技术栈评估 + 数据结构审计（2026-07-12）

> 角色：Expert Frontend Architect。对象：feida.au（本仓库）。
> 纪律：评估基于仓库实际代码与数据，不基于流行度；所有「该换」的结论必须给出触发条件，所有「不换」的结论必须给出理由。C5（roadmap §8.4）的「暂不做 Astro 迁移」裁决为本文前提，除非本文提出推翻证据。
> 后续：Phase 2（性能）/ Phase 3（UI/UX）见 Urgent.md U21 队列。

## 0. 现状快照（实测，非自述）

| 层 | 现状 |
| --- | --- |
| 构建 | Vite 8.0.14，MPA 多入口 ×10 HTML；Vitest 4.1.9（518 tests / 37 files）；TS 5.7 仅 typecheck（checkJs 模式） |
| 运行时 | 无框架 vanilla ES modules；three@0.160.1（首页 WebGL）；astronomy-engine@2.1.19（星历，纯函数） |
| 样式 | src/styles.css **7788 行**（全局层叠，「文末追加 + !important 赢」）+ public/styles/ 每页独立 CSS ×8 |
| 部署 | Vercel 静态 + 2 个 serverless functions（api/quote、api/history，Finnhub 代理）；GA4 延迟注入；@view-transition 已启用 |
| 数据层 | **git 即数据库**：8 个 public/*.json 由定时 agent 会话夜间写入并 commit+push；页面前端 fetch 同源 JSON 渲染 |
| 体积 | 主 chunk 864.72 kB（gzip ~241 kB）；novels-data.json 485 kB；其余 JSON 0–27 kB |

## 1. 技术栈评估：什么过时、什么不过时

### 1.1 不过时、且是相对优势的（保持，别被潮流带跑）

- **Vite 8 / Vitest 4**：均为当前主版本，无升级债。
- **无框架 MPA + View Transitions**：10 个页面中 9 个是「内容 + 轻交互」页，无共享组件树、无客户端路由需求。上框架（React/Vue/Svelte）在此只会引入 hydration 成本和依赖更新债——**这不是落后，是对的选型**。触发重估条件（写死）：出现需要跨页共享的有状态组件 ≥3 个，或某页交互复杂到 vanilla 事件绑定超过 ~800 行。
- **git-as-database 数据管线**：JSON 进 git = 免费的版本历史、审计、回滚（f2836e3 事故就是靠它回的）。规模（<1 MB/文件、日更频率）远未到需要数据库的水位。**这是本站最独特的架构资产，Phase 2/3 不许动它。**
- **serverless 代理**（api/quote）：正确地把密钥挡在了客户端之外。

### 1.2 真实的债（按 ROI 排序）

| # | 债 | 证据 | 处方 | 何时 |
| --- | --- | --- | --- | --- |
| D1 | **styles.css 7788 行 append-only 层叠** | 9 处重复 `--hud-cols`、约 40 处已知死选择器、12a 体检 | 见 §1.3，用 `@layer` 分层止血，不重写 | Phase 2 前置 |
| D2 | **无 CI** | 518 测试只在本地/agent 会话跑，push 无门禁 | GitHub Actions：vitest + `vite build` + linkinator（脚本已有），~20 行 yaml | 立即，成本最低收益最高 |
| D3 | **主 chunk 864 kB 无预算钳制** | build 输出 chunkSizeWarningLimit 警告长期被无视 | Phase 2 主战场：three 动态 import + manualChunks；先在 CI 加体积预算断言（超 900 kB 即 fail）防继续恶化 | 预算立即，拆分 Phase 2 |
| D4 | **novels-data.json 485 kB 单文件** | 打开 serial.html 即全量下载 3 本书全部章节 | 见 §2.5 拆分方案 | Phase 2 |
| D5 | three 钉在 0.160（2024 版本） | package.json | 不紧急：WebGL 代码稳定、无安全面。升级须配真机视觉回归，单独立项 | 队列 B |
| D6 | main.js 3477 行单文件 | 首页所有特性混居 | 按特性拆 ES modules（repo 其他页已是此模式）；只在下次动首页时顺手做，不专项重构 | 搭车 |

### 1.3 D1 的现代处方：CSS Cascade Layers（不重写、渐进接管）

「文末追加靠 source order 赢」的根因是全部规则同层竞争。`@layer` 让优先级显式化，且**旧代码原样变成最低层，一行不用改**：

```css
/* styles.css 顶部加一行，旧内容整体包进 legacy 层 */
@layer legacy, tokens, components, overrides;

@layer legacy {
  /* ……现有 7788 行原样搬入（一次机械缩进，git diff -w 可验无实质变化）…… */
}

@layer tokens {
  :root { /* 设计令牌集中地：色彩/间距/字号，Phase 3 的设计系统落点 */ }
}

@layer overrides {
  /* 今后所有「最终覆盖」写在这里——天然赢过 legacy，!important 可以退休 */
}
```

配套纪律（写进 CLAUDE.md 级红线）：新规则只许进 `components`/`overrides`；`!important` 新增数从此为 0；stylelint 加 `declaration-no-important`（对 legacy 层豁免）。**效果**：债务冻结在 legacy 层，清理变成可选项而非前提。

### 1.4 该补的现代化（小而实）

- **CI（D2）**：`.github/workflows/ci.yml` = install → vitest → build → 体积断言。20 行解决「深夜 push 无门禁」（对冲 Playbook R4）。
- **JSDoc 渐进类型**：数据层纯函数（arenaRules/horoscopeEngine 等）加 `@typedef`，tsc checkJs 立即受益，零构建改动。
- **stylelint + prettier**：只对新增行生效（lint-staged），不碰存量。

### 1.5 明确不采纳的（写死，防反复横跳）

- ❌ Astro/Next 迁移——C5 已裁决，本文维持：迁移成本（10 页 × 双语 × WebGL 特例）>> 收益（本站无 SEO 增长诉求、无组件复用瓶颈）。
- ❌ Tailwind 全站替换——7788 行存量 CSS 的站点引 Tailwind 等于养两套体系；Phase 3 用 design tokens（@layer tokens）达到同等一致性，见该阶段。
- ❌ 数据库/CMS——违反 §1.1 git-as-database 结论。

## 2. 数据结构审计（8 个 public/*.json）

### 2.1 反模式 A：双语字段两套约定并存（全数据层最大不一致）

同一仓库同时存在**后缀式**和**嵌套式**：

```jsonc
// 后缀式（leagues/games/sectors/signal/arena-news 大量使用）
{ "note_en": "...", "note_zh": "...", "reason_en": "...", "reason_zh": "..." }
// 嵌套式（sectors.weeklyTake、signal.pillarSummary）
{ "weeklyTake": { "zh": "...", "en": "..." } }
```

每个消费端都要各写一套分支（stats.html 的 `zh() ? s.round_zh : s.round` 就是这种代码）。**统一为嵌套式** `{ "en": ..., "zh": ... }` + 一个 5 行工具：

```js
// src/lib/i18nData.js
export const t = (v, lang) => (v && typeof v === 'object' && ('en' in v || 'zh' in v))
  ? (v[lang] ?? v.en ?? v.zh) : v;
```

迁移策略：**新文件新字段一律嵌套式；存量文件在各自 agent 任务下一次自然重写时换**（每个 JSON 只有一个写入方，切换零协调成本），版本字段 +1，消费页同 commit 适配。不搞一次性大迁移。

### 2.2 反模式 B：预测比分的方向性歧义（已产生过真 bug）

`leagues-data.series[].opusScore: "3-1"` 未定义是「主-客」还是「被选队-对手」——U18 实测发现 `msi-lb-r2-g2` 预测 away(T1) 却写 "3-1"（主客序应为 "1-3"），恰与实际主队比分字符串撞车，若非 U19 修正口径（exact 必须以 ok 为前提）就是一笔假「比分全中」。**结构性修复**：

```jsonc
// before
{ "opus": "away", "opusScore": "3-1", "conf": 0.78 }
// after —— 无歧义、可校验（score.home/away 与 opus 侧必须自洽）
{ "pick": { "side": "away", "score": { "home": 1, "away": 3 }, "conf": 0.78 } }
```

### 2.3 反模式 C：存储派生聚合，与原始记录漂移

`record.{resolved,correctOutcome,winRate}` 是 `series[].result` 的派生值，却独立手写——已观测到 `record.log` 只有 8 条而 series 已判定 13 场。**规则：原始数据为唯一事实源，聚合读时派生**（stats.html 已这么做）。若要保留聚合字段（老页面依赖），加一个 10 行 invariant 脚本进 vitest：算出的聚合 ≠ 存储的聚合即 fail。

### 2.4 反模式 D：靠字符串匹配对齐实体

`finalsMvp` 将与 `mvp[].team`（形如 `"Knight · BLG"` 的显示字符串）做全等比较——空格/分隔符一变就匹配失败。实体引用应结构化：

```jsonc
// before
{ "mvp": [{ "team": "Knight · BLG", "prob": 40 }], "finalsMvp": "Knight · BLG" }
// after
{ "mvp": [{ "player": "Knight", "team": "BLG", "prob": 40 }],
  "finalsMvp": { "player": "Knight", "team": "BLG" } }
```

### 2.5 效率问题：novels-data.json 485 kB 全量下载

阅读器打开即拉 3 本书全部正文。拆为索引 + 按需分片：

```
public/novels-index.json        // ~2 kB：[{id, novel:{title,intro,...}, chapterCount}]
public/novels/wjzc.json         // 单本全章（或再按 50 章分卷）
```

serial.html 先渲染书架（索引），选中书再 fetch 对应分片；书签/进度的 nsKey 机制不受影响。首屏 payload 约 -66%，且日更只 diff 一本书的文件，git 历史更干净。（实施归 Phase 2。）

### 2.6 达标项（点名表扬，防止误伤）

`transits-daily.json`（纯数值、无双语散文、原子日更）与 `arena-predlog.json`（rolling window + upsert 由脚本代码强制、禁止手改）是全数据层最干净的两个文件——**后者的「JSON 只许经 settlement 脚本修改」模式应推广为所有 agent 写入文件的标准**（leagues/games 目前是 agent 直接手写 JSON，schema 漂移风险全靠 prompt 自觉）。

### 2.7 审计落地清单

- [ ] 每个 public/*.json 配一份 JSON Schema（`schemas/`），vitest 加 schema 校验测试（新增 ~1 个测试文件）；定时任务 prompt 在「验收」步加 `node scripts/validate-data.mjs`。
- [ ] 2.2 / 2.4 的结构修复随各自数据任务的下一次自然更新落地（一个写入方原则，见 2.1 迁移策略）。
- [ ] 2.3 invariant 测试；2.5 拆分归 Phase 2。

## 3. 裁决汇总

| 决定 | 内容 |
| --- | --- |
| 立即做 | D2 CI + 体积预算断言；2.7 的 schema 校验骨架 |
| Phase 2 做 | D3 chunk 拆分、D4/2.5 novels 分片、D1 @layer 落地 |
| Phase 3 做 | tokens 层设计系统、双语数据 t() 工具全站接线 |
| 搭车做 | D6 main.js 拆分、2.2/2.4 结构修复（随数据任务自然更新） |
| 不做 | 框架迁移、Tailwind 全站、数据库（触发条件见 §1.2/§1.5，条件不满足不重开） |
