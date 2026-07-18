# tech.md — Project Afflatus 技术架构与工程蓝图（SSOT · Disaster-Recovery 级）

> **本文件性质**：全站重构期间的技术唯一真源（与 `design.md` 成对）。目标：即使整个代码库损毁，开发者/AI agent 仅凭这两份文档即可从零重建功能等价的站点。
> **整理基线**：2026-07-18，综合 KNOWLEDGE.md / technical.md / roadmap.md / Urgent.md（U1–U46）/ RELEASE_NOTES.md / course.md 全部内容 + 当日代码实况核对。
> **裁决冲突处理**：凡本文件与旧文档冲突，以本文件为准；凡重构提案与本文件「已裁决」条目冲突，需新证据才能重开（KNOWLEDGE §6 规则延续）。

## 目录

1. 系统架构与技术栈 · 2. 目录结构与页面装配 · 3. 数据文件台账与 Schema · 4. 核心算法与逻辑实现 · 5. 状态管理与运行时约定 · 6. 定时任务与数据管线 · 7. 测试、CI 与验证 · 8. 构建与部署 · 9. 「绝不再犯」台账（Anti-Patterns Ledger）

---

## 1. 系统架构与技术栈

**一句话**：零运行时框架的 Vite 8 MPA 静态站（Jamstack + Local-First），git 即数据库，Vercel push 即部署，2 个 serverless 代理函数是唯一后端。

| 层 | 选型 | 裁决状态 |
| --- | --- | --- |
| 构建 | **Vite 8 MPA**：每页一个根目录 HTML 入口，注册于 `vite.config.js` `build.rollupOptions.input` | 已裁决保留（U21：架构资产） |
| 运行时 | **vanilla ES modules，零框架**。React/Vue/Svelte/SSR/Rust/WASM 全站禁用 | 已裁决（roadmap §8.2，重开需新证据） |
| 框架迁移 | **Next.js/Astro 不做**——2026-07-12 正式评估（roadmap §8.4）：`<head>` 样板重复仅 ~250 行，唯一真实收益点是 serial.html 单章 SEO，收益集中一页、迁移风险摊九页。serial.html 的 Astro 候选资格单独记录（150 章或需要单章 SEO 时重评） | 已裁决 |
| CSS | 原生 CSS。主站 `src/styles.css`（~8000 行，`@layer legacy/tokens/components/overrides` 四层）+ 每页独立样式表 `public/styles/<page>.css`。**Tailwind 不做**（U46-乙-④：作用域污染已由 @layer 纪律 + `!important` 计数基线 + CI 体积预算控制；Tailwind = 全站重写 + 构建期依赖生态，过不了 U21 动刀标准。采纳其目标、沿用自有路径） | 已裁决 |
| 3D | three@0.160（仅首页 + sectors 星域，vendor 独立分包 ~674KB），**不无故升级**。WebGPURenderer 评估需真机基线后（U22b） | 已裁决 |
| 星历 | astronomy-engine（MIT，~130KB，动态 import 按需加载，仅 horoscope L3/合盘）。手写 VSOP87 系数判定不安全，Swiss Ephemeris WASM 精度过剩 | 已裁决（roadmap §7.10 模块四） |
| 类型 | TypeScript 渐进：`tsconfig.json`（strict/noEmit/checkJs）+ `npm run typecheck`；新模块用 `.ts`，不回改存量 `.js` | C4 试点已完成 |
| 后端 | **零后端**。仅 `api/quote.js` / `api/history.js` 两个 Vercel serverless 代理（Finnhub 实时报价 / Twelve Data 历史 K 线），key 在 Vercel 环境变量 `FINNHUB_KEY`/`TWELVE_KEY` | 常设 |
| 隐私 | Local-First：排盘/紫微/合盘全部浏览器本地计算，生辰只存 localStorage，分享 = base64url 编进 URL 参数。「出生数据永不离开设备」是隐私卖点也是无限水平扩展 | 红线 |
| 数据 | 静态 JSON 文件（`public/*.json`）= 内容引擎，git 版本历史 = 审计 = 回滚。数据与展示完全解耦 | 常设 |
| 调度 | Cowork scheduled-tasks（**不用 launchd**，历史规划从未落地，technical.md §4 已更正） | 已裁决 |
| 分析 | GA4（gtag 延迟到 requestIdleCallback，不抢首屏） | 常设 |

