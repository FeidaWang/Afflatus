# design.md — Project Afflatus UI/UX 体系、美学与主题圣经（SSOT · Disaster-Recovery 级）

> **本文件性质**：全站重构期间的设计唯一真源（与 `tech.md` 成对——本文件管「造成什么样、为什么」，tech.md 管「怎么造」）。任何新功能上线前先过本文件的宪章与红线，答不上「它在这页的世界观里是什么设备」就不上。
> **整理基线**：2026-07-18。来源：U22 视觉宪章、U27d 人格分层、U30 重设计裁决、U41–U46 逐页改版记录、roadmap §2/§7.10 模块三、KNOWLEDGE §3。

## 目录

1. 主题叙事与内容包装 · 2. 排版驱动 UI 与终端美学 · 3. 交互微效果 · 4. UX 整改与可达性 · 5. 内容与措辞红线 · 6. 验收纪律

---

## 1. 主题叙事与内容包装（Thematic Storytelling）

### 1.1 核心方法论：叙事外壳（narrative shell）

干数据必须包裹在世界观里——这是本站与「又一个数据仪表盘」的根本区别，产品化期间**一件不拆**（U46-甲-1 不可回退准则）：

| 数据域 | 叙事外壳 | 页面 |
| --- | --- | --- |
| 个人投资持仓/回报 | 深空舰长日志：回报=跃迁，持仓=资产甲板，风控=舰载防御 | index |
| 金融市场/美股 TA | 赛博竞技场（arena）：模拟盘=Autopilot 双模型对战，基准=SPY/SMH 陪练 | arena |
| 中美 AI 产业 | 双阵营星域/矩阵：US/CN 引力极、厂商=恒星、个股=卫星 | sectors |
| 美联储政策 | SCP 机密档案：Fed=收容对象 FED-26，等级 Keter（经济），FOMC=收容测试，鹰鸽=罗盘 | signal |
| 体育/电竞竞猜 | AI 预测日志：模型公开押注、战绩全量存档可回溯 | games/league/stats |
| 传统命理 | RPG 化：神煞=暗黑2稀有度色阶，合盘=关系称号社交货币，签到=抽卡 collectible | horoscope |
| 小说连载 | 复古未来主义书房：书架→阅读器，皇家木色三主题 | serial |

**执行法条**：宪章①「每个 UI 元素是一台舰载设备」+ U27d 分层——**每页一个人格，不做缝合怪**（SCP 皮肤不出 signal，竞技场语汇不进 horoscope）。新功能立项先答「它在这个页面的世界观里是什么设备」。

### 1.2 六条视觉宪章（U22，全站裁决标准，源自四作各取一件当家本领）

① **每个 UI 元素是一台舰载设备**（星际公民 · diegetic UI）——界面悬浮在场景里而非贴在网页上；加载=SCANNING、空态=NO CONTACT、错误=OFFLINE，三态全部舰载化措辞。
② **每个读数绑一个真实状态**（精英危险）——装饰性读数一律不留；遥测只放真数据（时钟/实测 FPS/相机模式）；假 OK 绝不打印（boot 自检每行 OK 只在对应 promise 真 resolve 后出现，失败诚实打 OFFLINE）。数据缺失时明说（星域 `hasConfidence:false` 的 universe 节点显示「在交易域名单上、无厂商关联论点存档」而非编一个分数）。
③ **运动即信息，无信息不运动**（家园 · 弹道芭蕾）——尾迹/弹道/爆闪本身是信息载体；动画只用 transform/opacity；所有运动有质量感（smoothDamp 临界阻尼，禁线性 tween）；镜头永不瞬移（切换必有 ≤0.5s 位姿插值）。
④ **剪影先于细节**（家园）——舰船在最远镜头下靠轮廓剪影可辨识（建模验收：涂黑看剪影）；背景星云低饱和水彩色带，永不抢主体。
⑤ **双色温纪律**（精英危险）——**冷色=世界/数据（青/白），暖色=自身/警示（琥珀）**；武器四色为唯一例外域。首页青白 HUD + 琥珀告警即此规则的 token 化。
⑥ **渐进披露**——默认一层（图标+一个数字），展开两层（完整卡片），**禁止第三层**。帝国级信息密度靠层级不靠字数。

