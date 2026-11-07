# 趣味占星重设计 · 执行路线图

2026 年 10 月 23 日。依据：[DESIGN.md](DESIGN.md)（方向 A「掌上星历仪」）。原型：[prototype.html](prototype.html)。状态：**计划，尚未开工**；10-23 新增引擎线 R（R0 进行中）。

## 怎么用这份路线图

- 每个模块（M0–M14、C）对应**一个会话、一个分支、一个 PR**，模块之间只通过本文列出的接口衔接。
- 每个模块都写明：目标、依赖、改哪些文件、交付物、可验证的验收标准、规模和建议模型。末尾附可直接粘贴的会话简报。
- 新视觉一律挂在 `?fx=almanac` 后面。站主真机签署之前，线上默认仍是现版（`design.md` §6）。

**规模**：S ≈ 一个短会话；M ≈ 一个完整会话；L ≈ 两个会话或需要拆分。

## 优先级路径

```
波次 0（立刻，可并行）  M0 现版快修 + 开关 + 文档      C 内容整改（贯穿全程）
                        R0 排盘与合盘规则校正（REL-030 部分，已裁定 Q1–Q5、Q8、Q9）
                              │
引擎线（与波次 1–3 并行） R1 契约·纯函数内核（REL-010）─▶ R2 时刻·区间·IANA（REL-020）
                        ─▶ R3 六维量表·证据账单（REL-070）─▶ R4 隐私·存储（REL-080）
                              │
波次 1（地基）          M1 外壳·令牌·路由 ──┐
                        M2 天空模型·数据窗口 ┴─▶ M3 fig 卡·拨轮·护照抽屉
                                                    │
波次 2（两条线并行）    展示线：M4 今日仪器 fig.1 ─▶ M5 今日阅读层        ◀ 里程碑 A：作品集可演示
                        深度线：M6 四柱 fig.2 ─▶ M7 本命盘 fig.3 ─▶ M8 紫微键盘 fig.4 + 大运 fig.5   ◀ 里程碑 B：命盘深度可读
                                                    │
波次 3（补齐，可并行）  M9 出生信息卡带   M10 合盘 fig.6   M11 手记   M12 分享卡
                                                    │
波次 4（上线）          M13 性能与门禁 ─▶ M14 真机签署·转正·退役旧版
```

- **关键路径**：M0 → M1 → M3 → M4 → M5 → M13 → M14。
- 展示和深度是你定下的两个首要目标，所以排在同一波次。M3 完成后，两条线分别在各自的 worktree 会话里并行推进，改动的文件不重叠。
- C 内容整改不依赖新界面。它修的是引擎文案，现版页面马上受益，新版页面也直接用上。

## 通用完成标准（每个模块都要满足）

1. `npm run build` 通过，包括 prebuild 里的 `lint:i18n`、`css:check`、`header:check` 和 `data:check`。
2. 相关的 vitest 新增或更新并通过。全站 vitest 按失败用例**名称**与开工时 main 的结果对比，不新增失败。
3. 开关关闭时，现版行为完全不变；开关打开时，新版可用。
4. 中英文成对（`data-en` / `data-zh`）。不新增 `!important`，不新增独立的 rAF 循环（只允许拨轮动画和上弦），不引入任何库。
5. PR 附上 390px 和 1280px 截图，日夜两种主题各一张。
6. 如实写明哪些没验证，例如真机、读屏软件、Safari。

---

## 波次 0

### M0 · 现版快修、开关与文档对齐（S，Sonnet · medium）

- **目标**：先修不依赖新设计的问题，并为新设计铺好开关和文档。
- **依赖**：无。
- **改动**：
  - F4：`horoscope.html` 页脚的 STAR TERRACE / 观星台和 `aria-label` 里的 Observatory，统一改为 Astrology for fun / 趣味占星。
  - F5（部分）：英文页不再出现「待开启」，并新增 e2e 断言：英文页 `body.innerText` 在 `lang="zh"` 白名单之外不含中文字符。
  - F7：`<head>` 内联脚本改为保留白名单 hash（`#today #you #two #log #self #relationships #journal`），query 仍然清除。
  - 开关：同一段 head 脚本在清除 query 之前读取 `fx=almanac`，写进 `sessionStorage` 和 `<html data-fx>`；`?fx=off` 关闭。
  - F8：Relations 入口在已有生日时隐藏「Cast your own chart above first」。
  - 文档：`design.md` §1.1 和 §2.2 的 horoscope 行改为「掌上星历仪」人格和 DESIGN.md §4 的令牌；§5 删除 RPG 稀有度、抽卡的表述，并写明不做连签。
