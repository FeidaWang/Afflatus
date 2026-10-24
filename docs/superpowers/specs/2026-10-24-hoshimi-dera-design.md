# 星見寺（Hoshimi-dera）· 趣味占星页前端最终方案与 Astra 交付规格

2026 年 10 月 24 日，Australia/Melbourne。状态：设计规格，站主逐节确认后成文，待站主终审；**本文不含产品代码**。

- 上游设计：[DESIGN.md](../../horoscope-almanac-2026-10-22/DESIGN.md)（方向 A「掌上星历仪」，色彩令牌 §4.1 继续有效）、[ROADMAP.md](../../horoscope-almanac-2026-10-22/ROADMAP.md)（本文第 8 节已并入「寺院线 T」）。
- 引擎与许可：[DECISIONS](../../relationships-v2-2026-10-23/DECISIONS.zh-CN.md)、[SOURCES_AND_LICENSES](../../relationships-v2-2026-10-23/SOURCES_AND_LICENSES.zh-CN.md)。
- 措辞红线：`design.md` §5。
- 页面：`/en/horoscope.html`、`/zh/horoscope.html`，名称只用 **Astrology for fun / 趣味占星**；新视觉挂在 `?fx=almanac` 后（M0 开关）。

## 0. 决定清单

### 0.1 本轮新定（2026-10-24，站主逐项确认）

| # | 决定 |
|---|---|
| N1 | **整页就是星見寺**。四个按键（today / you / two / log）映射为寺内四处停靠点，按键＝镜头沿飛石移动；内容仍是 HTML，叠在场景上。中英文章节名与文案改用寺院语汇 |
| N2 | **全实时 three.js 单场景**（方案 A）：庭院、器物、石星盘同在一个场景里，Astra 交 glb＋贴图＋动画片段。2.5D／预渲染只作降级（方案 C） |
| N3 | 入寺过场约 9 s，**每次打开页面都播，可随时跳过**；深链（`#you #two #log`）、当日已抽签、减少动态效果时不播 |
| N4 | 浅草寺「1:1」的边界：**抽签流程与签纸版式 1:1**（这是御神签通行形制），**标识全自有**。不用浅草寺名、金龍山、观音字样、雷门、大提灯、签诗原文、「觀音籤」 |
| N5 | 金锦鲤：**真随机（`crypto.getRandomValues`），每次进入页面独立掷一次，概率 3%**；为池中第 8 尾，从桥下游出；不加音效、不弹窗，只在 today／two 停靠时页脚淡入一行「池中见金鲤一尾」；不存储、不计数、不进分享卡、与命理无关 |
| N6 | 锦鲤 7 尾常驻（中档手机 5 尾） |
| N7 | 背景声：**CC0 素材＋站主自录补缺**，不用任何需署名或非商用素材；**默认开**，进入页面的第一次手势后 2 s 淡入；设备条有静音键并记忆；系统减少动态效果或静音时不播 |
| N8 | 鸟居：**石制明神鸟居＋本堂前一座寺内镇守小神社**（一间社流造），按江户以前神佛习合寺院的镇守社做；不用朱红，不用任何真实神社神纹 |
| N9 | 星图盘：**天穹即真实星空借景；星图盘是本堂前倾斜的石制星盘**，盘面实时投影同一片星空，拨轮与四角读数为 HTML 叠加 |
| N10 | 日夜：**天色、光照、石燈籠由观测点此刻的真实太阳高度决定**（白天见日月与蓝天，黄昏红潘，夜间满星，日落后灯笼点亮）；**网页文字令牌随场景自动切日夜，不再提供手动日夜开关** |
| N11 | Astra 交付：**按资产包分六批**，每批 glb＋三视图转图＋自动检查脚本，再由站主视觉签收 |
| N12 | 签纸：**和纸与墨迹要有真实质感**。寺额、番号、等级、四句诗与八分项古称为 Astra 渲染的**行书毛笔**墨迹图（透明 AVIF），朱印「星見寺印」；解说、分项短句、免责为 HTML。英文版同一张纸，汉字墨迹保留，译意用 Newsreader |
| N13 | 摇筒**不露手**，只有签筒运动 |
| N14 | Lighthouse 性能项在新视觉下放宽到 **≥ 90**（其余三项仍 100；`?fx=off` 旧版仍 100×4） |
| N15 | 提示词**英文正文＋中文注释** |

### 0.2 被本轮覆盖的旧决定

| 旧决定 | 现状 |
|---|---|
| 「抽签器物为 Astra 预渲染序列帧」（10-24 上午） | 作废，改实时 glb（N2） |
| 「不用鸟居」 | 作废（N8） |
| ROADMAP D1「主题跟随系统，手动切换后记住」、M1 的手动主题键 | 作废，改为跟场景（N10）。T0 落地 |
| M4「今日仪器 fig.1 表盘 SVG」 | 由 T4 石星盘取代；fig 卡四角合同保留在 HTML 叠层 |
| 旧性能预算「序列帧 ≤2 MB」 | 由第 3.3 节新预算取代 |
| DESIGN.md §12「不引 WebGL、Three.js」 | 站主已批准为本页例外，仅 `?fx=almanac` 下懒加载 |

### 0.3 不变

①真实星空（观测点、时间、星表、投影、按需渲染）、②100 签六级无凶、命理定签与同日恒同签、无生日不能抽、末吉／末小吉可结签、八分项古称、中英双语、Claude 起草 100 签站主抽查 20、③四视图与分享卡内容——见 side-session 笔记 `hoshimi-design-decisions-2026-10-24.md`。本文只写与之衔接的部分。

---

## 1. 最终方案 · 场景构成

坐标：本堂在北，鸟居在南。庭院约 **28 m × 18 m**。默认视高 1.55 m，低头抽签时 1.2 m。布局按不等边三角形的非对称平衡，三大骨干（石組、水体、植栽）各据一角，东南角大片苔地留白。

```
                          N（借景：真实天穹 · 杉的剪影）
   ┌─────────────────────────────────────────────────────────┐
   │ 建仁寺垣 ════════════════════════════════════════ 建仁寺垣 │
   │         ┌───────────┐                                   │
   │ 寺务所▭  │  本  堂    │  石星盘◎   香炉▣     小神社⛩       │ ← today 停靠点
   │ (you)   │ 签筒·签柜  │     ○ 延段 ○                      │
   │         └───────────┘   ○                               │
   │                       ○           蹲踞 ◍ 鹿威し ╱         │
   │  池泉 ～～～～～～～～～  ○            石燈籠 ▲             │
   │  ～ 三尊石組 ▲▲▲ ～～  橋 ═══ (two)  ○   筧→溪 ≈≈≈        │
   │  ～～ 锦鲤×7(+1金) ～～     ○                             │
   │  ～～～～～～～～～～～     ○      绘马所·签架 (log) ▦       │
   │   光悦寺垣 ╌╌╌╌╌╌╌    ○                                 │
   │                      ○          苔 地 留 白               │
   │                 明神鸟居 ⛩  （入口 · 首帧）                 │
   └─────────────────────────────────────────────────────────┘
                          S
```

### 1.1 三大骨干

