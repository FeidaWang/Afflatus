# 本地参考包编目：`/Users/feida/Downloads/Marathon_Reference`

盘点日期：2026-11-02。资料夹为用户自建的"Marathon 视觉与声音参考包"（其 README 自述：63 张静图、5 段 MP4、机器可读目录）。**全部文件只在本地查看，不进仓库**；本文只记录文件名与观察结论。取色方法：用 ffmpeg 把图缩到 96×54 后统计主色与高饱和色，再对 UI 截图的平色块做 5×5 像素平均（JPEG 压缩会让荧光色偏暗约 5–10%，下文已注明）。

## 1. 分类编目（81 个文件，41 MB）

| 类别 | 数量 | 文件 | 备注 |
| --- | --- | --- | --- |
| 截图 · 官方场景（无 HUD） | 46 | `assets/screenshots/2025_DEC_Marathon_Press_Kit_Compressed_001–018.jpg`（18）、`2026_Marathon_Cryo_Unlock_Press_Kit_COMPRESSED_01–13.jpg`（13）、`2026_Marathon_S2_Launch_Press_Kit_COMPRESSED_001–015.jpg`（15） | 均为 1920×1080 压缩版 press kit 图；来源页依次为 press.bungie.com 的 2025-12-15、2026-03-19、2026-05-27 媒体包（见 `image_index.csv`） |
| 截图 · 官方环境（Cradle） | 1 | `Cradle_Enviormental.jpg` | Season 2 媒体包 |
| 截图 · 官方游戏 UI | 6 | `Cradle-Menu_Sentinel.jpg`、`Cradle_LVL50_EN.jpg`、`Cradle_LVL30_MAX_DEX_052226_EN.jpg`、`Cradle_LVL50_MAX_STR_Tooltip_EN.jpg`、`Convert-Matter_LVL50_Selection_EN.jpg`、`Vault_Items_MatterCoverter_Popup_EN.jpg` | 2026-05-27 Season 2 媒体包；是**目前唯一的官方菜单截图**，1920×1080 原始压缩 |
| 概念 / 插画（作者页） | 10 | `assets/concept/daniel_*.jpg`（4，Daniel Chavez）、`west_world_WestStudio-Marathon-{1,4,8}.jpg`、`west_seasons_WestStudio-Marathon2-{1,3,8}.jpg`（West Studio） | 来自 daniolart.com 与 weststudio.com；画面带 "BUNGIE ／ MARATHON ／ WEST STUDIO" 页脚色条 |
| 视频 | 5 | `assets/motion/DAC_new.mp4`、`Kurppa-Hosk_Bungie_14.mp4`、`Kurppa-Hosk_Bungie_43.mp4`、`TCW_Runner_04.mp4`、`TCW_Weapon_02.mp4` | 全部来自 kurppahosk.com/work/bungie（Sanity CDN 原件），**是品牌营销与 tauceti.world 网站的动效，不是游戏 HUD**；无音轨 |
| 视频封面 | 5 | 同名 `*_poster.jpg` | 从各片 0.5 s 抽帧 |
| 拼图总览 | 2 | `Marathon_Official_Screenshots.jpg`（9 张场景拼图）、`Marathon_Official_UI.jpg`（6 张 UI 拼图） | 由上面截图合成，含标注 |
| 文档 | 6 | `README.md`、`Marathon_Research_Report.md`（60 KB 中文研究）、`index.html`（离线图册）、`image_index.csv`（63 行逐图出处）、`source_index.csv`（85 条来源）、`reference_manifest.json`（clips / artist_projects 30 / motion_projects 27 / music_items 12） | 文档只引用线上链接，不含图片 |
| 音频 | 0 | — | 无任何音频文件；OST 只以外链存在 |
| PDF / 设定集 | 0 | — | 无 |

`reference_manifest.json` 的 `artist_projects`（30 条）与 `motion_projects`（27 条）大体与笔记 02 / 03 的链接重合，并多出 Dylan Teter、Eve Astra、Nikodem Malec 等 ArtStation 条目；它们的归属已在 `10_live_verification.md` §D 用 ArtStation 公开 JSON 逐条核实。

