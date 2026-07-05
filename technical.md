# Project Afflatus — Technical Guide / 技术细节与提交教程

> 架构、数据/接口、日常更新，以及手把手的 git 提交教程。
> 设计与路线图见 **roadmap.md**。

---

## 1. 架构 / Architecture

- **构建**：Vite MPA 多入口。八个 HTML 入口（`index.html` 首页 + `arena.html`/`sectors.html`/`signal.html`/`games.html`/`league.html`/`horoscope.html`/`serial.html`）全部在项目**根目录**，注册在 `vite.config.js` 的 `build.rollupOptions.input` 里，参与真正的压缩/哈希/公共 chunk 拆分（**不再是** `public/*.html` 原样拷贝的旧架构）。加新页只需把 HTML 放根目录、在 `vite.config.js` 加一行 input、在 `nav.js` 的 `SITE` 加一条——`league.html`（2026-07-04，V0）首次走通此流程，`horoscope.html`（2026-07-05，V20）再次验证，见下方 checklist。
- **JS 全部是 ES module**，按用途分三层目录：
  - `src/lib/` — 七页共享的基础库：`nav.js`（★ 唯一的 `SITE` 配置，见下）、`i18n.js`、`transition.js`、`page-turn.js`、`audio.js`、`clock.js`。
  - `src/pages/` — 各子页专属逻辑（`arena.js`/`arena-bg.js`/`games.js`/`league.js`）+ **每页一个入口文件**（`homeLibs.js`/`arenaEntry.js`/`sectorsLibs.js`/`signalLibs.js`/`gamesEntry.js`/`leagueEntry.js`/`serialLibs.js`），每个 HTML 只挂一个 `<script type="module" src="/src/pages/xxxEntry.js">`，入口文件内部用普通 `import` 按顺序声明该页真正依赖的库。
  - `src/scene/`、`src/ui/`、`src/data/` — 首页专属的 Three.js 场景 / Canvas HUD 绘制模块 / 静态文案数据（`content.js` 含首页 Top 10 持仓 `PICKS_ZH/EN`）。
  - `public/` 现在只放**真正静态**的资源：`page-turn.css`（6 个子页共享翻页箭头/字体/Labs 下拉样式）、各页数据 JSON、`assets/`、`favicon.svg`。
- **⚠️ 关键坑（加新共享脚本前必读）**：给同一页面挂多个独立的 `<script type="module" src="...">` 标签，Vite 8 的自动 chunk 合并/去重**不可靠**——构建不报错，但某个脚本的代码可能在某些页面的产物里静默消失。正确做法**永远是**每页一个显式 `import` 链的入口文件（上面 `xxxEntry.js`/`xxxLibs.js` 的由来），走 Rollup 常规 import 图打包路径。
- **导航与 Labs 下拉**：`src/lib/nav.js` 的 `SITE` 数组是唯一真源，渲染各页导航链接（`[data-afflatus-nav]` 占位）+ 循环推导 prev/next（写入 `body.dataset` 与翻页箭头 `href`）。给条目打 `group:'labs'` 会自动收进顶部 **Labs** 下拉菜单而不是顶层直链——目前 Games/Novels 是 labs 分组，未来季节性/实验性新页一律走这条路。下拉面板本身是 JS **portal 到 `<body>`**（`position:fixed` + 用 trigger 的 `getBoundingClientRect()` 定位，`z-index:99000`），不嵌套在触发按钮内——嵌套会被部分页面的 `clip-path`/低 `z-index` 祖先裁剪或遮挡。开关状态由 JS 的 `.open` class 驱动（hover/focus/click 开，Escape/outside-click/scroll/resize 关），而非纯 CSS `:hover`。下拉面板的字体/配色需要每页在 `page-turn.css`（5 个子页）或 `src/styles.css`（首页）里用 `--labs-*` CSS 变量按各自主题显式覆盖——面板不再是触发按钮的 DOM 后代，不会自动继承该页 `.nav a` 的样式。
- **战斗视图**：默认 HUD 是 HMD v3（`src/ui/combatHmdV3.js` 的 `drawCleanCombatHmd`，贯穿起飞/降落/巡航/战斗）；SC 风格全息面板（`src/scene/combatHudSC.js`）与俯视战场（`src/scene/topdownCombat.js`）都降级为可选皮肤，分别用 `?combatview=sc` / `?combatview=topdown` 访问。**注意命名冲突**：`src/scene/cameraDirector.js` 这个文件名是起飞/降落的外部运镜（`drawExternalLaunch`/`drawExternalLanding`），与下面 V14 的武器事件相机状态机 `weaponCameraDirector.js` 是两个不同文件，不要混淆。
- **相机导演系统（V14，2026-07-04，v1 切片）**：`src/combat/cameraMath.js`（纯函数：`smoothDamp`/`shouldPreempt`/`blendFactor`/`easeBlend`）+ `src/combat/weaponCameraDirector.js`（镜头状态机，`requestShot(id,{durationMs,blendInMs,refresh})`，高优先级立即抢占/同低优先级等到期，`refresh:true` 给高频事件续期不重启）。`topdownCombat.js` 内部委托它驱动相机，opt-in `?combatcam=director`——不带这个 flag 时行为与改动前字节级相同（仍是原硬编码摇摄，改名为 `tacticalTopdown` 镜头）。镜头库 v1 切片：`tacticalTopdown`/`bridgeWide`/`mainGunAxis`/`missileTail`/`ciwsTurret`，`impactOrbit` 与「空间深度四件套」视觉 polish 明确未做，见 ROADMAP §4 V14 条目下的范围边界说明。
- **Odin 参考舰体重建（V15/V15b，2026-07-04，v1 切片）**：`src/scene/odinHull.js`——**DOM/WebGL 完全无关的纯函数**（`createOdinHull(THREE,{add,mats,detail})`，只调用注入的 `add(geo,mat,t,r,s)` 回调，不自建 THREE.Group/材质/贴图），因此可以被 `capitalShip3D.js`（PBR 实体网格）与 `shipHologram.js`（网格+描边线框）两种渲染风格共用同一份几何，也因此是这批 3D 视觉工作里唯一能在沙盒里跑 `tests/odinHull.test.js` 头less 验证比例（长高比/艏占比/挂载点数量）的一层。两个消费文件都走 **opt-in `?ship=odin`**——这是本项目至今风险最高的可视化改动（直接换主战舰几何），沙盒完全无法渲染验证（`npm install puppeteer` 因网络白名单不含 `storage.googleapis.com` 失败），所以默认（无 flag）行为字节级不变，新舰体仅预览可见，范围边界见 ROADMAP §4 V15 条目。`src/scene/nighthawk.js` 做了 V15b 法线贴图升级（`heightToNormalMap()`，Sobel 梯度编码，取代原 bumpMap 近似）+ 增加非轮廓 greeble，零几何改动、默认生效（风险远低于 V15，可放行）。**2026-07-04 第四轮**（按用户详细文字拆解补齐参考图的 5 类细节缺口）：新增艏-舯衔接处交叠装甲收环板（层叠装甲视觉断点）、舯部两侧模块化舱段 `sideBayMounts`（8 个，每侧 4，导弹发射井/机库观感）、两侧点防御炮塔 `lateralTurretMounts`（4 个，每侧 2）、背脊炮塔改双联装、推进器加装甲整流罩——全部是挂载在既有连续 loft 壳体上的离散配件，不改船体轮廓，风险同炮塔/桅杆/吊舱那档。单测 94→97。
- **数据**：`public/arena-news.json`（每日定时任务生成）、`public/games-data.json`（手动更新）、`public/signal-events.json`（宏观事件档案，见第 3 节）、`public/novels-data.json`（章节内容）、`public/leagues-data.json`（**已创建，2026-07-04**，MSI 竞猜）、`public/arena-ledger.json` + `public/arena-universe.json`（**已创建，2026-07-04**，Autopilot 账本 + 固定交易域，见下方 V3 说明）。v1.5 规划新增但**尚未创建**：`sectors-data.json`（对比矩阵 + 后内存专题）——详见 ROADMAP §7。
- **Arena Autopilot 规则引擎（V3，2026-07-04）**：`src/lib/arenaRules.js`——纯函数集合，模型只提案 JSON 订单，这里的 `validateOrder`/`applyFill`/`checkStopLoss`/`checkDailyCircuitBreaker`/`checkSeasonReset`/`computeMetrics` 才是唯一有权改账本状态的代码。硬风控红线（单仓 20%/持仓 8 只/现金 5%/日熔断 3%/赛季重置 20%/信心门槛 0.65/Model A 周换手 20 笔/Model B 仅周二四开仓/分级滑点）全部是模块顶部 `LIMITS` 常量，不是提示词里的口头约定。单测见 `tests/arenaRules.test.js`。
- **触控热区扩展模式（D4，2026-07-05）**：`.nav a`/`.hbtn`/`.tf-b`/`.ind-b` 等交互元素统一用 `position:relative` + `::before{position:absolute;inset:...}` 扩大可点击/可触摸范围到 ≥44px，**视觉大小完全不变**（水平方向按各自现有 gap 收窄扩展幅度，避免相邻按钮热区重叠）。新页面的交互元素照此模式加，不要改元素本身的 padding/尺寸。
- **sitemap.xml + `<html lang>` 提前设置（D5，2026-07-05）**：`public/sitemap.xml` 静态列出 7 个入口页，`robots.txt` 指向它；新增页面时把该页 URL 加进 sitemap。每个页面 `<head>` 最前面（在任何 module script 之前）都有一行**同步、非 defer** 的内联脚本，按 localStorage 缓存的 `afflatus:lang` 提前把 `<html lang>` 设对，不等 `i18n.js` 作为 module script 跑完——新页面照抄这行内联脚本。**已知未根治的问题**：首页 hero 标题/副标题走 `main.js` 独立内容管线（非 `i18n.js` 的 `data-en`/`data-zh` 机制），仍会有一瞬间「先英后中」的文案跳变，根治需服务端按 `Accept-Language` 分流，留给 C5 Astro 迁移一并解决。
- **武器单时钟（V16，2026-07-04）**：`src/combat/weaponClock.js`——权威时间线纯函数模块（`startTimeline`/`phaseFraction`/`activePhase`/`msUntilPhase`/`forceAdvance`），`{weapon, t0, phases:[{name,at}]}` 结构，V14 相机导演可直接订阅。已修正 `main.js` 里两处实测确认的独立计时器（核弹 T- 倒计时、主炮蓄力倒计时此前各自跑 `setInterval(...,40)`，与 rAF 主循环脱钩——已改为在 `updateCombatModule()` 里逐帧更新）+ 删除 `halley.ciwsLaserStart/ciwsLaserUntil` 死代码（从未被读取、`performance.now()` 口径与全局 `Date.now()` 口径不一致）。**范围边界**：`combatCine.js` 的导弹/核弹分镜与 `halley.destroyed` 提前触发的强制剪切审计后确认本来就是从 `pilotView.started/until` 派生的单一 `e` 驱动，未改动；CIWS/核弹/导弹完整分镜时序改造为具名 `weaponClock` phases 留给 V14（相机切换点本来就需要具名 phases，届时一起做）。

