# Urgent — horoscope.html 紧急改造清单（2026-07-10 立项）

## U41 · signal.html 编辑部式重构（借鉴 Accenture，2026-07-17 立项）

**风格裁决**（提问工具中断，按推荐路线先定、备选留翻案口）：Accenture 的**版式骨架**与它的**黑白纸面配色**是可分离的两层——本项取骨架（超大扁平标题/章节化留白/滚动叙事/sticky 章节导航），弃纸面（保持全站深色双色温令牌，signal 仍是 U27d 分层里的「作战情报室」）。**备选路线**：若站主更想要 Accenture 本尊的高对比黑白编辑部风做刻意反差，翻案成本 = 本项的令牌层单独换一组（结构不动），实施前说一声即可。

### 41a · 借鉴提取（Accenture 三件当家本领 → 本站落地）

| Accenture 元素 | signal 落地 | 实现 |
| --- | --- | --- |
| 超大扁平标题（8vw 级 display 型，动词短语） | 每章一个大标题：眉题 kicker 小字 + `clamp(2.4rem, 7vw, 5.5rem)` 扁平粗标题（Rajdhani/Orbitron 现役字体，零投影零描边=扁平化） | 纯 CSS，`@layer components` |
| 章节化编辑排版 + 大留白 | 全页重排为 4 章（下详），节距加倍、每屏一个主题、正文行长 ≤68ch | 纯 CSS |
| 滚动叙事（渐现/计数/sticky 导航） | IO 渐现（复用 U31 同款 stagger）、关键数字滚动计数一次、左缘 sticky 章节轨（01–04 点击平滑滚动、当前章高亮）、顶部阅读进度条（CSS scroll-timeline，U30 R2 基建） | IO + 原生 CSS，零新依赖 |

### 41b · 章节信息架构（现 DOM 重排，数据零改动）

- **Hero**：超大扁平标题 +「首屏一句话结论」= 鹰鸽罗盘当前读数直接做副题（HAWKISH +1.2 级大字）；下一次收容测试倒计时保留但收窄为 hero 底部一行。
- **Ch.01 罗盘**：gauge 放大为全宽章节主角，读数用超大数字；滚动进入时指针从 0 一次性摆到真值（IO 触发，RM 直出）。
- **Ch.02 五支柱**：pillarGrid 改编辑部大卡——每柱大号状态字 + tone 色点，hover/点按展开 detail（宪章⑥两层披露）。
- **Ch.03 事件档案**：incident log 升级为大字号视差时间轴（**U30 R4 并入本项**，不再单列）；事件卡共享元素展开沿用 R1 已上线机制；**新增实用控件**：按支柱/等级（keter 等）筛选的 chips 过滤器。
- **Ch.04 Fable sector calls**：卡片化保持，排版对齐新章节语言。
- **SCP 人格处置**：CLASSIFIED 水印与环境音 dock 保留（页面人格，音频本就 opt-in 点击制符合 U27d），但视觉降噪让位于新排版。

### 41c · 可读性与纪律

- 正文最小字号 17px、标题层级 ≤3、对比度 AA 复核（U21 Phase 3 同线）；全部动效只用 transform/opacity + `prefers-reduced-motion` 静态；新样式只进 `@layer tokens/components`（U30 硬规则）；`!important`/bundle 基线不动。
- [x] 施工（一个会话）：41b 重排 → 41a 动效 → 41c 复核；vitest/build 全绿后推送。✅ 代码已完成（2026-07-18）
- [ ] 站主真机验收：大标题气场、章节轨手感、指针摆动、筛选 chips、移动端单列排版。

**实现记录**：

- **`@layer` 例外**：`signal.css` 是独立于 `src/styles.css` 主级联层体系之外的单页样式表（与 `sectors.css` 同一架构，早前会话已就 sectors 确认过这一豁免），本项新样式沿用同一先例，不套 `@layer`。
- **41b 重排（DOM，数据零改动）**：`.signalScroll` 拆成 `.chapters` 容器 + 四个 `<section class="chapter" id="ch01..04">`；`.review`（倒计时独立分区）整块折入 hero 的 `.heroCountdown` 一行，鹰鸽罗盘读数新增 `.heroRead`（`#heroHdLabel`/`#heroHdScore`）做首屏一句话结论。**`.files` 归属判断**：计划文本未点名它归哪一章，按"原作者已经把它放进 `.signalScroll` 叙事容器里、和 pillars/incidents/watch 同级"的既有边界，把它折进 Ch.02 作为「Supporting Files」子区（`.subhead` 组件），`.mtf`/`.dock`/`.foot` 维持原样留在 `.chapters` 外（页面收尾 chrome，原本就不在叙事容器内）。
- **U30 R4 拆除**：罗盘的 `position:sticky` 钉住机制（旧版"指针固定、其余内容从下面滚过"）与章节化叙事互斥——每章现在都要完整滚过一屏，删除 sticky，改用左侧 `.chapterRail` 做"我在哪一章"的替代锚点。
- **41a 动效**（IO + 原生 CSS，零新依赖）：
  - `.reveal` 渐现：四个 `.chapterHead` + 四张 `.file` + 六张 `.asset`（静态卡）挂 `.reveal`，共享一个 IntersectionObserver（once+unobserve，threshold .2，`transitionDelay=(i%6)*70ms` 错速）。**`.pillar` 卡未挂 `.reveal`**——它是 `renderPillars()` 每次 fetch/切语言都会整体重绘的动态卡，若也接渐现需要在每次重绘后重新挂观察器，复杂度换不来明显收益，按「Simplicity First」跳过。
  - 顶部阅读进度条 `.readProgress`：`@supports (animation-timeline: scroll())` 原生 CSS scroll-timeline，不支持的浏览器直接不显示（渐进增强，不用 JS 兜底假造）。
  - 左侧 `.chapterRail`：一个 IntersectionObserver 观察四个 `.chapter`，`rootMargin:'-40% 0px -55% 0px'` 让"当前章"在视口中段时才判定为活跃；点击链接 `scrollIntoView`，`prefers-reduced-motion` 时退化成 `behavior:'auto'`。
  - 罗盘指针扫入：`.needle` 默认钉在 `left:0%`（DOVE 端），`#ch01` 的 IO 首次进入视口时置 `window.__signalSweepNeedle=true` 并广播 `signal-needle-sweep` 事件，`renderCompass()` 只有这个旗标为真才把 `left` 写成真实百分比（CSS `transition:left 1.1s` 顺势画出"从 0 摆到真值"）；`prefers-reduced-motion` 直接把旗标置真，摆动退化成瞬间到位。gauge/`.hdReadout` 数字同步放大（`clamp(2.2rem,6vw,4rem)`）呼应"全宽章节主角"。
  - 文件卡百分比数字滚动计数：复用既有 `src/ui/viz.js` 的 `animateCountUpFromText`（新增一个 `<script type="module">`，构建后与 sectors.html 共享同一个 `viz-*.js` chunk，零重复代码/零新依赖），7 个百分比 `<b class="countup">`（O5 DIRECTIVE 3 个 + SEPTEMBER CUT TRACKER 4 个）各自挂一个 IO，滚入视口即算一次，`animateCountUpFromText` 自带 `prefers-reduced-motion` 直出。MTF THREAT BOARD 卡的 `<b>` 是文字状态词（HOT/CRACKING 等），不是数字，未加此类。
  - **Ch.02 两层披露（宪章⑥，计划文本明确要求）**：`renderPillars()` 模板新增 `.detail`（包着 `.read`/`.asof`）默认 `max-height:0;opacity:0`；`:hover`/`.open`/`:focus-visible` 展开。点击/Enter 切换 `.open`（`OPEN_PILLARS` Set，写法与既有事件卡 `OPEN` Set 同一模式），确保触屏和键盘用户拿到与鼠标 hover 相同的信息（22c 铁律：hover 专属信息零容忍）。
  - **Ch.03 筛选 chips**：`#incidentFilters` 渲染 ALL + 5 个支柱 chip + 3 个等级 chip（euclid/keter/safe，复用既有 `CLASS_LABEL`），单选，点击重渲染 `#incidentList`（沿用既有 `OPEN` 展开状态，不受筛选影响）；筛选数据零新增——`signal-events.json` 的 `events[].pillar`/`events[].class` 字段本就存在（已用 `python3` 核实：5 条事件用了 pillar 1/2/5、class euclid/keter，暂无 safe，但渲染/筛选逻辑同样支持，为将来自动化流水线新增的 safe 级事件预留）。
- **标题层级**：全站仅 h1（hero）/h2（章节标题 + `.file h2` 卡头）/h3（`.pillar h3`/`.unit h3`），核实符合"≤3"要求，未改动。
- **对比度**：本项未改任何颜色令牌，对比度基线沿用既有已验证结果，未重新走一遍审计。
- **验证**：676/676 vitest（无回归，本项未新增/修改任何 `.test.js`）；`vite build` 干净（`signal.html` 52.07 kB/gzip 17.36 kB；`viz-*.js` 共享 chunk 命中，未产生重复代码；已知的 course.html parse5 警告与本项无关，未见新增警告）；`grep -c '!important' public/styles/signal.css` = 0，与改动前一致；跑了一遍脚本核对新增标签用到的每个 class 在 `signal.css`/共享样式里都有落地，且确认 `.review`/`.signalScroll`/旧版裸 `<h2>` 选择器（`.compass h2`/`.pillars h2`/`.incidents>h2`/`.watch h2`）已全部清除，无残留死代码。

## U40 · games.html 补决赛/季军赛数据 + 改 WC26 官方配色 ✅ 代码已完成（2026-07-18，站主指令）

**站主指令**：更新剩余决赛和三四名决赛的赛程·赔率·预测；最下方赛程表遗失了三四名决赛；主配色改为背景 #1B2766（藏青）+ 点缀冠军金 #9F7D23 + 文字主要白色。

- [x] **数据核实**（WebSearch 核实真实赛果，非编造）：半决赛西班牙2-0法国、阿根廷2-1英格兰均已在 `games-data.json` 中正确记录。三四名决赛：法国 vs 英格兰，7 月 18 日 17:00 ET 迈阿密 Hard Rock 球场；决赛：西班牙 vs 阿根廷，7 月 19 日 15:00 ET 新泽西 MetLife 球场。赔率：三四名法国-110/平+280/英格兰+280（FanDuel/bet365）；决赛西班牙+125/平+200/阿根廷+260（DraftKings）。
- [x] **`fixtures` 赛程卡补齐**（之前是空数组 `[]`，「赛程·赔率与预测」整块等于没内容）：加入三四名决赛与决赛两张赛程卡，含 Fable 预测胜方+置信度+推理、真实赔率 1X2 换算、比分刮刮卡。
- [x] **`bracket.third` 新增 + `bracketModel.js` 支持三四名决赛**（+2 vitest，共 11 条）：季军赛不像 QF/SF/F 是「上一轮胜者晋级」推导出来的，是直接的一场比赛（SF 双败者对阵），模型按 leg 同款字段直接建模；阶段顺序 R16→QF→SF→**季军赛**→决赛（符合真实赛历，季军赛在决赛前一天）。U38/U39 的滑杆、缩放三档、+/− 兜底全部自动适配新阶段，零改动。
- [x] **WC26 官方配色**（`public/styles/games.css` `:root` 令牌 + 全部字面量 rgba/hex 一并替换，token 架构使这次改版可以只改一处 `:root` 驱动全站）：`--bg:#1B2766`（藏青）、`--panel/--panel2` 按明暗分层的藏青色阶、`--ink:#fff`（正文/标题主白）、`--mag:#9F7D23`（官方冠军金，主强调）、`--cyan`/`--yellow` 改为更亮的金色调 `#D4AF37`（互动态/标题，与 --mag 深金形成层次）、`--line` 改金色描边、`--dim` 改浅蓝白灰。所有原本写死的品红/青色 rgba 字面量（背景光晕、发光阴影、卡片描边等）同步换算为金色 rgba；原本贴近纯黑的卡片内衬色（`#0a0818` 等三种）统一并为一个深藏青 `#141C56`，与新背景形成正确的层次对比；`.hero h2` 的玻璃故障文字投影特意改成「金+白」双色（而非金+金），保留故障特效的视觉张力同时呼应「文字主要白色」；`games.html` 的 `theme-color` meta 同步改为 `#1B2766`。
- [x] 验证：676/676 vitest（+2）、tsc 干净、`validate-data.mjs` 全绿、构建干净（games 分片 16.87→17.29 kB / gzip 7.01→7.16 kB）、`!important`/bundle 预算基线不动；parse5 两条警告与前几次一致（U37 遗留，非本项）。
- [ ] **站主真机/浏览器验收**：藏青+金配色整体观感、金色文字在小字号下的可读性（尤其 `.dim`/`.rlog` 等次要文字）、赛程卡的决赛/季军赛倒计时与刮刮卡是否正常。

## U39 · games.html 淘汰赛滑杆加苹果多点触控双指缩放 ✅ 代码已完成（2026-07-18，站主指令：双指放大展示具体场次/缩小展示更多场次）

**站主指令转译**：「手指放大自动延展展示具体场次，缩小扩大展示更多场次」= 在 U38 的阶段滑杆之上加一层语义缩放（semantic zoom）：双指外张 = 放大看单场详情，双指内收 = 缩小看全部轮次概览（更多场次同屏）。三档：总览（ZOOM_TREE，缩小）↔ 轮次（ZOOM_STAGE，U38 默认滑杆）↔ 单场（ZOOM_MATCH，放大）。

- [x] **纯函数层** `src/lib/pinchZoom.js`（+9 vitest）：`pointDistance`（两指间距）、`nextZoomLevel(level, scaleDelta, threshold)`（带阈值防抖的三档状态机，正=张开=放大，负=捏合=缩小，两端夹紧）、`wheelScaleDelta`（桌面触控板 ctrl+wheel 的 deltaY 符号归一化，与触摸同一套状态机）。
- [x] **总览档**（新增 `renderKoTree`/`.ko-tree-*`）：全部轮次横向并列，每轮一列紧凑单行比分 chip（旗帜+3 字码+比分），一屏看到 R16→QF→SF→F 所有已进行场次；点一个 chip 直接跳到该场的单场详情档。
- [x] **单场档**（`renderKoCard` 加 `big` 选项 + `.ko-card.big`）：卡片放大居中，字号加大，日期/球场/加时点球标注常显；点卡片返回轮次档。
- [x] **手势接入**（`wirePinchOnce`，挂在 `#bracket` 容器上、跨重渲染只挂一次）：触摸双指追踪两指间距变化驱动缩放；桌面触控板 ctrl+wheel 同一状态机（网页端双指缩放同样生效）；`.ko{touch-action:pan-y}` 让单指滚动穿透、双指手势不被浏览器原生页面缩放抢走。
- [x] **无手势兜底**：轮次档/总览档/单场档顶部都有 `−`/`+` 圆钮 + 档位文字（总览/轮次/单场），鼠标点击、键盘 Tab 均可用，满足桌面无触控板用户与可访问性。
- [x] 验证：674/674 vitest（+9）、tsc 干净、构建干净（games 分片 13.96→16.87 kB / gzip 6.05→7.01 kB）、`!important`/bundle 预算基线不动。构建期两条 parse5 属性警告与上次一致（来自 U37 sectors 改动，非本项引入，已核实）。
- [ ] **站主真机验收**：iPhone/iPad 双指捏合缩放手感、三档切换是否符合预期方向（张开→详情，捏合→总览）、+/− 按钮桌面触控板 ctrl+滚轮是否顺手。
- [x] **复用性**：与 U38 共用 `bracketModel.js` 的通用阶段数据；`pinchZoom.js` 也是纯函数、不依赖比赛数据形状——未来 EWC/Season 16 页面接上 U38 的 adapter 后，这层缩放手势零改动直接复用（roadmap §7.4 已有记录，无需新增）。

## U38 · games.html 淘汰赛阶段滑杆（Apple Sports 式）✅ 代码已完成（2026-07-17，站主五张截图参考）

**参考机制转译**：Apple Sports 世界杯页的 GS→F 分段滑杆 = 「滑动 thumb 的阶段轨 + 水平平移/缩放的阶段面板」。本站落地（网页+移动端同一套）：

- [x] **纯函数层** `src/lib/bracketModel.js`（+9 vitest）：games-data 的「每轮比赛藏在下一轮槽位 legs」结构 → 通用阶段模型（R16/QF/SF/F）；比分从 record.log 的 label 解析（含点球 `0-0 (4-3 pens)` 与 `(AET)` 标注，自动按主客方向重排）；决赛对阵由 final 槽 leg 胜者推导；数据只到 QF 时自动只出已有轮次。**模型刻意做成赛事无关**——leagues 未来赛事写个 adapter 即可复用。
- [x] **滑杆 UI**（games.js `renderBracket` 重写 + games.css `.ko-*` 组件）：分段轨 `role=tablist` + 滑动 thumb（transform/width 过渡，`cubic-bezier(.32,.72,.28,1)` 苹果手感）；阶段面板水平平移居中，激活面板 `scale(1)/opacity 1`、邻位 `.94/.45` 半透出——「轮次间缩放」的核心观感；比分卡 = 旗帜+队名+3 字码+右对齐比分，胜者加粗败者减淡，点球/加时小字标注，决赛卡金边。默认落在最新轮次。
- [x] **实用功能**：触摸滑动切轮（42px 阈值）、方向键+focus-visible 键盘可达、resize 重定位、`prefers-reduced-motion` 全静态、双语即时切换；旧堆叠视图保留为模型为空时的兜底。全部动画只用 transform/opacity（合成器友好，宪章③）。
- [x] 验证：665/665 vitest（+9）、tsc 干净、构建干净（games 分片 13.96 kB）、`!important`/预算基线不动。⚠️ 顺手发现（非本项引入）：构建期两条 parse5 HTML 属性警告来自 `cbef9ed`（U37 sectors 改动）；repo 根多了未跟踪的 `arena-a-open-2026-07-17.json`（疑似定时任务落错位置）——均未处理，待对应会话/站主收拾。
- [ ] **站主真机验收**：iPhone 滑动换轮手感、thumb 过渡、邻位面板半透出、点球比分显示、EN/中切换。
- [x] **roadmap 已记录**：§7.4 追加「阶段滑杆通用化——EWC / 2026 Season 16 复用」条目。

## U37 · 公司卡片撤掉 SVG 图标，换真实 logo + 真实新闻室照片 + 选中变色摆动（2026-07-18，站主指令，参考 OpenAI Business 卡片截图，已完成）

**站主指令**：把 U36 里我画的 9 种示意 SVG 图标全部删除，改成每家公司真实的 logo（保留该公司自己的字体/字型，文字统一为白色），默认状态卡片是该公司官方的高质量业务场景照片，点选其中一张时该卡保持彩色并向左右摆动一下（模拟从照片堆里抽出一张的物理感），未选中的卡变黑白。参考图是 openai.com/zh-Hans-CN/business/ 的 Cisco/Morgan Stanley/BNY/Moderna/Uber 卡片带。

**先说清楚我做不到的部分，再说做了什么**：截图默认状态暗示"每家公司专属高质量业务场景照片"，但我没有任何公司的独家照片素材库，用生成模型编一张假装是 Anthropic/OpenAI 办公室的照片、给一个正在分析真实上市公司的页面用，属于编造内容，这个我明确不会做（这也是本次改动前用 AskUserQuestion 向站主确认的点）。站主选择的处理方式是"尝试抓官方新闻室照片，抓不到就纯色兜底"——于是这轮的照片来源是**真实存在的公开图片**，不是生成的。

**素材调研**：起了一个 general-purpose 子代理去逐个核实这 17 家公司（六张股票卡 NVDA/AVGO/MU/SKHY/TSM/ASML + 四张中美 AI 观察卡 anthropic/openai/zhipu/alibaba +十张后内存论点卡里另外七个 SSNLF/ALAB/MRVL/PSTG/SNDK/TER/RMBS）的真实 logo 文件与官方新闻室照片，要求：logo 优先用 Wikimedia Commons 的 `Special:FilePath` 直链（这是 Commons 官方设计给"引用识别用途"的稳定重定向服务，不是我去追踪/重画商标）；照片必须来自该公司自己的官方 newsroom/press-kit/media 页面，抓不到就如实回报"NOT FOUND"，不许猜/编 URL。结果：**16/17 家找到可用 logo**（仅 Astera Labs 官网是纯 JS 渲染、Wikimedia 也没有收录，退化为纯文字 wordmark），**6/17 家找到官方照片**（NVIDIA/Broadcom/Micron/SK hynix/TSMC/Samsung，均来自各自 newsroom 的真实图片直链），其余 11 家（含 ASML——子代理原本给了一个"低置信度"的媒体库首图链接，我判断置信度不够，主动归入"未找到"而不是赌一个不确定的图）退化为纯品牌色卡片背景。这个 6/17 的比例如实反映了真实约束（很多公司的媒体资料包是 JS 门禁的 Brandfolder 相册，抓取工具进不去），不是偷懒。

**实现**：`AfflatusBrand` 注册表从"BRAND_ICON/ICON_PATH 生成 SVG"整个换成"LOGO_URL/PHOTO_URL/DISPLAY_NAME 三张真实资源表 + `artHTML(key, extraHtml)`"——`artHTML` 拼出 `.rArt` 完整内容：有照片就是 `<img class="rPhoto">`（真实图，`object-fit:cover`）+ 一层深色渐变 `.rScrim`（保证叠加的白色 logo 在任意照片内容上都可读）+ 真实 `<img class="rLogo">`；logo 无论源文件本身是什么颜色，统一套 `filter:brightness(0) invert(1)` 强制变成纯白（**只改颜色，不改该 logo 自己的字形/字体形状**，这正是站主要求的"logo保持该公司自己的字体，文字为白色"）；没找到照片的公司加 `.noPhoto` 类退化回之前那套品牌色径向光晕背景；没找到 logo 的公司（仅 ALAB）退化成 `.rLogoFallback` 纯文字。因为这些图全部是外链到 Wikimedia/各公司官网 CDN（沙盒环境的出站网络有白名单代理，我这边验证不了每一条链接在真实浏览器里 100% 能打开），新增了一个挂在 `document` 上的捕获阶段 `error` 监听（`img` 的 `error` 事件不冒泡，所以监听器必须挂在捕获阶段而不是普通冒泡阶段）——任何一张图挂了/被防盗链拦截，会自动优雅退化成同一套"纯色/纯文字"兜底，而不是显示浏览器默认的图裂图标；这个监听器本身也是"如果某条外链后来失效了"的长期保险丝，不只是应对我这边验证不了的问题。

**选中变色+摆动效果**：`.rArt` 新增 `--tilt` 变量，按 `nth-child(4n±...)` 给卡片轮换基线小角度（-2°/1.5°/-1°/1.8°循环），模拟"随手散放的照片堆"静态观感；点击某张卡的照片区域会给它加 `.selected`——摆正角度、放大 1.06 倍、抬高阴影，并播放一个 `cardPull` 关键帧动画（先甩向一侧再回正，模拟"从堆里抽出来"的物理甩动，而非线性摆正），同时用 CSS `:has()` 选择器（`.railTrack:has(.rCard.selected) .rCard:not(.selected) .rArt` / `.newsGrid:has(.nCard.selected) ...`）让同一个 rail/grid 里其余未选中卡的照片变黑白——不需要额外 JS 去遍历"其余卡"手动加 class，选择器自己处理。六张股票卡（rail）的选中范围各自独立在 `#cardsA`/`#cardsB` 两条 rail 内；US-CN 观察卡与后内存论点卡的选中状态复用了它们已有的"点击展开详情"点击事件（`wireNewsCards()` 里在切换 `.open` 的同时联动切换 `.selected`，同一网格内只保留一个 selected），没有另开一套独立的点击监听。`prefers-reduced-motion` 下摆动关键帧动画关闭，只保留一次性缩放+去彩色的静态过渡。

**清理**：删除了 U36 引入的 `BRAND_ICON`/`ICON_PATH`/`iconHTML()`/`.bIcon` 整套 SVG 图标系统（CSS 与 JS 两边都删干净，`grep bIcon` 确认零残留），`newsCard()` 不再需要 `opts.glyph`（logo 图片本身即身份标识，两处调用点的 `glyph:` 字段一并删除）。

**验收**：`npx vitest run` 656/656 通过；`npx vite build` 干净通过（`sectors.html` 产物 53.05kB，course.html 既有 parse5 提示与本次无关）；`!important` 基线 `sectors.css` 保持 0；脚本化交叉核对确认新 HTML 里的 class 均能在 `sectors.css`/`page-turn.css` 里找到定义，且 `bIcon`/`ICON_PATH` 无残留引用。**真机复核是站主待办，且这次特别重要**：本次改动引用的全部是外部真实图片直链（Wikimedia Commons + 六家公司官网 CDN），我所在的沙盒环境出站网络有白名单代理、无法直接验证这些链接在真实浏览器里能否打开／是否会被防盗链拦截——已经加了错误退化处理兜底，但仍强烈建议上线后过一遍真机看看：16 个真实 logo 是否都正常显示（尤其 SVG 是否被强制变白后清晰可辨）、6 张真实照片是否加载成功、11 个"纯色兜底"卡是否观感协调、选中摆动+黑白切换的物理感是否符合预期。

## U36 · sectors.html 改黑底白字 + 全部提及公司换真实品牌色与产品图标（2026-07-18，站主指令，已完成）

**站主指令**：U35 上线的 openai.com 式浅色极简改版，站主反馈两点修正：① 背景和主体改回黑色、文字以白色为主（U35 当时选的是浅色极简整页方案，这次是同一天的直接反向指令，非新的模糊点，无需再用 AskUserQuestion 确认）；② 页面上提到的所有公司（六张持仓股票卡 NVDA/AVGO/MU/SKHY/TSM/ASML、四张中美 AI 观察卡 anthropic/openai/zhipu/alibaba、十张后内存论点卡 MU/SKHY/SSNLF/ALAB/MRVL/PSTG/SNDK/AVGO/TER/RMBS），缩略图要换成该公司的 logo 主题色 + 相关产品图形，而不是 U35 那套与公司身份无关的六种固定彩虹渐变（`.art-0`~`.art-5` 循环分配，谁分到哪个纯属数组下标，色彩与内容无关联）。

**配色回滚**：`public/styles/sectors.css` 根变量翻回黑底白字——`--bg:#000`、`--ink:#f5f5f7`（非纯白，WCAG 更柔和）、`--card-bg:#111113`、`--line:#232326`，阴影从"浅色卡片投影"改为"黑底发光描边"（`--shadow-sm/md` 用 `rgba(255,255,255,.04~.06)` 内描边 + `rgba(0,0,0,.5~.65)` 外扩阴影，而非之前的浅色阴影）。新增 `--chip-bg:#f2f2f3`/`--chip-ink:#0a0a0b` 一对"反色胶囊按钮"变量——U35 遗留了三处"背景用 `var(--ink)`、文字用 `#fff`"的胶囊按钮写法（`.nav a.active`、`.lang-toggle`、`.mwRoute`），这在浅色主题下（`--ink` 是黑）成立，但直接翻转 `--ink` 为近白后会变成"近白底近白字"的隐形按钮——三处全部改用新的 `--chip-bg`/`--chip-ink`（近白底+近黑字，深色界面里常见的"反色胶囊"写法），而不是继续复用已经改变语义的 `--ink`。`.railArrow` 同样的问题（`background:#fff` 硬编码 + hover `background:var(--ink)`），改为默认贴合卡片描边（`background:var(--card-bg);border:1px solid var(--line)`），hover 换成 accent 青色高亮。`.prov-badge.prov-amber`/`.prov-red` 的琥珀/红色文字+浅色描边组合是给白底设计的，黑底下对比度会变差，改用更亮的琥珀 `#f5b754`/红 `#ff6b6b` 搭配半透明描边。`.graphWrap` 星图面板原来的 `#05070b` 硬编码深底在纯黑页面背景下会糊在一起分不清面板边界，改用 `var(--bg-soft)` + `1px solid var(--line)` 描边，与页面黑底之间有清晰的层级区分。`public/page-turn.css` 里 `.sectors-page` 的两处翻页箭头/Labs 菜单变量覆盖块也同步改回深色系（但不是 U34 之前那套酸性绿/青色 HUD 配色，而是延续本轮"黑底白字+青色强调"的新语言：白/近白描边、青色 hover、反色胶囊高亮态）。

**品牌色系统（新增）**：查证 17 个页面提及的公司/代码的官方或公开引用品牌色（NVDA `#76B900`、AVGO `#CC092F`、MU `#0077C8`、SKHY `#FF7A00`、TSM `#E7000A`、ASML `#0F238C`、Samsung/SSNLF `#1428A0`、Pure Storage/Everpure·PSTG `#FE5000`、SanDisk/SNDK `#E10600`、Rambus/RMBS `#4764AC`、Anthropic `#D97757`、OpenAI `#10A37F`、Alibaba `#FF6A00`）——**Astera Labs/ALAB、Marvell/MRVL、Teradyne/TER、智谱/zhipu 四个查不到可확認的官方 hex**，用了代表性的同色系数值但在代码注释里如实标注"representative — no confirmed official hex"，不冒充已核实的官方色值。产品图形不复刻任何公司的真实 logo（商标/版权层面更干净，也符合本仓库"不伪造资产"的纪律），而是按产品类别画了 9 种通用示意线图标（GPU 芯片 chip、定制 ASIC/互连节点 asic、HBM 内存堆叠 stack、晶圆 wafer、光刻镜头 lens、存储阵列 drive、以及三个抽象 AI 实验室标记 spark/knot/dots 分别对应 Anthropic/OpenAI/智谱的风格意向、云计算 cloud 对应阿里），每个公司按其实际业务映射到对应图标类别（如 MU/SKHY/SSNLF/SNDK/RMBS 五个内存相关标的共用 stack 图标、AVGO/MRVL/ALAB 三个定制芯片与互连标的共用 asic 图标），图标描边色用 `currentColor` 继承该公司的品牌色变量。

