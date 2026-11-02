# Afflatus 站点代码库审计：新增重动效实验页的真实约束

> 本地只读审计（2026-11-02，仓库 HEAD `2205c0a`）。所有引用格式为 `文件:行号`。未运行 build / 测试，结论来自源码阅读。

## 1. 技术栈与构建管线：新页面要通过 `npm run prebuild` 需要什么？

### Takeaway
站点是 Vite 8 MPA（根目录 `*.html` 即入口），运行时为 vanilla ES modules + 局部 Preact（以 `react` 别名引入）。`prebuild` 串了 8 道门禁，几乎全部由 `src/config/siteManifest.js` 这一个清单驱动；新页面的核心工作是"在清单里登记 + 跑 `npm run site:generate` 让生成物同步"。

### Cited Findings
- 依赖：`preact 11.0.1`、`react/react-dom ^19.2.0`（经别名指向 `preact/compat`）、`@phosphor-icons/react`、`astronomy-engine`、`web-vitals`；dev 侧有 `@playwright/test`、`@axe-core/playwright`、`@lhci/cli`、`sharp`、`parse5`、`vite ^8.0.14`、`vitest` — `package.json:50-71`；react→preact 别名见 `vite.config.js:44-53`。
- `prebuild` = `subset-cjk-fonts` → `generate-course-pages` → `data:check` → `site:check` → `header:check` → `css:check` → `lint:i18n` → `og:check` → `build-sectors-observatory --check` — `package.json:8`。
- `build` = `vite build` → `localize-site`（产出 `/en/`、`/zh/` 固定语言文档）→ `prerender-apps`（只预渲染 home 与 arena）→ `optimize-static-output`（把本地 CSS 内联进 HTML）→ `validate-emitted-seo` — `package.json:9`、`scripts/prerender-apps.mjs:10`、`scripts/optimize-static-output.mjs:1-2`。
- CI 另跑 `npm test`、`typecheck`、`check-bundle-budget.mjs`、Playwright 三端矩阵、`lighthouse:ci` — `.github/workflows/ci.yml:36-148`。
- Vite 入口由 `BUILD_ROUTES` 生成；`responsive-primitives.css` 与 `data-bridge.js` 在生产 HTML 中被内联 — `vite.config.js:8-10,68-81,101`。
- **site:check 逐条要求**（`scripts/site-manifest.mjs:252-338`）：路由文件存在；`<title>`/`theme-color`/`description`/`canonical`/`og:title|description|image` 与清单逐字相等；viewport 含 `viewport-fit=cover`；`/styles/responsive-primitives.css` 恰好引用一次；active 路由必须有 `<h1>`、JSON-LD 通过校验、`/src/entry/performance.js` 恰好一次；build 路由 `/src/entry/viewport.js` 恰好一次；非 prototype 的 build 路由（main/serial 除外）必须含**字节相同**的 `afflatus:locale:v1` 同步预绘脚本；`<!-- afflatus:route-seo:start/end -->` 块必须与清单一致（否则提示 `npm run site:generate`，`:358`）；`public/sitemap.xml`、`src/config/navRoutes.generated.js`、`performanceRoutes.generated.js`、`lighthouseRoutes.generated.json` 必须是最新生成物（`:404-408`）。
- **header:check**（`scripts/audit-header.mjs:8-21`）：每个 build 路由 + `public/404.html` 必须恰有一个 `data-afflatus-header`，且源码含 `renderSharedHeader()` 的完整输出（夹在 `<!-- shared-header:start -->`/`end` 之间，`scripts/shared-header.mjs:5-8`）；必须引用 `/styles/shared-header.css`；出现 `data-afflatus-nav` 或 `data-brand-persona` 即判为"competing legacy header"失败（`:14`）。`--write` 模式会自动在 `<body>` 后插入 header 并补 CSS link（`shared-header.mjs:10-16`）。
- **css:check** 是 `!important` 棘轮：只统计固定文件列表（`premiere.css`、`responsive-primitives.css`、`afflatus-brand.css` 等），超出基线即失败 — `scripts/check-no-new-important.mjs:12-21`。新 CSS 文件默认不在列表中，但 design.md 验收清单要求"`!important` 零新增"（`design.md` §6.3）。
- **lint:i18n**（`scripts/lint-bilingual.mjs`）：扫描清单内全部 HTML（`:261`）、`src/**/*.{js,mjs,ts}`（`:264`）、`public/**/*.json`（`:267`）。HTML 上 `data-en`/`data-zh`、`data-en-ph`/`data-zh-ph`、`data-aria-en`/`data-aria-zh` 必须成对且过长度限制；**静态 `aria-label` 若无双语对且无 `data-i18n-static-aria`，报 `MISSING_ARIA_LOCALE_PAIR`**（`:94-104`）；JS 中任何含 `en`/`zh` 键的对象字面量都被校验，可用注释 `afflatus-i18n allow-monolingual` 放行（`:170`）。标签长度上限在 `src/lib/bilingualContent.js:27`（`UI_LABEL_LIMITS`）。
- **og:check**（`scripts/validate-og-assets.mjs`）：每个 active 路由 × `en`/`zh` 必须有 `public/assets/og/{id}-{locale}.jpg`，1200×630 JPEG、≤400,000 字节、URL 唯一、源自 `https://feida.au`（`SOCIAL_CARD` 见 `src/config/siteManifest.js:15-25`）；生成源 `assets/og-backgrounds/<id>.jpg` 必须存在且 ≥1200×630（`:128-150`）。生成用 `npm run og:generate`，依赖 Playwright Chromium，每路由有 `ACCENTS` 色（`scripts/generate-og-assets.mjs:4,19-29`）。
- 体积预算：`main` 250 KB、`vendor-astronomy` 60 KB，其余任意 chunk 默认 300 KB，超出 CI 失败 — `scripts/check-bundle-budget.mjs:22-26`。
- CJK 字体子集只从 sectors 相关文件抽字（`scripts/subset-cjk-fonts.mjs:8`）；源字体缺失时跳过。