## 2. 视频观察（5 段，逐帧抽样）

ffmpeg 场景切换检测（阈值 0.02–0.25）与 4–10 fps 抽帧拼图的结论：

| 文件 | 规格 | 内容 | 动效类型与时长 | 配色 |
| --- | --- | --- | --- | --- |
| `Kurppa-Hosk_Bungie_43.mp4` | 1920×1080 · 60 fps · 29.4 s | 黑底居中的媒体评价引言（"MY FAVORITE MULTIPLAYER SHOOTER IN YEARS." — GamesRadar；"MARATHON IS, QUITE FRANKLY, SICK AS HELL…" — IGN；"IMMA BE HONEST, I'M ADDICTED." — shroud），超宽无衬线全大写，来源小字在下 | **字符随机落位进场 / 散落退场**：每行文字约 0.3–0.4 s 内由零散字母填满（无乱码替换字，只有"出现 / 消失"两态，呈 `steps()` 硬切），停留约 4 s，再以同样方式散开；每条引言周期约 4.5 s。无缓动、无模糊 | 纯黑 `#000` + 酸绿 `#C0FE04`（JPEG 抽帧测得 `#6FA400–#BEFF09`） |
| `Kurppa-Hosk_Bungie_14.mp4` | 1920×1080 · 24 fps · 3.25 s | 同一组 Key Art（红色夜景 + 蓝色 Runner）在 26 个广告版式间切换：横幅、方图、竖屏、日 / 德 / 法文 CTA | **每 0.25 s 一次硬切**（6 帧），无过渡；版式内部静止 | 黑底、酸绿 logo 与 CTA 条、红色 Key Art；画布浅灰 `#E8E8E8` |
| `DAC_new.mp4` | 952×1192 · 29.97 fps · 2.5 s | Discord 用户卡：酸绿顶条 + 黑色卡体，圆形头像内的几何徽章逐帧换图 | 头像图案**每 2–3 帧硬切**（约 0.1 s），共约 25 种图案：十字、四叶、靶心、像素块；颜色随机取酸绿 / 红 / 紫 / 粉 / 黄 | 酸绿 `#C3FF0F`、黑、白；徽章用饱和红 / 紫 / 洋红 |
| `TCW_Weapon_02.mp4` | 1906×2384 · 60 fps · 4.9 s | tauceti.world 的 "WEAPON_VIEWER"：黑底细白框、顶部 `TAUCETI.WORLD`、底部 `[1] WEAPON_VIEWER`、四角短括号，手枪模型 | 模型**匀速慢旋转**（约 4.9 s 转 ~40°），无切换；背景有极淡的噪点 / 抖动纹理 | 近黑 `#080808`（93%）、白框、武器上蓝 / 红色块点缀 |
| `TCW_Runner_04.mp4` | 1906×2384 · 60 fps · 3.0 s | 手机框内的 "RUNNER SHELLS" 页：顶部酸绿导航条、底部 `FILTERS / DISPLAY MODE`，Runner 由正面转到侧背面，叠加骨架线与包围框 | 两次硬切（0.5 s、1.8 s）切换显示模式（实体 → 骨架 / 包围框叠加），其余为慢旋转 | 浅灰画布 `#E8E8E8`、酸绿 UI 条、黑底、骨架线用绿 / 红 / 黄细线 |

结论：Kurppa Hosk 的品牌动效语言 = **硬切 + 字符落位 + 极少缓动**；没有看到 RGB 色散、扫描线或模糊，glitch 只以"字符缺失"和"像素徽章换图"的离散方式出现。

## 3. 官方 UI 截图观察（6 张，The Cradle / Vault / Shell Select）

### 3.1 色块与强调色（5×5 像素平均；JPEG 使荧光色偏暗）