- **验收**：
  - e2e 覆盖：直达 `/en/horoscope.html#journal` 落在手记；`?fx=almanac` 刷新后仍为 `data-fx="almanac"`；英文页没有中文 UI 字符串。
  - 站主审过 `design.md` 的 diff。

### C · 内容整改（M，Opus · high；可与 M0 并行，持续到 M5）

- **目标**：前台每一句话都可追溯，并且不越红线。
- **改动**：
  - C1：`horoscopeEngine.js` 健康域文案改为只谈作息、休息、屏幕时间，删除「脾胃」等器官字眼；全库扫描同类句子。
  - C2：`synastry()` 的星座文案按元素生成（火、土、风、水各一套，同元素和相成各一套）。
  - C2b：同元素日主改用「比和 / of one kind」文案，或调整分值，让三条文案分支都能走到。
  - C3：`dailyFortune()` 新增 `headline` 字段（≤32 个英文字符、≤16 个汉字，按关系和语气建库）；分数保留在数据里，但前台不显示。
  - 护照文案库 `src/lib/passportCopy.js`：月相 8 条、节气 24 条、五种日主关系，每条带 `ruleId` 和来源说明。原型中标为 draft 的句子都在这里定稿。
- **验收**：
  - 单测：遍历所有关系和语气的组合，健康文案不含器官词表；星座文案的元素与输入一致；`headline` 长度不超限。
  - `lint:i18n` 通过；站主抽查 20 条。

---

## 波次 1 · 地基

### M1 · 外壳、令牌与路由（M，Opus · high）

- **目标**：落地 DESIGN.md §4 的视觉系统和 §5 的信息架构。完成后是一个只有骨架、四个视图可以切换的新页面。
- **依赖**：M0（开关）。
- **改动**：
  - 新增 `public/styles/horoscope-almanac.css`（或按 M13 的结论放进 Vite 构建）：日夜令牌、五行语义色、字号阶梯、按键、fig 卡外框、桌面双栏和手机单栏，只在 `[data-fx="almanac"]` 下生效。
  - `horoscope.html` 新增设备条和四键按键行，视图容器为 `#today #you #two #log`。
  - `src/horoscope/dailyExperience.js` 的路由改为新 hash，旧 hash 作别名，切换视图时回到页顶。
  - 主题：默认跟随系统，手动切换后记住选择（见待定 D1）。
- **验收**：
  - 320、390、768、1280 四个宽度下没有横向滚动，按键行不遮挡页脚。
  - 一个脚本按 DESIGN.md §4.1 表格核对令牌对比度，结果写进 PR。
  - 四个 hash 和三个旧 hash 都能直达；开关关闭时，现版像素级不变（截图对比）。

### M2 · 天空模型与 ±30 天数据窗口（M，Sonnet · high；可与 M1 并行）

- **目标**：「真相先行」，所有图形、读数和文字共用一个纯函数模型。
- **依赖**：无（只改 lib 和 scripts）。
- **改动**：
  - `scripts/gen-transits-daily.mjs`：保留 `planets`，新增 `window`，内容为墨尔本当日 ±30 天、每天正午七个天体的黄经，保留两位小数（原型实测 3.9 KB）。同步更新 `src/lib/validateDailyTransits.js` 和数据发布校验。
  - 新增 `src/lib/almanacSky.js`：
    - `skyAt(dateISO, {window})` 返回日月黄经、距角、照亮比例、八相名称、月亮星座、逆行标记（由相邻日差值判断）。
    - `termInfo(dateISO)` 返回当前节气、下一节气，以及交节时刻（墨尔本时间）。
    - 日柱复用 `bazi.dayPillar`。
    - 窗口不覆盖所选日期时，日月退回 `astro.js` 本地计算，并标记 `planetsAvailable:false`。