### 新增页面 checklist（已由 V0 Leagues 完整走通并验证，2026-07-04）

1. `newpage.html` 放**项目根目录**（不是 `public/`）。
2. `vite.config.js` → `build.rollupOptions.input` 加一行。
3. 建 `src/pages/newpageEntry.js` 入口：按需 `import` `../lib/i18n.js`、`../lib/nav.js`、`../lib/audio.js`、`../lib/transition.js`、`../lib/page-turn.js`（顺序照抄现有 entry，**nav 必须在 page-turn 之前**）；HTML 只挂这一个 `<script type="module">`。
4. `src/lib/nav.js` → `SITE` 数组插入条目（插入位置 = 翻页循环顺序；季节页打 `group:'labs'`）。
5. `<body class="newpage-page" data-prev data-next>`（值会被 nav.js 覆写，但**建议仍然填对**，避免 no-JS/JS 尚未跑完前的一瞬间指向错误页——加 league.html 时顺手修正了 games.html/serial.html 的旧占位值）+ `<nav class="nav" data-afflatus-nav>` + 翻页箭头结构照抄 games.html。
6. `public/page-turn.css`：加 `.newpage-page .page-turn-controls` 箭头配色变量 + `.newpage-page .nav-labs__menu`/`a` 的 `--labs-*` 主题覆盖（下拉面板不继承页面样式，不配就是默认黑玻璃）。
7. 文案全部 `data-en`/`data-zh` 成对 + 页脚免责声明。
8. `npm run build` 后抽查 `dist/`：新页 HTML 200、其引用的 chunk 里确实含 nav 代码（防上面那个 chunking 坑）。**实测发现**：`nav.js`/`i18n.js`/`transition.js`/`page-turn.js` 这类被全部页面共享导入的库，Rollup 会把它们合并进一个共享 chunk（本次构建里合并进了 `transition-*.js`，命名取决于打包顺序不固定）——不要假设某个库一定在"自己名字" 的 chunk 里，**用内容 grep（如 SITE 数组里的新页面路径字符串）而不是按文件名 grep** 来验证代码是否真的在产物里。
9. `<head>` 最前面（任何 module script 之前）加同步内联脚本，按 `afflatus:lang` 提前设置 `<html lang>`（D5 模式，照抄现有六个子页任意一个）；`public/sitemap.xml` 加一行新页 URL。
10. 交互元素（导航链接/按钮/标签）如果视觉尺寸偏小，照 D4 模式用 `position:relative` + `::before` 扩展隐形热区到 ≥44px，不要直接改元素本身的 padding/字号。

