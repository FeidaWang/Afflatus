# Sectors 页 81k 式彻底改造 · 设计文档

- 日期：2026-09-28
- 分支：`feat/sectors-81k-redesign`（工作树 `.worktrees/sectors-81k`）
- 参考：https://www.anthropic.com/features/81k-interviews （2026-09-27 在浏览器中实测）
- 对象：https://feida.au/en/sectors.html 与 /zh/sectors.html（源文件 `sectors.html`，一份文件 + `data-en/data-zh`，构建时生成两种语言）
- 状态：待用户审阅

## 0. 已确认的决定

| 项 | 决定 |
|---|---|
| 改造范围 | 重组叙事 + 重做视觉。数据、数值、来源、日期、免责声明全部保留；只删重复表述 |
| 整体方向 | A：吸顶点阵舞台（序章）+ 窄栏衬线长文 + 宽幅交互模块 |
| 点阵含义 | 1 点 = 1 条观测（14 个模型配置 × 12 项指标 = 168 点），点阵在场景间变形 |
| 字体 | 衬线 Newsreader；无衬线 Hanken Grotesk；中文标题思源宋体（Noto Serif SC，按页子集化），中文正文系统黑体/思源黑体 |
| 字体范围 | **本轮全站切换**（规则见 §5） |
| 主题 | 仅浅色纸面主题（与参考页、现有 sectors 一致） |
| 部署 | 不部署；本地构建 + 截图交付，用户确认后再上线 |

## 1. 参考页实测要点（作为设计依据）

- 页面底色 `#FAF9F5`，舞台区 `#E8E6DC`，墨色 `#141413`，正文 `#30302E`
- 大标题衬线 61px/400，行高 1.2，字距 −0.16px；小标签无衬线 13px/700，字距 0.08em，全大写
- 首屏：点阵地球 + 标题 + 导语；下方"荧光笔标签 + 衬线引语（打字机）+ 圆点分页器"；底部居中"Jump to story"胶囊按钮；右下角"Each dot represents 4 respondents"
- 滚动时地球旋转、局部着色（琥珀/绿/蓝，60% 透明），引语随之切换；关键词用荧光笔底色（如 "hope" 绿色高亮）
- 后半段是窄栏衬线长文（约 18–20px，行高 1.6），穿插引语块（左侧细线 + 无衬线大写署名）和宽幅图表（气泡散点、条形对比）

## 2. 叙事结构

依据页面自己的"五个问题"：能做什么 → 用起来多少钱 → 依赖什么 → 谁持有 → 怎样证明我错了。

### 2.1 序章 · 点阵舞台（吸顶，6 个场景，约 6 屏滚动）

| # | 场景 | 点阵状态 | 文字卡片（来源：现有文案） |
|---|---|---|---|
| S0 | 开场 | 168 点散布于陆地点阵地球，缓慢自转 | 标题"Where does AI's value go? / AI 的价值流向哪里？"+ 导语；三句论点打字机轮播 + 圆点分页器（现 `#sectorsEarth` 三句） |
| S1 | 两个生态 | 地球转向美/中，点按实验室所在地聚集并着色（美蓝、中琥珀） | "Two ecosystems, one connected frontier"；美 6 / 中 8 配置，开源权重 0 / 8，中位综合分（现 `#geographyEditorial`） |
| S2 | 同分不同强项 | 点从球面剥离，排成 12 条横向指标分布带（同值垂直堆叠）；Astra 与 Fable 两组点高亮连线 | "The same headline score can hide different strengths"（现 `#capability` 首段） |
| S3 | 能力 vs 成本 | 每个模型的 12 点汇聚为 1 点，落到"对数成本 × 综合指数"散点；帕累托线描出 | "One frontier. Many different strengths" 核心句 |
| S4 | 依赖什么 | 模型点沉入产业链五层（应用/模型/芯片/存储与网络/电力），其余层亮起关联公司点 | "Different models can depend on overlapping infrastructure"（现 `#supply`） |
| S5 | 谁拿走价值 | 4 家已核验发行人（Broadcom、Micron、Alibaba、Xiaomi）的点放大带名；其余淡出 → 舞台结束 | "A model is not an investment instrument" 首句（现 `#issuers`） |

