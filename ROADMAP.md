# Project Afflatus — Design & Roadmap / 设计与路线图

> 全站设计建议、未来路线图，以及代码模块整理与优化方法。
> 技术细节与 git 操作教程见 **TECHNICAL.md**。

---

## 0. 状态速览 + 优先级排序 / Status at a glance ★

> 本轮（2026-07-02）逐条核对了本文档与代码库的实际状态：已验证**完全完成**的任务从路线图中移除（不再需要跟踪），**做到一半或未开始**的任务保留并标注 ⚠️，同时发现了 3 项文档未记录的新情况，并按重要程度排序。**2026-07-03 更新：P0/P1/P2 均已完成**（P2 有两处范围缩减/延后，详情见下方对应小节）。剩余未做的工作已重新按优先级分组，见 **§0b**。
>
> **2026-07-04 更新：Afflatus v1.5「Fable 5 Max 五模块」重大功能版规划成立**——§0b 已整体重排为 v1.5 优先级总表（新任务 V 编号，v1.4 遗留 A/B/C 编号并入），模块规格见 **§5c**，定时任务提示词库见 **`prompts/`**。

**P0 · 已全部完成（2026-07-03）**
1. ✅ **HUD 双系统冲突**——判定 `drawCleanCombatHmd` v3（cockpit 座舱 + FPM 飞行路径标记 + 功率柱 + 目标血条 + 前置量 + 边缘威胁箭头）为 combat/standby 默认视图——这是用户最近一次明确列出的太空战 HUD 需求规格（准星前置量/目标状态/自机弧形条/机动矢量/物理化座舱等）唯一完整实现的版本。`drawCombatHudSC`（GIMBAL/GROUP 全息 + SCM/AB 竖直油门条风格）降级为 `?combatview=sc` 时的可选皮肤，代码与素材均保留、未删除。详见 **§4b**。
2. ✅ **4 个孤立遗留 HTML 死文件**——`public/afflatus_blog_homepage_marathon_style.html`、`afflatus_marathon_new_style_homepage.html`、`afflatus_terminal_dos_style.html`、`afflatus_topbar_redesign_responsive.html` 均已确认零引用并删除。
3. ✅ **Vite MPA 多入口改造**——`arena.html`/`sectors.html`/`signal.html`/`games.html`/`novels.html` 已从 `public/` 移到项目根目录，`vite.config.js` 新增 `build.rollupOptions.input` 六个入口（含首页）。构建验证：全部子页在 `dist/` 下产出**独立压缩/精简的 HTML**（如 `signal.html` 46KB→gzip 15.5KB），页面自身引用的经典 `<script src="/x.js">`（`nav.js`/`audio.js`/`clock.js`/`i18n.js`/`transition.js`/`page-turn.js`/各页专属 `.js`）**仍留在 `public/`、作为静态直通文件**——本轮只让 HTML 本身进打包管线（压缩+正确资源注入），尚未把这些经典脚本转成 ES module 参与真正的打包/哈希（下一步见 §6）。`vite dev` 与 `vite preview` 均已起服务器 curl 验证六个入口 + 关键静态资源全部 200。

**P1 · 已全部完成（2026-07-03）**
4. ✅ **main.js 拆分第一步**——新建 `src/ui/combatHmdV3.js`，把 HMD v3 的全部纯绘制逻辑（`drawCockpitFrame`、`drawSCZoomScope`、`drawCleanCombatHmd` 及其 5 个子函数）搬出。main.js **3733 → 3421 行**（−312 行）。有真实战斗状态耦合的部分（`halley`/`warpIntensity`/`shipRecoil`）通过工厂函数注入 getter，沿用 `createCombatRuntime` 等既有模式，main.js 仍是状态的唯一所有者。**范围说明**：这是"第一步"，不是 §2 Phase 3–5 的完整拆分——main.js 仍有 3421 行，样式拆分（Phase 3）、状态/HUD/cursor/nav/boot 职责拆分（Phase 4 剩余部分）、styles.css 拆分（Phase 5）均未开始，留作后续迭代。
5. ✅ **`combatRuntime.getState()` 接口化**——`combatRuntime.js` 新增 `getState()`（fleet HP/ammo/deck/weapon 冷却快照）；另在 main.js 新增 `getBattleSnapshot()`，合并 `combatRuntime.getState()` 与 main.js 自有的 halley/weapons/escorts/killCount/phase（这才是真正阻塞 topdownCombat 的那部分数据，不属于 combatRuntime）。已接入 `topdownCombat.renderOnce(now, snapshot)`：真实击杀事件触发爆炸闪光，`halley.destroyed` 时彗星隐藏且环境射击停止瞄准它。**范围说明**：`topdownCombat` 的飞行路径本身仍是自走时间线，未被真实彗星位置完全替换——那是更大的独立后续工作（§4 Phase 2b 原文档已标注为分离任务）。
6. ✅ **首页 `index.html` 导航接入 `nav.js` SITE**——`.nav-links` 改为 `data-afflatus-nav`（由 nav.js 从 SITE 渲染），修复了之前缺失的 Novels 链接；`.route-arrows` 新增 `data-page-turn` 属性，prev/next 从手写的过期值（games.html/arena.html）修正为正确的循环值（novels.html/arena.html）。用 Node + mock DOM 跑了一遍 nav.js 逻辑验证正确。**范围说明**：首页仍保留自己的双语系统（不读 i18n.js 的 `data-en`/`data-zh`），导航文字保持纯英文，和改动前视觉一致；打通两套 i18n 系统是更大的独立工作，未做。