| 骨干 | 内容 | 位置 |
|---|---|---|
| 石組 | **三尊石組**：主石 1.6 m，左右胁石 1.1 m／0.8 m，奇数成组，立池西岸；**飛石** 17 枚（径 40–55 cm，步距 60 cm，五种形状复用）从鸟居经蹲踞蛇形至本堂；本堂前一段**延段**（切石铺路，1.2 m × 4 m） | 池西、主路 |
| 水体 | **池泉回游式**：池约 9 m × 5 m；东北角一道**筧**注水成 2 m 短溪入池（流水声源）；**锦鲤 7 尾**（红白 3、大正三色 2、黄金 1、浅黄 1，不含纯金）；金锦鲤出现时为第 8 尾，从桥下游出 | 中部偏西 |
| 植栽 | 黑松 2（池畔，一株探水）、五针松 1、杉 3（北侧借景剪影）、红枫 1（本堂东侧，按观测点季节换色）、杜鹃 3 团（竹垣下）、苔地大面留白 | 环池 |

### 1.2 功能装饰

| 物件 | 规格 | 作用 |
|---|---|---|
| 明神鸟居 | 石制未漆，高 5.2 m，柱径 0.45 m，笠木两端反增 ≤8°，挂注連縄与四条紙垂 | 入口、首帧、「跨入」 |
| 小神社 | 一间社流造，宽 1.2 m，高 2.2 m，置石基上，本堂东前方；额上只有自有「七星环」纹 | 神佛习合的镇守社 |
| 石燈籠 | 春日型，2.1 m；火袋发光面单独材质 | 夜间唯一暖光源，日落后点亮 |
| 蹲踞 | 手水鉢＋筧＋前石、手烛石、汤桶石四石组 | 低头、净手的停顿 |
| 鹿威し | 竹筒长 0.9 m，枢轴单独节点；**周期 11 s**（蓄水 9.4 s、翻落 0.4 s、击石 0.2 s；击点在 9.8 s） | 全场最稳的节拍 |
| 竹垣 | 建仁寺垣围北、西界；光悦寺垣作池畔矮垣 | 边界与借景的取舍 |
| 橋 | 石造反橋，长 3.2 m，跨池最窄处 | two 停靠点，「跨入彼岸、两人并立」 |
| 本堂 | 入母屋造，面阔 7 m，檐口高 4.6 m，只建正面与前庭；檐下置**六角漆木签筒**与**木签柜**（10×10 抽屉） | today 停靠点、抽签处 |
| 香炉 | 青铜三足，径 60 cm，三支线香常燃，烟缕穿过视线 | 过场第 2 段 |
| 石制星盘 | 圆盘径 1.4 m，倾角＝观测点纬度（枢轴节点，前端设定），盘面为实时星图盘 | 真实星空的「仪器」 |
| 寺务所 | 一扇开着的格子窗立面，窗内黑 | you 停靠点，命盘作为窗内纸页 |
| 绘马所与签架 | 麻绳签架（结签处）、月历绘马板 | log 停靠点 |

### 1.3 随真实时间变化

| 输入 | 变化 |
|---|---|
| 观测点太阳高度 | 天色与光照（午／黄昏／夜三套 HDRI 插值）；石燈籠点灯（高度 < −2°）；白天星点不显只显日月 |
| 观测点时刻 | 天穹与石星盘的星空、月相（同一 `realSky` 输出） |
| 观测点季节 | 红枫贴图（绿→红→枯）；樱只在该半球春季的两周出现为淡粉点缀 |
| 时段 | 鸟鸣：黎明密、正午疏、夜只一种夜鸟且稀 |
| 每次进入 | 金锦鲤掷签（N5） |

---

## 2. 过场、停靠、抽签流程、签纸版式

### 2.1 入寺过场（约 9 s）

缓动统一 `cubic-bezier(.22,1,.36,1)`。鹿威し的 11 s 节拍从页面打开起计时，过场第 1 段必有一击。

| 段 | 时长 | 镜头 | 声音 | HTML 叠字 |
|---|---|---|---|---|
| 0 鸟居前 | 0–2.0 s | 静止 0.6 s，缓入前推穿过鸟居 | 环境声 2 s 淡入 | 「星見寺 · Hoshimi-dera」＋「虚构寺院 · for fun」 |
| 1 飛石 | 2.0–4.5 s | 视高 1.55 → 1.3 m，微俯视逐石前行，经蹲踞时鹿威し一击 | 流水渐近、竹击石 | — |
| 2 香炉 | 4.5–6.0 s | 略右转对香炉，烟缕穿过视线 | — | — |
| 3 本堂前 | 6.0–9.0 s | 抬头到 1.55 m，推到签筒与石星盘之间停住 | — | 日期行淡入 |

- 「跳过」从 0 s 起常驻右下；跳过＝瞬切 today 停靠点。
- 过场期间不渲染 HTML 内容区，结束后 today 内容 240 ms 淡入；CLS 为 0。
- 不播的情形见 N3；减少动态效果时直接落在 today。

### 2.2 四处停靠

按键＝镜头沿飛石样条移动 1.2 s；键盘与读屏用户瞬切。

| 键 | 地点 | 场景可见 | HTML 叠层（放在分镜预留的低细节区） |
|---|---|---|---|
| today | 本堂前 | 左石星盘、中签筒签柜、右香炉，天穹借景 | 星盘四角读数＋日期拨轮；天象行（日期·干支日·节气·值日宿；今晚可见天体与方位）；「抽签」键或当日签纸缩略 |
| you | 寺务所窗前 | 格子窗，窗内暖光 | fig.2–5（四柱、石星盘出生模式、紫微键盘、大运）作窗内纸页 |
| two | 桥上 | 俯看池泉、锦鲤、三尊石組 | 两个 2D 小星盘＋R3 六维量表与证据账单 |
| log | 绘马所与签架 | 麻绳签架、月历绘马 | 月历（当日签号如「廿三」、结签日「結」）、手记、导出 |

### 2.3 抽签全流程（顺序与浅草寺 1:1，标识自有）

前置：无生日 → 签筒加盖，盖刻「先告生辰」，点击跳 you；当日已抽 → 直接到 ⑦。

| # | 步 | 交互 | 场景动画 | 声音 | 时长 |
|---|---|---|---|---|---|
| ① 一礼 | 点「抽签」 | 镜头低头 15° 再抬起 | — | 0.8 s |
| ② 取筒 | 自动 | 签筒从柜上升至胸前（不露手） | 木器轻碰 | 0.6 s |
| ③ 摇筒 | **按住 ≥ 0.8 s**（触屏／鼠标／空格）或点「摇签」键 | 筒上下摇动循环，幅度随时间微增；触感振动 | 签棍沙沙循环 | ≥ 0.8 s |
| ④ 出签 | 松手 | 筒倒转，一根签棍从六角口滑出 1/3 | 「咔」 | 0.6 s |
| ⑤ 读番 | 自动 | 推近签棍顶端烙印「第二十三番」 | — | 0.8 s |
| ⑥ 寻抽屉 | 点抽屉或 1.5 s 后自动 | 对应抽屉把手点亮（`--lit`），拉开，取出折叠签纸 | 抽屉木轨 | 1.0 s |
| ⑦ 展签 | 自动 | 签纸展开占画面下 2/3，内容逐行 120 ms 淡入 | 纸声 | 0.9 s＋ |
| ⑧ 收／结 | 点键 | 末吉／末小吉：「結於寺」→ 转向签架，折成细条系上 1.2 s；其他：「收进手记」→ 折起入怀 0.4 s | 麻绳／纸 | — |

