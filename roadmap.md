# Project Afflatus — Design & Roadmap / 设计与路线图

> 全站设计建议、未来路线图，以及代码模块整理与优化方法。
> 技术细节与 git 操作教程见 **technical.md**。
> 本文档只保留仍需跟踪的未完成工作；已完成的历史记录已整理为 **`RELEASE_NOTES.md`**，不再保留在此文档中。

---

## 1. v1.5 优先级总表 / Priority roadmap ★

> **当前状态（2026-07-04）**：v1.4 全部收尾工作、v1.5b 视觉工程轨（V14/V15/V15b/V15c/V16）、v1.5 产品轨的 **V4/V6/V7 均已完成并归档**，以及站主直接指定的 **V13（Arena 美股技术分析仪表盘）已上线**，详见 `RELEASE_NOTES.md`。当前处于 **Afflatus v1.5「Fable 5 Max 五模块」** 产品轨执行期——源头是站主的系统架构规划报告，经评审优化后落地，完整五模块规格见 **§7**，定时任务提示词库见 `prompts/`。
>
> **⚠️ 2026-07-04 站内架构/UX 审计（站主要求设为最高优先级，正在动工）**：产品经理+架构师视角的一轮批判性复核，发现 5 项可在半天内解决的真实问题（不是猜测，逐条对照构建产物/API 代码/dist 抽查核实过）——**D1–D5，见下方新增 P0★ 分组，插到队列最前面**。核心结论：后端自动化纪律（状态外置/规则引擎/发布校验）比前端健康得多；前端最大问题是 `/api/quote` 无白名单+无限流的开放代理（访客可打任意 symbol，配额全站共享）、简报强制门禁挡在工具类页面前面、`INEFFECTIVE_DYNAMIC_IMPORT` 构建警告一直没处理、移动端触控目标普遍不足、i18n 首帧闪烁+无 sitemap 拖累中文 SEO。
>
> **排序依据**：D1–D5（用户明确指定最高优先级，正在做）> 依赖顺序 > 价值密度。此前驱动排序的两个硬截止已转入自动化监控期（MSI 2026 决赛 7/12——Leagues 已上线+定时任务自跑；世界杯决赛 7/19——V2 持续监控），FOMC 软截止 7/28-29 前 Signal（V6/V7）也已就绪——**除 D1-D5 外没有新的时效硬截止在驱动排序**。
>
> **NEXT UP · 建议执行队列（2026-07-05 五次重排——V18 插入 D 队列之后）**——标注工作量（S≈半天内 / M≈1–3 天 / L≈1 周级）：
> ⓪ **D2**（S，D 队列仅剩此项未完成）——简报强制门禁降级，见下方 P0★。
> ⓪′ **V18**（M-L，**用户点名下次执行**，2026-07-05）——战斗视图「立体化」：从 2D 分镜的平面感（combatCine 精灵战机）升级为 SC 参考图的电影级追击视角（低机位追尾 + 引擎尾焰彩带 + 深度参照层）。**技术路线已定稿，见 §4「V18 实施路线」**；P3 的 B8 整体并入本项关闭。
> ① **V2**（S·随赛程持续）——世界杯每轮完赛后补数据；纯监控，不占主力时间。
> ② **V5**（M）——**卡住，非排序问题**：`arena-autopilot-a-open` 尚未真正运行过一次（首次触发是本周二 AEST），账本要再攒够 ≥3 个交易日数据才有东西可画，物理上等不来就是不能动工。定期查一下账本 `day` 字段即可，不必天天惦记。**V13 上线后 V5 落地时多一件事要定**：旧 Human vs AI 对战区目前隐藏（见 B10），Autopilot 前端区块的具体落点要结合 V13 之后的去留决定一起看，不是各自独立的两块。
> ③ **V9 → V10 → V11**（M+M+S）——Sectors 模块：先建对比矩阵 + 后内存专题两个前端区块与初始数据（V9/V10），再上定时任务自动化（V11）——路径与 Arena 的 V3→V4 同构（先有能跑的产品，再自动化）。
> ④ **V12**（M，Sectors 落地后再做）——数据管线统一（`push-data.sh` 模板化、溯源徽章共享组件）：等 Sectors 数据管线跑起来，站上有两个模块的真实模式可供抽象，避免像 A2 那样过早封装。
> ⑤ **A2**（L，纯技术债，无截止压力，排最后）——main.js 继续拆分。
>
> **本轮复核结论**：V13 与 D1-D5 都是站主直接指定、跳过既定队列插入的任务（不是按依赖/价值密度排出来的），完成后**②③④⑤的标准队列本身没有变化**——两者都不解锁 V5（跟账本数据无关），也不影响 Sectors 的依赖关系。D3 吸收了原 P3 的 B5（IntersectionObserver），不再单独跟踪。
>
> 想接着做时直接说编号（如「做 V9」），或说「查一下 V5 账本」看数据是否已攒够。