**P2 · 已全部完成，2 处范围缩减/延后（2026-07-03）**
7. ✅⚠️ **`combatHudSC` 数据绑定精度校验 + SC 图 3–5 优点融入**——数据绑定审计结论：speed/ab/g/kills/lock 均已绑定真实状态（`window.__warpPower`/`__gLoad`、`killCount`、`halley.hover`），heading 之前用独立时间正弦扫描、与其它仪表脱节，已改为读取真实 `window.__navDeg`；alt/vsi/atmo/ladder **审计中确认是死代码**——`combatHudState()` 只在 combat/standby 分支被调用（mode 恒为 'combat'/'standby'），起飞/降落走的是 `drawPilotDeck`+`drawCockpitFrame` 另一条路径，SC 面板从未在 ladder=true 的情况下渲染过。护盾象限网格 + 任务目标面板已按 §4b 原文档建议的更合理路径实现——**加入默认的 HMD v3**（`combatHmdV3.js` 新增 `drawShieldQuadrantGrid`/`drawMissionPanel`，绑定真实 `killCount`/`giantKillCount`/锁定状态），而非修复已降级的可选皮肤。**⚠️ 范围缩减**：机库跑道纵深透视未做——上述审计发现 combatHudSC 的 hangar/atmo 分支当前完全不可达，真要做透视背景意味着把 combatHudSC 也接入起飞/降落渲染路径（HMD v3 那条路径已经用 `drawPilotDeck` 做得很好），是比"数据绑定修复"大得多的独立工作，记为待评估而非硬做。详见 **§4b**。
8. ✅⚠️ **`combatCine` 帧级命中同步 + 镜头切换**——新增基于 `e`（elapsed 分数）边界邻近度的白色 whip-flash 转场：导弹的锁定/点火节点、核弹的三次分镜切换（护航→VLS→末段跟踪→引爆）现在有剪辑感的镜头切换，而非参数静默跨越阈值。真实命中同步从"静默瞬移"改为"一次性衰减闪光"：`halley.destroyed` 提前触发时（动画还没播到预定的 impact/detonation 节点）会有一次 5 帧衰减的定向闪光标记这次强制剪切，而不是画面突然瞬移不带任何视觉提示；沿用 `topdownCombat.js` 已有的击杀边沿检测模式（rising-edge 一次性触发）。**⚠️ 范围缩减**：核弹序列改用真实 Condor/夜鹰模型离屏渲染替代当前 2D 绘制——未做，这需要把 three.js 模型渲染接入 canvas-2D 管线，是比"镜头对齐"大得多的独立特性，留待后续。详见 **§4b**。
9. ✅ **OffscreenCanvas + Worker 化背景星空渲染**——新增 `src/scene/backgroundScene.worker.js`，`backgroundScene.js` 通过 `canvas.transferControlToOffscreen()` + module Worker 特性检测自动切换：支持时星空/warp-tunnel 绘制整体搬进 Worker（主线程每帧只发 pointer x/y + warpIntensity 三个数字），不支持时**完整回退到原主线程 Canvas2D 实现**（原函数体保留在同一文件里，零功能损失）。`resize()`/`draw()`/`width`/`height`/`dpr` 对外接口不变，main.js **零改动**。构建验证：`backgroundScene.worker-*.js` 被 Vite 正确识别为独立 chunk 并打包。**⚠️ 范围说明**：只做了首页星空这一个背景 canvas；combat/雷达/K 线仍在主线程（§6 原文本身也只点名"星空"是性价比最高的第一步）。真实设备下的帧率提升暂未验证（沙盒内 Claude-in-Chrome 无法访问沙盒本地服务器，与本轮其它前端改动的验证限制相同）。详见 **§6**。
10. ✅ **View Transitions API 跨文档过渡**——`public/page-turn.css`（5 个子页共享）与 `src/styles.css`（首页）均新增 `@view-transition{navigation:auto}`，为所有页面开启浏览器原生跨文档淡入淡出。**未替代** `transition.js` 的自定义每页特效（warp/cannon/takeoff/control/cyber 音效+canvas 动画）——那套效果比原生 crossfade 丰富得多，仍是点击/键盘翻页的主效果；新增 `html.vt-suppress` class（`transition.js` 的 `run()` 在实际跳转前打上）+ CSS 规则关闭该 class 存在时的原生 crossfade 动画，避免两套效果叠加。净效果：**未被 `transition.js` 拦截的跳转**（地址栏输入、书签、前进/后退）从"整页刷新白屏一闪"变成原生淡入淡出；被拦截的点击/键盘翻页行为不变。详见 **§6**。

---

## 0b. v1.5 优先级总表 / What's left, by priority ★

> **2026-07-04 整体重排：Afflatus v1.5「Fable 5 Max 五模块」重大功能版**。源头是用户的系统架构规划报告（Arena 双轨模拟盘 / Sectors 中美 AI 对比 / Signal Warsh 时代 / Leagues MSI 竞猜 / 后内存时代选股库），经评审优化后落地——评审结论与完整规格见 **§5c**，定时任务提示词库见 **`prompts/`**。v1.4 遗留的 A/B/C 编号未完成项全部并入下表（保留原编号便于对照）。想接着做时直接说编号（如「做 V0」）。
>
> **排序依据**：时效硬截止 > 依赖顺序 > 价值密度。两个硬截止：**MSI 2026 决赛 7 月 12 日**（大田，Bracket Stage 7/3–7/12，2026-07-04 检索核实）；**世界杯决赛 7 月 19 日**。Leagues 晚一周上线就失去存在意义，故压倒一切列 P0。

**P0 · 抢时效（本周内，硬截止 7/12）**
- **V0. Leagues 页面 v1**——`leagues.html` + `src/pages/leaguesEntry.js` + `public/leagues-data.json` + vite 多入口注册 + `nav.js` SITE 数组插入 `{path:'/leagues.html', group:'labs'}`（games 与 novels 之间；Labs 下拉与翻页循环自动收纳，v1.4 机制零改动）。骨架克隆 games.html 模式（hero/战绩/对阵卡/赔率/免责声明），主题换海克斯金/蓝与 games 品红/青区分。初始数据以当日实际赛果落盘。规格见 **§5c-4**。
- **V1. Leagues 定时任务**——MSI 期间每日一跑（每系列赛后更新剩余场次预测 + 已完场复盘计分），提示词 `prompts/leagues-msi.md`；7/12 决赛后收官一跑，页面转「战绩存档」模式（`mode:'archived'`）。
- **V2. Games 世界杯收官跟进**——淘汰赛对阵确定后补 `games-data.json` 的 `home/away/result`（原 B7 的 Games 部分提前到 P0，决赛 7/19 收官）；「夺冠路径」树状图仍留 B7 不抢时效。

**P1 · v1.5 核心（1–3 周）**
- **V3. Arena Autopilot 账本 + 规则引擎**——`public/arena-ledger.json`（Model A/B 双账本各虚拟 $10,000）+ 模拟撮合（滑点/费用）+ 代码层硬风控（LLM 只提案、规则引擎收单，红线见 §5c-1）。这是 V4/V5 的地基，先行。
- **V4. Arena 双模型定时任务**——Model A 日内双窗口批处理（开盘后 + 尾盘各 1 次）+ Model B 盘后 1 次 + 周六深度复盘 1 次/周；所有任务先过交易日历守卫（周末/NYSE 假日 no-op）；提示词 `prompts/arena-autopilot.md`。调度与 token 预算表见 **§5c-5**。
- **V5. Arena 页 Autopilot 前端区块**——净值双曲线（A vs B）、持仓表、成交/拒单日志、每日复盘卡（中英）；沿用 arena.html 现有视觉，与「Human vs AI」游戏区并列。
- **V6. Signal「Warsh 时代」内容重构**——新主席 SCP 人事档案（O5 更替叙事；Warsh 5/13 参院确认、5/22 白宫宣誓，2026-07-04 检索核实）+ 五维信号矩阵（通胀/货币政策/财报指引/产业动向/地缘贸易）+ 无前瞻指引 ⇒ 数据发布日历权重提升 + 鹰鸽罗盘首版（吸收原 C1 一部分）。规格见 **§5c-3**。
- **V7. Signal 定时任务升级**——事件驱动（CPI/PCE/NFP/FOMC 发布日）+ 每周例行研判，自动生成事件档案草稿（吸收原 C2 一部分）；提示词 `prompts/signal-warsh.md`。
- **V8. v1.5 发布收尾**——版本号 v1.4→v1.5（index.html/package.json/lock）；全站 AI 人设文案「Fable 5」→「Fable 5 Max」（沿用 Opus→Fable 5 规则：只改用户可见文案，内部字段名/JS 属性/CSS class 不动）；ROADMAP 归档收尾。

