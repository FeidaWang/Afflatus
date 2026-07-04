# Project Afflatus — Release Notes

> 已完成工作的历史归档。roadmap.md 只保留仍需跟踪的未完成工作——完成的条目从那边移除后落在这里，保留原始技术细节（教训、验证方式、范围边界），供未来排查/复用参考，不追加新内容之外的整理。
> 按版本/日期倒序排列（最新在最上面）。

---

## v1.5 · Afflatus「Fable 5 Max 五模块」

### V17c.（S）combat view 遮挡/重叠排布修正（用户看到 V17b 实际效果后的第三轮反馈）— 2026-07-05

按用户截图反馈处理三处布局问题：① 顶部航向刻度带数字上半被画布顶边裁切——`drawSCHeadingTape` 的基准线 `y0` 从 `h*.055` 下移到 `h*.10`，给数字留出完整高度；② 座舱控制台原有左右两块镜像 OUTPUT 5/16 MFD 屏，只保留一块并居中（`mfd()` 只调用一次，位置改为 `w*.5-mw/2`）；③ 该 MFD 屏底部原有的「‹ POWER MANAGEMENT ›」页脚文字与描边框整体删除（连带把屏高从 `h*.20` 收窄到 `h*.155`，去掉页脚腾出的空白）。第四处是目标锁定后 `SHIELD QUAD`（FORE/AFT/PORT/STBD）方格与目标框自带的 `1P/HALLEY`/`720.0 M` 名称·距离标签重叠——根因是方格原来画在目标框右侧、与名称标签同一侧同一高度，方格左边界常常落在标签文字还没画完的位置；改为把方格移到护盾/装甲血条正下方（`gx=cx-bracketS*1.1, gy=cy+bracketS*1.38+30`，与血条左对齐、留 30px 间距），与目标框标签（右上方）在空间上完全分离，不再依赖标签文字宽度这个不可控量。

**验证**：158/158 绿；构建绿；headless mock-ctx 扫描（`drawCockpitFrame` boot×landing×4 种尺寸、`drawSCHeadingTape` 5 个航向边界值、`drawCleanCombatHmd` 4 种模式×4 种尺寸）零运行时错误；源码确认 `mfd(` 调用点仅剩 1 处，构建产物 grep 确认 `POWER MANAGEMENT` 零残留。**视觉未验证**：沙盒无法渲染 canvas，方格新位置是否确实清爽、MFD 单屏居中是否协调需本地硬刷新确认。

---

### V17b.（S）combat view 视觉清理 + SC 准心/航向带（用户看到 V17 实际效果后的第二轮反馈）— 2026-07-05

按用户截图反馈逐项处理：① 仪表台顶部的贝塞尔曲线轮廓+边缘描边读成「波浪形线」——台面剪影改为平直顶边渐变填充，描边整体删除；② 左上 ENG/WPN/SHD 动力三柱删除（`drawPowerPips` 函数与调用一并移除，工厂依赖 `weaponRemaining` 因此成为孤儿也同步从签名与 main.js 实例化处清除）；③ 横穿中屏的遥测下划线删除（改纯文本双标签，`telemetryLine` 原语不动——main.js 其他视图还在用）；④ 两侧 THR/VEL 半圆弧仪表删除；⑤ 准心与航向带按 SC 参考图重做——新 `drawSCReticle`（四向短划会聚+中心点）与 `drawSCHeadingTape`（密集度数刻度、每 20° 数字主刻度、中央上指箭标+当前航向读数，右侧裁切避开 OBJECTIVE 面板），FPM 改为 SC 式括号点标记（去掉圆圈三臂与虚线牵引线）；雷达罩读数从 269° 统一到站点 lore 的 128°（消除同屏两个互相矛盾的航向）。

**验证**：158/158 绿；构建绿；headless mock-ctx 扫描（boot×landing×conic×6 模式×3 尺寸 + 航向 0/5/123/269/358 边界）零运行时错误；dist grep 确认 `ENG WPN SHD` 零残留。视觉观感仍需本地确认。

---

### V17.（M）战机视角 SC 座舱 HUD + TARGET LINK 开机序列（用户直接指定，参考星际公民截图）— 2026-07-05

**需求**：按用户提供的星际公民座舱截图，把 SC 风格 MFD 座舱融入战机视角 combat view；起飞时系统在 TARGET LINK 中一键分阶段启动；彻底删除背景里的三角形舷窗。

**关键发现（本轮最有价值的一条）**：旧「三角舷窗」之所以读成"背景里的鬼影"，根因是**绘制顺序 bug**——`drawPilotHmd` 内部的 `drawPilotSpace` 用 .92-.98 alpha 的近不透明星空**盖在**先画的座舱框架上，座舱只剩 ~5% 残影。删除三角支柱只治标；本轮同时把 standby/combat/launch/landing/topdown 五条分支的绘制顺序全部改为「星空（充当清屏）→ 座舱控制台 → HMD 线条层」，控制台第一次真正以前景形态可见。