- 舞台右下角固定说明："每个点 = 一条观测 / Each dot is one observation"（S4–S5 切换为"每个点 = 一个模型或公司"——当点的含义变化时说明随之变化，避免误读）
- 地理说明沿用现有免责："Earth geometry: Natural Earth (public domain)"

### 2.2 正文 · 长文 + 交互模块

| 章 | 标题（沿用现有） | 内容与模块 | 合并自 |
|---|---|---|---|
| 引言 | A frontier is more than a leaderboard. | 两段导语 + "证据墙"入口 | `#editorialIntro`（保留，改版式） |
| 1 能力 | What changes when the task changes? | **模型榜**（宽幅）：按 12 项指标切换排序；行内展开模型档案；三个"条件镜头" | `#frontierEditorial`、`#capability` 后两节、`#sectorsFrontier` 的 lenses / distributions / board / dossier |
| 2 成本 | Cheaper inference changes the arithmetic | **能力–成本散点**（宽幅，可悬停/键选）+ **计费计算器** + 证据缺口 | `#sectorsFrontier` 的 plot / billing / evidence-gaps、`#migration` |
| 3 依赖 | From one workload to a dependency network | 工作流示意 → **依赖网络图**（宽幅）→ 公司与角色 | `#frontierTaskStory`、`#supply` 正文、`#storyGraphSection` |
| 4 持有 | A model is not an investment instrument. | 4 家发行人卡片（观察项/风险可展开） | `#issuers` |
| 5 可能错在哪 | Every thesis needs a way to be wrong. | T01–T08 做成 81k 式引语块（衬线大字论点 + 无衬线署名"Editorial hypothesis"+ 不确定性），证伪条件与来源可展开 | `#evidence` |
| 附录 | Source ledger · 历史档案 | 来源台账、方法、证据墙弹窗、**历史档案 K3 全部原样保留（折叠）**，只统一字体与配色 | `#frontierDossierSources`、`#researchArchive` 及其内全部 rivalry 区块 |

### 2.3 删除清单（仅删重复，实施时逐条对照）

1. `nav.frontierIndex`（"五幕阅读顺序"导航）——由舞台与章标题取代
2. `#geographyEditorial` 的地图模块——地理叙事移入舞台 S1；其中国别计数与说明文字移入 S1 卡片
3. `#capability` 的首段——与 S2 卡片、`#frontierEditorial` 讲同一结论，保留 S2 版本
4. `#sectorsFrontier` 页头"One frontier. Many different strengths."导语——并入 S3 卡片与第 1 章导语
5. `#frontierEditorial` 内按模型逐个重复的"SELECTED CONFIGURATION"说明卡——改为模型榜行内展开，文字不丢
6. `#sectorsEarth` 现有 three.js 地球——由新点阵舞台取代（`src/showcase/earthScene.js` 本身保留，其他页面在用）

不在清单上的文字一律保留。实施后用脚本比对新旧页面的全部 `data-en/data-zh` 文本，未出现在新页面的条目必须能在本清单中找到对应项。

## 3. 视觉系统

### 3.1 色彩（CSS 变量，定义于 `public/styles/sectors.css` 的 `.sectors` 根）

| 变量 | 值 | 用途 |
|---|---|---|
| `--paper` | `#FAF9F5` | 正文区底色 |
| `--stage` | `#E8E6DC` | 舞台底色 |
| `--ink` | `#141413` | 标题、强调 |
| `--text` | `#30302E` | 正文 |
| `--muted` | `#77756E` | 次要说明（对 `--paper` 对比度 ≥ 4.5:1，实施时校验） |
| `--rule` | `#D6D4CC` | 分隔线、边框 |
| `--us` / `--us-ink` | `#86B6EF` / `#3E6FB0` | 美国（点/文字） |
| `--cn` / `--cn-ink` | `#EDA100` / `#9A6A00` | 中国（点/文字） |
| `--mark` | `#BFDE8D` | 荧光笔高亮、选中项 |
| `--land` | `rgba(20,20,19,.18)` | 陆地点阵与经纬网 |

去除全部阴影、渐变、霓虹/发光；边框只用于可交互对象。

### 3.2 字号（桌面 / ≤640px）

