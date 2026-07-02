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
| Novels | `public/novels.html` | 无限流·种田小说连载《万界种春》 | 复古未来主义 · 铜/青（纯中文，护眼阅读，含夜间/豆沙绿/米黄三种阅读模式、自动翻页、书签、章节速览） |

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
   - ✅ **clock**：`public/lib/clock.js`（`window.AfflatusClock.fmtDur(ms)` / `fmtDurSec(s)`）。arena.js 与 games.js 里**完全相同**的倒计时格式化函数已抽走、改为薄包装；两页在各自脚本前 `<script src="/lib/clock.js" defer>`。已 build 验证、行为一致（`1d 01:01:01`）。
   - ✅ **audio**：`public/lib/audio.js`（`window.AfflatusAudio.context()` 单一 AudioContext + `env()` 包络 + `noise()` + `masterGain()`）。`transition.js` 的 4 个底层 helper（ctx/noise/env/out）改为委托该库**并保留内联兜底**（库缺失/晚载也不会哑音）；`signal.html` 的 AudioContext 与音符包络改用共享库。五个页面在 `transition.js` 前加载 `/lib/audio.js`。build + 顺序校验通过。
   - 待抽：**viz**（count-up：当前仅 sectors.html 用，可与首页 marketDeck 的 count-up 合并为一个 helper）。signal 的 FOMC 倒计时格式如与 `AfflatusClock` 一致也可接入。
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
- **战机 = 夜鹰 (Nighthawk)**：雷达隐身（图 8/9 全黑），后掠箭头形，暗色船体 + 发光翼缘。**✅ 已按下方硬表面规格做出高精度程序化模型** `src/scene/nighthawk.js`（`createNighthawk(THREE,{glowTex})→{group,setMode,tick}`）：装甲楔形机体 + 中脊、钝面四棱机首、深嵌偏光座舱、两侧武器挂架、三发磁约束环引擎（巡航橙/战斗青/跃迁紫，`setMode` 切换）、内嵌粒子炮口 + 腹部炮塔 + 背部导弹格、分布式 RCS、航行灯、发光隐身边缘、深色军用 PBR。已接入 `topdownCombat` 的护航战机（`?combat=topdown` 预览）。后续：换 glTF/贴图做战损质感、按飞行相位驱动 `setMode`。

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
2b. **真实战况绑定 — 🚧 第一步已完成**：combat view 现在读真实 `halley`（彗星）/`killCount` 状态——导弹/核弹镜头的**引爆与页面上彗星真正被摧毁（`halley.destroyed`）帧级对齐**（`opts.killed` 触发引爆相位）；导弹锁定框在真正锁定目标（`halley.hover`）时立即变绿/LOCK；SC HUD 显示真实 **KILLS** 计数、准星锁定时变绿 + 收紧角标。**待续**：把 `topdownCombat` 俯视场景也由真实状态驱动（彗星位置/护航开火），以及逐武器相位过场与 combatRuntime 的 `getState()` 正式接口化。

2. **Phase 2 — 🚧 进行中（已接入，opt-in）**：`topdownCombat` 已以**离屏渲染 → `drawImage` 进 `#pilotFeed`** 的方式接入 `drawPilotFeed`（main.js），覆盖主 **combat / standby** 相位；动态 `import()` 懒加载，WebGL/模块不可用时自动回退现有 2D cockpit。
   - **开关**：默认关闭，`feida.au/?combatview=topdown` 开启（写入 `localStorage['afflatus-combatview']`，持久），`?combatview=2d` 还原。确认观感 OK 后改默认即可（drawPilotFeed 里去掉 `combatViewTopdown()` 判断或默认返回 true）。
   - **下一子步（2b）**：把场景与真实战况绑定——在 `combatRuntime` 暴露 `getState()` 快照（halley 位置/速度、相位、武器、击杀），`topdownCombat` 接收并以此驱动彗星/护航/曳光，而非当前自走时间线；再逐武器相位迁移（ciws → missile → nuke → mainGun）。每步 build + 真机目检。
