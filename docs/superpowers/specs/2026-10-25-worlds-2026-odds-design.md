# Worlds 2026 赔率页 + 每日赛前任务 · 设计规格

日期：2026-10-25 · 状态：待站主确认 · 对应旧稿：MSI 2026 `league.html`（git `70aec53f~1`）、`prompts/leagues-msi.md`、Cowork 任务 `leagues-msi-daily`

## 1. 目标与成功标准

- 一个新的公开页面 `/worlds.html`，复用 MSI 页的海克斯金蓝视觉与交互（概率条、刮卡比分、Fable 战绩板），改为 Worlds 2026 赛制：瑞士轮（16 队，五轮，3 胜晋级 / 3 负出局）+ 八强单败 Bo5。
- 一个每日一次的 Claude Code 本地 scheduled task（不是 Cowork），在北美开赛前跑完并发布：每场未开系列赛的胜率与隐含赔率、夺冠概率、决赛 MVP 概率、Fearless 英雄池深度；赛后自动对上一轮研判计分。
- 数字由代码算，模型只做有界修正与解释（prompts/README 五条硬规则）。每条预测在开赛前封存（git 提交时间为见证），开赛后不得补写。
- 成功标准：`npm test` / `npm run data:check` / `site:check` / `build` 全绿；本地 `run_scheduled_task` 手动跑一次能产出候选、通过 `data:publish worlds-daily` 并由 `push-data.sh` 验证远端 SHA；页面在 320–1440 px 零横向溢出，中英文切换完整。

## 2. 事实基线（2026-10-25 核实）

- 赛期 10-15 ~ 11-14。Play-In 已结束（KC 晋级；C9 / FURIA / MVK 出局）。瑞士轮 10-23 ~ 10-31 于 Allen, TX；1/4 决赛 11-03 ~ 11-06；半决赛 11-07 ~ 11-08；决赛 11-14 Brooklyn。
- 版本 26.20（gol.gg 标为 16.20，同一版本）。全程 Fearless Draft，但只对 Bo3/Bo5 生效（同系列赛内双方用过的英雄后续局双方皆不可选；跨系列赛重置）。瑞士轮第 1、2 轮与第 3 轮 1-1 场为 Bo1，晋级/淘汰场为 Bo3。
- 开赛时间（CT）：瑞士轮 R1–R3 12:00、R4 15:00、R5 12:00；八强 16:00–17:00（两源不一致，任务以 Polymarket `gameStartTime` 为准）。最晚结束约 22:00 CT。11-01 美国退出夏令时，CT 从 UTC−5 变为 UTC−6。

## 3. 定时任务：形态、时间、运行位置

**形态**：Claude Code 桌面端 scheduled task（`~/.claude/scheduled-tasks/worlds-2026-daily/SKILL.md`），App 打开时按本地 cron 运行，错过则下次启动补跑。不选云端 routine：云沙盒的出网白名单与直接推送 `main` 的权限都未验证，而本地任务可以沿用仓库现有的 automation clone、`data:publish` 原子事务和 `push-data.sh` 远端验证。

**时间**：每日 20:00 Australia/Melbourne（`0 20 * * *`）= 09:00 UTC = 04:00 CDT（11-01 后 03:00 CST）。推导：前一比赛日最晚约 22:00 CT 结束（13:00–14:00 AEDT），当日首场最早 12:00 CT（04:00–05:00 AEDT 次日）。20:00 AEDT 距上一赛果 ≥6 小时（gol.gg、Polymarket 已结算），距下一场开赛 ≥8 小时（赛前封存有余量），且是站主 Mac 最可能开着的时段。

**运行位置**：`/Users/feida/Developer/afflatus-automation`（已存在，main 跟踪 origin/main，干净，node_modules 就位，当前落后 398 个提交，任务起步 fast-forward）。任务 prompt 全部命令显式 `cd` 到该目录；绝不碰开发 checkout。

**窄门禁**：脚本层 `node scripts/check-worlds-window.mjs`：读取候选里所有未开系列赛的 `kickoff`，若 `now ≥ 最早 kickoff` 则这些系列赛本轮不得写预测（标 `missed:true`，与 Arena「错过窗口只能写 missed」一致）。赛事结束（11-15 起）或无新信息时无提交。11-14 决赛结束后任务把 `mode` 置为 `archive`，并调用 `update_scheduled_task enabled:false` 自我停用。

## 4. 每日抓取清单（均已实测可匿名访问）

