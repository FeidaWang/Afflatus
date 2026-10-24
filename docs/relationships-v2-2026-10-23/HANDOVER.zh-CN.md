# HANDOVER · REL-000

| 项 | 内容 |
|---|---|
| 阶段 | REL-000 现网与仓库审计（只读） |
| 实际模型 | Claude Opus 5.5（Claude Code 桌面版）。v2 包推荐的是 GPT-6.1 Sol / High，本次**没有**使用 |
| 修改的文件 | 只新增本目录下 6 份文档；**没有改任何源码、测试或配置** |
| 执行的命令 | `npx vitest run tests/synastry* tests/horoscopeEngine.test.js tests/xiu.test.js tests/bazi.test.js tests/ziwei.test.js`：7 个文件 105 项全部通过；两个只读探针脚本 `probe.mjs`、`lichun.mjs` 放在会话临时目录，只用合成生日，没进仓库 |
| 探针结果 | 400 对合成生日中，交换 A/B 后 `base` 不同的有 161 对，子分全部不同；子分的种子不含时辰；2024-02-04 03:00 被排成甲辰年寅月，而仓库自算的立春交节在 16:21 CST |
| 未做 | HAR 抓包、线上响应头、真实浏览器 e2e、Safari/iOS 实测、宿曜表的独立来源核验 |
| 来源和版本 | 仓库提交 `f2b282c3`；v2 包 2026-10-17 版（本地 `~/Downloads/feida-relationships-backend-v2`，没拷进仓库） |
| 部署 | 没有部署，没有提交，没有推送 |
| 授权状态 | 站主授权 REL-000 只读审计；任何会改变计算结果的修改（COMPARISON 的 Q1–Q10）都等确认 |
| 下一阶段 | 站主答复 Q1–Q10 → 把 REL 线插进星历仪 ROADMAP → 进入 REL-010（契约与纯函数内核）和 M0 |

# HANDOVER · R0（REL-030 部分）

| 项 | 内容 |
|---|---|
| 阶段 | R0 排盘与合盘规则校正，依据 DECISIONS.zh-CN.md 中 Q1–Q5、Q8、Q9、A2，加上 C1 |
| 实际模型 | Claude Opus 5.5 |
| 修改的源码 | `src/lib/bazi.js`（交节时刻、`boundaryUnstable`）· `src/lib/astro.js`（`sunSignOf`）· `src/lib/horoscopeEngine.js`（`synastry()` 对称天干关系、互为喜用、真实星座；删除伪随机子分；`dailyPull()` 流日三档；C1 文案）· `src/lib/synastryModes.js`（null 不补 50、命无正曜）· `src/lib/horoscopeSynthesis.js`（未知时辰月亮全天稳定才计）· `src/horoscope/mineFeature.js` · `src/pages/horoscope.js` · `horoscope.html`（日历标题、ICS 文案、shareTip） |
| 修改的测试 | `tests/bazi.test.js`（+7 交节）· `tests/horoscopeEngine.test.js`（对称性、五合、四冲、比和、真实星座、交界未知、流日、C1）· `tests/synastryModes.test.js`（null、命无正曜）· `tests/horoscopeSynthesis.test.js`（月亮全天规则） |
| 删除的旧预期 | 「子分 5 项」和「缺子分回落到 50」两条单测：这是 Q2、Q4 的裁定，不是为了让测试变绿而改预期 |
| 命令 | `npx vitest run`：123 个文件通过，1 个文件（`homeFooter.test.js`，缺 react）在 `npm ci` 前失败，与本改动无关；`npm run lint:i18n` 通过；本地 Vite 页面实测中英文、375px 宽度均无溢出，console 无错误 |
| 原型 | `prototype-data.js` 用新引擎重新生成（样例四柱不变，合盘 base 由 73 变为 79，月亮相位按全天规则变为 0 条）；`prototype.html` 去掉 C1、C2、C2b 的「待修」标注 |
| 未做 | Q6、Q7（REL-020）· Q10（REL-080）· M0 · 宿曜表来源核验 · `.ics` 下载的实机点击测试 |
| 部署 | 没有提交，没有推送，没有部署 |

# HANDOVER · 引擎线 R1–R4、C3 与零散修正（2026-10-24）

