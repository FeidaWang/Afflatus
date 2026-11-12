# Worlds & Universe — implementation handoff / 实施交接

## Scope / 范围

Redesign of `/en/worlds.html` and `/zh/worlds.html`, combining Worlds presentation with a curated exploration of League of Legends Universe. The catalogue contains **13 regions, 18 champions, 8 stories, 7 skin themes and 10 gallery works**.

重设计中英文 Worlds 页面，将全球总决赛视觉与《英雄联盟：宇宙》的精选内容结合。内容包括 **13 个区域、18 位英雄、8 篇故事、7 个皮肤主题和 10 幅画廊作品**。

Genuine Riot artwork, fonts and interface assets are included locally. Three optional region videos cover Demacia, Ionia and Noxus. Bilingual summaries and detail paragraphs are original editorial introductions; each story links to its full official publication. Spirit Blossom is classified as **Runeterra folklore**, separately from alternate universes.

真实 Riot 原画、字体与界面素材已包含在本地资源中；德玛西亚、艾欧尼亚和诺克萨斯提供可选区域视频。中英摘要与详情是重新撰写的导读，每篇故事均提供官方完整原作链接。灵魂莲华归类为**符文之地民俗**，与平行宇宙区分。

Existing tournament cards, stage navigation, odds, MVP, Swiss standings and champion meta remain available alongside the Universe experience.

原有赛事卡片、阶段导航、赔率、MVP、瑞士轮积分及英雄环境内容，继续与宇宙探索功能一同提供。

## Apply the delivery / 应用交付包

Base commit / 基准提交：`9928bb7784fba3c7ef5988bae37258ed9eba5524`

The delivery archive includes the complete changed code and local assets, plus a **binary Git patch**. Apply that patch in a clean checkout of the base commit. Replace `/path/to/the-included.patch` below with the actual patch path from the archive.

交付压缩包包含完整改动代码、本地素材及 **Git 二进制补丁**。请在上述基准提交的干净工作目录中应用；将下方占位路径替换为包内实际补丁路径。

```bash
git status --short
git rev-parse HEAD
git apply --check /path/to/the-included.patch
git apply /path/to/the-included.patch
```

The first command should show a clean working tree, and `HEAD` should match the base above. Resolve any patch-check failure before applying; a different checkout may require integration work.

首条命令应显示工作目录干净，`HEAD` 应与基准一致。先解决补丁检查失败的问题再应用；不同版本的工作树可能需要额外整合。

## Install, build and preview / 安装、构建与预览

Use the existing repository's runtime prerequisites, then run from its root:

沿用现有仓库要求的运行环境，在仓库根目录执行：

```bash
npm ci
npm run build
npm run preview
```

Use the preview server address printed in the terminal and open `/en/worlds.html` or `/zh/worlds.html`. Localized routes are produced by the build/localization pipeline.

使用终端显示的预览服务地址，分别打开 `/en/worlds.html` 与 `/zh/worlds.html`。语言目录由构建与本地化流程生成。

For development / 开发时：

```bash
npm run dev
```

Open **`/worlds.html`** on the Vite development server. Verify both localized paths and language switching against the built preview.

在 Vite 开发服务中打开 **`/worlds.html`**；中英文路径与语言切换应在构建后的预览服务中检查。

## File ownership / 文件职责

| File / 文件 | Responsibility / 职责 |
|---|---|
| `public/worlds-universe/content.json` | Bilingual catalogue, stable IDs, relationships and source links / 双语内容、稳定 ID、角色关系与来源链接 |
| `public/worlds-universe/assets/` | Local artwork, thumbnails, fonts, icons and videos / 本地原画、缩略图、字体、图标与视频 |
| `public/worlds-universe/assets-manifest.json` | Asset provenance, original-source hashes and file metadata / 素材来源、原始资源哈希与文件元数据 |
| `src/lib/worldsUniverseTemplates.js` | Shared markup renderer for static generation and browser interactions / 静态生成与浏览器共用的标记渲染器 |
| `src/pages/worldsUniverse.js` | Search, filters, selectors, detail dialogs, gallery and navigation state / 搜索、筛选、选择器、详情弹层、画廊与导航状态 |
| `scripts/build-worlds-universe.mjs` | Generates the Universe section inside `worlds.html` / 生成入口页中的宇宙内容区 |
| `public/styles/worlds-universe.css` | Scoped design tokens, layouts and responsive presentation / 限定作用域的设计变量、布局与响应式样式 |
| `src/lib/validateWorldsUniverse.js` | Catalogue and asset-manifest publication validation / 内容与资产清单发布校验 |
| `scripts/validate-data.mjs` | Registers both Universe JSON files in `data:check` / 将两个 Universe JSON 文件接入数据检查 |
| `src/pages/worlds.js`, `public/worlds-data.json` | Existing tournament interaction and data / 原有赛事交互与数据 |
| `worlds.html`, `public/topics-index.json`, `public/assets/og/worlds-*.jpg` | Page metadata, discovery summaries and social artwork / 页面元数据、站点索引摘要与分享图片 |