**P0★ · 站内审计快赢（2026-07-04 指定，最高优先级，正在做）**
- ~~D1.（S）`/api/quote` 加白名单 + per-IP 限流~~ **已完成（2026-07-04）**——现状：`api/quote.js`/`api/history.js` 只用宽松 regex 校验 symbol 格式（`^[A-Za-z.\-]{1,12}$`），任意字符串都能打上游；免费档限流是**全站访客共享**的，开盘时段两个并发访客就可能互相打出 429。**原计划的固定 30 支白名单方案与 V13 已上线的「搜索任意美股代码」功能冲突**（会砍掉合法的任意 ticker 搜索），经用户确认后改为：不做硬白名单，只把 symbol regex 收紧到真实 ticker 形状（`^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$`，支持 `BRK.B`/`BRK-A` 这类后缀），并新增基于 IP（`x-forwarded-for`）的每容器滑动窗口限流（纯函数 `src/lib/rateLimit.js` + 薄封装，quote 60 次/60s、history 20 次/60s，超限返回 429 + `Retry-After`）。非分布式限流（Vercel serverless 按实例隔离），配额吃紧再评估 Upstash/KV。
- **D2.（S）简报强制门禁降级**——现状：`arena.js` 的 `openBriefing()` 默认自动弹出，主按钮（`bfEnter`）初始 `disabled`，要滚动到 96% 才解锁；V13 之后游戏区已隐藏（见 B10），这套仪式现在挡在一个**工具页**前面，每天要用的面板不该有门票。**方案**：`bfEnter` 默认可点击直接关闭（不再靠滚动比例解锁），`Skip` 提到与主按钮同等视觉权重；简报内容本身保留（对盘前浏览仍有用），只去掉"必须读完"的强制感。
- ~~D3.（S）首页背景渲染修复——吸收 B5~~ **已完成（2026-07-04，范围有调整）**——现状：`vite build` 每次都报 `[INEFFECTIVE_DYNAMIC_IMPORT] src/scene/topdownCombat.js is dynamically imported by src/main.js but also statically imported by index.html`（index.html 的静态 `<script>` 是给 `?combat=topdown` 全屏演示 harness 用的，main.js 的动态 import 是给生产环境 `?combatview=topdown` 战斗视角用的，两条路径都合法但共用一个模块导致 Vite 没法代码分割）。**方案**：把 index.html 的静态 `<script src>` 换成一段内联 `<script type="module">`，复现 harness 自身已有的 `?combat=topdown` 门槛后再 `import()`，构建警告消失，且首页默认不再多拉一个 three.js 场景模块。**范围调整**：`IntersectionObserver` 挂起首页背景 canvas 的部分**没有做**——核实后发现 `#starfield`/`#blackhole-gl` 是 `position:fixed;inset:0` 的全屏背景层，`main`/各 section 都没有不透明背景遮住它，也就是说这层背景在任何滚动位置都可见，不存在"滚出视口"这个状态，对 fixed 全屏元素做 IntersectionObserver 是死代码。切标签页的挂起（`document.hidden`）在 `main.js` 的 `frame()` 里本来就已经存在（约第 3311 行），原 P3 **B5** 的诉求实际已被覆盖，一并标记不再单独跟踪。
- ~~D4.（S）移动端触控目标 + 最小字号一轮 pass~~ **已完成（2026-07-04，范围有调整）**——现状：nav 链接实测约 30px 高、`.tf-b` 36px、`.ind-b` 22px、V13 新增的 `.ta-chip`/`.ta-mode` 更紧凑，均低于 44px 触控指南。**方案**：全站（arena/sectors/signal/games/serial/league 六个入口页，index.html 首页导航是动态生成的 `.nav-links`，不在这批 hardcoded `.nav a` 里）给 `.nav a`/`.hbtn`/`.tf-b`/`.ind-b`/`.ta-chip`/`.ta-mode` 加 `position:relative` + `::before{position:absolute;inset:...}` 的隐形热区扩展，视觉大小完全不变，只扩大可点击/可触摸范围到 ≥44px（水平方向按各自现有 gap 收窄扩展幅度，避免相邻按钮热区重叠）。**范围调整（字号部分）**：没有做"9px 系标签全站扫一遍提到 11px"——核实后发现这类 9-10px 小字遍布 5 个页面几十处，多数是时间戳/角标/赔率标签等装饰性小字，不是本条最初审计发现的对象（最初发现的是 Arena 交易 HUD 里 `.ta-chip i`/`.ta-mode i`/`.ta-sg i` 这几个 8.5-9px 的密集标签），把它扩大成全站字号重排是一次独立的视觉设计工作，风险和工作量都远超本条 S 量级快赢的范围，容易在无法截图核验的情况下引入换行/溢出回归。本条只按原始发现范围，把 Arena 那几个 HUD 标签在 `@media(max-width:720px)` 下提到 11px；全站字号扫查列为独立待办，不在本轮 D1-D5 里。
- ~~D5.（S）sitemap.xml + i18n 首帧防闪~~ **已完成（2026-07-04，范围有调整）**——现状：`public/robots.txt` 存在但无 `sitemap.xml`；中文访客每次进页先看到英文原文再被 `i18n.js` 客户端替换成中文，且爬虫只抓到英文（中文内容对 SEO 不存在）。**方案**：生成静态 `public/sitemap.xml`（7 个入口页：`/`、arena/sectors/signal/games/serial/league）并在 `robots.txt` 里指向 `https://feida.au/sitemap.xml`；7 个页面 `<head>` 最前面都加一行同步（非 module，不 defer）内联脚本，提前按 localStorage 缓存的 `afflatus:lang` 把 `<html lang>` 设对，不用等 `i18n.js` 作为 module script 跑完。**范围调整（防闪部分）**：没有做"关键首屏文案避免整段先英后中跳变"——核实后发现首页的 hero 标题/副标题（`#heroTitle`/`#heroDesc`/`#heroNum`）根本不走 `i18n.js` 的 `data-en`/`data-zh` 机制，而是由 `main.js` 自己一套独立的内容管线在运行时写入（`c.heroTitle` 等），要不产生视觉跳变得先摸清并改这条独立管线，风险和工作量超出本条 S 量级快赢范围，容易在无法截图核验的情况下引入新 bug。`<html lang>` 的提前设置已经落地（对 SEO/无障碍有实际帮助）；视觉上的先英后中跳变本质是需要服务端按 `Accept-Language` 分流或首帧内容内联渲染才能根治的问题，按原计划留给 C5 Astro 迁移一并解决。

**P0 · 抢时效（本周内，硬截止 7/12）**
- **V2.（S·随赛程持续）Games 世界杯收官跟进**——2026-07-04 复核：`games-data.json` 现有 `fixtures[]` 的 `result:null` 均已核实为真实准确（对应比赛截至当前尚未开球/未结束，非遗漏）；无需本轮更新。淘汰赛继续推进后再补 `home/away/result`（决赛 7/19 收官）；「夺冠路径」树状图不抢时效，见 B7。

**P1 · v1.5 核心（1–3 周）**

*产品轨（V4/V6/V7 已完成并归档，详见 `RELEASE_NOTES.md`；剩余项见下）：*
- **V5.（M）Arena 页 Autopilot 前端区块**——净值双曲线（A vs B + SPY 基准线）、持仓表、成交/拒单日志、每日复盘卡（中英）；沿用 arena.html 现有视觉，与「Human vs AI」游戏区并列。**时机**：`arena-autopilot-a-open` 尚未真正运行过一次，等账本积累 ≥3 个交易日再动工，不是排序靠后不重要，只是物理上没数据可画——定期查一下 `arena-ledger.json` 的 `day` 字段即可判断是否解锁。

*视觉轨（V14/V15/V16/V17 已完成并归档；剩余项见下）：*
- **V18.（M-L）战斗视图「立体化」**——**用户点名下次执行（2026-07-05）**：从 2D 分镜平面感升级为 SC 参考图的电影级追击视角（chaseCam 低机位追尾 + 引擎尾焰彩带 + 光照升级 + 深度参照层），B8 整体并入。三个 Phase 各自可独立提交验收，完整技术路线见 **§4「V18 实施路线」**。

**P2 · v1.5 扩展（3–6 周）**
- **V9.（M）Sectors 中美 AI 对比矩阵**——4 厂商观察卡（美：Anthropic/OpenAI；中：智谱/阿里）× 映射标的篮子（定性关联标签，不伪造统计相关系数）。规格见 **§7.2**。
- **V10.（M）Sectors「后内存时代」专题**——三主线（HBM 定价权 / CXL 内存池化 / NAND KV-Cache 分层）+ Top 10 论点卡 + 现有报价管线自动刷新；OTC ADR 报价源缺失时降级为纯论点卡。**结构决策：不单开新页，进 Sectors 专题区块**——理由见 §7.0。
- **V11.（S）sectors-data.json 每周定时任务**——V9+V10 共用一次周跑；提示词 `prompts/sectors-watch.md` + `prompts/postmemory-top10.md`。
- **V12.（M）数据管线统一**——`scripts/push-arena-news.sh`（已在用，2026-07-04 修复过一个从未生效的 rebase bug，见 §7.5）模板化为通用 `push-data.sh <file> <msg>`；所有数据 JSON 顶层统一 `{updated, version}`；前端共享统一**溯源徽章**（`FABLE 5 MAX · 数据龄 · 来源数 · NOT ADVICE` 一体化小组件，全站 AI 内容页复用，数据龄 >36h 琥珀、>72h 红）；预测类页面共享战绩组件（命中率 + Brier 分数，Games/Leagues/Signal 通用），并纳入首页 Top 10 组合 vs SPY/SMH 的公开记分（见 §7.2 集中度声明）；「Sectors 研判与 Arena 预测打通」并入本项评估。
- **A2.（L）main.js 继续拆分（Phase 3–5）**——各页内联 `<style>` 移到 `public/styles/<page>.css`；`state`/`cursor`/`nav`/`boot` 职责拆出；`styles.css` 做 `@layer` 分层。main.js 仍 3421 行、styles.css 仍 7038 行。详见 **§3**。