每步可用键盘完成，读屏每步播报一句。签的内容由 `hoshimiDraw` 在 ① 就已确定，②–⑥ 只是揭晓。

### 2.4 签纸版式

签纸比例 90 mm × 220 mm（手机占宽 86%），和纸贴图（Astra 包④），环境光随场景、纸色不随网页主题变。

```
┌────────────────────────┐
│  ✶ 星 見 寺 ✶    [朱印]   │ ← 墨迹图：寺额＋七星环纹；右下朱印「星見寺印」（篆书方印，85% 透明度）
│      第 二 十 三 番        │ ← 墨迹图：汉数字番号
│         大   吉           │ ← 墨迹图：等级，最大字，墨色不着色
│ ───────────────────────  │
│  五言绝句四句（繁体，竖排）  │ ← 墨迹图：行书
│  英文译意（Newsreader）    │ ← HTML
│ ───────────────────────  │
│  解曰：白话解说（简／英）    │ ← HTML
│ ───────────────────────  │
│  所願 功名 求財 姻緣        │ ← 分项古称：墨迹图（八词共用一张）
│  行人 出行 失物 起居        │    每项下一句文言短句＋一句白话：HTML
│ ───────────────────────  │
│  此簽由來 →               │ ← HTML，打开护照抽屉（流日干支→十神→分档→标签→第几番→规则版本）
│  原创签文·仅供娱乐·非预测·非医疗建议·虚构寺院 │ ← HTML
└────────────────────────┘
```

- 英文页同一张纸：番号与等级下加 `No. 23 · Great Blessing`；分项英译 Wish / Career / Wealth / Marriage / Awaited one / Travel / Lost item / Daily life；全部汉字放在 `lang="zh"` 元素里。
- HTML 中文正文字体：站内衬线子集；不依赖网页字体提供繁体古称（已归墨迹图）。
- 六级英文名：大吉 Great Blessing · 吉 Blessing · 半吉 Half Blessing · 小吉 Small Blessing · 末小吉 Small Blessing to Come · 末吉 Blessing to Come。

**浅草寺「不用」清单**：浅草寺、金龍山、观音／觀音籤字样、雷门与大提灯、浅草寺签诗原文、凶签。

---

## 3. 架构

### 3.1 模块

全部只在 `[data-fx="almanac"]` 下加载。`dailyExperience.js` 只管路由与存储，四键切换改为 `camera.goTo(view)`；M1 外壳保留，内容区背景改透明。

| 单元 | 职责 | 依赖 |
|---|---|---|
| `src/lib/observer.js` | 时区→城市→经纬度；手动换城市；只在手动时写 `afflatus-horo:observer` | R2 城市表 |
| `src/lib/realSky.js` | 恒星时、日月五星高度方位、太阳高度、月相、升落、BSC5 投影、值日宿；纯函数 | astronomy-engine、`almanacSky.js` |
| `src/lib/hoshimiDraw.js` | 定签：`dailyFortune` 分→等级→十神标签→番号；版本 `hoshimi-draw 1.0.0` | `horoscopeEngine.js` |
| `src/lib/hoshimiSlips.js` | 100 签数据（番号、等级、诗、译、解、八分项、`ruleId`、墨迹图文件名） | — |
| `src/lib/dayCycle.js` | 太阳高度→三套光照预设的插值权重、灯笼、季节键、鸟鸣密度；纯函数 | `realSky` |
| `src/temple/scene.js` | three.js 场景装配、资产包懒加载、LOD、质量分级、按需渲染 | three、`dayCycle` |
| `src/temple/camera.js` | 飛石样条、四个停靠点、过场、跳过、瞬切 | `scene` |
| `src/temple/skyDome.js` | 天穹：星点 Points、日月、天色渐变 | `realSky` |
| `src/temple/starDial.js` | 石星盘盘面纹理：等距投影、两套连线、地平遮罩、值日宿点亮；拨轮联动；出生模式 | `realSky` |
| `src/temple/koi.js` | 7(+1) 尾锦鲤的转向／避障游动＋骨骼摆尾；金鲤掷签 | `scene` |
| `src/temple/omikuji.js` | 抽签状态机 ①–⑧、动画片段、抽屉、结签 | `hoshimiDraw`、`scene` |
| `src/temple/slipSheet.js` | 签纸：墨迹图＋HTML 叠在和纸平面上；护照入口 | `hoshimiSlips` |
| `src/temple/ambience.js` | Web Audio：鹿威し定时、流水环路、鸟鸣调度、动作音；手势解锁、静音记忆 | `dayCycle` |
| `src/temple/fallback.js` | 低档：静帧＋2D Canvas 星空＋2D 锦鲤＋无动画抽签 | `realSky` |
| `scripts/check-temple-assets.mjs` | Astra 交付自动检查 | `@gltf-transform/core` |

### 3.2 实时与 HTML 合成

- 全屏 `<canvas>` 在最底层，`aria-hidden`。视图内容面板为半透明和纸质感 `--panel`（透明度 0.92），叠在每个停靠点分镜预留的低细节区（右 45% 或下 55%）。
- 三处「贴在物体上」的 HTML（签纸、寺务所窗内纸页、星盘读数）用 `camera.project()` 把三维锚点换算为 CSS `transform`，只在镜头移动帧更新。
- **按需渲染**：镜头移动、动画片段、锦鲤与水面在视野内时 30 fps；you／log 停靠时池不在视野，循环降到 0，鹿威し击打时唤醒 0.6 s；页面不可见时全停。
- 水面：流动法线贴图＋只反射天穹的平面反射（中档改立方贴图）；烟：Astra 16 帧序列图作公告板粒子 ≤ 24 个。

### 3.3 性能预算

| 项 | 预算（gzip／传输） | 说明 |
|---|---|---|
| three.js 核心＋GLTFLoader＋meshopt 解码器 | ≤ 190 KB | 几何用 gltfpack meshopt；不用 Draco；贴图 WebP/AVIF ≤ 1024²，不引 KTX2 转码器 |
| astronomy-engine＋BSC5 星表＋连线 | ≤ 120 KB | 星表量化 Int16 |
| 包① 入口 | ≤ 1.6 MB | 过场 0–4.5 s 必需 |
| 包② 水景 | ≤ 1.8 MB | 过场 2 s 时并行取 |
| 包③ 本堂区 | ≤ 1.6 MB | 过场 4.5 s 前取回 |
| 包④ 器物 | ≤ 0.9 MB | 首次点「抽签」才取 |
| 包⑤ 墨迹图 | ≤ 80 KB／张 | 只取当日一张＋共用两张 |
| 音频（Opus） | ≤ 1.4 MB | 手势解锁后才取 |
| **首屏可交互（过场开始）** | **≤ 2.0 MB、4G ≤ 3 s** | 三包合计 ≤ 6 MB，全懒加载 |
| 几何在视 | 手机 ≤ 180k 三角形、桌面 ≤ 450k | LOD 两级 |
| GPU 贴图内存 | ≤ 96 MB | 手机档贴图减半 |
| 帧率 | 停靠 ≥ 30 fps（iPhone 12／中端 Android），镜头移动 ≥ 45 fps | 连续 2 s < 24 fps 自动降一档 |
| Lighthouse | 新视觉 ≥ 90 / 100 / 100 / 100；旧版 100×4 | N14 |

### 3.4 降级三档