**交付**：`drawCockpitFrame` 重写（combatHmdV3.js，保持纯函数）——删除 A-frame 三角支柱/顶梁/舱盖弓；新 SC 控制台：左 PWR/WPN/THR/SHLD/COOL 按钮列（WPN 琥珀高亮）+ 右 RADR/PROX/HIT/MISL、双 MFD 电源管理屏（OUTPUT 5/16、三列分段电源块、OFFLINE/BATTERY、‹POWER MANAGEMENT›页脚）、中央雷达罩（conic 扫描线+光点+269°·2.8KM 读数，无 createConicGradient 时降级为线扫）、仪表台顶读数条。新增 `boot` 参数（0..1）驱动分阶段上电：台缘灯→按钮列逐个→MFD 扫描线暖屏→雷达罩转速爬升→读数条→中屏 PWR BUS/AVIONICS/WPN SAFETIES/SENSOR ARRAY/TARGET LINK 逐行 SYNC→OK→「TARGET LINK ESTABLISHED」加发光闪屏。`drawCleanCombatHmd` 新增 `drawSCChipStacks`（左 SCM/GUN+CPLD/ESP/LOCK+速度/弹药，LOCK 绑定真实锁定状态；右 DECOY 24/NOISE 2+VTOL/GEAR/GSAF；w<340 或 h<250 时整体跳过防糊）；底部遥测条上移到 h*.72（否则被加高的仪表台盖住）。main.js：`cockpitBootT()` 时间线——首次进入 standby/combat 跑完整 2.6s 序列（页面首屏也有开机秀），起飞交接后从 65% 续跑 1.5s 收尾（起飞滑跑过程中控制台已随 elapsed 分阶段点亮），HMD 线条层随 boot 淡入。

**验证**：158/158 测试绿；构建绿，dist grep 指纹确认；**headless 绘制扫描**——Node mock ctx 全参数矩阵调用（boot 0→1 × landing × conic 有无 × 6 种模式 × 2 种尺寸 × 目标有无）零运行时错误。**视觉未验证**：沙盒无法渲染 canvas，控制台布局密度/开机节奏的实际观感需本地确认；绘制顺序修复对 launch/landing 的甲板残影观感也有连带影响（理论上更清晰，请一并看一眼）。水印未包含（本来也不会画参考图里的任何位图内容）。

---

### V13.（M）Arena 美股技术分析仪表盘（用户直接指定需求）— 2026-07-04

**需求来源**：用户直接提出（非既有 roadmap 编号，占用空缺的 V13），把 arena.html 改造为个人日常盘前/盘后浏览用的美股技术分析面板；原 Human vs AI 对战区**暂时隐藏**（源码全保留，`.legacy-hidden{display:none}`，移除该 class 即可恢复）。

**交付**：`src/lib/technicals.js`（纯函数指标库：MA5/10/20/60/200 快照含斜率与价上/价下、经典枢轴点 PP/R1-3/S1-3、分形摆动高低点支撑阻力（1.2% 聚类+触碰计数）、心理整数关口（分档大/小刻度，必含最近整百整五十）、缺口检测（未回补/部分/已回补三态）、20 根箱体放量突破检测（守住/失守状态）、`normalizeDaily` 剔除盘中未完成日K、`analyzeTicker` 总装）+ `tests/technicals.test.js`（21 条）+ `src/pages/arenaTech.js`（渲染层：自选股条（复用 `arena-universe.json` 30 只，按 bucket 着色）、搜索（列表模糊匹配+回车加载任意代码）、盘前 PRE（最近完整日K算下一交易日计划位）/盘后 POST（前一日计划位复盘最近交易日实际触碰）双视图（按美东时间自动默认）、垂直价格标尺 Level Ladder（全部关键位画上同一价格轴，支撑+整数关口带绿色 LIMIT ZONE 限价参考标记，缺口画色带，POST 模式叠加日高/日低标记，标签防碰撞双列错位）、四张卡（关键价位/均线/枢轴点/历史特殊点位）各带可折叠算法说明）+ arena.html 新增 `#taDash` 区块与全部配套 CSS。数据全真实：`/api/history` 日线 250 根（localStorage 按日缓存）+ `/api/quote` 实时价，无任何模拟数据。旧 arena.js 在检测到 `.grid.legacy-hidden` 时把报价轮询降频到 120s（隐藏 UI 不烧 Finnhub 配额）。

**验证**：`npm run test` 144/144 绿（新增 21 条）；`npm run build` 绿；`vite preview` 7 页 + `arena-universe.json` curl 200；dist 产物 grep 确认 `LEVEL LADDER`/`限价参考区`/`arena-universe.json` 指纹全部进 chunk；**另做了一次真实数据端到端验证**——抓取线上 `/api/history` 的真实 NVDA 日线，走与 arenaTech.js 完全一致的映射管线跑 `analyzeTicker`，逐项断言通过（PP/R1/S1 与手算一致；管线自动识别出 6/23 真实向下跳空缺口 [203.77–207.72] 且正确判定未回补；整数关口 $200 判 major；MA5/10 价下）。**视觉未验证**：标尺/卡片布局在沙盒无法渲染，需本地确认观感。i18n 全覆盖（data-en/zh + data-en-ph 占位符 + 动态 T()）。