| # | 来源 | 抓什么 | 方式 | 用途 |
| --- | --- | --- | --- | --- |
| 1 | gol.gg `tournament/tournament-matchlist/Worlds 2026 Main Event/` | 每场对阵、比分、轮次（ROUND1…）、版本、日期；服务器端渲染表格 | curl + 解析 `<tr>` | 赛果结算、瑞士轮战绩、系列赛列表 |
| 2 | gol.gg `game/stats/{id}/page-game/`（从 #1 行内链接取 id） | 每局 picks/bans、胜方 | curl，只抓上次运行后新增的局 | 每队本届已用独特英雄（池深）、同系列赛内已消耗英雄 |
| 3 | gol.gg `champion/list/season-S16/split-ALL/tournament-Worlds 2026 Main Event/` | 英雄 picks/bans/presence/winrate | curl | 26.20 实战 meta（展示 + 作为模型 payload 事实） |
| 4 | gol.gg `teams/team-stats/{id}/…`（每队一页，仅每周或名单变动时抓） | 选手季赛英雄池 | curl | 池深先验（赛季维度） |
| 5 | Polymarket Gamma `events?tag_slug=league-of-legends&active=true&closed=false` → `lol-*-2026-1x-xx` | 系列赛 Winner 价格、Game 1 价格、`gameStartTime`（UTC 精确开赛时间）、liquidity | curl JSON | 市场隐含胜率（展示为「market」）、模型基线、开赛时间与窄门禁 |
| 6 | Polymarket `events?slug=worlds-2026-winner` / `worlds-2026-finals-mvp` | 夺冠、决赛 MVP 价格 | curl JSON | 市场对照；MVP 市场目前仍是 Player A–J 占位，命名后才启用 |
| 7 | Kalshi `trade-api/v2/markets?event_ticker=KXLOL-WORLDS26` | 各队夺冠 yes bid/ask | curl JSON | 第二市场源（与 #6 取均值；单边缺失则用另一边） |
| 8 | 新闻（WebSearch）：Sheep Esports、Dot Esports、lolesports 官方 | 当日复盘、系列赛 MVP、名单/替补、版本评论 | 每条截断 ≤40 词，≤8 条 | 仅供模型写解释与有界修正；不进数字 |

弃用/备选：Leaguepedia Cargo API 对本机限流（两次 `ratelimited`），只作 WebSearch 备选；Liquipedia 403；Riot 官方 API 需带 key 的请求头，自动模式分类器会拒绝，不用；Oracle's Elixir 2026 CSV 位于 Google Drive 目录（匿名列目录不稳定），列为二期可选。

## 5. 计算方法（`src/lib/worldsModel.js`，纯函数 + vitest）

1. **单局胜率 p_game(A,B)**
   - Elo：按地区种子给先验（LCK/LPL 1 号种 1750，2 号 1700，3/4 号 1650；LEC/LCS/LCP 1 号 1600，其余 1550；CBLOL 1500），用 Play-In + 瑞士轮每局结果更新（K=40）。
   - 市场：Polymarket 系列赛价格 → 反推单局 p（Bo1 直接用；Bo3/Bo5 用二项反函数），liquidity < 5k USD 视为无市场。
   - 融合：有市场时 `p = 0.6·p_market + 0.4·p_elo`，否则 `p = p_elo`。
2. **Fearless 修正（仅 Bo3/Bo5 的第 2 局起）**：`depth_t` = 本届独特英雄数（#2）+ 0.5 × 季赛独特英雄数上限 40（#4）；`Δ = clamp(0.01·(depth_A − depth_B), −0.05, +0.05)` 加到后续局 p 上。首局不修正。
3. **系列赛胜率**：Bo1 = p；Bo3/Bo5 按局序列枚举（首局 p，后续局 p+Δ），得 P(win) 与最可能比分及其概率。隐含赔率 = 1/P，2 位小数，标 `implied`。
4. **模型有界修正**：Claude 在 payload 事实（名单变动、首发替补、版本评论）基础上可对任一系列赛 P(win) 加 `adj ∈ [−0.05, +0.05]`，必须附 ≤40 字理由与来源 URL；脚本校验范围，超界丢弃并记 notes。
5. **夺冠概率**：10,000 次有种子 Monte Carlo。瑞士轮剩余轮次按同战绩随机配对且不重赛；八强抽签规则：两支 3-0 对两支 3-2，其余四队随机；单败 Bo5。输出归一到 100，并列市场均值（#6/#7）作对照列。
6. **决赛 MVP 概率**：`P(player) = P(team 夺冠) × w(player | team)`；`w` 由 gol.gg 选手数据（KDA、DPM、击杀参与、系列赛 MVP 次数）在队内归一，位置先验 mid 0.30 / adc 0.25 / jng 0.20 / top 0.15 / sup 0.10。取前 6 名归一到 100；MVP 市场命名后以 0.5 权重融合。
7. **计分**：每场 `hit`（胜方正确）、`exact`（比分全中，须先 hit）、Brier；`record` 聚合由脚本计算，沿用 `validateLeaguesData` 的漂移守卫思路。

## 6. 数据合同 `public/worlds-data.json`（新 validator `validateWorldsData.js`）

