# Project Afflatus — Design & Roadmap / 设计与路线图

> 全站设计建议、未来路线图，以及代码模块整理与优化方法。
> 技术细节与 git 操作教程见 **technical.md**。
> 本文档只保留仍需跟踪的未完成工作；已完成的历史记录已整理为 **`RELEASE_NOTES.md`**，不再保留在此文档中。

---

## 1. 执行优先级 / Priority queues ★

> **维护规则（永久有效，每次更新都要遵守）**：本节永远只保留两条队列的编号顺序 + 一句话摘要，不在这里展开方案——完整技术细节放在各自指向的章节（§3–§8）。任何一项做完就从队列里划掉；完整叙述转 `RELEASE_NOTES.md`，不留在本文档。

**当前状态**：v1.5「Fable 5 Max 五模块」（Arena Autopilot/Sectors/Signal/Leagues/后内存专题）**代码已全部完成并上线**，规格详见 **§7** 与 `RELEASE_NOTES.md`。历史完成事项（v1.4 收尾、V4/V6/V7/V13、D1–D5 审计等）已全部归档，见 `RELEASE_NOTES.md`。当前没有硬性时效截止在驱动排序（MSI/世界杯已转入自动化监控，FOMC 前 Signal 已就绪）——两条队列都按依赖顺序排列，做完一项直接接下一项。

想接着做时直接说编号（如「做 V9」），或说「查一下 V5 账本」看数据是否已攒够。

### 队列 A · 性能与工程优先级 / Engineering & performance queue

1. **S0** SEO Phase 0 快赢——**✅ 已完成（2026-07-05）**：7 页 canonical + og:url、index.html 的 WebSite/Person JSON-LD、serial.html 的 Book×2 JSON-LD、`public/404.html`、`vercel.json`（www→apex + /api noindex）、`npm run linkcheck`（linkinator）。Phase 1（CWV：字体/JS 分包/gtag 延迟）范围已重新评估，比原设想复杂，待排期，详见 §9。
2. **V12** 数据管线统一——**✅ 工程可做的部分已完成（2026-07-05）**：push-data.sh 通用脚本、溯源徽章（五页全部铺开）、命中率组件去重，详见 §7.5。Brier 分数与首页 Top10 vs SPY/SMH 记分需要新的数据管线（分别是"保留历史 confidence"和"从零建价格追踪"），不是现有数据能直接拼出来的，留待单独立项。6 个定时任务接 push-data.sh 站主决定跳过（读不到任务 prompt 全文，全文覆写风险大，且现状本就跑得好）。
3. **A2** main.js 继续拆分（Phase 3–5）——**Phase 3 ✅ 已完成（2026-07-05）**：7 页内联 `<style>` 全部搬到 `public/styles/<page>.css`（机械提取，已用 build diff 验证 CSS 内容逐字节不变）。**Phase 4 部分完成**：仅抽出 `cursor`（`src/ui/cursor.ts`，纯 DOM classList 包装，无游戏/战斗状态，6 处调用点全部迁移，build 后 grep 确认相关 class 字符串均在）；`state`（飞行阶段机）/`nav`/`boot` **未做**——这三块和 combat/render 主循环里几十个模块级可变变量（`escorts`/`weapons`/`halley`/`warpIntensity`…）深度纠缠，贸然拆分且无法真机验证的风险，等同于站上已吃过三次教训的 WebGL 改动（见 V15 记录），不在沙盒里强做。**Phase 5（styles.css `@layer` 分层）未做**：层级顺序即层叠优先级，7110 行里给错层会产生看不见的视觉回归，同样需要真机验证才能安全做。详见 §3。
4. **B1** CSS Scroll-Driven Animations——**✅ 已完成（2026-07-05）**：alphardForge 的 JS 手动 pin（scroll 监听 + classList 切换 `.pin-fixed`/`.pin-end`）替换为 `@supports (animation-timeline: view())` 下的原生 view-timeline + transform 动画，JS 端 feature-detect 后跳过旧逻辑；不支持的浏览器完整回退到原 JS 路径，两者不会同时生效。驱动 WebGL uniform 的 `--forge` 数值计算不受影响（CSS 无法驱动 Three.js，仍需 JS）。详见 §8.2。
5. **B6** 首页 WebGL 收尾——需真机 profiling，沙盒做不了，详见 §5「Home」。
6. **C4** TypeScript 渐进迁移——**试点已完成（2026-07-05）**：新增 `tsconfig.json`（strict、noEmit）+ `typescript` devDependency + `npm run typecheck`；A2 Phase 4 新抽出的 `src/ui/cursor.ts` 是第一个 `.ts` 模块，`tsc --noEmit` 通过。继续原则不变：随 A2/其余拆分顺路给新模块用 `.ts`，不单独立项、不回头改存量 `.js`。详见 §8.2。
7. **C3** three.js WebGPURenderer + Bloom/ACES——投入大，等有余力再评估，详见 §8.2。
8. **C5** Astro 迁移——**⚠️ 触发线已达标（2026-07-05，V20 观星台上线后全站 8 页）**。S0 Phase 0 已覆盖大部分静态 SEO 收益，且 V20 是纯客户端计算页（无 SEO 内容诉求），不构成额外紧迫性——但按既定规则，**下次再加任何新页前必须先做 Astro 迁移评估，不允许再往 MPA 上叠第 9 页**。详见 §8.2、§9。

### 队列 B · 功能性优先级 / Feature & product queue

1. **V18** 战斗视图「立体化」——代码全部完成，**待真人浏览器验收**（`?combatview=topdown&combatcam=director`），详见 `RELEASE_NOTES.md`。
2. **V19** Arena 自选股「预测差值」信号层——Phase 1（schema+回填管线）已完成攒数据中，详见 `RELEASE_NOTES.md`；Phase 2（校准）/ Phase 3（信号卡 UI）待数据攒够后再做，详见 §7.7。
3. **V20** 观星台（horoscope.html，八字×占星，Labs 第 4 页）——**代码全部完成（2026-07-05），待真人浏览器验收**（水墨观感/墨晕动效需过目），详见 `RELEASE_NOTES.md`；留存/病毒机制后续点子见 §5「Horoscope」。**注意：全站现已 8 页，队列 A 的 C5 Astro 触发线（≥8 页）已达标。**
4. ~~V9 → V10 → V11 Sectors 中美 AI 对比矩阵 + 后内存专题 + 定时任务~~ ✅ 已完成，详见 `RELEASE_NOTES.md`（数据仍是空种子，等下周日首次调度）。
4. **V21** 观星台「治愈系」大改版 + 运势娱乐功能矩阵（参照测测 App 立项，2026-07-06）——**Phase 0–6 全部完成 ✅（2026-07-06，详见 `RELEASE_NOTES.md`，视觉整体待真人浏览器验收）**。仅存后续决策项：行星星座（引星历库 vs 手写系数的取舍，见 §7.8.3 表注）、紫微辅星/四化，完整规格与分期见 **§7.8**。**注意 C5 约束：任何 Phase 若要开新页，必须先做 Astro 评估。**
5. **V2** Games 世界杯收官跟进——被动监控，决赛 7/19，赛程推进后补 `home/away/result` 即可。
6. **机会主义拾取**（无截止压力，不强制排期）：C1/C2 Signal 传导链可视化自动化（§6，暂不可行，卡点见 §6）> ~~B7 Games 夺冠之路树状图~~ / ~~B9 Odin 贴花~~ ✅ 均已完成，详见 `RELEASE_NOTES.md` > B3 combatHudSC 纵深透视（记录在案，不建议单独立项）。