## Editing safely / 维护方式

1. **Content:** edit `content.json`. Preserve IDs used by links such as `#region/ionia` and `#champion/ahri`. Provide both `en` and `zh` for names/titles, summaries and the two-paragraph `detail` arrays. Region references must resolve to a listed region.
   **内容：**编辑 `content.json`，保留详情链接依赖的 ID；名称或标题、摘要与两段详情均须提供中英文，区域引用须指向已有区域。

2. **Story links:** maintain `sourceLinks` as an array with `{ "locale": "en" | "zh", "url": "https://…" }` entries. Keep the documented fallback to the verified English publication where a usable Chinese original is unavailable.
   **原作链接：**沿用带 `locale` 与 `url` 的 `sourceLinks` 数组结构；没有可用中文原作时，保留已核实的英文来源与相关说明。

3. **Assets:** rendered media paths belong under `/worlds-universe/assets/`. Add provenance to the manifest when changing images, including an official HTTPS source, source SHA-256, dimensions and byte size where applicable. Manifest file paths use `assets/…`; `failed` must remain empty.
   **素材：**页面资源使用本地路径；替换图片时同步官方 HTTPS 来源、原始资源 SHA-256 及适用的尺寸和大小。清单路径使用 `assets/…`，下载失败列表必须为空。

4. **Templates:** change the shared renderer, then regenerate. The content between `<!-- worlds-universe:start -->` and `<!-- worlds-universe:end -->` is generated and will be replaced. The `prebuild` hook runs this generator automatically.
   **模板：**修改共用渲染器后重新生成；入口页两条标记之间的内容会被覆盖。完整构建的前置步骤会自动运行生成器。

5. **Styles:** keep changes scoped to `.worlds-body--universe` and the Universe components. Main color and typography variables are declared at the top of `worlds-universe.css`.
   **样式：**在页面作用域与宇宙组件范围内调整；主要配色和字体变量位于样式文件顶部。

```bash
npm run worlds:content
npm run data:check
npm test -- tests/validateWorldsUniverse.test.js
npm run build
```

The validator checks bilingual coverage, two-paragraph details, unique IDs, regional relationships, local media paths, traversal prevention, official source domains, story-language links and Spirit Blossom classification. Asset validation also checks source-hash format and publication readiness.

校验覆盖双语完整性、两段详情、唯一 ID、区域关系、本地资源路径、路径穿越防护、官方来源域名、故事语言链接及灵魂莲华分类；资产清单另检查来源哈希格式与可发布状态。

## Sources / 主要来源

- [League of Legends Universe](https://universe.leagueoflegends.com/en_GB/)
- [Official region index / 官方区域索引](https://universe-meeps.leagueoflegends.com/v1/en_us/faction-browse/index.json)
- [Official champion index / 官方英雄索引](https://universe-meeps.leagueoflegends.com/v1/en_us/champion-browse/index.json)
- [Data Dragon documentation / 官方数据与素材说明](https://developer.riotgames.com/docs/lol#data-dragon)
- [Crafting Spirit Blossom / 灵魂莲华分类依据](https://www.leagueoflegends.com/en-gb/news/dev/crafting-spirit-blossom/)
- [Official Worlds artwork / 官方世界赛原画](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/a57a2226c2721c242aaf53c771ad13d4e505962f-1920x1080.jpg)

Individual story and artwork sources remain in the catalogue and manifest. This is a fan project; Riot retains ownership of its artwork and characters, and the site does not imply official endorsement.

每篇故事与每项素材的具体来源保留在内容文件和清单中。本项目为粉丝制作，Riot 保有相关原画与角色的权利，页面不代表官方背书。

## Verification and delivery status / 验证与交付状态

At handoff, **68 targeted tests passed and the full production build passed**. These results describe the verification performed for this change.

交接时，**68 项针对性测试及完整生产构建均已通过**。该结果对应本次改动的验证范围。

The implementation is delivered as code, assets and a patch. The GitHub integration returned **403 — Resource not accessible by integration** during the attempted write. **No remote repository changes, pull request or production publication were made.**

本次以代码、素材与补丁交付。尝试写入时，GitHub 集成返回 **403 — Resource not accessible by integration**；**远程仓库未被修改，未创建 PR，也未发布生产站点。**

## Local integration / 本地集成

The local integration regenerates the Worlds sitemap dates and topics index with `npm run site:generate`. The [original delivery QA](docs/worlds-universe/design-qa.md) is preserved alongside this handoff.

本地集成使用 `npm run site:generate` 同步了 Worlds 的站点地图日期和主题索引。[原交付验收记录](docs/worlds-universe/design-qa.md)随本说明保留。

On 2026-11-12, the production build, 68 focused tests, and all 15 existing Worlds browser regression tests passed. Local preview checks also covered bilingual search, same-entry language switching, the related-story link, and keyboard navigation in the artwork viewer.

2026 年 11 月 12 日，生产构建、68 项相关测试及 15 项原有 Worlds 浏览器回归测试均通过。本地预览还验证了双语搜索、详情切换语言、关联故事跳转及原画键盘导航。
