# Worlds 2026 页第二轮修正 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落实站主第二轮 13 条：转盘抽卡、选边即翻、删来源区、Know My Name × 工装主题、替代字体 token、Clawd、`Fable 5.1 Max`、MVP 官方照片、Meta Data Dragon 头像、方案 A 版式、队徽底盘、每队极值与比分分布、夺冠/MVP implied 赔率。

**Architecture:** 数字和选择全部由纯函数计算（`worldsModel.js`、`worldsCarousel.js`、`worldsCards.js`，vitest TDD），构建脚本写进可选的新字段，finalize 合并模型理由；页面只做 DOM 胶水，缺字段就隐藏对应块。版式是 CSS grid 侧栏加 `hidden` 面板切换，转盘用 CSS 3D 加 rAF 改一个 CSS 变量。

**Tech Stack:** Vite 多页静态站、原生 ES modules、vitest、Playwright、Lighthouse CI、Node 脚本（`node:fs`、`fetch`）。

**Spec:** `docs/superpowers/specs/2026-10-26-worlds-r2-polish-design.md`（同时读一轮规格 `docs/superpowers/specs/2026-10-25-worlds-2026-odds-design.md`）

## Global Constraints

- 新字段全部可选：现有 `public/worlds-data.json` 不改也必须通过 `validateWorldsData` 并能正常渲染。
- 色板 token（`.worlds-body`）：`--bg #0b0b0d`、`--panel #17181c`、`--ink #ecebe7`、`--dim #a3a6ad`、`--denim #1c2f4a`、`--wash #8fb3e0`、`--stitch #f5c542`、`--td-mag #ff4fa8`、`--td-cyan #3ee6ff`、`--plate #d9dde3`。品红和电青不能用作正文色；正文对比度 ≥ 4.5:1。
- 字体 token：`--display: 'Cinzel','Noto Serif SC',Georgia,serif`；`--body: 'Fira Sans','PingFang SC','Noto Sans SC',system-ui,sans-serif`；`--mono` 不变。Google Fonts 只能由 `worlds.js` 在 parse 之后挂载，并带 `display=optional`；HTML 里不放阻塞的字体 `<link>`。
- 模型名显示为 `Fable 5.1 Max`。
- Clawd 颜色用 `#D77757`。
- 不改 css:check 的 ratchet：不新增 `!important`（用 `node scripts/check-no-new-important.mjs` 检查），也不新增层叠覆盖。
- 版式断点 1024 px；侧栏宽 220 px；面板 hash 为 `#cards #odds #mvp #swiss #meta`。
- 转盘参数：每 16 ms 摩擦系数 0.92；进入吸附的速度阈值为 0.02 卡/帧；弹簧刚度 0.12、阻尼 0.78；过冲不超过 0.25 卡；弧形越界阻尼 0.35；N ≥ 4 时闭环，N ≤ 3 时用弧形。
- 理由长度上限：系列赛、队伍极值 en 400 字符、zh 120 字符；champion 和 mvp en 600 字符、zh 320 字符。
- 提交信息末尾带 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`；不用裸 `git stash`；合并 main 前必须先问站主，并且避开墨尔本时间 19:30–21:00。
- 定时任务 SKILL.md 只在合并之后用 `mcp__scheduled-tasks__update_scheduled_task` 修改。

## Review Focus

1. **一轮遗留的本地记录**：localStorage 里 `{side, revealed:false}` 这种已选但未翻的卡，抽出后应当直接翻开，不能卡在没有翻牌入口的状态。归 Task 3 和 Task 13。
2. **今晚首跑的旧形状数据**：没有 `teams`、`scores`、`oddsImplied`、`ddragon` 字段时，页面所有面板都要能渲染、控制台不报错。归 Task 4（validator）和 Task 16（Playwright 用现有数据跑）。
3. **英雄名到 Data Dragon id 的特殊映射**：Wukong、Nunu & Willump、Kai'Sa、Bel'Veth、Cho'Gath、Dr. Mundo、LeBlanc、Renata Glasc、K'Sante 都要映射对，失败时回退成首字母头像。归 Task 5（`championKey`）。
4. **转盘的极端卡数**：N = 0 显示空态、N = 1 不能拖、N = 2 弧形且两端回弹；当前赛段里某张卡在抽出期间开赛，要锁定为错过。归 Task 1 和 Task 13。
5. **选手名做文件名**：带空格、撇号、大小写的选手名（例如 `Kiin`、`Hope`、`Xun`）要稳定转成 slug，照片缺失或 404 时回退占位。归 Task 10（`playerSlug`）。

---

### Task 1: 转盘物理 `worldsCarousel.js`

**Files:**
- Create: `src/lib/worldsCarousel.js`
- Test: `tests/worldsCarousel.test.js`

**Interfaces:**
- Produces: `createCarousel(n, pos = 0) → {pos, vel, n, loop, phase:'idle'}`（`loop = n >= 4`）；`drag(state, dCards) → state`；`release(state, velCardsPerFrame, {reduced=false}) → state`；`step(state, dtMs) → state`（settle 之后 `phase:'idle'`）；`indexAt(pos, n, loop) → int`；`goTo(state, index) → state`（用弹簧动画转到指定卡）。全部是纯函数，返回新对象，不修改入参。

- [ ] **Step 1: 写失败测试**：
  - `drag` 把 pos 加 dCards；弧形模式在 n=3、pos 为 0 时 drag −1，pos 变为 −0.35。
  - `release(…,0.5)` 后反复 `step(…,16)`，速度单调衰减，最终 `phase==='idle'` 且 `pos` 为整数。
  - 闭环 n=8 时，最终 pos 落在 `[0,8)` 内。
  - 从 pos 2.4、零速度开始，过程中 `|pos − target|` 的最大过冲不超过 0.25。
  - 带 `{reduced:true}` 的 `release` 直接返回 `phase:'idle'` 和整数 pos。
  - n=1 时 drag 任何值，最终都回到 0。
  - `indexAt(-0.6,8,true)===7`；`indexAt(3.7,3,false)===2`。
  - `goTo(state,5)` 经过 `step` 后停在 5。
- [ ] **Step 2: 运行** `npx vitest run tests/worldsCarousel.test.js`，预期失败（模块不存在）。
- [ ] **Step 3: 实现**：按 dt/16 缩放的显式欧拉积分。惯性阶段 `vel *= 0.92^(dt/16)`；当 `|vel| < 0.02` 时切换到弹簧阶段，目标为 `round(pos)`（弧形时 clamp 到 `[0,n-1]`）：`acc = 0.12·(target−pos)`，`vel = (vel + acc)·0.78`。当 `|target−pos| < 0.001` 且 `|vel| < 0.001` 时把 pos 设为 target、状态设为 idle；闭环模式在 settle 时对 n 取模。弧形模式惯性阶段越界时直接进入弹簧阶段。
- [ ] **Step 4: 运行测试**，预期全部通过。
- [ ] **Step 5: 提交** `feat(worlds): carousel physics (inertia + spring snap)`

### Task 2: 模型增量（比分分布、选手和战术极值、implied 赔率）

**Files:**
- Modify: `src/lib/worldsModel.js`（在末尾追加导出）
- Test: `tests/worldsModel.test.js`

**Interfaces:**
- Consumes: 已有的 `enumerateSeries(p, bo, delta) → {pWin, scores, best}`
- Produces:
  - `seriesDistribution(scores, bo) → { scores: {[k:string]:number}, pDecider?: number }`
  - `teamPlayerExtremes(rows) → { [team]: { best, worst } }`，其中 `best`/`worst` 为 `{player, role, score, stats:{kda,dpm,kp,gd15}}`；`rows` 为 `{player, teamCode, role, games, kda, dpm, kp, gd15}[]`
  - `TACTIC_KEYS = ['GD@15','FB%','FT%','DRA%','VGPG','NASH%']`
  - `teamTacticExtremes(rows) → { [team]: { best:{key,value,pct}, worst:{key,value,pct} } }`，其中 `rows` 为 `{team, values:{[key]:{raw:number, display:string}}}[]`
  - `oddsFromPct(prob) → number|null`

- [ ] **Step 1: 写失败测试**：
  - `seriesDistribution(enumerateSeries(0.6,3).scores,3)`：四个键，和为 1（误差 ≤ 1e-9，舍入到 3 位后误差 ≤ 0.001），`pDecider` 等于 `scores['2-1']+scores['1-2']`。
  - Bo5 的 `pDecider` 等于 `'3-2'+'2-3'`。
  - Bo1 结果不含 `pDecider` 键。
  - `teamPlayerExtremes`：构造两队各 5 人，辅助的 DPM 很低但 KDA 和 KP 很高，结果中辅助不是 worst（因为是同位置内比较）；`games<2` 的选手被排除；合格人数少于 2 的队不出现在结果里。
  - `teamTacticExtremes`：3 队、GD@15 分别为 −500、0、+800，+800 那队的 best.key 为 'GD@15' 且 pct 为 1；值相同的队 pct 也相同（取平均名次）。
  - `oddsFromPct(44.8)===2.23`；`oddsFromPct(0)===null`。
- [ ] **Step 2: 运行** `npx vitest run tests/worldsModel.test.js`，预期新用例失败。
- [ ] **Step 3: 实现**：
  - `seriesDistribution`：每项四舍五入到 3 位，把残差加到概率最大的那一项。`pDecider` 取胜方差一局到满局的那些比分的概率之和（键里两数之和等于 bo）。
  - z 分数：按位置分组，`(x−mean)/sd`；sd 为 0 时 z 记 0。`score` 为四项 z 的平均值，保留 3 位。`stats` 原样带上。
  - 百分位：`pct = (rank−1)/(n−1)`，升序排名，并列取平均名次；n=1 时 pct 为 1。
- [ ] **Step 4: 运行测试**，预期通过。
- [ ] **Step 5: 提交** `feat(worlds): score distribution, team extremes and implied odds`

### Task 3: 状态机 `chooseAndReveal`

**Files:**
- Modify: `src/lib/worldsCards.js`
- Test: `tests/worldsCards.test.js`

**Interfaces:**
- Produces: `chooseAndReveal(picks, series, side, now) → picks`。开赛后、已翻开、或 side 非法时返回原对象；否则返回 `{side, pickedAt, revealed:true}`。另新增 `needsAutoReveal(entry) → boolean`，对 `revealed:false` 的老记录返回 true。

- [ ] **Step 1: 写失败测试**：
  - 开赛前 `chooseAndReveal` 之后 `cardState` 为 `'revealed'`。
  - 开赛后调用返回原对象（`toBe`）。
  - 已翻开的不能改边。
  - 对 `{side:'home',revealed:false}`，`needsAutoReveal` 为 true。
- [ ] **Step 2: 运行**，预期失败。
- [ ] **Step 3: 实现**：用 `choose` 再接 `reveal` 组合实现。
- [ ] **Step 4: 运行**，预期通过。
- [ ] **Step 5: 提交** `feat(worlds): pick-and-reveal in one step`

### Task 4: 校验器支持新可选字段

**Files:**
- Modify: `src/lib/validateWorldsData.js`
- Test: `tests/validateWorldsData.test.js`

**Interfaces:**
- Consumes: Task 2 的 `TACTIC_KEYS`（从 `worldsModel.js` 导入）
- Produces: 校验规则见规格 §6 末段，字段存在时才校验。

- [ ] **Step 1: 写失败测试**：
  - `public/worlds-data.json` 原样 `ok:true`（旧形状）。
  - 在它上面加齐合法的新字段，仍然 `ok:true`。
  - 失败用例各一条，并断言错误信息含路径：`pick.scores` 和为 0.9；`pick.scores` 有键 `'2:0'`；`pDecider` 为 1.2；`teams[0].players.best.player` 为空；`tactics.best.key` 为 `'KDA'`；`tactics.best.pct` 为 2；`champion[0].oddsImplied` 为 0.5；`meta[0].key` 为 `'Kai'Sa'`；`ddragon` 为 `'latest'`。