**V13 上线后热修：Level Ladder 标签重叠 bug**（用户反馈截图，同日）——用户上线后截图反馈价位标尺（Level Ladder）标签严重重叠遮挡（多处价格数字前后叠印无法辨认、缺口标签压在下方标签上、当前价框直接盖住紧邻下方的标签）。**根因**：原 `renderLadder` 只对右侧标签做了一个基于「高度百分比」的弱双列错位（阈值 3.4%，与真实文字像素尺寸无关），左侧价格数字、缺口标签、当前价标记完全没有防碰撞逻辑，密集时必然互相覆盖。**修复**：新增 `src/lib/ladderLayout.js`（纯函数，不碰 DOM，独立于 `technicals.js` 因为这是排版问题不是指标计算问题）——`declutter1D`（双向单调扫描防重叠算法：保证任意两个标签间距 ≥ minGap，保持原始相对顺序不交叉，绝不压缩标签只会增长容器）+ `fitExtent`（计算需要的额外偏移量/容器高度，避免裁切而不是让标签挤到看不清）。重写 `renderLadder`：所有标签（关键位行、缺口标签、当前价、盘后模式的日高/日低）现在进同一个防重叠池统一避让，而不是各自为政；同时把「真实价格位置」（价位线、色带——永远画在数学上正确的位置）和「标签显示位置」（防重叠后可能挪动的位置）分离，两者差距超过几像素时画一条引导虚线连接（参考真实交易软件价格轴的通用做法）。arena.html 对应 CSS 同步重写以匹配新的 DOM 结构（`.lad-lv` 纯线条 / `.lad-lab` 标签块 / `.lad-leader` 引导线 / `.lad-gaplab`/`.lad-px-line`/`.lad-px`/`.lad-sess-line`/`.lad-sess` 拆分），并移除 `.ta-ladder` 上会跟 JS 显式 `style.height`打架的 `flex:1`。

**验证**：新增 `tests/ladderLayout.test.js`（8 条：已有间距不动、复现截图密集聚集场景断言全部间距达标、保序不交叉、全同值均匀展开、0/1 项边界、`fitExtent` 三种场景）；`npm run test` 152/152 绿；`npm run build` 绿；`vite preview` 7 页 curl 200；dist 产物 grep 确认新 CSS 类名（`lad-leader`/`lad-gaplab`）已进 `arena.html` 且旧类名（`.lad-lv.c1`/`.lad-lv u`/`.lad-lv em`）无残留。**本轮沙盒无网络出口**（`feida.au` DNS 解析失败），无法重复上次的真实 NVDA 数据端到端验证；改用确定性种子生成的合成日线数据（260 根，随机游走）走完整 `analyzeTicker` 管线产出 17 个真实关键位/当前价标签，喂给 `declutter1D`/`fitExtent`，确认零 NaN、任意两标签间距精确 ≥16px、容器高度按需增长——验证的是新防重叠算法与真实指标管线拼接后的整体行为，非声称使用了真实行情。**视觉仍未验证**：沙盒无法截图渲染，标签是否真正不再遮挡需本地打开 arena.html 确认。

---

### V7.（S）Signal 定时任务升级 — 2026-07-04

架构同 V4：Cowork scheduled-tasks，不是 launchd。新建 `public/signal-release-dates-2026.json`（WebSearch+直接抓取核实的 2026 全年 CPI/NFP/PCE/FOMC 发布日历，来源 bls.gov/bea.gov/federalreserve.gov 官方页面，非搜索摘要转述）供任务做 no-op 门禁：命中发布日 → event 模式；否则周五 → weekly 模式；否则跳过不跑（多数日子应该什么都不做，这是预期行为不是 bug）。新增 `src/lib/validateSignalEvents.js`（v2 schema 纯校验函数，12 条 vitest 覆盖：真实 fixture 通过、分数越界/pillar 数量或 tone 非法/事件 id 重复/双语字段缺失/version 错误等全部拒绝）+ `scripts/validate-signal-events.mjs`（CLI 发布门禁——任务必须先跑这个再 commit，非零退出码就中止发布，不留半成品到线上）。**这个校验器是吸取 V6 教训后加的**：V6 手工编辑时曾因未转义引号打断 `JSON.parse`，无人值守的定时任务没有人工审查这一步，必须靠代码把关。调度任务 `signal-warsh-daily`（cron `0 7 * * 2-6`，AEST 07:00 周二至周六，映射 ET 周一至周五 17:00 收盘后 1 小时，与 V4 的 AEST↔ET 错位规律一致）已创建，提示词自含 STEP 0-5（判定模式→读取上下文→WebSearch→按 schema 撰写→跑校验器→仅校验通过才 git add/commit/push，且只碰 `signal-events.json` 一个文件）。

