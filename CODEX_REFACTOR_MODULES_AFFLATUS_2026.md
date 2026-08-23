# AFFLATUS Codex Refactor Modules (2026)

> 直接交给 Codex 的模块化执行清单。完整视觉与技术依据见 `feida_monumental_deep_space_design_spec_2026_codex_ready.md`。
> 系统方向：**Calm Command Authority / Monumental Quiet**。

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