### 首页渲染分层 / Home render layers
- `#starfield`（背景星空，fixed z0，OffscreenCanvas + Worker 渲染，特性检测自动回退主线程）→ `#blackhole-gl`（黑洞 WebGL，z1）→ `#event-layer`（2D 战斗/彗星，z2）。
- `.stardrive` 段（年化收益）自带一块 `#alphardForge` canvas，以顶/底渐隐 + `--bg` 调色融入页面背景；滚动进度写入 CSS 变量 `--forge`，驱动星体放大、台词逐字、数字点亮。

### 文件清单 / File map
```
index.html arena.html sectors.html    八个 Vite 入口（根目录）
signal.html games.html league.html
horoscope.html serial.html
src/main.js (~3.4k 行)   首页主程序（HUD/场景/光标/导航装配，仍是拆分中的单体文件）
src/scene/               首页 + 战斗场景模块（alphardForge / topdownCombat / combatHudSC /
                         combatCine / cameraDirector[起降运镜] / fighter3D / shipHologram / …）
src/combat/              权威时间线 + 相机导演：weaponClock.js / cameraMath.js /
                         weaponCameraDirector.js（V16/V14，均为可脱离 DOM 单测的纯逻辑层）
src/scene/odinHull.js    Odin 参考舰体共享几何布局（V15，同样可脱离 DOM 单测，见上）
src/ui/                  HUD 绘制模块（combatHmdV3 / battleFeed / marketDeck / viz 等）
src/data/content.js      首页文案 + Top 10 持仓 PICKS_ZH/EN
src/lib/                 八页共享库：nav.js（★ SITE 唯一真源）/ i18n.js / transition.js /
                         page-turn.js / audio.js / clock.js
src/lib/bazi.js          V20 四柱干支历法数学（纯函数，双锚点单测，见 §5 测试）
src/lib/horoscopeEngine.js  V20 日运/合盘/分享码引擎（纯函数+seeded 文案库，全本地无后端）
src/pages/               各页专属逻辑 + 每页一个入口文件（见上方架构说明）
public/page-turn.css     7 个子页共享：翻页箭头 + 自托管字体 + Labs 下拉结构样式
public/*-data.json       games-data.json / signal-events.json / novels-data.json /
                         arena-news.json / leagues-data.json / sectors-data.json
scripts/push-arena-news.sh  cron 数据推送管线（写 JSON → stash/rebase/commit/push）
prompts/                 v1.5 定时任务提示词库（README + 5 模块文件）
roadmap.md technical.md  仅有的两份设计文档（另见 CLAUDE.md、prompts/，机器向）
```
> **V20 观星台（horoscope.html，2026-07-05）架构要点**：整页零 fetch 零后端——四柱排盘/星座/日运/合盘全部在浏览器本地由上述两个纯函数库算出；生日只存 localStorage（`afflatus-horo:me`），签到 streak 同理；合盘分享 = 双方生日 base64url 编进 `?p=` 参数（`encodeShare`/`decodeShare`，有 vitest 覆盖的输入校验）。日运的「每天变化」来自真实干支历（今日日柱五行 vs 用户日主生克）+ seeded mulberry32 文案选择，确定性、可复现、无 API 成本。**节气/立春边界（2026-07-05 修正）**：不再用固定日期近似，改为 Meeus 低精度太阳视黄经公式 + 二分法实时算出每年真实节气日期（换算北京时间），修了「2025 年立春实际 2/3 而非惯常 2/4」这类固定表会判错的边界案例，测试用公开发布的真实节气时刻做夹具验证；西方星座分界日仍用通用近似表（传统上如此，非本次范围）。全页挂「仅供娱乐」。

---

## 2. 数据与接口 / Data & APIs

- **Finnhub**（实时报价，免费档 ~60/min）：前端调 **`/api/quote?symbol=…`**（Vercel Serverless 代理 `api/quote.js`），key 在服务端 `FINNHUB_KEY`。自适应轮询。
- **Twelve Data**（历史 K 线 W/M/6M/Y/5Y，免费 8/min·800/day）：前端调 **`/api/history?symbol=…&interval=…&outputsize=…`**（代理 `api/history.js`），key 在服务端 `TWELVE_KEY`；按需取、按天缓存到 localStorage。`D` 为实时日内。
- **⚠️ `/api/quote` / `/api/history` 的 symbol 校验与限流（D1，2026-07-05）**：symbol 正则收紧到真实 ticker 形状 `^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$`（支持 `BRK.B`/`BRK-A` 后缀），不合规格式直接 400、不打上游。新增 `src/lib/rateLimit.js`——纯函数滑动窗口限流（无第三方依赖，Vercel serverless 按实例隔离，非分布式），按 `x-forwarded-for` 分桶，quote 60 次/60s、history 20 次/60s，超限返回 429 + `Retry-After`；配额吃紧再评估 Upstash/KV。单测见 `tests/rateLimit.test.js`。**不做固定 symbol 白名单**——与 V13 的「搜索任意美股代码」功能冲突，故意留开放。
- ✅ **API key 已下沉到服务端**：`/api/*.js` 是 Vercel 根目录 Serverless 函数（与 Vite 静态构建并存，零配置自动部署），key 不再出现在前端包里。
  - **部署必做**：Vercel → Project → Settings → Environment Variables 添加 `FINNHUB_KEY` 与 `TWELVE_KEY`（值即原来的 key），重新部署。
  - **⚠️ 务必轮换旧 key**：旧 key 曾明文存在于前端与 git 历史，已泄露——去 Finnhub / Twelve Data 后台**重置生成新 key**，新 key 只填进 Vercel 环境变量。
  - 本地 `npm run dev`（纯 Vite）不跑 `/api`，实时行情会 404 并**自动降级到简报快照**（`arena-news.json` 的 `prices`），属预期；线上 Vercel 才有实时。
- **定时任务**：每个工作日美东开盘前约 1 小时（墨尔本约 22:30）跑一次，搜索当日 AI 相关新闻 + 我的个股预测，写入 `public/arena-news.json`（中英双语 + `aiPredictions`）。
- **定时脚本的 key 管理（历史教训，红线）**：`scripts/` 目录已进 git 跟踪——**任何脚本不允许出现明文 API key**。需要 key 的脚本统一 `source ~/.config/afflatus/env`（仓库外）；能走线上代理（`/api/quote` 等）的一律走代理。旧 key 泄露过一次（见下），同样的错误不能犯第二次。

### 导航闭环 / Nav cycle
`Home → Arena → Sectors → Signal → Games → Leagues → Horoscope → Novels → Home`（Games/Leagues/Horoscope/Novels 在顶部导航里收在 **Labs** 下拉，翻页顺序不受影响，仍按此顺序循环）。加新页只改 `src/lib/nav.js` 的 `SITE` 数组一处——prev/next、顶部链接/下拉分组会自动同步，不用像以前那样手改多个文件。

---