**验证**：`npm run test` 123/123 绿（新增 `validateSignalEvents.test.js` 12 条）；`npm run build` 绿；`vite preview` 7 页 + `signal-events.json` + `signal-release-dates-2026.json` 全部 curl 200；校验器 CLI 对真实文件（OK）与故意损坏的文件（FAIL，exit 1）都做过烟测。**首次真实触发**（本周二 AEST，映射 ET 周一）尚未发生，非发布日也非周五，预期是一次干净的 no-op——建议观察前几次运行日志确认门禁逻辑按预期工作。

---

### V6.（M）Signal「Warsh 时代」内容重构 — 2026-07-04

`signal-events.json` 从 v1 裸数组迁移到 v2 对象结构（`hawkDoveCompass`/`pillarSummary`/`pillars`/`events`，事件仍用具名 `before/print/repricing/equityReaction` 四字段，未采用 prompt 草稿的 `record_zh/en` 数组写法——保留已验证过的渲染结构，`prompts/signal-warsh.md` 已同步更新对齐）；`signal.html` 新增鹰鸽罗盘区块（`-2..+2` 打分，v1.3/HAWKISH，人工打分，方法说明已注明自动化留给 V7）+ 五维信号矩阵网格（5 张 pillar 卡，通胀/货币政策/财报指引/产业科技/地缘贸易，各带 tone 红/琥珀/绿）+「PERSONNEL FILE — SITE DIRECTOR」人事档案卡（Warsh 7/1 ECB 论坛首秀原话，WebSearch 核实）；对应 CSS（`.compass`/`.pillars`/`.pillarGrid`/`.pillar`/`.gauge`/`.needle` 等）已按站内 SCP 琥珀/纸色调补齐。

**修复一处真实 bug**：`signal-events.json` 的 `rationale_zh` 里混入了未转义的直引号导致 JSON 语法错误（`vite preview` 起服务后 curl 该文件才发现），已改为站内统一的「」引号约定并重新验证 `JSON.parse` 通过——V7 的校验器正是吸取这次教训后补上的门禁。

**验证**：`npm run test` 111/111 绿（本轮无逻辑改动，纯内容/前端）；`npm run build` 绿；`vite preview` 7 页 + `signal-events.json` 全部 curl 200；解析后核对字段（`version:2`/`pillars:5`/`events:3`/`hawkDoveCompass.score:1.3`）。**视觉未验证**：罗盘指针定位与 pillar 网格排布的实际观感在沙盒无法渲染截图，样式逻辑已对齐现有 SCP 视觉语言但需本地确认。

---

### V4.（M）Arena 双模型定时任务（v1 切片：Model A 开盘窗）— 2026-07-04

**实施路线偏离文档原计划**：查证 arena-news/games/leagues 三个既有自动化后发现全部走 Cowork scheduled-tasks，不是文档写的 launchd + 外部 API key 方案（那条路径从未真正建过）——V4 照抄已验证的模式。行情走 Cowork 任务实时 fetch 线上 `https://feida.au/api/quote?symbol=X`（已探测确认可用，Finnhub key 已在 Vercel 服务端配置，任务本身不接触任何密钥）。

新增 `src/lib/arenaRun.js`（`runArenaLedger`，纯函数，对 `arenaRules.js` 做单次运行编排：mark-to-market→止损扫仓→逐单校验/撮合→熔断判定→赛季重置判定→复盘文案更新，14 条 vitest 覆盖同日多次运行/跨日/熔断/止损/Model B 星期二四门禁/赛季重置/纯函数不变性等场景）+ `scripts/apply-arena-run.mjs`（CLI 结算脚本，调度任务只产出提案 JSON，这个脚本调用 `arenaRun.js` 真正校验+落盘，任务本身不允许手改 `arena-ledger.json`）+ `public/nyse-holidays-2026.json`（已 WebSearch 核实 2026 全年 10 个休市日，任务运行前先查表 no-op）。`arena-ledger.json` 补充迁移字段 `lastRunDate`/`dayStartEquity`（两本账本各一份，日内多次运行与熔断判定的记账基准）。

首个调度任务 `arena-autopilot-a-open`（AEST 00:30，对应 ET 开盘窗，cron `30 0 * * 2-6`，其余 3 个任务——尾盘窗/Model B 盘后/周度复盘——待这个跑几天验证稳定后再补）已创建——**调度工具的人类可读描述显示"only on Tuesday"，但底层 `cronExpression` 字段确认存的是完整的 `2-6`（周二至周六 AEST）**，这处描述文本的准确性还未跨两次以上运行验证过。提示词 `prompts/arena-autopilot.md`（已就绪，任务运行时直接读取，不复制内容，改动自动生效）。调度、数据获取与 key 管理见 **§7.5**——launchd 段落已过时（未采用），保留仅供历史对照。

