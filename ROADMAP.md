# Project Afflatus — Design & Roadmap / 设计与路线图

> 全站设计建议、未来路线图，以及代码模块整理与优化方法。
> 技术细节与 git 操作教程见 **TECHNICAL.md**。

---

## 0. 状态速览 + 优先级排序 / Status at a glance ★

> 本轮（2026-07-02）逐条核对了本文档与代码库的实际状态：已验证**完全完成**的任务从路线图中移除（不再需要跟踪），**做到一半或未开始**的任务保留并标注 ⚠️，同时发现了 3 项文档未记录的新情况，并按重要程度排序。**2026-07-03 更新：全部 3 项 P0 已完成**，详情见下方对应小节；P1 起为下一轮工作重点。

**P0 · 已全部完成（2026-07-03）**
1. ✅ **HUD 双系统冲突**——判定 `drawCleanCombatHmd` v3（cockpit 座舱 + FPM 飞行路径标记 + 功率柱 + 目标血条 + 前置量 + 边缘威胁箭头）为 combat/standby 默认视图——这是用户最近一次明确列出的太空战 HUD 需求规格（准星前置量/目标状态/自机弧形条/机动矢量/物理化座舱等）唯一完整实现的版本。`drawCombatHudSC`（GIMBAL/GROUP 全息 + SCM/AB 竖直油门条风格）降级为 `?combatview=sc` 时的可选皮肤，代码与素材均保留、未删除。详见 **§4b**。
2. ✅ **4 个孤立遗留 HTML 死文件**——`public/afflatus_blog_homepage_marathon_style.html`、`afflatus_marathon_new_style_homepage.html`、`afflatus_terminal_dos_style.html`、`afflatus_topbar_redesign_responsive.html` 均已确认零引用并删除。
3. ✅ **Vite MPA 多入口改造**——`arena.html`/`sectors.html`/`signal.html`/`games.html`/`novels.html` 已从 `public/` 移到项目根目录，`vite.config.js` 新增 `build.rollupOptions.input` 六个入口（含首页）。构建验证：全部子页在 `dist/` 下产出**独立压缩/精简的 HTML**（如 `signal.html` 46KB→gzip 15.5KB），页面自身引用的经典 `<script src="/x.js">`（`nav.js`/`audio.js`/`clock.js`/`i18n.js`/`transition.js`/`page-turn.js`/各页专属 `.js`）**仍留在 `public/`、作为静态直通文件**——本轮只让 HTML 本身进打包管线（压缩+正确资源注入），尚未把这些经典脚本转成 ES module 参与真正的打包/哈希（下一步见 §6）。`vite dev` 与 `vite preview` 均已起服务器 curl 验证六个入口 + 关键静态资源全部 200。

**⚠️ P1 · 高价值，优先安排（下一轮）**

**P1 · 高价值，优先安排**
4. **main.js（3733 行）/ styles.css（7038 行）拆分**——§2 Phase 3–5 完全未开始，体量比上次记录时更大，回归风险持续线性上升。
5. **`combatRuntime.getState()` 接口化**——确认代码中仍不存在，是阻塞 topdownCombat 真实战况绑定的关键缺口。详见 **§4** Phase 2b。
6. **首页 `index.html` 导航接入 `nav.js` SITE**——唯一还没迁移到统一导航系统的页面。详见 **§2**。

**P2 · 视觉/体验打磨，非阻塞**
7. `combatHudSC` 数据绑定精度校验 + 机库跑道纵深透视 + 融入 SC 图 3–5 优点（护盾象限网格、任务目标面板）——详见 **§4b**。
8. `combatCine` 武器镜头与真实命中时刻的帧级对齐精修——详见 **§4b**。
9. OffscreenCanvas + Worker 化背景渲染（星空/combat）——详见 **§6**。
10. View Transitions API 跨文档过渡，逐步替代/简化 `transition.js`——详见 **§6**。

**P3 · 长线 / 待触发条件成熟**
11. Signal Phase 2–3（重定价仪表、鹰鸽罗盘、事件回放迷你图、自动化生成）——详见 **§5b**。
12. three.js WebGPURenderer + compute 粒子 + Bloom/ACES 后期处理——详见 **§6**。
13. `viz.js` 公共库抽取（count-up 逻辑目前在 `sectors.html` 与 `marketDeck.js` 各自重复实现）——详见 **§2**。
14. topdownCombat Phase 3–4（首页主战斗迁移到俯视渲染、代码分割体积优化）——详见 **§4**。
15. Astro 迁移（触发式：页面 ≥8 或 novels 章节 ≥20 时再评估，当前未到阈值）——详见 **§6**。

