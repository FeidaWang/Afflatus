# Project Afflatus · 设计路线图与改进评估

更新：2026-06-11 · 基于对当前 Vite 项目（`src/` 模块、`public/` 附页、`dist/` 构建产物）的完整审查。

已确定的两个方向决策：

- **美学**：叙事统一、保留两套风格。主页 = 舰桥（星舰 HUD），附页 = 作战终端/地面频道（Marathon 酸性风），用统一设计 token 和世界观设定桥接。
- **数据**：接入真实持仓/净值数据，替换合成 K 线。

---

## 一、现状诊断

### 1. 概念层

**优点**：世界观完整度高（舰长日志、Alphard 航线、2738 天航程、武器系统命名都有内在一致性），免责声明写得有风格（"任何标的都可能坠入引力井"），双语文案质量好。

**问题**：

- **可信度矛盾（最关键）**。站点核心叙事是"真实披露持仓与纪律"，但 `$BRUCE.VOY` K 线来自 `src/data/marketSeries.js` 合成数据，年化 38.66%、Sharpe 1.72 等指标无真实数据支撑，Commander Terminal 登录框是纯装饰。对一个以"no tips, no promises"立身的个人品牌，假数据是地基裂缝。→ 已决定接真实数据（见路线图 P2）。
- **双美学无桥接**。主页（蓝青 `#9ae5ff` 星舰 HUD）与附页（acid 绿 `#caff00` Marathon 风）之间没有任何色彩、字体或叙事过渡，访客翻页时像换了一个网站。
- **战斗系统与投资内容零关联**。击落彗星、核打击、击杀计数都是纯装饰，娱乐性没有转化为内容记忆点。彗星可以是宏观风险（利率、地缘、通胀），武器可以是对冲与纪律——叙事素材现成，未利用。
- **故事进度是静态的**。"2738 days from Earth" 是很好的钩子，但它不随真实日期推进，浪费了"航程 = 投资旅程"的天然隐喻。

### 2. 技术架构

- **死代码**：根目录 `script.js`（1381 行）和 `styles.css`（1081 行）是旧单文件版残留；`src/aircraft-viewer-fixed.jsx` 与 `src/aircraft-viewer-v2.path-fixed.jsx` 是 vanilla 项目里的无引用 React 文件。全部删除。
- **`main.js` 仍有 3796 行**。`REFACTOR_MAP.md` 说要保持 thin conductor，但雷达绘制（`drawRadar` ~400 行）、pilot feed 绘制（`drawCapitalFeed`/`V2` 各 ~200 行）、HUD 图像绘制全在里面。建议继续拆出 `scene/radarRenderer.js`、`scene/pilotFeed.js`、`scene/hudSprites.js`。
- **附页游离在 Vite 之外**。`public/*.html` 是原样复制的静态文件：内联样式、各自复制 nav/footer、不参与打包与优化。建议改为 Vite 多页入口（`rollupOptions.input`），共享 CSS token 文件和公共片段。
- **字体是最严重的视觉 bug**：附页的 `Marathon Shapiro 65`、`PP Fraktion Mono`、`KH Interference` 全部仅 `local()` 引用。访客机器没有这些字体，实际渲染为 Impact / 系统 monospace——酸性美学的核心字体层完全丢失。选项：
  1. 自托管开源替代并 `@font-face`：标题可用 Archivo Black、Anton 或 Monument Extended 风格的开源字体（如 Bebas Neue + 字距压缩）；等宽可用 IBM Plex Mono / Space Mono / JetBrains Mono（已有）。
  2. 购买原字体网页授权后 self-host（woff2 + subset）。
  3. 围绕降级字体重新设计（不推荐，Impact 撑不起这套美学）。
- **图片 ~13MB 未压缩 PNG**（`pp1518.png` 2.3MB、`starship-back.png` 2.1MB、背景图 2MB）。转 WebP/AVIF + 适当降分辨率，预计体积 -80%；背景图加 `loading` 策略或低清占位。
- **内容硬编码**。持仓、文案都在 `src/data/content.js`，每次更新要改 JS 重新 build。持仓与指标应外置为 JSON（为接真实数据做准备），文章类内容走 markdown。
- **SEO 为零**。全站没有 meta description、Open Graph、Twitter card、sitemap、RSS。个人品牌站的硬伤——分享到任何社交平台都没有预览卡片。
- **性能与可访问性**：主页 7 个 canvas + 常驻 rAF 循环；全站 0 处 `prefers-reduced-motion`；自定义光标强制替换系统光标；`#748290` 级别的 muted 文字对比度偏低。需要：页面不可见时暂停循环（`visibilitychange`）、低端设备降级（减少粒子数）、reduced-motion 静态降级、光标保留系统可用性。