- **验收**（vitest）：
  - 2026-10-22 的窗口值与当前 `transits-daily.json` 七个天体一致（±0.01°）。
  - 2026 年 24 个节气的日期与 `bazi.solarTermDate` 一致。
  - 2026-10-23 输出霜降交节。astronomy-engine 的精确时刻是墨尔本 20:38（北京时间 17:38）；`bazi.js` 的低精度算法得 20:40，允许 ±3 分钟。
  - 金星 2026-10-22 至 24 日标为逆行。
  - 窗口缺失时退回本地计算，并标记 `planetsAvailable:false`。
  - 数据任务在本地 `--now` 模式下跑通。

### M3 · fig 卡、日期拨轮与护照抽屉（M，Opus · medium）

- **目标**：三个所有视图共用的部件。
- **依赖**：M1（令牌和外壳）；拨轮的数值来自 M2。
- **改动**：
  - `src/horoscope/figCard.js`：外框和四角（图号、标题、提示、读数）；窄屏时提示与读数分两行。
  - `src/horoscope/jog.js`：`role=slider`；指针拖动、方向键、PageUp/PageDown、Home 都能操作；指数跟随与吸附；`aria-valuetext`；`aria-live` 只播报相位或节气变化。
  - `src/lib/passport.js`：条目 schema `{title, sub, entries:[{k,v}|{reason}]}`，纯数据，不碰 DOM。
  - `src/horoscope/passportDrawer.js`：全页唯一的抽屉，焦点移入、Escape 关闭并归还焦点、遮罩可点；手机端在底部，桌面端在右侧。
- **验收**：
  - 抽屉的 e2e：打开、Tab 循环、Escape 关闭后焦点回到触发元素。
  - 拨轮的键盘 e2e。
  - 开启「减少动态效果」时没有过渡和跟随。

---

## 波次 2 · 展示线（里程碑 A）

### M4 · 今日仪器 fig.1（L，Opus · high）

- **目标**：作品集级的主视觉，也是本页「唯一的活物」。
- **依赖**：M2、M3。
- **改动**：
  - `src/horoscope/figSky.js`：黄道外圈、七条轨道、天体小珠、逆行标记 ℞、按真实明暗交界线画的月相盘（南北半球朝向见待定 D2）；只点亮月亮。
  - 上弦动效：首帧先渲染今天，之后只有表盘从上次访问日转到今天；有 1.6s 保底，后台标签页节流时不会卡在昨天（原型实测发现过这个问题）。
  - 构建期用当天的 `transits-daily.json` 预渲染静态 SVG 和日期行（修 F5），JS 加载后接管，文字不替换。
- **验收**：
  - 禁用 JS 时仍显示今天的表盘和日期行；CLS = 0。
  - 表盘读数与 M2 单测值一致。
  - 黄道符号在 iOS 和 Android 不显示成彩色 emoji（使用 U+FE0E，并设置字体回落）。
  - 首屏脚本增量 ≤ 8 KB（gzip）。

### M5 · 今日阅读层（M，Sonnet · medium）

- **目标**：先给结论，再说依据。
- **依赖**：M4、C（`headline` 和护照文案库）。
- **改动**：
  - 日期行（星期、日柱、节气和交节时刻）。
  - 展示字号的 `headline` 加一段导语。
  - 「why · 3 reasons」护照：日柱关系、月相、节气，每条都是事实 → 规则 → 解读 → 来源。
  - 四个生活面向只写语气词；宜忌两栏；抽签和写手记两个按键。
  - 没有生日时显示纯天象版结论，并邀请填写日期。
  - 拨轮拨动时，以上全部内容同步变化。
- **验收**：
  - 前台没有任何分数。
  - 每一句前台文案都能在护照里找到 `ruleId`。
  - 有生日、无生日、时辰未知三种状态各有一张截图。
  - 英文页没有中文 UI 字符串（干支在 `lang="zh"` 里）。