### Inferences
- 新页面"最省事"的注册路径是 `status:'prototype'` + `capabilities:['noindex']` + `nav:null` + `sitemap:false`：可跳过预绘脚本与 Lighthouse 门禁（`site-manifest.mjs:328`、`:198-202`），但 header/i18n/OG(仅 active)/manifest 元数据检查仍然生效。
- 任何第三方动效库必须经 npm 打包进 `dist/assets`，不能 CDN：CSP Report-Only 的 `script-src 'self' 'unsafe-inline' + GTM`（`vercel.json:771`），且 e2e 夹具会拦截一切非 localhost 请求（`e2e/site-fixture.js:37-64`）。

### Gaps
- 未实际执行 `npm run prebuild`，无法确认当前 HEAD 门禁全绿；`HANDOVER.md:6` 提到"96 baseline unit failures"，未核实现状。

## 2. 现有设计系统：哪些 token / 组件 / 动效可服务 sci-fi HUD？

### Takeaway
全站当前是"纸白 + Anthropic Sans"的编辑部基调（首页为影片页），深色科幻语汇主要残留在 `afflatus-brand.css`（已成 legacy）、`worlds.css`（曜石黑 + 青/品红霓虹）与 `design.md` 的六条视觉宪章。可直接复用的是 token 骨架、header 主题变量、reduced-motion 纪律与几段 Canvas/Web Audio 工具代码；没有 three/GSAP/Lenis。

### Cited Findings
**Token 与字体**

