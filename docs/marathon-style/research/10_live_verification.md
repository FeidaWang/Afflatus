# 第三轮核实：真实网页与本地文件（2026-11-02）

对 `HANDOVER.md` §4 的 8 类事项逐条复核。方法：本机 curl 抓源码、内置浏览器打开页面并读取计算样式、YouTube 故事板缩略图（1–10 s 间隔）与本地视频逐帧抽样；一部分文本类事项由子任务用 WebFetch / 公开 API 核对（原始记录见会话 scratchpad `subagent_fetch_findings.md`，关键结论已并入本文）。标记：【已核实】页面打开且与原说法一致；【已修正】页面打开但与原说法不一致；【仍未知】无法打开或页面不含该信息。

## 1 · 官网 marathonthegame.com（§4-1 / 2a）【已修正：此前一条都没看过，现已全部取得】

抓取 `https://www.marathonthegame.com/`（2026-11-02，HTML 436 KB）并在浏览器中实际浏览。

**技术栈。** Next.js（`/_next/static/chunks/…`，Turbopack 构建）+ Tailwind v4（`--tw-*` 变量、`animate-[marquee_16s_linear_infinite]` 任意值类）+ Contentstack CMS（图片 `images.contentstack.io`，视频 `assets.contentstack.io`）+ Google Tag Manager + OneTrust cookie 横幅。**没有** GSAP、Three.js、Lenis、OGL、Rive、Lottie（18 个 JS chunk 全文 grep 均为 0 命中；`framer` 仅出现在 Next 内部 id，`prefers-reduced-motion` 有 1 处 `matchMedia` 监听）。

| 项目 | 实际内容 |
| --- | --- |
| `<link rel="stylesheet">` | 仅 1 个：`/_next/static/chunks/0gtu6cc4cxdsl.css`（43 KB） |
| `@font-face` | `ttInterphasesPro` 400/700（回退 / 多语言）、`khInterference` 400、`ppFraktionMono` 400/500、`shapiro` 600、`marathonShapiro` 600；全部 `font-display:swap`，woff2 自托管：`KHInterference_Regular…woff2`、`MarathonShapiro_Wide65…woff2`、`Shapiro_55Middle…woff2`、`PPFraktionMono_Regular / _Medium…woff2`，`<link rel=preload>` 预载 |
| 字体角色变量 | `--font-display: marathonShapiro`（H1–H3、正文默认）、`--font-display-alt: shapiro`（Shapiro 55 Middle）、`--font-stylized-mono: ppFraktionMono`（导航、按钮、段落、`SEASON 2` 等 H3，15 px、全大写、字距 0.375 px）、`--font-decorative: khInterference`（`.text-detail` 细节文字 15 px）；日 / 韩 / 中 / 俄语言下全部回退到 ShoraiSans / ArialUnicodeMS |
| 字号变量 | `--text-detail-sm .75rem / --text-detail .9375rem / --text-body .9375rem / --text-heading-3 1.5rem / --text-heading-2 2.0625rem / --text-heading-1 2.625rem / --text-super-type 3.1875rem`；行高 `heading 85% / heading-3 90% / body 120% / super 80%` |
| 颜色 token | `--background:#000`、`--surface:#1c1c1c`、`--foreground:#fff`、`--foreground-muted:#717171`、`--primary:#c0fe04`、`--error:#f24723`；Season 2 区块以内联 `style="--primary:#5200FF"` 整段换成紫色 —— **"每段换主色"是官网自己的做法** |
| `<script src>` | 18 个 `/_next/static/chunks/*.js`（共 1.5 MB 未压缩） |
| `<video>` | SSR HTML 中无 `<video>` 标签，客户端挂载 2 个：hero `060126_MarathonTheGameHeroVideo_16x9_H.264.mp4`（1280×720，autoplay muted loop，poster `Hero_Video_Fallback_Image.png`，另有 9x16 竖版）与 Tau Ceti 段 `169-Tauceti-Desktop.mp4`（非自动播放，有 `916-Tauceti-Mobile.mp4`） |
| `<canvas>` | 0（官网没有 WebGL；WebGL 在子站 tauceti.world） |
| `@keyframes` | `news-dots-in/out`（opacity + scale 1.15→1）、`marquee`（translateX 0→-50%，16 s linear infinite，Nightfall logo 跑马灯）、`nav-reveal`（`clip-path: inset(0 100% 0 0)` → `inset(0)`）、`green-square-slide`（20 px 酸绿方块从 left 60px 滑到 `100vw-660px`，.8s ease-in-out，延迟 .5s，末尾淡出）、`content-appear`（opacity 0→1）、`cta-blink`（0/25/50/75% 处 opacity 0-1-0-1，即两次闪烁）、`teaser-slide-up`（translateY 100%→0，.6s ease-out，延迟 .9s） |
| 过渡 | Tailwind 默认 `transition-duration .15s`、`cubic-bezier(.4,0,.2,1)`；无 `mix-blend-mode`、无 `backdrop-filter`，`clip-path` 只用于 nav-reveal 与视觉隐藏 |

