# KNOWLEDGE.md — Project Afflatus 知识库总纲

> **用法**：任何新会话/新任务先读本文件，再按 §8 索引跳到唯一真源。本文件是**蒸馏 + 索引**，不承载运行状态（状态在 Urgent.md）、不替代规格（规格在 roadmap.md §7）、不重复归档（归档在 RELEASE_NOTES.md）。
> **维护规则**：只在结构性事实变化（新页面/新数据文件/新红线/架构裁决）时更新；日常进度不进本文件。
> 整理基线：2026-07-13，覆盖全仓库 15 个 md（~3100 行）。

## 目录

1. [站点一览](#1-站点一览) · 2. [三层工作流](#2-三层工作流) · 3. [红线清单](#3-红线清单) · 4. [架构核心事实](#4-架构核心事实) · 5. [数据文件台账](#5-数据文件台账) · 6. [已裁决决策索引](#6-已裁决决策索引) · 7. [已知坑](#7-已知坑) · 8. [文件职责地图](#8-文件职责地图)

---

## 1. 站点一览

- **feida.au** · Vercel（push 即部署）· GitHub `FeidaWang/Afflatus` main · GA4
- **技术栈**：Vite 8 MPA（每页一个 HTML 入口 + 一个 entry.js）· vanilla ES modules（**无框架，裁决见 §6**）· three@0.160（仅首页）· astronomy-engine（观星台，动态 import）· vitest 535 · TS checkJs · 2 个 serverless 函数（`api/quote`、`api/history`，key 在 Vercel 环境变量）
- **页面**（导航循环序）：

| 页 | 身份 | 状态 |
| --- | --- | --- |
| index | 深空舰长日志（Three.js + 战斗 HUD） | 常设·顶层 |
| arena | 美股 TA 仪表盘 + Autopilot 双模拟盘 | 常设·顶层 |
| sectors | 中美 AI 矩阵 + 后内存专题 | 常设·顶层 |
| signal | 美联储观察（SCP 皮肤，Warsh 时代） | 常设·顶层 |
| games | 世界杯竞猜 | Labs·**2026-07-20 决赛后下线归档**（任务 `urgent-u18c-wc-archive`） |
| ~~league~~ | MSI 竞猜 | **已下线**→302 到 stats（U18） |
| stats | 竞猜战绩存档（Wilson/Brier/bootstrap 统计仪表盘） | Labs·U18/U19 新增 |
| horoscope | 观星台：八字×占星×紫微，全本地零后端 | Labs |
| serial | 小说书架 ×3 部（《玉熙宫词》150 章脚本执行中=队列 B 最高优先） | Labs |
| course | 个人 AI 工程课程 v3.0（技术树+测评+每周一自动周报） | Labs |

## 2. 三层工作流

**「对话可弃，文件永存」**：

| 层 | 文件 | 规则 |
| --- | --- | --- |
| 当前冲刺 | `Urgent.md` | 只放正在处理的问题；完成即划掉、全文转 RELEASE_NOTES |
| 规划+规格 | `roadmap.md` | 队列 A（工程）/ B（功能）只留编号+一句话；细节在 §3–§9 |
| 归档 | `RELEASE_NOTES.md` | append-only 完整实施记录 |

- **一事一会话**：新会话开头「读 Urgent.md / roadmap §X 继续」即满血接力；卡顿即写状态换会话。
- **RFC 先行**（course O1）：>1 天的改动先写 `rfcs/`，动码另起会话。
- **定时任务台账**：Urgent.md **U20 表**是唯一真源（当前 10 个：市场 5 / 赛事 2 / 课程 1 / 一次性 1 + leagues 待删）；每月 1 号对照审计；限时任务必带到期日；任务无状态。

## 3. 红线清单

**内容红线**（全站永久）：仅供娱乐 / not advice；禁付费解锁·焦虑营销·黑模式钩子；康健只说作息不说病；文案 `data-en`/`data-zh` 成对；中文引号用「」（直引号在 JSON 里踩过语法坑）。

**工程红线**：

- **沙盒无法渲染** → 一切视觉/WebGL 改动只能代码完成，**站主真机验收才算关闭**（V15 三轮返工换来的纪律）。
- **R1** 永不合并解释不了的代码 · **R2** token 三问（能预消化吗/能进 system 吃缓存吗/能限长吗）· **R3** 待验收 >5 项冻结新视觉改动 · **R4** 23 点后只写不 push 主干 · **R5** 会话结束 git status 必须干净 · **R6** 每周 10 分钟架构审视。
- **LLM 提案、代码收单**：账本/记录类 JSON（arena-ledger、arena-predlog）只许经 settlement 脚本修改，禁止手编；`validate-data.mjs`（U21）发布前必跑。
- **key 红线**：`scripts/` 进 git，任何脚本禁明文 key（泄露过一次）；能走 `/api/*` 代理一律走代理。
- **prompts 五条硬规则**（详见 prompts/README.md）：system/run 拆分吃缓存 · 强制 JSON 输出 · 状态外置零会话记忆 · 只认 payload 数据禁训练记忆报事实 · 长度硬上限。**数据预消化**：一个数字模型算得出来 ≠ 应该让模型算。
- **新增视觉性能红线**：禁独立 rAF 循环；实例化资产每类 ≤1 draw call；`prefers-reduced-motion` 全覆盖。

## 4. 架构核心事实

- **加新页 checklist**（V0 走通，全文见 technical.md §1）：HTML 放根目录 → vite.config input 加行 → 建 `src/pages/xxxEntry.js`（**nav 必须 import 在 page-turn 之前**）→ nav.js `SITE` 加条目（季节页打 `group:'labs'`）→ body class + data-prev/next + `data-afflatus-nav` → page-turn.css 配色变量 → 双语文案 → sitemap 加行 → build 后**按内容 grep**（不按 chunk 文件名）验证。
- **⚠️ Vite 8 陷阱**：同页挂多个独立 `<script type="module">`，chunk 去重不可靠会**静默丢码**——永远每页一个显式 import 链入口。
- **nav.js `SITE` 数组 = 全站导航/翻页唯一真源**；`data-no-page-turn`（U16）可让单页豁免 ←/→ 键盘翻页（serial 已用，沉浸阅读）。
- **首页渲染分层**：`#starfield`（Worker）→ `#blackhole-gl` → `#event-layer`；combat 默认 HMD v3（`combatHmdV3.js`），SC 面板/俯视图是 `?combatview=` 可选皮肤；`cameraDirector.js` 文件名已被起降运镜占用，新相机状态机另起名。
- **CSS**：`src/styles.css` 已 `@layer legacy/tokens/components/overrides` 分层（U21 实施）——新规则只进 components/overrides，**新增 `!important` 数为 0**（CI 有 `check-no-new-important.mjs` 守门）。
- **CI（U21 实施）**：vitest + typecheck + build + 体积预算断言 + 数据 schema 校验。
- **测试**：535 条全过是合并前提；纯函数不依赖 DOM/fetch/Date.now 默认值（now 显式传入）。

## 5. 数据文件台账

> git 即数据库（版本历史=审计=回滚）。顶层统一 `{updated, version}`，前端溯源徽章按数据龄分级。双语字段新约定：嵌套 `{en,zh}`（U21，存量随写入方自然更新迁移）。

| 文件 | 写入方 | 消费页 | 备注 |
| --- | --- | --- | --- |
| arena-news.json | ai-stock-arena-news-digest（交易日 22:00） | arena | 含 aiPredictions（predOpen/ClosePct） |
| arena-ledger.json | arena-autopilot-a-open / **b-post（U20 双合一：Phase1 predlog + Phase2 Model B）** | arena | **只许经 `apply-arena-run.mjs`** |
| arena-predlog.json | b-post Phase 1（原 backfill） | （V19 Phase 3 待建 UI） | 只许经 `apply-arena-predlog.mjs`；60 交易日滚动 |
| arena-universe.json | 静态 | arena | 30 symbol 固定交易域 |
| sectors-data.json | sectors-watch-weekly（周日 10:00） | sectors | 发布前 `validate-sectors-data.mjs` |
| signal-events.json | signal-warsh-daily（交易日 07:00） | signal | schema v2；发布前 `validate-signal-events.mjs` |
| signal-release-dates-2026.json / nyse-holidays-2026.json | 静态（年更） | 任务守卫 | |
| leagues-data.json | leagues-msi-daily（**过期待删**，等决赛结果+finalsMvp 落库） | stats | stats 前端实时计算全部统计 |
| games-data.json | worldcup-games-daily（至 7/20，u18c 归档后删任务） | games→stats | |
| novels-index.json + novels/*.json | 手动/写作会话（U21 已分片，原 485 kB 单文件拆索引+分册） | serial | |
| transits-daily.json | horoscope-transits-daily（每日 06:30） | horoscope | <2 kB，客户端零星历库算日运 |

## 6. 已裁决决策索引（防反复横跳，重开需新证据）

| 决定 | 出处 |
| --- | --- |
| **不做** Astro 全站迁移（收益只在 serial 一页；`<head>` 样板用构建脚本吃掉；serial 单页候选资格单独记录） | roadmap §8.4（C5，2026-07-12） |
| **不做** React/Vue/Svelte/Rust/WASM/SSR/数据库/Tailwind 全站 | roadmap §8.2 + rfcs/u21-phase1 §1.5 |
| 无框架 MPA + git-as-database = **优势资产**，附重估触发条件 | rfcs/u21-phase1 §1.1 |
| 调度一律走 Cowork scheduled-tasks，**不用 launchd**（历史规划从未落地） | technical.md §4 |
| **不做** Web Push（Tier 0 零基建召回先行，D7>15% 才重评） | roadmap §5/§7.10 |
| 职业路线**两门论**：门 A（CF2900+）数学上关闭，全押门 B（资深工程师）；主赛道待定向测评 | course.md §5.0/§0.4 |
| Brier 记分卡点：record.log 未存 conf，需改任务 prompt 后攒新数据 | roadmap §7.5 |
| 组合盘用 Davison、宫位用整宫制、星历用 astronomy-engine 按需加载 | roadmap §7.10 模块四 |
| exact 比分口径：必须以胜负判对为前提（字符串巧合不算） | stats.html 注释 + U19 |
| Phase 3 UI 动码前置门槛：Lesson 2.8 代理分 67/100 <70，`--dim` 对比度 4.32:1 是唯一真失败 token | rfcs/u21-phase3 |

## 7. 已知坑

- **沙盒 `dist/` 权限受限** → build 验证一律 `npx vite build --outDir=/tmp/...`。
- **`.git/*.lock` 残留**：先确认时间戳 >30 分钟再清；沙盒里 rm 被拒时用**同目录 rename** 顶替（predlog 任务模式），或 file-delete-permission 工具。
- **Vite chunk 合并不定名** → 验证产物用内容 grep，不按文件名。
- **signal JSON 直引号**曾致语法错误 → 中文引号「」+ 发布前校验器强制。
- **首页 hero 文案「先英后中」跳变**：main.js 独立内容管线所致，根治需 SSR，已记录不修。
- **weaponClock（V16）曾"完成"但从未被 import**——「已上线」≠「已接入」，验收要 grep 调用点。
- **course.html sectors.html 缺 favicon** 等 S0 尾巴见 roadmap §9。

## 8. 文件职责地图（唯一真源，不要交叉复制内容）

| 文件 | 职责 | 维护规则 |
| --- | --- | --- |
| `KNOWLEDGE.md` | 本总纲：蒸馏+索引 | 仅结构性变化时更新 |
| `Urgent.md` | 当前冲刺 + **U20 任务台账** | 完成即转 RELEASE_NOTES；清空可删 |
| `roadmap.md` | 队列 A/B + 模块规格 §7 + 架构评审 §8 + SEO §9 | 队列只留编号+一句话 |
| `RELEASE_NOTES.md` | 完成事项归档 | append-only |
| `technical.md` | 架构细节、新页 checklist、数据/接口、git/部署教程 | 操作手册 |
| `course.md` / `course.html` | 个人课程 v3.0（活文档：旧结论划掉不删） | 周报任务自动写；两文件同步 |
| `rfcs/*.md` | 决策文档（O1 制度） | 一改动一文件，先 RFC 后动码 |
| `prompts/*.md` | 定时任务提示词正本（**机器向，禁与设计文档合并**；SKILL.md 只引用不复制） | 见 prompts/README |
| `prompts/yuxi-150-script.md` | 《玉熙宫词》150 章创作脚本 | 写作会话专用 |
| `CLAUDE.md` | 跨会话工作守则（think before coding / simplicity / surgical / goal-driven） | 机器向，工具链自动加载 |
