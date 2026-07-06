# Project Afflatus — Release Notes

> 已完成工作的历史归档。roadmap.md 只保留仍需跟踪的未完成工作——完成的条目从那边移除后落在这里，保留原始技术细节（教训、验证方式、范围边界），供未来排查/复用参考，不追加新内容之外的整理。
> 按版本/日期倒序排列（最新在最上面）。

---

## v1.5 · Afflatus「Fable 5 Max 五模块」

### V21 Phase 1.（S）十神占比 + 调候提示 + 神煞稀有度 — 2026-07-06

**十神占比** `tenGodDistribution()`（ziping.js）：日主以外三天干各计 1.0，藏干按本气 1.0/中气 0.5/余气 0.3 加权（主流排盘 App 的加权藏干惯例），返回十神各自份额（总和恒为 1，vitest 断言）。页面在详批表格下方以横条形图展示（降序排列，鼠尾草→淡金渐变条）。参考盘验证：食神应为最大份额（天干两壬+申中藏壬），比肩仅来自申中藏庚（1/9.1≈11%），均逐项断言通过。

**调候提示**：`ziPingAnalysis` 新增 `tiaohou` 字段——只做两个无争议的档位：亥子丑月（冬）命局偏寒宜带火、巳午未月（夏）偏燥热宜带水；春秋月气候平和返回 null 不显示。完整调候（按月支×日主逐格查表）明确不在范围内，页面文案如实说明这是简化。

**神煞稀有度**（测测没有的差异化点，roadmap §7.8.0）：新增 `scripts/gen-shensha-rarity.mjs`——枚举 1950–2009 年、每月隔日采样、全部 13 个时辰值共 145,275 个均匀合成命盘，统计每个神煞至少出现一次的频率，产物写成 `src/lib/shenshaRarity.js`（**生成的、进 git 的 JS 模块**——观星台是零 fetch 页面，打进 bundle 而不是让页面去 fetch JSON）。跑出来的数据自我验证：魁罡 6.64% ≈ 理论值 4/60=6.67%（只有 4 个特定日柱），vitest 固化这条对照。页面在神煞名后挂四档徽标（≥40% 常见 / 25–40% 多见 / 10–25% 少见 / <10% 稀有），并注明「均匀合成样本估算，非真实人口统计」。当前数据里最稀有为魁罡（6.6%）、羊刃（15.7%），最常见为童子（56.5%，简化规则覆盖面广所致，如实展示）。

**验证**：324/324 测试通过（新增 8 条）；`vite build` 干净（horoscope chunk 39.93→41.82kB）；产物确认 `bz-gods`/稀有度数据已打包。

---

### V21 Phase 0.（M）观星台治愈系视觉改版：暖奶油/鼠尾草绿/赤陶橙/淡金 + 植物插画 + 删除水墨底板与龙马美术 + 分享卡 — 2026-07-06

**需求**：站主参照测测 App 立项 V21（roadmap §7.8），Phase 0 是界面全面转向「治愈温暖」：暖奶油色底、鼠尾草绿、赤陶橙、淡金配色 + 植物插画，**明确指示删除之前的深色底板和龙马动物设计**（V20.5–V20.7 的产物，历史记录保留在下方条目中）。

**配色 token**（`public/styles/horoscope.css` 全量重写，类名一律不变所以 JS/HTML 零改动配合）：页面底 `#F6EFE3`、卡片 `#FFFBF2`、嵌套/输入底 `#F1E7D4`、正文暖墨 `#4A453D`、次级 `#6B6354`；鼠尾草绿 `#9CAF88`（装饰）/`#52693D`（文字级）、赤陶橙 `#C96F4A`（装饰）/`#9C4A2A`（文字级）、淡金 `#D9B87C`（装饰）/`#7A5E1D`（文字级）。**对比度纪律（roadmap §7.8.1 的硬验收）**：所有用于文字的颜色一律用 `-deep` 深色变体，已用脚本对最深底色 `#F1E7D4` 逐一算 WCAG 对比度，全部 ≥4.5:1（AA）——第一轮候选色里 `wood #557A43`/`earth`/`metal` 等 5 个只有 4.0-4.4:1，逐个加深后复测通过；浅色变体只用于边框/填充/大图形。五行语义色同步换成浅底安全版（木 `#4A6B3B` 火 `#A2442E` 土 `#7A5E1D` 金 `#636358` 水 `#396383`）。

**形态语言**：圆角卡片（16px/12px）+ 柔和暖阴影替代直角+金色边角刻线（`.panel::before/::after` 角标删除）；按钮/chip 改胶囊形；`sec-label` 前缀符号从 `◈` 改 `❀`。

**删除与新插画**：`.bg` 整套水墨夜空（星空/墨晕/星环）、`.bg-horse`/`.bg-dragon` 全页水印、`.hero-art` 龙马插画全部移除；新插画为原创手绘植物线稿 SVG（鼠尾草/桉叶枝条+赤陶色浆果）——右上角大枝条（55% 透明度+缓慢 sway 动画，reduced-motion 降级）、左下角小枝条（镜像旋转）、hero 区一小段横向枝条，全部先经 cairosvg 渲图自查（构图/叶形可辨认、不喧宾夺主）再上。**沿用 V20.7 教训：零第三方素材**。

**共享件同步**：`page-turn.css` 里 `.horoscope-page` 作用域的翻页箭头/Labs 下拉配色从墨夜金红改为奶油底鼠尾草绿/赤陶（只动本页作用域块，其他页不受影响）；`<meta theme-color>` 从 `#101310` 改 `#F6EFE3`，页面 description/og 文案里的 "ink-wash/drawn in ink" 同步改 botanical 表述。

**分享卡（roadmap §7.8.1 并入本 Phase 的旧 v2 点子①）**：新增 `src/lib/shareCard.js`——canvas 渲染 1080×1350 PNG（治愈系配色+手绘枝条+四柱大字/合盘分数环），`downloadShareCard()` 走 `canvas.toBlob` + 临时 `<a download>`，全本地无上传；「保存生辰卡」按钮加在日运区，「保存合盘卡」加在合盘分享行；渲染数据在 `renderMine`/`renderSyn` 时暂存 `state.mineChart`/`state.synData`，点击时按当前语言即时构建文案。DOM 耦合的纯视觉模块按站内惯例不补 vitest。

**验证**：316/316 测试通过（无逻辑改动）；`vite build` 干净（horoscope chunk 35.15→39.93kB，新增 shareCard）；产物 grep 确认旧类（bg-stars/hero-art/--dragon 等）零残留、新 token/`.bg-sprig` 就位；cairosvg 全页配色 mock 核对和谐度（沙盒无 CJK 字体，汉字显示为方框，但配色/卡片形态/枝条位置可验证）。**真人浏览器过目仍然必需**（尤其暖色在真实屏幕上的观感、sway 动画、分享卡 PNG 的字体渲染）。

---

### V20.8.（L）生辰详批扩展：十神/藏干/纳音/空亡/十二长生/旺相休囚死/20+神煞/刑冲合害 + 简化身强身弱评分 — 用户对照「测测」App 截图提出要求 — 2026-07-06

**需求**：用户发来「测测」App 的生辰排盘截图（含干神/支神/藏干/纳音/空亡/地势/自坐/神煞/刑冲合害/旺相休囚死等完整信息），要求本站生辰部分也要有同等深度的信息 + 一定的解读，并依子平法对命造做"排名"。追问后确认：排名部分"身强身弱定性判断"和"简化量化分数"两者都要；神煞部分尽量全面（20+个）。

**新增 `src/lib/ziping.js`**（子平法扩展分析层，独立于 `bazi.js` 的纯历法计算，避免其单一职责膨胀）：
- **十神** `tenGodOfStem`：用五行生克环 + 天干阴阳算法直接推导（比肩/劫财/食神/伤官/偏财/正财/七杀/正官/偏印/正印），不用查表。
- **藏干** `HIDDEN_STEMS`：标准三段表（本气/中气/余气）。
- **纳音** `nayinOf`：完整六十甲子三十组纳音表。
- **空亡** `kongWangOf`：按每根柱自身六十甲子序数所在"旬"计算（每旬固定以甲干起始，缺的两个地支即空亡）。
- **十二长生** `twelveStage`：标准长生表（阳干顺行/阴干逆行，戊己借丙丁位），用于"地势"（日干在各柱地支的十二长生状态）和"自坐"（各柱本柱天干在本柱地支的状态）。
- **旺相休囚死** `seasonalStrength`：按月支五行，"当令者旺，我生者相，生我者休，克我者囚，我克者死"。
- **刑冲合害** `stemRelations`/`branchRelations`：天干五合/四冲，地支六合/三合(半合)/六冲/六害/三刑(寅巳申、丑戌未循环 + 子卯相刑 + 自刑)。
- **神煞（21个）** `computeShensha`：驿马(年支+日支双查)、华盖/将星/桃花/劫煞/灾煞/岁煞/孤辰/寡宿(年支单查)、禄神/羊刃/天乙贵人/福星贵人/金舆/国印贵人(日干查)、文昌贵人(年干+日干双查)、学堂(=自坐长生)、月德贵人/天德贵人(月支查)、魁罡(特定日柱)、童子(月支季节+日/时支简化判断)。
- **简化身强身弱/格局/用神 + 0-100 分** `ziPingAnalysis`：基础"扶抑法"（比劫印为扶，食伤财官杀为抑，按月令旺衰加权），格局按月令本气十神简化定名；分数为本站自创的娱乐向量化指标，非传统命理方法本身，页面明确注明。

**验证方法（关键）**：由于每个神煞/关系的具体查法在不同流派/软件间确有差异，本次没有凭空编表，而是把用户提供的真实截图（1992-02-23 23:26 → 壬申/壬寅/庚午/丙子）当作已知正确答案反推每张表——藏干/纳音/空亡/地势/自坐/旺相休囚死/刑冲合害全部逐项核对完全吻合；21 个神煞中，驿马/禄神/天乙贵人/文昌贵人/福星贵人/学堂/月德贵人/将星/灾煞/童子共 10 个直接对照截图验证通过（例如"驿马"经反推确认该 App 用的是年支+日支双重查法而非单查，"天乙贵人"标准歌诀记忆有误经反推纠正为"庚辛逢马虎"而非"甲戊庚牛羊"），其余 11 个（华盖/桃花/劫煞/岁煞/孤辰/寡宿/羊刃/金舆/国印贵人/天德贵人/魁罡）截图中未出现对应示例、无法交叉验证，采用标准文献表并在代码注释里如实标注"未在参考图中验证"；童子煞额外注明其规则在专业命理文献里本身就流派分歧较大，仅春季（寅卯辰月）一档有直接验证。`tests/ziping.test.js`（25 个新测试）覆盖以上全部可验证项。

**页面改动**：`horoscope.html` 在"CAST YOUR CHART"结果区新增"CHART DETAIL · 子平法"表格（四柱 × 十行：干神/天干/地支/藏干/支神/纳音/空亡/地势/自坐/神煞），表格下方接刑冲合害摘要、旺相休囚死一行、身强身弱+格局+喜用神/忌神解读段落 + 分数。所有新增文案均走站内既有 `data-en`/`data-zh` 机制，中英双语。CSS 新增于 `public/styles/horoscope.css`（`.bz-*` 系列类）。

**验证**：316/316 测试通过（新增 25 个 `ziping.test.js` + 既有 291 个不受影响）；`vite build` 通过，`horoscope` 产物 chunk 从 24.57kB 增至 35.15kB（合理，新增表格渲染逻辑）。

---

### V20.7.（S）Hero 龙插画改为盘坐姿势 + 增加脊背鳍片 — 用户坚持要求参照实际参考图 — 2026-07-06

**背景**：V20.6 修完「腿」之后，用户仍连续三次发来爱马仕壁纸里单独抠出的龙的局部图，明确要求「把这条龙用上去」。没有直接嵌入这张品牌方版权素材（原因同 V20.6 记录：用户本人无权替第三方版权方授权，即便反复要求也只取造型比例作参考、不复用原文件像素），但这也说明 V20.6 的「加腿」修复不够——用户真正想要的是壁纸里那种**盘坐/蜷曲**的姿态,而不是之前水平奔跑式的波浪身形。

**重画**：躯干改成从下方臀部蜷曲向上到头部的 S 形盘坐姿态；尾巴在底部单独打一个小卷；两条前腿加上明显的「肘部」弯折，脚掌三趾爪比之前更大更分明；胡须改成从嘴部延伸出的橙色飘带（`--seal` 描边），呼应壁纸里的须飘带。