**布局。** 固定黑色顶栏 60 px：左酸绿 logo 方块 + 等宽大写导航（NEWS / CREATORS / STORE / REWARDS 带 `[↗]` 外链括号）+ 社媒图标；右侧酸绿 `BUY NOW` 大块。Hero 为左右分栏：左 3/4 自动播放视频，右 1/4 黑底竖排巨型 "MARATHON" 酸绿 logotype（图片）+ 等宽小字 "MARATHON / TAU CETI IV / ESCAPE WILL MAKE ME GOD" + 条形码式装饰；视频底部叠酸绿 teaser 块（黑字 "AVAILABLE NOW" 宽体标题 + 等宽说明 + 平台 logo + 黑底 `BUY NOW`）。其后依次：News 三卡（等宽日期 + 宽体大写标题）、Season 2 紫色区块（左侧竖排 "MARATHON NIGHTFALL" + 四张内容卡）、"FROM THE CREATORS OF HALO AND DESTINY" 超大白色宽体标题（约 60 px，行高 85%）、Tau Ceti 视频段（紫色线框地图 + 等宽数据块）、UESC Marathon 段、Death Dealers 段、Factions 段，每段一张 16:9 图 + 右下黑底文字卡 + `WATCH ON YOUTUBE ↗`；页脚为 1 px 网格线分栏（`(10) SOCIAL MEDIA` 编号列表，每项前有 `[≡]` 类括号图标），右侧一条 45° 酸绿警示条纹，底部 ESRB 与版权。

**Loader / 入场。** 刷新后：全黑 → 左上酸绿 logo 方块出现 + 20 px 酸绿小方块从左向右横扫顶栏（0.5–1.3 s）→ 导航以 `clip-path` 从左向右揭开 → 内容 `content-appear` 淡入 → hero 酸绿 teaser 块从底部上滑（0.9–1.5 s）；整个序列约 1.5 s，无进度条、无 glitch。

**Hover。** 导航链接：仅加下划线；`BUY NOW`：酸绿底变黑底 + 酸绿描边 + 酸绿字（颜色过渡 .15 s）；内容卡无位移、无缩放。**滚动**：原生滚动，无 smooth-scroll 库、无视差、无 scroll-driven 动画；News 轮播点用 `news-dots-in/out`。**页面过渡**：Next.js 客户端路由，无 View Transitions。

### 1.1 子站 tauceti.world/explorer【已核实（浏览器可开；curl / WebFetch 被 Vercel 429 拦截）】

Next.js（`?dpl=` Vercel 部署参数）+ **1 个 WebGL2 `<canvas>`**（2048×1536），`window.THREE` 不存在（打包后无法判断库）；字体 `PPFraktion`、`TaucetiworldSymbol`（私有符号字体）、`MarathonShapiro`；CSS 变量仅 `--lime:#c0fe04`、`--red:#f24723`；keyframes `slideUp / slideDown / fadeIn`；Plausible 统计。页面：酸绿顶栏 `TAU CETI IV` + 三个图标按钮；主体为**紫色（≈`#5200FF`）线框地球 + 橙色点云区块**，顶部刻度尺显示 `ZOOM 50% / X / Y / R 354°`；底部酸绿 `EXPLORE THE COLONY` 按钮，点击后出现三张区域卡 **PERIMETER / DIRE MARSH / OUTPOST**（紫色线框缩略图）。进入 `/explorer/Perimeter` 时的 loader 是**由密集紫色点阵 / 斜线网纹方块逐块填满**的硬切序列（约 1 s），随后呈现紫色线框地图 + 酸绿地名（`STATION`、`SOUTH RELAY`、`HAULER`）与罗盘刻度，底部 `FILTER` / `MAP/PERIMETER` 下拉。页面文字未出现 Kurppa Hosk 署名（Kurppa Hosk 案例页的本地视频 `TCW_*` 证明该站由其制作，见 §4）。

## 2 · 色板（§4-2 / 2c）【已修正：取得官方 hex】