- [ ] **Step 2: 运行**，预期失败。
- [ ] **Step 3: 实现**：新增 `validateTeams`，并在 `validatePick`、`validateProbBoard`、`validateMeta` 和顶层加可选分支。不改动已有规则。
- [ ] **Step 4: 运行**，预期通过。
- [ ] **Step 5: 提交** `feat(worlds): validate optional round-2 fields`

### Task 5: 数据源解析（战队表、选手 GD@15、Data Dragon）

**Files:**
- Modify: `scripts/lib/worlds-sources.mjs`
- Create: `src/lib/worldsChampionKey.js`、`tests/worldsChampionKey.test.js`、`tests/fixtures/worlds/teams-table.html`（现在抓一份 gol.gg `teams/list/season-S16/split-ALL/tournament-Worlds 2026 Main Event/`，裁剪到只剩表格）、`tests/fixtures/worlds/ddragon-versions.json`（截取前 3 项）、`tests/fixtures/worlds/ddragon-champions.json`（从 `cdn/16.21.1/data/en_US/champion.json` 取 `data` 里 Review Focus 3 列出的英雄，加上 fixtures 里出现的英雄，只保留 `id` 和 `name`）
- Test: `tests/worldsSources.test.js`

**Interfaces:**
- Produces:
  - `GOLGG.teams(tournament)` URL
  - `parseTeamTable(html) → {team, values:{[TACTIC_KEY]:{raw,display}}}[]`（列头映射：`gd@15→GD@15`、`fb%→FB%`、`ft%→FT%`、`dra%→DRA%`、`vgpg→VGPG`、`nash%→NASH%`；`team` 经 `teamCode`）
  - `parsePlayerTable` 的每行新增 `gd15`
  - `DDRAGON.versions`、`DDRAGON.champions(v)` 两个 URL
  - `championKeyMap(json) → Map<name, id>`
  - `championKey(name, map?) → string`，放在 **`src/lib/worldsChampionKey.js`**（页面也要用），`worlds-sources.mjs` 从那里 re-export。有 map 时查 map；否则查例外表 `{Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',LeBlanc:'Leblanc',"Kai'Sa":'Kaisa',"Bel'Veth":'Belveth',"Cho'Gath":'Chogath',"Kha'Zix":'Khazix',"Vel'Koz":'Velkoz'}`；再查不到就去掉非字母（得到 `RekSai`、`KogMaw`、`KSante`、`DrMundo`）。测试另建 `tests/worldsChampionKey.test.js`。