**踩坑**：第一版盘坐姿态由于腿和尾巴的卷曲挤在同一个角落、躯干粗细全程一致，`cairosvg` 渲染出来更像"毛毛虫/根茎"而不是龙——腿和尾巴分不清，鳞片装饰点缀在脖子边缘反而像杂乱的须边。第二版把两条腿移到躯干中段、明显偏离尾巴卷曲的位置，并加上肘部转折，勉强能看出是"坐着的生物+爪子"，但整体轮廓仍偏"坐着的恐龙/大鸟"而不确定地读作"龙"。第三版加上沿脊背的一排小三角鳍片（原图里龙背部没有明显画出，但这是让中国龙轮廓区别于恐龙/蠕虫最有效的视觉标志），这个改动后 `cairosvg` 渲图明显好转，龙的识别度显著提升，就此定稿——这个过程再次印证纯手绘 SVG 在没有真实浏览器/设计师复核的情况下，光靠坐标调整很容易在"不是蛇"和"确实是龙"之间卡在一个不上不下的中间状态,本次用脊背鳍片这一个改动补上了缺口。

**其它**：Hero 区插画整体宽度上限从 `min(56vw,520px)` 收窄到 `min(48vw,440px)`（移动端从 `70vw` 收窄到 `62vw`），透明度维持不变，作为给正文文字留出的安全边距，降低插画与副标题重叠的风险（无真实浏览器环境验证实际断点表现，仍建议用户在真机上确认一次）。全页水印版龙（`.bg-dragon`）保持 V20.6 的加腿版本不变——透明度仅 0.08，鳍片这种细节在该尺度下几乎不可见，不值得为水印再画一版。

**验证**：定稿前用 `cairosvg` 做了三轮迭代渲图（躯干+腿分离度、鳍片前后对比），确认腿爪清晰、鳍片让轮廓明确读作龙；291/291 测试不受影响（纯 SVG/CSS 改动）；`vite build` 通过（沙盒环境下 `dist/.DS_Store` 因是 macOS 挂载文件夹遗留、非本次改动引入的沙盒权限问题导致 `emptyOutDir` 报错，改用 `--outDir` 指向临时目录验证产物正常生成，`horoscope.html` 编译产物含新脊背鳍片路径与调整后的 transform 坐标）。

---

### V20.6.（S）龙插画像蛇的根因修复 + 橙色主题感不足 — 用户拿实际截图反馈 — 2026-07-05

**问题**：用户发来页面实际截图两条反馈：① 通篇看下来橙色只在 logo 方块、chip 边框这类小装饰上，「和爱马仕橙色没什么关系」；② Hero 区的龙插画「长得跟蛇一样」，并说临摹图甚至直接贴图都行。

**没有直接贴图的原因**：用户给的参考图是爱马仕官方壁纸，属于品牌方版权素材——即便用户本人愿意，直接把这张图嵌进公开网站仍有版权风险，所以只取配色/构图灵感重画，不复用原图文件，这一点向用户说明。

**根因**：把插画拉出来单独看才发现——龙的躯干是纯粹的波浪形粗描边，**完全没有腿**。腿+爪是中国龙和蛇在视觉上最本质的区别，之前的设计从头到尾就没画腿，所以无论怎么调头部细节，整体轮廓终究是一条蛇。

**修复**：龙身体沿途新增两条腿，每条腿末端加三趾爪（短分叉线），这一处改动本身就让轮廓从「蛇」变成「有腿的神兽」；同时简化头部——去掉之前纠缠不清的双线开口设计，改成一个干净的**实心闭合口鼻轮廓**（closed-silhouette path），角和须分别用独立线条摆在不会和其他部件交叉的位置。全页水印版的龙（`.bg-dragon`，透明度仅 .08）也同步加了两条简化版的腿，保持一致（这个版本本来就很淡，之前没被抓出来是因为几乎看不清）。

**橙色主题感**：原来的橙色只用在小面积的 logo/边框/chip 上，页面整体基调仍是纯黑绿松烟墨夜色。这次没有整体改成亮橙背景（会破坏全站统一的水墨夜色调性），而是加了两处暖橙光晕：`.bg-mist`（全页背景层）里那个原本 .05 透明度的金色光斑改成 .16 透明度的橙色光晕，位置移到右上角；`.hero` 区背景新增一个从右上角散开的橙色径向渐变（.20 透明度）。两处叠加后，至少 Hero 区能明显感觉到「暖橙调」，而不再是纯装饰点缀。

**验证**：定稿前用 `cairosvg` 把新龙+马+橙色光晕合成实际 Hero 尺寸/透明度的效果图核对过，确认腿和爪清晰可辨、橙色光晕在深色背景上确实可见且不影响文字对比度；291/291 测试不受影响；`vite build` 确认产物里新腿部路径和渐变值都在（这次 CSS 已被站内某个流程抽成独立的 `public/styles/*.css` 文件，非本次改动引入，但已确认相应文件同步含有本次修改）。

---

### V20.5.（S）精确爱马仕橙/24k 金 + Hero 区龙马插画（参照用户提供的爱马仕龙马烟花壁纸）— 2026-07-05

**需求**：用户发来一张爱马仕壁纸参考图（橙色烟花夜空、月白色巨龙俯身、枣红色小马仰头对望、紫色远山），要求：① 主题色改精确色值爱马仕橙 `#F37022` + 24k 金 `#EFBF04`；② 龙马插画的「形式」参照这张壁纸的主题重做。追问显眼程度后，用户选择「两者都要」——Hero 区放一版更显眼的彩色插画，全页仍保留原有的淡水印。

**颜色**：`--seal` 由 `#e8600c` 改精确值 `#F37022`，`--gold` 由 `#c99a3d` 改精确值 `#EFBF04`；所有硬编码对应 rgba 同步替换。新增 `--dragon`（月白奶油色 `#efe3c8`，参照壁纸龙的配色）与 `--horse`（枣红 `#8a3020`，参照壁纸马的配色）两个变量，专供插画使用，不与五行语义色混用。

**Hero 插画（新增，不是改现有水印）**：手绘 SVG——龙用粗描边（stroke-width 20 + round linecap/linejoin）模拟"实心龙身"效果代替之前纯细线描，月白色，带鬃毛/角/须/金色鳞片点缀；马用同一份验证过的奔马路径，翻转朝向使其面朝龙（呼应壁纸里龙马对望的构图），描边改枣红粗线。放在 `.hero` 区第一个子元素、绝对定位、`opacity:.4`（移动端 `.22`）、带一个很慢的 `heroDrift` 浮动动画，`prefers-reduced-motion` 降级。定稿前反复用 `cairosvg` 渲图核对——第一版马的坐标变换算错、和龙头缠在一起变成一团乱线，改用独立 transform 隔离两者位置后才通过验收；又核对了一版叠加实际标题文字的合成图，确认 0.4 透明度下插画看得清但不盖过文字。原有的全页淡水印（`.bg-horse`/`.bg-dragon`，opacity .06-.09）保持不动，颜色跟随新 `--seal`/`--gold` 自动更新。

**验证**：291/291 测试不受影响（纯视觉改动）；`vite build` 通过，产物内确认新色值、`--dragon`/`--horse` 变量、`.hero-art` 都在。

---

### V20.4.（XS）时辰选单可读性/排列修正 — 用户反馈 — 2026-07-05

**问题**：V20.3 把「子」拆成早子/晚子后，用户反馈选单「非常不人性化，可读性差并且排列有问题」。查看实际选项发现两个真问题：① 排列不按时间顺序——早子(00:xx)、晚子(23:xx) 排在最前两位，晚子理应排在最后（23 点是一天的结尾）；② 标签格式简陋（"丑 1–3"这类缩写在中英切换时都只显示中文，英文用户看不懂地支名，也没有补零的完整时刻）。

**修复**：`horoscope.js` 的 `SHICHEN` 表改为按时间顺序排列（早子 00:00 开头，晚子 23:00 结尾，中间依次丑寅卯辰巳午未申酉戌亥），每项换成完整 `HH:MM–HH:MM` 时刻+拼音双语标签（如「丑 01:00–03:00」/「Chou 01:00–03:00」），用 `data-en`/`data-zh` 属性接入站内已有的通用 i18n 机制（`i18n.js` 本来就会扫描全站 `[data-en]` 元素做双语切换，之前这批动态生成的 `<option>` 没接上这套，切换语言时选单文字不会跟着变，只有中文）——这样切中英文时选单也会自动跟着换，不用额外写监听逻辑。

**验证**：291/291 测试不受影响（本次是纯 UI 标签/排序改动，不涉及历法计算）；`vite build` 构建产物核对新标签已进包。

---

### V20.3.（S）晚子时日柱换日 bug——用户拿专业排盘网站交叉验证揪出来的真问题 — 2026-07-05

**问题**：用户在「问真八字」网站排了自己的盘（1992-02-23 23:26，乾造）比对，年柱月柱都对（壬申/壬寅），但日柱时柱不同——参考站给 庚午日 丙子时，本站给 己巳日 甲子时，质疑数据源有问题。

**根因**：不是数据源问题，是历法惯例选择——23 点出生正处「子时」，命理界对「子时是否换日」有两派：本站原实现是「早晚子时统一」（23:00-23:59 仍算当天），而问真八字等主流专业排盘站用的是「晚子时换日」（23:00-23:59 的日柱按次日算，时柱仍是子但用次日的日干起）。手算验证：把日期 +1 天重算，日柱变成 庚午——与参考站完全吻合。**这是本站此前偏离主流惯例的真实差异，值得修，不是伪 bug**。

**修复**：`computeBazi()` 新增判断——`hour===23` 时，年/月/日柱改用「次日」重算（用已有的 `shiftHours` 做纯日历运算），时柱分支仍是子（0），但时柱天干用换算后新日柱的日干起（五鼠遁）。用这个真实案例（1992-02-23 23:26 → 壬申/壬寅/庚午/丙子）写成回归测试，四柱与参考站逐一核对完全一致。

**连带发现并修的 UI 缺口**：原来「子」时辰只有一个选项（代表 hour=23），把「早子 00:xx（当天不换日）」和「晚子 23:xx（换日）」两种真实不同的情况混成一个下拉项——选它的用户，如果实际是 00 点出生，会被错误地当成 23 点处理而换错日。拆成两个独立选项：早子 00–1 / 晚子 23–24，各自对应 hour=0 / hour=23，用户自己选对的那个。

**验证**：新增 3 条测试（参考站精确匹配、早子不换日的对照、跨年 12/31 23 点换日不报错），32→35 条 `bazi.test.js`，全仓库 288→291 条全绿；`vite build` 确认新拆分的时辰选项已进构建产物。

---

### V20.2.（M）观星台美术改版 + 出生地时区/夏令时精度修正 + 合盘双盘对照 — 用户直接指定 — 2026-07-05

**需求**：用户提出四项：① 主题色改「爱马仕橙 + 金」；② 背景加「奔腾的马 + 龙纹」呼应 2026 马年「龙马精神」；③ 合盘部分从纵置改横置；④ 追问出生地/夏令时是否影响八字或星座准确度——如果影响，直接修或加选项。

**④ 精度调查结论（先查后改）**：**是，两处真实影响**——(a) 时柱是 2 小时一档，出生地时区与北京时间的差值、以及当地当时是否实行夏令时，都可能让时柱换错档；夏令时对日柱也有影响（若换算后跨过午夜）。(b) 中国自己在 1986-1991 年也实行过夏令时（查证具体起止日期：86年5/4-9/14，87年4/12-9/13，88年4/10-9/11，89年4/16-9/17，90年4/15-9/16，91年4/14-9/15），这几年出生、不知道要换算的用户，此前是没有修正的。星座分界日本就是通用近似表，不因出生地变化（不在本次范围）。

**④ 修复**：`bazi.js` 新增 `normalizeBirthToCST({y,m,d,hour}, tz?)`——`tz` 可选 `{utcOffset, dst}`；不填时区时自动应用**中国 1986-1991 历史夏令时**修正（不用用户操心）；填了时区+夏令时勾选，则换算到北京时间框架（月/日可能因此跨零点翻转，用 `Date` 的 UTC 方法做纯日历运算，不依赖宿主时区）。表单新增「出生地时区」下拉（34 档，覆盖常见地区，含 5:30/5:45/9:30 等半点时区）+「夏令时」勾选框（未选时区时禁用，因为那种情况走自动修正）；在表单提交时一次性换算好，之后存档/分享链接沿用换算后的规范值，不需要改动分享码 schema。9 条新单测覆盖：不填时区+历史夏令时窗口内外、显式时区换算跨天、夏令时叠加换算、半点时区（分钟级精度在小时档位上做合理截断）。

