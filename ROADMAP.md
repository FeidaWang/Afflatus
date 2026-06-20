# Project Afflatus — Design & Roadmap / 设计与路线图

> 全站设计建议、未来路线图，以及代码模块整理与优化方法。
> 技术细节与 git 操作教程见 **TECHNICAL.md**。

---

## 1. 站点结构与各页身份 / Pages & identities

| Page | File | 身份 / Identity | 主题 |
| --- | --- | --- | --- |
| Home | `index.html` + `src/` | 深空舰长日志 (Three.js) | Orbitron / 钢蓝 HUD |
| Arena | `public/arena.html` | Human vs AI 交易竞技场 | Marathon · 霓虹绿/青 |
| Sectors | `public/sectors.html` | AI + 航天个股研判 | 酸性绿 + 故障艺术 |
| Signal | `public/signal.html` | 美联储观察 = SCP O5 收容档案 | 机密文档 · 琥珀/绿 |
| Games | `public/games.html` | 世界杯限时竞猜 vs Opus | 赛博朋克 · 品红/青 |

**原则**：每页保留**独立的字体与美术身份**，但共享一套基础系统，避免重复造轮子。

**共享系统 / Shared systems**
- `page-turn.css` — 翻页箭头 + 自托管字体 + 全局按钮点击反馈（每页用 body class 切换箭头配色）。
- `transition.js` — 进出页动画 + 音效；按目标页选择类型（warp / cannon / takeoff / control / cyber）。
- `i18n.js` — 全局中英切换；任何带 `data-en` / `data-zh` 的元素自动翻译；右上角 `.lang-toggle`；切换时派发 `afflatus-lang` 事件供动态页面（arena/games）重渲染。
- 数据文件 `arena-news.json`（每日定时任务生成）、`games-data.json`（手动更新）。

---

## 2. 代码整理与优化方法 / Refactor & optimisation method

**现状痛点**
- `src/main.js` 3700+ 行、`src/styles.css` 6900+ 行，均为单体文件，难以维护。
- 每个 `public/*.html` 各自内联一份 `<style>` 与脚本，**导航栏 / 翻页 cycle 每加一页都要改 4–5 个文件**（最大的维护成本）。
- 倒计时、Web Audio 环境音、计数动画等逻辑在多页重复。

**建议的目标结构**
```
public/
  lib/
    clock.js     # FOMC / 开盘倒计时（signal、arena 复用）
    audio.js     # Web Audio 环境音 + SFX 帮助函数（signal、transition 复用）
    viz.js       # 数字 count-up、bar 动画、canvas 背景帮助函数
    nav.js       # ★ 从单一 site 配置渲染导航 + 翻页 data-prev/next
  data/          # arena-news.json, games-data.json
  pages/         # arena/sectors/signal/games 的 html
  styles/        # 每页样式拆出为 css，<link> 引入而非内联
src/             # 仅首页 Three.js 应用
  hud/  scene/  ui/  cursor/  state/   # main.js 拆分
```

**优先级最高的一步：统一导航 — ✅ 已完成（四个非首页）**
`public/lib/nav.js` 内含唯一的 `SITE` 数组（页面顺序 + 中英标题）。每个非首页的 `<nav class="nav" data-afflatus-nav>` 只保留自己的 `.lang-toggle`，链接由脚本按 `SITE` 渲染（当前页自动 `.active`）；prev/next 由顺序循环推导，写入 `body.dataset.prev/next`（page-turn.js 键盘翻页读取）与 `.page-turn` 箭头的 `href`。加载顺序 `i18n.js → lib/nav.js → page-turn.js`（renderer 末尾调用 `AfflatusI18N.apply()` 翻译新链接）。**以后加/改/重排非首页，只改 `SITE` 一处**——arena/sectors/signal/games 四页已迁移，内联导航链接与硬编码 prev/next 已删除。
- 待办：**首页 `index.html`** 的导航（含遥测/指挥/时钟，耦合 `src/main.js`）暂未接入，其 nav 链接与 prev/next 仍是手写；后续可让 main.js 也吃 `SITE`（需小心不破坏现有 getElementById 绑定）。