| 来源 | Token / 内容 |
| --- | --- |
| `public/styles/typography.css:24-38` | `--af-font-sans`（Anthropic Sans → Arial → PingFang SC…）、`--af-type-hero/section/subheading/lede/body/nav/caption/footer/brand`、`--af-weight-regular/medium/brand`、`--af-leading-heading:1.12`、`--af-tracking-heading:-.025em` |
| `public/styles/responsive-primitives.css:1-29` | `--safe-top/right/bottom/left`、`--viewport-small/dynamic-height`、`--visual-viewport-*`、`--keyboard-inset`、`--touch-target:44px`、`--af-layout-max:1400px`、`--af-header-*-gap`、`--space-1..4`（4/8/12/16px）、`--control-font-size`、`--focus-ring-width/offset` |
| `public/styles/shared-header.css:3,9-13,112-115` | `--af-header-height:68px`；header 内 `--af-paper:#e8e6dc`、`--af-ink:#0f0f0e`、`--af-menu-paper`，`position:fixed; z-index:10000; color-scheme:light`；reduced-motion 下全部 animation/transition 关闭。页面可覆写 header 变量实现深色（示例 `public/styles/horoscope-paper.css:10`） |
| `public/styles/afflatus-brand.css:53-59,250-709` | `--afflatus-brand-ink/accent/accent-2/font/ease(cubic-bezier(.22,1,.36,1))/duration(620ms)`，按 `[data-brand-persona]` 分 home/arena/sectors/signal/course/horoscope/games/league/serial/boot 多套配色（如 arena `#3dff9a`/`#ff4fbd`、boot `#9ae5ff`/`#e8b380`），字体栈写了 Orbitron/Rajdhani/Chakra Petch/Share Tech Mono 但**均未自托管** |
| `public/styles/worlds.css:17-28` | 深色 token：`--bg:#0b0b0d --panel:#17181c --ink:#ecebe7 --dim:#a3a6ad --td-mag:#ff4fa8 --td-cyan:#3ee6ff --stitch:#f5c542`、`--mono:'JetBrains Mono'`、`--display:'Cinzel'`、`--ease:cubic-bezier(.32,.72,.28,1)` |
| `src/showcase/premiere.css:4-6` | 首页 `--home-paper:#f0eee6 --home-ink:#111110 --home-muted --home-line --home-gutter:clamp(24px,5.3vw,88px)` |
| `public/assets/fonts/` | 自托管 woff2：Anthropic Sans（roman/italic/core 子集，`font-display:optional`，`core-fonts.css:2`）、Newsreader、JetBrains Mono 400/700/800、Anton、Hanken Grotesk、Noto Serif SC 子集 175 KB、labs serif |

**设计纪律（`design.md`）**
- 六条视觉宪章：① 每个 UI 元素是一台舰载设备（加载=SCANNING、空态=NO CONTACT、错误=OFFLINE）；② 每个读数绑真实状态；③ 运动即信息，只用 transform/opacity、smoothDamp 临界阻尼、禁线性 tween、镜头切换 ≤0.5s 插值；④ 剪影先于细节；⑤ 双色温：冷色=世界/数据（青/白）、暖色=自身/警示（琥珀）；⑥ 渐进披露最多两层 — `design.md` §1.2。
- 排版即 UI：深底高对比为默认、霓虹只做点缀、mono 承载数据、ASCII 装饰 `aria-hidden` 不进语义流 — §2.1；暗色模式次要文字 ≥4.5:1，亮动态背景上文字须不透明面板 — §2.3。
- `prefers-reduced-motion` 全覆盖是新增视觉的**前置验收**（滚动动画直出终态、视差归零、粒子减半/关闭）— §4.5；上线自查：宪章六条→RM 降级→无 hover 专属→双语成对→`!important` 零新增→独立 rAF 零新增→触屏等价→人格不稀释 — §6.3；高风险视觉一律 `?fx=` flag 起步，真机看过再转默认 — §6.1。
- "每页一个人格，不做缝合怪"，新功能立项先答"它在这页的世界观里是什么设备" — §1.1。