| 角色 | 字体 | 规格 |
|---|---|---|
| 展示标题 | Newsreader 400 | 64/40px，行高 1.15，字距 −0.01em，`text-wrap: balance` |
| 章标题 | Newsreader 400 | 40/30px |
| 小节标题 | Newsreader 500 | 24/21px |
| 引语 | Newsreader 400 | 28/22px，行高 1.35 |
| 正文 | Newsreader 400 | 20/18px，行高 1.6，栏宽 640px |
| 导语/说明 | Hanken Grotesk 400 | 15px，行高 1.5 |
| 标签 | Hanken Grotesk 600 | 12px，全大写，字距 0.08em |
| 数据 | Hanken Grotesk 500 | `font-variant-numeric: tabular-nums` |
| 中文标题 | 思源宋体 600 | 同上字号 × 0.92 |
| 中文正文 | 系统黑体（PingFang SC / Microsoft YaHei / Noto Sans SC） | 17px，行高 1.8，栏宽 38em |

### 3.3 版式

- 三种宽度：正文 640px / 交互模块 1120px / 舞台全出血；手机两侧留白 20px
- 章首：章号小标签（如"01 · CAPABILITY"，编号对应真实顺序）+ 衬线章标题 + 一句无衬线导语
- 章间距：桌面 160px，手机 96px
- 页面顶部只保留站点统一导航

### 3.4 动效

| 动效 | 规格 |
|---|---|
| 舞台变形 | 滚动进度逐帧驱动（可倒放）；点位插值 easeInOutCubic；每点按序号错峰 0–120ms 等效进度 |
| 地球自转 | S0 空闲时 6°/s；进入 S1 时插值到目标经度 |
| 打字机 | 28ms/字，句间停留 2.4s；分页器可点击跳句 |
| 荧光笔 | 关键词背景从左到右 600ms 扫入，进入视口时触发一次 |
| 长文图表 | 进入视口时画线/长柱 700ms 一次；数字计数 800ms 一次 |
| 文字 | 16px 上浮 + 淡入 400ms，初始状态可见（不依赖观察器才出现） |
| 悬停 | 点/行显示小标签，150ms |
| 减少动态 | 舞台显示各场景最终静态帧（按场景顺序排列）；无打字机、无扫光、无计数 |

## 4. 技术实现

### 4.1 点阵舞台

- 新模块 `src/sectors/stage/`：`projection.js`（正交投影、正反面判定）、`layouts.js`（6 个场景的纯函数布局：输入数据 → 每点目标坐标/颜色/半径）、`stage.js`（Canvas 2D 渲染 + 滚动进度映射）
- 陆地点阵复用 `src/showcase/globeAsset.js`（已在用的 Natural Earth 点集），不新增地图数据
- 结构：`<section class="stage">` 内一个 `position: sticky` 的画布层 + 6 个普通 HTML 文字卡片；进度 = 该 section 的滚动位置
- 画布尺寸按 `devicePixelRatio` 上限 2；离屏时停止绘制；168 点 + 陆地点阵保持 60fps 目标
- 回退：无 JS / 减少动态 / 画布失败 → 每个场景一张静态 SVG 帧（构建时由同一 `layouts.js` 生成，保证与动画一致）

### 4.2 长文交互模块

- 复用现有数据加载与计算：`frontier-core.mjs`、`explorer-core.mjs`、`dependency-core.js`、`dossier-data.json`、`sectors-data.json`、`sectors-frontier/2026-09-23.json`
- 只重写视图层（DOM/样式）；计算函数签名不变，现有单元测试继续有效

### 4.3 字体

- 下载 OFL 字体（Google Fonts 源文件）到 `public/assets/fonts/`：Newsreader（可变，opsz+wght，latin + latin-ext）、Hanken Grotesk（可变，latin + latin-ext）、Noto Serif SC（600）
- `@font-face` 写入全站共用的 `public/page-turn.css`，`font-display: swap`，拉丁字体 `preload`
- 新脚本 `scripts/subset-cjk-fonts.mjs`（纳入 `prebuild`）：收集各页面 `data-zh` 与中文正文字符 → 用 fonttools `pyftsubset` 生成 `noto-serif-sc-subset.woff2`；许可证文本加入 `THIRD_PARTY_NOTICES.md`
- 全站字体变量（`page-turn.css`）：`--font-serif`、`--font-sans`、`--font-serif-zh`、`--font-sans-zh`