**分阶段计划 / Phases**
1. **抽公共库**：把 `clock` / `audio` / `viz` 三块从 arena/signal/games 抽到 `public/lib/`，各页 `<script>` 引入。零行为变化，先减重。
2. **统一导航 — ✅ 已完成（四个非首页）**：`public/lib/nav.js` + `SITE`；已替换四页内联导航与 `data-prev/next`。剩首页接入。
3. **拆样式**：把各页 `<style>` 移到 `public/styles/<page>.css`，`<link>` 引入；公共 token（颜色/字体变量）集中到 `tokens.css`。
4. **拆 main.js**：按职责拆为 `state`（飞行状态机）、`hud`、`cursor`、`nav`、`boot`，main 只做装配。
5. **拆 styles.css**：用 `@layer base, hud, combat, starmap, responsive` 或 `@import` 分文件，集中响应式断点（统一 860 / 1080 / 520）。

**优化清单 / Optimisation checklist**
- 背景 canvas（arena-bg、scpCanvas、signal-scene）：`prefers-reduced-motion` 静帧、`visibilitychange` 暂停（已做）；可加 IntersectionObserver 在不可见时停。
- API 预算：Finnhub 自适应轮询（开盘前后快、休市慢，已做）；Twelve Data 历史按需 + 按天缓存（已做）。
- 资源：`public/*.js` 目前原样拷贝，未压缩；如需更小体积，可改为被 Vite 作为模块打包（注意保留多页入口）。
- 一致性：统一所有响应式断点、统一 `--reduced-motion` 处理、统一按钮反馈（已通过 `page-turn.css` 全局规则覆盖）。

---

## 3. 首页专项 / Home-app pass

> 独立的大工程，谨慎隔离改动，避免回归首页 3700 行 JS / 6900 行 CSS。

**3.1 皇牌空战式 HUD（起飞后 / 降落前）— ✅ 已完成**
- `#aceHud` overlay 已移入 combat view（`.hud-pilot`），由飞行相位 `data-phase`（launch / combat / landing）驱动，TIME/SCORE/TARGET + SPEED/ALT + 准星 + 相位标签随相位变化。
- 纯 DOM overlay，不动渲染管线。

**3.2 高精度 F47 模型 — ✅ 程序化高模已完成**
- `src/scene/fighter3D.js` 已升级：blended delta 翼、前置鸭翼、双外倾垂尾、LERX、分面雷达罩 + 气泡座舱、翼尖挂架、双加力发动机（进气唇/喷口/加力锥），RES 320。
- 后续可选：换 glTF + `GLTFLoader` + KTX2 压缩纹理（需要体积可控的资产），保留程序化模型为加载占位。

**3.3 移动端 combat / 星图布局 — ✅ 已完成**
- `@media(max-width:560px)`：隐藏雷达 `hud-left` 与防御 `hud-center`，combat view 占约 2/3、星图约 1/3。

**3.4 Alphard 跃迁点 · 年化收益镜头（SC "Forge" 式）— ✅ 已完成**
- `src/scene/alphardForge.js` + `.stardrive` CSS：滚动渐进镜头拉伸（pinned + 不断放大），蓝色跃迁点星涡（顺时针旋转**风暴漩涡**——大尺度旋转星云盘 + 16 条湍流螺旋臂 + 细丝闪烁，独立于亮核尺寸，低进度时小亮眼 + 大风暴）、左右舰队侧翼（暖左/冷右 + 倒影 + 零星曳光）、逐字打字台词（下滚逐字输入、上滚逐字删除，中英双语跟随 `<html lang>`）。
- **钉住改用 JS `position:fixed`**：首页 `html,body{overflow-x:hidden}` 会让 `position:sticky` 失效（overflow-y 被算成 auto），故由 `alphardForge.js` 显式切 `.pin-fixed`/`.pin-end`，星体 + 台词在整段接近过程居中钉住，台词未打完前上下滚动都停在星体页；修掉了"星体与 equity 之间整页空白"的 bug。
- 与页面背景以顶/底渐隐 + `--bg` 调色融合；星体亮度由真实年化收益 `#sv0[data-counter]` 缩放；`prefers-reduced-motion` 退化为静帧。

---

## 4. 战斗系统迁移：2.5D 上帝视角 WebGL / Top-down combat migration ★

