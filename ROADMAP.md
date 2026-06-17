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

**优先级最高的一步：统一导航**
新增 `public/lib/nav.js` + 一个 `SITE` 配置（页面顺序、标题、prev/next 自动推导），让每页只放一个 `<nav data-afflatus-nav>` 占位，由脚本渲染。**这样以后加页面只改 1 个配置文件**，彻底消除"每页改导航"的重复劳动。

**分阶段计划 / Phases**
1. **抽公共库**：把 `clock` / `audio` / `viz` 三块从 arena/signal/games 抽到 `public/lib/`，各页 `<script>` 引入。零行为变化，先减重。
2. **统一导航**：`nav.js` + `SITE` 配置；替换四页内联导航与 `data-prev/next`。
3. **拆样式**：把各页 `<style>` 移到 `public/styles/<page>.css`，`<link>` 引入；公共 token（颜色/字体变量）集中到 `tokens.css`。
4. **拆 main.js**：按职责拆为 `state`（飞行状态机）、`hud`、`cursor`、`nav`、`boot`，main 只做装配。
5. **拆 styles.css**：用 `@layer base, hud, combat, starmap, responsive` 或 `@import` 分文件，集中响应式断点（统一 860 / 1080 / 520）。

**优化清单 / Optimisation checklist**
- 背景 canvas（arena-bg、scpCanvas、signal-scene）：`prefers-reduced-motion` 静帧、`visibilitychange` 暂停（已做）；可加 IntersectionObserver 在不可见时停。
- API 预算：Finnhub 自适应轮询（开盘前后快、休市慢，已做）；Twelve Data 历史按需 + 按天缓存（已做）。
- 资源：`public/*.js` 目前原样拷贝，未压缩；如需更小体积，可改为被 Vite 作为模块打包（注意保留多页入口）。
- 一致性：统一所有响应式断点、统一 `--reduced-motion` 处理、统一按钮反馈（已通过 `page-turn.css` 全局规则覆盖）。

---

## 3. 首页专项（待办）/ Home-app pass — planned

> 这是一块独立的大工程，需谨慎隔离改动，避免回归首页 3700 行 JS / 6900 行 CSS。

**3.1 皇牌空战式 HUD（起飞后 / 降落前）**
- 在 `src/ui/` 新增 `aceHud.js`：一个 HTML/CSS overlay，含 TIME/SCORE/TARGET、SPEED/ALT 方括号、WARNING/HIT 条、锁定准星、队伍血条、右下武器面板。
- 由飞行状态机驱动：`src/combat/combatRuntime.js` 暴露 `phase`（`takeoff → cruise → landing`），HUD 仅在 `cruise` 显示，起飞/降落做淡入淡出。
- 纯 DOM overlay，不动 Three.js 渲染管线，降低风险。

**3.2 高精度 F47 模型**
- 现状 `src/scene/fighter3D.js`（97 行）为程序化低面模型。
- 方案：引入 glTF 资源 + `GLTFLoader`（按需从 CDN 引入 three 插件），或显著提高程序化几何细节（机身分段、进气道、尾翼、挂载）。建议用 glTF，配 KTX2 压缩纹理；保留低模为加载前占位。
- 需要一个体积可控的免费/自制模型资源（这一步需要资产，故单列）。

**3.3 移动端布局**
- 在 `styles.css` 统一的 `@media(max-width:860px)` / `520px` 块中：隐藏雷达（`hud-left` 内 `#radarCanvas`）与右侧防御面板（`hud-right`），把战斗视图给到约 2/3、星图约 1/3。
- 需先确认 `combatView` 与 `terminalStarMap` 的容器层级，建议配合 `src/ui/combatView.js` 做一个 `mobile` 布局开关，而非纯 CSS 覆盖（更稳）。

---

## 4. 各页设计备忘 & 未来点子 / Per-page notes & ideas

- **Arena**：可加"模型 vs 你"的历史胜率曲线；真实历史接 Twelve Data 后把 W/M/6M/Y/5Y 徽标改 `REAL`。
- **Sectors**：可把研判与 Arena 的 Opus 预测打通（同一数据源）。
- **Signal**：SCP O5 档案风；可加"O5 投票"动画、收容等级随数据变化；FOMC 日历自动滚动。
- **Games**：决赛阶段对阵确定后在 `games-data.json` 补 `home/away/result`；可加"夺冠路径"树状图。
- **全站**：完成第 2 节的导航统一后，新增页面成本将大幅下降。

---

*Desk view only · not investment / betting advice. 仅为台面观点，非投资或博彩建议。*