---

## 2. 站点结构与各页身份 / Pages & identities

> **导航规则**：顶层导航只放长期核心页；季节性/实验性内容一律进 **Labs** 下拉分组——`src/lib/nav.js` 的 `SITE` 数组给条目打 `group:'labs'` 标记即可，下拉菜单与翻页循环顺序自动收纳，不用改渲染逻辑。
>
> **v1.5 进度（2026-07-05）**：Arena Autopilot 双轨模拟盘后端+前端全部上线（V3–V5，§7.1）；Sectors 中美 AI 对比矩阵 +「后内存时代」选股专题已全部实现，数据仍是空种子（V9–V11，§7.2）；Signal 已就地重构为 Warsh 时代内容并接入定时任务（V6/V7 已完成，§7.3）；**Labs 新增 Leagues 页**已上线（MSI 2026 限时竞猜，§7.4，7/12 决赛硬截止）。全站 AI 人设文案已随 V8 升级为「Fable 5 Max」（2026-07-04）。

| Page | File | 身份 / Identity | 主题 | 导航位置 |
| --- | --- | --- | --- | --- |
| Home | `index.html` + `src/` | 深空舰长日志 (Three.js) | Orbitron / 钢蓝 HUD | 顶层 |
| Arena | `arena.html` | **美股技术分析仪表盘（V13）+ Autopilot 双模型模拟盘（V5，2026-07-05 全部上线）**：自选股+搜索+盘前/盘后关键位面板，下接净值曲线/持仓/成交日志/复盘卡；旧 Human vs AI 对战区已正式下线（B10 已关闭，详见 `RELEASE_NOTES.md`） | Marathon · 霓虹绿/青 | 顶层 |
| Sectors | `sectors.html` | AI + 航天个股研判 ＋ v1.5 中美 AI 对比矩阵、「后内存时代」专题（已上线，数据待攒，§7.2） | 酸性绿 + 故障艺术 | 顶层 |
| Signal | `signal.html` | 美联储观察 = SCP O5 收容档案（板块研判：Fable 5 Max）；v1.5 已重构为 Warsh 时代内容（§7.3） | 机密文档 · 琥珀/绿 | 顶层 |
| Games | `games.html` | 世界杯限时竞猜 vs Fable 5 Max | 赛博朋克 · 品红/青 | **Labs** |
| Leagues | `league.html`（**V0/V1 已上线**） | 2026 MSI 电竞竞猜 vs Fable 5 Max（Fearless Draft 分析；赛后转战绩存档，§7.4） | 海克斯 · 金/蓝 | **Labs** |
| Horoscope | `horoscope.html`（**V20，2026-07-05 上线**） | 观星台：八字四柱（真干支历）× 西方占星——每日运程（事业/情缘/财帛/康健+宜忌+幸运物）、双人合盘（六合/三合/相冲+五行互补+星座三方）、URL 分享码、签到 streak；全本地计算零后端，仅供娱乐 | 天人合一 · 水墨松烟/宣纸/朱砂印（**V21 将全面改为治愈系暖奶油/鼠尾草绿/赤陶橙/淡金+植物插画，§7.8**） | **Labs** |
| Novels | `serial.html` | 小说连载书架：《万界种春》（无限流·种田）＋《长夜请柬》（无限流·悬疑推理）＋《玉熙宫词》（明穿权谋，连载中，目标150+章），书架切换 | 复古未来主义 · 铜/青（纯中文，护眼阅读，含夜间/豆沙绿/米黄三种阅读模式、自动翻页、书签、瀑布流、章节速览） | **Labs** |

**原则**：每页保留**独立的字体与美术身份**，但共享一套基础系统，避免重复造轮子。

**共享系统 / Shared systems**
- `page-turn.css` — 翻页箭头 + 自托管字体 + 全局按钮点击反馈（每页用 body class 切换箭头配色）+ Labs 下拉菜单结构样式。
- `src/lib/transition.js` — 进出页动画 + 音效；按目标页选择类型（warp / cannon / takeoff / control / cyber）。
- `src/lib/i18n.js` — 全局中英切换；任何带 `data-en` / `data-zh` 的元素自动翻译；右上角 `.lang-toggle`；切换时派发 `afflatus-lang` 事件供动态页面（arena/games/signal）重渲染。
- `src/lib/nav.js` — 唯一的 `SITE` 数组渲染导航 + 翻页 prev/next + Labs 下拉分组；下拉面板 portal 到 `<body>`（`position:fixed` + JS 用 `getBoundingClientRect()` 定位，`z-index:99000`），避免被各页自身的 clip-path/z-index 遮挡。
- `src/lib/clock.js` / `src/lib/audio.js` — 倒计时格式化、Web Audio 环境音共享库（arena/games/signal/transition.js 复用）。
- `src/ui/viz.js` — count-up 动画共享库（sectors.html/marketDeck.js 复用）。
- 数据文件：`arena-news.json`（每日定时任务）、`games-data.json`（手动更新）、`signal-events.json`（宏观事件档案，见 §6）、`novels-data.json`（章节内容）；**v1.5 规划新增**：`arena-ledger.json`（Autopilot 账本，V3）、`leagues-data.json`（MSI 竞猜，V0）、`sectors-data.json`（对比矩阵 + 后内存专题，V11）。
- `scripts/push-arena-news.sh` — cron 数据推送管线（写 JSON → 独立 stash/rebase/commit/push），已在用；V12 模板化为通用 `push-data.sh`。
- `prompts/` — v1.5 各模块定时任务提示词库（system/run 拆分 + JSON 输出 schema），规范见 `prompts/README.md` 与 §7.6。

---

## 3. 代码整理与优化方法 / Refactor & optimisation method

**现状痛点**
- `src/main.js` **~3525 行**、`src/styles.css` **7110 行**（2026-07-05 复核）——仍是单体文件；主线程渲染压力大：星空已移出主线程（Worker 化），combat、雷达、K 线仍在主线程 Canvas 2D 绘制。