### 3. UI / HUD

- **首帧语言闪烁**：HTML 里硬编码中英混排（hero 英文、HUD 标签中文），JS 加载后才统一。语言偏好应持久化到 `localStorage` 并同步 `<html lang>`，HTML 初始状态用单一语言。
- **"Command" 按钮对新访客无意义**。战斗模式是站点最大彩蛋，但入口是一个含义不明的按钮。建议首访一次性引导提示（"按下进入作战甲板"），或让 hero 滚动到底后出现明确邀请。
- **关键投资数据埋得深**。年化/Sharpe/回撤条在 hero 之下，topbar telemetry 全是装饰数据（WARP POWER 41%）。可以让 1-2 个真实指标进入 topbar，装饰与信息混编反而强化"这是真的舰桥"。
- **移动端**：文档自己承认 HUD 拥挤，当前是缩放方案。建议做移动专属布局：单列 HUD、雷达与 pilot feed 二选一、武器选择保持现有 `<select>` 方案。
- **假登录框**：要么移除，要么变成彩蛋入口（见娱乐性）。

### 4. 娱乐性

现有底子（武器矩阵、雷达、击杀播报、星图）已经超过 95% 的个人站。缺的是"玩"与"内容"的回路：

- **威胁 = 真实宏观事件**。来袭彗星命名为 "CPI PRINT"、"FOMC"、"GEOPOLITICAL FLARE"，击落后 battle feed 播报一句对应的真实观点，并链接到 Fleet Log 条目。
- **航程实时推进**。2738 天倒数与真实日期绑定，每 100 天一个里程碑（= 一篇日志/一次持仓复盘），星图上点亮航点。
- **击杀分享卡片**。战斗结束生成带品牌水印的 PNG（canvas 导出），"I defended the Afflatus fleet · 47 kills"——天然传播钩子。
- **Commander Terminal 变伪 CLI**。登录框改为可输入命令的终端：`positions` 列持仓、`log 034` 跳日志、`warp` 触发跃迁动画、藏一个 konami code。把假交互变成最佳彩蛋。
- **音效（默认静音，opt-in）**：武器发射、警报、跃迁。一个小小的 SFX 开关即可。

---

## 二、路线图

### P0 · 地基修复（1–2 周）

1. 删除死代码：根目录 `script.js`/`styles.css`、两个 `.jsx` 文件。
2. 附页字体决策并落地（自托管 woff2，这是视觉收益最大的单项修复）。
3. 图片转 WebP/AVIF + 压缩。
4. 全站 SEO meta：description、OG、twitter card、favicon 完整性、sitemap。
5. `prefers-reduced-motion` 降级 + `visibilitychange` 暂停渲染循环。
6. 语言偏好持久化，消除首帧闪烁。

### P1 · 统一与组件化（2–4 周）

1. 建立共享设计 token（`tokens.css`）：双美学共用的色彩变量、间距、z-index 体系；定义桥接元素（如附页 nav 带一条 HUD 蓝青色"舰桥信号灯"，主页 footer 出现 acid 绿"地面频道"标记）。
2. 附页纳入 Vite 多页构建，nav/footer 抽成共享片段。
3. `main.js` 继续拆模块：radarRenderer / pilotFeed / hudSprites。
4. 持仓与指标数据外置 JSON，content.js 只留文案。
5. 移动端专属 HUD 布局。

### P2 · 真实数据与内容引擎（1–2 个月）

1. **真实净值管线**：券商导出 → 本地脚本（CSV → `public/data/equity.json`）→ K 线读取真实数据；指标（年化、Sharpe、回撤、Beta）由脚本计算而非手填。更新流程：导出 → 跑脚本 → commit → 部署。
2. Fleet Log 变成真博客：markdown 文章 + 构建时生成页面与 RSS。
3. 双语路由（`/en/`、`/zh/`）或至少 URL 参数持久化。
4. 部署迁移到 Vercel/Netlify 自动构建（替代手动上传 dist）。

### P3 · 娱乐闭环与增长（持续）

1. 威胁-内容联动（宏观事件彗星 + 击落播报链接日志）。
2. 战斗场景视觉升级（多角度战机模型 + 起降镜头系统 + 歼星舰级侧视场景，详见第四节）。
3. 航程里程碑系统（倒数绑定真实日期，星图航点点亮）。
4. Commander Terminal 伪 CLI + 彩蛋。
5. 击杀分享卡片（canvas 导出 PNG）。
6. opt-in 音效、轻量 analytics（如 Plausible）、newsletter 入口。