---

## 1. 站点结构与各页身份 / Pages & identities

| Page | File | 身份 / Identity | 主题 |
| --- | --- | --- | --- |
| Home | `index.html` + `src/` | 深空舰长日志 (Three.js) | Orbitron / 钢蓝 HUD |
| Arena | `public/arena.html` | Human vs AI 交易竞技场 | Marathon · 霓虹绿/青 |
| Sectors | `public/sectors.html` | AI + 航天个股研判 | 酸性绿 + 故障艺术 |
| Signal | `public/signal.html` | 美联储观察 = SCP O5 收容档案 | 机密文档 · 琥珀/绿 |
| Games | `public/games.html` | 世界杯限时竞猜 vs Opus | 赛博朋克 · 品红/青 |
| Novels | `public/novels.html` | 无限流·种田小说连载《万界种春》 | 复古未来主义 · 铜/青（纯中文，护眼阅读，含夜间/豆沙绿/米黄三种阅读模式、自动翻页、书签、章节速览） |

**原则**：每页保留**独立的字体与美术身份**，但共享一套基础系统，避免重复造轮子。Novels 页已按此原则上线并从第一天起接入统一导航，验证了该架构决策可以随加页扩展。

**共享系统 / Shared systems**
- `page-turn.css` — 翻页箭头 + 自托管字体 + 全局按钮点击反馈（每页用 body class 切换箭头配色）。
- `transition.js` — 进出页动画 + 音效；按目标页选择类型（warp / cannon / takeoff / control / cyber）。
- `i18n.js` — 全局中英切换；任何带 `data-en` / `data-zh` 的元素自动翻译；右上角 `.lang-toggle`；切换时派发 `afflatus-lang` 事件供动态页面（arena/games/signal）重渲染。
- `public/lib/nav.js` — 唯一的 `SITE` 数组渲染导航 + 翻页 prev/next；五个非首页（arena/sectors/signal/games/novels）均已接入。
- `public/lib/clock.js` / `public/lib/audio.js` — 倒计时格式化、Web Audio 环境音共享库（arena/games/signal/transition.js 复用）。
- 数据文件：`arena-news.json`（每日定时任务）、`games-data.json`（手动更新）、`signal-events.json`（宏观事件档案，见 §5b）、`novels-data.json`（章节内容）。

---

## 2. 代码整理与优化方法 / Refactor & optimisation method

**现状痛点（仍未缓解，且随加页在恶化）**
- `src/main.js` **3733 行**、`src/styles.css` **7038 行**，均为单体文件，难以维护——拆分计划（见下）完全未开始。
- 主线程渲染压力大：星空、combat、雷达、K 线全部在主线程 Canvas 2D 绘制（详细技术方案见 §6）。

**已完成（无需继续跟踪）**
- ✅ 统一导航：`public/lib/nav.js` + `SITE`，五个非首页全部接入，链接/prev-next 由脚本渲染，新增页面只改 `SITE` 一处。
- ✅ 抽公共库（部分）：`clock.js`（arena/games 复用）、`audio.js`（transition.js/signal.html 复用），build 验证通过。

**⚠️ 待续 / 未开始**
- **首页 `index.html` 导航**：仍是手写链接与硬编码 prev/next，未接入 `SITE`（耦合 `src/main.js` 的遥测/指挥/时钟，需小心不破坏现有 `getElementById` 绑定）。
- **`viz.js` 抽取**：count-up 动画逻辑目前在 `sectors.html`（约 158 行处）与 `src/ui/marketDeck.js`（约 309 行处）各自实现，尚未合并成公共库。
- **拆样式（Phase 3）**：各页 `<style>` 仍内联，未移到 `public/styles/<page>.css`。
- **拆 main.js（Phase 4）**：`state`/`hud`/`cursor`/`nav`/`boot` 职责拆分未开始。
- **拆 styles.css（Phase 5）**：`@layer` 分层未开始。

