# tech.md — Project Afflatus 技术架构与工程蓝图（SSOT · Disaster-Recovery 级）

> **本文件性质**：全站重构期间的技术唯一真源（与 `design.md` 成对）。目标：即使整个代码库损毁，开发者/AI agent 仅凭这两份文档即可从零重建功能等价的站点。
> **整理基线**：2026-07-18；2026-07-25 已同步 P0 平台收口与 Sectors 滚动叙事星图 v3；2026-07-25（同日二次更新）并入 Sectors「Red vs Blue」中美 AI 竞争数据契约、力学与新增模块（原 `urgent.md` Part 3 RB-P0-01～07，已归档并从该文件删除）。综合 KNOWLEDGE.md / technical.md / roadmap.md / Urgent.md（U1–U46）/ RELEASE_NOTES.md / course.md 全部内容 + 当日代码实况核对。
> **裁决冲突处理**：凡本文件与旧文档冲突，以本文件为准；凡重构提案与本文件「已裁决」条目冲突，需新证据才能重开（KNOWLEDGE §6 规则延续）。

## 目录

1. 系统架构与技术栈 · 2. 目录结构与页面装配 · 3. 数据文件台账与 Schema · 4. 核心算法与逻辑实现 · 5. 状态管理与运行时约定 · 6. 定时任务与数据管线 · 7. 测试、CI 与验证 · 8. 构建与部署 · 9. 「绝不再犯」台账（Anti-Patterns Ledger）

---

## 1. 系统架构与技术栈

**一句话**：零运行时框架的 Vite 8 MPA 静态站（Jamstack + Local-First），git 即数据库，Vercel push 即部署，2 个 serverless 代理函数是唯一后端。

| 层 | 选型 | 裁决状态 |
| --- | --- | --- |
| 构建 | **Vite 8 MPA**：每页一个根目录 HTML 入口；`src/config/siteManifest.js` 是路由/构建纳入/导航/sitemap/元数据唯一真源，`vite.config.js` 从其 `BUILD_ROUTES` 派生 input | 已裁决保留（U21：架构资产；P0-01 清单治理） |
| 运行时 | **vanilla ES modules，零框架**。React/Vue/Svelte/SSR/Rust/WASM 全站禁用 | 已裁决（roadmap §8.2，重开需新证据） |
| 框架迁移 | **Next.js/Astro 不做**——2026-07-12 正式评估（roadmap §8.4）：`<head>` 样板重复仅 ~250 行，迁移风险摊九页。Serial 单章 SEO/分享已由现有 Vite + `parse5` 构建派生解决；只有出现必须依赖服务器运行时且无法由当前静态管线满足的新能力时才重评 | 已裁决 |
| CSS | 原生 CSS。主站 `src/styles.css`（~8000 行，`@layer legacy/tokens/components/overrides` 四层）+ 每页独立样式表 `public/styles/<page>.css`。**Tailwind 不做**（U46-乙-④：作用域污染已由 @layer 纪律 + `!important` 计数基线 + CI 体积预算控制；Tailwind = 全站重写 + 构建期依赖生态，过不了 U21 动刀标准。采纳其目标、沿用自有路径） | 已裁决 |
| 3D | three@0.160（仅首页 + sectors 星域，vendor 独立分包 ~674KB），**不无故升级**。WebGPURenderer 评估需真机基线后（U22b） | 已裁决 |
| 星历 | astronomy-engine（MIT，~130KB，动态 import 按需加载，仅 horoscope L3/合盘）。手写 VSOP87 系数判定不安全，Swiss Ephemeris WASM 精度过剩 | 已裁决（roadmap §7.10 模块四） |
| 类型 | TypeScript 渐进：`tsconfig.json`（strict/noEmit/checkJs）+ `npm run typecheck`；新模块用 `.ts`，不回改存量 `.js` | C4 试点已完成 |
| 后端 | **零后端**。仅 `api/quote.js` / `api/history.js` 两个 Vercel serverless 代理（Finnhub 实时报价 / Twelve Data 历史 K 线），key 在 Vercel 环境变量 `FINNHUB_KEY`/`TWELVE_KEY`。2026-07-23 起两个代理各自加了一层白名单门禁（symbol 不在「今日推荐」`quoteAllowlist` 内需 `x-arena-key` 头匹配环境变量 `ARENA_ADMIN_KEY`，§4.3 详述，Phase 4 已收紧为纯推荐名单）——前端 `arenaTech.js` 已接好完整解锁 UI（`#taUnlockForm`/`#adminChip`），但 `ARENA_ADMIN_KEY` 尚未在 Vercel 配置，`checkAdminKey()` 因此对任何密钥都 fail-closed 判否 | 常设 |
| 隐私 | Local-First：排盘/紫微/合盘全部浏览器本地计算，生辰只存 localStorage，分享 = base64url 编进 URL 参数。「出生数据永不离开设备」是隐私卖点也是无限水平扩展 | 红线 |
| 数据 | 静态 JSON 文件（`public/*.json`）= 内容引擎，git 版本历史 = 审计 = 回滚。数据与展示完全解耦 | 常设 |
| 调度 | Cowork scheduled-tasks（**不用 launchd**，历史规划从未落地，technical.md §4 已更正） | 已裁决 |
| 分析 | GA4（gtag 延迟到 requestIdleCallback）+ `web-vitals` 6 的 CLS/INP/LCP 字段遥测；只发送白名单指标、清单路由、`en/zh` 与粗粒度设备档，不发送 URL query、UA、输入、DOM attribution 或原始硬件值 | P0-05 已接入 |

**域名/部署**：feida.au · Vercel 监听 GitHub `FeidaWang/Afflatus` main 分支 · 自动 `vite build` → `dist/`。

## 2. 目录结构与页面装配

### 2.1 页面清单（9 个 Vite 入口；8 个活跃导航路由）

| 入口 | 身份 | 导航位置 | 状态 |
| --- | --- | --- | --- |
| index.html | 深空舰长日志（Three.js + 战斗 HUD） | 顶层 | 常设 |
| arena.html | 美股 TA 仪表盘 + Autopilot 双模拟盘 | 顶层 | 常设 |
| sectors.html | AI 产业公司故事网格 + 滚动叙事生态星图 + 后内存专题 + `?fx=starfield3d` 数据星域 | 顶层 | 常设 |
| signal.html | 美联储观察（SCP 皮肤，Warsh 时代，U41 编辑部版式） | 顶层 | 常设 |
| games.html | 世界杯竞猜（U38/U39/U40 阶段滑杆+缩放+季军赛） | — | 已退役；仅保留未构建源码 |
| league.html | MSI 竞猜 | — | 已退役；仅保留未构建源码 |
| stats.html | 竞猜战绩存档 | — | 2026-09-05 已删除；底层 JSON 已迁入 `data-archive/stats/2026-09-05/` |
| horoscope.html | 观星台：八字×占星×紫微，全本地零后端 | Labs | 常设 |
| serial.html | 小说书架 ×3 部（阅读器三主题） | Labs | 常设 |
| course.html | 个人 AI 工程课程 v3.0 + 每周一自动周报 | Labs | 常设 |
| boot.html | 「AFFLATUS ENGINE」全游戏化舰桥原型（noindex，不进 nav） | 无 | 可抛弃原型 |

### 2.2 目录树

```
/                        11 个 HTML 入口（根目录，非 public/）
api/                     quote.js + history.js（Vercel serverless，symbol 正则校验 + rateLimit）
src/main.js              首页 4.9kB 基础加载器（语言 URL + 意图/可见性/idle 调度）
src/homeExperience.js    首页重型体验（HUD/战斗/场景/光标/初始语言投影，按需加载）
src/styles.css           首页/主站样式 ~8000 行，@layer 四层
src/config/
  siteManifest.js        ★ 路由/构建/导航/sitemap/元数据唯一真源
  navRoutes.generated.js 浏览器导航轻量投影（生成物，禁手改）
  performanceRoutes.generated.js 字段遥测路由轻量投影（生成物，禁手改）
  lighthouseRoutes.generated.json Lighthouse 活跃路由投影（生成物，禁手改）
src/entry/performance.js 每个活跃 HTML 唯一加载的 CWV 启动入口
src/lib/                 全站共享库（依赖零 DOM 的纯函数为主）：
  nav.js                 消费生成的导航投影；Labs 下拉 portal 到 <body>
  i18n.js                data-en/data-zh 引擎 + afflatus-lang 事件（首页除外，见 §5.2）
  webVitals.js           CLS/INP/LCP 采集、隐私白名单、粗粒度维度与 gtag 有界内存队列
  renderBudget.js        渲染质量/DPR/刷新率/p95 纯策略
  renderBudgetCoordinator.js 页面生命周期/可见性/resize/自适应质量唯一协调器
  webglLifecycle.js/.d.ts WebGL context 租约/丢失恢复/静态降级/Three 资源回收
  readerStore.js         Serial `afflatus:reader:v1` 状态归一、适配器与旧键安全迁移
  serialRoutes.js        Serial adaptive/en/zh 书籍/章节路径解析与 URL 生成
  transition.js page-turn.js audio.js clock.js
  arenaRules.js arenaRun.js arenaLedgerView.js predlogEntry.js rateLimit.js
  validateSectorsData.js validateSignalEvents.js provenanceBadge.js trackRecord.js
  validateSectorsCompetition.js sectorsCompetition.js sectorsCompetitionView.js
  bazi.js ziping.js dayun.js lunar.js xiu.js ziwei.js persona.js astro.js
  horoscopeEngine.js synastryAstro.js dailyTransits.js starDraw.js shareCard.js
  cityPicker.js shenshaRarity.js（生成物）
  bracketModel.js pinchZoom.js forceGraph.js sectorsGraphView.js
  dataToSpace.js termGlossary.js i18nData.js leaguesPick.js
src/pages/               每页一个入口文件（xxxEntry.js/xxxLibs.js）+ 页面专属逻辑
src/scene/               Three.js/Canvas 场景：alphardForge topdownCombat combatHudSC
                         combatCine cameraDirector(起降运镜) odinHull nighthawk
                         capitalShip3D shipHologram fighter3D sectorsStarfield …
src/combat/              纯逻辑层：weaponClock cameraMath weaponCameraDirector
                         flightPath combatRuntime combatConfig
src/ui/                  HUD 绘制：combatHmdV3 battleFeed marketDeck radarDeck viz
                         cursor.ts terminalStarMap softClock pageTurn ambientBackdrops …
src/data/content.js      首页文案 + Top 10 持仓 PICKS_ZH/EN + COPY 双语对象
public/page-turn.css     子页共享：翻页箭头 + 自托管字体 + Labs 下拉样式
public/styles/<page>.css 每页独立样式表（sectors/signal/games/league/horoscope/serial…）
public/*.json            数据文件（§3）
public/sectors-ecosystem.json  Sectors 滚动叙事星图 v3（节点/关系/章节/来源）
public/sectors-competition.json Sectors「Red vs Blue」竞争数据（模型/基准/股票/评分板，2026-07-25 新增）
public/assets/sectors/    Sectors 本地品牌标志与产品/发布视觉
scripts/                 结算/校验/推送 CLI（进 git，禁明文 key）
prompts/                 定时任务提示词正本（README 五条硬规则 + 各模块文件）
rfcs/                    决策文档（O1 制度：>1 天改动先 RFC）
tests/                   vitest（84 文件 1,193 条，2026-07-25 当前）
lighthouserc.cjs         8 活跃路由 × 3 次的回归断言矩阵
lighthouse-baseline.json 路由实验室债务基线 + 字段 p75 产品目标
```