| 项 | 内容 |
|---|---|
| 分支 | `claude/horoscope-engine-r-10805d`，基底 `claude/horoscope-m0-21cac4`（#25）。**不合并**，与 #25、#26、#27 一起审 |
| 实际模型 | Claude Opus 5.5（Claude Code 桌面版）。v2 包推荐的 GPT 模型**没有**使用 |
| 完成到第几项 | 简报 1–8 项全部做了，每项单独提交：R1 `9599cce8` · R2 `ab1dc7dc` · R3 `8241011a` · R4 `cf0483b5` · C3 `e9cf1744` · 零散修正 `f9e95577` · 来源与许可 `551629be` · 本文档 |
| 新增源码 | `src/lib/relationships/`：`contract.js`（运行时 schema、错误码、能力声明）· `time.js`（exact/range/unknown、IANA、DST fold/gap）· `kernel.js`（报告）· `scale.js`（rel-six-dim）· `client.js`（Worker 协议、generation 计数）· `copy.js`（显示文案）；`src/horoscope/profileStore.js`；`src/lib/passportCopy.js`；`src/lib/icsText.js` |
| 修改的源码 | `bazi.js`（可选分钟、`clockHour`、导出 `inCnDstWindow`）· `astro.js` / `dayun.js` / `horoscopeSynthesis.js`（分钟传进星历）· `cities.js` / `cityPicker.js`（IANA）· `horoscopeEngine.js`（`headline`，导出 `dayStemRelation`）· `synastryBazi.js`（导出 `branchPairRelations`）· `xiu.js`（E3 措辞）· `formDetails.js` · `synastryFeature.js` · `horoscope.js` · `horoscopeSynthesis.worker.js` · `horoscope.html`（精确时间、IANA 隐藏字段、两个保存勾选、文案）· `public/styles/horoscope.css`（删掉连签提示样式） |
| 新增测试 | `tests/relationshipsKernel` · `relationshipsTime` · `relationshipsScale` · `relationshipsPrivacy` · `passportCopy` · `icsText`；`horoscopeEngine` 加 headline；`e2e/horoscope-privacy.spec.js` |
| 命令与结果 | `npx vitest run`：136 个文件、1542 项通过，1 项跳过（开工时 130 个文件、1470 项，全部通过，没有新增失败）· `npm run lint:i18n` 通过 · `npx vite build` 通过（**跳过了 prebuild**，原因是 `site:check` 的 sitemap 日期问题在 HEAD 上就存在；没有运行 `site:generate`）· `node scripts/check-bundle-budget.mjs` 全部 OK · Playwright `horoscope-privacy` 与 `horoscope-m0` 在 desktop-chromium 和 iphone-16-pro-max-webkit 上 16 项全部通过 · `quality-gates` 的「keyboard entry and route navigation」**8 条路由全部失败**（同一个 404），horoscope 以外的页面也一样，判断是跳过 prebuild 的构建缺页面，与本分支无关，但没有在基底分支上复现确认 |
| 浏览器实测 | 本地 Vite（内置浏览器）：精确时间立盘、恢复已存的精确分钟、合盘六维与证据账单、时辰未知时显示「待补充」、中文文案。**没测**：真实 Safari/iOS、Android 真机、读屏、`.ics` 实机导入、`?fx=almanac` 开关下的新视图（M10 尚未接入新报告） |
| 会改变的结果（都在裁定范围内） | ① 港澳台和海外城市改用 IANA 时区（Q7）：以前港澳台走「按中国处理」并套用中国 1986–1991 夏令时，海外夏令时要手动勾选，现在由时区库判断。② 时段按区间处理（Q6）：自我页的上升星座只在整个时段内不变时显示，并且不显示度数；合盘的日月相位在时段内有变化时显示「未定」。③ 每日签不再有连签解锁的隐藏签池（design.md §5，不做连签）。④ 页面不再自动保存出生资料（Q10）；已有资料照常读取，这类回访者的「保存到本机」默认勾上 |
| 没有改变结果的 | 中国大陆出生、手动时区的 CST 换算与旧版逐一一致（200 组属性测试）；`dailyFortune()` 加 `headline` 后，其余字段与旧版 500 组完全一致；旧共鸣指数、五种关系、地支矩阵、紫微分数仍是原值，只是改由报告提供 |
| 新量表 | `rel-six-dim 0.1.0-draft`：草案权重，状态 `unverified`。三大模块（八字、行星、紫微）对双方都必须是 ready，否则总分和六维为 null。分布与敏感性见 `SCALE_SENSITIVITY.zh-CN.md`。「成长」维的下限偏高，留给站主决定 |
| 来源 | astronomy-engine 2.1.19 MIT；**构建产物没有带 MIT 声明**（缺口已记录，未修）。宿曜：经文例子与三九映射一致；月首宿表七至十一月与经文转录有矛盾，**保持 unverified**。详见 `SOURCES_AND_LICENSES.zh-CN.md` |
| 待站主决定 | S1 1988 年中国夏令时开始日（仓库 4 月 10 日，tzdata 4 月 17 日）· S2 宿曜月首宿表 · S3 MIT 声明分发 · rel-six-dim 权重签署 · 「成长」维补规则 · C 的 20 条抽查 |
| 留给前端线 | M10 改为消费 `RelationshipReport`（`report.dimensions` / `overall` / `archetypes` / 证据账单 / `legacy`），不要再调 `synastry()`；M5 显示 `headline`；`starDraw.js` 的隐藏签池与 `streak` 参数现在没有调用方，没删 |
| 部署 | 没有部署；分支已推送，PR 见 PR 描述 |