**P3 · 长线**
- **B1. CSS Scroll-Driven Animations**——`animation-timeline: scroll()/view()` 替换 `alphardForge` 的 JS scroll-pin。详见 **§8.2**。
- **B2. ~~topdownCombat 后续~~**——已整体并入 V14 实施路线（场景资产重构为相机无关的 `combatScene`，真实坐标驱动与动态 `import()` 一并在该轨解决，俯视降级为 `tacticalTopdown` 镜头预设），本条不再单独跟踪、仅存查。见 **§4 实施路线修正**。
- **B8. ~~V14 相机导演剩余 polish~~**——**已整体并入 V18（2026-07-05，见 §4 V18 实施路线）**：`impactOrbit`、FOV 动态推拉/banking、「空间深度四件套」正是 V18「立体化」的核心构件，不再单独跟踪、仅存查。
- **B9. Odin 舰体（V15）收尾项**——旧舰体贴花（"TC CONDOR"/"01"/危险警示条）未在新舰体重新定位；greeble 未走 InstancedMesh 单 draw call 优化（现状与其余 capitalShip3D 逐 box 循环手法一致，性能量级不变）。待 `?ship=odin` 观感确认后再评估是否值得做。详见 `RELEASE_NOTES.md` V15 条目。
- **B3. combatHudSC 机库跑道纵深透视**——先记录、不建议单独立项：起降走 `drawPilotDeck` 另一条渲染路径，`combatHudSC` 从未在起降时被调用，要做透视意味着把它接入起降路径，是比数据绑定修复大得多的独立工作。
- **B5. ~~首页背景 canvas 加 IntersectionObserver~~**——已并入 **D3**（2026-07-04 站内审计，见上方 P0★），不再单独跟踪。
- **B6. 首页 WebGL 收尾**——`saturnRenderer` 等 raw-GL 的完整 context-restored 重建（目前仅 `preventDefault` 保活）；跃迁点 shader 弱机自适应（降 fbm 八度或分辨率）；统一所有渲染器 `powerPreference` 与 dpr 上限到一处常量（目前 1.75 vs 1.5 不一致）。需真机 profiling。
- **B7. 各页零散点子**——Arena「模型 vs 你」历史胜率曲线 + Twelve Data 接入后 W/M/6M/Y/5Y 徽标转 `REAL`；Games「夺冠路径」树状图。详见 **§5**。
- **B10. Arena 旧 Human vs AI 对战区去留决定**——V13（2026-07-04）把对战区（旧名单/图表/预测面板/计分板整个 `.grid`）用 `.legacy-hidden` 暂时隐藏，源码全保留，arena.js 轮询已降频。待 TA 仪表盘用一段时间后决定：恢复共存（去掉 class 即可）、还是正式移除对战代码（届时 V5 的 Autopilot 前端区块布局也要重新考虑落点）。
- **C1/C2. Signal 传导链可视化 + 自动化剩余部分**——BREACH METER 自动映射、事件回放 ±2h sparkline、FedWatch 概率自动刷新（鹰鸽罗盘与定时任务自动化已被 V6/V7 吸收）。详见 **§6**。
- **C3. three.js WebGPURenderer + TSL + Bloom/ACES**——compute shader 粒子（百万级星涡/爆炸碎片）+ 更低 draw call 开销；`UnrealBloomPass` + ACES tone mapping 替代 radial-gradient 假光晕。详见 **§8.2**。
- **C4. TypeScript 渐进迁移**——main.js 拆分（A2）产出的新模块直接写 `.ts`，不强制回填旧文件。详见 **§8.2**。
- **C5. Astro 迁移**——触发条件：站内页面数 ≥8 或 novels 章节数 ≥20，当前均未到阈值。**⚠️ 注意：Leagues 上线后全站 7 页，逼近阈值**——下次再加新页时先做 Astro 评估再动手。详见 **§8.2 / §5**。

---

## 2. 站点结构与各页身份 / Pages & identities

> **导航规则**：顶层导航只放长期核心页；季节性/实验性内容一律进 **Labs** 下拉分组——`src/lib/nav.js` 的 `SITE` 数组给条目打 `group:'labs'` 标记即可，下拉菜单与翻页循环顺序自动收纳，不用改渲染逻辑。
>
> **v1.5 进度（2026-07-04）**：Arena 已上线 Autopilot 定时任务后端（V4，前端展示区块 V5 待账本积累数据后动工，§7.1）；Sectors 中美 AI 对比矩阵 +「后内存时代」选股专题仍待做（§7.2）；Signal 已就地重构为 Warsh 时代内容并接入定时任务（V6/V7 已完成，§7.3）；**Labs 新增 Leagues 页**已上线（MSI 2026 限时竞猜，§7.4，7/12 决赛硬截止）。全站 AI 人设文案已随 V8 升级为「Fable 5 Max」（2026-07-04）。

| Page | File | 身份 / Identity | 主题 | 导航位置 |
| --- | --- | --- | --- | --- |
| Home | `index.html` + `src/` | 深空舰长日志 (Three.js) | Orbitron / 钢蓝 HUD | 顶层 |
| Arena | `arena.html` | **美股技术分析仪表盘（V13，2026-07-04 上线）**：自选股+搜索+盘前/盘后关键位面板；原 Human vs AI 对战区暂时隐藏（源码保留，见 B10）＋ v1.5 Autopilot 双模型模拟盘（后端已上线，前端待数据积累，§7.1） | Marathon · 霓虹绿/青 | 顶层 |
| Sectors | `sectors.html` | AI + 航天个股研判 ＋ v1.5 中美 AI 对比矩阵、「后内存时代」专题（规划中，§7.2） | 酸性绿 + 故障艺术 | 顶层 |
| Signal | `signal.html` | 美联储观察 = SCP O5 收容档案（板块研判：Fable 5 Max）；v1.5 已重构为 Warsh 时代内容（§7.3） | 机密文档 · 琥珀/绿 | 顶层 |
| Games | `games.html` | 世界杯限时竞猜 vs Fable 5 Max | 赛博朋克 · 品红/青 | **Labs** |
| Leagues | `league.html`（**V0/V1 已上线**） | 2026 MSI 电竞竞猜 vs Fable 5 Max（Fearless Draft 分析；赛后转战绩存档，§7.4） | 海克斯 · 金/蓝 | **Labs** |
| Novels | `serial.html` | 无限流小说连载书架：《万界种春》（种田）＋《长夜请柬》（悬疑推理），书架切换 | 复古未来主义 · 铜/青（纯中文，护眼阅读，含夜间/豆沙绿/米黄三种阅读模式、自动翻页、书签、瀑布流、章节速览） | **Labs** |

**原则**：每页保留**独立的字体与美术身份**，但共享一套基础系统，避免重复造轮子。

