# 以 Graphic Realism 重铸 Afflatus 的 Marathon 实验页

Bungie 的《Marathon》（中文商店名《失落星船：马拉松》，2026-03-05 登陆 PS5 / Xbox Series X|S / Steam，$39.99）拥有一套可被网页复现的、文字上可核实的视觉宪章：Franchise Art Director Joseph Cross 命名的 **"Graphic Realism"**（简化的、平面设计驱动的视觉 + 有限材质，叠加真实比例与落地的世界）、Bungie 官方 Art Blast 概括的 **"clean geometric forms, strong compositions, stark color accents"**、以 **KH Interference** 为核心的三层字体系统、由 Antibody / Michael Rigley 在预告片中确立的 **"color blocking + glitch"** 动态语言，以及 Ryan Lott 以 **"the hero is the world"** 为原则写出的工业脉冲式电子配乐 ([Creative Bloq](https://www.creativebloq.com/3d/video-game-design/bungies-art-director-explains-marathons-controversial-art-style); [ArtStation Magazine](https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/); [Fonts In Use](https://fontsinuse.com/uses/67879/marathon-2026-video-game-1); [Behance: Rigley](https://www.behance.net/gallery/205038723/MARATHON); [MMORPG.com](https://www.mmorpg.com/news/bungie-shares-music-of-marathon-dev-insights-ahead-of-server-slam-next-week-2000137335); [Hitmarker](https://hitmarker.net/news/marathon-will-launch-on-march-5-2026-bungie-confirms-1623532))。对 Afflatus 这个 Vite 8 多页静态站而言，这套语言的幸运之处在于它**天然偏向 CSS 原语**——平涂色块、`clip-path` 切角、`repeating-linear-gradient` 警示条、等宽大写标签、`steps(1)` 硬切——而不是重型 WebGL；真正需要 GPU 的只有 hero 区的 glitch / 色散 / 扫描线后处理，而 OGL（Unlicense，≤29 kB gz）足以承担，不必引入 86–121 kB 的 Three.js。下文给出的 15 个模块按 P0（登记与基础系统）、P1（标志性动效）、P2（音频、WebGL、3D 与转正式）排序，每个模块都绑定到 Afflatus 现有的 Lighthouse（LCP ≤2500 ms / TBT ≤200 ms / CLS ≤0.1）、axe、`site:check`、`lint:i18n` 与 300 KB chunk 预算门禁。必须先声明的最大保留：本次会话的网络策略拦截了几乎全部外部页面抓取，**绝大多数事实来自搜索引擎摘要而非页面全文**，官网 marathonthegame.com 的任何技术细节都未能获取，色板 hex 全部来自粉丝主题而非官方规范——这些在「来源可信度与未核实项」一节逐条列出。

---

## 风格 DNA：经核实的视觉规则、色板、字体、动态语言与音频身份

**视觉规则。** Cross 对 "Graphic Realism" 的原话是：一面是 "simplified, graphic-design-driven visuals with limited materials"，另一面是 "realistic proportions & scale, implied functional & detail, and a generally grounded world"，并明言这 "mainly a production-facing term" ([Creative Bloq](https://www.creativebloq.com/3d/video-game-design/bungies-art-director-explains-marathons-controversial-art-style))。他列出的影响源横跨 Metal Gear Solid 2、初代 Marathon、Wipeout、Mirror's Edge、Death Stranding，以及非游戏的 Aeon Flux、Ghost in the Shell、大友克洋、森本晃司、The Designers Republic、Chris Cunningham，还有 Formula 1 / MotoGP 这类赛车涂装 ([80.lv](https://80.lv/articles/marathon-art-director-shares-the-team-s-creative-influences))。Bungie 对 Runner 外观的速记是 **"Nike meets Teenage Engineering"**，GameSpot 进一步描述为 "high-fidelity, low-poly industrial design"、"visually busy and dense, but at the same time, easy to digest" ([GameSpot](https://www.gamespot.com/articles/bungies-marathon-is-a-polished-extraction-shooter-but-that-might-not-be-enough/1100-6530826/))。Global Franchise Director Philip Asher 则把叙事框架定为 **"greatest hits of '90s futurism"**：Sony Wipeout、PlayStation "Mental Wealth" 广告与透明 DualShock ([GamesRadar](https://www.gamesradar.com/games/fps/marathon-is-a-greatest-hits-of-90s-futurism-according-to-bungie-lead-who-says-the-shooter-was-deeply-inspired-by-wild-playstation-ads-and-translucent-dualshocks))。官方 Art Blast 的自述把这一切落到一句话——"Graphic design became one of our most powerful worldbuilding tools"，特征是 "clean geometric forms, strong compositions, stark color accents and a world that hints at deeper history"，情绪目标是 "tense, mysterious, and occasionally unsettling" ([ArtStation Magazine](https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/))。第三方观察与之一致：GameRant 指出 "strong, saturated, contrasting colors make up the bulk of Marathon's palette, with little in the way of gradients or blending" ([GameRant](https://gamerant.com/marathon-art-style-graphics-design-controversy-good-why/))，Fonts In Use 用 "high-contrast and brutalist, with bold colors" 概括 ([Fonts In Use](https://fontsinuse.com/uses/67879/marathon-2026-video-game-1))。值得注意的是，所有检索到的官方来源中**都没有出现 "Dieter Rams" 或 "Y2K"**——若文案要用这两个词，须标注为设计师归纳。

**色板。** 没有任何官方 hex 规范可查。唯一带完整数值的来源是一个自称"受 Marathon (2026) 启发、非官方"的终端主题：Accent **#C2FE0B**（acid yellow-green）、Background **#080A0E**（void black）、Foreground **#E8EDDF**（off-white）、Magenta **#EA027E**（"Runner signal and faction marker"）、Violet **#3601FB**（"deep corporate faction blue"）、Cyan **#01FFFF**（"neon scan readout"）、Orange **#FF5500**（"warning / hot marker"）([GitHub: omarchy-marathon-theme](https://github.com/Samat220/omarchy-marathon-theme); [colors.toml](https://raw.githubusercontent.com/Samat220/omarchy-marathon-theme/main/colors.toml))。这组估值的价值不在于精确，而在于**每种颜色被赋予了语义角色**（警示 / 扫描 / 阵营）——这与游戏内 HUD 以颜色传递信息的逻辑一致：护盾板数量以 Grey / Green / Blue / Purple 编码，自身护盾耗尽时整屏染上护盾颜色 ([Threads @goofstha](https://www.threads.com/@goofstha/post/DVpL0KLET0H/understanding-the-hud-ui-icons-in-marathon-before-i-start-shield-colors-show?hl=en))。另一个必须记住的分层：对外品牌（Kurppa Hosk 自 2021 年秋起主导）被描述为 "dark sci-fi geometry, faction iconography, and a restrained color palette" ([World Brand Design Society](https://worldbranddesign.com/kurppa-hosks-universe-building-marketing-campaign-for-marathon/); [kurppahosk.com](https://www.kurppahosk.com/work/bungie))，而游戏内更饱和。网页更接近"对外品牌"，应以近黑底 + 一个主重音 + 两三个语义辅色为限，而非把七种荧光色铺满。

**字体。** Fonts In Use 对 Bungie 新闻稿素材的识别是目前唯一具名的字体证据：主标题 / 展示字体 **KH Interference**（Regular、Light；Thomas Kurppa 等设计，2022 年发布，受收据打印与低分辨率像素字启发的等宽展示字体），被评价为 "practically a brand typeface now" 与 "a Designers' Republic fan's wet-dream"；第二标题字体为定制版 **Shapiro Wide 65**；第三标题字体 **IvyPresto Headline Regular**（仅游戏内）；正文 **Fraktion Mono**（Pangram Pangram）([Fonts In Use](https://fontsinuse.com/uses/67879/marathon-2026-video-game-1); [Fonts In Use: KH Type](https://fontsinuse.com/foundry/5180/kh-type); [khtype.com](https://khtype.com/typeface/kh-interference/))。三者刻意冲突——等宽像素感大写 + 超宽无衬线 + 高反差衬线——正是玩家戏称 "fontslop"（"20 种不同的字体、粗细、字号、间距组合全在一个菜单页"）的来源，也是识别度所在 ([GamesRadar](https://www.gamesradar.com/games/fps/the-first-ever-fontslop-game-marathon-players-are-already-sick-of-looking-at-the-upcoming-bungie-shooters-eye-sore-ui))。Bungie UI 设计师 Elliott Gray 的回应定义了官方立场：**"Don't think for a second we're gonna remove the sauce"**，但会改进 "inventory management, navigation, density of info" ([PC Gamer](https://www.pcgamer.com/games/fps/marathon-ui-designer-declares-himself-the-fontslop-merchant-and-promises-bungie-will-never-remove-the-sauce-from-the-ui))。网页复刻的裁决因此很清晰：继承三层字体冲突的"sauce"，但层级必须一眼可读。

**动态语言。** 有制作方署名佐证的只有预告片端：Michael Rigley 与 Antibody 为 2023 公布预告制作 "screen graphics and glitch content"，并为 "color blocking and glitch effects" 制定了风格化方案作为动画背景 ([Behance: MARATHON](https://www.behance.net/gallery/205038723/MARATHON); [Vimeo 830047787](https://vimeo.com/830047787); [Stash](https://www.stashmedia.tv/antibody-bungie-marathon-announcement-trailer/))。游戏内可从文字来源确认的模式包括：循环播放的「sense-memory」飞蛾加载短片（创意总监 Julia Nardin 称之为植入 shell 前的人造梦境，并致敬 1947 Harvard Mark II 的第一只 "bug"）([NewsBreak 转述 Polygon](https://www.newsbreak.com/news/4524738151282-bungie-explains-marathon-s-creepy-moth-loading-screen); [pulse.bot 转述](https://www.pulse.bot/gaming/news/what-marathons-creepy-moth-loading-screen-means-according-to-bungie-308fdc91-bf92-47c0-8e0e-9ecc48c852fe/))；ADS 瞄准时部分路点淡出 ([Bungie.net 1.0.5](https://www.bungie.net/7/en/News/Article/marathon_update_1_0_5))；径向菜单 ([FRVR 1.0.6.1](https://frvr.com/blog/news/marathon-1-0-6-1-patch-notes/))；客制化菜单默认带 "animated background layers" ([help.marathonthegame.com](https://help.marathonthegame.com/hc/en-us/community/posts/49929305400596-Flickering-In-Shell-Menus))；加载与过场 pillarbox ([PCGamingWiki](https://www.pcgamingwiki.com/wiki/Marathon_(2026)))；chromatic aberration 作为视觉特性 ([PC Gamer](https://www.pcgamer.com/hardware/its-time-to-decide-the-worst-graphical-effect-in-games-chromatic-aberration-vs-blood-dirt/))；撷取信标激活后向天空投射全图可见的巨大光柱 ([KeenGamer](https://www.keengamer.com/articles/guides/marathon-complete-guide-to-extraction/))。同样重要的是**反面证据**：匹配加载画面的 "constant flashing" 招致玩家投诉与减少频闪的无障碍请求 ([Steam 讨论](https://steamcommunity.com/app/3065800/discussions/0/766311764554258134/); [Accessibility Request](https://help.marathonthegame.com/hc/it/community/posts/47906627242132-Accessibility-Request-Flashing-Strobing-Load-Screens-Causing-Headaches))。而「文字解码 / scramble 动画」「滚动 ticker」「涂黑条」「声音响应式 UI」在所有来源中**均未得到确认**——路线图中使用它们时一律标注为"风格推演"。

**音频身份。** 配乐由 Son Lux 创始成员 **Ryan Lott** 创作，Bungie 音频总监 **Chase Combs**；官方 "Music of Marathon — Developer Insights"（2026-02-13）描述为 "contemporary electronic influences and human performances blend together" ([Bungie.net](https://www.bungie.net/7/en/News/Article/musicofmarathondevinsight))。Combs 的核心原则是游戏没有中心主角，"the hero is the world"，Tau Ceti 星球成为音乐基础，同一思路也塑造了整体声音设计 ([MMORPG.com](https://www.mmorpg.com/news/bungie-shares-music-of-marathon-dev-insights-ahead-of-server-slam-next-week-2000137335))；他明言 "we wanted to subvert player expectations" ([NME](https://www.nme.com/features/gaming-features/marathon-soundtrack-interview-ryan-lott-3949751))。Lott 使用人声碎片、预置钢琴（prepared piano）与 Expressive E Osmose 等人类演奏素材经重度处理 ([Aftermath](https://aftermath.site/marathon-bungie-soundtrack-ryan-lott/); [Synthtopia](https://www.synthtopia.com/content/2026/03/06/behind-the-scenes-with-the-music-of-marathon/))，评测形容为 "sparse tracks, packed with rhythmic hums, low growls… pulsating, looping industrial beats"（PCMag，镜像链接待核实）。两卷正式原声共 **42 轨**（Vol. I *Somewhere in the Heavens*、Vol. II *They Are Waiting*，Milan Records，2026-03-06），Vol. II 为 90+ 分钟游戏内完整配乐 ([Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now); [Discogs Vol. II](https://www.discogs.com/release/36704020-Ryan-Lott-Marathon-Vol-II-They-Are-Waiting-Original-Game-Soundtrack))。预告片音乐则走两条线：2023 公布预告用 Justice *Heavy Metal (SebastiAn Remix)*，获 2024 Clio Music 银奖 ([Clios](https://clios.com/music/winner/use-of-music-in-trailers-teasers/bungie/marathon-505087))；发售预告本身就是 *In Death We've Just Begun* ft. Poppy & Son Lux 的官方 MV（Harmony Korine / Sam Goldwater 执导，EDGLRD 制作）([YouTube vtw5BDpKgJM](https://www.youtube.com/watch?v=vtw5BDpKgJM); [Motionographer](https://motionographer.com/news/in-death-weve-just-begun-ft-poppy-and-son-lux-official-music-video-marathon-launch-cinematic/))。没有任何官方来源使用 "techno / IDM" 作流派标签，网页端的致敬应瞄准稀疏工业脉冲 + 低频 drone + 处理过的人声碎片，而非四拍 techno。

下表把 DNA 压成一页速查，并标注可信度：

| 维度 | 已核实规则 | 关键来源 | 可信度 |
| --- | --- | --- | --- |
| 形体 | 干净几何 + 强构图 + 局部色彩重音；硬几何（slab / 环形 Panopticon / 风车 Pinwheel）与软体（充气走廊、帐篷、pod）并置 | [Art Blast](https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/); [Fernstrom EYqzWn](https://www.artstation.com/artwork/EYqzWn); [Karakter pinwheel 8vWb16](https://www.artstation.com/artwork/8vWb16) | 高（官方措辞）/ 中（概念图仅见标题） |
| 材质 | 有限材质、平涂色块、少渐变 | [80.lv](https://80.lv/articles/marathon-art-director-shares-the-team-s-creative-influences); [GameRant](https://gamerant.com/marathon-art-style-graphics-design-controversy-good-why/) | 高 |
| 色板 | 近黑底 + acid green 主重音 + orange/cyan/magenta 语义辅色 + off-white 文字 | [GitHub 粉丝主题](https://github.com/Samat220/omarchy-marathon-theme) | **低（非官方 hex）** |
| 字体 | KH Interference（等宽大写展示）+ Shapiro Wide 65（超宽无衬线）+ IvyPresto Headline（高反差衬线）+ Fraktion Mono（正文） | [Fonts In Use](https://fontsinuse.com/uses/67879/marathon-2026-video-game-1) | 中（页面未打开，来自摘要） |
| 图形系统 | 阵营 logo、章程、贴花表、设施标识；Runner 技能图标 | [Goryainov a0KzV0](https://dgoryainov.artstation.com/projects/a0KzV0); [EzlxmA](https://dgoryainov.artstation.com/projects/EzlxmA); [Klaverweide](https://www.behance.net/gallery/249802247/Marathon-AbilityTrait-Icons) | 中 |
| 动态 | 色块 + glitch（预告片）；sense-memory 循环加载；整屏护盾染色；路点淡出；pillarbox；色散 | 见上文 | 中；游戏内硬切 vs 缓动、时长**无来源** |
| 音频 | 世界优先的工业脉冲 electro-ambient；人声碎片；无 leitmotif | [Bungie.net](https://www.bungie.net/7/en/News/Article/musicofmarathondevinsight); [Aftermath](https://aftermath.site/marathon-bungie-soundtrack-ryan-lott/) | 中高 |

---

## Afflatus 的门禁决定了路线图只能"CSS 优先、WebGL 按需"

Afflatus 是 Vite 8 MPA（根目录 `*.html` 即入口），运行时为 vanilla ES modules + 局部 Preact，`prebuild` 串了 `subset-cjk-fonts → generate-course-pages → data:check → site:check → header:check → css:check → lint:i18n → og:check → build-sectors-observatory --check` 八道门禁，几乎全部由 `src/config/siteManifest.js` 驱动（见本地审计笔记 `07_afflatus_site_audit.md` §1，引用 `package.json:8`）。仓库**没有** GSAP、Three、Lenis 或任何动效库，`public/lib` 只有三个小脚本；体积预算是 `main` 250 KB、其余任意 chunk 默认 300 KB，超出 CI 失败（`scripts/check-bundle-budget.mjs:22-26`）。Lighthouse 硬门禁为 LCP ≤2500 ms、TBT ≤200 ms（+100 ms 噪声容忍）、CLS ≤0.1，移动模拟三次取中位数，脚本字节不超基线 +5%（`lighthouse-baseline.json:9-22`、`lighthouserc.cjs:42-83`）；axe 在 `wcag2a/2aa/21a/21aa` 下 serious/critical 必须为零，任何 `console.error` 直接失败，e2e 以 `reducedMotion:'reduce'`、`colorScheme:'dark'` 运行并把全部 animation/transition 置零，还要求每路由正文 >80 字符、横向溢出 ≤2 px、320 px 下可见控件 ≥44×44（`playwright.config.js:41-44`、`e2e/quality-gates.spec.js:49-181`、`e2e/responsive-primitives.spec.js:7-62`）。CSP Report-Only 的 `script-src 'self'` 加上 e2e 夹具拦截一切非 localhost 请求（`vercel.json:771`、`e2e/site-fixture.js:37-64`），意味着**任何第三方库都必须经 npm 打包，不能走 CDN**。

这些约束与 Marathon 的语言意外契合。`design.md` 的六条视觉宪章——每个 UI 元素是一台舰载设备（加载 = SCANNING、空态 = NO CONTACT、错误 = OFFLINE）、每个读数绑真实状态、运动只用 transform/opacity 且镜头切换 ≤0.5 s、剪影先于细节、双色温（冷色 = 世界 / 数据，暖色 = 自身 / 警示）、渐进披露最多两层（`design.md` §1.2）——几乎就是 "Graphic Realism" 的网页译本。`design.md` §2.1 要求 mono 承载数据、ASCII 装饰 `aria-hidden`，§4.5 把 `prefers-reduced-motion` 全覆盖列为新增视觉的前置验收，§6.1 要求高风险视觉以 `?fx=` flag 起步。可直接复用的代码包括：`public/signal-scene.js`（裸 WebGL 低分辨率 shader 场景，含 RM 守卫与无 WebGL 渐变回退，全仓库无引用的孤儿模板）、`src/lib/audio.js`（共享 `AudioContext`、包络、粉/白噪声、RM 下主增益 0.12）、`src/sectors/observatory/controller.js:45-46`（单 passive scroll + rAF 合并）、`src/lib/worldsCarousel.js`（零 DOM 的弹簧物理）。自托管字体已有 JetBrains Mono 400/700/800、Anton、Hanken Grotesk、Newsreader 与 Anthropic Sans（`public/assets/fonts/`，`font-display:optional`）。

库体积与许可的核对结果给出了选择空间（gz，本地实测或官方 CI）：GSAP core 28.3 kB + ScrollTrigger 18.0 kB + SplitText 3.7 kB + ScrambleText 4.0 kB，自 2025-04-30 起连同全部原 Club 插件免费商用，但许可是 Webflow 的 "Standard 'no charge' license" 而非 OSI 开源 ([GSAP README](https://github.com/greensock/GSAP); [npm](https://registry.npmjs.org/gsap/latest); [ScanCode](https://scancode-licensedb.aboutcode.org/gsap-standard-no-charge-2025.html))；Lenis MIT 5.4 kB ([lenis](https://github.com/darkroomengineering/lenis))；OGL Unlicense，core 8 + math 6 + extras 15 = 29 kB minzipped，自带 `Post.addPass({fragment, uniforms})` 后处理骨架 ([oframe/ogl](https://github.com/oframe/ogl); [Post.js](https://github.com/oframe/ogl/blob/master/src/extras/Post.js))；Three.js MIT 但 WebGL 全量 86.3 kB、最小 tree-shaken 121 kB ([three.js PR 32154](https://github.com/mrdoob/three.js/pull/32154))；pmndrs/postprocessing Zlib 115 kB（不含 three）([pmndrs/postprocessing](https://github.com/pmndrs/postprocessing))；Motion MIT，mini `animate()` ≈2.5 kB ([motiondivision/motion](https://github.com/motiondivision/motion))。结论是：**P0/P1 全部可用原生 CSS + 现有仓库代码完成；P1 的 glitch hero 若要 GPU 版，首选 OGL；只有 P2 的 3D 展示才值得讨论 Three.js / model-viewer（后者 143–289 kB，必须加预算 key）。**

---

## 路线图：15 个按 P0 → P1 → P2 排序的模块

每个模块给出：目标、Marathon 参照（含 URL）、网页技术与库（含许可 / 体积）、reduced-motion / 性能 / 无障碍护栏、绑定到 Afflatus 门禁的验收标准、依赖。模块编号即建议实施顺序；P0 全部完成前不进入 P1。

### P0 — 登记、基础系统与护栏（没有它们页面无法通过 prebuild）

**M0 · 路由登记与门禁骨架。** **目标**：以 `status:'prototype', build:true, sitemap:false, nav:null, capabilities:['noindex'], metadata.robots:'noindex'` 在 `src/config/siteManifest.js` 登记 `marathon.html`，入口 `src/pages/marathonEntry.js`（`i18n` → 页逻辑 → `nav`），页逻辑放 `src/features/marathon/`，从 `worlds.html:1-20,158-182` 拷贝 head/body 骨架，`npm run site:generate` 同步 route-seo 块、header 块、sitemap 与 `*.generated.*`（审计 §3、§7）。**Marathon 参照**：无需视觉参照；但页面"人格"须先回答 `design.md` §1.1 的问题"它在这页的世界观里是什么设备"——建议定为「UESC 终端 / Runner 档案阅读器」，与 Art Blast 的 "graphic design as worldbuilding tool" 对齐 ([ArtStation Magazine](https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/))。**技术**：无新依赖。**护栏**：prototype 路由保持 `noindex,nofollow`、不入 nav（`urgent.md:253-264`）；高风险视觉用 `?fx=` 查询参数起步（`design.md` §6.1）。**验收**：`npm run prebuild` 全绿——`site:check` 要求 `<title>/theme-color/description/canonical/og:*` 与清单逐字相等、`responsive-primitives.css` 恰好一次、`<h1>` 存在；`header:check` 要求恰一个 `data-afflatus-header` 且源码含 `renderSharedHeader()` 完整输出、不得出现 `data-brand-persona`；`og:check` 要求 `public/assets/og/marathon-{en,zh}.jpg` 1200×630 ≤400 KB（源图 `assets/og-backgrounds/marathon.jpg`，`npm run og:generate`）。**依赖**：无。

**M1 · `--mt-*` 设计 token 与语义色板。** **目标**：在页级 CSS 建立独立 token 组，不复用已被 header 审计判为 legacy 的 `afflatus-brand.css` persona 体系（`audit-header.mjs:14`）。建议初值（**非官方估值**，需真机校色）：`--mt-void:#080A0E`、`--mt-panel:#0D1017`、`--mt-ink:#E8EDDF`、`--mt-dim:#B8BFAA`、`--mt-acid:#C2FE0B`（主重音 / 可交互）、`--mt-warn:#FF5500`（警示 / 自身状态）、`--mt-scan:#01FFFF`（数据 / 扫描）、`--mt-faction:#EA027E`（阵营 / 身份）、`--mt-corp:#3601FB`（次级阵营）。**Marathon 参照**：粉丝主题 hex 与语义命名 ([GitHub](https://github.com/Samat220/omarchy-marathon-theme); [colors.toml](https://raw.githubusercontent.com/Samat220/omarchy-marathon-theme/main/colors.toml))；"stark color accents" ([Art Blast](https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/))；"little in the way of gradients or blending" ([GameRant](https://gamerant.com/marathon-art-style-graphics-design-controversy-good-why/))；对外品牌 "restrained color palette" ([World Brand Design Society](https://worldbranddesign.com/kurppa-hosks-universe-building-marketing-campaign-for-marathon/))；护盾颜色即信息 ([Threads](https://www.threads.com/@goofstha/post/DVpL0KLET0H/understanding-the-hud-ui-icons-in-marathon-before-i-start-shield-colors-show?hl=en))。**技术**：CSS 自定义属性 + 平涂；禁用大面积渐变；header 深色化只覆写 `--af-paper/--af-ink`（`shared-header.css:9-13`，先例 `horoscope-paper.css:10`）。**护栏**：遵守 `design.md` §1.2 双色温（冷 = 世界 / 数据，暖 = 自身 / 警示）；§2.3 次要文字 ≥4.5:1，亮动态背景上的文字必须落在不透明面板上；acid green 作底时文字用 `--mt-void` 而非白。**验收**：axe serious/critical = 0（对比度）；`css:check` 零新增 `!important`；视觉快照两张 PNG >8,000 字节（`e2e/visual-captures.spec.js:44-50`）。**依赖**：M0。

**M2 · 三层字体系统。** **目标**：复现"等宽大写展示 + 超宽无衬线 + 高反差衬线 + 等宽正文"的四角色结构，同时吸取 fontslop 教训——每个视图最多三种字体角色、层级一眼可读。用仓库已自托管的字体占位（设计师推断，非来源结论）：JetBrains Mono 700/800 全大写 + 宽字距 ≈ KH Interference 角色；Hanken Grotesk 加 `letter-spacing` ≈ Shapiro 角色；Newsreader ≈ IvyPresto Headline 角色；JetBrains Mono 400 ≈ Fraktion Mono 角色。若购买正版 KH Interference 需确认商业网页许可。**Marathon 参照**：[Fonts In Use](https://fontsinuse.com/uses/67879/marathon-2026-video-game-1)；[KH Type](https://khtype.com/typeface/kh-interference/)；fontslop 批评与 "sauce" 立场 ([GamesRadar](https://www.gamesradar.com/games/fps/the-first-ever-fontslop-game-marathon-players-are-already-sick-of-looking-at-the-upcoming-bungie-shooters-eye-sore-ui); [PC Gamer](https://www.pcgamer.com/games/fps/marathon-ui-designer-declares-himself-the-fontslop-merchant-and-promises-bungie-will-never-remove-the-sauce-from-the-ui))；设计评论 "the typography becomes something you have to interpret" 作为反例 ([Joseph Kerr Design](https://josephkerrdesign.com/bungies-overdesigned-uis-what-marathon-gets-wrong/))。**技术**：`@font-face { font-display: optional }`（`core-fonts.css:2` 先例）+ `<link rel=preload>`；可选 `font-variation-settings` 动效 ([24ways](https://24ways.org/2019/interactivity-and-animation-with-variable-fonts/))。**护栏**：不加载 Google Fonts（CSP + e2e 拦截外部请求）；CJK 回退链沿用 `--af-font-sans`（`typography.css:24-38`）。**验收**：CLS ≤0.1（`optional` 避免字体交换位移）；`lint:i18n` 对 `data-en/data-zh` 成对与长度上限（`src/lib/bilingualContent.js:27`）通过；Lighthouse 字体字节计入总字节 warn 阈值。**依赖**：M1。

**M3 · HUD 标签 / 贴花 / 警示条 CSS 组件库。** **目标**：一组零依赖原语：切角面板与 HUD 括角（`clip-path: polygon()`）、警示条（`repeating-linear-gradient(45deg, var(--mt-void) 0 10px, var(--mt-warn) 10px 20px)`）、编号标签（`mono` + 全大写 + 字母间距）、设备状态词 SCANNING / NO CONTACT / OFFLINE、阵营式几何图标（原创 SVG）。**Marathon 参照**：Goryainov 的 UESC/Cryo 图形系统、Misc Graphic Design、Ares 贴花表、Arachne 品牌与章程 ([a0KzV0](https://dgoryainov.artstation.com/projects/a0KzV0); [Nq9dkP](https://dgoryainov.artstation.com/projects/Nq9dkP); [EzlxmA](https://dgoryainov.artstation.com/projects/EzlxmA); [wrDRbg](https://dgoryainov.artstation.com/projects/wrDRbg))；Tom Probert 署名 Graphic Designer 的走廊 ([31l1ag](https://www.artstation.com/artwork/31l1ag))；Klaverweide 的技能 / 特质图标 ([Behance](https://www.behance.net/gallery/249802247/Marathon-AbilityTrait-Icons))；Bloom 的道具 / 武器单页版式 ([patrickbloom.artstation.com](https://patrickbloom.artstation.com/))；Kurppa Hosk 的 "worldbuilding iconography and faction brand identities" ([kurppahosk.com](https://www.kurppahosk.com/work/bungie))。**技术**：`clip-path` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path))、`repeating-linear-gradient` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/repeating-linear-gradient()))、hazard-tape 边框做法（`border-image` 与 `border-radius` 不兼容，改用背景渐变 + 内层元素）([alexwlchan](https://alexwlchan.net/til/2024/under-construction/))、CSS 变量参数化条纹 ([dev.to](https://dev.to/alebarbaja/stripes-with-css-variables-580l))。**护栏**：装饰性 ASCII / 条纹 `aria-hidden`（`design.md` §2.1）；图标必须自解释或配文字标签——这是 Bungie 承认的游戏内教训（图标需悬停才能识别）([dlcompare](https://www.dlcompare.com/gaming-news/bungie-will-use-player-feedback-to-improve-marathon))；**切勿**搬用 Antireal 式现成海报语言（Bungie 曾因前员工将 Fern Hook 2017 海报放入贴图表而公开道歉并和解）([VGC](https://www.videogameschronicle.com/news/bungie-confirms-that-an-artists-work-was-stolen-and-used-in-marathon-without-their-permission); [GamesRadar](https://www.gamesradar.com/games/fps/stolen-marathon-art-issue-resolved-with-bungie-and-sony-to-my-satisfaction-original-artist-says))。**验收**：320×720 溢出 ≤1 px、可见控件 ≥44×44；axe 零 serious；`lint:i18n` 对 `aria-label` 要求 `data-aria-en/zh` 成对或 `data-i18n-static-aria`。**依赖**：M1、M2。

**M4 · Reduced-motion、性能与渲染调度基线。** **目标**：建立全页统一的"默认静态、`no-preference` 下渐进加动效"机制：一个 `matchMedia('(prefers-reduced-motion: reduce)')` 监听、一个 passive scroll + rAF 合并器、一个 IntersectionObserver 驱动的 `import()` 懒加载器、一个 `pagehide` 清理器。**Marathon 参照**：玩家对加载画面频闪的投诉与无障碍请求 ([Steam](https://steamcommunity.com/app/3065800/discussions/0/766311764554258134/); [help.marathonthegame.com](https://help.marathonthegame.com/hc/it/community/posts/47906627242132-Accessibility-Request-Flashing-Strobing-Load-Screens-Causing-Headaches))，以及游戏自带的 HUD opacity / UI colour mode 选项 ([PlayStation Support](https://www.playstation.com/en-au/support/games/marathon-support/))——网页应把"关闭 glitch / 降低密度"做成可见开关。**技术**：web.dev 的 `prefers-reduced-motion` 指南（削减 parallax、动画渐变、背景视频、自动播放、reveal 动画；大型动画样式表用 `<link media="(prefers-reduced-motion: no-preference)">` 条件加载）([web.dev](https://web.dev/articles/prefers-reduced-motion))；WCAG 2.3.3 ([说明](https://www.disabilityworld.org/toolkit/standards/wcag/2-3-3-animation-from-interactions/))；WebGL 懒加载模式（接近视口时 `import()`，离屏暂停，`dispose()`）([svilenkovic](https://svilenkovic.com/3d/how-to-lazy-load-3d-scene); [dev.to](https://dev.to/didof/optimizing-threejs-4-key-techniques-4lad))；复用 `controller.js:45-46` 与 `portfolioGame.js:34-36` 的既有模式；插值用 `alpha = 1 - exp(-dt/tau)`、`tau = 0.12–0.2 s`（`docs/astra-motion-design.md:170`）。**护栏**：禁止全屏 `backdrop-filter` / `filter: blur()`（规范称其 "roughly double the required rendering time"，移动 GPU 尤甚；降级为半透明纯色面板）([csswg filter-effects-2](https://drafts.csswg.org/filter-effects-2/); [bugzilla 1828248](https://bugzilla.mozilla.org/show_bug.cgi?id=1828248))；SVG `feTurbulence` 颗粒 `numOctaves ≤3–4` 或预渲染为平铺位图 ([habr](https://habr.com/en/articles/780840))；不新增独立 rAF 与全局 `scroll/resize` 监听（`design.md` §6.3、`tech.md:230-231`）。**验收**：Playwright RM 模式下 DOM 完整可读、正文 >80 字符、`main`/`h1` 可见；TBT ≤200 ms；零 `console.error`/`pageerror`；非 React 路由不下载 jsx-runtime chunk（`e2e/bundle-boundaries.spec.js:7-14`）。**依赖**：M0。

### P1 — 标志性动效（赋予页面 Marathon 识别度）

**M5 · Hero：色块 + glitch 揭示。** **目标**：首屏以 2–3 块平涂色面（acid / void / off-white）做硬边分割，标题以 `clip-path` 切片 glitch 入场，背景可选 GPU 色散 + 位移块。**Marathon 参照**：Rigley 的 "color blocking and glitch effects" 方案 ([Behance](https://www.behance.net/gallery/205038723/MARATHON); [Vimeo](https://vimeo.com/830047787))；Cross 分享的 "vibrant graphic design approach to UI with glitchy details" ([Creative Bloq](https://www.creativebloq.com/3d/video-game-design/fans-are-torn-over-the-vibrant-colours-and-glitchy-ui-art-style-of-bungies-new-marathon-game))；Karakter / Fernstrom 的"单一巨型几何体 + 环境留白"地标构图 ([8vWb16](https://www.artstation.com/artwork/8vWb16); [dLJgQW](https://www.artstation.com/artwork/dLJgQW))；Jeremy Hanna 的 Key Art 三联 ([O3vRBv](https://www.artstation.com/artwork/O3vRBv))。**技术（Level 0，CSS）**：Codrops CSSGlitchEffect（`clip-path` + CSS 动画，可商用不得原样转售）([codrops/CSSGlitchEffect](https://github.com/codrops/CSSGlitchEffect))；RGB split 用 `mix-blend-mode: screen/difference` ([kaleidawave/rgb-split-text](https://github.com/kaleidawave/rgb-split-text); [MDN mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode))；硬切用 `steps(1, start)` ([MDN steps()](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/steps))。**技术（Level 2，可选 GPU）**：以 `signal-scene.js` 为模板或 OGL `Post.addPass`（Unlicense，≤29 kB）移植 Three.js `DigitalGlitch` 的最小配方——随机位移贴图 + 按 `angle` 做 RGB 三通道偏移采样 `vec4(cr.r, cga.g, cb.b, cga.a)` + 噪点，每 120–240 帧触发一次大故障 ([GlitchPass.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/GlitchPass.js); [DigitalGlitch.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/shaders/DigitalGlitch.js); [ogl Post.js](https://github.com/oframe/ogl/blob/master/src/extras/Post.js))。**护栏**：RM 下 glitch 完全关闭、色块直出终态；glitch 节奏受"频闪投诉"约束——限制为入场一次 + hover 触发，不做持续循环；GPU 层仅在 `no-preference` 且非低端设备（`navigator.hardwareConcurrency` 判断，审计笔记推断）下 IntersectionObserver 懒加载，并提供静态 poster；Canvas `aria-hidden`，标题文字留在 DOM。**验收**：LCP ≤2500 ms（LCP 元素必须是 DOM 标题或 poster 图而非 canvas）；CLS ≤0.1（色块容器预留尺寸）；任一 chunk ≤300 KB（OGL 场景独立 `import()`）；`?fx=glitch` flag 阶段通过真机验收后转默认（`tech.md:261`）。**依赖**：M1–M4。

**M6 · 文字 scramble / decode 与 marquee 数据条（风格推演）。** **目标**：标签与标题进入视口时以乱码解码到位；页面边缘一条 mono 大写 ticker 滚动"系统状态"。**Marathon 参照**：**无直接来源**确认游戏内存在文字解码或 ticker；它是对 KH Interference "receipt printing / low-res pixel" 气质 ([khtype.com](https://khtype.com/typeface/kh-interference/))、The Guardian 所述 "ASCII text" ([inkl](https://www.inkl.com/news/with-its-fluorescent-characters-and-ascii-text-marathon-is-a-masterclass-in-90s-nostalgia)) 与预告片屏幕图形 ([Behance](https://www.behance.net/gallery/205038723/MARATHON)) 的推演，页面文案应如实标注。**技术**：零依赖版 Justin Windle `TextScramble` 类（`chars = '!<>-_\\/[]{}—=+*^?#________'`，rAF 逐字随机起止帧，乱码字包 `<span class="dud">`）([gist](https://gist.github.com/Marty-f13/b1fdcf9d9f92600ce0c6903c57fd1971); [CodePen 原版](https://codepen.io/soulwire/pen/mErPAK))；库版 GSAP ScrambleTextPlugin 4.0 kB gz（Standard no-charge 许可）([npm](https://registry.npmjs.org/gsap/latest))；marquee 用 Codrops CSSMarqueeMenu（MIT，纯 CSS）([codrops/CSSMarqueeMenu](https://github.com/codrops/CSSMarqueeMenu)) 或 hexagoncircle 的可访问 marquee（RM 暂停、启停开关、复制内容 `aria-hidden`）([CodePen](https://codepen.io/hexagoncircle/pen/eYMrGwW))。**护栏**：RM 下直接渲染最终文本；scramble 期间容器 `aria-live="off"`，屏幕阅读器读取的是 `data-en/data-zh` 终值；ticker 提供暂停按钮且 hover 暂停；中文解码字符集需单独设计（乱码符号不得破坏 CJK 排版）。**验收**：`lint:i18n` 对 JS 内 `{en,zh}` 对象通过；键盘 12 次 Tab 内可到达 ticker 暂停键（`quality-gates.spec.js`）；无新增独立 rAF（挂到 M4 的合并器）。**依赖**：M2、M4。

**M7 · 滚动驱动的「区域调色」叙事。** **目标**：页面按 Marathon 四个区域 + Season 2 夜间变体切换 token 集：Perimeter（开阔日光）→ Dire Marsh（绿色雾沼）→ Outpost（高压警示）→ Cryo Archive（冷蓝迷宫）→ Night Marsh（夜景），滚动至每段时整页 `--mt-*` 平滑换值。**Marathon 参照**：区域定义——Perimeter 起始区，Dire Marsh 为 Anomaly 出现前的 UESC 农业沼泽，Outpost "hostile from the moment you deploy"，Cryo Archive 位于 UESC Marathon 殖民船本体 ([GamesRadar](https://www.gamesradar.com/games/fps/marathon-maps); [PCGamesN](https://www.pcgamesn.com/marathon/map-zones))；Dire Marsh 的 "green shimmer" 与 "obviously unearthly light" ([Galaxus](https://www.galaxus.at/en/page/the-world-of-marathon-is-too-good-for-an-extraction-shooter-41863))；Cryo Archive "unforgivingly cold" 的 "labyrinth across a haunted planet-sized spaceship" ([PC Gamer](https://www.pcgamer.com/games/fps/there-is-nothing-like-marathons-cryo-archive-map))；Night Marsh = Dire Marsh (Night)，Season 2 "Nightfall" 2026-06-02 ([Bungie.net](https://www.bungie.net/7/en/News/article/welcome_season_2); [Xbox Wire](https://news.xbox.com/en-us/2026/06/02/marathon-night-marsh-spotlight))；Outpost 的 Pinwheel 与 Cryo Archive 的 Panopticon / Hub 作为各段地标插图母题 ([chucktropolis Y8LJvV](https://www.chucktropolis.com/projects/Y8LJvV); [Ov22Nb](https://www.artstation.com/artwork/Ov22Nb); [Goryainov oJnLoz](https://dgoryainov.artstation.com/projects/oJnLoz))。**技术**：首选 CSS `animation-timeline: view()` / `scroll()` + `animation-range`（先写 `animation` 再写 `animation-timeline`）([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations))，但 scroll-driven-animations **baseline: false**（Chrome/Edge 115+、Safari/iOS 26+、Firefox 无）([web-features](https://github.com/web-platform-dx/web-features/blob/main/features/scroll-driven-animations.yml.dist))，故用 `@supports not (scroll-timeline: --x)` 回退到 IntersectionObserver 章节高亮（`controller.js` 既有模式）切换 `data-zone` 属性；不引入 Lenis / ScrollTrigger（Lenis 虽 MIT 5.4 kB，但 Safari 上限 60 fps、iframe 内失效，且本页不需要平滑滚动）([lenis](https://github.com/darkroomengineering/lenis))。**护栏**：RM 下 token 切换瞬时完成、无视差；颜色过渡只动 `background-color/color`（合成友好），不动 `filter`；每段保留 DOM 文字（区域名、描述）作为 SEO / 阅读层（`urgent.md:573`）。**验收**：横向溢出 ≤2 px（三端）；TBT ≤200 ms；无新增 `scroll` 监听（grep 验证）；axe 每段文字对比度通过。**依赖**：M1、M4。

**M8 · 「Sense-memory」加载 / 过渡循环与 MPA 硬切转场。** **目标**：用 1–3 秒的抽象循环短片（原创 Canvas / WebM）代替进度条作为区段过渡，并在跨页导航时用 View Transitions 做 pillarbox 式硬切。**Marathon 参照**：飞蛾加载画面是循环的 "sense-memory" 人造梦境，改编自 Antibody 制作的更长开场动画 ([NewsBreak 转述 Polygon](https://www.newsbreak.com/news/4524738151282-bungie-explains-marathon-s-creepy-moth-loading-screen))；加载与过场 pillarbox ([PCGamingWiki](https://www.pcgamingwiki.com/wiki/Marathon_(2026)))；客制化菜单的 "animated background layers" ([help center](https://help.marathonthegame.com/hc/en-us/community/posts/49929305400596-Flickering-In-Shell-Menus))。**技术**：MPA 跨文档 View Transitions（两端文档声明 `@view-transition { navigation: auto }`，用 `::view-transition-old(root)/::view-transition-new(root)` 覆盖为 `steps(1)` 硬切；页面 `hidden` 时自动跳过）([MDN Using](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using); [mdn/dom-examples](https://github.com/mdn/dom-examples/tree/main/view-transitions))，支持度 view-transitions Baseline low 2025-10-14（Chrome/Edge 111、Firefox 144、Safari 18），跨文档版 Chrome/Edge 126+、Safari 18.2+、Firefox 不支持 ([web-features](https://github.com/web-platform-dx/web-features/blob/main/features/view-transitions.yml.dist); [caniuse](https://caniuse.com/cross-document-view-transitions))；循环短片用 cleverage/responsive-video-background 模式（MIT：仅在未请求减少动态时播放，`poster` 首帧渐进 JPEG，窄屏显示图片）([cleverage](https://github.com/cleverage/responsive-video-background))，`<source media="(prefers-reduced-motion: no-preference)">` 配静态 `<img>` 回退 ([web.dev](https://web.dev/articles/prefers-reduced-motion))。**护栏**：绝不复制飞蛾意象（版权 + 原创性），改为与 Afflatus 页面人格匹配的抽象几何循环；RM 下显示 poster；循环内无高频闪烁；视频走 `/assets/film/*-<hex8>` 哈希命名以命中一年 immutable 缓存（`vercel.json:786-789`）。**验收**：视觉快照前隐藏 `canvas, video, iframe` 后页面仍有完整内容（`visual-captures.spec.js:44-50`）；LCP 不落在视频上；`media-src 'self' blob:` CSP 合规。**依赖**：M4、M5。

**M9 · Runner 式「档案卡」与阵营图标系统。** **目标**：把 Afflatus 的内容单元（作品 / 文章 / 实验）做成 Runner 卡：单一大剪影 + 名称大字 + 编号 + 一行能力图标 + 可切换的"皮肤"配色；hover 轻微磁性位移。**Marathon 参照**：Runner 以独立 Key Art 呈现（Recon / Assassin / Thief）([O3vRBv](https://www.artstation.com/artwork/O3vRBv); [1LxE9X](https://www.artstation.com/artwork/1LxE9X); [JweyBn](https://www.artstation.com/artwork/JweyBn))；Cross 的 Thief / Stealth key concept ([BkabvA](https://josephacross.artstation.com/projects/BkabvA); [WXdZlD](https://www.artstation.com/artwork/WXdZlD))；Kwan 的 UESC 系列展示"同阵营 → 统一色块 + 统一贴花 + 不同轮廓" ([gwgwwQ](https://tobiaskwan.artstation.com/projects/gwgwwQ); [wOAOP5](https://www.artstation.com/artwork/wOAOP5))；皮肤以颜色命名（"Cyber Red"）说明色彩是身份变量 ([cara.app/daniol](https://cara.app/daniol))；粉丝 Runner card 生成器印证社区如何理解这一模板 ([Behance: Kecman](https://www.behance.net/gallery/229699531/Marathon-Fanart))；Void 隐身、Blackbird 侦察、Locus 路障等能力可作图标语义参考 ([The Game Post](https://thegamepost.com/all-runners-in-marathon/))。**技术**：CSS grid + M3 原语；原创 SVG 图标；磁性按钮用 Codrops MagneticButtons（MIT）或 `worldsCarousel.js` 的弹簧物理 ([codrops/MagneticButtons](https://github.com/codrops/MagneticButtons))；皮肤切换 = 卡片级 `--mt-*` 覆写。**护栏**：剪影用原创插画 / 几何体，不用游戏截图；hover 效果有触屏等价（`design.md` §6.3）；磁性位移只动 `transform`，RM 下关闭。**验收**：每卡 ≥44×44 可点区域；`lint:i18n` 卡片文案成对；axe 链接名唯一；视觉快照 >8,000 字节。**依赖**：M1–M3。

### P2 — 音频、GPU 后处理、3D 与转正式

**M10 · 生成式环境声景 + 低帧率频谱可视化。** **目标**：用户手势后开启的、随滚动区域缓慢演化的 drone / 工业脉冲声景，加一组低帧率方块频谱作为 HUD 读数。**Marathon 参照**："the hero is the world"、避开 leitmotif ([MMORPG.com](https://www.mmorpg.com/news/bungie-shares-music-of-marathon-dev-insights-ahead-of-server-slam-next-week-2000137335); [The Game Post](https://thegamepost.com/marathon-composer-ryan-lott-halo-destiny-music/))；人声碎片 / prepared piano 的"情绪穿过重度处理而留存" ([Aftermath](https://aftermath.site/marathon-bungie-soundtrack-ryan-lott/))；"rhythmic hums, low growls… looping industrial beats"（PCMag 镜像，待核实）；Bungie 并无官方 audio-reactive visualiser，此模块是品牌延伸而非复刻。**技术**：优先扩展现有 `src/lib/audio.js`（共享 `AudioContext`、`noise()`、`masterGain()` RM 下 0.12）；若需调度 / 效果链则引入 Tone.js（MIT；`Tone.Noise` 粉/棕噪 + 低通 + `Tone.FMSynth` 低频 drone + `Tone.PingPongDelay`/`Tone.Reverb`，自带 `Tone.Analyser`）([Tonejs/Tone.js](https://github.com/Tonejs/Tone.js); [examples](https://github.com/Tonejs/Tone.js/tree/dev/examples))；可视化参考 MDN webaudio-examples（CC0）与 webprofusion/web-audio-viz（MIT，零依赖 Canvas 2D）([mdn/webaudio-examples](https://github.com/mdn/webaudio-examples); [web-audio-viz](https://github.com/webprofusion/web-audio-viz))；**避免** audioMotion-analyzer（AGPL-3.0）([hvianna/audioMotion-analyzer](https://github.com/hvianna/audioMotion-analyzer))。**护栏**：绝不自动播放（`companionAudio.js` 先例；浏览器策略需用户手势后 `AudioContext.resume()`）；可见静音开关与音量；RM 下主增益降低且可视化直出静态条；零第三方录音。**验收**：Tone.js chunk 独立 `import()` 且 ≤300 KB；无 `console.error`；TBT 不受影响（音频在交互后初始化）；键盘可达开关。**依赖**：M4、M7。

**M11 · WebGL 后处理层：扫描线 / CRT / 色散 / 抖动。** **目标**：对 hero 或插图区叠加轻量后处理：细扫描线、轻微桶形畸变、RGB 色散、4×4 Bayer 抖动。**Marathon 参照**："Bungie loves a bit of chromatic aberration. It's a feature in the game's visual effects" ([PC Gamer](https://www.pcgamer.com/hardware/its-time-to-decide-the-worst-graphical-effect-in-games-chromatic-aberration-vs-blood-dirt/))；KH Interference 的低分辨率像素气质 ([khtype.com](https://khtype.com/typeface/kh-interference/))；预告片 glitch 内容 ([Behance](https://www.behance.net/gallery/205038723/MARATHON))。**技术**：OGL `Post.addPass` 单 pass 合并（Unlicense ≤29 kB）；GLSL 参考 Timothy Lottes 公有领域 CRT shader（`hardScan/hardPix/warpX/warpY/maskDark/maskLight`，头注 "PUBLIC DOMAIN… Please take and use"）([crt-lottes.glsl](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl))；抖动参考 Codrops 实时 dithering（4×4 Bayer）与 Efecto ASCII/dither（WebGPU 不可用时回退 Canvas 2D）([Codrops dithering](https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/); [Codrops Efecto](https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders))；如已决定引入 Three.js，则用 pmndrs postprocessing（Zlib）的 `ScanlineEffect/ChromaticAberrationEffect/NoiseEffect/ASCIIEffect`，多 Effect 合并为单 EffectPass ([postprocessing/src/effects](https://github.com/pmndrs/postprocessing/tree/main/src/effects))；**勿**使用 Shadertoy `Ms23DR`（CC BY-NC-SA，非商用）。纯 CSS 回退：`repeating-linear-gradient` 半透明横纹叠层。**护栏**：仅 `no-preference` + 懒加载 + 离屏暂停 + `dispose()`；渲染分辨率上限（`signal-scene.js` 的 320×180 低分辨率思路）；色散强度微小，不影响文字可读（文字层永远在 canvas 之上的 DOM）。**验收**：chunk ≤300 KB（OGL 场景 + shader ≈ 数十 kB）；TBT ≤200 ms；RM 快照与非 RM 快照均 >8,000 字节；GPU 层不可用时页面无差别可读。**依赖**：M5。

**M12 · 低多边形平涂 3D 展示（可选）。** **目标**：若有原创 glTF（例如 Afflatus 自己的"设备"模型），以 toon 色带 + 描边呈现 "high-fidelity, low-poly industrial design" 感。**Marathon 参照**："low-poly industrial design"、"Nike meets Teenage Engineering" ([GameSpot](https://www.gamespot.com/articles/bungies-marathon-is-a-polished-extraction-shooter-but-that-might-not-be-enough/1100-6530826/))；Collector's Edition 的 1/6 Thief Shell 雕像与 WEAVEworm 模型展示了"单一产品 + 纯色底"的陈列方式 ([PlayStation Direct](https://direct.playstation.com/en-us/buy-accessories/marathon-collectors-edition))。**技术**：Three.js `MeshToonMaterial` + `DataTexture` gradientMap（`NearestFilter` 才有硬边色带）([webgl_materials_toon.html](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_toon.html))；描边用 `OutlinePass`（后处理）或 drei `<Outlines>`（inverted hull）([OutlinePass.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/OutlinePass.js); [drei Outlines](https://github.com/pmndrs/drei/blob/master/docs/abstractions/outlines.mdx))；轻量替代 OGL `load-gltf.html` + `flat-shading-matcap.html` ([ogl examples](https://github.com/oframe/ogl/tree/master/examples))；`<model-viewer>` Apache-2.0 但 143–289 kB gz ([model-viewer](https://github.com/google/model-viewer))。仓库已有 `tools/sprite-baker/index.html`（glTF → 多角度精灵图烘焙），**精灵图方案可完全绕开运行时 3D**。**护栏**：Three.js 全量 86–121 kB + 模型 + 后处理 115 kB 必然逼近或超出 300 KB，需在 `check-bundle-budget.mjs:22` 加 key 并写 RFC（审计 §5）；`urgent.md:22` "Three.js 必须远离非 3D 关键路径"；RM 下显示烘焙精灵图。**验收**：预算 key 通过；LCP 不受模型加载影响；Lighthouse 脚本字节不超基线 +5%。**依赖**：M4、M11；仅在有原创模型时启动。

**M13 · 十字准星光标与 hover 扭曲（桌面增强）。** **目标**：`pointer: fine` 设备上以 SVG 十字准星替代光标，悬停可交互元素时轻微扭曲 / 吸附。**Marathon 参照**：游戏主机端菜单使用光标导航并提供 controller cursor friction 设置 ([comicbook.com](https://comicbook.com/gaming/news/marathon-season-2-update-patch-notes/))；HUD 顶部罗盘与 hit marker 的"每个读数绑状态"气质 ([help center](https://help.marathonthegame.com/hc/en-us/community/posts/46776844545684-How-To-INSTANTLY-Improve-The-HUD-Compass); [Tom's Guide](https://www.tomsguide.com/gaming/marathon-review))。**技术**：Codrops CrosshairDistortion（MIT，全屏 SVG 十字准星 + hover 扭曲）([codrops/CrosshairDistortion](https://github.com/codrops/CrosshairDistortion))；tholman/cursor-effects 在 RM 下不渲染的做法 ([tholman/cursor-effects](https://github.com/tholman/cursor-effects))。**护栏**：`@media (pointer: fine) and (prefers-reduced-motion: no-preference)` 才启用；原生光标在表单与文本上保留；触屏无此层但交互等价。**验收**：WebKit 440×956 与 Chromium 412×892 端无光标层且无溢出；桌面 Chromium axe 不因装饰层产生 serious。**依赖**：M4。

**M14 · 转正式路由（active）。** **目标**：由 `prototype` 升为 `active`，进入导航与 sitemap。**技术 / 流程**：改 `status:'active'` 并加 `nav{order,group,en,zh}`；同步手写的 `src/lib/sharedHeader.js:11-19`（否则 10 个 HTML 的 header 块与渲染结果不一致导致 `header:check` 失败）；预绘脚本 `afflatus:locale:v1` 须与其他页字节相同；跑 `npm run test:lighthouse` 三轮取中位数写入 `lighthouse-baseline.json`（字段 `speedIndexMs>0`、`scriptBytes>0`、`totalBytes>scriptBytes`）；`tests/lighthouseConfig.test.js:19-23` 要求三处路由列表完全相等（审计 §1、§4、§7）。**护栏**：参照值——worlds 页 28.7 KB JS / 338 KB 总 / LCP 1652 ms 通过，portfolio 页 270 KB JS / LCP 4469 ms / perf 0.66 是反例（`lighthouse-baseline.json:33-128`）；本页目标 JS ≤60 KB（CSS 路线）或 ≤120 KB（含 OGL 懒加载）。**验收**：`npm run prebuild && npm run build && node scripts/check-bundle-budget.mjs && npm test && npm run test:e2e:smoke` 全绿；站主真机验收关闭（`tech.md:261`）。**依赖**：M0–M9 全部完成，M10–M13 按需。

下表汇总依赖与推荐技术栈：

| 模块 | 优先级 | 核心技术 | 新增依赖（gz） | 依赖模块 |
| --- | --- | --- | --- | --- |
| M0 路由登记 | P0 | siteManifest / site:generate | 无 | — |
| M1 token 色板 | P0 | CSS 变量 | 无 | M0 |
| M2 字体系统 | P0 | 自托管 woff2、`font-display:optional` | 字体文件 | M1 |
| M3 HUD 原语 | P0 | `clip-path`、`repeating-linear-gradient` | 无 | M1, M2 |
| M4 RM/性能基线 | P0 | matchMedia、IO 懒加载、rAF 合并 | 无 | M0 |
| M5 Hero glitch | P1 | CSS clip-path / OGL Post | 0 或 OGL ≤29 kB | M1–M4 |
| M6 scramble/ticker | P1 | Windle 类 / CSS marquee | 0（或 GSAP ScrambleText 4 kB） | M2, M4 |
| M7 区域调色 | P1 | scroll-timeline + IO 回退 | 无 | M1, M4 |
| M8 sense-memory/转场 | P1 | View Transitions、WebM+poster | 无 | M4, M5 |
| M9 Runner 卡 | P1 | CSS grid、弹簧物理 | 0（或 MagneticButtons MIT） | M1–M3 |
| M10 声景 | P2 | audio.js / Tone.js | 0 或 Tone.js（MIT） | M4, M7 |
| M11 后处理 | P2 | OGL Post / Lottes CRT | OGL ≤29 kB | M5 |
| M12 3D 展示 | P2 | 精灵图 / Three toon | 0 或 Three 86–121 kB（需预算 key） | M4, M11 |
| M13 准星光标 | P2 | CrosshairDistortion | ≈数 kB（MIT） | M4 |
| M14 转正式 | P2 | lighthouse-baseline、sharedHeader | 无 | 全部 |

---

## 素材清单（设计师可直接打开的参考链接）

以下链接均为笔记中搜索引擎实际返回的真实 URL；页面内图片直链（cdna.artstation.com、mir-s3-cdn-cf.behance.net）本次无法获取。

**官方一手来源**

| 类别 | 链接 | 说明 |
| --- | --- | --- |
| Art Blast | https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/ | 60+ 艺术家，按 concept / world art / tech art / VFX 分组；"画册级"替代 |
| Press kit | https://press.bungie.com/Marathon ；https://press.bungie.com/en-AU | 16:9 Key Art（`Marathon_Standard_Keyart_16x9_EN.jpg`）、Runner press 图；使用条款未核实 |
| ViDoc | https://bungie.net/7/en/News/Article/marathonvidoc | "Vision of Marathon"（2025-12-15，约 23 分钟），2025-12 视觉重校后的当前风格 |
| Season 2 | https://www.bungie.net/7/en/News/article/welcome_season_2 ；https://news.xbox.com/en-us/2026/06/02/marathon-night-marsh-spotlight | Night Marsh、Wardens |
| 补丁说明（UI 条目） | https://www.bungie.net/7/en/News/Article/marathon_update_1_0_5 ；…/marathon_update_106 ；…/marathon_update_1_1_0 ；…/marathon_update_1_1_5 | 路点淡出、图标重绘、多选 tile |
| Credits | https://www.bungie.net/7/en/Marathon/Credits | 美术 / UI 人员与合作工作室 |
| Steam | https://store.steampowered.com/app/3065800 | 9 张官方截图 + 9 条预告（第三方统计）；社区截图 https://steamcommunity.com/app/3065800/screenshots/ |
| PlayStation Blog | https://blog.playstation.com/tag/marathon | 揭晓与路线图文 |
| 加载画面解读 | https://www.newsbreak.com/news/4524738151282-bungie-explains-marathon-s-creepy-moth-loading-screen | Nardin 谈 sense-memory |

**ArtStation（用户指定 7 位 + 关键关联者）**

| 艺术家 / 工作室 | 链接 | 对网页的价值 |
| --- | --- | --- |
| Patrick Bloom（Staff Concept Artist） | https://patrickbloom.artstation.com/ | Marsh Props、BRRT SMG：产品卡 + 规格标签版式 |
| Tobias Kwan（Senior Concept Art Lead） | https://tobiaskwan.artstation.com/projects ；https://tobiaskwan.artstation.com/projects/gwgwwQ ；https://www.artstation.com/artwork/wOAOP5 ；https://www.artstation.com/artwork/O3q3vk ；https://www.artstation.com/artwork/O3q3ay | UESC 系列：同阵营色块 + 贴花分级 |
| Dima Goryainov（Senior Concept Art Lead） | https://dgoryainov.artstation.com/projects/Nq9dkP ；…/a0KzV0 ；…/wrDRbg ；…/EzlxmA ；…/oJnLoz | **最接近设计系统的一手资料**：图形设计、UESC/Cryo 标识、Arachne 品牌、Ares 贴花表、Cryo Hub |
| Sigurd Fernstrom（独立） | https://fernstrom.artstation.com/ ；https://www.artstation.com/artwork/ndwJP4 ；…/EYqzWn ；…/dLJgQW ；…/a0KKbL | Quarantine 帐篷、充气走廊、Pinwheel：软体 + 硬标识对比 |
| Daniel Chavez (daniol) | https://cara.app/daniol ；http://www.daniolart.com/projects | "Cyber Red" 皮肤品牌 → 主题色变体逻辑（项目页未能打开） |
| Karakter Design Studio | https://karakter.de/marathon/ ；https://www.artstation.com/artwork/8vWb16 ；…/ndwNN6 ；…/5eneng ；…/rl5AYE ；…/NqYxx5 ；…/WXxqY2 | Pinwheel / mothership 地标：hero 构图（ArtStation 作者归属待核） |
| West Studio | https://www.weststudio.com/project/marathon-world-design ；…/marathon-seasonal-content ；https://www.artstation.com/artwork/BkxxRD ；https://weststudio.artstation.com/ | 世界设计、皮肤 / key art |
| Joseph Cross（前 Franchise Art Director） | https://josephacross.artstation.com/ ；…/projects/BkabvA ；https://www.artstation.com/artwork/WXdZlD ；…/rJW3XG | Thief / Stealth key concept |
| Jeremy Hanna（Key Art） | https://www.artstation.com/artwork/O3vRBv ；…/1LxE9X ；…/JweyBn | Recon / Assassin / Thief 三联 |
| Tom Probert（Graphic Designer） | https://www.artstation.com/artwork/31l1ag | 走廊环境图形 |
| Charles Jacobi（Principal Environment Artist） | https://www.chucktropolis.com/projects/Y8LJvV | 四区域实机截图 |
| George Varodi | https://georgevarodi.artstation.com/projects/mAGON9 ；https://www.artstation.com/artwork/oJK4Zz | Mielgo 短片环境 |
| Garrett Post | https://garrettpost.artstation.com/projects/L2Ak3v ；…/Dxg9X9 | Recon Number 54、UESC Marathon |
| 其他 | https://www.artstation.com/artwork/Ov22Nb（Panopticon）；…/0aYLZ4（Outpost 内部）；…/P4a6R1（Tau Ceti IV）；…/RKkkOA（Vandal 皮肤）；…/1NdJV2（Assassin Shell）；…/KR639X（Bungie "Marathon - engine"） | 环境 / 角色补充 |

**Behance（官方参与者与粉丝）**

| 项目 | 链接 | 性质 |
| --- | --- | --- |
| Michael Rigley × Antibody "MARATHON" | https://www.behance.net/gallery/205038723/MARATHON | 预告片 screen graphics + glitch（**动态语言首要参照**） |
| Kennon Fleisher "Bungie - Marathon ViDoc" | https://www.behance.net/gallery/179474213/Bungie-Marathon-ViDoc | Bungie 内部 ViDoc 动态设计 |
| Ryan Klaverweide "Ability/Trait Icons" | https://www.behance.net/gallery/249802247/Marathon-AbilityTrait-Icons | Bungie 委托的 Runner 图标 |
| Tony Kecman "Marathon Fanart" | https://www.behance.net/gallery/229699531/Marathon-Fanart | 海报系列 + Runner card 生成器 |
| Artyom Galinov "MARATYPE" | https://www.behance.net/gallery/227048755/MARATYPE-custom-display-font | 社区展示字体（非官方） |
| Graveification "GFX Free Render Pack" | https://www.behance.net/gallery/244502589/Marathon-GFX-Free-Render-Pack-?locale=en_US | 粉丝渲染包（许可需核） |
| Behance 搜索 | https://www.behance.net/search/projects/Bungie%20marathon | 海报合集 |

**截图 / 实机 / 预告片**

| 来源 | 链接 |
| --- | --- |
| Gematsu 图库（按日期分批，最新 2026-02-12） | https://www.gematsu.com/gallery/marathon |
| Kotaku 截图与视频页 | https://kotaku.com/games/marathon-2 ；https://kotaku.com/marathon-screenshots-gameplay-trailer-showcase-bungie-1851775925 |
| Creative Bloq（含 Cross 分享的 UI 截图） | https://www.creativebloq.com/3d/video-game-design/fans-are-torn-over-the-vibrant-colours-and-glitchy-ui-art-style-of-bungies-new-marathon-game |
| 2023 公布预告（Antibody） | https://vimeo.com/830047787 |
| 发售 MV（官方） | https://www.youtube.com/watch?v=vtw5BDpKgJM |
| Alpha vs 现版对比 | https://kotaku.com/marathon-visuals-art-bungie-updated-director-2000655713 ；https://www.gamespark.jp/article/2025/12/25/160999.html |
| 交互地图（区域俯视） | https://www.shacknews.com/article/144058/marathon-interactive-maps ；https://mobalytics.gg/marathon/maps |
| Stash 动态影像汇总 | https://www.stashmedia.tv/tag/marathon/ |
| Mielgo 短片（Annecy 条目） | https://www.annecyfestival.com/en/the-mifa/themes/mifa-cross-ip/video-game-cinematic-works-game-trailers-competition/video-game-cinematics-game-trailers-2026/marathon-reveal-cinematic-short |
| 粉丝 UI 概念（菜单信息架构清单） | https://www.maximilianlock.co.uk/post/marathon-ui-personal-project ；https://www.simplysiddhant.com/work/marathon-alpha ；https://www.therookies.co/entries/49939 ；https://dribbble.com/Bircch |

**OST / 流媒体**

| 项目 | 链接 |
| --- | --- |
| Bungie OST 公告（42 轨） | https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now ；中文 https://www.bungie.net/7/zh-chs/News/Article/marathon_ost_streaming_now |
| Dev Insights 音乐纪录片 | https://www.bungie.net/7/en/News/Article/musicofmarathondevinsight |
| YouTube Music Vol. II | https://music.youtube.com/browse/MPREb_IWZlIf87MDj |
| Deezer / Audiomack Vol. II | https://www.deezer.com/us/album/921339091 ；https://audiomack.com/ryan-lott/album/marathon-vol-ii-they-are-waiting-original-game-soundtrack-0406447 |
| Presto Music（Hi-Res） | https://www.prestomusic.com/classical/products/9855226 ；…/9855227 |
| Discogs | https://www.discogs.com/release/36703786 ；https://www.discogs.com/release/36704020 |
| 访谈 | https://aftermath.site/marathon-bungie-soundtrack-ryan-lott/ ；https://www.nme.com/features/gaming-features/marathon-soundtrack-interview-ryan-lott-3949751 ；https://www.synthtopia.com/content/2026/03/06/behind-the-scenes-with-the-music-of-marathon/ |
| 预告片音乐 | https://clios.com/music/winner/use-of-music-in-trailers-teasers/bungie/marathon-505087 ；https://www.theelementsmusic.com/projects/marathon-official-announcement-trailer |

**合法音乐替代与生成式方案**

| 方案 | 链接 | 许可要点 |
| --- | --- | --- |
| Tone.js | https://github.com/Tonejs/Tone.js | MIT；自写 patch 零第三方录音 |
| Generative.fm / pieces | https://github.com/generative-music/pieces-alex-bainter ；https://github.com/generative-music/samples-alex-bainter | 代码 MIT；采样许可需逐项核对 |
| ambient.garden | https://github.com/pac-dev/AmbientGarden | 全代码生成；LICENSE 文件未见，使用前确认 |
| Pixabay Music | https://pixabay.com/service/terms/ | Pixabay Content License，免署名，禁再分发 |
| Uppbeat | https://uppbeat.io/blog/royalty-free-and-copyright-free-music/uppbeats-music-licenses | 免费层须贴 Credit |
| Free Music Archive | https://freemusicarchive.org/FAQ | 逐曲 CC，避开 NC/ND |
| Togeo / clongclongmoo | https://wiki.creativecommons.org/wiki/Togeo_Music ；https://www.clongclongmoo.org/tag/ambient/page/12 | 多数 NC，商业页慎用 |
| YouTube 嵌入规则 | https://developers.google.com/youtube/terms/required-minimum-functionality | 可见播放器、>50% 露出才自动播放、每页一个、≥200×200 |
| 可视化参考 | https://github.com/mdn/webaudio-examples（CC0）；https://github.com/webprofusion/web-audio-viz（MIT）；https://github.com/Mattallmighty/audio-visualiser（MIT） | 避免 AGPL 的 audioMotion-analyzer |

**代码 demo / 库**

| 技法 | 链接 | 许可 / 体积 |
| --- | --- | --- |
| CSS glitch | https://github.com/codrops/CSSGlitchEffect ；https://github.com/codrops/GlitchSlideshow ；https://github.com/kaleidawave/rgb-split-text | Codrops 可商用不得转售；MIT |
| WebGL glitch | https://github.com/mrdoob/three.js/blob/dev/examples/jsm/shaders/DigitalGlitch.js ；https://github.com/pmndrs/postprocessing/tree/main/src/effects ；https://github.com/pixijs/filters ；https://github.com/felixturner/bad-tv-shader | MIT / Zlib / MIT / MIT |
| CRT / 扫描线 | https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl | 公有领域 |
| 抖动 / ASCII | https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/ ；https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders | 教程 |
| 文字 scramble | https://gist.github.com/Marty-f13/b1fdcf9d9f92600ce0c6903c57fd1971 ；https://codepen.io/soulwire/pen/mErPAK | 零依赖 |
| 转场 | https://github.com/codrops/interlude ；https://github.com/codrops/PixelTransition ；https://github.com/mdn/dom-examples/tree/main/view-transitions ；https://github.com/gl-transitions/gl-transitions | MIT |
| 滚动 | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations ；https://github.com/codrops/SeamTransitions | — |
| 光标 / 磁性 | https://github.com/codrops/CrosshairDistortion ；https://github.com/codrops/MagneticButtons ；https://github.com/tholman/cursor-effects | MIT |
| marquee | https://github.com/codrops/CSSMarqueeMenu ；https://codepen.io/hexagoncircle/pen/eYMrGwW | MIT |
| 视频背景 | https://github.com/cleverage/responsive-video-background ；https://web.dev/articles/prefers-reduced-motion | MIT / CC |
| 渲染库 | https://github.com/oframe/ogl（Unlicense ≤29 kB）；https://github.com/mrdoob/three.js/pull/32154（86–121 kB）；https://github.com/greensock/GSAP（no-charge，28 kB core）；https://github.com/darkroomengineering/lenis（MIT 5.4 kB）；https://github.com/motiondivision/motion（MIT，mini 2.5 kB） | 见各链接 |
| 同类获奖站 | https://www.awwwards.com/sites/eloyb-design ；https://basement.studio/showcase/basement-chronicles-the-internet-needs-you.md ；https://mosaic.flabbergast.agency/ ；https://interlude.crnacura.workers.dev/ | 参考 |

**字体**

| 字体 | 链接 | 备注 |
| --- | --- | --- |
| KH Interference | https://khtype.com/typeface/kh-interference/ ；https://fontsinuse.com/typefaces/241490/kh-interference | 商业字体，需购买并确认网页许可 |
| Fonts In Use 条目 | https://fontsinuse.com/uses/67879/marathon-2026-video-game-1 | Shapiro Wide 65 / IvyPresto / Fraktion Mono 识别 |
| Durandal Grotesque | https://designbeep.com/2026/03/14/durandal-grotesque-font/ | logo 复刻字体，**仅限个人使用**，勿用于站点 |
| 粉丝主题配字 | https://github.com/Samat220/omarchy-marathon-theme | 推荐 PP Fraktion Mono / Departure Mono（粉丝选择） |

---

## 来源可信度与未核实项（必读）

**方法限制。** 本次会话的沙箱网络策略拒绝了几乎所有外部域名的直接抓取：marathonthegame.com（CONNECT 403）、bungie.net、press.bungie.com、artstation.com、magazine.artstation.com、behance.net、fontsinuse.com、kurppahosk.com、karakter.de、weststudio.com、80.lv、creativebloq.com、kotaku.com、aftermath.site、youtube.com、reddit.com、steamcommunity.com、store.steampowered.com、gameuidatabase.com、tympanus.net、gsap.com、awwwards.com、shadertoy.com、codepen.io 等全部返回 ENOTFOUND / 403 / "host not allowed"；唯一可直接抓取的是 github.com、raw.githubusercontent.com 与 registry.npmjs.org。随后共享的 WebSearch 配额也在各研究线程的第 2–4 轮用尽。因此，**除 GitHub 仓库 README / 源码、npm 元数据与本地 Afflatus 代码审计外，本报告的全部事实均来自搜索引擎返回的页面标题与摘要**，没有一条游戏相关引文是从页面全文中核对的。URL 本身是搜索引擎实际返回的真实链接，可直接打开；但页面内容、日期、图片与引语上下文均需二次确认。

**必须重新核实的事项（按影响排序）：**

| 事项 | 当前状态 | 对路线图的影响 |
| --- | --- | --- |
| 官网 marathonthegame.com 的布局、配色、动效、loader、hover、滚动、WebGL / 视频背景、页面过渡、字体文件、JS 库 | **一条都未获取**；建议在允许网络的环境执行 `curl -sL https://www.marathonthegame.com/` 并 grep `<link rel="stylesheet"`、`@font-face`、`<script src`、`<video`、`canvas` | M2 字体栈、M5 hero 构图、M8 转场方式全部基于推断 |
| 色板 hex（#C2FE0B / #080A0E / #FF5500 / #01FFFF / #EA027E / #3601FB / #E8EDDF） | 全部来自粉丝终端主题，作者未说明取样方法；无官方规范；无法从概念图像素取样 | M1 token 初值需真机对照 Art Blast / press kit 校色 |
| Fonts In Use 条目的字体识别（KH Interference / Shapiro Wide 65 / IvyPresto Headline / Fraktion Mono） | 页面未打开；Shapiro 与 IvyPresto 的字体公司归属未核；正文 / HUD 小字字体无来源 | M2 替代字体选择 |
| 游戏内动效的具体参数（硬切 vs 缓动、时长、标题 / logo 动画、Runner 选择动画） | **无任何文字来源**；YouTube 时间戳全部无法核实 | M5–M9 的节奏设计是设计判断 |
| 「文字解码 / scramble」「滚动 ticker」「涂黑条」「声音响应式 UI」是否存在于游戏 | **未找到来源**，不能确认 | M6 必须标注为风格推演 |
| 闪烁 / 抖动类现象哪些是设计、哪些是 bug | 多出现在 bug 帖，无法区分 | M5 glitch 节奏取保守值 |
| Cross 2023 原始社媒长文、Space.com "graphic retro-futurism" 访谈正文、Brian Vinton 的职务与原话 | 均为媒体转述或粉丝 README 转述 | 风格 DNA 引语的上下文缺失 |
| Karakter 名下 6 个 ArtStation 链接的作者归属（官方号 vs 成员个人号）；Tobias Kwan "Assault Commander"、Goryainov "throne scenes"、Bloom "Marsh Props 1/2" 单页 URL | 未核 / 未取得 | 素材清单完整度 |
| Daniel Chavez 在 daniolart.com 的 Marathon 项目页内容 | 页面无法打开，仅 Cara / Bluesky 简介 | 皮肤品牌参照 |
| Behance 项目的描述、日期（Klaverweide 条目日期自相矛盾） | 仅摘要 | 无 |
| Steam 社区截图 ToS、press.bungie.com/Marathon 资产清单与使用条款 | 未读取 | 版权指引以保守为准 |
| Game UI Database / Interface In Game 是否收录 Marathon | 站点被屏蔽，搜索无命中 | 缺少系统化 UI 截图库 |
| PCMag 评测引语（"rhythmic hums, low growls…"）、Republic DG 对 Combs 的访谈、World Soundtrack Awards 入围 | 镜像链接 / 无原始 URL | M10 音色描述 |
| 2025-04-12 玩法揭晓预告的配乐、Mielgo 短片是否用 Bach BWV 974 | 完全未知 / 仅社区说法 | 无 |
| GSAP / Motion / Lenis 官方体积数字 | 官方站未打开；本地实测为 UMD/min gzip，非 bundler tree-shake 结果 | M5/M6 预算估算偏保守 |
| Codrops 文章正文（Efecto、dithering、Distortion Hover）、所有 CodePen、Awwwards / FWA / Godly 2025–2026 清单 | 未打开 | 素材清单中的教程类条目细节 |
| Afflatus 当前 HEAD 门禁是否全绿；`HANDOVER.md:6` 提到的 "96 baseline unit failures" | 未运行 `npm run prebuild` / `npm test` | M0 起步前先跑一次基线 |
| `renderBudgetCoordinator.js`、`webglLifecycle.js`、`src/scene/*` | `tech.md` / `urgent.md` 反复引用但**在当前树中不存在**（v2.0 影片首页重制前的架构） | M4 需新建调度器而非复用 |

**可信度分级建议。** 高：GitHub 仓库 README / 源码（GSAP、Lenis、OGL、Three.js PR、postprocessing、Codrops 仓库、Lottes shader、web-features 数据、MDN 源文件）、npm 元数据、本地 Afflatus 源码。中高：Bungie.net / press.bungie.com 页面标题与摘要中的直接引语（OST 公告、Dev Insights、补丁说明）。中：主流媒体（Creative Bloq、80.lv、GamesRadar、PC Gamer、Kotaku、GameSpot）摘要中的引语。低：粉丝主题 hex、pulse.bot / newsbreak / recapio 等聚合站转述、Threads / X 帖、未署名的 ArtStation 作者归属、Reddit 镜像站。

---

## 第二轮补充核实（2026-11-02，仅搜索引擎 + 本地验证）

本轮网络策略仍只放行 github.com / npm，页面级抓取依旧不可用；以下结论来自约 58 次搜索与本地命令，细节与全部 URL 见 `research/08_followup_gaps.md`。

**已关闭或基本关闭的事项**

| 事项 | 结论 |
| --- | --- |
| Afflatus 当前 HEAD 门禁 | 本地 `npm ci` 后 `npx vitest run`：145 个文件、1709 通过、1 跳过；`npm run prebuild` 全部门禁 OK（site/header/css/i18n/og/observatory）。M0 可直接起步。 |
| `renderBudgetCoordinator.js`、`webglLifecycle.js`、`src/scene/*` | 可从 git 历史恢复：提交 `d9d4fc4`（调度器两文件）与 `9da3af9`（整套 `src/scene/*`）。M4 可先 `git show` 评估复用，再决定新建。 |
| 字体厂商与授权 | KH Interference = KH Type（khtype.com，按公司规模授权，有试用与学生版）；Shapiro = OGJ Type Design，MyFonts 约 $29/字重，"Std 65 Light Heavy Wide" 最接近 "Wide 65"；IvyPresto Headline = The Ivy Foundry（2020，Adobe Fonts 可用）；Fraktion Mono = Pangram Pangram（可试用，授权 $40 起）。 |
| 官方频道与视频 URL | 官方频道 youtube.com/@MarathonTheGame。Gameplay Reveal Trailer `X8z0WsYKm2k`、Launch Gameplay Trailer `f5TcwVlHnKU`、Launch Cinematic `KF24WS4MMC0`、Season 2 预告 `HmSS0NI94Ro`、ViDoc `fjzmhROTv28` 等；另有 7 条 4K 无解说实机视频 ID。上传频道归属仍未逐条核实。 |
| OST 流媒体 | Apple Music Vol. I 专辑页（29 首，约 54 分钟，Milan/Sony）已取得；Deezer、Amazon、MusicBrainz、RYM 链接已收集；Spotify 仅有单曲页；无官方 Bandcamp。 |
| Game UI Database / Interface In Game | 域内搜索均无 Marathon 条目，确认缺少系统化 UI 截图库，需自行从视频截帧。 |
| Joseph Cross 原帖 | 2023-05-30 X 线程 "Marathon Art Style (a short thread)"，由 Kotaku 文章嵌入转载；直接 status URL 未取得。 |
| 库版本（npm 实时） | gsap 3.15.0、lenis 1.3.27、ogl 1.0.11（2025-01 后无新版）、three 0.187.0、motion 14.9.0、animejs 4.5.0。gzip 体积仍以本地实测为准。 |

**部分关闭**

- 色板：新增第二个独立粉丝来源（JustinPerea/Republic：#DCFF00 / #0A0A0A / #E8E2D2 / #4AC4F8），与 Omarchy 主题的酸绿/深黑/米白方向一致；Kurppa Hosk 在 LinkedIn 称主色为 "vibrant orange"，并把原始 logo/identity 归于 Mother Design 与 PlayStation Studios Creative（单一社交来源）。M1 token 初值建议：酸绿为主强调、橙为警示、青为数据，仍需真机校色。
- Reddit：找到 2023 年 "Marathon Art appreciation thread" 与 2024 年美术风格对比帖，以及一条 r/IdentifyThisFont 求助帖（无答案）；未发现 HUD 截图合集。
- Space.com 访谈标题已确认；Brian Vinton 被 VGC 列为 Senior Art Director，但与 Cross 离职报道的职务关系未厘清。

**仍未关闭（需在可抓取页面的环境完成）**

- marathonthegame.com 的技术栈、字体文件与动效（只有 "in-universe document"、"anti-website aesthetic" 的定性描述）。
- 2025-04-12 玩法揭晓预告与 ViDoc 的配乐；Mielgo 短片是否用 Bach BWV 974（Annecy 官方条目只写 Ryan Lott 为作曲）。
- OST Vol. I 第 7–24 首顺序、Spotify 专辑页、PCMag 评测署名、官方品牌 hex。

## 版权与合规指引

**不直接嵌入任何受版权保护的截图、概念图或音乐。** 官方截图、Key Art、ArtStation / Behance 作品与 Milan Records 发行的原声均为 Bungie / 艺术家 / 厂牌的受保护作品；本次未找到任何允许个人网站复用的书面条款，press kit 的使用条款也未能读取（笔记 04 §1）。Bungie 自身曾因 alpha 版环境贴图使用了设计师 Fern "Antireal" Hook 的 2017 年海报而公开道歉、撤下实机视频并审查全部美术，最终和解并在 credits 中署名其为 "Visual Design Consultant" ([VGC](https://www.videogameschronicle.com/news/bungie-confirms-that-an-artists-work-was-stolen-and-used-in-marathon-without-their-permission); [VGC: pulls gameplay](https://www.videogameschronicle.com/news/bungie-pulls-marathon-gameplay-after-art-plagiarism-storm-and-say-its-reviewing-all-art); [Push Square](https://pushsquare.com/news/2026/03/artist-embroiled-in-marathon-art-theft-scandal-credited-as-visual-design-consultant))——这一事件对"复刻 Marathon 风格"的页面是最直接的警示：**风格可以致敬，图形必须原创**。贴纸 / 标签 / 海报式图形、阵营图标、Runner 剪影、飞蛾意象一律自绘，不以任何形式（含描摹、换色）搬用现成图形语言。

**优先使用该风格的原创资产。** 色块、几何地标、警示条、等宽标签、原创 SVG 图标、自制抽象循环短片与生成式声景都不涉及第三方版权；若需要"参考图"，用链接外引至 ArtStation / Behance / Gematsu 原页，不在站内托管。字体方面，KH Interference 是商业字体，需购买并确认网页嵌入许可 ([khtype.com](https://khtype.com/typeface/kh-interference/))；Durandal Grotesque 为 logo 复刻字体且许可为 personal use、要求署名，**不得**用于站点 ([designbeep](https://designbeep.com/2026/03/14/durandal-grotesque-font/))；仓库已自托管的 JetBrains Mono、Hanken Grotesk、Newsreader、Anton 是零风险起点。

**YouTube 嵌入只作为可见播放器。** 若要让访客听到官方 OST 或观看预告片，唯一合规路径是嵌入官方 YouTube 视频（如发售 MV [vtw5BDpKgJM](https://www.youtube.com/watch?v=vtw5BDpKgJM)）并遵守 YouTube API Services "Required Minimum Functionality"：播放器可见且 >50% 露出前不得自动播放、一页不得多于一个自动播放的播放器、视口至少 200×200 px、不得覆盖或修改播放器外观 ([Google Developers](https://developers.google.com/youtube/terms/required-minimum-functionality))——这在实践上排除了"隐藏 iframe 当背景音乐"。注意 Afflatus 的 e2e 夹具会拦截一切非 localhost 请求（`e2e/site-fixture.js:37-64`），YouTube iframe 需在测试环境中有占位 poster，且视觉快照会隐藏 `iframe`。

**库与音乐许可的红线。** GSAP 的免费许可是 Webflow 的专有 "Standard no-charge" 许可而非 OSI 开源，Webflow 保留全部知识产权并可在违约时终止 ([ScanCode](https://scancode-licensedb.aboutcode.org/gsap-standard-no-charge-2025.html))；audioMotion-analyzer 为 AGPL-3.0，闭源商业页面避免引入 ([GitHub](https://github.com/hvianna/audioMotion-analyzer))；Theatre.js studio 为 AGPL（仅开发期）([theatre-js/theatre](https://github.com/theatre-js/theatre))；Shadertoy `Ms23DR` 为 CC BY-NC-SA 非商用；Codrops 示例可商用但不得原样转售 ([codrops/CSSGlitchEffect](https://github.com/codrops/CSSGlitchEffect))。曲库方面，Pixabay 免署名但禁止再分发 ([Pixabay Terms](https://pixabay.com/service/terms/))，Uppbeat 免费层须贴 Credit ([Uppbeat](https://uppbeat.io/blog/royalty-free-and-copyright-free-music/uppbeats-music-licenses))，FMA / Togeo / clongclongmoo 需逐曲核对并避开 NC / ND ([FMA FAQ](https://freemusicarchive.org/FAQ))；Epidemic Sound / Artlist 的条款以视频 / 播客为中心，网页背景音用途须向官方确认。**法律上最干净的路线是 Tone.js（MIT）+ 自写 patch 的生成式声景**，它同时契合 "the hero is the world" 的演化式声景理念。

**页面文案的诚实标注。** 页面应有一行可见说明：这是对 Bungie《Marathon》视觉语言的独立致敬，与 Bungie / Sony 无关，所有图形与音频为原创；"Dieter Rams"、"Y2K"、"文字解码"等未在官方来源出现的描述，须以设计师归纳的口吻书写。

---

## 结论

把这份调研放在一起看，最有价值的发现不是任何单一效果，而是**Marathon 的识别度主要来自"约束"而非"炫技"**：有限材质、少渐变、平涂色块、三层字体的刻意冲突、颜色即信息——这些恰好是静态站最便宜、最能通过 Lighthouse 与 axe 的东西。真正的 GPU 需求（glitch、色散、扫描线）被 Bungie 自己限定在预告片与加载态，而不是常驻 HUD；网页复刻应保持同样的克制，把 glitch 做成入场一次、hover 触发、RM 可关的装饰层，而不是持续循环的背景。Afflatus 的 `design.md` 六宪章与 Marathon 的 Graphic Realism 在"每个元素是一台设备、每个读数绑真实状态、运动即信息"上几乎同构，这意味着这页不需要新的设计哲学，只需要一组新的 `--mt-*` token、一套 HUD 原语和一个 OGL 后处理 pass。

需要改变理解的一点是：**在网络可达之前，不要把任何"Marathon 原作如此"的说法写进页面文案或设计评审**。官网一行代码都没看到，色板是粉丝估值，字体识别来自未打开的页面，动效节奏没有任何文字来源。正确的下一步顺序是——先在允许网络的环境抓取 marathonthegame.com 与 Art Blast 页面校正 M1/M2 的初值，再跑一次 `npm run prebuild && npm test` 确认 Afflatus 当前基线，然后从 M0 开始按 P0 → P1 推进，每个 P1 模块都以 `?fx=` flag 起步并经站主真机验收后转默认。几个月后值得重新搜索社区的 shader / CodePen 复刻——游戏 2026-03 才发售、Bungie 2026-06 经历裁员，技术复刻生态尚未形成，但 Season 2 Art Blast 已显示艺术家仍在持续公开一手资料。
