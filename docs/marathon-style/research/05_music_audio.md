# Marathon（Bungie，2026）音乐、声音设计与音频身份 —— 以及网页背景音频的合法替代方案

> 调研日期：2026-11-02。本笔记所有事实均来自本次会话中实时抓取的网页搜索结果。
>
> **重要方法学说明**：本会话的沙箱网络策略禁止直接抓取 bungie.net、press.bungie.com、aftermath.site、wikipedia.org、discogs.com、freemusicarchive.org、pixabay.com、uppbeat.io、ccmixter.org、developer.mozilla.org 等绝大多数站点的全文（DNS 解析被拒绝），只有 github.com 可以抓取全文。因此下文中除 GitHub 仓库外的所有事实，均来自搜索引擎返回的页面摘要/片段（live snippets），而非页面全文。摘要已足以确认关键信息，但凡属"只在摘要里出现一次、未能二次核实"的内容，均已显式标注 **[待核实]**。搜索配额在第四轮查询后耗尽，CodePen、ccMixter、Tone.js 生成式示例等少数子题未能继续检索，已在 Gaps 中注明。

---

## 关键问题 1：谁为 Marathon 配乐？Bungie 与作曲者如何描述其声音？

### Takeaway
Marathon（2026）的配乐由 Son Lux 创始成员 **Ryan Lott** 创作，Bungie 音频总监为 **Chase Combs**。官方与访谈一致的表述是：以"世界（Tau Ceti）而非角色"为音乐主角，刻意"颠覆玩家对 Bungie 配乐（Halo/Destiny）的预期"，用人声碎片、预置钢琴（prepared piano）与 Expressive E Osmose 等人类演奏素材经重度电子处理，形成"未来主义 electro-ambient / 工业脉冲"的质感。没有任何来源使用 "IDM" 或 "techno" 作为官方流派标签。

