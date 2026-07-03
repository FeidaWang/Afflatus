# Project Afflatus — Technical Guide / 技术细节与提交教程

> 架构、数据/接口、日常更新，以及手把手的 git 提交教程。
> 设计与路线图见 **ROADMAP.md**。

---

## 1. 架构 / Architecture

- **构建**：Vite MPA 多入口。六个 HTML 入口（`index.html` 首页 + `arena.html`/`sectors.html`/`signal.html`/`games.html`/`novels.html`）全部在项目**根目录**，注册在 `vite.config.js` 的 `build.rollupOptions.input` 里，参与真正的压缩/哈希/公共 chunk 拆分（**不再是** `public/*.html` 原样拷贝的旧架构）。加新页（如未来的 `leagues.html`）只需把 HTML 放根目录、在 `vite.config.js` 加一行 input、在 `nav.js` 的 `SITE` 加一条。
- **JS 全部是 ES module**，按用途分三层目录：
  - `src/lib/` — 六页共享的基础库：`nav.js`（★ 唯一的 `SITE` 配置，见下）、`i18n.js`、`transition.js`、`page-turn.js`、`audio.js`、`clock.js`。
  - `src/pages/` — 各子页专属逻辑（`arena.js`/`arena-bg.js`/`games.js`）+ **每页一个入口文件**（`homeLibs.js`/`arenaEntry.js`/`sectorsLibs.js`/`signalLibs.js`/`gamesEntry.js`/`novelsLibs.js`），每个 HTML 只挂一个 `<script type="module" src="/src/pages/xxxEntry.js">`，入口文件内部用普通 `import` 按顺序声明该页真正依赖的库。
  - `src/scene/`、`src/ui/`、`src/data/` — 首页专属的 Three.js 场景 / Canvas HUD 绘制模块 / 静态文案数据（`content.js` 含首页 Top 10 持仓 `PICKS_ZH/EN`）。
  - `public/` 现在只放**真正静态**的资源：`page-turn.css`（5 个子页共享翻页箭头/字体/Labs 下拉样式）、各页数据 JSON、`assets/`、`favicon.svg`。
- **⚠️ 关键坑（加新共享脚本前必读）**：给同一页面挂多个独立的 `<script type="module" src="...">` 标签，Vite 8 的自动 chunk 合并/去重**不可靠**——构建不报错，但某个脚本的代码可能在某些页面的产物里静默消失。正确做法**永远是**每页一个显式 `import` 链的入口文件（上面 `xxxEntry.js`/`xxxLibs.js` 的由来），走 Rollup 常规 import 图打包路径。
- **导航与 Labs 下拉**：`src/lib/nav.js` 的 `SITE` 数组是唯一真源，渲染各页导航链接（`[data-afflatus-nav]` 占位）+ 循环推导 prev/next（写入 `body.dataset` 与翻页箭头 `href`）。给条目打 `group:'labs'` 会自动收进顶部 **Labs** 下拉菜单而不是顶层直链——目前 Games/Novels 是 labs 分组，未来季节性/实验性新页一律走这条路。下拉面板本身是 JS **portal 到 `<body>`**（`position:fixed` + 用 trigger 的 `getBoundingClientRect()` 定位，`z-index:99000`），不嵌套在触发按钮内——嵌套会被部分页面的 `clip-path`/低 `z-index` 祖先裁剪或遮挡。开关状态由 JS 的 `.open` class 驱动（hover/focus/click 开，Escape/outside-click/scroll/resize 关），而非纯 CSS `:hover`。下拉面板的字体/配色需要每页在 `page-turn.css`（5 个子页）或 `src/styles.css`（首页）里用 `--labs-*` CSS 变量按各自主题显式覆盖——面板不再是触发按钮的 DOM 后代，不会自动继承该页 `.nav a` 的样式。
- **战斗视图**：默认 HUD 是 HMD v3（`src/ui/combatHmdV3.js` 的 `drawCleanCombatHmd`，贯穿起飞/降落/巡航/战斗）；SC 风格全息面板（`src/scene/combatHudSC.js`）与俯视战场（`src/scene/topdownCombat.js`）都降级为可选皮肤，分别用 `?combatview=sc` / `?combatview=topdown` 访问。**v1.5b 规划**：主战斗视图要换成事件驱动的相机导演系统（见 ROADMAP §4 V14）——**注意命名冲突**：`src/scene/cameraDirector.js` 这个文件名**已经被占用**（现有内容是起飞/降落的外部运镜，`drawExternalLaunch`/`drawExternalLanding`），V14 要做的武器事件相机状态机需要另起文件名（如 `weaponCameraDirector.js`），不要直接覆盖现有文件。
- **数据**：`public/arena-news.json`（每日定时任务生成）、`public/games-data.json`（手动更新）、`public/signal-events.json`（宏观事件档案，见第 3 节）、`public/novels-data.json`（章节内容）。v1.5 规划新增但**尚未创建**：`arena-ledger.json`（Autopilot 账本）、`leagues-data.json`（MSI 竞猜）、`sectors-data.json`（对比矩阵 + 后内存专题）——详见 ROADMAP §7。