| 角色 | 测得值 | 出处 | 说明 |
| --- | --- | --- | --- |
| 页面底 | `#020201`–`#0B0A0C` | 所有 UI 图 | 近纯黑 |
| 面板底 | `#121316`–`#1C1E22` | 顶栏、Cradle 面板、tooltip | 比底色亮一级的炭灰，与官网 `--surface:#1c1c1c` 一致 |
| 卡片 / 格子底 | `#0F0F10`、`#29292F`、`#464954` | 物品格、空槽、XP 槽 | 三级灰阶 |
| 主强调（酸绿） | `#AFE706`（按钮）、`#B0E805`（等级徽章）、`#6C8C0C`（选中条暗部） | `Convert-Matter`、`Cradle_LVL50` | 原值应为官网的 `#C0FE04` |
| 青（XP / 数值增益） | `#02E8BA`（XP 条）、`#0C977D`（WEAVEworm 进度）、`+55` 文字 | `Convert-Matter`、`Cradle_*` | 增益数字一律青绿 |
| 六项属性色 | Strength `#DD4221` · Recharge `#88A7BE` · Dexterity `#E7AB3F` · Endurance `#8E79DE` · Support `#5DAE97` · Resistance `#6583E7` | `Cradle_LVL50_EN` | 属性条用分段色块（14 段），颜色即属性 |
| 稀有度 / 价签 | 黄 `#C4B50B`、紫 `#721E94`、蓝 `#3884C3`、绿（`#A4D808` 类）、灰 | `Convert-Matter`、`Vault` | 物品格底色带同色低饱和 tint |
| 白色 CTA | `#F0F0F0` 级白底黑字 | `ACCESS CRADLE`、`VAULT` 选中态 | 主要操作用白块，次要用酸绿块 |
| 紫（账号 / 社交图标） | `#9C7AE0` | 底栏图标 | 与官网 Season 2 段落的 `--primary:#5200FF` 同族 |
| 暖橙 / 黄（WEAVEworm 插图） | `#DC5A21`、`#7C633E` | Cradle 右侧插图 | 插图整体单色调染 |

### 3.2 字体角色与层级（观察，非字体文件证据）

1. **高反差衬线展示体**：`THE CRADLE`、`CONVERT MATTER`、`SENTINEL`、`MATTER CONVERTER`、`LEECH`、`Dexterity WEAVEworms` —— 页面级标题，白色，字号最大，仅一行。
2. **超宽无衬线粗体（全大写）**：`SHELL SELECT / VAULT / ARMORY`、`CONVERT ITEMS`、`ABILITIES GUIDE`、`ACCESS CRADLE`、`LOADOUT VALUE`、`WEAPON 1`、`CRADLE` —— 按钮、页签与分区标题。
3. **等宽体（Fraktion Mono 类）**：全部说明文字、属性名 `STRENGTH / RECHARGE…`、tooltip 正文、`Deselect All`、底栏提示 —— 说明文字用混合大小写，标签用全大写并加字距。
4. **像素 / 收据感数字体**：`LEVEL 50`、`5482/11K XP`、`0/2`、`106.3K`、价签 `6.3k` —— 数字读数单独一种字体（与 KH Interference 的"低分辨率像素"气质一致）。

即一屏同时出现 4 种字体角色，但职责固定：衬线 = 标题、宽体 = 操作、等宽 = 说明、像素 = 读数。

### 3.3 HUD / 菜单元素布局

- **顶栏**（高约 60 px）：左侧等级圆标 + 段位 + 三种货币（紫 / 绿 / 蓝图标 + 数字）；右侧页签组（`L1 ◂ SHELL SELECT | VAULT | ARMORY ▸ R1`）。
- **底栏**：左 `Back / Hide Menu` 带手柄键帽；右侧一排圆形图标（锁、账号紫色、好友、信箱、设置、帮助）。
- **Shell Select**：左列 2×4 头像网格（选中项白色勾），中部全幅角色写真，右下 Sentinel 信息卡（衬线名 + 等宽副标 "DEFENSIVE STRATEGIST" + 4 个线性图标 + 两个大按钮）。
- **The Cradle**：左 6 行属性条，每行 = 名称 + 图标 + 增益数字 + 分段条 + 2–3 个 perk 方块；右侧人体线框（可替换为 WEAVEworm 插图 + 两条青色进度 + 能量按钮）。等级条里有 **45° 斜向警示条纹**作为未填充段。
- **Vault**：左装备槽（十字准线占位 `+`）、中 5×8 背包格、右 4×N 仓库网格；物品格左上角有稀有度小图标。
- **装饰层**：Cradle 与 Shell Select 背景铺满极淡的 `+` 十字标记网格；Convert Matter 左侧有白色细线波纹（"信号"纹）；面板四角有 L 形短括号；Shell Select 的角色写真上叠了一层**像素块位移 + RGB 分离 + 水平狭缝拉伸**的 glitch / datamosh 处理和细扫描线，并有 `01 Set / ID-P / SN-C / MOD` 之类微型等宽注记。