**验证**：`npm run test` 111/111 绿（新增 `arenaRun.test.js` 14 条）；`npm run build` 绿；`vite preview` 7 页 curl 200；CLI 脚本对真实 `public/arena-ledger.json` 做过一次实测调用（备份→跑→核对输出→还原），确认端到端读写路径正确。**未验证**：调度任务首次真实运行的完整行为（WebSearch 新闻质量、`/api/quote` 30 个标的连续 fetch 的实际耗时/稳定性、任务自己写的提案 JSON 格式是否总能匹配脚本预期）——这些只能等它真跑一次才知道，建议观察第一次运行的 commit 记录与 `arena-ledger.json` 差异。**V5（前端展示）已排入 roadmap.md，待账本积累 ≥3 个交易日数据后动工。**

---

### V8.（S）v1.5 发布收尾 — 2026-07-04

版本号 `1.4.0` → `1.5.0`（`package.json` 顶层 + `package-lock.json` 两处 version 字段 + `index.html` 首页 `.brand-version` 显示）。全站用户可见文案「Fable 5」→「Fable 5 Max」：`games.html`（meta description/og:description/kicker/brief，含大写 `FABLE 5` 变体）、`arena.html`（`data-en`/`data-zh` 品牌行）、`signal.html`（meta description + 小标题）、`public/games-data.json`（预测研判正文）；顺带同步了 `src/pages/arena.js`/`games.js` 顶部文档注释里的旧称呼（非用户可见，但保持内部文档与实际品牌一致）。`leagues.html`/`leagues-data.json` 因为是 7/4 当天新建，创建时就已直接用「Fable 5 Max」，无需改动。**改名纪律**：只动用户可见文案（HTML 文本节点、`data-en`/`data-zh`、模板字符串渲染内容、JSON 里会被渲染出来的正文字段），不动 JSON 键名/JS 属性名/CSS class；改完后做了大小写不敏感全库 re-grep（`(?i)fable 5(?! max)`）确认零残留，另外确认站内没有裸「Fable」简称需要处理。

ROADMAP 归档收尾：P0/P1 里已完成的 V0/V1/V3/V16/V14/V15/V15b/V15c 详细记录移入本文件（见下），`roadmap.md` 只保留仍在跟踪的条目；「视觉轨」整条已全部完成，从 P1 移除；未完成的收尾项（V14 的 `impactOrbit`/FOV/空间深度四件套、V15 的贴花与 InstancedMesh 优化）转成 P3 新条目，不随旧版块一起丢失。

**验证**：`npm run test` 全绿；`npm run build` 绿，7 页 curl 200；`grep` 确认版本号与品牌名改动均落进对应产物。纯文本/JSON/版本号改动，无几何/渲染逻辑变化，风险极低，不需要视觉验证。

---

### V15 Odin 参考全息舰重建 + V15b 战机保真度 + V15c 参考细节补全

**目标**：按用户提供的 Blender 参考截图，重建 `shipHologram.js`（登录页全息投影）与 `capitalShip3D.js`（首页 Labs 场景主战舰）共用的舰体几何，从早期战斗机式样的有翼楔形体，换成细长无翼的 Odin 级战列巡洋舰剪影；`nighthawk.js` 同期做战机材质细节增强。

**V15 v1 切片（2026-07-04）**：新增 `src/scene/odinHull.js`——**DOM/WebGL 完全无关的纯函数**（`createOdinHull(THREE,{add,mats,detail})`），只调用调用方注入的 `add(geo,mat,t,r,s)`，因此 `capitalShip3D.js`（全 PBR 实体网格）与 `shipHologram.js`（网格+描边线框）可以喂同一份几何描述、各自渲染风格——精确对应最初规格"同一几何体喂 capitalShip3D 的侧视/尾视，一份资产两处用"。刀锋艏（占全长 37%）+ 舯部阶梯上层建筑/舰桥塔/4 根天线桅杆簇 + 背脊炮塔 row(5)+腹部吊舱(2)+尾部 7 联推进簇+外伸散热鳍桁架，greeble 密度尾>舯>艏。移除了旧设计的机翼（Odin 参考本就是无翼细长战舰剪影，不是战斗机式样）。

**风险门禁**：这是替换主战舰几何的高风险改动，沙盒完全无法渲染验证（`npm install puppeteer` 因沙盒网络白名单不含 `storage.googleapis.com` 下载 Chromium 失败，`EAI_AGAIN`，确认为沙盒硬限制）。因此默认行为（不带 `?ship=odin`）逻辑审查确认与改动前字节级相同，新舰体仅在显式加 URL 参数 `?ship=odin` 时生效。