**✅ Phase 3 已完成（2026-07-05）**：7 页（arena/sectors/signal/games/league/serial/horoscope）内联 `<style>` 全部搬到 `public/styles/<page>.css`，机械提取+build diff 验证内容不变。index.html 自己的 11 行内联块留着没动（太小，且它的主体样式本来就在 `src/styles.css` 里走 JS import，不构成"内联"问题）。

**⚠️ 待续 / 未开始**
- **拆 main.js（Phase 4，剩余部分）**：已抽出 `cursor`（`src/ui/cursor.ts`，见 §1 A2）。`state`（飞行状态机）/`nav`/`boot` 仍未做——这些和 combat/render 主循环共享几十个模块级可变变量，牵一发动全身，且沙盒无法真机验证 WebGL/canvas 视觉结果（同 V15/B6 的既定纪律），不建议在没有真人浏览器验收的情况下继续深挖，需要的话应该拆成能逐步真机验证的小步骤，而不是一次性大重构。
- **拆 styles.css（Phase 5）**：`@layer` 分层未开始——层级顺序=层叠优先级，7110 行里分层分错会产生视觉回归且沙盒看不出来，同样需要真机验证，暂不做。
- **IntersectionObserver**：首页背景 canvas 不可见时停止渲染——已核实为死代码需求，见 D3（`RELEASE_NOTES.md`）。main.js 继续拆分见 §1 A2。

---

## 4. 战斗视图工程 / Combat view engineering ★

**现状**：主战斗 HUD 默认使用 HMD v3（`src/ui/combatHmdV3.js` 的 `drawCleanCombatHmd`，贯穿起飞/降落/巡航/战斗全阶段）；SC 风格全息面板（`src/scene/combatHudSC.js`）保留为 `?combatview=sc` 可选皮肤；俯视战场（`src/scene/topdownCombat.js`）保留为 `?combatview=topdown` 战术地图可选皮肤。架构边界不变：`combatRuntime.js`（状态）→ 渲染层（纯函数）→ `#pilotFeed`。**V17（2026-07-05，详见 RELEASE_NOTES）**：`drawCockpitFrame` 已重写为 SC 双 MFD 控制台（旧三角舱盖支柱删除），带 `boot` 参数分阶段开机序列；各分支绘制顺序已修正为「星空→控制台→HMD」——**新增任何 pilot feed 图层时注意：`drawPilotSpace` 是近不透明的清屏层，画在它之前的东西只剩残影**。

美术基调不变：硬科幻、太空军事拟真（Star Citizen 系），**严禁卡通/街机/过度游戏化**。真 3D 相机导演系统（V14 镜头状态机 → V16 单时钟同步 → V15 Odin 舰体/战机保真度）已全部落地，历史决策过程与实施细节见 `RELEASE_NOTES.md`。

**⚠️ 命名冲突提醒（长期有效）**：`src/scene/cameraDirector.js` 这个文件名**已经被占用**（现有内容是起飞/降落的外部运镜 `drawExternalLaunch`/`drawExternalLanding`）。任何新的相机状态机需要另起文件名（已用 `weaponCameraDirector.js`），不要直接覆盖现有文件。

### V18 战斗视图「立体化」——代码已全部完成，待真人浏览器验收

三个 Phase（追击相机+模型换装、空间深度四件套、环境叙事层）代码全部完成，全程挂 `?combatcam=director`/`?combatview=topdown` 灰度，默认行为字节级不变。完整实施细节、逐条验证记录见 `RELEASE_NOTES.md`「V18」条目。**唯一悬而未决的是真人浏览器验收**——沙盒无法渲染 WebGL，这是 V15 三轮返工换来的纪律，「继续」不等于授权切生产默认路径。

### V14/V15/V16 相机导演系统 / Odin 舰体重建 / 武器单时钟——均已完成

V16（武器单时钟）→ V14（镜头状态机，五个预设：missileTail/ciwsTurret/mainGunAxis/bridgeWide/tacticalTopdown）→ V15（Odin 舰体重建+战机保真度+贴花收尾）按此依赖顺序全部落地。完整规格与实施记录见 `RELEASE_NOTES.md` 对应条目。

### 视觉验收清单（v1.5b 全部工作共用）

- **风格红线**（硬科幻/太空军事拟真）：高饱和纯色只允许出现在小面积告警与推进器辉光；所有运动必须有质量感（加减速曲线，禁线性 tween）；镜头永不瞬移（切换必有 ≤0.5s 位姿插值或 whip-flash 转场语言）；每个发光特效都能说出光源是什么；文字一律用现有 HUD 字体体系。
- **性能红线**：新增视觉不允许出现独立 rAF 循环（全部挂进现有主循环）；实例化资产（尾焰彩带/greeble/粒子）每类 ≤1 draw call；粒子全部对象池化；全息舰 ≤50k 三角面、单架战机 ≤8k。
- **可达性**：`prefers-reduced-motion` 下镜头固定为 bridgeWide、禁抖动禁慢放；移动端（<560px）关镜头震动、尘埃参照层密度减半。

**记录在案，不建议单独立项（队列 B B3）**：`combatHudSC` 机库跑道纵深透视——起降走 `drawPilotDeck` 另一条渲染路径，`combatHudSC` 从未在起降时被调用，要做透视意味着把它接入起降路径，是比数据绑定修复大得多的独立工作。

---

## 5. 各页设计备忘 & 未来点子 / Per-page notes & ideas