## 4. 官方场景截图观察（47 张）

按媒体包分组，记录主调与强调色（高饱和占比 > 0.2% 的色相簇）：

| 批次 | 文件 | 主调 | 强调色 | 观察 |
| --- | --- | --- | --- | --- |
| 2025-12（开发期） | `..._001`、`_007`、`_009`、`_018` | 近黑 + 红 / 洋红 | `#F82383`、`#C20607`、`#E9151A`、`#8F2088` | 室内红色警报光，敌人（UESC）红色激光线；洋红墙面涂鸦 |
| | `_003`、`_004`、`_005`、`_008`、`_015` | 蓝 / 青蓝 | `#4657B9`、`#1455B3`、`#0066A4`、`#3B6C97` | 蓝色走廊、俯视设施、冷雾日光 |
| | `_010`、`_017` | 近黑 + 白 / 青绿结构 | `#008265`、`#00755F`、`#1F25D6`、`#E3189F` | 白灰面板 + 青绿走廊，武器上洋红 / 蓝色块 |
| | `_011`、`_012`、`_013` | 日光沼泽 / 风暴 | `#7C7E38`、`#26628C`、`#55739D` | 高亮度（lum 91–116）；`_013` 为雨 + 闪电 + 远处设施，`_012` 为彩虹色 Anomaly 屏障 |
| | `_006`、`_016`、`_014` | 暖黄 / 橙；洋红室内 | `#CEA430`、`#D58212`、`#B2247E` | 暖色门口；黄色 Shell；洋红荧光房 |
| 2026-03 Cryo Archive | `_02`、`_08`、`_09`、`_11`、`_12`、`_13` | 深蓝 / 紫蓝（占画面 30–50%） | `#425BCB`、`#1821A5`、`#3650B5`、`#014AA3` | 船内巨型装置、俯视的 Panopticon、蓝色几何储存舱 |
| | `_01`、`_04`、`_05`、`_07` | 深蓝 + 红 / 洋红 | `#E40F17`、`#AA0333`、`#BE1A77` | 红色激光束与红光房间 |
| | `_03`、`_06`、`_10` | 黄灰 / 暖灰 | `#C87137`、`#CC7E00`、`#A87B15` | 黄色工业舱段、手持发光棒 |
| 2026-05 Season 2（Night Marsh） | `_001`、`_002`、`_004`、`_013` | 近黑 + 青绿扫描 | `#1CD228`、`#ABC32E`、`#75C8D6` | 夜间湿地，绿色扫描圆环、目标轮廓 |
| | `_003`、`_005`、`_006`、`_008`、`_015` | 近黑 + 红 | `#E4234C`、`#CA0600`、`#DB0A00` | 风暴中的 UESC 巨型标识、红色壳体、红色激光 |
| | `_007`、`_012`、`_014`、`_010` | 青绿 + 红 / 洋红对撞 | `#00C58D`、`#00A2A4`、`#F2006B`、`#B83084`、`#E13630` | 青绿雾 + 洋红武器 / 红光 |
| | `_009`、`_011` | 深蓝 | `#5871C5`、`#3A4CA9` | 夜空天体、蓝色走廊 |
| | `Cradle_Enviormental.jpg` | 青灰 | `#19BFB6` | Cradle 大厅，白色"树状"装置 + 青绿屏幕 |

跨批次的共同点：**底色几乎总是近黑（`#080808` 占 20–60%）**；每张图只有 1–2 个高饱和色相，大面积为蓝 / 青绿或红 / 洋红之一；酸绿极少在场景里出现（只在 UI、logo 与 Shell 装饰上），这与官网把 `#C0FE04` 留作界面主色的做法一致。

### 区域调色（按可确认的归属）