### 2.3 新增页面 checklist（V0 验证，全文 technical.md §1，勿删）

HTML 放根目录 → 建 `src/pages/xxxEntry.js`（**nav 必须 import 在 page-turn 之前**）→ `siteManifest.js` 加完整 route（build/nav/sitemap/EN-ZH metadata/schema/capabilities）→ `npm run site:generate` 生成浏览器导航投影与 sitemap → body class + data-prev/next + `<nav data-afflatus-nav>` → page-turn.css 配色变量（`--labs-*` 下拉主题必须显式配，portal 面板不继承页面样式）→ 双语文案 data-en/zh 成对 → `<head>` 最前同步内联脚本按统一 locale key 预设 `<html lang>` → `npm run site:check` → build 后**按内容 grep**（不按 chunk 文件名）验证。

### 2.4 首页渲染分层

`#starfield`（背景星空，fixed z0，OffscreenCanvas + Worker，特性检测回退主线程）→ `#blackhole-gl`（z1）→ `#event-layer`（2D 战斗/彗星，z2）。`.stardrive` 段自带 `#alphardForge` canvas，滚动进度写 CSS 变量 `--forge`(0→1)（原生 `animation-timeline:view()` 优先、JS pin 兜底），驱动星体放大/台词逐字/指标点亮/舞台缩放（30e `?fx=stage`→已转默认）。Combat View 默认 3D（U23 M1：`topdownCombat.js` + 导演运镜默认开，`?combatview=2d` 完整退路）。

P0-03 完成后，首页 master rAF、背景 Worker、Alphard Forge、combat/radar/market/terminal/hologram 与 lazy 3D asset，Sectors 两套渲染器，Boot 三个 WebGL 分支 + telemetry，以及 Arena/Signal/Serial 环境 Canvas 均注册到 `RenderBudgetCoordinator`：页面 hidden / freeze / pagehide 时停止，pageshow / resume 时恢复；resize 由协调器单点合并到下一帧；恢复首帧重置时钟，首页 `dt` 硬夹 32 ms。背景 Worker 的 `start/stop` 带 generation guard，避免快速暂停/恢复产生双计时器。DPR 不再使用散落的设备上限，而走 `sqrt(pixelBudget/(cssW*cssH))` 的绝对 backing-store 预算。明确例外只有一次性 share/export/transition Canvas，以及已 302 下线 Games/League 的纯 pointer 刮卡（无持续帧循环）。

P0-06 完成后，活跃 3D/GL 表面统一由 `webglLifecycle.js` 领取最多 8 个同时存在的 context 租约。首次 `webglcontextlost` 阻止默认销毁并暂停表面；恢复时 raw Saturn GL 重新编译 shader/链接 program/重建 buffer 与 uniform location，Three 场景调用 `resetState()`，Boot 材质预览另重建 PMREM environment。一个 session 内同表面第二次丢失直接释放租约、终止 lifecycle `AbortSignal`、设 `data-renderer="poster"` 并显示中英双语恢复按钮；未来 GLTF/纹理 fetch 必须使用该 signal。销毁顺序固定为：停止 rAF → 移除协调器/DOM listener → dispose composer/render targets → identity 去重回收 geometry/material/texture/uniform resource → renderer dispose + context loss。当前没有生产 GLTF/TextureLoader 异步任务。

## 3. 数据文件台账与 Schema

> 顶层统一 `{updated, version}`；前端溯源徽章（`provenanceBadge.js`：>36h 琥珀 / >72h 红）按数据龄分级。双语字段新约定：嵌套 `{en,zh}`。**账本/记录类 JSON 只许经结算脚本修改，禁止手编**。

P0-09 后，浏览器 JSON 读取统一走 `fetchJson.js` 的封闭资源键注册表，禁止新页面直接 `fetch(...).json()`。契约为 `fetchJson(key,{signal,freshness,timeoutMs,headers,forceRefresh})`：网络请求去重、每调用方独立取消、默认 8 秒超时、payload 到达 UI 前执行现有 schema validator，并以带 `code/status/retriable/validationErrors` 的 `JsonDataError` 表达失败。缓存分两层：当前文档内存 + Cache Storage；新鲜值直接返回，过期值先返回并在后台只发一次 revalidate。固定 URL 的静态 JSON 使用浏览器正常 HTTP cache，不得再无差别 `no-store`；报价/历史 API 仍按实时性单独控制。各资源 validator 使用动态分块，并在 JSON/Cache Storage I/O 开始时并行预热，避免 payload 到达后再串行付出一个 RTT。经典内联 IIFE 通过 `public/lib/data-bridge.js` 等待 `src/entry/dataBridge.js` 暴露同一模块实例，避免生产构建引用未转换的 `/src/` 动态 import；Vite 构建会把 0.2 kB bridge 内联进消费页，源码开发形态不变且不产生阻塞请求。Serial 音乐 playlist 因功能暂停暂不纳入迁移。