**①③ 设计**：主题色 `--seal` 由朱砂红 `#c23b22` 改爱马仕橙 `#e8600c`，`--gold` 提亮到 `#c99a3d` 与橙呼应（所有硬编码的对应 rgba 值同步替换）；五行色板 `--wood/fire/earth/metal/water` 保持不变（五行是语义色，不是品牌装饰色）。合盘区新增「两人命盘对照」横向双栏（我 / 对方，用 `synastry()` 早就算出但从未渲染的 `chartA`/`chartB`），左右并置显示双方四柱+生肖+星座，中间一个印章分隔符；提取 `pillarCardsHTML()`/`identityChipsHTML()` 复用，避免重复渲染逻辑。

**② 背景美术（先画草图再验收，不是盲写）**：手写 SVG 水墨线描——奔马（鬃毛/尾巴/四肢奔跑姿态）+ 龙纹（蜿蜒身躯+角+须+云纹），画好后用 `cairosvg` 渲出 PNG 实际看过（第一版奔马像羊、第一版龙头缠成一团像乱麻，各改了两三版才通过肉眼验收），确认可辨认后才写进页面，用 `var(--seal)`/`var(--gold)`/`var(--dim)` 上色、极低透明度（.06-.09）叠在原有星点/雾气层之上，`gallop`/`drift` 两个缓动动画，`prefers-reduced-motion` 降级同已有规则合并。

**验证**：279→288 条测试全绿；`vite build` 全 8 页构建通过（沙盒里 Playwright 因缺系统依赖装不上、无 sudo 无法补，无法截图做最终视觉回归，样式/背景动效仍需人工过一遍）；构建产物里确认新 class/id/颜色值都在（`bg-horse`/`bg-dragon`/`synCharts`/`bTz`/`bDst`/`#e8600c`/`#c99a3d`）。

---

### V20.1.（S）观星台节气精度修正 — 真太阳黄经替换固定近似日期（用户反馈"感觉不准确"）— 2026-07-05

**问题**：用户追问八字/星座数据来源，指出感觉不准。查根因：`bazi.js` 的年柱/月柱边界此前用**固定日期近似**（立春写死 2月4日，其余 11 个节气也是固定 {m,d}），真实节气每年因回归年长度非整数天而浮动 ±1-2 天——例如 2025 年立春实际是 2月3日 22:10（非"惯常"的 2月4日），用固定规则会把 2/3 出生的人错判到上一个干支年。

**修复**：新增真太阳视黄经计算（Meeus 低精度公式，精度约 0.01°/几分钟，对"哪一天"这个粒度绰绰有余）——`sunApparentLongitude(jd)` 算儒略日对应的太阳视黄经，`findSolarTermJD()` 用二分法在近似日期 ±4 天窗口内定位黄经=目标值（12 个"节"分别在 285°/315°/345°/…/255°）的精确儒略日，换算回北京时间（UTC+8）日历日期。`baziYear()`（立春）和 `monthBranch()`（12 节）都改为查这套实时计算而非固定表；固定表的 `{m,d}` 字段降级为二分法的搜索种子（仍需在真实日期 ±4 天内，但不再是最终答案）。`computeBazi({y,m,d,hour})` 外部签名不变。

**验证**：用公开发布的真实节气时刻做测试夹具而非凭记忆编造——2000 年立春 2/4 20:35、2025 年立春 2/3 22:10（关键案例：证明修复前的固定 Feb-4 规则在这年是错的）、2026 年立春 2/4 04:01、2024 年小寒 1/6 04:49，四条均通过；新增 `yearPillar(2025,...)` 边界测试直接断言 2/3 已翻年、2/2 未翻年。`tests/bazi.test.js` 17→23 条，全仓库 273→279 条全绿。页面表单说明/页脚免责声明的"节气为 ±1 天近似"措辞同步改为"按真实太阳黄经推算"。

**仍存在的简化（如实标注）**：无出生地/时区输入，一律按北京时间民用日历处理（这是四柱/时柱本来就有的简化，非本次新增）；子时晚子时算次日的流派分歧仍未处理；西方星座分界日仍用通用近似表（未算太阳视黄经对应的精确分界，因为西方占星传统上本就用日历近似日期，不是精确到秒的黄经切换点）。

---

### V20.（M）观星台 horoscope.html — 八字×占星 Labs 页（用户直接指定，含 PM/UX/架构三域评审）— 2026-07-05

**需求**：用户要求新增八字（四柱）+ 西方占星模块——个人每日运势 + 双人合盘（事业/情缘/婚嫁/康健/财帛五维），目标是高娱乐性、高粘性、可传播；美术风格定调「天人合一与自然观」；新页进 Labs，`horoscope.html`；想好设计直接开工。

**三域核心裁决**：① **留存钩子的诚实实现**——每日变化来自**真实干支历**（今日日柱是真实历法数据），今日五行对用户日主的生克关系每天真实不同，这是「每天回来看」的非伪造理由；叠加 localStorage 签到 streak + 每日宜忌/幸运色/幸运数/吉方。② **静态站的病毒机制**——合盘分享 = 双方生日 base64url 编进 `?p=` URL 参数，好友点开直接看到这一对的合盘，零后端零注册；合盘输出「底盘缘分」（按对稳定）+「今日引力」（按日变化，把合盘也变成每日钩子）双分数。③ **架构全纯函数**——`src/lib/bazi.js`（四柱排盘数学：日柱 JDN mod 60、年柱立春界、月柱五虎遁+近似节气、时柱五鼠遁、五行统计、星座）+ `src/lib/horoscopeEngine.js`（生克关系→分域基调→seeded mulberry32 从双语文案库选段；合盘=地支六合/三合/相冲/相害+五行互补+日主生克+星座三方加权；分享码 codec 带输入校验）。确定性输出（同人同日刷新不变、跨人跨日变化），零 API 成本。

**诚实边界（页脚+表单说明都写明）**：分数钳制 8..96——本产品从不给绝对答案；立春/节气边界为 ±1 天近似；不做真太阳时；不填时辰排三柱盘；全页「仅供娱乐 · 不构成命理/医疗/情感/财务建议」；康健域文案只谈作息不涉医疗。**红线（写进 §5 备忘）**：永不做付费解锁/焦虑营销黑模式。

**美术（天人合一）**：松烟墨夜底（#101310）+ 宣纸米白（#ece5d3）+ 朱砂印章红（#c23b22，logo 是竖排「观星」印章）+ 老金（#b98a3a）；五行五色体系（青木/赤火/黄土/白金/黛水）贯穿四柱竖排干支牌、五行珠、幸运色；背景 CSS 星点闪烁 + 缓旋星环（240s）+ 山岚雾气渐变，零 canvas 零图片；运势分数以描边圆环「墨晕」动画揭示（stroke-dashoffset 过渡），域分条渐次生长；全部动效带 `prefers-reduced-motion` 降级。竖排「觀象授時」水印、宜/忌大字排版。

**交付**：`horoscope.html`（第 8 个 Vite 入口，走完整新页 checklist：canonical/OG/lang 预设脚本/GA/sitemap/nav SITE 数组/page-turn 主题变量/D4 热区/中英 data-en/zh 全覆盖）+ `src/pages/horoscope.js`（表单/localStorage 档案+streak/分享码解析/渲染，自包含 IIFE）+ `horoscopeEntry.js` + `league.html`/`serial.html` 的 prev/next 占位同步修正。时辰选择器用十二时辰（子丑寅卯…），不填=三柱盘。

**验证**：273/273 测试绿（新增 `tests/bazi.test.js` 17 条——干支日柱用 1949-10-01=甲子日与 1970-01-01=辛巳日**两个独立文献锚点**交叉验证，立春/节气/五鼠遁/星座边界逐条断言；`tests/horoscopeEngine.test.js` 12 条——确定性/跨日跨人变化/分数钳制/六合>相冲/分享码 roundtrip+垃圾输入拒绝）；构建绿，8 页 preview 全 200；dist 指纹确认（观星台/birthForm/synForm 在产物、新页路径进共享 nav chunk）；引擎 Node 实跑冒烟输出正常中文文案。**修了一个真 bug**：`zodiacIndex` 初版倒序扫描在 3/21 边界返回双鱼而非白羊（区间起点无序导致首个匹配即错），改为「取 ≤ 当日的最晚起点」后边界全对。**视觉未验证**：沙盒无法渲染，水墨观感/墨晕动画节奏/移动端竖排干支牌需本地过目。**连带影响**：全站现 8 页，C5 Astro 触发线达标（roadmap 队列 A 已标注：加第 9 页前必须先做 Astro 评估）。

---

### B9.（S）Odin 舰体贴花收尾（机会主义拾取，队列 B B9）— 2026-07-05

**背景**：V15 上线时明确留了一条「已知简化」——旧舰体贴花（"TC CONDOR"/"01"/危险警示条）从未在 Odin 新舰体上重新定位。查根因发现：`capitalShip3D.js` 的贴花辅助函数（`mkTex`/`decal`/`textTex`/`dangerTex`）一直定义在旧楔形舰体的 `else` 分支内部——这正是 `?ship=odin` 分支此前零贴花的直接原因，不是"忘了搬"，是这些函数根本不在 Odin 分支的作用域里。

**交付**：把贴花辅助函数提到 if/else 之上，两个分支共用；Odin 分支新增 5 处 `decal()` 调用，坐标全部由 `createOdinHull()` 的真实返回值（`bowRoot`/`bowLen`/`length`/`height`/`turretMounts`）现算，不是照抄旧舰体坐标——`oNose`/`oStern`/`oSternRoot` 三行特意加注释镜像 `odinHull.js` 内部同名常量的公式。舰名牌"TC CONDOR"+注册号"310106"贴在舯部两舷；"01"标牌贴在最靠舰艏的 `turretMounts[0]` 旁（**开发中先算错一次**：一开始挂在 `muzzleAnchor` 上，实际探出到 z≈3.0，侵入 V15 规格明确要求"留白"的刀锋舰艏区，跑 Node 直接核对 `createOdinHull()` 数值后发现并改正）；两枚危险警示条贴在尾部推进器舱两侧（**同样先算错一次**：y 值写成 `height*0.3`≈0.545，溢出尾部甲板半高 `sternDeckH/2≈0.45` 的边界，改成绝对值 0.3 后核对通过）。

**greeble InstancedMesh 优化——评估后判断跳过，不是遗漏**：`odinHull.js` 的散布逻辑里每个 greeble 盒子是不同随机尺寸的独立 `BoxGeometry`，要收成单 draw call 的 InstancedMesh 得引入"共享单位立方体+非均匀缩放矩阵"，还得给 `odinHull.js` 加一个新的"可批处理 vs 结构件"回调区分（否则 `shipHologram.js` 的逐 greeble 线框描边效果会丢），改动面会碰到已有 vitest 覆盖的纯函数契约——而当前性能量级本来就和 `capitalShip3D.js` 其余部分一致（未劣化），投入产出比不划算。

**验证**：219/219 测试通过（本次改动不影响 `odinHull.js` 本体，`tests/odinHull.test.js` 15 条不变）；`npm run build` 干净（`capitalShip3D` 分片 10.25KB→10.60KB）。**观感仍需真人在浏览器过目**（沙盒无法渲染 WebGL）。

---

### B7.（S）Games「夺冠之路」对阵树状图（机会主义拾取，队列 B B7）— 2026-07-05

**背景**：`src/pages/games.js` 的 `renderBracket()` 此前硬编码只渲染 `data.bracket.qf`——8 强战完之后即使数据里出现 `bracket.sf`/`bracket.final`，前端也没有渲染路径，等于半成品。