---

## 三、战斗场景升级方案（精细模型 · 视角变换 · 移动端高帧率 · 不用 Blender）

> **状态（2026-06-12）：已落地。** 实现清单：
> `tools/sprite-baker/bake-procedural.mjs`（零依赖 Node 软件光栅化烘焙器，程序化 F-47/B-2 模型 → 24 方位 × 3 俯仰图集，每张约 100KB）；
> `tools/sprite-baker/index.html`（浏览器 glTF 烘焙页，日后换真实模型用）；
> `src/scene/spriteCraft.js`（运行时取帧 + 俯仰 crossfade + 矢量回退）；
> `src/scene/cameraDirector.js`（弹射起飞/捕获着舰外部跟拍，与座舱视角随机切换）；
> `src/scene/capitalFlyby.js`（歼星舰级分层侧视过场，接入主炮充能阶段）；
> 主画布护航机已改用精灵渲染——贴近甲板呈侧视、爬升转后 3/4 视角、巡航归位俯视，转弯附加方位摆动；
> `main.js` 渲染循环增加页面不可见暂停。
> 重新烘焙：`node tools/sprite-baker/bake-procedural.mjs`。
>
> **2026-06-12 增量**：舰长终端的星图页已替换为大舰侧视常驻外景（`capitalFlyby.drawAmbient`，慢速沿舰体跟踪 + 远景僚舰巡航 + LIVE 状态条），登录页与切换按钮保留（按钮文案 STAR MAP → SHIP VIEW / 舰体外景）。原 WebGL 星图渲染已移除，换为更省电的 2D 路径，且面板隐藏/页面不可见时跳过绘制。

目标：更逼真的战机模型、起降时镜头/视角自然变换、能呈现"歼星舰侧视图"级别的大舰场景，移动端稳定 50–60fps，且不引入 Blender 学习成本。

### 核心架构：3D 资产 + 2D 渲染（impostor sprites 预烘焙）

不在运行时跑实时 3D，而是**离线把 3D 模型烘焙成多角度精灵图集，运行时只做 2D 贴图**。这是老牌游戏（Star Fox、舰队类手游）验证过的方案：拥有 3D 的视角自由度，运行成本却和现在画 PNG 一样低。

流程：

1. **获取模型（零建模技能）**，按优先级：
   - 免费现成 glTF：Kenney Space Kit（CC0）、Quaternius 太空舰船包（CC0）、Sketchfab 按 CC0/CC-BY 筛选。低多边形风格反而和 HUD 美学契合。
   - AI 生成 3D：Meshy / Tripo / Luma Genie，文字或概念图直接出 glTF，适合定制"F-47"这类专属机型。
   - 需要微调时用浏览器端无代码编辑器 **Spline** 或 **Womp**（拖拽式，半天上手，导出 glTF），完全替代 Blender。
2. **烘焙工具（一次性投入，~200 行代码）**：写一个本地 HTML 页面，用 three.js 加载 glTF，自动旋转相机渲染 N 个角度（如 yaw 32 档 × pitch 3 档：平飞/爬升/俯冲），`canvas.toBlob` 导出拼成 sprite atlas（WebP）。每架机型一张图集 + 一份角度索引 JSON。
3. **运行时**：现有 canvas 2D 管线不变，`drawImage` 按当前航向/俯仰取最近角度帧，相邻帧 crossfade 消除跳变。引擎尾焰、阴影、锁定框作为独立小图层叠加。

**起降视角变换**：建立简单的相机状态机——甲板弹射位 → 追尾视角 → 侧方掠过 → 进场降落，每个状态对应一组（角度帧 + 缩放 + 位移）目标值，用现有 `lerp/easeOut` 补间。因为图集里任何角度都有现成帧，"战机从侧面转向尾部爬升"只是换帧 + 缓动，无 3D 计算。

### 歼星舰级大舰侧视场景：分层 2D，不需要 3D

《星球大战》开场那类镜头本质是"巨大物体缓慢掠过 + 强透视暗示"，用分层 2D 实现效果最好、成本最低：

- 舰体做成 3–4 层高分辨率 WebP（远景轮廓 / 主舰体 / 表面细节 greebles / 舷窗灯光层），不同速度视差滚动制造体积感；
- 舷窗灯光层用独立小贴图做随机闪烁，加一条缓慢扫过的高光渐变模拟自转光照；
- 素材来源：AI 图像生成（出侧视正交图很稳定）或从免费 glTF 大舰模型用上述烘焙页面渲一张超宽侧视图再手动切层。
- GPU 成本接近零，移动端无压力，且这类镜头作为"主炮充能/跃迁"的过场最出效果。