- **Home**（队列 A B6，首页 WebGL 收尾，需真机 profiling，沙盒做不了）：`saturnRenderer` 等 raw-GL 渲染器补完整的 context-restored 重建（目前仅 `preventDefault` 保活，没有真正重建资源）；跃迁点 shader 加弱机自适应（降 fbm 八度或分辨率）；统一所有渲染器的 `powerPreference` 与 dpr 上限到一处常量（目前 1.75 vs 1.5 不一致）。
- **Arena**：**V13 美股技术分析仪表盘 + V5 Autopilot 双模型模拟盘全部上线（2026-07-05，详见 `RELEASE_NOTES.md`）**——旧 Human vs AI 对战区已正式下线（B10 已关闭）。原有点子保留（B7）：「模型 vs 你」历史胜率曲线；接 Twelve Data 后把 W/M/6M/Y/5Y 徽标改 `REAL`。
- **Sectors**：**v1.5 → 中美 AI 对比矩阵 + 后内存专题 ✅ 已完成（V9–V11，§7.2，数据待攒）**；「研判与 Arena 预测打通」并入 V12 评估。
- **Signal**：**v1.5 → Warsh 时代重构已完成（V6–V7，§7.3，详见 `RELEASE_NOTES.md`）**；其余见 **§6**。
- **Games**：世界杯收官跟进已排入 **V2（P0）**——淘汰赛对阵确定后补 `home/away/result`（决赛 7/19）；「夺冠之路」树状图已实现（B7，✅ 完成，详见 `RELEASE_NOTES.md`）。
- **Leagues**（v1.5 新页，V0–V1）：MSI 2026 限时竞猜，7/12 决赛硬截止；赛后转战绩存档。规格见 **§7.4**。
- **Horoscope**（V20 上线 2026-07-05；V20.8 生辰详批扩展 2026-07-06，详见 `RELEASE_NOTES.md`）：已实现每日运程（真干支历驱动）/双人合盘/URL 分享码/签到 streak/子平法生辰详批（十神/藏干/纳音/空亡/十二长生/21神煞/刑冲合害/简化身强身弱）。**下一步全部收拢进 §7.8「V21 治愈系改版 + 运势娱乐矩阵」**（含旧 v2 点子里仍然有效的分享卡图片/生肖流年，已并入对应 Phase）。旧点子里**明确不做**的：Web Push 每日提醒（L 成本，DAU 未证明）。**红线不变**：永远「仅供娱乐」，不做付费解锁/焦虑营销（"今日大凶点击化解""前任会想我吗"这类黑模式一律禁止——测测 App 里这类钩子不搬）；康健域只说作息不说病。
- **Novels**：暂无额外待办；Astro 阈值见 C5——**V20 上线后全站 8 页，触发线已达标，加第 9 页前必须先做 Astro 评估**。

---

## 6. Signal 专项：美联储观察站 / Fed-watch station ★

> **页面使命**：捕捉美联储日常政策变化与言论对美股波动的影响，是"事件 → 利率路径重定价 → 美股/板块反应"的传导链档案馆，非新闻站。

**当前状态**：事件档案化机制已上线，倒计时 `NEXT CONTAINMENT TEST`（FOMC + CPI + NFP 混排，取最近目标日期），数据源 `public/signal-events.json`（新增事件只需追加记录）。

**⚠️ 传导链可视化（部分已被 v1.5 吸收）**
- **BREACH METER**：事件前/后的降息-加息概率位移横条，位移幅度自动映射 SCP 收容等级（目前 `class` 字段人工评定）——仍待做，见 §1 C1。
- **鹰鸽罗盘**：已被 **V6/V7**（Warsh 时代重构，见 §7.3）吸收首版（人工打分先行）。
- **事件回放迷你图**：SPX 发布前后 ±2h 的 5 分钟 sparkline——仍待做，见 §1 C1。

**⚠️ 自动化与联动（部分已被 v1.5 吸收）**
- 定时任务自动生成事件档案草稿：已被 **V7**（见 §7.3）吸收。
- 与 Arena/Sectors 打通、FedWatch 概率自动刷新（若有数据源）——仍待做，见 §1 C2。

**设计原则**（沿用）：SCP 皮肤只做叙事包装，数据本体必须真实、注明日期与来源；所有研判标注 "not advice"；中英文案成对。

---

## 7. v1.5 五大模块规格 / v1.5 module specs ★

> 源头是站主的「Fable 5 Max 核心系统架构」规划报告；本节是评审后的**落地版**——保留报告的全部核心意图（双轨模拟盘、时间窗口批处理、五维信号矩阵、Fearless Draft 分析、后内存三主线），修正三处结构性问题（① LLM 伪高频、② 缺状态持久化设计、③ 日度年化对比无统计意义），补齐调度/预算/风控的工程细节。
>
> **事实纪律（贯穿全部模块）**：报告里的具体事实性内容（模型参数、赛果、公司财务数据等）**一律不写进本文档**——那些是运行时内容，由定时任务在生成当天用检索/注入数据核实后写进各数据 JSON。提示词层面强制「只允许引用 payload 注入的数据，禁止凭训练记忆报事实」（见 `prompts/README.md`）。两个影响排期的时效事实：MSI 2026 大田 6/28–7/12（决赛 7/12）；Kevin Warsh 5/13 参院确认、5/22 宣誓就任美联储主席。

### 7.0 结构决策：五模块 → 站点结构映射

| 报告模块 | 落点 | 理由 |
| --- | --- | --- |
| Arena 双轨模拟盘 | `arena.html` 新增 AUTOPILOT 区块 | Arena 就是交易页身份，不裂页 |
| Sectors 中美 AI 对比 | `sectors.html` 新增对比矩阵区块 | 同上 |
| Signals（Warsh） | `signal.html` 就地内容重构 | 页面使命不变，换的是「馆藏」 |
| Leagues（MSI） | **新页 `league.html`，进 Labs** | 季节性限时内容，常设规则的标准适用场景 |
| 后内存时代选股库 | **不单开新页**，进 `sectors.html` 专题区块 | 核心投资内容而非实验性内容，不符合 Labs 定位；顶层导航保持克制。若专题日后长成独立身份再升格 |

### 7.1 Arena Autopilot（V3–V5）✅ 已完成并上线

代码/风控规则/账本 schema/前端全部完成，完整规格与实施记录详见 `RELEASE_NOTES.md`「Arena Autopilot」分组。

### 7.2 Sectors 扩展（V9–V11）✅ 已完成，数据仍是空种子

对比矩阵 + 后内存专题 + 定时任务全部完成，完整规格详见 `RELEASE_NOTES.md`「V9–V11」条目。**真实数据要等下周日首次调度触发才开始出现**。**集中度声明（持续有效的公开承诺）**：首页 Top 10 是单一主题（AI 硬件/内存墙）组合，不是分散配置，V12（队列 A）起对该组合相对 SPY/SMH 的表现做公开记分，包括错的时候。

### 7.3 Signal「Warsh 时代」重构（V6–V7）✅ 已完成

完整规格详见 `RELEASE_NOTES.md`「V6/V7」条目。

### 7.4 Leagues（V0–V1）✅ 已完成并上线

完整规格详见 `RELEASE_NOTES.md`「MSI 2026 Leagues」分组。

### 7.5 调度、token 预算与数据管线（V12 + 全模块共用）

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

所有任务入口先过**守卫**（周末/NYSE 假日/无比赛日直接 no-op），不产生任何 API 调用。冬令时切换（11 月）需整体校准一次调度时间。

