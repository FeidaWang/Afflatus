# CLAUDE.md — Project Afflatus 工作守则

> **会话结束协议**：每次会话收尾时，复盘本次的错误与修正过程、高价值技术决策、用户偏好，
> 以「情境 → 指令 → 禁忌」格式增补本文件。宁缺毋滥：只收录会改变未来行为的条目，禁止空话套话。
> 文档分工：`roadmap.md`（待办 + 规格）/ `technical.md`（操作手册）/ 本文件（跨会话经验，机器优先）。
> 文件名保持大写 `CLAUDE.md`——这是工具链自动加载的约定名，不随 roadmap/technical 的小写惯例。

## 项目硬事实（省去每次重新推导）

- 站点 feida.au；Vercel 部署，监听 GitHub `FeidaWang/Afflatus` 的 `main`，从源码构建——本地 `dist/` 与部署无关且已 gitignore。
- 六个 Vite HTML 入口在项目根目录（index/arena/sectors/signal/games/novels），每页恰好一个 module 入口文件（`src/pages/*Entry.js`/`*Libs.js`）；`public/` 只放真静态资源与数据 JSON。
- `src/scene/cameraDirector.js` 已被起降运镜占用——roadmap V14 的武器相机模块必须另起文件名。
- 用户本机路径 `~/Documents/Codex/2026-05-26/<repo>`，文件夹可能改名为 `afflatus`；`scripts/` 内脚本的 `REPO` 变量硬编码该路径，改名必须同步。
- games-data.json 等内部字段名仍叫 `opus*`——这是刻意保留的内部命名，永远不要"顺手统一"。

## 构建与前端

- 新增共享脚本：只走「每页一个显式 import 链入口文件」，禁止同页多个独立 `<script type="module">`——Vite 8 会构建成功但让代码在部分页面产物里**静默消失**。构建后必须 grep `dist/` 抽查关键符号确实在产物里，绿色构建不等于正确产物。
- grep `dist/` 时**不要假设产物文件名对应源文件名**：多页共享的库（nav.js/i18n.js/transition.js/page-turn.js）会被 Rollup 合并进某个共享 chunk，chunk 命名取决于打包顺序、不固定跟着某个源文件走（实测合并进了 `transition-*.js`）。验证新页接入 nav 时，grep 内容特征（如 SITE 数组里的新路径字符串），不要按文件名找。
- `nav.js` 必须先于 `page-turn.js` 执行（后者在模块顶层同步读 `body.dataset.prev/next`）。
- 元素被祖先 `clip-path` 或低 z-index 层叠上下文困住时：portal 到 `<body>` + `position:fixed` + JS 定位；只调大 z-index 永远无效。**portal 的代价是样式继承链断裂**——必须逐页用 CSS 变量显式还原字体/配色/hover/active，否则退回浏览器默认样式（紫色下划线衬线体事故）。
- 全站文案改名：只改用户可见文案（HTML 文本、data-en/zh、模板字符串渲染内容），不动 JSON 字段/JS 属性/CSS class；每轮改完做大小写不敏感全库 re-grep——首轮必有遗漏，这是经验规律不是假设。
- 视觉/CSS 改动在沙盒无法真实渲染验证：交付时明确区分「逻辑已验证 / 视觉未验证，待你本地确认」，不要声称视觉正确。本项目已两次由用户截图发现沙盒不可见的视觉 bug。
- 已实测：沙盒装不了无头浏览器做视觉自证——`npm install puppeteer` 会因下载 Chromium 需要访问 `storage.googleapis.com`（不在网络白名单内）而失败，`EAI_AGAIN`。不要在类似任务上重新尝试这条路（省一轮无效等待），直接假设视觉验证只能交给用户本地做。对于纯几何/数值类模块（不碰 DOM/Canvas 的），改用「Node + mock `add()` 回调 + 真实 `THREE.Box3` 算包围盒」做比例断言（V15 `odinHull.js` 的做法）——这是重大 3D 视觉改动里唯一能在沙盒自证的部分，值得作为默认动作。
- 高视觉风险改动（替换现有生产可见的核心视觉资产，如整艘战舰几何）比 V14 那种「新增可选镜头」风险更高，闸门要更保守：默认路径必须字节级不变，新内容一律走查询参数 opt-in（如 `?ship=odin`），不要因为用户说了「continue」就直接转正——「continue」通常只是「继续做下一项」的授权，不等于「跳过风险闸门直接上生产默认路径」的授权，这两者要分开判断。

## Git 与沙盒环境

