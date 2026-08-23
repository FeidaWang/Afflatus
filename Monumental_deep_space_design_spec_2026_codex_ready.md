# AFFLATUS (feida.au) Design System & Execution Specification (2026 Monumental Deep Space Edition)
> **系统代号**：Calm Command Authority / Monumental Quiet
> **设计哲学**：Anthropic 编辑部秩序 × 无垠深空航行 × 庞大战舰尺度叙事 × 物理化交互反馈
> **文档属性**：大模型与前端工程师直接执行的系统级重构规范 (LLM-Executable System Prompt & Design Spec)
> **更新基线**：2026-08-23；本版优先于文档中任何与“静态 Hero / 独立 Signature Deck / 战舰自转 / 游戏化 Command HUD”相冲突的旧规则。

---

## 0. 系统使命与核心执行法则 (Core Execution Laws)

### 0.1 核心冲突与解决方向
- **现状痛点 A：视觉通胀**。过去的 AFFLATUS 依赖大量 HUD、边框、扫描线、遥测、雷达、粒子与状态组件制造“未来感”，导致几乎每个区域都像最高优先级告警。
- **现状痛点 B：沉浸不足**。在主动做减法后，首页又容易退化为“静态太空展板”：战舰和黑洞只是背景图，真正的 Three.js 舰桥体验被藏在弹层或独立入口中。
- **核心解决方向**：**把复杂度从 UI 中移走，集中到空间、镜头、光线、战舰尺度与按钮反馈上。** 页面本身极其克制；宇宙必须真正有距离；战舰必须像一座移动中的城市，而不是可旋转的 3D 模型。

### 0.2 六大铁律 (The Six Laws)
1. **一个屏幕只有一个视觉主角**：文字阅读区以编辑式排版为主角；电影演出区以战舰、天体或镜头运动为主角。绝不让 HUD、标题、粒子、雷达和卡片同时争夺第一注意力。
2. **用尺度代替装饰**：视觉冲击来自舰体裁切、遮挡、尺度参照、明暗反差与速度差，而不是更多霓虹、玻璃、Glow、扫描线和网格。
3. **三阶张力字体法则**：Sans = 命令/结构；Serif = 哲思/叙事；Mono = 遥测/事实；Orbitron 严格限制在 <1% 的战术签名区域。
4. **连续航程优先于弹层体验**：战舰与深空从首页第一屏开始存在并贯穿主要滚动叙事；`Enter Command` 是镜头/路由的升级，而不是突然覆盖页面的另一套产品。
5. **电影化动效只集中于关键节点**：普通内容、列表与阅读区域保持低动效；真正的电影级力量留给 Hero、战舰掠过、发动机尾流、Command 过渡。
6. **世界观必须服务理解**：AFFLATUS 是资本、软件、情报与长期决策的个人指挥系统；任何虚构战斗数据、武器状态或装饰性雷达若不帮助理解真实内容，应移入 `/experiments/flight` 或隐藏彩蛋。

### 0.3 最终视觉目标
> **Monumental Quiet / 宏大而安静。**

最终体验应满足：
- 页面本身接近高端编辑设计或战略档案；
- 背景是一段连续深空航行，不是若干互不相干的太空图片；
- 战舰在前 60%–70% 的航程中不应轻易完整出现；
- 用户通过窗口、机库、灯带、护航艇、发动机与天体来推断尺度；
- 按钮承担“启动航程”的物理反馈，但不得游戏化或廉价霓虹化；
- 内页阅读体验明显安静于首页，形成“入口震撼、内容可信”的张力。

---

## Codex 模块化重构执行计划 (Codex Modular Refactor Program)

> 本节是 Codex 的**实际执行顺序与任务边界**。后续 `[P0]–[P6]` 章节是设计要求与验收依据；Codex 不应直接把整份规范作为一次性任务执行，而必须按下列模块逐个完成、验证和提交。

### A. 执行纪律

1. **一个模块 = 一个独立分支 / PR / 可回滚提交单元。** 禁止把两个大型模块合并为一次“全站重写”。
2. **先验证基线，再修改。** M00 未完成前不得开始视觉重构；现有 Build、Lint、Test 或关键路由若已失败，必须先记录，不得把原有失败伪装成新改动造成。
3. **先 DOM 与信息架构，后 WebGL。** 不得在旧首页仍保留重复 Telemetry、重复 Signature Hero 和游戏化 HUD 的情况下先增加更重的 3D 效果。
4. **单向依赖。** 场景对象不得直接读取 DOM 滚动；DOM 不得每帧读取 Three.js 对象。统一由 `scrollTimeline / sceneState / FlightDirector` 传递归一化状态。
5. **保留回退路径。** 在 M17 正式清理前，旧首页、旧 Deck 和旧路由必须通过 Feature Flag、备份路由或 Git 历史可比较、可恢复。
6. **不虚构数据。** Mission Room 只能展示已有真实数据、明确的静态内容或标注为 `Unavailable / Sample` 的占位状态；不得伪造实时收益、系统状态或市场信号。
7. **不擅自重写内容。** 本计划主要调整结构、视觉和交互。除模块明确要求外，Codex 不得大规模改写现有文章、研究结论或个人叙述。
8. **禁止无关重构。** 每个模块仅修改任务卡规定的文件域；发现邻近问题时写入 `docs/refactor/deferred.md`，不要顺手扩张范围。
9. **视觉验证必须留证。** 所有影响界面的模块至少保存桌面与移动截图；影响动效的模块必须同时验证正常 Motion 和 Reduced Motion。
10. **完成报告固定格式。** 每个模块结束时输出：改动文件、行为变化、测试命令与结果、截图路径、性能变化、未解决风险、下一模块是否可开始、提交 SHA。

### B. 分支与提交建议

```text
main
└─ refactor/afflatus-m00-baseline
   └─ refactor/afflatus-m01-guardrails
      └─ refactor/afflatus-m02-design-foundation
         └─ ...
```

推荐提交标题：

```text
refactor(afflatus-mXX): <single module objective>
```

禁止使用 `misc fixes`、`update styles`、`final polish` 等无法追踪范围的提交标题。

### C. Codex 每次启动时的固定前置指令

```text
只执行当前指定的 AFFLATUS 模块，不跨模块扩展。
先阅读本模块、依赖模块的 handoff，以及设计规范中被引用的章节。
先运行现有验证命令并记录基线，再修改代码。
未知真实文件路径时，先根据 M00 file-map 映射；不要假设框架或目录。
保留现有路由、双语内容、分析埋点和无障碍能力，除非模块明确要求迁移。
完成后按“Codex 完成报告”格式交付，不要自动开始下一模块。
```

### D. 总执行链

```text
M00 基线与代码库地图
  ↓
M01 安全护栏、Feature Flag 与回退
  ↓
M02 Design Tokens、字体与版心
  ↓
M03 信息架构、导航与旧路由兼容
  ↓
M04 首页内容减法与 6 Chapter 语义骨架
  ↓
M05 交互原语：Command Button / Link / Row / Motion Toggle
  ↓
M06 单一 Canvas、Poster 与能力分级
  ↓
M07 FlightDirector、ScrollTimeline 与 SceneState
  ↓
M08 相机航线与战舰行为重构
  ↓
M09 五层空间与巨舰尺度参照
  ↓
M10 灯光、材质与 Selective Bloom
  ↓
M11 Chapter 01–03 集成
  ↓
M12 Chapter 04–06 集成
  ↓
M13 LOD、动态画质与性能治理
  ↓
M14 Command Mission Room / Flight Experiment 分拆
  ↓
M15 内页模板、内容迁移与路由收口
  ↓
M16 移动端、Reduced Motion 与 Accessibility
  ↓
M17 最终 QA、旧代码清理与发布
```

可安全并行的范围仅有：
- M02 完成后，M03 与 M05 可由不同分支并行，但合并后必须重新执行 M04 基线；
- M12 完成后，M14 与 M15 可并行；
- M16、M17 必须在所有前置模块合并后执行。

### E. 模块总表