### 首页渲染分层 / Home render layers
- `#starfield`（背景星空，fixed z0，OffscreenCanvas + Worker 渲染，特性检测自动回退主线程）→ `#blackhole-gl`（黑洞 WebGL，z1）→ `#event-layer`（2D 战斗/彗星，z2）。
- `.stardrive` 段（年化收益）自带一块 `#alphardForge` canvas，以顶/底渐隐 + `--bg` 调色融入页面背景；滚动进度写入 CSS 变量 `--forge`，驱动星体放大、台词逐字、数字点亮。

### 文件清单 / File map
```
index.html arena.html sectors.html    六个 Vite 入口（根目录）
signal.html games.html novels.html
src/main.js (~3.4k 行)   首页主程序（HUD/场景/光标/导航装配，仍是拆分中的单体文件）
src/scene/               首页 + 战斗场景模块（alphardForge / topdownCombat / combatHudSC /
                         combatCine / cameraDirector[起降运镜] / fighter3D / shipHologram / …）
src/ui/                  HUD 绘制模块（combatHmdV3 / battleFeed / marketDeck / viz 等）
src/data/content.js      首页文案 + Top 10 持仓 PICKS_ZH/EN
src/lib/                 六页共享库：nav.js（★ SITE 唯一真源）/ i18n.js / transition.js /
                         page-turn.js / audio.js / clock.js
src/pages/               各页专属逻辑 + 每页一个入口文件（见上方架构说明）
public/page-turn.css     5 个子页共享：翻页箭头 + 自托管字体 + Labs 下拉结构样式
public/*-data.json       games-data.json / signal-events.json / novels-data.json / arena-news.json
scripts/push-arena-news.sh  cron 数据推送管线（写 JSON → stash/rebase/commit/push）
prompts/                 v1.5 定时任务提示词库（README + 5 模块文件）
ROADMAP.md TECHNICAL.md  仅有的两份文档
```

---

## 2. 数据与接口 / Data & APIs

- **Finnhub**（实时报价，免费档 ~60/min）：前端调 **`/api/quote?symbol=…`**（Vercel Serverless 代理 `api/quote.js`），key 在服务端 `FINNHUB_KEY`。自适应轮询。
- **Twelve Data**（历史 K 线 W/M/6M/Y/5Y，免费 8/min·800/day）：前端调 **`/api/history?symbol=…&interval=…&outputsize=…`**（代理 `api/history.js`），key 在服务端 `TWELVE_KEY`；按需取、按天缓存到 localStorage。`D` 为实时日内。
- ✅ **API key 已下沉到服务端**：`/api/*.js` 是 Vercel 根目录 Serverless 函数（与 Vite 静态构建并存，零配置自动部署），key 不再出现在前端包里。
  - **部署必做**：Vercel → Project → Settings → Environment Variables 添加 `FINNHUB_KEY` 与 `TWELVE_KEY`（值即原来的 key），重新部署。
  - **⚠️ 务必轮换旧 key**：旧 key 曾明文存在于前端与 git 历史，已泄露——去 Finnhub / Twelve Data 后台**重置生成新 key**，新 key 只填进 Vercel 环境变量。
  - 本地 `npm run dev`（纯 Vite）不跑 `/api`，实时行情会 404 并**自动降级到简报快照**（`arena-news.json` 的 `prices`），属预期；线上 Vercel 才有实时。