**交付**：改为 `BRACKET_STAGES = [qf, sf, final]` 顺序遍历，`data.bracket` 里实际存在（非空数组）的阶段才渲染成一个带小标题的 `.bstage` 子区块，卡片本身复用原有 `.qf`/`.qf-h`/`.qf-leg`/`.qf-slot` 等 CSS class（未改视觉，只改数据消费面）——淘汰赛路径会随定时任务逐轮推进自动接上，不需要再改前端代码。区块大标题原本是 `games.html` 里写死的「ROUND OF 16 → QUARTER-FINALS」，而 `bracket.stageLabel_en/zh` 字段其实早就写在数据里却从未被前端读取——现在改为 JS 动态读取该字段设置标题。同步修改了 `games-worldcup-daily` 定时任务的 prompt：要求 8 强出线后创建 `bracket.sf`（含 WebSearch 核实的真实半决赛对阵/日期/场馆，`legs[].qfId` 关联对应的 `bracket.qf` 条目 id）、4 强出线后创建 `bracket.final`（`legs[].sfId` 同理），每轮更新 `stageLabel_en/zh`；并明确 `bracket.*` 各阶段数组**只增不删**——这与 `fixtures[]` 打完即删的精简策略刻意相反，因为保留完整路径正是这个功能存在的意义。

**验证**：219/219 测试通过（本次是紧耦合 DOM 渲染代码，同 `games.js` 既有惯例不补 vitest）；`npm run build` 干净。真实的 SF/决赛数据要等淘汰赛实际打到那一轮、定时任务下次运行才会出现。

---

### V9–V11.（M）Sectors 中美 AI 对比矩阵 + 后内存专题 + 定时任务 — 2026-07-05

**交付**：`src/lib/validateSectorsData.js`（纯校验函数，16 条 vitest，字段名与 `prompts/sectors-watch.md`/`prompts/postmemory-top10.md` 输出 schema 逐字对应——4 厂商 enum、open/closed route、US/CN market、direct/supplier/infra/competitor 关系标签、T1/T2/T3 track id、unchanged/updated 卡片状态，且显式拒绝任何数值相关系数字段）+ `scripts/validate-sectors-data.mjs`（发布前校验 CLI，同 `validate-signal-events.mjs` 模式）。种子文件 `public/sectors-data.json` = `{updated:null, version:1}`——校验器显式接受这个「空种子」状态，前端据此渲染空状态文案而非假数据。

`sectors.html` 新增两个数据驱动区块，复用 `signal.html` 已验证的 inline IIFE `fetch`+`render()` 模式：「US–CHINA AI WATCH」渲染 `modelWatch[]`（4 厂商卡：路线徽章+当前版本线+≤3 条带来源动态+代差研判）与 `baskets[]`（按厂商/市场分组的标的 tag，附定性关系标签）；「POST-MEMORY ERA」渲染 `postMemory.tracks[]`（T1/T2/T3 三主线状态）与 `postMemory.cards[]`（护城河/论点/关键风险三段式 + 催化剂 + 状态徽章），换股提议区块仅在非空时渲染。

新建定时任务 `sectors-watch-weekly`（`0 10 * * 0`，周日 10:00 本机时间，SKILL.md 结构完全比照 `signal-warsh-daily` 的 STEP 0-5 五段式）：判定月首周→`monthly_deep` 深审模式 → 读两份现成提示词+现有数据 → WebSearch+`/api/quote` 采集 → 按 schema 合并写 JSON（`weekly_take_zh`/`weekly_take_en` 重命名为嵌套的 `weeklyTake.zh`/`weeklyTake.en`，其余字段名与提示词输出逐字保留）→ 跑校验 CLI 不过则中止 → 仅 commit+push `sectors-data.json` 一个文件。

**验证**：219/219 测试通过；`npm run build` 干净（`sectors.html` 22.40KB→32.88KB）。**前端与后端管线均已就绪，真实数据要等下一个周日调度触发才开始出现**——纯粹是时间等待，性质上不同于需要人工介入的视觉验收项。

**原始规格存档（从 roadmap.md §7.2 归档移入）**：对比矩阵——4 厂商观察卡（美：Anthropic/OpenAI；中：智谱/阿里）每周更新，每卡含当期版本与路线、本周关键动态（带来源链接）、映射标的篮子。标的映射纪律——定性关联标签（direct 直接受益/supplier 上游供给/infra 算力底座/competitor 受压），不给伪造的统计相关系数（接 Twelve Data 历史真算 90 日价格相关性列为 stretch goal）。后内存专题——三主线（HBM 产能与定价权/CXL 内存池化/NAND KV-Cache 分层）+ Top 10 论点卡，报价复用现有报价管线，OTC ADR 报价源缺失时该卡降级为纯论点展示不放假数据。**集中度声明（诚实纪律，持续有效）**：首页 Top 10 是单一主题（AI 硬件/内存墙）的主题组合，不是分散配置——高相关、同涨同跌，页面文案与专题卡需持续明示 + not advice；V12（队列 A）起对该组合自 2026-07-04 换仓日相对 SPY/SMH 的表现做公开记分，包括错的时候。

---

### V19 Phase 1.（S）Arena 自选股「预测差值」信号层——数据管线起跑 — 2026-07-05

**背景**：站主对 V13 TA 仪表盘的批评——数据太重，只想看「AI 预测 vs 实际」的差值本身。评审后拆成三期，Phase 1 先把 schema 扩到位、攒几天真实预测-实际配对数据，Phase 2（校准）/Phase 3（信号卡 UI）留待数据攒够后再做。

**交付**：`src/lib/predlogEntry.js`（纯函数：`pctChange`/`directionHit`/`buildPredlogDay`/`appendPredlogDay`，16 条 vitest，覆盖零/负基数、非有限值、旧 schema 缺字段回退、日期幂等 upsert、60 天滚动窗口裁剪）+ `scripts/apply-arena-predlog.mjs`（CLI：校验 `date` 必须与 `arena-news.json` 的 `date` 一致，不一致直接 `exit 1` 不吞错，用 `news.prices[sym].prevClose` 建基准算差值，写回 `public/arena-predlog.json`，不做 git 操作，同 `apply-arena-run.mjs` 的分工模式）。种子文件 `public/arena-predlog.json` = `{updated:null, version:1, days:[]}`。

调度侧两处改动：`ai-stock-arena-news-digest` 的 prompt 加了 `predOpenPct`/`predClosePct` 两个输出字段；新建定时任务 `arena-predlog-close-backfill`（`15 7 * * 2-6`，收盘后跑，避开 `signal-warsh-daily` 的 07:06 时段）负责 fetch 当日真实 O/C → 写 input 文件 → 跑脚本 → git add 仅 `public/arena-predlog.json` → commit+push。

**验证**：219/219 测试通过（`predlogEntry.test.js` 16 条）；已用合成数据端到端 smoke test 过一遍，包括日期不匹配时正确报错退出、不改动文件的路径。**真实数据要等两个定时任务各自的下一次调度触发才开始积累**。

---

### V18.（M-L）战斗视图「立体化」——全 3 个 Phase — 2026-07-05

**背景**：`combatCine.js` 的导弹护航编队镜头是 canvas 2D 平面填色+粒子爆炸，无光照无纵深；目标是升级为 SC 参考图的电影级追击视角。地基全部已存在（`topdownCombat.js` 完整 THREE.js 战斗场景、`weaponCameraDirector.js` 镜头状态机、`nighthawk.js` 战机 PBR-lite、`weaponClock.js` 权威时间线），本项不需要从零建任何系统，本质是把 2D 分镜迁进 3D 场景 + 补齐深度构件。

**Phase 1 · 追击相机 + 模型换装**：`weaponCameraDirector` 新增 `chaseCam` 预设——机位在战机尾后偏侧上方（`cameraMath.chaseCamPose`，plain-vector 纯函数，13 条 vitest），临界阻尼跟随+banking（`bankAngle`→`bankedUpVector`）+动态 FOV（`fovForAccel`，62°→70°），**加速度驱动、非时间驱动**——直接对 `fighters[0]` 现成的解析飞行公式求一二阶导数，不引入帧差分噪声。`weaponCameraDirector.js` 的 shot `compute()` 新增可选 `fov`/`roll` 字段，缺省时精确还原原行为，5 个旧镜头预设零改动。导弹分镜迁移到 3D chaseCam：`main.js` 新建 `startTimeline('missile', [...])`——**这是 `weaponClock.js`（V16）第一次被真正消费**（施工中发现 V16 当时只交付了纯函数模块+单测，从未被任何调用点 import 过，此前「V16 已上线」的表述对「接入」二字过于乐观）；`topdownCombat.js` 新增 `driveMissileTimeline()`，`main.js` 的 `mode==='missile'` 分支新增第三条路径，仅当 `?combatview=topdown&combatcam=director` 同时开启才渲染，否则完全落回原有分支，字节不变。

**Phase 2 · 空间深度四件套**：单个 `InstancedMesh` 引擎尾焰彩带（横跨全部战机，1 次 draw call，每机独立环形缓冲采样尾部坐标，逐段 billboard 朝相机定向，白→青→蓝三段渐变随年龄衰减）；近景尘埃+速度拉伸粒子（定长对象池，`prefers-reduced-motion` 下减半，帧差分相机速度驱动拉伸方向）；光照/喷口辉光/深度雾化确认场景既有资源已满足同等效果，未重复造轮子。

**Phase 3 · 环境叙事层**：太阳眩光复用场景既有 `key` 方向光（不另开一盏），`camForward·SUN_DIR` 的平方控制强度；两枚 lens ghost 用 NDC 镜像+`unproject()` 的标准廉价手法；山脊剪影视差路线图原文自述「不强求」且已有同等纵深参照，确认跳过不是遗漏。

**门禁**：全程挂 `?combatcam=director`/`?combatview=topdown` 灰度，默认行为字节级不变；性能红线（实例化每类 ≤1 draw call、粒子对象池、无独立 rAF）全程遵守。

**验证**：187/187 测试通过（cameraMath 13 条新增 + weaponCameraDirector 3 条新增）；`npm run build` 干净（`topdownCombat` 分片 21.15KB→24.42KB）。**全部观感仍需真人在浏览器里过目**（沙盒无法渲染 WebGL）——这是这条战线当前唯一悬而未决的风险点，详见 roadmap.md §1 queue B item 1。

---

### V5.（M）Arena Autopilot 前端区块 + B10 旧 Human vs AI 代码正式下线 — 2026-07-05

**背景**：V13（2026-07-04）已经把 Human vs AI 对战区用 `.legacy-hidden` 暂时隐藏、TA 技术分析仪表盘接管首屏；B10 一直悬而未决——恢复共存还是正式删除。本轮用户明确：TA 仪表盘就是 arena 页现在的正式内容，旧对战区正式关闭，Autopilot 区块紧接在 TA dashboard 下方。账本当时复核仍是 `day:0`/`lastRunDate:null`（V4 定时任务还没首次真正运行），用户明确选择「现在开工，UI 做好空状态优雅显示，真实数据一来自动填满」而不是等 ≥3 交易日。

**B10 清理范围（比预想大得多）**——深入代码后发现 `arena.js`（原 375 行）几乎全部是旧游戏逻辑，不是一个可以简单删掉的隐藏 `<div>`：
- 删除：名单轮询（`TICKERS`/`finnhubProvider`/`poll()`/`pollInterval`）、逐股图表 + MA/MACD/KDJ/VOL 技术指标绘制（`renderChart`/`moveCross`/`sma`/`emaSeries`/`macdCalc`/`kdjCalc`）、Twelve Data 历史缓存（`ensureHistory`/`fetchTD`/`tdCacheGet/Set`）、OPEN/CLOSE 预测下注（`placeBet`/`tryResolve`/`scoreRound`）、计分板（`renderScore`/`sideBox`）、种子化模拟序列生成器（`genSeries`/`mulberry32`）——`arena.js` 现在瘦身到 ~85 行，只保留页面通用外壳：简报弹窗、市场状态/倒计时 chip、情绪聚合、自定义 HUD 光标。
- **附带发现**：hero 顶部的 DATA/UPDATED 两个 chip + Refresh 按钮专门反映旧名单的 Finnhub 轮询健康度，旧代码删除后这组指标失去意义——用户选择直接删除，只保留市场开盘状态与新闻情绪两个 chip。
- **"今日信号"迷你新闻列表**（`#newsList`，和简报弹窗内容重复）虽然功能上独立于游戏本身，但 DOM 上恰好也在被隐藏的 `.grid.legacy-hidden` 容器里——用户选择保留，搬到 Autopilot 区块下方新位置，继续复用同一套 `.news`/`.empty` CSS。
- **必须一并处理的连带问题**：`<title>`/meta description/og 标签、header 标语、hero 大标题与正文、footer 免责声明，全部是围绕"预测游戏"写的文案，旧代码一删就变成谎报页面功能的过期文案——本轮同步重写为准确描述「TA 仪表盘 + Autopilot 模拟盘」的新文案（中英对照），SVG logo 的 `aria-label` 从 "Human vs AI" 改为 "Arena"。CSS 侧同步删除所有只服务于旧游戏的选择器（`.watchlist*`/`.tk*`/`.chart-badge*`/`.tf*`/`.cgrid`/`.cma*`/`.xh-*`/`.ind*`/`.acq*`/`.pred*`/`.bet*`/`.pmode*`/`.sc*`/`.rd*` 等，约 250 行），保留仍被复用的通用原语（`.panel`/`.sec-label`/`.empty`/`.news`/`.chip`/`.foot`/`.bf-*`/`.fx-cursor`），修掉两处因此产生的孤儿引用（`body.has-cursor .tk` 选择器、`@media(max-width:1080px)` 里指向已删除 `.grid`/`.watchlist-wrap`/`.main`/`.side` 的响应式规则）。