- [ ] **Step 1: 写失败测试**：
  - `parseTeamTable(fixture)`：16 行，每行六个 key 齐全，GEN 的 `values['GD@15'].raw` 是数字。
  - `parsePlayerTable(players fixture)` 至少一行 `gd15` 为数字。
  - `championKey`：`"Kai'Sa"→'Kaisa'`、`"Bel'Veth"→'Belveth'`、`"Cho'Gath"→'Chogath'`、`'Dr. Mundo'→'DrMundo'`、`'LeBlanc'→'Leblanc'`、`"K'Sante"→'KSante'`、`'Wukong'→'MonkeyKing'`。全部在**无 map** 时成立；另测有 map 时以 map 为准（map 里 `'Foo'→'Bar'` 得 `'Bar'`）。
- [ ] **Step 2: 运行**，预期失败。
- [ ] **Step 3: 实现**：沿用 `statsTable`、`number`、`text` 等辅助函数。
- [ ] **Step 4: 运行**，预期通过。
- [ ] **Step 5: 提交** `feat(worlds): parse gol.gg team table, player GD@15 and Data Dragon ids`

### Task 6: 构建脚本输出新字段

**Files:**
- Modify: `scripts/build-worlds-candidate.mjs`
- Test: `tests/buildWorldsCandidate.test.js`（`FILES` 增加 `'teams.html':'teams-table.html'`、`'ddragon-versions.json'`、`'ddragon-champions.json'`）

