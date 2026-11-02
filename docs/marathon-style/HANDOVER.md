# Marathon 风格页面研究 · 交接说明

最后更新：2026-11-02 · 分支 `claude/tender-hopper-3i6r34`（已推送到 origin）

## 1. 这是什么

为 Afflatus 站点规划一个"Marathon（Bungie，2026-03-05 发售）风格"的高动效实验页。第一阶段是纯研究：搜集官方与社区的视觉 / 动效 / UI / 音频参考，并产出按优先级排序的模块化路线图。**尚未写任何页面代码。**

## 2. 仓库里已有的产出

| 文件 | 内容 |
| --- | --- |
| `docs/marathon-style/roadmap.md` | 主交付物。风格 DNA、Afflatus 门禁约束、15 个 P0→P2 模块（目标 / 参照 / 技术与库 / 护栏 / 验收 / 依赖）、素材清单、未核实项表、第二轮核实结果、版权指引。约 105 条带 URL 引用。 |
| `docs/marathon-style/research/01_official_sources.md` | 官方术语（Graphic Realism）、影响源、团队发言人、press kit、发售信息、视频时间线。 |
| `docs/marathon-style/research/02_concept_art_artists.md` | 用户指定的 7 位艺术家 / 工作室 + 其他贡献者的 ArtStation / Behance 作品目录，视觉规则，粉丝 hex 色板。 |
| `docs/marathon-style/research/03_ui_ux_motion.md` | 字体体系、HUD / 菜单结构、19 条动效模式、预告片动效团队（Antibody、EDGLRD、Mielgo）、粉丝 UI 重制。 |
| `docs/marathon-style/research/04_screenshots_vfx.md` | 截图来源清单、30 条游戏内效果目录、区域名称、渲染技术线索。 |
| `docs/marathon-style/research/05_music_audio.md` | Ryan Lott / Chase Combs、OST 两卷、预告片用曲、合法替代音源、音频可视化开源实现。 |
| `docs/marathon-style/research/06_web_implementation.md` | 16 类网页技术（CSS 版 vs WebGL 版）、库体积与许可证、性能 / 无障碍护栏、获奖站参考。 |
| `docs/marathon-style/research/07_afflatus_site_audit.md` | 本站技术栈、prebuild 门禁、设计 token、可复用的 WebGL / 音频代码、Lighthouse / axe 阈值、新页面落位建议与 11 步登记清单。 |
| `docs/marathon-style/research/08_followup_gaps.md` | 第二轮补缺：字体厂商、官方视频 ID、OST 流媒体、Reddit、库版本等。 |

## 3. 已确认的关键结论（可直接依赖）

- 官方风格术语 **Graphic Realism**（Joseph Cross，2023-05-30 X 线程）；Art Blast 概括 "clean geometric forms, strong compositions, stark color accents"；Runner 被形容为 "Nike meets Teenage Engineering"。官方来源未提 Dieter Rams / Y2K。
- 字体：KH Interference（KH Type）、定制 Shapiro Wide 65（OGJ Type Design）、IvyPresto Headline（The Ivy Foundry，仅游戏内）、Fraktion Mono（Pangram Pangram）。均为商业字体。
- 音频：Ryan Lott（Son Lux）配乐，Chase Combs 音频总监，OST 两卷 42 首（Milan Records）；2023 预告用 Justice "Heavy Metal (SebastiAn Remix)"。
- 本站门禁当前全绿（vitest 1709 通过；prebuild 全部 OK）。被删除的 `renderBudgetCoordinator.js` / `webglLifecycle.js` / `src/scene/*` 可从提交 `d9d4fc4`、`9da3af9` 恢复。
- 路线图结论：CSS 优先，GPU 效果用 OGL（≤29 kB），Three.js 仅作可选；所有动效在 `prefers-reduced-motion: reduce` 下退化为静态。

## 4. 研究方法上的硬伤（新会话必须补的）