**P2 · v1.5 扩展（3–6 周）**
- **V9. Sectors 中美 AI 对比矩阵**——4 厂商观察卡（美：Anthropic/OpenAI；中：智谱/阿里）× 映射标的篮子（定性关联标签，不伪造统计相关系数；真算 90 日价格相关性列为 stretch）。规格见 **§5c-2**。
- **V10. Sectors「后内存时代」专题**——三主线（HBM 定价权 / CXL 内存池化 / NAND KV-Cache 分层）+ Top 10 论点卡 + 现有报价管线自动刷新；KRX 双雄（SK Hynix/Samsung）OTC ADR 报价源缺失时降级为纯论点卡。初始候选池 = 用户报告的 10 标的，上线前逐一核实（含 Pure Storage 是否确已更名）。**结构决策：不单开新页，进 Sectors 专题区块**——理由见 §5c-0。
- **V11. sectors-data.json 每周定时任务**——V9+V10 共用一次周跑；提示词 `prompts/sectors-watch.md` + `prompts/postmemory-top10.md`。
- **V12. 数据管线统一**——`scripts/push-arena-news.sh`（已在用）模板化为通用 `push-data.sh <file> <msg>`；所有数据 JSON 顶层统一 `{updated, version}`；前端共享「数据龄」徽标；预测类页面共享战绩组件（命中率 + Brier 分数，Games/Leagues/Signal 通用）；「Sectors 研判与 Arena 预测打通」（原 B7 一部分）并入本项评估。
- **A2. main.js 继续拆分（Phase 3–5）**——v1.4 遗留原样顺延：各页内联 `<style>` 移到 `public/styles/<page>.css`；`state`/`cursor`/`nav`/`boot` 职责拆出；`styles.css` 做 `@layer` 分层。main.js 仍 3421 行、styles.css 仍 7038 行。详见 **§2**。

**P3 · 长线（v1.4 B/C 项顺延，编号不变）**
- **B1. CSS Scroll-Driven Animations**——`animation-timeline: scroll()/view()` 替换 `alphardForge` 的 JS scroll-pin。详见 **§6.2**。
- **B2. topdownCombat 后续**——真实 `halley.curX/curY` 驱动飞行路径；`?combatview=topdown` 转正评估；首页主战斗迁移（Phase 3）；three.js 动态 `import()`（Phase 4）。详见 **§4**。
- **B3. combatHudSC 机库跑道纵深透视**——先记录、不建议单独立项（当前代码路径不可达）。详见 **§4b**。
- **B4. combatCine 核弹真实模型渲染**——Condor/夜鹰模型离屏渲染替代 2D 绘制。详见 **§4b**。
- **B5. 首页背景 canvas 加 IntersectionObserver**——不可见时停渲染。详见 **§2**。
- **B6. 首页 WebGL 收尾**——raw-GL context-restored 完整重建、shader 弱机自适应、渲染器常量统一（需真机 profiling）。详见 **§4c**。
- **B7. 各页零散点子（剩余部分）**——Arena「模型 vs 你」历史胜率曲线 + Twelve Data 接入后 W/M/6M/Y/5Y 徽标转 `REAL`；Games「夺冠路径」树状图。（世界杯数据跟进已提前为 V2；Sectors↔Arena 打通已并入 V12。）详见 **§5**。
- **C1/C2 剩余**——BREACH METER 自动映射、事件回放 ±2h sparkline、FedWatch 概率自动刷新（鹰鸽罗盘与定时任务自动化已被 V6/V7 吸收）。详见 **§5b**。
- **C3. three.js WebGPURenderer + TSL + Bloom/ACES**——不变。详见 **§6.2**。
- **C4. TypeScript 渐进迁移**——不变，随 A2 新模块推进。详见 **§6.2**。
- **C5. Astro 迁移**——触发条件不变（页面 ≥8 或 novels 章节 ≥20）。**⚠️ 注意：Leagues 上线后全站 7 页，逼近阈值**——下次再加新页时先做 Astro 评估再动手。详见 **§6.2 / §5**。

**已完成归档（v1.4 期，保留教训记录）**
- **A1. ✅ 经典脚本转 ES module（2026-07-03）**——9 个文件从 `public/` 移入 `src/lib/`、`src/pages/`。**关键教训**：Vite 8 对同页多个独立 module-script 入口的自动合并/去重不可靠（构建不报错但代码静默消失），必须每页一个显式 `import` 链入口文件。验证细节见 §2/§6。
- **A3. ✅ `viz.js` 公共库抽取（2026-07-03）**——`src/ui/viz.js`：`animateCountUp` + `animateCountUpFromText`，sectors.html/marketDeck.js 复用。详见 §2。

---

## 1. 站点结构与各页身份 / Pages & identities

> **v1.4（2026-07-03）站点结构变化**：顶部导航新增 **Labs** 下拉分组——Games 和 Novels 从顶层链接收进 Labs 下拉菜单（Home/Arena/Sectors/Signal 仍是顶层直链）。**这是往后的常设规则**：任何新增的季节性内容（例如某届赛事限时页）或实验性/非核心玩法页面，一律加进 Labs，不再往顶层导航加新项——顶层只保留长期、核心的身份页。技术上只需在 `src/lib/nav.js` 的 `SITE` 数组给新条目打上 `group:'labs'`，下拉菜单会自动收纳，翻页 prev/next 循环顺序也自动包含新页，不用改渲染逻辑。全站涉及 AI 对手/研判身份的文案已从「Opus 4.8」统一改为「Fable 5」（Arena/Games/Sectors 的 AI 对手与 Signal 的板块研判）；内部数据字段名/JS 属性/CSS class（如 `games-data.json` 的 `opus`/`opusScore`/`opusOrder`）保持不变，纯粹是显示文案层面的更新。

> **v1.5（2026-07-04）规划中**：Arena 增 Autopilot 双模型模拟盘区块（V3–V5）、Sectors 增中美 AI 对比矩阵 +「后内存时代」选股专题（V9–V11）、Signal 就地重构为 Warsh 时代内容（V6–V7）、**Labs 新增 Leagues 页**（MSI 2026 限时竞猜，V0–V1，7/12 决赛硬截止）；全站 AI 人设文案随 V8 升级为「Fable 5 Max」。详见 **§0b / §5c**。

| Page | File | 身份 / Identity | 主题 | 导航位置 |
| --- | --- | --- | --- | --- |
| Home | `index.html` + `src/` | 深空舰长日志 (Three.js) | Orbitron / 钢蓝 HUD | 顶层 |
| Arena | `arena.html` | Human vs AI 交易竞技场（AI 对手：Fable 5）＋ v1.5 Autopilot 双模型模拟盘（规划中，§5c-1） | Marathon · 霓虹绿/青 | 顶层 |
| Sectors | `sectors.html` | AI + 航天个股研判 ＋ v1.5 中美 AI 对比矩阵、「后内存时代」专题（规划中，§5c-2） | 酸性绿 + 故障艺术 | 顶层 |
| Signal | `signal.html` | 美联储观察 = SCP O5 收容档案（板块研判：Fable 5）；v1.5 重构为 Warsh 时代（规划中，§5c-3） | 机密文档 · 琥珀/绿 | 顶层 |
| Games | `games.html` | 世界杯限时竞猜 vs Fable 5 | 赛博朋克 · 品红/青 | **Labs** |
| Leagues | `leagues.html`（**V0 规划中**） | 2026 MSI 电竞竞猜 vs Fable 5 Max（Fearless Draft 分析；赛后转战绩存档，§5c-4） | 海克斯 · 金/蓝（暂定） | **Labs** |
| Novels | `novels.html` | 无限流·种田小说连载《万界种春》 | 复古未来主义 · 铜/青（纯中文，护眼阅读，含夜间/豆沙绿/米黄三种阅读模式、自动翻页、书签、章节速览） | **Labs** |

