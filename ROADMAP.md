# Project Afflatus — Design & Roadmap / 设计与路线图

> 全站设计建议、未来路线图，以及代码模块整理与优化方法。
> 技术细节与 git 操作教程见 **TECHNICAL.md**。

---

## 0. 状态速览 + 优先级排序 / Status at a glance ★

> 本轮（2026-07-02）逐条核对了本文档与代码库的实际状态：已验证**完全完成**的任务从路线图中移除（不再需要跟踪），**做到一半或未开始**的任务保留并标注 ⚠️，同时发现了 3 项文档未记录的新情况，并按重要程度排序。**2026-07-03 更新：P0/P1/P2 均已完成**（P2 有两处范围缩减/延后，详情见下方对应小节）；P3 为下一轮候选。

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

**现状痛点（部分缓解中）**
- `src/main.js` **3421 行**（2026-07-03 起从 3733 行拆出 combat HUD 绘制模块后）、`src/styles.css` **7038 行**——仍是单体文件，Phase 3–5 完整拆分仍未开始。
- 主线程渲染压力大：星空、combat、雷达、K 线全部在主线程 Canvas 2D 绘制（详细技术方案见 §6）。

**已完成（无需继续跟踪）**
- ✅ 统一导航：`public/lib/nav.js` + `SITE`，**六个页面（含首页）全部接入**，链接/prev-next 由脚本渲染，新增页面只改 `SITE` 一处。首页保留自己的双语系统，导航文字维持英文，视觉与改动前一致。
- ✅ 抽公共库（部分）：`clock.js`（arena/games 复用）、`audio.js`（transition.js/signal.html 复用），build 验证通过。
- ✅ 拆 main.js（Phase 4，第一步）：`src/ui/combatHmdV3.js` 已抽出 HMD v3 全部纯绘制函数，main.js −312 行。详见 §0 P1-4。

**⚠️ 待续 / 未开始**
- **`viz.js` 抽取**：count-up 动画逻辑目前在 `sectors.html`（约 158 行处）与 `src/ui/marketDeck.js`（约 309 行处）各自实现，尚未合并成公共库。
- **拆样式（Phase 3）**：各页 `<style>` 仍内联，未移到 `public/styles/<page>.css`。
- **拆 main.js（Phase 4，剩余部分）**：只完成了 combat HUD 绘制这一块；`state`（飞行状态机）/`cursor`/`nav`/`boot` 职责拆分仍未开始，main.js 仍有 3421 行。
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
2. **单体文件**——`main.js` 3421 行（2026-07-03 拆出 combat HUD 模块后，见 §2/§0 P1-4）/ `styles.css` 7038 行，仍需继续拆分。
3. **重复的页面骨架**——nav 已统一，但 `<head>` meta / 字体加载顺序仍每页复制。
4. **主线程全包**——combat、雷达、K 线仍在主线程 Canvas 2D；星空已移出（见下）。
5. **多页跳转是整页刷新**——`transition.js` 掩盖白屏，本质仍丢弃状态重载；原生跨文档过渡已作为补充层加入（见下）。

### 6.2 技术选型建议

**✅ 值得做**

| 技术 | 解决什么 | 成本 |
| --- | --- | --- |
| **Vite MPA 多入口** | ✅ HTML 入口部分已完成（2026-07-03）；⚠️ 剩余：把各页经典 `<script src>` 转成 ES module import，才能让这些脚本本身也吃到压缩/哈希/公共 chunk（当前仍是 `public/` 静态直通） | 低，半天已投入；剩余部分中（涉及 ~10 个互相依赖顺序的脚本文件） |
| **View Transitions API（跨文档）** | ✅ 已完成（2026-07-03）：`page-turn.css`/`styles.css` 加 `@view-transition{navigation:auto}`，`transition.js` 在真正跳转前打 `html.vt-suppress` 关闭原生 crossfade，避免和自定义每页特效叠加。**未替代** `transition.js`（那套效果更丰富，仍是点击/键盘翻页主效果）——净收益是补上了未被拦截的跳转（地址栏/书签/前进后退）原本的白屏一闪 | 低-中，已投入 |
| **CSS Scroll-Driven Animations** | `animation-timeline: scroll()/view()` 把滚动动画搬到合成器线程，零 JS 不掉帧 | 中 |
| **OffscreenCanvas + Worker** | ✅ 首页星空/warp-tunnel 已完成（2026-07-03）：`backgroundScene.js` 特性检测自动切换 Worker 渲染，不支持时完整回退主线程，main.js 零改动。⚠️ 范围：只做了星空这一个 canvas，combat/雷达/K 线仍在主线程；真实设备帧率提升未验证（沙盒无法跑浏览器） | 中，已投入首页星空部分 |
| **three.js WebGPURenderer + TSL** | compute shader 粒子（百万级星涡/爆炸碎片）+ 更低 draw call 开销 | 中-高 |
| **Bloom/HDR 后期处理** | `UnrealBloomPass` + ACES tone mapping，真实辉光替代 radial-gradient 假光晕 | 中 |
| **TypeScript（渐进）** | 拆 main.js 时新模块直接 `.ts` | 低（增量） |
| **Astro（触发式）** | 页面 ≥8 或 novels 章节 ≥20 时迁移，当前未到阈值 | 高（迁移） |

**❌ 不要做**：React/Vue/Svelte 重写、Rust/WASM、全站 WebGPU-only、SSR/后端框架——理由不变（详见历史版本），站点是 canvas 动画 + 静态内容，加框架/后端只会增加体积与运维成本而无实际收益。

### 6.3 落地顺序

1. ✅ **已完成**：清理 §7 死文件 → Vite MPA 多入口改造（HTML 部分）→ OffscreenCanvas Worker 化首页星空 → View Transitions API 跨文档过渡（与 `transition.js` 共存）。**下一步**：把 `nav.js`/`audio.js`/`clock.js`/`i18n.js`/`transition.js`/`page-turn.js`/各页专属 `.js` 转成 ES module，真正参与打包。
2. **短期**：scroll-driven animations 替换 alphardForge 的 JS pin 逻辑；main.js 拆分继续（Phase 3–5）；新模块用 TS。
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