**V5 交付**：新文件 `src/pages/arenaAutopilot.js`（自包含 IIFE，架构上与 V13 的 `arenaTech.js` 同构——独立 fetch `arena-ledger.json`/`arena-universe.json`，只通过 `afflatus-lang` 事件和 `window.AfflatusI18N` 与页面外壳通信，不直接调用 arena.js 的函数）+ 新纯函数模块 `src/lib/arenaLedgerView.js`（`unrealizedPnl`/`benchmarkEndpoints`/`equityDomain`/`scalePoint`，13 条 vitest 覆盖，遵循本项目账本类代码必须可单测的纪律）。渲染内容：净值 SVG 折线图（Model A 酸绿、Model B 青色两条真实逐日曲线 + SPY 琥珀/SMH 品红两条基准参考线）、每个模型一张卡片（EQUITY/CASH/CUM%/MAXDD/HIT%/EXPOSURE 六个指标 chip + 中英复盘文案 + 持仓表 + 近期成交/拒单合并日志，均含空状态占位）。

**⚠️ 基准线的诚实妥协**：`arena-ledger.json` 的 `bench.spyPct/smhPct` 只是最新一次运行的**累计百分比标量**，不是逐日历史序列，因此没有数据可以画一条真正的 SPY/SMH 历史净值曲线。`benchmarkEndpoints()` 老实地只画一条两点直线——「从模型账本第一天的起始净值，到最新一天按累计基准百分比换算后的终值」，本质是"从第 0 天起买入并持有 SPY/SMH 的参照线"，不是真实逐日行情，图例上与模型曲线用不同虚线样式区分，避免误导。这一限制目前无法解决（除非 V12 数据管线里给 bench 也加一份逐日历史，那是后续工程量，不在本轮范围内）。

**验证**：171/171 测试通过（新增 `tests/arenaLedgerView.test.js` 13 条）；`npm run build` 干净（`arena-*.js` chunk grep 确认 `watchlist`/`scoreboard`/`predBody`/`srcChip`/`legacy-hidden` 等旧字符串全部清除，`apDash`/`apModelA`/`apChart`/`Autopilot`/`arenaLedgerView` 新字符串确认在产物里）；`vite preview` 起服务对 `arena.html` curl 200 且产物含 `apDash`；CSS `{`/`}` 配对数一致（353/353），排除误删/多删括号。**视觉未验证**：沙盒无法渲染 SVG/canvas，图表实际观感、模型卡片布局密度需本地打开 arena.html 确认；当前 `arena-ledger.json` 仍是 `day:0`/无成交的起始状态（V4 定时任务尚未真正跑过一次），页面上会看到两条平的 $10,000 起点和"尚未成交"占位文案，属预期——真实数据积累后会自动变丰富，不需要再改代码。

---

### V17c.（S）combat view 遮挡/重叠排布修正（用户看到 V17b 实际效果后的第三轮反馈）— 2026-07-05

按用户截图反馈处理三处布局问题：① 顶部航向刻度带数字上半被画布顶边裁切——`drawSCHeadingTape` 的基准线 `y0` 从 `h*.055` 下移到 `h*.10`，给数字留出完整高度；② 座舱控制台原有左右两块镜像 OUTPUT 5/16 MFD 屏，只保留一块并居中（`mfd()` 只调用一次，位置改为 `w*.5-mw/2`）；③ 该 MFD 屏底部原有的「‹ POWER MANAGEMENT ›」页脚文字与描边框整体删除（连带把屏高从 `h*.20` 收窄到 `h*.155`，去掉页脚腾出的空白）。第四处是目标锁定后 `SHIELD QUAD`（FORE/AFT/PORT/STBD）方格与目标框自带的 `1P/HALLEY`/`720.0 M` 名称·距离标签重叠——根因是方格原来画在目标框右侧、与名称标签同一侧同一高度，方格左边界常常落在标签文字还没画完的位置；改为把方格移到护盾/装甲血条正下方（`gx=cx-bracketS*1.1, gy=cy+bracketS*1.38+30`，与血条左对齐、留 30px 间距），与目标框标签（右上方）在空间上完全分离，不再依赖标签文字宽度这个不可控量。

**验证**：158/158 绿；构建绿；headless mock-ctx 扫描（`drawCockpitFrame` boot×landing×4 种尺寸、`drawSCHeadingTape` 5 个航向边界值、`drawCleanCombatHmd` 4 种模式×4 种尺寸）零运行时错误；源码确认 `mfd(` 调用点仅剩 1 处，构建产物 grep 确认 `POWER MANAGEMENT` 零残留。**视觉未验证**：沙盒无法渲染 canvas，方格新位置是否确实清爽、MFD 单屏居中是否协调需本地硬刷新确认。

---

### V17b.（S）combat view 视觉清理 + SC 准心/航向带（用户看到 V17 实际效果后的第二轮反馈）— 2026-07-05

按用户截图反馈逐项处理：① 仪表台顶部的贝塞尔曲线轮廓+边缘描边读成「波浪形线」——台面剪影改为平直顶边渐变填充，描边整体删除；② 左上 ENG/WPN/SHD 动力三柱删除（`drawPowerPips` 函数与调用一并移除，工厂依赖 `weaponRemaining` 因此成为孤儿也同步从签名与 main.js 实例化处清除）；③ 横穿中屏的遥测下划线删除（改纯文本双标签，`telemetryLine` 原语不动——main.js 其他视图还在用）；④ 两侧 THR/VEL 半圆弧仪表删除；⑤ 准心与航向带按 SC 参考图重做——新 `drawSCReticle`（四向短划会聚+中心点）与 `drawSCHeadingTape`（密集度数刻度、每 20° 数字主刻度、中央上指箭标+当前航向读数，右侧裁切避开 OBJECTIVE 面板），FPM 改为 SC 式括号点标记（去掉圆圈三臂与虚线牵引线）；雷达罩读数从 269° 统一到站点 lore 的 128°（消除同屏两个互相矛盾的航向）。

**验证**：158/158 绿；构建绿；headless mock-ctx 扫描（boot×landing×conic×6 模式×3 尺寸 + 航向 0/5/123/269/358 边界）零运行时错误；dist grep 确认 `ENG WPN SHD` 零残留。视觉观感仍需本地确认。

---

### V17.（M）战机视角 SC 座舱 HUD + TARGET LINK 开机序列（用户直接指定，参考星际公民截图）— 2026-07-05

**需求**：按用户提供的星际公民座舱截图，把 SC 风格 MFD 座舱融入战机视角 combat view；起飞时系统在 TARGET LINK 中一键分阶段启动；彻底删除背景里的三角形舷窗。

**关键发现（本轮最有价值的一条）**：旧「三角舷窗」之所以读成"背景里的鬼影"，根因是**绘制顺序 bug**——`drawPilotHmd` 内部的 `drawPilotSpace` 用 .92-.98 alpha 的近不透明星空**盖在**先画的座舱框架上，座舱只剩 ~5% 残影。删除三角支柱只治标；本轮同时把 standby/combat/launch/landing/topdown 五条分支的绘制顺序全部改为「星空（充当清屏）→ 座舱控制台 → HMD 线条层」，控制台第一次真正以前景形态可见。

**交付**：`drawCockpitFrame` 重写（combatHmdV3.js，保持纯函数）——删除 A-frame 三角支柱/顶梁/舱盖弓；新 SC 控制台：左 PWR/WPN/THR/SHLD/COOL 按钮列（WPN 琥珀高亮）+ 右 RADR/PROX/HIT/MISL、双 MFD 电源管理屏（OUTPUT 5/16、三列分段电源块、OFFLINE/BATTERY、‹POWER MANAGEMENT›页脚）、中央雷达罩（conic 扫描线+光点+269°·2.8KM 读数，无 createConicGradient 时降级为线扫）、仪表台顶读数条。新增 `boot` 参数（0..1）驱动分阶段上电：台缘灯→按钮列逐个→MFD 扫描线暖屏→雷达罩转速爬升→读数条→中屏 PWR BUS/AVIONICS/WPN SAFETIES/SENSOR ARRAY/TARGET LINK 逐行 SYNC→OK→「TARGET LINK ESTABLISHED」加发光闪屏。`drawCleanCombatHmd` 新增 `drawSCChipStacks`（左 SCM/GUN+CPLD/ESP/LOCK+速度/弹药，LOCK 绑定真实锁定状态；右 DECOY 24/NOISE 2+VTOL/GEAR/GSAF；w<340 或 h<250 时整体跳过防糊）；底部遥测条上移到 h*.72（否则被加高的仪表台盖住）。main.js：`cockpitBootT()` 时间线——首次进入 standby/combat 跑完整 2.6s 序列（页面首屏也有开机秀），起飞交接后从 65% 续跑 1.5s 收尾（起飞滑跑过程中控制台已随 elapsed 分阶段点亮），HMD 线条层随 boot 淡入。

**验证**：158/158 测试绿；构建绿，dist grep 指纹确认；**headless 绘制扫描**——Node mock ctx 全参数矩阵调用（boot 0→1 × landing × conic 有无 × 6 种模式 × 2 种尺寸 × 目标有无）零运行时错误。**视觉未验证**：沙盒无法渲染 canvas，控制台布局密度/开机节奏的实际观感需本地确认；绘制顺序修复对 launch/landing 的甲板残影观感也有连带影响（理论上更清晰，请一并看一眼）。水印未包含（本来也不会画参考图里的任何位图内容）。

---

### D1–D5. 站内架构/UX 审计快赢（用户指定最高优先级）— 2026-07-05

**背景**：产品经理+架构师视角的一轮批判性复核，发现 5 项可在半天内解决的真实问题——逐条对照构建产物/API 代码/dist 抽查核实，不是猜测。核心结论：后端自动化纪律（状态外置/规则引擎/发布校验）比前端健康得多；前端最大问题是 `/api/quote` 无白名单+无限流的开放代理、简报强制门禁挡在工具类页面前面、`INEFFECTIVE_DYNAMIC_IMPORT` 构建警告、移动端触控目标不足、i18n 首帧闪烁+无 sitemap 拖累中文 SEO。

- **D1.** `/api/quote`/`api/history.js` 的 symbol regex 从宽松的 `^[A-Za-z.\-]{1,12}$` 收紧到真实 ticker 形状 `^[A-Za-z]{1,5}([.\-][A-Za-z]{1,2})?$`（支持 `BRK.B`/`BRK-A` 后缀）。原计划的固定 30 支白名单方案与 V13 已上线的「搜索任意美股代码」功能冲突，经确认后改为不做硬白名单；新增基于 IP（`x-forwarded-for`）的每容器滑动窗口限流（纯函数 `src/lib/rateLimit.js` + 薄封装，quote 60 次/60s、history 20 次/60s，超限 429 + `Retry-After`）。非分布式限流（Vercel serverless 按实例隔离），配额吃紧再评估 Upstash/KV。
- **D2.** `arena.js` 简报门禁降级——`bfEnter` 默认可点击直接关闭（原先 `disabled`，要滚动进度 ≥96% 才解锁）；`Skip` 与 `Enter` 视觉权重拉平（两者都 `flex:1` 对齐）。简报内容本身保留，只去掉「必须读完」的强制感——V13 上线后旧对战区已隐藏，这套仪式挡在一个日常工具页前面不合适。
- **D3.** index.html 里 `topdownCombat.js` 的静态 `<script src>` 换成条件化内联 `<script type="module">`（复用 harness 自身 `?combat=topdown` 门槛后再 `import()`），消除 vite `INEFFECTIVE_DYNAMIC_IMPORT` 构建警告。**范围调整**：背景 canvas 的 `IntersectionObserver` 未做——核实后 `#starfield`/`#blackhole-gl` 是 `position:fixed` 全屏背景层，不存在「滚出视口」这个状态，对其做 IntersectionObserver 是死代码；切标签页挂起（`document.hidden`）在 `main.js` 的 `frame()` 里本来就已存在。原 P3 B5 一并标记不再单独跟踪。
- **D4.** arena/sectors/signal/games/serial/league 六个入口页的 `.nav a`/`.hbtn`/`.tf-b`/`.ind-b`/`.ta-chip`/`.ta-mode` 加 `::before` 隐形热区扩展到 ≥44px（视觉大小不变）。**范围调整**：全站 9-10px 小字扫查涉及几十处装饰性小字，风险超出 S 量级快赢范围，未做；只把最初审计发现的 Arena 交易 HUD 密集标签（`.ta-chip i`/`.ta-mode i`/`.ta-sg i`）在 `@media(max-width:720px)` 下提到 11px。
- **D5.** 新增 `public/sitemap.xml`（7 个入口页），`robots.txt` 指向它；7 个页面 `<head>` 最前面加同步内联脚本，按 localStorage 缓存语言提前设置 `<html lang>`（不等 `i18n.js` 作为 module script 跑完）。**范围调整**：首屏文案「先英后中」跳变未根治——首页 hero 标题/副标题走 `main.js` 独立内容管线（非 `i18n.js` 的 `data-en`/`data-zh` 机制），根治需服务端按 `Accept-Language` 分流，留给 C5 Astro 迁移一并解决。