## 2. 排版驱动 UI 与终端美学（Typography-as-UI）

### 2.1 纪律（U46-甲-2，装饰约束升级为硬规则）

- **布局重于图形**：新页面先用字重/字距/留白解题，图形是最后手段。
- **深底高对比**为默认底色体系；霓虹色只做点缀不做正文色。
- **Monospace 字族**承载数据/终端语感；每页保留独立字体身份（这是设计选择不是重复，禁「统一字体」型伪优化）。
- **ASCII 装饰系统**（`[ ]` `//` `---` `██████` 进度块）：一律 `aria-hidden`，**不得进入语义流**。
- 强调色心理学：绿=live/支撑/成功 · 红=阻力/亏损/危险 · 琥珀=警示/自身 · 青=世界/数据。

### 2.2 各页调色板与字体身份（重建对照表）

| 页 | 底/主色 | 强调 | 字体 |
| --- | --- | --- | --- |
| index | `--bg:#04060a` `--ink:#e4e8f0` `--dim:#69748c` | `--cyan:#8db4c0`（世界）`--warm:#e8b380`（自身） | Orbitron / Rajdhani / JetBrains Mono |
| signal | 纸感档案 `--doc:#d6d4cc` on `#1b1b1e`，panel `#232327` | `--amber:#f5c400`（hazard）`--green:#3fb950` `--red:#b3261e`；mood 变量随 FOMC 偏向切换 | Oswald（disp）/ Space Mono |
| sectors | 纯黑底白字（U36 起） | 青 `#00C3D7` / acid；公司一律真实品牌色+产品图标（禁通用渐变） | 系统无衬线 + mono |
| games | WC26 官方配色：藏青 `#1B2766` / 金 `#9F7D23` / 白（U40） | 品红/青赛博残留仅点缀 | mono 系 |
| stats | `--bg:#070a12` `--panel:#0d1220` `--ink:#dce8f2` | `--teal:#4fd6c4` `--gold:#e8ad6f` `--red:#e0596b` `--green:#57c98a` | JetBrains Mono |
| horoscope | 治愈系：暖奶油/鼠尾草绿/赤陶橙/淡金（V21 定调，逃离「深紫神棍风」）；星盘/夜间模块唯一允许深色=墨水蓝 `#1a2440`+淡金星点（「星图手账」非「水晶球」） | 文字一律深色变体，逐一过 WCAG AA | 中文衬线 + 几何无衬线 |
| serial | 阅读区双主题（`.reader[data-theme]`，U-toolbar-redo 起）：green（默认·日间护眼）`#c8dfcb`/`#213325` · night（夜间琥珀·低蓝光）`#211a12`/`#e8c98a`（实测对比度 8.5–10.8:1 全过 AA）；退役的第三主题「皇木」`#2b1a16→#231411` 移作全站页面背景（`body{background}`），不再是可选阅读主题 | `--read-accent` 随主题 | 中文衬线（正文）+ mono（工具条） |
| arena | `--bg:#05070e` `--panel:#0b0f1c` `--text:#eaf1ff` `--muted:#8590b5` | `--acid:#3dff9a`（涨/支撑/Model 系）`--cyan:#27e7ff`（世界/数据，链接·边框·标签）`--down:#ff5470`（跌/阻力）`--blue:#3a5bff`/`--magenta:#ff3df0`（点缀，Autopilot 双模型区分色之一）；双色温纪律在此页体现为「酸绿=活/涨，青=系统语汇，暖色不出现」 | Orbitron（展示）/ Rajdhani（HUD 标签）/ JetBrains Mono（数据体） |
| course/league | violet 系 / 海克斯金蓝 | — | 各自独立 |

### 2.3 暗色模式纪律

深底站点的可读性防线：正文行高 ≥1.6（serial 1.95）、行长 ≤68ch（signal U41 立规、serial U46 补齐）、次要文字 `--dim` 类 token 对最深底必须 ≥4.5:1（U21 Phase 3 曾抓出 4.32:1 的真失败 token）。亮动态背景（星云）上的文字必须不透明纯色+不透明面板（tech.md §9-9）。

