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