**域名/部署**：feida.au · Vercel 监听 GitHub `FeidaWang/Afflatus` main 分支 · 自动 `vite build` → `dist/`。

## 2. 目录结构与页面装配

### 2.1 页面清单（10 个 Vite 入口，导航循环序）

| 入口 | 身份 | 导航位置 | 状态 |
| --- | --- | --- | --- |
| index.html | 深空舰长日志（Three.js + 战斗 HUD） | 顶层 | 常设 |
| arena.html | 美股 TA 仪表盘 + Autopilot 双模拟盘 | 顶层 | 常设 |
| sectors.html | 中美 AI 矩阵 + 后内存专题 + `?fx=starfield3d` 数据星域 | 顶层 | 常设 |
| signal.html | 美联储观察（SCP 皮肤，Warsh 时代，U41 编辑部版式） | 顶层 | 常设 |
| games.html | 世界杯竞猜（U38/U39/U40 阶段滑杆+缩放+季军赛） | Labs | 2026-07-20 决赛后归档 |
| league.html | MSI 竞猜 | — | 已下线 →302 到 stats（U18） |
| stats.html | 竞猜战绩存档（Wilson/Brier/bootstrap） | Labs | 常设 |
| horoscope.html | 观星台：八字×占星×紫微，全本地零后端 | Labs | 常设 |
| serial.html | 小说书架 ×3 部（阅读器三主题） | Labs | 常设 |
| course.html | 个人 AI 工程课程 v3.0 + 每周一自动周报 | Labs | 常设 |
| boot.html | 「AFFLATUS ENGINE」全游戏化舰桥原型（noindex，不进 nav） | 无 | 可抛弃原型 |

### 2.2 目录树

```
/                        10 个 HTML 入口（根目录，非 public/）
api/                     quote.js + history.js（Vercel serverless，symbol 正则校验 + rateLimit）
src/main.js              首页主程序 ~3.5k 行（HUD/场景/光标/语言/装配，持续拆分中）
src/styles.css           首页/主站样式 ~8000 行，@layer 四层
src/lib/                 全站共享库（依赖零 DOM 的纯函数为主）：
  nav.js                 ★ SITE 数组 = 导航/翻页唯一真源；Labs 下拉 portal 到 <body>
  i18n.js                data-en/data-zh 引擎 + afflatus-lang 事件（首页除外，见 §5.2）
  transition.js page-turn.js audio.js clock.js
  arenaRules.js arenaRun.js arenaLedgerView.js predlogEntry.js rateLimit.js
  validateSectorsData.js validateSignalEvents.js provenanceBadge.js trackRecord.js
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
                         cursor.ts terminalStarMap softClock pageTurn …
src/data/content.js      首页文案 + Top 10 持仓 PICKS_ZH/EN + COPY 双语对象
public/page-turn.css     子页共享：翻页箭头 + 自托管字体 + Labs 下拉样式
public/styles/<page>.css 每页独立样式表（sectors/signal/games/league/horoscope/serial…）
public/*.json            数据文件（§3）
scripts/                 结算/校验/推送 CLI（进 git，禁明文 key）
prompts/                 定时任务提示词正本（README 五条硬规则 + 各模块文件）
rfcs/                    决策文档（O1 制度：>1 天改动先 RFC）
tests/                   vitest（57 文件 717 条，2026-07-18 计数）
```

### 2.3 新增页面 checklist（V0 验证，全文 technical.md §1，勿删）

HTML 放根目录 → vite.config input 加行 → 建 `src/pages/xxxEntry.js`（**nav 必须 import 在 page-turn 之前**）→ nav.js `SITE` 加条目（季节页 `group:'labs'`）→ body class + data-prev/next + `<nav data-afflatus-nav>` → page-turn.css 配色变量（`--labs-*` 下拉主题必须显式配，portal 面板不继承页面样式）→ 双语文案 data-en/zh 成对 → `<head>` 最前同步内联脚本按 `afflatus:lang` 预设 `<html lang>` → sitemap.xml 加行 → build 后**按内容 grep**（不按 chunk 文件名）验证。