**验证**：158/158 测试通过（新增 `tests/rateLimit.test.js`）；`npm run build` 无 `INEFFECTIVE_DYNAMIC_IMPORT` 警告；7 个入口页 `vite preview` 均 200。

---

### V13.（M）Arena 美股技术分析仪表盘（用户直接指定需求）— 2026-07-04

**需求来源**：用户直接提出（非既有 roadmap 编号，占用空缺的 V13），把 arena.html 改造为个人日常盘前/盘后浏览用的美股技术分析面板；原 Human vs AI 对战区**暂时隐藏**（源码全保留，`.legacy-hidden{display:none}`，移除该 class 即可恢复）。

**交付**：`src/lib/technicals.js`（纯函数指标库：MA5/10/20/60/200 快照含斜率与价上/价下、经典枢轴点 PP/R1-3/S1-3、分形摆动高低点支撑阻力（1.2% 聚类+触碰计数）、心理整数关口（分档大/小刻度，必含最近整百整五十）、缺口检测（未回补/部分/已回补三态）、20 根箱体放量突破检测（守住/失守状态）、`normalizeDaily` 剔除盘中未完成日K、`analyzeTicker` 总装）+ `tests/technicals.test.js`（21 条）+ `src/pages/arenaTech.js`（渲染层：自选股条（复用 `arena-universe.json` 30 只，按 bucket 着色）、搜索（列表模糊匹配+回车加载任意代码）、盘前 PRE（最近完整日K算下一交易日计划位）/盘后 POST（前一日计划位复盘最近交易日实际触碰）双视图（按美东时间自动默认）、垂直价格标尺 Level Ladder（全部关键位画上同一价格轴，支撑+整数关口带绿色 LIMIT ZONE 限价参考标记，缺口画色带，POST 模式叠加日高/日低标记，标签防碰撞双列错位）、四张卡（关键价位/均线/枢轴点/历史特殊点位）各带可折叠算法说明）+ arena.html 新增 `#taDash` 区块与全部配套 CSS。数据全真实：`/api/history` 日线 250 根（localStorage 按日缓存）+ `/api/quote` 实时价，无任何模拟数据。旧 arena.js 在检测到 `.grid.legacy-hidden` 时把报价轮询降频到 120s（隐藏 UI 不烧 Finnhub 配额）。

**验证**：`npm run test` 144/144 绿（新增 21 条）；`npm run build` 绿；`vite preview` 7 页 + `arena-universe.json` curl 200；dist 产物 grep 确认 `LEVEL LADDER`/`限价参考区`/`arena-universe.json` 指纹全部进 chunk；**另做了一次真实数据端到端验证**——抓取线上 `/api/history` 的真实 NVDA 日线，走与 arenaTech.js 完全一致的映射管线跑 `analyzeTicker`，逐项断言通过（PP/R1/S1 与手算一致；管线自动识别出 6/23 真实向下跳空缺口 [203.77–207.72] 且正确判定未回补；整数关口 $200 判 major；MA5/10 价下）。**视觉未验证**：标尺/卡片布局在沙盒无法渲染，需本地确认观感。i18n 全覆盖（data-en/zh + data-en-ph 占位符 + 动态 T()）。

**V13 上线后热修：Level Ladder 标签重叠 bug**（用户反馈截图，同日）——用户上线后截图反馈价位标尺（Level Ladder）标签严重重叠遮挡（多处价格数字前后叠印无法辨认、缺口标签压在下方标签上、当前价框直接盖住紧邻下方的标签）。**根因**：原 `renderLadder` 只对右侧标签做了一个基于「高度百分比」的弱双列错位（阈值 3.4%，与真实文字像素尺寸无关），左侧价格数字、缺口标签、当前价标记完全没有防碰撞逻辑，密集时必然互相覆盖。**修复**：新增 `src/lib/ladderLayout.js`（纯函数，不碰 DOM，独立于 `technicals.js` 因为这是排版问题不是指标计算问题）——`declutter1D`（双向单调扫描防重叠算法：保证任意两个标签间距 ≥ minGap，保持原始相对顺序不交叉，绝不压缩标签只会增长容器）+ `fitExtent`（计算需要的额外偏移量/容器高度，避免裁切而不是让标签挤到看不清）。重写 `renderLadder`：所有标签（关键位行、缺口标签、当前价、盘后模式的日高/日低）现在进同一个防重叠池统一避让，而不是各自为政；同时把「真实价格位置」（价位线、色带——永远画在数学上正确的位置）和「标签显示位置」（防重叠后可能挪动的位置）分离，两者差距超过几像素时画一条引导虚线连接（参考真实交易软件价格轴的通用做法）。arena.html 对应 CSS 同步重写以匹配新的 DOM 结构（`.lad-lv` 纯线条 / `.lad-lab` 标签块 / `.lad-leader` 引导线 / `.lad-gaplab`/`.lad-px-line`/`.lad-px`/`.lad-sess-line`/`.lad-sess` 拆分），并移除 `.ta-ladder` 上会跟 JS 显式 `style.height`打架的 `flex:1`。

**验证**：新增 `tests/ladderLayout.test.js`（8 条：已有间距不动、复现截图密集聚集场景断言全部间距达标、保序不交叉、全同值均匀展开、0/1 项边界、`fitExtent` 三种场景）；`npm run test` 152/152 绿；`npm run build` 绿；`vite preview` 7 页 curl 200；dist 产物 grep 确认新 CSS 类名（`lad-leader`/`lad-gaplab`）已进 `arena.html` 且旧类名（`.lad-lv.c1`/`.lad-lv u`/`.lad-lv em`）无残留。**本轮沙盒无网络出口**（`feida.au` DNS 解析失败），无法重复上次的真实 NVDA 数据端到端验证；改用确定性种子生成的合成日线数据（260 根，随机游走）走完整 `analyzeTicker` 管线产出 17 个真实关键位/当前价标签，喂给 `declutter1D`/`fitExtent`，确认零 NaN、任意两标签间距精确 ≥16px、容器高度按需增长——验证的是新防重叠算法与真实指标管线拼接后的整体行为，非声称使用了真实行情。**视觉仍未验证**：沙盒无法截图渲染，标签是否真正不再遮挡需本地打开 arena.html 确认。

---

### V7.（S）Signal 定时任务升级 — 2026-07-04

架构同 V4：Cowork scheduled-tasks，不是 launchd。新建 `public/signal-release-dates-2026.json`（WebSearch+直接抓取核实的 2026 全年 CPI/NFP/PCE/FOMC 发布日历，来源 bls.gov/bea.gov/federalreserve.gov 官方页面，非搜索摘要转述）供任务做 no-op 门禁：命中发布日 → event 模式；否则周五 → weekly 模式；否则跳过不跑（多数日子应该什么都不做，这是预期行为不是 bug）。新增 `src/lib/validateSignalEvents.js`（v2 schema 纯校验函数，12 条 vitest 覆盖：真实 fixture 通过、分数越界/pillar 数量或 tone 非法/事件 id 重复/双语字段缺失/version 错误等全部拒绝）+ `scripts/validate-signal-events.mjs`（CLI 发布门禁——任务必须先跑这个再 commit，非零退出码就中止发布，不留半成品到线上）。**这个校验器是吸取 V6 教训后加的**：V6 手工编辑时曾因未转义引号打断 `JSON.parse`，无人值守的定时任务没有人工审查这一步，必须靠代码把关。调度任务 `signal-warsh-daily`（cron `0 7 * * 2-6`，AEST 07:00 周二至周六，映射 ET 周一至周五 17:00 收盘后 1 小时，与 V4 的 AEST↔ET 错位规律一致）已创建，提示词自含 STEP 0-5（判定模式→读取上下文→WebSearch→按 schema 撰写→跑校验器→仅校验通过才 git add/commit/push，且只碰 `signal-events.json` 一个文件）。

**验证**：`npm run test` 123/123 绿（新增 `validateSignalEvents.test.js` 12 条）；`npm run build` 绿；`vite preview` 7 页 + `signal-events.json` + `signal-release-dates-2026.json` 全部 curl 200；校验器 CLI 对真实文件（OK）与故意损坏的文件（FAIL，exit 1）都做过烟测。**首次真实触发**（本周二 AEST，映射 ET 周一）尚未发生，非发布日也非周五，预期是一次干净的 no-op——建议观察前几次运行日志确认门禁逻辑按预期工作。

---

### V6.（M）Signal「Warsh 时代」内容重构 — 2026-07-04

`signal-events.json` 从 v1 裸数组迁移到 v2 对象结构（`hawkDoveCompass`/`pillarSummary`/`pillars`/`events`，事件仍用具名 `before/print/repricing/equityReaction` 四字段，未采用 prompt 草稿的 `record_zh/en` 数组写法——保留已验证过的渲染结构，`prompts/signal-warsh.md` 已同步更新对齐）；`signal.html` 新增鹰鸽罗盘区块（`-2..+2` 打分，v1.3/HAWKISH，人工打分，方法说明已注明自动化留给 V7）+ 五维信号矩阵网格（5 张 pillar 卡，通胀/货币政策/财报指引/产业科技/地缘贸易，各带 tone 红/琥珀/绿）+「PERSONNEL FILE — SITE DIRECTOR」人事档案卡（Warsh 7/1 ECB 论坛首秀原话，WebSearch 核实）；对应 CSS（`.compass`/`.pillars`/`.pillarGrid`/`.pillar`/`.gauge`/`.needle` 等）已按站内 SCP 琥珀/纸色调补齐。

**修复一处真实 bug**：`signal-events.json` 的 `rationale_zh` 里混入了未转义的直引号导致 JSON 语法错误（`vite preview` 起服务后 curl 该文件才发现），已改为站内统一的「」引号约定并重新验证 `JSON.parse` 通过——V7 的校验器正是吸取这次教训后补上的门禁。

**验证**：`npm run test` 111/111 绿（本轮无逻辑改动，纯内容/前端）；`npm run build` 绿；`vite preview` 7 页 + `signal-events.json` 全部 curl 200；解析后核对字段（`version:2`/`pillars:5`/`events:3`/`hawkDoveCompass.score:1.3`）。**视觉未验证**：罗盘指针定位与 pillar 网格排布的实际观感在沙盒无法渲染截图，样式逻辑已对齐现有 SCP 视觉语言但需本地确认。

**原始规格存档（V6–V7 落地前的设计要点，从 roadmap.md §7.3 归档移入）**：叙事框架——SCP 收容站更换 Site Director，新主席人事档案卡（政策立场：鹰派 2% 目标、捍卫央行独立、反 QE、激进缩表、反前瞻性指引，均为公开立场按此归档）+ O5 更替事件档案（就任本身作为一份 INCIDENT 收录）。五维信号矩阵：通胀数据/货币政策与美联储动态/企业财报与指引/产业与巨头动向/地缘与贸易，五个 pillar 卡片，`signal-events.json` 每份事件档案打 `pillar` 标签自动归类。无前瞻指引的机械含义：数据发布日波动权重上升，`NEXT CONTAINMENT TEST` 倒计时按 pillar 分类扩展，CPI/PCE/NFP/FOMC 发布日由定时任务事件驱动自动产出事件档案草稿。鹰鸽罗盘首版：讲话稀缺时代单次讲话权重更大，人工打分先行，聚合成指针，自动化留待后续（已实现于 V7）。