**共享系统 / Shared systems**
- `page-turn.css` — 翻页箭头 + 自托管字体 + 全局按钮点击反馈（每页用 body class 切换箭头配色）+ Labs 下拉菜单结构样式。
- `src/lib/transition.js` — 进出页动画 + 音效；按目标页选择类型（warp / cannon / takeoff / control / cyber）。
- `src/lib/i18n.js` — 全局中英切换；任何带 `data-en` / `data-zh` 的元素自动翻译；右上角 `.lang-toggle`；切换时派发 `afflatus-lang` 事件供动态页面（arena/games/signal）重渲染。
- `src/lib/nav.js` — 唯一的 `SITE` 数组渲染导航 + 翻页 prev/next + Labs 下拉分组；下拉面板 portal 到 `<body>`（`position:fixed` + JS 用 `getBoundingClientRect()` 定位，`z-index:99000`），避免被各页自身的 clip-path/z-index 遮挡。
- `src/lib/clock.js` / `src/lib/audio.js` — 倒计时格式化、Web Audio 环境音共享库（arena/games/signal/transition.js 复用）。
- `src/ui/viz.js` — count-up 动画共享库（sectors.html/marketDeck.js 复用）。
- 数据文件：`arena-news.json`（每日定时任务）、`games-data.json`（手动更新）、`signal-events.json`（宏观事件档案，见 §6）、`novels-data.json`（章节内容）；**v1.5 规划新增**：`arena-ledger.json`（Autopilot 账本，V3）、`leagues-data.json`（MSI 竞猜，V0）、`sectors-data.json`（对比矩阵 + 后内存专题，V11）。
- `scripts/push-arena-news.sh` — cron 数据推送管线（写 JSON → 独立 stash/rebase/commit/push），已在用；V12 模板化为通用 `push-data.sh`。
- `prompts/` — v1.5 各模块定时任务提示词库（system/run 拆分 + JSON 输出 schema），规范见 `prompts/README.md` 与 §7.6。

---

## 3. 代码整理与优化方法 / Refactor & optimisation method

**现状痛点**
- `src/main.js` **3421 行**、`src/styles.css` **7038 行**——仍是单体文件，Phase 3–5 完整拆分未开始。
- 主线程渲染压力大：星空已移出主线程（Worker 化），combat、雷达、K 线仍在主线程 Canvas 2D 绘制。

**⚠️ 待续 / 未开始**
- **拆样式（Phase 3）**：各页 `<style>` 仍内联，未移到 `public/styles/<page>.css`。
- **拆 main.js（Phase 4，剩余部分）**：`state`（飞行状态机）/`cursor`/`nav`/`boot` 职责拆分仍未开始。
- **拆 styles.css（Phase 5）**：`@layer` 分层未开始。
- **IntersectionObserver**：首页背景 canvas 不可见时停止渲染，尚未做（见 §1 D3，最高优先级正在做）。main.js 继续拆分见 §1 A2。

---

## 4. 战斗视图工程 / Combat view engineering ★

**现状**：主战斗 HUD 默认使用 HMD v3（`src/ui/combatHmdV3.js` 的 `drawCleanCombatHmd`，贯穿起飞/降落/巡航/战斗全阶段）；SC 风格全息面板（`src/scene/combatHudSC.js`）保留为 `?combatview=sc` 可选皮肤；俯视战场（`src/scene/topdownCombat.js`）保留为 `?combatview=topdown` 战术地图可选皮肤。架构边界不变：`combatRuntime.js`（状态）→ 渲染层（纯函数）→ `#pilotFeed`。**V17（2026-07-05，详见 RELEASE_NOTES）**：`drawCockpitFrame` 已重写为 SC 双 MFD 控制台（旧三角舱盖支柱删除），带 `boot` 参数分阶段开机序列；各分支绘制顺序已修正为「星空→控制台→HMD」——**新增任何 pilot feed 图层时注意：`drawPilotSpace` 是近不透明的清屏层，画在它之前的东西只剩残影**。

**⚠️ 2026-07-04 路线改向**：俯视视角读起来像棋盘上的棋子（Ludo 感），破坏空间沉浸；导弹冲向彗星毫无纵深。「俯视渲染成为主战斗视图」的目标**已废弃**，新方向是下方的**真 3D 相机导演系统**（V14–V16）。已完成的状态快照接口（`combatRuntime.getState()`/`getBattleSnapshot()`）不白费——它正是 V16 单时钟同步的地基。**V16 已上线（`src/combat/weaponClock.js`，见 §1）**，V14 的镜头状态机可直接订阅其 `{t0, phases}` 时间线。

美术基调不变：硬科幻、太空军事拟真（Star Citizen 系），**严禁卡通/街机/过度游戏化**。

**⚠️ 命名冲突提醒**：`src/scene/cameraDirector.js` 这个文件名**已经被占用**（现有内容是起飞/降落的外部运镜 `drawExternalLaunch`/`drawExternalLanding`）。V14 的武器事件相机状态机需要另起文件名（如 `weaponCameraDirector.js`），不要直接覆盖现有文件。

**⚠️ 实施路线修正（2026-07-04 二次评审）**
1. **执行顺序是 V16 → V14 → V15**：镜头导演由武器事件驱动——先把「唯一时钟」的事件总线立起来（V16），镜头系统才有东西可订阅；反过来做，镜头系统就得先自设一套临时计时、V16 落地后再返工一遍。
2. **不要从零建 3D 战斗场景**：`topdownCombat.js` 里执法者母舰、夜鹰、彗星、曳光、导弹、爆炸、战术网格等场景资产**全部现成**——被裁决废弃的是固定俯视机位，不是这套场景。正确路线：把它重构为相机无关的 `combatScene`（场景图与状态消费不动，剥离内置相机），`weaponCameraDirector` 只负责驱动它的 camera；原俯视视角降级为镜头库里的 `tacticalTopdown` 预设（`?combatview=topdown` 继续可用，实现反而更干净）。这一修正把 V14 从「新建场景 + 新建镜头系统」缩水成「只建镜头系统」，省一周级工作量。
3. **过渡用特性开关**：新镜头系统挂 `?combatcam=director` 灰度入口，2D combatCine 分镜保留为默认回退，逐武器达到观感对齐后再逐个切默认——任何时刻主站都有完整可用的战斗观感，不存在「改到一半」的窗口期。

### V18 战斗视图「立体化」实施路线（2026-07-05 定稿，用户点名下次执行）

**目标**：把战斗形式从 2D 分镜的平面感（用户截图 1——`combatCine.js` 的 `drawMissileCine` 护航编队镜头：canvas 2D 平面填色战机+粒子爆炸，无光照无纵深）升级为 SC 参考图（用户截图 2/3）的电影级追击视角：低机位越肩追尾、发光引擎尾焰拖尾、强烈的深度与速度感。

**现状盘点（好消息：地基全部已存在，本项不需要从零建任何系统）**：
- `topdownCombat.js`（511 行）= 完整 THREE.js 战斗场景（执法者母舰/夜鹰/彗星/曳光/导弹/爆炸/战术网格），V14 已重构为 `weaponCameraDirector` 驱动相机；
- `weaponCameraDirector.js` = 镜头状态机（优先级抢占/续期/混合），已有 missileTail/ciwsTurret/mainGunAxis/bridgeWide/tacticalTopdown 五个预设，挂 `?combatcam=director` 灰度；
- `nighthawk.js` = V15b 已做 PBR-lite（法线贴图+panel line），战机模型本身不平；
- `weaponClock.js`（V16）= 权威武器时间线，镜头切换的事件源。
- **图1 的平面感根源不在 3D 管线，在于导弹/核弹分镜走的还是 `combatCine.js` 的 2D canvas 路径**——立体化的本质是把这些分镜迁进 3D 场景 + 补齐深度构件。

**Phase 1 · 追击相机 + 模型换装（先让画面立体起来）**
1. `weaponCameraDirector` 新增 `chaseCam` 预设：机位在战机尾后约 1.5 机身长、偏侧上方（图2 构图——主体压在画面左 1/3，视线越过机身看向纵深），临界阻尼跟随（沿用 cameraMath.smoothDamp，禁裸 lerp）；**banking 侧倾 + 动态 FOV（巡航 62° → 加速/点火 70°）在本镜头先做**（B8 欠账），加速度驱动、非时间驱动。
2. 导弹分镜迁移：`drawMissileCine` 的叙事节拍（锁定→点火→追击→命中）改由 3D 场景 + chaseCam/missileTail 镜头序列表达，时间轴接 `weaponClock` 的具名 phases（V16 预留的接口）；2D `combatCine.js` 保留为 `combatViewLegacy()` 回退，不删。
3. 光照升级：场景加太阳方向 key light（强定向光）+ 冷色环境 fill + 战机 rim light——图2 的立体感一半来自逆光轮廓，V15b 的法线细节在现有平光下发挥不出来。

