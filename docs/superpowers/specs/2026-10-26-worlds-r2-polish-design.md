# Worlds 2026 页 · 第二轮修正 · 设计规格

日期：2026-10-26 · 状态：站主已口头批准第 1–3 部分，待审本文件 · 分支 `claude/worlds-r2-polish`（自 `origin/main` f7827c48）
前序：`docs/superpowers/specs/2026-10-25-worlds-2026-odds-design.md`（下称「一轮规格」）。本文只写变化；未提到的沿用一轮规格。

## 0. 已确认的决定（站主 2026-10-26 答复）

| # | 问题 | 决定 |
| --- | --- | --- |
| 12 | 「平率」含义 | 胜 / 负 + **打满率**（Bo3 的 2-1/1-2、Bo5 的 3-2/2-3 之和）+ 完整比分分布条；Bo1 只显示胜 / 负 |
| 10 | 版式 | **方案 A**：桌面左侧栏（面板导航 + 迷你摘要）+ 右侧面板；手机顶部分段标签 |
| 5 | 字体 | 官方字体不可免费合法获得 → 先用替代，字体做成 token；站主购买 Beaufort Pro（及 Spiegel）webfont 授权后提供 woff2，再换自托管 |
| 8 | MVP 照片 | 官方照片**自托管 + 署名**，页脚加 Riot「Legal Jibber Jabber」声明，失败回退占位 |
| 1 | 视觉、转盘、数据合同 | 第 1、2、3 部分按对话中方案通过 |

## 1. 目标与成功标准

逐条落实站主 13 条（编号同任务单），并保持：

- 新字段全部可选：旧 `worlds-data.json`（含今晚 20:04 首跑产物）仍过 `validateWorldsData`，页面缺字段时隐藏对应块、不报错。
- 门禁：`npm test`、`npm run typecheck`、`npm run data:check`、`npm run site:check`、`npm run build`、`node scripts/check-no-new-important.mjs`、Playwright 三个项目、`LIGHTHOUSE_ROUTE_IDS=worlds node scripts/run-lighthouse.mjs`（CLS ≤ 0.1、LCP ≤ 2500 ms、TBT 走全站 releaseBudgets）。
- 内置浏览器 1440 / 390 / 320 实测：转盘拨动、惯性 + 回弹、选边自动翻牌、深色队徽可见、中英切换、零横向溢出。

## 2. 视觉：Worlds 2026 · Know My Name × 布鲁克林工装（条目 4、11）

**依据**（2026-10-26 检索）：主题曲 True Damage《Know My Name》10-08 发布，MV 以 Faker 三连冠为线（Sheep Esports、Dot Esports、Strafe）；年度主题 THIS IS OUR MOMENT（lolesports Worlds 2026 primer）；官方周边有黑、灰两款 440 GSM 拉链卫衣（细条纹印花）、棒球帽、棒球衫，以及 Riot 周边线首件丹宁夹克（全身刺绣）（merch.riotgames.com、lolesports merch 公告）。Riot 未公布 2026 key art / 舞台色值，以下色板是根据周边实物推断的，**不是官方色值**。

**色板**（`.worlds-body` 上的 token，替换一轮的曜石/极光蓝）

| token | 值 | 用途 | 对 `#0b0b0d` 对比度 |
| --- | --- | --- | --- |
| `--bg` | `#0b0b0d` 沥青黑 | 页面底 | — |
| `--panel` | `#17181c` 石墨 | 面板、侧栏 | — |
| `--ink` | `#ecebe7` | 正文 | 16.5:1 |
| `--dim` | `#a3a6ad` 混凝土灰 | 次要文字 | 8.1:1（对 `--panel` 7.3:1） |
| `--denim` | `#1c2f4a` 原色丹宁 | 选中态、卡背 | 正文在其上 11.3:1 |
| `--wash` | `#8fb3e0` 水洗丹宁 | 链接、强调线、概率条 | 9.1:1 |
| `--stitch` | `#f5c542` 金色明线 | 虚线车线描边、Bo 徽 | 12.1:1 |
| `--td-mag` | `#ff4fa8` True Damage 品红 | 贴纸、分歧标记、负方条 | 6.5:1 |
| `--td-cyan` | `#3ee6ff` True Damage 电青 | 焦点环、一致标记 | 13.1:1 |
| `--plate` | `#d9dde3` 银灰底盘 | 所有队徽底盘 | `#0b0b0d` 在其上 14.4:1 |