| 模块 | 优先级 | 目标 | 硬依赖 | 建议规模 | 风险 | 主要产物 |
|---|---|---|---|---|---|---|
| M00 | P0 Blocker | 建立可复现基线与真实文件地图 | 无 | S | 低 | baseline、route-map、file-map、截图 |
| M01 | P0 Blocker | Feature Flag、回退与状态边界 | M00 | S | 中 | 新旧体验切换、重构护栏 |
| M02 | P0 Foundation | Design Tokens、排版、版心、Focus | M01 | M | 中 | 统一样式基础 |
| M03 | P0 Structure | 新一级导航、旧路由兼容、移动菜单 | M02 | M | 中 | IA 与路由测试 |
| M04 | P0 De-clutter | 删除噪音并建立 6 Chapter DOM 骨架 | M03 | M/L | 中 | 纯 DOM 首页 V2 |
| M05 | P1 Interaction | 可复用交互组件与场景事件接口 | M02 | M | 中 | CommandButton 等组件 |
| M06 | P1 Cinematic Core | 单一 Canvas、Poster、能力门控 | M04,M05 | L | 高 | ExperienceRoot |
| M07 | P1 Cinematic Core | 滚动时间线、场景状态、单 RAF | M06 | L | 高 | FlightDirector 等 |
| M08 | P1 Camera | 镜头沿舰体航行，移除产品模型感 | M07 | L | 高 | 相机 Spline 与 Cue |
| M09 | P1 Scale | 五层空间与至少三类尺度参照 | M08 | L | 高 | Space Layers / Scale Refs |
| M10 | P2 Lighting | 灯光、材质、Emissive、Selective Bloom | M09 | M/L | 中高 | 电影化光照基础 |
| M11 | P2 Homepage | Chapter 01–03 完整集成 | M10 | L | 高 | Cold Void / Approach / Drift |
| M12 | P2 Homepage | Chapter 04–06 完整集成 | M11 | L | 高 | Bridge / Wake / Departure |
| M13 | P2 Performance | LOD、压缩、动态画质、暂停与预算 | M12 | L | 高 | Quality Governor / 预算报告 |
| M14 | P3 Product | Mission Room 与 Flight Experiment 分拆 | M12,M03 | L | 中高 | `/command` 与 `/experiments/flight` |
| M15 | P3 Content | 内页角色、迁移、Redirect 与模板 | M12,M03 | L | 中高 | 路由收口与模板 |
| M16 | P3 Cross-device | 移动静态路径、Reduced Motion、A11y | M13,M14,M15 | L | 高 | 完整降级与无障碍 |
| M17 | P4 Release | 视觉回归、性能验收、旧代码清理 | 全部 | M/L | 高 | Release Candidate 与最终报告 |

---

## M00 — 基线、代码库地图与风险清单

**优先级：P0 Blocker　规模：S　代码改动：仅允许文档、测试脚本或非侵入式诊断配置**

### 目标
让后续 Codex 会话知道真实框架、真实目录、真实命令和真实现状，避免依据规范中的示意路径盲改。

### 必须完成
- [ ] 识别包管理器、框架、构建器、部署平台和 Node 版本；
- [ ] 运行并记录安装、开发、Build、Lint、Typecheck、Unit、E2E 命令；
- [ ] 建立路由清单：Home、Deck/Command、Markets、Lab、Writing、Experiments、About 及旧深链；
- [ ] 建立组件与文件地图：Header、Hero、Signature Deck、Three.js Scene、Radar、CSS、语言切换、Motion、数据源；
- [ ] 统计 Canvas 数量、RAF 循环、全局事件监听器、GLTF/贴图和大型静态资源；
- [ ] 捕获当前基线截图：`1440×900`、`1280×800`、`390×844`；
- [ ] 捕获正常首页、打开 Deck、Reduced Motion、无 WebGL/加载失败回退；
- [ ] 记录当前控制台错误、网络失败和已知性能瓶颈；
- [ ] 不修改现有视觉或业务行为。

### 产物
```text
docs/refactor/baseline.md
docs/refactor/file-map.md
docs/refactor/route-map.md
docs/refactor/deferred.md
docs/refactor/screenshots/m00/*
```

### 验收
- 任意新 Codex 会话可只依赖上述文件找到实际实现；
- 所有失败命令明确标记为“既有失败”或“环境阻塞”；
- 不存在用户可见视觉变化。

### 建议提交
```text
docs(afflatus-m00): establish refactor baseline and repository map
```

---

## M01 — 安全护栏、Feature Flag 与回退路径

**优先级：P0 Blocker　依赖：M00　规模：S**

### 目标
允许 V2 与 Legacy 可控切换，防止长周期重构把生产首页置于不可恢复状态。

### 必须完成
- [ ] 建立单一配置入口，例如 `cinematicHomeV2`，名称可按现有框架调整；
- [ ] 建立 Legacy Home / Legacy Deck 的明确回退路径，禁止复制两份业务数据；
- [ ] Feature Flag 默认值、Preview 环境和 Production 策略写入文档；
- [ ] 建立集中式 `ExperienceMode`：`cinematic | static | reduced | legacy`；
- [ ] 为 WebGL 初始化失败提供无崩溃降级；
- [ ] 保持现有分析埋点与双语行为；
- [ ] 添加最小测试，证明两种首页均可渲染、主要路由可达。

### 不做
- 不修改现有视觉；
- 不开始相机、粒子或新 Chapter；
- 不删除旧实现。

### 验收
- 可通过配置而非代码注释切换 V2/Legacy；
- V2 空壳失败时自动回落到静态或 Legacy；
- Build、Typecheck、路由 Smoke Test 通过。

### 建议提交
```text
refactor(afflatus-m01): add cinematic feature flag and safe fallback
```

---

## M02 — Design Tokens、排版、版心与 Focus 基础

**优先级：P0 Foundation　依赖：M01　规模：M**

### 目标
在不改变信息架构和 3D 行为的前提下，建立唯一的视觉基础，消灭重复颜色、字体、间距和 Focus 规则。

### 修改范围
- 全局 Tokens / Theme；
- 字体加载与角色映射；
- Shell、Reading Column、Section Spacing；
- Border、Radius、Focus、Z-index、Motion Duration；
- 必要的兼容别名，逐步替换旧变量。

### 必须完成
- [ ] 落实 `[P0]` 中 `Void / Hull / Command / Ion` 语义；
- [ ] `Sans / Serif / Mono / Signature` 角色明确；
- [ ] 建立 `--shell-max`、`--reading-max`、`--gutter`、`--section-y`；
- [ ] `:focus-visible` 统一为清晰、非动画依赖的外轮廓；
- [ ] 建立层级明确的 z-index map，避免 Canvas、Header、Menu、Modal 互相覆盖；
- [ ] 对旧变量提供临时 alias，并记录 M17 待删项；
- [ ] 禁止在本模块大幅重排 DOM。

### 验收
- 色彩与字体变量只有一个事实来源；
- 普通内容卡不再同时依赖 Glow、Shadow、Gradient、Scanline；
- 桌面与移动无明显布局回归；
- 自动化 Contrast 检查无新增严重问题。

### 建议提交
```text
refactor(afflatus-m02): unify tokens typography and layout foundation
```

---

## M03 — 信息架构、共享导航与旧路由兼容

**优先级：P0 Structure　依赖：M02　规模：M**

### 目标
让首页、导航和内页只使用一套主认知模型，同时不破坏旧深链。

### 新一级导航
```text
Systems / Intelligence / Field Notes / Experiments / About
[ Enter Command ]   EN / 中
```

### 必须完成
- [ ] 新 Header、桌面导航和移动菜单；
- [ ] `aria-current`、键盘顺序、Escape 关闭、Focus Return；
- [ ] 映射 `Markets / Lab / Writing` 到新栏目；
- [ ] 为所有旧路由建立 Redirect、Alias 或兼容入口；
- [ ] 生成 Route Test，验证旧 URL 不出现 404；
- [ ] `Enter Command` 为单一主 CTA，不与多个类似按钮竞争；
- [ ] 双语切换保留当前路径和查询参数；
- [ ] Header 动效强度保持 1/5，不加入持续发光。

### 不做
- 不迁移文章实体内容；迁移留给 M15；
- 不实现 Command 页面内部 UI；留给 M14。

### 验收
- 新用户能从一级导航理解网站结构；
- 旧链接仍可访问或明确跳转；
- Desktop、Mobile、Keyboard 三种导航流程通过 E2E。

### 建议提交
```text
refactor(afflatus-m03): unify navigation and preserve legacy routes
```

---

## M04 — 首页内容减法与六 Chapter 语义骨架

**优先级：P0 De-clutter　依赖：M03　规模：M/L**