3. **Phase 3**：首页主战斗（`event-layer` 上的彗星拦截）迁移到同一俯视渲染；统一资产与材质（可选 glTF + KTX2）、用 `InstancedMesh` 管理曳光/碎片、相机用 `cameraDirector` 统一调度。
4. **Phase 4 — 体积优化**：`topdownCombat` 目前随首页入口静态引入 three（首屏包体增大）。改为 **动态 `import()` 代码分割**，仅在进入 combat / 预览时按需加载战斗渲染器与 three 插件。

**风险控制**：combat 渲染深嵌 3700 行 `main.js`；务必先抽 `state → renderer` 接口、分阶段替换、每步可回退（2D 兜底）。

---

## 4b. Combat View HUD 重做（Star Citizen 风格）/ Combat-view HUD redesign ★

> 用户对 combat view 现有 HUD 不满，要求按 SC 飞行 HUD 截图重做（机库视角 + 战斗视角），并融入截图 3–5 的优点。**这是 UI/2D 绘制，不是 3D 模型。**

**已完成（本轮）**：`src/scene/combatHudSC.js` — `drawCombatHudSC(ctx,w,h,now,state)` 纯 canvas 绘制，已按截图实现：
- 左上**战机全息框** + GIMBAL/GROUP/GUNS(ALL) + 两个护盾数值；
- 顶部 **ONLINE 绿色状态条** + **航向带**（刻度+读数+游标）；
- 左右**竖直油门条**（左 SCM 速度 / 右 AB），绿/红分段 + 滑块 + 端帽；
- **ESP/CPLD** 方块 + 红色云台准星 [+]；**H-FUEL/Q-FUEL %**；
- 右侧 **G 表节点图**（十字节点）+ G 值；**DECOY/NOISE**；**R-ALT/VSI/ATMO**；
- 中央**俯仰梯**（-35/-40/-45 括号）+ 侧弧 ")(" + 准星；
- **告警**（琥珀/红，如 MAJOR TORQUE IMBALANCE / SHIELDS DOWN）；
- 主题色 cyan，受损切 amber/red（`state.accent`）。
- 预览三态：hangar（速度0、无 ONLINE）/ cruise（1072 m/s、ONLINE、QT）/ combat（受损、橙色、告警）。

**下次要做（接线 + 细化）**：
1. **接入 `drawPilotFeed`（main.js）**：在 combat/standby（或全部相位）调用 `drawCombatHudSC(ctx,w,h,now,state)` 取代/叠加现有 HMD。先用 `?combatview=topdown` 同款 opt-in 开关灰度上线，2D 兜底。
2. **数据绑定 `state`**：speed/throttle/ab←warpPower、heading←朝向、g←`window.__gLoad`、alt/vsi←飞行相位、shieldF/R←护盾、warn←`nuke-alert`/`emp-effect`/`offline`、status←launch=`REQUEST TAKEOFF`/cruise=`ONLINE`/combat。scm 在 launch/landing 显 `NAV/QT`。
3. **三种环境皮肤**：机库（黄黑斜纹墙 + REQUEST TAKEOFF 键位 + 左下 THR/SHLD/COOL 功率三角 + GUNNERY/HUD%）；太空（深空 + ONLINE）；大气（地平线 + COLLISION 告警 + ATMO 读数）。截图1=机库、2=太空、4=大气。
4. **融入图 3–5 优点**：图5 的**护盾四象限数值网格**（受击区块跳数字）、右侧**任务目标面板**（COMBAT GAUNTLET / Waves / objectives，可复用为战斗状态）、左上全息随机型切换；图3/4 的**俯仰梯随姿态滚动**、地平线仪。
5. 中英：HUD 标签多为通用英文缩写（SCM/AB/G 等保持英文，符合 SC 风格）；告警/状态可中英（跟 `currentLang`）。

**本轮已修（布局/观感）**：左上全息改为 **Condor/执法者 顶视线框**（三态通用）；修掉 H/Q-FUEL 压住速度的重叠（油门值居中于油门条下方、燃料移到左下角）；**combat / cruise 删除中央 35/40 俯仰梯**（`state.ladder=false`，仅 atmo/hangar 显示），中央只留侧弧 + 准星，不挡视野。