## 3. 交互微效果（Signature Micro-Interactions）

> 实现细节与数学在 tech.md §4.4/4.5；此处记设计语言与参数手感。

- **星门 sticky 缩放舞台**（首页 stardrive，30e→默认）：滚动进度 `--forge`(0→1) 驱动容器 `scale(.8→1)`+圆角 32px→0「星门迎面展开」；caption/tagline/strip 分层多向视差；缩小态带淡青描边光的「取景窗」框（裁切边 diegetic 化）；`prefers-reduced-motion` 直出终态。年化回报指标条（38.66% 四件套）锚定 hero「航向·奇点王座」正下方（U45）。
- **滚动叙事**：signal 事件卡 `animation-timeline:view()` 错速浮入（奇偶卡不同 range/方向）；阅读进度条 `.readProgress`；一切滚动驱动零 JS 监听。
- **共享元素转场**（View Transitions API）：serial 书架封面→阅读器头图跨态 morph（`view-transition-name:novelMorph` 临时授予、转场后清空）；signal 事件卡点击展开 dossier。
- **卡片二层翻转**（U44 pick-card）：`.pcCover`（ticker/权重）hover/tap/`:focus-visible` 三入口切 `.pcDetail`（论点+CTA），transform+opacity 320ms；触屏用 `.open` class 点击切换。
- **手风琴**（sectors cards-4）：`flex:1→3` + line-clamp 放开，仅 `hover:hover and pointer:fine`（触屏保持常显堆叠，不强迫）。
- **力导向图**（sectors）：US/CN 双引力极、拖拽回弹、呼吸浮动；点击节点=详情卡；旧矩阵表降级为 `<details>` 折叠（渐进披露）。
- **3D 数据星域**（sectors `?fx=starfield3d`）：全屏 modal 体验，实心圆片（NormalBlending）+ Manhattan 线格 + 尘埃场；轨道/惯性/fly-to 全走 smoothDamp；鼠标视差=加性偏移叠在 azimuth/elevation 上（拖拽时挂起、RM 归零）；配色青=US/金=CN/白=未评分 on 纯黑。
- **鼠标视差**（首页 hero，U44）：`--mx/--my` CSS 变量，各元素系数不同做纵深（-10px/-6px 标题、-4px/-2px 序号），负号=逆光标漂移；首帧默认 0 零 CLS；hover:hover 限定。
- **战斗视图**：3D 俯视战场默认 + 导演运镜（镜头库 tacticalTopdown/bridgeWide/mainGunAxis/missileTail/ciwsTurret/chaseCam/deckCam/towerCam/flybyCam）；起降完整生命周期叙事；尾焰彩带 billboard 三段色老化淡出；HMD v3 座舱。bloom/冲击波级别的「效果冲顶」曾整批被站主 revert（U25）——**战斗视觉的浓度以站主口味为准，宁欠勿过**。
- **页间转场**：`transition.js` 按目标页选类型（warp/cannon/takeoff/control/cyber）+ Web Audio 环境音（`audio.js`）；语言切换=warp 折叠脉冲（400ms 一次性）。
- **微反馈**：一切可点元素 hover/active/`:focus-visible` 三态；任何操作 200ms 内可见反馈；count-up 数字入场（IntersectionObserver 一次性触发）。
- **OpenAI 基准图表几何**（arena/stats 图表层，U-viz-openai 起，2026-07-21 定稿）：借鉴 openai.com 基准对比图的**几何与行为**（非其中性灰调/字体）——无卡片边框/无图背景，图表直接落在页面底色上；栅格只留基线+顶线两条实线（`--viz-grid`），不留虚线网格；线宽 1.5px + 末端圆点标记（marker-terminated）；配色仍走各页自有色板（arena：Model A/B 用 acid/cyan 系，SPY/SMH 基准用虚线降透明度，虚线=「这是模拟基准线不是真实历史」的诚实标记，非装饰）；悬浮提示统一走 `--viz-tip-*` token（近黑面板、8px 圆角、无箭头、`Label: value` 纯文本行）。此几何一旦引入即全站图表共享语言，新图表复用 token 不重新发明。
- **价位标尺（Level Ladder，arena TA 面板）**：单价格轴上同屏叠加阻力/支撑/MA/枢轴/整数关口/突破位/缺口，真实价格位置（`trueY`，背景带/水平线）与文字标签位置（`labelY`，防重叠 declutter）分离——标签可被挤开但短引导线永远连回真实价位，禁止「标签飘走查无实据」。容器高度随标签拥挤程度自适应变高，而非压缩到不可读。
- **锁定态（gated state，Part 4 §18.2.2/§20，2026-07-23 起）**：面板请求的标的若不在当日免管理员密钥可查名单内，不显示通用报错，而是专属锁态文案（🔒 + 双语说明）+ 内嵌解锁表单（密钥输入框 + 「解锁」按钮，提交即存入 `sessionStorage` 并重试该标的）；密钥被拒时文案切换为「该密钥未通过验证」而非重复通用说明。解锁成功后 hero 状态条出现 🔓 ADMIN UNLOCKED 常驻绿色 chip，点击可二次确认清空密钥重新锁定。延续「宪章②每个读数绑真实状态」——查询失败必须诚实区分「代码错了/网络错了」与「本来就被有意限制」，不可混为一谈。
- **今日推荐交易面板（picks board，Part 4 §18.2.1，2026-07-23 起）**：替代旧的 30-symbol 自选股 chip 行——三栏并排（S/P/T 各一栏，`auto-fit(minmax(280px,1fr))` 窄屏自动收为单列），每栏顶部色条=模型主色（沿用 Autopilot 图例色，S=acid/P=cyan/T=magenta），栏内是卡片而非 chip：代码+信心度进度条+入场/止损/目标三段价位梯 + 可选到期平仓日 + 一句话论据 + 信号标签。空仓日不留空白，显示「今日不下单」。卡片本身是交互入口——点击/回车即派发 `arena-pick-select` 事件驱动下方 TA 面板加载该代码，搜索框仍保留给「我想自己找」的场景，两者并列而非互斥。日期/regime chip + 陈旧提示条（推荐超过一天未更新时变琥珀色，说明这是「最近一次可用推荐」而非「今日」）延续 provenanceBadge 的数据龄诚实纪律。