### 目标
先在没有重度 3D 的情况下建立清晰、完整、可访问的 V2 首页；后续 Canvas 只增强体验，不承担信息存在性。

### 必须删除或迁移
- [ ] Hero 四行 Telemetry；
- [ ] 独立 Updated 面板，改为一条 Current Signal；
- [ ] Feature Facts 四格；
- [ ] 第二个静态 Signature Deck Hero；
- [ ] Signature Facts；
- [ ] 首页完整 Closed-cycle 图表；
- [ ] 三张 Principles 卡，改为结尾 Manifesto；
- [ ] 公开 FPS / COMBAT / G-force / Shield / Weapon Energy / 装饰 Radar；
- [ ] 重复 Eyebrow、状态格和分割线约 50%–60%。

### 建立六个语义 Section
```text
01 Cold Void
02 The Approach
03 Parallel Drift / Operating Systems
04 Bridge Aperture / Current Intelligence
05 The Wake / Field Record
06 Departure / Manifesto
```

### 实现要求
- [ ] 每个 Chapter 使用语义化 Heading 与可独立阅读内容；
- [ ] 添加稳定的 `data-chapter` 或等价标识，供 M07 读取；
- [ ] 首屏 H1、正文、CTA 在无 JS 时仍显示；
- [ ] 使用 Poster 或简单背景，不在此模块初始化重度 Three.js；
- [ ] 被迁移内容需保留链接或 Stub，不可直接丢失；
- [ ] Footer 收敛为 AFFLATUS、Melbourne、Language、Motion、Privacy/Disclosure；
- [ ] `ALL SYSTEMS NOMINAL` 全页最多一次。

### 验收
- JavaScript 禁用时首页仍可完整导航；
- 每一屏只有一个主要内容焦点；
- 至少删除一半非必要 HUD/遥测视觉；
- 移动端无横向溢出；
- Lighthouse Accessibility 不低于基线。

### 建议提交
```text
refactor(afflatus-m04): create semantic six-chapter home and remove ui noise
```

---

## M05 — 交互原语与场景事件接口

**优先级：P1 Interaction　依赖：M02；合并 M04 前后均可　规模：M**

### 目标
把按钮、链接、列表和 Motion 设置做成可复用原语，避免每个 Chapter 自行实现不同 Hover。

### 组件
```text
CommandButton
EditorialLink
TransmissionRow
MotionToggle
FocusBoundary / Menu primitives（按现有框架）
```

### 必须完成
- [ ] Command Button：Idle、Pointer Hover、Pointer Down、Release、Focus、Disabled；
- [ ] 磁性位移仅在 `pointer:fine` 且 Motion 开启时启用，最大 4–6px；
- [ ] 扫描光每次 Hover 仅通过一次，不无限循环；
- [ ] Editorial Link 只包含下划线重绘 + 箭头 4px；
- [ ] Transmission Row 不使用 Scale、3D Tilt 或大面积 Glow；
- [ ] 建立轻量事件接口，例如 `onCommandIntent` / `data-scene-signal`，但组件不得直接操作 Three.js；
- [ ] Motion Toggle 可持久化，初始值尊重系统设置；
- [ ] Keyboard Focus 不触发磁性位移，触控端不依赖 Hover。

### 测试
- 单元或 Story/Component Test 覆盖各状态；
- Keyboard、Touch、Reduced Motion 截图；
- 无布局抖动。

### 建议提交
```text
feat(afflatus-m05): add command interaction primitives and motion controls
```

---

## M06 — 单一 Canvas、Poster 与设备能力门控

**优先级：P1 Cinematic Core　依赖：M04、M05　规模：L**

### 目标
建立不会阻塞首屏、可静态降级的唯一首页 WebGL 容器；本模块只做基础设施与静态首帧，不实现完整航程。

### 必须完成
- [ ] 首页固定一个 WebGL Canvas，禁止每个 Section 独立 Canvas；
- [ ] Canvas `aria-hidden="true"`，不接管正文语义；
- [ ] Poster 首先渲染，且与 WebGL 首帧构图一致；
- [ ] WebGL 在首屏文本和 Poster 可见后异步初始化；
- [ ] 能力判定至少包含：WebGL、Reduced Motion、Save Data、设备内存/核心数（可用时）、视口；
- [ ] 输出统一 Profile：`high | medium | mobile | static | reduced`；
- [ ] 初始化失败、Context Lost、资源失败均保持 Poster，不显示阻断性错误；
- [ ] 页面隐藏时暂停 RAF，恢复时平滑继续；
- [ ] 移除首页其他重复 Canvas；Radar 等保留到实验路由。

### 结构建议
```text
experience/ExperienceRoot
experience/qualityProfile
experience/sceneState
```
真实目录以 M00 file-map 为准。

### 验收
- DOM 首屏不等待 Three.js 或 GLTF；
- 首页只存在一个 WebGL Canvas；
- Reduced/Static Profile 不启动持续 RAF；
- WebGL 被禁用时功能完整；
- CLS 不因 Poster → Canvas 切换增加。

### 建议提交
```text
feat(afflatus-m06): establish single canvas poster and capability fallback
```

---

## M07 — FlightDirector、ScrollTimeline 与 SceneState

**优先级：P1 Cinematic Core　依赖：M06　规模：L**

### 目标
建立唯一的滚动到场景映射，杜绝组件各自读取 `scrollY`、多个 RAF 和每帧 React 重渲染。

### 必须完成
- [ ] `scrollTimeline` 把原生滚动映射为 `0–1` 平滑进度；
- [ ] 定义六 Chapter 范围与边界，不把像素高度硬编码到场景对象；
- [ ] `FlightDirector` 统一管理 Camera Position、Look-at、FOV、Exposure、Roll、Chapter Cue；
- [ ] `sceneState` 提供最小只读状态给 DOM，例如当前 Chapter、Active System、Loading State；
- [ ] 全首页只保留一个主 RAF；
- [ ] Resize、Visibility、Route Unmount、Context Lost 均有清理；
- [ ] 不使用 Scroll Hijacking；保留浏览器原生滚动和键盘滚动；
- [ ] DOM 的 Chapter Reveal 不能依赖 60fps 才可读。

### 测试
- 归一化进度、Chapter 边界、前进/后退滚动；
- 快速跳到 Anchor；
- 浏览器 Back/Forward 恢复；
- React Render Count 或等价证据，证明没有每帧状态更新。

### 验收
- 任一场景对象只消费 Timeline/Director，不直接读 DOM；
- 快速滚动不出现相机跳跃、NaN 或章节错乱；
- Unmount 后无残留 RAF/Listener。

### 建议提交
```text
feat(afflatus-m07): add flight director and normalized scroll timeline
```

---

## M08 — 相机航线与战舰行为重构

**优先级：P1 Camera　依赖：M07　规模：L**

### 目标
把“居中自转模型展示”改成“镜头沿巨舰航行”，先完成构图和运动，不追求最终材质细节。

### 航线
```text
Distant observation
→ Bow approach
→ Port-side parallel drift
→ Bridge aperture
→ Mid-hull shadow
→ Engine pass
→ Departure vector
```

### 必须完成
- [ ] 生产首页移除自动战舰自转；
- [ ] 移除默认 OrbitControls，或仅在明确 Debug 模式启用；
- [ ] 用 Spline/Keyframe 定义 Position、Look-at、FOV、Roll；
- [ ] FOV 常态 34°–40°，近距 28°–34°，Roll ≤ 0.8°；
- [ ] 战舰主体保持近似稳定，运动主要来自相机；
- [ ] 前 60%–70% 进度不轻易完整展示舰体；
- [ ] 鼠标只提供 ±4–6px 轻微补充，不改变主航线；
- [ ] 支持反向滚动和直接跳 Chapter；
- [ ] 添加 Debug Overlay 仅在开发环境显示关键进度/FOV/Path Node。

### 不做
- 不增加高面数模型；
- 不先加大量 Bloom、粒子或星云；
- 不重写章节 DOM。

### 验收
- 截图能证明舰体经常超出画面边界；
- 战舰不再像可旋转商品模型；
- 反向滚动镜头稳定；
- Reduced Motion 路径保持静态。

### 建议提交
```text
feat(afflatus-m08): replace ship rotation with guided camera flight
```

---

## M09 — 五层空间与巨舰尺度参照

