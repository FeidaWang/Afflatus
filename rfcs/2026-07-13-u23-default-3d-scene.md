# U23 · 首页默认视图换 3D 场景 — 架构 RFC（2026-07-13）

> 角色：3D Web 架构师。上游：`rfcs/2026-07-13-u22-homepage-3d-combat.md` 已裁定「默认视图是否换 3D 是架构级决策，须独立 RFC」——本篇即该裁决文档。
> 前提继承：U21 Phase 1 裁决（无框架 MPA、git-as-database、three 不无故升级）不动；六条宪章（U22a）为视觉裁决标准；R3/S4（无真机基线不改性能敏感项）。
> 本篇只裁决与给施工图，不动码。

## 0. 决策问题

现状：普通访客的首页 = 2D canvas 背景（starfield/blackhole-gl/event-layer 三层）+ DOM 资产内容 + 底部 HUD（Combat View 是 Canvas 2D 的 `combatHmdV3`）。真正的 3D 战场 `topdownCombat.js` 藏在 `?combatview=topdown&combatcam=director` 双 flag 后面，**默认没人看得到**。要裁决的问题：**3D 场景以什么形态、什么范围、什么代价成为默认视图。**

## 1. 现状资产盘点（全部生产验证过，是本 RFC 敢推进的底气）

| 资产 | 位置 | 复用价值 |
| --- | --- | --- |
| 3D 战场（舰队/彗星/武器/尾迹彩带/尘埃粒子，全 InstancedMesh 单 draw call 纪律） | `src/scene/topdownCombat.js`（~1900 行） | M1 的主角，已完工只欠曝光 |
| 相机导演状态机（smoothDamp/抢占/fov/roll，纯数学 33+ 测试） | `src/combat/cameraMath.js` + `weaponCameraDirector.js` | 页面级滚动运镜直接复用，不新写相机系统 |
| 武器权威时间线 | `src/combat/weaponClock.js`（20 测试） | 3D 分镜驱动源 |
| OffscreenCanvas + module Worker（带完整降级判定） | `src/scene/backgroundScene.js` + `.worker.js` | 主线程解耦的既有范式 |
| UnrealBloom + 色差/胶片颗粒合成器 | `src/scene/alphardForge.js`（EffectComposer 管线） | M3 后处理直接抽厂复用，「评估引入」降级为「推广」 |
| vendor-three 独立分包（658 kB，已有 CI 体积预算） | vite manualChunks（U21 P1） | 懒加载改造的前置已就位 |
| 程序化舰体建模 | `carrierHull.js`/`odinHull.js`/`nighthawk.js`/`fighter3D.js` 等 | 零外部资产依赖，无需 glTF 管线（宪章④剪影验收即可） |

**结论：不缺技术件，缺的是架构编排 + 性能守门。**

## 2. 三个候选架构与裁决

| | A · 3D 舞台化（scrollytelling） | B · Combat View 默认 3D 化 | C · 全游戏化 boot |
| --- | --- | --- | --- |
| 形态 | 单一 3D 场景做全页固定背景舞台，滚动驱动相机沿舰队巡航，DOM 内容层悬浮其上 | 底部 HUD 的 Combat View 面板默认渲染 topdownCombat（撤双 flag），页面其余不动 | 进站即 3D 座舱，资产内容全部改为舰内屏幕/全息交互访问 |
| 工程量 | 中（2–3 会话） | **小（≤1 会话）** | 大（≥6 会话，全站改造） |
| 风险 | 中：滚动性能、文字可读性、移动端 | **低：改的是已存在且已测的路径** | 高：SEO 毁灭性（内容藏进 canvas）、可访问性、单人维护不可持续 |
| 收益 | 「3D 网页游戏感」的主要来源 | 立刻让所有访客看到 3D 战斗 | 最像游戏 |
| SEO/内容 | 文本仍是 DOM，无损 | 无损 | 投资日志的内容属性被摧毁 |

**裁决：B → A 两步走；C 永久否决**（本站首先是投资舰长日志，宪章①要求 UI 是舰载设备，不要求网站是游戏客户端；C 违反 U21「内容+轻交互」的选型前提）。

## 3. 目标架构（B+A 合体后的终态）

```
z-index 栈（cruise 模式）                渲染治理
┌─ DOM 内容层（hero/资产/页脚，可滚动） ──┐   文本永远是 DOM（SEO/a11y 红线）
├─ DOM HUD 面板（防御模块等）           │   CSS @layer 已就位
├─ Canvas 2D：HUD 读数/雷达盘/event    │   保持 2D（文字锐利、成本低）
├─ WebGL：唯一 THREE renderer =「舞台」 │   单 context：blackhole 着色器并入
│   scene.layers: 0=星野/星云背景        │   为背景 pass，淘汰 #blackhole-gl
│                 1=舰队/战场(topdown)   │   独立 context（省一个 GL context）
│                 2=近景特效             │
└─ Worker：starfield 降级线保留 ────────┘   T1 兜底不动
```

- **单 renderer 多层**：`renderer.autoClear=false`，背景/战场/特效按 camera.layers 分 pass；全站 3D 只允许这一个 WebGL context（#blackhole-gl 的着色器移植为背景 pass，`alphardForge` 在滚动到该 section 时共用同一 renderer 换场景——canvas 用 CSS 定位移动，context 不新建）。
- **相机 = 唯一叙事者**：页面滚动进度（passive listener + rAF 内 lerp，禁止 scroll 事件里做任何计算）映射到 `weaponCameraDirector` 的 shot 请求序列——hero=舰队远景巡航，滚到资产段=镜头侧移让位（战场退为背景虚化），Command 模式=镜头俯冲切战术视角。滚动运镜纯数学部分进 `cameraMath.js` 补 vitest。
- **状态机**：`viewState ∈ {cruise, command, terminal}` 单一来源（现 body class 机制升格），场景模块只读它，禁止各自记状态（对齐 prompts/README「状态外置」哲学）。