**原则**：每页保留**独立的字体与美术身份**，但共享一套基础系统，避免重复造轮子。顶层导航只放长期核心页；季节性/实验性内容进 Labs（见上方 v1.4 说明）。

**共享系统 / Shared systems**
- `page-turn.css` — 翻页箭头 + 自托管字体 + 全局按钮点击反馈（每页用 body class 切换箭头配色）+ Labs 下拉菜单结构样式（2026-07-03；2026-07-04 修复被遮挡问题，见下方说明）。
- `src/lib/transition.js` — 进出页动画 + 音效；按目标页选择类型（warp / cannon / takeoff / control / cyber）。
- `src/lib/i18n.js` — 全局中英切换；任何带 `data-en` / `data-zh` 的元素自动翻译；右上角 `.lang-toggle`；切换时派发 `afflatus-lang` 事件供动态页面（arena/games/signal）重渲染。
- `src/lib/nav.js` — 唯一的 `SITE` 数组渲染导航 + 翻页 prev/next + Labs 下拉分组（2026-07-03 新增，`group:'labs'` 标记）；五个非首页（arena/sectors/signal/games/novels）均已接入（2026-07-03 从 `public/lib/` 移到 `src/lib/`，见 §0b A1）。**2026-07-04**：下拉面板改为 portal 到 `<body>`（`position:fixed`，JS 用 trigger 的 `getBoundingClientRect()` 定位，`z-index:99000`），不再嵌套在 `.nav-labs` 内——之前嵌套时在 games.html 上被 `.top` 的装饰性 `clip-path` 直接裁掉，在首页上又因为 `<nav>` 本身只有 `z-index:100` 而被 `.battle-feed`（910）等 HUD 层盖住，无论内部 z-index 设多高都逃不出祖先节点的裁剪/层叠上限。开关状态因此也从纯 CSS `:hover`/`:focus-within` 改成 JS 驱动的 `.open` class（mouseenter/leave + focus/blur + click + Escape/outside-click/scroll/resize 关闭）。
- `src/lib/clock.js` / `src/lib/audio.js` — 倒计时格式化、Web Audio 环境音共享库（arena/games/signal/transition.js 复用）。
- `src/ui/viz.js` — count-up 动画共享库（sectors.html/marketDeck.js 复用，见 §0b A3）。
- 数据文件：`arena-news.json`（每日定时任务）、`games-data.json`（手动更新）、`signal-events.json`（宏观事件档案，见 §5b）、`novels-data.json`（章节内容）；**v1.5 规划新增**：`arena-ledger.json`（Autopilot 账本，V3）、`leagues-data.json`（MSI 竞猜，V0）、`sectors-data.json`（对比矩阵 + 后内存专题，V11）。
- `scripts/push-arena-news.sh` — cron 数据推送管线（写 JSON → 独立 stash/rebase/commit/push），已在用；V12 模板化为通用 `push-data.sh`。
- `prompts/` — v1.5 各模块定时任务提示词库（system/run 拆分 + JSON 输出 schema），规范见 `prompts/README.md` 与 §5c-6。

---

## 2. 代码整理与优化方法 / Refactor & optimisation method

**现状痛点（部分缓解中）**
- `src/main.js` **3421 行**（2026-07-03 起从 3733 行拆出 combat HUD 绘制模块后）、`src/styles.css` **7038 行**——仍是单体文件，Phase 3–5 完整拆分仍未开始。
- 主线程渲染压力大：星空、combat、雷达、K 线全部在主线程 Canvas 2D 绘制（详细技术方案见 §6）。

**已完成（无需继续跟踪）**
- ✅ 统一导航：`src/lib/nav.js` + `SITE`，**六个页面（含首页）全部接入**，链接/prev-next 由脚本渲染，新增页面只改 `SITE` 一处。首页保留自己的双语系统，导航文字维持英文，视觉与改动前一致。
- ✅ 抽公共库：`clock.js`（arena/games 复用）、`audio.js`（transition.js/signal.html 复用）、`viz.js`（count-up 动画，sectors.html + marketDeck.js 复用，2026-07-03 §0b A3），build 验证通过。
- ✅ 拆 main.js（Phase 4，第一步）：`src/ui/combatHmdV3.js` 已抽出 HMD v3 全部纯绘制函数，main.js −312 行。详见 §0 P1-4。
- ✅ 经典脚本转 ES module（2026-07-03 §0b A1）：`i18n.js`/`lib/{audio,clock,nav}.js`/`page-turn.js`/`transition.js`/`arena-bg.js`/`arena.js`/`games.js` 从 `public/` 移到 `src/lib/`、`src/pages/`，参与 Vite 打包。

**⚠️ 待续 / 未开始**
- **拆样式（Phase 3）**：各页 `<style>` 仍内联，未移到 `public/styles/<page>.css`。
- **拆 main.js（Phase 4，剩余部分）**：只完成了 combat HUD 绘制这一块；`state`（飞行状态机）/`cursor`/`nav`/`boot` 职责拆分仍未开始，main.js 仍有 3421 行。
- **拆 styles.css（Phase 5）**：`@layer` 分层未开始。

**优化清单 / Optimisation checklist（现状）**
- 背景 canvas：`prefers-reduced-motion` 静帧、`visibilitychange` 暂停已做；IntersectionObserver 不可见时停仍待做（§0b B5）。
- API 预算：Finnhub 自适应轮询、Twelve Data 按日缓存已做。
- 资源：`public/*.js`/`public/*.html` 已全部进 Vite 打包（2026-07-03，见 §0b A1 / §6）。

---

## 3. 首页专项 / Home-app pass

**3.1 Combat View 飞行员画面 HUD — ✅ 双系统冲突已解决（2026-07-03）**

此前记录的"皇牌空战式 `#aceHud` overlay"**已被完全移除**（DOM/CSS/JS 均已删除），替换为一套统一的 HMD v3 语言，现在**贯穿起飞/降落/巡航/战斗全阶段**：
- **驾驶舱框架** `drawCockpitFrame`（A 字支柱 + 仪表台，物理化座舱）；
- **SC 式主炮瞄准镜** `drawSCZoomScope`（main-gun 充能阶段）；
- **HMD v3** `drawCleanCombatHmd`（飞行路径标记 FPM、ENG/WPN/SHD 功率柱、目标护盾/装甲血条、前置量指示、边缘威胁箭头）——**现为 combat/standby 的默认视图**（`main.js` `combatViewScPanel()` 判定）。
- `drawCombatHudSC`（GIMBAL/GROUP 全息 + SCM/AB 竖直油门条风格，见 §4b）**保留代码但降级为可选皮肤**，通过 `?combatview=sc` 访问，不再默认显示。

**决策依据**：用户最近一次的详细 HUD 需求规格（准星前置量提示、目标护盾/装甲状态、雷达全向警示、自机状态弧形条、机动矢量标记、分级精确度、物理化座舱）只有 HMD v3 完整覆盖；`combatHudSC` 缺少飞行路径标记、目标血条、前置量指示、威胁边缘箭头。两套系统不再冲突，起降与巡航视觉语言统一。

**已完成、无需继续跟踪**
- ✅ 高精度 F-47 / B-2 程序化模型、夜鹰战机模型（`src/scene/fighter3D.js`、`nighthawk.js`）。
- ✅ 移动端 combat / 星图布局（`@media(max-width:560px)`）。
- ✅ Alphard 跃迁点 · 年化收益镜头（`src/scene/alphardForge.js` + `.stardrive`，滚动渐进拉伸 + 风暴漩涡 + 逐字台词，已接入 `index.html`）。