**优先级：P1 Scale　依赖：M08　规模：L**

### 目标
用深度层、遮挡与大小对比建立真正尺度；本模块优先于模型精修。

### 五层
```text
01 Deep Stars
02 Distant Environment
03 Midfield Dust
04 Near-field Scale References
05 Carrier
```

### 必须完成
- [ ] Deep Stars 稀疏、不均匀、低视差；
- [ ] 同一时刻最多一个主要远景天体；
- [ ] Midfield Dust 极少量，只在需要表达速度时出现；
- [ ] 至少实现三类尺度参照：窗口/机库、护航艇/无人机、发动机/行星弧面等；
- [ ] 舰体构图常态达到约 150%–240% 视口尺度；
- [ ] 利用前景遮挡和不同运动速度，而非简单 `scale`；
- [ ] 小型重复对象使用 Instancing；
- [ ] 每层可按质量 Profile 单独关闭或降级；
- [ ] 避免星点“下雪”和均匀背景噪声。

### 验收
- 在无文字截图中也能看出巨舰与小型对象的尺寸关系；
- 至少三类尺度参照实际可见，而非仅写在代码中；
- Medium/Mobile 可降级层数且不影响内容。

### 建议提交
```text
feat(afflatus-m09): build layered space and monumental scale references
```

---

## M10 — 灯光、材质、发动机与 Selective Bloom

**优先级：P2 Lighting　依赖：M09　规模：M/L**

### 目标
在构图和尺度已经成立后，以克制光线强化舰体结构；禁止依赖全局 Glow 制造效果。

### 必须完成
- [ ] ACES Filmic Tone Mapping；
- [ ] 一盏主要冷色边缘光 + 一盏极弱暖色天体反射；
- [ ] 舰体多数区域保持暗部；
- [ ] 发动机使用独立 Emissive 与必要点光；
- [ ] Selective Bloom 只作用于发动机、导航灯、通讯线；
- [ ] Command Orange 只用于关键行动/路径，Ion Cyan 用于环境与导航；
- [ ] 禁止 Bloom 影响 DOM 或整艘舰体；
- [ ] 胶片颗粒若使用，保持静态/极慢且不超过 2%–3%；
- [ ] 为各 Profile 定义 Post-processing 开关。

### 验收
- 关闭 Bloom 后仍能理解舰体轮廓和交互；
- 暗部不糊成纯黑块，亮部不溢出；
- 同屏强调色不超过两种；
- Medium/Mobile 无明显 GPU 过载。

### 建议提交
```text
feat(afflatus-m10): establish restrained cinematic lighting and selective bloom
```

---

## M11 — Chapter 01–03 集成：Cold Void / Approach / Parallel Drift

**优先级：P2 Homepage　依赖：M10　规模：L**

### 目标
完成首页前半段品牌理解、发现战舰和三大系统的连续叙事。

### Chapter 01
- [ ] 先文字，400–700ms 后才出现微弱舰体轮廓；
- [ ] 首屏无复杂 HUD、数据格和雷达；
- [ ] `Enter Command` 与 `Explore Systems` 层级明确；
- [ ] 背景恒星极慢、鼠标视差有限。

### Chapter 02
- [ ] 舰首从边缘进入，持续超出画面；
- [ ] 舰首占视口约 70%–110%；
- [ ] 使用至少一个小型参照物；
- [ ] 禁止完整舰体展示。

### Chapter 03
- [ ] 三个系统沿镜头航线依次出现，不恢复三张传统卡片；
- [ ] 每个系统只有标题、一句描述、一个链接；
- [ ] Active System 与舰体导航灯一次性联动；
- [ ] Hover 不改变布局、不触发持续闪烁。

### 验收
- 前 50% 滚动是一段连续空间航程；
- 用户在 3 秒内理解品牌；
- 三个系统结构清楚，且不依赖 3D 才能导航；
- 桌面、移动 Poster、Reduced Motion 均有等价内容。

### 建议提交
```text
feat(afflatus-m11): integrate opening three chapters of the deep-space journey
```

---

## M12 — Chapter 04–06 集成：Bridge / Wake / Departure

**优先级：P2 Homepage　依赖：M11　规模：L**

### 目标
完成 Current Intelligence、Field Record 与 Manifesto 结尾，让首页收束为内容入口而不是无限展示 3D。

### Chapter 04
- [ ] 镜头接近舰桥/观测窗；
- [ ] 同时只出现一个主要天体；
- [ ] 展示一条 Current Signal + 三条 Transmissions；
- [ ] 删除 2×2 指标格和重复 Feature Facts；
- [ ] Row Hover 只触发短航线响应。

### Chapter 05
- [ ] 发动机首次完整进入；
- [ ] 近场微尘仅在此类速度节点增强；
- [ ] 只保留 FY25/26 Field Record 摘要；
- [ ] 完整图表链接到对应 Case Study，不在首页展开。

### Chapter 06
- [ ] 战舰逐渐远离，首次可见较完整轮廓；
- [ ] 动效强度降低；
- [ ] Principles 合并为 Manifesto；
- [ ] Footer 安静，`ALL SYSTEMS NOMINAL` 最多一次；
- [ ] 最终 `Enter Command` 不与 Footer 链接争夺注意力。

### 验收
- 首页总长度约 480–560vh，可按真实内容微调；
- 不存在第二个静态 Signature Deck Hero；
- Current Signal、Field Record 和 About 都有明确下一步；
- 滚动到结尾后 RAF/场景状态稳定。

### 建议提交
```text
feat(afflatus-m12): complete bridge wake and departure chapters
```

---

## M13 — LOD、动态画质、资源压缩与性能治理

**优先级：P2 Performance　依赖：M12　规模：L**

### 目标
在视觉结构完成后控制资源与帧预算，禁止在性能不达标时继续加细节。

### 必须完成
- [ ] High / Medium / Mobile / Static / Reduced 资源矩阵；
- [ ] 桌面与移动 LOD；
- [ ] KTX2/Basis、Meshopt/Draco（仅在项目技术栈合适时）；
- [ ] 窗口、灯光、无人机 Instancing；
- [ ] 动态 Quality Governor：帧时间阈值、DPR、Dust、Bloom；
- [ ] 调级冷却 4–6 秒，避免震荡；
- [ ] `visibilitychange`、路由离开、Canvas 离屏后的暂停/销毁策略；
- [ ] Context Lost / Restored；
- [ ] 输出真实资源大小、Triangle、Texture、GPU 内存近似报告；
- [ ] 不以降低文字清晰度或交互响应换帧率。

### 目标预算
- 高规格桌面 55–60fps；
- 普通笔记本 40–60fps；
- 高性能移动约 30fps；
- 首屏 3D 前置载荷为 0，先 Poster；
- LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1。

### 验收
- 至少在两档桌面与一档移动 Profile 测试；
- 低性能/Save Data 自动静态降级；
- Performance Trace 和 Bundle/Asset Report 存档；
- 若预算未达标，必须阻止继续视觉加码并记录阻塞。

### 建议提交
```text
perf(afflatus-m13): add lod dynamic quality and resource governance
```

---

## M14 — Command Mission Room 与 Flight Experiment 分拆

**优先级：P3 Product　依赖：M12、M03　规模：L**

### 目标
把公开 Command 从游戏 HUD 改为真实 Mission Room，同时保留已有飞行/战斗技术作为独立实验。

### `/command` 或现有对应路由
```text
CURRENT OBJECTIVE
CURRENT TRAJECTORY
NEXT ACTION
OBSERVE / MODEL / COMMIT
```

### `/experiments/flight`
保留或迁移：
- NAV / COMBAT；
- Radar；
- Weapon/Shield/G-force；
- Flight Simulation；
- FPS 仅开发/Debug 可见。

### 必须完成
- [ ] Command 只展示真实、已有或明确标记的状态；
- [ ] 无数据时使用诚实 Empty/Unavailable State；
- [ ] Observe / Model / Commit 具有清晰语义和键盘交互；
- [ ] 将游戏化资源从公开 Command 默认 Bundle 中拆出；
- [ ] 保留旧 Deck 路由 Redirect 或迁移提示；
- [ ] Command 的背景动效中等、低速，不复制首页 5/5 演出；
- [ ] Flight Experiment 明确标注为实验，而非实时业务面板。