### 实时 3D 的有限使用（可选，仅桌面端）

若想要真正可旋转的 3D（如 pilot feed 里的座舱外视角），限定条件下可控：three.js 只渲染 pilot feed 一个小视口（≤400px）、低多边形模型、matcap 材质（无实时光照/阴影）、`pixelRatio` 上限 1.5。移动端检测后自动降级为精灵图方案。**不建议全屏实时 3D**——和 7 个 canvas 叠加后移动端帧率必崩。

### 移动端帧率预算（配套必做）

1. 合并渲染循环：现有 7 个 canvas 各自为政，统一到单一 rAF 调度，按需跳帧（雷达 30fps 即可，主场景 60fps）。
2. 所有精灵合入一张 atlas，减少解码与上下文切换。
3. `devicePixelRatio` 上限 1.5–2，避免 3x 屏全分辨率渲染。
4. 自适应降质：帧耗时连续 >20ms 时自动减半粒子数、关闭 crossfade。
5. `visibilitychange` / IntersectionObserver：不可见即暂停。

### 实施顺序建议

1. 先做烘焙工具页 + 一架战机验证（Kenney/Quaternius 现成模型），跑通"glTF → atlas → 运行时换帧"全链路；
2. 替换现有 F-47/轰炸机的手绘矢量与单角度 PNG；
3. 加相机状态机（起飞/追尾/侧掠/降落）；
4. 做大舰分层侧视过场；
5. 最后做移动端帧率预算与自适应降质。

## 四、HUD 设计语言 v2（2026-06-12 修订，已实施）

参照 Star Citizen 座舱 HUD 与 SpaceX 直播遥测的视觉语言，确立全站 HUD 规范。核心原则：

1. **细线优先**：所有 HUD 线条 1px（强调态最多 1.6px），禁止粗描边、禁止 shadowBlur 大光晕。
2. **稀疏刻度**：任何标尺最多 5 个刻度；删除一切装饰性网格（透视跑道、舱盖涂鸦、满框矩形一律改为四角短角标）。
3. **真实物体，不用占位符**：目标必须画真实彗星（彗核+彗发+离子尾），不画三角箭头；锁定用 SC 式四角括弧，锁定进度=括弧收紧，锁定成功=变绿+LOCK 字样。
4. **单行遥测**：底部信息一行文字+一条 1px 基线，不再使用文字面板盒子；状态标签为左上角小字 chip（必要时带闪烁红点）。
5. **每状态一个强调色**：巡航青 `#8ce8ff`、锁定绿 `#78ffb2`、威胁红 `#ff5c62`、操作琥珀 `#ffcd80`；同屏强调色不超过两种。
6. **弹幕=细曳光**：近防火力用 1px 短亮划线流（金/青相间）+ 炮口辉光 + 命中火花，禁止大光斑串。
7. **视角一致性**：同一事件在主画布与 Combat View 的镜头语言必须一致（起飞=侧视→后 3/4→俯视的同一组角度扫掠）。

实现载体：`src/ui/hmdMinimal.js`（cornerFrame / headingTape / arcGauge / boresight / cometTarget / targetBracket / telemetryLine / statusChip / tracerStream / impactSparks）。新增任何 HUD 画面必须复用这些元件。

### HUD 四区比例（最终决策，已实施）

`--hud-cols: 雷达 .13fr | 防御 .24fr | Combat View .38fr | 终端 .25fr`（最小宽 140/300/500/370px，面板高 212px）。

理由：Combat View 是全站电影感的载体，必须是视觉锚点（38%，黄金分割主位）；防御模块本质是按钮列表，24% 足够容纳四件武器而不显空旷；终端 25% 给星图足够呼吸空间；雷达是圆形仪表，13% 保持正方形即可。整体形成 1 : 1.85 : 2.9 : 1.9 的节奏，中右重心与 SC 座舱"中央目标区最大"的布局逻辑一致。

### 本轮修改记录（2026-06-12）