## 3. 日常更新 / Updating content

- **每日盘前简报 + 个股预测**：由定时任务自动写 `arena-news.json`（也可手动编辑）。结构：`items[]`（`title_en/zh`、`summary_en/zh`、`category`、`source`、`url`）+ `aiPredictions{符号:{direction,confidence,rationale_en/zh}}`。字段名仍叫 `opus`/`opusScore`/`opusOrder` 等（内部命名未改），但**显示文案**已统一为「Fable 5」，改数据时不用管字段名，只管填对应文案字段。
- **世界杯**：编辑 `public/games-data.json`。
  - 补赛果：把对应 fixture 的 `"result": null` 改成 `"home"|"draw"|"away"`，计分板自动结算。
  - 淘汰赛对阵确定后：把 TBD fixture 的 `home/away/homeFlag/awayFlag/opus/conf/reason_*` 填好。
  - 更新 `champions` / `players` 概率与 `updated` 日期。
- **Signal**：数据源是 `public/signal-events.json`（**不是**旧版内嵌在 `signal.html` 里的 `FOMC[]` 数组，那个写法已淘汰）。**V6（2026-07-04）起 schema 已从 v1 裸数组升级为 v2 对象**：顶层 `{ updated, version:2, as_of, hawkDoveCompass, pillarSummary, pillars, events }`。`events[]` 追加/修改单条沿用四段式具名字段（`id`/`date`/`type`/`pillar`/`class`/`hawkDove`/`name`/`before`/`print`/`repricing`/`equityReaction`/`verdict`，均中英对照）；`hawkDoveCompass`（`-2..+2` 打分，v1 人工打分，自动化留给 V7）与 `pillars`（5 条，`id 1-5` 对应 `inflation_data|fed_policy|earnings_guidance|industry_tech|geopolitics_trade`）是当前状态快照，原地刷新不追加历史。**手改这个文件务必先跑 `node -e "JSON.parse(require('fs').readFileSync('public/signal-events.json','utf8'))"` 校验**——V6 落地时曾在 `rationale_zh` 里混入未转义直引号导致语法错误，全站中文引号统一用「」不用直引号，这是踩过的坑不是假设性提醒。前端渲染逻辑：`signal.html` 内联 IIFE fetch 该文件，`.events` 走既有事件簿渲染器，`.hawkDoveCompass`/`.pillars` 走 V6 新增的罗盘/五维矩阵渲染器（对应 CSS 也内联在 `signal.html` 的 `<style>` 里，不在共享 `main-*.css` chunk，grep dist 产物时按此路径找）。
  - **V7（2026-07-04）自动化落地**：`public/signal-release-dates-2026.json` 是 WebSearch+直接抓取核实的 2026 全年 CPI/NFP/PCE/FOMC 发布日历（来源见文件内 `verifiedVia`），供调度任务判断今天该走 event 模式还是 weekly 模式还是直接跳过。**手改 `signal-events.json` 前务必跑 `node scripts/validate-signal-events.mjs`**——这是 `src/lib/validateSignalEvents.js`（v2 schema 纯校验函数，12 条 vitest 覆盖）包的 CLI 外壳，非零退出码就说明文件有语法或结构问题，不要提交。调度任务 `signal-warsh-daily`（cron `0 7 * * 2-6`）每次运行也必须在 `git add` 前跑这个校验器，校验不过就整轮中止、不发布——这是吸取 V6 手工编辑时踩过的 JSON 引号转义坑之后加的强制门禁，因为无人值守的定时任务没有人工审查这一步。
- **首页 Top 10 持仓**：`src/data/content.js` 的 `PICKS_ZH`/`PICKS_EN`，两个数组必须逐条一一对应（ticker 顺序、权重都要一致），权重合计应为 100。这是编译期数据，改完要走一次 build 才会生效，不是运行时读取。
- **Novels 章节**：`public/novels-data.json`。
- 改完务必本地 `npm run dev` 自查，再提交。

---

## 4. v1.5 数据管线与提示词库 / Data pipeline & prompts (v1.5)

> 完整模块规格见 **roadmap.md §7**；这里只记工程约定。

- **推送模式**：`scripts/push-arena-news.sh` 是现成的参考实现（**2026-07-04 修复版**）——触发 → 写目标 JSON → `git add` → **先 commit** → `git pull --rebase --autostash origin main` → `git push`。⚠️ 旧版的「`stash --keep-index` → rebase」组合**从未生效**（rebase 拒绝在暂存区有内容时运行，日志每次都报 `cannot rebase`，只因本地恰好从未落后于远端才没出事）；且旧版 `git add dist/arena-news.json` 被 `.gitignore` 的 `dist` 规则挡掉、一直是无效操作（`cp` 到 dist/ 保留，仅为本地 preview 一致性）。规划中的 `arena-ledger.json`/`leagues-data.json`/`sectors-data.json` 定时任务照修复版模式写（V12 计划模板化成通用 `push-data.sh <file> <msg>`）。
- **⚠️ 调度器架构更正（2026-07-04，V4 交付时核实）**：本节原写「调度器用 launchd 而非 crontab」是**从未真正落地的规划**——实测查证 `mcp__scheduled-tasks__list_scheduled_tasks` 发现 `ai-stock-arena-news-digest`（arena-news 简报）、`games-worldcup-daily`（世界杯）、`leagues-msi-daily`（Leagues）**全部**是 Cowork 自带的 scheduled-tasks，没有一个走 launchd + 本地 API key 脚本。V4 的 `arena-autopilot-a-open` 照这个已验证的实际模式建，不是文档原计划的模式——**任何后续定时任务的调度都应默认走 Cowork scheduled-tasks，不要重新评估 launchd 路线**，除非有具体理由（如需要系统级唤醒保证，Cowork 任务的限制见下）。以下 launchd 相关段落保留仅供历史对照，不代表实际做法：
  - ~~launchd 优于 crontab（`~/Library/LaunchAgents/au.feida.<task>.plist` + `launchctl load`）~~——从未实际建过一个 launchd plist。
  - ~~`~/.config/afflatus/env` 里存 API key 供本地脚本 `source`~~——目前没有任何脚本需要这样做；`scripts/apply-arena-run.mjs`（V4）之类的结算脚本只做纯计算+文件读写，行情数据由调度任务自己 fetch 已部署的 `/api/quote` 代理（key 在 Vercel 服务端），不下沉到本地脚本。