### 验收
- 用户不会把虚构战斗状态误认为真实系统数据；
- 旧飞行体验仍可进入；
- Command 首屏任务、轨迹和下一步在无 WebGL 时可用；
- 两个路由 Bundle 可独立加载。

### 建议提交
```text
refactor(afflatus-m14): split mission room from flight simulation
```

---

## M15 — 内页模板、内容迁移与路由收口

**优先级：P3 Content　依赖：M12、M03　规模：L**

### 目标
让首页只承担品牌与入口，详细数据和实验回到适合阅读/操作的内页。

### 迁移矩阵
- [ ] FY25/26 图表与方法 → Capital / Portfolio Case Study；
- [ ] Fed 与长端信号 → Intelligence / Signal；
- [ ] Solar Atlas → Intelligence / Solar Atlas；
- [ ] QF-01 → Intelligence 或 Experiments，按现有内容性质决定并记录；
- [ ] Cityview / Horoscope → Experiments；
- [ ] Course → Systems / Software；
- [ ] Novels → Field Notes / Fiction 或 Experiments / Fiction；
- [ ] 旧 Markets/Lab/Writing 路由保持 Redirect 或 Alias。

### 四类模板
```text
A Homepage
B Index
C Case Study / Dossier
D Longform
```

### 必须完成
- [ ] Index：Feature + Complete Index；
- [ ] Case Study：宽 Hero、窄正文、图表可 Breakout；
- [ ] Longform：680–760px 阅读版心、低动效；
- [ ] 内页不得持续运行首页完整 3D；
- [ ] 内容迁移保留标题、日期、Canonical、Meta、旧链接；
- [ ] 建立 Redirect 与 Sitemap/Navigation 更新；
- [ ] 不在迁移中默默修改研究结论。

### 验收
- 首页被移除的内容都有明确目的地；
- 旧外链不 404；
- Capital、Signal、Course、Longform 明显比首页安静；
- SEO 与分享元数据保持或改善。

### 建议提交
```text
refactor(afflatus-m15): migrate content into focused inner-page templates
```

---

## M16 — 移动端、Reduced Motion、Save Data 与 Accessibility

**优先级：P3 Cross-device　依赖：M13、M14、M15　规模：L**

### 目标
建立真正独立的静态/低动效体验，而不是把桌面 3D 缩小或把动画时长设为零。

### 移动端
- [ ] 高性能设备只保留三段关键镜头：舰首 → 舰体侧面 → 发动机/远离；
- [ ] DPR 上限 1.2–1.25；
- [ ] 粒子约桌面 35%；
- [ ] 禁止 DOF；Bloom 仅发动机；
- [ ] 无 Hover 依赖，触控目标 ≥44×44px。

### Static / Reduced
- [ ] 初始化前检测，不启动持续 WebGL；
- [ ] 使用三张艺术指导 AVIF/WebP 关键帧；
- [ ] 章节通过无位移或轻 Crossfade 切换；
- [ ] Motion Toggle 可见、可持久化，并尊重系统设置；
- [ ] 所有内容、链接、状态在静态路径完整。

### Accessibility
- [ ] Canvas `aria-hidden`；
- [ ] Skip Link、Landmark、Heading 层级；
- [ ] 全站键盘可操作；
- [ ] Menu/Dialog 的 Focus Trap 与 Return 正确；
- [ ] Focus 不依赖颜色或动画；
- [ ] 对比度与文本缩放 200%；
- [ ] 不出现高频闪烁、不可暂停的五秒以上非必要动态；
- [ ] 路由切换提供合理焦点管理和 Live Region（若框架需要）。

### 验收
- 390×844、430×932、Tablet、Desktop；
- Keyboard-only、Screen Reader 基础流程；
- Reduced Motion 与 Save Data 截图/Trace；
- 静态路径不是错误页或降质残缺页，而是正式设计版本。

### 建议提交
```text
feat(afflatus-m16): complete mobile static motion and accessibility paths
```

---

## M17 — 最终 QA、旧代码清理与发布

**优先级：P4 Release　依赖：全部模块　规模：M/L**

### 目标
在完整视觉与功能通过后，删除 Legacy 垃圾、锁定指标并形成可发布版本。不得在本模块继续新增主要设计功能。

### 必须完成
- [ ] 执行 `[P6]` 20 项验收；
- [ ] 桌面/移动/Reduced Motion 全页视觉回归；
- [ ] Header、Button、Chapter、Command、内页关键流程 E2E；
- [ ] Core Web Vitals、Bundle、资源、GPU/Frame 预算报告；
- [ ] Console 零未解释错误；
- [ ] 删除已确认不再使用的旧 CSS、重复 Canvas、旧 HUD、废弃资源与兼容 alias；
- [ ] 只在确认无外部依赖后删除 Legacy Route；否则保留 Redirect；
- [ ] 更新 README、Architecture、Content Map、Motion Policy；
- [ ] 记录仍未解决的限制，不用“最终完成”掩盖已知问题；
- [ ] 生成 Release Notes 与回滚步骤。

### 发布门槛
- [ ] Build / Lint / Typecheck / Test / E2E 全部通过，或所有既有例外有明确批准；
- [ ] LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1；
- [ ] 高性能桌面 55–60fps，普通笔记本 40–60fps，高性能移动约 30fps，Static 路径完整；
- [ ] 旧 URL 不 404；
- [ ] 无 WebGL、Reduced Motion、Save Data、Keyboard-only 均可完成核心导航；
- [ ] 视觉结论符合 `Monumental Quiet / Calm Command Authority`，而非重新回到满屏 HUD。

### 建议提交
```text
chore(afflatus-m17): finalize qa remove legacy and prepare release
```

---

## Codex 完成报告模板

每个模块完成后必须提交以下内容：

```markdown
# AFFLATUS MXX Completion Report

## Scope completed
- ...

## Files changed
- `path/to/file`: reason

## User-visible behavior
- ...

## Tests run
- `command` — PASS/FAIL

## Visual evidence
- Desktop: `path`
- Mobile: `path`
- Reduced Motion: `path`

## Performance impact
- Before:
- After:

## Deviations from specification
- None / explain

## Deferred risks
- ...

## Next-module readiness
- READY / BLOCKED
- Reason:

## Commit
- `<sha>`
```

## 模块执行优先级摘要

```text
第一阶段：M00–M04
先把代码库、导航和首页内容变得可理解、可回滚、可访问。

第二阶段：M05–M10
建立交互原语、单 Canvas、时间线、相机、尺度与光线。

第三阶段：M11–M13
完成六段航程并把性能控制在预算内。

第四阶段：M14–M16
重构 Command、迁移内页、完成移动与无障碍路径。

第五阶段：M17
只做验收、清理和发布，不再增加主要功能。
```

> **不可颠倒的核心顺序：内容减法 → 镜头 → 尺度参照 → 灯光 → 模型细节 → Post-processing → 性能收口。**

---


# Part B — 设计要求与技术规范 (Design Requirements)

# [P0] 基础 Design Token、色彩材质与排版系统

## 1.1 色彩空间：Void / Hull / Command / Ion

```css
:root {
  --void-0: #020307;
  --void-1: #05070c;
  --hull-0: #090d12;
  --hull-1: #111821;
  --surface-focus: #18222d;

  --paper: #eeece4;
  --paper-ink: #141618;

  --text-primary: #f2f0e8;
  --text-secondary: #919aa4;
  --text-muted: #626c76;

  --command: #ff6b4a;
  --command-soft: rgba(255, 107, 74, 0.12);

  --ion: #8ad7f7;
  --ion-soft: rgba(138, 215, 247, 0.12);

  --status: #a8f346;
  --warning: #ffb84d;
  --danger: #ff5c5c;

  --line: rgba(255,255,255,.12);
  --line-subtle: rgba(255,255,255,.07);

  --ease-command: cubic-bezier(.16,1,.3,1);
  --ease-ui: cubic-bezier(.2,0,0,1);
}
```

### 颜色语义硬规则
- `--command`：主 CTA、当前路径、Commit/执行态；不用于背景装饰。
- `--ion`：舰体导航灯、环境边缘光、非危险交互提示。
- `--status`：只表达真实“正常 / 在线 / 已验证”状态。
- 同一可视区域最多出现两种强调色；禁止 Cyan + Lime + Amber + Red 同屏抢注意力。
- 禁止默认紫蓝渐变作为“科技感”；禁止让整艘战舰泛蓝光。

## 1.2 字体张力