## 5. 全站字体切换规则

原则：**替换"通用文字角色"，保留"刻意的主题字体"**。

| 页面 | 衬线角色 → Newsreader / 思源宋体 | 无衬线角色 → Hanken Grotesk | 保留不动 |
|---|---|---|---|
| 首页 `index.html`（`src/styles.css` 等） | 是 | 是 | JetBrains Mono（数据/遥测） |
| Sectors | 是 | 是 | — |
| Portfolio（`--pf-serif` 已是 Newsreader，`--editorial-serif` Libre Baskerville） | 是 | 是 | 数字等宽 |
| Course（Georgia / Arial Narrow） | 是 | 是 | IBM Plex Mono |
| Serial / 小说 | 是（中文正文仍用思源宋体，阅读体验优先） | 是 | JetBrains Mono |
| Signal / Signal dispatch（Iowan） | 是 | 是 | Marathon/Anton 展示字、JetBrains Mono |
| Horoscope（Spectral / Noto Serif SC） | 是 | 是 | IBM Plex Mono、星座符号字体 |
| Arena（Orbitron/Rajdhani HUD；arena-market 的 Georgia/system） | arena-market 是 | arena-market 是 | Orbitron、Rajdhani（HUD 主题） |
| Games、League（Chakra Petch / Cinzel / Rajdhani） | 否 | 否 | 全部保留（游戏主题） |
| 公共导航、页脚、404 | — | 是 | — |

用户可在审阅时逐行改这张表。

## 6. 测试与验收

### 6.1 注意：未提交的 sectors 测试

主工作区中 `e2e/sectors-*.spec.js`、`tests/sectors{Frontier,RefreshP5,DossierP4,ExplorerP3,DependenciesP2}.test.js` 等为**未提交文件**，不在本分支。本分支会把它们复制进来并按新结构改写后提交；合并回主线时，主工作区里这些未跟踪的旧文件需要先移走（届时再与你确认）。

### 6.2 测试改写清单

| 文件 | 处理 |
|---|---|
| `tests/sectorsFrontier / ExplorerP3 / DependenciesP2 / DossierP4.test.js` | 计算逻辑测试保留；DOM 结构断言改为新选择器 |
| `tests/sectorsRefreshP5.test.js`、`tests/sectorsMediaContract.test.js` | 按新结构改写（three.js 地球相关断言改为舞台） |
| `e2e/sectors-editorial / frontier / p2 / p3 / p4 / reference-design.spec.js` | 合并为 `e2e/sectors-story.spec.js`（舞台场景推进、模块交互、中英文、四种宽度）+ 保留 bfcache 用例 |
| `e2e/visualization-accessibility.spec.js`、`e2e/afflatus-brand.spec.js` | 更新选择器与字体断言 |
| 新增 `tests/sectorsStageLayouts.test.js` | 6 个场景布局纯函数：点数守恒（168）、坐标在画布内、同值堆叠不重叠、颜色与地理一致 |
| 新增 `tests/sectorsCopyParity.test.js` | 新旧文案比对（§2.3 规则）；中英文条目一一对应 |

### 6.3 验收标准

1. `npm run build`（含 CSS 架构、双语、SEO、OG、站点清单检查）通过
2. `npm test` 与 sectors 相关 Playwright 测试通过
3. 320 / 390 / 768 / 1440 宽度 × 中英文截图复核，无横向滚动、无文字截断
4. axe 无新增严重/重大问题；减少动态模式下内容完整；键盘可操作全部交互
5. 页面所有数值与数据源文件逐项一致（脚本比对）
6. Lighthouse：sectors 首屏 LCP、CLS 不劣于 `lighthouse-baseline.json`；全站字体切换后各页 CLS 不劣化
7. 其他页面字体切换后逐页截图（桌面 + 手机），交你过目

## 7. 不做的事

- 不改数据、不新增数据源、不做"实时"数据
- 不做深色模式
- 不使用或分发 Anthropic 字体、标志或代码
- 不部署
