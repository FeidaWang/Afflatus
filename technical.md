# Project Afflatus — Technical Guide / 技术细节与提交教程

> 架构、数据/接口、日常更新，以及手把手的 git 提交教程。
> 设计与路线图见 **roadmap.md**。

---

## 1. 架构 / Architecture

- **构建**：Vite MPA 多入口。七个 HTML 入口（`index.html` 首页 + `arena.html`/`sectors.html`/`signal.html`/`games.html`/`leagues.html`/`novels.html`）全部在项目**根目录**，注册在 `vite.config.js` 的 `build.rollupOptions.input` 里，参与真正的压缩/哈希/公共 chunk 拆分（**不再是** `public/*.html` 原样拷贝的旧架构）。加新页只需把 HTML 放根目录、在 `vite.config.js` 加一行 input、在 `nav.js` 的 `SITE` 加一条——`leagues.html`（2026-07-04，V0）是这条流程第一次被完整走通并验证的实例，见下方 checklist。
- **JS 全部是 ES module**，按用途分三层目录：
  - `src/lib/` — 七页共享的基础库：`nav.js`（★ 唯一的 `SITE` 配置，见下）、`i18n.js`、`transition.js`、`page-turn.js`、`audio.js`、`clock.js`。
  - `src/pages/` — 各子页专属逻辑（`arena.js`/`arena-bg.js`/`games.js`/`leagues.js`）+ **每页一个入口文件**（`homeLibs.js`/`arenaEntry.js`/`sectorsLibs.js`/`signalLibs.js`/`gamesEntry.js`/`leaguesEntry.js`/`novelsLibs.js`），每个 HTML 只挂一个 `<script type="module" src="/src/pages/xxxEntry.js">`，入口文件内部用普通 `import` 按顺序声明该页真正依赖的库。
  - `src/scene/`、`src/ui/`、`src/data/` — 首页专属的 Three.js 场景 / Canvas HUD 绘制模块 / 静态文案数据（`content.js` 含首页 Top 10 持仓 `PICKS_ZH/EN`）。
  - `public/` 现在只放**真正静态**的资源：`page-turn.css`（6 个子页共享翻页箭头/字体/Labs 下拉样式）、各页数据 JSON、`assets/`、`favicon.svg`。