---

## 4. 战斗系统迁移：2.5D 上帝视角 WebGL / Top-down combat migration ★

> 参考经典 Top-Down View（如 Nexon《破碎银河系》）用 three.js 重建俯视战场，替代 Canvas-2D 伪 3D 观感。

**已完成**
- ✅ Phase 1：`src/scene/topdownCombat.js` 自包含俯视场景（执法者母舰、夜鹰战机、彗星、曳光、激光、等离子光炮、导弹、爆炸 + 战术网格），`?combat=topdown` 全屏预览可用。
- ✅ 战斗真实状态部分绑定：导弹/核弹镜头引爆与页面上彗星真正被摧毁（`halley.destroyed`）帧级对齐；锁定框在 `halley.hover` 时立即变绿。

**⚠️ 待续**
- **Phase 2b — ✅ 接口已完成（2026-07-03），消费仍部分**：`combatRuntime.getState()` + main.js `getBattleSnapshot()` 已实现并接入 `topdownCombat.renderOnce(now, snapshot)`；真实击杀触发爆炸闪光、`halley.destroyed` 时彗星隐藏 + 环境射击停止瞄准。**仍未做**：彗星的飞行路径本身仍是自走时间线（正弦漂移），未被真实 `halley.curX/curY` 屏幕坐标驱动——这是因为俯视场景是独立风格化的 3D 世界，与屏幕 2D 坐标没有直接映射关系，替换飞行路径逻辑是比接口本身更大的独立工作。
- **Phase 2**：`topdownCombat` 接入 `drawPilotFeed` 仍是 **opt-in**（默认关闭，`?combatview=topdown` 开启），尚未评估转正。
- **Phase 3**：首页主战斗（`event-layer`）迁移到同一俯视渲染——未开始。
- **Phase 4**：`topdownCombat` 的 three.js 静态引入改为动态 `import()` 代码分割——未开始，首屏包体仍偏大。

**架构边界**（保持不变，仍是正确的设计原则）：`combatRuntime.js`（状态）→ `topdownCombat.js`（纯渲染）→ `#pilotFeed`。

---

## 4b. Combat View HUD（Star Citizen 风格）/ Combat-view HUD ★

> `src/scene/combatHudSC.js` 的 `drawCombatHudSC(ctx,w,h,now,state)`**已从默认降级为可选皮肤**（2026-07-03，见 §3.1/§0 P0-1）：`?combatview=sc` 时显示，代码与美术保留完好。2026-07-03 数据绑定审计 + SC 图 3–5 优点移植（见 §0 P2-7）已完成，结论见下。

**已实现**：左上战机全息框（GIMBAL/GROUP/GUNS(ALL) + 护盾数值）、顶部 ONLINE 状态条 + 航向带、左右竖直油门条（SCM/AB）、ESP/CPLD 方块 + 红色云台准星、H-FUEL/Q-FUEL、右侧 G 表节点图、DECOY/NOISE、R-ALT/VSI/ATMO、中央俯仰梯（仅 atmo/hangar，`state.ladder`）+ 侧弧 + 准星、琥珀/红告警。

**✅ 数据绑定审计结论（2026-07-03）**
1. speed/ab/g/kills/lock：均绑定真实状态（`window.__warpPower`、`window.__gLoad`、`killCount`、`halley.hover`）——准确。
2. heading：之前是独立于其它仪表的时间正弦扫描，已改为读取 bridge 仪表盘同款的真实 `window.__navDeg`，两套 HUD 现在读数一致。
3. alt/vsi/atmo/ladder：**确认为不可达代码**——`combatHudState(mode)` 只在 `drawPilotFeed` 的 combat/standby 分支被调用，此时 `mode` 恒为 `'combat'`/`'standby'`；真正的起飞/降落走的是 `drawPilotDeck`+`drawCockpitFrame`+`drawPilotHmd` 另一条路径，从不经过 `drawCombatHudSC`。也就是说这套面板的 R-ALT/VSI/ATMO/俯仰梯从代码接线上看**从未在真实飞行中出现过**——不是数值不准，而是这几个字段从未被真实调用路径喂过非零值。
4. **机库跑道纵深透视——范围缩减，未做**：要让上一条的 ladder/atmo 真正显示出东西，意味着把 `combatHudSC` 也接入起飞/降落渲染路径——而那条路径已经用 `drawPilotDeck`（含跑道纵深线、导轨光效）覆盖得很好，双跑一套等价视觉是重复投入而非精度修复，记为待评估的独立特性而非本轮硬做。
5. **融入 SC 参考图 3–5 优点——已完成，但落在 HMD v3**：护盾四象限数值网格（`drawShieldQuadrantGrid`）+ 任务目标面板（`drawMissionPanel`，绑定真实 `killCount`/`giantKillCount`/锁定状态）已加入 `src/ui/combatHmdV3.js` 的 `drawCleanCombatHmd`——按本文档原建议的更合理路径，加入默认 HUD 而非修复已降级的可选皮肤。护盾象限值是单一真实 hp 按象限做小幅确定性偏移派生（同 `drawTargetHealthBars` 的 armor% 派生手法，非独立四份伤害模型），已在代码注释中如实说明。
6. 中英标签规则维持：HUD 缩写保持英文，告警/状态跟随 `currentLang`——未改动，行为不变。

**已完成 · 戏剧化武器镜头序列** `src/scene/combatCine.js`：`drawMissileCine`（自动锁定→发射→追踪→命中）+ `drawNukeCine`（夜鹰激光指示撤离→VLS 舱门→核弹点火→跟踪→引爆），已接入 missile/nukeAuth 分支，`elapsed` 驱动、彗星方位对齐 `halley.curX/Y`。

**✅ 2026-07-03 帧级对齐 + 镜头切换（见 §0 P2-8）**
- 新增基于 `e`（elapsed 分数）边界邻近度的白色 whip-flash：导弹锁定/点火节点、核弹三次分镜切换（护航→VLS→末段跟踪→引爆）现在有剪辑感的镜头切换。
- 真实命中同步从"静默瞬移"改为"一次性衰减闪光"：`halley.destroyed` 提前触发、动画还没播到预定 impact/detonation 节点时，会有一次 5 帧衰减的定向闪光标记这次强制剪切（rising-edge 一次性触发，同 `topdownCombat.js` 已有的击杀检测模式），而不是画面无提示瞬移。

**⚠️ 仍待续（范围缩减，留待后续）**：核弹序列改用真实 Condor/夜鹰模型离屏渲染替代当前的 2D 绘制——需要把 three.js 模型渲染接入 canvas-2D 管线，是比"镜头对齐"大得多的独立特性。

---

## 4c. 首页 WebGL 上下文 / 性能审计 / Home WebGL context + perf audit

**已完成，无需继续跟踪**
- ✅ 死代码已清理：`bladeHologram.js`、`createShipRenderer` 均已确认从代码库移除。
- ✅ 全部活跃渲染器（`alphardForge`/`topdownCombat`/`fighter3D`/`capitalShip3D`/`shipHologram`/`saturnRenderer`）已加 `webglcontextlost` 韧性处理。
- ✅ dpr 上限已统一收紧（`topdownCombat`/`capitalShip3D` 1.75，`alphardForge` 1.5）。
- ✅ 结论仍成立：最坏并发 ~6 个 WebGL 上下文，远低于浏览器上限，数量不是问题。