**待做 · 机库跑道起飞感（hangar）**：现状画成"正面仓库横栏"是错的。改为**跑道纵深透视**——地板向中心灭点收敛的跑道线 + 两侧机库墙向远处斜收 + 跑道边缘指示灯 + 远端舱门/星空。复用首页 `drawPilotDeck`（它本就画了起飞跑道）作为 launch/hangar 背景，HUD 叠加其上 + `REQUEST TAKEOFF` 键位 + 左下 THR/SHLD/COOL 功率三角。

**✅ 已完成（第一版）· 戏剧化武器镜头序列** — `src/scene/combatCine.js`：`drawMissileCine`（自动锁定→发射→寻的追踪→命中白闪/冲击波/碎片）+ `drawNukeCine`（夜鹰激光指示并从两侧撤离→母舰 VLS 舱门开→核弹升起点火→末段跟踪→引爆）。已接进 `drawPilotFeed` 的 missile / nukeAuth 分支，由 `elapsed`（真实武器窗口）驱动、彗星方位用 `halley.curX/Y` 对齐；`?combatview=legacy` 回旧相机。**后续精修**：与 combatRuntime 真实命中时刻做帧级对齐、镜头切换加过场、核弹改用真 Condor/夜鹰模型离屏渲染。原始规格如下——

**原始规格 · 戏剧化武器镜头序列（combat view 内模拟，且与网页实际战斗时空对齐）**
> 关键约束：combat view 里的镜头必须与 `event-layer` 上真实发生的拦截（`combatRuntime` 驱动）在**时间与空间角度**一致——即镜头里导弹/核弹命中彗星的时刻、方位，要和页面上彗星被摧毁的时刻、屏幕位置对得上。实现时从 `combatRuntime` 取 halley 位置/相位/命中时间作为镜头时间线的锚点。
- **导弹（missile）模式**：进入后准星**自动锁定**彗星（锁定框由大收紧到贴合 + "LOCK"提示 + 蜂鸣），随后**发射导弹**，镜头跟随导弹尾焰**追踪彗星**（导弹拖尾 + 轻微寻的摆动 + 彗星在框内放大），命中瞬间白闪 + 碎裂；全程与页面上该武器的真实命中时刻同步。做出精美、符合现实弹道的运镜。
- **核弹（nuke）模式 — 多镜头序列**：
  1. 护航**夜鹰巡逻** + 对彗星发射**激光制导**（laser designation 光束指向彗星），随后战机**从屏幕两侧撤离**（划出画面）；
  2. 镜头切到**母舰（Condor/执法者）垂直发射系统 VLS 舱门打开**；
  3. **核弹头从 VLS 射出 → 点火**（尾焰拉长）；
  4. 镜头**一路跟踪核弹**飞向彗星，直至**命中摧毁**（强白闪 + 冲击波环 + 余烬）；
  5. 每一段镜头时长要算好，使核弹命中与页面上彗星被核打击摧毁的真实时刻/方位一致。
- 实现建议：在 `drawPilotFeed` 的 missile/nuke 分支用一个**镜头状态机**（`phase`/`t`）驱动；几何元素（导弹、激光、VLS、核弹、爆炸）用 2D 画在 pilotFeed，或离屏 three.js 渲染后 drawImage；时间线锚点取自 `pilotView.started/until` 与 `combatRuntime` 的真实事件。

---

## 4c. 首页 WebGL 上下文 / 性能审计 / Home WebGL context + perf audit

> 首页同时存在多个 WebGL 上下文，接近浏览器上限（Chrome ~16），有"上下文丢失 = 黑屏"风险；跃迁点 shader + 6000 粒子在弱机/手机上也吃 GPU。

**实测上下文清单（已核对，先前高估已修正）**：
- 常驻（2 个）：`saturnRenderer`（`#blackhole-gl`，raw GL 背景）、`alphardForge`（跃迁点 shader，离屏暂停但上下文常驻）。
- 按需懒建：`fighter3D`（护航）、`capitalShip3D`（主炮镜头，`getShip3D`）、`topdownCombat`（combat view / `?combat=topdown`）、`shipHologram`（舰长终端登录时动态 import）。
- **死代码（未激活，不占上下文）**：`bladeHologram.js`（无任何引用，可删）、`createShipRenderer`（`shipSide/RearRenderer = null`，从不调用，可删）。
- 结论：最坏并发 ~6 个上下文，**远低于浏览器上限（~16），上下文数量不是问题**；真正成本是跃迁点 shader + 战斗渲染的 GPU 占用，已被离屏/隐藏暂停 + dpr 上限充分约束。

