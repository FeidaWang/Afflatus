# Project Afflatus — Release Notes

> 已完成工作的历史归档。roadmap.md 只保留仍需跟踪的未完成工作——完成的条目从那边移除后落在这里，保留原始技术细节（教训、验证方式、范围边界），供未来排查/复用参考，不追加新内容之外的整理。
> 按版本/日期倒序排列（最新在最上面）。

---

## v1.5 · Afflatus「Fable 5 Max 五模块」

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

**已知简化（未做，见 P3 新条目）**：旧舰体贴花（"TC CONDOR"/"01"/危险警示条）未在新舰体重新定位；greeble 未走 InstancedMesh 单 draw call 优化，沿用现有代码库的逐个 box 循环方式。

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

---

## v1.5「Arena Autopilot」

### V3.（M）Arena Autopilot 账本 + 规则引擎 — 2026-07-04

`src/lib/arenaRules.js`（纯函数规则引擎：`validateOrder`/`simulateFill`/`applyFill`/`checkStopLoss`/`checkDailyCircuitBreaker`/`checkSeasonReset`/`resetSeason`/`computeMetrics`，全部无副作用、无 DOM/fetch/Date.now 依赖）+ `public/arena-universe.json`（30 支固定候选池：14 支核心 AI 硬件 + 13 支大盘科技 + SPY/QQQ/SMH 三基准）+ `public/arena-ledger.json`（Model A/B 各 $10,000 初始账本，season 1 day 0，尚无持仓）。**测试地基已落地**：`npm install -D vitest` + `package.json` 加 `test` 脚本，`tests/arenaRules.test.js` 44 条单测覆盖全部硬风控分支（禁做空/固定域/信心门槛/换手率上限/Model B 交易日限制/单仓 20% 上限/持仓数上限/现金缓冲/加权成本/止损/日熔断/赛季重置/指标计算），`npm run test` 全绿；`npm run build` 复核未受影响。

---

*更早的 v1.4 收尾工作历史记录未在本次归档时补全（当时未落文件），此处从 v1.5 起开始维护完整存档。*