## 4. UX 整改与可达性（Remediation & A11y Plan）

### 4.1 术语渐进披露（U46-乙-①，已上线组件）

行话（用户可见的才算）统一走共享术语组件：点状下划线 + 简明白话浮层。**hover 专属信息零容忍（22c 铁律）→ `.term` 必须是可聚焦真按钮**，点按/Enter 同效，Esc/失焦/滚动关闭。注册表 `termGlossary.js`（sharpe/drawdown/beta/keter/sep/brier/bootstrap 首批），解释必须一句白话双语——写不短说明术语本身该换。落点：首页年化面板 Sharpe/Max Drawdown/Beta、signal Keter/SEP、stats Brier/Bootstrap。每页立项时增补，宁缺毋滥。

### 4.2 响应式降级（U46-乙-②，审计制非一刀切）

- **规则**：凡 ≥2 列的 grid/flex 布局必须在 ≤480–768px 有单列（或自然塌陷）档——但以**逐页审计**落实，不写「<768px 全部强制单列」的空头立法（多数页早有 520–900px 降级段，盲目立法只会重复劳动）。2026-07-18 全站 9 页代码级审计结论：唯一真破版 = sectors `.macro`（已修）；horoscope `.zw-grid` 仅拥挤不溢出（fr 轨道，不动）。
- **「横屏查看」提示组件**：设计保留（`.rotateHint` 虚线框、可点×关闭记 localStorage、**建议不拦截**——强制横屏遮罩与内容站身份冲突，U23 同源裁决）；**当前无落点不上线**——games 淘汰赛树已有 `overflow-x:auto`、stats 分布图是 viewBox 响应式 SVG。触发条件：未来出现真正无法回流的宽可视化时按此设计接入。
- **触控**：交互元素热区 ≥44px——`position:relative`+`::before{inset:...}` 扩热区**不改视觉尺寸**（D4 模式）；核心操作收拇指区；移动端裁剪（星域粒子减半、节点封顶、`<560px` 关镜头震动）。