云端会话的网络策略拒绝了几乎所有外部域名的直接抓取（仅 github.com / npm 可用），所以**绝大多数游戏相关事实来自搜索引擎摘要，没有打开过页面正文**。`roadmap.md` 的"来源可信度与未核实项"一节列出了约 18 条需复核的事项。影响最大的几条：

1. **官网 marathonthegame.com 一条都没看过**：布局、配色、动效、loader、hover、滚动、视频 / WebGL 背景、页面过渡、`@font-face`、加载的 JS 库。
2. **色板没有官方 hex**，只有两个粉丝主题（Omarchy：#C2FE0B / #080A0E / #E8EDDF / #EA027E / #3601FB / #01FFFF / #FF5500；Republic：#DCFF00 / #0A0A0A / #E8E2D2 / #4AC4F8）。需要从官方素材取样校色。
3. **游戏内动效参数全部缺失**：硬切还是缓动、时长、logo / 标题动画、Runner 选择、护盾破碎着色、路标淡出。需要看视频并记时间戳。
4. 「文字 scramble / ticker / 涂黑条 / 声音响应 UI」是否真的存在于游戏中，无来源。
5. ArtStation 单页（Kwan "Assault Commander"、Goryainov 图形设计系统、Bloom "Marsh Props"、Karakter 条目归属）、daniolart.com、Behance 项目描述与日期均未打开。
6. Steam 社区截图 ToS、press.bungie.com 资产清单与使用条款未读取。
7. 2025-04-12 玩法揭晓预告与 ViDoc 配乐、OST Vol. I 第 7–24 首顺序、Spotify 专辑页。
8. Codrops / CodePen / Awwwards 等教程与案例正文未打开；GSAP / Lenis / OGL 的官方体积数字未核。

## 5. 本地资料夹

用户在 Mac 上有 `/Users/feida/Downloads/Marathon_Reference`（内容未知：可能是截图、视频、设定集 PDF、音频）。云端会话无法访问。新会话应先盘点该文件夹，把其中内容按"截图 / 视频 / 文档 / 音频 / 其他"分类编目，再用它校正色板、字体、动效时间与素材清单。

## 6. 版权红线

- 不把官方截图、预告片帧、OST 音频、字体文件提交进仓库或嵌入页面；页面用原创同风格素材。
- YouTube 只能以可见播放器嵌入（不自动播放、单实例、≥200×200）。
- `Marathon_Reference` 里的文件只作本地参考，**不要 `git add`**；如需在文档里引用，写文件名与观察结论，不复制图像。
- Bungie 曾承认 alpha 中误用 Antireal 的海报设计（Fern Hook 事件），"致敬"也要保持可辨识的距离。

## 7. 新会话的交付物

1. `docs/marathon-style/research/09_local_reference_inventory.md`：本地资料夹编目与观察结论。
2. `docs/marathon-style/research/10_live_verification.md`：逐条复核第 4 节的事项，标注【已核实 / 已修正 / 仍未知】并附 URL 与视频时间戳。
3. 更新 `docs/marathon-style/roadmap.md`：修正风格 DNA、M1 色板初值、M2 字体替代、M5–M9 动效参数、素材清单；把"未核实项"表改为复核后的状态。
4. 新分支提交并推送（不要继续用 `claude/tender-hopper-3i6r34`，它对应本次云端研究）。提交前跑 `npm run prebuild` 与 `npx vitest run`，不要把生成的 `public/en/`、`public/zh/` 提交进去。

## 8. 给新本地会话的提示词

见本文件末尾的代码块，可整段复制。