**可验证/验证不到的部分**：`odinHull.js` 因为不碰 DOM/WebGL，是这批 3D 视觉工作里唯一能在沙盒里真正跑起来验证的一层——`tests/odinHull.test.js` 用 mock `add()` 记录所有 mesh 并算真实 `THREE.Box3`，断言长高比、刀锋艏占比、挂载点数量、`wire`/`full` 差异、无 NaN/Infinity。验证不到材质配色是否耐看、比例是否符合参考图的实际观感、镜头取景是否合适。

**已知简化（未做，见 P3 新条目）**：旧舰体贴花（"TC CONDOR"/"01"/危险警示条）未在新舰体重新定位；greeble 未走 InstancedMesh 单 draw call 优化，沿用现有代码库的逐个 box 循环方式。

**V15b 已交付**：`src/scene/nighthawk.js`——`heightToNormalMap()` 把原本的灰度 bumpMap 近似换成真正的切线空间法线贴图（Sobel 梯度编码），分辨率 256→384；新增腹部/侧甲板 greeble（+14/+10 处）+ 背部 greeble 22→34。全程零几何/轮廓改动，风险远低于 V15 的舰体重建。

**验证**：`npm run test` 90/90 绿（新增 odinHull 8 条）；`npm run build` 绿；`grep` 确认 `ship=odin`/`createOdinHull`/`heightToNormalMap` 都在对应产物 chunk 里；`vite preview` 7 页 curl 200。

**2026-07-04 二次修复（用户截图发现，沙盒不可见类 bug 的又一实例）**：用户本地打开 `?ship=odin` 截图两次反馈"完全不像参考图，看起来是方块状的"。逐行核对 `THREE.ConeGeometry` 的旋转/缩放组合后，用 Node 直接算 `Box3` 实测确认舰艏锥体的真实世界坐标包围盒是 ~2.1×2.1×2.1（近似立方体），不是预期的 3.7 长 / 扁平薄的刀锋——根因：THREE 的 scale 在 rotation **之前**作用于局部坐标系，`rotation.x=PI/2` 把局部 Y（锥体的 height 参数）映射到世界 Z 轴，旧代码却对局部 Y 做"压扁"缩放，实际上是在压缩长度而不是压扁厚度，又叠加了一个多余的 45° Z 轴旋转把三个轴的包围盒进一步搅乱成接近立方体。修复：锥体改用 `rotation=[PI/2,0,0]`（去掉多余的 45° 项）+ `scale=[0.9,1,0.22]`（缩放局部 Z 而不是局部 Y），Node 实测确认包围盒变为 X1.8×Y0.44×Z3.7——长、扁、窄，符合刀锋艏的设计意图。顺带修了尾部推进器挂载点 Y 坐标越出机身尾段包围盒的问题（7 个挂载点里若干个会露出机身外形成"漂浮方块"），并给 `'wire'`（全息投影）细节级别单独砍掉炮塔 row/腹部吊舱/3 根天线（只留 1 根）以减少线框视觉噪音。新增 3 条针对性回归测试，单测总数 90→93。**教训**：`THREE.Object3D` 的 scale-before-rotation 组合规律不直观，凭直觉写变换容易在"看起来应该对"但实际不对的情况下漏掉；后续任何用 `rotation`+`scale` 组合做"压扁/拉伸"效果的新增几何，都应该单独对该部件的世界坐标包围盒做断言，而不只测整艘船的总包围盒。

**2026-07-04 三次修复（架构级：改用连续 loft 船体）**：修好锥体比例后用户反馈"怎么能做的更好看一点而不是画的和积木玩具一样都是线条完全没有细节"——不是数值 bug，是架构问题：船体一直是三个独立图元（锥体艏 + 舯部 box + 尾部 box）拼接而成，中间没有共享表面，无论比例多准，拼接处的可见接缝都会读成"一堆方块堆在一起"。修复：新增 `buildHullLoftGeometry(THREE, stations)`——按"站位"（每站一个菱形截面：半宽/半高）手写 `BufferGeometry`，相邻站位用四边形连接成连续蒙皮，艏部收敛到近似零截面的尖点，尾部用扇形面片封口。用 Node 实测验证了三角形绕线方向（法线朝外）——采样每个非轴向顶点的法线径向点积全部为正；尾部封口环的平均法线 Z 分量为负（朝后/朝外）。船体的三个独立图元全部移除，替换成这一个连续 loft；炮塔/桅杆/吊舱/散热鳍/推进器舱等全部保留作为挂载在这个连续壳体上的独立配件。顺带修正"越改越空"的问题：上一轮为减少全息线框视觉噪音，把 `'wire'` 细节级别里的炮塔 row、3 根天线、腹部吊舱、精细面板缝全部砍掉了，但船体形状的根本 bug 修好之后用户反馈从"太乱"变成"太空/没细节"——恢复它们到 `'wire'`，只把真随机的精细 greeble 散布密度调到 40%（而非直接砍掉）。区分"结构性配件"（该留）和"随机散布细节"（密度可调）是这轮的关键判断。单测 93→94。**仍未解决**：连续 loft 的绕线/法线方向已 Node 实测校验，几何比例也有测试覆盖，但"好不好看"本质上需要真人在浏览器里看一眼，光靠数值断言无法穷尽。