**运行环境增补（2026-07-04 评审）**
- **launchd 优于 crontab**（macOS）：cron 在合盖睡眠期间错过的任务直接跳过；launchd 的 `StartCalendarInterval` 会在唤醒后补跑一次——对「笔记本合盖」场景这是本质区别，尤其 Arena 的 00:30/05:45 两个夜间窗口。迁移成本：每任务一个 plist + `launchctl load`（操作步骤记 technical.md §4）。
- **数据获取与 key 红线**：定时脚本优先走线上代理（`https://feida.au/api/quote` 等，免本地管 key）；必须直连的（新闻检索等），key 一律放 `~/.config/afflatus/env`（仓库外，脚本 `source` 读取）——**scripts/ 目录现已进 git 跟踪，任何脚本里不允许再出现明文 key**（此前泄露过一次）。指标计算（均线/RSI/涨跌幅）全部在脚本里用 Node 算完再注入，模型只收结果。
- **NYSE 假日守卫**：仓库放一份静态 `nyse-holidays-2026.json`（一年 10 个日期，每年更新一次），脚本启动先查表，不为这事调 API。
- **部署频率**：每次数据推送触发一次 Vercel 重建（约 1 分钟）；满负荷调度 ≈4–5 次/天，远低于配额，不用优化。若未来数据推送频率上一个量级，再评估数据与代码分仓。
- **推送脚本已知 bug（2026-07-04 已修复）**：旧版 `push-arena-news.sh` 的「stash --keep-index → rebase」组合**从未生效**——rebase 拒绝在暂存区有内容时运行，日志里每次都报 `cannot rebase`，只是因为本地恰好从未落后于远端才没出事；且 `git add dist/arena-news.json` 被 `.gitignore` 的 `dist` 规则挡掉，一直是无效操作。已改为「commit 先行 → `git pull --rebase --autostash` → push」的健壮序列。新管线脚本（V12）照此模式写，不要抄旧版。

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

**数据管线（V12，队列 A①）**
- ✅ **已完成**：`scripts/push-data.sh <file> <msg>` 通用推送脚本（从 `push-arena-news.sh` 模板化），供 ledger/leagues/sectors/signal/predlog 等定时任务复用；沙盒内用临时 git 仓库验证了缺参数/文件不存在/无变更/正常提交推送/远端领先需 rebase 五种场景，均行为正确。`push-arena-news.sh` 本体未改动（仍单独可用）。**站主决定不接入现有 6 个定时任务**（2026-07-05）：本会话读不到 `/Users/feida/Claude/Scheduled/*/SKILL.md`（不在已连接文件夹），全文覆写有删掉任务里其他指令的风险；且各任务现在跑得好好的，不接也不影响功能。脚本留给未来新建任务用。
- ✅ **已完成**：**溯源徽章** `src/lib/provenanceBadge.js`（纯函数：数据龄计算 + >36h 琥珀/>72h 红分级 + 双语文案，15 条 vitest），已铺开全部五页（sectors/arena 自选股+Autopilot/signal/games/league），每页复用自己现有调色板做分级色。`arena-news.json`（date/generatedAt，无 version）与 `games-data.json`（有 updated 无 version）两个文件 schema 跟其余三个不统一，组件做了适配层，未碰数据文件/定时任务。
- ✅ **已完成**：**命中率组件统一**——`src/lib/trackRecord.js`（games.js/league.js 原本是字节级重复的 renderRecord() 实现，抽取为共享纯函数 + 模板，10 条 vitest，含一条与抽取前模板逐字节比对的回归测试）。
- ⚠️ **卡住，未做**：**Brier 分数**——games/league 的 `record.log` 只存了 `ok`/`exact`，赛果确定后原始 confidence 就丢了，没有可评分的历史数据；要做的话需要改 2 个定时任务的 prompt（在赛果写回 log 时一并保留当时的 conf），且改完还要等新一批赛果真实结算才有数据可看，无法一次性做完。Signal 页目前完全没有战绩记录结构，做法需要另外设计。
- ⚠️ **卡住，未做**：**首页 Top 10 组合 vs SPY/SMH 记分**（§7.2 集中度声明的落地）——现在没有任何价格追踪管线或起始基准日，等于要从零建一条新的定时任务+数据文件，不是"接现有数据"的量级，需要单独立项讨论。
- 「Sectors 研判与 Arena 预测打通」并入本项一起评估——未开始。

### 7.6 提示词工程规范（全模块）

正式文本在 **`prompts/`**（README + 5 个模块文件），本文档只记五条硬规则：
1. **system/run 拆分**——角色、红线、输出 schema 进固定 system prompt（享受缓存）；账本状态与当日数据进 run payload。
2. **强制 JSON schema 输出**——机器段直接落盘进数据 JSON；展示段单独字段且限长。
3. **状态外置**——模型零会话记忆，账本/数据 JSON 是唯一事实源。
4. **事实纪律**——只允许引用 payload 注入的数据；禁止凭训练记忆报价格/新闻/模型参数；不确定必须标 `confidence` 并降权。
5. **长度硬上限**——复盘 ≤300 字、单条推理 ≤120 字，防 token 膨胀。

### 7.7 Arena 自选股「预测差值」信号层（V19，2026-07-05 站主立项）

**背景**：站主对现有自选股面板（V13 TA 仪表盘）的批评——数据太重、信息疲劳，只想看「预测差值」（AI 预测开/收盘价 vs 实际值的差距）本身。以下是评审后的落地方案，与站主原始设想有三处诚实修正。

**与站主原始设想的差异（评审结论）**
1. **「预测差值」需要先有预测数据，现在没有**——`arena-news.json` 的 `aiPredictions` 目前只有方向性字段（`direction`/`confidence`/`rationale`），没有 `predOpenPct`/`predClosePct` 这类价位级预测。Phase 1 必须先把 schema 扩到位、跑几天攒真实预测-实际配对数据，才能谈「差值」这个词——不能凭空设计一个还不存在的指标。
2. **没有真实训练基础设施，「持续学习」= 状态外置反馈，不是权重更新**——站上是静态站点 + 每次调用式 LLM，没有梯度/权重可言。沿用 Arena Autopilot 已验证的模式：每次预测调用把「自己过去的命中率/Brier 分数」注入下一次 prompt payload，模型据此自我校准措辞（而非数值权重）；只有当校准持续劣化时，才由人工触发 `promptVersion` 版本号 +1（同 §7.1 的赛季制）。
3. **「confident Buy/Sell」与全站「非投资建议」红线冲突**——不做二元买卖建议，改为三态信号 **LEAN LONG / NEUTRAL / LEAN SHORT**，且每个信号旁必须挂公开战绩（命中率 + Brier 分数），把「自信」的依据摆在台面上让读者自己判断，而不是站方替读者下结论。