**Interfaces:**
- Consumes: Task 2 和 Task 5 的全部导出
- Produces: 候选数据含 `pick.scores/pDecider`、`teams[]`、`champion[]/mvp[].oddsImplied`、`meta[].key`、`ddragon`；payload 含 `teams` 以及 `champion`/`mvp` 的 `oddsImplied`；`teams[]` 的理由沿用 baseline 中同队同名同 key 的旧理由，否则为空串。

- [ ] **Step 1: 写失败测试**（追加到已有 describe）：
  - 每个未开赛的 pick 都有 `scores`，Bo3 还有 `pDecider`。
  - `data.teams.length` 至少为 1，每项 `players.best.player` 非空。
  - `data.champion.every(c => c.prob===0 ? c.oddsImplied===null : c.oddsImplied>=1)`。
  - `data.meta[0].key` 匹配 `/^[A-Za-z]+$/`，且 `data.ddragon==='16.21.1'`（与夹具一致）。
  - `payload.teams` 存在。
  - 仍然 `validateWorldsData(data).ok`。
  - 再加一个用例：不复制 ddragon 和 teams 夹具时构建仍成功、`teams` 为空数组、`notes` 里各有一条说明。
- [ ] **Step 2: 运行** `npx vitest run tests/buildWorldsCandidate.test.js`，预期失败。
- [ ] **Step 3: 实现**：
  - 在已有的 `source()` 机制里加入 `teams.html`、`ddragon-versions.json`、`ddragon-champions.json` 三个来源。`ddragon-champions` 的 URL 依赖 versions 的结果；如果 versions 失败，用 baseline 的 `ddragon` 版本号，并写一条 note。
  - 选手行由 `rosterOf` 补上 role 和 teamCode（已有逻辑）。
  - pick 在 `enumerateSeries` 结果上调用 `seriesDistribution`。
  - `sources` 的 label 补上三个新文件名。