**优化清单 / Optimisation checklist（现状）**
- 背景 canvas：`prefers-reduced-motion` 静帧、`visibilitychange` 暂停已做；IntersectionObserver 不可见时停仍待做。
- API 预算：Finnhub 自适应轮询、Twelve Data 按日缓存已做。
- 资源：`public/*.js`/`public/*.html` 仍未进 Vite 打包（见 §0 P0-3 / §6）。

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
- **Phase 2b**：`combatRuntime.getState()` 快照接口**确认仍不存在**——`topdownCombat` 俯视场景仍未由真实战况（彗星位置/护航开火）驱动，仍是自走时间线。这是解锁后续所有真实数据绑定的前置工作，优先级见 §0 P1-5。
- **Phase 2**：`topdownCombat` 接入 `drawPilotFeed` 仍是 **opt-in**（默认关闭，`?combatview=topdown` 开启），尚未评估转正。
- **Phase 3**：首页主战斗（`event-layer`）迁移到同一俯视渲染——未开始。
- **Phase 4**：`topdownCombat` 的 three.js 静态引入改为动态 `import()` 代码分割——未开始，首屏包体仍偏大。

**架构边界**（保持不变，仍是正确的设计原则）：`combatRuntime.js`（状态）→ `topdownCombat.js`（纯渲染）→ `#pilotFeed`。

---

## 4b. Combat View HUD（Star Citizen 风格）/ Combat-view HUD ★

> `src/scene/combatHudSC.js` 的 `drawCombatHudSC(ctx,w,h,now,state)`**已从默认降级为可选皮肤**（2026-07-03，见 §3.1/§0 P0-1）：`?combatview=sc` 时显示，代码与美术保留完好，未来若要把它的元素（护盾象限网格、任务面板等）移植进默认 HMD v3，仍可复用这里的实现。以下是它自身尚未完成的部分，独立于默认/可选状态，未来若启用仍值得修：

**已实现**：左上战机全息框（GIMBAL/GROUP/GUNS(ALL) + 护盾数值）、顶部 ONLINE 状态条 + 航向带、左右竖直油门条（SCM/AB）、ESP/CPLD 方块 + 红色云台准星、H-FUEL/Q-FUEL、右侧 G 表节点图、DECOY/NOISE、R-ALT/VSI/ATMO、中央俯仰梯（仅 atmo/hangar，`state.ladder`）+ 侧弧 + 准星、琥珀/红告警。

**⚠️ 待续（若未来重新启用或移植元素）**
1. **数据绑定精度校验**：speed/throttle/ab/heading/g/alt/vsi/shieldF/R 与真实飞行状态的映射需要逐项核对是否准确（此前只是设计意图，未见校验记录）。
2. **机库跑道纵深透视**：代码中确认目前**没有**跑道透视实现（只有 `state.ladder` 控制的俯仰梯注释提及 atmo/hangar）。建议复用首页 `drawPilotDeck` 作为 launch/hangar 背景。
3. **融入 SC 参考图 3–5 优点**：护盾四象限数值网格、右侧任务目标面板（COMBAT GAUNTLET/Waves）——代码中确认**未实现**（`grep quadrant/mission/objective/GAUNTLET` 均为空）。这两项其实是默认 HMD v3 目前也缺的元素，**更合理的路径是直接搬到 `drawCleanCombatHmd` 里**，而不是先修好这套已经降级的可选皮肤。
4. 中英标签规则维持：HUD 缩写保持英文，告警/状态跟随 `currentLang`。

**已完成（第一版）· 戏剧化武器镜头序列** `src/scene/combatCine.js`：`drawMissileCine`（自动锁定→发射→追踪→命中）+ `drawNukeCine`（夜鹰激光指示撤离→VLS 舱门→核弹点火→跟踪→引爆），已接入 missile/nukeAuth 分支，`elapsed` 驱动、彗星方位对齐 `halley.curX/Y`。

**⚠️ 待续**：与 `combatRuntime` 真实命中时刻的帧级对齐精修（当前是近似同步，非精确锚定）；镜头切换过场效果；核弹序列改用真实 Condor/夜鹰模型离屏渲染替代当前的 2D 绘制。

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

- **Arena**：可加"模型 vs 你"的历史胜率曲线；真实历史接 Twelve Data 后把 W/M/6M/Y/5Y 徽标改 `REAL`。
- **Sectors**：可把研判与 Arena 的 Opus 预测打通（同一数据源）。
- **Signal**：见 **§5b**。
- **Games**：决赛阶段对阵确定后在 `games-data.json` 补 `home/away/result`；可加"夺冠路径"树状图。
- **Novels**：新页面，暂无额外待办；若章节数增长到 §6 提到的阈值，评估 Astro/MDX 迁移。

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