**Phase 2 · 空间深度四件套（吸收 B8，图3 观感的核心）**
4. 引擎尾焰彩带：InstancedMesh quad ribbon（每机 1 draw call），additive 蓝白渐变（白核→青→蓝晕三段），寿命 ~1.2s、宽度随机龄收窄——图3 的标志性拖尾。
5. 喷口辉光：nozzle 处三层 additive sprite 叠加，随推力脉动（复用 topdownCombat 现有 `sprite()` 假 bloom 手法，不引后期依赖）。
6. 近景尘埃视差层 + 速度拉伸粒子（伪运动模糊）：速度感来自参照物流动——对象池化，`prefers-reduced-motion` 下密度减半/关闭。
7. 深度雾化：远景（彗星/母舰）按距离降饱和降对比（`scene.fog` 或材质级手动衰减），近中远三层分离。

**Phase 3 · 环境叙事层（加分项，可独立验收）**
8. 太阳眩光：镜头朝向依赖的 glare sprite（`dot(camDir, sunDir)` 控强度）+ 一两枚六边形 lens ghost——廉价近似，真 Bloom/ACES 仍归 C3。
9. （可选）低空/登陆阶段的程序化山脊剪影 2-3 层视差 + 雪线高光：图2 的地景是氛围加分项，太空场景用彗星/舰队/小行星带做同等纵深参照即可，不强求。

**门禁与验收（沿用本节既有红线）**：全程挂 `?combatcam=director` 灰度，观感达标后再评估切默认（「继续」≠授权切生产默认路径——V15 的教训）；性能红线：无独立 rAF、实例化每类 ≤1 draw call、粒子对象池、全息/战机三角面预算不变；纯函数部分（ribbon 几何、chaseCam 数学、FOV/banking 曲线）进 vitest + Node 实测包围盒，**观感必须真人过目**——沙盒无法渲染，这是 V15 三轮返工换来的纪律。执行顺序 Phase 1 → 2 → 3，每 Phase 单独可提交可验收。

### V14 相机导演系统

**核心思想**：镜头是被事件驱动的「导演」，不是挂在场景上的固定视角。
- **镜头状态机**：`shot = { id, priority, duration, blendIn, update(dt, ctx) }`；由武器事件总线（V16）触发，高优先级可抢占低优先级（核弹 > 导弹 > 主炮 > CIWS > 巡航全景），抢占用 0.3–0.5s 摄像机位姿插值缝合，不硬切。
- **首发镜头库**：
  - `missileTail` 导弹尾随：`camPos = missile.pos − v̂·dist + jitter`，`lookAt` 取导弹→目标连线 0.3 处插值点；点火瞬间 FOV 55→68 冲击后随速度回收；机动时 roll 随速度矢量侧倾（banking）。
  - `impactOrbit` 末段撞击环绕：命中前 1.5s 切至绕撞击点低速环绕，可选 0.3× 慢放一拍。
  - `ciwsTurret` 炮塔硬安装位：随炮塔转动 + 开火后坐抖动（弹幕武器的正确镜头语言是震感不是追踪）。
  - `mainGunAxis` 主炮轴线纵深位：沿炮管视轴，充能辉光由远及近渐涨。
  - `bridgeWide` 舰桥全景：默认待机/巡航镜头。
- **跟随阻尼**：临界阻尼弹簧（smoothTime 参数化），**不用裸 lerp**（果冻感来源）；镜头对舰体/彗星做球形包围盒回退，永不穿模。
- **空间深度四件套**（直接回应「导弹是平的」）：① GPU 实例化尾焰彩带轨迹（instanced quad ribbon）；② 速度拉伸粒子做伪运动模糊；③ 近景尘埃/碎屑参照层（速度感来自参照物流动，不来自目标本身）；④ 动态 FOV。真 DOF/运动模糊后期留给 C3 WebGPU 管线，本阶段用廉价近似。

### V15 Odin 参考全息舰重建 + 战机保真度

- **参考特征提取**（用户提供 Blender 截图，Odin 舰侧视）：长高比 ≈5.5:1；刀锋舰艏占全长 35–40%、渐收成针；舯部阶梯式上层建筑 + 舰桥塔 + 天线桅杆簇（多根细长斜桅）；舰尾密集推进器组 + 外伸散热鳍/桁架阵列；背脊炮塔成列（方形炮座 + 细节窗）；腹部吊舱与下沉式炮位；greeble 密度梯度**尾 > 舯 > 艏**（艏部大面留白突出刀锋轮廓）。
- **技术路径**：型线样条挤出程序化 blockout（先锁剪影再上细节，剪影错了细节全白费）→ 实例化 greeble 套件（炮塔/散热窗/天线/嵌板凹槽等 8–12 个基元 + 种子化布点规则，InstancedMesh 单 draw call）→ 全息着色器沿用 `shipHologram.js` 现有管线（fresnel 边缘光 + 扫描线 + additive），三角面预算 ≤50k。**同一几何体**喂 `capitalShip3D` 的侧视/尾视，一份资产两处用。
- **V15b 战机保真度 pass**：`fighter3D.js` 的 F-47/夜鹰增加嵌板法线细节（贴图烘焙或程序化 panel-line）与 PBR-lite 材质（金属度/粗糙度双参数），脱离棋子感；轮廓保持现有辨识度不动。

### V16 武器单时钟同步（CIWS / 导弹 / 核弹 / 主炮）

- **工程答案不是「把两套计时器对齐」，而是只保留一个时钟**：`combatRuntime` 为每次武器事件发布权威时间线 `{ t0, weapon, phases: [{name, at}] }`（如导弹：lock→launch→boost→terminal→impact 的相对时刻表）；DOM HUD（倒计时、告警条、battle-feed）与 3D 场景（V14 镜头切换、特效相位）**全部订阅同一事件、按 `(now − t0)` 相位分数渲染**。任何一侧自设 `setTimeout`/自走动画时长都是 bug。
- **迁移清单**：盘点 main.js/combatCine/battleFeed 里现存独立计时器（核弹 T- 倒计时、主炮 30s 冷却、CIWS 弹幕窗口、导弹分镜 elapsed）逐一改订阅制；`halley.destroyed` 提前触发时广播 `abort→impact` 强制剪切事件（沿用已有的 rising-edge 一次性闪光模式）。
- **验收标准**：UI 指示器与 3D 相位边界在**同一 rAF tick**内翻转——两侧打点日志逐帧对比 0 帧差；这是可自动化断言的硬指标，不靠目测。

### 视觉验收清单（v1.5b 全部工作共用）

- **风格红线**（硬科幻/太空军事拟真）：高饱和纯色只允许出现在小面积告警与推进器辉光；所有运动必须有质量感（加减速曲线，禁线性 tween）；镜头永不瞬移（切换必有 ≤0.5s 位姿插值或 whip-flash 转场语言）；每个发光特效都能说出光源是什么；文字一律用现有 HUD 字体体系。
- **性能红线**：新增视觉不允许出现独立 rAF 循环（全部挂进现有主循环）；实例化资产（尾焰彩带/greeble/粒子）每类 ≤1 draw call；粒子全部对象池化；全息舰 ≤50k 三角面、单架战机 ≤8k。
- **可达性**：`prefers-reduced-motion` 下镜头固定为 bridgeWide、禁抖动禁慢放；移动端（<560px）关镜头震动、尘埃参照层密度减半。

