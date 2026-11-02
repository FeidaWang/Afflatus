# Marathon（Bungie, 2026）补充研究：关闭前轮遗留缺口

> **方法学说明**：本轮在沙箱中只能抓取 github.com / raw.githubusercontent.com / registry.npmjs.org；所有其他站点（bungie.net、Apple Music、Spotify、Discogs、MusicBrainz、Fonts In Use、Kurppa Hosk、Reddit 及其镜像、PCMag、marathonthegame.com 等）均返回 000/403。因此除 GitHub 与 npm registry 的数据为**全文直读**外，其余事实均来自搜索引擎返回的页面摘要。摘要中只出现一次、无法二次核实的内容标注 **【未核实】**。reddit.com 与 pcmag.com 被搜索爬虫明确拒绝（API 400："not accessible to our user agent"），所以 Reddit 线索只能通过第三方镜像（lr.us.psf.lt、redlib、libreddit、reddit.sentinel-team.org）间接获得。本轮共执行约 58 次 WebSearch、4 次 Bash 直连抓取。

---

## 缺口 1：官方 OST —— Vol. I 完整曲目与时长；Spotify / Apple Music 专辑 URL；是否有官方 Bandcamp

### Takeaway
Apple Music 的 Vol. I 专辑页已定位（ID 1877959843，29 轨、约 54 分钟、2026-03-06、Milan Records / Sony Music）；Spotify 只找到单曲页，**未找到两卷专辑页 URL**。Vol. I 的 29 轨中已能确认 1–6 轨与 25–29 轨的曲名/时长及散见于中段的若干曲名，7–24 轨顺序仍缺。**没有官方 Bandcamp**：Ryan Lott 的 Bandcamp 只列出 *Tell Me Why* 等其他作品。