**⚠️ 仍待续（低优先，需真机 profiling）**
- `saturnRenderer` 等 raw-GL 的**完整** context-restored 重建（目前仅 preventDefault 保活）。
- 跃迁点 shader 弱机自适应（降 fbm 八度或分辨率）。
- 统一所有渲染器 `powerPreference` 与 dpr 上限到一处常量（目前分散在各文件里，数值不完全一致：1.75 vs 1.5）。

---

## 5. 各页设计备忘 & 未来点子 / Per-page notes & ideas

- **Arena**：**v1.5 → Autopilot 双模型模拟盘（V3–V5，§5c-1）**。原有点子保留（B7）：「模型 vs 你」历史胜率曲线；接 Twelve Data 后把 W/M/6M/Y/5Y 徽标改 `REAL`。
- **Sectors**：**v1.5 → 中美 AI 对比矩阵 + 后内存专题（V9–V11，§5c-2）**；「研判与 Arena 预测打通」并入 V12 评估。
- **Signal**：**v1.5 → Warsh 时代重构（V6–V7，§5c-3）**；其余见 **§5b**。
- **Games**：世界杯收官跟进已提前为 **V2（P0）**——淘汰赛对阵确定后补 `home/away/result`（决赛 7/19）；「夺冠路径」树状图留 B7。
- **Leagues**（v1.5 新页，V0–V1）：MSI 2026 限时竞猜，7/12 决赛硬截止；赛后转战绩存档。规格见 **§5c-4**。
- **Novels**：暂无额外待办；Astro 阈值见 C5——**Leagues 上线后全站 7 页，逼近 ≥8 触发线**。

---

## 5b. Signal 专项：美联储观察站 / Fed-watch station ★

> **页面使命**：捕捉美联储日常政策变化与言论对美股波动的影响，是"事件 → 利率路径重定价 → 美股/板块反应"的传导链档案馆，非新闻站。

**✅ Phase 1 已完成（事件档案化）**——四份既有档案已刷新至 7 月 FOMC / 六月非农后状态；倒计时扩展为 `NEXT CONTAINMENT TEST`（FOMC + CPI + NFP 混排，取最近目标日期）；新增 **INCIDENT LOG** 区块，数据源 `public/signal-events.json`（已验证存在，含首份档案 `INCIDENT-2026-NFP-06`：六月非农 +5.7万 vs 预期 +11.3万、失业率 4.2% 但参与率降至 61.5%、盘前 risk-on 反应，四段式 + SCP 等级 `class` 字段）。后续新增事件只需在此 JSON 追加记录。

**⚠️ Phase 2 — 传导链可视化（未开始）**
- **BREACH METER**：事件前/后的降息-加息概率位移横条，位移幅度自动映射 SCP 收容等级（目前 `class` 字段是人工评定，Phase 2 要做成自动映射）。
- **鹰鸽罗盘**：主席+理事讲话鹰鸽评分聚合指针（手动打分先行）。
- **事件回放迷你图**：SPX 发布前后 ±2h 的 5 分钟 sparkline。

**⚠️ Phase 3 — 自动化与联动（未开始）**
- 定时任务自动生成事件档案草稿；与 Arena/Sectors 打通；FedWatch 概率自动刷新（若有数据源）。

> **v1.5（2026-07-04）**：本节 Phase 2 的「鹰鸽罗盘」与 Phase 3 的「定时任务自动生成档案」已被 **V6/V7**（Warsh 时代重构，见 §0b/§5c-3）吸收；BREACH METER 自动映射、事件回放 sparkline、FedWatch 自动刷新保留在 P3 长线（C1/C2 剩余）。

**设计原则**（沿用）：SCP 皮肤只做叙事包装，数据本体必须真实、注明日期与来源；所有研判标注 "not advice"；中英文案成对。

---

## 5c. v1.5 五大模块规格 / v1.5 module specs ★

> 2026-07-04 评审定稿。源头是用户的「Fable 5 Max 核心系统架构」规划报告；本节是评审后的**落地版**——保留报告的全部核心意图（双轨模拟盘、时间窗口批处理、五维信号矩阵、Fearless Draft 分析、后内存三主线），修正三处结构性问题（① LLM 伪高频、② 缺状态持久化设计、③ 日度年化对比无统计意义），补齐调度/预算/风控的工程细节。
>
> **事实纪律（贯穿全部模块）**：报告里的具体事实性内容（模型参数、赛果、公司财务数据等）**一律不写进本文档**——那些是运行时内容，由定时任务在生成当天用检索/注入数据核实后写进各数据 JSON。提示词层面强制「只允许引用 payload 注入的数据，禁止凭训练记忆报事实」（见 `prompts/README.md`）。两个影响排期的时效事实已核实（2026-07-04 检索）：MSI 2026 大田 6/28–7/12（决赛 7/12）；Kevin Warsh 5/13 参院确认、5/22 宣誓就任美联储主席。

### 5c-0 结构决策：五模块 → 站点结构映射

| 报告模块 | 落点 | 理由 |
| --- | --- | --- |
| Arena 双轨模拟盘 | `arena.html` 新增 AUTOPILOT 区块 | Arena 就是交易页身份，不裂页 |
| Sectors 中美 AI 对比 | `sectors.html` 新增对比矩阵区块 | 同上 |
| Signals（Warsh） | `signal.html` 就地内容重构 | 页面使命不变，换的是「馆藏」 |
| Leagues（MSI） | **新页 `leagues.html`，进 Labs** | 季节性限时内容，v1.4 常设规则的标准适用场景 |
| 后内存时代选股库 | **不单开新页**，进 `sectors.html` 专题区块 | 核心投资内容而非实验性内容，不符合 Labs 定位；顶层导航保持克制。若专题日后长成独立身份再升格 |

### 5c-1 Arena Autopilot（V3–V5）

**与原报告的差异（评审结论）**
1. **「高频」改为「日内双窗口 swing」**：LLM 做不了毫秒/分钟级连续推理（token 指数膨胀 + 无真实执行通道）。Model A = 每交易日 2 次批处理决策（开盘后窗口 + 尾盘窗口），单窗口内聚合该时段行情/新闻做一揽子决策——这正是报告「时间窗口批处理」的落地形态，名字改诚实了而已。Model B 维持报告原设计：盘后 1 次深度调仓评估。
2. **状态外置是地基**（报告缺失的最大架构块）：`arena-ledger.json` 是唯一事实源。每次 run = 固定 system prompt（吃 prompt caching）+ 全量小状态 + 当日数据摘要，**模型零会话记忆**。KV-Cache/上下文膨胀问题从架构上消失，而不是靠省着用。
3. **LLM 提案、规则引擎收单**：模型输出 JSON 订单 → 代码层校验 → 通过才入账；拒单原因写回 ledger，作为下次 run 的反馈信号。学习闭环是确定性的，不依赖模型自觉。
4. **评估口径修正**：单日收益年化会得出荒谬数字。前 30 个交易日只看累计收益/最大回撤/胜率/敞口；≥30 交易日后启用 30 日滚动年化 + Sharpe（报告要的「年化对比」此时才有统计意义）。A/B 各 $10,000 独立账本，公平对比。