**实现**：`sectors.html` 新增一个 `AfflatusBrand` 注册表（`BRAND_COLOR`/`BRAND_ICON`/`ICON_PATH` 三个映射 + `colorFor()`/`iconHTML()` 两个方法，挂在 `window.AfflatusBrand` 上），六张静态股票卡的 `.rArt` 从 `class="rArt art-N"` 改为 `class="rArt" data-brand="NVDA"`（ticker 文案本身仍是静态 HTML，不依赖 JS——JS 只负责叠加品牌色玻璃光晕和图标，即使脚本失败卡片仍可读），载入时用一个小循环给这六个 `[data-brand]` 元素套色+插图标；数据驱动的 `newsCard()`（同时服务中美 AI 观察的 4 张 vendor 卡和后内存的 10 张论点卡）新增 `opts.brand` 参数，读同一个 `AfflatusBrand` 注册表生成 `--brand` 内联样式和图标 HTML，一套注册表两处复用，不重复硬编码颜色。旧的 `.art-0`~`.art-5` 六个固定渐变类连同 `newsCard()` 里已不再使用的 `opts.art`/`% 6` 循环下标一并删除（含两处 `.map(function(b, i){...})`/`.map(function(c, i){...})` 里因此变成未使用变量的 `i` 参数一并清理）。

**验收**：`npx vitest run` 656/656 通过；`npx vite build` 干净通过（`sectors.html` 产物 48.62kB，course.html 既有的 parse5 提示与本次改动无关，行号仍指向 course.html 内容）；`!important` 基线 `sectors.css` 保持 0；脚本化交叉核对 HTML 内所有 `class="..."` 值均能在 `sectors.css`/`page-turn.css` 找到定义，且不再有任何 `art-0`~`art-5` 残留引用。真机复核仍是站主待办：黑底下各品牌色光晕的可读性与对比度、9 种示意图标在小尺寸缩略图里的辨识度、反色胶囊按钮（语言切换/路线徽标/翻页箭头）在黑底上的观感。

## U35 · sectors.html 整页重构为 openai.com 现行浅色风格（2026-07-18，站主指令，推倒 U33/U34 rail+阵营设计重做，已完成）

**站主指令**："参考目前 openai.com 的配色风格和模块设计来重新构建 sectors.html"——注意是主站首页 openai.com，不是此前 U31/U33/U34 参照的 Business 子页。由于我训练数据对营销站点结构已过期，先实际抓取 openai.com 当前页面确认真实结构：白底黑字，大图海报式 hero 轮播（图+标题+分类+阅读时长浮层）、"Recent news" 方形缩略图四宫格、"Stories"/"Latest research" 横向卡片排、超大多栏 mega-footer。这与本站其余页面共享的暗色酸性 HUD 身份是彻底两种语言，因此用 AskUserQuestion 确认三处关键分歧点，站主三次都选了更彻底而非更保守的选项：① 配色范围——**整页**换浅色极简（非"只借结构，配色仍走暗色 HUD"这一更低风险选项）；② 模块范围——方形缩略图四宫格、顶部大图故事轮播、横向卡片排、mega-footer 多栏导航**全部四个**都要；③ 上一轮（U33 故事 rail + U34 股票 rail + 红蓝 VS 阵营计分条）**推倒重做**，不保留。

**配色与模块体系（仅 sectors.html 生效，站主已知情并接受与全站其余页面的视觉不一致）**：`public/styles/sectors.css` 整份重写——新 token 系统 `--bg:#fff`/`--ink:#0d0d0d`/`--accent:#10a37f`（OpenAI 招牌青色，仅用于少量链接/强调）/`--radius-lg:28px` 等圆角与柔和阴影替换原 HUD 硬边框+霓虹光晕；字体沿用系统无衬线栈（明确没有引入/伪造一款"OpenAI Sans 风格"字体，如实使用系统字体）。六张持仓股票卡（NVDA/AVGO/MU/SKHY/TSM/ASML，真实 data-en/data-zh 文案原样保留）从 U34 的 `.card.railCard` 改造为 `.rCard`（方形缩略图 `.rArt` + 正文 `.rBody`），rail 的横向 scroll-snap + 箭头 + 拖拽**机制保留**（这本来就是 openai.com 自己 Stories/Research 排的真实滚动方式），但暗色 HUD 皮肤、居中卡片调暗对焦效果一并撤销——改走更轻的悬浮阴影+位移。中美 AI 观察板块从"vendor 故事 rail + 独立窄 modelWatch 卡"两套并行组件，**合并**为一套 `.nCard`（Recent-news 方形卡，thumbnail+tags+摘要+chips+点击展开详情），一个 vendor 一张卡（4 张），modelWatch 的 `current_line`/`developments`/`gap_note` 与 baskets 的 `equities`/市场关系字段合入同一张卡而非拆两处；十强后内存论点卡（10 张）复用同一个 `.nCard` 组件而非另造一套样式。新增 `.heroCard`（大图海报式 hero，`.heroArt` 生成式渐变 + `.heroScrim` 暗角 + 白字 `.heroCopy`，真实 kicker/h1/brief 文案原样保留）与 `.megaFoot`（品牌简介列 + Pages 导航列 + 本页说明列 + 底部一行免责声明，替换原单行 `.foot`）。星图力导向图**保留为深色数据台面面板**（`.graphWrap` 依旧 `#05070b` 深底），是有意选择——`sectorsGraphView.js` 的 canvas 绘制逻辑是已测试稳定代码，不因为页面主题换色就去动它，深色面板嵌在浅色页面里读作"一块独立的数据控制台"，而不是半吊子换色。六个 `.art-0`~`.art-5` 生成式 CSS 渐变（径向渐变叠加，非真实图片）作为所有缩略图的底——**这些 vendor/ticker 没有可用的正版实拍图/插画，虚构一张股票照片或公司实景图是编造内容，因此如实使用生成图形**，CSS 里留了注释说明这一点。

**JS 改动**：`renderStoryCards()`（拆两处渲染 baskets+modelWatch）合并为 `renderNewsGrid()`（一次遍历 `DATA.baskets`，按 vendor 从 `DATA.modelWatch` 找配对记录合流进同一张卡）；`renderPostMemory()` 改为输出 `.nCard` 标记复用同一渲染函数结构；新增通用 `newsCard()` / `wireNewsCards()` 两个卡片生成与点击展开的公用函数（vendor 卡和 postMemory 卡共用，不重复写两套点击/键盘展开逻辑）；`renderFactionBar()` 连同调用点、`.factionBar` CSS、`sectorsGraphView.js` 里与阵营计分条相关联的判定**整体移除**（`MARKET_COLOR` 的红蓝配色本身保留——US/CN 用蓝/红是独立于「VS 计分条」这个具体组件的语义关联，站主只要求撤销计分条组件，不是撤销颜色关联）；`wireRailActiveFor`/`railActiveIOs`（居中卡片调暗对焦）作为死代码整体删除，不再有任何调用点——新设计里保留的两条股票 rail 改走悬浮态而非常驻调焦效果，判定逻辑不再需要。`scrollRailEl`/`wireRailDragFor` 两个通用滚动/拖拽函数保留并瘦身为只服务两条股票 rail（vendor 卡从 rail 改成静态四宫格网格后不再需要这两个函数介入）。新增页脚 Pages 列渲染小脚本，直接消费 `src/lib/nav.js` 已经暴露好的 `window.AfflatusSite`（而不是把导航结构在页脚里手写第二份、制造未来漂移风险），并对 `nav.js` 作为 deferred module 的加载时序做了 `DOMContentLoaded`/`load` 两道兜底（幂等渲染，重复调用无副作用）。

**配套修改**：`public/page-turn.css` 里 `.sectors-page`（page-turn 翻页箭头）与 `.sectors-page .nav-labs__menu`（Labs 下拉菜单）两处既有的按页面覆盖 CSS 变量块，从暗色酸性 HUD 数值（`--turn-accent:#caff00` 等）改写为浅色系数值（`--turn-accent:#0d0d0d`/`--turn-hover:#10a37f`/`--labs-bg:rgba(255,255,255,.98)` 等）——这是本仓库既有的"共享组件按页面用 CSS 变量覆盖换皮"惯例（U16 前后确立），只改了这两处已存在的代码块本身的数值，没有新建组件或复制整块规则。`.sectors-page .page-turn` 的霓虹描边阴影同步换成与新 token 一致的柔和投影。

**验收**：`npx vitest run` 656/656 通过（本轮改动是 HTML 结构、CSS 重写、同一批既有内联 render 函数的重组，没有新增/删除任何有测试覆盖的纯函数模块）；`npx vite build` 干净通过，`sectors.html` 产物 43.91kB（gzip 13.65kB），无解析报错；`!important` 基线核查（`grep -c "!important" sectors.css`）保持 0（唯一命中仍是注释文本）；额外做了一次 HTML↔CSS 类名交叉核对（脚本化 grep 逐一检查新 HTML 里用到的类名是否都能在新 CSS 里找到定义，反向核查 U33/U34 遗留的 `.factionBar`/`.storyGrid`/`.storyCard`/`.railMedia`/`.cards-2`/`.cards-4`/`.sbg` 等旧类名是否已从新 HTML 里清零）——两项均通过，页面不再处于"CSS 已重写、HTML 未跟上"的中间破损态。真机复核仍是站主待办：浅色卡片在移动端的对比度与点按热区、mega-footer 在窄屏下的折行、深色星图面板嵌在浅色页面里的视觉过渡是否突兀。

## U34 · 上市公司股票卡改 rail + 红蓝阵营对抗设计（2026-07-17，站主指令，已完成）

**站主指令**：借鉴 OpenAI Business 页的公司故事版和滚动横幅，把 `NVDA/AVGO/MU/SKHY/TSM/ASML` 六张持仓论点卡也改造，并且中美 AI 对比要做成红蓝两大阵营对抗的设计。经 AskUserQuestion 确认三点范围：① 六张股票卡改横向 rail（不并入 vendor 故事 rail，分栏保留）；② 红蓝配色覆盖站内所有 US/CN 标记（含新股票卡）；③「对抗」既要有具象的 VS 分栏计分条，也要给星图两大引力阵营加红蓝辨识度——两者都做。

**31a/31b rail 复用到股票卡**：`cards-2`（NVDA/AVGO）、`cards-4`（MU/SKHY/TSM/ASML）从 CSS Grid 改为与 U33 vendor 故事卡同款的 `.storyRail`（横向 scroll-snap + 左右箭头 + 鼠标拖拽，触屏走原生滑动），各自独立成一条 rail、保留原有两个板块标题分组（不合并成一条大 rail，内容分组语义不变）。**没有加 `.railMedia` 媒体条**——这六张卡本来就有 54px 大字 `.ticker` 作为视觉身份标记，再加一层生成图形是重复劳动，比 vendor 故事卡（厂商名没有天然大字识别）更没必要；居中卡片改用透明度（`.railCard{opacity:.68}` → `.is-active{opacity:1}`）做焦点提示，而不是 `filter`，同样靠 `IntersectionObserver({root, threshold:.6})` 判定，零 scroll 监听。三条 rail（新增两条 + U33 既有一条）的滚动/拖拽/居中判定全部收拢进一组通用函数（`scrollRailEl`/`wireRailDragFor`/`wireRailActiveFor`，接收目标元素而非写死 `storyBaskets`），避免三份几乎相同的代码。

**红蓝阵营配色**：新增 `--faction-us:var(--blue)`（复用此前体检发现的死代码 `--blue:#4268ff`，废物利用而非新增变量）、`--faction-cn:#ff2d55`。覆盖范围：`.storyMarket` 徽标（US/CN 底色+白字，替换原 cyan/acid）、故事卡 `.railFill` 渐变（蓝/红两种市场基调，替换原 cyan/acid）、六张股票卡的 `.card::before` 顶部装饰条（默认蓝——六张全部是 US 上市/挂牌标的，`[data-market="CN"]` 分支留作以后扩展的钩子，目前未触发）、`src/lib/sectorsGraphView.js` 的 `MARKET_COLOR`（星图节点颜色 US 蓝/CN 红，取代原 cyan/acid）。星图的连线颜色（关联实线/受压虚线）是独立维度，不属于市场配色，未改动。

**VS 对抗计分条**：新增 `.factionBar`——US CAMP / VS / CN CAMP 三段横条，US/CN 两侧宽度按真实数据比例撑开（`renderFactionBar()` 用 `DATA.baskets` 算出两边桌数+关联标的数，写入 `--us-w` CSS 变量），不是装饰性的固定 50/50——延续本仓库「每个读数绑定真实状态」的宪章惯例。位置：US-CHINA AI WATCH 板块标题正下方，故事卡/星图切换按钮之上。板块标题本身也改写为「red camp vs blue camp / 红蓝阵营对抗」呼应设计主题。

**验收**：656/656 vitest 不变，`vite build` 干净通过，`!important` 基线不变（`sectors.css` 仍是 0，唯一命中是注释文本）。真机待复核：三条 rail 的拖拽/箭头/居中焦点效果、红蓝配色在深色 HUD 底色上的可读性、`.factionBar` 比例条在移动端换行降级（`≤560px` 改上下堆叠）是否观感正常。

## U33 · 修正 U31：故事卡改为真正的横向滚动 rail（2026-07-17，站主贴出 OpenAI Business 参考稿 DOM inspect 指出遗漏，已完成）

**问题**：U31 把「BNY/Moderna 案例卡」这个交互图案理解成了「非对称网格 + 滚动渐现」，但站主贴出的实际 DOM（`img.size-full.scale-102.object-cover...transition-[filter] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)]`，配一串响应式 `srcset`）证明参考稿的真实机制是**横向可滚动的卡片轨道**（scroll-snap 卡片带，图片常驻 `scale-102` 常量缩放、只有 `filter` 会过渡——即"居中卡片全亮度、其余卡片变暗"，随横向滚动切换焦点），不是竖直网格。上一版完全遗漏了"横向滚动"这个定义性交互，是理解偏差，不是实现细节问题。

**修复**：`storyBaskets`（4 张 vendor 案例卡）的容器从 12 列非对称 CSS Grid 改为 `.storyRail`（`.railTrack{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}` + 左右 `.railArrow` 按钮 + 鼠标 `pointerdown/move/up` 拖拽滚动，触屏走原生 swipe）。每张卡新增 `.railMedia`——**没有这些厂商的正版实拍图可用，伪造 Anthropic/OpenAI/智谱/阿里的"实景照片"是编造内容，因此用生成式图形身份替代**（vendor 首字母大字 + 按市场着色的径向渐变，US 偏 cyan/CN 偏 acid），而不是塞一张假照片；`filter` 的明暗切换、`.26s cubic-bezier(.22,1,.36,1)` 缓动、`scale-102`（`transform:scale(1.02)`）三个数值/曲线**直接照抄参考稿 DOM 里的真实值**，居中判定用 `IntersectionObserver({root: storyBaskets, threshold:.6})` 而非监听 `scroll` 事件手算偏移（延续本仓库"零 scroll 监听"纪律）。点击展开详情、hover 悬停微交互、ticker chip 点击滚动定位——这些 U31 已有的交互原样保留，容器结构变了但行为契约不变。

**验收**：656/656 vitest 不变（改动全部是 HTML 结构 + CSS + 同一批既有内联脚本的扩展，无新增可测试的纯函数逻辑），`vite build` 干净通过，`!important` 基线不变（唯一命中仍是注释文本）。真机待复核：横向拖拽/箭头/触屏滑动是否顺手、居中卡片调焦（变亮/其余变暗）过渡是否如预期、`prefers-reduced-motion` 下 `scroll-behavior:auto` 是否生效。

## U32 · sectors.html 修复：cards-4 文字重叠/结构波动 + 移除过期的 SKHY 上市信息（2026-07-17，站主真机反馈，已完成）

**问题 1（视觉 bug）**：「存储、晶圆代工与设备制造商」下方四张卡（MU/SKHY/TSM/ASML）出现文字重叠、结构波动，影响观感。**根因定位到两处真实存在的动效**，而非站主转述诊断里猜测的字距/多语种问题：① `.bar i` 的信念权重进度条挂了 `barFlow 3s linear infinite` 一个永不停止的渐变横向平移动画，四张卡进度条宽度不同、相位不同步，色彩持续水平滑动，紧贴文字造成"晃动"观感；② U30 R1 给 `.cards-4` 加的 hover 手风琴（`flex:1→3` + `-webkit-line-clamp:2→14`）在 `flex` 过渡期间叠加 `-webkit-line-clamp` 重新计算，浏览器在过渡帧之间会出现文字重排/重叠的渲染瑕疵，且 hover 触发条件在滚动/触控板误触时可能意外抖动，导致整行结构无预期地重排。

**修复**：① `.bar i` 去掉 `barFlow`，只保留一次性 `barGrow` 填充动画，填满后静止，同时删除已无引用的 `@keyframes barFlow`；② 撤回 `.cards-4` 的 hover 手风琴机制（`@media(hover:hover) and (pointer:fine)` 那两条规则整体移除），改为固定 `-webkit-line-clamp:3`（不随 hover 切换）——四卡高度稳定一致，`.tag` 因 `.card{flex-direction:column}` + `.thesis{flex:1}` 天然钉在同一水平线，不再需要動態手风琴来"对齐"；同步移除 4 张卡上为手风琴 `:focus-within` 而加的 `tabindex="0"`（功能撤回后这是纯粹的多余 tab 停靠点，可达性上应去掉）。

**问题 2（内容过期）**：SK Hynix 纳斯达克上市倒计时/时间线/条款整块内容已经过期（首秀是 7 月 10 日，今天 7 月 17 日，已经过去一周，倒计时目标日期已过，继续展示等于展示一个卡在 00:00:00:00 或者语义上无意义的"倒计时"）。**移除范围**：`SK HYNIX (SKHY) NASDAQ DEBUT` band + 整个 `.skhy` section（lede、倒计时数字块、六项发行数据、五步时间线、指引段落）+ 专属的倒计时 `setInterval` 内联脚本 + `sectors.css` 里对应的 `.skhy*`/`.cd-*`/`.tl-item` 规则块（连带清理因此变成孤儿的 `@keyframes cdPulse` 和 `--hazard` 根变量——都只在被删的这块里用到）；hero 区 kicker/brief 里"SK Hynix debut Jul 10 / 见下方倒计时"的措辞相应改写（brief 改为过去式陈述、不再指向已删除的区块，kicker 去掉这一分句）；meta description 里的"SKHY Nasdaq ADR debut countdown"分句一并删除，避免描述一个已不存在的页面功能。**保留未动**：cards-4 里 SKHY 那张持仓论点卡（讨论的是 HBM 份额/SOX 纳入/仓位这些持续有效的投资论点，不是"上市信息"本身）与 POST-MEMORY 十强论点卡里的 SKHY 条目——两者都是仍在追踪的持仓判断，不属于站主要求删除的范围。

**验收**：656/656 vitest 不变（本次改动零 JS 逻辑改动，纯 HTML 内容删除 + CSS 规则调整），`vite build` 干净通过，`sectors.html` 产物体积从 46.99kB 降到 39.09kB（符合预期——删掉了一整块内容），`!important` 基线不变（`sectors.css` 仍是 0，唯一字面命中是注释文本）。真机复核仍是站主待办：四卡是否不再有重叠/波动感、SKHY 倒计时区块确认已从页面消失。

## U31 · sectors.html 重构：OpenAI Business 式故事块 + 无限 Ticker 条（2026-07-16 立项，站主参考稿）

**总裁决（延续 U30「效果照收，栈不引」）**：故事块与 marquee 两个交互图案全部采纳；参考稿里的技术栈全部改道——Next.js/SSR 不迁（U21 裁决：静态 MPA 首屏与 SEO 收益等价且零框架债）、Tailwind 不引（`@layer tokens` 是既定替代）、Framer Motion/GSAP 不引（IntersectionObserver + 原生 CSS transition 就是参考稿自己描述的底层实现）。**新样式只许写进 `@layer tokens/components`**（U30 重构线硬规则）。

### 31a·31b·31c 已实现（2026-07-17，同日开工同日完工）

**内容映射**：`storyBaskets`（sectors.html）从 `DATA.baskets`（4 vendor：anthropic/openai/zhipu/alibaba）渲染大案例卡——vendor 名 + `.storyMarket` 市场徽标（US=cyan/CN=acid，色彩与力导向图的 `MARKET_COLOR` 呼应）+ 首条 equity 的 `correlation_note_zh`（数据里本就只有 zh 字段，沿用既有 `mwDetail` 点选详情卡同一惯例——不管界面语言都显示 zh 原文，不是新缺口，也不臆造英文译文）+ confidence 徽标（`pct()`）+ 全量 equities 的 ticker chips；点击/Enter/Space 展开 `.storyDetail`（全部 equities 的关系+备注），用 `document.startViewTransition` 包裹，`prefers-reduced-motion` 时直接跳过——与 R1 的展开卡/共享转场是同一语言。`storyModels` 渲染 `DATA.modelWatch` 4 条为窄卡（vendor/route/current_line，复用既有 `.mwRoute`/`.mwLine` 样式）。`storyTake` 渲染 `weeklyTake` 为通栏 featured 卡置顶。现有矩阵表（`.mwMatrix`）保持 R3 已完成的折叠态，未改动。

**非对称网格**：`.storyGrid` 12 列，4 张 vendor 卡按 `nth-child` 固定 7/5/5(+26px margin-top)/7(+26px margin-top) 错落；`≤860px` 退化单列、margin 清零（sectors.css 追加约 70 行，未引入 `@layer`——R3/R4 先例已确认 sectors.css/signal.css 本就在 legacy/tokens/components 层级体系之外，此规则不适用于这两个独立文件）。

**滚动进入**：`observeReveal()`——`IntersectionObserver`（`once`/`unobserve`，阈值 0.2）命中即按命中顺序赋 `transitionDelay = i*80ms` 再加 `.in`；`prefers-reduced-motion` 或无 IO 支持时直接同步加 `.in`，不经动画。CSS 侧只留一条空动画兜底注释（未用 `!important`——JS 已经在首帧绘制前同步加好 `.in`，`.storyCard.in` 两类选择器的优先级本来就够，不需要覆盖强推）。

**悬停微交互**：`.storyCard{transition:transform .3s ease,box-shadow .3s ease,border-color .3s ease}`（未用 `transition:all`），hover/`:focus-within` → `scale(1.02)`+ 阴影 + cyan 边框；chips 独立 hover 提亮为 acid。

**31b 无限 Ticker**：hero 下方新增 `.tickerBand`，内容裁决为 **arena-universe.json 的 29 个跟踪标的**（原 U31 立项文写「40+」是估计误差，实测清单是 29 个，如实更正）按 `bucket` 三色（core-ai-hardware=cyan/megacap-tech=acid/benchmark=hazard）。双倍克隆法完全照抄参考稿：静态 `.tickerTrackWrap` 包一个真实 `.tickerTrack`，JS 拉到数据后填充内容，`cloneNode(true)` 出第二份（去 id、加 `aria-hidden`），`@keyframes tickerScroll{to{transform:translateX(-50%)}}` 40s→改用 48s（视觉上更从容，纯审美调整）linear infinite 挂在 wrap 上；`:hover`/`:focus-within` 暂停；`prefers-reduced-motion` 关动画、隐藏克隆、真实 track 转 `flex-wrap:wrap` 静态网格。点击 chip → `scrollToTicker()`：优先匹配 6 张手写案例卡（新增 `id="card-NVDA/AVGO/MU/SKHY/TSM/ASML"`），否则匹配 `storyGrid` 里含该 ticker 的 vendor 卡（`.storyChip[data-ticker]`），命中则 `scrollIntoView`+ `.flash` 高亮 1.4s；两边都没有的 ticker（如 AAPL/TSLA 等，本页本来就没有专门卡片）点击无反应，如实记录，不臆造落点。

**31c 合流**：既有 R3 力导向图整体原样移入新增的 `#storyGraphSection`（默认 `hidden`），`.storyToggle` 两个按钮（Story cards / Star-map view）切换显隐；图的初始化改为**惰性**——只在用户第一次点「Star-map view」时才调用 `renderGraph()`（此前是数据一到就 eager 初始化），因为 `sectorsGraphView.js` 的 `size()` 只在初始化和 `resize` 事件时读取 canvas 实际像素尺寸，若在 `hidden` 状态下 eager 初始化会永久按 0 尺寸定形直到下次真实 resize——为避免这个坑，选择懒加载而不是改造已测试稳定的 `sectorsGraphView.js`（30j 当天来回踩坑的教训：不动已经调好的文件）。`render()`（lang 切换会重跑）保留「若图已初始化过或当前可见才重跑 `renderGraph()`」的判断，避免语言切换时把隐藏中的图意外 eager 唤醒。

**验收**：656/656 测试通过（无变动，本次改动是纯 HTML/CSS/inline-JS，未碰任何有测试覆盖的模块）；`!important` 基线——`sectors.css` 保持 0（新代码零 `!important`，唯一一处字面匹配是注释文本，非真实规则）；`vite build` 干净通过，`sectors.html`/`sectors-*.js` 产物体积无异常增长（未新增任何 JS chunk，改动全部是内联脚本+独立 CSS 文件）。**真机复核仍是站主待办**：非对称网格错落感、渐现 stagger 节奏、marquee 无缝循环、hover 微交互、移动端单列 + marquee 可暂停、`Star-map view` 切换后画布正确定形（这条尤其要看——沙盒工具无法真正验证 canvas resize 时机，纯代码推导 + 复用 30j 已验证过的 `size()`/IntersectionObserver 门控逻辑，未改代码本身）。



## U30 · 首页/sectors/signal 三页重设计 + 重构路线图（2026-07-16 立项，站主三技术框架，取长补短裁决）

**总裁决：三个效果全部收，三个库一个不引。** 站主框架的价值在交互模式（sticky 缩放舞台/力导向图/共享元素转场/手风琴卡），不在指定库——本仓库零运行时依赖（three/astronomy 除外）是 U21 认定的架构资产，三个效果都有原生或自研路径，且全部符合课程 R2/宪章纪律。

### 30a · 技术裁决表（效果照收，实现改道）

| 站主指定 | 裁决 | 理由与重估条件 |
| --- | --- | --- |
| GSAP + ScrollTrigger | **不引**——sticky pin 用 `position:sticky` + 原生 **CSS scroll-driven animations**（`animation-timeline: scroll()/view()`，U22b 既定路线首次落地）；JS 需要时只在 rAF 内 lerp 滚动进度（既有纪律） | 省 ~70KB 依赖与更新债；效果对不支持的浏览器**渐进降级为静态布局**（内容零损失）。重估条件：真机验收裁定「必须全平台动效一致」且原生覆盖不足，届时再议引库 |
| D3 / PixiJS / Three（力导向图） | **Canvas 2D + 自研弹簧物理**（`src/lib/forceGraph.js` 纯函数：引力/斥力/弹簧/阻尼积分器 + vitest 黄金集——本仓库最强路径，flightPath/cameraMath 同款打法） | 节点规模 <100，Canvas 2D 60fps 绰绰有余；D3 只为力仿真引全家桶不值。pan/zoom 用单个 2D 变换矩阵（滚轮/双指捏合/按钮三入口） |
| View Transitions API | **原生直用**——`@view-transition` 全站已启用（styles.css:7206），只欠共享元素命名 | 零成本，纯增量 |
| Flexbox 手风琴 | **纯 CSS 照做**（`flex:1→3` + `transition:flex .5s ease-in-out` + `object-fit:cover`） | 无任何裁决必要；补键盘焦点展开（:focus-within，Phase 3 可达性同线） |

### 30b · 三页应用设计

- **首页 `/`**：**星门 sticky 缩放舞台**——stardrive 段改为 pin 容器：进入时暗色容器 `scale(.8)`+圆角可见，滚动进度驱动至 `scale(1)`/圆角 0 满屏（正好把 U28b 修过的断层升格为「星门迎面展开」的叙事时刻，倒滚平滑回缩）；容器内星门/双侧塔柱/标语/指标条分层多向视差（各异 translateX/Y+rotate+opacity，营造 3D 悬浮），驱动全走 CSS scroll-timeline，`prefers-reduced-motion` 直出静态。**资产甲板顶部持仓高亮**改 5 卡横向手风琴（hover/点击 `flex:3` 展开显示持仓论点一句话，键盘可达）。
- **sectors.html**：**力导向图成为页面主角**——US/CN 双主题引力极，modelWatch 模型节点 + baskets 篮子节点按阵营受引力、彼此斥力、关联细线连接（数据源就是现有 sectors-data.json，零新数据）；加载呼吸浮动、拖拽回弹、pan/zoom；点击节点 = 展开该模型/篮子详情卡。现有矩阵表降级为图下方的可折叠数据视图（渐进披露宪章⑥）。移动端：节点数封顶、拖拽改点按、双指缩放。
- **signal.html**：**事件时间轴视差 + 共享元素展开**——鹰鸽罗盘置顶 pin，宏观事件流做纵向视差时间轴（事件卡错速浮入）；点击事件卡原生 View Transitions 共享元素展开为详情（卡片飞展为 hero，不跳页刷新）。**serial.html 顺带受益**：书架封面 → 阅读器头图的跨文档共享元素转场（`view-transition-name` 按书 id），是全站最贴合「gallery→article」范式的一条，一并纳入。