- **Cowork scheduled-tasks 的已知限制**：需要 App 处于打开状态才会触发（关闭时错过的任务在下次启动时补跑，语义类似"唤醒补跑"但触发条件是 App 而非系统级）。目前所有定时任务（arena-news/games/leagues/arena-autopilot）都接受这个限制，未来如果需要更强的可靠性保证（系统休眠/重启后依然按时触发），才需要重新评估本地 launchd + API key 方案。
- **日志不进版本库**：`scripts/*.log` 已加入 `.gitignore`；脚本本体（无密钥）进 git 跟踪，自动化本身也要有版本历史。
- **所有数据 JSON 顶层统一带 `{updated, version}`**，前端据此显示"数据龄"徽标（V12 起扩展为统一溯源徽章，见 roadmap.md）。
- **提示词库** `prompts/`：README 定五条硬规则（system/run 拆分吃 prompt caching、强制 JSON schema 输出、模型零会话记忆/状态外置、只认 payload 注入数据禁止凭训练记忆报事实、复盘限长）；`arena-autopilot.md`/`signal-warsh.md`/`sectors-watch.md`/`postmemory-top10.md`/`leagues-msi.md` 是五个模块各自的正式提示词文本（含 System Prompt 英文正本 + run payload 结构 + 中文对照）。新增任何定时任务前先读对应文件，不要另起炉灶——**调度任务的 SKILL.md 只应引用/读取这些文件，不要把内容复制粘贴进 SKILL.md 里**（复制会导致改一处、两处不同步）。
- **Arena Autopilot 结算管线（V4，2026-07-04）**：`src/lib/arenaRun.js`（`runArenaLedger`，纯函数，单次运行编排：mark-to-market → 止损扫仓 → 逐单校验/撮合 → 熔断判定 → 赛季重置判定 → 复盘文案更新；14 条 vitest）+ `scripts/apply-arena-run.mjs`（CLI：读 `run-input.json`（`{book, etDateStr, priceMap, proposedOrders, reviewZh, reviewEn}`）→ 调 `runArenaLedger` → 写回 `public/arena-ledger.json` → 打印结算摘要，不做 git 操作，由调度任务自己 commit+push）。`arena-ledger.json` 新增字段 `lastRunDate`（顶层，判断是否跨入新交易日）与 `dayStartEquity`（每本账本各一份，日内多次运行/熔断判定的记账基准）。`public/nyse-holidays-2026.json`（已 WebSearch 核实 2026 全年 10 个休市日）供调度任务运行前查表 no-op。**LLM 提案、代码收单的边界很硬**：调度任务的 SKILL.md 明确禁止直接编辑 `arena-ledger.json`，唯一路径是写提案 JSON + 跑结算脚本。
- **V18 战斗视图立体化 Phase 1（2026-07-05，第一个子项）**：`src/combat/weaponCameraDirector.js` 的 shot `compute()` 新增两个可选字段 `fov`/`roll`——两者都单独 `smoothDamp`（不设 `maxSpeed` 上限，因为量级本身很小，clamp 只会拖慢收敛），`roll` 换算成 `bankedUpVector(roll)` 在 `lookAt()` 之前设置 `camera.up`（`roll=0` 精确还原默认 `(0,1,0)`，所以旧的五个镜头预设零改动、行为完全不变——已有 6 条旧测试保持通过 + 3 条新测试专门覆盖这条向后兼容红线）；纯数学部分（`fovForAccel`/`bankAngle`/`bankedUpVector`/`chaseCamPose`）全部落在 `src/combat/cameraMath.js`，无 THREE.js 依赖，13 条新 vitest 覆盖。`src/scene/topdownCombat.js` 用这套math 新增 `chaseCam` 镜头预设——跟拍编队里的 `fighters[0]`，机身速度/加速度**不走帧差分**，直接用该机已有的解析飞行公式（`ph = t*1.1 + i*2π/3` 求一二阶导数）算出来，零额外闭包状态、零噪声；每 ~4.4s 自动请求一次、持续 2.2s，用于验证观感（`?combatcam=director` 灰度）。**范围声明（当时）**：本次只做「预设本体 + banking + 动态 FOV」，item 2（导弹 2D 分镜迁移到 3D）与 item 3（光照——已确认现有 key/ambient/rim 三光源大致满足，未改动）留待后续。
- **V18 Phase 1 item 2（2026-07-05，同日追加）**：导弹叙事迁到 3D chaseCam。**施工中发现**：`weaponClock.js`（V16）虽然有模块 + 20 条单测，但此前从未被任何调用点 `import` 过——roadmap 原「V16 已上线」的表述对「接入」二字过于乐观，这是它第一次被真正消费。做法：`main.js` 护航僚机投放导弹处新建 `startTimeline('missile', [drop@0, ignite@MISSILE_DROP_MS, terminal@MISSILE_IGNITE_MS, impact@7000])`（沿用驱动真实 `w.stage` 转换的同一组常量，不是另猜时长）；`topdownCombat.js` 新增 `driveMissileTimeline(timeline, nowMs)`——drop/ignite 阶段请求 `missileTail`（`durationMs` 封顶到刚好在 terminal 边界耗尽，让优先级更低的 `chaseCam` 能在 `shouldPreempt` 的「等当前镜头播完」规则下顺利接管，不卡在优先级墙上），terminal/impact 阶段切 `chaseCam`。`main.js` 的 `mode==='missile'` 分支新增第三条路径，`td3d = (combatViewTopdown() && combatCamDirector()) ? getTopdownCV() : null`——**双旗标同时开启**（`?combatview=topdown&combatcam=director`）才渲染 3D+HUD 标签，否则 `td3d` 为 `null`，完全落回原有 `combatViewLegacy()`/`drawMissileCine` 分支，字节不变；沿用既有的 `ctx.save()`/`ctx.restore()` 抖动包裹结构，新分支不额外 `return`（避免破坏该函数每帧唯一一对 save/restore 的平衡）。187/187 测试通过、生产构建干净。
- **V18 Phase 2「空间深度四件套」（2026-07-05，同日追加，Phase 1 之后紧接着做）**：`topdownCombat.js` 新增两套 `InstancedMesh` 系统，各自 1 次 draw call。**引擎尾焰彩带**：每机独立的定长环形缓冲（45ms 采一次尾部世界坐标、1200ms 老化剔除）驱动共享的一个 `InstancedMesh`（`PlaneGeometry` 基元，容量 = 战机数 × 17 段）；核心技巧是每帧对每一段重新计算一个**朝相机的 billboard 基向量**（`_width = dir × toCam`、`_normal = _width × dir`，用共享 scratch `Matrix4`/`Vector3`/`Color` 而不是每实例分配新对象）——固定水平或垂直的彩带在 `tacticalTopdown` 的近俯视与 `chaseCam` 的近水平视角之间必然有一侧会侧面消失，只有朝相机才两种镜头都读得出；白→青→蓝三段色随年龄 `lerp` 且整体乘 `(1-age)` 模拟淡出（内置材质没有逐实例 alpha，用「更暗＝更透明」在 Additive 混合下顶替）；未占满的实例槽位设为零缩放矩阵而非增删。**近景尘埃+速度拉伸粒子**：定长对象池（`prefers-reduced-motion` 减半 36→18，复用 arena.js/games.js/league.js/transition.js 等既有的 `matchMedia('(prefers-reduced-motion: reduce)')` 判定写法，没有另发明新写法），单个 `InstancedMesh`；每颗尘埃是世界空间固定点，只有超出摄像机 15 单位半径才在原地重生到新随机球壳偏移——真实视差本身就带来「掠过感」，不需要手动位移；拉伸方向/长度来自**帧差分的相机速度**（相机运动是镜头导演阻尼产生的，没有闭式解，不同于 chaseCam 用战机飞行公式直接求导），静止时颜色乘到接近黑避免杂乱常驻。**范围声明**：喷口辉光（item 5）与深度雾化（item 7）确认在 `nighthawk.js`（plasma 盘+plume 锥+glow sprite 三层，V15b 已有）和场景既有的 `FogExp2` 里已经具备同等效果，本轮未新增代码，避免重复造轮子。Phase 1+2 的这几处新增 THREE 逻辑都是场景内闭包（营地跟随现有 `missileTail`/`ciwsTurret`/`mainGunAxis` 等 shot compute() 的风格），**不额外补 vitest**——这类紧耦合 THREE 场景代码在本文件里一直是靠构建 + 真人视觉验收，不是靠单测（cameraMath.js/weaponClock.js 里可复用的纯数学部分已有 33+20 条覆盖）。187/187 测试通过、生产构建干净（topdownCombat 分片 21.15KB→23.78KB）。**Phase 3（环境叙事层：太阳眩光+可选山脊视差，加分项）仍待做**；**视觉观感需要真人在浏览器里过目**（沙盒无法渲染 WebGL），这是既有纪律。
- **V18 Phase 3「环境叙事层」（2026-07-05，同日追加，V18 三个 Phase 全部完成）**：`topdownCombat.js` 复用场景已有的 `key` 方向光当「太阳」（`SUN_DIR = key.position.clone().normalize()`，不另开一盏光），`camera.getWorldDirection()` 与 `SUN_DIR` 点积的平方控制眩光精灵强度（背对太阳直接归零）；眩光精灵每帧跟随放在「相机位置沿太阳方向 400 单位」处。两枚 lens ghost 用标准廉价手法：把太阳位置投影成 NDC 坐标，乘以负的小数（0.35/0.62）做「穿过屏幕中心镜像」，`unproject()` 回世界坐标——`_ndc.z>1`（太阳在相机背后）时透明度直接清零，不做遮挡检测（符合「廉价近似」的要求，真 Bloom/ACES 归 C3）。item 9（山脊剪影视差）路线图原文自述「不强求」，且太空场景的彗星/护航编队/战术网格已有同等纵深参照，确认跳过、不是遗漏。187/187 测试通过，生产构建干净（topdownCombat 分片 23.78KB→24.42KB）。**至此 V18 三个 Phase 的代码全部完成**；**全部观感仍需真人在浏览器里过目**（沙盒无法渲染 WebGL）——这是这一整条 V18 战线当前唯一悬而未决的风险点。
- **V19 Arena 预测差值信号层 Phase 1（2026-07-05）**：`src/lib/predlogEntry.js`（纯函数，`pctChange`/`directionHit`/`buildPredlogDay`/`appendPredlogDay`，16 条 vitest）+ `scripts/apply-arena-predlog.mjs`（CLI：读 `predlog-input.json`（`{date, actuals}`）→ 校验 `date` 必须与 `public/arena-news.json` 的 `date` 一致（不一致直接 `exit 1`，不吞错静默 no-op）→ 用 `news.prices[sym].prevClose` 建 `prevCloseMap` → 调 `buildPredlogDay`+`appendPredlogDay` → 写回 `public/arena-predlog.json`（60 交易日滚动窗口），不做 git 操作，同 `apply-arena-run.mjs` 的分工模式）。种子文件 `public/arena-predlog.json` = `{updated:null, version:1, days:[]}`。调度侧两处改动：`ai-stock-arena-news-digest` 的 prompt 加了 `predOpenPct`/`predClosePct` 两个输出字段（需与 `direction` 数值自洽）；新建定时任务 `arena-predlog-close-backfill`（`15 7 * * 2-6`，收盘后跑，避开 `signal-warsh-daily` 的 07:06 时段）负责 fetch 当日真实 O/C（`/api/quote`）→ 写 input 文件 → 跑本脚本 → git add 仅 `public/arena-predlog.json` → commit+push。已用合成数据端到端 smoke test 过一遍（含日期不匹配时正确报错退出、不改动文件的路径），**真实数据要等两个定时任务各自的下一次调度触发才开始积累**——这是 Phase 1 唯一悬而未决的点，性质上和 V18 的"待真人浏览器验收"不同（这里是纯粹的时间等待，不需要人工介入）。Phase 2（`predCalibration.js` 校准）/Phase 3（信号卡 UI）留待数据攒够。203/203 测试通过，生产构建干净。
- **V9-V11 Sectors 中美 AI 对比矩阵 + 后内存专题（2026-07-05）**：`src/lib/validateSectorsData.js`（纯校验函数，16 条 vitest，字段名与 `prompts/sectors-watch.md`/`prompts/postmemory-top10.md` 输出 schema 逐字对应——4 厂商 enum、open/closed route、US/CN market、direct/supplier/infra/competitor 关系标签、T1/T2/T3 track id、unchanged/updated 卡片状态，且显式拒绝任何数值相关系数字段，落实「只给定性关系标签」的纪律）+ `scripts/validate-sectors-data.mjs`（发布前校验 CLI，同 `validate-signal-events.mjs` 模式，`node scripts/validate-sectors-data.mjs` 退出非 0 即阻断发布）。种子文件 `public/sectors-data.json` = `{updated:null, version:1}`——校验器显式接受这个「空种子」状态（`modelWatch`/`baskets`/`postMemory` 三个键都缺省），前端据此渲染空状态文案而非假数据。`sectors.html` 新增两个数据驱动区块，复用 `signal.html` 已验证的 inline IIFE `fetch`+`render()`模式（`lang()`/`T()`/`esc()` 辅助函数、`afflatus-lang` 事件重渲染、无 DOM 单测——这类紧耦合页面渲染代码在本项目里一直靠构建+真人验收，不靠 vitest）：「US–CHINA AI WATCH」渲染 `modelWatch[]`（4 厂商卡：路线徽章+当前版本线+≤3 条带来源动态+代差研判）与 `baskets[]`（按厂商/市场分组的标的 tag，附定性关系标签）；「POST-MEMORY ERA」渲染 `postMemory.tracks[]`（T1/T2/T3 三主线状态）与 `postMemory.cards[]`（护城河/论点/关键风险三段式 + 催化剂 + 状态徽章），换股提议区块仅在非空时渲染。新建定时任务 `sectors-watch-weekly`（`0 10 * * 0`，周日 10:00 本机时间，SKILL.md 结构完全比照 `signal-warsh-daily` 的 STEP 0-5 五段式：判定月首周→monthly_deep 模式 → 读两份提示词+现有数据 → WebSearch+`/api/quote` 采集 → 按 schema 合并写 JSON → 跑校验 CLI 不过则中止 → 仅 commit+push `sectors-data.json` 一个文件）。**前端与后端管线均已就绪，真实数据要等下一个周日调度触发才开始出现**——纯粹是时间等待，性质上不同于 V18 的人工浏览器验收。219/219 测试通过，生产构建干净（`sectors.html` 22.40KB→32.88KB）。
- **B9 Odin 舰体贴花收尾（机会主义拾取，2026-07-05）**：`capitalShip3D.js` 的贴花辅助函数（`mkTex`/`decal`/`textTex`/`dangerTex`）原本定义在旧楔形舰体的 `else` 分支内部——这正是 `?ship=odin` 分支此前零贴花的直接原因（辅助函数根本不在其作用域内）。修复：把这些纯函数定义提到 if/else 之上，两个分支共用；Odin 分支新增 5 处 `decal()` 调用，坐标全部由 `createOdinHull()` 的真实返回值（`bowRoot`/`bowLen`/`length`/`height`/`turretMounts`）现算，不是照抄旧舰体的坐标——`oNose`/`oStern`/`oSternRoot` 三行特意加注释镜像 `odinHull.js` 内部同名常量的公式（`NOSE=bowRoot+bowLen`、`STERN=NOSE-length`、`STERN_ROOT=STERN+3.2`），该文件常量若改动需要同步这三行。贴花布局：舰名牌"TC CONDOR"+注册号"310106"在舯部两舷（`oMidMid` 附近，x=±0.85，在舯部半宽 1.25 以内）；"01"标牌贴在最靠舰艏的 `turretMounts[0]` 旁而不是 `muzzleAnchor`——后者实际探出到 z≈3.0，会侵入 V15 规格明确要求"留白"的刀锋舰艏区（`z<=bowRoot≈1.7`），开发过程中先算错过一次、靠 Node 直接跑 `createOdinHull()` 数值核对才发现并改正；两枚危险警示条在尾部推进器舱两侧（`x=±1.3, y=0.3` 绝对值，卡在尾部甲板半高 `sternDeckH/2≈0.45` 以内——同样是先写成 `height*0.3`≈0.545 溢出边界、核对数值后改成绝对值 0.3）。**greeble InstancedMesh 优化评估后判断跳过**：`odinHull.js` 的散布逻辑里每个 greeble 盒子是不同随机尺寸的独立 `BoxGeometry`，走统一的 `add(geo,mat,t,r,s)` 回调交给调用方建 Mesh（`capitalShip3D.js`）或 Mesh+EdgesGeometry 描边（`shipHologram.js`）；要收成单 draw call 的 InstancedMesh 得引入"共享单位立方体+非均匀缩放矩阵"且给 `odinHull.js` 加一个新的"可批处理 vs 结构件"回调区分（否则全息线框描边效果会丢），改动面会碰到已有 vitest 覆盖的纯函数契约——而当前性能量级本来就和 `capitalShip3D.js` 其余部分一致（未劣化），投入产出比不划算。219/219 测试通过（本次改动不影响 `odinHull.js` 本体，`tests/odinHull.test.js` 15 条不变），生产构建干净（`capitalShip3D` 分片 10.25KB→10.60KB）。**观感仍需真人在浏览器过目**（沙盒无法渲染 WebGL）。
- **B7 Games「夺冠之路」树状图（机会主义拾取，2026-07-05）**：`src/pages/games.js` 的 `renderBracket()` 重构前只硬编码渲染 `data.bracket.qf`——8 强战完之后数据里即使出现 `bracket.sf`/`bracket.final` 也没有渲染路径，等于半成品。改为 `BRACKET_STAGES = [qf, sf, final]` 顺序遍历，`data.bracket` 里实际存在（非空数组）的阶段才渲染成一个带小标题的 `.bstage` 子区块，卡片本身仍复用原有 `.qf`/`.qf-h`/`.qf-leg`/`.qf-slot` 等 CSS class（未改视觉，只改数据消费面），淘汰赛路径会随定时任务逐轮推进自动接上、不需要再改前端代码。区块大标题原本是 `games.html` 里写死的「ROUND OF 16 → QUARTER-FINALS」，而 `bracket.stageLabel_en/zh` 字段其实早就写在数据里却从未被读取——现在改为 JS 读取该字段动态设置标题文案。同步修改了 `games-worldcup-daily` 定时任务的 prompt：要求 8 强出线后创建 `bracket.sf`（含 WebSearch 核实的真实半决赛对阵/日期/场馆，`legs[].qfId` 关联到对应的 `bracket.qf` 条目 id）、4 强出线后创建 `bracket.final`（`legs[].sfId` 同理），每轮更新 `stageLabel_en/zh` 反映当前所处阶段过渡；并明确 `bracket.*` 各阶段数组**只增不删**——这与 `fixtures[]` 打完即删的精简策略刻意相反，因为保留完整路径正是这个功能存在的意义。真实的 sf/final 数据要等淘汰赛实际打到那一轮、定时任务下一次运行时才会出现。219/219 测试通过（本次改动是紧耦合 DOM 渲染代码，同 `games.js` 既有惯例不补 vitest），生产构建干净。
- **Arena Autopilot 前端 + B10 旧游戏下线（V5，2026-07-05）**：`src/pages/arenaAutopilot.js`——自包含 IIFE，架构上与 V13 的 `arenaTech.js` 同构（独立 fetch `arena-ledger.json`/`arena-universe.json`，只经 `afflatus-lang` 事件/`window.AfflatusI18N` 与页面外壳通信），渲染净值双曲线（Model A/B 真实逐日 + SPY/SMH 两点基准参考线）、每模型指标 chip、持仓表、成交/拒单合并日志。图表/P&L/基准线的数值计算全在纯函数模块 `src/lib/arenaLedgerView.js`（`unrealizedPnl`/`benchmarkEndpoints`/`equityDomain`/`scalePoint`，13 条 vitest）——这个页面不直接算数，只拼 DOM。**基准线是两点直线，不是真实历史曲线**：`arena-ledger.json` 的 `bench.{spyPct,smhPct}` 只存最新一次运行的累计百分比标量，没有逐日历史，`benchmarkEndpoints()` 只能诚实地画「从模型账本第一天起始净值，到最新一天按累计基准换算后的终值」这一条参照线，图例用虚线区分，不冒充真实行情。同一次改动把 `src/pages/arena.js` 从 ~375 行（几乎全部是旧 Human vs AI 游戏逻辑：名单轮询+图表指标+预测下注+计分板）瘦身到 ~85 行页面外壳（简报弹窗/市场状态/情绪/HUD 光标），B10 正式关闭，不再是 `.legacy-hidden` 隐藏状态。