> 本轮新增的**重点架构方向**。当前 combat view 与首页空战是 `main.js` 内嵌的 Canvas-2D（`drawPilotDeck` / `drawPilotF47Nose` / `drawPilotHmd` / 各武器相机 `drawNukeAuthCamera`…），观感偏卡通、伪 3D。目标：参考经典 **Top-Down View（俯视/上帝视角，2D/2.5D）**——如 Nexon《破碎银河系》(2011) 一类俯视战斗——用 **three.js / WebGL** 重建为更流畅精美的俯视战场。

**目标渲染 / Target render**
- 战术平面（god's-eye grid）+ 高位微俯透视相机（轻微 tilt → 2.5D），单位/曳光/爆炸以平面读图、同时保留体积纵深。
- PBR 材质（`MeshStandardMaterial` metalness/roughness）+ emissive 引擎/喷口；**假辉光**用 additive 贴图 Sprite + emissive，不引 postprocessing 依赖以控体积。
- 元素：玩家母舰、彗星（1P/HALLEY，含彗发 coma + 彗尾）、护航战机编队、曳光（cylinder/line 池）、激光（持续光束）、执法者主炮**等离子圆光炮**（orb 投射物）、制导导弹（拖尾 + 命中爆炸）、CIWS 点防、爆炸（扩张 Sprite + 点光）。

**单位设计语言（对标《破碎银河系》截图）/ Unit design language**
> 用户已提供 SG 各类战斗单位截图与攻击方式，作为最终美术目标。
- **母舰 = 执法者 (Enforcer)**：雪茄形船体，**中央主炮**，**后两侧推进器 + 尾翼**，船体多处防御炮塔，青绿装甲点缀（图 4）。已做出第一版程序化几何（cigar hull + 中央主炮 + 充能光球 + 后侧双推进器/尾翼 + 4×2 防御炮塔）。
- **战机 = 夜鹰 (Nighthawk)**：雷达隐身（图 8/9 全黑），后掠箭头形，暗色船体 + 发光翼缘。已做出第一版（暗箭头 + 青色翼缘 + 引擎辉光）。

  > **下一步要做 · 夜鹰「常规模式」high-poly 硬表面规格（NEXT BUILD TARGET — 已存档，下个工作阶段开始建模）**
  >
  > - **分级 / 尺度**：轻型突击战机（Light Assault Fighter）；长 18m × 宽 11m × 高 4m。
  > - **设计语言**：工业军用航天器，**无任何气动翼面（纯真空作战）**；剪影要有侵略性、紧凑、功能化。参考 Homeworld / Battlestar Galactica / EVE / The Expanse 的重工业硬科幻。
  > - **主形体**：围绕一根**厚重装甲中脊**构建；机首短而钝，机体向中段渐宽，尾部为主推进总成；整体**三角楔形**，非对称机械细节，重装甲板，可见维护面板。
  > - **座舱**：单人；深嵌装甲机体内；窄装甲座舱盖，深色偏光玻璃，最小观察开口，战斗导向。
  > - **「机翼」= 两侧短武器挂架**：无气动翼面，仅角状装甲结构；用途＝武器挂载 / 机动推进器 / 传感器包；边缘锐利几何。
  > - **引擎（三发）**：尾部中央 1 主引擎 + 两侧 2 辅助引擎；喷口为**圆形磁约束环 + 内部等离子辉光**。模式配色：巡航＝橙黄；战斗加速＝亮青；跃迁＝蓝紫。（与现有 `pilotModeFor` 相位可联动。）
  > - **武器系统**：座舱两侧 2 门前向粒子炮；1 腹部机炮炮塔；1 背部导弹发射器；可选微型鱼雷硬点；**武器内嵌装甲，无外露炮管**。
  > - **RCS 推进**：机首 / 翼根 / 腹部 / 尾稳定面分布多组 RCS，支持六轴机动，可见排气口。
  > - **表面细节**：硬表面、数千独立组件——装甲板、维护舱盖、传感器阵列、散热片、通讯天线、机械关节；可见磨损与战损、细划痕、武器周围烧蚀痕。
  > - **材质（PBR）**：深色军用金属 / 钛合金 / 陶瓷复合装甲；metalness 0.85、roughness 0.55；微表面瑕疵。
  > - **灯光**：航行灯（白 / 琥珀 / 红）+ 小状态 LED + 引擎照明；仅军用感，少装饰光。
  > - **风格**：AAA 资产、高模、影视级、真实比例、无奇幻元素。
  > - **落地路径**：先按此规格做**程序化高模几何**（楔形中脊 + 嵌入式座舱 + 两侧角状挂架 + 三发磁环喷口 + 分布式 RCS 口 + 表面板线），用 emissive 做喷口/航灯；后续可换 glTF + KTX2 贴图。喷口配色绑定飞行相位（巡航橙黄 / 战斗青 / 跃迁蓝紫）。