| 区域 | 依据 | 观察到的调色 |
| --- | --- | --- |
| Cryo Archive | 2026-03 媒体包即 "Cryo Unlock" | 深蓝 / 紫蓝 `#1821A5–#425BCB` 为主，红 `#E40F17` 作警示与激光，少量黄灰舱段 |
| Night Marsh（Dire Marsh 夜间变体） | Season 2 媒体包，官网 "NEW ZONE: NIGHT MARSH" | 近黑 + 青绿 `#00C58D` / `#1CD228` 扫描光 + 红 `#E4234C` 冲突光；雨、闪电 |
| Dire Marsh（日间） | `2025_DEC_…_011` 的日光沼泽与树林；Dylan Teter / Eve Astra 的 ArtStation 条目描述 | 高亮度黄绿 `#7C7E38`、青蓝雾 `#26628C`，Anomaly 屏障为彩虹渐变 |
| Perimeter | 2025-12 批次未标注；tauceti.world/explorer/Perimeter 以紫色线框 + 酸绿标签呈现 | 本地截图中无法单独指认；`_013` 风暴设施与 `_005` 雾中轮廓疑似 Perimeter（**未证实**） |
| Outpost | 本地截图未标注 | 红色警报室内（`_007`、`_009`、Cryo `_05`）符合"hostile"的描述，但归属**未证实** |
| The Cradle（Season 2 大厅） | `Cradle_Enviormental.jpg` | 青灰 + 白 + 青绿屏幕 |

## 5. 概念 / 插画观察（10 张）

- `daniel_HorrorIllustrations.jpg`、`daniel_NaturePalette2.jpg`、`daniel_World_AlgaePond_SmolBuildinPaintover.jpg`：白底设定页，页脚酸绿条写 `BUNGIE ／ ▮▮▮ × ▢ 2850 ⌗ ／ MARATHON`；Algae Pond 建筑以**红 `#CF0000` + 黑 + 酸绿 `#BEFF09` + 青**四色平涂，证明"一栋建筑 = 一个主色 + 一个重音"。
- `daniel_Runner_TriageWorkShowStuff1.jpg`：Triage Runner 概念页整页染成蓝 `#506DFF`，角色贴花用酸绿与橙 —— 说明角色页以单一背景色定义身份。
- `west_world_WestStudio-Marathon-1.jpg`：工业场地，青绿 `#0CF2DC` 液体 + 黄色模块 + 橙色箱；`-4.jpg`：蓝框白色储物舱 + 黄色小标签；`-8.jpg`：UESC 模块堆叠，蓝 `#008ADB` 顶盖 + 黄色提手。
- `west_seasons_WestStudio-Marathon2-1.jpg`：青蓝 `#70BEDC` 调的 Runner 半身像，带扫描线与准星角标；`-3.jpg`：红 `#E70515` 调的 Runner；`-8.jpg`：白底武器皮肤设定页（灰白 + 绿色点缀）。

共同规则：**单色整页染色 + 一到两个对比重音 + 等宽小字标签**，页脚固定一条酸绿品牌条。

## 6. 对路线图的直接影响

1. M1 色板：酸绿 `#C0FE04`、黑 `#000`、炭灰 `#1C1C1C`、灰字 `#717171`、红橙 `#F24723`（官网 token）可作主干；六项属性色与青 `#02E8BA` 作为"数据 / 增益"语义色；蓝 `#1821A5–#425BCB`、红 `#E4234C`、青绿 `#00C58D` 作区域调色。
2. M2 字体：四角色（衬线标题 / 宽体操作 / 等宽说明 / 像素读数）在官方 UI 里被严格分工，网页复刻应沿用这种"职责固定"而非随意混排。
3. M5 / M6：官方品牌动效的 glitch 是**离散硬切 + 字符落位**，不是连续的 RGB 色散；连续色散只出现在 Shell Select 的背景写真层。
4. M7：区域调色可直接用上表的蓝 / 青绿 / 红 / 黄灰四组，但 Perimeter 与 Outpost 的本地证据不足，需以 tauceti.world 与视频为准。
5. M8：本地没有加载画面素材；"sense-memory" 飞蛾循环仍只有文字描述。