**账本 schema 草案（`public/arena-ledger.json`）**
```json
{
  "updated": "2026-07-06T07:30:00Z", "version": 3, "day": 2,
  "models": {
    "A": {
      "cash": 4200.5, "equity": 10180.2,
      "positions": [{ "sym": "XXX", "qty": 10, "avgPx": 100.1, "mkPx": 103.2 }],
      "trades":    [{ "ts": "...", "sym": "XXX", "side": "buy", "qty": 10, "px": 100.1, "fee": 0.05, "slipBps": 2 }],
      "rejections":[{ "ts": "...", "order": {}, "reason": "single-position cap 20%" }],
      "metrics": { "cumPct": 1.8, "maxDD": -0.9, "hitRate": 0.6, "exposure": 0.58 },
      "review": { "zh": "…≤300字…", "en": "…" }
    },
    "B": { "同构": "…" }
  }
}
```

**硬风控（代码层强制，模型无权越过）**：现金账户、只做多，禁杠杆/期权/做空（v2 再评估白名单做空）；单票 ≤20% 账本净值；持仓 ≤8 只；现金 ≥5%；日亏 ≥3% 熔断（当日只允许 HOLD/SELL）；连续 3 日亏损 → Model A 降频为 1 次/日（省 token + 冷静期）。模拟撮合：市价按参考价 ±2bp 滑点 + 0.5bp 费用，收盘 mark-to-market。

**前端（V5）**：净值双曲线（A vs B，SVG 折线 + viz.js 数字动画）、持仓表、成交/拒单日志、每日复盘卡（中英）。免责声明沿用全站规则（模拟盘、非投资建议）。

### 5c-2 Sectors 扩展（V9–V11）

- **对比矩阵**：4 厂商观察卡（美：Anthropic/OpenAI；中：智谱/阿里）——**每周更新**（产业格局以周为单位变化，日更是浪费）。每卡：当期版本与路线（开源权重 vs 闭源 API）、本周关键动态（带来源链接）、映射标的篮子。
- **标的映射纪律**：定性关联标签（`direct` 直接受益 / `supplier` 上游供给 / `infra` 算力底座 / `competitor` 受压），**不给伪造的统计相关系数**；接 Twelve Data 历史真算 90 日价格相关性列为 stretch goal。
- **后内存专题**：三主线（HBM 产能与定价权 / CXL 内存池化 / NAND KV-Cache 分层）+ Top 10 论点卡，每卡 `{ticker, moat, thesis, keyRisk, catalysts[], lastReviewed}`。报价复用现有报价管线；OTC ADR（SK Hynix/Samsung）报价源缺失时该卡降级为纯论点展示，不放假数据。
- **数据文件** `public/sectors-data.json`：`{updated, version, modelWatch[], baskets[], postMemory[]}`，一次周跑同时产出三块。

### 5c-3 Signal「Warsh 时代」重构（V6–V7）

- **叙事**：SCP 收容站更换 Site Director——新主席人事档案卡（政策立场：鹰派 2% 目标、捍卫央行独立、反 QE、激进缩表、反前瞻性指引——均为公开立场，档案按此归档）+ O5 更替事件档案（就任本身作为一份 INCIDENT 收录）。
- **五维信号矩阵**：通胀数据 / 货币政策与美联储动态 / 企业财报与指引 / 产业与巨头动向 / 地缘与贸易——五个 pillar 卡片；`signal-events.json` 每份事件档案打 `pillar` 标签自动归类。
- **无前瞻指引的机械含义**：数据发布日的波动权重上升 → 既有 `NEXT CONTAINMENT TEST` 倒计时按 pillar 分类扩展；CPI/PCE/NFP/FOMC 发布日由定时任务事件驱动跑一次，自动产出事件档案草稿。
- **鹰鸽罗盘首版**（吸收 C1 该项）：讲话稀缺时代单次讲话权重更大；人工打分先行，聚合成指针，自动化留 P3。

### 5c-4 Leagues（V0–V1）

- **定位**：Labs 第三页，MSI 2026 限时竞猜（赛后转战绩存档页）。**生命周期从第一天写进 schema**：`mode: "live" | "archived"` 控制页面状态条与文案，赛事结束不下线、转为战绩档案（Labs 页的标准生命周期范式，供未来季节页复用）。
- **骨架**：克隆 games.html 模式（hero + 战绩 + 对阵卡 + 赔率 + 免责声明 + i18n `data-en/zh` 全覆盖）；主题海克斯金/蓝（`#c8aa6e`/`#0ac8b9` 一带），与 games 品红/青、其余各页均区分。
- **数据** `public/leagues-data.json`：`{updated, version, mode, bracket[], series[{id, round, bo, teams[], result?, pred:{winner, score, pWin, oddsImplied, factors[], reasoningZh, reasoningEn}}], fearless[{team, poolDepth, note}], champion[{team, p}]}`。
- **预测纪律**：夺冠概率自洽（Σp=1）；`oddsImplied = 1/p` 诚实换算（可另列真实盘口价差作对照，标注来源）；每个系列赛完场立即复盘计分（命中 + Brier），战绩组件后续与 Games 统一（V12）。
- **Fearless Draft 特色**：每队英雄池深度指数，数据来自当届实际 pick 记录（注入数据，标注来源），不凭印象打分。

### 5c-5 调度、token 预算与数据管线（V12 + 全模块共用）

**调度表**（用户本机 cron，AEST；美股 7 月为 EDT=UTC-4，AEST=UTC+10）

| 任务 | 市场时间 (ET) | 本机 (AEST) | cron | 频率 |
| --- | --- | --- | --- | --- |
| Arena Model A · 开盘窗 | 10:30 | 00:30 | `30 0 * * 2-6` | 交易日 |
| Arena Model A · 尾盘窗 | 15:45 | 05:45 | `45 5 * * 2-6` | 交易日 |
| Arena Model B · 盘后 | 17:30 | 07:30 | `30 7 * * 2-6` | 交易日 |
| Arena 周度深复盘 | — | 周六 10:00 | `0 10 * * 6` | 每周 |
| Signal 例行 | — | 周一 08:00 | `0 8 * * 1` | 每周 + 数据发布日事件驱动 |
| Sectors（含后内存） | — | 周日 10:00 | `0 10 * * 0` | 每周 |
| Leagues（MSI 期间） | — | 23:30 | `30 23 * * *` | 每日，至 7/12 止 |

所有任务入口先过**守卫**（周末/NYSE 假日/无比赛日直接 no-op），不产生任何 API 调用。冬令时切换（11 月）需整体校准一次 cron。

**token 预算（月度估算，实际以运行日志校准）**

| 模块 | 次/月 | 单次输入上限 | 月输入估算 |
| --- | --- | --- | --- |
| Arena A（2/交易日） | ~44 | 20k | ~0.9M |
| Arena B（1/交易日） | ~22 | 40k | ~0.9M |
| Arena 周复盘 | ~4 | 50k | ~0.2M |
| Signal | ~6 | 25k | ~0.15M |
| Sectors | ~4 | 45k | ~0.2M |
| Leagues | 赛事期 ~10 | 15k | ~0.15M（一次性） |

合计 ≈ **2.5M 输入 / ~0.15M 输出每月**。三条纪律压住预算：① 固定 system prompt 吃 prompt caching；② 数据预消化（指标计算、新闻去重截断）用代码/便宜模型做，Fable 只做决策推理；③ 输出双段式（机器 JSON + 限长复盘）硬上限。