| 角色 | 主字体 | 用途 | 推荐范围 |
|---|---|---|---|
| Command | `Inter` / `Geist Sans` | 导航、按钮、结构标题 | H1/H2 与 UI |
| Editorial | `Newsreader` / `Source Serif 4` | Hero 副标题、Manifesto、长文 | 18–26px 正文；大型引言可更大 |
| Telemetry | `IBM Plex Mono` / `JetBrains Mono` | 时间、坐标、真实状态、数据 | 10–14px |
| Signature | `Orbitron` | 舰体代号、极少量战术签名 | <1% 页面文字 |

首屏建议：
- 英文 H1：`clamp(64px, 7.6vw, 126px)`；
- 中文 H1：`clamp(48px, 6vw, 92px)`；
- Hero 正文：20–26px；
- 阅读正文：17–20px，最大行宽 680–760px；
- Mono 标签：10–11px，字距 0.12–0.22em。

## 1.3 版心、留白与边界

```css
:root {
  --shell-max: 1320px;
  --reading-max: 736px;
  --gutter: clamp(20px, 5vw, 72px);
  --section-y: clamp(88px, 11vw, 176px);
}

.site-shell {
  width: min(100%, var(--shell-max));
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.reading-column {
  width: min(100%, var(--reading-max));
  margin-inline: auto;
}
```

规则：
- 大章节用空间距离分隔，优先于卡片外框；
- 边框只表示真实结构、表格或交互边界；
- 普通内容区不使用 `backdrop-filter`；只允许导航抽屉和真正悬浮在场景上的操作层使用；
- 卡片不得依赖阴影、Glow、渐变和 Scanline 同时成立；一个普通组件最多两种表面效果。

---

# [P1] 全局信息架构、共享导航与内容减法

## 2.1 一级导航统一为一套内容模型

```text
AFFLATUS

Systems
Intelligence
Field Notes
Experiments
About

[ Enter Command ]   EN / 中
```

### Systems
```text
CAPITAL
Portfolio
Flight Record
Prediction Record

SOFTWARE
Native Apps
System Notes
FDE Course

INTELLIGENCE
QF-01
Signal
Solar Atlas
Model War
```

### Experiments
```text
Melbourne Cityview
Local-first Astrology
Original Novels
Flight Simulation
```

### 信息架构原则
- 首页的三个核心支柱固定为 `Capital / Software / Intelligence`；导航不得再使用另一套与之平行、需要二次映射的主分类。
- `Markets / Lab / Writing` 可作为旧路由兼容、二级栏目或重定向，但不再承担一级认知模型。
- `/experiments/flight` 承接 NAV / COMBAT、Radar、Weapon Simulation 等游戏化实验，不在公开 Command 主界面默认展示。

## 2.2 首页 P0 级减法清单

优先删除或迁移：
- Hero 右侧四行 Telemetry；
- Hero 底部独立 Updated 面板，合并为一条 `Current Signal`；
- Feature Facts 四格数据板；
- 第二个静态 Signature Deck 战舰 Hero；
- Signature Facts；
- 首页完整 Closed-cycle 图表；
- 三张 Principles 卡片，压缩为结尾 Manifesto；
- 公开 FPS；
- 公开 COMBAT 开关；
- 装饰性 Radar / Weapon Energy / G-force / Shield；
- 重复 Eyebrow、分隔线、状态小格约 50%–60%。

必须保留：
- `Systems for uncertain worlds.`；
- Capital / Software / Intelligence；
- Latest Transmissions；
- 一篇重点研究或 Current Signal；
- About AFFLATUS；
- 双语；
- 设备质量分级、Save Data 与 Reduced Motion 基础。

---

# [P1.5] Command Button、Editorial Link 与场景联动交互

## 2.2 Primary Command Button

视觉样式：
```text
[ ENTER COMMAND        → ]
```

### Idle
- 高度 48px；
- 1px 半透明边框；
- 背景透明或极低不透明深色；
- 不持续呼吸、不无限循环扫描；
- 每 7–10 秒最多允许一次非常弱的边缘能量波；
- 箭头距右侧约 18px。

### Hover（360–440ms）
1. 按钮根据指针产生最多 4–6px 的磁性位移；
2. 边缘由左下角开始短暂“充能”；
3. 一条低透明扫描光只通过一次；
4. 文字向右位移 2px；
5. 箭头向右位移 5px；
6. 背景变为 `var(--command-soft)`；
7. **可选场景联动**：战舰对应导航灯响应一次，禁止持续闪烁。

### Pointer Down
- 约 90ms；
- `scale(.975)`；
- 光效从外向内收缩；
- 箭头回退约 1px；
- 不允许引发布局位移。

### Release / Route Transition
- 480–620ms；
- 边缘能量完成；
- 相机沿航线轻微加速；
- 当前 DOM 内容淡出；
- 下一状态或页面出现；
- 用户应感到“启动航程”，而不是普通链接跳转。

```css
.command-button {
  min-height: 48px;
  border: 1px solid color-mix(in srgb, var(--command) 38%, transparent);
  background: rgba(2,3,7,.28);
  transition:
    transform 420ms var(--ease-command),
    border-color 240ms var(--ease-ui),
    background-color 240ms var(--ease-ui);
}
.command-button:hover {
  border-color: var(--command);
  background: var(--command-soft);
}
.command-button:active { transform: scale(.975); }
```

## 2.3 Secondary Editorial Link
- 无外框；
- 1px 下划线或下划线重绘；
- Hover：下划线从左向右展开 + 箭头移动 4px；
- 180–240ms；
- 不使用 Glow、Scale、粒子或背景扫光。

## 2.4 Transmission Row
- 标题亮度提升；
- 左侧出现 24–40px 的短航线；
- 日期/分类从约 60% 亮度提升到约 90%；
- 背景最多增加 1%–2% 白；
- 可选：远景中一条细航线做一次性响应；
- 禁止 3D Tilt 卡片。

## 2.5 Focus 与可访问性
- `:focus-visible` 必须有 2px 清晰外轮廓；
- Keyboard Focus 不触发磁性位移；
- 所有交互目标移动端至少 44×44px；
- 不依赖颜色、Glow 或动画表达唯一状态。

---

# [P1.6] 单一 Canvas、滚动驱动镜头与连续航程

## 2.6 从“战舰自转”改为“镜头沿舰体航行”

禁止默认模式：
- 战舰居中；
- 战舰持续绕自身旋转；
- 用户通过 OrbitControls 随意把巨舰转成产品模型；
- 相机长期固定看向原点。

必须采用：
```text
Distant observation
→ Bow approach
→ Port-side parallel drift
→ Bridge aperture
→ Mid-hull shadow
→ Engine pass
→ Departure vector
```

推荐用 `CatmullRomCurve3` 或自定义 spline 记录：
- Camera position；
- Look-at target；
- FOV；
- Exposure；
- DOF 参数；
- 舰体灯光状态；
- DOM cue / Chapter 状态。

建议：
- 默认 FOV：34°–40°；
- 近距掠过 FOV：28°–34°；
- Roll ≤ 0.8°；
- 鼠标只提供 ±4–6px 视差，不改变主航线；
- 不劫持滚轮，保留浏览器原生滚动；
- Scroll progress 需要平滑/惯性，但不能让内容阅读失去可控性。

## 2.7 单一固定 WebGL Canvas
- 首页只创建一个固定 Canvas；
- DOM 章节覆盖在其上方；
- 不在每个 Section 单独创建 WebGL；
- RadarCanvas 仅在 `/experiments/flight` 或真实数据用途下存在；
- `Canvas` 对屏幕阅读器 `aria-hidden="true"`，所有信息都必须存在语义化 DOM 版本。

## 2.8 首屏加载序列
```text
HTML / Hero text
→ Poster
→ Main navigation
→ Three.js runtime
→ Low LOD carrier
→ High LOD textures
→ Optional post-processing
```

Poster 与 WebGL 首帧必须使用相同构图；WebGL 准备后 300–500ms Crossfade。WebGL 失败时 Poster 继续作为正式体验。

---

# [P2] 首页 6 Chapter 连续航程分镜

首页总滚动长度建议约 **480–560vh**。每一个 Chapter 必须承担明确叙事任务；禁止为了展示技术无意义拉长滚动距离。

## Chapter 01 — Cold Void（0%–12%，约 100vh）

