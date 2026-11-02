# Marathon (Bungie, 2026) UI/UX、HUD、菜单与动态图形设计调研

> 方法与限制说明（必读）：本笔记全部来自 2026-11-02 当天的实时 WebSearch 结果。本会话的网络策略屏蔽了对所有外部域名的直接抓取（WebFetch / curl 对 fontsinuse.com、bungie.net、youtube.com、behance.net、gameuidatabase.com、reddit.com、stashmedia.tv、creativebloq.com、80.lv 等均返回 ENOTFOUND / 403），因此**所有内容均基于搜索引擎返回的页面摘要，没有任何页面被完整打开核对**。凡标注「未核实」者，表示仅见于搜索摘要或仅有链接而无法确认页面内容。YouTube 视频时间戳一律无法核实，故未给出。搜索配额在最后一轮用尽，若干补充查询（Polygon 原文、Brian Vinton 访谈原文、YouTube 教程、Reddit 改版 mockup 原帖等）未能执行，列入各节 Gaps。

---

## 问题 1：最好的 UI 截图/影像集合在哪里？（Game UI Database、Interface In Game、Reddit、YouTube 等）

### Takeaway
在本次检索中**没有找到** Game UI Database 或 Interface In Game 收录 Marathon (2026) 的任何页面（两个站点均无法直接访问，搜索也无命中）。目前可确认的影像资料集中在：官方 ArtStation Art Blast、Bungie.net 补丁说明、Steam 社区讨论、help.marathonthegame.com 社区帖、Threads 上的 HUD 图标解读帖、Fandom/CyberAcme wiki 的媒体页，以及 Antibody 预告片的 Vimeo 页面与 Michael Rigley 的 Behance 项目页。