---

### V4.（M）Arena 双模型定时任务（v1 切片：Model A 开盘窗）— 2026-07-04

**实施路线偏离文档原计划**：查证 arena-news/games/leagues 三个既有自动化后发现全部走 Cowork scheduled-tasks，不是文档写的 launchd + 外部 API key 方案（那条路径从未真正建过）——V4 照抄已验证的模式。行情走 Cowork 任务实时 fetch 线上 `https://feida.au/api/quote?symbol=X`（已探测确认可用，Finnhub key 已在 Vercel 服务端配置，任务本身不接触任何密钥）。

新增 `src/lib/arenaRun.js`（`runArenaLedger`，纯函数，对 `arenaRules.js` 做单次运行编排：mark-to-market→止损扫仓→逐单校验/撮合→熔断判定→赛季重置判定→复盘文案更新，14 条 vitest 覆盖同日多次运行/跨日/熔断/止损/Model B 星期二四门禁/赛季重置/纯函数不变性等场景）+ `scripts/apply-arena-run.mjs`（CLI 结算脚本，调度任务只产出提案 JSON，这个脚本调用 `arenaRun.js` 真正校验+落盘，任务本身不允许手改 `arena-ledger.json`）+ `public/nyse-holidays-2026.json`（已 WebSearch 核实 2026 全年 10 个休市日，任务运行前先查表 no-op）。`arena-ledger.json` 补充迁移字段 `lastRunDate`/`dayStartEquity`（两本账本各一份，日内多次运行与熔断判定的记账基准）。

首个调度任务 `arena-autopilot-a-open`（AEST 00:30，对应 ET 开盘窗，cron `30 0 * * 2-6`，其余 3 个任务——尾盘窗/Model B 盘后/周度复盘——待这个跑几天验证稳定后再补）已创建——**调度工具的人类可读描述显示"only on Tuesday"，但底层 `cronExpression` 字段确认存的是完整的 `2-6`（周二至周六 AEST）**，这处描述文本的准确性还未跨两次以上运行验证过。提示词 `prompts/arena-autopilot.md`（已就绪，任务运行时直接读取，不复制内容，改动自动生效）。调度、数据获取与 key 管理见 **§7.5**——launchd 段落已过时（未采用），保留仅供历史对照。

**验证**：`npm run test` 111/111 绿（新增 `arenaRun.test.js` 14 条）；`npm run build` 绿；`vite preview` 7 页 curl 200；CLI 脚本对真实 `public/arena-ledger.json` 做过一次实测调用（备份→跑→核对输出→还原），确认端到端读写路径正确。**未验证**：调度任务首次真实运行的完整行为（WebSearch 新闻质量、`/api/quote` 30 个标的连续 fetch 的实际耗时/稳定性、任务自己写的提案 JSON 格式是否总能匹配脚本预期）——这些只能等它真跑一次才知道，建议观察第一次运行的 commit 记录与 `arena-ledger.json` 差异。**V5（前端展示）已排入 roadmap.md，待账本积累 ≥3 个交易日数据后动工。**

---

### V8.（S）v1.5 发布收尾 — 2026-07-04

版本号 `1.4.0` → `1.5.0`（`package.json` 顶层 + `package-lock.json` 两处 version 字段 + `index.html` 首页 `.brand-version` 显示）。全站用户可见文案「Fable 5」→「Fable 5 Max」：`games.html`（meta description/og:description/kicker/brief，含大写 `FABLE 5` 变体）、`arena.html`（`data-en`/`data-zh` 品牌行）、`signal.html`（meta description + 小标题）、`public/games-data.json`（预测研判正文）；顺带同步了 `src/pages/arena.js`/`games.js` 顶部文档注释里的旧称呼（非用户可见，但保持内部文档与实际品牌一致）。`leagues.html`/`leagues-data.json` 因为是 7/4 当天新建，创建时就已直接用「Fable 5 Max」，无需改动。**改名纪律**：只动用户可见文案（HTML 文本节点、`data-en`/`data-zh`、模板字符串渲染内容、JSON 里会被渲染出来的正文字段），不动 JSON 键名/JS 属性名/CSS class；改完后做了大小写不敏感全库 re-grep（`(?i)fable 5(?! max)`）确认零残留，另外确认站内没有裸「Fable」简称需要处理。

ROADMAP 归档收尾：P0/P1 里已完成的 V0/V1/V3/V16/V14/V15/V15b/V15c 详细记录移入本文件（见下），`roadmap.md` 只保留仍在跟踪的条目；「视觉轨」整条已全部完成，从 P1 移除；未完成的收尾项（V14 的 `impactOrbit`/FOV/空间深度四件套、V15 的贴花与 InstancedMesh 优化）转成 P3 新条目，不随旧版块一起丢失。

**验证**：`npm run test` 全绿；`npm run build` 绿，7 页 curl 200；`grep` 确认版本号与品牌名改动均落进对应产物。纯文本/JSON/版本号改动，无几何/渲染逻辑变化，风险极低，不需要视觉验证。

---

### V15 Odin 参考全息舰重建 + V15b 战机保真度 + V15c 参考细节补全

**目标**：按用户提供的 Blender 参考截图，重建 `shipHologram.js`（登录页全息投影）与 `capitalShip3D.js`（首页 Labs 场景主战舰）共用的舰体几何，从早期战斗机式样的有翼楔形体，换成细长无翼的 Odin 级战列巡洋舰剪影；`nighthawk.js` 同期做战机材质细节增强。

**V15 v1 切片（2026-07-04）**：新增 `src/scene/odinHull.js`——**DOM/WebGL 完全无关的纯函数**（`createOdinHull(THREE,{add,mats,detail})`），只调用调用方注入的 `add(geo,mat,t,r,s)`，因此 `capitalShip3D.js`（全 PBR 实体网格）与 `shipHologram.js`（网格+描边线框）可以喂同一份几何描述、各自渲染风格——精确对应最初规格"同一几何体喂 capitalShip3D 的侧视/尾视，一份资产两处用"。刀锋艏（占全长 37%）+ 舯部阶梯上层建筑/舰桥塔/4 根天线桅杆簇 + 背脊炮塔 row(5)+腹部吊舱(2)+尾部 7 联推进簇+外伸散热鳍桁架，greeble 密度尾>舯>艏。移除了旧设计的机翼（Odin 参考本就是无翼细长战舰剪影，不是战斗机式样）。

**风险门禁**：这是替换主战舰几何的高风险改动，沙盒完全无法渲染验证（`npm install puppeteer` 因沙盒网络白名单不含 `storage.googleapis.com` 下载 Chromium 失败，`EAI_AGAIN`，确认为沙盒硬限制）。因此默认行为（不带 `?ship=odin`）逻辑审查确认与改动前字节级相同，新舰体仅在显式加 URL 参数 `?ship=odin` 时生效。

**可验证/验证不到的部分**：`odinHull.js` 因为不碰 DOM/WebGL，是这批 3D 视觉工作里唯一能在沙盒里真正跑起来验证的一层——`tests/odinHull.test.js` 用 mock `add()` 记录所有 mesh 并算真实 `THREE.Box3`，断言长高比、刀锋艏占比、挂载点数量、`wire`/`full` 差异、无 NaN/Infinity。验证不到材质配色是否耐看、比例是否符合参考图的实际观感、镜头取景是否合适。

**已知简化（当时未做）**：旧舰体贴花（"TC CONDOR"/"01"/危险警示条）未在新舰体重新定位；greeble 未走 InstancedMesh 单 draw call 优化，沿用现有代码库的逐个 box 循环方式。**贴花已于 2026-07-05 补上（见本文件上方「B9」条目）；greeble 优化评估后判断跳过，理由同见该条目。**

**V15b 已交付**：`src/scene/nighthawk.js`——`heightToNormalMap()` 把原本的灰度 bumpMap 近似换成真正的切线空间法线贴图（Sobel 梯度编码），分辨率 256→384；新增腹部/侧甲板 greeble（+14/+10 处）+ 背部 greeble 22→34。全程零几何/轮廓改动，风险远低于 V15 的舰体重建。

**验证**：`npm run test` 90/90 绿（新增 odinHull 8 条）；`npm run build` 绿；`grep` 确认 `ship=odin`/`createOdinHull`/`heightToNormalMap` 都在对应产物 chunk 里；`vite preview` 7 页 curl 200。

**2026-07-04 二次修复（用户截图发现，沙盒不可见类 bug 的又一实例）**：用户本地打开 `?ship=odin` 截图两次反馈"完全不像参考图，看起来是方块状的"。逐行核对 `THREE.ConeGeometry` 的旋转/缩放组合后，用 Node 直接算 `Box3` 实测确认舰艏锥体的真实世界坐标包围盒是 ~2.1×2.1×2.1（近似立方体），不是预期的 3.7 长 / 扁平薄的刀锋——根因：THREE 的 scale 在 rotation **之前**作用于局部坐标系，`rotation.x=PI/2` 把局部 Y（锥体的 height 参数）映射到世界 Z 轴，旧代码却对局部 Y 做"压扁"缩放，实际上是在压缩长度而不是压扁厚度，又叠加了一个多余的 45° Z 轴旋转把三个轴的包围盒进一步搅乱成接近立方体。修复：锥体改用 `rotation=[PI/2,0,0]`（去掉多余的 45° 项）+ `scale=[0.9,1,0.22]`（缩放局部 Z 而不是局部 Y），Node 实测确认包围盒变为 X1.8×Y0.44×Z3.7——长、扁、窄，符合刀锋艏的设计意图。顺带修了尾部推进器挂载点 Y 坐标越出机身尾段包围盒的问题（7 个挂载点里若干个会露出机身外形成"漂浮方块"），并给 `'wire'`（全息投影）细节级别单独砍掉炮塔 row/腹部吊舱/3 根天线（只留 1 根）以减少线框视觉噪音。新增 3 条针对性回归测试，单测总数 90→93。**教训**：`THREE.Object3D` 的 scale-before-rotation 组合规律不直观，凭直觉写变换容易在"看起来应该对"但实际不对的情况下漏掉；后续任何用 `rotation`+`scale` 组合做"压扁/拉伸"效果的新增几何，都应该单独对该部件的世界坐标包围盒做断言，而不只测整艘船的总包围盒。

**2026-07-04 三次修复（架构级：改用连续 loft 船体）**：修好锥体比例后用户反馈"怎么能做的更好看一点而不是画的和积木玩具一样都是线条完全没有细节"——不是数值 bug，是架构问题：船体一直是三个独立图元（锥体艏 + 舯部 box + 尾部 box）拼接而成，中间没有共享表面，无论比例多准，拼接处的可见接缝都会读成"一堆方块堆在一起"。修复：新增 `buildHullLoftGeometry(THREE, stations)`——按"站位"（每站一个菱形截面：半宽/半高）手写 `BufferGeometry`，相邻站位用四边形连接成连续蒙皮，艏部收敛到近似零截面的尖点，尾部用扇形面片封口。用 Node 实测验证了三角形绕线方向（法线朝外）——采样每个非轴向顶点的法线径向点积全部为正；尾部封口环的平均法线 Z 分量为负（朝后/朝外）。船体的三个独立图元全部移除，替换成这一个连续 loft；炮塔/桅杆/吊舱/散热鳍/推进器舱等全部保留作为挂载在这个连续壳体上的独立配件。顺带修正"越改越空"的问题：上一轮为减少全息线框视觉噪音，把 `'wire'` 细节级别里的炮塔 row、3 根天线、腹部吊舱、精细面板缝全部砍掉了，但船体形状的根本 bug 修好之后用户反馈从"太乱"变成"太空/没细节"——恢复它们到 `'wire'`，只把真随机的精细 greeble 散布密度调到 40%（而非直接砍掉）。区分"结构性配件"（该留）和"随机散布细节"（密度可调）是这轮的关键判断。单测 93→94。**仍未解决**：连续 loft 的绕线/法线方向已 Node 实测校验，几何比例也有测试覆盖，但"好不好看"本质上需要真人在浏览器里看一眼，光靠数值断言无法穷尽。