- **定时任务**：每个工作日美东开盘前约 1 小时（墨尔本约 22:30）跑一次，搜索当日 AI 相关新闻 + 我的个股预测，写入 `public/arena-news.json`（中英双语 + `aiPredictions`）。

### 导航闭环 / Nav cycle
`Home → Arena → Sectors → Signal → Games → Novels → Home`（Games/Novels 在顶部导航里收在 **Labs** 下拉，翻页顺序不受影响，仍按此顺序循环）。加新页只改 `src/lib/nav.js` 的 `SITE` 数组一处——prev/next、顶部链接/下拉分组会自动同步，不用像以前那样手改多个文件。未来 `leagues.html` 上线后会插在 games 与 novels 之间，同样打 `group:'labs'`。

---

## 3. 日常更新 / Updating content

- **每日盘前简报 + 个股预测**：由定时任务自动写 `arena-news.json`（也可手动编辑）。结构：`items[]`（`title_en/zh`、`summary_en/zh`、`category`、`source`、`url`）+ `aiPredictions{符号:{direction,confidence,rationale_en/zh}}`。字段名仍叫 `opus`/`opusScore`/`opusOrder` 等（内部命名未改），但**显示文案**已统一为「Fable 5」，改数据时不用管字段名，只管填对应文案字段。
- **世界杯**：编辑 `public/games-data.json`。
  - 补赛果：把对应 fixture 的 `"result": null` 改成 `"home"|"draw"|"away"`，计分板自动结算。
  - 淘汰赛对阵确定后：把 TBD fixture 的 `home/away/homeFlag/awayFlag/opus/conf/reason_*` 填好。
  - 更新 `champions` / `players` 概率与 `updated` 日期。
- **Signal**：数据源是 `public/signal-events.json`（**不是**旧版内嵌在 `signal.html` 里的 `FOMC[]` 数组，那个写法已淘汰）——新增/编辑事件档案直接在这个 JSON 里追加/修改一条记录，结构见文件内现有条目（`id`/`date`/`type`/`class`/`name`/`before`/… 四段式 + 中英对照）。
- **首页 Top 10 持仓**：`src/data/content.js` 的 `PICKS_ZH`/`PICKS_EN`，两个数组必须逐条一一对应（ticker 顺序、权重都要一致），权重合计应为 100。这是编译期数据，改完要走一次 build 才会生效，不是运行时读取。
- **Novels 章节**：`public/novels-data.json`。
- 改完务必本地 `npm run dev` 自查，再提交。

---

## 4. v1.5 数据管线与提示词库 / Data pipeline & prompts (v1.5)

> 完整模块规格见 **ROADMAP.md §7**；这里只记工程约定。

- **推送模式**：`scripts/push-arena-news.sh` 是现成的参考实现——cron 触发 → 写目标 JSON → `git add` 该文件 → 暂存其它未提交改动（`git stash --keep-index`）→ `git fetch` + `git rebase origin/main` → 提交并推送 → 恢复暂存。规划中的 `arena-ledger.json`/`leagues-data.json`/`sectors-data.json` 定时任务都应复用同一模式（V12 计划把脚本模板化成通用 `push-data.sh <file> <msg>`，目前还是各写各的独立脚本）。
- **所有数据 JSON 顶层统一带 `{updated, version}`**，前端据此显示"数据龄"徽标。
- **提示词库** `prompts/`：README 定五条硬规则（system/run 拆分吃 prompt caching、强制 JSON schema 输出、模型零会话记忆/状态外置、只认 payload 注入数据禁止凭训练记忆报事实、复盘限长）；`arena-autopilot.md`/`signal-warsh.md`/`sectors-watch.md`/`postmemory-top10.md`/`leagues-msi.md` 是五个模块各自的正式提示词文本（含 System Prompt 英文正本 + run payload 结构 + 中文对照）。新增任何定时任务前先读对应文件，不要另起炉灶。

