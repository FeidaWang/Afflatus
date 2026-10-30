# REL-000 · 现网基线（Relationships）

审计日：2026-10-23。分支 `claude/redesign-horoscope-page-b12f67`，基于提交 `f2b282c3`（2026-10-21）。
方式：只读源码；跑了现有单测；用合成生日写过一个一次性探针脚本（放在会话临时目录，没进仓库）。
没改任何代码，没在生产环境提交出生资料，也没部署。

## 1. 入口与构建

| 项 | 实际情况 | 证据 |
|---|---|---|
| 源页面 | 仓库根目录 `horoscope.html`（483 行，一份模板同时承载中英文） | `horoscope.html` |
| `/en/horoscope.html` | 构建时由 `scripts/localize-site.mjs --out-dir dist` 生成，不是单独的源文件 | `package.json` 的 `build` 脚本 |
| JS 入口 | `src/pages/horoscopeEntry.js` → `src/pages/horoscope.js`（1820 行，一个 IIFE） | `horoscope.html:481` |
| 合盘代码分包 | `src/horoscope/synastryFeature.js` 只是动态 import 的再导出 | 第 1–4 行 |
| Worker | `src/workers/horoscopeSynthesis.worker.js`，由 `src/lib/latestWorkerTask.js` 管理。新任务会 terminate 旧 Worker；Worker 失败时回到主线程跑同一函数 | `horoscope.js:83`、`:969-980` |
| 部署 | Vercel（`vercel.json`）；构建为 Vite 加若干自定义脚本 | `vercel.json`、`vite.config.js` |
| 依赖 | 唯一的星历依赖是 `astronomy-engine ^2.1.19`（MIT）。没有 Swiss Ephemeris、iztro 或 lunar-javascript | `package.json:46-53` |
| 单测 | vitest：合盘相关 7 个文件 105 项，本次实跑全部通过 | 见 HANDOVER |
| e2e | 没有针对合盘的 Playwright 用例；只有品牌、导航、分包这类全站 spec 会碰到 horoscope | `e2e/*.spec.js` |

## 2. Relationships 的实际链路

```text
底部导航 [data-observatory-nav=relationships]
  → dailyExperience.switchView('relationships')：展开 <details class="more-explorations">，写入 #relationships
  → #synForm submit (horoscope.js:1757)
      → readBirth('s') → parseBirthDetails() → normalizeBirthToCST()：统一换算成北京时间
      → 填了称呼就 upsertBook() 写入 localStorage
      → renderSyn() (horoscope.js:1187)
          ├ synastry(me, other)              八字底盘分 base + 五项子分（主线程）
          ├ crossBranchMatrix(A, B)          4×4 地支矩阵与矩阵分
          ├ computeSynAstroLayer()  → Worker 日月水金火 5×5 相位、共鸣指数、称号、吸引/红旗、组合盘
          ├ relationshipScores()             五种关系分（先只用八字画一次，相位到达后重画）
          ├ synastryZiwei()                  命宫地支关系与主星气质（双方都要有时辰）
          ├ xiuRelation()                    宿曜三九秘法双向关系（纯文字，不打分）
          ├ dailyPull()                      今日引力与 7 日日历（种子随机数）
          └ loadTransits() → /transits-daily.json  今日双人天象（静态 JSON，请求里不带个人数据）
```

前提：必须先提交「我」的表单（`#birthForm`），合盘只做「我」对一个人（`horoscope.js:91-97` 的注释写明了这个范围）。

## 3. 输入精度（REL-000 第 3 步）

| 字段 | 「我」 | 对方 | 结论 |
|---|---|---|---|
| 日期 | `<input type=date>`，1900–2100 | 同左 | 只支持公历，没有农历输入 |
| 时间 | 13 个时辰选项，值为起始小时（0,1,3,…,21,23） | 同左 | **代表一个 1–2 小时的区间，引擎却按起始小时当精确时刻算**，没有分钟输入 |
| 未知时间 | 选项值为 `""`，传入 `hour=null` | 同左 | 有未知时间，但星历按正午近似继续算分（`astro.js:30`） |
| 时区 | 地区/城市级联写入固定**标准**偏移（UTC−12…+14），夏令时靠手动勾选 | 同左（只有时区，没有经纬度） | 不是 IANA；海外历史夏令时不会自动判断；中国 1986–1991 年夏令时由内置表自动校正（`bazi.js:198`） |
| 经纬度 | 有（用于上升） | **没有** | 合盘本身不用上升，所以目前不影响 |
| 性别 | 有（排大运） | 没有 | 合盘不用 |
| 称呼 | — | `maxlength=12`，经 `attr()` 转义后插入 | 只用于显示，不参与计算 |

A/B 两方的表单**不对称**：对方没有经纬度和性别。

## 4. 本地计算承诺与实际行为

| 页面承诺 | 实际 | 是否相符 |
|---|---|---|
| 计算全在浏览器本地 | 是。唯一的网络请求是拉静态 `transits` JSON，请求里不带个人数据 | 相符 |
| 出生资料保存在本机 | 「我」**提交即自动保存**（`horoscope.js:1745`）；对方**只要填了称呼**就存进关系册 | 相符，但这是默认保存，不是 v2 要求的默认临时 |
| 页面链接不含出生资料 | 「复制页面链接」只复制 `origin + pathname` | 相符 |
| shareTip 默认文案「发给对方——点开就是这一对的合盘」 | **不成立**，链接不带任何配对信息 | **不符**，点复制后文案才改成「不含出生资料」 |
| 不做分析 | 本页 `track()` 是空函数（`horoscope.js:109`）；`webVitals.js:69` 把 horoscope 路由排除在遥测之外 | 相符 |
| 下载的卡片可能含个人结果 | 合盘卡会印出双方四柱、星座和分数 | 相符，页面也写了 |

## 5. 现有分数与内容都从哪来

| 输出 | 来源 | 性质 |
|---|---|---|
| 共鸣指数（大圆环） | 先显示八字 `base`，相位算完后换成 `(base + astroScore)/2` | 原创权重 |
| 五项子分（情缘、婚嫁、事业、财帛、康健） | `base ±12` 的**种子伪随机数**，种子是两人的年月日（`horoscopeEngine.js:309-313`） | **不来自任何规则** |
| 五种关系分 | 子分、相位信号、`base` 的固定线性组合（`synastryModes.js:61-65`） | 原创权重，部分建立在伪随机子分上 |
| 地支矩阵分 | 16 格加权后过 sigmoid；缺时柱时把权重放大补回 | 原创权重 |
| 紫微合参分 | 命宫关系查表打分（88/84/…/40） | 原创 |
| 宿曜 | 双向文字，不打分 | 传统符号，查表没有独立核验 |
| 今日引力与 7 日日历 | `40 + rnd()*56`，种子是日期和双方生日（`horoscopeEngine.js:319-327`） | **纯随机**，但标题写的是 7-DAY OUTLOOK 和缘分日历 |
| 本周最佳日 `.ics` | 上面随机数的最大值 | 同上 |
| 今日双人天象 | 真实行运（每日脚本生成的 JSON）对双方的日月 | 真实计算；数据过期时会显示停更提示 |

## 6. 不能据此声称的事

- 没有在真实 Safari/iOS 或真实网络下抓 HAR，所以「零外发」只是读源码的结论，没有实测。
- 没有核对 Vercel 线上实际下发的响应头；CSP 是读 `vercel.json` 得到的。
- 宿曜的月首宿表和三九关系表没有找到可引用的独立来源（`xiu.js` 头注释自己也这么写）。