### Cited Findings
**人物与职务**
- 作曲：Ryan Lott（Son Lux 创始成员，曾参与电影 *Everything Everywhere All at Once* 配乐）；Bungie 音频总监：Chase Combs。两人共同出镜 Bungie 官方 "Music of Marathon — Developer Insights" 视频 — [Bungie.net: Music of Marathon — Dev Insights Video](https://www.bungie.net/7/en/News/Article/musicofmarathondevinsight)；[KAMI (X)](https://x.com/Okami13_/status/2024546650086076889)；[Synthtopia](https://www.synthtopia.com/content/2026/03/06/behind-the-scenes-with-the-music-of-marathon/)
- Chase Combs 于 2023 年 3 月以 Audio Director 身份加入 Bungie，此前同时参与 Destiny 2 与 Marathon 音频团队 — [LinkedIn: Chase Combs](https://www.linkedin.com/in/chasecombs/)
- Dev Insights 视频发布日期为 2026-02-13，官方描述为"探索当代电子音乐影响与人类演奏如何融合，创造 Marathon 的音乐"（Explore how contemporary electronic influences and human performances blend together） — [Bungie.net](https://www.bungie.net/7/en/News/Article/musicofmarathondevinsight)；[Marathon 官方 X](https://x.com/MarathonTheGame/status/2024517215584997644)
- 一个标题为 "Marathon Developer Insights" 的 YouTube 视频 — [YouTube uk4K91aeixU](https://www.youtube.com/watch?v=uk4K91aeixU) **[待核实：搜索摘要未能确认该视频就是音乐专题那一集]**

**音乐方向的官方/访谈原话**
- Combs（NME 访谈）："Coming onto the project, I knew we wanted to subvert player expectations in how we approached the score." — [NME: Björk and 'Arrival' inspired the menacing space bangers of 'Marathon'](https://www.nme.com/features/gaming-features/marathon-soundtrack-interview-ryan-lott-3949751)
- Combs（Aftermath 访谈标题即引语）："We Needed To Do Something That Would Subvert Expectations"；并称 "Seeing the reception to the score has been overwhelming." — [Aftermath](https://aftermath.site/marathon-bungie-soundtrack-ryan-lott/)
- Lott（Aftermath）："In the case of Marathon, I did some design using fragments of the human voice. What I look for, whether it's a cello performance, a voice or anything else, is the emotion trapped inside the sound that persists even through extensive manipulation." 以及 "I did a rather thorough preparation of my piano in advance of working on Marathon, knowing that I would use it as a sound source." — [Aftermath](https://aftermath.site/marathon-bungie-soundtrack-ryan-lott/)
- Combs（Dev Insights 视频转述）：游戏没有中心主角，"the hero is the world"，因此 Tau Ceti 星球成为音乐基础；Combs 还表示"世界优先"的思路同样塑造了整体声音设计 — [MMORPG.com](https://www.mmorpg.com/news/bungie-shares-music-of-marathon-dev-insights-ahead-of-server-slam-next-week-2000137335)
- Lott 表示刻意避开 Halo 与 Destiny 的音乐语言 — [The Game Post](https://thegamepost.com/marathon-composer-ryan-lott-halo-destiny-music/)
- NME 专题标题指出灵感来自 Björk 与电影 *Arrival*，并将曲目形容为 "menacing space bangers" — [NME](https://www.nme.com/features/gaming-features/marathon-soundtrack-interview-ryan-lott-3949751)
- Lott 的创作方式被描述为"不像传统游戏配乐，更像用声音做世界构建"（world building through sound） — [Rareform Audio](https://www.rareformaudio.com/blog/music-of-marathon-ian-chang-score-insight)
- GameSpot 专题：Marathon 的声音"以人类灵魂（人声）为形"（Shaped By The Human Soul） — [GameSpot](https://www.gamespot.com/articles/marathon-is-shaped-by-the-human-soul-in-a-surprising-way/1100-6538285/)
- Combs（X）：Lott 对一首曲子真正兴奋时会用手机拍摄录音室播放视频发给他，第一次就是 *Code Race* — [Chase Combs (X)](https://x.com/sonicbarber/status/2018032624233771484)

**乐器 / 技术 / 质感描述**
- 使用人声采样、prepared piano、Expressive E Osmose 控制器 — [Synthtopia](https://www.synthtopia.com/content/2026/03/06/behind-the-scenes-with-the-music-of-marathon/)
- "distorted synth layers 与 processed human vocals 的混合" — [Ground News 转载](https://ground.news/article/son-luxs-ryan-lott-shares-marathon-soundtrack-ep)
- PCMag 评测对配乐的描述："sparse tracks, packed with rhythmic hums, low growls, and other sounds, along with pulsating, looping industrial beats" — [PCMag review（镜像链接）](https://kreafolk.netlify.app/hoki-https-www.pcmag.com/reviews/marathon) **[待核实：原始 pcmag.com 链接未能抓取]**
- 法语社区将其概括为 "electro ambient futuriste"（未来主义 electro-ambient） — [WeArePlayStation.fr](https://www.weareplaystation.fr/communautes/marathon/le-feed-des-players/generale-1/marathon-bungie-devoile-les-coulisses-musicales-du-jeu-cest-de-lelectro-ambient-futuriste)
- 配乐回避了传统的角色 leitmotif，改以氛围声景映射 PvPvE 动态 — [Yelzkizi 综述](https://yelzkizi.org/marathon/) **[低可信度二手综述，待核实]**
- Lott 的配乐"据报道"入围 2026 World Soundtrack Awards 的 Best Game Music — 出现在搜索摘要中，**[待核实，未能找到可引用的原始 URL]**
- Bleacher Report 评测称环境噪音与配乐"oh-so-fitting" — [Bleacher Report](https://bleacherreport.com/articles/25411469-marathon-review-gameplay-impressions-videos-and-top-features)

### Inferences
- 官方从未用 "techno / IDM / breakbeat" 自我定义；最贴近的官方表述是"当代电子影响 + 人类演奏"，第三方评测给出的是 "industrial beats / electro-ambient"。网页设计者若要致敬该风格，应瞄准：稀疏的工业脉冲（looping industrial pulse）、低频咆哮（low growls）、被重度处理的人声碎片、长篙的氛围铺底（9–10 分钟级别曲目），而不是四拍 techno。
- "the hero is the world" 的思路可直接转译为网页音频策略：不做"主题旋律"，而做随滚动/交互缓慢演化的环境声景。

### Gaps
- Aftermath、NME、GameSpot、Bungie.net 全文均无法抓取，引语均来自搜索摘要中出现的原文片段；上下文（提问、更长的段落）缺失。
- 未找到任何 GDC Vault 演讲、Bungie 音频团队博客或 A Sound Effect 访谈。
- World Soundtrack Awards 入围一事无原始 URL。

---

## 关键问题 2：完整官方曲目表、时长与流媒体链接？

### Takeaway
官方发行分三步：2026-02-13 四曲 EP *Marathon (Original Soundtrack EP)*；2026-03-04 单曲 *In Death We've Just Begun* (ft. Poppy & Son Lux)；2026-03-06 两卷正式原声共 42 轨：**Vol. I: Somewhere in the Heavens** 与 **Vol. II: They Are Waiting**（厂牌 Milan Records）。Vol. II 为游戏内 90+ 分钟完整配乐（13 轨），Vol. I 是重新编排的"线性旅程"并含 bonus/remix 与 Poppy 单曲。未发现官方 Bandcamp 页面。

### Cited Findings
**EP（2026-02-13）**
- *Marathon (Original Soundtrack EP)* 四曲：Rhythm of Writhing Constellations (2:25)、Focused Erasures and Sub-Routine Resets (1:22)、We Stole a Moon (2:02)、Code Race [Extended] (9:34)；"four original tracks now available for streaming on all major music streaming platforms" — [Bungie.net Dev Insights](https://www.bungie.net/7/en/News/Article/musicofmarathondevinsight)；[Gaming Trend](https://gamingtrend.com/news/bungie-releases-marathon-soundtrack-behind-the-scenes-video-and-several-tracks)
- 这四曲在 Server Slam（2026-02-26 至 03-02）期间可在游戏内听到 — [MMORPG.com](https://www.mmorpg.com/news/bungie-shares-music-of-marathon-dev-insights-ahead-of-server-slam-next-week-2000137335)

**两卷 OST（2026-03-06）**
- Bungie 官方公告：Vol. I 与 Vol. II "now available for streaming on all major music platforms"，共 42 轨 — [Bungie.net: Marathon OST is Streaming Now](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now)；[Final Weapon](https://finalweapon.net/2026/03/06/marathon-soundtracks-now-streaming/)；["42 Tracks of OST" (X)](https://x.com/brondeef/status/2029619353805553863)
- 厂牌：Milan Records；目录号 Vol. I = G010005748847M，Vol. II = G010005748848K；Vol. II 总长约 98 分钟 — [Presto Music Vol. I](https://www.prestomusic.com/classical/products/9855226--marathon-vol-i-somewhere-in-the-heavens-original-game-soundtrack)；[Presto Music Vol. II](https://www.prestomusic.com/classical/products/9855227--marathon-vol-ii-they-are-waiting-original-game-soundtrack)
- 官方描述：Volume II "features the full 90+ minutes of in-game score you hear when playing Marathon"；Volume I "takes the score from Marathon and reimagines it into a linear journey through the world of Tau Ceti, complete with bonus tracks, remixes" 并收录 Son Lux × Poppy 合作曲 *In Death We've Just Begun* — [Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now)

**Vol. I: Somewhere in the Heavens（Original Game Soundtrack）—— 已确认的前几轨**
- 01 Code Race (2:02)；02 Rhythm of Writhing Constellations (2:25)；03 A New Home for Humanity (1:37)；04 Discontent (2:22)；05 Planetary Relocation Psyc…（标题在摘要中被截断）；后段含 *Code Race* 的 Brendan Angelides remix，以及 *In Death We've Just Begun* — [Marathon Bulletin (X) 完整曲目表](https://x.com/TauCetiGG/status/2029590440987791705)；[Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now)；[Discogs Vol. I](https://www.discogs.com/release/36703786-Ryan-Lott-Marathon-Vol-I-Somewhere-In-The-Heavens-Original-Game-Soundtrack)
- 各来源时长相差数秒（如 Code Race 2:02 vs 2:03） — [Discogs](https://www.discogs.com/release/36703786-Ryan-Lott-Marathon-Vol-I-Somewhere-In-The-Heavens-Original-Game-Soundtrack) 与 [Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now) 不一致

**Vol. II: They Are Waiting（13 轨，顺序已确认）**
- Somewhere in the Heavens；Feet of Fragile Flesh；Burn the Boats；Time Leach (9:22)；Mad Is the Sword；Escape Will Make Me God；Neurosaboteur；Code Race (Extended)；The Dream Is Not Over；Where Is Death；Tissue Unwinds；Pro Corpse Idealist (9:36)；Assert (9:30) — [Discogs Vol. II](https://www.discogs.com/release/36704020-Ryan-Lott-Marathon-Vol-II-They-Are-Waiting-Original-Game-Soundtrack)；[Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now)
- 曲名拼写差异：Bungie 官方曲目表写 "Time Leach"，Bungie YouTube 上传与 The Ongaku 写 "Timeleach" — [The Ongaku](https://www.theongaku.com/posts/marathon-soundtrack)

**单曲 In Death We've Just Begun（2026-03-04）**
- 2026-03-04 无预告突袭发布，附官方 MV；词曲/演奏 Ryan Lott & Son Lux，Poppy 演唱并作词，混音 Chris Tabron，母带 Dave Kutch（The Mastering Palace, NYC），音乐监制 Chase Combs — [Bungie Press Room](https://press.bungie.com/Tau-Ceti-beckons-Marathon-launches-March-5)；[NME](https://www.nme.com/news/gaming-news/poppy-marathon-anthem-in-death-weve-just-begun-3932665)；[Theprp.com](https://www.theprp.com/2026/03/03/news/hear-poppy-son-lux-unite-on-in-death-weve-just-begun-for-new-marathon-video-game/)
- 风格：被形容为"远比 Poppy 平常的金属风格更电子化" — [Nu Metal Agenda](https://numetalagenda.com/poppy-teams-with-son-lux-for-in-death-weve-just-begun-d/)

**流媒体 / 购买链接（已在搜索结果中确认存在的 URL）**
- YouTube Music：Vol. II 专辑 — [music.youtube.com/browse/MPREb_IWZlIf87MDj](https://music.youtube.com/browse/MPREb_IWZlIf87MDj)；单曲专辑 — [music.youtube.com/playlist?list=OLAK5uy_kuuX-SJ8Zd22BIqZbnMRzuvirMatoltNU](https://music.youtube.com/playlist?list=OLAK5uy_kuuX-SJ8Zd22BIqZbnMRzuvirMatoltNU)；官方合集 "Marathon OST Greatest Hits" — [playlist PLoj6WH3VOExLm64QiA8bP6Cp-Z-NX1B_C](https://music.youtube.com/playlist?list=PLoj6WH3VOExLm64QiA8bP6Cp-Z-NX1B_C) **[待核实是否 Bungie 官方建立]**
- Deezer：Vol. II — [deezer.com/us/album/921339091](https://www.deezer.com/us/album/921339091)
- Audiomack：Vol. II — [audiomack.com](https://audiomack.com/ryan-lott/album/marathon-vol-ii-they-are-waiting-original-game-soundtrack-0406447)
- Presto Music（Hi-Res 下载购买）：见上文两个链接
- Qobuz（Son Lux 艺人页）— [Qobuz](https://www.qobuz.com/ca-en/interpreter/son-lux/600681)
- VGMdb 条目 — [vgmdb.net/album/158409](https://vgmdb.net/album/158409)
- Spotify：仅找到粉丝歌单 "Bungie's Marathon"（混有非 Bungie 曲目，非官方） — [Spotify playlist](https://open.spotify.com/playlist/4fctmPYPvk5rRr6Y9aYv86)
- Bandcamp：**未找到任何官方 Bandcamp 页面**；Bungie 公告只说 "all major streaming platforms" — [Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now)

### Inferences
- 两卷标题后缀在不同来源间不一致：Bungie 公告摘要称 Vol. II 为 "Original Game Score"，而 Discogs/Presto/Deezer 条目均写 "Original Game Soundtrack"。以流媒体平台元数据为准更稳妥。
- 一条搜索摘要把 Vol. II 的前八轨误标为 Vol. I 的开头；经与 X 上的完整曲目表及 Discogs 交叉比对，Vol. I 以 *Code Race* 开头，Vol. II 以 *Somewhere in the Heavens* 开头。

### Gaps
- Vol. I 完整 29 轨（42−13）曲目与逐轨时长未能完整取得：X 帖子被截断，Discogs/Bungie 页面无法抓取全文。
- Spotify / Apple Music 官方专辑 URL 未能直接取得（搜索结果中没有出现这两家的专辑页）。
- 两张专辑的 Milan Records 官方页面未出现在结果中。

---

## 关键问题 3：各主要预告片使用了哪些音乐？

### Takeaway
已确认三条：2023-05 PlayStation Showcase 揭晓预告 = Justice *Heavy Metal*（SebastiAn Remix，Ed Banger Records），该用乐获 2024 Clio Music 银奖；2026-03-04 发售动画预告本身就是 *In Death We've Just Begun* 的 MV；**2025-04-12 玩法揭晓（gameplay reveal）预告的配乐未能在任何来源中被识别**。揭晓直播收尾的 Alberto Mielgo 8 分钟动画短片，Reddit 有人认为用了 Bach *Adagio BWV 974*，但未获确认。

### Cited Findings
**2023 揭晓预告（Reveal / Announce Trailer）**
- 配乐为 Justice *Heavy Metal (SebastiAn Remix)* — [Commercial-Song.net](https://commercial-song.net/2023/05/marathon-2023-game-trailer-song/)；The Elements Music 新闻稿 "Marathon Trailer ft. Justice x Sebastian" — [The Elements Music](https://www.theelementsmusic.com/news/marathon-trailer-ft-sebastian-x-justice)
- 粉丝上传以 "Heavy Metal x DVNO (Trailer Version)" 命名 — [YouTube b-lSzlUdHQo](https://www.youtube.com/watch?v=b-lSzlUdHQo)；[YouTube NM3z_0LjJsc](https://www.youtube.com/watch?v=NM3z_0LjJsc) **[非官方]**
- 2024 Clio Music 银奖（Use of Music in Trailers & Teasers / Gaming Trailer-Teaser）：报名方 The Elements Music（LA），音乐公司 Ed Banger Records，声音设计 Source Sound，创意代理 Antibody TV — [Clios 条目](https://clios.com/music/winner/use-of-music-in-trailers-teasers/bungie/marathon-505087)；[The Elements Music：4x Clio wins](https://www.theelementsmusic.com/news/4x-clio-music-awards-wins)
- r/Marathon 2023 揭晓预告讨论帖（摘要中无音乐信息） — [Reddit 镜像](https://lr.us.psf.lt/r/Marathon/comments/13qxlfu/marathon_reveal_trailer_playstation_showcase_2023/jlhz07j)

**2025-04-12 玩法揭晓（Gameplay Reveal）**
- 揭晓于 2025-04-12 13:00 ET 直播，包含玩法预告、动画短片与直播；原定 2025-09-23 发售后无限期延期 — [Windows Central](https://www.windowscentral.com/gaming/marathon-bungie-release-date-september-2025)；[PCGamesN](https://www.pcgamesn.com/marathon/release-date)；[WowVendor](https://wowvendor.com/media/marathon/marathon-gameplay-reveal/)
- **玩法预告配乐：在所有检索结果中均未被识别**（无官方说明、无 Reddit/WhatSong/Tunefind 结果）
- 直播收尾为 Alberto Mielgo（*The Windshield Wiper* 奥斯卡最佳动画短片得主）编导的 8 分钟 "Reveal Cinematic Short"，与马德里 Illusorium 及 Agora Studio 合作 — [Stash Media](https://www.stashmedia.tv/?p=111217)；[PC Gamer](https://www.pcgamer.com/games/fps/bungie-hired-an-oscar-winner-to-make-marathons-stunning-8-minute-short-but-only-real-sci-fi-nerds-will-spot-the-cult-movie-that-inspired-it)；[Annecy 2026 竞赛条目](https://www.annecyfestival.com/en/the-mifa/themes/mifa-cross-ip/video-game-cinematic-works-game-trailers-competition/video-game-cinematics-game-trailers-2026/marathon-reveal-cinematic-short)
- r/Marathon 帖子询问该短片中 Bach *Adagio BWV 974*（Marcello 双簧管协奏曲改编）的具体版本，评论称与 YouTube 上的版本都不匹配 — [Reddit 镜像](https://redlib.hbubli.cc/r/Marathon/comments/1kt8ebv/whats_the_exact_version_of_adagio_bwv_974_used_in) **[仅社区说法，未获官方确认]**

**2026-03-04 发售动画预告 / 官方 MV**
- 发售预告即 *In Death We've Just Begun* 官方 MV，由 Harmony Korine 与 Sam Goldwater 执导，与 EDGLRD 合作制作；跟随 runner 外壳 Triage 穿越 Tau Ceti IV 与 USS Marathon — [Push Square](https://www.pushsquare.com/news/2026/03/marathon-ps5-is-out-here-turning-its-launch-trailer-into-a-music-video)；[GamesBeat](https://gamesbeat.com/inside-sam-goldwater-and-harmony-korines-official-marathon-short-film/)；[Gamesplanet](https://uk.gamesplanet.com/community/marathon-steam-key--8149-1/news_updates/417911-marathon-cinematic-trailer-with-music-by-poppy-son)
- 官方 MV — [YouTube vtw5BDpKgJM: In Death We've Just Begun ft. Poppy and Son Lux (Official Music Video)](https://www.youtube.com/watch?v=vtw5BDpKgJM)；纯音频 — [YouTube g_D4xTFhTmE](https://www.youtube.com/watch?v=g_D4xTFhTmE)
- Poppy 粉丝 wiki 称这是 Poppy 歌曲中时长最长的 MV — [Poppy Fandom Wiki](https://poppy.fandom.com/wiki/In_Death_We've_Just_Begun) **[粉丝来源]**
- 游戏 2026-03-05 全球发售 — [Bungie Press Room](https://press.bungie.com/Tau-Ceti-beckons-Marathon-launches-March-5)

### Inferences
- Marathon 的预告音乐策略呈两极：外部授权的 French-electro/Ed Banger 美学（Justice）用于最初的品牌冲击；而发售期全部转向 Lott 自己的原创体系（含 Poppy 合作）。网页若想致敬"预告片质感"，Justice 风格的失真 synth-bass 与 Lott 的人声碎片氛围是两条不同的参考线。

### Gaps
- 2025-04-12 玩法预告配乐身份：完全未知；WhatSong/Tunefind 未在结果中出现。
- 2025-04 以后的其他官方预告（如 Server Slam、Season 预告）的配乐均未检索到。
- Mielgo 短片的 Bach 说法未获官方或可靠媒体确认。

---

## 关键问题 4：UI / 菜单声音特征？声音设计相关演讲或访谈？

### Takeaway
**没有找到任何专门讨论 Marathon UI 音效或菜单音频的官方来源、GDC 演讲或 A Sound Effect 访谈**。可得信息限于：Combs 对整体声音设计的"分层 + 空间/地形传播模拟"描述（来源 URL 缺失）、评测对战斗音频信息性的称赞、2026-03 一次扩大声音传播范围的补丁因玩家反弹被回滚，以及粉丝上传的菜单音乐（被描述为 techno / 诡异科幻氛围）。

### Cited Findings
- Combs 在 Republic DG 访谈中描述"分层的声音设计方法"，"每个声音都经过处理以模拟音频在空间与地形中的传播"；PS5 上使用 DualSense 触觉与 Tempest 3D 音频 — 该说法出现在搜索摘要中，**[待核实：Republic DG 访谈原始 URL 未出现在结果中]**
- Game Informer 评测：音频有效传递玩家在一局中需要的信息；熟悉每种武器独特的声音有助于规划 — [Game Informer](https://gameinformer.com/review/marathon/actions-have-consequences)
- Complete Xbox 评测：脚步声在远距离可闻并增加紧张感；同时认为 UI 与库存界面"仍需打磨" — [Complete XBOX](https://completexbox.co.uk/reviews/marathon-review/)
- Tom's Guide 等评测称每一枪都"incredibly weighty"，归功于"crisp sound design and visual indicators like hit markers" — [Tom's Guide](https://www.tomsguide.com/gaming/marathon-review)
- 2026-03 补丁扩大了声音传播范围（枪声四面八方令人迷惑，尤其 Outpost 的 Pinwheel 区域），Combs 承认是"poor decision"，称团队在找"7/10 setting"，并表示 "We're gonna make them less loud." — [FRVR](https://frvr.com/blog/marathon-dev-teases-reverse-in-recent-audio-changes-after-fan-complaints-as-they-look-for-the-perfect-7-10-setting/)；[BigGo](https://finance.biggo.com/news/202603132122_Marathon-Audio-Change-Reversed)
- Bungie 曾招聘 Senior SFX Lead，职责为 "Accountable for all in-game sound effects" — [Hitmarker](https://hitmarker.net/news/bungie-posts-remote-job-openings-for-its-new-marathon-title-522832)
- UI 争议（"fontslop"）全部围绕视觉：字体组合过多、信息密度、菜单层级；UI 设计师 Elliott Gray 称不会"remove the sauce" — [GamesRadar](https://www.gamesradar.com/games/fps/marathons-self-appointed-fontslop-merchant-says-dont-think-for-a-second-well-remove-the-sauce-from-the-new-shooters-controversial-ui-even-if-theres-plenty-of-work-to-do)；[Kotaku](https://kotaku.com/marathon-ui-fontslop-menus-bungie-2000675332)；[PC Gamer](https://www.pcgamer.com/games/fps/marathon-ui-designer-declares-himself-the-fontslop-merchant-and-promises-bungie-will-never-remove-the-sauce-from-the-ui)
- 菜单音乐（非官方上传）："MARATHON - Menu Music"（描述为 techno） — [YouTube taqqBVqZJi8](https://www.youtube.com/watch?v=taqqBVqZJi8)；"Alpha Menu OST Reveal"（诡异科幻氛围） — [YouTube OME0mUUdJec](https://www.youtube.com/watch?v=OME0mUUdJec)；"1 Hour of Marathon Menu Music & Sci-Fi Ambience" — [YouTube Fjbwqe3Cvkw](https://www.youtube.com/watch?v=Fjbwqe3Cvkw) **[均为粉丝上传，不可作为合法素材]**
- Bungie 官方帮助中心有"音频在游戏中与主菜单随机消失"的社区帖 — [help.marathonthegame.com](https://help.marathonthegame.com/hc/en-us/community/posts/48416627224084-Audio-randomly-dissappear-in-game-and-on-main-menu)

### Inferences
- 既然 Combs 强调"世界优先"同样指导声音设计，而评测反复强调"声音即信息"（武器辨识、脚步距离），UI 音效大概率延续同一逻辑——功能性、低调、与环境声景融合——但这是推断，无直接证据。
- 网页设计者若需 UI 点击/悬停音，应自行设计或从 CC0 音效库取材，而非提取游戏资源（受版权保护）。

### Gaps
- UI/菜单音效的任何描述或官方音频片段：无。
- 音频可视化（audio-reactive visuals）在游戏菜单中是否存在：无来源。
- GDC Vault / A Sound Effect / 播客访谈：均未在结果中出现。
- Republic DG 访谈 URL 缺失。

---

## 关键问题 5：Bungie 发布的官方音乐视频 / 可视化视频有哪些？

### Takeaway
已确认的官方音乐类视频有三类：(1) *In Death We've Just Begun* 官方 MV（Korine/Goldwater，EDGLRD）；(2) "Music of Marathon — Developer Insights" 幕后纪录片；(3) Bungie 频道上传的单曲音频（至少 *Timeleach*），但未能确认其是否为带动态画面的 visualiser。

### Cited Findings
- 官方 MV — [YouTube vtw5BDpKgJM](https://www.youtube.com/watch?v=vtw5BDpKgJM)；幕后：GamesBeat 专题 — [GamesBeat](https://gamesbeat.com/inside-sam-goldwater-and-harmony-korines-official-marathon-short-film/)
- Dev Insights 音乐纪录片官方页 — [Bungie.net](https://www.bungie.net/7/en/News/Article/musicofmarathondevinsight)；多语言版 — [德语](https://www.bungie.net/7/de/News/Article/musicofmarathondevinsight)、[法语](https://www.bungie.net/7/fr/News/Article/musicofmarathondevinsight)；官方 X / TikTok 推文 — [X](https://x.com/MarathonTheGame/status/2024517215584997644)、[TikTok](https://www.tiktok.com/@marathonthegame/video/7608460076378098957)
- Bungie 在其 YouTube 频道发布了 *Timeleach*（Ryan Lott of Son Lux） — [The Ongaku](https://www.theongaku.com/posts/marathon-soundtrack)；YouTube Music 条目标题 "Marathon OST | 'TIMELEACH' by Ryan Lott of Son Lux" **[是否为 visualiser 未知]**
- Bungie 中文官方 OST 公告页（可作为中文读者入口） — [Bungie.net zh-chs](https://www.bungie.net/7/zh-chs/News/Article/marathon_ost_streaming_now)
- 粉丝自制"Official Main Theme (Teaser Trailer Song)"视频 — [YouTube vXUGvmm-QbA](https://www.youtube.com/watch?v=vXUGvmm-QbA) **[非官方]**

### Inferences
- Bungie 的音乐视觉资产以叙事性 MV 与纪录片为主，并无 "audio-reactive visualiser" 风格的官方发布——网页若要做音频可视化，是对品牌的延伸而非复刻。

### Gaps
- Bungie YouTube 频道页本身无法抓取，无法列出完整的 OST 上传清单与各视频是否带可视化画面。

---

## 关键问题 6：版权与嵌入——官方音乐能否用于网页？合法替代曲库（10+）与许可条款？

### Takeaway
**Marathon 官方音乐（Milan Records / Bungie 版权）不能作为音频文件直接嵌入网页**，唯一可行的"引用"方式是按 YouTube 规则嵌入可见播放器（不得隐藏、不得自动播放除非 >50% 可见、每页仅一个自动播放器、最小 200×200px）。替代路径：Pixabay Music（Pixabay Content License，免署名）、Uppbeat（免费层需贴 Uppbeat Credit）、Free Music Archive（逐曲 CC 许可）、Creative Commons netlabel（Togeo Music、clongclongmoo 目录）、订阅制 Epidemic Sound / Artlist（条款以视频/播客为中心，网页用途需单独确认），以及完全开源的生成式方案（Tone.js、Generative.fm、ambient.garden）。

### Cited Findings
**官方音乐与 YouTube 嵌入规则**
- 官方 OST 由 Milan Records 发行，为受版权保护的商业录音 — [Presto Music](https://www.prestomusic.com/classical/products/9855226--marathon-vol-i-somewhere-in-the-heavens-original-game-soundtrack)（本笔记不推荐以任何形式直接托管或嵌入其音频文件）
- YouTube API Services "Required Minimum Functionality"：播放器可见且 >50% 露出前不得自动播放；一页不得有多于一个自动播放的 YouTube 播放器；嵌入播放器视口至少 200×200px；不得对播放器外观做覆盖或修改；不合规可能导致嵌入功能被削减 — [Google Developers](https://developers.google.com/youtube/terms/required-minimum-functionality)
- 该文档未直接出现"禁止纯音频/隐藏播放"字样，但上述可见性条款在实践上排除了"隐藏 iframe 当背景音乐"的做法 — [Google Developers](https://developers.google.com/youtube/terms/required-minimum-functionality)
- 可合法嵌入（以可见播放器形式）的官方视频：官方 MV — [YouTube vtw5BDpKgJM](https://www.youtube.com/watch?v=vtw5BDpKgJM)；单曲音频 — [YouTube g_D4xTFhTmE](https://www.youtube.com/watch?v=g_D4xTFhTmE)

**免费 / 免版税曲库（许可条款）**
1. **Pixabay Music** — Pixabay Content License：署名"不要求但欢迎"；可商用；禁止将内容作为音乐文件、数字壁纸等再分发或在素材站转售；部分曲目标注 "Content ID Registered"（影响 YouTube 发布，不影响网页） — [Pixabay Terms](https://pixabay.com/service/terms/)；[Pixabay FAQ](https://pixabay.com/service/faq/)；[ScanCode LicenseDB 摘录](https://scancode-licensedb.aboutcode.org/pixabay-content.html)；[ToolRadar 评测（Content ID 提示）](https://toolradar.com/tools/pixabay-music)
2. **Uppbeat** — 免费层每次下载附带一条 Uppbeat Credit，须贴在作品说明中，每条 Credit 只对应一次使用；付费层可白名单频道免 Credit；明确禁止用于"listening content"（如 lofi 合集、背景音乐频道）与作为独立文件再分发；免费下载额度各来源说法不一（3 或 10 次/月） — [Uppbeat 许可说明](https://uppbeat.io/blog/royalty-free-and-copyright-free-music/uppbeats-music-licenses)；[Uppbeat Help Center](https://fastly-f.uppbeat.io/help-center)；[Uppbeat 曲库](https://uppbeat.io/royalty-free-music)
3. **Free Music Archive (FMA)** — 每曲单独标注 CC 许可，FAQ 强调 "FREE doesn't mean you are free to use, alter or build upon all songs without any conditions"，须逐曲核对 — [FMA FAQ](https://freemusicarchive.org/FAQ)
   - 具体可参考条目：Shimmerskin "CC BY – free to use for anything 2" — [FMA](https://freemusicarchive.org/music/shimmerskin/cc-by-free-to-use-for-anything-2)；Maarten Schellekens "Free Ambient Music" — [FMA](https://freemusicarchive.org/music/maarten-schellekens/free-ambient-music-1)；Nul Tiel Curates "Melange (40min ambient experimental mix)" — [FMA](https://freemusicarchive.org/music/nul-tiel-curates/melange-40min-ambient-experimental-mix)；1000 Handz "Melodies/Samples No Drums [CC-NC-ND]"（NC-ND，不可改编，不宜商用） — [FMA](https://freemusicarchive.org/music/1000-handz/melodiessamples-no-drums-cc-nc-nd) **[各条目具体许可以其页面标注为准，本会话无法抓取页面核实]**
   - 2026-04 FMA 新增 ambient CC 作品（Virabelo 等）报道 — [FrostClick](https://www.frostclick.com/wp/index.php/2026/04/30/download-virabelos-ambient-cc-masterpiece-nova-mistero-more-new-april-drops-on-free-music-archive/)
4. **Togeo Music（netlabel）** — 专注 Creative Commons 授权的 electronic / ambient / experimental IDM / minimal techno / progressive house — [Creative Commons Wiki: Togeo Music](https://wiki.creativecommons.org/wiki/Togeo_Music) **[各发行具体 CC 变体需逐一核对]**
5. **clongclongmoo.org** — 按 CC 许可类型分类的免费电子音乐目录（by-nc、by-nc-sa、by-nc-nd 等），含 IDM 与 ambient 标签 — [CC BY-NC 分类](https://www.clongclongmoo.org/category/licenses/bync)；[IDM 标签](https://www.clongclongmoo.org/tag/idm)；[ambient 标签](https://www.clongclongmoo.org/tag/ambient/page/12) **[多数为 NC，商业网页不可用]**
6. **Subvaritrax（IDM / minimal techno 合辑）** — CC BY-NC-ND，仅限非商业且不可改编 — [CDM](https://cdm.link/free-creative-commons-licensed-album-of-idm-subvaritrax-compilation/)
7. **Epidemic Sound** — 定位为"视频/播客的背景音乐"，Personal 订阅排除品牌/公司的数字广告营销用途；许可依赖持续订阅 — [Epidemic Sound: How it works](https://epidemicsound.com/how-it-works)；[Personal subscription](https://www.epidemicsound.com/personal-subscription/)
8. **Artlist** — 提供永久（perpetual）许可；Social Creator 许可仅限个人社交账号 — [Wyzowl 对比](https://wyzowl.com/artlist-vs-epidemic-sound/)；[LicenseOrg 对比](https://licenseorg.com/compare/epidemic-sound-vs-artlist) **[第三方对比，网页嵌入是否属许可范围需向官方确认]**
9. **ccMixter** — 本会话无法抓取其页面，许可细节未能核实 **[待核实]**
10. **Bandcamp 上的 CC 作品** — 搜索中出现的多数 Bandcamp 页面为 "all rights reserved"（如 0F.digital） — [0F.digital Bandcamp](https://0f-digital.bandcamp.com/album/--7)；未能找到明确标注 CC BY 的 ambient-techno 专辑 **[Gap]**

**生成式 / 程序化方案（开源，许可明确）**
11. **Tone.js** — "A Web Audio framework for making interactive music in the browser"，MIT 许可；文档 — [GitHub Tonejs/Tone.js](https://github.com/Tonejs/Tone.js)；[docs](https://tonejs.github.io/docs/)。仓库自带示例：amSynth、fmSynth、monoSynth、polySynth、noises、grainPlayer、lfoEffects、pingPongDelay、reverb、reverseDelay、pitchShift、spatialPanner、stepSequencer、pianoPhase、analysis、meter、mic、animationSync 等 — [examples 目录](https://github.com/Tonejs/Tone.js/tree/dev/examples)
12. **Generative.fm** — 浏览器生成式音乐平台，基于 Tone.js；代码 MIT；每个 piece 为 `@generative-music/piece-*` npm 包，暴露 `activate()` → `{schedule, deactivate}`，由 Tone Transport 调度；采样由 `@generative-music/samples-alex-bainter` 提供，需自行托管 — [generative.fm（已归档旧版）](https://github.com/generative-music/generative.fm)；[generators 仓库](https://github.com/generative-music/pieces-alex-bainter)；[play.generative.fm 播放器（MIT）](https://github.com/generative-fm/play)
    - 采样许可：仓库 MIT；来自 Freesound 的采样"全部为 public domain"；VSCO2、VCSL、Sonatina、ItsLucid、Kasper 来源的采样未在页面注明许可 — [samples-alex-bainter](https://github.com/generative-music/samples-alex-bainter) **[混用前需逐项核对]**
13. **ambient.garden** — 全部由代码生成（无采样、无 AI）的可探索氛围音乐景观，微分音/纯律与物理建模乐器，Three.js 图形；对应专辑 *A Walk through the Ambient Garden* 在 Spotify/Apple Music/Bandcamp 发行，源码可用 Deno + FFmpeg 自行渲染 — [pac-dev/AmbientGarden](https://github.com/pac-dev/AmbientGarden)；[pac-dev/AmbientGardenAlbum](https://github.com/pac-dev/AmbientGardenAlbum) **[两个仓库页面均未显示 LICENSE 文件，使用前需确认]**
14. 其他 GitHub generative-music 主题下的浏览器项目：ascpixi/vestige（Tone.js 生成式合成器）、alexbainter/blossom（交互式音乐生成器）、b1rdmania/motif（Game Boy 风合成引擎） — [GitHub topic: generative-music](https://github.com/topics/generative-music) **[各自许可未逐一核实]**

### Inferences
- 对于"类 Marathon 质感"的网页背景音，**生成式路线在法律上最干净**（Tone.js MIT + 自写 patch，零第三方录音），且天然契合 "the hero is the world" 的演化式声景理念；用 `Tone.Noise`（brown/pink）+ 低通滤波 + `Tone.FMSynth` 低频 drone + `Tone.PingPongDelay`/`Tone.Reverb` 即可逼近"rhythmic hums / low growls / industrial pulse"的描述。
- 若使用曲库：商业站点优先 Pixabay（免署名）或付费 Uppbeat/Artlist；FMA 与 netlabel 需逐曲确认是否为 CC BY / CC0（避开 NC/ND）。
- 无论哪种方案，网页端都应遵守浏览器自动播放策略（需用户手势后再 `AudioContext.resume()`），并提供静音开关——这一点属于通行实践，本次未单独检索来源。

### Gaps
- 无法逐曲核实 FMA / Togeo / clongclongmoo 条目的确切 CC 变体（页面抓取被阻）。
- ccMixter 许可与可用曲目：未能核实。
- Epidemic Sound / Artlist 对"网页背景音"用途的官方条款原文未取得，仅有第三方对比。
- 未找到明确 CC BY 的 ambient-techno / IDM Bandcamp 专辑。
- Tone.js 的"generative ambient"专题示例、CodePen 上的音频可视化作品：搜索配额耗尽，未能检索。

---

## 关键问题 7：音频响应式网页视觉（Web Audio AnalyserNode → Canvas/WebGL）的开源参考实现？

### Takeaway
最可靠的起点是 MDN 官方 `webaudio-examples`（CC0，含 audio-analyser、voice-change-o-matic、violent-theremin 三个可视化示例）；轻量 Canvas 2D 方案可参考 webprofusion/web-audio-viz（MIT）；WebGL/React 方案可参考 Mattallmighty/audio-visualiser（MIT，31+ 视觉、FFT + beat detection）；即插即用的频谱组件 audioMotion-analyzer 功能最强但为 **AGPL-3.0**，商业闭源网页需谨慎。

### Cited Findings
- **mdn/webaudio-examples**（CC0-1.0）：`audio-analyser`（用 AnalyserNode 数据绘制波形） — [demo](http://mdn.github.io/webaudio-examples/audio-analyser/)；`voice-change-o-matic`（变声器 + 可视化） — [demo](http://mdn.github.io/webaudio-examples/voice-change-o-matic/)；`violent-theremin`（Canvas 随音高/增益变色） — [demo](http://mdn.github.io/webaudio-examples/violent-theremin/)；仓库 — [GitHub](https://github.com/mdn/webaudio-examples)；MDN 教程页（本会话无法抓取） — [MDN: Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)
- **webprofusion/web-audio-viz**（MIT）：零依赖 Vanilla JS + Web Audio + Canvas 2D，Winamp 风格；模式含 frequency bars、waveform、circular、spiral、particles；支持拖放文件、播放列表、灵敏度与 glow 调节 — [GitHub](https://github.com/webprofusion/web-audio-viz)；[demo](https://audio-viz.soundshed.com/)
- **Mattallmighty/audio-visualiser**（MIT）：React + TypeScript + Web Audio + WebGL；31+ 可视化、FFT 与 beat detection、BPM 跟踪、按节拍自动切换、开发者模式自定义 GLSL shader；standalone（麦克风）与 integrated（WebSocket 数据流）两种模式 — [GitHub](https://github.com/Mattallmighty/audio-visualiser)；[demo](https://mattallmighty.github.io/audio-visualiser/)
- **hvianna/audioMotion-analyzer**（AGPL-3.0-or-later）：零依赖高分辨率实时频谱模块，`new AudioMotionAnalyzer(container, { source: audioElement })` 即可接入 `<audio>` 元素；支持多种频率标度、LED bars、镜像、径向等；可经 jsDelivr CDN 加载 — [GitHub](https://github.com/hvianna/audioMotion-analyzer)；[demo](https://audiomotion.dev/demo/)
- **sannremy/Sound-Visualizer**：Web Audio + Three.js（WebGL）简单示例；仓库无 LICENSE 文件 — [GitHub](https://github.com/sannremy/Sound-Visualizer)；[demo](http://sannremy.github.io/Sound-Visualizer/)
- **aenlow/Audio-Visualizer**：单页 WebGL、无构建步骤，麦克风输入、FFT、频段分离、能量型 beat detection — [GitHub](https://github.com/aenlow/Audio-Visualizer) **[许可未核实]**
- **kantelabs/music-visualizer**：Three.js + Web Audio，"built using THREE.js in order to render the visualizers in canvas" — [awesome.ecosyste.ms 条目](https://awesome.ecosyste.ms/projects/github.com%2Fkantelabs%2Fmusic-visualizer) **[许可未核实]**
- **astrofox-io/astrofox**（TypeScript，约 2k stars）：把音频转为动态图形的桌面级工具（可作视觉参考） — [GitHub topic: audio-visualizer](https://github.com/topics/audio-visualizer)
- Three.js 论坛上的 "Audio-Reactive 3D Visualizer — Three.js + Web Audio API with In-Browser MP4 Export" 项目（Nagisa Dozono），源码 MIT，含 volume/frequency/waveform 分析与 3D、粒子、shader 模式，另有精简版 "Web Audio Three.js Starter" — [three.js discourse](https://discourse.threejs.org/t/audio-reactive-3d-visualizer-three-js-web-audio-api-with-in-browser-mp4-export/92234)
- Tone.js 自带 `analysis.html`、`meter.html`、`animationSync.html` 示例，可用 `Tone.Analyser` / `Tone.Meter` 在同一框架内完成生成式音乐 + 可视化 — [Tone.js examples](https://github.com/Tonejs/Tone.js/tree/dev/examples)

### Inferences
- 推荐技术栈组合（面向"Marathon 风"网页）：Tone.js 生成式 drone（MIT）→ `Tone.Analyser('fft', 256)` 或原生 `AnalyserNode.getByteFrequencyData()` → 自写 Canvas 2D / WebGL shader。可参考 web-audio-viz 的 Canvas 结构与 Mattallmighty 的 beat-detection 逻辑；避免直接引入 AGPL 的 audioMotion-analyzer 到闭源商业页面，除非接受 AGPL 义务。
- 与 Marathon 的视觉身份（高对比、几何、UI 密度）最契合的可视化形态是低帧率的频谱条块、径向 LED 环与粒子噪声，而非平滑的波形曲线——这是设计判断，非来源结论。

### Gaps
- CodePen 上的音频可视化示例未能检索（搜索配额耗尽）。
- MDN 教程页正文（fftSize、getByteTimeDomainData 等的具体代码）无法抓取；核心 API 用法以 MDN 仓库示例与 audioMotion README 为据。
- aenlow、kantelabs 等仓库的许可未核实。