### Cited Findings
**流媒体 / 商店 URL**
- Apple Music Vol. I 专辑页：*Marathon, Vol. I: Somewhere in the Heavens (Original Game Soundtrack)*，29 轨、约 54 分钟、发行日 2026-03-06，版权 Bungie, Inc.，独家授权 Milan Records（Sony Music Entertainment 旗下） — [Apple Music 专辑](https://music.apple.com/us/album/marathon-vol-i-somewhere-in-the-heavens-original-game/1877959843)
- Apple Music Ryan Lott 艺人页（"Latest Release" 显示 2026-03-06、29 songs） — [Apple Music 艺人页](https://music.apple.com/us/artist/ryan-lott/461009350)
- Apple Music 单曲页：*Rhythm of Writhing Constellations*（ID 1877959845） — [music.apple.com/gb/song/1877959845](https://music.apple.com/gb/song/rhythm-of-writhing-constellations/1877959845)；*We Stole a Moon*（1877960086） — [music.apple.com](https://music.apple.com/us/song/we-stole-a-moon/1877960086)；*We're All Monsters*（1877960089） — [music.apple.com](https://music.apple.com/bj/song/were-all-monsters/1877960089)；*It Wasn't a Dream*（1877959870） — [music.apple.com](https://music.apple.com/us/song/it-wasnt-a-dream/1877959870)
- Shazam 的 *Code Race* 条目 ID 为 1877959844（与 Apple 专辑 ID 1877959843 相邻，说明是同一专辑的第 1 轨） — [Shazam](https://www.shazam.com/song/1877959844/code-race)
- Spotify 单曲页（专辑页未出现在结果中）：*Code Race – Brendan Angelides Remix*（Ryan Lott, Brendan Angelides） — [open.spotify.com/track/62YV5TTyWveY5ODBxn2L9l](https://open.spotify.com/track/62YV5TTyWveY5ODBxn2L9l)；*It Wasn't a Dream* — [open.spotify.com/track/1HrFpj9Oi2QJ1cNGbiJEuz](https://open.spotify.com/track/1HrFpj9Oi2QJ1cNGbiJEuz)；*Repetition Is Where We Find the Truth* — [open.spotify.com/track/2NSyQtz33fxzX2JvudQ3g5](https://open.spotify.com/track/2NSyQtz33fxzX2JvudQ3g5)
- Deezer Vol. I 专辑 — [deezer.com/us/album/921339701](https://www.deezer.com/us/album/921339701)（Vol. II 为 921339091，见前轮笔记）
- Amazon Music Vol. I（ASIN B0GNTS516V） — [Amazon](https://www.amazon.com/Marathon-Vol-Somewhere-Original-Soundtrack/dp/B0GNTS516V)；*We Stole a Moon* 单曲 B0GNW74LBR — [Amazon Music MX](https://music.amazon.com.mx/tracks/B0GNW74LBR)
- 其他目录：MusicBrainz（总长 53:42） — [MusicBrainz](https://musicbrainz.org/release/ad485ab8-58f5-4669-ad4b-9356903a1b27)；Rate Your Music（总长 53:27） — [RYM](https://rateyourmusic.com/release/album/ryan-lott/marathon-vol-i-somewhere-in-the-heavens/)；Discogs — [Discogs](https://www.discogs.com/release/36703786-Ryan-Lott-Marathon-Vol-I-Somewhere-In-The-Heavens-Original-Game-Soundtrack)；OTOTOY（日本 Hi-Res 商店） — [OTOTOY](https://ototoy.jp/_/default/p/3483762)；Beatport 艺人页 — [Beatport](https://www.beatport.com/artist/ryan-lott/1045450/tracks?page=1&per_page=50)；SensCritique — [SensCritique](https://www.senscritique.com/album/marathon_vol_i_somewhere_in_the_heavens_original_game_soundt_Bande_Originale/135867534)；Lyreka（"Tracks: 29 · 0 with lyrics"，即全部为纯器乐/无歌词登录） — [Lyreka](https://www.lyreka.com/album/ryan-lott-marathon-vol-i-somewhere-in-the-heavens-original-game-soundtrack)
- Milan Records 单曲 *Planetary Relocation Psychosis* 的 YouTube 官方音频（"Provided to YouTube by Milan Records"） — [YouTube uLeHJbxG5g0](https://www.youtube.com/watch?v=uLeHJbxG5g0)

**Bandcamp**
- Ryan Lott 的 Bandcamp 主页只列出 *Tell Me Why (Original Game Soundtrack)* 等旧作，无 Marathon — [ryanlott.bandcamp.com/music](https://ryanlott.bandcamp.com/music)
- 搜索中出现的 marathon.bandcamp.com 是同名硬核乐队（专辑 *Never Safe*），与游戏无关 — [marathon.bandcamp.com](https://marathon.bandcamp.com/album/never-safe)

**Vol. I 曲目表（29 轨，合并自 Discogs / RYM / MusicBrainz / SensCritique / Raygum / download-soundtracks 摘要）**
| # | 曲名 | 时长 | 来源 |
|---|------|------|------|
| 1 | Code Race | 2:02 | [Raygum](https://raygum.com/releases/1BBMIEIlsROt/marathon-vol-i-somewhere-in-the-heavens-original-game-soundtrack) |
| 2 | Rhythm of Writhing Constellations | 2:25 | 同上 |
| 3 | A New Home for Humanity | 1:37 | 同上 |
| 4 | Discontent | 2:22 | [Discogs](https://www.discogs.com/release/36703786-Ryan-Lott-Marathon-Vol-I-Somewhere-In-The-Heavens-Original-Game-Soundtrack) |
| 5 | Planetary Relocation Psychosis | 1:51（RYM）/ 1:52（KHInsider） | [RYM](https://rateyourmusic.com/release/album/ryan-lott/marathon-vol-i-somewhere-in-the-heavens/)；[KHInsider](https://downloads.khinsider.com/game-soundtracks/album/marathon-vol-i-somewhere-in-the-heavens-original-game-soundtrack-2026) |
| 6 | New Behavioral Norms | 1:18 | [Deezer](https://www.deezer.com/us/album/921339701)；[MusicBrainz](https://musicbrainz.org/release/ad485ab8-58f5-4669-ad4b-9356903a1b27) |
| 7–24 | **顺序未取得**；已确认属于本专辑但位置不明的曲名：We Stole a Moon (2:02)、It Wasn't a Dream、Repetition Is Where We Find the Truth、We're All Monsters、Conversation With the Infinite Self (1:32)、We Planned for Everything (0:58)、Deprecated Systems (1:46) | — | [Apple Music](https://music.apple.com/us/album/marathon-vol-i-somewhere-in-the-heavens-original-game/1877959843)；[Spotify](https://open.spotify.com/track/1HrFpj9Oi2QJ1cNGbiJEuz)；[Discogs](https://www.discogs.com/release/36703786-Ryan-Lott-Marathon-Vol-I-Somewhere-In-The-Heavens-Original-Game-Soundtrack) |
| 25 | Decontamination Protocol | 2:17（Discogs/RYM/Bungie）/ 2:18（MusicBrainz）；download-soundtracks 将其列为第 26 轨 | [download-soundtracks](https://download-soundtracks.com/game_sountdtracks/marathon-vol-1-2-soundtrack-by-ryan-lott/) |
| 27 | Only Numbers and Letters | 1:30 | [Discogs](https://www.discogs.com/release/36703786-Ryan-Lott-Marathon-Vol-I-Somewhere-In-The-Heavens-Original-Game-Soundtrack) |
| 末段 | Code Race (Brendan Angelides Remix)；In Death We've Just Begun (ft. Poppy & Son Lux) | — | [Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now)；[Spotify](https://open.spotify.com/track/62YV5TTyWveY5ODBxn2L9l) |
- 总时长：RYM 53:27 vs MusicBrainz 53:42（相差 15 秒，可能源于各轨四舍五入） — [RYM](https://rateyourmusic.com/release/album/ryan-lott/marathon-vol-i-somewhere-in-the-heavens/)；[MusicBrainz](https://musicbrainz.org/release/ad485ab8-58f5-4669-ad4b-9356903a1b27)
- Vol. II 规格：13 轨 / 98:30，Hi-Res 数字专辑 — [fmdb](https://www.fmdb.net/releases/d51a4f45-83d9-4631-9342-80c76373e34a)
- 一个搜索摘要称 Apple 艺人页上 6:58 的 *Somewhere in the Heavens* "在 Vol. I 上"，与 Bungie 官方曲目表（该曲为 Vol. II 第 1 轨）冲突 **【未核实，倾向于摘要误读】** — [Bungie.net](https://www.bungie.net/7/en/News/Article/marathon_ost_streaming_now)

### Inferences
- Apple Music 的连续 ID（1877959843 专辑、…844 Code Race、…845 Rhythm…、…870 It Wasn't a Dream、…086/089 后段曲目）暗示 Apple 曲目 ID 大致按曲序递增，可用于日后在能访问 Apple Music 时快速校对 7–24 轨顺序。
- Spotify 专辑页大概率存在（单曲页均有），但搜索索引未收录；在可访问环境中搜索 Spotify "Ryan Lott Marathon" 即可。

### Gaps
- Vol. I 第 7–24 轨的顺序与时长仍未取得（所有目录站全文被屏蔽）。
- Spotify 两卷专辑 URL、Apple Music Vol. II 专辑 URL 未出现在任何搜索结果中。
- Milan Records 官网专辑页未出现。

---

## 缺口 2：2025-04-12 玩法揭晓预告与 2025-12-15 ViDoc 的配乐；Mielgo 短片是否用了 Bach BWV 974

### Takeaway
三条线索都**没有找到可靠的曲目识别**：玩法揭晓预告与 "Vision of Marathon" ViDoc 的配乐在所有搜索结果（含 WhatSong/Tunefind 类站点）中均未被命名；Mielgo 短片方面，唯一的一手资料是 Annecy 2026 官方条目，它把 **Ryan Lott 列为该短片的作曲**，没有任何可信来源提及 Bach / Marcello 的 Adagio，Bach 说法仍只停留在一则 r/Marathon 帖子。

### Cited Findings
- Bungie 官方揭晓回顾页只描述玩法预告为 "a high-speed look at Marathon's gameplay… a lot of vibes and gunplay action"，未提配乐 — [Bungie.net: Gameplay Reveal Showcase](https://www.bungie.net/7/en/News/Article/gameplay_reveal_showcase)；[Bungie 新闻稿](https://press.bungie.com/Bungie-premieres-gameplay-and-news-of-Marathon-in-stacked-showcase)
- 揭晓前的 ARG 曾放出 "snippets of new music and character art"，但来源未说明是哪些曲目 — [Windows Central](https://www.windowscentral.com/gaming/marathon-bungie-release-date-september-2025)
- 一个粉丝视频标题为 "Bungie's Marathon New Secret Track Found!"（内容未核实，可能与 ARG 音乐相关） **【未核实】** — [YouTube BOB6lvI3Y8c](https://www.youtube.com/watch?v=BOB6lvI3Y8c)
- "Vision of Marathon" ViDoc：Bungie 官方文章 2025-12-15 发布，描述为探索 "dark sci-fi world and survival extraction gameplay, as told by the development team"；无配乐信息 — [Bungie.net: marathonvidoc](https://bungie.net/7/en/News/Article/marathonvidoc)；长度约 23 分钟 **【仅见于一则新闻标题，未核实】** — [Ground News 转载](https://groundnews.lakegeneva.lib.wi.us/article/bungie-goes-in-depth-with-23-minute-long-vision-of-marathon-featurette)
- **Mielgo 短片音乐**：Annecy 2026 "Marathon – Reveal Cinematic Short" 条目列出 Direction & Script: Alberto Mielgo；**Music: Ryan Lott**；制作 Pinkman.TV（EP Sergio Jimenez），联合制作 Illusorium、Agora；配音 Erica Lindbeck (Glitch)、Elias Toufexis (Void)、Nika Futterman (Blackbird)、Donnla Hughes (Oni)、Ben Starr (Narrator) — [Annecy Festival](https://www.annecyfestival.com/en/the-mifa/themes/mifa-cross-ip/video-game-cinematic-works-game-trailers-competition/video-game-cinematics-game-trailers-2026/marathon-reveal-cinematic-short)
- Gizmodo 评论只说短片有 "some sweet music"，未指名 — [Gizmodo](https://gizmodo.com/bungies-new-marathon-game-has-an-amazing-short-film-2000588687)
- Mielgo 本人澄清短片非 AI 制作 — [PC Gamer](https://www.pcgamer.com/software/ai/marathon-cinematic-director-alberto-mielgo-says-the-8-minute-reveal-video-was-not-made-with-ai-and-frankly-he-cant-believe-he-even-has-to-say-that)
- Bach 说法唯一来源仍是 r/Marathon 帖 "What's the exact version of Adagio BWV 974 used in…"（见前轮笔记，镜像 redlib.hbubli.cc）；本轮针对 "Mielgo Marathon Bach BWV 974 / Marcello adagio" 的两次搜索均只返回乐谱/唱片页，**零命中** — [Stretta 乐谱页示例](https://www.stretta-music.fi/bach-adagio-nr-1272794.html)

### Inferences
- Annecy 把 Ryan Lott 列为短片作曲，说明短片至少主体配乐是 Lott 原创；Bach Adagio 若存在，更可能是短片某一段（例如结尾）插入的既有古典录音，这与 Reddit 帖"问的是哪个版本"的措辞一致，但**没有任何可引用的证据**。
- 玩法揭晓预告（2025-04）早于 EP（2026-02）发布十个月；若其配乐是 Lott 作品，最可能后来收录于两卷 OST 中，但无法确认具体曲目。

### Gaps
- 玩法揭晓预告配乐：仍完全未知。
- ViDoc 配乐：未知。
- Bach BWV 974：未获得官方/媒体确认，维持 **【未核实】**。

---

## 缺口 3：YouTube —— 4K / 无解说玩法频道、官方频道与四支官方视频 URL

### Takeaway
官方频道为 **youtube.com/@MarathonTheGame**（Bungie 新闻稿与 GamingTrend 社媒列表确认）。通过 youtube.com 域限定搜索取得了玩法揭晓预告、ViDoc、发售预告、Season 2 预告等多个 URL，但**上传频道归属（Bungie / PlayStation / IGN）无法从摘要确认**；"Official …" 前缀标题通常是 IGN 的命名习惯。另找到 7 条 4K 无解说实机视频 URL，但频道名称均未能从摘要取得。

### Cited Findings
**官方频道**
- Bungie 新闻稿与 GamingTrend 列出 Marathon 官方 YouTube 为 https://www.youtube.com/@MarathonTheGame — [Bungie Press](https://press.bungie.com/Bungie-premieres-gameplay-and-news-of-Marathon-in-stacked-showcase)；[GamingTrend](https://gamingtrend.com/news/bungies-marathon-getting-big-gameplay-reveal-this-saturday/)
- 揭晓直播在 Bungie 的 Twitch、YouTube、TikTok 同步播出 — [Game Informer](https://gameinformer.com/2025/04/07/bungies-marathon-gets-gameplay-reveal-this-weekend)

**2025-04-12 玩法揭晓相关**
- "Marathon - Official Gameplay Reveal Trailer"（标题风格为 IGN 式） — [YouTube X8z0WsYKm2k](https://www.youtube.com/watch?v=X8z0WsYKm2k)
- "Marathon - Official Gameplay Overview Trailer" — [YouTube T-uD1ueuqOE](https://www.youtube.com/watch?v=T-uD1ueuqOE)
- "Marathon Gameplay Reveal Showcase - Livestream" — [YouTube RgaelQkrPG0](https://www.youtube.com/watch?v=RgaelQkrPG0)；另一上传 — [YouTube qnfkYA97qxw](https://youtube.com/watch?v=qnfkYA97qxw)
- PC Gamer 论坛帖给出的另一个揭晓预告链接 **【频道未核实】** — [YouTube fvbEnWLRo1s](https://www.youtube.com/watch?v=fvbEnWLRo1s)（来自 [PC Gamer Forums](https://forums.pcgamer.com/threads/marathon-game-reveal-trailer.147848)）
- Know Your Meme：揭晓预告 2025-04-12 在 YouTube 首播，三天内 80.9 万次观看 — [Know Your Meme](https://amp.knowyourmeme.com/memes/subcultures/marathon-2025)；另有报道称其一度 32K 踩 vs 21K 赞 — [Tech4Gamers](https://tech4gamers.com/?p=312497)

**2025-12-15 "Vision of Marathon" ViDoc**
- "Vision of Marathon" — [YouTube fjzmhROTv28](https://www.youtube.com/watch?v=fjzmhROTv28)；"Vision of Marathon - ViDoc" — [YouTube 98lj0k2iUhA](https://www.youtube.com/watch?v=98lj0k2iUhA)；"Marathon - Bungie ViDoc: Vision of Marathon"（PlayStation 频道式标题） — [YouTube 4J91kh56jiA](https://www.youtube.com/watch?v=4J91kh56jiA)；IGN 式 "Official 'Vision of Marathon' Overview" — [YouTube jRqbMYJPOIs](https://www.youtube.com/watch?v=jRqbMYJPOIs)；日文版 — [YouTube DwySMgM9tSI](https://www.youtube.com/watch?v=DwySMgM9tSI)；法国 PlayStation 社区页嵌入的版本 — [youtu.be/GmieYm5D95M](https://youtu.be/GmieYm5D95M)（来自 [WeArePlayStation.fr](https://www.weareplaystation.fr/communautes/marathon/actualites-communaute/un-regard-sur-marathon-vidoc-bungie-ps5-pc)）
- ViDoc 经 PlayStation Blog 与 YouTube 同步发布 — [Bleeding Cool](https://bleedingcool.com/games/marathon-released-a-special-vidoc-showing-off-the-game)

**2026 发售期预告**
- 发售 cinematic（即 *In Death We've Just Begun* MV）：官方 MV 为前轮已知的 vtw5BDpKgJM；IGN 式上传 "Marathon - Official Launch Cinematic Trailer" — [YouTube KF24WS4MMC0](https://www.youtube.com/watch?v=KF24WS4MMC0)
- "Marathon 2026 Official Launch Gameplay Trailer"（2026-02-12，State of Play；描述 "lost colony of Tau Ceti IV, where Runners risk everything"） — [YouTube f5TcwVlHnKU](https://www.youtube.com/watch?v=f5TcwVlHnKU)；相关报道 — [SKNR](https://www.sknr.net/2026/02/12/marathon-launch-gameplay-trailer)
- "Marathon - Official 'Death Awaits' Gameplay Trailer"（Server Slam 前） — [YouTube og_zNZaRJ7U](https://www.youtube.com/watch?v=og_zNZaRJ7U)；另一上传 — [YouTube aUKsxnxKGjo](https://www.youtube.com/watch?v=aUKsxnxKGjo)；报道 — [Wccftech](https://wccftech.com/bungie-marathon-gamelay-new-impressive-death-awaits-trailer/)
- "Marathon - Official Pre-Order Trailer" — [YouTube jvKlj2JwGeg](https://www.youtube.com/watch?v=jvKlj2JwGeg)；"Official Cryo Archive Launch Trailer" — [YouTube VM98pok9Syo](https://www.youtube.com/watch?v=VM98pok9Syo)

**Season 2 "Nightfall"（2026-06-02 开启）预告**
- 德国 PC Games 文章嵌入的 Season 2 预告 — [YouTube HmSS0NI94Ro](https://www.youtube.com/watch?v=HmSS0NI94Ro)（来自 [PC Games DE](https://www.pcgames.de/Marathon-Spiel-74285/News/Season-2-Release-PvE-Modus-Gratis-Aktion-1536755/)）；预告在 State of Play 首播，主打 Dire Marsh (Night) 恐怖氛围、新 Shell "Sentinel" — [PCGamesN](https://www.pcgamesn.com/marathon/season-2-trailer)；[The FPS Review](https://www.thefpsreview.com/?p=150925)；[TheSixthAxis](https://www.thesixthaxis.com/?p=472206)；官方新闻稿 — [Game Developer](https://www.gamedeveloper.com/press-release/marathon-season-2-is-live-now-)

**4K / 无解说实机视频（频道名未取得）**
1. "MARATHON Gameplay Walkthrough FULL GAME (4K 60FPS) No Commentary"（2026-03，描述列出 PS5 Pro / PC / Xbox Series X / Switch 2） — [YouTube 2jPIJ963OJs](https://www.youtube.com/watch?v=2jPIJ963OJs)
2. "Marathon Server Slam Gameplay Walkthrough Full Game (4K 60FPS) No Commentary"（PC，High 设置） — [YouTube ZlG7stpDPXU](https://www.youtube.com/watch?v=ZlG7stpDPXU)
3. "Marathon - PS5 Pro 4K 60FPS Gameplay"（2026-02 open beta，无解说） — [YouTube Y1d7GB_3b-4](https://www.youtube.com/watch?v=Y1d7GB_3b-4)
4. "MARATHON 4K Ultra Max Settings - RTX 5090 + Core Ultra 9 (64GB RAM) Raw Gameplay (NO COMMENTARY)"（45 分钟） — [YouTube sPFGW83YJoQ](https://www.youtube.com/watch?v=sPFGW83YJoQ)
5. "Marathon - PERIMETER - GLITCH Gameplay - PS Pro 4k 60FPS HDR [No Commentary]" — [YouTube K_jDceAH78k](https://www.youtube.com/watch?v=K_jDceAH78k)
6. "Night Dire Marsh" Season 2 单人 Sponsored Survival run，4K Ultra 无解说 — [YouTube MQXGcn5H19Y](https://www.youtube.com/watch?v=MQXGcn5H19Y)
7. "MARATHON Gameplay Xbox Series X"（4K，西语频道，无解说） — [YouTube xXqrXSL6z6o](https://www.youtube.com/watch?v=xXqrXSL6z6o)
- DTube 用户 @phasewalker 的 PC 4K 实机（开场/教程/撤离） — [DTube/Steemit](https://steemit.steemapps.com/dtube/@phasewalker/marathon)
- ElAnalistaDeBits 发布了 PS5 vs PS5 Pro 对比视频（两机均稳定 60fps，Pro 有 PSSR、更好的 AO 与反射） — [Multiplayer.it](https://multiplayer.it/notizie/marathon-confronto-su-ps5-e-ps5-pro-in-un-video.html)
- PS5 Pro 版内部 5K 渲染再降采样到 4K，锁 60fps，无 120fps 模式 — [KitGuru](https://www.kitguru.net/tech-news/mustafa-mahmoud/marathon-on-ps5-pro-runs-at-a-native-5k-resolution/)；[SeekingTech](https://seekingtech.com/marathon-on-ps5-pro-60-fps-performance-test-with-pssr/)

### Inferences
- 视频 1 的描述格式（多平台罗列 + "FULL GAME 4K 60FPS No Commentary"）是 "Gamer's Little Playground / MKIceAndFire" 一类大型无解说频道的典型模板，但频道归属**未核实**。
- 带 "Official" 前缀的标题（X8z0WsYKm2k、T-uD1ueuqOE、KF24WS4MMC0、jRqbMYJPOIs 等）很可能是 IGN 上传；Bungie 自家频道的同名视频应在 @MarathonTheGame 下另有 ID。做引用时应优先在该频道内核对。

### Gaps
- 所有 YouTube 频道名称（官方与粉丝）均无法从摘要读取；youtube.com 页面无法打开。
- 哪一个 ViDoc URL 属于 Bungie 官方频道（而非 PlayStation / IGN）未确认。

---

## 缺口 4：Reddit r/Marathon —— 概念图、HUD 截图、UI 批评帖；"identify this font" 帖

### Takeaway
reddit.com 被搜索爬虫明确拒绝，只能靠镜像。确认存在：r/Marathon 2023-05-29 "Garrett Post Marathon Art appreciation thread"（225 赞）、2024-07-17 美术风格对比讨论帖、Bach BWV 974 问帖（前轮）、以及 **r/IdentifyThisFont 上一则"新 Marathon 游戏，求识别上/下两种字体"的帖子（快照中未见回答）**。没有找到专门的 HUD 截图合集或 UI 批评 megathread；UI 批评主要通过媒体报道间接可见（Elliott Gray 回应的是一位玩家发布的"简化版 UI"重设计图）。

### Cited Findings
- r/Marathon "Garrett Post Marathon Art appreciation thread"，2023-05-29，媒体帖，225 upvotes（Garrett Post 为 Bungie 概念艺术家；其 ArtStation 作品 "Recon Number 54"） — [镜像 lr.us.psf.lt](https://lr.us.psf.lt/r/Marathon/comments/13uj797/garrett_post_marathon_art_appreciation_thread)；[ArtStation](https://garrettpost.artstation.com/projects/L2Ak3v)
- r/Marathon 2024-07-17 "How would you compare the art styles of the games…" — [镜像 lr.eu.psf.lt](https://lr.eu.psf.lt/r/Marathon/comments/1e56dgu/how_would_you_compare_the_art_styles_of_the_games)
- r/IdentifyThisFont：帖子 "From the new Marathon game, trying to identify both top and bottom fonts"，快照未显示回答 **【内容未核实，快照日期不明】** — [libreddit 快照](https://libreddit.winscloud.net/r/IdentifyThisFont)
- 存在姊妹子版 r/MarathonTheGame — [redlib 镜像](https://redlib.hyperreal.coffee/r/MarathonTheGame/hot)
- reddit.sentinel-team.org 上两条 r/Marathon 帖子快照（ID 1u5znt3，2026-06-15；ID 1rloljq，2026-03-05）在多次 UI/概念图相关搜索中反复出现，但内容无法读取 **【未核实】** — [快照 1u5znt3](https://reddit.sentinel-team.org/posts/1u5znt3/snapshots/2026-06-15T23%3A30%3A03.445177Z)；[快照 1rloljq](https://reddit.sentinel-team.org/posts/1rloljq/snapshots/2026-03-05T23%3A04%3A40.26435Z)
- Reddit UI 抱怨经媒体转述："ready up menus are like 6 menus in"、库存管理比 Apex / ARC Raiders 更头疼；亦有玩家辩护 — [Mein-MMO](https://mein-mmo.de/en/marathon-user-interface-diskussion,1554307/)；[Notebookcheck（Steam 好评 vs Reddit 警告）](https://www.notebookcheck.net/Steam-reviews-praise-Marathon-while-Reddit-warns-of-punishing-gameplay.1247580.0.html)
- Elliott Gray 的 "fontslop merchant" 回应针对的是一位玩家发布的"简化版" UI 重设计图 — [GamesRadar](https://www.gamesradar.com/games/fps/marathons-self-appointed-fontslop-merchant-says-dont-think-for-a-second-well-remove-the-sauce-from-the-new-shooters-controversial-ui-even-if-theres-plenty-of-work-to-do)；Ninja 称菜单是 "one of the most complex menus I've ever seen" — [inkl 转载](https://www.inkl.com/news/one-of-the-most-complex-menus-i-ve-ever-seen-ninja-fumes-over-marathon-ui)
- 官方概念图替代来源：ArtStation Magazine "Bungie Marathon Art Blast"（2026-06，含完整美术团队 credits，提及 West Studio、Karakter；团队自述风格为 "product design realism, graphic design boldness, and… Marathon weirdness"） — [ArtStation Magazine](https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/)；Aftermath "The Art of Marathon"（2026-06） — [Aftermath](https://aftermath.site/marathon-bungie-concept-art/)；Jeremy Hanna 的 key art 与早期概念 — [Concept Art World](https://conceptartworld.com/news/marathon-key-art-by-jeremy-hanna/)
- 粉丝站 marathon.bungie.org 定期转载 r/marathon 社区美术（如 Yael Rojas 的 30 周年图、Various-Instruction3 的 Collector's Edition 海报） — [marathon.bungie.org 2024-03](https://marathon.bungie.org/story/newmar24.html)；[2026-01](https://marathon.bungie.org/story/newjan26.html)
- 俄文站报道玩家展示"改进版 UI"并呼吁 Bungie 修改（前轮已知，原帖仍未取得） — [ixbt.games](https://ixbt.games/en/news/2026/03/01/igrokov-v-marathon-razocaroval-interfeis-oni-pokazali-ulucsennuiu-versiiu-i-prizvali-bungie-ispravit-igru.html)

### Inferences
- r/Marathon 没有被搜索引擎索引到的"概念图合集/HUD 截图 megathread"，更可能的入口是子版 wiki/置顶帖或 Discord；ArtStation Art Blast 与 Aftermath 专题是比 Reddit 更可靠的概念图来源。

### Gaps
- Reddit 原帖 URL（reddit.com 域）全部缺失；镜像快照内容未核实。
- r/IdentifyThisFont 帖子的发帖日期、图片、是否有人答出 KH Interference / Shapiro：未知。

---

## 缺口 5：Game UI Database / Interface In Game 是否收录 Marathon

### Takeaway
域限定搜索（gameuidatabase.com + interfaceingame.com）对 "Marathon" 只返回无关游戏页（Team Sonic Racing、F1 Mobile Racing 等），**两站均未见 Marathon 条目**；通用 "site:" 查询同样零命中。可以较有把握地说截至搜索索引时间两站未收录（但不排除索引滞后）。

### Cited Findings
- 域限定查询 "Marathon"（gameuidatabase.com, interfaceingame.com）返回的全部结果：Team Sonic Racing、F1 Mobile Racing、"Daily & Timed Rewards"、"Results Screen" 分类页，无 Marathon — [gameuidatabase.com/gameData.php?id=67](https://www.gameuidatabase.com/gameData.php?id=67)；[gameuidatabase.com/index.php?scrn=53](https://www.gameuidatabase.com/index.php?scrn=53)
- "site:gameuidatabase.com Marathon" 与 "site:interfaceingame.com Marathon" 均无该域结果（搜索引擎未遵守 site: 运算符，返回 MobyGames / Giant Bomb 等） — [MobyGames](https://www.mobygames.com/game/22079)
- 最接近"UI 截图库"的替代品：The Rookies 2026 粉丝 cinematic FUI 作品（entry 49939） — [The Rookies](https://www.therookies.co/entries/49939)；Fonts In Use 条目（含 UI 字体截图） — [Fonts In Use](https://fontsinuse.com/uses/67879/marathon-2026-video-game-1)

### Inferences
- 两站均依赖人工录入，Marathon 2026-03 发售、UI 争议大，日后被收录的概率高；建议在能访问时直接检索。

### Gaps
- 两站自身搜索功能无法调用；"未收录"只是搜索索引层面的结论。

---

## 缺口 6：Joseph Cross "graphic realism" 原帖；Space.com 访谈标题与 Brian Vinton；PCMag 评测配乐引语

### Takeaway
Cross 的原帖是 **X（Twitter）@josephacross 于 2023-05-30 发布的线程 "Marathon Art Style (a short thread)"**（Kotaku 文章内嵌）。Space.com 文章标题为 *Bungie explains Marathon's 'graphic retro futurism' aesthetic and the 'live narrative' lessons it learned from 'Destiny'*；Brian Vinton 在 VGC 人物页被列为 Marathon 的 Senior Art Director（但 Cross 离职报道也称 Cross 为 senior art director，头衔有冲突）。PCMag 评测标题为 *Marathon Review: A Wonderfully Reimagined Sci-Fi Shooter That Outguns the Competition*（2026-03-05 首发时未评分），配乐引语仍只能经镜像站引用，**作者署名未能取得**。

### Cited Findings
**Joseph Cross 原帖**
- Kotaku 文章内嵌 @josephacross 的 X 帖，日期 2023-05-30，标题 "Marathon Art Style (a short thread)" — [Kotaku](https://kotaku.com/marathon-bungie-development-runner-art-2000661234)
- 线程原话（经 Creative Bloq 转述）："Officially we call it 'Graphic Realism', this is mainly a production-facing term, meant to frame how we think about and prioritize aspects of our visual world." 两侧要素：simplified/deconstructed universal design language、strong graphic design and color statements、limited materials ↔ realistic proportions and scale、implied function and detail、grounded world — [Creative Bloq](https://www.creativebloq.com/3d/video-game-design/bungies-art-director-explains-marathons-controversial-art-style)
- 影响清单：Mirror's Edge、Aeon Flux、Ghost in the Shell、大友克洋、森本晃司、The Designers Republic、Chris Cunningham — [80.lv](https://80.lv/articles/marathon-art-director-shares-the-team-s-creative-influences)；[The Game Post](https://thegamepost.com/marathon-art-style-mirrors-edge-ghost-in-the-shell/)；[eXputer](https://exputer.com/news/games/marathon-art-style-mirrors-edge/)；[PSU](https://www.psu.com/news/marathon-takes-inspiration-from-mirrors-edge-ghost-in-the-shell-more-for-its-art-style/)；部分媒体还列出 Metal Gear Solid 2 与 F1/MotoGP（各家清单不一致） — [GINX](https://www.ginx.tv/en/?p=47953)
- Wikipedia 条目亦概括该定义 — [Wikipedia: Marathon (2026 video game)](https://en.wikipedia.org/wiki/Marathon_(2026_video_game))
- 一则 YouTube Short "Graphic Realism? the origin of the look of the viral new game" — [YouTube Shorts 5FMUICWflFw](https://www.youtube.com/shorts/5FMUICWflFw)
- Cross 2025-12 离职（在 Bungie 六年），2026-01 接受访谈："I believe in what we did…" — [Push Square](https://www.pushsquare.com/news/2025/12/marathon-art-director-departs-bungie-as-the-game-enters-its-final-stretch)；[Insider Gaming](https://insider-gaming.com/former-marathon-art-director-talks-positiv)

**Space.com 访谈**
- 标题：*Bungie explains Marathon's 'graphic retro futurism' aesthetic and the 'live narrative' lessons it learned from 'Destiny'*；文中引语："On Marathon, we call this aesthetic 'graphic retro futurism'"；风格起点是对旧 Marathon 的 "deconstruction"，并 "digging into" Halo/Destiny 时期演化出的 industrial sci-fi 与 "crisp graphic designs"；视觉线索包括 digital dithering；比 Destiny 的 space fantasy 更偏 science fiction 与 cosmic horror；"graphic realism" 是更早的生产术语 — [Space.com](https://www.space.com/entertainment/space-games/bungie-explains-marathons-graphic-retro-futurism-aesthetic-and-the-live-narrative-lessons-it-learned-from-destiny-interview)；[Ground News 转载](https://ground.news/article/bungie-explains-marathons-graphic-retro-futurism-aesthetic-and-the-live-narrative-lessons-it-learned-from-destiny-interview)
- **Brian Vinton**：VGC 人物页列为 Marathon (2026) 的 Senior Art Director，作品含 Destiny 2: Edge of Fate、Spellfall、Paper Toss 2.0 — [VGC People](https://www.videogameschronicle.com/people/brian-vinton/)；ArtStation Art Blast 的 credits 把 "Brian Vinton & Jason Sussman" 并列（未写头衔） — [ArtStation Magazine](https://magazine.artstation.com/2026/06/bungie-marathon-art-blast/)；TheOrg 上的 "Brian V." 为 Bungie Supervising Art Director / Head of Art Department，曾任 Riot Games 的 Director of Art Direction（LoL 皮肤） **【是否同一人未核实】** — [TheOrg](https://theorg.com/org/bungie/org-chart/brian-v)
- 头衔冲突：PSU 与 VGC 报道 Cross 离职时称 Cross 为 "senior art director"，而 ViDoc 中显示的 art director 为 Jason Sussman — [PSU](https://www.psu.com/news/marathon-has-lost-its-senior-art-director-just-a-few-months-ahead-of-the-games-launch/)；[VGC](https://www.videogameschronicle.com/news/marathons-senior-art-director-has-left-bungie-ahead-of-the-games-release)；[OpenCritic](https://opencritic.com/news/25094/marathon-art-director-leaves-bungie-just-3-months-before-the-extraction-shooters-official-launch)

**PCMag 评测**
- 标题 *Marathon Review: A Wonderfully Reimagined Sci-Fi Shooter That Outguns the Competition*；配乐段落："Composed by Ryan Lott (of the band Son Lux), the soundtrack is loaded with experimental electronic music… sparse tracks, packed with rhythmic hums, low growls, and other sounds, along with pulsating, looping industrial beats"；页面模板处显示 "OUR EXPERT — Writer, Hardware"，无署名 **【仅镜像站可读，未核实】** — [kreafolk 镜像](https://kreafolk.netlify.app/hoki-https-www.pcmag.com/reviews/marathon)
- Metacritic 类聚合页显示 PCMag 评测日期 2026-03-05、初始 "tbd"（评测者称仍在游玩后再定分） — [metacriticz 镜像](https://metacriticz.pages.dev/game/marathon/critic-reviews)；OpenCritic 评测列表 — [OpenCritic](https://opencritic.com/game/20182/marathon/reviews)
- pcmag.com 被搜索爬虫拒绝（API 400），无法取得原文 URL 以外的任何信息；原文 URL 应为 https://www.pcmag.com/reviews/marathon（由镜像 URL 还原） **【未核实】**

### Inferences
- "graphic realism"（2023，Cross）→ "graphic retro futurism"（2026，Space.com 访谈）的术语演变，与 Cross 2025-12 离职、Sussman/Vinton 接手的时间线吻合；引用时应注明两个术语分属不同时期与不同发言人。

### Gaps
- @josephacross 原线程直链（x.com/josephacross/status/…）未取得，只能通过 Kotaku 内嵌引用。
- Space.com 文章作者、具体受访者名单与 Vinton 的确切头衔：未核实。
- PCMag 评测作者：未取得。

---

## 缺口 7：色板 —— Omarchy 粉丝主题以外的 hex / 命名颜色来源

### Takeaway
**没有找到任何官方 hex 值**。Kurppa Hosk 团队的 LinkedIn 帖把品牌主色描述为 "vibrant orange"（与社区认知的酸性黄绿冲突），并确认原始 logo/identity 来自 Mother Design 与 PlayStation Studios Creative；Cornell 博客描述海报为 "lime green background"。GitHub 上除 Omarchy 外还有 3 个粉丝主题（Hermes "Republic/Daedalus"、VS Code、Zed），其中 Republic 使用 #DCFF00 / #0A0A0A / #E8E2D2 / #4AC4F8；品牌色聚合站（brandpalettes、colorpickercode）给出的蓝/红值明显是错误数据。

### Cited Findings
- Omarchy 主题 README（本轮直读 GitHub raw）：Accent #C2FE0B "Signature acid yellow-green"；Background #080A0E "Void black"；Foreground #E8EDDF "Off-white terminal readout"；Magenta #EA027E "Runner signal / faction marker"；Violet #3601FB "Deep corporate faction blue"；Cyan #01FFFF "Neon scan readout"；Orange #FF5500 "Warning / hot marker"；README 自述 "fan tribute, not affiliated"，并指出 PP Fraktion 的免费个人许可与商业字体（Shapiro、KH Interference、Ivy Presto）均禁止再分发 — [GitHub: Samat220/omarchy-marathon-theme](https://github.com/Samat220/omarchy-marathon-theme)；浅色变体 — [GitHub: Samat220/omarchy-marathon-light-theme](https://github.com/Samat220/omarchy-marathon-light-theme)
- JustinPerea/Republic（Hermes Agent 主题 "Daedalus"，自述 "in the visual language of The Designers Republic and Marathon (Kurppa Hosk × Bungie, 2026). Near-black, bone, radioactive yellow"）：badge 色值 #DCFF00（黄）、#0A0A0A（黑）、#E8E2D2（bone）、#4AC4F8（cyan）；色彩规则 "3-layer black/bone/yellow base + cyan secondary + magenta tertiary + lime success" — [GitHub: JustinPerea/Republic](https://github.com/JustinPerea/Republic)
- 其他粉丝主题（README 无 hex，需读主题文件）：VS Code — [GitHub: TravisC671/marathon-theme](https://github.com/TravisC671/marathon-theme)；Zed — [GitHub: Zev18/marathon-theme-zed](https://github.com/Zev18/marathon-theme-zed)
- Kurppa Hosk 团队 LinkedIn 帖：identity 使用 "vibrant orange" 主色与 "expressive typeface superfamily, refreshed logotypes"；另一帖称 logo 与 identity 源自 Mother Design 与 PlayStation Studios Creative，Kurppa Hosk 后任 lead creative agency **【单一社媒来源，未核实】** — [LinkedIn: Johanna Lundberg](https://se.linkedin.com/in/ijlundberg)；[LinkedIn: Kevin Mortensen](https://se.linkedin.com/in/kevinmortensen)
- Abduzeedo 专题：Kurppa Hosk 自 2021 年起合作四年，覆盖 world-building、faction design、community systems；官网被设计成 "in-universe document"；图片来源注明 Creative Review；无 hex — [Abduzeedo](https://abduzeedo.com/marathon-brand-identity-kurppa-hosk)
- Kurppa Hosk 官方案例页（被屏蔽，摘要）："partnered closely with… Bungie since autumn 2021"、"established the expressions of the Marathon brand and led the activation of the integrated 360 go-to-market plan spanning paid media, owned platforms, social, community environments"、核心理念 "designing the desire to play" — [kurppahosk.com/work/bungie](https://kurppahosk.com/work/bungie)；[Ads of the World](https://www.adsoftheworld.com/campaigns/bringing-marathon-to-life)；[Communication Arts](https://www.commarts.com/exhibit/marathon-campaign-1)
- Visuelle（另一家机构）称参与 faction identities、visual systems — [visuelle.co.uk/bungie](https://visuelle.co.uk/bungie/)
- Cornell College 博客描述海报："large black, blocky, vertical text, reading Marathon on a lime green background" — [Cornell College Digital Writing](https://digitalwriting.cornellcollege.edu/framedrop/?p=49)
- 不可信聚合站：brandpalettes 给 #005DAA / #ED174F；colorpickercode 给 #003087 / #FFFFFF；brandcolorcode 的 Bungie 色 #000000 / #BBBDBF / #00A3E3 并注明 "not given explicitly in the Bungie brand guidelines" — [brandpalettes](https://brandpalettes.com/marathon-logo-colors/)；[colorpickercode](https://colorpickercode.com/color-palette/brand-palettes/marathon/)；[brandcolorcode](https://www.brandcolorcode.com/bungie)
- 设计评论文 "Bungie's Marathon: An Eye for Design"（brace.design）存在，但针对性搜索未返回其内容 **【未核实】** — [brace.design](https://www.brace.design/single-post/bungie-s-marathon-an-eye-for-design)

### Inferences
- 两个独立粉丝主题的黄绿主色分别为 #C2FE0B 与 #DCFF00，底色 #080A0E 与 #0A0A0A，说明社区对"酸性黄绿 + 近黑 + 骨白 + 青 + 洋红"的共识较稳定；网页实现可在 #C2FE0B–#DCFF00 区间取值，并把 Kurppa Hosk 所说的 "vibrant orange"（Omarchy 的 #FF5500）作为次级警示色而非主色。
- LinkedIn 帖的 "vibrant orange" 可能指 2023 揭晓期 identity 的主色（Mother Design 版本），而酸性黄绿是 2025–26 发售期的主视觉；两者并存与前轮笔记中"色块 / 多色 faction"策略一致，但这只是推断。

### Gaps
- 官方品牌指南、Kurppa Hosk 案例页全文、Creative Review 原文：全部无法打开。
- X / Threads / Bluesky 上的设计师色板拆解帖：搜索零命中。

---

## 缺口 8：字体 —— KH Interference、Shapiro Wide、IvyPresto Headline、Fraktion Mono 的厂牌 / 许可 / 价格；免费替代

### Takeaway
四款字体的厂牌已全部确认：**KH Interference** = KH Type（Kurppa Hosk 的字体公司，按公司人数计价，有免费试用与学生许可，一处目录页显示 €108）；**Shapiro** = OGJ Type Design（Oliver Jeschke），MyFonts 单款 $29，"Std 65 Light Heavy Wide" 为最接近 "Wide 65" 的样式；**IvyPresto Headline** = The Ivy Foundry（Jan Maack，丹麦），2020-03-03 发布，Adobe Fonts 内含、厂牌直售每款 $35 起；**Fraktion Mono** = Pangram Pangram（设计 Juri Zaech），7 字重 + 斜体、可变字体、免费试用、许可 $40 起。**没有找到任何设计师针对 Marathon 推荐的免费替代方案**（Durandal Grotesque 仍是唯一 Marathon 专属的免费复刻）。

### Cited Findings
**KH Interference**
- 官方字体页：等宽展示字体，灵感来自收据打印与旧屏幕像素字；45° 网格、外圆角内直角；三字重 Light / Regular / Bold；带 ss01–ss03 样式集；设计 Thomas Kurppa、Jakob Ekelund、Wille Larsson；提供 .otf/.ttf/.woff/.woff2 — [khtype.com/typeface/kh-interference](https://khtype.com/typeface/kh-interference/)
- 目录页显示 "KH Interference 108€"（页面标注为 placeholder） **【价格未核实】** — [khtype.com 商品分类页](https://khtype.com/product-category/uncategorized/)
- 许可模式：以公司员工数为唯一计价指标；Unlimited 许可为一次性付费、需邮件报价（hello@khtype.com）；免费试用版文件名含 "TRIAL"；学生许可需邮件申请 — [khtype.com/licenses（镜像）](https://kelaenderkoe.pages.dev/Function-https-khtype.com/licenses/)
- 同厂其他产品页（供参考定价结构）：KH Hekto、KH Teka Mono、KH Shutter — [khtype.com/product/kh-teka-mono](https://khtype.com/product/kh-teka-mono/)
- Creative Boom 称其为 "uppercase-only monospaced typeface inspired by primitive letter shapes" — [Creative Boom](https://creativeboom.com/news/kh-type)

**Shapiro（Wide 65）**
- 厂牌 OGJ Type Design，设计师 Oliver Jeschke；MyFonts 宽体样式：Std 45 Welter Wide、Std 55 Middle Wide、**Std 65 Light Heavy Wide**、Std 75 Heavy Wide、Std 85 Super Heavy Wide、Std 95 Super Wide、Std 96 Inclined Wide，快照价每款 $29 — [MyFonts: Shapiro](https://www.myfonts.com/collections/shapiro-font-ogj-type-design)；[MyFonts 许可页](https://myfonts.com/fonts/ogj-typedesign/shapiro?tab=licensing)；[MyFonts: Std 95 Super Extd](https://www.myfonts.com/products/super-extd-shapiro-568990/)
- 家族史：2018 年首发 34 款；2024 年重绘重构为 normal / Wide 两宽度 × 7 字重 + 斜体 — [Fonts In Use: Shapiro](https://fontsinuse.com/typefaces/87826/shapiro)
- Fontspring 列出 34 款但标注 "not currently available (FA101)" — [Fontspring](https://www.fontspring.com/similar/ogj-type-design/shapiro)；FontShop 家族页 — [FontShop](https://www.fontshop.com/families/shapiro)；Shapiro Pro / Base 子家族 — [Fontspring: Shapiro Pro 76 Heavy](https://www.fontspring.com/fonts/ogj-type-design/shapiro-pro/shapiro-pro-76-heavy)

**IvyPresto Headline**
- The Ivy Foundry（丹麦，Jan Maack，2016 年起）；IvyPresto 三个视觉尺寸 Display / Headline / Text，各 5 字重 Roman + Italic；Display 与 Headline 于 2020-03-03 发布 — [Typecache](https://typecache.com/news/3661/)；[Type Network: Ivy Foundry](https://typenetwork.com/type-foundries/ivy-foundry)
- Adobe Fonts 收录（个人与商业使用；app 嵌入 / 自托管 web 字体需另向厂牌购买） — [Adobe Fonts: IvyPresto Headline](https://fonts.adobe.com/fonts/ivypresto-headline)
- 厂牌直售 IvyPresto Headline Regular 起价 $35；所有许可允许商业使用，app 嵌入 / 自动化系统 / 网站托管需不同许可 — [The Ivy Foundry（镜像）](https://ivyfoundry-com.pages.dev/services)；[ivy.typenetwork.com](https://ivy.typenetwork.com)

**Fraktion Mono**
- Pangram Pangram 产品页："Fraktion – Free to Try – A complete Sans and Monospace workhorse"；设计 Juri Zaech；基于复古招牌字；7 字重 + 斜体、可变字体；OpenType 含 case-sensitive punctuation、stylistic alternates、fractions、slashed zero；v1.10（2020-12）；**免费试用，许可 $40 起** — [pangrampangram.com/products/fraktion-mono](https://pangrampangram.com/products/fraktion-mono)
- Fontspring 同款页将 Juri Zaech 列为 publisher（"semi-technical grotesk", 10 styles, 2020） — [Fontspring](https://www.fontspring.com/fonts/juri-zaech/fraktion-mono)
- Pangram Pangram 成立于 2018，创始人 Mat Desjardins — [Pangram Pangram About](https://pangrampangram.com/pages/about-us)
- Omarchy 主题 README 指出 PP Fraktion 的免费个人许可禁止再分发 — [GitHub: Samat220/omarchy-marathon-theme](https://github.com/Samat220/omarchy-marathon-theme)

**免费替代（已有来源）**
- Durandal Grotesque（KryDotExe，免费个人使用，复刻 202X Marathon logo 字形） — [designbeep](https://designbeep.com/2026/03/14/durandal-grotesque-font/)
- FontStruct 上有人制作 "Bungie Marathon terminal font recreation"，等待联系版权方后公开 **【未核实】** — [FontStruct](https://fontstruct.com/gallery/tag/946/Glyphic)
- 低可信 SEO 页推荐 Michroma / Orbitron（标题）与 Saira / Inter（UI）作为 Bungie 风格通用替代，非 Marathon 专属 — [madegooddesigns](https://madegooddesigns.com/?p=9043)
- 原版 Modula Tall 无免费替代 — [Luc Devroye](https://luc.devroye.org/fonts-67666.html)

### Inferences
- **以下为研究者本人的推断性建议，无来源支撑**，仅按字形特征配对（Google Fonts 均可免费商用）：KH Interference（大写等宽、像素/收据感）→ Space Mono、Sixtyfour、Silkscreen、VT323；Shapiro Wide 65（宽体中性 grotesque）→ Archivo Expanded、Unbounded、Syncopate、Michroma；IvyPresto Headline（高反差展示衬线）→ Instrument Serif、DM Serif Display、Playfair Display；Fraktion Mono（方形工业等宽）→ JetBrains Mono、IBM Plex Mono、Geist Mono。
- 预算有限时的最省方案：Fraktion Mono 与 KH Interference 均有官方免费试用版可用于设计稿（不可上线）；IvyPresto Headline 对已有 Adobe CC 订阅者零成本。

### Gaps
- KH Interference 的确切价格区间（按公司规模）：只见 €108 占位值。
- Shapiro "Wide 65" 在 Marathon 中的"定制"内容：无来源。
- Fraktion Mono 在 Marathon 中的具体用途（HUD 小字？）：Fonts In Use 条目摘要未提及，仅 Omarchy 主题把它列为"Marathon 字体"之一 **【未核实】**。
- 设计师社群（X/Threads/Bluesky）的 Marathon 字体替代讨论：零命中。

---

## 缺口 9：marathonthegame.com 的技术栈 / 字体 / 动画描述

### Takeaway
**完全没有找到**任何文章、推文、Wappalyzer/BuiltWith 列表或 GitHub 讨论描述 marathonthegame.com 的技术栈；站点本身（返回 000）与 BuiltWith/Wappalyzer 均被屏蔽。唯有两条定性描述：Abduzeedo 称官网"被设计成 in-universe document"，一篇校园媒体评论称其"embraces the anti-website aesthetic"。

### Cited Findings
- 官网被设计为 "in-universe document"，是 Kurppa Hosk identity 的应用场景之一（与游戏界面、周边、Discord 并列） — [Abduzeedo](https://abduzeedo.com/marathon-brand-identity-kurppa-hosk)
- 官网 "embraces the anti-website aesthetic to anchor players in the game's world" — [The State Hornet](https://statehornet.com/2026/03/marathon-bungie-halo-destiny-extraction-shooter-fps-multiplayer-art-opinion-video-game/)
- Kurppa Hosk 的职责范围包含 "owned platforms"（即官网等自有渠道） — [kurppahosk.com/work/bungie](https://kurppahosk.com/work/bungie)
- ARG 使用了多个虚构企业站点（如 Sekiguchi Genetics） — [PC Gamer](https://pcgamer.com/bungies-marathon-arg-is-gorgeous-extensive-and-how-the-hell-do-people-work-this-stuff-out-anyway)；Polygon ARG 访谈（镜像） — [Polygon 镜像](https://updategamers.netlify.app/host-https-www.polygon.com/marathon-args-bungie-interview/)
- 官网首页标题在搜索结果中显示为 "Marathon Logo"（说明 `<title>` 或首个可索引文本为 logo alt） — [marathonthegame.com](https://marathonthegame.com)
- 两次针对 "marathonthegame.com + Next.js/WebGL/Vercel/Netlify/Webflow/Nuxt/Three.js/awwwards" 的搜索均无该域结果 — [Awwwards Netlify 分类（无关）](https://www.awwwards.com/websites/netlify/)
- 官方 Zendesk 帮助中心位于 help.marathonthegame.com（前轮已知），说明该域名至少用了 Zendesk 子域 — [help.marathonthegame.com](https://help.marathonthegame.com/hc/en-us/articles/46620187972756-Known-Issues-List)

### Inferences
- 既无 Awwwards/FWA 收录也无技术拆解，说明官网更可能是品牌代理（Kurppa Hosk 或其技术合作方）交付的常规营销站，而非 WebGL 实验型站点；"anti-website / in-universe document" 的描述与前轮笔记中 Michael Rigley 式"色块 + 故障"屏幕图形语言一致。
- 在可访问环境中最快的核实方式：查看响应头（`server`/`x-vercel-id`/`x-nf-request-id`）与源码中的 `/_next/`、`__NEXT_DATA__`、`webflow.js` 等标记。

### Gaps
- 技术栈、字体文件（woff2 名称）、动画库：全部未知。

---

## 缺口 10：动画 / 3D 库最新版本与 unpacked size（npm registry 直读）

### Takeaway
registry.npmjs.org 可直接访问，以下数据为 2026-11-02 实时读取的 `latest` dist-tag 元数据（unpackedSize 为 npm 安装包解压体积，**不是** gzip 后的浏览器加载体积；bundlephobia 被屏蔽）。

### Cited Findings
| 包 | latest | 发布时间 (UTC) | unpackedSize | 文件数 | 许可 | 来源 |
|----|--------|----------------|--------------|--------|------|------|
| gsap | 3.15.0 | 2026-04-13 | 6,258,071 B（≈6.0 MB） | 179 | "Standard 'no charge' license" | [registry.npmjs.org/gsap/latest](https://registry.npmjs.org/gsap/latest) |
| lenis | 1.3.27 | 2026-10-15 | 458,320 B（≈448 KB） | 26 | MIT | [registry.npmjs.org/lenis/latest](https://registry.npmjs.org/lenis/latest) |
| ogl | 1.0.11 | 2025-01-27 | 423,239 B（≈413 KB） | 121 | Unlicense | [registry.npmjs.org/ogl/latest](https://registry.npmjs.org/ogl/latest) |
| three | 0.187.0 | 2026-10-30 | 21,030,536 B（≈20.1 MB） | 1277 | MIT | [registry.npmjs.org/three/latest](https://registry.npmjs.org/three/latest) |
| motion | 14.9.0 | 2026-10-30 | 938,523 B（≈917 KB） | 44 | MIT | [registry.npmjs.org/motion/latest](https://registry.npmjs.org/motion/latest) |
| animejs | 4.5.0 | 2026-06-22 | 2,126,307 B（≈2.0 MB） | 215 | MIT | [registry.npmjs.org/animejs/latest](https://registry.npmjs.org/animejs/latest) |
- 各包 homepage：gsap → https://gsap.com（许可页 https://gsap.com/standard-license）；lenis → [github.com/darkroomengineering/lenis](https://github.com/darkroomengineering/lenis)；ogl → [github.com/oframe/ogl](https://github.com/oframe/ogl#readme)；three → https://threejs.org/；motion → [github.com/motiondivision/motion](https://github.com/motiondivision/motion#readme)；animejs → https://animejs.com（数据均来自对应 registry.npmjs.org 元数据）

### Inferences
- unpackedSize 包含源码、类型定义、多种构建产物与示例，与实际打包进页面的体积相差一到两个数量级（例如 three 的 20 MB 中大部分是 examples/jsm 与 src；lenis 核心压缩后通常只有几 KB 级）。做性能预算时应以 tree-shaking 后的 bundle 体积为准，本轮无法从 bundlephobia 取得。
- ogl 自 2025-01 起无新版本（近 22 个月），其余五个库 2026 年内均有更新；若项目要长期维护，ogl 的活跃度是需要注意的信号。

### Gaps
- gzip/minified 体积（bundlephobia / pkg-size）被屏蔽，未取得。