| 档 | 条件 | 表现 |
|---|---|---|
| 高 | 桌面独显或 `deviceMemory ≥ 8` | 全部特效、平面反射、LOD0、锦鲤 7 |
| 中 | 多数手机 | 立方贴图代替反射、锦鲤 5、烟粒子 12、贴图 512² |
| 低 | 无 WebGL、`prefers-reduced-motion`、`saveData`、`?gl=off`、自动降档到底 | `fallback.js`：包⑥ 四处停靠 × 午／黄昏／夜静帧＋2D Canvas 真实星空＋2D 锦鲤贴图漂移（reduced-motion 时静止）；抽签为无动画四步（按→番号→签纸→收／结），同一状态机 |

JS 失败：构建期内联的鸟居前日间静帧＋日期行；按键退化为锚点。

### 3.5 无障碍

- 所有状态有 HTML 对应：过场有「跳过」与文字描述；停靠切换 `aria-live="polite"` 播报「本堂前 · today」；抽签每步一句；长按摇筒有键盘等价（按住空格）和免长按的「摇签」键。
- 锦鲤、烟、鹿威し为纯装饰无文本；金鲤那行小字是真实文本。
- 设备条静音键 `aria-pressed`；减少动态效果时默认不播；母带峰值 −6 dBFS，环境 −18 LUFS。
- 半透明面板上的文字在正午与夜间两种场景底下都 ≥ 4.5:1，面板透明度由 `dayCycle` 微调保证。
- 焦点顺序：设备条→按键行→当前视图；画布不可聚焦。触控目标 ≥ 44 px。

---

## 4. 交给 Astra 的提示词

每段可直接粘贴。英文为提示词正文，`// 中文` 为给站主的注释，粘贴时可去掉。所有包先粘「4.0 通用前言」。

### 4.0 通用前言（每批都带）

```
PROJECT: "Hoshimi-dera" (星見寺), a FICTIONAL Japanese temple garden for a web page rendered in real time with three.js. Everything you build will be loaded as glTF in a browser on phones, so budgets are strict.

STYLE: quiet, weathered, understated. Edo-period temple-garden realism. No saturated colour anywhere except: the warm glow of a stone lantern (~2200 K), the ember of incense sticks, and small vermilion accents (seal, ema cords, drawer numerals). Stone is grey-beige granite, wood is unpainted aged cypress/cedar, paper is washi. NOTHING painted vermilion/red (no red torii). Do NOT reproduce any real temple's or shrine's crest, name board, lantern, or signage; use only the project's own "seven-star ring" motif (seven small dots on a thin circle) where an emblem is needed.

DELIVERY FORMAT (every pack):
- glTF 2.0 binary (.glb), Y-up, metres, origin at the bottom-centre of each object, +Z facing the viewer's approach direction.
- Geometry compressed with gltfpack meshopt (-cc). No Draco. No KTX2.
- Materials: metal/roughness PBR. Per material three textures max: baseColor (WebP q85), normal (WebP lossless), ORM packed (occlusion R, roughness G, metallic B; WebP q85). Max 1024×1024. Power-of-two only. Bake ambient occlusion into ORM; do NOT bake directional sun shadows (the web app lights the scene by the real sun position).
- Two LODs where the table says so: LOD0 and LOD1 as separate nodes named "<name>_LOD0" / "<name>_LOD1".
- Naming: nodes/materials "hd_<pack>_<object>_<part>" (e.g. hd_03_honden_eave). Emissive/illuminable parts get their own material suffixed "_lit". Animation clips "anim_<object>_<action>".
- Per object also deliver: three orthographic turnaround PNGs (front/side/top, 2048 px wide, neutral grey background) and one day + one night beauty render for reference.
- Lighting reference for your beauty renders: day = overcast-bright noon 5600 K; night = moonless starry sky, ambient 4000 K at ~0.05 lux plus the lantern. Average albedo targets measured on your noon render: stone/wood/paper between #e4e3de and #5f5e59 (sRGB). On your night render the same surfaces should fall between #1c1c1a and #4a4945.
- Also deliver three 1k equirectangular HDR environment maps for the garden: noon, dusk (sun at −2°), night. No visible sun disc in the HDR (the app draws the sun and moon itself).
- Triangle and texture budgets below are HARD limits; a pack over budget is returned.

ACCEPTANCE (automated, every pack): triangle counts per LOD, texture sizes, naming, presence of every listed animation clip, file size, no unused materials, no extensions other than KHR_materials_*, KHR_texture_transform, EXT_meshopt_compression.
```
// 中文：通用约束。强调「无饱和色」「不用真实寺社标识」「不烘焙方向光阴影」「meshopt 不用 Draco／KTX2」。三张 HDRI 用来做日夜插值。

### 4.1 包① 入口（鸟居、飛石、竹垣、石組、地形植栽）— glb ≤ 1.6 MB

```
PACK 01 — ENTRANCE. Deliver one hd_01_entrance.glb containing the objects below as separate top-level nodes placed in garden coordinates (garden is 28 m N–S × 18 m E–W, origin at the torii's centre on the ground, +Z north toward the main hall).

1. STONE MYŌJIN TORII (hd_01_torii). Unpainted granite, weathered. Height 5.2 m, pillar diameter 0.45 m with slight inward lean (uchikorobi ~2°), kasagi + shimaki top with ends curving up ≤ 8°, nuki tie beam with a central gakuzuka (blank tablet — NO text). A shimenawa rope (hemp, 12 cm thick) hung under the nuki with four shide paper zigzags. Triangles: LOD0 12k / LOD1 4k; rope+shide 4k (shide as separate node hd_01_shide with a 6 s loop "anim_shide_sway", gentle wind only).
   // 中文：石制明神鸟居，无漆、无字额；注連縄与紙垂单独节点带 6 s 摆动循环。
2. STEPPING STONES (hd_01_tobiishi_A..E). Five distinct flat natural stones, 40–55 cm across, 8–12 cm thick, top faces slightly domed and worn. ≤ 600 triangles each. We instance them 17 times along a serpentine path; deliver a JSON "tobiishi_path.json" with the 17 placements (x, z, rotationY, which stone) at 0.6 m pitch from the torii, past the tsukubai (pack 02 position: 6 m north, 3 m east of torii), to the hall platform at 22 m north.
   // 中文：五种飛石复用 17 次；附路径 JSON，步距 0.6 m，经过蹲踞到本堂。
3. NOBEDAN PAVED STRIP (hd_01_nobedan). Cut granite setts in a 1.2 m × 4 m strip ending at the hall steps. ≤ 2k.
4. BAMBOO FENCES. Kenninji-gaki (hd_01_kenninji_N, _W): split-bamboo vertical screen 1.8 m high, horizontal oshibuchi, black-dyed palm rope knots; three straight sections totalling 24 m north edge and 14 m west edge; ≤ 3k each section (use texture for bamboo detail). Kōetsuji-gaki (hd_01_koetsu): low curving bamboo-lattice fence 0.6 m high, 7 m long along the pond's south bank; ≤ 3k.
   // 中文：建仁寺垣围北与西；光悦寺垣作池畔矮垣。
5. SANZON-SEKI ROCK TRIAD (hd_01_sanzon). Three upright stones on the pond's west bank: centre 1.6 m, flanks 1.1 m and 0.8 m, asymmetric, partly moss-covered at the base. LOD0 9k / LOD1 3k.
6. GROUND (hd_01_ground). One terrain mesh 28 × 18 m with the pond basin cut out (pond outline supplied in pack 02's pond_outline.json — coordinate with it; if unavailable, cut a 9 × 5 m organic oval centred 10 m north, 2 m west of torii). Moss, raked gravel only under the eaves of the hall, bare earth under trees. ≤ 8k. Tile textures; a 1024 moss albedo + normal is enough.
7. TREES. Black pine ×2 (hd_01_kuromatsu_A leaning over the pond, _B upright), five-needle pine ×1, cedar ×3 (tall, simple, they are silhouettes against the sky at the north edge), one Japanese maple (hd_01_momiji) east of the hall with THREE albedo variants for its leaves (green / red / bare-branch winter — deliver as three materials hd_01_momiji_leaf_green/_red/_bare on the same mesh), three azalea mounds under the fences. Foliage as crossed alpha cards; ≤ 14k per tree; no transparency sorting artefacts at LOD1.
   // 中文：红枫三套叶材质（绿／红／枯）供前端按季节切换；樱花不建模，由前端粒子点缀。

ACCEPTANCE for pack 01: torii has no paint and no text; stepping stones' path JSON reaches the hall; LOD1 pines don't flicker when viewed from 20 m; whole glb ≤ 1.6 MB; max 70k triangles total at LOD0 in view from the torii.
```