### 30c · 路线图（轻重缓急，每期一会话）

| 期 | 内容 | 风险/依赖 | 优先级依据 |
| --- | --- | --- | --- |
| **R0 · 清欠先行** | 真机验收积压清账（状态表 10+ 项）+ U21 Phase 2 的 Lighthouse/CrUX 基线 | 无 | R3 规则红线；R2/R3 期的滚动动效没有基线不许上默认 |
| **R1 · 快赢：转场与手风琴** | serial 书架共享元素转场 + signal 事件卡展开 + sectors/home 手风琴卡 | 极低（原生 API+纯 CSS，零依赖零 JS 动画） | 感知提升/成本比最高，先建立「新设计语言」的基调 |
| **R2 · 首页星门舞台** | sticky 缩放容器 + 内部视差（`?fx=stage` flag 起步，真机看过转默认） | 中：sticky pin 在 iOS 的滚动橡皮筋、CLS；scroll-timeline Safari 覆盖需真机确认 | 首页是门面，但动效风险须 flag 隔离（U25 教训制度化） |
| **R3 · sectors 力导向图** | forceGraph.js 纯函数+vitest → Canvas 渲染层 → 交互（pan/zoom/拖拽/点击详情） | 中高：工作量最大；移动端交互需专门设计 | 三页里改动最深，放在设计语言稳定之后 |
| **R4 · signal 视差时间轴** | 罗盘 pin + 事件错速时间轴 | 低中：复用 R2 的 scroll-timeline 基建 | 吃 R2 现成基建，边际成本低 |
| **重构线（与 R1–R4 并行推进）** | ① `@layer tokens` 五件套落地（U21 Phase 3 清单，R1 的新组件**只许**写进 tokens/components 层，不许再进 legacy）；② 新动效一律零 scroll 监听（scroll-timeline 或 rAF lerp）；③ 每期结束跑 R6 架构审视防 styles.css 继续膨胀（现 7826 行是 W1 靶子） | — | 重设计是把 CSS 债就地转新层的唯一窗口期，错过再还要贵一倍 |

- [ ] 站主裁决：路线图顺序是否通过；R1 三个落点（serial 转场/signal 展开卡/手风琴）是否照单；手风琴用在 sectors 篮子还是首页持仓（本文建议：**两处都上，sectors 先行**——4 篮子天然适配，首页持仓等 R2 一起动）。
- [ ] 通过后开工指令：「读 Urgent.md U30 R1 开工」。

### 30d · R1 已实现（2026-07-16，同日开工同日完工）

三个落点全部落地，644/644 测试通过，`!important` 基线不变（styles.css 2960 / index.html 2，均未触碰），bundle 预算无变化（三处改动都是页面内联脚本+CSS，零新增 JS chunk）。

- **serial.html**：`selectNovel()` 里书架→英雄区的视觉更新拆成 `paintHero()`，用户点击切书时用 `document.startViewTransition()` 包裹——点击的书封临时获得 `view-transition-name:novelMorph`，回调里转移到 `.hero .pad`，原生 morph 出「封面飞展为详情」的效果，转场结束后清空 name 避免残留；初次加载（`scrollToShelf===false`）跳过转场。`prefers-reduced-motion` 下动画关闭（`::view-transition-group(novelMorph)` 归零）。
- **signal.html**：事件簿卡片默认折叠（只显示编号/日期/分级），点击或键盘 Enter/Space 展开完整 dossier（before/print/repricing/reaction/verdict），展开状态存在闭包 `OPEN` 集合里（语言切换重渲染不丢状态）；切换动作用 `document.startViewTransition` 包裹（`prefers-reduced-motion` 时直接跳过，走既有 RM 判断惯例）。
- **sectors.html**：手风琴落在 **cards-4**（MU/SKHY/TSM/ASML 四张论点卡），而不是原计划的 baskets 篮子行——篮子只是 ticker 标签列表，没有能撑手风琴的长文本；cards-4 的 `.thesis` 天然是一段完整论点，`-webkit-line-clamp:2` 收起，hover/`:focus-within`（4 张卡补了 `tabindex="0"`）展开到 `flex:3` 并放开 clamp。**仅限 `hover:hover and pointer:fine`**——触屏没有 hover，保留现有的网格常显堆叠，不强迫手风琴。无图片可用，`object-fit:cover` 未采用（如实记录偏离站主原稿）。首页资产甲板的 5 卡手风琴按计划推到 R2 与星门舞台一起动（未在本次改动）。

待真机验收（计入 R3 WIP 上限，非 flag 隔离）：以上三项 UI 交互变化。

### 30e · R2 已实现（2026-07-16，`?fx=stage` 起步，默认关闭）

星门 sticky 缩放舞台落地，**且不是另起炉灶**——U28b 已经把 `.stardrive` 做成了一套成熟的 pin+`--forge`(0→1) 进度系统（原生 `animation-timeline:view()` 优先、JS `pin-fixed/pin-end` 兜底，`--forge` 由 `alphardForge.js` 的 rAF 逐帧写入，驱动标语/指标条/光晕），且**已经是默认上线行为**（`section.classList.add('is-live')` 无条件执行，不是 R2 的假设"从零到有"）。R2 要加的只是"容器本身可见缩放"这一层：

- **`.stardrive-scale`**：新增的内层包裹 div（`index.html`，包住 canvas/veil/caption/tagline/strip），`position:absolute;inset:0` 打底（无 flag 时是纯透传，零视觉变化）。
- **`.stardrive.fx-stage .stardrive-scale`**：`transform:scale(calc(.8 + var(--forge)*.2))` + `border-radius:calc((1 - var(--forge)) * 32px)` + `overflow:hidden`——直接复用已经存在的 `--forge`，**零新增 JS、零新增 scroll 监听**（U30 30c 重构线①②两条硬规则天然满足，因为压根没写新的滚动驱动代码，是蹭 U28b 的现成基建）。
- **多向视差**：caption/tagline/strip 三层各自叠加了不同的 translateX/rotate（同样 keyed off `--forge`，同样只在 `.fx-stage` 下生效），营造"分层微悬浮"而非死板的单轴缩放。
- **`prefers-reduced-motion`**：不需要额外代码——U28b 原有的 reduced-motion 规则已经把 `--forge` 钉死在 1，calc 出来正好是 scale(1)/radius 0，即"直接呈现终态"，全站唯一一条新 CSS 都不用加。
- **flag 开关**：`alphardForge.js` 里 `?fx=stage` 时才 `classList.add('fx-stage')`；默认（无 flag）行为与 R1 完成时完全一致，已验证 644/644 测试、`!important` 基线、bundle 预算三项均无变化。

访问 `https://feida.au/?fx=stage` 可看效果；真机看过、站主确认观感后再考虑转默认（同 U25 教训——先 flag 后转正，不要一次做完就默认上线）。**不计入 R3 WIP 上限**（默认关闭，flag 隔离，R3 例外条款适用）。

- [ ] 站主真机看过 `?fx=stage` 后裁决：转默认，还是继续调整（缩放幅度/圆角大小/视差强度）。

### 30f · 星门入场缝隙根治（2026-07-16，站主真机截图抓到，不限 flag）

站主截图：星门与宇宙背景之间的过渡"像两色国旗拼接"一样硬，毫无渐变感——这是全体访客都能看到的默认行为，与 `?fx=stage` 无关，直接修，不设 flag。

**根因**：U28b 把入场雾化渐变（`.stardrive-stage::before`）的起点从 `var(--bg)` 改成了 `#021418`（贴近星云自身色调），本意是让"雾气→星云"这一段更连续，但代价是"背景→雾气"这一段从此永远从 `#021418` 硬跳开始——而入场渐变正上方实际显示的像素是固定层 `#starfield` 的 `var(--bg)`（`#04060a`，一个不同的深蓝黑色），两者从 0% 就不同色，等于把缝隙从"雾气/星云"这一段搬到了"星空/雾气"这一段，肉眼看正是站主截图里那条硬边。

**修复**：渐变新增 `var(--bg) 0%` 起点锚点，前 ~3vh（10%）内过渡到 `#021418`，之后维持 28b 原有的下探曲线（34%/68%/100% 各档）不变——入场处与实际背景色连续，星云处仍是贴近星云色调的雾化，两头都不再硬切。644/644 测试通过，`!important` 基线不变，未加 flag（属于基线渲染缺陷修复，不是新视觉效果）。

**站主复查后仍见硬缝（第二张截图）**——用 Vercel MCP 核对过部署（`dpl_FKaR43eDWhJ7akS1mkupFheEDQ6u`，READY，commit `244f9db` 已生效），确认不是缓存/未部署问题，是我诊断漏了一层：真正的硬边不在入场渐变里，出在 **`?fx=stage` 的缩放容器本身**——`.stardrive-scale` 缩到 `scale(.8)` 时用 `overflow:hidden` 硬裁切画布，而 U28b 的 `::before/::after` 雾化渐变留在没缩放的外层 `.stardrive-stage` 上，两者从此对不齐：外层渐变还按"画布占满全屏"的老尺寸淡出，画布本体却已经缩进一个更小的圆角框里，露出来的就是 `overflow:hidden` 那道干净利落的裁切边——截图里那条平直硬线其实是缩小容器自己的裁切边界，不是雾化没做好。

**修复**：给 `.stardrive.fx-stage .stardrive-scale` 加 `box-shadow`（外层暗影 + 一圈淡青色描边光，颜色沿用 `.stardrive .strip` 已在用的 `rgba(140,196,255,...)`），随 `--forge` 一起淡出到 0——缩小态时裁切边看起来是"一块发光的取景窗"而不是"图被生硬切掉"，全屏态时描边与暗影完全消失、不留痕迹，呼应 U22 宪章的「diegetic UI」（一切都是座舱内的实体装置，不是意外的渲染缺陷）。644/644 测试通过，`!important` 基线不变，仍在 `?fx=stage` flag 内、不计入 R3 WIP 上限。

### 30g · 指标条可读性 + 排版空隙 + 出场缝隙根治（2026-07-16，站主连续真机截图追查）

站主连续反馈三个问题：① 星门指标条文字在星门照射下看不清；② 首页"航向·奇点王座"到星门之间约 1/3 屏空白、星门到"02·equity curve"约 1/4 屏空白，中间只有纯宇宙背景；③ 星门向下出场处一条青绿色虚线状硬缝。三个都不限 flag（默认路径缺陷）。

**文字可读性（`ca11c42`→`3580bd4`→`b1074b0`，三轮才根治）**：round1（`ca11c42`）换用与 hero-metric 同色系的淡蓝色（`#bfe2ff`/`#eef7ff`），仍偏淡；round2（`3580bd4`）加深面板不透明度 + 给文字加深色 contact-shadow，仍不够。根因：所有颜色此前都是 `rgba(...,.6~.8)` 半透明——不论背后多暗、阴影多重，半透明色永远压不住星云自身的亮度波动。round3（`b1074b0`）彻底改用不透明纯色，`.strip` 面板本身提到 `blur(11px)` + `rgba(3,5,9,.88/.72)`（近似"点亮的控制台面板"而非"一丝色调"），并把非 hero 格的 `opacity` 下限从 `.55`→`.72`→`.85`——这个 `opacity` 是乘在整个格子（含刚改不透明的文字）上的，前两轮没注意到它在悄悄把修好的颜色重新稀释回半透明。

**排版空隙（`b1074b0`→`15f4b71`→`48bb83c`，三轮，最后一轮才是真根因）**：round1（`b1074b0`，与上面文字修复同一提交）猜"淡入淡出距离不够连续"，把入场渐变 32vh→44vh 加宽——结果被站主截图证伪：更宽的溶解等于更多"什么都没有"的滚动距离，空白感反而更重。round2（`15f4b71`）全部收窄回 26vh（比 U28b 原始的 32vh 更紧），平滑感改靠渐变中间档位而非距离本身；同时发现 `.hero{min-height:min(...,64vh)}` 在高窗口下可能撑出比文案需要更多的空间，加了 `660px` 绝对值上限兜底。站主真机截图证明空隙仍在，改用 Chrome DevTools 现场量 `getBoundingClientRect()` 才挖到根因：`progress()` 原本用"200vh 外层容器自己的顶部穿过视口顶部"才开始计数（`-rect.top/(rect.height-vh)`），但 100vh 高的内层舞台跟视口本身差不多高，早在外层容器顶部穿过视口之前就已经 95%+ 进入可视区域——也就是说几乎一整屏"星门早已经映入眼帘但 `--forge` 还钉在 0"，视觉上正是站主说的"中间没有内容只有宇宙背景"。round3（`48bb83c`）把计算基准换成"舞台自己完整穿过视口的全程"（`(vh-rect.top)/rect.height`），手算验证：同一滚动位置 `--forge` 从 0 变成 0.4438。

**出场缝隙 + 本轮收尾（`b44a2b5`）**：① `progress()` 外层再包一层 `easeOutCubic`，起止锚点不变（0→1），但滚动过半之前就能到 0.8+，视觉"到位感"比线性提前很多，缓解 48bb83c 修完后仍偏慢的观感；② 出场渐变（`.stardrive-stage::after`，星门→equity 方向）12vh→20vh 并加一级 `.15@70%` 中间档——之前只有两个真实档位（45%/100%），画布最亮的顶端直接从"零遮罩"跳到 45% 档，读起来像一条硬缝而不是渐隐，加档后顶端先经过一段"若有若无"的过渡再进入主渐变。真机复核（Chrome DevTools 截图 + 滚动扫描，`?fx=stage`）：hero→星门段星图/星轨在滚动约 500px（视口高 827px 的 60%）处已清晰可见、指标条四项文字全部清晰可辨；星门→equity 段肉眼未见硬缝或虚线。644/644 测试通过，`!important`/bundle 基线不变。

### 30h · 诊断方法论翻车 + 版本回滚链 + 空隙终局修复（2026-07-16/17，站主连续追查）

**关键教训（写死，往后必须遵守）**：用 Chrome DevTools MCP 的 `javascript_tool` 执行 `window.scrollTo()` 来测试原生 CSS `animation-timeline:view()` 完全不可靠——这个环境里程序化 scroll 不会真正触发合成帧，`ViewTimeline.currentTime` 永远卡 `null`、`transform` 永远读 `"none"`，据此误判"原生 pin 在生产环境已死"。据此做的 `cssPin=false` 实验（`dabc6a5`）上真机滚轮一测，JS 回退的 `position:fixed` 和其实一直在跑的原生 CSS 动画同时生效、`transform` 叠加把舞台推出屏幕 600px，比原问题更糟，当场回滚。**规则**：任何跟 scroll-timeline/rAF 挂钩的验证，只能用 `computer` 工具的真实滚轮 `scroll` 动作，禁止 `window.scrollTo()`。

**连环回滚（站主逐条报错→逐条精确指定版本）**：quartic 缓动改动（`d3317ac`，未经充分验证的猜测性修改）导致效果异常，`git revert`→`a058d8b`；随后站主报告"滚动联动的文字渐显/星门缩放特效完全消失"（Chrome 端）+ 移动端排版新问题，我误判为缓存问题并顶嘴，被站主指出错误后，因为无法在沙盒里区分 Chrome/Safari 差异，一次性把 stardrive 相关文件全部revert 回 R2 之前（`0e23631`）——站主纠正"5e9c096 版本才是对的"，说明整体回滚过火；随后站主又连续两次给出精确 commit 指令"回到 b44a2b5"、"回到 48bb83c"，均用 `git diff <hash> HEAD --stat` 锁定实际有差异的文件、`git checkout <hash> -- <files>` 精确回填、跑 644 测试 + budget 脚本后提交推送。**移动端排版问题始终未被诊断**（两次追问具体页面无回音，站主已转向别的指令）。

**空隙终局修复（`d8a56ea`）**：回到 `48bb83c` 状态后，站主给出最终精确指令"把星门移至首页文字航向·奇点王座的正下方"。分析确认 `.hero-cta`（含"航向·奇点王座"）是 `.hero` 最后一个子元素，`</section>` 后 `.stardrive` 立即开始，DOM 层面零间隙——唯一杠杆是 `.hero` 的 CSS 盒高是否超出内容实际高度。级联分析（Python 括号深度脚本核实）锁定 `styles.css` 里最后一条无 `@media` 包裹的顶层 `.hero{min-height:...}` 规则（这条赢过前面 `min-height:96vh!important` 等规则）为实际生效规则，把它的 `min-height` 从 `min(calc(100svh - var(--hud-combat-h) - 24px),64vh,660px)` 改成 `0`（不是删除——删除会让级联回退到更差的 `96vh!important` 规则）。真机滚轮复核（`?fx=stage`）：`getBoundingClientRect()` 读出 `stardriveTop - heroBottom === 0`，滚动联动的文字渐显+星门缩放特效在真实滚轮下运作正常，无回归。644/644 测试通过，`!important` 基线不变（2960/2960, 2/2），部署 READY，commit `d8a56ea`。

### 30i · 移动端专属 bug：vh→svh 修正星门"死滚动"+ 指标条挤压（2026-07-17，站主真机 Chrome 截图，硬刷新排除缓存后确认）

站主发来两张移动端 Chrome 真机截图：① hero"航向·奇点王座"之后是一大段纯宇宙背景，星门文字要滚很久才出现；② 指标条紧贴甚至挤进"02·equity curve"。这两张截图是在硬刷新/无痕模式下拍的，排除了 CDN/缓存未更新的可能——是真实的、桌面端复现不了的移动端专属 bug。

**沙盒工具限制（如实记录）**：这次没能像验证桌面那样自己截图复核——`resize_window` 在本环境里调用"成功"但 `window.innerWidth` 实际不变（早前已知的沙盒限制），Chrome 内 `Ctrl+=` 页面缩放快捷键也没能改变 `matchMedia` 的断点判定；尝试用 Playwright 在沙盒里起一个移动视口的无头 Chromium 直接复核，下载到浏览器后卡在 `libXdamage.so.1` 缺失且沙盒无 root/apt 权限装不了系统依赖，也没有网络权限拉 `.deb`。三条路都堵死，只能靠代码/级联的纯静态推导定位根因，并向站主坦白这个限制（没有假装验证过就蒙混过关）。

**根因（`.hero` 侧级联手工验证 + `--forge` 数学核对后排除，最终定位到 `.stardrive` 自身）**：`.hero` 在 ≤880px 时的 padding/min-height 经 30h 的改动后计算下来是 padding-top≈110px、padding-bottom 和 min-height 都被清零，和桌面同款；`--forge` 的线性公式（`(vh-rect.top)/rect.height`）在移动端和桌面端是同一套数学，没有平台专属分支。真正的问题在 `.stardrive-stage`/`.stardrive.is-live` 用的是纯 `vh` 单位——移动端 Chrome 的 `vh` 恒等于地址栏隐藏时的最大视口，但页面实际渲染（尤其刚加载/滚动停止时）地址栏是展开的，真实可视区比 `100vh` 矮一截。于是：① 星门舞台的 200vh/170vh 外层容器和 100vh 内层舞台都比屏幕上实际能看到的还高，多出来的部分只能靠多滚动才能"够到"，这就是"一大段纯背景"；② `.strip`（指标条）的 `bottom:6vh/5vh` 偏移量、以及 pin-end 状态下舞台自身的落点，都是按这个偏大的高度计算的，真实视口下会比设计意图更靠下，挤向紧跟其后的 `.equity`，这就是"重叠"。这个诊断是纯 CSS/JS 静态推导所得，逻辑上能同时解释两个症状，但受限于上述工具限制，没有像桌面那样用真实设备截图复核。

**修复**：把决定 pin 几何形状的高度值从 `vh` 换成 `svh`（small viewport height——固定按地址栏展开的最小视口计算，不会随地址栏收放而跳动）：`.stardrive-stage`/`.stardrive.is-live` 的 `height`（含 640px 断点的 170vh）、原生 `@keyframes stardrivePin` 的 `translateY(100vh)`、以及 `.strip` 的 `bottom:6vh/5vh` 偏移，全部改为 `svh`，和 `.hero` 早先移动端用 `min-height:100svh` 的思路一致。纯装饰性的进场/出场渐变高度（`::before`/`::after`、canvas 的 mask-image）保持 `vh` 不动，未在改动范围内。桌面端 `svh` 等于 `vh`（无地址栏可收起），理论上零视觉变化；真机复核（`?fx=stage`，Chrome DevTools 真实滚轮）确认桌面端 gap 依旧是 0、`--forge` 正常推进，无回归。644/644 测试通过，`!important` 基线不变（2960/2960, 2/2），部署 READY，commit `493eea7`。**移动端本身的效果尚待站主真机确认**——这是本轮修复中唯一没能由我自己验证到底的部分，如实告知。

### 30j · R3（sectors 力导向图）+ R4（signal 视差时间轴）+ 重构线收尾（2026-07-17，站主指令「30c 剩下的全做完」，一次性 R3+R4+重构线全上，明确跳过 R0）

站主在 30i 之后追加指令，明确要求把 30c 路线图剩余项一次做完；经问询确认范围——跳过 R0（真机验收/Lighthouse 基线，沙盒做不到），R3+R4+重构线一次性全上。

**R3 · sectors.html 力导向图**：新增 `src/lib/forceGraph.js`（纯函数物理引擎——两两斥力 + Hookean 弹簧连线 + 弱引力锚点，固定步长 Euler 积分器，同 flightPath/cameraMath 一脉的自研打法，U30 30a 裁决"D3 全家桶不值"的具体兑现）+ `tests/forceGraph.test.js`（12 项黄金集：节点/连线去重计数、AVGO 跨 vendor 去重成 1 个节点 2 条连线、competitor 关系记为斥力连线、US/CN 极点固定不动、稳定后两大阵营按 x 轴分离、competitor 节点比 direct 节点离 vendor 更远、稳定后任意两点最小间距>0、空数据/空图不抛错、同 seed 确定性复现）。`src/lib/sectorsGraphView.js` 是 DOM/canvas 那一半（不写测试——同 alphardForge.js 先例，DOM/canvas 触达的视觉层在本仓库一律靠真机复核而非 vitest）：Canvas 2D 渲染、IntersectionObserver 门控的 rAF 循环（不可见时不烧 CPU）、鼠标/触摸的 pan（拖空白区）/zoom（滚轮/双指）/拖拽节点（拖起时钉住 fx/fy，松手回弹）/点击开详情卡，移动端按置信度截断每个 basket 最多 8 个 equity 节点。`sectors.html` 把原本直出的 `#mwGrid`/`#mwBaskets`（矩阵表）让位给新的 `<canvas id="mwGraph">` + 详情卡 `#mwDetail`，旧矩阵表原样保留，收进一个 `<details class="mwMatrix">` 折叠区（渐进披露，未删除任何既有内容/文案）。`public/styles/sectors.css` 追加 `.graphWrap`/`.mwGraph`/`.mwDetail`/`.mwMatrix` 等新规则，复用页面已有的 acid/cyan 调色板变量，不引入新的层级架构（见下方重构线①的说明）。

**R4 · signal.html 视差时间轴**：`.compass`（鹰鸽罗盘）改 `position:sticky`——这页的 html/body 没有设置 `overflow-x:hidden`（首页那个 bug 是首页专属），所以原生 sticky 直接能用，不需要 R2 那套 JS pin-fixed 兜底。为了让"罗盘置顶、其余内容在它下方滚动"只在合理范围内生效（而不是黏到页尾），把 `.compass`→`.pillars`→`.files`→`.incidents`→`.watch`（原本就是连续的兄弟节点，零重排）包进新增的 `.signalScroll` 包裹层，sticky 的停止边界就是这个包裹层的底部。事件簿卡片（`.incident`）用 `animation-timeline:view()`（R2 引入的同一浏览器原生特性，此处按卡复用，零新增 JS/scroll 监听）各自独立触发入场动画——同一个 keyframe 但 `nth-child(even)` 换一条 `animation-range`更宽、位移方向相反的变体，让相邻卡片入场速度/方向明显不同（"错速浮入"），而不是所有卡片同步淡入。`prefers-reduced-motion` 汇入该文件既有的单个聚合媒体查询里关闭动画，与本文件既定写法一致。R1 已经做好的点击展开/收起（`document.startViewTransition`）完全未受影响——两套机制互不冲突。

**重构线**：①`@layer tokens` 五件套——本轮对 `src/styles.css` 零改动（R3/R4 完全在 sectors.css/signal.css 两个独立文件里，本来就不用首页那套 legacy/tokens/components/overrides 层级），该规则字面上无新增违规可修；R2 遗留在 `@layer legacy` 里的 `.stardrive-scale`/`.fx-stage` 规则本可以顺手挪进 `components`，但那正是今天来回回滚过好几轮、刚刚稳定下来的同一片区域——纯架构收益、零用户可见影响、却有实打实的回归风险，权衡后**没有动它**，如实记录而非悄悄跳过。②新动效零 scroll 监听——`sectorsGraphView.js` 的 rAF 循环不是 scroll 监听（同 alphardForge.js 一样由 IntersectionObserver 门控可见性），R4 的 sticky/`animation-timeline:view()` 也是零 JS。③ R6 架构审视——`src/styles.css` 本轮停留在 7991 行，未增长（因为压根没碰）；`sectors.css`（+45行→175行）/`signal.css`（+18行→212行）的增量都是新加的独立小节，不是回填进旧规则堆。644/656（新增 12 项 forceGraph 黄金集测试）全绿，`!important` 基线不变（2960/2960, 2/2），`vite build` 干净通过。

**部署后追加的两轮修复（同日，真机浏览器复核时发现）**：初次部署（`4f2a982`）后用 Claude-in-Chrome 打开生产站 `feida.au/sectors.html` 复核，发现 `#mwGraph` 画布几乎空白，只有一条散落的橙色虚线。定位到两个独立问题，均已修复并重新部署：

1. **加载时序 bug**（`ffb5760`）：`window.AfflatusSectorsGraph` 由一个 `type="module"` 桥接脚本挂载，模块脚本默认延迟到解析完成后才执行；而调用 `renderGraph()` 的经典内联 IIFE 在解析时就同步跑，立刻发起 `fetch('/sectors-data.json')`。生产网络下这个小 JSON 请求总是比"桥接模块→`sectorsGraphView.js`→`forceGraph.js`"这条嵌套 import 链更快返回，于是 `renderGraph()` 第一次（也是唯一一次）执行时 `window.AfflatusSectorsGraph` 还不存在，命中静默 return 的守卫，canvas 缓冲区从此停在浏览器默认的 300×150，且没有任何报错或重试。修复：桥接模块挂载完 `window.AfflatusSectorsGraph` 后立刻 `dispatchEvent(new Event('afflatus-sectorsgraph-ready'))`，主 IIFE 监听这个事件重新调用一次 `renderGraph()`。

2. **物理引擎 bug**（`a90ceb3`，vitest 12 项黄金集未覆盖，因为夹具节点数太小没暴露出来）：
   - `pressure`（competitor）连线用的是**恒定大小的力**，不随距离衰减——真实数据（17 个节点）里任何仅靠一条 pressure 连线维系的 equity 节点（如 002230.SZ、9888.HK）完全没有回复力，会无限漂移（实测：结算半径从 220 次迭代的 32 一路长到 800 次迭代的 87+，从不收敛）。改成一个 rest length 更长（`springLength` 的 2.2 倍）的正规 Hookean 弹簧，保留"比 affinity 连线离得更远"的视觉意图，但有稳定平衡点。
   - `pole` 连线的锚定力施加在 `l.a`（被钉住的极点自己）身上，而不是 `l.b`（真正该被拉向极点的 vendor）——被钉住的节点在积分步里直接跳过受力（`fx`/`fy` 已设定时 continue），等于这股力从没起过作用（实测：`poleStrength` 从 0.01 加到 10，结算结果逐位一致）。改成施加在 `l.b` 上；`poleStrength` 默认值从 0.01 提到 0.1（旧默认值本来就是一个从未真正生效过的空摆设，现在它真的在起作用后需要重新配一个数量级，见下方验证数据）。
   - 连带把 `sectorsGraphView.js` 的 `camScale` 从写死的"假设图形稳定在半径 ~1.6 以内"改成读取当前 sim 实际结算出的最大半径来定— 真实数据稳定半径在 ~5.5 左右，写死假设会让图形挤在画布正中间一小团。

   用 `public/sectors-data.json` 直接验证：结算半径 5.56（220 次迭代内收敛，1000 次几乎不再变化）、`avgUSx=-2.87` / `avgCNx=2.69`（阵营正确分离）、无 NaN/Infinity。656/656 测试全绿（黄金集夹具太小，两个 bug 都没被现有断言覆盖，但也没被这次改动破坏），`!important` 基线不变（2960/2960, 2/2）。之后用 Claude-in-Chrome 在生产站实测：画布正确渲染出节点+连线+标签，点击节点弹出详情卡正常；signal.html 的 `.compass` sticky 效果也复核确认——置顶效果在 `.pillars`→`.watch` 整个滚动区间内正确生效（因页面在 `.signalScroll` 之后剩余内容不够长，实际观察到的现象是罗盘一直贴到页面滚动到底，属于无害的边界情况，不是重叠或断裂）。