霓虹（品红、电青）只做点缀，不做正文色（design.md §2.1）。

**材质**（全部 CSS，不引入图片，不影响 LCP）：拉链齿分隔线（`repeating-linear-gradient`）；区块标题做成「织标」（窄条底色 + 细边）；卡片、侧栏用 1px 金色虚线车线（`outline-offset` 内缩）；徽章做成略微歪贴的贴纸（`rotate(-3deg)`）；丹宁斜纹用 45° 细线 `repeating-linear-gradient` 叠在 `--denim` 上，透明度 ≤ 0.08。

**队徽（条目 11）**：抽卡、夺冠条、积分表、侧栏摘要里的所有队徽统一走 `logo()`，外层 `.plate`（`--plate` 底、圆角 8px、内边距 3px），深色队徽（TSW、LOS 等）一律清晰。无图时显示队码文字（同样在底盘上）。

## 3. 字体（条目 5）

**许可结论**：
- *Beaufort for LOL*：Monotype 为 Riot 定制、扩展的版本，母版是 Nick Shinn 的 Beaufort（Shinntype）。Riot 定制版不对外授权。
- *Spiegel*：LucasFonts 的商业字体。没有查到公开的零售 webfont 渠道。
- 中文：没有查到国服或 LPL 官方字体的公开资料。腾讯 LOL 前端规范只写了「引用客户端内嵌字体，设计稿统一微软雅黑」。
- 不下载、不外链任何 Riot 托管或盗版的字体文件。

**本轮**：字体做成 token，一处替换即可：
- `--display`：`'Cinzel'` → 回退 `'Noto Serif SC'`、系统衬线。Cinzel 是衬线大写字体，最接近 Beaufort。
- `--body`：`'Fira Sans'` → 回退 `'PingFang SC'`、`'Noto Sans SC'`、system-ui。Fira Sans 是人文无衬线，接近 Spiegel。
- `--mono`：沿用自托管的 JetBrains Mono。
- 中文标题用 Noto Serif SC（思源宋体），中文正文走系统黑体。思源黑体 webfont 不加载，因为它体积大，系统字体已经够用。
- 加载方式沿用一轮的教训：`worlds.js` 在 parse 之后挂载 Google Fonts 样式表，`display=optional`。HTML 里不放阻塞型 `<link>`。`fonts.googleapis.com` 和 `fonts.gstatic.com` 已在 CSP 白名单里。
- 换成授权字体的方法：把 woff2 放进 `public/assets/fonts/`，写 `@font-face`（`font-display: optional`），把 token 的首选字体改掉。

## 4. 版式：方案 A（条目 10）

- **桌面 ≥ 1024 px**：`grid-template-columns: 220px minmax(0,1fr)`。
  - 左侧栏 `position: sticky`，上半部是面板导航：抽卡 Cards、夺冠 Odds、MVP、积分 Swiss、Meta。
  - 下半部是拉链分隔的「迷你摘要」：下一场倒计时、你 vs Fable 命中数、夺冠前三的概率及 implied 赔率。
  - 右侧内容区顶部是精简 hero（标题、版本、provenance 徽标、一行声明），下面只显示当前面板。
- **手机 / 平板 < 1024 px**：hero 下面是 sticky 分段标签，可横向滚动，与侧栏导航共用同一套面板状态；迷你摘要折叠成标签上方的一行。
- **面板切换**：用 `hidden` 属性切换，状态写入 `location.hash`（`#cards`、`#odds`、`#mvp`、`#swiss`、`#meta`），首屏按 hash 恢复，缺省为 `#cards`。导航用 `role="tablist"` 和 `aria-selected`，标签支持左右方向键切换。
- **面板与原区块对应**：
  - Cards：赛段滑轨、转盘、抽出卡详情、你 vs Fable
  - Odds：夺冠概率、Fearless 池
  - MVP：决赛 MVP
  - Swiss：积分表
  - Meta：Meta 表
- **CLS**：hero、侧栏、标签、滑轨、转盘都在 CSS 里预留固定高度（数据到达前就占位）；面板切换只发生在用户交互之后。