| 来源 | 值 | 状态 |
| --- | --- | --- |
| 官网 CSS token（一手） | `#C0FE04` 主色、`#000` 底、`#1C1C1C` 面、`#FFF` 字、`#717171` 弱字、`#F24723` 错误 / 警示、`#5200FF` Season 2 主色 | 【已核实】 |
| tauceti.world | `--lime:#c0fe04`、`--red:#f24723`，地图线框为紫 | 【已核实】 |
| 本地官方 UI 截图取样（JPEG，偏暗） | 酸绿 `#AFE706–#B0E805`、青 `#02E8BA`、六属性色 `#DD4221 / #88A7BE / #E7AB3F / #8E79DE / #5DAE97 / #6583E7`、面板 `#121316–#1C1E22`、稀有度黄 `#C4B50B` / 紫 `#721E94` / 蓝 `#3884C3` | 【已核实】（详见 09 §3.1） |
| 本地场景截图取样 | Cryo 蓝 `#1821A5–#425BCB`、警示红 `#E40F17 / #E4234C`、Night Marsh 青绿 `#00C58D / #1CD228`、Dire Marsh 日光 `#7C7E38` | 【已核实】（09 §4） |
| 粉丝主题 Omarchy `#C2FE0B / #080A0E / #E8EDDF / #EA027E / #3601FB / #01FFFF / #FF5500` | 酸绿与官方 `#C0FE04` 仅差 2 级；底色官方为纯黑而非 `#080A0E`；前景官方为纯白而非米白；`#3601FB` 与官方 `#5200FF` 同族；`#01FFFF`、`#FF5500`、`#EA027E` 在官网不存在（洋红 / 青只出现在游戏画面与 Kurppa Hosk 徽章） | 【已修正】 |
| Art Blast 页面 | 文字自述 "stark color accents"、"Restrained palettes, purposeful accents"；页面本身是白底杂志页，无色板数值 | 【已核实】（文字） |
| Fonts In Use | 页面截图为黑底酸绿 UI，无 hex | 【已核实】（无数值） |

## 3 · 字体（§4-3 / 2c）【已核实并补齐】

- Fonts In Use 条目（Alex Nguyen，2026-06-21，agencies Bungie + Kurppa Hosk）原文：KH Interference Regular / Light 为 "primary typeface for headlines and display"；"A custom version of Shapiro Wide 65"，改动为 "serif for capital I, curved leg for capital R and serif for 1"；"IvyPresto Headline Regular, which is only used in-game"；"Fraktion Mono Regular and Medium is used for body text"；图注称 Codex 滚动文字未用改版 Shapiro；页面未指明 logo 用字。
- **官网字体文件直接证实**：`KHInterference_Regular.woff2`、`MarathonShapiro_Wide65.woff2`（即定制版）、`Shapiro_55Middle.woff2`、`PPFraktionMono_Regular / Medium.woff2`，另有 `ttInterphasesPro` 作多语言回退；官网**不加载 IvyPresto**（与 "only used in-game" 一致）。
- 官网角色分配（计算样式）：H1–H3 = marathonShapiro 700 全大写；导航 / 按钮 / 段落 / 小标题 = ppFraktionMono 500 15 px 全大写；KH Interference 只作 `.text-detail` 装饰小字。本地 UI 截图另见衬线标题（IvyPresto）与像素感数字读数（09 §3.2）。
- KH Type 页面：设计 Thomas Kurppa、Jakob Ekelund、Wille Larsson，2021–2022，Light / Regular / Bold 三字重，"monospaced typeface designed for display use"；按公司人数一次性付费，Web 许可按域名，试用免费（字体名含 TRIAL，不得上线）。
- 笔记中 "IvyPresto = The Ivy Foundry（Adobe Fonts 可用）"、"Shapiro = OGJ Type Design" 与 Fonts In Use 售卖链接一致【已核实】。

## 4 · 游戏内 / 官方视频的动效参数（§4-4 / 2b）【已修正：由无来源改为有时间戳】

### 4.1 视频归属更正

| 交接文档给的 ID | 实际上传者 | 官方替代 |
| --- | --- | --- |
| `X8z0WsYKm2k` Gameplay Reveal Trailer | **IGN**（2025-04-12，1:50） | 官方 **`uZRGDZCl9pg`** "Marathon \| Gameplay Reveal Trailer"（@MarathonTheGame，2025-04-12，1:50，137 万次观看）—— 故事板逐帧比对两者画面完全相同，时间戳可通用 |
| `f5TcwVlHnKU` Launch Gameplay Trailer | **XboxViewTV**（2026-02-19，2:25） | 官方频道同期视频为 "DEATH AWAITS \| Marathon Gameplay Trailer"（1:20）；其官方 ID 未取得（搜索只返回 GameTrailers `aUKsxnxKGjo` 与 IGN `og_zNZaRJ7U` 镜像）【仍未知】 |
| `KF24WS4MMC0` Launch Cinematic | **IGN**（2026-03-03，7:59） | 官方 **`vtw5BDpKgJM`** "In Death We've Just Begun ft. Poppy and Son Lux (Official Music Video) \| Marathon Launch Cinematic"（@MarathonTheGame，2026-03-03，7:59） |
| `HmSS0NI94Ro` Season 2 预告 | **PlayStation**（2026-05-26，2:19） | IGN 镜像 `rZUpiQgfeLo`；官方频道 ID 未取得【仍未知】 |
| `fjzmhROTv28` ViDoc | **@MarathonTheGame**（2025-12-15，22:56，70 万次） | 本身即官方【已核实】；描述含章节：Intro 0:00 / The world 1:33 / Gameplay intro 3:20 / Visual immersion 5:02 / Audio and music 6:52 / Zones 8:09 / Loot and weapons 12:44 / Runner shells 14:42 / Factions 16:55 / The Codex 18:44 / Marathon ship 19:57 / Outro 21:25 |
| 另取得 | 官方 "Gameplay Overview Trailer" `ZvJIQoWIQP8`；2023 公布预告 Antibody 版 Vimeo 830047787（Patrick Clair 上传，2023-05-24，1:35） | 【已核实】 |