**已做（本轮，全部活跃渲染器都加了 context-lost 韧性）**：
- `alphardForge` + `topdownCombat`：`webglcontextlost`(preventDefault) + `webglcontextrestored`(重渲染)。
- `fighter3D` / `capitalShip3D` / `shipHologram`（Three）：`webglcontextlost`(preventDefault)（Three 在 restore 时自动重建资源，且这些每帧重绘，无需手动重渲染）。
- `saturnRenderer`（raw GL）：canvas `webglcontextlost`(preventDefault) 保活。
- `topdownCombat` dpr 上限 2 → **1.75**（`alphardForge` 1.5、`capitalShip3D` 1.75）。
- 既有：主循环 `document.hidden` 暂停、`alphardForge` 离屏(IntersectionObserver)暂停、rAF 后台节流。

**剩余可选（低优先，需真机 profiling）**：
- 删死代码 `bladeHologram.js` + `createShipRenderer`（净化）。
- `saturnRenderer` 等 raw-GL 的**完整** context-restored 重建（目前仅 preventDefault 保活；上下文极少丢失，优先级低）。
- 跃迁点 shader 弱机自适应：降 fbm 八度（5→3）或分辨率（`navigator.hardwareConcurrency`/帧时探测）。
- 统一所有渲染器 `powerPreference` 与 dpr 上限到一处常量。

---

## 5. 各页设计备忘 & 未来点子 / Per-page notes & ideas

- **Arena**：可加"模型 vs 你"的历史胜率曲线；真实历史接 Twelve Data 后把 W/M/6M/Y/5Y 徽标改 `REAL`。
- **Sectors**：可把研判与 Arena 的 Opus 预测打通（同一数据源）。
- **Signal**：见下方 **5b Signal 专项**。
- **Games**：决赛阶段对阵确定后在 `games-data.json` 补 `home/away/result`；可加"夺冠路径"树状图。
- **全站**：完成第 2 节的导航统一后，新增页面成本将大幅下降。

---

## 5b. Signal 专项：美联储观察站 / Fed-watch station ★

> **页面使命**：捕捉美联储**日常政策变化与言论**对美股波动的影响。不是新闻站，而是"事件 → 利率路径重定价 → 美股/板块反应"的**传导链档案馆**。SCP O5 收容档案是叙事皮肤；内核是宏观事件驱动的交易情报板。

### 5b.1 案例研究：2026-07-02 六月非农（本次更新的锚点事件）

**数据（BLS，美东 7/2 8:30 发布，因 7/3 独立日休市提前至周四）**
- 新增非农 **+5.7 万**，大幅低于预期的 **+11.3 万**；4/5 月合计**下修 7.4 万**。
- 失业率 **4.2%**（一年新低，预期持平 4.3%）——但**劳动参与率同步降至 61.5%**：失业率下降是分母收缩（劳动力退出）造成的"虚假改善"，并非需求强劲。
- 结构：休闲酒店业 **-6.1 万**（季节性招聘疲弱，恰是 5 月 +17.2 万爆表的主贡献项）；增量集中在专业商务服务、社会救助与医疗（医疗也在放缓）。

**市场反应（发布后盘前）**：Bad news = good news。S&P 期货 +0.4%、纳指期货 +0.5%、道指期货 +0.5%，VIX -3.7% 至 16 下方，黄金 +1.3%。

**传导逻辑（这正是 Signal 要长期捕捉的链条）**
1. **事件前的定价**：5 月非农爆表后，市场已从"何时降息"漂移到"9 月前加息概率过半"（Fed 现区间 3.50–3.75%，新主席 Warsh 鹰派基调），6/5 当天纳指曾因强就业+利率恐慌大跌。
2. **数据落地**：57K + 下修 74K + 参与率下滑，直接击碎"劳动力过热 → 加息"叙事。
3. **利率路径重定价**：加息押注瓦解，9 月重新变成"活的"降息观察窗口；下一次 FOMC（7 月底）的措辞与 Warsh 记者会语气成为新的"收容失效窗口"。
4. **美股结构反应**：贴现率预期下移 → 长久期成长/AI 算力受益（盘前科技领涨）；但**若后续数据确认需求走弱**，叙事会从"降息利好"切换为"衰退担忧"——同一份弱数据在不同 regime 下方向相反，这是页面必须表达的核心张力。
5. **风险提示**：失业率因参与率下降而"失真"，后续验证点：初请失业金、JOLTS 职位空缺（7.6M）、7 月 CPI。若参与率持续下滑 + 时薪重新加速，则滞胀组合利空股债双杀。