## 5. 转盘抽卡（条目 1、2）

**形态**：
- 滑轨窗口只选一格时，牌面区显示转盘：卡数 N ≥ 4 用闭环 3D 转盘，每张卡 `rotateY(i·360/N) translateZ(r)`，父层 `perspective`；N ≤ 3（半决赛、决赛等）用平铺弧形，按 `translateX` 加轻微 `rotateY` 排列。
- 2–3 格时显示中卡，4 格以上显示树（与一轮一致）。点中卡或树节点仍然跳转到对应的那一格。

**物理效果（纯函数 `src/lib/worldsCarousel.js`，vitest TDD）**：
- 状态：`{ pos, vel, n, loop }`。`pos` 是浮点卡位索引。
- `drag(state, dxCards)`：跟手移动。弧形模式越过两端时按阻尼（越界距离 × 0.35）形成橡皮筋效果。
- `release(state, velocity)`：开始惯性滑动。
- `step(state, dt)`：每帧推进一次，有三个阶段：
  1. 惯性：速度按摩擦衰减（每 16 ms 乘 0.92）。
  2. 速度降到 0.02 卡/帧以下后，用弹簧（刚度 0.12、阻尼 0.78，即欠阻尼）吸附到最近的整数位置，带轻微过冲，形成「弹弓」感。
  3. 位置与目标的距离和速度都低于阈值后停止，并返回 `settled: true`。
- 闭环模式下 `pos` 对 N 取模；弧形模式下目标位置限制在 `[0, N-1]` 之内。
- `snapTarget(state)`、`indexAt(pos, n, loop)` 为辅助函数。
- 页面用 `requestAnimationFrame` 驱动，只改容器的一个 CSS 变量 `--rot`（或 `--x`），不重建 DOM。
- `prefers-reduced-motion` 打开时，`release` 直接把位置设到吸附目标，没有惯性也没有过冲。

**输入**：
- 指针拖动：`touch-action: pan-y`，横向转转盘，纵向照常滚动页面；手势前 10 px 判定方向。
- 滚轮：鼠标悬停在转盘上时，`deltaX` 和 `deltaY` 都用来转动（`preventDefault`），按位移累计速度，停顿 120 ms 后视为松手；其余区域正常滚动页面。
- 键盘：转盘获得焦点时，左右方向键转一张，Enter 或空格抽出正中那张卡。

**抽卡流程（条目 2，取消第二次点击）**：
- 点击正中的卡（或按 Enter）：卡片抽出，放大成详情卡（在转盘下方的固定高度区域渲染，不是浮层，避免 CLS），转盘里的这张卡同时高亮。
- 详情卡背面有两侧队徽按钮（≥ 44 px）。**点击任意一侧就立刻 `choose`，然后自动 `reveal`，600 ms 3D 翻转**；如果没开 reduced-motion，同时播放 12 个粒子效果。
- 已翻开的卡、已赛的卡、错过的卡，抽出后直接显示正面。
- 状态机 `worldsCards.js` 新增纯函数 `chooseAndReveal(picks, series, side, now)`：开赛后拒绝，已翻开的不再改。旧的 `ready` 状态保留，用于兼容本地存储里「已选未翻」的老记录，这类卡抽出后自动翻开。
- 「开整包」：一次翻开当前赛段里所有已选边的卡，按钮保留。

## 6. 每队抽卡细节（条目 12）与夺冠 / MVP 赔率（条目 13）

**数据合同增量**（`public/worlds-data.json`，全部可选）：

```
series[].pick.scores     { "2-0":0.61, "2-1":0.26, "1-2":0.04, "0-2":0.09 }  // home-away 键，和≈1（±0.01）
series[].pick.pDecider   0.30            // 仅 bo>1；= 打满局的比分概率之和
teams[]                  [{ team,
                            players: { best:  { player, role, score, stats:{kda,dpm,kp,gd15}, reason_en, reason_zh },
                                       worst: { … } },
                            tactics: { best:  { key, value, pct, reason_en, reason_zh },
                                       worst: { … } } }]
champion[].oddsImplied   2.23            // = round(100/prob, 2)；prob=0 时为 null
mvp[].oddsImplied        3.51
meta[].key               "MonkeyKing"    // Data Dragon 英雄 id
ddragon                  "16.21.1"       // Data Dragon 版本
```