- **⚠️ 关键坑（加新共享脚本前必读）**：给同一页面挂多个独立的 `<script type="module" src="...">` 标签，Vite 8 的自动 chunk 合并/去重**不可靠**——构建不报错，但某个脚本的代码可能在某些页面的产物里静默消失。正确做法**永远是**每页一个显式 `import` 链的入口文件（上面 `xxxEntry.js`/`xxxLibs.js` 的由来），走 Rollup 常规 import 图打包路径。
- **导航与 Labs 下拉**：`src/lib/nav.js` 的 `SITE` 数组是唯一真源，渲染各页导航链接（`[data-afflatus-nav]` 占位）+ 循环推导 prev/next（写入 `body.dataset` 与翻页箭头 `href`）。给条目打 `group:'labs'` 会自动收进顶部 **Labs** 下拉菜单而不是顶层直链——目前 Games/Novels 是 labs 分组，未来季节性/实验性新页一律走这条路。下拉面板本身是 JS **portal 到 `<body>`**（`position:fixed` + 用 trigger 的 `getBoundingClientRect()` 定位，`z-index:99000`），不嵌套在触发按钮内——嵌套会被部分页面的 `clip-path`/低 `z-index` 祖先裁剪或遮挡。开关状态由 JS 的 `.open` class 驱动（hover/focus/click 开，Escape/outside-click/scroll/resize 关），而非纯 CSS `:hover`。下拉面板的字体/配色需要每页在 `page-turn.css`（5 个子页）或 `src/styles.css`（首页）里用 `--labs-*` CSS 变量按各自主题显式覆盖——面板不再是触发按钮的 DOM 后代，不会自动继承该页 `.nav a` 的样式。
- **战斗视图**：默认 HUD 是 HMD v3（`src/ui/combatHmdV3.js` 的 `drawCleanCombatHmd`，贯穿起飞/降落/巡航/战斗）；SC 风格全息面板（`src/scene/combatHudSC.js`）与俯视战场（`src/scene/topdownCombat.js`）都降级为可选皮肤，分别用 `?combatview=sc` / `?combatview=topdown` 访问。**注意命名冲突**：`src/scene/cameraDirector.js` 这个文件名是起飞/降落的外部运镜（`drawExternalLaunch`/`drawExternalLanding`），与下面 V14 的武器事件相机状态机 `weaponCameraDirector.js` 是两个不同文件，不要混淆。
- **相机导演系统（V14，2026-07-04，v1 切片）**：`src/combat/cameraMath.js`（纯函数：`smoothDamp`/`shouldPreempt`/`blendFactor`/`easeBlend`）+ `src/combat/weaponCameraDirector.js`（镜头状态机，`requestShot(id,{durationMs,blendInMs,refresh})`，高优先级立即抢占/同低优先级等到期，`refresh:true` 给高频事件续期不重启）。`topdownCombat.js` 内部委托它驱动相机，opt-in `?combatcam=director`——不带这个 flag 时行为与改动前字节级相同（仍是原硬编码摇摄，改名为 `tacticalTopdown` 镜头）。镜头库 v1 切片：`tacticalTopdown`/`bridgeWide`/`mainGunAxis`/`missileTail`/`ciwsTurret`，`impactOrbit` 与「空间深度四件套」视觉 polish 明确未做，见 ROADMAP §4 V14 条目下的范围边界说明。
- **Odin 参考舰体重建（V15/V15b，2026-07-04，v1 切片）**：`src/scene/odinHull.js`——**DOM/WebGL 完全无关的纯函数**（`createOdinHull(THREE,{add,mats,detail})`，只调用注入的 `add(geo,mat,t,r,s)` 回调，不自建 THREE.Group/材质/贴图），因此可以被 `capitalShip3D.js`（PBR 实体网格）与 `shipHologram.js`（网格+描边线框）两种渲染风格共用同一份几何，也因此是这批 3D 视觉工作里唯一能在沙盒里跑 `tests/odinHull.test.js` 头less 验证比例（长高比/艏占比/挂载点数量）的一层。两个消费文件都走 **opt-in `?ship=odin`**——这是本项目至今风险最高的可视化改动（直接换主战舰几何），沙盒完全无法渲染验证（`npm install puppeteer` 因网络白名单不含 `storage.googleapis.com` 失败），所以默认（无 flag）行为字节级不变，新舰体仅预览可见，范围边界见 ROADMAP §4 V15 条目。`src/scene/nighthawk.js` 做了 V15b 法线贴图升级（`heightToNormalMap()`，Sobel 梯度编码，取代原 bumpMap 近似）+ 增加非轮廓 greeble，零几何改动、默认生效（风险远低于 V15，可放行）。**2026-07-04 第四轮**（按用户详细文字拆解补齐参考图的 5 类细节缺口）：新增艏-舯衔接处交叠装甲收环板（层叠装甲视觉断点）、舯部两侧模块化舱段 `sideBayMounts`（8 个，每侧 4，导弹发射井/机库观感）、两侧点防御炮塔 `lateralTurretMounts`（4 个，每侧 2）、背脊炮塔改双联装、推进器加装甲整流罩——全部是挂载在既有连续 loft 壳体上的离散配件，不改船体轮廓，风险同炮塔/桅杆/吊舱那档。单测 94→97。
- **数据**：`public/arena-news.json`（每日定时任务生成）、`public/games-data.json`（手动更新）、`public/signal-events.json`（宏观事件档案，见第 3 节）、`public/novels-data.json`（章节内容）、`public/leagues-data.json`（**已创建，2026-07-04**，MSI 竞猜）、`public/arena-ledger.json` + `public/arena-universe.json`（**已创建，2026-07-04**，Autopilot 账本 + 固定交易域，见下方 V3 说明）。v1.5 规划新增但**尚未创建**：`sectors-data.json`（对比矩阵 + 后内存专题）——详见 ROADMAP §7。
- **Arena Autopilot 规则引擎（V3，2026-07-04）**：`src/lib/arenaRules.js`——纯函数集合，模型只提案 JSON 订单，这里的 `validateOrder`/`applyFill`/`checkStopLoss`/`checkDailyCircuitBreaker`/`checkSeasonReset`/`computeMetrics` 才是唯一有权改账本状态的代码。硬风控红线（单仓 20%/持仓 8 只/现金 5%/日熔断 3%/赛季重置 20%/信心门槛 0.65/Model A 周换手 20 笔/Model B 仅周二四开仓/分级滑点）全部是模块顶部 `LIMITS` 常量，不是提示词里的口头约定。单测见 `tests/arenaRules.test.js`。
- **武器单时钟（V16，2026-07-04）**：`src/combat/weaponClock.js`——权威时间线纯函数模块（`startTimeline`/`phaseFraction`/`activePhase`/`msUntilPhase`/`forceAdvance`），`{weapon, t0, phases:[{name,at}]}` 结构，V14 相机导演可直接订阅。已修正 `main.js` 里两处实测确认的独立计时器（核弹 T- 倒计时、主炮蓄力倒计时此前各自跑 `setInterval(...,40)`，与 rAF 主循环脱钩——已改为在 `updateCombatModule()` 里逐帧更新）+ 删除 `halley.ciwsLaserStart/ciwsLaserUntil` 死代码（从未被读取、`performance.now()` 口径与全局 `Date.now()` 口径不一致）。**范围边界**：`combatCine.js` 的导弹/核弹分镜与 `halley.destroyed` 提前触发的强制剪切审计后确认本来就是从 `pilotView.started/until` 派生的单一 `e` 驱动，未改动；CIWS/核弹/导弹完整分镜时序改造为具名 `weaponClock` phases 留给 V14（相机切换点本来就需要具名 phases，届时一起做）。

