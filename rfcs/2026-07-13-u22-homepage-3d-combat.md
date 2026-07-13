# U22 · 太空战斗视觉宪章 + 3D 技术栈裁决（2026-07-13）

> 角色：Lead 3D/Combat UX Designer。对象：feida.au 首页战斗视觉与全站 UIUX。
> 纪律：沙盒不能渲染 WebGL/HUD 画面，本文的六条宪章打分是**代码审计代理值**（数装饰元素、数渲染器实例、数颜色 token 归属），不是真机视觉判断。**RFC 先行，动码另起**（Phase 1/3 既定流程，见 Urgent.md U21）。
> 前提：U21 Phase 1 已裁决不迁框架、three.js 不无故升级；U21 Phase 3 RFC 已产出 tokens/对比度/克制审计，本文不重复其结论，只在与「太空战斗」直接相关处引用。

## 0. 六条宪章打分（代码审计代理值）

| 宪章 | 满分 | 代理估分 | 依据 |
| --- | --- | --- | --- |
| ① 每个 UI 元素是一台舰载设备 | 20 | **15** | U8/U14 已系统性做减法（chip stacks/OBJECTIVE 面板/四象限格已删，冷却改成物理能量条），方向对；未完成项是 U14d 的终端展示层仍待迁入 Combat View、U14b 座舱静态装饰（OUTPUT/RADR/PROX/HIT）待清 |
| ② 每个读数绑一个真实状态 | 20 | **12** | U14e 已明确点名「所有屏上数字必须动」为未完成项；本次复核确认 `drawGauge` 三只表盘（IAS/CORE/ATT）中 CORE 是 `Math.sin` 摆动装饰值、ATT 同款，THR/PWR 尚无能量格；已完成的诚实标注（`weaponCooldownRatio`/`halley.hp` 等真实绑定）是加分项但覆盖不全 |
| ③ 运动即信息，无信息不运动 | 20 | **16** | `topdownCombat.js` 的 InstancedMesh 尾迹彩带 + 尘埃拉伸（V18 Phase 2）是这条宪章的教科书级实现——但**只在 `?combatview=topdown` 参数开启时才渲染**，默认访客看不到，见 §1.3 |
| ④ 剪影先于细节 | 15 | **8**（估计值，无法真机验证） | 全仓库零处 `LOD`/`THREE.LOD` 用法（见 §1.2），没有任何「涂黑看轮廓」的验收机制存在；程序化建模（carrierHull/odinHull/fighter3D）几何本身是否剪影可读需要真机截图判断，本次代码审计给不出真实分 |
| ⑤ 双色温纪律 | 15 | **15**（满分） | 核心 token `--cyan`（世界/数据）与 `--warm`（自身/警示）二分从 U21 Phase3 RFC 起已确认合规；本次新查 `.weapon-choice[data-weapon]` 四色体系（cannon 青/missile 琥珀/nuke 红/enforcer 品红）与宪章「武器四色为唯一例外域」逐字匹配，无需改动 |
| ⑥ 渐进披露，默认一层展开两层 | 10 | **6** | PWR/WPN/THR 三 chip（U14c 已立项加能量格）与武器插槽的「图标+一数字，展开见详情」结构基本成立；扣分项是座舱装饰数字（§1.1）违反「无信息不展开」——它们不是第二层，是**假装存在的第零层** |
| **合计** | **100** | **72** | 供参考基线，非通过/不通过判定——U22 没有像 Phase3 那样自定门槛分，本表的价值是**指出哪条宪章还欠账最多**（②>④>⑥），作为 §4 裁决表的优先级排序依据 |

## 1. 证据明细

### 1.1 座舱静态装饰清单（对应 U14b，本次代码复核确认仍未清）

`src/ui/combatHmdV3.js` 的 `drawCockpitFrame` 仍在绘制：底部 `OUTPUT 5/16` + battery MFD 块、其旁小圆雷达装饰、两侧 `≋2.8K 294.1 ⚡8.9K 0.0 ◇5.9K 0.0` 成排装饰数字、右下 `RADR`/`PROX`/`HIT` 三枚 chip——这些都是**固定字符串或与真实状态无关的摆动值**，直接违反宪章①②。U14b 已经点了名，本次审计只是确认代码现状与 U14b 立项描述一致，未发生新漂移。

### 1.2 3D 渲染现状：五个独立 WebGLRenderer，零 LOD，DPR 策略不统一