顶栏：品牌区三重竖线去重（隐藏 `.brand-sep`、删除 `.brand-version::before` 的伪元素竖线，仅保留 border-left 一条分隔线）；时钟改为与 Command 按钮同规格的边框 chip（34px 高、居中、11px 等宽字体）。
Combat View：默认/CIWS 画面全部重写为极简语言（删除透视网格、舱盖线、梯形刻度、手绘炮塔模型、三块信息面板）；主炮发射后的"绿色三角箭头"改为真实彗星+SC 括弧。
主画布：CIWS 弹幕改细曳光；战机起飞增加 2.2 秒甲板出击序列（近景大侧视→拉起后 3/4→巡航俯视 + 弹射尾流），与 Combat View 外部跟拍镜头语言一致。
终端：舰体外景撤销，星图回归并增强（旋转星场、漂移星云、地球→Alphard 航线脉冲与舰队当前位置标记、雷达扫掠、辉光标签、流星、Alphard 衍射星芒）；STAR MAP/LOGIN 切换按钮移入状态行内对齐；删除 21:9 letterbox，终端内容填满面板。
`drawPilotHmd` 中 ~170 行旧版死代码删除。

## 五、技术与功能路线图更新（在原 P2/P3 基础上）

P2 增补：HMD 元件单元测试基线（离屏渲染快照对比）；星图与航程里程碑联动（P3 的里程碑系统落地时星图航点点亮）。
P3 增补：Combat View 增加战术回放镜头（击杀后 2 秒慢放，替代立即切回 standby）；雷达面板同步极简化改造（目前仍是旧语言，下一轮处理）；武器面板 hover 弹出该武器的微型三视图（复用精灵图集）。

## 六、优先级速查

| 项 | 影响 | 工作量 |
|---|---|---|
| 附页字体自托管 | 高（美学根本没传达到访客） | 小 |
| SEO meta / OG | 高（分享零预览） | 小 |
| 图片压缩 | 高（首屏 13MB） | 小 |
| 真实数据管线 | 高（品牌可信度） | 中 |
| 死代码清理 | 中 | 极小 |
| reduced-motion / 性能降级 | 中 | 小 |
| 双美学 token 桥接 | 中 | 中 |
| 战斗-内容联动 | 高（差异化记忆点） | 中-大 |
| 战机精灵图烘焙管线 | 高（视觉跃升 + 移动端零额外开销） | 中 |
| 大舰分层侧视过场 | 中-高（最强镜头感） | 中 |
| 伪 CLI 终端 | 中（彩蛋传播） | 中 |

---

## Changelog · 2026-06-13 (UI polish pass)

全部修改集中在 `src/styles.css` 末尾的「final authoritative block」+ `src/ui/battleFeed.js`，最后入档，压过历史堆叠规则。

已完成：

- **Logo 光泽**：`.brand .brand-word` 之前被覆盖成静态渐变（只剩 glow 脉冲），恢复 `brandFlow` 流光扫过 + `brandOpsLight` 辉光双动画。
- **顶栏时钟**：去掉外框（来源是 6206 行 `.nav-clock{border;background;box-shadow}`），改为右对齐内联、极简；分/秒跳变时 `.clock-unit.changed` 触发 `clockTick` 低调青色微闪（符合太空场景）。
- **Battle log**：删除每条 `<time>` 时间戳（原本像第二个时钟、占横向空间），改为细severity彩点 + 最新事件即时置顶的实时 ticker；首列 grid 收窄回收空间。
- **播报 banner**（cruise/commander/nuke/main-gun）：从复古描边改为现代星舰遥测面板——深色玻璃 + 青/红强调轨 + 状态脉冲点 + 扫描高光，z-index 抬到 1200/1210 压过首屏标题，不再被文字遮挡。
- **Assets 按钮**：青色玻璃化，和 HUD 面板统一语言。

第二批（战机，`src/main.js`）：

- **尾焰**：`drawPilotF47Nose` 的单层径向火球换成分层加力燃烧——外层紫色锥 + 青色中焰 + 白热核心 + 激波钻石 + 喷口辉光 + 怠速闪烁。
- **Landing cockpit**：新增 `drawCockpitFrame()`——座舱 A 形支柱 + 控制台仪表盘 + 两块发光 MFD 面板 + 玻璃染色暗角，参照星际公民座舱参考图。已接入 landing 与 combat/standby 两个视角。
- **右下角杂散蓝线**：新的仪表盘覆盖画面底部约 26%，遮住该区域伪影。若蓝线仍露在仪表盘上方，需提供其精确位置以定位绘制源。

待办（建议新 session 配合可视化逐项做）：

- 战斗威胁标记去重 + 遇彗尾拖影自动避让。
- Terminal：login 移到右上角、hover 双指针修复、星图全屏化、顶部 ALPHARD/距离标签对齐四角 + 右上改为实时地球距离（不与左下重复）。
- 移动端：顶栏 + HUD 精简省屏（保留 terminal 与 battle cam）、logo 缩小并与最新 favicon 统一。