首屏内容：
```text
AFFLATUS / DEEP-SYSTEM COMMAND

Systems for uncertain worlds.

Capital, software and intelligence
for long horizons.

[ ENTER COMMAND ]   [ EXPLORE SYSTEMS ]
```

行为：
- 页面加载先出现文字；
- 400–700ms 后才出现极轻微舰体遮挡或远景轮廓；
- 背景恒星非常稀疏、运动极慢；
- 桌面鼠标视差仅 ±4–6px；
- 禁止首屏复杂 HUD、Radar、数据格；
- 用户必须先理解品牌，再“发现”宇宙中的 AFFLATUS-01。

## Chapter 02 — The Approach（12%–28%，约 80vh）

- 舰首从右上或侧前方缓慢进入；
- 舰首占视口高度约 70%–110%；
- 舰体持续超出画面边界；
- 通过小型护航艇、窗口、机库或维修灯提供尺度参照；
- 标题缩小并稳定在左侧；
- 主 CTA 可转为状态：`APPROACH VECTOR / STABLE`；
- **禁止完整展示整艘战舰**。

## Chapter 03 — Parallel Drift / Operating Systems（28%–50%，约 120vh）

不再使用三张独立卡片，改为沿舰体纵向航线依次出现：
```text
01  CAPITAL
Risk, allocation and closed-cycle discipline.

02  SOFTWARE
Recoverable systems and deployable intelligence.

03  INTELLIGENCE
Evidence, provenance and long-range signals.
```

行为：
- 左侧是内容，右侧为巨大舰体；
- 当前系统出现时，对应舰体区域只亮起一条克制的导航灯；
- 切换不是卡片上浮，而是镜头继续沿舰体前进；
- 每个系统只保留标题、一句描述、一个链接；
- Hover 可让对应导航灯响应一次。

## Chapter 04 — Bridge Aperture / Current Intelligence（50%–68%，约 100vh）

镜头靠近舰桥/观测窗，远景出现一个主要天体（行星弧面或极弱黑洞引力光环），同一时刻禁止出现多个抢眼天体。

内容：
```text
CURRENT SIGNAL
Fed operations & the long end.

Updated 2026.08.21
[ Read the evidence ]
```

随后仅展示三条 Latest Transmissions：
- 一篇重点内容；
- 三条纯文字列表；
- 不保留 2×2 数据格；
- Hover 只触发短航线响应。

## Chapter 05 — The Wake / Field Record（68%–84%，约 80vh）

- 镜头开始掠过舰尾；
- 发动机首次完整进入画面；
- 近场微尘轻微拉伸，但不得像“下雪”；
- 远星依旧相对稳定；
- 舰体与发动机形成强烈明暗反差。

首页只保留 Field Record 摘要：
```text
FIELD RECORD / FY25–26

Return is not one number.
It is a chain of assumptions.

05 verified closed cycles
[ Inspect the method ]
```

完整图表、方法论与交易闭环迁移至 Portfolio / Capital Case Study。

## Chapter 06 — Departure / Manifesto（84%–100%，约 100vh）

- 战舰逐渐远离；
- 用户第一次可以看到较完整轮廓；
- 场景动效强度逐渐下降；
- Footer 不再是另一块复杂数据区。

结尾：
```text
Preserve capital.
Build systems.
Follow evidence.

A personal command system,
built in Melbourne for long horizons.

[ ENTER COMMAND ]
```

Footer 只保留：
- AFFLATUS；
- Melbourne / SOL-3；
- Language；
- Motion；
- 必要 Privacy / Disclosure；
- `ALL SYSTEMS NOMINAL` 全站最多出现一次。

---

# [P3] 战舰尺度、五层空间、灯光、相机与性能管线

## 3.1 五层深度系统

### Layer 01 — Deep Stars
- 极远恒星；
- 基本静止；
- 分布不均匀；
- 禁止均匀白点铺满屏幕；
- 可用程序化 Shader / Cubemap；
- 随滚动的视差必须非常小。

### Layer 02 — Distant Environment
- 黑洞、行星弧面、淡星云；
- 同一时刻最多一个主要天体；
- 只承担空间锚点，不能抢主角；
- 黑洞不再作为首屏巨幅静态壁纸，而是在航程后半段渐显。

### Layer 03 — Midfield Dust
- 极少量微尘；
- 用于表达相机速度；
- 只在舰体附近明显；
- 禁止高密度持续雪花感。

### Layer 04 — Near-field Scale References
至少具备三类：
1. 舰体窗口；
2. 小型护航艇；
3. 机库入口；
4. 维修灯/无人机；
5. 行星地平线；
6. 发动机尾流。

### Layer 05 — Carrier
- 永远是最大对象；
- 前 60%–70% 航程避免完整展示；
- 战舰基本不自转；
- 主要动感来自相机掠过；
- 冷色边缘光刻画结构；
- 发动机暖白/淡蓝白；
- Command 橙只作为极少量导航/状态灯。

## 3.2 巨舰尺度硬规则
- 舰体常态应占据 150%–240% 视口构图尺度；
- 舰体经常超出顶部、右侧或下方边界；
- 至少三个尺度参照物同时在一段航程内成立；
- 禁止依赖“把模型 scale 调大”作为唯一巨物手段；
- 巨物感必须来自：**大小对比 + 遮挡 + 低 FOV + 运动视差 + 明暗分区**。

## 3.3 灯光与 Post-processing
- 保留 ACES Filmic Tone Mapping；
- 一盏主要冷色环境边缘光；
- 一盏极弱暖色天体反射；
- 发动机使用独立 Emissive；
- 舰体大部分表面应保持黑暗；
- Selective Bloom 只用于发动机、导航灯、通讯线；
- 禁止全局 Bloom 影响 DOM 文字或整艘舰体；
- 可加入 2%–3% 静态胶片颗粒，但禁止高速动画 Noise。

## 3.4 模型与资源预算
推荐目标：
- 高规格桌面战舰：150k–300k triangles；
- 移动 LOD：30k–80k triangles；
- KTX2 / Basis 压缩；
- Meshopt 或 Draco；
- AO / 结构细节优先烘焙；
- 桌面主贴图 2K；
- 移动 1K；
- 小型灯光、窗口、无人机优先 Instancing；
- 禁止为每扇窗口创建独立 Mesh。

## 3.5 动态质量调整
```text
平均帧时间 > 22ms，持续 2 秒
→ DPR -0.1
→ 关闭 Near-field Dust
→ 降低 Bloom

平均帧时间 < 14ms，持续 5 秒
→ 缓慢恢复一级质量
```

- 调级冷却至少 4–6 秒；
- 禁止每帧频繁上下震荡；
- 页面不可见时暂停 RAF；
- WebGL context 销毁/重建必须可控。

## 3.6 目标性能
| 设备层级 | 目标 |
|---|---:|
| 高规格桌面 | 55–60fps |
| 普通笔记本 | 40–60fps |
| 高性能移动 | ~30fps 稳定 |
| Low-end / Save Data | Poster / Static Sequence |
| 桌面 GPU 内存 | 尽量 <180MB |
| 移动 GPU 内存 | 尽量 <96MB |
| 首屏前置 3D 资源 | 0，先 Poster |
| 桌面延迟 3D 载荷 | 约 2.5–4MB 压缩 |
| 移动延迟 3D 载荷 | 约 1–1.5MB |

---

# [P4] Command Mission Room、内页角色与实验迁移

## 4.1 Command Deck：从 Game HUD 改为 Mission Room

公开 Command 默认只保留三个核心区域：

### Current Objective
```text
CURRENT OBJECTIVE
Preserve capital while maintaining optionality.
```

### Current Trajectory
```text
CAPITAL      STABLE
SOFTWARE     BUILDING
INTELLIGENCE OBSERVING
```

### Commit Action
```text
NEXT ACTION
Review long-end signal

[ OPEN DOSSIER ]
```

公开主模式从：
```text
NAV / COMBAT
```
改为：
```text
OBSERVE / MODEL / COMMIT
```

语义：
- Observe：收集信号；
- Model：形成判断；
- Commit：执行行动。

默认移除：FPS、武器、G-force、护盾、战斗目标、装饰雷达、虚构能源分配。NAV / COMBAT 与战术雷达保留在 `/experiments/flight`。

## 4.2 页面视觉角色矩阵