```
WebGLRenderer 实例点（grep 实证）：
├─ shipHologram.js    — 终端登录全息舰船，懒加载（terminalStarMap.js 动态 import）
├─ topdownCombat.js   — 俯视战斗场景，懒加载 + query flag 门控（见 §1.3）
├─ capitalShip3D.js   — 懒加载（main.js:63 动态 import）
├─ fighter3D.js       — 懒加载（main.js:75 动态 import）
└─ alphardForge.js    — 首页 stardrive 段，**默认即时加载**，唯一常驻 WebGL 场景

DPR 封顶策略（五处互不一致）：
├─ fighter3D:      setPixelRatio(1)          — 固定 1x
├─ topdownCombat:  min(1.75, devicePixelRatio) — 固定上限 1.75
├─ capitalShip3D:  min(devicePixelRatio, 1.75) — 同上限，写法不同
├─ alphardForge:   min(2, devicePixelRatio)    — 固定上限 2
└─ (对比) backgroundScene.js 的三个 2D canvas：
   computeDpr() = sqrt(BUDGET_PX / 视口面积)，budget-based 动态封顶——
   比上面四处的硬编码上限更精细，是全仓库里最好的 DPR 方案，但只用在
   非 WebGL 的背景画布上，没有推广到任何一个 WebGLRenderer
```

零处 `LOD`/`THREE.LOD`：任何模型在任意距离都以同一细节级别渲染，22b 表格的「LOD 三档」是真空白，不是需要升级的现有方案。`InstancedMesh` 仅 `topdownCombat.js` 一处使用（V18 引擎尾焰彩带 + 尘埃粒子，各 1 次 draw call，实现质量高，见 RELEASE_NOTES 相关条目）。

### 1.3 关键事实：首页默认战斗视图是 Canvas 2D，不是 3D

`src/main.js:3281` 确认默认 `pilotFeed` 画布走 `combatHmdV3.drawCleanCombatHmd(ctx,...)`——**纯 Canvas 2D 绘制**，是 U8 减法改造后的青白 SC 风 HUD。真正的 3D 俯视战场 `topdownCombat.js` 只在同时满足 `?combatview=topdown` **且** `?combatcam=director` 两个 query flag 时才渲染（`main.js:3204`），普通访客默认路径完全看不到它。

**这是本 RFC 最重要的单条事实**：站主要求「首页尽可能接近 3D 网页游戏的战斗效果」，代码层面的答案不是「调参数」，而是一个**范围决策**——要不要把默认 Combat View 从 Canvas2D HUD 换成 3D 场景（或叠加）。这个决策的性能代价（首屏多一个 WebGLRenderer 常驻、多一组 InstancedMesh 更新）必须先有 Phase 2 真机 Lighthouse/CrUX 基线才能评估是否可负担，不能在本 RFC 里拍板（S4 红线：验证要客观）。

### 1.4 已验证的正面资产（不是从零开始）

- **Bloom/ACES 管线已在生产验证**：`alphardForge.js` 用 `EffectComposer`+`RenderPass`+`UnrealBloomPass`+`ShaderPass`（色差/胶片颗粒）跑在首页常驻场景里，`composer.setPixelRatio`/`setSize` 与 renderer 同步维护，是一套完整可用的后处理管线——22b 表格里「评估 bloom/ACES」应改写为「**复用现有管线，接入战斗场景**」，不是从零技术选型。
- **OffscreenCanvas+Worker 已在生产验证**：`backgroundScene.js` 的星空/黑洞/事件层三个 2D 画布已经跑在 Worker 里，budget-based DPR 是全仓库最成熟的性能方案——22b 表格里「评估 OffscreenCanvas+Worker」同样应改写为「**推广现有模式到 WebGL 场景**」。
- **武器四色体系**（§0 宪章⑤）与**InstancedMesh 尾迹/尘埃系统**（§0 宪章③）都是可直接复用的现成实现，不需要重做。

## 2. 22b 技术栈裁决表（复核后更新版，替换 Urgent.md 原表）