- [ ] **Step 4: 运行**，预期通过；同时 `npx vitest run tests/worldsSources.test.js` 也要通过。
- [ ] **Step 5: 提交** `feat(worlds): candidate emits scorelines, team extremes, implied odds, ddragon keys`

### Task 7: finalize 合并新字段

**Files:**
- Modify: `scripts/finalize-worlds-candidate.mjs`
- Test: `tests/finalizeWorldsCandidate.test.js`

**Interfaces:**
- Consumes: Task 2 的 `seriesDistribution`；模型输出中的 `teams[]`，键为 `best_player_en/zh`、`worst_player_en/zh`、`best_tactic_en/zh`、`worst_tactic_en/zh`
- Produces: adj 修正后 `pick.scores` 和 `pick.pDecider` 与新的 `pWin` 一致；`teams[].players.best.reason_en` 等字段已合并；champion 和 mvp 理由的上限改为 en 600 / zh 320。

- [ ] **Step 1: 写失败测试**：
  - 有 adj 的系列赛：finalize 后 `pick.scores` 中主队获胜比分之和等于 `pick.pWin[0]`（误差 ±0.002）。
  - 模型的 `teams` 理由被写进对应位置，en 超长部分截断到 400 字符。
  - 模型漏写某队时，该队理由仍为空串。
  - champion 理由 700 字符被截断到 600。
  - 候选里没有 `teams` 字段（旧形状）时，finalize 不报错。
- [ ] **Step 2: 运行**，预期失败。
- [ ] **Step 3: 实现**：在 adj 分支里用 `enumerateForTarget` 的结果调用 `seriesDistribution`；新增 teams 合并循环；改两处 `text(…, max)` 的上限。
- [ ] **Step 4: 运行**，预期通过。
- [ ] **Step 5: 提交** `feat(worlds): finalize recomputes scorelines and merges team reasons`

### Task 8: 提示词 V2

**Files:**
- Modify: `prompts/leagues-worlds.md`、`prompts/README.md:36`

- [ ] **Step 1**：标题改为 V2；System Prompt 增加 `teams` 输出 schema 与规则（每项 ≤ 40 词 / ≤ 60 字，只引用 payload `teams[]` 的数字和 stats，不重新挑人）；champion 和 mvp 的理由改为 ≤ 80 词 / ≤ 160 字，并要求点出 implied 赔率与 market 的差距；Run Payload 示例加上 `teams` 和 `oddsImplied`；中文对照要点同步更新。README 索引行改成「V2：有界修正 + 解释 + 队伍极值理由」。
- [ ] **Step 2**：运行 `npm run site:check` 和 `npm test -- tests/finalizeWorldsCandidate.test.js`，预期通过（finalize 的键名与 prompt 一致）。
- [ ] **Step 3: 提交** `docs(prompts): leagues-worlds V2 (team extremes, longer odds reasons)`

### Task 9: 模型名 `Fable 5.1 Max`

**Files:**
- Modify: `src/lib/provenanceBadge.js`（注释和 `parts` 首项）、`tests/provenanceBadge.test.js:56,62`

- [ ] **Step 1**：把测试里的期望改成 `'Fable 5.1 Max · no data yet · v1 · NOT ADVICE'` 和中文版，运行后预期失败。
- [ ] **Step 2**：修改常量后运行，预期通过。
- [ ] **Step 3: 提交** `fix(worlds): model label reads Fable 5.1 Max`

### Task 10: MVP 官方照片资产与清单

**Files:**
- Create: `src/lib/worldsPlayerPhotos.js`、`public/assets/worlds/players/*.webp`、`tests/worldsPlayerPhotos.test.js`
- 一次性抓取脚本放在 scratchpad，不进仓库。

**Interfaces:**
- Produces: `playerSlug(name) → string`（转小写，去掉非 `[a-z0-9]` 字符）；`PLAYER_PHOTOS: {[slug]: {file, sourceUrl}}`；`photoFor(name) → {src, sourceUrl}|null`（`src` 形如 `/assets/worlds/players/<slug>.webp`）。