**数据管线（V12）**
- `scripts/push-arena-news.sh` 已验证可用（cron → 写 JSON → 独立 stash/rebase/commit/push → 站点重部署），模板化为 `push-data.sh <file> <msg>` 供 ledger/leagues/sectors/signal 复用。
- 所有数据 JSON 顶层统一 `{updated, version}`；前端共享「数据龄」徽标（>36h 琥珀、>72h 红）。
- 预测类战绩组件统一（Games/Leagues/Signal）：命中率 + Brier 分数，一处实现三处用。

### 5c-6 提示词工程规范（全模块）

正式文本在 **`prompts/`**（README + 5 个模块文件），本文档只记五条硬规则：
1. **system/run 拆分**——角色、红线、输出 schema 进固定 system prompt（享受缓存）；账本状态与当日数据进 run payload。
2. **强制 JSON schema 输出**——机器段直接落盘进数据 JSON；展示段单独字段且限长。
3. **状态外置**——模型零会话记忆，账本/数据 JSON 是唯一事实源。
4. **事实纪律**——只允许引用 payload 注入的数据；禁止凭训练记忆报价格/新闻/模型参数；不确定必须标 `confidence` 并降权。
5. **长度硬上限**——复盘 ≤300 字、单条推理 ≤120 字，防 token 膨胀。

---

## 6. 架构演进与下一代视觉 / Architecture evolution & next-gen visuals ★

> 站点持续加页（novels.html 已上线，之后更多）。结论：**不需要换语言、不需要上 React**——瓶颈在 (a) 多页手工维护成本 (b) 主线程渲染压力 (c) 缺乏 GPU 后期处理。

### 6.1 现有架构的真实问题（按痛感排序）

1. ✅ **`public/*.html` 不经打包**——**已解决（2026-07-03 HTML 部分 + 2026-07-03 脚本部分，见 §0b A1）**：五个子页 HTML 已移出 `public/`、接入 `vite.config.js` 多入口；页面引用的经典脚本（`nav.js`/`audio.js`/`i18n.js`/`transition.js`/各页专属脚本，9 个文件）也已从 `public/` 移到 `src/lib/`、`src/pages/`，改成每页一个显式 `import` 链的 ES module 入口，真正参与压缩/哈希/公共 chunk。
2. **单体文件**——`main.js` 3421 行（2026-07-03 拆出 combat HUD 模块后，见 §2/§0 P1-4）/ `styles.css` 7038 行，仍需继续拆分。
3. **重复的页面骨架**——nav 已统一，但 `<head>` meta / 字体加载顺序仍每页复制。
4. **主线程全包**——combat、雷达、K 线仍在主线程 Canvas 2D；星空已移出（见下）。
5. **多页跳转是整页刷新**——`transition.js` 掩盖白屏，本质仍丢弃状态重载；原生跨文档过渡已作为补充层加入（见下）。

### 6.2 技术选型建议

**✅ 值得做**

| 技术 | 解决什么 | 成本 |
| --- | --- | --- |
| **Vite MPA 多入口** | ✅ 已完成（2026-07-03，HTML + 脚本两部分）：HTML 入口 + 9 个经典脚本都已转成参与打包的 ES module，详见 §0b A1 | 低-中，已投入 |
| **View Transitions API（跨文档）** | ✅ 已完成（2026-07-03）：`page-turn.css`/`styles.css` 加 `@view-transition{navigation:auto}`，`transition.js` 在真正跳转前打 `html.vt-suppress` 关闭原生 crossfade，避免和自定义每页特效叠加。**未替代** `transition.js`（那套效果更丰富，仍是点击/键盘翻页主效果）——净收益是补上了未被拦截的跳转（地址栏/书签/前进后退）原本的白屏一闪 | 低-中，已投入 |
| **CSS Scroll-Driven Animations** | `animation-timeline: scroll()/view()` 把滚动动画搬到合成器线程，零 JS 不掉帧 | 中 |
| **OffscreenCanvas + Worker** | ✅ 首页星空/warp-tunnel 已完成（2026-07-03）：`backgroundScene.js` 特性检测自动切换 Worker 渲染，不支持时完整回退主线程，main.js 零改动。⚠️ 范围：只做了星空这一个 canvas，combat/雷达/K 线仍在主线程；真实设备帧率提升未验证（沙盒无法跑浏览器） | 中，已投入首页星空部分 |
| **three.js WebGPURenderer + TSL** | compute shader 粒子（百万级星涡/爆炸碎片）+ 更低 draw call 开销 | 中-高 |
| **Bloom/HDR 后期处理** | `UnrealBloomPass` + ACES tone mapping，真实辉光替代 radial-gradient 假光晕 | 中 |
| **TypeScript（渐进）** | 拆 main.js 时新模块直接 `.ts` | 低（增量） |
| **Astro（触发式）** | 页面 ≥8 或 novels 章节 ≥20 时迁移，当前未到阈值 | 高（迁移） |

**❌ 不要做**：React/Vue/Svelte 重写、Rust/WASM、全站 WebGPU-only、SSR/后端框架——理由不变（详见历史版本），站点是 canvas 动画 + 静态内容，加框架/后端只会增加体积与运维成本而无实际收益。

### 6.3 落地顺序

1. ✅ **已完成**：清理 §7 死文件 → Vite MPA 多入口改造（HTML + 经典脚本两部分）→ OffscreenCanvas Worker 化首页星空 → View Transitions API 跨文档过渡（与 `transition.js` 共存）→ viz.js 公共库抽取。
2. **短期**：scroll-driven animations 替换 alphardForge 的 JS pin 逻辑；main.js 拆分继续（Phase 3–5，§0b A2）；新模块用 TS。
3. **中期**：three.js WebGPURenderer 试点跃迁点星涡（compute 粒子 + bloom），A/B 对比帧率后再推广。
4. **触发式**：页面/章节数量到阈值 → Astro 迁移。

**衡量标准**：Chrome DevTools Performance——主线程帧时间目标 <8ms、合成器帧率目标 120fps、子页 LCP <1.5s。

---

## 7. 本轮审查新发现 / Newly found in this audit ★

- **4 个孤立遗留 HTML 文件 — ✅ 已删除（2026-07-03）**：`public/afflatus_blog_homepage_marathon_style.html`、`afflatus_marathon_new_style_homepage.html`、`afflatus_terminal_dos_style.html`、`afflatus_topbar_redesign_responsive.html`，均为 2026-06-13 一次性 `git commit b0f1260 "Add files via upload"` 遗留，确认零引用后删除。
- **HUD 双系统并存 — ✅ 已解决（2026-07-03）**：见 §3.1 / §4b，判定 HMD v3 为默认，`combatHudSC` 降级为 `?combatview=sc` 可选皮肤。
- **`combatRuntime.getState()` 缺失**：仍未创建，见 §0 P1-5 / §4 Phase 2b，是下一批要处理的阻塞项（P1，非本轮 P0 范围）。
- **Vite MPA 多入口改造 — ✅ HTML 部分已完成（2026-07-03）**：五个子页从 `public/` 移到项目根目录并接入 `vite.config.js` 多入口；`vite dev`/`vite preview` 均验证六个入口 + 关键静态资源 200。⚠️ 范围说明：页面引用的经典脚本（`nav.js` 等 ~10 个文件）仍是 `public/` 静态直通，未参与打包/哈希，是下一轮的后续工作，见 §6.2/6.3。

---

*Desk view only · not investment / betting advice. 仅为台面观点，非投资或博彩建议。*