---

## 5. 各页设计备忘 & 未来点子 / Per-page notes & ideas

- **Arena**：**V13 美股技术分析仪表盘已上线（2026-07-04，用户直接指定，详见 `RELEASE_NOTES.md`）**——旧 Human vs AI 对战区暂时隐藏（去留见 B10，V5 动工时注意新落点）。**v1.5 → Autopilot 双模型模拟盘（V3/V4 已完成，V5 前端待账本数据积累，§7.1）**。原有点子保留（B7）：「模型 vs 你」历史胜率曲线；接 Twelve Data 后把 W/M/6M/Y/5Y 徽标改 `REAL`。
- **Sectors**：**v1.5 → 中美 AI 对比矩阵 + 后内存专题（V9–V11，§7.2）**；「研判与 Arena 预测打通」并入 V12 评估。
- **Signal**：**v1.5 → Warsh 时代重构已完成（V6–V7，§7.3，详见 `RELEASE_NOTES.md`）**；其余见 **§6**。
- **Games**：世界杯收官跟进已排入 **V2（P0）**——淘汰赛对阵确定后补 `home/away/result`（决赛 7/19）；「夺冠路径」树状图留 B7。
- **Leagues**（v1.5 新页，V0–V1）：MSI 2026 限时竞猜，7/12 决赛硬截止；赛后转战绩存档。规格见 **§7.4**。
- **Novels**：暂无额外待办；Astro 阈值见 C5——**Leagues 上线后全站 7 页，逼近 ≥8 触发线**。

---

## 6. Signal 专项：美联储观察站 / Fed-watch station ★

> **页面使命**：捕捉美联储日常政策变化与言论对美股波动的影响，是"事件 → 利率路径重定价 → 美股/板块反应"的传导链档案馆，非新闻站。

**当前状态**：事件档案化机制已上线，倒计时 `NEXT CONTAINMENT TEST`（FOMC + CPI + NFP 混排，取最近目标日期），数据源 `public/signal-events.json`（新增事件只需追加记录）。

**⚠️ 传导链可视化（部分已被 v1.5 吸收）**
- **BREACH METER**：事件前/后的降息-加息概率位移横条，位移幅度自动映射 SCP 收容等级（目前 `class` 字段人工评定）——仍待做，见 §1 C1。
- **鹰鸽罗盘**：已被 **V6/V7**（Warsh 时代重构，见 §7.3）吸收首版（人工打分先行）。
- **事件回放迷你图**：SPX 发布前后 ±2h 的 5 分钟 sparkline——仍待做，见 §1 C1。

**⚠️ 自动化与联动（部分已被 v1.5 吸收）**
- 定时任务自动生成事件档案草稿：已被 **V7**（见 §7.3）吸收。
- 与 Arena/Sectors 打通、FedWatch 概率自动刷新（若有数据源）——仍待做，见 §1 C2。

**设计原则**（沿用）：SCP 皮肤只做叙事包装，数据本体必须真实、注明日期与来源；所有研判标注 "not advice"；中英文案成对。

---

## 7. v1.5 五大模块规格 / v1.5 module specs ★

> 源头是站主的「Fable 5 Max 核心系统架构」规划报告；本节是评审后的**落地版**——保留报告的全部核心意图（双轨模拟盘、时间窗口批处理、五维信号矩阵、Fearless Draft 分析、后内存三主线），修正三处结构性问题（① LLM 伪高频、② 缺状态持久化设计、③ 日度年化对比无统计意义），补齐调度/预算/风控的工程细节。
>
> **事实纪律（贯穿全部模块）**：报告里的具体事实性内容（模型参数、赛果、公司财务数据等）**一律不写进本文档**——那些是运行时内容，由定时任务在生成当天用检索/注入数据核实后写进各数据 JSON。提示词层面强制「只允许引用 payload 注入的数据，禁止凭训练记忆报事实」（见 `prompts/README.md`）。两个影响排期的时效事实：MSI 2026 大田 6/28–7/12（决赛 7/12）；Kevin Warsh 5/13 参院确认、5/22 宣誓就任美联储主席。

### 7.0 结构决策：五模块 → 站点结构映射

| 报告模块 | 落点 | 理由 |
| --- | --- | --- |
| Arena 双轨模拟盘 | `arena.html` 新增 AUTOPILOT 区块 | Arena 就是交易页身份，不裂页 |
| Sectors 中美 AI 对比 | `sectors.html` 新增对比矩阵区块 | 同上 |
| Signals（Warsh） | `signal.html` 就地内容重构 | 页面使命不变，换的是「馆藏」 |
| Leagues（MSI） | **新页 `league.html`，进 Labs** | 季节性限时内容，常设规则的标准适用场景 |
| 后内存时代选股库 | **不单开新页**，进 `sectors.html` 专题区块 | 核心投资内容而非实验性内容，不符合 Labs 定位；顶层导航保持克制。若专题日后长成独立身份再升格 |

### 7.1 Arena Autopilot（V3–V5）

**与原报告的差异（评审结论）**
1. **「高频」改为「日内双窗口 swing」**：LLM 做不了毫秒/分钟级连续推理（token 指数膨胀 + 无真实执行通道）。Model A = 每交易日 2 次批处理决策（开盘后窗口 + 尾盘窗口），单窗口内聚合该时段行情/新闻做一揽子决策——这正是报告「时间窗口批处理」的落地形态，名字改诚实了而已。Model B 维持报告原设计：盘后 1 次深度调仓评估。
2. **状态外置是地基**（报告缺失的最大架构块）：`arena-ledger.json` 是唯一事实源。每次 run = 固定 system prompt（吃 prompt caching）+ 全量小状态 + 当日数据摘要，**模型零会话记忆**。KV-Cache/上下文膨胀问题从架构上消失，而不是靠省着用。
3. **LLM 提案、规则引擎收单**：模型输出 JSON 订单 → 代码层校验 → 通过才入账；拒单原因写回 ledger，作为下次 run 的反馈信号。学习闭环是确定性的，不依赖模型自觉。
4. **评估口径修正**：单日收益年化会得出荒谬数字。前 30 个交易日只看累计收益/最大回撤/胜率/敞口；≥30 交易日后启用 30 日滚动年化 + Sharpe（报告要的「年化对比」此时才有统计意义）。A/B 各 $10,000 独立账本，公平对比。

**2026-07-04 二次评审增补（策略与实验设计，全部由规则引擎强制、不靠模型自觉）**

5. **基准纪律**：账本每日同步记录 SPY 与 SMH 同期收益（各多取一个报价而已），所有展示以「超额收益 vs SPY」为主口径——没有基准的收益数字没有意义。
6. **换手率上限**：Model A ≤20 笔/周，超出直接拒单——LLM 交易最常见的死法是过度活跃，被手续费加滑点磨死；Model B 只在周二/周四的运行里允许交易（其余日子照常评估，但只能因风控事件卖出），把「<25%/月换手」从目标变成机制。
7. **信心门槛**：新开仓订单 `confidence < 0.65` 一律拒单；减仓/清仓不设门槛——风控动作永远放行。
8. **仓位止损（代码层）**：A 账本单仓自成本 -8%、B 账本 -15%，触发即生成强制清仓单，不依赖模型「记得」割肉。
9. **滑点分级**：A 账本 5bp（短线更贴近真实冲击成本）、B 账本 2bp；费用 0.5bp 不变。
10. **赛季制与版本归因**：任一账本累计 -20% → 冻结、产出验尸复盘、提示词修订版号 +1、重置 $10,000 开新赛季；ledger 记录 `promptVersion` 与 `season`，业绩能归因到具体提示词版本——赛季验尸报告本身就是博客最好的内容素材。
11. **固定交易域**：`public/arena-universe.json` 维护 ~30 支候选池（首页 Top 10 + 大盘科技 + SPY/QQQ/SMH），模型只能在域内下单，域外直接拒单；候选池每月人工审一次。