**可复用的动效 / Canvas / WebGL / 音频代码**

| 文件 | 能力 | 备注 |
| --- | --- | --- |
| `public/signal-scene.js:1-60` | 裸 WebGL 低分辨率（320×180）顶点色 shader 场景，含 `prefers-reduced-motion` 守卫与无 WebGL 渐变回退 | **全仓库无引用**（grep 为空），属孤儿文件，可作 WebGL 模板 |
| `src/sectors/observatory/globe.js` | Canvas 2D 正交地球（`public/assets/globe/earth-land.json` 566 KB，Natural Earth 公有领域，`globe/README.md`），DPR 上限 2、ResizeObserver、850ms 缓动、RM 直出 | 可做 HUD 地球/雷达底图 |
| `src/showcase/filmMotion.js` | 视频播放可见性/pagehide 控制、拖拽小窗；`FilmPlayer.jsx` 播放器 | 首页影片 82 MB mp4（`docs/home-film.md`） |
| `src/lib/audio.js:1-45` | `window.AfflatusAudio`：共享 `AudioContext`、`env()` 包络、`noise()` 粉/白噪声、`masterGain()`（RM 下 0.12/否则 0.22） | 经典 script，非 ES module；`src/lib/transition.js:1` 已退化为注释，无消费者 |
| `src/lib/companionAudio.js` | `<audio>` 播放列表 + MediaSession，`public/audio/playlist.json` 14 首 mp3（约 135 MB），声明"绝不自动播放" | 仅 serial 页使用 |
| `src/pages/portfolioFY26.js`、`portfolioInk.js`、`portfolioTetris.js`、`src/workers/portfolioTetris.worker.js` | Canvas 滚动叙事、手绘墨迹笔触、Worker 预计算的自动俄罗斯方块 | Worker + `pagehide` 清理模式（`portfolioGame.js:34-36`） |
| `src/lib/worldsCarousel.js` | 纯函数惯性/弹簧卡片轮播物理（FRICTION .92、STIFFNESS .12） | 零 DOM，易移植 |
| `src/sectors/observatory/controller.js:45-46` | 单 passive scroll + rAF 合并驱动场景、IntersectionObserver 章节高亮 | 符合 tech.md:231 滚动纪律 |
| `public/lib/header-controller.js` | header 滚动时间线、`smooth()` smoothstep | 全站共享 |
| `tools/sprite-baker/index.html` | glTF → 多角度精灵图烘焙工具，引用 three | 开发工具，`.vercelignore` 排除 `tools/` |

### Inferences
- `afflatus-brand.css` 的 persona 体系已被 header 审计判为 legacy（`audit-header.mjs:14` 禁止 `data-brand-persona`），其科幻字体也未自托管；新 HUD 页应自建一组 `--mt-*` token，而非复用它。
- Playwright 以 `reducedMotion:'reduce'`、`colorScheme:'dark'` 运行并把所有 animation/transition 置零（`playwright.config.js:41-44`、`e2e/site-fixture.js:114-132`）；因此 HUD 页在 RM 下必须呈现完整、可读、>80 字符的 DOM 终态。
- `tech.md`/`urgent.md`/`docs/astra-motion-design.md` 反复要求复用的 `renderBudgetCoordinator.js`、`webglLifecycle.js`、`src/scene/*`、`page-turn.js` **在当前树中均不存在**（find 结果为空），这些文档描述的是 v2.0 影片首页之前的架构（`CHANGELOG.md`：2026-10-05 以影片首页完成整体重制）。

### Gaps
- 未核对 git 历史中 `renderBudgetCoordinator`/`webglLifecycle` 是否可恢复；未验证 `afflatus-brand.css` 是否仍被任何页面加载。

## 3. 页面结构：新页面如何登记、如何写双语、OG 如何生成？