**设计原则**（沿用）：SCP 皮肤只做叙事包装，数据本体必须真实、注明日期与来源；所有研判标注 "not advice"；中英文案成对。

---

## 6. 架构演进与下一代视觉 / Architecture evolution & next-gen visuals ★

> 站点持续加页（novels.html 已上线，之后更多）。结论：**不需要换语言、不需要上 React**——瓶颈在 (a) 多页手工维护成本 (b) 主线程渲染压力 (c) 缺乏 GPU 后期处理。

### 6.1 现有架构的真实问题（按痛感排序）

1. ✅ **`public/*.html` 不经打包**——**已解决（2026-07-03）**：五个子页 HTML 已移出 `public/`、接入 `vite.config.js` 多入口，构建产出压缩 HTML。**注意范围**：只有 HTML 本身进了管线，页面引用的经典 `<script src="/x.js">`（`nav.js`/`audio.js`/`i18n.js`/`transition.js`/各页专属脚本）仍留在 `public/` 原样直通，未压缩/未哈希/未参与公共 chunk——这部分是 §6.2 "Vite MPA 多入口"行动项里**尚未做完**的下半场，见下方技术选型表的更新说明。
2. **单体文件**——`main.js` 3733 行 / `styles.css` 7038 行，比此前记录时更大，仍未拆分。
3. **重复的页面骨架**——nav 已统一，但 `<head>` meta / 字体加载顺序仍每页复制。
4. **主线程全包**——星空、combat、雷达、K 线全部主线程 Canvas 2D。
5. **多页跳转是整页刷新**——`transition.js` 掩盖白屏，本质仍丢弃状态重载。

### 6.2 技术选型建议

**✅ 值得做**

| 技术 | 解决什么 | 成本 |
| --- | --- | --- |
| **Vite MPA 多入口** | ✅ HTML 入口部分已完成（2026-07-03）；⚠️ 剩余：把各页经典 `<script src>` 转成 ES module import，才能让这些脚本本身也吃到压缩/哈希/公共 chunk（当前仍是 `public/` 静态直通） | 低，半天已投入；剩余部分中（涉及 ~10 个互相依赖顺序的脚本文件） |
| **View Transitions API（跨文档）** | `@view-transition {navigation: auto}` 让多页跳转获得 SPA 级无缝过渡，可简化/替代 `transition.js` | 低-中 |
| **CSS Scroll-Driven Animations** | `animation-timeline: scroll()/view()` 把滚动动画搬到合成器线程，零 JS 不掉帧 | 中 |
| **OffscreenCanvas + Worker** | 星空/combat 背景移入 Worker 线程，主线程只管 UI——当前帧率提升性价比最高的一步 | 中 |
| **three.js WebGPURenderer + TSL** | compute shader 粒子（百万级星涡/爆炸碎片）+ 更低 draw call 开销 | 中-高 |
| **Bloom/HDR 后期处理** | `UnrealBloomPass` + ACES tone mapping，真实辉光替代 radial-gradient 假光晕 | 中 |
| **TypeScript（渐进）** | 拆 main.js 时新模块直接 `.ts` | 低（增量） |
| **Astro（触发式）** | 页面 ≥8 或 novels 章节 ≥20 时迁移，当前未到阈值 | 高（迁移） |

**❌ 不要做**：React/Vue/Svelte 重写、Rust/WASM、全站 WebGPU-only、SSR/后端框架——理由不变（详见历史版本），站点是 canvas 动画 + 静态内容，加框架/后端只会增加体积与运维成本而无实际收益。

### 6.3 落地顺序

1. ✅ **已完成**：清理 §7 死文件 → Vite MPA 多入口改造（HTML 部分）。**下一步**：把 `nav.js`/`audio.js`/`clock.js`/`i18n.js`/`transition.js`/`page-turn.js`/各页专属 `.js` 转成 ES module，真正参与打包；`@view-transition` 与 `transition.js` 共存灰度。
2. **短期**：OffscreenCanvas Worker 化首页星空背景；scroll-driven animations 替换 alphardForge 的 JS pin 逻辑；main.js 拆分启动，新模块用 TS。
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