**账本 schema 草案（`public/arena-ledger.json`）**
```json
{
  "updated": "2026-07-06T07:30:00Z", "version": 3, "day": 2, "season": 1,
  "bench": { "spyPct": 0.6, "smhPct": 1.1 },
  "models": {
    "A": {
      "promptVersion": "A-v1", "cash": 4200.5, "equity": 10180.2,
      "positions": [{ "sym": "XXX", "qty": 10, "avgPx": 100.1, "mkPx": 103.2 }],
      "trades":    [{ "ts": "...", "sym": "XXX", "side": "buy", "qty": 10, "px": 100.1, "fee": 0.05, "slipBps": 2 }],
      "rejections":[{ "ts": "...", "order": {}, "reason": "single-position cap 20%" }],
      "metrics": { "cumPct": 1.8, "maxDD": -0.9, "hitRate": 0.6, "exposure": 0.58 },
      "review": { "zh": "…≤300字…", "en": "…" }
    },
    "B": { "同构": "…" }
  }
}
```

**硬风控（代码层强制，模型无权越过）**：现金账户、只做多，禁杠杆/期权/做空（v2 再评估白名单做空）；单票 ≤20% 账本净值；持仓 ≤8 只；现金 ≥5%；日亏 ≥3% 熔断（当日只允许 HOLD/SELL）；连续 3 日亏损 → Model A 降频为 1 次/日（省 token + 冷静期）。模拟撮合：市价按参考价 ±2bp 滑点 + 0.5bp 费用，收盘 mark-to-market。

**前端（V5）**：净值双曲线（A vs B，SVG 折线 + viz.js 数字动画）、持仓表、成交/拒单日志、每日复盘卡（中英）。免责声明沿用全站规则（模拟盘、非投资建议）。

### 7.2 Sectors 扩展（V9–V11）

- **对比矩阵**：4 厂商观察卡（美：Anthropic/OpenAI；中：智谱/阿里）——**每周更新**（产业格局以周为单位变化，日更是浪费）。每卡：当期版本与路线（开源权重 vs 闭源 API）、本周关键动态（带来源链接）、映射标的篮子。
- **标的映射纪律**：定性关联标签（`direct` 直接受益 / `supplier` 上游供给 / `infra` 算力底座 / `competitor` 受压），**不给伪造的统计相关系数**；接 Twelve Data 历史真算 90 日价格相关性列为 stretch goal。
- **后内存专题**：三主线（HBM 产能与定价权 / CXL 内存池化 / NAND KV-Cache 分层）+ Top 10 论点卡，每卡 `{ticker, moat, thesis, keyRisk, catalysts[], lastReviewed}`。报价复用现有报价管线；OTC ADR 报价源缺失时该卡降级为纯论点展示，不放假数据。
- **数据文件** `public/sectors-data.json`：`{updated, version, modelWatch[], baskets[], postMemory[]}`，一次周跑同时产出三块。
- **当前持仓**：首页 Top 10（`src/data/content.js`）已按回调后质量杠铃论点换仓（MU/AVGO/NVDA 核心仓 47% + 六支卫星仓），三大催化剂（韩股半导体巨震 / 6 月非农疲软 / Meta 出租算力）已检索核实，详见 Release Notes。三主线框架本身不变，V10 专题页沿用同一论点做深度展开。
- **集中度声明（诚实纪律）**：Top 10 是**单一主题**（AI 硬件/内存墙）的主题组合，不是分散配置——高相关、同涨同跌，这是有意为之的博客立场，页面文案与专题卡需持续明示 + not advice；V12 起对该组合自 2026-07-04 换仓日相对 SPY/SMH 的表现做公开记分——**包括错的时候**，战绩组件的可信度就来自这里。

### 7.3 Signal「Warsh 时代」重构（V6–V7）

- **叙事**：SCP 收容站更换 Site Director——新主席人事档案卡（政策立场：鹰派 2% 目标、捍卫央行独立、反 QE、激进缩表、反前瞻性指引——均为公开立场，档案按此归档）+ O5 更替事件档案（就任本身作为一份 INCIDENT 收录）。
- **五维信号矩阵**：通胀数据 / 货币政策与美联储动态 / 企业财报与指引 / 产业与巨头动向 / 地缘与贸易——五个 pillar 卡片；`signal-events.json` 每份事件档案打 `pillar` 标签自动归类。
- **无前瞻指引的机械含义**：数据发布日的波动权重上升 → 既有 `NEXT CONTAINMENT TEST` 倒计时按 pillar 分类扩展；CPI/PCE/NFP/FOMC 发布日由定时任务事件驱动跑一次，自动产出事件档案草稿。
- **鹰鸽罗盘首版**：讲话稀缺时代单次讲话权重更大；人工打分先行，聚合成指针，自动化留 P3。

### 7.4 Leagues（V0–V1）

- **定位**：Labs 第三页，MSI 2026 限时竞猜（赛后转战绩存档页）。**生命周期从第一天写进 schema**：`mode: "live" | "archived"` 控制页面状态条与文案，赛事结束不下线、转为战绩档案（Labs 页的标准生命周期范式，供未来季节页复用）。
- **骨架**：克隆 games.html 模式（hero + 战绩 + 对阵卡 + 赔率 + 免责声明 + i18n `data-en/zh` 全覆盖）；主题海克斯金/蓝（`#c8aa6e`/`#0ac8b9` 一带），与 games 品红/青、其余各页均区分。
- **数据** `public/leagues-data.json`：`{updated, version, mode, bracket[], series[{id, round, bo, teams[], result?, pred:{winner, score, pWin, oddsImplied, factors[], reasoningZh, reasoningEn}}], fearless[{team, poolDepth, note}], champion[{team, p}]}`。
- **预测纪律**：夺冠概率自洽（Σp=1）；`oddsImplied = 1/p` 诚实换算（可另列真实盘口价差作对照，标注来源）；每个系列赛完场立即复盘计分（命中 + Brier），战绩组件后续与 Games 统一（V12）。
- **Fearless Draft 特色**：每队英雄池深度指数，数据来自当届实际 pick 记录（注入数据，标注来源），不凭印象打分。

### 7.5 调度、token 预算与数据管线（V12 + 全模块共用）

**调度表**（用户本机 cron，AEST；美股 7 月为 EDT=UTC-4，AEST=UTC+10）

| 任务 | 市场时间 (ET) | 本机 (AEST) | cron | 频率 |
| --- | --- | --- | --- | --- |
| Arena Model A · 开盘窗 | 10:30 | 00:30 | `30 0 * * 2-6` | 交易日 |
| Arena Model A · 尾盘窗 | 15:45 | 05:45 | `45 5 * * 2-6` | 交易日 |
| Arena Model B · 盘后 | 17:30 | 07:30 | `30 7 * * 2-6` | 交易日 |
| Arena 周度深复盘 | — | 周六 10:00 | `0 10 * * 6` | 每周 |
| Signal 例行 | — | 周一 08:00 | `0 8 * * 1` | 每周 + 数据发布日事件驱动 |
| Sectors（含后内存） | — | 周日 10:00 | `0 10 * * 0` | 每周 |
| Leagues（MSI 期间） | — | 23:30 | `30 23 * * *` | 每日，至 7/12 止 |