**2026-07-04 四次追加（V15c，按参考图文字拆解补细节，非 bug 修复）**：用户给了一段针对参考战舰的详细文字拆解，按 5 类分列（① 侵略性船体几何/剪影——刀锋艏、斜面装甲、层叠式船体结构；② 表面细节/规模感——面板缝/舱口 + 舯部两侧一排重复的"模块化舱段"（导弹发射井/机库/护盾发生器观感，明确标注是建立旗舰规模感的"视觉锚点"）；③ 功能性上层建筑——阶梯指挥塔+纤细天线阵；④ 武器布置——背脊多联装重炮 row + 腹部与两侧点防御武器；⑤ 推进——多喷口推进簇 + 装甲整流罩+稳定鳍）。逐条比对确认 5 处明确缺口并补上：艏-舯衔接处加两层交叠装甲收环板（层叠装甲视觉断点）；舯部两侧新增 8 个模块化舱段 `sideBayMounts`（每侧 4 个，凸边框+内凹面板+双指示灯）；两侧新增 4 个点防御炮塔 `lateralTurretMounts`（每侧 2 个）；背脊 5 座炮塔全部改双联装；7 个推进器各加一圈装甲整流罩 `TorusGeometry`。新增 4 条测试（挂载点数量、左右镜像对称性、X 方向包含在散热鳍既有挂载范围内、`'wire'` 同样保留新配件）。单测 94→97。**仍未解决**：这轮补充是纯几何数值+挂载逻辑层面的比对与实现，依旧不是视觉渲染验证——沙盒无法打开浏览器看实际观感，新舱段/炮塔的比例、间距、材质在真实光照下是否真的读成"模块化舱段"而非又一堆随机方块，需要真人看一眼。commit `cd5cca1`。

---

### V16.（M）武器单时钟同步（CIWS/导弹/核弹/主炮）— 2026-07-04

**视觉轨第一步而非收尾**：V14 的镜头切换全部由它的事件驱动，先立权威时间线、镜头系统才有东西可订阅，反序会造成返工。

**新增基础设施**：`src/combat/weaponClock.js`——纯函数权威时间线模块（`startTimeline`/`phaseFraction`/`activePhase`/`msUntilPhase`/`forceAdvance` 等），`{weapon, t0, phases:[{name,at}]}` 结构，V14 的镜头状态机可直接订阅。`tests/weaponClock.test.js`（20 条）含"两个消费者读同一时间线在同一 `t` 下必须逐帧零差异"断言（浏览器 rAF 循环沙盒内无法真实驱动，用纯函数等价性断言代替）。

**实测审计发现，逐一修正**：`main.js` 的核弹 T- 倒计时（`#nukeWarning`）与主炮蓄力倒计时（`weaponWarning`）此前各自跑一个独立 `setInterval(...,40)` 轮询——与 rAF 主循环完全脱钩的第二时钟，已删除，改为在既有的逐帧函数 `updateCombatModule()` 里更新。`halley.ciwsLaserStart/ciwsLaserUntil` 审计确认是从未被读取的死代码（`performance.now()` 口径且与其余 `Date.now()` 口径不一致）——已删除。

**审计确认无需改动**：导弹/核弹分镜（`combatCine.js`）与 `halley.destroyed` 提前触发的强制剪切，本来就已经是从 `pilotView.started/until` 派生的单一 `e` 驱动——审计后确认这部分不是本次要修的 bug，未改动。

**范围边界**：未把 CIWS/核弹/导弹的完整分镜时序重构成 `weaponClock` 的具名 phases（留给 V14，届时相机导演系统本来就需要把这些时序表达成具名 phases）。

**验证**：`npm run test` 64/64 绿（含新增 20 条）；`npm run build` 绿，7 页 curl 200，产物 JS 语法校验通过；`grep` 确认无残留的 `ciwsLaserStart`/`ticker`/`chargeTicker` 悬空引用。`main.js` 属逻辑审查+静态验证，视觉效果未做真人验证。

---

### V14.（L）相机导演系统 — 2026-07-04（v1 切片，opt-in `?combatcam=director`）

镜头状态机 + 首发镜头库（导弹尾随/CIWS 炮塔位/主炮轴线/舰桥建立镜头）。**实施路线修正：复用 topdownCombat 现成场景资产**（舰船/导弹/彗星/爆炸全都建好了），废弃的只是固定俯视机位、不是场景本身。