**里程碑 A**：today 视图在 `?fx=almanac` 下完整可用，可以发给站主真机预览，也可以作为作品集演示。

## 波次 2 · 深度线（里程碑 B）

### M6 · 四柱 fig.2（M，Opus · high）

- **目标**：把命盘做成可以拆开的物件。
- **依赖**：M3。
- **改动**：
  - `src/horoscope/figPillars.js`：天干键帽、地支本体、藏干底座三段实体，带五行色标，日主点亮；每个部件都能打开护照（阴阳五行、十神、精度、来源）。
  - 五行计数用文字加细条表示。
  - 时辰未知时，时柱显示为空键帽，并给补填入口。
  - 替换旧的柱卡和五行胶囊。
- **验收**：
  - 用现有 `tests/bazi.test.js` 的金标准样例渲染后，DOM 中的干支与 `computeBazi` 一致。
  - 每个部件可以用键盘到达，`aria-label` 完整，点击热区 ≥44px。

### M7 · 本命盘 fig.3（M，Sonnet · medium）

- **依赖**：M4 的 `figSky` 几何、M6。
- **改动**：
  - `figSky` 加本命模式：太阳、月亮、上升轴；主要相位点亮。
  - 行星层沿用 `astroPlanets.ts` 动态加载，只在用户点「show planets」后才加载。
  - 没有时间或地点时，上升显示「—」，月亮注明是正午近似。
  - 替换旧的 `renderWheel` 和相位网格入口。
- **验收**：样例的读数与 `astro.js` 一致；不点「show planets」时网络面板里没有星历库请求。

### M8 · 紫微键盘 fig.4 与大运序列 fig.5（M，Opus · medium）

- **依赖**：M3、M6。
- **改动**：
  - `figZiwei.js`：4×4 宫位键盘，用方向键在键之间移动（roving tabindex）；中间显示农历、局数和命宫；命宫点亮，身宫标点；时辰未知时整块变灰并说明原因。
  - `figLuck.js`：8 格步进器，当前一格点亮并显示年内进度；没有性别时说明大运方向需要性别。
  - 替换 `zw-wrap`、`zwd-wrap`、`dy-wrap`。
- **验收**：样例渲染结果与 `computeZiwei`、`computeDayun` 一致；键盘能遍历 12 宫。

**里程碑 B**：you 视图完整可用。

---

## 波次 3 · 补齐（可并行）

### M9 · 出生信息「装载卡带」（M，Sonnet · medium）

- **依赖**：M1、M3。
- **改动**：
  - 分三步：日期 → 时间精度（exact / 时段 / 不知道）→ 城市。
  - 计算假设收成一行可展开的说明；表单错误用 `aria-live` 播报（站点审查的无障碍缺口）。
  - 复用 `formDetails.js` 和 `PROFILE_KEY`，不迁移数据。
- **验收**：已存的资料能正确恢复；手机软键盘弹出时主按钮仍然可见；所有错误路径都有 e2e。

### M10 · 合盘 fig.6（M，Opus · medium）

- **依赖**：M3、M7、C（C2 和 C2b）、R0；R3 完成后改为消费 R 线的报告契约，不再直接调用 `synastry()`。
- **改动**：
  - 已存的人以卡带列表显示（`BOOK_KEY`）。
  - 双盘咬合图，跨盘相位里点亮最紧的一个。
  - 「what draws you together」和「worth watching」每节最多 3 条。
  - 合成分数、今日双人天象、7 天日历移进护照，或改成步进行；ICS 导出保留。
- **验收**：前台没有合成分数；时辰未知的一方，月亮标为估算；C2 和 C2b 修正后的文案正确显示。

### M11 · 手记（S，Sonnet · medium）

- **依赖**：M1、M3。
- **改动**：
  - 月历网格：今天用 1px 强调色线，有记录的日子打点，周末底色低一个色阶。
  - 抽签放进护照，当天固定。
  - 导出和删除沿用 `dailyJournal.js` 与 `clearHoroscopeStorage`。
- **验收**：升级前写的手记照常显示；删除只作用于所选功能；没有连签提示。

### M12 · 分享卡（S，Sonnet · low）