所有任务入口先过**守卫**（周末/NYSE 假日/无比赛日直接 no-op），不产生任何 API 调用。冬令时切换（11 月）需整体校准一次调度时间。

**运行环境增补（2026-07-04 评审）**
- **launchd 优于 crontab**（macOS）：cron 在合盖睡眠期间错过的任务直接跳过；launchd 的 `StartCalendarInterval` 会在唤醒后补跑一次——对「笔记本合盖」场景这是本质区别，尤其 Arena 的 00:30/05:45 两个夜间窗口。迁移成本：每任务一个 plist + `launchctl load`（操作步骤记 technical.md §4）。
- **数据获取与 key 红线**：定时脚本优先走线上代理（`https://feida.au/api/quote` 等，免本地管 key）；必须直连的（新闻检索等），key 一律放 `~/.config/afflatus/env`（仓库外，脚本 `source` 读取）——**scripts/ 目录现已进 git 跟踪，任何脚本里不允许再出现明文 key**（此前泄露过一次）。指标计算（均线/RSI/涨跌幅）全部在脚本里用 Node 算完再注入，模型只收结果。
- **NYSE 假日守卫**：仓库放一份静态 `nyse-holidays-2026.json`（一年 10 个日期，每年更新一次），脚本启动先查表，不为这事调 API。
- **部署频率**：每次数据推送触发一次 Vercel 重建（约 1 分钟）；满负荷调度 ≈4–5 次/天，远低于配额，不用优化。若未来数据推送频率上一个量级，再评估数据与代码分仓。
- **推送脚本已知 bug（2026-07-04 已修复）**：旧版 `push-arena-news.sh` 的「stash --keep-index → rebase」组合**从未生效**——rebase 拒绝在暂存区有内容时运行，日志里每次都报 `cannot rebase`，只是因为本地恰好从未落后于远端才没出事；且 `git add dist/arena-news.json` 被 `.gitignore` 的 `dist` 规则挡掉，一直是无效操作。已改为「commit 先行 → `git pull --rebase --autostash` → push」的健壮序列。新管线脚本（V12）照此模式写，不要抄旧版。

**token 预算（月度估算，实际以运行日志校准）**

| 模块 | 次/月 | 单次输入上限 | 月输入估算 |
| --- | --- | --- | --- |
| Arena A（2/交易日） | ~44 | 20k | ~0.9M |
| Arena B（1/交易日） | ~22 | 40k | ~0.9M |
| Arena 周复盘 | ~4 | 50k | ~0.2M |
| Signal | ~6 | 25k | ~0.15M |
| Sectors | ~4 | 45k | ~0.2M |
| Leagues | 赛事期 ~10 | 15k | ~0.15M（一次性） |

合计 ≈ **2.5M 输入 / ~0.15M 输出每月**。三条纪律压住预算：① 固定 system prompt 吃 prompt caching；② 数据预消化（指标计算、新闻去重截断）用代码/便宜模型做，Fable 只做决策推理；③ 输出双段式（机器 JSON + 限长复盘）硬上限。

**数据管线（V12）**
- `scripts/push-arena-news.sh` 已验证可用（cron → 写 JSON → 独立 stash/rebase/commit/push → 站点重部署），模板化为 `push-data.sh <file> <msg>` 供 ledger/leagues/sectors/signal 复用。
- 所有数据 JSON 顶层统一 `{updated, version}`；前端共享「数据龄」徽标（>36h 琥珀、>72h 红）。
- 预测类战绩组件统一（Games/Leagues/Signal）：命中率 + Brier 分数，一处实现三处用。

### 7.6 提示词工程规范（全模块）

正式文本在 **`prompts/`**（README + 5 个模块文件），本文档只记五条硬规则：
1. **system/run 拆分**——角色、红线、输出 schema 进固定 system prompt（享受缓存）；账本状态与当日数据进 run payload。
2. **强制 JSON schema 输出**——机器段直接落盘进数据 JSON；展示段单独字段且限长。
3. **状态外置**——模型零会话记忆，账本/数据 JSON 是唯一事实源。
4. **事实纪律**——只允许引用 payload 注入的数据；禁止凭训练记忆报价格/新闻/模型参数；不确定必须标 `confidence` 并降权。
5. **长度硬上限**——复盘 ≤300 字、单条推理 ≤120 字，防 token 膨胀。

---

## 8. 架构演进与下一代视觉 / Architecture evolution & next-gen visuals ★

> 站点持续加页（novels.html 已上线，之后更多）。结论：**不需要换语言、不需要上 React**——瓶颈在 (a) 多页手工维护成本 (b) 主线程渲染压力 (c) 缺乏 GPU 后期处理。

### 8.1 现有架构的真实问题（按痛感排序）

1. **单体文件**——`main.js` 3421 行 / `styles.css` 7038 行，仍需继续拆分。
2. **重复的页面骨架**——nav 已统一，但 `<head>` meta / 字体加载顺序仍每页复制。
3. **主线程全包**——combat、雷达、K 线仍在主线程 Canvas 2D；星空已移出。
4. **多页跳转是整页刷新**——`transition.js` 掩盖白屏，本质仍丢弃状态重载；原生跨文档过渡已作为补充层加入。

### 8.2 技术选型建议

**已采用**（不再需要评估）：Vite MPA 多入口、View Transitions API（跨文档，与 `transition.js` 共存不叠加）、OffscreenCanvas + Worker（目前只做了首页星空，combat/雷达/K 线仍在主线程）。

**待评估 / 值得做**

| 技术 | 解决什么 | 成本 |
| --- | --- | --- |
| **CSS Scroll-Driven Animations** | `animation-timeline: scroll()/view()` 把滚动动画搬到合成器线程，零 JS 不掉帧 | 中 |
| **three.js WebGPURenderer + TSL** | compute shader 粒子（百万级星涡/爆炸碎片）+ 更低 draw call 开销 | 中-高 |
| **Bloom/HDR 后期处理** | `UnrealBloomPass` + ACES tone mapping，真实辉光替代 radial-gradient 假光晕 | 中 |
| **TypeScript（渐进）** | 拆 main.js 时新模块直接 `.ts` | 低（增量） |
| **Astro（触发式）** | 页面 ≥8 或 novels 章节 ≥20 时迁移，当前未到阈值 | 高（迁移） |

**❌ 不要做**：React/Vue/Svelte 重写、Rust/WASM、全站 WebGPU-only、SSR/后端框架——站点是 canvas 动画 + 静态内容，加框架/后端只会增加体积与运维成本而无实际收益。

### 8.3 落地顺序

1. **短期**：scroll-driven animations 替换 alphardForge 的 JS pin 逻辑；main.js 拆分继续（§1 A2）；新模块用 TS。
2. **中期**：three.js WebGPURenderer 试点跃迁点星涡（compute 粒子 + bloom），A/B 对比帧率后再推广。
3. **触发式**：页面/章节数量到阈值 → Astro 迁移。

**衡量标准**：Chrome DevTools Performance——主线程帧时间目标 <8ms、合成器帧率目标 120fps、子页 LCP <1.5s。

---

*Desk view only · not investment / betting advice. 仅为台面观点，非投资或博彩建议。*