## U29 · boot.html 重构为影院级太空空战引擎「AFFLATUS ENGINE」（2026-07-14 立项，站主 AAA 框架已确认接受）

**愿景（站主原文转译）**：电影级高强度狗斗模拟器，用户是导演——系统自主演出高保真太空战争，强调「工业暴力」美学、物理化飞行行为、大片级视觉反馈。设计哲学：一切服务「演出感 vs 美学」，AI 行为要**像表演，不像计算**。

**框架确认 + 本仓库落地裁决**（Lead Technical Director 角色下的诚实转换——boot.html 是 noindex 原型页，无 SEO/内容红线，是全站唯一可以放开手的沙盒；但以下四处按仓库既有裁决降档，其余照单全收）：

| 站主框架 | 落地裁决 | 理由 |
| --- | --- | --- |
| WebGPU + Deferred + Compute 粒子 | **P2 先 WebGL2 前向渲染 + instanced GPU 粒子（桌面 100k/移动 30k），WebGPU 作为 P5 评估门** | three 钉在 r160（U21 裁决），其 WebGPU 线当时未熟；U27 已写死 WebGPU 重估触发条件，boot 原型是测它的正确场地，但先让内容跑起来 |
| SharedArrayBuffer 零拷贝 | **P0 先做 COOP/COEP 头 spike**（vercel.json headers 仅对 /boot.html 加 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`），成了用 SAB，不成回退 postMessage+Transferable | SAB 需要 crossOriginIsolated；COEP 会波及 Google Fonts 等跨域资源加载方式，必须先在这一页隔离验证 |
| Zero DOM / SDF UI | **HUD 全画布化接受；导航坞站保留 DOM** | 可达性红线：链接必须可聚焦可点按（22c hover 依赖零容忍同源）；HUD 读数进 canvas 不损失任何东西 |
| Draco/Meshopt + Kitbashing/Trim Sheet | **程序化 kitbash 优先**（carrierHull/odinHull 模块化部件库已有基础），Draco 仅在引入外部 glTF 时启用 | 现站零外部资产管线，这是优势不是欠缺（离线零依赖、体积可控） |

**照单全收项**：HBT 分层行为树（战术意图层：甩尾/剪刀/编队机动）、Catmull-Rom 样条弹道、PID 6DOF 电传飞控（惯性/动量/推力响应）、Worker 仿真线程、确定性种子生成（Base62 hash 存配置）、滞后相机模拟 G 力体重感、屏幕空间折射核爆冲击波/色差/胶片颗粒/EMP UI 故障闪、新引擎模块用 **TypeScript**（`src/bootengine/`，vite 原生支持，与现有 checkJs 并存）。

**分期（每期一个会话，全部只动 boot.html + src/bootengine/，主站零接触）**：

- [ ] **P0 · RFC + 双 spike**：`rfcs/2026-07-1x-u29-boot-engine.md`（模块边界/数据流/预算表）+ COOP/COEP 头验证 + WebGPU 可用性探针（真机数据决定 P5 命运）。
- [x] **P1 · 仿真核（纯逻辑，沙盒可全验）**（2026-07-15 完成，先于 P0 开工——站主明确指定，无阻塞）：`src/bootengine/` TS 模块——PID 控制器、6DOF 刚体、HBT（意图选择→机动库→样条轨迹生成）、确定性种子；黄金集 vitest（同种子同轨迹逐帧一致、PID 阶跃响应无发散、HBT 意图切换覆盖）。Worker 壳 + 主线程消费接口。
- [x] **P2 · 渲染器 v1**：WebGL2 前向 + instanced 粒子系统（爆炸/推进器/碎片三池，顶点着色器仿真）、程序化 kitbash 舰队（复用既有部件模块拆件重组）、发光激光与装甲灼痕（动态 emissive/roughness 遮罩，RNM 降档为程序化细节法线）。**两个切片均已完成（见下方施工记录）：切片一（2026-07-15）程序化细节法线+灼痕材质，`?p2demo=armor`；切片二（2026-07-15 同日）instanced 粒子池三组 + kitbash 舰队复用 + 发光激光光束，`?p2demo=fleet`。两条 demo 场景独立并存，均待真机复核（沙盒无 WebGL）。视觉打磨（相机/编队节奏/命中反馈强度等）留作后续迭代，站主已确认「效果不错，之后可以继续打磨」。
- [ ] **P3 · 电影导演 v2**：滞后 G 力相机（复用 cameraMath smoothDamp 族）、Catmull-Rom 镜头轨、「演出优先」评分器（AI 机动选择时给镜头可看性加权——这就是「像表演不像计算」的实现机制）。
- [ ] **P4 · 后处理栈**：色差/胶片颗粒/暗角常驻，核爆屏幕空间折射冲击波、EMP UI 故障闪（HUD 画布 glitch pass）按事件触发。
- [ ] **P5 · WebGPU/Deferred 评估门**：P0 探针数据 + P2 帧率基线在手后，按 U27 触发条件裁决是否开 WebGPU 分支（TSL/compute 粒子 100k→500k 的想象空间在这扇门后面）。
- [ ] **验收纪律**：每期 vitest+构建全绿；视觉真机复核；boot.html 本就 noindex 原型——R3 flag 例外天然适用，随做随部署随看。

**P1 施工记录（2026-07-15）**：全部纯逻辑，零渲染、零 DOM，boot.html/main.js/主站零接触（严格只加文件，没碰任何既有文件）。新增 9 个模块 + 9 个测试文件：

| 模块 | 职责 | 关键设计取舍 |
| --- | --- | --- |
| `seed.ts` | 确定性种子（FNV-1a hash）+ Base62 编解码 + mulberry32 PRNG | 全引擎唯一随机源，机动库的方向抉择等全部经它，是「同种子同轨迹」成立的前提 |
| `pid.ts` | 单轴 PID，调用方持有状态（同 cameraMath.js 的 smoothDamp 惯例） | 积分器按 `integralLimit` 钳制防饱和，而非只钳输出——否则误差反向时会硬甩 |
| `rigidBody6dof.ts` | 6DOF 刚体半隐式欧拉积分 + 四元数姿态 + `rotateVectorByQuat` | 惯性张量简化为对角（忽略耦合项）——够用且可验证，满张量在无真实机体数据前无法验证 |
| `catmullRom.ts` | 样条轨迹生成，`sample(u)` 返回位置+切线（对 u 求导，非对时间求导） | 刻意不含时间模型——机动和运镜（P3）的节奏不同，由调用方乘以自己的 1/duration |
| `hbt.ts` | 通用行为树组合子（selector/sequence/condition/action）+ 固定优先级战术树 | 优先级：脱离(能量危急) > 剪刀(被咬近距) > 甩尾(被咬远距) > 追击(有射击位) > 归队(太远) > 保持编队 |
| `maneuvers.ts` | 意图→路点，六种意图各一个规划函数 | 路点第一点严格等于当前位置（样条保证精确过点），航向随机（甩尾左/右）走注入的 rng |
| `simCore.ts` | `stepSimFrame` 单帧纯函数，串联 HBT→机动库→样条→PID→6DOF | 状态字段全部是可序列化纯数据（路点数组而非样条对象）——专为 Worker postMessage 设计 |
| `worker/simWorker.ts` | Worker 壳，~40 行 | 本地声明 `self` 类型避免与 tsconfig 现有 `dom` lib 冲突，不拆分 tsconfig |
| `index.ts` | `createSimClient()` 主线程消费接口 | 有 `Worker` 全局+ `workerUrl` 才走 worker 路径，否则内联 fallback；两路径行为对等 |

**验证**：71 个新测试（含黄金集：跨两次独立 run 逐帧 `toEqual`、PID 阶跃响应收敛不发散、HBT 六分支全覆盖、`structuredClone` 往返不丢数据），全站 vitest **617/617**（546 基线 + 71 新增）、`tsc --noEmit` 干净、`vite build` 干净（`src/bootengine/` 未被任何入口引用，构建产物零变化，符合「本期只验证不接线」的范围）。P0（RFC 文档 + COOP/COEP 头 spike + WebGPU 探针）尚未开工，不阻塞 P1——已记录为下一可选阶段。

**P2 第一切片施工记录（2026-07-15，材质技术验证，非完整 P2）**：

- **新增**：`src/bootengine/render/armorMaterial.ts`（`MeshStandardMaterial.onBeforeCompile` 注入——surface-gradient 程序化细节法线（Mikkelsen 方法，靠 world-space `dFdx`/`dFdy`，不需要 UV/切线基，WebGL2 原生支持）+ 灼痕遮罩驱动 diffuse 变暗/roughness 上升/emissive 裂纹发光脉冲）、`src/bootengine/render/armorDemoScene.ts`（独立 THREE 场景，一个细分 IcosahedronGeometry + 双色温布光，`{start,stop,resize}` 接口对齐 `createTopdownCombat`，方便未来互换）。
- **接线**：`src/pages/boot.js` 新增 `?p2demo=armor` opt-in flag——命中时 `runArmorDemo()` 跳过正常 boot 序列直接挂载 demo 场景到既有 `#bridgeCanvas`（复用现有 `sizeCanvas`/resize/visibilitychange 逻辑，因为两个场景工厂函数返回同型接口），不命中则完全走原有 `boot()` 流程——**默认行为零改动**。`topdownCombat.js`/`main.js` 未碰。
- **新依赖**：`@types/three@0.160.0`（devDependency，precise 版本匹配已安装的 `three@0.160.1`）——P1 的纯逻辑模块不需要 three 类型，P2 一旦碰渲染就需要，这是第一次。
- **验证**：`tsc --noEmit` 干净、`vite build` 干净（`armorDemoScene` 被拆成独立动态导入 chunk，4.75 kB，只在 flag 命中时才加载；`vendor-three`/`topdownCombat` chunk 字节数与改动前完全一致，证明共享场景模块确实零接触）；vitest 保持 617/617（本切片是渲染/shader 代码，沙盒无 WebGL 上下文，vitest 层面无新增测试，走这个项目一贯的「沙盒不能渲染 → 待真机打开验收」路径）。
- **预览**：`https://feida.au/boot.html?p2demo=armor`（部署后）。**本地未部署 push——23:00 后触发 R4「深夜只写不并」，代码已完成但尚未推送**，见下方施工记录后的说明。

**P2 第二切片施工记录（2026-07-15/16 跨夜，粒子池 + 舰队 + 激光光束，补完 P2 剩余范围）**：

- **新增**：
  - `src/bootengine/render/particles.ts` — 共享 GPU 粒子池引擎（`THREE.Points` + `onBeforeCompile` 之外的独立 `ShaderMaterial`，顶点着色器直接从 `aSpawnTime`/`aVelocity`/`position`(=出生点) + `uTime` 算当前位置，零 JS 逐粒子 update 循环）+ 环形缓冲区 spawn（第 N 次 spawn 覆盖第 `N mod poolSize` 槽，满了自动回收最旧粒子，同 `topdownCombat.js` 的 `trailMesh` 回收惯例）。导出三组预设 `createExplosionPool`/`createThrusterPool`/`createDebrisPool`（共用一份 shader，只调生命周期/颜色/重力/尺寸曲线）。`nextSlot`/`lifePhase`/`isAlive` 三个纯函数独立导出，供 vitest 直接验证环形索引与生命周期数学（沙盒无 WebGL，这是「能验证的那一部分」，同 `odinHull.test.js` 验证比例数字而非像素的思路）。
  - `src/bootengine/render/kitbashFleet.ts` — 复用**既有** `src/scene/carrierHull.js`/`odinHull.js`（两者本来就是 DOM/WebGL-free 的纯部件生成函数，THREE 由调用方传入，零内部 import，确认可安全从 `bootengine/render/` 复用而不牵连 `topdownCombat.js`/`main.js`）。一艘 `createCarrierHull` 旗舰 + N 艘缩小版 `createOdinHull` 护卫舰，编队槽位由 `computeFormation(rng, escortCount)` 纯函数决定（同种子同编队，vitest 验证）；护卫舰内部的铆钉/panel 散布仍是两个 hull 文件自己的裸 `Math.random()`，本模块**没有**去改那两个既有文件强改成确定性——如实记录为已知不完整确定性，不是疏漏。挂载点（引擎/主炮）以子 `Object3D` marker 形式挂在每艘船的 Group 下，`getWorldPosition()`/`getWorldQuaternion()` 随船体变换实时取值。
  - `src/bootengine/render/laserBeam.ts` — 独立于 `armorMaterial.ts` 灼痕遮罩的光束本体（那是命中后的伤痕，这是飞行中的光束本身）：定制 `ShaderMaterial`，圆柱 UV.x 到中线的距离当「面向摄像机程度」的廉价代理（核心亮、轮廓暗），UV.y 驱动沿光束长度的能量脉冲流动，`fire(t,from,to)` 一次性定向缩放+触发淡出计时。与 `topdownCombat.js` 现有 `fireLaser`（拉伸圆柱 + `MeshBasicMaterial` 平涂）并存，不替换、不接触该文件。
  - `src/bootengine/render/p2FleetDemoScene.ts` — 整合三者的独立 demo 场景：种子化舰队（固定种子 `afflatus:p2demo:fleet`）+ 每艘船引擎挂载点持续喷推进器粒子（逐帧节流一半，避免 600 槽粒子池被 30+ 挂载点的全量喷发过度回收）+ 周期性随机两船互射（3 组并发光束循环复用）+ 命中点触发爆炸/碎片两池齐射，三组粒子池在一个场景里全部被真实驱动到。程序化天空环境反射代码与 `armorDemoScene.ts` 同款但独立复制一份（两文件都很小、自包含，为了不去动已验收过的装甲 demo 而故意不抽公共模块）。
  - `src/scene/carrierHull.d.ts`、`src/scene/odinHull.d.ts` — 两个纯新增的 ambient 类型声明文件（项目 `tsconfig.json` 全局 `allowJs:false`，TS 侧引用既有 `.js` 模块必须有 sidecar `.d.ts` 才能过 `strict` 检查；只声明本次实际用到的形状，非该模块的完整类型面）。
- **接线**：`src/pages/boot.js` 新增 `?p2demo=fleet` opt-in flag，`runFleetDemo()` 与既有 `runArmorDemo()` 同款写法（跳过 boot 序列/dock/telemetry，直接挂载到 `#bridgeCanvas`）；`if (P2_ARMOR_DEMO) {...} else if (P2_FLEET_DEMO) {...} else { boot(); }`——默认路径（两个 flag 都不命中）逐字节未变。
- **构建图谱的诚实说明（不是「零接触」，是「零编辑」）**：`kitbashFleet.ts` 复用 `carrierHull.js`/`odinHull.js` 是本次唯一让构建产物字节数出现变化的地方——这两个文件本来只被 `capitalShip3D.js`/`shipHologram.js` 引用，现在多了 `kitbashFleet.ts` 这第三个引用方，Rollup 因此把 `carrierHull.js` 拆成一个独立共享 chunk（`carrierHull-*.js`，11.19 kB）而不是继续内联进每个消费者——这是构建工具对「同一依赖被更多入口共享」的正常分包决策，不是这两个文件的源码被改了（`git diff --stat` 确认：本次唯一改动的既有文件是 `src/pages/boot.js`，`carrierHull.js`/`odinHull.js`/`capitalShip3D.js`/`shipHologram.js`/`topdownCombat.js`/`main.js` 全部零编辑）。连带效应：`vendor-three` chunk 字节数从 674.51 kB 微调到 674.53 kB（多一个 `three` 的消费者，Rollup 的模块拼接顺序/压缩变量命名跟着微调，属已知的、无害的构建期副作用，不是 three 本身代码变了）；`topdownCombat-*.js` 自身字节数确认不变（30.39 kB，逐次构建一致）。
- **新依赖**：无（复用已有 `@types/three`）。
- **验证**：新增 16 个测试（`nextSlot`/`lifePhase`/`isAlive` 10 个 + `computeFormation` 6 个，含黄金集式「同种子同编队」用例），全站 vitest **633/633**（617 基线 + 16 新增）、`tsc --noEmit` 干净、`vite build` 干净（`p2FleetDemoScene` 独立动态导入 chunk，10.01 kB，只在 flag 命中时加载）。渲染/shader 部分本身仍是沙盒无 WebGL 上下文验证不到的那一半，走这个项目一贯的「代码正确性能证明，像素清晰度/节奏手感待真机复核」路径。
- **预览**：`https://feida.au/boot.html?p2demo=fleet`（部署后）。**本地未 push——R4「深夜只写不并」，跨过 23:00 后继续写但不推送**，与切片一的说明同理。

**P2 舰船外观返工（2026-07-16 夜，两轮，站主反馈「所有战舰都画的太丑了」）**：

- **v1（首轮）**：`src/scene/wedgeCruiserHull.js`（+ `.d.ts`）——新船体生成函数，与 `carrierHull.js`/`odinHull.js` 同款 DOM/WebGL-free `add()` 回调契约。宽平甲板六边形截面 loft、尾部收窄成尖头、背脊双塔舰桥、中线沟槽（当时还是装饰性暗色贴条，非真实几何）、贯穿全宽的尾部引擎排——歼星舰那类楔形廓形的原创执行，比例/细节/命名均为本文件原创，非复刻任何具体工作室资产。`kitbashFleet.ts` 旗舰与护卫舰统一换装这艘新船（两种缩放），不再混用三种船型。新增 `tests/wedgeCruiserHull.test.js`（9 用例，同 `odinHull.test.js` 的无头验证思路：轮廓比例、挂载点数量与镜像、卷绕法线）。
- **v2（次轮，按站主提供的 AAA 硬表面管线指南重做）**：指南本身提出四条技术路线（CAD/Plasticity 建模、外购 kitbash 素材包、Trim Sheet+法线烘焙、WebGPU+Deferred+POM）。逐条可行性判断记录如下——**CAD 工具**（Plasticity/MoI3D）是桌面 GUI 软件，沙盒无法启动，只能站主本机操作后导出 glTF 再接入；**外购素材包**（ArtStation/Gumroad）无法代为购买，且引入外部贴图/UV 资产管线与本项目「零外部资产依赖」的既定架构相悖；**Trim Sheet 法线烘焙**（Substance Painter）同样是桌面软件且需要 UV 管线，本项目从 P2 装甲材质那次起就是刻意选择程序化 surface-gradient bump 绕开 UV 需求，这条路径方向相反；**WebGPU+Deferred+POM** 是与当前 WebGL2 前向渲染完全不同的渲染路径，且 WebGPU 本就是 U29 P5 的评估门，尚未开工，不在这次范围内。**唯一在当前沙盒里真正可执行、且被指南明确列为具体技术项的**：InstancedMesh 降低重复部件的 draw call——这条被采纳并落地。同时把指南里"翻译得动"的其余要求（结构性中央沟槽、分层甲板、双护盾发生器 Fresnel 边缘光、引擎发光对比度）用本项目已有的程序化手法实现，指南里依赖外部工具的部分（真实倒角、Trim Sheet、法线烘焙、AO 贴图磨损、POM）明确未做，注释里写清楚了为什么。
  - 中央沟槽从贴条改成真实几何凹陷（下沉地板 + 两侧凸起护栏），沟槽深度按 `stations` taper 表验证过全程都在对应站位的甲板高度之下，不会露出悬空。
  - 分层甲板：两层叠放平台（`tier1`/`tier2`），模拟"boolean 分层"的台阶感。
  - 双护盾发生器：两颗小球，`createShieldDomeMaterial` 是一个新的小型自定义 `ShaderMaterial`（`pow(1-N·V, k)` 菲涅尔边缘光，加色混合），球体内层用暗色材质垫底让边缘光有东西可"衬"。
  - 引擎发光：独立的高强度 `engineGlowMat`（emissiveIntensity 4.5，不再共用调用方的中等强度 `mats.glass`/`mats.blue`），机舱做了向前凹陷处理，制造"最亮点"的对比度。
  - 舷窗散点：新增，`PlaneGeometry` 小片沿船体两舷散布（220/full，80/wire），按 `stations` taper 实时插值贴合船体宽度，不会浮空或陷进船体——指南里"看到窗户才会觉得这是一座城市"那条最低成本的等价实现（没有 light map/顶点色烘焙）。
  - 炮塔（12 座塔身+24 根炮管）、船体铆钉散布、舷窗全部改用 `addInstanced(geo, mat, transforms)` 走 `THREE.InstancedMesh`——这是本文件新增的第二个回调（`add`/`odinHull.js`/`carrierHull.js` 的既有契约只有 `add`，这次为了真正做到"重复部件不逐个 draw call"扩展了一个专用回调，`kitbashFleet.ts` 里新增 `makeAddInstanced` 实现它）。5 次 `addInstanced` 调用承载 100+ 个实例化部件，`full`/`wire` 只改变每次调用内的实例密度，不改变调用次数——测试里专门断言了这一点。
  - 陡边高光：无法在手写 `BufferGeometry` 上做真正的 CAD 变半径倒角，退而求其次沿船体两条肩线分段加装凸起装饰条，起同样"接受高光、暗示体量"的作用。
- **测试更新**：`tests/wedgeCruiserHull.test.js` 从 9 条扩到 11 条，测试 harness 新增 `addInstanced` 桩实现（真建 `THREE.InstancedMesh` 并 `setMatrixAt`），新断言覆盖 `shieldMounts` 镜像、`wire`/`full` 的"总部件数变但 draw call 数不变"。
- **验证**：`tsc --noEmit` 干净、`vite build` 干净（`p2FleetDemoScene` chunk 14.96 kB，`vendor-three`/`topdownCombat`/`capitalShip3D`/`shipHologram` 字节数与上一次构建一致，`git diff --stat` 确认本轮只改了 `wedgeCruiserHull.js`/`.d.ts`/`kitbashFleet.ts`/其测试文件）、vitest **644/644**（642 基线 + 2 新增）。
- **预览**：同上，`?p2demo=fleet`。本地已提交，未 push（R4）。

**P2 光影质感返工（2026-07-16 夜，第三轮，站主提供第二份指南：真·WebGPU + 延迟渲染 + G-Buffer + POM + SSR）**：

- **裁决过程**：这份指南和上一份（AAA 硬表面建模指南）性质不同——上一份是"给现有 WebGL2/GLSL 管线加技法"，这份要求的是完全不同的渲染架构（WebGPU、G-Buffer 延迟渲染、真 POM 光线步进、SSR、WGSL）。在动手前先用 `AskUserQuestion` 把这个规模差异摊开给站主：真做 WebGPU 重写不是调参数，是重写整个渲染管线；`Urgent.md` 里 U29 自己的规划早就把 WebGPU 列为「P5 评估门」，明确要先跑完 P0 真机探针数据才能决定要不要开，现在 P0 还没开工；加上沙盒没有 GPU/显示能力，这种量级的重写没法边写边验证，风险高。**站主选择"两者都要，先做近似效果再讨论 WebGPU"**——于是这一轮只做 WebGL2 管线内能落地、有真实效果、风险可控的部分，WebGPU 立项单独记录在下面，留给专门的会话处理。
- **本轮落地（`src/bootengine/render/p2FleetDemoScene.ts`）**：
  - **ACES Filmic 色调映射**：`renderer.toneMapping = THREE.ACESFilmicToneMapping`（three 内置，不是手写近似），`toneMappingExposure = 0.95`。指南要求的"阴影更深邃、亮部更有质感"，这条最省成本地兑现了。
  - **真实 Bloom 泛光**：接入 three 自带的 `EffectComposer`/`RenderPass`/`UnrealBloomPass`/`OutputPass`（不是手写的伪泛光），阈值 0.82（卡住引擎发光/护盾菲涅尔/舷窗这些高 `emissiveIntensity` 部件，不误伤灰色船体），`resize()` 里同步 `composer.setSize`/`bloomPass.setSize`。这是指南"引擎光/舷窗才是全船最亮点"这条视觉逻辑真正生效的关键一步。
  - **边缘轮廓光重新布置**：`rimLight` 强度 0.5→0.95，位置推到更低的掠射角——用灯光角度而非逐材质菲涅尔 shader 兑现"金属转角要有一圈锐利高光"，成本低、效果真实，但不如全船菲涅尔 shader 精细（那个留作下一步可选增量，未做）。
  - **明确未做**（超出这轮范围，如实记录，不是漏掉）：全船 Fresnel 菲涅尔 shader（目前只有护盾罩有）、舷窗按时间闪烁（目前是静态散点）、G-Buffer 延迟渲染、真 POM 光线步进、SSR 屏幕空间反射、WGSL/WebGPU 渲染器本体。
- **构建影响的诚实说明**：`three/examples/jsm/postprocessing/*`（`EffectComposer`/`RenderPass`/`UnrealBloomPass`/`OutputPass`）被 Rollup 并进了 `vendor-three` 共享 chunk（而不是单独进 `p2FleetDemoScene` 的动态导入 chunk），因为 vite 的默认分包策略按 npm 包名分组，这几个模块虽然只有 `p2FleetDemoScene.ts` 一处引用，但物理上仍属于 `three` 包。影响：`vendor-three` 从 674.53 kB 涨到 677.14 kB（gzip 171.28→171.79 kB，约 +0.5 kB gzip），这个 chunk 是跨页面共享的，意味着即使是不用 fleet demo 的页面，只要用到 `vendor-three` 也会多下载这几百字节——量级很小，但如实记录而不是含糊带过。`topdownCombat`/`capitalShip3D`/`shipHologram`/`odinHull` 字节数不变，`git diff --stat` 确认这轮唯一改动的既有文件是 `p2FleetDemoScene.ts`。
- **验证**：`tsc --noEmit` 干净、`vite build` 干净、vitest **644/644**（本轮是纯渲染管线配置代码，无新增可无头验证的纯函数，同 P2 第一/二切片的验证边界）。
- **WebGPU 重写 —— 单独立项，未开工**：站主明确希望后续讨论。落地前置条件按 U29 自己的规划走：先做 P0（RFC 文档 + COOP/COEP spike + WebGPU 可用性探针，真机数据），拿到探针结果后再按 U27 触发条件裁决 P5 是否真的切 WebGPU 分支。真做的话范围也不小：G-Buffer 多目标渲染 + 延迟光照 pass、POM 光线步进 shader（需要高度图，本项目零贴图管线，得先决定这张图怎么来）、SSR（依赖延迟渲染的深度/法线缓冲）、WGSL 重写现有材质。这些都需要真机反复调参验证，不适合在沙盒里盲写。
- **预览**：同上，`?p2demo=fleet`。本地已提交，未 push（R4）。

**P2 排障（2026-07-16 夜，站主反馈"没有看到页面上有战舰"）**：

- **先尝试真的起一个浏览器去看**：装了 Playwright + Chromium headless shell，`launch()` 报缺系统依赖（`libxdamage1` 等），`sudo npx playwright install-deps` 因沙盒禁止提权（no new privileges + 容器限制）打不了补丁——确认了这个沙盒**物理上无法起真实浏览器**，不是不愿意做，是做不了。
- **退而求其次，直接跑真实构建代码而非猜**：写了两个临时 vitest 诊断脚本（跑完即删，未提交）——① 直接调用 `createKitbashFleet()`，遍历整棵场景图统计真实网格数：270 个常规 Mesh + 25 个 InstancedMesh、约 11905 个三角形，世界包围盒 `x:[-11.1,10.5] y:[-1.05,2.99] z:[-16.98,7.4]`——**几何体本身是好的，没有抛异常、没有退化成空几何**。② 用 `p2FleetDemoScene.ts` 里完全一致的相机参数（位置/朝向/FOV）构造真实 `THREE.PerspectiveCamera` + `THREE.Frustum`，把舰队包围盒的 8 个角点 + 中心投影到 NDC 坐标——9/9 个点全部落在屏幕内，`frustum.intersectsBox()` 也是 `true`——**相机取景也是对的**。这两项排除了"几何体是空的/抛错了"和"镜头没对准"这两个最大嫌疑。
- **锁定嫌疑到最新加的 Bloom 后处理链**：剩下没法验证的就是真正需要 GPU 的部分——`EffectComposer`/`UnrealBloomPass` 这条链从写完到现在从没在真实 WebGL 上下文里跑过一次。`UnrealBloomPass` 内部用半精度浮点纹理做模糊缓冲，如果某些 GPU/驱动不支持会在运行时抛错；而 `runFleetDemo()`（`boot.js`）当时的 `try/catch` 只包住了 `import()` 那一行，没包住 `createFleetDemoScene()` 的调用和之后的渲染循环——一旦 `composer.render()` 在某一帧里抛错，`requestAnimationFrame` 链会静默断掉（那一帧连 `if (running) raf = requestAnimationFrame(loop)` 都不会执行到），画布就永远停在初始的纯色背景（`0x03050a`，深藏青近黑）上——**这和"看起来像什么都没有"完全吻合**。
- **修复**：给 `composer` 的构造和每帧的 `composer.render()` 都包了 try/catch——失败就把 `composer` 置空，永久回退成 `renderer.render(scene, camera)` 直接渲染（用的是同一套已经验证过是对的 scene/camera/灯光/材质），不会因为泛光链出问题就把整个 demo 拖黑。ACES 色调映射本身风险很低（three 内置的单一属性赋值），继续保留。
- **验证**：`tsc --noEmit` 干净、`vite build` 干净（chunk 字节数与上一版一致）、vitest 644/644。`git diff --stat` 确认只改了 `p2FleetDemoScene.ts`。
- **仍然如实说明**：这个修复能保证"不会因为泛光链的问题导致整个画面消失"，但**没法确认之前具体是不是这个原因**——沙盒没有可用的 GPU/浏览器，这次的排查已经是这个环境下能做到的极限（跑真实构建代码而非猜测），像素级别的最终确认还是要站主真机看。
- **预览**：同上，`?p2demo=fleet`。本地已提交，未 push（R4）。