### 4.2 包② 水景（池、筧、橋、蹲踞、鹿威し、石燈籠、锦鲤）— glb ≤ 1.8 MB

```
PACK 02 — WATER GARDEN. One hd_02_water.glb.

1. POND BASIN + SHORE STONES (hd_02_pond). Pond ~9 × 5 m, organic outline, depth 0.6 m, bottom of dark pebbles. Do NOT deliver a water surface mesh (the app renders water with its own shader); deliver instead pond_outline.json (closed polyline, metres) and a 1024 pebble albedo/normal for the bottom. Shore stones as part of this node. ≤ 10k.
2. KAKEI BAMBOO SPOUT + STREAM (hd_02_kakei). A bamboo pipe on a forked post feeding a 2 m rocky stream into the pond's NE corner. ≤ 3k. Mark the water exit point as an empty node hd_02_kakei_spout (the app spawns water + sound there).
3. STONE ARCH BRIDGE (hd_02_hashi). Granite sori-bashi, 3.2 m span, 0.9 m wide, two slab steps each end, no railings. ≤ 6k. Deliver the deck's centre as empty node hd_02_hashi_viewpoint (camera dock "two").
4. TSUKUBAI (hd_02_tsukubai). Four-stone arrangement: natural-stone chōzubachi basin 0.5 m with water-filled bowl, mae-ishi front stone, teshoku-ishi, yuoke-ishi, plus the bamboo kakei feeding it. ≤ 6k. Water in the bowl as a flat disc material hd_02_tsukubai_water (app animates it).
5. SHISHI-ODOSHI (hd_02_shishi). Bamboo tube 0.9 m long, node-cut, on a wooden pivot; strike stone below. Pivot MUST be a separate node hd_02_shishi_pivot so the tube rotates about it. Animation "anim_shishi_cycle", exactly 11.0 s: 0–9.4 s tube fills (slow 0→14° tilt), 9.4–9.8 s tips and dumps (14°→−28°), strike at t = 9.8 s, 9.8–10.0 s rebound to 0°, 10.0–11.0 s rest. ≤ 2k.
   // 中文：鹿威し 11 s 周期，击点在 9.8 s，前端据此对音。
6. KASUGA STONE LANTERN (hd_02_toro). 2.1 m, six-sided fire box with two open windows and two carved deer/moon panels (generic, NOT any shrine's crest). The fire-box interior is a separate material hd_02_toro_fire_lit (emissive, the app toggles it after sunset). ≤ 7k.
7. KOI. One rigged carp mesh (hd_02_koi), 0.55 m long, ≤ 3k triangles, 6-joint chain skeleton (head, body×3, tail×2). Three material variants: kōhaku (white/red), taishō-sanshoku (white/red/black), yamabuki-ōgon (metallic yellow-gold; metallic 0.6, roughness 0.5) — plus a fourth "hd_02_koi_gold" PURE GOLD variant (metallic 0.9, roughness 0.35, NO emissive). Scale colours and patterns so fish read at 512 px textures. Clips: "anim_koi_swim" 2.0 s loop (tail-driven S-wave), "anim_koi_turn" 0.8 s (body bends ~40°), "anim_koi_gulp" 1.2 s (mouth at surface).
   // 中文：一套模型、四套材质；金鲤只是材质不同，不发光。

ACCEPTANCE for pack 02: shishi strike time is 9.8 s ±0.05 in the clip; lantern fire-box material is separate; koi swim loop has no visible seam; scales still legible on the 512 version; glb ≤ 1.8 MB.
```

### 4.3 包③ 本堂区（本堂、香炉、小神社、石星盘、寺务所、绘马所）— glb ≤ 1.6 MB

```
PACK 03 — MAIN HALL PRECINCT. One hd_03_hall.glb.

1. HONDEN / MAIN HALL FAÇADE (hd_03_honden). Irimoya (hip-and-gable) roof, 7 m frontage, eave height 4.6 m, cypress-bark roof, raised veranda 0.7 m with three stone steps, open centre bay with a dark interior plane (we never enter). Only the front and 2 m of the sides need detail; the back can be a closed box. The camera at 1.55 m eye height standing 3 m before the steps must NOT see above the ridge. Weathered unpainted wood, no gilding, no name board text. LOD0 28k / LOD1 10k. Deliver empty nodes hd_03_dock_today (3 m south of the steps, between the star dial and the lot cabinet) and hd_03_shelf (the eave-shelf where pack 04's lot cylinder and cabinet sit).
   // 中文：入母屋本堂只建正面；镜头看不到屋脊以上；留出 today 停靠点与器物架的空节点。
2. INCENSE BURNER (hd_03_koro). Bronze tripod, 60 cm diameter, green-brown patina, filled with grey ash, three incense sticks standing. Ember tips as material hd_03_koro_ember_lit with clip "anim_incense_glow" (4 s subtle pulse). ≤ 5k. Empty node hd_03_koro_smoke at the ember tips (the app spawns smoke sprites there).
3. SMALL SHRINE (hd_03_hokora). Ikken-sha nagare-zukuri: 1.2 m wide, 2.2 m tall on a 0.4 m stone plinth, cypress-bark roof, closed lattice doors, east of the hall front. Above the doors a small wooden tablet carrying ONLY the seven-star ring motif, no characters. ≤ 9k.
   // 中文：寺内镇守小神社，一间社流造，额上只有七星环。
4. STONE STAR DIAL (hd_03_stardial). A circular granite disc 1.4 m in diameter, 12 cm thick, on a low stone pedestal, west of the hall front. The disc's TOP FACE must be a separate flat node hd_03_stardial_face (a single quad, UV 0–1 square) — the app projects a live star map onto it. The disc tilts about a pivot node hd_03_stardial_pivot (the app sets the tilt to the viewer's latitude). Around the rim, 24 shallow notches, no text. ≤ 4k.
   // 中文：盘面单独平面节点供前端贴实时星图；倾角由前端按纬度设置。
5. TEMPLE OFFICE WINDOW (hd_03_jimusho). A 3 m section of wall with one open shōji/kōshi lattice window 1.2 × 1.0 m at 1.1 m sill height, warm interior plane hd_03_jimusho_inner_lit (emissive, app controls). ≤ 8k. Empty node hd_03_dock_you 1.6 m before the window.
6. EMA / LOT RACK (hd_03_ema). A roofed rack 2 m wide: upper rows of hemp rope tied lines where folded paper lots hang (the app adds the lots), lower board for a calendar tablet. Rope as tube geometry. ≤ 6k. Empty node hd_03_dock_log 1.8 m before it, and hd_03_tie_point on the nearest rope.
   // 中文：结签处与月历绘马板；留出 log 停靠点与结签点。

ACCEPTANCE for pack 03: no text anywhere; stardial face quad exact 1.4 m and UV square; lit materials separate; glb ≤ 1.6 MB; ≤ 60k triangles in view from dock_today at LOD0.
```