### 2.4 首页渲染分层

`#starfield`（背景星空，fixed z0，OffscreenCanvas + Worker，特性检测回退主线程）→ `#blackhole-gl`（z1）→ `#event-layer`（2D 战斗/彗星，z2）。`.stardrive` 段自带 `#alphardForge` canvas，滚动进度写 CSS 变量 `--forge`(0→1)（原生 `animation-timeline:view()` 优先、JS pin 兜底），驱动星体放大/台词逐字/指标点亮/舞台缩放（30e `?fx=stage`→已转默认）。Combat View 默认 3D（U23 M1：`topdownCombat.js` + 导演运镜默认开，`?combatview=2d` 完整退路）。

## 3. 数据文件台账与 Schema

> 顶层统一 `{updated, version}`；前端溯源徽章（`provenanceBadge.js`：>36h 琥珀 / >72h 红）按数据龄分级。双语字段新约定：嵌套 `{en,zh}`。**账本/记录类 JSON 只许经结算脚本修改，禁止手编**。

| 文件 | 写入方 | 消费页 | 关键 schema/纪律 |
| --- | --- | --- | --- |
| arena-news.json | ai-stock-arena-news-digest（交易日 22:00） | arena | `items[]{title/summary_en/zh,category,source,url}` + `aiPredictions{sym:{direction,confidence,rationale,predOpenPct,predClosePct}}` |
| arena-ledger.json | arena-autopilot-a-open / b-post | arena | **只许经 `scripts/apply-arena-run.mjs`**；`lastRunDate` + 每账本 `dayStartEquity` |
| arena-predlog.json | b-post Phase 1 | （Phase 3 待建 UI） | 只许经 `apply-arena-predlog.mjs`；60 交易日滚动窗口 |
| arena-universe.json | 静态 | arena/sectors 星域 | `{updated,version,note_en/zh,symbols:[{sym,name,bucket}]}`，30 symbol，bucket ∈ core-ai-hardware/megacap-tech/benchmark |
| sectors-data.json | sectors-watch-weekly（周日 10:00） | sectors | `{modelWatch:[4 厂商],baskets:[{vendor,market,equities:[{ticker,relation,confidence,correlation_note}]}],postMemory,weeklyTake}`；发布前 `validate-sectors-data.mjs`；**显式拒绝数值相关系数字段**（只给定性关系标签） |
| signal-events.json | signal-warsh-daily（交易日 07:00） | signal | schema v2：`{updated,version:2,as_of,hawkDoveCompass(-2..+2),pillarSummary,pillars[5],events[]}`；发布前 `validate-signal-events.mjs` 强制 |
| signal-release-dates-2026.json / nyse-holidays-2026.json | 静态年更 | 任务守卫 | 发布日历/休市日查表，不为此调 API |
| leagues-data.json | （任务过期待删） | stats | stats 前端实时计算全部统计 |
| games-data.json | worldcup-games-daily（至 7/20） | games→stats | `fixtures[]{result:null→home/draw/away}` + `bracket.{qf,sf,third,final}`（只增不删）+ `champions/players` |
| novels-index.json + novels/*.json | 手动/写作会话 | serial | U21 已分片（原 485KB 单文件拆索引+分册） |
| transits-daily.json | horoscope-transits-daily（每日 06:30） | horoscope | <2KB 当日行星黄经，客户端零星历库算日运 |

## 4. 核心算法与逻辑实现

> 仓库标准打法：**数据/数学层 = 依赖零 DOM/fetch/Date.now 的纯函数 + vitest 全覆盖；渲染胶水层不单测、靠构建 + 真机验收**。now/t 一律显式传参。重建时先建纯函数层再接 DOM。

### 4.1 统计引擎（stats.html 内联 + src/lib）
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

### 4.3 交易模拟（arena）
- `arenaRules.js`：**LLM 提案、代码收单**——模型只出 JSON 订单，`validateOrder/applyFill/checkStopLoss/checkDailyCircuitBreaker/checkSeasonReset/computeMetrics` 是唯一有权改账本的代码。硬风控全部是模块顶部 `LIMITS` 常量（单仓 20%/持仓 8 只/现金 5%/日熔断 3%/赛季重置 20%/信心 0.65/A 周换手 20 笔/B 仅周二四开仓/分级滑点）。
- `arenaRun.js`：单次运行编排 mark-to-market→止损→撮合→熔断→赛季重置→复盘。
- `predlogEntry.js`：`pctChange/directionHit/buildPredlogDay/appendPredlogDay`；规划中 `predCalibration.js` 三态信号 LEAN LONG/NEUTRAL/LEAN SHORT（`calibConf ≥0.62` 且近 20 次 hitRate ≥55%，信号必挂 hitRate+Brier 战绩——不越「非投资建议」红线的硬约束）。
- `rateLimit.js`：纯函数滑动窗口（按 x-forwarded-for 分桶，quote 60/60s，history 20/60s，429+Retry-After）。symbol 正则 `^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$`。

### 4.4 运动/相机数学（src/combat/cameraMath.js —— 全站唯一缓动正源）
- **`smoothDamp(current, target, velocityRef, smoothTime, dt, maxSpeed)`**：临界阻尼弹簧。用途：3D 战斗相机、星域轨道/fly-to、鼠标视差、任何「有质量感」的插值。**禁线性 tween，禁引 GSAP**（U30/U42/U43/U44 四次裁决）。
- `shouldPreempt/blendFactor/easeBlend`（镜头抢占/混合）、`fovForAccel/bankAngle/bankedUpVector/chaseCamPose`（追击相机）。
- `weaponClock.js`：权威时间线 `{weapon,t0,phases:[{name,at}]}`，`startTimeline/phaseFraction/activePhase/msUntilPhase`；`weaponCameraDirector.js`：`requestShot(id,{durationMs,blendInMs,refresh})` 优先级抢占状态机。
- `flightPath.js`：起降生命周期 `DOCKED→CATAPULT→CLIMB→CRUISE→BREAK→APPROACH→TOUCHDOWN`，Hermite 链式段 C1 连续，速度/加速度解析求导（零帧差分噪声）。

### 4.5 图形/交互引擎
- `forceGraph.js`：自研力导向（两两斥力 + Hookean 弹簧 + 弱引力锚点，固定步长 Euler）。**教训内嵌**：pressure 连线必须用带 rest length 的弹簧（恒定力不收敛）；锚定力施加在自由端而非被钉住的极点（被钉节点跳过受力）。
- `sectorsGraphView.js`：Canvas 2D 渲染 + IntersectionObserver 门控 rAF + pan/zoom/拖拽（单 2D 变换矩阵）。
- `dataToSpace.js`：sectors/universe 数据→3D 星域坐标。`MARKET_X={US:-1,CN:1}`、`BUCKET_Z={'model-vendor':-1.5,'core-ai-hardware':-0.5,'megacap-tech':0.5,benchmark:1.5,'supply-chain':0}`、y=confidence（`hasConfidence:false` 时中性 0.5）、mulberry32 seeded jitter、同 (market,bucket) 群组偏移。节点形状 `{id,kind:vendor|equity|universe,label,market,bucket,confidence,hasConfidence,x,y,z,vendor?}`。
- `sectorsStarfield.js`：THREE.Points + 自定义 GLSL（`gl_PointSize = aSize*(K/max(1.0,-mv.z))` 透视衰减 + fragment `discard` 圆形边缘）；Manhattan 三段折线 `LineSegments` 单 draw call；NormalBlending 实心圆片（**非** Additive 辉光——V1 方向性错误）；全屏 `.sfStage` modal + HUD（`?fx=starfield3d` opt-in）。
- `bracketModel.js`：赛事无关淘汰赛模型（qf/sf/third/final 阶段 + 比分解析 + 主客重排）；`pinchZoom.js`：总览/轮次/单场三档状态机（触摸双指距 + ctrl+wheel + 按钮兜底共用）。
- `pinchZoom/scrubber` 交互统一走 **Pointer Events**（pointerdown/move/up + setPointerCapture），鼠标/触摸/笔一套代码。

### 4.6 共享 UI 逻辑
- `termGlossary.js`（U46）：`TERMS` 双语注册表 + `mountTermGlossary()` 单例浮层；`.term` 是真 `<button>`（22c：hover 专属信息零容忍）。
- `provenanceBadge.js` 数据龄分级；`trackRecord.js` 命中率组件（games/league 字节级重复的抽取，含逐字节回归测试）。
- 鼠标视差（U44）：pointermove 写 `--mx/--my` CSS 变量 + 自停 rAF lerp，CSS `calc()` 读取做分层位移；`@media(hover:hover)` 限定 + RM 归零。

## 5. 状态管理与运行时约定

### 5.1 客户端状态（全部 localStorage / URL，零后端）
`afflatus:lang`（子页语言）· `afflatus-lang`（首页语言，独立管线）· `afflatus-horo:me`（生辰档案）· 关系册/签到 streak（horoscope）· `afflatus-combatview`（战斗视图）· 阅读器主题/书签/进度（serial）· 星域/缩放等 flag 态。分享 = URL 参数（`?p=` base64url）。

### 5.2 双语双机制（重建时最易踩的坑）
- **子页**：`i18n.js`——`data-en`/`data-zh` 属性对，默认 textContent、带 `data-i18n-html` 用 innerHTML；`.lang-toggle` 按钮；切换派发 `window` 事件 **`afflatus-lang`**，动态页面监听重渲染。嵌在 data-* HTML 字符串里的子元素（如 `.term` 按钮）每次切换随 innerHTML 重建，天然存活；事件处理器必须**委托到 document**（course.js 术语浮层先例）。
- **首页**：`src/main.js` 自有 `setLang()` + `src/data/content.js` 的 `COPY` 对象，**不用 i18n.js**。多数落点用 textContent——给某 label 嵌按钮必须改 `setLang()` 本体（U46 已做 sl1-sl3 先例）。已知未根治：先英后中一瞬跳变（根治需 SSR，留给 serial-Astro 候选评估）。

### 5.3 模块加载约定
- **每页一个显式 import 链入口**（`xxxEntry.js`）——同页多个独立 `<script type="module">` 会被 Vite 8 静默丢码（§9-1）。
- **window 桥接模式**：经典内联 IIFE 需要 lazy `import()` 时，把 `import()` 放进 `type="module"` 块并暴露 `window.AfflatusXxx = {load:()=>import(...)}`（AfflatusI18N/AfflatusProvenance/AfflatusSectorsGraph/AfflatusSectorsStarfield 同款）；桥接模块就绪后 `dispatchEvent` 通知已在跑的 IIFE 重试（30j 时序 bug 的修复）。
- **rAF 纪律**：禁独立 rAF 循环（挂进页面主循环）；后台 canvas 用 IntersectionObserver 门控可见性；`document.hidden` 停画。
- **滚动纪律**：零 scroll 监听——原生 `animation-timeline: view()/scroll()`（`@supports` 渐进增强 + 静态兜底）或 IntersectionObserver。

## 6. 定时任务与数据管线

- **调度**：一律 Cowork scheduled-tasks（App 打开才触发，错过下次启动补跑——已接受此限制）。任务台账唯一真源 = Urgent.md U20 表；限时任务必带到期日；每月 1 号对照审计。
- **典型任务**（cron 本机 AEST）：arena-news 交易日 22:00 · arena-autopilot a-open/b-post 交易日 · signal-warsh-daily `0 7 * * 2-6` · sectors-watch-weekly `0 10 * * 0` · worldcup-games-daily（至 7/20）· horoscope-transits-daily 每日 06:30 · course 周报周一。守卫先行：周末/NYSE 假日/无赛事直接 no-op。
- **推送序列（唯一正确姿势）**：写 JSON → 校验 CLI（validate-*.mjs，非零退出即中止不发布）→ `git add <单文件>` → **先 commit** → `git pull --rebase --autostash origin main` → `git push`。通用脚本 `scripts/push-data.sh <file> <msg>`。
- **提示词五条硬规则**（prompts/README，SKILL.md 只引用不复制）：① system/run 拆分吃 prompt caching；② 强制 JSON schema 输出；③ 状态外置零会话记忆（账本 JSON 是唯一事实源）；④ 只认 payload 注入数据、禁凭训练记忆报事实、不确定标 confidence 降权；⑤ 长度硬上限（复盘 ≤300 字、单条推理 ≤120 字）。**数据预消化**：指标计算/新闻去重用代码做，模型只做决策推理——一个数字模型算得出来 ≠ 应该让模型算。
- **token 预算**：全部任务合计 ≈2.5M 输入/0.15M 输出每月。

## 7. 测试、CI 与验证

- `npm run test` = vitest run：**57 文件 717 条（2026-07-18）**，全绿是合并前提。账本类代码不写测试不许上线。
- CI 五件套（U21）：vitest + `npm run typecheck` + build + **体积预算断言**（主 chunk 250KB / vendor-three 700KB / astronomy 60KB 量级）+ 数据 schema 校验。
- **`!important` 计数基线**（`check-no-new-important.mjs`）：新增数必须为 0；改既有 `!important` 片段时原地改值不加新声明。
- 纯函数测试纪律：不依赖 DOM/fetch/`Date.now()` 默认值；确定性（同 seed 逐位一致）、无 NaN/Infinity、空输入优雅降级是标准断言三件套。
- **视觉改动的验证阶梯**：纯函数 vitest → 构建产物按内容 grep → 生产站 Claude-in-Chrome 复核（能做的话）→ **站主真机验收才算关闭**（沙盒无法渲染 WebGL/页面，V15 三轮返工换来的铁律）。高风险视觉一律 flag 起步（`?fx=`/`?combatview=`/`?ship=`），真机看过再转默认（U25 教训制度化）。

## 8. 构建与部署

```bash
npm run dev        # http://127.0.0.1:5173（本地无 /api，实时行情降级到简报快照属预期）
npm run build      # 沙盒里必须 npx vite build --outDir=/tmp/xxx（dist/ 权限受限，§9-13）
npm run preview
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
14. **`.git/*.lock` 残留链式故障**：并行会话/崩溃进程留锁。→ 时间戳 >30min 才清；rm 被拒用**同目录 rename** 顶替；极端时走私有索引 `GIT_INDEX_FILE=/tmp/x git read-tree HEAD && git add … && git write-tree && git commit-tree && git update-ref`。
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

### 10.3 roadmap.md 队列 A 未完成/触发式项

- **A2 main.js 拆分 Phase 4 剩余**（state 飞行状态机/nav/boot）+ **Phase 5**（styles.css `@layer` 分层）：不在沙盒强做。
- **B6 首页 WebGL 收尾**：`saturnRenderer` 等 raw-GL 渲染器补完整 context-restored 重建；跃迁点 shader 弱机自适应；统一渲染器 `powerPreference`/dpr 上限（现 1.75 vs 1.5 不一致）。
- **C3 three.js WebGPURenderer + Bloom/ACES**：投入大，等有余力评估。
- **serial.html 的 Astro 候选资格**：单独记录，不与页面数量绑定——待章节数继续涨（150 章目标）或需要单章 SEO/独立分享链接时再评估，不在 2026-07-12 结论范围内。
- **SEO Phase 2**（SSG/SSR/Astro，已并入 C5 触发条件）/ **Phase 3**（`Person` JSON-LD 的 jobTitle/sameAs 需站主提供真实信息；独立 `/about` 页面）：均未排期。
- **`<head>` 样板重复合并**（~250 行×9页）：机会主义小任务，构建期脚本合并（非框架迁移），不单独立项。

---
*与 `design.md` 交叉引用：视觉宪章/叙事规则/UX 整改细则见彼；本文件管「怎么造」，彼文件管「造成什么样、为什么」。*