### 5b.2 内容更新（本轮要改的静态内容）

当前四份档案（01 利率决议 / 02 主席监督 / 03 点阵图 / 04 威胁面板）仍停留在 **6 月 FOMC 之前**（"Warsh 首次会议"已过时）。需要：
- **01 O5 DIRECTIVE**：改为 **7 月 FOMC（7/28–29）** 的 CME FedWatch 概率；非农后 Hold/Cut/Hike 三条 bar 重刷（加息概率应大幅回落）。
- **02 ETHICS COMMITTEE**：Warsh 已开过首会 → 改为"鹰派基调 vs 走弱数据的第一次正面冲突"；关注点改为 7 月会后声明是否删除紧缩倾向措辞。
- **03 SEP 推演**：无 SEP 的会议（7 月无点阵图）→ 面板改为"9 月降息概率追踪"或"下次 SEP（9 月）前瞻"。
- **04 MTF THREAT BOARD**：`payrolls / wages` 从 FIRM 降级为 **CRACKING**（琥珀→需新增状态）；新增 `labor participation` 监控行（61.5% ↓）。
- **FOMC 倒计时**：确认 `FOMC` 数组含 7/28–29 及后续 2026 会期；DIRECTIVE 文案同步。

### 5b.3 设计路线图（分阶段）

**Phase 1 — 事件档案化（静态，先做）**
- 新增 **INCIDENT LOG（收容事件簿）** 区块：每个宏观事件（NFP/CPI/PCE/FOMC/主席讲话）= 一份编号档案，含：事件前市场定价 → 数据 → 重定价 → 美股当日反应四段式，用 5b.1 的六月非农作为**首份档案 INCIDENT-2026-NFP-06**。
- 事件倒计时从"只有 FOMC"扩展为**下一个催化剂**（NFP/CPI/FOMC 中最近者），标签如 `NEXT CONTAINMENT TEST`。
- 数据文件 `public/data/signal-events.json`（结构：`{date, type, name, before, print, repricing, equityReaction, verdict}`），页面渲染 + 中英双语；更新方式与 `arena-news.json` 相同（定时任务/手动）。

**Phase 2 — 传导链可视化**
- **BREACH METER（重定价仪表）**：横向双状态 bar 展示"事件前 vs 事件后"的 9 月降息/加息概率位移，位移越大 = 收容失效等级越高（Keter/Euclid/Safe 对应大/中/小重定价），把 SCP 等级变成**真实波动语义**。
- **鹰鸽罗盘**：主席+理事近期讲话的鹰鸽评分聚合成一个指针 dial（手动打分先行，后续可接文本分析）。
- **事件回放迷你图**：SPX 5 分钟线在发布时刻前后 ±2h 的 sparkline（Twelve Data 拉一次存 JSON），直观呈现"一句话/一个数字"造成的瞬时波动。

**Phase 3 — 自动化与联动**
- 定时任务：每逢 NFP/CPI/FOMC 日自动生成事件档案草稿（搜索+摘要 → `signal-events.json`），人工校对后发布。
- 与 Arena/Sectors 打通：事件日的 Opus 方向研判自动引用最新 INCIDENT 档案作为依据；首页 combat HUD 的"威胁等级"可选联动当日宏观事件（彩蛋）。
- FedWatch 概率若有可用数据源则自动刷新 01 面板；否则维持人工 JSON。

**设计原则**（沿用全站规则）：SCP 皮肤只做叙事包装，数据本体必须**真实、注明日期与来源**；所有研判标注 "not advice"；中英文案成对（`data-en/data-zh`）；新增区块继续用琥珀/绿机密文档配色，避免引入新色系。

---

*Desk view only · not investment / betting advice. 仅为台面观点，非投资或博彩建议。*
