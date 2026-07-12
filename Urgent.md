# Urgent — horoscope.html 紧急改造清单（2026-07-10 立项）

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
> | U21 Phase 2 | 未开工 | 新会话 + 真机 Lighthouse/CrUX 基线先行 |
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