### 4.2 时间戳（YouTube 故事板，Gameplay Reveal 为 1 s 一帧，其余 2–5 s 一帧，精度 ±1 帧）

**Gameplay Reveal Trailer `uZRGDZCl9pg`**（https://www.youtube.com/watch?v=uZRGDZCl9pg）

| 时间 | 画面 | 对网页的参数 |
| --- | --- | --- |
| 0:00–0:03 | 四段实机 + ESRB 白框（每秒硬切） | 硬切节奏 ≈1 s |
| 0:04 | 黑底居中 **紫蓝色（≈`#3A1FE0`）MARATHON logo**，字母带竖向拉伸 / 像素错位 | logo 入场为单帧出现，无缓动 |
| 0:05–0:06 | 黑底等宽小字 `WATCH ▮` → `WATCH THE FULL TRAILER NOW ▮`（紫色方块光标，逐词打出，四角有 `+` 标记） | 打字机 + 方块光标；约 1 s 打完 |
| 0:07–0:09 | 星球 + 青绿弧光，`BUNGIE` 酸绿 logo | — |
| 0:10–0:11 | 酸绿等宽大写 `FROM THE CREATORS OF HALO® AND` + 酸绿实心高亮条（光标）→ `…DESTINY®` | 文字块按行硬切，末尾带高亮条 |
| 0:12–0:38 | 实机，平均 1–2 s 一切；多处 1 帧的白闪 / 像素块闪 | — |
| 0:39–0:57 | **Runner 档案序列**：黑底酸黄色抖动剪影 + `DEATH LOG #1560` 等等宽标签（0:40–0:41）→ 洋红色姿势网格（0:42–0:43）→ 白色像素块溶解进人像（0:44–0:46）→ 酸黄 Bayer 抖动的大脸（0:47–0:49）→ 青色线框骨架 + 橙色 `__CHECK..%` 标签 + 水平狭缝条纹（0:50–0:53）→ 酸黄粒子头像消散（0:54–0:57）；每段 2–3 s 硬切 | **这是"Runner 选择 / 档案"视觉的权威参照**：单色抖动 + 等宽注记 + 2–3 s 硬切 |
| 0:58–1:14 | 实机（护盾破碎处为青色碎片飞散，1:03 左右） | — |
| 1:15–1:21 | 黑底酸绿宽体 `ESCAPE WILL`（1:16）→ `ESCAPE WILL MAKE`（1:18）→ `…ME`（1:20）→ `DARING_`（官方版；IGN 版为 `UNYIELDING_`）带酸绿高亮条（1:21） | 逐词叠加，每词 2 s，末词高亮 |
| 1:22 | 酸绿满屏 + 黑色像素块 + 黑字 `GOD` | 色块反转一帧 |
| 1:26 | 蓝色 Bayer 抖动头像 + 绿色像素块 | — |
| 1:27–1:30 | logo 三连：紫蓝实心 → 酸绿描边 → 酸绿实心（每帧 1 s） | **logo 收尾 = 3 次颜色硬切** |
| 1:31–1:32 | 等宽 `WISHLIST NOW ON ALL PLATFORMS ▮` | 打字机 |
| 1:38–1:40 | 酸绿 `COMING SEPT 23 2025` 黑底 + 平台卡 | — |

**Launch Gameplay Trailer（XboxViewTV 镜像 `f5TcwVlHnKU`，2 s 一帧）**：0:08–0:10 Bungie logo；2:06–2:10 画面以**酸绿 ASCII / 字符抖动**溶解（2:08 整屏字符矩阵，2:10 竖线刻度）；2:12 紫蓝像素条纹；2:14 **酸绿 MARATHON 横排 logo**（下方等宽小字 `▮▮▮ ✕ ▢ 28 93 ⌗`）；2:16–2:20 `SERVER SLAM / OPEN_PREVIEW WEEKEND* / FEBRUARY 26` → `FEBRUARY 26 – MARCH 2`，右侧竖排 MARATHON；2:22 字符雨溶解；2:24 `LAUNCH / MARCH 5 2026`。**结论：官方 logo 出场 = 字符 / 像素溶解 → 硬切出 logo，没有缩放或淡入。**