**计算方法（代码，纯函数，写入 `src/lib/worldsModel.js`，用 vitest）**：
- `seriesDistribution(scores, bo)`：根据 `enumerateSeries().scores` 生成 `scores`（保留 3 位小数，并把舍入误差补到众数项上，保证和为 1）和 `pDecider`。`build` 时计算；`finalize` 在 adj 修正后用 `enumerateForTarget` 的结果重新计算。
- `teamPlayerExtremes(players)`：输入是选手行 `{player, teamCode, role, games, kda, dpm, kp, gd15}`，只取 `games ≥ 2` 的选手。对 KDA、DPM、KP%、GD@15 四项**在同位置内**做 z 分数，取平均作为 `score`，然后每队取最高和最低的人。某队合格选手少于 2 人时不输出这一项。
- `teamTacticExtremes(teamRows)`：gol.gg 战队表（新抓 `teams/list/…`，写入 `raw/teams.html`）的 GD@15、FB%、FT%、DRA%、VGPG（虚空巢虫/局）、NASH% 六项，全部是越高越好。在全部参赛队里算百分位 `pct`，每队取最高和最低的一项，`value` 保留原表的显示字符串。
- `oddsImplied`：`round(100/prob, 2)`，页面标「implied」。
- Data Dragon：`build` 抓 `api/versions.json`，取第一个版本；再抓 `cdn/<v>/data/en_US/champion.json`，建立 name → id 的映射。失败时沿用 baseline 里的 `ddragon` 字段，并在 notes 里记一条。页面兜底：没有 `key` 时，从英雄名里去掉非字母字符作为 key，再套用少量例外表（Wukong→MonkeyKing、Nunu & Willump→Nunu、Renata Glasc→Renata、Kai'Sa→Kaisa 等）。没有 `ddragon` 时用页面常量 `16.21.1`。

**模型（`prompts/leagues-worlds.md` V2）只写理由，不选人、不改数字**：
- 输出新增：
  ```
  "teams":[{ "team":"GEN",
    "best_player_en":"","best_player_zh":"", "worst_player_en":"","worst_player_zh":"",
    "best_tactic_en":"","best_tactic_zh":"", "worst_tactic_en":"","worst_tactic_zh":"" }]
  ```
  每项 ≤ 40 词 / ≤ 60 字，必须引用 payload 里 `teams[]` 的数字。新闻只能用来补充语境。
- `champion[]` 和 `mvp[]` 的理由放宽到 ≤ 80 词 / ≤ 160 字，并且要说明 implied 赔率与 market 的差距。
- payload 新增 `teams`（代码选出的四个极值及其数字），`champion` 和 `mvp` 带上 `oddsImplied`。
- `finalize`：把理由截断到上限（en 400 字符、zh 120 字符；champion/mvp 改为 en 600、zh 320）后合并。模型漏写的队伍保持空串。

**页面**：
- 详情卡正面（Fable 研判）新增几项：胜 / 打满 / 负三列，Bo1 只有两列；比分分布条；双方各自的最强与最弱选手、最强与最弱战术点，以及理由（可折叠，默认显示一句话）。
- 夺冠和 MVP 每行显示 `44.8% · 2.23× implied`，下面接理由。
- 缺字段时对应块不渲染。

**校验器**：上述字段存在时才校验，规则如下。
- `scores`：键匹配 `^\d-\d$`、值在 (0,1]、和为 1±0.01。
- `pDecider`：在 [0,1]。
- `teams[].team` 非空；`players.best/worst.player` 非空字符串。
- `tactics.*.key` 属于六项指标之一；`pct` 在 [0,1]。
- `oddsImplied`：大于等于 1，或为 null。
- `meta[].key`：匹配 `^[A-Za-z]+$`。
- `ddragon`：匹配 `^\d+\.\d+\.\d+$`。

## 7. 其余条目