### Cited Findings
- 在 `site:gameuidatabase.com` 与「"Game UI Database" Marathon Bungie」两次查询中均无任何 gameuidatabase.com 结果；直接访问 https://www.gameuidatabase.com/ 被本会话网络策略拒绝（403）。**无法核实该库是否收录** — [搜索结果（无命中）](https://www.gameuidatabase.com/)
- 「interfaceingame Marathon Bungie」查询无任何 interfaceingame.com 命中；https://interfaceingame.com/ 同样无法访问。**无法核实** — [搜索结果（无命中）](https://interfaceingame.com/)
- 官方概念图大全：ArtStation Magazine 于 2026-06-18 发布「Bungie Marathon Art Blast」，收录 60 余位艺术家的环境、角色、机甲概念图，并写道「Graphic design became one of our most powerful worldbuilding tools（平面设计成为我们最强大的世界观构建工具之一）」 — [ArtStation Magazine](https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/)；[X 趋势页](https://x.com/i/trending/2068102225327427709)
- ArtStation 上有 Bungie 官方「Marathon - engine」作品页，摘要称其列出了 concept 与 graphic designers（具体名单未核实） — [ArtStation](https://www.artstation.com/artwork/KR639X)
- HUD 图标解读帖（Threads，用户 @goofstha）：护盾颜色代表护盾板数量：Grey=1、Green=2、Blue=3、Purple=4；护盾板破损显示裂纹图标；自身护盾耗尽时**整屏染上护盾颜色** — [Threads](https://www.threads.com/@goofstha/post/DVpL0KLET0H/understanding-the-hud-ui-icons-in-marathon-before-i-start-shield-colors-show?hl=en)
- Fandom wiki 的 Marathon (2026) 页面有媒体区，列出 ARG 图像与预告片 — [Fandom](https://marathongame.fandom.com/wiki/Marathon_(2026))；另有社区 wiki「CyberAcme」 — [marathonwiki.com](https://www.marathonwiki.com/Marathon_(2026))
- PCGamingWiki 记录：加载画面与过场为 pillarboxed（左右黑边） — [PCGamingWiki](https://www.pcgamingwiki.com/wiki/Marathon_(2026))
- Steam 社区关于加载画面（飞蛾）的讨论帖，含玩家对画面的描述 — [Steam 讨论 1](https://steamcommunity.com/app/3065800/discussions/0/561407203825801130/)；[Steam 讨论 2](https://steamcommunity.com/app/3065800/discussions/0/561407203825800556/)；[Steam 讨论：loading screens are unpleasant](https://steamcommunity.com/app/3065800/discussions/0/766311764554258134/)
- Bungie 官方帮助中心的社区区有多条 UI 相关帖（HUD 罗盘改进建议、HUD 消失、菜单闪烁等），是了解 HUD 构成的间接资料 — [How To INSTANTLY Improve The HUD Compass](https://help.marathonthegame.com/hc/en-us/community/posts/46776844545684-How-To-INSTANTLY-Improve-The-HUD-Compass)；[HUD MISSING COMPLETELY](https://help.marathonthegame.com/hc/en-us/community/posts/49569603488916-HUD-MISSING-COMPLETELY)
- 2023 公布预告片（Antibody 制作）的 Vimeo 页 — [Vimeo 830047787](https://vimeo.com/830047787)
- Antibody 预告片屏幕图形（GUI）设计师 Michael Rigley 的 Behance 项目页「MARATHON」，含 screen graphics 与 glitch 内容 — [Behance](https://www.behance.net/gallery/205038723/MARATHON)
- Stash 的 Marathon 标签页汇总了多条 Marathon 相关动态影像作品 — [Stash tag: marathon](https://www.stashmedia.tv/tag/marathon/)；[Stash tag: bungie](https://www.stashmedia.tv/tag/bungie)
- 2025-04-12 的 gameplay reveal 在 Bungie 的 Twitch、YouTube、TikTok 同步直播（官方 YouTube 视频直链未在搜索中出现） — [Game Informer](https://gameinformer.com/2025/04/07/bungies-marathon-gets-gameplay-reveal-this-weekend)；[mp1st](https://mp1st.com/news/bungies-marathon-release-date-set-for-september-23-gameplay-overview-and-closed-alpha-revealed)
- Bungie 发布过「Music of Marathon」开发者洞察视频（作曲 Ryan Lott、音频总监 Chase Combs）— [pulse.bot 转述](https://www.pulse.bot/gaming/news/bungie-shares-music-of-marathon-dev-insights-ahead-of-server-slam-next-week-ee62a768-e1a6-48d9-aed0-654322f2f293/)

### Inferences
- Marathon 的 UI 争议极大（见问题 5），因此新闻站（PC Gamer、Kotaku、GamesRadar、Creative Bloq）的报道页本身就嵌入了大量菜单截图与玩家视频，可作为「事实上的截图库」使用，但本次无法打开核对。
- 官方帮助中心的 bug 帖（闪烁黑条、Shell 菜单抖动、Runner Select 图像消失）反向揭示了菜单结构：存在 Vault、Armory、Shell/Customize 与 Runner 等 tab 页。

### Gaps
- Game UI Database、Interface In Game 是否收录 Marathon：无法核实（站点被屏蔽、搜索无命中）。
- Reddit r/Marathon 的 UI 截图/讨论帖：reddit.com 被屏蔽，搜索只返回第三方快照站（reddit.sentinel-team.org），其内容未核实。
- YouTube 菜单 walkthrough 视频：youtube.com 被屏蔽；搜索未返回任何可确认的菜单演示视频链接。

---

## 问题 2：使用了哪些字体（或高度疑似）？设计师提议的免费替代品？

### Takeaway
Fonts In Use 的条目给出了目前唯一具名的字体识别：主标题/展示字体为 **KH Interference**（KH Type / Kurppa Hosk 出品，Regular 与 Light 字重），第二标题字体为定制版 **Shapiro Wide 65**，第三标题字体 **IvyPresto Headline Regular** 仅用于游戏内。标志字体有免费复刻版 **Durandal Grotesque**（KryDotExe，仅限个人使用）。

### Cited Findings
- Fonts In Use 条目「Marathon (2026 video game)」：KH Interference 是 Marathon 的主要标题与展示字体，使用 Regular 与 Light 字重；第二标题字体是 Shapiro Wide 65 的定制版本；第三标题字体 IvyPresto Headline Regular 仅在游戏内使用 — [Fonts In Use](https://fontsinuse.com/uses/67879/marathon-2026-video-game-1)
- Fonts In Use 的 KH Interference 字体页列出该游戏同时使用 KH Interference、Shapiro、IvyPresto（字体页只写「Shapiro」，未写「Wide」） — [Fonts In Use: KH Interference in use](https://fontsinuse.com/typefaces/241490/kh-interference)
- KH Interference 由 Jakob Ekelund、Thomas Kurppa、Wille Larsson 设计，2022 年发布 — [Fonts In Use: KH Type](https://fontsinuse.com/foundry/5180/kh-type)
- KH Type 是瑞典品牌代理 Kurppa Hosk 的字体公司；KH Interference 是受收据打印与低分辨率像素字启发的等宽展示字体，有三个字重；一处来源称其仅有大写 — [khtype.com](https://khtype.com/typeface/kh-interference/)；[slanted](https://www.slanted.de/kh-type/)；[Creative Boom](https://www.creativeboom.com/news/kh-type/)
- Durandal Grotesque：免费复刻 Bungie「202X Marathon」标志所用字形的字体，以游戏 AI 角色 Durandal 命名，作者 KryDotExe，许可为 personal use、要求署名 — [designbeep](https://designbeep.com/2026/03/14/durandal-grotesque-font/)
- 注意勿与 Aerotype 的商业字体「Durandal」（Stephen Miggas 设计）混淆 — [MyFonts](https://www.myfonts.com/fonts/aerotype/durandal)
- 1994 原作标志字体为 Modula Tall；Luc Devroye 字体页称 Modula Tall 没有免费替代品；Tim Larson 的免费字体 Marapfhont 受原作标志启发 — [Luc Devroye](https://luc.devroye.org/fonts-67666.html)
- 粉丝站 marathon.bungie.org 评论：新 logo 字体「更接近原版 Marathon 字体 Modula Tall」 — [marathon.bungie.org](https://marathon.bungie.org/story/newoct24.html)
- 游戏 UI 的「fontslop」批评：病毒式帖子称一个菜单页上有「20 种不同的字体、粗细、字号、间距组合」 — [GamesRadar](https://www.gamesradar.com/games/fps/the-first-ever-fontslop-game-marathon-players-are-already-sick-of-looking-at-the-upcoming-bungie-shooters-eye-sore-ui)
- 设计师批评文：UI「大量混用字体、字号、字重与装饰处理，彼此争夺注意力而非组织信息」 — [josephkerrdesign.com](https://josephkerrdesign.com/bungies-overdesigned-uis-what-marathon-gets-wrong/)
- GamesRadar 另一篇以「What font is that?」为题谈 Bungie 的 maximalist UI；另一篇标题提到「fluorescent characters and ascii text（荧光色角色与 ASCII 文本）」是 90 年代怀旧的大师课 — [inkl 转载](https://www.inkl.com/news/with-its-fluorescent-characters-and-ascii-text-marathon-is-a-masterclass-in-90s-nostalgia)
- 「What Font Does Bungie Use?」类 SEO 页称 Bungie 字标为定制字形、无统一字体，不针对 Marathon，可信度低 — [madegooddesigns](https://madegooddesigns.com/?p=9043)

### Inferences
- 复现 Marathon 字体系统的三层结构：等宽/像素感大写展示字（KH Interference）+ 超宽无衬线（Shapiro Wide）+ 高反差衬线展示字（IvyPresto Headline）。三者刻意冲突，正是「fontslop」争议的来源，也是其识别度所在。
- 免费近似方案（**仅为推断，无来源提出**）：等宽展示字可用开源等宽字体并全大写；超宽无衬线与高反差衬线需自行寻找开源替代。Durandal Grotesque 仅可用于标志复刻且限个人使用。
- Shapiro 与 IvyPresto 的字体公司在本次检索中未出现，相关归属**未核实**。

### Gaps
- Fonts In Use 条目的贡献者、识别日期、Shapiro Wide 65 的「定制」具体改动：页面被屏蔽，未核实。
- 官方网站 marathonthegame.com 加载的 woff/woff2 字体文件：站点被屏蔽，无法检查。
- Reddit r/identifythisfont 的识别帖：未找到。
- 正文/HUD 小字所用字体：无任何来源提及。
- Typewolf 条目：未找到。

---

## 问题 3：出现了哪些具体的动态/交互模式？（≥10 条，附观看位置）

### Takeaway
由于无法打开视频站，**所有时间戳均无法给出**；下列模式均来自文字来源（官方补丁说明、开发者访谈转述、bug 帖、玩家描述、制作方项目页）。能确认的模式包括：预告片的 glitch + 色块背景、循环的「sense-memory」飞蛾加载动画、匹配加载画面的持续闪烁、护盾破碎时整屏染色、ADS 时路点淡出、径向菜单、客制化菜单的动画背景层、整体「glitchy, unsettling（故障感、不安）」的 UI 影像等。

### Cited Findings
1. **Glitch 内容 + 色块（color blocking）背景**：Michael Rigley 为 2023 公布预告片开发 screen graphics 与 glitch content，并为「color blocking and glitch effects」制定了风格化方案，作为动画的背景 — [Behance: MARATHON](https://www.behance.net/gallery/205038723/MARATHON)；观看：[Vimeo 830047787](https://vimeo.com/830047787)
2. **循环「sense-memory」飞蛾加载动画**：创意总监 Julia Nardin 对 Polygon 表示，加载画面是一段循环的「sense-memory」人造梦境，用于在进入对局的过渡中聚焦 Runner 的意识；飞蛾象征死亡、转化与重生；该片段改编自 Antibody 制作的更长的开场动画 — [NewsBreak 转述](https://www.newsbreak.com/news/4524738151282-bungie-explains-marathon-s-creepy-moth-loading-screen)；[WutsHot 转述](https://www.wutshot.com/a/what-marathon-s-creepy-moth-loading-screen-means-according-to-bungie)
3. **匹配加载画面持续闪烁/频闪**：Steam 玩家称匹配加载画面「constant flashing」，长队列时令人分神；另有玩家在官方社区请求增加「减少闪烁/频闪」的无障碍选项 — [Steam 讨论](https://steamcommunity.com/app/3065800/discussions/0/766311764554258134/)；[Accessibility Request: Flashing/Strobing Load Screens](https://help.marathonthegame.com/hc/it/community/posts/47906627242132-Accessibility-Request-Flashing-Strobing-Load-Screens-Causing-Headaches)
4. **护盾状态的颜色编码与整屏染色**：护盾板数量以 Grey/Green/Blue/Purple 表示；板破损显示裂纹图标；自身护盾耗尽时整屏变为护盾颜色 — [Threads @goofstha](https://www.threads.com/@goofstha/post/DVpL0KLET0H/understanding-the-hud-ui-icons-in-marathon-before-i-start-shield-colors-show?hl=en)
5. **ADS（瞄准）时部分路点淡出**：Update 1.0.5 后，某些 waypoint 在瞄准时淡出；复活提示可读性改进 — [Notebookcheck](https://www.notebookcheck.net/Major-Marathon-update-1-0-5-adds-Cryo-Archive-downed-exfil-and-UI-tweaks.1253313.0.html)；[Bungie.net 1.0.5](https://www.bungie.net/7/en/News/Article/marathon_update_1_0_5)
6. **径向菜单（radial menu）**：1.0.6.1 对径向菜单做了底层调整，以减少误选并提高响应速度 — [FRVR 1.0.6.1 patch notes](https://frvr.com/blog/news/marathon-1-0-6-1-patch-notes/)
7. **多选物品 tile 的高亮**：1.1.5 让 multi-select item tiles 更醒目；Cryo Archive 中的 exfil 图标不再使用「guarded exfil」地图图标 — [Bungie.net 1.1.5](https://www.bungie.net/7/en/News/Article/marathon_update_1_1_5)
8. **客制化/Shell 菜单的动画背景层**：玩家 bug 帖提到「animated background layers」在所有客制化选项中闪烁或缺失，说明这些菜单默认带有动画背景 — [Flickering In Shell Menus](https://help.marathonthegame.com/hc/en-us/community/posts/49929305400596-Flickering-In-Shell-Menus)
9. **Runner Select 的 tab 切换**：Known Issues 列出「在 Customize 与 Runner tab 间快速切换时 Rook 图像可能消失」，说明 Runner 选择界面是 tab 式并带角色大图 — [Known Issues List](https://help.marathonthegame.com/hc/en-us/articles/46620187972756-Known-Issues-List)
10. **「press any key」启动屏与 Vault/Armory 菜单上的黑条闪烁**（PC bug，非设计意图，但揭示菜单清单） — [Flashing graphical glitch - only in specific menus](https://help.marathonthegame.com/hc/en-us/community/posts/50089158397844-Flashing-graphical-glitch-only-in-specific-menus)
11. **整体「glitchy, unsettling」影像**与鲜艳色彩的 UI 艺术风格，被 Creative Bloq 概括为「vibrant colours and glitchy UI design」 — [Creative Bloq](https://www.creativebloq.com/3d/video-game-design/fans-are-torn-over-the-vibrant-colours-and-glitchy-ui-art-style-of-bungies-new-marathon-game)
12. **队友以代码（如「A1」）而非名字标注**：评测称前端像「现代 AAA UI 的戏仿」，队友以「A1」等代码标记 — [FinalBoss](https://finalboss.io/after-a-weekend-with-bungies-marathon-i-see)
13. **多层文本框与字体叠加**：Kotaku 描述玩家在 Server Slam 期间争论「unintuitive menus, various layers of text boxes and fonts, and an inventory system」 — [Kotaku](https://kotaku.com/marathon-ui-fontslop-menus-bungie-2000675332)
14. **图标重绘**：1.0.6 为 cores、implants、chips 重做图标以便区分；1.1.0 统一 Reboot+ 目标图标并修订 Run Preparation 画面 — [Bungie.net 1.0.6](https://www.bungie.net/7/en/News/Article/marathon_update_106)；[Bungie.net 1.1.0](https://www.bungie.net/7/en/News/Article/marathon_update_1_1_0)
15. **控制器光标（cursor）导航**：主机版菜单使用光标，1.1.0 增加 controller cursor friction 设置 — [comicbook.com](https://comicbook.com/gaming/news/marathon-season-2-update-patch-notes/)；[FinalBoss](https://finalboss.io/after-a-weekend-with-bungies-marathon-i-see)
16. **加载/过场 pillarbox** — [PCGamingWiki](https://www.pcgamingwiki.com/wiki/Marathon_(2026))
17. **菜单深度**：ready-up 等功能藏在 5–6 层菜单之内（交互节奏特征） — [Mein-MMO](https://mein-mmo.de/en/marathon-wants-to-be-the-new-competitor-to-arc-raiders-but-players-complain-why-is-everything-hidden-5-6-menus-deep,1554307/)
18. **无障碍相关 UI 选项**：PlayStation 支持页列出 UI 画面的 colour mode、HUD opacity、UI subtitles — [PlayStation Support](https://www.playstation.com/en-au/support/games/marathon-support/)
19. **开场 PlayStation Studios 片头与游戏内 UI 元素的「wiggling/glitching」**（玩家报告为 bug，HDR 关闭可缓解；无法区分哪些为刻意设计） — [Wiggling, glitching UI Elements](https://help.marathonthegame.com/hc/en-us/community/posts/47131206561428-Wiggling-glitching-UI-Elements)

### Inferences
- 刻意的「故障感」在预告片端有明确制作方佐证（Rigley/Antibody）；在游戏内，闪烁、抖动类现象多出现在 bug 帖中，**无法从文字来源判定哪些是设计、哪些是缺陷**，网页复现时建议把 glitch 作为可关闭的装饰层（对应玩家对频闪的无障碍诉求）。
- 「sense-memory」循环短片作为加载态，是可直接移植到网页 loader 的概念：短循环影像 + 抽象叙事，而非进度条。
- 来源中**没有**任何一条确认存在「text decode/scramble 文字解码动画」「scrolling ticker 滚动字幕」「redacted bars 涂黑条」「sound-reactive UI 声音响应式界面」。这些若要在网页中使用，应标注为「风格推演」而非「原作复现」。

### Gaps
- 所有 YouTube 时间戳：无法核实（站点屏蔽）。
- 标题/logo 动画、Runner 选择动画的具体运动描述（硬切 vs 缓动、时长）：无任何文字来源描述。
- 文字解码/乱码动画、滚动 ticker、涂黑条、声音响应 UI：**未找到来源**，不能确认存在。
- 菜单过渡是硬切还是缓动：无来源。

---

## 问题 4：预告片/动态图形由谁制作？有无案例研究/拆解？

### Takeaway
不同片子由不同团队完成：2023 公布预告片与后续过场由 **Antibody**（Patrick Clair、Raoul Marks）制作，屏幕图形/故障内容由 **Michael Rigley** 负责（有 Behance 项目页）；发售 cinematic 音乐视频由 **EDGLRD**（Harmony Korine、Sam Goldwater）制作；reveal cinematic short 由 **Alberto Mielgo** 导演（Pinkman.TV、Agora、Illusorium）。目前**只有 Rigley 的 Behance 页**算得上接近「拆解」的公开资料，其余为 credits 列表。

### Cited Findings
- **2023 公布预告片（Antibody）**：导演 Patrick Clair、Raoul Marks；飞船 Paul Chadeisson；GUIs Michael Rigley；分镜 Lance Slaton；剪辑 Arielle Zakowski；音乐 Justice「Heavy Metal」由 SebastiAn 重混 — [Stash](https://www.stashmedia.tv/antibody-bungie-marathon-announcement-trailer/)；[Vimeo](https://vimeo.com/830047787)；[GEMA/Promax 简报（2023-06-25）](https://gema.org/brief/antibody-brings-talent-to-marathon-game-trailer)；[Promax 旧站](https://oldbrief.promax.org/article/antibody-brings-talent-to-marathon-game-trailer)
- 音乐制作方 The Elements 的项目页记录了与 SebastiAn 和 Justice 合作重制「Heavy Metal」 — [The Elements Music](https://www.theelementsmusic.com/projects/marathon-official-announcement-trailer)
- Clair 称挑战在于「把一款极具辨识度的游戏浓缩成一部短片」；Stash 评价该片「dial up the style and pace」 — [Stash](https://www.stashmedia.tv/antibody-bungie-marathon-announcement-trailer/)
- **Michael Rigley（GUI 设计师）**：Behance 项目页说明 2023 年与 Antibody 合作，负责公布预告片的 screen graphics 与 glitch content，并制定色块与故障效果的风格化方案；个人简介为 Emmy 获奖艺术指导/设计师，洛杉矶 — [Behance 项目](https://www.behance.net/gallery/205038723/MARATHON)；[Behance 主页](https://www.behance.net/mrigley?tracking_source=search_projects%7Ccyberpunk)；其另有「CYBERPUNK 2077 UI CONCEPT / LOOK DEV」项目可作风格参照 — [Behance](https://www.behance.net/gallery/110671027/CYBERPUNK-2077-UI-CONCEPT-LOOK-DEV)
- **Antibody 发售后过场与「You Are Dead」剪辑**：Stash 报道 Antibody 制作了 post-launch cutscenes 与 trailer 元素（Client: Bungie, Production: Antibody） — [Stash: Antibody Confirms "You Are Dead"](https://www.stashmedia.tv/antibody-confirms-you-are-dead-in-their-marathon-cinematic-edit/)
- 飞蛾加载画面改编自 Antibody 制作的更长开场动画 — [NewsBreak 转述 Polygon](https://www.newsbreak.com/news/4524738151282-bungie-explains-marathon-s-creepy-moth-loading-screen)
- **发售 cinematic「In Death We've Just Begun」ft. Poppy & Son Lux（EDGLRD）**：导演 Harmony Korine、Sam Goldwater；DOP Sam Goldwater；EP Alon Soran；Head of CG Yates Holley；motion graphics artists：Alex Cook、Alejandro Robledo Mejia、Eugene Pylinsky、Martin Aggerholm、Josh Childers — [Motionographer](https://motionographer.com/news/in-death-weve-just-begun-ft-poppy-and-son-lux-official-music-video-marathon-launch-cinematic/)；[Stash](https://www.stashmedia.tv/edglrd-launches-marathon-with-in-death-weve-just-begun-music-video/)
- **Reveal Cinematic Short（Alberto Mielgo 导演）**：制作方 Pinkman.TV、Agora、Illusorium；入选 Annecy 2026 视频游戏 cinematic 竞赛 — [Stash](https://www.stashmedia.tv/alberto-mielgo-drops-cinematic-short-for-bungies-marathon/)；[Annecy](https://www.annecyfestival.com/en/the-mifa/themes/mifa-cross-ip/video-game-cinematic-works-game-trailers-competition/video-game-cinematics-game-trailers-2026/marathon-reveal-cinematic-short)；[Creative Bloq 评论](https://www.creativebloq.com/entertainment/gaming/the-marathon-cinematic-looks-absolutely-breathtaking-its-one-of-the-best-short-sci-fi-movies-ive-seen-in-years)
- **概念美术外部合作**：Karakter Design Studio 与 West Studio 被 Bungie 艺术博文列为合作伙伴 — [Stash tag: bungie 摘要](https://www.stashmedia.tv/tag/bungie)
- ArtStation 上有 George Varodi 的 Marathon 相关项目（内容未核实） — [ArtStation](https://georgevarodi.artstation.com/projects/mAGON9)
- Patrick Clair 背景（Antibody 联合创始人，True Detective 等片头） — [Wikipedia](https://en.wikipedia.org/wiki/Patrick_Clair)

### Inferences
- 若要复现「预告片级」的屏幕图形语言（glitch + 色块 + 等宽大写文字），Rigley 的 Behance 页是最直接的参照；Antibody 自家站点（antibody.tv）被屏蔽，未能确认是否有更完整的 case study。
- 游戏内 UI（Elliott Gray 等 Bungie 内部团队）与预告片 UI（外包 Antibody/Rigley）是两套不同作者的产物，网页设计时应区分「营销动态语言」与「游戏内交互语言」。

### Gaps
- Antibody 官网案例页、Rigley Behance 页的具体图像与文字：未核实。
- EDGLRD 五位 motion graphics 艺术家的个人作品集（Vimeo/Behance）：未检索。
- 2025-04 gameplay reveal 预告片、各季 trailer 的制作方：未找到。
- 游戏内 UI 团队名单（UI/UX Director、Lead、Technical UI Designer）：仅见招聘页，无姓名 — [Bungie Careers: UI/UX Lead](https://careers.bungie.com/jobs/6259448/marathon-ui-ux-lead)；[Technical UI Designer](https://careers.bungie.com/jobs/7012226/marathon-technical-ui-designer-mid-to-senior)；[PlayStation Careers: UI/UX Director](https://careers.playstation.com/marathon-ui-ux-director/job/5921280004)

---

## 问题 5：有无来自 UI/UX 团队的设计演讲/文章（GDC、Bungie 博客、80.lv、Medium、Substack）？

### Takeaway
**未找到任何 GDC 演讲**。可用的一手/近一手资料是：艺术总监 Joseph Cross 的影响来源访谈（80.lv、Creative Bloq）、Space.com 对 Senior Art Director Brian Vinton 的「graphic realism」访谈、创意总监 Julia Nardin 对 Polygon 谈加载画面、UI 设计师 Elliott Gray 在 X 上的「fontslop merchant」表态，以及 Bungie.net 的系列补丁说明（1.0.5 / 1.0.6 / 1.1.0 / 1.1.0.1 / 1.1.5）中的 UI 条目。

### Cited Findings
- **Joseph Cross（前艺术总监）影响来源**：DICE《Mirror's Edge》、《Aeon Flux》、《Ghost in the Shell》、大友克洋、森本晃司、设计工作室 The Designers Republic；描述风格为「简化/解构的通用设计语言、强烈的平面设计与色彩表达、有限的材质」；Bungie 内部称之为「graphic realism」 — [80.lv](https://80.lv/articles/marathon-art-director-shares-the-team-s-creative-influences)；[Creative Bloq](https://www.creativebloq.com/3d/video-game-design/bungies-art-director-explains-marathons-controversial-art-style)；[PSU](https://www.psu.com/news/marathon-takes-inspiration-from-mirrors-edge-ghost-in-the-shell-more-for-its-art-style/)
- Cross 把新作风格概括为「Wipeout meets Ghost in the Shell」 — [Creative Bloq](https://www.creativebloq.com/3d/video-game-design/bungies-art-director-explains-marathons-controversial-art-style)
- Cross 于 2025-12 离职；离职后接受 Mikhail Klimentov 的 ReaderGrev 通讯访谈，称「游戏设计中途有一次深刻演变，相当程度上改变了视觉心理」 — [Kotaku](https://kotaku.com/marathon-bungie-development-runner-art-2000661234)；[PC Gamer](https://www.pcgamer.com/games/fps/former-marathon-art-director-says-what-i-could-control-i-feel-really-good-about-in-the-face-of-pre-release-animosity-you-cant-take-that-away-from-me)
- **Space.com 访谈**：解释「graphic retro-futurism」美学，受访者含 Senior Art Director Brian Vinton — [Space.com](https://www.space.com/entertainment/space-games/bungie-explains-marathons-graphic-retro-futurism-aesthetic-and-the-live-narrative-lessons-it-learned-from-destiny-interview)
- **Julia Nardin（创意总监）谈加载画面**：见问题 3 第 2 条 — [NewsBreak 转述 Polygon](https://www.newsbreak.com/news/4524738151282-bungie-explains-marathon-s-creepy-moth-loading-screen)
- **Elliott Gray（Bungie UI 设计师）**：在 X 上回应批评，个人简介加上「fontslop merchant」，称「Don't think for a second that we're gonna remove the SAUCE from the UI」，同时承认会改进「inventory management, navigation, density of info」；使用话题 #fontsloptakeover；「fontslop」一词由 YouTuber Kelski 的视频引爆 — [PC Gamer](https://www.pcgamer.com/games/fps/marathon-ui-designer-declares-himself-the-fontslop-merchant-and-promises-bungie-will-never-remove-the-sauce-from-the-ui)；[GamesRadar](https://www.gamesradar.com/games/fps/marathons-self-appointed-fontslop-merchant-says-dont-think-for-a-second-well-remove-the-sauce-from-the-new-shooters-controversial-ui-even-if-theres-plenty-of-work-to-do)；[GamingBolt](https://gamingbolt.com/dont-think-for-a-second-were-gonna-remove-the-sauce-says-marathon-ui-designer-about-its-look)；[OpenCritic](https://opencritic.com/news/27324/marathon-dev-embraces-the-fontslop-accusations-but-wont-change-the-ui-too-much)
- Bungie 在 Server Slam（2026-02-28 更新）中将 UI 反馈列为六大核心问题之一，承诺 3 月 2 日测试结束后持续迭代，3 月 5 日发售 — [FinalBoss](https://finalboss.io/bungie-admits-marathons-ui-needs-work-promises-fixes)；[Insider Gaming](https://insider-gaming.com/bungie-addresses-marathon-ui-and-pvp-concerns/)；[GamesRadar](https://www.gamesradar.com/games/fps/bungie-wants-more-feedback-on-marathons-controversial-ui-to-make-sure-players-can-read-whats-happening-mid-fight-which-seems-like-the-bare-minimum-for-an-fps)
- **Bungie.net 官方补丁说明（含 UI 条目）**：[1.0.5](https://www.bungie.net/7/en/News/Article/marathon_update_1_0_5)（contract/activity 路点图标更清晰、Armory tooltip 首行显示价格）；[1.0.6](https://www.bungie.net/7/en/News/Article/marathon_update_106)（cores/implants/chips 图标重绘）；[1.1.0](https://www.bungie.net/7/en/News/Article/marathon_update_1_1_0)（Reboot+ 图标统一、Run Preparation 画面 QoL）；[1.1.0.1](https://www.bungie.net/7/en/News/Article/marathon_update_1_1_0_1)；[1.1.5（2026-07-21）](https://www.bungie.net/7/en/News/Article/marathon_update_1_1_5)（多选 tile、exfil 图标）
- 2026-05 路线图报道：Bungie 计划在后续赛季重点改进 UI/UX 与匹配 — [ingamenews](https://ingamenews.com/2026/05/bungie-outlines-marathon-roadmap-for.html)
- Substack：Nukatronic「The First Steps, in Marathon」（内容未核实，可能含 UI 观察） — [Substack](https://nukatronic.substack.com/p/the-first-steps-in-marathon)
- 第三方设计评论：josephkerrdesign「Bungie's Overdesigned UI's: What Marathon Gets Wrong」 — [josephkerrdesign.com](https://josephkerrdesign.com/bungies-overdesigned-uis-what-marathon-gets-wrong/)；FRVR 的反向辩护「more engaging than 90% of AAA」 — [FRVR](https://frvr.com/blog/marathons-ui-isnt-fontslop-and-its-not-perfect-but-its-so-much-more-engaging-than-90-of-aaa-guff-these-days)
- 评论者将其视觉归入 90 年代中期的「vectorheart」高反差图形运动（评论观点，非官方） — [GamesRadar 等转述](https://www.gamesradar.com/games/fps/comparisons-to-concord-didnt-feel-great-says-ex-marathon-art-director-but-as-much-as-the-haters-try-online-you-cant-take-the-thing-i-care-about-the-most)
- 流媒体主 Ninja 称菜单是「One of the most complex menus I've ever seen」 — [inkl](https://www.inkl.com/news/one-of-the-most-complex-menus-i-ve-ever-seen-ninja-fumes-over-marathon-ui)

### Inferences
- 官方对 UI 的立场可概括为：保留「SAUCE」（强烈的色彩/字体/图形身份），只修可读性、导航深度与信息密度。网页复现时应把「风格层」与「可用性层」分开设计，以同时继承识别度并避开原作被批评的问题。
- 来源对 Cross 职位称呼不一（senior art director / franchise art director），Space.com 把 Brian Vinton 列为 Senior Art Director；引用时需注明。

### Gaps
- GDC / GDC Vault 演讲：无。
- Bungie.net 上专门讨论 UI 设计理念（非补丁说明）的博文：未找到。
- Space.com、80.lv、Creative Bloq 访谈原文中关于 UI/字体/色彩的具体引语：页面被屏蔽，仅有摘要。
- Elliott Gray 的 X 帖子直链、Kelski 视频直链：未获得。

---

## 问题 6：粉丝/设计师在 Dribbble、Behance、CodePen、X、YouTube 上有哪些可复用的东西？

### Takeaway
可复用的粉丝/独立作品很少且分散：Maximilian Lock 的粉丝 UI 概念（基于 Alpha 0.5.0.0 菜单结构）、The Rookies 2026 一份以 Runner 平板为核心、用 Figma 制作的 cinematic FUI 作品、Dribbble 上 Bircch 的「Marathon by Bungie – Game Pre-Order」网页概念、以及 KryDotExe 的 Durandal Grotesque 字体。**没有找到**任何 CodePen 复刻、After Effects「Marathon 风格」教程或 X 上的 UI 拆解帖。

### Cited Findings
- **Maximilian Lock 粉丝 UI 概念**：保留公开的 Marathon Alpha 0.5.0.0 主菜单整体结构，引入「framed typographic elements」把文字变成明确的可交互按钮；覆盖开始画面、主菜单、loadout、faction 系统、database、black market、run summary；开始画面借鉴 Overwatch 2 的简洁美学；背景场景取自 ArtStation 作品「UESC Marathon」 — [maximilianlock.co.uk](https://www.maximilianlock.co.uk/post/marathon-ui-personal-project)
- **The Rookies 2026 参赛作品（entry 49939）**：以 Runner 平板为核心的 cinematic FUI，用 Figma 等工具制作（作者与细节未核实） — [The Rookies](https://www.therookies.co/entries/49939)
- **Dribbble：Bircch「Marathon by Bungie – Game Pre-Order」**：游戏预购网页首页概念，标签含 bungie、concept、homepage、video game website — [Dribbble: Bircch](https://dribbble.com/Bircch)
- **Durandal Grotesque**（标志复刻字体，个人使用许可） — [designbeep](https://designbeep.com/2026/03/14/durandal-grotesque-font/)
- **Michael Rigley Behance**（专业而非粉丝作品，但是最接近「可参考的屏幕图形拆解」） — [Behance](https://www.behance.net/gallery/205038723/MARATHON)
- 俄文站 ixbt 报道玩家展示了「改进版」UI 并呼吁 Bungie 修改（原 mockup 来源未核实） — [ixbt.games](https://ixbt.games/en/news/2026/03/01/igrokov-v-marathon-razocaroval-interfeis-oni-pokazali-ulucsennuiu-versiiu-i-prizvali-bungie-ispravit-igru.html)
- 搜索「Marathon UI recreation CSS CodePen Figma」只返回与跑步赛事/Figma 课程同名的无关结果；「Marathon After Effects tutorial glitch」只返回通用 glitch 教程与一个关键词堆砌页（old.fbpe.org，不可信） — [classcentral 通用 UI 动画课](https://www.classcentral.com/course/skillshare-after-effects-tutorial-create-amazing-ui-animations-now-84480)；[tutsplus 通用 glitch 课](https://design.tutsplus.com/articles/new-course-create-a-modern-glitch-animation-in-after-effects--cms-32111)
- Behance 搜索「Marathon Bungie UI」除 Rigley 外无其他命中 — [Behance 搜索（被屏蔽，未核实）](https://www.behance.net/search/projects?search=marathon%20bungie)

### Inferences
- 网页复现最有价值的「二手资产」是 Lock 的概念（给出了菜单信息架构的完整清单：Start / Main / Loadout / Factions / Database / Black Market / Run Summary）与 Rigley 的预告片屏幕图形语言；两者分别对应「游戏内结构」与「营销动态」。
- 由于缺少 CodePen/教程，glitch、色块、等宽大写文字等效果需要设计师自行实现；通用 After Effects glitch 教程可作技术起点，但与 Marathon 无直接关联。

### Gaps
- CodePen、X/Twitter 上的 Marathon UI 复刻或拆解：未找到。
- YouTube「Marathon UI recreation / Marathon style After Effects tutorial / Marathon glitch effect tutorial」：youtube.com 被屏蔽，搜索无命中。
- The Rookies 作品作者、图像、动效说明：未核实。
- Reddit 上的玩家改版 mockup 原帖：未获得。
- 粉丝提出的免费字体替代方案（除 Durandal Grotesque、Marapfhont 外）：无来源。

---

## 附：HUD / 菜单结构速查（综合自上述来源，供网页信息架构参考）

- **HUD**：顶部罗盘（玩家建议加入撤离点与队友标记） — [help.marathonthegame.com](https://help.marathonthegame.com/hc/en-us/community/posts/46776844545684-How-To-INSTANTLY-Improve-The-HUD-Compass)；护盾板颜色编码与破损图标 — [Threads](https://www.threads.com/@goofstha/post/DVpL0KLET0H/understanding-the-hud-ui-icons-in-marathon-before-i-start-shield-colors-show?hl=en)；队友代码「A1」 — [FinalBoss](https://finalboss.io/after-a-weekend-with-bungies-marathon-i-see)；评测称撤离序列缺少明显的屏幕倒计时 — [Tom's Guide](https://www.tomsguide.com/gaming/marathon-review)；HUD opacity / UI colour mode / UI subtitles 选项 — [PlayStation Support](https://www.playstation.com/en-au/support/games/marathon-support/)
- **菜单/大厅**：主菜单内含 loadouts、角色选择、客制化、技能树等 — [gamers-haven](https://gamers-haven.org/game-reviews/marathon/)；对局前 preparation 阶段：组装 loadout、在 Armory 买枪、选 contract — [gamersocialclub](https://gamersocialclub.ca/2026/03/09/marathon-beginners-guide)；免费 Sponsored Kits 位于 Armory 右侧「Today's Sponsors」区 — [Shacknews](https://www.shacknews.com/article/148065/how-to-equip-free-kit-marathon)；Vault、Armory、Shell/Customize、Runner Select（含 Rook）等 tab — [Known Issues](https://help.marathonthegame.com/hc/en-us/articles/46620187972756-Known-Issues-List)；PC 上 Tab 打开 loadout 菜单 — [tutorialtactic](https://tutorialtactic.com/?p=14662)
- **信息密度/导航**：ready-up 深藏 5–6 层 — [Mein-MMO](https://mein-mmo.de/en/marathon-wants-to-be-the-new-competitor-to-arc-raiders-but-players-complain-why-is-everything-hidden-5-6-menus-deep,1554307/)；Armory tooltip 首行显示价格（1.0.5） — [Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_update_1_0_5)