### 新增页面 checklist（已由 V0 Leagues 完整走通并验证，2026-07-04）

1. `newpage.html` 放**项目根目录**（不是 `public/`）。
2. `vite.config.js` → `build.rollupOptions.input` 加一行。
3. 建 `src/pages/newpageEntry.js` 入口：按需 `import` `../lib/i18n.js`、`../lib/nav.js`、`../lib/audio.js`、`../lib/transition.js`、`../lib/page-turn.js`（顺序照抄现有 entry，**nav 必须在 page-turn 之前**）；HTML 只挂这一个 `<script type="module">`。
4. `src/lib/nav.js` → `SITE` 数组插入条目（插入位置 = 翻页循环顺序；季节页打 `group:'labs'`）。
5. `<body class="newpage-page" data-prev data-next>`（值会被 nav.js 覆写，但**建议仍然填对**，避免 no-JS/JS 尚未跑完前的一瞬间指向错误页——加 leagues.html 时顺手修正了 games.html/novels.html 的旧占位值）+ `<nav class="nav" data-afflatus-nav>` + 翻页箭头结构照抄 games.html。
6. `public/page-turn.css`：加 `.newpage-page .page-turn-controls` 箭头配色变量 + `.newpage-page .nav-labs__menu`/`a` 的 `--labs-*` 主题覆盖（下拉面板不继承页面样式，不配就是默认黑玻璃）。
7. 文案全部 `data-en`/`data-zh` 成对 + 页脚免责声明。
8. `npm run build` 后抽查 `dist/`：新页 HTML 200、其引用的 chunk 里确实含 nav 代码（防上面那个 chunking 坑）。**实测发现**：`nav.js`/`i18n.js`/`transition.js`/`page-turn.js` 这类被全部页面共享导入的库，Rollup 会把它们合并进一个共享 chunk（本次构建里合并进了 `transition-*.js`，命名取决于打包顺序不固定）——不要假设某个库一定在"自己名字" 的 chunk 里，**用内容 grep（如 SITE 数组里的新页面路径字符串）而不是按文件名 grep** 来验证代码是否真的在产物里。