### 4.3 阅读疲劳与暗色眩光（U46-乙-③）

- 长文页（serial）**双档阅读模式**（green 日间护眼 / night 琥珀夜读，U-toolbar-redo 起，原第三档 imperial 已退役为页面背景），工具条切换 + localStorage 持久化 + AA 全过——重构时保留，勿当新需求重做。
- **SYS 面板（U-sys-panel）**：小说内系统提示（`type:"sys"` 块）渲染为「跨界游戏终端」卡片——冷青绿低蓝光「屏幕」对暖色衬线正文，mono 字体 + 扫描线 + 虚线内框 + 标题芯片（正文首个`【…】`解析为面板标题）+ 呼吸态链接点（`prefers-reduced-motion` 下停用）。护眼实测：日间 ink/bg 9.8:1、accent 7.1:1；夜间 11.7:1 / 9.8:1。色值随 `.reader[data-theme]` 走 `--sys-*` token，重构时整体保留。
- 排版规格：正文 `line-height ≥1.7`（serial 实为 1.95）、行长 `max-width:68ch`、字号 17px 档。
- **SCP/终端人格页（signal/arena）不提供亮色档**——作战情报室开日光灯是人格破坏；那些页的可读性靠字号/行高/对比度解决（U41 已做 17px/1.6 一轮）。

### 4.4 双语与国际化

文案 `data-en`/`data-zh` **成对**是内容红线；microcopy 单行封顶；切换后动态内容监听 `afflatus-lang` 重渲染（浮层开着时同步刷新）。首页独立管线见 tech.md §5.2。

### 4.5 动效可达性

`prefers-reduced-motion` **全覆盖**：滚动动画直出终态、镜头固定 bridgeWide、粒子密度减半或关闭、视差归零、翻卡/转场跳过。这是新增视觉的验收前置项，不是可选项。

### 4.6 信息密度治理（22c）

长表降维为「卡片 + sparkline + 对比锚点」——数字必须带趋势方向和参照系（vs SPX 模式）；每页首屏一句话结论，细节渐进披露；解释性文字改图标+tooltip。

## 5. 内容与措辞红线（全站永久）

- **仅供娱乐 / not advice**：投资/竞猜/命理全域常挂；三态信号必挂公开战绩（hitRate+Brier），站方不替读者下结论。
- **禁付费解锁·焦虑营销·黑模式钩子**：「今日大凶点击化解」类一律禁止；缘分日历做**时间解锁**不做付费解锁；streak 文案用「还差 N 天解锁」到点即消失的正向倒计时，非常驻催促。
- **康健域只说作息不说病**。
- **合盘措辞**：红旗提示只描述摩擦模式+相处建议，禁宿命论断（「注定分手」类不产出）。
- **数据真实**：SCP 皮肤只做叙事包装，数据本体必须真实、注明日期与来源；不冒充（两点基准线用虚线图例注明非真实历史曲线）；未验证的文献表在代码注释里如实标注。
- **Web Push 不做**（Tier 0 零基建召回先行：分享卡回流环/ICS 日历订阅/streak 文案；D7>15% 才重评，届时也只 opt-in 每日 ≤1 条永不焦虑钩子）。
- 中文引号「」；免责声明进每页页脚；Local-First 隐私承诺写进命理页页脚。

## 6. 验收纪律（设计侧）

1. **沙盒无法渲染** → 一切视觉改动站主真机验收才算关闭；高风险视觉 flag 起步（`?fx=` 等），真机确认后转默认。
2. **R3**：待真机验收 >5 项冻结新视觉改动（flag 隔离项豁免）。
3. 新视觉上线自查清单：宪章六条逐条过 → RM 降级 → 22c 无 hover 专属 → 双语成对 → `!important` 零新增 → 独立 rAF 零新增 → 触屏等价交互 → 该页人格未被稀释。
4. **参考站点消化模式**（U30 定式，Two Sigma/Apple Sports/Accenture/openai.com 四轮验证）：**效果照收，库一个不引**——交互模式是价值，指定库不是；一律先核实仓库现状再写规格（prompt 声称的现状常过期）。

---
*交叉引用：所有实现路径、算法、schema、防坑清单见 `tech.md`。*