**P2 排障续（2026-07-16 夜，站主反馈"只能看到一片亮光"）**：上一条修复生效了一半——不再是黑屏（说明渲染循环确实在跑），但整艘船糊成一片过曝的亮团，认不出形状。根因：`kitbashFleet.ts` 的 `buildMats()` 从没给任何材质设过 `envMapIntensity`，全部吃默认值 1.0，配合最高到 0.6 的金属度，把 `p2FleetDemoScene.ts` 那张偏亮/近白的天顶天空环境贴图整面反射到全船——这正是 `armorMaterial.ts` 本次会话早些时候撞过并修过的同一类问题（那次调到了 0.5），`kitbashFleet.ts` 的材质当时没有跟着一起改。叠加上一轮刚加的 Bloom，大片过曝表面一起超过泛光阈值，糊成一整块光斑而不是船体细节+局部发光点。**修复**：`buildMats()` 全部材质加 `envMapIntensity: 0.4`；Bloom 阈值 0.82→0.92、强度 0.9→0.55（收紧到只有真正的发光部件——引擎/舷窗/护盾——还能触发）；`toneMappingExposure` 0.95→0.8 留更多余量。验证：tsc/build/vitest 全绿（644/644，chunk 字节数不变），`git diff --stat` 确认只改了 `kitbashFleet.ts`/`p2FleetDemoScene.ts` 两个文件。本地已提交，未 push（R4）。

**P2 排障第三轮（2026-07-16 夜，站主发截图 + 反问"你觉得我能看到战舰的轮廓吗"）**：上一条修复也不够——截图显示画面**完全没有任何硬边缘**（连背景天空渐变的过渡带都是糊的），只有一个圆形亮核心 + 一道横向亮拖尾，是一整张软糊图，不是"船体过曝但还有轮廓"。这个特征和单纯的亮度/曝光问题不是一回事：如果是曝光过高，至少船体边缘、天空渐变带这些高频细节还会在，只是偏亮；**全图无差别地糊，是渲染目标分辨率不对（太小的 buffer 被拉伸铺满画布）的典型特征**，不是调阈值/强度/曝光能解决的量级问题。
- **诊断而非再猜**：这条链（`EffectComposer`/`UnrealBloomPass`/`RenderPass`/`OutputPass`）从写下第一行代码起就从没在真实 WebGL 上下文里跑过一帧——沙盒物理上起不了浏览器（上上一轮已确认），过去两轮的调参（阈值/强度/曝光）全部是盲改，且都失败了。继续在一个零反馈通道上猜参数不是负责任的工程方式；正确做法是**把这块不可验证、复杂度最高的拼图整个拿掉**，退回到"改动前已验证能工作"的基线，而不是继续叠加猜测。
- **修复**：`p2FleetDemoScene.ts` 里彻底移除 `EffectComposer`/`RenderPass`/`UnrealBloomPass`/`OutputPass` 的 import、构造（含之前两轮加的 try/catch 防御）、每帧 `composer.render()` 调用、`resize()` 里的 `composer.setSize`/`bloomPass.setSize`——渲染循环和 resize 都退回纯 `renderer.render(scene, camera)` / `renderer.setSize()`。保留两处独立、低风险、且已知有效的修复：ACES Filmic 色调映射（three 内置单一属性赋值，无额外渲染目标，风险类别和 Bloom 完全不同）、`kitbashFleet.ts` 的 `envMapIntensity` 修复。`toneMappingExposure` 从 0.8 恢复到 0.95——0.8 是专门为补偿 Bloom 叠加放大而调低的，Bloom 已移除，该补偿不再需要。
- **构建影响**：`vendor-three` chunk 应会因为不再打包 `three/examples/jsm/postprocessing/*` 而缩小（上一轮记录过它曾从 674.53 kB 涨到 677.14 kB），本轮构建已确认 `p2FleetDemoScene` 自身 chunk 变小。
- **验证**：`tsc --noEmit` 干净、vitest 51 文件/644 测试全绿、`npm run build` 干净。`git diff --stat` 确认只改了 `p2FleetDemoScene.ts` 一个文件。本地已提交（`62a93a4`），未 push（R4）。
- **如实说明**：这是"减法"修复——去掉了一个从未验证过的风险源，回到已知能工作的渲染路径，但**没有独立证据证明退回后的画面本身是完美的**（同样受限于沙盒无 GPU/浏览器，无法看真实像素）。如果退回纯 `renderer.render()` 后仍然过曝或异常，下一步该检查的是：舷窗/引擎发光材质的 `emissiveIntensity`（引擎盘 4.5、舷窗 2.2 是否本身就偏高）、三条环境光（Ambient 1.2 + Key 1.5 + Rim 0.95）叠加总量、以及 `laserBeam.ts` 纯白 `0xffffff` 核心颜色——但这些只有在排除了 Bloom 这个最大不确定性变量之后才值得逐个排查，而不是继续在同一条不可验证的链上打转。Bloom 若要重新引入，应等这个环境具备真实浏览器验证能力之后再做。

## U28 · serial 皇家木色重做 + 首页断层/星门/HUD 修复批 → v1.6（2026-07-14 立项，站主四张截图）

> 八个子项，两批施工：**批一 = 28a**（serial.html 独立，互不影响）；**批二 = 28b–28h**（首页，做完版本号升 v1.6）。截图不入库，下述文字即实施依据。**2026-07-14 两批全部实施完成，代码/测试/构建侧已验证，详见下方施工记录——视觉观感待站主真机复核。**

### 28a · serial.html 阅读器（图1）

- [x] **删除米黄纸感主题**：`serial.html:103` 的 `.swatch.s-cream` 按钮 + `public/styles/serial.css` 的 cream 主题变量组整体移除，默认主题改为新「皇木」主题（下条）；`meta theme-color` 同步。
- [x] **新「皇木」主题**（网页+移动，融合四种明朝皇家木材，基调高贵典雅、暗色偏暖护眼）：底色 = 小叶紫檀深栗紫（御用贡木的沉稳基座，约 `#2B1A16`→`#231411` 渐变）；正文纸面 = 金丝楠暖褐带「金丝」纹理（`repeating-linear-gradient` 细金线 + 低不透明度木纹波纹，光泽感靠 1–2% 亮度起伏，不引图片资产）；正文字色 = 海南黄花梨暖金黄（油润贵气，约 `#E3C287`，对比度过 WCAG AA）；强调/边框 = 金丝高光（约 `#D9A956`）；皇木（深山巨楠）做超暗段落分隔与页脚沉底色。四色全部进主题变量组，与现有 night 主题并列。
- [x] **移动端工具栏两钮加长一倍**：自动翻页 `▶` 与无限流 `∞` 按钮宽度 ×2（触控目标顺带过 44px，22c 欠账一并清）。

### 28b · 首页 hero→星门断层修复（图2，网页+移动）

- [x] 「bearing · singular throne」到 alphardForge 段之间：① 删掉中间莫名的长空距（U13d 收过一轮但真机仍在——这次以真机截图为准重新审计实际生效的 margin/padding cascade，注意 `:root` 值可能又被文末覆盖块接管，U11 同款陷阱）；② **边缘过渡割裂**：alphardForge 画布顶部加渐变遮罩（`mask-image: linear-gradient(black→transparent)` 或画布内顶部渐隐带），让青色星云从纯黑星空**无缝浮现**而不是一条硬横线；青色起点端改深色（约 `#021418`）渐入，与宇宙背景衔接。

### 28c · alphardForge 星门渲染（图3）

- [x] **中心过曝修复**：核心纯白爆掉 → 内圈改 `#99FAFF`、内圈之外改 `#00F0FF`，压低核心亮度/bloom 阈值，保证星门结构与两侧塔柱剪影可读。
- [x] **滚动联动耀斑**：页面上下滚动驱动高能电场/恒星耀斑效果——shader 加 `uScroll` uniform（rAF 内 lerp 滚动进度，禁止 scroll 监听里计算），滚动越快耀斑脉冲越强，静止时回落呼吸态。
- [x] **星云磁场顺时针慢旋转**：星云层 uv/平面持续顺时针旋转（~0.5°/s 级，缓慢庄重）。

### 28d · Combat View 背后漂浮透明元素清除（图2，网页+移动）

- [x] 3D 战场背后可见多余的滚动/漂浮半透明元素——站主裁定**本就不应存在，全部删除**。第一嫌疑：V18 Phase 2 的近景尘埃+速度拉伸粒子层与 Phase 3 的 lens ghost 双鬼影（`topdownCombat.js`）；删后真机复核若仍有漂浮物，排查 `.hud-grid`/`.hud-scan-line` CSS 层在 pilot 面板区的透出。
- [x] **真机复核追加发现（2026-07-14 同日，站主二次报告仍有漂浮物）**：真正根因是 `.hud-grid`/`.hud-scan-line`——两者是 `#combatHud`（`inset:0`，z-index 110，盖过整个场景包括 U8 明确要留空的中央视野）的直接子元素，且各自都有一份后来才做、正确限定在 `.hud-panels` 自己范围内的等价替代（`.hud-panels::after` 的网格纹理、`.hud-panels::before` 的透视扫光，同一套 `sweepPct`/`sweepAlpha` 数值）——是清理 `.hud-panels::before/::after` 时忘了删的旧版重复实现。`index.html` 两个 div、`styles.css` 三条规则、`main.js` `drawRadar()` 里的 `--oracle-sweep-x`/`--oracle-sweep-alpha` 写入，全部整体删除（`--hud-sweep-x`/`--hud-sweep-alpha` 不受影响，`.hud-panels::before` 仍照常用）。

### 28e · HUD 标尺与假目标（图2）

- [x] **左右标尺平行对称**：左「耦合」竖标尺与右加力/电容条改为同高、同宽、同 y 起点的镜像对称布局。
- [x] **彻底删除装饰 contact 标签**：`combatHmdV3.js:456–475` 的 DEEP-SPACE-KING/WARMASTAR/PT-1402/LUCKYMO/PYL-G-5083-TJ 五枚假目标（2.1–2.7km）连同绘制函数整体删除——站主原话「从来就不应该存在」，宪章②（每个读数绑真实状态）就此在 HUD 全面执行，未来 contact 只许来自真实实体投影。

### 28f · 左下按钮列重做（图2 → 对齐图4 星际公民效果）

- [x] 按钮列 `['PWR','WPN','THR','SHLD','COOL']`（combatHmdV3.js:194）删 `COOL`，保 **PWR/WPN/THR/SHLD** 四钮。
- [x] **四色区分**（低饱和，双色温纪律下的受控扩色）：PWR=青白（母舰剩余能量）、WPN=随当前选中武器色（青/琥珀/红/品红，接防御模块）、THR=蓝绿（动力挡位与状态）、SHLD=紫青（护盾状态）。
- [x] **横向能量块 → 竖置能量柱**：每钮旁一根从下至上填充的竖柱，随真实状态波动——PWR 绑 combatRuntime 能量口径、WPN 绑 `weaponCooldownRatio`、THR 绑 warpIntensity 档位（入梦 hover 时可见跳升）、SHLD 绑护盾口径（有真值绑真值，无则明示派生）。**取消 PWR/THR 现有的能量条滚动动画**。
- [x] **实时性对齐图4**：图4（SC 放大镜瞄准+右上目标分析）的核心是所有数字随舰船运动实时变化——本项四柱 + 既有速度/距离读数全部落实这一点，禁止静态值（宪章②，与 28e 同一条执法线）。

### 28g · 「以中文入梦」跃迁效果加码

- [x] 现 warp-hover 效果太慢、感受不到星门跃迁的高速与波动——星线拉伸速度/长度显著加码（stretch 因子加倍级）、hover 进入的 ramp 时间缩短（快速起速才有跃迁感）、喷焰 flameBoost 上调、可加一层短促的画面波动脉冲（CSS filter 或星场抖动，≤400ms 一次性，不常驻）。

### 28h · 版本迭代

- [x] 批二完成后 `index.html:224` 顶栏 `brand-version` v1.5 → **v1.6**，RELEASE_NOTES.md 开 v1.7 段收后续（v1.6 段已被 U8–U12 占用，版本号语义以站点顶栏为准、归档段号顺延即可，两处不冲突写个说明行）。
- [x] **验收**：vitest 全绿 + 构建干净 + `!important` 基线；站主真机过：皇木主题质感、两钮加长、断层消失、星门双色不过曝+滚动耀斑+旋转、战场背景纯净、标尺对称、假目标消失、四竖柱波动、跃迁加码手感——批二一次验收，通过即升 v1.6。

**施工记录（2026-07-14）**：两批一次性做完。技术要点见 RELEASE_NOTES.md v1.7 段（详细展开）；这里记关键裁决/意外：① 28b 的 `.hero{min-height}` 修复必须用 `!important` 硬压过既有 legacy 层同属性的 `!important` 规则（`@layer overrides` 按 cascade-layers 重要性反转规则赢不了同层更早的 `!important`），`!important` 基线（`check-no-new-important.mjs`）相应从 2958 上调到 2960，理由写进了脚本注释；② 28e 删除假 contact 标签时连带清理了它专属的 `getEscorts` 依赖注入（工厂签名 + main.js 调用点），`createCombatRuntime` 那条独立同名依赖不受影响；③ 28f 的 PWR/SHLD 没有现成的"母舰能量/护盾"数值，采用 `combatRuntime.getAmmoLevel()`/`getDeckReadiness()`（两个已存在的真实波动资源池）作为诚实代理，而非新造假数值；④ 28d 删除尘埃/日晕系统后，`reducedMotionPreferred()`/`REDUCED_MOTION` 变成孤儿一并清理。**验证**：546/546 vitest、`tsc --noEmit` 干净、`vite build` 干净（bundle-budget 全绿）、`!important` 基线绿（2960/2960）。**视觉（全部 8 项）沙盒无法渲染 Canvas/WebGL，统一待站主真机复核后再裁决升级 v1.6 是否最终生效**（`index.html` 顶栏文本已经是 v1.6，若真机复核发现问题需要回退，直接改这一处文本即可，不影响其余代码）。

## U27 · 3D 太空战斗模拟器：架构与设计方向综合评估（2026-07-14 立项，纯评估文档，不动码）

> 站主命题四问：Babylon.js 适配性 / 四作设计元素提取 / boot.html 收编 / 全站一致性。评估把 **U25 当日被退回**作为一手品味证据纳入——本文所有「待做」项都因此默认「小切片 + flag 隔离 + 先看后并」。

### 27a · Babylon.js 适配性评估 → **裁决：不换，THREE.js 续任**

| 维度 | Babylon.js | 本仓库现状（three r160） | 判定 |
| --- | --- | --- | --- |
| 太空场景渲染性能 | 与 three 同级——两者都是 WebGL/WebGPU 薄封装，光照/粒子瓶颈在场景设计不在引擎 | InstancedMesh 单 draw call 纪律、尾迹彩带、bloom 管线全部生产验证 | 平手，切换零观感收益 |
| 粒子/碰撞/物理 | 内建 GPUParticleSystem、Havok 物理集成是真优势 | 场景无真物理需求（解析飞行公式 + 伪碰撞判距），粒子自研池已够用 | Babylon 优势用不上 |
| DOM 集成 | canvas + DOM overlay，与 three 完全等价；Babylon GUI（画布内 UI）与宪章①「DOM/2D-canvas HUD」路线重复 | 现行 blit + DOM 面板模式成熟 | 平手 |
| 包体积 | @babylonjs/core tree-shake 后仍普遍 > three 同场景用量 | vendor-three 674 kB（gzip 171 kB）已有 CI 预算管着 | three 略优 |
| 迁移成本 | 20+ 场景模块、相机导演状态机、46 条相机/飞行数学测试全量重写 | —— | **一票否决级** |

**vs React Three Fiber（首页语境）**：R3F 前提是 React——U21 Phase 1 已裁决「无框架 MPA 是相对优势，不迁框架」。首页是内容型页面（SEO/LCP 红线），引入 React runtime + reconciler + hydration 是纯负资产；R3F 的声明式组件复用优势只在「已经是 React 应用」的前提下成立。**结论：R3F 不适用，除非全站先推翻 U21 裁决迁 React（无此计划）。**

**Babylon 重估触发条件（写死，防止反复议）**：① 出现真物理需求（刚体碰撞/舰体损毁解体，Havok 是决定性优势）；② WebGPU compute 成为硬需求且 three 侧成熟度掉队；③ three 停止维护。三者其一发生，开独立 RFC 重议。

### 27b · 四作设计元素提取矩阵（可执行清单）

| 元素 | 来源 | 落地方式 | 状态 |
| --- | --- | --- | --- |
| 剧情化舰载 UI（一切界面是舰上设备） | 星际公民 | 宪章①，HUD 面板/坞站全线 | ✅ 已做（U8–U14/boot） |
| 高保真 UI overlay / 真投影目标框 | 星际公民 | tacticalOverlay + getHudFeeds | ⚠️ **已试→同日退回**（U25b）；重做条件=站主真机先看 `?hud=projected` flag 版再裁决是否默认 |
| 自发光材质+泛光光照 | 星际公民 | ACES+UnrealBloom（alphardForge 管线复用） | ⚠️ **已试→同日退回**（U25a）；同上，重做走 `?fx=bloom` flag |
| 3D 椭圆全息雷达盘 | 精英危险 | U9 全息扫描盘 | ✅ 已做 |
| 目标面板 shield/hull 分层读数 | 精英危险 | HMD 血条（合成版保留） | ✅ 已做（U8） |
| 超空间跃迁转场 | 精英危险 | ~~「入梦」warp-hover 已有雏形 → 升级为页间 View Transitions 星线拉伸转场~~ | ✅ **评估失误已订正（2026-07-14）**：`src/lib/transition.js` 早已是全站生产系统——去首页即播「WARP JUMP」超空间星线收束+白闪+程序化音效（每页一种叙事类型：arena=能量炮/sectors=起飞/signal=CRT/games=赛博），全部页面通过 `*Libs.js`/`*Entry.js` 已加载，不是待办 |
| 尺度感（vast scale） | 精英危险 | FogExp2 + 远景剪影 + 视差尘埃（V18） | ✅ 部分已做；剩余=背景星云板（见下） |
| 电影化运镜 | 家园 | 相机导演 + U24 起降镜头链 | ✅ 已做 |
| 战术 UI 线（编队连线/航迹投影线） | 家园 | topdown 场景僚机编队连线+目标锁定线（LineSegments/LineDashedMaterial，两个 draw call） | ✅ **已做**（`?tacticalines=1` opt-in，2026-07-14，见下） |
| 深空极简美学/剪影可读性 | 家园 | 宪章④，涂黑验剪影 + LOD | ☐ 待做（U22 RFC 已评 8/15 最弱项） |
| 银河图可视化 | 群星 | Commander Terminal 星图（starMapScene） | ✅ 已做 |
| 大战略渐进披露 | 群星 | 宪章⑥；boot.html 坞站徽章→hover 详情 | ✅ boot 已做；全站推广并入 U21 Phase 3 |
| 氛围星云背景 | 群星 | topdown 战场加低饱和 icosahedron dome shader（自包含 GLSL，不复用 alphardForge 的漩涡 shader——构图不同：那个是前景主体特效，这个是背景） | ✅ **已做**（`?nebula=1` opt-in，2026-07-14，见下） |

**27b 施工记录（2026-07-14，已推送 `a4cfd45`）**：

- **① ED 跃迁转场**：动手前发现已是全站生产系统（见上表订正），未写新代码，节省一个切片的工期。
- **② 家园战术连线**（`?tacticalines=1`）：`topdownCombat.js` 新增两组线——僚机三角编队连线（环形连接三机+连回母舰，随每帧真实位置更新，`LineSegments` 单 draw call）+ 目标锁定虚线（母舰→彗星，仅在 `state.halley.hover` 为真时显示，`LineDashedMaterial` 复用 `computeLineDistances`）。全部读真实位置，不发明坐标。
- **③ 群星星云背景**（`?nebula=1`）：320 三角面的 icosahedron dome（`BackSide` 渲染），自包含 fbm 噪声 shader，低饱和青/紫水彩色带，`fog:false` 避免被场景雾气吃掉；成本极低（1 draw call 无光照），裁决为**桌面+移动均可**（不同于 U25 bloom 的移动端关闭策略）。
- **course.md R3 例外**：新增一行——默认关闭的 flag 隔离视觉改动不计入「待真机验收」WIP 上限（详见 course.md §1.5 R3）。
- **验证**：546/546 vitest、tsc 干净、构建干净（topdownCombat 分片 29.6→32.2 kB）、`!important` 基线未动。均为 opt-in，默认访问不受影响，零新增验收债（R3 例外条款覆盖）。
- [ ] **站主试看**（均需加 query 参数，默认不开）：`/?combatview=topdown&tacticalines=1` 看战术连线、`/?combatview=topdown&nebula=1` 看星云背景（可叠加 `&combatcam=director` 看运镜下的效果）；满意后回本节裁决是否转默认开启（转默认 = 删 flag 判断，直接跑；不转 = 保持 opt-in 或删除）。

### 27c · boot.html 收编计划

- **角色裁决**：三候选（loading 屏 / 预检序列 / 宇宙初始化）中定为**「预检序列」＝首页的可选沉浸入口**。不做强制 loading 屏——首页是投资日志（内容型身份 + SEO/LCP 红线，U23 RFC §2 对方案 C 的否决理由全部适用于「强制拦截」）。
- **技术移交（两阶段）**：**Phase 1（现在可做）**——首页顶栏加「BRIDGE SIM」入口 → 跨文档 View Transitions（全站 @view-transition 已启用）滑入 boot.html；boot 自检完成自动进舰桥（已实现）；EXIT SIM 同路返回。boot.html 转正需同步办三件事：去 noindex、进 sitemap、按 roadmap C5 规则补第 N 页评估（现在是豁免的一次性原型）。**Phase 2（并入 U23 M2）**——boot 的 3D 场景与首页 Combat View 本就是同一个 `createTopdownCombat`，M2 单 renderer 舞台落地后，移交从「页面跳转」升级为「同 canvas 相机 shot 切换」，boot 变成首页的一个状态而非独立页面。
- **无缝细节**：转场动画用跃迁语言（白闪+星线拉伸，CSS view-transition 关键帧）；进度条已是真任务门控（无假等待）；`localStorage` 记「已看过自检」→ 回访跳过打字动画 1s 直入（尊重老访客时间，宪章⑥）。

**27c Phase 1 施工记录（2026-07-14，已推送 `86e55a0`）**：首页 DECK 下拉菜单（`src/main.js` `initNavSiteMenu()`）追加一条「BRIDGE SIM」条目 → `/boot.html`，只挂在这个下拉自身的 `pages` 数组上（不进 `nav.js` 的站点级 `SITE` 数组，避免其他七个页面也长出这个入口——course.html 也加载 `main.js` 但没有 `.nav-menu-btn` 元素，经 grep 确认不受影响）。转场效果零新代码：`transition.js` 本就拦截站内 `<a>` 点击，`boot.html` 路径不命中 arena/sectors/signal/games 任一专属正则，落到默认的 `warp` 类型，观感恰好契合「进入舰桥模拟」。boot.html 侧的自检自动进舰桥、EXIT SIM 返回首页均是既有实现，未改动。**未做**（按本节原文，需站主裁决后才做）：去 `noindex`、进 sitemap、按 roadmap C5 补第 N 页评估——boot.html 仍是豁免的一次性原型。验证：546/546 vitest、tsc 干净、构建干净、`!important`/bundle-budget 校验器全过。

### 27d · 全站 UI/UX 一致性策略

**分层模型「同一艘舰的不同甲板」**：

| 层 | 页面 | 沉浸度 | 允许的元素 |
| --- | --- | --- | --- |
| 舰桥 | 首页（+boot） | 全沉浸 | 3D canvas、粒子、HUD 全家桶 |
| 作战情报室 | arena / sectors / signal / stats / games | 中 | HUD 面板语言、数据卡、sparkline、三态信号；**无 3D、无粒子** |
| 军官舱 | serial / course / horoscope | 低 | 阅读优先；只保留 token 级主题 |

**核心问题的答案：标准页反映科幻主题到「令牌级」，永不到「场景级」**——内容页穿制服不穿盔甲。品牌整体感来自五件共享资产：① 双色温色板（青白=世界/琥珀=自身，进 `@layer tokens`，走 U21 Phase 3 既定路径）；② 字体三件套（Orbitron/Rajdhani/JetBrains Mono，现已全站一致）；③ 三态信号措辞（加载=SCANNING、空态=NO CONTACT、错误=OFFLINE）；④ hover/active/`:focus-visible` 三态统一（Phase 3 RFC 键盘可达性欠账一并清）；⑤ 页间转场统一跃迁语言（View Transitions）。**交互音效：裁决暂不做**——浏览器自动播放限制 + 现站零音频系统 + 移动端体验风险，收益配不上成本；若未来做，仅限用户主动点击的 opt-in 反馈音。

**落地去向**：27b 三个待做切片各开一批；27c Phase 1 待站主裁决 boot 是否转正；27d 的 token 五件套并入 U21 Phase 3 实施清单。本项自身到此关闭（纯评估，无代码）。

## U26 · `.git` 锁文件残留链式故障 — 已根治（2026-07-14，站主报告「commit/reset/stash/pull 间歇性全部失败」）

**根因确诊**：本仓库挂载在 FUSE 层（`mount` 确认 `type fuse`）。Git 每次写 `HEAD`/`index`/`ORIG_HEAD` 等文件前会先创建同名 `.lock` 文件占位，正常操作完成后自己 `rename()` 回原名并删除锁。但在这层 FUSE 挂载上，`.lock` 文件一旦被**另一个并发进程**（本仓库有 8 个 Scheduled 任务，经常在几分钟内先后触发同一 repo 的 git 操作）持有，unlink 会报 `Operation not permitted`（不是 `Permission denied`——是 FUSE 转发层对跨会话/跨进程句柄的锁语义问题，不是常规 Unix 权限）。**过去多轮会话遇到这个报错时，一律用 `mv .git/xxx.lock .git/xxx.lock.bak_<timestamp/后缀>` 绕过**，而不是真正解除锁——这是止血但不断根的做法，每次都在 `.git/` 里留下一具尸体，日积月累变成本次发现的规模。
- **top-level**：287 个 `HEAD.lock.*`/`index.lock.*`/`ORIG_HEAD.lock.*`/`REBASE_HEAD.lock.*`/`packed-refs.lock.*` 变体（`.bak_数字`/`.pre_数字`/`.stale`/`.orphan`/`.cleared_数字`/`.retry_数字`……命名花样能看出是不同轮次、不同即兴脚本各自发明的绕过写法）。
- **`.git/objects/` 深处**：1033 个 `tmp_obj_XXXXXX.bak_*`（`mv` 绕过殃及池鱼）+ 451 个裸 `tmp_obj_XXXXXX`（git 自己写对象时被同一 FUSE 锁问题打断、从未清理，`git count-objects -v` 能直接看到 `garbage:` 计数）。
- 唯一一个非空文件 `index.lock.bak_1783332885`（17KB，`git index version 2, 182 entries`）经核实是某次 `mv` 保下来的历史索引快照，不是当前 `.git/index`（当前 index 完好、`git status`/`git log` 全程正常），确认可删。

**本次处置**：
- [x] 定位并清除全部 287（top-level）+ 1033（`.bak` 变体）+ 451（裸 `tmp_obj`）= **共 1771 个残留文件**，`.git/objects` 的 `garbage` 计数由 451 清零至 0。
- [x] `git fsck` 全程复核：无 `missing`/`corrupt`，仅剩历史 amend/rebase 产生的正常 `dangling commit/tree`（无害，`git gc` 会自然回收，不影响任何操作）。
- [x] 清理后跑 `git status`/`git log`/一次 `touch+rm` 锁文件冒烟测试，确认 commit/push 链路未受影响（同会话内已用于 U25 revert 提交，`643d1cb`/`fb222b4` 均正常推送）。
- [x] **真正的根治手段**：Cowork 环境内置 `mcp__cowork__allow_cowork_file_delete` 工具——遇到 FUSE `Operation not permitted` 时调用它请求该文件夹的删除权限，随后 `rm -f` 就能正常删除锁文件，不需要 `mv` 绕过。本会话已验证生效（清理全过程零报错）。
- [ ] **需要写进 Scheduled 任务的纪律（沙盒读不到 `/Users/feida/Claude/Scheduled/*/SKILL.md`，需站主自己改）**：任务 prompt 里如果有「git 操作失败时 `mv` 锁文件绕过」这类兜底逻辑，**改成遇锁等待重试**（`.lock` 是另一进程正在写的信号，等它写完文件会自己消失）或**明确失败后跳过本轮**，禁止再用 `mv` 重命名锁文件——这是过去两周残留物的唯一制造源头，本次清理不堵住这个口子还会再堆起来。
- [ ] 站主决策：是否要偶尔跑一次 `git gc` 收拢历史 dangling 对象（`.git` 当前 56MB，`gc` 前）——非必需，纯优化项，本次不动。