### 首页渲染分层 / Home render layers
- `#starfield`（背景星空，fixed z0，OffscreenCanvas + Worker 渲染，特性检测自动回退主线程）→ `#blackhole-gl`（黑洞 WebGL，z1）→ `#event-layer`（2D 战斗/彗星，z2）。
- `.stardrive` 段（年化收益）自带一块 `#alphardForge` canvas，以顶/底渐隐 + `--bg` 调色融入页面背景；滚动进度写入 CSS 变量 `--forge`，驱动星体放大、台词逐字、数字点亮。

### 文件清单 / File map
```
index.html arena.html sectors.html    七个 Vite 入口（根目录）
signal.html games.html leagues.html
novels.html
src/main.js (~3.4k 行)   首页主程序（HUD/场景/光标/导航装配，仍是拆分中的单体文件）
src/scene/               首页 + 战斗场景模块（alphardForge / topdownCombat / combatHudSC /
                         combatCine / cameraDirector[起降运镜] / fighter3D / shipHologram / …）
src/combat/              权威时间线 + 相机导演：weaponClock.js / cameraMath.js /
                         weaponCameraDirector.js（V16/V14，均为可脱离 DOM 单测的纯逻辑层）
src/scene/odinHull.js    Odin 参考舰体共享几何布局（V15，同样可脱离 DOM 单测，见上）
src/ui/                  HUD 绘制模块（combatHmdV3 / battleFeed / marketDeck / viz 等）
src/data/content.js      首页文案 + Top 10 持仓 PICKS_ZH/EN
src/lib/                 七页共享库：nav.js（★ SITE 唯一真源）/ i18n.js / transition.js /
                         page-turn.js / audio.js / clock.js
src/pages/               各页专属逻辑 + 每页一个入口文件（见上方架构说明）
public/page-turn.css     6 个子页共享：翻页箭头 + 自托管字体 + Labs 下拉结构样式
public/*-data.json       games-data.json / signal-events.json / novels-data.json /
                         arena-news.json / leagues-data.json
scripts/push-arena-news.sh  cron 数据推送管线（写 JSON → stash/rebase/commit/push）
prompts/                 v1.5 定时任务提示词库（README + 5 模块文件）
roadmap.md technical.md  仅有的两份设计文档（另见 CLAUDE.md、prompts/，机器向）
```

---

## 2. 数据与接口 / Data & APIs

- **Finnhub**（实时报价，免费档 ~60/min）：前端调 **`/api/quote?symbol=…`**（Vercel Serverless 代理 `api/quote.js`），key 在服务端 `FINNHUB_KEY`。自适应轮询。
- **Twelve Data**（历史 K 线 W/M/6M/Y/5Y，免费 8/min·800/day）：前端调 **`/api/history?symbol=…&interval=…&outputsize=…`**（代理 `api/history.js`），key 在服务端 `TWELVE_KEY`；按需取、按天缓存到 localStorage。`D` 为实时日内。
- ✅ **API key 已下沉到服务端**：`/api/*.js` 是 Vercel 根目录 Serverless 函数（与 Vite 静态构建并存，零配置自动部署），key 不再出现在前端包里。
  - **部署必做**：Vercel → Project → Settings → Environment Variables 添加 `FINNHUB_KEY` 与 `TWELVE_KEY`（值即原来的 key），重新部署。
  - **⚠️ 务必轮换旧 key**：旧 key 曾明文存在于前端与 git 历史，已泄露——去 Finnhub / Twelve Data 后台**重置生成新 key**，新 key 只填进 Vercel 环境变量。
  - 本地 `npm run dev`（纯 Vite）不跑 `/api`，实时行情会 404 并**自动降级到简报快照**（`arena-news.json` 的 `prices`），属预期；线上 Vercel 才有实时。