- [ ] **Step 1: 写失败测试**：
  - `playerSlug("Kiin")==='kiin'`、`playerSlug("Hope ")==='hope'`、`playerSlug("Dr. X")==='drx'`。
  - `PLAYER_PHOTOS` 每一项的文件都存在于 `public/assets/worlds/players/`，且不超过 8192 字节；`sourceUrl` 以 `https://` 开头。
  - `photoFor('nobody')===null`。
- [ ] **Step 2: 运行**，预期失败。
- [ ] **Step 3: 抓取**：选手名单来自 `public/worlds-data.json` 里 `series[].result.games[].players`，加上 `mvp[].player`，去重。照片优先从 lolesports 官方选手页取，其次是 Leaguepedia 的 `Special:FilePath/<Team>_<Player>_2026_*.png`，每次请求间隔 ≥ 1 s，遇到限流就停。下载文件放进 scratchpad 里一个新的空目录。用 `sips` 或 `cwebp` 转成 96×96、质量 70 的 webp。拿不到照片的选手不写进清单，并在 PR 描述里列出来。
- [ ] **Step 4: 实现** `worldsPlayerPhotos.js`（数据表加三个函数），运行测试，预期通过。
- [ ] **Step 5: 提交** `feat(worlds): self-hosted official player photos with source manifest`

### Task 11: 主题、字体、队徽底盘、Clawd、页脚（条目 3、4、5、6、11）

**Files:**
- Modify: `public/styles/worlds.css`（`.worlds-body` token、材质、`.plate`、按新色板改各组件颜色）、`src/pages/worlds.js`（`FABLE_ICON`→`CLAWD_ICON`；`loadDisplayFont` 改为加载 `Cinzel:wght@500;700`、`Fira+Sans:wght@400;600`、`Noto+Serif+SC:wght@600`，带 `display=optional`；`logo()` 外包 `<span class="plate">`；删除 `renderSources` 及其调用；`buildProvenanceBadge` 不再传 `sourceCount`）、`worlds.html`（删掉 Sources 的 `<p>` 和 `<ul>`；页脚加三条双语声明；`theme-color` 改为 `#0b0b0d`）、`src/config/siteManifest.js`（worlds 的 `themeColor`）

**Interfaces:**
- Produces: CSS 类 `.plate`（所有队徽的外层）、`.stitch`（虚线车线）、`.zip`（拉链分隔线）、`.woven`（织标标题）、`.sticker`（歪贴徽章），供 Task 12–14 使用。

- [ ] **Step 1**：按 Global Constraints 改 token 和组件颜色；`.plate{display:inline-grid;place-items:center;background:var(--plate);border-radius:8px;padding:3px}`；材质类按规格 §2 实现。
- [ ] **Step 2**：Clawd SVG 用 14×12 网格：身体 `rect x2 y1 w10 h7`、两臂 `x0/x12 y4 2×2`、眼睛 `x4/x9 y3 1×2` 填 `#0b0b0d`、四条腿 `x3,5,8,10 y8 1×3`；全部填 `#D77757`，加 `shape-rendering="crispEdges"`。
- [ ] **Step 3**：页脚双语文案用规格 §7 原文。Claude/Clawd 的中文句子为「Claude 与 Clawd 是 Anthropic 的商标与形象；本站与 Anthropic 无隶属关系。」，英文为「Claude and Clawd are trademarks and characters of Anthropic. This site is not affiliated with Anthropic.」
- [ ] **Step 4**：运行 `npm run build`、`node scripts/check-no-new-important.mjs`、`npm run site:check`，预期都通过（lint:i18n 要求所有 `data-en` 都有对应的 `data-zh`）。
- [ ] **Step 5: 提交** `feat(worlds): Know My Name workwear theme, Clawd, logo plates, drop sources block`

### Task 12: 方案 A 版式（侧栏、标签、面板）

**Files:**
- Modify: `worlds.html`（结构改为 `.w-shell` > `aside.w-side`（`nav[role=tablist]` + `.w-mini`）+ `.w-main`（hero、`.w-tabs[role=tablist]` 仅手机显示、五个 `section.w-panel[role=tabpanel]`））、`public/styles/worlds.css`、`src/pages/worlds.js`

**Interfaces:**
- Produces: `setPanel(id)`（`'cards'|'odds'|'mvp'|'swiss'|'meta'`，同步 `hidden`、`aria-selected` 和 `location.hash`）；`renderMini()`（下一场倒计时、你/Fable 命中、夺冠前三及 implied 赔率），每秒由 `tick()` 调用一次。
- 面板与原区块对应：cards ← `#scrub`、`#cards`、`#record`；odds ← `#champion`；mvp ← `#mvp`；swiss ← `#swiss`；meta ← `#meta`。