---

## 5. 本地预览 & 构建 / Dev & build
```bash
cd ~/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in
npm install        # 仅首次
npm run dev        # http://127.0.0.1:5173  （逐页检查）
npm run build      # 产出 dist/（六个入口各自压缩打包，public/ 静态资源原样拷贝进去）
npm run preview    # 预览打包结果
```

---

## 6. 手把手 git 提交与推送 / Step-by-step commit & push

仓库：`github.com/FeidaWang/Afflatus`，分支 `main`。

**第一次（或忘了配置时）**
```bash
git config user.name  "FeidaWang"
git config user.email "你的邮箱"
```

**每次改完，三步走**
```bash
cd ~/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in
git status            # 看改了/删了哪些文件
git add -A            # 大写 A：把新增、修改、删除全部纳入
git commit -m "用一句话说明这次改了什么"
git push origin main
```
> 删除了文件时，一定用 `git add -A`，普通 `git add .` 不会记录"删除"。

**首次推送的登录**
- 用户名：`FeidaWang`
- 密码处粘贴 **Personal Access Token (PAT)**（不是登录密码）：
  GitHub → 右上头像 → Settings → Developer settings → Personal access tokens → 生成一个带 `repo` 权限的 token，复制粘贴即可（终端粘贴不显示字符是正常的）。
- macOS 钥匙串会记住，之后直接 `git push`。

**常见问题**
- `push` 被拒（远端有新提交）：先 `git pull --rebase origin main`，解决冲突后再 `git push`。
- 看最近提交：`git log --oneline -10`。
- 撤销未提交的改动（谨慎）：`git restore 文件名`；撤销暂存：`git restore --staged 文件名`。

**一键脚本（可选）**：可在仓库根目录建 `deploy.command`（双击即 build+commit+push），需要的话我可以帮你生成。

---

## 7. 部署 / Deploy（Vercel）

站点托管在 **Vercel**，监听 GitHub 仓库 `FeidaWang/Afflatus` 的 `main` 分支。

**日常部署 = 推代码即可**
```bash
cd ~/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in
git add -A && git commit -m "..." && git push origin main
```
推送后 Vercel 自动 `vite build`（输出 `dist/`）并部署；根目录 `api/*.js` 自动成为 Serverless 函数。状态见 vercel.com → 项目 → **Deployments**。

**环境变量（API 代理必需）**
- vercel.com → 项目 → **Settings → Environment Variables**，添加（Production/Preview/Development 全勾）：
  - `FINNHUB_KEY` = Finnhub key
  - `TWELVE_KEY` = Twelve Data key
- 改完环境变量必须 **Deployments → 最近一次 → ⋯ → Redeploy** 才生效。
- ⚠️ 旧 key 曾泄露（前端 + git 历史），务必在 Finnhub / Twelve Data 后台**重置新 key**，新 key 只填进 Vercel 环境变量。

**验证**
- 开 `https://feida.au/api/quote?symbol=NVDA` → 返回含 `"c"` 的 JSON 即代理 + 环境变量 OK；返回 `FINNHUB_KEY not configured` = 没配/没 redeploy。
- Arena 页股票卡显示 **LIVE**（而非全 SNAPSHOT）；F12 Network 看 `/api/quote`、`/api/history` 为 200。
- 本地 `npm run dev` 不跑 `/api`，实时会 404 并降级到简报快照（预期），以线上为准。

**首次接入（备忘）**：Vercel → Add New → Project → 选仓库 Import → 框架自动识别 Vite（Build `vite build`、Output `dist` 不改）→ 填环境变量 → Deploy → Settings → Domains 绑 `feida.au`。

---

*This file + ROADMAP.md are the only two markdown docs in the repo, by design.*