- **定时任务**：每个工作日美东开盘前约 1 小时（墨尔本约 22:30）跑一次，搜索当日 AI 相关新闻 + 我的个股预测，写入 `public/arena-news.json`（中英双语 + `aiPredictions`）。
- **定时脚本的 key 管理（历史教训，红线）**：`scripts/` 目录已进 git 跟踪——**任何脚本不允许出现明文 API key**。需要 key 的脚本统一 `source ~/.config/afflatus/env`（仓库外）；能走线上代理（`/api/quote` 等）的一律走代理。旧 key 泄露过一次（见下），同样的错误不能犯第二次。

### 导航闭环 / Nav cycle
`Home → Arena → Sectors → Signal → Games → Novels → Home`（Games/Novels 在顶部导航里收在 **Labs** 下拉，翻页顺序不受影响，仍按此顺序循环）。加新页只改 `src/lib/nav.js` 的 `SITE` 数组一处——prev/next、顶部链接/下拉分组会自动同步，不用像以前那样手改多个文件。未来 `leagues.html` 上线后会插在 games 与 novels 之间，同样打 `group:'labs'`。

---

## 3. 日常更新 / Updating content

- **每日盘前简报 + 个股预测**：由定时任务自动写 `arena-news.json`（也可手动编辑）。结构：`items[]`（`title_en/zh`、`summary_en/zh`、`category`、`source`、`url`）+ `aiPredictions{符号:{direction,confidence,rationale_en/zh}}`。字段名仍叫 `opus`/`opusScore`/`opusOrder` 等（内部命名未改），但**显示文案**已统一为「Fable 5」，改数据时不用管字段名，只管填对应文案字段。
- **世界杯**：编辑 `public/games-data.json`。
  - 补赛果：把对应 fixture 的 `"result": null` 改成 `"home"|"draw"|"away"`，计分板自动结算。
  - 淘汰赛对阵确定后：把 TBD fixture 的 `home/away/homeFlag/awayFlag/opus/conf/reason_*` 填好。
  - 更新 `champions` / `players` 概率与 `updated` 日期。
- **Signal**：数据源是 `public/signal-events.json`（**不是**旧版内嵌在 `signal.html` 里的 `FOMC[]` 数组，那个写法已淘汰）——新增/编辑事件档案直接在这个 JSON 里追加/修改一条记录，结构见文件内现有条目（`id`/`date`/`type`/`class`/`name`/`before`/… 四段式 + 中英对照）。
- **首页 Top 10 持仓**：`src/data/content.js` 的 `PICKS_ZH`/`PICKS_EN`，两个数组必须逐条一一对应（ticker 顺序、权重都要一致），权重合计应为 100。这是编译期数据，改完要走一次 build 才会生效，不是运行时读取。
- **Novels 章节**：`public/novels-data.json`。
- 改完务必本地 `npm run dev` 自查，再提交。

---

## 4. v1.5 数据管线与提示词库 / Data pipeline & prompts (v1.5)

> 完整模块规格见 **roadmap.md §7**；这里只记工程约定。