| 层 | 原裁决 | 复核后现状 | 更新裁决 |
| --- | --- | --- | --- |
| 渲染器 | 保持 THREE.js，评估 WebGPU 双路径 | 现有 5 个独立 WebGLRenderer，DPR 策略四套不统一 | **先统一 DPR 策略**（对齐 backgroundScene 的 budget-based 方案）与 renderer 创建参数，WebGPU 双路径维持「Phase 2 基线后再评」不升级 |
| 后处理 | bloom+ACES，桌面开移动关 | **已有生产可用管线**（alphardForge），战斗场景仍是「cheap fake-bloom」占位 | 改写为「把 alphardForge 的 EffectComposer 管线抽成可复用工厂函数，接入 topdownCombat」，工作量从「新增」降级为「复用」 |
| 资产管线 | glTF+Draco+KTX2+LOD 三档 | 全部程序化建模，零 LOD | 维持「新增复杂模型才引入」，**但 LOD 三档本身（哪怕用于程序化模型的距离降细节）值得单独立项**，因为剪影可读性（宪章④）无法打分正是缺了这个机制 |
| 特效 | InstancedMesh 粒子 + shader 星云 | InstancedMesh 已验证，shader 星云背景板未做 | 维持原裁决 |
| 线程 | 评估 OffscreenCanvas+Worker | **已在生产验证**（backgroundScene 三画布） | 改写为「评估把 WebGL 战斗场景的更新计算（非渲染本身，WebGL 不能跨线程渲染）搬进 Worker，走已验证的消息传递模式」 |
| 帧率预算 | 桌面 60fps/移动 40fps 地板 | 无实测数据 | 维持，**是 Phase 2 的第一优先测量项** |
| 现代 CSS | scroll-driven animations / View Transitions / container queries | 未使用 | 维持，与 U21 Phase 3 的 `@layer tokens` 工作可并行，不冲突 |

**核心结论**：22b 原表把多数项写成「评估/引入」，实际审计后至少三项（bloom 管线、Worker 模式、InstancedMesh）是「复用已验证资产」而非「新技术选型」——这意味着首页 3D 战斗升级的**技术风险比立项时预估的低**，真正的缺口是①默认视图仍是 2D（§1.3 的范围决策）②DPR/渲染器创建参数不统一（低风险，可现在做）③零 LOD（中风险，需要设计验收标准）。

## 3. 22c 跨页 UIUX 准则：与 U21 Phase 3 的关系

22c 提出的「统一舰桥外壳/数据直观性/精简代长文/移动可用性/反馈完整性」五条，与 U21 Phase 3 RFC 的 tokens/对比度/触控目标/focus-visible 工作**同源不重复**——Phase 3 RFC 已经审计出的具体缺口（`--dim` 对比度 4.32:1 不达标、2 处触控目标 <44px、全站仅 4 处焦点样式）就是 22c 准则的量化证据。本 RFC 不重新审计，建议：**22c 的五条准则作为验收标准并入 U21 Phase 3 的实施清单**，不单独开工，避免同一套 tokens 改两次。

22c 新增、Phase 3 未覆盖的部分：「数据直观性」（卡片+sparkline+对比锚点）与「精简代长文」（结论行+展开）是内容呈现层面的工作，不是 tokens 层面——这部分需要逐页审计（arena/sectors/stats 数字展示、horoscope/serial 长文本折叠），属于新范围，建议作为 **U21 Phase 3 之后的 Phase 4** 或独立小项，不塞进当前 Phase 3 的 tokens 工作里增加其风险面。

## 4. 裁决汇总

| 决定 | 内容 |
| --- | --- |
| **可代码验证、下一会话可直接做** | DPR 策略统一（对齐 backgroundScene 的 budget-based 方案，改 4 处硬编码封顶）；`drawCockpitFrame` 座舱静态装饰清理（U14b 原定范围，本次确认无新漂移，可直接执行）；PWR/WPN/THR 能量格真实数据绑定（U14c 原定范围） |
| **中风险、需设计验收标准但不依赖真机基线** | LOD 三档机制设计（先定「剪影可读」的验收标准——如涂黑截图人工判断——再写代码，标准本身可以现在定） |
| **需要 Phase 2 真机 Lighthouse/CrUX 基线才能裁决** | 首页默认 Combat View 是否从 Canvas2D 换成/叠加 3D 场景（§1.3 核心决策）；bloom 管线接入战斗场景的移动端性能代价；WebGPU 双路径 |
| **需要站主逐条判断，不代为决定** | 22a 六条宪章的具体验收权重（本文 §0 打分仅供参考，不是最终裁决）；22c「数据直观性/精简代长文」是否现在做还是等 Phase 3 之后 |
| **不做** | 引入数据库/框架迁移（U21 Phase 1 已裁决维持）；three.js 版本升级（无 breaking 需求不动）；WebGPU 立即切换（无基线不动，S4 红线） |

## 5. 建议执行顺序

1. U14b/U14c 按原范围先做（本 RFC 确认无需改动其立项内容，只是补充了证据）。
2. DPR 统一 + LOD 验收标准设计，可与 U14 同批。
3. U21 Phase 2 真机基线（Lighthouse/CrUX + 帧率实测）——本 RFC 与 U21 共享同一个「无基线不动」的阻塞点，建议合并成一次真机测量,而不是分别为 U21 和 U22 各测一次。
4. 拿到基线后，专开一个会话裁决「默认 Combat View 是否换 3D」，这是本仓库近期最大的一个架构级视觉决策，值得单独一个 RFC 而不是塞进本文档的执行阶段。