- [ ] **Step 1**：改 HTML 和 CSS。1024 px 及以上：`grid-template-columns:220px minmax(0,1fr)`，`.w-side{position:sticky;top:calc(var(--af-header-height,68px) + 16px)}`，`.w-tabs` 隐藏。1024 px 以下：侧栏只保留 `.w-mini`，显示为一行横向条；`.w-tabs` 设为 `position:sticky; overflow-x:auto`。所有容器都要预留 `min-height`。
- [ ] **Step 2**：JS 部分：点击标签调用 `setPanel`；左右方向键在标签之间移动；加载时读 `location.hash`；监听 `hashchange`。
- [ ] **Step 3**：运行 `npm run build`，再用内置浏览器在 1440 和 390 宽看：面板能切换、hash 能恢复、没有横向溢出。
- [ ] **Step 4: 提交** `feat(worlds): sidebar + tabbed panels layout (option A)`

### Task 13: 转盘渲染与抽卡流程（条目 1、2）

**Files:**
- Modify: `src/pages/worlds.js`（在 `renderCardsView` 的 `detail` 密度分支里，用转盘替换现在的 `.deck`，并新增 `#drawn` 详情区）、`public/styles/worlds.css`

**Interfaces:**
- Consumes: Task 1 全部接口；Task 3 的 `chooseAndReveal`、`needsAutoReveal`；已有的 `cardHTML`、`frontHTML`、`flipCard`、`burst`
- Produces: `#carousel`（`--rot` 或 `--x` 变量、`data-n`）、`#drawn`（固定最小高度的详情区），以及 `drawCard(seriesId)`、`returnCard()`。

- [ ] **Step 1**：渲染。N ≥ 4 时，每张卡的样式为 `transform: rotateY(calc(var(--i)*360deg/var(--n) - var(--rot)*360deg/var(--n))) translateZ(var(--r))`，`--r` 按卡宽和 N 计算；N ≤ 3 时用 `translateX((i−x)·cardW·0.9)` 加 `rotateY((i−x)·-12deg)`。迷你卡只显示两侧队徽底盘、Bo 贴纸和倒计时。N = 0 显示原来的空态。
- [ ] **Step 2**：输入：
  - pointer 事件，前 10 px 判定方向：横向时调用 `drag`，纵向时放行给页面滚动。
  - wheel 事件（悬停时生效）：`preventDefault`，按 delta 累计调用 `drag`，停顿 120 ms 后按最近速度调用 `release`。
  - 键盘：左右方向键调用 `goTo(±1)`，Enter 调用 `drawCard`。
  - 一个 rAF 循环调用 `step`，idle 后停止循环。
- [ ] **Step 3**：抽卡。点击正中那张卡（或按 Enter）调用 `drawCard`，在 `#drawn` 渲染 `cardHTML`。选边按钮改为调用 `chooseAndReveal`，再执行与 `flipCard` 相同的翻牌动画和粒子效果；`needsAutoReveal` 为 true 的老记录在抽出时自动 `reveal`。点击空白处调用 `returnCard`。`tick()` 继续负责「开赛即锁定」，被锁定的卡如果正处于抽出状态，要重新渲染。「开整包」只翻当前赛段里 `ready` 状态的卡。
- [ ] **Step 4**：用内置浏览器在 1440、390、320 宽实测：拖动、甩动、滚轮、方向键、回弹；选边后自动翻牌；R3 有 8 张卡（闭环）；滑轨拖到 SF 或 F 时卡数 ≤ 3（弧形）；开启 reduced-motion 时直接吸附。
- [ ] **Step 5: 提交** `feat(worlds): 3D card carousel with inertia, draw and auto-flip`

### Task 14: 卡面新细节、夺冠/MVP 赔率与照片、Meta 头像（条目 8、9、12、13）

**Files:**
- Modify: `src/pages/worlds.js`（`frontHTML`、`renderChampion`、`renderMvp`、`renderMeta`）、`public/styles/worlds.css`

**Interfaces:**
- Consumes: 数据字段 `pick.scores`、`pick.pDecider`、`teams[]`、`oddsImplied`、`meta[].key`、`ddragon`；Task 5 的 `championKey`（从 `src/lib/worldsChampionKey.js` 导入）；Task 10 的 `photoFor`
- Produces: 只有页面渲染。