**已交付**：`src/combat/cameraMath.js`（纯函数：`smoothDamp` 临界阻尼弹簧、`shouldPreempt` 优先级抢占规则、`blendFactor`/`easeBlend` 混合曲线，12 条单测）；`src/combat/weaponCameraDirector.js`（镜头状态机：`requestShot(id, {durationMs, blendInMs, refresh})`，抢占＝高优先级立即切入/同低优先级等当前镜头到期，`refresh:true` 支持 CIWS 这类高频事件"续期不重启"，6 条单测覆盖抢占/续期/自动回落/数值不发散）；`topdownCombat.js` 内部重构为委托 `weaponCameraDirector` 驱动相机，默认行为（无 flag）字节级不变——保留原有硬编码摇摄作为 `tacticalTopdown` 待机镜头。

**镜头库（v1 切片，4/5）**：`tacticalTopdown`（待机/巡航，即原摇摄，优先级 1）、`bridgeWide`（开场建立镜头，一次性 3.2s）、`mainGunAxis`（主炮轴线，优先级 3，随 `launchOrb()` 触发）、`missileTail`（导弹尾随，优先级 4，随 `launchMissile()` 触发）、`ciwsTurret`（CIWS 炮塔位，优先级 2，随 CIWS 随机开火触发、`refresh:true` 续期不重启）。

**范围边界（未做，见 P3 新条目）**：`impactOrbit`（末段撞击环绕）未实现；FOV 动态推拉/banking 侧倾细节未实现；「空间深度四件套」（实例化尾焰彩带/运动模糊粒子/近景尘埃视差层/动态 FOV）完全未动。

**验证**：`npm run test` 82/82 绿（新增 cameraMath 12 条 + weaponCameraDirector 6 条）；`npm run build` 绿，`grep` 确认 `combatcam`/`tacticalTopdown`/`bridgeWide` 内容已进入构建产物；`vite preview` + 7 个入口 curl 200。默认路径逻辑审查确认与改动前字节级相同；`?combatcam=director` 分支的镜头切换实际观感未做真人验证。

---

## v1.5「MSI 2026 Leagues」

### V0.（M）Leagues 页面 v1 — 2026-07-04

`leagues.html` + `src/pages/leaguesEntry.js` + `src/pages/leagues.js` + `public/leagues-data.json` + vite 多入口注册 + `nav.js` SITE 数组插入（games 与 novels 之间）+ `page-turn.css` 的 `.leagues-page` 主题变量块（海克斯金 `#c8aa6e` / 蓝 `#0ac8b9`，字体 Cinzel + IBM Plex Mono，与 games 品红/青区分）。初始数据为核实过的真实 MSI 2026 Bracket Stage 战况（8 强、双败淘汰、全 Bo5、Fearless Draft）：已完场 HLE 3-0 TSW、G2 3-2 TES（逆转横扫），另 5 组对阵/待定含 BLG vs T1（GG.bet 真实赔率）与总决赛占位。构建已验证：`npm run build` 绿色，`dist/leagues.html` + `dist/assets/leagues-*.js` 抽查确认真实内容在产物内，`vite preview` 全 7 入口 curl 200。

### V1.（S）Leagues 定时任务 — 2026-07-04

**实施路线偏离原计划**：未走 launchd + 本地 API 脚本，改用 Cowork 自带的 `scheduled-tasks`（任务名 `leagues-msi-daily`，每日 23:30 本地时间，提示词内联 `prompts/leagues-msi.md` 的纪律）——原因：这条自动化生命周期短（仅到 7/12）、且强依赖当天联网检索而非纯 API 调用，用 Cowork 会话原生的 WebSearch 能力比现写一个本地脚本更省事。**已知限制**：Cowork 定时任务需要 App 处于打开状态才会触发（关闭时错过的任务会在下次启动时补跑，触发条件是 App 而非系统唤醒）。7/12 决赛后该任务会自动做收官一跑并转 `mode:"archived"`，之后需要手动禁用。

---

## v1.5「Arena Autopilot」

### V3.（M）Arena Autopilot 账本 + 规则引擎 — 2026-07-04

`src/lib/arenaRules.js`（纯函数规则引擎：`validateOrder`/`simulateFill`/`applyFill`/`checkStopLoss`/`checkDailyCircuitBreaker`/`checkSeasonReset`/`resetSeason`/`computeMetrics`，全部无副作用、无 DOM/fetch/Date.now 依赖）+ `public/arena-universe.json`（30 支固定候选池：14 支核心 AI 硬件 + 13 支大盘科技 + SPY/QQQ/SMH 三基准）+ `public/arena-ledger.json`（Model A/B 各 $10,000 初始账本，season 1 day 0，尚无持仓）。**测试地基已落地**：`npm install -D vitest` + `package.json` 加 `test` 脚本，`tests/arenaRules.test.js` 44 条单测覆盖全部硬风控分支（禁做空/固定域/信心门槛/换手率上限/Model B 交易日限制/单仓 20% 上限/持仓数上限/现金缓冲/加权成本/止损/日熔断/赛季重置/指标计算），`npm run test` 全绿；`npm run build` 复核未受影响。

---

*更早的 v1.4 收尾工作历史记录未在本次归档时补全（当时未落文件），此处从 v1.5 起开始维护完整存档。*