- **3 数据来源**：删除页面上的 Sources 区块和 `renderSources`。`sources[]` 仍留在数据合同里（管线和校验要用）。provenance 徽标不再显示来源数。
- **6 Clawd**：`FABLE_ICON` 改成自绘的像素 SVG：14×12 网格，`#D77757` 方块身体、两侧小臂、四条腿、两只深色眼睛，`shape-rendering="crispEdges"`。页脚加一句「Claude 与 Clawd 是 Anthropic 的商标与形象；本站与 Anthropic 无隶属关系」。
- **7 模型名**：`provenanceBadge.js` 里的 `'FABLE 5 MAX'` 改为 `'Fable 5.1 Max'`（这个模块只有 worlds 页在用），单测同步修改。页面里所有「FABLE」文案统一为 `Fable 5.1 Max` 或 `Fable`。
- **8 MVP 照片**：
  - 文件：`public/assets/worlds/players/<slug>.webp`，96×96，每张不超过 8 KB。来源是 lolesports 官方选手页或 Leaguepedia 上 Riot 发布的照片，由本会话一次性下载并压缩。
  - 清单：`src/lib/worldsPlayerPhotos.js`，每条为 `{ player: { file, sourceUrl } }`，覆盖 16 队首发。拿不到的选手留空，页面显示占位：队徽底盘加选手首字母。
  - `<img>` 写死宽高，`onerror` 时换成占位。
  - 页脚：「选手照片 © Riot Games，来源见清单」，以及 Riot 的声明 *"AFFLATUS Worlds 2026 was created under Riot Games' 'Legal Jibber Jabber' policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project."*（中英各一份）。
- **9 Meta 头像**：每行第一列显示 32 px 方形头像，带统一头像框（`--plate` 细边加金色车线角标），`loading="lazy"`、写死宽高，`onerror` 时换成首字母方块。
- **CSP**：`vercel.json` 里 report-only 的 `img-src` 补上 `https://ddragon.leagueoflegends.com https://gol.gg`。这条只记录违规、不拦截，但能把上线后已知的报警清掉。

## 8. 管线与定时任务同步

- `build-worlds-candidate.mjs`：新增抓取 `teams.html`（gol.gg 战队表）、`ddragon-versions.json` 和 `ddragon-champions.json`，离线夹具也支持这三个文件；输出 §6 的各个新字段；payload 新增 `teams`。
- `finalize-worlds-candidate.mjs`：在 adj 修正后重新计算 `scores` 和 `pDecider`；合并 `teams` 的理由；放宽 champion 和 mvp 的理由长度。
- `prompts/leagues-worlds.md`：升级为 V2（新增输出 schema 和长度规则），README 索引行同步更新。
- `~/.claude/scheduled-tasks/worlds-2026-daily/SKILL.md`：**合并到 main 之后**再用 `update_scheduled_task` 改，因为第 6 步提到的输出字段多了 `teams` 和更长的理由。旧版 SKILL 配新代码依然可用：新字段都可选，漏写就保持空串。
- 合并时间：避开墨尔本时间 19:30–21:00。合并前必须先问站主。

## 9. 测试

- `worldsCarousel.test.js`（新增，TDD）：拖动跟手；弧形模式越界时的阻尼；松手后惯性逐步衰减；最终一定落在整数位置（闭环模式取模）；过冲不超过 0.25 张；reduced-motion 下直接到位；N = 1 和 N = 2 的边界。
- `worldsModel.test.js`：`seriesDistribution` 的结果和为 1、`pDecider` 等于打满局概率之和、Bo1 没有 `pDecider`；`teamPlayerExtremes` 在同位置内比较（辅助不会因为 DPM 低被判为最弱）、处理 `games` 过滤与合格人数不足；`teamTacticExtremes` 的百分位计算与并列处理；`oddsImplied`。
- `worldsCards.test.js`：`chooseAndReveal` 的各种状态。
- `validateWorldsData.test.js`：旧数据（不带新字段）能通过；带新字段的合法数据能通过；每个新规则各有一条失败用例。
- `build-worlds-candidate` 离线夹具回放：新增 `teams.html` 和 ddragon 两个夹具。
- `provenanceBadge.test.js`：断言新的模型名。
- Playwright：沿用 worlds 路由的三个用例，更新选择器（Sources 区块去掉、面板标签、转盘），并加一条用例：选边后卡片自动翻开。

## 10. 不做

- 不做实时比分、跨设备同步、WebGL 或 three.js。
- 不改共享页头。
- 不改别的页面的字体。
- 不抓 Riot 官方 API（需要 key）。
- Fearless 池仍用 gol.gg 的英雄头像，本轮只给 Meta 表接 Data Dragon。