**数据流**
```
盘前：aiPredictions[sym] 扩展 predOpenPct/predClosePct 字段（沿用 prompts/ 现有 Arena 提示词加两个输出字段）
  → 收盘后：新增定时任务（跑在 push-arena-news.sh 之后）用当日真实 O/C 回填「预测 vs 实际」配对，写入新文件 arena-predlog.json（滚动窗口，如近 60 个交易日）
  → src/lib/predCalibration.js（纯函数，vitest 覆盖）：从 arena-predlog.json 算每票的 hitRate（方向命中率）+ Brier 分数 + confidenceShrink（近期表现差的票种自动降权信心）
  → 校准结果注入下一次 prompt payload（同 §7.6 规则 3「状态外置」）
  → 持续 Brier 劣化 → 人工触发 promptVersion +1（同 §7.1 规则 10 赛季制）
```

**三态信号判定（代码层规则，模型只出原始 confidence，不直接输出信号态）**
- `calibConf = confidence × confidenceShrink(sym)`
- `calibConf ≥ 0.62` 且该票近 20 次 `hitRate ≥ 55%` → LEAN LONG（direction=UP）/ LEAN SHORT（direction=DOWN）
- 否则 → NEUTRAL
- 三态信号旁固定挂 `hitRate` + `Brier` 两个数字，不允许只显示信号态不带战绩——这是不越过「非投资建议」红线的硬约束。

**UI 两层结构**（替代当前默认展开的 V13 深度面板）
- **第一层（默认视图）**：`.wl-grid` 卡片网格，每票一张 `.wl-card`——ticker + 三态色块（绿/灰/红）+ 一行迷你差值 sparkline + hitRate/Brier 战绩角标。信息密度大幅降低，一屏看完全部候选池。
- **第二层（点击展开）**：现有 V13 TA 面板（K线/MA/MACD/KDJ 等）保持不变，作为「查看详情」的下钻内容，不重新设计。

**分期计划**
- **Phase 1（S）✅ 已实现（2026-07-05）**：`src/lib/predlogEntry.js`（`pctChange`/`directionHit`/`buildPredlogDay`/`appendPredlogDay`，16 条 vitest）+ `scripts/apply-arena-predlog.mjs`（纯计算 CLI，不做 git 操作）+ 种子文件 `public/arena-predlog.json`；定时任务 `ai-stock-arena-news-digest` 的 prompt 已加 `predOpenPct`/`predClosePct` 字段；新建定时任务 `arena-predlog-close-backfill`（`15 7 * * 2-6`，收盘后回填真实 O/C 到 `arena-predlog.json`）。已用合成数据端到端 smoke test 验证；真实数据要等两个定时任务各自的下一次执行才会开始攒。
- **Phase 2（S-M）**：`src/lib/predCalibration.js` 纯函数 + vitest；接入 prompt payload 反馈注入。等 `arena-predlog.json` 攒够几天真实数据后再做。
- **Phase 3（M）**：`.wl-grid`/`.wl-card` 信号卡 UI，替换默认展开面板，V13 面板降级为点击展开的第二层。

---

### 7.8 观星台 V21：治愈系改版 + 运势娱乐功能矩阵（2026-07-06 立项，参照测测 App）

> **立项背景**：站主对照测测 App 的运势/娱乐功能提出扩展清单 + 界面全面转向「治愈温暖」风格。以下是产品/设计/架构三视角评审后的落地版。

#### 7.8.0 功能搬运评审：搬什么、不搬什么

**值得搬（按「现有引擎复用度 × 分享传播价值 ÷ 工程成本」排序）**

| 功能 | 可行性 | 量级 | 结论 |
| --- | --- | --- | --- |
| 十神占比 | `ziping.js` 已有全部原料（藏干+十神），按本气/中气/余气加权求百分比即可 | XS | Phase 1 |
| 八字喜用深化 | V20.8 已有简化扶抑法，补「调候」提示（按月令寒热燥湿给次要建议）即可到测测展示深度 | S | Phase 1 |
| 神煞稀有度 | 测测没有的差异化点：脚本枚举 1950–2010 均匀出生样本，预计算每个神煞出现频率→常见/少见/罕见/稀有四档静态 JSON；页面挂「频率为出生样本估算」诚实标注 | S | Phase 1 |
| 大运流年 | 纯历法数学：阳男阴女顺排/阴女阳男逆排、出生到邻近节气的天数÷3=起运岁数、十年一柱+流年干支与命局的刑冲合害。**依赖：① 表单加性别字段（大运排向必需）；② `solarTermDate` 需扩展返回精确时刻（现在只到日）** | M | Phase 2 |
| 生肖流年 | 流年支 vs 年支/日支的合冲刑害 + 犯太岁判定，`ziping.js` 的关系引擎直接复用 | S | Phase 2（并入大运流年一起做） |
| 本命/值日星宿 + 双人星宿关系 | 值日宿=简单 28 日循环锚定；本命宿按宿曜经用农历月+日查表；双人关系（命业胎/栄親友衝安壊）是查表。**共同依赖：农历转换模块 `lunar.js`（用公域紧凑表 1900–2100，不自算朔望）** | M | Phase 3 |
| 十六型人格测试 | 纯前端问卷+计分+结果页，零后端。**法律红线：MBTI® 是注册商标——自编题库、品牌叫「十六型人格速测」、页脚声明与 Myers-Briggs 无关联** | M | Phase 4 |
| 个人星盘 + 双人合盘星盘 | Meeus 低精度行星黄经（日月+行星，~1° 精度对星座级展示足够）；宫位首版只做整宫制+上升星座（需出生地经纬度输入）；双人合盘=相位表（合/六合/刑/拱/冲，带容许度） | L | Phase 5 |
| 紫微斗数 | 确定性查表安星，可用真实命盘反推验证（同 V20.8 方法论）；依赖 Phase 3 的 `lunar.js` | XL | Phase 6（最后） |

**明确不搬（评审否决）**
- **付费解锁/会员**——违反站点「仅供娱乐」红线，且静态站无支付基础设施。
- **"前任会想我吗"式焦虑钩子、AI 追问付费问答**——黑模式，一律禁止（§5 红线原文保留）。
- **AI 聊天式解读**——静态站无后端，每次调用式 LLM 成本不可控；已有的 seeded 文案库路线（确定性、零 API 成本）继续。
- **Web Push 每日提醒**——旧 v2 点子④，L 成本 DAU 未证明，不做。

#### 7.8.1 Phase 0：治愈系视觉改版（先做，其余 Phase 都长在新皮肤上）

