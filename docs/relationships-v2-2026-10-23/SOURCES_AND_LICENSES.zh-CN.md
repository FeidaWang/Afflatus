# 来源与许可记录（REL-050、REL-060）

2026-10-24。对应 `src/lib/relationships/contract.js` 的 `SOURCE_IDS`。这里只记录本仓库实际用到的东西。核查方式写在每一行，没写的就是没核查。

## 1. 星历与历法（REL-050）

| sourceId | 用在哪里 | 许可 / 性质 | 核查 |
|---|---|---|---|
| `src.astronomy-engine-2.1.19-mit` | 水星、金星、火星黄经（`astroPlanets.ts`），每日行运脚本 `scripts/gen-transits-daily.mjs` | **MIT**，Copyright (c) 2019-2023 Don Cross。npm 包 `astronomy-engine@2.1.19`，`package.json` 写 `^2.1.19` | 读了 `node_modules/astronomy-engine/package.json` 的 `license` 字段和 `astronomy.js` 文件头 |
| `src.meeus-low-precision` | 太阳视黄经、节气求解（`bazi.js`），月亮黄经、上升点（`astro.js`） | 按 Meeus《Astronomical Algorithms》公开公式自行实现，没有拷贝第三方代码（见两个文件的头注释） | 读源码头注释；精度由仓库单测约束 |
| `src.repo.lunar-table` | 公历转农历（`lunar.js`），紫微、宿曜用 | 1900–2100 通行压缩表，头注释写明取自 MIT 许可的 `solarlunar` npm 包；转换代码为本仓库自写 | 读头注释；`solarlunar` 不在依赖里，原包许可这次没有重新核对 |
| `src.tzdb-via-intl` | 除中国大陆外的出生地时区（`relationships/time.js`） | 浏览器内置的 IANA tz 数据库（公有领域），不随站点分发 | 本机 Node 22 的 ICU 78.2 / tz 2025c 跑过单测；各浏览器的 tz 版本会不同 |
| `src.repo.cn-dst-1986-1991` | 中国大陆 1986–1991 夏令时（`bazi.js` `CN_DST_WINDOWS`） | 仓库自带的日期表 | 与 tz 2025c 的 `Asia/Shanghai` 对比：起止日期只有 **1988 年开始日不同**。**与 tzdata 4 月 17 日不同，站主裁定沿用 4 月 10 日**（2026-10-24）。大陆出生（无论是否显式写 `Asia/Shanghai`）一律用仓库表，单测 `China 1988 DST start` 锁定 |

**没有使用 Swiss Ephemeris**（AGPL 或商业双授权），所以不存在 AGPL 传染的问题。

**许可声明的分发（S3，2026-10-24 已修）**：压缩会去掉 astronomy-engine 自带的文件头。现在做了两件事：`vite.config.js` 用 Rolldown 的 `postBanner`（在压缩之后加），给所有包含 astronomy-engine 的产物（页面分块 `vendor-astronomy-*.js` 和 Worker `horoscopeSynthesis.worker-*.js`）加一行 MIT 声明；根目录的 `THIRD_PARTY_NOTICES.md` 新增 astronomy-engine 一节，附 MIT 全文，构建时作为 `dist/THIRD_PARTY_NOTICES.md` 分发。`npx vite build` 后已确认这两个分块的第一行都是这条声明，`dist/` 里也有这份文件。

## 2. 宿曜表（REL-060）

结论（2026-10-24 更新）：**月首宿表和三九秘法映射改为「已核对」**，依据是大正藏 T1299 和 p.391b11 的例证。核对由站主委托第三方完成，时间 2026-10-24。**闰月规则仍未核验**。宿曜继续只做分类、不计分，DECISIONS 的原裁定不变。

| 表 | 仓库现状 | 依据 | 状态 |
|---|---|---|---|
| 月首宿（每个农历月初一的宿） | 正月室、二月奎、三月胃、四月毕、五月参、六月鬼、七月张、八月角、九月氐、十月心、十一月斗、十二月虚 | **大正藏 T1299，p.391b11 例证；站主委托第三方核对，2026-10-24。** 按二十七宿法，十二个月初一依次为室、奎、胃、毕、参、鬼、张、角、氐、心、斗、虚，与仓库表完全一致；十二月初一确为虚宿。注意：卷上原表（「大唐月建圖」）的排版存在对位矛盾，又混有二十八宿的循环，原印本的物理排版错误目前无法确定，所以这张表与卷上表格不能直接等同，**数值以二十七宿法推算为准**。之前 deerpark 转录里看到的「七至十一月不一致」就来自这个排版问题 | **已核对**；单测锁定十二个月初一和「二月五日 → 毕」 |
| 三九秘法：距离 → 命 / 栄 / 衰 / 安 / 危 / 成 / 壊 / 友 / 親 / 業 / 胎 | d=0 命，9 業，18 胎，其余 `d % 9` 依次为栄衰安危成壊友親 | T1299「三九祕宿品」，以及 p.391b11 的例子：二月五日生者属毕宿，毕为命，觜为栄，参为衰……轸为業，女为胎 | **已核对**；单测按这个例子逐项锁定 |
| 闰月 | 按本月处理 | No. 1299 没有明文规定 | **仍未核验**：这是本站的约定。只有闰月出生的人，页面上才显示这条提示，事实标为 `unverified`（`leap_month_site_convention`）；其他人不再显示「规则未独立核验」 |

商业算命站的表格不作为依据。

## 3. 待站主决定

| # | 问题 | 建议 |
|---|---|---|
| S1 | 1988 年中国夏令时开始日：仓库 4 月 10 日，tzdata 4 月 17 日 | **已裁定（2026-10-24）**：沿用仓库的 4 月 10 日，大陆出生不跟 tzdata；已加单测锁定 |
| S2 | 宿曜月首宿表七至十一月的矛盾 | **已核对（2026-10-24）**：站主委托第三方依据大正藏 T1299 核对，月首宿与三九映射与仓库一致，原表排版存在对位矛盾，数值按二十七宿法确认；闰月仍未核验 |
| S3 | astronomy-engine 的 MIT 声明没有随构建产物分发 | **已修（2026-10-24）**：加了 `postBanner`，并随构建分发 `THIRD_PARTY_NOTICES.md` |