```
{ tournament, updated (YYYY-MM-DD, America/Chicago), version, mode: live|archive, patch,
  decidedAt (ISO UTC), note_en/zh, archiveSource,
  teamLogos { CODE: url },
  swiss: [{ team, w, l, status: active|advanced|eliminated }],
  series: [{ id, stage: swiss|qf|sf|final, round, bo, kickoff (ISO), home, away,
             pick: { side, pWin:[h,a], score, pScore, oddsImplied:[h,a], adj, decidedAt } | null,
             missed: bool, market: { pWin:[h,a], src, liquidity } | null,
             fearless: { consumed:[…], depth:[h,a] },
             result: { home, away, games:[{ picks:{home:[…],away:[…]}, winner }] } | null,
             reason_en/zh, factors_en/zh[3] }],
  champion: [{ team, prob, market, reason_en/zh }],
  mvp: [{ player, teamCode, prob, market, basis_en/zh }],
  fearless: [{ team, depth, champs:[{name,slug}], note_en/zh }],
  meta: [{ champ, picks, bans, presence, winrate }],
  record: { since, resolved, correctOutcome, exactScore, winRate, brier, log:[…≤12] },
  sources: [{ label, url, fetchedAt }] }
```

约束：`pWin` 成对归一；`champion[].prob` 和 `mvp[].prob` 各归一到 100±2；`pick.decidedAt < kickoff` 否则 validator 拒绝；`result` 存在的系列赛 `pick` 不可再改（脚本 diff 守卫）。

## 7. 管线与发布

- `src/config/dataPipelines.js` 新增 `worlds-daily`：`kind:'calendar-day'`, `timeZone:'America/Chicago'`, `activeUntil:'2026-11-15'`（过期后 freshness 视为 fresh，避免赛后永久告警；`dataFreshness.js` 加两行）；输出 `public/worlds-data.json`。新 profile `worlds-daily`。
- `scripts/build-worlds-candidate.mjs --output=<临时目录>`：抓取 #1–#7 → 结算赛果 → 计算 §5 → 写 `worlds-data.json`（解释字段留空）与 `worlds-run-payload.json`（给模型的全部事实）。
- 任务会话读 payload，按 `prompts/leagues-worlds.md` 写 `worlds-model-output.json`（修正 + 中英解释 + 三因素）。
- `scripts/finalize-worlds-candidate.mjs <临时目录>`：校验修正范围、合并解释、重算、`validateWorldsData`。
- `npm run data:publish -- worlds-daily <临时目录>` → `scripts/push-data.sh public/worlds-data.json "Worlds 2026 daily <date>"`。`publish-data-pipeline.mjs` 注册 `worlds` validator 与 pre-commit 窗口检查 `check-worlds-window.mjs`。
- 锁：沿用 `npm run data:lock` orchestrator lock；publisher lock 由 `data:publish` 自管。

## 8. 页面 `/worlds.html`（2026-10-25 22:55 按站主要求重新规划）

**视觉**：Worlds 2026 官方主视觉。底色曜石黑 `#05070c` / 极夜蓝 `#0a1424`，面板 `#0d1a2e`；勾线与高光用暗青 `#0fb9b1` → 极光蓝 `#3ec6ff` 的霓虹渐变；细节点缀金属银白 `#dfe7ee`（渐变 `#f4f7fa→#9fb0bf`）；正文冷白 `#e6edf3`，次要 `#7f94a8`（对最深底 ≥4.5:1）。字体：Rajdhani（展示/HUD）+ JetBrains Mono（数据）+ Noto Sans SC。霓虹只做点缀，不做正文色（design.md §2.1）。

**结构（滚动顺序）**

1. **Hero**：标题 WORLDS 2026 · THIS IS OUR MOMENT / 风起今朝；下一场开赛倒计时（观者本地时间）；版本 26.20 徽标；provenance 徽标；一行声明。
2. **赛段滑轨（主导航）**：八格 `R1 R2 R3 R4 R5 QF SF F`，复用 `src/lib/stageRange.js` 的区间数学与 `games.js` 的指针/捏合/滚轮/键盘接线（恢复 `pinchZoom.js` 的 `wheelScaleDelta`）。默认窗口 = 当前轮次（有未完赛的最早轮次）。密度：1 格 = 整张抽卡牌面；2–3 格 = 并排中卡（队徽、比分/胜率、翻开状态）；4+ 格 = 紧凑树状战绩（`ko-tree` 风格）。
   移动端手感：轨道高 56 px；把手视觉 24 px、命中区 44 px；拖动中 `transition:none` 跟手，松手按 `cubic-bezier(.32,.72,.28,1)` 吸附整格；轨道 `touch-action:none`，页面其余区域正常纵向滚动；牌面区水平滑动（≥48 px）平移窗口一格并与滑轨联动；两端拖越界有 6 px 橡皮筋回弹。桌面：滚轮/触控板捏合缩放窗口、方向键平移、Shift+方向键调右沿、Home/End。