### Takeaway
一页 = 根目录 HTML + `src/pages/xxxEntry.js` + 清单条目 + 生成物同步。双语靠 HTML 属性对 + JS `{en,zh}` 对象；`/en/`、`/zh/` 文档在 build 时由 `localize-site.mjs` 从同一源 HTML 派生。

### Cited Findings
- 清单字段：`id, file, path, status('active'|'redirect'|'prototype'|'system'), build, sitemap, defaultLocale, publishedLocales?, nav{order,group,en,zh}|null, themeColor, schema[], seo(ROUTE_SEO.x), capabilities[], metadata{title,description,canonical,ogTitle,ogDescription,ogImage,robots?}, locales{en,zh}` — `src/config/siteManifest.js:222-514`；`ROUTE_SEO.x = { social:{background,eyebrow,title,subtitle,alt,images}, structuredData:{kind} }` — `:30-220`。
- `structuredData.kind` 必须在 `BUILDERS`（profile/about/arena/sectors/signal/horoscope/worlds/serial/course）之内 — `scripts/route-seo.mjs:471-480`。
- 导航：`NAV_ROUTES` 由 active+nav 派生（`siteManifest.js:516-528`），但共享 header 的链接列表是**手写**的（`src/lib/sharedHeader.js:11-19`）；`HOME_NAV_GROUPS` 引用未知 routeId 会抛错（`:549-550`）；`'labs'` 作为 nav.group 仅 serial 使用（`:416`），首页分组为 markets/lab/writing（`:532-545`）。
- 页面入口模式：`import '../lib/i18n.js'; import './worlds.js'; import '../lib/nav.js'` — `src/pages/worldsEntry.js`；`nav.js` 挂载 header 控制器并监听 `afflatus-lang` 事件（`src/lib/nav.js:4,37-40`）；`i18n.js` 翻译所有 `[data-en]`，`data-i18n-html` 允许 innerHTML（`src/lib/i18n.js:12-18`）。
- 最新页 `worlds.html:1-20` 是可直接拷贝的 head 骨架：预绘脚本 → `performance.js` → viewport → title/description/theme-color/canonical/favicon → `responsive-primitives.css` → 页 CSS → `viewport.js` → `pages/xxxEntry.js` → 字体 preload → route-seo 块 → `shared-header.css`；`<body class="worlds-body">` 后紧跟生成的 header，再 `<main>` + `<h1>`（`:158-182`）。Google Fonts 在 worlds 页由 JS 延后挂载以保 LCP（`worlds.html:15-16`）。
- 本地化：`localize-site.mjs:819-833` 只处理 `ACTIVE_ROUTES`，对每个 `publishedLocales||['en','zh']` 产出 `dist/{locale}/{file}`；根路径文档为自适应（canonical 指向默认语言）。
- prototype/system 路由必须 `sitemap:false`、`nav:null`、`capabilities` 含 `'noindex'` — `tests/siteManifest.test.js:123-128`；`release-candidate` 能力会把路由纳入 Lighthouse 与 e2e noindex 门禁，但单测目前断言其为空数组 — `:131-141`、`e2e/quality-gates.spec.js:183-207`。
- OG：图片 URL 固定为 `/assets/og/{id}-{locale}.jpg`（`siteManifest.js:24-28`）；源图放 `assets/og-backgrounds/`（现有 8 张，`worlds.jpg` 仅 8.8 KB 说明可用极简底图）。

### Inferences
- 若新页进入主导航，必须同时改 `sharedHeader.js` 并重跑 `npm run site:generate`，否则 10 个 HTML 的 header 块与渲染结果不一致导致 `header:check` 失败。

### Gaps
- `generate-course-pages.mjs` 对非 course 页无影响，未深入。

## 4. 性能预算与质量门禁：重动效页必须满足的阈值

### Takeaway
硬门禁是 LCP ≤2500 ms、TBT ≤300 ms（200+100 噪声）、CLS ≤0.1（移动模拟、3 次中位数）、脚本字节不超基线 +5%、axe 零 serious/critical、零 console error、320 px 零横向溢出、任意 chunk ≤300 KB。