```text
你在我的本地仓库 Afflatus 里工作（Vite 多页静态站）。请先读 docs/marathon-style/HANDOVER.md，再读 docs/marathon-style/roadmap.md，然后读 docs/marathon-style/research/ 下的 8 份笔记（重点看每份末尾的 Gaps）。这些是上一轮云端研究的产出，云端环境无法打开外部网页，所以几乎所有游戏相关事实都只来自搜索摘要，需要你用真实网页访问重新核实。

任务目标：为 Afflatus 规划一个 Bungie《Marathon》（失落星船：马拉松）风格的高动效页面。这一阶段仍是研究与修订路线图，不要写页面代码。

请按顺序完成：

1. 盘点本地资料夹 /Users/feida/Downloads/Marathon_Reference。按截图 / 视频 / 文档（PDF、设定集）/ 音频 / 其他分类编目，写进 docs/marathon-style/research/09_local_reference_inventory.md。对截图和视频，记录可观察到的：色块与强调色（用取色工具估 hex）、字体角色与层级、HUD 元素布局、动效类型与时长（硬切 / 缓动 / glitch / 扫描线 / 色散）、区域调色（Perimeter、Dire Marsh、Outpost、Cryo Archive、Night Marsh）。只写观察结论和文件名，不要把这些文件 git add 进仓库。

2. 打开真实网页复核 HANDOVER.md 第 4 节的 8 类事项，结果写进 docs/marathon-style/research/10_live_verification.md，每条标注【已核实 / 已修正 / 仍未知】并附 URL；视频类附 YouTube 链接与时间戳。优先级：
   a. https://www.marathonthegame.com 的实际设计与实现：抓页面源码，列出 <link rel="stylesheet">、@font-face、<script src>、<video>、<canvas>，描述布局、配色、loader、hover、滚动行为、页面过渡。
   b. 官方视频里的动效参数：Gameplay Reveal Trailer（X8z0WsYKm2k）、Launch Gameplay Trailer（f5TcwVlHnKU）、Launch Cinematic（KF24WS4MMC0）、Season 2 预告（HmSS0NI94Ro）、ViDoc（fjzmhROTv28）。记录 logo / 标题动画、Runner 选择、护盾破碎着色、路标淡出、加载循环等的时间戳与节奏。
   c. 从 press.bungie.com/Marathon、ArtStation "Bungie Marathon Art Blast"（magazine.artstation.com/2026/06/bungie-marathon-art-blast/）与 Fonts In Use（fontsinuse.com/uses/67879）取样色板、确认字体，并阅读 press kit 使用条款与 Steam 社区截图 ToS。
   d. 逐一打开笔记 02 里的 ArtStation / Behance 链接（Patrick Bloom、Tobias Kwan、Dima Goryainov、Sigurd Fernstrom、Karakter、West Studio、daniolart.com）补齐单页标题、日期、归属与描述。
   e. 确认「文字 scramble / ticker / 涂黑条 / 声音响应 UI」是否真的出现在游戏中；若没有，在路线图 M6 保留"风格推演"标注。
   f. 补 OST Vol. I 第 7–24 首顺序、Spotify 专辑页、玩法揭晓预告与 ViDoc 的配乐。
   g. 打开 Codrops / CodePen / gsap.com / lenis / ogl 的页面核对教程细节与官方体积数字。

3. 根据 1 和 2 修订 docs/marathon-style/roadmap.md：更新风格 DNA、M1 色板初值（给出校色后的 hex 与依据）、M2 字体与免费替代、M5–M9 的动效参数与参照时间戳、素材清单；把"来源可信度与未核实项"表改写为复核后的状态。保持模块编号与 P0/P1/P2 结构不变。

约束：
- 不要参考记忆，一切以打开的页面与本地文件为准，不能核实的明确标注。
- 不把任何官方截图、视频帧、音频、字体文件提交进仓库；YouTube 只能作为可见播放器嵌入。
- 从 main 新建分支（例如 claude/marathon-style-local-verify），不要用 claude/tender-hopper-3i6r34。
- 提交前运行 npm run prebuild 与 npx vitest run，确认全绿；不要提交 prebuild 生成的 public/en/ 与 public/zh/。
- 完成后给我一段中文摘要：哪些事项被修正、色板与字体的最终建议、下一步可以开始写哪个 P0 模块。
```
