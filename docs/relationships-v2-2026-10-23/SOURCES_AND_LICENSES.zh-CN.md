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

结论：**宿曜维持 `unverified`**。页面继续显示「规则未独立核验」，量表不计分。

| 表 | 仓库现状 | 找到的来源 | 结果 |
|---|---|---|---|
| 三九秘法：距离 → 命 / 栄 / 衰 / 安 / 危 / 成 / 壊 / 友 / 親 / 業 / 胎 | `xiu.js`：d=0 命，9 業，18 胎，其余 `d % 9` 依次为栄衰安危成壊友親 | 《文殊師利菩薩及諸仙所說吉凶時日善惡宿曜經》（大正藏 T21 No.1299）卷上「三九祕宿品」：一九命宿、二九業宿、三九胎宿起头，各接栄衰安危成壊友親；经文自带例子「二月五日生者，其人屬畢宿」，觜为栄、参为衰……轸为業、女为胎。经由 [deerpark.app 的 T1299 卷1](https://deerpark.app/reader/T1299/1) 和 [维基文库](https://zh.wikisource.org/zh-hant/%E6%96%87%E6%AE%8A%E5%B8%AB%E5%88%A9%E8%8F%A9%E8%96%A9%E5%8F%8A%E8%AB%B8%E4%BB%99%E6%89%80%E8%AA%AA%E5%90%89%E5%87%B6%E6%99%82%E6%97%A5%E5%96%84%E6%83%A1%E5%AE%BF%E6%9B%9C%E7%B6%93) 读取 | 用仓库算法复算这个例子：畢 +1 觜栄、+2 参衰、+9 轸業、+18 女胎，**全部一致**。不过只核对了这一个例子，没有逐表核对 |
| 月首宿（每个农历月初一的宿） | 正月室、二月奎、三月胃、四月畢、五月参、六月鬼、七月張、八月角、九月氐、十月心、十一月斗、十二月虚 | ① 经文例子「二月五日 → 畢」与「二月奎」相符。② 现代日文二手资料（如 [senjutsu.jp](https://www.senjutsu.jp/labo/shukuyou-uranai/labo_etc01)）给出的表与仓库**完全一致**，但它不是独立的原始来源。③ 经文「大唐月建圖」在 deerpark 的转录里，一日一栏是「虛室奎胃畢參鬼星翼角氐心」，表头是正月到十二月 | **有矛盾，不能核验**：按表头顺序读，正月为虚、二月为室，与经文自己的「二月五日畢」例子冲突；按与例子相符的读法（第一栏为十二月），七月到十一月会是星、翼、角、氐、心，与仓库的張、角、氐、心、斗不同。转录排版可能有错位，需要有人对照大正藏原版影像或 CBETA 原表 |
| 闰月 | 按本月处理 | 没有找到经文依据 | 仍是约定，未核验 |

没有编造来源。商业算命站的表格只作为「现代通行做法」记录，不算独立核验。

## 3. 待站主决定

| # | 问题 | 建议 |
|---|---|---|
| S1 | 1988 年中国夏令时开始日：仓库 4 月 10 日，tzdata 4 月 17 日 | **已裁定（2026-10-24）**：沿用仓库的 4 月 10 日，大陆出生不跟 tzdata；已加单测锁定 |
| S2 | 宿曜月首宿表七至十一月的矛盾 | 站主裁定（2026-10-24）：保持 unverified，站主自己找第三方核对；代码不改 |
| S3 | astronomy-engine 的 MIT 声明没有随构建产物分发 | **已修（2026-10-24）**：加了 `postBanner`，并随构建分发 `THIRD_PARTY_NOTICES.md` |