## 4. 性能工程（裁决为准则，数字待 M0 基线校正）

- **设备分级**：启动探针（~1s：离屏渲染 60 帧标准小场景测 p95 帧时长 + deviceMemory/hardwareConcurrency 佐证）→ 定档 `afflatus-gfx-tier` 存 localStorage：**T0** 静态海报（noscript/reduced-motion/探针失败）｜**T1** 现状 2D（低端机默认）｜**T2** 3D 无后处理，DPR≤1.5｜**T3** 3D+bloom/ACES，DPR≤2。`?view=classic` 永久逃生门，`?gfx=t3` 强制档位调试。
- **帧率 governor**：运行时滑窗 fps 采样，连续 3s 低于地板（桌面 60/移动 40）自动降一档并记录；升档只在下次访问探针时发生（防抖）。
- **预算（CI 外准则，随 M0 校正）**：draw call ≤120（移动）/250（桌面）；三角形 ≤300k/1M；纹理显存 ≤64/256 MB；GPU 帧时长 ≤8ms（给 2D HUD 与合成留余量）。
- **rAF 治理**：全站唯一主循环（main.js 已有），所有场景模块以 `update(dt)` 注册；**不可见即不画**——cruise 模式滚出视口的 3D 层、`document.hidden`、移动端 Command 专注模式（U13）之外的面板，一律跳过 update 而非只藏 DOM。
- **加载顺序（LCP 红线）**：HTML/hero 文本先渲染 → idle 时 `import()` 场景模块（vendor-three 从首屏关键路径摘除，改动 main.js 场景 import 为动态；海报占位防 CLS）→ 探针 → 按档位启动。与 U21 Phase 2 的「three 真正懒加载」是同一件事，合并施工。
- **context loss**：`webglcontextlost` → 舰载化「SIGNAL LOST · RECONNECTING」覆盖层（22c 三态信号）→ restore 重建；iOS Safari 内存回收是主要触发源，纹理预算是第一道防线。
- **WebGPU/TSL**：只立触发条件不施工——M0 探针数据显示 ≥20% 访客 WebGPU 可用且 three 升级无 breaking 阻碍时，开评估会话；否则每季巡检一次。

## 5. 里程碑（每个 = 一个会话，O1 制度）

| 里程碑 | 内容 | 出口标准 |
| --- | --- | --- |
| **M0 · 真机基线** | 与 U21 Phase 2 合测：Lighthouse/CrUX + `?gfxprobe=1` 探针页收 fps 数据（GA4 事件带 tier/p50/p95） | 基线数字入 RFC 附录，预算表校正 |
| **M1 · 3D 战斗默认化** | `combatview` 默认值改 `topdown`+director 常开（`?combatview=2d` 保留退路）；2D HMD 降级为皮肤 | 现有测试全绿；真机 Combat View 出 3D 战场 |
| **M2 · 统一舞台（桌面 T2+）** | 单 renderer 合并 blackhole 背景 pass + 战场层；滚动相机接 weaponCameraDirector；内容 DOM 悬浮 | LCP 不劣化（vs M0）；滚动 p95 帧时长达标；文字对比度过宪章⑤（亮场景加 scrim 规则） |
| **M3 · 观感冲顶** | alphardForge 合成器抽共享工厂：bloom+ACES+胶片颗粒（T3 档）；boot 序列；Command=镜头俯冲转场 | 降级链四档真机逐档验收 |
| **M4 · WebGPU 评估** | 按 §4 触发条件 | 独立评估文档 |

## 6. 风险表

| 风险 | 缓解 |
| --- | --- |
| iOS Safari 内存杀页 | 纹理预算 + dispose 纪律 + context-loss 恢复；M1 先行正好用小场景摸真机水位 |
| 文字浮在亮场景上不可读 | 宪章⑤色温纪律 + 内容区自动 scrim（背景亮度采样超阈值加深色垫层） |
| 电池/发热差评 | 帧率 governor + 不可见不画 + `prefers-reduced-motion` → T1/T0 |
| 单人维护面扩大 | 不新增场景文件，只编排既有模块；新代码集中在 stage.js（编排）+ 探针 + governor 三处 |
| 滚动运镜晕动症 | 相机加速度限幅（cameraMath 已有 smoothDamp）；提供「镜头固定」开关（a11y） |

## 7. 裁决表

| 类 | 项 |
| --- | --- |
| **可立即做（下一会话）** | M1 全部（改 flag 默认值 + 皮肤降级，代码可验证） |
| **需 M0 基线后做** | M2/M3 全部、three 懒加载改造、预算表定稿 |
| **需站主裁决** | ① 本 RFC 的 B→A 路线是否通过；② 移动端 M2 默认档位（建议 T1 起步，凭 GA4 fps 数据升 T2）；③ M2 期间 starfield Worker 线是否保留为 T1 兜底（建议保留） |
| **不做（永久）** | 方案 C 全游戏化、内容进 canvas、为 3D 引入框架/资产管线（程序化建模够用） |