- **武器谱系（图 3–7）**：密集阵曳光（青/红点状）、持续激光束（绿，已加）、执法者圆形等离子光炮（青绿大光球，已加）、制导导弹（暖色拖尾）。后续按截图细化：光球的电弧、激光的收束闪烁、命中的多段爆炸序列。
- **迭代目标**：从"几何体"逐步逼近 SG 的**精细贴图 + 法线/自发光**质感（Phase 3 引入 glTF/KTX2 资产），并把不同单位的攻击形式（视角、弹道、命中特效）逐一还原。**有不确定的单位/武器细节会直接向你确认。**

**架构边界 / Module boundary**（关键：把"状态"与"渲染"解耦）
```
combatRuntime.js   →  战斗状态（halley 位置/速度、武器、击杀、相位）  [single source of truth]
        │  state snapshot
        ▼
topdownCombat.js   →  纯渲染器（吃 state，画 three.js 俯视场景；无游戏逻辑）
        │  offscreen render → drawImage(#pilotFeed)  或  直接 WebGL canvas
        ▼
combatView (#pilotFeed) / 首页 event-layer
```

**分阶段 / Phases**
1. **Phase 1 — ✅ 已完成（持续迭代美术）**：`src/scene/topdownCombat.js` 自包含俯视场景（执法者母舰/夜鹰战机/彗星/曳光/激光/等离子光炮/导弹/爆炸 + 战术网格 + 星空），并挂一个**生产可达的预览舱**：访问 `?combat=topdown` 全屏预览（gated，不影响正常首页）。已按 SG 截图做出执法者/夜鹰第一版几何与武器谱系；下一步持续逼近贴图质感。
2. **Phase 2**：接入 combat view——在 `combatRuntime` 与渲染间立 `getState()` 快照接口；`topdownCombat` 离屏渲染 → `drawImage` 进 `#pilotFeed`（沿用 `fighter3D` 既有模式），或把 `#pilotFeed` 直接换为 WebGL canvas。保留现有 2D 作为 `prefers-reduced-motion` / WebGL 失败的回退。逐武器相位迁移（combat → ciws → missile → nuke …），每步 build + 真机目检。
3. **Phase 3**：首页主战斗（`event-layer` 上的彗星拦截）迁移到同一俯视渲染；统一资产与材质（可选 glTF + KTX2）、用 `InstancedMesh` 管理曳光/碎片、相机用 `cameraDirector` 统一调度。
4. **Phase 4 — 体积优化**：`topdownCombat` 目前随首页入口静态引入 three（首屏包体增大）。改为 **动态 `import()` 代码分割**，仅在进入 combat / 预览时按需加载战斗渲染器与 three 插件。

**风险控制**：combat 渲染深嵌 3700 行 `main.js`；务必先抽 `state → renderer` 接口、分阶段替换、每步可回退（2D 兜底）。

---

## 5. 各页设计备忘 & 未来点子 / Per-page notes & ideas

- **Arena**：可加"模型 vs 你"的历史胜率曲线；真实历史接 Twelve Data 后把 W/M/6M/Y/5Y 徽标改 `REAL`。
- **Sectors**：可把研判与 Arena 的 Opus 预测打通（同一数据源）。
- **Signal**：SCP O5 档案风；可加"O5 投票"动画、收容等级随数据变化；FOMC 日历自动滚动。
- **Games**：决赛阶段对阵确定后在 `games-data.json` 补 `home/away/result`；可加"夺冠路径"树状图。
- **全站**：完成第 2 节的导航统一后，新增页面成本将大幅下降。

---

*Desk view only · not investment / betting advice. 仅为台面观点，非投资或博彩建议。*