**Launch Cinematic `vtw5BDpKgJM`（5 s 一帧）**：0:00–7:35 为实拍风格 MV（青绿 / 琥珀夜景），7:40 酸绿满屏 + 黑色 MARATHON 横排 logo，7:45 酸绿底黑字演职员 `HARMONY KORINE / SAM GOLDWATER / SON LUX / POPPY`，7:50–7:59 黑底酸绿字符噪点矩阵逐步散去（出场转场同样是字符抖动）。

**Season 2 预告（PlayStation 镜像 `HmSS0NI94Ro`，2 s 一帧）**：全片青绿 Night Marsh + 红色 Sentinel；2:00–2:03 **紫色（`#5200FF` 级）满屏 + 黑色 MARATHON 字从右向左整幅滑入**（2 s 内走完）；2:04–2:06 黑底紫色 `NIGHTFALL` 字样带像素位移 glitch + `JUNE 02 2026`。

**ViDoc `fjzmhROTv28`（10 s 一帧）**：章节标题（如 8:09 `OUTPOST`）为黑底酸绿等宽字 + 红色 / 青色色块，画面间穿插红 / 酸绿单色调的 UI 特写；0:30–0:50 的开场 logo 段为红底黑色竖排 MARATHON（与官网 Season 2 竖排一致）。

### 4.3 本地品牌视频的精确节奏（可直接作为参数，见 09 §2）

- 字符落位进场 / 散落退场：0.3–0.4 s，`steps()`，停留 4 s（Kurppa Hosk 引言模块）。
- 版式切换硬切：0.25 s / 帧（广告版式演示）；徽章换图 ≈0.1 s。
- 3D 展示：4.9 s 匀速慢旋转 ≈40°，无缓动。

### 4.4 游戏内 UI 动效（Shell Select 等）

本地 Shell Select 截图证实菜单写真层使用 **像素块位移 + RGB 分离 + 水平狭缝 + 细扫描线** 的 datamosh 式处理（静帧可见），即 help center 所说 "animated background layers"；护盾破碎在预告片 1:03 左右表现为**青色碎片飞散**，HUD 整屏染色在故事板分辨率下不可辨认【仍未知】；ADS 路标淡出、加载循环（飞蛾）在以上视频中均未出现清晰帧【仍未知】。

## 5 · 「文字 scramble / ticker / 涂黑条 / 声音响应 UI」是否存在（§4-5 / 2e）

| 元素 | 结论 | 证据 |
| --- | --- | --- |
| 文字 scramble / decode | 【已修正】**官方品牌动效存在"字符落位 / 散落"与"字符矩阵溶解"**（Kurppa Hosk 引言模块；Launch Gameplay 2:06–2:22、Launch Cinematic 7:50；Gameplay Reveal 0:05 打字机光标），但都不是"乱码字符替换成正确字符"的经典 scramble；游戏内菜单未见 | 09 §2；§4.2 |
| 滚动 ticker / marquee | 【已核实】官网 Season 2 区块有 `marquee` 16 s 线性无限跑马灯（Nightfall logo 重复）；游戏内未见 | §1 |
| 涂黑条（redaction） | 【仍未知】官网、tauceti.world、6 张 UI 截图、5 支视频故事板中均未见涂黑条；Gameplay Reveal 0:10 与 1:21 的"实心高亮条"是光标 / 强调，不是涂黑 | — |
| 声音响应式 UI | 【仍未知】所有来源无音频驱动视觉的迹象；ViDoc "Audio and music" 章节（6:52–8:09）故事板帧为访谈与实机 | — |

因此路线图 M6 的 scramble 可以改为"字符落位 / 字符矩阵溶解（官方品牌动效）"，ticker 有官网先例；涂黑条与声音响应 UI 继续标注"风格推演"。

## 6 · ArtStation / Behance / 工作室页面归属（§4-5 / 2d）【已修正多条】

通过 ArtStation 公开 JSON（`/projects/<id>.json`、`/users/<name>/projects.json`）读取标题、作者、发布日期与描述：