**设计方向**（站主定调：治愈温暖）：
- **配色 token**（`public/styles/horoscope.css` 的 `:root` 全量替换）：暖奶油底 `--cream:#F6EFE3` / 卡片 `#FFFBF2`、鼠尾草绿 `--sage:#9CAF88`（正向/宜）、赤陶橙 `--terra:#C96F4A`（强调/忌，替代现在的爱马仕橙）、淡金 `--gold-soft:#D9B87C`（分数/高亮）、暖墨 `--ink-warm:#4A453D`（正文，替代白字）。五行语义色（木火土金水）保留但整体降饱和向奶油底适配。
- **删除**（站主明确指示）：`.bg` 整套水墨夜空底板（星空/墨晕/星环）、`.bg-horse`/`.bg-dragon` 全页水印、`.hero-art` 龙马插画（V20.5–V20.7 的产物，一并移除，RELEASE_NOTES 里的记录保留作历史）。
- **新插画方向**：手绘植物线稿 SVG（鼠尾草枝/桉叶/小花角饰），角落点缀式而非全页水印；**沿用 V20.7 的教训：全部原创手绘，不贴任何第三方素材**；cairosvg 渲图自查后再上。
- **形态语言**：圆角卡片+柔和阴影替代现在的直角+金色边角刻线；保留 Noto Serif SC 字体身份；`prefers-reduced-motion` 纪律不变。
- **可达性硬指标**：奶油底上所有正文对比度 ≥ WCAG AA（4.5:1）——暖色浅底最容易翻车的就是这个，改版验收时逐色核对。
- **分享卡图片**（旧 v2 点子①并入本 Phase）：Canvas 生成治愈系配色的合盘/生辰分享卡，随新皮肤一起做，量级 M。

**范围边界**：只动 horoscope 页（§2 原则：每页独立美术身份）；nav/page-turn 共享件不动。

#### 7.8.2 架构决策（贯穿全部 Phase）

- **页面承载 vs C5 红线**：全站已 8 页，**C5 规定加第 9 页前必须先做 Astro 评估**。默认策略：Phase 1–3、5–6 全部作为 horoscope.html 页内分区/标签页扩展（不加页）；**Phase 4（人格测试）内容身份独立、最适合单开页——届时必须先走 C5 评估，不允许直接加第 9 页**。若 horoscope.html 单页膨胀到不可维护，同样触发 C5。
- **模块划分**（延续 bazi.js/ziping.js 的纯函数+vitest 纪律）：`dayun.js`（大运流年）、`lunar.js`（农历转换，星宿+紫微共用依赖）、`xiu.js`（28 星宿）、`planets.js`（行星黄经）、`ziwei.js`（紫微安星）、`persona-questions.json`（题库静态数据）。每个模块落地前先找真实参考盘（同 V20.8 的反推验证方法论——用户提供的测测截图或其他专业排盘的公开输出当已知答案）。
- **神煞稀有度预计算**：`scripts/gen-shensha-rarity.mjs` 一次性跑，产物 `public/shensha-rarity.json` 进 git；不在浏览器里实时枚举。
- **表单扩展**：性别（大运必需）、出生地经纬度（星盘宫位必需，Phase 5 前不加）——每加一个字段都动 `encodeShare`/`decodeShare` 的分享码 schema，需带版本位向后兼容旧链接。

#### 7.8.3 分期总表

| Phase | 内容 | 量级 | 验收标准 |
| --- | --- | --- | --- |
| 0 ✅ | 治愈系配色+植物插画+删旧美术+分享卡（2026-07-06 完成，详见 RELEASE_NOTES） | M | 对比度 AA 全过 ✅；cairosvg 自查 ✅；**真人浏览器过目待做** |
| 1 ✅ | 十神占比、调候提示、神煞稀有度（2026-07-06 完成，详见 RELEASE_NOTES） | S | 占比总和=1+参考盘份额断言 ✅；稀有度生成脚本可复现+魁罡频率对照理论值 ✅ |
| 2 ✅ | 大运流年+犯太岁+性别字段（2026-07-06 完成，详见 RELEASE_NOTES） | M | 规则级不变量测试 ✅（无参考盘可对照，已如实记录）；性别不进分享码，兼容问题整体规避 ✅ |
| 3 ✅ | lunar.js+星宿（本命/值日/双人）（2026-07-06 完成，详见 RELEASE_NOTES） | M | 农历 10,815 天对照独立实现零不一致 ✅；值日宿 2000 天对照+星期锁 ✅；本命宿表无独立源可对照（已如实标注） |
| 4 ✅ | 十六型人格速测（2026-07-06 完成；C5 评估结论：页内分区不开新页） | M | 计分确定性 vitest ✅；商标免责声明在页 ✅ |
| 5 ✅ | 日月升星盘+双人日月相位（2026-07-06 完成；**行星明确缓做**：VSOP87 表无法凭记忆安全手打、星历库+350KB，留待决策） | L→M | 月亮级数用已验证农历表做物理对照（初一距角穿零）✅；上升双不变量 ✅ |
| 6 ✅ | 紫微斗数入门版（十二宫+十四主星；辅星/四化留待后续）（2026-07-06 完成） | XL→M | 与独立紫微库 iztro 对照 400 盘全对 ✅ |

---

## 8. 架构演进与下一代视觉 / Architecture evolution & next-gen visuals ★

> 站点持续加页（novels.html 已上线，之后更多）。结论：**不需要换语言、不需要上 React**——瓶颈在 (a) 多页手工维护成本 (b) 主线程渲染压力 (c) 缺乏 GPU 后期处理。

### 8.1 现有架构的真实问题（按痛感排序）

1. **单体文件**——`main.js` 3483 行 / `styles.css` 7091 行（2026-07-05 复核），仍需继续拆分。
2. **重复的页面骨架**——nav 已统一，但 `<head>` meta / 字体加载顺序仍每页复制。
3. **主线程全包**——combat、雷达、K 线仍在主线程 Canvas 2D；星空已移出。
4. **多页跳转是整页刷新**——`transition.js` 掩盖白屏，本质仍丢弃状态重载；原生跨文档过渡已作为补充层加入。

### 8.2 技术选型建议

**已采用**（不再需要评估）：Vite MPA 多入口、View Transitions API（跨文档，与 `transition.js` 共存不叠加）、OffscreenCanvas + Worker（目前只做了首页星空，combat/雷达/K 线仍在主线程）、CSS Scroll-Driven Animations（B1，2026-07-05，目前只用在 alphardForge 的 pin，`@supports` 渐进增强+JS 回退，见 §1）。

**待评估 / 值得做**

| 技术 | 解决什么 | 成本 |
| --- | --- | --- |
| **three.js WebGPURenderer + TSL** | compute shader 粒子（百万级星涡/爆炸碎片）+ 更低 draw call 开销 | 中-高 |
| **Bloom/HDR 后期处理** | `UnrealBloomPass` + ACES tone mapping，真实辉光替代 radial-gradient 假光晕 | 中 |
| **TypeScript（渐进）** | 拆 main.js 时新模块直接 `.ts`——试点已完成（`src/ui/cursor.ts` + `tsconfig.json` + `npm run typecheck`，见 §1 C4） | 低（增量） |
| **Astro（触发式）** | 页面 ≥8 或 novels 章节 ≥20 时迁移，当前未到阈值 | 高（迁移） |