- **依赖**：M4、M5。
- **改动**：`shareFeature` 生成新视觉的 PNG（fig.1、headline、日期）；默认不含出生资料，用户勾选后才加入。
- **验收**：在本地生成；网络面板里没有上传请求。

---

## 引擎线 R · Relationships 后端 v2（依据站主 10-23 提供的 v2 工作包）

工作包是规范，不含算法代码。现状审计、差异表和裁定都在 [`docs/relationships-v2-2026-10-23/`](../relationships-v2-2026-10-23/)：COMPARISON（差异表）和 DECISIONS（Q1–Q10 裁定）。v2 默认在浏览器本地计算，不新增服务端，不引入新库。

### R0 · 排盘与合盘规则校正（M，Opus · high）

> 状态 2026-10-23：代码与单测已在本分支完成（未提交）；本地浏览器已核对中英文与手机宽度。

- **依赖**：无（可与 M0、C 并行）。
- **改动**：
  - Q1：`bazi.js` 年柱按立春交节时刻、月柱按十二节交节时刻判定，交节落在出生时段内时输出不稳定标记。「自我」页同步受益。
  - Q3：`synastry()` 日主关系改为对称的天干关系，补缺改为互为喜用，星座项改用真实太阳黄经并按元素出文案（含 C2、C2b）。
  - Q2、Q4：删除伪随机五项子分，`relationshipScores()` 不再拿 50 兜底。
  - Q5：`dailyPull()` 改为流日三档读法，取消倒计时解锁，`.ics` 取「顺」日。
  - Q8、Q9：紫微命无正曜如实显示；地支矩阵缺时柱时加注。宿曜加「规则未独立核验」标签；shareTip 文案与实际行为一致。
- **验收**：交换 A/B 后 `base` 相同（属性测试）；立春前后的样例单测；合盘区不出现无规则依据的数字；全站 vitest 不新增失败。

### R1 · 契约与纯函数内核（L，Opus · high）

- **依赖**：R0。
- **改动**：按 v2 `contracts/relationships.types.ts`，在 `src/lib/relationships/` 下建运行时 schema、带版本号的 `RelationshipReport`、模块状态（ready/partial/unverified/unsupported/failed），以及 Worker 消息协议，复用 `latestWorkerTask.js`。
- **验收**：内核不碰 DOM、网络、存储或当前时间；同一输入得到同一输出；非法输入有错误码。

### R2 · 时刻、区间与 IANA 时区（M，Opus · high）

- **依赖**：R1。
- **改动**：Q6、Q7：时辰分 exact / range / unknown 三档，增加分钟输入；城市表补 IANA 名，用 `Intl` 换算，覆盖夏令时的重复时刻和不存在时刻。
- **验收**：23:00、00:00、节气、闰月、DST gap/fold 都有样例；时辰未知时上升和宫位不给伪精确值。

### R3 · 六维量表与证据账单（L，Opus · high）

- **依赖**：R1、R2。
- **改动**：v2 REL-070。支持和磨合两个分量，规则族封顶，缺模块时总分为 null，A→B 与 B→A 各一套双向原型。
- **验收**：v2 ACCEPTANCE G2 全部通过。

### R4 · 隐私与存储（M，Sonnet · high）

- **依赖**：R1。
- **改动**：Q10：默认临时保存，主动选择才写入本机；老资料原地兼容。删除时取消在途计算。
- **验收**：拒绝存储时仍能计算；合成哨兵生日不出现在任何请求里。

---

## 波次 4 · 上线

### M13 · 性能与门禁（M，Opus · high）

- **改动**：
  - 关键 CSS 内联 ≤15 KB，其余外链并带哈希（站点审查 A2 和 §8 的目标）。
  - 补全 e2e：四个视图、深链、拨轮键盘、抽屉焦点、无中文断言、减少动态效果、320/390/768/1280 视觉截图（`visual-captures.spec.js`）、axe 扫描。
  - Lighthouse 四项不低于现在的 100/100/100/100。
- **验收**：上面的门禁在 CI 中全绿；HTML 体积比现在（131 KB）下降。

