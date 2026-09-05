# Project Afflatus · M00–M02 首轮实施记录

日期：2026-09-05。范围：全站路由与动效所有权盘点；实现集中在 Portfolio 的阅读、指标和导航，以及它暴露出的共享协调器缺陷。未实施 M03–M16，也没有增加粒子、游标、转场或另一套预算系统。

本轮依照 [Astra 设计手册](astra-motion-design.md)、根目录 design.md、tech.md、CLAUDE.md 执行。检查了工作树与父目录，未发现适用的 AGENTS.md。开始时存在的 design.md 改动、设计手册、43 张调研图及设计 ZIP 均保留。下列实现是本站选择，不代表 OpenAI 源站算法。

## 可查看预览

- [EN Portfolio](http://127.0.0.1:4176/en/portfolio.html)
- [ZH Portfolio](http://127.0.0.1:4176/zh/portfolio.html)
- [核心指标](http://127.0.0.1:4176/en/portfolio.html#fy2026Performance)
- [资产图鉴](http://127.0.0.1:4176/en/portfolio.html#portfolioConvoy)

这是本机生产构建预览，产物位于 `/tmp/afflatus-astra-phase1`；需要预览进程仍在运行。Vite 开发服务另在 5173。没有部署、推送或更改生产数据。

## 当前路由清单

依据 `src/config/siteManifest.js` → `vite.config.js` 的 BUILD_ROUTES，以及 `src/config/navRoutes.generated.js` / `src/lib/nav.js`。机器可读清单：[astra-phase1-routes.json](astra-phase1-routes.json)。

| 分类 | 源文件 / 基础路由 | 语言与处理 |
| --- | --- | --- |
| active | index.html → `/` | EN/ZH；新首页是局部 React，不是 Portfolio 入口 |
| active | portfolio.html → `/portfolio.html` | EN/ZH；本轮实现目标 |
| active | arena.html → `/arena.html` | EN/ZH |
| active | sectors.html → `/sectors.html` | EN/ZH |
| active | signal.html → `/signal.html` | EN/ZH |
| active | horoscope.html → `/horoscope.html` | EN/ZH |
| active | serial.html → `/serial.html` | 默认中文；固定发布语言仅 ZH |
| active | course.html → `/course.html` | EN/ZH |
| prototype | boot.html → `/boot.html` | 构建但不进 sitemap；不再由 Portfolio 的 active 菜单额外插入 |
| system | public/404.html → `/404.html` | 静态系统文件、非 Vite HTML 入口 |
| 历史残留 | games.html、league.html | 非 active，未复活；未新增入口 |
| 历史产物 | dist_* | 未作为源代码或构建输入 |

8 个 active 源文档生成 15 个固定语言文档（7×2 + 小说书架 ZH）。基础 adaptive 文档继续存在。小说 EN 路径依现有 vercel.json 跳转中文，不创建英文正文。

### 小说：本地输入不等于发布许可

`serialRoutes.js` 的模板为 `/zh/novels/{bookId}/{chapterId}/`，基础兼容路径为 `/novels/{bookId}/{chapterId}/`，书籍目录省略 chapterId。`localize-site.mjs` 当前按 catalog 中的 chapters 遍历，并没有独立的发布允许清单。

| 书 ID | 本地 JSON 中的章节 ID | 已公开证据 / 本轮处理 |
| --- | --- | --- |
| wanjie-zhongchun | 1–15 | 调研已访问中文第 1 章深链接；本地 15 章不自动视为本轮获准新增的公开路由 |
| changye-qingjian | 1–10 | 本地目录清单；本轮没有重新逐章确认线上发布状态 |
| yuxi-gongci | 1–200 | 前轮浏览记录显示 3 章已发布、197 章保留；不能用 200 条输入覆盖该边界 |

本轮再次通过网页检索读取线上书架失败（cache miss），因此不把本地清单冒充完整线上发布清单。没有改小说 JSON、索引、正文、路由生成逻辑或 redirects；临时预览只调用现有文档本地化函数处理 active 页面，**没有调用 generateNovelDocuments**。临时构建仍包含 Vite 原样复制的 public 文件，它不应被作为可部署发布包。

## M00 · 动效所有权

| 页面 / 表面 | 实际 owner | 启停、观察与释放；本轮结论 |
| --- | --- | --- |
| 首页 | src/showcase/App.jsx | React effect 管理 pointer 监听、Canvas 周期图和 ResizeObserver；effect cleanup 解绑。未改首页渲染 |
| Portfolio 主循环 / 雷达 / HUD | src/homeExperience.js | `home:master` 负责一个 rAF；现改为显式 Command + hero 可见才运行，仍由现有 coordinator 管理 pagehide/hidden/resume |
| Portfolio 星空 | src/scene/backgroundScene.js、backgroundScene.worker.js | Worker / Canvas2D 二选一；修复公开 pause/resume 绕过预算状态的问题；与 hero 可见性绑定，阅读暂停 |
| Portfolio 黑洞 | public/vendor/black-hole/ + main.js 加载门 | 保留 poster；本轮不再启动该 iframe，避免与指挥星空、星门和图鉴叠加运行。未修改 vendor 算法 |
| Portfolio 星门 | src/scene/alphardForge.js | 已有 coordinator + webglLifecycle；改为观察实际 stage，减少动态时稳定终态。保持 Three 场景与上下文回退 |
| Portfolio 数字 | src/ui/homeScrollTelemetry.js | 原先把真实值写成 0，再排定时器/rAF。现只标记静态状态，不重写数字，不依赖观察器读取真实结果 |
| Portfolio 图鉴 / K 线 | src/ui/marketDeck.js、portfolioSolarSystem.js | 已有 IO、pin rAF、chart surface、solar surface、WebGL 生命周期；保留 DOM 列表和卡片。未新增图表算法；K 图只在对应 Canvas 存在时挂载 |
| Portfolio 鼠标视差 | homeExperience.js / home:hero-parallax | 复用原来的自停 rAF；普通阅读和减少动态不响应文本视差 |
| Arena | src/pages/arena-bg.js、arenaQuant.js | 背景为预算内按 resize 绘制；图表 RO 重绘。未改数据读取和图表控制 |
| Sectors | src/sectors/graphController.js、storyController.js、competitionController.js 及其 renderer | controller 持有图形；createExclusiveRenderer 管理 2D/3D 切换，原 Worker / scroll / lifecycle 保留，未重写 |
| Signal | signal.html + signalLibs.js | 章节和 reveal 使用 IO，RM 有直接呈现分支；未增加滚动循环 |
| Horoscope | src/pages/horoscope.js | latestWorkerTask 管理计算 Worker；结果的有限 rAF 与 IO；表单、计算和来源未改 |
| 小说 | serial.html、src/lib/pagedBook.js | 正文分页、工具条 RO、进度 rAF、章节 IO、显式自动阅读由原阅读器所有；正文与进度未改 |
| Course | src/pages/course.js | passive scroll+rAF 合并、RO、地图 IO；物理循环检查 hidden / inView，进度仍由原模块管理 |
| 全站 | renderBudgetCoordinator、webglLifecycle、viz、nav、i18n、transition | 沿用全部 owner；没有引入新的调度、转场、游标或依赖 |

**修复的共享缺陷**：同一 DOM 元素被多个 surface 观察时，旧 WeakMap 只保留一个 ID，后注册者覆盖前者。现保存 ID 集合，向各注册者分发可见性；晚注册者继承当前可见性；最后一个观察者释放时才 unobserve。新增单测覆盖共同暂停、晚注册、独立释放、恢复。

阅读 → Command：按原按钮进入，记录滚动位置和焦点；Command → 阅读：按钮或 Esc 退出，清理战斗状态并恢复位置、焦点。隐藏页、离屏和冻结状态仍交给原协调器。BFCache 验证是合成 persisted pagehide/pageshow，不等同真实浏览器缓存命中。

## M01 · 完整读数与安静阅读区

- Hero 正文 16px、字重 500、稳定深底，保留 Rajdhani / Orbitron / JetBrains Mono 身份。
- core telemetry 的数值与 `.core-telemetry-note` 分离；修复现有 CSS 错把说明当成大号数值的样式缺口；方法说明 13px，正常换行，窄屏单列。
- 指标条移到 clipped stage 外的普通文流；不再依靠 `--forge` 的透明度才能看到数值。卡片高度由内容决定，列宽根据可用空间重排。
- 为避免正常文流指标又被 sticky stage 覆盖，当前阅读星门改为相对定位的有限高度视口。没有实现新的滚动镜头编排；后续 M05 可以在此基础上设计并验收。
- 图鉴论点 16px、风险与催化说明 13px；公司名称不再省略；来源/日期/免责声明保留。金融数值、符号、精度和模型口径未改。
- 未增加整页 overflow:hidden；原有历史横向裁切规则仍存在，未借它掩盖核心标签问题。

实测 4 类正文/指标 selector 的祖先合成 opacity 均为 1。所选实色组合计算对比度为 16.80、13.60、11.59、11.30；这只代表这些已检查阅读区，不代表整个网站已通过 AA。[实际计算样式](astra-phase1-evidence/computed-readability.json) · [对比度计算](astra-phase1-evidence/contrast.json)。

## M02 · 导航与必要操作优先

- 原 HTML 第一 CTA 继续进入 FY 记录，Command 是次要入口；手机阅读状态不再占用一个额外 Command 顶栏按钮，Hero 仍可进入。
- 用原生 details/summary 承载“Menu / 菜单”，键盘操作及无 JS 展开均可用；增强后使用现有 NAV_ROUTES 与 localeStore，菜单只含 8 个 active 路由。
- 语言按钮在桌面、手机均可见；隐藏重复的完整语言按钮和时钟。保留语言 URL 的 query/hash，小说入口固定中文发布路径。
- 阅读状态使用系统游标，不显示持续 cruise telemetry；不增加另一套 HUD mode controller。
- 可点击入口使用至少 44px 的目标区，高对比 focus outline；Esc 关闭菜单并还原焦点。

## 变更文件

| 文件 | 对应改变 |
| --- | --- |
| portfolio.html | 原生菜单、保留初始 HUD inert、指标 DOM 移出裁切舞台 |
| src/main.js | 移除空闲/悬停自动启动、保留显式意图加载；菜单复用 manifest/locale；加载失败反馈 |
| src/homeExperience.js | Command 与阅读焦点/位置恢复、预算启停、阅读禁用文字视差 |
| src/lib/renderBudgetCoordinator.js | 同元素多个 surface 的共享观察修复 |
| src/scene/backgroundScene.js | Worker 的公开启停通过 coordinator；可见性归属 |
| src/scene/alphardForge.js | 实际 stage 的可见性与动态减少动效终态 |
| src/ui/homeScrollTelemetry.js | 保留真实终值，去掉伪零与计数定时器 |
| src/styles.css | 撤销根级 cursor:none!important、移除 strip 说明省略 |
| src/home-visual-upgrade.css | Hero 正文、CTA、菜单和阅读游标样式 |
| src/performance-dossier.css | 指标说明、自然高度、阅读底色和自适应布局 |
| src/portfolio-convoy.css | 图鉴正文与方法/风险标签可读性 |
| src/cic-hud.css | 在实际无 layer 的 owner 中收起 cruise strip |
| tests/renderBudgetCoordinator.test.js | 共享观察者生命周期回归 |
| tests/homePresentationContract.test.js | 删除已过时的“必须按滚动从零计数”源码字符串契约，改由浏览器真实数值测试覆盖 |
| e2e/astra-reading.spec.js | 6 项阅读、导航、失败、模式和生命周期测试 |
| docs/astra-phase1-* | 本记录、路由清单和截图证据 |

根目录 design.md 的差异来自前一轮链接整理，本轮没有覆盖它。没有改 package.json、lockfile、业务数据、小说或课程状态。

## 前后截图

Before 为修改前本地源页截图，After 为当前 EN 固定语言构建；固定语言构建使用既有文案映射，因此部分 CTA 的字面表达可能不同。分辨率一致，可比较排版与覆盖关系；不是截图像素差值测试。

| 场景 | 修改前 | 修改后 |
| --- | --- | --- |
| 桌面 Hero | [1280 before](astra-phase1-evidence/before-1280-hero.png) | [1280 after](astra-phase1-evidence/after-1280-hero.png) |
| 手机 Hero | [390 before](astra-phase1-evidence/before-390-hero.png) | [390 after](astra-phase1-evidence/after-390-hero.png) |
| 桌面数据入口 | [1280 before](astra-phase1-evidence/before-1280-data.png) | [1280 after](astra-phase1-evidence/after-1280-data.png) |
| 手机数据入口 | [390 before](astra-phase1-evidence/before-390-data.png) | [390 after](astra-phase1-evidence/after-390-data.png) |

完整说明：[桌面 core](astra-phase1-evidence/after-1280-labels.png)、[手机 core](astra-phase1-evidence/after-390-labels.png)、[桌面 strip](astra-phase1-evidence/after-1280-strip.png)、[手机 strip](astra-phase1-evidence/after-390-strip.png)、[图鉴卡片](astra-phase1-evidence/after-1280-solar-card.png)、[手机菜单](astra-phase1-evidence/after-390-menu.png)、[WebKit 中文](astra-phase1-evidence/after-390-webkit-zh.png)、[200% CSS zoom](astra-phase1-evidence/after-200percent-zoom.png)。

## 已运行检查与限制

- `npm run prebuild`：数据、manifest、header、CSS、combat asset、双语、OG 门禁通过。
- `npm run typecheck`：通过。
- 7 个相关 Vitest 文件，56 项测试通过：renderBudgetCoordinator、renderBudget、webglLifecycle、homePerformanceDossier、homePresentationContract、siteManifest、localeStore。
- Vite 生产构建通过；8 个 active 源页和 15 个固定语言页通过现有本地化函数生成。没有执行默认完整 build 的小说生成步骤，因此也没有宣称完整 emitted SEO / 小说产物门禁通过。
- 新增 Chromium E2E 6/6 通过：真实数值与标签重排、键盘菜单/语言 URL、无 JS 中文导航、分块导入失败、Command 进入/退出/离屏/冻结恢复、WebGL 不可用时的 DOM 图鉴。
- 宽度 320/390/768/1280；640px reflow 以及 200% CSS zoom 检查，核心说明未裁切。CSS zoom 的顶栏不会像浏览器菜单缩放一样改变 media-query viewport，本轮未宣称该模式下整页顶栏已完成验收。
- WebKit 390px 中文人工截图检查通过；不是完整 WebKit E2E 套件或真实 iPhone/Safari 验收。
- `git diff --check` 通过。保留现有大于 500KB 的 Three vendor chunk 构建提示，未为消除提示重构依赖。
- 离屏通过真实 wheel 驱动验证；冻结恢复采用合成事件，真实 BFCache 命中、真机触屏拖动/软键盘、GPU 热负载、屏幕阅读器朗读、真实 WebGL context loss 的视觉恢复未完整验收。context loss 生命周期已有单测通过，本轮浏览器测的是 WebGL 初始化失败。
- 各 active 页做了所有权盘点；除 Portfolio 和共享协调器外，没有全面改造或逐页重跑全部交互流程，不把这次结果冒充全站动效认证。

复跑新增浏览器测试时，主 baseURL 应指向上述本地化构建；设置 `ASTRA_DEV_URL=http://127.0.0.1:5173` 才运行协调器内部观测那一项。它通过实际加载的 Vite 模块 URL 获取现有单例，不新增生产调试 API。未设置该环境变量时该项明确跳过。