**2026-07-04 四次追加（V15c，按参考图文字拆解补细节，非 bug 修复）**：用户给了一段针对参考战舰的详细文字拆解，按 5 类分列（① 侵略性船体几何/剪影——刀锋艏、斜面装甲、层叠式船体结构；② 表面细节/规模感——面板缝/舱口 + 舯部两侧一排重复的"模块化舱段"（导弹发射井/机库/护盾发生器观感，明确标注是建立旗舰规模感的"视觉锚点"）；③ 功能性上层建筑——阶梯指挥塔+纤细天线阵；④ 武器布置——背脊多联装重炮 row + 腹部与两侧点防御武器；⑤ 推进——多喷口推进簇 + 装甲整流罩+稳定鳍）。逐条比对确认 5 处明确缺口并补上：艏-舯衔接处加两层交叠装甲收环板（层叠装甲视觉断点）；舯部两侧新增 8 个模块化舱段 `sideBayMounts`（每侧 4 个，凸边框+内凹面板+双指示灯）；两侧新增 4 个点防御炮塔 `lateralTurretMounts`（每侧 2 个）；背脊 5 座炮塔全部改双联装；7 个推进器各加一圈装甲整流罩 `TorusGeometry`。新增 4 条测试（挂载点数量、左右镜像对称性、X 方向包含在散热鳍既有挂载范围内、`'wire'` 同样保留新配件）。单测 94→97。**仍未解决**：这轮补充是纯几何数值+挂载逻辑层面的比对与实现，依旧不是视觉渲染验证——沙盒无法打开浏览器看实际观感，新舱段/炮塔的比例、间距、材质在真实光照下是否真的读成"模块化舱段"而非又一堆随机方块，需要真人看一眼。commit `cd5cca1`。

---

### V16.（M）武器单时钟同步（CIWS/导弹/核弹/主炮）— 2026-07-04

**视觉轨第一步而非收尾**：V14 的镜头切换全部由它的事件驱动，先立权威时间线、镜头系统才有东西可订阅，反序会造成返工。

**新增基础设施**：`src/combat/weaponClock.js`——纯函数权威时间线模块（`startTimeline`/`phaseFraction`/`activePhase`/`msUntilPhase`/`forceAdvance` 等），`{weapon, t0, phases:[{name,at}]}` 结构，V14 的镜头状态机可直接订阅。`tests/weaponClock.test.js`（20 条）含"两个消费者读同一时间线在同一 `t` 下必须逐帧零差异"断言（浏览器 rAF 循环沙盒内无法真实驱动，用纯函数等价性断言代替）。

**实测审计发现，逐一修正**：`main.js` 的核弹 T- 倒计时（`#nukeWarning`）与主炮蓄力倒计时（`weaponWarning`）此前各自跑一个独立 `setInterval(...,40)` 轮询——与 rAF 主循环完全脱钩的第二时钟，已删除，改为在既有的逐帧函数 `updateCombatModule()` 里更新。`halley.ciwsLaserStart/ciwsLaserUntil` 审计确认是从未被读取的死代码（`performance.now()` 口径且与其余 `Date.now()` 口径不一致）——已删除。

**审计确认无需改动**：导弹/核弹分镜（`combatCine.js`）与 `halley.destroyed` 提前触发的强制剪切，本来就已经是从 `pilotView.started/until` 派生的单一 `e` 驱动——审计后确认这部分不是本次要修的 bug，未改动。

**范围边界**：未把 CIWS/核弹/导弹的完整分镜时序重构成 `weaponClock` 的具名 phases（留给 V14，届时相机导演系统本来就需要把这些时序表达成具名 phases）。

**验证**：`npm run test` 64/64 绿（含新增 20 条）；`npm run build` 绿，7 页 curl 200，产物 JS 语法校验通过；`grep` 确认无残留的 `ciwsLaserStart`/`ticker`/`chargeTicker` 悬空引用。`main.js` 属逻辑审查+静态验证，视觉效果未做真人验证。

---

### V14.（L）相机导演系统 — 2026-07-04（v1 切片，opt-in `?combatcam=director`）

镜头状态机 + 首发镜头库（导弹尾随/CIWS 炮塔位/主炮轴线/舰桥建立镜头）。**实施路线修正：复用 topdownCombat 现成场景资产**（舰船/导弹/彗星/爆炸全都建好了），废弃的只是固定俯视机位、不是场景本身。

**已交付**：`src/combat/cameraMath.js`（纯函数：`smoothDamp` 临界阻尼弹簧、`shouldPreempt` 优先级抢占规则、`blendFactor`/`easeBlend` 混合曲线，12 条单测）；`src/combat/weaponCameraDirector.js`（镜头状态机：`requestShot(id, {durationMs, blendInMs, refresh})`，抢占＝高优先级立即切入/同低优先级等当前镜头到期，`refresh:true` 支持 CIWS 这类高频事件"续期不重启"，6 条单测覆盖抢占/续期/自动回落/数值不发散）；`topdownCombat.js` 内部重构为委托 `weaponCameraDirector` 驱动相机，默认行为（无 flag）字节级不变——保留原有硬编码摇摄作为 `tacticalTopdown` 待机镜头。

**镜头库（v1 切片，4/5）**：`tacticalTopdown`（待机/巡航，即原摇摄，优先级 1）、`bridgeWide`（开场建立镜头，一次性 3.2s）、`mainGunAxis`（主炮轴线，优先级 3，随 `launchOrb()` 触发）、`missileTail`（导弹尾随，优先级 4，随 `launchMissile()` 触发）、`ciwsTurret`（CIWS 炮塔位，优先级 2，随 CIWS 随机开火触发、`refresh:true` 续期不重启）。

**范围边界（未做，见 P3 新条目）**：`impactOrbit`（末段撞击环绕）未实现；FOV 动态推拉/banking 侧倾细节未实现；「空间深度四件套」（实例化尾焰彩带/运动模糊粒子/近景尘埃视差层/动态 FOV）完全未动。

**验证**：`npm run test` 82/82 绿（新增 cameraMath 12 条 + weaponCameraDirector 6 条）；`npm run build` 绿，`grep` 确认 `combatcam`/`tacticalTopdown`/`bridgeWide` 内容已进入构建产物；`vite preview` + 7 个入口 curl 200。默认路径逻辑审查确认与改动前字节级相同；`?combatcam=director` 分支的镜头切换实际观感未做真人验证。

---

## v1.5「MSI 2026 Leagues」

### V0.（M）Leagues 页面 v1 — 2026-07-04

`leagues.html` + `src/pages/leaguesEntry.js` + `src/pages/leagues.js` + `public/leagues-data.json` + vite 多入口注册 + `nav.js` SITE 数组插入（games 与 novels 之间）+ `page-turn.css` 的 `.leagues-page` 主题变量块（海克斯金 `#c8aa6e` / 蓝 `#0ac8b9`，字体 Cinzel + IBM Plex Mono，与 games 品红/青区分）。初始数据为核实过的真实 MSI 2026 Bracket Stage 战况（8 强、双败淘汰、全 Bo5、Fearless Draft）：已完场 HLE 3-0 TSW、G2 3-2 TES（逆转横扫），另 5 组对阵/待定含 BLG vs T1（GG.bet 真实赔率）与总决赛占位。构建已验证：`npm run build` 绿色，`dist/leagues.html` + `dist/assets/leagues-*.js` 抽查确认真实内容在产物内，`vite preview` 全 7 入口 curl 200。

### V1.（S）Leagues 定时任务 — 2026-07-04

**实施路线偏离原计划**：未走 launchd + 本地 API 脚本，改用 Cowork 自带的 `scheduled-tasks`（任务名 `leagues-msi-daily`，每日 23:30 本地时间，提示词内联 `prompts/leagues-msi.md` 的纪律）——原因：这条自动化生命周期短（仅到 7/12）、且强依赖当天联网检索而非纯 API 调用，用 Cowork 会话原生的 WebSearch 能力比现写一个本地脚本更省事。**已知限制**：Cowork 定时任务需要 App 处于打开状态才会触发（关闭时错过的任务会在下次启动时补跑，触发条件是 App 而非系统唤醒）。7/12 决赛后该任务会自动做收官一跑并转 `mode:"archived"`，之后需要手动禁用。

**原始规格存档（从 roadmap.md §7.4 归档移入）**：定位——Labs 第三页，MSI 2026 限时竞猜（赛后转战绩存档页）。生命周期从第一天写进 schema：`mode:"live"|"archived"` 控制页面状态条与文案，赛事结束不下线、转为战绩档案（Labs 页的标准生命周期范式，供未来季节页复用）。骨架克隆 games.html 模式（hero+战绩+对阵卡+赔率+免责声明+i18n 全覆盖），主题海克斯金/蓝，与 games 品红/青、其余各页均区分。数据 `public/leagues-data.json`：`{updated, version, mode, bracket[], series[{id, round, bo, teams[], result?, pred:{winner, score, pWin, oddsImplied, factors[], reasoningZh, reasoningEn}}], fearless[{team, poolDepth, note}], champion[{team, p}]}`。预测纪律：夺冠概率自洽（Σp=1）；`oddsImplied=1/p` 诚实换算（可另列真实盘口价差对照，标注来源）；每个系列赛完场立即复盘计分（命中+Brier）。Fearless Draft 特色：每队英雄池深度指数，数据来自当届实际 pick 记录，不凭印象打分。

---

## v1.5「Arena Autopilot」

### V3.（M）Arena Autopilot 账本 + 规则引擎 — 2026-07-04

`src/lib/arenaRules.js`（纯函数规则引擎：`validateOrder`/`simulateFill`/`applyFill`/`checkStopLoss`/`checkDailyCircuitBreaker`/`checkSeasonReset`/`resetSeason`/`computeMetrics`，全部无副作用、无 DOM/fetch/Date.now 依赖）+ `public/arena-universe.json`（30 支固定候选池：14 支核心 AI 硬件 + 13 支大盘科技 + SPY/QQQ/SMH 三基准）+ `public/arena-ledger.json`（Model A/B 各 $10,000 初始账本，season 1 day 0，尚无持仓）。**测试地基已落地**：`npm install -D vitest` + `package.json` 加 `test` 脚本，`tests/arenaRules.test.js` 44 条单测覆盖全部硬风控分支（禁做空/固定域/信心门槛/换手率上限/Model B 交易日限制/单仓 20% 上限/持仓数上限/现金缓冲/加权成本/止损/日熔断/赛季重置/指标计算），`npm run test` 全绿；`npm run build` 复核未受影响。

**原始规格存档（V3–V5 落地前的设计要点与风控细则，从 roadmap.md §7.1 归档移入）**

与原报告的差异（评审结论）：①「高频」改为「日内双窗口 swing」——LLM 做不了毫秒/分钟级连续推理，Model A 每交易日 2 次批处理决策（开盘后窗口+尾盘窗口），Model B 盘后 1 次深度调仓评估；②状态外置是地基——`arena-ledger.json` 是唯一事实源，模型零会话记忆；③LLM 提案、规则引擎收单——模型输出 JSON 订单→代码层校验→通过才入账，拒单原因写回 ledger 作为下次反馈；④评估口径修正——前 30 个交易日只看累计收益/最大回撤/胜率/敞口，≥30 交易日后启用 30 日滚动年化+Sharpe。

风控细则（全部由规则引擎强制，不靠模型自觉）：基准纪律——账本每日同步记录 SPY/SMH 同期收益，所有展示以「超额收益 vs SPY」为主口径；换手率上限——Model A ≤20 笔/周超出直接拒单，Model B 只在周二/周四运行里允许交易；信心门槛——新开仓订单 `confidence<0.65` 一律拒单，减仓/清仓不设门槛；仓位止损（代码层）——A 账本单仓 -8%、B 账本 -15%，触发即生成强制清仓单；滑点分级——A 账本 5bp、B 账本 2bp，费用 0.5bp 不变；赛季制与版本归因——任一账本累计 -20% 冻结、产出验尸复盘、提示词版号+1、重置 $10,000 开新赛季，ledger 记录 `promptVersion`/`season`；固定交易域——`arena-universe.json` 维护候选池，模型只能域内下单，候选池每月人工审一次。

硬风控（代码层强制，模型无权越过）：现金账户只做多，禁杠杆/期权/做空；单票 ≤20% 账本净值；持仓 ≤8 只；现金 ≥5%；日亏 ≥3% 熔断（当日只允许 HOLD/SELL）；连续 3 日亏损→Model A 降频为 1 次/日。模拟撮合：市价按参考价 ±2bp 滑点+0.5bp 费用，收盘 mark-to-market。

---

*更早的 v1.4 收尾工作历史记录未在本次归档时补全（当时未落文件），此处从 v1.5 起开始维护完整存档。*