---

## 5. 本地预览 & 构建 / Dev & build
```bash
cd ~/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in
npm install        # 仅首次
npm run dev        # http://127.0.0.1:5173  （逐页检查）
npm run build      # 产出 dist/（七个入口各自压缩打包，public/ 静态资源原样拷贝进去）
npm run preview    # 预览打包结果
```
> **测试（已引入，2026-07-04，V3 起）**：`npm run test`（`vitest run`，Vite 原生零配置）现跑十七个文件共 **279 条**（2026-07-05 复核，含 V20.1 节气精度修正；`tests/bazi.test.js` 23 条——含 1949-10-01=甲子日、1970-01-01=辛巳日双独立锚点验证干支日柱数学，另加 4 条真实节气时刻夹具（2000/2025/2026 立春、2024 小寒，均来自公开发布数据）+ 2025 年立春「2/3 而非固定 Feb-4」的年柱翻转边界断言——与 `tests/horoscopeEngine.test.js` 12 条：日运确定性/跨日变化/8..96 分数钳制/六合优于相冲/分享码 roundtrip 与垃圾输入拒绝；V12 另增 `tests/provenanceBadge.test.js` 与 `tests/trackRecord.test.js`）：`tests/validateSectorsData.test.js`（16，**V9-V11 Sectors**：`validateSectorsData` 的空种子状态放行、4 厂商卡数量/唯一性、开发动态数量上限、数值相关系数禁令、关系标签枚举、postMemory 卡片 tracks/唯一 ticker/置信度范围/换股提议可选性校验）+ `tests/arenaRules.test.js`（44，Arena 规则引擎）+ `tests/weaponClock.test.js`（20，武器单时钟，含"两消费者同时刻读同一时间线必须逐帧零差异"的 V16 验收断言）+ `tests/cameraMath.test.js`（25，V14 临界阻尼弹簧/抢占规则/混合曲线 + **V18 chaseCam 的 `fovForAccel`/`bankAngle`/`bankedUpVector`/`chaseCamPose` 纯函数**）+ `tests/weaponCameraDirector.test.js`（9，V14 镜头状态机，mock 相机对象，不依赖 WebGL；**V18 新增 3 条覆盖可选 fov/roll 字段——含"不设置这两个字段的旧分支必须保持零改动"的向后兼容断言**）+ `tests/odinHull.test.js`（15，V15 舰体比例/挂载点，mock `add()` 记录 mesh 算真实 `THREE.Box3`，不依赖 WebGL/DOM）+ `tests/arenaRun.test.js`（14，V4 Autopilot 结算管线）+ `tests/technicals.test.js`（21，V13 指标库）+ `tests/validateSignalEvents.test.js`（12，V7 Signal 事件 schema 校验）+ `tests/ladderLayout.test.js`（8，V13 Level Ladder 防重叠排版）+ `tests/rateLimit.test.js`（6，D1 API 限流）+ `tests/arenaLedgerView.test.js`（13，V5 Autopilot 前端 P&L/基准线/图表缩放）+ `tests/predlogEntry.test.js`（16，**V19 预测差值 Phase 1**：`pctChange`/`directionHit`/`buildPredlogDay`/`appendPredlogDay`，覆盖零/负基数、非有限值、旧 schema 缺字段回退、日期幂等 upsert、滚动窗口裁剪）。所有模块都刻意不依赖 DOM/fetch/`Date.now()` 默认值——调用方显式传入 `now`/`t`，保证可在 Node 定时任务、单测与浏览器三侧复用同一份逻辑。账本类代码不写测试不许上线，新增前先跑一遍确认没破坏现有分支。