- **推送模式**：`scripts/push-arena-news.sh` 是现成的参考实现（**2026-07-04 修复版**）——触发 → 写目标 JSON → `git add` → **先 commit** → `git pull --rebase --autostash origin main` → `git push`。⚠️ 旧版的「`stash --keep-index` → rebase」组合**从未生效**（rebase 拒绝在暂存区有内容时运行，日志每次都报 `cannot rebase`，只因本地恰好从未落后于远端才没出事）；且旧版 `git add dist/arena-news.json` 被 `.gitignore` 的 `dist` 规则挡掉、一直是无效操作（`cp` 到 dist/ 保留，仅为本地 preview 一致性）。规划中的 `arena-ledger.json`/`leagues-data.json`/`sectors-data.json` 定时任务照修复版模式写（V12 计划模板化成通用 `push-data.sh <file> <msg>`）。
- **调度器用 launchd 而非 crontab**（macOS）：cron 在合盖睡眠期间错过的任务直接跳过；launchd 的 `StartCalendarInterval` 在唤醒后会补跑一次。操作：`~/Library/LaunchAgents/au.feida.<task>.plist`（`ProgramArguments` 指向脚本、`StartCalendarInterval` 定时间）→ `launchctl load ~/Library/LaunchAgents/au.feida.<task>.plist`；改 plist 后先 `unload` 再 `load`。现有 crontab 条目迁移完就清掉，别双跑。
- **日志不进版本库**：`scripts/*.log` 已加入 `.gitignore`；脚本本体（无密钥）进 git 跟踪，自动化本身也要有版本历史。
- **所有数据 JSON 顶层统一带 `{updated, version}`**，前端据此显示"数据龄"徽标（V12 起扩展为统一溯源徽章，见 roadmap.md）。
- **提示词库** `prompts/`：README 定五条硬规则（system/run 拆分吃 prompt caching、强制 JSON schema 输出、模型零会话记忆/状态外置、只认 payload 注入数据禁止凭训练记忆报事实、复盘限长）；`arena-autopilot.md`/`signal-warsh.md`/`sectors-watch.md`/`postmemory-top10.md`/`leagues-msi.md` 是五个模块各自的正式提示词文本（含 System Prompt 英文正本 + run payload 结构 + 中文对照）。新增任何定时任务前先读对应文件，不要另起炉灶。
- **⚠️ Leagues 定时任务是个例外，未走 launchd**（2026-07-04）：`leagues-msi-daily` 用的是 Cowork 自带的 scheduled-tasks（每日 23:30 本地时间，提示词内联了 `prompts/leagues-msi.md` 的纪律 + WebSearch 指令），理由是这条自动化只活到 7/12、且每次都要联网检索赛况而非纯 API 调用，用 Cowork 会话原生工具比现写本地脚本 + API key 更省事。**限制**：Cowork 定时任务需要 App 处于打开状态才会触发（关闭时错过的任务下次启动补跑，语义上类似 launchd 但触发条件是 App 而非系统唤醒）。若未来要把它并入 launchd 统一管线（V12），需要另写一个调用外部 LLM API 的脚本 + `~/.config/afflatus/env` 里的 key。

---

## 5. 本地预览 & 构建 / Dev & build
```bash
cd ~/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in
npm install        # 仅首次
npm run dev        # http://127.0.0.1:5173  （逐页检查）
npm run build      # 产出 dist/（七个入口各自压缩打包，public/ 静态资源原样拷贝进去）
npm run preview    # 预览打包结果
```
> **测试（已引入，2026-07-04，V3 起）**：`npm run test`（`vitest run`，Vite 原生零配置）现跑五个文件共 94 条：`tests/arenaRules.test.js`（44 条，Arena 规则引擎）+ `tests/weaponClock.test.js`（20 条，武器单时钟，含"两消费者同时刻读同一时间线必须逐帧零差异"的 V16 验收断言）+ `tests/cameraMath.test.js`（12 条，V14 临界阻尼弹簧/抢占规则/混合曲线）+ `tests/weaponCameraDirector.test.js`（6 条，V14 镜头状态机，用 mock 相机对象验证抢占/续期/自动回落/数值不发散，不依赖 WebGL）+ `tests/odinHull.test.js`（8 条，V15 舰体比例：长高比/艏占比/挂载点数量/wire 少于 full/无 NaN，用 mock `add()` 记录 mesh 算真实 `THREE.Box3`，不依赖 WebGL/DOM）。所有模块都刻意不依赖 DOM/fetch/`Date.now()` 默认值——调用方显式传入 `now`/`t`，保证可在 Node 定时任务、单测与浏览器三侧复用同一份逻辑。账本类代码不写测试不许上线，新增前先跑一遍确认没破坏现有分支。

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
