# Project Afflatus — Technical Guide / 技术细节与提交教程

> 架构、数据/接口、日常更新，以及手把手的 git 提交教程。
> 设计与路线图见 **ROADMAP.md**。

---

## 1. 架构 / Architecture

- **构建**：Vite（vanilla 多页）。`index.html` 是首页（Three.js 应用，代码在 `src/`）。
- **静态页**：`public/*.html`（arena / sectors / signal / games）由 Vite **原样拷贝**到 `dist/`，各自自包含 `<style>` 与脚本。
- **共享脚本**（放 `public/`，各页 `<script src>` 引入）：
  - `page-turn.js` — 键盘左右 / 箭头翻页；自托管字体在 `page-turn.css`。
  - `transition.js` — 进出页动画 + Web Audio 音效；按目标页选类型。
  - `i18n.js` — 中英切换；翻译所有 `data-en` / `data-zh`；派发 `afflatus-lang` 事件。
  - `arena.js` / `games.js` — 各自页面逻辑；`arena-bg.js`、`signal-scene.js` 背景。
- **数据**：`public/arena-news.json`（每日定时任务生成）、`public/games-data.json`（手动更新）。

### 首页渲染分层 / Home render layers
- `#starfield`（背景星空，fixed z0）→ `#blackhole-gl`（黑洞 WebGL，z1）→ `#event-layer`（2D 战斗/彗星，z2）。
- `.stardrive` 段（年化收益）自带一块 `#alphardForge` canvas，以顶/底渐隐 + `--bg` 调色融入页面背景；滚动进度写入 CSS 变量 `--forge`，驱动星体放大、台词逐字、数字点亮。
- **战斗渲染迁移中**：combat view（`#pilotFeed`）目前是 `main.js` 内嵌 Canvas-2D；正迁往 `topdownCombat.js` 的 2.5D 上帝视角 WebGL（分阶段，见 ROADMAP §4）。预览：`feida.au/?combat=topdown`。

### 文件清单 / File map
```
index.html              首页（Three.js）
src/main.js (3.7k 行)    首页主程序（HUD/场景/光标/导航装配）
src/scene/ src/ui/ ...   首页场景与 UI 模块
src/scene/alphardForge.js  年化收益 · Alphard 跃迁点滚动镜头（SC "Forge" 式星涡 + 逐字台词）
src/scene/topdownCombat.js 2.5D 上帝视角 WebGL 战斗场景（Phase 1；?combat=topdown 预览）
public/arena.html .js    交易竞技场（Finnhub 实时 + Twelve Data 历史 + Opus 预测）
public/sectors.html      AI/航天个股研判（静态 + 动效）
public/signal.html       美联储 = SCP O5 收容档案（FOMC + Opus 板块研判）
public/games.html .js    世界杯竞猜 vs Opus
public/games-data.json   赛程/夺冠/最佳球员/对阵结果（手动更新）
public/arena-news.json   每日盘前简报 + Opus 个股预测（定时任务写入）
public/page-turn.css/js  共享导航
public/transition.js     共享转场
public/i18n.js           共享中英切换
ROADMAP.md TECHNICAL.md  仅有的两份文档
```

---

## 2. 数据与接口 / Data & APIs

- **Finnhub**（实时报价，免费档 ~60/min）：key 在 `public/arena.js` 顶部 `CONFIG.finnhubKey`。自适应轮询（开盘前后快、休市慢）。
- **Twelve Data**（历史 K 线 W/M/6M/Y/5Y，免费 8/min·800/day）：key 在 `arena.js` `CONFIG.twelveKey`；按需取、按天缓存到 localStorage。`D` 为实时日内。
- ⚠️ 两个 key 都写在前端，部署后浏览器可见。个人用可接受；若要隐藏，加一个 Serverless 代理转发，把 key 留服务端（见 ROADMAP）。
- **定时任务**：每个工作日美东开盘前约 1 小时（墨尔本约 22:30）跑一次，搜索当日 AI 相关新闻 + 我的个股预测，写入 `public/arena-news.json`（中英双语 + `aiPredictions`）。

### 导航闭环 / Nav cycle
`Home → Arena → Sectors → Signal → Games → Home`
每页 `<body data-prev=... data-next=...>` + 顶部 `.nav` 链接 + 翻页箭头三处保持一致（加新页时四个页面都要同步——见 ROADMAP 的"统一导航"计划）。

---

## 3. 日常更新 / Updating content

- **每日盘前简报 + 个股预测**：由定时任务自动写 `arena-news.json`（也可手动编辑）。结构：`items[]`（`title_en/zh`、`summary_en/zh`、`category`、`source`、`url`）+ `aiPredictions{符号:{direction,confidence,rationale_en/zh}}`。
- **世界杯**：编辑 `public/games-data.json`。
  - 补赛果：把对应 fixture 的 `"result": null` 改成 `"home"|"draw"|"away"`，计分板自动结算。
  - 淘汰赛对阵确定后：把 TBD fixture 的 `home/away/homeFlag/awayFlag/opus/conf/reason_*` 填好。
  - 更新 `champions` / `players` 概率与 `updated` 日期。
- **Signal/FOMC**：会议日期在 `signal.html` 内 `FOMC[]` 数组；研判文案直接改对应 `data-en/data-zh`。
- 改完务必本地 `npm run dev` 自查，再提交。

---

## 4. 本地预览 & 构建 / Dev & build
```bash
cd ~/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in
npm install        # 仅首次
npm run dev        # http://127.0.0.1:5173  （逐页检查）
npm run build      # 产出 dist/（public/ 原样拷贝进去）
npm run preview    # 预览打包结果
```

---

## 5. 手把手 git 提交与推送 / Step-by-step commit & push

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

*This file + ROADMAP.md are the only two markdown docs in the repo, by design.*