---

## 6. 手把手 git 提交与推送 / Step-by-step commit & push

仓库：`github.com/FeidaWang/Afflatus`，分支 `main`。

**第一次（或忘了配置时）**
```bash
git config user.name  "FeidaWang"
git config user.email "你的邮箱"
```

**每次改完，三步走**
```bash
cd ~/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in
git status            # 看改了/删了哪些文件
git add -A            # 大写 A：把新增、修改、删除全部纳入
git commit -m "用一句话说明这次改了什么"
git push origin main
```
> 删除了文件时，一定用 `git add -A`，普通 `git add .` 不会记录"删除"。

**首次推送的登录**
- 用户名：`FeidaWang`
- 密码处粘贴 **Personal Access Token (PAT)**（不是登录密码）：
  GitHub → 右上头像 → Settings → Developer settings → Personal access tokens → 生成一个带 `repo` 权限的 token，复制粘贴即可（终端粘贴不显示字符是正常的）。
- macOS 钥匙串会记住，之后直接 `git push`。

**常见问题**
- `push` 被拒（远端有新提交）：先 `git pull --rebase origin main`，解决冲突后再 `git push`。
- 看最近提交：`git log --oneline -10`。
- 撤销未提交的改动（谨慎）：`git restore 文件名`；撤销暂存：`git restore --staged 文件名`。