### 4.4 包④ 抽签器物（签筒、签棍、签柜、签纸、和纸、烟）— glb ≤ 0.9 MB

```
PACK 04 — OMIKUJI OBJECTS. One hd_04_omikuji.glb plus textures.

1. HEXAGONAL LOT CYLINDER (hd_04_tsutsu). Lacquered wood, 32 cm tall, 11 cm across flats, dark brown-black urushi worn at the edges, hexagonal top with a single 1.4 cm hole (separate node hd_04_tsutsu_hole marking it). Inside: a bundle of 100 lot sticks (one low-poly bundle mesh, ≤ 1k). ≤ 4k for the cylinder. Clips: "anim_tsutsu_lift" 0.6 s (rises 35 cm and tilts to 20° toward viewer), "anim_tsutsu_shake" 0.5 s loop (vertical shake ±3 cm with ±6° tilt, seamless), "anim_tsutsu_pour" 0.6 s (inverts to 150°, one stick slides out one-third of its length).
   // 中文：六角漆木签筒，三个动画片段；摇筒循环必须无缝。
2. LOT STICK (hd_04_kuji). Bamboo stick 24 cm × 7 mm, ≤ 300 triangles; the top 4 cm face carries a burnt-in numeral from a 1024×1024 atlas texture (deliver the atlas with 100 cells of kanji numerals 第一番…第百番 in a woodblock-burn look; the app sets the UV offset). The stick that slides out in anim_tsutsu_pour must be this separate node hd_04_kuji_out.
   // 中文：签棍顶端编号用 100 格图集，前端换 UV。
3. LOT CABINET (hd_04_tansu). Wooden chest 60 cm wide × 80 cm tall × 22 cm deep, 10 × 10 small drawers (each 5.4 × 7 cm face), aged kiri wood, each drawer face bearing a small vermilion-lacquered kanji numeral 一…百 (texture atlas is fine). EVERY drawer is its own node hd_04_drawer_01 … hd_04_drawer_100 with a shared pull material hd_04_pull and a separate hd_04_pull_lit (emissive copy). One clip "anim_drawer_open" (1.0 s, slides out 12 cm) authored on drawer_01; the app retargets it. ≤ 12k total.
   // 中文：百抽屉，每个独立节点；把手有点亮材质；抽屉动画只做一个，前端复用。
4. PAPER LOT. Two meshes: folded strip hd_04_slip_folded (2 × 9 cm, ≤ 1k) and unfolded sheet hd_04_slip_open (9 × 22 cm, single subdivided quad ≤ 1k, UV square — the app overlays HTML on it). Clips: "anim_slip_unfold" 0.9 s (folded→open, folds easing out), "anim_slip_tie" 1.2 s (open→rolled thin strip→knotted around a rope point), "anim_slip_pocket" 0.4 s (open→folded, moves down out of frame).
5. WASHI TEXTURE SET (hd_04_washi): 1024² albedo (warm off-white, visible fibres), normal, and a thin-translucency mask; must stay readable under black text at both noon and night lighting.
   // 中文：和纸贴图三张，保证墨色文字在正午与夜间都 ≥ 4.5:1 对比度。
6. SMOKE SPRITE SHEET: 16 frames, 512² each, 4×4 sheet, premultiplied alpha, slow incense smoke curl rising ~1 m, seamless loop.

ACCEPTANCE for pack 04: shake loop seamless; pour shows exactly one stick; drawer numerals are kanji 一–百 in vermilion only; all 100 drawer nodes present; slip_open UV is a square; glb ≤ 0.9 MB.
```

### 4.5 包⑤ 墨迹图（100 签上半幅＋共用图）— 每张 ≤ 80 KB

```
PACK 05 — INK ARTWORK. Transparent AVIF, 1200 × 1600 px, ≤ 80 KB each, plus a per-image JSON with the exact text drawn.

For each of the 100 lots we supply (file hoshimiSlips.export.json): number (1–100), rank (one of 大吉 吉 半吉 小吉 末小吉 末吉), and a four-line five-character poem in Traditional Chinese. Draw, top to bottom, on a transparent background:
- Temple name "星見寺" in semi-cursive brush (gyōsho), 110 px tall, centred, flanked by two small seven-star ring marks. 
- A square seal "星見寺印" in seal script (tensho), vermilion #b23800 at 85% opacity, 130 px, overlapping the lower-right of the name.
- Lot number as kanji numerals, e.g. "第二十三番", gyōsho, 90 px, centred.
- Rank in large brush characters, 360 px tall, bold, the strongest ink on the page.
- A thin hand-drawn horizontal rule.
- The four poem lines, vertical (tategaki), right to left, gyōsho, 64 px, natural brush pressure variation, lines evenly spaced.
Ink: #1c1c1a with 8 % feathered bleed at stroke edges, slight dry-brush on long strokes; the brush hand must be consistent across all 100 (same calligrapher). Nothing else on the image. NO reference to any real temple.

Also deliver two shared images in the same style:
- "categories.avif": the eight category headings 所願 功名 求財 姻緣 行人 出行 失物 起居 as eight separate 160 × 90 px cells in one 1280 × 180 px strip, in the same gyōsho hand.
- "ranks.avif": the six rank words alone, 6 cells of 400 × 400, for use on the share card.

ACCEPTANCE for pack 05: text in each image matches the JSON character-for-character (we diff the JSON you return against ours); consistent hand; no stray marks; ≤ 80 KB each; the seal never covers the number.
```
// 中文：行书手写体；朱印「星見寺印」；八分项古称共用一张；六级大字共用一张给分享卡。

### 4.6 包⑥ 降级静帧（12 张＋首帧）— 每张 ≤ 120 KB

```
PACK 06 — FALLBACK STILLS. Render from the FINAL assembled garden, AVIF 2400 × 1500, ≤ 120 KB each, 13 images:
- Four camera docks (today: hd_03_dock_today looking north at the hall, star dial left, cabinet centre, burner right; you: hd_03_dock_you at the office window; two: hd_02_hashi_viewpoint looking down-west over the pond and rock triad; log: hd_03_dock_log at the rack) × three lighting states (noon, dusk, night with lantern lit) = 12.
- One "first frame": standing 4 m south of the torii at noon, looking north through it.
Eye height 1.55 m, 35 mm-equivalent 32 mm lens, same framing the real-time camera uses (we send you the exact camera JSON once pack 03 is accepted). NO koi, NO smoke, NO stars in these renders (the app layers those in 2D); the night sky is plain dark gradient.
Also deliver the camera JSON you used (position, target, fov) per image.

ACCEPTANCE: framing matches the real-time camera within 2 % of frame width; no fish/smoke/stars; ≤ 120 KB each.
```