- 沙盒对 `.git` 锁文件 rm 会 EPERM：用 `mv` 挪走 `index.lock`/`HEAD.lock`；每次 git 写操作后可能再生成，**下一次 git 命令前先清锁**。
- 沙盒只 commit 不 push；收尾报告 `git log origin/main..HEAD --oneline` 的未推送清单并提醒用户本地 `git pull --rebase origin main && git push origin main`。注意：用户 cron 的简报推送成功时会连带推走全部本地提交——本地 main 上不要留半成品 commit 过夜。
- macOS 大小写不敏感文件系统：改文件名大小写必须 `git mv`，禁止 Finder 改名。
- `git add` 被 .gitignore 覆盖的路径是静默无效操作。数据推送脚本的正确序列是「commit 先行 → `git pull --rebase --autostash` → push」；禁用「stash --keep-index → rebase」（rebase 拒绝脏暂存区，永远失败）。
- `package-lock.json` 有两处 version 字段（顶层 + `packages[""]`），改版本号两处都要改。
- bash 挂载路径每轮会话都变（`/sessions/<随机名>/mnt/...`）：先探测再 cd；Read/Write/Edit 一律用 macOS 原生路径。

## 验证纪律

- 判断自动化管线是否健康，用**运行时证据**（日志尾部、`git log --grep`），不能只读代码——「从未生效但恰好没炸」类 bug（rebase 每天报错三年没人看）只有日志能暴露。
- 时效性事实（赛程、人事任命、行情、产品版本）一律先 WebSearch 核实再写入计划或文案，并在文档里落「检索核实于 <日期>」；排期决策（硬截止）必须建立在核实过的日期上。
- WebSearch 的自然语言摘要会在时间线含糊时**编造比分/结果**（实测发生过一次「BLG 3-0 胜 T1」的纯捏造，与结构化数据源矛盾）：凡是要写进数据 JSON 的赛果，优先信任结构化数据源（如 escorenews 的比赛页 JSON、gol.gg 的对局页）而不是搜索引擎的摘要转述，且至少交叉验证两个独立来源再落盘。
- 短生命周期、强依赖当天联网检索的定时任务（如赛事竞猜类），用 Cowork 自带的 scheduled-tasks 比现写本地 launchd + API 脚本更省事——但要向用户说明其触发条件是「App 处于打开状态」而非系统级唤醒，与 launchd 的可靠性模型不同，不要含糊带过。
- 逻辑改动在沙盒用 Node + 手写 mock DOM 重放真实代码路径验证（jsdom 装不上）；构建后 `vite preview` + curl 全入口 200 冒烟。
- 涉及账本/资金状态的代码必须带 vitest 单测才算完成——账本静默算错是本项目唯一不可原谅的 bug 类别。

## 设计与架构决策原则

- LLM 提案、确定性代码收单：风控红线、订单校验、概率归一等硬约束全部在代码层强制，提示词里写只是为了减少无效提案，**永远不依赖模型自觉**。
- 定时任务的模型调用零会话记忆：状态外置到数据 JSON（唯一事实源），固定 system prompt + 变动 run payload 拆分吃 prompt caching——上下文膨胀要靠架构消灭，不靠省着用。
- 双系统同步的正确解法是「只保留一个时钟」（权威事件时间线 + 双端相位渲染），不是对齐两套计时器。
- 用户否决某方案时，先拆分「被否决的部分」和「可复用的资产」再动手——俯视视角被否 ≠ topdownCombat 场景资产报废，这一区分省了一周级工作量。
- 排序铁律：时效硬截止 > 依赖顺序 > 价值密度。季节性内容（赛事页）晚一周上线等于白做，压倒一切排 P0。
- 新功能先克隆现有同类页面快速上线（leagues 克隆 games），抽象统一放进后续专项任务（V12）——先 ship 后重构是本项目的既定方法论。
- 评估类指标要诚实：样本不足时禁用年化（<30 交易日只看累计/回撤/胜率）；预测必须概率自洽（Σp=1）且公开记分含错时；收益必须带基准（SPY/SMH）。

## 用户偏好与协作方式

- 中文交流，回复精炼直接、少列表少加粗；站点内容中英成对（`data-en`/`data-zh`）。
- 用户要批判性评审而非附和：发现方案结构性问题直接改并给理由（伪高频→双窗口、年化口径、场景复用均被采纳）；有明确授权（"给出你的最优解"）时直接决策，标注可回退点，不反问。
- 大改动前用 AskUserQuestion 澄清真歧义（Labs 形态、改名范围曾问过且答案已沉淀进文档——已答过的不要再问）。
- 任务用编号驱动（"做 V0"）：roadmap 里的任务编号一旦发出就保持稳定，撤销用删除线注明去向，不重排。
- 美术红线：硬科幻/太空军事拟真（Star Citizen 系），严禁卡通/街机/过度游戏化；每页保留独立字体与配色身份，共享的只有基础系统。
- 金融/竞猜内容永远带「模拟盘 / 非投资建议 / 非博彩建议」标注；具体事实性内容（模型参数、赛果、财务数据）不进文档，运行时用注入数据核实。
- 文档洁癖：已完成项归档为 Release Notes 移出 roadmap，保持文档只含待办——这是用户主动要求的常设做法。