| 文件 | 写入方 | 消费页 | 关键 schema/纪律 |
| --- | --- | --- | --- |
| arena-news.json | ai-stock-arena-news-digest（交易日 22:00） | arena | `items[]{title/summary_en/zh,category,source,url}` + `aiPredictions{sym:{direction,confidence,rationale,predOpenPct,predClosePct}}` |
| arena-ledger.json | arena-autopilot-a-open / b-post（结算）；**2026-07-23 一次性经 `scripts/bootstrap-season2.mjs` 切换为 Season 2** | arena | **只许经 `scripts/apply-arena-run.mjs`（日常结算）或 `bootstrap-season2.mjs`（一次性 Season 迁移，幂等）**；现为 Season 2 结构 `{season:2,day:0,models:{S,P,T}}`，各账本 `$10,000` 起、零历史；`lastRunDate` + 每账本 `dayStartEquity` |
| arena-predlog.json | b-post Phase 1 | （Phase 3 待建 UI） | 只许经 `apply-arena-predlog.mjs`；60 交易日滚动窗口 |
| arena-universe.json | 静态（2026-07-23 起 v2） | arena（`arenaTech.js` 搜索索引；不再驱动任何 chip 行——Phase 4 起选股入口是 arena-picks.json 驱动的推荐面板）/sectors 星域仍读本文件 | v2 `{updated,version:2,mode:"market",note_en/zh,source_note_en/zh,exclusions[],tradability:{minLastClose,minAvgDollarVol},benchmarks:[sym…],symbols:[{sym,name,sector,bucket}]}`——506 条（标普 500，2026-07-23 抓取维基百科 + SPY/QQQ/SMH），`bucket` 现为 GICS 板块 slug（如 `information-technology`），不再是 `core-ai-hardware`/`megacap-tech`。校验器 `src/lib/validateArenaUniverse.js`（只认 v2 shape），已接入 `scripts/validate-data.mjs`（CI 强制） |
| arena-universe-s1.json | 静态（S1 归档，冻结） | 无前端消费方——Phase 4 起 `arenaTech.js` 的 30-symbol chip 行已整体移除；仅作为 `arena-ledger-s1.json`（Season 1 A/B 两本，第 11 天，10 笔交易归档）的固定交易域历史记录留存 | Season 1 30-symbol 原始 v1 shape 逐字节归档，`bucket` ∈ `core-ai-hardware`/`megacap-tech`/`benchmark`；**只读，不再更新**，不接入 `validate-data.mjs`（历史快照，同 arena-ledger.json 的排除逻辑） |
| arena-picks.json **(新增 2026-07-23)** | 目前手动（Phase 5 定时任务自动化前）；未来 Gatherer/Reviewer 管线每日发布 | arena（驱动 Today's Recommended Trades 面板 `arenaPicks.js`；`quoteAllowlist` 是 API 门禁的**唯一**白名单来源，Phase 4 起不再并入全市场，见 §4.3 `arenaAccess.js`） | `{date,generatedAt,regime:risk-on\|neutral\|risk-off,models:{S:[],P:[],T:[]},quoteAllowlist:[sym…]}`；每条 pick `{sym,side:"long"（仅多头，系统本身 long-only）,confidence,entry,stop,target,thesis_en/zh,signals:[…]}`；校验器 `validateArenaPicks.js`（含 quoteAllowlist 必须覆盖每条 pick 的一致性检查） |
| arena-runlog.json **(新增 2026-07-23)** | 同上 | 审计 + 离线补跑判定源（urgent.md Part 4 §19.3） | `{runs:[{date,window,model,status:done\|missed\|queued,ordersProposed,ordersFilled,note}]}`；`(date,window,model)` 三元组必须唯一（校验器强制），是幂等重跑判定的键 |
| arena-daily-digest.json **(新增 2026-07-23)** | 同上 | 「离线时段摘要」推送/站内 toast（Phase 5 未接线） | `{date,generatedAt,books:[{model:S\|P\|T,pnlPct,tradesCount,note_en/zh}]（固定 3 条）,tomorrowPicksCount,delayed:[]}` |
| sectors-data.json | sectors-watch-weekly（周日 10:00） | sectors | `{modelWatch:[4 厂商],baskets:[{vendor,market,equities:[{ticker,relation,confidence,correlation_note}]}],postMemory,weeklyTake}`；发布前 `validate-sectors-data.mjs`；**显式拒绝数值相关系数字段**（只给定性关系标签） |
| sectors-ecosystem.json | 编辑审核后手动更新；定期复核来源 | sectors 滚动叙事星图 | v3 `{updated,version,chapters[],nodes[],edges[]}`；节点以稳定 `id` 引用，含 `country/logo|mark/kind/stage/reveal/color/products/summary_en/zh/source`；边含 `source/target/type/strength/label_en/zh/source_url/reveal`。当前 19 节点、19 关系、5 章节（2026-07-25 起 `divide/frontier/capital/chokepoints/system`，原 `quiet/frontier/capital/compute/system` 改名重编为 Red vs Blue 五幕，`start` 阈值不变）；关系端点必须存在，产品/结论必须有来源。发布日期无法从官方来源验证时不得按提示词猜测——**2026-07-25 已核验 Claude Opus 5 于 7/24 发布**（[主源](https://www.anthropic.com/news/claude-opus-5)），anthropic 节点 `products/summary_en/zh/source` 已更新，此前「未核验到 Opus 5 官方发布」的表述已作废。 |
| sectors-competition.json **(新增 2026-07-25)** | 编辑手动更新；定期复核来源 | sectors Red vs Blue 专区（评测雷达/基准矩阵/双榜十强/地缘评分板），`fetchJson` 键 `sectors-competition` | `competition/v1 {schemaVersion,updated,as_of,radarAxes[],benchColumns[],models[],equities[],scoreboard}`。每个数值叶子是 `{value,unit,tier,src}`，`tier∈verified\|reported\|estimate\|derived\|pending`；**`verified` 必须带 `src` URL**，由 `validateSectorsCompetition.js` 强制（含 `models[].pricing`/`bench[]`/`speed[]`、`equities[].conviction`/`kpis[]`、`scoreboard.axes[].tier` 全覆盖）。当前 12 模型（US 8/CN 4）、18 基准列（4 列因该名单无可比数据显式标 `status:"not_published"`/`"provider_dependent"` 并印出原因，绝不估算填充）、20 支股票（美 10/中 10，A 股+HKEX 合并一栏）、4 轴评分板（compute/algorithms/capital/data，权重 .35/.30/.20/.15 求和须为 1，`buildScoreboard()` 按权重和归一防越界）。`equities[].links[].to` 必须解析到 `models[]` 里存在的 `id`。 |
| signal-events.json | signal-warsh-daily（交易日 07:00） | signal | schema v2：`{updated,version:2,as_of,hawkDoveCompass(-2..+2),pillarSummary,pillars[5],events[]}`；发布前 `validate-signal-events.mjs` 强制 |
| signal-release-dates-2026.json / nyse-holidays-2026.json | 静态年更 | 任务守卫 | 发布日历/休市日查表，不为此调 API |
| `data-archive/stats/2026-09-05/leagues-data.json` | 已结束 | 无公开消费者 | MSI 2026 最终只读快照；SHA-256 与下线前线上文件一致，见同目录 `README.md` / `SHA256SUMS` |
| `data-archive/stats/2026-09-05/games-data.json` | 已结束 | 无公开消费者 | 世界杯 2026 最终只读快照；含 `matches[]`、决赛前概率盘及最终奖项，SHA-256 与下线前线上文件一致 |
| novels-index.json + novels/*.json | 手动/写作会话 | serial | U21 已分片（原 485KB 单文件拆索引+分册） |
| transits-daily.json | horoscope-transits-daily（每日 06:30） | horoscope | <2KB 当日行星黄经，客户端零星历库算日运 |

## 4. 核心算法与逻辑实现

> 仓库标准打法：**数据/数学层 = 依赖零 DOM/fetch/Date.now 的纯函数 + vitest 全覆盖；渲染胶水层不单测、靠构建 + 真机验收**。now/t 一律显式传参。重建时先建纯函数层再接 DOM。

### 4.1 统计引擎（src/pages/stats.js + src/lib/stats + Worker）
- **Wilson score interval**（小样本二项比例区间，替代正态近似）；**精确二项检验** vs p=0.5。
- **Brier**：`mean((stated_prob − outcome)²)`，越低越好；**BSS** = 1 − BS/0.25（基线=永远 50% 的预测者）。
- **Bootstrap**：2000 次有放回重采样命中率分布，标 2.5%/97.5% 分位（`#bootHist`，viewBox 响应式 SVG）。
- **口径红线**：exact 比分命中必须以胜负判对为前提（字符串巧合不算）；事后不重打分（读直播页同一份 JSON）。
- `leaguesPick.js`：`pickedTeam/pickCorrect/pickExact/matchesMvp` 判定纯函数。

### 4.2 命理引擎（全本地，horoscope.html）
- `bazi.js`：干支日柱数学（1949-10-01=甲子日、1970-01-01=辛巳日双锚点验证）；**真节气** = Meeus 低精度太阳视黄经 + 二分法（修「2025 立春实际 2/3」类固定表错误）；`normalizeBirthToCST()` 任意时区+夏令时→北京时间（含中国 1986-91 历史夏令时）；**晚子时换日**：hour=23 按次日重算年/月/日柱（真实案例 1992-02-23 23:26 逐柱核对）。
- `ziping.js`：十神（算法推导非查表）/藏干/纳音/空亡/十二长生/旺相休囚死/刑冲合害/21 神煞/扶抑法身强身弱+格局+喜用神。
- `dayun.js` 大运排向/起运折岁/流年五档；`lunar.js` 1900–2100 紧凑表（10,815 天对照零不一致）；`xiu.js` 28 宿；`ziwei.js` 紫微十二宫+十四主星（iztro 400 盘对照全对）；`shenshaRarity.js` 由 `gen-shensha-rarity.mjs` 枚举 14.5 万合成命盘生成（保持页面零 fetch）。
- `horoscopeEngine.js`：日运 = 真干支历（今日日柱五行 vs 用户日主生克）+ seeded mulberry32 文案，确定性可复现；分享码 `encodeShare/decodeShare`（base64url 生日对）。
- `synastryAstro.js`：跨盘相位 O(n²)、共鸣分、关系称号、Davison 组合盘（真实中点时空重算星盘）；宫位整宫制（免 Placidus 迭代）。

### 4.3 TA 技术分析引擎 + 交易模拟（arena）

**TA 仪表盘**（`technicals.js` 纯函数层 + `arenaTech.js` 胶水/渲染，V13）：
- `smaSeries/maSnapshot`：简单均线序列 + 5/10/20/60/200 快照（价格位置 above/below + 近 3 根斜率 up/down/flat）。
- `classicPivots({h,l,c})`：经典枢轴点 `PP=(H+L+C)/3, R1=2PP−L, S1=2PP−H, R2=PP+(H−L), S2=PP−(H−L), R3=H+2(PP−L), S3=L−2(H−PP)`；`reviewSession()` 复盘某交易日实际触碰/收于枢轴哪一侧。
- `swingLevels()`：分形拐点（每侧 N 根更低/更高即成立）+ 聚类（`clusterPct` 内合并、记触碰次数），产出价格上下方最近的支撑/阻力。
- `roundLevels()`：心理整数关口（依价格量级取 $1/$5/$10/$50/$100 网格），主/次网格分别标注。
- `detectGaps()`：日线缺口检测（今日低点>昨高/今日高点<昨低）+ 回补状态机 open/partial/filled。
- `detectBreakouts()`：N 根箱体（振幅≤阈值）突破 + 放量确认（`volMult×箱体均量`）+ holding/lost 状态。
- `normalizeDaily()`：盘中时段丢弃当日未完成的那根蜡烛（避免把"半根K线"当完整数据用）。
- `analyzeTicker()`：以上全部组装成一次分析（PRE 模式=基于最近完整K线的下一交易日计划位；POST 模式=基于前一根K线的计划位，对照最近一根实际走势复盘）。
- `arenaTech.js`（P1-07 六态管线）：推荐卡、搜索、刷新、解锁与管理员密钥清除全部汇入唯一 `select(sym)`；`createLatestSelectionPipeline()` 每次选择先 abort 上一调用方等待、递增 request ID，并让 reducer 忽略旧代 terminal event，`pagehide` 再统一取消。`arenaPageState.js` 的页面状态只允许 `loading/ready/stale/gated/partial/error`：历史+报价齐全=`ready`；历史可用但 quote 失败=`partial`，用最近完整日线收盘且展示蓝色说明；只剩旧交易日 cache 或上游落后一日=`stale`，展示琥珀日期；任一 API 403=`gated`，保留专属锁态/拒绝密钥文案；历史无可用数据=`error`。DOM 同步写 `#taPanel[data-arena-state]`、`aria-busy` 和对应 live status，不再靠 `loading/error/keyRejected` 三个布尔量拼隐式分支。`marketSession.js` 在 `America/New_York` 中计算最后一个**已完成** NYSE session，跳过周末、固定节日观察日、MLK/Presidents/Memorial/Labor/Thanksgiving 与 Good Friday；历史缓存键为 `afflatus-ta:v2:<SYMBOL>:<YYYY-MM-DD>`，每标的最多保留四个不可变 session。当前 session 未命中时 `fetchHistory()` 强制绕过通用 SWR 发网路请求，且先滤掉仍在形成的当日 candle 再写缓存；失败才找严格早于当前 session 的最新旧键并显式标 stale，403/Abort 永不偷降级。精确 ticker 的 Enter 匹配优先于公司名 substring。四张技术卡与 Level Ladder 继续由 `analyzeTicker()`、`declutter1D/fitExtent` 驱动。**Phase 4（2026-07-23）起**旧 30-symbol watch chip 已移除，`state.universe` 只服务搜索，`arenaPicks.js` 卡片以 `arena-pick-select` 解耦接入；管理员密钥仍只存在 `sessionStorage['afflatus:arenaKey']`，通过 `x-arena-key` 发给两个 API，hero chip 可二次确认清除。

**Autopilot 交易模拟**：

> **2026-07-23（Part 4 Phase 4）起，`arena-ledger.json` 已实际切换为 Season 2**：`scripts/bootstrap-season2.mjs` 已运行过一次——把 Season 1（Model A/B，第 11 天，共 10 笔交易）逐字节归档到 `public/arena-ledger-s1.json`，然后写入全新的 Season 2 账本（S/P/T 三本，各 $10,000，`season:2, day:0`，零历史）。**该脚本是幂等的一次性迁移**：模型已是 S/P/T 时直接 no-op 退出；`arena-ledger-s1.json` 已存在时拒绝覆盖。三本账本目前仍是**静态/空仓**——真正产生交易需要 Phase 5（§19）的定时任务把 Gatherer/Analyst 管线接到 `arenaRun.js`；在那之前，本节下方各模块（`arenaFeatures.js`/`arenaExec.js`/PER_MODEL 规则）已实现并全量测试覆盖，但尚无自动化流程真正调用它们下单。本节同时记录两代的分工，避免未来重建时混淆"账本结构已升级"与"账本已产生新交易"这两件事。

- `arenaRules.js`：**LLM 提案、代码收单**——模型只出 JSON 订单，`validateOrder/applyFill/checkStopLoss/checkExitBySweep/checkDailyCircuitBreaker/checkSeasonReset/computeMetrics` 是唯一有权改账本的代码。共享硬风控（对全部模型一视同仁，不因 Season/模型而异）：单仓 20%/现金 5%/日熔断 3%/赛季重置 20%——定义在 `LIMITS` 顶层常量。**按模型分化**的风控（止损/最大持仓/信心阈值/换手节奏/滑点档）：Season 1 沿用旧字段 `LIMITS.STOP_LOSS.{A,B}`/`SLIPPAGE_BPS.{A,B}`/`MAX_WEEKLY_TRADES.A`/`ALLOWED_TRADE_DAYS.B`（A：止损 8%/持仓 8/信心 0.65/周换手 20 笔；B：止损 15%/仅周二四开仓）；Season 2 三本走新增的 `LIMITS.PER_MODEL.{S,P,T}`（S=ORACLE 止损 8%/持仓 6/信心 0.70/周换手 20；P=PULSE 止损 5%/持仓 5/信心 0.65/周换手 30；T=ATLAS 止损 15%/持仓 8/仅周二四开仓，继承 B 的日期闸）——所有查找函数先查 `PER_MODEL[model]` 再退回旧字段，Season 1 数学路径因此逐字节不变。Model T 独有：新开仓订单 `signals[]` 数组长度必须 ≥2（"融合而非单一头条"），否则一律拒单，与信心阈值同级校验。Model P 独有：买单需带 `exitBy`（YYYY-MM-DD），`checkExitBySweep()` 到期强制平仓（对没有 `exitBy` 字段的仓位是纯 no-op，即 Season 1 和 S/T 完全不受影响）。
- `arenaFeatures.js`（新增）：Model P 盘中结构特征的**纯函数**层——`openGapPct/intradayRangePct/computeVWAP/vwapDriftPct/volumeSurgeRatio/pivotBreakState`（复用 `technicals.js` 的 `classicPivots`，不重复造轮子）+ `buildPulseFeatures()` 组装单标的完整特征向量。设计原则：LLM 只对预计算好的数字排序/定仓位，绝不自己算这些数字（同"代码收单"纪律的自然延伸）。
- `arenaExec.js`（新增）：「RL 启发式」执行策略的确定性替身——`sliceOrder()`（订单超过账本净值 10% 时按剩余窗口数切片）、`capByParticipation()`（按标的平均成交量的参与率封顶）、`impactSlippageBps()`（`baseBps + k·√(参与率)` 平方根冲击成本模型，`k=50` 温和系数、`maxBps=250` 兜底）。`arenaRules.js` 的 `simulateFill(order, model, execOpts)` 第三参数可选：不传（现有全部调用方式）=旧的按模型分级平坦滑点，逐字节不变；传 `execOpts.avgDollarVol` 才会切到冲击成本模型——**目前没有任何调用方传这个参数**，因为管线还没有真实成交量数据流入 payload，这层是"接好线，等数据"的休眠状态，如实记录避免以为已经生效。
- `arenaAccess.js`（新增 2026-07-23，2026-08-07 收紧交付边界）：API 门禁的纯逻辑层，供 `api/quote.js`/`api/history.js` 调用——`resolveAllowlist({picks})` **只认构建时随函数发布的推荐名单**（由 `arena-picks.json` 的 `quoteAllowlist` 生成，含管线固定加入的 SPY/QQQ/SMH），不再让运行时函数通过公开站点 URL 回读 allowlist，因而消除主域名变化、网络失败与缓存漂移造成的授权边界不一致。搜索非推荐标的仍须管理员密钥（`#taUnlockForm`/`#adminChip`）。`checkAdminKey(providedKey, configuredKey)` 用 `crypto.timingSafeEqual` 恒定时间比较，任何一边为空/长度不等都直接判否（fail-closed，不抛异常）。Finnhub quote 限时 5 秒、Twelve Data history 限时 7 秒；上游 HTTP/payload 结构/超时/网络错误归一为 `{error:{code,message,upstreamStatus?},requestId}`，错误响应 `private,no-store`，所有响应带 `X-Request-Id`，成功分别使用 12 秒与 1 小时 edge cache。管理员密钥通不过返回 403 `ARENA_KEY_REQUIRED`；`ARENA_ADMIN_KEY` 未配置时功能 fail-closed。
- `arenaRun.js`：单次运行编排 mark-to-market→止损扫描→exitBy 扫描（Season 2 Model P 专用，见上）→撮合→熔断→赛季重置→复盘，`BOOKS=['A','B','S','P','T']` 五个账本键值共用同一条orchestration路径。`bootstrapSeason2(ledgerFull, {day, promptVersions, note_en, note_zh})`：纯函数，返回一份全新的三本 $10,000 账本（S/P/T）；`note_en`/`note_zh` 不传时沿用旧账本的复盘文案。**已被 `scripts/bootstrap-season2.mjs` 实际调用过一次**（2026-07-23），产物就是当前的 `public/arena-ledger.json`（见上方状态说明）——不是仅存在于测试里的休眠代码。
- `predlogEntry.js`：`pctChange/directionHit/buildPredlogDay/appendPredlogDay`；规划中 `predCalibration.js` 三态信号 LEAN LONG/NEUTRAL/LEAN SHORT（`calibConf ≥0.62` 且近 20 次 hitRate ≥55%，信号必挂 hitRate+Brier 战绩——不越「非投资建议」红线的硬约束）。
- `rateLimit.js`：纯函数滑动窗口（按 x-forwarded-for 分桶，quote 60/60s，history 20/60s，429+Retry-After）。symbol 正则 `^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$`，两个 API 文件的门禁检查都插在限流之后、上游 fetch 之前。
- **Season 2 提示词**：`prompts/arena-autopilot.md` 追加 "PART 2 — V5"（Gatherer/Analyst S·P·T/Reviewer 五段系统提示词 + 共用 run payload schema），V4（A/B，现役）原文完全未改，文件顶部状态说明写明 V5 休眠中、不得在 Season 1 真正退役前删除 V4。

### 4.4 运动/相机数学（src/combat/cameraMath.js —— 全站唯一缓动正源）
- **`smoothDamp(current, target, velocityRef, smoothTime, dt, maxSpeed)`**：临界阻尼弹簧。用途：3D 战斗相机、星域轨道/fly-to、鼠标视差、任何「有质量感」的插值。**禁线性 tween，禁引 GSAP**（U30/U42/U43/U44 四次裁决）。
- `shouldPreempt/blendFactor/easeBlend`（镜头抢占/混合）、`fovForAccel/bankAngle/bankedUpVector/chaseCamPose`（追击相机）。
- `weaponClock.js`：权威时间线 `{weapon,t0,phases:[{name,at}]}`，`startTimeline/phaseFraction/activePhase/msUntilPhase`；`weaponCameraDirector.js`：`requestShot(id,{durationMs,blendInMs,refresh})` 优先级抢占状态机。
- `flightPath.js`：起降生命周期 `DOCKED→CATAPULT→CLIMB→CRUISE→BREAK→APPROACH→TOUCHDOWN`，Hermite 链式段 C1 连续，速度/加速度解析求导（零帧差分噪声）。

### 4.5 图形/交互引擎
- `renderBudget.js` / `renderBudgetCoordinator.js`（P0-03 已完成）：纯策略层定义 `low/balanced/high`、移动/桌面像素预算、renderer cost 系数、DPR 公式、刷新率中位数采样与 p95 帧窗；浏览器协调层只保存 route/device tier、surface id/cost/targetFps/p95，不收集指针、文案或用户输入。降档需连续 2 个超预算窗口，升档需连续 8 个有余量窗口，且永不超过初始硬件档上限。长期 renderer 必须注册；`renderBudgetCoordinator.d.ts` 为 Boot TypeScript 场景提供同一接口契约。
- `responsive-primitives.css` / `viewportRuntime.js`（P0-10 已完成）：12 路由统一 `viewport-fit=cover`、四向 safe-area token、`100svh/100dvh` fallback、44 px coarse-pointer/≤440 px HTML 控件基线；11 个构建入口挂载 VisualViewport 协调器，以单 rAF 合并 resize/scroll/orientation，写入 visual height/offset/center、keyboard inset 与 `data-keyboard-open`，销毁时移除全部 listener。`site:check` 强制 stylesheet/meta/entry 唯一性；Playwright 在全部 active/redirect/prototype/404 路由的 320×720 布局验证无页面级横向溢出并审计触控尺寸。Vite 生产构建只把小型 responsive primitives 内联为关键样式，开发源码仍分离；`page-turn.css` 保持外链，避免推迟 Horoscope 的路由主样式发现。Sectors 按 320–660 px 实测导航换行高度预留 header，Lighthouse CLS 从 0.221 降至 0.019。物理刘海/动态岛、Samsung Internet 软键盘与 120 Hz 仍须真机签署。
- `webglLifecycle.js` / `.d.ts`（P0-06 已完成）：`createWebGLContextLifecycle()` 统一 context 租约、session loss budget、恢复/降级 callback、AbortSignal 与可访问恢复 UI；`disposeThreeScene()` 遍历场景图并按对象 identity 去重回收 geometry/material/嵌套 texture/render target，最后释放 renderer/context。硬上限为 8 个同时活跃 context，同一 surface 第二次丢失即静态化；`tests/webglLifecycle.test.js` 与浏览器真实 `WEBGL_lose_context` gate 覆盖契约。
- `forceGraph.js`：自研力导向（两两斥力 + Hookean 弹簧 + 弱引力锚点，固定步长 Euler）。**2026-07-25 起锚点键从「按 stage」改为「按 `stage:bloc`」**（`ecosystemBloc(country)` 只把 US/CN 判给对应阵营，其余国家一律 `neutral`）：13 个已填充的 (stage,bloc) 格子各建一个锚，US 阵营落左、CN 阵营落右、跨阵营供应商落子午线上——共存论点直接是几何而非文案。力学常数已实测重调（旧 8 锚宽景常数在新 13 锚布局下把构图撑到 10.3 单位跨度，画布 `scale` 掉到 48）：`{repulsion:0.05, springLength:0.42, springStrength:0.022, poleStrength:0.1, damping:0.86, minDist:0.12}` 结算于 7.96×6.21（`scale` 63），最近节点板间距 73 CSS px（此前 68 px），由 `tests/forceGraph.test.js` 的「bloc polarity」组针对真实数据集断言下限，防止未来retune 静默回退。边只认存在的稳定 ID；旧 `sectors-data.json` 输入仍保留向后兼容。**教训内嵌**：pressure 连线必须用带 rest length 的弹簧（恒定力不收敛）；锚定力施加在自由端而非被钉住的极点（被钉节点跳过受力）。
- `sectorsGraphView.js`（2026-07-25 v3 + Red vs Blue 极化更新同日）：Canvas 2D 滚动叙事渲染器。空场起步，按五章节（`divide/frontier/capital/chokepoints/system`）与 `reveal` 阈值展开 19 节点/19 关系；节点使用本地 Logo 牌、国旗徽章与文字 mark fallback，边按关系类型着色并带方向粒子，详情卡显示双语产品、关系和来源。**阵营层**：节点外环/辉光改用 `blocColor(node)`（US `#2F6BFF`/CN `#E5484D`/neutral `#7EF0DC`，与 design.md `--rb-*` token 同值）；跨阵营边用 `edgeStroke()` 沿方向绘制蓝→中性→红双极渐变（`createLinearGradient` 每帧现算，不跨帧缓存——渐变端点随节点呼吸/相机平移持续变化，缓存会指错方向；数据集仅 3 条跨阵营边，帧成本可忽略）；`drawMeridian()` 在世界坐标 x=0 处画竖向渐变分界线，随桌面平移同步、随首幕 `storyProgress` 淡入，移动端不绘制（改用行栅格，无子午线几何）。缩放按钮、wheel 与 pinch-to-zoom listener 全部移除；浏览器页面缩放/纵向触摸滚动保留，触屏只负责 tap 选择，桌面保留 pan 与节点拖动。物理固定 60 Hz，绘制注册 `RenderBudgetCoordinator` 的 120 fps 目标并使用 pixel-budget DPR；移动端采用确定性三列纵向拓扑，`prefers-reduced-motion` 关闭渐变/漂浮并直出章节状态。Canvas 与并行 DOM 节点按钮共享选择状态，支持方向键、Enter/Space、Home/Escape。唯一滚动采样是一个 passive listener，经单 rAF 合并后只写 0–1 故事进度；销毁时 listener、ResizeObserver、rAF 与 coordinator registration 全部释放。
- `sectorsCompetition.js` / `sectorsCompetitionView.js`（新增 2026-07-25）：Red vs Blue 专区的纯逻辑/DOM 分层，同仓库「数学层纯函数 + 胶水层不单测」标准打法。前者零 DOM/fetch：`axisValue()` 按数据集声明的 `from:{kind:bench|ratio|route}` 派生雷达值（`ratio` 是唯一现算的 `derived` 值——成本效率=智能指数÷混合价，3:1 输入输出加权）；`normalizeAxis()` 按**当前名单**（非当前选中的对比子集）实时算 min/max 做 0–1 归一，**缺失值返回 `null` 而非 0**，`radarPolygon()` 相应把该顶点跳过连线而非拉到圆心——这是宪章②的代码级落地，不是文案承诺；`buildTable()`/`sortRows()` 给完整基准矩阵、`buildScoreboard()` 按声明权重归一算美中composite 与逐轴 lead/gap、`buildBoards()` 按台面权重分美/中两栏各十支。后者只做 SVG/DOM 投影（`createElement`/`textContent`，JSON 来源字符串禁止 `innerHTML`），雷达 SVG 的 `aria-label` 列出全部绘制数值，China 阵营描边额外加 `stroke-dasharray` 纹样（色觉不便用户可辨），表格空单元格印出未公布原因而非留白。`tests/sectorsCompetitionView.test.js` 用与 `tests/renderBudgetCoordinator.test.js` 同款的最小 DOM 桩（非 jsdom 依赖）覆盖交互——沙盒装得上 Playwright 的 Chromium 二进制但缺系统依赖且无 root 权限，无法跑真实浏览器，这是当前唯一的浏览器测试替代方案。
- 可视化无障碍契约（P0-07 已完成）：交互 SVG mark 必须是有名称的 `role=button` + `tabindex=0`，Enter/Space 与 pointer 走同一 action；Canvas 必须有文字摘要和并行 DOM 节点按钮；纯图像 SVG 的可访问名称必须包含实际值而非只写“chart”；装饰连线/背景 Canvas 一律 `aria-hidden`。Stats 记录表、Sectors 完整矩阵、Arena 模型卡/持仓表、Horoscope 维度详情分别是对应视觉的等价数据层。共享翻页左右键遇到 `a/button/form/canvas/role/tabindex/contenteditable` 焦点时必须让路。
- `dataToSpace.js`：sectors/universe 数据→3D 星域坐标。`MARKET_X={US:-1,CN:1}`、`BUCKET_Z={'model-vendor':-1.5,'core-ai-hardware':-0.5,'megacap-tech':0.5,benchmark:1.5,'supply-chain':0}`、y=confidence（`hasConfidence:false` 时中性 0.5）、mulberry32 seeded jitter、同 (market,bucket) 群组偏移。节点形状 `{id,kind:vendor|equity|universe,label,market,bucket,confidence,hasConfidence,x,y,z,vendor?}`。
- `sectorsStarfield.js`：THREE.Points + 自定义 GLSL（`gl_PointSize = aSize*(K/max(1.0,-mv.z))` 透视衰减 + fragment `discard` 圆形边缘）；Manhattan 三段折线 `LineSegments` 单 draw call；NormalBlending 实心圆片（**非** Additive 辉光——V1 方向性错误）；全屏 `.sfStage` modal + HUD（`?fx=starfield3d` opt-in）；生命周期、DPR 与帧窗上报由共享协调器负责。
- `bracketModel.js`：赛事无关淘汰赛模型（qf/sf/third/final 阶段 + 比分解析 + 主客重排）；`pinchZoom.js`：总览/轮次/单场三档状态机（触摸双指距 + ctrl+wheel + 按钮兜底共用）。
- `pinchZoom/scrubber` 交互统一走 **Pointer Events**（pointerdown/move/up + setPointerCapture），鼠标/触摸/笔一套代码。

### 4.6 共享 UI 逻辑
- `termGlossary.js`（U46）：`TERMS` 双语注册表 + `mountTermGlossary()` 单例浮层；`.term` 是真 `<button>`（22c：hover 专属信息零容忍）。
- `provenanceBadge.js` 数据龄分级；`trackRecord.js` 命中率组件（games/league 字节级重复的抽取，含逐字节回归测试）。
- 鼠标视差（U44）：pointermove 写 `--mx/--my` CSS 变量 + 自停 rAF lerp，CSS `calc()` 读取做分层位移；`@media(hover:hover)` 限定 + RM 归零。

## 5. 状态管理与运行时约定

### 5.1 客户端状态（全部 localStorage / URL，零后端）
`afflatus:locale:v1`（全站语言唯一键；`localeStore.js` 一次性迁移旧 `afflatus:lang`/`afflatus-lang`，新键写入确认后才清旧键）· `afflatus-horo:me`（生辰档案）· 关系册/签到 streak（horoscope）· `afflatus-combatview`（战斗视图）· `afflatus:reader:v1`（Serial 唯一版本化状态：`bookId/chapterId/offset/theme/fontSize/layout/bookmarks/visited/audioTrack`）· 星域/缩放等 flag 态。Serial 旧键只迁移一次，必须在新值逐字节回读确认后才删除；分享 = URL 参数（`?p=` base64url）或 Serial 稳定章节 URL。

### 5.2 双语双机制（重建时最易踩的坑）
- **共享持久层**：所有页面通过 `localeStore.js` 读写 `afflatus:locale:v1`；每个可切换语言的 HTML 入口在 `<head>` 最前运行同一段同步 pre-paint/migration，小于首帧且由 `site:check` 做逐页字节一致性守门。冲突顺序固定为新键 > 旧子页键 > 旧首页键。
- **子页**：`i18n.js`——`data-en`/`data-zh` 属性对，默认 textContent、带 `data-i18n-html` 用 innerHTML；`.lang-toggle` 按钮；切换派发 `window` 事件 **`afflatus-lang`**，动态页面监听重渲染。嵌在 data-* HTML 字符串里的子元素（如 `.term` 按钮）每次切换随 innerHTML 重建，天然存活；事件处理器必须**委托到 document**（course.js 术语浮层先例）。
- **首页**：`src/main.js` 只负责基础外壳与延迟调度；按需加载的 `src/homeExperience.js` 用 `setLang()` + `src/data/content.js` 的 `COPY` 做当前固定文档的初始动态投影，**不用 i18n.js**。语言控制本身是 `/en/`/`/zh/` 原生链接，并用 `localeSwitchHref()` 保留 query/hash；不得再用 `preventDefault()` 做只改 DOM、不改 URL 的首页切换。多数落点用 textContent——给某 label 嵌按钮必须改 `setLang()` 本体（U46 已做 sl1-sl3 先例）。

### 5.3 模块加载约定
- **每页一个显式 import 链入口**（`xxxEntry.js`）——同页多个独立 `<script type="module">` 会被 Vite 8 静默丢码（§9-1）。
- **Horoscope 功能边界（P7 / P1-04）**：`src/pages/horoscope.js` 保持唯一页面入口，出生/城市、个人命盘、合盘、测验和结果卡分别通过 `src/horoscope/*Feature.js` 动态导入。基础表单先就绪，命盘与合盘按真实资料触发，测验在距视口 200 px 时预取，PNG 渲染只在保存时加载；`fetchJson('transits')` 也不得回到关键入口。
- **Horoscope 重计算通道**：专业星历与全行星合盘统一由 `horoscopeSynthesis.worker.js` 执行；`createLatestWorkerTask()` 每个功能通道最多保留一个 Worker，新盘、关闭面板或 `pagehide` 必须真正终止旧计算。`pagehide` 只取消而不永久销毁通道，因为浏览器可能把文档放进 bfcache；返回后必须能运行新任务。Worker 不可用时才动态导入同一纯函数做主线程兜底，结果仍须通过请求 epoch 与当前资料身份校验后才能落入 DOM。
- **Sectors 页面边界（P9 / P1-06）**：`sectors.html` 只保留 `src/pages/sectors.js` 业务入口，数据、卡片、详情、滚动故事、竞品矩阵、页面 chrome 与图形所有权分别由 `src/sectors/*Controller.js` 管理。默认 2D 图距故事 900 px 才激活；`createExclusiveRenderer()` 保证切换前销毁旧 renderer，3D 懒加载失败则恢复 2D。力布局的 360 / 220 次 settle 在 `sectorsForce.worker.js` 中完成并以 transferable `Float32Array` 回传；Worker 不可用时才延迟调用同一纯函数。后存储集合按 4 + 3 + 3 渐进挂载，IntersectionObserver 与按钮共用一个批次函数。bfcache 的 `pagehide.persisted` 不销毁控制器，最终离页才完整解绑。
- **window 桥接模式**：经典内联 IIFE 需要 lazy `import()` 时，把 `import()` 放进 `type="module"` 块并暴露 `window.AfflatusXxx = {load:()=>import(...)}`；桥接模块就绪后 `dispatchEvent` 通知已在跑的 IIFE 重试（30j 时序 bug 的修复）。Sectors 已迁出此遗留模式。
- **数据桥接例外**：Signal/Serial 的经典内联控制器调用 `AfflatusFetchJson()`；同步 `public/lib/data-bridge.js` 只负责等待，真正实现由 Vite 管理的 `src/entry/dataBridge.js` 注入并派发 `afflatus-data-ready`。Sectors 直接 import `fetchJson()`。经典脚本不得写裸 `import('/src/...')`，因为该字符串不会被 Vite 转换，生产构建会 404。
- **rAF 纪律**：新 renderer 必须注册 `RenderBudgetCoordinator`，通过 `onPause/onResume/onResize/onQualityChange/onDispose` 暴露边界；不得自建 `visibilitychange` / page-lifecycle / resize 全局策略。确需独立 rAF 的组件由协调器门控可见性并上报帧窗；页面 master loop 在 hidden/freeze/pagehide 完全停止，恢复时重置时钟并夹紧 `dt`。
- **滚动纪律**：内容入场优先原生 `animation-timeline: view()/scroll()`（`@supports` 渐进增强 + 静态兜底）或 IntersectionObserver。只有 Canvas/WebGL 连续故事状态确实需要 0–1 精确进度时，才允许一个 passive `scroll` listener，并必须用单 rAF 合并、只读一次几何、hidden/offscreen 停画、destroy 完整解绑；Sectors v3 是当前唯一批准例外。

## 6. 定时任务与数据管线

- **调度（2026-08-12 可靠性重构）**：Codex scheduled tasks 只在专用、干净、固定 `main` 的 automation clone 运行，不再共享人工开发 checkout。四个 profile 分别负责盘前研究/决定、开盘成交、尾盘成交、盘后结算；本地调度为跨 DST 设置候选唤醒时刻，代码层 `America/New_York` 窗口门禁才是是否执行的唯一裁决。App/机器离线错过的交易窗口不可补做，只能写 `missed`；估值与研究允许如实追赶。
- **Arena 决定与成交**：S/P/T 全部订单在 09:30 ET 前生成并封存；Git 发布时刻是外部见证。盘中/盘后执行器只能按 `proposalId` 读取同日、未过期、哈希一致的已发布决定，在签名价格条件满足时原样成交或跳过，不能改标的、方向、数量、阈值或来源。`catchup` 永远强制空订单；盘后完整候选统一由 `npm run data:arena:postmarket:candidates -- --output=<临时目录>` 生成，再原子发布 `arena-postmarket`。
- **原子发布**：生成器只写临时候选目录；`data:publish` 独占 publisher lock，一次发布 config 声明的完整分组，依次跑数据校验、该 pipeline 的 strict freshness、全量测试与生产 build，成功后才 path-limited commit。失败恢复发布前字节并且无 commit。调度器使用另一把全程 orchestrator lock，禁止与 publisher 自锁。
- **推送成功定义**：push helper 拒绝 dirty/错误分支，不使用 autostash，显式推送已验证 `HEAD` 到 `origin/main`；任何 fetch/rebase/push 错误都非零退出，并在 `ls-remote` 确认远端 SHA 等于本地 commit 后才报告 `verified`。本地 commit 或 outbox 入队都不算推送成功。
- **提示词五条硬规则**（prompts/README，SKILL.md 只引用不复制）：① system/run 拆分吃 prompt caching；② 强制 JSON schema 输出；③ 状态外置零会话记忆（账本 JSON 是唯一事实源）；④ 只认 payload 注入数据、禁凭训练记忆报事实、不确定标 confidence 降权；⑤ 长度硬上限（复盘 ≤300 字、单条推理 ≤120 字）。**数据预消化**：指标计算/新闻去重用代码做，模型只做决策推理——一个数字模型算得出来 ≠ 应该让模型算。

### 6.1 Arena 幂等结算 / 离线补跑 / 摘要推送（Part 4 §19，2026-07-23 新增）

- `src/lib/arenaReconcile.js`（新增，纯函数）：run identity = `(date, window, model)`，`runIdentity()`/`hasCompletedRun()` 判断某窗口是否已 `done`；`upsertRunlogEntry()` 按身份幂等写入/替换（不产生重复条目）。`isTradingDay/tradingDaysBetween`（排除周末+`nyse-holidays-2026.json`，30 天硬上限防死循环）；`expectedRunsForDate()` 列出每个交易日应有的 8 个 `(window,model)` 组合（gatherer×2、S/P×2 窗口、T+reviewer 各一）；`findMissingRuns()` 对比 runlog 找出缺口，`buildMissedEntry()` 只生成 `status:'missed'` 记录、**从不**补造一笔事后交易（§19.3.2 铁律）。`needsLateMarkToMarket(runlog, model, date, holidays)` 判断某模型某日是否需要补一次空提案的 mark-to-market——**刻意不用账本顶层 `lastRunDate`**（那是全模型共享字段，S 跑过会让顶层日期前进，但不代表 P 也跑过），而是直接查 runlog 里该 model 当天是否有任一窗口的 `done` 记录。
- `scripts/apply-arena-run.mjs`（改造）：新增必需字段 `window`；结算前先查 `hasCompletedRun(runlog, etDateStr, window, book)`，命中则打印 no-op、账本原封不动退出（幂等，可安全重试/重放）；结算成功后自己把 `{date,window,model,status:'done',ordersProposed,ordersFilled,note,late?}` upsert 进 `arena-runlog.json` 一并写盘——调用方（SKILL.md）因此要同时提交 ledger+runlog 两个文件。手动端到端验证过：同一 run-input 跑两次，第二次正确 no-op，账本/runlog 字节不变。
- `scripts/reconcile-arena-run.mjs`（新增 CLI）：`node scripts/reconcile-arena-run.mjs <todayEtDateStr>`——"today"必须由调用方（SKILL.md 自己算好的 US/Eastern 日期）传入，本脚本不猜时区。从 runlog 里已知的最新日期走到 `todayEtDateStr`，把每个交易日的缺口记成 `missed`（写回 runlog），并打印 `lateMarkNeeded`（哪些 model 在哪些日期完全没跑过，需要调用方去抓 EOD 收盘价、带 `late:true` 调 `apply-arena-run.mjs` 补一次空提案 mark-to-market）。若 runlog 为空（Season 2 刚起步）直接 no-op，不猜起点。
- **离线 outbox**（`scripts/publish-arena-run.sh` + `scripts/queue-arena-outbox.mjs`，新增，§19.3.3）：`publish-arena-run.sh <runId> <msg> [payloadPath] [resultPath]` 统一提交 `arena-ledger.json`+`arena-runlog.json`；push 成功则顺带冲洗 `scripts/outbox/`（gitignored）里的历史积压条目（`mv ... .flushed_<ts>`，失败退化为 `rm -f`）；push 失败时结算早已安全落盘（这一步只是同步 git，不重跑任何业务逻辑），调用 `queue-arena-outbox.mjs` 落一条 `{runId,queuedAt,commitMessage,payload,result}` 审计记录到 outbox，下次任何 Arena 任务发布时自动重试冲洗。锁文件清理沿用 `mv` 而非 `rm`（沙盒对 `.git/` 下 unlink 有奇怪限制，`mv` 更可靠，真机上两者等效）。
- **每日摘要推送**（§19.4）：`arena-daily-digest.json` 由 post-market 任务（Reviewer 角色）生成；ntfy.sh 一行 `curl -d "<summary>" ntfy.sh/<private-topic>`——**topic 字符串本身是私密的"知道即可读"凭证，不写入本仓库任何文件**（本仓库 push 到 GitHub，topic 一旦提交进 git 历史即永久公开），只存在于 `/Users/feida/Claude/Scheduled/arena-autopilot-b-post/SKILL.md`（不受 git 管控）里；如需更换/失效重开新 topic，直接改那份 SKILL.md。站内 `src/pages/arenaDigest.js`（新增）：`localStorage['afflatus:arenaDigestSeen']` 记录上次已读的 digest 日期，不匹配则显示 `.digest-toast`（复用 `--viz-tip-*` token，不新增调色板）；点击/回车展开 `.digest-drawer`（每本账本 pnlPct/tradesCount/note + `delayed` 分节，队列可见而非静默，§19.4.4）。`validateArenaDigest.js` 相应补上 `delayed[]` 项的形状校验（date/window/model 必需 + 至少一个双语 note）。
- `scripts/compute-pulse-features.mjs`（新增）：Model P 的 `arenaFeatures.js` 纯函数 CLI 封装——SKILL.md 里的 open/late-window 任务自己 fetch 报价+K 线后传入此脚本算特征向量，绝不让 LLM 自己估算 gap%/VWAP/量能比这些数字（"代码算数字、模型做决策"纪律的延伸，同 §4.3 `arenaExec.js` 的休眠说明一脉相承——这次是真正被调用了）。
- **token 预算**：全部任务合计 ≈2.5M 输入/0.15M 输出每月。

## 7. 测试、CI 与验证

- `npm run test` = vitest run：**84 文件 1,193 条（2026-07-25 当前，含 Red vs Blue 新增的 sectorsCompetition/sectorsCompetitionView/forceGraph 阵营极化三批用例）**，全绿是合并前提。账本类代码不写测试不许上线。
- P0 状态以 `urgent.md` 为执行真源：P0-01～P0-07、P0-09、P0-10 已凭实现与门禁关闭；P0-08 因站主要求保留 Games/League，继续处于 owner hold，不得误当技术债清理自行退役。
- CI 基础门禁：vitest + `npm run typecheck` + build + **体积预算断言**（主 chunk 250KB / vendor-three 700KB / astronomy 60KB 量级）+ 12 份数据 schema + route manifest/sitemap/metadata 漂移 + `!important` 基线。
- 浏览器门禁：Playwright 对 8 个活跃路由运行桌面 Chromium、iPhone 16 Pro Max-like WebKit、Galaxy S26 Ultra-like Chromium；覆盖加载/metadata/overflow、键盘与路由、console/page error、桌面 axe 债务回归及每路由/设备两张确定性截图。桌面 Chromium 另用真实 `WEBGL_lose_context` 验证恢复/静态降级，验证 Stats 键盘图表、Sectors Canvas+DOM 节点等价层、Arena 曲线文字摘要，并断言 Signal 两个独立 renderer 共享一次已校验 JSON 请求。320×720 响应式 gate 另外覆盖全部 12 个 active/redirect/prototype/system 路由、44×44 HTML 触控目标和横向溢出。当前完整自动矩阵为 **150 collected：98 passed + 52 intentional skips**；Sectors v3 另在 1512×982、440×956、480×1040 做浏览器实视图复核，19 节点可达、零缩放控件、零页面横向溢出、零 console error。物理真机仍是发布签署条件。
- 字段性能：每个活跃入口只启动一次 `web-vitals` 的 CLS/INP/LCP。GA4 事件名固定为 `web_vital`，字段严格限于 `schema_version/metric_name/value/metric_value/metric_delta/metric_rating/metric_id/route/locale/device_tier`；`gtag` 未就绪时只在内存轮询 10 秒，超时丢弃。产品目标是 LCP ≤2.5 s、INP ≤200 ms、CLS ≤0.10（各自 p75），只按 route/locale/device tier 切片。部署后须在 GA4 管理端登记这些自定义维度/指标，样本不足时不得据此下结论。
- 实验室性能：`npm run test:lighthouse` 先清理 `.lighthouseci` 的旧生成报告、再 build，并以 Lighthouse 12.6.1 默认移动模拟对 8 路由各跑 3 次。路由 LCP/TBT/Speed Index/CLS/script bytes 为相对当前基线的 5% 硬回归门禁，total bytes 与总分只告警；基线是债务地板，不是合格目标。CLS 因字体/异步内容存在双峰，硬门禁采用三轮中可重复的高位 `clsBudgetBase`。采集器只在 stdout/report 明确包含瞬态 `NO_FCP` runtime error 时清理生成物并有界重试一次；普通断言失败不重试。P0-09/P0-10 只依据已完成的 24-report 批次与受影响路由三轮样本重录直接受新增平台入口影响的预算。Sectors 在该 Lighthouse 版本会间歇 `NO_LCP`，因此实验室硬门禁 FCP/Speed Index/CLS/script bytes，LCP 只告警并以上线后字段 p75 为判断源。2026-07-25 收口时当前 macOS 主机随后出现跨 Home/Arena/Horoscope 的持续 `NO_FCP`（采集器在断言前终止），故最终独立全站复跑必须在浏览器主机恢复后补做，不能把该 runtime error 记作页面通过或失败。
- **`!important` 计数基线**（`check-no-new-important.mjs`）：新增数必须为 0；改既有 `!important` 片段时原地改值不加新声明。
- 纯函数测试纪律：不依赖 DOM/fetch/`Date.now()` 默认值；确定性（同 seed 逐位一致）、无 NaN/Infinity、空输入优雅降级是标准断言三件套。
- **视觉改动的验证阶梯**：纯函数 vitest → 构建产物按内容 grep → 生产站 Claude-in-Chrome 复核（能做的话）→ **站主真机验收才算关闭**（沙盒无法渲染 WebGL/页面，V15 三轮返工换来的铁律）。高风险视觉一律 flag 起步（`?fx=`/`?combatview=`/`?ship=`），真机看过再转默认（U25 教训制度化）。

## 8. 构建与部署

```bash
npm run dev        # http://127.0.0.1:5173（本地无 /api，实时行情降级到简报快照属预期）
npm run build      # 沙盒里必须 npx vite build --outDir=/tmp/xxx（dist/ 权限受限，§9-13）
npm run preview
npm run test:e2e   # 三浏览器/设备配置的页面、键盘、axe、视觉与 CWV 传输合约
npm run test:lighthouse # 8 活跃路由 × 3 次 Lighthouse 回归预算
```
Vercel：push 即部署；`api/*.js` 自动成为 serverless 函数；环境变量 `FINNHUB_KEY`/`TWELVE_KEY`（改完必须 Redeploy）。验证：`/api/quote?symbol=NVDA` 返回含 `"c"` 的 JSON；arena 页显示 LIVE。

## 9. 「绝不再犯」台账（Anti-Patterns & Pitfalls Ledger）

> 每条 = 真实踩过的坑 + 已裁决的防线。重构期间逐条对照，违反任何一条需书面理由。

**构建/模块**
1. **Vite 8 多 module script 静默丢码**：同页挂多个独立 `<script type="module" src>` 时 chunk 去重不可靠，构建不报错但代码消失。→ 永远每页一个显式 import 链入口。
2. **经典 script 里的动态 import 不被打包**：`import()` 写在非 module 内联脚本里 Vite 不扫描，生产 404。→ window 桥接模式（§5.3）。
3. **桥接模块 vs 同步 IIFE 竞态**：module 脚本延迟执行，fetch 回来时桥可能没挂上→静默 return 且无重试。→ 桥就绪后 dispatchEvent，IIFE 监听重试。
4. **产物验证按文件名 grep**：Rollup 共享 chunk 命名不定。→ 按内容 grep（如 SITE 数组里的路径字符串）。
5. **「已完成」≠「已接入」**：weaponClock 曾带 20 条单测「完成」却从未被 import。→ 验收必须 grep 调用点。

**CSS**
6. **单体样式表膨胀 + `!important` 互搏**（styles.css 曾 7100→8000 行）：防线 = `@layer legacy/tokens/components/overrides` 分层（新规则只进 components/overrides）+ `!important` 新增数 0 的 CI 守门 + 每季度死代码清扫 + per-page 独立样式表分摊。**Tailwind 迁移已评估并否决**（U46-乙-④：全站重写风险/收益不成立；采纳其「防作用域污染」目标、走自有路径。重开需新证据）。
7. **多列网格断点降不到底**：sectors `.macro` 5 列在 820px 只降到 2 列、一路挤到手机（U46-乙-② 实修）。→ 每个 ≥2 列 grid 必须有 ≤480-768px 单列档，新页照查。
8. **移动端 vh 陷阱**：移动 Chrome `vh` 恒按地址栏隐藏算，pin 几何/偏移用 `vh` 会造成「死滚动」+ 元素挤压。→ 决定布局几何的一律 `svh`，纯装饰渐变可留 `vh`（30i）。
9. **半透明文字叠亮背景永远洗不清**：三轮返工结论——`rgba(...,.6~.8)` 压不住动态星云，且父级 opacity 会把修好的颜色再稀释。→ 亮动态背景上的可读文字用不透明纯色 + 不透明面板（30g）。

**JS/渲染**
10. **着色器常量跨场景照抄**：`gl_PointSize` 衰减常量从 alphardForge（相机距 ~150）抄进星域（55–320）→ 几乎不可见。→ 每个场景按自己的相机距离范围重推导常量（U42 真机 bug）。
11. **独立计时器脱钩主循环**：`setInterval(...,40)` 与 rAF 抢跑（V16 修正核弹/主炮倒计时）。→ 一切时序进 weaponClock/主循环。
12. **`window.scrollTo()` 测不了 scroll-timeline**：程序化滚动不触发合成帧，`ViewTimeline.currentTime` 恒 null，据此误判「原生 pin 已死」并叠加双动画推飞舞台（30h）。→ 滚动相关验证只认真实滚轮（computer 工具 scroll）。

**git/环境**
13. **沙盒 dist/ 权限受限**：build 一律 `--outDir=/tmp/...`。
13b. **沙盒装得上 Playwright 二进制、跑不起来**（2026-07-25 实案）：`npx playwright install chromium` 能下载 Chrome Headless Shell，但 `chromium.launch()` 因缺系统依赖（`libxdamage1` 等）+ 无 root/sudo（容器 no-new-privileges 阻止 `sudo playwright install-deps`）必然失败。→ 浏览器门禁（Playwright/axe/Lighthouse/真机）在此类沙盒里**不可执行**，视觉改动只能停在「单测已验证、视觉未验证」，必须显式记录待补跑而非假装通过；`tests/sectorsCompetitionView.test.js` 这类最小 DOM 桩单测是唯一可行的中间替代。
14. **`.git/*.lock` 残留链式故障 — 根因已查明，2026-07-25 彻底修复**：此前误判为「并行会话/崩溃进程留锁，时间戳 >30min 才清」，实际根因是 **Cowork 沙盒对已连接工作区文件夹的 unlink/rename 一律拒绝**（安全护栏，非 bug——用刚创建的全新 scratch 文件测试 `rm`/`os.unlink` 同样 `Operation not permitted`，与文件新旧、是否 `.git` 内无关），导致锁文件一旦产生就永久堆积（2026-07-25 实测积压 186 个历史锁碎片，跨 7/15–7/25 十天会话）。**真正修复**：调用 `mcp__cowork__allow_cowork_file_delete`（任意一个位于该工作区内的文件路径即可，例如 `.git/index.lock`）——一次调用即为**整个已连接文件夹**开启删除权限（不是只对传入的单个文件），此后 `rm`/`mv` 恢复正常，直到本次会话结束。**新会话开局若需要 git 操作，先主动调一次此工具**，不必等 `rm` 报错才被动触发；旧的私有索引/`commit-tree`/`update-ref` 迂回法（见 15）仅在**不便请求删除权限**时才用，不再是默认路径。
15. **陈旧主索引吃掉前一提交**（2026-07-18 实案）：私有索引提交后，主索引仍是旧树，随后的常规 `git commit` 把前一提交的文件**静默回退**（b9d2b16 revert 掉 5d278ec 的 sectors.css）。→ 私有索引提交后，下一次常规提交前必须 `git status` 逐文件核对暂存区；push 后 `git show --stat` 复核本次 diff 恰好是本次改动。
16. **定时任务残留文件**：`arena-a-open-*.json` 类未跟踪产物**永不 `git add`**；`git add -A` 前必看 status。
17. **key 泄露**（真实发生过）：scripts/ 进 git，任何脚本禁明文 key；能走 `/api/*` 代理一律走代理；泄露过的 key 必须后台重置。
18. **JSON 直引号**：中文引号一律「」，手改数据文件先跑对应 validate CLI。

**AI 协作（prompting 反模式）**
19. **幻觉数据结构**：凭训练记忆报价格/新闻/参数 → 只认 payload 注入数据（prompts 规则④）；spec prompt 里的「事实」必须先读代码核实——U45 的 wrapper「早已存在」、U46 的 flat-dropdown「早已修复」、U46-乙-① 的 Sharpe/Beta 实际在首页不在 arena，三案皆是照抄 prompt 就会白干/写错的实例。
20. **未限定作用域的 DOM 操作/顺手重构**：CLAUDE.md Surgical Changes——只动请求范围内的行；不「改进」相邻代码；孤儿（自己改出来的）才清理。U25 整批视觉一天内被站主要求 revert = 「大而全一次上」的代价，此后一律 flag 起步 + 小切片。
21. **推倒重写代替诊断**：30h 连环回滚教训——回滚要 `git diff <hash> HEAD --stat` 锁定差异文件、`git checkout <hash> -- <files>` 精确回填，不整仓 reset。
22. **每片一会话 / 一事一会话**：大改动切片，每片独立验证提交；卡顿即写状态换会话（对话可弃，文件永存）。
23. **LLM 直接编辑账本**：禁止。提案 JSON + 结算脚本是唯一路径。

**流程红线（R 系列 + O1，course.md 制度）**
24. R1 永不合并解释不了的代码 · R2 token 三问 · R3 待真机验收 >5 项冻结新视觉（flag 隔离项豁免）· R4 23 点后只写不 push 主干 · R5 会话结束 git status 必须干净 · R6 每周 10 分钟架构审视 · O1 >1 天改动先写 `rfcs/`。

## 10. 待办总账（迁移自 Urgent.md / roadmap.md，两文件已于 2026-07-18 删除，内容并入于此）

> KNOWLEDGE.md / technical.md / RELEASE_NOTES.md 三份纯已被本文件+`design.md`消化或属纯历史归档（git 本身即完整记录），已删除不再保留。Urgent.md / roadmap.md 删除前把全部未完成项摘要至此，避免活跃任务状态丢失。`course.md` 是独立于本文件体系的第 5 份例外文件（个人课程内容，每周自动化任务读写，与站点技术/设计无关），未删除、未迁移。

### 10.1 待「站主裁决」的架构/范围决策（非验收，是要拍板）

- **U23 首页默认 3D 场景架构**（RFC `rfcs/2026-07-13-u23-default-3d-scene.md`）：① B→A 路线（Combat View 默认 3D 化→单 renderer 3D 舞台化，C 全游戏化永久否决）是否通过；② 移动端 M2 默认档位（RFC 建议 T1 起步）；③ starfield Worker 线是否保留为 T1 兜底。
- **U22 六条视觉宪章 + 3D 技术栈裁决表 + 22a-c 跨页 UIUX 准则**：站主逐条裁决（RFC `rfcs/2026-07-13-u22-homepage-3d-combat.md`）；裁决表里 DPR 统一/座舱静态装饰清理/PWR·WPN·THR 能量格绑定三项可直接施工，无需重新立项。
- **U29 boot.html「AFFLATUS ENGINE」**：P0（RFC+COOP/COEP 头验证+WebGPU 探针）→P3（滞后 G 力相机+Catmull-Rom 镜头轨+演出优先评分器）→P4（后处理栈：色差/胶片颗粒/暗角/核爆折射冲击波/EMP glitch）→P5（WebGPU/Deferred 评估门，按 U27 触发条件）均未开工。
- **U27 战术连线/星云背景 flag 试看**：`?combatview=topdown&tacticalines=1`、`?combatview=topdown&nebula=1`（可叠加 `&combatcam=director`），满意后裁决转默认或保持 opt-in 或删除。
- **U21 三阶段架构升级**：Phase 1 已完成；**明确不做**框架迁移/Tailwind 全站化/数据库替代 git-as-database/three.js 无理由升级（沿用）；是否照 Phase 1 先例发「按重要性做完」指令待站主表态。
- **U26 git 锁文件纪律**：Scheduled 任务 prompt 里若有「git 失败时 mv 锁文件绕过」的兜底逻辑，需**改成遇锁等待重试**或**明确失败后跳过本轮**——`mv` 重命名锁文件是过去两周残留物的制造源头，本文件档案化的教训（§9-14/15）同样适用。站主自行编辑 `/Users/feida/Claude/Scheduled/*/SKILL.md`（沙盒读不到该目录）。`.git` 目录体积可选 `git gc` 收拢，非必需。
- **U3 命理测试题库**：区分度系统性重做（难度梯度标定）未做——需真实作答数据先攒（已上线计时+百分位），题库迭代另立项。
- **U7 会话卫生**：旧对话可直接归档/删除（状态已全在 tech.md/design.md/course.md+git 历史）；Scheduled 任务运行会话按周/月批量清理——均为 Cowork 界面操作，需站主在客户端自行清理。

### 10.2 roadmap.md 队列 B 未完成项（原样迁移，按原优先级）

0. **N1《玉熙宫词》第一部 30 章**（当前最高优先级，持续执行中）：v8 脚本定稿于 `prompts/yuxi-150-script.md`；30 章×~1.33万字≈40万字；第 1–3 章已扩写到位，第 4 章起沿用旧 120 章底稿素材（旧名未改仅取材）。执行方式：说「写第 N 章」，整章替换。
1. **V19 Phase 2/3**：`predCalibration.js` 校准（等 `arena-predlog.json` 攒够真实数据）→ `.wl-grid`/`.wl-card` 信号卡 UI（替换默认展开面板）。Phase 1 已完成攒数据中。
2. **V2 Games 世界杯收官**：被动监控，赛程推进补 `home/away/result` 即可。
3. **机会主义拾取（无排期压力）**：C1/C2 Signal 传导链可视化自动化（BREACH METER 概率位移条、事件回放迷你图 SPX ±2h sparkline）；B3 combatHudSC 机库跑道纵深透视（记录在案不建议单独立项，需接入起降路径，工作量远超数据绑定修复）。
4. **Sectors Red vs Blue RB-P1/P2**（原 `urgent.md` Part 3，RB-P0-01～07 已交付，见 §3/§4.5 与 design.md §3；以下三项未做）：
   - **RB-P1-01 成本/速度散点**（M）：智能指数 vs 成本、TTFT vs TPOT 双散点，crosshair 交互 + 表格兜底，复用 `sectorsCompetition.js` 已有的 `blendedPrice()`。
   - **RB-P1-02 供应链依赖彩带**（S）：HBM→GPU→云→模型、EUV/晶圆代工咽喉环节，作为现有 `forceGraph.js` 图里的新类型边，不建第二个渲染器。
   - **RB-P2-01 打磨**（S）：章节揭示时的节点辉光脉冲、子午线微光动效、新叙事的 OG 分享图刷新。

### 10.3 roadmap.md 队列 A 未完成/触发式项

- **A2 main.js 拆分 Phase 4 剩余**（state 飞行状态机/nav/boot）+ **Phase 5**（styles.css `@layer` 分层）：不在沙盒强做。
- **B6 首页 WebGL 收尾（已并入 P0-03/P0-06 完成）**：`saturnRenderer` 已补 raw-GL context-restored 全资源重建；各渲染面由 pixel-budget DPR 与统一 quality tier 自适应，不再以散落的固定 DPR 上限作为全局策略。
- **C3 three.js WebGPURenderer + Bloom/ACES**：投入大，等有余力评估。
- **serial.html 的 Astro 候选资格已关闭（P1-08）**：单章 SEO/独立分享链接已由 Vite 后处理静态派生解决，章节数增长本身不再构成迁移理由；只有出现必须依赖服务器运行时且经测量无法由当前 SSG 管线满足的能力时才重开 RFC。
- **SEO Phase 2**（SSG/SSR/Astro，已并入 C5 触发条件）/ **Phase 3**（`Person` JSON-LD 的 jobTitle/sameAs 需站主提供真实信息；独立 `/about` 页面）：均未排期。
- **`<head>` 样板重复合并**（~250 行×9页）：机会主义小任务，构建期脚本合并（非框架迁移），不单独立项。

---
*与 `design.md` 交叉引用：视觉宪章/叙事规则/UX 整改细则见彼；本文件管「怎么造」，彼文件管「造成什么样、为什么」。*