### 4.7 音频（交给站主／声音来源，不是 Astra 的 3D 工作）

```
AUDIO LIST (Opus 48 kbps mono unless noted; peak −6 dBFS; ambience loops normalised to −18 LUFS):
1. water_kakei_loop.opus — 20 s seamless loop, bamboo spout into a pond, close, no birds, no wind. CC0 or own recording.
2. shishi_strike.opus — single bamboo-on-stone "kon" with 1.2 s decay and the tube's hollow rebound. Own recording preferred.
3. birds_day_01..08.opus — 2–5 s single-species calls typical of a temple garden (bush warbler, white-eye, great tit, bulbul, sparrow, pigeon, crow distant ×2); birds_dusk_01..02 (cicada-free; e.g. thrush); birds_night_01..02 (scops owl, distant). Stereo allowed. CC0 only; no recordings whose licence requires attribution or forbids commercial use.
4. tsutsu_shake_loop.opus — 0.5 s seamless loop of bamboo sticks rattling in a wooden cylinder. Own recording.
5. kuji_out.opus (stick slides and clicks, 0.3 s), drawer_slide.opus (0.8 s), paper_unfold.opus (0.6 s), rope_tie.opus (0.5 s), wood_touch.opus (0.2 s). Own recording or CC0.
6. Incense: NO sound.
For every file supply: source URL or "own recording", author, licence (must be CC0 or own), date obtained. These lines go into SOURCES_AND_LICENSES; the build fails if a file has no licence line.
```

---

## 5. 测试计划

| 层 | 测什么 | 怎么测 |
|---|---|---|
| 单测 | `realSky`：墨尔本、北京、伦敦若干时刻的太阳高度、恒星时、月相、升落与 astronomy-engine 直接调用一致（±0.01°／±1 min）；南半球用南天极；地平遮罩在纬度 −38°、0°、+52° 的形状 | 固定时刻样例 |
| 单测 | `hoshimiDraw`：同人同日恒同签；10 万合成生日 × 365 天等级分布 17/35/5/4/3/36 ±1%；同输入两次相等（无随机）；按观测点民用日换日 | 固定种子 |
| 单测 | `hoshimiSlips`：100 签齐全、等级计数精确、每签有 `ruleId` 与墨迹图名、八分项齐全；红线词表：C1 器官词、「凶」、浅草寺／金龍山／觀音籤、疾病与疗法词全不出现；英文译意无中文字符 | 遍历 |
| 单测 | `dayCycle`：太阳高度 −18°／−6°／−2°／0°／10°／45° 的预设权重与灯笼；季节键南北半球相反 | 阈值样例 |
| 单测 | `koi`：金鲤掷签 10 万次频率 3% ±0.3%；与生日、日期、签无关 | 统计 |
| 单测 | `ambience`：假时钟下鹿威し每 11 s 触发、击点对齐 9.8 s；鸟鸣间隔 8–40 s；每个音频文件在许可清单里 | 假时钟 |
| 资产 | 六包的面数、贴图、命名、片段、包体；包⑤文本 JSON 与 `hoshimiSlips.js` 逐字一致；包⑥机位与相机 JSON 差 ≤ 2% | `check-temple-assets.mjs`，CI 必跑 |
| e2e | 首开播过场、「跳过」直达 today；`#you` 深链不播；当日已抽直达签纸；无生日签筒加盖并跳 you；键盘走完 ①–⑧（空格长按与「摇签」键两条路径）；reduced-motion 无过场、无游动、无声；`?gl=off` 静帧＋2D 星空；静音键记忆；每步 `aria-live` 文本；英文页无中文 UI 字符；320/390/768/1280 无横向滚动；面板文字对比度在正午与夜间两套底下 ≥ 4.5 | 假时钟、假观测点 |
| 视觉 | 12 张静帧与实时同机位截图并排；日／黄昏／夜 × 四处停靠实机截图入 PR | `visual-captures.spec.js` 扩展 |
| 性能 | CI 校验各包 gzip 上限；Lighthouse 新视觉 ≥ 90/100/100/100、旧版 100×4；`?perf=1` 显示 1% 低帧供站主真机读 | size-limit＋LHCI |
| 内容 | 站主抽查 20 签；`lint:i18n` 中英成对 | 人工＋脚本 |

---

## 6. 资产清单

| 来源 | 资产 | 格式 | 预算 | 门 |
|---|---|---|---|---|
| Astra 包① | 鸟居、紙垂、飛石×5、延段、竹垣×2 种、三尊石組、地形、松×3、杉×3、红枫（3 叶材质）、杜鹃×3、飛石路径 JSON | glb＋WebP | ≤ 1.6 MB | A1 |
| Astra 包② | 池体与池底、筧与溪、反橋、蹲踞、鹿威し、春日燈籠、锦鲤模型＋4 材质、池轮廓 JSON | glb＋WebP | ≤ 1.8 MB | A2 |
| Astra 包③ | 本堂正面、香炉、小神社、石星盘、寺务所窗、绘马所与签架、停靠点空节点 | glb＋WebP | ≤ 1.6 MB | A3 |
| Astra 包④ | 签筒、签棍＋编号图集、签柜（100 抽屉）、签纸两态、和纸贴图、烟序列图 | glb＋WebP | ≤ 0.9 MB | A4 |
| Astra 包⑤ | 100 张墨迹图＋categories＋ranks＋文本 JSON | AVIF | ≤ 80 KB／张 | A5 |
| Astra 包⑥ | 12 张停靠静帧＋首帧＋相机 JSON | AVIF | ≤ 120 KB／张 | A6 |
| Astra 通用 | 三张 HDRI（午、黄昏、夜） | HDR → 构建期转球谐＋小立方图 | 原始各 ≤ 2 MB，产物 ≤ 60 KB | A1 |
| 站主／CC0 | 音频 23 条 | Opus | ≤ 1.4 MB | 随 T8 |
| 仓库 | three.js＋GLTFLoader＋meshopt 解码器 | npm | ≤ 190 KB gz | T3 |
| 仓库 | astronomy-engine（已有，MIT）、BSC5 星表（公有领域，量化 Int16）、两套星座连线（逐项核许可） | JS/二进制 | ≤ 120 KB gz | T1 |
| 仓库 | 100 签文（中英）、`hoshimiSlips.js` | JS | — | T2 |
| 仓库 | 构建期首帧静帧内联 | AVIF | ≤ 60 KB | T9 |

---

## 7. 设计草图

### 7.1 过场分镜

```
 t=0s 鸟居前                 t=3s 飛石                   t=5s 香炉                  t=9s 本堂前（today）
┌───────────────┐          ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   ☆ ☆  ☆      │          │               │          │      ~  ~     │          │ ☆  ☆    ☆  ☆  │
│  ┌┬───────┬┐   │          │   ▲石燈籠      │          │     ~ ~       │          │ ┌───本堂───┐  │
│  ││  ⛩   ││   │          │  ◍蹲踞 ╱鹿威し  │          │    ▣ 香炉      │          │ │签筒 签柜│  │
│  ││       ││   │          │      ○        │          │               │          │ ◎星盘   ▣   ⛩ │
│  ○ ○      ○    │          │    ○          │          │   ○           │          │   ○延段        │
│星見寺·虚构寺院  │ [跳过]   │  ○            │ [跳过]   │               │ [跳过]   │ 日期行        │
└───────────────┘          └───────────────┘          └───────────────┘          └───────────────┘
 视高 1.55 → 推进            视高 1.3 俯视飛石            右转 20°                   抬头 1.55，停
```