### Cited Findings
- `releaseBudgets`：LCP 2500 / TBT 200 / CLS 0.1，`runs:3`、median；`regressionAllowance 0.05`、`tbtNoiseAllowanceMs 100` — `lighthouse-baseline.json:9-22`；断言矩阵：CLS/LCP/TBT/`resource-summary:script:size` 为 error，性能分（基线−0.03）/Speed Index/总字节为 warn — `lighthouserc.cjs:42-83`；`onlyCategories:['performance']`，GTM 被屏蔽（`:92-96`）。
- 每个 active 路由必须在 `lighthouse-baseline.json` 有条目，否则 `lighthouserc.cjs:105` 抛错，且 `tests/lighthouseConfig.test.js:19-23` 要求三者路由列表完全相等；字段约束 `speedIndexMs>0`、`scriptBytes>0`、`totalBytes>scriptBytes`、`lcpMs>0`、`tbtMs>=0`（`:46-60`）。
- 参照值：about 7.4 KB JS / 103 KB 总；worlds 28.7 KB / 338 KB、LCP 1652 ms；portfolio 270 KB / 593 KB、LCP 4469 ms、perf 0.66 — `lighthouse-baseline.json:33-128`。
- e2e 每个 active 路由 × 3 端（1440×1000 Chromium、440×956 WebKit、412×892 Chromium，`playwright.config.js:50-67`）：响应 <400、`main`/`h1` 可见、title/description 非空、canonical 等于清单、`#afflatus-header #af-primary-nav` 存在、无 Vite overlay、`<html lang>` 匹配、正文 >80 字符、横向溢出 ≤2 px；键盘：12 次 Tab 内到达可交互元素、Markets 下拉 Enter/Escape、nav 链接 Enter 跳转 — `e2e/quality-gates.spec.js:49-141`。
- axe（仅桌面 Chromium）：`wcag2a/2aa/21a/21aa`，serious/critical 必须为空（`A11Y_BASELINE` 为 `{}`，`e2e/a11y-baseline.js:7`）— `quality-gates.spec.js:143-181`。
- 任何 `console.error`/`pageerror` 直接失败 — `e2e/site-fixture.js:89-106`；外部 stylesheet/script 被替换为空、其他外部请求 abort（`:37-64`）。
- 320×720：溢出 ≤1 px、可见控件 ≥44×44、`--safe-top`/`--viewport-dynamic-height` 有值、`data-keyboard-open` 存在 — `e2e/responsive-primitives.spec.js:7-62`。
- 视觉快照：每路由两张 PNG（>8,000 字节），拍摄前隐藏 `canvas, video, iframe` — `e2e/visual-captures.spec.js:44-50`。
- 非 React 路由不得下载 jsx-runtime chunk（硬编码列表）— `e2e/bundle-boundaries.spec.js:7-14`。
- 缓存：`/assets/*-<hash8>.(js|css)` 与 `/assets/film/*-<hex8>.(mp4|avif|png)` 一年 immutable，字体 30 天 — `vercel.json:782-793`；CSP Report-Only 含 `worker-src 'self' blob:`、`media-src 'self' blob:`（`:771`）。

### Inferences
- 一个"仅 Canvas 可见"的 HUD 页在视觉快照和 RM 模式下会近乎空白，并可能触发 `bodyTextLength>80` 失败；DOM 文字层必须是一等公民（与 `design.md` §2.1、`urgent.md:573`"不把 SEO 文本转进 canvas"一致）。
- 若引入 three.js（历史 vendor-three ≈675 KB raw，`urgent.md:22`），当前 300 KB 默认预算必失败，需在 `check-bundle-budget.mjs` 加 key 并动态 import。

### Gaps
- Lighthouse 对 WebGL/Canvas 页的真实 TBT/LCP 无法在此环境测量；tech.md:298 也记录沙盒无法运行 Playwright。