| 链接 | 实际标题 | 作者（职位） | 发布 | 备注 |
| --- | --- | --- | --- | --- |
| 8vWb16 | Marathon - early pinwheel | **karakter**（官方号） | 2026-06-18 | 12 图；Team 署名 Floris Didden、Nils Carstens、Christoph Stryczek、Nikodem Malec、Jonas Ellermann、Josephine Pallus、Josef Stängl、Graphic Designer Tom Probert |
| ndwNN6 | MARATHON - mothership | karakter | 2026-06-22 | — |
| 5eneng | Marathon - trailer | karakter | 2026-06-18 | "A few of these designs made the jump all the way into the Cinematic Short Story Trailer" |
| BaoXOm | Marathon - graphic realism | karakter | 2026-06-18 | 16 图，tag graphicdesign —— 标题本身使用 "graphic realism" |
| 31l1ag | Marathon - hallway | **karakter**（非 Tom Probert 个人号） | 2026-06-18 | 【已修正】 |
| P4a6R1 | Marathon - Tau Ceti IV | karakter | 2026-06-18 | 星球与大气 |
| KR639X | Marathon - engine | karakter | 2026-06-18 | — |
| rl5AYE / NqYxx5 | Marathon \| Dire Marsh \| Intersection / Algae Ponds | **Dylan Teter（Environment Artist）** | 2025-05-08 | 【已修正】不是 Karakter；Algae Ponds 为 "algae research and processing facility" |
| WXxqY2 | MARATHON \| Reveal Cinematic Short \| BUNGIE | **Jimmy Reina（Illusorium 环境组）** | 2025-04-19 | 【已修正】 |
| 0aYLZ4 | Marathon - Outpost interior early exploration | Nikodem J. Malec（Karakter 成员个人号） | 2026-06-23 | — |
| Ov22Nb | Marathon - Cryo Archive - Panopticon | Eve Astra（Staff World Artist, Bungie） | 2026-06-18 | Panopticon 由 Goryainov 概念、Astra 实装 |
| gwgwwQ / wOAOP5 / O3q3vk / O3q3ay | UESC Grenadier Elite / Grenadier Warden / Rocket Drone / Recon | Tobias Kwan（Marathon Senior Concept Art Lead） | 2026-06-18 | Kwan 名下另有 UESC Assault Commander **lE1ERe**、Sniper Commander KR6RJo、Ghost Commander yA0AAQ、Recruit 8vWvbQ、Sentinel 8vWv1R、Rook 0l1NwV、Runner Deathbox dLJLgW、Durandal gwgwAm 等 28 条【已补齐】 |
| Nq9dkP / a0KzV0 / wrDRbg / EzlxmA / oJnLoz | Misc Graphic Design / UESC-Cryo Graphic Design / Arachne Brand and Charter Design / Ares / Cryo Archive Hub | Dima Goryainov（Senior Concept Art Lead） | 2026-06-18 | 另有 Cradle **wOJeng**（2026-08-27，"Design and graphics for the Cradle lobby area in Season 2"）、Outpost Pinwheel x3W5P4、Perimeter Relay 8BQJnE、**Perimeter Regional Branding 3ERJ4v**、Reusable Memorial Markers Bkxr5m、Outland / Zeus / Magnum 贴花表、Vulcan bg6EWk、Assassin Shell 1NdJV2；"throne scenes" 为 Destiny 2 条目（nE6941），与 Marathon 无关【已修正】 |
| ndwJP4 / EYqzWn / dLJgQW / a0KKbL | Marathon concept art（Quarantine 2022 / 充气走廊 / pinwheel 2023 草图 / 早期探索） | Sigurd Fernstrom（独立） | 2026-06-18～20 | 另有 tranquility room G1OEzV、thawing pools 8vWao6、Dire Marsh 帐篷 o0XWlO 等共 10 条；描述注明 "Art Director Joseph Cross" |
| 0aYXw5 / V8o23Z | Marsh Aerial Bio Research / Doors & Hallways | Patrick Bloom（Concept artist at Bungie） | 2026-06-18 | **Marsh Props kwEDql、Marsh Props 2 Jwa9LD、BRRT SMG 5enXkw** 单页 URL 已取得【已修正】；另有 Thief NrwxWD、Thief Drone 0aYnG4、D54 Battle Pistol RqEKNE、V22 Volt Thrower La53Kv、Triage Support Baokn9 等 23 条 |
| BkxxRD | Marathon | West Studio（官方号） | 2026-06-18 | 指向 weststudio.com 两个项目页 |
| O3vRBv / 1LxE9X / JweyBn | MARATHON.key_art("Recon" / "Assassin" / "Thief") | Jeremy Hanna | 2026-10-15 / 09-08 / 09-03 | 描述：与 Art Director Joseph Cross、Marketing Creative Director Garrett Morlan 合作，建模 + 渲染生成 key art |
| BkabvA / WXdZlD / rJW3XG | Marathon Thief / Marathon Stealth / MarathonTheGame | joseph cross（Art Director & Artist） | 2024-10-28 / 2024-10-28 / 2023-05-26 | — |
| RKkkOA | Crash Casket Vandal Skin Concept | Kejun Wang | 2026-06-18 | 另有 **Cyber Red Destroyer Skin Concept rlbb46**（Cosmetic Art Lead darrenbacon）—— "Cyber Red" 皮肤名出处【已修正：在 Kejun Wang 而非 daniol】 |
| mAGON9 / oJK4Zz | Marathon Cinematic Trailer | George Varodi | 2025-12-26 / 2025-05-07 | Mielgo 短片 animatic / storyboard |
| L2Ak3v / Dxg9X9 | Recon Number 54 / UESC Marathon | Garrett Post | 2020-04 | **粉丝向旧作（2020），非本作资料**【已修正】 |
| Y8LJvV | Marathon World Art | Charles Jacobi（chukker，Principle Environment Artist） | 2026-06-19 | 20 张四区域实机截图 |