**一键脚本（可选）**：可在仓库根目录建 `deploy.command`（双击即 build+commit+push），需要的话我可以帮你生成。

---

## 7. 部署 / Deploy（Vercel）

站点托管在 **Vercel**，监听 GitHub 仓库 `FeidaWang/Afflatus` 的 `main` 分支。

**日常部署 = 推代码即可**
```bash
cd ~/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in
git add -A && git commit -m "..." && git push origin main
```
推送后 Vercel 自动 `vite build`（输出 `dist/`）并部署；根目录 `api/*.js` 自动成为 Serverless 函数。状态见 vercel.com → 项目 → **Deployments**。

**环境变量（API 代理必需）**
- vercel.com → 项目 → **Settings → Environment Variables**，添加（Production/Preview/Development 全勾）：
  - `FINNHUB_KEY` = Finnhub key
  - `TWELVE_KEY` = Twelve Data key
- 改完环境变量必须 **Deployments → 最近一次 → ⋯ → Redeploy** 才生效。
- ⚠️ 旧 key 曾泄露（前端 + git 历史），务必在 Finnhub / Twelve Data 后台**重置新 key**，新 key 只填进 Vercel 环境变量。

**验证**
- 开 `https://feida.au/api/quote?symbol=NVDA` → 返回含 `"c"` 的 JSON 即代理 + 环境变量 OK；返回 `FINNHUB_KEY not configured` = 没配/没 redeploy。
- Arena 页股票卡显示 **LIVE**（而非全 SNAPSHOT）；F12 Network 看 `/api/quote`、`/api/history` 为 200。
- 本地 `npm run dev` 不跑 `/api`，实时会 404 并降级到简报快照（预期），以线上为准。

**首次接入（备忘）**：Vercel → Add New → Project → 选仓库 Import → 框架自动识别 Vite（Build `vite build`、Output `dist` 不改）→ 填环境变量 → Deploy → Settings → Domains 绑 `feida.au`。

---

*Design docs: this file + roadmap.md（人读）。Machine-facing markdown: CLAUDE.md（跨会话工作守则，工具链自动加载）、prompts/（定时任务提示词库）——不算设计文档，不要合并。*