3. **牌面区：抽卡（每场一张）**
   - 牌背：暗青霓虹边框 + 银白切角，待机极光流光（`prefers-reduced-motion` 下静止）。牌背上显示对阵双方队徽、Bo、开赛倒计时。
   - **先选**：牌背两侧各一个队徽按钮（≥44 px），用户先点自己的胜方；选定后该侧亮起银白边，牌面出现「翻牌」提示。未选不能翻（键盘：左右键选边、Enter 翻）。
   - **再翻**：点击/向上拨动 → 卡片抬起 8 px、`rotateY(180deg)` 3D 翻转 600 ms，正面显示 Fable 研判：胜方队徽、P(win) 双向、隐含赔率、最可能比分及概率、三条因素（≥1 条 Fearless）、Polymarket 市场价小字对照、以及「你 vs Fable」一致/分歧标记。
   - 稀有度随置信度：P(win) ≥ 0.75 银白全息（`conic-gradient` 流光）；0.60–0.75 极光蓝；< 0.60 暗青。翻开瞬间 12 个粒子（CSS，reduced-motion 关闭）。
   - 「开整包」按钮：当前窗口内所有已选边的卡依次翻开（间隔 120 ms）；未选边的卡跳过并抖动提示。
   - 赛后：卡正面变战绩卡——实际比分、Fable ✓/✗、你 ✓/✗；未选边且已开赛的卡锁定为「错过」，不能再选。
   - 本地记录 `localStorage['afflatus-worlds:picks:v1']` = `{ [seriesId]: { side:'home'|'away', pickedAt, revealed:true|false } }`。开赛后不接受新选边（以 `kickoff` 为准）。
4. **你的战绩 vs Fable**：两列小板——已判场次、命中数、命中率、连胜；Fable 列加比分全中与 Brier。数据来自本地记录 + `series[].result`。
5. **夺冠概率**：每队一条——Fable 概率条（霓虹渐变）、市场均值小字、Fearless 池 chips（gol.gg 英雄头像，可横向滚动）。
6. **决赛 MVP 候选**：前 6 名概率条，附一句依据。
7. **瑞士轮积分表**：按 W-L 分组（3-0 / 2-x / 1-x / 0-x），状态徽标 晋级 / 出局 / 进行中。
8. **26.20 实战 meta**：前 12 英雄 picks/bans/presence/winrate 小表。
9. **页脚**：仅供娱乐、非博彩建议；market 为预测市场公开价格非博彩商盘口；数据来源列表。

**实现文件**：`worlds.html`（新建，走 `site:generate` 注入 shared header）、`src/pages/worlds.js` + `worldsEntry.js`、`src/lib/worldsCards.js`（抽卡状态机，纯函数：选边/翻牌/锁定/战绩聚合，vitest）、`src/lib/worldsStages.js`（把 `series[]` 变成八格 stage 模型，纯函数）、`public/styles/worlds.css`。从历史恢复 `src/lib/trackRecord.js`、`provenanceBadge.js`、`leaguesPick.js`、`stageRange.js`、`pinchZoom.js`（只恢复，不改）。`siteManifest`：`id:'worlds'`, `status:'active'`, Lab 组, `themeColor:'#05070c'`，双语 metadata。`fetchJson` 注册 `worlds`（`networkFirst`，5 分钟）。

**不做**：实时比分；跨设备同步用户选边；旧刮卡；金色海克斯配色。

**上线节奏（站主已知悉）**：今晚（10-25）必须上线：滑轨、抽卡（先选再翻 + 本地战绩）、R3 预测数据首发、定时任务；积分表与 meta 表若来不及则 10-26 补。上线路径：本分支 PR → 合并 main → Vercel 部署；首个数据发布由任务在 automation clone 执行。

## 9. 测试

- `worldsCards.test.js`：选边→翻牌状态机、开赛后拒绝选边、错过锁定、本地战绩聚合；`worldsStages.test.js`：八格模型、默认窗口=当前轮次。
- `worldsModel.test.js`：Elo 更新、Bo3/Bo5 枚举（对称 p=0.5 → 0.5）、Fearless 修正上下限、Monte Carlo 同种子逐位一致且归一、MVP 归一、空输入优雅降级。
- `validateWorldsData.test.js`：归一、`decidedAt<kickoff`、record 漂移。
- `golggParse.test.js`：用本次抓到的真实 HTML 片段做夹具。
- `dataPipelines` 既有不变量测试覆盖新 pipeline；`site:check` 覆盖路由。

## 10. 不做的事

不做实时比分、不做跨设备同步的用户投票、不做真实博彩商赔率抓取（只用预测市场公开 API 并明示）、不做 Oracle's Elixir 接入（二期）。