工作室与个人站点：

- **karakter.de/marathon**【已核实】：标题 "marathon 2023 – 2025 \| © BUNGIE"，团队同上并加 Producer Robert Auls；章节 THE MARATHON（Deimos 改造殖民船）、THE PINWHEEL（"deployable habitat modules known as Pinwheels"）、EARLY PINWHEEL、PERIMETER（"outer edge of New Cascadia…relay stations, geological observatories"）、DRONEBAY、BARRIER、GRAPHIC REALISM。
- **weststudio.com**【已核实】：World Design（Client Bungie，Year 2023-2024，Environment Concepts / Prop Design）；Seasonal Content（2023-，"Weapon Skin Concepts, Character Skin Concepts, Illustration, Key Art"，提到 charms、stickers、emblems、backgrounds 与 Shop 预览插画）。
- **daniolart.com/marathon**【已核实可开】：Squarespace 图库页，仅 "View fullsize" 缩略图，无文字描述；本地 4 张 `daniel_*.jpg` 即出自此页。
- **Behance Rigley 205038723**【已核实】："ANTIBODY \| INTERFACE DESIGN + ANIMATION, 2023"，导演 Patrick Clair & Raoul Marks，Rigley 负责 "screen graphics and glitch content"、"graphics, interfaces, and AI avatars"，并 "developing a stylization for the color blocking and glitch effects that would serve as the backdrop"；Spaceship Paul Chadeisson、Storyboards Lance Slaton、Edited Arielle Zakowski、音乐 Justice "Heavy Metal" SebastiAn remix。Vimeo 830047787 oEmbed：标题 "Bungie Marathon Announcement Trailer"，上传者 Patrick Clair，2023-05-24，95 s。
- **Behance Klaverweide 249802247**【已修正日期】：Published June 26th 2026；"PROJECT MADE FOR SUPERPOSITION"；工具 Illustrator / Photoshop / Figma；描述 "Bungie reached out… to contribute to the Runner Shell ability/trait icon needs"。
- **Behance Fleisher 179474213**【已核实】：Bungie Creative Studios 2023 内部 ViDoc 动态包，与 Garrett Morlan 及外部团队 MOTHER 合作；"paneled approach" 让少量概念图讲完整故事；团队 Kennon Fleisher（Lead）、Ryan Policky、Adam Schmisek。
- **Behance Kecman 229699531**【已修正】：页面已不存在（404 "Oops! We can't find that page."），从素材清单移除。
- **Art Blast**【已核实】：2026-06-18，署名 Brian Vinton & Jason Sussman；原文新增要点 "make weird cool"、"product design realism, graphic design boldness, and… Marathon weirdness"、"intentional negative space, and playful visual systems"、"Restrained palettes, purposeful accents, and clear material relationships"；名单含 Dima Goryianov（页面拼写）、Patrick Bloom、Tobias Kwan、Sigurd Fernstrom、Karakter、West Studio（Gabe Zamora / Gina Vila / Ivan Rastrigin）、Art Bully、Pipeworks Studios 等。
- **Kurppa Hosk 案例页**【已核实】：自 2021 秋起为 lead creative agency；交付包括 "Design of in-game faction identities and world-building fidelity graphics"、"Tech development, engineering and creative coding"；Credits：Faction Cinematics Antibody TV；Key Art / Shell Renders Jeremy Hanna, Bungie Creative Studios；Launch Cinematic Harmony Korine, Poppy, Son Lux, EDGLRD；**Marathon Logo: Bungie, PlayStation Studios Creative**；Reveal Cinematic Alberto Mielgo, Pinkman TV；Supplementary Gameplay Dark Burn Creative。页面视频文件名含 `MTG_website_03.mp4`、`TCW_03.mp4`、`Podium_type_detail_v3.mp4`、`Marathon_Sizzle_Reel.mp4`。

## 7 · 使用条款（§4-6 / 2c）

- press.bungie.com/Marathon【已核实清单，条款仍未知】：11 个媒体包（4/12/2025 Gameplay Reveal 299 MB、12/15/2025 December 197 MB、1/15/2026 Runner Shell Dev Insight 70 MB、1/19/2026 pre-order 141 MB、2/12/2026 State of Play 178 MB、2/25/2026 Server Slam 110 MB、3/19/2026 Cryo Archive 679 MB、5/14、5/19、5/27/2026 Season 2 launch 513 MB、7/21/2026 mid-Season 2）；站内**没有任何 Terms / Usage / Legal 链接**，只有版权声明。
- Bungie IP 政策【已修正 URL】：有效页面为 help.bungie.net 文章 360049201911 "Intellectual Property and Trademarks" 与 bungie.net/7/en/Legal/IntellectualPropertyTrademarks：支持 "non-commercial content"，"nothing in these guidelines should be interpreted as permission to use Bungie intellectual property"，视频需 ≥20% 玩家创作、勿上传预告片；Terms of Use "Game Content Usage Rules" 要求 "non-commercial, unless you obtain Bungie's prior written permission"。未单独提 fan site 或截图。
- Steam【已核实】：订户协议 §6 的 UGC 授权只给 Valve；社区截图页无需登录、总数不显示。
- 结论不变：**不托管任何官方图像 / 音频**，YouTube 只作可见播放器。