**❌ 不要做**：React/Vue/Svelte 重写、Rust/WASM、全站 WebGPU-only、SSR/后端框架——站点是 canvas 动画 + 静态内容，加框架/后端只会增加体积与运维成本而无实际收益。

### 8.3 落地顺序

1. **短期**：~~scroll-driven animations 替换 alphardForge 的 JS pin 逻辑~~ ✅ 已完成（B1）；main.js 拆分继续（§1 A2）；新模块用 TS。
2. **中期**：three.js WebGPURenderer 试点跃迁点星涡（compute 粒子 + bloom），A/B 对比帧率后再推广。
3. **触发式**：页面/章节数量到阈值 → Astro 迁移。

**衡量标准**：Chrome DevTools Performance——主线程帧时间目标 <8ms、合成器帧率目标 120fps、子页 LCP <1.5s。

---

## 9. SEO 与个人品牌工程 / SEO & personal-brand engineering ★

> 站主定位：US 个股仓位/研判 desk view + AI 竞猜实验 + 原创小说，读者群体分裂（美股读者 vs 小说读者），domain authority 从 0 起步。目标不是流量最大化，而是**让搜索引擎正确理解站点结构、内容可信度可被验证**。

### Phase 0（S，无风险纯增量）✅ 已完成（2026-07-05）

- 全站 7 页加 `<link rel="canonical">` + `<meta property="og:url">`（此前审计确认为 0）。
- `index.html`：`WebSite` + `Person`（`name:"Feida Wang"`, `alternateName:"Bruce"`——沿用站内已公开的真实署名，未编造 `jobTitle`/`sameAs` 等未知字段）JSON-LD。
- `serial.html`：两本小说的 `Book` JSON-LD（书名/作者笔名"槐酿"/简介/类型标签，均为页面已公开数据）。
- `public/404.html`：静态兜底页，`noindex`，配色沿用首页基调。
- `vercel.json`：新建——`www.feida.au` → apex 301（防子域名重复内容，域名是否已配置 www 未知，规则无副作用）；`/api/*` 加 `X-Robots-Tag: noindex`（两个纯 JSON 代理端点，无需被索引）。
- `npm run linkcheck`：新增（`linkinator` + `vite build`），本地手动跑，检查内部相对链接/资源路径/第三方外链；`feida.au` 自身域名已加入 skip 名单（沙盒网络对生产域名请求会被拦截返回假 403，不代表真实死链，需在真机或部署后环境验证真实死链）。
- **审计过程中确认无需动的项**：`public/robots.txt`、`public/sitemap.xml`（覆盖全部 7 页）**已存在且正确**，此前的审计遗漏了这两个文件。
- **审计中发现的未修复小缺口**：`sectors.html` 唯独缺 `<link rel="icon">`（其余 6 页都有）——不在本次 SEO 改动范围内，记录于此，需要时单独修一行。

### Phase 1（2026-07-05 评估 + 部分落地）

原计划「统一自托管字体去重 Google Fonts」的前提有误——**7 页字体并非重复加载同一套**，而是每页有各自独立的字体身份（如 arena=Orbitron/Rajdhani，league=Cinzel/Spectral/Noto Serif SC 等 6 种字体，signal=Oswald/Space Mono……），只有 `page-turn.css` 里自托管的 Marathon Shapiro/PP Fraktion Mono/KH Interference 是另一套无关的自定义字体栈。真要自托管每页专属 Google Fonts 组合，需要逐页找对应 `.woff2` 授权文件、核实字重范围，工作量和风险比「去重」大得多，**仍未排期**。

- ✅ **已完成**：**gtag 延迟到空闲**（全站 8 页）——`<script async src=googletagmanager...>` + 内联 `gtag('config',...)` 改为包在 `requestIdleCallback`（无该 API 的浏览器 `setTimeout` 2s 兜底，超时兜底 3s）里的函数，浏览器汇报空闲后才发起 gtag.js 请求+初始化，不再和首屏渲染抢主线程。**已知取舍**：把"记录 pageview"从"立即"推迟到最多 ~2–3 秒后，理论上有极小概率漏记"打开后 2 秒内就跳走"的这批访客——对没有广告/转化归因诉求的个人博客可接受，未额外征询站主确认就直接做了，如果分析数据的完整性比这点性能收益更重要，随时可以改回同步加载。
- ❌ **评估后判定不值得做**：`<link rel="preload" as="style">` 包 Google Fonts CSS——现有写法（`preconnect` + 紧跟其后的 `<link rel="stylesheet">`）本来就在 `<head>` 顶部被浏览器的预加载扫描器早早发现，字体 CSS 已经是最高优先级的阻塞资源；再加一个指向同一 URL 的 `preload` 不会让它更早被发现，等于重复请求同一优先级的资源，是常见的「伪优化」反模式。没有照抄这一条。
- ⚠️ **评估后判定风险过高，未做**：`main.js` 869KB 主 chunk 动态 import 拆分——查证过 three.js 本体已经不在这条链路上（只有已懒加载的 `capitalShip3D.js`/`fighter3D.js`/`topdownCombat.js` 才会拉 three.js），869KB 的重量来自 `combatRuntime`/`combatHudSC`/`combatCine`/`hmdMinimal`/`combatHmdV3`/`combatView`/`battleFeed`/`radarDeck` 等一批**目前都是同步 import**、且被主渲染循环 `frame()` 每帧直接调用的模块。这批模块理论上可以等首次战斗触发（彗星生成 7 秒延迟或点击 Command 按钮）后再动态加载，但把同步调用改成异步加载意味着要在渲染循环里处理"模块还没到"的过渡状态——和 A2 Phase 4 的 `state`/`nav`/`boot` 是同一类风险（深度耦合 combat/render 主循环，沙盒无法真机验证 WebGL/canvas 结果），不在没有真人浏览器验收的情况下强做。

### Phase 2（M-L，触发式）

SSG/SSR（Astro）迁移——已并入 §1 C5 的触发条件，不单独立项。触发时机：页面数/章节数到阈值，**或** Phase 0+1 做完后仍有 SEO 硬瓶颈（如需要服务端渲染的结构化数据/动态 OG 图）时提前触发。

### Phase 3（个人品牌工程，未排期）

`Person` JSON-LD 目前只有 `name`/`alternateName`/`url`，`jobTitle`/`sameAs`（社交/职业主页）等字段需要站主提供真实信息，**未编造**——如需加强 E-E-A-T 信号可后续补充。独立 `/about` 页面（个人履历、免责声明整合）暂未排期。

---

*Desk view only · not investment / betting advice. 仅为台面观点，非投资或博彩建议。*