> **状态速览（2026-07-13 收编：原状态长段落压缩为下表，无信息损失；KNOWLEDGE.md 立项时整理）**
>
> | 项 | 状态 | 悬而未决 |
> | --- | --- | --- |
> | U1–U6 | 代码完成 | 题库难度标定 + 真机验收待站主 |
> | U8–U12a/c/d | ✅ 已移入 RELEASE_NOTES v1.6，已推送 | — |
> | U12b | 代码完成 | 待移入 RELEASE_NOTES；视觉验收 |
> | U13 / U14 | 代码完成（vitest 全过；沙盒 dist/ 权限受限用 --outDir 验证是已知事项） | 视觉待站主真机复核 |
> | U15 | 已推送 `475bab9`（15d 按单书签最小方案） | 视觉验收 |
> | U16 | 已推送 `7a153cc` | 真机验收 |
> | U17 | 已推送（course v3.0 + course-weekly-review 周报任务） | 视觉验收；首期周报 2026-07-13 20:00 |
> | U18 | 已推送 `6078d96` | 视觉验收 + /league.html 302 部署后验证 |
> | U19 | 已推送 `63b3380` | 动效/移动端真机验收 |
> | U20 | 已执行并推送 `c8379e4`（任务 11→10） | leagues-msi-daily 待决赛结果落库后站主手动删 |
> | U21 Phase 1 | RFC + 实施全部完成（535/535 vitest；CI/@layer/schema 校验/vendor 拆分/novels 分片/兼容层全落地，typecheck 与各校验器干净） | — |
> | U21 Phase 3 | RFC 已产出（`rfcs/2026-07-13-u21-phase3-ui-ux.md`，Lesson 2.8 代理分 67/100 < 70 上线门槛），未动码 | 站主裁决是否发「按重要性做完」指令 |
> | U21 Phase 2 | 未开工 | 新会话 + 真机 Lighthouse/CrUX 基线先行（建议与 U22 首页 3D 决策合并测一次） |
> | U22 | **RFC 已产出**（`rfcs/2026-07-13-u22-homepage-3d-combat.md`），未动码 | 站主裁决六条宪章 + 「默认视图是否换 3D」→ 已由 U23 承接 |
> | U23 | **RFC 已产出**（`rfcs/2026-07-13-u23-default-3d-scene.md`：默认视图换 3D 的架构裁决，B→A 两步走 + M0–M4 里程碑），未动码 | 站主裁决路线（§7 裁决表三问）；通过后 M1 可直接开工，M2 起依赖 M0 真机基线 |
> | U24 | ✅ 代码已完成，已推送 `e6367ef`（546/546 vitest） | 起飞/降落镜头链真机验收 |
> | U25 | **同日站主要求退回，已 revert 并推送 `643d1cb`**（546/546 vitest，回到 U24 状态） | 真机确认 Combat View 已回到 U24 前的样子 |
> | U27 | 27b 三切片（`a4cfd45`）+ **27c Phase 1（BRIDGE SIM 入口，`86e55a0`）已推送**；27d 纯评估已关闭，五件套并入 U21 Phase 3 | 站主 flag 试看 27b 两项 → 裁决转默认/保持 opt-in；27c「转正」（去 noindex/进 sitemap/C5 评估）待站主裁决，暂不做 |
> | U28 | 已完成（2026-07-14，同会话批一+批二）：serial 皇木主题 + 首页断层/星门配色/HUD 假目标清除/四竖柱按钮/跃迁加码 → v1.6；546/546 vitest + 构建 + `!important` 基线全绿 | 视觉全部 8 项待站主真机复核 |
> | U29 | **P1 + P2 已完成**（2026-07-15/16，P1 先于 P0 开工，站主指定）：P1 = `src/bootengine/` 九模块（seed/pid/rigidBody6dof/catmullRom/hbt/maneuvers/simCore/worker壳/主线程接口），纯逻辑零渲染零接线。P2 = `?p2demo=armor`（程序化细节法线+灼痕材质）与 `?p2demo=fleet`（GPU 粒子池三组+wedgeCruiserHull 旗舰/护卫舰船体（InstancedMesh 炮塔/舷窗/铆钉）+发光激光光束+ACES 色调映射/Bloom 泛光/边缘轮廓光）。644/644 vitest（98 新增，含黄金集）+ tsc + build 全绿 | P0（RFC 文档 + COOP/COEP spike + WebGPU 探针）未开工，不阻塞；WebGPU+延迟渲染+G-Buffer+POM+SSR 已按站主要求单独立项、待 P0 完成后再评估（不是 P2 范围）；两条 P2 demo 待站主真机复核；P2 剩余视觉打磨（全船菲涅尔/舷窗闪烁）与 P3 电影导演 v2 为下一个自然阶段 |
> | U30 | **R1+R2 已完成**（2026-07-16）：R1 = serial 共享元素转场/signal 事件卡展开/sectors cards-4 手风琴；R2 = 首页星门 sticky 缩放舞台，`?fx=stage` 起步、默认关闭，复用 U28b 既有 `--forge` 基建零新增 JS。R2 后续站主真机连续截图追查，30g 三轮修完：指标条文字可读性（半透明→不透明纯色根治）、hero→星门/星门→equity 排版空隙（DevTools 现场量出 `progress()` 计算基准错误，非 CSS 距离问题）、出场缝隙（ease-out + 出场渐变多档位）。真机截图复核（`?fx=stage`）确认空隙与硬缝均已消除。三库全部不引，644/644 测试绿，`!important`/bundle 基线不变 | R3（sectors 力导向图）/R4（signal 视差时间轴）未开工；R1 三项交互变化待真机验收（计入 R3 WIP 上限）；R2 flag 隔离不计入上限，待站主 `?fx=stage` 真机裁决转默认与否 |
> | U31 | **已完成**（2026-07-17，同日开工同日完工）：sectors.html 故事块（非对称 12 列网格+IO 渐现+悬停微交互，数据全来自 sectors-data.json）+ 无限 Ticker 条（双倍克隆纯 CSS marquee，内容=arena-universe **29**（原「40+」估计有误，如实更正）个标的 chips，点击滚动高亮对应案例卡）；R3 力导向图移入惰性初始化的 `#storyGraphSection`，`.storyToggle` 切换「Story cards / Star-map view」；656/656 vitest、build、`!important` 基线全绿 | 全部待站主真机复核：网格错落感/渐现节奏/marquee 循环与可暂停/hover 微交互/移动端单列/**尤其是 Star-map 切换后画布定形**（沙盒验证不到 canvas resize 时机） |
> | U38 | ✅ 代码完成（2026-07-17）：games.html Apple Sports 式淘汰赛阶段滑杆（bracketModel 纯函数+9 测试 / thumb 分段轨 / 平移缩放面板 / 触摸+键盘+RM），665/665 全绿 | 真机验收滑动手感；EWC/S16 复用见 roadmap §7.4 |
> | U39 | ✅ 代码完成（2026-07-18）：games.html 加双指/触控板捏合缩放（pinchZoom 纯函数+9 测试 / 总览-轮次-单场三档 / +/− 无手势兜底），674/674 全绿 | 真机验收双指手感与档位方向 |
> | U40 | ✅ 代码完成（2026-07-18）：games.html 补决赛+季军赛赛程/赔率/预测（fixtures 从空数组补齐、bracket.third 新增+2 测试）+ 全站改 WC26 官方配色（藏青#1B2766/金#9F7D23/白字，:root 令牌驱动），676/676 全绿 | 真机验收配色观感与小字号可读性 |
> | U41 | 新立项（2026-07-17）：signal.html 借鉴 Accenture 编辑部式重构——超大扁平标题/章节化排版/sticky 章节轨/滚动叙事/事件筛选 chips；骨架借鉴令牌保留（备选黑白风留翻案口）；U30 R4 并入 | 未动工；「读 Urgent.md U41 开工」 |
>
> 备注：12a 体检发现的 course.html 未提交漂移已随 U17 入库解决。U 项全部关闭后本文件内容转 RELEASE_NOTES.md 并删除本文件。

> 规则：本文件只放**当前最需要修改的问题**；每项处理完就从这里划掉，完整实施记录转 `RELEASE_NOTES.md`。全部清空后本文件可删。
> 红线不变（roadmap §7.10）：仅供娱乐、不做付费解锁/焦虑营销、康健只说作息；沙盒无法真机渲染，所有视觉改动需站主真机验收。

## U1 · 专业星盘不美观不清晰（站主截图，最高优先）

- [x] **星座符号呈现为紫色 emoji 方块**（截图核心问题）：♈–♓/☉☽ 等字符在 iOS/部分平台被渲染成 emoji 图标而非文本字形。修复：所有 SVG 内的星座/行星字符追加 U+FE0E（text presentation selector）强制文本呈现 + CSS 指定衬线字体栈。
- [x] **轮盘信息密度太低**：加黄道十二宫按四元素配色的色带分段、每 5°/10° 刻度环、行星度数标注、行星拥挤时径向错位防重叠。
- [x] **相位格网看起来像随机散点**：无边框导致网格结构不可读。加全格网底色+细边框+对角线行星列头强化，空格也画格子。
- [x] **移动端适配**：轮盘卡片限制最大宽度居中；格网在窄屏横向可滚；图例换行。

## U2 · 合盘补紫微斗数对比 + 分关系评分

- [x] 合盘增加**紫微命宫对比**（双方命宫地支六合/三合/相冲/相刑 + 命宫主星组合解读），与现有八字/星座层并列展示（需双方时辰，缺则显示提示）。
- [x] **五种关系分型评分**：朋友/同事/暧昧对象/情侣/夫妻——同一套底层分量（八字底盘/日月相位/内行星相位/宿曜）按关系类型加权重组，每型一个分数+一句话，纯函数+vitest。

## U3 · 三项测试对齐主流方法论 + 增加区分度

- [x] **IQ 测试加限时**：每题倒计时（区分度：难题给更多时间），超时自动记错并跳下一题；总用时进入结果；参考 Raven 渐进矩阵的「图形推理为主」题型方向（题库为自编原创，不抄真题）。
- [x] **三测试结果都给人群百分位**（「超过 X% 的人」）：IQ 按正态模型（μ=100 σ=15）换算；EQ 按维度分正态近似；MBTI 给类型人群占比（公开发表的类型分布近似值，标注来源性质）。
- [x] **结果更娱乐化 + 一键分享**：三个测试结果全部接入 shareCard（含百分位/称号），IQ/EQ 补分享卡类型。
- [ ] 题库区分度系统性重做（题目难度梯度标定）——**未做**：需要真实作答数据标定难度参数，先上线计时+百分位攒数据，题库迭代另立项。

## U4 · 神煞稀有度改暗黑2配色 + 给人群百分比

- [x] 稀有度四档配色致敬 D2 装备：常见=普通白、多见=魔法蓝、少见=稀有黄、稀有=暗金（D2 unique 金褐色）；徽标同时显示样本频率百分比（如「稀有 · 3.2%」）。沿用现有 1950–2009 均匀样本频率数据与诚实标注。

## U5 · 个人命造人群排名

- [x] 新增 `mingzaoRank()`：中和流通（五行平衡+流通度）/ 格局（简化格局加成）/ 用神有力（喜用神在干支中的强度）/ 岁运配合（当前大运是否生扶用神）四维合成 0–100 总分，纯函数+vitest。
- [x] 预计算 1950–2009 均匀样本的总分分布（脚本 → 分位数表），页面显示「你的命造超过 X% 的样本」+ 四维小雷达；同样挂「均匀合成样本非真实人口」诚实标注。
- [x] 单人生辰分享卡加入命造总分+百分位。

## U6 · 移动端整体友好度

- [x] 星盘/格网/紫微 4×4 宫格/大运条的窄屏布局核查与修复（横向滚动或降列）。
- [ ] 真机验收（站主 iPhone 截图复核）——沙盒无法代做。

## U12b · 全局与主页结构调整 ✅ 代码已完成（2026-07-11）

> U8/U9/U10/U11/U12c/U12d/12a 已全部完成并移入 `RELEASE_NOTES.md`（见 v1.6 条目）。

**实施中发现并与站主确认的偏差**：动手前发现 `src/lib/nav.js` 的 `SITE` 是全站 9 个页面共用的单一数据源，顶栏渲染逻辑不止在首页生效——「logo 本身回首页」这个原立项前提只在 `sectors.html`/`course.html` 成立（它们的 `.brand` 已经是 `<a href="/">`），`arena`/`games`/`league`/`horoscope`/`signal`/`serial` 这 6 个页面顶部的 `.brand` 目前是不可点击的纯装饰 div，直接从共享 `SITE` 里砍掉 Home 会让这 6 个页面失去顶栏回首页的入口。**已与站主确认：只砍首页自己的 Home**，其余 8 个页面顶栏保留 Home 链接不变。

- [x] **顶部导航 Home 按钮**：`src/lib/nav.js` 的 `run()` 渲染循环加一行 `if (s.path === '/' && here === '/') return;`——只在「当前页就是首页」时跳过渲染 Home 这一条链接（首页显示自己是多余的），`SITE` 数组本身不动，其余 8 个页面（含 prev/next 翻页箭头依赖的 flat cycle）逻辑完全不受影响。首页顶栏从 5 项（Home/Arena/Sectors/Signal/Labs）变 4 项（Arena/Sectors/Signal/Labs），其余页面仍是原来的 5 项。
- [x] **「以中文入梦」按钮迁移**：`#langBtn`（`.warp-btn.verse-switch`）从 `index.html` 的 `hero-cta` 移到顶栏 `nav-right` 末尾（最右侧，`nav-clock` 之后）。**红线核实**：hover 跃迁效果（`body.warp-hover` 全局类、main.js `#langBtn` 的 `mouseenter`/`mouseleave`/`click` 监听）全部通过 `getElementById('langBtn')` 绑定，与 DOM 位置无关，main.js 零改动，效果原样保留。桌面新增 `.nav-right #langBtn` 尺寸覆盖（从 hero 按钮的 214px/56px 缩到贴合其余 nav-right 控件的尺寸），移动端 `≤860px` 隐藏——移动端已有 U12c 的 `#langMiniToggle` 转发同一个点击处理器，两个控件同时显示是重复且单行顶栏放不下。
- [x] **`hero-cta` 布局重排**：按钮移走后网格从 `"button coord" "hint coord"` 两列改单列 `"hint" "coord"`；移动端断点同步去掉 `"button"` 区域，孤立的 `.warp-btn{width:min(100%,260px)}` 移动端规则一并清理（我的改动导致的孤儿，非无关历史死代码）。
- [x] **验收**：vitest 516/516 通过；`npm run build` 干净（main chunk 868.29 kB，纯 DOM 位置调整无 JS 逻辑变化，体积不变）；Node 沙盒模拟验证了 Home 跳过逻辑在 `here==='/'` 与 `here==='/arena.html'` 两种输入下均按预期渲染。
- [ ] **视觉验收**：站主真机/浏览器复核首页顶栏 4 项无 Home、`langBtn` 在最右侧位置/尺寸协调、hover 跃迁特效仍触发正常——沙盒无法渲染，既有纪律，唯一悬而未决项。

**C5 评估已完成（2026-07-12）**：`course.html`（"Vibe Coding 101"）撞上的 roadmap.md §1/C5「加第 9 页前必须先做 Astro 迁移评估」规则已正式评审，结论「暂不做全站 Astro 迁移，course.html 按现有架构直接加为第 9 页」，完整依据见 roadmap.md §8.4。**仍待站主决定**：是否现在就动手把 `course.html`/`public/styles/course.css`/`src/pages/course.js`/`src/pages/courseEntry.js` 这四个文件正式加入构建（`vite.config.js` 新增入口）并提交推送——评估只回答了「能不能加」，尚未执行「加」这一步，需站主一句话确认后再动手。同一工作区还有一批与本轮任务无关的未提交改动（`page-turn.css`/`sitemap.xml`/`vite.config.js`/HUD 图片增删），详见 RELEASE_NOTES.md v1.6「意外发现」，本次未做任何处理。

## U13 · 顶栏断行 + HUD 重排 + 移动端 Command 专注模式 + 首页滚动衔接（2026-07-11 深夜立项，站主两张截图，代码已完成）

### 13a · 顶部导航修复（Web + Mobile）✅

- [x] **Web 断行修复**：根因是 `.nav-right`（styles.css 5009 起，"2026-06-08 repair pass" 遗留、无 `@media` 包裹、全宽度生效）只定义了 2 条显式 grid 列（`auto minmax(112px,auto)`），U12b 把 `#langBtn` 加成第 3 个可见项后，默认 `grid-auto-flow:row` 把它挤到第二行——这才是截图里的断行。修复（styles.css 文末新增块，紧跟 U12b 的 `#langBtn` 覆盖之后）：`.nav-right{grid-auto-flow:column}` 让多出的项拿一个隐式列而不是换行；再用 `order`（`#langBtn{order:1}` / `.nav-clock{order:2}`）把语言钮排到 Command 与时间之间——不挪 DOM，`body.warp-hover` 跃迁效果绑定不受影响。移动端不受影响：U12c 已把 `.nav-right` 覆盖成 `display:flex`（grid-auto-flow 对 flex 容器是空操作），且 `#langBtn`/`.nav-clock` 在移动端本来就是 `display:none`。
- [x] **Mobile 三钮风格统一**：Command / EN·中 / Deck 三个按钮字体（JetBrains Mono vs Orbitron）、边框色、字距、背景各自为政。统一为 Deck 按钮的风格基准（Orbitron、`rgba(154,229,255,.34)` 边框、`rgba(2,6,10,.70)` 背景、`.16em` 字距）——高度本来就一致（26px），未动。

### 13b · 底部 HUD 重排（Web）✅

- [x] **删三只小表盘**：`main.js` `drawRadar()` 内的 `drawGauge` 及其 IAS/CORE/ATT 三次调用（U9 引入的机械表盘周边元素，非 U9 主体全息盘）整体删除；船身剪影+主炮特效原样保留（不是截图投诉的对象）。
- [x] **雷达迁位缩小**：`index.html` 删除整个 `.hud-left` aside，雷达 canvas 移进 `.hud-pilot`（Combat View）内、`#pilotFeed` 下方，包一层 `.pilot-radar-dock`（96×70px，移动端 76×56px）用绝对定位悬浮在左下角，不占用 `#pilotFeed` 的矩形（多处 HUD 绘制函数依赖它的 rect）。`drawRadar()` 新增 `compact`（`min<220`）判定，小尺寸下跳过度数/公里读数与「静默守望」文字（会糊成一团），保留圆盘/扫描楔/光点/火焰标记——原有动画本身就是「细腻科幻动态」，未另加新效果。
- [x] **最左列 = 防御模块**：`.hud-left` 从 DOM 删掉后，`.hud-center`（防御模块）自然成为第一个可见 grid 项，零额外 CSS。四武器纵向排列其实 U10 已经做了（`weapon-matrix` 的 `grid-template-rows:repeat(4,...)`，全局生效，本次复核确认无需重做）。桌面 `--hud-cols` 从 4 列改 3 列（`minmax(300px,.24fr) minmax(660px,.51fr) minmax(370px,.25fr)`），沿用 U11/U9 那套「在文件末尾追加最终覆盖，不逐个改历史碎片」的写法——`--hud-cols` 历史上有 9 处桌面生效的重复定义，新覆盖天然是最后一条，对所有 >860px 宽度生效；约 40 处 `.hud-left`/`.hud-left #radarCanvas` 历史碎片因为找不到匹配元素而自然失效，未逐条清理（同 U10 对 `.weapon-matrix` 的处理原则）。移动端同步把 `grid-template-areas` 从 `"left center"/"pilot pilot"` 收成 `"center"/"pilot"` 单列，避免空的幽灵格。
- [x] **Combat View 扩大**：随雷达列释放宽度，`--hud-cols` 给 pilot 列 `.51fr`（原 `.38fr`）+ `660px` 最小宽（原 `500px`）。
- [x] **Commander Terminal 交互改道**：`src/ui/terminalStarMap.js` 把开启终端的点击监听从 `#terminalStarMapPanel`（星图本身）移到 `#pilotFeed`（Combat View）；`#pilotFeed{pointer-events:auto;cursor:pointer}`（`#combatHud` 根节点是 `pointer-events:none`，之前只有 hud-center/hud-right 单独开洞，hud-pilot 之前没有交互需求所以没开）+ hover 微光提示可点。星图/LOGIN 按钮的关闭逻辑（`toggle` 点击回到星图）不变。

### 13c · 移动端 Command 专注模式 ✅

- [x] `#commandModeBtn` 的点击处理器（main.js）切的是 `body.hud-off`（默认页面就是 hud-off=巡航模式）——「按下 Command」精确对应 `hud-off` 被移除，不是更窄的 `body.combat-mode`（后者要有实际锁定目标才会加，语义不对）。新增 `@media(max-width:860px){ body:not(.hud-off) .hud-panels{grid-template-areas:"pilot"} body:not(.hud-off) .hud-center{display:none} }`：按下 Command 后底部 HUD 只剩 Combat View。**性能核实**：防御模块（weaponMatrix/battleFeed/battleLog）查过 main.js，全是纯 DOM+CSS，没有自己的 canvas/rAF 循环可暂停——`display:none` 本身就把它整个移出布局/绘制，已经是完整的性能收益，未画蛇添足加暂停钩子。Combat View 保留的两个 canvas（pilotFeed/radarCanvas）不受影响，继续正常绘制。

### 13d · 首页沉浸滚动修复（Web + Mobile）✅

- [x] **hero → Alphard Jump Point 的「近一屏空白」**：追查发现 `.hero` 最终生效值是 `justify-content:flex-start`（styles.css 3890 一条早期覆盖，早于本次改动就已把布局从「居中」改成「顶部对齐」）+ `min-height:96vh`——后者是「居中」时代的遗留值，flex-start 之下它不再服务任何对齐目的，纯粹变成内容下方的空白（这就是「近一屏空白」）。收窄为 `min-height:60vh`（内容自身约 550–650px，大多数屏幕下这条只是下限，不强制留白）+ `padding-bottom:6vh` 收尾呼吸感。
- [x] **「刺眼分隔线」**：`.stardrive .strip`（年化收益等 4 项指标条）继承了通用 `.strip{border-top/border-bottom}` 的实线——加 `border-top:none;border-bottom:none` 去掉；四格之间的竖向分隔线（`.strip-cell{border-right}`）不是投诉对象，未动。
- [x] **宇宙背景 → Alphard Jump Point 的生硬过渡**：`.stardrive-stage::before` 渐变原本只有 2 级（实色→透明），在 45% 处还相当不透明，读起来像一块色块而不是融合。加一级中间点（`60% → 28% → 20%@64% → 0`）做更渐进的多级淡出；出场渐变（`::after`，朝 equity 方向）不在本次投诉范围内，未动。
- [x] **中心图案过曝**：`#alphardForge{filter:brightness(.8)}`——只调整最终合成亮度，不碰 WebGL 渲染逻辑本身；同时改善其上下文字（caption/tagline，z-index 更高）的可读性，一次改动服务两个诉求。
- [x] **Alphard Jump Point → 02 Equity Curve 的尴尬空隙**：`.equity` 是普通 `<section>`，继承通用 `section{padding:140px...}` 顶部内边距，叠加在 `.stardrive` 自己已调好的退场间距（底部渐变+ pin-end 贴底）之上。新增 `.equity{padding-top:64px}`（class 选择器天然盖过通用 `section` 元素选择器，各宽度断点下都生效，不需要在移动端断点里额外处理）。

**验收**：vitest 517/517 通过（516 + 1，多出的 1 条与本次改动无关——`trackRecord.test.js`/`src/lib/trackRecord.js` 在同一工作区已是**站主自己**改动过的未提交状态，本次未触碰这两个文件，见下方「无关改动」提示）；`npm run build` 干净（沙盒里 `dist/` 目录本身权限受限、连 `rm` 都被拒，用 `--outDir /tmp/...` 验证过构建产物本身没问题，main chunk 865.41 kB，比改动前略小——删掉的 drawGauge 函数体现在体积里）。**唯一悬而未决项**：全部视觉改动（顶栏单行、HUD 三面板新布局、移动 Command 专注模式、首页四处滚动衔接）需站主真机/浏览器复核——沙盒无法渲染 WebGL/实际布局，既有纪律。

**顺带发现（未处理，仅记录）**：`git status` 显示 `src/lib/trackRecord.js` / `tests/trackRecord.test.js` 处于已 `git add` 但未 commit 的状态，与本次改动无关，本次完全没碰这两个文件——连同 U12b 小节已经记录的 `course.html`/其他未提交改动，一并留给站主自己决定要不要提交。

## U14 · 防御模块竖能量条 + Combat View 座舱清理与真实数据化（2026-07-12 立项，站主两张截图，代码已完成）

> 性质：U13 上线后第二轮真机复查。截图 1 = 当前 HUD 实况（左防御模块 + 右 TOP-DOWN·TACTICAL 战斗视角）；截图 2 = 星际公民参考图（元素清单已转写在 RELEASE_NOTES.md v1.6 的 U8 条目，本项不重抄，直接引用）。

### 14a · 防御模块：改四根竖能量条 ✅

- [x] `.weapon-matrix`/`.weapon-choice` 改为 4 列 1 行的竖直能量柱（styles.css 末尾新增最终覆盖块，同 U9–U13 的「只加最后一块 `!important` 覆盖，不逐条改历史碎片」写法）：图标顶部、`::after` 改为**从底部往上填充的整柱能量条**（`height:calc(var(--cool)*100%)`，比原计划的「柱内细管」更简单也更好认）、状态字/名称底部堆叠。`.combat-module` 的 `grid-template-rows` 顺手改回单行——原来的 `30px` 表头轨道是留给已被 U10 `display:none` 的 `#battleFeed` 的，从未被清理过，是「面板上方大块空白」的真正成因。
- [x] 保持 `<button.weapon-choice data-weapon>` 与 main.js 的 class/dataset 接口零改动（U10 红线）；推荐位/选中态/锁定闪烁改用新柱状视觉但沿用同一批 class 名。

### 14b · Combat View 座舱装饰清理（减法）✅

- [x] `src/ui/combatHmdV3.js` 的 `drawCockpitFrame` 删除 OUTPUT/battery MFD 块、centre 雷达装饰、两侧假数字读数条、右侧 RADR/PROX/HIT/MISL 整个按钮列——只保留左侧 PWR/WPN/THR/SHLD/COOL。
- [x] **战斗通报迁位**：`#battleFeed`（U10 时 `display:none` 隐藏）DOM 节点整体从防御模块搬进 `.hud-pilot`，styles.css 用更高特异度选择器 `.hud-pilot #battleFeed{display:block!important;...}` 盖过旧的隐藏规则（不用动那条规则本身），改造成右上角 3 行 stacked ticker（越新越亮），`createBattleFeed`/`#killCounter` 零 JS 改动（照样靠 `getElementById('battleFeed')` 找到它）。移动端保持隐藏（Combat View 是稀缺空间）。
- [x] **全息雷达迁位**：`.pilot-radar-dock` 从左下角改到 **Combat View 下方居中**（`left:50%;transform:translateX(-50%)`），进一步缩小到 64×46px（移动端 52×38px）。

### 14c · PWR/WPN/THR 三 chip 真实数据化 ✅

- [x] `drawCockpitFrame` 新增 `dash` 参数（`{weapon, cdRatio, warpIntensity, warpHover}`，main.js 新增 `cockpitDash()` 组装并传入全部 5 处调用点）。PWR/THR 右侧新增「流动」能量格（`flowPips`，一段亮点沿格子跑动，速度受 `warpHover`——即 `body.warp-hover`，与「以中文入梦」hover 特效同一个全局类——和 THR 额外叠加 warpIntensity 加速）；WPN 右侧改「静态填充」能量格（`fillPips`，绑 `weaponCooldownRatio`，冷却中逐格恢复满格即就绪）。
- [x] **WPN 跟色**：新增 `WPN_COLOR_BASE` 映射（cannon 青/missile 琥珀/nuke 红/enforcer 品红），WPN 按钮与其能量格都用 `chooseWeapon()` 返回的当前实际武器上色——与防御模块按钮的配色体系一致。

### 14d · Commander Terminal 迁入 Combat View ✅

- [x] index.html：整个 `#signalDeck`（含 `#captainTerminal`）从独立的 `hud-right` 栏搬进 `.hud-pilot` 内部，包装元素**保留 `hud-panel hud-right` 两个 class**（不是纯装饰——styles.css 里有 ~15 条 `.hud-right .signal-deck`/`.hud-right .captain-terminal` 历史规则靠这两个 class 撑起内部尺寸/布局，删掉会让终端整体失去大半样式），新增 `.pilot-terminal-overlay` 作为新覆盖层的定位钩子（`position:absolute;inset:0`，`opacity`/`pointer-events` 随 `body.terminal-open` 切换），desktop-only（`@media(min-width:861px)`，移动端沿用 U12d 既有的 `.hud-right{width:0;height:0;visibility:hidden}` + `#captainTerminal` 自身 `visibility:visible!important` 的穿透写法，两套机制互不打架）。`--hud-cols` 收窄成 2 列（防御模块+Combat View），Combat View 再次扩大。
- [x] `src/ui/terminalStarMap.js`：点击 Combat View（`#pilotFeed`，U13 已改的触发源）现在**同时**打开覆盖层（`body.terminal-open`）**并**直接落地到 Private Voyage Log（`setMode(false)`），不再默认停在星图壁纸；✕ 关闭按钮改调用新 `closeOverlay()`（移除 `terminal-open` + `setMode(true)` 暂停全息模型），移动端跳过整段逻辑（`matchMedia('(max-width:860px)')` 早退出，避免和 U12d 的 `mobile-log-open` 互相打架）。

### 14e · SC 细节回归：数字全动态 + 目标框精修 ✅

- [x] **目标框重做**：`drawTargetFrame` 从整框描边改成四角短线式 bracket（更小更精致，尺寸系数从 `.085` 收到 `.062`）；`createCombatHmdV3` 工厂闭包新增 `trackCx/trackCy` 状态，目标框/引导指示器改用对真实锁定点做逐帧 `lerp(.16)` 缓动后的坐标，读起来像伺服追踪而非瞬间贴合（彗星本体渲染仍用真实坐标，只有「跟踪框」这个概念上应该有迟滞的元素加了缓动）。
- [x] **周边多目标标签**：距离数字原本只由循环下标算出（同一帧永远同一个值，实际上首次绘制后就冻结），加了基于 `now` 的小幅漂移，视觉上「持续在动」但仍诚实标注为装饰性投影。
- [x] **右侧弹药计数**：原本是两行永不改变的写死字符串，主计数现在随真实 `killCount` 消耗（数值有真实含义，只是消耗速率是设计取舍非实测），副计数（当前弹匣）改为基于 `now` 的循环数字，不再冻结。
- [x] **验收**：vitest 518/518 通过；`npx vite build --outDir=/tmp/u14build2` 干净（main chunk 864.72 kB，沙盒 `dist/` 目录权限受限是已知问题，同 U13）。**视觉验收（唯一悬而未决项）**：四竖柱撑满无空白、座舱死数字清零、WPN 跟色正确、入梦 hover 能量格加速、点击 Combat View 出日志且样式完整（重点核对 `.hud-right` 历史规则是否如预期继续生效）、目标框贴身跟踪且明显变小——均需站主真机/浏览器复核（沙盒无法渲染 WebGL/实际布局——既有纪律）。

## U15 · serial.html 阅读器工具栏移动端精简 + 护眼配色降白点（2026-07-12 立项，代码已完成）

**目的**：缩短阅读工具栏，核心是对手机用户友好（单行放得下、按钮更少更大）；顺带降低两种浅色护眼主题的白点值，减少 OLED/LED 屏幕夜读刺激。

**现状盘点（动手前已核对的代码坐标）**：
- 工具栏结构 `serial.html:101–122`：目录 / 三主题色块（cream/green/night）/ 字号组（`A-` + `#fsVal` 数字 + `A+`）/ 自动翻页开关 + 慢中快三速钮 / 🌊瀑布流阅读 / 书签。
- 翻页速度 `serial.html:404`：`SPEED_PX = {1:0.4, 2:0.9, 3:1.7}`（px/tick，setInterval 滚动）。
- 书签为单条 `{chapterId, scrollY, ts}`（`serial.html:236`），保存后仅目录条目尾部加 ☆，不显示章节名；跳转靠浮动按钮 `#fabBookmarkGo`。
- 配色 `public/styles/serial.css:13–15`：cream `--read-bg:#f2e8d2/--read-bg2:#ece0c4`；green `#cfe6d1/#c1dcc4`；swatch 色块 `:94` 需同步。

**任务清单**：

- [x] **15a · 字号组精简**：删掉了 `#fsVal` 数字显示区及 JS 里对它的赋值；`A-`→「小」、`A+`→「大」（aria-label 保留中文语义）。字号步进逻辑（15–24px 范围）与 localStorage key 不动。CSS 同步删掉 `.fsize .val` 孤儿规则。
- [x] **15b · 自动翻页单一速度**：删除 慢/中/快 三按钮与 `.speedsel` 包裹层（`autoToggle` 直接作为独立 `.tbtn` 提到与目录/无限流同级）；`data-speed` 监听、`state.autoSpeed`、`SPEED_PX` 映射全部收敛为常量 `AUTO_SPEED_PX = 0.65`（(0.4+0.9)/2，慢中各半）。CSS 同步删掉 `.speedsel` 相关规则（含移动端媒体查询里的孤儿引用）。
- [x] **15c · 瀑布流改名**：🌊「瀑布流阅读」→ **♾️「无限流」**；连带把 `enableWaterfall()` 里同名 toast 文案从「瀑布流已开启」同步改「无限流已开启」，避免按钮与提示语不一致。内部变量名（`waterfallToggle`/`state.waterfall`/`LS.waterfall`）按「表面命名可换、内部标识符不动」原则未改，降低风险。
- [x] **15d · 书签详细化（按最小方案实施，站主未在裁决前给出反向指示）**：`setBookmark()` 新增 `chapterTitle` 字段；新增 `updateBookmarkBtn()`，工具栏书签按钮实时显示「★ 已存·〈章节名，截断 12 字〉」（`title` 属性给出完整章节名的 hover 提示），无书签时保持原「☆ 书签」外观；接入 `renderToc()` 统一刷新，避免多处重复读 localStorage。**注意**：仍是单书签（每本小说各自一条，按 `nsKey` 命名空间隔离），不是多书签列表——如果实际需要的是列表，需另立项。
- [x] **15e · 浅色主题降白点**：实测算过对比度后定案——cream `#f2e8d2→#e8dcc4`（bg2 `#ece0c4→#e2d4b6`，白点亮度降 ~11%，正文对比度 9.57:1，meta 文字对比度 4.77:1）；green `#cfe6d1→#c8dfcb`（bg2 `#c1dcc4→#bad5be`，白点降 ~7%，正文 9.50:1，meta 文字 4.65:1）——两套的 meta/次要文字对比度均 ≥4.5:1 WCAG AA 硬标准（green 若按最初设想降 14% 会跌到 4.3:1 不达标，已收窄到安全区间）。swatch 色块同步换色；night 主题未动。
- [x] **验收**：vitest 518/518 通过；`npx vite build --outDir=/tmp/u15check` 干净；HTML parser 校验标签闭合无误、无遗留 `fsVal`/`speedsel`/`data-speed` 孤儿引用。**视觉验收（唯一悬而未决项，既有纪律）**：站主 iPhone/浏览器复核工具栏单行布局、按钮触达面积、书签按钮长章节名截断观感、两套新配色的实际夜读感受。

## U16 · serial.html 沉浸阅读三项修复（2026-07-12 立项，代码已完成）

**目的**：① 删除页面左右两侧跳转到别的网页的箭头导航，增强小说阅读沉浸感；② 修复自动翻页开启后按「停止翻页」无法停止、只能靠手动滑动的 bug；③ 移动端书签按钮在工具栏上显示第几章（文字不超出工具栏）。

- [x] **16a · 删左右箭头导航**：serial.html 删除 `<nav class="page-turn-controls">` 整块与 body 上的 `data-prev`/`data-next`；`serialLibs.js` 去掉 `page-turn.js` import。**范围延伸（沉浸感的必然推论，站主可否决）**：`transition.js` 的全局 ←/→ 键盘监听读取的是 `body.dataset.prev/next`，而 `nav.js` 每页运行时都会把它们写回去——只删可见箭头的话，读者阅读中误按方向键仍会被跳到别的页面。因此 body 加 `data-no-page-turn` 标记 + `nav.js` 对带此标记的页面跳过 dataset/箭头 href 写入（共享代码改动仅此一处 if 包裹，其余 8 页行为不变）。`public/page-turn.css` 顺手删掉本次改动孤儿化的 3 条 `.novels-page .page-turn*` 规则（该文件其余内容——字体/View Transitions/Labs 下拉/通用按钮反馈——serial 页仍在用，`<link>` 保留）。
- [x] **16b · 停止翻页失效修复**：根因是 window 级 `touchstart` 监听——手指点「停止翻页」按钮时它先触发 `stopAuto()`（还弹「检测到手动滑动」toast），随后按钮自己的 `click` 处理器看到 `autoTimer===0` 又执行 `startAuto()`，按钮永远停不下来（桌面鼠标点击不经过 touchstart 所以没复现）。修复：`touchstart`/`wheel` 监听忽略事件源在 `#autoToggle` 上的事件，按钮点击交还给 click 处理器。
- [x] **16c · 移动端书签显示章节号**：移动端 `.lbl` 被 V22 规则隐藏（图标化工具栏），书签保存状态在手机上不可见。`updateBookmarkBtn()` 新增 `.bk-ch` 短标签（「第N章」，由 `bm.chapterId` 反查章节序号，兼容已存的旧书签），CSS 默认隐藏、`≤640px` 显示（桌面 `.lbl` 已显示截断章节标题，两者同显冗余）。几个字宽 + 工具栏本身 `nowrap+overflow-x:auto`，不会超出工具栏。
- [x] **验收**：vitest 518/518 通过；`npx vite build --outDir=/tmp/u16check` 干净（main chunk 864.72 kB，沙盒 `dist/` 权限受限用 `--outDir` 验证，已知问题）；grep 确认 serial.html 无遗留 `data-page-turn`/`data-prev`/`data-next` 引用。
- [ ] **视觉/真机验收（站主）**：箭头消失且 ←/→ 不再跳页、其余 8 页箭头/键盘翻页不受影响、手机上点「停止翻页」能真正停、书签按钮「★ 第N章」显示与不溢出——沙盒无法渲染，既有纪律。

## U17 · course.html 承载课程 v3.0 全部内容 + 每周一自动测评（2026-07-12 立项，代码已完成）

**目的**：① 把 course.md v3.0 的全部新内容（Ch00 技术树 + Ch06 互动测评）设计成网页课程内容上线到 https://feida.au/course.html，外部课程/文档全部一键直达链接；② 每周一 20:00 自动更新本周数据分析、与历史对比、客观 vibe coding 三维测评。

- [x] **17a · course.html v2.1 → v3.0**：新增 Ch00「AI Engineer Tech Tree」区（主干 T1–T5 表 + Branch A Applied LLM Engineering 六节点表含 Anthropic Academy/docs 一键外链 + B/C 指针卡 + §0.4 主赛道待定裁决记录 + §0.5 官方材料 hub）；新增 Ch06「互动导师制与评估循环」区（6.1 导师协议 / 6.2 三维评分卡 / 6.3 节奏 / 6.4 定向测评 #1 三道题全文 / 6.5 评分历史表，含 `DIM-SCORE:INSERT-POINT` 注释锚点）；新增 Weekly Review 区（`WEEKLY-REPORT:INSERT-POINT` 锚点 + 首期占位）；chapnav 加 00/06/Weekly 三项；1.6 变更表加 v3.0 行；§5.5 旧默认主赛道句按活文档规则标注更替；附录复盘周期加每周一任务；顶栏版本号 v3.0。全部沿用页面既有 data-en/data-zh 双语三份格式。
- [x] **17b · 构建与发现性**：vite.config.js 早已含 course 入口（U12b 悬空批次已入库，无需再改）；`public/sitemap.xml` 缺 course.html 条目，本次补上。nav.js SITE 已含 `/course.html`（Labs 组），无需改。
- [x] **17c · 定时任务 `course-weekly-review`**：cron `0 20 * * 1`（本地时间每周一 20:00，配合套餐周一刷新）。任务无状态：历史周报就存在 course.html 页面里（周环比直接读上期块），评分同步追加 course.md §6.5；只许改 course.html/course.md 两文件，vitest+build 干净才 push；熔断条款内置（发现冲刺超预算必须建议降负载）。已在 U7b 表之外新增，无到期日（长期任务）。
- [x] **验收**：vitest 518/518 通过；`npx vite build --outDir=/tmp/u17check` 干净（course.html 161.48 kB / gzip 50.33 kB）；HTML 标签平衡校验（section/div/table/tr/ul/li/a 全部配对）通过。
- [ ] **视觉/真机验收（站主）**：Ch00 两张大表在移动端的横向滚动、外链 ↗ 可点、Ch06 三道测评题排版、Weekly 占位样式——沙盒无法渲染，既有纪律。首期周报 2026-07-13（周一）20:00 自动生成，站主次日核一眼格式。

## U18 · stats.html 竞猜战绩存档 + league.html 下线 + 世界杯赛后同构处理（2026-07-12 立项，代码已完成）

**目的**：MSI 2026 结束，按 roadmap §7.4「赛后转战绩存档」既定设计：① 新建 https://feida.au/stats.html 把英雄联盟竞猜数据集合成图表；② league.html 暂时下线；③ 世界杯决赛出冠军+金靴后对 games.html 做同样处理。

- [x] **18a · stats.html 新建**：自包含页面（内联 CSS + 内联 SVG 图表脚本，无外部图表库），前端实时 fetch `/leagues-data.json` 计算——战绩条（13 判定 / 7 胜负判对 / 2 比分全中 / 54%）、逐场置信度柱状图（绿判对/红判错/金★全中）、累计命中率曲线（对照 50% 抛硬币基线）、置信度校准图（分 50–65/65–75/75+ 三组对比自称置信度 vs 实际命中率——顺带发现 65–75% 组命中 80% 而 75%+ 组只有 50%，校准图本身就有内容）、冠军/MVP 概率盘（总决赛结果落库后自动标 🏆/✓，读 `finalsMvp` 字段）、全量判定表。**exact 口径修正**：`lb-r2-g2` 预测 T1 3-1 实际 G2 3-1，字符串巧合相等但胜负判错——exact 必须以 ok 为前提，修正后与 record.exactScore=2 一致（代码内有注释）。双语 data-en/data-zh + AfflatusI18N。今晚总决赛（BLG vs HLE）结果由 leagues-msi-daily 最后一跑写入 JSON 后，页面数字自动更新，无需改码。
- [x] **18b · league.html 暂时下线**：nav.js SITE 数组中 league 条目换成 `{ path:'/stats.html', en:'Stats', zh:'战绩', group:'labs' }`（顶栏与 prev/next flat cycle 一并接管）；sitemap.xml 换行；vercel.json 加 302（`permanent:false`，「暂时」语义）`/league.html → /stats.html`；league.html 文件与 vite 入口保留不删（可随时上线回归）。stats.html 新增 vite 入口 + statsLibs.js（i18n/nav/transition/page-turn 标准链）。
- [x] **18c · 世界杯赛后同构处理**：已建一次性任务 `urgent-u18c-wc-archive`（fireAt 2026-07-20 20:00 本地，决赛次日晚），到期自动执行：games-data.json 决赛结果+金靴落定后，stats.html 世界杯占位区替换为同构图表区（冠军盘对实际冠军、金靴盘对实际金靴）、games.html 同法下线（nav/sitemap/vercel 302）、回写本条目。数据未落定则只在本条目下追加一行不动代码。带前置核验 + 到期日，符合 U7 纪律。**注意**：games record.log 无逐场置信度，届时校准图缺数据就不做，如实标注。
- [x] **验收**：node 抽验计算逻辑与 record 字段一致（13/7/2/54%）；vitest 518/518 通过；`npx vite build --outDir=/tmp/u18check` 干净（stats.html 22.96 kB / gzip 7.77 kB）。
- [ ] **视觉/真机验收（站主）**：stats.html 桌面+手机排版、图表可读性、语言切换、`/league.html` 302 生效（需 Vercel 部署后验）、顶栏 Labs 菜单出现「战绩」——沙盒无法渲染，既有纪律。明晨顺带确认总决赛结果已自动进页面。

## U19 · stats.html 仪表盘互动化 + 业界统计方法升级（2026-07-12 立项，代码已完成）

**目的**：以高级数据工程师标准重做 stats.html——增强互动性与视觉特效，并用业界标准数理统计方法呈现（不是堆特效，是让统计结论可探索、可质疑）。

- [x] **19a · 统计方法（全部前端实时计算，含代码内注释）**：① 命中率挂 **Wilson 95% 置信区间**（小样本二项比例标准做法，13 场算出 29.1%–76.8%）；② **精确双侧二项检验** vs 抛硬币（7/13 → p=1.00，卡片直接写「不显著，n 太小尚不能声称有技术含量」）；③ **Brier 评分 + 技能分 BSS**（0.246 vs 基线 0.25，BSS +1.6%）；④ 校准图重做成标准**可靠性图**（reliability diagram：对角线 + 分组 Wilson 须线 + 点大小=组内 n）；⑤ 累计命中率曲线加 Wilson 置信带阴影；⑥ **bootstrap 重采样**面板（2000 次有放回，rAF 分块动画出直方图 + 2.5/97.5 分位金线）；⑦ **置信度阈值探索器**（拖动滑杆实时重算 n/命中率/Wilson/Brier，注明是选择效应演示）。方法论小字区五条诚实声明（对接 course Lesson 2.3）。node 抽验：wilson(0,10)=[0,27.8%]、binom2(10,13)=0.092、binom2(13,13)=2.4e-4，均符合参考值。
- [x] **19b · 互动与特效**：逐场柱状图悬停 tooltip（对阵/预测/置信度/结果）+ 点击展开**判断依据抽屉**（读 series.reason_en/zh，判定表行同样可点）；数字卡 count-up 动画；图表卡 IntersectionObserver 入场淡入；命中率曲线 stroke-dash 描线动画；概率盘条形宽度过渡；band 标题扫光；卡片 hover 辉光。**克制纪律**：全部动效尊重 `prefers-reduced-motion`（RM 下静态直出），无常驻循环动画（扫光除外，RM 下关闭），不新增外部依赖。
- [x] **验收**：vitest 518/518 通过；`npx vite build --outDir=/tmp/u19check` 干净（stats.html 42.83 kB / gzip 14.08 kB）；HTML 标签平衡校验通过；统计函数 node 对照参考值抽验通过。
- [ ] **视觉/真机验收（站主）**：tooltip 在移动端的触点行为（tap=click 出抽屉，无 hover 是预期降级）、bootstrap 动画帧率、滑杆触达面积、双语切换后动态文本正确——沙盒无法渲染，既有纪律。

## U20 · Scheduled 任务分类治理 + 收盘链合并（2026-07-12 立项，已执行）

**目的**：任务数失控（11 个）→ 分类管理 + 合并题材相似的推送。经站主逐项确认后执行（U7「不擅动存量任务」约定履行完毕）。

**已执行（站主勾选）**：
- [x] **收盘双合一**：`arena-predlog-close-backfill` 并入 `arena-autopilot-b-post`（07:50 交易日）——两段原 prompt 原文拼接为 Phase 1/2，各自守卫互不阻断、各自 commit，删除原 backfill 任务（SKILL.md 留档可恢复）。U7b 的合并候选就此落地。
- [x] **世界杯清理归并**：`worldcup-games-daily` 描述所指的 `worldcup-games-cleanup` 从未存在——清理职责并入一次性任务 `urgent-u18c-wc-archive`（归档成功后顺手删除该日更任务，数据未落定则不删）。
- [x] **课程月度归并**：course.md 引用的 `course-ch01-monthly-review` 实际不存在（文档漂移）——其职责并入 `course-weekly-review`：每月第二个周一（8–14 号）附加 30 天窗口的 Ch01 画像重跑。`mts-gap-analysis` 同样不存在，按 v3.0 主赛道待定的现状，**裁决为 Branch B 后再建**，course.md 附录已同步修正。

**站主未选（保持现状，记录在案）**：收盘三合一（signal-warsh-daily 保持独立）；MSI 收尾——`leagues-msi-daily` 已过 through-date（7/12）但总决赛结果/finalsMvp 尚未写入 JSON（stats.html 在等），且 U7 所建 `urgent-u7-delete-leagues-msi` 不在当前任务列表（疑未建成或已被清理）——**该任务暂时继续日更，结果落库后需站主手动删除**。

### 任务台账（2026-07-12 治理后 · 10 个 · 每月 1 号例行审计对照本表）

| 分类 | 任务 | 时间（本地） | 到期日 | 备注 |
| --- | --- | --- | --- | --- |
| 市场 | ai-stock-arena-news-digest | 交易日 22:00 | 无 | arena-news.json |
| 市场 | arena-autopilot-a-open | 交易日 00:30 | 无 | ledger（Model A）|
| 市场 | **arena-autopilot-b-post**（U20 合并后） | 交易日 07:50 | 无 | Phase1 predlog 回填 + Phase2 Model B 决策 |
| 市场 | signal-warsh-daily | 交易日 07:00 | 无 | 站主决定保持独立 |
| 市场 | sectors-watch-weekly | 周日 10:00 | 无 | |
| 赛事 | leagues-msi-daily | 每日 22:00 | **已过期（7/12）** | 待决赛结果落库后站主手动删 |
| 赛事 | worldcup-games-daily | 每日 14:00 | 2026-07-20 | 由 u18c 归档后自动删除 |
| 课程 | course-weekly-review | 周一 20:00 | 无 | 每月第二个周一附加 Ch01 月度画像 |
| 一次性 | urgent-u18c-wc-archive | 2026-07-20 20:00 | 触发即停 | 世界杯归档 + games 下线 + 删日更任务 |
| 一次性 | （无其他） | | | |

长期纪律沿用 U7：限时任务必带到期日；任务无状态；每月 1 号审计对照本台账（旧 U7b 表就此废止，以本表为准）。

## U21 · feida.au 三阶段架构升级（2026-07-12 立项 · Phase 1 已完成）

**性质**：站主发起的整站评估-优化项目，三阶段各开一个会话（一事一会话，U7a 纪律），每阶段产出先 RFC 后动码（课程 O1 制度）。

### Phase 1 · 技术栈评估 + 数据结构审计 ✅（2026-07-12，本会话）

- [x] 产出 **`rfcs/2026-07-12-u21-phase1-tech-audit.md`**（rfcs/ 目录首篇，O1 制度落地）。要点：① 无框架 MPA + git-as-database 被裁定为**优势而非落后**（附重估触发条件）；② 六项真实债 D1–D6 按 ROI 排序（styles.css 层叠债 → `@layer` 渐进接管方案、无 CI、主 chunk 864 kB 无预算、novels-data 485 kB 全量下载、three 版本钉死、main.js 单体）；③ 数据层审计出 4 个反模式并给出重构示例（双语字段两套约定并存、opusScore 方向歧义——U18 真 bug 佐证、派生聚合漂移——record.log 8 条 vs series 13 场实证、finalsMvp 字符串匹配实体），2 个达标项点名（predlog 的「只许经脚本改」模式应推广）；④ 裁决表：立即做 CI+schema 校验骨架 / Phase 2-3 分工 / 明确不做框架迁移+Tailwind 全站+数据库。

### Phase 1 实施 · RFC 全量落地（站主指令：「把 RFC 内容按重要性等级做完」，2026-07-12，本会话）✅代码完成

范围界定：只做**代码可验证**的项（有测试/构建/schema 能证明对错），不做需要真机渲染判断的项（三阶段裁决表里 Phase 2 的 Lighthouse 基线、Phase 3 的视觉/UX 重排——沙盒不能渲染是既有纪律，R3/S4）。以下按 RFC §3 裁决表的重要性顺序（立即做 → Phase 2 安全部分 → 搭车项）：

- [x] **CI workflow**（`.github/workflows/ci.yml`，D2）代码已写好但**未推送**：push/PR 到 main 时跑 vitest → typecheck → 数据 schema 校验 → `!important` 冻结基线 → build → bundle 体积预算，五道门此前全部只在本地跑过、从未真正卡过合并。**⚠️ 推送被 GitHub 拒绝**——`refusing to allow a Personal Access Token to create or update workflow .github/workflows/ci.yml without workflow scope`，本仓库配置的 PAT 缺 `workflow` 权限（GitHub 对 `.github/workflows/*` 有额外的 token scope 要求，与其余文件不同）。文件已在本地 commit（`ci.yml` 单独一个 commit，其余改动已推送），**需站主二选一**：① 去 GitHub → Settings → Developer settings → Personal access tokens，给现有 token 加勾 `workflow` scope（或重开一个带此权限的 token）；② 站主自己在 GitHub 网页端手动创建这个文件（内容见本地 `.github/workflows/ci.yml`）。任一操作后下个会话可直接推送这一个 commit。
- [x] **数据 schema 校验骨架**（`src/lib/validate*.js` + `scripts/validate-data.mjs`，§2.7）：leagues/games/novels 三类数据各一个手写校验函数（沿用项目既有风格，非引入 ajv 等库），`validate-data.mjs` 聚合跑、缺文件 SKIP 不算失败。**leagues 校验内建 §2.3 派生聚合漂移检测**——用 `series[]` 现算 resolved/correctOutcome/exactScore 反查 `record.*` 是否一致。
- [x] **`@layer` 渐进接管**（D1，§1.3）：`src/styles.css`（7788 行）整体包进 `@layer legacy`，新增空的 `tokens`/`components`/`overrides` 三层，层序 `legacy, tokens, components, overrides`——新代码写进空层不需要 `!important` 就能盖过旧规则。`index.html` 内联样式里本就用来覆盖 styles.css 的一小段规则一并收进 `overrides` 层（显式化既有意图，而非隐式依赖源码顺序）。`scripts/check-no-new-important.mjs` 冻结现有 2958/2 处 `!important` 为基线，此后只许降不许升。
- [x] **vendor chunk 拆分**（D3 安全部分，§1.2）：`vite.config.js` 加 `manualChunks`，`three`/`astronomy-engine` 独立分包。主 chunk **864.72 kB → 185.8 kB**（three 挪进 `vendor-three` 674 kB、astronomy-engine 挪进 `vendor-astronomy` 46 kB，总字节数不变，纯缓存收益）。**真正的按需懒加载**（首页 three.js 启动时机后移）RFC 已明确标注需要真机 Lighthouse 基线才能安全做，本次不动，留给 Phase 2。`scripts/check-bundle-budget.mjs` 按分包设预算并接入 CI。
- [x] **数据结构兼容层**（§2.2/2.4 搭车项）：`src/lib/leaguesPick.js` 收拢「选边队伍/是否猜中/是否比分全中/finalsMvp 模糊匹配」四个判定，`stats.html` 改用它——不改动仍在被 `leagues-msi-daily` 定时任务写入的活数据 shape（迁移时机遵循 RFC「下次自然写入再迁移」的既定策略），只加固消费端。含一条回归测试，复现 U18 发现的真 bug（`msi-lb-r2-g2`：选边字符串巧合相等但赢家判断错误，不应计入猜中/全中）。
- [x] **i18n 数据工具**（§2.1 搭车项）：`src/lib/i18nData.js`（`pick`/`t`/`currentLang`），`stats.html` 接入替换 4 处 `zh() ? x_zh : x_en` 三元表达式。不强制迁移现存数据文件的双语字段约定（同上，一个写入方，下次自然更新再迁移）。
- [x] **novels-data 拆分为索引 + 分片**（D4/§2.5）：`public/novels-data.json`（485 kB 单文件，打开书架页也要整包下载）拆成 `public/novels-index.json`（书架元数据 + 章节数，**4.2 kB**）+ 每本书一个 `public/novels/<id>.json`（含正文）。`serial.html` 的 `boot()` 改读索引，`selectNovel()` 改为按需 fetch 对应分片（未加载则先 fetch 再重入自身，逻辑不变、只多一层缓存判断），`renderShelf()` 改用 `chapterCount` 字段。旧 `novels-data.json` 确认无其它引用后已删除（`git rm`）。
- [ ] **明确不做**（RFC §1.5 已裁决，本次沿用）：框架迁移（Astro/Next）、Tailwind 全站化、引入数据库替代 git-as-database、three.js 版本升级（无 breaking 需求驱动不动）。

**验证**：535/535 vitest 通过（新增 dataValidators.test.js 11 例 + leaguesPick.test.js 6 例，较 U20 时的 518 净增 17）、`tsc --noEmit` 干净、`node scripts/validate-data.mjs` 8 个数据文件全过、`node scripts/check-no-new-important.mjs` 未新增、`npx vite build` 干净（各 chunk 均在预算内，`vendor-three` 658.7/700 kB 94%、`main` 185.8/250 kB 74%）。**视觉改动只有 CSS 层叠机制本身（无样式改变，纯包裹），novels 分片切换涉及 serial.html 加载时序——仍建议站主真机走一遍书架切书 + 断点续读，沙盒无法渲染验证（既有纪律 R3）。**

### Phase 2 · Web 性能优化（待开工——新会话开头读本条 + RFC §1.2/§3；D3/D4 安全部分已在上面 Phase 1 实施中提前做完）

角色：Web Performance Expert。范围：Core Web Vitals 达标清单——three.js **真正懒加载**（首页启动时机后移，而非本次已做的 vendor 分包）、缓存策略（Vercel headers/immutable assets）、CSS 优化（`@layer tokens`/`components` 实际填充 + 48 处 backdrop-filter 的移动端 GPU 账，对接 course Lesson 2.7）、渲染瓶颈（rAF 循环成本、hydration 不适用——无框架，如实跳过）。**先真机 Lighthouse/CrUX 拿基线数字再动手，无基线不许改**（验证要客观，S4）。

### Phase 3 · UI 现代化与 UX ✅RFC 已产出（2026-07-13，本会话；动码待下一会话）

角色：Lead UX/UI Designer。范围：微交互/自适应布局/暗色模式的系统化（现状已是深色科幻主题，重点是 tokens 化而非风格翻新）、a11y 审计（WCAG AA，course Lesson 2.8 四维打分制上线）、`@layer tokens` 设计令牌落地（RFC 已裁决不引 Tailwind，用 tokens 达到同等一致性）、组件结构与直觉导航重排。红线：Lesson 2.8 的克制维度——删元素优先于加特效。

- [x] 产出 **`rfcs/2026-07-13-u21-phase3-ui-ux.md`**，沿用 Phase 1「RFC 先行、动码另起」流程。要点：① 用 Lesson 2.8 四维打分制**代码审计代理值**给现状打分——视觉层级 18 + 间距 12 + 对比度 17 + 克制 20 = **67/100，低于站主自己定的 70 分不上线门槛**（视觉层级维度无法真机验证，是历史记录估计值，其余三维有具体代码证据）；② 间距：566 处像素值仅 14.3% 落在 8px 网格、68.0% 完全不在 4px 网格上；③ 对比度：核心 token 里 `--dim`（次要文字/时间戳，9–11px 场景）对背景仅 4.32:1，低于 WCAG AA 4.5:1，是全套 token 里唯一不达标项，另有 12 处 opacity 淡出文字对比度未知需人工复核；④ 克制：48 处 `backdrop-filter`（Lesson 2.7 已点名的 GPU 大户）清单待站主逐条取舍，5 处 `outline:none/0` 中 2 处（`.mobile-weapon-form select`、`.starmap-controls range`）无替代焦点样式，全站仅 4 处 `:focus` 规则，键盘可达性密度偏低；⑤ 移动端 2 处触控目标（26–28px）低于 44px 建议下限；⑥ 裁决：`@layer tokens` 颜色/间距/`:focus-visible` 三块新增规则风险低、下一会话可直接做，backdrop-filter 取舍清单需站主判断，间距存量值替换和视觉层级真实打分需真机验证不可盲改。
- [ ] **站主看过 RFC 后决定是否照 Phase 1 的先例发「按重要性做完」指令**——本次只产出评估文档，未动任何代码。

**验证**：本次仅新增一个 rfcs/*.md 文档，未改动任何代码文件，不影响既有 535/535 vitest / build 状态。

## U22 · 太空战斗视觉宪章 + 3D 技术栈裁决 + 跨页 UIUX 准则（2026-07-13 立项，RFC 已产出）

**性质**：设计宪章，非施工单。参照星际公民/精英危险/家园系列/群星四作提炼首页战斗效果与全站设计准则；目标是首页达到尽可能接近 3D 网页游戏的战斗与建模效果。条目经站主裁决后分流：视觉施工进 roadmap，性能项并入 U21 Phase 2，tokens/UX 项并入 U21 Phase 3；首页 3D 战斗升级须先出独立 RFC（O1 制度）再动码。

**RFC 已产出**：`rfcs/2026-07-13-u22-homepage-3d-combat.md`（六条宪章代码审计打分 + 22b 技术栈现状复核 + 22c 与 U21 Phase 3 的分工裁决）。核心发现三条：① 六条宪章代理总分 72/100，欠账最多是「②每个读数绑真实状态」（12/20，U14e 已知未完成项）与「④剪影先于细节」（8/15，全仓库零 LOD 机制，无法真机验证）；② **bloom/ACES 管线与 OffscreenCanvas+Worker 模式在仓库里都已生产验证**（`alphardForge.js`/`backgroundScene.js`），22b 原表「评估引入」应降级为「复用推广」，技术风险比立项预估低；③ **关键事实**——首页默认 Combat View 是 Canvas 2D HUD（`combatHmdV3.js`），3D 俯视战场 `topdownCombat.js` 目前只在 `?combatview=topdown&combatcam=director` 双 query flag 下才渲染，普通访客默认看不到——「首页像 3D 网页游戏」的真正决策点是**要不要把默认视图换成/叠加 3D 场景**，这是仓库近期最大的架构级视觉决策，RFC 建议单独开会话+独立 RFC 裁决，不塞进本轮执行阶段。RFC §4 裁决表已把可直接做 / 需真机基线 / 需站主裁决 / 不做四类分好。

### 22a · 四作设计语言提炼 → 六条宪章

各取所长（每作只取一件当家本领，不做缝合怪）：

- **星际公民 → 剧情化（diegetic）UI**：一切界面都是「舰内真实存在的设备」——HUD 悬浮在场景里而非贴在网页上（U8/U14 已在走这条路，升格为全站准则：新 UI 元素先问「它是舰上哪台设备」）。
- **精英危险 → 功能极简 + 双色温**：每个 HUD 元素必须对应一个真实状态，装饰性读数一律不留（U14「死数字清零」的准则化）；配色学它的「自己=暖色 / 世界=冷色」二分——本站现有青白（世界/数据）+ 琥珀（自身/警示）已暗合，写死为 token 规则。3D 椭圆雷达盘（U9）就是精英危险的招牌，保持。
- **家园系列 → 弹道芭蕾 + 剪影可读性**：尾迹/弹道/爆闪本身就是信息载体（V18 彩带系统的理论依据）；所有舰船在最远镜头下必须靠**轮廓剪影**可辨识（建模验收标准：涂黑看剪影）；背景星云用水彩式低饱和色带，克制分级，永不抢主体。
- **群星 → 数据渐进披露**：默认只给图标+一个数字，hover/点按才展开完整卡片；帝国级信息密度靠层级而不是靠字数——这是「精简内容替代长文字」的实现机制。

六条宪章（全站裁决标准）：① 每个 UI 元素是一台舰载设备；② 每个读数绑一个真实状态；③ 运动即信息，无信息不运动；④ 剪影先于细节；⑤ 双色温纪律（冷=世界，暖=自身/警示，武器四色为唯一例外域）；⑥ 渐进披露，默认一层，展开两层，禁止第三层。

### 22b · 3D 战斗技术栈裁决表（尊重 U21 RFC 既有裁决：不迁框架、three 不无故升级）

| 层 | 裁决 | 说明 |
| --- | --- | --- |
| 渲染器 | 保持 THREE.js（已 vendor 分包）；**评估** WebGPURenderer+TSL 双路径，WebGL2 兜底 | 2026 主流浏览器 WebGPU 已可用，但须 Phase 2 真机基线后再裁决，无基线不动（S4） |
| 后处理 | bloom + ACES tone mapping + 轻量 AA，桌面开、移动关 | roadmap C3 既有挂名项，是「像游戏」观感的单一最大杠杆 |
| 资产管线 | glTF + Draco/meshopt 压缩、KTX2 纹理、LOD 三档（近/中/剪影） | 现全部程序化建模（carrierHull 等），新增复杂模型才引入，不返工存量 |
| 特效 | InstancedMesh GPU 粒子（已有）+ shader 星云背景板 + 命中闪白/屏震 | 全部走既有单 draw call 纪律 |
| 线程 | 主场景评估 OffscreenCanvas + Worker；动态分辨率缩放 + DPR 封顶 | 移动端帧率地板的关键路径 |
| 帧率预算 | **桌面 60fps / 移动 40fps 地板**，低于地板自动降级特效档位 | 与 bundle 预算同级的 CI 外准则，真机测 |
| 现代 CSS | scroll-driven animations 替代 JS 滚动监听、View Transitions API 做页间跃迁转场、container queries、`:has()` | 全部渐进增强、无 polyfill；顺带瘦身 styles.css（@layer 已就位） |

### 22c · 跨页 UIUX / 人机交互准则（Web + Mobile）

- **统一舰桥外壳**：9 页共享顶栏/翻页/boot 序列/三态信号（加载=SCANNING、空态=NO CONTACT、错误=OFFLINE，全部舰载化措辞），tokens 落地走 U21 Phase 3。
- **数据直观性**：长表一律降维为「卡片 + sparkline + 对比锚点」（数字必须带趋势方向和参照系，如现有 vs SPX 模式推广到 arena/sectors/stats 全部数字）；每页首屏必须给出一句话结论，细节渐进披露（宪章⑥）。
- **精简代长文**：horoscope/serial 等长文本页折叠为「结论行 + 展开」；解释性文字改图标+tooltip；双语 microcopy 单行封顶——用 22a 的披露机制系统性替代篇幅。
- **移动可用性**：触控目标 ≥44px（Phase 3 RFC 已点名 2 处欠账）、核心操作收进拇指区、手势翻页与 `prefers-reduced-motion` 全覆盖、hover 依赖零容忍（所有 hover 信息必须有点按等价物）。
- **反馈完整性**：一切可点元素配 hover/active/`:focus-visible` 三态（接 Phase 3 RFC 键盘可达性欠账），任何操作 200ms 内给可见反馈。

### 22d · 落地路径

- [ ] 站主逐条裁决 22a–22c（勾选/划掉即裁决记录）。
- [x] **首页 3D 战斗升级 RFC 已产出**：`rfcs/2026-07-13-u22-homepage-3d-combat.md`（六条宪章打分 + 22b 技术栈现状复核 + 22c/Phase3 分工裁决），未动码。**该 RFC 明确「默认视图是否换 3D」这一核心决策仍需另开会话+独立 RFC，本篇只是前置审计**，不算最终裁决完成。
- [ ] RFC §4 裁决表里「可代码验证、下一会话可直接做」三项（DPR 统一/座舱静态装饰清理/PWR·WPN·THR 能量格绑定）与 U14b/U14c 范围重合，建议下一批直接按 U14 施工，无需再单独立项。
- [ ] 裁决通过的 UIUX 条目并入 U21 Phase 3 实施清单；性能条目 + 首页默认视图决策并入 Phase 2（依赖真机 Lighthouse/CrUX 基线，RFC 建议 U21 与 U22 的真机测量合并一次做）。
- [ ] 宪章定稿后摘要写入 roadmap（长期规范归 roadmap，本文件只留裁决过程）。

## U24 · 3D 战场起飞/降落多视角（2026-07-13 立项，站主反馈「战机只有俯视角」）✅ 代码已完成（2026-07-13，已推送 `e6367ef`）

**实施记录**：24a `src/combat/flightPath.js`（Hermite 链式段，段间 C1 由构造保证；起飞 join 后与解析编队**逐字节一致**、着舰停驻点=甲板参考点使自动再起飞零跳变；`tests/flightPath.test.js` 11 例：端点/边界连续性/NaN 扫描/相位表）。24b+24d topdownCombat：四新 shot（deckCam 带舰体包围球防穿模、chaseLaunch 用解析加速度驱动 FOV/坡度、towerCam 长焦 38°、flybyCam 定点掠过锚点取自进近中段）+ `requestFlightEvent()`（事件互斥，同屏至多一机脱轨；着舰后 2.2s 甲板停驻自动再起飞成完整生命周期循环；事件期间压制周期性 chaseCam）。24c main.js：blit 分支扩到 launch/landing，`pilotView.started` 戳记保证一次模式进入只触发一次事件，HMD 标签随模式换（弹射起飞·甲板机位/进近回收·塔台机位）；**采纳风险小节建议裁决**——飞行时间线场景自治跑完，不受 2200ms 模式窗截断；`?combatview=2d` 一键退回旧 2D 路径不变。验证：546/546 vitest（净增 11）、tsc 干净、构建干净（topdownCombat 分片 24.5→29.6 kB，预算内）、`!important` 基线未动。

- [ ] **站主真机验收**：进入 Command 后等一次起飞（护航机出击触发 launch 模式）与降落事件——甲板机位→尾追爬升→入列、塔台→掠过→甲板着舰两条镜头链逐段过目；帧率与 M1 同点关注。

### 原立项分析（保留）

**问题与根因**：M1 上线后 3D 战场成为默认，但**只有 combat/standby 两个模式走 3D**（main.js:3172 的 blit 分支），launch/landing 仍落在旧 2D 路径（drawPilotDeck/drawExternalLaunch 线）；且 3D 场景里三架战机是解析编队环飞（`ph = t*1.1 + i*2π/3`），**没有起飞/降落的飞行生命周期**——镜头库有 chaseCam/bridgeWide 等 6 个预设但没有对应的飞行事件可拍。所以「不能像游戏那样切起飞/降落视角」不是镜头问题，是**没有可拍的飞行叙事**。

**解决架构**（全部沿既有模式扩展，不新发明系统）：

- **24a · 飞行生命周期状态机（纯函数，先行）**：新建 `src/combat/flightPath.js`——单机生命周期 `DOCKED → CATAPULT → CLIMB → CRUISE(入编队) → BREAK → APPROACH → TOUCHDOWN → DOCKED`，每段参数化样条（时间驱动，非逐帧物理），段间位置/速度 C1 连续；速度/加速度走解析求导（chaseCam 既有先例，零帧差分噪声）。相位表复用 `weaponClock.startTimeline` 结构（`catapult@0 → rotate@1200 → climb@2600 → …`），相机切换点直接吃具名 phase。**vitest 覆盖**：段边界连续性 ε 断言、全程无 NaN、CRUISE 出入口与解析编队解的混合（smoothstep ~1.5s）收敛。
- **24b · 镜头库扩四个 shot**（`topdownCombat.js` shots 表，照抄现有 compute() 闭包模式）：`deckCam`（甲板固定位盯弹射，微仰角）、`chaseLaunch`（尾追起飞机，`fovForAccel` 拉 FOV + `bankedUpVector` 压坡度——数学件全部现成）、`towerCam`（塔台/LSO 视角看进近，长焦小 FOV）、`flybyCam`（固定点让战机贴身掠过——游戏运镜经典款，机位取自航线切线偏移）。全部走 `weaponCameraDirector` 既有优先级/抢占/到期规则，不加新相机系统。**防穿模**：shot 机位对舰体包围球做 clamp（mainGunAxis 已有同类处理可参照）。
- **24c · 模式桥接（main.js）**：blit 分支从 `(mode==='combat'||mode==='standby')` 扩为含 `launch`/`landing`；进入 launch 时调用场景新增的 `td.requestFlightEvent('launch')`（内部起 24a 时间线 + 按 phase 依次请求 deckCam→chaseLaunch→归位 tacticalTopdown），landing 同构（towerCam→flybyCam 可选→touchdown）。触发源就是现有 `setPilotView('launch',…)` 调用点（:1858/:1891/:2069），零新事件系统；`?combatview=2d` 整体退回旧 2D 路径的保证不变。
- **24d · 编队完整性**：起飞/降落机离开编队期间，其余两机保持解析环飞不动；回归时用 24a 的混合段无缝入列。同屏最多一架处于非 CRUISE 状态（新事件抢占旧事件，直接跳到混合段收尾），避免三机同时脱轨的镜头混乱。

**里程碑**：24a（纯函数+测试，可立即开工，沙盒可完整验证）→ 24b+24d（场景内，构建验证）→ 24c（main.js 桥接，改动面最小但在最脆的文件里，单独一批）→ 站主真机验收（起飞/降落各触发一次，四个新镜头逐个过目；帧率照 U23 M1 的关注点）。

**风险**：主要在 24c——main.js 的 pilotView 时序（launch 2200ms 窗口 vs 飞行时间线更长）需要决定「模式结束但飞行未完」的行为：**裁决建议**＝飞行时间线独立于 pilotView 跑完（场景自治），pilotView 只负责把画面留在 3D 分支；若站主想要模式严格同步，24a 时间线整体缩放到模式时长即可（参数化设计已预留）。

## U25 · 首页 HUD/战斗效果/UI 整体改造（2026-07-13 立项并完成，已推送 `4b262f5`；**同日站主要求退回，已 revert，见下**）

**站主裁决**：范围=战斗效果+HUD 信息层两者都要；bloom 性能策略=桌面开、移动关（≤860px / deviceMemory≤4 / reduced-motion 直接走原渲染路径，零移动端风险）。

- [x] **U25a 战斗效果冲顶**（topdownCombat.js）：ACES tone mapping + UnrealBloom 合成器（复用 alphardForge 生产管线，阈值 0.55 只让光效泛光）；确认击毁 = bloom 脉冲一次；大爆炸 = 冲击波环（面向相机 billboard 扩散）+ 6–12 枚径向碎片火花 + 相机冲击抖动（render 前加 render 后减，不污染导演阻尼状态）；曳光弹配炮口闪光（纯 sprite 无新增光源——曳光 9 发/秒，加灯是帧率陷阱）。
- [x] **U25b 真投影 HUD 信息层**（新 `src/ui/tacticalOverlay.js` + 场景 `getHudFeeds()`）：目标框第一次画在**真实 3D 投影**上（彗星 project 到屏幕坐标，框随距离缩放显深度；锁定=琥珀色+脉冲环；血条绑真 hp，<35% 转琥珀）；目标出屏/在身后 = 边缘追踪箭头（真实方位）；三架僚机小菱形标记（飞行事件机带 CAT/CLB/APP 相位标签，接 U24）；底部 CAM 读数显示当前 shot 名+真实 FOV。3D 分支的合成 HMD pass 就此退役（`drawPilotHmd` 仍服务导弹/核弹模式与 `?combatview=2d` 全路径，未删）。
- [x] 验证：550/550 vitest（tacticalOverlay 纯函数 4 例新增）、tsc 干净、构建干净（topdownCombat 分片 29.6→31.8 kB 预算内）、`!important` 基线未动。

### U25 · Revert ✅（2026-07-13 同日，已推送 `643d1cb`）

**站主指令**：「把 combat view 改成之前的效果」。澄清后确认范围＝退回 U25（保留 U23/U24：3D 默认、导演运镜、起降生命周期全部不动，只撤本项的 bloom/冲击波/真投影 HUD）。

- [x] **`git revert 4b262f5 --no-commit`**：先核对 U25 之后的三次定时任务提交（Arena/course 周报/yuxi 小说更新）均未触碰 `src/main.js`/`src/scene/topdownCombat.js`/`src/ui/tacticalOverlay.js`/`tests/tacticalOverlay.test.js` 这四个文件，revert 可干净应用（无冲突）。`tacticalOverlay.js` + 其测试文件整体删除，`main.js`/`topdownCombat.js` 精确回退到 U25 之前的字节状态。
- [x] 验证：546/546 vitest（与 U24 完成时的计数逐位吻合，确认回到 U24 状态而非过度回退）、tsc 干净、构建干净（topdownCombat 分片回落到 29.61 kB，与 U24 完成记录的「24.5→29.6 kB」终值一致）、`!important` 基线未动。
- [x] 提交推送 `643d1cb`。
- [ ] **站主真机复核**：Combat View 应回到 U24 完成时的样子——3D 战场默认开启、导演运镜/起降镜头链都在，但没有 bloom 泛光、没有冲击波/碎片/炮口闪光，目标框是原来的合成 HMD 面板（非真投影）。

## U23 · 首页默认视图换 3D 场景 — 架构裁决（2026-07-13 立项，RFC 已产出，未动码）

**性质**：U22 RFC 点名的「仓库近期最大架构级视觉决策」的正式裁决文档。全文见 **`rfcs/2026-07-13-u23-default-3d-scene.md`**，本节只留裁决摘要与开工指针。

**RFC 核心结论**：

- **路线裁决：B → A 两步走，C 永久否决**。B = Combat View 默认 3D 化（撤 `?combatview=topdown&combatcam=director` 双 flag 门槛，topdownCombat 转正，2D HMD 降级为 `?combatview=2d` 皮肤）——≤1 个会话、改的是已存在已测路径，是「所有访客立刻看到 3D 战斗」的最短路径。A = 单 renderer 3D 舞台化（blackhole 背景 pass 并入、滚动驱动 weaponCameraDirector 运镜、内容 DOM 悬浮）——「像 3D 网页游戏」的主要来源。C = 全游戏化 boot 因摧毁投资日志的内容属性/SEO/单人维护性被永久否决。
- **资产盘点**：不缺技术件缺编排——OffscreenCanvas+Worker（backgroundScene）、UnrealBloom 合成器（alphardForge）、相机导演状态机、InstancedMesh 特效全部已生产验证，新代码只集中在 stage 编排/设备探针/帧率 governor 三处。
- **性能守门**：T0–T3 四档设备分级（探针定档存 localStorage，`?view=classic` 逃生门）、帧率 governor 自动降档（桌面 60/移动 40 地板）、draw call/三角形/纹理预算表（M0 基线后定稿）、不可见不画的 rAF 治理、context-loss 舰载化恢复、three 懒加载与 U21 Phase 2 合并施工。
- **里程碑**：M0 真机基线（与 U21 Phase 2 合测）→ M1 3D 战斗默认化（**唯一可立即开工项**）→ M2 统一舞台（桌面先行）→ M3 bloom/ACES 冲顶+boot 序列 → M4 WebGPU 按触发条件评估。

**待站主裁决（RFC §7 三问）**：

- [ ] ① B→A 路线是否通过；
- [ ] ② 移动端 M2 默认档位（RFC 建议 T1 起步，凭 GA4 fps 数据升 T2）；
- [ ] ③ starfield Worker 线是否保留为 T1 兜底（RFC 建议保留）。
- [ ] 裁决通过后：新会话「读 Urgent.md U23 + RFC，开工 M1」。

### U23 M1 · 首页战斗场景默认 3D 化 ✅ 代码已完成（2026-07-13，站主指令「首页太空战斗转 3D，开始向新页面风格迁移」，已推送 `5a855ac`）

- [x] **默认值翻转**（RFC M1 原样施工）：`combatViewTopdown()` 改为默认 true（`?combatview=2d` 持久化退路，`localStorage afflatus-combatview` 机制沿用）；`combatCamDirector()`（main.js）与 `cameraDirectorEnabled()`（topdownCombat.js）同步改为默认 true，`?combatcam=tactical` 退回固定战术相机。一个 `?combatview=2d` flag 即可整体还原旧体验（导弹 drawMissileCine 分支含在内）。2D HMD/SC 皮肤代码零删除，只降级为退路。
- [x] **boot.html 自动进舰桥**：删「点击进入舰桥」按钮，自检序列完成（进度条是真任务门控，走完即全部就绪）后 700ms 自动移交舰桥（`prefers-reduced-motion` 直接进）；boot.js 的 director 注入随 M1 默认化删除（本次改动产生的孤儿）。
- [x] 验证：535/535 vitest、构建干净、`!important` 基线未动。
- [ ] **站主真机复核**：首页 Command 模式 Combat View 应直接出 3D 俯视战场+导演运镜；`?combatview=2d` 应完整回到旧 2D HMD；boot.html 应无按钮自动进入。低端设备帧率关注一下——M1 是 T 档探针（M2/M0）落地前的先行军，如有卡顿反馈记回本节。

### U23-C · 方案 C 原型试做 ✅ 代码已完成（2026-07-13，站主指令「试试看全游戏化 boot」）

RFC 否决的是「C 替换默认首页」；站主要求**体验一下 C**，故按可抛弃原型实施，生产路径零改动：

- [x] 新增独立原型页 **`/boot.html`**（vite 新 entry；`noindex,nofollow`；**不进 nav SITE**——对 roadmap C5「第 N 页先评估」规则的豁免理由：一次性试验品，体验后要么删除、要么转正时再走 C5 评估）。
- [x] 体验流：舰载 OS 开机自检打字序列（进度条+双语日志，`prefers-reduced-motion` 直出）→「点击进入舰桥」→ 全屏 3D 战场（**复用 `createTopdownCombat`，零新场景代码**；three 在打字动画期间并行 `import()`，加载被叙事遮住）→ 剧情化舰桥坞站（ASSET DECK/ARENA/SECTORS/SIGNAL/LOG 五站 + CAM 运镜切换 + EXIT SIM，全部真实链接）。
- [x] 纪律照走：右上遥测只放真数据（时钟+实测 FPS+相机模式，宪章②）；`document.hidden` 停画（不可见不画）；WebGL 不可用 → 「SIGNAL LOST」舰载化兜底；CAM 站在 `?combatcam=director` 与默认战术相机间切换（复用既有 query 机制）。
- [x] 验证：535/535 vitest、`vite build --outDir dist_boot_check` 干净（boot 独立 chunk 2.5 kB 级，vendor-three 复用既有分包）、`!important` 基线未动、体积预算全过。
- [x] **宪章重构（2026-07-13 站主指令「参考四作风格开始重构」，已推送 `3e3a08e`）**：四作准则逐条落地——**精英危险（宪章②）**：开机自检改为**真实任务门控**，每行 OK 只在对应 promise 真正 resolve 后打印（场景 import、五路数据 uplink、字体缓存），失败诚实打印琥珀色 OFFLINE 绝不假 OK；**群星（宪章⑥）**：坞站两层披露——默认「站名+一个活数据徽章」（ARENA=A 账本实时权益、SECTORS=篮子数、SIGNAL=鹰鸽罗盘读数、INTEL=竞猜胜率、LOG=书目数，全部来自与正式页面同源的 public/*.json），hover/focus 展开两行详情，无第三层；**精英危险（宪章⑤）**：双色温 token 化——青=世界/数据（六个目的地站），琥珀=本舰/警示（遥测、CAM、EXIT SIM）；**家园**：导演运镜改为**默认开启**（`?combatcam=tactical` 才是选项），CAM 站双向切换。新增 INTEL 坞站（games.html 入口）。验证：535/535 vitest、构建干净、`!important` 基线与体积预算未动。
- [ ] **站主真机体验 `feida.au/boot.html`（部署后）**：默认（导演运镜）+ `?combatcam=tactical` 各走一遍，hover 各坞站看披露与活数据——这次体验就是「C 是否值得转正」的裁决输入；结论记回本节（转正 = 重开 RFC 推翻 §2 否决；不转正 = 删 boot.html+src/pages/boot.js+vite entry 三处即净）。
- ⚠️ 顺手发现：`public/games-data.json` 有一处未提交改动（疑似 worldcup-games-daily 任务写入后 commit 步骤未跑完），本次未处理，站主核对后提交或让任务下轮补跑。

## U7 · Claude 会话卡顿 + Scheduled 任务统筹管理（2026-07-10 立项）

**诊断**：卡顿有两个独立来源——① 单个对话历史太长（上下文越长每轮响应越慢，这是模型工作方式决定的，不会自愈）；② Scheduled 任务已积累 8 个，每个每天/每周产生新的运行会话记录，进一步堆积。

### 7a · 会话管理：状态外置工作法（核心原则：对话可弃，文件永存）

本仓库已经形成三层文件记忆，**任何工作状态都不依赖对话历史**：

| 层 | 文件 | 用途 |
| --- | --- | --- |
| 当前冲刺 | `Urgent.md` | 正在处理的紧急项，做完划掉 |
| 长期规划 | `roadmap.md` | 队列 A/B + 各模块规格（§7.x） |
| 历史归档 | `RELEASE_NOTES.md` | 已完成事项的完整实施记录 |

执行规则：
- [ ] **旧对话直接归档/删除**——所有已完成工作的状态都在上面三个文件+git 历史里，删对话零信息损失。这是解卡的最直接手段。（Cowork 界面操作，沙盒没有对应工具，需站主自己在会话列表里清理。）
- **一事一会话**：一个改造批次开一个新会话，开头一句「读 Urgent.md / roadmap.md §X 继续」即可满血接力；做完即弃，不在同一会话里跨多个批次。
- **卡顿即换车信号**：感觉变卡就让当前会话把未完成状态写进 Urgent.md（像本文件 U1–U6 的做法），然后关闭开新会话，不要硬撑到上下文极限。
- **长材料进文件不进对话**：长 prompt/参考资料/图片说明放 `prompts/` 或仓库内文件，会话里只引路径——同一份材料复述多轮是上下文膨胀的主因之一。

### 7b · Scheduled 任务统筹（现有 8 个，2026-07-10 摸底）

| 任务 | 频率 | 状态与处置 |
| --- | --- | --- |
| ai-stock-arena-news-digest | 交易日 22:00 | 保留 |
| arena-autopilot-a-open | 交易日 00:30 | 保留 |
| arena-autopilot-b-post | 交易日 07:50 | 保留 |
| arena-predlog-close-backfill | 交易日 07:15 | **合并候选**（见下） |
| signal-warsh-daily | 交易日 07:00 | 保留（事件驱动+周五例行） |
| sectors-watch-weekly | 周日 10:00 | 保留 |
| leagues-msi-daily | 每日 22:00 | **7/12 决赛后到期 → 7/13 起停用并删除**（任务描述本就写明 through 2026-07-12；赛后转战绩存档是 roadmap §7.4 既定设计） |
| horoscope-transits-daily | 每日 06:30 | 保留 |

处置清单（2026-07-11 核对：8 个任务与上表逐条对得上，无遗漏无新增）：
- [x] **7/13 删 leagues-msi-daily**——已建自动一次性任务 `urgent-u7-delete-leagues-msi`（2026-07-13 09:00 本地时间触发，只做「删 leagues-msi-daily + 勾掉这一行」两件事，不碰其他存量任务），到期自动执行，不需要人再记着手动删。**⚠️ 2026-07-12 U20 审计：该一次性任务不在当前任务列表（疑未建成），且总决赛结果尚未写入 leagues-data.json——leagues-msi-daily 暂保留继续日更，结果落库后站主手动删（见 U20 台账）。**
- [x] **评估合并** arena-predlog-close-backfill → arena-autopilot-b-post：~~本沙盒读不到 SKILL.md 全文~~（2026-07-12 已可直读任务文件）——经站主确认后于 U20 执行完毕：原文拼接为两 Phase，删除 backfill 任务。
- [ ] **定期清理任务运行会话**：Scheduled 每次运行产生一条会话记录，按周/按月批量删除已成功运行的旧记录（数据结果都已 commit 进 git，运行记录本身无保留价值）。这是 Cowork 界面操作，沙盒没有对应工具，需站主自己在侧边栏清理。

长期纪律（写入日常习惯，不是一次性动作）：
1. **限时任务必带到期日**：新建任何赛事/事件类任务，描述里写明 through YYYY-MM-DD，到期即删（leagues 是正面示范）。
2. **任务无状态**：prompt 只写规则，状态一律在 JSON 数据文件里（现状已如此，保持）——这保证任务的会话永远短。
3. **每月 1 号例行审计**：开个新会话说「列出全部 Scheduled 任务，标出过期/失败/可合并项」——5 分钟的固定动作防止再次积累到今天的规模。