## 5. 可用于动画的依赖与体积姿态

### Takeaway
仓库**没有** GSAP、Three、Lenis、Framer Motion 或任何动效库；`public/lib` 仅三个小脚本。体积哲学是"预算先于功能"。

### Cited Findings
- `package.json:50-71` 全部依赖已列于 §1；`grep three|gsap|lenis` 仅命中 `tools/sprite-baker/index.html`。
- `public/lib/` = `course-reader.js`(1.3 KB)、`data-bridge.js`(0.45 KB)、`header-controller.js`(6 KB)。
- 首页关键入口曾压到 4.91 KB raw，重模块按意图/可见性延后加载 — `urgent.md:89`；"Three.js 必须远离非 3D 关键路径" — `urgent.md:22`。

### Inferences
- 最契合现状的实现是原生：CSS `@keyframes`/`animation-timeline`、Web Animations API、Canvas 2D/裸 WebGL（有 `signal-scene.js` 模板）、Web Audio（`audio.js`）、Worker（`portfolioGame.js` 模式）。要引库，先写 RFC 并加预算 key。

## 6. 文档中与未来页面 / labs / 科幻方向相关的线索

### Takeaway
无任何文件提及 Marathon、Bungie 或 glitch；但 `design.md` 的 HUD 宪章、`rfcs/` 的太空战斗 RFC 与 `docs/astra-motion-design.md` 的动效模块手册，构成了现成的"科幻 HUD 设计语言 + 动效验收合同"。

### Cited Findings
- `design.md` §1.1 叙事外壳表：index 曾为"深空舰长日志（Three.js + 战斗 HUD）"，arena 为"赛博竞技场"，signal 为"SCP 机密档案"——与现状不符（index 现为影片，`CHANGELOG.md`），但 HUD 措辞体系（SCANNING/NO CONTACT/OFFLINE）与双色温纪律仍是裁决标准。
- `rfcs/2026-07-13-u22-homepage-3d-combat.md`：六宪章打分、五个 WebGLRenderer 清点、bloom 管线、InstancedMesh 尾迹——所引代码（`src/scene/topdownCombat.js`、`src/ui/combatHmdV3.js`）已不在树中；`rfcs/2026-07-13-u23-default-3d-scene.md` 同样。
- `urgent.md:253-264`："Retired and experimental routes"政策——prototype 路由保持 `noindex,nofollow`、明确 prototype 标注、不入 nav；建议把 `?fx=` 类分支做成页内开发者切换器。`urgent.md:573-574`：不把 SEO 文本转 canvas；WebGPU 不得先于 WebGL 基线上线。
- `tech.md:109`（§2.3 新增页面 checklist）与 `:230-231`（rAF/滚动纪律）；`tech.md:261`：视觉改动验证阶梯——vitest → 构建产物 grep → 浏览器复核 → **站主真机验收才算关闭**。
- `docs/astra-motion-design.md`：M00–M16 动效模块（星场、开屏编排、滚动叙事、减少动态、图表动画），建议插值 `alpha = 1 - exp(-dt/tau)`，`tau=0.12–0.2s`（`:170`）；S0 合同要求"不新增第二套渲染预算/转场系统"（`:26`）。
- "labs"：serial 的 `nav.group:'labs'`（`siteManifest.js:416`）、`public/styles/labs-ui-font.css`、`public/assets/labs/`、`docs/lab-redesign-2026-10-11/`——指阅读器/观星实验室改版，与"实验页区"无关。
- `HANDOVER.md`、`IMPLEMENTATION_STATUS.md` 全部关于 vibe 量化工作台，与新页面无关。

### Gaps
- `tech.md` 73 KB 仅按关键词抽样；design.md 之外未发现对"游戏致敬页"的任何既定裁决。

## 7. 建议落位与最小注册清单