### 7.2 today（手机 390 / 桌面 1280）

```
手机                                   桌面
┌──────────────────────┐              ┌──────────────────────────────────────────────┐
│ 趣味占星 · ver 3.0 · 🔈 │              │ 趣味占星 · ver 3.0 · 🔈                        │
│  ☆   ☆  ☆    ☆        │              │ ☆    ☆      ☆   ☆         ☆    ☆             │
│  ┌──本堂──┐  ⛩        │              │   ┌────本堂────┐              ┌───────────┐ │
│  │签筒 签柜│ ▣         │              │   │ 签筒  签柜  │   ▣   ⛩     │ fig.1 此刻星空│ │
│ ◎星盘               │              │ ◎石星盘           │              │ 读数·拨轮    │ │
│ ╭ 和纸面板 ─────────╮ │              │                               │ 天象行      │ │
│ │ fig.1 此刻星空读数  │ │              │                               │ [抽签]      │ │
│ │ ‹ 拨轮 ›           │ │              │                               ╰───────────╯ │
│ │ 天象行：日期·干支·节气│ │              │                                              │
│ │ 值日宿 · 今晚可见    │ │              │ [today][you][two][log]                       │
│ │ [抽签]             │ │              └──────────────────────────────────────────────┘
│ ╰──────────────────╯ │
│ [today][you][two][log] │
└──────────────────────┘
```

### 7.3 抽签展签（⑦）与结签（⑧）

```
⑦ 展签                                  ⑧ 結於寺（末吉／末小吉）
┌──────────────────────┐              ┌──────────────────────┐
│   ☆          ☆       │              │  绘马所                │
│ ┌────────────────┐   │              │  ═══╤═══╤═══╤═══ 麻绳  │
│ │ ✶星見寺✶  [朱印] │   │              │     │   │ ╭╮│         │
│ │   第二十三番      │   │              │     │   │ ││ ← 细条   │
│ │     大  吉       │   │              │     │   │ ╰╯│         │
│ │ ─────────────── │   │              │  手记：結於寺 · 廿三    │
│ │ 诗四句(竖)  译意  │   │              │                      │
│ │ 解曰…            │   │              │ [回到本堂]             │
│ │ 所願 功名 求財 姻緣│   │              └──────────────────────┘
│ │ 行人 出行 失物 起居│   │
│ │ 此簽由來 →        │   │
│ └────────────────┘   │
│ [結於寺] [收进手记]    │
└──────────────────────┘
```

### 7.4 you / two / log

```
you（寺务所窗）                 two（桥上）                      log（绘马所）
┌────────────────┐          ┌────────────────┐          ┌────────────────┐
│ ┏━━格子窗━━━┓   │          │ ～～ 池 ～～～    │          │ ═══╤═══╤═══ 签架 │
│ ┃ fig.2 四柱  ┃   │          │ ～ 锦鲤 ～ ▲▲▲  │          │    │ 結 │       │
│ ┃ fig.3 星盘  ┃   │          │ ╭ 面板 ───────╮│          │ ╭ 月历绘马 ─────╮│
│ ┃ fig.4 紫微  ┃   │          │ │ ◎A  ◎B 两小盘 ││          │ │ 一 二 … 廿三  ││
│ ┃ fig.5 大运  ┃   │          │ │ 六维量表      ││          │ │ 手记输入      ││
│ ┗━━━━━━━━━━┛   │          │ │ 证据账单      ││          │ │ 导出 · 删除   ││
│                │          │ ╰─────────────╯│          │ ╰─────────────╯│
└────────────────┘          └────────────────┘          └────────────────┘
```

---

## 8. 路线图更新

已并入 [ROADMAP.md](../../horoscope-almanac-2026-10-22/ROADMAP.md)「寺院线 T 与资产门 A」。摘要：

```
M0 ─ M1 ─ M2（已开 PR）          R0–R4 ✓
   │
T0 决定落地 ──┐
T1 observer·realSky·dayCycle·星表 ──┬─▶ T4 石星盘（取代 M4）─▶ M5 今日阅读层（天象行）
T2 hoshimiDraw＋100 签文            │
T3 场景底座·质量分级·检查脚本 ────────┼─▶ T6 过场·停靠（需 A1 A3）
                                    ├─▶ T5 水景·锦鲤（需 A2）
                                    └─▶ T7 抽签·签纸·结签（需 T2 A4 A5 M3）
T8 音频        T9 降级（需 A6）
M6–M8 you 深度线照旧   M10 two   M11 log   M12 分享卡
   ▼
M13（扩）─▶ M14
资产门：A1 → A2 → A3 → A4 → A5 → A6（Astra 交付，脚本检查，站主签收）
```

| 模块 | 规模 | 模型·强度 | 依赖 | 验收要点 |
|---|---|---|---|---|
| T0 决定落地（`design.md` §5 起居条款；取消手动主题；ROADMAP；M1 主题键改跟场景） | S | Sonnet · medium | M1 | 站主审 diff |
| T1 观测点、真实星空、日夜周期、BSC5 管线 | L | Opus · high | M2 | §5 单测；星表与连线许可逐项记录 |
| T2 定签规则＋100 签文 | M＋M（两个会话） | Opus · high | R 线 | 分布与红线单测；站主抽查 20 |
| T3 场景底座、相机骨架、质量分级、检查脚本 | L | Opus · high | M1 | 占位几何下四处可切；脚本能拒坏包 |
| T4 石星盘与拨轮、出生模式 | M | Opus · high | T1、T3 | 盘面与天穹同数据 |
| T5 水面、锦鲤群游、金鲤 | M | Opus · medium | T3、A2 | 中档手机 30 fps；金鲤 3% |
| T6 过场、停靠动画、跳过、深链规则 | M | Opus · medium | T3、A1、A3 | e2e 三条路径 |
| T7 抽签状态机、签纸合成、结签、「此簽由來」 | L | Opus · high | T2、T3、A4、A5、M3 | 键盘走通；同日恒同签；结签只限末吉／末小吉 |
| T8 音频调度与许可清单 | M | Sonnet · high | T3 | 假时钟单测；许可清单齐全 |
| T9 三档降级与静帧 | M | Sonnet · medium | T1、A6 | `?gl=off` 与 reduced-motion e2e |
| M13（扩） | M | Opus · high | 全部 | 预算与 Lighthouse 门禁 |

M4 作废（T4 取代）；M7 的 fig.3 改为石星盘出生模式；M5、M10、M11、M12 内容微调，依赖与验收照旧。

---

## 9. 不做与边界

- 不做连签、收集、稀有度、金鲤计数或任何奖励；金鲤不进分享卡、不存储。
- 不做付费、不做账户、不做推送、不新增服务端；全部本地计算。
- 不做香资／投币动画。
- 不进本堂内部；不露手；不做任何真实寺社的标识、神纹、签文。
- 起居分项只谈作息与调养，不谈疾病、器官、诊断与疗法（`design.md` §5，T0 落地）。
- 新视觉只在 `?fx=almanac` 下；站主真机签署前线上默认不变。
- 本文不含产品代码；实现按 ROADMAP T 线逐模块开会话。