### M14 · 真机签署、转正与退役（S，Sonnet · medium + 站主）

- **改动**：
  - 站主在 iPhone 和 Android 上真机签署：安全区、软键盘、黄道符号字形、拖动手感。
  - 开关默认打开，保留 `?fx=off` 两周后删除旧版标记、`horoscope-paper.css` 中的旧面板样式和旧渲染函数。
  - 运行 `npm run site:generate` 更新 sitemap lastmod；重新生成 `og/horoscope-en.jpg` 和 `og/horoscope-zh.jpg`。
- **验收**：旧版代码删除后构建和全部测试通过；`design.md` §6 的状态行更新。

---

## 待站主决定（不阻塞波次 0–1）

| # | 问题 | 建议 |
| --- | --- | --- |
| D1 | 默认主题 | 跟随系统；没有偏好时用日间「说明书纸」（anatomy 的「light ships」） |
| D2 | 月相朝向 | 按访客时区判断南北半球；无法判断时用墨尔本（全站日期基准），护照里写明 |
| D3 | 连签与隐藏签 | 不做连签和隐藏签池（延续 10 月 11 日「No streaks to keep」）；每日一签保留 |
| D4 | 大运性别 | 作为选填项，不填时说明原因，不猜测 |
| D5 | 馆藏星图图像（taste 建议） | 放到 P3 可选，需逐张核对授权和署名 |

## 风险

| 风险 | 应对 |
| --- | --- |
| head 内联脚本会清掉 query，`?fx=` 读不到 | M0 在清除前读取开关并存进 `sessionStorage` |
| `horoscope.js` 有 1820 行，就地改动风险大 | 新视图写成新模块，按视图挂开关切换，旧渲染函数到 M14 才删 |
| 真机待验收超过 5 项会触发 `design.md` R3 冻结 | 里程碑 A 完成就请站主真机看一次，不要攒到最后 |
| 原型的 draft 文案混进正式版 | 没有 `ruleId` 的句子过不了 C 和 M5 的单测 |
| 后台标签页的 rAF 节流导致动画卡住 | M4 的保底计时器，并加一条 e2e：隐藏页面下保持今天 |

## 会话简报（可直接粘贴）

> **M0**　读 `docs/horoscope-almanac-2026-10-22/ROADMAP.md` 的 M0 和 DESIGN.md §0、§2。在新分支实现 M0：统一页脚与 aria 名称，删除英文页残留的「待开启」并加无中文 e2e，head 脚本保留白名单 hash 并支持 `?fx=almanac`，修 Relations 的过时提示，更新 `design.md` 的 horoscope 行。满足通用完成标准，开 PR。

> **C**　读 ROADMAP 的 C 和 DESIGN.md §9。修 `horoscopeEngine.js` 的 C1、C2、C2b；给 `dailyFortune()` 加 `headline`；新建 `src/lib/passportCopy.js`（月相、节气、日主关系，每条带 ruleId）。为每项加单测。中英文成对。开 PR，列出 20 条样例供站主抽查。

> **M1**　读 DESIGN.md §4、§5 和 ROADMAP 的 M1，参考 `prototype.html` 的 CSS。在 `data-fx="almanac"` 下实现令牌、按键行、设备条、桌面双栏和手机单栏，以及新 hash 路由。开关关闭时现版不变。附四个宽度、日夜两种主题的截图。

> **M2**　读 ROADMAP 的 M2。扩展 `gen-transits-daily.mjs` 输出 ±30 天 window，更新校验；新建纯函数 `src/lib/almanacSky.js`（skyAt、termInfo）。用 ROADMAP 列出的数值写 vitest。不改任何 UI。

> **M3**　读 ROADMAP 的 M3 和 DESIGN.md §4.4、§6.5，参考 `prototype.html` 的 jog 和 passport 实现。做成 `figCard.js`、`jog.js`、`passport.js`、`passportDrawer.js` 四个模块，配齐焦点与键盘的 e2e。

> **M4–M14**　格式相同：先读 ROADMAP 对应模块和 DESIGN.md 对应章节，以原型的同名部分为视觉参考，以模块的验收条目为完成标准，一个模块一个 PR。