| 页面 | 视觉方向 | 太空动效 |
|---|---|---|
| Home | 宏大深空航行 | 全强度，但分章节控制 |
| Command | 深色 Mission Room | 中等、低速、真实状态优先 |
| Capital / Portfolio | 暖白或深黑编辑档案 | 页头短演出，其余静态 |
| Signal / Sectors | 情报简报 | 极弱背景漂移 |
| Course / Software | 结构化文档 | 不持续运行 |
| Field Notes / Longform | 窄版心阅读 | 0–1/5 动效 |
| Experiments | 独立视觉人格 | 项目决定 |
| About | 深色 Manifesto | 战舰远离/余晖式结尾 |

## 4.3 路由迁移建议
| 旧内容 | 新位置 |
|---|---|
| FY25/26 完整图表与方法 | `/systems/capital/portfolio` |
| Fed 指标与长端数据 | `/intelligence/signal` |
| Solar Atlas | `/intelligence/solar-atlas` |
| QF-01 / Arena | `/intelligence/qf-01` 或 `/experiments/qf-01` |
| NAV / COMBAT / Radar | `/experiments/flight` |
| Cityview | `/experiments/cityview` |
| Horoscope | `/experiments/horoscope` |
| Novels | `/field-notes/fiction` 或 `/experiments/fiction` |
| Course | `/systems/software/course` |

---

# [P5] 前端架构、资源加载、移动端与 Reduced Motion

## 5.1 推荐目录架构

```text
src/
  experience/
    ExperienceRoot.ts
    FlightDirector.ts
    qualityProfile.ts
    scrollTimeline.ts
    sceneState.ts

    scenes/
      DeepSpaceScene.ts
      CarrierApproach.ts
      BridgeAperture.ts
      DepartureScene.ts

    objects/
      Carrier.ts
      PlanetLimb.ts
      EscortCraft.ts

    effects/
      FarStarField.ts
      NearFieldDust.ts
      EngineWake.ts
      SelectiveBloom.ts

  components/
    CommandButton.tsx
    SystemRoute.tsx
    TransmissionRow.tsx
    CurrentSignal.tsx
    MotionToggle.tsx

  styles/
    tokens.css
    typography.css
    motion.css
    navigation.css
    home.css
    command.css
```

原则：
- `FlightDirector` 管理相机、FOV、曝光、Chapter cue；
- 场景对象不直接读 DOM scroll；统一由 `scrollTimeline` 提供平滑进度；
- React/DOM 与 Three.js 状态使用最小单向接口，避免每帧触发组件渲染；
- Post-processing 可热降级；模型与核心交互不能依赖 Bloom 才可理解。

## 5.2 Poster + LOD 加载策略

```text
Critical HTML/CSS
→ Hero Copy + Nav
→ AVIF/WebP Poster
→ WebGL Runtime (idle / after first paint)
→ Low LOD Carrier
→ Chapter 02 前预取 High LOD
→ Post-processing 最后加载
```

- Poster 必须艺术指导并匹配 WebGL 首帧；
- WebGL 失败时不显示错误弹窗，继续使用 Poster；
- `Save-Data: on`、低内存或 Reduced Motion 可直接跳过 WebGL；
- 预加载只加载即将使用的 Chapter 资源。

## 5.3 移动端策略

### 高性能移动
- 目标 30fps；
- DPR 上限 1.2–1.25；
- 粒子数量约桌面 35%；
- 低多边形舰体；
- 禁止 DOF；
- Bloom 只保留发动机；
- 不使用鼠标视差；
- 只保留三个关键镜头：舰首 → 舰体侧面 → 发动机/远离。

### 低性能 / Save Data / Reduced Motion
- 不初始化持续 WebGL；
- 使用 3 张 AVIF/WebP 关键帧；
- Chapter 通过 Crossfade 切换；
- 不持续平移、Parallax、Scanline、Orbit；
- 仍通过大幅裁切与尺度参照保留巨舰感。

## 5.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  [data-cinematic-motion] { animation: none !important; }
}
```

实现要求：
- 不只是把动画 duration 设为 0；
- 应在初始化阶段检测 Reduced Motion 并选择静态渲染路径；
- Motion Toggle 必须在 UI 中可见并持久化偏好；
- 所有信息和链接在静态模式下保持完整。

## 5.5 Core Web Vitals 目标
- LCP ≤ 2.5s；
- INP ≤ 200ms；
- CLS ≤ 0.1；
- 首页不得等待 GLTF 才显示 H1；
- Hero Poster 与文本必须占据首屏稳定尺寸；
- WebGL 初始化不得阻塞首个可交互状态。

---

# [P6] 验收测试与质量检查清单 (Acceptance Checklist)

完成开发后，大模型或前端工程师必须逐项验证：

- [ ] **01 / 品牌理解**：用户打开首页 3 秒内，是否能理解 AFFLATUS 是关于资本、软件、情报与长期决策的个人指挥系统？
- [ ] **02 / 深空存在感**：不点击任何按钮，是否已经能感受到深空与战舰，而不是必须进入弹层才开始“科幻体验”？
- [ ] **03 / 巨舰尺度**：前 60% 航程内，是否无法轻易看清完整战舰？是否通过窗口、机库、护航艇、发动机或天体建立尺度？
- [ ] **04 / 镜头优先**：战舰是否基本不自转，而由相机沿舰体航行？是否移除了默认 OrbitControls 产品模型感？
- [ ] **05 / 单一主角**：每个视口是否最多只有一个主要视觉事件？
- [ ] **06 / UI 减法**：是否至少减少一半边框、Mono 小标签、HUD 小格和装饰性遥测？
- [ ] **07 / 主 CTA**：每个视口是否最多一个 Primary CTA？Command Button 是否具备短促充能、箭头位移、按压反馈与必要场景联动？
- [ ] **08 / 真实 Command**：公开 Command 是否展示 Objective / Trajectory / Next Action，而不是装饰性武器、护盾、FPS 和 G-force？
- [ ] **09 / 信息架构**：一级导航与首页是否统一围绕 Systems / Intelligence / Field Notes / Experiments / About，不再要求用户在两套分类间映射？
- [ ] **10 / 内页克制**：Capital、Signal、Course、Longform 是否明显比首页安静，避免所有页面都变成宇宙主题皮肤？
- [ ] **11 / 单一 Canvas**：首页是否只存在一个固定 WebGL Canvas？
- [ ] **12 / 性能**：桌面高规格是否接近 55–60fps；普通笔记本 40–60fps；高性能移动约 30fps；低性能设备是否能无损降级为 Poster？
- [ ] **13 / Web 指标**：LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1；H1 与 Poster 不等待 GLTF。
- [ ] **14 / Reduced Motion**：关闭 Motion 后，是否完全不初始化持续航行；页面是否仍完整、美观、可理解？
- [ ] **15 / Accessibility**：所有功能是否可键盘完成；Canvas 是否 `aria-hidden`；交互目标是否 ≥44×44px；Focus 是否清晰且不依赖颜色或动画？
- [ ] **16 / 色彩纪律**：Command Orange、Ion Cyan、Status Lime 是否按照语义使用；是否避免同屏四色告警？
- [ ] **17 / 灯光纪律**：Bloom 是否仅影响发动机/导航灯/通讯线，而不是整艘战舰和 DOM 文本？
- [ ] **18 / 内容迁移**：FY25/26 完整图表、游戏化 Radar、COMBAT 等是否从首页迁移到对应 Case Study / Experiment？
- [ ] **19 / Footer**：`ALL SYSTEMS NOMINAL` 是否全页最多出现一次，Footer 是否保持安静？
- [ ] **20 / 最终气质**：最终体验是否更接近“安静、可信、宏大、电影化的个人指挥系统”，而不是“满屏 HUD 的科幻游戏主页”？

---

# 最终执行摘要

> **把视觉复杂度从 UI 中移走，集中到空间、镜头、光线、战舰尺度和按钮反馈上。**

最重要的四项修改：
1. 删除约一半首页 UI 装饰与重复信息；
2. 把战舰从点击后的弹层移到贯穿首页的连续空间场景；
3. 由战舰自转改为相机沿巨舰航行；
4. 把按钮升级为与场景联动的 Command Interaction。

最终不应该像布满 HUD 的科幻游戏主页，而应该像：

> **一套安静、可信、具备编辑权威感的个人指挥系统，被安置在一艘驶向深空的庞大战舰之中。**