### Takeaway
把实验页做成 `prototype` 路由先行，所有资产走现有目录约定；清单共 11 步。

### 建议路径

| 内容 | 路径 | 依据 |
| --- | --- | --- |
| 页面文档 | `/home/user/Afflatus/marathon.html`（根目录即 Vite 入口） | `vite.config.js:8-10` |
| 入口模块 | `/home/user/Afflatus/src/pages/marathonEntry.js`（`i18n` → 页逻辑 → `nav`） | `src/pages/worldsEntry.js` |
| 页逻辑 / 场景 | `/home/user/Afflatus/src/features/marathon/`（JS 内 `import './styles.css'` 即可打包哈希；重场景用 `import()` 延后） | `src/features/arena-journal/` 模式 |
| 外链 CSS（可选） | `/home/user/Afflatus/public/styles/marathon.css`（build 时被 `optimize-static-output` 内联） | `optimize-static-output.mjs:1-2` |
| 静态资产 | `/home/user/Afflatus/public/assets/marathon/`；大媒体用内容哈希文件名并在 `vercel.json` 增加 immutable 规则 | `vercel.json:786-789` |
| 字体 | `/home/user/Afflatus/public/assets/fonts/` + `@font-face{font-display:optional}` | `core-fonts.css:2` |
| OG 源图 / 产物 | `/home/user/Afflatus/assets/og-backgrounds/marathon.jpg` → `public/assets/og/marathon-{en,zh}.jpg` | §1 og:check |
| Favicon | `/home/user/Afflatus/public/favicons/marathon.svg` | `public/favicons/` |
| Worker | `/home/user/Afflatus/src/workers/marathon.worker.js` | `src/workers/` |

### 最小注册清单
1. `src/config/siteManifest.js`：加 `ROUTE_SEO.marathon`（`structuredData.kind` 暂用 `'profile'` 或在 `route-seo.mjs:471` 新增 builder）与 `SITE_MANIFEST` 条目；flag 阶段用 `status:'prototype', build:true, sitemap:false, nav:null, capabilities:['noindex'], metadata.robots:'noindex'`；转正式改 `active` 并加 `nav`。
2. 若进导航：改 `src/lib/sharedHeader.js:11-19`（必要时 `HOME_NAV_GROUPS`）。
3. 从 `worlds.html:1-20,158-182` 拷贝 head/body 骨架；预绘脚本须与其他页字节一致（active 时强制）。
4. 全部可见文案与 `aria-label` 写成 `data-en`/`data-zh`、`data-aria-en`/`data-aria-zh`；JS 文案用 `{en,zh}` 对象。
5. `npm run site:generate`（写入 route-seo 块、header 块、sitemap、`*.generated.*`）。
6. `npm run og:generate` 生成 1200×630 ≤400 KB 卡片并提交。
7. active 时：跑 `npm run test:lighthouse` 后把三轮中位数写入 `lighthouse-baseline.json`（LCP ≤2500、TBT ≤200、CLS ≤0.1 才可能通过）。
8. 保证任一 chunk ≤300 KB，或在 `scripts/check-bundle-budget.mjs:22` 增加 key；重场景按意图/可见性 `import()`。
9. `prefers-reduced-motion` 直出静态终态；DOM 保留 `<h1>`、>80 字符正文与可键盘到达的控件；Canvas 一律 `aria-hidden` 并有文字等价层。
10. 不引用任何外部 CDN 脚本；不新增 `!important`；不新增全局 `scroll`/`resize` 策略（单 passive listener + rAF 合并）。
11. 验证：`npm run prebuild && npm run build && node scripts/check-bundle-budget.mjs && npm test && npm run test:e2e:smoke`；视觉最终以站主真机验收关闭（`tech.md:261`）。

### Gaps
- `release-candidate` 路线需同步修改 `tests/siteManifest.test.js:132` 的空数组断言，未在仓库中找到先例。