- [ ] **Step 1**：`frontHTML` 加三块：
  - 胜 / 打满 / 负三格（Bo1 只有两格），数值保留整数百分比。
  - 比分条：按 `scores` 的键排序（主胜比分在前、按比分差从大到小），每段宽度等于概率，段内标签写比分，主胜段用 `--wash`、客胜段用 `--td-mag`。
  - 双方队伍极值：`<details>` 里写「最强/最弱选手 · 最强/最弱战术点 + 理由」，summary 只放一句。
  - 缺哪个字段就不渲染哪一块。
- [ ] **Step 2**：夺冠和 MVP 行显示 `pct1(prob) · {oddsImplied.toFixed(2)}× implied`。MVP 行前加 48 px 圆形照片：`photoFor(player)` 有结果时用 `<img width=48 height=48 loading=lazy>`，`onerror` 时换成占位；没有照片时直接显示占位（队徽底盘加首字母）。
- [ ] **Step 3**：Meta 表第一列加 32 px 头像框，图片地址为 `https://ddragon.leagueoflegends.com/cdn/${data.ddragon||'16.21.1'}/img/champion/${m.key||championKey(m.champ)}.png`，失败时换成首字母方块。
- [ ] **Step 4**：用内置浏览器验证。两种数据各看一遍：现有的旧形状数据（新块应当隐藏），以及用 `node scripts/build-worlds-candidate.mjs --output=<scratch>` 跑出的真实候选（暂时复制到 `public/worlds-data.json` 只做本地预览，**不提交**）。
- [ ] **Step 5: 提交** `feat(worlds): scoreline/decider, team extremes, implied odds, player photos, meta avatars`

### Task 15: CSP report-only

**Files:**
- Modify: `vercel.json:771`（report-only 的 `img-src` 追加 `https://ddragon.leagueoflegends.com https://gol.gg`）

- [ ] **Step 1**：修改后运行 `npm run site:check`，预期通过。如果有测试断言了 CSP 字符串，同步更新它。
- [ ] **Step 2: 提交** `chore(csp): allow Riot Data Dragon and gol.gg images in report-only policy`

### Task 16: 门禁、端到端测试与 Lighthouse

**Files:**
- Create: `e2e/worlds-cards.spec.js`

- [ ] **Step 1: 写测试**：
  - 打开 `/en/worlds.html`，`#carousel` 可见。
  - 点击正中那张卡，`#drawn article.card` 出现。
  - 点击 `.side[data-side="home"]`，卡片在 1 s 内带上 `.flipped`，且 `data-state` 为 `revealed`。
  - 页面没有 Sources 区块（`#sources` 数量为 0）。
  - 切换到 Odds 标签后 hash 变成 `#odds`。
  - 390 宽时 `document.documentElement.scrollWidth <= 390`。
  - 用 `site-fixture.js` 现有的方式，在 kickoff 之前固定时间。
- [ ] **Step 2: 运行全部门禁**：`npm test`、`npm run typecheck`、`npm run data:check`、`npm run site:check`、`npm run build`、`node scripts/check-no-new-important.mjs`、`npx playwright test`（三个项目）、`LIGHTHOUSE_ROUTE_IDS=worlds node scripts/run-lighthouse.mjs`。预期全部通过，且 CLS ≤ 0.1、LCP ≤ 2500 ms、TBT 在预算内。有失败就先修再重跑，不改 baseline。
- [ ] **Step 3**：用内置浏览器在 1440、390、320 宽做最终实测（Task 13 Step 4 的全部项目，加上中英切换和深色队徽），截图作为证据。
- [ ] **Step 4: 提交** `test(e2e): worlds carousel draw and auto-flip`

### Task 17: PR 与合并后同步

- [ ] **Step 1**：`git push -u origin claude/worlds-r2-polish`；用 `gh pr create` 开 PR，描述里逐条写明 13 条要求的落实情况、许可与版权结论、拿不到照片的选手；然后用 `get_status` 或 `bind_pr` 关联 PR，等 CI 全绿。
- [ ] **Step 2**：向站主汇报，并建议合并时机：避开墨尔本 19:30–21:00，最好在定时任务跑完、数据推送之后。合并前必须等站主明确同意。
- [ ] **Step 3**：合并之后，用 `mcp__scheduled-tasks__update_scheduled_task` 修改 `worlds-2026-daily`：第 6 步加上 `teams` 理由和更长的 champion/mvp 理由，并改为按 `prompts/leagues-worlds.md` V2 执行；汇报项增加「队伍极值理由条数」。