## 8 · OST、预告片与 ViDoc 配乐（§4-7 / 2f）

- Vol. I【已修正】：29 轨（非 24）、约 54 分钟，7–24 轨依次为 Repetition Is Where We Find the Truth / We Shouldn't Be Here / For Those Who Did Not Wake / Stars That Bleed / Reintegration Protocol / Focused Erasures and Sub-routine Resets / Staring Blindly Through the Keyhole / Poetry in Ones and Zeroes / Cascadial Flow of Ethereal Wonder / It Wasn't a Dream / Purge / System Designed to Die / We Stole a Moon / Contrition / We're All Monsters / Shimmering Cadence of Dancing Light / In Death We've Just Begun / Code Race (Brendan Angelides Remix)；25–29 为 Decontamination Protocol / Conversation with the Infinite Self / Only Numbers and Letters / We Planned for Everything / Deprecated Systems（iTunes Lookup id 1877959843、Discogs API 36703786、MusicBrainz）。
- Vol. II【已核实】13 轨约 98 分钟；"42 tracks" 出自 NME 而非 Bungie 文章。
- Spotify【已核实】：Vol. I `https://open.spotify.com/album/3PxrdoRPGfXE3M4TUx6V51`，Vol. II `https://open.spotify.com/album/5fDpe41gXq2L5awuWlnrmL`。
- Gameplay Reveal 配乐【仍未知】（官方与 IGN 描述均无署名）；ViDoc 配乐【仍未知】；Mielgo 短片用 Bach "Adagio"（Concerto in D minor）为导演自选（Cartoon Brew 2025-05-21 采访），BWV 974 编号为推断；Annecy 条目作曲署名 Ryan Lott，时长 8:43。

## 9 · 教程与库数字（§4-8 / 2g）

- GSAP【已核实】：3.13（2025-04-29）起全部免费，许可 "Standard 'No Charge' GSAP License"（2025-04-30 生效）；官网无体积数字；unpkg 3.15.0 实测 gzip：core 27.7 KB、ScrollTrigger 17.6 KB、SplitText 3.6 KB、ScrambleText 3.9 KB（Bundlephobia 26.7 KB）。
- Lenis【已修正】：官网 lenis.dev 称 "under 5kb"，实测 1.3.27 gzip 5.4 KB；MIT；Safari 60 fps 上限、iframe 失效等限制为 README 原文。
- OGL【已核实】：Unlicense；README 表 Core 8 / Math 6 / Extras 15 = 29 kb minzipped（Math 段落另写 8 kb，自相矛盾）；npm 1.0.11。
- Codrops【已核实】：dithering 文章 2025-06-04 Niccolò Fanton，4×4 Bayer，Three.js + postprocessing，仓库 MIT，无 WebGPU；Efecto 2026-01-04，5×7 程序化 ASCII、误差扩散抖动、WebGPU + Canvas 2D 回退，无仓库 / 许可证，作者未署名；CSSGlitchEffect 无 LICENSE 文件，README 允许商用集成、禁止原样转售；CrosshairDistortion / MagneticButtons / CSSMarqueeMenu 均 MIT。
- CodePen mErPAK【已核实】存在，"Text Scramble Effect"，字符集 `'!<>-_\\/[]{}—=+*^?#________'`。

## 10 · 未关闭事项汇总

| 事项 | 状态 |
| --- | --- |
| "DEATH AWAITS" 与 Season 2 预告的官方频道视频 ID | 仍未知（只找到 IGN / GameTrailers / PlayStation 镜像） |
| Gameplay Reveal、ViDoc 配乐 | 仍未知 |
| 游戏内 HUD 整屏护盾染色、路标淡出、飞蛾加载循环的清晰帧 | 仍未知（需本机播放视频逐帧，故事板分辨率不足） |
| 涂黑条、声音响应 UI | 未见任何来源，继续标"风格推演" |
| press kit 使用条款 | 站内不存在；以 Bungie IP 政策的 non-commercial 原则为准 |
| Perimeter / Outpost 在本地截图中的归属 | 未证实（tauceti.world 区域地图可作参照） |
| tauceti.world 的渲染库与是否由 Kurppa Hosk 制作 | 打包后无法判断库；Kurppa Hosk 案例页视频文件名 `TCW_*` 为间接证据 |
